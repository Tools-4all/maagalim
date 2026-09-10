#!/bin/bash
# מעלה את חותמת הגרסה בכל כתובות הייבוא והסגנון.
# מודולי ES נשמרים במטמון לפי כתובת, אז בלי זה גולש חוזר מקבל
# תערובת של קוד ישן וחדש אחרי כל דיפלוי. להריץ לפני כל דחיפה.
set -e
cd "$(dirname "$0")"
V="${1:-$(date +%Y%m%d%H%M)}"
python3 - "$V" <<'PY'
import re,sys,os
v=sys.argv[1]
imp=re.compile(r"""((?:from|import)\s*['"])(\.{1,2}/[^'"?]+\.js)(\?v=[^'"]*)?(['"])""")
n=0
for f in os.listdir('.'):
    if not f.endswith('.js') or f=='bump.sh': continue
    s=open(f,encoding='utf-8').read()
    out,c=imp.subn(lambda m:f"{m.group(1)}{m.group(2)}?v={v}{m.group(4)}",s)
    if c: open(f,'w',encoding='utf-8').write(out); n+=c
h=open('index.html',encoding='utf-8').read()
h=re.sub(r'(href="\./[^"?]+\.css)(\?v=[^"]*)?"',lambda m:f'{m.group(1)}?v={v}"',h)
h=re.sub(r'(src="\./main\.js)(\?v=[^"]*)?"',lambda m:f'{m.group(1)}?v={v}"',h)
open('index.html','w',encoding='utf-8').write(h)
print(f"גרסה {v} — {n} ייבואים + index.html")
PY
