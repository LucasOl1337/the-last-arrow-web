// Fixed geometric cases, not generated inputs: six spawn sightlines per arena.
import { LEVELS, WIDTH, HEIGHT, delta, solid } from '../src/sim/level.ts';
import { pathToFileURL } from 'node:url';
export const SPAWN_PAIRS = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
export function sightline(level, a, b) {
  const dx = delta(a.x,b.x,WIDTH), dy = delta(a.y,b.y,HEIGHT);
  const distance = Math.hypot(dx,dy), samples = Math.max(1,Math.ceil(distance / .05));
  for (let i=0;i<=samples;i++) {
    if (solid(level,a.x+dx*i/samples,a.y+dy*i/samples)) return { clear:false, distance };
  }
  return { clear:true, distance };
}
export function measureMaps() {
  return LEVELS.map(level=>({
    id:level.id, platforms:level.platforms.length,
    solids:level.rows.join('').split('#').length-1,
    spawns:level.spawns,
    sightlines:SPAWN_PAIRS.map(([a,b])=>({from:a,to:b,...sightline(level,level.spawns[a],level.spawns[b])})),
  }));
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(measureMaps(),null,2));
