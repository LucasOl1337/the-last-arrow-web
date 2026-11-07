# Stormy equipped bow — base0040b99

Reusable equipped-bow/arm-IK core, with stable Mizu aliases/defaults. Mizu's14
measured pose states are exactly equal to the published base; so are spawn,
rendered projectiles and the next authoritative physics step. No physics,
root, bone translation/scale, torso C1, materials/texture/GLB editing is included.

Storm uses authored cold-blue dragonwood, two real string segments and the same
.19brace/.14draw/.73arrow/.18s finite release. The grip is exactly LeftHand. Its
arm-only IK includes actual body triangles overlapping the weapon's projected
rectangle: airborne thigh triangle5488 entered the relaxed string when only
head clearance was considered. Whole-body maximum depth was rejected because
a lower thigh vertex outside the weapon demanded unreachable arm extension.

The corrected original435vertices/606triangles remain bound toLeftHand, never
Middle3. No original fragment is hidden/deleted. The measured original crown
vertex18817 directs the Storm wrist toward the authored upper tip; the original
surface19287 guided the new upper limb's shape, supporting the preserved crown
instead of leaving it detached. These are surface landmarks, NOT extracted
functional sockets. The bow's grip/tips/nock are explicitly authored.

## Acceptance
-26focusedtests pass, including23Stormstates, both string segments with exact
 posed-triangle/raycast agreement, zerohead/bodyhits (ornament included), reach,
 grip, .005±1e-5 drawhand contact, pause600 and bone/torso/simulation invariants.
-Existing Storm fail-closed/435v isolation/disposal tests pass. Actual uploaded
 GPUskin buffer77804bytes has18817/19287=joint17 and untouched19351=joint30.
-Mizu original clearance gates remain byte-identical. Two other Mizu tests only
 change their obsolete assertion that Storm has no weapon/IK to independent
 per-character instances; no geometric assertion is removed or weakened.
-Typecheck/Storybookbuild pass. Canonical GPU story before/after hold, turn1,
 inverted, crouch and release, fullgame and3viewports rendered onNVIDIA4070TiSUPER.
-First GPU candidate failed visual integration (dragon hung underneath). Its
 wrist/upper limb were corrected; actual finalPNGs were inspected. Local game
 withStorm+Mizu passed0JSerrors and both bows/skin uploads. Public proof separate.

Existing open fingers, baked bright Storm appearance and compressed crouch
remain. No claim of a new finger rig,60FPS benchmark or resolution of the
heldarrow→authoritativeprojectile gap. No generation, uncertain502retry,
parameter sweep, whole suite, physical controller test or extra executor.

Raw evidence and rejected intermediate images:
`~/.hermes/despachos/1107-082604-melhorias-do-last-arrow/evidencias/storm-equipped/`.
