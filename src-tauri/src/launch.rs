use crate::mojang::{allowed, classpath};
use serde_json::Value;
use std::path::Path;

fn collect(v: &Value) -> Vec<String> {
    let mut out = vec![];
    for x in v.as_array().cloned().unwrap_or_default() {
        if let Some(s) = x.as_str() {
            out.push(s.to_string());
        } else if allowed(&x["rules"]) {
            match &x["value"] {
                Value::String(s) => out.push(s.clone()),
                Value::Array(a) => out.extend(a.iter().filter_map(|y| y.as_str().map(String::from))),
                _ => {}
            }
        }
    }
    out
}

/// Opções da instância (passo 9B): RAM em MB (0 = padrão) e argumentos extra de Java.
pub struct Opts {
    pub ram_min: u64,
    pub ram_max: u64,
    pub jvm: Vec<String>,
}

/// Devolve (argumentos, versão de Java necessária).
pub fn build(root: &Path, game: &Path, id: &str, user: &str, uuid: &str, token: &str, o: &Opts) -> Result<(Vec<String>, u64), String> {
    let vdir = root.join("versions").join(id);
    let raw = std::fs::read(vdir.join(format!("{id}.json"))).map_err(|_| "instalação incompleta, instala primeiro".to_string())?;
    let vj: Value = serde_json::from_slice(&raw).map_err(|x| x.to_string())?;
    let sep = if cfg!(windows) { ";" } else { ":" };
    let cp = classpath(root, &vj, id).iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>().join(sep);
    let vars = [
        ("auth_player_name", user.to_string()),
        ("version_name", id.to_string()),
        ("game_directory", game.display().to_string()),
        ("assets_root", root.join("assets").display().to_string()),
        ("game_assets", root.join("assets").display().to_string()),
        ("assets_index_name", vj["assetIndex"]["id"].as_str().unwrap_or("").to_string()),
        ("auth_uuid", uuid.to_string()),
        ("auth_access_token", token.to_string()),
        ("auth_session", "0".to_string()),
        ("clientid", "0".to_string()),
        ("auth_xuid", "0".to_string()),
        ("user_type", (if token == "0" { "legacy" } else { "msa" }).to_string()),
        ("user_properties", "{}".to_string()),
        ("version_type", vj["type"].as_str().unwrap_or("release").to_string()),
        ("natives_directory", vdir.join("natives").display().to_string()),
        ("library_directory", root.join("libraries").display().to_string()),
        ("launcher_name", "SleepLauncher".to_string()),
        ("launcher_version", "0.1".to_string()),
        ("classpath", cp),
        ("classpath_separator", sep.to_string()),
    ];
    let sub = |s: &String| -> String {
        let mut o = s.clone();
        for (k, v) in &vars {
            o = o.replace(&format!("${{{k}}}"), v);
        }
        o
    };
    let jvm = if vj["arguments"]["jvm"].is_array() {
        collect(&vj["arguments"]["jvm"])
    } else {
        vec!["-Djava.library.path=${natives_directory}".to_string(), "-cp".to_string(), "${classpath}".to_string()]
    };
    let gm: Vec<String> = if vj["arguments"]["game"].is_array() {
        collect(&vj["arguments"]["game"])
    } else {
        vj["minecraftArguments"].as_str().unwrap_or("").split_whitespace().map(String::from).collect()
    };
    let max = if o.ram_max > 0 { o.ram_max } else { 4096 };
    let major = vj["javaVersion"]["majorVersion"].as_u64().unwrap_or(8);
    let mut args = vec![];
    if o.ram_min > 0 {
        args.push(format!("-Xms{}M", o.ram_min.min(max)));
    }
    args.push(format!("-Xmx{max}M"));
    if o.jvm.is_empty() {
        // argumentos de Java afinados para o Minecraft (menos pausas do lixo da memória = menos quebras de FPS)
        for f in ["-XX:+UseG1GC", "-XX:+ParallelRefProcEnabled", "-XX:MaxGCPauseMillis=200", "-XX:+UnlockExperimentalVMOptions", "-XX:+DisableExplicitGC", "-XX:G1NewSizePercent=30", "-XX:G1MaxNewSizePercent=40", "-XX:G1HeapRegionSize=8M", "-XX:G1ReservePercent=20", "-XX:G1HeapWastePercent=5", "-XX:G1MixedGCCountTarget=4", "-XX:InitiatingHeapOccupancyPercent=15", "-XX:G1MixedGCLiveThresholdPercent=90", "-XX:G1RSetUpdatingPauseTimePercent=5", "-XX:SurvivorRatio=32", "-XX:+PerfDisableSharedMem", "-XX:MaxTenuringThreshold=1"] {
            args.push(f.to_string());
        }
    }
    args.extend(o.jvm.iter().cloned());
    args.extend(jvm.iter().map(|s| sub(s)));
    args.push(vj["mainClass"].as_str().ok_or("versão sem mainClass")?.to_string());
    args.extend(gm.iter().map(|s| sub(s)));

    Ok((args, major))
}
