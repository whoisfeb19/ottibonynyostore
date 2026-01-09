// Aplikasi toko sederhana (diperbarui: support tambah produk via UI)
// Produk tersedia di PRODUCTS (products.js)

const state = {
  products: PRODUCTS,
  filtered: PRODUCTS,
  categories: [],
  cart: []
};

function $(sel){ return document.querySelector(sel) }
function formatCurrency(v){
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits:0 }).format(v);
}

function init(){
  collectCategories();
  renderCategories();
  renderProducts();
  setupEvents();
  updateCartCount();
}

function collectCategories(){
  const cats = new Set(state.products.map(p => p.category));
  state.categories = ["Semua", ...Array.from(cats)];
}

function renderCategories(){
  const container = $("#categories");
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
}

function filterByCategory(cat){
  const q = $("#search").value.trim().toLowerCase();
  state.filtered = state.products.filter(p => {
    const matchCat = (cat === "Semua") || p.category === cat;
    const matchQ = p.name.toLowerCase().includes(q);
    return matchCat && matchQ;
  });
  renderProducts();
}

function renderProducts(){
  const grid = $("#products");
  grid.innerHTML = "";
  state.filtered.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'" />
      <h4>${p.name}</h4>
      <p class="small">${p.category}</p>
      <div class="price">${formatCurrency(p.price)}</div>
      <div class="actions">
        <button class="btn add" data-id="${p.id}">Tambah</button>
        <button class="btn" data-id="${p.id}" onclick="viewDetail('${p.id}')">Detail</button>
      </div>
    `;
    grid.appendChild(card);
  });

  document.querySelectorAll(".btn.add").forEach(b => {
    b.addEventListener("click", () => addToCart(b.dataset.id));
  });
}

function viewDetail(id){
  const p = state.products.find(x => x.id===id);
  alert(`${p.name}\nKategori: ${p.category}\nHarga: ${formatCurrency(p.price)}`);
}

function addToCart(id){
  const p = state.products.find(x => x.id===id);
  const existing = state.cart.find(i => i.id === id);
  if(existing){
    existing.qty += 1;
  } else {
    state.cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty: 1 });
  }
  updateCartCount();
  renderCart();
  openCart();
}

function updateCartCount(){
  const count = state.cart.reduce((s,i)=>s+i.qty,0);
  $("#cartCount").textContent = count;
  $("#checkoutBtn").disabled = count === 0;
}

// Cart UI
function renderCart(){
  const container = $("#cartItems");
  container.innerHTML = "";
  state.cart.forEach(item => {
    const el = document.createElement("div");
    el.className = "cart-item";
    el.innerHTML = `
      <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/100x100?text=No+Image'"/>
      <div style="flex:1">
        <div><strong>${item.name}</strong></div>
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
    btn.addEventListener("click", (e)=>{
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const item = state.cart.find(i=>i.id===id);
      if(!item) return;
      if(act === "inc") item.qty++;
      if(act === "dec") item.qty = Math.max(1, item.qty-1);
      if(act === "rm") state.cart = state.cart.filter(i=>i.id!==id);
      renderCart();
      updateCartCount();
    });
  });

  // summary
  const subtotal = state.cart.reduce((s,i)=>s + i.price * i.qty, 0);
  $("#subtotal").textContent = formatCurrency(subtotal);
  $("#totalItems").textContent = state.cart.reduce((s,i)=>s+i.qty,0);
}

// Panels open/close
function openCart(){ $("#cartPanel").classList.remove("hidden") }
function closeCart(){ $("#cartPanel").classList.add("hidden") }
function openCheckout(){ $("#checkoutPanel").classList.remove("hidden") }
function closeCheckout(){ $("#checkoutPanel").classList.add("hidden") }
function openAddProduct(){ $("#addProductPanel").classList.remove("hidden") }
function closeAddProduct(){ $("#addProductPanel").classList.add("hidden") }

function setupEvents(){
  $("#cartBtn").addEventListener("click", openCart);
  $("#closeCart").addEventListener("click", closeCart);
  $("#checkoutBtn").addEventListener("click", () => {
    populateCheckout();
    closeCart();
    openCheckout();
  });

  $("#closeCheckout").addEventListener("click", closeCheckout);

  $("#search").addEventListener("input", () => {
    const active = document.querySelector(".category-btn.active");
    const cat = active ? active.dataset.cat : "Semua";
    filterByCategory(cat);
  });

  // payment method toggles
  document.querySelectorAll('input[name="payment"]').forEach(r=>{
    r.addEventListener("change", ()=>{
      const v = document.querySelector('input[name="payment"]:checked').value;
      $("#qrisSection").classList.toggle("hidden", v !== "qris");
      $("#cashSection").classList.toggle("hidden", v !== "cash");
    });
  });

  $("#cashInput").addEventListener("input", handleCashInput);
  $("#confirmCash").addEventListener("click", confirmCashPayment);
  $("#confirmQris").addEventListener("click", confirmQrisPayment);
  $("#printReceipt").addEventListener("click", ()=>window.print());

  // Add product events
  $("#openAddProduct").addEventListener("click", openAddProduct);
  $("#closeAddProduct").addEventListener("click", closeAddProduct);
  $("#cancelAdd").addEventListener("click", ()=>{
    $("#addProductForm").reset();
    closeAddProduct();
  });
  $("#addProductForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    handleAddProductSubmit();
  });
}

