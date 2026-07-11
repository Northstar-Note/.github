// 홈·발행목록 공용: D1 sends에 있는 호(발송됨)만 카드 잠금해제.
// tools/newsletter/patches/<slug>.json 의 find/replace를 재사용(발송 스크립트와 동일 규칙).

async function sentSlugs(env) {
  const s = new Set();
  if (env.DB) {
    try {
      const r = await env.DB.prepare('SELECT slug FROM sends').all();
      (r.results || []).forEach((x) => s.add(x.slug));
    } catch (e) { /* DB 문제 시 잠금 유지 */ }
  }
  return s;
}

// file = 'index.html' | 'issues/index.html'
export async function unlockStatic(env, request, assetPath, file) {
  const res = await env.ASSETS.fetch(new URL(assetPath, request.url));
  let html = await res.text();
  const sent = await sentSlugs(env);
  for (const slug of sent) {
    try {
      const pr = await env.ASSETS.fetch(new URL(`/tools/newsletter/patches/${slug}.json`, request.url));
      if (!pr.ok) continue;
      const patches = await pr.json();
      for (const p of patches) {
        if (p.file === file && html.includes(p.find)) html = html.split(p.find).join(p.replace);
      }
    } catch (e) { /* 이 호 스킵 */ }
  }
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
