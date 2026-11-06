import * as THREE from 'three';

/** Small procedural textures drawn once on canvas (no extra downloads). Cached per name. */
const cache = new Map<string, THREE.CanvasTexture>();
function make(name: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true, repeat = false) {
  const hit = cache.get(name); if (hit) return hit;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d')!, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  cache.set(name, texture); return texture;
}
/** Deterministic pseudo-random for decoration layout (never the simulation RNG). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

export const softDot = () => make('dot', 64, 64, (g, w) => {
  const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, w, w);
});

export const blob = () => make('blob', 64, 64, (g, w) => {
  const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)'); grad.addColorStop(0.55, 'rgba(0,0,0,0.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, w, w);
});

export const leaf = () => make('leaf', 32, 32, (g) => {
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(16, 1); g.quadraticCurveTo(31, 14, 16, 31); g.quadraticCurveTo(1, 14, 16, 1); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(16, 3); g.lineTo(16, 29); g.stroke();
});

/** Fern / grass tuft billboard: alpha-tested fronds. */
export const fern = () => make('fern', 128, 128, (g, w, h) => {
  const r = rng(7);
  for (let n = 0; n < 9; n++) {
    const base = w / 2 + (r() - 0.5) * 18, angle = -Math.PI / 2 + (n / 8 - 0.5) * 2.3, len = 55 + r() * 45;
    const tipX = base + Math.cos(angle) * len, tipY = h + Math.sin(angle) * len;
    g.strokeStyle = `hsl(${95 + r() * 30},${45 + r() * 20}%,${22 + r() * 16}%)`; g.lineWidth = 2;
    g.beginPath(); g.moveTo(base, h); g.quadraticCurveTo(base + Math.cos(angle) * len * 0.5, h + Math.sin(angle) * len * 0.6 - 10, tipX, tipY); g.stroke();
    for (let t = 0.15; t < 1; t += 0.09) {
      const px = base + (tipX - base) * t, py = h + (tipY - h) * t - Math.sin(t * Math.PI) * 10, size = (1 - t) * 13 + 3;
      g.fillStyle = `hsl(${92 + r() * 34},${45 + r() * 25}%,${24 + r() * 22}%)`;
      for (const side of [-1, 1]) { g.beginPath(); g.ellipse(px + side * size * 0.6, py - size * 0.2, size * 0.7, size * 0.22, side * 0.6 + angle + Math.PI / 2, 0, Math.PI * 2); g.fill(); }
    }
  }
});

export const grass = () => make('grass', 128, 64, (g, w, h) => {
  const r = rng(3);
  for (let n = 0; n < 60; n++) {
    const x = r() * w, len = 14 + r() * 40, lean = (r() - 0.5) * 22;
    g.strokeStyle = `hsl(${88 + r() * 30},${48 + r() * 20}%,${26 + r() * 22}%)`; g.lineWidth = 1.5 + r() * 2;
    g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + lean * 0.3, h - len * 0.6, x + lean, h - len); g.stroke();
  }
});

/** Hanging moss / vines: strands from the top edge with small leaves. */
export const vines = () => make('vines', 128, 128, (g, w, h) => {
  const r = rng(11);
  for (let n = 0; n < 14; n++) {
    const x = r() * w, len = h * (0.3 + r() * 0.7);
    g.strokeStyle = `hsl(${85 + r() * 35},${40 + r() * 20}%,${20 + r() * 15}%)`; g.lineWidth = 1.5 + r() * 1.5;
    g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 18, len * 0.4, x + (r() - 0.5) * 18, len * 0.7, x + (r() - 0.5) * 8, len); g.stroke();
    for (let y = 6; y < len; y += 6 + r() * 6) {
      g.fillStyle = `hsl(${85 + r() * 40},${45 + r() * 20}%,${24 + r() * 20}%)`;
      g.beginPath(); g.ellipse(x + (r() - 0.5) * 8, y, 2.5 + r() * 2.5, 1.5 + r(), r() * 3, 0, Math.PI * 2); g.fill();
    }
  }
  // Soft moss fringe along the top.
  for (let x = 0; x < w; x += 2) {
    g.fillStyle = `hsl(${88 + r() * 25},${45 + r() * 15}%,${22 + r() * 16}%)`;
    g.fillRect(x, 0, 2, 4 + r() * 10);
  }
});

