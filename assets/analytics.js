// GA4 detailed event tracking — 북극성과 시행착오 노트
// Loaded on every page. All calls are guarded: no gtag → no-op (safe).
(function () {
  function ga() { if (typeof window.gtag === 'function') try { window.gtag.apply(null, arguments); } catch (e) {} }
  var path = location.pathname;

  // ── scroll depth: fire once at each milestone ──────────────────────────
  var marks = [25, 50, 75, 90], hit = {}, ticking = false;
  function checkDepth() {
    ticking = false;
    var el = document.documentElement;
    var max = el.scrollHeight - el.clientHeight;
    if (max <= 0) return;
    var pct = Math.round(((el.scrollTop || document.body.scrollTop) / max) * 100);
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      if (pct >= m && !hit[m]) { hit[m] = 1; ga('event', 'scroll_depth', { percent: m, page_path: path }); }
    }
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; setTimeout(checkDepth, 250); }
  }, { passive: true });

  // ── click delegation: reads, CTAs, nav, contact, outbound ──────────────
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var text = (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);

    // contact (mailto)
    if (href.indexOf('mailto:') === 0) {
      ga('event', 'contact_click', { email: href.slice(7).split('?')[0], page_path: path });
      return;
    }
    // in-page anchor (subscribe intent)
    if (href.charAt(0) === '#') {
      if (href === '#subscribe') ga('event', 'subscribe_intent', { link_text: text, page_path: path });
      return;
    }
    var sameHost = a.host && a.host === location.host;
    // issue read
    if (sameHost && /\/issues\/[^/]+\/?$/.test(a.pathname)) {
      ga('event', 'read_issue', { link_text: text, link_url: a.pathname, page_path: path });
      return;
    }
    // top nav
    if (a.closest && a.closest('.nav')) {
      ga('event', 'nav_click', { link_text: text, link_url: a.pathname || href });
      return;
    }
    // outbound
    if (a.host && !sameHost) {
      ga('event', 'outbound_click', { link_url: href, link_text: text, page_path: path });
      return;
    }
    // generic CTA (읽기 / 더보기 / 밑줄 링크)
    if (a.className && /\b(read|more|link-underline)\b/.test(a.className)) {
      ga('event', 'cta_click', { link_text: text, link_url: a.pathname || href, page_path: path });
    }
  }, true);
})();
