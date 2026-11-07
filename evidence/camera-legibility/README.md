# Camera legibility — fixed case, 07 November 2026

Baseline: `02b128f`. Two living fighters at `(2,15.45)` and `(30,15.45)`, Totem seed42, P1 followed. Near camera is a fixed 1.28× enlargement; the rival lies outside its right edge, although x30 is not the map's wrap boundary. The former indicator only inspected x<0.5/x>31.5, so it supplied no direction.

The cut projects visual head/feet/width with the camera actually used by the renderer. A partially clipped live body gets a bordered directional badge with minimum 12px type. Wide mode removes that badge when the body fits. Labels avoid the camera button as well as the existing HUD blockers. Dead overheads explicitly obey `hidden` despite their flex display.

## Acceptance (unchanged)
- Fixed close case: 2/2 live fighters either fully visible or represented by an in-bounds readable directional badge; report body size and badge font, not an invented visual score.
- Near/wide zoom distances remain fixed; no automatic zoom/pan policy changes.
- Wrap X/Y, death/respawn, viewport resize, canvas gutters and pointer projection round-trip remain correct. No HUD overlap at the three fixed sizes.
- All five control presets and camera remapping persist; actual online peer receives authoritative snapshots.
- siTela 1366×768 and 900×1000 remain green. **360×800 remains below the 40% arena-area gate**: a complete 16:9 view is only 25.3125% of that portrait viewport. Do not stretch art, crop the world, hide HUD or enlarge an empty container to claim a pass. Touch portrait's existing rotation notice is not changed.

## Reproduction
Use the registered mission tab in an authorized heavy-slot bench. `scripts/proof-camera-legibility.mjs` uses the real `Arena/Camera legibilidade` stories, six fixed combinations (three viewports × near/wide); `TLA_PHASE=before TLA_STORY=http://127.0.0.1:6141` uses the immutable baseline story build. `proof-camera-neighbors.mjs` checks camera/HUD/projection; `proof-camera-game.mjs` checks the production app and online peer (`TLA_URL` selects local/public).

Scripts require `TLA_TAB`, default CDP19080; they close their own tab in finally and log ownership. `TLA_EVIDENCE` overrides output directory. No full suite or fuzz; the six cases are named product regressions, not generated input variation.

At this commit: 27 focused unit tests passed (16 camera/aim/bind +11 network/mouse/HUD), TypeScript, Storybook build and production build passed. Numeric baseline persisted. **Visual approval/deploy still require the GPU slot and inspection of actual PNGs**; do not treat prepared proof scripts as executed proof. Live status and evidence: `/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/camera-estado.json` and `camera-evidencias/`.
