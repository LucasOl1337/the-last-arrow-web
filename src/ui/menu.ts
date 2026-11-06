import { CHARACTERS } from '../sim/world.ts';
import type { MatchOptions } from '../sim/world.ts';
import { LEVELS, themeOf } from '../sim/level.ts';
import { asset, portrait } from '../paths.ts';
import { victorySummary } from './match-copy.ts';
export interface MenuActions { start: (opts: MatchOptions) => void; resume: () => void; rematch: () => void; home: () => void; mute: () => boolean; online?: () => void }
export type Screen = 'menu' | 'controls' | 'pause' | 'victory' | 'error' | 'recovering';
export interface VictoryStats { kills: number; catches: number; stomps: number; score: number; mode?: MatchOptions['mode'] }
/** Menu thumbnails reuse the arena backgrounds. */
const MAP_THUMBS: Record<string, string> = { moss: 'bg/ruins.jpg', totem: 'bg/templo.jpg', canopy: 'bg/copas.jpg' };
const MAP_LABELS: Record<string, string> = { moss: 'Musgo', totem: 'Totem', canopy: 'Copas', falls: 'Cachoeira', roots: 'Raízes' };
const DIFFICULTIES = [{ value: 'easy', label: 'Fácil', hint: 'aprendendo' }, { value: 'normal', label: 'Normal', hint: 'duelo justo' }, { value: 'hard', label: 'Difícil', hint: 'sem piedade' }] as const;
export class Menu {
  readonly element = document.createElement('section');
  private screen: Screen = 'menu';
  private returnScreen: Screen = 'menu';
  private options: MatchOptions = { humans: 1, bots: 3, map: 'moss', difficulty: 'normal', characters: ['mizu', 'stormdragon', 'kaze', 'akane'] };
  private winner: string | null = 'Mizu';
  private stats: VictoryStats | null = null;
  private muted = false;
  constructor(private actions: MenuActions) {
    this.element.className = 'menu-layer';
    // Injected from TS so the URL follows BASE_URL (GitHub Pages subpath) instead of a root-absolute CSS url.
    document.documentElement.style.setProperty('--key-art', `url('${new URL(asset('bg/key.jpg'), document.baseURI).href}')`);
    this.element.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const items = this.element.querySelectorAll<HTMLElement>('button:not([tabindex="-1"]), select');
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    this.show('menu');
  }
  show(screen: Screen, winner?: string, stats?: VictoryStats) {
    this.screen = screen;
    if (screen === 'victory') { this.winner = winner ?? null; this.stats = stats ?? null; }
    else if (winner) this.winner = winner;
    this.element.hidden = false; this.element.classList.toggle('full-menu', screen === 'menu' || screen === 'controls');
    if (screen === 'menu') this.renderMenu(); else this.renderOverlay();
    this.element.querySelector<HTMLElement>('button, select')?.focus({ preventScroll: true });
  }
  hide() { this.element.hidden = true; }
  setMuted(muted: boolean) {
    this.muted = muted;
    this.element.querySelectorAll<HTMLButtonElement>('[data-sound]').forEach(button => {
      button.textContent = muted ? 'Som desligado' : 'Som ligado';
      button.setAttribute('aria-pressed', String(muted));
    });
  }
  private button(label: string, action: () => void, primary = false) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.className = primary ? 'primary' : 'secondary'; button.onclick = action; return button;
  }
  private renderMenu() {
    this.element.innerHTML = `<div class="menu-art" aria-hidden="true"></div><div class="menu-content"><header><p class="eyebrow">UMA ARENA. UMA ÚLTIMA CHANCE.</p><h1 class="logo-title"><img class="logo" src="${asset('ui/logo.png')}" alt="The Last Arrow" width="1100" height="457"></h1><p class="tagline">Três flechas. Um acerto. Nenhuma segunda vida.</p></header><form class="match-config" aria-label="Configurar partida"><h2>Entre na arena</h2><div class="fields"></div><div class="menu-actions"></div></form><footer class="menu-foot">PvP local · 2–4 arqueiros · Primeiro a 5 vitórias</footer></div>`;
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
    select('rules', 'Regras', [{ value: 'versus', label: 'Versus · 5 vitórias' }, { value: 'headhunter', label: 'Headhunter · 2 min' }], this.options.mode ?? 'versus', v => {
      this.options.mode = v as MatchOptions['mode']; this.updateRuleCopy();
    });
    const humans = this.options.humans!;
    select('bots', 'Adversários', Array.from({ length: humans === 0 ? 1 : humans === 1 ? 3 : 3 }, (_, n) => {
      const count = humans === 0 ? 4 : humans === 1 ? n + 1 : n;
      return { value: String(count), label: `${count} ${count === 1 ? 'bot' : 'bots'}` };
    }), String(this.options.bots), v => { this.options.bots = Number(v); });
    // Portrait pickers (radio groups of buttons): arrow keys move inside a group, Tab leaves it.
    const group = (name: string, label: string, wide: boolean, items: { value: string; html: string; label: string; style?: string }[], value: string, change: (value: string) => void) => {
      const field = document.createElement('div'); field.className = `picker-field${wide ? ' wide' : ''}`;
      const title = document.createElement('span'); title.className = 'picker-label'; title.id = `${name}-label`; title.textContent = label;
      const row = document.createElement('div'); row.className = `picker ${name}`; row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-labelledby', title.id); row.id = name;
      const buttons = items.map(item => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'pick'; b.dataset.value = item.value;
        b.setAttribute('role', 'radio'); b.setAttribute('aria-label', item.label); b.innerHTML = item.html; if (item.style) b.setAttribute('style', item.style);
        b.onclick = () => select(item.value, true); return b;
      });
      const select = (v: string, focus = false) => {
        buttons.forEach(b => { const on = b.dataset.value === v; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
        change(v);
      };
      row.addEventListener('keydown', event => {
        const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
        if (!delta) return; event.preventDefault();
        const index = buttons.findIndex(b => b.getAttribute('aria-checked') === 'true');
        select(buttons[(index + delta + buttons.length) % buttons.length].dataset.value!, true);
      });
      row.append(...buttons); field.append(title, row); fields.append(field); select(value);
    };
    const portraits = CHARACTERS.map(c => ({ value: c.id, label: c.name, style: `--fighter:${c.color}`,
      html: `<img src="${portrait(c.id)}" alt="" width="56" height="56"><span>${c.name === 'Stormdragon' ? 'Storm' : c.name}</span>` }));
    group('character1', humans ? 'Seu arqueiro · P1' : 'Arqueiro 1', false, portraits, this.options.characters![0], v => { this.options.characters![0] = v; });
    group('character2', humans === 2 ? 'Arqueiro · P2' : 'Arqueiro rival', false, portraits, this.options.characters![1], v => { this.options.characters![1] = v; });
    group('map', 'Arena', false, LEVELS.map(l => ({ value: l.id, label: l.name,
      html: `<img src="${asset(MAP_THUMBS[themeOf(l.id)])}" alt="" width="96" height="54"><span>${MAP_LABELS[l.id]}</span>` })), this.options.map!, v => { this.options.map = v; });
    group('difficulty', 'Bots', false, DIFFICULTIES.map(d => ({ value: d.value, label: `${d.label} · ${d.hint}`, html: `<b>${d.label}</b><small>${d.hint}</small>` })), this.options.difficulty!, v => { this.options.difficulty = v as MatchOptions['difficulty']; });
    if (matchMedia('(pointer: coarse)').matches) {
      const note = document.createElement('p'); note.className = 'touch-note'; note.textContent = 'Tela deitada · Stick move e mira · Segure e solte Atirar.';
      fields.append(note);
    }
    const actions = this.element.querySelector('.menu-actions')!;
    const start = this.button('Começar partida  →', () => {}, true); start.type = 'submit'; actions.append(start);
    actions.append(this.button('Controles', () => { this.returnScreen = 'menu'; this.show('controls'); }));
    actions.append(this.soundButton());
    if (this.actions.online) { const online = this.button('Jogar online', this.actions.online); online.style.gridColumn = '1 / -1'; actions.append(online); }
    this.element.querySelector('form')!.onsubmit = e => { e.preventDefault(); this.actions.start({ ...this.options, characters: [...this.options.characters!] }); };
    this.updateRuleCopy();
  }
  private updateRuleCopy() {
    const headhunter = this.options.mode === 'headhunter';
    this.element.querySelector('.tagline')!.textContent = headhunter ? 'Dois minutos. Cada abate conta. Volte à luta.' : 'Três flechas. Um acerto. Nenhuma segunda vida.';
    this.element.querySelector('.menu-foot')!.textContent = `PvP local · 2–4 arqueiros · ${headhunter ? 'Mais abates em 2 minutos · reaparece em 1,5s' : 'Primeiro a 5 vitórias'}`;
  }
  private soundButton() {
    const button = this.button(this.muted ? 'Som desligado' : 'Som ligado', () => this.setMuted(this.actions.mute()));
    button.dataset.sound = ''; button.setAttribute('aria-pressed', String(this.muted));
    return button;
  }
  private renderOverlay() {
    const panel = document.createElement('div'); panel.className = 'overlay-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', this.screen === 'controls' ? 'Controles' : this.screen === 'pause' ? 'Partida pausada' : this.screen === 'error' || this.screen === 'recovering' ? 'Erro gráfico' : 'Vitória');
    if (this.screen === 'controls') {
      panel.innerHTML = `<p class="eyebrow">CADA FLECHA CONTA</p><h2>Como jogar</h2><table><thead><tr><th>Ação</th><th>Jogador 1</th><th>Jogador 2</th></tr></thead><tbody><tr><td>Mover / mirar</td><td>W A S D</td><td>Setas</td></tr><tr><td>Segurar / soltar tiro</td><td>J</td><td>Numpad 1 / ,</td></tr><tr><td>Pular</td><td>K / Espaço</td><td>Numpad 2 / .</td></tr><tr><td>Esquivar / pegar flecha</td><td>L</td><td>Numpad 3 / /</td></tr></tbody></table><p>Controle: direcional mira, A pula, X/RT atira, B/RB esquiva, Start pausa.</p><p>Segure pulo para subir mais; baixo acelera a queda. Pule contra a parede para escalar.</p><p>Flecha ou pisão mata. Esquive contra flechas para pegá-las; recolha as cravadas. As quatro bordas se conectam.</p><p>Versus: primeiro a cinco vitórias; round empata após 90 segundos.</p><p>Headhunter: mais abates em dois minutos; reaparece após 1,5 segundo. Placar igual empata.</p><p class="muted">No celular: tela deitada, stick move e mira. Segure e solte Atirar; Dash pega flechas.</p>`;
      panel.append(this.button('Voltar', () => this.show(this.returnScreen), true));
    } else if (this.screen === 'pause') {
      panel.innerHTML = '<p class="eyebrow">RESPIRE. MIRE DE NOVO.</p><h2>Partida pausada</h2><p>O combate espera por você.</p>';
      panel.append(this.button('Continuar', this.actions.resume, true), this.button('Controles', () => { this.returnScreen = 'pause'; this.show('controls'); }), this.soundButton(), this.button('Voltar ao menu', this.actions.home));
    } else if (this.screen === 'victory') {
      const winner = CHARACTERS.find(c => c.name === this.winner);
      panel.classList.add('victory-panel');
      if (winner) panel.style.setProperty('--fighter', winner.color);
      const s = this.stats;
      const stat = (value: number, label: string) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`;
      panel.innerHTML = `<img class="victory-logo" src="${asset('ui/logo.png')}" alt="" aria-hidden="true"><div class="victory-row">${winner ? `<img class="victory-portrait" src="${portrait(winner.id)}" alt="">` : ''}<div><p class="eyebrow">A ÚLTIMA FLECHA TEM DONO</p><h2 class="winner"></h2><p>${victorySummary(s?.mode, s?.score ?? 0, !!winner)}</p>${s && winner ? `<div class="victory-stats">${stat(s.kills, s.kills === 1 ? 'abate' : 'abates')}${stat(s.catches, s.catches === 1 ? 'flecha pega' : 'flechas pegas')}${s.stomps ? stat(s.stomps, s.stomps === 1 ? 'pisão' : 'pisões') : ''}</div>` : ''}</div></div>`;
      panel.querySelector('.winner')!.textContent = winner ? `${winner.name} venceu` : 'Empate';
      panel.append(this.button('Revanche  →', this.actions.rematch, true), this.button('Escolher outra arena', this.actions.home));
    } else if (this.screen === 'recovering') {
      panel.innerHTML = '<h2>Imagem interrompida</h2><p>O placar está salvo nesta partida. Ao recuperar a imagem, você poderá continuar.</p>';
      panel.append(this.button('Recarregar se não voltar', () => location.reload()));
    } else {
      panel.innerHTML = '<h2>Não foi possível abrir a arena</h2><p>O jogo precisa de WebGL 2. Ative a aceleração gráfica ou tente um navegador atualizado.</p>';
      panel.append(this.button('Tentar novamente', () => location.reload(), true));
    }
    this.element.replaceChildren(panel);
  }
}
