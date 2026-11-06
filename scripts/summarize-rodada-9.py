"""Summarize completed evidence and assemble contact sheets (no game execution)."""
import json
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
out = Path('evidence/rodada-9')
r = json.loads((out / 'session-report.json').read_text())
assert not r.get('failure'), r.get('failure')
assert len(r['matches']) == 8 and not r['errors']
rows = []
for m in r['matches']:
    d = m['endResources']['diagnostics']
    rows.append(dict(match=m['index'], map=m['map'], mode=m['mode'], human=m['humans'],
        fpsStart=m['fpsStart']['fps'], fpsLate=m['fpsLate']['fps'], diagnosticFPS=d['fps'],
        heapMiB=m['endResources']['heap']['usedSize']/1048576,
        geometries=d['geometries'], textures=d['textures'], programs=d['programs'],
        liveAudio=m['endResources']['audio']['live'], listeners=m['endResources']['dom']['jsEventListeners'],
        tick=m['finish']['state']['tick'], round=m['finish']['state']['round'],
        p1Events={k:v for k,v in m['finish']['events'].items() if k.endswith(':0')}))
summary = {'durationMinutes':r['durationSeconds']/60,'rows':rows,'unexpectedErrors':r['errors'],'pagesAtEnd':r['pagesAtEnd']}
(out/'summary.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
paths = sorted(out.glob('partida-*.png')) + [out/'oitava-vitoria.png']
sheet = Image.new('RGB',(1440,310*((len(paths)+2)//3)))
for i,p in enumerate(paths):
    tile=Image.new('RGB',(480,310),'#111111')
    tile.paste(ImageOps.contain(Image.open(p).convert('RGB'),(480,280)),(0,25))
    ImageDraw.Draw(tile).text((4,4),p.stem,fill='white')
    sheet.paste(tile,((i%3)*480,(i//3)*310))
sheet.save(out/'conferencia-sessao.jpg')
