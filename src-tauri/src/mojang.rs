use futures::stream::{self, StreamExt};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

const MANIFEST: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

fn e<E: std::fmt::Display>(x: E) -> String {
    x.to_string()
}

pub fn os_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

/// Regras da Mojang: sem regras = permitido; senão a última regra que corresponde decide.
pub fn allowed(rules: &Value) -> bool {
    let Some(list) = rules.as_array() else { return true };
    let mut ok = false;
    for r in list {
        let mut m = r.get("features").is_none();
        if let Some(o) = r.get("os") {
            m = m
                && o.get("name").map_or(true, |n| n.as_str() == Some(os_name()))
                && o.get("arch").map_or(true, |a| a.as_str() == Some("x86") && cfg!(target_arch = "x86"));
        }
        if m {
            ok = r["action"].as_str() == Some("allow");
        }
    }
    ok
}

/// Escolhe os natives certos para o processador (x64 ou arm64).
fn arch_ok(name: &str) -> bool {
    if name.contains("arm32") || name.contains("x86") {
        return false;
    }
    if name.contains("natives-") {
        return name.contains("arm64") == cfg!(target_arch = "aarch64");
    }
    true
}

/// Cliente com tempos limite: uma ligação lenta ou presa já não deixa o launcher a "pensar" para sempre.
fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().connect_timeout(std::time::Duration::from_secs(20)).timeout(std::time::Duration::from_secs(300)).user_agent("SleepLauncher/1.0").build().map_err(e)
}

pub async fn fetch_json(url: &str) -> Result<Value, String> {
    let mut last = String::new();
    for _ in 0..3 {
        match client()?.get(url).send().await {
            Ok(r) => match r.error_for_status() {
                Ok(r) => match r.json().await {
                    Ok(v) => return Ok(v),
                    Err(x) => last = x.to_string(),
                },
                Err(x) => last = x.to_string(),
            },
            Err(x) => last = x.to_string(),
        }
    }
    Err(last)
}

pub async fn get_file(url: &str, path: &Path) -> Result<(), String> {
    if path.exists() {
        return Ok(());
    }
    if let Some(p) = path.parent() {
        tokio::fs::create_dir_all(p).await.map_err(e)?;
    }
    let mut got = None;
    let mut last = String::new();
    for _ in 0..3 {
        match client()?.get(url).send().await {
            Ok(r) => match r.error_for_status() {
                Ok(r) => match r.bytes().await {
                    Ok(b) => {
                        got = Some(b);
                        break;
                    }
                    Err(x) => last = x.to_string(),
                },
                Err(x) => last = x.to_string(),
            },
            Err(x) => last = x.to_string(),
        }
    }
    let b = got.ok_or(last)?;
    let tmp = path.with_extension("part");
    tokio::fs::write(&tmp, &b).await.map_err(e)?;
    tokio::fs::rename(&tmp, path).await.map_err(e)
}

pub async fn versions() -> Result<Vec<Value>, String> {
    let m = fetch_json(MANIFEST).await?;
    Ok(m["versions"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|v| json!({"id": v["id"], "type": v["type"], "url": v["url"]}))
        .collect())
}

/// Lê (e descarrega se faltar) o json de uma versão vanilla.
pub async fn vanilla_json(root: &Path, id: &str, url: &str) -> Result<Value, String> {
    let p = root.join("versions").join(id).join(format!("{id}.json"));
    get_file(url, &p).await?;
    serde_json::from_slice(&tokio::fs::read(&p).await.map_err(e)?).map_err(e)
}

/// "grupo:nome:versão[:classificador]" para o caminho no repositório maven.
fn maven(name: &str) -> Option<String> {
    let p: Vec<&str> = name.split(':').collect();
    if p.len() < 3 {
        return None;
    }
    let c = if p.len() > 3 { format!("-{}", p[3]) } else { String::new() };
    Some(format!("{}/{}/{}/{}-{}{}.jar", p[0].replace('.', "/"), p[1], p[2], p[1], p[2], c))
}

fn lib_rel(l: &Value) -> Option<String> {
    match l["downloads"]["artifact"]["path"].as_str() {
        Some(p) => Some(p.to_string()),
        None => maven(l["name"].as_str()?),
    }
}

fn lib_url(l: &Value, rel: &str) -> Option<String> {
    // url vazio = ficheiro que o instalador do Forge/NeoForge já criou
    match l["downloads"]["artifact"]["url"].as_str().filter(|u| !u.is_empty()) {
        Some(u) => Some(u.to_string()),
        None => l["url"].as_str().filter(|b| !b.is_empty()).map(|b| format!("{b}{rel}")),
    }
}

/// Id da versão cujo .jar é usado (no Fabric é a versão vanilla).
pub fn jar_id(vj: &Value, id: &str) -> String {
    vj["jar"].as_str().unwrap_or(id).to_string()
}

