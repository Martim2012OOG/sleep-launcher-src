/* Separadores da instância (passo 9B): Servidores, Mundos, Capturas, Logs e Definições.
   Carrega antes do app.js e usa os globais dele (S, inv, I, esc, toast…) só em tempo de execução. */
const X={srv:[],wld:[],shots:[],thumb:{},cfm:"",view:"",full:"",logPos:0,logTxt:"",follow:true,cfg:null,mk:null,run:{},conPos:0,conSess:0,conTxt:"",conCode:null};
const XIDS=["xsrv","xwld","xshot","xlog","xcon","xcfg"],ICONS=["🌲","⛏️","⚔️","🏰","🚀","🔥","❄️","🎮"];
const isX=()=>XIDS.includes(S.tab);
const xTabs=()=>[["xsrv","Servidores",I.srv],["xwld","Mundos",I.box],["xshot","Capturas",I.img],["xlog","Logs",I.chat],["xcon","Consola",I.term],["xcfg","Definições",I.gear]];
const fmtB=n=>n>=1e9?(n/1e9).toFixed(1)+" GB":n>=1e6?(n/1e6).toFixed(1)+" MB":Math.max(1,Math.round(n/1e3))+" kB";
const fdate=s=>s?new Date(s*1000).toLocaleString("pt-PT",{dateStyle:"short",timeStyle:"short"}):"—";
const xhere=n=>S.page=="inst"&&S.cur==n;
/* ---------- vistas ---------- */
function xBody(){const f={xsrv:xSrv,xwld:xWld,xshot:xShot,xlog:xLog,xcon:xCon,xcfg:xCfgV}[S.tab];return f?f():""}
const xTop=(txt,btn)=>`<div class="row sb" style="margin-bottom:12px;flex-wrap:wrap"><span class="tag">${txt}</span>${btn||""}</div>`;
const xFolder=v=>`<button class="btn" data-a="xopen" data-v="${v}">${I.folder}Abrir pasta</button>`;
function xSrv(){return`<div class="pad"><div class="row" style="flex-wrap:wrap"><input id="xn" placeholder="Nome (opcional)" style="flex:1;min-width:120px" maxlength="100"><input id="xi" placeholder="mc.exemplo.net" style="flex:2;min-width:160px" maxlength="255" autocomplete="off"><button class="btn p" data-a="xsadd">${I.plus}Adicionar</button></div><p class="tag">Fecha o jogo antes de editar: o Minecraft reescreve esta lista quando fecha. Entrar direto num servidor só funciona no 1.20 ou mais recente.</p><div class="ls" style="padding:0">${X.srv.map((s,i)=>`<div class="pn mc"><div class="t"><b>${esc(s.name)}</b><p>${esc(s.ip)}</p></div><button class="btn p" data-a="xsplay" data-v="${i}" aria-label="Jogar neste servidor">${I.play}</button><button class="btn ic dn" data-a="xsdel" data-v="${i}" aria-label="Remover">${I.trash}</button></div>`).join("")||`<div class="empty">Esta instância não tem servidores.</div>`}</div></div>`}
function xWld(){return`<div class="pad">${xTop(X.wld.length+" mundo(s)",xFolder("saves"))}<div class="ls" style="padding:0">${X.wld.map(w=>X.cfm==w.folder?`<div class="pn mc" style="border-color:var(--danger)"><div class="t"><b>Apagar «${esc(w.folder)}»?</b><p>Apaga o mundo e tudo o que tem. Não dá para desfazer.</p></div><button class="btn" data-a="xwno">Cancelar</button><button class="btn dn" data-a="xwyes" data-v="${esc(w.folder)}">Apagar</button></div>`:`<div class="pn mc"><div class="t"><b>${esc(w.folder)}</b><p>${fmtB(w.size)} · jogado ${fdate(w.modified)}</p></div><button class="btn ic dn" data-a="xwask" data-v="${esc(w.folder)}" aria-label="Apagar">${I.trash}</button></div>`).join("")||`<div class="empty">Esta instância ainda não tem mundos.</div>`}</div></div>`}
function xShot(){const k=f=>S.cur+"/"+f;return`<div class="pad">${xTop(X.shots.length+" captura(s) mais recentes",xFolder("screenshots"))}${X.shots.length?`<div class="gs">${X.shots.map(s=>`<button data-a="xshow" data-v="${esc(s.file)}" title="${esc(s.file)}"><img data-shot="${esc(s.file)}" alt="${esc(s.file)}"></button>`).join("")}</div>`:`<div class="empty">Sem capturas. Carrega em F2 dentro do jogo.</div>`}${X.view?`<div class="ov" data-a="xvclose"><div class="pn md" data-a="xnop" style="width:min(900px,100%);max-height:94vh;overflow:auto"><div class="row sb"><b style="overflow:hidden;text-overflow:ellipsis">${esc(X.view)}</b><span class="row"><button class="btn ${X.cfm=="s:"+X.view?"dn":"ic"}" data-a="xshdel">${X.cfm=="s:"+X.view?"Apagar mesmo?":I.trash}</button><button class="btn" data-a="xvclose">Fechar</button></span></div>${X.full?`<img src="${X.full}" alt="" style="max-width:100%;border-radius:8px;display:block">`:`<div class="empty">A carregar…</div>`}</div></div>`:""}</div>`}
const xLogHtml=(t,empty)=>t?t.split("\n").map(l=>{const c=/\b(ERROR|FATAL)\b|Exception/.test(l)?"le":/\bWARN\b/.test(l)?"lw":"";return c?`<span class="${c}">${esc(l)}</span>`:esc(l)}).join("\n"):`<span class="tag">${empty||"Ainda não há log. Joga uma vez e volta aqui."}</span>`;
function xLog(){return`<div class="pad">${xTop("Atualiza sozinho enquanto o jogo corre (latest.log).",`<span class="row"><span class="row tag">Seguir<span class="sw ${X.follow?"on":""}" data-a="xfollow" role="switch" aria-checked="${X.follow}"></span></span><button class="btn" data-a="xcopy">Copiar</button>${xFolder("logs")}</span>`)}<pre id="xlg" class="xlog">${xLogHtml(X.logTxt)}</pre></div>`}
function xCon(){const run=!!X.run[S.cur],st=run?"● O jogo está a correr.":X.conCode==null?"O jogo não está a correr.":X.conCode?"O jogo terminou com o código "+X.conCode+".":"O jogo terminou.";
 const stop=run?(X.cfm=="stop"?`<button class="btn dn" data-a="xstopyes">Parar mesmo?</button><button class="btn" data-a="xstopno">Não</button>`:`<button class="btn dn" data-a="xstop">Parar o jogo</button>`):"";
 return`<div class="pad">${xTop(st,`<span class="row"><span class="row tag">Seguir<span class="sw ${X.follow?"on":""}" data-a="xfollow" role="switch" aria-checked="${X.follow}"></span></span><button class="btn" data-a="xcopy">Copiar</button><button class="btn" data-a="xcclear">Limpar</button>${stop}</span>`)}<pre id="xcn" class="xlog">${xLogHtml(X.conTxt,"A consola mostra o que o jogo escreve enquanto corre. Carrega em Jogar.")}</pre></div>`}