/** Wood planks with procedural grain, for Copas Altas. Repeats along X. */
export const wood = () => make('wood', 256, 128, (g, w, h) => {
  const r = rng(5);
  g.fillStyle = '#7a4e2b'; g.fillRect(0, 0, w, h);
  const planks = 4;
  for (let p = 0; p < planks; p++) {
    const y0 = p * h / planks, ph = h / planks;
    g.fillStyle = `hsl(${24 + r() * 8},${42 + r() * 12}%,${30 + r() * 10}%)`; g.fillRect(0, y0, w, ph);
    for (let n = 0; n < 26; n++) {
      const yy = y0 + r() * ph; g.strokeStyle = `rgba(${40 + r() * 30},${22 + r() * 15},10,${0.25 + r() * 0.35})`; g.lineWidth = 0.6 + r() * 1.2;
      g.beginPath(); g.moveTo(0, yy);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, yy + Math.sin(x * 0.03 + n) * 1.6 + (r() - 0.5));
      g.stroke();
    }
    // Knots, plank seams and nails.
    for (let k = 0; k < 2; k++) { g.fillStyle = 'rgba(45,24,10,0.55)'; g.beginPath(); g.ellipse(r() * w, y0 + ph / 2, 5 + r() * 4, 2.5, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(20,10,4,0.8)'; g.fillRect(0, y0, w, 1.5);
    const seam = Math.floor(r() * w); g.fillRect(seam, y0, 2, ph);
    g.fillStyle = '#c9b48a'; g.fillRect(seam - 6, y0 + 4, 2.5, 2.5); g.fillRect(seam + 6, y0 + ph - 7, 2.5, 2.5);
  }
}, true, true);

/** Glyph atlas for temple runes (white, tinted teal by material). */
export const runes = () => make('runes', 256, 64, (g) => {
  g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 6;
  const glyphs: ((x: number) => void)[] = [
    x => { g.beginPath(); g.arc(x + 32, 32, 16, 0, Math.PI * 2); g.moveTo(x + 32, 10); g.lineTo(x + 32, 54); g.stroke(); },
    x => { g.beginPath(); g.moveTo(x + 14, 50); g.lineTo(x + 32, 12); g.lineTo(x + 50, 50); g.moveTo(x + 20, 36); g.lineTo(x + 44, 36); g.stroke(); },
    x => { g.beginPath(); g.moveTo(x + 32, 10); g.lineTo(x + 52, 32); g.lineTo(x + 32, 54); g.lineTo(x + 12, 32); g.closePath(); g.moveTo(x + 32, 24); g.lineTo(x + 32, 40); g.stroke(); },
    x => { g.beginPath(); for (let t = 0; t < 12; t += 0.2) { const rr = 2 + t * 1.6; g.lineTo(x + 32 + Math.cos(t) * rr, 32 + Math.sin(t) * rr); } g.stroke(); },
  ];
  glyphs.forEach((draw, i) => draw(i * 64));
}, false);

/** Animated-looking flame sprite (white-hot core, orange rim). */
export const flame = () => make('flame', 64, 128, (g, w, h) => {
  const grad = g.createRadialGradient(w / 2, h * 0.68, 2, w / 2, h * 0.6, h * 0.45);
  grad.addColorStop(0, 'rgba(255,250,220,1)'); grad.addColorStop(0.25, 'rgba(255,200,90,0.95)'); grad.addColorStop(0.6, 'rgba(255,110,30,0.55)'); grad.addColorStop(1, 'rgba(255,60,10,0)');
  g.fillStyle = grad; g.beginPath(); g.moveTo(w / 2, 4); g.bezierCurveTo(w * 0.95, h * 0.5, w * 0.95, h * 0.95, w / 2, h - 4); g.bezierCurveTo(w * 0.05, h * 0.95, w * 0.05, h * 0.5, w / 2, 4); g.fill();
});

export const flower = () => make('flower', 64, 64, (g, w) => {
  g.translate(w / 2, w / 2);
  for (let n = 0; n < 6; n++) { g.rotate(Math.PI / 3); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, -14, 7, 14, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill();
});

/** Value-noise helper for canvas textures. */
function noiseField(w: number, h: number, scale: number, seed: number) {
  const r = rng(seed), gw = Math.ceil(w / scale) + 2, gh = Math.ceil(h / scale) + 2;
  const grid = Array.from({ length: gw * gh }, () => r());
  return (x: number, y: number) => {
    const gx = x / scale, gy = y / scale, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (i: number, j: number) => grid[((j % gh) * gw) + (i % gw)];
    return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
  };
}

/** Mossy grain (luminance only, tinted by material colour). */
export const mossTex = () => make('moss', 128, 128, (g, w, h) => {
  const n1 = noiseField(w, h, 16, 21), n2 = noiseField(w, h, 4, 22), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = 150 + (n1(x, y) - 0.5) * 120 + (n2(x, y) - 0.5) * 90, i = (y * w + x) * 4;
    img.data[i] = v * 0.92; img.data[i + 1] = v; img.data[i + 2] = v * 0.8; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}, true, true);

/** Soft cloud/mist (alpha), tiles horizontally. */
export const mist = () => make('mist', 256, 128, (g, w, h) => {
  const n1 = noiseField(w, h, 48, 31), n2 = noiseField(w, h, 16, 32), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // Blend with the mirrored sample so the left/right edges match.
    const t = x / w, a = n1(x, y) * (1 - t) + n1(w - x, y) * t, b = n2(x, y) * (1 - t) + n2(w - x, y) * t;
    const edge = Math.sin(Math.PI * y / h);
    const v = Math.max(0, (a * 0.7 + b * 0.3 - 0.32) * 2.2) * edge, i = (y * w + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.min(255, v * 255);
  }
  g.putImageData(img, 0, 0);
}, true, true);

/** God-ray shaft: bright top fading down, soft sides. */
export const ray = () => make('ray', 64, 256, (g, w, h) => {
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const side = Math.pow(Math.sin(Math.PI * x / (w - 1)), 2.5), fall = Math.pow(1 - y / h, 1.4), i = (y * w + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = side * fall * 255;
  }
  g.putImageData(img, 0, 0);
});

/** Blurred, slightly darkened copy of a background image so painted platforms read as far scenery. */
export function blurredBackground(url: string, blurPx: number, onReady?: () => void): THREE.Texture {
  const canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 864;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const image = new Image(); image.decoding = 'async';
  image.onload = () => {
    // Canvas size stays fixed: resizing after the first upload breaks texSubImage2D. Planes are 16:9 anyway.
    const g = canvas.getContext('2d')!; g.filter = `blur(${blurPx}px)`;
    // Overscan avoids the transparent rim that blur leaves at the edges.
    g.drawImage(image, -blurPx * 2, -blurPx * 2, canvas.width + blurPx * 4, canvas.height + blurPx * 4);
    texture.needsUpdate = true; onReady?.();
  };
  image.src = url;
  return texture;
}
