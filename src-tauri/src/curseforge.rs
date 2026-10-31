use crate::modrinth::{folder, idx_read, idx_write, safe};
use serde_json::{json, Value};
use sha1::{Digest, Sha1};
use std::collections::HashSet;
use std::path::Path;

const API: &str = "https://api.curseforge.com/v1";
const UA: &str = "kubo-launcher/0.1.0 (launcher de Minecraft Sleep)";

fn e<E: std::fmt::Display>(x: E) -> String {
    x.to_string()
}

fn class(kind: &str) -> Result<u32, String> {
    match kind {
        "mod" => Ok(6),
        "resourcepack" => Ok(12),
        "shader" => Ok(6552),
        _ => Err("tipo inválido".into()),
    }
}

async fn get(key: &str, path: &str, q: &[(&str, String)]) -> Result<Value, String> {
    if key.trim().is_empty() {
        return Err("falta a chave da CurseForge (Definições)".into());
    }
    let c = reqwest::Client::builder().user_agent(UA).build().map_err(e)?;
    let r = c.get(format!("{API}{path}")).header("x-api-key", key.trim()).query(q).send().await.map_err(e)?;
    if r.status().as_u16() == 401 || r.status().as_u16() == 403 {
        return Err("a CurseForge recusou a chave ou o download".into());
    }
    r.error_for_status().map_err(e)?.json().await.map_err(e)
}

pub async fn categories(key: &str, kind: &str) -> Result<Vec<Value>, String> {
    let r = get(key, "/categories", &[("gameId", "432".to_string()), ("classId", class(kind)?.to_string())]).await?;
    let mut out: Vec<Value> = r["data"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|c| c["isClass"].as_bool() != Some(true))
        .map(|c| json!({ "id": c["id"], "name": c["name"] }))
        .collect();
    out.sort_by_key(|x| x["name"].as_str().unwrap_or("").to_lowercase());
    Ok(out)
}

/// modLoaderType da CurseForge (Forge 1, Fabric 4, Quilt 5, NeoForge 6). O Quilt usa os mods Fabric,
/// que são a grande maioria dos mods que dizem funcionar nele.
fn cf_loader(loader: &str) -> Option<&'static str> {
    match loader {
        "fabric" | "quilt" => Some("4"),
        "forge" => Some("1"),
        "neoforge" => Some("6"),
        _ => None,
    }
}

pub async fn search(key: &str, kind: &str, query: &str, mc: &str, loader: &str, category: &str, offset: u32) -> Result<Value, String> {
    let mut q = vec![
        ("gameId", "432".to_string()),
        ("classId", class(kind)?.to_string()),
        ("searchFilter", query.to_string()),
        ("sortField", "2".to_string()),
        ("sortOrder", "desc".to_string()),
        ("pageSize", "20".to_string()),
        ("index", offset.to_string()),
    ];
    if !mc.is_empty() {
        q.push(("gameVersion", mc.to_string()));
    }
    if kind == "mod" {
        if let Some(t) = cf_loader(loader) {
            q.push(("modLoaderType", t.to_string()));
        }
    }
    if !category.is_empty() {
        q.push(("categoryId", category.to_string()));
    }
    let r = get(key, "/mods/search", &q).await?;
    let hits: Vec<Value> = r["data"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|h| {
            json!({
                "id": format!("cf:{}", h["id"]), "title": h["name"], "description": h["summary"],
                "icon": h["logo"]["thumbnailUrl"], "downloads": h["downloadCount"],
                "url": h["links"]["websiteUrl"]
            })
        })
        .collect();
    Ok(json!({ "hits": hits, "total": r["pagination"]["totalCount"] }))
}

