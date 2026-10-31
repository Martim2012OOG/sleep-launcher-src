//! Separadores da instância (passo 9B): mundos, capturas, logs e servers.dat.
//! Tudo trabalha só dentro da pasta `game` da instância.
use base64::Engine;
use serde_json::{json, Value};
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

fn e<E: std::fmt::Display>(x: E) -> String {
    x.to_string()
}

/// Um único nome de ficheiro ou pasta, sem separadores nem "..".
fn safe(n: &str) -> Result<&str, String> {
    if n.is_empty() || n == "." || n == ".." || n.contains('/') || n.contains('\\') || n.contains('\0') {
        return Err("nome inválido".into());
    }
    Ok(n)
}

fn dsize(p: &Path) -> u64 {
    let mut t = 0;
    if let Ok(rd) = std::fs::read_dir(p) {
        for en in rd.flatten() {
            if let Ok(m) = en.metadata() {
                if m.is_dir() {
                    t += dsize(&en.path());
                } else {
                    t += m.len();
                }
            }
        }
    }
    t
}

fn mtime(m: &std::fs::Metadata) -> u64 {
    m.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

// ---------- mundos ----------

pub fn worlds(game: &Path) -> Vec<Value> {
    let mut out = vec![];
    if let Ok(rd) = std::fs::read_dir(game.join("saves")) {
        for en in rd.flatten() {
            let Ok(m) = en.metadata() else { continue };
            if !m.is_dir() {
                continue;
            }
            let p = en.path();
            let when = std::fs::metadata(p.join("level.dat")).map(|x| mtime(&x)).unwrap_or_else(|_| mtime(&m));
            out.push(json!({"folder": en.file_name().to_string_lossy(), "size": dsize(&p), "modified": when}));
        }
    }
    out.sort_by(|a, b| b["modified"].as_u64().cmp(&a["modified"].as_u64()));
    out
}

pub fn delete_world(game: &Path, w: &str) -> Result<(), String> {
    let p = game.join("saves").join(safe(w)?);
    if !p.is_dir() {
        return Err("mundo não encontrado".into());
    }
    std::fs::remove_dir_all(p).map_err(e)
}

// ---------- capturas ----------

fn is_img(n: &str) -> bool {
    let l = n.to_lowercase();
    l.ends_with(".png") || l.ends_with(".jpg") || l.ends_with(".jpeg")
}

pub fn shots(game: &Path) -> Vec<Value> {
    let mut v: Vec<(u64, String)> = vec![];
    if let Ok(rd) = std::fs::read_dir(game.join("screenshots")) {
        for en in rd.flatten() {
            let n = en.file_name().to_string_lossy().to_string();
            if let Ok(m) = en.metadata() {
                if m.is_file() && is_img(&n) {
                    v.push((mtime(&m), n));
                }
            }
        }
    }
    v.sort_by(|a, b| b.0.cmp(&a.0));
    v.into_iter().take(60).map(|(t, n)| json!({"file": n, "modified": t})).collect()
}

/// Devolve a imagem como data URL (a interface reduz-a antes de a guardar).
pub fn read_shot(game: &Path, f: &str) -> Result<String, String> {
    let f = safe(f)?;
    if !is_img(f) {
        return Err("ficheiro não permitido".into());
    }
    let p = game.join("screenshots").join(f);
    let len = std::fs::metadata(&p).map_err(e)?.len();
    if len > 20_000_000 {
        return Err("imagem demasiado grande".into());
    }
    let bytes = std::fs::read(&p).map_err(e)?;
    let mime = if f.to_lowercase().ends_with(".png") { "image/png" } else { "image/jpeg" };
    Ok(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

pub fn delete_shot(game: &Path, f: &str) -> Result<(), String> {
    let f = safe(f)?;
    if !is_img(f) {
        return Err("ficheiro não permitido".into());
    }
    std::fs::remove_file(game.join("screenshots").join(f)).map_err(e)
}

// ---------- logs ----------

/// Lê latest.log a partir de `from`. Na primeira leitura (from = 0) ou se o ficheiro
/// recomeçou, devolve só o fim (200 KB) e `reset: true`.
pub fn read_log(game: &Path, from: u64) -> Result<Value, String> {
    let p = game.join("logs").join("latest.log");
    let Ok(mut f) = std::fs::File::open(&p) else {
        return Ok(json!({"size": 0, "text": "", "reset": true}));
    };
    let size = f.metadata().map_err(e)?.len();
    let reset = from == 0 || from > size;
    let start = if reset { size.saturating_sub(200_000) } else { from };
    f.seek(SeekFrom::Start(start)).map_err(e)?;
    let mut buf = vec![];
    f.take(size - start).read_to_end(&mut buf).map_err(e)?;
    Ok(json!({"size": size, "text": String::from_utf8_lossy(&buf), "reset": reset}))
}

// ---------- servers.dat (NBT sem compressão) ----------

#[derive(Clone)]
enum Tag {
    Byte(i8),
    Short(i16),
    Int(i32),
    Long(i64),
    Float(f32),
    Double(f64),
    Bytes(Vec<u8>),
    Str(String),
    List(u8, Vec<Tag>),
    Comp(Vec<(String, Tag)>),
    Ints(Vec<i32>),
    Longs(Vec<i64>),
}

struct R<'a> {
    b: &'a [u8],
    p: usize,
}

impl<'a> R<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        if n > self.b.len() - self.p {
            return Err("servers.dat corrompido".into());
        }
        let s = &self.b[self.p..self.p + n];
        self.p += n;
        Ok(s)
    }
    fn u8(&mut self) -> Result<u8, String> {
        Ok(self.take(1)?[0])
    }
    fn u16(&mut self) -> Result<u16, String> {
        Ok(u16::from_be_bytes(self.take(2)?.try_into().map_err(e)?))
    }
    fn i32(&mut self) -> Result<i32, String> {
        Ok(i32::from_be_bytes(self.take(4)?.try_into().map_err(e)?))
    }
    fn i64(&mut self) -> Result<i64, String> {
        Ok(i64::from_be_bytes(self.take(8)?.try_into().map_err(e)?))
    }
    fn len(&mut self) -> Result<usize, String> {
        let n = self.i32()?;
        if n < 0 || n > 1_000_000 {
            return Err("servers.dat corrompido".into());
        }
        Ok(n as usize)
    }
    fn s(&mut self) -> Result<String, String> {
        let n = self.u16()? as usize;
        Ok(String::from_utf8_lossy(self.take(n)?).to_string())
    }
    fn tag(&mut self, t: u8, depth: u32) -> Result<Tag, String> {
        if depth > 32 {
            return Err("servers.dat corrompido".into());
        }
        Ok(match t {
            1 => Tag::Byte(self.u8()? as i8),
            2 => Tag::Short(self.u16()? as i16),
            3 => Tag::Int(self.i32()?),
            4 => Tag::Long(self.i64()?),
            5 => Tag::Float(f32::from_bits(self.i32()? as u32)),
            6 => Tag::Double(f64::from_bits(self.i64()? as u64)),
            7 => {
                let n = self.len()?;
                Tag::Bytes(self.take(n)?.to_vec())
            }
            8 => Tag::Str(self.s()?),
            9 => {
                let it = self.u8()?;
                let n = self.len()?;
                let mut v = vec![];
                for _ in 0..n {
                    v.push(self.tag(it, depth + 1)?);
                }
                Tag::List(it, v)
            }
            10 => {
                let mut v = vec![];
                loop {
                    let t = self.u8()?;
                    if t == 0 {
                        break;
                    }
                    let k = self.s()?;
                    v.push((k, self.tag(t, depth + 1)?));
                }
                Tag::Comp(v)
            }
            11 => {
                let n = self.len()?;
                let mut v = vec![];
                for _ in 0..n {
                    v.push(self.i32()?);
                }
                Tag::Ints(v)
            }
            12 => {
                let n = self.len()?;
                let mut v = vec![];
                for _ in 0..n {
                    v.push(self.i64()?);
                }
                Tag::Longs(v)
            }
            _ => return Err("servers.dat corrompido".into()),
        })
    }
}

