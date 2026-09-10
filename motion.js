// Joint poses shared by local, first-person and AI avatars. Model faces local +Z.
export function relaxArms(person,walk=0,speed=0){
  for(const arm of person.arms){
    // The source has an A-pose. Lower the shoulders instead of raising them further.
    arm.shoulder.rotation.set(-.10-walk*arm.s*speed*.08,0,-arm.s*.52);
    arm.elbow.rotation.set(.20,0,0);arm.hand.rotation.set(0,0,0);
  }
}
export function prepareChest(person){
  person.hips.position.y-=.035;person.torso.rotation.x=-.14;
  for(const leg of person.legs){leg.hip.rotation.x=-.12;leg.knee.rotation.x=.25;}
  for(const arm of person.arms){arm.shoulder.rotation.set(-.12,0,-arm.s*.23);arm.elbow.rotation.x=-.22;}
}
export function poseContact(person,id,progress,side=1){
  const t=Math.max(0,Math.min(1,progress)),k=Math.sin(t*Math.PI);
  const leg=person.legs[side<0?0:1];
  if(id==='knee-save'){
    poseKneeSave(person,k,side);
  }else if(id==='head-side'){
    person.torso.rotation.x=.22*k;person.torso.rotation.y=side*.35*k;person.torso.rotation.z=-side*.1*k;person.head.rotation.y=side*.32*k;person.head.rotation.x=.10*k;
    for(const a of person.arms)a.shoulder.rotation.z=-a.s*.16;
  }else if(id==='foot-stall'){
    leg.hip.rotation.x=-1.04*k;leg.knee.rotation.x=.80*k;leg.foot.rotation.x=-.15*k;person.torso.rotation.x=-.07*k;
  }else if(id==='scorpion'){
    person.hips.rotation.x=.72*k;person.torso.rotation.x=.32*k;person.head.rotation.x=-.32*k;
    leg.hip.rotation.set(.72*k,-side*.13*k,side*.12*k);leg.knee.rotation.x=2.38*k;leg.foot.rotation.x=-.28*k;
    const support=person.legs[side<0?1:0];support.hip.rotation.x=-.80*k;support.knee.rotation.x=.18*k;
    for(const a of person.arms){a.shoulder.rotation.set(-.70*k,0,-a.s*.12);a.elbow.rotation.x=.28;}
  }else if(id==='hip'){
    // Load away from the ball, then drive the side of the waist into contact.
    const load=t<.5?Math.sin(t*2*Math.PI):0;
    person.hips.position.x+=side*(.07*k-.09*load);
    person.hips.position.y-=.035*(1-k);person.hips.rotation.z=side*(.13*load-.19*k);person.torso.rotation.z=side*.23*k;
    person.torso.rotation.y=-side*.12*k;
    for(const l of person.legs){l.hip.rotation.z=l.s*.11*k;l.knee.rotation.x=.22*(1-k);}
    for(const a of person.arms)a.shoulder.rotation.z=-a.s*.13;
  }else if(id==='rabona'){
    leg.hip.rotation.set(.45*k,side*.8*k,-side*.62*k);leg.knee.rotation.x=1.22*k;leg.foot.rotation.set(-.13*k,-side*.35*k,side*.18*k);
    person.torso.rotation.y=side*.20*k;person.torso.rotation.z=-side*.10*k;
    for(const a of person.arms)a.shoulder.rotation.z=-a.s*.10;
  }else if(id==='side-lunge'){
    person.hips.position.y-=.17*k;person.torso.rotation.z=-side*.22*k;
    leg.hip.rotation.set(-.5*k,0,side*.9*k);leg.knee.rotation.x=.13*k;leg.foot.rotation.z=side*.25*k;
    const support=person.legs[side<0?1:0];support.hip.rotation.x=-.45*k;support.knee.rotation.x=.82*k;
    for(const a of person.arms)a.shoulder.rotation.z=-a.s*.08;
  }else if(id==='chest'){
    person.hips.position.y+=.045*k;
    person.torso.rotation.x=-.24*(1-k)-.025;
    person.torso.rotation.y=side*.10*k;
    for(const l of person.legs){l.hip.rotation.x=-.10*(1-k);l.knee.rotation.x=.24*(1-k);}
    for(const a of person.arms){a.shoulder.rotation.set(-.14,0,-a.s*.22);a.elbow.rotation.x=-.18;}
  }else if(id==='head'){
    person.torso.rotation.x=.22*k;
    const u=Math.min(1,t*2),drive=u*u*(3-2*u);
    person.head.rotation.x=t<=.5?-.22+.40*drive:.18*k+.20*Math.sin((t-.5)*2*Math.PI);
    for(const a of person.arms)a.shoulder.rotation.z=-a.s*.18;
  }else if(id==='shoulder'){
    person.hips.position.y+=.035*k;person.torso.rotation.z=side*.19*k;person.torso.rotation.y=-side*.20*k;
    const arm=person.arms[side<0?0:1];arm.shoulder.rotation.x=-.16*k;arm.shoulder.rotation.z=-arm.s*.37;
    person.head.rotation.z=side*.13*k;
  }else if(id==='heel'){
    leg.hip.rotation.set(.35*k,-side*.3*k,side*.13*k);leg.knee.rotation.x=1.80*k;leg.foot.rotation.x=-.3*k;
    person.torso.rotation.x=.18*k;person.torso.rotation.y=-side*.22*k;
    for(const a of person.arms)a.shoulder.rotation.z=-a.s*.16;
  }else if(id==='cross'){
    leg.hip.rotation.set(-.90*k,side*.45*k,-side*.53*k);leg.knee.rotation.x=.72*k;
    leg.foot.rotation.set(.1*k,side*.3*k,side*.28*k);person.torso.rotation.z=side*.07*k;
  }else if(id==='knee'||id==='alternate'){
    leg.hip.rotation.x=-1.28*k;leg.knee.rotation.x=1.48*k;person.torso.rotation.x=-.06*k;
  }else if(id==='lunge'){
    person.hips.position.y-=.13*k;person.torso.rotation.x=.22*k;leg.hip.rotation.set(-1.02*k,0,side*.23*k);leg.knee.rotation.x=.25*k;
    const support=person.legs[side<0?1:0];support.hip.rotation.x=-.26*k;support.knee.rotation.x=.6*k;
    for(const a of person.arms)a.shoulder.rotation.z=-a.s*.08;
  }else if(id==='inside'){
    leg.hip.rotation.set(-.95*k,side*.75*k,-side*.22*k);leg.knee.rotation.x=.88*k;
    leg.foot.rotation.set(.08*k,side*.35*k,side*.22*k);person.torso.rotation.y=-side*.13*k;
  }else if(id==='outside'){
    leg.hip.rotation.set(-1.00*k,-side*.47*k,side*.28*k);leg.knee.rotation.x=.68*k;
    leg.foot.rotation.set(.08*k,-side*.30*k,-side*.22*k);person.torso.rotation.z=-side*.08*k;
  }else if(id==='around'||id==='around-reverse'){
    const orbit=t*Math.PI*2*(id==='around-reverse'?-1:1);
    leg.hip.rotation.set(-k*(.95+.25*Math.cos(orbit)),side*.55*Math.sin(orbit)*k,side*.46*Math.cos(orbit)*k);
    leg.knee.rotation.x=k*(.65+.42*Math.sin(orbit));leg.foot.rotation.x=.18*k;
    person.torso.rotation.x=-.08*k;
    for(const a of person.arms)a.shoulder.rotation.z=-a.s*.05;
  }else{
    leg.hip.rotation.x=-1.2*k;leg.knee.rotation.x=.24*k;leg.foot.rotation.x=.14*k;
  }
}

