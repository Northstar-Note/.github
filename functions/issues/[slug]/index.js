// /issues/<slug>/  — 발송 여부에 따라 동적 서빙.
//   sends 테이블에 slug 있음(=10:00 발송됨) → 기사(full.html)
//   없음 → 잠금 페이지(gate.html)
// 홈·발행목록은 정적 그대로("곧 공개") = 웹에서 클릭 진입 차단. 이메일 링크로만 열람.
// 알 수 없는 slug(en 등)는 next()로 정적 처리.

const KNOWN = new Set([
  'founder-notes-01-ai-dept',
  'issue-002-tool-to-agent',
  'issue-13to1',
  'issue-004-stage-to-page',
  'issue-005-erase-not-judge',
]);

export async function onRequestGet(ctx) {
  const { params, env, request, next } = ctx;
  const slug = params.slug;
  if (!KNOWN.has(slug)) return next();

  let sent = false;
  if (env.DB) {
    try {
      const r = await env.DB.prepare('SELECT slug FROM sends WHERE slug=?').bind(slug).first();
      sent = !!r;
    } catch (e) { /* DB 문제 시 잠금 유지 */ }
  }

  const file = sent ? 'full.html' : 'gate.html';
  const res = await env.ASSETS.fetch(new URL(`/issues/${slug}/${file}`, request.url));
  if (!res.ok) return next();

  let html = await res.text();
  if (sent) html = html.split(`issues/${slug}/full.html`).join(`issues/${slug}/`);
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
