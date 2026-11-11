use base64::{
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
    Engine,
};
use rand::Rng;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

#[allow(dead_code)]
const REDIRECT: &str = "https://login.microsoftonline.com/common/oauth2/nativeclient";
const SCOPE: &str = "XboxLive.signin offline_access";
const AUTH: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const MC: &str = "https://api.minecraftservices.com";
/// Mesmo login do mod (código no microsoft.com/link): usa o client id público do Minecraft, não precisa de aprovação da Mojang.
const LIVE_CID: &str = "00000000441cc96b";
/// Login alternativo (janela da Microsoft dentro da app), para quando o código não resulta.
const WEB_CID: &str = "00000000402b5328";
const WEB_REDIRECT: &str = "https://login.live.com/oauth20_desktop.srf";
const LIVE_SCOPE: &str = "service::user.auth.xboxlive.com::MBI_SSL";

fn e<E: std::fmt::Display>(x: E) -> String {
    x.to_string()
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(e)?.join("account.json"))
}

pub fn load(app: &AppHandle) -> Option<Value> {
    std::fs::read(path(app).ok()?).ok().and_then(|b| serde_json::from_slice(&b).ok())
}

fn accounts_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(e)?.join("accounts"))
}

fn safe_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 40 && id.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

fn save(app: &AppHandle, v: &Value) -> Result<(), String> {
    let p = path(app)?;
    if let Some(d) = p.parent() {
        std::fs::create_dir_all(d).map_err(e)?;
    }
    std::fs::write(p, v.to_string()).map_err(e)?;
    // cópia na lista de contas guardadas (para trocar de conta sem voltar a entrar)
    if let Some(u) = v["uuid"].as_str().filter(|u| safe_id(u)) {
        let d = accounts_dir(app)?;
        std::fs::create_dir_all(&d).map_err(e)?;
        std::fs::write(d.join(format!("{u}.json")), v.to_string()).map_err(e)?;
    }
    Ok(())
}

/// Todas as contas guardadas (só o que a interface pode ver), com a ativa marcada.
pub fn list(app: &AppHandle) -> Vec<Value> {
    let active = load(app).and_then(|a| a["uuid"].as_str().map(String::from));
    let mut out = vec![];
    if let Ok(d) = accounts_dir(app).and_then(|d| std::fs::read_dir(d).map_err(e)) {
        for f in d.flatten() {
            if let Some(a) = std::fs::read(f.path()).ok().and_then(|b| serde_json::from_slice::<Value>(&b).ok()) {
                let mut p = public(&a);
                p["active"] = json!(a["uuid"].as_str().map(String::from) == active);
                out.push(p);
            }
        }
    }
    out
}

/// Passa a usar outra conta guardada.
pub fn switch(app: &AppHandle, uuid: &str) -> Result<Value, String> {
    if !safe_id(uuid) {
        return Err("conta inválida".to_string());
    }
    let b = std::fs::read(accounts_dir(app)?.join(format!("{uuid}.json"))).map_err(|_| "Essa conta já não está guardada".to_string())?;
    let a: Value = serde_json::from_slice(&b).map_err(e)?;
    std::fs::write(path(app)?, a.to_string()).map_err(e)?;
    Ok(public(&a))
}

/// Tira uma conta da lista (se for a ativa, sai dela).
pub fn remove(app: &AppHandle, uuid: &str) -> Result<(), String> {
    if !safe_id(uuid) {
        return Err("conta inválida".to_string());
    }
    let _ = std::fs::remove_file(accounts_dir(app)?.join(format!("{uuid}.json")));
    if load(app).and_then(|a| a["uuid"].as_str().map(String::from)).as_deref() == Some(uuid) {
        logout(app);
    }
    Ok(())
}

pub fn logout(app: &AppHandle) {
    if let Ok(p) = path(app) {
        let _ = std::fs::remove_file(p);
    }
}

