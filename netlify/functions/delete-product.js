// delete-product.js - Netlify Function
exports.handler = async function(event){
  try{
    if(event.httpMethod !== 'DELETE') return { statusCode: 405, body: 'Method Not Allowed' };
    const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
    const GITHUB_REPO = process.env.GITHUB_REPO || '';
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
    const provided = (event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'] || '');
    if(!ADMIN_SECRET || provided !== ADMIN_SECRET) return { statusCode: 403, body: 'Forbidden' };
    if(!GITHUB_TOKEN || !GITHUB_REPO) return { statusCode: 500, body: 'Server not configured' };

    const payload = JSON.parse(event.body || '{}');
    const { id } = payload;
    if(!id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing id' }) };

    const [owner, repo] = GITHUB_REPO.split('/');
    if(!owner || !repo) return { statusCode: 500, body: 'Invalid GITHUB_REPO' };

    async function getFile(){
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/kasir/products.json?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } });
      if(!r.ok) return { ok: false, status: r.status, text: await r.text().catch(()=>null) };
      const j = await r.json();
      const content = Buffer.from(j.content, 'base64').toString('utf8');
      return { ok: true, content, sha: j.sha };
    }

    async function putFile(path, contentStr, message){
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
      const getR = await fetch(url + `?ref=${encodeURIComponent(GITHUB_BRANCH)}`, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } });
      const j = getR.status === 200 ? await getR.json().catch(()=>null) : null;
      const body = { message: message, content: Buffer.from(contentStr, 'utf8').toString('base64'), branch: GITHUB_BRANCH };
      if (j && j.sha) body.sha = j.sha;
      const r = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' }, body: JSON.stringify(body) });
      if(!r.ok){ const t = await r.text().catch(()=>null); throw new Error(`GitHub PUT failed: ${r.status} ${t}`); }
      return await r.json();
    }

    const existing = await getFile();
    const arr = existing.ok ? JSON.parse(existing.content) : [];
    const newArr = arr.filter(p => p.id !== id);
    if(newArr.length === arr.length) return { statusCode: 404, body: JSON.stringify({ error: 'Product not found' }) };

    await putFile('kasir/products.json', JSON.stringify(newArr, null, 2), 'Delete product from UI');
    await putFile('kasir/products.js', 'const PRODUCTS = ' + JSON.stringify(newArr, null, 2) + '\n', 'Update products.js after delete');
    return { statusCode: 200, body: JSON.stringify({ ok: true, id }) };
  }catch(err){ console.error('delete-product error', err); return { statusCode: 500, body: String(err && err.message ? err.message : err) }; }
};
