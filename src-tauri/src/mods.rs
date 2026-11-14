use crate::mojang::fetch_json;
use serde_json::json;
use sha1::{Digest, Sha1};
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Id da mod principal no manifesto. As extensões dependem dela: sem este jar o jogo não pode arrancar com elas.
const MAIN_ID: &str = "kubo";
/// Já vêm dentro do jar principal: não se descarregam à parte e as cópias soltas apagam-se.
const BUNDLED: &[&str] = &["kubo-combat"];
/// Só um download de cada vez (o de Jogar e o que corre ao abrir o launcher escreviam no mesmo ficheiro).
static SYNC_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn e<E: std::fmt::Display>(x: E) -> String {
    x.to_string()
}

fn hex(b: &[u8]) -> String {
    format!("{:x}", Sha1::digest(b))
}

/// SHA1 de um ficheiro, lido aos bocados (o jar principal tem mais de 100 MB).
fn hex_file(p: &Path) -> Option<String> {
    use std::io::Read;
    let mut f = std::fs::File::open(p).ok()?;
    let mut h = Sha1::new();
    let mut b = vec![0u8; 1 << 20];
    loop {
        let n = f.read(&mut b).ok()?;
        if n == 0 {
            break;
        }
        h.update(&b[..n]);
    }
    Some(format!("{:x}", h.finalize()))
}

/// Apaga as cópias soltas das extensões que já vêm dentro do jar principal.
pub fn purge_bundled(mods: &Path) {
    let Ok(rd) = std::fs::read_dir(mods) else { return };
    for en in rd.flatten() {
        let n = en.file_name().to_string_lossy().to_string();
        if BUNDLED.iter().any(|id| n.starts_with(&format!("{id}-"))) && (n.ends_with(".jar") || n.ends_with(".part")) {
            let _ = std::fs::remove_file(en.path());
        }
    }
}

/// Escreve para o lado e troca: nunca fica um jar a meio.
fn write_atomic(target: &Path, b: &[u8]) -> Result<(), String> {
    let tmp = target.with_extension("part");
    std::fs::write(&tmp, b).map_err(e)?;
    std::fs::rename(&tmp, target).map_err(e)
}

/// O jar principal desta versão está no disco e inteiro? (um jar cortado a meio não abre como zip)
pub fn has_main(mods: &Path, mc: &str) -> bool {
    std::fs::File::open(mods.join(format!("{MAIN_ID}-{mc}.jar"))).ok().is_some_and(|f| zip::ZipArchive::new(f).is_ok())
}

/// O jogo tem o que precisa para arrancar com o Sleep: o jar principal e o Fabric API de que ele depende.
pub fn is_ready(mods: &Path, mc: &str) -> bool {
    has_main(mods, mc) && std::fs::File::open(mods.join(format!("fabric-api-{mc}.jar"))).ok().is_some_and(|f| zip::ZipArchive::new(f).is_ok())
}

/// Numa leitura anterior do manifesto, esta versão do jogo não tinha Sleep? (só assim se pode jogar sem ele quando não há internet)
pub fn known_without_sleep(mods: &Path) -> bool {
    mods.join(".no-sleep").exists()
}

/// As mods desta versão foram verificadas há menos de 6 horas e está lá tudo? Então Jogar não precisa de ir à rede.
pub fn is_fresh(mods: &Path, mc: &str) -> bool {
    let recent = std::fs::metadata(mods.join(".synced")).and_then(|m| m.modified()).ok().and_then(|t| t.elapsed().ok()).is_some_and(|d| d.as_secs() < 6 * 3600);
    // numa versão do jogo sem Sleep (muitos modpacks) não há nada para ter no disco: antes isto ia à rede em todos os arranques
    recent && (is_ready(mods, mc) || known_without_sleep(mods))
}

/// Descarrega para `.part`, continuando do ponto onde ficou. Só falha se a ligação parar 60 s seguidos: ligações lentas chegam ao fim.
async fn fetch_part(app: &AppHandle, cl: &reqwest::Client, url: &str, part: &Path) -> Result<(), String> {
    use std::io::Write;
    let have = std::fs::metadata(part).map(|m| m.len()).unwrap_or(0);
    let mut rq = cl.get(url);
    if have > 0 {
        rq = rq.header(reqwest::header::RANGE, format!("bytes={have}-"));
    }
    let r = tokio::time::timeout(Duration::from_secs(60), rq.send()).await.map_err(|_| "timeout".to_string())?.map_err(e)?;
    if r.status().as_u16() == 416 {
        let _ = std::fs::remove_file(part);
        return Err("HTTP 416".to_string());
    }
    let mut r = r.error_for_status().map_err(e)?;
    let resumed = r.status().as_u16() == 206;
    let mut f = std::fs::OpenOptions::new().create(true).write(true).append(resumed).truncate(!resumed).open(part).map_err(e)?;
    let mut done = if resumed { have } else { 0 };
    let total = done + r.content_length().unwrap_or(0);
    let mut last = 0u64;
    while let Some(c) = tokio::time::timeout(Duration::from_secs(60), r.chunk()).await.map_err(|_| "timeout".to_string())?.map_err(e)? {
        f.write_all(&c).map_err(e)?;
        done += c.len() as u64;
        if total > 0 && done - last > 1_000_000 {
            last = done;
            let _ = app.emit("progress", json!({"stage": "Sleep", "done": done.min(total.saturating_sub(1)), "total": total}));
        }
    }
    f.flush().map_err(e)
}

