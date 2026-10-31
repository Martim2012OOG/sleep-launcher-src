/* Amigos e chat. Fala com o mesmo backend do mod (via comandos Rust: o token nunca chega aqui).
   Carrega ANTES de app.js; só usa S, inv, esc, hue, toast, er, play, cur, render em tempo de execução. */
const SO={run:false,st:"off",err:"",acc:"",me:null,friends:[],groups:[],cg:"",gtotal:0,gun:{},gl:false,notes:[],nun:0,nl:false,nopen:false,rp:0,gnew:null,minv:null,gmem:{},gmo:false,inc:[],out:[],unread:{},total:0,sel:"",msgs:{},sig:{},draft:{},tab:"fr",
 status:"online",online:new Set(),ws:null,edit:0,arm:"",n:0,inb:false,lp:null,hasReq:null,loaded:false};
try{const s=localStorage.getItem("kubo.status");if(["online","away","busy","invisible"].includes(s))SO.status=s}catch(e){}
const SI={
 edit:'<svg class="i" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/></svg>',
 send:'<svg class="i sendi" viewBox="0 0 24 24"><path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.993.993 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"/></svg>',
 trash:'<svg class="i" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
 ok:'<svg class="i" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
 x:'<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 plus:'<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
 play:'<svg class="i" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>',
 bell:'<svg class="i" viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/></svg>',
 smile:'<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/></svg>',
 users:'<svg class="i" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/></svg>',
 flag:'<svg class="i" viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>'};
const STAT={online:"Online",away:"Ausente",busy:"Ocupado",invisible:"Invisível"};
const INVITE=/\[ghost-invite\|v1\|([^|\]]*)\|([^\]]*)\]/;
const GIFURL=/^https:\/\/(media\d?\.giphy\.com|i\.giphy\.com|media\d?\.tenor\.com|c\.tenor\.com)\/\S+$/;

/* ---------- lógica pura (testável) ---------- */
const norm=u=>u?String(u).replace(/-/g,"").toLowerCase():"";
const dn=u=>(u&&(u.mcUsername||u.name))||"?";
function parseUser(o){if(!o||typeof o!="object")return null;
 return{id:o.id||o.userId||null,name:o.name||o.username||null,mcUsername:o.mcUsername||null,mcUuid:o.mcUuid||null,image:o.image||null,status:o.status||null,activity:typeof o.activity=="string"?o.activity:null}}
function isOnline(u){return SO.online.has(norm(u.mcUuid))||["online","in_game"].includes(String(u.status||"").toLowerCase())}
/* online | away | busy | web | off (igual ao User.state() do mod) */
function stateOf(u){const s=String(u.status||"").toLowerCase(),game=SO.online.has(norm(u.mcUuid));
 if(s=="invisible"||(s=="offline"&&!game))return"off";
 if(s=="away"||s=="idle")return"away";
 if(s=="busy"||s=="dnd")return"busy";
 if(game||s=="online"||s=="in_game")return"online";
 if(s=="mobile"||s=="web")return"web";
 return"off"}
const DOT={online:"o",away:"a",busy:"b",web:"w",off:"z"},SLAB={online:"Online",away:"Ausente",busy:"Ocupado",web:"No telemóvel",off:"Offline"};
const ORD={online:0,web:1,away:2,busy:3,off:4};
const sortF=l=>l.slice().sort((a,b)=>ORD[stateOf(a)]-ORD[stateOf(b)]||dn(a).localeCompare(dn(b),"pt",{sensitivity:"base"}));
function parseReqs(a){const out=[];for(const o of a||[]){if(!o)continue;const uo=o.user||o.from||o.to||o;const id=o.requestId||o.id,u=parseUser(uo);if(id&&u)out.push({id:String(id),user:u})}return out}
function parseFriends(o){const fr=[];for(const e of(o&&o.friends)||[]){const u=parseUser(e&&e.user?e.user:e);if(u&&u.id)fr.push(u)}return{friends:fr,inc:parseReqs(o&&o.incoming),out:parseReqs(o&&o.outgoing)}}
function parseMsg(o,partner){const m={id:Number(o.id)||0,kind:o.kind||"text",body:o.body??o.text??o.content??"",createdAt:o.createdAt||o.created_at||null,editedAt:o.editedAt||o.edited_at||null,mine:false,server:null,address:null,react:parseReact(o.reactions||o.reaction),who:null,sid:null};
 const so=o.sender||o.user||o.author,sobj=so&&typeof so=="object"?so:null,
  sid=o.senderId||o.sender_id||o.fromUserId||o.from_user_id||o.fromId||o.authorId||o.author_id||(sobj&&sobj.id)||(o.from&&typeof o.from=="object"?o.from.id:o.from)||null;
 const to=o.recipientId||o.recipient_id||o.receiverId||o.receiver_id||o.toUserId||o.to_user_id||o.toId||o.to||null;
 const flag=[o.mine,o.isMine,o.fromMe,o.outgoing,o.sentByMe].find(x=>typeof x=="boolean");
 m.sid=sid?String(sid):null;if(sobj)m.who=parseUser(sobj);
 if(flag!==undefined)m.mine=flag;
 else if(sid&&SO.me&&sid==SO.me.id)m.mine=true;
 else if(sid&&partner)m.mine=sid!=partner;
 else if(to&&partner)m.mine=to==partner;
 const meta=o.meta;if(meta&&typeof meta=="object"){m.server=meta.serverName||meta.name||null;m.address=meta.address||meta.serverAddress||null}
 if(typeof m.body=="string"){const mt=INVITE.exec(m.body);if(mt){m.server=m.server||mt[1];m.address=m.address||mt[2];m.body=(m.body.slice(0,mt.index)+m.body.slice(mt.index+mt[0].length)).trim();m.kind="invite"}}
 if(m.kind=="invite"&&!m.address)m.kind="text";
 return m}
/* o servidor devolve a lista inteira: mantém só as mensagens locais por enviar / falhadas */
function mergeChat(prev,got){const keep=(prev||[]).filter(m=>m.pending||m.failed);return got.slice().sort((a,b)=>a.id-b.id).concat(keep)}
const sigOf=l=>JSON.stringify(l.map(m=>[m.id,m.body,m.editedAt,!!m.pending,!!m.failed,m.react]));
const prev=b=>!b?"uma mensagem":String(b).startsWith("[kubo-wp] ")?"partilhou uma localização":GIFURL.test(String(b))?"GIF":INVITE.test(String(b))?"convite para um servidor":String(b).slice(0,80);
function tm(iso){const d=new Date(iso);return isNaN(d)?"":d.toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})}
function dayKey(iso){const d=new Date(iso);return isNaN(d)?"":d.getFullYear()+"-"+d.getMonth()+"-"+d.getDate()}
function dayLabel(iso){const d=new Date(iso),t=new Date(),y=new Date(Date.now()-864e5);
 if(dayKey(iso)==dayKey(t))return"Hoje";if(dayKey(iso)==dayKey(y))return"Ontem";return d.toLocaleDateString("pt-PT",{day:"numeric",month:"long"})}

/* ---------- pedidos ---------- */
const sq=(m,p,b)=>(typeof T!="undefined"&&T)?T.core.invoke("social_req",{method:m,path:p,body:b===undefined?null:b}):mockApi(m,p,b);
async function api(m,p,b){try{return await sq(m,p,b)}catch(x){if(String(x)=="SESSION_EXPIRED"){await soLogin();return await sq(m,p,b)}throw x}}
const sErr=x=>{const s=String(x);return s=="preview"?"No preview não há servidor.":s=="SESSION_EXPIRED"?"A sessão acabou. Tenta outra vez.":s}; 
function soLogin(){if(SO.lp)return SO.lp;SO.st="connecting";SO.err="";paintSo();
 const real=(typeof T!="undefined"&&T);
 SO.lp=(real?T.core.invoke("social_login"):Promise.resolve(mockMe())).then(u=>{if(!u||!u.id)throw"O servidor não devolveu o teu perfil";SO.me=parseUser(u);SO.st="on";SO.err=""})
  .catch(x=>{SO.st="err";SO.err=sErr(x);throw x}).finally(()=>{SO.lp=null;paintSo()});return SO.lp}