function xCfgV(){const c=X.cfg;if(!c)return"";return`<div class="pad" style="max-width:680px"><div class="pn" style="padding:16px"><b>Instância</b><div class="row" style="margin-top:10px"><input id="cn" style="flex:1" value="${esc(c.name)}" maxlength="60" placeholder="Nome"></div><div class="tag" style="margin-top:12px">Ícone</div><div class="cats" style="margin-top:6px"><button class="chip ${c.icon?"":"act"}" data-a="xicon" data-v="">Letra</button>${ICONS.map(i=>`<button class="chip ${c.icon==i?"act":""}" data-a="xicon" data-v="${i}">${i}</button>`).join("")}</div></div>
<div class="pn" style="padding:16px;margin-top:12px"><b>Memória (RAM)</b><div class="tag">Em MB. A máxima é o limite que o jogo pode usar; a mínima é opcional (0 = automático).</div><div class="g2" style="margin-top:10px"><label class="tag">Mínima<input id="cmin" type="number" min="0" step="256" value="${c.min}" style="width:100%"></label><label class="tag">Máxima<input id="cmax" type="number" min="512" step="256" value="${c.max}" style="width:100%"></label></div><div class="cats" style="margin-top:10px">${[2048,4096,6144,8192,12288].map(m=>`<button class="chip ${c.max==m?"act":""}" data-a="xram" data-v="${m}">${m/1024} GB</button>`).join("")}</div></div>
<div class="pn" style="padding:16px;margin-top:12px"><b>Java e janela</b><div class="tag" style="margin-top:8px">Argumentos extra de Java (separados por espaços)</div><div class="row" style="margin-top:6px"><input id="cj" style="flex:1" value="${esc(c.jvm)}" placeholder="-XX:+UseG1GC" autocomplete="off"></div><div class="tag" style="margin-top:12px">Resolução da janela (0 e 0 = automático)</div><div class="g2" style="margin-top:6px"><input id="cw" type="number" min="0" value="${c.w}" aria-label="Largura"><input id="ch" type="number" min="0" value="${c.h}" aria-label="Altura"></div></div>
<div class="pn" style="padding:16px;margin-top:12px"><div class="row sb"><div><b>Consola</b><div class="tag">Abrir o separador Consola assim que carregas em Jogar.</div></div><span class="sw ${c.con?"on":""}" data-a="xconsw" role="switch" aria-checked="${!!c.con}"></span></div></div>
<div class="row" style="margin-top:14px"><button class="btn p" data-a="xsave">Guardar</button></div></div>`}
/* ---------- dados ---------- */
function xInitCfg(){const d=det();X.cfg=d?{name:d.name,min:d.ram_min||0,max:d.ram_max||2048,jvm:d.jvm_args||"",w:d.width||0,h:d.height||0,icon:d.icon||"",con:!!d.open_console}:null}
function xGrab(){const g=id=>document.getElementById(id),c=X.cfg;if(!c||!g("cn"))return;const n=id=>Math.max(0,Math.round(Number(g(id).value)||0));c.name=g("cn").value;c.min=n("cmin");c.max=n("cmax");c.jvm=g("cj").value;c.w=n("cw");c.h=n("ch")}
async function xEnter(tab){const name=S.cur;S.tab=tab;X.cfm="";X.view="";X.full="";if(tab=="xcfg")xInitCfg();render();
 try{if(tab=="xsrv")X.srv=await inv("list_servers",{name});else if(tab=="xwld")X.wld=await inv("list_worlds",{name});else if(tab=="xshot")X.shots=await inv("list_shots",{name})}catch(x){toast(er(x))}
 if(S.tab!=tab||S.cur!=name)return;render();if(tab=="xshot")xThumbs();if(tab=="xlog")xLogStart();if(tab=="xcon")xConStart()}
