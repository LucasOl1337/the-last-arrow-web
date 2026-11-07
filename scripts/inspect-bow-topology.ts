import { rigRuntime } from '../tests/helpers/arco-rig-runtime.ts';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out = process.argv[2]; if (!out) throw new Error('Output directory required');
await mkdir(out, { recursive: true });
const { THREE, kits } = await rigRuntime();
for (const name of ['mizu', 'storm'] as const) {
  const kit = kits[name]!; kit.template.updateWorldMatrix(true, true);
  const meshes: any[] = []; kit.template.traverse((o: any) => { if (o.isSkinnedMesh) meshes.push(o); });
  const reports = meshes.map((mesh, meshIndex) => {
    mesh.skeleton.update();
    const g = mesh.geometry, p = g.attributes.position, uv = g.attributes.uv, weights = g.attributes.skinWeight, joints = g.attributes.skinIndex;
    const indices = g.index ? Array.from(g.index.array) as number[] : Array.from({ length: p.count }, (_, i) => i);
    const parents = Array.from({ length: p.count }, (_, i) => i);
    const root = (i: number): number => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
    const join = (a: number, b: number) => { parents[root(a)] = root(b); };
    // Merge exact coincident POSITIONs across UV/normal seams; NOT a spatial box selection.
    const positions = new Map<string, number>();
    for (let v = 0; v < p.count; v++) {
      const key = `${p.getX(v)},${p.getY(v)},${p.getZ(v)}`;
      const first = positions.get(key); if (first !== undefined) join(first, v); else positions.set(key, v);
    }
    for (let t = 0; t < indices.length; t += 3) { join(indices[t], indices[t + 1]); join(indices[t], indices[t + 2]); }
    const components = new Map<number, { triangles: number[]; vertices: Set<number> }>();
    for (let t = 0; t < indices.length / 3; t++) {
      const r = root(indices[t * 3]); let c = components.get(r); if (!c) { c = { triangles: [], vertices: new Set() }; components.set(r, c); }
      c.triangles.push(t); c.vertices.add(indices[t * 3]); c.vertices.add(indices[t * 3 + 1]); c.vertices.add(indices[t * 3 + 2]);
    }
    const list = Array.from(components.values()).sort((a, b) => b.triangles.length - a.triangles.length).map((c, id) => {
      const box = new THREE.Box3(), uvBox = new THREE.Box2(), boneWeights: Record<string, number> = {};
      const vertices = Array.from(c.vertices).sort((a, b) => a - b);
      for (const v of vertices) {
        const point = mesh.localToWorld(mesh.getVertexPosition(v, new THREE.Vector3())); box.expandByPoint(point);
        uvBox.expandByPoint(new THREE.Vector2(uv.getX(v), uv.getY(v)));
        for (let k = 0; k < 4; k++) { const joint = mesh.skeleton.bones[joints.getComponent(v, k)].name; boneWeights[joint] = (boneWeights[joint] ?? 0) + weights.getComponent(v, k) / vertices.length; }
      }
      let uvArea = 0;
      for (const t of c.triangles) {
        const [a,b,c] = indices.slice(t * 3, t * 3 + 3);
        uvArea += Math.abs((uv.getX(b)-uv.getX(a))*(uv.getY(c)-uv.getY(a))-(uv.getY(b)-uv.getY(a))*(uv.getX(c)-uv.getX(a))) / 2;
      }
      return { id, triangleCount: c.triangles.length, vertexCount: vertices.length, triangles: c.triangles, vertices,
        bounds: { min: box.min.toArray(), max: box.max.toArray() }, uvBounds: { min: uvBox.min.toArray(), max: uvBox.max.toArray() }, uvArea,
        boneWeights: Object.fromEntries(Object.entries(boneWeights).filter(([, w]) => w > .0001).sort((a,b) => b[1]-a[1])) };
    });
    return { meshIndex, meshName: mesh.name, vertexCount: p.count, triangleCount: indices.length / 3, positionAttribute: { normalized: p.normalized, type: p.array.constructor.name },
      components: list };
  });
  const sha256 = createHash('sha256').update(await readFile(`public/assets/models/${name}.glb`)).digest('hex');
  await writeFile(`${out}/${name}-topology.json`, JSON.stringify({ source: `public/assets/models/${name}.glb`, sha256, connectivity: 'shared indexed or exact-position-welded vertices; not anatomical classification', meshes: reports }, null, 2));
  console.log(name, reports.map(m => ({ mesh: m.meshName, vertices: m.vertexCount, triangles: m.triangleCount, components: m.components.length, largest: m.components.slice(0, 20).map(({ id, triangleCount, bounds, boneWeights }) => ({ id, triangleCount, bounds, boneWeights })) })));
}
