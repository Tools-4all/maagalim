const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=t=>t*t*(3-2*t);
export function beginDive(actor,goal){
 if(actor.dive||(actor.diveCooldown||0)>0||(actor.jumpY||0)>.03)return false;
 const dx=goal.x-actor.x,dz=goal.z-actor.z,d=Math.hypot(dx,dz);if(d>2.15||d<.25)return false;
 const yaw=Math.atan2(dx,dz),side=dx*Math.cos(actor.yaw||0)-dz*Math.sin(actor.yaw||0)<0?-1:1;
 actor.dive={age:0,duration:1.05,x:actor.x,z:actor.z,dx:dx/d,dz:dz/d,reach:clamp(d-.60,0,.92),yaw,side};actor.diveCooldown=1.4;return true;
}
export function advanceDive(actor,dt){
 actor.diveCooldown=Math.max(0,(actor.diveCooldown||0)-dt);const dive=actor.dive;if(!dive)return false;
 dive.age+=dt;const u=smooth(clamp(dive.age/.32,0,1)),x=dive.x+dive.dx*dive.reach*u,z=dive.z+dive.dz*dive.reach*u;
 actor.vx=dt?(x-actor.x)/dt:0;actor.vz=dt?(z-actor.z)/dt:0;actor.speed=Math.hypot(actor.vx,actor.vz);actor.x=x;actor.z=z;
 if(dive.age>=dive.duration){actor.dive=null;actor.vx=actor.vz=actor.speed=0;}return true;
}
export function diveWeight(dive){return dive.age<.20?smooth(clamp(dive.age/.20,0,1)):1-smooth(clamp((dive.age-.46)/.59,0,1));}
