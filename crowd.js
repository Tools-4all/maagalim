import * as T from './vendor/three.module.js?v=v2';
import {makeHuman} from './avatar.js?v=v2';
import {relaxArms} from './motion.js?v=v2';
import {angleDelta} from './camera.js?v=v2';

// חיי החוף: מעגלי כדור נוספים ואנשי רקע.
//
// שתי רמות ייצוג לאותה אוכלוסייה:
//  • קרוב  — בריכה משותפת של אווטארים אמיתיים (makeHuman), אותו מודל, שיער,
//            בגד ים ופרופורציות כמו השחקן. הבריכה מוחזרת ומוקצית מחדש לדמויות
//            הקרובות ביותר, כך שמספר המודלים היקרים קבוע ולא גדל עם האוכלוסייה.
//  • בינוני/רחוק — InstancedMesh משותפים. הצורות קפסולות וכדורים משוטחים עם
//            כיפת שיער ובגד ים נפרד, כך שהסילואט נקרא אנושי ולא כמו בובת עץ.

const POOL_SIZE=8;      // כמה אווטארים אמיתיים קיימים בו-זמנית
const NEAR_RANGE=17;    // מרחק שבו דמות זכאית לאווטאר אמיתי
const CIRCLE_BIAS=5;    // שחקני מעגל מקבלים עדיפות על אנשי רקע

// מראה אחיד בין שתי הרמות: כל דמות מקבלת look קבוע, וגם ה-instanced
// וגם האווטאר האמיתי צובעים לפיו — כך המעבר בין הרמות לא "מחליף אדם".
// skin 0x79513d מפעיל את מפת העור הכהה ב-avatar.js.
const LOOKS=[
 {style:'male',   skin:0xd8a882, tint:0xfff4e6, wear:0xe87850, hair:0x2a1c16},
 {style:'female', skin:0xe6c19c, tint:0xfff9ef, wear:0x2fbfae, hair:0x3a2318},
 {style:'male',   skin:0x79513d, tint:0xf6e6d6, wear:0xf2c14e, hair:0x1b1210},
 {style:'female', skin:0xc08b62, tint:0xffeeda, wear:0xe45f7f, hair:0x4a2c1c},
 {style:'male',   skin:0xc08b62, tint:0xfff2e2, wear:0x3d6fb4, hair:0x241a17},
 {style:'female', skin:0x79513d, tint:0xf7e8d8, wear:0xf6f1e4, hair:0x171110},
 {style:'male',   skin:0xe6c19c, tint:0xfff9ef, wear:0x38a169, hair:0x54331f},
 {style:'female', skin:0xd8a882, tint:0xfff4e6, wear:0x6d4fa8, hair:0x2f1f18}
];
const TOWEL=[0xe8d7a4,0xd97b5a,0x63b8c4,0xe7c15b,0xcf6f8f,0xf0ece0];

// תנוחות בסיס, משותפות לשתי רמות הייצוג
const POSE={
 stand:{hip:.92,legX:0,armX:.06,armZ:.07,lean:0},
 talk:{hip:.92,legX:0,armX:.35,armZ:.22,lean:.04},
 sit:{hip:.4,legX:-1.3,armX:.55,armZ:.5,lean:.14},
 chair:{hip:.56,legX:-1.1,armX:.3,armZ:.42,lean:-.05},
 walk:{hip:.92,legX:0,armX:.12,armZ:.09,lean:.05},
 play:{hip:.9,legX:.05,armX:.5,armZ:.35,lean:.08}
};

// סוגי נגיעה בהקפצות. הגובה קובע גם את קשת הכדור וגם את התנוחה.
const CONTACT={foot:.46,thigh:.78,chest:1.30,head:1.76};
const KINDS=['foot','thigh','chest','foot','head','chest','foot','thigh'];
const smoothstep=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};

const rnd=seed=>{let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};

