import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { measureReleaseFreeSpace } from '../scripts/measure-release-free-space.ts';

// Companion of release-continuity.test.ts (whose literal <=.15 acceptance stays as is): proves that
// the fixed Mizu inverted-diagonal measurement really is free space and reports its real tip gap.
// The acceptance itself is not relaxed here: `node scripts/measure-release-free-space.ts --gate`
// applies the same literal .15 to this free-space state and exits 1 while the gap persists.
test('Mizu inverted free-space continuity: corridor centre -> muzzle -> held tip has no tile or body', async () => {
  const row = await measureReleaseFreeSpace();
  if (process.env.RELEASE_FREE_SPACE_REPORT) await writeFile(process.env.RELEASE_FREE_SPACE_REPORT, JSON.stringify(row, null, 2) + '\n');
  assert.deepEqual({ tiles: row.precondition.tiles, bodies: row.precondition.bodies }, { tiles: [], bodies: [] }, 'measurement precondition: free space');
  assert.ok(row.precondition.samples > 20);
  assert.equal(row.arrows, 1); assert.equal(row.ammo, 2);
  assert.ok(Number.isFinite(row.tipToTip) && row.tipToTip >= 0, 'real tip -> real tip measured');
});
