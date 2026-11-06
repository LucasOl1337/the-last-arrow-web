import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFile } from 'node:fs/promises';

// Offline authored-clip analysis (no browser/rendering or generated gameplay inputs).
const loader = new GLTFLoader();
for (const name of ['mizu', 'storm', 'kaze', 'akane']) {
  for (const suffix of ['anims', 'extra', ...(name === 'mizu' ? ['run'] : [])]) {
    const bytes = await readFile(`public/assets/models/${name}_${suffix}.glb`);
    const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    for (const clip of gltf.animations.filter(c => ['shoot', 'fire', 'run', 'jump'].includes(c.name))) {
      const root = clip.tracks.find(t => t.name === 'mixamorigHips.position');
      console.log(name, clip.name, 'duration', clip.duration, 'rootTravel', root ? [0, 1, 2].map(i => root.values[root.values.length - 3 + i] - root.values[i]) : null);
      const mixer = new THREE.AnimationMixer(gltf.scene), action = mixer.clipAction(clip); action.play();
      for (const time of (clip.name === 'shoot' ? [1.05, 2.1] : clip.name === 'fire' ? [0, .15, .3, .5, .75, 1, 1.3] : clip.name === 'jump' ? [.12, .3, .38, .6, 1, 1.4, 1.8, 2.1] : [0, .3, .6, .9, 1.24])) {
        mixer.setTime(time); gltf.scene.updateMatrixWorld(true);
        const p = bone => gltf.scene.getObjectByName(`mixamorig${bone}`).getWorldPosition(new THREE.Vector3());
        const hips = p('Hips');
        console.log(time, JSON.stringify(Object.fromEntries(['Head', 'LeftHand', 'LeftShoulder', 'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map(b => [b, p(b).sub(new THREE.Vector3(hips.x, 0, hips.z)).toArray().map(x => +x.toFixed(3))]))));
      }
      mixer.stopAllAction();
    }
  }
}
