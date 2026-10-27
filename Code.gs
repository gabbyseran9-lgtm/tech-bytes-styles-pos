/** Tech Bytes Styles POS backend. Bind to the Google Sheet (Extensions > Apps Script), run setup() once, then deploy as Web App. */
const TZ = 'Asia/Manila';
const SHEETS = {
  Products: ['product_id','product_name','category','selling_price','cost_per_unit','current_stock','stock_unit','low_stock_threshold','status'],
  Sales: ['transaction_id','sale_date','sale_time','subtotal','discount','total_due','amount_paid','change_amount','payment_method','transaction_type','notes','status','created_at'],
  SaleItems: ['sale_item_id','transaction_id','product_id','product_name','quantity','unit_price','unit_cost','line_total'],
  InventoryMovements: ['movement_id','product_id','movement_date','movement_type','quantity','reason','transaction_id','created_at'],
  Expenses: ['expense_id','expense_date','category','description','amount','payment_method','notes','created_at'],
  Settings: ['setting_key','setting_value'],
  AuditLogs: ['log_id','action','record_type','record_id','details','timestamp']
};
const TEXT = ['product_id','transaction_id','sale_date','sale_time','movement_date','expense_date','created_at','timestamp','sale_item_id','movement_id','expense_id','log_id','setting_value'];

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(n => {
    const sh = ss.getSheetByName(n) || ss.insertSheet(n), h = SHEETS[n];
    if (sh.getLastRow() === 0) { sh.appendRow(h); sh.setFrozenRows(1); sh.getRange(1,1,1,h.length).setFontWeight('bold'); }
    h.forEach((c,i) => { if (TEXT.indexOf(c) > -1) sh.getRange(2,i+1,sh.getMaxRows()-1,1).setNumberFormat('@'); });
  });
  if (!rows('Products').length) {
    [['LUMPIA','Lumpia'],['CHEESE-STICKS','Cheese Sticks'],['CHEESE-BALL','Cheese Ball'],['HAM-SANDWICH','Ham Sandwich']].forEach(p =>
      put('Products',{product_id:p[0],product_name:p[1],category:'Snack',selling_price:0,cost_per_unit:0,current_stock:0,stock_unit:'piece',low_stock_threshold:5,status:'ACTIVE'}));
  }
  const have = rows('Settings').map(s => s.setting_key);
  [['business_name','Tech Bytes Styles'],['contact',''],['allow_negative_stock','FALSE']].forEach(d => { if (have.indexOf(d[0]) < 0) put('Settings',{setting_key:d[0],setting_value:d[1]}); });
}

// ---------- helpers ----------
const sh_ = n => SpreadsheetApp.getActive().getSheetByName(n) || (() => { throw new Error('Run setup() first: missing sheet ' + n); })();
function rows(n) {
  const v = sh_(n).getDataRange().getValues(), h = v[0], out = [];
  for (let i = 1; i < v.length; i++) { if (v[i][0] === '') continue; const o = {_row:i+1}; h.forEach((c,j) => o[c] = v[i][j]); out.push(o); }
  return out;
}
function put(n, o) { sh_(n).appendRow(SHEETS[n].map(c => o[c] === undefined ? '' : o[c])); }
function putMany(n, list) { if (!list.length) return; const s = sh_(n); s.getRange(s.getLastRow()+1,1,list.length,SHEETS[n].length).setValues(list.map(o => SHEETS[n].map(c => o[c] === undefined ? '' : o[c]))); }
function upd(n, row, o) { const h = SHEETS[n]; Object.keys(o).forEach(k => { const i = h.indexOf(k); if (i > -1) sh_(n).getRange(row,i+1).setValue(o[k]); }); }
const clean = o => { const c = {}; Object.keys(o).forEach(k => { if (k !== '_row') c[k] = o[k]; }); return c; };
const stamp = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
const todayStr = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
const uid = p => p + '-' + Utilities.formatDate(new Date(), TZ, 'yyyyMMddHHmmss') + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
function num(v, label, min, positive) {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !isFinite(n)) throw new Error(label + ' must be a number');
  if (positive ? n <= 0 : n < min) throw new Error(label + (positive ? ' must be greater than 0' : ' cannot be below ' + min));
  return n;
}
function dt(s, label) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) throw new Error((label || 'Date') + ' must be YYYY-MM-DD'); return String(s); }
function audit(action, type, id, details) { put('AuditLogs',{log_id:uid('LOG'),action:action,record_type:type,record_id:id,details:JSON.stringify(details || {}).slice(0,1000),timestamp:stamp()}); }
function settings() { const o = {}; rows('Settings').forEach(s => o[s.setting_key] = String(s.setting_value)); return o; }
function setStock(prod, val) { upd('Products', prod._row, {current_stock: r2(val)}); }

