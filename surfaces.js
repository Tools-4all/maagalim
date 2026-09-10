import * as T from './vendor/three.module.js?v=v2';
// Analytic wave normals keep reflections stable without another render pass.
export function createOcean(){
 const mat=new T.ShaderMaterial({uniforms:{time:{value:0},horizon:{value:new T.Color(0x7ba4c6)}},vertexShader:`
  uniform float time;varying vec3 vWorld;varying vec2 vSea;
  void main(){
   vec3 p=position;vSea=p.xy;
   p.z+=sin(p.y*.62-time*1.2)*.12+sin(p.x*.41+p.y*.27-time*1.55)*.06;
   vWorld=(modelMatrix*vec4(p,1.)).xyz;
   gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
  }`,fragmentShader:`
  uniform float time;uniform vec3 horizon;varying vec3 vWorld;varying vec2 vSea;
  void main(){
   float x=vSea.x,y=vSea.y,shore=y+95.;
   float dx=cos(x*.41+y*.27-time*1.55)*.0246+cos(x*2.1+y*1.1-time*2.2)*.027;
   float dy=cos(y*.62-time*1.2)*.0744+cos(x*.41+y*.27-time*1.55)*.0162+cos(x*2.1+y*1.1-time*2.2)*.016;
   vec3 n=normalize(vec3(-dx,1.,dy)),v=normalize(cameraPosition-vWorld),sun=normalize(vec3(-.582,.694,.425));
   float fresnel=.035+.72*pow(1.-max(dot(n,v),0.),4.);
   float depth=smoothstep(0.,115.,shore);
   vec3 shallow=vec3(.075,.53,.5),midSea=vec3(.02,.235,.34),deep=vec3(.006,.085,.175);
   vec3 water=depth<.5?mix(shallow,midSea,smoothstep(0.,.5,depth)):mix(midSea,deep,smoothstep(.5,1.,depth));
   vec3 reflected=mix(vec3(.29,.48,.61),vec3(.075,.26,.45),max(reflect(-v,n).y,0.));
   vec3 col=mix(water,reflected,fresnel);
   col+=vec3(1.,.89,.66)*pow(max(dot(n,normalize(v+sun)),0.),150.)*.8;
   vec3 ripple=normalize(vec3(-cos(x*5.7+y*3.1-time*3.1)*.05-cos(x*11.3-y*6.2-time*4.4)*.03,1.,cos(y*5.1-x*2.7-time*2.7)*.05));
   float glint=pow(max(dot(normalize(n*.55+ripple*.45),normalize(v+sun)),0.),420.);
   col+=vec3(1.,.94,.78)*glint*1.35*smoothstep(6.,26.,shore);
   float bed=1.-smoothstep(0.,11.,shore);
   col=mix(col,mix(col,vec3(.6,.515,.375),.6),bed*bed);
   float crest=sin(shore*2.3+sin(x*.32)*.48+time*1.35);
   float foam=pow(max(crest,0.),7.)*(1.-smoothstep(.3,7.,shore));
   float lace=.55+.45*sin(x*9.+sin(y*7.)*2.)*sin(y*11.+x*4.);
   col=mix(col,vec3(.83,.89,.83),foam*(.6+lace*.3));
   float haze=smoothstep(72.,196.,length(cameraPosition-vWorld));
   col=mix(col,horizon,haze*.86);
   gl_FragColor=vec4(col,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const sea=new T.Mesh(new T.PlaneGeometry(480,190,120,90),mat);sea.rotation.x=-Math.PI/2;sea.position.set(0,-.025,-105);return sea;
}
// Eighteen curved panels follow the sphere, with fine seams and surface grain.
export function volleyballMaterial(look='classic'){
 const mat=new T.MeshPhysicalMaterial({roughness:.61,clearcoat:.09,clearcoatRoughness:.75});
 mat.onBeforeCompile=shader=>{
  shader.uniforms.ballAccent={value:new T.Color(look==='tide'?'#24d8c7':look==='sunset'?'#fa714d':'#f8cf31')};
  shader.vertexShader='varying vec3 vPanel;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPanel=position;');
  shader.fragmentShader='uniform vec3 ballAccent; varying vec3 vPanel;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 p=normalize(vPanel),a=abs(p);float u,edge,face;
   if(a.x>=a.y&&a.x>=a.z){u=p.y/a.x;edge=a.x-max(a.y,a.z);face=p.x>0.?0.:1.;}
   else if(a.y>=a.x&&a.y>=a.z){u=p.z/a.y;edge=a.y-max(a.x,a.z);face=p.y>0.?1.:2.;}
   else{u=p.x/a.z;edge=a.z-max(a.x,a.y);face=p.z>0.?2.:0.;}
   float band=(u+1.)*1.5,which=mod(floor(band)+face,3.);
   vec3 panel=which<1.?ballAccent:which<2.?vec3(.022,.075,.22):vec3(.92,.92,.82);
   float seam=min(fract(band),1.-fract(band));
   float join=min(smoothstep(.002,.017,seam),smoothstep(.002,.010,edge));
   float grain=fract(sin(dot(floor(p*470.),vec3(127.1,311.7,74.7)))*43758.5453);
   diffuseColor.rgb*=mix(vec3(.055,.065,.061),panel,join)*(.96+.04*grain);
  `);
 };
 mat.customProgramCacheKey=()=> 'atlanta-volleyball-panels-v1';return mat;
}
