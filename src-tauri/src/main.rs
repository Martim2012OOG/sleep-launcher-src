#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod bedrock;
mod console;
mod curseforge;
mod fabric;
mod horizon;
mod import;
mod inst;
mod java;
mod launch;
mod loaders;
mod mods;
mod modrinth;
mod mojang;
mod perf;
mod social;

use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;

fn err<E: std::fmt::Display>(x: E) -> String {
    x.to_string()
}

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(err)
}

fn clean(n: &str) -> String {
    n.chars().filter(|c| c.is_alphanumeric() || " -_.".contains(*c)).collect::<String>().trim().to_string()
}

fn idir(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let c = clean(name);
    if c.is_empty() || c.chars().all(|x| x == '.') {
        return Err("nome inválido".into());
    }
    Ok(root(app)?.join("instances").join(c))
}

fn read_inst(dir: &Path) -> Result<Value, String> {
    serde_json::from_slice(&std::fs::read(dir.join("instance.json")).map_err(err)?).map_err(err)
}

fn write_inst(dir: &Path, v: &Value) -> Result<(), String> {
    std::fs::write(dir.join("instance.json"), serde_json::to_vec_pretty(v).map_err(err)?).map_err(err)
}

/// Repositório do GitHub onde saem as versões (definido ao compilar com KUBO_REPO="dono/repo").
pub const REPO: &str = match option_env!("KUBO_REPO") {
    Some(r) => r,
    None => "Martim2012OOG/sleep-launcher",
};

/// Manifesto das mods do Sleep: o mods.json da release fixa "mods" (atualizado pelo CI do client, sem lançar o launcher).
fn default_manifest() -> String {
    format!("https://github.com/{REPO}/releases/download/mods/mods.json")
}