// ---------- router ----------
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
function doGet(e) { return run(e.parameter.action, e.parameter); }
function doPost(e) { let p; try { p = JSON.parse(e.postData.contents); } catch (x) { return out({ok:false,error:'Invalid request body'}); } return run(p.action, p); }
function run(a, p) {
  const W = {saveProduct:saveProduct,archiveProduct:archiveProduct,createSale:createSale,voidSale:voidSale,stockMove:stockMove,saveExpense:saveExpense,saveSettings:saveSettings};
  const R = {bootstrap:bootstrap,sales:listSales,movements:()=>rows('InventoryMovements').map(clean).reverse(),expenses:()=>rows('Expenses').map(clean).reverse(),report:report};
  try {
    if (W[a]) { const l = LockService.getScriptLock(); l.waitLock(25000); try { return out({ok:true,data:W[a](p)}); } finally { l.releaseLock(); } }
    if (R[a]) return out({ok:true,data:R[a](p)});
    throw new Error('Unknown action');
  } catch (err) { return out({ok:false,error:String(err.message || err)}); }
}
const bootstrap = () => ({products:rows('Products').map(clean),settings:settings()});

// ---------- products ----------
function saveProduct(p) {
  const id = String(p.product_id || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,30}$/.test(id)) throw new Error('Product ID: 2-30 letters, numbers, - or _');
  const name = String(p.product_name || '').trim(); if (!name) throw new Error('Product name is required');
  const rec = {product_name:name,category:String(p.category || 'Snack').trim(),selling_price:r2(num(p.selling_price,'Selling price',0)),cost_per_unit:r2(num(p.cost_per_unit,'Cost per unit',0)),
    stock_unit:String(p.stock_unit || '').trim() || 'piece',low_stock_threshold:num(p.low_stock_threshold,'Low-stock threshold',0)};
  const ex = rows('Products').filter(x => x.product_id === id)[0];
  if (p.mode === 'add') {
    if (ex) throw new Error('Product ID already exists');
    const stock = num(p.current_stock || 0,'Opening stock',0);
    put('Products', Object.assign({product_id:id,current_stock:stock,status:'ACTIVE'}, rec));
    if (stock > 0) put('InventoryMovements',{movement_id:uid('MOV'),product_id:id,movement_date:todayStr(),movement_type:'OPENING',quantity:stock,reason:'Opening stock',transaction_id:'',created_at:stamp()});
    audit('ADD','Product',id,rec);
  } else {
    if (!ex) throw new Error('Product not found');
    upd('Products', ex._row, rec); audit('EDIT','Product',id,{before:clean(ex),after:rec});
  }
  return bootstrap();
}
function archiveProduct(p) {
  const ex = rows('Products').filter(x => x.product_id === p.product_id)[0]; if (!ex) throw new Error('Product not found');
  const st = p.restore ? 'ACTIVE' : 'ARCHIVED'; upd('Products', ex._row, {status:st}); audit(st,'Product',ex.product_id,{}); return bootstrap();
}