function blobTexture(){
 const c=document.createElement('canvas');c.width=c.height=64;const q=c.getContext('2d');
 const g=q.createRadialGradient(32,32,1,32,32,31);
 g.addColorStop(0,'rgba(12,26,30,.44)');g.addColorStop(.5,'rgba(12,26,30,.22)');g.addColorStop(1,'rgba(12,26,30,0)');
 q.fillStyle=g;q.fillRect(0,0,64,64);return new T.CanvasTexture(c);
}

function instanced(scene,geo,mat,count){
 const m=new T.InstancedMesh(geo,mat,count);
 m.castShadow=false;m.receiveShadow=false;m.frustumCulled=false;
 m.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(m);return m;
}

// —— פריסת החוף: שני אזורים ——
// רצועת המים (z בין -8 ל--4): רק מעגלי משחק, פרוסים לאורך קו החוף.
// רצועת החוף (z מ--7 ומעלה): רק אנשים שלא משחקים — מגבות, כיסאות, שיחות.
// בין השתיים נשארת רצועה פנויה (z בין -2 ל-6) שמשמשת מעבר.
const CIRCLES=[
 {id:'sunset', x:-21.5, z:-5.8, r:2.5, name:'מעגל השקיעה',  desc:'שלושה ותיקים, קצב רגוע וכדור שכמעט לא נוגע בחול.'},
 {id:'morning',x:-10.8, z:-7.1, r:2.4, name:'מעגל הבוקר',   desc:'מתאמנים על מסירות נקיות. מוזמן להצטרף ולתרגל.'},
 {id:'pier',   x:  9.6, z:-6.4, r:2.6, name:'חבורת הרציף',  desc:'משחק מהיר עם הרבה הנחתות. לא למתחילים.'},
 {id:'nadia',  x: 21.2, z:-5.2, r:2.5, name:'הצוות של נדיה', desc:'שלישייה שמחממת לקראת טורניר הערב.'}
];

// כל אנשי הרקע יושבים מאחור, על החול, ולא ברצועת המשחק
const AMBIENT=[
 [ -7.5, 12.4,'sit',  2.5], [ -6.1, 13.6,'sit',  2.1], [ -8.4, 14.2,'talk', 5.6],
 [  8.2, 11.8,'chair',3.2], [  9.6, 12.9,'chair',3.0], [  8.9, 14.6,'sit',  2.8],
 [-19.8,  8.6,'talk', 1.2], [-18.4,  9.5,'talk', 4.3], [-20.6, 10.4,'stand',2.0],
 [ 23.8,  9.2,'sit',  4.6], [ 25.2, 10.4,'chair',4.4],
 [-13.2, 18.6,'chair',3.1], [-11.8, 19.4,'sit',  3.4],
 [ 16.6, 18.2,'talk', 0.6], [ 17.8, 19.1,'talk', 3.7],
 [  2.4, 21.6,'stand',3.0], [ -2.2, 22.8,'sit',  2.9],
 [ 27.6, 14.4,'stand',4.0], [-25.4, 14.8,'sit',  1.8],
 [ 12.4,  7.4,'stand',0.2], [ -3.6,  8.2,'stand',3.4]
];

// שבילי טיול מאחורי המעגלים — לא חוצים את רצועת המשחק
const WALKERS=[
 {ax:-26, az: 6.8, bx: 26, bz: 7.6, speed:.62, phase:.0},
 {ax: 27, az:16.2, bx:-27, bz:15.4, speed:.55, phase:.35},
 {ax:-24, az:22.4, bx: 24, bz:21.6, speed:.48, phase:.6},
 {ax: 12, az:24.5, bx:-14, bz:23.2, speed:.44, phase:.15}
];

const TOWELS=[[-7.5,12.4,2.5],[-6.1,13.6,2.1],[8.9,14.6,2.8],[23.8,9.2,4.6],[-11.8,19.4,3.4],[-2.2,22.8,2.9],[-25.4,14.8,1.8],[4.8,17.4,1.1],[-16.4,12.2,4.9],[19.6,22.2,2.2]];
const CHAIRS=[[8.2,11.8,3.2],[9.6,12.9,3.0],[-13.2,18.6,3.1],[25.2,10.4,4.4],[-21.8,17.6,2.6],[13.2,10.2,3.6]];
const SHADES=[[-9.2,15.8,0xe38761],[10.8,15.4,0x47a7b6],[-20.6,11.2,0xf1dfb2],[23.2,15.2,0xe9a06b],[3.6,19.8,0x6fc0b4]];

