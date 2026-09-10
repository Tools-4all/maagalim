export const BEACH_TRACKS=[
 {id:'mamacita',name:'Mamacita',artist:'Mike Leite',bpm:100,description:'רגאטון לחוף',src:'./assets/mamacita.m4a',credit:'https://www.free-stock-music.com/mike-leite-mamacita.html'},
 {id:'vacaciones',name:'Vacaciones',artist:'Mike Leite',bpm:105,description:'קצב לטיני · אינסטרומנטלי',src:'./assets/vacaciones.m4a',credit:'https://www.free-stock-music.com/mike-leite-vacaciones.html'}
];
// Media and synthesised music share a gain bus, including on iOS.
export class BeachAudio{
 constructor(element){
  this.element=element;this.ctx=null;this.volume=.45;this.music=true;this.effects=true;this.active=false;this.loadedUser=false;this.objectURL=null;this.source='playlist';this.trackIndex=0;this.beat=0;this.next=0;this.timer=null;this.lastVoice=0;this.status='ready';this.epoch=0;
  try{const p=JSON.parse(localStorage.getItem('atlanta-audio-v2')||'{}');if(Number.isFinite(p.volume))this.volume=Math.max(0,Math.min(1,p.volume));if(typeof p.music==='boolean')this.music=p.music;if(typeof p.effects==='boolean')this.effects=p.effects;this.source=p.source==='beat'?'beat':'playlist';this.trackIndex=p.trackIndex===1?1:0;}catch{}
  element.loop=false;element.addEventListener('ended',()=>{if(this.source==='playlist')this.chooseTrack((this.trackIndex+1)%BEACH_TRACKS.length);else if(this.source==='user'&&this.active&&this.music){element.currentTime=0;this.playMedia();}});
  element.addEventListener('playing',()=>{this.status='playing';});element.addEventListener('error',()=>{this.status='error';});
 }
 remember(){try{localStorage.setItem('atlanta-audio-v2',JSON.stringify({volume:this.volume,music:this.music,effects:this.effects,source:this.source,trackIndex:this.trackIndex}));}catch{}}
 init(){
  if(this.ctx)return;
  this.ctx=new(window.AudioContext||window.webkitAudioContext)();
  const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.ratio.value=4;limiter.connect(this.ctx.destination);
  this.master=this.ctx.createGain();this.master.gain.value=.5;this.master.connect(limiter);
  this.musicBus=this.ctx.createGain();this.musicBus.gain.value=this.music?this.volume*.7:0;this.musicBus.connect(limiter);
  this.mediaSource=this.ctx.createMediaElementSource(this.element);this.mediaSource.connect(this.musicBus);this.element.volume=1;
  this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);const d=this.noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 }
 async start(){
  this.active=true;const epoch=++this.epoch;
  try{this.init();const resumed=this.ctx.resume();
   if(this.music&&this.source!=='beat'){if(!this.element.getAttribute('src'))this.element.src=BEACH_TRACKS[this.trackIndex].src;this.playMedia();}
   await resumed;if(!this.active||epoch!==this.epoch)return;
   this.next=Math.max(this.next,this.ctx.currentTime+.035);if(!this.timer)this.timer=setInterval(()=>this.schedule(),50);
  }catch{this.status='blocked';}
 }
 playMedia(){
  if(!this.active||!this.music||this.source==='beat')return Promise.resolve();
  const selected=this.element.src;
  return this.element.play().then(()=>{if(!this.active||!this.music)this.element.pause();else this.status='playing';}).catch(error=>{
   if(this.element.src!==selected||error.name==='AbortError')return;
   this.status=error.name==='NotAllowedError'?'blocked':'error';
  });
 }
 pause(){this.active=false;this.epoch++;this.element.pause();if(this.timer){clearInterval(this.timer);this.timer=null;}if(this.ctx)this.ctx.suspend().catch(()=>{});if('speechSynthesis'in window)window.speechSynthesis.cancel();}
 setVolume(v){this.volume=Math.max(0,Math.min(1,v));if(this.musicBus)this.musicBus.gain.setTargetAtTime(this.music?this.volume*.7:0,this.ctx.currentTime,.025);this.remember();}
 setMusic(v){this.music=v;this.setVolume(this.volume);if(!v)this.element.pause();else if(this.active)this.playMedia();this.remember();}
 setEffects(v){this.effects=v;this.remember();}
 chooseTrack(index=0){this.element.pause();this.trackIndex=index%BEACH_TRACKS.length;this.source='playlist';this.status='loading';this.element.src=BEACH_TRACKS[this.trackIndex].src;this.element.load();this.remember();return this.playMedia();}
 chooseFile(file){if(this.objectURL)URL.revokeObjectURL(this.objectURL);this.objectURL=URL.createObjectURL(file);this.element.src=this.objectURL;this.loadedUser=true;this.userName=file.name;this.source='user';return this.active&&this.music?this.element.play():Promise.resolve();}
 chooseBeat(){this.element.pause();this.source='beat';this.beat=0;if(this.ctx)this.next=this.ctx.currentTime+.05;this.remember();}
 get nowPlaying(){return this.source==='playlist'?BEACH_TRACKS[this.trackIndex].name:this.source==='beat'?'Rumba del Mar · גיטרה ספרדית':this.userName||'השיר שלך';}
 tone(freq,start,len,vol=.2,type='sine',target=this.master){if(!this.ctx)return;const o=this.ctx.createOscillator(),gain=this.ctx.createGain();o.type=type;o.frequency.value=freq;gain.gain.setValueAtTime(.001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.002,vol),start+.008);gain.gain.exponentialRampToValueAtTime(.001,start+len);o.connect(gain);gain.connect(target);o.start(start);o.stop(start+len+.02);o.onended=()=>{o.disconnect();gain.disconnect();};}
 hiss(start,len,vol=.15,frequency=3000,target=this.master){if(!this.ctx)return;const src=this.ctx.createBufferSource();src.buffer=this.noise;const filter=this.ctx.createBiquadFilter();filter.type='highpass';filter.frequency.value=frequency;const gain=this.ctx.createGain();gain.gain.setValueAtTime(vol,start);gain.gain.exponentialRampToValueAtTime(.001,start+len);src.connect(filter);filter.connect(gain);gain.connect(target);src.start(start);src.stop(start+len);src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();};}
 kick(at,vol,target=this.master){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.frequency.setValueAtTime(125,at);o.frequency.exponentialRampToValueAtTime(45,at+.16);g.gain.setValueAtTime(vol,at);g.gain.exponentialRampToValueAtTime(.001,at+.22);o.connect(g);g.connect(target);o.start(at);o.stop(at+.23);o.onended=()=>{o.disconnect();g.disconnect();};}
 guitar(note,at,volume=.12){
  // Plucked harmonics: original melody, no sampled commercial recording.
  const f=440*Math.pow(2,(note-69)/12);
  for(let harmonic=1;harmonic<=5;harmonic++)this.tone(f*harmonic,at,.5/harmonic+.13,volume/Math.pow(harmonic,1.7),'sine',this.musicBus);
 }
 schedule(){
  if(!this.ctx||!this.active)return;const now=this.ctx.currentTime;if(this.next<now-.3)this.next=now+.04;
  while(this.next<now+.12){
   if(this.music&&this.source==='beat'){
    const b=this.beat%16,bar=Math.floor(this.beat/16)%4,t=this.next;
    if([0,6,8].includes(b))this.kick(t,.42,this.musicBus);
    if([4,11,14].includes(b))this.hiss(t,.09,.19,1200,this.musicBus);
    if(b%2===0)this.hiss(t,.025,.09,5500,this.musicBus);
    const chords=[[57,60,64],[55,59,62],[53,57,60],[52,56,59]];
    if([0,3,6,10,12].includes(b))chords[bar].forEach((n,i)=>this.guitar(n,t+i*.011,.065));
    if([0,8].includes(b))this.tone(440*Math.pow(2,(chords[bar][0]-81)/12),t,.24,.25,'triangle',this.musicBus);
    const melody=[[76,0,0,74,72,0,71,0,72,0,74,0,76,0,0,0],[74,0,0,71,67,0,69,0,71,0,74,0,72,0,71,0],[72,0,0,69,65,0,67,0,69,0,72,0,71,0,69,0],[71,0,0,68,64,0,68,0,71,0,74,0,72,71,68,0]];
    if(melody[bar][b])this.guitar(melody[bar][b],t,.16);
   }
   this.next+=60/112/4;this.beat++;
  }
 }
 hit(head=false){if(!this.effects||!this.active||!this.ctx)return;this.kick(this.ctx.currentTime,.32);this.hiss(this.ctx.currentTime,.06,.075,head?1900:3300);}
 point(){if(!this.effects||!this.active||!this.ctx)return;[523,659,784,1046].forEach((f,i)=>this.tone(f,this.ctx.currentTime+i*.07,.18,.16,'triangle'));this.say('¡Vamos! ¡Qué buena!',1.12);}
 laugh(){if(!this.effects||!this.active||!this.ctx)return;const at=this.ctx.currentTime;for(let j=0;j<2;j++)for(let i=0;i<3;i++)this.tone(175+j*58+i*13,at+j*.065+i*.14,.10,.075,'triangle');this.say('¡Ja, ja, ja! ¡Otra vez!',1.08);}
 say(text,rate=1){if(!this.effects||!this.active||!('speechSynthesis'in window)||Date.now()-this.lastVoice<2400)return;const u=new SpeechSynthesisUtterance(text);u.lang='es-ES';u.rate=rate;u.volume=.30;const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('es'));if(voice)u.voice=voice;this.lastVoice=Date.now();speechSynthesis.speak(u);}
}
