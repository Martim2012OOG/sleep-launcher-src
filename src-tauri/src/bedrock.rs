//! Minecraft Bedrock em Mac e Linux, pelo mcpelauncher (o projeto livre que a comunidade usa): o Sleep Launcher descarrega a app
//! oficial dele DO GITHUB DELES, deixa-a na pasta de dados e abre-a. O jogo em si é descarregado pela própria app do mcpelauncher,
//! com a conta Google Play de quem o comprou. Nada do Minecraft passa por aqui.
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;

fn e<E: std::fmt::Display>(x: E) -> String {
    x.to_string()
}

fn dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(e)?.join("bedrock"))
}

#[cfg(target_os = "linux")]
fn appimage(d: &Path) -> PathBuf {
    d.join("Minecraft_Bedrock_Launcher.AppImage")
}

#[cfg(target_os = "macos")]
fn mac_app(d: &Path) -> Option<PathBuf> {
    std::fs::read_dir(d).ok()?.flatten().map(|x| x.path()).find(|p| p.extension().map(|x| x == "app").unwrap_or(false))
}

pub fn installed(app: &AppHandle) -> bool {
    let Ok(d) = dir(app) else { return false };
    #[cfg(target_os = "linux")]
    {
        appimage(&d).exists()
    }
    #[cfg(target_os = "macos")]
    {
        mac_app(&d).is_some()
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        let _ = d;
        false
    }
}

pub fn state(app: &AppHandle) -> Value {
    json!({ "os": std::env::consts::OS, "installed": installed(app) })
}

async fn download(app: &AppHandle, url: &str, dest: &Path) -> Result<(), String> {
    if let Some(p) = dest.parent() {
        tokio::fs::create_dir_all(p).await.map_err(e)?;
    }
    let cl = reqwest::Client::builder()
        .user_agent("sleep-launcher")
        .connect_timeout(std::time::Duration::from_secs(20))
        .timeout(std::time::Duration::from_secs(3600))
        .build()
        .map_err(e)?;
    let mut r = cl.get(url).send().await.map_err(e)?.error_for_status().map_err(e)?;
    let total = r.content_length().unwrap_or(0).max(1);
    let tmp = dest.with_extension("part");
    let mut f = tokio::fs::File::create(&tmp).await.map_err(e)?;
    let (mut got, mut last) = (0u64, 0u64);
    while let Some(c) = r.chunk().await.map_err(e)? {
        f.write_all(&c).await.map_err(e)?;
        got += c.len() as u64;
        let pct = got * 100 / total;
        if pct != last {
            last = pct;
            let _ = app.emit("progress", json!({"stage": "Bedrock", "done": pct, "total": 100}));
        }
    }
    f.flush().await.map_err(e)?;
    drop(f);
    tokio::fs::rename(&tmp, dest).await.map_err(e)
}

#[cfg(target_os = "linux")]
pub async fn install(app: &AppHandle) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let d = dir(app)?;
    let arch = if std::env::consts::ARCH == "aarch64" { "arm64" } else { "x86_64" };
    let cl = reqwest::Client::builder().user_agent("sleep-launcher").timeout(std::time::Duration::from_secs(30)).build().map_err(e)?;
    let rel: Value = cl.get("https://api.github.com/repos/minecraft-linux/appimage-builder/releases/latest").send().await.map_err(e)?.error_for_status().map_err(e)?.json().await.map_err(e)?;
    let prefix = format!("Minecraft_Bedrock_Launcher-{arch}-");
    let url = rel["assets"]
        .as_array()
        .and_then(|a| a.iter().find(|x| x["name"].as_str().map(|n| n.starts_with(&prefix) && n.ends_with(".AppImage")).unwrap_or(false)))
        .and_then(|x| x["browser_download_url"].as_str())
        .ok_or("não encontrei o mcpelauncher para este processador")?
        .to_string();
    let dest = appimage(&d);
    download(app, &url, &dest).await?;
    std::fs::set_permissions(&dest, std::fs::Permissions::from_mode(0o755)).map_err(e)
}

#[cfg(target_os = "macos")]
pub async fn install(app: &AppHandle) -> Result<(), String> {
    let d = dir(app)?;
    let dmg = d.join("Minecraft.Bedrock.Launcher.dmg");
    download(app, "https://github.com/minecraft-linux/macos-builder/releases/latest/download/Minecraft.Bedrock.Launcher.dmg", &dmg).await?;
    let mnt = d.join("mnt");
    let _ = std::fs::create_dir_all(&mnt);
    let ok = std::process::Command::new("hdiutil").args(["attach", "-nobrowse", "-noverify", "-readonly", "-mountpoint"]).arg(&mnt).arg(&dmg).status().map_err(e)?;
    if !ok.success() {
        return Err("não consegui abrir o ficheiro .dmg".into());
    }
    let res = (|| -> Result<(), String> {
        let src = std::fs::read_dir(&mnt).map_err(e)?.flatten().map(|x| x.path()).find(|p| p.extension().map(|x| x == "app").unwrap_or(false)).ok_or("a app não está no .dmg")?;
        let dst = d.join(src.file_name().ok_or("nome inválido")?);
        let _ = std::fs::remove_dir_all(&dst);
        let c = std::process::Command::new("ditto").arg(&src).arg(&dst).status().map_err(e)?;
        if !c.success() {
            return Err("não consegui copiar a app".into());
        }
        let _ = std::process::Command::new("xattr").args(["-dr", "com.apple.quarantine"]).arg(&dst).status();
        Ok(())
    })();
    let _ = std::process::Command::new("hdiutil").args(["detach", "-force"]).arg(&mnt).status();
    let _ = std::fs::remove_file(&dmg);
    let _ = std::fs::remove_dir(&mnt);
    res
}

#[cfg(not(any(target_os = "linux", target_os = "macos")))]
pub async fn install(_app: &AppHandle) -> Result<(), String> {
    Err("No Windows o Bedrock instala-se pela Microsoft Store.".into())
}

pub fn launch(app: &AppHandle) -> Result<(), String> {
    let d = dir(app)?;
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new(appimage(&d)).env("APPIMAGE_EXTRACT_AND_RUN", "1").spawn().map(|_| ()).map_err(e)
    }
    #[cfg(target_os = "macos")]
    {
        let a = mac_app(&d).ok_or("o Bedrock ainda não está instalado")?;
        std::process::Command::new("open").arg(a).spawn().map(|_| ()).map_err(e)
    }
    #[cfg(windows)]
    {
        let _ = d;
        use std::os::windows::process::CommandExt;
        std::process::Command::new("cmd").args(["/C", "start", "", "minecraft:"]).creation_flags(0x08000000).spawn().map(|_| ()).map_err(e)
    }
}
