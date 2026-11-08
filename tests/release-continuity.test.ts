import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { measureReleaseContinuity } from '../scripts/measure-release-continuity.ts';
test('actual held tip and actual projectile geometry tip agree at release (both characters)',async()=>{
 const rows=await measureReleaseContinuity();
 if(process.env.RELEASE_REPORT)await writeFile(process.env.RELEASE_REPORT,JSON.stringify(rows,null,2)+'\n');
 assert.deepEqual(rows.filter(r=>r.tipToTip>.15).map(r=>({state:r.state,character:r.character,gap:r.tipToTip})),[],'release gap must be <=.15 tile, real tip to tip');
});