/* ---------- ciclo de vida ---------- */
async function socialStart(){if(SO.run||SO.st=="connecting")return;SO.acc=S.acc.name;
 try{await soLogin()}catch(x){const retry=!/Microsoft|Chave/.test(SO.err);if(retry){clearTimeout(SO.rt);SO.rt=setTimeout(()=>{if(S.acc&&SO.st=="err"){SO.st="off";socialStart()}},20000)}return}
 SO.run=true;SO.loaded=false;
 await Promise.all([loadFriends(),loadInbox(),loadGroups(),loadNotes()].map(p=>p.catch(()=>{})));SO.loaded=true;paintSo();
 setStatus(SO.status,true);presenceStart();
 SO.t1=setInterval(()=>{if(!document.hidden)loadInbox().catch(()=>{})},6000);
 SO.t2=setInterval(()=>{if(!document.hidden){loadFriends().catch(()=>{});loadGroups().catch(()=>{})}},20000);
 SO.t5=setInterval(()=>{if(!document.hidden)loadNotes().catch(()=>{})},15000);
 SO.t3=setInterval(()=>{if(!document.hidden)pollChat()},2500);
 SO.t4=setInterval(()=>{if(SO.status!="online")return;api("POST","/me/status",{status:SO.status}).catch(()=>{})},300000)}
function socialStop(){[SO.t1,SO.t2,SO.t3,SO.t4,SO.t5,SO.pi].forEach(clearInterval);clearTimeout(SO.rt);clearTimeout(SO.pt);
 const w=SO.ws;SO.ws=null;if(w){try{w.close()}catch(e){}}
 Object.assign(SO,{run:false,st:"off",err:"",me:null,friends:[],groups:[],cg:"",gtotal:0,gun:{},gl:false,notes:[],nun:0,nl:false,nopen:false,rp:0,gnew:null,minv:null,gmem:{},gmo:false,inc:[],out:[],unread:{},total:0,sel:"",msgs:{},sig:{},online:new Set(),inb:false,loaded:false,edit:0});
 badge();paintSo();paintBell()}
window.afterRender=()=>{
 if(!S.acc){if(SO.run||SO.st!="off")socialStop();return}
 if(SO.run&&SO.acc!==S.acc.name)socialStop();
 if(!SO.run&&SO.st=="off")socialStart();
 if(S.page!="chat"){SO.gnew=null;SO.minv=null}
 if(S.page=="chat")paintSo(true)};

/* ---------- dados ---------- */
async function loadFriends(){const r=await api("GET","/friends");const p=parseFriends(r);
 if(SO.loaded&&p.inc.some(q=>!SO.inc.some(o=>o.id==q.id)))toast("Novo pedido de amizade de "+dn(p.inc.find(q=>!SO.inc.some(o=>o.id==q.id)).user));
 SO.friends=p.friends;SO.inc=p.inc;SO.out=p.out;
 if(SO.sel&&!SO.friends.some(f=>f.id==SO.sel))SO.sel="";
 paintSo()}
async function loadInbox(){const r=await api("GET","/messages");const map={},first=!SO.inb;SO.inb=true;
 for(const c of(r&&r.conversations)||[]){const u=parseUser(c.user),n=Number(c.unread)||0;
  if(u&&u.id&&n>0){map[u.id]=n;
   if(!first&&n>(SO.unread[u.id]||0)&&!(S.page=="chat"&&SO.sel==u.id&&!document.hidden)){
    const l=c.lastMessage&&c.lastMessage.body;toast(dn(u)+": "+prev(l))}}}
 SO.unread=map;SO.total=r&&r.unreadTotal!=null?Number(r.unreadTotal)||0:Object.values(map).reduce((a,b)=>a+b,0);
 badge();paintList()}
async function pollChat(){const id=ck();if(!id||S.page!="chat"||SO.cb)return;SO.cb=true;
 try{const g=isG(id),r=await api("GET",mpath(id)+"?limit=30");if(ck()!=id)return;
  const got=((r&&r.messages)||[]).filter(Boolean).map(o=>parseMsg(o,g?null:id));
  const old=SO.msgs[id],had=new Set((old||[]).map(m=>m.id));
  const fresh=!!old&&got.some(m=>!had.has(m.id)&&!m.mine);
  SO.msgs[id]=mergeChat(old,got);
  const s=sigOf(SO.msgs[id]);if(s!=SO.sig[id]){SO.sig[id]=s;paintMsgs(!old||fresh)}
  if(fresh||unreadOf(id)>0)markRead(id)}
 catch(x){if(!SO.msgs[id]){SO.msgs[id]=[];paintMsgs(true)}}
 finally{SO.cb=false}}
async function markRead(id){
 if(isG(id)){const gi=id.slice(2);try{await api("POST","/groups/"+enc(gi)+"/read",{})}catch(e){}
  const n=SO.gun[gi]||0;delete SO.gun[gi];SO.gtotal=Math.max(0,SO.gtotal-n);badge();paintList();return}
 try{await api("POST","/messages/read",{userId:id})}catch(e){}
 const n=SO.unread[id]||0;delete SO.unread[id];SO.total=Math.max(0,SO.total-n);badge();paintList()}
async function setStatus(v,quiet){SO.status=v;try{localStorage.setItem("kubo.status",v)}catch(e){}
 if(v=="invisible"){const w=SO.ws;SO.ws=null;clearTimeout(SO.pt);if(w){try{w.close()}catch(e){}}SO.online=new Set()}
 else if(SO.run&&!SO.ws)presenceStart();
 if(!quiet||v!="online")api("POST","/me/status",{status:v}).catch(()=>{});
 paintList();paintHead()}

