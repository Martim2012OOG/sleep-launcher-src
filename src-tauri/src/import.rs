//! Procura instâncias de outros launchers (CurseForge, Modrinth App, Prism / MultiMC, ATLauncher, GDLauncher, a pasta .minecraft
//! que o launcher oficial e o Lunar usam, ...) e copia-as para o Sleep Launcher: mods, packs, shaders, mundos e definições.
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

fn home() -> PathBuf {
    PathBuf::from(std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap_or_default())
}

fn appdata() -> PathBuf {
    if cfg!(target_os = "windows") {
        std::env::var("APPDATA").map(PathBuf::from).unwrap_or_else(|_| home().join("AppData/Roaming"))
    } else if cfg!(target_os = "macos") {
        home().join("Library/Application Support")
    } else {
        home().join(".local/share")
    }
}

/// Pastas que fazem de "jogo": se tiver alguma, é uma instância.
const MARKS: [&str; 6] = ["mods", "saves", "resourcepacks", "shaderpacks", "options.txt", "config"];
/// O que se copia.
const COPY: [&str; 9] = ["mods", "resourcepacks", "shaderpacks", "saves", "config", "screenshots", "options.txt", "servers.dat", "optionsshaders.txt"];

fn looks_like_game(d: &Path) -> bool {
    MARKS.iter().any(|m| d.join(m).exists())
}

fn loader_of(s: &str) -> &'static str {
    let l = s.to_lowercase();
    if l.contains("neoforge") {
        "neoforge"
    } else if l.contains("quilt") {
        "quilt"
    } else if l.contains("fabric") {
        "fabric"
    } else if l.contains("forge") {
        "forge"
    } else {
        "vanilla"
    }
}

fn dir_size(d: &Path, depth: u8) -> u64 {
    if depth > 6 {
        return 0;
    }
    let mut n = 0;
    if let Ok(rd) = std::fs::read_dir(d) {
        for e in rd.flatten() {
            if let Ok(m) = e.metadata() {
                n += if m.is_dir() { dir_size(&e.path(), depth + 1) } else { m.len() };
            }
        }
    }
    n
}

fn read_json(p: &Path) -> Option<Value> {
    std::fs::read(p).ok().and_then(|b| serde_json::from_slice(&b).ok())
}

fn found(source: &str, name: &str, game: &Path, version: &str, loader: &str) -> Value {
    // a pasta que se pode mandar para o Lixo é a da instância (nos Prism / MultiMC o jogo fica numa subpasta "minecraft")
    let root = if matches!(fname(game).as_str(), "minecraft" | ".minecraft") && game.parent().map(|p| p.join("instance.cfg").exists() || p.join("mmc-pack.json").exists()).unwrap_or(false) { game.parent().unwrap_or(game) } else { game };
    json!({
        "source": source, "name": name, "game": game.to_string_lossy(), "root": root.to_string_lossy(),
        "version": version, "loader": loader,
        "mb": dir_size(game, 0) / 1_048_576
    })
}

fn subdirs(d: &Path) -> Vec<PathBuf> {
    std::fs::read_dir(d).map(|rd| rd.flatten().map(|e| e.path()).filter(|p| p.is_dir()).collect()).unwrap_or_default()
}

fn fname(p: &Path) -> String {
    p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
}

/// O launcher ainda está instalado? (só se sabe no Mac, vendo as aplicações; nos outros sistemas devolve None)
fn launcher_installed(source: &str) -> Option<bool> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    let names: &[&str] = match source {
        "CurseForge" => &["CurseForge.app"],
        "Modrinth App" => &["Modrinth App.app", "ModrinthApp.app"],
        "Prism Launcher" => &["Prism Launcher.app", "PrismLauncher.app"],
        "PolyMC" => &["PolyMC.app"],
        "MultiMC" => &["MultiMC.app"],
        "GDLauncher" => &["GDLauncher.app", "GDLauncher Carbon.app"],
        "ghost-launcher" | "GhostLauncher" | "Ghost Launcher" | "app.ghostclient.launcher" => &["Ghost Launcher.app", "Ghost.app"],
        "DawnLauncher" | "dawn-launcher" | "Dawn Launcher" => &["Dawn Launcher.app", "Dawn.app"],
        "lunarclient" => &["Lunar Client.app"],
        _ => return None,
    };
    let dirs = [PathBuf::from("/Applications"), home().join("Applications")];
    Some(names.iter().any(|n| dirs.iter().any(|d| d.join(n).exists())))
}

