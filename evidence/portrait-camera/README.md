# Narrow portrait camera — measured cut, 07 November 2026
Base integrationf9ee690 (runtimepublica647190). Branchsol-portrait-camera in the existing exclusive camera worktree. No rewrites of sent commits; no changes to fighters/puppet/arrows or simulation.

## Change
Narrow portrait keyboard/mouse windows (<=600px) use a square canvas between real HUD rails: scoreboard88px (160px for3/4players) and footer/controls80px. The near camera fits combat height19.4/1.28tiles with actual aspect; it followsP1 with the existing directional offscreen markers. Wide still fits the whole32x18world. Desktop16:9 and1.28× are unchanged.

HUD labels map into the actual canvas rectangle, not the larger shell. Renderer/resize/quality recovery read the same subpixel canvas bounds as pointer projection, removing a small preexisting clientWidth rounding distortion found by the strict aspect test. No orthographic conversion, asset stretching, magic min-height overflow, rotation or hidden HUD. Existing touch portrait rotation policy remains; this is a narrow keyboard/mouse viewport improvement, not new mobile controls.

## Fixed cases, actual projected arena (not container)
| Viewport | Near before→after | Body before→after | Locate | Wide projected area after |
|---|---|---|---|---|
|1366×768|99.95%→99.95%|124.25→124.25px|2/2|88.97%|
|900×1000|50.625%→50.625%|81.90→81.90px|2/2|45.063%|
|360×800|25.3125%→**45%**|32.76→**58.24px**|2/2|**23.126% — fails40%**|

siTela canvas gate passes all3near and all3wide (squarecanvasoccupies45%), but the independent **actual arena** gate remains red for portraitwide. This distinction is deliberate: fitting all32x18 at360pxwidth imposes a theoretical25.3125%viewport ceiling. No claim that the entire portraitwideview passes40%. Near passes with horizontal crop plus truthful indicators, perbrief.

## Visual critique and adjustment
Opened before/afterportrait, bothmodes, desktop900/1366, four-player, actual app/online andtouchpolicyPNGs. Portraitnear: character is visibly larger, scene central, readable score/status above and fullfooter/camera/sound below, no overlap. Wide: smallcombatants and extra scenery persist, but score/controls remain readable; overviewisnotnearview. Fourplayerneighbor required2rows before publishing; allcardsremainvisible with45%canvas. Touch screenshotstillrequiresrotation, unchanged.

Strict screen-axis equality initially failed because clientWidthroundedsubpixels; repaired canonicalresize rather than loosening1e-9assert. Browsertestsuse actualcanvasbounds/visiblebodyandbadges. No suite/fuzz.

## Tests/proofs
29focusedunitcases: portrait-camera,camera-frame,camera-indicator,control-bindings,aim-guide,mouse-crouch,online,skill-hud. TypeScript/Storybookbuild/productionbuildpassed. GPUbench26/arrow-camera, one registeredtabnavigatedandreused. Beforebaselinebuiltfromf9ee690beforecodechanges. `proof-portrait-camera.mjs` measures six namedcases; `proof-portrait-neighbors.mjs` testswrapX/Y,mortality,respawn,viewportoffsets,pointerroundtripand4cards; `proof-portrait-touch-policy.mjs` confirmsoldtouchcontract. `proof-camera-game.mjs` acceptsTLA_VIEWPORT=360x800foractualapp/rebind/mouse/online.

JSONsnexttothisfile; PNGsandrawlogs: `/home/lol/.hermes/despachos/1107-082604-melhorias-do-last-arrow/portrait-evidencias/`. Ficha/critique: `portrait-ficha-tela.md` in thatdispatch. Actualpublicrevisionandcleanupbelongtofinalportrait-entrega.md; don'ttreatprepareddeployascompleted.