pub fn classpath(root: &Path, vj: &Value, id: &str) -> Vec<PathBuf> {
    let mut out = vec![];
    for l in vj["libraries"].as_array().cloned().unwrap_or_default() {
        if !allowed(&l["rules"]) || !arch_ok(l["name"].as_str().unwrap_or("")) {
            continue;
        }
        if let Some(p) = lib_rel(&l) {
            out.push(root.join("libraries").join(p));
        }
    }
    let j = jar_id(vj, id);
    out.push(root.join("versions").join(&j).join(format!("{j}.jar")));
    out
}

fn extract(bytes: &[u8], dir: &Path) -> Result<(), String> {
    let mut z = zip::ZipArchive::new(std::io::Cursor::new(bytes)).map_err(e)?;
    for i in 0..z.len() {
        let mut f = z.by_index(i).map_err(e)?;
        let n = f.name().to_string();
        if f.is_dir() || n.starts_with("META-INF") {
            continue;
        }
        let Some(fname) = Path::new(&n).file_name() else { continue };
        let mut out = std::fs::File::create(dir.join(fname)).map_err(e)?;
        std::io::copy(&mut f, &mut out).map_err(e)?;
    }
    Ok(())
}

/// Descarrega cliente, bibliotecas, natives e assets para o json `vj` (vanilla ou já fundido com o Fabric).
pub async fn install(app: &AppHandle, root: &Path, id: &str, vj: &Value) -> Result<(), String> {
    let progress = |stage: &str, done: usize, total: usize| {
        let _ = app.emit("progress", json!({"stage": stage, "done": done, "total": total}));
    };
    let vdir = root.join("versions").join(id);
    let jid = jar_id(vj, id);

    progress("Cliente", 0, 1);
    let client = vj["downloads"]["client"]["url"].as_str().ok_or("versão sem client.jar")?;
    get_file(client, &root.join("versions").join(&jid).join(format!("{jid}.jar"))).await?;
    progress("Cliente", 1, 1);

    let mut jobs: Vec<(String, PathBuf)> = vec![];
    let mut natives: Vec<PathBuf> = vec![];
    for l in vj["libraries"].as_array().cloned().unwrap_or_default() {
        if !allowed(&l["rules"]) || !arch_ok(l["name"].as_str().unwrap_or("")) {
            continue;
        }
        if let Some(rel) = lib_rel(&l) {
            if let Some(u) = lib_url(&l, &rel) {
                jobs.push((u, root.join("libraries").join(rel)));
            }
        }
        // formato antigo (até 1.18): natives como "classifiers"
        if let Some(c) = l["natives"][os_name()].as_str() {
            let c = c.replace("${arch}", "64");
            let a = &l["downloads"]["classifiers"][c.as_str()];
            if let (Some(u), Some(p)) = (a["url"].as_str(), a["path"].as_str()) {
                let pb = root.join("libraries").join(p);
                jobs.push((u.to_string(), pb.clone()));
                natives.push(pb);
            }
        }
    }
    let total = jobs.len();
    let mut done = 0;
    let mut st = stream::iter(jobs).map(|(u, p)| async move { get_file(&u, &p).await }).buffer_unordered(12);
    while let Some(r) = st.next().await {
        r?;
        done += 1;
        progress("Bibliotecas", done, total);
    }
    let ndir = vdir.join("natives");
    tokio::fs::create_dir_all(&ndir).await.map_err(e)?;
    for p in natives {
        let b = tokio::fs::read(&p).await.map_err(e)?;
        extract(&b, &ndir)?;
    }

    let ai = &vj["assetIndex"];
    let aid = ai["id"].as_str().ok_or("versão sem assetIndex")?;
    let ipath = root.join("assets").join("indexes").join(format!("{aid}.json"));
    get_file(ai["url"].as_str().ok_or("assetIndex sem url")?, &ipath).await?;
    let idx: Value = serde_json::from_slice(&tokio::fs::read(&ipath).await.map_err(e)?).map_err(e)?;
    let objs: Vec<(String, PathBuf)> = idx["objects"]
        .as_object()
        .cloned()
        .unwrap_or_default()
        .values()
        .filter_map(|o| {
            let h = o["hash"].as_str()?;
            let p = root.join("assets").join("objects").join(&h[..2]).join(h);
            Some((format!("https://resources.download.minecraft.net/{}/{}", &h[..2], h), p))
        })
        .collect();
    let total = objs.len();
    let mut done = 0;
    let mut st = stream::iter(objs).map(|(u, p)| async move { get_file(&u, &p).await }).buffer_unordered(16);
    while let Some(r) = st.next().await {
        r?;
        done += 1;
        if done % 25 == 0 || done == total {
            progress("Assets", done, total);
        }
    }
    Ok(())
}