const shrink=u=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>{const w=320,h=Math.max(1,Math.round(im.height*w/Math.max(1,im.width))),c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(im,0,0,w,h);ok(c.toDataURL("image/jpeg",.7))};im.onerror=()=>no("imagem inválida");im.src=u});
async function xThumbs(){const name=S.cur;for(const s of X.shots){if(S.tab!="xshot"||S.cur!=name)return;const k=name+"/"+s.file;if(!X.thumb[k]){try{X.thumb[k]=await shrink(await inv("read_shot",{name,file:s.file}))}catch(x){X.thumb[k]="x"}}xAfter()}}
function xAfter(){if(!xhere(S.cur)||!det())return;if(S.tab=="xshot")document.querySelectorAll("[data-shot]").forEach(e=>{const u=X.thumb[S.cur+"/"+e.dataset.shot];if(u&&u!="x"&&e.getAttribute("src")!=u)e.src=u});
 if(S.tab=="xlog"){const e=document.getElementById("xlg");if(e&&X.follow)e.scrollTop=e.scrollHeight}}
const _ar=window.afterRender;window.afterRender=()=>{if(_ar)_ar();xAfter()};
let lt=0;
function xLogStart(){clearInterval(lt);X.logPos=0;X.logTxt="";const name=S.cur;
 const tick=async()=>{if(S.tab!="xlog"||!xhere(name)){clearInterval(lt);return}
  try{const r=await inv("read_log",{name,from:X.logPos}),old=X.logTxt;X.logPos=r.size;
   if(r.reset)X.logTxt=r.text;else if(r.text)X.logTxt+=r.text;else return;
   const cut=X.logTxt.length>300000;if(cut)X.logTxt=X.logTxt.slice(-300000);
   if(X.logTxt==old)return;const e=document.getElementById("xlg");if(!e)return;
   if(r.reset||cut||!old)e.innerHTML=xLogHtml(X.logTxt);else e.insertAdjacentHTML("beforeend",xLogHtml(r.text));
   if(X.follow)e.scrollTop=e.scrollHeight}catch(x){}};
 tick();lt=setInterval(tick,1500)}
