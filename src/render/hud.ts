import * as THREE from 'three';
import type { World } from '../sim/world.ts';
import { CHARACTERS } from '../sim/world.ts';
export class Hud {
  readonly element = document.createElement('div');
  private score = document.createElement('div');
  private banner = document.createElement('div');
  private footer = document.createElement('div');
  private cards: HTMLElement[] = [];
  private labels: HTMLElement[] = [];
  private signature = '';
  private projected = new THREE.Vector3();
  constructor() {
    this.element.className = 'hud'; this.score.className = 'scoreboard'; this.banner.className = 'round-banner'; this.banner.setAttribute('aria-live', 'polite');
    this.footer.className = 'arena-footer'; this.element.append(this.score, this.banner, this.footer);
  }
  reset(w: World) {
    this.score.replaceChildren(); this.labels.forEach(l => l.remove()); this.signature = '';
    this.cards = w.fighters.map(f => {
      const c = CHARACTERS[f.character], card = document.createElement('div'); card.className = 'score-card'; card.style.setProperty('--fighter', c.color);
      card.innerHTML = `<span class="fighter-icon">${c.name[0]}</span><div><b>${c.name}</b><small>${f.human ? `P${f.id + 1}` : 'BOT'} <span class="ammo"></span></small></div><strong class="points">0</strong>`;
      this.score.append(card); return card;
    });
    this.labels = w.fighters.map(f => {
      const label = document.createElement('div'); label.className = 'fighter-label'; label.style.color = CHARACTERS[f.character].color;
      label.textContent = f.human ? `P${f.id + 1}` : CHARACTERS[f.character].name; this.element.append(label); return label;
    });
  }
  update(w: World, paused: boolean, camera: THREE.Camera) {
    const signature = `${w.phase}:${w.countdown ?? Math.ceil(w.phaseTime)}:${w.round}:${w.winner}:${Math.floor(w.roundTime)}:${w.fighters.map(f => `${f.ammo},${f.score},${f.alive}`).join(':')}`;
    if (signature !== this.signature) {
      this.signature = signature;
      w.fighters.forEach((f, n) => {
        this.cards[n].classList.toggle('eliminated', !f.alive);
        this.cards[n].querySelector('.points')!.textContent = String(f.score);
        this.cards[n].querySelector('.ammo')!.textContent = '➶'.repeat(f.ammo) || 'sem flechas';
      });
      this.banner.textContent = w.phase === 'countdown' ? `ROUND ${w.round} · ${w.countdown ?? Math.ceil(w.phaseTime)}` : w.phase === 'roundover' ? (w.winner === null ? 'EMPATE' : `${CHARACTERS[w.fighters[w.winner].character].name.toUpperCase()} +1`) : '';
      this.footer.textContent = `${w.level.name}   /   Primeiro a 5   /   ${Math.max(0, 90 - Math.floor(w.roundTime))}s   /   Esc pausa`;
    }
    this.banner.hidden = paused;
    w.fighters.forEach((f, n) => {
      const l = this.labels[n]; l.hidden = !f.alive;
      this.projected.set(f.x, 18 - f.y + 1.15, 0.6).project(camera);
      l.style.left = `${(this.projected.x + 1) * 50}%`; l.style.top = `${(1 - this.projected.y) * 50}%`;
    });
  }
}