/* ---------- presença (a mesma sala "lobby" do mod) ---------- */
async function sha(s){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function presenceStart(){if(SO.status=="invisible"||SO.ws||SO.pc||!SO.run||!SO.me||!SO.me.mcUuid)return;SO.pc=true;
 try{const r=await api("POST","/issue-token",{});const jwt=r&&r.token;if(!jwt)throw"sem token";
  if(typeof WebSocket=="undefined"||typeof T=="undefined"||!T)return;
  const room=await sha("plegumo-lobby-v1"),ws=new WebSocket("wss://plegumo-presence.plegumo.workers.dev/ws/"+room);SO.ws=ws;
  ws.onopen=()=>ws.send(JSON.stringify({t:"hello",token:jwt,uuid:norm(SO.me.mcUuid),nick:SO.me.mcUsername||(S.acc&&S.acc.name)||""}));
  ws.onmessage=ev=>{try{presMsg(ev.data)}catch(e){}};
  ws.onerror=()=>{try{ws.close()}catch(e){}};
  ws.onclose=()=>{if(SO.ws!==ws)return;SO.ws=null;SO.online=new Set();paintSo();
   if(SO.run&&SO.status!="invisible"){SO.back=Math.min((SO.back||4000)*1.7,60000);clearTimeout(SO.pt);SO.pt=setTimeout(presenceStart,SO.back)}};
  clearInterval(SO.pi);SO.pi=setInterval(()=>{if(SO.ws&&SO.ws.readyState==1)SO.ws.send("ping")},25000)}
 catch(x){if(SO.run&&SO.status!="invisible"){SO.back=Math.min((SO.back||4000)*1.7,60000);clearTimeout(SO.pt);SO.pt=setTimeout(presenceStart,SO.back)}}
 finally{SO.pc=false}}
function presMsg(d){if(d=="pong")return;const o=JSON.parse(d);
 if(o.t=="list"){SO.online=new Set((o.players||[]).map(p=>norm(p.u)));SO.back=0}
 else if(o.t=="delta"){const s=new Set(SO.online);(o.join||[]).forEach(p=>s.add(norm(p.u)));(o.leave||[]).forEach(u=>s.delete(norm(u)));SO.online=s}
 else return;
 paintList();paintHead()}

/* ---------- ações ---------- */
function openChat(id){SO.sel=id;SO.cg="";SO.gmo=false;SO.tab="fr";SO.edit=0;SO.arm="";S.page="chat";S.mp=false;S.cur="";render()}
function selectFriend(id){SO.sel=id;SO.cg="";SO.gmo=false;SO.rp=0;SO.edit=0;SO.arm="";paintList();paintHead();paintMem();paintComposer();paintMsgs(true);
 const i=$("smi");if(i){i.value=SO.draft[id]||"";i.focus()}
 if(!SO.msgs[id])SO.sig[id]="";pollChat()}
async function soSend(){const inp=document.getElementById("smi"),id=ck();if(!inp||!id)return;const t=inp.value.trim();if(!t)return;
 if(SO.edit){const eid=SO.edit,m=(SO.msgs[id]||[]).find(x=>x.id==eid);SO.edit=0;inp.value="";SO.draft[id]="";paintComposer();
  if(m&&t!=m.body){const old=m.body,oe=m.editedAt;m.body=t;m.editedAt=new Date().toISOString();SO.sig[id]=sigOf(SO.msgs[id]);paintMsgs();
   try{await api("PATCH","/messages/"+encodeURIComponent(eid),{body:t})}catch(x){m.body=old;m.editedAt=oe;SO.sig[id]=sigOf(SO.msgs[id]);paintMsgs();toast("Não deu para editar: "+sErr(x))}}
  return}
 inp.value="";SO.draft[id]="";const p={lid:"l"+(++SO.n),pending:true,mine:true,body:t,kind:"text",createdAt:new Date().toISOString(),id:0};
 (SO.msgs[id]=SO.msgs[id]||[]).push(p);SO.sig[id]=sigOf(SO.msgs[id]);paintMsgs(true);await postMsg(id,p)}
async function postMsg(id,p){p.pending=true;p.failed=false;
 try{const r=await (isG(id)?api("POST","/groups/"+enc(id.slice(2))+"/messages",{body:p.body}):api("POST","/messages",{userId:id,body:p.body}));const l=SO.msgs[id]||[],i=l.indexOf(p),real=r&&r.message?parseMsg(r.message,isG(id)?null:id):null;
  if(i>=0){if(real){real.mine=true;if(l.some(x=>!x.pending&&!x.failed&&x.id==real.id))l.splice(i,1);else l[i]=real}else p.pending=false}}
 catch(x){p.pending=false;p.failed=true;toast("Não enviou: "+sErr(x))}
 p.pending=false;if(SO.msgs[id])SO.sig[id]=sigOf(SO.msgs[id]);if(SO.sel==id)paintMsgs(true)}
function armed(k){SO.arm=k;paintHead();paintMem();paintMsgs();clearTimeout(SO.at);SO.at=setTimeout(()=>{SO.arm="";paintHead();paintMem();paintMsgs()},3500)}
async function act(a,v){
 try{
  if(a=="s-tab"){SO.tab=v;paintList()}
  else if(a=="s-sel")selectFriend(v)
  else if(a=="s-open")openChat(v)
  else if(a=="s-login"){S.page="char";render()}
  else if(a=="s-retry"){SO.st="off";socialStart()}
  else if(a=="s-add"){const i=document.getElementById("sadd"),q=i&&i.value.trim();if(!q)return;i.value="";
   await api("POST","/friends",{query:q});toast("Pedido enviado a "+q);SO.tab="rq";await loadFriends()}
  else if(a=="s-acc"||a=="s-rej"){await api("PATCH","/friends/"+encodeURIComponent(v),{action:a=="s-acc"?"accept":"reject"});
   toast(a=="s-acc"?"Agora são amigos.":"Pedido recusado.");await loadFriends()}
  else if(a=="s-cancel"){await api("DELETE","/friends/"+encodeURIComponent(v));toast("Pedido cancelado.");await loadFriends()}
  else if(a=="s-rm"){if(SO.arm!="rm"){armed("rm");return}SO.arm="";const f=SO.friends.find(x=>x.id==SO.sel);
   await api("DELETE","/friends/"+encodeURIComponent(SO.sel));toast("Removeste "+dn(f));SO.sel="";await loadFriends()}
  else if(a=="s-send")soSend()
  else if(a=="s-edit"){const m=(SO.msgs[ck()]||[]).find(x=>x.id==v);if(!m)return;SO.edit=m.id;const i=document.getElementById("smi");i.value=m.body;i.focus();paintComposer()}
  else if(a=="s-cedit"){SO.edit=0;const i=document.getElementById("smi");i.value=SO.draft[ck()]||"";paintComposer()}
  else if(a=="s-del"){if(SO.arm!="d"+v){armed("d"+v);return}SO.arm="";const l=SO.msgs[ck()]||[],m=l.find(x=>x.id==v);
   if(m){SO.msgs[ck()]=l.filter(x=>x!==m);SO.sig[ck()]=sigOf(SO.msgs[ck()]);paintMsgs()}
   try{await api("DELETE","/messages/"+encodeURIComponent(v))}catch(x){toast("Não deu para apagar: "+sErr(x));SO.sig[ck()]="";pollChat()}}
  else if(a=="s-retrym"){const p=(SO.msgs[ck()]||[]).find(x=>x.lid==v);if(p){paintMsgs();await postMsg(ck(),p)}}
  else if(a=="s-gsel")selectGroup(v)
  else if(a=="s-gopen")openGroup(v)
  else if(a=="s-gnew"){if(SO.groups.length>=3){toast("Podes estar em 3 grupos no máximo. Sai de um para criar outro.");return}SO.gnew={name:"",picks:[],busy:false};paintDlg()}
  else if(a=="s-gpick"){const q=SO.gnew;if(!q)return;const nn=$("gname");if(nn)q.name=nn.value;const i=q.picks.indexOf(v);
   if(i>=0)q.picks.splice(i,1);else if(q.picks.length<9)q.picks.push(v);else toast("Um grupo tem no máximo 10 pessoas.");paintDlg()}
  else if(a=="s-gmk")await makeGroup()
  else if(a=="s-dcancel"){SO.gnew=null;SO.minv=null;paintDlg()}
  else if(a=="s-gmem"){SO.gmo=!SO.gmo;paintHead();paintMem();if(SO.gmo)loadMembers(SO.cg)}
  else if(a=="s-gadd"){const gg=SO.groups.find(x=>x.id==SO.cg);if(gg&&(SO.gmem[gg.id]||gg.members||[]).length>=10){toast("O grupo já tem 10 pessoas.");return}await api("POST","/groups/"+enc(SO.cg)+"/members",{userId:v});toast("Amigo adicionado ao grupo.");await loadMembers(SO.cg);await loadGroups()}
  else if(a=="s-gkick"){if(SO.arm!="k"+v){armed("k"+v);return}SO.arm="";
   await api("DELETE","/groups/"+enc(SO.cg)+"/members/"+enc(v));toast("Membro removido.");await loadMembers(SO.cg);await loadGroups()}
  else if(a=="s-gleave"){if(SO.arm!="gl"){armed("gl");return}SO.arm="";const g=SO.groups.find(x=>x.id==SO.cg);if(!g||!SO.me)return;
   await api("DELETE","/groups/"+enc(g.id)+"/members/"+enc(SO.me.id));toast("Saíste do grupo "+g.name);SO.cg="";SO.gmo=false;
   await loadGroups();paintHead();paintMem();paintComposer();paintMsgs(true)}
  else if(a=="s-rxp"){SO.rp=SO.rp==Number(v)?0:Number(v);paintMsgs()}
  else if(a=="s-rx"){const i=v.indexOf("|");SO.rp=0;await react(Number(v.slice(0,i)),v.slice(i+1))}
  else if(a=="s-bell"){SO.nopen=!SO.nopen;paintBell();if(SO.nopen)loadNotes().catch(()=>{})}
  else if(a=="s-nread")markNotes()
  else if(a=="s-nopen")noteGo(v)
  else if(a=="s-ninv")openInvite()
  else if(a=="s-ichip"){const m=SO.minv;if(!m)return;const nn=$("iname");if(nn)m.name=nn.value;m.address=v;paintDlg()}
  else if(a=="s-isend")await sendInvite()
  else if(a=="s-join"){const i=cur();if(!i){toast("Cria uma instância primeiro.");return}play(i.name,v)}
 }catch(x){toast(sErr(x))}}
document.addEventListener("click",e=>{const el=e.target.closest("[data-a^='s-']");if(el)act(el.dataset.a,el.dataset.v)});
document.addEventListener("keydown",e=>{
 if(e.target.id=="smi"){if(e.key=="Enter"&&!e.isComposing){e.preventDefault();soSend()}else if(e.key=="Escape"&&SO.edit)act("s-cedit")}
 else if(e.target.id=="sadd"&&e.key=="Enter")act("s-add")});
document.addEventListener("input",e=>{const t=e.target.id;
 if(t=="iaddr"&&SO.minv)SO.minv.address=e.target.value;else if(t=="iname"&&SO.minv)SO.minv.name=e.target.value;else if(t=="gname"&&SO.gnew)SO.gnew.name=e.target.value;
 else if(t=="smi"&&ck()&&!SO.edit)SO.draft[ck()]=e.target.value});
document.addEventListener("click",e=>{if(SO.nopen&&!e.composedPath().some(x=>x.id=="bell")){SO.nopen=false;paintBell()}});
document.addEventListener("change",e=>{if(e.target.id=="sst")setStatus(e.target.value)});

/* ---------- vistas ---------- */
const kfb=el=>{const l=(el.dataset.fb||"").split("|").filter(Boolean);if(!l.length){el.remove();return}el.src=l.shift();el.dataset.fb=l.join("|")};
window.kfb=kfb;
const sbox=(u,sz)=>{const n=dn(u),id=u.mcUuid?norm(u.mcUuid):"",nm=u.mcUsername||"",px=sz*2,L=[];
 if(id)L.push("https://mc-heads.net/avatar/"+encodeURIComponent(id)+"/"+px,"https://crafatar.com/avatars/"+encodeURIComponent(id)+"?size="+px+"&overlay");
 if(nm)L.push("https://minotar.net/helm/"+encodeURIComponent(nm)+"/"+px,"https://mc-heads.net/avatar/"+encodeURIComponent(nm)+"/"+px);
 if(u.image&&/^https:\/\//.test(u.image))L.push(u.image);
 const first=L.shift();
 return`<span class="sav ${DOT[stateOf(u)]}" style="width:${sz}px;height:${sz}px;background:hsl(${hue(n)} 45% 40%)">${esc(n.trim()[0]||"?").toUpperCase()}${first?`<img src="${esc(first)}" alt="" data-fb="${esc(L.join("|"))}" onerror="kfb(this)">`:""}</span>`};
function listH(){
 if(SO.tab=="gr"){const gs=SO.groups.slice().sort((a,b)=>(SO.gun[b.id]||0)-(SO.gun[a.id]||0)||a.name.localeCompare(b.name,"pt",{sensitivity:"base"}));
  return`<button class="btn" data-a="s-gnew" style="margin:2px 0 6px">${SI.plus}Novo grupo</button>`+(gs.length?gs.map(g=>{const n=SO.gun[g.id]||0;
   return`<div class="sf ${SO.cg==g.id?"act":""}" data-a="s-gsel" data-v="${esc(g.id)}" tabindex="0">${gbox(g.name,36)}<div class="sn"><b>${esc(g.name)}</b><span class="tag">${esc(g.last?prev(g.last):g.count+" membros")}</span></div>${n?`<span class="bd2">${n>99?"99+":n}</span>`:""}</div>`}).join(""):`<div class="empty">${SO.gl?"Ainda não estás em nenhum grupo.":"A carregar…"}</div>`)}
 if(SO.tab=="rq"){let h="";
  for(const q of SO.inc)h+=`<div class="sf"><div class="sr">${sbox(q.user,36)}<div class="sn"><b>${esc(dn(q.user))}</b><span class="tag">Quer ser teu amigo</span></div><button class="btn p ic" data-a="s-acc" data-v="${esc(q.id)}" aria-label="Aceitar">${SI.ok}</button><button class="btn ic dn" data-a="s-rej" data-v="${esc(q.id)}" aria-label="Recusar">${SI.x}</button></div></div>`;
  for(const q of SO.out)h+=`<div class="sf"><div class="sr">${sbox(q.user,36)}<div class="sn"><b>${esc(dn(q.user))}</b><span class="tag">Pedido enviado</span></div><button class="btn" data-a="s-cancel" data-v="${esc(q.id)}">Cancelar</button></div></div>`;
  return h||`<div class="empty">Sem pedidos.</div>`}
 if(!SO.friends.length)return SO.loaded?`<div class="empty">Ainda não tens amigos.<br>Escreve o nome de um jogador em cima e carrega em +.</div>`:`<div class="empty">A carregar…</div>`;
 return sortF(SO.friends).map(u=>{const st=stateOf(u),n=SO.unread[u.id]||0;
  return`<div class="sf ${SO.sel==u.id?"act":""} ${st=="off"?"z":""}" data-a="s-sel" data-v="${esc(u.id)}" tabindex="0">${sbox(u,36)}<div class="sn"><b>${esc(dn(u))}</b><span class="tag">${esc(u.activity||SLAB[st])}</span></div>${n?`<span class="bd2">${n>99?"99+":n}</span>`:""}</div>`}).join("")}
function headH(){const g=SO.cg&&SO.groups.find(x=>x.id==SO.cg);
 if(g)return`<div class="sh">${gbox(g.name,40)}<div class="sn"><b>${esc(g.name)}</b><span class="tag">${g.count} membro${g.count==1?"":"s"}</span></div><button class="btn ic" data-a="s-ninv" title="Convidar para um servidor" aria-label="Convidar para um servidor">${SI.flag}</button><button class="btn ic ${SO.gmo?"act":""}" data-a="s-gmem" title="Membros" aria-label="Membros">${SI.users}</button><button class="btn ${SO.arm=="gl"?"dn":""}" data-a="s-gleave" title="Sair do grupo" aria-label="Sair do grupo">${SO.arm=="gl"?"Confirmar?":"Sair"}</button></div>`;
 const u=SO.friends.find(f=>f.id==SO.sel);if(!u)return`<div class="sh"><span class="tag">Conversas</span></div>`;const st=stateOf(u);
 return`<div class="sh">${sbox(u,40)}<div class="sn"><b>${esc(dn(u))}</b><span class="tag">${esc(u.activity||SLAB[st])}</span></div><button class="btn ic" data-a="s-ninv" title="Convidar para um servidor" aria-label="Convidar para um servidor">${SI.flag}</button><button class="btn ${SO.arm=="rm"?"dn":"ic"}" data-a="s-rm" title="Remover amigo">${SI.trash}${SO.arm=="rm"?"Confirmar?":""}</button></div>`}
function bub(m){const g=!!SO.cg,cls="bb "+(m.mine?"me":"th")+(m.pending?" pd":"")+(m.failed?" fl":"");let body;
 if(m.kind=="invite")body=`${m.body?`<div>${esc(m.body)}</div>`:""}<div class="inv"><b>${esc(m.server||m.address)}</b><span class="tag">${esc(m.address)}</span><button class="btn p" data-a="s-join" data-v="${esc(m.address)}">${SI.play}Entrar</button><span class="tag">Minecraft 1.20 ou mais recente</span></div>`;
 else if(GIFURL.test(String(m.body)))body=`<img class="gif" src="${esc(m.body)}" alt="GIF" loading="lazy">`;
 else if(String(m.body).startsWith("[kubo-wp] "))body=`<i>Partilhou uma localização do jogo</i>`;
 else body=esc(m.body);
 const sv=!!m.id&&!m.pending&&!m.failed,can=m.mine&&sv&&m.kind=="text"&&!g,del=SO.arm=="d"+m.id;
 const wu=g&&!m.mine?(m.who||userById(m.sid)):null,who=wu?`<div class="wh">${esc(dn(wu))}</div>`:"";
 const rx=m.react&&m.react.length?`<div class="rx">${m.react.map(r=>`<button class="rc ${r.mine?"me":""}" data-a="s-rx" data-v="${m.id}|${esc(r.e)}">${esc(r.e)} ${r.n}</button>`).join("")}</div>`:"";
 const pk=sv&&SO.rp==m.id?`<div class="rpk">${EMO.map(e=>`<button data-a="s-rx" data-v="${m.id}|${e}">${e}</button>`).join("")}</div>`:"";
 const meta=m.failed?`<button class="lnk" data-a="s-retrym" data-v="${esc(m.lid)}">Não enviada · tentar de novo</button>`:`<span class="tag">${tm(m.createdAt)}${m.editedAt?" · editada":""}${m.pending?" · a enviar…":""}</span>`;
 return`<div class="${cls}">${who}${body}${rx}${pk}<div class="mt">${meta}<span class="ma">${sv?`<button data-a="s-rxp" data-v="${m.id}" aria-label="Reagir">${SI.smile}</button>`:""}${can?`<button data-a="s-edit" data-v="${m.id}" aria-label="Editar">${SI.edit}</button><button class="${del?"hot":""}" data-a="s-del" data-v="${m.id}" aria-label="Apagar">${del?"Apagar?":SI.trash}</button>`:""}</span></div></div>`}
function msgsH(){const id=ck();if(!id)return`<div class="empty">Escolhe um amigo ou um grupo para conversar.</div>`;const l=SO.msgs[id];
 if(!l)return`<div class="empty">A carregar…</div>`;if(!l.length)return`<div class="empty">Ainda não há mensagens. Diz olá!</div>`;
 let h="",day="";for(const m of l){const k=dayKey(m.createdAt);if(k&&k!=day){day=k;h+=`<div class="sdy">${esc(dayLabel(m.createdAt))}</div>`}h+=bub(m)}return h}
function miniH(){if(!S.acc)return`<p class="tag">Entra com a tua conta Microsoft para veres os teus amigos.</p>`;
 if(SO.st=="connecting"||(SO.st=="off"&&!SO.run))return`<p class="tag">A ligar…</p>`;if(SO.st=="err")return`<p class="tag">${esc(SO.err)}</p>`;
 if(!SO.friends.length)return`<p class="tag">Ainda não tens amigos. Adiciona na página Amigos.</p>`;
 return sortF(SO.friends).slice(0,7).map(u=>{const st=stateOf(u);return`<div class="fi ${st=="off"?"z":""}" data-a="s-open" data-v="${esc(u.id)}" style="cursor:pointer">${sbox(u,30)}<div><b>${esc(dn(u))}</b><span class="tag">${esc(u.activity||SLAB[st])}</span></div></div>`}).join("")}
function vSocial(){
 if(!S.acc)return`<div class="pad" data-ss="noacc"><h1>Amigos</h1><p class="sub">Para veres os teus amigos e falares com eles, entra com a tua conta Microsoft. É a mesma lista de amigos do mod Sleep.</p><button class="btn p" data-a="s-login">Ir para Personagem</button></div>`;
 if(SO.st=="err")return`<div class="pad" data-ss="err"><h1>Amigos</h1><div class="pn" style="padding:18px;max-width:520px"><b>Não deu para ligar</b><p class="tag" style="margin:6px 0 14px">${esc(SO.err)}</p><button class="btn p" data-a="s-retry">Tentar outra vez</button></div></div>`;
 if(!SO.run)return`<div class="pad" data-ss="wait"><h1>Amigos</h1><div class="empty">A ligar ao servidor de amigos…</div></div>`;
 return`<div class="sp9" data-ss="ok"><aside class="sl pn"><div class="sme"><canvas data-fig="head" width="32" height="32"></canvas><div class="sn"><b>${esc((SO.me&&dn(SO.me))||S.acc.name)}</b><select id="sst" aria-label="Estado">${Object.keys(STAT).map(k=>`<option value="${k}" ${k==SO.status?"selected":""}>${STAT[k]}</option>`).join("")}</select></div></div>
 <div class="row sadd"><input id="sadd" placeholder="Adicionar amigo (nome)" autocomplete="off" maxlength="32"><button class="btn p ic" data-a="s-add" aria-label="Adicionar">${SI.plus}</button></div>
 <div class="seg" id="stabs">${tabsH()}</div><div id="sfl" class="sfl">${listH()}</div></aside>
 <section class="sc pn"><div id="shd">${headH()}</div><div id="smem">${memH()}</div><div id="smsgs" class="smsgs">${msgsH()}</div>
 <div class="scp"><div id="sedn" class="sedn" ${SO.edit?"":"hidden"}><span class="tag">A editar mensagem</span><button class="lnk" data-a="s-cedit">Cancelar</button></div><div class="row"><input id="smi" placeholder="${ck()?"Escreve uma mensagem…":"Escolhe um amigo ou um grupo"}" maxlength="500" autocomplete="off" value="${esc(SO.draft[ck()]||"")}" ${ck()?"":"disabled"}><button class="btn p ic" id="ssb" data-a="s-send" aria-label="Enviar" ${ck()?"":"disabled"}>${SI.send}</button></div></div></section><div id="sdlg">${dlgH()}</div></div>`}
window.vSocial=vSocial;window.soBadge=()=>SO.total+SO.gtotal;window.socialMini=miniH;
const tabsH=()=>`<button class="${SO.tab=="fr"?"act":""}" data-a="s-tab" data-v="fr">Amigos (${SO.friends.length})</button><button class="${SO.tab=="gr"?"act":""}" data-a="s-tab" data-v="gr">Grupos${SO.gtotal?` (${SO.gtotal})`:""}</button><button class="${SO.tab=="rq"?"act":""}" data-a="s-tab" data-v="rq">Pedidos${SO.inc.length?` (${SO.inc.length})`:""}</button>`;

/* ---------- pintar só o que mudou (não mexe no campo de escrever) ---------- */
const $=id=>document.getElementById(id);
function paintList(){const a=$("sfl");if(a)a.innerHTML=listH();const t=$("stabs");if(t)t.innerHTML=tabsH();const m=$("smini");if(m)m.innerHTML=miniH();const s=$("sst");if(s&&s.value!=SO.status)s.value=SO.status}
function paintHead(){const h=$("shd");if(h)h.innerHTML=headH()}
function paintMsgs(stick){const e=$("smsgs");if(!e)return;const near=e.scrollHeight-e.scrollTop-e.clientHeight<80;e.innerHTML=msgsH();if(stick||near)e.scrollTop=e.scrollHeight}
function paintComposer(){const b=$("sedn");if(b)b.hidden=!SO.edit;const k=ck(),i=$("smi");if(i){i.disabled=!k;i.placeholder=k?"Escreve uma mensagem…":"Escolhe um amigo ou um grupo";if(!k)i.value=""}const x=$("ssb");if(x)x.disabled=!k}
const curSS=()=>!S.acc?"noacc":SO.st=="err"?"err":!SO.run?"wait":"ok";
function paintSo(full){
 if(S.page=="chat"){const r=document.querySelector("[data-ss]");if(r&&r.dataset.ss!=curSS()){render();return}}
 if(full){paintList();paintHead();paintMem();paintComposer();paintMsgs(true);paintDlg();if(ck()&&!SO.msgs[ck()])pollChat();return}
 paintList();paintHead();paintMem();paintComposer()}
function badge(){const b=document.querySelector('.nv[data-v="chat"]');if(!b)return;let e=b.querySelector(".bd");
 const t=SO.total+SO.gtotal;if(t>0){if(!e){e=document.createElement("b");e.className="bd";b.appendChild(e)}e.textContent=t>99?"99+":t}else if(e)e.remove()}

/* ---------- passo 10: grupos, reações, notificações e convites ----------
   Os caminhos e formatos abaixo seguem o que o PROMPT_PASSO_10 descreve (GET/POST /groups, /groups/:id/messages,
   /messages/:id/reactions, GET /notifications, POST /notifications/read). Se o backend usar outros nomes de campo,
   só é preciso mexer nos parsers (parseGroup, parseNote, parseReact) e nos corpos dos pedidos aqui em baixo. */
const enc=encodeURIComponent,EMO=["👍","❤️","😂","😮","😢","🔥"],ADDR=/^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?(:\d{1,5})?$/;
const ck=()=>SO.cg?"g:"+SO.cg:SO.sel;
const isG=k=>String(k).startsWith("g:");
const mpath=k=>isG(k)?"/groups/"+enc(k.slice(2))+"/messages":"/messages/"+enc(k);
const unreadOf=k=>isG(k)?SO.gun[k.slice(2)]||0:SO.unread[k]||0;
const gbox=(n,sz)=>`<span class="sav gx" style="width:${sz}px;height:${sz}px;background:hsl(${hue(n)} 45% 40%)">${esc(String(n).trim()[0]||"G").toUpperCase()}</span>`;
function userById(id){if(!id)return null;if(SO.me&&SO.me.id==id)return SO.me;const f=SO.friends.find(x=>x.id==id);if(f)return f;
 for(const k in SO.gmem){const u=SO.gmem[k].find(x=>x.id==id);if(u)return u}return null}
/* reações: aceita lista [{emoji,count,mine|users}] ou objeto {emoji: [ids] | número} */
function parseReact(r){const out=[],isMe=u=>!!SO.me&&((u&&u.id)||u)==SO.me.id;
 if(Array.isArray(r)){for(const x of r){if(!x||typeof x!="object")continue;const e=x.emoji||x.e||x.reaction;if(!e)continue;
  const us=x.userIds||x.users||null;let n=Number(x.count??x.n);if(!(n>=0))n=Array.isArray(us)?us.length:1;
  let mine=[x.mine,x.me,x.reacted,x.byMe,x.reactedByMe].find(v=>typeof v=="boolean");if(mine===undefined)mine=Array.isArray(us)&&us.some(isMe);
  if(n>0)out.push({e:String(e),n,mine:!!mine})}}
 else if(r&&typeof r=="object"){for(const e of Object.keys(r)){const v=r[e];let n,mine=false;
  if(Array.isArray(v)){n=v.length;mine=v.some(isMe)}else if(typeof v=="number")n=v;else if(v&&typeof v=="object"){n=Number(v.count)||0;mine=!!v.mine}else continue;
  if(n>0)out.push({e,n,mine})}}
 return out}
function parseGroup(o){if(!o||typeof o!="object")return null;const id=o.id||o.groupId;if(!id)return null;
 const ms=Array.isArray(o.members)?o.members.map(e=>parseUser(e&&e.user?e.user:e)).filter(u=>u&&u.id):[];
 const n=Number(o.memberCount??o.membersCount??o.members_count??ms.length)||ms.length,lm=o.lastMessage&&o.lastMessage.body;
 return{id:String(id),name:String(o.name||o.title||"Grupo"),members:ms,count:n,unread:Number(o.unread??o.unreadCount)||0,
  owner:o.ownerId||o.owner_id||o.createdBy||o.creatorId||(o.owner&&o.owner.id)||null,last:lm||""}}
const NREAD=(()=>{try{return new Set(JSON.parse(localStorage.getItem("kubo.nread")||"[]"))}catch(e){return new Set()}})();
const saveNread=()=>{try{localStorage.setItem("kubo.nread",JSON.stringify([...NREAD].slice(-500)))}catch(e){}};
function parseNote(o){if(!o||typeof o!="object"||o.id==null)return null;
 const d=o.data&&typeof o.data=="object"?o.data:o.meta&&typeof o.meta=="object"?o.meta:{},actor=parseUser(o.actor||o.from||d.actor||o.user||(o.fromName||o.senderName?{id:o.fromId||o.fromUserId||"",mcUsername:o.fromName||o.senderName}:null)||null);
 return{id:String(o.id),type:String(o.type||o.kind||""),title:o.title||"",body:o.body??o.message??o.text??"",read:o.read===true||o.isRead===true||!!o.readAt||!!o.read_at||NREAD.has(String(o.id)),
  createdAt:o.createdAt||o.created_at||null,userId:d.userId||d.fromUserId||d.senderId||(actor&&actor.id)||null,groupId:d.groupId||o.groupId||null,actor}}
function noteText(n){if(n.title&&n.body)return n.title+": "+n.body;if(n.title||n.body)return String(n.title||n.body);const w=n.actor?dn(n.actor):"Alguém";
 switch(n.type){case"friend_request":return w+" enviou-te um pedido de amizade";case"friend_accept":case"friend_accepted":return w+" aceitou o teu pedido de amizade";
  case"message":case"dm":return w+" enviou-te uma mensagem";case"group_invite":case"group_add":return w+" adicionou-te a um grupo";
  case"group_message":return"Nova mensagem num grupo";case"reaction":return w+" reagiu à tua mensagem";case"invite":case"server_invite":return w+" convidou-te para um servidor"}
 return"Nova notificação"}

async function loadGroups(){const r=await api("GET","/groups");const arr=Array.isArray(r)?r:(r&&(r.groups||r.items))||[];
 const gs=arr.map(parseGroup).filter(Boolean),map={},first=!SO.gl;SO.gl=true;
 for(const g of gs)if(g.unread>0){map[g.id]=g.unread;
  if(!first&&g.unread>(SO.gun[g.id]||0)&&!(S.page=="chat"&&SO.cg==g.id&&!document.hidden))toast("Grupo "+g.name+": nova mensagem")}
 SO.groups=gs;SO.gun=map;SO.gtotal=Object.values(map).reduce((a,b)=>a+b,0);
 const gone=SO.cg&&!gs.some(g=>g.id==SO.cg);if(gone){SO.cg="";SO.gmo=false}
 badge();paintList();paintHead();paintMem();if(gone){paintComposer();paintMsgs(true)}}
async function loadMembers(gi){
 try{const r=await api("GET","/groups/"+enc(gi)+"/members");const l=Array.isArray(r)?r:(r&&(r.members||r.users))||[];
  SO.gmem[gi]=l.map(e=>parseUser(e&&e.user?e.user:e)).filter(u=>u&&u.id)}
 catch(x){const g=SO.groups.find(y=>y.id==gi);SO.gmem[gi]=(g&&g.members)||SO.gmem[gi]||[]}
 paintHead();paintMem();paintMsgs()}
async function makeGroup(){const q=SO.gnew;if(!q||q.busy)return;const nn=$("gname");if(nn)q.name=nn.value;const nm=q.name.trim();
 if(!nm){toast("Dá um nome ao grupo.");return}if(!q.picks.length){toast("Escolhe pelo menos um amigo.");return}
 q.busy=true;paintDlg();
 try{const r=await api("POST","/groups",{name:nm,memberIds:q.picks.slice()});const g=parseGroup(r&&(r.group||r));
  SO.gnew=null;paintDlg();await loadGroups().catch(()=>{});const id=g?g.id:(SO.groups.find(x=>x.name==nm)||{}).id;
  if(id){SO.tab="gr";selectGroup(String(id))}}
 catch(x){q.busy=false;paintDlg();toast("Não deu para criar o grupo: "+sErr(x))}}
function openGroup(id){SO.cg=id;SO.sel="";SO.tab="gr";SO.edit=0;SO.arm="";SO.gmo=false;SO.rp=0;S.page="chat";S.mp=false;S.cur="";render()}
function selectGroup(id){SO.cg=id;SO.sel="";SO.edit=0;SO.arm="";SO.gmo=false;SO.rp=0;paintList();paintHead();paintMem();paintComposer();paintMsgs(true);
 const k=ck(),i=$("smi");if(i){i.value=SO.draft[k]||"";i.focus()}if(!SO.msgs[k])SO.sig[k]="";pollChat()}

/* reações (POST /messages/:id/reactions alterna a reação) */
async function react(mid,e){const k=ck(),l=SO.msgs[k]||[],m=l.find(x=>x.id==mid);if(!m)return;
 const old=JSON.stringify(m.react),r=m.react.find(x=>x.e==e);
 if(r){if(r.mine){r.n--;r.mine=false;if(r.n<=0)m.react=m.react.filter(x=>x!==r)}else{r.n++;r.mine=true}}else m.react.push({e,n:1,mine:true});
 SO.sig[k]=sigOf(l);paintMsgs();
 try{await api("POST","/messages/"+mid+"/reactions",{emoji:e});SO.sig[k]="";pollChat()}
 catch(x){m.react=JSON.parse(old);SO.sig[k]=sigOf(l);paintMsgs();toast("Não deu para reagir: "+sErr(x))}}

/* notificações do backend + sino */
async function loadNotes(){const v=SO.nv||0,r=await api("GET","/notifications");if((SO.nv||0)!=v)return;const arr=Array.isArray(r)?r:(r&&(r.notifications||r.items))||[];
 const ns=arr.map(parseNote).filter(Boolean).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))),seen=new Set(SO.notes.map(n=>n.id));
 if(SO.nl)for(const n of ns)if(!n.read&&!seen.has(n.id)&&!/^(message|dm|friend_request|group_message)$/.test(n.type))toast(noteText(n));
 SO.nl=true;SO.notes=ns;SO.nun=ns.filter(n=>!n.read).length;paintBell()}
