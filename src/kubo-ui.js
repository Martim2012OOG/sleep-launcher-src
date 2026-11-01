/* Sleep UI: ecrã de entrada (Microsoft / cracked), intro, início com skin 3D e novidades, instâncias com pesquisa, ligação privada.
   Carrega depois do app.js e troca só as vistas; a lógica (instâncias, mods, amigos, loja) continua a ser a do app.js. */
(function(){
const SITE="https://pal-connect-plaza.lovable.app";
const msIcon='<svg class="i" viewBox="0 0 24 24" style="fill:currentColor;stroke:none"><path d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z"/></svg>';
const lsGet=(k,d)=>{try{return localStorage.getItem(k)??d}catch(e){return d}},lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
S.ready=false;S.guest=false;lsSet("kubo.guest","");S.km="";S.kcode=null;S.news=null;S.iq="";S.vpn=lsGet("kubo.vpn","off");S.vpnScope=lsGet("kubo.vpnscope","mc");

/* ---------- navegação: + Ligação privada ---------- */
const vpnIc=ic('<path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6z"/><rect x="9.5" y="10.5" width="5" height="4.2" rx="1"/><path d="M10.5 10.5V9a1.5 1.5 0 0 1 3 0v1.5"/>');
const gearIc=ic('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>');
const NI={play:ic('<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10-6.5a1 1 0 0 0 0-1.72l-10-6.5A1 1 0 0 0 8 5.5z"/>'),inst:ic('<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5L12 21l9-4.5"/>'),mods:ic('<path d="M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4h2a2 2 0 1 0 0-4H6V6h4z"/>'),srv:ic('<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6"/>'),chat:ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>'),shop:ic('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),char:ic('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),vpn:vpnIc,set:gearIc};
NAV.forEach(n=>{if(NI[n[0]])n[2]=NI[n[0]]});
if(!NAV.some(n=>n[0]=="mods"))NAV.splice(2,0,["mods","Mods",NI.mods]);
if(!NAV.some(n=>n[0]=="vpn"))NAV.splice(NAV.length-1,0,["vpn","Ligação privada",vpnIc]);

/* avisos como no client: cartões em baixo à direita, com barra de progresso nas instalações e um X para os fechar */
const KI={ok:'<path d="M5 12l5 5 9-10"/>',err:'<path d="M12 8v5M12 16.5v.01"/><circle cx="12" cy="12" r="9"/>',dl:'<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>'};
let kn=document.getElementById("kn");if(!kn){kn=document.createElement("div");kn.id="kn";document.body.appendChild(kn)}
const kcards=new Map(),kdis=new Set();
function kcard(id,kind,title,sub,pct,life){let c=kcards.get(id);
 if(!c){c=document.createElement("div");c.className="kc";c.dataset.id=id;c.innerHTML='<i class="kic"></i><div class="ktx"><b></b><span></span><div class="kbar"><u></u></div></div><button class="kx" aria-label="Fechar">×</button>';
  c.querySelector(".kx").onclick=()=>{kdis.add(id);kclose(id)};kn.appendChild(c);kcards.set(id,c);while(kn.children.length>4)kclose(kn.firstChild.dataset.id)}
 c.className="kc "+kind;c.querySelector(".kic").innerHTML='<svg viewBox="0 0 24 24">'+(KI[kind==="bad"?"err":kind==="good"?"ok":kind==="prog"?"dl":"info"])+'</svg>';
 c.querySelector("b").textContent=title;const sp=c.querySelector("span");sp.textContent=sub||"";sp.style.display=sub?"":"none";
 const bar=c.querySelector(".kbar");bar.style.display=pct===undefined?"none":"";bar.classList.toggle("ind",pct===null);if(typeof pct==="number")bar.firstChild.style.width=Math.max(2,Math.min(100,pct))+"%";
 clearTimeout(c.__t);if(life)c.__t=setTimeout(()=>kclose(id),life)}
function kclose(id){const c=kcards.get(id);if(!c)return;kcards.delete(id);clearTimeout(c.__t);c.classList.add("out");setTimeout(()=>c.remove(),200)}
let _lastToast={m:"",t:0};
toast=function(m,keep){const t0=String(m);if(!/ \d+\/\d+$/.test(t0)){if(_lastToast.m===t0&&Date.now()-_lastToast.t<8000)return;_lastToast={m:t0,t:Date.now()}}const pm=t0.match(/^(.+?) (\d+)\/(\d+)$/);
 if(pm){const id="prog";if(kdis.has(id))return;const d=+pm[2],tot=+pm[3]||1,pct=d/tot*100;
  if(d>=tot){kcard(id,"good","Instalação concluída","",100,2800);return}
  kcard(id,"prog","A instalar…",pm[1].replace(/^./,x=>x.toUpperCase())+" · "+Math.round(pct)+"%",pct);return}
 const bad=/^Erro/.test(t0);let t=t0.replace(/^Erro: endereço não permitido/,"Esta ligação não pode ser aberta pelo launcher.").replace(/^Erro: /,"");
 kdis.delete("prog");
 if(keep){kcard("keep","prog",t.replace(/…$/,""),"",null);return}
 kclose("keep");kclose("prog");
 kcard("n"+Date.now(),bad?"bad":/instalad|conclu|guardad|atualizad|copiad|pronto/i.test(t)?"good":"info",t,"",undefined,bad?7000:4200)};

/* barra de cima da cor do launcher (macOS: botões do sistema por cima; arrastar a janela pela barra) */
if(/Mac/i.test(navigator.platform||navigator.userAgent))document.documentElement.classList.add("mac");
{const d=document.createElement("div");d.id="kdrag";d.setAttribute("data-tauri-drag-region","");document.body.appendChild(d)}

/* ---------- ecrã de entrada ---------- */

function vGate(){return`<div class="gate"><img class="gbg" src="img/bg.jpg" alt=""><div class="gwrap"><div><h1 class="glogo">Sleep<span>Launcher</span></h1><p>Entra para jogar, ver os teus amigos e usar a tua loja, skins e capas.</p>
<div class="gbtns"><button class="btn big" data-a="kms">${msIcon}Entrar com Microsoft</button><button class="btn p big" data-a="kcr">${I.user}Entrar com conta cracked</button>
<div class="grow"><button class="btn" data-a="kbug">${I.ext}Reportar bugs</button></div><span class="gnote">Conta cracked só funciona em servidores em modo offline. É preciso entrar com uma das duas para jogar.</span></div></div>
<div class="gartw"><img class="gart" src="img/duo.png" alt=""></div></div><button class="btn grev" data-a="krev">${I.chat}Reviews</button><button class="btn glang" data-a="klang" data-notr>${(KL.langs.find(l=>l[0]==KL.get())||KL.langs[0])[2]} ${(KL.langs.find(l=>l[0]==KL.get())||KL.langs[0])[1]} ▾</button></div>`}
function kmodal(){if(S.km=="cr")return`<div class="ov" style="z-index:12"><div class="pn md"><b style="font-size:18px">Conta cracked</b><span class="tag">Escolhe o teu nome (3 a 16 letras, números ou _).</span><input id="knick" placeholder="Nome" maxlength="16" autocomplete="off" value="${esc(S.knick||"")}"><span class="tag" id="kerr" style="color:#ff7b7b"></span><div class="row sb"><button class="btn" data-a="kclose">Cancelar</button><button class="btn p" data-a="kcrgo">Entrar</button></div></div></div>`;
 if(S.km=="code")return`<div class="ov" style="z-index:12"><div class="pn md"><b style="font-size:18px">Entrar com Microsoft</b>${S.kcode?`<span class="tag">Abre <b>${esc(S.kcode.url.replace(/^https?:\/\//,""))}</b> e escreve este código:</span><div class="code">${esc(S.kcode.code)}</div><div class="row sb"><button class="btn" data-a="kcopy">Copiar código</button><button class="btn p" data-a="kopen">${I.ext}Abrir a página</button></div><span class="tag">Esta janela fecha sozinha quando entrares.</span>`:`<span class="tag">${S.kfb?"A abrir a janela de entrada da Microsoft…":"A pedir o código à Microsoft…"}</span>`}<div class="row" style="justify-content:flex-end"><button class="btn" data-a="kclose">Cancelar</button></div></div></div>`;
 return""}
/* ---------- intro (põe um ficheiro intro.mp4 ao lado do index.html para a usar) ---------- */
function intro(){if(lsGet("kubo.intro","")==new Date().toDateString())return;lsSet("kubo.intro",new Date().toDateString());
 const d=document.createElement("div");d.className="intro";d.innerHTML='<b>Sleep <span>Launcher</span></b>';document.body.appendChild(d);
 const v=document.createElement("video");v.src="intro.mp4";v.autoplay=true;v.muted=true;v.playsInline=true;
 v.onloadeddata=()=>{d.innerHTML="";d.style.animation="none";d.appendChild(v);v.play().catch(()=>{});v.onended=()=>d.remove()};
 setTimeout(()=>{if(!d.querySelector("video"))d.remove()},3300);d.addEventListener("click",()=>d.remove())}

/* ---------- início ---------- */
const _vPlay=vPlay;
vPlay=function(){let h=_vPlay();
 h=h.replace(/<canvas class="fig" data-fig width="160" height="320"><\/canvas>/,'<canvas id="sv3d" class="fig3d" width="300" height="380"></canvas>');
 h=h.replace('<div class="ph">Sleep</div>','');h=h.replace(/<p class="tag">As novidades do launcher aparecem aqui\.<\/p>/,`<div id="news">${newsH()}</div>`);return h};
V.play=vPlay;
const newsH=()=>!S.news?`<p class="tag">A carregar…</p>`:S.news.length?S.news.map(n=>`<div class="news-i" data-a="klink" data-v="${esc(n.url)}">${n.img?`<img src="${esc(n.img)}" alt="" loading="lazy">`:""}<b>${esc(n.title)}</b><span>${esc(n.sub)}</span></div>`).join(""):`<p class="tag">Sem novidades agora.</p>`;
async function loadNews(){if(S.news)return;try{const j=JSON.parse(await inv("http_get",{url:"https://launchercontent.mojang.com/v2/javaPatchNotes.json"}));
 S.news=(j.entries||[]).slice(0,4).map(x=>({title:x.title,sub:"Minecraft "+x.version,img:x.image&&x.image.url?"https://launchercontent.mojang.com"+x.image.url:"",url:"https://feedback.minecraft.net/hc/en-us/sections/360001186971-Release-Changelogs"}))}catch(x){S.news=[]}
 const e=document.getElementById("news");if(e)e.innerHTML=newsH()}
/* skin 3D com animações ao acaso */
let V3=null,cvs=null,vkey="";
let STEVE_URL="";let STEVE_P=null;
const steveGet=()=>STEVE_P||(STEVE_P=inv("skin_b64",{url:"https://minotar.net/skin/MHF_Steve"}).then(b=>{STEVE_URL="data:image/png;base64,"+b;STEVE.src=STEVE_URL;return STEVE_URL}).catch(()=>{STEVE_P=null;return""}));
const skinSrc=async u=>{if(u.startsWith("img/"))return await steveGet()||null;if(u.startsWith("data:"))return u;if(!T)return u;try{return"data:image/png;base64,"+await inv("skin_b64",{url:u})}catch(e){return null}};
/* conta cracked = skin por defeito (Steve), sem ir procurar nenhuma skin real pelo nome */
const STEVE=new Image();steveGet();
const _paint=paint;
paint=function(){if(S.acc&&S.acc.offline){const go=()=>document.querySelectorAll("canvas[data-fig]").forEach(c=>figure(c,STEVE,c.dataset.fig=="head"));if(STEVE.complete&&STEVE.naturalWidth)go();else STEVE.onload=go;return}_paint()};
/* o personagem 3D é criado uma vez e só muda de sítio quando a página é redesenhada (antes era refeito a cada desenho e tornava tudo lento) */
function fallback2d(why){const ph=document.getElementById("sv3d");if(!ph)return;if(why)console.error("3D:",why);
 const c=document.createElement("canvas");c.className="fig";c.dataset.fig="";c.width=160;c.height=320;ph.replaceWith(c);paint()}
function mount3d(){const ph=document.getElementById("sv3d");
 if(!ph){if(V3)V3.renderPaused=true;return}
 if(!window.skinview3d){fallback2d("skinview3d não carregou");return}
 const bb=ph.getBoundingClientRect(),sk=S.acc&&(S.acc.skins||[]).find(x=>x.state=="ACTIVE"),off=S.acc&&S.acc.offline;
 const url=off?(S.offSkin||"img/steve.png"):sk?sk.url:"https://minotar.net/skin/"+encodeURIComponent(S.acc?S.acc.name:"MHF_Steve");
 const model=off?(S.offModel=="slim"?"slim":"default"):(sk&&sk.variant=="SLIM"?"slim":"default"),cp=S.acc&&(S.acc.capes||[]).find(x=>x.state=="ACTIVE"),curl=cp&&cp.url||"",key=url.slice(-60)+url.length+model+curl.slice(-40);
 if(!V3){cvs=document.createElement("canvas");cvs.id="sv3d";cvs.className="fig3d";
  try{V3=new skinview3d.SkinViewer({canvas:cvs,width:300,height:380,pixelRatio:Math.min(window.devicePixelRatio||1,1.5)});V3.zoom=.78;V3.controls.enableZoom=false;V3.controls.enablePan=false;V3.autoRotate=false;V3.camera.rotation.x=-.12;V3.playerWrapper.rotation.y=.5}catch(x){V3=null;cvs=null;toast("Personagem 3D indisponível: "+(x&&x.message||x));fallback2d(x);return}
  animate()}
 ph.replaceWith(cvs);if(bb.width>20)V3.setSize(Math.round(bb.width),Math.round(bb.height));V3.renderPaused=false;
 if(key!=vkey){vkey=key;const mine=V3;let ok=false;skinSrc(url).then(u=>u||skinSrc("img/steve.png")).then(u=>{if(u&&V3===mine&&vkey==key)return mine.loadSkin(u,{model}).then(()=>curl?skinSrc(curl).then(c=>c?mine.loadCape(c):mine.resetCape()):mine.resetCape()).then(()=>{ok=true})}).catch(x=>{toast("Skin 3D: "+(x&&x.message||x));fallback2d(x);V3=null;cvs=null;vkey=""});
  setTimeout(()=>{if(!ok&&V3===mine&&vkey==key){toast("A skin 3D não carregou: a mostrar a skin em 2D");fallback2d("timeout");try{mine.dispose()}catch(e){}V3=null;cvs=null;vkey=""}},4000)}}
/* só animações de repouso: respirar parado (da biblioteca skinview3d) e, por cima, o olhar a virar devagarinho para os lados */
function animate(){const a=new skinview3d.IdleAnimation();
 a.addAnimation((p,t)=>{p.skin.head.rotation.y=Math.sin(t*.55)*.38;p.skin.head.rotation.x=Math.sin(t*.37)*.07});
 V3.animation=a}

/* ---------- personagem: skin 3D também aqui ---------- */
const _vChar=vChar;
vChar=function(){return _vChar().replace('<canvas data-fig width="160" height="320"></canvas>','<canvas id="sv3d" class="fig3d"></canvas>')};
V.char=vChar;

/* ---------- servidores: cartões com ícone, descrição e jogadores (dados da API pública mcsrvstat.us) ---------- */
S.sinfo={};const sinfoAt={};
S.smeta={};try{S.smeta=JSON.parse(lsGet("kubo.srvmeta","{}"))||{}}catch(e){}
const saveMeta=()=>lsSet("kubo.srvmeta",JSON.stringify(S.smeta));
const sname=a=>(S.smeta[a]&&S.smeta[a].name)||a;
async function loadSrv(a){if(sinfoAt[a]&&Date.now()-sinfoAt[a]<60000)return;sinfoAt[a]=Date.now();
 try{const j=JSON.parse(await inv("http_get",{url:"https://api.mcstatus.io/v2/status/java/"+encodeURIComponent(a)}));
  S.sinfo[a]={on:!!j.online,icon:j.icon||"",motd:(j.motd&&j.motd.clean?String(j.motd.clean).split("\n").map(x=>x.trim()).filter(Boolean).join(" · "):""),pl:j.players?j.players.online:0,max:j.players?j.players.max:0,ver:j.version?(j.version.name_clean||""):""}}
 catch(x){S.sinfo[a]={on:false,icon:"",motd:"",pl:0,max:0,ver:"",err:1}}
 if(S.page=="play"||(S.page=="srv"&&!(document.activeElement&&document.activeElement.tagName=="INPUT")))render()}
const srvIcon=(a,sz)=>{const i=S.sinfo[a],m=S.smeta[a],ic=(m&&m.icon)||(i&&i.icon);return`<span class="sicon" style="width:${sz}px;height:${sz}px">${ic?`<img src="${esc(ic)}" alt="">`:`<b>${esc(a.trim()[0]||"?").toUpperCase()}</b>`}</span>`};
V.srv=function(){S.servers.forEach(loadSrv);
 return`<div class="pad"><h1>Servidores</h1><p class="sub">Aparecem no acesso rápido da página Jogar e entram direto no servidor (Minecraft 1.20 ou mais recente).</p>
 <div class="row"><input id="sa" placeholder="mc.exemplo.net" style="flex:1" autocomplete="off"><button class="btn p" data-a="srvadd">${I.plus}Adicionar</button></div>
 <div class="slist">${S.servers.map(a=>{const i=S.sinfo[a];const bn=S.smeta[a]&&S.smeta[a].banner;return`<div class="pn scard ${i&&i.on?"up":""} ${bn?"hasb":""}" ${bn?`style="--sb:url(${bn})"`:""}>${srvIcon(a,64)}<div class="sbody"><div class="sname"><b>${esc(sname(a))}</b><i class="sdot ${i?(i.on?"on":"off"):"wait"}"></i></div><div class="smotd">${i?(i.on?esc(i.motd||"Servidor online"):"Offline ou sem resposta"):"A verificar…"}</div>${i&&i.on?`<div class="schips"><span class="ch">${i.pl}/${i.max} jogadores</span>${i.ver?`<span class="ch">${esc(i.ver)}</span>`:""}</div>`:""}</div><button class="btn p" data-a="srvplay" data-v="${esc(a)}">${I.play}Jogar</button><button class="btn ic" data-a="ksedit" data-v="${esc(a)}" title="Personalizar">${I.gear}</button><button class="btn ic dn" data-a="srvdel" data-v="${esc(a)}" aria-label="Remover">${I.trash}</button></div>`}).join("")||`<div class="empty">Ainda não tens servidores. Adiciona um acima.</div>`}</div></div>`};
/* acesso rápido do início */
const _vPlay2=vPlay;
vPlay=function(){let h=_vPlay2();S.servers.forEach(loadSrv);
 h=h.replace(/<button class="btn lbig" data-a="play" data-n="" disabled>/,'<button class="btn lbig" data-a="newi">').replace("<b>Sem instâncias</b>","<b>Criar instância</b>").replace("<small>Cria uma instância</small>","<small>Começa por aqui</small>");
 h=h.replace(/<div class="qp"><span class="mono">Acesso rápido<\/span>/,`<div class="qp"><span class="qpl">${I.play}Acesso rápido</span>`);
 h=h.replace(/<button class="chip" data-a="srvplay" data-v="([^"]*)">([^<]*)<\/button>/g,(m,v,t)=>{const i=S.sinfo[v.replace(/&amp;/g,"&")]||S.sinfo[t];return`<button class="chip qs" data-a="srvplay" data-v="${v}">${srvIcon(t,22)}<span>${esc(sname(t.replace(/&amp;/g,"&")))}</span><i class="sdot ${i?(i.on?"on":"off"):"wait"}"></i></button>`});
 h=h.replace(/<button class="chip" data-a="nav" data-v="srv">Adicionar servidor<\/button>/,`<button class="chip qs" data-a="nav" data-v="srv">${I.plus}<span>Adicionar servidor</span></button>`);return h};
V.play=vPlay;

/* ---------- skins: Wide/Slim aplica logo; contas cracked guardam a skin no launcher ---------- */
S.offSkin=lsGet("kubo.offskin","");S.offModel=lsGet("kubo.offmodel","default");
const OFFIMG=new Image();if(S.offSkin)OFFIMG.src=S.offSkin;
const _paint2=paint;
paint=function(){if(S.acc&&S.acc.offline&&S.offSkin){const go=()=>document.querySelectorAll("canvas[data-fig]").forEach(c=>figure(c,OFFIMG,c.dataset.fig=="head"));if(OFFIMG.complete&&OFFIMG.naturalWidth)go();else OFFIMG.onload=go;return}_paint2()};
const readB64=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f)});
async function applySkin(variant,dataUrl){
 if(S.acc&&S.acc.offline){if(dataUrl){S.offSkin=dataUrl;lsSet("kubo.offskin",dataUrl);OFFIMG.src=dataUrl}S.offModel=variant=="slim"?"slim":"default";lsSet("kubo.offmodel",S.offModel);vkey="";S.skin=null;
  toast("Skin aplicada no launcher. Para os outros jogadores a verem no jogo, envia-a também no separador Sleep.");render();return}
 try{let b64=dataUrl&&dataUrl.split(",")[1];
  if(!b64){const sk=(S.acc.skins||[]).find(x=>x.state=="ACTIVE");if(!sk){toast("Escolhe primeiro um ficheiro PNG.");return}b64=await inv("skin_b64",{url:sk.url})}
  toast("A aplicar a skin…",1);S.acc=await inv("change_skin",{variant,data:b64});S.skin=null;vkey="";toast("Skin atualizada.");render()}catch(x){toast(er(x))}}
document.addEventListener("change",async e=>{const t=e.target;
 if(t.id=="sf"&&t.files[0]){e.stopImmediatePropagation();S.pendingSkin=await readB64(t.files[0]);const v=document.getElementById("sv");applySkin(v?v.value:"classic",S.pendingSkin)}
 else if(t.id=="sv"){e.stopImmediatePropagation();applySkin(t.value,S.pendingSkin||"")}},true);

/* ---------- temas ao estilo do Discord: predefinições + cores à escolha ---------- */
const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),rg=a=>"#"+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
const mix=(a,b,t)=>rg(hx(a).map((v,i)=>v+(hx(b)[i]-v)*t)),lite=(c,t)=>mix(c,"#ffffff",t),dark=(c,t)=>mix(c,"#000000",t);
const TH=[["Sleep","#4a67e8","#0e0f13"],["Meia-noite","#7a6cff","#0b0d1a"],["AMOLED","#4dd0e1","#000000"],["Oceano","#2dd4bf","#08141a"],["Floresta","#4ccf68","#0c130e"],["Pôr do sol","#ff9f43","#160d0d"],["Rosa","#ff6bb5","#150d12"],["Violeta","#b57bff","#110d18"],["Grafite","#9aa1b8","#121316"],["Carmesim","#e5484d","#140b0c"],["Ouro","#f5c542","#14110a"],["Gelo","#7fd4ff","#0b1218"]];
let cur=null;try{cur=JSON.parse(lsGet("kubo.th2","null"))}catch(e){}
cur=cur||{n:"Sleep",a:"#4a67e8",b:"#0e0f13"};
const lum=c=>{const [r,g,b]=hx(c).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
function applyTheme(t){cur=t;lsSet("kubo.th2",JSON.stringify(t));const r=document.documentElement.style,v=(k,x)=>r.setProperty("--"+k,x);
 const light=lum(t.b)>.5,tone=(c,x)=>light?dark(c,x):lite(c,x);
 v("accent",t.a);v("bg",t.b);v("card",tone(t.b,.05));v("border",tone(t.b,.13));v("field",light?dark(t.b,.08):dark(t.b,.35));
 v("text",light?"#14161f":"#f1f3f8");v("dim",light?"#555a6e":"#8c90a0");
 v("on",dark(t.a,.45));v("onhi",lite(t.a,.55));v("off",tone(t.b,.1));v("danger","#e5484d");v("btn",tone(t.b,.1));v("kb",t.a);v("kbl",dark(t.a,.38));v("ko",light?dark(t.b,.75):dark(t.b,.8));
 /* texto sobre a cor de destaque: sempre branco ou quase preto, conforme o contraste (nunca verde nem outras cores) */
 v("onkb",lum(t.a)>.42?"#10131f":"#ffffff");v("lite",light?"#14161f":"#ffffff")}
applyTheme(cur);
const _theme=theme;theme=function(){applyTheme(cur)};
const sw=t=>`<button class="tsw ${cur.a==t[1]&&cur.b==t[2]?"act":""}" data-a="kth" data-v="${t[0]}" title="${t[0]}" style="background:linear-gradient(135deg,${t[2]} 0 46%,${t[1]} 46% 100%)"><b>${cur.a==t[1]&&cur.b==t[2]?"✓":""}</b></button>`;
const _vSet=vSet;
vSet=function(){return`<div class="pad"><h1>Definições</h1><p class="sub">Muda o tema do launcher. As cores aplicam-se logo.</p>
 <div class="pn" style="padding:18px"><b>Idioma</b><div class="vgrid langgrid">${KL.langs.map(l=>`<button class="vc ${l[0]==KL.get()?"act":""}" data-a="klset" data-v="${l[0]}" data-notr><i>${l[2]}</i><b>${l[1]}</b></button>`).join("")}</div></div>
 <div class="pn" style="padding:18px;margin-top:12px"><b>Temas</b><div class="tgrid">${TH.map(sw).join("")}</div>
 <div class="tcust"><b>Personalizar</b><div class="trow"><label>Cor de destaque<button class="cswatch" data-v="a" style="background:${cur.a}"></button></label><label>Cor de fundo<button class="cswatch" data-v="b" style="background:${cur.b}"></button></label><button class="btn" data-a="kthr">Repor</button></div>
 <div class="tprev" style="background:${cur.b}"><i style="background:${lite(cur.b,.05)};border-color:${lite(cur.b,.13)}"></i><u style="background:${cur.a}">Jogar</u></div></div></div>
 <div class="pn" style="padding:18px;margin-top:12px"><b>Fonte</b><div class="fgrid">${FONTS.map((f,i)=>`<button class="fbtn ${fcur&&fcur.kind=="sys"?(fcur.i==i?"act":""):(!fcur&&i==0?"act":"")}" data-a="kfn" data-v="${i}" style="font-family:${f[1]}">${f[0]}<small>Aa Bb 123</small></button>`).join("")}<label class="fbtn up ${fcur&&fcur.kind=="custom"?"act":""}"><b>${fcur&&fcur.kind=="custom"?esc(fcur.name||"A tua fonte"):"Carregar fonte…"}</b><small>.ttf · .otf · .woff2</small><input type="file" id="kfile" accept=".ttf,.otf,.woff,.woff2,font/*" hidden></label></div><button class="btn" data-a="kfr" style="margin-top:10px">Repor a fonte</button></div>
 <div class="pn row sb" style="padding:16px;margin-top:12px"><span>Abrir com o computador</span><div class="sw ${S.auto?"on":""}" data-a="auto" role="switch" aria-checked="${S.auto}"></div></div>
 <details class="pn adv" style="margin-top:12px"><summary>Avançado</summary>
 <div class="advb"><b>Login Microsoft</b><div class="tag">Application (client) ID da tua app no Azure</div><div class="row" style="margin-top:8px"><input id="ci" style="flex:1" value="${esc(S.ci)}" placeholder="00000000-0000-0000-0000-000000000000"><button class="btn" data-a="saveci">Guardar</button></div>
 <b style="margin-top:14px;display:block">CurseForge</b><div class="tag">${S.hasCf?"Chave guardada neste computador. Cola outra para a trocar.":"Chave de API da CurseForge (console.curseforge.com). Fica só neste computador."}</div><div class="row" style="margin-top:8px"><input id="cfk" type="password" style="flex:1" placeholder="Chave de API" autocomplete="off"><button class="btn" data-a="savecf">Guardar</button></div>
 <b style="margin-top:14px;display:block">Amigos e chat</b><div class="tag">Chave do cliente do site (só se o administrador a ligou).</div><div class="row" style="margin-top:8px"><input id="ssk" type="password" style="flex:1" placeholder="Chave do cliente (opcional)" autocomplete="off"><button class="btn" data-a="savesk">Guardar</button></div>
 <b style="margin-top:14px;display:block">Mod Sleep</b><div class="tag">Endereço do manifesto (JSON no teu site)</div><div class="row" style="margin-top:8px"><input id="mu" style="flex:1" value="${esc(S.mu)}" placeholder="https://…/manifesto.json"><button class="btn" data-a="savemu">Guardar</button></div></div></details></div>`};
V.set=vSet;
document.addEventListener("input",e=>{if(e.target.id=="tca"||e.target.id=="tcb"){const a=document.getElementById("tca").value,b=document.getElementById("tcb").value;applyTheme({n:"Personalizado",a,b});const pv=document.querySelector(".tprev");if(pv){pv.style.background=b;pv.firstChild.style.background=lite(b,.05);pv.lastChild.style.background=a}document.querySelectorAll(".tsw").forEach(x=>x.classList.remove("act"))}},true);
document.addEventListener("click",e=>{const el=e.target.closest("[data-a=kth],[data-a=kthr]");if(!el)return;e.stopPropagation();
 if(el.dataset.a=="kthr")applyTheme({n:"Sleep",a:"#4a67e8",b:"#0e0f13"});else{const t=TH.find(x=>x[0]==el.dataset.v);if(t)applyTheme({n:t[0],a:t[1],b:t[2]})}render()},true);

/* ---------- menu da conta (canto de cima à direita) ---------- */
let amOpen=false;
const hexA=(a)=>a;
async function accMenu(){closeAcc();amOpen=true;let list=[];try{list=await inv("list_accounts")}catch(x){list=[]}
 if(!amOpen)return;if(!list.some(a=>S.acc&&a.uuid===S.acc.uuid)&&S.acc)list.unshift({name:S.acc.name,uuid:S.acc.uuid,offline:!!S.acc.offline,active:true});
 const m=document.createElement("div");m.className="amenu";
 m.innerHTML=`<div class="ahead"><canvas data-fig="head" width="32" height="32"></canvas><div><b>${esc(S.acc.name)}</b><span>${S.acc.offline?"Conta offline":"Conta Minecraft"}</span></div><svg viewBox="0 0 24 24" class="achev"><path d="M6 15l6-6 6 6"/></svg></div>
 <div class="arows">${list.map(a=>`<div class="arow ${a.active?"on":""}" data-a="kasw" data-v="${esc(a.uuid)}"><i class="rad"></i>${a.offline?`<canvas class="oh" data-off="1" width="32" height="32"></canvas>`:`<img src="https://mc-heads.net/avatar/${esc(String(a.uuid).replace(/-/g,""))}/40" alt="" onerror="this.style.visibility='hidden'">`}<b>${esc(a.name)}</b><span class="abadge">${a.offline?"Offline":"Oficial"}</span><button class="adel" data-a="kadel" data-v="${esc(a.uuid)}" aria-label="Remover">${I.trash}</button></div>`).join("")}</div>
 <button class="btn aadd" data-a="kms">${I.plus}Adicionar conta Microsoft</button><button class="btn aadd" data-a="kcr">${I.plus}Adicionar conta offline</button><button class="btn aadd" data-a="kchar">${I.user}Personagem e skins</button>`;
 document.body.appendChild(m);paint();
 m.querySelectorAll("canvas[data-off]").forEach(c=>{const im=S.offSkin?OFFIMG:STEVE;const go=()=>figure(c,im,true);if(im.complete&&im.naturalWidth)go();else im.addEventListener("load",go,{once:true})})}
function closeAcc(){amOpen=false;document.querySelectorAll(".amenu").forEach(e=>e.remove())}
document.addEventListener("click",async e=>{
 const chip=e.target.closest(".top .btn.acc");
 if(chip){e.stopPropagation();e.preventDefault();if(document.querySelector(".amenu"))closeAcc();else accMenu();return}
 const el=e.target.closest(".amenu [data-a]");
 if(!el){if(!e.target.closest(".amenu"))closeAcc();return}
 const a=el.dataset.a,v=el.dataset.v;
 if(a=="kadel"){e.stopPropagation();try{const was=S.acc&&S.acc.uuid===v;await inv("remove_account",{uuid:v});if(was){S.acc=null;S.skin=null;closeAcc();render()}else accMenu()}catch(x){toast(er(x))}}
 else if(a=="kasw"){e.stopPropagation();if(S.acc&&S.acc.uuid===v){closeAcc();return}try{S.acc=await inv("switch_account",{uuid:v});S.skin=null;vkey="";closeAcc();await ids();render();toast("Conta mudada para "+S.acc.name+".")}catch(x){toast(er(x))}}
 else if(a=="kchar"){e.stopPropagation();closeAcc();S.page="char";S.cur="";render()}
 else if(a=="kms"||a=="kcr"){closeAcc()}
},true);

/* ---------- seletor de cor (como o do shadcn): quadrado de saturação, matiz, formatos e conta-gotas ---------- */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hsv2rgb(h,s,v){const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1))};return[f(5)*255,f(3)*255,f(1)*255]}
function rgb2hsv(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){h=mx==r?((g-b)/d)%6:mx==g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360}return[h,mx?d/mx:0,mx]}
function hsv2hsl(h,s,v){const l=v*(1-s/2),sl=l==0||l==1?0:(v-l)/Math.min(l,1-l);return[h,sl,l]}
function hsl2hsv(h,s,l){const v=l+s*Math.min(l,1-l);return[h,v?2*(1-l/v):0,v]}
let cpS=null;
function closeCP(){document.querySelectorAll(".cpop").forEach(e=>e.remove());cpS=null}
function openCP(k,anchor){closeCP();const [r,g,b]=hx(cur[k]),[h,s,v]=rgb2hsv(r,g,b);cpS={k,h,s,v,mode:"hex"};
 const el=document.createElement("div");el.className="cpop";
 el.innerHTML=`<div class="cpsv"><i class="cpt"></i></div><div class="cph"><i class="cpt"></i></div>
 <div class="cpr">${window.EyeDropper?`<button class="btn ic cpe" title="Conta-gotas"><svg class="i" viewBox="0 0 24 24"><path d="M14 4l6 6M4 20l1-4 9-9 3 3-9 9zM16 6l2-2a2 2 0 0 1 3 3l-2 2"/></svg></button>`:""}
 <div class="cpm"><button data-m="hex" class="act">HEX</button><button data-m="rgb">RGB</button><button data-m="hsl">HSL</button></div><div class="cpi"></div></div>`;
 document.body.appendChild(el);const r0=anchor.getBoundingClientRect();el.style.left=Math.min(r0.left,innerWidth-el.offsetWidth-12)+"px";
 el.style.top=(r0.bottom+el.offsetHeight+10>innerHeight?Math.max(8,r0.top-el.offsetHeight-8):r0.bottom+8)+"px";
 const sv=el.querySelector(".cpsv"),hu=el.querySelector(".cph"),box=el.querySelector(".cpi");
 const rgbNow=()=>hsv2rgb(cpS.h,cpS.s,cpS.v);
 const fields=()=>{const [R,G,B]=rgbNow().map(Math.round);let html="";
  if(cpS.mode=="hex")html=`<input class="cpf" data-f="hex" value="${rg([R,G,B])}" maxlength="7" spellcheck="false">`;
  else if(cpS.mode=="rgb")html=[R,G,B].map((x,i)=>`<input class="cpf n" data-f="rgb${i}" value="${x}" inputmode="numeric">`).join("");
  else{const[hh,ss,ll]=hsv2hsl(cpS.h,cpS.s,cpS.v);html=[Math.round(hh)+"",Math.round(ss*100)+"",Math.round(ll*100)+""].map((x,i)=>`<input class="cpf n" data-f="hsl${i}" value="${x}" inputmode="numeric">`).join("")}
  box.innerHTML=html};
 const paintAll=(skipFields)=>{const [R,G,B]=rgbNow(),hex=rg([R,G,B]);
  sv.style.background=`linear-gradient(0deg,#000,transparent),linear-gradient(90deg,#fff,hsl(${cpS.h},100%,50%))`;
  const st=sv.firstChild.style;st.left=cpS.s*100+"%";st.top=(1-cpS.v)*100+"%";st.background=hex;
  const ht=hu.firstChild.style;ht.left=cpS.h/360*100+"%";ht.background=`hsl(${cpS.h},100%,50%)`;
  if(!skipFields)fields();
  const nt=Object.assign({},cur,{n:"Personalizado"});nt[cpS.k]=hex;applyTheme(nt);
  const sw=document.querySelector(`.cswatch[data-v="${cpS.k}"]`);if(sw)sw.style.background=hex;
  const pv=document.querySelector(".tprev");if(pv){pv.style.background=cur.b;pv.firstChild.style.background=lite(cur.b,.05);pv.lastChild.style.background=cur.a}
  document.querySelectorAll(".tsw").forEach(x=>x.classList.remove("act"))};
 const drag=(node,fn)=>node.addEventListener("pointerdown",e=>{e.preventDefault();const mv=ev=>{const r=node.getBoundingClientRect();fn(clamp((ev.clientX-r.left)/r.width,0,1),clamp((ev.clientY-r.top)/r.height,0,1));paintAll(true);if(cpS)fields()};
  mv(e);const up=()=>{document.removeEventListener("pointermove",mv);document.removeEventListener("pointerup",up)};document.addEventListener("pointermove",mv);document.addEventListener("pointerup",up)});
 drag(sv,(x,y)=>{cpS.s=x;cpS.v=1-y});drag(hu,x=>{cpS.h=x*360});
 el.querySelectorAll(".cpm button").forEach(b=>b.onclick=()=>{cpS.mode=b.dataset.m;el.querySelectorAll(".cpm button").forEach(x=>x.classList.toggle("act",x==b));fields()});
 box.addEventListener("input",ev=>{const f=ev.target.dataset.f;if(!f)return;const val=ev.target.value.trim();
  if(f=="hex"){if(/^#?[0-9a-fA-F]{6}$/.test(val)){const hh=val.startsWith("#")?val:"#"+val;[cpS.h,cpS.s,cpS.v]=rgb2hsv(...hx(hh));paintAll(true)}}
  else if(f.startsWith("rgb")){const vals=[...box.querySelectorAll("input")].map(i=>clamp(+i.value||0,0,255));[cpS.h,cpS.s,cpS.v]=rgb2hsv(...vals);paintAll(true)}
  else if(f.startsWith("hsl")){const vals=[...box.querySelectorAll("input")].map(i=>+i.value||0);[cpS.h,cpS.s,cpS.v]=hsl2hsv(clamp(vals[0],0,360),clamp(vals[1],0,100)/100,clamp(vals[2],0,100)/100);paintAll(true)}});
 const eb=el.querySelector(".cpe");if(eb)eb.onclick=async()=>{try{const res=await new EyeDropper().open();[cpS.h,cpS.s,cpS.v]=rgb2hsv(...hx(res.sRGBHex));paintAll()}catch(x){}};
 paintAll()}
document.addEventListener("click",e=>{const b=e.target.closest(".cswatch");if(b){e.stopPropagation();e.preventDefault();if(document.querySelector(".cpop")&&cpS&&cpS.k==b.dataset.v)closeCP();else openCP(b.dataset.v,b);return}
 if(!e.target.closest(".cpop"))closeCP()},true);

/* personalizar servidor: nome, logo e banner */
const _modal3=modal;
modal=function(){if(S.modal!="srv")return _modal3();const a=S.sedit.addr,m=S.sedit;
 return`<div class="ov"><div class="pn md newi"><div class="nh"><div class="nico">${I.srv}</div><div><b>Personalizar servidor</b><span>${esc(a)}</span></div></div>
 <label class="fl"><em>Nome</em><input id="sen" value="${esc(m.name)}" placeholder="${esc(a)}" maxlength="40" autocomplete="off"></label>
 <div class="fl"><em>Logo</em><div class="row"><span class="sicon" style="width:56px;height:56px">${m.icon?`<img src="${esc(m.icon)}" alt="">`:srvIcon(a,56)}</span><label class="btn">Escolher imagem<input type="file" id="sei" accept="image/*" hidden></label>${m.icon?`<button class="btn" data-a="ksclr" data-v="icon">Tirar</button>`:""}</div></div>
 <div class="fl"><em>Banner</em><div class="sbprev" style="${m.banner?`background-image:url(${m.banner})`:""}">${m.banner?"":"Sem banner"}</div><div class="row"><label class="btn">Escolher imagem<input type="file" id="seb" accept="image/*" hidden></label>${m.banner?`<button class="btn" data-a="ksclr" data-v="banner">Tirar</button>`:""}</div></div>
 <div class="row sb"><button class="btn" data-a="ksclose">Cancelar</button><button class="btn p" data-a="kssave">${I.ok}Guardar</button></div></div></div>`};
function shrink(file,w,h,cover){return new Promise(ok=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement("canvas");let sc=cover?Math.max(w/im.width,h/im.height):Math.min(1,Math.min(w/im.width,h/im.height));
 c.width=cover?w:Math.round(im.width*sc);c.height=cover?h:Math.round(im.height*sc);const g=c.getContext("2d");g.imageSmoothingEnabled=false;if(cover)g.drawImage(im,(w-im.width*sc)/2,(h-im.height*sc)/2,im.width*sc,im.height*sc);else g.drawImage(im,0,0,c.width,c.height);ok(c.toDataURL(cover?"image/jpeg":"image/png",.85))};im.src=r.result};r.readAsDataURL(file)})}