fn settings(app: &AppHandle) -> Value {
    root(app)
        .ok()
        .and_then(|r| std::fs::read(r.join("settings.json")).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_else(|| json!({"manifest_url": ""}))
}

static SETTINGS_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

/// Guarda uma chave em settings.json sem apagar as outras. Escreve para um ficheiro temporário e troca: se a app fechar a meio, o ficheiro antigo fica inteiro.
fn patch(app: &AppHandle, k: &str, v: Value) -> Result<(), String> {
    let _g = SETTINGS_LOCK.lock().unwrap_or_else(|x| x.into_inner());
    let mut s = settings(app);
    s[k] = v;
    let r = root(app)?;
    std::fs::create_dir_all(&r).map_err(err)?;
    let tmp = r.join(format!("settings.json.{}.tmp", std::process::id()));
    std::fs::write(&tmp, s.to_string()).map_err(err)?;
    std::fs::rename(&tmp, r.join("settings.json")).map_err(err)
}

#[tauri::command]
fn set_theme(app: AppHandle, theme: String) -> Result<(), String> {
    patch(&app, "theme", json!(theme))
}

#[tauri::command]
fn get_autostart(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let a = app.autolaunch();
    let r = if enabled { a.enable() } else { a.disable() };
    r.map_err(err)?;
    Ok(a.is_enabled().unwrap_or(enabled))
}

/// Preferências que a interface pode ler e mudar. Chaves e outros valores internos nunca passam por aqui.
const PREFS: [&str; 9] = ["lang", "close_to_tray", "hide_on_play", "fps_mode", "intro", "reduce_motion", "ui_scale", "default_ram", "perf_new"];

#[tauri::command]
fn get_settings(app: AppHandle) -> Value {
    let s = settings(&app);
    let cur = app.package_info().version.to_string();
    let mut o = json!({"has_cf_key": !cfkey(&app).is_empty(), "theme": s["theme"], "last": s["last"], "version": cur, "total_ram": perf::total_ram_mb()});
    for k in PREFS {
        if !s[k].is_null() {
            o[k] = s[k].clone();
        }
    }
    // uma atualização que dizia ter instalado mas a app continua na versão antiga
    if let Some(to) = s["update_pending"]["to"].as_str() {
        if to != cur && s["update_pending"]["from"].as_str() == Some(cur.as_str()) {
            o["update_failed"] = json!(to);
        } else {
            let _ = patch(&app, "update_pending", Value::Null);
        }
    }
    o
}

#[tauri::command]
fn save_pref(app: AppHandle, key: String, value: Value) -> Result<(), String> {
    let ok = match key.as_str() {
        "lang" => value.as_str().is_some_and(|l| ["en", "pt", "es"].contains(&l)),
        "close_to_tray" | "hide_on_play" | "fps_mode" | "intro" | "reduce_motion" | "perf_new" => value.is_boolean(),
        "ui_scale" => value.as_f64().is_some_and(|f| (0.8..=1.5).contains(&f)),
        "default_ram" => value.as_u64().is_some_and(|m| m == 0 || (1024..=65536).contains(&m)),
        _ => false,
    };
    if !ok {
        return Err("definição inválida".into());
    }
    patch(&app, &key, value)
}

include!(concat!(env!("OUT_DIR"), "/cf_key.rs"));

/// Chave da CurseForge: a que vem no próprio launcher; sem essa (compilações locais), a que já estivesse guardada neste computador.
fn cfkey(app: &AppHandle) -> String {
    let built: String = CF_A.iter().zip(CF_B.iter()).map(|(a, b)| (a ^ b) as char).collect();
    if !built.is_empty() {
        return built;
    }
    settings(app)["cf_key"].as_str().unwrap_or("").trim().to_string()
}

#[tauri::command]
async fn cf_categories(app: AppHandle, kind: String) -> Result<Vec<Value>, String> {
    curseforge::categories(&cfkey(&app), &kind).await
}

#[tauri::command]
async fn cf_search(app: AppHandle, kind: String, query: String, mc: String, loader: String, category: String, offset: u32) -> Result<Value, String> {
    curseforge::search(&cfkey(&app), &kind, &query, &mc, &loader, &category, offset).await
}

#[tauri::command]
async fn cf_install(app: AppHandle, name: String, kind: String, project: String) -> Result<Vec<String>, String> {
    let dir = idir(&app, &name)?;
    let inst = read_inst(&dir)?;
    let mc = inst["version"].as_str().unwrap_or("").to_string();
    let loader = inst["loader"].as_str().unwrap_or("vanilla").to_string();
    curseforge::install(&cfkey(&app), &dir.join("game"), &kind, &project, &mc, &loader).await
}

// Client ID público da app no Azure: só serve para renovar sessões antigas (o login novo usa o client da Microsoft em auth.rs).
const DEFAULT_CID: &str = "b28c431e-5e0b-4f84-af8b-d5b4e15453e3";

fn cid(app: &AppHandle) -> String {
    settings(app)["client_id"].as_str().filter(|s| !s.trim().is_empty()).unwrap_or(DEFAULT_CID).to_string()
}

#[tauri::command]
async fn ms_login(app: AppHandle) -> Result<Value, String> {
    // só a janela normal da Microsoft (sem códigos); funciona igual no Windows, Mac e Linux
    auth::login_web(&app).await.map(|a| auth::public(&a))
}

/// Fecha a janela de login se a pessoa carregar em Cancelar no launcher.
#[tauri::command]
fn ms_login_cancel(app: AppHandle) {
    for (l, w) in app.webview_windows() {
        if l.starts_with("login") {
            let _ = w.destroy();
        }
    }
}

/// Só deixa pedir o JSON das novidades do Minecraft (a interface não pode pedir outros endereços).
#[tauri::command]
async fn http_get(url: String) -> Result<String, String> {
    if !(url.starts_with("https://launchercontent.mojang.com/") || url.starts_with("https://api.mcstatus.io/v2/status/java/") || url == "https://api.modrinth.com/v2/tag/loader") {
        return Err("endereço não permitido".to_string());
    }
    let r = reqwest::get(&url).await.map_err(|x| x.to_string())?;
    r.text().await.map_err(|x| x.to_string())
}

/// Imagem PNG/JPG de uma loja (capas, itens) em base64, para o 3D: só https, sem endereços locais, até 1,5 MB.
#[tauri::command]
async fn img_b64(url: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let host = url.strip_prefix("https://").and_then(|r| r.split('/').next()).unwrap_or("").to_lowercase();
    let bad = host.is_empty() || host.contains('@') || host.starts_with("localhost") || host.ends_with(".local") || host.split(':').next().map(|h| h.chars().all(|c| c.is_ascii_digit() || c == '.')).unwrap_or(true);
    if bad {
        return Err("endereço não permitido".to_string());
    }
    let r = reqwest::get(&url).await.map_err(|x| x.to_string())?.error_for_status().map_err(|x| x.to_string())?;
    let b = r.bytes().await.map_err(|x| x.to_string())?;
    if b.len() > 1_500_000 {
        return Err("imagem demasiado grande".to_string());
    }
    Ok(STANDARD.encode(b))
}

/// Skin em PNG (base64) para o personagem 3D: o webview não deixa carregar skins de outros sites, por isso passa por aqui.
#[tauri::command]
async fn skin_b64(url: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let ok = url.starts_with("https://minotar.net/skin/") || url.starts_with("http://textures.minecraft.net/texture/") || url.starts_with("https://textures.minecraft.net/texture/");
    if !ok {
        return Err("endereço não permitido".to_string());
    }
    let r = reqwest::get(&url).await.map_err(|x| x.to_string())?.error_for_status().map_err(|x| x.to_string())?;
    let b = r.bytes().await.map_err(|x| x.to_string())?;
    if b.len() > 200_000 {
        return Err("skin demasiado grande".to_string());
    }
    Ok(STANDARD.encode(b))
}

/// Liga ou desliga a Ligação privada do mod em todas as instâncias (o mod lê isto quando o jogo abre e liga-se sozinho ao país escolhido).
#[tauri::command]
fn set_vpn(app: AppHandle, enabled: bool, country: String) -> Result<u32, String> {
    let c: String = country.chars().filter(|c| c.is_ascii_alphabetic() || *c == '*').take(3).collect();
    let mut n = 0;
    if let Ok(rd) = std::fs::read_dir(root(&app)?.join("instances")) {
        for en in rd.flatten() {
            let cfg = en.path().join("game").join("config");
            if std::fs::create_dir_all(&cfg).is_err() {
                continue;
            }
            let f = cfg.join("kubo-private-connection.json");
            let mut v: Value = std::fs::read(&f).ok().and_then(|b| serde_json::from_slice(&b).ok()).filter(|v: &Value| v.is_object()).unwrap_or_else(|| json!({}));
            if enabled {
                v["autoCountry"] = json!(if c.is_empty() { "*".to_string() } else { c.to_uppercase() });
            } else {
                v.as_object_mut().map(|o| o.remove("autoCountry"));
                v["enabled"] = json!(false);
            }
            if std::fs::write(&f, v.to_string()).is_ok() {
                n += 1;
            }
        }
    }
    Ok(n)
}

/// A imagem de fundo do menu inicial desta versão do Minecraft (a primeira face do panorama, tirada do client.jar), em data URL.
#[tauri::command]
async fn version_panorama(app: AppHandle, version: String, url: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let id = clean(&version);
    if id.is_empty() {
        return Err("versão inválida".into());
    }
    let cache = root(&app)?.join("panoramas").join(format!("{id}.png"));
    if let Ok(b) = std::fs::read(&cache) {
        return Ok(format!("data:image/png;base64,{}", STANDARD.encode(b)));
    }
    let shared = root(&app)?.join("shared");
    let vj = mojang::vanilla_json(&shared, &version, &url).await?;
    let jid = mojang::jar_id(&vj, &version);
    let jar = shared.join("versions").join(&jid).join(format!("{jid}.jar"));
    if !jar.exists() {
        let cu = vj["downloads"]["client"]["url"].as_str().ok_or("sem client.jar")?.to_string();
        mojang::get_file(&cu, &jar).await?;
    }
    let bytes = tokio::task::spawn_blocking(move || -> Result<Vec<u8>, String> {
        use std::io::Read;
        let mut z = zip::ZipArchive::new(std::fs::File::open(&jar).map_err(err)?).map_err(err)?;
        let name = (0..z.len())
            .filter_map(|i| z.by_index(i).ok().map(|f| f.name().to_string()))
            .find(|n| n.ends_with("title/background/panorama_0.png"))
            .ok_or("esta versão não tem panorama")?;
        let mut f = z.by_name(&name).map_err(err)?;
        let mut v = vec![];
        f.read_to_end(&mut v).map_err(err)?;
        Ok(v)
    })
    .await
    .map_err(err)??;
    if let Some(d) = cache.parent() {
        let _ = std::fs::create_dir_all(d);
    }
    let _ = std::fs::write(&cache, &bytes);
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
}

// ---------- ícone da app personalizável (como o Discord) ----------

#[cfg(target_os = "macos")]
mod dock {
    use objc::{class, msg_send, runtime::Object, sel, sel_impl};
    #[link(name = "AppKit", kind = "framework")]
    extern "C" {}
    /// Troca o ícone do Dock (tem de correr na thread principal).
    pub fn set(bytes: &[u8]) {
        unsafe {
            let data: *mut Object = msg_send![class!(NSData), dataWithBytes: bytes.as_ptr() as *const std::ffi::c_void length: bytes.len()];
            let img: *mut Object = msg_send![class!(NSImage), alloc];
            let img: *mut Object = msg_send![img, initWithData: data];
            if img.is_null() {
                return;
            }
            let app: *mut Object = msg_send![class!(NSApplication), sharedApplication];
            let _: () = msg_send![app, setApplicationIconImage: img];
        }
    }
}

/// Muda o ícone da app (Dock no Mac, janela e barra de tarefas no Windows/Linux). `b64` é um PNG.
#[tauri::command]
fn set_app_icon(app: AppHandle, b64: String) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let bytes = STANDARD.decode(b64.trim()).map_err(|x| x.to_string())?;
    if bytes.len() > 6_000_000 || bytes.len() < 100 {
        return Err("imagem inválida".into());
    }
    #[cfg(target_os = "macos")]
    {
        let b = bytes.clone();
        let _ = app.run_on_main_thread(move || dock::set(&b));
    }
    if let Some(w) = app.get_webview_window("main") {
        if let Ok(img) = tauri::image::Image::from_bytes(&bytes) {
            let _ = w.set_icon(img);
        }
    }
    Ok(())
}

