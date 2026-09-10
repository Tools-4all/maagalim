import {beginDive,advanceDive} from './dive.js';
import {bodyReach} from './contact.js';
// Continuous interception and support positions; no scripted teleport to the ball.
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
const future=(b,t,g)=>({x:b.position.x+b.velocity.x*t,y:b.position.y+b.velocity.y*t-g*t*t/2,z:b.position.z+b.velocity.z*t,t});
export function interception(ball,actor,high=false,gravity=9.81){
 let best=null;
 for(let t=.04;t<=2.8;t+=.045){
  const p=future(ball,t,gravity);if(p.y<.17)break;
  if(ball.velocity.y-gravity*t>0||p.y>(high?2.65:1.72))continue;
  const reach=p.y<.85?1.08:.82,margin=gap(p,actor)-(Math.max(0,t-(actor.delay||0))*4.35+reach);
  const plan={...p,gap:margin};
  if(!best||margin<best.gap)best=plan;if(margin<=0)return plan;
 }
 if(best)return best;
 const disc=ball.velocity.y**2+2*gravity*Math.max(0,ball.position.y-.35);
 const t=Math.max(.02,(ball.velocity.y+Math.sqrt(disc))/gravity),p=future(ball,t,gravity);
 return {...p,gap:gap(p,actor)-4.35*t-.85};
}
function travel(a,target,maxSpeed,dt){
 const dx=target.x-a.x,dz=target.z-a.z,d=Math.hypot(dx,dz);
 const speed=Math.min(maxSpeed,d*7),vx=d>.025?dx/d*speed:0,vz=d>.025?dz/d*speed:0;
 const change=Math.hypot(vx-(a.vx||0),vz-(a.vz||0)),f=change?Math.min(1,15*dt/change):1;
 a.vx=(a.vx||0)+(vx-(a.vx||0))*f;a.vz=(a.vz||0)+(vz-(a.vz||0))*f;
 a.x+=a.vx*dt;a.z+=a.vz*dt;a.speed=Math.hypot(a.vx,a.vz);
 const radius=Math.hypot(a.x,a.z);if(radius>9.5){a.x*=9.5/radius;a.z*=9.5/radius;}
}
export function updateOpponents(game,dt){
 const actors=game.actors.slice(1),flying=game.phase==='flight';
 for(const a of actors){
  a.reaction=Math.max(0,a.reaction-dt);a.moveTime=Math.max(0,a.moveTime-dt);a.delay=Math.max(0,(a.delay||0)-dt);
  a.jumpCooldown=Math.max(0,(a.jumpCooldown||0)-dt);
  if(a.jumpY>0||a.jumpVelocity){a.jumpY=Math.max(0,(a.jumpY||0)+(a.jumpVelocity||0)*dt-6*dt*dt);a.jumpVelocity=(a.jumpVelocity||0)-12*dt;if(a.jumpY===0)a.jumpVelocity=0;}
 }
 if(game.phase==='demo'||game.phase==='guide-ready')return;
 const high=game.lastShot==='set',plans=actors.map(a=>({a,p:interception(game.ball,a,high,game.ballConfig.gravity)}));
 const available=plans.filter(x=>x.a.id!==game.lastHitter);
 let chosen=plans.find(x=>x.a.id===game.receiver);
 if(flying&&!game.practice&&available.length){
  const ranked=[...available].sort((x,y)=>(x.p.gap+x.p.t*.18-(x.a.id===game.receiver ? .5 : 0))-(y.p.gap+y.p.t*.18-(y.a.id===game.receiver ? .5 : 0)));
  const best=ranked[0],playerGoal=interception(game.ball,game.player,high,game.ballConfig.gravity);
  const belongsToPlayer=game.receiver===0&&gap(playerGoal,game.player)<2.55;
  const clearlyCloser=chosen&&gap(best.a,best.p)+1.25<gap(chosen.a,chosen.p)&&best.p.gap<chosen.p.gap-.45;
  if(!belongsToPlayer&&(!chosen||chosen.p.gap>.20&&best.p.gap<chosen.p.gap-.35||clearlyCloser)&&best.a.id!==game.receiver){
   const previous=game.receiver;game.receiver=best.a.id;chosen=best;
   game.emit('cover',{actor:best.a.id,previous});
  }
 }
 chosen=plans.find(x=>x.a.id===game.receiver);
 const dropPoint=chosen?.p||interception(game.ball,game.player,high,game.ballConfig.gravity);
 const wide=flying&&Math.hypot(dropPoint.x,dropPoint.z)>4.6;
 const backup=available.filter(x=>x.a.id!==game.receiver).sort((x,y)=>gap(x.a,dropPoint)-gap(y.a,dropPoint))[0]?.a.id;
 for(const a of actors){
  a.role='support';a.saving=false;
  let target={...a.home},speed=1.8;
  if(flying&&a.id===game.receiver){
   const plan=plans.find(x=>x.a===a).p;target=plan;a.role='receive';a.saving=gap(a,plan)>1.35;
   speed=gap(a,plan)>1.3?4.65:3.0;
   if(high&&a.jumpCooldown===0&&!a.jumpY&&game.ball.velocity.y<0&&game.ball.position.y>2.1&&gap(a,game.ball.position)<.9){a.jumpVelocity=3.35;a.jumpCooldown=.9;}
  }else if(flying&&wide&&a.id===backup){
   const d=Math.hypot(dropPoint.x,dropPoint.z)||1;
   target={x:dropPoint.x-dropPoint.x/d*1.7,z:dropPoint.z-dropPoint.z/d*1.7};speed=3.65;a.role='cover';
  }else if(flying){
   // Follow the moving centre, open a passing lane and recover after your own touch.
   const receiver=game.actors[game.receiver],cx=limit((dropPoint.x+(receiver?.x||0))*.20,-1.35,1.35),cz=limit((dropPoint.z+(receiver?.z||0))*.17,-1.1,1.1);
   const angle=Math.atan2(a.home.z,a.home.x)+Math.sin(game.elapsed*.85+a.id*1.8)*.12;
   const radius=3.15+.3*Math.sin(game.elapsed*1.05+a.id);
   target={x:cx+Math.cos(angle)*radius,z:cz+Math.sin(angle)*radius};
   if(a.id===game.lastHitter){target.x=(target.x+a.home.x)*.5;target.z=(target.z+a.home.z)*.5;}
   a.role=game.lastShot==='set'?'defend':'offer';speed=2.25;
  }
  if(flying&&a.id===game.receiver&&!game.practice&&!a.dive){const low=interception(game.ball,a,false,game.ballConfig.gravity);if(low.t<.34&&low.y<1.0&&gap(a,low)>.86&&gap(a,low)<2.1&&game.ball.velocity.y<0&&game.ball.position.y<1.15){if(beginDive(a,low))game.emit('dive',{actor:a.id});}}
  if(advanceDive(a,dt)){a.role='rescue';a.saving=true;continue;}
  if(game.practice&&a.id!==game.receiver){target={...a.home};speed=.5;}
  if(a.delay>0||game.phase==='drop'){a.vx=a.vz=a.speed=0;continue;}
  if(a.contact&&a.contact.age<.10){a.vx*=.65;a.vz*=.65;speed=Math.min(speed,.6);}
  travel(a,target,speed,dt);
 }
 // Leave physical space around another body, including the controlled player.
 if(!game.practice)for(let i=1;i<game.actors.length;i++)for(let j=0;j<i;j++){
  const a=game.actors[i],b=game.actors[j],dx=a.x-b.x,dz=a.z-b.z,d=Math.hypot(dx,dz);
  if(d>0&&d<.68){const push=(.68-d)*Math.min(1,dt*9),f=j===0?1:.5;a.x+=dx/d*push*f;a.z+=dz/d*push*f;if(j!==0){b.x-=dx/d*push*.5;b.z-=dz/d*push*.5;}}
 }
}
export function tryOpponentContact(game){
 if(game.ballLock>0||game.ball.velocity.y>=0||game.phase!=='flight')return;
 const ball=game.ball.position,nearPlayer=gap(ball,game.player)<2.1;
 const candidates=game.actors.slice(1).filter(a=>a.id!==game.lastHitter&&!(a.dive&&a.dive.age>.48)&&!a.failedDefense&&a.delay<=0&&(game.receiver!==0||!nearPlayer)).sort((a,b)=>gap(a,ball)-gap(b,ball));
 for(const a of candidates){
  const y=ball.y-(a.jumpY||0),d=gap(a,ball),set=game.lastShot==='set';
  const low=y>.17&&y<.94,high=set&&y>1.6&&y<2.06,normal=!set&&y>.2&&y<1.65;
  if(!low&&!high&&!normal)continue;
  const controlled=game.lastHitter===0&&game.lastShot==='smash'&&game.lastSmash?.spread===0;
  const fast=Math.hypot(game.ball.velocity.x,game.ball.velocity.z)>8;
  const reach=controlled?.88:low?1.10:fast?.78:.88;
  if(d>reach||!bodyReach(a.dive?'knee-save':high?'head':low?'foot':y>1.18?'chest':y>.95?'knee':'foot',ball,a))continue;
  if(!controlled&&fast&&game.random()<.045){a.failedDefense=true;continue;}
  const rescue=low&&(d>.7||a.saving||!!a.dive);
  if(game.lastShot==='smash'||rescue)game.emit('save',{actor:a.id,rescue});
  game.aiHit(a,rescue);return;
 }
}
