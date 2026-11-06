/** Per-map art direction, matched to the concepts in art/lvl_*.png and art/raw/key.png. */
export interface Theme {
  id: string;
  backgrounds: { file: string; z: number; width: number; opacity: number; blur: number; parallax: number; y?: number }[];
  clear: number; veil: { color: number; opacity: number };
  hemi: { sky: number; ground: number; intensity: number };
  sun: { color: number; intensity: number; position: [number, number, number] };
  rim: { color: number; intensity: number };
  exposure: number;
  /** Tile look. */
  block: 'stone' | 'wood'; stoneTint: number; mossColor: number; mossAmount: number; vineColor: number;
  mist: { color: number; opacity: number }; rays: { color: number; opacity: number; from: 'left' | 'right' | 'top' };
  fireflies: { color: number; count: number };
  props: { mushrooms: number; flowers: number[]; ferns: number; torches: boolean; lanterns: boolean; runes: boolean };
  bloom: { strength: number; threshold: number; radius: number };
}

export const THEMES: Record<string, Theme> = {
  moss: {
    id: 'moss',
    backgrounds: [
      { file: 'bg/canopy.jpg', z: -26, width: 82, opacity: 1, blur: 2, parallax: 0.06 },
      { file: 'bg/ruins.jpg', z: -12, width: 56, opacity: 0.92, blur: 1.8, parallax: 0.14, y: 9.6 },
    ],
    clear: 0x0d2018, veil: { color: 0x0c2219, opacity: 0.38 },
    hemi: { sky: 0xd5f0d2, ground: 0x2b3b20, intensity: 1.7 },
    sun: { color: 0xffdca6, intensity: 2.7, position: [-10, 16, 14] },
    rim: { color: 0x9ce8d6, intensity: 1.4 }, exposure: 1.08,
    block: 'stone', stoneTint: 0xb8c4b6, mossColor: 0x6f9a3c, mossAmount: 1, vineColor: 0x4d7a2c,
    mist: { color: 0xcfe8d8, opacity: 0.22 }, rays: { color: 0xffe9a8, opacity: 0.16, from: 'left' },
    fireflies: { color: 0xd8ff9a, count: 46 },
    props: { mushrooms: 10, flowers: [0xff6fa8, 0xc58cff], ferns: 34, torches: false, lanterns: false, runes: false },
    bloom: { strength: 0.42, threshold: 0.86, radius: 0.5 },
  },
  totem: {
    id: 'totem',
    backgrounds: [{ file: 'bg/templo.jpg', z: -16, width: 66, opacity: 1, blur: 1.6, parallax: 0.1 }],
    clear: 0x04121a, veil: { color: 0x031019, opacity: 0.4 },
    hemi: { sky: 0x7db6d6, ground: 0x0b1a1e, intensity: 1.15 },
    sun: { color: 0xb5dcff, intensity: 1.55, position: [10, 18, 14] },
    rim: { color: 0x38f2d8, intensity: 2.2 }, exposure: 1.18,
    block: 'stone', stoneTint: 0x8fa3a6, mossColor: 0x3f7a46, mossAmount: 0.85, vineColor: 0x2e5e3a,
    mist: { color: 0x66d8d0, opacity: 0.2 }, rays: { color: 0x9ce8ff, opacity: 0.14, from: 'right' },
    fireflies: { color: 0x6dfff0, count: 60 },
    props: { mushrooms: 14, flowers: [0x9a7dff, 0x7ad8ff], ferns: 26, torches: true, lanterns: false, runes: true },
    bloom: { strength: 0.62, threshold: 0.8, radius: 0.55 },
  },
  canopy: {
    id: 'canopy',
    backgrounds: [{ file: 'bg/copas.jpg', z: -16, width: 66, opacity: 1, blur: 1.6, parallax: 0.1 }],
    clear: 0x2a1610, veil: { color: 0x2a140c, opacity: 0.26 },
    hemi: { sky: 0xffd9b8, ground: 0x3a2416, intensity: 1.55 },
    sun: { color: 0xffb070, intensity: 2.9, position: [-8, 12, 16] },
    rim: { color: 0xffcf96, intensity: 1.6 }, exposure: 1.05,
    block: 'wood', stoneTint: 0xc9a27a, mossColor: 0x6a8c3a, mossAmount: 0.35, vineColor: 0x5d7d30,
    mist: { color: 0xffd2c0, opacity: 0.26 }, rays: { color: 0xffc27a, opacity: 0.18, from: 'top' },
    fireflies: { color: 0xffd27a, count: 40 },
    props: { mushrooms: 0, flowers: [0xff4a4a, 0xff9a3c, 0xb98cff], ferns: 22, torches: false, lanterns: true, runes: false },
    bloom: { strength: 0.48, threshold: 0.84, radius: 0.5 },
  },
};
export function themeFor(id: string): Theme { return THEMES[id] ?? THEMES.moss; }
