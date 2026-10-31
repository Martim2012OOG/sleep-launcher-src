use serde_json::{json, Value};
use sha1::{Digest, Sha1};
use futures::{stream, StreamExt};
use std::collections::HashSet;
use std::io::Cursor;
use tauri::{AppHandle, Emitter};
use std::path::{Path, PathBuf};

const API: &str = "https://api.modrinth.com/v2";
const UA: &str = "kubo-launcher/0.1.0 (launcher de Minecraft Sleep)";

fn e<E: std::fmt::Display>(x: E) -> String {
    x.to_string()
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().user_agent(UA).build().map_err(e)
}

async fn get(url: &str, q: &[(&str, String)]) -> Result<Value, String> {
    client()?.get(url).query(q).send().await.map_err(e)?.error_for_status().map_err(e)?.json().await.map_err(e)
}

/// mod -> mods, resourcepack -> resourcepacks, shader -> shaderpacks
pub fn folder(kind: &str) -> Result<&'static str, String> {
    match kind {
        "mod" => Ok("mods"),
        "resourcepack" => Ok("resourcepacks"),
        "shader" => Ok("shaderpacks"),
        _ => Err("tipo inválido".into()),
    }
}

pub fn safe(n: &str) -> Result<String, String> {
    Path::new(n)
        .file_name()
        .and_then(|s| s.to_str())
        .map(String::from)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "nome de ficheiro inválido".to_string())
}

fn idx_path(game: &Path) -> PathBuf {
    game.join("kubo-index.json")
}

pub fn idx_read(game: &Path) -> Value {
    std::fs::read(idx_path(game)).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_else(|| json!({}))
}

pub fn idx_write(game: &Path, v: &Value) -> Result<(), String> {
    std::fs::create_dir_all(game).map_err(e)?;
    std::fs::write(idx_path(game), serde_json::to_vec_pretty(v).map_err(e)?).map_err(e)
}

/// Loaders da Modrinth que servem a um loader da instância (o Quilt também carrega mods Fabric).
pub fn mr_loaders(loader: &str) -> Vec<&'static str> {
    match loader {
        "fabric" => vec!["fabric"],
        "quilt" => vec!["quilt", "fabric"],
        "forge" => vec!["forge"],
        "neoforge" => vec!["neoforge"],
        _ => vec![],
    }
}

pub async fn search(kind: &str, query: &str, mc: &str, loader: &str, category: &str, offset: u32) -> Result<Value, String> {
    if kind != "modpack" {
        folder(kind)?;
    }
    let mut f: Vec<Value> = vec![json!([format!("project_type:{kind}")])];
    if !mc.is_empty() {
        f.push(json!([format!("versions:{mc}")]));
    }
    if kind == "modpack" {
        f.push(json!(["categories:fabric"]));
    } else if kind == "mod" {
        let l = mr_loaders(loader);
        if !l.is_empty() {
            f.push(Value::Array(l.iter().map(|x| json!(format!("categories:{x}"))).collect()));
        }
    }
    if !category.is_empty() {
        f.push(json!([format!("categories:{category}")]));
    }
    let index = if query.is_empty() { "downloads" } else { "relevance" };
    let q = [
        ("query", query.to_string()),
        ("facets", Value::Array(f).to_string()),
        ("limit", "20".to_string()),
        ("offset", offset.to_string()),
        ("index", index.to_string()),
    ];
    let r = get(&format!("{API}/search"), &q).await?;
    let hits: Vec<Value> = r["hits"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|h| {
            json!({
                "id": h["project_id"], "slug": h["slug"], "title": h["title"],
                "description": h["description"], "icon": h["icon_url"],
                "downloads": h["downloads"], "author": h["author"]
            })
        })
        .collect();
    Ok(json!({ "hits": hits, "total": r["total_hits"] }))
}

