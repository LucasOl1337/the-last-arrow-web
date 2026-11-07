# Mizu authored equipped bow / arm-only clearance correction

Base: `537695d591ca962ee2aee6f1b9bfda91a192fab3`. This is an authored weapon,
not geometry extracted from the baked stowed bow. That original GLB, geometry,
materials and texture remain intact. Storm's accepted skin fix and Gamepad are
unchanged. No new assets were generated.

## Cause and fix

The former string intersected actual head triangles23457 (inverted aim),11346
(first northeast turn) and16924 (crouch). Independent posed-triangle/raycast
checks confirmed real intersections, not a stale bind matrix. Forward authored
limbs alone fixed23457 but not the neighbors.

The equipped bow stays exactly on LeftHand, with tips(+.19,±.64,0), brace.19,
draw.14 and an analytic finite.18s recoil. Bow, decorative arrow and arm targets
share simulation aim; the bow span is derived from the corrected palm. The
held arrow stays.73 long. No projectile/spawn/collision change is included.

`MizuArmIK` restores authored rotations before sampling the mixer, then applies
only clavicle/arm/forearm/wrist rotations. The two-link solver works in shoulder
parent coordinates, preserving bone lengths under existing nonuniform crouch
render scale. Head clearance uses actual posed skin. The elbow bends behind
the string; sleeve pronation uses its real radial centroid. Draw-hand contact
uses a measured skin support point tangent to the string's.005 radius, rather
than claiming the wrist origin is a finger socket. Quaternion attitude is kept
in chain coordinates, avoiding lossy world-quaternion extraction under crouch.
No torso C1, bone translations, scale, root movement, hidden string or offset
weapon grip is used. No parameter sweep was run.

## Acceptance and scope

- Original exact gate and23-state neighbor gate are unchanged, hashes in
  `cpu-summary.json`. Both segments also pass the additional strict body gate.
-25 focused tests pass: zero string/skin hits, exact paused600updates, arm-link
  and non-arm rotation preservation, tangent hand contact, existing rig/short
  tap, Storm, aim, and simulated Gamepad tests.
- Authoritative spawn, rendered projectile and next simulation step are exactly
  equal to base. Hand pose is intentionally different; full rig parity is NOT
  claimed. Held-tip→authoritative-projectile discontinuity remains out of scope.
- Real NVIDIA GPU Storybook captures cover before/after hold, first northeast
  turn, inverted aim, crouch, release; profile/front and gameplay viewports.
  First capture timeout and later Vite reload were recorded; missing images
  were completed without changing the tested runtime.
- GPU criticism: a first right-hand implementation floated from the crouched
  nock. It was corrected using actual skin contact, then all25tests rerun and
  new GPU images inspected. The existing open-finger animation is preserved;
  this cut is a coherent equipped-bow improvement, not a new finger-curl rig.
- Typecheck and Storybook build pass. Public/local match results are recorded
  separately; do not infer deployment from this source report.

Raw evidence/iteration logs:
`~/.hermes/despachos/1107-082604-melhorias-do-last-arrow/evidencias/mizu-neighbors/`.
