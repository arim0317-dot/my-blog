document.addEventListener('DOMContentLoaded', function () {
  var links = document.querySelectorAll('.filter-link');
  var posts = document.querySelectorAll('.posts-list > .post-preview');

  function postMatches(post, type, value) {
    if (type === 'all') {
      return true;
    }
    var attr = type === 'category' ? 'categories' : 'tags';
    var raw = post.getAttribute('data-' + attr) || '';
    var list = raw.split('|').filter(Boolean);
    return list.indexOf(value) !== -1;
  }

  links.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();

      var type = link.getAttribute('data-filter-type');
      var value = link.getAttribute('data-filter-value');

      links.forEach(function (l) {
        l.classList.remove('active');
      });
      link.classList.add('active');

      posts.forEach(function (post) {
        post.style.display = postMatches(post, type, value) ? '' : 'none';
      });
    });
  });
});