// ---------- atualização do próprio launcher (GitHub Releases, assinada) ----------

fn updater(app: &AppHandle) -> Result<tauri_plugin_updater::Updater, String> {
    use tauri_plugin_updater::UpdaterExt;
    let url = format!("https://github.com/{REPO}/releases/latest/download/latest.json").parse::<tauri::Url>().map_err(|e| e.to_string())?;
    app.updater_builder().endpoints(vec![url]).map_err(|e| e.to_string())?.build().map_err(|e| e.to_string())
}

/// Há uma versão nova do launcher? (null se não houver ou se não der para ver)
#[tauri::command]
async fn app_check_update(app: AppHandle) -> Value {
    match updater(&app) {
        Ok(u) => match u.check().await {
            Ok(Some(up)) => json!({"version": up.version, "notes": up.body.unwrap_or_default()}),
            _ => Value::Null,
        },
        Err(_) => Value::Null,
    }
}

/// Fecha o launcher (usado quando a pessoa recusa uma atualização obrigatória).
#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// macOS: a pasta .app em que estamos a correr.
#[cfg(target_os = "macos")]
fn app_bundle() -> Option<PathBuf> {
    std::env::current_exe().ok()?.ancestors().find(|p| p.extension().is_some_and(|x| x == "app")).map(PathBuf::from)
}

/// macOS: a correr dentro do .dmg ou numa cópia temporária de leitura (o macOS faz isto às apps que não foram para Aplicações): não dá para atualizar aí.
#[tauri::command]
fn app_update_blocked() -> bool {
    #[cfg(target_os = "macos")]
    if let Some(b) = app_bundle() {
        let p = b.to_string_lossy();
        return p.contains("/AppTranslocation/") || p.starts_with("/Volumes/");
    }
    false
}

/// Descarrega, verifica a assinatura, instala e reinicia o launcher.
#[tauri::command]
async fn app_install_update(app: AppHandle) -> Result<(), String> {
    if app_update_blocked() {
        return Err("UPD_MOVE".into());
    }
    let up = updater(&app)?.check().await.map_err(|e| e.to_string())?.ok_or("Já tens a versão mais recente")?;
    // fica registado antes de instalar (no Windows o instalador fecha a app): ao reabrir sabemos se a versão mudou mesmo
    patch(&app, "update_pending", json!({"from": app.package_info().version.to_string(), "to": up.version}))?;
    let a2 = app.clone();
    let mut got = 0u64;
    if let Err(x) = up
        .download_and_install(
            move |chunk, total| {
                got += chunk as u64;
                let _ = a2.emit("progress", json!({"stage": "Launcher", "done": got, "total": total.unwrap_or(got.max(1))}));
            },
            || {},
        )
        .await
    {
        let _ = patch(&app, "update_pending", Value::Null);
        return Err(x.to_string());
    }
    // macOS: reabre pelo sistema depois de este processo sair, sem herdar o --hidden do arranque automático
    #[cfg(target_os = "macos")]
    if let Some(b) = app_bundle() {
        let spawned = std::process::Command::new("/bin/sh").arg("-c").arg("sleep 1; /usr/bin/open \"$0\"").arg(&b).spawn();
        if spawned.is_ok() {
            app.exit(0);
            return Ok(());
        }
    }
    app.restart()
}

// ---------- pasta de dados ----------

fn dir_size(p: &Path) -> u64 {
    std::fs::read_dir(p).map(|r| r.flatten().map(|e| if e.path().is_dir() { dir_size(&e.path()) } else { e.metadata().map(|m| m.len()).unwrap_or(0) }).sum()).unwrap_or(0)
}

#[tauri::command]
fn open_data_dir(app: AppHandle) -> Result<(), String> {
    let r = root(&app)?;
    std::fs::create_dir_all(&r).map_err(err)?;
    open_path(&r.to_string_lossy())
}

/// Tamanho da cache que dá para apagar sem perder nada (fundos das instâncias e ficheiros temporários).
#[tauri::command]
fn cache_size(app: AppHandle) -> Result<u64, String> {
    let r = root(&app)?;
    Ok(dir_size(&r.join("panoramas")) + dir_size(&r.join("tmp")))
}

#[tauri::command]
fn clear_cache(app: AppHandle) -> Result<(), String> {
    let r = root(&app)?;
    for d in ["panoramas", "tmp"] {
        let _ = std::fs::remove_dir_all(r.join(d));
    }
    Ok(())
}

// ---------- galeria: capturas de ecrã e gravações/clips do jogo ----------

