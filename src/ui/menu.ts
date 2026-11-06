import { CHARACTERS } from '../sim/world.ts';
import type { MatchOptions } from '../sim/world.ts';
import { LEVELS } from '../sim/level.ts';
export interface MenuActions { start: (opts: MatchOptions) => void; resume: () => void; rematch: () => void; home: () => void; mute: () => boolean }
export type Screen = 'menu' | 'controls' | 'pause' | 'victory' | 'error';
export class Menu {
  readonly element = document.createElement('section');
  private screen: Screen = 'menu';
  private returnScreen: Screen = 'menu';
  private options: MatchOptions = { humans: 1, bots: 3, map: 'moss', difficulty: 'normal', characters: ['mizu', 'stormdragon', 'kaze', 'akane'] };
  private winner = 'Mizu';
  private muted = false;
  constructor(private actions: MenuActions) {
    this.element.className = 'menu-layer';
    this.element.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const items = this.element.querySelectorAll<HTMLElement>('button, select');
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    this.show('menu');
  }
  show(screen: Screen, winner?: string) {
    this.screen = screen; if (winner) this.winner = winner;
    this.element.hidden = false; this.element.classList.toggle('full-menu', screen === 'menu' || screen === 'controls');
    if (screen === 'menu') this.renderMenu(); else this.renderOverlay();
    this.element.querySelector<HTMLElement>('button, select')?.focus({ preventScroll: true });
  }
  hide() { this.element.hidden = true; }
  private button(label: string, action: () => void, primary = false) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.className = primary ? 'primary' : 'secondary'; button.onclick = action; return button;
  }
  private renderMenu() {
    this.element.innerHTML = `<div class="menu-art" aria-hidden="true"></div><div class="menu-content"><header><p class="eyebrow">UMA ARENA. UMA ÚLTIMA CHANCE.</p><h1>The Last<br><em>Arrow</em><span class="title-arrow">➶</span></h1><p class="tagline">Três flechas. Um acerto. Nenhuma segunda vida.</p></header><form class="match-config" aria-label="Configurar partida"><h2>Entre na arena</h2><div class="fields"></div><div class="menu-actions"></div></form><footer class="menu-foot">PvP local · 2–4 arqueiros · Primeiro a 5 vitórias</footer></div>`;
    const fields = this.element.querySelector('.fields')!;
    const select = (name: string, label: string, values: { value: string; label: string }[], value: string, change: (value: string) => void) => {
      const field = document.createElement('label'); field.htmlFor = name; field.textContent = label;
      const input = document.createElement('select'); input.id = name; input.name = name;
      values.forEach(v => { const option = document.createElement('option'); option.value = v.value; option.textContent = v.label; input.append(option); });
      input.value = value; input.onchange = () => change(input.value); field.append(input); fields.append(field); return input;
    };
    const mode = select('mode', 'Modo', [{ value: '1', label: '1 jogador + bots' }, { value: '2', label: '2 jogadores locais' }, { value: '0', label: 'Assistir · 4 bots' }], String(this.options.humans), v => {
      this.options.humans = Number(v); this.options.bots = 4 - Number(v); this.renderMenu();
      this.element.querySelector<HTMLSelectElement>('#mode')!.focus();
    });
    mode.setAttribute('aria-label', 'Modo');
    const humans = this.options.humans!;
    select('bots', 'Adversários', Array.from({ length: humans === 0 ? 1 : humans === 1 ? 3 : 3 }, (_, n) => {
      const count = humans === 0 ? 4 : humans === 1 ? n + 1 : n;
      return { value: String(count), label: `${count} ${count === 1 ? 'bot' : 'bots'}` };
    }), String(this.options.bots), v => { this.options.bots = Number(v); });
    const characters = CHARACTERS.map(c => ({ value: c.id, label: c.name }));
    select('character1', humans ? 'Seu arqueiro · P1' : 'Arqueiro 1', characters, this.options.characters![0], v => { this.options.characters![0] = v; });
    select('character2', humans === 2 ? 'Arqueiro · P2' : 'Arqueiro rival', characters, this.options.characters![1], v => { this.options.characters![1] = v; });
    select('map', 'Arena', LEVELS.map(l => ({ value: l.id, label: l.name })), this.options.map!, v => { this.options.map = v; });
    select('difficulty', 'Bots', [{ value: 'easy', label: 'Fácil · aprendendo' }, { value: 'normal', label: 'Normal · duelo justo' }, { value: 'hard', label: 'Difícil · sem piedade' }], this.options.difficulty!, v => { this.options.difficulty = v as MatchOptions['difficulty']; });
    const actions = this.element.querySelector('.menu-actions')!;
    const start = this.button('Começar partida  →', () => {}, true); start.type = 'submit'; actions.append(start);
    actions.append(this.button('Controles', () => { this.returnScreen = 'menu'; this.show('controls'); }));
    actions.append(this.soundButton());
    this.element.querySelector('form')!.onsubmit = e => { e.preventDefault(); this.actions.start({ ...this.options, characters: [...this.options.characters!] }); };
  }
  private soundButton() { const button = this.button(this.muted ? 'Som desligado' : 'Som ligado', () => { this.muted = this.actions.mute(); button.textContent = this.muted ? 'Som desligado' : 'Som ligado'; }); return button; }
  private renderOverlay() {
    const panel = document.createElement('div'); panel.className = 'overlay-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', this.screen === 'controls' ? 'Controles' : this.screen === 'pause' ? 'Partida pausada' : this.screen === 'error' ? 'Erro gráfico' : 'Vitória');
    if (this.screen === 'controls') {
      panel.innerHTML = `<p class="eyebrow">CADA FLECHA CONTA</p><h2>Como jogar</h2><table><thead><tr><th>Ação</th><th>Jogador 1</th><th>Jogador 2</th></tr></thead><tbody><tr><td>Mover / mirar</td><td>W A S D</td><td>Setas</td></tr><tr><td>Segurar / soltar tiro</td><td>J</td><td>Numpad 1 / ,</td></tr><tr><td>Pular</td><td>K / Espaço</td><td>Numpad 2 / .</td></tr><tr><td>Esquivar / pegar flecha</td><td>L</td><td>Numpad 3 / /</td></tr></tbody></table><p>Controle: direcional mira, A pula, X/RT atira, B/RB esquiva, Start pausa.</p><p>Segure pulo para subir mais; baixo acelera a queda. Pule contra a parede para escalar.</p><p>Flecha ou pisão mata. Esquive contra flechas para pegá-las; recolha as cravadas. As quatro bordas se conectam.</p><p>Sem vencedor após 90 segundos, o round empata. Primeiro a cinco vitórias ganha a partida.</p><p class="muted">Teclado ou gamepad necessário. No celular, use um controle; prefira a tela deitada.</p>`;
      panel.append(this.button('Voltar', () => this.show(this.returnScreen), true));
    } else if (this.screen === 'pause') {
      panel.innerHTML = '<p class="eyebrow">RESPIRE. MIRE DE NOVO.</p><h2>Partida pausada</h2><p>O combate espera por você.</p>';
      panel.append(this.button('Continuar', this.actions.resume, true), this.button('Controles', () => { this.returnScreen = 'pause'; this.show('controls'); }), this.soundButton(), this.button('Voltar ao menu', this.actions.home));
    } else if (this.screen === 'victory') {
      panel.innerHTML = '<p class="eyebrow">A ÚLTIMA FLECHA TEM DONO</p><h2 class="winner"></h2><p>Cinco vitórias. A arena é sua.</p>';
      panel.querySelector('.winner')!.textContent = `${this.winner} venceu`;
      panel.append(this.button('Revanche  →', this.actions.rematch, true), this.button('Escolher outra arena', this.actions.home));
    } else {
      panel.innerHTML = '<h2>Não foi possível abrir a arena</h2><p>O jogo precisa de WebGL 2. Ative a aceleração gráfica ou tente um navegador atualizado.</p>';
      panel.append(this.button('Tentar novamente', () => location.reload(), true));
    }
    this.element.replaceChildren(panel);
  }
}
