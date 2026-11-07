# Storm ornament skin correction — 2026-11-07, 13:48 Brasília

## Accepted scope
The existing 606-triangle / 435-vertex upper ornament used 100% `mixamorigLeftHandMiddle3`. Only those verified vertex skin indices/weights now use `mixamorigLeftHand` in an independent geometry clone. No vertex position, normal, UV, triangle, bone, material, texture, lower weapon piece or projectile is moved/removed/recolored. The original GLB and cached kit remain untouched.

`src/render/storm-ornament.ts` consumes the exact manifest ranges from `evidence/bow-sockets/storm-upper-component.json`. Loader hashes the same Storm GLB bytes it parses. Unknown hash, mesh/layout, original weights, non-rest bind or any triangle sharing outside the component fail closed (original geometry remains). Mizu never receives the change. Outlines use the same clone, ghosts have their own, and disposal frees each owned geometry once without freeing the kit.

Three's original inverse bind matrices already express both joints in the mesh rest frame. Only float32 inverse-bind rounding remains: maximum affected rest displacement is **3.3111068097342454e-7 tile**, below the unchanged **1e-6** gate. No pivot/compensation vector was invented. The first guard used 1e-8 model units and correctly refused the original float32 discrepancy; adjusted to2e-7 model units, while the actual tiles-based acceptance remained1e-6.

## Exact acceptance
- All **19,016 outside vertices**: zero before/after world position error in every requested pose. All original index/position/normal/UV values unchanged, materials/maps and physics preserved.
- The corrected component's 435 positions in hand-local coordinates vary by at most **4.757794677615861e-15** across rest, idle, hold,10s,inverted diagonal,crouch,jump,release and after-release. This tests translation AND rotation, not just an angle.
- Before correction, the hand-local maximum displacement was **.5014961520561517 model unit** in hold. No “projectile jump zero” claim: this is only the finger-driven ornament bug.
- Ten focused tests passed (rig, new component, landmarks, material, aim guide and hold); added exact fail-closed tests passed. No fuzz/full suite. Storybook check/build passed.
- Canonical story imports the production instantiate; A/B swaps only the original/corrected geometry at the SAME frozen pose. Seven real before/after GPU state pairs, ANGLE/NVIDIA RTX4070TiSUPER. CPU/GPU hold points differ by at most1.08e-14 after fixture-root conversion; zero page errors.

## Visual judgment
Opened actual hold before/after, rest and neighboring state images. Before: the upper ornament lies horizontally far beyond the hand, driven by finger curl. After: it remains under/near the left hand and no longer projects away with Middle3. Head/face/hands remain readable; the head/face pixel crops of hold,10s,release are identical. Whole-image differences excluding the legend are confined to the ornament's before/after projection; rest has only4 changed pixels on the ornament, from subpixel float32 rounding, not a changed contour/body. The gap already present in the asset remains: in hold, ornament bottom→lower grip surface .474→.383 tile. This is NOT a repaired continuous bow or string.

Crouch keeps the existing squash; no new compression. The inverted diagonal story view initially shows the back due to the turn; it is not falsely called front/face proof. CPU proves the same exact invariant there; the full-game public proof covers the shipped renderer/camera. Story camera/HUD are not published gameplay changes.

Provenance: branch base49cb752 (inspector), integrated-runtime base83aff6b/fb9f16c. Model remains Pi9router-sherlocker/cx/gpt-6-astra-xhigh, same session/worktree. C1, uncertain generation502, other agents and master untouched. Candidate first tested13:38, <7minutes from request read. Deployment is gated on this scoped fix only; no claim that the bow/arrow alignment or missing limbs/string were repaired.

Raw proof directory: `/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/evidencias/storm-arma/`. The committed compact acceptance summary and CPU measurement reproduce the exact criteria. `scripts/proof-storm-ornament.mjs` captures registered bench-owned tab only and closes it in finally; `scripts/proof-storm-public.mjs` verifies shipped SHA, actual corrected GPU skin-index upload, offline hold and a real authoritative online match.
