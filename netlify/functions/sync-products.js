// sync-products.js - Netlify Function
// Receives POST { products: [...], message: 'commit message' }
// Checks x-admin-secret header, then commits products.json and products.js to the repo configured by env vars

exports.handler = async function(event) {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const ADMIN_SECRET = process.env.ADMIN_SECRET || '19februari2005';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
    const GITHUB_REPO = process.env.GITHUB_REPO || '';
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

    const provided = (event.headers['x-admin-secret'] || event.headers['X-Admin-Secret'] || '');
    if (!ADMIN_SECRET || provided !== ADMIN_SECRET) return { statusCode: 403, body: 'Forbidden' };
    if (!GITHUB_TOKEN || !GITHUB_REPO) return { statusCode: 500, body: 'Server not configured' };

    const payload = JSON.parse(event.body || '{}');
    const products = Array.isArray(payload.products) ? payload.products : [];
    // Safety guard: do not overwrite remote file with empty product list
    if (!products || products.length === 0) {
      console.warn('sync-products: rejected empty products payload');
      return { statusCode: 400, body: JSON.stringify({ error: 'Empty products payload rejected' }) };
    }
    const commitMessage = payload.message || 'Update products from UI';

    const [owner, repo] = GITHUB_REPO.split('/');
    if (!owner || !repo) return { statusCode: 500, body: 'Invalid GITHUB_REPO' };

    // helper: get file sha if exists
    async function getFileSha(path) {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } });
      if (r.status === 200) { const j = await r.json(); return j.sha; }
      return null;
    }

    async function putFile(path, contentStr) {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
      const sha = await getFileSha(path);
      const body = { message: commitMessage, content: Buffer.from(contentStr, 'utf8').toString('base64'), branch: GITHUB_BRANCH };
      if (sha) body.sha = sha;
      const r = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' }, body: JSON.stringify(body) });
      if (!r.ok) { const text = await r.text().catch(()=>null); throw new Error(`GitHub PUT failed: ${r.status} ${text}`); }
      return await r.json();
    }

    const jsonContent = JSON.stringify(products, null, 2);
    const jsContent = 'const PRODUCTS = ' + JSON.stringify(products, null, 2) + '\n';

  // perform the commits
  await putFile('kasir/products.json', jsonContent);
  await putFile('kasir/products.js', jsContent);

    return { statusCode: 200, body: JSON.stringify({ ok: true, message: 'Synced to GitHub' }) };
  } catch (err) {
    console.error('sync-products error', err);
    return { statusCode: 500, body: String(err && err.message ? err.message : err) };
  }
};