fn put_s(o: &mut Vec<u8>, s: &str) {
    let b = s.as_bytes();
    let n = b.len().min(65535);
    o.extend_from_slice(&(n as u16).to_be_bytes());
    o.extend_from_slice(&b[..n]);
}

impl Tag {
    fn id(&self) -> u8 {
        match self {
            Tag::Byte(_) => 1,
            Tag::Short(_) => 2,
            Tag::Int(_) => 3,
            Tag::Long(_) => 4,
            Tag::Float(_) => 5,
            Tag::Double(_) => 6,
            Tag::Bytes(_) => 7,
            Tag::Str(_) => 8,
            Tag::List(..) => 9,
            Tag::Comp(_) => 10,
            Tag::Ints(_) => 11,
            Tag::Longs(_) => 12,
        }
    }
    fn put(&self, o: &mut Vec<u8>) {
        match self {
            Tag::Byte(x) => o.push(*x as u8),
            Tag::Short(x) => o.extend_from_slice(&x.to_be_bytes()),
            Tag::Int(x) => o.extend_from_slice(&x.to_be_bytes()),
            Tag::Long(x) => o.extend_from_slice(&x.to_be_bytes()),
            Tag::Float(x) => o.extend_from_slice(&x.to_bits().to_be_bytes()),
            Tag::Double(x) => o.extend_from_slice(&x.to_bits().to_be_bytes()),
            Tag::Bytes(x) => {
                o.extend_from_slice(&(x.len() as i32).to_be_bytes());
                o.extend_from_slice(x);
            }
            Tag::Str(x) => put_s(o, x),
            Tag::List(t, v) => {
                o.push(if v.is_empty() { 0 } else { *t });
                o.extend_from_slice(&(v.len() as i32).to_be_bytes());
                for x in v {
                    x.put(o);
                }
            }
            Tag::Comp(v) => {
                for (k, x) in v {
                    o.push(x.id());
                    put_s(o, k);
                    x.put(o);
                }
                o.push(0);
            }
            Tag::Ints(v) => {
                o.extend_from_slice(&(v.len() as i32).to_be_bytes());
                for x in v {
                    o.extend_from_slice(&x.to_be_bytes());
                }
            }
            Tag::Longs(v) => {
                o.extend_from_slice(&(v.len() as i32).to_be_bytes());
                for x in v {
                    o.extend_from_slice(&x.to_be_bytes());
                }
            }
        }
    }
}

