//! Horizon (https://github.com/horizon-rust/horizon): o Minecraft Java 26.3 reescrito em Rust. O launcher do Sleep descarrega o launcher
//! oficial do Horizon (da página de releases do projeto, com a soma SHA-256 conferida) e abre-o. O Horizon prepara o jogo a partir da tua cópia.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

fn err<E: std::fmt::Display>(x: E) -> String {
    x.to_string()
}

fn dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(err)?.join("horizon"))
}

fn os_key() -> &'static str {
    if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") { "macos-arm64.zip" } else { "macos-x64.zip" }
    } else if cfg!(target_os = "windows") {
        "windows-x64.zip"
    } else {
        "linux-x86_64.tar.gz"
    }
}

/// O programa do launcher do Horizon dentro da pasta (".app" no Mac, ".exe" no Windows, o binário no Linux).
fn find_exe(d: &Path) -> Option<PathBuf> {
    let rd = std::fs::read_dir(d).ok()?;
    for e in rd.flatten() {
        let p = e.path();
        let n = p.file_name()?.to_string_lossy().to_lowercase();
        if cfg!(target_os = "macos") && n.ends_with(".app") {
            return Some(p);
        }
        if cfg!(target_os = "windows") && n.ends_with(".exe") && n.contains("horizon") {
            return Some(p);
        }
        if !cfg!(target_os = "macos") && !cfg!(target_os = "windows") && n.contains("horizon") && p.is_file() {
            return Some(p);
        }
        if p.is_dir() {
            if let Some(x) = find_exe(&p) {
                return Some(x);
            }
        }
    }
    None
}

#[tauri::command]
pub fn horizon_state(app: AppHandle) -> Value {
    let d = match dir(&app) {
        Ok(d) => d,
        Err(_) => return json!({"installed": false}),
    };
    let ver = std::fs::read_to_string(d.join("version.txt")).unwrap_or_default();
    match find_exe(&d) {
        Some(p) => json!({"installed": true, "path": p.to_string_lossy(), "version": ver.trim()}),
        None => json!({"installed": false, "os": os_key()}),
    }
}

async fn get_bytes(url: &str, app: &AppHandle, label: &str) -> Result<Vec<u8>, String> {
    let ok = url.starts_with("https://github.com/horizon-rust/horizon/") || url.starts_with("https://objects.githubusercontent.com/") || url.starts_with("https://release-assets.githubusercontent.com/");
    if !ok {
        return Err("endereço não permitido".into());
    }
    let client = reqwest::Client::builder().user_agent("SleepLauncher/1.0").build().map_err(err)?;
    let mut r = client.get(url).send().await.map_err(err)?.error_for_status().map_err(err)?;
    let total = r.content_length().unwrap_or(0).max(1);
    let mut out = Vec::with_capacity(total as usize);
    let mut last = 0u64;
    while let Some(c) = r.chunk().await.map_err(err)? {
        out.extend_from_slice(&c);
        let done = out.len() as u64;
        if done - last > 400_000 {
            last = done;
            let _ = app.emit("progress", json!({"stage": label, "done": done, "total": total}));
        }
    }
    let _ = app.emit("progress", json!({"stage": label, "done": total, "total": total}));
    Ok(out)
}

