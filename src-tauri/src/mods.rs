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

/// Ficheiro ao lado do jar com "tamanho:mtime SHA1": se o jar não mudou, não se volta a ler 190 MB (no Windows o antivírus analisa cada leitura).
fn side(p: &Path) -> std::path::PathBuf {
    let mut s = p.as_os_str().to_os_string();
    s.push(".sha1");
    s.into()
}

fn stamp(p: &Path) -> Option<String> {
    let m = std::fs::metadata(p).ok()?;
    let t = m.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?.as_secs();
    Some(format!("{}:{}", m.len(), t))
}

/// Guarda o SHA1 já conhecido de um jar (depois de o descarregar e conferir).
fn remember(p: &Path, sha: &str) {
    if let Some(st) = stamp(p) {
        let _ = std::fs::write(side(p), format!("{st} {}", sha.to_lowercase()));
    }
}

/// SHA1 de um ficheiro, lido aos bocados (o jar principal tem mais de 100 MB). Para jars usa a cache acima.
fn hex_file(p: &Path) -> Option<String> {
    use std::io::Read;
    let cacheable = p.extension().is_some_and(|x| x == "jar");
    if cacheable {
        if let (Some(st), Ok(txt)) = (stamp(p), std::fs::read_to_string(side(p))) {
            if let Some((s, h)) = txt.trim().split_once(' ') {
                if s == st && h.len() == 40 {
                    return Some(h.to_string());
                }
            }
        }
    }
    let mut f = std::fs::File::open(p).ok()?;
    let mut h = Sha1::new();
    let mut b = vec![0u8; 4 << 20];
    loop {
        let n = f.read(&mut b).ok()?;
        if n == 0 {
            break;
        }
        h.update(&b[..n]);
    }
    let out = format!("{:x}", h.finalize());
    if cacheable {
        remember(p, &out);
    }
    Some(out)
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

/// Escreve `buf` na posição `off` (várias ligações escrevem em sítios diferentes do mesmo ficheiro ao mesmo tempo).
#[cfg(windows)]
fn write_at(f: &std::fs::File, buf: &[u8], off: u64) -> std::io::Result<()> {
    use std::os::windows::fs::FileExt;
    let mut done = 0usize;
    while done < buf.len() {
        let n = f.seek_write(&buf[done..], off + done as u64)?;
        if n == 0 {
            return Err(std::io::Error::new(std::io::ErrorKind::WriteZero, "write 0"));
        }
        done += n;
    }
    Ok(())
}

#[cfg(unix)]
fn write_at(f: &std::fs::File, buf: &[u8], off: u64) -> std::io::Result<()> {
    use std::os::unix::fs::FileExt;
    f.write_all_at(buf, off)
}

/// Tamanho de cada pedaço e quantas ligações ao mesmo tempo. Uma só ligação ao GitHub fica presa a uma fração da largura de banda
/// (no Windows eram minutos para o jar de 190 MB): com várias ligações cada uma traz um pedaço e a velocidade soma.
const SEG: u64 = 8 << 20;
const PARALLEL: usize = 8;

/// Descarrega um pedaço [start, end] para dentro do ficheiro. Conta no `done` só o que ficou escrito.
async fn fetch_seg(cl: &reqwest::Client, url: &str, f: &std::sync::Arc<std::fs::File>, start: u64, end: u64, got: &mut u64, on_bytes: &(dyn Fn(u64) + Sync)) -> Result<(), String> {
    let rq = cl.get(url).header(reqwest::header::RANGE, format!("bytes={start}-{end}"));
    let mut r = tokio::time::timeout(Duration::from_secs(60), rq.send()).await.map_err(|_| "timeout".to_string())?.map_err(e)?;
    if r.status().as_u16() != 206 {
        return Err(format!("HTTP {}", r.status().as_u16()));
    }
    let mut buf: Vec<u8> = Vec::with_capacity(1 << 20);
    let mut off = start;
    while let Some(c) = tokio::time::timeout(Duration::from_secs(60), r.chunk()).await.map_err(|_| "timeout".to_string())?.map_err(e)? {
        buf.extend_from_slice(&c);
        // escritas grandes (1 MB) em vez de uma por cada bocadinho de rede: no Windows cada escrita pequena passa pelo antivírus
        if buf.len() >= (1 << 20) {
            let (ff, data, at) = (f.clone(), std::mem::take(&mut buf), off);
            let n = data.len() as u64;
            tokio::task::spawn_blocking(move || write_at(&ff, &data, at)).await.map_err(e)?.map_err(e)?;
            off += n;
            *got += n;
            on_bytes(n);
            buf = Vec::with_capacity(1 << 20);
        }
    }
    if !buf.is_empty() {
        let (ff, data, at) = (f.clone(), std::mem::take(&mut buf), off);
        let n = data.len() as u64;
        tokio::task::spawn_blocking(move || write_at(&ff, &data, at)).await.map_err(e)?.map_err(e)?;
        off += n;
        *got += n;
        on_bytes(n);
    }
    if off != end + 1 {
        return Err("pedaço incompleto".to_string());
    }
    Ok(())
}

/// Descarrega o ficheiro inteiro em várias ligações (pedaços de 8 MB). Erra se o servidor não aceitar pedaços: aí usa-se `fetch_part`.
async fn fetch_parallel(app: &AppHandle, cl: &reqwest::Client, url: &str, part: &Path) -> Result<(), String> {
    use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
    use std::sync::Arc;
    // o tamanho vem do "Content-Range: bytes 0-0/TOTAL" de um pedido de 1 byte
    let r = tokio::time::timeout(Duration::from_secs(30), cl.get(url).header(reqwest::header::RANGE, "bytes=0-0").send())
        .await
        .map_err(|_| "timeout".to_string())?
        .map_err(e)?;
    if r.status().as_u16() != 206 {
        return Err("sem pedaços".to_string());
    }
    let total: u64 = r
        .headers()
        .get(reqwest::header::CONTENT_RANGE)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.rsplit('/').next())
        .and_then(|s| s.trim().parse().ok())
        .ok_or_else(|| "sem tamanho".to_string())?;
    drop(r);
    if total < (16 << 20) {
        return Err("pequeno".to_string());
    }
    let f = std::fs::OpenOptions::new().create(true).write(true).truncate(true).open(part).map_err(e)?;
    f.set_len(total).map_err(e)?;
    let f = Arc::new(f);
    let nseg = total.div_ceil(SEG);
    let next = Arc::new(AtomicU64::new(0));
    let done = Arc::new(AtomicU64::new(0));
    let last = Arc::new(AtomicU64::new(0));
    let stop = Arc::new(AtomicBool::new(false));
    let mut tasks = Vec::new();
    for _ in 0..(PARALLEL as u64).min(nseg) {
        let (cl, url, f, next, done, last, stop, app) = (cl.clone(), url.to_string(), f.clone(), next.clone(), done.clone(), last.clone(), stop.clone(), app.clone());
        tasks.push(tokio::spawn(async move {
            loop {
                let i = next.fetch_add(1, Ordering::SeqCst);
                if i >= nseg || stop.load(Ordering::SeqCst) {
                    return Ok::<(), String>(());
                }
                let (start, end) = (i * SEG, ((i + 1) * SEG).min(total) - 1);
                let mut tries = 0u64;
                loop {
                    let mut got = 0u64;
                    let on_bytes = |n: u64| {
                        let d = done.fetch_add(n, Ordering::SeqCst) + n;
                        let l = last.load(Ordering::Relaxed);
                        if d.saturating_sub(l) > 1_000_000 && last.compare_exchange(l, d, Ordering::SeqCst, Ordering::Relaxed).is_ok() {
                            let _ = app.emit("progress", json!({"stage": "Sleep", "done": d.min(total.saturating_sub(1)), "total": total}));
                        }
                    };
                    match fetch_seg(&cl, &url, &f, start, end, &mut got, &on_bytes).await {
                        Ok(()) => break,
                        Err(x) => {
                            done.fetch_sub(got, Ordering::SeqCst); // vai repetir este pedaço do início: não contar duas vezes
                            tries += 1;
                            if tries >= 6 || stop.load(Ordering::SeqCst) {
                                stop.store(true, Ordering::SeqCst);
                                return Err(x);
                            }
                            tokio::time::sleep(Duration::from_millis(400 * tries)).await;
                        }
                    }
                }
            }
        }));
    }
    let mut err: Option<String> = None;
    for t in tasks {
        match t.await {
            Ok(Ok(())) => {}
            Ok(Err(x)) => err = Some(x),
            Err(x) => err = Some(x.to_string()),
        }
    }
    if let Some(x) = err {
        let _ = std::fs::remove_file(part);
        return Err(x);
    }
    Ok(())
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
    let cl = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .user_agent("SleepLauncher/1.0")
        .tcp_nodelay(true)
        .pool_max_idle_per_host(PARALLEL)
        .build()
        .map_err(e)?;
    let verify = |p: std::path::PathBuf, sha: String| async move { tokio::task::spawn_blocking(move || hex_file(&p).is_some_and(|x| x.eq_ignore_ascii_case(&sha))).await.unwrap_or(false) };
    let mut last = String::new();
    // 1) várias ligações ao mesmo tempo (rápido em qualquer sistema); 2) se o servidor não deixar, uma ligação que continua de onde ficou
    match fetch_parallel(app, &cl, url, &part).await {
        Ok(()) => {
            if verify(part.clone(), sha.to_string()).await {
                std::fs::rename(&part, target).map_err(e)?;
                remember(target, sha);
                return Ok(());
            }
            let _ = std::fs::remove_file(&part);
            last = "SHA1".to_string();
        }
        Err(x) => {
            let _ = std::fs::remove_file(&part);
            last = x;
        }
    }
    for _ in 0..8 {
        match fetch_part(app, &cl, url, &part).await {
            Ok(()) => {
                if verify(part.clone(), sha.to_string()).await {
                    std::fs::rename(&part, target).map_err(e)?;
                    remember(target, sha);
                    return Ok(());
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
    sync_with(app, url, mc, mods, 25).await
}

/// Igual, mas com o tempo máximo para LER o manifesto à escolha. Os downloads nunca são cortados por tempo: um jar novo de 130 MB
/// cortado aos 4 s em cada arranque nunca chegava ao fim e o launcher ficava para sempre na versão antiga.
pub async fn sync_with(app: &AppHandle, url: &str, mc: &str, mods: &Path, manifest_secs: u64) -> Result<String, String> {
    if url.trim().is_empty() {
        return Ok("sem manifesto de mods".to_string());
    }
    let _g = SYNC_LOCK.lock().await;
    // cache-buster: o GitHub/CDN guarda o manifesto uns minutos e a versão nova não aparecia
    let busted = format!("{url}{}t={}", if url.contains('?') { "&" } else { "?" }, std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0));
    let m = tokio::time::timeout(Duration::from_secs(manifest_secs), fetch_json(&busted)).await.map_err(|_| "MANIFEST:timeout".to_string())?.map_err(|x| format!("MANIFEST:{x}"))?;
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

/// Lista embutida de mods de FPS (Modrinth, SHA1 verificado) para as versões do jogo que o Sleep suporta.
fn builtin_perf(mc: &str) -> Option<serde_json::Value> {
    let rows: &[(&str, &str, &str)] = match mc {
        "1.21.11" => &[
            ("sodium", "https://cdn.modrinth.com/data/AANobbMI/versions/RB7CDjTS/sodium-fabric-0.8.15-beta.1%2Bmc1.21.11.jar", "5469cef6f5dddd72a1216d9a15393c90d8eb5f33"),
            ("lithium", "https://cdn.modrinth.com/data/gvQqBUqZ/versions/Ow7wA0kG/lithium-fabric-0.21.4%2Bmc1.21.11.jar", "203bdcb26e97b3217b045e1182651a7d7b6462ec"),
            ("immediatelyfast", "https://cdn.modrinth.com/data/5ZwdcRci/versions/4EwhsTu7/ImmediatelyFast-Fabric-1.14.3%2B1.21.11.jar", "43e451464f979bdf9ff4ac288b358a2f91b79ed8"),
            ("entityculling", "https://cdn.modrinth.com/data/NNAgCjsB/versions/hsBqkNc8/entityculling-fabric-1.12.1-mc1.21.11.jar", "75ede5f8df348f49102d16eb76da3dd1491dfb79"),
            ("ferrite-core", "https://cdn.modrinth.com/data/uXXizFIs/versions/Ii0gP3D8/ferritecore-8.2.0-fabric.jar", "c2e2f5e008f5bc9f401dfad8ca94909917006b65"),
        ],
        "26.1" => &[
            ("sodium", "https://cdn.modrinth.com/data/AANobbMI/versions/uGvVQBnw/sodium-fabric-0.8.9%2Bmc26.1.1.jar", "48b949ec71365788dfd4e89d489f7abd504aa709"),
            ("lithium", "https://cdn.modrinth.com/data/gvQqBUqZ/versions/Oqq8TOAV/lithium-fabric-0.24.7%2Bmc26.1.2.jar", "7959f418969ee8bfe50c0f21f352ed08b382f133"),
            ("immediatelyfast", "https://cdn.modrinth.com/data/5ZwdcRci/versions/xOA9hbpf/ImmediatelyFast-Fabric-1.15.3%2B26.1.jar", "0bc5865bcb7f2f09d85559a58fccddcfd335f44d"),
            ("entityculling", "https://cdn.modrinth.com/data/NNAgCjsB/versions/5fl0jM6C/entityculling-fabric-1.12.1-mc26.1.jar", "19138849906ea0c0c7e0c456f04713d1f6ea8a89"),
            ("ferrite-core", "https://cdn.modrinth.com/data/uXXizFIs/versions/d5ddUdiB/ferritecore-9.0.0-fabric.jar", "eac76ff0f3753422c61b2c44487d0d195d88d4bc"),
        ],
        "26.2" => &[
            ("sodium", "https://cdn.modrinth.com/data/AANobbMI/versions/xJZxADzI/sodium-fabric-0.9.2%2Bmc26.2.jar", "62a70961a5b3e06938e06ab5f2dc4c5a51cf3323"),
            ("lithium", "https://cdn.modrinth.com/data/gvQqBUqZ/versions/f7vZ0VWU/lithium-fabric-0.25.3%2Bmc26.2.jar", "435ad0289209bb72195e7a423756a03f5dfa5a9a"),
            ("immediatelyfast", "https://cdn.modrinth.com/data/5ZwdcRci/versions/pMWERcSu/ImmediatelyFast-Fabric-1.16.5%2B26.2.jar", "0286260261591fe77ba0d332d5d5a2d2e868c2c6"),
            ("entityculling", "https://cdn.modrinth.com/data/NNAgCjsB/versions/kHxKicVG/entityculling-fabric-1.12.1-mc26.2.jar", "d79658b6e729a4d22981342a5524ec9e6c420f3a"),
            ("ferrite-core", "https://cdn.modrinth.com/data/uXXizFIs/versions/d5ddUdiB/ferritecore-9.0.0-fabric.jar", "eac76ff0f3753422c61b2c44487d0d195d88d4bc"),
        ],
        _ => return None,
    };
    Some(serde_json::Value::Array(rows.iter().map(|(id, u, h)| json!({"id": id, "files": {mc: {"url": u, "sha1": h}}})).collect()))
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
    // com o manifesto a falhar (ou sem a lista "perf") usa-se a lista embutida da Modrinth (1.21.11, 26.1 e 26.2), com SHA1 verificado
    let mut m = fetch_json(url).await.unwrap_or_else(|_| json!({}));
    if m["perf"].as_array().map(|a| a.is_empty()).unwrap_or(true) {
        if let Some(list) = builtin_perf(mc) {
            m["perf"] = list;
        }
    }
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

/// Mods de terceiros que crasham o jogo ao entrar num servidor: o "Online Emotes" 3.4.x pede uma biblioteca (team.unnamed.mocha) que o
/// Emotecraft / Player Animation Library atuais não trazem, e dá NoClassDefFoundError no momento de entrar. Ficam desligados (".disabled", nada
/// é apagado): o Sleep já traz as suas próprias emotes. Devolve quantos desligou.
pub fn disable_crashers(mods: &Path) -> usize {
    let Ok(rd) = std::fs::read_dir(mods) else { return 0 };
    let mut n = 0;
    for en in rd.flatten() {
        let name = en.file_name().to_string_lossy().to_string();
        let low = name.to_lowercase();
        if low.ends_with(".jar") && (low.starts_with("online_emotes") || low.starts_with("online-emotes") || low.starts_with("onlineemotes")) {
            let mut to = en.path().into_os_string();
            to.push(".disabled");
            if std::fs::rename(en.path(), &to).is_ok() {
                n += 1;
            }
        }
    }
    n
}