/// Instala um projeto (e as dependências obrigatórias, se for mod) na pasta da instância.
pub async fn install(game: &Path, kind: &str, project: &str, mc: &str, loader: &str) -> Result<Vec<String>, String> {
    let fo = folder(kind)?;
    let dir = game.join(fo);
    std::fs::create_dir_all(&dir).map_err(e)?;
    let mut done: Vec<String> = vec![];
    let mut seen: HashSet<String> = HashSet::new();
    let mut queue: Vec<(String, u8)> = vec![(project.to_string(), 0)];
    while let Some((pid, depth)) = queue.pop() {
        if !seen.insert(pid.clone()) || depth > 4 {
            continue;
        }
        let main = pid == project;
        if !main && idx_read(game)[fo][&pid].is_object() {
            continue;
        }
        let mut q = vec![("game_versions", json!([mc]).to_string())];
        if kind == "mod" && !mr_loaders(loader).is_empty() {
            q.push(("loaders", json!(mr_loaders(loader)).to_string()));
        }
        let vs = get(&format!("{API}/project/{pid}/version"), &q).await?;
        let v = match vs.as_array().and_then(|a| a.first()).cloned() {
            Some(v) => v,
            None if main => return Err(format!("sem versão compatível com o {mc}")),
            None => {
                done.push(format!("sem versão compatível para uma dependência ({pid})"));
                continue;
            }
        };
        let files = v["files"].as_array().cloned().unwrap_or_default();
        let f = files.iter().find(|x| x["primary"].as_bool() == Some(true)).or(files.first()).ok_or("versão sem ficheiros")?;
        let url = f["url"].as_str().ok_or("ficheiro sem url")?.to_string();
        let name = safe(f["filename"].as_str().unwrap_or(""))?;
        let bytes = client()?.get(&url).send().await.map_err(e)?.error_for_status().map_err(e)?.bytes().await.map_err(e)?;
        if let Some(h) = f["hashes"]["sha1"].as_str() {
            if format!("{:x}", Sha1::digest(&bytes)) != h.to_lowercase() {
                return Err(format!("{name}: o SHA1 não bate certo"));
            }
        }
        let info = get(&format!("{API}/project/{pid}"), &[]).await.unwrap_or_else(|_| json!({}));
        let mut idx = idx_read(game);
        if let Some(old) = idx[fo][&pid]["file"].as_str() {
            if old != name {
                let _ = std::fs::remove_file(dir.join(old));
                let _ = std::fs::remove_file(dir.join(format!("{old}.disabled")));
            }
        }
        std::fs::write(dir.join(&name), &bytes).map_err(e)?;
        idx[fo][&pid] = json!({
            "file": name,
            "title": info["title"].as_str().unwrap_or(&name),
            "icon": info["icon_url"]
        });
        idx_write(game, &idx)?;
        done.push(info["title"].as_str().unwrap_or(&name).to_string());
        if kind == "mod" {
            for d in v["dependencies"].as_array().cloned().unwrap_or_default() {
                if d["dependency_type"].as_str() == Some("required") {
                    if let Some(p) = d["project_id"].as_str() {
                        queue.push((p.to_string(), depth + 1));
                    }
                }
            }
        }
    }
    Ok(done)
}

pub fn list(game: &Path, kind: &str) -> Result<Vec<Value>, String> {
    let fo = folder(kind)?;
    let idx = idx_read(game);
    let mut out: Vec<Value> = vec![];
    if let Ok(rd) = std::fs::read_dir(game.join(fo)) {
        for en in rd.flatten() {
            let name = en.file_name().to_string_lossy().to_string();
            let enabled = !name.ends_with(".disabled");
            let base = name.trim_end_matches(".disabled").to_string();
            if !(base.ends_with(".jar") || base.ends_with(".zip")) {
                continue;
            }
            let (mut title, mut icon, mut project) = (base.clone(), Value::Null, Value::Null);
            if let Some(m) = idx[fo].as_object() {
                for (k, v) in m {
                    if v["file"].as_str() == Some(base.as_str()) {
                        title = v["title"].as_str().unwrap_or(&base).to_string();
                        icon = v["icon"].clone();
                        project = json!(k);
                    }
                }
            }
            out.push(json!({ "file": name, "enabled": enabled, "title": title, "icon": icon, "project": project }));
        }
    }
    out.sort_by_key(|x| x["title"].as_str().unwrap_or("").to_lowercase());
    Ok(out)
}

/// Liga/desliga: acrescenta ou tira o sufixo .disabled
pub fn toggle(game: &Path, kind: &str, file: &str) -> Result<(), String> {
    let p = game.join(folder(kind)?).join(safe(file)?);
    let to = match p.to_string_lossy().strip_suffix(".disabled") {
        Some(s) => PathBuf::from(s),
        None => PathBuf::from(format!("{}.disabled", p.to_string_lossy())),
    };
    std::fs::rename(&p, to).map_err(e)
}

pub fn remove(game: &Path, kind: &str, file: &str) -> Result<(), String> {
    let fo = folder(kind)?;
    let name = safe(file)?;
    std::fs::remove_file(game.join(fo).join(&name)).map_err(e)?;
    let base = name.trim_end_matches(".disabled").to_string();
    let mut idx = idx_read(game);
    let key = idx[fo]
        .as_object()
        .and_then(|m| m.iter().find(|(_, v)| v["file"].as_str() == Some(base.as_str())).map(|(k, _)| k.clone()));
    if let Some(k) = key {
        if let Some(m) = idx[fo].as_object_mut() {
            m.remove(&k);
        }
        idx_write(game, &idx)?;
    }
    Ok(())
}

/// Nome do ficheiro da versão mais recente compatível (para saber se há atualização).
pub async fn latest_file(pid: &str, kind: &str, mc: &str, loader: &str) -> Result<Option<String>, String> {
    let mut q = vec![("game_versions", json!([mc]).to_string())];
    if kind == "mod" && !mr_loaders(loader).is_empty() {
        q.push(("loaders", json!(mr_loaders(loader)).to_string()));
    }
    let vs = get(&format!("{API}/project/{pid}/version"), &q).await?;
    Ok(vs.as_array().and_then(|a| a.first()).and_then(|v| {
        let fs = v["files"].as_array()?;
        let f = fs.iter().find(|x| x["primary"].as_bool() == Some(true)).or(fs.first())?;
        f["filename"].as_str().map(String::from)
    }))
}