document.addEventListener("click",e=>{const el=e.target.closest("[data-a^=ks]");if(!el)return;const a=el.dataset.a,v=el.dataset.v;e.stopPropagation();
 if(a=="ksedit"){const m=S.smeta[v]||{};S.sedit={addr:v,name:m.name||"",icon:m.icon||"",banner:m.banner||""};S.modal="srv";render()}
 else if(a=="ksclose"){S.modal="";render()}
 else if(a=="ksclr"){S.sedit[v]="";render()}
 else if(a=="kssave"){const n=document.getElementById("sen"),m=S.sedit;m.name=n?n.value.trim():m.name;const o={};if(m.name)o.name=m.name;if(m.icon)o.icon=m.icon;if(m.banner)o.banner=m.banner;if(Object.keys(o).length)S.smeta[m.addr]=o;else delete S.smeta[m.addr];saveMeta();S.modal="";render()}
},true);
document.addEventListener("change",async e=>{const t=e.target;if(t.id=="sei"&&t.files[0]){S.sedit.name=document.getElementById("sen").value;S.sedit.icon=await shrink(t.files[0],128,128,true);render()}
 else if(t.id=="seb"&&t.files[0]){S.sedit.name=document.getElementById("sen").value;S.sedit.banner=await shrink(t.files[0],720,180,true);render()}},true);

