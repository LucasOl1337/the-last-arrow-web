import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, createWorld, normalizeCharacters, snapshot } from '../src/sim/world.ts';

test('only Mizu and Stormy Dragon are selectable; four slots alternate active characters', () => {
  assert.deepEqual(CHARACTERS.map(c => c.id), ['mizu', 'stormdragon']);
  const w = createWorld({ humans: 1, bots: 3 });
  assert.deepEqual(w.options.characters, ['mizu', 'stormdragon', 'mizu', 'stormdragon']);
  assert.deepEqual(w.fighters.map(f => f.character), [0, 1, 0, 1]);
  assert.deepEqual(snapshot(w).fighters.map(f => f.name), ['Mizu', 'Stormdragon', 'Mizu', 'Stormdragon']);
});
test('retired and invalid saved/online IDs normalize deterministically without losing slots', () => {
  assert.deepEqual(normalizeCharacters(['kaze', 'akane', 'bad', null]), ['mizu', 'stormdragon', 'mizu', 'stormdragon']);
  const w = createWorld({ humans: 2, bots: 2, characters: ['akane', 'kaze', 'stormdragon'] });
  assert.deepEqual(w.options.characters, ['stormdragon', 'mizu', 'stormdragon', 'stormdragon']);
  assert.deepEqual(w.fighters.map(f => f.character), [1, 0, 1, 1]);
  assert.doesNotThrow(() => JSON.stringify(snapshot(w)));
});
