/* 오늘의 소식: IT 뉴스 헤드라인 (전자신문 RSS를 rss2json 변환 서비스로 가져온다)
   - 하루 단위로 localStorage에 저장해 같은 날에는 다시 요청하지 않는다. (최대 3시간)
   - 불러오지 못하면 안내 문구만 보여준다. */
document.addEventListener('DOMContentLoaded', function () {
  var list = document.getElementById('news-list');
  var dateEl = document.getElementById('news-date');
  if (!list) return;

  var FEED = 'https://rss.etnews.com/Section901.xml';
  var API = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(FEED);
  var KEY = 'blog.news.v1';
  var MAX_ITEMS = 3;
  var MAX_AGE = 3 * 60 * 60 * 1000;

  var now = new Date();
  var days = ['일', '월', '화', '수', '목', '금', '토'];
  if (dateEl) dateEl.textContent = (now.getMonth() + 1) + '월 ' + now.getDate() + '일 ' + days[now.getDay()] + '요일';

  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

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

  function message(text) {
    list.textContent = '';
    var li = document.createElement('li');
    li.className = 'news-msg';
    li.textContent = text;
    list.appendChild(li);
  }

  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY));
      if (c && c.day === dayKey(now) && Date.now() - c.at < MAX_AGE && c.items && c.items.length >= MAX_ITEMS) return c.items.slice(0, MAX_ITEMS);
    } catch (e) {}
    return null;
  }

  function writeCache(items) {
    try { localStorage.setItem(KEY, JSON.stringify({ day: dayKey(now), at: Date.now(), items: items })); } catch (e) {}
  }

  var cached = readCache();
  if (cached) return render(cached);

  fetch(API)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      if (data.status !== 'ok' || !data.items || !data.items.length) throw new Error('empty');
      var items = data.items
        .filter(function (it) { return it.title && /^https?:\/\//.test(it.link || ''); })
        .slice(0, MAX_ITEMS)
        .map(function (it) { return { title: String(it.title).trim(), link: it.link }; });
      if (!items.length) throw new Error('empty');
      writeCache(items);
      render(items);
    })
    .catch(function () {
      message('오늘의 소식을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.');
    });
});