/* ---------- fonte à escolha ---------- */
const FONTS=[["Sistema","system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"],["Arredondada","ui-rounded,'SF Pro Rounded','Nunito','Segoe UI',system-ui,sans-serif"],["Serifa","Georgia,'Times New Roman',serif"],["Monoespaçada","ui-monospace,Menlo,Consolas,monospace"],["Compacta","'Arial Narrow','Helvetica Neue',Arial,sans-serif"],["Máquina","'Courier New',Courier,monospace"]];
let fcur=null;try{fcur=JSON.parse(lsGet("kubo.font","null"))}catch(e){}
async function applyFont(f){fcur=f;let stack=FONTS[0][1];
 if(f&&f.kind=="custom"&&f.data){try{const ff=new FontFace("KuboCustom","url("+f.data+")");await ff.load();document.fonts.add(ff);stack="KuboCustom,system-ui,sans-serif"}catch(e){toast("Não consegui usar essa fonte.");fcur=null;lsSet("kubo.font","null");return}}
 else if(f&&f.kind=="sys")stack=(FONTS[f.i]||FONTS[0])[1];
 document.documentElement.style.setProperty("--kfont",stack);try{lsSet("kubo.font",JSON.stringify(f))}catch(e){toast("A fonte é demasiado grande para guardar.")}}
