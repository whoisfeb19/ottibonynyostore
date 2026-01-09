// app.js — lengkap
// Fitur:
// - Produk: tampil, tambah, edit, hapus (coba server / fallback in-memory + download products.js)
// - Kategori: datalist (pilih yang ada atau ketik baru), otomatis update setelah add/edit/delete
// - Keranjang & Checkout (QRIS & Tunai)
// - Transaksi: dicatat ke localStorage, panel Laporan (30 hari & 365 hari)
// - Menggunakan header x-admin-secret jika Anda isi Admin Secret di form

const state = {
  products: typeof PRODUCTS !== 'undefined' ? PRODUCTS.slice() : [],
  filtered: typeof PRODUCTS !== 'undefined' ? PRODUCTS.slice() : [],
  categories: [],
  cart: [],
  editingId: null,
  transactions: []
};

function $(sel){ return document.querySelector(sel) }
function formatCurrency(v){
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits:0 }).format(v);
}

/* ---------- Init ---------- */
function init(){
  loadTransactionsFromLocalStorage();
  collectCategories();
  renderCategories();
  renderCategoryDatalist();
  renderProducts();
  setupEvents();
  updateCartCount();
  renderReports();
}
window.onload = init;

/* ---------- Transactions persistence & reporting ---------- */
function loadTransactionsFromLocalStorage(){
  try {
    const s = localStorage.getItem('transactions');
    state.transactions = s ? JSON.parse(s) : [];
  } catch(e){
    console.warn('Gagal load transactions dari localStorage', e);
    state.transactions = [];
  }
}
function saveTransactionsToLocalStorage(){
  try { localStorage.setItem('transactions', JSON.stringify(state.transactions)); }
  catch(e){ console.warn('Gagal simpan transactions ke localStorage', e); }
}
function recordTransaction(order){
  const t = Object.assign({}, order, { timestamp: Date.now() });
  state.transactions.push(t);
  saveTransactionsToLocalStorage();
  renderReports();
}
function renderReports(){
  const now = Date.now();
  const since30 = now - 30*24*60*60*1000;
  const since365 = now - 365*24*60*60*1000;
  const tx = state.transactions || [];

  const recent30 = tx.filter(t => t.timestamp >= since30);
  const recent365 = tx.filter(t => t.timestamp >= since365);
  const sum = arr => arr.reduce((s,i)=>s + (Number(i.total)||0), 0);

  const total30 = sum(recent30), total365 = sum(recent365);
  const count30 = recent30.length, count365 = recent365.length;

  const elCount30 = $("#reportCount30"); if(elCount30) elCount30.textContent = count30;
  const elTotal30 = $("#reportTotal30"); if(elTotal30) elTotal30.textContent = formatCurrency(total30);
  const elCount365 = $("#reportCount365"); if(elCount365) elCount365.textContent = count365;
  const elTotal365 = $("#reportTotal365"); if(elTotal365) elTotal365.textContent = formatCurrency(total365);

  const listEl = $("#reportList");
  if(listEl){
    const sorted = tx.slice().sort((a,b)=>b.timestamp - a.timestamp).slice(0,100);
    if(sorted.length === 0){
      listEl.innerHTML = '<div class="muted">Belum ada transaksi.</div>';
      return;
    }
    listEl.innerHTML = sorted.map(t => {
      const d = new Date(t.timestamp);
      const date = d.toLocaleString();
      const items = (t.items || []).map(it => `${it.name} x${it.qty}`).join(', ');
      return `<div style="padding:8px;border-bottom:1px solid #eee">
        <div style="font-weight:600">${escapeHtml(t.id)} · ${escapeHtml(t.method)} · ${formatCurrency(t.total)}</div>
        <div class="small muted">${escapeHtml(date)}</div>
        <div class="small">${escapeHtml(items)}</div>
      </div>`;
    }).join('');
  }
}

