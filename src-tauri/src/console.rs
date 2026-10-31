//! Consola do jogo em direto (passo 9C): arranca o Java com stdout/stderr ligados,
//! guarda as últimas linhas por instância e deixa a interface lê-las por índice.
use serde_json::{json, Value};
use std::collections::{HashMap, VecDeque};
use std::io::{BufRead, BufReader, Read};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const MAX_LINES: usize = 5000;
const MAX_LINE_LEN: usize = 4000;

#[derive(Default)]
struct Game {
    lines: VecDeque<String>,
    /// quantas linhas já foram produzidas nesta sessão (índice da próxima)
    total: u64,
    running: bool,
    code: Option<i32>,
    child: Option<Child>,
    /// número da sessão: muda a cada arranque
    session: u64,
}

fn games() -> MutexGuard<'static, HashMap<String, Game>> {
    static G: OnceLock<Mutex<HashMap<String, Game>>> = OnceLock::new();
    G.get_or_init(|| Mutex::new(HashMap::new())).lock().unwrap_or_else(|p| p.into_inner())
}

fn push(name: &str, session: u64, line: String) {
    let mut g = games();
    let Some(game) = g.get_mut(name) else { return };
    if game.session != session {
        return;
    }
    let line: String = if line.chars().count() > MAX_LINE_LEN { line.chars().take(MAX_LINE_LEN).collect::<String>() + "…" } else { line };
    game.lines.push_back(line);
    if game.lines.len() > MAX_LINES {
        game.lines.pop_front();
    }
    game.total += 1;
}

/// Lê um pipe linha a linha (tolera UTF-8 inválido) e guarda cada linha.
fn pump<R: Read + Send + 'static>(name: String, session: u64, r: R) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        let mut rd = BufReader::new(r);
        let mut buf = Vec::new();
        loop {
            buf.clear();
            match rd.read_until(b'\n', &mut buf) {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    let s = String::from_utf8_lossy(&buf);
                    push(&name, session, s.trim_end_matches(['\r', '\n']).to_string());
                }
            }
        }
    })
}

pub fn is_running(name: &str) -> bool {
    games().get(name).map_or(false, |g| g.running)
}

/// Arranca o jogo e começa a recolher a saída. Erra se esta instância já estiver a correr.
pub fn start(app: &AppHandle, name: &str, mut cmd: Command) -> Result<(), String> {
    if is_running(name) {
        return Err("O jogo já está a correr nesta instância".into());
    }
    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|x| format!("Não consegui abrir o Java: {x}"))?;
    let (out, err) = (child.stdout.take(), child.stderr.take());
    let session;
    {
        let mut g = games();
        let prev = g.get(name).map_or(0, |x| x.session);
        session = prev + 1;
        let mut game = Game { session, running: true, child: Some(child), ..Default::default() };
        game.lines.push_back("[Sleep] A iniciar o jogo…".to_string());
        game.total = 1;
        g.insert(name.to_string(), game);
    }
    let readers: Vec<_> = [out.map(|o| pump(name.to_string(), session, o)), err.map(|e| pump(name.to_string(), session, e))].into_iter().flatten().collect();
    let _ = app.emit("game-state", json!({"name": name, "running": true, "code": Value::Null}));
    let (app, name) = (app.clone(), name.to_string());
    std::thread::spawn(move || {
        // espera que o processo acabe (sem ficar com o lock, para o stop() conseguir matá-lo)
        let code = loop {
            std::thread::sleep(Duration::from_millis(300));
            let mut g = games();
            let Some(game) = g.get_mut(&name) else { return };
            if game.session != session {
                return;
            }
            let Some(c) = game.child.as_mut() else { break None };
            match c.try_wait() {
                Ok(Some(st)) => {
                    game.child = None;
                    break st.code();
                }
                Ok(None) => {}
                Err(_) => {
                    game.child = None;
                    break None;
                }
            }
        };
        {
            let mut g = games();
            if let Some(game) = g.get_mut(&name) {
                if game.session == session {
                    game.running = false;
                    game.code = code;
                }
            }
        }
        for r in readers {
            let _ = r.join();
        }
        let txt = match code {
            Some(0) => "[Sleep] O jogo terminou normalmente.".to_string(),
            Some(c) => format!("[Sleep] O jogo terminou com o código {c}."),
            None => "[Sleep] O jogo foi terminado.".to_string(),
        };
        push(&name, session, txt);
        let _ = app.emit("game-state", json!({"name": name, "running": false, "code": code}));
        if let Some(c) = code.filter(|c| *c != 0) {
            let _ = app.emit("play-result", format!("O jogo fechou com erro (código {c}). Abre a Consola da instância para ver porquê."));
        }
    });
    Ok(())
}