async function markNotes(ids){SO.nv=(SO.nv||0)+1;const set=new Set(ids||[]);SO.notes.forEach(n=>{if(!ids||set.has(n.id)){n.read=true;NREAD.add(String(n.id))}});saveNread();
 SO.nun=SO.notes.filter(n=>!n.read).length;paintBell();
 if(ids)return;/* o backend só sabe marcar TUDO (POST {}); as individuais ficam lembradas neste PC, como no mod */
 try{await api("POST","/notifications/read",{})}catch(x){toast("Não deu para marcar como lidas: "+sErr(x));loadNotes().catch(()=>{})}}
function noteGo(id){const n=SO.notes.find(x=>x.id==id);if(!n)return;SO.nopen=false;if(!n.read)markNotes([n.id]);else paintBell();
 if(n.groupId&&SO.groups.some(g=>g.id==String(n.groupId))){openGroup(String(n.groupId));return}
 if(n.type=="friend_request"){SO.tab="rq";S.page="chat";S.mp=false;S.cur="";render();return}
 if(n.userId&&SO.friends.some(f=>f.id==n.userId)){openChat(n.userId);return}
 S.page="chat";S.mp=false;S.cur="";render()}
function notesH(){const l=SO.notes.slice(0,30);
 return`<div class="np pn"><div class="row sb"><b>Notificações</b>${SO.nun?`<button class="lnk" data-a="s-nread">Marcar tudo como lido</button>`:""}</div><div class="nl">${l.length?l.map(n=>`<button class="ni ${n.read?"":"un"}" data-a="s-nopen" data-v="${esc(n.id)}"><span>${esc(noteText(n))}</span><span class="tag">${n.createdAt?esc(dayLabel(n.createdAt))+" · "+tm(n.createdAt):""}</span></button>`).join(""):`<div class="empty" style="padding:18px">Sem notificações.</div>`}</div></div>`}
