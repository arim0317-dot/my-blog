/* 방명록: utterances (GitHub 이슈를 댓글 저장소로 사용)
   - 저장소에 utterances 앱(https://github.com/apps/utterances)이 설치되어 있어야 댓글을 쓸 수 있다.
   - 모든 방문자의 방명록이 'Guestbook' 이슈 하나에 모인다. */
document.addEventListener('DOMContentLoaded', function () {
  var host = document.getElementById('guestbook-comments');
  if (!host) return;

  var s = document.createElement('script');
  s.src = 'https://utteranc.es/client.js';
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.setAttribute('repo', host.getAttribute('data-repo'));
  s.setAttribute('issue-term', 'Guestbook');
  s.setAttribute('label', 'guestbook');
  s.setAttribute('theme', 'github-light');

  s.onload = function () {
    var loading = host.querySelector('.guestbook-loading');
    if (loading) loading.remove();
  };
  s.onerror = function () {
    var loading = host.querySelector('.guestbook-loading');
    if (loading) loading.textContent = '방명록을 불러오지 못했어요. 아래 GitHub 이슈 링크를 이용해 주세요.';
  };

  host.appendChild(s);
});
