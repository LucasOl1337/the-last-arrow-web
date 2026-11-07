export interface SkillVisualState {
  kind: 'water-guard' | 'storm-gust'; time: number; x: number; y: number; charges: number;
}
/** Read-only snapshot adapter: old servers have no skill state; no local timers invent an active guard. */
export function skillVisual(skill: SkillVisualState | undefined, alive: boolean) {
  if (!alive || !skill || skill.time <= 0 || (skill.kind === 'water-guard' && skill.charges <= 0)) return null;
  const water = skill.kind === 'water-guard';
  const progress = 1 - Math.max(0, Math.min(1, skill.time / (water ? .7 : .25)));
  return { x: skill.x, y: 18 - skill.y, radius: water ? .8 : 2.4 * (.3 + .7 * progress),
    color: water ? 0x70b9e0 : 0xb6e0d5, opacity: water ? .58 : .55 * (1 - progress),
    rotation: water ? progress * .15 : progress * .6, water };
}