export function createBeachLife(scene,{shadowTex}={}){
 const rand=rnd(20260910);
 const figures=[];
 let lookCursor=0;
 const nextLook=()=>lookCursor++%LOOKS.length;

 const circles=CIRCLES.map(c=>{
  const members=3+(rand()<.5?0:1),start=figures.length,angle0=rand()*Math.PI*2;
  for(let i=0;i<members;i++){
   const a=angle0+i/members*Math.PI*2+(rand()-.5)*.4;
   const fx=c.x+Math.cos(a)*c.r,fz=c.z+Math.sin(a)*c.r;
   figures.push({x:fx,z:fz,homeX:fx,homeZ:fz,yaw:Math.atan2(c.x-fx,c.z-fz),pose:'play',
    look:nextLook(),scale:.97+rand()*.08,seed:rand()*9,walker:null,circle:true,avatar:null,
    play:{antic:0,follow:0,bounce:0,kind:'chest',lead:rand()*.5}});
  }
  return {...c,start,members,ballT:rand(),from:0,to:members>1?1:0,pace:1.25+rand()*.7,
   kind:KINDS[(rand()*KINDS.length)|0],nextKind:KINDS[(rand()*KINDS.length)|0],apex:2+rand()*1.1,
   ball:{x:c.x,y:1.3,z:c.z}};
 });

 for(const [x,z,pose,yaw] of AMBIENT)
  figures.push({x,z,yaw,pose,look:nextLook(),scale:.95+rand()*.11,seed:rand()*9,
   walker:null,circle:false,avatar:null});

 for(const w of WALKERS)
  figures.push({x:w.ax,z:w.az,yaw:0,pose:'walk',look:nextLook(),scale:.96+rand()*.1,
   seed:rand()*9,walker:{...w,t:w.phase},circle:false,avatar:null});

 const n=figures.length;

 // —— רמה בינונית/רחוקה: instanced עם סילואט אנושי ——
 // קפסולות לגפיים וכדורים משוטחים לגו נותנים קווי מתאר מעוגלים במקום קופסאות.
 const skinMat=new T.MeshLambertMaterial();
 const clothMat=new T.MeshLambertMaterial();
 const hairMat=new T.MeshLambertMaterial();
 const parts={
  head:instanced(scene,new T.SphereGeometry(.108,10,8),skinMat,n),
  hair:instanced(scene,new T.SphereGeometry(.116,10,7,0,Math.PI*2,0,Math.PI*.66),hairMat,n),
  torso:instanced(scene,new T.SphereGeometry(1,12,9),skinMat,n),
  wear:instanced(scene,new T.SphereGeometry(1,12,8),clothMat,n),
  arm:instanced(scene,new T.CapsuleGeometry(.046,.38,3,6),skinMat,n*2),
  leg:instanced(scene,new T.CapsuleGeometry(.072,.56,3,6),skinMat,n*2)
 };
 const col=new T.Color();
 figures.forEach((f,i)=>{
  const look=LOOKS[f.look];
  col.setHex(look.skin);
  parts.head.setColorAt(i,col);parts.torso.setColorAt(i,col);
  for(let s=0;s<2;s++){parts.arm.setColorAt(i*2+s,col);parts.leg.setColorAt(i*2+s,col);}
  col.setHex(look.wear);parts.wear.setColorAt(i,col);
  col.setHex(look.hair);parts.hair.setColorAt(i,col);
 });
 for(const k in parts)if(parts[k].instanceColor)parts[k].instanceColor.needsUpdate=true;

 const tex=shadowTex||blobTexture();
 const shadows=instanced(scene,new T.PlaneGeometry(.78,.56),
  new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,opacity:.6}),n);

 const balls=instanced(scene,new T.SphereGeometry(.105,10,8),
  new T.MeshLambertMaterial({color:0xf2ead2}),circles.length);

 // —— אביזרים סטטיים: נכתבים פעם אחת ——
 const dummy=new T.Object3D();
 const towels=instanced(scene,new T.PlaneGeometry(.95,1.9),
  new T.MeshLambertMaterial({side:T.DoubleSide}),TOWELS.length);
 TOWELS.forEach(([x,z,yaw],i)=>{
  dummy.position.set(x,.012,z);dummy.rotation.set(-Math.PI/2,0,yaw);dummy.scale.setScalar(1);
  dummy.updateMatrix();towels.setMatrixAt(i,dummy.matrix);
  col.setHex(TOWEL[i%TOWEL.length]);towels.setColorAt(i,col);
 });
 towels.instanceMatrix.needsUpdate=true;if(towels.instanceColor)towels.instanceColor.needsUpdate=true;

 const chairMat=new T.MeshLambertMaterial({color:0xdfe6e4});
 const chairSeat=instanced(scene,new T.BoxGeometry(.62,.07,.66),chairMat,CHAIRS.length);
 const chairBack=instanced(scene,new T.BoxGeometry(.62,.62,.07),chairMat,CHAIRS.length);
 CHAIRS.forEach(([x,z,yaw],i)=>{
  dummy.position.set(x,.3,z);dummy.rotation.set(0,yaw,0);dummy.scale.setScalar(1);
  dummy.updateMatrix();chairSeat.setMatrixAt(i,dummy.matrix);
  dummy.position.set(x-Math.sin(yaw)*.3,.58,z-Math.cos(yaw)*.3);dummy.rotation.set(-.42,yaw,0);
  dummy.updateMatrix();chairBack.setMatrixAt(i,dummy.matrix);
 });
 chairSeat.instanceMatrix.needsUpdate=true;chairBack.instanceMatrix.needsUpdate=true;

 const poleMat=new T.MeshLambertMaterial({color:0xb29167});
 const poles=instanced(scene,new T.CylinderGeometry(.022,.025,2.05,6),poleMat,SHADES.length);
 const canopies=instanced(scene,new T.ConeGeometry(1.12,.42,9),new T.MeshLambertMaterial(),SHADES.length);
 SHADES.forEach(([x,z,color],i)=>{
  dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);
  dummy.position.set(x,1.02,z);dummy.updateMatrix();poles.setMatrixAt(i,dummy.matrix);
  dummy.position.set(x,2.02,z);dummy.updateMatrix();canopies.setMatrixAt(i,dummy.matrix);
  col.setHex(color);canopies.setColorAt(i,col);
 });
 poles.instanceMatrix.needsUpdate=true;canopies.instanceMatrix.needsUpdate=true;
 if(canopies.instanceColor)canopies.instanceColor.needsUpdate=true;

 // —— רמה קרובה: בריכת אווטארים אמיתיים ——
 // נבנית פעם אחת. הצל נשאר טלאי instanced כדי לא להוסיף מטילי צל למפת הצללים.
 const pool=[];
 for(let i=0;i<POOL_SIZE;i++){
  const look=LOOKS[i%LOOKS.length];
  const avatar=makeHuman(scene,{x:0,z:-4000,style:look.style,skin:look.skin,
   skinTint:look.tint,color:look.wear,outfit:look.style==='female'?'tank':'suit'});
  avatar.root.traverse(o=>{if(o.isMesh||o.isSkinnedMesh)o.castShadow=false;});
  avatar.root.visible=false;
  pool.push({avatar,look:i%LOOKS.length,figure:-1});
 }

 return {figures,circles,parts,shadows,balls,pool,frame:0,
  root:new T.Object3D(),part:new T.Object3D(),tmp:new T.Matrix4(),
  scaleV:new T.Vector3(),zero:new T.Matrix4().makeScale(0,0,0)};
}

