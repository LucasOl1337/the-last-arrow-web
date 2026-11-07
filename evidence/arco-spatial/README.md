# Published rig spatial diagnosis — 2026-11-07, 12:10 Brasília

Base: `f9ee69067200d4da830eb70654235e161f89a5b3`; runtime public `a64719071f9258f1dcac9ded9bd60999f23ad26a`. This is a diagnostic cut, **not a gameplay fix and not a new deployment**. Prior `3645f6f` fixes remain published.

## Concrete case and source

Same two actual GLBs and exact inverted-diagonal pre-release sequence as `scripts/measure-arco-rig.ts`: idle, draw, hold10s, diagonal10s, direction turn, crouch, jump, grounded settle. No random input, pose search or full test suite.

- `src/render/fighters.ts:20,149–150`: visual height 2.4 tiles, X/Z width 1.18, model floor offset. GLB rest heights Mizu .9816285 / Storm .9793703 → Y scale 2.4449169 / 2.4505543.
- `fighters.ts:269–270`: root is placed at feet, `HEIGHT - (y + bodyHalfHeight)`. Standing hitbox half-height .55.
- `fighters.ts:344–357`: world-facing spine pitch, published upright aim retained.
- `fighters.ts:76–78,398–399`: arrow local tip .54, draw pull .14 → world tip = actual left hand + **.40 × aim**. Full arrow length .73, unmodified.
- `src/sim/arrows.ts:24–26`: physical origin = fighter center + **.22 × aim**, intentionally inside bounds so firing beside walls cannot skip them. Physics origin/collisions unchanged.
- `src/render/arrows.ts:13,84`: projectile mesh origin at sim origin, actual geometry tip at +.475 along aim (the old comment says .36, not the geometry). Diagnostic reads actual geometry, not that comment; no render offset.

The exact target for the *existing* decorative tip to reach physical spawn is therefore `hand = fighterCenter - .18 × aim`. At aim (-sqrt(.5),-sqrt(.5)), required hand height is **.4227208 tile above feet**. The raised, upright character's hand is at 1.8076 / 1.9222 tiles above feet.

## Measurements

| Metric (tiles) | Mizu | Stormy |
|---|---:|---:|
| Decorative tip → physical origin | 1.5095923 | 1.6650288 |
| Decorative tip → actual projectile mesh tip | 1.0819692 | 1.2271753 |
| Required hand displacement X | +.6007062 | +.7215179 |
| Required hand displacement Y | -1.3849041 | -1.4995221 |
| Residual after unconstrained slide along current arrow line | .5545672 | .5530022 |
| Upper+forearm conservative maximum reach | .6137796 | .6224323 |
| Required shoulder→target distance | 1.2281909 | 1.3673404 |
| Minimum miss with shoulder fixed | .6144112 | .7449080 |
| Conservative reach including clavicle | .8047422 | .8240008 |
| Required clavicle→target distance | 1.2434577 | 1.3633284 |
| Minimum miss with clavicle origin/torso fixed | **.4387155** | **.5393276** |

Reach bounds use the product of maximum local scales up the hierarchy (operator-norm upper bound), with conservative float tolerance, **not** decomposed world-scale columns under nonuniform rotations. They do not impose elbow anatomy, orientation or mesh collision, so a miss even with this generous bound rules out arm-only rotation for the .15 target. It does not prove all possible full-body reposing is impossible.

## Decision and honest next option

No runtime patch forced:

- Sliding only the arrow leaves >.55 tile cross-axis error, and a free translation would detach it from the actual baked bow/hand.
- Even rotating clavicle+arm cannot reach the .15 target while retaining the upright torso. Stretching bones distorts the existing skinned body/baked weapon.
- Translating the full model to hit the target would sink feet/body by 1.38/1.50 tiles. Globally shrinking to hitbox size destroys the published 2.4-tile visual/readability contract and does not independently solve the pose offsets.
- Repositioning the physical origin changes wall/collision behavior; offsetting only the projectile render creates misleading hits. Neither is used. No hidden/shortened arrow or fake trail.

Smallest plausible *next product cut*: author a **low, cross-body firing pose with torso participation**, keep planted feet and current body scale, then solve both arms to a measured grip and draw-hand target. With unchanged lengths and even the generous reach sphere, the clavicle origin would need to move at least **.289/.389 tile** merely to enter the .15-error region. That is a change of stance, not a socket correction; it needs skinned-mesh/face/cloth/bow review and the exact neighbors. Do not describe this option as implemented or guaranteed to pass. Independent bow/string/socket geometry would make the constraint explicit, but the current baked mesh remains untouched and separating it is a larger asset task.

The diagnostic marks **tip vs origin**, as explicitly requested, but also reports **tip vs tip** to avoid confusing a transform origin with a visible endpoint. Even this latter distance exceeds 1 tile, so the visual jump is real.

## Proof

`cause.json`: actual CPU GLB/mixer composition; `tests.txt`: 9 focused tests passed, including published neighbors. `diagnosis-final-test.txt`: one rerun after adding probe non-mutation and actual projectile-tip checks. Storybook typecheck/build passed, syntax/diff checks passed. Test is an assertion of the diagnosis, **not acceptance of an unresolved gap**.

Story `Arena/Arco espacial / Diagnostico` imports the production rig story. `arco-spatial-probe.ts` is diagnostic-only and not imported by the application. `scripts/proof-arco-spatial.sh/.mjs` run one bounded job under a pre-existing bench GPU lease. `render-report.json`: actual ANGLE/NVIDIA RTX4070TiSUPER, CPU/GPU positions agree within 1e-6, zero JS errors; `diagnosisConfirmed=true`, **`spatialCorrectionApproved=false`**.

PNGs opened and inspected in the dispatch's `evidencias/arco-espacial/render`: clean, diagnostic, release, crouch, mobile and nearest-neighbor crops of diagnostic/release. Amber tip is near raised arm; magenta physical origin is lower near the body, and the next release really appears there. The diagnostic line is labelled a distance, not string/trajectory. Portrait still makes characters small; canvas-area checks don't prove product portrait readability. No before/after correction claimed.

One owned tab closed via finish; own_tabs=[]; two bootstrap pages not adopted. Exclusive bench stopped, preview6155 stopped, queue empty. No new agents, no image generation/retry, no shared checkout edits, no CI/Actions.
