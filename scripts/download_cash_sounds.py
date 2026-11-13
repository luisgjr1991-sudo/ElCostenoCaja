#!/usr/bin/env python3
"""Obtiene grabaciones CC0 para incluirlas dentro de la APK (sin conexión en uso).
Fuente: https://slapalert.com/sounds (licencia CC0 1.0).
Falla la compilación si no hay MP3 válidos: nunca sustituirlos por pitidos.
"""
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from pathlib import Path
import re

BASE="https://slapalert.com"
SOUNDS={
 "register_classic.mp3":"/sounds/cha-ching",
 "register_modern.mp3":"/sounds/cash-register",
 "register_key.mp3":"/sounds/coin-drop",
 "soft_click.mp3":"/sounds/soft-ping",
 "warning.mp3":"/sounds/whomp-whomp",
}
class Links(HTMLParser):
 def __init__(self):
  super().__init__();self.links=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  for key in ("href","src","data-src"):
   if a.get(key) and (".mp3" in a[key].lower() or "audio/mpeg" in a.get("type","")):
    self.links.append(a[key])
def fetch(url):
 req=Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; ElCostenoCaja/1.0)"})
 with urlopen(req,timeout=30) as r:return r.read()
dest=Path("android/app/src/main/assets/sounds");dest.mkdir(parents=True,exist_ok=True)
for filename,path in SOUNDS.items():
 page=BASE+path
 html=fetch(page).decode("utf-8")
 parser=Links();parser.feed(html)
 urls=[urljoin(page,x) for x in parser.links]
 urls += [urljoin(page,x) for x in re.findall(r'https?[^"\\\s<>]+?\.mp3(?:\?[^"\\\s<>]*)?',html)]
 urls=list(dict.fromkeys(urls))
 if not urls:raise RuntimeError("No se encontró descarga MP3 CC0 en "+page)
 errors=[]
 for url in urls:
  try:
   data=fetch(url)
   if len(data)<2000 or not (data.startswith(b"ID3") or data[:2] in (b"\\xff\\xfb",b"\\xff\\xf3",b"\\xff\\xf2")):
    raise ValueError("Respuesta no es MP3")
   (dest/filename).write_bytes(data)
   print(filename,len(data),"bytes",url)
   break
  except Exception as exc:errors.append(str(exc))
 else:raise RuntimeError("No se pudo obtener MP3 "+filename+": "+"; ".join(errors))