applyFont(fcur);
document.addEventListener("click",e=>{const el=e.target.closest("[data-a=kfn],[data-a=kfr]");if(!el)return;e.stopPropagation();
 if(el.dataset.a=="kfr")applyFont(null).then(render);else applyFont({kind:"sys",i:+el.dataset.v}).then(render)},true);
document.addEventListener("change",async e=>{const t=e.target;if(t.id!="kfile"||!t.files[0])return;e.stopImmediatePropagation();const f=t.files[0];
 if(f.size>3e6){toast("A fonte tem de ter menos de 3 MB.");return}
 const data=await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(f)});await applyFont({kind:"custom",data,name:f.name.replace(/\.[^.]+$/,"")});render()},true);

/* ---------- ícones das instâncias (cor de fundo + desenho, ou uma imagem tua) ---------- */
let ICO={};try{ICO=JSON.parse(lsGet("kubo.icons","{}"))||{}}catch(e){}
const saveIco=()=>lsSet("kubo.icons",JSON.stringify(ICO));
const GL={sword:'<path d="M14.5 3.5L21 3l-.5 6.5L10 20l-6-6z"/><path d="M7 17l-3 3M5.5 12.5l6 6"/>',pick:'<path d="M5 6c4-3 10-3 14 0M12 6v14"/><path d="M5 6c-1 3 0 5 2 6M19 6c1 3 0 5-2 6"/>',cube:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5L12 12l8-4.5M12 12v9"/>',heart:'<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.400-7 10-7 10z"/>',star:'<path d="M12 3l2.7 5.6 6.1.8-4.5 4.300 1.100 6.100L12 17l-5.400 2.800 1.100-6.100L3.200 9.400l6.100-.8z"/>',flask:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 15h8"/>',shield:'<path d="M12 3l8 3v6c0 4.500-3.200 7.700-8 9-4.800-1.300-8-4.500-8-9V6z"/>',crown:'<path d="M4 18h16l1-10-5 4-4-7-4 7-5-4z"/>',flame:'<path d="M12 21c-4 0-6.500-2.600-6.500-6 0-3 2-5 3.500-7 .5 2 1.500 3 3 3 0-3-1-5-1-7 4 2 7.500 6 7.500 11 0 3.400-2.500 6-6.500 6z"/>',leaf:'<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15"/><path d="M5 19L14 10"/>'};
const BGS2=["#4a67e8","#2fb86a","#e5484d","#f0a052","#b06bff","#2dd4bf","#ff6bb5","#f5c542","#6b7089","#1f2a5a"];
const icoHTML=(name,sz,m)=>{m=m||ICO[name];const st=`width:${sz}px;height:${sz}px`;
 if(m&&m.img)return`<div class="ib ico" style="${st};background:url(${m.img}) center/cover;image-rendering:pixelated"></div>`;
 if(m&&(m.bg||m.g))return`<div class="ib ico" style="${st};background:${m.bg||"#4a67e8"}"><svg viewBox="0 0 24 24" style="width:62%;height:62%;fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round">${GL[m.g||"cube"]}</svg></div>`;
 return null};
S.nf.ico=null;
const _vDet=vDet;
vDet=function(d){let h=_vDet(d);const ic=icoHTML(d.name,62);if(ic)h=h.replace(/<div class="ib"[^>]*>[^<]*<\/div>/,ic);
 if(S.sub=="inst")h=h.replace('<button class="btn" data-a="chk">','<button class="btn p" data-a="sub" data-v="browse">'+I.search+'Procurar conteúdo</button><button class="btn" data-a="chk">');
 return h};
/* abrir uma instância mostra primeiro o que já tem instalado */
document.addEventListener("click",e=>{const el=e.target.closest(".icard[data-a=open]");if(!el)return;e.stopPropagation();S.cur=el.dataset.n;S.page="inst";enter("mods","inst")},true);
document.addEventListener("click",e=>{const el=e.target.closest("[data-a=create]");if(!el)return;const n=(document.getElementById("nn").value.trim()||"Sleep "+document.getElementById("nv").value);
 if(S.nf.ico&&(S.nf.ico.bg||S.nf.ico.img||S.nf.ico.g)){ICO[n]=S.nf.ico;saveIco()}setTimeout(()=>{S.nf.ico=null},50)},true);
document.addEventListener("click",e=>{const el=e.target.closest("[data-a^=kic]");if(!el)return;e.stopPropagation();const ed=S.page=="inst"&&S.tab=="xcfg"&&X.cfg,H=ed?X.cfg:S.nf,nn=document.getElementById(ed?"cn":"nn");if(nn)H.name=nn.value;
 const a=el.dataset.a,v=el.dataset.v,m=H.ico=H.ico||{};
 if(a=="kicbg"){m.bg=v;delete m.img;m.g=m.g||"cube"}else if(a=="kicg"){m.g=v;delete m.img;m.bg=m.bg||BGS2[0]}else if(a=="kicx")H.ico=null;render()},true);
document.addEventListener("change",async e=>{const t=e.target;if(t.id!="kicf"||!t.files[0])return;e.stopImmediatePropagation();const ed=S.page=="inst"&&S.tab=="xcfg"&&X.cfg,H=ed?X.cfg:S.nf,nn=document.getElementById(ed?"cn":"nn");if(nn)H.name=nn.value;
 H.ico={img:await shrink(t.files[0],128,128,true)};render()},true);

/* definições da instância: nome + ícone iguais ao da criação (letra, cor, símbolo ou imagem tua) */
const _xCfgV=xCfgV;
xCfgV=function(){const c=X.cfg;let h=_xCfgV();if(!c)return h;
 if(c.ico===undefined)c.ico=ICO[S.cur]?JSON.parse(JSON.stringify(ICO[S.cur])):null;
 const i=h.indexOf('<div class="tag" style="margin-top:12px">Ícone</div>');if(i<0)return h;
 const k=h.indexOf('</div></div>',i);if(k<0)return h;
 const pk=`<div class="tag" style="margin-top:12px">Ícone</div><div class="icopick"><div class="icoprev">${icoHTML("",64,c.ico)||ibox(c.name||"Nova","")}</div><div class="icoctl"><div class="icobgs">${BGS2.map(b=>`<button class="icobg ${c.ico&&c.ico.bg==b?"act":""}" data-a="kicbg" data-v="${b}" style="background:${b}"></button>`).join("")}</div><div class="icogs">${Object.keys(GL).map(g=>`<button class="icog ${c.ico&&c.ico.g==g?"act":""}" data-a="kicg" data-v="${g}"><svg viewBox="0 0 24 24">${GL[g]}</svg></button>`).join("")}</div><div class="row"><label class="btn">Carregar imagem<input type="file" id="kicf" accept="image/*" hidden></label>${c.ico?`<button class="btn" data-a="kicx">Tirar</button>`:""}</div></div></div>`;
 return h.slice(0,i)+pk+h.slice(k)};
const _xSave=xSave;
xSave=async function(){const c=X.cfg,old=S.cur,ic=c&&c.ico;await _xSave();
 if(c&&ic!==undefined){if(old!=S.cur)delete ICO[old];if(ic&&(ic.bg||ic.img||ic.g))ICO[S.cur]=ic;else delete ICO[S.cur];saveIco();xInitCfg();render()}};

/* ---------- importar instâncias de outros launchers (CurseForge, Modrinth App, Prism, ATLauncher, .minecraft...) ---------- */
S.imp={list:[],pick:{},ver:{},ldr:{},busy:false,asked:false};
let impNo=[];try{impNo=JSON.parse(lsGet("kubo.impno","[]"))||[]}catch(e){}
const _modal4=modal;
modal=function(){if(S.modal!="imp")return _modal4();const I2=S.imp,L=I2.list,rel=S.vers.slice(0,60);
 const groups={};L.forEach((x,i)=>{(groups[x.source]=groups[x.source]||[]).push(i)});
 const gone=L.filter(x=>x.trashable),goneMb=gone.reduce((n,x)=>n+x.mb,0),srcN=Object.keys(groups).length,picked=L.filter((x,i)=>I2.pick[i]===true).length;
 const tile=src=>{const c=["#e5844d","#2fb86a","#b06bff","#4aa3ff","#f0a052","#ff6bb5","#2dd4bf","#f5c542"][hue(src)%8];return`<i class="impg" style="background:${c}">${esc(src.trim()[0].toUpperCase())}</i>`};
 if(I2.confirm)return`<div class="ov"><div class="pn md newi impm"><div class="nh"><div class="nico" style="background:#e5484d">${I.trash}</div><div><b>Limpar restos de launchers antigos?</b><span>Vou mandar ${gone.length} pasta${gone.length==1?"":"s"} (${goneMb} MB) para o Lixo. Dá para as recuperar de lá.</span></div></div>
  <div class="implist">${gone.map(x=>`<div class="impi"><div class="impt"><b>${esc(x.name)}</b><span>${esc(x.source)} · ${x.mb} MB</span></div></div>`).join("")}</div>
  <p class="tag">Estes launchers já não estão instalados neste computador. Se tiveres mundos importantes aqui, importa-os primeiro para o Sleep.</p>
  <div class="row sb"><button class="btn" data-a="kimpb">Voltar</button><button class="btn dn" data-a="kimpd" ${I2.busy?"disabled":""}>${I2.busy?"A limpar…":"Mandar para o Lixo"}</button></div></div></div>`;
 return`<div class="ov"><div class="pn md newi impm"><div class="nh"><div class="nico">${I.dl}</div><div><b>Importar de outros launchers</b><span>Encontrei ${L.length} instância${L.length==1?"":"s"} em ${srcN} launcher${srcN==1?"":"s"}. Copio os mods, packs, shaders, mundos e definições para o Sleep; as originais ficam como estão.</span></div></div>
 <div class="impsum"><span class="ch">${L.length} encontradas</span><span class="ch">${picked} escolhidas</span>${gone.length?`<span class="ch warn">${gone.length} de launchers que já não existem</span>`:""}</div>
 <div class="implist">${Object.keys(groups).map(src=>{const ids=groups[src],all=ids.every(i=>I2.pick[i]===true),nogo=ids[0]!=null&&L[ids[0]].trashable;
  return`<div class="impgrp"><div class="impgh">${tile(src)}<b>${esc(src.replace(/-/g," "))}</b><span class="tag">${ids.length} · ${ids.reduce((n,i)=>n+L[i].mb,0)} MB</span>${nogo?`<span class="gonetag">já não está instalado</span>`:""}<button class="lnk" data-a="kimpa" data-v="${esc(src)}">${all?"Tirar todas":"Escolher todas"}</button></div>`+ids.map(i=>{const x=L[i],on=I2.pick[i]===true,v=I2.ver[i]||x.version||"",lo=I2.ldr[i]||x.loader||"fabric";
   return`<div class="impi ${on?"on":""}" data-a="kimpt" data-v="${i}"><i class="chk">${on?"✓":""}</i><div class="impt"><b>${esc(x.name)}</b><span>${x.mb} MB${x.version?` · ${esc(x.version)} · ${esc(ln(x.loader||"vanilla"))}`:" · escolhe a versão"}</span></div>${x.version?"":`<div class="impv" onclick="event.stopPropagation()"><select data-imp="v" data-i="${i}">${rel.map(r=>`<option ${r==(v||rel[0])?"selected":""}>${r}</option>`).join("")}</select><select data-imp="l" data-i="${i}">${["fabric","quilt","forge","neoforge","vanilla"].map(k=>`<option value="${k}" ${k==lo?"selected":""}>${LN[k]}</option>`).join("")}</select></div>`}</div>`}).join("")+`</div>`}).join("")}</div>
 <div class="row sb"><span class="row" style="gap:8px"><button class="btn" data-a="kimpc">Agora não</button><button class="btn" data-a="kimpn">Não voltar a perguntar</button>${gone.length?`<button class="btn dn" data-a="kimpl">${I.trash}Limpar restos</button>`:""}</span><button class="btn p" data-a="kimpg" ${I2.busy||!picked?"disabled":""}>${I2.busy?"A importar…":I.dl+"Importar "+(picked||"")}</button></div></div></div>`};
