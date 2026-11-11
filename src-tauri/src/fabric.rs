use crate::mojang::fetch_json;
use serde_json::{json, Value};

fn key(l: &Value) -> String {
    let n = l["name"].as_str().unwrap_or("");
    let p: Vec<&str> = n.split(':').collect();
    format!("{}:{}:{}", p.first().unwrap_or(&""), p.get(1).unwrap_or(&""), p.get(3).unwrap_or(&""))
}

/// Junta o perfil do loader (filho: Fabric, Quilt, Forge ou NeoForge) com o json vanilla (pai).
/// O filho tem prioridade nas bibliotecas.
pub fn merge(parent: &Value, child: &Value, mc: &str) -> Value {
    let mut out = parent.clone();
    out["id"] = child["id"].clone();
    out["mainClass"] = child["mainClass"].clone();
    out["jar"] = json!(mc);
    if let Some(o) = out.as_object_mut() {
        o.remove("inheritsFrom");
    }
    let cl = child["libraries"].as_array().cloned().unwrap_or_default();
    let keys: Vec<String> = cl.iter().map(key).collect();
    let mut libs = cl;
    libs.extend(parent["libraries"].as_array().cloned().unwrap_or_default().into_iter().filter(|l| !keys.contains(&key(l))));
    out["libraries"] = json!(libs);
    if parent["arguments"].is_object() {
        for k in ["jvm", "game"] {
            let mut a = parent["arguments"][k].as_array().cloned().unwrap_or_default();
            a.extend(child["arguments"][k].as_array().cloned().unwrap_or_default());
            out["arguments"][k] = json!(a);
        }
    }
    // Forge antigo (até 1.12): os argumentos do jogo vêm numa só string que substitui a do pai
    if let Some(m) = child["minecraftArguments"].as_str() {
        out["minecraftArguments"] = json!(m);
    }
    out
}

fn ver(x: &Value) -> String {
    x["loader"]["version"].as_str().unwrap_or("").to_string()
}

/// `a` é uma versão mais nova do que `b`? (só a parte numérica: "0.16.14" > "0.14.21"; vazio nunca é mais novo)
fn newer(a: &str, b: &str) -> bool {
    let k = |v: &str| -> Vec<u32> { v.split(['-', '+']).next().unwrap_or("").split('.').map(|x| x.parse().unwrap_or(0)).collect() };
    !a.is_empty() && k(a) > k(b)
}

/// Devolve (id do perfil, json fundido) com o loader estável mais recente.
/// `quilt` escolhe o Quilt (meta.quiltmc.org, mesmo formato do Fabric); senão é o Fabric.
pub async fn profile(mc: &str, parent: &Value, quilt: bool, fixed: Option<&str>) -> Result<(String, Value), String> {
    let (nome, base) = if quilt {
        ("Quilt", "https://meta.quiltmc.org/v3/versions/loader")
    } else {
        ("Fabric", "https://meta.fabricmc.net/v2/versions/loader")
    };
    let list = fetch_json(&format!("{base}/{mc}")).await?;
    let arr = list.as_array().cloned().unwrap_or_default();
    let pick = arr
        .iter()
        .find(|x| x["loader"]["stable"].as_bool() == Some(true))
        // o Quilt não marca "stable": a primeira versão sem "-beta"/"-rc" serve
        .or_else(|| arr.iter().find(|x| {
            let v = ver(x);
            !v.is_empty() && !v.contains('-')
        }))
        .or(arr.first())
        .ok_or(format!("O {nome} ainda não suporta esta versão"))?;
    // um modpack pode fixar a versão do loader, mas muitos fixam uma antiga: o loader novo corre os mods antigos
    // e o Sleep (e mods atualizados) pedem um recente, por isso fica a mais nova das duas
    let lv = match fixed {
        Some(f) if !newer(&ver(pick), f) => f.to_string(),
        _ => ver(pick),
    };
    if lv.is_empty() {
        return Err("sem versão do loader".into());
    }
    let child = fetch_json(&format!("{base}/{mc}/{lv}/profile/json")).await?;
    let id = child["id"].as_str().unwrap_or(if quilt { "quilt" } else { "fabric" }).to_string();
    Ok((id, merge(parent, &child, mc)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loader_mais_novo() {
        assert!(newer("0.16.14", "0.14.21"));
        assert!(!newer("0.14.21", "0.16.14"));
        assert!(!newer("0.16.14", "0.16.14"));
        assert!(!newer("", "0.14.21"));
    }
}