fn media_dirs(app: &AppHandle) -> Vec<(String, std::path::PathBuf, &'static str)> {
    let mut v = Vec::new();
    if let Ok(rd) = root(app).map(|r| r.join("instances")).and_then(|d| std::fs::read_dir(d).map_err(|e| e.to_string())) {
        for en in rd.flatten() {
            let n = en.file_name().to_string_lossy().to_string();
            let g = en.path().join("game");
            v.push((n.clone(), g.join("screenshots"), "image"));
            v.push((n, g.join("kubo-recordings"), "video"));
        }
    }
    v
}

/// Todas as capturas (PNG/JPG) e vídeos (MP4/WEBM) das instâncias, as mais novas primeiro.
#[tauri::command]
fn media_list(app: AppHandle) -> Vec<Value> {
    let mut out: Vec<(u64, Value)> = Vec::new();
    for (inst, d, kind) in media_dirs(&app) {
        let Ok(rd) = std::fs::read_dir(&d) else { continue };
        for en in rd.flatten() {
            let p = en.path();
            let ext = p.extension().map(|x| x.to_string_lossy().to_lowercase()).unwrap_or_default();
            let ok = if kind == "image" { matches!(ext.as_str(), "png" | "jpg" | "jpeg") } else { matches!(ext.as_str(), "mp4" | "webm" | "mov") };
            if !ok {
                continue;
            }
            let md = en.metadata().ok();
            let t = md.as_ref().and_then(|m| m.modified().ok()).and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
            let size = md.map(|m| m.len()).unwrap_or(0);
            out.push((t, json!({"path": p.to_string_lossy(), "name": en.file_name().to_string_lossy(), "kind": kind, "instance": inst, "time": t, "size": size})));
        }
    }
    out.sort_by(|a, b| b.0.cmp(&a.0));
    out.into_iter().map(|x| x.1).collect()
}

/// Apaga um ficheiro da galeria. Só aceita ficheiros que a própria listagem devolve (nada fora das pastas de capturas/gravações).
#[tauri::command]
fn media_delete(app: AppHandle, path: String) -> Result<(), String> {
    let p = std::fs::canonicalize(&path).map_err(|e| e.to_string())?;
    for (_, d, _) in media_dirs(&app) {
        if let Ok(d) = std::fs::canonicalize(&d) {
            if p.parent() == Some(d.as_path()) && p.is_file() {
                return std::fs::remove_file(&p).map_err(|e| e.to_string());
            }
        }
    }
    Err("ficheiro não permitido".into())
}

/// Mostra o ficheiro na pasta (Finder, Explorador ou gestor de ficheiros).
#[tauri::command]
fn media_reveal(app: AppHandle, path: String) -> Result<(), String> {
    let p = std::fs::canonicalize(&path).map_err(|e| e.to_string())?;
    if !media_dirs(&app).iter().any(|(_, d, _)| std::fs::canonicalize(d).ok().as_deref() == p.parent()) {
        return Err("ficheiro não permitido".into());
    }
    #[cfg(target_os = "macos")]
    let r = std::process::Command::new("open").arg("-R").arg(&p).spawn();
    #[cfg(target_os = "windows")]
    let r = std::process::Command::new("explorer").arg(format!("/select,{}", p.display())).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let r = std::process::Command::new("xdg-open").arg(p.parent().unwrap_or(&p)).spawn();
    r.map(|_| ()).map_err(|e| e.to_string())
}

/// Pasta "game" de uma instância (para o importador copiar para lá).
#[tauri::command]
fn instance_game_dir(app: AppHandle, name: String) -> Result<String, String> {
    Ok(idir(&app, &name)?.join("game").to_string_lossy().to_string())
}

#[tauri::command]
fn list_accounts(app: AppHandle) -> Vec<Value> {
    auth::list(&app)
}

#[tauri::command]
fn switch_account(app: AppHandle, uuid: String) -> Result<Value, String> {
    social::logout(&app);
    auth::switch(&app, &uuid)
}

#[tauri::command]
fn remove_account(app: AppHandle, uuid: String) -> Result<(), String> {
    let active = auth::load(&app).and_then(|a| a["uuid"].as_str().map(String::from));
    if active.as_deref() == Some(uuid.as_str()) {
        social::logout(&app);
    }
    auth::remove(&app, &uuid)
}

#[tauri::command]
fn offline_login(app: AppHandle, name: String) -> Result<Value, String> {
    social::logout(&app);
    auth::offline_login(&app, &name)
}

#[tauri::command]
fn ms_logout(app: AppHandle) {
    social::logout(&app);
    auth::logout(&app)
}

fn skey(app: &AppHandle) -> String {
    settings(app)["social_key"].as_str().unwrap_or("").to_string()
}

#[tauri::command]
async fn social_login(app: AppHandle) -> Result<Value, String> {
    let c = cid(&app);
    social::login(&app, &skey(&app), &c).await
}

#[tauri::command]
async fn social_req(app: AppHandle, method: String, path: String, body: Option<Value>) -> Result<Value, String> {
    social::request(&app, &skey(&app), &method, &path, body).await
}

#[tauri::command]
fn social_logout(app: AppHandle) {
    social::logout(&app)
}

#[tauri::command]
fn get_account(app: AppHandle) -> Value {
    auth::load(&app).map(|a| auth::public(&a)).unwrap_or(Value::Null)
}

#[tauri::command]
async fn change_skin(app: AppHandle, variant: String, data: String) -> Result<Value, String> {
    let c = cid(&app);
    auth::change_skin(&app, &c, &variant, &data).await
}

#[tauri::command]
async fn set_cape(app: AppHandle, cape_id: Option<String>) -> Result<Value, String> {
    let c = cid(&app);
    auth::set_cape(&app, &c, cape_id).await
}

#[tauri::command]
async fn list_versions() -> Result<Vec<Value>, String> {
    mojang::versions().await
}

#[tauri::command]
fn list_instances(app: AppHandle) -> Result<Vec<Value>, String> {
    let mut out = vec![];
    if let Ok(rd) = std::fs::read_dir(root(&app)?.join("instances")) {
        for en in rd.flatten() {
            if let Ok(v) = read_inst(&en.path()) {
                out.push(v);
            }
        }
    }
    Ok(out)
}

/// Loaders que o launcher sabe instalar.
fn norm_loader(l: &str) -> &'static str {
    match l {
        "fabric" => "fabric",
        "quilt" => "quilt",
        "forge" => "forge",
        "neoforge" => "neoforge",
        _ => "vanilla",
    }
}

