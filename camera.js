const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDelta=(to,from)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
export function followAngles(yaw,pitch,player,ball,velocity,dt,firstPerson){
 const lead=.10,dx=ball.x+velocity.x*lead-player.x,dz=ball.z+velocity.z*lead-player.z;
 const distance=Math.hypot(dx,dz),desired=distance>.25?Math.atan2(-dx,-dz):yaw;
 const blend=1-Math.exp(-7*dt);
 yaw+=clamp(angleDelta(desired,yaw)*blend,-3.8*dt,3.8*dt);
 const target=firstPerson?clamp(Math.atan2(ball.y+velocity.y*.05-1.67-(player.jumpY||0),Math.max(distance,.45)),-1.15,1.25):-.20;
 pitch+=(target-pitch)*blend;
 return {yaw,pitch};
}
