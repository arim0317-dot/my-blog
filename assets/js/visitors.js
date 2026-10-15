/* 오늘 / 전체 방문자 수 (GoatCounter 공개 카운터 API)
   - 응답은 GoatCounter 쪽에서 최대 4시간 캐시되므로 실시간 값과 차이가 날 수 있다. */
document.addEventListener('DOMContentLoaded', function () {
  var box = document.getElementById('visitor-box');
  if (!box) return;

  var code = box.getAttribute('data-goatcounter');
  if (!code) return;

  var base = 'https://' + code + '.goatcounter.com/counter/TOTAL.json';

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  var now = new Date();
  var today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

  function load(url, targetId) {
    var target = document.getElementById(targetId);
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (data) { target.textContent = data.count; })
      .catch(function () { target.textContent = '-'; });
  }

  load(base + '?start=' + today + '&end=' + today, 'visitor-today');
  load(base, 'visitor-total');
});
