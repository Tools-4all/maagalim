import {thumbResponse} from './precision.js?v=v2';
// Pointer ownership belongs to one thumb. Other fingers may jump or hit freely.
export function movementInCamera(vector, startYaw, currentYaw) {
  const angle=startYaw-currentYaw,c=Math.cos(angle),s=Math.sin(angle);
  return {x:vector.x*c+vector.z*s,z:-vector.x*s+vector.z*c};
}
export function attachJoystick(element,{host=window,doc=document,knob,blocked=()=>false,yaw=()=>0,onChange=()=>{},onStop=()=>{}}={}) {
  let pointer=null,vector={x:0,z:0},startYaw=0;
  const subscriptions=[];
  const listen=(target,type,handler)=>{target.addEventListener(type,handler,{capture:true,passive:false});subscriptions.push(()=>target.removeEventListener(type,handler,true));};
  function cancel(){
    const old=pointer;pointer=null;vector={x:0,z:0};
    if(knob)knob.style.transform='translate(0px,0px)';
    onChange(vector,false,startYaw);if(old!==null)onStop();
    try{if(old!==null&&element.hasPointerCapture?.(old))element.releasePointerCapture(old);}catch{}
  }
  function update(event){
    const rect=element.getBoundingClientRect(),reach=Math.min(rect.width,rect.height)*.35;
    if(!reach){cancel();return;}
    const dx=event.clientX-rect.left-rect.width/2,dz=event.clientY-rect.top-rect.height/2;
    const distance=Math.hypot(dx,dz),scale=distance>reach?reach/distance:1;
    // A small dead zone lets the thumb rest without crawling.
    const amount=thumbResponse(distance,reach);
    vector=distance?{x:dx/distance*amount,z:dz/distance*amount}:{x:0,z:0};
    if(knob)knob.style.transform=`translate(${dx*scale}px,${dz*scale}px)`;
    onChange(vector,true,startYaw);
  }
  listen(element,'pointerdown',event=>{
    if(blocked()||pointer!==null||event.button>0)return;
    event.preventDefault();pointer=event.pointerId;startYaw=yaw();
    try{element.setPointerCapture(pointer);}catch{}update(event);
  });
  listen(host,'pointermove',event=>{
    if(pointer!==event.pointerId)return;
    if(blocked()||(event.pointerType==='mouse'&&event.buttons===0)){cancel();return;}
    event.preventDefault();update(event);
  });
  for(const type of ['pointerup','pointercancel'])listen(host,type,event=>{if(event.pointerId===pointer)cancel();});
  listen(element,'lostpointercapture',event=>{if(event.pointerId===pointer)cancel();});
  for(const type of ['blur','pagehide','resize','orientationchange'])listen(host,type,cancel);
  listen(doc,'visibilitychange',()=>{if(doc.hidden)cancel();});
  listen(doc,'fullscreenchange',cancel);
  return {cancel,get active(){return pointer!==null;},destroy(){cancel();subscriptions.forEach(remove=>remove());}};
}