// —— כתיבת דמות instanced ——
function writeFigure(state,i,f,t,detail){
 const {root,part,tmp,parts}=state,p=POSE[f.pose]||POSE.stand,s=f.scale;
 const w=detail?Math.sin(t*1.9+f.seed)*.05:0;
 const swing=f.pose==='walk'&&detail?Math.sin(t*4.6+f.seed)*.52:0;
 // במעגל: הכל נגזר ממצב הראלי — ציפייה לכדור, מכה, והתאוששות
 const P=f.play,playing=f.pose==='play'&&P&&detail;
 const up=playing?P.antic:0,fw=playing?P.follow:0,bo=playing?P.bounce:0;
 const kind=playing?P.kind:'chest';
 const kick=playing&&(kind==='foot'||kind==='thigh')?(kind==='foot'?1.15:.9)*(up*.85+fw*.45):0;
 const hop=playing&&kind==='head'?up*.13+fw*.08:0;
 const nod=playing&&kind==='head'?up*.3:0;
 const hip=p.hip-(playing?.05+up*.07:0)+hop+(playing?Math.abs(bo)*.012:0);
 const lean=p.lean+(playing?-.05-up*.22+fw*.26:0)+w*.4;
 const armUp=playing?(kind==='chest'?.95:kind==='head'?1.25:.45)*up+fw*.35:0;

 root.position.set(f.x,0,f.z);root.rotation.set(0,f.yaw,0);root.scale.setScalar(s);root.updateMatrix();
 const write=(mesh,idx,px,py,pz,rx,ry,rz,sx,sy,sz)=>{
  part.position.set(px,py,pz);part.rotation.set(rx,ry,rz);
  part.scale.set(sx===undefined?1:sx,sy===undefined?1:sy,sz===undefined?1:sz);
  part.updateMatrix();tmp.multiplyMatrices(root.matrix,part.matrix);mesh.setMatrixAt(idx,tmp);
 };
 write(parts.torso,i,0,hip+.34,0,lean,0,playing?bo*.05:0, .175,.245,.115);
 write(parts.wear,i, 0,hip+.03,0,lean*.3,0,0,  .168,.135,.128);
 write(parts.head,i, 0,hip+.72,.02,lean+w-nod,0,0);
 write(parts.hair,i, 0,hip+.735,.005,lean+w-.12-nod,0,0);
 for(let side=0;side<2;side++){
  const sgn=side?1:-1;
  write(parts.arm,i*2+side,sgn*.185,hip+.4,0,-p.armX-armUp*1.4+swing*sgn*.6,0,sgn*(p.armZ+w+armUp*.3));
  write(parts.leg,i*2+side,sgn*.085,hip-.34,0,p.legX+swing*sgn-(side?0:kick),0,sgn*.03);
 }
 part.position.set(0,.014,0);part.rotation.set(-Math.PI/2,0,0);
 part.scale.setScalar(f.pose==='sit'||f.pose==='chair'?1.15:1);
 part.updateMatrix();tmp.multiplyMatrices(root.matrix,part.matrix);
 state.shadows.setMatrixAt(i,tmp);
}