/// O que a interface pode ver (nunca os tokens).
pub fn public(a: &Value) -> Value {
    json!({"name": a["name"], "uuid": a["uuid"], "skins": a["skins"], "capes": a["capes"], "offline": a["offline"].as_bool().unwrap_or(false)})
}

/// Erro de login que a interface sabe explicar: "MSERR|código|detalhe" (o detalhe nunca leva tokens).
fn mserr(code: &str, detail: impl std::fmt::Display) -> String {
    let d: String = detail.to_string().chars().filter(|c| *c != '|').take(180).collect();
    format!("MSERR|{code}|{d}")
}

fn http() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().user_agent("SleepLauncher/1.0").connect_timeout(std::time::Duration::from_secs(15)).timeout(std::time::Duration::from_secs(30)).build().map_err(e)
}

fn neterr(step: &str, x: reqwest::Error) -> String {
    mserr("network", format!("{step}: {}", if x.is_timeout() { "timeout" } else if x.is_connect() { "connect" } else { "request" }))
}

/// Código do Xbox (XErr) -> motivo real.
fn xbox_code(x: u64) -> Option<&'static str> {
    Some(match x {
        2148916227 => "banned",
        2148916229 => "restricted",
        2148916233 => "no_xbox",
        2148916234 => "tos",
        2148916235 => "region",
        2148916236 | 2148916237 => "adult_check",
        2148916238 => "child",
        _ => return None,
    })
}

fn xerr(t: &Value, code: u16, step: &str) -> String {
    let x = t["XErr"].as_u64().unwrap_or(0);
    if let Some(c) = xbox_code(x) {
        return mserr(c, format!("{step} HTTP {code} XErr {x}"));
    }
    let m = t["errorMessage"].as_str().or(t["error"].as_str()).or(t["Message"].as_str()).unwrap_or("");
    if m.contains("Invalid app registration") {
        return mserr("app_blocked", format!("{step} HTTP {code}"));
    }
    if code == 429 {
        return mserr("rate", format!("{step} HTTP 429"));
    }
    mserr("server", format!("{step} HTTP {code} {} {m}", if x > 0 { format!("XErr {x}") } else { String::new() }))
}

async fn post(url: &str, body: Value, step: &str) -> Result<Value, String> {
    let r = http()?.post(url).header("Accept", "application/json").json(&body).send().await.map_err(|x| neterr(step, x))?;
    let st = r.status();
    let t: Value = r.json().await.unwrap_or(Value::Null);
    if !st.is_success() {
        return Err(xerr(&t, st.as_u16(), step));
    }
    Ok(t)
}

async fn token(form: &[(&str, &str)]) -> Result<Value, String> {
    let r = reqwest::Client::new().post(format!("{AUTH}/token")).form(form).send().await.map_err(e)?;
    let ok = r.status().is_success();
    let t: Value = r.json().await.map_err(e)?;
    if !ok {
        return Err(t["error_description"].as_str().unwrap_or("falha no login").to_string());
    }
    Ok(t)
}

async fn get_profile(tok: &str) -> Result<Value, String> {
    let c = http()?;
    let r = c.get(format!("{MC}/minecraft/profile")).bearer_auth(tok).send().await.map_err(|x| neterr("profile", x))?;
    let st = r.status().as_u16();
    if st == 404 {
        // comprou o jogo mas nunca criou o nome, ou não tem mesmo o jogo?
        let ent: Value = match c.get(format!("{MC}/entitlements/mcstore")).bearer_auth(tok).send().await {
            Ok(x) => x.json().await.unwrap_or(Value::Null),
            Err(_) => Value::Null,
        };
        let owns = ent["items"].as_array().is_some_and(|i| !i.is_empty());
        return Err(mserr(if owns { "no_profile" } else { "no_game" }, "profile HTTP 404"));
    }
    if st == 429 {
        return Err(mserr("rate", "profile HTTP 429"));
    }
    if !(200..300).contains(&st) {
        return Err(mserr("server", format!("profile HTTP {st}")));
    }
    r.json().await.map_err(e)
}

