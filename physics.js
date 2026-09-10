import {beginDive,advanceDive} from './dive.js';
import {CONTACT_HEIGHT,impactSnapshot,bodyReach,impactSide} from './contact.js';
import {EXERCISES,BALLS,LEVELS} from './data.js';
import {updateOpponents,tryOpponentContact} from './opponents.js';
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function launchVelocity(from,to,t,g=9.81){return{x:(to.x-from.x)/t,y:(to.y-from.y+.5*g*t*t)/t,z:(to.z-from.z)/t};}
export function integrate(b,dt,g=9.81){b.position.x+=b.velocity.x*dt;b.position.y+=b.velocity.y*dt-.5*g*dt*dt;b.position.z+=b.velocity.z*dt;b.velocity.y-=g*dt;}
export function landingAt(b,height=.14,g=9.81){const disc=b.velocity.y*b.velocity.y+2*g*(b.position.y-height);if(disc<0)return {...b.position,t:0};const t=(b.velocity.y+Math.sqrt(disc))/g;return{x:b.position.x+b.velocity.x*t,y:height,z:b.position.z+b.velocity.z*t,t};}
export const SMASH_CHARGE={duration:1.2};
export function chargeProfile(seconds){
 const power=clamp(seconds/SMASH_CHARGE.duration,0,1);
 return {power,spread:0,speed:5.8+power*7.6};
}
export const DIFFICULTIES={relaxed:{speed:8,spread:.20,buffer:1.0,slow:.70},hard:{speed:12.8,spread:.58,buffer:.48,slow:1},expert:{speed:15.2,spread:.85,buffer:.28,slow:1}};
export const RANGES={foot:[.16,1.04,1.24],knee:[.70,1.40,1.07],head:[1.60,2.04,.68],chest:[1.12,1.61,.57],inside:[.16,1.06,1.27],outside:[.16,1.06,1.27],around:[.18,1.04,1.22],heel:[.18,1.02,1.20],shoulder:[1.40,1.62,.58],alternate:[.80,1.42,1.1],cross:[.18,1.05,1.22],lunge:[.16,.88,1.18],scorpion:[1.06,1.64,.78],hip:[.84,1.24,.57],rabona:[.18,.78,.95],'side-lunge':[.16,.86,1.22],'around-reverse':[.18,1.04,1.22],'foot-stall':[.24,.80,.9],'head-side':[1.60,1.91,.62],'knee-save':[.16,.84,1.1]};
export class Game{
 constructor(random=Math.random){this.random=random;this.level=LEVELS[0];this.ballConfig=BALLS[0];this.easy=true;this.difficulty='hard';this.practice=false;this.reset();}
 reset(){this.preparedMove=null;this.quickGroup='low';this.status='idle';this.phase='serve';this.score=0;this.combo=0;this.bestCombo=0;this.hits=0;this.smashes=0;this.assists=0;this.drops=0;this.charge=0;this.elapsed=0;this.timer=0;this.smashCharge={active:false,seconds:0};this.lastSmash=null;this.jumpCooldown=0;this.cooldown=0;this.ballLock=0;this.lastHitter=1;this.lastShot='pass';this.assistOwner=-1;this.chain=0;this.receiver=0;this.events=[];this.buffer=null;this.actionQueue=null;this.alternateChain=null;this.sequence=null;this.trickChain=[];this.trickCount=0;this.lastTouchName='';this.practiceRefill=0;this.practiceSuccess=false;this.practiceSuccesses=0;this.guided=false;this.guideHoldConsumed=false;this.demoTime=0;this.aiAttacks=0;this.playerSaves=0;this.mode='pass';this.approachAim=true;this.approach={x:0,z:-1,speed:0};this.manualApproach={...this.approach};this.current='foot';this.player={id:0,name:'אתה',x:0,z:3.6,yaw:0,speed:0,jumpY:0,jumpVelocity:0};this.actors=[this.player,...this.level.opponents.map((a,i)=>({...a,id:i+1,home:{x:a.x,z:a.z},reaction:0,move:'foot',moveTime:0}))];this.ball={position:{x:0,y:.8,z:-2.95},velocity:{x:0,y:0,z:0}};this.aim={x:0,z:-3.3};this.aimActor=1;this.targetPoint={x:0,y:.7,z:3};this.inputVector={x:0,z:0,sprint:false};this.manualHeld=false;this.assistSuppressed=false;this.selectedMove=null;this.player.contact=null;this.player.scorpionYaw=null;this.player.dive=null;this.rallyMode=false;}
 emit(type,detail={}){this.events.push({type,...detail});}
 drain(){return this.events.splice(0);}
 start(){this.reset();this.status='playing';this.serve();}
 selectMove(id){this.selectedMove=RANGES[id]?id:null;this.player.scorpionYaw=null;this.actionQueue=null;}
 exercise(){return EXERCISES.find(e=>e.id===this.current);}
 contactFor(intent='pass'){
  const y=this.ball.position.y-this.player.jumpY;
  if(intent==='pass'&&y<.80&&distance(this.ball.position,this.player)>.85)return 'knee-save';
  if((intent==='set'||intent==='pass')&&y>=1.18&&y<=1.82&&this.player.jumpY<.12)return 'chest';
  return y>1.65?'head':y>1.0?'knee':'foot';
 }
 playAction(intent='pass',move=null,power=.7,charge=null){
  if(this.status!=='playing'||!['flight','serve','guide-ready'].includes(this.phase))return false;
  if(this.phase==='guide-ready'){this.phase='flight';this.guideHoldConsumed=true;}
  if(this.sequence&&(!move||move===this.sequence.id))return false;
  this.preparedMove=null;this.assistSuppressed=false;this.cancelCharge();this.mode=intent;const id=move||(intent==='pass'?this.selectedMove:null)||this.contactFor(intent);move=move||(intent==='pass'?this.selectedMove:null);if(id==='scorpion'&&this.player.scorpionYaw==null)this.player.scorpionYaw=this.player.yaw+Math.PI;if(id!=='alternate')this.alternateChain=null;if(this.sequence&&id!==this.sequence.id)this.sequence=null;if(id==='knee-save'&&!this.player.dive)beginDive(this.player,landingAt(this.ball,.38));
  if(this.canHit(id)){this.hit(id,power,charge);return true;}
  // One queued intent waits for a real body contact, never a remote hit.
  this.actionQueue={intent,move,power,charge,ttl:move==='scorpion'?2.2:this.lastShot==='smash'?DIFFICULTIES[this.difficulty].buffer:this.easy?1.2:.35};
  this.emit('queued',{id,text:move?EXERCISES.find(e=>e.id===move)?.name:'מוכן למגע'});return false;
 }
 preparePractice(id){
  this.practice=true;this.practiceMove=id;this.status='playing';this.phase='serve';this.timer=1.05;this.actionQueue=null;this.cancelCharge();
  this.practiceFeed();
 }
 beginGuide(id){this.preparePractice(id);this.guided=true;this.showDemo();}
 showDemo(){
  this.phase='demo';this.demoTime=0;this.practiceRefill=0;this.actionQueue=null;this.buffer=null;this.cancelCharge();
  this.sequence=null;this.player.dive=null;this.player.contact=null;this.player.scorpionYaw=null;this.player.jumpY=this.player.jumpVelocity=this.player.speed=0;this.move(0,0);this.ball.velocity={x:0,y:0,z:0};
 }
 tryGuide(){this.player.yaw=0;this.practiceFeed();}
 practiceFeed(){
  this.practiceRefill=0;this.alternateChain=null;this.sequence=null;this.player.dive=null;this.player.contact=null;this.player.scorpionYaw=null;this.guideHoldConsumed=false;this.actionQueue=null;this.buffer=null;this.cooldown=0;this.cancelCharge();
  const id=this.practiceMove||'chest',p=this.player,a=this.actors[1];
  const from={x:p.x-Math.sin(p.yaw)*3.4,y:1.25,z:p.z-Math.cos(p.yaw)*3.4};a.x=from.x;a.z=from.z;
  this.ball.position=from;const height=id==='head'?(this.guided?2.7:1.98):CONTACT_HEIGHT[id]||.62;const reach=id==='scorpion'?-.52:.48;if(id==='scorpion')p.scorpionYaw=p.yaw+Math.PI;
  this.launch({x:p.x-Math.sin(p.yaw)*reach,y:height,z:p.z-Math.cos(p.yaw)*reach},1.65,1,0,'pass');
  this.current=id;this.setAim(this.actors[2],2);this.emit('practiceFeed',{id});
 }

