document.addEventListener('DOMContentLoaded', function () {
  var START = new Date(2026, 7, 26); // 2026-08-26
  var END = new Date(2027, 1, 16);   // 2027-02-16
  var WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  var body = document.getElementById('cal-body');
  var title = document.getElementById('cal-month-title');
  var todayLabel = document.getElementById('cal-today-label');
  var prevBtn = document.getElementById('cal-prev');
  var nextBtn = document.getElementById('cal-next');
  if (!body || !title || !prevBtn || !nextBtn) {
    return;
  }

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function inRange(d) {
    return d.getTime() >= START.getTime() && d.getTime() <= END.getTime();
  }

  function daysBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  // 오늘이 프로그램 기간 안이면 오늘이 속한 달로, 아니면 시작/종료 달로 시작한다.
  var current;
  if (today.getTime() < START.getTime()) {
    current = { year: START.getFullYear(), month: START.getMonth() };
  } else if (today.getTime() > END.getTime()) {
    current = { year: END.getFullYear(), month: END.getMonth() };
  } else {
    current = { year: today.getFullYear(), month: today.getMonth() };
  }

  var totalDays = daysBetween(START, END) + 1;
  var dateLabel = today.getFullYear() + '년 ' + (today.getMonth() + 1) + '월 ' + today.getDate() + '일';

  if (todayLabel) {
    if (today.getTime() < START.getTime()) {
      todayLabel.innerHTML = '오늘은 ' + dateLabel + ' · 과정 시작까지 <strong>D-' + daysBetween(today, START) + '</strong>';
    } else if (today.getTime() > END.getTime()) {
      todayLabel.innerHTML = '오늘은 ' + dateLabel + ' · 과정이 종료되었습니다';
    } else {
      todayLabel.innerHTML = '오늘은 ' + dateLabel + ' · <strong>' + (daysBetween(START, today) + 1) + '일차</strong> / 총 ' + totalDays + '일';
    }
  }

  function isFirstMonth(year, month) {
    return year === START.getFullYear() && month === START.getMonth();
  }

  function isLastMonth(year, month) {
    return year === END.getFullYear() && month === END.getMonth();
  }

  function render() {
    var year = current.year;
    var month = current.month;

    title.textContent = year + '년 ' + (month + 1) + '월';
    prevBtn.disabled = isFirstMonth(year, month);
    nextBtn.disabled = isLastMonth(year, month);

    var firstOfMonth = new Date(year, month, 1);
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var firstWeekday = firstOfMonth.getDay();

    var html = '<tr>';
    for (var i = 0; i < firstWeekday; i++) {
      html += '<td class="calendar-day-empty"></td>';
    }

    var col = firstWeekday;
    for (var day = 1; day <= daysInMonth; day++) {
      var d = new Date(year, month, day);
      var classes = [];
      if (!inRange(d)) {
        classes.push('calendar-day-out');
      } else if (d.getDay() === 0) {
        classes.push('calendar-day-sun');
      }
      var numHtml = day;
      if (sameDay(d, today)) {
        classes.push('calendar-day-today');
        numHtml = '<span class="calendar-day-num">' + day + '</span>';
      }
      html += '<td class="' + classes.join(' ') + '">' + numHtml + '</td>';

      col++;
      if (col === 7 && day !== daysInMonth) {
        html += '</tr><tr>';
        col = 0;
      }
    }
    while (col < 7) {
      html += '<td class="calendar-day-empty"></td>';
      col++;
    }
    html += '</tr>';

    body.innerHTML = html;
  }

  prevBtn.addEventListener('click', function () {
    if (prevBtn.disabled) return;
    current.month--;
    if (current.month < 0) {
      current.month = 11;
      current.year--;
    }
    render();
  });

  nextBtn.addEventListener('click', function () {
    if (nextBtn.disabled) return;
    current.month++;
    if (current.month > 11) {
      current.month = 0;
      current.year++;
    }
    render();
  });

  render();
});