async function scanImport(force){try{const raw=await inv("scan_launchers");const have=new Set(S.inst.map(i=>i.name.toLowerCase()));
  S.imp.list=(raw||[]).filter(x=>!have.has(String(x.name).toLowerCase())&&(force||!impNo.includes(x.game)));S.imp.pick={};S.imp.ver={};S.imp.ldr={};
  if(S.imp.list.length&&(force||!S.imp.asked)){S.imp.asked=true;if(!S.vers.length)await ids().catch(()=>{});S.modal="imp";render()}else if(force)toast("Não encontrei instâncias novas de outros launchers.")}catch(x){if(force)toast(er(x))}}
document.addEventListener("click",async e=>{const el=e.target.closest("[data-a^=kimp]");if(!el)return;e.stopPropagation();const a=el.dataset.a;
 if(a=="kimpt"){const i=+el.dataset.v;S.imp.pick[i]=S.imp.pick[i]!==true;const y=document.querySelector(".implist");const top=y?y.scrollTop:0;render();const y2=document.querySelector(".implist");if(y2)y2.scrollTop=top}
 else if(a=="kimpa"){const ids=S.imp.list.map((x,i)=>x.source==el.dataset.v?i:-1).filter(i=>i>=0),all=ids.every(i=>S.imp.pick[i]===true);ids.forEach(i=>S.imp.pick[i]=!all);const y=document.querySelector(".implist"),top=y?y.scrollTop:0;render();const y2=document.querySelector(".implist");if(y2)y2.scrollTop=top}
 else if(a=="kimpl"){S.imp.confirm=true;render()}
 else if(a=="kimpb"){S.imp.confirm=false;render()}
 else if(a=="kimpd"&&!S.imp.busy){S.imp.busy=true;render();try{const paths=S.imp.list.filter(x=>x.trashable).map(x=>x.root),n=await inv("trash_leftovers",{paths});S.imp.list=S.imp.list.filter(x=>!x.trashable);S.imp.confirm=false;S.imp.busy=false;if(!S.imp.list.length)S.modal="";render();toast(n?`Mandei ${n} pasta${n==1?"":"s"} para o Lixo.`:"Não consegui mandar nada para o Lixo.")}catch(x){S.imp.busy=false;render();toast(er(x))}}
 else if(a=="kimpc"){S.modal="";render()}
 else if(a=="kimpn"){impNo=impNo.concat(S.imp.list.map(x=>x.game));lsSet("kubo.impno",JSON.stringify(impNo));S.modal="";render()}
 else if(a=="kimpg"&&!S.imp.busy){S.imp.busy=true;render();let n=0;
  for(let i=0;i<S.imp.list.length;i++){if(S.imp.pick[i]!==true)continue;const x=S.imp.list[i];let name=x.name,k=2;const have=new Set(S.inst.map(q=>q.name.toLowerCase()));while(have.has(name.toLowerCase()))name=x.name+" ("+(k++)+")";
   const ver=x.version||S.imp.ver[i]||S.vers[0],ld=(x.version?x.loader:S.imp.ldr[i])||"fabric";
   try{toast("A criar "+name+"…",1);await inv("create_instance",{name,version:ver,loader:ld||"vanilla"});const dst=await inv("instance_game_dir",{name});await inv("import_copy",{src:x.game,dst,label:"Importar "+name});n++;await ids()}catch(err){toast("Não deu para importar "+x.name+": "+String(err))}}
  S.imp.busy=false;S.modal="";await ids();render();toast(n?`Importei ${n} instância${n==1?"":"s"}. Instalo o jogo quando carregares em Jogar.`:"Nada importado.")}
 else if(a=="kimp"){scanImport(true)}
},true);
document.addEventListener("change",e=>{const t=e.target;if(t.dataset&&t.dataset.imp){e.stopImmediatePropagation();const i=+t.dataset.i;(t.dataset.imp=="v"?S.imp.ver:S.imp.ldr)[i]=t.value}},true);
let impDone=false;

/* fundo de cada instância = o fundo do menu inicial dessa versão do Minecraft (tirado do client.jar dela) */
S.pano={};const panoAsked={};
function loadPano(i){if(!i||!i.version||!i.url||panoAsked[i.version]||!T)return;panoAsked[i.version]=1;
 inv("version_panorama",{version:i.version,url:i.url}).then(d=>{S.pano[i.version]=d;if(S.page=="inst"||S.page=="play")render()}).catch(()=>{})}
/* versões (release / snapshot / antigas) e o Horizon (Minecraft em Rust) */
S.allv=null;S.hz={installed:false};
async function loadAllV(){try{S.allv=await inv("list_versions")}catch(e){S.allv=[]}}
function verList(){const t=S.nf.vt||"release",l=S.allv;if(!l)return S.vers.slice(0,120);
 const f=l.filter(x=>t=="release"?x.type=="release":t=="snapshot"?x.type=="snapshot":(x.type=="old_beta"||x.type=="old_alpha")).map(x=>x.id);return f.length?f.slice(0,300):S.vers.slice(0,120)}
async function loadHz(){try{S.hz=await inv("horizon_state")}catch(e){S.hz={installed:false}}}
const horizonTile=()=>`<button class="ld hz ${S.nf.loader=="horizon"?"act":""}" data-a="nl" data-v="horizon"><i class="ldlogo" style="color:#ff8a3d"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.100 2.100M17 17l2.100 2.100M19.100 4.900L17 7M7 17l-2.100 2.100"/></svg></i><b>Rust (Horizon)</b><span>Minecraft 26.3 reescrito em Rust. Arranca muito depressa.</span></button>`;
const OPT={fabric:["sodium","lithium","ferrite-core","entityculling","modernfix","immediatelyfast"],quilt:["sodium","lithium","ferrite-core","entityculling","modernfix"],forge:["embeddium","ferrite-core","modernfix","entityculling"],neoforge:["sodium","ferrite-core","modernfix","entityculling"]};
document.addEventListener("click",async e=>{const el=e.target.closest("[data-a=kvt2],[data-a=kperf],[data-a=khzi],[data-a=khzp]");if(!el)return;e.stopPropagation();const a=el.dataset.a;
 if(a=="kvt2"){const nn=document.getElementById("nn");if(nn)S.nf.name=nn.value;S.nf.vt=el.dataset.v;const l=verList();S.nf.ver=l[0]||S.nf.ver;if(!S.allv)await loadAllV();render()}
 else if(a=="kperf"){const nn=document.getElementById("nn");if(nn)S.nf.name=nn.value;S.nf.perf=S.nf.perf===false;render()}
 else if(a=="khzi"||a=="khzp"){await horizonGo()}},true);
const hzBox=t=>{let b=document.getElementById("hzlog");if(t===null){b&&b.remove();return}if(!b){b=document.createElement("div");b.id="hzlog";document.body.appendChild(b)}b.dataset.l=((b.dataset.l||"")+"\n"+t).split("\n").filter(Boolean).slice(-7).join("\n");b.textContent=b.dataset.l};
if(T)T.event.listen("hz-log",ev=>{const l=String(ev.payload),m=l.match(/enter the code\s+([A-Z0-9]{6,12})/i);if(m){hzBox(null);S.kcode={code:m[1],url:"https://www.microsoft.com/link"};S.kfb=false;S.km="code";render();inv("open_url",{url:S.kcode.url}).catch(()=>{});return}hzBox(l)});
const lsg=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){}};
const hzJson=async a=>{try{return JSON.parse(await inv("horizon_cmd",{args:a}))}catch(e){return null}};
async function horizonGo(){try{
 if(!S.hz.installed){hzBox("Installing Horizon…");S.hz=await inv("horizon_install")}
 /* só pede a conta se o Horizon ainda não tiver uma (ele guarda a sessão sozinho) */
 const ac=await hzJson(["account","list","--json"]);
 if(!(ac&&ac.accounts&&ac.accounts.length&&ac.owner)){hzBox("Signing in…");await inv("horizon_cmd",{args:["account","sign-in"]});S.km="";render()}
 /* só descarrega e prepara o jogo se ainda não houver nenhuma versão instalada */
 const vs=await hzJson(["versions","--installed","--json"]);
 if(!(vs&&vs.installed&&vs.installed.length)){hzBox("Downloading Horizon…");await inv("horizon_cmd",{args:["install","latest"]});hzBox("Preparing Minecraft 26.3…");await inv("horizon_cmd",{args:["prepare","--download"]})}
 hzBox("Starting the game…");
 try{await inv("horizon_cmd",{args:["play"]})}catch(x){
  if(/prepare/i.test(String(x))){hzBox("Preparing Minecraft 26.3…");await inv("horizon_cmd",{args:["prepare","--download"]});await inv("horizon_cmd",{args:["play"]})}else throw x}
 setTimeout(()=>hzBox(null),4000);render()}catch(x){hzBox(null);S.km="";render();toast("Could not start Horizon. Try again.")}}
/* criar: Horizon ou otimização automática */
document.addEventListener("click",e=>{const el=e.target.closest("[data-a=create]");if(!el)return;
 if(S.nf.loader=="horizon"){e.stopImmediatePropagation();e.stopPropagation();S.modal="";render();horizonGo();return}
 const n=(document.getElementById("nn").value.trim()||"Sleep "+document.getElementById("nv").value),ld=S.nf.loader,list=OPT[ld];
 if(S.nf.perf!==false&&list){let tries=0;const t=setInterval(async()=>{if(++tries>60){clearInterval(t);return}if(!S.inst.some(i=>i.name==n))return;clearInterval(t);let ok=0;
  for(const p of list){try{toast("A otimizar "+n+": "+p+"…",1);await inv("mr_install",{name:n,kind:"mod",project:p});ok++}catch(x){}}toast(ok?`Otimização: ${ok} mod${ok==1?"":"s"} de desempenho instalado${ok==1?"":"s"} em ${n}.`:"Não consegui instalar os mods de desempenho (talvez ainda não existam para esta versão).")},700)}},true);

/* ---------- idioma: botão no ecrã de entrada e nas definições ---------- */
document.addEventListener("click",e=>{const el=e.target.closest("[data-a=klang],[data-a=klset]");if(!el)return;e.stopPropagation();e.preventDefault();
 if(el.dataset.a=="klset"){KL.set(el.dataset.v);return}
 if(document.querySelector(".kpop")){closePop();return}
 const r=el.getBoundingClientRect(),pop=document.createElement("div");pop.className="kpop";pop.dataset.notr="1";
 pop.innerHTML=KL.langs.map(l=>`<div data-lc="${l[0]}" class="${l[0]==KL.get()?"on":""}"><span>${l[2]}  ${l[1]}</span>${l[0]==KL.get()?"<b>✓</b>":""}</div>`).join("");
 pop.style.minWidth="220px";document.body.appendChild(pop);pop.style.left=Math.max(8,r.right-pop.offsetWidth)+"px";pop.style.top=(r.bottom+8)+"px";
 pop.addEventListener("click",ev=>{const d=ev.target.closest("[data-lc]");if(!d)return;ev.stopPropagation();closePop();KL.set(d.dataset.lc)})},true);

/* ---------- escolher a instância no início: lista própria em vez da lista do sistema ---------- */
document.addEventListener("click",e=>{const lab=e.target.closest(".lsw");if(!lab)return;e.preventDefault();e.stopPropagation();
 if(document.querySelector(".kpop")){closePop();return}
 const sel=(S.inst.find(i=>i.name==S.sel)||S.inst[0]||{}).name,r=lab.getBoundingClientRect(),pop=document.createElement("div");pop.className="kpop ipick";
 pop.innerHTML=S.inst.map((i,n)=>`<div data-i="${n}" class="${i.name==sel?"on":""}">${icoHTML(i.name,34)||ibox(i.name,i.icon)}<span class="ipn"><b>${esc(i.name)}</b><small>${esc(i.version)} · ${esc(ln(i.loader))}</small></span>${i.name==sel?"<b class=\"ick\">✓</b>":""}</div>`).join("")||'<div class="ipn" style="padding:10px"><small>Ainda não tens instâncias.</small></div>';
 pop.style.minWidth="270px";document.body.appendChild(pop);pop.style.left=Math.max(8,Math.min(r.right-pop.offsetWidth,innerWidth-pop.offsetWidth-8))+"px";pop.style.top=Math.max(8,r.top-pop.offsetHeight-8)+"px";
 pop.addEventListener("click",ev=>{const d=ev.target.closest("[data-i]");if(!d)return;ev.stopPropagation();S.sel=S.inst[+d.dataset.i].name;closePop();render()})},true);