/// Termina o jogo (se estiver a correr).
pub fn stop(name: &str) -> Result<(), String> {
    {
        let mut g = games();
        let game = g.get_mut(name).ok_or("o jogo não está a correr")?;
        let Some(c) = game.child.as_mut() else { return Err("o jogo não está a correr".into()) };
        c.kill().map_err(|x| x.to_string())?;
    }
    push_current(name, "[Sleep] A parar o jogo…");
    Ok(())
}

fn push_current(name: &str, line: &str) {
    let s = games().get(name).map(|g| g.session);
    if let Some(s) = s {
        push(name, s, line.to_string());
    }
}

/// Apaga as linhas guardadas (a interface limpa o seu ecrã por conta própria).
pub fn clear(name: &str) {
    if let Some(g) = games().get_mut(name) {
        g.lines.clear();
    }
}

/// Devolve as linhas com índice >= `from`. `reset` é verdadeiro quando o pedido já não bate certo
/// (outra sessão, ou linhas antigas já descartadas): a interface recomeça do que vem.
pub fn read(name: &str, from: u64, session: u64) -> Value {
    let g = games();
    let Some(game) = g.get(name) else {
        return json!({"running": false, "code": Value::Null, "session": 0, "size": 0, "lines": [], "reset": from != 0});
    };
    let base = game.total - game.lines.len() as u64;
    let reset = game.session != session || from > game.total || from < base;
    let start = if reset { base } else { from };
    let skip = (start - base) as usize;
    let lines: Vec<&String> = game.lines.iter().skip(skip).collect();
    json!({"running": game.running, "code": game.code, "session": game.session, "size": game.total, "lines": lines, "reset": reset})
}

/// Nomes das instâncias com o jogo a correr.
pub fn running() -> Vec<String> {
    games().iter().filter(|(_, g)| g.running).map(|(k, _)| k.clone()).collect()
}

/// Procura, da linha mais recente para a mais antiga, o último servidor a que o jogo se ligou
/// ("Connecting to host, porta" no log do cliente). Se o jogo abriu depois um mundo de um jogador
/// ("Starting integrated minecraft server"), não há servidor. O log não diz quando se sai de um
/// servidor, por isso isto é "o último a que se ligou": a interface deixa o utilizador confirmar.
pub fn parse_server<'a>(lines: impl DoubleEndedIterator<Item = &'a str>) -> Option<String> {
    const KEY: &str = "Connecting to ";
    for l in lines.rev() {
        if l.contains("Starting integrated minecraft server") {
            return None;
        }
        let Some(i) = l.find(KEY) else { continue };
        let Some((host, port)) = l[i + KEY.len()..].trim().split_once(',') else { continue };
        let (host, port) = (host.trim(), port.trim());
        let ok_host = !host.is_empty()
            && host.len() <= 253
            && host.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-');
        let Ok(port) = port.parse::<u16>() else { continue };
        if !ok_host || port == 0 {
            continue;
        }
        return Some(if port == 25565 { host.to_string() } else { format!("{host}:{port}") });
    }
    None
}

/// Servidor atual de uma instância a correr (ver `parse_server`).
pub fn any_server() -> Option<(String, String)> {
    let g = games();
    for (name, game) in g.iter() {
        if !game.running {
            continue;
        }
        if let Some(a) = parse_server(game.lines.iter().map(|s| s.as_str())) {
            return Some((name.clone(), a));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::parse_server;

    fn p(l: &[&str]) -> Option<String> {
        parse_server(l.iter().copied())
    }

    #[test]
    fn porta_por_omissao_some() {
        assert_eq!(p(&["[12:00:00] [Render thread/INFO]: Connecting to mc.hypixel.net, 25565"]), Some("mc.hypixel.net".into()));
    }

    #[test]
    fn porta_diferente_fica() {
        assert_eq!(p(&["[Render thread/INFO]: Connecting to 192.168.1.5, 25570"]), Some("192.168.1.5:25570".into()));
    }

    #[test]
    fn vale_o_mais_recente() {
        let l = ["Connecting to a.net, 25565", "ruído", "Connecting to b.net, 25565"];
        assert_eq!(p(&l), Some("b.net".into()));
    }

    #[test]
    fn mundo_de_um_jogador_depois_anula() {
        let l = ["Connecting to a.net, 25565", "[Server thread/INFO]: Starting integrated minecraft server version 1.21.11"];
        assert_eq!(p(&l), None);
    }

    #[test]
    fn linhas_estranhas_sao_ignoradas() {
        assert_eq!(p(&["Connecting to , 25565", "Connecting to x y, 25565", "Connecting to a.net, abc", "Connecting to a.net"]), None);
    }
}
