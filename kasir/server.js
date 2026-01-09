// server.js
// Sederhana: serve static files + API untuk add / update / delete product
// Menyimpan master di products.json dan men-generate products.js

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Config
const PORT = process.env.PORT || 3000;
const DATA_JSON = path.join(__dirname, 'products.json');
const PRODUCTS_JS = path.join(__dirname, 'products.js');

// Optional secret protection
require('dotenv').config(); // jika ingin pakai .env (opsional)
const SECRET = process.env.SECRET || '';

// helper load/save
function loadProducts() {
  try {
    if (fs.existsSync(DATA_JSON)) {
      const raw = fs.readFileSync(DATA_JSON, 'utf8');
      return JSON.parse(raw);
    }
    // fallback: try to parse products.js if exists
    if (fs.existsSync(PRODUCTS_JS)) {
      const txt = fs.readFileSync(PRODUCTS_JS, 'utf8');
      const m = txt.match(/const\s+PRODUCTS\s*=\s*(\[[\s\S]*\]);?/m);
      if (m && m[1]) return JSON.parse(m[1]);
    }
  } catch (e) {
    console.error('loadProducts error:', e);
  }
  return [];
}

function saveProductsArray(arr) {
  // save JSON
  fs.writeFileSync(DATA_JSON, JSON.stringify(arr, null, 2), 'utf8');
  // regenerate products.js
  const content = 'const PRODUCTS = ' + JSON.stringify(arr, null, 2) + ';\n';
  fs.writeFileSync(PRODUCTS_JS, content, 'utf8');
}

// ensure initial files exist
if (!fs.existsSync(DATA_JSON)) {
  const initial = loadProducts();
  saveProductsArray(initial);
}

// serve static (index.html, app.js, products.js, etc.)
app.use(express.static(path.join(__dirname, '/')));

// middleware secret check helper
function checkSecret(req) {
  if (!SECRET) return true; // no secret required
  const provided = req.headers['x-admin-secret'] || '';
  return provided === SECRET;
}

/* --- API: Add product --- */
app.post('/api/add-product', (req, res) => {
  if (SECRET && !checkSecret(req)) return res.status(403).json({ error: 'Invalid secret' });
  const { name, category, price, image } = req.body;
  if (!name || !category || isNaN(Number(price))) return res.status(400).json({ error: 'Invalid payload' });

  const products = loadProducts();
  const newProd = {
    id: 'p' + Date.now(),
    name: String(name),
    category: String(category),
    price: Number(price),
    image: image && String(image).trim() ? String(image).trim() : 'https://via.placeholder.com/400x300?text=Product'
  };
  products.push(newProd);
  try {
    saveProductsArray(products);
    return res.json({ ok: true, product: newProd });
  } catch (e) {
    console.error('Failed save add-product', e);
    return res.status(500).json({ error: 'Failed to save product' });
  }
});

/* --- API: Update product --- */
app.put('/api/update-product', (req, res) => {
  if (SECRET && !checkSecret(req)) return res.status(403).json({ error: 'Invalid secret' });
  const { id, name, category, price, image } = req.body;
  if (!id || !name || !category || isNaN(Number(price))) return res.status(400).json({ error: 'Invalid payload' });

  const products = loadProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });

  const updated = {
    id,
    name: String(name),
    category: String(category),
    price: Number(price),
    image: image && String(image).trim() ? String(image).trim() : 'https://via.placeholder.com/400x300?text=Product'
  };
  products[idx] = updated;

  try {
    saveProductsArray(products);
    return res.json({ ok: true, product: updated });
  } catch (e) {
    console.error('Failed save update-product', e);
    return res.status(500).json({ error: 'Failed to update product' });
  }
});

/* --- API: Delete product --- */
app.delete('/api/delete-product/:id', (req, res) => {
  if (SECRET && !checkSecret(req)) return res.status(403).json({ error: 'Invalid secret' });
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const products = loadProducts();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });

  products.splice(idx, 1);
  try {
    saveProductsArray(products);
    return res.json({ ok: true, id });
  } catch (e) {
    console.error('Failed save delete-product', e);
    return res.status(500).json({ error: 'Failed to delete product' });
  }
});

/* --- start server --- */
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  if (SECRET) console.log('Admin secret aktif. Kirim header x-admin-secret untuk menulis.');
});