import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/sim/level.ts';
import { themeForLevel } from '../src/render/themes.ts';

test('Cachoeira inherits Temple art instead of falling back to Moss', () => {
  const falls = LEVELS.find(l => l.id === 'falls')!;
  assert.equal(themeForLevel(falls).id, 'totem');
  assert.equal(themeForLevel(falls).backgrounds[0].file, 'bg/templo.jpg');
});