#[tauri::command]
pub fn scan_launchers() -> Vec<Value> {
    let mut v = scan_raw();
    for x in v.iter_mut() {
        let src = x["source"].as_str().unwrap_or("").to_string();
        let inst = launcher_installed(&src);
        x["known"] = json!(inst.is_some());
        x["installed"] = json!(inst.unwrap_or(true));
        // a pasta ".minecraft" é partilhada: nunca se oferece para apagar
        x["trashable"] = json!(inst == Some(false) && !src.starts_with("Minecraft"));
    }
    v
}

fn scan_raw() -> Vec<Value> {
    let (h, a) = (home(), appdata());
    let mut out: Vec<Value> = vec![];

    // CurseForge: minecraftinstance.json
    for base in [h.join("curseforge/minecraft/Instances"), h.join("Documents/curseforge/minecraft/Instances")] {
        for d in subdirs(&base) {
            let j = read_json(&d.join("minecraftinstance.json")).unwrap_or(Value::Null);
            let ver = j["gameVersion"].as_str().or(j["baseModLoader"]["minecraftVersion"].as_str()).unwrap_or("");
            let ld = loader_of(j["baseModLoader"]["name"].as_str().unwrap_or(""));
            if looks_like_game(&d) {
                out.push(found("CurseForge", &fname(&d), &d, ver, ld));
            }
        }
    }
    // Modrinth App (a versão e o loader ficam na base de dados deles: pergunta-se ao importar)
    for base in [a.join("ModrinthApp/profiles"), a.join("com.modrinth.theseus/profiles")] {
        for d in subdirs(&base) {
            if looks_like_game(&d) {
                out.push(found("Modrinth App", &fname(&d), &d, "", ""));
            }
        }
    }
    // Prism / PolyMC / MultiMC
    for (src, base) in [("Prism Launcher", a.join("PrismLauncher/instances")), ("PolyMC", a.join("PolyMC/instances")), ("MultiMC", a.join("multimc/instances")), ("MultiMC", a.join("MultiMC/instances"))] {
        for d in subdirs(&base) {
            let game = [d.join("minecraft"), d.join(".minecraft")].into_iter().find(|g| g.exists());
            let Some(game) = game else { continue };
            let pack = read_json(&d.join("mmc-pack.json")).unwrap_or(Value::Null);
            let (mut ver, mut ld) = (String::new(), "vanilla");
            for c in pack["components"].as_array().cloned().unwrap_or_default() {
                match c["uid"].as_str().unwrap_or("") {
                    "net.minecraft" => ver = c["version"].as_str().unwrap_or("").to_string(),
                    "net.fabricmc.fabric-loader" => ld = "fabric",
                    "org.quiltmc.quilt-loader" => ld = "quilt",
                    "net.neoforged" => ld = "neoforge",
                    "net.minecraftforge" => ld = "forge",
                    _ => {}
                }
            }
            if looks_like_game(&game) {
                out.push(found(src, &fname(&d), &game, &ver, ld));
            }
        }
    }
    // ATLauncher e GDLauncher
    for d in subdirs(&a.join("ATLauncher/instances")) {
        if looks_like_game(&d) {
            let j = read_json(&d.join("instance.json")).unwrap_or(Value::Null);
            out.push(found("ATLauncher", &fname(&d), &d, j["id"].as_str().unwrap_or(""), loader_of(&j["launcher"]["loaderVersion"]["type"].as_str().unwrap_or(""))));
        }
    }
    for d in subdirs(&a.join("gdlauncher_next/instances")) {
        if looks_like_game(&d) {
            let j = read_json(&d.join("config.json")).unwrap_or(Value::Null);
            out.push(found("GDLauncher", &fname(&d), &d, j["loader"]["mcVersion"].as_str().unwrap_or(""), loader_of(j["loader"]["loaderType"].as_str().unwrap_or(""))));
        }
    }
    // outros launchers parecidos (Ghost, Dawn...): pastas "instances" ou "profiles"
    for n in ["ghost-launcher", "GhostLauncher", "Ghost Launcher", "app.ghostclient.launcher", "DawnLauncher", "dawn-launcher", "Dawn Launcher", "lunarclient"] {
        for sub in ["instances", "profiles"] {
            for d in subdirs(&a.join(n).join(sub)) {
                if looks_like_game(&d) {
                    out.push(found(n, &fname(&d), &d, "", ""));
                }
            }
        }
    }
    // a pasta .minecraft (launcher oficial, Lunar, TLauncher...)
    let mc = a.join("minecraft");
    if looks_like_game(&mc) {
        out.push(found("Minecraft (.minecraft)", "Minecraft", &mc, "", ""));
    }
    out
}

