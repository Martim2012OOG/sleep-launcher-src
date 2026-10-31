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

/// Devolve (id do perfil, json fundido) com o loader estável mais recente.
/// `quilt` escolhe o Quilt (meta.quiltmc.org, mesmo formato do Fabric); senão é o Fabric.
pub async fn profile(mc: &str, parent: &Value, quilt: bool) -> Result<(String, Value), String> {
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
    let lv = ver(pick);
    if lv.is_empty() {
        return Err("sem versão do loader".into());
    }
    let child = fetch_json(&format!("{base}/{mc}/{lv}/profile/json")).await?;
    let id = child["id"].as_str().unwrap_or(if quilt { "quilt" } else { "fabric" }).to_string();
    Ok((id, merge(parent, &child, mc)))
}
