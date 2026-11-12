import * as THREE from 'three';
import type { ArrowKind, SimEvent, World } from '../sim/world.ts';
import { CHARACTERS } from '../sim/world.ts';
import { asset, portrait } from '../paths.ts';
import { VISUAL_HEIGHT } from './fighters.ts';
import { matchStatus } from '../ui/match-copy.ts';
import { fighterName, skillStatus } from './skill-status.ts';
import { layoutHint, readLayout } from '../ui/control-layouts.ts';
import { cameraDirection } from './camera-indicator.ts';

/** Seconds the overhead quiver stays visible after the last ammo change. */
const AMMO_VISIBLE = 1.5;
/** Feet remain at hitbox base; overhead tracks the visual head, not the smaller collider. */
const LABEL_LIFT = VISUAL_HEIGHT - 0.55 + 0.16;
const WIN_SCORE = 5;

interface Overhead { root: HTMLElement; name: HTMLElement; pips: HTMLElement; quiver: string; changedAt: number;
  catchLabel: HTMLElement; catchUntil: number; direction: HTMLElement }

export class Hud {
  readonly element = document.createElement('div');
  private score = document.createElement('div');
  private countdown = document.createElement('div');
  private roundCard = document.createElement('div');
  private footer = document.createElement('div');
  online = false;
  private muteButton = document.createElement('button');
  private qualityNotice = document.createElement('div');
  private cards: HTMLElement[] = [];
  private overheads: Overhead[] = [];
  private signature = '';
  private countKey = '';
  private roundKey = '';
  private fightUntil = 0;
  private lastPhase = '';
  private feedbackRound = 0;
  private projected = new THREE.Vector3();
  /** Called when the HUD mute button is clicked; returns the new muted state. */
  onMute: (() => boolean) | null = null;
  constructor() {
    this.element.className = 'hud'; this.score.className = 'scoreboard';
    this.countdown.className = 'countdown'; this.countdown.setAttribute('aria-live', 'polite');
    this.roundCard.className = 'round-card'; this.roundCard.setAttribute('aria-live', 'polite'); this.roundCard.hidden = true;
    this.footer.className = 'arena-footer';
    this.muteButton.type = 'button'; this.muteButton.className = 'mute-toggle'; this.muteButton.title = 'Ligar ou desligar som';
    this.muteButton.addEventListener('click', () => this.setMuted(this.onMute?.() ?? false));
    this.setMuted(false);
    this.qualityNotice.className = 'quality-notice'; this.qualityNotice.hidden = true;
    this.qualityNotice.setAttribute('role', 'status');
    this.element.append(this.score, this.countdown, this.roundCard, this.footer, this.muteButton, this.qualityNotice);
  }
  setMuted(muted: boolean) {
    this.muteButton.textContent = muted ? '🔇 Som' : '🔊 Som';
    this.muteButton.setAttribute('aria-label', muted ? 'Ligar som' : 'Desligar som');
    this.muteButton.setAttribute('aria-pressed', String(muted));
  }
  setLowQuality(low: boolean) {
    this.qualityNotice.hidden = !low;
    this.qualityNotice.textContent = low ? 'Modo leve · ajuste automático' : '';
  }
  reset(w: World) {
    this.score.replaceChildren(); this.overheads.forEach(o => o.root.remove());
    this.signature = this.countKey = this.roundKey = this.lastPhase = ''; this.fightUntil = 0; this.roundCard.hidden = true;
    this.feedbackRound = w.round;
    this.cards = w.fighters.map(f => {
      const c = CHARACTERS[f.character], card = document.createElement('div'); card.className = 'score-card'; card.style.setProperty('--fighter', c.color);
      card.innerHTML = `<img class="fighter-icon" src="${portrait(c.id)}" alt=""><div><b>${fighterName(c.id,c.name)}</b><small>${f.human ? `P${f.id + 1}` : `BOT ${f.id + 1}`} <span class="ammo"></span></small><small class="skill-status"></small></div><strong class="points">0</strong>`;
      this.score.append(card); return card;
    });
    this.overheads = w.fighters.map(f => {
      const root = document.createElement('div'); root.className = 'overhead'; root.style.setProperty('--fighter', CHARACTERS[f.character].color);
      const pips = document.createElement('div'); pips.className = 'quiver-pips';
      const name = document.createElement('div'); name.className = 'fighter-label';
      const direction = document.createElement('span'); direction.className = 'wrap-direction'; direction.hidden = true;
      direction.setAttribute('aria-hidden', 'true');
      name.append(direction, document.createTextNode(String(f.id + 1)));
      name.setAttribute('aria-label', `Jogador ${f.id + 1} · ${fighterName(CHARACTERS[f.character].id, CHARACTERS[f.character].name)} fora da tela`);
      const catchLabel = document.createElement('div'); catchLabel.className = 'catch-label'; catchLabel.hidden = true;
      catchLabel.textContent = 'PEGOU!';
      root.append(catchLabel, pips, name); this.element.append(root);
      return { root, name, pips, quiver: '', changedAt: -Infinity, catchLabel, catchUntil: 0, direction };
    });
  }
  event(event: SimEvent, now = performance.now() / 1000) {
    const overhead = this.overheads[event.actor];
    if (event.type === 'catch' && overhead) overhead.catchUntil = now + 0.55;
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
    if (w.round === 1 && w.options.humans > 0) {
      const hint = document.createElement('div'); hint.className = 'controls-hint';
      hint.textContent = matchMedia('(pointer: coarse)').matches
        ? 'Stick: mover / mirar · Segure e solte Atirar · Pular · Dash pega flechas'
        : layoutHint(readLayout());
      box.append(hint);
    }
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
    this.roundCard.querySelector('.round-title')!.textContent = c ? `${fighterName(c.id,c.name)} vence o round` : 'Empate';
    const dots = this.roundCard.querySelector('.round-dots')!;
    w.fighters.forEach(f => {
      const row = document.createElement('div'); row.className = 'dot-row'; row.style.setProperty('--fighter', CHARACTERS[f.character].color);
      const label = document.createElement('span'); label.textContent = fighterName(CHARACTERS[f.character].id,CHARACTERS[f.character].name); row.append(label);
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
    const signature = `${w.options.mode}:${w.phase}:${w.round}:${w.winner}:${Math.ceil(w.matchTime)}:${Math.floor(w.roundTime)}:${w.fighters.map(f => `${f.ammo},${f.score},${f.alive}`).join(':')}`;
    if (signature !== this.signature) {
      this.signature = signature;
      w.fighters.forEach((f, n) => {
        this.cards[n].classList.toggle('eliminated', !f.alive);
        this.cards[n].querySelector('.points')!.textContent = String(f.score);
        this.cards[n].querySelector('.ammo')!.textContent = '➶'.repeat(f.ammo) || 'sem flechas';
      });
      this.footer.textContent = `${w.level.name}   /   ${matchStatus(w)}${matchMedia('(pointer: coarse)').matches ? '' : this.online ? '   /   Online · sem pausa' : '   /   Esc pausa'}`;
    }
    w.fighters.forEach((f,n)=>{
      const status=skillStatus(f), element=this.cards[n].querySelector<HTMLElement>('.skill-status')!;
      const text = f.alive && f.invulnerable > 0 ? 'Proteção' : status.text;
      if(element.textContent!==text)element.textContent=text;
      element.classList.toggle('active',status.active);
    });
    this.renderCountdown(w, now);
    this.renderRoundCard(w);
    this.countdown.hidden = this.roundCard.hidden === false || paused;
    if (w.round !== this.feedbackRound) {
      this.feedbackRound = w.round; this.overheads.forEach(o => { o.catchUntil = 0; });
    }
    const anchors: { overhead: Overhead; x: number; y: number }[] = [];
    w.fighters.forEach((f, n) => {
      const o = this.overheads[n]; o.root.hidden = !f.alive;
      if (!f.alive) { o.catchUntil = 0; return; }
      o.catchLabel.hidden = now >= o.catchUntil;
      // Use the actual camera and visual silhouette: near-camera clipping can happen far from a map seam.
      const height = f.crouching ? VISUAL_HEIGHT * .58 : VISUAL_HEIGHT;
      const feet = 18 - f.y - (f.crouching ? .30 : .55);
      this.projected.set(f.x - .6, feet + height, .6).project(camera);
      const left = (this.projected.x + 1) / 2, top = (1 - this.projected.y) / 2;
      this.projected.set(f.x + .6, feet, .6).project(camera);
      const direction = cameraDirection({ left, top, right: (this.projected.x + 1) / 2, bottom: (1 - this.projected.y) / 2 });
      // Names stay in the scoreboard; only a clipped body needs a locator.
      o.name.hidden = !direction;
      o.root.classList.toggle('offscreen', !!direction);
      o.root.dataset.direction = direction;
      if (o.direction.textContent !== direction) o.direction.textContent = direction;
      o.direction.hidden = !direction;
      const quiver = this.quiverOf(f), sig = quiver.join(',');
      if (sig !== o.quiver) {
        // Round start shows the quiver too (empty → 3 arrows counts as a change).
        o.quiver = sig; o.changedAt = now;
        o.pips.replaceChildren(...quiver.map(kind => { const pip = document.createElement('i'); pip.className = `pip ${kind}`; return pip; }));
        if (!quiver.length) { const empty = document.createElement('b'); empty.className = 'pip-empty'; empty.textContent = '0'; o.pips.append(empty); }
      }
      o.pips.classList.toggle('shown', now - o.changedAt < AMMO_VISIBLE || f.charging);
      this.projected.set(f.x, 18 - f.y + (f.crouching ? VISUAL_HEIGHT*.58-.30+.16 : LABEL_LIFT), 0.6).project(camera);
      anchors.push({ overhead: o, x: (this.projected.x + 1) * 0.5, y: (1 - this.projected.y) * 0.5 });
    });
    this.placeOverheads(anchors);
  }
  private placeOverheads(anchors: { overhead: Overhead; x: number; y: number }[]) {
    // Read dimensions together, then write together (no per-player layout thrashing).
    const area = this.element.getBoundingClientRect(), gap = 5;
    if (!area.width || !area.height) return;
    const rect = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - area.left, y: r.top - area.top, width: r.width, height: r.height };
    };
    const blocked = [rect(this.score), rect(this.footer), rect(this.muteButton)];
    const cameraButton = this.element.parentElement?.querySelector<HTMLElement>('.camera-toggle');
    if (cameraButton) blocked.push(rect(cameraButton));
    if (!this.qualityNotice.hidden) blocked.push(rect(this.qualityNotice));
    // Portrait HUD rails live outside the canvas. Project and clamp labels to
    // the rendered viewport, not the larger HUD container that includes those rails.
    const canvas = this.element.parentElement?.querySelector('canvas');
    const view = canvas ? rect(canvas) : { x: 0, y: 0, width: area.width, height: area.height };
    const measured = anchors.map(a => ({ ...a, width: a.overhead.root.offsetWidth, height: a.overhead.root.offsetHeight }));
    for (const a of measured) {
      const clampY = (y: number) => THREE.MathUtils.clamp(y, view.y + gap, view.y + view.height - a.height - gap);
      const x = THREE.MathUtils.clamp(view.x + a.x * view.width - a.width / 2, view.x + gap, view.x + view.width - a.width - gap);
      const idealY = clampY(view.y + a.y * view.height - a.height);
      const relevant = blocked.filter(b => x < b.x + b.width + gap && x + a.width + gap > b.x);
      // Candidate lanes immediately above/below occupied rects, nearest the actual head first.
      const candidates = [idealY, gap, ...relevant.flatMap(b => [b.y - a.height - gap, b.y + b.height + gap])]
        .map(clampY).sort((a, b) => Math.abs(a - idealY) - Math.abs(b - idealY));
      const y = candidates.find(y => relevant.every(b => y + a.height + gap <= b.y || y >= b.y + b.height + gap)) ?? idealY;
      a.overhead.root.style.left = `${x}px`; a.overhead.root.style.top = `${y}px`;
      blocked.push({ x, y, width: a.width, height: a.height });
    }
  }
}
