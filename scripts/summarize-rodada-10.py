import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path('evidence/rodada-10')
load = lambda path: json.loads((root / path).read_text())
before, after = load('antes/balance-report.json'), load('balance-report.json')
play_before, play_after = load('antes/play-report.json'), load('play-report.json')
summary = {'balance': {}, 'fps': [], 'errors': play_after['errors'], 'pagesAtEnd': play_after['pagesAtEnd']}
for difficulty in ['easy', 'normal']:
    summary['balance'][difficulty] = {'before': before['summary'][difficulty], 'after': after['summary'][difficulty]}
    for label, source in [('before', before), ('after', after)]:
        maps = [m for m in source['maps'] if m['difficulty'] == difficulty]
        summary['balance'][difficulty][label]['maxQuietSeconds'] = max(m['maxQuiet'] for m in maps)
        summary['balance'][difficulty][label]['botCatches'] = sum(f['catches'] for m in maps for f in m['byFighter'][1:])
for run in play_after['maps']:
    old = next(m for m in play_before['maps'] if m['map'] == run['map'] and m['difficulty'] == run['difficulty'])
    summary['fps'].append({'map': run['map'], 'difficulty': run['difficulty'], 'before': old['measurement']['fps'], 'after': run['measurement']['fps'], 'diagnostic': run['measurement']['diagnostics']['fps'], 'maxGapMs': run['measurement']['maxGap'], 'frameWorkMs': run['measurement']['diagnostics']['averageFrameWorkMs'], 'shotsP1': sum(e['type'] == 'shoot' and e['actor'] == 0 for e in run['events']), 'rounds': run['rounds']})
summary['renderer'] = play_after['renderer']
(root / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))

# Every PNG is included once, before and after in separate, readable contact sheets.
for prefix in ['antes', '.']:
    folder = root / prefix
    files = sorted(folder.glob('*.png'))
    for group in range(0, len(files), 8):
        selected = files[group:group+8]
        sheet = Image.new('RGB', (1200, 365*((len(selected)+1)//2)), '#142129')
        draw = ImageDraw.Draw(sheet)
        for i, path in enumerate(selected):
            image = Image.open(path); image.thumbnail((600, 335))
            x, y = (i % 2)*600, (i // 2)*365
            sheet.paste(image, (x, y+25)); draw.text((x+8, y+5), path.name, fill='white')
        sheet.save(folder / f'conferencia-final-{group//8+1}.jpg', quality=92)
