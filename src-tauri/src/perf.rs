//! Desempenho sem instalar mods: memória automática e o Modo FPS (definições do jogo, reversível).
use serde_json::{json, Map, Value};
use std::path::Path;

/// Memória total do computador em MB (0 se não der para saber).
pub fn total_ram_mb() -> u64 {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("/usr/sbin/sysctl").args(["-n", "hw.memsize"]).output().ok().and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<u64>().ok()).map(|b| b / 1_048_576).unwrap_or(0)
    }
    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string("/proc/meminfo").ok().and_then(|t| t.lines().find(|l| l.starts_with("MemTotal:")).and_then(|l| l.split_whitespace().nth(1)?.parse::<u64>().ok())).map(|k| k / 1024).unwrap_or(0)
    }
    #[cfg(target_os = "windows")]
    {
        #[repr(C)]
        struct Status {
            length: u32,
            load: u32,
            total: u64,
            rest: [u64; 6],
        }
        #[link(name = "kernel32")]
        extern "system" {
            fn GlobalMemoryStatusEx(s: *mut Status) -> i32;
        }
        let mut s = Status { length: std::mem::size_of::<Status>() as u32, load: 0, total: 0, rest: [0; 6] };
        // SAFETY: `s` tem o formato MEMORYSTATUSEX e o campo length preenchido, como a API exige.
        if unsafe { GlobalMemoryStatusEx(&mut s) } != 0 {
            s.total / 1_048_576
        } else {
            0
        }
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        0
    }
}

/// Memória para o jogo quando ninguém escolheu: deixa sempre folga para o sistema e para a placa gráfica.
pub fn auto_ram(total: u64) -> u64 {
    match total {
        0 => 4096,
        t if t <= 8192 => 3072,
        t if t <= 12288 => 4096,
        t if t <= 16384 => 6144,
        _ => 8192,
    }
}

/// Windows, portáteis com placa dedicada: o Windows manda programas "novos" para a gráfica integrada, muito mais lenta (100 FPS em vez de 300).
/// Pede a gráfica de ALTO DESEMPENHO para este Java (java.exe e javaw.exe), nas definições gráficas do utilizador (HKCU, não precisa de administrador).
/// Se a pessoa já escolheu outra coisa para este Java nas definições do Windows, não se mexe.
#[cfg(windows)]
pub fn prefer_fast_gpu(java: &str) {
    use std::os::windows::process::CommandExt;
    const KEY: &str = r"HKCU\Software\Microsoft\DirectX\UserGpuPreferences";
    let p = Path::new(java);
    let mut exes: Vec<std::path::PathBuf> = vec![p.to_path_buf()];
    if let Some(dir) = p.parent() {
        for n in ["java.exe", "javaw.exe"] {
            let q = dir.join(n);
            if q.exists() && !exes.contains(&q) {
                exes.push(q);
            }
        }
    }
    for e in exes {
        let name = e.to_string_lossy().to_string();
        let has = std::process::Command::new("reg").args(["query", KEY, "/v", &name]).creation_flags(0x08000000).output().map(|o| o.status.success()).unwrap_or(false);
        if !has {
            let _ = std::process::Command::new("reg").args(["add", KEY, "/v", &name, "/t", "REG_SZ", "/d", "GpuPreference=2;", "/f"]).creation_flags(0x08000000).output();
        }
    }
}

const OPTIONS: &[(&str, &str)] = &[
    ("enableVsync", "false"),
    ("maxFps", "260"),
    ("ao", "false"),
    ("biomeBlendRadius", "0"),
    ("entityShadows", "false"),
    ("mipmapLevels", "0"),
    ("particles", "2"),
    ("renderClouds", "\"false\""),
    ("graphicsMode", "0"),
    ("improvedTransparency", "false"),
    ("cutoutLeaves", "false"),
    ("weatherRadius", "3"),
    ("vignette", "false"),
    ("menuBackgroundBlurriness", "0"),
    ("prioritizeChunkUpdates", "0"),
    ("graphicsPreset", "\"custom\""),
];
/// Só baixa: quem já tem menos fica com o que tem.
const CAPS: &[(&str, u32)] = &[("renderDistance", 8), ("simulationDistance", 6)];
const BACKUP: &str = "sleep-fps-backup.json";