// מסתיר את הייצוג ה-instanced כשהדמות מוצגת כאווטאר אמיתי
function hideFigure(state,i){
 const {parts,zero}=state;
 parts.torso.setMatrixAt(i,zero);parts.wear.setMatrixAt(i,zero);
 parts.head.setMatrixAt(i,zero);parts.hair.setMatrixAt(i,zero);
 for(let s=0;s<2;s++){parts.arm.setMatrixAt(i*2+s,zero);parts.leg.setMatrixAt(i*2+s,zero);}
}

// —— תנוחת אווטאר אמיתי, באותן תנוחות בסיס כמו ה-instanced ——
function poseAvatar(a,f,t){
 const breathe=Math.sin(t*1.9+f.seed)*.022;
 a.root.position.set(f.x,0,f.z);a.root.rotation.set(0,f.yaw,0);a.root.scale.setScalar(f.scale);
 a.hips.position.set(0,a.baseY,.015613);a.hips.rotation.set(0,0,0);
 a.torso.rotation.set(0,0,0);a.head.rotation.set(0,0,0);
 for(const l of a.legs){l.hip.rotation.set(0,0,-l.s*.03);l.knee.rotation.set(0,0,0);l.foot.rotation.set(0,0,0);}
 relaxArms(a);

 if(f.pose==='sit'||f.pose==='chair'){
  const deep=f.pose==='sit';
  a.hips.position.y=a.baseY-(deep?.56:.38);a.hips.rotation.x=deep?-.2:-.1;
  for(const l of a.legs){l.hip.rotation.x=deep?-1.28:-1.12;l.knee.rotation.x=deep?1.12:1.24;l.foot.rotation.x=.18;}
  a.torso.rotation.x=(deep?.16:-.04)+breathe;
  a.arms.forEach(arm=>{arm.shoulder.rotation.set(deep?.48:.3,0,arm.s*(deep?.34:.4));arm.elbow.rotation.x=deep?-.4:-.55;});
  a.head.rotation.y=Math.sin(t*.5+f.seed)*.18;
 }else if(f.pose==='walk'){
  const sw=Math.sin(t*4.4+f.seed)*.48;
  a.legs[0].hip.rotation.x=sw;a.legs[1].hip.rotation.x=-sw;
  a.legs[0].knee.rotation.x=Math.max(0,-sw)*.8;a.legs[1].knee.rotation.x=Math.max(0,sw)*.8;
  a.arms[0].shoulder.rotation.x=-sw*.55;a.arms[1].shoulder.rotation.x=sw*.55;
  a.hips.position.y=a.baseY+Math.abs(sw)*.022;a.torso.rotation.y=sw*.07;
 }else if(f.pose==='talk'){
  const g=Math.sin(t*1.35+f.seed*2)*.5+.5;
  a.arms[1].shoulder.rotation.set(-.5-g*.55,0,.34);a.arms[1].elbow.rotation.x=-.85-g*.45;
  a.head.rotation.y=Math.sin(t*.85+f.seed)*.24;a.torso.rotation.x=breathe;
 }else if(f.pose==='play'){
  const P=f.play||{antic:0,follow:0,bounce:0,kind:'chest'};
  const up=P.antic,fw=P.follow,bo=P.bounce,kind=P.kind;
  // עמידת מוכנות: ברכיים רכות, משקל שמתחלף מרגל לרגל
  a.hips.position.y=a.baseY-.07-up*.09+Math.abs(bo)*.014;
  a.hips.rotation.z=bo*.04;a.hips.rotation.y=bo*.05;
  for(const l of a.legs){l.hip.rotation.x=-.1-up*.12;l.knee.rotation.x=.2+up*.28;}
  a.torso.rotation.x=-.05-up*.18+fw*.24+breathe;a.torso.rotation.y=bo*.06;
  a.head.rotation.x=-.1-up*.12;
  if(kind==='foot'||kind==='thigh'){
   const lift=(kind==='foot'?1.25:1)*(up*.9+fw*.5);
   a.legs[0].hip.rotation.x=-.1-lift;
   a.legs[0].knee.rotation.x=kind==='foot'?.45+lift*.25:1.1+lift*.15;
   a.legs[0].foot.rotation.x=kind==='foot'?-.3-lift*.3:0;
   a.legs[1].knee.rotation.x=.3+up*.25;
   a.arms.forEach(arm=>{arm.shoulder.rotation.set(-.55-up*.45,0,arm.s*(.45+up*.22));arm.elbow.rotation.x=-.5-up*.2;});
  }else if(kind==='head'){
   a.hips.position.y+=up*.19+fw*.09;
   a.head.rotation.x=-.3-up*.35+fw*.3;
   for(const l of a.legs){l.hip.rotation.x=-.05+up*.2;l.knee.rotation.x=.15+up*.5;}
   a.arms.forEach(arm=>{arm.shoulder.rotation.set(-.95-up*.75,0,arm.s*.52);arm.elbow.rotation.x=-.3-up*.15;});
  }else{
   a.torso.rotation.x=-.12-up*.34+fw*.3;
   a.arms.forEach(arm=>{arm.shoulder.rotation.set(-.4-up*.95,0,arm.s*(.5+up*.38));arm.elbow.rotation.x=-.75-up*.35;});
  }
 }else{
  a.torso.rotation.x=breathe;a.head.rotation.y=Math.sin(t*.55+f.seed)*.16;
 }
}

