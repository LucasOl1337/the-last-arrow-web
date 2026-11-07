/** Archived kit placeholders are not playable. Missing active kits must still surface a fallback. */
export function activeKitsMissing(kits:{mizu:unknown;storm:unknown}):boolean {return !kits.mizu||!kits.storm;}
