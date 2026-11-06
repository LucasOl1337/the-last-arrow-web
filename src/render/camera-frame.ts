/** A close view follows the local player without changing physics or animation scale. */
export const CLOSE_CAMERA_SCALE = 1.28;
export function cameraFrame(aspect: number, close: boolean, target?: { x: number; y: number }) {
  const height = Math.max(19.4, 33.8 / aspect) / (close ? CLOSE_CAMERA_SCALE : 1);
  const width = height * aspect;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return { height, width,
    x: close && target && width < 32 ? clamp(target.x, width / 2, 32 - width / 2) : 16,
    y: close && target && height < 18 ? clamp(target.y, height / 2, 18 - height / 2) : 9 };
}
