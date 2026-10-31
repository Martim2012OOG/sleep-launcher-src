use serde_json::json;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

fn find(dir: &Path, exe: &str) -> Option<PathBuf> {
    for en in std::fs::read_dir(dir).ok()?.flatten() {
        let p = en.path();
        if p.is_dir() {
            if let Some(f) = find(&p, exe) {
                return Some(f);
            }
        } else if p.file_name().map_or(false, |n| n == exe) && p.parent().and_then(|x| x.file_name()).map_or(false, |n| n == "bin") {
            return Some(p);
        }
    }
    None
}

fn unpack(b: &[u8], dir: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|x| x.to_string())?;
    if cfg!(windows) {
        let mut z = zip::ZipArchive::new(std::io::Cursor::new(b)).map_err(|x| x.to_string())?;
        z.extract(dir).map_err(|x| x.to_string())
    } else {
        tar::Archive::new(flate2::read::GzDecoder::new(b)).unpack(dir).map_err(|x| x.to_string())
    }
}

/// Devolve o caminho do java da versão `major`, descarregando-o (Adoptium Temurin) se ainda não existir.
pub async fn ensure(app: &AppHandle, root: &Path, major: u64) -> Result<String, String> {
    let dir = root.join("java").join(major.to_string());
    let exe = if cfg!(windows) { "java.exe" } else { "java" };
    if let Some(p) = find(&dir, exe) {
        return Ok(p.display().to_string());
    }
    let _ = app.emit("progress", json!({"stage": "Java", "done": 0, "total": 1}));
    let os = if cfg!(windows) { "windows" } else if cfg!(target_os = "macos") { "mac" } else { "linux" };
    let arch = if cfg!(target_arch = "aarch64") { "aarch64" } else { "x64" };
    let mut bytes = None;
    for img in ["jre", "jdk"] {
        let url = format!("https://api.adoptium.net/v3/binary/latest/{major}/ga/{os}/{arch}/{img}/hotspot/normal/eclipse");
        if let Ok(r) = reqwest::get(&url).await {
            if r.status().is_success() {
                if let Ok(b) = r.bytes().await {
                    bytes = Some(b);
                    break;
                }
            }
        }
    }
    let b = bytes.ok_or(format!("Não consegui descarregar o Java {major}"))?;
    let d2 = dir.clone();
    tokio::task::spawn_blocking(move || unpack(&b, &d2)).await.map_err(|x| x.to_string())??;
    let _ = app.emit("progress", json!({"stage": "Java", "done": 1, "total": 1}));
    find(&dir, exe).map(|p| p.display().to_string()).ok_or_else(|| "Java descarregado mas sem bin/java".to_string())
}