fn count_files(p: &Path) -> u64 {
    if p.is_file() {
        return 1;
    }
    std::fs::read_dir(p).map(|rd| rd.flatten().map(|e| count_files(&e.path())).sum()).unwrap_or(0)
}

fn copy_all(app: &AppHandle, label: &str, from: &Path, to: &Path, done: &mut u64, total: u64) -> std::io::Result<()> {
    if from.is_file() {
        if let Some(p) = to.parent() {
            std::fs::create_dir_all(p)?;
        }
        std::fs::copy(from, to)?;
        *done += 1;
        if *done % 25 == 0 || *done == total {
            let _ = app.emit("progress", json!({"stage": label, "done": *done, "total": total}));
        }
        return Ok(());
    }
    std::fs::create_dir_all(to)?;
    for e in std::fs::read_dir(from)?.flatten() {
        let n = e.file_name();
        if n.to_string_lossy().starts_with('.') && n.to_string_lossy() != ".minecraft" {
            continue;
        }
        copy_all(app, label, &e.path(), &to.join(n), done, total)?;
    }
    Ok(())
}

/// Copia o jogo de `src` para a instância já criada em `dst` (a pasta "game").
#[tauri::command]
pub async fn import_copy(app: AppHandle, src: String, dst: String, label: String) -> Result<u64, String> {
    let (src, dst) = (PathBuf::from(src), PathBuf::from(dst));
    if !src.is_dir() || !looks_like_game(&src) {
        return Err("Essa pasta já não existe ou não parece uma instância".to_string());
    }
    tokio::task::spawn_blocking(move || {
        let total: u64 = COPY.iter().map(|n| count_files(&src.join(n))).sum();
        let mut done = 0;
        for n in COPY {
            let from = src.join(n);
            if from.exists() {
                copy_all(&app, &label, &from, &dst.join(n), &mut done, total).map_err(|e| e.to_string())?;
            }
        }
        let _ = app.emit("progress", json!({"stage": label, "done": total.max(1), "total": total.max(1)}));
        Ok(done)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Manda pastas de instâncias de launchers que já não existem para o Lixo (dá para recuperar). Só aceita pastas que a procura acabou de encontrar.
#[tauri::command]
pub fn trash_leftovers(paths: Vec<String>) -> Result<u32, String> {
    let ok: Vec<String> = scan_launchers().iter().filter(|x| x["trashable"] == json!(true)).filter_map(|x| x["root"].as_str().map(String::from)).collect();
    let mut n = 0;
    for p in paths {
        if !ok.contains(&p) {
            continue;
        }
        let r = if cfg!(target_os = "macos") {
            std::process::Command::new("osascript").arg("-e").arg(format!("tell application \"Finder\" to delete POSIX file \"{}\"", p.replace('"', ""))).output().map(|o| o.status.success())
        } else if cfg!(target_os = "windows") {
            std::process::Command::new("powershell").args(["-NoProfile", "-Command", &format!("Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('{}','OnlyErrorDialogs','SendToRecycleBin')", p.replace('\'', ""))]).output().map(|o| o.status.success())
        } else {
            std::process::Command::new("gio").args(["trash", &p]).output().map(|o| o.status.success())
        };
        if r.unwrap_or(false) {
            n += 1;
        }
    }
    Ok(n)
}
