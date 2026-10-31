/* Passo 11: Loja, capas e skins Sleep.
   Fala com o mesmo backend do mod (comandos Rust: o token nunca chega aqui). Formatos tirados do Social.java do mod:
   GET /wallet {coins} · GET /shop?category= {coins,categories,items[]} · POST /shop/buy {itemId} → {coins}
   PUT /wardrobe/equip {itemId} · DELETE /wardrobe/equip/<id ou "Capes">
   GET /capes {capes,skins,active:{capeId,skinId}} · PUT /capes/active {capeId,skinId} (os dois, null = nenhum)
   POST /capes {name,kind:"skin",image:"data:image/png;base64,…"} (só skins 64x64) · DELETE /capes/<id>
   Carrega depois de social.js (usa api, SO, $, enc, sErr) e antes de app.js. */
(()=>{
window.SHI={bag:'<svg class="i" viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/></svg>'};
const SH={cat:"All",cats:["All"],cache:{},coins:null,err:"",ld:false,busy:"",arm:"",armT:0,v:0,walletAt:0,allAt:0,acc:"",go:false,kgo:false,
 up:{capes:[],skins:[],ac:null,as:null,ld:false,err:"",ok:false,busy:false},ss:""};

const NOTWEAR=/^(emotes|bundles)$/i,isCape=it=>/^capes$/i.test(it.category);
const wearable=it=>!NOTWEAR.test(it.category);
function parseItem(o){if(!o||typeof o!="object"||o.id==null)return null;
 const price=Number(o.price)||0,fin=o.finalPrice!=null&&o.finalPrice!==""?Number(o.finalPrice):price;
 return{id:String(o.id),name:String(o.name||o.id),category:String(o.category||""),desc:String(o.description||"").replace(/Plegumo|Nimbo|Kubo/g,"Sleep"),badge:o.badge?String(o.badge):"",
  img:/^https:\/\//.test(String(o.imageUrl||""))?String(o.imageUrl):"",price,final:isNaN(fin)?price:fin,off:Number(o.discountPct)||0,
  owned:o.owned===true,equipped:o.equipped===true,feat:o.featured===true}}
const allItems=()=>Object.values(SH.cache).reduce((a,l)=>a.concat(l),[]);
const findItem=id=>allItems().find(x=>x.id==id)||null;
function shopItems(cat){if(SH.cache[cat])return SH.cache[cat];const all=SH.cache.All;if(!all)return null;
 return cat=="All"?all:cat=="Featured"?all.filter(x=>x.feat):cat=="Sale"?all.filter(x=>x.off>0):all.filter(x=>x.category.toLowerCase()==cat.toLowerCase())}
const same=(a,b)=>a.toLowerCase()==b.toLowerCase();

/* ---------- dados ---------- */
async function fetchShop(cat){const o=(await api("GET","/shop?category="+enc(cat)))||{};
 if(o.coins!=null&&!isNaN(Number(o.coins)))SH.coins=Number(o.coins);
 const cs=(Array.isArray(o.categories)?o.categories:[]).map(String).filter(Boolean);
 if(cs.length){if(!cs.includes("All"))cs.unshift("All");SH.cats=cs}
 const items=(Array.isArray(o.items)?o.items:[]).map(parseItem).filter(Boolean);
 SH.cache[cat]=items;if(cat=="All")SH.allAt=Date.now();return items}
async function loadShop(cat){if(cat)SH.cat=cat;const my=++SH.v;SH.err="";SH.ld=!shopItems(SH.cat);paintShop();
 try{if(Date.now()-SH.walletAt>3e4){SH.walletAt=Date.now();api("GET","/wallet").then(w=>{if(w&&w.coins!=null&&!isNaN(Number(w.coins)))SH.coins=Number(w.coins);paintShop()}).catch(()=>{})}
  await fetchShop(SH.cat);
  if(SH.cat!="All"&&Date.now()-SH.allAt>6e4)fetchShop("All").then(()=>{paintShop();paintKubo()}).catch(()=>{})}
 catch(x){if(my==SH.v)SH.err=sErr(x)}
 if(my==SH.v){SH.ld=false;paintShop();paintKubo()}}
const ensureAll=()=>{if(!SH.cache.All||Date.now()-SH.allAt>6e4)fetchShop("All").then(paintKubo).catch(()=>{})};
async function loadUp(){SH.up.ld=true;SH.up.err="";paintKubo();
 try{const o=(await api("GET","/capes"))||{};
  const up=(a,k)=>(Array.isArray(a)?a:[]).filter(x=>x&&x.id!=null&&(!x.kind||x.kind==k)).map(x=>({id:Number(x.id),name:String(x.name||k),img:/^https:\/\//.test(String(x.imageUrl||""))?String(x.imageUrl):""}));
  SH.up.capes=up(o.capes,"cape");SH.up.skins=up(o.skins,"skin");const a=o.active||{};
  SH.up.ac=a.capeId==null?null:Number(a.capeId);SH.up.as=a.skinId==null?null:Number(a.skinId);SH.up.ok=true}
 catch(x){SH.up.err=sErr(x)}
 SH.up.ld=false;paintKubo()}
function shopReset(){Object.assign(SH,{cat:"All",cats:["All"],cache:{},coins:null,err:"",ld:false,busy:"",arm:"",walletAt:0,allAt:0,go:false,kgo:false,v:SH.v+1});
 Object.assign(SH.up,{capes:[],skins:[],ac:null,as:null,ld:false,err:"",ok:false,busy:false})}

/* ---------- ações ---------- */
function hArm(k){SH.arm=k;paintShop();paintKubo();clearTimeout(SH.armT);SH.armT=setTimeout(()=>{SH.arm="";paintShop();paintKubo()},3500)}
async function buyItem(id){const it=findItem(id);if(!it||SH.busy)return;
 if(SH.coins!=null&&it.final>SH.coins){toast("Faltam "+(it.final-SH.coins)+" moedas.");return}
 if(SH.arm!="b"+id){hArm("b"+id);return}
 SH.arm="";SH.busy=id;paintShop();
 try{const r=await api("POST","/shop/buy",{itemId:it.id});if(r&&r.coins!=null&&!isNaN(Number(r.coins)))SH.coins=Number(r.coins);
  allItems().forEach(x=>{if(x.id==it.id)x.owned=true});SH.allAt=0;toast("Compraste "+it.name+"!")}
 catch(x){toast("Não deu para comprar: "+sErr(x))}
 SH.busy="";paintShop();paintKubo();loadShop().catch(()=>{})}
async function equipItem(id,on){const it=findItem(id);if(!it||SH.busy)return;SH.busy=id;paintShop();paintKubo();
 try{if(on)await api("PUT","/wardrobe/equip",{itemId:it.id});
  else await api("DELETE","/wardrobe/equip/"+enc(isCape(it)?"Capes":it.id));
  allItems().forEach(x=>{if(on&&x.id!=it.id&&same(x.category,it.category))x.equipped=false;if(x.id==it.id)x.equipped=on});
  SH.allAt=0;toast((on?"Equipado: ":"Tirado: ")+it.name)}
 catch(x){toast("Não deu: "+sErr(x))}
 SH.busy="";paintShop();paintKubo();loadShop().catch(()=>{})}
async function setActive(c,s){
 try{const r=await api("PUT","/capes/active",{capeId:c,skinId:s});const a=(r&&r.active)||{capeId:c,skinId:s};
  SH.up.ac=a.capeId==null?null:Number(a.capeId);SH.up.as=a.skinId==null?null:Number(a.skinId);toast("Guardado.")}
 catch(x){toast("Não deu para guardar: "+sErr(x))}
 paintKubo()}
async function delUp(id){if(SH.arm!="d"+id){hArm("d"+id);return}SH.arm="";
 try{await api("DELETE","/capes/"+enc(id));toast("Apagado.")}catch(x){toast("Não deu para apagar: "+sErr(x))}
 await loadUp()}
async function sendSkin(f){
 if(f.size>1048576){toast("A skin é demasiado grande (máx. 1 MB).");return}
 const b=new Uint8Array(await f.arrayBuffer());
 if(b.length<24||[137,80,78,71].some((v,i)=>b[i]!=v)){toast("Só ficheiros PNG.");return}
 const dv=new DataView(b.buffer),w=dv.getUint32(16),h=dv.getUint32(20);
 if(w==64&&h==32){toast("Isso é uma capa. As capas agora vêm da Loja.");return}
 if(w!=64||h!=64){toast("A skin tem de ser 64x64 (esta é "+w+"x"+h+").");return}
 const name=f.name.replace(/\.png$/i,"").slice(0,32)||"skin";
 const image=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f)});
 SH.up.busy=true;paintKubo();toast("A enviar a skin…",1);
 try{await api("POST","/capes",{name,kind:"skin",image});toast("Skin enviada. Carrega em Usar para a ativar.");await loadUp()}
 catch(x){toast("Não deu para enviar: "+sErr(x))}
 SH.up.busy=false;paintKubo()}
function hact(a,v,n){
 if(a=="h-cat")loadShop(v);
 else if(a=="h-buy")buyItem(v);
 else if(a=="h-eq")equipItem(v,n=="1");
 else if(a=="h-unc"){const c=allItems().find(x=>isCape(x)&&x.equipped);if(c)equipItem(c.id,false);else toast("Não tens nenhuma capa da loja equipada.")}
 else if(a=="h-skin")setActive(SH.up.ac,v===""||v==null?null:Number(v));
 else if(a=="h-cape")setActive(v===""||v==null?null:Number(v),SH.up.as);
 else if(a=="h-del")delUp(v);
 else if(a=="h-retry"){if(S.page=="shop")loadShop(SH.cat);else loadUp()}}

/* ---------- vistas ---------- */
const ph=(n,sz)=>`<span class="hph" style="background:linear-gradient(135deg,hsl(${hue(n)} 55% 42%),hsl(${(hue(n)+40)%360} 55% 28%))">${esc(String(n).trim()[0]||"K").toUpperCase()}</span>`;
const POSES=[[[-30,0],[30,0],[0,0],[0,0]],[[-150,0],[20,0],[8,0],[-8,0]],[[-120,10],[-120,-10],[0,0],[0,0]],[[40,-20],[-50,20],[35,0],[-35,0]]];
const mannequin=n=>{const p=POSES[hue(n)%POSES.length],g=(x,y,w,h,r,o,c)=>`<g transform="rotate(${r} ${x+w/2} ${y})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c||"#9aa0ac"}" stroke="#07080f" stroke-width="2"/></g>`;
 return`<span class="hph mq"><svg viewBox="0 0 80 100"><ellipse cx="40" cy="95" rx="22" ry="4" fill="rgba(0,0,0,.45)"/>${g(30,56,9,30,p[2][0])}${g(41,56,9,30,p[3][0])}${g(26,30,8,26,p[0][0])}${g(46,30,8,26,p[1][0])}<rect x="30" y="30" width="20" height="28" fill="#aeb4c0" stroke="#07080f" stroke-width="2"/><rect x="30" y="8" width="20" height="20" fill="#bfc5d0" stroke="#07080f" stroke-width="2"/></svg></span>`};
const pic=(u,n,c)=>`<div class="hcov" ${/capes/i.test(c||"")&&u?`data-cape="${esc(u)}"`:""}>${/emote/i.test(c||"")?mannequin(n):ph(n)}${u?`<img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-h="1">`:""}</div>`;
const coinsH=()=>SH.coins==null?"":`<span class="ch hcoin" title="As tuas moedas"><i class="coin"></i> ${fmt(SH.coins)} moedas</span>`;
function gate(t){
 if(!S.acc)return`<div class="pad"><h1>${t}</h1><p class="sub">Entra com a tua conta Microsoft para veres a loja e os teus itens. É a mesma conta e as mesmas moedas do mod Sleep.</p><button class="btn p" data-a="nav" data-v="char">Ir para Personagem</button></div>`;
 if(SO.st=="err")return`<div class="pad"><h1>${t}</h1><div class="pn" style="padding:18px;max-width:520px"><b>Não deu para ligar</b><p class="tag" style="margin:6px 0 14px">${esc(SO.err)}</p><button class="btn p" data-a="s-retry">Tentar outra vez</button></div></div>`;
 if(!SO.run)return`<div class="pad"><h1>${t}</h1><div class="empty">A ligar ao servidor…</div></div>`;
 return""}
function cardH(it){const busy=SH.busy==it.id,armed=SH.arm=="b"+it.id;let act;
 if(!it.owned){const short=SH.coins!=null&&it.final>SH.coins;
  act=`<button class="btn ${armed?"p":""}" data-a="h-buy" data-v="${esc(it.id)}" ${busy||short?"disabled":""}>${busy?"A comprar…":short?"Faltam "+(it.final-SH.coins):armed?"Confirmar?":it.final<=0?"Obter":"Comprar"}</button>`}
 else if(!wearable(it))act=`<span class="tag">Já tens</span>`;
 else act=`<button class="btn ${it.equipped?"":"p"}" data-a="h-eq" data-v="${esc(it.id)}" data-n="${it.equipped?"0":"1"}" ${busy?"disabled":""}>${busy?"…":it.equipped?"Tirar":"Equipar"}</button>`;
 const price=it.owned?`<span class="tag">${it.equipped?"Equipado":"Tens"}</span>`:`<span class="hpr">${it.off>0?`<s>${fmt(it.price)}</s> `:""}${it.final<=0?"Grátis":'<i class="coin st"></i> '+fmt(it.final)}</span>`;
 return`<div class="hc pn ${it.equipped?"on":""}">${pic(it.img,it.name,it.cat||it.category)}${it.badge?`<b class="hbd">${esc(it.badge)}</b>`:it.off>0?`<b class="hbd">-${it.off}%</b>`:""}
  <div class="hb"><b>${esc(it.name)}</b><span class="tag">${esc(it.category)}</span>${it.desc?`<p class="tag hds">${esc(it.desc)}</p>`:""}</div><div class="row sb hf">${price}${act}</div></div>`}
SH.view="items";SH.q="";
const CR=[["treasure","Baú do Tesouro",250,"55 / 28 / 13 / 4 %",null,[24,47]],["mimic","Baú Mimic",400,"40 / 32 / 20 / 8 %",[10,1,11,2],[26,42]],["present","Presente de Natal",300,"45 / 30 / 18 / 7 %",[10,28,12,31],[28,44]]];
const RAR={common:["Comum","#9aa1bb"],rare:["Raro","#4aa3ff"],epic:["Épico","#b06bff"],legendary:["Lendário","#ffb02e"]};
function inSeason(c){if(!c[4])return true;const d=new Date(),m=d.getMonth()+1,day=d.getDate(),[m1,d1,m2,d2]=c[4],v=m*100+day,a=m1*100+d1,e=m2*100+d2;return a<=e?(v>=a&&v<=e):(v>=a||v<=e)}
const seasonTxt=c=>c[4]?`${String(c[4][1]).padStart(2,"0")}/${String(c[4][0]).padStart(2,"0")} a ${String(c[4][3]).padStart(2,"0")}/${String(c[4][2]).padStart(2,"0")}`:"Sempre disponível";
const cspr=(id,f)=>`background:url(img/crates/${id}.png) ${-(f%8)*192}px ${-Math.floor(f/8)*192}px/1536px auto`;
function cratesH(){return`<div class="cgrid">${CR.map(c=>{const ok=inSeason(c),short=SH.coins!=null&&SH.coins<c[2];
 return`<div class="pn cc ${ok?"":"off"}"><div class="cspr" data-cr="${c[0]}" style="${cspr(c[0],0)}"></div><b>${c[1]}</b><span class="tag">${seasonTxt(c)}</span><span class="crate-rates">Comum / Raro / Épico / Lendário<br><i>${c[3]}</i></span>
 <div class="row sb hf"><span class="hpr"><i class="coin st"></i> ${c[2]}</span><button class="btn p" data-a="h-open" data-v="${c[0]}" ${ok&&!short?"":"disabled"}>${!ok?"Fora de época":short?"Faltam "+(c[2]-SH.coins):"Abrir"}</button></div></div>`}).join("")}</div><p class="tag" style="margin-top:12px">Os baús dão só cosméticos (emotes, auras e outros itens). Se já tiveres o item, recebes 40 % do preço em moedas.</p>`}
function shopBody(){let items=shopItems(SH.cat);
 if(SH.view=="crates")return cratesH();
 const tools=`<div class="stool"><select id="hcat">${SH.cats.map(c=>`<option value="${esc(c)}" ${SH.cat==c?"selected":""}>${esc(c=="All"?"Tudo":c=="Featured"?"Destaques":c=="Sale"?"Promoções":c)}</option>`).join("")}</select><label class="s"><input id="hq" value="${esc(SH.q)}" placeholder="Pesquisar…" autocomplete="off"></label></div>`;
 let body;
 if(SH.view=="inv"){const own=(shopItems("All")||[]).filter(x=>x.owned);items=own;
  if(SH.cat!="All")items=own.filter(x=>x.category.toLowerCase()==SH.cat.toLowerCase());}
 if(SH.q&&items)items=items.filter(x=>x.name.toLowerCase().includes(SH.q.toLowerCase()));
 if(SH.err&&!items)body=`<div class="pn" style="padding:18px;max-width:520px"><b>Não deu para abrir a loja</b><p class="tag" style="margin:6px 0 14px">${esc(SH.err)}</p><button class="btn p" data-a="h-retry">Tentar outra vez</button></div>`;
 else if(!items)body=`<div class="empty">A carregar…</div>`;
 else if(!items.length)body=`<div class="empty">${SH.view=="inv"?"Ainda não tens nada aqui. Compra itens na Loja ou abre baús.":"Ainda não há nada aqui."}</div>`;
 else body=`<div class="hgrid">${items.map(cardH).join("")}</div>`;
 return tools+body}
function vShop(){const g=gate("Loja");if(g)return g;
 return`<div class="pad"><div class="row sb"><div><h1>Loja</h1><p class="sub">Compras com moedas; o que equipares vê-se no jogo, com o client Sleep, e os teus amigos também o veem.</p></div><div id="hcoins">${coinsH()}</div></div>
 <div class="seg" style="margin:6px 0 14px"><button class="${SH.view=="items"?"act":""}" data-a="h-view" data-v="items">Itens</button><button class="${SH.view=="inv"?"act":""}" data-a="h-view" data-v="inv">Inventário</button><button class="${SH.view=="crates"?"act":""}" data-a="h-view" data-v="crates">Baús</button></div><div id="hmain">${shopBody()}</div></div>`}
function paintShop(){const m=$("hmain");if(m)m.innerHTML=shopBody();const c=$("hcoins");if(c)c.innerHTML=coinsH()}

/* separador "Sleep" da página Personagem */
function kuboH(){const g=gate("Personagem");
 if(g)return`<p class="tag">${!S.acc?"Entra com a tua conta Microsoft.":SO.st=="err"?esc(SO.err)+` <button class="lnk" data-a="s-retry">Tentar outra vez</button>`:"A ligar ao servidor…"}</p>`;
 const u=SH.up,capes=(SH.cache.All||[]).filter(x=>isCape(x)&&x.owned),worn=capes.find(x=>x.equipped);
 const skins=u.skins.map(s=>{const on=u.as==s.id,del=SH.arm=="d"+s.id;
  return`<div class="hc pn sk ${on?"on":""}">${pic(s.img,s.name)}<div class="hb"><b>${esc(s.name)}</b></div><div class="row sb hf"><button class="btn ${on?"":"p"}" data-a="h-skin" data-v="${on?"":s.id}">${on?"Tirar":"Usar"}</button><button class="btn ${del?"dn":"ic"}" data-a="h-del" data-v="${s.id}" aria-label="Apagar">${SI.x}${del?"Apagar?":""}</button></div></div>`}).join("");
 const old=u.capes.length?`<b style="display:block;margin-top:18px">Capas pessoais antigas</b><p class="tag">Já não se enviam capas novas, mas as que tinhas continuam aqui.</p><div class="cats" style="margin-top:8px"><button class="chip ${u.ac==null?"act":""}" data-a="h-cape" data-v="">Nenhuma</button>${u.capes.map(c=>`<button class="chip ${u.ac==c.id?"act":""}" data-a="h-cape" data-v="${c.id}">${esc(c.name)}</button>`).join("")}</div>`:"";
 return`<b>Capa da loja</b><p class="tag">As capas do Sleep compram-se na Loja e veem-se no jogo com o client Sleep.</p>
  <div class="cats" style="margin-top:8px"><button class="chip ${worn?"":"act"}" data-a="h-unc">Sem capa</button>${capes.map(c=>`<button class="chip ${c.equipped?"act":""}" data-a="h-eq" data-v="${esc(c.id)}" data-n="${c.equipped?"0":"1"}">${esc(c.name)}</button>`).join("")}</div>
  ${capes.length?"":`<p class="tag">${SH.cache.All?"Ainda não tens nenhuma capa.":"A carregar…"} <button class="lnk" data-a="nav" data-v="shop">Ver a Loja</button></p>`}
  <b style="display:block;margin-top:18px">Skins Sleep</b><p class="tag">Ficheiro PNG 64x64. Os outros jogadores com o client Sleep veem esta skin. A skin da conta Microsoft muda-se no separador Skins.</p>
  <div class="row"><input id="kskin" type="file" accept="image/png" style="flex:1" ${u.busy?"disabled":""}></div>
  ${u.err?`<p class="tag">Não deu para ler as skins: ${esc(u.err)} <button class="lnk" data-a="h-retry">Tentar outra vez</button></p>`:u.ld&&!u.ok?`<div class="empty">A carregar…</div>`:u.skins.length?`<div class="hgrid sg">${skins}</div>`:`<p class="tag">Ainda não enviaste nenhuma skin.</p>`}${old}`}
function paintKubo(){if(!(S.page=="char"&&S.ct=="kubo"))return;const e=$("kubo");if(e)e.innerHTML=kuboH()}
/* ---------- baús ---------- */
let openState=null;
document.addEventListener("click",e=>{const el=e.target.closest("[data-a='h-view'],[data-a='h-open'],[data-a='h-cc'],[data-a='h-again']");if(!el)return;e.stopPropagation();
 const a=el.dataset.a,v=el.dataset.v;
 if(a=="h-view"){SH.view=v;SH.q="";if(v=="inv")SH.cat="All";S.render?S.render():render()}
 else if(a=="h-open")crateOpen(v);else if(a=="h-cc"){closeCrate()}else if(a=="h-again"){const id=openState&&openState.id;closeCrate();if(id)crateOpen(id)}},true);
document.addEventListener("change",e=>{const t=e.target;if(t.id=="hcat"){SH.cat=t.value;if(SH.view=="items")loadShop(SH.cat);paintShop()}},true);
document.addEventListener("input",e=>{if(e.target.id=="hq"){SH.q=e.target.value;const m=$("hmain");if(m){const keep=e.target.selectionStart;paintShop();const i=$("hq");if(i){i.focus();i.setSelectionRange(keep,keep)}}}},true);
function closeCrate(){const o=document.getElementById("kcrate");if(o)o.remove();openState=null;try{paintShop();paintKubo()}catch(x){}}
async function crateOpen(id){const c=CR.find(x=>x[0]==id);if(!c||openState)return;
 openState={id};const o=document.createElement("div");o.id="kcrate";o.className="kcrate";
 o.innerHTML=`<div class="ckx"><div class="cglow"></div><div class="cbig" style="${cspr(id,0)}"></div><b class="cttl">${c[1]}</b><div class="cres"></div></div>`;document.body.appendChild(o);
 const big=o.querySelector(".cbig");let f=0,idle=setInterval(()=>{f=(f+1)%8;big.style.cssText=cspr(id,f)},90);
 let res=null,err=null;const req=api("POST","/shop/crate/open",{crateId:id}).then(r=>{res=r}).catch(x=>{err=x});
 await new Promise(r=>setTimeout(r,900));clearInterval(idle);
 await req;
 if(err){const m=String(err);big.style.cssText=cspr(id,0);
  const msg=/402|insuf|coins/i.test(m)?"Moedas insuficientes.":/403|season|época/i.test(m)?"Este baú está fora de época.":/404|405|501/.test(m)?"Os baús ainda não estão ativos no site. Não gastaste nada.":"Não deu para abrir: "+sErr(err);
  o.querySelector(".cres").innerHTML=`<p class="cmsg">${esc(msg)}</p><button class="btn p" data-a="h-cc">Fechar</button>`;return}
 let a=c[5][0];await new Promise(ok=>{const t=setInterval(()=>{big.style.cssText=cspr(id,a);o.querySelector(".cglow").classList.toggle("go",a>c[5][0]+6);if(a>=c[5][1]){clearInterval(t);ok()}a++},40)});
 const rw=(res&&res.reward)||{},it=parseItem(rw.item),rar=RAR[String(rw.rarity||"common").toLowerCase()]||RAR.common;
 if(res&&res.coins!=null&&!isNaN(Number(res.coins)))SH.coins=Number(res.coins);SH.cache={};SH.allAt=0;loadShop().catch(()=>{});
 o.querySelector(".cglow").style.background=`radial-gradient(circle,${rar[1]}99,transparent 65%)`;o.querySelector(".cglow").classList.add("go");
 o.querySelector(".cres").innerHTML=it?`<div class="prize" style="--rc:${rar[1]}"><div class="prar">${rar[0]}</div><div class="pimg">${it.img?`<img src="${esc(it.img)}" alt="">`:/emote/i.test(it.category)?mannequin(it.name):""}</div><b>${esc(it.name)}</b><span class="tag">${esc(it.category)}</span>${rw.duplicate?`<p class="tag">Já tinhas este item: recebeste ${fmt(rw.refund||0)} moedas.</p>`:`<p class="tag">Já está no teu inventário.</p>`}</div><div class="row" style="gap:10px;justify-content:center"><button class="btn" data-a="h-cc">Fechar</button><button class="btn p" data-a="h-again">Abrir outro (${c[2]})</button></div>`:`<p class="cmsg">Abriste o baú, mas o site não disse o que saiu.</p><button class="btn p" data-a="h-cc">Fechar</button>`}
setInterval(()=>{document.querySelectorAll(".cspr[data-cr]").forEach(el=>{const n=((+el.dataset.f||0)+1)%8;el.dataset.f=n;el.style.cssText=cspr(el.dataset.cr,n)})},110);
window.SH=SH;window.vShop=vShop;window.vKubo=()=>`<div id="kubo">${kuboH()}</div>`;

/* ---------- ligação ao resto da app ---------- */
const _ar=window.afterRender;
window.afterRender=()=>{if(_ar)_ar();shopHook()};
const onShop=()=>S.page=="shop",onKubo=()=>S.page=="char"&&S.ct=="kubo"&&!!S.acc;
function shopHook(){
 if(!S.acc){if(SH.acc){SH.acc="";shopReset()}return}
 if(SH.acc&&SH.acc!==S.acc.name)shopReset();SH.acc=S.acc.name;
 if(!onShop())SH.go=false;if(!onKubo())SH.kgo=false;
 if(!SO.run)return;
 if(onShop()&&!SH.go){SH.go=true;loadShop(SH.cat)}
 if(onKubo()&&!SH.kgo){SH.kgo=true;loadUp();ensureAll()}}
const _ps=window.paintSo;
window.paintSo=function(f){if(_ps)_ps(f);const s=typeof curSS=="function"?curSS():"";
 if(s!==SH.ss){SH.ss=s;if((onShop()||onKubo())&&!document.querySelector("[data-ss]"))render()}};
document.addEventListener("click",e=>{const el=e.target.closest("[data-a^='h-']");if(el)hact(el.dataset.a,el.dataset.v,el.dataset.n)});
document.addEventListener("change",e=>{const t=e.target;if(t.id=="kskin"&&t.files&&t.files[0]){const f=t.files[0];t.value="";sendSkin(f).catch(x=>toast("Não deu: "+sErr(x)))}});
document.addEventListener("error",e=>{const t=e.target;if(t&&t.tagName=="IMG"&&t.dataset&&t.dataset.h)t.remove()},true);

/* ---------- backend de exemplo (só no preview, sem Tauri) ---------- */
window.shopMock=function(m,p,b,ok,no){
 if(!(p.startsWith("/wallet")||p.startsWith("/shop")||p.startsWith("/wardrobe")||p.startsWith("/capes")))return false;
 const s=window.__shopMk=window.__shopMk||{coins:250,items:[
  {id:"cape_kubo",name:"Capa Sleep",category:"Capes",price:120,finalPrice:120,badge:"Novo",featured:true,description:"A capa oficial."},
  {id:"cape_fire",name:"Capa Fogo",category:"Capes",price:300,discountPct:20,finalPrice:240,owned:true},
  {id:"cape_ice",name:"Capa Gelo",category:"Capes",price:500,finalPrice:500},
  {id:"wings_neon",name:"Asas Neon",category:"Wings",price:800,finalPrice:800},
  {id:"hat_crown",name:"Coroa",category:"Hats",price:150,finalPrice:150,owned:true,equipped:true},
  {id:"emote_dab",name:"Dab",category:"Emotes",price:0,finalPrice:0},
  {id:"bundle_s",name:"Pack Inicial",category:"Bundles",price:400,finalPrice:400}],
  ups:[{id:7,name:"Steve azul",kind:"skin"},{id:8,name:"Ninja",kind:"skin"},{id:9,name:"Capa velha",kind:"cape"}],ac:null,as:7,next:20};
 let mt;
 if(m=="GET"&&p=="/wallet"){ok({coins:s.coins,daily:{ready:false}});return true}
 if(m=="GET"&&(mt=/^\/shop\?category=(.*)$/.exec(p))){const c=decodeURIComponent(mt[1]);
  ok({coins:s.coins,categories:["All","Featured","Sale","Capes","Wings","Hats","Emotes","Bundles"],items:s.items.filter(x=>c=="All"||(c=="Featured"?x.featured:c=="Sale"?x.discountPct>0:x.category==c))});return true}
 if(m=="POST"&&p=="/shop/buy"){const it=s.items.find(x=>x.id==b.itemId);
  if(!it){no("Item não existe");return true}if(it.owned){no("Já tens este item");return true}
  if(s.coins<it.finalPrice){no("Not enough coins");return true}s.coins-=it.finalPrice;it.owned=true;ok({coins:s.coins});return true}
 if(m=="PUT"&&p=="/wardrobe/equip"){const it=s.items.find(x=>x.id==b.itemId);if(!it||!it.owned){no("Não tens este item");return true}
  s.items.forEach(x=>{if(x.category==it.category)x.equipped=false});it.equipped=true;ok({});return true}
 if(m=="DELETE"&&(mt=/^\/wardrobe\/equip\/(.*)$/.exec(p))){const k=decodeURIComponent(mt[1]);
  s.items.forEach(x=>{if(x.id==k||x.category==k)x.equipped=false});ok({});return true}
 if(m=="GET"&&p=="/capes"){ok({capes:s.ups.filter(x=>x.kind=="cape"),skins:s.ups.filter(x=>x.kind=="skin"),active:{capeId:s.ac,skinId:s.as}});return true}
 if(m=="PUT"&&p=="/capes/active"){s.ac=b.capeId;s.as=b.skinId;ok({active:{capeId:s.ac,skinId:s.as}});return true}
 if(m=="POST"&&p=="/capes"){if(!/^data:image\/png;base64,/.test(b.image||"")||b.kind!="skin"){no("Pedido inválido");return true}
  s.ups.push({id:s.next++,name:b.name,kind:"skin"});ok({skin:{id:s.next-1}});return true}
 if(m=="DELETE"&&(mt=/^\/capes\/(\d+)$/.exec(p))){const id=Number(mt[1]);s.ups=s.ups.filter(x=>x.id!=id);if(s.as==id)s.as=null;if(s.ac==id)s.ac=null;ok({});return true}
 return false};
})();
