const MODEL = "@cf/zai-org/glm-4.7-flash";

const PAGE = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#081321">
<title>JARVIS AI</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(ellipse at 50% 15%,#15334a,#070d18 65%);color:#edf6ff;font:16px system-ui;min-height:100vh}
header{position:sticky;top:0;background:#081321ed;border-bottom:1px solid #294057;padding:14px 18px;display:flex;align-items:center;gap:12px;z-index:2}
.logo{width:42px;height:42px;border:2px solid #5ee7ff;border-radius:50%;display:grid;place-items:center;color:#5ee7ff;font-size:25px}
.brand{font-weight:900;letter-spacing:3px}
.state{font-size:11px;color:#72e4ac;letter-spacing:1px;margin-left:auto}
main{max-width:850px;margin:auto;padding:18px 16px 115px}
.msg{padding:14px 16px;margin:12px 0;border:1px solid #2b4057;border-radius:18px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
.bot{background:#122033}
.user{background:#173650;margin-left:auto;max-width:88%;width:max-content}
.error{border-color:#b75e77;color:#ffc4d0}
.composer{position:fixed;bottom:0;left:0;right:0;display:flex;gap:8px;padding:12px 14px calc(12px + env(safe-area-inset-bottom));background:#07111ff2;border-top:1px solid #293e54}
.composer input{flex:1;min-width:0;background:#132238;border:1px solid #2b4057;border-radius:15px;padding:15px;color:white;font:inherit}
.composer button{border:0;border-radius:14px;padding:12px 18px;background:linear-gradient(100deg,#5ee7ff,#9b8cff);font-weight:800;color:#07111f;font-size:16px}
.hint{text-align:center;color:#8298b3;font-size:12px;margin-top:10px}
button:disabled{opacity:.5}
</style>
</head>
<body>
<header>
<div class="logo">✧</div>
<div class="brand">JARVIS</div>
<div class="state" id="state">● ONLINE</div>
</header>

<main>
<div id="chat">
<div class="msg bot">Halo! Saya JARVIS. Saya siap membantu kamu!</div>
</div>
<div class="hint">JARVIS AI • Cloudflare Workers AI</div>
</main>

<div class="composer">
<input id="q" placeholder="Tanyakan apa saja kepada JARVIS..." autocomplete="off">
<button id="send">Kirim ↑</button>
</div>

<script>
const chat=document.querySelector('#chat');
const q=document.querySelector('#q');
const btn=document.querySelector('#send');
const state=document.querySelector('#state');

let hist=[];
try{
hist=JSON.parse(localStorage.getItem('jarvis_v8')||'[]');
if(!Array.isArray(hist))hist=[];
}catch{}

function add(role,txt){
const x=document.createElement('div');
x.className='msg '+(role==='user'?'user':'bot');
x.textContent=txt;
chat.append(x);
window.scrollTo(0,document.body.scrollHeight);
return x;
}

hist.forEach(m=>add(m.role,m.content));

async function send(){
const t=q.value.trim();
if(!t||btn.disabled)return;

q.value='';
add('user',t);
hist.push({role:'user',content:t});

const wait=add('assistant','JARVIS sedang berpikir...');
btn.disabled=true;
state.textContent='● BERPIKIR';

try{
const r=await fetch('/api/chat',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({messages:hist.slice(-12)})
});

const d=await r.json();

if(!r.ok)throw Error(d.error||'HTTP '+r.status);
if(!d.response)throw Error('Jawaban kosong dari AI');

wait.textContent=d.response;

hist.push({role:'assistant',content:d.response});
hist=hist.slice(-24);

localStorage.setItem('jarvis_v8',JSON.stringify(hist));
state.textContent='● ONLINE';

}catch(e){
wait.classList.add('error');
wait.textContent='JARVIS ERROR: '+e.message;
state.textContent='● ERROR';
}finally{
btn.disabled=false;
q.focus();
}
}

btn.onclick=send;
q.addEventListener('keydown',e=>{
if(e.key==='Enter')send();
});

fetch('/api/health')
.then(r=>r.json())
.then(d=>{
if(!d.ok||!d.binding)state.textContent='● SERVER ERROR';
})
.catch(()=>state.textContent='● SERVER ERROR');
</script>
</body>
</html>`;

export default {
async fetch(request,env){

const url=new URL(request.url);

if(url.pathname==="/api/health"){
return Response.json({
ok:true,
service:"JARVIS AI",
model:MODEL,
binding:!!env.AI
});
}

if(url.pathname==="/api/chat"&&request.method==="POST"){

try{

if(!env.AI||typeof env.AI.run!=="function"){
return Response.json({
error:"Binding AI belum tersedia. Periksa Workers AI dengan nama AI."
},{status:503});
}

const body=await request.json();

if(!Array.isArray(body.messages)||!body.messages.length){
return Response.json({
error:"Pesan kosong."
},{status:400});
}

const messages=[
{
role:"system",
content:"Kamu adalah JARVIS, asisten AI yang cerdas, ramah, cepat, jujur dan membantu. Jawab menggunakan bahasa pengguna. Berikan jawaban yang jelas."
},
...body.messages.slice(-12).map(m=>({
role:m.role==="assistant"?"assistant":"user",
content:String(m.content||"").slice(0,8000)
}))
];

const result=await env.AI.run(MODEL,{
messages,
max_tokens:1200,
temperature:0.65
});

const answer=
result?.response||
result?.choices?.[0]?.message?.content||
result?.output_text||
"";

if(!answer){
return Response.json({
error:"AI tidak memberikan jawaban. Periksa kuota atau ketersediaan model."
},{status:502});
}

return Response.json({response:answer});

}catch(e){

return Response.json({
error:e?.message||"Kesalahan server AI."
},{status:500});

}
}

if(url.pathname==="/"||url.pathname==="/index.html"){
return new Response(PAGE,{
headers:{
"Content-Type":"text/html;charset=UTF-8",
"Cache-Control":"no-store"
}
});
}

return new Response("JARVIS AI aktif.",{status:404});

}
};
