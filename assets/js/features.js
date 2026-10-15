/* 공통 기능: 맨 위로 버튼 / 코드 복사 버튼 / 게시물 목차 */
(function () {
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 맨 위로 버튼 ---------- */
  function initBackToTop() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'back-to-top';
    btn.setAttribute('aria-label', '맨 위로 이동');
    btn.title = '맨 위로';
    btn.innerHTML = '<span class="fa fa-chevron-up" aria-hidden="true"></span>';
    document.body.appendChild(btn);

    var ticking = false;
    function update() {
      btn.classList.toggle('is-visible', window.scrollY > 400);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------- 코드 복사 버튼 ---------- */
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(ta);
      ok ? resolve() : reject();
    });
  }

  // Clipboard API가 막혀 있거나 지원되지 않으면 execCommand 방식으로 한 번 더 시도한다.
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  function initCodeCopy() {
    var post = document.querySelector('.blog-post');
    if (!post) return;

    post.querySelectorAll('pre').forEach(function (pre) {
      var code = pre.querySelector('code') || pre;
      if (code.classList.contains('language-mermaid')) return; // 다이어그램은 코드가 아니므로 제외

      var holder = pre.closest('.highlighter-rouge');
      if (!holder) {
        holder = document.createElement('div');
        holder.className = 'code-wrap';
        pre.parentNode.insertBefore(holder, pre);
        holder.appendChild(pre);
      }
      if (holder.querySelector('.code-copy-btn')) return;
      holder.classList.add('has-copy-btn');

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy-btn';
      btn.textContent = '복사';
      btn.setAttribute('aria-label', '코드 복사');
      holder.appendChild(btn);

      var timer;
      btn.addEventListener('click', function () {
        copyText(code.textContent.replace(/\n$/, '')).then(function () {
          btn.textContent = '복사됨 ✓';
          btn.classList.add('is-done');
        }, function () {
          btn.textContent = '복사 실패';
        }).then(function () {
          clearTimeout(timer);
          timer = setTimeout(function () {
            btn.textContent = '복사';
            btn.classList.remove('is-done');
          }, 1600);
        });
      });
    });
  }

  /* ---------- 게시물 목차 ---------- */
  function slugify(text) {
    return text.trim().toLowerCase().replace(/[^\wㄱ-힝]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
  }

  function initToc() {
    var post = document.querySelector('.blog-post');
    if (!post) return;

    var heads = Array.prototype.slice.call(post.querySelectorAll('h2, h3'));
    if (heads.length < 3) return;

    var used = {};
    document.querySelectorAll('[id]').forEach(function (n) { used[n.id] = true; });
    heads.forEach(function (h) {
      if (h.id) return;
      var base = slugify(h.textContent), id = base, n = 2;
      while (used[id]) id = base + '-' + n++;
      h.id = id;
      used[id] = true;
    });

    var toc = document.createElement('details');
    toc.className = 'post-toc';
    toc.setAttribute('aria-label', '목차');

    var summary = document.createElement('summary');
    summary.innerHTML = '<span class="fa fa-list-ul" aria-hidden="true"></span> 목차';
    toc.appendChild(summary);

    var list = document.createElement('ol');
    var links = [];
    heads.forEach(function (h) {
      var li = document.createElement('li');
      li.className = h.tagName === 'H3' ? 'toc-sub' : 'toc-main';
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      list.appendChild(li);
      links.push({ head: h, link: a });
    });
    toc.appendChild(list);
    post.parentNode.insertBefore(toc, post);

    // 넓은 화면에서는 본문 오른쪽에 고정되어 항상 펼쳐져 있고, 좁은 화면에서는 접어 둔다.
    var wide = window.matchMedia('(min-width: 1360px)');
    function applyLayout() { toc.open = wide.matches; }
    applyLayout();
    if (wide.addEventListener) wide.addEventListener('change', applyLayout);
    summary.addEventListener('click', function (e) { if (wide.matches) e.preventDefault(); });

    // 현재 읽고 있는 섹션 강조
    function setActive(link) {
      links.forEach(function (l) { l.link.classList.toggle('is-active', l.link === link); });
      if (link && wide.matches) {
        var li = link.parentNode;
        if (li.offsetTop < list.scrollTop || li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) {
          list.scrollTop = li.offsetTop - list.clientHeight / 2;
        }
      }
    }

    var ticking = false;
    function onScroll() {
      ticking = false;
      var current = null;
      for (var i = 0; i < links.length; i++) {
        if (links[i].head.getBoundingClientRect().top <= 110) current = links[i].link;
        else break;
      }
      setActive(current || links[0].link);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initBackToTop();
    initCodeCopy();
    initToc();
  });
})();
