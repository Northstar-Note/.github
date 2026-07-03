// POST /api/subscribe  — store a newsletter subscriber in Cloudflare D1.
// Binding: env.DB (D1)  ·  see wrangler.toml + README for setup.
const JSON_H = { 'content-type': 'application/json; charset=utf-8' };
const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSON_H });

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return reply({ ok: false, error: 'bad json' }, 400); }
  const name = (body.name || '').toString().trim().slice(0, 120);
  const email = (body.email || '').toString().trim().toLowerCase().slice(0, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply({ ok: false, error: 'invalid email' }, 400);
  if (!env.DB) return reply({ ok: false, error: 'storage not configured' }, 503);
  try {
    await env.DB.prepare(
      'INSERT INTO subscribers (name, email) VALUES (?1, ?2) ' +
      'ON CONFLICT(email) DO UPDATE SET name = excluded.name'
    ).bind(name, email).run();
    return reply({ ok: true });
  } catch (e) {
    return reply({ ok: false, error: String(e) }, 500);
  }
}
// Non-POST methods get an automatic 405 from Pages Functions.
