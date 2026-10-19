/* 오늘의 날씨: Open-Meteo (API 키 없음). 위치는 _config.yml의 weather 설정(기본 서울).
   한 시간 동안 localStorage에 저장해 두고 다시 요청하지 않는다. */
document.addEventListener('DOMContentLoaded', function () {
  var box = document.getElementById('weather');
  if (!box) return;

  var lat = parseFloat(box.getAttribute('data-lat'));
  var lon = parseFloat(box.getAttribute('data-lon'));
  if (isNaN(lat) || isNaN(lon)) return;

  var KEY = 'blog.weather.v1';
  var MAX_AGE = 60 * 60 * 1000;
  var URL = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
    '&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=auto&forecast_days=1';

  // WMO 날씨 코드 -> [아이콘, 설명]
  function describe(code) {
    if (code === 0) return ['☀️', '맑음'];
    if (code === 1) return ['🌤️', '대체로 맑음'];
    if (code === 2) return ['⛅', '구름 조금'];
    if (code === 3) return ['☁️', '흐림'];
    if (code === 45 || code === 48) return ['🌫️', '안개'];
    if (code >= 51 && code <= 57) return ['🌦️', '이슬비'];
    if (code >= 61 && code <= 67) return ['🌧️', '비'];
    if (code >= 71 && code <= 77) return ['🌨️', '눈'];
    if (code >= 80 && code <= 82) return ['🌦️', '소나기'];
    if (code === 85 || code === 86) return ['🌨️', '눈 소나기'];
    if (code >= 95) return ['⛈️', '천둥번개'];
    return ['🌡️', '날씨 정보'];
  }

  function advice(code, rain, max) {
    if (code >= 95) return '천둥번개가 예상돼요. 외출은 조심하세요.';
    if (rain >= 60 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '우산을 챙기세요.';
    if (code >= 71 && code <= 77) return '눈 소식이 있어요. 따뜻하게 입으세요.';
    if (max >= 30) return '더운 하루예요. 물을 자주 마셔요.';
    if (max <= 5) return '쌀쌀해요. 두툼하게 입으세요.';
    return '공부하기 좋은 하루예요.';
  }

  function set(id, text) { var n = document.getElementById(id); if (n) n.textContent = text; }
  function round(n) { return Math.round(n); }

  function render(d) {
    var c = d.current, day = d.daily;
    var info = describe(c.weather_code);
    var rain = day.precipitation_probability_max ? day.precipitation_probability_max[0] : 0;
    var max = day.temperature_2m_max[0], min = day.temperature_2m_min[0];

    set('weather-icon', info[0]);
    set('weather-desc', info[1] + ' · ' + advice(c.weather_code, rain, max));
    set('weather-temp', round(c.temperature_2m));
    set('weather-range', round(max) + '° / ' + round(min) + '°');
    set('weather-rain', rain + '%');
    set('weather-feel', round(c.apparent_temperature) + '°');
    set('weather-hum', round(c.relative_humidity_2m) + '%');
  }

  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY));
      if (c && c.lat === lat && c.lon === lon && Date.now() - c.at < MAX_AGE) return c.data;
    } catch (e) {}
    return null;
  }

  var cached = readCache();
  if (cached) return render(cached);

  fetch(URL)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      if (!data.current || !data.daily) throw new Error('bad');
      try { localStorage.setItem(KEY, JSON.stringify({ lat: lat, lon: lon, at: Date.now(), data: data })); } catch (e) {}
      render(data);
    })
    .catch(function () { set('weather-desc', '날씨를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.'); });
});
