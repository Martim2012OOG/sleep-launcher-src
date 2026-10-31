"""Gera dist-mods/mods.json + os jars a publicar na release.
release "mods-src": <id>__<versão do MC>.jar  ->  {"mods":[{"id","files":{"<mc>":{"url","sha1"}}}]}
O Fabric API é descarregado do Modrinth aqui (no CI) e publicado na própria release, para o launcher só falar com o GitHub."""
import hashlib, json, os, shutil, subprocess, sys, urllib.parse, urllib.request

repo, tag = sys.argv[1], sys.argv[2]
base = f"https://github.com/{repo}/releases/download/{tag}"
out = "dist-mods"
shutil.rmtree(out, ignore_errors=True)
os.makedirs(out)
mods = {}

def add(mid, mc, path):
    data = open(path, "rb").read()
    name = f"{mid}-{mc}.jar"
    open(os.path.join(out, name), "wb").write(data)
    mods.setdefault(mid, {})[mc] = {"url": f"{base}/{name}", "sha1": hashlib.sha1(data).hexdigest()}

# os jars (103 MB, grandes demais para o git) ficam como ficheiros da release "mods-src", com o nome <id>__<versão do MC>.jar
src = json.loads(subprocess.check_output(["gh", "release", "view", "mods-src", "--repo", repo, "--json", "assets"]))["assets"]
versions = set()
for a in src:
    n = a["name"]
    if not n.endswith(".jar") or "__" not in n:
        continue
    mid, mc = n[:-4].split("__", 1)
    versions.add(mc)
    tmp = os.path.join(out, "_src.jar")
    urllib.request.urlretrieve(a["url"], tmp)
    add(mid, mc, tmp)
    os.remove(tmp)
for mc in sorted(versions):
    q = urllib.parse.urlencode({"game_versions": json.dumps([mc]), "loaders": json.dumps(["fabric"])})
    req = urllib.request.Request(f"https://api.modrinth.com/v2/project/fabric-api/version?{q}", headers={"User-Agent": "kubo-launcher-ci"})
    vs = json.load(urllib.request.urlopen(req))
    if vs:
        fl = next((x for x in vs[0]["files"] if x.get("primary")), vs[0]["files"][0])
        tmp = os.path.join(out, "_fapi.jar")
        urllib.request.urlretrieve(fl["url"], tmp)
        add("fabric-api", mc, tmp)
        os.remove(tmp)
    else:
        print(f"AVISO: sem Fabric API para {mc}")

json.dump({"mods": [{"id": k, "files": v} for k, v in mods.items()]}, open(os.path.join(out, "mods.json"), "w"), indent=2)
print(json.dumps(mods, indent=1))