export function poseKneeSave(person,amount,side=1){
 const k=Math.max(0,Math.min(1,amount)),leg=person.legs[side<0?0:1],support=person.legs[side<0?1:0];
 person.hips.position.y-=.41*k;person.torso.rotation.x=.22*k;person.torso.rotation.z=-side*.08*k;
 support.hip.rotation.set(.04*k,0,-support.s*.05*k);support.knee.rotation.x=1.60*k;support.foot.rotation.x=-.45*k;
 leg.hip.rotation.set(-1.16*k,0,side*.15*k);leg.knee.rotation.x=.12*k;leg.foot.rotation.x=.06*k;
 for(const a of person.arms){a.shoulder.rotation.set(-.38*k,0,-a.s*.1);a.elbow.rotation.x=.42*k;}
 person.head.rotation.x=-.10*k;
}

// The legs unload on ascent, extend before landing, then absorb the impact.
export function poseJump(person,actor,dt){
 const height=actor.jumpY||0,velocity=actor.jumpVelocity||0;
 if((person.previousJumpHeight||0)>.005&&height<=.005)person.landingTime=.20;
 person.previousJumpHeight=height;
 person.landingTime=Math.max(0,(person.landingTime||0)-dt);
 if(height>.005){
  const tuck=Math.min(1,height/.38),extension=velocity<0?Math.min(1,height/.25):1;
  for(const leg of person.legs){leg.hip.rotation.set(-.12-.22*tuck*extension,0,leg.s*.035);leg.knee.rotation.set(.12+.60*tuck*extension,0,0);leg.foot.rotation.x=-.14*(1-extension);}
  for(const arm of person.arms){arm.shoulder.rotation.x=-.45-.40*tuck;arm.shoulder.rotation.z=-arm.s*.20;arm.elbow.rotation.x=.38;}
  person.torso.rotation.x=-.05*tuck;
 }else if(person.landingTime>0){
  const absorb=Math.sin(Math.PI*person.landingTime/.20);person.hips.position.y-=.075*absorb;person.torso.rotation.x+=.12*absorb;
  for(const leg of person.legs){leg.hip.rotation.x=-.20*absorb;leg.knee.rotation.x=.40*absorb;}
 }
}