async fn download(app: &AppHandle, url: &str, target: &Path, sha: &str) -> Result<(), String> {
    // o nome leva o início do SHA1: um download a meio de uma versão antiga nunca se mistura com o da nova
    let tag: String = sha.chars().take(10).collect();
    let part = target.with_extension(format!("{tag}.part"));
    let stem = target.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    if let Some(dir) = target.parent() {
        for en in std::fs::read_dir(dir).map_err(e)?.flatten() {
            let n = en.file_name().to_string_lossy().to_string();
            if n.starts_with(&format!("{stem}.")) && n.ends_with(".part") && en.path() != part {
                let _ = std::fs::remove_file(en.path());
            }
        }
    }
    let cl = reqwest::Client::builder().connect_timeout(Duration::from_secs(20)).user_agent("SleepLauncher/1.0").build().map_err(e)?;
    let mut last = String::new();
    for _ in 0..8 {
        match fetch_part(app, &cl, url, &part).await {
            Ok(()) => {
                if hex_file(&part).is_some_and(|x| x.eq_ignore_ascii_case(sha)) {
                    return std::fs::rename(&part, target).map_err(e);
                }
                let _ = std::fs::remove_file(&part);
                last = "SHA1".to_string();
            }
            Err(x) => last = x,
        }
    }
    Err(last)
}

/// Lê o manifesto remoto e deixa na pasta mods o jar certo para a versão `mc` (com SHA1), começando sempre pelo principal.
/// Formato: {"mods":[{"id":"kubo","files":{"1.21.11":{"url":"...","sha1":"..."}}}]}
/// Um erro a ler o manifesto vem com o prefixo "MANIFEST:" (ainda não se sabe se esta versão tem Sleep).
pub async fn sync(app: &AppHandle, url: &str, mc: &str, mods: &Path) -> Result<String, String> {
    if url.trim().is_empty() {
        return Ok("sem manifesto de mods".to_string());
    }
    let _g = SYNC_LOCK.lock().await;
    // cache-buster: o GitHub/CDN guarda o manifesto uns minutos e a versão nova não aparecia
    let busted = format!("{url}{}t={}", if url.contains('?') { "&" } else { "?" }, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0));
    let m = tokio::time::timeout(Duration::from_secs(25), fetch_json(&busted)).await.map_err(|_| "MANIFEST:timeout".to_string())?.map_err(|x| format!("MANIFEST:{x}"))?;
    std::fs::create_dir_all(mods).map_err(e)?;
    purge_bundled(mods);
    let mut list = m["mods"].as_array().cloned().unwrap_or_default();
    list.sort_by_key(|md| md["id"].as_str() != Some(MAIN_ID));
    let offered = list.iter().any(|md| md["id"].as_str() == Some(MAIN_ID) && md["files"][mc]["url"].is_string());
    let marker = mods.join(".no-sleep");
    if offered {
        let _ = std::fs::remove_file(&marker);
    } else {
        let _ = std::fs::write(&marker, b"");
    }
    let mut n = 0;
    for md in list {
        let id = md["id"].as_str().unwrap_or("");
        if id.is_empty() || BUNDLED.contains(&id) || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
            continue;
        }
        let f = &md["files"][mc];
        let (Some(u), Some(h)) = (f["url"].as_str(), f["sha1"].as_str()) else { continue };
        let name = format!("{id}-{mc}.jar");
        let target = mods.join(&name);
        let ok = hex_file(&target).is_some_and(|x| x.eq_ignore_ascii_case(h));
        if !ok {
            download(app, u, &target, h).await?;
            n += 1;
        }
        // apaga jars antigos do mesmo mod ("id-<só números e pontos>.jar") de outras versões do jogo
        let prefix = format!("{id}-");
        for en in std::fs::read_dir(mods).map_err(e)?.flatten() {
            let fname = en.file_name().to_string_lossy().to_string();
            if fname == name {
                continue;
            }
            if let Some(rest) = fname.strip_prefix(&prefix).and_then(|r| r.strip_suffix(".jar")) {
                if !rest.is_empty() && rest.chars().all(|c| c.is_ascii_digit() || c == '.') {
                    let _ = std::fs::remove_file(en.path());
                }
            }
        }
    }
    if offered && !has_main(mods, mc) {
        return Err("SHA1".to_string());
    }
    // só chega aqui com todos os jars do manifesto no disco e verificados (ou sabendo que esta versão não tem Sleep)
    let _ = std::fs::write(mods.join(".synced"), b"");
    if n > 0 {
        let _ = app.emit("progress", json!({"stage": "Sleep", "done": 1, "total": 1}));
    }
    Ok(format!("{n} mod(s) atualizado(s)"))
}

