// The same impact snapshot drives the displayed body and the ball's outgoing flight.
import * as T from './vendor/three.module.js';
import {poseContact,relaxArms} from './motion.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const CONTACT_HEIGHT={foot:.62,knee:1.05,head:1.91,chest:1.43,inside:.60,outside:.60,around:.58,heel:.62,shoulder:1.62,alternate:1.05,cross:.60,lunge:.48,scorpion:1.32,hip:1.02,rabona:.48,'side-lunge':.48,'around-reverse':.58,'foot-stall':.58,'head-side':1.89,'knee-save':.40};
export function bodyReach(id,ball,actor){
 const d=Math.hypot(ball.x-actor.x,ball.z-actor.z),y=ball.y-(actor.jumpY||0);
 if(id==='knee-save')return Math.hypot(d,y-.54)<=1.04;
 if(['head','head-side','chest','hip','shoulder'].includes(id))return d<=({head:.70,'head-side':.70,chest:.65,hip:.59,shoulder:.59}[id]);
 // Finite leg length plus the ball radius, including a small weight shift.
 return Math.hypot(d,y-.94)<=1.04;
}
export function impactSide(actor,point){const yaw=(actor.yaw||0)+(actor.id===0?Math.PI:0);return (point.x-actor.x)*Math.cos(yaw)-(point.z-actor.z)*Math.sin(yaw)<0?-1:1;}
export function impactSnapshot(actor,id,ball,side=1,yaw=null){
 const facing=yaw??Math.atan2(ball.x-actor.x,ball.z-actor.z);
 return {id,side,yaw:facing,point:{...ball},age:0,duration:['scorpion','around','rabona'].includes(id)?.64:.38};
}
export function upcomingContact(game,a){
 if(game.phase!=='flight'||game.receiver!==a.id||a.contact||game.ballLock>.12)return null;
 const b=game.ball,id=a.id===0?(game.preparedMove||game.actionQueue?.move||game.selectedMove||game.contactFor()):(game.lastShot==='set'?'head':b.position.y>1.3?'chest':'foot');
 const height=(CONTACT_HEIGHT[id]||.65)+(a.jumpY||0),gravity=game.ballConfig.gravity;
 const disc=b.velocity.y*b.velocity.y+2*gravity*(b.position.y-height);if(disc<0)return null;
 const time=(b.velocity.y+Math.sqrt(disc))/gravity;
 if(time<0||time>.42)return null;
 const point={x:b.position.x+b.velocity.x*time,y:height,z:b.position.z+b.velocity.z*time};
 if(Math.hypot(point.x-a.x,point.z-a.z)>1.35)return null;
 const yaw=id==='scorpion'?(a.scorpionYaw??a.yaw+Math.PI):Math.atan2(point.x-a.x,point.z-a.z);
 const side=impactSide(a,point);
 return {id,side,yaw:id==='hip'?yaw-side*Math.PI/2:id==='shoulder'?yaw-side*.6:id==='heel'?yaw+Math.PI:id==='rabona'?yaw+side*1.9:yaw,point,progress:.5*(1-time/.42),anticipating:true};
}
const v=()=>new T.Vector3();
export function contactMarker(person,id,side=1){
 const leg=person.legs[side<0?0:1];
 if(id==='head-side')return{bone:person.head,offset:new T.Vector3(side*.075,.205,.065)};
 if(id==='head')return{bone:person.head,offset:new T.Vector3(0,.205,.085)};
 if(id==='chest')return{bone:person.torso,offset:new T.Vector3(0,.40,.115)};
 if(id==='hip')return{bone:person.hips,offset:new T.Vector3(side*.19,.065,.02)};
 if(id==='shoulder')return{bone:person.torso,offset:new T.Vector3(side*.19,.45,.015)};
 if(id==='knee'||id==='alternate')return{bone:leg.knee,offset:new T.Vector3(0,.13,.08),leg,thigh:true};
 return {bone:leg.foot,offset:new T.Vector3(0,.03,id==='scorpion'||id==='heel'?-.035:.115),leg};
}
export function markerWorld(person,id,side=1){const {bone,offset}=contactMarker(person,id,side);person.root.updateWorldMatrix(true,true);return bone.localToWorld(offset.clone());}
function rotateWorld(bone,from,to,weight=1){
 const rotation=new T.Quaternion().setFromUnitVectors(from.clone().normalize(),to.clone().normalize());
 rotation.slerp(new T.Quaternion(),1-weight);
 const parent=bone.parent.getWorldQuaternion(new T.Quaternion()),world=bone.getWorldQuaternion(new T.Quaternion());
 bone.quaternion.copy(parent.invert().multiply(rotation.multiply(world)));bone.updateWorldMatrix(true,true);
}
// Two rigid segments: joints rotate; no vertex scaling or stretched lower leg.
function fitLeg(leg,goal,bendDirection=null){
 const hip=leg.hip.getWorldPosition(v()),knee=leg.knee.getWorldPosition(v()),foot=leg.foot.getWorldPosition(v());
 const upper=hip.distanceTo(knee),lower=knee.distanceTo(foot),axis=goal.clone().sub(hip),length=clamp(axis.length(),Math.abs(upper-lower)+.01,upper+lower-.008);axis.normalize();
 let pole=bendDirection?bendDirection.clone().addScaledVector(axis,-bendDirection.dot(axis)):knee.clone().sub(hip).addScaledVector(axis,-knee.clone().sub(hip).dot(axis));
 if(pole.length()<.005)pole=new T.Vector3(0,0,1).applyQuaternion(leg.hip.parent.getWorldQuaternion(new T.Quaternion())).addScaledVector(axis,-axis.z);
 pole.normalize();const along=(upper*upper+length*length-lower*lower)/(2*length),across=Math.sqrt(Math.max(0,upper*upper-along*along));
 const desiredKnee=hip.clone().addScaledVector(axis,along).addScaledVector(pole,across);
 rotateWorld(leg.hip,knee.sub(hip),desiredKnee.clone().sub(hip));
 const nextKnee=leg.knee.getWorldPosition(v()),nextFoot=leg.foot.getWorldPosition(v());
 rotateWorld(leg.knee,nextFoot.sub(nextKnee),hip.clone().addScaledVector(axis,length).sub(nextKnee));
}
export function fitContact(person,id,side,ball,weight=1,surfaceOffset=.108){
 const mark=contactMarker(person,id,side);person.root.updateWorldMatrix(true,true);
 let actual=mark.bone.localToWorld(mark.offset.clone());
 // The limb reaches the near surface of the ball, not its centre.
 const target=new T.Vector3(ball.x,ball.y,ball.z),normal=target.clone().sub(actual).normalize();target.addScaledVector(normal,-surfaceOffset);target.lerp(actual,1-weight);
 if(mark.leg&&!mark.thigh){
  for(let i=0;i<3;i++){
   const offset=mark.offset.clone().applyQuaternion(mark.bone.getWorldQuaternion(new T.Quaternion()));
   fitLeg(mark.leg,target.clone().sub(offset));
  }
 }else if(mark.thigh){
  const hip=mark.leg.hip.getWorldPosition(v());rotateWorld(mark.leg.hip,actual.clone().sub(hip),target.clone().sub(hip));
 }else{
  // Weight shift stays small and keeps the stance grounded.
  const error=target.clone().sub(actual);error.clampLength(0,.20);
  const inverse=person.hips.parent.getWorldQuaternion(new T.Quaternion()).invert();error.applyQuaternion(inverse);person.hips.position.add(error);
 }
 person.root.updateWorldMatrix(true,true);
 return mark.bone.localToWorld(mark.offset.clone()).distanceTo(new T.Vector3(ball.x,ball.y,ball.z));
}
export function applyContact(person,contact){
 const progress=contact.anticipating?contact.progress:.5+.5*clamp(contact.age/contact.duration,0,1);
 poseContact(person,contact.id,progress,contact.side);
 // Follow-through releases the impact target smoothly rather than freezing a foot in space.
 const weight=contact.anticipating?Math.pow(progress*2,2):Math.pow(1-clamp(contact.age/contact.duration,0,1),2);
 return fitContact(person,contact.id,contact.side,contact.point,weight);
}

