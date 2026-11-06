import * as THREE from 'three';

/** Per-fighter uniforms on top of the Tripo baked texture: rim light, cloth tint, white flash and dissolve. */
export interface CharacterUniforms {
  uRim: { value: THREE.Color }; uRimStrength: { value: number };
  uTint: { value: THREE.Color }; uTintAmount: { value: number };
  uFlash: { value: number }; uDissolve: { value: number }; uEdge: { value: THREE.Color };
  /** Self-illumination as a fraction of the albedo, so dark cloth/faces never sink into a dim map. */
  uSelf: { value: number };
}

export function patchCharacterMaterial(material: THREE.MeshStandardMaterial, rim: THREE.ColorRepresentation, tint?: THREE.ColorRepresentation): CharacterUniforms {
  const u: CharacterUniforms = {
    uRim: { value: new THREE.Color(rim) }, uRimStrength: { value: 0.55 },
    uTint: { value: new THREE.Color(tint ?? 0xffffff) }, uTintAmount: { value: tint === undefined ? 0 : 1 },
    uFlash: { value: 0 }, uDissolve: { value: 0 }, uEdge: { value: new THREE.Color(rim) }, uSelf: { value: 0.22 },
  };
  material.userData.uniforms = u;
  material.customProgramCacheKey = () => 'tla-character';
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uRim; uniform float uRimStrength; uniform vec3 uTint; uniform float uTintAmount;
uniform float uFlash; uniform float uDissolve; uniform vec3 uEdge; uniform float uSelf;
float tlaHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tlaNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tlaHash(i), tlaHash(i + vec2(1, 0)), f.x), mix(tlaHash(i + vec2(0, 1)), tlaHash(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
#ifdef USE_MAP
  {
    // Recolour bluish cloth only (Mizu navy / Storm ice-blue), keeping skin and leather.
    vec3 c = diffuseColor.rgb;
    float blueness = clamp((c.b - max(c.r, c.g * 0.92)) * 5.0 + 0.15 * step(c.r + c.g + c.b, 0.25), 0.0, 1.0);
    float lum = dot(c, vec3(0.3, 0.59, 0.11));
    diffuseColor.rgb = mix(c, uTint * (lum * 2.2 + 0.04), blueness * uTintAmount);
  }
  float tlaN = tlaNoise(vMapUv * 90.0) * 0.7 + tlaNoise(vMapUv * 23.0) * 0.3;
  if (tlaN < uDissolve) discard;
#endif`)
      .replace('#include <opaque_fragment>', `
  float tlaFres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.2);
  outgoingLight += diffuseColor.rgb * uSelf;
  outgoingLight += uRim * tlaFres * uRimStrength;
  outgoingLight = mix(outgoingLight, vec3(1.0), uFlash);
#ifdef USE_MAP
  outgoingLight += uEdge * 4.0 * smoothstep(uDissolve + 0.08, uDissolve, tlaN) * step(0.001, uDissolve);
#endif
#include <opaque_fragment>`);
  };
  material.needsUpdate = true;
  return u;
}

/**
 * Inverted hull sharing the fighter's skeleton, expanded in screen space by CSS pixels.
 * One extra skinned draw per fighter; keeps silhouettes readable over busy painted backgrounds.
 */
export function addOutline(mesh: THREE.SkinnedMesh, color: THREE.ColorRepresentation, thickness: number) {
  // Depth offset keeps the hull behind thin cloth layers (otherwise it speckles through capes/coats).
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 6, polygonOffsetUnits: 6, toneMapped: false });
  const uniforms = { uThickness: { value: thickness }, uViewport: { value: new THREE.Vector2(1600, 900) } };
  material.customProgramCacheKey = () => 'tla-outline-screen';
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uThickness; uniform vec2 uViewport;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec2 edgeNormal = (projectionMatrix * vec4(normalMatrix * objectNormal, 0.0)).xy;
        edgeNormal *= uViewport;
        gl_Position.xy += edgeNormal / max(length(edgeNormal), 0.0001) * (2.0 * uThickness / uViewport) * gl_Position.w;`);
  };
  const outline = new THREE.SkinnedMesh(mesh.geometry, material);
  outline.bind(mesh.skeleton, mesh.bindMatrix);
  outline.frustumCulled = false; outline.renderOrder = -0.5;
  outline.onBeforeRender = renderer => { renderer.getSize(uniforms.uViewport.value); };
  mesh.parent!.add(outline);
  outline.position.copy(mesh.position); outline.quaternion.copy(mesh.quaternion); outline.scale.copy(mesh.scale);
  return { outline, material };
}
