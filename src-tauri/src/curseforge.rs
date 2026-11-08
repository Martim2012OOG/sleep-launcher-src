use crate::modrinth::{extract_overrides, folder, idx_read, idx_write, safe};
use futures::{stream, StreamExt};
use serde_json::{json, Value};
use sha1::{Digest, Sha1};
use std::collections::{HashMap, HashSet};
use std::io::Cursor;
use std::path::Path;
use tauri::{AppHandle, Emitter};

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
        "modpack" => Ok(4471),
        _ => Err("tipo inválido".into()),
    }
}

async fn get(key: &str, path: &str, q: &[(&str, String)]) -> Result<Value, String> {
    if key.trim().is_empty() {
        return Err("A CurseForge não está disponível nesta versão".into());
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
    if kind == "mod" || kind == "modpack" {
        // nos modpacks o Quilt não se junta ao Fabric: é o loader exato
        let t = if kind == "modpack" && loader == "quilt" { Some("5") } else { cf_loader(loader) };
        if let Some(t) = t {
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
                "url": h["links"]["websiteUrl"], "author": h["authors"][0]["name"]
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

async fn post(key: &str, path: &str, body: Value) -> Result<Value, String> {
    if key.trim().is_empty() {
        return Err("A CurseForge não está disponível nesta versão".into());
    }
    let c = reqwest::Client::builder().user_agent(UA).build().map_err(e)?;
    c.post(format!("{API}{path}")).header("x-api-key", key.trim()).json(&body).send().await.map_err(e)?.error_for_status().map_err(e)?.json().await.map_err(e)
}

/// (loader, versão do loader) do manifest.json de um modpack: "forge-47.2.0", "fabric-0.16.0", "neoforge-21.1.172", "quilt-0.26.0".
pub fn pack_loader(m: &Value) -> (&'static str, Option<String>) {
    let list = m["minecraft"]["modLoaders"].as_array().cloned().unwrap_or_default();
    let id = list.iter().find(|x| x["primary"].as_bool() == Some(true)).or(list.first()).and_then(|x| x["id"].as_str()).unwrap_or("");
    let Some((l, v)) = id.split_once('-') else { return ("vanilla", None) };
    let l = match l {
        "fabric" => "fabric",
        "quilt" => "quilt",
        "forge" => "forge",
        "neoforge" => "neoforge",
        _ => return ("vanilla", None),
    };
    (l, Some(v.to_string()))
}

/// Descarrega o zip do modpack (último ficheiro compatível, sem os de servidor) e devolve (manifest.json, bytes).
pub async fn fetch_pack(key: &str, id: &str, mc: &str, loader: &str) -> Result<(Value, Vec<u8>), String> {
    let mut q = vec![("pageSize", "30".to_string())];
    if !mc.is_empty() {
        q.push(("gameVersion", mc.to_string()));
    }
    if let Some(t) = if loader == "quilt" { Some("5") } else { cf_loader(loader) } {
        q.push(("modLoaderType", t.to_string()));
    }
    let fl = get(key, &format!("/mods/{id}/files"), &q).await?;
    let files: Vec<Value> = fl["data"].as_array().cloned().unwrap_or_default().into_iter().filter(|x| x["isServerPack"].as_bool() != Some(true) && x["isAvailable"].as_bool() != Some(false)).collect();
    let f = files.iter().find(|x| x["releaseType"].as_u64() == Some(1)).or(files.first()).ok_or("este modpack não tem versão para esses filtros")?;
    let url = f["downloadUrl"].as_str().ok_or("o autor deste modpack não permite instalá-lo fora do site da CurseForge")?.replace('+', "%2B");
    let c = reqwest::Client::builder().user_agent(UA).build().map_err(e)?;
    let bytes = c.get(&url).send().await.map_err(e)?.error_for_status().map_err(e)?.bytes().await.map_err(e)?.to_vec();
    if !sha_ok(f, &bytes) {
        return Err("o SHA1 do modpack não bate certo".into());
    }
    let mut z = zip::ZipArchive::new(Cursor::new(bytes.clone())).map_err(e)?;
    let mut txt = String::new();
    {
        let mut ix = z.by_name("manifest.json").map_err(|_| "este ficheiro não é um modpack instalável".to_string())?;
        std::io::Read::read_to_string(&mut ix, &mut txt).map_err(e)?;
    }
    Ok((serde_json::from_str(&txt).map_err(e)?, bytes))
}

fn sha_ok(f: &Value, b: &[u8]) -> bool {
    f["hashes"].as_array().cloned().unwrap_or_default().iter().filter(|h| h["algo"].as_u64() == Some(1)).all(|h| format!("{:x}", Sha1::digest(b)) == h["value"].as_str().unwrap_or("").to_lowercase())
}

fn class_dir(class_id: u64) -> Option<&'static str> {
    match class_id {
        6 => Some("mods"),
        12 => Some("resourcepacks"),
        6552 => Some("shaderpacks"),
        _ => None,
    }
}

/// Descarrega os ficheiros do manifest (8 de cada vez) e copia os overrides. Devolve os que o autor só deixa descarregar no site ({name, url}).
pub async fn apply_pack(app: &AppHandle, key: &str, game: &Path, m: &Value, bytes: &[u8]) -> Result<Vec<Value>, String> {
    std::fs::create_dir_all(game).map_err(e)?;
    let wanted: Vec<(u64, u64)> = m["files"].as_array().cloned().unwrap_or_default().iter().filter(|x| x["required"].as_bool() != Some(false)).filter_map(|x| Some((x["projectID"].as_u64()?, x["fileID"].as_u64()?))).collect();
    let mut files: Vec<Value> = vec![];
    let mut mods: HashMap<u64, Value> = HashMap::new();
    for ch in wanted.chunks(500) {
        let r = post(key, "/mods/files", json!({"fileIds": ch.iter().map(|x| x.1).collect::<Vec<_>>()})).await?;
        files.extend(r["data"].as_array().cloned().unwrap_or_default());
        let r = post(key, "/mods", json!({"modIds": ch.iter().map(|x| x.0).collect::<Vec<_>>()})).await?;
        for x in r["data"].as_array().cloned().unwrap_or_default() {
            if let Some(id) = x["id"].as_u64() {
                mods.insert(id, x);
            }
        }
    }
    let mut blocked = vec![];
    let mut jobs = vec![];
    for f in files {
        let info = f["modId"].as_u64().and_then(|i| mods.get(&i)).cloned().unwrap_or(Value::Null);
        match f["downloadUrl"].as_str() {
            Some(u) if !u.is_empty() => jobs.push((u.replace('+', "%2B"), f.clone(), info["classId"].as_u64().unwrap_or(6))),
            _ => blocked.push(json!({"name": info["name"].as_str().or(f["fileName"].as_str()).unwrap_or("?"), "url": format!("{}/files/{}", info["links"]["websiteUrl"].as_str().unwrap_or("https://www.curseforge.com"), f["id"])})),
        }
    }
    let total = jobs.len();
    let c = reqwest::Client::builder().user_agent(UA).build().map_err(e)?;
    let mut st = Box::pin(
        stream::iter(jobs)
            .map(|(url, f, class_id)| {
                let c = c.clone();
                let game = game.to_path_buf();
                async move {
                    // mundos e outros tipos não entram automaticamente na instância
                    let Some(dir) = class_dir(class_id) else { return Ok::<(), String>(()) };
                    let name = safe(f["fileName"].as_str().unwrap_or(""))?;
                    let b = c.get(&url).send().await.map_err(e)?.error_for_status().map_err(e)?.bytes().await.map_err(e)?;
                    if !sha_ok(&f, &b) {
                        return Err(format!("{name}: SHA1 não bate certo"));
                    }
                    let d = game.join(dir);
                    std::fs::create_dir_all(&d).map_err(e)?;
                    std::fs::write(d.join(name), &b).map_err(e)
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
    let ov = m["overrides"].as_str().unwrap_or("overrides").to_string();
    extract_overrides(bytes, game, &[ov.as_str()])?;
    Ok(blocked)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loader_do_manifest() {
        let m = json!({"minecraft": {"version": "1.20.1", "modLoaders": [{"id": "forge-47.2.0", "primary": true}]}});
        assert_eq!(pack_loader(&m), ("forge", Some("47.2.0".to_string())));
        let m = json!({"minecraft": {"modLoaders": [{"id": "neoforge-21.1.172"}]}});
        assert_eq!(pack_loader(&m), ("neoforge", Some("21.1.172".to_string())));
        assert_eq!(pack_loader(&json!({})), ("vanilla", None));
    }
}