/// Microsoft -> Xbox Live -> XSTS -> Minecraft. Devolve (token, expira em, perfil).
async fn minecraft(ms: &str, live: bool) -> Result<(String, u64, Value), String> {
    let x = post(
        "https://user.auth.xboxlive.com/user/authenticate",
        json!({"Properties": {"AuthMethod": "RPS", "SiteName": "user.auth.xboxlive.com", "RpsTicket": format!("{}{ms}", if live { "t=" } else { "d=" })},
               "RelyingParty": "http://auth.xboxlive.com", "TokenType": "JWT"}),
        "xbox",
    )
    .await?;
    let xt = x["Token"].as_str().ok_or("sem token Xbox")?.to_string();
    let s = post(
        "https://xsts.auth.xboxlive.com/xsts/authorize",
        json!({"Properties": {"SandboxId": "RETAIL", "UserTokens": [xt]},
               "RelyingParty": "rp://api.minecraftservices.com/", "TokenType": "JWT"}),
        "xsts",
    )
    .await?;
    let st = s["Token"].as_str().ok_or("sem token XSTS")?;
    let uhs = s["DisplayClaims"]["xui"][0]["uhs"].as_str().ok_or("sem uhs")?;
    let m = post(&format!("{MC}/authentication/login_with_xbox"), json!({"identityToken": format!("XBL3.0 x={uhs};{st}")}), "minecraft").await?;
    let tok = m["access_token"].as_str().ok_or("sem token Minecraft")?.to_string();
    let exp = m["expires_in"].as_u64().unwrap_or(3600);
    let prof = get_profile(&tok).await?;
    Ok((tok, now() + exp.saturating_sub(60), prof))
}

async fn finish(app: &AppHandle, t: Value, old_refresh: &str, live: bool, lcid: &str) -> Result<Value, String> {
    let acc = t["access_token"].as_str().ok_or("sem access_token")?.to_string();
    let new_r = t["refresh_token"].as_str().unwrap_or("");
    let refresh = if new_r.is_empty() { old_refresh } else { new_r };
    let (tok, exp, prof) = minecraft(&acc, live).await?;
    let a = json!({"name": prof["name"], "uuid": prof["id"], "skins": prof["skins"], "capes": prof["capes"],
                   "mc_token": tok, "expires": exp, "refresh": refresh, "live": live, "lcid": lcid});
    save(app, &a)?;
    Ok(a)
}

#[allow(dead_code)]
/// Abre a janelinha de login da Microsoft dentro da app e termina a sessão Minecraft.
pub async fn login(app: &AppHandle, cid: &str) -> Result<Value, String> {
    if cid.trim().is_empty() {
        return Err("Falta o client ID em Definições".to_string());
    }
    let verifier = {
        let mut r = rand::thread_rng();
        let b: [u8; 32] = r.gen();
        URL_SAFE_NO_PAD.encode(b)
    };
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let url = reqwest::Url::parse_with_params(
        &format!("{AUTH}/authorize"),
        &[
            ("client_id", cid),
            ("response_type", "code"),
            ("redirect_uri", REDIRECT),
            ("scope", SCOPE),
            ("code_challenge", challenge.as_str()),
            ("code_challenge_method", "S256"),
            ("prompt", "select_account"),
        ],
    )
    .map_err(e)?;
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    let tx2 = tx.clone();
    if let Some(old) = app.get_webview_window("login") {
        let _ = old.close();
    }
    let win = WebviewWindowBuilder::new(app, "login", WebviewUrl::External(url))
        .title("Entrar com Microsoft")
        .inner_size(480.0, 660.0)
        .center()
        .on_navigation(move |u| {
            if u.as_str().starts_with(REDIRECT) {
                let q: std::collections::HashMap<String, String> = u.query_pairs().into_owned().collect();
                let msg = match q.get("code") {
                    Some(c) => c.clone(),
                    None => format!("!{}", q.get("error_description").cloned().unwrap_or_else(|| "login cancelado".to_string())),
                };
                let _ = tx.send(msg);
                false
            } else {
                true
            }
        })
        .build()
        .map_err(e)?;
    win.on_window_event(move |ev| {
        if let WindowEvent::Destroyed = ev {
            let _ = tx2.send(String::new());
        }
    });
    let code = tokio::time::timeout(std::time::Duration::from_secs(600), rx.recv())
        .await
        .map_err(|_| "tempo esgotado".to_string())?
        .unwrap_or_default();
    let _ = win.close();
    if code.is_empty() {
        return Err("Login cancelado".to_string());
    }
    if let Some(er) = code.strip_prefix('!') {
        return Err(er.to_string());
    }
    let t = token(&[
        ("client_id", cid),
        ("grant_type", "authorization_code"),
        ("code", code.as_str()),
        ("redirect_uri", REDIRECT),
        ("code_verifier", verifier.as_str()),
        ("scope", SCOPE),
    ])
    .await?;
    finish(app, t, "", false, "").await
}

