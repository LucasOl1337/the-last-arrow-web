# Rodada 7 — regras, bots e PC fraco

## Achado → correção → prova

- **Headhunter escondido e rotulado como Versus:** menu agora oferece a regra; HUD usa 120s/abates, resultado mostra o placar real, empate não inventa estatísticas de vencedor. Loop para pelo fim da partida, não por cinco pontos. `1052af5`, `90a8650`, `0aad1a6`. Dois testes de texto + entrada pelo menu → 120s → revanche → menu; placar **1/8/17/16** confere com cada abate.
- **Raio expirando dentro da coluna do Totem:** guarda último ponto livre e deixa munição recuperável na face de entrada. **Bomba suicida do bot:** cancela saque quando a trajetória imediata explode perto dele, sem gastar flecha. **Pisão pela borda vertical não contado:** causa vem do evento da simulação, sem subtrair posições não normalizadas. `d317376`, integração em `90a8650`. Três casos exatos falhavam antes e passam depois; fixtures no jogo comprovam baú→raio através da parede, baú→bomba, pisão, recuperação e empate (`rules-report.json`, `draw-rules-report.json`). Fixtures são explicitamente posicionadas, não encontros espontâneos.
- **Sem qualidade automática:** janela inicial de **2s de gameplay pronto**, tempo real sem cap, ignora pausa/aba escondida/test hook. Média <50FPS liga modo leve: bloom off, emissão1/3, pools **500→150 pontos / 160→40 folhas**, pixel ratio menor e aviso discreto. Persiste na revanche, sem oscilar. `90a8650`.
- **4K continuava pesado após reduzir ratio:** primeira prova CPU4/4K/DPR2 detectou13,89FPS, mas leve ficou22,58. Cap do raster em **1280×720**, recalculado ao redimensionar (`2d267db`), corrigiu: **13,44→59,88FPS**, máximo intervalo33,4ms, CPU throttling4 durante toda a medição. Quatro testes de governor/raster passaram. HUD continua nítido; modo leve deliberadamente perde brilho e definição 3D.

## Prova final

P1 **humano por Playwright keyboard +3 bots difíceis**, seed3. Uma partida encerrada em cada mapa; primeiros ~12s pilotados a1×, conclusão a24× sem novas teclas (não contada no FPS). Headhunter: ~25s pilotados, depois conclusão acelerada. Sem bots parados >0,25s nas amostras ativas; hard aim oito direções/colisão real preservados nos testes. Respawns/empates e placares conferidos por testes focados e eventos; não alegação de ausência universal de bugs.

| Mapa | FPS real normal | Diagnóstico | Round final |
|---|---:|---:|---:|
| Musgo | 60,002 | 58,482 | 12 |
| Totem | 60,003 | 58,946 | 8 |
| Copas | 60,003 | 59,413 | 13 |
| Cachoeira | 60,002 | 59,413 | 8 |
| Raízes | 60,002 | 59,410 | 7 |

**0 erros** página/console/HTTP; quatro modelos e áudio carregados. Qualidade normal/bloom intactos nos cinco mapas. CPU4 em1600×900 já faz60,003FPS sem precisar reduzir; **CPU4+4K/HiDPI** exercita a redução automática real e termina59,878FPS. Fontes: `evidence/rodada-7/report.json`, `quality-report.json`, `audit.json`.

**Limite explícito:** janela apresentada no Xvnc ficou26–36FPS (OpenGL e Vulkan), não corrigido pelo modo leve. Prova ≥58 usa navegador privado/render isolado com GPU NVIDIA real **dentro de tla**, mesma rota das rodadas4–6. Não alego60FPS da transmissão VNC. Sem tocar navegador humano ou reiniciar Chromium preexistente.

`npm run build`, `check:storybook`, `build-storybook` passaram. **19 testes afetados +3 novas regressões sim +2 texto +4 qualidade**, sem suíte inteira/fuzz. Stories reais e portão em1366×768,900×1000,844×390; ajustes de CTA/resultado baixo após conferir prints. PNGs/folhas em `evidence/rodada-7/` abertos e conferidos; crítica na `ficha-tela.md`.

Tudo via `/tmp/tla-prova.sh` e fila pesada. Dono/PID registrados; finally fecha recursos próprios. **0 abas próprias**,2 abas preexistentes preservadas, previews/Storybook encerrados, fila liberada. Commits no **rodada-astra**, **sem push/publicação**. `evidence/rodada-2/` preservado fora dos commits.
