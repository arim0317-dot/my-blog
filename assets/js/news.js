/* 오늘의 소식: IT 뉴스 헤드라인
   - 브라우저는 전자신문 RSS를 직접 읽을 수 없어(CORS), GitHub Actions(.github/workflows/update-news.yml)가
     3시간마다 assets/data/news.json 으로 저장해 두고, 여기서는 그 파일만 읽는다.
   - 불러오지 못하면 안내 문구만 보여준다. */
(function () {
  var SRC = document.currentScript && document.currentScript.src;
  document.addEventListener('DOMContentLoaded', function () {
    var list = document.getElementById('news-list');
    var dateEl = document.getElementById('news-date');
    if (!list) return;

    var URL_JSON = SRC ? SRC.replace(/js\/news\.js.*$/, 'data/news.json') : '/assets/data/news.json';
    var MAX_ITEMS = 3;

    var now = new Date();
    var days = ['일', '월', '화', '수', '목', '금', '토'];
    if (dateEl) dateEl.textContent = (now.getMonth() + 1) + '월 ' + now.getDate() + '일 ' + days[now.getDay()] + '요일';

    function message(text) {
      list.textContent = '';
      var li = document.createElement('li');
      li.className = 'news-msg';
      li.textContent = text;
      list.appendChild(li);
    }

    function render(items) {
      list.textContent = '';
      items.forEach(function (it) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = it.link;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = it.title;
        li.appendChild(a);
        list.appendChild(li);
      });
    }

    fetch(URL_JSON, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var items = (data.items || [])
          .filter(function (it) { return it.title && /^https?:\/\//.test(it.link || ''); })
          .slice(0, MAX_ITEMS);
        if (!items.length) throw new Error('empty');
        render(items);
      })
      .catch(function () {
        message('오늘의 소식을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.');
      });
  });
})();