/* ---------- Categories ---------- */
function collectCategories(){
  const map = {};
  state.products.forEach(p => {
    const raw = String(p.category || '').trim();
    if(!raw) return;
    const key = raw.toLowerCase();
    if(!map[key]) map[key] = raw;
  });
  state.categories = ["Semua", ...Object.values(map)];
}
function renderCategories(){
  const container = $("#categories");
  if(!container) return;
  container.innerHTML = "";
  state.categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.className = "category-btn" + (cat === "Semua" ? " active" : "");
    btn.dataset.cat = cat;
    btn.addEventListener("click", () => {
      document.querySelectorAll(".category-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      filterByCategory(cat);
    });
    container.appendChild(btn);
  });
  renderCategoryDatalist();
}
function renderCategoryDatalist(){
  const dl = $("#categoriesList");
  if(!dl) return;
  const opts = state.categories.filter(c => c !== "Semua");
  dl.innerHTML = opts.map(o => `<option value="${escapeHtml(o)}">`).join("");
}
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ---------- Product rendering & filtering ---------- */
function filterByCategory(cat){
  const qEl = $("#search");
  const q = qEl ? qEl.value.trim().toLowerCase() : "";
  state.filtered = state.products.filter(p => {
    const matchCat = (cat === "Semua") || p.category === cat;
    const matchQ = p.name.toLowerCase().includes(q);
    return matchCat && matchQ;
  });
  renderProducts();
}
function renderProducts(){
  const grid = $("#products"); if(!grid) return;
  grid.innerHTML = "";
  state.filtered.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'" />
      <h4>${escapeHtml(p.name)}</h4>
      <p class="small">${escapeHtml(p.category)}</p>
      <div class="price">${formatCurrency(p.price)}</div>
      <div class="actions">
        <button class="btn add" data-id="${p.id}">Tambah</button>
        <button class="btn edit" data-id="${p.id}">Edit</button>
        <button class="btn del" data-id="${p.id}">Hapus</button>
        <button class="btn" data-id="${p.id}" onclick="viewDetail('${p.id}')">Detail</button>
      </div>
    `;
    grid.appendChild(card);
  });

  // attach listeners (works because we call them after render)
  document.querySelectorAll(".btn.add").forEach(b => b.addEventListener("click", () => addToCart(b.dataset.id)));
  document.querySelectorAll(".btn.edit").forEach(b => b.addEventListener("click", () => openEditProduct(b.dataset.id)));
  document.querySelectorAll(".btn.del").forEach(b => b.addEventListener("click", () => deleteProduct(b.dataset.id)));
}

/* ---------- Product actions & cart ---------- */
function viewDetail(id){
  const p = state.products.find(x => x.id===id);
  if(!p) return alert("Produk tidak ditemukan.");
  alert(`${p.name}\nKategori: ${p.category}\nHarga: ${formatCurrency(p.price)}`);
}
function addToCart(id){
  const p = state.products.find(x => x.id===id);
  if(!p) return;
  const existing = state.cart.find(i => i.id === id);
  if(existing) existing.qty += 1;
  else state.cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty: 1 });
  updateCartCount(); renderCart(); openCart();
}
function updateCartCount(){
  const count = state.cart.reduce((s,i)=>s+i.qty,0);
  const el = $("#cartCount"); if(el) el.textContent = count;
  const cb = $("#checkoutBtn"); if(cb) cb.disabled = count === 0;
}
function renderCart(){
  const container = $("#cartItems"); if(!container) return;
  container.innerHTML = "";
  state.cart.forEach(item => {
    const el = document.createElement("div");
    el.className = "cart-item";
    el.innerHTML = `
      <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/100x100?text=No+Image'"/>
      <div style="flex:1">
        <div><strong>${escapeHtml(item.name)}</strong></div>
        <div class="small">${formatCurrency(item.price)} x ${item.qty} = <strong>${formatCurrency(item.price*item.qty)}</strong></div>
        <div style="margin-top:6px">
          <div class="qty-controls">
            <button class="btn" data-id="${item.id}" data-act="dec">-</button>
            <div class="small" style="padding:6px 10px;border-radius:6px;background:#f4f7ff">${item.qty}</div>
            <button class="btn" data-id="${item.id}" data-act="inc">+</button>
            <button class="btn" data-id="${item.id}" data-act="rm" style="margin-left:8px">Hapus</button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(el);
  });

  container.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id; const act = btn.dataset.act;
      const item = state.cart.find(i=>i.id===id); if(!item) return;
      if(act === 'inc') item.qty++;
      if(act === 'dec') item.qty = Math.max(1, item.qty-1);
      if(act === 'rm') state.cart = state.cart.filter(i=>i.id!==id);
      renderCart(); updateCartCount();
    });
  });

  const subtotal = state.cart.reduce((s,i)=>s + i.price * i.qty, 0);
  const sEl = $("#subtotal"); if(sEl) sEl.textContent = formatCurrency(subtotal);
  const tEl = $("#totalItems"); if(tEl) tEl.textContent = state.cart.reduce((s,i)=>s+i.qty,0);
}

