import type { ArrowKind, Fighter } from './world.ts';

export const MAX_AMMO = 6;
/** Accept legacy fighters/ammo edits without losing the ordered special arrows. */
export function quiver(f: Fighter): ArrowKind[] {
  const inventory = f.inventory ??= [];
  f.ammo = Math.max(0, Math.min(MAX_AMMO, f.ammo));
  inventory.length = Math.min(inventory.length, f.ammo);
  while (inventory.length < f.ammo) inventory.push('normal');
  return inventory;
}
export function giveArrows(f: Fighter, kinds: readonly ArrowKind[]): void {
  const inventory = quiver(f);
  for (const kind of kinds) {
    if (inventory.length < MAX_AMMO) inventory.push(kind);
    // A full quiver still benefits from a special treasure, without changing FIFO order.
    else if (kind !== 'normal') {
      const normal = inventory.lastIndexOf('normal');
      if (normal >= 0) inventory[normal] = kind;
    }
  }
  f.ammo = inventory.length;
}
export function takeArrow(f: Fighter): ArrowKind | undefined {
  const kind = quiver(f).shift();
  f.ammo = f.inventory!.length;
  return kind;
}