async fn make_instance(app: &AppHandle, name: &str, version: &str, loader: &str, loader_version: Option<&str>) -> Result<(), String> {
    let dir = idir(app, name)?;
    let all = mojang::versions().await?;
    let url = all
        .iter()
        .find(|x| x["id"].as_str() == Some(version))
        .and_then(|x| x["url"].as_str())
        .ok_or("versão não encontrada")?
        .to_string();
    let loader = norm_loader(loader);
    std::fs::create_dir_all(dir.join("game")).map_err(err)?;
    write_inst(&dir, &json!({"name": clean(name), "version": version, "url": url, "loader": loader, "loader_version": loader_version, "installed": false}))
}

#[tauri::command]
async fn create_instance(app: AppHandle, name: String, version: String, loader: String) -> Result<(), String> {
    make_instance(&app, &name, &version, &loader, None).await
}

#[tauri::command]
async fn install_instance(app: AppHandle, name: String) -> Result<(), String> {
    let dir = idir(&app, &name)?;
    let mut inst = read_inst(&dir)?;
    let shared = root(&app)?.join("shared");
    let mc = inst["version"].as_str().unwrap_or("").to_string();
    let url = inst["url"].as_str().unwrap_or("").to_string();
    let loader = norm_loader(inst["loader"].as_str().unwrap_or("vanilla"));
    let parent = mojang::vanilla_json(&shared, &mc, &url).await?;
    // os modpacks fixam a versão do loader; as instâncias normais usam a mais recente
    let lv = inst["loader_version"].as_str().map(String::from);
    let (pid, vj) = match loader {
        "fabric" | "quilt" => fabric::profile(&mc, &parent, loader == "quilt", lv.as_deref()).await?,
        "forge" | "neoforge" => {
            // o instalador precisa do cliente vanilla já descarregado
            mojang::install(&app, &shared, &mc, &parent).await?;
            let major = parent["javaVersion"]["majorVersion"].as_u64().unwrap_or(8);
            let (id, child) = loaders::install(&app, &root(&app)?, &shared, &mc, loader == "neoforge", major, lv.as_deref()).await?;
            (id, fabric::merge(&parent, &child, &mc))
        }
        _ => (mc.clone(), parent),
    };
    if loader != "vanilla" {
        let pdir = shared.join("versions").join(&pid);
        std::fs::create_dir_all(&pdir).map_err(err)?;
        std::fs::write(pdir.join(format!("{pid}.json")), serde_json::to_vec(&vj).map_err(err)?).map_err(err)?;
    }
    mojang::install(&app, &shared, &pid, &vj).await?;
    inst["profile"] = json!(pid);
    inst["installed"] = json!(true);
    write_inst(&dir, &inst)
}

/// Instala um modpack da Modrinth (source "mr") ou da CurseForge ("cf") numa instância nova. Devolve {name, blocked}: `blocked` são os ficheiros que o autor só deixa descarregar no site.
#[tauri::command]
async fn install_modpack(app: AppHandle, source: Option<String>, project: String, title: String, mc: Option<String>, loader: Option<String>) -> Result<Value, String> {
    let cf = source.as_deref() == Some("cf");
    let (want_mc, want_ld) = (mc.unwrap_or_default(), loader.unwrap_or_default());
    let key = cfkey(&app);
    let (index, bytes, version, ld, lv) = if cf {
        let (m, b) = curseforge::fetch_pack(&key, project.trim_start_matches("cf:"), &want_mc, &want_ld).await?;
        let v = m["minecraft"]["version"].as_str().ok_or("modpack sem versão do Minecraft")?.to_string();
        let (l, lv) = curseforge::pack_loader(&m);
        (m, b, v, l, lv)
    } else {
        let (m, b) = modrinth::fetch_pack(&project, &want_mc, &want_ld).await?;
        let v = m["dependencies"]["minecraft"].as_str().ok_or("modpack sem versão do Minecraft")?.to_string();
        let (l, lv) = modrinth::pack_loader(&m);
        (m, b, v, l, lv)
    };
    let base = clean(&title);
    let base = if base.is_empty() { "Modpack".to_string() } else { base };
    let mut name = base.clone();
    let mut n = 2;
    while idir(&app, &name)?.exists() {
        name = format!("{base} {n}");
        n += 1;
    }
    make_instance(&app, &name, &version, ld, lv.as_deref()).await?;
    let game = idir(&app, &name)?.join("game");
    let res = if cf { curseforge::apply_pack(&app, &key, &game, &index, &bytes).await } else { modrinth::apply_pack(&app, &game, &index, &bytes).await.map(|_| vec![]) };
    match res {
        Ok(blocked) => Ok(json!({"name": name, "blocked": blocked})),
        Err(x) => {
            // não deixa uma instância a meio
            let _ = std::fs::remove_dir_all(idir(&app, &name)?);
            Err(x)
        }
    }
}

#[tauri::command]
async fn check_updates(app: AppHandle, name: String, kind: String) -> Result<Vec<String>, String> {
    let dir = idir(&app, &name)?;
    let inst = read_inst(&dir)?;
    let mc = inst["version"].as_str().unwrap_or("").to_string();
    let loader = inst["loader"].as_str().unwrap_or("vanilla").to_string();
    let fo = modrinth::folder(&kind)?;
    let idx = modrinth::idx_read(&dir.join("game"));
    let key = cfkey(&app);
    let items: Vec<(String, String)> = idx[fo]
        .as_object()
        .map(|m| m.iter().map(|(k, v)| (k.clone(), v["file"].as_str().unwrap_or("").to_string())).collect())
        .unwrap_or_default();
    let res = futures::future::join_all(items.into_iter().map(|(k, file)| {
        let (mc, kind, key, loader) = (mc.clone(), kind.clone(), key.clone(), loader.clone());
        async move {
            let latest = match k.strip_prefix("cf:") {
                Some(id) => curseforge::latest_file(&key, id, &kind, &mc, &loader).await,
                None => modrinth::latest_file(&k, &kind, &mc, &loader).await,
            };
            match latest {
                Ok(Some(n)) if n != file => Some(k),
                _ => None,
            }
        }
    }))
    .await;
    Ok(res.into_iter().flatten().collect())
}

