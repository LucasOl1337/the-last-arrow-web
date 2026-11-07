import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { patchCharacterMaterial } from '../src/render/characterMaterial.ts';

test('character rim preserves the baked texture and limits steady self-light', () => {
  const map = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map, roughness: .78, metalness: 0 });
  const uniforms = patchCharacterMaterial(material, 0x2ef2ff);
  const shader = { uniforms: {}, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader as never, {} as never);
  assert.equal(material.map, map);
  assert.equal(material.roughness, .78);
  assert.equal(uniforms.uTintAmount.value, 0, 'own-model art is not recolored');
  assert.ok(uniforms.uRimStrength.value <= .25 && uniforms.uSelf.value <= .16);
  assert.match(shader.fragmentShader, /uRim \* diffuseColor.rgb \* tlaFres \* uRimStrength/);
  assert.match(shader.fragmentShader, /3\.5\)/);
  assert.match(shader.fragmentShader, /outgoingLight = mix\(outgoingLight, vec3\(1.0\), uFlash\)/);
  assert.match(shader.fragmentShader, /if \(tlaN < uDissolve\) discard/);
  assert.doesNotMatch(shader.fragmentShader, /outgoingLight \+= uRim \* tlaFres/);
});

test('fallback tint and transient hit/dissolve effects remain independent per fighter', () => {
  const a = new THREE.MeshStandardMaterial(), b = a.clone();
  const ua = patchCharacterMaterial(a, 0x4f8dff, 0x3a5f9c);
  const ub = patchCharacterMaterial(b, 0x2ef2ff);
  ua.uFlash.value = 1; ua.uDissolve.value = .5;
  assert.equal(ua.uTintAmount.value, 1);
  assert.equal(ub.uTintAmount.value, 0);
  assert.equal(ub.uFlash.value, 0); assert.equal(ub.uDissolve.value, 0);
  assert.equal(a.customProgramCacheKey(), b.customProgramCacheKey());
});