/* ---------- Panels open/close & form ---------- */
function openCart(){ const e=$("#cartPanel"); if(e) e.classList.remove("hidden"); }
function closeCart(){ const e=$("#cartPanel"); if(e) e.classList.add("hidden"); }
function openCheckout(){ const e=$("#checkoutPanel"); if(e) e.classList.remove("hidden"); }
function closeCheckout(){ const e=$("#checkoutPanel"); if(e) e.classList.add("hidden"); }

function openAddProduct(){
  state.editingId = null;
  const eid = $("#editingId"); if(eid) eid.value = "";
  const title = $("#addProductTitle"); if(title) title.textContent = "Tambah Produk";
  const btn = $("#saveProductBtn"); if(btn) btn.textContent = "Simpan";
  const form = $("#addProductForm"); if(form) form.reset();
  renderCategoryDatalist();
  const panel = $("#addProductPanel"); if(panel){ panel.classList.remove("hidden"); panel.classList.add('modal-centered'); }
}
function closeAddProduct(){ const panel = $("#addProductPanel"); if(panel) panel.classList.add("hidden"); }

function openEditProduct(id){
  const p = state.products.find(x => x.id === id);
  if(!p) return alert("Produk tidak ditemukan.");
  state.editingId = id;
  const eid = $("#editingId"); if(eid) eid.value = id;
  $("#addName").value = p.name;
  $("#addCategory").value = p.category;
  $("#addPrice").value = p.price;
  $("#addImage").value = p.image;
  const title = $("#addProductTitle"); if(title) title.textContent = "Edit Produk";
  const btn = $("#saveProductBtn"); if(btn) btn.textContent = "Perbarui";
  renderCategoryDatalist();
  const panel = $("#addProductPanel"); if(panel){ panel.classList.remove("hidden"); panel.classList.add('modal-centered'); }
}

