(function () {
  var overlay = document.getElementById('beautifuljekyll-search-overlay');
  if (!overlay) return;

  var input = document.getElementById('nav-search-input');
  var filtersEl = document.getElementById('search-filters');
  var statusEl = document.getElementById('search-status');
  var listEl = document.getElementById('search-results-container');
  var jsonUrl = overlay.getAttribute('data-json');

  var posts = null;
  var loading = false;
  var activeCategory = '';
  var MAX_RESULTS = 20;

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // 검색어가 겹치지 않게 하이라이트해서 노드에 추가한다. (innerHTML을 쓰지 않는다)
  function appendHighlighted(parent, text, terms) {
    var lower = text.toLowerCase();
    var ranges = [];
    terms.forEach(function (t) {
      var from = 0;
      var i;
      while ((i = lower.indexOf(t, from)) !== -1) {
        ranges.push([i, i + t.length]);
        from = i + t.length;
      }
    });
    ranges.sort(function (a, b) { return a[0] - b[0]; });

    var pos = 0;
    ranges.forEach(function (r) {
      if (r[0] < pos) {
        if (r[1] > pos) {
          var extra = el('mark', null, text.slice(pos, r[1]));
          parent.appendChild(extra);
          pos = r[1];
        }
        return;
      }
      if (r[0] > pos) parent.appendChild(document.createTextNode(text.slice(pos, r[0])));
      parent.appendChild(el('mark', null, text.slice(r[0], r[1])));
      pos = r[1];
    });
    if (pos < text.length) parent.appendChild(document.createTextNode(text.slice(pos)));
  }

  function loadPosts(cb) {
    if (posts) return cb();
    if (loading) return;
    loading = true;
    fetch(jsonUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        posts = data;
        buildFilters();
        cb();
      })
      .catch(function () {
        statusEl.textContent = '검색 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      })
      .then(function () { loading = false; });
  }

  function buildFilters() {
    var counts = {};
    posts.forEach(function (p) {
      (p.categories || []).forEach(function (c) { counts[c] = (counts[c] || 0) + 1; });
    });
    var names = Object.keys(counts).sort();
    if (!names.length) return;

    filtersEl.textContent = '';
    addChip('', '전체', posts.length);
    names.forEach(function (c) { addChip(c, c, counts[c]); });
  }

  function addChip(value, label, count) {
    var b = el('button', 'search-chip' + (value === activeCategory ? ' active' : ''));
    b.type = 'button';
    b.setAttribute('data-category', value);
    b.appendChild(document.createTextNode(label + ' '));
    b.appendChild(el('span', null, String(count)));
    b.addEventListener('click', function () {
      activeCategory = value;
      filtersEl.querySelectorAll('.search-chip').forEach(function (c) {
        c.classList.toggle('active', c === b);
      });
      render();
      input.focus();
    });
    filtersEl.appendChild(b);
  }

  function score(p, terms) {
    var title = p.title.toLowerCase();
    var tags = (p.tags || []).join(' ').toLowerCase();
    var cats = (p.categories || []).join(' ').toLowerCase() + ' ' + (p.module || '').toLowerCase();
    var content = p.content.toLowerCase();
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var s = 0;
      if (title.indexOf(t) !== -1) s += 10;
      if (tags.indexOf(t) !== -1) s += 5;
      if (cats.indexOf(t) !== -1) s += 3;
      if (content.indexOf(t) !== -1) s += 1;
      if (!s) return 0; // 모든 검색어가 포함되어야 한다 (AND)
      total += s;
    }
    return total;
  }

  function snippetFor(p, terms) {
    var lower = p.content.toLowerCase();
    var idx = -1;
    for (var i = 0; i < terms.length; i++) {
      idx = lower.indexOf(terms[i]);
      if (idx !== -1) break;
    }
    if (idx === -1) return '';
    var start = Math.max(0, idx - 28);
    return (start > 0 ? '… ' : '') + p.content.slice(start, idx + 100).trim() + ' …';
  }

  function renderItem(p, terms) {
    var li = el('li');
    var a = el('a', 'search-item');
    a.href = p.url;

    var title = el('span', 'search-item-title');
    appendHighlighted(title, p.title, terms);
    a.appendChild(title);

    var meta = el('span', 'search-item-meta');
    var parts = [p.date];
    if (p.categories && p.categories.length) parts.push(p.categories[0]);
    if (p.module) parts.push(p.module);
    meta.textContent = parts.join(' · ');
    (p.tags || []).slice(0, 4).forEach(function (t) {
      var tag = el('span', 'search-item-tag');
      appendHighlighted(tag, '#' + t, terms);
      meta.appendChild(tag);
    });
    a.appendChild(meta);

    var snippet = terms.length ? snippetFor(p, terms) : '';
    if (snippet) {
      var sn = el('span', 'search-item-snippet');
      appendHighlighted(sn, snippet, terms);
      a.appendChild(sn);
    }

    li.appendChild(a);
    return li;
  }

  function render() {
    if (!posts) return;
    var query = input.value.trim().toLowerCase();
    var terms = query ? query.split(/\s+/) : [];

    var pool = posts.filter(function (p) {
      return !activeCategory || (p.categories || []).indexOf(activeCategory) !== -1;
    });

    var results;
    if (terms.length) {
      results = pool
        .map(function (p) { return { p: p, s: score(p, terms) }; })
        .filter(function (r) { return r.s > 0; })
        .sort(function (a, b) { return b.s - a.s || (a.p.date < b.p.date ? 1 : -1); })
        .map(function (r) { return r.p; });
    } else {
      results = pool.slice(0, 5); // 검색어가 없으면 최신 글 5개
    }

    listEl.textContent = '';
    results.slice(0, MAX_RESULTS).forEach(function (p) { listEl.appendChild(renderItem(p, terms)); });

    if (!terms.length) {
      statusEl.textContent = '최근 글';
    } else if (!results.length) {
      statusEl.textContent = '“' + input.value.trim() + '” 검색 결과가 없습니다.' +
        (activeCategory ? ' 카테고리를 “전체”로 바꿔 보세요.' : ' 다른 검색어로 시도해 보세요.');
    } else {
      statusEl.textContent = results.length + '개의 글' +
        (results.length > MAX_RESULTS ? ' (상위 ' + MAX_RESULTS + '개 표시)' : '');
    }
  }

  // ---------- 이벤트 ----------
  input.addEventListener('input', function () { loadPosts(render); });

  // 검색 버튼을 누르면 미리 데이터를 불러오고 최근 글을 보여준다.
  var openLink = document.getElementById('nav-search-link');
  if (openLink) {
    openLink.addEventListener('click', function () { loadPosts(render); });
  }

  // 방향키로 결과 이동, Enter로 첫 결과 열기
  overlay.addEventListener('keydown', function (e) {
    var links = Array.prototype.slice.call(listEl.querySelectorAll('a'));
    if (!links.length) return;
    var i = links.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      links[Math.min(i + 1, links.length - 1)].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (i <= 0) input.focus(); else links[i - 1].focus();
    } else if (e.key === 'Enter' && document.activeElement === input && input.value.trim()) {
      links[0].click();
    }
  });

  // 오버레이가 열려 있는 동안 배경 클릭으로 닫기
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
      var exit = document.getElementById('nav-search-exit');
      if (exit) exit.click();
    }
  });
})();
