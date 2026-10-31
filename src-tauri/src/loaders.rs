//! Forge e NeoForge (passo 9C): descarrega o instalador oficial, corre-o em modo cliente
//! na pasta partilhada (versions/libraries) e devolve o json que ele criou.
//! O perfil fica depois fundido com o vanilla em main.rs (fabric::merge).
use crate::mojang::fetch_json;
use serde_json::{json, Value};
use std::path::Path;
use tauri::{AppHandle, Emitter};

fn e<E: std::fmt::Display>(x: E) -> String {
    x.to_string()
}

/// Versão do Minecraft → início da versão do NeoForge.
/// "1.21.1" → "21.1." · "1.21" → "21.0." · "26.1" → "26.1.0." · "26.1.2" → "26.1.2."
pub fn neo_prefix(mc: &str) -> Option<String> {
    let n: Vec<u32> = mc.split('.').map(|x| x.parse::<u32>().ok()).collect::<Option<Vec<_>>>()?;
    match n.as_slice() {
        [1, a] => Some(format!("{a}.0.")),
        [1, a, b] => Some(format!("{a}.{b}.")),
        [m, a] if *m >= 26 => Some(format!("{m}.{a}.0.")),
        [m, a, b] if *m >= 26 => Some(format!("{m}.{a}.{b}.")),
        _ => None,
    }
}

/// Chave de ordenação de uma versão ("21.1.172" ou "26.1.0.1-beta"): só a parte numérica.
fn vkey(v: &str) -> Vec<u32> {
    v.split('-').next().unwrap_or("").split('.').map(|x| x.parse().unwrap_or(0)).collect()
}

/// A melhor versão da lista que começa por `prefix`: a estável mais recente; se só houver betas, a beta mais recente.
pub fn pick_neo(all: &[String], prefix: &str) -> Option<String> {
    let mut m: Vec<&String> = all.iter().filter(|v| v.starts_with(prefix)).collect();
    m.sort_by_key(|v| vkey(v));
    m.iter().rev().find(|v| !v.contains('-')).or(m.last()).map(|v| v.to_string())
}

/// (url do instalador, versão do loader, nome para mostrar)
async fn resolve(mc: &str, neo: bool) -> Result<(String, String, &'static str), String> {
    if neo {
        let prefix = neo_prefix(mc).ok_or("o NeoForge não suporta esta versão do Minecraft")?;
        let r = fetch_json("https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge").await?;
        let all: Vec<String> = r["versions"].as_array().cloned().unwrap_or_default().iter().filter_map(|x| x.as_str().map(String::from)).collect();
        let v = pick_neo(&all, &prefix).ok_or(format!("O NeoForge ainda não tem versão para o {mc}"))?;
        let url = format!("https://maven.neoforged.net/releases/net/neoforged/neoforge/{v}/neoforge-{v}-installer.jar");
        Ok((url, v, "NeoForge"))
    } else {
        // o instalador do Forge só é usado de forma fiável a partir do 1.12
        let minor = mc.split('.').nth(1).and_then(|x| x.parse::<u32>().ok()).unwrap_or(0);
        if mc.starts_with("1.") && minor < 12 {
            return Err("o Forge só é suportado a partir do Minecraft 1.12".into());
        }
        let r = fetch_json("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json").await?;
        let v = r["promos"][format!("{mc}-recommended")]
            .as_str()
            .or_else(|| r["promos"][format!("{mc}-latest")].as_str())
            .ok_or(format!("O Forge ainda não tem versão para o {mc}"))?
            .to_string();
        let url = format!("https://maven.minecraftforge.net/net/minecraftforge/forge/{mc}-{v}/forge-{mc}-{v}-installer.jar");
        Ok((url, v, "Forge"))
    }
}

/// Procura em versions/ o perfil que o instalador criou: tem inheritsFrom = mc e o nome contém a versão do loader.
fn find_profile(shared: &Path, mc: &str, lv: &str) -> Option<(String, Value)> {
    for en in std::fs::read_dir(shared.join("versions")).ok()?.flatten() {
        let id = en.file_name().to_string_lossy().to_string();
        if !id.contains(lv) {
            continue;
        }
        let Ok(raw) = std::fs::read(en.path().join(format!("{id}.json"))) else { continue };
        let Ok(v) = serde_json::from_slice::<Value>(&raw) else { continue };
        if v["inheritsFrom"].as_str() == Some(mc) {
            return Some((id, v));
        }
    }
    None
}

