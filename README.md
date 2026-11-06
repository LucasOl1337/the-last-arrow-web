# The Last Arrow

Jogue em **https://arrow.symbiose.si**. Three.js + TypeScript, sem Unity.

## Jogar

- **Sozinho:** Começar partida; bots configuráveis, cinco arenas e dois modos.
- **Dois no mesmo PC:** escolha 2 jogadores locais.
- **Pela internet:** escolha arena, regras e os dois personagens; **Jogar online → Criar sala → Copiar convite**. O amigo abre o link e toca em Entrar na sala. Duelo de duas pessoas; não precisa instalar nem criar conta.
- **Controles:** menu Controles oferece5layouts e salva sua escolha. Padrão Plataforma+mouse: A/D anda, W pula, S agacha, Espaço esquiva/pega flecha; mouse mira, segure/solte clique esquerdo atira. Alternativas: Espaço pula+Q habilidade, W pula+R habilidade, W pula+H habilidade, ou clássico WASD/J/K/L. Habilidade é a esquiva existente, não poder novo. Cada jogador online usa seu layout no próprio aparelho. Dois locais: mouse só P1; P2 mantém setas e numpad1/2/3 (ou vírgula/ponto/barra). Detalhes/provas em [CONTROLES-2026-11-06.md](CONTROLES-2026-11-06.md).
- **Câmera:** C ou botão alterna próxima/ampla. Próxima é28% maior e segue seu arqueiro. Dois locais começam na ampla.
- **Celular:** deitado, stick/botões. Controle físico também suportado.
- **Online não pausa:** Esc abre menu e solta seus controles, mas a partida continua para o outro. Voltar ao menu sai da sala. Revanche só começa quando ambos pedem.

## Rodar / publicar

Node24+ (servidor usa TypeScript nativo), `npm ci`, `npm run dev`. Servidor: `node server/index.ts`; porta8890 local. Build público: `TLA_BASE=/ npm run build`.

`bash deploy/publish.sh` compila no PC e publica uma release na Hostinger (`ssh sennin-kvm`), sem GitHub Actions. Verifica se há salas antes de iniciar; não publicar durante partida. HTTPS/nginx e serviço dedicado `the-last-arrow.service`. Health: `/health`; revisão: `/version.json`. Releases anteriores em `/opt/the-last-arrow/releases`; `current` aponta a vigente. **Publicação é explícita**, push sozinho não faz deploy.

Teste focado da rede: `node --test tests/online.test.ts`. Câmera: `node --test tests/camera-frame.test.ts`. Storybook: `npm run storybook`. Provas visuais exigem bancada e fila, nunca navegador pessoal.

## Estado e limites

Retomada06/11/2026: online2p com servidor autoritativo120Hz/snapshots30Hz, validação de controles, limites de sala/payload/mensagens, espera do carregamento dos dois, revanche e desconexão. Sem matchmaking, conta, chat, persistência ou reconexão da partida após reload. Sem previsão local/rollback: latência alta ainda pede melhoria.

Animações aprovadas e dez rodadas anteriores preservadas. Provas/pendências em [RETOMADA-2026-11-06.md](RETOMADA-2026-11-06.md). **Não prometer60FPS:** bancada headed mediu~50FPS com uma aba e~26,5FPS com dois renderizadores concorrentes. Resultado no monitor/celular do jogador não foi medido.
