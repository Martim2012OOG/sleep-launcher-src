fn main() {
    // A chave da CurseForge vai dentro da app: vem de KUBO_CF_KEY (builds automáticos) ou do ficheiro ../.cf_key (no teu computador, fora do git).
    println!("cargo:rerun-if-env-changed=KUBO_CF_KEY");
    println!("cargo:rerun-if-changed=../.cf_key");
    let key = std::env::var("KUBO_CF_KEY").ok().filter(|k| !k.trim().is_empty()).or_else(|| std::fs::read_to_string("../.cf_key").ok().map(|k| k.trim().to_string()).filter(|k| !k.is_empty()));
    if let Some(k) = key {
        println!("cargo:rustc-env=KUBO_CF_KEY={k}");
    }
    tauri_build::build()
}
