// Keep the game in the visible phone viewport; only dialogs may scroll.
export function installViewport(host=window,doc=document){
 let width=0,height=0,scheduled=false;
 const sync=()=>{
  scheduled=false;const vv=host.visualViewport;
  // Preserve accessibility pinch-zoom: do not fight a deliberately zoomed viewport.
  const zoomed=vv&&Math.abs(vv.scale-1)>.05;
  const w=Math.round(zoomed?host.innerWidth:vv?.width||host.innerWidth),h=Math.round(zoomed?host.innerHeight:vv?.height||host.innerHeight);
  doc.documentElement.style.setProperty('--app-height',h+'px');doc.documentElement.style.setProperty('--app-width',w+'px');
  if(w!==width||h!==height){width=w;height=h;host.dispatchEvent(new Event('gameviewportchange'));}
  if(!zoomed&&(host.scrollX||host.scrollY))host.scrollTo(0,0);
 };
 const schedule=()=>{if(!scheduled){scheduled=true;host.requestAnimationFrame(sync);}};
 for(const event of ['resize','orientationchange','pageshow'])host.addEventListener(event,schedule);
 host.visualViewport?.addEventListener('resize',schedule);
 doc.addEventListener('fullscreenchange',schedule);
 doc.addEventListener('touchmove',e=>{
  if(e.touches.length>1&&e.target.closest?.('dialog'))return;
  if(!e.target.closest?.('dialog,.practice-coach,.rotate-panel,.home-copy')&&e.cancelable)e.preventDefault();
 },{passive:false});
 host.addEventListener('scroll',schedule,{passive:true});sync();return sync;
}