// Checkout
function populateCheckout(){
  const summaryEl = $("#orderSummary");
  summaryEl.innerHTML = "";
  if(state.cart.length === 0){
    summaryEl.textContent = "Keranjang kosong.";
    return;
  }
  const ul = document.createElement("div");
  ul.innerHTML = state.cart.map(i=>`- ${i.name} x ${i.qty} = ${formatCurrency(i.price*i.qty)}`).join("\n");
  summaryEl.appendChild(ul);

  const subtotal = state.cart.reduce((s,i)=>s + i.price * i.qty, 0);
  const tEl = document.createElement("div");
  tEl.style.marginTop = "10px";
  tEl.innerHTML = `<strong>Total: ${formatCurrency(subtotal)}</strong>`;
  summaryEl.appendChild(tEl);

  // prepare QRIS
  generateQris(subtotal);
  // prepare cash section
  $("#cashTotal").textContent = formatCurrency(subtotal);
  $("#cashInput").value = "";
  $("#cashReceived").textContent = formatCurrency(0);
  $("#cashChange").textContent = formatCurrency(0);
  $("#confirmCash").disabled = true;
  $("#cashMessage").textContent = "";
  $("#receipt").classList.add("hidden");
  $("#receiptText").textContent = "";
}

function generateQris(total){
  // buat payload sederhana (Anda bisa mengganti dengan payload QRIS merchant)
  const orderId = "ORD" + Date.now();
  const payload = `TokoContoh|${orderId}|${total}`;
  // gunakan Google Chart API untuk membuat QR (sederhana)
  const qurl = "https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=" + encodeURIComponent(payload);
  $("#qrisImage").src = qurl;
  $("#qrisInfo").textContent = `Order: ${orderId} • Total: ${formatCurrency(total)}`;
  $("#qrisImage").alt = "QRIS for " + orderId;
  $("#confirmQris").dataset.order = orderId;
  $("#confirmQris").dataset.total = total;
}

function handleCashInput(){
  const val = Number($("#cashInput").value || 0);
  const total = state.cart.reduce((s,i)=>s+i.price*i.qty,0);
  $("#cashReceived").textContent = formatCurrency(val);
  const change = val - total;
  $("#cashChange").textContent = formatCurrency(Math.max(0, change));
  if(val >= total && total > 0){
    $("#cashMessage").textContent = "Nominal cukup. Klik Selesai untuk menerima pembayaran.";
    $("#confirmCash").disabled = false;
  } else {
    if(total === 0) $("#cashMessage").textContent = "Keranjang kosong.";
    else $("#cashMessage").textContent = `Kurang ${formatCurrency(Math.max(0, total - val))}`;
    $("#confirmCash").disabled = true;
  }
}

function confirmCashPayment(){
  const val = Number($("#cashInput").value || 0);
  const total = state.cart.reduce((s,i)=>s+i.price*i.qty,0);
  const change = val - total;
  const order = {
    id: "CASH" + Date.now(),
    method: "Tunai",
    total, received: val, change: Math.max(0, change),
    items: state.cart.map(i=>({ name: i.name, qty: i.qty, price: i.price }))
  };
  showReceipt(order);
  // reset cart
  state.cart = [];
  renderCart();
  updateCartCount();
  $("#confirmCash").disabled = true;
}

function confirmQrisPayment(){
  const orderId = $("#confirmQris").dataset.order;
  const total = Number($("#confirmQris").dataset.total || 0);
  const order = {
    id: orderId,
    method: "QRIS",
    total, received: total,
    change: 0,
    items: state.cart.map(i=>({ name: i.name, qty: i.qty, price: i.price }))
  };
  showReceipt(order);
  // reset cart
  state.cart = [];
  renderCart();
  updateCartCount();
}

function showReceipt(order){
  $("#receipt").classList.remove("hidden");
  const lines = [];
  lines.push("Toko Contoh");
  lines.push("Order ID: " + order.id);
  lines.push("Metode: " + order.method);
  lines.push("---------------------------------");
  order.items.forEach(i => {
    lines.push(`${i.name} x${i.qty}  ${formatCurrency(i.price*i.qty)}`);
  });
  lines.push("---------------------------------");
  lines.push("Total: " + formatCurrency(order.total));
  lines.push("Diterima: " + formatCurrency(order.received));
  lines.push("Kembalian: " + formatCurrency(order.change));
  lines.push("");
  lines.push("Terima kasih atas pembelian Anda!");
  $("#receiptText").textContent = lines.join("\n");
}

/* --- Tambah Produk via UI (tanpa buka script) --- */
function handleAddProductSubmit(){
  const name = $("#addName").value.trim();
  const category = $("#addCategory").value.trim() || "Umum";
  const price = Number($("#addPrice").value || 0);
  const image = $("#addImage").value.trim() || "https://via.placeholder.com/400x300?text=Product";

  if(!name || price <= 0){
    alert("Isikan nama dan harga produk yang valid.");
    return;
  }

  const newProd = {
    id: "p" + Date.now(),
    name,
    category,
    price,
    image
  };

  // tambahkan ke state.products (in-memory)
  state.products.push(newProd);

  // jika kategori baru, rekalkulasi categories
  collectCategories();
  renderCategories();

  // perbarui filtered dan tampilkan
  const active = document.querySelector(".category-btn.active");
  const cat = active ? active.dataset.cat : "Semua";
  filterByCategory(cat);

  // reset form & tutup panel
  $("#addProductForm").reset();
  closeAddProduct();

  // beri notifikasi singkat
  alert("Produk berhasil ditambahkan (disimpan di memori).");
}

// Jika Anda ingin persistence (opsional): uncomment bagian berikut dan panggil saveProductsToLocalStorage() saat menambah.
// function saveProductsToLocalStorage(){ localStorage.setItem('products', JSON.stringify(state.products)); }
// function loadProductsFromLocalStorage(){ const s = localStorage.getItem('products'); if(s){ try{ const arr = JSON.parse(s); if(Array.isArray(arr) && arr.length) { state.products = arr; } }catch(e){} } }

// Inisialisasi
window.onload = init;