#[tauri::command]
async fn play_instance(app: AppHandle, name: String, server: Option<String>) -> Result<String, String> {
    let dir = idir(&app, &name)?;
    let inst = read_inst(&dir)?;
    let mc = inst["version"].as_str().unwrap_or("").to_string();
    let id = inst["profile"].as_str().unwrap_or(&mc).to_string();
    let game = dir.join("game");
    let shared = root(&app)?.join("shared");
    let c = cid(&app);
    let (user, uuid, tk) = auth::session(&app, &c).await.unwrap_or_else(|| {
        ("Sleep".to_string(), "00000000-0000-0000-0000-000000000000".to_string(), "0".to_string())
    });
    let prefs = settings(&app);
    let total = perf::total_ram_mb();
    let ram_max = Some(inst["ram_max"].as_u64().unwrap_or(0)).filter(|m| *m > 0).or(prefs["default_ram"].as_u64().filter(|m| *m > 0)).unwrap_or_else(|| perf::auto_ram(total));
    let ram_min = inst["ram_min"].as_u64().unwrap_or(0);
    perf::apply_fps_mode(&game, prefs["fps_mode"].as_bool().unwrap_or(false));
    let opts = launch::Opts {
        ram_min,
        ram_max,
        jvm: inst["jvm_args"].as_str().unwrap_or("").split_whitespace().map(String::from).collect(),
    };
    let (mut args, major) = launch::build(&shared, &game, &id, &user, &uuid, &tk, &opts)?;
    let (w, h) = (inst["width"].as_u64().unwrap_or(0), inst["height"].as_u64().unwrap_or(0));
    if w > 0 && h > 0 {
        args.push("--width".to_string());
        args.push(w.to_string());
        args.push("--height".to_string());
        args.push(h.to_string());
    }
    if let Some(sv) = server.filter(|x| !x.trim().is_empty()) {
        // entra direto no servidor (Minecraft 1.20+)
        args.push("--quickPlayMultiplayer".to_string());
        args.push(sv.trim().to_string());
    }
    if console::is_running(&clean(&name)) {
        return Err("O jogo já está a correr nesta instância".into());
    }
    let java = java::ensure(&app, &root(&app)?, major).await?;
    let mut note = String::new();
    if matches!(inst["loader"].as_str(), Some("fabric") | Some("quilt")) {
        // a mod do Sleep é uma mod Fabric (o Quilt também a carrega)
        // fica escondida na pasta de dados do launcher (nunca em game/mods) e o Fabric Loader vai buscá-la por -Dfabric.addMods
        let hidden = root(&app)?.join("kubo-mods").join(&mc);
        if !mods::is_fresh(&hidden, &mc) {
            note = sync_mods(&app, &mc, &hidden, &game).await?;
        }
        mods::purge_visible(&game.join("mods"));
        mods::purge_bundled(&hidden);
        // sem o jar principal nenhuma das outras entra: as extensões dependem dele e o jogo crashava
        let list = if mods::has_main(&hidden, &mc) { mods::jar_list(&hidden) } else { String::new() };
        if !list.is_empty() {
            args.insert(0, format!("-Dfabric.addMods={list}"));
            args.insert(1, format!("-Dloader.addMods={list}"));
        }
    }
    let mut c = std::process::Command::new(&java);
    c.args(&args).current_dir(&game);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x08000000);
    }
    console::start(&app, &clean(&name), c)?;
    let _ = patch(&app, "last", inst["name"].clone());
    if prefs["hide_on_play"].as_bool().unwrap_or(true) && inst["open_console"].as_bool() != Some(true) {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.hide();
        }
    }
    Ok(format!("A iniciar {id}… {note}").trim().to_string())
}

fn manifest_url() -> String {
    default_manifest()
}

/// Atualiza as mods escondidas. Com o jar principal no disco nunca faz esperar mais do que uns segundos: joga-se com o que há e o resto continua depois.
/// Sem ele, espera o download inteiro (com progresso) e, se não der, não deixa jogar.
async fn sync_mods(app: &AppHandle, mc: &str, hidden: &Path, game: &Path) -> Result<String, String> {
    let url = manifest_url();
    let have = mods::is_ready(hidden, mc);
    let res = if have {
        tokio::time::timeout(std::time::Duration::from_secs(5), mods::sync(app, &url, mc, hidden)).await.unwrap_or_else(|_| Ok(String::new()))
    } else {
        mods::sync(app, &url, mc, hidden).await
    };
    let d = std::time::Duration::from_secs(if have { 5 } else { 45 });
    let fps_on = settings(app)["fps_boost"].as_bool().unwrap_or(false);
    let fps = tokio::time::timeout(d, mods::sync_perf(&url, mc, hidden, &game.join("mods"), fps_on)).await;
    let mut note = String::new();
    if !have {
        if let Ok(Err(x)) = fps {
            note = format!("fps: {x}");
        }
    }
    if mods::is_ready(hidden, mc) {
        return Ok(note);
    }
    match res {
        // o manifesto foi lido até ao fim e não falta nada do que ele oferece (esta versão do jogo não tem Sleep)
        Ok(_) => Ok(note),
        // sem internet, numa versão que da última vez já se sabia não ter Sleep
        Err(x) if x.starts_with("MANIFEST:") && mods::known_without_sleep(hidden) => Ok(format!("mods: {}", x.trim_start_matches("MANIFEST:"))),
        Err(x) => Err(format!("Não foi possível descarregar o Sleep ({}). Verifica a internet e carrega em Jogar outra vez.", x.trim_start_matches("MANIFEST:"))),
    }
}

/// Ao abrir o launcher, deixa as mods da última instância em dia em segundo plano: assim carregar em Jogar não precisa de esperar pela rede.
#[tauri::command]
async fn prefetch_mods(app: AppHandle) -> Result<(), String> {
    if !console::running().is_empty() {
        return Ok(());
    }
    let last = settings(&app)["last"].as_str().unwrap_or("").to_string();
    if last.is_empty() {
        return Ok(());
    }
    let dir = idir(&app, &last)?;
    let inst = read_inst(&dir)?;
    if !matches!(inst["loader"].as_str(), Some("fabric") | Some("quilt")) {
        return Ok(());
    }
    let mc = inst["version"].as_str().unwrap_or("").to_string();
    let hidden = root(&app)?.join("kubo-mods").join(&mc);
    if !mods::is_fresh(&hidden, &mc) {
        let _ = mods::sync(&app, &manifest_url(), &mc, &hidden).await;
    }
    Ok(())
}

/// O jogo fechou: volta a mostrar o launcher se foi ele que se escondeu.
pub fn after_game(app: &AppHandle) {
    if settings(app)["hide_on_play"].as_bool().unwrap_or(true) && console::running().is_empty() {
        show(app);
    }
}

