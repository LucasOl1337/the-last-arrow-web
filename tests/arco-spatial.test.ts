import test from 'node:test';
import assert from 'node:assert/strict';
import { measureSpatial } from '../scripts/measure-arco-spatial.ts';

// Regression for the diagnosis, not an acceptance gate claiming the gap is fixed.
test('published inverted diagonal cannot meet .15 tile with arrow slide or arm/clavicle rotation alone', async () => {
  const report = await measureSpatial();
  const [mizu, storm] = report.characters;
  assert.ok(Math.abs(mizu.geometry.currentGap - 1.509592304575672) < 1e-8);
  assert.ok(Math.abs(storm.geometry.currentGap - 1.6650288246612066) < 1e-8);
  for (const c of report.characters) {
    assert.equal(c.probePreservesPose, true, 'diagnostic must not mutate local position/quaternion/scale');
    assert.ok(c.geometry.actualTipToTipGap > 1, 'correcting origin-vs-tip convention alone still leaves a real gap');
    assert.ok(Math.abs(c.geometry.projectileLocalTip - .475) < 1e-7);
    assert.ok(c.composition.reconstructedError < 1e-8, 'scale/floor/yaw/root composition reproduces real hand');
    assert.ok(Math.abs(c.geometry.length - .73) < 1e-8, 'do not shorten the arrow to meet a metric');
    assert.ok(Math.abs(c.probe.targetAboveFeet - .422720779386422) < 1e-8);
    assert.ok(c.probe.arrowOnlySlideResidual > .5, 'even unconstrained sliding along current shaft cannot reach .15');
    assert.ok(c.probe.minErrorFixedShoulder > .6, 'upper/forearm alone cannot reach target');
    assert.ok(c.probe.minErrorFixedClavicle > .4, 'including clavicle still cannot reach target with torso fixed');
    assert.ok(c.probe.armReachBound >= c.probe.armLengths[0] + c.probe.armLengths[1], 'reach upper bound must be conservative');
    assert.ok(c.required.displacement[1] < -1.3, 'translating body to target would sink it through its foot plane');
    assert.equal(c.fighter.halfHeight, .55);
    assert.equal(c.asset.visualHeight, 2.4);
  }
});
