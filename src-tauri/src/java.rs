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

/// O Java só conta se estiver inteiro: ao lado de bin/ tem de existir lib/jvm.cfg (ou lib/modules).
fn complete(exe: &Path) -> bool {
    exe.parent().and_then(|b| b.parent()).map(|r| r.join("lib").join("jvm.cfg").exists() || r.join("lib").join("modules").exists()).unwrap_or(false)
}

async fn download(app: &AppHandle, url: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder().connect_timeout(std::time::Duration::from_secs(25)).timeout(std::time::Duration::from_secs(900)).user_agent("SleepLauncher/1.0").build().map_err(|x| x.to_string())?;
    let mut r = client.get(url).send().await.map_err(|x| x.to_string())?;
    if !r.status().is_success() {
        return Err(format!("HTTP {}", r.status()));
    }
    let total = r.content_length().unwrap_or(0).max(1);
    let mut out = Vec::with_capacity(total as usize);
    let mut last = 0u64;
    while let Some(c) = tokio::time::timeout(std::time::Duration::from_secs(40), r.chunk()).await.map_err(|_| "a ligação parou".to_string())?.map_err(|x| x.to_string())? {
        out.extend_from_slice(&c);
        let d = out.len() as u64;
        if d - last > 500_000 {
            last = d;
            let _ = app.emit("progress", json!({"stage": "Java", "done": d, "total": total.max(d)}));
        }
    }
    Ok(out)
}

/// Devolve o caminho do java da versão `major`, descarregando-o (Adoptium Temurin) se ainda não existir ou se estiver partido.
pub async fn ensure(app: &AppHandle, root: &Path, major: u64) -> Result<String, String> {
    let dir = root.join("java").join(major.to_string());
    let exe = if cfg!(windows) { "java.exe" } else { "java" };
    if let Some(p) = find(&dir, exe) {
        if complete(&p) {
            return Ok(p.display().to_string());
        }
        // instalação antiga que ficou a meio: apaga e refaz
        let _ = std::fs::remove_dir_all(&dir);
    }
    let os = if cfg!(windows) { "windows" } else if cfg!(target_os = "macos") { "mac" } else { "linux" };
    let arch = if cfg!(target_arch = "aarch64") { "aarch64" } else { "x64" };
    let mut bytes = None;
    let mut last_err = String::new();
    'o: for img in ["jre", "jdk"] {
        let url = format!("https://api.adoptium.net/v3/binary/latest/{major}/ga/{os}/{arch}/{img}/hotspot/normal/eclipse");
        for _ in 0..3 {
            match download(app, &url).await {
                Ok(b) if b.len() > 1_000_000 => {
                    bytes = Some(b);
                    break 'o;
                }
                Ok(_) => last_err = "ficheiro vazio".into(),
                Err(x) => last_err = x,
            }
        }
    }
    let b = bytes.ok_or(format!("Não consegui descarregar o Java {major} ({last_err}). Verifica a internet e tenta outra vez."))?;
    // extrai para uma pasta temporária e só depois a ativa
    let tmp = root.join("java").join(format!("{major}.tmp"));
    let _ = std::fs::remove_dir_all(&tmp);
    let t2 = tmp.clone();
    tokio::task::spawn_blocking(move || unpack(&b, &t2)).await.map_err(|x| x.to_string())??;
    match find(&tmp, exe) {
        Some(p) if complete(&p) => {}
        _ => {
            let _ = std::fs::remove_dir_all(&tmp);
            return Err("O Java descarregado veio incompleto (talvez o antivírus o tenha bloqueado). Tenta outra vez.".to_string());
        }
    }
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::rename(&tmp, &dir).map_err(|x| x.to_string())?;
    let _ = app.emit("progress", json!({"stage": "Java", "done": 1, "total": 1}));
    find(&dir, exe).map(|p| p.display().to_string()).ok_or_else(|| "Java descarregado mas sem bin/java".to_string())
}