fn patch_file(p: &Path, sep: char, new: &Map<String, Value>) -> Map<String, Value> {
    let mut old = Map::new();
    let Ok(txt) = std::fs::read_to_string(p) else { return old };
    let out: Vec<String> = txt
        .lines()
        .map(|l| match l.split_once(sep) {
            Some((k, v)) if new.contains_key(k) => {
                old.insert(k.to_string(), json!(v));
                format!("{k}{sep}{}", new[k].as_str().unwrap_or(v))
            }
            _ => l.to_string(),
        })
        .collect();
    if !old.is_empty() {
        let tmp = p.with_extension("sleep-tmp");
        if std::fs::write(&tmp, out.join("\n") + "\n").is_err() || std::fs::rename(&tmp, p).is_err() {
            return Map::new();
        }
    }
    old
}

fn value_of(txt: &str, sep: char, key: &str) -> Option<String> {
    txt.lines().find_map(|l| l.split_once(sep).filter(|(k, _)| *k == key).map(|(_, v)| v.to_string()))
}

/// Liga: aplica uma vez e guarda os valores antigos (mudanças que a pessoa faça depois dentro do jogo ficam). Desliga: repõe só o que tinha mudado.
pub fn apply_fps_mode(game: &Path, on: bool) {
    let opt = game.join("options.txt");
    let iris = game.join("config").join("iris.properties");
    let bak = game.join(BACKUP);
    if on {
        let Ok(txt) = std::fs::read_to_string(&opt) else { return };
        if bak.exists() {
            return;
        }
        let mut new: Map<String, Value> = OPTIONS.iter().map(|(k, v)| (k.to_string(), json!(v))).collect();
        for (k, cap) in CAPS {
            if let Some(cur) = value_of(&txt, ':', k).and_then(|v| v.parse::<u32>().ok()) {
                new.insert(k.to_string(), json!(cur.min(*cap).to_string()));
            }
        }
        let shaders: Map<String, Value> = [("enableShaders".to_string(), json!("false"))].into_iter().collect();
        let saved = json!({"options": patch_file(&opt, ':', &new), "iris": patch_file(&iris, '=', &shaders)});
        let _ = std::fs::write(&bak, saved.to_string());
    } else if let Some(saved) = std::fs::read(&bak).ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok()) {
        if let Some(o) = saved["options"].as_object() {
            patch_file(&opt, ':', o);
        }
        if let Some(o) = saved["iris"].as_object() {
            patch_file(&iris, '=', o);
        }
        let _ = std::fs::remove_file(&bak);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memoria_automatica() {
        assert_eq!(auto_ram(8192), 3072);
        assert_eq!(auto_ram(16384), 6144);
        assert_eq!(auto_ram(65536), 8192);
        assert_eq!(auto_ram(0), 4096);
    }

    #[test]
    fn modo_fps_liga_e_repoe() {
        let d = std::env::temp_dir().join(format!("sleep-fps-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join("config")).unwrap();
        let original = "version:4671\nenableVsync:true\nmaxFps:120\nrenderDistance:16\nsimulationDistance:4\nkey_key.jump:key.keyboard.space\n";
        std::fs::write(d.join("options.txt"), original).unwrap();
        std::fs::write(d.join("config/iris.properties"), "shaderPack=X.zip\nenableShaders=true\n").unwrap();
        apply_fps_mode(&d, true);
        let t = std::fs::read_to_string(d.join("options.txt")).unwrap();
        assert!(t.contains("enableVsync:false") && t.contains("maxFps:260") && t.contains("renderDistance:8") && t.contains("simulationDistance:4") && t.contains("key_key.jump:key.keyboard.space"));
        assert!(std::fs::read_to_string(d.join("config/iris.properties")).unwrap().contains("enableShaders=false"));
        // a pessoa muda uma tecla com o modo ligado: tem de ficar depois de desligar
        std::fs::write(d.join("options.txt"), t.replace("key.keyboard.space", "key.keyboard.j")).unwrap();
        apply_fps_mode(&d, false);
        let t = std::fs::read_to_string(d.join("options.txt")).unwrap();
        assert!(t.contains("enableVsync:true") && t.contains("maxFps:120") && t.contains("renderDistance:16") && t.contains("key.keyboard.j"));
        assert!(std::fs::read_to_string(d.join("config/iris.properties")).unwrap().contains("enableShaders=true"));
        assert!(!d.join(BACKUP).exists());
        let _ = std::fs::remove_dir_all(&d);
    }
}
