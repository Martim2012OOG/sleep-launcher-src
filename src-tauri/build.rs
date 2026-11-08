use std::io::Write;

fn main() {
    // A chave da CurseForge vai dentro da app: vem de KUBO_CF_KEY (builds automáticos) ou do ficheiro ../.cf_key (no teu computador, fora do git).
    // Fica baralhada no binário para não aparecer num simples `strings`. Isto NÃO a torna secreta: quem quiser mesmo consegue tirá-la.
    println!("cargo:rerun-if-env-changed=KUBO_CF_KEY");
    println!("cargo:rerun-if-changed=../.cf_key");
    let key = std::env::var("KUBO_CF_KEY").ok().filter(|k| !k.trim().is_empty()).or_else(|| std::fs::read_to_string("../.cf_key").ok()).map(|k| k.trim().to_string()).unwrap_or_default();
    let mut x = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(88172645463325252) | 1;
    let pad: Vec<u8> = key
        .bytes()
        .map(|_| {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            (x >> 32) as u8
        })
        .collect();
    let enc: Vec<u8> = key.bytes().zip(pad.iter()).map(|(a, b)| a ^ b).collect();
    let out = std::path::Path::new(&std::env::var("OUT_DIR").unwrap()).join("cf_key.rs");
    let mut f = std::fs::File::create(out).unwrap();
    write!(f, "const CF_A: &[u8] = &{enc:?};\nconst CF_B: &[u8] = &{pad:?};\n").unwrap();
    tauri_build::build()
}
