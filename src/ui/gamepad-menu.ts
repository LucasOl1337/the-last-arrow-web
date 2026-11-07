import './gamepad.css';
import type { MenuInput } from '../input/gamepad.ts';

/** Operates the real menu controls; pointer/keyboard listeners remain unchanged. */
export function navigateGamepad(root: HTMLElement, action: MenuInput): void {
  const items = [...root.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]),select,input,summary')]
    .filter(el => !el.closest('[hidden]') && el.getClientRects().length > 0);
  if (!items.length) return;
  let current = document.activeElement as HTMLElement;
  if (!items.includes(current)) { current = items[0]; current.focus({ preventScroll: true }); }
  if (action === 'confirm') {
    if (current instanceof HTMLSelectElement) return;
    current.click(); return;
  }
  const delta = action === 'right' || action === 'down' ? 1 : action === 'left' || action === 'up' ? -1 : 0;
  if (!delta) return;
  if ((action === 'left' || action === 'right') && current instanceof HTMLSelectElement) {
    const options = [...current.options].filter(o => !o.disabled);
    // Selected index is read by value, since disabled options need not be contiguous.
    const selected = options.findIndex(o => o.value === current.value);
    const next = options[(selected + delta + options.length) % options.length];
    if (next) { current.value = next.value; current.dispatchEvent(new Event('change', { bubbles: true })); }
    return;
  }
  if ((action === 'left' || action === 'right') && current.closest('[role="radiogroup"]')) {
    current.dispatchEvent(new KeyboardEvent('keydown', { key: delta > 0 ? 'ArrowRight' : 'ArrowLeft', bubbles: true })); return;
  }
  const next = items[(items.indexOf(current) + delta + items.length) % items.length];
  next.focus(); next.scrollIntoView({ block: 'nearest' });
}

export function gamepadStatus(slots: readonly (number | null)[], unsupported = 0): string {
  const connected = slots.flatMap((index, slot) => index === null ? [] : [`P${slot + 1}`]);
  if (!connected.length) return unsupported ? 'Controle sem mapeamento padrão · use teclado/mouse ou modo standard.' : 'PS5 / Xbox: conecte e pressione um botão; solte para ativar.';
  return `Controle ${connected.join(' + ')} · A/× confirma · B/○ volta · Start/Options pausa`;
}
export function gamepadHelp(): HTMLElement {
  const details = document.createElement('details'); details.className = 'gamepad-help';
  details.innerHTML = '<summary>PS5 / Xbox · botões de TowerFall</summary><table><tbody><tr><th>Mover / mirar</th><td>Stick esquerdo ou direcional</td></tr><tr><th>Pular</th><td>A / ×</td></tr><tr><th>Atirar</th><td>X / □ ou B / ○ · segure e solte</td></tr><tr><th>Esquivar / pegar</th><td>LB/RB/LT/RT · L1/R1/L2/R2</td></tr><tr><th>Pausar</th><td>Start / Options</td></tr></tbody></table><p>Refluxo e Rajada são próprias deste jogo e acompanham a esquiva. Y/△ não alterna flechas aqui.</p><p>Menu: ↑↓ navega, ←→ altera escolhas, A/× confirma, B/○ volta. Dois controles: selecione 2 jogadores locais.</p>';
  return details;
}