/* ---------- página Mods (mods, resource packs e shaders para a instância escolhida) ---------- */
V.mods=function(){const d=det();
 if(!d)return`<div class="pad"><h1>Mods</h1><p class="sub">Para instalar mods, resource packs e shaders precisas de uma instância.</p><button class="btn p" data-a="newi">${I.plus}Nova instância</button></div>`;
 return`<div class="itool" style="padding:14px 18px 0"><em class="lbl">Instalar em</em><select id="mi">${S.inst.map(i=>`<option ${i.name==S.cur?"selected":""}>${esc(i.name)}</option>`).join("")}</select><button class="btn" data-a="mp">${I.box}Modpacks</button></div>${vDet(d)}`};
document.addEventListener("click",e=>{const el=e.target.closest(".nv[data-v=mods]");if(!el)return;e.stopPropagation();
 S.page="mods";S.mp=false;if(!S.inst.some(i=>i.name==S.cur))S.cur=((S.inst.find(i=>i.name==S.sel)||S.inst[0])||{}).name||"";enter("mods","browse")},true);
document.addEventListener("change",e=>{const t=e.target;if(t.id=="mi"){e.stopImmediatePropagation();S.cur=t.value;enter("mods","browse")}},true);

/* ---------- capas da loja em 3D (uma foto 3D de cada capa, vista de trás) ---------- */
const capeImg={},capeBusy={},capeTry={};let capeV=null,capeQ=Promise.resolve();
function capeSnap(url){if(capeImg[url])return Promise.resolve(capeImg[url]);
 return capeQ=capeQ.then(async()=>{if(capeImg[url])return capeImg[url];
  const b64=T?await inv(/textures\.minecraft\.net/.test(url)?"skin_b64":"img_b64",{url}):null;if(!b64&&T)throw 0;const src=T?"data:image/png;base64,"+b64:url;
  if(!capeV){capeV=new skinview3d.SkinViewer({width:260,height:300,renderPaused:true,preserveDrawingBuffer:true});capeV.zoom=.95;await capeV.loadSkin(await steveGet(),{model:"default"})}
  await capeV.loadCape(src);capeV.playerObject.rotation.y=Math.PI-.55;capeV.camera.rotation.x=-.08;capeV.render();
  return capeImg[url]=capeV.canvas.toDataURL("image/png")});}
function capeCards(){document.querySelectorAll(".hcov[data-cape]:not([data-cd])").forEach(el=>{const u=el.dataset.cape;if(capeBusy[u]===1&&!capeImg[u])return;el.dataset.cd="1";capeBusy[u]=1;
 capeSnap(u).then(d=>{document.querySelectorAll('.hcov[data-cape="'+CSS.escape(u)+'"]').forEach(c=>{if(!c.querySelector(".cape3d")){const i=new Image();i.className="cape3d";i.src=d;c.appendChild(i);const f=c.querySelector("img[data-h]");if(f)f.style.display="none"}})}).catch(()=>{capeBusy[u]=0;capeTry[u]=(capeTry[u]||0)+1;if(capeTry[u]<4)setTimeout(()=>{el.removeAttribute("data-cd");capeCards()},2500*capeTry[u])})})}

/* ---------- nova instância: janela bonita ---------- */
const LD={fabric:["Fabric","Leve e rápido. Recomendado para o Sleep.","#d9c28a"],quilt:["Quilt","Alternativa ao Fabric.","#b479ff"],forge:["Forge","Mods clássicos.","#e5844d"],neoforge:["NeoForge","O sucessor do Forge.","#f0a052"],vanilla:["Vanilla","Minecraft sem mods.","#6fcf7a"]};
/* logos dos loaders (a Modrinth publica-os; guardo-os para não os pedir sempre) */
let LDI={};try{LDI=JSON.parse(lsGet("kubo.ldi","{}"))||{}}catch(e){}
const okSvg=x=>typeof x=="string"&&/^\s*<svg/i.test(x)&&!/<script|on\w+\s*=|javascript:/i.test(x);
(async()=>{if(Object.keys(LDI).length>=4||!T)return;try{const j=JSON.parse(await inv("http_get",{url:"https://api.modrinth.com/v2/tag/loader"}));const o={};
 for(const x of j)if(["fabric","forge","neoforge","quilt","minecraft"].includes(x.name)&&okSvg(x.icon))o[x.name]=x.icon;
 if(Object.keys(o).length){LDI=o;lsSet("kubo.ldi",JSON.stringify(o));if(S.modal=="new")render()}}catch(e){}})();
const ldLogo=k=>{const svg=LDI[k=="vanilla"?"minecraft":k];return svg&&okSvg(svg)?`<i class="ldlogo">${svg}</i>`:`<i style="background:${(LD[k]||[])[2]||"#777"}">${LN[k][0]}</i>`};
const _modal=modal;
modal=function(){if(S.modal!="new")return _modal();
 return`<div class="ov"><div class="pn md newi"><div class="nh"><div class="nico">${I.box}</div><div><b>Nova instância</b><span>Um jogo à parte, com os seus próprios mods, packs e mundos.</span></div></div>
 <div class="fl"><em>Ícone</em><div class="icopick"><div class="icoprev">${icoHTML("",64,S.nf.ico)||ibox(S.nf.name||"Nova","")}</div><div class="icoctl"><div class="icobgs">${BGS2.map(c=>`<button class="icobg ${S.nf.ico&&S.nf.ico.bg==c?"act":""}" data-a="kicbg" data-v="${c}" style="background:${c}"></button>`).join("")}</div><div class="icogs">${Object.keys(GL).map(g=>`<button class="icog ${S.nf.ico&&S.nf.ico.g==g?"act":""}" data-a="kicg" data-v="${g}"><svg viewBox="0 0 24 24">${GL[g]}</svg></button>`).join("")}</div><div class="row"><label class="btn">Carregar imagem<input type="file" id="kicf" accept="image/*" hidden></label>${S.nf.ico?`<button class="btn" data-a="kicx">Tirar</button>`:""}</div></div></div></div>
 <label class="fl"><em>Nome</em><input id="nn" placeholder="Ex.: Survival com amigos" value="${esc(S.nf.name)}" maxlength="40" autocomplete="off"></label>
 <div class="fl"><em>Versão do Minecraft</em>${S.nf.loader=="horizon"?`<div class="hznote">${I.ok}O Horizon (Minecraft em Rust) só corre a versão <b>26.3</b>.</div>`:`<div class="seg vseg">${[["release","Release"],["snapshot","Snapshot"],["old","Antigas"]].map(t=>`<button class="${(S.nf.vt||"release")==t[0]?"act":""}" data-a="kvt2" data-v="${t[0]}">${t[1]}</button>`).join("")}</div><select id="nv">${verList().map(v=>`<option ${v==S.nf.ver?"selected":""}>${v}</option>`).join("")}</select>`}</div>
 <div class="fl"><em>Loader</em><div class="lgrid">${horizonTile()}${Object.keys(LN).map(k=>`<button class="ld ${S.nf.loader==k?"act":""}" data-a="nl" data-v="${k}">${ldLogo(k)}<b>${LN[k]}</b><span>${(LD[k]||[])[1]||""}</span></button>`).join("")}</div></div>
 ${S.nf.loader=="forge"||S.nf.loader=="neoforge"?`<span class="tag">${LN[S.nf.loader]} instala-se com o instalador oficial (precisa de Java; demora mais). O mod Sleep só entra em Fabric e Quilt.</span>`:""}
 ${S.nf.loader=="horizon"||S.nf.loader=="vanilla"?"":`<label class="optrow"><span><b>Otimizar o desempenho</b><small>Instala sozinho os mods de FPS certos para este loader (Sodium, Lithium, FerriteCore...) e usa argumentos de Java afinados.</small></span><div class="sw ${S.nf.perf!==false?"on":""}" data-a="kperf" role="switch"></div></label>`}<div class="row sb"><button class="btn" data-a="close">Cancelar</button><button class="btn p" data-a="create">${S.nf.loader=="horizon"?"Instalar o Horizon":I.plus+"Criar instância"}</button></div></div></div>`};

