import {availableTricks} from './context-tricks.js';
export const GROUPS={low:{name:'נמוך · רגליים',moves:['around','around-reverse','foot-stall','inside','outside','rabona','heel','cross','side-lunge','lunge','knee-save','foot']},middle:{name:'אמצע · מותן וחזה',moves:['hip','chest','knee','alternate','shoulder']},high:{name:'גבוה · ראש ומעל הגוף',moves:['head','head-side','scorpion']}};
export const DEFAULT_PROFILE={name:'השחקן שלי',nickname:'',style:'male',skin:'#fff9ef',outfit:'shorts',outfitColor:'#ee7853',ball:'classic',slots:{low:['around','inside','foot-stall'],middle:['hip','chest','knee'],high:['head','head-side','scorpion']}};
export function normalizeProfile(value){
 const profile={nickname:typeof value?.nickname==='string'?value.nickname.trim().slice(0,24):'',style:value?.style==='female'?'female':'male',skin:/^#[0-9a-f]{6}$/i.test(value?.skin)?value.skin:'#fff9ef',outfit:value?.outfit==='tank'?'tank':'shorts',outfitColor:/^#[0-9a-f]{6}$/i.test(value?.outfitColor)?value.outfitColor:'#ee7853',ball:['classic','tide','sunset'].includes(value?.ball)?value.ball:'classic',name:typeof value?.name==='string'?value.name.trim().slice(0,24)||'השחקן שלי':'השחקן שלי',slots:{}};
 for(const [key,group] of Object.entries(GROUPS))profile.slots[key]=Array.isArray(value?.slots?.[key])?[...new Set(value.slots[key].filter(x=>group.moves.includes(x)))].slice(0,3):[...DEFAULT_PROFILE.slots[key]];
 return profile;
}
// —— התמדת הפרופיל ——
// כל הקריאה והכתיבה עוברות דרך כאן. הרשומה השמורה מחולקת לקטגוריות
// (appearance / clothing / ball) כדי שיהיה אפשר להעביר אותה לשרת בהמשך
// בלי לגעת בשאר הקוד. הפורמט הישן נקרא ומומר אוטומטית בשמירה הראשונה.
const STORAGE_KEY='atlanta-profile-v1';
const LEGACY_KEY='atlanta-loadout-v1';
export const PROFILE_VERSION=1;

function readRecord(storage){
 if(!storage)return null;
 try{
  const current=storage.getItem(STORAGE_KEY);
  if(current)return JSON.parse(current);
  const legacy=storage.getItem(LEGACY_KEY);
  if(legacy)return JSON.parse(legacy);
 }catch{/* אחסון חסום או JSON פגום — מתייחסים כאילו אין פרופיל */}
 return null;
}
// רשומה שמורה -> הצורה השטוחה שהמשחק והאווטאר עובדים איתה
function fromRecord(record){
 if(!record||typeof record!=='object')return null;
 if(record.version>=1&&record.appearance)return normalizeProfile({
  name:record.playerName,nickname:record.nickname,
  style:record.appearance.style,skin:record.appearance.skin,
  outfit:record.clothing?.outfit,outfitColor:record.clothing?.color,
  ball:record.ball,slots:record.slots});
 return normalizeProfile(record);          // הפורמט הישן
}
// הצורה השטוחה -> הרשומה השמורה. createdAt נשמר מהרשומה הקודמת.
function toRecord(profile,previous){
 const now=new Date().toISOString();
 return {
  version:PROFILE_VERSION,
  playerName:profile.name,
  nickname:profile.nickname,
  appearance:{style:profile.style,skin:profile.skin},
  clothing:{outfit:profile.outfit,color:profile.outfitColor},
  ball:profile.ball,
  slots:profile.slots,
  createdAt:previous?.createdAt||now,
  updatedAt:now
 };
}
// האם כבר קיים פרופיל שמור — זה מה שמבדיל שחקן חוזר משחקן חדש
export function hasProfile(storage){return !!readRecord(storage);}
export function readProfile(storage){return fromRecord(readRecord(storage))||normalizeProfile(null);}
export function writeProfile(storage,profile){
 if(!storage)return false;
 try{
  const previous=readRecord(storage);
  storage.setItem(STORAGE_KEY,JSON.stringify(toRecord(normalizeProfile(profile),previous)));
  return true;
 }catch{return false;}
}
export function heightGroup(game){const y=game.ball.position.y-game.player.jumpY;return y<.84?'low':y<1.60?'middle':'high';}
export function quickChoices(game,profile){
 const now=availableTricks(game),group=game.guided?Object.keys(GROUPS).find(k=>GROUPS[k].moves.includes(game.practiceMove))||'low':game.quickGroup||'low';
 const ids=game.guided?[game.practiceMove]:profile.slots[group];
 const canPrepare=game.status==='playing'&&['flight','serve','guide-ready'].includes(game.phase)&&!game.sequence&&!game.player.dive;
 return {group,slots:ids.map(id=>({id,ready:now.includes(id),soon:canPrepare,prepared:game.preparedMove===id}))};
}
export function chooseQuick(game,profile,id){
 const choice=quickChoices(game,profile).slots.find(x=>x.id===id);if(!choice||!choice.soon)return false;
 if(game.preparedMove===id){game.preparedMove=null;return true;}
 game.selectMove(null);game.actionQueue=null;game.buffer=null;game.cancelCharge();
 if(choice.ready)return game.playAction(['hip','chest','foot-stall'].includes(id)?'set':'pass',id);
 game.preparedMove=id;if(id==='scorpion')game.player.scorpionYaw=game.player.yaw+Math.PI;return true;
}
