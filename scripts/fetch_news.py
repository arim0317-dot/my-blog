"""전자신문 IT 뉴스 RSS에서 헤드라인 상위 N개를 assets/data/news.json 으로 저장한다.
브라우저에서는 RSS를 직접 읽을 수 없어(CORS) GitHub Actions가 주기적으로 이 스크립트를 실행한다."""
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

FEED = "https://rss.etnews.com/Section901.xml"
OUT = sys.argv[1] if len(sys.argv) > 1 else "assets/data/news.json"
MAX_ITEMS = 5

req = urllib.request.Request(FEED, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=30) as r:
    root = ET.fromstring(r.read())

items = []
for it in root.iter("item"):
    title = (it.findtext("title") or "").strip()
    link = (it.findtext("link") or "").strip()
    if title and link.startswith("https://"):
        items.append({"title": title, "link": link})
    if len(items) == MAX_ITEMS:
        break

if not items:
    sys.exit("RSS에서 기사를 읽지 못했습니다.")

kst = timezone(timedelta(hours=9))
data = {"updated": datetime.now(kst).strftime("%Y-%m-%d %H:%M"), "items": items}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"{len(items)}건 저장: {OUT}")