#[tauri::command]
pub async fn horizon_install(app: AppHandle) -> Result<Value, String> {
    let client = reqwest::Client::builder().user_agent("SleepLauncher/1.0").build().map_err(err)?;
    let rels: Value = client
        .get("https://api.github.com/repos/horizon-rust/horizon/releases?per_page=30")
        .send()
        .await
        .map_err(err)?
        .error_for_status()
        .map_err(err)?
        .json()
        .await
        .map_err(err)?;
    let key = os_key();
    let (mut asset, mut sums, mut tag) = (None, None, String::new());
    for r in rels.as_array().cloned().unwrap_or_default() {
        let t = r["tag_name"].as_str().unwrap_or("");
        if !t.starts_with("launcher@") || r["draft"].as_bool() == Some(true) || r["prerelease"].as_bool() == Some(true) {
            continue;
        }
        for a in r["assets"].as_array().cloned().unwrap_or_default() {
            let n = a["name"].as_str().unwrap_or("");
            if n.ends_with(key) && n.contains("launcher") {
                asset = Some((n.to_string(), a["browser_download_url"].as_str().unwrap_or("").to_string()));
            }
            if n == "SHA256SUMS" {
                sums = a["browser_download_url"].as_str().map(String::from);
            }
        }
        if asset.is_some() {
            tag = t.to_string();
            break;
        }
    }
    let (name, url) = asset.ok_or("O Horizon ainda não tem launcher para este sistema")?;
    let data = get_bytes(&url, &app, "Horizon").await?;
    // confere a soma SHA-256 publicada pelo projeto
    if let Some(su) = sums {
        let txt = String::from_utf8_lossy(&get_bytes(&su, &app, "Horizon (verificação)").await?).to_string();
        let want = txt.lines().find(|l| l.contains(&name)).and_then(|l| l.split_whitespace().next()).map(String::from);
        let got: String = Sha256::digest(&data).iter().map(|b| format!("{b:02x}")).collect();
        if let Some(w) = want {
            if !w.eq_ignore_ascii_case(&got) {
                return Err("A verificação do ficheiro falhou (SHA-256 diferente): não instalei".into());
            }
        }
    }
    let d = dir(&app)?;
    let tmp = d.with_extension("new");
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).map_err(err)?;
    let t2 = tmp.clone();
    tokio::task::spawn_blocking(move || -> Result<(), String> {
        if name.ends_with(".zip") {
            zip::ZipArchive::new(std::io::Cursor::new(data)).map_err(err)?.extract(&t2).map_err(err)
        } else {
            let gz = flate2::read::GzDecoder::new(std::io::Cursor::new(data));
            tar::Archive::new(gz).unpack(&t2).map_err(err)
        }
    })
    .await
    .map_err(err)??;
    let _ = std::fs::remove_dir_all(&d);
    std::fs::rename(&tmp, &d).map_err(err)?;
    std::fs::write(d.join("version.txt"), &tag).map_err(err)?;
    #[cfg(unix)]
    if let Some(p) = find_exe(&d) {
        use std::os::unix::fs::PermissionsExt;
        let bin = if p.is_dir() { p.join("Contents/MacOS") } else { p.clone() };
        let files: Vec<PathBuf> = if bin.is_dir() { std::fs::read_dir(&bin).map(|r| r.flatten().map(|e| e.path()).collect()).unwrap_or_default() } else { vec![bin] };
        for f in files {
            let _ = std::fs::set_permissions(&f, std::fs::Permissions::from_mode(0o755));
        }
    }
    Ok(horizon_state(app))
}

/// O executável que aceita os comandos (`horizon-launcher install`, `account sign-in`, `prepare`, `play`…): no Mac fica dentro do .app.
fn cli_bin(d: &Path) -> Option<PathBuf> {
    let p = find_exe(d)?;
    if cfg!(target_os = "macos") && p.is_dir() {
        let m = p.join("Contents/MacOS");
        let mut best = None;
        for e in std::fs::read_dir(&m).ok()?.flatten() {
            let n = e.file_name().to_string_lossy().to_lowercase();
            if n.contains("launcher") || best.is_none() {
                best = Some(e.path());
            }
        }
        return best;
    }
    Some(p)
}

/// Corre um comando do Horizon e manda cada linha de saída ao ecrã (evento `hz-log`). O login (código do dispositivo) aparece aí.
#[tauri::command]
pub async fn horizon_cmd(app: AppHandle, args: Vec<String>) -> Result<String, String> {
    use std::io::{BufRead, BufReader};
    use std::process::{Command, Stdio};
    let allowed = ["versions", "install", "prepare", "play", "account", "settings"];
    if args.first().map(|a| !allowed.contains(&a.as_str())).unwrap_or(true) || args.iter().any(|a| a.contains('\n')) {
        return Err("comando não permitido".into());
    }
    let d = dir(&app)?;
    let bin = cli_bin(&d).ok_or("O Horizon ainda não está instalado")?;
    let a2 = app.clone();
    tokio::task::spawn_blocking(move || -> Result<String, String> {
        let mut c = Command::new(&bin);
        c.args(&args).current_dir(bin.parent().unwrap_or(Path::new("."))).stdout(Stdio::piped()).stderr(Stdio::piped()).stdin(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            c.creation_flags(0x08000000);
        }
        let mut child = c.spawn().map_err(err)?;
        let out = child.stdout.take().ok_or("sem saída")?;
        let er = child.stderr.take().ok_or("sem saída")?;
        let a3 = a2.clone();
        let t = std::thread::spawn(move || {
            for l in BufReader::new(er).lines().map_while(Result::ok) {
                let _ = a3.emit("hz-log", l);
            }
        });
        let mut all = String::new();
        for l in BufReader::new(out).lines().map_while(Result::ok) {
            let _ = a2.emit("hz-log", l.clone());
            all.push_str(&l);
            all.push('\n');
        }
        let _ = t.join();
        let st = child.wait().map_err(err)?;
        if st.success() { Ok(all) } else { Err(format!("O Horizon terminou com erro ({st})")) }
    })
    .await
    .map_err(err)?
}