/* ---------- Events setup ---------- */
function setupEvents(){
  const cartBtn = $("#cartBtn"); if(cartBtn) cartBtn.addEventListener("click", openCart);
  const closeCartBtn = $("#closeCart"); if(closeCartBtn) closeCartBtn.addEventListener("click", closeCart);
  const checkoutBtn = $("#checkoutBtn"); if(checkoutBtn) checkoutBtn.addEventListener("click", ()=>{ populateCheckout(); closeCart(); openCheckout(); });
  const closeCheckoutBtn = $("#closeCheckout"); if(closeCheckoutBtn) closeCheckoutBtn.addEventListener("click", closeCheckout);

  const searchEl = $("#search"); if(searchEl) searchEl.addEventListener("input", ()=>{ const active = document.querySelector(".category-btn.active"); const cat = active ? active.dataset.cat : "Semua"; filterByCategory(cat); });

  document.querySelectorAll('input[name="payment"]').forEach(r=> r.addEventListener("change", ()=>{
    const v = document.querySelector('input[name="payment"]:checked').value;
    const q = $("#qrisSection"), c = $("#cashSection");
    if(q) q.classList.toggle('hidden', v !== 'qris');
    if(c) c.classList.toggle('hidden', v !== 'cash');
    // explicitly show/hide and enable/disable confirm buttons using hidden class
    const confirmQ = $("#confirmQris"), confirmC = $("#confirmCash");
    if(confirmQ) { confirmQ.classList.toggle('hidden', v !== 'qris'); if(v !== 'qris') confirmQ.disabled = true; }
    if(confirmC) { confirmC.classList.toggle('hidden', v !== 'cash'); if(v !== 'cash') confirmC.disabled = true; }
    // refresh checkout state so other UI pieces are correctly updated
    try{ populateCheckout(); }catch(e){/* ignore */}
  }));

  const cashInput = $("#cashInput"); if(cashInput) cashInput.addEventListener("input", handleCashInput);
  const confirmCash = $("#confirmCash"); if(confirmCash) confirmCash.addEventListener("click", confirmCashPayment);
  const confirmQris = $("#confirmQris"); if(confirmQris) confirmQris.addEventListener("click", confirmQrisPayment);
  const printBtn = $("#printReceipt"); if(printBtn) printBtn.addEventListener("click", printReceipt);

  const openAdd = $("#openAddProduct"); if(openAdd) openAdd.addEventListener("click", openAddProduct);
  const closeAdd = $("#closeAddProduct"); if(closeAdd) closeAdd.addEventListener("click", closeAddProduct);
  const cancelAdd = $("#cancelAdd"); if(cancelAdd) cancelAdd.addEventListener("click", ()=>{ const f=$("#addProductForm"); if(f) f.reset(); closeAddProduct(); });
  const form = $("#addProductForm"); if(form) form.addEventListener("submit", (e)=>{ e.preventDefault(); handleAddProductSubmit(); });

  const openReports = $("#openReports"); if(openReports) openReports.addEventListener("click", ()=>{ const p=$("#reportsPanel"); if(p) p.classList.remove("hidden"); renderReports(); });
  const closeReports = $("#closeReports"); if(closeReports) closeReports.addEventListener("click", ()=>{ const p=$("#reportsPanel"); if(p) p.classList.add("hidden"); });
  const exportReports = $("#exportReports"); if(exportReports) exportReports.addEventListener("click", ()=>{ const data = JSON.stringify(state.transactions, null, 2); const blob = new Blob([data], {type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='transactions.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); });
  const clearReports = $("#clearReports"); if(clearReports) clearReports.addEventListener("click", ()=>{ if(confirm('Hapus semua log transaksi?')){ state.transactions=[]; saveTransactionsToLocalStorage(); renderReports(); alert('Semua log dihapus.'); }});
}

/* ---------- Checkout & receipt ---------- */
function populateCheckout(){
  const summaryEl = $("#orderSummary"); if(!summaryEl) return;
  summaryEl.innerHTML = "";
  if(state.cart.length === 0){ summaryEl.textContent = "Keranjang kosong."; return; }
  const ul = document.createElement("div");
  ul.innerHTML = state.cart.map(i=>`- ${escapeHtml(i.name)} x ${i.qty} = ${formatCurrency(i.price*i.qty)}`).join("\n");
  summaryEl.appendChild(ul);

  const subtotal = state.cart.reduce((s,i)=>s + i.price * i.qty, 0);
  const tEl = document.createElement("div");
  tEl.style.marginTop = "10px";
  tEl.innerHTML = `<strong>Total: ${formatCurrency(subtotal)}</strong>`;
  summaryEl.appendChild(tEl);
  // Configure payment-specific UI
  const selectedPayment = document.querySelector('input[name="payment"]:checked') ? document.querySelector('input[name="payment"]:checked').value : 'qris';
  const qSection = $("#qrisSection"); const cSection = $("#cashSection");
  if(qSection) qSection.classList.toggle('hidden', selectedPayment !== 'qris');
  if(cSection) cSection.classList.toggle('hidden', selectedPayment !== 'cash');

  // QRIS setup
  generateQris(subtotal);

  // Cash setup
  const ct = $("#cashTotal"); if(ct) ct.textContent = formatCurrency(subtotal);
  const ci = $("#cashInput"); if(ci) ci.value = "";
  const cr = $("#cashReceived"); if(cr) cr.textContent = formatCurrency(0);
  const cc = $("#cashChange"); if(cc) cc.textContent = formatCurrency(0);
  const cb = $("#confirmCash"); if(cb) cb.disabled = true;
  const cm = $("#cashMessage"); if(cm) cm.textContent = "";
  const r = $("#receipt"); if(r) r.classList.add("hidden");
  const rt = $("#receiptText"); if(rt) rt.textContent = "";
  // Ensure confirm buttons visibility and state (use hidden class)
  const confirmQ = $("#confirmQris"), confirmC = $("#confirmCash");
  if(confirmQ) {
    confirmQ.classList.toggle('hidden', selectedPayment !== 'qris');
    // reset label and disabled state when opening checkout
    confirmQ.disabled = true;
    confirmQ.textContent = 'Selesai (Bayar)';
  }
  if(confirmC) {
    confirmC.classList.toggle('hidden', selectedPayment !== 'cash');
    // reset label and disabled state when opening checkout
    confirmC.disabled = true;
    confirmC.textContent = 'Selesai (Terima Tunai)';
  }
}

function generateQris(total){
  const orderId = "ORD" + Date.now();
  const qimg = $("#qrisImage");
  const info = $("#qrisInfo");
  const confirm = $("#confirmQris");
  if(confirm){ confirm.dataset.order = orderId; confirm.dataset.total = total; confirm.disabled = true; }

  // Check for merchant QR image: prefer static merchant QR if provided
  // Two ways to configure: add data-merchant-qr attribute to #checkoutPanel, or set window.MERCHANT_QR_URL
  const checkoutPanel = $("#checkoutPanel");
  const merchantQrUrl = (checkoutPanel && checkoutPanel.dataset && checkoutPanel.dataset.merchantQr) ? checkoutPanel.dataset.merchantQr : (window.MERCHANT_QR_URL || null);

  if(info) info.textContent = `Order: ${orderId} • Total: ${formatCurrency(total)}`;

  if(qimg){
    qimg.alt = "QRIS";
    qimg.onload = () => { if(confirm) confirm.disabled = false; };
    qimg.onerror = () => { if(confirm) confirm.disabled = true; if(info) info.textContent = `Gagal memuat QR — coba lagi.`; };

    if(merchantQrUrl){
      // Use the merchant-provided QR image (e.g., GoPay merchant static QR)
      qimg.src = merchantQrUrl;
      // Note: static merchant QR may not include amount; show a helper message
      if(info) info.textContent += ' • Gunakan aplikasi pembayaran untuk pindai dan bayar.';
    } else {
      // Fallback: generate dynamic QR via Google Chart API (encodes a simple payload)
      const payload = `TokoContoh|${orderId}|${total}`;
      const qurl = "https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=" + encodeURIComponent(payload);
      qimg.alt = "QRIS for " + orderId;
      qimg.src = qurl;
    }
  }
}

function handleCashInput(){
  const val = Number($("#cashInput").value || 0);
  const total = state.cart.reduce((s,i)=>s+i.price*i.qty,0);
  const cr = $("#cashReceived"); if(cr) cr.textContent = formatCurrency(val);
  const change = val - total;
  const cc = $("#cashChange"); if(cc) cc.textContent = formatCurrency(Math.max(0, change));
  if(val >= total && total > 0){
    const cm = $("#cashMessage"); if(cm) cm.textContent = "Nominal cukup. Klik Selesai untuk menerima pembayaran.";
    const cb = $("#confirmCash"); if(cb) { cb.disabled = false; cb.classList.toggle('hidden', false); }
  } else {
    const cm = $("#cashMessage");
    if(total === 0){ if(cm) cm.textContent = "Keranjang kosong."; }
    else { if(cm) cm.textContent = `Kurang ${formatCurrency(Math.max(0, total - val))}`; }
    const cb = $("#confirmCash"); if(cb) { cb.disabled = true; cb.classList.toggle('hidden', true); }
  }
}

function confirmCashPayment(){
  const val = Number($("#cashInput").value || 0);
  const total = state.cart.reduce((s,i)=>s+i.price*i.qty,0);
  const order = { id: "CASH" + Date.now(), method: "Tunai", total, received: val, change: Math.max(0, val - total), items: state.cart.map(i=>({ name:i.name, qty:i.qty, price:i.price })) };
  showReceipt(order);
  recordTransaction(order);
  state.cart = []; renderCart(); updateCartCount();
  const cb = $("#confirmCash"); if(cb) { cb.disabled = true; cb.textContent = 'Pembayaran Selesai'; }
}

function confirmQrisPayment(){
  const orderId = $("#confirmQris").dataset.order;
  const total = Number($("#confirmQris").dataset.total || 0);
  const order = { id: orderId, method: "QRIS", total, received: total, change: 0, items: state.cart.map(i=>({ name:i.name, qty:i.qty, price:i.price })) };
  showReceipt(order);
  recordTransaction(order);
  state.cart = []; renderCart(); updateCartCount();
  const cq = $("#confirmQris"); if(cq) { cq.disabled = true; cq.textContent = 'Pembayaran Selesai'; }
}

function showReceipt(order){
  const r = $("#receipt"); if(r) r.classList.remove("hidden");
  const lines = [];
  lines.push("Toko Contoh");
  lines.push("Order ID: " + order.id);
  lines.push("Metode: " + order.method);
  lines.push("---------------------------------");
  order.items.forEach(i => lines.push(`${i.name} x${i.qty}  ${formatCurrency(i.price*i.qty)}`));
  lines.push("---------------------------------");
  lines.push("Total: " + formatCurrency(order.total));
  lines.push("Diterima: " + formatCurrency(order.received));
  lines.push("Kembalian: " + formatCurrency(order.change));
  lines.push("");
  lines.push("Terima kasih atas pembelian Anda!");
  const rt = $("#receiptText"); if(rt) rt.textContent = lines.join("\n");
}

/* ---------- Print helper: print only the receipt content ---------- */
function printReceipt(){
  const receiptEl = $("#receipt");
  const textEl = $("#receiptText");
  if(!receiptEl || !textEl || !textEl.textContent.trim()){ alert('Tidak ada resi yang bisa dicetak.'); return; }

  const content = receiptEl.cloneNode(true);
  // remove buttons inside cloned content to avoid printing interactive elements
  content.querySelectorAll('button').forEach(b => b.remove());

  const win = window.open('', '_blank', 'width=600,height=800');
  if(!win){ alert('Gagal membuka jendela cetak. Periksa popup blocker.'); return; }
  const doc = win.document;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Struk Pembelian</title>`);
  // minimal styles for receipt print
  doc.write(`<style>
    body{ font-family: Arial, Helvetica, sans-serif; padding:20px; color:#111; }
    .receipt-wrapper{ max-width:520px; margin:0 auto; }
    pre{ white-space: pre-wrap; font-family: inherit; font-size:14px; }
    h3{ text-align:center; margin-bottom:6px; }
  </style>`);
  doc.write(`</head><body><div class="receipt-wrapper">`);
  doc.write(content.innerHTML);
  doc.write(`</div></body></html>`);
  doc.close();
  // give browser a moment to render then print
  setTimeout(()=>{ try{ win.focus(); win.print(); win.close(); }catch(e){ console.warn('Print failed', e); } }, 300);
}

/* ---------- Add / Edit / Delete products (server-backed with fallback) ---------- */
async function handleAddProductSubmit(){
  const nameEl = $("#addName"); const catEl = $("#addCategory"); const priceEl = $("#addPrice"); const imgEl = $("#addImage");
  if(!nameEl || !catEl || !priceEl) return alert('Form tidak lengkap.');
  const name = nameEl.value.trim();
  const category = catEl.value.trim() || "Umum";
  const price = Number(priceEl.value || 0);
  const image = imgEl.value.trim() || "https://via.placeholder.com/400x300?text=Product";
  const secret = $("#adminSecret") ? $("#adminSecret").value.trim() : "";

  if(!name || price <= 0){ alert("Isikan nama dan harga produk yang valid."); return; }

  const editingId = state.editingId; // null jika create

  if(editingId){
    // update via server, fallback in-memory
    const payload = { id: editingId, name, category, price, image };
    try {
      const headers = { 'Content-Type': 'application/json' };
      if(secret) headers['x-admin-secret'] = secret;
      const resp = await fetch(`/api/update-product`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      if(resp.ok){
        const data = await resp.json().catch(()=>null);
        const updated = data && data.product ? data.product : payload;
        state.products = state.products.map(p => p.id === editingId ? updated : p);
        collectCategories(); renderCategories(); renderCategoryDatalist();
        const active = document.querySelector(".category-btn.active"); const cat = active ? active.dataset.cat : "Semua";
        filterByCategory(cat);
        $("#addProductForm").reset(); closeAddProduct();
        alert("Produk berhasil diperbarui (server).");
        return;
      } else {
        const err = await resp.json().catch(()=>null); throw new Error(err && err.error ? err.error : `Server ${resp.status}`);
      }
    } catch(e){
      console.warn('Update gagal, fallback in-memory:', e);
      state.products = state.products.map(p => p.id === editingId ? { id: editingId, name, category, price, image } : p);
      collectCategories(); renderCategories(); renderCategoryDatalist();
      const active = document.querySelector(".category-btn.active"); const cat = active ? active.dataset.cat : "Semua";
      filterByCategory(cat);
      $("#addProductForm").reset(); closeAddProduct();
      // offer to sync to Netlify function, else fallback to download
      if(confirm('Server tidak tersedia / menolak update. Produk diperbarui di memori saja. Ingin coba sinkronisasi ke server (Netlify)?')){
        const sec = (document.querySelector('#adminSecret') || { value: '' }).value.trim();
        await syncProductsToServer(sec);
      } else if(confirm('Mau download products.js yang berisi data terbaru untuk ganti manual?')){
        downloadProductsJsFile(state.products);
      }
      return;
    }
  } else {
    // create
    try {
      const headers = { 'Content-Type': 'application/json' };
      if(secret) headers['x-admin-secret'] = secret;
      const resp = await fetch('/api/add-product', { method: 'POST', headers, body: JSON.stringify({ name, category, price, image }) });
      if(resp.ok){
        const data = await resp.json().catch(()=>null);
        const newProd = data && data.product ? data.product : { id: "p" + Date.now(), name, category, price, image };
        state.products.push(newProd);
        collectCategories(); renderCategories(); renderCategoryDatalist();
        const active = document.querySelector(".category-btn.active"); const cat = active ? active.dataset.cat : "Semua";
        filterByCategory(cat);
        $("#addProductForm").reset(); closeAddProduct();
        alert("Produk berhasil ditambahkan dan products.js diperbarui di server.");
        return;
      } else {
        const err = await resp.json().catch(()=>null); throw new Error(err && err.error ? err.error : `Server ${resp.status}`);
      }
    } catch(e){
      console.warn('Gagal panggil API add-product, fallback in-memory:', e);
      const newProd = { id: "p" + Date.now(), name, category, price, image };
      state.products.push(newProd);
      collectCategories(); renderCategories(); renderCategoryDatalist();
      const active = document.querySelector(".category-btn.active"); const cat = active ? active.dataset.cat : "Semua";
      filterByCategory(cat);
      $("#addProductForm").reset(); closeAddProduct();
      if(confirm('Server tidak tersedia. Produk ditambahkan di memori saja. Ingin coba sinkronisasi ke server (Netlify)?')){
        const sec = (document.querySelector('#adminSecret') || { value: '' }).value.trim();
        await syncProductsToServer(sec);
      } else if(confirm('Mau download file products.js yang berisi data terbaru agar bisa mengganti file manual?')){
        downloadProductsJsFile(state.products);
      }
      return;
    }
  }
}

async function deleteProduct(id){
  if(!id) return;
  if(!confirm('Yakin ingin menghapus produk ini?')) return;
  const secret = $("#adminSecret") ? $("#adminSecret").value.trim() : "";
  try {
    const headers = {};
    if(secret) headers['x-admin-secret'] = secret;
    const resp = await fetch(`/api/delete-product/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
    if(resp.ok){
      state.products = state.products.filter(p => p.id !== id);
      collectCategories(); renderCategories(); renderCategoryDatalist();
      const active = document.querySelector(".category-btn.active"); const cat = active ? active.dataset.cat : "Semua";
      filterByCategory(cat);
      alert('Produk dihapus (server).');
      return;
    } else {
      const body = await resp.text().catch(()=>null);
      console.warn('Server delete response:', resp.status, body);
      const err = await resp.json().catch(()=>null);
      throw new Error(err && err.error ? err.error : `Server ${resp.status}`);
    }
  } catch(e){
    console.warn('Delete gagal, fallback in-memory:', e);
    state.products = state.products.filter(p => p.id !== id);
    collectCategories(); renderCategories(); renderCategoryDatalist();
    const active = document.querySelector(".category-btn.active"); const cat = active ? active.dataset.cat : "Semua";
    filterByCategory(cat);
    if(confirm('Server tidak tersedia. Produk dihapus di memori saja. Ingin coba sinkronisasi ke server (Netlify)?')){
      const sec = (document.querySelector('#adminSecret') || { value: '' }).value.trim();
      await syncProductsToServer(sec);
    } else if(confirm('Mau download products.js yang berisi data terbaru agar bisa mengganti file manual?')){
      downloadProductsJsFile(state.products);
    }
    else alert('Produk dihapus sementara di memori.');
    return;
  }
}

/* ---------- Helper: download products.js ---------- */
function downloadProductsJsFile(productsArray){
  const content = 'const PRODUCTS = ' + JSON.stringify(productsArray, null, 2) + ';\n';
  const blob = new Blob([content], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'products.js';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Try to sync products to server via Netlify Function. Requires Netlify env vars: GITHUB_REPO, GITHUB_TOKEN, ADMIN_SECRET.
async function syncProductsToServer(secret){
  try {
    const resp = await fetch('/.netlify/functions/sync-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret || '' },
      body: JSON.stringify({ products: state.products, message: 'Update from kasir UI' })
    });
    if(!resp.ok){
      // try parse JSON error body
      const text = await resp.text().catch(()=>null);
      try {
        const err = text ? JSON.parse(text) : null;
        const msg = err && err.error ? err.error : (err && err.message ? err.message : text || ('HTTP ' + resp.status));
        throw new Error(msg);
      } catch(parseErr){
        throw new Error(text || ('HTTP ' + resp.status));
      }
    }
    const j = await resp.json().catch(()=>null);
    alert('Sinkronisasi berhasil. Tunggu redeploy Netlify sebentar lalu refresh halaman.');
    return j;
  } catch(e){
    console.error('Sync failed', e);
    alert('Sync ke server gagal: ' + (e.message || e));
    return null;
  }
}

/* ---------- End of file ---------- */
