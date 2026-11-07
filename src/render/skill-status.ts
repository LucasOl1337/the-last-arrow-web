import type {Fighter} from '../sim/world.ts';
/** Presentation derives from authoritative state, never from a separate UI timer. */
export function fighterName(id:string,name:string) {return id==='stormdragon'?'Stormy Dragon':name;}
export function skillStatus(f:Pick<Fighter,'character'|'alive'|'skill'|'dashCooldown'>) {
  const name=f.character===0?'Refluxo':'Rajada';
  const active=f.alive&&!!f.skill&&f.skill.time>0&&(f.skill.kind==='storm-gust'||f.skill.charges>0);
  const state=!f.alive?'indisponível':active?'ativo':f.dashCooldown>0?`${(Math.ceil(f.dashCooldown*10)/10).toFixed(1)} s`:'pronto';
  return {name,state,active,text:`${name} · ${state}`};
}