function bellH(){if(!S.acc)return"";const n=SO.nun;
 return`<button class="btn ic bell ${SO.nopen?"act":""}" data-a="s-bell" aria-label="Notificações" aria-expanded="${!!SO.nopen}">${SI.bell}${n?`<b class="bd3">${n>99?"99+":n}</b>`:""}</button>${SO.nopen?notesH():""}`}
window.socialBell=()=>`<div id="bell" class="bellw">${bellH()}</div>`;
function paintBell(){const b=$("bell");if(b)b.innerHTML=bellH()}

/* membros do grupo */
function memH(){const g=SO.groups.find(x=>x.id==SO.cg);if(!g||!SO.gmo)return"";
 const ms=SO.gmem[g.id]||g.members||[],boss=!!(SO.me&&g.owner&&g.owner==SO.me.id),ids=new Set(ms.map(u=>u.id)),add=SO.friends.filter(f=>!ids.has(f.id));
 return`<div class="gmp"><div class="row sb"><b>Membros (${ms.length||g.count})</b><button class="lnk" data-a="s-gmem">Fechar</button></div><div class="gml">${ms.map(u=>`<div class="sr">${sbox(u,28)}<div class="sn"><b>${esc(dn(u))}</b>${SO.me&&u.id==SO.me.id?`<span class="tag">Tu</span>`:g.owner==u.id?`<span class="tag">Criador</span>`:""}</div>${boss&&u.id!=SO.me.id?`<button class="btn ${SO.arm=="k"+u.id?"dn":"ic"}" data-a="s-gkick" data-v="${esc(u.id)}" aria-label="Remover">${SI.x}${SO.arm=="k"+u.id?"Remover?":""}</button>`:""}</div>`).join("")||`<span class="tag">A carregar…</span>`}</div>${add.length?`<div class="tag">Adicionar amigo</div><div class="cats">${add.map(f=>`<button class="chip" data-a="s-gadd" data-v="${esc(f.id)}">+ ${esc(dn(f))}</button>`).join("")}</div>`:""}</div>`}
