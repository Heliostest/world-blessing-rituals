"""Read public primary references into the temporary research directory only."""
from pathlib import Path
import urllib.request, os, re
ROOT=Path(os.environ['TEMP'])/'world-blessing-C02'
ROOT.mkdir(exist_ok=True)
URLS={
 'boat.jpg':'https://media.tibble-lycka.se/2021/09/kb_oxn_klar.jpg',
 'boat-renov.jpg':'https://media.tibble-lycka.se/2018/05/Kyrkbat_renov.jpg',
 'portico.jpg':'https://portici.comune.bologna.it/sites/default/files/styles/card_poi/public/2024-04/_DS72867-HDR.jpg?itok=7QWkgBox',
 'durbar.jpeg':'https://visitghana.com/wp-content/uploads/2025/04/8751-hogbetsotso-za-festival.jpeg',
 'portico-restoration.html':'https://www.comune.bologna.it/novita/comunicati-stampa/portico-monumentale-di-san-luca-sono-iniziati-i-lavori-di-restauro-e-di-ripristino-strutturale',
 'hostyn.html':'https://old.hostyn.cz/',
}
if __name__=='__main__':
 for name,url in URLS.items():
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as response: data=response.read()
   (ROOT/name).write_bytes(data)
   print(name,len(data),ROOT/name)
   if name=='portico-restoration.html':
    raw=data.decode('utf-8'); plain=re.sub('<[^>]+>',' ',raw)
    for term in ['intonaci','342','paviment','copertur']:
     for match in re.finditer(term,plain): print(plain[max(0,match.start()-180):match.start()+400])
  except Exception as error: print(name,type(error).__name__,str(error))