// A complete circle relative to the moving ball. Start and finish below it.
export function orbitPoint(ball,sequence){
 const t=clamp(sequence.elapsed/sequence.loopDuration,0,1),angle=t*Math.PI*2*sequence.direction;
 const radius=.108+.17*Math.sin(Math.PI*t),x=Math.sin(angle)*radius*sequence.side;
 return {x:ball.x+x*Math.cos(sequence.yaw),y:ball.y-Math.cos(angle)*radius,z:ball.z-x*Math.sin(sequence.yaw)};
}
export function applyOrbit(person,sequence,ball){
 poseContact(person,'foot',.5,sequence.side);person.torso.rotation.x=-.10;
 for(const a of person.arms){a.shoulder.rotation.z=-a.s*.16;a.elbow.rotation.x=.3;}
 const target=orbitPoint(ball,sequence);fitContact(person,'foot',sequence.side,target,1,0);return target;
}
// Stance feet stay on the sand; swing feet step toward the next support point.
export function poseLocomotion(person,actor,time,dt){
 const speed=actor.speed||0;person.gait ||= {phase:actor.id*.19,feet:[]};const gait=person.gait;
 const moving=speed>.15&&!actor.contact&&!actor.dive&&!(actor.jumpY>0);
 const pulse=Math.sin(time*(2.1+(actor.id||0)*.07)+(actor.id||0));
 person.hips.position.y+=pulse*.005;person.torso.rotation.x+=Math.min(.16,speed*.035);
 person.torso.rotation.z+=Math.sin(gait.phase*Math.PI*2)*Math.min(.035,speed*.012);
 person.torso.rotation.y+=Math.sin(gait.phase*Math.PI*2)*Math.min(.06,speed*.018);
 relaxArms(person,Math.sin(gait.phase*Math.PI*2+.45),speed);
 if(!moving){gait.feet=[];gait.root=null;for(const l of person.legs)l.knee.rotation.x=.06;return;}
 gait.phase=(gait.phase+speed*dt/(.62+speed*.10))%1;
 person.root.updateWorldMatrix(true,true);
 const rootPosition=person.root.getWorldPosition(v()),delta=gait.root?rootPosition.clone().sub(gait.root):v();gait.root=rootPosition.clone();
 const vx=dt&&delta.length()<.5?delta.x/dt:0,vz=dt&&delta.length()<.5?delta.z/dt:0;
 for(let i=0;i<2;i++){
  const leg=person.legs[i],phase=(gait.phase+i*.5)%1,stance=phase<.60;
  let f=gait.feet[i];if(!f){f=gait.feet[i]={anchor:leg.foot.getWorldPosition(v()),start:leg.foot.getWorldPosition(v()),stance};f.anchor.y=.078;}
  const next=new T.Vector3(leg.s*.23,.078,.02);person.root.localToWorld(next);next.y=.078;const lead=Math.min(.18,.32/Math.max(.1,speed));next.x+=vx*lead;next.z+=vz*lead;
  if(stance&&!f.stance){f.anchor=(f.last||next).clone();f.anchor.y=.078;}
  if(!stance&&f.stance)f.start=f.anchor.clone();
  let goal=f.anchor.clone();
  if(!stance){const u=(phase-.60)/.40;goal=f.start.clone().lerp(next,u*.8+.2*u*u*(3-2*u));goal.y+=Math.sin(Math.PI*u)*(.065+speed*.023);}

  const forward=new T.Vector3(0,0,1).applyQuaternion(person.root.getWorldQuaternion(new T.Quaternion()));
  fitLeg(leg,goal,forward);
  const flat=person.root.getWorldQuaternion(new T.Quaternion());leg.foot.quaternion.copy(leg.foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(flat));
  if(!stance)leg.foot.rotation.x=-.12*Math.sin(Math.PI*(phase-.60)/.40);
  f.last=goal.clone();f.stance=stance;
 }
}
