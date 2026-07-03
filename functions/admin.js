// GET /admin?key=YOUR_ADMIN_KEY   — view subscribers (password-gated).
//     /admin?key=...&format=csv   — download CSV.
// Secret: env.ADMIN_KEY  ·  Binding: env.DB (D1).
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  // Distinguish "server has no ADMIN_KEY" from "wrong key" so a dropped secret
  // (e.g. plaintext var shadowed by wrangler.toml) is diagnosable, not a mute 401.
  if (!env.ADMIN_KEY) {
    return new Response(
      'ADMIN_KEY not configured on the server — set it as an encrypted Secret in the Cloudflare dashboard (see SUBSCRIBE-SETUP.md).',
      { status: 503 },
    );
  }
  if (key !== env.ADMIN_KEY) {
    return new Response('Unauthorized — append ?key=YOUR_ADMIN_KEY', { status: 401 });
  }
  if (!env.DB) return new Response('D1 not configured (see wrangler.toml + README).', { status: 503 });

  const { results } = await env.DB
    .prepare('SELECT id, name, email, created_at FROM subscribers ORDER BY created_at DESC')
    .all();

  if (url.searchParams.get('format') === 'csv') {
    const csv = 'id,name,email,created_at\n' + results
      .map((r) => [r.id, `"${(r.name || '').replace(/"/g, '""')}"`, r.email, r.created_at].join(','))
      .join('\n');
    return new Response(csv, {
      headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="subscribers.csv"' },
    });
  }

  const rows = results.length
    ? results.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.created_at)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="empty">아직 구독자가 없습니다.</td></tr>';

  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>구독자 · admin</title>
<style>
  :root{--bg:#E7EAE3;--surface:#F1F3ED;--ink:#282B26;--soft:#5F635B;--line:#D6DACF;--accent:#4E5D51}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,'SUIT',sans-serif;line-height:1.6}
  .wrap{max-width:900px;margin:0 auto;padding:48px 24px}
  .top{display:flex;justify-content:space-between;align-items:baseline;gap:16px;border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:8px}
  h1{margin:0;font-size:22px;font-weight:600;letter-spacing:-.02em}
  .count{font-size:14px;color:var(--soft)}.count b{color:var(--accent)}
  .dl{font-size:13px;color:var(--accent);text-decoration:none;border:1px solid var(--line);padding:8px 14px;border-radius:9px;background:var(--surface)}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:14px}
  th,td{text-align:left;padding:12px 10px;border-bottom:1px solid var(--line)}
  th{font-size:12px;letter-spacing:.08em;color:var(--soft);font-weight:500}
  td:first-child{color:var(--soft);width:40px}
  .empty{color:var(--soft);text-align:center;padding:40px 0}
</style></head><body><div class="wrap">
<div class="top"><h1>북극성과 시행착오 노트 · 구독자</h1>
<span class="count">총 <b>${results.length}</b>명</span></div>
<div style="text-align:right;margin-top:14px"><a class="dl" href="?key=${esc(key)}&format=csv">CSV 내려받기 ↓</a></div>
<table><thead><tr><th>#</th><th>이름</th><th>이메일</th><th>신청일시 (UTC)</th></tr></thead>
<tbody>${rows}</tbody></table>
</div></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
