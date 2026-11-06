/** Every runtime asset URL goes through BASE_URL, so the build works at / and at /the-last-arrow-web/ (GitHub Pages). */
export const BASE_URL: string = import.meta.env.BASE_URL;
export function asset(path: string): string { return `${BASE_URL}assets/${path}`; }
/** Portrait file per character id (UI art from public/assets/ui). */
export function portrait(characterId: string): string { return asset(`ui/portrait_${characterId === 'stormdragon' ? 'storm' : characterId}.jpg`); }
