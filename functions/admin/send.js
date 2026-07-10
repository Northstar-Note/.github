// GET  /admin/send?key=ADMIN_KEY[&slug=...]  — 발송 검토 페이지 (비번 게이트)
// POST /admin/send?key=ADMIN_KEY  — action=test | schedule | cancel | run-due
//   test     : 지정 주소로 1통 (검토용, to= 입력)
//   schedule : 다음 10:00(KST) 발송 예약 (승인 클릭 = 예약)
//   cancel   : 예약 취소
//   run-due  : 예약시각 지난 건 전체 구독자에게 발송 (GitHub Actions 타이머가 호출)
//
// Secrets (Cloudflare Pages env, Encrypt):
//   ADMIN_KEY, NEWSLETTER_SENDER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
// Binding: env.DB (D1) · sends(중복차단) · schedule(예약)

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

// 다음 토요일 10:00 KST(=01:00 UTC)의 UTC Date. 주 1회 발송.
function nextSendKST(nowMs) {
  const kst = new Date(nowMs + 9 * 3600 * 1000); // KST 벽시계를 UTC 필드로
  const daysUntilSat = (6 - kst.getUTCDay() + 7) % 7; // 0=일..6=토 (KST 기준)
  let t = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + daysUntilSat, 1, 0, 0);
  if (t <= nowMs) t += 7 * 24 * 3600 * 1000; // 이미 지난 토요일이면 다음 주
  return new Date(t);
}
function fmtKST(iso) {
  let s = String(iso);
  if (s.indexOf('T') === -1) s = s.replace(' ', 'T') + 'Z'; // SQLite datetime → ISO UTC
  const d = new Date(new Date(s).getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} KST`;
}

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

function buildRaw(sender, to, bcc, subject, plain, html) {
  const B = 'np_' + Math.random().toString(36).slice(2);
  const msg =
    `From: ${encWord(NEWSLETTER_NAME)} <${sender}>\r\n` +
    `To: ${to}\r\n` +
    (bcc.length ? `Bcc: ${bcc.join(', ')}\r\n` : '') +
    `Subject: ${encWord(subject)}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: multipart/alternative; boundary="${B}"\r\n\r\n` +
    `--${B}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(plain)}\r\n` +
    `--${B}\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(html)}\r\n` +
    `--${B}--`;
  return b64url(msg);
}

async function gmailSend(env, token, to, bcc, subject, plain, html) {
  const raw = buildRaw(env.NEWSLETTER_SENDER, to, bcc, subject, plain, html);
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('gmail send 실패: ' + (j.error?.message || r.status));
  return j.id;
}

async function ensureTables(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS sends (slug TEXT PRIMARY KEY, subject TEXT, recipients INTEGER, sent_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS schedule (slug TEXT PRIMARY KEY, status TEXT NOT NULL, scheduled_for TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
}

async function sendToAll(env, token, issue) {
  const { subject, html, plain } = renderEmail(issue);
  const { results } = await env.DB.prepare('SELECT email FROM subscribers').all();
  const emails = [...new Set((results || []).map((r) => (r.email || '').trim().toLowerCase()).filter((e) => e && e.includes('@')))];
  if (!emails.length) throw new Error('구독자 0명');
  let sent = 0;
  for (let i = 0; i < emails.length; i += BCC_BATCH) {
    await gmailSend(env, token, env.NEWSLETTER_SENDER, emails.slice(i, i + BCC_BATCH), subject, plain, html);
    sent += Math.min(BCC_BATCH, emails.length - i);
  }
  await env.DB.prepare('INSERT OR IGNORE INTO sends (slug, subject, recipients) VALUES (?,?,?)').bind(issue.slug, subject, sent).run();
  return sent;
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

  let count = 0, sentSlugs = new Set(), sched = {};
  if (env.DB) {
    try {
      await ensureTables(env);
      const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM subscribers').first();
      count = c?.n || 0;
      const s1 = await env.DB.prepare('SELECT slug FROM sends').all();
      sentSlugs = new Set((s1.results || []).map((r) => r.slug));
      const s2 = await env.DB.prepare("SELECT slug, status, scheduled_for, created_at FROM schedule WHERE status='scheduled'").all();
      (s2.results || []).forEach((r) => { sched[r.slug] = { for: r.scheduled_for, at: r.created_at }; });
    } catch (e) { /* 표시는 계속 */ }
  }

  const slug = url.searchParams.get('slug') || (ISSUES.find((i) => !sentSlugs.has(i.slug) && !sched[i.slug]) || ISSUES[0]).slug;
  const issue = ISSUES.find((i) => i.slug === slug) || ISSUES[0];
  const { subject, html } = renderEmail(issue);
  // 프리뷰용: '전문 읽기' 링크에 ?key= 붙여 어드민이 실제 기사 확인(새 탭). 발송 메일은 키 없음.
  const previewHtml = html.replace(
    `href="${SITE}/issues/${issue.slug}/"`,
    `href="${SITE}/issues/${issue.slug}/?key=${encodeURIComponent(key)}" target="_blank"`,
  );
  const already = sentSlugs.has(issue.slug);
  const scheduledFor = sched[issue.slug];
  const senderSet = !!env.NEWSLETTER_SENDER && !!env.GMAIL_REFRESH_TOKEN;

  const opts = ISSUES.map((i) => {
    const tag = sentSlugs.has(i.slug) ? ' (발송됨)' : sched[i.slug] ? ' (승인됨)' : '';
    return `<option value="${i.slug}"${i.slug === slug ? ' selected' : ''}>№ ${i.no} · ${esc(i.title)}${tag}</option>`;
  }).join('');

  let actionBlock;
  if (already) {
    actionBlock = `<div class="state ok">✅ 이미 발송 완료된 호입니다.</div>`;
  } else if (scheduledFor) {
    actionBlock = `<div class="state ok">✅ 승인 완료 · ${fmtKST(scheduledFor.at)} 승인됨<br>→ <b>${fmtKST(scheduledFor.for)}</b> 발송 예정</div>
      <div class="row"><button class="bcancel" onclick="doCancel()">승인 취소</button></div>`;
  } else {
    actionBlock = `<div class="row">
        <button class="bsend" ${senderSet ? '' : 'disabled'} onclick="doApprove()">전체 발송 승인</button>
      </div>`;
  }

  const page = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>발송 · admin</title>
<style>
  :root{--bg:#E7EAE3;--surface:#F1F3ED;--ink:#282B26;--soft:#5F635B;--line:#D6DACF;--accent:#4E5D51;--warn:#8a3b2e}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,'SUIT',sans-serif;line-height:1.6}
  .wrap{max-width:760px;margin:0 auto;padding:40px 24px 90px}
  h1{margin:0 0 4px;font-size:22px;font-weight:600;letter-spacing:-.02em}
  .sub{color:var(--soft);font-size:14px;margin-bottom:26px}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px 22px;margin-bottom:18px}
  .ct{font-size:12px;letter-spacing:.06em;color:var(--soft);margin-bottom:12px;font-weight:600}
  label{font-size:12px;color:var(--soft);display:block;margin-bottom:7px}
  select,input[type=email]{width:100%;padding:11px 12px;border:1px solid var(--line);border-radius:9px;background:#fff;font-size:14px;color:var(--ink)}
  .meta{display:flex;gap:20px;flex-wrap:wrap;font-size:14px;margin:14px 0 0}.meta b{color:var(--accent)}
  .flag{font-size:12px;color:var(--warn)}
  /* inbox mock */
  .inbox{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}
  .ihead{padding:13px 16px;border-bottom:1px solid var(--line);background:#fbfcf9}
  .ifrom{font-size:13px;font-weight:600}.ifrom span{color:var(--soft);font-weight:400}
  .isubj{font-size:14px;margin-top:3px}
  .iprev{background:#f7f0e1}iframe{width:100%;height:500px;border:0;display:block}
  .row{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;align-items:center}
  button{font:inherit;font-size:14px;font-weight:600;padding:11px 18px;border-radius:10px;border:1px solid var(--line);cursor:pointer;white-space:nowrap;line-height:1.2}
  .toitem{display:flex;gap:8px;margin-bottom:8px}.toitem input{flex:1}
  .brem{background:#fff;color:var(--soft);padding:0 15px}
  .badd{background:#fff;color:var(--accent);border-color:var(--line)}
  .btest{background:var(--surface);color:var(--ink)}
  .bsend{background:var(--accent);color:#fff;border-color:var(--accent)}
  .bsend:disabled{opacity:.4;cursor:not-allowed}
  .bcancel{background:#fff;color:var(--warn);border-color:var(--warn)}
  .confirm{margin-top:14px;padding:16px;border:1px solid var(--warn);border-radius:11px;background:#f7ece9;display:none}
  .confirm.show{display:block}.confirm p{margin:0 0 12px;color:var(--warn);font-size:14px}
  .bapprove{background:var(--warn);color:#fff;border-color:var(--warn)}
  .state{padding:13px 15px;border-radius:10px;font-size:14px;margin-bottom:8px}
  .state.ok{background:#e9efe7;color:var(--accent)}.state.warn{background:#f7ece9;color:var(--warn)}
  .msg{margin-top:14px;font-size:14px;white-space:pre-wrap}.msg.ok{color:var(--accent)}.msg.err{color:var(--warn)}
  .test-row{display:flex;gap:10px;margin-top:4px}.test-row input{flex:1}
</style></head><body><div class="wrap">
<h1>${NEWSLETTER_NAME} · 발송</h1>
<div class="sub">검토 → 테스트 → 승인. 승인하면 다음 토요일 10:00(KST)에 발송, 그 전까진 취소 가능.</div>

<div class="card">
  <div class="ct">발송할 호</div>
  <select id="slug" onchange="location.search='?key=${esc(key)}&slug='+this.value">${opts}</select>
  <div class="meta">
    <span>구독자 <b>${count}</b>명</span>
    ${senderSet ? '' : '<span class="flag">⚠ 발신 시크릿 미설정 — CF 재배포 필요</span>'}
  </div>
</div>

<div class="card">
  <div class="ct">이메일에서 이렇게 보입니다</div>
  <div class="inbox">
    <div class="ihead">
      <div class="ifrom">${NEWSLETTER_NAME} <span>&lt;${esc(env.NEWSLETTER_SENDER || 'sender')}&gt;</span></div>
      <div class="isubj">${esc(subject)}</div>
    </div>
    <div class="iprev"><iframe srcdoc="${esc(previewHtml)}"></iframe></div>
  </div>
</div>

<div class="card">
  <div class="ct">테스트 발송</div>
  <label>받을 주소</label>
  <div id="tolist">
    <div class="toitem"><input type="email" class="toin" placeholder="you@example.com"><button class="brem" type="button" onclick="remTo(this)">×</button></div>
  </div>
  <div class="row" style="margin-top:10px">
    <button class="badd" type="button" onclick="addTo()">+ 주소 추가</button>
    <button class="btest" type="button" onclick="doTest()">테스트 발송</button>
  </div>
  <div class="msg" id="tmsg"></div>
</div>

<div class="card">
  <div class="ct">전체 발송</div>
  ${actionBlock}
  <div class="msg" id="msg"></div>
</div>

<script>
  var KEY=${JSON.stringify(key)}, SLUG=${JSON.stringify(slug)}, COUNT=${count}, NO=${JSON.stringify(issue.no)};
  function post(action,msgId,toVal){
    var b=new URLSearchParams({action:action,slug:SLUG,to:toVal||''});
    var m=document.getElementById(msgId);m.className='msg';m.textContent='처리 중…';
    fetch('?key='+encodeURIComponent(KEY),{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:b})
      .then(function(r){return r.json();})
      .then(function(j){m.className='msg '+(j.ok?'ok':'err');m.textContent=j.message;if(j.ok&&(action==='schedule'||action==='cancel'))setTimeout(function(){location.reload();},1400);})
      .catch(function(e){m.className='msg err';m.textContent='오류: '+e;});
  }
  function addTo(){var d=document.createElement('div');d.className='toitem';d.innerHTML='<input type="email" class="toin" placeholder="you@example.com"><button class="brem" type="button" onclick="remTo(this)">×</button>';document.getElementById('tolist').appendChild(d);}
  function remTo(b){var l=document.getElementById('tolist');if(l.children.length>1)b.parentNode.remove();}
  function doTest(){
    var to=[].slice.call(document.querySelectorAll('.toin')).map(function(i){return i.value.trim();}).filter(Boolean).join(',');
    var m=document.getElementById('tmsg');
    if(!to){m.className='msg err';m.textContent='받을 주소를 입력하세요';return;}
    post('test','tmsg',to);
  }
  function doApprove(){
    if(confirm('구독자 '+COUNT+'명에게 № '+NO+' 를 다음 토요일 10:00(KST)에 발송합니다.\\n승인하시겠어요?  (발송 전까진 취소 가능)')) post('schedule','msg');
  }
  function doCancel(){
    if(confirm('발송 승인을 취소할까요?')) post('cancel','msg');
  }
</script>
</div></body></html>`;
  return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || '';
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  const bad = guard(env, key); if (bad) return json({ ok: false, message: '인증 실패' }, bad.status);
  if (!env.DB) return json({ ok: false, message: 'D1 미연결' });
  if (!env.NEWSLETTER_SENDER || !env.GMAIL_REFRESH_TOKEN || !env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET)
    return json({ ok: false, message: '발신 시크릿 미설정 — CF에 GMAIL_* / NEWSLETTER_SENDER 등록 후 재배포' });

  const form = await request.formData();
  const action = form.get('action');
  await ensureTables(env);

  try {
    // ── 타이머(GitHub Actions)가 부르는 예약 실행 ──
    if (action === 'run-due') {
      const nowIso = new Date().toISOString();
      const { results } = await env.DB.prepare("SELECT slug FROM schedule WHERE status='scheduled' AND scheduled_for<=?").bind(nowIso).all();
      const due = results || [];
      if (!due.length) return json({ ok: true, message: '예약 없음' });
      const token = await accessToken(env);
      const done = [];
      for (const row of due) {
        const issue = ISSUES.find((i) => i.slug === row.slug);
        if (!issue) continue;
        const dup = await env.DB.prepare('SELECT slug FROM sends WHERE slug=?').bind(row.slug).first();
        if (dup) { await env.DB.prepare("UPDATE schedule SET status='sent' WHERE slug=?").bind(row.slug).run(); continue; }
        const sent = await sendToAll(env, token, issue);
        await env.DB.prepare("UPDATE schedule SET status='sent' WHERE slug=?").bind(row.slug).run();
        done.push(`№ ${issue.no}(${sent}명)`);
      }
      return json({ ok: true, message: '발송: ' + (done.join(', ') || '없음') });
    }

    const slug = form.get('slug');
    const issue = ISSUES.find((i) => i.slug === slug);
    if (!issue) return json({ ok: false, message: '알 수 없는 호' });

    if (action === 'test') {
      const to = String(form.get('to') || env.NEWSLETTER_SENDER).split(',').map((s) => s.trim()).filter((s) => s.includes('@'));
      if (!to.length) return json({ ok: false, message: '받을 주소가 없음' });
      const { subject, html, plain } = renderEmail(issue);
      const token = await accessToken(env);
      const id = await gmailSend(env, token, to.join(', '), [], `[테스트] ${subject}`, plain, html);
      return json({ ok: true, message: `테스트 발송 완료 → ${to.join(', ')} (id ${id})` });
    }

    if (action === 'schedule') {
      const dup = await env.DB.prepare('SELECT slug FROM sends WHERE slug=?').bind(slug).first();
      if (dup) return json({ ok: false, message: '이미 발송된 호' });
      const when = nextSendKST(Date.now()).toISOString();
      await env.DB.prepare("INSERT INTO schedule (slug,status,scheduled_for) VALUES (?,?,?) ON CONFLICT(slug) DO UPDATE SET status='scheduled', scheduled_for=excluded.scheduled_for").bind(slug, 'scheduled', when).run();
      return json({ ok: true, message: `✅ 승인됨 — ${fmtKST(when)} 발송 예정` });
    }

    if (action === 'cancel') {
      await env.DB.prepare("UPDATE schedule SET status='cancelled' WHERE slug=? AND status='scheduled'").bind(slug).run();
      return json({ ok: true, message: '승인이 취소되었습니다' });
    }

    return json({ ok: false, message: '알 수 없는 action' });
  } catch (e) {
    return json({ ok: false, message: '실패: ' + (e.message || e) });
  }
}
