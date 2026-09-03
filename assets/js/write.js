document.addEventListener('DOMContentLoaded', function () {
  var titleInput = document.getElementById('post-title');
  var dateInput = document.getElementById('post-date');
  var timeInput = document.getElementById('post-time');
  var bodyTextarea = document.getElementById('post-body');
  var generateBtn = document.getElementById('generate-btn');
  var errorEl = document.getElementById('write-error');
  var outputSection = document.getElementById('write-output');
  var filenameEl = document.getElementById('write-filename');
  var resultTextarea = document.getElementById('write-result');
  var copyBtn = document.getElementById('copy-btn');
  var downloadBtn = document.getElementById('download-btn');

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function todayParts() {
    var now = new Date();
    return {
      date: now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()),
      time: pad(now.getHours()) + ':' + pad(now.getMinutes())
    };
  }

  var defaults = todayParts();
  dateInput.value = defaults.date;
  timeInput.value = defaults.time;

  bodyTextarea.value = [
    '## 들어가며 (Situation)',
    '- 프로젝트 배경, 글을 쓰게 된 계기',
    '',
    '## 문제 상황 (Task)',
    '- 구체적인 문제 정의, 제약 조건',
    '',
    '## 해결 과정 (Action)',
    '- 검토한 대안 비교 (표 활용)',
    '- 선택한 방법과 이유',
    '- 구현 과정 (코드 + 다이어그램)',
    '- 겪은 시행착오',
    '',
    '## 결과 (Result)',
    '- Before/After 비교 (정량 지표)',
    '- 배운 점',
    '',
    '## 더 학습하면 좋은 개념',
    '- ',
    '',
    '## 참고 자료',
    '- '
  ].join('\n');

  function slugify(value) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // 제목이 한글이라 영문 슬러그를 못 뽑아내면, 시간 기반 이름으로 대신한다
  function slugFromTitle(title, time) {
    var slug = slugify(title);
    if (slug) return slug;
    var hm = (time || '0000').replace(':', '');
    return 'post-' + hm;
  }

  function yamlQuote(value) {
    return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function showError(msg) {
    errorEl.textContent = msg;
  }

  generateBtn.addEventListener('click', function () {
    showError('');

    var title = titleInput.value.trim();
    var date = dateInput.value;
    var time = timeInput.value || '09:00';

    if (!title) {
      showError('제목을 입력해주세요.');
      titleInput.focus();
      return;
    }
    if (!date) {
      showError('날짜를 선택해주세요.');
      dateInput.focus();
      return;
    }

    var todayStr = todayParts().date;
    if (date > todayStr) {
      showError('주의: 날짜가 미래입니다 — 기본 설정에서는 글이 보이지 않을 수 있어요. (그래도 파일은 만들어드릴게요)');
    }

    var slug = slugFromTitle(title, time);
    var usesMermaid = /```mermaid/.test(bodyTextarea.value);

    var frontMatterLines = ['---', 'layout: post', 'title: ' + yamlQuote(title), 'date: ' + date + ' ' + time + ':00 +0900'];
    if (usesMermaid) {
      frontMatterLines.push('mermaid: true');
    }
    frontMatterLines.push('---');

    var fullText = frontMatterLines.join('\n') + '\n\n' + bodyTextarea.value.trim() + '\n';
    var filename = date + '-' + slug + '.md';

    filenameEl.textContent = filename;
    resultTextarea.value = fullText;
    outputSection.hidden = false;
    outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    downloadBtn.onclick = function () {
      var blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    copyBtn.onclick = function () {
      navigator.clipboard.writeText(fullText).then(function () {
        var original = copyBtn.textContent;
        copyBtn.textContent = '복사됨!';
        setTimeout(function () { copyBtn.textContent = original; }, 1500);
      });
    };
  });
});
