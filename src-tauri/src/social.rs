//! Ligação ao backend de amigos e chat (o mesmo que o mod do client usa).
//! O login é igual ao do mod: POST /auth/minecraft com o token Minecraft.
//! O token Minecraft e o token de sessão do backend ficam só aqui, em Rust.
//! A interface só vê o utilizador e as respostas dos pedidos.
use serde_json::{json, Value};
use std::time::Duration;
use tauri::{AppHandle, Manager};

/// Backend do mod (SolarApi.DEFAULT_BASE). Fixo de propósito: assim nenhum ficheiro
/// de definições consegue mandar o token Minecraft para outro servidor.
pub const BASE: &str = "https://pal-connect-plaza.lovable.app/api/public/gc";

/// Só estes caminhos podem ser pedidos pela interface.
const ALLOWED: [&str; 12] = [
    "/auth/get-session",
    "/friends",
    "/messages",
    "/me/",
    "/notifications",
    "/groups",
    "/issue-token",
    "/players/lookup",
    "/wallet",
    "/shop",
    "/wardrobe",
    "/capes",
];

fn e<E: std::fmt::Display>(x: E) -> String {
    x.to_string()
}

fn file(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(e)?.join("social.json"))
}

fn load(app: &AppHandle) -> Option<String> {
    let b = std::fs::read(file(app).ok()?).ok()?;
    let v: Value = serde_json::from_slice(&b).ok()?;
    v["token"].as_str().filter(|s| !s.is_empty()).map(String::from)
}

fn save(app: &AppHandle, token: &str) -> Result<(), String> {
    let f = file(app)?;
    if let Some(d) = f.parent() {
        std::fs::create_dir_all(d).map_err(e)?;
    }
    std::fs::write(f, json!({ "token": token }).to_string()).map_err(e)
}

/// Esquece a sessão do backend (não mexe na conta Microsoft).
pub fn logout(app: &AppHandle) {
    if let Ok(f) = file(app) {
        let _ = std::fs::remove_file(f);
    }
}

fn client(secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(secs))
        .user_agent("SleepLauncher/0.1")
        .build()
        .map_err(e)
}

fn msg(st: u16, v: &Value) -> String {
    v["message"]
        .as_str()
        .or_else(|| v["statusMessage"].as_str())
        .or_else(|| v["error"].as_str())
        .map(String::from)
        .unwrap_or_else(|| format!("HTTP {st}"))
}

async fn call(app: &AppHandle, key: &str, method: &str, path: &str, body: Option<Value>, auth: bool) -> Result<Value, String> {
    let m = reqwest::Method::from_bytes(method.as_bytes()).map_err(e)?;
    // o envio de uma skin leva mais tempo (como no mod: 30 s)
    let secs = if method == "POST" && path == "/capes" { 30 } else { 15 };
    let mut rb = client(secs)?.request(m, format!("{BASE}{path}")).header("Accept", "application/json");
    if !key.is_empty() {
        rb = rb.header("X-Client-Key", key);
    }
    if auth {
        let t = load(app).ok_or_else(|| "SESSION_EXPIRED".to_string())?;
        rb = rb.bearer_auth(t);
    }
    if let Some(b) = body {
        rb = rb.json(&b);
    }
    let r = rb.send().await.map_err(|_| "Sem ligação ao servidor de amigos".to_string())?;
    let st = r.status().as_u16();
    let txt = r.text().await.map_err(e)?;
    let v: Value = serde_json::from_str(&txt).unwrap_or(Value::Null);
    if st == 401 && auth {
        logout(app);
        return Err("SESSION_EXPIRED".into());
    }
    if st == 403 && msg(st, &v).to_lowercase().contains("client key") {
        return Err("Chave do cliente inválida (vê Definições)".into());
    }
    if !(200..300).contains(&st) {
        return Err(msg(st, &v));
    }
    Ok(v)
}

fn okpath(p: &str) -> bool {
    p.starts_with('/')
        && !p.contains("..")
        && !p.contains("//")
        && !p.contains('\\')
        && !p.contains('@')
        && !p.chars().any(|c| c.is_whitespace())
        && ALLOWED.iter().any(|a| p.starts_with(*a))
}

/// Pedido genérico vindo da interface (já autenticado com a sessão guardada).
pub async fn request(app: &AppHandle, key: &str, method: &str, path: &str, body: Option<Value>) -> Result<Value, String> {
    let m = method.to_uppercase();
    if !["GET", "POST", "PATCH", "PUT", "DELETE"].contains(&m.as_str()) {
        return Err("método não permitido".into());
    }
    if !okpath(path) {
        return Err("caminho não permitido".into());
    }
    call(app, key, &m, path, body, true).await
}

/// Login igual ao do mod. Devolve o utilizador do backend (nunca tokens).
pub async fn login(app: &AppHandle, key: &str, cid: &str) -> Result<Value, String> {
    let need = "Entra com a tua conta Microsoft (página Personagem) para usar amigos e chat";
    let (name, uuid, mc) = crate::auth::session(app, cid).await.ok_or_else(|| need.to_string())?;
    let offline = mc == "0";
    // 1. sessão guardada ainda válida e da mesma conta Minecraft?
    if load(app).is_some() {
        match call(app, key, "GET", "/auth/get-session", None, true).await {
            Ok(v) => {
                let u = v["user"].clone();
                let same = u["mcUsername"].as_str().map(|n| n.eq_ignore_ascii_case(&name)).unwrap_or(true);
                if u.is_object() && same {
                    return Ok(u);
                }
                logout(app);
            }
            Err(x) if x == "SESSION_EXPIRED" => {}
            Err(x) if x.starts_with("Sem ligação") => return Err(x),
            Err(_) => logout(app),
        }
    }
    // 2. login novo: o mesmo corpo que o mod envia
    if offline {
        let v = call(app, key, "POST", "/auth/offline", Some(json!({"username": name})), false).await?;
        let tok = v["session"]["token"].as_str().ok_or_else(|| "resposta de login inválida".to_string())?;
        save(app, tok)?;
        return Ok(v["user"].clone());
    }
    let body = json!({
        "token": mc,
        "accessToken": mc,
        "username": name,
        "uuid": uuid.replace('-', "")
    });
    let v = call(app, key, "POST", "/auth/minecraft", Some(body), false).await?;
    let tok = v["session"]["token"].as_str().ok_or_else(|| "resposta de login inválida".to_string())?;
    save(app, tok)?;
    Ok(v["user"].clone())
}

#[cfg(test)]
mod tests {
    use super::okpath;

    #[test]
    fn caminhos_da_loja_e_capas() {
        for p in [
            "/wallet",
            "/shop?category=All",
            "/shop/buy",
            "/wardrobe/equip",
            "/wardrobe/equip/Capes",
            "/capes",
            "/capes/active",
            "/capes/12",
        ] {
            assert!(okpath(p), "devia deixar passar {p}");
        }
    }

    #[test]
    fn caminhos_perigosos_ou_desconhecidos() {
        for p in [
            "/capes/../auth/minecraft",
            "//shop",
            "/shop@evil.com",
            "/shop buy",
            "/admin",
            "/dev/coins",
            "shop",
        ] {
            assert!(!okpath(p), "devia bloquear {p}");
        }
    }
}
