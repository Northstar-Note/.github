(function(){
  var SUBSCRIBE_ENDPOINT = '/api/subscribe';
  var forms = document.querySelectorAll('[data-subscribe-form]');
  if (!forms.length) return;

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
