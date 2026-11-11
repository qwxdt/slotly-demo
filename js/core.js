/* Slotly demo — CORE. Дані, сховище (localStorage), розрахунки, мутації, роутер, UI-хелпери.
   Модулі (mod/*.js) НЕ пишуть у App.db напряму — тільки через App.ops.* (щоб був журнал і перерахунок).
   Без залежностей, працює з file://. */
(function(){
'use strict';
var App=window.App={};
var NB='\u00A0';
var KEY='slotly-demo-v1';

/* ───────── утиліти ───────── */
var U=App.u={};
U.$=function(s,r){return (r||document).querySelector(s)};
U.$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
U.esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
U.fmt=function(n){n=Math.round(+n||0);var s=String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g,NB);return (n<0?'−':'')+s};
U.uah=function(n){return U.fmt(n)+NB+'₴'};
U.pct=function(n){return (Math.round(n*10)/10).toString().replace('.',',')+'%'};
U.hm=function(m){m=Math.round(m);var h=Math.floor(m/60),mm=m%60;return h+':'+(mm<10?'0':'')+mm};
U.pm=function(s){var a=String(s).split(':');return (+a[0])*60+(+a[1]||0)};
U.dur=function(m){var h=Math.floor(m/60),r=m%60;return (h?h+NB+'год':'')+(h&&r?' ':'')+(r?r+NB+'хв':'')||'0 хв'};
U.uid=function(p){return (p||'x')+Date.now().toString(36)+Math.random().toString(36).slice(2,6)};
U.ini=function(n){var p=String(n).trim().split(/\s+/);return ((p[0]||'')[0]||'').toUpperCase()+((p[1]||'')[0]||'').toUpperCase()};
U.short=function(n){var p=String(n).trim().split(/\s+/);return p[0]+(p[1]?' '+p[1][0]+'.':'')};
U.color=function(id){var h=0;id=String(id);for(var i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))>>>0;return h%8};
U.phone=function(p){var d=String(p||'').replace(/\D/g,'');if(d.length===12)return '+'+d.slice(0,2)+' '+d.slice(2,5)+' '+d.slice(5,8)+' '+d.slice(8,10)+' '+d.slice(10);return p||''};
U.plural=function(n,a,b,c){n=Math.abs(n)%100;var n1=n%10;if(n>10&&n<20)return c;if(n1>1&&n1<5)return b;if(n1===1)return a;return c};
U.debounce=function(f,ms){var t;return function(){var a=arguments,s=this;clearTimeout(t);t=setTimeout(function(){f.apply(s,a)},ms||150)}};
U.sum=function(arr,f){var s=0;for(var i=0;i<arr.length;i++)s+=f?f(arr[i]):arr[i];return s};
U.groupBy=function(arr,f){var o={};arr.forEach(function(x){var k=f(x);(o[k]=o[k]||[]).push(x)});return o};
U.download=function(name,text,type){var b=new Blob([text],{type:type||'text/plain;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)};
U.csv=function(rows){return '\uFEFF'+rows.map(function(r){return r.map(function(v){v=String(v==null?'':v);return /[",;\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(';')}).join('\n')};

/* ───────── дати (локальні, рядок YYYY-MM-DD) ───────── */
var D=App.d={};
D.MON=['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
D.MONS=['січ','лют','бер','квіт','трав','черв','лип','серп','вер','жовт','лист','груд'];
D.MONN=['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
D.WD=['Неділя','Понеділок','Вівторок','Середа','Четвер','Пʼятниця','Субота'];
D.WDS=['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];
D.iso=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
D.parse=function(s){var a=s.split('-');return new Date(+a[0],+a[1]-1,+a[2])};
D.add=function(s,n){var d=D.parse(s);d.setDate(d.getDate()+n);return D.iso(d)};
D.diff=function(a,b){return Math.round((D.parse(b)-D.parse(a))/864e5)};
D.wd=function(s){return D.parse(s).getDay()};
D.wd1=function(s){return (D.parse(s).getDay()+6)%7}; /* 0 = пн */
D.weekStart=function(s){return D.add(s,-D.wd1(s))};
D.monthStart=function(s){return s.slice(0,8)+'01'};
D.monthEnd=function(s){var d=D.parse(D.monthStart(s));d.setMonth(d.getMonth()+1);d.setDate(0);return D.iso(d)};
D.addMonths=function(s,n){var d=D.parse(D.monthStart(s));d.setMonth(d.getMonth()+n);return D.iso(d)};
D.human=function(s,o){o=o||{};var d=D.parse(s);var t=d.getDate()+' '+D.MON[d.getMonth()];if(o.year||d.getFullYear()!==D.parse(App.today()).getFullYear())t+=' '+d.getFullYear();if(o.wd)t=D.WD[d.getDay()]+', '+t;return t};
D.shortH=function(s){var d=D.parse(s);return d.getDate()+' '+D.MONS[d.getMonth()]};
D.rel=function(s){var n=D.diff(App.today(),s);if(n===0)return 'сьогодні';if(n===1)return 'завтра';if(n===-1)return 'вчора';if(n===2)return 'післязавтра';if(n<0&&n>-7)return Math.abs(n)+' '+U.plural(-n,'день','дні','днів')+' тому';return D.shortH(s)};
D.range=function(a,b){var r=[];for(var s=a;s<=b;s=D.add(s,1))r.push(s);return r};
D.nowMin=function(){var n=new Date();return n.getHours()*60+n.getMinutes()};
App.today=function(){return D.iso(new Date())};

/* ───────── іконки (SVG-спрайт, lucide-подібні) ───────── */
var ICONS={
 cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
 home:'<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
 wallet:'<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
 coins:'<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/>',
 chart:'<path d="M3 3v18h18"/><path d="M7 16V11M12 16V7M17 16v-3"/>',
 scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>',
 team:'<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M19 8v6M22 11h-6"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
 gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
 ticket:'<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
 box:'<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
 check:'<path d="M20 6 9 17l-5-5"/>',
 checks:'<path d="M18 6 7 17l-5-5M22 10l-7.5 7.5L13 16"/>',
 task:'<rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
 star:'<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
 log:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
 cog:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 minus:'<path d="M5 12h14"/>',
 x:'<path d="M18 6 6 18M6 6l12 12"/>',
 left:'<path d="m15 18-6-6 6-6"/>',
 right:'<path d="m9 18 6-6-6-6"/>',
 down:'<path d="m6 9 6 6 6-6"/>',
 up:'<path d="m18 15-6-6-6 6"/>',
 more:'<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
 morev:'<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
 clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
 phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
 tg:'<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
 msg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
 cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
 card:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
 bank:'<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l9 5H3z"/>',
 receipt:'<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M16 8H8M16 12H8M13 16H8"/>',
 safe:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M12 9V7M12 17v-2M15 12h2M7 12h2"/>',
 trend:'<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
 trendd:'<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
 alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
 wifioff:'<path d="M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20"/>',
 siren:'<path d="M7 18v-6a5 5 0 1 1 10 0v6M5 21a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1zM21 12h1M18.5 4.5 18 5M2 12h1M12 2v1M4.93 4.93l.71.71"/>',
 bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
 edit:'<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
 trash:'<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
 copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
 repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
 move:'<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
 download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
 upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
 print:'<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
 filter:'<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
 sort:'<path d="m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16"/>',
 tag:'<path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l8.59-8.59a1 1 0 0 0 0-1.41z"/><path d="M7 7h.01"/>',
 heart:'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>',
 cake:'<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01"/>',
 ban:'<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
 lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
 shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
 spark:'<path d="M9.94 14.06 4 20M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"/>',
 layers:'<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
 door:'<path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01M13 4.56v16.88a.5.5 0 0 1-.68.47L5 19V5.27a2 2 0 0 1 1.52-1.94l5.86-1.47a.5.5 0 0 1 .62.49z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
 coffee:'<path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v2M10 2v2M14 2v2"/>',
 eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
 link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
 percent:'<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
 undo:'<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 note:'<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5z"/><path d="M15 3v6h6"/>',
 zap:'<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
 globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10"/>',
 key:'<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
 merge:'<path d="m8 6 4-4 4 4M12 2v10.3a4 4 0 0 1-1.17 2.87L4 22M20 22l-5-5"/>',
 history:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
 block:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
 hand:'<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
 drop:'<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7"/>'
};
App.icon=function(n,c){return '<svg class="i '+(c||'')+'" aria-hidden="true"><use href="#i-'+n+'"/></svg>'};
App.iconNames=Object.keys(ICONS);
function mountSprite(){
  var s='<svg xmlns="http://www.w3.org/2000/svg" style="display:none">';
  for(var k in ICONS)s+='<symbol id="i-'+k+'" viewBox="0 0 24 24">'+ICONS[k]+'</symbol>';
  var d=document.createElement('div');d.innerHTML=s+'</svg>';document.body.prepend(d.firstChild);
}

/* ───────── довідники статусів / способів ───────── */
App.ST={
 new:{n:'Нова',hint:'не підтверджена'},
 confirmed:{n:'Підтверджена'},
 arrived:{n:'Прийшов(ла)'},
 done:{n:'Завершена'},
 noshow:{n:'Не прийшов(ла)'},
 cancelled:{n:'Скасована'}
};
App.SRC={admin:'Адміністратор',online:'Онлайн-запис',phone:'Дзвінок',tg:'Telegram',ig:'Instagram',walkin:'Без запису'};
App.ROLES={owner:{n:'Власник'},admin:{n:'Адміністратор'},master:{n:'Майстер'},accountant:{n:'Бухгалтер'}};
/* права: module.action */
App.PERMS={
 owner:'*',
 admin:['home','calendar.*','clients.*','checkout','cash.view','cash.ops','expenses.add','certs.*','abons.*','products.sell','products.view','tasks.*','reviews.*','schedules.*','services.view','team.view','reports.day'],
 master:['home','calendar.own','clients.own','payroll.own','schedules.own','tasks.own'],
 accountant:['home','cash.view','expenses.*','payroll.*','reports.*','certs.view','abons.view','products.view','audit.view']
};
App.can=function(p,role){
  role=role||App.me().role;var a=App.PERMS[role];if(a==='*')return true;
  if(a.indexOf(p)>=0)return true;var mod=p.split('.')[0];return a.indexOf(mod+'.*')>=0;
};

/* ───────── генерація демо-даних ───────── */
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function seed(){
  var R=rng(20261110), pick=function(a){return a[Math.floor(R()*a.length)]}, chance=function(p){return R()<p};
  var T=App.today();
  var db={v:1,seededAt:T,
   salon:{name:'Sola Beauty',type:'salon',city:'Умань',addr:'вул. Соборна, 14',phone:'+380 67 214 55 90',tg:'@sola_beauty_uman',ig:'sola.beauty.uman',site:'sola.slotly.ua',
     hours:{1:[540,1200],2:[540,1200],3:[540,1200],4:[540,1200],5:[540,1200],6:[600,1080],0:null},
     currency:'UAH',tz:'Europe/Kyiv',logo:'SB'},
   settings:{
     modules:{certs:true,abons:true,products:true,tasks:true,reviews:true,resources:false,deposits:true,waitlist:true},
     pricing:'byLevel',                /* single | byLevel | byMaster */
     booking:{step:15,minNotice:60,maxDays:60,cancelHours:12,buffer:0,allowAny:true,confirmMode:'auto',needPhone:false},
     deposit:{on:true,mode:'new',pct:30,minPrice:1000,refundHours:24},
     reminders:{h24:true,h2:true,afterVisit:true,returnDays:28,channel:'tg'},
     noshow:{markAfter:15,warnAt:2,blockAt:3},
     accounting:{certRevenue:'redeem',tipsToMaster:100,cardFeePct:1.3,cashRegister:false,dayClose:true,roundTo:0},
     payroll:{period:'half',basis:'afterDiscount',certAsRevenue:true,productPctDefault:10},
     alert:{on:false,mode:'pause',region:'Черкаська область'},
     offline:false,
     export:{last:null}
   },
   levels:[{id:'top',n:'Топ-майстер',pct:40,k:1.2},{id:'mid',n:'Майстер',pct:35,k:1},{id:'jr',n:'Молодший майстер',pct:30,k:.85}],
   pay:[{id:'cash',n:'Готівка',ic:'cash',kind:'cash',on:true},{id:'card',n:'Картка (термінал)',ic:'card',kind:'card',on:true,feePct:1.3},{id:'iban',n:'Переказ на рахунок',ic:'bank',kind:'transfer',on:true},{id:'mono',n:'monobank на банку',ic:'coins',kind:'transfer',on:true}],
   expCats:[{id:'rent',n:'Оренда'},{id:'util',n:'Комунальні'},{id:'mat',n:'Матеріали'},{id:'ads',n:'Реклама'},{id:'tax',n:'Податки'},{id:'equip',n:'Обладнання'},{id:'house',n:'Господарчі'},{id:'other',n:'Інше'}],
   tags:[{id:'vip',n:'VIP'},{id:'allergy',n:'Алергія'},{id:'late',n:'Запізнюється'},{id:'friend',n:'Знайома власниці'},{id:'kid',n:'Дитина'},{id:'student',n:'Студентка'}],
   resources:[{id:'r1',n:'Манікюрний стіл 1'},{id:'r2',n:'Манікюрний стіл 2'},{id:'r3',n:'Крісло перукаря'},{id:'r4',n:'Барбер-крісло'},{id:'r5',n:'Кабінет косметолога'}],
   staff:[],cats:[],services:[],clients:[],appts:[],payments:[],expenses:[],cashOps:[],dayClose:{},payouts:[],
   certs:[],abonTypes:[],abons:[],products:[],stockMoves:[],timeoff:[],sched:{},tasks:[],reviews:[],audit:[],dayNotes:{},waitlist:[],
   meId:'s0'
  };
  db.staff=[
   {id:'s0',n:'Наталія Савчук',role:'owner',lvl:null,spec:'Власниця',ph:'380672145590',works:false},
   {id:'s1',n:'Юлія Романенко',role:'admin',lvl:null,spec:'Адміністратор',ph:'380931112233',works:false,pay:{type:'fixed',fixed:14000,pct:0}},
   {id:'m1',n:'Олена Коваленко',role:'master',lvl:'top',spec:'Нігтьовий сервіс',ph:'380671234501',cats:['nail'],res:'r1'},
   {id:'m2',n:'Марина Іваненко',role:'master',lvl:'mid',spec:'Манікюр, педикюр',ph:'380671234502',cats:['nail'],res:'r2'},
   {id:'m3',n:'Христина Шевчук',role:'master',lvl:'jr',spec:'Брови та вії',ph:'380671234503',cats:['brow']},
   {id:'m4',n:'Дарина Мельник',role:'master',lvl:'top',spec:'Перукар-колорист',ph:'380671234504',cats:['hair'],res:'r3'},
   {id:'m5',n:'Віталій Бондаренко',role:'master',lvl:'mid',spec:'Барбер',ph:'380671234505',cats:['barber'],res:'r4'},
   {id:'m6',n:'Ірина Ткач',role:'master',lvl:'mid',spec:'Косметолог',ph:'380671234506',cats:['cosm'],res:'r5'},
   {id:'s2',n:'Оксана Гнатюк',role:'accountant',lvl:null,spec:'Бухгалтер',ph:'380931114455',works:false,pay:{type:'fixed',fixed:9000,pct:0}}
  ];
  /* шаблон тижня: wd1 0..6 → [start,end] або null; перерва */
  var tpl={m1:[[540,1140],[540,1140],null,[540,1140],[540,1140],[600,1020],null],
           m2:[null,[600,1200],[600,1200],[600,1200],null,[600,1080],[600,1020]].slice(0,7),
           m3:[[600,1140],[600,1140],[600,1140],null,[600,1140],[600,1020],null],
           m4:[[540,1080],null,[540,1080],[540,1080],[540,1080],[600,1080],null],
           m5:[[600,1200],[600,1200],[600,1200],[600,1200],[600,1200],null,null],
           m6:[null,[600,1140],[600,1140],[600,1140],[600,1140],[600,1020],null]};
  db.staff.forEach(function(s,i){
    s.short=U.short(s.n);s.ini=U.ini(s.n);s.c=i%8;s.active=true;s.since=D.add(T,-(200+i*90));
    if(s.role==='master'){s.week=tpl[s.id];s.brk=[[780,810],null,null,null,null,null,null].map(function(){return [810,840]});s.pay={type:'pct',pct:null,fixed:0,svc:{},productPct:10,tipsPct:100};s.online=true;}
    else{s.week=null}
    s.tg=s.role!=='owner'||true;
  });
  db.cats=[{id:'nail',n:'Нігті'},{id:'brow',n:'Брови та вії'},{id:'hair',n:'Волосся'},{id:'barber',n:'Барбер'},{id:'cosm',n:'Косметологія'}];
  var S=[
   ['mg','nail','Манікюр + гель-лак',90,600],['mk','nail','Манікюр класичний',60,350],['mm','nail','Чоловічий манікюр',45,350],['sn','nail','Зняття покриття',15,150],['nar','nail','Нарощування нігтів',120,950],['kor','nail','Корекція нарощених нігтів',105,750],['pd','nail','Педикюр + покриття',90,700],['dz','nail','Дизайн (1 ніготь)',10,30],
   ['lam','brow','Ламінування брів',60,500],['brw','brow','Корекція та фарбування брів',45,400],['vii','brow','Нарощування вій класика',90,800],['vii2','brow','Нарощування вій 2D',120,1000],['lv','brow','Ламінування вій',75,650],
   ['sh','hair','Стрижка жіноча',60,650],['st','hair','Стрижка + укладка',90,850],['uk','hair','Укладка',45,450],['col','hair','Фарбування коренів',120,1500],['air','hair','Фарбування AirTouch',240,3500],['ton','hair','Тонування',120,1300],['ker','hair','Кератинове випрямлення',180,2800],
   ['mh','barber','Чоловіча стрижка',45,400],['bd','barber','Оформлення бороди',30,250],['hb','barber','Стрижка + борода',75,600],['kid','barber','Дитяча стрижка',30,300],
   ['cl','cosm','Чистка обличчя',75,900],['pil','cosm','Пілінг',45,700],['mas','cosm','Масаж обличчя',40,550],['bio','cosm','Біоревіталізація',45,2200]
  ];
  db.services=S.map(function(s,i){var sv={id:s[0],cat:s[1],n:s[2],d:s[3],price:s[4],byLevel:{},byMaster:{},buffer:0,online:s[0]!=='dz',active:true,cost:Math.round(s[4]*(s[1]==='hair'?.18:s[1]==='nail'?.1:.08)),order:i,desc:''};
    db.levels.forEach(function(l){sv.byLevel[l.id]=Math.round(s[4]*l.k/10)*10});return sv});
  db.services.find(function(s){return s.id==='air'}).buffer=15;
  /* клієнти */
  var FN=['Анна','Олена','Ірина','Наталія','Тетяна','Юлія','Оксана','Світлана','Марія','Катерина','Вікторія','Ольга','Людмила','Галина','Дарʼя','Софія','Анастасія','Альона','Валерія','Христина','Інна','Лілія','Мирослава','Діана','Яна','Вероніка','Поліна','Зоряна','Уляна','Богдана'];
  var LN=['Коваль','Шевченко','Бондар','Ткаченко','Кравченко','Мельник','Олійник','Савчук','Лисенко','Руденко','Гнатюк','Бойко','Мартинюк','Петренко','Мазур','Поліщук','Кравець','Осадча','Гончар','Яремчук','Стеценко','Дорош','Білик','Попова','Захарченко','Левченко','Марченко','Ковальчук','Романюк','Тимошенко','Литвин','Пономаренко','Савченко','Козак','Остапчук'];
  var MFN=['Андрій','Олександр','Дмитро','Максим','Іван','Богдан','Тарас','Володимир','Сергій','Назар','Артем','Денис','Роман','Юрій'];
  var MLN=['Коваль','Шевченко','Бондар','Ткаченко','Мельник','Олійник','Лисенко','Руденко','Гнатюк','Бойко','Петренко','Мазур','Кравець','Гончар','Дорош','Білик','Козак','Литвин'];
  var used={};
  for(var i=0;i<168;i++){
    var male=i>=134, n;
    do{n=male?pick(MFN)+' '+pick(MLN):pick(FN)+' '+pick(LN)}while(used[n]);used[n]=1;
    var c={id:'c'+(i+1),n:n,male:male,ph:chance(.88)?'3806'+(7+Math.floor(R()*3))+String(1e6+Math.floor(R()*8.9e6)).slice(0,7):'',tg:chance(.55),bd:chance(.6)?(1970+Math.floor(R()*36))+'-'+String(1+Math.floor(R()*12)).padStart(2,'0')+'-'+String(1+Math.floor(R()*28)).padStart(2,'0'):'',
      tags:[],note:'',src:pick(['ig','ig','online','phone','walkin','friend','tg']),created:D.add(T,-Math.floor(30+R()*700)),blocked:false,consent:{sms:chance(.8),promo:chance(.5)},gender:male?'m':'f',fav:null,vipManual:false};
    if(chance(.07))c.tags.push('vip');if(chance(.06)){c.tags.push('allergy');c.note='Алергія на акрилати — тільки гіпоалергенні матеріали.'}
    if(chance(.05))c.tags.push('late');if(chance(.04))c.tags.push('student');
    db.clients.push(c);
  }
  db.clients[3].note='Любить нюдові відтінки, каву без цукру.';db.clients[3].tags=['vip'];
  db.clients[17].bd=(1994)+T.slice(4,10);/* іменинниця сьогодні */
  db.clients[42].bd=(1990)+D.add(T,3).slice(4,10);
  /* хто до кого ходить */
  var byCat={nail:[],brow:[],hair:[],barber:[],cosm:[]};
  db.clients.forEach(function(c,i){if(c.male){byCat.barber.push(c.id);if(chance(.15))byCat.nail.push(c.id)}else{var cs=['nail','brow','hair','cosm'];var k=1+Math.floor(R()*2.2);for(var j=0;j<k;j++)byCat[pick(cs)].push(c.id);if(chance(.15))byCat.barber.push(c.id)}});
  var weights={};db.clients.forEach(function(c){weights[c.id]=R()<.3?5:R()<.6?2:1});
  function pickClient(cat){var a=byCat[cat];if(!a.length)a=db.clients.map(function(c){return c.id});var tot=0;a.forEach(function(id){tot+=weights[id]});var r=R()*tot;for(var j=0;j<a.length;j++){r-=weights[a[j]];if(r<=0)return a[j]}return a[0]}
  var svcByCat=U.groupBy(db.services.filter(function(s){return s.id!=='dz'&&s.id!=='sn'}),function(s){return s.cat});
  var popular={nail:['mg','mg','mg','mk','pd','pd','kor','nar','mm'],brow:['lam','brw','brw','vii','vii2','lv'],hair:['sh','st','col','col','ton','uk','air','ker'],barber:['mh','mh','mh','hb','hb','bd','kid'],cosm:['cl','pil','mas','bio','cl']};
  var nowM=D.nowMin(), seq=0;
  for(var off=-75;off<=21;off++){
    var day=D.add(T,off), wd1=D.wd1(day);
    db.staff.forEach(function(s){
      if(s.role!=='master')return;var w=s.week[wd1];if(!w)return;
      var fill=off<0?.82:off===0?.86:off<=3?.7:off<=7?.5:.28;
      var t=w[0]+(chance(.5)?0:15*Math.floor(R()*3));
      while(t<w[1]-30){
        if(t>=s.brk[wd1][0]&&t<s.brk[wd1][1]){t=s.brk[wd1][1];continue}
        var cat=s.cats[0];var sid=pick(popular[cat]);var sv=db.services.find(function(x){return x.id===sid});
        if(t+sv.d>w[1])break;
        if(!chance(fill)){t+=15*(2+Math.floor(R()*4));continue}
        var items=[{svc:sv.id,price:App.priceFor(sv,s,db),d:sv.d}];
        if(cat==='nail'&&chance(.35)){var sn=db.services.find(function(x){return x.id==='sn'});items.unshift({svc:'sn',price:sn.price,d:sn.d})}
        if(cat==='nail'&&chance(.2)){items.push({svc:'dz',price:30*(2+Math.floor(R()*6)),d:10})}
        if(cat==='barber'&&sid==='mh'&&chance(.2)){items.push({svc:'bd',price:App.priceFor(db.services.find(function(x){return x.id==='bd'}),s,db),d:30})}
        var dd=U.sum(items,function(x){return x.d});
        var st,end=t+dd;
        if(off<0)st=chance(.045)?'noshow':chance(.06)?'cancelled':'done';
        else if(off===0)st=end<=nowM?(chance(.05)?'noshow':'done'):t<=nowM?'arrived':(chance(.8)?'confirmed':'new');
        else st=chance(.03)?'cancelled':(off<=2?(chance(.75)?'confirmed':'new'):(chance(.4)?'confirmed':'new'));
        var cid=pickClient(cat);
        var src=pick(['admin','admin','online','online','online','phone','tg','ig']);
        var a={id:'a'+(++seq),staff:s.id,date:day,start:t,items:items,client:cid,status:st,src:src,note:'',deposit:0,discount:null,created:D.add(day,-Math.floor(R()*12))+'T10:00',events:[],res:s.res||null};
        if(chance(.08))a.note=pick(['Хоче фото результату для Instagram','Прийде з дитиною','Попросила нагадати за день','Перший раз — показати палітру','Чутлива шкіра']);
        if(st==='cancelled')a.cancelReason=pick(['Клієнт захворів','Перенесла на інший день','Не встигає з роботи','Без пояснень']);
        var tot=U.sum(items,function(x){return x.price});
        if(db.settings.deposit.on&&tot>=1000&&(st!=='cancelled')&&chance(.5)){a.deposit=Math.round(tot*.3/10)*10;if(off<=0||chance(.6))db.payments.push({id:'p'+(++seq),appt:a.id,date:D.add(day,-2),ts:D.add(day,-2)+'T12:00',method:pick(['mono','iban']),amount:a.deposit,kind:'deposit',staff:s.id,by:'s1'})}
        if(st==='done'){
          if(chance(.08))a.discount={type:'pct',v:pick([5,10,15])};
          var due=App.apptTotal(a)-(a.deposit||0);
          var m=R();var meth=m<.42?'cash':m<.85?'card':m<.95?'iban':'mono';
          db.payments.push({id:'p'+(++seq),appt:a.id,date:day,ts:day+'T'+U.hm(end).padStart(5,'0'),method:meth,amount:due,kind:'service',staff:s.id,by:'s1'});
          if(chance(.28))db.payments.push({id:'p'+(++seq),appt:a.id,date:day,ts:day+'T'+U.hm(end).padStart(5,'0'),method:chance(.5)?'cash':'mono',amount:pick([50,50,100,100,150,200]),kind:'tip',staff:s.id,by:'s1'});
          a.closedAt=day+'T'+U.hm(end).padStart(5,'0');
        }
        if(st==='arrived')a.arrivedAt=day+'T'+U.hm(t).padStart(5,'0');
        db.appts.push(a);
        t=end+(chance(.6)?0:15*Math.floor(1+R()*3));
      }
    });
  }
  /* зробити кілька «проблемних» записів для демо сьогодні */
  var todays=db.appts.filter(function(a){return a.date===T&&a.status!=='cancelled'});
  var fut=todays.filter(function(a){return a.start>nowM});
  if(fut[0]){fut[0].status='new';fut[0].src='online';}
  if(fut[2]){fut[2].client='c4';}
  /* сертифікати */
  var cs=[[2000,'c12','Подарунок від чоловіка'],[1000,'c20',''],[1500,'c33',''],[3000,'c7','Корпоратив'],[500,'c51',''],[1000,'c60',''],[2500,'c88','']];
  cs.forEach(function(x,i){var sold=D.add(T,-(10+i*17));var code='SB-'+(4821+i*137);var bal=i===1?0:i===2?600:i===4?500:x[0];
    db.certs.push({id:'g'+(i+1),code:code,nominal:x[0],balance:bal,buyer:x[1],recipient:i%2?'':'Для: '+pick(FN),sold:sold,expires:D.add(sold,180),status:bal===0?'used':'active',note:x[2],method:pick(['cash','card','mono'])});
    db.payments.push({id:'p'+(++seq),appt:null,cert:'g'+(i+1),date:sold,ts:sold+'T14:00',method:'card',amount:x[0],kind:'cert_sale',staff:null,by:'s1'});
  });
  db.certs[5].expires=D.add(T,-3);db.certs[5].status='expired';
  /* абонементи */
  db.abonTypes=[{id:'at1',n:'5 манікюрів + гель-лак',svc:['mg'],qty:5,price:2700,days:120,on:true},{id:'at2',n:'10 чоловічих стрижок',svc:['mh','hb'],qty:10,price:3600,days:180,on:true},{id:'at3',n:'Чистка обличчя ×4',svc:['cl'],qty:4,price:3200,days:120,on:true}];
  [['at1','c4',2],['at1','c9',4],['at2','c140',7],['at3','c25',1],['at2','c150',0]].forEach(function(x,i){var t=db.abonTypes.find(function(a){return a.id===x[0]});var sold=D.add(T,-(20+i*21));
    db.abons.push({id:'ab'+(i+1),type:x[0],client:x[1],left:x[2],qty:t.qty,sold:sold,expires:D.add(sold,t.days),status:x[2]?'active':'used',price:t.price});
    db.payments.push({id:'p'+(++seq),appt:null,abon:'ab'+(i+1),date:sold,ts:sold+'T15:00',method:'card',amount:t.price,kind:'abon_sale',staff:null,by:'s1'});});
  /* товари */
  [['Олія для кутикули CND',180,85,14,5,'nail'],['Крем для рук Kodi',320,160,6,4,'nail'],['Шампунь Kerastase 250мл',1450,890,3,2,'hair'],['Маска для волосся Olaplex №8',1650,1020,1,2,'hair'],['Віск для укладки Reuzel',520,290,9,3,'barber'],['Олія для бороди',450,210,7,3,'barber'],['Сироватка з гіалуроновою к-тою',890,430,4,2,'cosm'],['SPF-крем 50',760,380,0,2,'cosm']].forEach(function(p,i){
    db.products.push({id:'pr'+(i+1),n:p[0],price:p[1],cost:p[2],stock:p[3],min:p[4],cat:p[5],sku:'SB'+(1001+i),sell:true});
  });
  for(var k=0;k<22;k++){var d=D.add(T,-Math.floor(R()*60));var pr=pick(db.products);db.payments.push({id:'p'+(++seq),appt:null,product:pr.id,qty:1,date:d,ts:d+'T16:00',method:pick(['cash','card']),amount:pr.price,kind:'product',staff:pick(['m1','m2','m4','m5','m6']),by:'s1'})}
  /* витрати */
  for(var mo=-2;mo<=0;mo++){var ms=D.addMonths(T,mo);
    [['rent',18000,'Оренда приміщення',3],['util',3200+Math.floor(R()*1500),'Світло, вода, інтернет',8],['ads',2500,'Instagram реклама',5],['tax',4100,'Єдиний податок + ЄСВ',20],['house',600+Math.floor(R()*500),'Рушники, хімія',12],['mat',4200+Math.floor(R()*2000),'Гель-лаки, фарби, витратка',10],['mat',1800,'Фарби для волосся',18]].forEach(function(e,j){var d=D.add(ms,e[3]-1);if(d>T)return;db.expenses.push({id:'e'+(++seq),date:d,cat:e[0],amount:e[1],note:e[2],method:j%2?'iban':'cash',by:'s0'})});
  }
  db.expenses.push({id:'e'+(++seq),date:D.add(T,-4),cat:'equip',amount:6400,note:'Лампа для гель-лаку',method:'card',by:'s0'});
  db.expenses.push({id:'e'+(++seq),date:T,cat:'house',amount:240,note:'Кава, вода',method:'cash',by:'s1'});
  /* каса: інкасації */
  for(var w=1;w<=10;w++){var d2=D.add(T,-w*7+1);db.cashOps.push({id:'co'+w,date:d2,type:'out',amount:15000+Math.floor(R()*6)*1000,note:'Інкасація у сейф',by:'s0'})}
  db.cashOps.push({id:'co0',date:D.add(T,-80),type:'in',amount:2000,note:'Розмінна готівка',by:'s0'});
  /* виплати зарплат за попередні періоди */
  db.staff.forEach(function(s){if(s.role!=='master')return;for(var p=1;p<=4;p++){var d3=D.add(T,-p*15);db.payouts.push({id:'po'+s.id+p,staff:s.id,date:d3,amount:9000+Math.floor(R()*9000),type:'salary',note:'Зарплата за період',method:'cash',by:'s0'})}});
  db.payouts.push({id:'poadv',staff:'m2',date:D.add(T,-3),amount:2000,type:'advance',note:'Аванс',method:'cash',by:'s0'});
  db.staff[1].payHist=true;
  /* відпустки/лікарняні */
  db.timeoff.push({id:'to1',staff:'m4',from:D.add(T,9),to:D.add(T,15),kind:'vacation',note:'Відпустка'});
  db.timeoff.push({id:'to2',staff:'m6',from:D.add(T,2),to:D.add(T,2),kind:'personal',note:'Навчання'});
  /* задачі */
  db.tasks=[
   {id:'t1',t:'Замовити гель-лаки (закінчуються нюдові)',due:T,who:'s1',done:false,prio:'high',by:'s0'},
   {id:'t2',t:'Передзвонити Вікторії щодо перенесення',due:T,who:'s1',done:false,prio:'mid',by:'s1'},
   {id:'t3',t:'Оновити ціни на фарбування',due:D.add(T,3),who:'s0',done:false,prio:'mid',by:'s0'},
   {id:'t4',t:'Перевірити касу за вчора',due:D.add(T,-1),who:'s1',done:true,prio:'low',by:'s0'},
   {id:'t5',t:'Записати Дарину на курс AirTouch',due:D.add(T,10),who:'s0',done:false,prio:'low',by:'s0'},
   {id:'t6',t:'Помити стерилізатор',due:T,who:'m1',done:false,prio:'low',by:'s1'}
  ];
  /* відгуки */
  var RV=[[5,'Олена — найкращий майстер! Манікюр тримається 4 тижні.','m1'],[5,'Дуже затишно, кава смачна, запис онлайн за хвилину.','m2'],[4,'Все добре, але чекала 10 хвилин.','m3'],[5,'Віталій — топ барбер в Умані.','m5'],[3,'Брови вийшли трохи темніше, ніж хотіла.','m3'],[5,'AirTouch мрії. Дякую Дарині!','m4'],[5,'Чистка супер, шкіра дихає.','m6'],[2,'Скасували запис за годину до візиту.','m2'],[5,'Найкращий салон у місті.','m1']];
  RV.forEach(function(r,i){var c=db.clients[(i*13+5)%130];db.reviews.push({id:'rv'+(i+1),client:c.id,staff:r[2],rating:r[0],text:r[1],date:D.add(T,-(i*6+1)),src:i%3?'google':'tg',reply:i>2&&r[0]>=4?'Дякуємо! Чекаємо знову 🤍':'',hidden:false})});
  db.dayNotes[T]='Олена до 14:00 на навчанні онлайн — не ставити термінові записи.';
  db.waitlist=[{id:'w1',client:'c30',svc:'mg',staff:'m1',from:T,to:D.add(T,3),note:'будь-який час після 17:00',created:D.add(T,-1)},{id:'w2',client:'c66',svc:'air',staff:'m4',from:D.add(T,1),to:D.add(T,7),note:'',created:T}];
  db.audit.push({ts:T+'T08:58',who:'s1',act:'login',ent:'',txt:'Вхід у систему'});
  /* реалістична каса: більшість виплат — переказом, інкасація = накопичене за тиждень мінус розмінна */
  /* нові клієнти: кожен 8-й клієнт «прийшов уперше» в демо-вікні; його ранні записи віддаємо сусідньому постійному клієнту */
  db.clients.forEach(function(c,i){if(i%8!==3)return;var cr=D.add(T,-((i*13)%70)-1),alt=db.clients[i-1]?db.clients[i-1].id:null;c.created=cr;
    db.appts.forEach(function(a){if(a.client===c.id&&a.date<cr)a.client=alt})});
  db.payouts.forEach(function(p,i){p.method=i%4===0?'cash':'iban'});
  db.cashOps=db.cashOps.filter(function(o){return o.type==='in'});
  var bal=2000,start=D.add(T,-80),lastInk=start;
  D.range(start,D.add(T,-1)).forEach(function(d){
    db.payments.forEach(function(p){if(p.date===d&&p.method==='cash')bal+=p.amount});
    db.expenses.forEach(function(e){if(e.date===d&&e.method==='cash')bal-=e.amount});
    db.payouts.forEach(function(e){if(e.date===d&&e.method==='cash')bal-=e.amount});
    if(bal<0){db.cashOps.push({id:'co'+(++seq),date:d,type:'in',amount:-bal+1500,note:'Внесення з сейфа',by:'s0'});bal=1500}
    if(D.wd1(d)===5&&bal>5000){var amt=Math.floor((bal-3000)/1000)*1000;db.cashOps.push({id:'co'+(++seq),date:d,type:'out',amount:amt,note:'Інкасація у сейф',by:'s0'});bal-=amt}
  });
  var y=D.add(T,-1);db.dayClose[y]={counted:bal-50,expected:bal,diff:-50,note:'Не вистачає 50 ₴ — розбираємось',by:'s1',ts:y+'T20:10'};
  App.migrate(db);seedExtra(db);
  return db;
}
/* ───────── міграція (B1): ідемпотентна, db.v лишається 1 ───────── */
var TPL={confirm:'{імʼя}, ви записані в {салон}: {послуга}, {дата} о {час}, майстер {майстер}. Підтвердіть, будь ласка: Так / Перенести / Скасувати.',
  h24:'{імʼя}, нагадуємо: завтра о {час} — {послуга} у {салон}. Чекаємо! Якщо плани змінились: {посилання}',
  h2:'{імʼя}, за 2 години чекаємо вас у {салон}: {послуга} о {час}.',
  move:'{імʼя}, ваш запис перенесено: {послуга}, {дата} о {час}, майстер {майстер}.',
  cancel:'{імʼя}, ваш запис на {дата} о {час} скасовано. Записатися знову: {посилання}',
  review:'{імʼя}, дякуємо за візит! Оцініть, будь ласка, {майстер}: {посилання}',
  ret:'{імʼя}, давно не бачились. Запишіться до {майстер} у зручний час: {посилання}',
  wait:'{імʼя}, звільнилось місце: {послуга}, {дата} о {час}. Записати вас? Так / Ні'};
App.TPL=TPL;
App.migrate=function(db){
  db.notifs=db.notifs||[];db.photos=db.photos||[];db.msgs=db.msgs||[];db.campaigns=db.campaigns||[];
  db.waitlist=db.waitlist||[];db.waitlist.forEach(function(w){w.status=w.status||'wait'});
  var st=db.settings;st.access=st.access||{hidePhones:false,masterPay:true,masterBook:true};
  st.payroll=st.payroll||{};if(st.payroll.certSalePct==null)st.payroll.certSalePct=5;if(st.payroll.abonSalePct==null)st.payroll.abonSalePct=5;
  var r=st.reminders||{};
  st.notify=st.notify||{confirm:true,h24:r.h24!==false,h2:r.h2!==false,review:r.afterVisit!==false,reviewDelayH:3,returnDays:r.returnDays||28,quietFrom:'21:00',quietTo:'09:00',cascade:['tg','viber','sms'],team:true,tpl:Object.assign({},TPL)};
  st.telegram=st.telegram||{bot:'@sola_beauty_bot',clientBot:true,teamBot:true,connected:true};
  st.booking=st.booking||{};st.booking.link=st.booking.link||'sola.slotly.ua';
  if(!db.staff.some(function(s){return s.role==='accountant'}))db.staff.push({id:'s2',n:'Оксана Гнатюк',role:'accountant',lvl:null,spec:'Бухгалтер',ph:'380931114455',works:false,pay:{type:'fixed',fixed:9000,pct:0},short:'Оксана Г.',ini:'ОГ',c:db.staff.length%8,active:true,since:D.add(App.today(),-400),week:null,tg:true});
  return db};
/* демо-наповнення нових колекцій (тільки якщо порожні) */
function seedExtra(db){
  var T=App.today(),Y=D.add(T,-1),Tm=D.add(T,1);
  var cl=function(id){return db.clients.find(function(c){return c.id===id})||db.clients[0]};
  var ap=function(f){return db.appts.filter(f)};
  if(!db.notifs.length){
    var on=ap(function(a){return a.date>=T&&a.src==='online'&&a.status!=='cancelled'})[0];
    var mv=ap(function(a){return a.date===Tm&&a.status==='confirmed'})[1];
    var cn=ap(function(a){return a.date>=T&&a.status==='cancelled'})[0];
    var ln=function(a){return a?U.short(cl(a.client).n)+', '+(D.diff(T,a.date)===0?'сьогодні':D.diff(T,a.date)===1?'завтра':D.shortH(a.date))+' '+U.hm(a.start):''};
    var nn=[
     [T+'T'+'09:12','appt.new','Нова онлайн-запис: '+(on?ln(on):'Марія К., завтра 14:00'),on?'appt:'+on.id:'calendar',on?on.staff:'all',false],
     [T+'T'+'08:40','appt.move','Перенесено запис: '+(mv?ln(mv):'Олена Т.'),mv?'appt:'+mv.id:'calendar','all',false],
     [T+'T'+'08:05','review','Новий відгук 5★ від '+U.short(cl('c12').n),'reviews','all',false],
     [Y+'T'+'20:30','day','Вчора: розбіжність каси −50 ₴','cash','all',true],
     [Y+'T'+'18:15','appt.cancel','Скасовано запис: '+(cn?ln(cn):'Ірина С., завтра 11:00'),cn?'appt:'+cn.id:'calendar','all',true],
     [Y+'T'+'16:02','stock','Закінчується: Маска для волосся Olaplex №8 (1 шт.)','products','all',true],
     [Y+'T'+'13:47','wait','Звільнилось вікно завтра о 15:00 · 2 чекають','waitlist','all',true],
     [Y+'T'+'11:20','pay','Оплата 1 300 ₴ карткою: '+U.short(cl('c4').n),'cash','all',true]];
    db.notifs=nn.map(function(x,i){return {id:'n'+(i+1),ts:x[0],kind:x[1],txt:x[2],ref:x[3],to:x[4],read:x[5]}});
  }
  if(!db.photos.length)db.photos=[['before',-40],['after',-40],['before',-12],['after',-12]].map(function(x,i){return {id:'ph'+(i+1),client:'c4',appt:null,kind:x[0],date:D.add(T,x[1]),by:'m1',src:''}});
  if(!db.msgs.length){var tm=ap(function(a){return a.date===Tm&&a.status!=='cancelled'&&a.client}).slice(0,8),td=ap(function(a){return a.date===T&&a.status!=='cancelled'&&a.client}).slice(0,4);
    tm.forEach(function(a,i){var c=cl(a.client);db.msgs.push({id:'ms'+(i+1),ts:T+'T10:'+String(i*4).padStart(2,'0'),client:a.client,appt:a.id,ch:c.tg?'tg':'viber',tpl:'h24',txt:'Нагадування за 24 години',status:i<3?'read':'delivered',reply:i<3?'Так':''})});
    td.forEach(function(a,i){var c=cl(a.client);db.msgs.push({id:'ms'+(20+i),ts:Y+'T10:'+String(i*5).padStart(2,'0'),client:a.client,appt:a.id,ch:c.tg?'tg':'sms',tpl:'h24',txt:'Нагадування за 24 години',status:'read',reply:i%2?'':'Так'})});
    tm.slice(0,3).forEach(function(a){a.clientOk=true});}
  if(!db.campaigns.length)db.campaigns=[{id:'cp1',name:'Повернення 45+ днів',seg:'lost',tpl:'ret',txt:TPL.ret,ch:'tg',status:'sent',sentAt:D.add(T,-6)+'T11:00',n:18,booked:3},
    {id:'cp2',name:'Знижка до дня народження',seg:'bd',tpl:'ret',txt:'{імʼя}, з наближенням дня народження! Даруємо −10% на будь-яку послугу до кінця місяця: {посилання}',ch:'tg',status:'draft',sentAt:'',n:0,booked:0}];
  ['m1','m3','s1'].forEach(function(id,i){if(db.certs[i]&&!db.certs[i].soldBy)db.certs[i].soldBy=id});['m1','m4'].forEach(function(id,i){if(db.abons[i]&&!db.abons[i].soldBy)db.abons[i].soldBy=id});
}

/* ───────── сховище ───────── */
App.load=function(){
  try{var s=localStorage.getItem(KEY);if(s){var db=JSON.parse(s);if(db&&db.v===1){App.db=db;App.migrate(db);return}}}catch(e){}
  App.db=seed();App.save(true);
};
App.save=function(silent){try{localStorage.setItem(KEY,JSON.stringify(App.db))}catch(e){console.warn('save failed',e)}if(!silent)App.emit('change')};
App.reset=function(){localStorage.removeItem(KEY);App.db=seed();App.save(true);App.emit('change');App.render()};
var LS={};App.on=function(ev,f){(LS[ev]=LS[ev]||[]).push(f)};App.emit=function(ev,d){(LS[ev]||[]).forEach(function(f){try{f(d)}catch(e){console.error(e)}})};

/* ───────── пошук / селектори ───────── */
App.staff=function(id){return App.db.staff.find(function(s){return s.id===id})};
App.svc=function(id){return App.db.services.find(function(s){return s.id===id})};
App.client=function(id){return App.db.clients.find(function(c){return c.id===id})};
App.appt=function(id){return App.db.appts.find(function(a){return a.id===id})};
App.level=function(id){return App.db.levels.find(function(l){return l.id===id})};
App.payMethod=function(id){return App.db.pay.find(function(p){return p.id===id})||{n:id,ic:'coins'}};
App.me=function(){return App.staff(App.db.meId)};
App.masters=function(all){return App.db.staff.filter(function(s){return s.role==='master'&&(all||s.active)})};
App.priceFor=function(sv,st,db){db=db||App.db;var mode=db.settings.pricing;if(!st)return sv.price;
  if(mode==='byMaster'&&sv.byMaster&&sv.byMaster[st.id]!=null)return sv.byMaster[st.id];
  if(mode!=='single'&&st.lvl&&sv.byLevel&&sv.byLevel[st.lvl]!=null)return sv.byLevel[st.lvl];return sv.price};
App.apptDur=function(a){return U.sum(a.items,function(x){return x.d})+(a.extra||0)};
App.apptEnd=function(a){return a.start+App.apptDur(a)};
App.apptGross=function(a){return U.sum(a.items,function(x){return x.price})+(a.productsTotal||0)};
App.apptDiscount=function(a){var g=U.sum(a.items,function(x){return x.price});if(!a.discount)return 0;return a.discount.type==='pct'?Math.round(g*a.discount.v/100):Math.min(g,a.discount.v)};
App.apptTotal=function(a){return U.sum(a.items,function(x){return x.price})-App.apptDiscount(a)};
App.apptPays=function(a){return App.db.payments.filter(function(p){return p.appt===a.id})};
App.apptPaid=function(a){return U.sum(App.apptPays(a).filter(function(p){return p.kind==='service'||p.kind==='deposit'||p.kind==='cert'||p.kind==='abon'||p.kind==='refund'}),function(p){return p.amount})};
App.apptDue=function(a){return Math.max(0,App.apptTotal(a)-App.apptPaid(a))};
App.apptTips=function(a){return U.sum(App.apptPays(a).filter(function(p){return p.kind==='tip'}),function(p){return p.amount})};
App.apptTitle=function(a){return a.items.map(function(x){var s=App.svc(x.svc);return s?s.n:x.svc}).join(' + ')};
App.apptsOn=function(date,staffId){return App.db.appts.filter(function(a){return a.date===date&&(!staffId||a.staff===staffId)}).sort(function(a,b){return a.start-b.start})};
App.active=function(a){return a.status!=='cancelled'};
/* графік майстра на дату: {start,end,brk:[s,e]}|null (з урахуванням змін і відпусток) */
App.workHours=function(staffId,date){
  var s=App.staff(staffId);if(!s||!s.week)return null;
  var off=App.db.timeoff.find(function(t){return t.staff===staffId&&date>=t.from&&date<=t.to});if(off)return null;
  var o=App.db.sched[staffId]&&App.db.sched[staffId][date];
  if(o!==undefined){return o?{start:o[0],end:o[1],brk:o[2]||null,custom:true}:null}
  var w=s.week[D.wd1(date)];if(!w)return null;return {start:w[0],end:w[1],brk:s.brk&&s.brk[D.wd1(date)]||null}};
App.timeOff=function(staffId,date){return App.db.timeoff.find(function(t){return t.staff===staffId&&date>=t.from&&date<=t.to})||null};
/* конфлікт: перетин з іншими активними записами майстра або поза графіком */
App.conflicts=function(staffId,date,start,dur,exceptId){
  var end=start+dur,res=[];
  App.apptsOn(date,staffId).forEach(function(a){if(a.id===exceptId||!App.active(a))return;if(start<App.apptEnd(a)&&end>a.start)res.push({type:'overlap',appt:a})});
  var wh=App.workHours(staffId,date);
  if(!wh)res.push({type:'dayoff'});else{if(start<wh.start||end>wh.end)res.push({type:'hours',wh:wh});if(wh.brk&&start<wh.brk[1]&&end>wh.brk[0])res.push({type:'break'})}
  return res};
App.freeSlots=function(staffId,date,dur){
  var wh=App.workHours(staffId,date);if(!wh)return [];var step=App.db.settings.booking.step,r=[];
  for(var t=wh.start;t+dur<=wh.end;t+=step){if(!App.conflicts(staffId,date,t,dur).length)r.push(t)}return r};
/* статистика клієнта */
App.clientStats=function(cid){
  var as=App.db.appts.filter(function(a){return a.client===cid}).sort(function(a,b){return (a.date+String(a.start).padStart(4,'0'))<(b.date+String(b.start).padStart(4,'0'))?-1:1});
  var T=App.today();
  var done=as.filter(function(a){return a.status==='done'}),ns=as.filter(function(a){return a.status==='noshow'}),cn=as.filter(function(a){return a.status==='cancelled'});
  var spent=U.sum(done,function(a){return App.apptTotal(a)});
  var last=done.length?done[done.length-1]:null;
  var next=as.find(function(a){return a.date>=T&&(a.status==='new'||a.status==='confirmed'||a.status==='arrived')});
  var fav=U.groupBy(done,function(a){return a.staff});var favId=null,mx=0;for(var k in fav)if(fav[k].length>mx){mx=fav[k].length;favId=k}
  var gaps=[];for(var i=1;i<done.length;i++)gaps.push(D.diff(done[i-1].date,done[i].date));
  var avgGap=gaps.length?Math.round(U.sum(gaps)/gaps.length):null;
  var rel=as.length?Math.round(100*(done.length)/(done.length+ns.length+cn.filter(function(a){return a.lateCancel}).length||1)):null;
  return {all:as,visits:done.length,noshow:ns.length,cancelled:cn.length,spent:spent,avg:done.length?Math.round(spent/done.length):0,last:last,lastDate:last&&last.date,next:next,fav:favId,avgGap:avgGap,daysSince:last?D.diff(last.date,T):null,reliability:rel,first:as[0]&&as[0].date};
};
App.clientSegment=function(c,st){st=st||App.clientStats(c.id);var T=App.today();
  if(c.blocked)return 'blocked';if(st.visits===0)return 'new';if(st.visits<=1&&D.diff(st.first,T)<45)return 'new';
  if(st.daysSince!=null&&st.daysSince>60)return 'lost';if(st.visits>=5||c.tags.indexOf('vip')>=0)return 'regular';return 'active'};
App.SEG={new:'Нові',active:'Активні',regular:'Постійні',lost:'Давно не були',blocked:'Чорний список'};
/* ───────── B1: нові селектори ───────── */
App.performs=function(st,sv){if(!st||!sv)return false;if(st.svcs)return st.svcs.indexOf(sv.id)>=0;return (st.cats||[]).indexOf(sv.cat)>=0};
App.nextFree=function(svcId,o){o=o||{};var sv=App.svc(svcId);if(!sv)return [];var n=o.n||5,T=App.today(),from=o.from&&o.from>T?o.from:T,now=D.nowMin(),res=[];
  var ms=o.staff?[App.staff(o.staff)].filter(Boolean):App.masters().filter(function(m){return App.performs(m,sv)});
  for(var i=0;i<14&&res.length<n;i++){var d=D.add(from,i);var day=[];
    ms.forEach(function(m){App.freeSlots(m.id,d,sv.d+(sv.buffer||0)).forEach(function(t){if(d===T&&t<=now)return;day.push({staff:m.id,date:d,start:t})})});
    day.sort(function(a,b){return a.start-b.start});
    for(var j=0;j<day.length&&res.length<n;j++)res.push(day[j])}
  return res};
App.waitMatches=function(staffId,date,start,dur){var m=App.staff(staffId);return (App.db.waitlist||[]).filter(function(w){if((w.status||'wait')!=='wait')return false;
  if(date<w.from||date>w.to)return false;if(w.staff)return w.staff===staffId;return App.performs(m,App.svc(w.svc))})};
App.clientDebt=function(cid){var T=App.today();return U.sum(App.db.appts.filter(function(a){return a.client===cid&&a.status==='done'&&a.date<=T}),function(a){return App.apptDue(a)})};
App.apptRisks=function(a){var r=[];if(!a||!a.client)return r;var c=App.client(a.client);if(!c)return r;var st=App.clientStats(c.id),T=App.today();
  if(st.visits===0)r.push({k:'new',t:'Новий клієнт'});
  if(a.status==='new'){var mins=D.diff(T,a.date)*1440+a.start-D.nowMin();if(mins<1440)r.push({k:'unconf',t:'Не підтвердив(ла)'})}
  var debt=App.clientDebt(c.id);if(debt>0)r.push({k:'debt',t:'Борг '+U.uah(debt)});
  if(st.noshow>=2)r.push({k:'late',t:st.noshow+' '+U.plural(st.noshow,'неявка','неявки','неявок')});
  if(c.tags.indexOf('allergy')>=0||/алерг/i.test(c.note||''))r.push({k:'allergy',t:'Алергія'});
  return r.slice(0,3)};
App.canSeePhone=function(role){role=role||App.me().role;return !(role==='master'&&App.db.settings.access&&App.db.settings.access.hidePhones)};
App.phoneOf=function(c,role){if(!c||!c.ph)return '';if(!App.canSeePhone(role))return '';return U.phone(c.ph)};
App.dayStatus=function(date){var db=App.db,now=D.nowMin(),T=App.today();var as=App.apptsOn(date).filter(function(a){return a.status!=='cancelled'&&!a.block});
  var paid=function(a){return App.apptPaid(a)>=App.apptTotal(a)&&App.apptTotal(a)>0};
  var past=function(a){return date<T||(date===T&&a.start<=now)};
  var m=App.money(date,date);var done=as.filter(function(a){return a.status==='done'});
  return {visits:as.length,done:done.length,unpaid:as.filter(function(a){return a.status==='arrived'&&!paid(a)}).map(function(a){return a.id}),
    open:as.filter(function(a){return (a.status==='new'||a.status==='confirmed')&&past(a)}).map(function(a){return a.id}),
    noshow:as.filter(function(a){return a.status==='noshow'}).map(function(a){return a.id}),
    expected:App.cashBalance(date),closed:!!db.dayClose[date],revenue:m.revenue,avg:m.avgCheck,tips:m.tips,byMethod:m.byMethod}};
/* сповіщення «для мене»: майстру з загальних (to:'all') — тільки свої записи/клієнти й відгуки, без грошей салону і складу */
App.notifMine=function(n,staffId){staffId=staffId||App.db.meId;if(n.to===staffId)return true;if(n.to!=='all')return false;
  var me=App.staff(staffId);if(!me||me.role!=='master')return true;if(/^(pay|day|stock)$/.test(n.kind||''))return false;
  var r=(n.ref||'').split(':');if(r[0]==='appt'){var a=App.appt(r[1]);return !!(a&&a.staff===staffId)}return r[0]!=='cash'&&r[0]!=='products'};
App.unread=function(staffId){staffId=staffId||App.db.meId;return (App.db.notifs||[]).filter(function(n){return !n.read&&App.notifMine(n,staffId)})};

/* ───────── фінанси: розрахунки ───────── */
/* виторг за період: послуги (оплачені), продажі товарів, продаж сертифікатів/абонементів, чайові окремо */
App.money=function(from,to,staffId){
  var db=App.db,acc=db.settings.accounting;
  /* передоплата = аванс: у касі — в день оплати, у виторзі — в день візиту і лише коли візит уже відбувся/закрився (не new/confirmed/arrived) */
  var inR=function(d){return d>=from&&d<=to};
  var depDay=function(p){var a=App.appt(p.appt);if(!a)return p.date;return a.status==='new'||a.status==='confirmed'||a.status==='arrived'?null:a.date};
  var o={services:0,products:0,certSales:0,abonSales:0,tips:0,deposits:0,depositsAhead:0,refunds:0,byMethod:{},cash:0,count:0,certRedeemed:0,abonRedeemed:0};
  db.payments.forEach(function(p){if(p.kind!=='deposit'||(staffId&&p.staff!==staffId))return;var d=depDay(p);
    if(d&&inR(d)){o.services+=p.amount;o.deposits+=p.amount}
    if(!d&&inR(p.date))o.depositsAhead+=p.amount});
  var pays=db.payments.filter(function(p){return inR(p.date)&&(!staffId||p.staff===staffId)});
  pays.forEach(function(p){
    if(p.kind==='service'){o.services+=p.amount}
    else if(p.kind==='deposit'){}
    else if(p.kind==='cert'){o.certRedeemed+=p.amount;if(acc.certRevenue==='redeem')o.services+=p.amount}
    else if(p.kind==='abon'){o.abonRedeemed+=p.amount;}
    else if(p.kind==='product')o.products+=p.amount;
    else if(p.kind==='cert_sale')o.certSales+=p.amount;
    else if(p.kind==='abon_sale')o.abonSales+=p.amount;
    else if(p.kind==='tip')o.tips+=p.amount;
    else if(p.kind==='refund')o.refunds+=p.amount;
    if(p.method&&p.kind!=='cert'&&p.kind!=='abon'){o.byMethod[p.method]=(o.byMethod[p.method]||0)+p.amount}
  });
  o.revenue=o.services+o.products+(acc.certRevenue==='sale'?o.certSales:0)+o.abonSales+o.refunds;
  o.inflow=U.sum(Object.keys(o.byMethod),function(k){return o.byMethod[k]});
  var done=db.appts.filter(function(a){return a.date>=from&&a.date<=to&&a.status==='done'&&(!staffId||a.staff===staffId)});
  o.visits=done.length;o.avgCheck=done.length?Math.round(U.sum(done,function(a){return App.apptTotal(a)})/done.length):0;
  o.expenses=staffId?0:U.sum(db.expenses.filter(function(e){return e.date>=from&&e.date<=to}),function(e){return e.amount});
  return o};
/* каса (готівка) на кінець дня */
App.cashBalance=function(date){
  var db=App.db,b=0;
  db.payments.forEach(function(p){if(p.date<=date&&p.method==='cash')b+=p.amount});
  db.expenses.forEach(function(e){if(e.date<=date&&e.method==='cash')b-=e.amount});
  db.payouts.forEach(function(e){if(e.date<=date&&e.method==='cash')b-=e.amount});
  db.cashOps.forEach(function(o){if(o.date<=date)b+=o.type==='in'?o.amount:-o.amount});
  return b};
/* зарплата майстра за період */
App.payroll=function(staffId,from,to){
  var db=App.db,s=App.staff(staffId),cfg=s.pay||{type:'pct'},lvl=App.level(s.lvl);
  var basePct=cfg.pct!=null?cfg.pct:(lvl?lvl.pct:0);
  var acc=db.settings.payroll;
  var done=db.appts.filter(function(a){return a.staff===staffId&&a.status==='done'&&a.date>=from&&a.date<=to});
  var lines=[],svcSum=0,earn=0;
  done.forEach(function(a){
    var g=U.sum(a.items,function(x){return x.price}),disc=App.apptDiscount(a);
    a.items.forEach(function(x){
      var share=g?x.price/g:0;var base=acc.basis==='afterDiscount'?x.price-disc*share:x.price;
      var p=cfg.svc&&cfg.svc[x.svc]!=null?cfg.svc[x.svc]:basePct;
      var e=cfg.type==='fixed'?0:base*p/100;
      svcSum+=base;earn+=e;lines.push({kind:'svc',appt:a.id,date:a.date,svc:x.svc,base:Math.round(base),pct:p,earn:Math.round(e),client:a.client});
    });
  });
  /* F66: % продавцю за сертифікати й абонементи */
  var cP=acc.certSalePct!=null?acc.certSalePct:5,aP=acc.abonSalePct!=null?acc.abonSalePct:5,sale=0;
  (db.certs||[]).forEach(function(g){if(g.soldBy===staffId&&g.sold>=from&&g.sold<=to){var e2=Math.round(g.nominal*cP/100);sale+=e2;lines.push({kind:'sale',t:'Сертифікат '+g.code,appt:null,date:g.sold,svc:null,base:g.nominal,pct:cP,earn:e2,client:null})}});
  (db.abons||[]).forEach(function(g){if(g.soldBy===staffId&&g.sold>=from&&g.sold<=to){var t2=(db.abonTypes||[]).find(function(x){return x.id===g.type});var e3=Math.round((g.price||0)*aP/100);sale+=e3;lines.push({kind:'sale',t:'Абонемент '+(t2?'«'+t2.n+'»':''),appt:null,date:g.sold,svc:null,base:g.price||0,pct:aP,earn:e3,client:g.client||null})}});
  var tips=U.sum(db.payments.filter(function(p){return p.kind==='tip'&&p.staff===staffId&&p.date>=from&&p.date<=to}),function(p){return p.amount})*(cfg.tipsPct!=null?cfg.tipsPct:100)/100;
  var prod=U.sum(db.payments.filter(function(p){return p.kind==='product'&&p.staff===staffId&&p.date>=from&&p.date<=to}),function(p){return p.amount});
  var prodEarn=prod*(cfg.productPct||0)/100;
  var fixed=0;if(cfg.type==='fixed'||cfg.type==='fixed_pct'){var days=D.diff(from,to)+1;fixed=Math.round((cfg.fixed||0)*days/30)}
  var adj=db.payouts.filter(function(p){return p.staff===staffId&&p.date>=from&&p.date<=to});
  var bonus=U.sum(adj.filter(function(p){return p.type==='bonus'}),function(p){return p.amount});
  var fine=U.sum(adj.filter(function(p){return p.type==='fine'}),function(p){return p.amount});
  var paid=U.sum(adj.filter(function(p){return p.type==='salary'||p.type==='advance'}),function(p){return p.amount});
  var total=Math.round(earn+sale+tips+prodEarn+fixed+bonus-fine);
  return {staff:staffId,from:from,to:to,visits:done.length,svcSum:Math.round(svcSum),svcEarn:Math.round(earn),tips:Math.round(tips),prod:Math.round(prod),prodEarn:Math.round(prodEarn),saleEarn:sale,fixed:fixed,bonus:bonus,fine:fine,total:total,paid:paid,left:total-paid,pct:basePct,lines:lines}};
App.payPeriod=function(date){date=date||App.today();var p=App.db.settings.payroll.period;
  if(p==='month')return {from:D.monthStart(date),to:D.monthEnd(date)};
  if(p==='week'){var w=D.weekStart(date);return {from:w,to:D.add(w,6)}}
  var d=+date.slice(8);return d<=15?{from:D.monthStart(date),to:date.slice(0,8)+'15'}:{from:date.slice(0,8)+'16',to:D.monthEnd(date)}};

/* ───────── мутації (журнал + збереження) ───────── */
function log(act,ent,txt){App.db.audit.push({ts:App.today()+'T'+U.hm(D.nowMin()).padStart(5,'0'),who:App.db.meId,act:act,ent:ent||'',txt:txt})}
function ev(a,txt){(a.events=a.events||[]).push({ts:App.today()+'T'+U.hm(D.nowMin()).padStart(5,'0'),who:App.db.meId,txt:txt})}
App.log=log;
var O=App.ops={};
O.createAppt=function(o){
  var a={id:U.uid('a'),staff:o.staff,date:o.date,start:o.start,items:o.items,client:o.client||null,status:o.status||'confirmed',src:o.src||'admin',note:o.note||'',deposit:o.deposit||0,discount:null,created:App.today()+'T'+U.hm(D.nowMin()),events:[],res:o.res||null,extra:o.extra||0};
  ev(a,'Створено ('+(App.SRC[a.src]||a.src)+')');App.db.appts.push(a);
  var c=App.client(a.client);log('create','appt:'+a.id,'Новий запис: '+(c?c.n:'без імені')+', '+D.shortH(a.date)+' '+U.hm(a.start));App.save();
  if(App.db.settings.offline)setTimeout(function(){UI.toast('Збережено на пристрої — синхронізуємо, щойно зʼявиться звʼязок')},400);
  if(!a.block&&(App.db.meId!==a.staff||a.src==='online'))O.notify('appt.new',(a.src==='online'?'Нова онлайн-запис: ':'Новий запис: ')+(c?U.short(c.n):'без імені')+', '+D.shortH(a.date)+' '+U.hm(a.start),'appt:'+a.id,a.staff);
  return a};
O.updateAppt=function(id,patch,why){var a=App.appt(id);if(!a)return;var old={staff:a.staff,date:a.date,start:a.start};Object.assign(a,patch);
  var moved=patch.date!==undefined&&patch.date!==old.date||patch.start!==undefined&&patch.start!==old.start||patch.staff!==undefined&&patch.staff!==old.staff;
  var txt=why||(moved?'Перенесено з '+D.shortH(old.date)+' '+U.hm(old.start)+(old.staff!==a.staff?' ('+App.staff(old.staff).short+')':'')+' на '+D.shortH(a.date)+' '+U.hm(a.start)+(old.staff!==a.staff?' ('+App.staff(a.staff).short+')':''):'Змінено');
  ev(a,txt);log(moved?'move':'edit','appt:'+id,txt);App.save();
  if(moved)O.notify('appt.move',(App.client(a.client)?U.short(App.client(a.client).n)+': ':'')+txt,'appt:'+id,'all');
  return a};
O.setStatus=function(id,st,extra){var a=App.appt(id);if(!a)return;var prev=a.status;a.status=st;extra=extra||{};
  if(st==='arrived')a.arrivedAt=App.today()+'T'+U.hm(D.nowMin());
  if(st==='cancelled'){a.cancelReason=extra.reason||'';a.lateCancel=!!extra.late}
  ev(a,'Статус: '+App.ST[prev].n+' → '+App.ST[st].n+(extra.reason?' ('+extra.reason+')':''));
  log('status','appt:'+id,(App.client(a.client)||{n:'—'}).n+': '+App.ST[st].n);App.save();
  if(st==='cancelled'&&prev!=='cancelled'){var cc=App.client(a.client);O.notify('appt.cancel','Скасовано запис: '+(cc?U.short(cc.n):'без імені')+', '+D.shortH(a.date)+' '+U.hm(a.start),'appt:'+id,'all');
    var wm=App.waitMatches(a.staff,a.date,a.start,App.apptDur(a));if(wm.length)O.notify('wait','Звільнилось '+D.shortH(a.date)+' о '+U.hm(a.start)+' · '+wm.length+' '+U.plural(wm.length,'чекає','чекають','чекають'),'waitlist','all')}
  return a};
O.deleteAppt=function(id){var i=App.db.appts.findIndex(function(a){return a.id===id});if(i<0)return;var a=App.db.appts.splice(i,1)[0];App.db.payments=App.db.payments.filter(function(p){return p.appt!==id});log('delete','appt:'+id,'Видалено запис '+D.shortH(a.date)+' '+U.hm(a.start));App.save();return a};
/* оплата: lines=[{method,amount}] + {tips:[{method,amount}], cert:{id,amount}, abon:{id}, products:[{id,qty}], discount} */
O.checkout=function(id,o){
  var a=App.appt(id),db=App.db,T=App.today(),ts=T+'T'+U.hm(D.nowMin());if(!a)return;
  if(o.discount!==undefined)a.discount=o.discount;
  (o.lines||[]).forEach(function(l){if(l.amount>0)db.payments.push({id:U.uid('p'),appt:id,date:T,ts:ts,method:l.method,amount:Math.round(l.amount),kind:'service',staff:a.staff,by:db.meId})});
  if(o.cert&&o.cert.amount>0){var g=db.certs.find(function(c){return c.id===o.cert.id});g.balance-=o.cert.amount;if(g.balance<=0){g.balance=0;g.status='used'}
    db.payments.push({id:U.uid('p'),appt:id,cert:g.id,date:T,ts:ts,method:'cert',amount:o.cert.amount,kind:'cert',staff:a.staff,by:db.meId});}
  if(o.abon){var ab=db.abons.find(function(x){return x.id===o.abon.id});ab.left-=1;if(ab.left<=0)ab.status='used';var t=db.abonTypes.find(function(x){return x.id===ab.type});
    var unit=Math.round(ab.price/ab.qty);db.payments.push({id:U.uid('p'),appt:id,abon:ab.id,date:T,ts:ts,method:'abon',amount:unit,kind:'abon',staff:a.staff,by:db.meId});}
  (o.tips||[]).forEach(function(l){if(l.amount>0)db.payments.push({id:U.uid('p'),appt:id,date:T,ts:ts,method:l.method,amount:Math.round(l.amount),kind:'tip',staff:a.staff,by:db.meId})});
  (o.products||[]).forEach(function(pp){var pr=db.products.find(function(x){return x.id===pp.id});if(!pr)return;pr.stock-=pp.qty;db.stockMoves.push({id:U.uid('sm'),product:pr.id,qty:-pp.qty,date:T,reason:'sale',appt:id});
    db.payments.push({id:U.uid('p'),appt:id,product:pr.id,qty:pp.qty,date:T,ts:ts,method:pp.method||(o.lines[0]&&o.lines[0].method)||'cash',amount:pr.price*pp.qty,kind:'product',staff:a.staff,by:db.meId})});
  a.status='done';a.closedAt=ts;
  var c=App.client(a.client);ev(a,'Оплачено: '+U.uah(U.sum(o.lines||[],function(l){return l.amount})));
  log('checkout','appt:'+id,'Оплата '+(c?c.n:'')+' — '+U.uah(App.apptTotal(a)));App.save();return a};
O.refund=function(apptId,amount,method,reason){var a=App.appt(apptId);App.db.payments.push({id:U.uid('p'),appt:apptId,date:App.today(),ts:App.today()+'T'+U.hm(D.nowMin()),method:method,amount:-Math.abs(amount),kind:'refund',staff:a&&a.staff,by:App.db.meId,note:reason||''});
  if(a)ev(a,'Повернення '+U.uah(amount)+(reason?' ('+reason+')':''));log('refund','appt:'+apptId,'Повернення '+U.uah(amount));App.save()};
O.addPayment=function(p){p.id=U.uid('p');p.date=p.date||App.today();p.ts=p.ts||p.date+'T'+U.hm(D.nowMin());p.by=App.db.meId;App.db.payments.push(p);log('pay','pay:'+p.id,(p.note||p.kind)+' '+U.uah(p.amount));App.save();return p};
O.upsertClient=function(c){var db=App.db;if(c.id){var x=App.client(c.id);Object.assign(x,c);log('edit','client:'+c.id,'Змінено клієнта '+x.n);App.save();return x}
  c.id=U.uid('c');c.tags=c.tags||[];c.created=App.today();c.consent=c.consent||{sms:true,promo:false};c.blocked=false;db.clients.push(c);log('create','client:'+c.id,'Новий клієнт '+c.n);App.save();return c};
O.mergeClients=function(keepId,dropId){var db=App.db;db.appts.forEach(function(a){if(a.client===dropId)a.client=keepId});db.certs.forEach(function(g){if(g.buyer===dropId)g.buyer=keepId});db.abons.forEach(function(g){if(g.client===dropId)g.client=keepId});
  var k=App.client(keepId),d=App.client(dropId);k.tags=Array.from(new Set(k.tags.concat(d.tags)));if(d.note)k.note=(k.note?k.note+'\n':'')+d.note;if(!k.ph)k.ph=d.ph;if(!k.bd)k.bd=d.bd;
  db.clients=db.clients.filter(function(c){return c.id!==dropId});log('merge','client:'+keepId,'Обʼєднано '+d.n+' → '+k.n);App.save()};
O.deleteClient=function(id){var c=App.client(id);App.db.clients=App.db.clients.filter(function(x){return x.id!==id});App.db.appts.forEach(function(a){if(a.client===id)a.client=null});log('delete','client:'+id,'Видалено клієнта '+(c&&c.n));App.save()};
O.addExpense=function(e){e.id=U.uid('e');e.by=App.db.meId;e.date=e.date||App.today();App.db.expenses.push(e);log('create','exp:'+e.id,'Витрата: '+e.note+' '+U.uah(e.amount));App.save();return e};
O.deleteExpense=function(id){var e=App.db.expenses.find(function(x){return x.id===id});App.db.expenses=App.db.expenses.filter(function(x){return x.id!==id});log('delete','exp:'+id,'Видалено витрату '+(e?U.uah(e.amount):''));App.save();return e};
O.cashOp=function(o){o.id=U.uid('co');o.by=App.db.meId;o.date=o.date||App.today();App.db.cashOps.push(o);log('cash','cash:'+o.id,(o.type==='in'?'Внесення ':'Вилучення ')+U.uah(o.amount)+' — '+o.note);App.save();return o};
O.closeDay=function(date,counted,note){var exp=App.cashBalance(date);App.db.dayClose[date]={counted:counted,expected:exp,diff:counted-exp,note:note||'',by:App.db.meId,ts:App.today()+'T'+U.hm(D.nowMin())};log('close','day:'+date,'Закриття дня: розбіжність '+U.uah(counted-exp));App.save();O.notify('day','День закрито: розбіжність '+U.uah(counted-exp),'cash','all')};
O.payout=function(o){o.id=U.uid('po');o.by=App.db.meId;o.date=o.date||App.today();App.db.payouts.push(o);var s=App.staff(o.staff);log('payout','staff:'+o.staff,({salary:'Виплата',advance:'Аванс',bonus:'Премія',fine:'Штраф'}[o.type])+' '+s.short+' '+U.uah(o.amount));App.save();return o};
O.sellCert=function(o){var db=App.db;var g={id:U.uid('g'),code:'SB-'+(5000+db.certs.length*137%4999),nominal:o.nominal,balance:o.nominal,buyer:o.buyer||null,recipient:o.recipient||'',sold:App.today(),expires:D.add(App.today(),o.days||180),status:'active',note:o.note||'',method:o.method};
  db.certs.push(g);db.payments.push({id:U.uid('p'),cert:g.id,appt:null,date:App.today(),ts:App.today()+'T'+U.hm(D.nowMin()),method:o.method,amount:o.nominal,kind:'cert_sale',staff:null,by:db.meId});log('create','cert:'+g.id,'Продано сертифікат '+g.code+' на '+U.uah(o.nominal));App.save();return g};
O.sellAbon=function(o){var db=App.db,t=db.abonTypes.find(function(x){return x.id===o.type});var ab={id:U.uid('ab'),type:t.id,client:o.client,left:t.qty,qty:t.qty,sold:App.today(),expires:D.add(App.today(),t.days),status:'active',price:o.price||t.price};
  db.abons.push(ab);db.payments.push({id:U.uid('p'),abon:ab.id,appt:null,date:App.today(),ts:App.today()+'T'+U.hm(D.nowMin()),method:o.method,amount:ab.price,kind:'abon_sale',staff:null,by:db.meId});log('create','abon:'+ab.id,'Продано абонемент «'+t.n+'»');App.save();return ab};
O.sellProduct=function(o){var db=App.db,pr=db.products.find(function(x){return x.id===o.id});pr.stock-=o.qty;db.stockMoves.push({id:U.uid('sm'),product:pr.id,qty:-o.qty,date:App.today(),reason:'sale'});
  db.payments.push({id:U.uid('p'),product:pr.id,qty:o.qty,appt:null,date:App.today(),ts:App.today()+'T'+U.hm(D.nowMin()),method:o.method,amount:o.price!=null?o.price:pr.price*o.qty,kind:'product',staff:o.staff||null,by:db.meId,client:o.client||null});log('sale','prod:'+pr.id,'Продаж: '+pr.n+' ×'+o.qty);App.save()};
O.stock=function(id,qty,reason,cost){var pr=App.db.products.find(function(x){return x.id===id});pr.stock+=qty;App.db.stockMoves.push({id:U.uid('sm'),product:id,qty:qty,date:App.today(),reason:reason||'in'});
  if(qty>0&&cost)App.db.expenses.push({id:U.uid('e'),date:App.today(),cat:'mat',amount:cost,note:'Закупівля: '+pr.n+' ×'+qty,method:'iban',by:App.db.meId});log('stock','prod:'+id,(qty>0?'Надходження ':'Списання ')+pr.n+' '+qty);App.save()};
O.set=function(path,val,txt){var o=App.db,p=path.split('.');for(var i=0;i<p.length-1;i++){o[p[i]]=o[p[i]]||{};o=o[p[i]]}o[p[p.length-1]]=val;log('settings',path,txt||'Змінено налаштування');App.save()};
O.upsert=function(coll,obj,txt){var arr=App.db[coll];if(obj.id){var x=arr.find(function(y){return y.id===obj.id});if(x){Object.assign(x,obj);log('edit',coll+':'+obj.id,txt||'Змінено');App.save();return x}}else obj.id=U.uid(coll.slice(0,2));arr.push(obj);log('create',coll+':'+obj.id,txt||'Додано');App.save();return obj};
/* B1: нові операції */
O.notify=function(kind,txt,ref,to){var db=App.db;db.notifs=db.notifs||[];var n={id:U.uid('n'),ts:App.today()+'T'+U.hm(D.nowMin()).padStart(5,'0'),kind:kind,txt:txt,ref:ref||'',to:to||'all',read:false};db.notifs.unshift(n);if(db.notifs.length>200)db.notifs.length=200;log('notify',ref||'',txt);App.save();return n};
O.readNotifs=function(ids){(App.db.notifs||[]).forEach(function(n){if(ids==='all'||(ids||[]).indexOf(n.id)>=0)n.read=true});App.save(true)};
O.sendMsg=function(o){var c=App.client(o.client)||{};var ch=o.ch||(c.tg?'tg':c.ph?'viber':'sms');var m={id:U.uid('ms'),ts:App.today()+'T'+U.hm(D.nowMin()).padStart(5,'0'),client:o.client||null,appt:o.appt||null,ch:ch,tpl:o.tpl||'',txt:o.txt||'',status:'delivered',reply:''};
  (App.db.msgs=App.db.msgs||[]).push(m);log('msg','client:'+(o.client||''),'Повідомлення ('+ch+'): '+(c.n||''));App.save();return m};
O.simReply=function(apptId,ans){var a=App.appt(apptId);if(!a)return;var db=App.db,c=App.client(a.client)||{n:'Клієнт'};
  var m=(db.msgs||[]).filter(function(x){return x.appt===apptId}).pop();if(m)m.reply=ans==='yes'?'Так':ans==='no'?'Скасувати':'Перенести';
  if(ans==='yes'){a.clientOk=true;if(a.status==='new')O.setStatus(apptId,'confirmed');else{log('edit','appt:'+apptId,c.n+' підтвердив(ла)');App.save()}}
  else if(ans==='no'){O.setStatus(apptId,'cancelled',{reason:'Клієнт скасував у месенджері'})}
  else O.notify('appt.move','Клієнт просить перенести: '+U.short(c.n)+', '+D.shortH(a.date)+' '+U.hm(a.start),'appt:'+apptId,a.staff);
  return a};
O.addPhoto=function(o){var db=App.db;db.photos=db.photos||[];if(db.photos.filter(function(x){return x.client===o.client}).length>=30)return false;
  var ph={id:U.uid('ph'),client:o.client,appt:o.appt||null,kind:o.kind||'after',date:o.date||App.today(),by:App.db.meId,src:o.src||''};db.photos.push(ph);log('create','photo:'+ph.id,'Додано фото клієнта');App.save();return ph};
O.delPhoto=function(id){App.db.photos=(App.db.photos||[]).filter(function(x){return x.id!==id});log('delete','photo:'+id,'Видалено фото');App.save()};
O.waitAdd=function(o){var w=Object.assign({id:U.uid('w')},o,{status:'wait',created:App.today()});(App.db.waitlist=App.db.waitlist||[]).push(w);var c=App.client(w.client);log('create','wait:'+w.id,'У лист очікування: '+(c?c.n:''));App.save();return w};
O.waitSet=function(id,st){var w=(App.db.waitlist||[]).find(function(x){return x.id===id});if(!w)return;w.status=st;log('edit','wait:'+id,'Лист очікування: '+st);App.save();return w};
O.campaign=function(o){var db=App.db;db.campaigns=db.campaigns||[];var x=o.id&&db.campaigns.find(function(c){return c.id===o.id});
  if(x)Object.assign(x,o);else{x=Object.assign({id:U.uid('cp'),status:'draft',sentAt:'',n:0,booked:0},o);db.campaigns.push(x)}log('edit','campaign:'+x.id,'Розсилка «'+(x.name||'')+'»');App.save();return x};
O.sendCampaign=function(id,ids){var x=(App.db.campaigns||[]).find(function(c){return c.id===id});if(!x)return;(ids||[]).forEach(function(cid){O.sendMsg({client:cid,tpl:x.tpl,txt:x.txt,ch:x.ch==='auto'?null:x.ch})});
  x.status='sent';x.sentAt=App.today()+'T'+U.hm(D.nowMin()).padStart(5,'0');x.n=(ids||[]).length;log('send','campaign:'+id,'Розсилку надіслано: '+x.n);App.save();return x};
O.remove=function(coll,id,txt){App.db[coll]=App.db[coll].filter(function(x){return x.id!==id});log('delete',coll+':'+id,txt||'Видалено');App.save()};

/* ───────── UI-хелпери ───────── */
var UI=App.ui={};
UI.av=function(person,cls){if(!person)return '<span class="av '+(cls||'')+'">?</span>';var ini=person.ini||U.ini(person.n);var c=person.c!=null?person.c:U.color(person.id);return '<span class="av '+(cls||'')+'" data-c="'+c+'">'+U.esc(ini)+'</span>'};
UI.badge=function(st){return '<span class="badge '+st+'">'+App.ST[st].n+'</span>'};
UI.empty=function(icon,title,text,btn){return '<div class="empty">'+App.icon(icon||'search','xl')+'<b>'+U.esc(title)+'</b>'+(text?'<span>'+U.esc(text)+'</span>':'')+(btn||'')+'</div>'};
UI.sw=function(name,on,attrs){return '<label class="sw"><input type="checkbox" '+(name?'name="'+name+'" ':'')+(on?'checked ':'')+(attrs||'')+'><i></i></label>'};
var openStack=[];
function close(el){if(!el||!el.parentNode)return;el.remove();openStack=openStack.filter(function(x){return x!==el});if(el._onclose)el._onclose()}
/* modal({title,sub,body,foot,size,onMount(el,close),onClose}) → {el,close} */
UI.modal=function(o){var ov=document.createElement('div');ov.className='ov'+(o.drawer?' dr':'');ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
  ov.innerHTML='<div class="'+(o.drawer?'drawer':'modal')+' '+(o.size||'')+'"><div class="modal-h"><h3>'+(o.title||'')+(o.sub?'<small>'+o.sub+'</small>':'')+'</h3>'+(o.head||'')+'<button class="icobtn ghost" data-x aria-label="Закрити">'+App.icon('x')+'</button></div><div class="modal-b">'+(o.body||'')+'</div>'+(o.foot?'<div class="modal-f">'+o.foot+'</div>':'')+'</div>';
  document.body.appendChild(ov);openStack.push(ov);ov._onclose=o.onClose;
  var c=function(){close(ov)};
  ov.addEventListener('mousedown',function(e){if(e.target===ov)c()});
  ov.querySelector('[data-x]').onclick=c;
  var f=ov.querySelector('input:not([type=hidden]),select,textarea');if(f&&!o.noFocus&&window.innerWidth>899)setTimeout(function(){f.focus()},30);
  /* B1: свайп униз по листу на телефоні */
  var box=ov.firstChild,g=document.createElement('div');g.className='sheet-grip';box.insertBefore(g,box.firstChild);
  var y0=null,dy=0;g.addEventListener('touchstart',function(e){if(window.innerWidth>899)return;y0=e.touches[0].clientY;dy=0;box.style.transition='none'},{passive:true});
  g.addEventListener('touchmove',function(e){if(y0==null)return;dy=Math.max(0,e.touches[0].clientY-y0);box.style.transform='translateY('+dy+'px)'},{passive:true});
  g.addEventListener('touchend',function(){if(y0==null)return;y0=null;box.style.transition='transform .2s var(--ease)';
    if(dy>80){if(box.querySelector('[data-dirty]')){box.style.transform='';UI.confirm({title:'Закрити без збереження?',ok:'Закрити',danger:true}).then(function(y){if(y)c()})}else c()}else box.style.transform=''});
  if(o.onMount)o.onMount(ov.firstChild,c);return {el:ov.firstChild,close:c}};
UI.drawer=function(o){o.drawer=true;return UI.modal(o)};
UI.closeAll=function(){openStack.slice().forEach(close)};
UI.confirm=function(o){return new Promise(function(res){var m=UI.modal({title:o.title,size:'narrow',body:'<p style="margin:0;color:var(--ink-2)">'+(o.text||'')+'</p>'+(o.input?'<div class="fld" style="margin-top:14px"><span>'+o.input+'</span><input class="inp" data-in placeholder="'+(o.placeholder||'')+'"></div>':''),
  foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn '+(o.danger?'dng pri':'pri')+'" data-yes>'+(o.ok||'Підтвердити')+'</button>',onClose:function(){res(false)},
  onMount:function(el,c){el.querySelector('[data-yes]').onclick=function(){var v=o.input?el.querySelector('[data-in]').value:true;m.el.parentNode._onclose=null;c();res(v||true)};el.querySelector('[data-no]').onclick=c}})})};
UI.toast=function(msg,o){o=o||{};var box=U.$('.toasts');if(!box){box=document.createElement('div');box.className='toasts';document.body.appendChild(box)}
  var t=document.createElement('div');t.className='toast '+(o.type||'ok');t.innerHTML=(o.type==='err'?App.icon('alert'):App.icon('check'))+'<span>'+msg+'</span>'+(o.undo?'<button class="btn sm">Скасувати</button>':'');box.appendChild(t);
  if(o.undo)t.querySelector('button').onclick=function(){o.undo();t.remove()};setTimeout(function(){t.style.transition='opacity .2s';t.style.opacity=0;setTimeout(function(){t.remove()},220)},o.ms||(o.undo?6000:2600))};
/* menu(anchorEl, [{t,ic,fn,dng}|'-']) */
UI.menu=function(anchor,items){UI.closeMenu();var m=document.createElement('div');m.className='menu';
  m.innerHTML=items.map(function(it,i){return it==='-'?'<div class="hr"></div>':'<button data-i="'+i+'" class="'+(it.dng?'dng':'')+'">'+(it.ic?App.icon(it.ic):'')+U.esc(it.t)+'</button>'}).join('');
  document.body.appendChild(m);var r=anchor.getBoundingClientRect();var mw=m.offsetWidth,mh=m.offsetHeight;
  var x=Math.min(r.right-mw,window.innerWidth-mw-8);if(x<8)x=Math.max(8,r.left);var y=r.bottom+4;if(y+mh>window.innerHeight-8)y=r.top-mh-4;m.style.left=x+'px';m.style.top=y+'px';
  m.onclick=function(e){var b=e.target.closest('[data-i]');if(!b)return;var it=items[+b.dataset.i];UI.closeMenu();it.fn&&it.fn()};
  setTimeout(function(){document.addEventListener('mousedown',UI._mout=function(e){if(!m.contains(e.target))UI.closeMenu()})},0);UI._menu=m};
UI.closeMenu=function(){if(UI._menu){UI._menu.remove();UI._menu=null;document.removeEventListener('mousedown',UI._mout)}};
/* вибір клієнта з пошуком (повертає HTML + bind) */
UI.clientPicker=function(el,onPick,opts){opts=opts||{};
  el.innerHTML='<div class="inp-ic">'+App.icon('search')+'<input class="inp" placeholder="Імʼя або телефон" data-q autocomplete="off"></div><div class="list" data-res style="margin-top:8px;max-height:260px;overflow:auto"></div>';
  var q=el.querySelector('[data-q]'),res=el.querySelector('[data-res]');
  function draw(){var v=q.value.trim().toLowerCase(),vd=v.replace(/\D/g,'');
    var list=App.db.clients.filter(function(c){return !v||c.n.toLowerCase().indexOf(v)>=0||(vd.length>=3&&c.ph.indexOf(vd)>=0)}).slice(0,8);
    res.innerHTML=list.map(function(c){var st=App.clientStats(c.id);return '<button class="li" data-c="'+c.id+'">'+UI.av(c,'sm')+'<span class="t"><b>'+U.esc(c.n)+(c.tags.indexOf('vip')>=0?' <span class="tag">VIP</span>':'')+'</b><small>'+(c.ph?U.phone(c.ph):'без телефону')+' · '+st.visits+' '+U.plural(st.visits,'візит','візити','візитів')+'</small></span>'+(c.blocked?'<span class="badge dng">ЧС</span>':'')+'</button>'}).join('')+
      '<button class="li" data-new>'+'<span class="av sm">'+App.icon('plus','s')+'</span><span class="t"><b>Новий клієнт'+(v?': «'+U.esc(q.value.trim())+'»':'')+'</b><small>Достатньо імені, телефон — за бажанням</small></span></button>'}
  q.oninput=draw;draw();
  res.onclick=function(e){var b=e.target.closest('[data-c]');if(b)return onPick(App.client(b.dataset.c));if(e.target.closest('[data-new]')){var n=q.value.trim();var isPh=/^[\d+\s()-]{6,}$/.test(n);
    UI.clientForm({n:isPh?'':n,ph:isPh?n.replace(/\D/g,''):''},function(c){onPick(c)})}};
  return q};
UI.clientForm=function(c,done){c=c||{};var m=UI.modal({title:c.id?'Редагувати клієнта':'Новий клієнт',size:'narrow',
  body:'<div class="col-f g12"><label class="fld"><span>Імʼя та прізвище</span><input class="inp" name="n" value="'+U.esc(c.n||'')+'" placeholder="Напр. Оксана Бойко"></label>'+
   '<label class="fld"><span>Телефон <small>необовʼязково</small></span><input class="inp" name="ph" inputmode="tel" value="'+U.esc(c.ph?U.phone(c.ph):'')+'" placeholder="+380"></label>'+
   '<label class="fld"><span>День народження</span><input class="inp" type="date" name="bd" value="'+U.esc(c.bd||'')+'"></label>'+
   '<label class="fld"><span>Нотатка</span><textarea class="ta" name="note" placeholder="Алергії, побажання…">'+U.esc(c.note||'')+'</textarea></label>'+
   '<label class="check"><input type="checkbox" name="promo" '+((c.consent||{}).promo?'checked':'')+'> Згода на акції та розсилки</label></div>',
  foot:'<span class="sp"></span><button class="btn" data-x2>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
  onMount:function(el,cl){el.querySelector('[data-x2]').onclick=cl;el.querySelector('[data-ok]').onclick=function(){var f=function(n){return el.querySelector('[name='+n+']')};var n=f('n').value.trim();if(!n){f('n').classList.add('err');f('n').focus();return}
    var ph=f('ph').value.replace(/\D/g,'');if(ph.length===10)ph='38'+ph;
    var dup=!c.id&&ph&&App.db.clients.find(function(x){return x.ph===ph});if(dup){UI.toast('Клієнт з таким телефоном уже є: '+dup.n,{type:'err'});cl();done&&done(dup);return}
    var obj=Object.assign({},c,{n:n,ph:ph,bd:f('bd').value,note:f('note').value,consent:Object.assign({},c.consent||{sms:true},{promo:f('promo').checked})});var r=App.ops.upsertClient(obj);cl();UI.toast(c.id?'Збережено':'Клієнта додано');done&&done(r)}}})};
/* міні-графік (sparkline/bars) */
UI.bars=function(vals,o){o=o||{};var w=o.w||600,h=o.h||140,mx=Math.max.apply(null,vals.concat([1])),n=vals.length,bw=w/n;var s='<svg viewBox="0 0 '+w+' '+(h+(o.labels?18:0))+'" width="100%" preserveAspectRatio="none" style="display:block;overflow:visible">';
  vals.forEach(function(v,i){var bh=Math.max(v?2:0,v/mx*h);s+='<rect x="'+(i*bw+bw*.18)+'" y="'+(h-bh)+'" width="'+(bw*.64)+'" height="'+bh+'" rx="2" fill="'+(o.hl===i?'var(--accent)':(o.color||'var(--ink)'))+'" opacity="'+(o.hl!=null&&o.hl!==i?.28:1)+'"><title>'+(o.labels?o.labels[i]+': ':'')+(o.fmt?o.fmt(v):v)+'</title></rect>';
    if(o.labels&&(n<=14||i%Math.ceil(n/10)===0))s+='<text x="'+(i*bw+bw/2)+'" y="'+(h+14)+'" text-anchor="middle" font-size="11" fill="var(--mute)">'+o.labels[i]+'</text>'});return s+'</svg>'};
UI.spark=function(vals,o){o=o||{};var w=o.w||120,h=o.h||32,mx=Math.max.apply(null,vals.concat([1])),mn=Math.min.apply(null,vals);var pts=vals.map(function(v,i){return (i*w/(vals.length-1||1)).toFixed(1)+','+(h-(v-mn)/(mx-mn||1)*h).toFixed(1)}).join(' ');
  return '<svg viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" style="display:block;overflow:visible"><polyline points="'+pts+'" fill="none" stroke="'+(o.color||'var(--ink)')+'" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/></svg>'};

/* ───────── роутер ───────── */
var ROUTES={},NAV=[];
/* App.route(id,{title,icon,group,perm,module,render(view,params,query),nav:true,order,count:fn,mobile:true}) */
App.route=function(id,o){o.id=id;ROUTES[id]=o};
App.routes=ROUTES;
App.parse=function(){var h=location.hash.replace(/^#\/?/,'');var qi=h.indexOf('?');var path=qi>=0?h.slice(0,qi):h,qs=qi>=0?h.slice(qi+1):'';var parts=path.split('/').filter(Boolean);var q={};qs.split('&').forEach(function(kv){if(!kv)return;var a=kv.split('=');q[decodeURIComponent(a[0])]=decodeURIComponent(a[1]||'')});return {id:parts[0]||'home',params:parts.slice(1),q:q}};
App.go=function(path,q){var s='#/'+path;if(q){var p=Object.keys(q).filter(function(k){return q[k]!=null&&q[k]!==''}).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(q[k])});if(p.length)s+='?'+p.join('&')}if(location.hash===s)App.render();else location.hash=s};
App.setQ=function(patch,replace){var r=App.parse();var q=Object.assign({},r.q,patch);var s='#/'+[r.id].concat(r.params).join('/');var p=Object.keys(q).filter(function(k){return q[k]!=null&&q[k]!==''}).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(q[k])});if(p.length)s+='?'+p.join('&');
  if(replace){history.replaceState(null,'',s);App.render()}else location.hash=s};
App.cur=null;
App.render=function(){
  var r=App.parse(),rt=ROUTES[r.id]||ROUTES.home;if(!rt)return;
  if(r.q.as&&App.staff(r.q.as)&&App.db.meId!==r.q.as){App.db.meId=r.q.as;App.save(true)}
  var selfOk=r.id==='team'&&r.params[0]&&r.params[0]===App.db.meId; /* майстер відкриває свій профіль/графік */
  if(rt.perm&&!selfOk&&!App.can(rt.perm)&&!(rt.permAlt&&App.can(rt.permAlt))){rt=ROUTES.denied||rt}
  App.cur={rt:rt,r:r};
  renderShell(rt,r);
  var view=U.$('#view');view.scrollTop=App._keepScroll===rt.id?view.scrollTop:0;App._keepScroll=null;
  view.className='view v-'+rt.id;
  try{rt.render(view,r.params,r.q)}catch(e){console.error(e);view.innerHTML='<div class="page">'+UI.empty('alert','Помилка в модулі «'+U.esc(rt.title)+'»',e.message)+'</div>'}
  document.title=(rt.title||'')+' — '+App.db.salon.name+' · Slotly';
};
/* перемалювати поточний екран без скролу нагору */
App.refresh=function(){if(!App.cur)return;App._keepScroll=App.cur.rt.id;var v=U.$('#view'),st=v.scrollTop;App.render();v.scrollTop=st};
App.setTop=function(html){var t=U.$('#top-x');if(t)t.innerHTML=html||'';
  /* B1: якщо екран сам дає «Новий запис» (календар до B2), глобальну кнопку ховаємо — без дубля */
  var tn=U.$('#top-new');if(tn)tn.style.display=/data-act="(cal-new|hm-new)"/.test(html||'')?'none':''};

var GROUPS=[['work',''],['money','Гроші'],['salon','Салон'],['growth','Зростання'],['sys','']];
App.NAV_HIDE=['audit'];
App.TOP_NEW_HIDE=['cash','payroll','settings','audit'];
function canRoute(x){return x&&(!x.perm||App.can(x.perm)||(x.permAlt&&App.can(x.permAlt)))&&(!x.module||App.db.settings.modules[x.module])}
function navItems(){return Object.keys(ROUTES).map(function(k){return ROUTES[k]}).filter(function(r){return r.nav&&App.NAV_HIDE.indexOf(r.id)<0&&canRoute(r)}).sort(function(a,b){return (a.order||99)-(b.order||99)})}
/* вкладки таббару за роллю (DESIGN-V2 §6.1); null = центральна «+» */
App.tabsFor=function(role){
  if(role==='master')return [['home','home','Мій день'],['calendar','cal','Календар'],null,['clients','users','Клієнти'],['more','menu','Ще']];
  if(role==='accountant')return [['home','home','Сьогодні'],['cash','wallet','Каса'],['reports','chart','Звіти'],['more','menu','Ще']];
  return [['home','home','Сьогодні'],['calendar','cal','Календар'],null,['clients','users','Клієнти'],['more','menu','Ще']]};
App.canNew=function(rt){var me=App.me(),acc=App.db.settings.access||{};if(rt&&(rt.noNew||App.TOP_NEW_HIDE.indexOf(rt.id)>=0||App.TOP_NEW_HIDE.indexOf(rt.parent)>=0))return false;
  if(!(App.can('calendar.all')||App.can('calendar.own')))return false;if(me.role==='master'&&acc.masterBook===false)return false;return true};
var MASTER_LBL={home:'Мій день',team:'Мій профіль',payroll:'Мій заробіток',schedules:'Мій графік'};App.MASTER_LBL=MASTER_LBL;
function navLink(it,rt){var c=it.count?it.count():'',lb=(App.me().role==='master'&&MASTER_LBL[it.id])||it.title;return '<a href="#/'+it.id+'" '+(it.id===rt.id||(rt.parent===it.id)?'aria-current="page"':'')+'>'+App.icon(it.icon)+'<span>'+lb+'</span>'+(c?'<span class="cnt'+(it.countDot?' dot':'')+'">'+c+'</span>':'')+'</a>'}
function bannerFor(db,me){var L=[];
  if(db.settings.offline)L.push('<div class="banner off" role="status">'+App.icon('wifioff')+'<span><b>Немає інтернету.</b> Записи зберігаються на пристрої й синхронізуються, щойно зʼявиться звʼязок.</span><span class="sp"></span><button class="btn sm" data-act="online">Звʼязок є</button></div>');
  if(db.settings.alert.on)L.push('<div class="banner air" role="status">'+App.icon('siren')+'<span><b>Повітряна тривога · '+U.esc(db.settings.alert.region)+'.</b> '+(db.settings.alert.mode==='pause'?'Онлайн-запис на найближчу годину призупинено.':'Клієнтам надіслано повідомлення про можливу затримку.')+'</span><span class="sp"></span><button class="btn sm" data-act="alert-off">Відбій</button></div>');
  var y=D.add(App.today(),-1);
  if(['owner','admin','accountant'].indexOf(me.role)>=0&&!db.dayClose[y]&&App.apptsOn(y).some(function(a){return a.status==='done'}))L.push('<div class="banner warn" role="status">'+App.icon('alert')+'<span class="bn-t"><b>Вчора не закрито день<span class="bn-full">.</span></b><span class="bn-full"> Звірте касу, щоб зарплати й звіти були точні.</span></span><span class="sp"></span><a class="btn sm" href="#/cash/close">Закрити день</a></div>');
  if(!L.length)return '';return L[0].replace('</div>',(L.length>1?'<span class="banner-more">ще '+(L.length-1)+'</span>':'')+'</div>')}
function renderShell(rt,r){
  var db=App.db,me=App.me(),items=navItems(),side='',sys='';
  GROUPS.forEach(function(g){var its=items.filter(function(x){return (x.group||'work')===g[0]});if(!its.length)return;
    var h=(g[1]?'<div class="grp">'+g[1]+'</div>':'')+its.map(function(it){return navLink(it,rt)}).join('');
    if(g[0]==='sys')sys=h;else side+='<div class="nav-g">'+h+'</div>'});
  U.$('#nav').innerHTML=side+(sys?'<div class="nav-sys">'+sys+'</div>':'');
  U.$('#salon-sw').innerHTML='<span class="mono">'+U.esc(db.salon.logo)+'</span><span class="t" style="min-width:0;flex:1;text-align:left"><b class="ell">'+U.esc(db.salon.name)+'</b><small class="ell">'+U.esc(db.salon.city+', '+db.salon.addr)+'</small></span>'+App.icon('down','s');
  U.$('#me').innerHTML=UI.av(me,'sm')+'<span style="min-width:0;flex:1;text-align:left"><b class="ell">'+U.esc(me.n)+'</b><small>'+App.ROLES[me.role].n+'</small></span>'+App.icon('morev','s');
  document.body.setAttribute('data-route',rt.id);
  var ttl=U.$('#ttl');ttl.innerHTML=U.esc((me.role==='master'&&MASTER_LBL[rt.id])||rt.title||'');
  /* назад */
  var bk=U.$('#top-back');if(bk){var par=rt.back||rt.parent||(r.params.length?rt.id:'');bk.hidden=!(r.params.length>0||rt.back||rt.parent);bk.onclick=function(){App.go(par||'home')}}
  /* глобальна «+ Новий запис» */
  var tn=U.$('#top-new');if(tn)tn.innerHTML=App.canNew(rt)?'<div class="split"><button class="btn pri" data-act="new-appt">'+App.icon('plus')+'<span>Новий запис</span></button><button class="btn pri split-more" data-act="create" aria-label="Інші дії">'+App.icon('down','s')+'</button></div>':'';
  /* дзвіночок */
  var bd=U.$('#bell .dot');if(bd)bd.hidden=!App.unread(me.id).length;
  /* банер: один за пріоритетом */
  U.$('#banners').innerHTML=bannerFor(db,me);
  /* tabbar */
  var tabs=App.tabsFor(me.role).filter(function(t){return t===null?App.canNew(null):(t[0]==='more'||canRoute(ROUTES[t[0]]))});
  U.$('#tabbar').style.gridTemplateColumns='repeat('+tabs.length+',minmax(0,1fr))';
  var ids=tabs.filter(Boolean).map(function(t){return t[0]});
  U.$('#tabbar').innerHTML=tabs.map(function(t){if(t===null)return '<button class="tab-plus" data-act="create" aria-label="Створити">'+App.icon('plus')+'</button>';
    var cur=t[0]===rt.id||t[0]===rt.parent||(t[0]==='more'&&ids.indexOf(rt.id)<0&&ids.indexOf(rt.parent)<0);return '<a href="#/'+t[0]+'" '+(cur?'aria-current="page"':'')+'>'+App.icon(t[1])+'<span>'+t[2]+'</span></a>'}).join('');
}
App.navItems=navItems;App.GROUPS=GROUPS;
/* B1: модулі/права/сповіщення змінились → оновити меню, дзвіночок, таббар без перерендеру екрана */
var _shT;App.on('change',function(){clearTimeout(_shT);_shT=setTimeout(function(){if(App.cur)try{renderShell(App.cur.rt,App.cur.r)}catch(e){console.error(e)}},0)});

/* «Ще» (мобільний) */
App.route('more',{title:'Ще',render:function(v){var inTab=App.tabsFor(App.me().role).filter(Boolean).map(function(t){return t[0]});var items=navItems().filter(function(x){return inTab.indexOf(x.id)<0});var h='<div class="page"><div class="list" style="margin-bottom:16px"><button class="li" data-act="me">'+UI.av(App.me())+'<span class="t"><b>'+U.esc(App.me().n)+'</b><small>'+App.ROLES[App.me().role].n+' · '+U.esc(App.db.salon.name)+'</small></span>'+App.icon('right','s')+'</button><a class="li" href="#/notifications" style="text-decoration:none">'+App.icon('bell','l')+'<span class="t"><b>Сповіщення</b></span>'+App.icon('right','s')+'</a></div>';
  GROUPS.forEach(function(g){var its=items.filter(function(x){return (x.group||'work')===g[0]});if(!its.length)return;h+=(g[1]?'<div class="more-grp">'+g[1]+'</div>':'')+'<div class="list" style="margin-bottom:16px">'+its.map(function(it){return '<a class="li" href="#/'+it.id+'" style="text-decoration:none">'+App.icon(it.icon,'l')+'<span class="t"><b>'+((App.me().role==='master'&&MASTER_LBL[it.id])||it.title)+'</b></span>'+App.icon('right','s')+'</a>'}).join('')+'</div>'});
  v.innerHTML=h+'</div>'}});
App.route('denied',{title:'Немає доступу',render:function(v){v.innerHTML='<div class="page">'+UI.empty('lock','Цей розділ недоступний для вашої ролі','Попросіть власника салону відкрити доступ у Налаштування → Ролі.','<a class="btn" href="#/home" style="margin-top:8px">На головну</a>')+'</div>'}});

/* ───────── глобальні дії ───────── */
App.actions={
  online:function(){App.ops.set('settings.offline',false,'Звʼязок відновлено');UI.toast('Синхронізовано 3 зміни');App.render()},
  'alert-off':function(){App.ops.set('settings.alert.on',false,'Відбій тривоги');UI.toast('Відбій. Онлайн-запис знову працює');App.render()},
  'new-appt':function(){App.newAppt({})},
  me:function(e){var el=e&&e.target.closest('[data-act]')||U.$('#me');
    UI.menu(el,[{t:'Змінити роль (демо): Власник',ic:'key',fn:function(){App.switchRole('s0')}},{t:'Змінити роль: Адміністратор',ic:'user',fn:function(){App.switchRole('s1')}},{t:'Змінити роль: Майстер (Олена)',ic:'scissors',fn:function(){App.switchRole('m1')}},{t:'Змінити роль: Бухгалтер',ic:'coins',fn:function(){App.switchRole('s2')}},'-',
      {t:App.db.settings.offline?'Увімкнути звʼязок':'Симулювати: немає інтернету',ic:'wifioff',fn:function(){App.ops.set('settings.offline',!App.db.settings.offline);App.render()}},
      {t:App.db.settings.alert.on?'Відбій тривоги':'Симулювати: повітряна тривога',ic:'siren',fn:function(){App.ops.set('settings.alert.on',!App.db.settings.alert.on);App.render()}},'-',
      {t:'Підтримка',ic:'msg',fn:function(){UI.toast('Підтримка в Telegram — у робочій версії')}},'-',
      {t:'Скинути демо-дані',ic:'undo',dng:true,fn:function(){UI.confirm({title:'Скинути демо?',text:'Усі ваші зміни зникнуть, дані повернуться до початкових.',ok:'Скинути',danger:true}).then(function(y){if(y){App.reset();UI.toast('Демо скинуто')}})}}])},
  salon:function(e){UI.menu(e.target.closest('[data-act]'),[{t:App.db.salon.name+' · '+App.db.salon.city,ic:'check'},{t:'Додати філію',ic:'plus',fn:function(){UI.toast('Філії — у тарифі «Мережа»')}}])},
  search:function(){App.cmdk&&App.cmdk()}
};
/* міжмодульні точки входу — модулі ПЕРЕВИЗНАЧАЮТЬ ці заглушки */
['openAppt','newAppt','checkout','openClient','sellCert','sellAbon','sellProduct','addExpense','openStaff','openService','cmdk','bell','waitNew','moveAppt','closeDayWizard'].forEach(function(k){App[k]=function(){UI.toast('Модуль ще в роботі: '+k,{type:'err'})}});
App.switchRole=function(id){App.db.meId=id;App.save(true);var s=App.staff(id);UI.toast('Ви увійшли як '+App.ROLES[s.role].n.toLowerCase()+' — '+s.short);App.go('home')};
document.addEventListener('click',function(e){var a=e.target.closest('[data-act]');if(a&&App.actions[a.dataset.act]){e.preventDefault();App.actions[a.dataset.act](e)}});
document.addEventListener('keydown',function(e){
  if((e.metaKey||e.ctrlKey)&&(e.code==='KeyK'||e.key.toLowerCase()==='k')){e.preventDefault();App.cmdk&&App.cmdk()}
  if(e.key==='Escape'){if(UI._menu)return UI.closeMenu();var top=openStack[openStack.length-1];if(top)close(top)}
});

/* ───────── старт ───────── */
App.boot=function(){mountSprite();App.load();window.addEventListener('hashchange',function(){UI.closeAll();UI.closeMenu();App.render()});App.emit('boot');App.render()};
})();
