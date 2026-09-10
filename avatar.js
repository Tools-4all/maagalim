import * as T from './vendor/three.module.js?v=v2';
let humanData;const skinMaps={};
export async function loadHuman(){
 const response=await fetch(new URL('./assets/human.json',import.meta.url));if(!response.ok)throw new Error('Human mesh failed to load');humanData=await response.json();
 if(typeof document!=='undefined')await Promise.all(['male','female','dark'].map(async kind=>{
  try{const map=await new T.TextureLoader().loadAsync(new URL('./assets/skin-'+kind+'.jpg',import.meta.url).href);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;skinMaps[kind]=map;}catch{/* The existing complexion remains a usable fallback. */}
 }));
}
const smooth=(a,b,v)=>{const t=T.MathUtils.clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
export function makeHuman(scene,config){
 if(!humanData)throw new Error('Human mesh is not ready');
 const d=humanData,root=new T.Group();scene.add(root);const skinMap=skinMaps[config.style==='female'?'female':config.skin===0x79513d?'dark':'male'];
 const geo=new T.BufferGeometry();const pos=new Float32Array(d.position),colors=new Float32Array(pos.length);
 const mouth=d.joints.mouth;
 // Anatomical mesh, subtle complexion, lips and sun exposure. Clothing is opaque.
 for(let i=0;i<pos.length;i+=3){let x=pos[i],y=pos[i+1],z=pos[i+2];
  if(config.style!=='female'&&y>1.2&&y<1.48&&Math.abs(x)<.2&&z>.06){pos[i+2]-=.016*Math.sin((y-1.2)/.28*Math.PI);}
  const grain=Math.sin(x*831+y*579+z*311)*Math.sin(y*1471+x*827)*.019;
  const lip=Math.exp(-Math.pow((x-mouth[0])/.032,4)-Math.pow((y-mouth[1])/.007,2))*smooth(.1,.13,z);
  const warmth=.025*Math.exp(-Math.pow((y-1.65)/.04,2))+grain;
  colors[i]=skinMap?1:1+warmth;colors[i+1]=skinMap?1:.98+grain-lip*.27;colors[i+2]=skinMap?1:.96+grain-lip*.25;
 }
 geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(d.uv,2));geo.setAttribute('color',new T.BufferAttribute(colors,3));geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(d.skinIndex,4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(d.skinWeight,4));geo.setIndex(d.index);geo.computeVertexNormals();
 const skin=new T.MeshPhysicalMaterial({map:skinMap||null,color:config.skinTint||(skinMap?0xfff9ef:config.skin),roughness:.67,metalness:0,vertexColors:true,clearcoat:.035,clearcoatRoughness:.8});
 const cloth=new T.MeshStandardMaterial({color:config.color,roughness:.94});const eye=new T.MeshPhysicalMaterial({color:0xded7c5,roughness:.22});
 const indices=[[],[],[]];for(let t=0;t<d.index.length;t+=3){let mat=t<d.counts[0]?0:t<d.counts[0]+d.counts[1]?1:2;
  const a=d.index[t]*3,b=d.index[t+1]*3,c=d.index[t+2]*3;const y=(pos[a+1]+pos[b+1]+pos[c+1])/3,x=Math.abs((pos[a]+pos[b]+pos[c])/3);if(config.viewModel&&!(y<1.04||(x>.22&&y<1.52)))continue;
  if((config.style==='female'||config.outfit==='tank')&&mat===0&&y>1.08&&y<1.47&&x<.22)mat=1;
  indices[mat].push(d.index[t],d.index[t+1],d.index[t+2]);
 }
 geo.setIndex(indices.flat());let start=0;indices.forEach((a,i)=>{geo.addGroup(start,a.length,i);start+=a.length;});
 const body=new T.SkinnedMesh(geo,[skin,cloth,eye]);root.add(body);body.castShadow=!config.viewModel;body.receiveShadow=true;body.frustumCulled=false;
 const bones=d.bones.map((b,i)=>{const bone=new T.Bone();bone.name=b.name;const parent=b.parent>=0?d.bones[b.parent].position:[0,0,0];bone.position.set(...b.position.map((v,k)=>v-parent[k]));return bone;});
 d.bones.forEach((b,i)=>{(b.parent>=0?bones[b.parent]:root).add(bones[i]);});root.updateMatrixWorld(true);body.bind(new T.Skeleton(bones));
 const head=bones[2],headOrigin=d.bones[2].position;
 const dark=new T.MeshStandardMaterial({color:0x241a17,roughness:.83});
 function sphere(parent,material,p,scale){const m=new T.Mesh(new T.SphereGeometry(1,20,14),material);m.position.set(...p);m.scale.set(...scale);m.castShadow=true;parent.add(m);return m;}
 for(const side of ['r','l']){const e=d.joints[side+'-eye'],p=e.map((v,k)=>v-headOrigin[k]);p[2]+=.010;
  sphere(head,new T.MeshPhysicalMaterial({color:config.style==='female'?0x48634a:0x6c543d,roughness:.18}),p,[.0085,.0085,.004]);sphere(head,dark,[p[0],p[1],p[2]+.003],[.0038,.0038,.002]);
 }
 // Scalp follows the actual cranial surface, instead of a separate spherical head.
 const hairPositions=[];for(let t=0;t<d.counts[0];t+=3){const tri=d.index.slice(t,t+3),center=[0,0,0];for(const vi of tri)for(let k=0;k<3;k++)center[k]+=pos[vi*3+k]/3;
  if(center[1]>1.72||(center[1]>1.65&&center[2]<.025))for(const vi of tri){hairPositions.push((pos[vi*3]-headOrigin[0])*1.015,(pos[vi*3+1]-headOrigin[1])*1.014,(pos[vi*3+2]-headOrigin[2])*1.014);}
 }
 const hg=new T.BufferGeometry();hg.setAttribute('position',new T.Float32BufferAttribute(hairPositions,3));hg.computeVertexNormals();const hair=new T.Mesh(hg,dark);hair.castShadow=true;head.add(hair);
 if(config.style==='female'){sphere(head,dark,[0,.13,-.09],[.06,.08,.06]);sphere(head,dark,[0,.035,-.12],[.045,.13,.045]);}
 const arms=[{shoulder:bones[3],elbow:bones[4],hand:bones[5],s:-1},{shoulder:bones[6],elbow:bones[7],hand:bones[8],s:1}];
 const legs=[{hip:bones[9],knee:bones[10],foot:bones[11],s:-1},{hip:bones[12],knee:bones[13],foot:bones[14],s:1}];
 root.position.set(config.x,0,config.z);const mouthControl=new T.Object3D();
 return {root,hips:bones[0],torso:bones[1],head,arms,legs,mouth:mouthControl,baseY:d.bones[0].position[1],body,detailed:true};
}