let ct=0;
function xConStart(){clearInterval(ct);X.conPos=0;X.conSess=0;X.conTxt="";X.conCode=null;const name=S.cur;
 const tick=async()=>{if(S.tab!="xcon"||!xhere(name)){clearInterval(ct);return}
  try{const r=await inv("read_console",{name,from:X.conPos,session:X.conSess}),was=!!X.run[name],add=r.lines.length?r.lines.join("\n")+"\n":"";
   X.conPos=r.size;X.conSess=r.session;X.conCode=r.running?null:r.code;if(r.running)X.run[name]=true;else delete X.run[name];
   if(r.reset)X.conTxt=add;else X.conTxt+=add;
   const cut=X.conTxt.length>300000;if(cut)X.conTxt=X.conTxt.slice(-300000);
   if(was!=!!r.running){X.cfm="";render();return}
   if(!add&&!r.reset)return;const e=document.getElementById("xcn");if(!e)return;
   if(r.reset||cut||e.textContent==""||!X.conTxt.slice(0,-add.length))e.innerHTML=xLogHtml(X.conTxt);else e.insertAdjacentHTML("beforeend",xLogHtml(add.replace(/\n$/,""))+"\n");
   if(X.follow)e.scrollTop=e.scrollHeight}catch(x){}};
 tick();ct=setInterval(tick,700)}
/* chamados pelo app.js: o jogo arrancou/terminou, ou acabou de ser lançado */
function xGameState(p,quiet){if(p.running)X.run[p.name]=true;else delete X.run[p.name];if(quiet)return;
 if(S.page=="play"||(S.page=="inst"&&S.cur==p.name&&S.tab!="xcon")){if(S.tab=="xcfg")xGrab();render()}}
function xPlayed(name){const d=S.inst.find(i=>i.name==name);if(!window.__TAURI__)X.run[name]=true;
 if(d&&d.open_console){S.page="inst";S.mp=false;S.cur=name;xEnter("xcon")}}
async function xSetSrv(list){try{await inv("save_servers",{name:S.cur,servers:list});X.srv=await inv("list_servers",{name:S.cur})}catch(x){toast(er(x))}render()}
async function xSave(){xGrab();const c=X.cfg,d=det();if(!c||!d)return;
 try{const nm=await inv("save_inst_settings",{name:d.name,ramMin:c.min,ramMax:c.max,jvmArgs:c.jvm,width:c.w,height:c.h,icon:c.icon,newName:c.name,openConsole:!!c.con});
  const old=d.name;S.cur=nm;if(S.sel==old)S.sel=nm;await ids();xInitCfg();toast("Guardado.")}catch(x){toast(er(x))}render()}