/// Servidor a que o jogo se ligou por último (lido da consola), para convidar amigos (passo 10).
#[tauri::command]
fn current_server() -> Value {
    match console::any_server() {
        Some((instance, address)) => json!({ "instance": instance, "address": address }),
        None => Value::Null,
    }
}

// ---------- consola do jogo (passo 9C) ----------

/// Linhas novas da consola desde o índice `from` (ver console::read).
#[tauri::command]
fn read_console(app: AppHandle, name: String, from: u64, session: u64) -> Result<Value, String> {
    let n = clean_name(&app, &name)?;
    Ok(console::read(&n, from, session))
}

#[tauri::command]
fn stop_game(app: AppHandle, name: String) -> Result<(), String> {
    console::stop(&clean_name(&app, &name)?)
}

#[tauri::command]
fn clear_console(app: AppHandle, name: String) -> Result<(), String> {
    console::clear(&clean_name(&app, &name)?);
    Ok(())
}

#[tauri::command]
fn running_games() -> Vec<String> {
    console::running()
}

/// Nome da instância já limpo (o mesmo que idir usa), para as chaves da consola.
fn clean_name(app: &AppHandle, name: &str) -> Result<String, String> {
    idir(app, name)?;
    Ok(clean(name))
}

fn gdir(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    Ok(idir(app, name)?.join("game"))
}

#[tauri::command]
async fn mr_search(kind: String, query: String, mc: String, loader: String, category: String, offset: u32) -> Result<Value, String> {
    modrinth::search(&kind, &query, &mc, &loader, &category, offset).await
}

#[tauri::command]
async fn mr_install(app: AppHandle, name: String, kind: String, project: String) -> Result<Vec<String>, String> {
    let dir = idir(&app, &name)?;
    let inst = read_inst(&dir)?;
    let mc = inst["version"].as_str().unwrap_or("").to_string();
    let loader = inst["loader"].as_str().unwrap_or("vanilla").to_string();
    modrinth::install(&dir.join("game"), &kind, &project, &mc, &loader).await
}

#[tauri::command]
fn list_content(app: AppHandle, name: String, kind: String) -> Result<Vec<Value>, String> {
    modrinth::list(&gdir(&app, &name)?, &kind)
}

#[tauri::command]
fn toggle_content(app: AppHandle, name: String, kind: String, file: String) -> Result<(), String> {
    modrinth::toggle(&gdir(&app, &name)?, &kind, &file)
}

#[tauri::command]
fn remove_content(app: AppHandle, name: String, kind: String, file: String) -> Result<(), String> {
    modrinth::remove(&gdir(&app, &name)?, &kind, &file)
}

#[tauri::command]
fn delete_instance(app: AppHandle, name: String) -> Result<(), String> {
    std::fs::remove_dir_all(idir(&app, &name)?).map_err(err)
}

fn open_path(t: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let r = std::process::Command::new("open").arg(t).spawn();
    #[cfg(target_os = "windows")]
    let r = std::process::Command::new("explorer").arg(t).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let r = std::process::Command::new("xdg-open").arg(t).spawn();
    r.map(|_| ()).map_err(err)
}

#[tauri::command]
fn open_folder(app: AppHandle, name: String) -> Result<(), String> {
    let g = gdir(&app, &name)?;
    std::fs::create_dir_all(&g).map_err(err)?;
    open_path(&g.to_string_lossy())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    let ok = ["https://modrinth.com/", "https://www.curseforge.com/", "https://www.minecraft.net/", "https://minecraft.net/", "https://feedback.minecraft.net/", "https://pal-connect-plaza.lovable.app/", "https://www.microsoft.com/link", "https://microsoft.com/link", "https://login.live.com/", "https://aka.ms/", "https://mcpelauncher.readthedocs.io/", "https://minecraft-linux.github.io/", "https://apps.microsoft.com/", "https://www.microsoft.com/store/", "https://www.xbox.com/", "https://account.xbox.com/", "https://account.microsoft.com/", "https://support.xbox.com/"];
    if !ok.iter().any(|p| url.starts_with(p)) && !url.starts_with(&format!("https://github.com/{REPO}/releases")) {
        return Err("endereço não permitido".into());
    }
    open_path(&url)
}

/// Estado do Bedrock neste computador: {os, installed}.
#[tauri::command]
fn bedrock_state(app: AppHandle) -> Value {
    bedrock::state(&app)
}

/// Mac / Linux: descarrega o mcpelauncher (app oficial do projeto) e deixa-o pronto. No Windows o Bedrock vem da Microsoft Store.
#[tauri::command]
async fn bedrock_install(app: AppHandle) -> Result<(), String> {
    bedrock::install(&app).await
}

/// Abre o Bedrock (Windows: o instalado da Store; Mac / Linux: o mcpelauncher).
#[tauri::command]
fn bedrock_launch(app: AppHandle) -> Result<(), String> {
    bedrock::launch(&app)
}

// ---------- separadores da instância (passo 9B) ----------

/// Guarda RAM, argumentos de Java, resolução, ícone e (se mudou) o nome. Devolve o nome final.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn save_inst_settings(app: AppHandle, name: String, ram_min: u64, ram_max: u64, jvm_args: String, width: u64, height: u64, icon: String, new_name: String, open_console: Option<bool>) -> Result<String, String> {
    let mut dir = idir(&app, &name)?;
    let mut v = read_inst(&dir)?;
    if ram_max != 0 && !(512..=65536).contains(&ram_max) {
        return Err("RAM máxima: entre 512 e 65536 MB".into());
    }
    if ram_min != 0 && (ram_min < 256 || (ram_max != 0 && ram_min > ram_max)) {
        return Err("RAM mínima: pelo menos 256 MB e não maior que a máxima".into());
    }
    if (width != 0 && !(320..=16000).contains(&width)) || (height != 0 && !(320..=16000).contains(&height)) || ((width == 0) != (height == 0)) {
        return Err("resolução inválida (põe largura e altura, ou deixa as duas a 0)".into());
    }
    if jvm_args.len() > 1000 || jvm_args.chars().any(|c| c.is_control()) {
        return Err("argumentos de Java inválidos".into());
    }
    let icon: String = icon.trim().chars().take(2).filter(|c| !c.is_control()).collect();
    v["ram_min"] = json!(ram_min);
    v["ram_max"] = json!(ram_max);
    v["jvm_args"] = json!(jvm_args.trim());
    v["width"] = json!(width);
    v["height"] = json!(height);
    v["icon"] = json!(icon);
    v["open_console"] = json!(open_console.unwrap_or(false));
    let mut final_name = v["name"].as_str().unwrap_or(&name).to_string();
    let nn = clean(&new_name);
    if !nn.is_empty() && nn != final_name {
        let to = idir(&app, &nn)?;
        if to.exists() {
            return Err("já existe uma instância com esse nome".into());
        }
        write_inst(&dir, &v)?;
        std::fs::rename(&dir, &to).map_err(err)?;
        dir = to;
        v["name"] = json!(nn);
        if settings(&app)["last"].as_str() == Some(final_name.as_str()) {
            let _ = patch(&app, "last", json!(nn));
        }
        final_name = nn;
    }
    write_inst(&dir, &v)?;
    Ok(final_name)
}