// מקצה את הבריכה לדמויות הקרובות ביותר. שחקני מעגל מקבלים עדיפות.
function assignPool(state,vx,vz){
 const {figures,pool}=state,ranked=[];
 for(let i=0;i<figures.length;i++){
  const f=figures[i],d=Math.hypot(f.x-vx,f.z-vz);
  if(d<NEAR_RANGE)ranked.push({i,key:d-(f.circle?CIRCLE_BIAS:0)});
 }
 ranked.sort((a,b)=>a.key-b.key);
 const wanted=new Set(ranked.slice(0,pool.length).map(r=>r.i));

 for(const slot of pool)
  if(slot.figure>=0&&!wanted.has(slot.figure)){
   figures[slot.figure].avatar=null;slot.figure=-1;slot.avatar.root.visible=false;
  }
 for(const i of wanted){
  if(figures[i].avatar)continue;
  // עדיפות למשבצת שה-look שלה תואם, כדי שהמראה לא יתחלף בזמן ההתקרבות
  let slot=pool.find(s=>s.figure<0&&s.look===figures[i].look)||pool.find(s=>s.figure<0);
  if(!slot)break;
  slot.figure=i;figures[i].avatar=slot.avatar;slot.avatar.root.visible=true;
 }
}

// נקודת המגע: מעט לפני הגוף, בגובה סוג הנגיעה
function contactAt(f,h){return {x:f.x+Math.sin(f.yaw)*.24,y:h,z:f.z+Math.cos(f.yaw)*.24};}

