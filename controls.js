// A single gesture surface. Kept independent from the DOM for touch/keyboard parity.
export const HOLD_DELAY = .22;
export const SWIPE_DISTANCE = 26;
export function gestureIntent(dx, dy, seconds) {
  if (Math.hypot(dx, dy) >= SWIPE_DISTANCE) {
    if(Math.min(Math.abs(dx),Math.abs(dy))/Math.max(Math.abs(dx),Math.abs(dy))>.60){
      const move=dy<0?(dx<0?'shoulder':'alternate'):(dx<0?'heel':'cross');
      return {intent:move==='shoulder'?'set':'pass',move};
    }
    if (Math.abs(dy) > Math.abs(dx)) return dy < 0 ? {intent:'set'} : {intent:'pass', move:'around'};
    return {intent:'pass', move:dx < 0 ? 'inside' : 'outside'};
  }
  return {intent:seconds >= HOLD_DELAY ? 'smash' : 'pass'};
}
export const SPECIAL_MOVES=['scorpion','hip','rabona','side-lunge'];
export const PRACTICE = {
  'around-reverse':{gesture:'בחר מסביב לעולם הפוך וגע בכדור נמוך',key:'O',tip:'הרגל מקיפה את הכדור מעגל מלא בכיוון ההפוך. הישאר מתחתיו עד למגע השני.'},
  'foot-stall':{gesture:'בחר עצירה על כף הרגל וגע כשהכדור יורד',key:'L',tip:'הרגל מרככת את הירידה, מאזנת רגע ומרימה לחבר. הישאר יציב בזמן האיזון.'},
  'head-side':{gesture:'בחר נגיחת צד וגע כשהכדור בגובה הראש',key:'5',tip:'בחר יעד בצד. הראש והגו מסתובבים יחד אל המגע. לכדור גבוה יותר אפשר לקפוץ.'},
  'knee-save':{gesture:'בחר הצלת ברך וגע כשהכדור מתרחק נמוך',key:'6',tip:'זינוק קצר, ברך התמיכה יורדת אל החול והרגל השנייה נשלחת לכדור. לוקח רגע לקום מחדש.'},
  scorpion:{gesture:'בחר סקורפיון וגע לפני שהכדור עובר מעליך',key:'U',tip:'תן לכדור לעבור מעל הכתף. הגוף נוטה קדימה והעקב עולה מאחור — בלי להסתובב לכדור.'},
  hip:{gesture:'בחר צ׳ינגה וגע כשהכדור ליד המותן',key:'I',tip:'האגן פונה לצד הכדור. דחיפה קצרה מהצד ולמעלה מרימה לחבר שבחרת.'},
  rabona:{gesture:'בחר ראבונה וגע כשהכדור נמוך',key:'K',tip:'רגל אחת נשארת על החול. השנייה מצטלבת מאחור ופוגשת את הכדור בצד השני.'},
  'side-lunge':{gesture:'בחר הצלה צידית, זוז לכדור וגע',key:'J',tip:'צעד לצד, כיפוף ברגל התמיכה ושליחת הרגל מתחת לכדור. ממשיכים את המעגל.'},
  foot:{gesture:'נגיעה כשהכדור נמוך',key:'1',tip:'תן לכדור לרדת. כף הרגל עולה מתחתיו.'},
  knee:{gesture:'נגיעה בגובה הירך',key:'2',tip:'הירך עולה והברך כפופה. המגע בחלק העליון של הירך.'},
  head:{gesture:'קפיצה ואז נגיעה',key:'3',tip:'הכדור גבוה? קפוץ ופגוש אותו עם המצח.'},
  chest:{gesture:'החלק למעלה כשהכדור מול החזה',key:'4',tip:'נכנסים מתחת לכדור, פותחים חזה ומיישרים ברכיים לכיוון החבר.'},
  inside:{gesture:'החלק שמאלה על הכפתור',key:'Z',tip:'הכדור נמוך. סובב את הירך ופגוש אותו בפנים כף הרגל.'},
  outside:{gesture:'החלק ימינה על הכפתור',key:'C',tip:'הכדור נמוך. הסט את הרגל ופגוש אותו בחלק החיצוני.'},
  around:{gesture:'החלק למטה על הכפתור',key:'T',tip:'מקפיצים, מקיפים את הכדור מעגל מלא ונוגעים שוב. הישאר מתחת לכדור עד שהמסירה יוצאת.'},
  heel:{gesture:'החלק באלכסון שמאלה ולמטה ↙',key:'B',tip:'כשהכדור נמוך, מסתובבים ומכופפים את הברך. העקב עולה מאחורי הגוף.'},
  shoulder:{gesture:'החלק באלכסון שמאלה ולמעלה ↖',key:'H',tip:'הכדור לצד הצוואר. מרימים כתף ומטים את הגו להרמה לחבר.'},
  alternate:{gesture:'החלק באלכסון ימינה ולמעלה ↗',key:'N',tip:'שתי נגיעות ירך רצופות: הראשונה מעלה לעצמך, השנייה מוסרת לחבר. הישאר מתחת לכדור.'},
  cross:{gesture:'החלק באלכסון ימינה ולמטה ↘',key:'G',tip:'הרגל עוברת לפני רגל התמיכה. פנים כף הרגל מרים את הכדור הנמוך.'},
  lunge:{gesture:'נגיעה כשהכדור נמוך וקצת רחוק',key:'F',tip:'צעד ארוך ושליחת הרגל מצילים כדור נמוך. המשחק בוחר הצלה כשצריך להגיע רחוק יותר.'}
};
