(function(){
  var SUBSCRIBE_ENDPOINT = '/api/subscribe';
  var SUBSCRIBE_MARKUP = [
    '<div class="say">',
    '  <span class="eyebrow">구독</span>',
    '  <h2>창간호부터,<br>가장 먼저 받아보세요</h2>',
    '  <p>격주로 한 편. 직접 해본 이야기를 이메일로 조용히 보내드립니다. 광고도, 재촉도 없이.</p>',
    '</div>',
    '<form data-subscribe-form>',
    '  <div class="field">',
    '    <label for="sub-name">이름</label>',
    '    <input id="sub-name" name="name" type="text" placeholder="어떻게 불러드릴까요" autocomplete="name" required>',
    '  </div>',
    '  <div class="field">',
    '    <label for="sub-email">이메일</label>',
    '    <input id="sub-email" name="email" type="email" placeholder="you@example.com" autocomplete="email" required>',
    '  </div>',
    '  <button type="submit">구독하기</button>',
    '  <p class="note">보내주신 정보는 뉴스레터 발송에만 씁니다. 언제든 해지할 수 있어요.</p>',
    '</form>',
    '<div class="done">',
    '  <p><strong>구독 신청이 접수됐습니다.</strong><br>창간호 소식부터 이메일로 보내드릴게요. 반 발짝 먼저, 함께 걸어요.</p>',
    '</div>'
  ].join('');

  var mounts = document.querySelectorAll('[data-subscribe-component]');
  Array.prototype.forEach.call(mounts, function(sec){
    sec.innerHTML = SUBSCRIBE_MARKUP;
  });

  var forms = document.querySelectorAll('[data-subscribe-form]');
  Array.prototype.forEach.call(forms, function(f){
    var sec = f.closest('.subscribe');
    f.addEventListener('submit', function(e){
      e.preventDefault();
      var btn = f.querySelector('button');
      btn.disabled = true;
      btn.textContent = '보내는 중…';

      var data = {
        name: f.elements.name.value.trim(),
        email: f.elements.email.value.trim()
      };

      fetch(SUBSCRIBE_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
        .then(function(r){
          if(!r.ok) throw new Error('bad status '+r.status);
          if (sec) sec.classList.add('sent');
        })
        .catch(function(){
          // Backend not yet live — fall back to email so no subscriber is lost.
          btn.disabled = false;
          btn.textContent = '구독하기';
          window.location.href = 'mailto:andrew.ytower@gmail.com?subject=' +
            encodeURIComponent('북극성과 시행착오 노트 구독 신청') +
            '&body=' + encodeURIComponent('이름: ' + data.name + '\n이메일: ' + data.email);
        });
    });
  });
})();