// מכונת מצבים של ראלי אחד: מי חבט, מי מקבל, איזו נגיעה ואיפה הכדור.
// כל תנוחה במעגל נגזרת מכאן — אין אנימציה שרצה בנפרד מהכדור.
function updateCircle(state,circle,index,t,dt){
 const {figures,root}=state;
 circle.ballT+=dt*circle.pace;
 if(circle.ballT>=1||!circle.fromPt){
  if(circle.fromPt){
   circle.ballT-=1;
   circle.from=circle.to;
   if(circle.members>1)circle.to=(circle.from+1+((Math.random()*(circle.members-1))|0))%circle.members;
   circle.kind=circle.nextKind;
   circle.nextKind=KINDS[(Math.random()*KINDS.length)|0];
   circle.pace=1.15+Math.random()*.8;   // קצב משתנה בין חילוף לחילוף, לא מטרונום
   circle.apex=1.7+Math.random()*1.3;
  }
  // נקודת השחרור מוקפאת ברגע החבטה כדי שהקשת לא תזוז אחריו
  circle.fromPt=contactAt(figures[circle.start+circle.from],CONTACT[circle.kind]);
 }
 const receiver=figures[circle.start+circle.to],u=circle.ballT;
 const a=circle.fromPt,b=contactAt(receiver,CONTACT[circle.nextKind]),ball=circle.ball;
 ball.x=a.x+(b.x-a.x)*u;ball.z=a.z+(b.z-a.z)*u;
 ball.y=a.y+(b.y-a.y)*u+Math.sin(u*Math.PI)*circle.apex;

 for(let m=0;m<circle.members;m++){
  const f=figures[circle.start+m],p=f.play;
  // כולם מסתובבים אל הכדור, כל אחד במהירות מעט אחרת
  f.yaw+=angleDelta(Math.atan2(ball.x-f.x,ball.z-f.z),f.yaw)*(1-Math.exp(-(5+p.lead*3)*dt));
  p.bounce=Math.sin(t*(2.8+p.lead)+f.seed*2.7);
  let tx=f.homeX,tz=f.homeZ,ease=2.2;
  if(m===circle.to){          // המקבל נכנס למקום ומתכונן לנגיעה
   p.antic=smoothstep(.34,.97,u);p.follow=0;p.kind=circle.nextKind;
   tx=f.homeX+(ball.x-f.homeX)*.16;tz=f.homeZ+(ball.z-f.homeZ)*.16;ease=3.4;
  }else if(m===circle.from){  // החובט משחרר ומתאושש
   p.antic=0;p.follow=Math.max(0,1-u/.34);p.kind=circle.kind;ease=2.8;
  }else{                      // השאר בעמידת מוכנות
   p.antic=0;p.follow=0;p.kind='chest';
  }
  const k=1-Math.exp(-ease*dt);
  f.x+=(tx-f.x)*k;f.z+=(tz-f.z)*k;
 }
 root.position.set(ball.x,ball.y,ball.z);root.rotation.set(0,0,0);root.scale.setScalar(1);root.updateMatrix();
 state.balls.setMatrixAt(index,root.matrix);
}