/// `project` vem como "cf:123". Instala o ficheiro mais recente compatível (e as dependências obrigatórias dos mods).
pub async fn install(key: &str, game: &Path, kind: &str, project: &str, mc: &str, loader: &str) -> Result<Vec<String>, String> {
    let fo = folder(kind)?;
    let dir = game.join(fo);
    std::fs::create_dir_all(&dir).map_err(e)?;
    let first = project.trim_start_matches("cf:").to_string();
    let mut done: Vec<String> = vec![];
    let mut seen: HashSet<String> = HashSet::new();
    let mut queue: Vec<(String, u8)> = vec![(first.clone(), 0)];
    while let Some((id, depth)) = queue.pop() {
        if !seen.insert(id.clone()) || depth > 4 {
            continue;
        }
        let main = id == first;
        let ikey = format!("cf:{id}");
        if !main && idx_read(game)[fo][&ikey].is_object() {
            continue;
        }
        let mut q = vec![("gameVersion", mc.to_string()), ("pageSize", "10".to_string())];
        if kind == "mod" {
            if let Some(t) = cf_loader(loader) {
                q.push(("modLoaderType", t.to_string()));
            }
        }
        let fl = get(key, &format!("/mods/{id}/files"), &q).await?;
        let files = fl["data"].as_array().cloned().unwrap_or_default();
        let f = match files
            .iter()
            .find(|x| x["isAvailable"].as_bool() != Some(false) && matches!(x["releaseType"].as_u64(), Some(1) | Some(2)))
            .or(files.first())
        {
            Some(f) => f.clone(),
            None if main => return Err(format!("sem ficheiro compatível com o {mc}")),
            None => {
                done.push(format!("dependência {id} sem ficheiro compatível"));
                continue;
            }
        };
        let fid = f["id"].to_string();
        let url = match f["downloadUrl"].as_str() {
            Some(u) => u.to_string(),
            None => match get(key, &format!("/mods/{id}/files/{fid}/download-url"), &[]).await {
                Ok(r) => r["data"].as_str().unwrap_or("").to_string(),
                Err(_) => String::new(),
            },
        };
        if url.is_empty() {
            if main {
                return Err("o autor não permite descarregar fora do site: usa o botão de abrir no site".into());
            }
            done.push(format!("dependência {id}: download desativado pelo autor"));
            continue;
        }
        let name = safe(f["fileName"].as_str().unwrap_or(""))?;
        let c = reqwest::Client::builder().user_agent(UA).build().map_err(e)?;
        let bytes = c.get(&url).send().await.map_err(e)?.error_for_status().map_err(e)?.bytes().await.map_err(e)?;
        for h in f["hashes"].as_array().cloned().unwrap_or_default() {
            if h["algo"].as_u64() == Some(1) {
                if format!("{:x}", Sha1::digest(&bytes)) != h["value"].as_str().unwrap_or("").to_lowercase() {
                    return Err(format!("{name}: o SHA1 não bate certo"));
                }
            }
        }
        let info = get(key, &format!("/mods/{id}"), &[]).await.unwrap_or_else(|_| json!({}));
        let title = info["data"]["name"].as_str().unwrap_or(&name).to_string();
        let mut idx = idx_read(game);
        if let Some(old) = idx[fo][&ikey]["file"].as_str() {
            if old != name {
                let _ = std::fs::remove_file(dir.join(old));
                let _ = std::fs::remove_file(dir.join(format!("{old}.disabled")));
            }
        }
        std::fs::write(dir.join(&name), &bytes).map_err(e)?;
        idx[fo][&ikey] = json!({ "file": name, "title": title, "icon": info["data"]["logo"]["thumbnailUrl"] });
        idx_write(game, &idx)?;
        done.push(title);
        if kind == "mod" {
            for d in f["dependencies"].as_array().cloned().unwrap_or_default() {
                if d["relationType"].as_u64() == Some(3) {
                    if let Some(m) = d["modId"].as_u64() {
                        queue.push((m.to_string(), depth + 1));
                    }
                }
            }
        }
    }
    Ok(done)
}

/// Nome do ficheiro mais recente compatível (para saber se há atualização).
pub async fn latest_file(key: &str, id: &str, kind: &str, mc: &str, loader: &str) -> Result<Option<String>, String> {
    let mut q = vec![("gameVersion", mc.to_string()), ("pageSize", "10".to_string())];
    if kind == "mod" {
        if let Some(t) = cf_loader(loader) {
            q.push(("modLoaderType", t.to_string()));
        }
    }
    let fl = get(key, &format!("/mods/{id}/files"), &q).await?;
    let files = fl["data"].as_array().cloned().unwrap_or_default();
    let f = files
        .iter()
        .find(|x| x["isAvailable"].as_bool() != Some(false) && matches!(x["releaseType"].as_u64(), Some(1) | Some(2)))
        .or(files.first());
    Ok(f.and_then(|x| x["fileName"].as_str().map(String::from)))
}
