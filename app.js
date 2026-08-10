import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, DEMO_MODE } from './config.js';

const $ = (id) => document.getElementById(id);
const fmtEuro = n => new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n||0));
const fmtQty = g => {
  g = Number(g||0);
  if (g >= 1000) {
    const kg = Math.floor(g/1000);
    const rest = Math.round((g-kg*1000)*100)/100;
    return rest ? `${kg} kg ${rest} g` : `${kg} kg`;
  }
  return `${Math.round(g*100)/100} g`;
};
const toGrams = (q,u) => u === 'kg' ? Number(q)*1000 : Number(q);

let supabase = null;
if (!DEMO_MODE) supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let state = {
  products: [{id:'dry', name:'Dry', qty_g:400, avg_cost_per_g:3}],
  sales: 300,
  cash: 100,
  credits: [{id:'mauro', client:'Mauro', product:'Dry', qty_g:100, total:300, paid:100}]
};

function totalCredits(){ return state.credits.reduce((s,c)=>s+Math.max(0,c.total-c.paid),0); }
function totalStockValue(){ return state.products.reduce((s,p)=>s+p.qty_g*p.avg_cost_per_g,0); }
function totalQty(){ return state.products.reduce((s,p)=>s+p.qty_g,0); }

function fillProducts(){
  const opts = state.products.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  $('buyProduct').innerHTML=opts; $('sellProduct').innerHTML=opts;
}
function render(){
  $('totalQty').textContent=fmtQty(totalQty());
  $('totalValue').textContent=fmtEuro(totalStockValue());
  $('totalCredits').textContent=fmtEuro(totalCredits());
  $('totalCash').textContent=fmtEuro(state.cash);

  $('homeStock').innerHTML = state.products.map(p=>`<div class="stock-row">
    <div><strong>${p.name}</strong><div class="muted">Disponibile</div></div>
    <div><span class="muted">Quantità</span><br><strong>${fmtQty(p.qty_g)}</strong></div>
    <div><span class="muted">Valore</span><br><strong>${fmtEuro(p.qty_g*p.avg_cost_per_g)}</strong></div>
    <div><span class="badge">${fmtEuro(p.avg_cost_per_g)}/g</span></div>
  </div>`).join('');

  $('stockList').innerHTML = state.products.map(p=>`<div class="stock-row">
    <div><strong>${p.name}</strong><div class="muted">${Math.round(p.qty_g*100)/100} g totali</div></div>
    <div><span class="muted">Quantità reale</span><br><strong>${fmtQty(p.qty_g)}</strong></div>
    <div><span class="muted">Valore economico</span><br><strong>${fmtEuro(p.qty_g*p.avg_cost_per_g)}</strong></div>
    <div><span class="badge">${fmtEuro(p.avg_cost_per_g)}/g</span></div>
  </div>`).join('');

  $('creditList').innerHTML = state.credits.length ? state.credits.map(c=>{
    const rem=Math.max(0,c.total-c.paid);
    return `<div class="credit-row">
      <div><strong>${c.client}</strong><div class="muted">${c.product} · ${fmtQty(c.qty_g)}</div></div>
      <div><span class="muted">Totale</span><br><strong>${fmtEuro(c.total)}</strong></div>
      <div><span class="muted">Da ricevere</span><br><strong>${fmtEuro(rem)}</strong></div>
      <button class="pay-credit" data-id="${c.id}" ${rem<=0?'disabled':''}>${rem<=0?'Saldato':'Pagamento'}</button>
    </div>`;
  }).join('') : '<div class="panel">Nessun credito aperto.</div>';

  $('reportSales').textContent=fmtEuro(state.sales);
  $('reportCash').textContent=fmtEuro(state.cash);
  $('reportCredits').textContent=fmtEuro(totalCredits());
  $('reportStock').textContent=fmtEuro(totalStockValue());
  fillProducts();

  document.querySelectorAll('.pay-credit').forEach(btn=>btn.addEventListener('click',()=>{
    const c=state.credits.find(x=>x.id===btn.dataset.id);
    const rem=Math.max(0,c.total-c.paid);
    const val=Number(prompt(`Quanto ha pagato ${c.client}? Restano ${fmtEuro(rem)}`));
    if(!val || val<=0)return;
    const accepted=Math.min(val,rem);
    c.paid+=accepted; state.cash+=accepted; persist(); render();
  }));
}

function persist(){
  if(DEMO_MODE) localStorage.setItem('gestionale_demo',JSON.stringify(state));
}
function loadDemo(){
  const saved=localStorage.getItem('gestionale_demo');
  if(saved){ try{state=JSON.parse(saved)}catch{} }
}