fn trip(a: &Value) -> Option<(String, String, String)> {
    Some((a["name"].as_str()?.to_string(), a["uuid"].as_str()?.to_string(), a["mc_token"].as_str()?.to_string()))
}

/// (nome, uuid, token) válidos; renova com o refresh token se o token do Minecraft expirou.
pub async fn session(app: &AppHandle, cid: &str) -> Option<(String, String, String)> {
    session_within(app, cid, 0).await
}

/// Renova a sessão em segundo plano quando faltam menos de 2 horas para expirar: assim Jogar nunca fica à espera da Microsoft.
pub async fn keep_fresh(app: &AppHandle, cid: &str) {
    let _ = session_within(app, cid, 7200).await;
}

/// Só uma renovação de cada vez (a de Jogar e a de segundo plano usavam o mesmo refresh token).
static REFRESH_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// Como `session`, mas renova já se o token expirar dentro de `margin` segundos.
async fn session_within(app: &AppHandle, cid: &str, margin: u64) -> Option<(String, String, String)> {
    let a = load(app)?;
    if a["offline"].as_bool() == Some(true) {
        return Some((a["name"].as_str()?.to_string(), a["uuid"].as_str()?.to_string(), "0".to_string()));
    }
    if a["expires"].as_u64().unwrap_or(0) > now() + margin {
        return trip(&a);
    }
    let _g = REFRESH_LOCK.lock().await;
    // outra renovação pode ter acabado enquanto esta esperava
    let a = load(app)?;
    if a["expires"].as_u64().unwrap_or(0) > now() + margin {
        return trip(&a);
    }
    let r = a["refresh"].as_str()?.to_string();
    if a["live"].as_bool() == Some(true) {
        let lc = a["lcid"].as_str().unwrap_or(LIVE_CID).to_string();
        let lc = lc.as_str();
        let t = live_token(&[("client_id", lc), ("grant_type", "refresh_token"), ("refresh_token", r.as_str()), ("scope", LIVE_SCOPE)]).await.ok()?;
        t["access_token"].as_str()?;
        return trip(&finish(app, t, &r, true, lc).await.ok()?);
    }
    let t = token(&[("client_id", cid), ("grant_type", "refresh_token"), ("refresh_token", r.as_str()), ("scope", SCOPE)]).await.ok()?;
    trip(&finish(app, t, &r, false, "").await.ok()?)
}

async fn tok(app: &AppHandle, cid: &str) -> Result<String, String> {
    session(app, cid).await.map(|s| s.2).ok_or_else(|| "Entra primeiro com a tua conta Microsoft".to_string())
}

async fn refresh_profile(app: &AppHandle, tk: &str) -> Result<Value, String> {
    let p = get_profile(tk).await?;
    let mut a = load(app).ok_or("sem conta")?;
    a["skins"] = p["skins"].clone();
    a["capes"] = p["capes"].clone();
    save(app, &a)?;
    Ok(public(&a))
}

