/* 홈: 사이드바·상단 탭 필터 (카테고리 / 과정). 다른 페이지에서는 탭이 ?category= 링크로 홈으로 이동한다. */
document.addEventListener('DOMContentLoaded', function () {
  var cards = document.querySelectorAll('.post-grid > .post-card');
  var sideLinks = document.querySelectorAll('.filter-link');
  if (!cards.length && !sideLinks.length) return;   // 홈이 아님

  var tabLinks = document.querySelectorAll('.tab-link[data-filter-type]');
  var countEl = document.getElementById('all-count');
  var emptyEl = document.getElementById('no-result');

  function matches(card, type, value) {
    if (type === 'all') return true;
    var attr = type === 'category' ? 'categories' : 'module';
    var raw = card.getAttribute('data-' + attr) || '';
    return raw.split('|').filter(Boolean).indexOf(value) !== -1;
  }

  function apply(type, value) {
    var shown = 0;
    cards.forEach(function (card) {
      var ok = matches(card, type, value);
      card.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    if (countEl) countEl.textContent = shown + '편';
    if (emptyEl) emptyEl.hidden = shown !== 0;

    function mark(list) {
      list.forEach(function (l) {
        var t = l.getAttribute('data-filter-type');
        var v = l.getAttribute('data-filter-value');
        l.classList.toggle('active', t === type && (type === 'all' || v === value));
      });
    }
    mark(sideLinks);
    mark(tabLinks);
  }

  function onClick(e) {
    e.preventDefault();
    var link = e.currentTarget;
    apply(link.getAttribute('data-filter-type'), link.getAttribute('data-filter-value'));
    var target = document.getElementById('all-posts');
    if (target && link.classList.contains('tab-link')) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  sideLinks.forEach(function (l) { l.addEventListener('click', onClick); });
  tabLinks.forEach(function (l) { l.addEventListener('click', onClick); });

  var params = new URLSearchParams(window.location.search);
  if (params.get('category')) apply('category', params.get('category'));
  else if (params.get('module')) apply('module', params.get('module'));
});