/* ---------- menu da esquerda com largura arrastável ---------- */
function sideSplit(){const app=document.getElementById("app");if(!app||app.querySelector(".sdiv"))return;
 const w=Math.max(64,Math.min(+lsGet("kubo.sw","100")||100,220));app.style.setProperty("--sw",w+"px");app.classList.toggle("narrow",w<86);
 const d=document.createElement("div");d.className="sdiv";d.title="Arrasta para mudar a largura do menu (duplo clique repõe)";app.appendChild(d);
 d.addEventListener("pointerdown",e=>{e.preventDefault();d.classList.add("on");document.body.style.cursor="col-resize";document.body.style.userSelect="none";
  const move=ev=>{const r=app.getBoundingClientRect(),x=Math.max(64,Math.min(ev.clientX-r.left,220));app.style.setProperty("--sw",x+"px");app.classList.toggle("narrow",x<86);app.__w=x;const b=document.querySelector(".side .nvbar"),a=document.querySelector(".side .nv.act");if(b&&a){b.style.transition="none";b.style.left=a.offsetLeft+"px";b.style.width=a.offsetWidth+"px";b.style.top=a.offsetTop+"px";b.style.height=a.offsetHeight+"px"}};
  const up=()=>{d.classList.remove("on");document.body.style.cursor="";document.body.style.userSelect="";document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",up);document.removeEventListener("pointercancel",up);if(app.__w)lsSet("kubo.sw",String(Math.round(app.__w)));try{slideBar()}catch(x){}};
  document.addEventListener("pointermove",move);document.addEventListener("pointerup",up);document.addEventListener("pointercancel",up)});
 d.addEventListener("dblclick",()=>{app.style.setProperty("--sw","100px");app.classList.remove("narrow");lsSet("kubo.sw","100")})}

/* ---------- divisória arrastável entre o boneco e as novidades / amigos ---------- */
const colW=()=>Math.max(220,Math.min(+lsGet("kubo.colw","300")||300,900));
function splitter(){const pg=document.querySelector(".pg");if(!pg||pg.querySelector(".pgdiv"))return;const col=pg.querySelector(".col");if(!col)return;
 pg.style.setProperty("--colw",colW()+"px");
 const d=document.createElement("div");d.className="pgdiv";d.title="Arrasta para mudar a largura";d.innerHTML="<i></i>";pg.insertBefore(d,col);
 d.addEventListener("pointerdown",e=>{e.preventDefault();d.classList.add("on");document.body.style.cursor="col-resize";document.body.style.userSelect="none";
  const move=ev=>{const r=pg.getBoundingClientRect(),w=Math.max(220,Math.min(r.right-ev.clientX-7-14,r.width-320));pg.style.setProperty("--colw",w+"px");pg.__w=w};
  const up=()=>{d.classList.remove("on");document.body.style.cursor="";document.body.style.userSelect="";document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",up);document.removeEventListener("pointercancel",up);if(pg.__w)lsSet("kubo.colw",String(Math.round(pg.__w)))};
  document.addEventListener("pointermove",move);document.addEventListener("pointerup",up);document.addEventListener("pointercancel",up)});
 d.addEventListener("dblclick",()=>{pg.style.setProperty("--colw","300px");lsSet("kubo.colw","300")})}

/* ---------- instâncias ---------- */
const BGS=["img/card1.jpg","img/back.jpg","img/bg.jpg"];
const hzCard=()=>`<div class="pn ca icard hzcard" style="--bgimg:url('img/bg.jpg')" data-a="${S.hz.installed?"khzp":"khzi"}"><div class="row"><div class="ib ico" style="width:46px;height:46px;background:#c2410c"><svg viewBox="0 0 24 24" style="width:62%;height:62%;fill:none;stroke:#fff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.100 2.100M17 17l2.100 2.100M19.100 4.900L17 7M7 17l-2.100 2.100"/></svg></div><div><b>Horizon</b><div class="tag">Minecraft em Rust</div></div></div><div><span class="ch">26.3</span><span class="ch">Rust</span><span class="ch hzb">${S.hz.installed?"Jogar":"Instalar"}</span></div></div>`;
const igridH=()=>{const q=S.iq.trim().toLowerCase(),l=S.inst.filter(i=>!q||(i.name+" "+i.version+" "+i.loader).toLowerCase().includes(q));
 return hzCard()+l.map(i=>`<div class="pn ca icard" style="--bgimg:url('${((S.pano[i.version]&&S.pano[i.version].length>3000)?S.pano[i.version]:"img/bg.jpg")||BGS[hue(i.name)%BGS.length]}')" data-a="open" data-n="${esc(i.name)}" tabindex="0"><div class="row">${icoHTML(i.name,46)||ibox(i.name,i.icon)}<div><b>${esc(i.name)}</b><div class="tag">${i.installed?"Instalada":"Por instalar"}</div></div></div><div><span class="ch">${esc(i.version)}</span><span class="ch">${ln(i.loader)}</span></div></div>`).join("")
 +`<button class="pn ca nw2" data-a="newi">${I.plus}<span>Nova instância</span></button>`};
const _vInst=vInst;
vInst=function(){if(S.mp||det())return _vInst();
 return`<div class="pad"><div class="row sb"><div><h1>Instâncias</h1><p class="sub">Cada instância tem os seus mods, packs e mundos.</p></div></div><div class="itool"><label class="s">${I.search}<input id="iq" value="${esc(S.iq)}" placeholder="Pesquisar instâncias…" autocomplete="off"></label><button class="btn" data-a="kimp">${I.dl}Importar</button><button class="btn" data-a="mp">${I.box}Modpacks</button><button class="btn p" data-a="newi">${I.plus}Nova instância</button></div><div class="gi" id="igrid">${igridH()}</div></div>`};
V.inst=vInst;

/* ---------- ligação privada: igual à do mod (liga sozinha ao abrir o jogo, no país escolhido) ---------- */
const VC=[["*","Mais rápido","⚡"],["PT","Portugal","🇵🇹"],["ES","Espanha","🇪🇸"],["FR","França","🇫🇷"],["DE","Alemanha","🇩🇪"],["NL","Países Baixos","🇳🇱"],["GB","Reino Unido","🇬🇧"],["IT","Itália","🇮🇹"],["PL","Polónia","🇵🇱"],["SE","Suécia","🇸🇪"],["US","Estados Unidos","🇺🇸"],["CA","Canadá","🇨🇦"],["BR","Brasil","🇧🇷"],["JP","Japão","🇯🇵"],["SG","Singapura","🇸🇬"]];
S.vpn=lsGet("kubo.vpn","off");S.vpnC=lsGet("kubo.vpnc","*");
const vpnApply=()=>inv("set_vpn",{enabled:S.vpn=="on",country:S.vpnC}).catch(()=>{});
V.vpn=function(){const on=S.vpn=="on",cur=VC.find(c=>c[0]==S.vpnC)||VC[0];
 return`<div class="pad"><div class="vhero ${on?"on":""}"><div class="vshield">${ic('<path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6z"/><path d="M8.5 12.2l2.4 2.4 4.6-4.9"/>')}</div>
 <div class="vtx"><b>${on?"Ligação privada ligada":"Ligação privada desligada"}</b><span>${on?`Vai ligar-se sozinha quando abrires o jogo · ${cur[2]} ${cur[1]}`:"O servidor vê o teu endereço normal."}</span></div>
 <button class="btn ${on?"":"p"} big2" data-a="kvt">${on?"Desligar":"Ligar"}</button></div>
 <h3 class="vh">País</h3><div class="vgrid">${VC.map(c=>`<button class="vc ${c[0]==S.vpnC?"act":""}" data-a="kvc" data-v="${c[0]}"><i>${c[2]}</i><b>${c[1]}</b></button>`).join("")}</div>
 <div class="vinfo"><div><b>O que passa por aqui</b><span>Só as ligações do Minecraft aos servidores. O login da Microsoft e o resto do computador ficam normais.</span></div><div><b>Como funciona</b><span>O jogo liga-se através de um servidor no país que escolheste, por isso o servidor vê o endereço desse país.</span></div></div></div>`};
document.addEventListener("click",e=>{const el=e.target.closest("[data-a=kvt],[data-a=kvc]");if(!el)return;e.stopPropagation();
 if(el.dataset.a=="kvt"){S.vpn=S.vpn=="on"?"off":"on";lsSet("kubo.vpn",S.vpn)}else{S.vpnC=el.dataset.v;lsSet("kubo.vpnc",S.vpnC);if(S.vpn!="on"){S.vpn="on";lsSet("kubo.vpn","on")}}
 vpnApply();render();toast(S.vpn=="on"?"Ligação privada ligada.":"Ligação privada desligada.")},true);
let vpnSynced=false;

/* ---------- render ---------- */
const _render=render;
/* o ecrã de entrada vive fora do #app: o app.js pode redesenhar o #app à vontade, que o launcher só se vê com conta */
function syncKModal(){let h=document.getElementById("kmod");if(!h){h=document.createElement("div");h.id="kmod";document.body.appendChild(h)}
 const had=document.getElementById("knick"),val=had?had.value:"";h.innerHTML=kmodal();const n=document.getElementById("knick");if(n&&had){n.value=val;n.focus()}}
function syncGate(){syncKModal();const g=document.getElementById("kgate"),need=!S.ready||!S.acc;document.body.classList.toggle("gated",need);
 if(!g)return;if(!need){g.innerHTML="";return}
 if(!S.ready){if(!g.firstChild)g.innerHTML='<div class="gate"><img class="gbg" src="img/bg.jpg" alt=""></div>';return}
 g.innerHTML=vGate()}
render=function(){syncGate();if(!S.ready||!S.acc)return;
 try{snapBars()}catch(x){}_render()};
/* o app.js às vezes volta a desenhar a página com a função antiga (sem passar por aqui): por isso tudo o que vem a seguir ao desenho
   corre também quando o #app muda, venha o desenho de onde vier */
let posting=false;
function post(){if(posting)return;posting=true;try{const t=document.querySelector('header.top');if(t)t.setAttribute('data-tauri-drag-region','')}catch(x){}if(!S.ready||!S.acc){posting=false;return}
 for(const f of [()=>{S.inst.forEach(loadPano)},()=>{if(!S.__hz){S.__hz=1;loadHz().then(()=>render());loadAllV()}},()=>{if(!impDone&&T&&S.acc){impDone=true;setTimeout(()=>scanImport(false),1500)}},capeCards,()=>{if(!vpnSynced&&T){vpnSynced=true;vpnApply()}},slideBar,enhanceSelects,mount3d,splitter,sideSplit,()=>{if(S.page=="play")loadNews()},swapIcons,heroApply]){try{f()}catch(x){console.error(x);if(f===mount3d)fallback2d(x)}}
 posting=false}
new MutationObserver(()=>post()).observe(document.getElementById("app"),{childList:true});
new MutationObserver(()=>{if(document.querySelector("#app select:not([data-k]):not([data-a=sel])"))enhanceSelects()}).observe(document.getElementById("app"),{childList:true,subtree:true});
/* blocos azuis que esticam de um botão para o outro (menu da esquerda e separadores). O bloco é o mesmo entre desenhos da página:
   antes de desenhar guardo onde ele está a meio da animação e depois continuo dali, por isso nunca salta. */
const bars=new Map();
function snapBars(){bars.forEach(b=>{if(!b.isConnected){return}const c=b.parentElement,cr=c.getBoundingClientRect(),br=b.getBoundingClientRect();
 b.__vis={left:br.left-cr.left-c.clientLeft,top:br.top-cr.top-c.clientTop,width:br.width,height:br.height,c:c.className}})}
function slideTo(key,c,a,cls){if(!c||!a)return;let b=bars.get(key);if(!b){b=document.createElement("i");bars.set(key,b)}b.className=cls;b.style.display="";c.prepend(b);
 const to={left:a.offsetLeft,top:a.offsetTop,width:a.offsetWidth,height:a.offsetHeight},fr=b.__vis&&b.__vis.c===c.className?b.__vis:(b.__tgt&&b.__tc===c.className?b.__tgt:to);b.__tgt=to;b.__tc=c.className;
 const put=(r,tr)=>{b.style.transition=tr||"none";b.style.left=r.left+"px";b.style.top=r.top+"px";b.style.width=r.width+"px";b.style.height=r.height+"px"};
 clearTimeout(b.__t);put(fr);b.__vis=null;
 if(fr.left===to.left&&fr.top===to.top&&fr.width===to.width&&fr.height===to.height)return;
 const l=Math.min(fr.left,to.left),tp=Math.min(fr.top,to.top),r=Math.max(fr.left+fr.width,to.left+to.width),bt=Math.max(fr.top+fr.height,to.top+to.height),un={left:l,top:tp,width:r-l,height:bt-tp};
 b.getBoundingClientRect();
 b.__t=setTimeout(()=>{put(un,"left .12s ease-in,top .12s ease-in,width .12s ease-in,height .12s ease-in");
  b.__t=setTimeout(()=>put(to,"left .18s cubic-bezier(.3,.9,.3,1),top .18s cubic-bezier(.3,.9,.3,1),width .18s cubic-bezier(.3,.9,.3,1),height .18s cubic-bezier(.3,.9,.3,1)"),120)},16)}
function slideBar(){const side=document.querySelector(".side");if(side)slideTo("side",side,side.querySelector(".nv.act"),"nvbar");
 document.querySelectorAll(".seg").forEach((sg,i)=>{const a=sg.querySelector("button.act");if(a)slideTo("seg"+i,sg,a,"segbar")})}

/* listas de escolha (Wide/Slim, versões...): em vez da lista do sistema, uma lista escura própria */
const chev='<svg viewBox="0 0 24 24" width="16" height="16" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M6 9l6 6 6-6"/></svg>';
function closePop(){document.querySelectorAll(".kpop").forEach(e=>e.remove())}
function enhanceSelects(){closePop();document.querySelectorAll("#app select:not([data-k]):not([data-a=sel])").forEach(sel=>{sel.dataset.k="1";sel.style.display="none";
 const b=document.createElement("button");b.type="button";b.className="ksel";if(sel.id)b.id="k-"+sel.id;
 const label=()=>{const o=sel.options[sel.selectedIndex];b.innerHTML=`<span>${esc(o?o.text:"")}</span>${chev}`};label();
 b.addEventListener("click",e=>{e.stopPropagation();if(document.querySelector(".kpop")){closePop();return}
  const r=b.getBoundingClientRect(),pop=document.createElement("div");pop.className="kpop";
  pop.innerHTML=[...sel.options].map((o,i)=>`<div data-i="${i}" class="${i==sel.selectedIndex?"on":""}"><span>${esc(o.text)}</span>${i==sel.selectedIndex?"<b>✓</b>":""}</div>`).join("");
  pop.style.minWidth=Math.max(r.width,150)+"px";pop.style.left=r.left+"px";document.body.appendChild(pop);
  const h=pop.offsetHeight;pop.style.top=(r.bottom+h+8>innerHeight?Math.max(8,r.top-h-6):r.bottom+6)+"px";
  pop.addEventListener("click",ev=>{const d=ev.target.closest("[data-i]");if(!d)return;sel.selectedIndex=+d.dataset.i;label();closePop();sel.dispatchEvent(new Event("change",{bubbles:true}))});
  const on=pop.querySelector(".on");if(on)on.scrollIntoView({block:"nearest"})});
 sel.after(b)})}
document.addEventListener("click",e=>{if(!e.target.closest(".kpop,.ksel"))closePop()});
const icOK={};
function swapIcons(){document.querySelectorAll(".nv[data-v]").forEach(b=>{const k=b.dataset.v;if(icOK[k]===false)return;
 const put=()=>{const s=b.querySelector("svg");if(s&&!b.querySelector("img.nvi")){const im=new Image();im.className="nvi";im.src="img/icons/"+k+".png";s.replaceWith(im)}};
 if(icOK[k])return put();const t=new Image();t.onload=()=>{icOK[k]=true;put()};t.onerror=()=>icOK[k]=false;t.src="img/icons/"+k+".png"})}

/* ---------- cliques (antes do app.js) ---------- */
document.addEventListener("click",async e=>{const el=e.target.closest("[data-a^=k]");if(!el)return;const a=el.dataset.a,v=el.dataset.v;
 const mine=["kms","kcr","kskip","kbug","krev","kcrgo","kclose","kcopy","kopen","klink"];if(!mine.includes(a))return;e.stopPropagation();
 if(a=="kms"){S.km="code";S.kcode=null;S.kfb=true;render();try{S.acc=await inv("ms_login");S.km="";S.guest=false;lsSet("kubo.guest","")}catch(x){S.km="";toast(er(x))}S.kcode=null;await ids();render()}
 else if(a=="kcr"){S.km="cr";render();setTimeout(()=>{const i=document.getElementById("knick");if(i)i.focus()},30)}
 else if(a=="kcrgo"){const n=document.getElementById("knick").value.trim();S.knick=n;try{S.acc=await inv("offline_login",{name:n});S.km="";S.guest=false;await ids();render()}catch(x){const r=document.getElementById("kerr");if(r)r.textContent=String(x)}}
 else if(a=="kclose"){S.km="";render()}
 else if(a=="kskip"){S.guest=true;lsSet("kubo.guest","1");render()}
 else if(a=="kbug")inv("open_url",{url:SITE+"/?bug"}).catch(x=>toast(er(x)))
 else if(a=="krev")inv("open_url",{url:SITE+"/?reviews"}).catch(x=>toast(er(x)))
 else if(a=="klink")inv("open_url",{url:v}).catch(x=>toast(er(x)))
 else if(a=="kcopy"){try{await navigator.clipboard.writeText(S.kcode.code);toast("Código copiado.")}catch(x){}}
 else if(a=="kopen"){inv("open_url",{url:S.kcode.url}).catch(x=>toast(er(x)))}
 else if(a=="kvpn"){if(v=="tog"){S.vpn=S.vpn=="on"?"off":"on";lsSet("kubo.vpn",S.vpn)}else{S.vpnScope=v;lsSet("kubo.vpnscope",v)}render()}
},true);
/* sair da conta: volta ao ecrã de entrada */
document.addEventListener("click",e=>{const el=e.target.closest('[data-a="logout"]');if(el){S.guest=false;lsSet("kubo.guest","");setTimeout(render,0)}},true);
document.addEventListener("input",e=>{if(e.target.id=="iq"){S.iq=e.target.value;const g=document.getElementById("igrid");if(g)g.innerHTML=igridH()}},true);
document.addEventListener("keydown",e=>{if(e.key=="Enter"&&e.target.id=="knick"){const b=document.querySelector('[data-a="kcrgo"]');if(b)b.click()}});

if(T){T.event.listen("ms-fallback",()=>{S.kcode=null;S.kfb=true;if(S.km=="code")render()});T.event.listen("ms-code",ev=>{S.kcode=ev.payload;if(S.km=="code"){render();inv("open_url",{url:ev.payload.url}).catch(()=>{})}})}

/* ---------- Galeria: capturas de ecrã e gravações do jogo ---------- */
const galIc=ic('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>');
if(!NAV.some(n=>n[0]=="gal"))NAV.splice(NAV.length-2,0,["gal","Galeria",galIc]);
const msrc=p=>T&&T.core&&T.core.convertFileSrc?T.core.convertFileSrc(p):p;
const msz=b=>b>1048576?(b/1048576).toFixed(1)+" MB":Math.max(1,Math.round(b/1024))+" KB";
const mdt=t=>new Date(t*1000).toLocaleString(KL&&KL.get?KL.get():undefined,{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
async function loadMedia(){try{S.media=await inv("media_list")}catch(e){S.media=[]}if(S.page=="gal")render()}
V.gal=function(){if(!S.media){loadMedia();return`<div class="pad"><p class="gmt">…</p></div>`}
 const f=S.mf||"all",all=S.media,l=all.filter(m=>f=="all"||m.kind==f);
 const tabs=[["all","Tudo"],["image","Capturas"],["video","Vídeos"]].map(t=>`<button class="${f==t[0]?"act":""}" data-a="kmf" data-v="${t[0]}">${t[1]} <small>${t[0]=="all"?all.length:all.filter(m=>m.kind==t[0]).length}</small></button>`).join("");
 return`<div class="pad"><div class="row sb"><div class="seg">${tabs}</div><button class="btn" data-a="kmr">Atualizar</button></div>
 ${l.length?`<div class="ggrid">${l.map(m=>`<div class="gcard" data-a="kmo" data-p="${encodeURIComponent(m.path)}"><div class="gth">${m.kind=="image"?`<img loading="lazy" src="${msrc(m.path)}">`:`<video preload="metadata" muted src="${msrc(m.path)}#t=0.5"></video><i class="gplay">${NI.play}</i>`}</div><div class="gin"><b>${m.instance}</b><span>${mdt(m.time)} · ${msz(m.size)}</span></div></div>`).join("")}</div>`:`<div class="gempty">${galIc}<b>Ainda não há nada aqui</b><span>As capturas de ecrã (F2) e os clips que gravares no jogo aparecem aqui.</span></div>`}</div>`};
function galView(m){const o=document.createElement("div");o.className="glb";const p=m.path;
 o.innerHTML=`<div class="gbox">${m.kind=="image"?`<img src="${msrc(p)}">`:`<video src="${msrc(p)}" controls autoplay></video>`}<div class="gbar"><span><b>${m.instance}</b> · ${mdt(m.time)} · ${msz(m.size)}</span><span class="gbt"><button class="btn" data-g="rev">Mostrar na pasta</button><button class="btn" data-g="del">Apagar</button><button class="btn p" data-g="x">Fechar</button></span></div></div>`;
 const close=()=>{const v=o.querySelector("video");if(v)v.pause();o.remove()};
 o.addEventListener("click",async e=>{const g=e.target.closest("[data-g]");if(e.target===o||(g&&g.dataset.g=="x"))return close();if(!g)return;
  if(g.dataset.g=="rev")inv("media_reveal",{path:p}).catch(x=>toast(er(x)));
  if(g.dataset.g=="del"){if(g.dataset.sure!="1"){g.dataset.sure="1";g.textContent=KL&&KL.t?KL.t("Apagar mesmo?"):"Apagar mesmo?";setTimeout(()=>{g.dataset.sure="";g.textContent=KL&&KL.t?KL.t("Apagar"):"Apagar"},3000);return}
   try{await inv("media_delete",{path:p});S.media=S.media.filter(x=>x.path!=p);close();render();toast("Apagado.")}catch(x){toast(er(x))}}});
 document.body.appendChild(o)}
document.addEventListener("click",e=>{const el=e.target.closest("[data-a=kmf],[data-a=kmr],[data-a=kmo]");if(!el)return;e.stopPropagation();const a=el.dataset.a;
 if(a=="kmf"){S.mf=el.dataset.v;render()}else if(a=="kmr"){S.media=null;render()}else{const p=decodeURIComponent(el.dataset.p),m=(S.media||[]).find(x=>x.path==p);if(m)galView(m)}},true);

/* ---------- atualização automática do launcher ---------- */
function updBox(){let b=document.getElementById("kupd");if(!b){b=document.createElement("div");b.id="kupd";document.body.appendChild(b)}
 if(!b.dataset.h){b.dataset.h=1;b.addEventListener("click",e=>{const u=e.target.closest("[data-u]");if(!u)return;const k=u.dataset.u;
  if(k=="no"){inv("quit_app").catch(()=>{try{window.close()}catch(x){}})}
  else if(k=="yes"||k=="retry"){doUpd(S.updVer)}
  else if(k=="x"){b.remove();S.updBusy=false}})}
 return b}
/* há uma versão nova: a app não deixa continuar sem atualizar (Sim atualiza, Não fecha a app) */
function askUpd(v){S.updVer=v;updBox().innerHTML=`<div class="ubox"><img src="img/mascot.png" alt=""><b>Esta app tem uma nova versão</b><span class="tag">Por favor atualiza a app para continuar a jogar. Queres atualizar agora?</span><span class="tag">v${esc(v||"")}</span><div class="row" style="gap:10px;justify-content:center;margin-top:6px"><button class="btn" data-u="no">Não, fechar a app</button><button class="btn p" data-u="yes">Sim, atualizar</button></div></div>`}
function showUpd(v,err){const b=updBox();
 b.innerHTML=err?`<div class="ubox"><b>Não foi possível atualizar. Tenta outra vez mais tarde.</b><div class="row" style="gap:10px;justify-content:center"><button class="btn" data-u="no">Fechar a app</button><button class="btn p" data-u="retry">Tentar outra vez</button></div></div>`
 :`<div class="ubox"><img src="img/mascot.png" alt=""><b>A atualizar o Sleep Launcher</b><span class="tag">Versão ${esc(v||"")} · não feches a janela, abre sozinho quando acabar.</span><div class="ubar"><i id="kubar"></i></div></div>`}
async function doUpd(v){try{showUpd(v);await inv("app_install_update")}catch(x){showUpd(null,String(x))}}
if(T)T.event.listen("progress",ev=>{const p=ev.payload;if(p&&p.stage=="Launcher"){const e=document.getElementById("kubar");if(e)e.style.width=Math.min(100,Math.round(p.done*100/Math.max(1,p.total)))+"%"}});
async function autoUpd(){if(!T||S.updBusy)return;try{const u=await inv("app_check_update");if(!u||!u.version)return;S.updBusy=true;askUpd(u.version)}catch(x){}}
if(T){setTimeout(autoUpd,1500);setInterval(autoUpd,30*60*1000)}
/* ecrã maximizado fica igual ao normal: a página é ampliada em proporção ao tamanho da janela */
async function fitZoom(){try{const A=window.__TAURI__;if(!A||!A.window||!A.webview)return;const w=A.window.getCurrentWindow(),[sz,sf]=await Promise.all([w.innerSize(),w.scaleFactor()]);
 const W=sz.width/sf,H=sz.height/sf,f=Math.round(Math.min(2,Math.max(1,Math.min(W/1160,H/740)))*20)/20;
 if(Math.abs((S.zf||1)-f)>.001){S.zf=f;await A.webview.getCurrentWebview().setZoom(f)}}catch(e){}}
addEventListener("resize",()=>{clearTimeout(S.zt);S.zt=setTimeout(fitZoom,150)});setTimeout(fitZoom,400);

/* ---------- ícone da app (como o Discord): presets feitos com a mascote + imagem tua ---------- */
const AIC=[["Padrão","#4a67e8","#1f2a5a"],["Noite","#232a5c","#0b0e24"],["Pôr do sol","#ff9966","#7a3fc4"],["Oceano","#2dd4bf","#1a4f9c"],["Floresta","#4ccf68","#134b2a"],["Doce","#ff6bb5","#8f4be0"],["Ouro","#f5c542","#c46a1c"],["Carvão","#3a3d4a","#101118"],["Gelo","#dff3ff","#7fb6ff"],["Sangue","#ff5a5f","#6a0f1c"]];
const MASC=new Image();MASC.src="img/mascot.png";
function mkIcon(c1,c2){const c=document.createElement("canvas");c.width=c.height=512;const g=c.getContext("2d"),r=112;g.beginPath();g.moveTo(r,0);g.arcTo(512,0,512,512,r);g.arcTo(512,512,0,512,r);g.arcTo(0,512,0,0,r);g.arcTo(0,0,512,0,r);g.closePath();
 const gr=g.createLinearGradient(0,0,512,512);gr.addColorStop(0,c1);gr.addColorStop(1,c2);g.fillStyle=gr;g.fill();g.save();g.clip();
 if(MASC.naturalWidth){const s=400;g.drawImage(MASC,56,64,s,s)}g.restore();return c.toDataURL("image/png")}
let AIU={};const aiUrl=i=>AIU[i]||(AIU[i]=mkIcon(AIC[i][1],AIC[i][2]));
async function useAppIcon(url,save){try{await inv("set_app_icon",{b64:url.split(",")[1]});if(save)S.aiSel=save;lsSet("kubo.appicon",JSON.stringify(save))}catch(x){toast("Não foi possível mudar o ícone.")}}
function aiSection(){const sel=S.aiSel||{p:0};return`<h3 class="vh">Ícone da app</h3><p class="tag">Muda o ícone do Sleep no Dock e na barra de tarefas. Escolhe um, ou carrega uma imagem tua.</p><div class="aigrid">${AIC.map((a,i)=>`<button class="aitile ${sel.p===i?"act":""}" data-a="kai" data-v="${i}" title="${esc(a[0])}"><img src="${aiUrl(i)}" alt=""></button>`).join("")}${sel.c?`<button class="aitile act" data-a="kai" data-v="c" title="A tua imagem"><img src="${sel.c}" alt=""></button>`:""}<label class="aitile aiup" title="Carregar imagem">+<input type="file" id="kaif" accept="image/*" hidden></label></div>`}
const _vSet3=vSet;vSet=function(){const h=_vSet3();return h.replace(/<\/div>\s*$/,aiSection()+"</div>")};
document.addEventListener("click",e=>{const el=e.target.closest("[data-a=kai]");if(!el)return;e.stopPropagation();const v=el.dataset.v;
 if(v=="c"&&S.aiSel&&S.aiSel.c){useAppIcon(S.aiSel.c,S.aiSel)}else{const i=+v;useAppIcon(aiUrl(i),{p:i})}render()},true);
document.addEventListener("change",async e=>{const t=e.target;if(t.id!="kaif"||!t.files[0])return;e.stopImmediatePropagation();
 const u=await shrink(t.files[0],512,512,true);useAppIcon(u,{c:u});render()},true);
try{const sv=JSON.parse(lsGet("kubo.appicon","null"));if(sv){S.aiSel=sv;MASC.onload=()=>setTimeout(()=>{const u=sv.c||(sv.p!=null&&sv.p>0?aiUrl(sv.p):null);if(u&&T)inv("set_app_icon",{b64:u.split(",")[1]}).catch(()=>{})},800);if(MASC.complete)MASC.onload()}}catch(e){}


/* ---------- fundo 3D da página inicial (no lugar da foto): Natal de 1 nov a 31 dez, depois a cena normal; dá para escolher nas definições ---------- */
const HERO=[["image","Imagem clássica"],["auto","Automático"],["christmas","Natal"],["fnaf","FNAF"]];
const heroKey=()=>{const v=lsGet("kubo.hero","image");if(v&&v!="auto")return v;const m=new Date().getMonth();return m>=10?"christmas":"fnaf"};
let K3L=null,K3S="";
function heroApply(){const h=document.querySelector(".hero");if(!h){if(window.K3D)K3D.pause();return}const k=heroKey();
 if(k=="image"){if(window.K3D)K3D.pause();h.classList.remove("h3d");return}
 if(!K3L)K3L=new Promise(r=>{const s=document.createElement("script");s.src="vendor/scene3d.js";s.onload=()=>r(1);s.onerror=()=>r(0);document.head.appendChild(s)});
 K3L.then(ok=>{if(!ok||!window.K3D)return;const hh=document.querySelector(".hero");if(!hh)return;
  /* o boneco é 3D dentro do cenário, com a tua skin */
  const im=S.skin&&S.skin.naturalWidth?S.skin:null;const sk=(S.acc&&S.acc.skins||[]).find(x=>x.state=="ACTIVE");
  const use=im||(STEVE&&STEVE.naturalWidth?STEVE:null);
  hh.classList.add("h3d");
  K3D.mount(hh,{scene:k,skin:use,slim:!!(sk&&sk.variant=="SLIM")})})}
function heroSection(){const cur=lsGet("kubo.hero","image")||"image";return`<h3 class="vh">Fundo da página inicial</h3><p class="tag">Cena 3D que aparece atrás do teu boneco. Automático: Natal de 1 de novembro a 31 de dezembro, o resto do ano a cena normal.</p><div class="row" style="gap:8px;flex-wrap:wrap">${HERO.map(h=>`<button class="btn ${cur===h[0]?"p":""}" data-a="khero" data-v="${h[0]}">${h[1]}</button>`).join("")}</div>`}
const _vSet4=vSet;vSet=function(){const h=_vSet4();return h.replace(/<\/div>\s*$/,heroSection()+"</div>")};
document.addEventListener("click",e=>{const el=e.target.closest("[data-a=khero]");if(!el)return;e.stopPropagation();lsSet("kubo.hero",el.dataset.v);render();heroApply()},true);

inv("get_account").then(a=>{S.acc=a}).catch(()=>{}).finally(()=>{S.ready=true;render();intro()});
})();
