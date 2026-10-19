/* 지식 연결 지도: 게시물을 노드로, 제목·카테고리·태그가 겹치는 게시물끼리 선으로 연결한다.
   라이브러리 없이 canvas + 간단한 힘 기반 배치(force-directed)로 그린다. */
(function () {
  var root = document.getElementById('kg');
  if (!root) return;

  var stage = document.getElementById('kg-stage');
  var canvas = document.getElementById('kg-canvas');
  var ctx = canvas.getContext('2d');
  var tooltip = document.getElementById('kg-tooltip');
  var card = document.getElementById('kg-card');
  var message = document.getElementById('kg-message');
  var legendEl = document.getElementById('kg-legend');
  var statsEl = document.getElementById('kg-stats');
  var listEl = document.getElementById('kg-list');

  var PALETTE = ['#2f6b4f', '#d98c4a', '#4a8fd1', '#c2543f', '#8a64d6', '#c2a23a', '#2f9e8f', '#7a8794'];
  var NO_CAT = '분류 없음';

  // 제목에서 키워드를 뽑을 때 의미가 약한 단어
  var STOP = {};
  ('정리 오늘 어제 이번 배운 하기 방법 개념 사용 통해 그리고 에서 으로 에게 하는 하고 vs the and for with 기초 기본 후기 사용기 정리하기')
    .split(' ').forEach(function (w) { STOP[w] = true; });

  var THRESHOLD = 3;       // 이 점수 이상이면 연결
  var W_TAG = 3, W_CAT = 2, W_WORD = 1.5;

  var nodes = [], links = [], byId = {};
  var catColor = {}, cats = [];
  var activeCat = null;
  var view = { k: 1, x: 0, y: 0 };
  var W = 0, H = 0, dpr = 1;
  var hovered = null, selected = null;
  var alpha = 1;
  var dirty = true;

  /* ---------- 데이터 ---------- */
  function words(title) {
    var out = [], seen = {};
    title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').forEach(function (t) {
      if (t.length >= 2 && !STOP[t] && !seen[t]) { seen[t] = true; out.push(t); }
    });
    return out;
  }

  function shared(a, b) {
    var n = 0;
    a.forEach(function (x) { if (b.indexOf(x) !== -1) n++; });
    return n;
  }

  function build(posts) {
    var catSet = {};
    posts.forEach(function (p) {
      var c = (p.categories && p.categories[0]) || NO_CAT;
      catSet[c] = (catSet[c] || 0) + 1;
    });
    cats = Object.keys(catSet).sort();
    cats.forEach(function (c, i) { catColor[c] = c === NO_CAT ? '#7a8794' : PALETTE[i % PALETTE.length]; });

    nodes = posts.map(function (p, i) {
      var cat = (p.categories && p.categories[0]) || NO_CAT;
      var ci = cats.indexOf(cat);
      var ang = (ci / cats.length) * Math.PI * 2 + (i % 7) * 0.2;
      var rad = 120 + (i % 5) * 18;
      return {
        id: i, post: p, cat: cat, color: catColor[cat],
        tags: (p.tags || []).map(function (t) { return String(t).toLowerCase(); }),
        cats: (p.categories || []).map(function (c) { return String(c).toLowerCase(); }),
        words: words(p.title),
        x: Math.cos(ang) * rad + (Math.random() - .5) * 30,
        y: Math.sin(ang) * rad + (Math.random() - .5) * 30,
        vx: 0, vy: 0, deg: 0, fixed: false, r: 7, nbrs: {}
      };
    });

    links = [];
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var a = nodes[i], b = nodes[j];
        var score = shared(a.tags, b.tags) * W_TAG + shared(a.cats, b.cats) * W_CAT + shared(a.words, b.words) * W_WORD;
        if (score >= THRESHOLD) {
          links.push({ a: a, b: b, w: score });
          a.deg++; b.deg++;
          a.nbrs[b.id] = true; b.nbrs[a.id] = true;
        }
      }
    }
    nodes.forEach(function (n) { n.r = 6 + Math.sqrt(n.deg) * 2.4; });
  }

  /* ---------- 힘 기반 배치 ---------- */
  function catCenters() {
    var centers = {};
    cats.forEach(function (c, i) {
      var ang = (i / cats.length) * Math.PI * 2;
      var rad = cats.length > 1 ? 160 + Math.min(nodes.length, 200) * 1.2 : 0;
      centers[c] = { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad };
    });
    return centers;
  }

  var centers = {};

  function tick() {
    var n = nodes.length, i, j, a, b, dx, dy, d2, d, f;

    for (i = 0; i < n; i++) {
      a = nodes[i];
      for (j = i + 1; j < n; j++) {
        b = nodes[j];
        dx = a.x - b.x; dy = a.y - b.y;
        d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = 0.5; }
        if (d2 > 160000) continue; // 멀리 있는 노드끼리는 계산 생략
        d = Math.sqrt(d2);
        f = 2600 / d2 * alpha;
        dx = dx / d * f; dy = dy / d * f;
        a.vx += dx; a.vy += dy; b.vx -= dx; b.vy -= dy;
      }
    }

    links.forEach(function (l) {
      var rest = 120 - Math.min(l.w, 9) * 7;
      var ddx = l.b.x - l.a.x, ddy = l.b.y - l.a.y;
      var dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      var ff = (dd - rest) * 0.04 * alpha;
      ddx = ddx / dd * ff; ddy = ddy / dd * ff;
      l.a.vx += ddx; l.a.vy += ddy; l.b.vx -= ddx; l.b.vy -= ddy;
    });

    nodes.forEach(function (nd) {
      var c = centers[nd.cat] || { x: 0, y: 0 };
      nd.vx += (c.x - nd.x) * 0.012 * alpha - nd.x * 0.004 * alpha;   // 카테고리끼리 모이고, 전체는 중앙으로
      nd.vy += (c.y - nd.y) * 0.012 * alpha - nd.y * 0.004 * alpha;
      if (nd.fixed) { nd.vx = nd.vy = 0; return; }
      nd.vx *= 0.8; nd.vy *= 0.8;
      nd.x += nd.vx; nd.y += nd.vy;
    });

    alpha *= 0.985;
  }

  function settle() {
    centers = catCenters();
    alpha = 1;
    var ticks = nodes.length > 250 ? 120 : 320;
    for (var t = 0; t < ticks; t++) tick();
    alpha = 0.05;
  }

  /* ---------- 좌표 / 그리기 ---------- */
  function toScreen(x, y) { return { x: x * view.k + view.x, y: y * view.k + view.y }; }
  function toWorld(sx, sy) { return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k }; }

  function resize() {
    var rect = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(200, Math.round(rect.width));
    H = Math.max(200, Math.round(rect.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  }

  function fit() {
    if (!nodes.length) return;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function (n) {
      minX = Math.min(minX, n.x - n.r); maxX = Math.max(maxX, n.x + n.r);
      minY = Math.min(minY, n.y - n.r); maxY = Math.max(maxY, n.y + n.r);
    });
    var pad = 70;
    var k = Math.min((W - pad * 2) / Math.max(maxX - minX, 1), (H - pad * 2) / Math.max(maxY - minY, 1), 1.8);
    view.k = Math.max(0.2, k);
    view.x = W / 2 - ((minX + maxX) / 2) * view.k;
    view.y = H / 2 - ((minY + maxY) / 2) * view.k;
    dirty = true;
  }

  function isDim(n) {
    if (activeCat && n.cat !== activeCat) return true;
    var focus = hovered || selected;
    if (focus && n !== focus && !focus.nbrs[n.id]) return true;
    return false;
  }

  function truncate(s, max) { return s.length > max ? s.slice(0, max - 1) + '…' : s; }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var focus = hovered || selected;

    links.forEach(function (l) {
      var pa = toScreen(l.a.x, l.a.y), pb = toScreen(l.b.x, l.b.y);
      var related = focus && (l.a === focus || l.b === focus);
      var dim = (focus && !related) || (activeCat && (l.a.cat !== activeCat || l.b.cat !== activeCat));
      ctx.strokeStyle = related ? 'rgba(47, 107, 79,.85)' : 'rgba(47, 107, 79,' + (dim ? .07 : Math.min(.55, .2 + l.w / 20)) + ')';
      ctx.lineWidth = (0.8 + Math.min(l.w, 9) / 3) * (related ? 1.4 : 1);
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    });

    var labelAll = view.k >= 1.4;
    nodes.forEach(function (n) {
      var p = toScreen(n.x, n.y);
      if (p.x < -40 || p.y < -40 || p.x > W + 40 || p.y > H + 40) return;
      var r = n.r * Math.min(Math.max(view.k, 0.7), 1.8);
      var dim = isDim(n);
      ctx.globalAlpha = dim ? 0.22 : 1;

      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.color; ctx.fill();
      ctx.lineWidth = n === focus ? 3 : 2;
      ctx.strokeStyle = '#fff';
      if (n.deg === 0) ctx.setLineDash([3, 3]); // 연결 없는 글: 점선 테두리
      if (n.deg === 0) { ctx.strokeStyle = n.color; ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; }
      ctx.stroke();
      ctx.setLineDash([]);
      if (n.deg === 0) { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, r * 0.35), 0, Math.PI * 2); ctx.fillStyle = n.color; ctx.fill(); }

      if (labelAll || n === focus || (focus && focus.nbrs[n.id])) {
        ctx.font = (n === focus ? '700 ' : '400 ') + '12px "Open Sans", "Helvetica Neue", Arial, sans-serif';
        ctx.textAlign = 'center';
        var text = truncate(n.post.title, 22);
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.9)';
        ctx.strokeText(text, p.x, p.y + r + 14);
        ctx.fillStyle = '#2c2c2c';
        ctx.fillText(text, p.x, p.y + r + 14);
      }
      ctx.globalAlpha = 1;
    });
  }

  function frame() {
    if (alpha > 0.012) { tick(); dirty = true; }
    if (dirty) { draw(); dirty = false; }
    requestAnimationFrame(frame);
  }

  /* ---------- 히트 테스트 / 툴팁 / 카드 ---------- */
  function nodeAt(sx, sy) {
    var best = null, bestD = Infinity;
    nodes.forEach(function (n) {
      var p = toScreen(n.x, n.y);
      var r = n.r * Math.min(Math.max(view.k, 0.7), 1.8) + 5;
      var d = Math.hypot(p.x - sx, p.y - sy);
      if (d <= r && d < bestD) { best = n; bestD = d; }
    });
    return best;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fillInfo(box, n, withLink) {
    box.textContent = '';
    box.appendChild(el('strong', 'kg-info-title', n.post.title));
    var dot = el('span', 'kg-dot');
    dot.style.background = n.color;
    var meta = el('div', 'kg-info-meta');
    meta.appendChild(dot);
    meta.appendChild(document.createTextNode(n.cat + ' · ' + n.post.date + ' · 연결 ' + n.deg + '개'));
    box.appendChild(meta);
    if (n.post.tags && n.post.tags.length) {
      box.appendChild(el('div', 'kg-info-tags', n.post.tags.map(function (t) { return '#' + t; }).join(' ')));
    }
    if (withLink) {
      var a = el('a', 'kg-info-link', '글 읽으러 가기 →');
      a.href = n.post.url;
      box.appendChild(a);
    }
  }

  function showTooltip(n, sx, sy) {
    if (!n) { tooltip.hidden = true; return; }
    fillInfo(tooltip, n, false);
    tooltip.hidden = false;
    var tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    var x = sx + 16, y = sy + 16;
    if (x + tw > W - 8) x = sx - tw - 16;
    if (y + th > H - 8) y = sy - th - 16;
    tooltip.style.left = Math.max(8, x) + 'px';
    tooltip.style.top = Math.max(8, y) + 'px';
  }

  function showCard(n) {
    selected = n;
    if (!n) { card.hidden = true; dirty = true; return; }
    fillInfo(card, n, true);
    card.hidden = false;
    dirty = true;
  }

  /* ---------- 포인터 (마우스 / 터치 / 펜) ---------- */
  var pointers = {};
  var drag = null;      // { type: 'node'|'pan', node, startX, startY, moved }
  var pinch = null;

  function pos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function zoomAt(sx, sy, factor) {
    var nk = Math.min(4, Math.max(0.2, view.k * factor));
    var f = nk / view.k;
    view.x = sx - (sx - view.x) * f;
    view.y = sy - (sy - view.y) * f;
    view.k = nk;
    dirty = true;
  }

  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    var p = pos(e);
    pointers[e.pointerId] = p;
    var ids = Object.keys(pointers);

    if (ids.length === 2) {
      var a = pointers[ids[0]], b = pointers[ids[1]];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
      drag = null;
      return;
    }

    var n = nodeAt(p.x, p.y);
    drag = { type: n ? 'node' : 'pan', node: n, startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, moved: false, pointerType: e.pointerType };
    if (n) { n.fixed = true; }
    tooltip.hidden = true;
  });

  canvas.addEventListener('pointermove', function (e) {
    var p = pos(e);
    if (pointers[e.pointerId]) pointers[e.pointerId] = p;

    if (pinch) {
      var ids = Object.keys(pointers);
      if (ids.length >= 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.dist > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / pinch.dist);
        pinch.dist = dist;
      }
      return;
    }

    if (drag) {
      var dx = p.x - drag.lastX, dy = p.y - drag.lastY;
      if (Math.hypot(p.x - drag.startX, p.y - drag.startY) > 4) drag.moved = true;
      drag.lastX = p.x; drag.lastY = p.y;
      if (drag.moved) {
        if (drag.type === 'node') {
          var w = toWorld(p.x, p.y);
          drag.node.x = w.x; drag.node.y = w.y;
          alpha = Math.max(alpha, 0.25);
        } else {
          view.x += dx; view.y += dy;
        }
        dirty = true;
      }
      return;
    }

    if (e.pointerType === 'mouse') {
      var n = nodeAt(p.x, p.y);
      if (n !== hovered) { hovered = n; dirty = true; }
      canvas.style.cursor = n ? 'pointer' : 'grab';
      showTooltip(n, p.x, p.y);
    }
  });

  function endPointer(e) {
    var p = pos(e);
    delete pointers[e.pointerId];
    if (pinch) { if (Object.keys(pointers).length < 2) pinch = null; return; }
    if (!drag) return;

    var d = drag;
    drag = null;
    if (d.node) d.node.fixed = false;

    if (!d.moved && e.type === 'pointerup') {
      var n = nodeAt(p.x, p.y);
      if (n) {
        if (d.pointerType === 'mouse') window.location.href = n.post.url;   // 클릭: 글로 이동
        else showCard(n);                                                   // 터치: 정보 카드 먼저
      } else {
        showCard(null);
      }
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse' && !drag) { hovered = null; tooltip.hidden = true; dirty = true; }
  });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var p = pos(e);
    zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  document.getElementById('kg-zoom-in').addEventListener('click', function () { zoomAt(W / 2, H / 2, 1.3); });
  document.getElementById('kg-zoom-out').addEventListener('click', function () { zoomAt(W / 2, H / 2, 1 / 1.3); });
  document.getElementById('kg-fit').addEventListener('click', fit);

  window.addEventListener('resize', function () { resize(); });

  /* ---------- 범례 / 통계 / 목록 ---------- */
  function renderLegend() {
    legendEl.textContent = '';
    cats.forEach(function (c) {
      var count = nodes.filter(function (n) { return n.cat === c; }).length;
      var b = el('button', 'kg-chip');
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      var dot = el('span', 'kg-dot');
      dot.style.background = catColor[c];
      b.appendChild(dot);
      b.appendChild(document.createTextNode(c + ' '));
      b.appendChild(el('small', null, String(count)));
      b.addEventListener('click', function () {
        activeCat = activeCat === c ? null : c;
        legendEl.querySelectorAll('.kg-chip').forEach(function (x) {
          x.setAttribute('aria-pressed', 'false'); x.classList.remove('active');
        });
        if (activeCat) { b.setAttribute('aria-pressed', 'true'); b.classList.add('active'); }
        dirty = true;
      });
      legendEl.appendChild(b);
    });
  }

  function renderStats() {
    var isolated = nodes.filter(function (n) { return n.deg === 0; }).length;
    statsEl.textContent = '게시물 ' + nodes.length + '개 · 연결 ' + links.length + '개 · 연결 없는 글 ' + isolated + '개';
  }

  function renderList() {
    listEl.textContent = '';
    nodes.forEach(function (n) {
      var li = el('li');
      var a = el('a', null, n.post.title);
      a.href = n.post.url;
      li.appendChild(a);
      var rel = nodes.filter(function (m) { return n.nbrs[m.id]; });
      li.appendChild(el('span', 'kg-list-meta', ' — ' + n.cat + (rel.length ? ' · 관련 글 ' + rel.length + '개: ' + rel.map(function (m) { return truncate(m.post.title, 18); }).join(', ') : ' · 연결된 글 없음')));
      listEl.appendChild(li);
    });
  }

  /* ---------- 시작 ---------- */
  function fail(text) {
    statsEl.textContent = '';
    message.textContent = text;
    message.hidden = false;
  }

  resize();
  fetch(root.getAttribute('data-json'))
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (posts) {
      if (!posts.length) return fail('아직 지도에 표시할 글이 없어요.');
      build(posts);
      settle();
      resize();
      fit();
      renderLegend();
      renderStats();
      renderList();
      requestAnimationFrame(frame);
    })
    .catch(function () { fail('지도를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); });
})();