pub async fn change_skin(app: &AppHandle, cid: &str, variant: &str, b64: &str) -> Result<Value, String> {
    let tk = tok(app, cid).await?;
    let bytes = STANDARD.decode(b64).map_err(e)?;
    let v = if variant == "slim" { "slim" } else { "classic" };
    let form = reqwest::multipart::Form::new()
        .text("variant", v)
        .part("file", reqwest::multipart::Part::bytes(bytes).file_name("skin.png").mime_str("image/png").map_err(e)?);
    let r = reqwest::Client::new().post(format!("{MC}/minecraft/profile/skins")).bearer_auth(&tk).multipart(form).send().await.map_err(e)?;
    if !r.status().is_success() {
        return Err(format!("A skin foi recusada ({})", r.status()));
    }
    refresh_profile(app, &tk).await
}

pub async fn set_cape(app: &AppHandle, cid: &str, id: Option<String>) -> Result<Value, String> {
    let tk = tok(app, cid).await?;
    let c = reqwest::Client::new();
    let url = format!("{MC}/minecraft/profile/capes/active");
    let r = match id {
        Some(i) => c.put(&url).bearer_auth(&tk).json(&json!({"capeId": i})).send().await,
        None => c.delete(&url).bearer_auth(&tk).send().await,
    }
    .map_err(e)?;
    if !r.status().is_success() {
        return Err(format!("A capa foi recusada ({})", r.status()));
    }
    refresh_profile(app, &tk).await
}

async fn live_token(form: &[(&str, &str)]) -> Result<Value, String> {
    let r = http()?.post("https://login.live.com/oauth20_token.srf").form(form).send().await.map_err(|x| neterr("token", x))?;
    r.json().await.map_err(|_| mserr("server", "token: resposta inválida"))
}

/// Login Microsoft por código: a interface mostra o código e o endereço (evento "ms-code") e isto espera até a pessoa entrar.
pub async fn login_device(app: &AppHandle) -> Result<Value, String> {
    let r = reqwest::Client::new()
        .post("https://login.live.com/oauth20_connect.srf")
        .form(&[("client_id", LIVE_CID), ("scope", LIVE_SCOPE), ("response_type", "device_code")])
        .send()
        .await
        .map_err(e)?;
    let d: Value = r.json().await.map_err(e)?;
    let dc = d["device_code"].as_str().ok_or("A Microsoft não deu o código de entrada")?.to_string();
    let code = d["user_code"].as_str().unwrap_or("").to_string();
    let url = d["verification_uri"].as_str().unwrap_or("https://www.microsoft.com/link").to_string();
    let every = d["interval"].as_u64().unwrap_or(5).max(2);
    let end = now() + d["expires_in"].as_u64().unwrap_or(900);
    let _ = app.emit("ms-code", json!({"code": code, "url": url}));
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(every)).await;
        if now() > end {
            return Err("Tempo esgotado: tenta outra vez".to_string());
        }
        let t = live_token(&[("client_id", LIVE_CID), ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"), ("device_code", dc.as_str())]).await?;
        if t["access_token"].is_string() {
            return finish(app, t, "", true, LIVE_CID).await;
        }
        match t["error"].as_str() {
            Some("authorization_pending") | Some("slow_down") | None => continue,
            Some(_) => return Err("DEVICE_FAIL".to_string()),
        }
    }
}

