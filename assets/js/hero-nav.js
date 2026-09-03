document.addEventListener('DOMContentLoaded', function () {
  var nav = document.querySelector('.navbar-transparent');
  if (!nav) return;

  function onScroll() {
    if (window.scrollY > 60) {
      nav.classList.add('nav-solid');
    } else {
      nav.classList.remove('nav-solid');
    }
  }

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
});
