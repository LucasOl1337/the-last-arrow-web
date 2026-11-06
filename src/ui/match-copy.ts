import { HEADHUNTER_SECONDS } from '../sim/world.ts';
import type { MatchOptions, World } from '../sim/world.ts';

export function matchStatus(w: World): string {
  return w.options.mode === 'headhunter'
    ? `Headhunter · Mais abates / ${Math.max(0, Math.ceil(HEADHUNTER_SECONDS - w.matchTime - 1e-9))}s`
    : `Primeiro a 5 / ${Math.max(0, Math.ceil(90 - w.roundTime - 1e-9))}s`;
}
export function victorySummary(mode: MatchOptions['mode'], score: number, winner: boolean): string {
  if (!winner) return mode === 'headhunter' ? 'Tempo esgotado. Empate em abates.' : 'Ninguém levou a arena desta vez.';
  return mode === 'headhunter' ? `${score} ${score === 1 ? 'abate' : 'abates'} em 2 minutos. A arena é sua.` : 'Cinco vitórias. A arena é sua.';
}