// ---------- sales ----------
function listSales() {
  const items = {}; rows('SaleItems').forEach(i => (items[i.transaction_id] = items[i.transaction_id] || []).push(clean(i)));
  return rows('Sales').map(s => Object.assign(clean(s), {items:items[s.transaction_id] || []})).reverse();
}
function createSale(p) {
  const id = String(p.request_id || '');
  if (!/^TBS-[A-Z0-9-]{8,}$/.test(id)) throw new Error('Missing or invalid transaction ID');
  const dupe = listSales().filter(s => s.transaction_id === id)[0];
  if (dupe) return {duplicate:true,sale:dupe};            // retry-safe: nothing is written twice
  const hist = p.type === 'HISTORICAL';
  if (!Array.isArray(p.items) || !p.items.length) throw new Error('Cart is empty');
  const prods = rows('Products'), allowNeg = settings().allow_negative_stock === 'TRUE';
  const date = hist ? dt(p.sale_date,'Sale date') : todayStr();
  if (hist && date > todayStr()) throw new Error('Previous sale date cannot be in the future');
  const time = hist ? (/^\d{2}:\d{2}$/.test(p.sale_time || '') ? p.sale_time : '') : Utilities.formatDate(new Date(), TZ, 'HH:mm');
  const deduct = !hist || p.deduct_stock === true || p.deduct_stock === 'true';
  const items = [], moves = []; let sub = 0;
  p.items.forEach((it, n) => {
    const pr = prods.filter(x => x.product_id === it.product_id)[0]; if (!pr) throw new Error('Unknown product: ' + it.product_id);
    if (!hist && pr.status !== 'ACTIVE') throw new Error(pr.product_name + ' is archived');
    const q = num(it.quantity, 'Quantity for ' + pr.product_name, 0, true);
    const price = r2(hist ? num(it.unit_price, 'Price for ' + pr.product_name, 0, true) : Number(pr.selling_price));
    if (!(price > 0)) throw new Error('Set a selling price for ' + pr.product_name + ' first');
    const line = r2(price * q); sub = r2(sub + line);
    items.push({sale_item_id:id + '-' + (n+1),transaction_id:id,product_id:pr.product_id,product_name:pr.product_name,quantity:q,unit_price:price,unit_cost:Number(pr.cost_per_unit) || 0,line_total:line});
    if (deduct) {
      pr._s = (pr._s === undefined ? Number(pr.current_stock) : pr._s) - q;
      if (pr._s < 0 && !allowNeg) throw new Error('Not enough stock for ' + pr.product_name + ' (have ' + (pr._s + q) + ')');
      moves.push({movement_id:id + '-M' + (n+1),product_id:pr.product_id,movement_date:date,movement_type:'SALE',quantity:-q,reason:hist ? 'Previous sale (stock deducted)' : 'Sale',transaction_id:id,created_at:stamp()});
    }
  });
  const disc = r2(num(p.discount || 0, 'Discount', 0)); if (disc > sub) throw new Error('Discount cannot exceed subtotal');
  const total = r2(sub - disc), paid = r2(num(p.amount_paid, 'Amount paid', 0));
  if (paid < total) throw new Error('Payment is less than the amount due');
  const method = String(p.payment_method || 'Cash').slice(0,30);
  const sale = {transaction_id:id,sale_date:date,sale_time:time,subtotal:sub,discount:disc,total_due:total,amount_paid:paid,change_amount:r2(paid - total),payment_method:method,
    transaction_type:hist ? 'HISTORICAL' : 'POS',notes:String(p.notes || '').slice(0,300),status:'COMPLETED',created_at:stamp()};
  put('Sales', sale); putMany('SaleItems', items); putMany('InventoryMovements', moves);
  prods.forEach(pr => { if (pr._s !== undefined) setStock(pr, pr._s); });
  audit(hist ? 'ADD_HISTORICAL_SALE' : 'SALE','Sale',id,{total:total,lines:items.length,stock_deducted:deduct});
  return {duplicate:false,sale:Object.assign(sale,{items:items}),products:bootstrap().products};
}
function voidSale(p) {
  const s = rows('Sales').filter(x => x.transaction_id === p.transaction_id)[0]; if (!s) throw new Error('Sale not found');
  if (s.status !== 'COMPLETED') throw new Error('Sale is already ' + s.status);
  const reason = String(p.reason || '').trim(); if (reason.length < 3) throw new Error('A reason is required');
  const prods = rows('Products');
  rows('InventoryMovements').filter(m => m.transaction_id === s.transaction_id && m.movement_type === 'SALE').forEach(m => {
    const pr = prods.filter(x => x.product_id === m.product_id)[0];
    if (pr) { pr._s = (pr._s === undefined ? Number(pr.current_stock) : pr._s) - Number(m.quantity); }
    put('InventoryMovements',{movement_id:uid('MOV'),product_id:m.product_id,movement_date:todayStr(),movement_type:'SALE_REVERSAL',quantity:-Number(m.quantity),reason:'Cancelled: ' + reason,transaction_id:s.transaction_id,created_at:stamp()});
  });
  prods.forEach(pr => { if (pr._s !== undefined) setStock(pr, pr._s); });
  upd('Sales', s._row, {status:'CANCELLED',notes:((s.notes ? s.notes + ' | ' : '') + 'Cancelled: ' + reason).slice(0,300)});
  audit('VOID_SALE','Sale',s.transaction_id,{reason:reason}); return {sales:listSales(),products:bootstrap().products};
}

