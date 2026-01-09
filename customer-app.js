// customer-app.js — minimal storefront for customers
(function(){
  const tpl = document.getElementById('productTpl');
  const grid = document.getElementById('custProducts');
  const cartCount = document.getElementById('custCartCount');
  const cartItemsEl = document.getElementById('custCartItems');
  const totalEl = document.getElementById('custTotal');
  const clearBtn = document.getElementById('custClear');
  const checkoutBtn = document.getElementById('custCheckout');
  const searchEl = document.getElementById('custSearch');
  const categoriesEl = document.getElementById('custCategories');

  let categories = ['Semua'];
  let activeCategory = 'Semua';
  let searchQuery = '';

  function getProducts(){
    if(typeof window.PRODUCTS !== 'undefined' && Array.isArray(window.PRODUCTS)) return window.PRODUCTS;
    if(typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) return PRODUCTS;
    return [];
  }

  let cart = [];
  function formatCurrency(v){ return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v); }

  function renderProducts(){
    const products = getProducts();
    if(!products || products.length === 0) return grid.innerHTML = '<div class="muted">Produk tidak tersedia.</div>';
    const q = String(searchQuery || '').trim().toLowerCase();
    const list = products.filter(p => {
      const matchCat = (activeCategory === 'Semua') || (p.category === activeCategory);
      const matchQ = !q || (String(p.name || '').toLowerCase().includes(q)) || (String(p.category || '').toLowerCase().includes(q));
      return matchCat && matchQ;
    });
    grid.innerHTML = '';
    list.forEach(p => {
      const node = tpl.content.cloneNode(true);
      const img = node.querySelector('.prod-img');
      img.alt = p.name || 'Product image';
      // set src; if it fails to load (no network or blocked), replace with an inline SVG placeholder
      img.onerror = function(){
        this.onerror = null;
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
            <rect width="100%" height="100%" fill="#f4f7ff"/>
            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9aa4b2" font-family="Arial,Helvetica,sans-serif" font-size="18">No Image</text>
          </svg>
        `;
        this.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
      };
      img.src = p.image || '';
      node.querySelector('.prod-name').textContent = p.name || '';
      node.querySelector('.prod-cat').textContent = p.category || '';
      node.querySelector('.prod-price').textContent = formatCurrency(p.price || 0);
      const btn = node.querySelector('.prod-actions .add');
      btn.addEventListener('click', ()=> addToCart(p));
      grid.appendChild(node);
    });
    renderCategoryButtons();
  }

  function collectCategories(){
    const map = {};
  const products = getProducts();
  if(!products || products.length === 0) { categories = ['Semua']; return; }
  products.forEach(p => { const raw = String(p.category || '').trim(); if(!raw) return; const key = raw.toLowerCase(); if(!map[key]) map[key] = raw; });
    categories = ['Semua', ...Object.values(map)];
    if(!categories.includes(activeCategory)) activeCategory = 'Semua';
  }

  function renderCategoryButtons(){
    if(!categoriesEl) return;
    categoriesEl.innerHTML = '';
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn' + (cat === activeCategory ? ' active' : '');
      btn.textContent = cat;
      btn.addEventListener('click', ()=>{ activeCategory = cat; renderProducts(); });
      categoriesEl.appendChild(btn);
    });
  }

  function addToCart(p){
    const existing = cart.find(i=>i.id===p.id);
    if(existing) existing.qty++;
    else cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty: 1 });
    renderCart();
  }

  // normalize WA number: accept formats like +62 812-3456, 08123456 and convert to '628123456' (no +)
  function normalizeWhatsappNumber(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    // remove spaces, parentheses, dashes, plus signs
    const digits = s.replace(/[^0-9+]/g, '');
    if (!digits) return '';
    // if starts with +, remove +
    if (digits.startsWith('+')) return digits.slice(1);
    // if starts with 0 (local Indonesian), replace leading 0 with 62
    if (digits.startsWith('0')) return '62' + digits.slice(1);
    // if already starts with country code like 62 or other, return as-is
    return digits;
  }

  function renderCart(){
    cartCount.textContent = cart.reduce((s,i)=>s+i.qty,0);
    cartItemsEl.innerHTML = '';
    cart.forEach(it => {
      const el = document.createElement('div'); el.className='cust-cart-item';
        el.innerHTML = `<img src="${it.image}" loading="lazy" decoding="async" onerror="this.src='https://via.placeholder.com/80x80?text=No+Image'"/><div style=\"flex:1\"><div style=\"font-weight:700\">${it.name}</div><div class=\"small muted\">${formatCurrency(it.price)} x ${it.qty}</div></div><div><button class=\"btn\" data-id=\"${it.id}\">-</button><button class=\"btn\" data-id=\"${it.id}\">+</button></div>`;
      cartItemsEl.appendChild(el);
    });
    cartItemsEl.querySelectorAll('button').forEach(b=>b.addEventListener('click', (e)=>{
      const id = e.currentTarget.dataset.id; const action = e.currentTarget.textContent.trim(); const it = cart.find(x=>x.id===id); if(!it) return;
      if(action === '+') it.qty++; else if(action === '-') it.qty = Math.max(0, it.qty-1);
      cart = cart.filter(x=>x.qty>0);
      renderCart();
    }));
    const total = cart.reduce((s,i)=>s + i.price*i.qty, 0);
    totalEl.textContent = formatCurrency(total);
    // show/hide payment controls depending on cart contents
    try{
      const payEl = document.querySelector('.cust-payment');
      if(payEl) payEl.classList.toggle('hidden', cart.length === 0);
    }catch(e){}
  }

  clearBtn.addEventListener('click', ()=>{ cart=[]; renderCart(); });
  checkoutBtn.addEventListener('click', ()=>{
    if(cart.length === 0) return alert('Keranjang kosong');
    // Build order message
    const lines = [];
    lines.push('Halo, saya ingin memesan:');
    cart.forEach((it, idx) => {
      lines.push(`${idx+1}. ${it.name} x${it.qty} — ${formatCurrency(it.price)} each`);
    });
    const total = cart.reduce((s,i)=>s + i.price * i.qty, 0);
    lines.push('');
    lines.push(`Total: ${formatCurrency(total)}`);
  lines.push('');
  // include selected payment method
  let payMethod = 'QRIS';
  try{ const sel = document.querySelector('input[name="custPayment"]:checked'); if(sel) payMethod = sel.value === 'cash' ? 'Tunai' : 'QRIS'; }catch(e){}
  lines.push('Metode Pembayaran: ' + payMethod);
  lines.push('');
  lines.push('Nama:');
  lines.push('Alamat / Lokasi:');
  lines.push('Catatan:');

    const text = lines.join('\n');
    const encoded = encodeURIComponent(text);
    // Use WA number if provided (international format without +), otherwise open wa.me with no number (user can choose contact)
    // merchant WA number can be provided as window.WA_NUMBER (any human-friendly format)
    const rawNumber = (window.WA_NUMBER || '6282271097940').toString().trim();
    const normalized = normalizeWhatsappNumber(rawNumber);
    const waUrl = normalized ? `https://wa.me/${normalized}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, '_blank', 'noopener');
  });

  if(searchEl){ searchEl.addEventListener('input', (e)=>{ searchQuery = e.target.value || ''; renderProducts(); }); }

  // initial categories and render
  collectCategories(); renderProducts(); renderCart();
})();