export function updateBeachLife(state,time,dt,viewer){
 if(!state)return;
 const {figures,circles,parts}=state,frame=state.frame++;
 const vx=viewer?viewer.x:0,vz=viewer?viewer.z:0;

 if(frame%12===0)assignPool(state,vx,vz);
 for(let c=0;c<circles.length;c++)updateCircle(state,circles[c],c,time,dt);

 for(let i=0;i<figures.length;i++){
  const f=figures[i],d=Math.hypot(f.x-vx,f.z-vz);
  const step=f.avatar?1:f.circle?(d<20?1:d<48?2:5):(d<18?1:d<38?4:16);
  if(frame%step!==i%step)continue;
  if(f.walker){
   const w=f.walker;w.t+=dt*w.speed/Math.max(1,Math.hypot(w.bx-w.ax,w.bz-w.az))*6;
   const u=w.t%2,k=u>1?2-u:u;
   f.x=w.ax+(w.bx-w.ax)*k;f.z=w.az+(w.bz-w.az)*k;
   f.yaw=Math.atan2((w.bx-w.ax)*(u>1?-1:1),(w.bz-w.az)*(u>1?-1:1));
  }
  if(f.avatar){poseAvatar(f.avatar,f,time);hideFigure(state,i);
   // הצל נשאר טלאי גם ברמה הקרובה
   const {root,part,tmp}=state;
   root.position.set(f.x,0,f.z);root.rotation.set(0,f.yaw,0);root.scale.setScalar(f.scale);root.updateMatrix();
   part.position.set(0,.014,0);part.rotation.set(-Math.PI/2,0,0);
   part.scale.setScalar(f.pose==='sit'||f.pose==='chair'?1.15:1);part.updateMatrix();
   tmp.multiplyMatrices(root.matrix,part.matrix);state.shadows.setMatrixAt(i,tmp);
  }else writeFigure(state,i,f,time,(f.circle?d<62:d<38)?1:0);
 }

 state.balls.instanceMatrix.needsUpdate=true;
 for(const k in parts)parts[k].instanceMatrix.needsUpdate=true;
 state.shadows.instanceMatrix.needsUpdate=true;
}

// מכשולים לטיול: מרכזי המעגלים ואנשי הרקע הקרובים. קריאה בלבד —
// לא משנה שום מצב של האוכלוסייה, רק מדווח מה עומד ליד השחקן.
export function roamBlockers(state,x,z,out=[]){
 out.length=0;
 if(!state)return out;
 for(const c of state.circles)
  if(Math.abs(c.x-x)<11&&Math.abs(c.z-z)<11)out.push({x:c.x,z:c.z,r:c.r+.85});
 for(const f of state.figures){
  if(f.circle)continue;                      // חברי מעגל כבר מכוסים ע"י המעגל עצמו
  if(Math.abs(f.x-x)<3&&Math.abs(f.z-z)<3)
   out.push({x:f.x,z:f.z,r:f.pose==='sit'||f.pose==='chair'?.62:.44});
 }
 return out;
}

export function nearestCircle(state,x,z,range=6.5){
 if(!state)return null;
 let best=null,bestD=range;
 for(const c of state.circles){
  const d=Math.hypot(c.x-x,c.z-z)-c.r;
  if(d<bestD){bestD=d;best=c;}
 }
 return best?{id:best.id,name:best.name,desc:best.desc,x:best.x,z:best.z,r:best.r,distance:bestD}:null;
}