// ---------- inventory ----------
function stockMove(p) {
  const pr = rows('Products').filter(x => x.product_id === p.product_id)[0]; if (!pr) throw new Error('Product not found');
  const t = p.movement_type, q = num(p.quantity, 'Quantity', 0, true);
  if (['RECEIVED','ADJUSTMENT_IN','ADJUSTMENT_OUT','DAMAGED'].indexOf(t) < 0) throw new Error('Invalid movement type');
  const reason = String(p.reason || '').trim(); if (t !== 'RECEIVED' && !reason) throw new Error('A reason is required');
  const signed = (t === 'RECEIVED' || t === 'ADJUSTMENT_IN') ? q : -q, after = Number(pr.current_stock) + signed;
  if (after < 0 && settings().allow_negative_stock !== 'TRUE') throw new Error('Stock cannot go below zero');
  const type = t.indexOf('ADJUSTMENT') === 0 ? 'ADJUSTMENT' : t;
  put('InventoryMovements',{movement_id:uid('MOV'),product_id:pr.product_id,movement_date:p.movement_date ? dt(p.movement_date) : todayStr(),movement_type:type,quantity:signed,reason:reason,transaction_id:'',created_at:stamp()});
  setStock(pr, after); audit('STOCK_' + type,'Product',pr.product_id,{qty:signed,reason:reason}); return bootstrap();
}

// ---------- expenses & settings ----------
function saveExpense(p) {
  const rec = {expense_date:dt(p.expense_date,'Expense date'),category:String(p.category || '').trim(),description:String(p.description || '').trim(),amount:r2(num(p.amount,'Amount',0,true)),
    payment_method:String(p.payment_method || 'Cash').slice(0,30),notes:String(p.notes || '').slice(0,300)};
  if (!rec.category || !rec.description) throw new Error('Category and description are required');
  if (p.expense_id) {
    const ex = rows('Expenses').filter(x => x.expense_id === p.expense_id)[0]; if (!ex) throw new Error('Expense not found');
    upd('Expenses', ex._row, rec); audit('EDIT','Expense',p.expense_id,{before:clean(ex),after:rec});
  } else { const id = uid('EXP'); put('Expenses', Object.assign({expense_id:id,created_at:stamp()}, rec)); audit('ADD','Expense',id,rec); }
  return rows('Expenses').map(clean).reverse();
}
function saveSettings(p) {
  ['business_name','contact','allow_negative_stock'].forEach(k => {
    if (p[k] === undefined) return; const v = String(p[k]).slice(0,200), ex = rows('Settings').filter(s => s.setting_key === k)[0];
    if (ex) upd('Settings', ex._row, {setting_value:v}); else put('Settings',{setting_key:k,setting_value:v});
  });
  audit('EDIT','Settings','settings',p); return bootstrap();
}

