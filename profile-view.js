import * as T from './vendor/three.module.js?v=v2';
import {makeHuman} from './avatar.js?v=v2';
import {relaxArms} from './motion.js?v=v2';
import {volleyballMaterial} from './surfaces.js?v=v2';
export function avatarConfig(profile,viewModel=false){return {x:0,z:0,style:profile.style,skin:0xc5906c,skinTint:profile.skin,color:profile.outfitColor,outfit:profile.outfit,viewModel};}
export function disposeAvatar(person){const geometries=new Set(),materials=new Set();person.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o.isSkinnedMesh)o.skeleton?.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());person.root.removeFromParent();}
export function profilePreview(canvas){
 const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));renderer.setSize(240,280,false);renderer.outputColorSpace=T.SRGBColorSpace;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(37,240/280,.1,30);camera.position.set(2,1.5,3.5);camera.lookAt(0,.92,0);scene.add(new T.HemisphereLight(0xffffff,0x657a88,2));const light=new T.DirectionalLight(0xffe7ce,3);light.position.set(2,4,4);scene.add(light);
 let person=null;const ball=new T.Mesh(new T.SphereGeometry(.115,24,16),volleyballMaterial());ball.position.set(.48,.22,.2);scene.add(ball);
 return {update(profile){if(person)disposeAvatar(person);person=makeHuman(scene,avatarConfig(profile));relaxArms(person);ball.material.dispose();ball.material=volleyballMaterial(profile.ball);renderer.render(scene,camera);},dispose(){if(person)disposeAvatar(person);ball.geometry.dispose();ball.material.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
