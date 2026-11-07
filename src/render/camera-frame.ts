/** A close view follows the local player without changing physics or animation scale. */
export const CLOSE_CAMERA_SCALE = 1.28;
export function cameraFrame(aspect: number, close: boolean, target?: { x: number; y: number }) {
  aspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  // Compact near views fit the combat height, not the full arena width. Wide
  // remains an honest whole-arena overview; do not stretch art to fill a portrait.
  const height = close && aspect <= 1
    ? 19.4 / CLOSE_CAMERA_SCALE
    : Math.max(19.4, 33.8 / aspect) / (close ? CLOSE_CAMERA_SCALE : 1);
  const width = height * aspect;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return { height, width,
    x: close && target && width < 32 ? clamp(target.x, width / 2, 32 - width / 2) : 16,
    y: close && target && height < 18 ? clamp(target.y, height / 2, 18 - height / 2) : 9 };
}

export interface CameraFollow {
  x: number; y: number; target?: { x: number; y: number }; aspect: number; close: boolean;
}
/** Follow state is never contaminated by screen shake or kill-focus offsets. */
export function followCamera(previous: CameraFollow | undefined, aspect: number, close: boolean,
  target: { x: number; y: number } | undefined, dt: number): CameraFollow {
  const frame = cameraFrame(aspect, close, target);
  const reset = !previous || previous.aspect !== aspect || previous.close !== close ||
    !!previous.target !== !!target || !!(target && previous.target &&
      (Math.abs(target.x - previous.target.x) > 8 || Math.abs(target.y - previous.target.y) > 4.5));
  const weight = 1 - Math.exp(-Math.min(.05, Math.max(0, dt)) * 14);
  return { x: reset ? frame.x : previous.x + (frame.x - previous.x) * weight,
    y: reset ? frame.y : previous.y + (frame.y - previous.y) * weight,
    target: target ? { ...target } : undefined, aspect, close };
}

/** Sub-tile background motion; camera jumps cannot fling the painted layers across combat. */
export function backgroundMotion(parallax: number, x: number, y: number, time: number) {
  const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
  return { x: clamp((x - 16) * parallax * .45 + Math.sin(time * .11) * parallax * 1.8, .65),
    y: clamp((y - 9) * parallax * .35 + Math.sin(time * .09) * parallax * .7, .28) };
}
