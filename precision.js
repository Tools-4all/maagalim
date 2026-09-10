const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const PLAY_SPEED=.86,CHOICE_SPEED=.10;
export function thumbResponse(distance,reach){const v=clamp((distance/reach-.16)/.84,0,1);return v*v;}
export function nudgeAim(game,vector,yaw,dt){
 const c=Math.cos(yaw),s=Math.sin(yaw),step=1.35*dt;
 const target=game.shotTarget();game.setAim({x:target.x+(vector.x*c+vector.z*s)*step,z:target.z+(-vector.x*s+vector.z*c)*step});
}
export function aimFeedback(game,yaw){
 const target=game.shotTarget();let actor=null,error=Infinity;
 for(const a of game.actors.slice(1)){const d=Math.hypot(a.x-target.x,a.z-target.z);if(d<error){actor=a;error=d;}}
 const dx=actor.x-target.x,dz=actor.z-target.z,c=Math.cos(yaw),s=Math.sin(yaw),d=Math.hypot(dx,dz)||1;
 return {actor,target,error,aligned:error<=.45,x:(dx*c-dz*s)/d,z:(dx*s+dz*c)/d};
}

export function reactionSpeed(game){
 if(game.status!=='playing'||game.phase!=='flight'||game.receiver!==0||game.sequence)return PLAY_SPEED;
 const b=game.ball,p=game.player,d=Math.hypot(b.position.x-p.x,b.position.z-p.z);
 if(d<2.2&&b.position.y<p.jumpY+3.1&&b.velocity.y<1)return .28;
 return PLAY_SPEED;
}