// ---------- reports ----------
function report(p) {
  const from = dt(p.from,'From'), to = dt(p.to,'To'); if (from > to) throw new Error('From date is after To date');
  const inR = d => d >= from && d <= to;
  const sales = rows('Sales').filter(s => s.status === 'COMPLETED' && inR(s.sale_date)), ids = {}; sales.forEach(s => ids[s.transaction_id] = 1);
  const items = rows('SaleItems').filter(i => ids[i.transaction_id]);
  const sum = (a, f) => r2(a.reduce((t, x) => t + Number(f(x) || 0), 0));
  const gross = sum(sales, s => s.subtotal), disc = sum(sales, s => s.discount), net = r2(gross - disc), cogs = sum(items, i => i.quantity * i.unit_cost);
  const exp = rows('Expenses').filter(e => inR(e.expense_date)), opex = sum(exp, e => e.amount);
  const group = (arr, key, fn) => { const m = {}; arr.forEach(x => { const k = key(x); m[k] = fn(m[k], x); }); return m; };
  const byProd = group(items, i => i.product_id, (a, i) => { a = a || {product_id:i.product_id,name:i.product_name,qty:0,sales:0,cogs:0}; a.qty += Number(i.quantity); a.sales = r2(a.sales + Number(i.line_total)); a.cogs = r2(a.cogs + i.quantity * i.unit_cost); return a; });
  const byPay = group(sales, s => s.payment_method, (a, s) => { a = a || {method:s.payment_method,count:0,total:0}; a.count++; a.total = r2(a.total + Number(s.total_due)); return a; });
  const byCat = group(exp, e => e.category, (a, e) => { a = a || {category:e.category,total:0}; a.total = r2(a.total + Number(e.amount)); return a; });
  const byDate = group(exp, e => e.expense_date, (a, e) => { a = a || {date:e.expense_date,total:0}; a.total = r2(a.total + Number(e.amount)); return a; });
  const moves = rows('InventoryMovements');
  const inventory = rows('Products').map(pr => {
    const mine = moves.filter(m => m.product_id === pr.product_id), after = mine.filter(m => m.movement_date >= from), inr = mine.filter(m => inR(m.movement_date));
    const tot = t => inr.filter(m => t.indexOf(m.movement_type) > -1).reduce((a, m) => a + Number(m.quantity), 0), begin = Number(pr.current_stock) - sum(after, m => m.quantity);
    return {product_id:pr.product_id,name:pr.product_name,beginning:r2(begin),received:r2(tot(['RECEIVED','OPENING'])),sold:r2(-tot(['SALE','SALE_REVERSAL'])),damaged:r2(-tot(['DAMAGED'])),adjusted:r2(tot(['ADJUSTMENT'])),current:Number(pr.current_stock)};
  });
  return {from:from,to:to,tx_count:sales.length,units:sum(items, i => i.quantity),gross_sales:gross,discounts:disc,returns:0,net_sales:net,cogs:cogs,gross_profit:r2(net - cogs),
    expenses_total:opex,net_profit:r2(net - cogs - opex),cost_complete:items.every(i => Number(i.unit_cost) > 0),cost_estimated:sales.some(s => s.transaction_type === 'HISTORICAL'),
    by_product:Object.values(byProd),by_payment:Object.values(byPay),expenses_by_cat:Object.values(byCat),expenses_by_date:Object.values(byDate).sort((a,b) => a.date < b.date ? -1 : 1),inventory:inventory};
}
