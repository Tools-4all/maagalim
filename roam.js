import {angleDelta} from './camera.js';

// מצב טיול חופשי בחוף.
//
// התנועה מופרדת למהירות ולכיוון, במקום להזיז את המיקום ישירות מהג'ויסטיק:
//  • מהירות — מאיצה ובולמת בקצב מוגבל, אז אין עצירה או זינוק פתאומיים.
//  • כיוון  — מסתובב בקצב זוויתי, אז תיקון קטן מדויק וסיבוב גדול חלק.
// טווח המהירויות נשאר של physics.js כדי שהתחושה תהיה עקבית עם המשחק עצמו.

export const BEACH={
 minX:-30, maxX:30,
 minZ:-9.2,   // קו המים ב--10, אז נעצרים ברגליים במים ולא נכנסים לים
 maxZ:26
};

const WALK=2.4, RUN=4.1;      // יחידות לשנייה
const ACCEL=13, BRAKE=11;     // יחידות לשנייה בריבוע
const TURN=11;                // קצב סיבוב הכיוון
const DEADZONE=.09;

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function resetRoam(player,heading=Math.PI){
 player.roamSpeed=0;player.roamHeading=heading;player.speed=0;
}

export function updateRoam(game,dt,blockers=null){
 const p=game.player,v=game.inputVector||{x:0,z:0,sprint:false};
 if(p.roamSpeed===undefined)resetRoam(p,p.yaw+Math.PI);

 const len=Math.min(1,Math.hypot(v.x,v.z));
 const moving=len>DEADZONE;
 // הג'ויסטיק ממופה מחדש מעל אזור המת כדי שלא תיווצר קפיצת מהירות בכניסה אליו
 const throttle=moving?(len-DEADZONE)/(1-DEADZONE):0;
 const target=moving?(v.sprint?RUN:WALK)*throttle:0;

 if(moving){
  const c=Math.cos(p.yaw),s=Math.sin(p.yaw);
  const want=Math.atan2(v.x*c+v.z*s,-v.x*s+v.z*c);
  // מעמידה מלאה פונים מיד — בלי קשת יציאה מיותרת
  if(p.roamSpeed<.12)p.roamHeading=want;
  else p.roamHeading+=angleDelta(want,p.roamHeading)*(1-Math.exp(-TURN*dt));
 }

 const rate=(target>p.roamSpeed?ACCEL:BRAKE)*dt;
 p.roamSpeed+=clamp(target-p.roamSpeed,-rate,rate);
 if(p.roamSpeed<.01&&!moving)p.roamSpeed=0;

 const dirX=Math.sin(p.roamHeading),dirZ=Math.cos(p.roamHeading);
 p.x+=dirX*p.roamSpeed*dt;
 p.z+=dirZ*p.roamSpeed*dt;

 // דחיפה רכה מתוך מכשולים. תיקון מיקום בלבד, אף פעם לא חסימת קלט,
 // ולכן אי אפשר להיתקע — במקרה הגרוע מחליקים סביב.
 if(blockers)for(let i=0;i<blockers.length;i++){
  const b=blockers[i],dx=p.x-b.x,dz=p.z-b.z;
  const d=Math.hypot(dx,dz);
  if(d<b.r){
   if(d>1e-3){const push=b.r-d;p.x+=dx/d*push;p.z+=dz/d*push;}
   else{p.x+=b.r;}
  }
 }

 // גבולות: כל ציר בנפרד, כך שלאורך קיר פשוט מחליקים
 const bx=clamp(p.x,BEACH.minX,BEACH.maxX),bz=clamp(p.z,BEACH.minZ,BEACH.maxZ);
 if(bx!==p.x||bz!==p.z){p.x=bx;p.z=bz;p.roamSpeed*=.82;}

 p.speed=p.roamSpeed;
 game.approach={x:dirX,z:dirZ,speed:p.roamSpeed};
 game.manualApproach={x:dirX,z:dirZ,speed:p.roamSpeed};
 p.jumpY=0;p.jumpVelocity=0;p.dive=null;
}