/* cliques (devolve true se tratou) */
function xClick(a,v,n){
 if(a=="tab"&&XIDS.includes(v)){xEnter(v);return true}
 if(!a||a[0]!="x")return false;
 const name=S.cur,run=async f=>{try{await f()}catch(x){toast(er(x))}render()};
 if(a=="xnop")return true;
 if(a=="xgocon"){S.page="inst";S.mp=false;S.cur=n;xEnter("xcon");return true}
 if(a=="xopen")inv("open_sub",{name,sub:v}).catch(x=>toast(er(x)));
 else if(a=="xsadd"){const ip=document.getElementById("xi").value.trim(),nm=document.getElementById("xn").value.trim();if(!ip){toast("Põe o endereço do servidor.");return true}xSetSrv(X.srv.concat([{name:nm||ip,ip}]))}
 else if(a=="xsdel")xSetSrv(X.srv.filter((s,i)=>i!=+v))
 else if(a=="xsplay"){const s=X.srv[+v];if(s)play(name,s.ip)}
 else if(a=="xwask"){X.cfm=v;render()}
 else if(a=="xwno"){X.cfm="";render()}
 else if(a=="xwyes")run(async()=>{await inv("delete_world",{name,world:v});X.cfm="";X.wld=await inv("list_worlds",{name})})
 else if(a=="xshow"){X.view=v;X.full="";X.cfm="";render();inv("read_shot",{name,file:v}).then(u=>{if(X.view==v){X.full=u;render()}}).catch(x=>toast(er(x)))}
 else if(a=="xvclose"){X.view="";X.full="";X.cfm="";render();xAfter()}
 else if(a=="xshdel"){if(X.cfm!="s:"+X.view){X.cfm="s:"+X.view;render();return true}const f=X.view;run(async()=>{await inv("delete_shot",{name,file:f});X.view="";X.full="";X.cfm="";delete X.thumb[name+"/"+f];X.shots=await inv("list_shots",{name})}).then(xAfter)}
 else if(a=="xfollow"){X.follow=!X.follow;render()}
 else if(a=="xcopy"){const txt=S.tab=="xcon"?X.conTxt:X.logTxt;(navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast(S.tab=="xcon"?"Consola copiada.":"Log copiado.")).catch(()=>toast("Não consegui copiar."))}
 else if(a=="xcclear")run(async()=>{await inv("clear_console",{name});X.conTxt=""})
 else if(a=="xstop"){X.cfm="stop";render()}
 else if(a=="xstopno"){X.cfm="";render()}
 else if(a=="xstopyes")run(async()=>{X.cfm="";await inv("stop_game",{name})})
 else if(a=="xconsw"){xGrab();X.cfg.con=!X.cfg.con;render()}
 else if(a=="xicon"){xGrab();X.cfg.icon=v;render()}
 else if(a=="xram"){xGrab();X.cfg.max=+v;if(X.cfg.min>X.cfg.max)X.cfg.min=0;render()}
 else if(a=="xsave")xSave();
 else return false;
 return true}