#[tauri::command]
fn list_worlds(app: AppHandle, name: String) -> Result<Vec<Value>, String> {
    Ok(inst::worlds(&gdir(&app, &name)?))
}

#[tauri::command]
fn delete_world(app: AppHandle, name: String, world: String) -> Result<(), String> {
    inst::delete_world(&gdir(&app, &name)?, &world)
}

#[tauri::command]
fn list_shots(app: AppHandle, name: String) -> Result<Vec<Value>, String> {
    Ok(inst::shots(&gdir(&app, &name)?))
}

#[tauri::command]
fn read_shot(app: AppHandle, name: String, file: String) -> Result<String, String> {
    inst::read_shot(&gdir(&app, &name)?, &file)
}

#[tauri::command]
fn delete_shot(app: AppHandle, name: String, file: String) -> Result<(), String> {
    inst::delete_shot(&gdir(&app, &name)?, &file)
}

#[tauri::command]
fn read_log(app: AppHandle, name: String, from: u64) -> Result<Value, String> {
    inst::read_log(&gdir(&app, &name)?, from)
}

#[tauri::command]
fn list_servers(app: AppHandle, name: String) -> Result<Vec<Value>, String> {
    inst::servers(&gdir(&app, &name)?)
}

#[tauri::command]
fn save_servers(app: AppHandle, name: String, servers: Vec<Value>) -> Result<(), String> {
    let list: Vec<(String, String)> = servers
        .iter()
        .map(|s| (s["name"].as_str().unwrap_or("").to_string(), s["ip"].as_str().unwrap_or("").to_string()))
        .collect();
    inst::save_servers(&gdir(&app, &name)?, &list)
}

#[tauri::command]
fn open_sub(app: AppHandle, name: String, sub: String) -> Result<(), String> {
    if !["saves", "screenshots", "logs"].contains(&sub.as_str()) {
        return Err("pasta não permitida".into());
    }
    let p = gdir(&app, &name)?.join(&sub);
    std::fs::create_dir_all(&p).map_err(err)?;
    open_path(&p.to_string_lossy())
}

fn show(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn main() {
    tauri::Builder::default()
        // tem de ser o primeiro plugin: abrir a app outra vez mostra a que já está a correr em vez de criar uma segunda
        .plugin(tauri_plugin_single_instance::init(|app, _, _| show(app)))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Abrir", true, None::<&str>)?;
            let play = MenuItem::with_id(app, "play", "Jogar última instalação", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &play, &quit])?;
            let mut tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Sleep Launcher")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, ev| match ev.id.as_ref() {
                    "open" => show(app),
                    "play" => {
                        let a = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let last = settings(&a)["last"].as_str().unwrap_or("").to_string();
                            if last.is_empty() {
                                show(&a);
                                return;
                            }
                            let r = play_instance(a.clone(), last, None).await;
                            let _ = a.emit("play-result", r.unwrap_or_else(|x| format!("Erro: {x}")));
                        });
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, ev| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                        show(tray.app_handle());
                    }
                });
            if let Some(i) = app.default_window_icon() {
                tray = tray.icon(i.clone());
            }
            tray.build(app)?;
            // arrancou com o computador: fica escondido na bandeja
            if std::env::args().any(|a| a == "--hidden") {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            Ok(())
        })
        .on_window_event(|w, ev| {
            // só a janela principal fica na bandeja: a janela de login tem mesmo de fechar
            if let (WindowEvent::CloseRequested { api, .. }, "main") = (ev, w.label()) {
                if settings(w.app_handle())["close_to_tray"].as_bool().unwrap_or(true) {
                    let _ = w.hide();
                    api.prevent_close();
                } else {
                    w.app_handle().exit(0);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_pref,
            set_theme,
            ms_login,
            ms_login_cancel,
            ms_logout,
            get_account,
            offline_login,
            set_vpn,
            horizon::horizon_state,
            horizon::horizon_install,
            horizon::horizon_cmd,
            import::scan_launchers,
            import::import_copy,
            import::trash_leftovers,
            instance_game_dir,
            set_app_icon,
            app_check_update,
            app_install_update,
            app_update_blocked,
            open_data_dir,
            cache_size,
            clear_cache,
            prefetch_mods,
            quit_app,
            bedrock_launch,
            bedrock_state,
            bedrock_install,
            media_list,
            media_delete,
            media_reveal,
            version_panorama,
            list_accounts,
            switch_account,
            remove_account,
            http_get,
            img_b64,
            skin_b64,
            change_skin,
            set_cape,
            get_autostart,
            set_autostart,
            list_versions,
            list_instances,
            create_instance,
            install_instance,
            play_instance,
            mr_search,
            mr_install,
            list_content,
            toggle_content,
            remove_content,
            delete_instance,
            open_folder,
            open_url,
            cf_categories,
            cf_search,
            cf_install,
            install_modpack,
            check_updates,
            social_login,
            social_req,
            social_logout,
            save_inst_settings,
            list_worlds,
            delete_world,
            list_shots,
            read_shot,
            delete_shot,
            read_log,
            list_servers,
            save_servers,
            open_sub,
            read_console,
            current_server,
            stop_game,
            clear_console,
            running_games
        ])
        .build(tauri::generate_context!())
        .expect("erro ao iniciar o Sleep Launcher")
        .run(|_app, _ev| {
            // macOS: clicar no ícone do Dock com a janela escondida volta a mostrá-la
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _ev {
                show(_app);
            }
        });
}
