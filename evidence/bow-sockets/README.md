# Verified bow surface landmarks — 2026-11-07, 13:24 Brasília

Base `fb9f16ccd768d14b26b08389620b505c81e76044`, public runtime `83aff6b`. Deliverable is a **working canonical-GLB inspector + exact skin-aware landmarks**, not a functional bow/string replacement. No gameplay module, GLB, material texture, physics or body geometry was modified. C1 remains rejected and absent.

## Topology result (new evidence, not a repeat of the pose diagnosis)

`inspect-bow-topology.ts` uses indexed connectivity, joining **exact coincident POSITION values** across normal/UV seams. No box-based anatomical classification or distance-radius merging. Component IDs sorted by triangle count:

- **Mizu:** 18,500 vertices, 28,132 triangles, **one connected component**. The canonical rest/back and hold renders show a complete **stowed bow crossing the quiver on his back**, not an equipped left-hand bow. It is fused into the same component as clothing/body.
- **Storm:** 19,451 vertices, 28,963 triangles. Main component 28,357 triangles; second component **606 triangles**. Highlighting exactly this second component identifies **only the detached upper dragon-head ornament**, not a modular whole bow. Main lower piece is fused with the hand/body component. Upper fragment is weighted 100% to `mixamorigLeftHandMiddle3`; the lower end mixes finger/hand bones. Rest already has a gap; hold rotates the upper fragment independently into a roughly horizontal floating ornament.

Full raw components/triangle lists in dispatch `evidencias/arco-sockets/{mizu,storm}-topology.json`. Compact summary and the complete 606-triangle component are committed here. `uvArea` sums the absolute UV triangle areas, not unique atlas coverage (overlap is possible).

## Verified surface points, NOT functional string sockets

| Model / observed surface | Vertex | Source triangle | Meaning |
|---|---:|---:|---|
| Mizu upper back-bow end | 18219 | 27690 | visible wood end, shoulder/spine/arm weights |
| Mizu lower back-bow end | 1563 | 2607 | visible wood end, ~.9765 right thigh |
| Mizu bow/quiver crossing | 8991 | 13602 | visible crossing surface, not equipped grip |
| Mizu upper string surface | 16821 | 25391 | nearest actual vertex to observed thin string, visually marked and verified; not a nock |
| Storm upper horn | 18817 | 28085 | detached ornament extremity |
| Storm ornament bottom | 19287 | 28739 | detached ornament bottom, 100% middle fingertip |
| Storm lower end | 19351 | 28834 | short fused lower piece |
| Storm lower surface | 19362 | 28848 | lower-piece surface, not verified string attachment |

Every point includes asset hash, mesh name, primitive0, triangle vertices, incident triangles, local rest triangle bounds, UV coordinate/triangle area, skin bone names/weights and world points in exact rest/idle/hold10s/inverted/crouch/jump cases. `landmarks.json` is the durable source. Failed exploratory ray picks are preserved in the dispatch, not promoted to landmarks. The exposed Storm hand surface (triangle27880) is **not** a string socket and is not in the manifest.

Mizu crossing-to-left-hand during hold is **.88742 tile** (after10s .88393), consistent with a stowed back weapon. Connecting a line from back bow ends to the decorative hand arrow would visibly cross the body/quiver; it is not a correct draw. In Storm, adding a string to an incomplete, differently skinned ornament/grip would not repair the missing limb/continuity. No geometry removal is authorized by these points alone.

## Working preview

Story **`Arena/Bow sockets / Inspecao`** (`src/render/bow-sockets.stories.ts`) uses actual `ArenaScene`, `FightersView`, materials and loaded GLBs. The inspection camera/light/backdrop are story-only, not the game camera. Controls on `window.__bowSockets`:

- `pose(character, 'rest'|'hold', angle)` for exact rest/production hold; angle0 front, Math.PI back.
- `verified(true|false)` toggles verified surface markers with an explicit “not functional sockets” legend.
- `pick(x,y)` reports real raycast triangle/UV/skin provenance; `nearestVertex` supports a thin surface too small for a ray hit, **requires visual confirmation**.
- `highlight(triangleIDs)` colors only proven component vertices on a **cloned geometry**. No body triangle removal or shared-kit recolor.
- `vertex(id)` validates selected model range. `rendererInfo()` verifies real GPU.

`skinnedLandmark()` calls root `updateMatrixWorld(true)` before skinning. Important finding in the inspector: `updateWorldMatrix()` alone does **not** refresh Three's attached `SkinnedMesh.bindMatrixInverse`. Initial hold markers were misplaced while the rendered mesh was correct; that probe bug was corrected. The final marked points coincide with mesh surfaces. CPU/GPU landmark positions agree to **2.76e-15 Mizu / 1.08e-14 Storm** after accounting for the explicitly different fixture roots.

## Tests / visual review

4 focused tests passed: actual rig neighbors (idle/draw/10s/turn/crouch/jump/taprelease/real projectile), new exact landmark/hash/triangle/independent shader-equation/non-mutation test, and two material preservation tests. Storybook check/build passed. No fuzz or full suite. Tests validate landmark provenance, **not functional cord/string acceptance**.

New real renders on bench `arrow-arco-sockets`, workspace28, held heavy GPU lease, ANGLE/NVIDIA RTX4070TiSUPER. Inspected clean/marked rest and hold from both actual models. Added an unambiguous legend, corrected inspector backdrop and stale attached-bind probe, recaptured final images. No image generation, fake atlas or retouched screenshot.

Final PNGs in dispatch: `mizu-final-clean.png`, `mizu-final-verified.png`, `storm-final-clean.png`, `storm-final-verified.png`, `mizu-approved-hold-preview.png`, `storm-approved-hold-preview.png`. “approved” in file names refers **only to the landmark preview**, not gameplay/cord quality. Final two selected annexes show these actual limits. At desktop size the full character and landmarks are readable without scroll. This isolated inspection is not responsive/online gameplay proof; no deployment was attempted because no gameplay correction was accepted.

### Explicit decision

Ship the inspector/landmark manifest as a source for precise asset work. **Do not integrate a procedural string into these current weapons.** Mizu first needs an equipped weapon object distinct from the stowed art; Storm needs a continuous limb and deliberate weapon weights/socket. No C1, skin stretch, invented pivot, triangle deletion, new PNG generation, projectile-origin or visual-projectile offset.

One owned tab reused; finish closed it, own_tabs=[], kept=[]. Two bootstrap pages not adopted. Preview6158 stopped; bench stopped; heavy lease released. All writes confined to this branch and own dispatch. No extra agent, uncertain-generation retry or CI/Actions.
