"""Plot measured GC heap/FPS/resources; no synthetic inputs or browser work."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

out = Path('evidence/rodada-9')
report = json.loads((out / 'session-report.json').read_text())
before = json.loads((out / 'antes/session-report.json').read_text())
rows = report['matches']
x = [m['index'] for m in rows]
fig, axes = plt.subplots(2, 2, figsize=(13, 8), constrained_layout=True)
fig.suptitle('The Last Arrow · 8 partidas no mesmo carregamento', fontsize=17)
ax = axes[0, 0]
ax.plot(x, [m['endResources']['heap']['usedSize'] / 1048576 for m in rows], 'o-', label='Depois (1×)')
ax.plot(x, [m['endResources']['heap']['usedSize'] / 1048576 for m in before['matches']], 'o--', label='Antes (fim a 24×)', alpha=.7)
ax.set(ylabel='Heap JS após GC (MiB)', title='Heap: CDP Runtime.getHeapUsage'); ax.legend()
ax = axes[0, 1]
ax.plot(x, [m['fpsStart']['fps'] for m in rows], 'o-', label='Janela inicial 12s')
if all('fpsLate' in m for m in rows): ax.plot(x, [m['fpsLate']['fps'] for m in rows], 's-', label='Janela tardia 12s')
ax.axhline(58, color='red', linestyle='--', label='Alvo 58'); ax.set(ylim=(56, 62), ylabel='FPS real (1×)', title='GPU isolada na bancada tla; não FPS do Xvnc'); ax.legend()
ax = axes[1, 0]
ax.plot(x, [m['endResources']['diagnostics']['textures'] for m in before['matches']], 'o--', label='Texturas antes')
ax.plot(x, [m['endResources']['diagnostics']['textures'] for m in rows], 'o-', label='Texturas depois')
ax.plot(x, [m['endResources']['diagnostics']['programs'] for m in rows], 's-', label='Programas depois')
ax.set(ylabel='Quantidade', title='Three renderer.info'); ax.legend()
ax = axes[1, 1]
ax.plot(x, [m['endResources']['audio']['live'] for m in rows], 'o-', label='AudioNodes vivos')
ax.plot(x, [m['endResources']['dom']['jsEventListeners'] for m in rows], 's-', label='Listeners JS')
ax.set(ylabel='Quantidade após GC / fim do áudio', title='Contadores nativos do Chromium'); ax.legend()
for ax in axes.flat:
    ax.set_xticks(x, [f"{m['index']}\n{m['map']}" for m in rows]); ax.grid(alpha=.25)
fig.savefig(out / 'curva-sessao.png', dpi=140)
print(out / 'curva-sessao.png')
