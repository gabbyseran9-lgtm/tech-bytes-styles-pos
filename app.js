'use strict';
const S = {products:[],settings:{},cart:[],reqId:null,pay:{disc:'',paid:'',method:'Cash'},sales:[],hRows:1};
const $ = (s, r = document) => r.querySelector(s), view = $('#view');
const peso = n => '₱' + Number(n || 0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});
const nowT = () => new Date().toLocaleTimeString('en-GB',{timeZone:'Asia/Manila',hour12:false}).slice(0,5);
const newId = () => 'TBS-' + new Date().toISOString().replace(/\D/g,'').slice(0,14) + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
const prod = id => S.products.find(p => p.product_id === id);
const biz = () => S.settings.business_name || 'Tech Bytes Styles';

function toast(m, err) { const t = $('#toast'); t.textContent = m; t.className = err ? 'err' : 'ok'; t.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => t.style.display = 'none', err ? 7000 : 3000); }
async function busy(fn) { $('#busy').hidden = false; try { return await fn(); } catch (e) { toast(e.message, true); return false; } finally { $('#busy').hidden = true; } }
async function api(action, payload = {}, write = false) {
  const url = window.TBS_CONFIG.API_URL;
  if (!url || url.includes('PASTE_YOUR')) throw new Error('Apps Script URL is not set. Edit config.js (see README).');
  let j;
  try {
    const r = write ? await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload})})
                    : await fetch(url + '?' + new URLSearchParams({action,...payload}));
    j = await r.json();
  } catch (e) { throw new Error('Could not reach Google Sheets. Nothing was saved. Check your connection and the Web App deployment (access: Anyone), then try again.'); }
  if (!j.ok) throw new Error(j.error);
  return j.data;
}
const post = (a, p) => api(a, p, true);
function csv(name, list) {
  if (!list.length) return toast('Nothing to export', true);
  const k = Object.keys(list[0]), q = v => { v = String(v ?? ''); if (/^[=+@]|^-(?!\d)/.test(v)) v = "'" + v; return '"' + v.replace(/"/g,'""') + '"'; };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + [k.join(','),...list.map(r => k.map(c => q(r[c])).join(','))].join('\n')],{type:'text/csv'}));
  a.download = name + '-' + today() + '.csv'; a.click();
}
function modal(html) { const d = $('#dlg'); d.innerHTML = html; d.showModal(); return d; }
function formModal(title, body, submit, cta = 'Save') {
  const d = modal(`<form class="f"><h3>${title}</h3>${body}<div class="row"><button type="button" class="btn ghost" onclick="dlg.close()">Cancel</button><button class="btn">${cta}</button></div></form>`);
  $('form', d).onsubmit = async e => { e.preventDefault(); const r = await busy(() => submit(Object.fromEntries(new FormData(e.target)))); if (r !== false) d.close(); };
}
const field = (l, n, v = '', t = 'text', x = '') => `<label>${l}<input name="${n}" type="${t}" value="${esc(v)}" ${x}></label>`;
const tbl = (h, body, empty) => body ? `<div class="tw"><table><thead><tr>${h.map(x => `<th class="${/^[#₱]|Qty|Total|Price|Amount|Stock/.test(x) ? 'n' : ''}">${x}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>` : `<div class="empty">${empty}</div>`;
const sel = (name, opts, cur) => `<select name="${name}">${opts.map(o => `<option value="${esc(o[0])}" ${o[0] === cur ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
const prodOpts = (all) => S.products.filter(p => all || p.status === 'ACTIVE').map(p => [p.product_id, p.product_name]);
const PAY = ['Cash','GCash','Bank transfer','Other'].map(x => [x,x]);

// ---------- receipt ----------
function receipt(s) {
  return `<div class="rcpt"><h2>${esc(biz())}</h2><p class="c">${esc(S.settings.contact || '')}</p>
  <p>${esc(s.transaction_id)}<br>${esc(s.sale_date)} ${esc(s.sale_time)} (PH time)${s.transaction_type === 'HISTORICAL' ? '<br>Manually entered previous sale' : ''}${s.status === 'CANCELLED' ? '<br><b>CANCELLED</b>' : ''}</p>
  <table>${s.items.map(i => `<tr><td>${esc(i.product_name)}<br>${i.quantity} × ${peso(i.unit_price)}</td><td style="text-align:right">${peso(i.line_total)}</td></tr>`).join('')}</table><hr>
  <dl><dt>Subtotal</dt><dd>${peso(s.subtotal)}</dd><dt>Discount</dt><dd>${peso(s.discount)}</dd><dt><b>Total due</b></dt><dd><b>${peso(s.total_due)}</b></dd>
  <dt>Paid (${esc(s.payment_method)})</dt><dd>${peso(s.amount_paid)}</dd><dt>Change</dt><dd>${peso(s.change_amount)}</dd></dl><p class="c">Thank you!</p></div>`;
}
function showReceipt(s) {
  modal(receipt(s) + `<div class="row noprint"><button class="btn ghost" onclick="dlg.close()">Close</button><button class="btn" onclick="printReceipt()">Print receipt</button></div>`);
}
function printReceipt() { document.body.classList.add('rcpt'); window.print(); }
window.onafterprint = () => document.body.classList.remove('rcpt');

// ---------- navigation ----------
const NAV = [['home','Home'],['dash','Dashboard'],['pos','New sale'],['products','Products'],['inventory','Inventory'],['hist','Add previous sale'],['tx','Transactions'],['exp','Expenses'],['rep','Sales reports'],['inc','Income statement'],['set','Settings']];
function go(p) {
  document.body.classList.remove('nav');
  $('#nav').innerHTML = `<div class="brand">${esc(biz())}</div>` + NAV.map(n => `<button class="${n[0] === p ? 'on' : ''}" onclick="go('${n[0]}')">${n[1]}</button>`).join('');
  busy(async () => { const b = await api('bootstrap'); S.products = b.products; S.settings = b.settings; $('#nav .brand').textContent = biz(); await PAGES[p](); }).then(r => { if (r === false) view.innerHTML = `<div class="empty">Could not load. <button class="btn sm" onclick="go('${p}')">Retry</button></div>`; });
}
const PAGES = {home, dash, pos, products, inventory, hist, tx, exp, rep: () => rep('sales'), inc: () => rep('income'), set};

async function home() {
  view.innerHTML = `<section class="hero"><div class="logo">Logo</div><h1>${esc(biz())}</h1><p class="mut">Lumpia, cheese sticks, cheese balls and ham sandwiches. Sell, track stock, and see your profit.</p>
  <button class="btn" onclick="go('pos')">Start a sale</button> <button class="btn ghost" onclick="go('dash')">Open dashboard</button></section>`;
}
async function dash() {
  const [r, sales] = await Promise.all([api('report',{from:today(),to:today()}), api('sales')]); S.sales = sales;
  const low = S.products.filter(p => p.status === 'ACTIVE' && Number(p.current_stock) <= Number(p.low_stock_threshold));
  const np = peso(r.net_profit) + (r.cost_complete && !r.cost_estimated ? '' : ' (incomplete)');
  const c = (l, v) => `<div class="card"><small>${l}</small><b>${v}</b></div>`;
  view.innerHTML = `<h1>Dashboard</h1><p class="mut">Today, ${today()}</p><div class="cards">${c('Sales',peso(r.net_sales))}${c('Transactions',r.tx_count)}${c('Products sold',r.units)}${c('Expenses',peso(r.expenses_total))}${c('Cost of goods sold',peso(r.cogs))}${c('Gross profit',peso(r.gross_profit))}${c('Net profit',np)}</div>
  ${r.cost_complete ? '' : '<p class="warn">Some items sold have no cost per unit, so profit figures are incomplete. Set costs in Products.</p>'}
  <h2>Stock levels</h2>${tbl(['Product','Stock','Alert'], S.products.filter(p => p.status === 'ACTIVE').map(p => `<tr><td>${esc(p.product_name)}</td><td class="n">${p.current_stock} ${esc(p.stock_unit)}</td><td>${low.includes(p) ? '<span class="warn">Low stock</span>' : 'OK'}</td></tr>`).join(''), 'No products yet.')}
  <h2>Recent transactions</h2>${txTable(sales.slice(0,8))}`;
}

// ---------- POS ----------
async function pos() {
  view.innerHTML = `<h1>New sale</h1><div class="pos"><div class="grid">${S.products.filter(p => p.status === 'ACTIVE').map(p => `<button class="prod" ${Number(p.selling_price) > 0 ? '' : 'disabled title="Set a price in Products first"'} onclick="addCart('${esc(p.product_id)}')"><b>${esc(p.product_name)}</b><span>${Number(p.selling_price) > 0 ? peso(p.selling_price) : 'No price set'}</span><small>${p.current_stock} ${esc(p.stock_unit)} left</small></button>`).join('') || '<div class="empty">No active products.</div>'}</div><div class="card" id="cart"></div></div>`;
  drawCart();
}
function addCart(id) { const l = S.cart.find(c => c.id === id); l ? l.qty++ : S.cart.push({id,qty:1}); S.reqId = S.reqId || newId(); drawCart(); }
function setQty(i, v) { v = Number(v); if (!(v > 0)) S.cart.splice(i,1); else S.cart[i].qty = v; if (!S.cart.length) S.reqId = null; drawCart(); }
function calc() { const sub = r2(S.cart.reduce((t, c) => t + Number(prod(c.id).selling_price) * c.qty, 0)), disc = r2(S.pay.disc || 0), total = r2(sub - disc), paid = r2(S.pay.paid || 0); return {sub,disc,total,paid,change:r2(paid - total)}; }
function problem() {
  const c = calc(); if (!S.cart.length) return 'Cart is empty';
  for (const l of S.cart) { const p = prod(l.id); if (!(Number(p.selling_price) > 0)) return p.product_name + ' has no valid price'; if (!(l.qty > 0)) return 'Quantity must be above 0'; if (l.qty > Number(p.current_stock) && S.settings.allow_negative_stock !== 'TRUE') return 'Not enough stock: ' + p.product_name; }
  if (c.disc < 0 || c.disc > c.sub) return 'Discount must be between 0 and the subtotal';
  if (c.paid < c.total) return 'Payment is less than the amount due'; return '';
}
function updTotals() { const c = calc(), pr = problem(); $('#tot').textContent = peso(c.total); $('#sub').textContent = peso(c.sub); $('#chg').textContent = c.paid >= c.total ? peso(c.change) : '—'; $('#why').textContent = S.cart.length ? pr : ''; $('#pay').disabled = !!pr; }
function drawCart() {
  $('#cart').innerHTML = `<h2 style="margin-top:0">Cart</h2>${S.cart.length ? `<table>${S.cart.map((l, i) => { const p = prod(l.id); return `<tr><td>${esc(p.product_name)}<br><small class="mut">${peso(p.selling_price)}</small></td><td style="width:110px"><div style="display:flex;gap:2px"><button class="btn ghost sm" onclick="setQty(${i},${l.qty - 1})">−</button><input type="number" min="1" step="1" value="${l.qty}" onchange="setQty(${i},this.value)" aria-label="Quantity"><button class="btn ghost sm" onclick="setQty(${i},${l.qty + 1})">+</button></div></td><td class="n">${peso(p.selling_price * l.qty)}</td><td><button class="btn bad sm" onclick="setQty(${i},0)" aria-label="Remove">✕</button></td></tr>`; }).join('')}</table>` : '<div class="empty">Tap a product to add it.</div>'}
  <p>Subtotal <b id="sub" style="float:right"></b></p>
  <label>Discount (₱)<input id="disc" type="number" min="0" step="0.01" value="${esc(S.pay.disc)}" oninput="S.pay.disc=this.value;updTotals()"></label>
  <p class="big">Total due <span id="tot" style="float:right"></span></p>
  <label>Payment method<select onchange="S.pay.method=this.value">${PAY.map(o => `<option ${o[0] === S.pay.method ? 'selected' : ''}>${o[0]}</option>`).join('')}</select></label>
  <label>Amount paid (₱)<input id="paid" type="number" min="0" step="0.01" value="${esc(S.pay.paid)}" oninput="S.pay.paid=this.value;updTotals()"></label>
  <p>Change <b id="chg" style="float:right"></b></p><p class="bad" id="why"></p><button class="btn" id="pay" style="width:100%" onclick="checkout()">Complete sale</button>`;
  updTotals();
}
async function checkout() {
  const pr = problem(); if (pr) return toast(pr, true);
  const c = calc(); if (!confirm(`Complete sale of ${peso(c.total)}? Change: ${peso(c.change)}`)) return;
  const r = await busy(() => post('createSale',{request_id:S.reqId,type:'POS',items:S.cart.map(l => ({product_id:l.id,quantity:l.qty})),discount:c.disc,amount_paid:c.paid,payment_method:S.pay.method}));
  if (r === false) return;   // cart and request ID kept so a retry cannot double-save
  S.products = r.products; S.cart = []; S.reqId = null; S.pay = {disc:'',paid:'',method:'Cash'};
  toast(r.duplicate ? 'This sale was already saved earlier' : 'Sale saved'); showReceipt(r.sale); pos();
}

// ---------- products ----------
async function products() {
  view.innerHTML = `<h1>Products</h1><div class="bar"><label>Search<input id="q" oninput="drawProducts()"></label><button class="btn" onclick="productForm()">Add product</button></div><div id="pl"></div>`; drawProducts();
}
function drawProducts() {
  const q = $('#q').value.toLowerCase(), list = S.products.filter(p => (p.product_name + p.product_id + p.category).toLowerCase().includes(q));
  $('#pl').innerHTML = tbl(['ID','Name','Category','Price','Cost','Stock','Unit','Low at','Status',''], list.map(p => `<tr><td>${esc(p.product_id)}</td><td>${esc(p.product_name)}</td><td>${esc(p.category)}</td><td class="n">${Number(p.selling_price) > 0 ? peso(p.selling_price) : '<span class="warn">Not set</span>'}</td><td class="n">${peso(p.cost_per_unit)}</td><td class="n">${p.current_stock}</td><td>${esc(p.stock_unit)}</td><td>${p.low_stock_threshold}</td><td>${p.status}</td>
  <td><button class="btn ghost sm" onclick="productForm('${esc(p.product_id)}')">Edit</button> <button class="btn ghost sm" ${p.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</button> <button class="btn bad sm" onclick="removeProduct('${esc(p.product_id)}')">Delete</button></td></tr>`, 'No products match.');
}
function productForm(id) {
  const p = id ? prod(id) : {}, add = !id;
  formModal(add ? 'Add product' : 'Edit product', `<input type="hidden" name="mode" value="${add ? 'add' : 'edit'}">${field('Product ID','product_id',p.product_id,'text',add ? 'required pattern="[A-Za-z0-9_-]{2,30}"' : 'readonly')}${field('Name','product_name',p.product_name,'text','required')}${field('Category','category',p.category || 'Snack')}${field('Selling price (₱)','selling_price',p.selling_price ?? '','number','min="0" step="0.01" required')}${field('Cost per unit (₱)','cost_per_unit',p.cost_per_unit ?? 0,'number','min="0" step="0.01" required')}${add ? field('Opening stock','current_stock',0,'number','min="0" step="any"') : ''}${field('Stock unit (piece, pack, serving…)','stock_unit',p.stock_unit || 'piece','text','list="units"')}<datalist id="units"><option>piece<option>pack<option>serving</datalist>${field('Low-stock threshold','low_stock_threshold',p.low_stock_threshold ?? 5,'number','min="0" step="any" required')}`,
    async o => { const b = await post('saveProduct',o); S.products = b.products; toast('Product saved'); drawProducts(); });
}
async function archive(id, restore) { if (!confirm(restore ? 'Restore this product?' : 'Archive this product? Past sales are kept.')) return; const b = await busy(() => post('archiveProduct',{product_id:id,restore})); if (b) { S.products = b.products; drawProducts(); } }
async function removeProduct(id) {
  if (!confirm('Permanently delete this product? This cannot be undone.')) return;
  const b = await busy(() => post('deleteProduct', {product_id: id}));
  if (b) { S.products = b.products; toast('Product deleted'); drawProducts(); }
}
// ---------- inventory ----------
async function inventory() {
  const mv = await api('movements');
  view.innerHTML = `<h1>Inventory</h1><div class="bar"><button class="btn" onclick="moveForm('RECEIVED')">Receive stock</button><button class="btn ghost" onclick="moveForm('ADJUSTMENT_IN')">Adjust up</button><button class="btn ghost" onclick="moveForm('ADJUSTMENT_OUT')">Adjust down</button><button class="btn ghost" onclick="moveForm('DAMAGED')">Damaged / spoiled</button></div>
  ${tbl(['Product','Stock','Low at','Alert'], S.products.map(p => `<tr><td>${esc(p.product_name)}</td><td class="n">${p.current_stock} ${esc(p.stock_unit)}</td><td>${p.low_stock_threshold}</td><td>${Number(p.current_stock) <= Number(p.low_stock_threshold) ? '<span class="warn">Low</span>' : 'OK'}</td></tr>`).join(''), 'No products.')}
  <h2>Movement history</h2><div class="bar"><label>Search<input id="mq" oninput="drawMoves()"></label><label>Product<select id="mp" onchange="drawMoves()"><option value="">All</option>${prodOpts(true).map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select></label><label>Type<select id="mt" onchange="drawMoves()"><option value="">All</option>${['SALE','SALE_REVERSAL','RECEIVED','ADJUSTMENT','DAMAGED','OPENING'].map(t => `<option>${t}</option>`).join('')}</select></label><button class="btn ghost" onclick="csv('inventory-movements',window.MV)">Export CSV</button></div><div id="ml"></div>`;
  window.MV = mv; drawMoves();
}
function drawMoves() {
  const q = $('#mq').value.toLowerCase(), p = $('#mp').value, t = $('#mt').value;
  window.MV2 = window.MV.filter(m => (!p || m.product_id === p) && (!t || m.movement_type === t) && JSON.stringify(m).toLowerCase().includes(q));
  $('#ml').innerHTML = tbl(['Date','Product','Type','Qty','Reason','Transaction'], window.MV2.map(m => `<tr><td>${m.movement_date}</td><td>${esc(m.product_id)}</td><td>${m.movement_type}</td><td class="n">${m.quantity}</td><td>${esc(m.reason)}</td><td>${esc(m.transaction_id)}</td></tr>`).join(''), 'No movements match.');
}
function moveForm(t) {
  const names = {RECEIVED:'Receive stock',ADJUSTMENT_IN:'Adjust stock up',ADJUSTMENT_OUT:'Adjust stock down',DAMAGED:'Record damaged / spoiled'};
  formModal(names[t], `<input type="hidden" name="movement_type" value="${t}"><label>Product${sel('product_id',prodOpts(true))}</label>${field('Quantity','quantity','','number','min="0.01" step="any" required')}${field('Date','movement_date',today(),'date','required')}${field('Reason' + (t === 'RECEIVED' ? ' (optional)' : ''),'reason','','text',t === 'RECEIVED' ? '' : 'required')}`,
    async o => { const b = await post('stockMove',o); S.products = b.products; toast('Stock updated'); inventory(); });
}

// ---------- previous sale ----------
async function hist() {
  S.hRows = 1; S.hReq = newId();
  view.innerHTML = `<h1>Add previous sale</h1><p class="mut">Records a sale that already happened. It is saved under its original date and marked as manually entered. Current product prices are not changed.</p><form class="card f" id="hf">
  <div class="bar">${field('Sale date','sale_date','','date',`required max="${today()}"`)}${field('Time (if known)','sale_time','','time')}<label>Payment method${sel('payment_method',PAY)}</label></div>
  <h3>Items</h3><div id="hrows"></div><button type="button" class="btn ghost sm" onclick="S.hRows++;hRow()">Add another product</button>
  <div class="bar">${field('Discount (₱)','discount',0,'number','min="0" step="0.01"')}${field('Amount received (₱)','amount_paid','','number','min="0" step="0.01" required')}</div>${field('Notes','notes')}<div class="row"><button class="btn">Save previous sale</button></div></form>`;
  hRow(true); $('#hf').onsubmit = histSubmit;
}
function hRow(first) { const d = document.createElement('div'); d.className = 'bar'; d.innerHTML = `<label>Product${sel('h_prod',prodOpts(true))}</label>${field('Quantity','h_qty','','number','min="0.01" step="any" required')}${field('Price at the time (₱)','h_price','','number','min="0.01" step="0.01" required')}`; $('#hrows').appendChild(d); }
async function histSubmit(e) {
  e.preventDefault(); const f = e.target, fd = new FormData(f), prods = fd.getAll('h_prod'), qs = fd.getAll('h_qty'), ps = fd.getAll('h_price');
  const items = prods.map((p, i) => ({product_id:p,quantity:Number(qs[i]),unit_price:Number(ps[i])}));
  const deduct = confirm('Deduct the sold quantities from CURRENT inventory?\n\nOK = deduct and record in inventory history\nCancel = leave stock unchanged');
  const r = await busy(() => post('createSale',{request_id:S.hReq,type:'HISTORICAL',deduct_stock:deduct,items,sale_date:fd.get('sale_date'),sale_time:fd.get('sale_time'),discount:fd.get('discount'),amount_paid:fd.get('amount_paid'),payment_method:fd.get('payment_method'),notes:fd.get('notes')}));
  if (r === false) return; S.products = r.products; toast(r.duplicate ? 'Already saved earlier' : 'Previous sale saved'); showReceipt(r.sale); hist();
}

// ---------- transactions ----------
const txTable = list => tbl(['Transaction','Date','Items','Qty','Subtotal','Discount','Total','Payment','Type','Status',''], list.map(s => `<tr><td>${esc(s.transaction_id)}</td><td>${s.sale_date} ${esc(s.sale_time)}</td><td>${s.items.map(i => esc(i.product_name)).join(', ')}</td><td class="n">${s.items.reduce((t, i) => t + Number(i.quantity), 0)}</td><td class="n">${peso(s.subtotal)}</td><td class="n">${peso(s.discount)}</td><td class="n">${peso(s.total_due)}</td><td>${esc(s.payment_method)}</td><td>${s.transaction_type === 'HISTORICAL' ? 'Manual (previous)' : 'POS'}</td><td>${s.status}</td><td><button class="btn ghost sm" onclick="viewSale('${esc(s.transaction_id)}')">View</button></td></tr>`).join(''), 'No transactions yet.');
async function tx() {
  S.sales = await api('sales');
  view.innerHTML = `<h1>Transactions</h1><div class="bar noprint"><label>Transaction ID<input id="f1" oninput="drawTx()"></label><label>From<input id="f2" type="date" oninput="drawTx()"></label><label>To<input id="f3" type="date" oninput="drawTx()"></label><label>Product<select id="f4" onchange="drawTx()"><option value="">All</option>${prodOpts(true).map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select></label><label>Payment<select id="f5" onchange="drawTx()"><option value="">All</option>${PAY.map(o => `<option>${o[0]}</option>`).join('')}</select></label><button class="btn ghost" onclick="exportTx()">Export CSV</button><button class="btn" onclick="go('hist')">Add previous sale</button></div><div id="tl"></div>`; drawTx();
}
function filtered() { const q = $('#f1').value.toLowerCase(), a = $('#f2').value, b = $('#f3').value, p = $('#f4').value, m = $('#f5').value; return S.sales.filter(s => s.transaction_id.toLowerCase().includes(q) && (!a || s.sale_date >= a) && (!b || s.sale_date <= b) && (!p || s.items.some(i => i.product_id === p)) && (!m || s.payment_method === m)); }
function drawTx() { $('#tl').innerHTML = txTable(filtered()); }
function exportTx() { csv('transactions', filtered().map(s => ({transaction_id:s.transaction_id,date:s.sale_date,time:s.sale_time,items:s.items.map(i => i.product_name + ' x' + i.quantity).join('; '),subtotal:s.subtotal,discount:s.discount,total:s.total_due,payment:s.payment_method,type:s.transaction_type,status:s.status,notes:s.notes}))); }
function viewSale(id) {
  const s = S.sales.find(x => x.transaction_id === id);
  modal(receipt(s) + `<p class="noprint mut">${esc(s.notes)}</p><div class="row noprint"><button class="btn ghost" onclick="dlg.close()">Close</button>${s.status === 'COMPLETED' ? `<button class="btn bad" onclick="voidSale('${esc(id)}')">Cancel sale</button>` : ''}<button class="btn" onclick="printReceipt()">Reprint receipt</button></div>`);
}
async function voidSale(id) {
  const reason = prompt('Why is this sale being cancelled? Stock from this sale will be put back.'); if (!reason) return;
  const r = await busy(() => post('voidSale',{transaction_id:id,reason})); if (!r) return; S.sales = r.sales; S.products = r.products; $('#dlg').close(); toast('Sale cancelled and stock restored'); if ($('#tl')) drawTx();
}

// ---------- expenses ----------
async function exp() {
  window.EX = await api('expenses');
  view.innerHTML = `<h1>Expenses</h1><div class="bar"><label>Category<select id="e1" onchange="drawExp()"><option value="">All</option>${EXC.map(c => `<option>${c}</option>`).join('')}</select></label><label>From<input id="e2" type="date" oninput="drawExp()"></label><label>To<input id="e3" type="date" oninput="drawExp()"></label><button class="btn ghost" onclick="csv('expenses',EXF())">Export CSV</button><button class="btn" onclick="expForm()">Add expense</button></div><div id="el"></div>`; drawExp();
}
const EXC = ['Ingredients','Packaging','Transportation','Utilities','Other expenses'];
const EXF = () => { const c = $('#e1').value, a = $('#e2').value, b = $('#e3').value; return window.EX.filter(e => (!c || e.category === c) && (!a || e.expense_date >= a) && (!b || e.expense_date <= b)); };
function drawExp() { const l = EXF(); $('#el').innerHTML = tbl(['Date','Category','Description','Amount','Payment','Notes',''], l.map(e => `<tr><td>${e.expense_date}</td><td>${esc(e.category)}</td><td>${esc(e.description)}</td><td class="n">${peso(e.amount)}</td><td>${esc(e.payment_method)}</td><td>${esc(e.notes)}</td><td><button class="btn ghost sm" onclick="expForm('${esc(e.expense_id)}')">Edit</button></td></tr>`).join('') + `<tr><td colspan="3"><b>Total</b></td><td class="n"><b>${peso(l.reduce((t, e) => t + Number(e.amount), 0))}</b></td><td colspan="3"></td></tr>`, 'No expenses recorded.'); }
function expForm(id) {
  const e = id ? window.EX.find(x => x.expense_id === id) : {};
  formModal(id ? 'Edit expense' : 'Add expense', `<input type="hidden" name="expense_id" value="${esc(id || '')}">${field('Date','expense_date',e.expense_date || today(),'date','required')}<label>Category${sel('category',EXC.map(c => [c,c]),e.category)}</label>${field('Description','description',e.description,'text','required')}${field('Amount (₱)','amount',e.amount ?? '','number','min="0.01" step="0.01" required')}<label>Payment method${sel('payment_method',PAY,e.payment_method)}</label>${field('Notes','notes',e.notes)}`,
    async o => { window.EX = await post('saveExpense',o); toast('Expense saved'); drawExp(); });
}

// ---------- reports ----------
async function rep(mode) {
  view.innerHTML = `<h1>${mode === 'income' ? 'Income statement' : 'Sales reports'}</h1><div class="bar noprint"><label>Period<select id="rp" onchange="runRep('${mode}')"><option value="day">Today</option><option value="week">Last 7 days</option><option value="month">This month</option><option value="year">This year</option><option value="custom">Custom range</option></select></label><label>From<input id="rf" type="date" value="${today()}"></label><label>To<input id="rt" type="date" value="${today()}"></label><button class="btn" onclick="runRep('${mode}',1)">Show report</button><button class="btn ghost" onclick="window.print()">Print</button><button class="btn ghost" onclick="exportRep()">Export CSV</button></div><div id="ro"></div>`; runRep(mode);
}
async function runRep(mode, manual) {
  const p = $('#rp').value, t = today(), d = new Date(t + 'T00:00:00'); let f = t, to = t;
  if (p === 'week') { d.setDate(d.getDate() - 6); f = d.toLocaleDateString('en-CA'); } else if (p === 'month') f = t.slice(0,8) + '01'; else if (p === 'year') f = t.slice(0,4) + '-01-01';
  if (p === 'custom' || manual) { f = $('#rf').value; to = $('#rt').value; } else { $('#rf').value = f; $('#rt').value = to; }
  const r = await busy(() => api('report',{from:f,to})); if (!r) return; window.RP = r;
  const warn = !r.cost_complete ? '<p class="warn">Incomplete: some items sold have no cost per unit, so cost of goods sold and profit are understated.</p>' : r.cost_estimated ? '<p class="warn">Estimate: previous sales use the product cost currently on file.</p>' : '';
  const row = (l, v, b) => `<tr><td>${b ? '<b>' + l + '</b>' : l}</td><td class="n">${b ? '<b>' + peso(v) + '</b>' : peso(v)}</td></tr>`;
  $('#ro').innerHTML = `<p class="mut">${r.from} to ${r.to}</p>` + (mode === 'income' ? `${warn}${tbl(['Income statement','Amount'], row('Gross sales',r.gross_sales) + row('Less: discounts',-r.discounts) + row('Less: sales returns',-r.returns) + row('Net sales',r.net_sales,1) + row('Less: cost of goods sold',-r.cogs) + row('Gross profit',r.gross_profit,1) + row('Less: operating expenses',-r.expenses_total) + row('Net profit' + (warn ? ' (incomplete/estimate)' : ''),r.net_profit,1))}<p class="mut">Cancelled sales are excluded, not counted as returns. Expenses are subtracted once.</p>`
  : `<div class="cards"><div class="card"><small>Total sales</small><b>${peso(r.net_sales)}</b></div><div class="card"><small>Transactions</small><b>${r.tx_count}</b></div><div class="card"><small>Units sold</small><b>${r.units}</b></div><div class="card"><small>Expenses</small><b>${peso(r.expenses_total)}</b></div></div>
  <h2>Sales by product</h2>${tbl(['Product','Qty sold','Sales'], r.by_product.map(x => `<tr><td>${esc(x.name)}</td><td class="n">${x.qty}</td><td class="n">${peso(x.sales)}</td></tr>`).join(''), 'No sales in this period.')}
  <h2>Sales by payment method</h2>${tbl(['Method','Transactions','Total'], r.by_payment.map(x => `<tr><td>${esc(x.method)}</td><td class="n">${x.count}</td><td class="n">${peso(x.total)}</td></tr>`).join(''), 'No sales in this period.')}
  <h2>Inventory</h2>${tbl(['Product','Beginning','Received','Sold','Spoiled','Adjusted','Current'], r.inventory.map(x => `<tr><td>${esc(x.name)}</td><td class="n">${x.beginning}</td><td class="n">${x.received}</td><td class="n">${x.sold}</td><td class="n">${x.damaged}</td><td class="n">${x.adjusted}</td><td class="n">${x.current}</td></tr>`).join(''), 'No products.')}
  <h2>Expenses by category</h2>${tbl(['Category','Total'], r.expenses_by_cat.map(x => `<tr><td>${esc(x.category)}</td><td class="n">${peso(x.total)}</td></tr>`).join(''), 'No expenses in this period.')}
  <h2>Expenses by date</h2>${tbl(['Date','Total'], r.expenses_by_date.map(x => `<tr><td>${x.date}</td><td class="n">${peso(x.total)}</td></tr>`).join(''), 'No expenses in this period.')}`);
  window.RM = mode;
}
function exportRep() { const r = window.RP; if (!r) return; csv(window.RM === 'income' ? 'income-statement' : 'sales-by-product', window.RM === 'income' ? [['Gross sales',r.gross_sales],['Discounts',r.discounts],['Returns',r.returns],['Net sales',r.net_sales],['Cost of goods sold',r.cogs],['Gross profit',r.gross_profit],['Operating expenses',r.expenses_total],['Net profit',r.net_profit]].map(x => ({line:x[0],amount:x[1],period:r.from + ' to ' + r.to})) : r.by_product.map(x => ({product:x.name,qty_sold:x.qty,sales:x.sales,period:r.from + ' to ' + r.to}))); }

// ---------- settings ----------
async function set() {
  view.innerHTML = `<h1>Settings</h1><form class="card f" id="sf" style="max-width:520px">${field('Business name','business_name',S.settings.business_name)}${field('Contact details (shown on receipts)','contact',S.settings.contact)}<label>Allow stock to go negative<select name="allow_negative_stock"><option value="FALSE" ${S.settings.allow_negative_stock !== 'TRUE' ? 'selected' : ''}>No (recommended)</option><option value="TRUE" ${S.settings.allow_negative_stock === 'TRUE' ? 'selected' : ''}>Yes (owner override)</option></select></label><div class="row"><button class="btn">Save settings</button></div></form>`;
  $('#sf').onsubmit = async e => { e.preventDefault(); const b = await busy(() => post('saveSettings',Object.fromEntries(new FormData(e.target)))); if (b) { S.settings = b.settings; toast('Settings saved'); go('set'); } };
}
go('home');
