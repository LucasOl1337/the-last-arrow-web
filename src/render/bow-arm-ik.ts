import * as THREE from 'three';

/** Arm-only overlay. Restore before the mixer and solve after authored spine aim.
 * No translations/scales, torso edits or accumulated quaternion multiplication. */
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
  private index: THREE.Object3D;
  private pinky: THREE.Object3D;
  private clavicle: THREE.Object3D;
  private mesh: THREE.SkinnedMesh;
  private headVertices: number[] = [];
  private bodyTriangles: number[][] = [];
  private bodyPoints = new Map<number, THREE.Vector3>();
  private sleeveVertices: number[] = [];
  readonly metrics = { headFront: 0, targetDepth: 0, handDepth: 0, unreachable: false };
  constructor(private model: THREE.Object3D, private profile: BowArmProfile = {}) {
    const get=(name:string)=>model.getObjectByName('mixamorig'+name)!;
    this.left={upper:get('LeftArm'),lower:get('LeftForeArm'),hand:get('LeftHand')};
    this.index=get('LeftHandIndex1');this.pinky=get('LeftHandPinky1');
    this.right={upper:get('RightArm'),lower:get('RightForeArm'),hand:get('RightHand')};
    this.rightClavicle=get('RightShoulder');this.rightIndex=get('RightHandIndex1');this.rightPinky=get('RightHandPinky1');this.rightFinger=get('RightHandIndex3');
    this.clavicle=get('LeftShoulder');
    this.bones=[this.clavicle,this.left.upper,this.left.lower,this.left.hand,this.rightClavicle,this.right.upper,this.right.lower,this.right.hand];
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
    }
    const index=this.mesh.geometry.index!;
    for(let t=0;t<index.count;t+=3){const ids=[index.getX(t),index.getX(t+1),index.getX(t+2)];if(ids.every(i=>bodyVertices.has(i))){this.bodyTriangles.push(ids);for(const i of ids)if(!this.bodyPoints.has(i))this.bodyPoints.set(i,new THREE.Vector3());}}
  }
  restore() { for(const [bone,q] of this.sampled)bone.quaternion.copy(q); }
  private point(bone:THREE.Object3D){return bone.getWorldPosition(new THREE.Vector3());}
  /** Solve in shoulder-parent space: crouch/nonuniform render scale is outside
   * the link-length metric, so no stretching is needed to reach a world target. */
  private solve(targetWorld:THREE.Vector3,chain=this.left) {
    const {upper,lower,hand}=chain,parent=upper.parent!;
    this.model.updateWorldMatrix(true,true);
    const origin=upper.position.clone(),elbow=parent.worldToLocal(this.point(lower)),wrist=parent.worldToLocal(this.point(hand));
    const l1=origin.distanceTo(elbow),l2=elbow.distanceTo(wrist);
    const goal=parent.worldToLocal(targetWorld.clone()),direction=goal.sub(origin),distance=THREE.MathUtils.clamp(direction.length(),Math.abs(l1-l2)+1e-5,(l1+l2)*.97);
    direction.normalize();
    // Elbow hinge stays behind the weapon plane, away from the string. The
    // authored elbow can swing into that plane when the clavicle protracts.
    const behind=parent.worldToLocal(this.point(upper).add(new THREE.Vector3(0,0,-1))).sub(origin);
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
  apply(aimX:number,aimY:number,pull:number) {
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
      const span=new THREE.Vector3(-aim.y,aim.x,0),tips=[target.clone().addScaledVector(aim,.19).addScaledVector(span,.64),target.clone().addScaledVector(aim,.19).addScaledVector(span,-.64),target.clone().addScaledVector(aim,-.19-.14*pull)];
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
    // The palm normal sets the bow's limb span. Stabilize wrist around the same
    // aim reference on turn1, rather than borrowing a delayed torso/palm yaw.
    const palm=this.point(this.index).sub(this.point(hand)).cross(this.point(this.pinky).sub(this.point(hand))).normalize();
    const span=new THREE.Vector3(-aim.y,aim.x,0);
    const handParent=hand.parent!,normalToParent=new THREE.Matrix3().setFromMatrix4(handParent.matrixWorld).transpose();
    // Storm's preserved dragon is the wrist-mounted crown of the authored bow.
    // Orient its measured surface axis upright rather than letting the Mizu
    // palm convention leave it hanging below/sideways as a second weapon.
    let currentNormal=palm.applyMatrix3(normalToParent).normalize();
    if(this.profile.ornamentVertex!==undefined){
      root.updateMatrixWorld(true);this.mesh.skeleton.update();
      const ornament=this.mesh.localToWorld(this.mesh.getVertexPosition(this.profile.ornamentVertex,new THREE.Vector3()));
      currentNormal=handParent.worldToLocal(ornament).sub(hand.position).normalize();
    }
    const desired=this.profile.ornamentVertex===undefined?span.applyMatrix3(normalToParent).normalize():handParent.worldToLocal(this.point(hand).add(span.clone().multiplyScalar(.64).addScaledVector(aim,.19).normalize())).sub(hand.position).normalize();
    hand.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(currentNormal,desired)).normalize();
    this.model.updateWorldMatrix(true,true);
    // Resolve the remaining wrist twist from the knuckle row: fingers reach
    // forward of the grip, never backward into the brace/string at release.
    const knuckles=this.point(this.index).add(this.point(this.pinky)).multiplyScalar(.5);
    const finger=handParent.worldToLocal(knuckles).sub(hand.position);finger.addScaledVector(desired,-finger.dot(desired)).normalize();
    const forwardFinger=handParent.worldToLocal(this.point(hand).add(aim)).sub(hand.position);forwardFinger.addScaledVector(desired,-forwardFinger.dot(desired)).normalize();
    const twist=Math.atan2(desired.dot(finger.clone().cross(forwardFinger)),finger.dot(forwardFinger));
    hand.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(desired,twist)).normalize();
    this.model.updateWorldMatrix(true,true);
    this.drawArm(aim,pull);
  }
  private drawArm(aim:THREE.Vector3,pull:number) {
    const {upper,lower,hand}=this.right,c=this.rightClavicle,parent=c.parent!;
    const original=parent.worldToLocal(this.point(upper)).sub(c.position).normalize();
    const toward=parent.worldToLocal(this.point(c).add(new THREE.Vector3(0,0,1))).sub(c.position).normalize();
    c.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(original,toward)).normalize();
    this.model.updateWorldMatrix(true,true);
    const nock=this.point(this.left.hand).addScaledVector(aim,-.19-.14*pull);
    const fingerLength=this.point(this.rightFinger).distanceTo(this.point(hand));
    const target=nock.clone().addScaledVector(aim,-fingerLength);
    this.solve(target,this.right);
    // Wrist orientation: finger aim points at the nock, palm faces camera. The
    // subsequent depth fit uses actual skinned hand surface, not a fake offset.
    const hp=hand.parent!,handOrigin=hand.position.clone();
    const palm=this.point(this.rightIndex).sub(this.point(hand)).cross(this.point(this.rightPinky).sub(this.point(hand))).normalize();
    const transpose=new THREE.Matrix3().setFromMatrix4(hp.matrixWorld).transpose();
    const current=palm.applyMatrix3(transpose).normalize(),desired=new THREE.Vector3(0,0,1).applyMatrix3(transpose).normalize();
    hand.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(current,desired)).normalize();this.model.updateWorldMatrix(true,true);
    const fingers=hp.worldToLocal(this.point(this.rightFinger)).sub(handOrigin);fingers.addScaledVector(desired,-fingers.dot(desired)).normalize();
    const forward=hp.worldToLocal(this.point(hand).add(aim)).sub(handOrigin);forward.addScaledVector(desired,-forward.dot(desired)).normalize();
    const angle=Math.atan2(desired.dot(fingers.clone().cross(forward)),fingers.dot(forward));
    hand.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(desired,angle)).normalize();
    let root:THREE.Object3D=this.model;while(root.parent)root=root.parent;root.updateMatrixWorld(true);this.mesh.skeleton.update();
    const wrist=this.point(hand),p=new THREE.Vector3();let radius=0;
    for(const i of this.rightSkin)radius=Math.max(radius,this.mesh.localToWorld(this.mesh.getVertexPosition(i,p)).z-wrist.z);
    // One geometric correction, not a search: put the actual front hand surface
    // tangent behind the string's .005 radius. Preserve wrist's world attitude.
    const worldQ=upper.quaternion.clone().multiply(lower.quaternion).multiply(hand.quaternion).normalize();
    target.z=nock.z-radius-.005;this.solve(target,this.right);
    hand.quaternion.copy(upper.quaternion.clone().multiply(lower.quaternion).invert().multiply(worldQ)).normalize();
    this.model.updateWorldMatrix(true,true);
    // Contact solve from actual nearest hand surface, not the wrist origin.
    // Skin support point is placed tangent to the .005 string at the nock.
    root.updateMatrixWorld(true);this.mesh.skeleton.update();
    let nearest=new THREE.Vector3(),front=-Infinity;
    for(const i of this.rightSkin){this.mesh.localToWorld(this.mesh.getVertexPosition(i,p));if(p.z>front){front=p.z;nearest.copy(p);}}
    const contact=nock.clone().add(new THREE.Vector3(0,0,-.005));
    const correction=contact.sub(nearest),goal=this.point(hand).add(correction);
    const attitude=upper.quaternion.clone().multiply(lower.quaternion).multiply(hand.quaternion).normalize();
    this.solve(goal,this.right);
    hand.quaternion.copy(upper.quaternion.clone().multiply(lower.quaternion).invert().multiply(attitude)).normalize();
    this.model.updateWorldMatrix(true,true);
  }
}
