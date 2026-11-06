import * as THREE from 'three';

/** Preserve authored stride length before removing root motion. Model units/second. */
export function rootSpeed(clip: THREE.AnimationClip): number {
  const root = clip.tracks.find(t => t.name === 'mixamorigHips.position');
  if (!root || clip.duration <= 0) throw new Error(`Run clip has no root travel: ${clip.name}`);
  const v = root.values, last = v.length - 3;
  const speed = Math.hypot(v[last] - v[0], v[last + 2] - v[2]) / clip.duration;
  if (speed <= 0) throw new Error(`Run clip is stationary: ${clip.name}`);
  return speed;
}

/** Exact boundaries, independent actions: jump → fall can crossfade rather than seek the same action. */
export function clipWindow(clip: THREE.AnimationClip, name: string, start: number, end: number): THREE.AnimationClip {
  const tracks = clip.tracks.map(track => {
    const times = [start, ...Array.from(track.times).filter(t => t > start && t < end), end];
    const interpolant = (track as THREE.KeyframeTrack & { createInterpolant(): THREE.Interpolant }).createInterpolant();
    const values = times.flatMap(t => Array.from(interpolant.evaluate(t)));
    const copy = track.clone();
    copy.times = new Float32Array(times.map(t => t - start)); copy.values = new Float32Array(values);
    return copy;
  });
  return new THREE.AnimationClip(name, end - start, tracks);
}

/** No minimum cadence: deceleration must not keep the feet running at 60% speed. */
export function runTimeScale(velocity: number, authoredSpeed: number, horizontalScale: number): number {
  return Math.abs(velocity) / (authoredSpeed * horizontalScale);
}
