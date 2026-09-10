import {avatarConfig,disposeAvatar} from './profile-view.js?v=v2';
import {aimFeedback} from './precision.js?v=v2';
import {diveWeight} from './dive.js?v=v2';
import {applyContact,upcomingContact,markerWorld,CONTACT_HEIGHT,applyOrbit,poseLocomotion} from './contact.js?v=v2';
import * as T from './vendor/three.module.js?v=v2';
import {clamp,launchVelocity,landingAt} from './physics.js?v=v2';
import {makeHuman} from './avatar.js?v=v2';
import {followAngles,angleDelta} from './camera.js?v=v2';
import {relaxArms,prepareChest,poseContact,poseKneeSave,poseJump} from './motion.js?v=v2';
import {createOcean,volleyballMaterial} from './surfaces.js?v=v2';
import {createBeachLife,updateBeachLife,nearestCircle,roamBlockers} from './crowd.js?v=v2';
import {resetRoam} from './roam.js?v=v2';
const Y=new T.Vector3(0,1,0);
const material=(c,r=.85)=>new T.MeshStandardMaterial({color:c,roughness:r});
function mesh(parent,geo,mat,x=0,y=0,z=0){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function ellipsoid(parent,mat,x,y,z,sx,sy,sz){const m=mesh(parent,new T.SphereGeometry(1,18,14),mat,x,y,z);m.scale.set(sx,sy,sz);return m;}
function limb(parent,mat,len,r1,r2){return mesh(parent,new T.CylinderGeometry(r1,r2,len,12),mat,0,-len/2,0);}
function animatePerson(p,a,time,ball,dt,game){
 const contact=a.contact||upcomingContact(game,a);
 p.root.position.set(a.x,a.jumpY||0,a.z);const targetAngle=a.dive?a.dive.yaw:contact?contact.yaw:a.speed>.3&&a.moveTime<=0?Math.atan2(a.vx,a.vz):Math.atan2(ball.x-a.x,ball.z-a.z);p.root.rotation.y+=angleDelta(targetAngle,p.root.rotation.y)*(1-Math.exp(-12*dt));if(a.contact?.age===0)p.root.rotation.y=targetAngle;a.yaw=p.root.rotation.y;
 p.hips.position.set(0,p.baseY,.015613);p.hips.rotation.set(0,0,0);const speed=a.speed||0;p.stride=(p.stride||0)+speed*dt*4;const walk=Math.sin(p.stride);p.hips.position.y=p.baseY+Math.sin(time*2.5+a.id)*.006+Math.abs(walk)*speed*.006;
 p.torso.rotation.set(0,0,Math.sin(time*1.7+a.id)*.009);p.head.rotation.set(clamp(-Math.atan2(ball.y-1.65-(a.jumpY||0),Math.max(.5,Math.hypot(ball.x-a.x,ball.z-a.z))),-.5,.4),0,0);
 for(const l of p.legs){l.hip.rotation.set(walk*l.s*speed*.12,0,-l.s*.028);l.knee.rotation.set(Math.max(0,-walk*l.s)*speed*.1,0,0);l.foot.rotation.set(0,0,0);}
 poseLocomotion(p,a,time,dt);
 if(a.moveTime<=0&&a.reaction<=0&&Math.hypot(ball.x-a.x,ball.z-a.z)<1.15&&ball.y>1.12&&ball.y<1.95)prepareChest(p);

 poseJump(p,a,dt);
 if(a.dive&&contact?.id!=='knee-save')poseKneeSave(p,diveWeight(a.dive),a.dive.side);
 if(contact)applyContact(p,contact);
 if(!contact)p.head.rotation.y=clamp(angleDelta(Math.atan2(ball.x-a.x,ball.z-a.z),p.root.rotation.y),-.6,.6);
 if(a.reaction>0){const v=Math.sin(time*14)*.035;
  if(a.isCulprit){p.head.rotation.x=.3;p.torso.rotation.x=.13;p.arms[0].shoulder.rotation.set(-.55,0,.28);p.arms[0].elbow.rotation.x=-.65;}
  else{p.torso.rotation.x=.12+Math.abs(v);p.head.rotation.z=v;p.arms[1].shoulder.rotation.x=-.28;p.arms[1].elbow.rotation.x=-.5;}
 }
}
export class World{
 constructor(canvas,game){
 this.game=game;this.canvas=canvas;this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.quality='auto';this.autoRatio=Math.min(devicePixelRatio,1.7);this.slowFrames=0;this.renderer.setPixelRatio(this.autoRatio);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.06;
 this.scene=new T.Scene();this.scene.background=new T.Color(0x9ad9ec);this.scene.fog=new T.Fog(0xbdd6dd,46,170);this.camera=new T.PerspectiveCamera(68,1,.06,330);this.camera.rotation.order='YXZ';this.scene.add(this.camera);this.track=true;this.manualLook=0;this.view='third';this.yaw=0;this.pitch=-.20;this.swingTime=0;this.swing='foot';this.swingSide=1;this.jolt=0;this.time=0;this.home=true;
 this.scene.add(new T.HemisphereLight(0xcdeeff,0xc6b49c,.62));const rim=new T.DirectionalLight(0x9fd8ef,.42);rim.position.set(2,5.5,-19);this.scene.add(rim);const sun=new T.DirectionalLight(0xfff2dc,3.35);sun.position.set(-13,15.5,9.5);sun.castShadow=true;this.sun=sun;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-11.5;sun.shadow.camera.right=11.5;sun.shadow.camera.top=11.5;sun.shadow.camera.bottom=-11.5;sun.shadow.camera.far=52;sun.shadow.normalBias=.028;sun.shadow.bias=-.00015;this.scene.add(sun);
 const texLoader=new T.TextureLoader();const sandMap=texLoader.load('./assets/sand.jpg');sandMap.colorSpace=T.SRGBColorSpace;sandMap.wrapS=sandMap.wrapT=T.RepeatWrapping;sandMap.repeat.set(38,32);sandMap.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
 const sandNormal=texLoader.load('./assets/sand-normal.jpg');sandNormal.wrapS=sandNormal.wrapT=T.RepeatWrapping;sandNormal.repeat.copy(sandMap.repeat);
 const sand=new T.MeshStandardMaterial({map:sandMap,normalMap:sandNormal,normalScale:new T.Vector2(.62,.62),roughness:.93,color:0xeaddc6});sand.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n  float dune=sin(vMapUv.x*.26+1.7)*sin(vMapUv.y*.19+.9)*.5+.5;\n  float drift=sin(vMapUv.x*.07-.4)*sin(vMapUv.y*.052+2.1)*.5+.5;\n  diffuseColor.rgb*=mix(vec3(.885,.876,.862),vec3(1.045,1.03,1.), dune*.55+drift*.45);');};sand.customProgramCacheKey=()=>'atlanta-sand-v1';this.ground=mesh(this.scene,new T.PlaneGeometry(260,220),sand,0,-.015,100);this.ground.rotation.x=-Math.PI/2;this.ground.castShadow=false;
 const sky=new T.Mesh(new T.SphereGeometry(180,24,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color(0x50b6e5)},bottom:{value:new T.Color(0xd4edf1)}},vertexShader:'varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 vP;void main(){float h=normalize(vP).y;gl_FragColor=vec4(mix(bottom,top,pow(max(h,0.),.5)),1.);}' }));sky.visible=false;this.scene.add(sky);
 // הפנורמה מסובבת כך שהים הפתוח שלה פונה ל--Z (כיוון המבט לים)
 // והעיר, ההרים והעצים נשארים ב-+Z, מאחורי השחקן, בצד היבשה.
 const PANORAMA_SEA_Y=-.70;
 texLoader.load('./assets/coast.jpg',tex=>{tex.colorSpace=T.SRGBColorSpace;tex.mapping=T.EquirectangularReflectionMapping;this.scene.background=tex;this.scene.backgroundRotation.y=PANORAMA_SEA_Y;const pmrem=new T.PMREMGenerator(this.renderer);this.scene.environment=pmrem.fromEquirectangular(tex).texture;this.scene.environmentIntensity=.85;this.scene.environmentRotation.y=PANORAMA_SEA_Y;pmrem.dispose();});
 this.water=createOcean();this.scene.add(this.water);
 const foamMat=new T.MeshBasicMaterial({color:0xe1f6ee,transparent:true,opacity:.25});this.foam=mesh(this.scene,new T.PlaneGeometry(220,1.3),foamMat,0,.006,-10.1);this.foam.rotation.x=-Math.PI/2;this.foam.castShadow=false;this.foam.visible=false;
 this.props();
 const wetTex=(()=>{const c=document.createElement('canvas');c.width=4;c.height=256;const q=c.getContext('2d');const g=q.createLinearGradient(0,0,0,256);g.addColorStop(0,'rgba(112,110,92,.62)');g.addColorStop(.28,'rgba(126,122,101,.5)');g.addColorStop(.62,'rgba(150,145,120,.24)');g.addColorStop(1,'rgba(160,154,128,0)');q.fillStyle=g;q.fillRect(0,0,4,256);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;})();const wet=mesh(this.scene,new T.PlaneGeometry(220,7),new T.MeshStandardMaterial({map:wetTex,roughness:.22,metalness:.05,transparent:true,depthWrite:false}),0,.004,-7.4);wet.rotation.x=-Math.PI/2;wet.castShadow=false;wet.renderOrder=1;
 this.people=game.actors.slice(1).map(a=>makeHuman(this.scene,a));
 this.ball=mesh(this.scene,new T.SphereGeometry(game.ballConfig.radius,32,24),volleyballMaterial());
 const shadowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const q=c.getContext('2d');const g=q.createRadialGradient(64,64,2,64,64,63);g.addColorStop(0,'rgba(12,26,30,.52)');g.addColorStop(.42,'rgba(12,26,30,.3)');g.addColorStop(.72,'rgba(12,26,30,.1)');g.addColorStop(1,'rgba(12,26,30,0)');q.fillStyle=g;q.fillRect(0,0,128,128);return new T.CanvasTexture(c);})();this.ballShadow=new T.Mesh(new T.PlaneGeometry(.65,.65),new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));this.ballShadow.rotation.x=-Math.PI/2;this.scene.add(this.ballShadow);
 // מעגלי משחק נוספים ואנשי רקע — כולם instanced, בשאריות של draw calls
 this.beach=createBeachLife(this.scene,{shadowTex});
 this.personShadows=game.actors.map(()=>{const shadow=new T.Mesh(new T.PlaneGeometry(.9,.65),new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false,opacity:.72}));shadow.rotation.x=-Math.PI/2;this.scene.add(shadow);return shadow;});
 this.aimRing=mesh(this.scene,new T.RingGeometry(.24,.28,40),new T.MeshBasicMaterial({color:0xdcfc68,transparent:true,opacity:.85,side:T.DoubleSide}));this.aimRing.rotation.x=-Math.PI/2;this.aimRing.position.y=.013;this.aimRing.castShadow=false;
 this.aimLine=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:0x7dff8c,transparent:true,opacity:.85}));this.scene.add(this.aimLine);this.aimLine.visible=false;
 this.landingRing=mesh(this.scene,new T.RingGeometry(.35,.37,40),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.3,side:T.DoubleSide}));this.landingRing.rotation.x=-Math.PI/2;this.landingRing.castShadow=false;
 this.arcDots=[];for(let i=0;i<16;i++){const d=mesh(this.scene,new T.SphereGeometry(.028,6,5),new T.MeshBasicMaterial({color:0xdcfc68,transparent:true,opacity:.55}));d.castShadow=false;this.arcDots.push(d);}
 this.own=new T.Group();this.scene.add(this.own);this.ownParts=makeHuman(new T.Scene(),{x:0,z:0,skin:0xc5906c,color:0xe87850,style:'male'});this.own.add(this.ownParts.root);this.ownParts.head.visible=true;this.bodyYaw=Math.PI;
 this.fp=new T.Group();this.camera.add(this.fp);this.fpParts=makeHuman(this.fp,{x:0,z:0,skin:0xc5906c,color:0xe87850,style:'male',viewModel:true});this.fpParts.head.visible=false;this.fpParts.torso.children.forEach(c=>{if(c.isMesh)c.visible=false;});this.fpParts.root.position.set(0,-1.47,-.28);this.fpParts.root.rotation.y=Math.PI;this.fp.visible=false;
 this.ray=new T.Raycaster();this.vec=new T.Vector3();this.resize();window.addEventListener('resize',()=>this.resize());window.addEventListener('gameviewportchange',()=>this.resize());
 }
 props(){const beige=material(0xe8d7a4),wood=material(0xb29167);for(const [x,z,color] of [[-14.6,13.4,0xe38761],[15.2,12.6,0x47a7b6],[-22.4,20.2,0xf1dfb2]]){const g=new T.Group();g.position.set(x,0,z);this.scene.add(g);mesh(g,new T.CylinderGeometry(.022,.025,2.05,8),wood,0,1.02,0);const canopy=mesh(g,new T.ConeGeometry(1.1,.42,10),material(color),0,2.02,0);const towel=mesh(g,new T.PlaneGeometry(.9,1.9),beige,.6,.016,.5);towel.rotation.x=-Math.PI/2;towel.rotation.z=.4;towel.castShadow=false;}
 const cloudMat=new T.MeshBasicMaterial({color:0xe9f4f7,transparent:true,opacity:.5,depthWrite:false});for(const [x,y,z,s]of[[-60,18,-70,10],[30,22,-85,13],[70,20,-70,8],[-15,27,-110,14]]){const m=ellipsoid(this.scene,cloudMat,x,y,z,s,1.6,4);m.castShadow=false;m.visible=false;}
 }
 applyProfile(profile){
  disposeAvatar(this.ownParts);disposeAvatar(this.fpParts);
  this.ownParts=makeHuman(this.own,avatarConfig(profile));this.fpParts=makeHuman(this.fp,avatarConfig(profile,true));
  this.fpParts.head.visible=false;this.fpParts.torso.children.forEach(c=>{if(c.isMesh)c.visible=false;});this.fpParts.root.position.set(0,-1.47,-.28);this.fpParts.root.rotation.y=Math.PI;
  this.ball.material.dispose();this.ball.material=volleyballMaterial(profile.ball);this.game.player.name=profile.nickname||profile.name;
 }
 setQuality(value){this.quality=['auto','high','smooth'].includes(value)?value:'auto';const ratio=this.quality==='high'?Math.min(devicePixelRatio,2):this.quality==='smooth'?Math.min(devicePixelRatio,1.15):this.autoRatio;this.renderer.setPixelRatio(ratio);const resolution=this.quality==='smooth'?1024:2048;this.sun.shadow.mapSize.set(resolution,resolution);if(this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}this.resize();}
 resize(){const bounds=this.canvas.getBoundingClientRect(),w=Math.max(1,bounds.width),h=Math.max(1,bounds.height);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.fov=w<h?78:66;this.camera.updateProjectionMatrix();this.width=w;this.height=h;}
 setRoaming(on,spawn=null){
  this.roam=!!on;this.home=!on;this.aimLine.visible=false;
  this.own.visible=!!on;this.fp.visible=false;this.track=true;this.manualLook=0;this.yaw=0;this.pitch=-.16;
  this.aimRing.visible=false;this.landingRing.visible=false;for(const d of this.arcDots)d.visible=false;
  this.ball.visible=!on;this.ballShadow.visible=!on;
  for(const person of this.people)person.root.visible=!on;
  for(const sh of this.personShadows)sh.visible=!on;
  if(on){const p=this.game.player;p.x=spawn?spawn.x:0;p.z=spawn?spawn.z:14;p.jumpY=0;resetRoam(p);this.bodyYaw=Math.PI;
   this.roamFocus=new T.Vector3(p.x,1.32,p.z);this.camera.position.set(p.x,2.72,p.z+4.1);}
 }
 // מצלמת גוף שלישי לטיול.
 // המיקום עוקב רך, נקודת המבט עוקבת מהר יותר ומקדימה מעט את התנועה —
 // ככה השחקן נשאר ממורכז ורואים לאן הולכים, בלי לטלטל את המצלמה.
 renderRoam(dt){
  const g=this.game,p=g.player,t=this.time;
  const pace=Math.min(1,p.speed/4.1);
  this.manualLook=Math.max(0,this.manualLook-dt);

  // יישור אוטומטי מאחורי כיוון ההליכה. אזור מת מונע תיקונים קטנים
  // שהיו מסובבים את המצלמה בזמן הליכה ישרה.
  if(!this.manualLook&&p.speed>.35){
   const drift=angleDelta(Math.atan2(g.approach.x,g.approach.z)-Math.PI,this.yaw);
   if(Math.abs(drift)>.22)this.yaw+=drift*(1-Math.exp(-(1.1+pace*1.4)*dt));
  }
  p.yaw=this.yaw;
  this.pitch+=(-.16-this.pitch)*(1-Math.exp(-4*dt));

  // מתרחקים ומתרוממים קצת בריצה — נותן תחושת מהירות בלי לשנות FOV
  const base=this.width<this.height?4.55:3.95;
  const back=base+pace*.6,height=2.6+pace*.22;
  const posK=1-Math.exp(-(5.5+pace*2)*dt),aimK=1-Math.exp(-9*dt);
  const cam=this.camera.position;
  cam.x+=(p.x+Math.sin(this.yaw)*back-cam.x)*posK;
  cam.y+=(height-cam.y)*posK;
  cam.z+=(p.z+Math.cos(this.yaw)*back-cam.z)*posK;
  if(cam.y<.75)cam.y=.75;                       // לא נכנסים לתוך החול

  // נקודת המבט מקדימה את השחקן לפי המהירות
  const lead=pace*1.15,f=this.roamFocus;
  f.x+=(p.x+g.approach.x*lead-f.x)*aimK;
  f.y+=(1.34+pace*.1-f.y)*aimK;
  f.z+=(p.z+g.approach.z*lead-f.z)*aimK;
  if(this.manualLook)this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');else this.camera.lookAt(f);

  // הגוף פונה לכיוון ההליכה, מהר מספיק כדי להרגיש מחובר לג'ויסטיק
  const face=p.speed>.15?Math.atan2(g.approach.x,g.approach.z):this.bodyYaw;
  this.bodyYaw+=angleDelta(face,this.bodyYaw)*(1-Math.exp(-13*dt));
  this.own.position.set(p.x,0,p.z);this.own.rotation.y=this.bodyYaw;

  const own=this.ownParts;own.root.position.set(0,0,0);
  own.torso.rotation.set(0,0,0);own.head.rotation.set(0,0,0);
  own.hips.position.set(0,own.baseY,.015613);own.hips.rotation.set(0,0,0);
  for(const leg of own.legs){leg.hip.rotation.set(Math.sin(t*11)*leg.s*p.speed*.09,0,-leg.s*.035);leg.knee.rotation.set(Math.max(0,-Math.sin(t*11)*leg.s)*p.speed*.09,0,0);leg.foot.rotation.set(0,0,0);}
  poseLocomotion(own,{...p,vx:g.approach.x*p.speed,vz:g.approach.z*p.speed},t,dt);
  own.head.visible=true;own.torso.visible=true;
 }
 setPlaying(play){this.roam=false;this.aimLine.visible=false;this.home=!play;this.own.visible=play;this.aimRing.visible=play;this.landingRing.visible=play;this.ball.visible=true;this.ballShadow.visible=true;for(const person of this.people)person.root.visible=true;this.track=true;this.manualLook=0;this.yaw=0;this.pitch=-.20;}
 look(dx,dy){this.manualLook=1.1;this.yaw-=dx*.004;this.pitch=clamp(this.pitch-dy*.003,-1.12,1.25);}
 toggleView(){this.view=this.view==='third'?'first':'third';this.manualLook=0;this.pitch=-.2;}
 aimAt(x,y){this.ray.setFromCamera({x:x/this.width*2-1,y:1-y/this.height*2},this.camera);const point=new T.Vector3();if(this.ray.ray.intersectPlane(new T.Plane(Y,0),point)){if(point.distanceTo(this.camera.position)>18)return;const nearest=this.game.actors.slice(1).find(a=>Math.hypot(a.x-point.x,a.z-point.z)<.85);this.game.setAim(nearest||point,nearest?.id||0);}}
 animate(id,side='right',contact=false){this.swingDuration=id==='around'?.78:['chest','shoulder','heel','lunge'].includes(id)?.65:.48;this.swingTime=contact?0:this.swingDuration;this.swing=id;this.swingSide=side==='left'?-1:1;this.jolt=id==='head'?.09:.025;}
 renderDemo(){
  const g=this.game,p=g.player,id=g.practiceMove,parts=this.ownParts;
  const cycle=g.demoTime%4.8,second=id==='alternate'&&cycle>=2.5,contactTime=second?3.1:1.65;
  const progress=cycle<contactTime?clamp((cycle-contactTime+.65)/1.3,0,.5):.5+.5*clamp((cycle-contactTime)/.85,0,1);
  this.own.visible=true;this.fp.visible=false;parts.head.visible=parts.torso.visible=true;
  this.own.rotation.y=Math.PI+(id==='hip'?-Math.PI/2:id==='heel'?Math.PI:id==='rabona'?1.9:0);this.own.position.set(p.x,id==='head'?Math.sin(progress*Math.PI)*.5:0,p.z);
  const reset=()=>{parts.hips.position.set(0,parts.baseY,.015613);parts.hips.rotation.set(0,0,0);parts.torso.rotation.set(0,0,0);parts.head.rotation.set(0,0,0);for(const l of parts.legs){l.hip.rotation.set(0,0,0);l.knee.rotation.set(0,0,0);l.foot.rotation.set(0,0,0);}relaxArms(parts);};
  reset();poseContact(parts,id,.5,second?-1:1);const impact=markerWorld(parts,id,second?-1:1);if(id==='hip')impact.add(new T.Vector3(1,.2,0).applyQuaternion(parts.hips.getWorldQuaternion(new T.Quaternion())).normalize().multiplyScalar(.115));else impact.y+=.115;
  reset();poseContact(parts,id,progress,second?-1:1);
  const time=cycle-contactTime;
  if(time<=0){const u=clamp(-time/1.65,0,1);this.ball.position.copy(impact);this.ball.position.z-=u*(id==='scorpion'?2.5:1.65);this.ball.position.y+=Math.sin(u*Math.PI)*1.15+u*.3;}
  else{const u=Math.min(time,1.7);this.ball.position.copy(impact);this.ball.position.x-=u*1.3;this.ball.position.y+=3.3*u-1.8*u*u;this.ball.position.z-=u*.75;}
  if(['around','around-reverse'].includes(id)&&time>0){
   const elapsed=Math.min(time/1.6,.62),duration=.62;
   this.ball.position.copy(impact);this.ball.position.y+=3.04*elapsed-4.905*elapsed*elapsed;
   reset();
   if(elapsed<.56)applyOrbit(parts,{elapsed,loopDuration:.56,side:1,yaw:this.own.rotation.y,direction:id==='around'?1:-1},this.ball.position);
   else{
    const secondPoint=impact.clone();secondPoint.y+=3.04*.56-4.905*.56*.56;
    applyContact(parts,{id,side:1,point:secondPoint,age:Math.max(0,time-.896),duration:.65});
    const out=Math.max(0,time-.896);this.ball.position.copy(secondPoint);this.ball.position.x-=out*1.3;this.ball.position.z-=out*.75;this.ball.position.y+=3.3*out-1.8*out*out;
   }
  }
  if(id==='foot-stall'&&time>0){
   const out=Math.max(0,time-.58);this.ball.position.copy(impact);this.ball.position.x-=out*1.3;this.ball.position.z-=out*.75;this.ball.position.y+=3.3*out-1.8*out*out;
   reset();applyContact(parts,{id,side:1,point:impact,age:out,duration:.65});
  }
  Object.assign(g.ball.position,{x:this.ball.position.x,y:this.ball.position.y,z:this.ball.position.z});
  this.camera.position.set(p.x+2.9,1.8,p.z-3.6);this.camera.lookAt(p.x,1.05,p.z);
  this.aimLine.visible=false;this.aimRing.visible=false;this.landingRing.visible=false;for(const dot of this.arcDots)dot.visible=false;
 }
 // המעגל שהשחקן עומד לידו, לצורך שלט ההצטרפות
 nearbyCircle(){return this.home?null:nearestCircle(this.beach,this.game.player.x,this.game.player.z);}
 // מערך ממוחזר כדי לא להקצות זיכרון בכל פריים
 roamBlockers(x,z){return roamBlockers(this.beach,x,z,this._blockers||(this._blockers=[]));}
 project(pos){this.vec.set(pos.x,pos.y,pos.z).project(this.camera);return{x:(this.vec.x*.5+.5)*this.width,y:(-.5*this.vec.y+.5)*this.height,visible:this.vec.z<1&&this.vec.z>0&&Math.abs(this.vec.x)<1.2&&Math.abs(this.vec.y)<1.2};}
 render(dt){const g=this.game;
 if(this.quality==='auto'&&dt>0){this.slowFrames=dt>.029?this.slowFrames+1:Math.max(0,this.slowFrames-2);if(this.slowFrames>100&&this.autoRatio>1.25){this.autoRatio=1.25;this.renderer.setPixelRatio(this.autoRatio);this.sun.shadow.mapSize.set(1024,1024);if(this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}this.slowFrames=0;}}
this.time+=dt;const t=this.time;this.water.material.uniforms.time.value=t;this.foam.position.z=-10.1+Math.sin(t*.65)*.35;this.foam.material.opacity=.14+Math.sin(t*.65)*.1;
 if(this.roam){this.renderRoam(dt);}else if(this.home){this.camera.position.set(4.9,2.1,7.6);this.camera.lookAt(-.5,1.0,-.5);this.ball.position.set(.18,.83+Math.sin(t*1.5)*.035,-2.96);this.own.visible=false;this.fp.visible=false;this.aimRing.visible=false;this.landingRing.visible=false;for(const d of this.arcDots)d.visible=false;}else{
  const p=g.player;this.camera.position.set(p.x,1.67+p.jumpY+(p.speed>.1?Math.sin(t*11)*.022:Math.sin(t*2)*.005),p.z);
  this.manualLook=Math.max(0,this.manualLook-dt);
  if(this.track&&!this.manualLook){const angles=followAngles(this.yaw,this.pitch,p,g.ball.position,g.ball.velocity,dt,this.view==='first');this.yaw=angles.yaw;this.pitch=angles.pitch;}
  this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');g.player.yaw=this.yaw;
  this.ball.position.set(g.ball.position.x,g.ball.position.y,g.ball.position.z);
  this.own.visible=true;this.own.position.set(p.x,p.jumpY,p.z);const activeContact=p.contact||upcomingContact(g,p);const face=g.sequence?.kind==='orbit'?g.sequence.yaw:p.dive?p.dive.yaw:activeContact?activeContact.yaw:p.speed>.3&&!g.assisting&&this.swingTime<=0?Math.atan2(g.approach.x,g.approach.z):this.yaw+Math.PI;this.bodyYaw+=angleDelta(face,this.bodyYaw)*(1-Math.exp(-10*dt));if(p.contact?.age===0)this.bodyYaw=face;this.own.rotation.y=this.bodyYaw;this.ownParts.root.position.set(0,0,0);
  const own=this.ownParts;own.torso.rotation.set(0,0,0);own.head.rotation.set(0,0,0);own.hips.position.set(0,own.baseY,.015613);own.hips.rotation.set(0,0,0);
  for(const leg of own.legs){leg.hip.rotation.set(Math.sin(t*11)*leg.s*p.speed*.09,0,-leg.s*.035);leg.knee.rotation.set(Math.max(0,-Math.sin(t*11)*leg.s)*p.speed*.09,0,0);leg.foot.rotation.set(0,0,0);}
  poseLocomotion(own,{...p,vx:g.approach.x*p.speed,vz:g.approach.z*p.speed},t,dt);
  if(g.receiver===0&&g.nearby&&g.ball.velocity.y<0&&g.ball.position.y>1.2&&g.ball.position.y<2.05&&p.jumpY<.05)prepareChest(own);
  poseJump(own,p,dt);
  if(g.smashCharge.active){own.torso.rotation.x=-.12;own.arms.forEach(a=>a.shoulder.rotation.z=-a.s*.2);}
  if(this.swingTime>0){if(this.swing==='heel')this.own.rotation.y+=Math.PI*Math.sin((1-this.swingTime/this.swingDuration)*Math.PI);this.swingTime=Math.max(0,this.swingTime-dt);poseContact(own,this.swing,1-this.swingTime/this.swingDuration,this.swingSide);}
  if(p.dive&&activeContact?.id!=='knee-save')poseKneeSave(own,diveWeight(p.dive),p.dive.side);
  if(activeContact)applyContact(own,activeContact);
  if(g.sequence?.kind==='orbit')applyOrbit(own,g.sequence,g.ball.position);
  this.ownParts.head.visible=this.view==='third';this.ownParts.torso.visible=this.view==='third';
  this.fp.visible=this.view==='first';
  if(this.view==='first'){
   // A camera-relative view model keeps balancing hands and kicking feet readable.
   this.own.visible=false;const fp=this.fpParts;fp.hips.position.copy(own.hips.position);fp.hips.rotation.copy(own.hips.rotation);fp.torso.rotation.copy(own.torso.rotation);
   for(let i=0;i<2;i++){fp.legs[i].hip.rotation.copy(own.legs[i].hip.rotation);fp.legs[i].knee.rotation.copy(own.legs[i].knee.rotation);fp.legs[i].foot.rotation.copy(own.legs[i].foot.rotation);fp.arms[i].shoulder.rotation.copy(own.arms[i].shoulder.rotation);fp.arms[i].shoulder.rotation.x-=.2;fp.arms[i].elbow.rotation.copy(own.arms[i].elbow.rotation);}
  }else{
   // Shoulder camera frames the player and the ball together. No head snapping.
   const b=g.ball.position,back=this.width<this.height?4.5:3.8;
   this.camera.position.set(p.x+Math.sin(this.yaw)*back,2.85+p.jumpY*.45,p.z+Math.cos(this.yaw)*back);
   const focus=new T.Vector3(p.x+(b.x-p.x)*.42,clamp(.75+b.y*.36,1.05,3.1),p.z+(b.z-p.z)*.42);
   if(this.manualLook)this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');else this.camera.lookAt(focus);
  }
  const plan=g.smashCharge.active?g.shotPlan(g.contactFor('smash')):g.shotPlan(),target=plan.target;
  const aim=aimFeedback(g,g.player.yaw);this.aimLine.visible=g.smashCharge.active&&g.phase==='flight';
  if(this.aimLine.visible){const a=this.aimLine.geometry.attributes.position;a.setXYZ(0,p.x,.035,p.z);a.setXYZ(1,target.x,.035,target.z);a.needsUpdate=true;this.aimLine.geometry.computeBoundingSphere();this.aimLine.material.color.set(aim.aligned?0x7dff8c:0xe8db8b);}
  this.aimRing.visible=true;this.aimRing.position.set(target.x,.018,target.z);this.aimRing.material.color.set(g.mode==='smash'?(aim.aligned?0x7dff8c:0xe8db8b):g.mode==='set'?0x5df2e0:0xdcfc68);this.aimRing.scale.setScalar(1+Math.sin(t*4)*.07);
  const land=landingAt(g.ball);this.landingRing.visible=g.phase==='flight';this.landingRing.position.set(land.x,.021,land.z);
  const from=g.ball.position,to={...target,y:plan.height},dur=plan.duration,vel=launchVelocity(from,to,dur);
  for(let i=0;i<this.arcDots.length;i++){const dot=this.arcDots[i];dot.visible=g.nearby&&g.phase==='flight';const q=(i+1)/this.arcDots.length*dur;dot.position.set(from.x+vel.x*q,from.y+vel.y*q-4.905*q*q,from.z+vel.z*q);dot.material.color.copy(this.aimRing.material.color);}

 }
 if(g.phase==='demo'&&!this.home&&!this.roam)this.renderDemo();
 if(!this.roam){
 this.ball.rotation.x+=dt*2;this.ball.rotation.z+=dt*1.5;this.ballShadow.position.set(this.ball.position.x,.022,this.ball.position.z);this.ballShadow.scale.setScalar(1+this.ball.position.y*.16);this.ballShadow.material.opacity=Math.max(.2,1-this.ball.position.y*.14);
 for(let i=0;i<this.people.length;i++)animatePerson(this.people[i],g.actors[i+1],t,this.ball.position,dt,g);
 for(let i=0;i<this.personShadows.length;i++){const a=g.actors[i],shadow=this.personShadows[i];shadow.visible=i>0||(!this.home&&this.view==='third');shadow.position.set(a.x,.012,a.z);shadow.material.opacity=.72/(1+(a.jumpY||0)*2);}
 }
 updateBeachLife(this.beach,t,dt,this.camera.position);
 this.renderer.render(this.scene,this.camera);
 }
}
