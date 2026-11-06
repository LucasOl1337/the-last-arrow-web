import * as THREE from 'three';
import type { ArrowKind, World } from '../sim/world.ts';
import { CHARACTERS } from '../sim/world.ts';
import { asset, portrait } from '../paths.ts';
import { VISUAL_HEIGHT } from './fighters.ts';

/** Seconds the overhead quiver stays visible after the last ammo change. */
const AMMO_VISIBLE = 1.5;
/** Feet remain at hitbox base; overhead tracks the visual head, not the smaller collider. */
const LABEL_LIFT = VISUAL_HEIGHT - 0.55 + 0.16;
const WIN_SCORE = 5;

interface Overhead { root: HTMLElement; name: HTMLElement; pips: HTMLElement; quiver: string; changedAt: number }

export class Hud {
  readonly element = document.createElement('div');
  private score = document.createElement('div');
  private countdown = document.createElement('div');
  private roundCard = document.createElement('div');
  private footer = document.createElement('div');
  private muteButton = document.createElement('button');
  private cards: HTMLElement[] = [];
  private overheads: Overhead[] = [];
  private signature = '';
  private countKey = '';
  private roundKey = '';
  private fightUntil = 0;
  private lastPhase = '';
  private projected = new THREE.Vector3();
  /** Called when the HUD mute button is clicked; returns the new muted state. */
  onMute: (() => boolean) | null = null;
  constructor() {
    this.element.className = 'hud'; this.score.className = 'scoreboard';
    this.countdown.className = 'countdown'; this.countdown.setAttribute('aria-live', 'polite');
    this.roundCard.className = 'round-card'; this.roundCard.setAttribute('aria-live', 'polite'); this.roundCard.hidden = true;
    this.footer.className = 'arena-footer';
    this.muteButton.type = 'button'; this.muteButton.className = 'mute-toggle'; this.muteButton.title = 'Som (M)';
    this.muteButton.addEventListener('click', () => this.setMuted(this.onMute?.() ?? false));
    this.setMuted(false);
    this.element.append(this.score, this.countdown, this.roundCard, this.footer, this.muteButton);
  }
  setMuted(muted: boolean) {
    this.muteButton.textContent = muted ? '🔇 M' : '🔊 M';
    this.muteButton.setAttribute('aria-label', muted ? 'Ligar som (M)' : 'Desligar som (M)');
    this.muteButton.setAttribute('aria-pressed', String(muted));
  }
  reset(w: World) {
    this.score.replaceChildren(); this.overheads.forEach(o => o.root.remove());
    this.signature = this.countKey = this.roundKey = this.lastPhase = ''; this.fightUntil = 0; this.roundCard.hidden = true;
    this.cards = w.fighters.map(f => {
      const c = CHARACTERS[f.character], card = document.createElement('div'); card.className = 'score-card'; card.style.setProperty('--fighter', c.color);
      card.innerHTML = `<img class="fighter-icon" src="${portrait(c.id)}" alt=""><div><b>${c.name}</b><small>${f.human ? `P${f.id + 1}` : 'BOT'} <span class="ammo"></span></small></div><strong class="points">0</strong>`;
      this.score.append(card); return card;
    });
    this.overheads = w.fighters.map(f => {
      const root = document.createElement('div'); root.className = 'overhead'; root.style.setProperty('--fighter', CHARACTERS[f.character].color);
      const pips = document.createElement('div'); pips.className = 'quiver-pips';
      const name = document.createElement('div'); name.className = 'fighter-label';
      name.textContent = f.human ? `P${f.id + 1}` : CHARACTERS[f.character].name;
      root.append(pips, name); this.element.append(root);
      return { root, name, pips, quiver: '', changedAt: -Infinity };
    });
  }
  private quiverOf(f: World['fighters'][number]): ArrowKind[] {
    const inv = f.inventory && f.inventory.length === f.ammo ? f.inventory : Array.from({ length: f.ammo }, () => 'normal' as ArrowKind);
    return inv;
  }
  private renderCountdown(w: World, now: number) {
    const digit = w.phase === 'countdown' ? (w.countdown ?? Math.ceil(w.phaseTime)) : 0;
    if (this.lastPhase === 'countdown' && w.phase === 'playing') this.fightUntil = now + 0.7;
    this.lastPhase = w.phase;
    const text = w.phase === 'countdown' && digit > 0 ? String(digit) : now < this.fightUntil && w.phase === 'playing' ? 'LUTEM!' : '';
    const key = `${w.round}:${text}`;
    if (key === this.countKey) return;
    this.countKey = key;
    if (!text) { this.countdown.replaceChildren(); return; }
    // Re-creating the node restarts the pop animation for each digit.
    const box = document.createElement('div'); box.className = `count-pop${text === 'LUTEM!' ? ' fight' : ''}`;
    box.innerHTML = `<img class="count-logo" src="${asset('ui/logo.png')}" alt=""><span class="count-text"></span><small class="count-round">ROUND ${w.round}</small>`;
    box.querySelector('.count-text')!.textContent = text;
    this.countdown.replaceChildren(box);
  }
  private renderRoundCard(w: World) {
    const key = w.phase === 'roundover' ? `${w.round}:${w.winner}` : '';
    if (key === this.roundKey) return;
    this.roundKey = key;
    this.roundCard.hidden = !key;
    if (!key) return;
    const winner = w.winner === null ? null : w.fighters[w.winner];
    const c = winner ? CHARACTERS[winner.character] : null;
    this.roundCard.style.setProperty('--fighter', c?.color ?? '#e7c887');
    this.roundCard.innerHTML = `${c ? `<img class="round-portrait" src="${portrait(c.id)}" alt="">` : ''}<div class="round-title"></div><div class="round-dots"></div>`;
    this.roundCard.querySelector('.round-title')!.textContent = c ? `${c.name} vence o round` : 'Empate';
    const dots = this.roundCard.querySelector('.round-dots')!;
    w.fighters.forEach(f => {
      const row = document.createElement('div'); row.className = 'dot-row'; row.style.setProperty('--fighter', CHARACTERS[f.character].color);
      const label = document.createElement('span'); label.textContent = CHARACTERS[f.character].name; row.append(label);
      for (let n = 0; n < WIN_SCORE; n++) {
        const dot = document.createElement('i');
        const lit = n < f.score, fresh = winner === f && n === f.score - 1;
        dot.className = lit ? (fresh ? 'lit fresh' : 'lit') : '';
        // Lit dots switch on one after another; the freshly won one lands last with a pulse.
        dot.style.animationDelay = `${0.12 + n * 0.08 + (fresh ? 0.25 : 0)}s`;
        row.append(dot);
      }
      dots.append(row);
    });
  }
  update(w: World, paused: boolean, camera: THREE.Camera, now = performance.now() / 1000) {
    const signature = `${w.phase}:${w.round}:${w.winner}:${Math.floor(w.roundTime)}:${w.fighters.map(f => `${f.ammo},${f.score},${f.alive}`).join(':')}`;
    if (signature !== this.signature) {
      this.signature = signature;
      w.fighters.forEach((f, n) => {
        this.cards[n].classList.toggle('eliminated', !f.alive);
        this.cards[n].querySelector('.points')!.textContent = String(f.score);
        this.cards[n].querySelector('.ammo')!.textContent = '➶'.repeat(f.ammo) || 'sem flechas';
      });
      this.footer.textContent = `${w.level.name}   /   Primeiro a 5   /   ${Math.max(0, 90 - Math.floor(w.roundTime))}s   /   Esc pausa   /   M som`;
    }
    this.renderCountdown(w, now);
    this.renderRoundCard(w);
    this.countdown.hidden = this.roundCard.hidden === false || paused;
    w.fighters.forEach((f, n) => {
      const o = this.overheads[n]; o.root.hidden = !f.alive;
      if (!f.alive) return;
      const quiver = this.quiverOf(f), sig = quiver.join(',');
      if (sig !== o.quiver) {
        // Round start shows the quiver too (empty → 3 arrows counts as a change).
        o.quiver = sig; o.changedAt = now;
        o.pips.replaceChildren(...quiver.map(kind => { const pip = document.createElement('i'); pip.className = `pip ${kind}`; return pip; }));
        if (!quiver.length) { const empty = document.createElement('b'); empty.className = 'pip-empty'; empty.textContent = '0'; o.pips.append(empty); }
      }
      o.pips.classList.toggle('shown', now - o.changedAt < AMMO_VISIBLE || f.charging);
      this.projected.set(f.x, 18 - f.y + LABEL_LIFT, 0.6).project(camera);
      o.root.style.left = `${(this.projected.x + 1) * 50}%`; o.root.style.top = `${(1 - this.projected.y) * 50}%`;
    });
  }
}