 move(x,z,sprint=false,manual=false){this.manualHeld=manual;this.inputVector={x:clamp(x,-1,1),z:clamp(z,-1,1),sprint};}
 stopManualMovement(){this.manualHeld=false;this.assistSuppressed=true;this.inputVector={x:0,z:0,sprint:false};this.player.speed=0;this.approach.speed=0;this.manualApproach.speed=0;this.assisting=false;}
 setAim(point,actor=0){this.approachAim=false;this.aim={x:clamp(point.x,-7,7),z:clamp(point.z,-7,7)};this.aimActor=actor;}
 setMode(mode){if(!['pass','set','smash'].includes(mode))return;if(mode!=='smash')this.cancelCharge();this.mode=mode;this.emit('mode',{mode});}
 jump(){
  if(this.status!=='playing'||this.phase==='drop'||this.player.jumpY>0||this.jumpCooldown>0||this.phase==='demo'||this.player.dive||this.sequence)return false;
  if(this.phase==='guide-ready'){this.phase='flight';this.guideHoldConsumed=true;}
  this.player.jumpVelocity=4.9;this.jumpCooldown=.15;this.emit('jump');return true;
 }
 beginCharge(){if(this.status!=='playing'||!['flight','guide-ready'].includes(this.phase)||this.smashCharge.active||this.sequence||this.player.dive)return false;if(this.phase==='guide-ready'){this.phase='flight';this.guideHoldConsumed=true;}this.preparedMove=null;const target=this.shotTarget();this.setAim(target,this.aimActor);this.mode='smash';this.smashCharge={active:true,seconds:0};this.emit('chargeStart');this.emit('feedback',{text:'מחזיקים לכוח · משחררים להנחתה'});return true;}
 cancelCharge(){this.smashCharge={active:false,seconds:0};}
 releaseCharge(){
  if(!this.smashCharge.active)return false;
  const profile=chargeProfile(this.smashCharge.seconds);this.lastSmash={...profile};this.cancelCharge();
  const id=this.contactFor('smash');
  if(this.easy)return this.playAction('smash',null,profile.power,profile);
  return this.input(id,profile.power,profile);
 }
 // Entry direction is a world-space velocity, independent of camera tracking.
 useApproachAim(){this.approachAim=true;}
 shotTarget(){
  if(!this.approachAim)return {...this.aim};
  const p=this.player,b=this.ball.position,v=this.approach;
  let dx=v.speed>.25?v.x:-Math.sin(p.yaw),dz=v.speed>.25?v.z:-Math.cos(p.yaw);
  // The contact normal contributes: approach the ball from the opposite side
  // to lift it toward a neighbour. Momentum dominates while running.
  const d=distance(b,p);
  if(v.speed>.25&&d>.12){dx=dx*.8+(b.x-p.x)/d*.2;dz=dz*.8+(b.z-p.z)/d*.2;}
  const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
  let best=null,bestDot=.52;
  for(const a of this.actors.slice(1)){const ad=distance(b,a);if(ad<.65)continue;const dot=((a.x-b.x)*dx+(a.z-b.z)*dz)/ad;if(dot>bestDot){bestDot=dot;best=a;}}
  const reach=best?distance(b,best):4.8;
  // High lifts gently assist the intended receiver. Smashes preserve aim.
  const assist=this.mode==='set'&&best? .72 : this.mode==='pass'&&best ? .45 : 0;
  const raw={x:b.x+dx*reach,z:b.z+dz*reach};
  return {x:clamp(raw.x*(1-assist)+(best?.x||0)*assist,-7,7),z:clamp(raw.z*(1-assist)+(best?.z||0)*assist,-7,7)};
 }
 shotPlan(id=this.current,power=this.smashCharge.active?chargeProfile(this.smashCharge.seconds).power:.7){
  const juggle=this.mode!=='smash'&&((['around','around-reverse','foot-stall'].includes(id)&&!this.sequence)||(id==='alternate'&&!this.alternateChain));
  const target=juggle?{x:this.player.x-Math.sin(this.player.yaw)*.45,z:this.player.z-Math.cos(this.player.yaw)*.45}:this.shotTarget(),pos=this.ball.position,d=distance(pos,target);
  let shot=this.mode==='smash'?'smash':juggle?'juggle':['chest','shoulder','hip','scorpion','foot-stall'].includes(id)?'set':this.mode;
  const duration=shot==='juggle'?(['around','around-reverse'].includes(id)?.62:.72):shot==='smash'?clamp(d/(5.8+power*7.6+this.player.speed*.3),.32,1.4):shot==='set'?clamp(1.25+d*.035,1.25,1.7):clamp(.95+d*.045,.95,1.5);
  return {target,shot,duration,height:shot==='juggle'?(id==='alternate'?1.12:['around','around-reverse'].includes(id)?.50:.70):shot==='smash'?.13:shot==='set'?2.05:.68};
 }
 serve(){if(this.practice){this.practiceFeed();return;}this.sequence=null;this.actionQueue=null;this.cancelCharge();this.phase='serve';this.timer=1.35;this.buffer=null;this.ballLock=0;this.chain=0;this.assistOwner=-1;const a=this.actors[1];this.ball.position={x:a.x,y:.8,z:a.z+.35};this.ball.velocity={x:0,y:0,z:0};this.lastHitter=1;this.receiver=0;this.emit('serve',{actor:1});}
 launch(to,duration,hitter,receiver,shot='pass'){if(hitter>0&&receiver===0)this.assistSuppressed=false;this.ball.velocity=launchVelocity(this.ball.position,to,duration,this.ballConfig.gravity);this.ballLock=.18;this.lastHitter=hitter;this.receiver=receiver;this.lastShot=shot;this.legalPlacement=hitter!==0||shot==='juggle'||distance(to,this.actors[receiver])<=2.25;this.targetPoint={...to};this.phase='flight';this.flightTime=0;this.duration=duration;const receiverActor=this.actors[receiver];if(receiverActor&&receiver){receiverActor.delay=shot==='smash'?.09:.025;receiverActor.failedDefense=false;}}
 get nearby(){return distance(this.ball.position,this.player)<1.55;}
 get hittable(){return this.canHit(this.current);}
 canHit(id){if(this.sequence?.kind==='orbit'&&id===this.sequence.id&&this.sequence.elapsed<this.sequence.loopDuration)return false;if(this.player.dive&&this.player.dive.age>.48)return false;if(id==='scorpion'){const yaw=this.player.scorpionYaw??this.player.yaw+Math.PI,dx=this.ball.position.x-this.player.x,dz=this.ball.position.z-this.player.z;if(dx*Math.sin(yaw)+dz*Math.cos(yaw)>-.12)return false;}if(this.status!=='playing'||this.phase!=='flight'||this.cooldown>0||this.ballLock>0)return false;const r=RANGES[id];return !!r&&bodyReach(id,this.ball.position,this.player)&&distance(this.ball.position,this.player)<=r[2]+(this.easy?.22:0)&&this.ball.position.y>=r[0]+this.player.jumpY&&this.ball.position.y<=r[1]+this.player.jumpY;}
 input(id,power=.7,charge=null){if(this.status!=='playing'||this.cooldown>.05)return false;if(!RANGES[id])return false;this.emit('swing',{id});if(this.canHit(id)){this.hit(id,power,charge);return true;}this.buffer={id,power,charge,ttl:.18};const dist=distance(this.ball.position,this.player);this.emit('feedback',{text:this.phase==='serve'?'מחכים להגשה':dist>1.35?'התקרב לכדור':this.ball.position.y>RANGES[id][1]?'תן לכדור לרדת עוד קצת':'הכדור נמוך — נסה רגל'});return false;}
 hit(id,power,charge=null){this.preparedMove=null;if(this.lastShot==='smash'&&this.lastHitter>0&&this.receiver===0){this.playerSaves++;this.score+=20;this.emit('playerSave');}this.actionQueue=null;const finishingSequence=this.sequence?.id===id;const pos=this.ball.position;let impactYaw=id==='scorpion'?(this.player.scorpionYaw??this.player.yaw+Math.PI):Math.atan2(pos.x-this.player.x,pos.z-this.player.z);const side=this.alternateChain?.side==='left'?-1:this.alternateChain?.side==='right'?1:impactSide(this.player,pos);if(id==='hip')impactYaw-=side*Math.PI/2;if(id==='shoulder')impactYaw-=side*.6;if(id==='heel')impactYaw+=Math.PI;if(id==='rabona')impactYaw+=side*1.9;if(id==='head-side')impactYaw-=side*.48;this.player.contact=impactSnapshot(this.player,id,pos,side,impactYaw);this.player.scorpionYaw=null;const r=RANGES[id],ideal=(r[0]+r[1])*.5+this.player.jumpY;const quality=clamp(1-Math.abs(pos.y-ideal)/(r[1]-r[0])*.8-distance(pos,this.player)*.22,.15,1);this.cooldown=['around','around-reverse'].includes(id)?.5:.32;this.buffer=null;this.hits++;this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.score+=Math.round(10+Math.min(this.combo,20)*2+quality*6);this.charge=Math.min(3,this.charge+1);const plan=this.shotPlan(id,power),target={...plan.target};
 const accuracy=charge||chargeProfile(power*SMASH_CHARGE.duration);
 if(plan.shot==='smash'&&accuracy.spread>0){const angle=this.random()*Math.PI*2;target.x+=Math.cos(angle)*accuracy.spread;target.z+=Math.sin(angle)*accuracy.spread;}
 const near=this.actors.slice(1).sort((a,b)=>distance(a,target)-distance(b,target))[0];const {shot,duration,height}=plan;if(shot==='smash')this.charge=0;this.assistOwner=shot==='set'?0:-1;this.chain=0;this.launch({...target,y:height},duration,0,shot==='juggle'?0:near.id,shot);this.lastSmash=shot==='smash'?{...accuracy}:null;this.emit('hit',{id,side:side<0?'left':'right',perfect:quality>.7,quality,power,shot,accurate:shot==='smash'&&accuracy.spread===0});if(shot==='smash')this.emit('smash',{actor:0,target:near.id});if(['around','around-reverse'].includes(id)&&!finishingSequence){this.sequence={kind:'orbit',id,elapsed:0,loopDuration:.56,ttl:1.3,side,yaw:impactYaw,direction:id==='around'?1:-1,power};this.player.contact.duration=.12;this.emit('sequenceStart',{id});}else if(id==='foot-stall'&&!finishingSequence){this.sequence={kind:'stall',id,elapsed:0,side,yaw:impactYaw,power,offset:{x:pos.x-this.player.x,z:pos.z-this.player.z},height:pos.y};this.ball.velocity={x:0,y:0,z:0};this.emit('sequenceStart',{id});}else if(id==='alternate'&&!this.alternateChain){this.alternateChain={ttl:1.6,power,side:side<0?'right':'left'};this.emit('feedback',{text:'יפה — נשארים מתחת לכדור לירך השנייה'});}else{this.sequence=null;this.alternateChain=null;this.recordTrick(id);}this.checkWin();}
 recordTrick(id){
  this.lastTouchName=EXERCISES.find(e=>e.id===id)?.name||id;this.trickChain.push(id);if(this.trickChain.length>4)this.trickChain.shift();
  if(['inside','outside','around','chest','heel','shoulder','alternate','cross','lunge','scorpion','hip','rabona','side-lunge','around-reverse','foot-stall','head-side','knee-save'].includes(id)){this.trickCount++;this.score+=15;this.emit('trick',{id,name:this.lastTouchName});}
  const recent=this.trickChain.slice(-3);if(recent.length===3&&new Set(recent).size===3){this.score+=30;this.emit('styleCombo',{name:recent.map(x=>EXERCISES.find(e=>e.id===x)?.name).join(' ← ')});}
  if(this.practice){this.practiceSuccess=id===this.practiceMove&&(!this.guided||id!=='head'||this.player.jumpY>.08);if(this.practiceSuccess)this.practiceSuccesses++;this.practiceRefill=id==='around'?2.8:1.8;this.emit('practiceHit',{id,success:this.practiceSuccess});}
 }
 aiHit(a,rescue=false){
  const incoming=this.lastShot,previous=this.lastHitter,previousAssist=this.assistOwner,pos=this.ball.position;
  const y=pos.y-(a.jumpY||0);a.move=rescue?'knee-save':y>1.8?'head':y>1.18?'chest':y>.95?'knee':'foot';if(this.combo>3&&!rescue&&incoming!=='set'){if(y>.86&&y<1.20&&this.combo%4===0)a.move='hip';else if(y>1.42&&y<1.68&&this.combo%4===1)a.move='shoulder';else if(y<.90)a.move=this.combo%2?'inside':'outside';}a.moveTime=(rescue?.72:.6)*.5;a.contact=impactSnapshot(a,a.move,pos,impactSide(a,pos));
  if(rescue){if(!a.dive&&beginDive(a,pos))a.dive.reach=0;if(a.dive){a.contact.yaw=a.dive.yaw;}a.contact.duration=.78;}
  if(a.move==='hip')a.contact.yaw-=a.contact.side*Math.PI/2;if(a.move==='shoulder')a.contact.yaw-=a.contact.side*.6;
  this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.emit('aiHit',{actor:a.id,move:a.move});
  let target,shot,height,duration;
  if(incoming==='set'&&a.move==='head'&&!rescue){
   const opposite={1:0,2:3,3:2};
   target=this.actors[previous===0?opposite[a.id]:0];shot='smash';height=.22;
   duration=clamp(distance(a,target)/DIFFICULTIES[this.difficulty].speed,.36,1.05);this.aiAttacks++;
   this.assistOwner=previous===0?0:previousAssist;
   this.emit('smash',{actor:a.id,target:target.id});if(target.id===0)this.emit('incomingAttack',{actor:a.id});
  }else{
   // A controlled reception starts a real set → attack rather than another flat pass.
   if(previous===0)target=this.player;
   else if(a.id===1)target=this.actors[this.random()<.5?2:3];
   else target=this.actors[1];
   shot='set';height=target.id===0?2.50:2.12;duration=1.45+Math.min(.2,distance(a,target)*.025);
   if(previousAssist===0&&previous!==0){this.score+=25;this.assists++;this.emit('setupBonus');}
   this.assistOwner=-1;
  }
  let x=target.x,z=target.z;
  if(target.id===0){const dx=pos.x-target.x,dz=pos.z-target.z,d=Math.hypot(dx,dz)||1;const near=shot==='smash'?.38:.65;x+=dx/d*near;z+=dz/d*near;
   if(shot==='smash'){const side=(this.random()-.5)*2*DIFFICULTIES[this.difficulty].spread;x+=dz/d*side;z-=dx/d*side;}
  }else{x+=(this.random()-.5)*.22;z+=(this.random()-.5)*.22;}
  this.launch({x,y:height,z},duration,a.id,target.id,shot);this.current=shot==='set'?'head':'foot';this.emit('incoming',{actor:target.id,exercise:this.current});if(target.id===0&&shot==='set')this.emit('setForPlayer',{actor:a.id});
 }
 miss(){if(this.status!=='playing')return;this.preparedMove=null;this.sequence=null;this.alternateChain=null;this.actionQueue=null;if(this.practice){this.practiceRefill=0;this.phase='drop';this.timer=1.1;this.cancelCharge();this.emit('practiceMiss');return;}let who=this.receiver;if(this.lastHitter===0&&!this.legalPlacement)who=0;this.cancelCharge();this.phase='drop';this.timer=this.rallyMode?1.45:2.05;this.buffer=null;if(who===0){this.drops++;this.combo=0;this.charge=0;}else if(this.lastHitter===0&&this.lastShot==='smash'){this.score+=90+Math.min(this.combo,15)*4;this.smashes++;this.emit('point',{actor:who});}else if(this.assistOwner===0){this.score+=80;this.smashes++;this.assists++;this.emit('assist');}else this.score+=5;
 for(const a of this.actors.slice(1)){a.reaction=2.25;a.isCulprit=a.id===who;}this.emit('drop',{who});this.checkWin();}
 checkWin(){if(this.practice||this.rallyMode)return false;if(this.status==='playing'&&this.score>=this.level.score&&this.smashes>=this.level.smashes){this.status='won';this.emit('won');return true;}return false;}
 updateSequence(dt){
  const sequence=this.sequence;if(!sequence)return false;sequence.elapsed+=dt;
  if(sequence.kind==='stall'){
   if(this.player.speed>1.3||this.player.jumpY>0){this.sequence=null;this.emit('feedback',{text:'האיזון נשבר — נסה שוב כשאתה יציב'});return false;}
   this.ball.position={x:this.player.x+sequence.offset.x,y:sequence.height,z:this.player.z+sequence.offset.z};this.ball.velocity={x:0,y:0,z:0};
   if(this.player.contact){this.player.contact.point={...this.ball.position};this.player.contact.age=0;}
   if(sequence.elapsed>=.36){this.mode='set';this.hit(sequence.id,sequence.power);}return true;
  }
  if(distance(this.ball.position,this.player)>1.35||sequence.elapsed>sequence.ttl){this.sequence=null;this.emit('feedback',{text:'נשארים מתחת לכדור עד למגע השני'});return false;}
  if(sequence.elapsed>=sequence.loopDuration&&this.ball.velocity.y<0&&this.canHit(sequence.id)){this.mode='pass';this.hit(sequence.id,sequence.power);}return false;
 }
 update(dt){if(this.status!=='playing')return;dt=clamp(dt,0,.05);this.elapsed+=dt;for(const a of this.actors){if(a.contact){a.contact.age+=dt;if(a.contact.age>=a.contact.duration)a.contact=null;}}
 if(this.phase==='demo'){this.demoTime+=dt;return;}if(this.phase==='guide-ready')return;
 if(this.practiceRefill>0){this.practiceRefill-=dt;if(this.practiceRefill<=0){this.practiceFeed();return;}}
 if(this.smashCharge.active)this.smashCharge.seconds+=dt;
 this.jumpCooldown=Math.max(0,this.jumpCooldown-dt);
 if(this.player.jumpVelocity!==0||this.player.jumpY>0){this.player.jumpY+=this.player.jumpVelocity*dt-6*dt*dt;this.player.jumpVelocity-=12*dt;if(this.player.jumpY<=0){this.player.jumpY=0;this.player.jumpVelocity=0;this.jumpCooldown=.12;this.emit('land');}}
this.cooldown=Math.max(0,this.cooldown-dt);this.ballLock=Math.max(0,this.ballLock-dt);
 const v={...this.inputVector};this.assisting=false;
 if(this.sequence?.kind!=='stall'&&this.easy&&!this.manualHeld&&!this.assistSuppressed&&this.receiver===0&&this.phase==='flight'&&Math.hypot(v.x,v.z)<.08){const goal=landingAt(this.ball,CONTACT_HEIGHT[this.preparedMove||this.actionQueue?.move||this.selectedMove||(this.practice?this.practiceMove:null)]||1.0);const d=distance(goal,this.player);if(goal.t>0&&goal.t<2.2&&d>.38&&d<3.2){const dx=(goal.x-this.player.x)/d,dz=(goal.z-this.player.z)/d,c=Math.cos(this.player.yaw),s=Math.sin(this.player.yaw);v.x=(dx*c-dz*s)*.7;v.z=(dx*s+dz*c)*.7;this.assisting=true;}}
 const diving=advanceDive(this.player,dt);if(diving){v.x=v.z=0;}const len=Math.hypot(v.x,v.z),rate=v.sprint?4.1:2.3;if(!diving)this.player.speed=Math.min(len,1)*rate;if(len>0){const x=v.x/Math.max(1,len),z=v.z/Math.max(1,len),c=Math.cos(this.player.yaw),s=Math.sin(this.player.yaw);const wx=x*c+z*s,wz=-x*s+z*c,wl=Math.hypot(wx,wz)||1;this.approach={x:wx/wl,z:wz/wl,speed:this.player.speed};if(this.assisting){this.manualApproach.speed=Math.max(0,this.manualApproach.speed-dt*4);this.approach={...this.manualApproach};}else this.manualApproach={...this.approach};this.player.x+=(x*c+z*s)*rate*dt;this.player.z+=(-x*s+z*c)*rate*dt;const rad=Math.hypot(this.player.x,this.player.z);if(rad>7.5){this.player.x*=7.5/rad;this.player.z*=7.5/rad;}}
 if(len===0)this.approach.speed=Math.max(0,this.approach.speed-dt*4);
 updateOpponents(this,dt);
 if(this.phase==='serve'){this.timer-=dt;if(this.timer<=0){const a=this.actors[1];this.ball.position={x:a.x,y:.8,z:a.z+.35};a.moveTime=.3;a.move='foot';a.contact=impactSnapshot(a,'foot',this.ball.position);this.emit('aiHit',{actor:1,move:'foot'});this.launch({x:this.player.x,y:.7,z:this.player.z-.6},1.5,1,0,'pass');this.current='foot';this.emit('incoming',{actor:0,exercise:'foot'});}return;}
 if(this.phase==='drop'){integrate(this.ball,dt);if(this.ball.position.y<this.ballConfig.radius){this.ball.position.y=this.ballConfig.radius;this.ball.velocity.y=Math.abs(this.ball.velocity.y)*.27;this.ball.velocity.x*=.85;this.ball.velocity.z*=.85;}this.timer-=dt;if(this.timer<=0){if(this.practice){this.practiceFeed();}else if(this.drops>=this.level.lives&&!this.rallyMode){this.status='lost';this.emit('lost');}else this.serve();}return;}
 if(this.sequence?.kind==='stall'&&this.updateSequence(dt))return;
 let simDt=dt;if(this.receiver===0&&this.lastShot!=='juggle'&&distance(this.ball.position,this.player)<2&&this.ball.velocity.y<0&&this.ball.position.y<2.4)simDt*=this.lastShot==='smash'?DIFFICULTIES[this.difficulty].slow:this.easy?.78:1;this.flightTime+=simDt;integrate(this.ball,simDt,this.ballConfig.gravity);
 this.current=this.contactFor(this.mode);if(this.sequence?.kind==='orbit')this.updateSequence(simDt);
 if(this.guided&&!this.guideHoldConsumed&&this.receiver===0&&this.ball.velocity.y<0&&!this.actionQueue){
  const ready=this.practiceMove==='head'?distance(this.ball.position,this.player)<1.0&&this.ball.position.y<2.85&&this.ball.position.y>2.4:this.canHit(this.practiceMove);
  if(ready){this.phase='guide-ready';this.emit('guideReady',{id:this.practiceMove});return;}
 }
 if(this.alternateChain){
  this.alternateChain.ttl-=dt;
  if(this.lastHitter===0&&this.receiver===0&&this.ball.velocity.y<0&&this.canHit('alternate')){this.mode='pass';this.hit('alternate',this.alternateChain.power);}
  else if(this.alternateChain.ttl<=0)this.alternateChain=null;
 }
 if(this.preparedMove&&this.receiver===0&&!this.sequence&&!this.player.dive){
  const id=this.preparedMove,settling=!['around','around-reverse','foot-stall'].includes(id)||this.ball.velocity.y<=.3;
  if(settling&&this.canHit(id)){this.mode=['hip','chest','foot-stall'].includes(id)?'set':'pass';this.hit(id,.7);}
 }
 if(this.actionQueue){
  const q=this.actionQueue;q.ttl-=dt;const id=q.move||this.contactFor(q.intent);
  if(this.canHit(id)){this.mode=q.intent;this.hit(id,q.power,q.charge);}else if(q.ttl<=0){this.actionQueue=null;this.emit('feedback',{text:'עוד צעד לכדור ונסה שוב'});}
 }
 if(this.buffer){this.buffer.ttl-=dt;if(this.canHit(this.buffer.id)){const {id,power,charge}=this.buffer;this.hit(id,power,charge);}else if(this.buffer.ttl<=0)this.buffer=null;}
 tryOpponentContact(this);
 if(this.ball.position.y<=this.ballConfig.radius||Math.abs(this.ball.position.x)>12||Math.abs(this.ball.position.z)>12)this.miss();
 }
}