/* preview sem Tauri */
function xMock(c,a){const mk=X.mk||(X.mk={srv:[{name:"Hypixel",ip:"mc.hypixel.net"},{name:"Amigos",ip:"kubo.exemplo.net"}],wld:[["Novo mundo",412e6,1],["Sobrevivência",1.3e9,2],["Criativo",88e6,3]],shots:["2026-10-24_21.03.11.png","2026-10-24_20.41.52.png","2026-10-23_18.12.07.png","2026-10-20_09.55.30.png"],inst:[{name:"Sleep 1.21.11",version:"1.21.11",loader:"fabric",installed:true},{name:"Fabric Performance",version:"1.21.10",loader:"fabric",installed:true},{name:"Vanilla 26.2",version:"26.2",loader:"vanilla",installed:false}],log:"",n:0}),ok=v=>Promise.resolve(v);

 if(c=="list_instances")return ok(mk.inst.map(i=>({...i})));
 if(c=="save_inst_settings"){const it=mk.inst.find(i=>i.name==a.name),nn=(a.newName||"").trim()||a.name;if(!it)return Promise.reject("instância não encontrada");if(a.ramMax&&a.ramMin>a.ramMax)return Promise.reject("RAM mínima: não maior que a máxima");if(!!a.width!=!!a.height)return Promise.reject("resolução inválida (põe largura e altura, ou deixa as duas a 0)");Object.assign(it,{name:nn,ram_min:a.ramMin,ram_max:a.ramMax,jvm_args:a.jvmArgs,width:a.width,height:a.height,icon:a.icon,open_console:!!a.openConsole});return ok(nn)}
 if(c=="list_servers")return ok(mk.srv.map(s=>({...s})));
 if(c=="save_servers"){mk.srv=a.servers.map(s=>({name:s.name||s.ip,ip:s.ip}));return ok(null)}
 if(c=="list_worlds")return ok(mk.wld.map(w=>({folder:w[0],size:w[1],modified:Date.now()/1e3-w[2]*86400})));
 if(c=="delete_world"){mk.wld=mk.wld.filter(w=>w[0]!=a.world);return ok(null)}
 if(c=="list_shots")return ok(mk.shots.map((f,i)=>({file:f,modified:Date.now()/1e3-i*86400})));
 if(c=="delete_shot"){mk.shots=mk.shots.filter(f=>f!=a.file);return ok(null)}
 if(c=="read_shot"){const cv=document.createElement("canvas");cv.width=960;cv.height=540;const g=cv.getContext("2d"),h=hue(a.file),gr=g.createLinearGradient(0,0,0,540);gr.addColorStop(0,`hsl(${h} 60% 62%)`);gr.addColorStop(1,`hsl(${(h+50)%360} 50% 28%)`);g.fillStyle=gr;g.fillRect(0,0,960,540);g.fillStyle="rgba(0,0,0,.35)";g.fillRect(0,400,960,140);g.fillStyle="#fff";g.font="28px sans-serif";g.fillText(a.file,24,60);return ok(cv.toDataURL("image/png"))}
 if(c=="read_log"){if(!mk.log)mk.log="[21:03:01] [main/INFO]: Loading Minecraft 1.21.11 with Fabric Loader\n[21:03:02] [main/WARN]: Mod 'example' requests a newer version of 'fabric'\n[21:03:05] [Render thread/INFO]: Setting user: Preview\n";else mk.log+=`[21:03:${String(6+mk.n++).padStart(2,"0")}] [Server thread/${mk.n%5==0?"ERROR":"INFO"}]: Tick ${mk.n}\n`;
  const len=mk.log.length,reset=!a.from||a.from>len;return ok({size:len,text:reset?mk.log:mk.log.slice(a.from),reset})}
 if(c=="create_instance"){if(mk.inst.some(i=>i.name==a.name))return Promise.reject("já existe uma instância com esse nome");mk.inst.push({name:a.name,version:a.version,loader:a.loader,installed:false});return ok(null)}
 if(c=="install_instance"){const it=mk.inst.find(i=>i.name==a.name);if(it)it.installed=true;return ok(null)}
 if(c=="delete_instance"){mk.inst=mk.inst.filter(i=>i.name!=a.name);return ok(null)}
 if(c=="play_instance"){const p=mk.con;mk.con={sess:(p?p.sess:0)+1,run:true,code:null,lines:["[Sleep] A iniciar o jogo…","[21:03:01] [main/INFO]: Loading Minecraft with Fabric Loader"],total:2,n:0};return ok("A iniciar "+a.name+"…")}
 if(c=="running_games")return ok(mk.con&&mk.con.run?[mk.inst[0].name]:[]);
 if(c=="stop_game"){const k=mk.con;if(!k||!k.run)return Promise.reject("o jogo não está a correr");k.run=false;k.code=null;k.lines.push("[Sleep] O jogo foi terminado.");k.total++;return ok(null)}
 if(c=="clear_console"){if(mk.con)mk.con.lines=[];return ok(null)}
 if(c=="read_console"){const k=mk.con;if(!k)return ok({running:false,code:null,session:0,size:0,lines:[],reset:a.from!=0});
  if(k.run){k.n++;k.lines.push(`[21:03:${String(5+k.n).padStart(2,"0")}] [Render thread/${k.n%4==0?"WARN":"INFO"}]: Passo ${k.n}`);k.total++;if(k.n>=(window.__conMax||14)){k.run=false;k.code=0;k.lines.push("[Sleep] O jogo terminou normalmente.");k.total++}}
  const base=k.total-k.lines.length,reset=k.sess!=a.session||a.from>k.total||a.from<base,st=reset?base:a.from;
  return ok({running:k.run,code:k.code,session:k.sess,size:k.total,lines:k.lines.slice(st-base),reset})}
 if(c=="open_sub")return ok(null);
 return undefined}