fn hide(c: &mut std::process::Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x08000000);
    }
    #[cfg(not(windows))]
    let _ = c;
}

/// Instala o Forge/NeoForge para `mc` (o vanilla já tem de estar instalado em `shared`).
/// Devolve (id do perfil, json do perfil tal como o instalador o escreveu: ainda com inheritsFrom).
pub async fn install(app: &AppHandle, root: &Path, shared: &Path, mc: &str, neo: bool, java_major: u64) -> Result<(String, Value), String> {
    let (url, lv, nome) = resolve(mc, neo).await?;
    let stage = format!("Instalador do {nome}");
    let progress = |d: u32| {
        let _ = app.emit("progress", json!({"stage": stage, "done": d, "total": 2}));
    };
    progress(0);
    let bytes = reqwest::get(&url).await.map_err(e)?.error_for_status().map_err(e)?.bytes().await.map_err(e)?;
    if bytes.len() < 1000 || &bytes[..2] != b"PK" {
        return Err(format!("o instalador do {nome} veio inválido"));
    }
    let tmp = root.join("tmp");
    std::fs::create_dir_all(&tmp).map_err(e)?;
    let jar = tmp.join(format!("{}-{lv}-installer.jar", nome.to_lowercase()));
    std::fs::write(&jar, &bytes).map_err(e)?;
    std::fs::create_dir_all(shared).map_err(e)?;
    // o instalador exige um launcher_profiles.json na pasta de destino
    let lp = shared.join("launcher_profiles.json");
    if !lp.exists() {
        std::fs::write(&lp, r#"{"profiles":{},"version":3}"#).map_err(e)?;
    }
    let java = crate::java::ensure(app, root, java_major).await?;
    progress(1);
    let (jar2, shared2, java2) = (jar.clone(), shared.to_path_buf(), java);
    let out = tokio::task::spawn_blocking(move || {
        let mut c = std::process::Command::new(java2);
        c.arg("-jar").arg(&jar2).arg("--installClient").arg(&shared2).current_dir(&shared2);
        hide(&mut c);
        c.output()
    })
    .await
    .map_err(e)?
    .map_err(|x| format!("Não consegui abrir o Java: {x}"))?;
    let _ = std::fs::remove_file(&jar);
    if !out.status.success() {
        let txt = format!("{}\n{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
        let tail: Vec<&str> = txt.lines().filter(|l| !l.trim().is_empty()).rev().take(6).collect();
        let tail: Vec<&str> = tail.into_iter().rev().collect();
        return Err(format!("O instalador do {nome} falhou: {}", tail.join(" | ")));
    }
    progress(2);
    find_profile(shared, mc, &lv).ok_or(format!("O {nome} instalou-se mas não encontrei o perfil criado"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefixos() {
        assert_eq!(neo_prefix("1.21.1").as_deref(), Some("21.1."));
        assert_eq!(neo_prefix("1.21").as_deref(), Some("21.0."));
        assert_eq!(neo_prefix("1.20.4").as_deref(), Some("20.4."));
        assert_eq!(neo_prefix("26.1").as_deref(), Some("26.1.0."));
        assert_eq!(neo_prefix("26.1.2").as_deref(), Some("26.1.2."));
        assert_eq!(neo_prefix("24w14a"), None);
    }

    #[test]
    fn escolha() {
        let v: Vec<String> = ["21.1.9", "21.1.172", "21.1.200-beta", "21.11.3", "21.1.17"].iter().map(|x| x.to_string()).collect();
        assert_eq!(pick_neo(&v, "21.1.").as_deref(), Some("21.1.172"));
        let b: Vec<String> = ["26.1.0.2-beta", "26.1.0.10-beta"].iter().map(|x| x.to_string()).collect();
        assert_eq!(pick_neo(&b, "26.1.0.").as_deref(), Some("26.1.0.10-beta"));
        assert_eq!(pick_neo(&v, "20.4."), None);
    }
}