/// Descarrega o .mrpack da versão Fabric mais recente e devolve (modrinth.index.json, bytes do zip).
pub async fn fetch_pack(project: &str) -> Result<(Value, Vec<u8>), String> {
    let q = [("loaders", json!(["fabric"]).to_string())];
    let vs = get(&format!("{API}/project/{project}/version"), &q).await?;
    let v = vs.as_array().and_then(|a| a.first()).cloned().ok_or("este modpack não tem versão Fabric")?;
    let files = v["files"].as_array().cloned().unwrap_or_default();
    let f = files
        .iter()
        .find(|x| x["filename"].as_str().map_or(false, |n| n.ends_with(".mrpack")))
        .ok_or("a versão não tem ficheiro .mrpack")?;
    let url = f["url"].as_str().ok_or("ficheiro sem url")?;
    let bytes = client()?.get(url).send().await.map_err(e)?.error_for_status().map_err(e)?.bytes().await.map_err(e)?;
    if let Some(h) = f["hashes"]["sha1"].as_str() {
        if format!("{:x}", Sha1::digest(&bytes)) != h.to_lowercase() {
            return Err("o SHA1 do modpack não bate certo".into());
        }
    }
    let mut z = zip::ZipArchive::new(Cursor::new(bytes.to_vec())).map_err(e)?;
    let mut txt = String::new();
    {
        let mut ix = z.by_name("modrinth.index.json").map_err(e)?;
        std::io::Read::read_to_string(&mut ix, &mut txt).map_err(e)?;
    }
    Ok((serde_json::from_str(&txt).map_err(e)?, bytes.to_vec()))
}

fn rel_ok(p: &str) -> Option<PathBuf> {
    let pb = PathBuf::from(p);
    if !p.is_empty() && pb.components().all(|c| matches!(c, std::path::Component::Normal(_))) {
        Some(pb)
    } else {
        None
    }
}

/// Só estes servidores são permitidos nos modpacks (regra da Modrinth).
fn host_ok(u: &str) -> bool {
    ["https://cdn.modrinth.com/", "https://github.com/", "https://raw.githubusercontent.com/", "https://gitlab.com/"].iter().any(|h| u.starts_with(h))
}

/// Descarrega os ficheiros do modpack (8 de cada vez) e copia as pastas overrides.
pub async fn apply_pack(app: &AppHandle, game: &Path, index: &Value, bytes: &[u8]) -> Result<(), String> {
    std::fs::create_dir_all(game).map_err(e)?;
    let files: Vec<Value> = index["files"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|f| f["env"]["client"].as_str() != Some("unsupported"))
        .collect();
    let total = files.len();
    let c = client()?;
    let mut st = Box::pin(
        stream::iter(files)
            .map(|f| {
                let c = c.clone();
                let game = game.to_path_buf();
                async move {
                    let path = f["path"].as_str().and_then(rel_ok).ok_or("caminho inválido no modpack".to_string())?;
                    let url = f["downloads"][0].as_str().ok_or("ficheiro sem download".to_string())?.to_string();
                    if !host_ok(&url) {
                        return Err(format!("servidor não permitido: {url}"));
                    }
                    let b = c.get(&url).send().await.map_err(e)?.error_for_status().map_err(e)?.bytes().await.map_err(e)?;
                    if let Some(h) = f["hashes"]["sha1"].as_str() {
                        if format!("{:x}", Sha1::digest(&b)) != h.to_lowercase() {
                            return Err(format!("{}: SHA1 não bate certo", path.display()));
                        }
                    }
                    let t = game.join(&path);
                    if let Some(d) = t.parent() {
                        std::fs::create_dir_all(d).map_err(e)?;
                    }
                    std::fs::write(&t, &b).map_err(e)?;
                    Ok::<(), String>(())
                }
            })
            .buffer_unordered(8),
    );
    let mut n = 0;
    while let Some(r) = st.next().await {
        r?;
        n += 1;
        let _ = app.emit("progress", json!({ "stage": "Modpack", "done": n, "total": total }));
    }
    let mut z = zip::ZipArchive::new(Cursor::new(bytes)).map_err(e)?;
    for i in 0..z.len() {
        let mut en = z.by_index(i).map_err(e)?;
        let Some(p) = en.enclosed_name() else { continue };
        let rel = if let Ok(r) = p.strip_prefix("overrides") {
            r.to_path_buf()
        } else if let Ok(r) = p.strip_prefix("client-overrides") {
            r.to_path_buf()
        } else {
            continue;
        };
        if en.is_dir() || rel.as_os_str().is_empty() {
            continue;
        }
        let t = game.join(rel);
        if let Some(d) = t.parent() {
            std::fs::create_dir_all(d).map_err(e)?;
        }
        let mut out = std::fs::File::create(&t).map_err(e)?;
        std::io::copy(&mut en, &mut out).map_err(e)?;
    }
    Ok(())
}
