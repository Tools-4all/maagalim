// Data, not UI code: new exercises and levels can be added here.
export const EXERCISES = [
 {id:'foot',name:'הרמת כף רגל',body:'קרסול, ירך ורגל',movement:'כיפוף קל של הברך והרמת כף הרגל מתחת לכדור; מגע עם גב כף הרגל.',input:'נגיעה בכפתור כשהכדור נמוך / 1',level:1,height:.68,kind:'sport'},
 {id:'knee',name:'הרמת ברך',body:'ירך וליבה',movement:'העלאת הירך עד קרוב למצב אופקי; מרכז הירך מרים את הכדור.',input:'נגיעה בכפתור בגובה הירך / 2',level:1,height:1.12,kind:'sport'},
 {id:'head',name:'נגיחה בקפיצה',body:'רגליים, ליבה וראש',movement:'כיפוף ברכיים וקפיצה קטנה, ייצוב הצוואר ומגע עם המצח.',input:'קפיצה ונגיעה בכפתור / 3',level:1,height:1.98,kind:'sport'},
 {id:'inside',input:'החלקה שמאלה על כפתור הפעולה / Z',name:'מסירה פנימית',body:'ירך וכף רגל',movement:'סיבוב הירך החוצה והרמת הצד הפנימי של כף הרגל אל הכדור.',level:1,kind:'sport'},
 {id:'outside',input:'החלקה ימינה על כפתור הפעולה / C',name:'מסירה חיצונית',body:'ירך וקרסול',movement:'הסטת הרגל הצידה והטיית כף הרגל; מגע בחלק החיצוני.',level:1,kind:'sport'},
 {id:'chest',input:'החלקה למעלה כשהכדור מול החזה / 4',name:'הרמה בחזה',body:'חזה וליבה',movement:'כניסה מתחת לכדור, כיפוף הברכיים, פתיחת החזה ויישור הרגליים להרמה כלפי מעלה ולכיוון החבר.',level:1,kind:'sport'},
 {id:'heel',name:'הקפצת עקב',body:'ירך אחורית וברך',movement:'כיפוף הברך מאחורי הגוף והרמת העקב לפגיעה בכדור.',level:1,input:'החלקה שמאלה ולמטה / B',height:0.62,kind:'sport'},
 {id:'shoulder',name:'מסירת כתף',body:'כתף וגו',movement:'התרוממות קצרה של הכתף תוך הטיית הגוף אל הכדור.',level:1,input:'החלקה שמאלה ולמעלה / H',height:1.62,kind:'sport'},
 {id:'alternate',name:'ברכיים לסירוגין',body:'שתי ירכיים וליבה',movement:'שתי הרמות ברך רצופות עם העברת משקל בין הרגליים.',level:1,input:'החלקה ימינה ולמעלה / N',height:1.12,kind:'sport'},
 {id:'lunge',name:'הצלה במכרע קדמי',body:'רגליים וליבה',movement:'צעד קדימה וכפיפת ברך לתמיכה, והרמת כף הרגל להצלת כדור נמוך.',level:1,input:'נגיעה בכדור נמוך ורחוק / F',height:0.56,kind:'sport'},
 {id:'side-lunge',name:'הצלה צידית',body:'ירך ורגל',movement:'העברת משקל לרגל התמיכה ושליחת הרגל השנייה הצידה מתחת לכדור.',level:1,input:'בחר תרגיל ואז נגיעה / J',height:.52,kind:'sport'},
 {id:'scorpion',name:'סקורפיון',body:'גב, ירך אחורית ועקב',movement:'נותנים לכדור לעבור מעל הגוף, נוטים קדימה ומכופפים את הברך כך שהעקב עולה מאחור ומרים את הכדור.',level:1,input:'בחר סקורפיון ואז נגיעה לפני שהכדור עובר מעליך / U',height:1.32,kind:'sport'},
 {id:'hip',name:'צ׳ינגה · הרמה במותן',body:'מותן, אגן וליבה',movement:'מפנים את צד הגוף לכדור, מכופפים מעט את רגל התמיכה ודוחפים את המותן הצידה ולמעלה להרמה.',level:1,input:'בחר צ׳ינגה ואז נגיעה / I',height:1.02,kind:'sport'},
 {id:'rabona',name:'ראבונה',body:'ירך וכף רגל',movement:'הרגל הבועטת עוברת מאחורי רגל התמיכה, וגב כף הרגל מרים את הכדור לצד השני.',level:1,input:'בחר ראבונה ואז נגיעה / K',height:.48,kind:'sport'},
 {id:'cross',name:'הקפצה בהצלבה',body:'ירך, קרסול וליבה',movement:'העברת רגל אחת לפני השנייה והרמת פנים כף הרגל אל הכדור.',level:1,input:'החלקה ימינה ולמטה / G',height:0.62,kind:'sport'},
 {id:'around',input:'החלקה למטה על הכפתור כשהכדור נמוך / T',name:'מסביב לעולם',body:'ירך וקרסול',movement:'הקפצה, סיבוב כף הרגל סביב הכדור, וחזרה לעמדת מגע נוספת.',level:1,kind:'sport'},
 {id:'around-reverse',name:'מסביב לעולם הפוך',body:'ירך, ברך וקרסול',movement:'הרמה עצמית, מעגל מלא עם כף הרגל בכיוון ההפוך סביב הכדור, ומגע נוסף למסירה.',level:1,input:'בחר תרגיל ואז נגיעה / O',height:.58,kind:'sport'},
 {id:'foot-stall',name:'עצירה על כף הרגל',body:'כף רגל, ברך וליבה',movement:'ריכוך נחיתת הכדור על גב כף הרגל, איזון קצר והרמה מחדש לחבר.',level:1,input:'בחר תרגיל ואז נגיעה / L',height:.58,kind:'sport'},
 {id:'head-side',name:'נגיחת צד',body:'ראש, צוואר וליבה',movement:'הטיה וסיבוב של הגו והראש לפגישה עם הכדור ושליחתו הצידה.',level:1,input:'בחר תרגיל ואז נגיעה / 5',height:1.89,kind:'sport'},
 {id:'knee-save',name:'זינוק להצלה על הברך',body:'רגל תמיכה, ירך וליבה',movement:'צעד זינוק, ירידה על ברך אחת ושליחת כף הרגל השנייה מתחת לכדור, ואחר כך חזרה לעמידה.',level:1,input:'בחר הצלת ברך וגע בכדור נמוך / 6',height:.40,kind:'sport'},
 {id:'scissor',name:'מספרת צד',body:'רגליים וליבה',movement:'הטיית הגו והנפת רגל אחת בזמן שהשנייה מאזנת; מגע בגב כף הרגל.',level:5,kind:'sport'},
 {id:'split-head',name:'נגיחה בקפיצת פישוק',body:'רגליים, ליבה וראש',movement:'קפיצה עם פתיחת רגליים לייצוב, ונגיחה קדימה עם המצח.',level:5,kind:'fitness'},
 {id:'squat-volley',name:'סקוואט והרמת אמות',body:'רגליים, ליבה ואמות',movement:'ירידה בסקוואט ועלייה עם אמות מחוברות מתחת לכדור.',level:6,kind:'fitness'},
 {id:'core-palm',name:'סיבוב גו ודחיפת כף יד',body:'ליבה, כתף וכף יד',movement:'סיבוב אגן וגו יחד עם דחיפת כף יד מכוונת קדימה.',level:6,kind:'fitness'},
 {id:'jack-block',name:'קפיצת פישוק וחסימה',body:'רגליים, כתפיים וידיים',movement:'קפיצת פישוק עם הרמת שתי הידיים למגע בכדור גבוה.',level:6,kind:'fitness'}
];
export const BALLS=[{id:'classic',name:'חוף קלאסי',radius:.115,mass:.43,gravity:9.81,restitution:.45,color:'#f9ce3b',level:1},{id:'tide',name:'גל טורקיז',radius:.112,mass:.40,gravity:9.81,restitution:.55,speed:1.12,level:2},{id:'sunset',name:'שקיעה',radius:.118,mass:.46,gravity:9.81,restitution:.36,speed:.93,level:3}];
export const OUTFITS=[{id:'coral',name:'בגד ים אלמוג',color:'#ee7853',level:1},{id:'aqua',name:'גופיית טורקיז',color:'#45c9c2',level:2},{id:'night',name:'סט לילה',color:'#132d48',level:3}];
export const LEVELS=[
 {id:1,name:'נכנסים לקצב',score:350,smashes:2,lives:3,exercises:['foot','knee','head','chest','inside','outside','around','heel','shoulder','alternate','cross','lunge','scorpion','hip','side-lunge','rabona','around-reverse','foot-stall','head-side','knee-save'],ball:'classic',outfit:'coral',opponents:[{id:'nico',name:'ניקו',style:'male',x:0,z:-3.3,color:0xe57b4f,skin:0xbc815e},{id:'luna',name:'לונה',style:'female',x:-3,z:0,color:0x38abae,skin:0xc49374},{id:'rafa',name:'רפא',style:'male',x:3,z:0,color:0x375e87,skin:0x79513d}],implemented:true},
 {id:2,name:'המעגל מתרחב',ball:'tide',outfit:'aqua',exercises:['foot','knee','head','inside','outside','chest'],implemented:false},
 {id:3,name:'שעת הזהב',ball:'sunset',outfit:'night',exercises:['heel','shoulder','alternate'],implemented:false}
];
export const TAUNTS=['אחי, החול לא במעגל 😂','הכדור רצה להשתזף?','זה ים, לא באולינג!','עוד פעם אחת, אני מאמין בך!'];
export const AI_MISSES=['טוב, הייתה רוח. ברור.','אף אחד לא ראה את זה, כן?','רגע, היה לי חול בעין!'];
