// Use the same spatial constraints as the real hit, never just a height label.
const order=['around','around-reverse','foot-stall','inside','outside','rabona','heel','cross','side-lunge','lunge','knee-save','hip','knee','alternate','chest','shoulder','scorpion','head-side','head','foot'];
export function availableTricks(game){
 if(game.status!=='playing'||game.receiver!==0||game.sequence||game.player.dive||!['flight','guide-ready'].includes(game.phase))return [];
 const probe=Object.create(game);if(game.phase==='guide-ready')probe.phase='flight';
 const y=game.ball.position.y-game.player.jumpY;
 const ranked=y>=.84&&y<=1.24?['hip',...order.filter(id=>id!=='hip')]:order;
 return ranked.filter(id=>game.level.exercises.includes(id)&&(!game.guided||id===game.practiceMove)&&probe.canHit(id)&&(!['around','around-reverse','foot-stall'].includes(id)||game.ball.velocity.y<=.3));
}
export function performContextTrick(game,id){
 if(!availableTricks(game).includes(id))return false;
 game.selectMove(null);return game.playAction(['chest','hip','foot-stall'].includes(id)?'set':'pass',id);
}
export function attachTrickBubble({button,game,blocked,onUse,host=window,doc=document}){
 const bubble=doc.createElement('div');bubble.className='trick-bubble';bubble.hidden=true;bubble.dir='rtl';bubble.setAttribute('role','group');bubble.setAttribute('aria-label','תרגילים שמתאימים לכדור עכשיו');
 bubble.innerHTML='<b>מה מתאים עכשיו?</b><small>גרור לתרגיל ושחרר · החוצה לביטול</small><div class="context-options"></div><p class="context-empty">התקרב לכדור — אין כרגע מגע מתאים</p>';
 doc.body.append(bubble);button.setAttribute('aria-expanded','false');
 let pointer=null,timer=null,signature='',hover=null,opened=0;
 const close=()=>{clearTimeout(timer);timer=null;pointer=null;hover=null;bubble.hidden=true;button.setAttribute('aria-expanded','false');};
 const choose=id=>{const used=performContextTrick(game,id);close();onUse(id,used);};
 function refresh(){
  if(bubble.hidden)return;if(blocked()||game.status!=='playing'||performance.now()-opened>4000){close();return;}
  const y=game.ball.position.y-game.player.jumpY;
  bubble.querySelector('b').textContent=y<.84?'כדור נמוך · רגליים':y<=1.24?'גובה המותן':y<1.6?'גובה החזה':'כדור גבוה';
  const ids=availableTricks(game),next=ids.join(',');if(next===signature)return;signature=next;hover=null;
  const list=bubble.querySelector('.context-options');list.replaceChildren();
  for(const id of ids){const b=doc.createElement('button');b.dataset.trick=id;b.textContent=id==='hip'?'צ׳ינגה':names[id];b.onclick=()=>choose(id);list.append(b);}
  bubble.querySelector('.context-empty').hidden=ids.length>0;
 }
 function open(){if(blocked())return;opened=performance.now();bubble.hidden=false;signature='!';button.setAttribute('aria-expanded','true');refresh();
  const rect=button.getBoundingClientRect(),w=Math.min(360,host.innerWidth-24);bubble.style.width=w+'px';bubble.style.maxHeight=Math.max(96,rect.top-24)+'px';bubble.style.left=Math.max(12,Math.min(rect.left+rect.width/2-w/2,host.innerWidth-w-12))+'px';bubble.style.bottom=Math.max(12,host.innerHeight-rect.top+12)+'px';
 }
 button.oncontextmenu=e=>e.preventDefault();
 button.onpointerdown=e=>{if(blocked()||pointer!==null)return;e.preventDefault();pointer=e.pointerId;try{button.setPointerCapture(pointer);}catch{}timer=setTimeout(open,180);};
 host.addEventListener('pointermove',e=>{if(e.pointerId!==pointer||bubble.hidden)return;if(e.pointerType==='mouse'&&!e.buttons){close();return;}const b=doc.elementFromPoint(e.clientX,e.clientY)?.closest('[data-trick]');hover=b&&bubble.contains(b)?b.dataset.trick:null;bubble.querySelectorAll('[data-trick]').forEach(x=>x.classList.toggle('aimed',x.dataset.trick===hover));});
 host.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;clearTimeout(timer);timer=null;pointer=null;if(bubble.hidden){close();onUse(null,false);return;}const b=doc.elementFromPoint(e.clientX,e.clientY)?.closest('[data-trick]');if(hover&&b?.dataset.trick===hover)choose(hover);else close();},true);
 const cancel=e=>{if(e.pointerId===pointer)close();};host.addEventListener('pointercancel',cancel,true);button.addEventListener('lostpointercapture',cancel);
 for(const event of ['blur','pagehide','resize','gameviewportchange'])host.addEventListener(event,close);
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden)close();});
 host.addEventListener('pointerdown',e=>{if(!bubble.hidden&&!bubble.contains(e.target)&&!button.contains(e.target))close();},true);
 host.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 button.onclick=e=>{if(e.detail===0){if(bubble.hidden)open();else close();}};
 return {refresh,close,get active(){return pointer!==null||!bubble.hidden;}};
}
import {EXERCISES} from './data.js';
const names=Object.fromEntries(EXERCISES.map(e=>[e.id,e.name]));