function paintMem(){const e=$("smem");if(e)e.innerHTML=memH()}

/* convidar para o servidor onde estou a jogar (o Rust lê-o da consola do jogo) */
async function openInvite(){if(!ck())return;SO.minv={address:"",name:"",found:"",inst:"",loading:true};paintDlg();
 let r=null;try{r=await inv("current_server")}catch(e){}
 const m=SO.minv;if(!m)return;m.loading=false;if(r&&r.address){m.found=r.address;m.inst=r.instance||"";if(!m.address)m.address=r.address}
 const ae=document.activeElement;if(ae&&(ae.id=="iaddr"||ae.id=="iname"))return;paintDlg()}
async function sendInvite(){const m=SO.minv;if(!m)return;const a=$("iaddr"),n=$("iname"),addr=String(a?a.value:m.address).trim(),nm=String(n?n.value:m.name).trim();
 if(!ADDR.test(addr)){toast("Endereço de servidor inválido.");return}
 const label=(nm||addr).replace(/[|\]\[\r\n]/g," ").trim().slice(0,40);SO.minv=null;paintDlg();
 await sendBody("[ghost-invite|v1|"+label+"|"+addr+"]")}
async function sendBody(body){const id=ck();if(!id)return;
 const p=Object.assign(parseMsg({body,createdAt:new Date().toISOString(),mine:true},isG(id)?null:id),{lid:"l"+(++SO.n),pending:true,mine:true,id:0});
 (SO.msgs[id]=SO.msgs[id]||[]).push(p);SO.sig[id]=sigOf(SO.msgs[id]);paintMsgs(true);await postMsg(id,p)}