/// Mods de FPS (lista "perf" do manifesto: Sodium, Lithium, FerriteCore, Entity Culling, ImmediatelyFast), descarregados da Modrinth para a
/// pasta escondida. Se a instância já tem um deles na pasta mods (visível) NÃO se junta outro (o Fabric recusa mods duplicados).
/// `enabled = false` apaga os que estavam instalados aqui.
pub async fn sync_perf(url: &str, mc: &str, hidden: &Path, visible: &Path, enabled: bool) -> Result<String, String> {
    const KEYS: &[(&str, &[&str])] = &[
        ("sodium", &["sodium"]),
        ("lithium", &["lithium"]),
        ("ferrite-core", &["ferritecore", "ferrite-core", "ferrite_core"]),
        ("entityculling", &["entityculling", "entity-culling", "entity_culling"]),
        ("immediatelyfast", &["immediatelyfast"]),
    ];
    let name_of = |id: &str| format!("{id}-{mc}.jar");
    if !enabled {
        for (id, _) in KEYS {
            let _ = std::fs::remove_file(hidden.join(name_of(id)));
        }
        return Ok("FPS desligado".into());
    }
    if url.trim().is_empty() {
        return Ok(String::new());
    }
    let m = fetch_json(url).await?;
    let vis: Vec<String> = std::fs::read_dir(visible)
        .map(|r| r.flatten().map(|e| e.file_name().to_string_lossy().to_lowercase()).filter(|n| n.ends_with(".jar")).collect())
        .unwrap_or_default();
    std::fs::create_dir_all(hidden).map_err(e)?;
    let mut n = 0;
    for md in m["perf"].as_array().cloned().unwrap_or_default() {
        let id = md["id"].as_str().unwrap_or("");
        let Some((_, keys)) = KEYS.iter().find(|(k, _)| *k == id) else { continue };
        let name = name_of(id);
        let target = hidden.join(&name);
        if vis.iter().any(|f| keys.iter().any(|k| f.contains(k))) {
            let _ = std::fs::remove_file(&target);
            continue;
        }
        let f = &md["files"][mc];
        let (Some(u), Some(h)) = (f["url"].as_str(), f["sha1"].as_str()) else {
            let _ = std::fs::remove_file(&target);
            continue;
        };
        if !u.starts_with("https://cdn.modrinth.com/") {
            continue;
        }
        let ok = std::fs::read(&target).map(|b| hex(&b).eq_ignore_ascii_case(h)).unwrap_or(false);
        if !ok {
            let cl = reqwest::Client::builder().connect_timeout(std::time::Duration::from_secs(15)).timeout(std::time::Duration::from_secs(120)).build().map_err(e)?;
            let b = cl.get(u).send().await.map_err(e)?.error_for_status().map_err(e)?.bytes().await.map_err(e)?;
            if !hex(&b).eq_ignore_ascii_case(h) {
                return Err(format!("SHA1 errado em {id}"));
            }
            write_atomic(&target, &b)?;
            n += 1;
        }
    }
    Ok(format!("{n} mod(s) de FPS"))
}

/// Caminhos dos jars escondidos, separados pelo separador do sistema (`;` no Windows, `:` no Mac/Linux), como o Fabric Loader espera.
pub fn jar_list(dir: &Path) -> String {
    let sep = if cfg!(windows) { ";" } else { ":" };
    let mut v: Vec<String> = std::fs::read_dir(dir)
        .map(|r| r.flatten().map(|e| e.path()).filter(|p| p.extension().map(|x| x == "jar").unwrap_or(false)).map(|p| p.display().to_string()).collect())
        .unwrap_or_default();
    v.sort();
    v.join(sep)
}

/// Apaga da pasta `mods` do jogador as cópias antigas que as versões anteriores do launcher lá deixavam ("kubo-<versão>.jar" e as extensões).
pub fn purge_visible(mods: &Path) {
    let Ok(rd) = std::fs::read_dir(mods) else { return };
    for en in rd.flatten() {
        let n = en.file_name().to_string_lossy().to_lowercase();
        if n.ends_with(".jar") && (n.starts_with("kubo-") || n.starts_with("kubo_")) {
            let _ = std::fs::remove_file(en.path());
        }
    }
}
