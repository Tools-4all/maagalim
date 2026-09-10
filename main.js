import {profilePreview} from './profile-view.js';
import {PLAY_SPEED,reactionSpeed,nudgeAim,aimFeedback} from './precision.js';
import {GROUPS,normalizeProfile,readProfile,writeProfile,hasProfile,quickChoices,chooseQuick} from './loadout.js';
import {installViewport} from './viewport.js';
import {Game,clamp,chargeProfile} from './physics.js';
import {loadHuman} from './avatar.js';
import {World} from './scene.js';
import {BeachAudio,BEACH_TRACKS} from './audio.js';
import {EXERCISES,LEVELS,TAUNTS,AI_MISSES} from './data.js';
import {gestureIntent,HOLD_DELAY,SWIPE_DISTANCE,PRACTICE} from './controls.js';
import {LESSONS,LESSON_ORDER,lessonFor,needsLandscape} from './guide.js';
import {attachJoystick,movementInCamera} from './joystick.js';
import {updateRoam} from './roam.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const game=new Game(), sound=new BeachAudio($('#user-song'));
const syncViewport=installViewport();
const keys=new Set(), storageKey='atlanta-beach-v1';
let profileView=null,profileConfirmed=false;
let roaming=false,lastCircle=null,veilBusy=false;
let world,paused=false,panelWasPlaying=false,started=false,lastTime=0,frame=0;
let floatUntil=0,speechUntil=0,speechActor=1,countTimer=null,joy={x:0,z:0},joyYaw=0,joystickControl;
let profileStorage=null;try{profileStorage=window.localStorage;}catch{}
let playerProfile=readProfile(profileStorage);
profileConfirmed=hasProfile(profileStorage);
let actionPress=null,lookStart=null,coachUntil=0,landscapeBlocked=false,attackUntil=0;
let progress={bestScore:0,bestCombo:0,completed:false,rounds:0};
try{const d=JSON.parse(localStorage.getItem(storageKey)||'null');if(d&&typeof d==='object')progress={bestScore:Number(d.bestScore)||0,bestCombo:Number(d.bestCombo)||0,completed:d.completed===true,rounds:Number(d.rounds)||0};}catch{}
function inputBlocked(){return paused||landscapeBlocked||game.phase==='demo';}
function syncLandscape(){
  const blocked=needsLandscape($('#world').clientWidth,$('#world').clientHeight,started),changed=blocked!==landscapeBlocked;landscapeBlocked=blocked;
  $('#rotate-panel').hidden=!blocked;$('#hud').inert=blocked;$('.topbar').inert=blocked;
  if(changed){cancelAction();game.actionQueue=null;game.buffer=null;releaseJoy();keys.clear();game.move(0,0);if(blocked)sound.pause();else if(started&&!paused)sound.start();}
}
async function enterLandscape(){
  try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
    if(screen.orientation?.lock)await screen.orientation.lock('landscape');
  }catch{$('#rotate-help').textContent='סובב את המכשיר לרוחב. אם המסך לא מסתובב, בטל את נעילת הסיבוב.';}
  syncLandscape();
}
$('#landscape-button').hidden=!document.fullscreenEnabled;$('#landscape-button').onclick=enterLandscape;
$('#rotate-home').onclick=()=>goHome();window.addEventListener('resize',syncLandscape);window.addEventListener('gameviewportchange',syncLandscape);document.addEventListener('fullscreenchange',syncLandscape);
function saveProgress(){
  if(game.practice)return;
  progress.bestScore=Math.max(progress.bestScore,game.score);progress.bestCombo=Math.max(progress.bestCombo,game.bestCombo);
  progress.completed ||= game.status==='won';progress.rounds++;
  try{localStorage.setItem(storageKey,JSON.stringify(progress));}catch{}
}
function floating(text,sub='',color=''){
  const el=$('#floating');el.replaceChildren(document.createTextNode(text));
  if(sub){const small=document.createElement('small');small.textContent=sub;el.append(small);}
  el.style.color=color||'white';el.classList.add('show');floatUntil=performance.now()+1500;
}
function coach(text){$('#touch-coach').textContent=text;coachUntil=performance.now()+2600;}
function speak(){}
function cancelAction(){actionPress=null;game.cancelCharge();$('#contact-button').classList.remove('pressed');$('#smash-button').classList.remove('pressed');}
function releaseJoy(){joystickControl?.cancel();joy={x:0,z:0};game.stopManualMovement();}
function openPanel(html,canResume=true){profileView?.dispose();profileView=null;
  if(!$('#panel').open)panelWasPlaying=canResume&&started&&!paused;
  paused=true;cancelAction();game.actionQueue=null;game.buffer=null;keys.clear();releaseJoy();game.move(0,0);sound.pause();
  $('#panel-content').innerHTML=html;if(!$('#panel').open)$('#panel').showModal();
}
function closePanel(){profileView?.dispose();profileView=null;
  if($('#panel').open)$('#panel').close();
  if(panelWasPlaying){paused=false;if(!landscapeBlocked)sound.start();}panelWasPlaying=false;
}
function dismissPanel(){if(started&&['won','lost'].includes(game.status))goHome();else closePanel();}
$('#panel-close').onclick=dismissPanel;
$('#panel').addEventListener('cancel',e=>{e.preventDefault();dismissPanel();});
function help(){
  openPanel('<div class="panel-eyebrow">JUST CATCH THE RHYTHM</div><h2 id="panel-title">כפתור אחד. כל המעגל.</h2>'+
    '<div class="help-list"><div class="help-row"><span>1</span><div><b>נוגעים ומוסרים</b><p>נגיעה קצרה בכפתור הגדול. הגוף מתאים את המגע לגובה הכדור: רגל, ירך, חזה או ראש. עזרה בתנועה מקרבת אותך לכדור.</p></div></div>'+
    '<div class="help-row"><span>↑</span><div><b>מחליקים ומרימים</b><p>החלק למעלה מתוך הכפתור להרמה. מול החזה, השחקן פותח חזה ומרים לחבר. לחץ על שם של חבר או על החול כדי לבחור יעד.</p></div></div>'+
    '<div class="help-row"><span>↔</span><div><b>עושים תרגיל</b><p>החלק שמאלה למסירה פנימית, ימינה לחיצונית, או למטה לסיבוב הרגל סביב הכדור. את תרגילי הרגל מבצעים כשהכדור נמוך. אפשר להחליק קצת לפני המגע.</p></div></div>'+
    '<div class="help-row"><span>●</span><div><b>כפתור הנחתה נפרד</b><p>החזק את כפתור ההנחתה הכתום ושחרר להנחתה. החזקה ארוכה מחזקת את המכה. כפתור הקפיצה לידו מאפשר לקפוץ ולנגוח בו זמנית.</p></div></div></div>'+
    '<p class="keyboard-help">במחשב: WASD לתנועה · R נגיעה / החזקה · Q הרמה · רווח קפיצה. Z / C / T לתרגילי רגל.</p>'+
    '<div class="actions"><button id="help-practice" class="primary">מתרגלים תנועה</button><button id="help-done" class="secondary">הבנתי</button></div>'+
    '<div class="source-links"><a href="./assets/CREDITS.md" target="_blank" rel="noopener">קרדיטים לדמויות ולחוף</a> · <a href="https://www.youtube.com/watch?v=XuVEWVfR7AU" target="_blank" rel="noopener">הדרכת חזה — Classe Alta</a></div>');
  $('#help-done').onclick=closePanel;$('#help-practice').onclick=moves;
}
$('#help-button').onclick=help;
function moves(){
  openPanel('<div class="panel-eyebrow">מדריך לתרגילים · צופים ואז מנסים</div><h2 id="panel-title">לומדים תנועה אחת בכל פעם.</h2>'+
    '<p>בכל שיעור רואים הדגמה בגוף השחקן ובכפתור. אחר כך הכדור מחכה בנקודת המגע, עד שתנסה. שלוש הצלחות — ומתקדמים לתרגיל הבא.</p>'+
    '<button id="start-course" class="primary full">מתחילים מהמגע הראשון</button><div class="exercise-list">'+LESSON_ORDER.map((id,i)=>{
      const e=EXERCISES.find(e=>e.id===id),lesson=lessonFor(id);
      return '<details class="lesson-card"'+(i===0?' open':'')+'><summary><span>'+String(i+1).padStart(2,'0')+'</span><b>'+e.name+'</b><small>'+PRACTICE[id].gesture+'</small></summary><ol>'+lesson.steps.map(text=>'<li>'+text+'</li>').join('')+'</ol><p class="lesson-key">במחשב: '+PRACTICE[id].key+(id==='head'?' + רווח':'')+'</p><button class="practice-start secondary" data-practice="'+id+'">הדגמה ותרגול</button></details>';
    }).join('')+'</div><div class="lesson-extra"><b>איך עונים להנחתה?</b><p>כשמופיע ״הנחתה אליך״, התקרב למסלול הכדור וגע בכפתור. רגל או ירך מרימות את הכדור בחזרה. העזרה בתנועה פעילה כברירת מחדל.</p></div><details class="future-moves"><summary>5 תנועות להרחבות הבאות</summary>'+EXERCISES.filter(e=>e.level>1).map(e=>'<p><b>'+e.name+'</b> · '+e.body+'<br>'+e.movement+(e.kind==='fitness'?' (גרסת כושר וארקייד)':'')+'</p>').join('')+'</details>');
  $('#start-course').onclick=()=>startPractice(LESSON_ORDER[0]);$$('[data-practice]').forEach(b=>b.onclick=()=>startPractice(b.dataset.practice));
}
$('#moves-button').onclick=moves;
function gestureMap(){
 const cells=[['↖','shoulder'],['↑','chest'],['↗','alternate'],['←','inside'],['●','foot'],['→','outside'],['↙','heel'],['↓','around'],['↘','cross']];
 openPanel('<div class="panel-eyebrow">מפת תרגילים</div><h2 id="panel-title">מתחילים במרכז. מחליקים.</h2><p>במשחק, החלק מתוך כפתור המסירה בכיוון החץ. כאן אפשר לבחור תרגיל כדי לראות הדגמה ולנסות.</p><div class="gesture-map">'+cells.map(([arrow,id])=>'<button class="map-cell" data-lesson="'+id+'"><b aria-hidden="true">'+arrow+'</b><span>'+EXERCISES.find(e=>e.id===id).name+'</span></button>').join('')+'</div><p>נגיעה מתאימה את המגע לגובה הכדור. קפיצה + נגיעה = נגיחה. משך ההחזקה קובע את כוח ההנחתה.</p><div class="actions"><button id="map-resume" class="primary">חוזרים לשחק</button><button id="map-lessons" class="secondary">כל 20 השיעורים</button></div>');
 $$('[data-lesson]').forEach(b=>b.onclick=()=>startPractice(b.dataset.lesson));$('#map-resume').onclick=closePanel;$('#map-lessons').onclick=moves;
}
const quickButtons=[...document.querySelectorAll('#quick-tricks button')];
function updateQuick(){
 const choices=quickChoices(game,playerProfile);$('#gesture-hint').textContent=game.preparedMove?'מוכן: '+EXERCISES.find(e=>e.id===game.preparedMove).name:'בחר מראש · הביצוע במגע';
 $$('[data-height]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.height===choices.group)));
 quickButtons.forEach((b,i)=>{const choice=choices.slots[i];b.dataset.move=choice?.id||'';b.textContent=choice?({hip:'צ׳ינגה',around:'מסביב לעולם','around-reverse':'סיבוב הפוך','foot-stall':'איזון ברגל','head-side':'נגיחת צד','knee-save':'הצלת ברך'}[choice.id]||EXERCISES.find(e=>e.id===choice.id).name):'לא נבחר';b.disabled=inputBlocked()||!!actionPress||!choice||!choice.ready&&!choice.soon;b.classList.toggle('prepared',!!choice?.prepared);b.setAttribute('aria-pressed',String(!!choice?.prepared));b.classList.toggle('ready',!!choice?.ready);b.classList.toggle('soon',!!choice?.soon&&!choice?.ready);});
}
quickButtons.forEach(b=>{b.onpointerdown=e=>{e.preventDefault();if(!b.disabled&&chooseQuick(game,playerProfile,b.dataset.move)){coach('בחרת '+b.textContent);handleEvents();}};b.onclick=e=>{if(e.detail===0&&!b.disabled){chooseQuick(game,playerProfile,b.dataset.move);handleEvents();}};});
function editProfile(onDone=null){
 onDone=typeof onDone==='function'?onDone:null;
 const draft=normalizeProfile(playerProfile);
 openPanel('<h2 id="panel-title">'+(onDone?'יוצרים פרופיל':'הפרופיל שלך בחוף')+'</h2><p>'+(onDone?'בוחרים שם ומראה פעם אחת. הפרופיל נשמר במכשיר ונטען לבד בכניסה הבאה.':'עדכון המראה והציוד. השינויים נשמרים על אותו פרופיל.')+'</p><div class="profile-editor"><canvas id="profile-preview" aria-label="תצוגה מקדימה של הדמות והכדור"></canvas><div class="profile-fields"><label>שם<input id="profile-name" maxlength="24" autocomplete="given-name"></label><label>כינוי<input id="profile-nickname" maxlength="24" autocomplete="nickname"></label><label>מראה<select id="profile-style"><option value="male">שחקן · שיער קצר</option><option value="female">שחקנית · שיער אסוף</option></select></label><label>גוון עור<input id="profile-skin" type="color"></label><label>לבוש<select id="profile-outfit"><option value="shorts">בגד ים</option><option value="tank">גופייה ובגד ים</option></select></label><label>צבע לבוש<input id="profile-outfitColor" type="color"></label><label>כדור<select id="profile-ball"><option value="classic">קלאסי · צהוב</option><option value="tide">גל · טורקיז</option><option value="sunset">שקיעה · כתום</option></select></label></div></div><details><summary>התרגילים שלי · עד 3 לכל גובה</summary><div id="loadout-groups"></div></details><p id="loadout-status" role="status"></p><div class="actions"><button id="save-loadout" class="primary">שמור וחזור</button>'+(onDone?'':'<button id="cancel-loadout" class="secondary">ביטול</button>')+'</div>');
 $('#save-loadout').textContent=onDone?'צור פרופיל · יוצאים לחוף':'שמור וחזור';
 try{profileView=profilePreview($('#profile-preview'));profileView.update(draft);}catch{$('#profile-preview').hidden=true;}
 for(const key of ['name','nickname','style','skin','outfit','outfitColor','ball']){const input=$('#profile-'+key);input.value=draft[key];input.onchange=()=>{draft[key]=input.value;profileView?.update(normalizeProfile(draft));};}

 for(const [key,group] of Object.entries(GROUPS)){
  const section=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=group.name;section.append(legend);
  for(const id of group.moves){const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='checkbox';input.checked=draft.slots[key].includes(id);span.textContent=EXERCISES.find(e=>e.id===id).name;label.append(input,span);section.append(label);input.onchange=()=>{if(input.checked&&draft.slots[key].length===3){input.checked=false;$('#loadout-status').textContent='אפשר לבחור עד 3 — הסר תרגיל כדי להחליף אותו.';return;}draft.slots[key]=input.checked?[...draft.slots[key],id]:draft.slots[key].filter(x=>x!==id);$('#loadout-status').textContent=draft.slots[key].length+'/3 נבחרו';};}
  $('#loadout-groups').append(section);
 }
 $('#save-loadout').onclick=()=>{draft.name=$('#profile-name').value;draft.nickname=$('#profile-nickname').value;playerProfile=normalizeProfile(draft);world.applyProfile(playerProfile);profileConfirmed=true;refreshHome();if(!writeProfile(profileStorage,playerProfile)){$('#loadout-status').textContent='הדפדפן לא מאפשר שמירה. אפשר להמשיך עם הפרופיל להפעלה הזו.';$('#save-loadout').textContent='המשך בלי שמירה';$('#save-loadout').onclick=()=>{closePanel();if(onDone)onDone();};return;}closePanel();if(onDone)onDone();};const cancelButton=$('#cancel-loadout');if(cancelButton)cancelButton.onclick=closePanel;
}
// מסך היצירה נפתח רק בפעם הראשונה. אחר כך נכנסים ישר עם הפרופיל השמור.
function ensureProfile(next){if(profileConfirmed)next();else editProfile(next);}
// —— מסך הבית ——
// כל המספרים מגיעים מהפרופיל השמור ומ-progress הקיים. אין כאן לוגיקת התקדמות חדשה.
function homeAvatar(){
 const img=$('#home-avatar'),initials=$('#home-initials');
 const label=(playerProfile.nickname||playerProfile.name||'').trim();
 initials.textContent=label?[...label][0]:'☺';
 try{
  const canvas=document.createElement('canvas');
  const view=profilePreview(canvas);view.update(normalizeProfile(playerProfile));
  const url=canvas.toDataURL('image/png');view.dispose?.();
  if(url&&url.length>2000){img.src=url;img.hidden=false;initials.hidden=true;return;}
 }catch{/* אין WebGL פנוי — ראשי תיבות זו נפילה רכה מספקת */}
 img.hidden=true;initials.hidden=false;
}
function refreshHome(){
 if(!$('#home-name'))return;
 $('#home-name').textContent=playerProfile.nickname||playerProfile.name;
 const pct=Math.round(clamp(progress.bestScore/350,0,1)*100);
 $('#home-xp').style.width=pct+'%';
 $('#home-xp-value').textContent=pct+'%';
 $('#card-score').textContent=progress.bestScore;
 $('#card-progress').textContent=Math.min(progress.bestScore,350)+'/350 ליעד';
 $('#card-circle').textContent=progress.rounds?progress.rounds:'—';
 $('#card-circle-note').textContent=progress.rounds?'סיבובים עד היום':'עוד לא שיחקת';
 homeAvatar();
}
function achievements(){
 openPanel('<div class="panel-eyebrow">HALL OF FAME</div><h2 id="panel-title">ההישגים שלך</h2>'+
  '<div class="stat-grid"><div><strong>'+progress.bestScore+'</strong><span>שיא ניקוד</span></div>'+
  '<div><strong>'+progress.bestCombo+'</strong><span>רצף הכי ארוך</span></div>'+
  '<div><strong>'+progress.rounds+'</strong><span>סיבובים</span></div></div>'+
  '<p>'+(progress.completed?'סיימת את שלב 01 — כל הכבוד. ':'')+'ההישגים נשמרים במכשיר הזה בלבד.</p>'+
  '<button id="close-achievements" class="secondary full">סגור</button>');
 $('#close-achievements').onclick=closePanel;
}
$('#achievements-button').onclick=achievements;
$('#home-tab').onclick=()=>{};
$('#profile-button').onclick=()=>editProfile();
 $$('[data-height]').forEach(b=>b.onclick=()=>{game.quickGroup=b.dataset.height;updateQuick();});

function phoneComfort(){
 const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 openPanel('<div class="panel-eyebrow">המשחק במסך שלך</div><h2 id="panel-title">יותר מקום למעגל.</h2><p>המשחק מתאים את עצמו לשטח הפנוי במסך ונועל את גלילת החוף. התפריטים נשארים ניתנים לגלילה.</p>'+(standalone?'<p>המשחק כבר פתוח ממסך הבית.</p>':'<div class="install-note"><b>באייפון</b><p>פתח את הקישור ב־Safari, לחץ על שיתוף ובחר ״הוסף למסך הבית״. בפעם הבאה פתח מהסמל כדי לשחק בלי שורת הכתובת.</p><b>באנדרואיד</b><p>בתפריט Chrome בחר ״התקנת האפליקציה״ או ״הוסף למסך הבית״.</p></div>')+'<p>למשחק לרוחב, בטל את נעילת הסיבוב בטלפון.</p><div class="actions">'+(document.fullscreenEnabled?'<button id="comfort-fullscreen" class="primary">מסך מלא</button>':'')+'<button id="comfort-done" class="secondary">חזרה למשחק</button></div>');
 if($('#comfort-fullscreen'))$('#comfort-fullscreen').onclick=()=>{closePanel();enterLandscape();};$('#comfort-done').onclick=closePanel;
}
$('#phone-button').onclick=phoneComfort;

function journey(){
  openPanel('<div class="panel-eyebrow">YOUR BEACH JOURNEY</div><h2 id="panel-title">המסלול שלך</h2>'+
    '<div class="stat-grid"><div><strong>'+progress.bestScore+'</strong><span>השיא שלך</span></div><div><strong>'+progress.bestCombo+'</strong><span>הרצף הארוך</span></div><div><strong>'+progress.rounds+'</strong><span>סיבובים</span></div></div>'+
    '<div class="journey-step"><strong>01</strong><div><h3>נכנסים לקצב</h3><p>ארבעה במעגל · 20 תנועות · חזה ותרגילי רגליים · תרגול חופשי</p><span class="pill">'+(progress.completed?'הושלם ✓':'זמין למשחק')+'</span></div></div>'+
    '<div class="journey-step"><strong>02</strong><div><h3>המעגל מתרחב</h3><p>תלבושות וכדורים נוספים, מספרת צד</p><span class="pill">בתכנון — עדיין לא פתוח למשחק</span></div></div><p>השיא והשלמת השלב נשמרים במכשיר הזה.</p>');
}
$('#journey-button').onclick=journey;
function musicStatus(){
 const el=$('#song-status');if(!el)return;
 el.textContent=sound.status==='error'?'הקטע לא נטען. אפשר לבחור קטע אחר או גיטרה ספרדית.':sound.status==='blocked'?'גע בניגון כדי להפעיל את הצליל.':(sound.music?'♫ '+sound.nowPlaying:'המוזיקה כבויה');
}
function musicPanel(){
 openPanel('<div class="panel-eyebrow">BEACH RADIO</div><h2 id="panel-title">תן לחוף קצב.</h2><div class="settings-row"><label for="music-toggle">מוזיקה</label><input type="checkbox" id="music-toggle" '+(sound.music?'checked':'')+'></div><div class="settings-row"><label for="effects-toggle">תגובות וצלילי כדור</label><input type="checkbox" id="effects-toggle" '+(sound.effects?'checked':'')+'></div><div class="settings-row"><label for="volume">עוצמת המוזיקה</label><input type="range" id="volume" min="0" max="1" step="0.05" value="'+sound.volume+'"></div><p id="song-status" class="music-label" role="status"></p>'+BEACH_TRACKS.map((t,i)=>'<div class="music-choice"><h3 dir="ltr">'+t.name+' · '+t.artist+'</h3><p>'+t.description+' · '+t.bpm+' BPM</p><button data-track="'+i+'" class="secondary">נגן בחוף</button></div>').join('')+'<p class="setting-note">שני הקטעים מתחלפים אוטומטית במהלך המשחק.</p><div class="music-choice"><h3>Rumba del Mar</h3><p>מנגינת גיטרה בסגנון ספרדי, בס וכלי הקשה · 112 BPM · יצירה מקורית אינסטרומנטלית.</p><button id="beat-choice" class="secondary">נגן גיטרה ספרדית</button></div><div class="music-choice"><h3>הפלייליסט שלך</h3><p>אפשר לבחור גם שיר בספרדית מהמכשיר. הקובץ נשאר אצלך.</p><button id="choose-file" class="secondary">בחר שיר מהמכשיר</button></div><div class="source-links"><span dir="ltr">Mamacita / Vacaciones by Mike Leite</span><br><a href="https://soundcloud.com/mikeleite" target="_blank" rel="noopener">האמן</a> · <a href="https://www.free-stock-music.com/artist.mike-leite.html" target="_blank" rel="noopener">Royalty Free Music by free-stock-music.com</a> · <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a></div>');
 $('#music-toggle').onchange=e=>{sound.setMusic(e.target.checked);if(e.target.checked)sound.start().then(musicStatus);musicStatus();};
 $('#effects-toggle').onchange=e=>sound.setEffects(e.target.checked);$('#volume').oninput=e=>sound.setVolume(Number(e.target.value));
 $$('[data-track]').forEach(b=>b.onclick=()=>{sound.setMusic(true);sound.chooseTrack(Number(b.dataset.track));sound.start().then(musicStatus);$('#music-toggle').checked=true;musicStatus();});
 $('#beat-choice').onclick=()=>{sound.chooseBeat();sound.setMusic(true);sound.start();$('#music-toggle').checked=true;musicStatus();};
 $('#choose-file').onclick=()=>$('#song-file').click();musicStatus();
}
$('#user-song').addEventListener('playing',musicStatus);$('#user-song').addEventListener('error',musicStatus);
$('#music-button').onclick=musicPanel;$('#song-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>80*1024*1024){if($('#song-status'))$('#song-status').textContent='בחרו קובץ קטן מ־80MB.';return;}await sound.start();sound.setMusic(true);try{await sound.chooseFile(file);if($('#song-status'))$('#song-status').textContent=file.name;}catch{if($('#song-status'))$('#song-status').textContent='הפורמט לא נתמך. נסו MP3 או M4A.';}e.target.value='';};

function setPlayScreen(){
  $('#home').hidden=true;$('#hud').hidden=false;$('#pause-button').hidden=false;$('#camera-button').hidden=false;$('#exit-button').hidden=false;
  // יציאה מפורשת ממצב טיול — אחרת הלולאה ממשיכה בענף ה-roam,
  // game.update לא נקרא בכלל, וה-CSS של הטיול מסתיר את פקדי המשחק.
  roaming=false;document.body.classList.remove('roaming');$('#circle-invite').hidden=true;
  document.body.classList.add('playing');$('#speech').hidden=true;$('#floating').classList.remove('show');
  $('#practice-coach').hidden=!game.practice;$('.level-panel').hidden=game.practice;$('#hearts').hidden=game.practice||game.rallyMode;
  world.setPlaying(true);started=true;sound.start();document.body.classList.toggle('in-guide',game.guided);syncLandscape();if(landscapeBlocked)sound.pause();
}
// הבהוב קצר שמכסה את החלפת המצב בין חוף למעגל. לא מסך טעינה —
// המצב מתחלף באמצע, כך שאין קאט חד ואין תחושת טלפורט.
function transition(mid){
 const veil=$('#veil');
 if(!veil||veilBusy){mid();return;}
 veilBusy=true;veil.hidden=false;
 requestAnimationFrame(()=>veil.classList.add('on'));
 setTimeout(()=>{
  try{mid();}finally{
   requestAnimationFrame(()=>{
    veil.classList.remove('on');
    setTimeout(()=>{veil.hidden=true;veilBusy=false;},280);
   });
  }
 },230);
}
// חזרה לחוף ליד המעגל שממנו יצאנו, בלי לגעת בפרופיל או בהעדפות
function exitToBeach(){
 const circle=lastCircle;
 transition(()=>{
  clearInterval(countTimer);countTimer=null;cancelAction();
  paused=false;game.status='idle';game.practice=false;
  const spawn=circle?{x:clamp(circle.x,-29,29),z:clamp(circle.z+(circle.r||2.5)+2.4,-9,25)}:null;
  startRoam(spawn);
 });
}
function startRoam(spawn=null){
 if(!world)return;
 panelWasPlaying=false;closePanel();clearInterval(countTimer);countTimer=null;cancelAction();
 game.practice=false;game.status='idle';paused=false;
 $('#home').hidden=true;$('#hud').hidden=false;$('#pause-button').hidden=false;$('#camera-button').hidden=true;
 $('#countdown').hidden=true;$('#speech').hidden=true;$('#circle-invite').hidden=true;
 document.body.classList.add('playing','roaming');document.body.classList.remove('in-guide','show-demo');
 $('#exit-button').hidden=true;
 roaming=true;world.setRoaming(true,spawn);started=true;sound.start();
 syncLandscape();if(landscapeBlocked)sound.pause();
}
function updateRoamHUD(){
 const near=world.nearbyCircle(),invite=$('#circle-invite'),hint=$('#roam-hint');
 if(near){
  if(invite.dataset.circle!==near.id){invite.dataset.circle=near.id;$('#circle-name').textContent=near.name;$('#circle-desc').textContent=near.desc;}
  invite.hidden=false;if(hint)hint.classList.add('dim');
 }else{invite.hidden=true;invite.dataset.circle='';if(hint)hint.classList.remove('dim');}
 $('#move-assist').textContent='גרור לתנועה';
}
function goHome(){
  panelWasPlaying=false;closePanel();clearInterval(countTimer);countTimer=null;cancelAction();
  paused=false;started=false;roaming=false;game.status='idle';game.practice=false;world.setPlaying(false);
  $('#home').hidden=false;$('#hud').hidden=true;refreshHome();$('#countdown').hidden=true;$('#pause-button').hidden=true;$('#camera-button').hidden=true;$('#exit-button').hidden=true;
  document.body.classList.remove('playing','in-guide','show-demo','roaming');$('#speech').hidden=true;$('#attack-cue').hidden=true;$('#circle-invite').hidden=true;syncLandscape();keys.clear();releaseJoy();sound.pause();
}
function startGame(free=false){
  if(!profileConfirmed){editProfile(()=>startGame(free===true));return;}
  free=free===true;if(matchMedia('(pointer: coarse)').matches&&document.fullscreenEnabled)enterLandscape();
  if(!world)return;panelWasPlaying=false;closePanel();clearInterval(countTimer);game.practice=false;game.reset();game.rallyMode=free;
  setPlayScreen();paused=true;let count=3;const counter=$('#countdown');counter.hidden=false;counter.innerHTML='3<small>נגיעה למסירה. פשוט.</small>';
  countTimer=setInterval(()=>{if($('#panel').open||landscapeBlocked)return;count--;if(count>0)counter.innerHTML=count+'<small>נגיעה למסירה. פשוט.</small>';else{
    clearInterval(countTimer);countTimer=null;counter.hidden=true;game.start();game.player.name=playerProfile.nickname||playerProfile.name;game.rallyMode=free;paused=false;sound.start();coach('נגיעה למסירה · החלק למעלה להרמה');sound.say('¡Vamos a jugar!');
  }},650);
}
function startPractice(id){
  if(!profileConfirmed){editProfile(()=>startPractice(id));return;}
  if(!world||!PRACTICE[id])return;panelWasPlaying=false;closePanel();clearInterval(countTimer);countTimer=null;
  game.reset();game.beginGuide(id);setPlayScreen();paused=false;$('#countdown').hidden=true;
  $('#practice-name').textContent=EXERCISES.find(e=>e.id===id).name;
  $('#practice-instruction').textContent=PRACTICE[id].gesture;$('#practice-tip').textContent=PRACTICE[id].tip;
  coach(PRACTICE[id].gesture);handleEvents();updateGuide();
}
function updateGuide(){
  if(!game.guided){document.body.classList.remove('show-demo');return;}
  const demo=game.phase==='demo',ready=game.phase==='guide-ready',lesson=lessonFor(game.practiceMove);
  document.body.classList.toggle('show-demo',demo);$('#contact-button').dataset.gesture=LESSONS[game.practiceMove].gesture;
  $('#lesson-stage').textContent='תרגיל '+lesson.number+' / '+LESSON_ORDER.length+' · '+(demo?'רואים הדגמה':ready?'עכשיו תורך':'מנסים בלי פסילות');
  $('#lesson-progress').textContent=Math.min(3,game.practiceSuccesses)+' / 3';
  $('#lesson-toggle').textContent=demo?'עכשיו תורי':'ראה שוב הדגמה';$('#lesson-next').hidden=game.practiceSuccesses<3;
  $('#lesson-next').textContent=lesson.number===LESSON_ORDER.length?'חזרה למעגל':'לתרגיל הבא';
  if(demo){$('#practice-instruction').textContent=lesson.steps[Math.floor(game.demoTime/1.8)%3];$('#practice-tip').textContent=PRACTICE[game.practiceMove].gesture;}
  if(ready){$('#practice-instruction').textContent='הכדור מחכה לך. '+PRACTICE[game.practiceMove].gesture;}
}
$('#lesson-toggle').onclick=()=>{cancelAction();keys.clear();releaseJoy();if(game.phase==='demo'){world.yaw=0;game.tryGuide();}else game.showDemo();updateGuide();};
$('#lesson-next').onclick=()=>{const i=LESSON_ORDER.indexOf(game.practiceMove);if(i+1<LESSON_ORDER.length)startPractice(LESSON_ORDER[i+1]);else startGame();};
$('#circle-join').onclick=()=>{
 const near=world.nearbyCircle();
 if(near)lastCircle={id:near.id,name:near.name,x:near.x,z:near.z,r:near.r};
 $('#circle-invite').hidden=true;
 transition(()=>startGame(true));
};
$('#exit-button').onclick=exitToBeach;
$('#play-button').onclick=()=>ensureProfile(()=>startRoam());$('#free-button').onclick=()=>ensureProfile(()=>startGame(true));
$('#camera-button').onclick=()=>{world.toggleView();$('#camera-button').setAttribute('aria-label',world.view==='third'?'מעבר לגוף ראשון':'מעבר למבט מאחור');floating(world.view==='third'?'מבט מאחורי השחקן':'מבט מגוף ראשון');};
function pauseMenu(){
  if(countTimer)return;if($('#panel').open){closePanel();return;}
  openPanel('<div class="panel-eyebrow">TAKE A BREATH</div><h2 id="panel-title">הכדור יכול לחכות.</h2>'+
    '<div class="settings-row"><label for="assist-toggle">עזרה בהגעה לכדור</label><input type="checkbox" id="assist-toggle" '+(game.easy?'checked':'')+'></div>'+
    '<p class="setting-note">אפשר לזוז גם בעצמך. כשהעזרה פעילה, המשחק מקרב אותך ומקל על תזמון המגע.</p>'+
    '<div class="settings-row"><label for="entry-toggle">כיוון לפי הכניסה לכדור</label><input type="checkbox" id="entry-toggle" '+(game.approachAim?'checked':'')+'></div>'+
    '<p class="setting-note">אפשר תמיד לנעול יעד בלחיצה על חבר או על החול.</p>'+
    '<div class="settings-row"><label for="attack-difficulty">עוצמת היריבים</label><select id="attack-difficulty"><option value="relaxed">חוף רגוע</option><option value="hard">הנחתות חזקות</option><option value="expert">תחרותי</option></select></div>'+
    '<div class="settings-row"><label for="graphics-quality">איכות גרפיקה</label><select id="graphics-quality"><option value="auto">אוטומטית</option><option value="high">חדה</option><option value="smooth">חלקה</option></select></div>'+
    '<div class="actions"><button id="pause-moves" class="secondary">לומדים תרגילים</button><button id="pause-music" class="secondary">מוזיקה</button><button id="pause-profile" class="secondary">פרופיל השחקן</button><button id="pause-phone" class="secondary">נוחות בטלפון</button></div>'+
    '<div class="actions"><button id="resume" class="primary">ממשיכים</button>'+(game.practice?'<button id="normal-round" class="secondary">למעגל רגיל</button>':'')+'<button id="exit-game" class="secondary">'+(roaming?'לתפריט הראשי':'יציאה לחוף')+'</button>'+(roaming?'':'<button id="to-menu" class="secondary">לתפריט</button>')+'</div>');
  $('#attack-difficulty').value=game.difficulty;$('#attack-difficulty').onchange=e=>game.difficulty=e.target.value;$('#assist-toggle').onchange=e=>game.easy=e.target.checked;$('#graphics-quality').value=world.quality;$('#graphics-quality').onchange=e=>world.setQuality(e.target.value);
  $('#entry-toggle').onchange=e=>{if(e.target.checked)game.useApproachAim();else game.setAim(game.actors[1],1);};
  $('#pause-profile').onclick=editProfile;$('#pause-phone').onclick=phoneComfort;$('#pause-music').onclick=musicPanel;$('#pause-moves').onclick=moves;
  $('#resume').onclick=closePanel;$('#exit-game').onclick=roaming?goHome:exitToBeach;if($('#to-menu'))$('#to-menu').onclick=goHome;if($('#normal-round'))$('#normal-round').onclick=startGame;
}
$('#pause-button').onclick=pauseMenu;
function endRound(won){
  saveProgress();sound.point();setTimeout(()=>{if(!['won','lost'].includes(game.status))return;
    openPanel('<div class="panel-eyebrow">'+(won?'LEVEL 01 / COMPLETE':'ONE MORE ROUND?')+'</div><h2 id="panel-title">'+(won?'יש לך מקום במעגל.':'עוד סיבוב על החול?')+'</h2>'+
      '<p>'+(won?'הרמות, תרגילים והנחתות — מצאת את הקצב.':'אפשר לתרגל בלי פסילות, או להיכנס שוב למעגל.')+'</p>'+
      '<div class="stat-grid"><div><strong>'+game.score+'</strong><span>נקודות</span></div><div><strong>'+game.bestCombo+'</strong><span>רצף שיא</span></div><div><strong>'+game.trickCount+'</strong><span>תרגילים</span></div></div>'+
      '<div class="actions"><button id="retry" class="primary">עוד סיבוב</button><button id="end-practice" class="secondary">תרגול חופשי</button><button id="back-home" class="secondary">לחוף</button></div>',false);
    $('#retry').onclick=startGame;$('#end-practice').onclick=moves;$('#back-home').onclick=goHome;
  },900);
}
// Touch and R share tap / swipe / hold. Jump is independent, including multi-touch.
const contactButton=$('#contact-button'),smashButton=$('#smash-button');
function capturePointer(element,id){try{element.setPointerCapture(id);}catch{}}
function beginAction(x=0,y=0,id='keyboard',forceSmash=false){
  if(inputBlocked()||!started||game.status!=='playing'||actionPress)return;
  actionPress={x,y,dx:0,dy:0,time:performance.now(),id,forceSmash};(forceSmash?smashButton:contactButton).classList.add('pressed');if(forceSmash)game.beginCharge();
}
function chargeAction(now){
  if(!actionPress||inputBlocked())return;
  const held=(now-actionPress.time)/1000;
  if(actionPress.forceSmash||held>=HOLD_DELAY&&Math.hypot(actionPress.dx,actionPress.dy)<SWIPE_DISTANCE){
    if(!game.smashCharge.active)game.beginCharge();
    if(game.smashCharge.active)game.smashCharge.seconds=held;
  }
}
function finishAction(){
  if(!actionPress||inputBlocked()){cancelAction();return;}
  const a=actionPress,seconds=(performance.now()-a.time)/1000,result=a.forceSmash?{intent:'smash'}:gestureIntent(a.dx,a.dy,seconds);
  if(result.intent==='smash'){
    if(!game.smashCharge.active)game.beginCharge();
    if(game.smashCharge.active){game.smashCharge.seconds=seconds;game.releaseCharge();}
  }else{
    game.cancelCharge();let move=result.move;
    // Training isolates a body motion; the same live-game gesture still applies.
    if(game.practice&&!move&&((result.intent==='set'&&game.practiceMove==='chest')||(result.intent==='pass'&&['foot','knee','head','lunge','scorpion','hip','rabona','side-lunge','around-reverse','foot-stall','head-side','knee-save'].includes(game.practiceMove))))move=game.practiceMove;
    game.playAction(result.intent,move);
  }
  actionPress=null;contactButton.classList.remove('pressed');smashButton.classList.remove('pressed');handleEvents();
}
contactButton.onpointerdown=e=>{if(inputBlocked())return;e.preventDefault();beginAction(e.clientX,e.clientY,e.pointerId);if(actionPress?.id===e.pointerId)capturePointer(contactButton,e.pointerId);};
smashButton.onpointerdown=e=>{if(inputBlocked())return;e.preventDefault();beginAction(e.clientX,e.clientY,e.pointerId,true);if(actionPress?.id===e.pointerId)capturePointer(smashButton,e.pointerId);};
smashButton.onclick=e=>{if(e.detail===0&&!inputBlocked())game.playAction('smash',null,.66,chargeProfile(.8));};
window.addEventListener('pointermove',e=>{
  if(actionPress?.id!==e.pointerId)return;if(e.pointerType==='mouse'&&e.buttons===0){cancelAction();return;}actionPress.dx=e.clientX-actionPress.x;actionPress.dy=e.clientY-actionPress.y;
  if(!actionPress.forceSmash&&Math.hypot(actionPress.dx,actionPress.dy)>=SWIPE_DISTANCE){
    game.cancelCharge();const action=gestureIntent(actionPress.dx,actionPress.dy,0);
    coach(action.move?EXERCISES.find(e=>e.id===action.move).name:'הרמה לחבר');
  }
},true);
window.addEventListener('pointerup',e=>{if(actionPress?.id!==e.pointerId)return;actionPress.dx=e.clientX-actionPress.x;actionPress.dy=e.clientY-actionPress.y;finishAction();},true);
const cancelPointerAction=e=>{if(actionPress?.id===e.pointerId)cancelAction();};
window.addEventListener('pointercancel',cancelPointerAction,true);contactButton.addEventListener('lostpointercapture',cancelPointerAction);smashButton.addEventListener('lostpointercapture',cancelPointerAction);
window.addEventListener('resize',()=>{cancelAction();lookStart=null;});
window.addEventListener('pagehide',()=>{keys.clear();cancelAction();releaseJoy();sound.pause();});
contactButton.onclick=e=>{if(e.detail===0&&!inputBlocked())game.playAction('pass',game.practice?game.practiceMove:null);};
$('#jump-button').onpointerdown=e=>{e.preventDefault();if(!inputBlocked())game.jump();};
$('#jump-button').onclick=e=>{if(e.detail===0&&!inputBlocked())game.jump();};
const joystick=$('#joystick');
joystickControl=attachJoystick(joystick,{knob:$('#joystick-knob'),blocked:()=>!started||inputBlocked(),yaw:()=>game.player.yaw,
  onChange:(vector,active,yaw)=>{joy=vector;joyYaw=yaw;},onStop:()=>game.stopManualMovement()});
$('#world').onpointerdown=e=>{if(!started||inputBlocked())return;capturePointer($('#world'),e.pointerId);lookStart={id:e.pointerId,x:e.clientX,y:e.clientY,total:0};};
$('#world').onpointermove=e=>{if(lookStart?.id!==e.pointerId)return;const dx=e.clientX-lookStart.x,dy=e.clientY-lookStart.y;lookStart.total+=Math.abs(dx)+Math.abs(dy);if(lookStart.total>8)world.look(dx,dy);lookStart.x=e.clientX;lookStart.y=e.clientY;};
$('#world').onpointerup=e=>{if(lookStart?.id!==e.pointerId)return;if(lookStart.total<12){world.aimAt(e.clientX,e.clientY);coach('היעד נבחר · נגיעה למסירה, ↑ להרמה');}lookStart=null;};
$('#world').onpointercancel=()=>lookStart=null;
const manualKeys={Digit1:'foot',Digit2:'knee',Digit3:'head',Digit4:'chest',KeyZ:'inside',KeyC:'outside',KeyT:'around',KeyB:'heel',KeyH:'shoulder',KeyN:'alternate',KeyG:'cross',KeyF:'lunge',KeyU:'scorpion',KeyI:'hip',KeyK:'rabona',KeyJ:'side-lunge',KeyO:'around-reverse',KeyL:'foot-stall',Digit5:'head-side',Digit6:'knee-save'};
const movementKeys=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
window.addEventListener('keydown',e=>{
  if($('#panel').open||!started)return;if(e.code==='Space'&&e.target.closest?.('button'))return;
  if(![...movementKeys,...Object.keys(manualKeys),'KeyR','KeyX','KeyQ','KeyE','KeyV','KeyP','Escape','Space'].includes(e.code))return;
  e.preventDefault();keys.add(e.code);if(e.repeat)return;
  if(['KeyP','Escape'].includes(e.code)){pauseMenu();return;}if(inputBlocked())return;
  if(e.code==='KeyR')beginAction();if(e.code==='KeyX')game.beginCharge();
  if(e.code==='KeyQ')game.playAction('set',game.practiceMove==='chest'&&game.practice?'chest':null);
  if(e.code==='KeyE')game.playAction('pass');if(e.code==='KeyV')$('#camera-button').click();
  if(manualKeys[e.code])game.playAction(['chest','shoulder','hip','scorpion'].includes(manualKeys[e.code])?'set':'pass',manualKeys[e.code]);
  if(e.code==='Space')game.jump();
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(movementKeys.includes(e.code)&&!movementKeys.some(k=>keys.has(k))&&!joystickControl.active)game.stopManualMovement();if(e.code==='KeyR'&&actionPress?.id==='keyboard')finishAction();if(e.code==='KeyX'&&!inputBlocked())game.releaseCharge();});
window.addEventListener('blur',()=>{keys.clear();cancelAction();releaseJoy();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!paused&&game.status==='playing')pauseMenu();});
function handleEvents(){
  for(const e of game.drain()){
    if(e.type==='save')speak(e.actor,e.rescue?'הגעתי לזה!':'הצלתי! ממשיכים!');
    if(e.type==='cover')speak(e.actor,'שלי! אני מגיע!');
    if(e.type==='dive')speak(e.actor,'אני מנסה להציל!');
    if(e.type==='sequenceStart')coach(e.id==='foot-stall'?'מאזנים על הרגל… ואז מרימים':'מקיפים את הכדור — מחכים למגע השני');
    if(e.type==='setForPlayer'){attackUntil=performance.now()+2400;$('#attack-cue').textContent=game.actors[e.actor].name+' מרים לך · קפוץ והחזק הנחתה';$('#attack-cue').hidden=false;coach('הכדור עולה אליך — בחר יעד וקפוץ להנחתה');}
    if(e.type==='incomingAttack'){attackUntil=performance.now()+1800;$('#attack-cue').textContent=game.actors[e.actor].name+' מנחית חזק אליך · נגיעה או זינוק להצלה';$('#attack-cue').hidden=false;coach('נגיעה בכפתור כדי להרים את ההנחתה בחזרה');}
    if(e.type==='playerSave'){floating('איזו הצלה!','הכדור נשאר באוויר · 20+ נקודות','#58e7d4');attackUntil=0;}
    if(e.type==='guideReady'){coach(PRACTICE[e.id].gesture);}
    if(e.type==='swing')world.animate(e.id);
    if(e.type==='hit'){
      world.animate(e.id,e.side,true);sound.hit(e.id==='head');
      floating(e.shot==='set'?(e.id==='chest'?'הרמה בחזה!':'הרמה!'):e.shot==='smash'?(e.accurate?'הנחתה מדויקת!':'הנחתה עם סטייה'):e.shot==='juggle'?(e.id==='alternate'?'ירך ראשונה!':e.id==='foot-stall'?'איזון על הרגל':'הרמה לסיבוב!'):e.perfect?'בול בזמן!':'יופי של מגע','רצף '+game.combo,e.shot==='smash'?'#ffad7a':'#dcfc68');
      if(navigator.vibrate)navigator.vibrate(15);
    }
    if(e.type==='aiHit')sound.hit(e.move==='head');
    if(e.type==='feedback')coach(e.text);
    if(e.type==='queued')coach(e.text+' · התנועה תצא כשהכדור יגיע');
    if(e.type==='trick')coach(e.name+' · 15+ נקודות סגנון');
    if(e.type==='styleCombo')floating('שלוש תנועות. רצף אחד!','30+ נקודות סגנון','#58e7d4');
    if(e.type==='point'){floating('יש נקודה!','הכדור עבר את ההגנה','#ffad7a');sound.point();}
    if(e.type==='setupBonus')floating('יופי של הרמה!','החבר התקיף — היריב הציל','#58e7d4');
    if(e.type==='assist'){floating('איזה בישול!','הרמה שלך, סיום של חבר','#58e7d4');sound.point();}
    if(e.type==='drop'){
      if(e.who===0){floating('הופ… לחול.',game.rallyMode?'מגישים שוב — המעגל ממשיך':'עוד '+Math.max(0,3-game.drops)+' ניסיונות');speak(1+Math.floor(Math.random()*3),TAUNTS[Math.floor(Math.random()*TAUNTS.length)]);}
      else speak(e.who,AI_MISSES[Math.floor(Math.random()*AI_MISSES.length)]);sound.laugh();
    }
    if(e.type==='practiceFeed'){$('#practice-instruction').textContent=PRACTICE[e.id].gesture;coach(PRACTICE[e.id].gesture);}
    if(e.type==='practiceHit'){$('#practice-instruction').textContent=e.success?(game.practiceSuccesses>=3?'שלוש הצלחות! מוכן לתרגיל הבא.':'יפה! בדיוק התנועה. ננסה שוב.'):e.id==='head'&&game.practiceMove==='head'?'קפוץ קודם, ואז גע בכפתור בזמן שאתה באוויר.':'הכדור עלה! עכשיו ננסה את התנועה שבחרת.';}
    if(e.type==='practiceMiss'){coach('הכול טוב. עוד כדור בדרך');$('#practice-instruction').textContent='בלי לחץ — ניקו כבר מגיש שוב';}
    if(e.type==='won')endRound(true);if(e.type==='lost')endRound(false);
  }
}
function updateHUD(now){
  updateGuide();if(now>attackUntil||game.phase!=='flight'||game.receiver!==0)$('#attack-cue').hidden=true;
  const charging=game.smashCharge.active,profile=chargeProfile(game.smashCharge.seconds),pct=Math.round(profile.power*100);
  document.body.classList.toggle('is-charging',charging);smashButton.querySelector('span').textContent=charging?'כוח '+pct+'% · שחרר':game.actionQueue?.intent==='smash'?'מוכן לכדור':'החזק ושחרר';
  $('#jump-button').classList.toggle('airborne',game.player.jumpY>0);$('#jump-button').disabled=inputBlocked()||!!game.player.dive||!!game.sequence||game.player.jumpY>0||game.jumpCooldown>0;
  smashButton.classList.toggle('charging',charging);smashButton.disabled=inputBlocked()||!!game.sequence||!!game.player.dive;
  $('#score').textContent=game.score;$('#combo').textContent=game.combo;
  $('#hearts').textContent='● '.repeat(Math.max(0,3-game.drops))+'○ '.repeat(Math.min(3,game.drops));
  $('#hearts').setAttribute('aria-label',Math.max(0,3-game.drops)+' ניסיונות');
  $('#objective').textContent=game.rallyMode?'מעגל חופשי · בלי פסילות':Math.min(game.score,350)+'/350 נק׳ · '+Math.min(game.smashes,2)+'/2 סיומים';
  $('#level-fill').style.width=(clamp(game.score/350,0,1)*65+clamp(game.smashes/2,0,1)*35)+'%';
  const id=game.guided?game.practiceMove:game.actionQueue?.move||game.selectedMove||game.contactFor('pass'),ready=game.phase==='guide-ready'||game.canHit(id);
  $('#contact-name').textContent=game.phase==='demo'?'ככה עושים':charging?'הנחתה':game.sequence?'בתרגיל':game.player.dive?'מצילים':game.actionQueue?'מוכן!':game.selectedMove?({hip:'צ׳ינגה','side-lunge':'הצלה','around-reverse':'סיבוב הפוך','foot-stall':'איזון','head-side':'נגיחת צד','knee-save':'הצלת ברך'}[game.selectedMove]||EXERCISES.find(e=>e.id===game.selectedMove).name):'מסירה';
  $('#contact-hint').textContent=charging?'שחרר להנחתה':game.phase==='guide-ready'&&id==='head'?'קפיצה ואז נגיעה':ready?({foot:'רגל',knee:'ירך',head:'נגיחה',chest:'חזה',inside:'פנימית',outside:'חיצונית',around:'סיבוב',heel:'עקב',shoulder:'כתף',alternate:'שתי ירכיים',cross:'הצלבה',lunge:'הצלה',scorpion:'סקורפיון',hip:'צ׳ינגה',rabona:'ראבונה','side-lunge':'הצלה צידית','around-reverse':'סיבוב הפוך','foot-stall':'איזון','head-side':'נגיחת צד','knee-save':'הצלת ברך'}[id])+' · עכשיו':'נגיעה';
  const near=world.nearbyCircle(),invite=$('#circle-invite');
  if(near&&!game.practice&&game.phase!=='demo'){
   if(invite.dataset.circle!==near.id){invite.dataset.circle=near.id;$('#circle-name').textContent=near.name;$('#circle-desc').textContent=near.desc;}
   invite.hidden=false;
  }else{invite.hidden=true;invite.dataset.circle='';}
  updateQuick();
  contactButton.classList.toggle('ready',ready&&!charging);contactButton.classList.toggle('charging',charging);
  if(now>coachUntil)$('#touch-coach').textContent=game.practice?PRACTICE[game.practiceMove].gesture:game.receiver===0?'נגיעה למסירה · החזק להנחתה':'בחר חבר · החלק למעלה להרמה';
  const feedback=aimFeedback(game,joystickControl.active?joyYaw:game.player.yaw),guide=$('#joystick-guide');guide.hidden=!charging;guide.classList.toggle('aligned',feedback.aligned);guide.style.setProperty('--guide-angle',Math.atan2(feedback.x,-feedback.z)+'rad');
  $('#move-assist').textContent=charging?(feedback.aligned?'מכוון לרגליים':'כוון לפי הקו הירוק'):game.easy?(game.assisting?'מגיעים לכדור…':game.assistSuppressed?'שחררת — עצרת':'גרור לתנועה'):'גרור לתנועה';
  if(game.aimActor&&!game.approachAim){const a=game.actors[game.aimActor];game.aim.x=a.x;game.aim.z=a.z;}
  $('#aim-label').hidden=game.phase==='demo';$('#aim-label').textContent=game.approachAim?'כיוון לפי הכניסה · גע ליד הרגליים לבחירה':'⌖ '+(game.aimActor?'אל '+game.actors[game.aimActor].name:'אל הנקודה בחול');
  const bpos=world.project(game.ball.position),cue=$('#ball-cue');cue.style.left=bpos.x+'px';cue.style.top=bpos.y+'px';cue.style.opacity=['flight','guide-ready'].includes(game.phase)&&bpos.visible?(game.nearby?'1':'.35'):'0';cue.classList.toggle('ready',ready);
  $('#turn-label').textContent=game.practice?'תרגול חופשי':game.phase==='serve'?'ניקו מגיש':game.phase==='drop'?'אוספים את הכדור':game.receiver===0?'הכדור שלך':game.actors[game.receiver].name+(game.lastShot==='set'?' בדרך להנחתה':' מגיע לכדור');
  $$('[data-actor]').forEach(el=>{const a=game.actors[Number(el.dataset.actor)],pos=world.project({x:a.x,y:2.03,z:a.z});el.hidden=game.phase==='demo'||!pos.visible;el.style.left=pos.x+'px';el.style.top=pos.y+'px';el.classList.toggle('selected',!game.approachAim&&game.aimActor===a.id);});
  if(!$('#speech').hidden){const a=game.actors[speechActor],p=world.project({x:a.x,y:2.6,z:a.z});$('#speech').style.left=clamp(p.x,100,innerWidth-100)+'px';$('#speech').style.top=clamp(p.y,100,innerHeight*.6)+'px';if(now>speechUntil)$('#speech').hidden=true;}
  if(now>floatUntil)$('#floating').classList.remove('show');
}
function loop(now){
  const dt=Math.min((now-lastTime)/1000||.016,.05);lastTime=now;
  if(!paused&&!landscapeBlocked&&started){
    const stableJoy=movementInCamera(joy,joyYaw,game.player.yaw);
    let x=stableJoy.x,z=stableJoy.z;x+=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
    z+=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
    if(roaming){game.move(x,z,keys.has('ShiftLeft')||keys.has('ShiftRight'),joystickControl.active||movementKeys.some(k=>keys.has(k)));updateRoam(game,dt,world.roamBlockers(game.player.x,game.player.z));}
    else{
     if(game.smashCharge.active&&joystickControl.active){nudgeAim(game,joy,joyYaw,dt);game.move(0,0,false,true);}else game.move(x,z,keys.has('ShiftLeft')||keys.has('ShiftRight'),joystickControl.active||movementKeys.some(k=>keys.has(k)));
     game.update(dt*reactionSpeed(game));chargeAction(now);handleEvents();
    }
  }
  world.render(paused||landscapeBlocked?0:dt*reactionSpeed(game));if(started&&frame++%2===0){if(roaming)updateRoamHUD();else updateHUD(now);}requestAnimationFrame(loop);
}
try{
  await loadHuman();world=new World($('#world'),game);world.applyProfile(playerProfile);world.setPlaying(false);refreshHome();$('#load-state').hidden=true;requestAnimationFrame(loop);
}catch(e){console.error(e);$('#load-state').hidden=false;$('#load-state').classList.add('bad-news');$('#load-state').textContent='לא הצלחנו לפתוח תלת־ממד. נסה Safari או Chrome מעודכן.';$('#play-button').disabled=true;$('#moves-button').disabled=true;}