function dlgH(){
 if(SO.gnew){const q=SO.gnew;
  return`<div class="ov"><div class="pn md"><b style="font-size:18px">Novo grupo</b><input id="gname" placeholder="Nome do grupo" maxlength="40" autocomplete="off" value="${esc(q.name)}"><span class="tag">Escolhe os amigos (até 9: os grupos têm no máximo 10 pessoas)</span><div class="cats" style="max-height:220px;overflow:auto">${SO.friends.length?sortF(SO.friends).map(f=>`<button class="chip ${q.picks.includes(f.id)?"act":""}" data-a="s-gpick" data-v="${esc(f.id)}">${esc(dn(f))}</button>`).join(""):`<span class="tag">Ainda não tens amigos.</span>`}</div><div class="row sb"><button class="btn" data-a="s-dcancel">Cancelar</button><button class="btn p" data-a="s-gmk" ${q.busy?"disabled":""}>${q.busy?"A criar…":"Criar grupo"}</button></div></div></div>`}
 if(SO.minv){const m=SO.minv,g=SO.cg&&SO.groups.find(x=>x.id==SO.cg),f=SO.sel&&SO.friends.find(x=>x.id==SO.sel),to=g?g.name:f?dn(f):"",
   chips=[...(m.found?[m.found]:[]),...S.servers].filter((a,i,l)=>l.indexOf(a)==i);
  return`<div class="ov"><div class="pn md"><b style="font-size:18px">Convidar para um servidor</b><span class="tag">Para: ${esc(to)}</span>
  ${m.found?`<span class="tag">Último servidor a que o jogo se ligou: <b>${esc(m.found)}</b>${m.inst?" ("+esc(m.inst)+")":""}</span>`:`<span class="tag">${m.loading?"A ver o servidor atual…":"Não deteto nenhum servidor em jogo. Escreve o endereço."}</span>`}
  <input id="iaddr" placeholder="mc.exemplo.net" maxlength="253" autocomplete="off" value="${esc(m.address)}"><input id="iname" placeholder="Nome do servidor (opcional)" maxlength="40" autocomplete="off" value="${esc(m.name)}">
  ${chips.length?`<div class="cats">${chips.map(a=>`<button class="chip ${m.address==a?"act":""}" data-a="s-ichip" data-v="${esc(a)}">${esc(a)}</button>`).join("")}</div>`:""}
  <div class="row sb"><button class="btn" data-a="s-dcancel">Cancelar</button><button class="btn p" data-a="s-isend">Enviar convite</button></div></div></div>`}
 return""}
function paintDlg(){const e=$("sdlg");if(e)e.innerHTML=dlgH()}