async function login(){
  const email=$('email').value.trim(), password=$('password').value;
  $('loginMsg').textContent='';
  if(DEMO_MODE){
    if(password !== 'demo1234'){ $('loginMsg').textContent='Password demo: demo1234'; return; }
    localStorage.setItem('demo_logged','1'); showApp(); return;
  }
  const { error } = await supabase.auth.signInWithPassword({email,password});
  if(error){ $('loginMsg').textContent='Accesso non riuscito.'; return; }
  await loadFromDb(); showApp();
}
async function logout(){
  if(DEMO_MODE){localStorage.removeItem('demo_logged');location.reload();return;}
  await supabase.auth.signOut(); location.reload();
}
function showApp(){ $('loginView').classList.add('hidden');$('appView').classList.remove('hidden');render(); }

async function loadFromDb(){
  if(DEMO_MODE)return;
  const [pRes,mRes,cRes] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('movements').select('*'),
    supabase.from('credits').select('*').order('created_at',{ascending:false})
  ]);
  if(!pRes.error && pRes.data) state.products=pRes.data;
  if(!mRes.error && mRes.data){
    state.sales=mRes.data.filter(x=>x.type==='sale').reduce((s,x)=>s+Number(x.total_amount||0),0);
    state.cash=mRes.data.reduce((s,x)=>s+Number(x.cash_received||0),0);
  }
  if(!cRes.error && cRes.data) state.credits=cRes.data;
}

$('loginBtn').addEventListener('click',login);
$('password').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
$('logoutBtn').addEventListener('click',logout);

document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));
  $(btn.dataset.page).classList.remove('hidden');
}));

$('addProductBtn').addEventListener('click',()=>$('modal').classList.remove('hidden'));
$('cancelProductBtn').addEventListener('click',()=>$('modal').classList.add('hidden'));
$('saveProductBtn').addEventListener('click',async()=>{
  const name=$('newProductName').value.trim(), cost=Number($('newProductCost').value||0);
  if(!name)return;
  if(DEMO_MODE){
    state.products.push({id:crypto.randomUUID(),name,qty_g:0,avg_cost_per_g:cost});
    persist(); render(); $('modal').classList.add('hidden'); return;
  }
  const {data,error}=await supabase.from('products').insert({name,qty_g:0,avg_cost_per_g:cost}).select().single();
  if(!error){state.products.push(data);render();$('modal').classList.add('hidden');}
});

$('buyBtn').addEventListener('click',async()=>{
  const p=state.products.find(x=>x.id===$('buyProduct').value);
  const grams=toGrams($('buyQty').value,$('buyUnit').value), cost=Number($('buyCost').value||0);
  if(!p || grams<=0 || cost<0)return;
  const oldValue=p.qty_g*p.avg_cost_per_g, newQty=p.qty_g+grams;
  const newAvg=(oldValue+cost)/newQty;
  p.qty_g=newQty;p.avg_cost_per_g=newAvg;
  if(DEMO_MODE){persist();render();$('moveMsg').textContent='Acquisto registrato.';return;}
  await supabase.from('products').update({qty_g:newQty,avg_cost_per_g:newAvg}).eq('id',p.id);
  await supabase.from('movements').insert({type:'purchase',product_id:p.id,qty_g:grams,total_amount:cost,cash_received:0});
  await loadFromDb();render();$('moveMsg').textContent='Acquisto registrato.';
});

$('paymentStatus').addEventListener('change',()=>{
  if($('paymentStatus').value==='paid')$('sellPaid').value=$('sellTotal').value||0;
  if($('paymentStatus').value==='credit')$('sellPaid').value=0;
});

$('sellBtn').addEventListener('click',async()=>{
  const p=state.products.find(x=>x.id===$('sellProduct').value);
  const grams=toGrams($('sellQty').value,$('sellUnit').value);
  const total=Number($('sellTotal').value||0);
  let paid=Number($('sellPaid').value||0);
  const client=$('sellClient').value.trim()||'Cliente';
  if(!p || grams<=0 || grams>p.qty_g || total<0){$('moveMsg').textContent='Controlla quantità e importi.';return;}
  paid=Math.max(0,Math.min(paid,total));
  p.qty_g-=grams;state.sales+=total;state.cash+=paid;
  if(total-paid>0)state.credits.unshift({id:crypto.randomUUID(),client,product:p.name,qty_g:grams,total,paid});
  if(DEMO_MODE){persist();render();$('moveMsg').textContent='Vendita registrata.';return;}
  await supabase.from('products').update({qty_g:p.qty_g}).eq('id',p.id);
  await supabase.from('movements').insert({type:'sale',product_id:p.id,client,qty_g:grams,total_amount:total,cash_received:paid});
  if(total-paid>0) await supabase.from('credits').insert({client,product:p.name,qty_g:grams,total,paid});
  await loadFromDb();render();$('moveMsg').textContent='Vendita registrata.';
});

if(DEMO_MODE){
  loadDemo();
  if(localStorage.getItem('demo_logged')==='1')showApp();
}else{
  const {data:{session}}=await supabase.auth.getSession();
  if(session){await loadFromDb();showApp();}
}
