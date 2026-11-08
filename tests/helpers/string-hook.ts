// Draw-hand contract for the three-under hook. Measured on the posed skin:
// the nearest draw-hand surface to the drawn lower string (nock -> lower tip)
// is a hooking finger pad (index, middle or ring, dominant bone) tangent at
// .005, and the index rests right under the arrow shaft (radius .014) with the
// same .005 gap, "up" being the real bow's upper tip side. The lower string
// leaves the nock, so pad-on-string plus index-under-shaft pins the hook at
// the nock.
export const HOOK_TANGENT=.005,ARROW_RADIUS=.014;
export const hookHolds=(h:any)=>h.hook&&Math.abs(h.contact-HOOK_TANGENT)<1e-5&&h.indexTop<=-ARROW_RADIUS&&h.indexTop>=-ARROW_RADIUS-HOOK_TANGENT-1e-4;
export function stringHook(THREE:any,mesh:any,nock:any,upperTip:any,lowerTip:any){
  const g=mesh.geometry,j=g.getAttribute('skinIndex'),w=g.getAttribute('skinWeight'),p=new THREE.Vector3();
  const seg=lowerTip.clone().sub(nock),len2=seg.lengthSq();
  const toward=(x:any)=>{const t=Math.max(0,Math.min(1,x.clone().sub(nock).dot(seg)/len2));return {t,d:x.distanceTo(nock.clone().addScaledVector(seg,t))};};
  const up=upperTip.clone().sub(lowerTip).normalize();
  let contact=Infinity,bone='',along=0,indexTop=-Infinity;
  for(let i=0;i<j.count;i++){
    let right=0,dominant='',best=0;
    for(let k=0;k<4;k++){const name=mesh.skeleton.bones[j.getComponent(i,k)].name,weight=w.getComponent(i,k);if(name.startsWith('mixamorigRightHand'))right+=weight;if(weight>best){best=weight;dominant=name;}}
    if(right<=.5)continue;
    mesh.localToWorld(mesh.getVertexPosition(i,p));
    const {t,d}=toward(p);
    if(d<contact){contact=d;bone=dominant.replace('mixamorig','');along=t*Math.sqrt(len2);}
    if(/^mixamorigRightHandIndex/.test(dominant))indexTop=Math.max(indexTop,p.clone().sub(nock).dot(up));
  }
  return {contact,bone,along,indexTop,hook:/^RightHand(Index|Middle|Ring)[23]$/.test(bone)};
}