/* ---------- preview sem Tauri (dados de exemplo) ---------- */
function mockMe(){return{id:"me",name:"Preview",mcUsername:"Preview",mcUuid:"11111111-2222-3333-4444-555555555555",status:"online"}}
const MK={st:null};
function mockApi(m,p,b){return new Promise((ok,no)=>{setTimeout(()=>{
 if(!MK.st){const now=Date.now(),iso=x=>new Date(now-x*6e4).toISOString();
  MK.st={friends:[{id:"u1",mcUsername:"KiraVoxel",mcUuid:"a1",status:"online",activity:"A jogar mc.hypixel.net"},{id:"u2",mcUsername:"NoxCrafterYT",mcUuid:"a2",status:"online"},{id:"u3",mcUsername:"EmmiBloxx",mcUuid:"a3",status:"away"},{id:"u4",mcUsername:"Frostbyte_ow",mcUuid:"a4",status:"offline"}],
   incoming:[{id:"r1",user:{id:"u5",mcUsername:"Sir_Pixel",mcUuid:"a5"}}],outgoing:[{id:"r2",user:{id:"u6",mcUsername:"Aurora_MC",mcUuid:"a6"}}],
   msgs:{u1:[{id:1,senderId:"u1",body:"Bora jogar logo à noite?",createdAt:iso(90)},{id:2,senderId:"me",body:"Bora! A que horas?",createdAt:iso(80)},{id:3,senderId:"u1",body:"Venha ver o meu servidor![ghost-invite|v1|Sleep SMP|mc.exemplo.net]",createdAt:iso(5)}],u2:[{id:4,senderId:"u2",body:"Viste o novo mod?",createdAt:iso(300)}]},
   unread:{u1:1,u2:1},next:10}}
 const s=MK.st;let mt;
 if(m=="GET"&&p=="/friends")return ok({friends:s.friends.map(u=>({user:u})),incoming:s.incoming,outgoing:s.outgoing});
 if(m=="GET"&&p=="/messages")return ok({conversations:Object.keys(s.unread).filter(k=>s.unread[k]).map(k=>({user:s.friends.find(f=>f.id==k),unread:s.unread[k],lastMessage:s.msgs[k].slice(-1)[0]})),unreadTotal:Object.values(s.unread).reduce((a,c)=>a+c,0)});
 if(m=="POST"&&p=="/messages/read"){s.unread[b.userId]=0;return ok({})}
 if(m=="POST"&&p=="/messages"){const msg={id:s.next++,senderId:"me",body:b.body,createdAt:new Date().toISOString()};(s.msgs[b.userId]=s.msgs[b.userId]||[]).push(msg);
  setTimeout(()=>{(s.msgs[b.userId]=s.msgs[b.userId]||[]).push({id:s.next++,senderId:b.userId,body:"Boa! 👍",createdAt:new Date().toISOString()})},2200);return ok({message:msg})}
 if((mt=/^\/messages\/([^?]+)\?/.exec(p))&&m=="GET")return ok({messages:s.msgs[decodeURIComponent(mt[1])]||[]});
 if((mt=/^\/messages\/(\d+)$/.exec(p))){for(const k in s.msgs){const i=s.msgs[k].findIndex(x=>x.id==mt[1]);if(i>=0){if(m=="DELETE")s.msgs[k].splice(i,1);else{s.msgs[k][i].body=b.body;s.msgs[k][i].editedAt=new Date().toISOString()}}}return ok({})}
 if(m=="POST"&&p=="/friends"){s.outgoing.push({id:"r"+s.next++,user:{id:"x"+s.next,mcUsername:b.query,mcUuid:"z"+s.next}});return ok({})}
 if(m=="PATCH"&&p.startsWith("/friends/")){const id=decodeURIComponent(p.slice(9)),q=s.incoming.find(x=>x.id==id);s.incoming=s.incoming.filter(x=>x.id!=id);if(q&&b.action=="accept")s.friends.push({...q.user,status:"online"});return ok({})}
 if(m=="DELETE"&&p.startsWith("/friends/")){const id=decodeURIComponent(p.slice(9));s.outgoing=s.outgoing.filter(x=>x.id!=id);s.friends=s.friends.filter(x=>x.id!=id);return ok({})}

 if(!s.groups){const me={id:"me",mcUsername:"Preview",mcUuid:"11111111-2222-3333-4444-555555555555"},iso=x=>new Date(Date.now()-x*6e4).toISOString();
  s.groups=[{id:"g1",name:"Squad Sleep",ownerId:"me",members:[me,s.friends[0],s.friends[1]],unread:2}];
  s.gmsgs={g1:[{id:101,senderId:"u1",body:"Quem alinha num SMP novo?",createdAt:iso(40),reactions:{"👍":["u2"]}},{id:102,senderId:"u2",body:"Eu!",createdAt:iso(30)},{id:103,sender:{id:"u1",mcUsername:"KiraVoxel"},body:"Vamos para [ghost-invite|v1|Sleep SMP|mc.exemplo.net]",createdAt:iso(5)}]};
  s.notes=[{id:"n1",type:"friend_request",actor:{id:"u5",mcUsername:"Sir_Pixel"},createdAt:iso(10),read:false},{id:"n2",type:"group_add",data:{groupId:"g1"},actor:{id:"u1",mcUsername:"KiraVoxel"},createdAt:iso(60),read:false},{id:"n3",title:"Bem-vindo",body:"Obrigado por usares o Sleep",createdAt:iso(900),read:true}]}
 if(m=="GET"&&p=="/groups")return ok({groups:s.groups});
 if(m=="POST"&&p=="/groups"){const g={id:"g"+s.next++,name:b.name,ownerId:"me",unread:0,members:[{id:"me",mcUsername:"Preview",mcUuid:"11111111-2222-3333-4444-555555555555"}].concat((b.memberIds||[]).map(id=>s.friends.find(f=>f.id==id)).filter(Boolean))};s.groups.push(g);s.gmsgs[g.id]=[];return ok({group:g})}
 if((mt=/^\/groups\/([^\/]+)\/messages(\?.*)?$/.exec(p))){const id=decodeURIComponent(mt[1]),l=s.gmsgs[id]=s.gmsgs[id]||[];
  if(m=="GET")return ok({messages:l});const msg={id:s.next++,senderId:"me",body:b.body,createdAt:new Date().toISOString()};l.push(msg);return ok({message:msg})}
 if((mt=/^\/groups\/([^\/]+)\/members$/.exec(p))){const g=s.groups.find(x=>x.id==decodeURIComponent(mt[1]));if(!g)return no("grupo não existe");
  if(m=="GET")return ok({members:g.members});const f=s.friends.find(x=>x.id==b.userId);if(f&&!g.members.some(x=>x.id==f.id))g.members.push(f);return ok({})}
 if((mt=/^\/groups\/([^\/]+)\/members\/([^\/]+)$/.exec(p))&&m=="DELETE"){const gi=decodeURIComponent(mt[1]),ui=decodeURIComponent(mt[2]),g=s.groups.find(x=>x.id==gi);
  if(g){g.members=g.members.filter(x=>x.id!=ui);if(ui=="me")s.groups=s.groups.filter(x=>x!==g)}return ok({})}
 if((mt=/^\/groups\/([^\/]+)\/read$/.exec(p))){const g=s.groups.find(x=>x.id==decodeURIComponent(mt[1]));if(g)g.unread=0;return ok({})}
 if((mt=/^\/messages\/(\d+)\/reactions$/.exec(p))&&m=="POST"){const all=[].concat(...Object.values(s.msgs),...Object.values(s.gmsgs)),x=all.find(y=>y.id==mt[1]);
  if(!x)return no("mensagem não existe");const r=x.reactions=x.reactions||{},l=r[b.emoji]=r[b.emoji]||[],i=l.indexOf("me");if(i>=0)l.splice(i,1);else l.push("me");if(!l.length)delete r[b.emoji];return ok({})}
 if(m=="GET"&&p=="/notifications")return ok({notifications:s.notes});
 if(m=="POST"&&p=="/notifications/read"){s.notes.forEach(n=>{n.read=true});return ok({})}
 if(window.shopMock&&shopMock(m,p,b,ok,no))return;
 ok({})},120)})}
