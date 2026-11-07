/** Projected visual body bounds, normalized to the canvas (not the physical map). */
export interface ScreenBody { left: number; right: number; top: number; bottom: number }

/** A partially clipped fighter needs a direction too; an overhead clamped into view isn't a body. */
export function cameraDirection(body: ScreenBody): string {
  if (!Object.values(body).every(Number.isFinite)) return '';
  const vertical = body.top < 0 ? '↑' : body.bottom > 1 ? '↓' : '';
  const horizontal = body.left < 0 ? '←' : body.right > 1 ? '→' : '';
  return vertical + horizontal;
}