/// Login pela janela da Microsoft (sem código): abre o login normal dentro da app e acaba sozinho quando entras.
pub async fn login_web(app: &AppHandle) -> Result<Value, String> {
    let url = reqwest::Url::parse_with_params(
        "https://login.live.com/oauth20_authorize.srf",
        &[("client_id", WEB_CID), ("response_type", "code"), ("redirect_uri", WEB_REDIRECT), ("scope", LIVE_SCOPE), ("prompt", "select_account")],
    )
    .map_err(e)?;
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    let tx2 = tx.clone();
    // cada tentativa usa um nome novo (no Windows fechar a janela antiga demora e o nome ficava ocupado)
    static N: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
    for (l, w) in app.webview_windows() {
        if l.starts_with("login") {
            let _ = w.destroy();
        }
    }
    let label = format!("login{}", N.fetch_add(1, std::sync::atomic::Ordering::Relaxed));
    let win = WebviewWindowBuilder::new(app, label.as_str(), WebviewUrl::External(url))
        .title("Sign in with Microsoft")
        .inner_size(480.0, 660.0)
        .center()
        .on_navigation(move |u| {
            if u.as_str().starts_with(WEB_REDIRECT) {
                let q: std::collections::HashMap<String, String> = u.query_pairs().into_owned().collect();
                let _ = tx.send(q.get("code").cloned().unwrap_or_else(|| format!("!{}", q.get("error").map(String::as_str).unwrap_or("sem código"))));
                false
            } else {
                true
            }
        })
        .build()
        .map_err(|x| mserr("window", x))?;
    win.on_window_event(move |ev| {
        if let WindowEvent::Destroyed = ev {
            let _ = tx2.send(String::new());
        }
    });
    let code = tokio::time::timeout(std::time::Duration::from_secs(600), rx.recv()).await.map_err(|_| mserr("timeout", "10 min"))?.unwrap_or_default();
    let _ = win.destroy();
    if code.is_empty() {
        return Err(mserr("cancelled", ""));
    }
    if let Some(x) = code.strip_prefix('!') {
        return Err(if x == "access_denied" { mserr("cancelled", x) } else { mserr("denied", x) });
    }
    let t = live_token(&[("client_id", WEB_CID), ("grant_type", "authorization_code"), ("code", code.as_str()), ("redirect_uri", WEB_REDIRECT), ("scope", LIVE_SCOPE)]).await?;
    if !t["access_token"].is_string() {
        return Err(mserr("token", t["error"].as_str().unwrap_or("sem access_token")));
    }
    finish(app, t, "", true, WEB_CID).await
}

/// UUID das contas offline (igual ao do Minecraft: MD5 de "OfflinePlayer:nome", versão 3).
fn offline_uuid(name: &str) -> String {
    let mut b = md5::compute(format!("OfflinePlayer:{name}")).0;
    b[6] = (b[6] & 0x0f) | 0x30;
    b[8] = (b[8] & 0x3f) | 0x80;
    let h: String = b.iter().map(|x| format!("{x:02x}")).collect();
    format!("{}-{}-{}-{}-{}", &h[0..8], &h[8..12], &h[12..16], &h[16..20], &h[20..32])
}

/// Conta "cracked": só um nome. Só funciona em servidores em modo offline.
pub fn offline_login(app: &AppHandle, name: &str) -> Result<Value, String> {
    let n = name.trim();
    if n.len() < 3 || n.len() > 16 || !n.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err("O nome tem de ter 3 a 16 letras, números ou _".to_string());
    }
    let a = json!({"name": n, "uuid": offline_uuid(n), "skins": [], "capes": [], "offline": true});
    save(app, &a)?;
    Ok(public(&a))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    #[test]
    fn cada_erro_xbox_tem_o_seu_motivo() {
        let c = |x: u64| super::xerr(&json!({"XErr": x}), 401, "xsts");
        assert!(c(2148916233).starts_with("MSERR|no_xbox|"));
        assert!(c(2148916238).starts_with("MSERR|child|"));
        assert!(c(2148916235).starts_with("MSERR|region|"));
        assert!(c(2148916229).starts_with("MSERR|restricted|"));
        assert!(c(2148916227).starts_with("MSERR|banned|"));
        assert!(super::xerr(&json!({"errorMessage": "Invalid app registration"}), 403, "minecraft").starts_with("MSERR|app_blocked|"));
        assert!(super::xerr(&json!({}), 429, "minecraft").starts_with("MSERR|rate|"));
        assert!(super::xerr(&json!({}), 500, "xbox").starts_with("MSERR|server|"));
    }

    #[test]
    fn uuid_offline_igual_ao_do_minecraft() {
        assert_eq!(super::offline_uuid("Notch"), "b50ad385-829d-3141-a216-7e7d7539ba7f");
    }
}