fn parse(b: &[u8]) -> Result<Vec<(String, Tag)>, String> {
    let mut r = R { b, p: 0 };
    if r.u8()? != 10 {
        return Err("servers.dat inválido".into());
    }
    r.s()?;
    match r.tag(10, 0)? {
        Tag::Comp(v) => Ok(v),
        _ => Err("servers.dat inválido".into()),
    }
}

fn get_str(c: &[(String, Tag)], k: &str) -> String {
    c.iter()
        .find(|(n, _)| n == k)
        .and_then(|(_, t)| if let Tag::Str(s) = t { Some(s.clone()) } else { None })
        .unwrap_or_default()
}

fn set_str(c: &mut Vec<(String, Tag)>, k: &str, v: &str) {
    match c.iter_mut().find(|(n, _)| n == k) {
        Some(slot) => slot.1 = Tag::Str(v.to_string()),
        None => c.push((k.to_string(), Tag::Str(v.to_string()))),
    }
}

fn load(game: &Path) -> Result<Vec<(String, Tag)>, String> {
    match std::fs::read(game.join("servers.dat")) {
        Ok(b) if !b.is_empty() => parse(&b),
        _ => Ok(vec![]),
    }
}

pub fn servers(game: &Path) -> Result<Vec<Value>, String> {
    let root = load(game)?;
    let mut out = vec![];
    for (k, t) in &root {
        if let (true, Tag::List(_, items)) = (k == "servers", t) {
            for it in items {
                if let Tag::Comp(c) = it {
                    out.push(json!({"name": get_str(c, "name"), "ip": get_str(c, "ip")}));
                }
            }
        }
    }
    Ok(out)
}

/// Guarda a lista. Entradas com o mesmo endereço mantêm os restantes campos
/// (ícone, aceitar texturas…); as novas ficam só com nome e endereço.
pub fn save_servers(game: &Path, list: &[(String, String)]) -> Result<(), String> {
    if list.len() > 200 {
        return Err("demasiados servidores".into());
    }
    let mut root = load(game)?;
    let old: Vec<Vec<(String, Tag)>> = root
        .iter()
        .filter_map(|(k, t)| if let (true, Tag::List(_, v)) = (k == "servers", t) { Some(v.clone()) } else { None })
        .flatten()
        .filter_map(|t| if let Tag::Comp(c) = t { Some(c) } else { None })
        .collect();
    let mut items = vec![];
    for (name, ip) in list {
        let (name, ip) = (name.trim(), ip.trim());
        if ip.is_empty() || ip.len() > 255 || name.len() > 100 || ip.chars().chain(name.chars()).any(|c| c.is_control()) {
            return Err("nome ou endereço inválido".into());
        }
        let mut c = old.iter().find(|c| get_str(c, "ip") == ip).cloned().unwrap_or_default();
        set_str(&mut c, "ip", ip);
        set_str(&mut c, "name", if name.is_empty() { ip } else { name });
        items.push(Tag::Comp(c));
    }
    let new = Tag::List(10, items);
    match root.iter_mut().find(|(k, _)| k == "servers") {
        Some(slot) => slot.1 = new,
        None => root.push(("servers".to_string(), new)),
    }
    let mut out = vec![10u8];
    put_s(&mut out, "");
    Tag::Comp(root).put(&mut out);
    std::fs::create_dir_all(game).map_err(e)?;
    let dat = game.join("servers.dat");
    if dat.exists() {
        let _ = std::fs::copy(&dat, game.join("servers.dat_old"));
    }
    let tmp = game.join("servers.dat.tmp");
    std::fs::write(&tmp, out).map_err(e)?;
    std::fs::rename(&tmp, &dat).map_err(e)
}
