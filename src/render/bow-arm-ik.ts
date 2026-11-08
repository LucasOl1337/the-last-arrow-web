import * as THREE from 'three';
import { bowSpan } from './equipped-bow.ts';

/** Arm-only overlay. Restore before the mixer and solve after authored spine aim.
 * No translations/scales, torso edits or accumulated quaternion multiplication. */
/** Draw arm may extend a little further than the support arm's .97. */
const DRAW_REACH=.995;
/** Rendered arrow shaft radius (fighters.ts CylinderGeometry .014). */
const ARROW_RADIUS=.014;
export interface BowArmProfile { bodyClearance?: boolean; ornamentVertex?: number }
export class BowArmIK {
  private bones: THREE.Object3D[];
  private sampled = new Map<THREE.Object3D, THREE.Quaternion>();
  private left: { upper: THREE.Object3D; lower: THREE.Object3D; hand: THREE.Object3D };
  private right: { upper: THREE.Object3D; lower: THREE.Object3D; hand: THREE.Object3D };
  private rightClavicle: THREE.Object3D;
  private rightIndex: THREE.Object3D;
  private rightPinky: THREE.Object3D;
  private rightFinger: THREE.Object3D;
  private rightSkin: number[] = [];
  /** Draw-hand hook surface (index/middle/ring middle+distal phalanges) and index chain. */
  private rightHook: number[] = [];
  private rightIndexSkin: number[] = [];
  private index: THREE.Object3D;
  private pinky: THREE.Object3D;
  private clavicle: THREE.Object3D;
  private mesh: THREE.SkinnedMesh;
  private headVertices: number[] = [];
  private bodyTriangles: number[][] = [];
  private bodyPoints = new Map<number, THREE.Vector3>();
  private sleeveVertices: number[] = [];
  readonly metrics = { headFront: 0, targetDepth: 0, handDepth: 0, unreachable: false, drawUnreachable: false };
  /** Measured centre of the closed bow fist: the riser runs through it. */
  readonly gripWorld = new THREE.Vector3();
  private fingers: Record<'Left'|'Right',{chains:THREE.Object3D[][];thumb:THREE.Object3D[];middle:THREE.Object3D[];palmSign:number}>;
  constructor(private model: THREE.Object3D, private profile: BowArmProfile = {}) {
    const get=(name:string)=>model.getObjectByName('mixamorig'+name)!;
    this.left={upper:get('LeftArm'),lower:get('LeftForeArm'),hand:get('LeftHand')};
    this.index=get('LeftHandIndex1');this.pinky=get('LeftHandPinky1');
    this.right={upper:get('RightArm'),lower:get('RightForeArm'),hand:get('RightHand')};
    this.rightClavicle=get('RightShoulder');this.rightIndex=get('RightHandIndex1');this.rightPinky=get('RightHandPinky1');this.rightFinger=get('RightHandIndex3');
    this.clavicle=get('LeftShoulder');
    this.bones=[this.clavicle,this.left.upper,this.left.lower,this.left.hand,this.rightClavicle,this.right.upper,this.right.lower,this.right.hand];
    // Finger chains are part of the same restore-before-mixer overlay, so the
    // grip/hook curl is re-authored from the sampled clip every frame, never
    // accumulated. Palm side is measured from each asset's own rest bend.
    model.updateWorldMatrix(true,true);
    const side=(s:'Left'|'Right')=>{
      const chain=(f:string)=>[1,2,3].map(i=>get(`${s}Hand${f}${i}`));
      const chains=['Index','Middle','Ring','Pinky'].map(chain),hand=this.point(get(s+'Hand'));
      const axis=this.point(get(s+'HandMiddle1')).sub(hand).normalize(),across=this.point(get(s+'HandIndex1')).sub(this.point(get(s+'HandPinky1'))).normalize();
      const bend=new THREE.Vector3();for(const f of ['Index','Middle','Ring','Pinky']){const a=this.point(get(`${s}Hand${f}1`));bend.add(this.point(get(`${s}Hand${f}4`)).sub(a).normalize().sub(this.point(get(`${s}Hand${f}2`)).sub(a).normalize()));}
      const palmSign=bend.dot(axis.clone().cross(across))>=0?1:-1;
      return {chains,thumb:chain('Thumb'),middle:[...chain('Middle'),get(s+'HandMiddle4')],palmSign};
    };
    this.fingers={Left:side('Left'),Right:side('Right')};
    for(const s of ['Left','Right'] as const)this.bones.push(...this.fingers[s].chains.flat(),...this.fingers[s].thumb);
    let mesh:THREE.SkinnedMesh|undefined;
    model.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh && !!((o as THREE.Mesh).material as THREE.Material).userData.uniforms)mesh??=o as THREE.SkinnedMesh;});
    this.mesh=mesh!;
    const j=this.mesh.geometry.getAttribute('skinIndex'),w=this.mesh.geometry.getAttribute('skinWeight');
    const bodyVertices=new Set<number>();
    for(let i=0;i<j.count;i++){
      let head=0,forearm=0,right=0,body=0;
      for(let k=0;k<4;k++){
        const name=this.mesh.skeleton.bones[j.getComponent(i,k)].name,weight=w.getComponent(i,k);
        if(/Head|Neck/.test(name))head+=weight;
        if(!/Shoulder|Arm|Hand/.test(name))body+=weight;
        if(name==='mixamorigLeftForeArm')forearm+=weight;
        if(name.startsWith('mixamorigRightHand'))right+=weight;
      }
      if(head>.5)this.headVertices.push(i);
      if(profile.bodyClearance && body>.5)bodyVertices.add(i);
      if(forearm>.5)this.sleeveVertices.push(i);
      if(right>.5)this.rightSkin.push(i);
      let dominant='',best=0;for(let k=0;k<4;k++){const weight=w.getComponent(i,k);if(weight>best){best=weight;dominant=this.mesh.skeleton.bones[j.getComponent(i,k)].name;}}
      if(/^mixamorigRightHand(Index|Middle|Ring)[23]$/.test(dominant))this.rightHook.push(i);
      if(/^mixamorigRightHandIndex[123]$/.test(dominant))this.rightIndexSkin.push(i);
    }
    const index=this.mesh.geometry.index!;
    for(let t=0;t<index.count;t+=3){const ids=[index.getX(t),index.getX(t+1),index.getX(t+2)];if(ids.every(i=>bodyVertices.has(i))){this.bodyTriangles.push(ids);for(const i of ids)if(!this.bodyPoints.has(i))this.bodyPoints.set(i,new THREE.Vector3());}}
  }
  restore() { for(const [bone,q] of this.sampled)bone.quaternion.copy(q); }
  private point(bone:THREE.Object3D){return bone.getWorldPosition(new THREE.Vector3());}
  /** Solve in shoulder-parent space: crouch/nonuniform render scale is outside
   * the link-length metric, so no stretching is needed to reach a world target. */
  private solve(targetWorld:THREE.Vector3,chain=this.left,poleWorld=new THREE.Vector3(0,0,-1),maxFraction=.97) {
    const {upper,lower,hand}=chain,parent=upper.parent!;
    this.model.updateWorldMatrix(true,true);
    const origin=upper.position.clone(),elbow=parent.worldToLocal(this.point(lower)),wrist=parent.worldToLocal(this.point(hand));
    const l1=origin.distanceTo(elbow),l2=elbow.distanceTo(wrist);
    const goal=parent.worldToLocal(targetWorld.clone()),direction=goal.sub(origin),distance=THREE.MathUtils.clamp(direction.length(),Math.abs(l1-l2)+1e-5,(l1+l2)*maxFraction);
    direction.normalize();
    // Elbow hinge stays behind the weapon plane, away from the string. The
    // authored elbow can swing into that plane when the clavicle protracts.
    const behind=parent.worldToLocal(this.point(upper).add(poleWorld)).sub(origin);
    const pole=behind.addScaledVector(direction,-behind.dot(direction));
    if(pole.lengthSq()<1e-12)pole.set(0,-1,0).addScaledVector(direction,direction.y);
    pole.normalize();
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
    const desiredElbow=origin.clone().addScaledVector(direction,along).addScaledVector(pole,height);
    const swing=new THREE.Quaternion().setFromUnitVectors(elbow.sub(origin).normalize(),desiredElbow.clone().sub(origin).normalize());
    upper.quaternion.premultiply(swing).normalize();this.model.updateWorldMatrix(true,true);
    const desiredWrist=parent.localToWorld(origin.clone().addScaledVector(direction,distance));
    const currentLower=lower.parent!.worldToLocal(this.point(hand)).sub(lower.position).normalize();
    const desiredLower=lower.parent!.worldToLocal(desiredWrist).sub(lower.position).normalize();
    lower.quaternion.premultiply(swing.setFromUnitVectors(currentLower,desiredLower)).normalize();
    this.model.updateWorldMatrix(true,true);
  }
  /** Rotate the wrist so hand axis (wrist→middle knuckle) follows `axis` and
   * the knuckle row (pinky→index) follows `across`. Two measured swings. */
  private orientHand(s:'Left'|'Right',axis:THREE.Vector3,across:THREE.Vector3){
    const hand=s==='Left'?this.left.hand:this.right.hand,hp=hand.parent!,o=hand.position;
    const get=(n:string)=>this.model.getObjectByName('mixamorig'+s+'Hand'+n)!;
    const local=(w:THREE.Vector3)=>hp.worldToLocal(this.point(hand).add(w)).sub(o).normalize();
    const current=hp.worldToLocal(this.point(get('Middle1'))).sub(o).normalize();
    hand.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(current,local(axis))).normalize();this.model.updateWorldMatrix(true,true);
    const a=local(axis),row=hp.worldToLocal(this.point(get('Index1'))).sub(hp.worldToLocal(this.point(get('Pinky1'))));
    row.addScaledVector(a,-row.dot(a)).normalize();const want=local(across);want.addScaledVector(a,-want.dot(a)).normalize();
    hand.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(a,Math.atan2(a.dot(row.clone().cross(want)),row.dot(want)))).normalize();
    this.model.updateWorldMatrix(true,true);
  }
  /** Flex every phalanx toward the palm about the hand's own knuckle axis. */
  private curl(s:'Left'|'Right',angles:readonly number[],thumb:readonly number[]){
    const set=this.fingers[s],hand=s==='Left'?this.left.hand:this.right.hand;
    const q=new THREE.Quaternion(),pq=new THREE.Quaternion(),flex=new THREE.Vector3(),palm=new THREE.Vector3();
    const frame=()=>{const h=this.point(hand),axis=this.point(set.chains[1][0]).sub(h).normalize(),across=this.point(set.chains[0][0]).sub(this.point(set.chains[3][0])).normalize();
      palm.copy(axis).cross(across).multiplyScalar(set.palmSign).normalize();flex.copy(axis).cross(palm).normalize();};
    const bend=(bone:THREE.Object3D,axis:THREE.Vector3,angle:number)=>{
      bone.parent!.getWorldQuaternion(pq);q.setFromAxisAngle(axis,angle);
      bone.quaternion.premultiply(pq.clone().invert().multiply(q).multiply(pq)).normalize();bone.updateWorldMatrix(false,true);
    };
    frame();
    for(const chain of set.chains)chain.forEach((bone,i)=>bend(bone,flex,angles[i]));
    // Thumb closes across the palm toward the middle finger's root.
    const t=set.thumb,dir=this.point(t[1]).sub(this.point(t[0])).normalize(),thumbFlex=dir.clone().cross(palm).normalize();
    t.forEach((bone,i)=>bend(bone,thumbFlex,thumb[i]));
    return palm.clone();
  }
  apply(aimX:number,aimY:number,pull:number,socket?:THREE.Vector3,facing=1,strict=true) {
    const up=bowSpan(aimX,aimY,facing);
    for(const bone of this.bones){const q=this.sampled.get(bone)??new THREE.Quaternion();q.copy(bone.quaternion);this.sampled.set(bone,q);}
    this.model.updateWorldMatrix(true,true);
    const {upper,lower,hand}=this.left;
    // Head surface is real posed skin, refreshed through attached-bind update.
    let root:THREE.Object3D=this.model;while(root.parent)root=root.parent;root.updateMatrixWorld(true);this.mesh.skeleton.update();
    let front=-Infinity;const p=new THREE.Vector3();
    for(const i of this.headVertices)front=Math.max(front,this.mesh.localToWorld(this.mesh.getVertexPosition(i,p)).z);
    this.metrics.headFront=front;
    // Protract the clavicle by rotation, retaining the actual asset's link.
    // This gives the support arm real reach into the visible bow plane.
    const c=this.clavicle,parent=c.parent!;
    const current=parent.worldToLocal(this.point(upper)).sub(c.position).normalize();
    const forward=parent.worldToLocal(this.point(c).add(new THREE.Vector3(0,0,1))).sub(c.position).normalize();
    c.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(current,forward)).normalize();
    this.model.updateWorldMatrix(true,true);
    const shoulder=this.point(upper),aim=new THREE.Vector3(aimX,-aimY,0).normalize(),space=upper.parent!;
    // A front-facing plane must clear not only the head but the support sleeve.
    // Reserve one forearm link of depth ahead of the shoulder instead of merely
    // putting a side-facing arm into a plane through its own thick sleeve.
    const forearmLength=this.point(lower).distanceTo(this.point(hand));
    let depth=Math.max(front+.03,shoulder.z+forearmLength);
    this.metrics.targetDepth=depth;
    const o=upper.position.clone(),a=space.worldToLocal(new THREE.Vector3(shoulder.x,shoulder.y,depth)).sub(o);
    const d=space.worldToLocal(shoulder.clone().add(aim)).sub(o);
    const reach=(o.distanceTo(space.worldToLocal(this.point(lower)))+space.worldToLocal(this.point(lower)).distanceTo(space.worldToLocal(this.point(hand))))*.97;
    const discriminant=a.dot(d)**2-d.lengthSq()*(a.lengthSq()-reach*reach);
    this.metrics.unreachable=discriminant<0;
    const extension=discriminant>=0?(-a.dot(d)+Math.sqrt(discriminant))/d.lengthSq():0;
    const target=shoulder.clone().addScaledVector(aim,Math.max(0,extension));target.z=depth;
    if(this.bodyTriangles.length){
      // The airborne thigh (tri5488) reaches the relaxed string; its farthest
      // vertex is below the weapon, so a whole-body max would exceed reach.
      // Use the actual bow's projected bounding rectangle, conservatively
      // including all vertices of every body triangle overlapping that area.
      const span=up,tips=[target.clone().addScaledVector(aim,-.19).addScaledVector(span,.64),target.clone().addScaledVector(aim,-.19).addScaledVector(span,-.64),target.clone().addScaledVector(aim,-.19-.14*pull)];
      const minX=Math.min(...tips.map(p=>p.x))-.03,maxX=Math.max(...tips.map(p=>p.x))+.03,minY=Math.min(...tips.map(p=>p.y))-.03,maxY=Math.max(...tips.map(p=>p.y))+.03;
      for(const [i,p] of this.bodyPoints)this.mesh.localToWorld(this.mesh.getVertexPosition(i,p));
      for(const ids of this.bodyTriangles){
        const p=this.bodyPoints.get(ids[0])!,q=this.bodyPoints.get(ids[1])!,r=this.bodyPoints.get(ids[2])!;
        if(Math.max(p.x,q.x,r.x)<minX||Math.min(p.x,q.x,r.x)>maxX||Math.max(p.y,q.y,r.y)<minY||Math.min(p.y,q.y,r.y)>maxY)continue;
        depth=Math.max(depth,p.z+.03,q.z+.03,r.z+.03);
      }
      a.copy(space.worldToLocal(new THREE.Vector3(shoulder.x,shoulder.y,depth))).sub(o);
      const disc=a.dot(d)**2-d.lengthSq()*(a.lengthSq()-reach*reach);
      this.metrics.unreachable=disc<0;this.metrics.targetDepth=depth;
      target.copy(shoulder).addScaledVector(aim,disc>=0?Math.max(0,(-a.dot(d)+Math.sqrt(disc))/d.lengthSq()):0);target.z=depth;
    }
    let pushed=false;
    if(socket){
      // Never put the bow plane behind the actual posed face (mid-turn the
      // chibi head faces the camera and its front passes the shot plane).
      socket=socket.clone();pushed=front+.03>socket.z;socket.z=Math.max(socket.z,front+.03);
      target.copy(socket);this.metrics.targetDepth=target.z;
      this.metrics.unreachable=space.worldToLocal(target.clone()).distanceTo(o)>reach+1e-6;
    }
    this.solve(target);this.metrics.handDepth=this.point(hand).z;
    // Forearm pronation: the hanging sleeve's measured radial centroid points
    // behind the string plane. Rotate about the actual forearm axis only; its
    // endpoints and length stay fixed. This is not a bow translation or sweep.
    root.updateMatrixWorld(true);this.mesh.skeleton.update();
    const centroid=new THREE.Vector3();
    for(const i of this.sleeveVertices)centroid.add(this.mesh.localToWorld(this.mesh.getVertexPosition(i,p)));
    centroid.multiplyScalar(1/this.sleeveVertices.length);
    const forearmParent=lower.parent!,origin=lower.position.clone();
    const forearmAxis=forearmParent.worldToLocal(this.point(hand)).sub(origin).normalize();
    const radial=forearmParent.worldToLocal(centroid).sub(origin);radial.addScaledVector(forearmAxis,-radial.dot(forearmAxis)).normalize();
    const back=forearmParent.worldToLocal(this.point(lower).add(new THREE.Vector3(0,0,-1))).sub(origin);back.addScaledVector(forearmAxis,-back.dot(forearmAxis)).normalize();
    const roll=Math.atan2(forearmAxis.dot(radial.clone().cross(back)),radial.dot(back));
    lower.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(forearmAxis,roll)).normalize();
    this.model.updateWorldMatrix(true,true);
    // Bow hand closes around the riser: knuckle row runs along the upper limb
    // chord (index toward the upper tip), wrist→knuckles follows the shot.
    // The Storm ornament is weighted to this hand and was authored along the
    // same row, so it now continues the upper limb instead of a second weapon.
    const span=up;
    const chord=span.clone().multiplyScalar(.64).addScaledVector(aim,-.19).normalize();
    this.orientHand('Left',aim,chord);
    if(this.profile.ornamentVertex!==undefined){
      // Storm: the preserved dragon was authored along the hand's own +Z, 42°
      // from its knuckle row. Twist about the shot axis until the measured
      // hand→ornament-tip vector lies on the upper-limb chord (bow plane), so
      // the dragon becomes the upper limb's crest; knuckles end up diagonal.
      root.updateMatrixWorld(true);this.mesh.skeleton.update();
      const tip=this.mesh.localToWorld(this.mesh.getVertexPosition(this.profile.ornamentVertex,new THREE.Vector3()));
      const hp=hand.parent!,o=hand.position,a=hp.worldToLocal(this.point(hand).add(aim)).sub(o).normalize();
      const from=hp.worldToLocal(tip).sub(o);from.addScaledVector(a,-from.dot(a)).normalize();
      const to=hp.worldToLocal(this.point(hand).add(chord)).sub(o);to.addScaledVector(a,-to.dot(a)).normalize();
      hand.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(a,Math.atan2(a.dot(from.clone().cross(to)),from.dot(to)))).normalize();
      this.model.updateWorldMatrix(true,true);
    }
    this.curl('Left',[1.25,1.35,.9],[.35,.45,.35]);
    this.fist(this.gripWorld);
    if(socket){
      // One rigid correction: the measured fist centre, not the wrist joint,
      // sits on the shared socket. Wrist attitude is kept in world space.
      const attitude=upper.quaternion.clone().multiply(lower.quaternion).multiply(hand.quaternion);
      const wristGoal=this.point(hand).add(socket.clone().sub(this.gripWorld));
      const local=space.worldToLocal(wristGoal.clone()).sub(o);
      if((pushed||!strict)&&local.length()>reach){
        // Face clearance moved the plane, or no arrow is nocked: slide back
        // along the aim onto the reach sphere (closed-form root), keeping the
        // plane depth in front of the face. Radial pull only if even that fails.
        const d=space.worldToLocal(wristGoal.clone().sub(aim)).sub(o).sub(local),pd=local.dot(d),dd=d.lengthSq(),disc=pd*pd-dd*(local.lengthSq()-reach*reach);
        if(disc>=0)wristGoal.copy(space.localToWorld(o.clone().add(local).addScaledVector(d,Math.max(0,(-pd-Math.sqrt(disc))/dd))));
        else if(!strict)wristGoal.copy(space.localToWorld(o.clone().addScaledVector(local.normalize(),reach)));
      }
      this.metrics.unreachable=space.worldToLocal(wristGoal.clone()).distanceTo(o)>reach+1e-6;
      if(!strict)this.metrics.targetDepth=wristGoal.z+this.gripWorld.z-this.point(hand).z;
      this.solve(wristGoal);
      hand.quaternion.copy(upper.quaternion.clone().multiply(lower.quaternion).invert().multiply(attitude)).normalize();
      this.model.updateWorldMatrix(true,true);this.fist(this.gripWorld);
    }
    this.metrics.handDepth=this.gripWorld.z;
    this.drawArm(aim,pull,up,strict);
  }
  /** World position of the preserved hand-borne ornament tip (Storm), or null. */
  ornamentTip(out:THREE.Vector3){return this.profile.ornamentVertex===undefined?null:this.mesh.localToWorld(this.mesh.getVertexPosition(this.profile.ornamentVertex,out));}
  /** Fist centre = centroid of the curled middle finger chain (ring of bones). */
  private fist(out:THREE.Vector3){out.set(0,0,0);for(const b of this.fingers.Left.middle)out.add(this.point(b));return out.multiplyScalar(1/this.fingers.Left.middle.length);}
  private drawArm(aim:THREE.Vector3,pull:number,span:THREE.Vector3,nocked:boolean) {
    const {upper,lower,hand}=this.right,c=this.rightClavicle,parent=c.parent!;
    // The hand never follows the released string forward of brace height.
    const nock=this.gripWorld.clone().addScaledVector(aim,-.19-.14*Math.max(0,pull));
    // Scapula protracts toward the work: clavicle points at the nock, not a
    // fixed axis (rotation only; its link length is the asset's).
    const original=parent.worldToLocal(this.point(upper)).sub(c.position).normalize();
    const toward=parent.worldToLocal(nock.clone()).sub(c.position).normalize();
    c.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(original,toward)).normalize();
    this.model.updateWorldMatrix(true,true);
    // Three-under hook: index, middle and ring hook the string below the
    // arrow, knuckle row along the string.
    const handLength=this.point(this.fingers.Right.middle[0]).distanceTo(this.point(hand));
    const target=nock.clone().addScaledVector(aim,-handLength);target.z+=.04;
    // Draw elbow is pulled back along the arrow line (with a little depth),
    // so the forearm crosses the string plane behind the nock, not through it.
    const elbowPole=aim.clone().multiplyScalar(-1).add(new THREE.Vector3(0,0,.3)).normalize();
    this.solve(target,this.right,elbowPole,DRAW_REACH);
    this.orientHand('Right',aim,span);
    this.curl('Right',[.35,1.45,1.05],[.5,.5,.3]);
    // The thumb does not draw: it lies along the radial edge of the hand, in
    // the metacarpal plane (index proximal direction minus its palm-normal
    // part; rotation of the thumb root only), so the hooking finger pads are
    // the hand's deepest surface instead of a thumb tip standing on the nock.
    const thumb=this.fingers.Right.thumb,index=this.fingers.Right.chains[0],rowEnds=this.fingers.Right.chains;
    const palmNormal=this.point(this.fingers.Right.middle[0]).sub(this.point(hand)).cross(this.point(rowEnds[0][0]).sub(this.point(rowEnds[3][0]))).normalize();
    const to=this.point(index[1]).sub(this.point(index[0]));to.addScaledVector(palmNormal,-to.dot(palmNormal)).normalize();
    const from=this.point(thumb[1]).sub(this.point(thumb[0])).normalize();
    const tq=thumb[0].parent!.getWorldQuaternion(new THREE.Quaternion());
    thumb[0].quaternion.premultiply(tq.clone().invert().multiply(new THREE.Quaternion().setFromUnitVectors(from,to)).multiply(tq)).normalize();
    this.model.updateWorldMatrix(true,true);
    // Drawn lower string, nock -> lower tip, from the authored bow (tips at
    // -brace, +-.64 along the span; nock at -brace - draw*pull).
    const lowerString=aim.clone().multiplyScalar(.14*Math.max(0,pull)).addScaledVector(span,-.64);
    // One geometric contact correction from actual skinned surface. The hook
    // closes on the palm side, so the string lies where the fingers curl:
    // the hand stays entirely on the other side of the string plane (camera
    // side when the back of the hand faces the camera, behind the string when
    // the palm does); the leading hook pad lies on the drawn lower string,
    // .005 off it, and the top of the index sits under the arrow shaft
    // (radius .014) with the same .005.
    const side=Math.sign(this.point(rowEnds[1][2]).z-this.point(rowEnds[1][0]).z)||-1;
    let root:THREE.Object3D=this.model;while(root.parent)root=root.parent;
    for(let pass=0;pass<2;pass++){
      root.updateMatrixWorld(true);this.mesh.skeleton.update();
      const p=new THREE.Vector3(),pad=new THREE.Vector3();let lead=-Infinity,padLead=-Infinity,top=-Infinity;
      for(const i of this.rightSkin)lead=Math.max(lead,side*this.mesh.localToWorld(this.mesh.getVertexPosition(i,p)).z);
      for(const i of this.rightHook){this.mesh.localToWorld(this.mesh.getVertexPosition(i,p));if(side*p.z>padLead){padLead=side*p.z;pad.copy(p);}}
      for(const i of this.rightIndexSkin)top=Math.max(top,this.mesh.localToWorld(this.mesh.getVertexPosition(i,p)).sub(nock).dot(span));
      const rel=pad.clone().sub(nock),down=-ARROW_RADIUS-.005-top,s=rel.dot(span)+down;
      const along=s*lowerString.dot(aim)/lowerString.dot(span);
      const goal=this.point(hand).addScaledVector(span,down).addScaledVector(aim,along-rel.dot(aim)).add(new THREE.Vector3(0,0,nock.z-side*(.005+lead)));
      // Out of reach: slide back along the arrow line (follow-through), never
      // sink through the string plane toward the shoulder. Closed-form root.
      const sp=upper.parent!,o=upper.position,l=(o.distanceTo(sp.worldToLocal(this.point(lower)))+sp.worldToLocal(this.point(lower)).distanceTo(sp.worldToLocal(this.point(hand))))*DRAW_REACH;
      const local=sp.worldToLocal(goal.clone()).sub(o);
      this.metrics.drawUnreachable=local.length()>l+1e-6
      if(this.metrics.drawUnreachable){
        const d=sp.worldToLocal(goal.clone().sub(aim)).sub(o).sub(local),pd=local.dot(d),dd=d.lengthSq(),disc=pd*pd-dd*(local.lengthSq()-l*l);
        if(disc>=0)goal.copy(sp.localToWorld(o.clone().add(local).addScaledVector(d,Math.max(0,(-pd-Math.sqrt(disc))/dd))));
      }
      const attitude=upper.quaternion.clone().multiply(lower.quaternion).multiply(hand.quaternion).normalize();
      this.solve(goal,this.right,elbowPole,DRAW_REACH);
      hand.quaternion.copy(upper.quaternion.clone().multiply(lower.quaternion).invert().multiply(attitude)).normalize();
      this.model.updateWorldMatrix(true,true);
      if(this.metrics.drawUnreachable&&!nocked){
        // No arrow and the string is out of reach (release follow-through):
        // hand the right arm back to the authored clip instead of crossing it.
        for(const b of [c,upper,lower,hand,...this.fingers.Right.chains.flat(),...this.fingers.Right.thumb])b.quaternion.copy(this.sampled.get(b)!);
        this.model.updateWorldMatrix(true,true);return;
      }
    }
  }
}
