// GET  /admin/send?key=ADMIN_KEY[&slug=...]  — 발송 검토 페이지 (비번 게이트)
// POST /admin/send?key=ADMIN_KEY              — action=test | send
//   test : 발신 계정 자기 자신에게만 1통 (검토용)
//   send : 전체 구독자에게 발송 (confirm=YES 필수 = 승인 클릭)
//
// Secrets (Cloudflare Pages → Settings → env, Encrypt):
//   ADMIN_KEY, NEWSLETTER_SENDER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
// Binding: env.DB (D1)  ·  중복발송 방지: sends 테이블

const SITE = 'https://northstar-note.pages.dev';
const NEWSLETTER_NAME = '북극성과 시행착오 노트';
const BCC_BATCH = 50;

const ISSUES = [
  { no: '001', slug: 'founder-notes-01-ai-dept', kicker: '우리가 시작한 이유',
    title: '담당도 아닌 부서가 쓴 보고서가, 조용히 윗선으로 돌았다',
    deck: '전문분야도 아닌 보고서 한 건, 그 일주일이 시작이었습니다. 뽑는 건 AI, 틀리면 안 되는 건 사람이 끝까지 검증한다 — _y Tower의 뼈대가 된 규율.' },
  { no: '002', slug: 'issue-002-tool-to-agent', kicker: '두 번째 이야기 · 연구소에서',
    title: '검색해주는 도구에서, 손발이 되는 에이전트로',
    deck: '요구사항의 홍수 속에 기술 개발이 뒤로 밀리는 연구소. 셋이서 열 몫을 하는 팀이 AI를 도구가 아니라 손발로 다시 놓아본 이야기.' },
  { no: '003', slug: 'issue-13to1', kicker: '혼자, 그러나 혼자가 아닌',
    title: '13명을 모으려다, AI와 둘이 남았다',
    deck: '사람이 부족해서라 여겨 열세 명까지 모았지만, 흩어지고 남은 건 나 혼자. 그 자리를 사람 대신 AI로 채우기까지의 반년.' },
  { no: '004', slug: 'issue-004-stage-to-page', kicker: '네 번째 이야기 · 글과 강의로',
    title: '강의를 하고 책을 썼지만, 나는 아직 ‘AI를 설명하는 사람’이었습니다',
    deck: '보고서 한 건으로 시작된 이야기가 강단과 책으로 이어졌습니다. 그 끝에서 만난 한 가지 확신에 대한 기록.' },
  { no: '005', slug: 'issue-005-erase-not-judge', kicker: '다섯 번째 이야기 · 두 달을 하루로',
    title: 'AI에게 ‘판단’이 아니라 ‘지우기’를 시켰습니다',
    deck: '두 달짜리 특허 1차 검토를 하루로. AI에게 정답을 묻는 대신 ‘명백히 아닌 것’을 지우게 하고, 위험한 5%는 사람이 쥔 이야기.' },
];

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nz = (s) => String(s).replace(/ — /g, ' - ').replace(/—/g, '-');
const b64 = (str) => { const by = new TextEncoder().encode(str); let bin = ''; for (const b of by) bin += String.fromCharCode(b); return btoa(bin); };
const b64url = (str) => b64(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encWord = (s) => `=?UTF-8?B?${b64(s)}?=`;

function renderEmail(issue) {
  const url = `${SITE}/issues/${issue.slug}/`;
  const kicker = nz(issue.kicker), title = nz(issue.title), deck = nz(issue.deck);
  const html = `<!doctype html><html lang="ko"><body style="margin:0;padding:0;background:#f7f0e1;">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px;font-family:'Pretendard',-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#20221f;word-break:keep-all;">
    <p style="margin:0 0 40px;font-size:13px;letter-spacing:.02em;color:rgba(32,34,31,.64);">${NEWSLETTER_NAME} · № ${issue.no}</p>
    <p style="margin:0 0 12px;font-size:13px;color:#006434;">${kicker}</p>
    <h1 style="margin:0 0 20px;font-size:26px;line-height:1.35;font-weight:400;">${title}</h1>
    <p style="margin:0 0 36px;font-size:16px;line-height:1.7;color:rgba(32,34,31,.8);">${deck}</p>
    <p style="margin:0 0 56px;"><a href="${url}" style="font-size:16px;color:#006434;text-decoration:underline;text-underline-offset:3px;">전문 읽기 →</a></p>
    <p style="margin:0;padding-top:20px;border-top:1px solid rgba(32,34,31,.12);font-size:12px;line-height:1.7;color:rgba(32,34,31,.45);">
      이 메일은 <a href="${SITE}" style="color:rgba(32,34,31,.45);">northstar-note.pages.dev</a>에서 구독을 신청하신 분들께 발행 시점에 보내드립니다.<br>
      그만 받고 싶으시면 이 메일에 ‘해지’라고 회신해 주세요. 다음 호부터 빼드립니다.
    </p>
  </div></body></html>`;
  const subject = `№ ${issue.no} · ${title} · ${NEWSLETTER_NAME}`;
  const plain = `${NEWSLETTER_NAME} · № ${issue.no}\n\n${kicker}\n${title}\n\n${deck}\n\n전문 읽기: ${url}\n\n그만 받고 싶으시면 이 메일에 ‘해지’라고 회신해 주세요.`;
  return { subject, html, plain, url };
}

async function accessToken(env) {
  const body = new URLSearchParams({
    client_id: env.GMAIL_CLIENT_ID, client_secret: env.GMAIL_CLIENT_SECRET,
    refresh_token: env.GMAIL_REFRESH_TOKEN, grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('token refresh 실패: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}

function buildRaw(sender, bcc, subject, plain, html) {
  const B = 'np_' + Math.random().toString(36).slice(2);
  const msg =
    `From: ${encWord(NEWSLETTER_NAME)} <${sender}>\r\n` +
    `To: ${sender}\r\n` +
    (bcc.length ? `Bcc: ${bcc.join(', ')}\r\n` : '') +
    `Subject: ${encWord(subject)}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: multipart/alternative; boundary="${B}"\r\n\r\n` +
    `--${B}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(plain)}\r\n` +
    `--${B}\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(html)}\r\n` +
    `--${B}--`;
  return b64url(msg);
}

async function gmailSend(env, token, bcc, subject, plain, html) {
  const raw = buildRaw(env.NEWSLETTER_SENDER, bcc, subject, plain, html);
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('gmail send 실패: ' + (j.error?.message || r.status));
  return j.id;
}

function guard(env, key) {
  if (!env.ADMIN_KEY) return new Response('ADMIN_KEY 미설정 (CF Secret 등록 필요).', { status: 503 });
  if (String(key).trim() !== String(env.ADMIN_KEY).trim()) return new Response('Unauthorized — ?key=ADMIN_KEY', { status: 401 });
  return null;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  const bad = guard(env, key); if (bad) return bad;

  let count = 0, sentSlugs = new Set();
  if (env.DB) {
    try {
      const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM subscribers').first();
      count = c?.n || 0;
      await env.DB.prepare('CREATE TABLE IF NOT EXISTS sends (slug TEXT PRIMARY KEY, subject TEXT, recipients INTEGER, sent_at TEXT NOT NULL DEFAULT (datetime(\'now\')))').run();
      const { results } = await env.DB.prepare('SELECT slug FROM sends').all();
      sentSlugs = new Set((results || []).map((r) => r.slug));
    } catch (e) { /* 표시는 계속 */ }
  }

  const slug = url.searchParams.get('slug') || (ISSUES.find((i) => !sentSlugs.has(i.slug)) || ISSUES[0]).slug;
  const issue = ISSUES.find((i) => i.slug === slug) || ISSUES[0];
  const { subject, html } = renderEmail(issue);
  const already = sentSlugs.has(issue.slug);
  const senderSet = !!env.NEWSLETTER_SENDER && !!env.GMAIL_REFRESH_TOKEN;

  const opts = ISSUES.map((i) => `<option value="${i.slug}"${i.slug === slug ? ' selected' : ''}>№ ${i.no} · ${esc(i.title)}${sentSlugs.has(i.slug) ? ' (발송됨)' : ''}</option>`).join('');

  const page = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>발송 · admin</title>
<style>
  :root{--bg:#E7EAE3;--surface:#F1F3ED;--ink:#282B26;--soft:#5F635B;--line:#D6DACF;--accent:#4E5D51;--warn:#8a3b2e}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,'SUIT',sans-serif;line-height:1.6}
  .wrap{max-width:900px;margin:0 auto;padding:40px 24px 80px}
  h1{margin:0 0 4px;font-size:22px;font-weight:600;letter-spacing:-.02em}
  .sub{color:var(--soft);font-size:14px;margin-bottom:26px}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px 22px;margin-bottom:20px}
  label{font-size:12px;letter-spacing:.06em;color:var(--soft);display:block;margin-bottom:8px}
  select{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:9px;background:#fff;font-size:14px;color:var(--ink)}
  .meta{display:flex;gap:22px;flex-wrap:wrap;font-size:14px;margin:14px 0 0}
  .meta b{color:var(--accent)}
  .prev{margin-top:10px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#f7f0e1}
  iframe{width:100%;height:520px;border:0;display:block}
  .row{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px}
  button{font:inherit;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;border:1px solid var(--line);cursor:pointer}
  .btest{background:var(--surface);color:var(--ink)}
  .bsend{background:var(--accent);color:#fff;border-color:var(--accent)}
  .bsend:disabled{opacity:.4;cursor:not-allowed}
  .confirm{margin-top:14px;padding:16px;border:1px solid var(--warn);border-radius:11px;background:#f7ece9;display:none}
  .confirm.show{display:block}
  .confirm p{margin:0 0 12px;color:var(--warn);font-size:14px}
  .bapprove{background:var(--warn);color:#fff;border-color:var(--warn)}
  .msg{margin-top:16px;font-size:14px;white-space:pre-wrap}
  .ok{color:var(--accent)}.err{color:var(--warn)}
  .flag{font-size:12px;color:var(--warn)}
</style></head><body><div class="wrap">
<h1>${NEWSLETTER_NAME} · 발송</h1>
<div class="sub">검토 후 발송. 전체 발송은 승인을 눌러야만 나갑니다.</div>

<div class="card">
  <label>발송할 호</label>
  <select id="slug" onchange="location.search='?key=${esc(key)}&slug='+this.value">${opts}</select>
  <div class="meta">
    <span>구독자 <b>${count}</b>명</span>
    <span>제목: ${esc(subject)}</span>
    ${already ? '<span class="flag">⚠ 이미 발송됨 — 재발송 차단</span>' : ''}
    ${senderSet ? '' : '<span class="flag">⚠ 발신 시크릿 미설정 (CF Secrets 등록 필요)</span>'}
  </div>
</div>

<div class="card">
  <label>이메일 미리보기</label>
  <div class="prev"><iframe srcdoc="${esc(html)}"></iframe></div>
</div>

<div class="card">
  <div class="row">
    <button class="btest" onclick="doTest()">내게 테스트 발송</button>
    <button class="bsend" ${already ? 'disabled' : ''} onclick="document.getElementById('cf').classList.add('show')">전체 발송…</button>
  </div>
  <div class="confirm" id="cf">
    <p>구독자 <b>${count}</b>명 전원에게 № ${issue.no} 를 발송합니다. 되돌릴 수 없습니다.</p>
    <button class="bapprove" onclick="doSend()">승인하고 전체 발송</button>
  </div>
  <div class="msg" id="msg"></div>
</div>

<script>
  var KEY=${JSON.stringify(key)}, SLUG=${JSON.stringify(slug)};
  function post(action,cb){
    var b=new URLSearchParams({action:action,slug:SLUG,confirm:action==='send'?'YES':''});
    document.getElementById('msg').textContent='발송 중…';
    fetch('?key='+encodeURIComponent(KEY),{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:b})
      .then(function(r){return r.json();})
      .then(function(j){var m=document.getElementById('msg');m.className='msg '+(j.ok?'ok':'err');m.textContent=j.message;if(j.ok&&action==='send'){document.querySelector('.bsend').disabled=true;document.getElementById('cf').classList.remove('show');}})
      .catch(function(e){var m=document.getElementById('msg');m.className='msg err';m.textContent='오류: '+e;});
  }
  function doTest(){post('test');}
  function doSend(){post('send');}
</script>
</div></body></html>`;
  return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  const bad = guard(env, key); if (bad) return new Response(JSON.stringify({ ok: false, message: '인증 실패' }), { status: bad.status, headers: { 'content-type': 'application/json' } });

  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  if (!env.NEWSLETTER_SENDER || !env.GMAIL_REFRESH_TOKEN || !env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET)
    return json({ ok: false, message: '발신 시크릿 미설정 — CF에 GMAIL_* / NEWSLETTER_SENDER 등록 필요' });

  const form = await request.formData();
  const action = form.get('action');
  const slug = form.get('slug');
  const issue = ISSUES.find((i) => i.slug === slug);
  if (!issue) return json({ ok: false, message: '알 수 없는 호' });
  const { subject, html, plain } = renderEmail(issue);

  try {
    const token = await accessToken(env);

    if (action === 'test') {
      const id = await gmailSend(env, token, [], `[테스트] ${subject}`, plain, html);
      return json({ ok: true, message: `테스트 발송 완료 → ${env.NEWSLETTER_SENDER} (id ${id})` });
    }

    if (action === 'send') {
      if (form.get('confirm') !== 'YES') return json({ ok: false, message: '승인 미확인' });
      if (!env.DB) return json({ ok: false, message: 'D1 미연결' });
      await env.DB.prepare('CREATE TABLE IF NOT EXISTS sends (slug TEXT PRIMARY KEY, subject TEXT, recipients INTEGER, sent_at TEXT NOT NULL DEFAULT (datetime(\'now\')))').run();
      const dup = await env.DB.prepare('SELECT slug FROM sends WHERE slug=?').bind(slug).first();
      if (dup) return json({ ok: false, message: '이미 발송된 호 — 재발송 차단' });

      const { results } = await env.DB.prepare('SELECT email FROM subscribers').all();
      const emails = [...new Set((results || []).map((r) => (r.email || '').trim().toLowerCase()).filter((e) => e && e.includes('@')))];
      if (!emails.length) return json({ ok: false, message: '구독자 0명' });

      let sent = 0;
      for (let i = 0; i < emails.length; i += BCC_BATCH) {
        await gmailSend(env, token, emails.slice(i, i + BCC_BATCH), subject, plain, html);
        sent += Math.min(BCC_BATCH, emails.length - i);
      }
      await env.DB.prepare('INSERT INTO sends (slug, subject, recipients) VALUES (?,?,?)').bind(slug, subject, sent).run();
      return json({ ok: true, message: `✅ 전체 발송 완료 — № ${issue.no}, ${sent}명` });
    }

    return json({ ok: false, message: '알 수 없는 action' });
  } catch (e) {
    return json({ ok: false, message: '실패: ' + (e.message || e) });
  }
}
