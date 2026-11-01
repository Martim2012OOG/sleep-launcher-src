use crate::mojang::fetch_json;
use sha1::{Digest, Sha1};
use std::path::Path;

fn e<E: std::fmt::Display>(x: E) -> String {
    x.to_string()
}

fn hex(b: &[u8]) -> String {
    format!("{:x}", Sha1::digest(b))
}

/// Lê o manifesto remoto e deixa na pasta mods o jar certo para a versão `mc` (com SHA1).
/// Formato: {"mods":[{"id":"kubo","files":{"1.21.11":{"url":"...","sha1":"..."}}}]}
pub async fn sync(url: &str, mc: &str, mods: &Path) -> Result<String, String> {
    if url.trim().is_empty() {
        return Ok("sem manifesto de mods".to_string());
    }
    let m = fetch_json(url).await?;
    std::fs::create_dir_all(mods).map_err(e)?;
    let mut n = 0;
    for md in m["mods"].as_array().cloned().unwrap_or_default() {
        let id = md["id"].as_str().unwrap_or("");
        if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
            continue;
        }
        let f = &md["files"][mc];
        let (Some(u), Some(h)) = (f["url"].as_str(), f["sha1"].as_str()) else { continue };
        let name = format!("{id}-{mc}.jar");
        let target = mods.join(&name);
        let ok = std::fs::read(&target).map(|b| hex(&b).eq_ignore_ascii_case(h)).unwrap_or(false);
        if !ok {
            let cl = reqwest::Client::builder().connect_timeout(std::time::Duration::from_secs(20)).timeout(std::time::Duration::from_secs(600)).build().map_err(e)?;
            let b = cl.get(u).send().await.map_err(e)?.error_for_status().map_err(e)?.bytes().await.map_err(e)?;
            if !hex(&b).eq_ignore_ascii_case(h) {
                return Err(format!("SHA1 errado no mod {id}"));
            }
            std::fs::write(&target, &b).map_err(e)?;
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
            std::fs::write(&target, &b).map_err(e)?;
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
