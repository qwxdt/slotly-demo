/* Slotly demo — модуль КАЛЕНДАР.
   Маршрут #/calendar?v=day|week|list&d=YYYY-MM-DD&m=staffId   (+ list: r=day|week|month, st, src, unpaid, q)
   Точки входу: App.openAppt(id), App.newAppt({staff,date,start,client,svc,items,wait,block}), App.checkout(id).
   Блок часу = запис { block:true, label, items:[], extra:<хвилини>, status:'confirmed' } — НЕ рахується у виторгу/клієнтах;
   інші модулі мають фільтрувати !a.block. */
(function(){
'use strict';
var U=App.u, D=App.d, UI=App.ui, $=U.$, $$=U.$$, esc=U.esc, I=App.icon, NB='\u00A0';
var ZOOMS=[.8,1,1.2,1.5,1.9,2.4];
var LS_Z='slotly-cal-zoom';
var S=App.cal={v:'day',d:App.today(),m:'',mobM:'',r:'day',st:'',src:'',unpaid:false,qq:'',showCancelled:false,view:null,sel:{},lim:120,scr:null,
  zoom:(function(){var z=+localStorage.getItem(LS_Z);return ZOOMS.indexOf(z)>=0?z:1.2})()};
var MOVABLE={new:1,confirmed:1,arrived:1};
var OFFKIND={vacation:'Відпустка',sick:'Лікарняний',personal:'Відсутня',training:'Навчання'};
var BLOCK_LABELS=['Перерва','Обід','Особиста справа','Навчання','Закупівля','Інше'];
function isMob(){return window.innerWidth<900}
function mods(){return App.db.settings.modules||{}}
function isBlock(a){return !!a.block}
function stepMin(){return Math.max(5,Math.min(30,+App.db.settings.booking.step||15))}
function tsNow(){return App.today()+'T'+U.hm(D.nowMin()).padStart(5,'0')}
function cl(id){return App.client(id)}
function cname(a){return a.block?(a.label||'Блок часу'):(a.client&&cl(a.client)?cl(a.client).n:'Без імені')}
function wdShort(d){return D.WDS[D.wd(d)]}
function dShort(d){return wdShort(d)+', '+D.parse(d).getDate()+' '+D.MONS[D.parse(d).getMonth()]}
function svcName(id){var s=App.svc(id);return s?s.n:id}
function mastersAll(){return App.masters()}
function hmp(m){return U.hm(m).padStart(5,'0')}
function canAll(){return App.can('calendar.all')}
function canPay(){return App.can('checkout')}
function depositPaid(a){return U.sum(App.apptPays(a).filter(function(p){return p.kind==='deposit'}),function(p){return p.amount})}
function paidSvc(a){return U.sum(App.apptPays(a).filter(function(p){return p.kind==='service'||p.kind==='cert'||p.kind==='abon'||p.kind==='refund'}),function(p){return p.amount})}
function apptsReal(date,sid){return App.apptsOn(date,sid).filter(function(a){return !isBlock(a)})}
function ruDur(m){return U.dur(m)}
function nbsp(s){return String(s).replace(/ /g,NB)}
/* ───────── делеговані дії ───────── */
function act(name,fn){App.actions['cal-'+name]=function(e){var el=e.target.closest('[data-act]');fn(el,e)}}
function conflictText(cs){
  return cs.map(function(c){return c.type==='overlap'?'Перетин із записом «'+cname(c.appt)+'» '+hmp(c.appt.start)+'–'+hmp(App.apptEnd(c.appt)):
    c.type==='dayoff'?'Майстер не працює в цей день':
    c.type==='hours'?'Поза робочим часом ('+hmp(c.wh.start)+'–'+hmp(c.wh.end)+')':'Потрапляє на перерву'});
}
function askConflict(cs,ok){
  return UI.confirm({title:'Записати попри зайнятість?',text:conflictText(cs).map(esc).join('<br>'),ok:ok||'Все одно записати'});
}
function toastErr(t){UI.toast(t,{type:'err'})}
/* клієнт, якого ще нема в базі: інлайн «Новий клієнт» у формі запису / листа очікування (без другої модалки) */
function ncSplit(v){v=(v||'').trim();var m=v.match(/\+?\d[\d\s()-]{5,}\d/),ph=m?m[0].replace(/\D/g,''):'';var n=m?(v.slice(0,m.index)+' '+v.slice(m.index+m[0].length)).replace(/\s+/g,' ').trim():v;return {n:n,ph:ph}}
function ncPending(st){if(st.client)return null;var s=st.nc||(st.cq&&st.cq.trim()?ncSplit(st.cq):null);if(!s)return null;
  var n=(s.n||'').trim(),ph=String(s.ph||'').replace(/\D/g,'');if(ph.length===10)ph='38'+ph;return n||ph?{n:n,ph:ph}:null}
function ncCommit(p){var dup=p.ph&&App.db.clients.find(function(x){return x.ph===p.ph});
  if(dup){UI.toast('Клієнт з таким телефоном уже є: '+esc(dup.n)+' — записано на нього',{ms:4000});return dup.id}
  var c=App.ops.upsertClient({n:p.n||U.phone(p.ph),ph:p.ph,bd:'',note:'',consent:{sms:true,promo:false}});UI.toast('Клієнта додано: '+esc(c.n));return c.id}
function clientField(box,st,onPick){
  function openNc(v){st.nc=ncSplit(v);st.cq='';draw();var f=box.querySelector(st.nc.ph&&!st.nc.n?'[data-nc=ph]':'[data-nc=n]');if(f)f.focus()}
  function draw(){
    if(st.nc){
      box.innerHTML='<div class="cal-nc"><div class="cal-nc-h"><b>Новий клієнт</b><button class="link" data-ncb>'+I('search','s')+'Шукати в базі</button></div>'+
        '<div class="grid2 m1"><label class="fld"><span>Імʼя</span><input class="inp" data-nc="n" autocomplete="off" placeholder="Напр. Оксана Бойко" value="'+esc(st.nc.n)+'"></label>'+
        '<label class="fld"><span>Телефон <small>(необовʼязково)</small></span><input class="inp" data-nc="ph" inputmode="tel" autocomplete="off" placeholder="+380" value="'+esc(st.nc.ph)+'"></label></div>'+
        '<small class="cal-nc-s">Додамо в базу клієнтів автоматично</small></div>';
      $$('[data-nc]',box).forEach(function(i){i.oninput=function(){st.nc[i.dataset.nc]=i.value}});
      box.querySelector('[data-ncb]').onclick=function(){st.cq=st.nc.n||st.nc.ph||'';st.nc=null;draw()};
      return}
    var q=UI.clientPicker(box,function(c){st.client=c.id;st.nc=null;st.cq='';onPick(c)});
    var res=box.querySelector('[data-res]'),slot=document.createElement('div');slot.className='list cal-ncr';q.parentNode.parentNode.insertBefore(slot,res);
    var orig=res.onclick;res.onclick=function(e){if(e.target.closest('[data-new]'))return openNc(q.value);return orig.call(this,e)};
    slot.onclick=function(e){if(e.target.closest('[data-new]'))openNc(q.value)};
    function upd(){st.cq=q.value;slot.innerHTML='';var nb=res.querySelector('[data-new]');
      if(q.value.trim()&&nb&&res.querySelectorAll('[data-c]').length<=3)slot.appendChild(nb);slot.hidden=!slot.firstChild}
    q.addEventListener('input',upd);if(st.cq){q.value=st.cq;q.oninput()}upd();
  }
  draw();
}

/* ───────── додаткові операції (за зразком App.ops) ───────── */
App.ops.createBlock=function(o){
  var a={id:U.uid('a'),staff:o.staff,date:o.date,start:o.start,items:[],extra:o.dur,client:null,status:'confirmed',src:'admin',note:o.note||'',deposit:0,discount:null,block:true,label:o.label||'Блок часу',created:tsNow(),events:[{ts:tsNow(),who:App.db.meId,txt:'Створено блок часу'}],res:null};
  App.db.appts.push(a);App.log('create','appt:'+a.id,'Блок часу «'+a.label+'», '+D.shortH(a.date)+' '+hmp(a.start));App.save();return a;
};
App.ops.restoreAppt=function(a,pays){
  if(!App.appt(a.id))App.db.appts.push(a);
  (pays||[]).forEach(function(p){if(!App.db.payments.find(function(x){return x.id===p.id}))App.db.payments.push(p)});
  App.log('restore','appt:'+a.id,'Відновлено запис '+D.shortH(a.date)+' '+hmp(a.start));App.save();return a;
};
App.ops.setDayNote=function(date,txt){
  if(txt)App.db.dayNotes[date]=txt;else delete App.db.dayNotes[date];
  App.log('edit','day:'+date,'Нотатка дня '+D.shortH(date));App.save();
};
App.ops.setWaitlist=function(w){
  var arr=App.db.waitlist;var i=arr.findIndex(function(x){return x.id===w.id});
  if(i>=0)arr[i]=w;else arr.push(w);App.log('edit','wait:'+w.id,'Лист очікування');App.save();return w;
};
App.ops.removeWaitlist=function(id){
  App.db.waitlist=App.db.waitlist.filter(function(x){return x.id!==id});App.log('delete','wait:'+id,'Видалено з листа очікування');App.save();
};
App.ops.setStatusBulk=function(ids,st){
  ids.forEach(function(id){var a=App.appt(id);if(a&&a.status!==st&&!a.block){a.status=st;(a.events=a.events||[]).push({ts:tsNow(),who:App.db.meId,txt:'Статус: → '+App.ST[st].n+' (масово)'})}});
  App.log('status','bulk',ids.length+' записів → '+App.ST[st].n);App.save();
};

/* ───────── статистика ───────── */
function dayStats(date,sid){
  var wh=App.workHours(sid,date);
  var all=App.apptsOn(date,sid);
  var as=all.filter(function(a){return !isBlock(a)&&App.active(a)});
  var blocked=U.sum(all.filter(function(a){return isBlock(a)}),App.apptDur);
  var cap=0;if(wh)cap=Math.max(0,wh.end-wh.start-(wh.brk?wh.brk[1]-wh.brk[0]:0)-blocked);
  var live=as.filter(function(a){return a.status!=='noshow'});
  var booked=U.sum(live,App.apptDur);
  var done=as.filter(function(a){return a.status==='done'});
  return {wh:wh,cap:cap,booked:booked,pct:cap?Math.min(100,Math.round(booked/cap*100)):0,n:as.length,
    plan:U.sum(live,App.apptTotal),earned:U.sum(done,App.apptTotal)};
}
function firstVisitMap(){
  var m={};
  App.db.appts.forEach(function(a){if(!a.client||isBlock(a)||a.status==='cancelled')return;var k=a.date+String(a.start).padStart(4,'0');if(!m[a.client]||k<m[a.client].k)m[a.client]={k:k,id:a.id}});
  return m;
}
function bdOn(date){var md=date.slice(5);return App.db.clients.filter(function(c){return c.bd&&c.bd.slice(5)===md})}
function loadClass(p){return p>=85?4:p>=65?3:p>=40?2:p>0?1:0}
function statusCls(s){return s==='new'?'new':s==='confirmed'?'ok':s==='arrived'?'here':s==='done'?'paid':s==='noshow'?'noshow':'cancel'}
function unpaidFlag(a){
  if(isBlock(a)||a.status==='cancelled'||a.status==='noshow')return false;
  if(a.status==='done')return App.apptDue(a)>0;
  if(a.status==='arrived')return true;
  return false;
}
function visibleMasters(){
  var ms=mastersAll();
  if(!canAll())return ms.filter(function(m){return m.id===App.db.meId});
  return ms;
}
function srcIcon(s){return s==='tg'?'tg':s==='phone'?'phone':s==='online'?'globe':s==='ig'?'heart':s==='walkin'?'door':'user'}

/* ───────── стан з URL ───────── */
var LS_V='slotly-cal-view';
function readQ(q){
  var lv=localStorage.getItem(LS_V);
  S.v=q.v||(lv==='week'||lv==='list'?lv:'day');
  if(['day','week','list'].indexOf(S.v)<0)S.v='day';
  S.d=/^\d{4}-\d{2}-\d{2}$/.test(q.d||'')?q.d:App.today();
  S.m=q.m||'';
  if(!canAll())S.m=App.db.meId;
  if(S.m&&!App.staff(S.m))S.m='';
  if(q.r)S.r=q.r;
  S.st=q.st||'';S.src=q.src||'';S.unpaid=q.unpaid==='1';S.qq=q.q||'';
  S.showCancelled=q.xc==='1';
  S.showOff=q.off==='1';
  S.move=q.move&&App.appt(q.move)&&!App.appt(q.move).block?q.move:'';
  if(S.move)S.v='day';
  if(!q.v&&!q.d&&!q.m)S.fromTab=true;
}
function go(patch,replace){
  var q={v:S.v,d:S.d,m:S.m,r:S.v==='list'?S.r:'',st:S.st,src:S.src,unpaid:S.unpaid?1:'',q:S.qq,xc:S.showCancelled?1:'',off:S.showOff?1:'',move:S.move||''};
  Object.assign(q,patch);
  if(q.v==='day')q.v='';
  if(q.d===App.today())q.d='';
  App.setQ(q,replace);
}
function stepDays(){return S.v==='week'?7:S.v==='list'?(S.r==='week'?7:S.r==='month'?0:1):1}
function shiftDate(dir){
  if(S.v==='list'&&S.r==='month')return D.addMonths(S.d,dir);
  return D.add(S.d,dir*stepDays());
}
function rangeLabel(){
  var d=S.d;
  if(S.v==='week'||(S.v==='list'&&S.r==='week')){var a=D.weekStart(d),b=D.add(a,6);var pa=D.parse(a),pb=D.parse(b);
    return pa.getMonth()===pb.getMonth()?pa.getDate()+'–'+pb.getDate()+' '+D.MONS[pb.getMonth()]+' '+pb.getFullYear():pa.getDate()+' '+D.MONS[pa.getMonth()]+' – '+pb.getDate()+' '+D.MONS[pb.getMonth()]}
  if(S.v==='list'&&S.r==='month'){return D.MONN[D.parse(d).getMonth()]+' '+D.parse(d).getFullYear()}
  var rel=D.rel(d);var t=D.WD[D.wd(d)]+', '+D.human(d);
  return t;
}
function dayRelTag(){var n=D.diff(App.today(),S.d);return n===0?'сьогодні':n===1?'завтра':n===-1?'вчора':''}

/* ───────── панель інструментів (верхня панель) ───────── */
function topHtml(){
  var isDay=S.v==='day';
  var h='<div class="cal-tb">';
  h+='<div class="cal-nav"><button class="icobtn sm" data-act="cal-prev" aria-label="Назад" title="Назад (←)">'+I('left')+'</button>'+
     '<button class="btn sm" data-act="cal-today" title="Сьогодні (T)">Сьогодні</button>'+
     '<button class="icobtn sm" data-act="cal-next" aria-label="Далі" title="Далі (→)">'+I('right')+'</button></div>';
  h+='<label class="cal-date" title="Обрати дату">'+I('cal','s')+'<span>'+esc(rangeLabel())+'</span>'+(dayRelTag()&&isDay?'<em>'+dayRelTag()+'</em>':'')+'<input type="date" value="'+S.d+'" data-cal-pick aria-label="Обрати дату"></label>';
  h+='<div class="seg" role="tablist">'+[['day','День'],['week','Тиждень'],['list','Список']].map(function(x){return '<button data-act="cal-view" data-v="'+x[0]+'" aria-pressed="'+(S.v===x[0])+'">'+x[1]+'</button>'}).join('')+'</div>';
  h+='<span class="sp"></span>';
  if(canAll()&&S.v!=='list'){var ms=visibleMasters();
    h+='<label class="cal-msel">'+I('user','s')+'<select class="sel" data-cal-m aria-label="Майстер"><option value="">Усі майстри</option>'+ms.map(function(m){return '<option value="'+m.id+'"'+(S.m===m.id?' selected':'')+'>'+esc(m.short)+'</option>'}).join('')+'</select></label>';}
  if(S.v!=='list')h+='<div class="cal-zoom" title="Масштаб"><button class="icobtn sm" data-act="cal-zoom" data-z="-1" aria-label="Зменшити">'+I('minus','s')+'</button><button class="icobtn sm" data-act="cal-zoom" data-z="1" aria-label="Збільшити">'+I('plus','s')+'</button></div>';
  h+='<button class="icobtn sm" data-act="cal-more-menu" aria-label="Ще" title="Вид, друк, CSV">'+I('more')+'</button></div>';
  return h;
}
function mobBarHtml(){
  var h='<div class="cal-mbar"><div class="cal-mnav">';
  h+='<button class="icobtn" data-act="cal-prev" aria-label="Назад">'+I('left')+'</button>';
  h+='<label class="cal-mdate"><b>'+esc(S.v==='day'?dShort(S.d):rangeLabel())+'</b><small>'+(S.v==='day'?(dayRelTag()||D.parse(S.d).getFullYear()):'')+'</small><input type="date" value="'+S.d+'" data-cal-pick aria-label="Обрати дату"></label>';
  h+='<button class="icobtn" data-act="cal-next" aria-label="Далі">'+I('right')+'</button>';
  h+='<button class="btn sm" data-act="cal-today">Сьогодні</button></div>';
  h+='<div class="seg cal-mseg">'+[['day','День'],['week','Тиждень'],['list','Список']].map(function(x){return '<button data-act="cal-view" data-v="'+x[0]+'" aria-pressed="'+(S.v===x[0])+'">'+x[1]+'</button>'}).join('')+'</div></div>';
  return h;
}
function mobChips(){
  var ms=visibleMasters();
  if(ms.length<2&&!canAll())return '';
  var cur=S.mobM;
  var h='<div class="cal-chips hscroll" role="tablist">';
  if(S.v!=='day'&&canAll())h+='<button class="chip" data-act="cal-mchip" data-m="" aria-pressed="'+(!cur)+'">Усі</button>';
  else if(S.v==='day'&&canAll()&&ms.length>1)h+='<button class="chip" data-act="cal-mchip" data-m="*" aria-pressed="'+(cur==='*')+'">Усі</button>';
  ms.forEach(function(m){
    var st=S.v==='day'?dayStats(S.d,m.id):null;
    var off=S.v==='day'&&!st.wh;
    h+='<button class="chip'+(off?' is-off':'')+'" data-act="cal-mchip" data-m="'+m.id+'" aria-pressed="'+(cur===m.id)+'">'+App.ui.av(m,'xs')+esc(m.short.split(' ')[0])+(st&&st.n?'<span class="cnt">'+st.n+'</span>':'')+'</button>';
  });
  return h+'</div>';
}

/* ───────── роут ───────── */
App.route('calendar',{title:'Календар',icon:'cal',nav:true,group:'work',order:2,perm:'calendar.all',permAlt:'calendar.own',
  count:function(){
    if(!canAll())return '';
    var T=App.today(),T1=D.add(T,1);
    var n=App.db.appts.filter(function(a){return (a.date===T||a.date===T1)&&a.status==='new'&&!a.block}).length;
    return n||'';
  },countDot:true,
  render:function(view,params,q){
    var old=$('.cal-wrap',view);
    if(old)S.scr={t:old.scrollTop,l:old.scrollLeft};
    readQ(q);
    if(S.v==='day'&&isMob()){
      var ms=visibleMasters();
      if(!canAll())S.mobM=App.db.meId;
      else if(S.m)S.mobM=S.m;
      else if(S.mobM==='*'){}
      else if(!S.mobM||!ms.find(function(m){return m.id===S.mobM})){
        var w=ms.find(function(m){return App.workHours(m.id,S.d)});S.mobM=(w||ms[0]||{}).id||'';
      }
    }else if(isMob()){
      if(S.m)S.mobM=S.m;else if(!canAll())S.mobM=App.db.meId;else if(S.v==='list')S.mobM='';
      else if(S.v==='week'&&!S.mobM)S.mobM='';
    }
    if(S.v==='list'&&!q.r)S.r=S.r||'day';
    if(!isMob())localStorage.setItem(LS_V,S.v);
    App.setTop(isMob()?'<button class="icobtn" data-act="cal-sidebtn" aria-label="Зведення" title="Зведення дня">'+I('chart')+'</button><button class="icobtn" data-act="cal-more-menu" aria-label="Ще">'+I('more')+'</button>':topHtml());
    view.innerHTML='<div class="cal cal-v-'+S.v+(S.move?' is-move':'')+'">'+(isMob()?mobBarHtml()+mobChips():'')+(S.move?moveBarHtml():'')+
      (S.v==='day'?dayHtml():S.v==='week'?weekHtml():listHtml())+
      '</div>';
    afterRender(view);
  }
});
var _rt=null;
App.on('change',function(){
  if(!App.cur||App.cur.rt.id!=='calendar')return;
  clearTimeout(_rt);_rt=setTimeout(function(){if(App.cur&&App.cur.rt.id==='calendar')App.refresh()},0);
});

/* ───────── сітка (спільна для «День» і «Тиждень → майстер») ───────── */
function ppmNow(){return isMob()?1.55:S.zoom}
/* колонка: {key,staff,date,head,wh,off} */
function colRange(cols){
  var lo=1e9,hi=-1;
  cols.forEach(function(c){
    if(c.wh){lo=Math.min(lo,c.wh.start);hi=Math.max(hi,c.wh.end)}
    App.apptsOn(c.date,c.staff).forEach(function(a){if(a.status==='cancelled'&&!S.showCancelled)return;lo=Math.min(lo,a.start);hi=Math.max(hi,App.apptEnd(a))});
  });
  if(hi<0){var h=App.db.salon.hours[D.wd(cols[0]?cols[0].date:S.d)]||[540,1200];lo=h[0];hi=h[1]}
  lo=Math.max(0,Math.floor((lo-30)/60)*60);hi=Math.min(1440,Math.ceil((hi+15)/60)*60);
  if(hi-lo<360)hi=Math.min(1440,lo+360);
  return [lo,hi];
}
function lanes(list){
  /* кластери перекриттів → lane index + кількість lane */
  var out={},cl=[],end=-1,cur=[];
  list.slice().sort(function(a,b){return a.start-b.start||App.apptEnd(b)-App.apptEnd(a)}).forEach(function(a){
    if(cur.length&&a.start>=end){cl.push(cur);cur=[];end=-1}
    cur.push(a);end=Math.max(end,App.apptEnd(a));
  });
  if(cur.length)cl.push(cur);
  cl.forEach(function(c){
    var ends=[];
    c.forEach(function(a){var l=0;while(ends[l]!==undefined&&ends[l]>a.start)l++;ends[l]=App.apptEnd(a);out[a.id]={l:l,n:0}});
    c.forEach(function(a){out[a.id].n=ends.length});
  });
  return out;
}
var RISK_IC={new:['star',''],unconf:['clock','warn'],debt:['cash','dng'],late:['ban','dng'],allergy:['alert','warn']};
function needDeposit(a){return !a.block&&a.deposit>0&&!depositPaid(a)&&(a.status==='new'||a.status==='confirmed')}
function risksHtml(a,big){
  if(a.block)return '<span class="risk">'+I('lock')+'</span>';
  var r=App.apptRisks(a),h='';
  r.forEach(function(x){var m=RISK_IC[x.k]||['info',''];h+='<span title="'+esc(x.t)+'">'+I(m[0],m[1])+'</span>'});
  if(needDeposit(a))h+='<span title="Очікує передоплати '+esc(U.uah(a.deposit))+'">'+I('shield','warn')+'</span>';
  if(a.status==='done'&&App.apptDue(a)<=0)h+='<span class="cal-paid" title="Оплачено">'+I('check')+'</span>';
  else if(unpaidFlag(a))h+='<span title="Не оплачено">'+I('cash','dng')+'</span>';
  return h?'<span class="risk">'+h+'</span>':'';
}
function iconsFor(a,fv){return risksHtml(a)}
function apptBlockHtml(a,lo,ppm,fv,ln){
  var top=(a.start-lo)*ppm,dur=App.apptDur(a),h=Math.max(16,dur*ppm);
  var cls='cal-ap st-'+statusCls(a.status)+(a.block?' is-block':'')+(MOVABLE[a.status]&&!isMob()?' can-drag':'')+(isLate(a)?' is-late':'')+(unpaidFlag(a)?' is-unpaid':'')+(a.status==='cancelled'?' is-cx':'')+(S.move===a.id?' is-moving':'');
  var size=h<40?'s1':h<62?'s2':h<84?'s3':'s4';
  var w=100/ln.n,left=ln.l*w;
  var st='top:'+(top+1).toFixed(1)+'px;height:'+(h-2).toFixed(1)+'px;left:calc('+left+'% + 2px);width:calc('+w+'% - 4px)';
  var tm=hmp(a.start)+(size==='s1'?'':'–'+hmp(App.apptEnd(a)));
  var title=a.block?(a.label||'Блок часу'):cname(a);
  var sv=a.block?(a.note||''):App.apptTitle(a);
  var inner='<div class="l1"><span class="tm">'+tm+'</span><span class="ic">'+iconsFor(a,fv)+'</span></div>'+
    '<div class="l2">'+esc(title)+(size==='s1'&&dur>=45?'<span class="s1sv"> · '+esc(sv)+'</span>':'')+'</div>'+
    (size!=='s1'&&(dur>=45||a.block)&&sv?'<div class="l3">'+esc(sv)+'</div>':'');
  if(dur>=90&&!isMob()&&!a.block&&a.client&&App.canSeePhone()){var c=cl(a.client);if(c&&c.ph)inner+='<div class="l4">'+esc(App.phoneOf(c))+'</div>'}
  return '<div class="'+cls+' '+size+'" data-id="'+a.id+'" style="'+st+'" tabindex="0" role="button" aria-label="'+esc(title+', '+tm)+'">'+inner+(MOVABLE[a.status]&&!isMob()?'<i class="cal-rs" title="Змінити тривалість"></i>':'')+'</div>';
}
function gapsFor(col,lo,ppm){
  /* вільні проміжки ≥45 хв у межах графіка (для майбутнього) */
  if(!col.wh||col.date<App.today())return '';
  var T=App.today();
  var from=col.wh.start,to=col.wh.end;
  if(col.date===T)from=Math.max(from,Math.ceil(D.nowMin()/15)*15);
  var busy=[];
  App.apptsOn(col.date,col.staff).forEach(function(a){if(App.active(a))busy.push([a.start,App.apptEnd(a)])});
  if(col.wh.brk)busy.push(col.wh.brk.slice());
  busy.sort(function(a,b){return a[0]-b[0]});
  var gaps=[],cur=from;
  busy.forEach(function(b){if(b[0]>cur)gaps.push([cur,Math.min(b[0],to)]);cur=Math.max(cur,b[1])});
  if(cur<to)gaps.push([cur,to]);
  var html='';
  gaps.forEach(function(g){
    var len=g[1]-g[0];if(len<45)return;
    html+='<div class="cal-gap" style="top:'+((g[0]-lo)*ppm+1)+'px;height:'+(len*ppm-2)+'px"><button data-act="cal-gap" data-staff="'+col.staff+'" data-date="'+col.date+'" data-start="'+g[0]+'" data-len="'+len+'">вільно '+nbsp(U.dur(len))+'</button></div>';
  });
  return html;
}
function nbsp(s){return String(s).replace(/ /g,NB)}
function offHtml(col,lo,hi,ppm){
  var h='';
  if(!col.wh){
    var lbl=col.off?col.off.label:'Вихідний';
    return '<div class="cal-off all" style="top:0;height:'+((hi-lo)*ppm)+'px"><span>'+esc(lbl)+'</span></div>';
  }
  if(col.wh.start>lo)h+='<div class="cal-off" style="top:0;height:'+((col.wh.start-lo)*ppm)+'px"></div>';
  if(col.wh.end<hi)h+='<div class="cal-off" style="top:'+((col.wh.end-lo)*ppm)+'px;height:'+((hi-col.wh.end)*ppm)+'px"></div>';
  if(col.wh.brk)h+='<div class="cal-off brk" style="top:'+((col.wh.brk[0]-lo)*ppm)+'px;height:'+((col.wh.brk[1]-col.wh.brk[0])*ppm)+'px"><span>Перерва '+hmp(col.wh.brk[0])+'–'+hmp(col.wh.brk[1])+'</span></div>';
  return h;
}
function gridHtml(cols,o){
  o=o||{};
  var rg=colRange(cols),lo=rg[0],hi=rg[1],ppm=ppmNow(),T=App.today(),nowM=D.nowMin();
  var fv=firstVisitMap(),step=stepMin();
  var H=(hi-lo)*ppm;
  var head='<div class="cal-hd"><div class="cal-axh"></div>'+cols.map(function(c){return c.head}).join('')+'</div>';
  var axis='<div class="cal-axis">';
  for(var t=lo;t<=hi;t+=60){axis+='<span style="top:'+((t-lo)*ppm)+'px">'+(t/60%24)+':00</span>'}
  if(ppm>=1.4)for(var t2=lo+30;t2<hi;t2+=60)axis+='<span class="half" style="top:'+((t2-lo)*ppm)+'px">:30</span>';
  var showNow=cols.some(function(c){return c.date===T})&&nowM>=lo&&nowM<=hi;
  if(showNow)axis+='<b class="cal-nowlbl" style="top:'+((nowM-lo)*ppm)+'px">'+hmp(nowM)+'</b>';
  axis+='</div>';
  var body='';
  cols.forEach(function(c){
    var list=App.apptsOn(c.date,c.staff).filter(function(a){return S.showCancelled||a.status!=='cancelled'});
    var ln=lanes(list);
    var a=c.date===T&&showNow?'<div class="cal-now" style="top:'+((nowM-lo)*ppm)+'px"></div>':'';
    body+='<div class="cal-col'+(c.date===T?' is-today':'')+(c.date<T?' is-past':'')+'" data-staff="'+c.staff+'" data-date="'+c.date+'" style="height:'+H+'px">'+offHtml(c,lo,hi,ppm)+(S.move?moveZones(c,lo,ppm):gapsFor(c,lo,ppm))+
      list.map(function(x){return apptBlockHtml(x,lo,ppm,fv,ln[x.id])}).join('')+a+'</div>';
  });
  var minW=o.minCol||(isMob()?(S.v==='day'&&S.mobM==='*'&&cols.length>1?(window.innerWidth<360?132:110):0):160);
  return '<div class="cal-wrap" data-lo="'+lo+'" data-hi="'+hi+'" data-ppm="'+ppm+'" data-step="'+step+'" style="--ppm:'+ppm+';--step:'+(step*ppm)+'px;--n:'+cols.length+';--cw:'+minW+'px">'+
    '<div class="cal-gridin">'+head+'<div class="cal-bd" style="height:'+H+'px">'+axis+body+'</div></div></div>';
}
function masterHead(m,date){
  var st=dayStats(date,m.id),lv=App.level(m.lvl);
  var T=App.today();
  var sum=date<=T?st.earned:st.plan;
  var off=App.timeOff(m.id,date);
  var sub=!st.wh?(off?(OFFKIND[off.kind]||'Відсутня'):'Вихідний'):(lv?lv.n:m.spec);
  return '<button class="cal-mh'+(st.wh?'':' is-off')+'" data-act="cal-mhead" data-m="'+m.id+'" title="Тиждень: '+esc(m.n)+'">'+
    '<span class="r1">'+UI.av(m,'')+(function(){var n=waitCountFor(m.id,date);return n?'<span class="cal-wn" title="'+n+' '+U.plural(n,'клієнт чекає','клієнти чекають','клієнтів чекають')+' вікна">'+n+'</span>':''})()+'<span class="t"><b class="ell">'+esc(m.short)+'</b><small class="ell">'+esc(sub)+(st.n?' · '+st.n+' '+U.plural(st.n,'запис','записи','записів'):'')+'</small></span></span>'+
    (st.wh?'<span class="cal-load" title="Завантаження '+st.pct+'%"><i style="width:'+st.pct+'%"></i></span><span class="cal-mh-f"><span>'+st.pct+'%</span><span title="'+(date<=T?'Виторг':'Заплановано')+'">'+(sum?U.uah(sum):'—')+'</span></span>':'<span class="cal-load"></span><span class="cal-mh-f"><span>'+(off&&off.note?esc(off.note):'')+'</span></span>')+'</button>';
}
function dayCols(){
  var ms=visibleMasters(),date=S.d,cols=[];
  var mall=isMob()&&S.mobM==='*';
  if(isMob()&&!mall){ms=ms.filter(function(m){return m.id===S.mobM})}
  else if(S.m)ms=ms.filter(function(m){return m.id===S.m});
  ms.forEach(function(m){
    var wh=App.workHours(m.id,date),has=App.apptsOn(date,m.id).some(function(a){return S.showCancelled||a.status!=='cancelled'});
    var explicit=S.m||(isMob()&&!mall);
    if(!wh&&!has&&!explicit&&!S.showOff)return;
    var off=App.timeOff(m.id,date);
    cols.push({key:m.id,staff:m.id,date:date,wh:wh,off:off?{label:(OFFKIND[off.kind]||'Відсутня')+(off.note&&off.note!==OFFKIND[off.kind]?' · '+off.note:'')}:null,head:masterHead(m,date)});
  });
  return cols;
}
function offStrip(){
  var ms=visibleMasters().filter(function(m){return !App.workHours(m.id,S.d)&&(!S.m||S.m===m.id)});
  if(!ms.length||isMob())return '';
  return ms.map(function(m){var off=App.timeOff(m.id,S.d);return esc(m.short.split(' ')[0])+' <span class="mute">— '+(off?(OFFKIND[off.kind]||'відсутня').toLowerCase():'вихідний')+'</span>'}).join(' · ');
}
function noteStripHtml(){
  var t=App.db.dayNotes[S.d]||'';
  return '<div class="cal-daynote'+(t?' has':'')+'" data-act="cal-note">'+I('note','s')+'<span class="txt">'+(t?esc(t):'Нотатка до дня — наприклад, «Олена до 14:00 на навчанні»')+'</span><button class="btn ghost sm cal-noteedit" tabindex="-1">'+(t?'Змінити':'Додати')+'</button></div>';
}
function subHtml(){
  var ms=visibleMasters();
  var h='<div class="cal-sub">';
  var strip=S.v==='day'?offStrip():'';
  h+='<span class="cal-offs">'+(strip?I('coffee','s')+' '+strip:'')+'</span><span class="sp"></span>';
  h+='<button class="chip" data-act="cal-xc" aria-pressed="'+S.showCancelled+'">'+(S.showCancelled?'Сховати скасовані':'Показати скасовані')+'</button>';
  if(S.v==='day')h+='<button class="chip cal-sidebtn" data-act="cal-sidebtn">'+I('chart','s')+'Зведення</button>';
  return h+'</div>';
}
function dayHtml(){
  var cols=dayCols(),h='';
  if(!isMob())h+=subHtml();
  h+=noteStripHtml();
  h+='<div class="cal-main"><div class="cal-center">';
  if(!cols.length){
    h+='<div class="cal-emptyday">'+UI.empty('cal','Сьогодні ніхто не працює','Вихідний або всі майстри у відпустці. Можна додати запис вручну.','<div class="row" style="margin-top:8px"><button class="btn" data-act="cal-showoff">Показати всіх майстрів</button><button class="btn pri" data-act="cal-new">Новий запис</button></div>')+'</div>';
  }else h+=gridHtml(cols);
  h+='</div><aside class="cal-side">'+panelHtml(S.d)+'</aside></div>';
  return h;
}

/* ───────── права панель: зведення дня + лист очікування ───────── */
function panelHtml(date){
  var T=App.today(),ms=S.m?[App.staff(S.m)]:visibleMasters();
  var ids=ms.map(function(m){return m.id});
  var as=App.apptsOn(date).filter(function(a){return !isBlock(a)&&ids.indexOf(a.staff)>=0});
  var act=as.filter(App.active);
  var live=act.filter(function(a){return a.status!=='noshow'});
  var plan=U.sum(live,App.apptTotal);
  var mon=App.money(date,date,S.m||undefined);
  var rev=canAll()?(S.m?mon.revenue:App.money(date,date).revenue):mon.revenue;
  var done=act.filter(function(a){return a.status==='done'});
  var paidAmt=U.sum(live,paidSvc);
  var unpaid=live.filter(function(a){return a.status==='arrived'||(a.status==='done'&&App.apptDue(a)>0)});
  var unpaidSum=U.sum(unpaid,function(a){return a.status==='done'?App.apptDue(a):App.apptTotal(a)-paidSvc(a)});
  var unconf=live.filter(function(a){return a.status==='new'});
  var cap=0,bk=0;ms.forEach(function(m){var s=dayStats(date,m.id);cap+=s.cap;bk+=s.booked});
  var pct=cap?Math.min(100,Math.round(bk/cap*100)):0;
  var h='<div class="cal-pn"><section><h4>Зведення · '+esc(D.shortH(date))+'</h4>'+
    '<div class="cal-kp"><div><b>'+act.length+'</b><small>'+U.plural(act.length,'запис','записи','записів')+'</small></div><div><b>'+U.uah(rev)+'</b><small>'+(date>T?'очікується '+U.uah(plan):'виторг')+'</small></div></div>'+
    '<dl class="dl cal-dl"><dt>Заплановано</dt><dd>'+U.uah(plan)+'</dd><dt>Оплачено</dt><dd>'+U.uah(paidAmt)+'</dd>'+
    '<dt>Не оплачено</dt><dd class="'+(unpaidSum?'warn-t':'')+'">'+(unpaidSum?U.uah(unpaidSum):'—')+'</dd>'+
    '<dt>Завантаження</dt><dd>'+pct+'%</dd>'+(done.length?'<dt>Середній чек</dt><dd>'+U.uah(Math.round(U.sum(done,App.apptTotal)/done.length))+'</dd>':'')+
    (act.length!==as.length?'<dt>Не прийшли/скасовано</dt><dd>'+(as.length-act.length+act.filter(function(a){return a.status==='noshow'}).length)+'</dd>':'')+'</dl></section>';
  if(unconf.length){
    h+='<section><h4>Не підтверджені <span class="pill-n">'+unconf.length+'</span><span class="sp"></span><button class="link" data-act="cal-confirm-all" data-date="'+date+'">Підтвердити всі</button></h4><div class="cal-ul">'+
      unconf.slice(0,8).map(function(a){return '<button class="cal-ur" data-act="cal-open" data-id="'+a.id+'"><span class="tm">'+hmp(a.start)+'</span><span class="ell">'+esc(cname(a))+'</span><small>'+esc(App.staff(a.staff).short.split(' ')[0])+'</small></button>'}).join('')+
      (unconf.length>8?'<div class="mute" style="font-size:12px;padding:4px 0">ще '+(unconf.length-8)+'…</div>':'')+'</div></section>';
  }
  if(unpaid.length&&date<=T){
    h+='<section><h4>До оплати <span class="pill-n">'+unpaid.length+'</span></h4><div class="cal-ul">'+unpaid.slice(0,6).map(function(a){return '<button class="cal-ur" data-act="cal-open" data-id="'+a.id+'"><span class="tm">'+hmp(a.start)+'</span><span class="ell">'+esc(cname(a))+'</span><small>'+U.uah(a.status==='done'?App.apptDue(a):App.apptTotal(a)-paidSvc(a))+'</small></button>'}).join('')+'</div></section>';
  }
  var bd=bdOn(date);
  if(bd.length){
    h+='<section><h4>Дні народження</h4><div class="cal-ul">'+bd.slice(0,6).map(function(c){var age=c.bd&&+c.bd.slice(0,4)?D.parse(date).getFullYear()-(+c.bd.slice(0,4)):'';
      return '<button class="cal-ur" data-act="cal-client" data-id="'+c.id+'">'+I('cake','s')+'<span class="ell">'+esc(c.n)+'</span><small>'+(age?age+' '+U.plural(age,'рік','роки','років'):'')+'</small></button>'}).join('')+'</div></section>';
  }
  if(mods().waitlist!==false&&canAll()){
    var wl=App.db.waitlist.filter(function(w){return (w.status||'wait')==='wait'}).sort(function(a,b){return a.created<b.created?-1:1});
    h+='<section><h4>Лист очікування <span class="pill-n">'+wl.length+'</span><span class="sp"></span><button class="link" data-act="cal-wl-add">+ Додати</button></h4>';
    if(!wl.length)h+='<div class="mute" style="font-size:13px">Порожньо. Додайте клієнта, якщо немає вільного вікна — система підкаже, коли воно зʼявиться.</div>';
    else h+='<div class="cal-wl">'+wl.map(function(w){var c=cl(w.client),sv=App.svc(w.svc),st=w.staff&&App.staff(w.staff);
      return '<div class="cal-wi"><div class="t"><b class="ell">'+esc(c?c.n:'Без імені')+'</b><small class="ell">'+esc(sv?sv.n:'будь-яка послуга')+' · '+esc(st?st.short.split(' ')[0]:'будь-хто')+'</small><small class="ell">'+esc(D.shortH(w.from)+(w.to!==w.from?' – '+D.shortH(w.to):''))+(w.note?' · '+esc(w.note):'')+'</small></div>'+
        '<div class="row" style="gap:4px"><button class="btn sm" data-act="cal-wl-find" data-id="'+w.id+'">Знайти вікно</button><button class="icobtn sm ghost" data-act="cal-wl-del" data-id="'+w.id+'" aria-label="Видалити">'+I('x','s')+'</button></div></div>'}).join('')+'</div>';
    h+='</section>';
  }
  return h+'</div>';
}

/* ───────── ТИЖДЕНЬ ───────── */
function miniStrip(date,sid){
  var wh=App.workHours(sid,date);if(!wh)return '';
  var lo=wh.start,len=wh.end-wh.start;
  return '<span class="cal-strip">'+App.apptsOn(date,sid).filter(function(a){return App.active(a)&&a.status!=='noshow'}).map(function(a){
    var l=Math.max(0,(a.start-lo)/len*100),w=Math.min(100-l,App.apptDur(a)/len*100);
    return '<i class="'+(isBlock(a)?'bl':'')+'" style="left:'+l.toFixed(1)+'%;width:'+w.toFixed(1)+'%"></i>'}).join('')+'</span>';
}
function weekHtml(){
  var ws=D.weekStart(S.d),days=D.range(ws,D.add(ws,6)),T=App.today();
  var ms=visibleMasters();
  var sel=isMob()?S.mobM:S.m;
  var h='';
  if(!isMob())h+=subHtml();
  h+='<div class="cal-main"><div class="cal-center">';
  if(sel){
    var m=App.staff(sel);
    if(isMob()){
      h+='<div class="cal-wkl">'+days.map(function(d){var st=dayStats(d,sel);var lc=loadClass(st.pct);
        return '<button class="cal-wd'+(d===T?' is-today':'')+(st.wh?'':' is-off')+'" data-act="cal-day" data-d="'+d+'" data-m="'+sel+'"><span class="d"><b>'+D.parse(d).getDate()+'</b><small>'+wdShort(d)+'</small></span><span class="c">'+
          (st.wh?'<span class="n">'+st.n+' '+U.plural(st.n,'запис','записи','записів')+(st.plan?' · '+U.uah(st.plan):'')+'</span>'+miniStrip(d,sel)+'<span class="hh">'+hmp(st.wh.start)+'–'+hmp(st.wh.end)+' · '+st.pct+'%</span>':'<span class="n mute">'+(App.timeOff(sel,d)?(OFFKIND[App.timeOff(sel,d).kind]||'Відсутня'):'Вихідний')+'</span>')+'</span>'+I('right','s')+'</button>'}).join('')+'</div>';
    }else{
      var cols=days.map(function(d){
        var st=dayStats(d,sel),off=App.timeOff(sel,d);
        return {key:d,staff:sel,date:d,wh:st.wh,off:off?{label:OFFKIND[off.kind]||'Відсутня'}:null,
          head:'<button class="cal-mh cal-dh'+(d===T?' is-today':'')+(st.wh?'':' is-off')+'" data-act="cal-day" data-d="'+d+'" data-m="'+sel+'"><span class="r1"><span class="cal-dn">'+D.parse(d).getDate()+'</span><span class="t"><b>'+D.WD[D.wd(d)]+'</b><small>'+(st.wh?st.n+' '+U.plural(st.n,'запис','записи','записів')+' · '+st.pct+'%':'вихідний')+'</small></span></span><span class="cal-load"><i style="width:'+st.pct+'%"></i></span><span class="cal-mh-f"><span>'+D.shortH(d)+'</span><span>'+(st.plan?U.uah(st.plan):'—')+'</span></span></button>'};
      });
      h+=gridHtml(cols,{minCol:110});
    }
  }else{
    /* матриця майстри × дні */
    if(isMob()){
      h+='<div class="cal-wkl">'+days.map(function(d){
        var tot=0,cap=0,bk=0,sum=0;ms.forEach(function(m){var s=dayStats(d,m.id);tot+=s.n;cap+=s.cap;bk+=s.booked;sum+=d<=T?s.earned||0:s.plan});
        var p=cap?Math.min(100,Math.round(bk/cap*100)):0;
        return '<button class="cal-wd'+(d===T?' is-today':'')+'" data-act="cal-day" data-d="'+d+'"><span class="d"><b>'+D.parse(d).getDate()+'</b><small>'+wdShort(d)+'</small></span><span class="c"><span class="n">'+tot+' '+U.plural(tot,'запис','записи','записів')+(sum?' · '+U.uah(sum):'')+'</span><span class="cal-load"><i style="width:'+p+'%"></i></span><span class="hh">Завантаження '+p+'%</span></span>'+I('right','s')+'</button>'}).join('')+'</div>';
    }else{
      h+='<div class="cal-wk"><div class="cal-wkh"><span></span>'+days.map(function(d){return '<button class="cal-wh'+(d===T?' is-today':'')+'" data-act="cal-day" data-d="'+d+'"><b>'+D.parse(d).getDate()+'</b> '+wdShort(d)+'<small>'+D.MONS[D.parse(d).getMonth()]+'</small></button>'}).join('')+'</div>';
      ms.forEach(function(m){
        h+='<div class="cal-wkr"><button class="cal-wm" data-act="cal-mweek" data-m="'+m.id+'">'+UI.av(m,'sm')+'<span class="t"><b class="ell">'+esc(m.short)+'</b><small class="ell">'+esc((App.level(m.lvl)||{}).n||m.spec)+'</small></span></button>';
        days.forEach(function(d){
          var st=dayStats(d,m.id),off=App.timeOff(m.id,d);
          if(!st.wh){h+='<button class="cal-wc is-off" data-act="cal-day" data-d="'+d+'" data-m="'+m.id+'"><span class="o">'+(off?(OFFKIND[off.kind]||'Відсутня'):'Вихідний')+'</span></button>';return}
          h+='<button class="cal-wc l'+loadClass(st.pct)+(d===T?' is-today':'')+'" data-act="cal-day" data-d="'+d+'" data-m="'+m.id+'" title="'+esc(m.n+', '+dShort(d)+': '+st.n+' записів, '+st.pct+'%')+'"><span class="a"><b>'+st.n+'</b> <small>'+st.pct+'%</small></span>'+miniStrip(d,m.id)+'<span class="s">'+(st.plan?U.uah(st.plan):'—')+'</span></button>';
        });
        h+='</div>';
      });
      h+='<div class="cal-wkr tot"><span class="cal-wm"><b>Разом</b></span>'+days.map(function(d){var n=0,s=0;ms.forEach(function(m){var x=dayStats(d,m.id);n+=x.n;s+=d<=T?x.earned||x.plan:x.plan});return '<span class="cal-wc"><span class="a"><b>'+n+'</b> <small>записів</small></span><span class="s">'+U.uah(s)+'</span></span>'}).join('')+'</div>';
      h+='<div class="cal-leg"><span>Завантаження:</span><i class="l0"></i>0<i class="l1"></i>до 40%<i class="l2"></i>40–65%<i class="l3"></i>65–85%<i class="l4"></i>85%+</div></div>';
    }
  }
  h+='</div></div>';
  return h;
}

/* ───────── СПИСОК ───────── */
function listRange(){
  if(S.r==='week'){var a=D.weekStart(S.d);return [a,D.add(a,6)]}
  if(S.r==='month')return [D.monthStart(S.d),D.monthEnd(S.d)];
  return [S.d,S.d];
}
function listData(){
  var rg=listRange(),ms=visibleMasters().map(function(m){return m.id});
  var arr=App.db.appts.filter(function(a){return a.date>=rg[0]&&a.date<=rg[1]&&ms.indexOf(a.staff)>=0});
  if(S.m)arr=arr.filter(function(a){return a.staff===S.m});
  if(S.st==='block')arr=arr.filter(isBlock);
  else{arr=arr.filter(function(a){return !isBlock(a)});if(S.st)arr=arr.filter(function(a){return a.status===S.st})}
  if(S.src)arr=arr.filter(function(a){return a.src===S.src});
  if(S.unpaid)arr=arr.filter(unpaidFlag);
  if(S.qq){var q=S.qq.toLowerCase(),qd=q.replace(/\D/g,'');arr=arr.filter(function(a){var c=cl(a.client);return cname(a).toLowerCase().indexOf(q)>=0||App.apptTitle(a).toLowerCase().indexOf(q)>=0||(qd.length>=3&&c&&c.ph.indexOf(qd)>=0)})}
  arr.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:a.start-b.start});
  return arr;
}
function listHtml(){
  var arr=listData(),h='';
  var rg=listRange();
  h+='<div class="cal-lf">'+
    '<div class="seg">'+[['day','День'],['week','Тиждень'],['month','Місяць']].map(function(x){return '<button data-act="cal-lr" data-r="'+x[0]+'" aria-pressed="'+(S.r===x[0])+'">'+x[1]+'</button>'}).join('')+'</div>'+
    '<div class="inp-ic cal-lq">'+I('search')+'<input class="inp" placeholder="Клієнт, послуга, телефон" value="'+esc(S.qq)+'" data-cal-q></div>'+
    '<select class="sel" data-cal-st aria-label="Статус"><option value="">Усі статуси</option>'+Object.keys(App.ST).map(function(k){return '<option value="'+k+'"'+(S.st===k?' selected':'')+'>'+App.ST[k].n+'</option>'}).join('')+'<option value="block"'+(S.st==='block'?' selected':'')+'>Блоки часу</option></select>'+
    (canAll()?'<select class="sel" data-cal-m aria-label="Майстер"><option value="">Усі майстри</option>'+visibleMasters().map(function(m){return '<option value="'+m.id+'"'+(S.m===m.id?' selected':'')+'>'+esc(m.short)+'</option>'}).join('')+'</select>':'')+
    '<select class="sel" data-cal-src aria-label="Джерело"><option value="">Усі джерела</option>'+Object.keys(App.SRC).map(function(k){return '<option value="'+k+'"'+(S.src===k?' selected':'')+'>'+App.SRC[k]+'</option>'}).join('')+'</select>'+
    '<button class="chip" data-act="cal-lunp" aria-pressed="'+S.unpaid+'">Не оплачені</button></div>';
  var sel=Object.keys(S.sel).filter(function(id){return S.sel[id]&&arr.find(function(a){return a.id===id})});
  var newCount=arr.filter(function(a){return a.status==='new'}).length;
  h+='<div class="cal-lbar"><span class="mute">'+arr.length+' '+U.plural(arr.length,'запис','записи','записів')+(arr.length?' · '+U.uah(U.sum(arr.filter(function(a){return App.active(a)&&a.status!=='noshow'&&!isBlock(a)}),App.apptTotal)):'')+'</span><span class="sp"></span>'+
    (sel.length?'<span class="cal-bulk">Обрано '+sel.length+'<button class="btn sm pri" data-act="cal-bulk" data-st="confirmed">Підтвердити</button><button class="btn sm" data-act="cal-bulk-clear">Зняти вибір</button></span>':
      (newCount?'<button class="btn sm" data-act="cal-bulk-new">Обрати непідтверджені ('+newCount+')</button>':''))+
    '<button class="btn sm" data-act="cal-export">'+I('download','s')+'CSV</button></div>';
  if(!arr.length){
    var filt=S.qq||S.st||S.src||S.unpaid||(canAll()&&S.m);
    if(filt)return h+UI.empty('search','Нічого не знайдено','За цими фільтрами записів немає.','<button class="btn" data-act="cal-lreset" style="margin-top:8px">Скинути фільтри</button>');
    return h+UI.empty('cal',S.r==='month'?'У цьому місяці записів немає':S.r==='week'?'На цьому тижні записів немає':'Записів за цей день немає','Додайте запис або поділіться посиланням на онлайн-запис.','<div class="row" style="margin-top:8px;justify-content:center"><button class="btn" data-act="cal-copylink">Копіювати посилання</button><button class="btn pri" data-act="cal-new">Новий запис</button></div>');
  }
  var rows='',lastD='',shown=arr.slice(0,S.lim);
  var multi=rg[0]!==rg[1];
  shown.forEach(function(a){
    if(multi&&a.date!==lastD){lastD=a.date;rows+='<tr class="cal-dsep"><td colspan="9"><b>'+esc(dShort(a.date))+'</b> <span class="mute">'+esc(D.rel(a.date))+'</span></td></tr>'}
    var c=cl(a.client),m=App.staff(a.staff),tot=isBlock(a)?0:App.apptTotal(a),paid=paidSvc(a);
    var payTxt=isBlock(a)?'':a.status==='cancelled'||a.status==='noshow'?'<span class="faint">—</span>':a.status==='done'?(App.apptDue(a)>0?'<span class="warn-t">борг '+U.uah(App.apptDue(a))+'</span>':'<span class="ok-t">Оплачено</span>'):(a.deposit>0&&depositPaid(a)>0?'передопл. '+U.uah(depositPaid(a)):'<span class="faint">—</span>');
    rows+='<tr class="click" data-id="'+a.id+'"><td class="cal-c-chk"><label class="check" data-nopen><input type="checkbox" data-cal-chk="'+a.id+'"'+(S.sel[a.id]?' checked':'')+'></label></td>'+
      '<td class="cal-c-tm num"><b>'+hmp(a.start)+'</b><small>'+(multi?'':'–'+hmp(App.apptEnd(a)))+'</small></td>'+
      '<td class="cal-c-cl">'+(isBlock(a)?'<span class="av sm">'+I('lock','s')+'</span>':UI.av(c||{n:'?',id:'x'},'sm'))+'<span class="t"><b class="ell">'+esc(cname(a))+'</b><small class="ell">'+(c&&c.ph&&App.canSeePhone()?esc(App.phoneOf(c)):isBlock(a)?'Блок часу':'')+'</small></span></td>'+
      '<td class="cal-c-sv"><span class="ell">'+esc(isBlock(a)?(a.note||'—'):App.apptTitle(a)||'—')+'</span></td>'+
      '<td class="cal-c-m">'+(m?esc(m.short):'')+'</td>'+
      '<td class="cal-c-src">'+esc(App.SRC[a.src]||a.src||'')+'</td>'+
      '<td class="cal-c-st">'+(isBlock(a)?'<span class="badge plain">Блок</span>':UI.badge(a.status))+(a.status==='new'&&a.date<App.today()?'':'')+'</td>'+
      '<td class="cal-c-sum r num">'+(isBlock(a)?'':U.uah(tot))+'</td>'+
      '<td class="cal-c-pay r">'+payTxt+'</td></tr>';
  });
  h+='<div class="tbl-wrap cards cal-tw"><table class="tbl"><thead><tr><th style="width:36px"><label class="check" data-nopen><input type="checkbox" data-cal-chkall></label></th><th>Час</th><th>Клієнт</th><th>Послуги</th><th>Майстер</th><th>Джерело</th><th>Статус</th><th class="r">Сума</th><th class="r">Оплата</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  if(arr.length>shown.length)h+='<div class="cal-more"><button class="btn" data-act="cal-more">Показати ще ('+(arr.length-shown.length)+')</button></div>';
  return '<div class="cal-listpage">'+h+'</div>';
}

/* ───────── після рендеру: скрол, фокус ───────── */
function afterRender(view){
  var wrap=$('.cal-wrap',view);
  if(wrap){
    if(S.keep&&S.scr){wrap.scrollTop=S.scr.t;wrap.scrollLeft=S.scr.l}
    else{
      var lo=+wrap.dataset.lo,ppm=+wrap.dataset.ppm,T=App.today(),target=null;
      if($('.cal-col.is-today',wrap)&&D.nowMin()>=lo)target=(D.nowMin()-lo)*ppm-140;
      else{
        var first=1e9;$$('.cal-col',wrap).forEach(function(c){App.apptsOn(c.dataset.date,c.dataset.staff).forEach(function(a){if(a.status!=='cancelled')first=Math.min(first,a.start)});var wh=App.workHours(c.dataset.staff,c.dataset.date);if(wh)first=Math.min(first,wh.start)});
        if(first<1e9)target=(first-lo)*ppm-34;
      }
      if(target!=null)wrap.scrollTop=Math.max(0,target);
    }
    if(isMob()){var ch=$('.cal-chips .chip[aria-pressed=true]',view);if(ch&&ch.scrollIntoView){try{ch.parentNode.scrollLeft=Math.max(0,ch.offsetLeft-60)}catch(e){}}}
  }
  S.keep=false;
  if(S._fq){var q=$('[data-cal-q]',view);if(q){q.focus();var l=q.value.length;try{q.setSelectionRange(l,l)}catch(e){}}S._fq=false}
}
App.on('change',function(){S.keep=true});
setInterval(function(){
  if(!App.cur||App.cur.rt.id!=='calendar'||S.drag)return;
  var now=D.nowMin(),w=$('.cal-wrap');if(!w)return;
  var lo=+w.dataset.lo,ppm=+w.dataset.ppm;
  $$('.cal-now',w).forEach(function(n){n.style.top=((now-lo)*ppm)+'px'});
  var l=$('.cal-nowlbl',w);if(l){l.style.top=((now-lo)*ppm)+'px';l.textContent=hmp(now)}
},30000);

/* ───────── дії (data-act) ───────── */
act('prev',function(){go({d:shiftDate(-1)})});
act('next',function(){go({d:shiftDate(1)})});
act('today',function(){go({d:App.today()})});
act('view',function(el){
  var v=el.dataset.v;var patch={v:v};
  if(v==='list')patch.r=S.r||'day';
  go(patch);
});
act('zoom',function(el){
  var i=ZOOMS.indexOf(S.zoom)+(+el.dataset.z);i=Math.max(0,Math.min(ZOOMS.length-1,i));
  S.zoom=ZOOMS[i];localStorage.setItem(LS_Z,S.zoom);S.keep=true;App.refresh();
});
act('new',function(){App.newAppt({staff:S.m||undefined,date:S.d})});
act('day',function(el){var p={v:'day',d:el.dataset.d};if(el.dataset.m)p.m=el.dataset.m;go(p)});
act('mweek',function(el){go({v:'week',m:el.dataset.m})});
act('mhead',function(el){go({v:'week',m:el.dataset.m})});
act('mchip',function(el){var m=el.dataset.m;S.mobM=m;go({m:m==='*'?'':m},true)});
act('xc',function(){go({xc:S.showCancelled?'':1},true)});
act('showoff',function(){go({off:1},true)});
act('open',function(el){App.openAppt(el.dataset.id)});
act('client',function(el){App.openClient(el.dataset.id)});
act('gap',function(el){App.newAppt({staff:el.dataset.staff,date:el.dataset.date,start:+el.dataset.start})});
act('note',function(){editDayNote()});
act('sidebtn',function(){
  UI.modal({title:'Зведення дня',sub:esc(D.human(S.d,{wd:true})),body:'<div class="cal-pn cal-pn-m">'+panelHtml(S.d)+'</div>',size:'narrow'});
});
act('confirm-all',function(el){
  var d=el.dataset.date;
  var ids=App.apptsOn(d).filter(function(a){return a.status==='new'&&!isBlock(a)&&(!S.m||a.staff===S.m)&&visibleMasters().some(function(m){return m.id===a.staff})}).map(function(a){return a.id});
  if(!ids.length)return;
  UI.confirm({title:'Підтвердити '+ids.length+' '+U.plural(ids.length,'запис','записи','записів')+'?',text:'Статус зміниться на «Підтверджена». Клієнтам піде нагадування за налаштуваннями.',ok:'Підтвердити'}).then(function(y){
    if(!y)return;App.ops.setStatusBulk(ids,'confirmed');UI.toast('Підтверджено: '+ids.length,{undo:function(){App.ops.setStatusBulk(ids,'new')}});
  });
});
/* лист очікування */
act('wl-add',function(){waitlistForm()});
act('wl-del',function(el){var id=el.dataset.id;var w=App.db.waitlist.find(function(x){return x.id===id});if(!w)return;
  App.ops.removeWaitlist(id);UI.toast('Видалено з листа очікування',{undo:function(){App.ops.setWaitlist(w)}})});
act('wl-find',function(el){waitlistFind(el.dataset.id)});
act('more-menu',function(el){
  var L=[];
  if(S.v!=='list')L.push({ic:'cal',t:'Записи за місяць',fn:function(){go({v:'list',r:'month'})}});
  L.push({ic:'x',t:S.showCancelled?'Сховати скасовані':'Показати скасовані',fn:function(){go({xc:S.showCancelled?'':1},true)}});
  if(S.v==='day')L.push({ic:'door',t:S.showOff?'Сховати вихідних майстрів':'Показати вихідних майстрів',fn:function(){go({off:S.showOff?'':1},true)}});
  if(S.v==='day'&&isMob()&&canAll())L.push({ic:'note',t:'Нотатка до дня',fn:function(){editDayNote()}});
  if(S.v==='day')L.push({ic:'print',t:'Друк дня',fn:function(){try{window.print()}catch(e){}}});
  L.push({ic:'download',t:'Експорт CSV',fn:function(){App.actions['cal-export']({target:el})}});
  if(App.can('settings.manage'))L.push('-'),L.push({ic:'cog',t:'Налаштування сітки',fn:function(){App.go('settings')}});
  if(mods().waitlist!==false&&canAll())L.push({ic:'clock',t:'Лист очікування',fn:function(){App.go('waitlist')}});
  UI.menu(el,L);
});
act('lreset',function(){S.qq='';go({q:'',st:'',src:'',unpaid:'',m:''},true)});
act('copylink',function(){var u='https://slotly.app/sola';try{navigator.clipboard&&navigator.clipboard.writeText(u)}catch(e){}UI.toast('Посилання на онлайн-запис скопійовано')});

/* список */
act('lr',function(el){go({r:el.dataset.r})});
act('lunp',function(){go({unpaid:S.unpaid?'':1},true)});
act('more',function(){S.lim+=120;S.keep=true;App.refresh()});
act('bulk-new',function(){listData().forEach(function(a){if(a.status==='new')S.sel[a.id]=true});S.keep=true;App.refresh()});
act('bulk-clear',function(){S.sel={};S.keep=true;App.refresh()});
act('bulk',function(el){
  var ids=Object.keys(S.sel).filter(function(k){return S.sel[k]});var st=el.dataset.st;
  var prev=ids.map(function(id){return [id,App.appt(id).status]});
  App.ops.setStatusBulk(ids,st);S.sel={};
  UI.toast('Підтверджено: '+ids.length,{undo:function(){prev.forEach(function(p){App.ops.setStatusBulk([p[0]],p[1])})}});
});
act('export',function(){
  var rows=[['Дата','Початок','Кінець','Клієнт','Телефон','Послуги','Майстер','Джерело','Статус','Сума','Оплачено']];
  listData().forEach(function(a){var c=cl(a.client);rows.push([a.date,hmp(a.start),hmp(App.apptEnd(a)),cname(a),c?c.ph:'',App.apptTitle(a),App.staff(a.staff).n,App.SRC[a.src]||a.src,isBlock(a)?'Блок':App.ST[a.status].n,isBlock(a)?0:App.apptTotal(a),paidSvc(a)])});
  U.download('slotly-zapysy-'+S.d+'.csv',U.csv(rows),'text/csv;charset=utf-8');UI.toast('Експортовано '+(rows.length-1)+' рядків');
});

/* ───────── делеговані події (change/input/click) ───────── */
document.addEventListener('change',function(e){
  var t=e.target;if(!App.cur||App.cur.rt.id!=='calendar'||!t.closest('.cal,#top-x'))return;
  if(t.matches('[data-cal-pick]')){if(t.value)go({d:t.value})}
  else if(t.matches('[data-cal-m]'))go({m:t.value});
  else if(t.matches('[data-cal-st]'))go({st:t.value});
  else if(t.matches('[data-cal-src]'))go({src:t.value});
  else if(t.matches('[data-cal-chk]')){if(t.checked)S.sel[t.dataset.calChk]=true;else delete S.sel[t.dataset.calChk];S.keep=true;App.refresh()}
  else if(t.matches('[data-cal-chkall]')){listData().forEach(function(a){if(t.checked)S.sel[a.id]=true;else delete S.sel[a.id]});S.keep=true;App.refresh()}
});
document.addEventListener('input',function(e){
  var t=e.target;if(t.matches&&t.matches('[data-cal-q]')){clearTimeout(S._qt);S._qt=setTimeout(function(){S._fq=true;go({q:t.value.trim()},true)},220)}
});
document.addEventListener('click',function(e){
  var t=e.target;if(!App.cur||App.cur.rt.id!=='calendar')return;
  if(t.matches&&t.matches('[data-cal-pick]')){try{t.showPicker()}catch(x){}return}
  var tr=t.closest&&t.closest('.cal-tw tr.click');
  if(tr&&!t.closest('[data-nopen]')&&!t.closest('button,a')){App.openAppt(tr.dataset.id);return}
  /* клік по блоку */
  var ap=t.closest&&t.closest('.cal-ap');
  if(ap){if(Date.now()-(S.dragEnd||0)<350||Date.now()-(S.lpAt||0)<600)return;if(S.move&&ap.dataset.id===S.move){UI.toast('Оберіть новий час у підсвіченій зоні');return}App.openAppt(ap.dataset.id);return}
  /* клік по порожньому місцю колонки */
  var col=t.closest&&t.closest('.cal-col');
  if(col&&!t.closest('.cal-gap button,.cal-off.all')){
    if(Date.now()-(S.dragEnd||0)<350)return;
    var wrap=col.closest('.cal-wrap'),lo=+wrap.dataset.lo,ppm=+wrap.dataset.ppm,step=+wrap.dataset.step;
    if(Date.now()-(S.lpAt||0)<600)return;
    var r=col.getBoundingClientRect();var m=lo+(e.clientY-r.top)/ppm;m=Math.floor(m/step)*step;
    if(S.move){moveTo(col.dataset.staff,col.dataset.date,Math.max(0,Math.round(m)));return}
    App.newAppt({staff:col.dataset.staff,date:col.dataset.date,start:Math.max(0,Math.round(m))});
  }
});

/* ───────── hover-привид, drag & drop, resize ───────── */
var hov=null;
function colInfo(col){var w=col.closest('.cal-wrap');return {lo:+w.dataset.lo,hi:+w.dataset.hi,ppm:+w.dataset.ppm,step:+w.dataset.step,wrap:w}}
document.addEventListener('mousemove',function(e){
  if(S.drag||isMob()||!App.cur||App.cur.rt.id!=='calendar')return;
  var col=e.target.closest&&e.target.closest('.cal-col');
  if(!col||e.target.closest('.cal-ap,.cal-gap button')){if(hov){hov.remove();hov=null}return}
  var ci=colInfo(col),r=col.getBoundingClientRect();
  var m=Math.floor((ci.lo+(e.clientY-r.top)/ci.ppm)/ci.step)*ci.step;
  if(!hov){hov=document.createElement('div');hov.className='cal-hov'}
  if(hov.parentNode!==col)col.appendChild(hov);
  hov.style.top=((m-ci.lo)*ci.ppm)+'px';hov.style.height=(ci.step*ci.ppm)+'px';hov.textContent=hmp(m);
});
document.addEventListener('mouseleave',function(){if(hov){hov.remove();hov=null}},true);
document.addEventListener('pointerdown',function(e){
  if(!App.cur||App.cur.rt.id!=='calendar'||e.button>0)return;
  var ap=e.target.closest&&e.target.closest('.cal-ap');if(!ap||!ap.classList.contains('can-drag'))return;
  var a=App.appt(ap.dataset.id);if(!a)return;
  var resize=!!e.target.closest('.cal-rs');
  var col=ap.closest('.cal-col'),ci=colInfo(col),r=ap.getBoundingClientRect();
  var st={id:a.id,a:a,el:ap,resize:resize,x0:e.clientX,y0:e.clientY,on:false,touch:e.pointerType==='touch',ci:ci,
    off:(e.clientY-r.top)/ci.ppm,dur:App.apptDur(a),home:col,t:null,last:null};
  S.drag=st;
  if(st.touch){st.t=setTimeout(function(){if(S.drag===st&&!st.on){beginDrag(st);if(navigator.vibrate)try{navigator.vibrate(12)}catch(x){}}},380)}
  window.addEventListener('pointermove',dragMove);window.addEventListener('pointerup',dragEnd);window.addEventListener('pointercancel',dragCancel);
});
function beginDrag(st){
  st.on=true;st.el.classList.add('is-drag');document.body.classList.add('cal-dragging');
  if(hov){hov.remove();hov=null}
  st.ghost=document.createElement('div');st.ghost.className='cal-ghost';
  st.timer=setInterval(function(){autoScroll(st)},16);
  document.addEventListener('touchmove',stopTouch,{passive:false});
}
function stopTouch(e){if(S.drag&&S.drag.on)e.preventDefault()}
function autoScroll(st){
  if(st.lastY==null)return;var w=st.ci.wrap,r=w.getBoundingClientRect();
  if(st.lastY<r.top+54)w.scrollTop-=Math.min(16,(r.top+54-st.lastY)/3);
  else if(st.lastY>r.bottom-40)w.scrollTop+=Math.min(16,(st.lastY-(r.bottom-40))/3);
  if(st.lastX!=null&&!st.resize){if(st.lastX<r.left+30)w.scrollLeft-=10;else if(st.lastX>r.right-30)w.scrollLeft+=10}
  if(st.lastEv)updateGhost(st,st.lastEv);
}
function colUnder(x){
  var cols=$$('.cal-col'),best=null,bd=1e9;
  cols.forEach(function(c){var r=c.getBoundingClientRect();var d=x<r.left?r.left-x:x>r.right?x-r.right:0;if(d<bd){bd=d;best=c}});
  return best;
}
function dragMove(e){
  var st=S.drag;if(!st)return;
  st.lastY=e.clientY;st.lastX=e.clientX;st.lastEv=e;
  if(!st.on){
    var dx=e.clientX-st.x0,dy=e.clientY-st.y0;
    if(st.touch){if(Math.abs(dx)>9||Math.abs(dy)>9){clearTimeout(st.t);cleanupDrag(true)}return}
    if(Math.abs(dx)+Math.abs(dy)>5)beginDrag(st);else return;
  }
  e.preventDefault&&e.preventDefault();
  updateGhost(st,e);
}
function updateGhost(st,e){
  var ci=st.ci,a=st.a,step=ci.step;
  if(st.resize){
    var r=st.el.closest('.cal-col').getBoundingClientRect();
    var mEnd=ci.lo+(e.clientY-r.top)/ci.ppm;mEnd=Math.round(mEnd/step)*step;
    var dur=Math.max(step,mEnd-a.start);
    var hi=Math.min(ci.hi,a.start+dur);dur=hi-a.start;
    st.newDur=dur;st.target={staff:a.staff,date:a.date,start:a.start};
    st.el.style.height=(dur*ci.ppm-2)+'px';
    st.cs=App.conflicts(a.staff,a.date,a.start,dur,a.id);
    st.el.classList.toggle('bad',st.cs.length>0);
    showTip(st,e,hmp(a.start)+'–'+hmp(a.start+dur)+' · '+U.dur(dur));
    return;
  }
  var col=colUnder(e.clientX);if(!col)return;
  var cr=col.getBoundingClientRect();
  var m=ci.lo+(e.clientY-cr.top)/ci.ppm-st.off;m=Math.round(m/step)*step;
  m=Math.max(ci.lo,Math.min(ci.hi-st.dur,m));
  var staff=col.dataset.staff,date=col.dataset.date;
  st.target={staff:staff,date:date,start:m};
  st.cs=App.conflicts(staff,date,m,st.dur,a.id);
  if(st.ghost.parentNode!==col)col.appendChild(st.ghost);
  st.ghost.style.top=((m-ci.lo)*ci.ppm)+'px';st.ghost.style.height=(st.dur*ci.ppm)+'px';
  st.ghost.classList.toggle('bad',st.cs.length>0);
  var s=App.staff(staff);
  st.ghost.innerHTML='<b>'+hmp(m)+'–'+hmp(m+st.dur)+'</b><span>'+esc(s?s.short:'')+(date!==a.date?' · '+esc(dShort(date)):'')+'</span>'+(st.cs.length?'<em>'+esc(conflictText(st.cs)[0])+'</em>':'');
}
function showTip(st,e,txt){
  var t=S.tip;if(!t){t=S.tip=document.createElement('div');t.className='cal-tip';document.body.appendChild(t)}
  t.textContent=txt+(st.cs&&st.cs.length?' — зайнято':'');t.classList.toggle('bad',!!(st.cs&&st.cs.length));
  t.style.left=(e.clientX+14)+'px';t.style.top=(e.clientY+14)+'px';
}
function cleanupDrag(keepClickGuard){
  var st=S.drag;if(!st)return;
  clearTimeout(st.t);clearInterval(st.timer);
  window.removeEventListener('pointermove',dragMove);window.removeEventListener('pointerup',dragEnd);window.removeEventListener('pointercancel',dragCancel);
  document.removeEventListener('touchmove',stopTouch);
  document.body.classList.remove('cal-dragging');
  if(st.el){st.el.classList.remove('is-drag');st.el.classList.remove('bad')}
  if(st.ghost&&st.ghost.parentNode)st.ghost.remove();
  if(S.tip){S.tip.remove();S.tip=null}
  if(st.on)S.dragEnd=Date.now();
  S.drag=null;
}
function dragCancel(){
  var st=S.drag;if(!st)return;
  if(st.resize&&st.on)st.el.style.height=(st.dur*st.ci.ppm-2)+'px';
  cleanupDrag();
}
function dragEnd(){
  var st=S.drag;if(!st)return;
  if(!st.on){cleanupDrag();return}
  var a=st.a,tg=st.target,cs=st.cs||[],resize=st.resize;
  var el=st.el,hh=st.dur*st.ci.ppm-2;
  cleanupDrag();
  if(!tg){return}
  if(resize){
    if(st.newDur===st.dur){el.style.height=hh+'px';return}
    var apply=function(){
      var oldExtra=a.extra||0,sumD=U.sum(a.items,function(x){return x.d});
      App.ops.updateAppt(a.id,{extra:st.newDur-sumD},'Тривалість змінено: '+U.dur(st.dur)+' → '+U.dur(st.newDur));
      UI.toast('Тривалість: '+U.dur(st.newDur)+' (до '+hmp(a.start+st.newDur)+')',{undo:function(){App.ops.updateAppt(a.id,{extra:oldExtra},'Тривалість повернуто')}});
    };
    if(cs.length)askConflict(cs).then(function(y){if(y)apply();else el.style.height=hh+'px'});else apply();
    return;
  }
  if(tg.staff===a.staff&&tg.date===a.date&&tg.start===a.start)return;
  var old={staff:a.staff,date:a.date,start:a.start};
  var apply2=function(){
    App.ops.updateAppt(a.id,{staff:tg.staff,date:tg.date,start:tg.start});
    afterChange(a,'move',{staff:old.staff,date:old.date,start:old.start,dur:App.apptDur(a)});
    UI.toast('Перенесено на '+hmp(tg.start)+' · '+App.staff(tg.staff).short.split(' ')[0]+(tg.date!==old.date?' · '+D.shortH(tg.date):''),{undo:function(){App.ops.updateAppt(a.id,old,'Перенесення скасовано')}});
  };
  if(cs.length)askConflict(cs).then(function(y){if(y)apply2()});else apply2();
}

/* ───────── свайп (мобільний): день ← → (поріг 30 %, зсув за пальцем) ───────── */
(function(){
  var sx=0,sy=0,t0=0,on=false,lock=0,el=null;
  document.addEventListener('touchstart',function(e){
    on=false;lock=0;
    if(!isMob()||!App.cur||App.cur.rt.id!=='calendar'||S.v==='list')return;
    if(e.target.closest('.cal-chips,.cal-mbar,.cal-movebar,input,select'))return;
    el=e.target.closest('.cal-wrap,.cal-wkl');if(!el)return;
    if(el.scrollWidth>el.clientWidth+4)return; /* «Усі» з горизонтальним скролом — не заважаємо */
    on=true;sx=e.touches[0].clientX;sy=e.touches[0].clientY;t0=Date.now();
  },{passive:true});
  document.addEventListener('touchmove',function(e){
    if(!on||S.drag)return;var dx=e.touches[0].clientX-sx,dy=e.touches[0].clientY-sy;
    if(!lock){if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.5)lock=1;else if(Math.abs(dy)>10)lock=-1}
    if(lock===1){el.style.transform='translateX('+dx+'px)';el.style.opacity=String(1-Math.min(.5,Math.abs(dx)/window.innerWidth))}
  },{passive:true});
  document.addEventListener('touchend',function(e){
    if(!on)return;on=false;var t=e.changedTouches[0],dx=t.clientX-sx;
    var ok=lock===1&&(Math.abs(dx)>window.innerWidth*.3||(Math.abs(dx)>60&&Date.now()-t0<300));
    if(el){el.style.transition='transform .18s,opacity .18s';el.style.transform='';el.style.opacity='';var e2=el;setTimeout(function(){e2.style.transition=''},200)}
    if(ok)go({d:shiftDate(dx<0?1:-1)});
  },{passive:true});
})();


/* ═════════ B2: перенос (режим вибору слота), «Повідомити клієнта?», сигнал листа очікування ═════════ */
App._b2move=true;App._b2wait=true;
App.moveAppt=function(id){var a=App.appt(id);if(!a)return UI.toast('Запис не знайдено',{type:'err'});UI.closeAll();
  /* телефон: відкриваємо день саме цього майстра (а не того, що був обраний), щоб вільні вікна були під пальцем */
  if(isMob()&&canAll())S.mobM=a.staff;
  App.go('calendar',{v:'day',d:a.date,m:isMob()?'':(S.m||''),move:id})};
App.waitNew=function(o){waitlistForm(o||{})};
function moveBarHtml(){
  var a=App.appt(S.move);if(!a)return '';
  return '<div class="cal-movebar" role="status">'+I('move','s')+'<span class="t">Оберіть новий час для <b>'+esc(U.short(cname(a)))+'</b><small>'+esc(dShort(a.date))+' · '+hmp(a.start)+' · '+esc(App.staff(a.staff).short)+'</small></span><span class="sp"></span><button class="btn sm" data-act="cal-move-x">Скасувати</button></div>';
}
function moveZones(col,lo,ppm){
  /* у режимі переносу вільні вікна підсвічуються, тап по них = вибір часу */
  var a=App.appt(S.move);if(!a||!col.wh)return '';
  var T=App.today();if(col.date<T)return '';
  var dur=App.apptDur(a),from=col.wh.start,to=col.wh.end;
  if(col.date===T)from=Math.max(from,Math.ceil(D.nowMin()/15)*15);
  var busy=[];App.apptsOn(col.date,col.staff).forEach(function(x){if(x.id!==a.id&&App.active(x))busy.push([x.start,App.apptEnd(x)])});
  if(col.wh.brk)busy.push(col.wh.brk.slice());busy.sort(function(x,y){return x[0]-y[0]});
  var gaps=[],cur=from;busy.forEach(function(b){if(b[0]>cur)gaps.push([cur,Math.min(b[0],to)]);cur=Math.max(cur,b[1])});if(cur<to)gaps.push([cur,to]);
  return gaps.filter(function(g){return g[1]-g[0]>=dur}).map(function(g){return '<div class="cal-mz" style="top:'+((g[0]-lo)*ppm+1)+'px;height:'+((g[1]-g[0])*ppm-2)+'px" aria-hidden="true"></div>'}).join('');
}
function moveTo(staff,date,start){
  var a=App.appt(S.move);if(!a){S.move='';return go({move:''})}
  var dur=App.apptDur(a);
  if(staff===a.staff&&date===a.date&&start===a.start)return UI.toast('Це поточний час запису');
  var cs=App.conflicts(staff,date,start,dur,a.id);
  var m=App.staff(staff);
  var txt='Перенести на '+dShort(date)+' '+hmp(start)+' до '+m.short.split(' ')[0]+'?';
  var bad=cs.filter(function(c){return c.type==='overlap'}).length?'Цей час перетинається з іншим записом.':cs.length?'Поза робочим часом майстра.':'';
  UI.confirm({title:txt,text:esc(cname(a))+' · '+U.dur(dur)+(bad?'<br><b>'+bad+'</b>':''),ok:bad?'Все одно перенести':'Перенести'}).then(function(y){
    if(!y)return;
    var old={staff:a.staff,date:a.date,start:a.start};
    App.ops.updateAppt(a.id,{staff:staff,date:date,start:start});
    S.move='';go({move:'',d:date},true);
    UI.toast('Перенесено на '+hmp(start)+' · '+m.short.split(' ')[0],{undo:function(){App.ops.updateAppt(a.id,old,'Перенесення скасовано')}});
    afterChange(a,'move',{staff:old.staff,date:old.date,start:old.start,dur:dur});
  });
}
act('move-x',function(){S.move='';go({move:''},true);UI.toast('Перенесення скасовано')});
function fillTpl(k,a){
  var c=a.client&&cl(a.client),sv=a.items&&a.items[0]&&App.svc(a.items[0].svc),m=App.staff(a.staff);
  var t=(App.TPL&&App.TPL[k])||'';
  return t.replace(/\{імʼя\}/g,c?c.n.split(' ')[0]:'').replace(/\{салон\}/g,(App.db.salon||{}).name||'').replace(/\{послуга\}/g,sv?sv.n:'послуга')
    .replace(/\{дата\}/g,D.shortH(a.date)).replace(/\{час\}/g,hmp(a.start)).replace(/\{майстер\}/g,m?m.short.split(' ')[0]:'').replace(/\{посилання\}/g,'slotly.app/sola');
}
function notifyClient(a,kind){
  a=App.appt(a.id)||a;var c=a.client&&cl(a.client);if(!c)return;
  var ch=c.tg?'tg':c.ph?'viber':'';
  var txt=fillTpl(kind,a);
  if(!ch){
    UI.modal({title:'Повідомити клієнта?',size:'narrow',body:'<p class="cal-nc-t">У клієнта немає Telegram/Viber — зателефонуйте.</p>',
      foot:'<span class="sp"></span><button class="btn" data-no>Ні</button>',onMount:function(el,close){el.querySelector('[data-no]').onclick=close}});return;
  }
  UI.modal({title:'Повідомити клієнта?',sub:esc(c.n)+' · '+(ch==='tg'?'Telegram':'Viber'),size:'narrow cal-nc',
    body:'<div class="bubble me">'+esc(txt)+'</div>'+(c.ph&&App.canSeePhone()?'<p class="cal-nc-t">Або <a href="tel:+'+c.ph+'">зателефонуйте '+esc(App.phoneOf(c))+'</a></p>':''),
    foot:'<span class="sp"></span><button class="btn" data-no>Ні</button><button class="btn pri" data-ok>'+I(ch==='tg'?'tg':'msg','s')+'Надіслати</button>',
    onMount:function(el,close){el.querySelector('[data-no]').onclick=close;el.querySelector('[data-ok]').onclick=function(){
      App.ops.sendMsg({client:c.id,appt:a.id,ch:ch,tpl:kind,txt:txt});close();UI.toast('Повідомлення надіслано ('+(ch==='tg'?'Telegram':'Viber')+')')}}});
}
function waitSignal(fr){
  if(mods().waitlist===false||!canAll()||!fr||!App.waitMatches)return;
  var ws=App.waitMatches(fr.staff,fr.date,fr.start,fr.dur);if(!ws.length)return;
  var m=App.staff(fr.staff);
  UI.toast('Звільнилось '+hmp(fr.start)+' у '+esc(m.short.split(' ')[0])+' · '+ws.length+' '+U.plural(ws.length,'чекає','чекають','чекають')+' <a class="link" href="#/waitlist">Запропонувати</a>',{ms:7000});
}
function afterChange(a,kind,freed){
  setTimeout(function(){waitSignal(freed)},kind==='cancel'?50:400);
  setTimeout(function(){if(!$('.ov'))notifyClient(a,kind)},kind==='cancel'?120:60);
}
function waitCountFor(staff,date){
  if(mods().waitlist===false||!canAll()||date<App.today())return 0;
  return (App.db.waitlist||[]).filter(function(w){return (w.status||'wait')==='wait'&&date>=w.from&&date<=w.to&&(w.staff?w.staff===staff:App.performs(App.staff(staff),App.svc(w.svc)))}).length;
}

/* ───────── довге натискання (телефон) ───────── */
(function(){
  var tm=null,sx=0,sy=0;
  document.addEventListener('touchstart',function(e){
    if(!isMob()||!App.cur||App.cur.rt.id!=='calendar'||S.v!=='day')return;
    var t=e.target;if(t.closest('.cal-chips,.cal-mbar,button:not(.cal-ap),input,select,a'))return;
    var ap=t.closest('.cal-ap'),col=t.closest('.cal-col');if(!ap&&!col)return;
    sx=e.touches[0].clientX;sy=e.touches[0].clientY;var cy=sy;clearTimeout(tm);
    tm=setTimeout(function(){tm=null;S.lpAt=Date.now();
      if(navigator.vibrate)try{navigator.vibrate(10)}catch(x){}
      if(ap){var a=App.appt(ap.dataset.id);if(!a||a.block)return;apMenu(ap,a)}
      else{var wrap=col.closest('.cal-wrap'),lo=+wrap.dataset.lo,ppm=+wrap.dataset.ppm,step=+wrap.dataset.step,r=col.getBoundingClientRect();
        var m=Math.floor((lo+(cy-r.top)/ppm)/step)*step;
        if(S.move)moveTo(col.dataset.staff,col.dataset.date,Math.max(0,Math.round(m)));
        else App.newAppt({staff:col.dataset.staff,date:col.dataset.date,start:Math.max(0,Math.round(m))})}
    },500);
  },{passive:true});
  function cancel(e){if(!tm)return;if(e&&e.touches&&e.touches[0]){var dx=e.touches[0].clientX-sx,dy=e.touches[0].clientY-sy;if(Math.abs(dx)<8&&Math.abs(dy)<8)return}clearTimeout(tm);tm=null}
  document.addEventListener('touchmove',cancel,{passive:true});document.addEventListener('touchend',function(){clearTimeout(tm);tm=null},{passive:true});
})();
function apMenu(anchor,a){
  var c=a.client&&cl(a.client),L=[];
  if(a.status==='new'||a.status==='confirmed')L.push({ic:'check',t:'Прийшов(ла)',fn:function(){setStatus(a,'arrived')}});
  if(MOVABLE[a.status])L.push({ic:'move',t:'Перенести',fn:function(){App.moveAppt(a.id)}});
  if(a.status==='new'||a.status==='confirmed')L.push({ic:'x',t:'Скасувати',dng:true,fn:function(){cancelAppt(a)}});
  if(c&&c.ph&&App.canSeePhone())L.push({ic:'phone',t:'Подзвонити',fn:function(){location.href='tel:+'+c.ph}});
  L.push({ic:'right',t:'Відкрити запис',fn:function(){App.openAppt(a.id)}});
  UI.menu(anchor,L);
}

/* ───────── клавіатура ───────── */
document.addEventListener('keydown',function(e){
  if(!App.cur||App.cur.rt.id!=='calendar'||e.ctrlKey||e.metaKey||e.altKey)return;
  var t=e.target,tag=t&&t.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(t&&t.isContentEditable))return;
  if($('.ov'))return;
  if(e.code==='KeyN'){e.preventDefault();App.newAppt({staff:S.m||undefined,date:S.d})}
  else if(e.code==='KeyT'){e.preventDefault();go({d:App.today()})}
  else if(e.key==='ArrowLeft'){e.preventDefault();go({d:shiftDate(-1)})}
  else if(e.key==='ArrowRight'){e.preventDefault();go({d:shiftDate(1)})}
  else if(e.code==='Digit1')go({v:'day'});else if(e.code==='Digit2')go({v:'week'});else if(e.code==='Digit3')go({v:'list',r:S.r||'day'});
  else if(e.key==='Enter'&&t&&t.classList&&t.classList.contains('cal-ap')){App.openAppt(t.dataset.id)}
});

/* ───────── нотатка дня ───────── */
function editDayNote(){
  var cur=App.db.dayNotes[S.d]||'';var date=S.d;
  UI.modal({title:'Нотатка до дня',sub:esc(D.human(date,{wd:true})),size:'narrow',
    body:'<label class="fld"><span class="vh">Нотатка</span><textarea class="ta" data-n rows="4" placeholder="Що важливо знати команді цього дня?">'+esc(cur)+'</textarea></label>',
    foot:(cur?'<button class="btn dng" data-del>Видалити</button>':'')+'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
    onMount:function(el,close){
      var ta=el.querySelector('[data-n]');setTimeout(function(){ta.focus()},40);
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){App.ops.setDayNote(date,ta.value.trim());close();UI.toast('Нотатку збережено')};
      var d=el.querySelector('[data-del]');if(d)d.onclick=function(){App.ops.setDayNote(date,'');close();UI.toast('Нотатку видалено',{undo:function(){App.ops.setDayNote(date,cur)}})};
    }});
}

/* ═════════ ФОРМА ЗАПИСУ (спільна для «Новий запис», «Редагувати», «Перенести») ═════════ */
function nfDay(d){var T=App.today();return d===T?'сьогодні':d===D.add(T,1)?'завтра':dShort(d)}
function copyItems(a){return (a||[]).map(function(x){return {svc:x.svc,price:x.price,d:x.d,custom:!!x.custom}})}
function matchMasters(items){
  var ms=mastersAll();if(!items.length)return {fit:ms,other:[]};
  var cats={};items.forEach(function(x){var s=App.svc(x.svc);if(s)cats[s.cat]=1});
  var keys=Object.keys(cats);
  var fit=ms.filter(function(m){return keys.every(function(c){return (m.cats||[]).indexOf(c)>=0})});
  if(!fit.length)fit=ms.filter(function(m){return keys.some(function(c){return (m.cats||[]).indexOf(c)>=0})});
  return {fit:fit,other:ms.filter(function(m){return fit.indexOf(m)<0})};
}
function depositRule(client,total){
  var dp=App.db.settings.deposit;if(!dp||!dp.on||mods().deposits===false||total<(dp.minPrice||0))return 0;
  if(dp.mode==='new'&&client){var s=App.clientStats(client);if(s.visits>0)return 0}
  return Math.round(total*(dp.pct||30)/100/10)*10;
}
function bookingForm(root,init,cfg){
  cfg=cfg||{};
  var T=App.today();
  var st={client:init.client||null,noName:!!init.noName,items:copyItems(init.items),staff:init.staff||'any',date:init.date||S.d,start:init.start!=null?init.start:null,
    note:init.note||'',src:init.src||'admin',deposit:init.deposit||0,depPaid:false,depMethod:'mono',confirmed:cfg.edit?init.status!=='new':true,cat:'',q:''};
  var only=cfg.only||'';
  var step=stepMin();
  function dur(){return U.sum(st.items,function(x){return +x.d||0})+(init.extra||0)}
  function total(){return U.sum(st.items,function(x){return +x.price||0})}
  function staffObj(){return st.staff==='any'?null:App.staff(st.staff)}
  function cands(){
    if(st.staff!=='any')return [App.staff(st.staff)];
    var mm=matchMasters(st.items);return mm.fit.length?mm.fit:mastersAll();
  }
  function slotMap(){
    var d=Math.max(dur(),step),map={},now=D.nowMin();
    cands().forEach(function(m){App.freeSlots(m.id,st.date,d).forEach(function(t){
      if(cfg.exceptId){/* під час переносу ігноруємо сам запис */}
      (map[t]=map[t]||[]).push(m.id)})});
    if(cfg.exceptId){
      /* freeSlots не вміє ігнорувати запис — перераховуємо власним конфліктом */
      map={};cands().forEach(function(m){var wh=App.workHours(m.id,st.date);if(!wh)return;for(var t=wh.start;t+d<=wh.end;t+=step){if(!App.conflicts(m.id,st.date,t,d,cfg.exceptId).length)(map[t]=map[t]||[]).push(m.id)}});
    }
    if(st.date===T)Object.keys(map).forEach(function(t){if(+t<now-5&&!cfg.allowPast)delete map[t]});
    return map;
  }
  function pickFree(){
    /* для «будь-хто вільний»: майстер з найменшим завантаженням */
    if(st.staff!=='any')return st.staff;
    var d=Math.max(dur(),step),best=null,bl=1e9;
    cands().forEach(function(m){if(App.conflicts(m.id,st.date,st.start,d,cfg.exceptId).length)return;var l=dayStats(st.date,m.id).booked;if(l<bl){bl=l;best=m.id}});
    return best;
  }
  function recalcPrices(){var so=staffObj();st.items.forEach(function(x){if(!x.custom){var s=App.svc(x.svc);if(s)x.price=App.priceFor(s,so)}})}

  var h='<div class="cal-bf'+(only?' only-'+only:'')+'">';
  if(!only)h+='<div class="cal-bf-l"><section data-sec="client"></section><section data-sec="svc"></section></div>';
  h+='<div class="cal-bf-r"><section data-sec="when"></section>'+(only?'':'<section data-sec="extra"></section>')+'</div><div class="cal-bf-sum" data-sec="sum"></div></div>';
  root.innerHTML=h;
  function sec(n){return root.querySelector('[data-sec='+n+']')}

  /* — клієнт — */
  function lastVisit(cid){var T0=App.today();return App.db.appts.filter(function(a){return a.client===cid&&a.status==='done'&&!a.block&&a.items&&a.items.length&&a.date<=T0}).sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:b.start-a.start})[0]||null}
  function rClient(){
    var el=sec('client');if(!el)return;
    var c=st.client&&cl(st.client);
    if(c){
      var s=App.clientStats(c.id);
      el.innerHTML='<div class="cal-h">Клієнт</div><div class="cal-cc">'+UI.av(c,'')+'<span class="t"><b>'+esc(c.n)+(c.tags.indexOf('vip')>=0?' <span class="tag">VIP</span>':'')+'</b><small>'+(c.ph?esc(U.phone(c.ph)):'без телефону')+' · '+s.visits+' '+U.plural(s.visits,'візит','візити','візитів')+(s.noshow?' · не прийшов '+s.noshow:'')+'</small></span><button class="btn sm" data-x="chg">Змінити</button></div>'+
        (c.blocked?'<div class="note dng">'+I('ban')+'<span>Клієнт у чорному списку.</span></div>':'')+
        (c.tags.indexOf('allergy')>=0||c.note?'<div class="note warn">'+I('alert')+'<span>'+(c.tags.indexOf('allergy')>=0?'<b>Алергія. </b>':'')+esc(c.note||'')+'</span></div>':'');
      /* «Як минулого разу» — один дотик підставляє послуги й майстра з останнього візиту */
      var lv=lastVisit(c.id);
      if(lv&&!st.items.length){var lm=App.staff(lv.staff);
        el.innerHTML+='<button class="cal-rep" data-x="last">'+I('repeat','s')+'<span class="t"><b>Як минулого разу</b><small class="ell">'+esc(lv.items.map(function(x){var s=App.svc(x.svc);return s?s.n:''}).filter(Boolean).join(' + '))+(lm?' · '+esc(lm.short):'')+' · '+esc(D.human(lv.date))+'</small></span></button>'}
    }else if(st.noName){
      el.innerHTML='<div class="cal-h">Клієнт</div><div class="cal-cc">'+'<span class="av">?</span><span class="t"><b>Без імені</b><small>Швидкий запис — клієнта можна додати пізніше</small></span><button class="btn sm" data-x="chg">Обрати</button></div>';
    }else{
      el.innerHTML='<div class="cal-h">Клієнт <button class="link" data-x="noname">Без імені</button></div><div data-pick></div>';
      var pk=el.querySelector('[data-pick]'),pick=function(cc){st.client=cc.id;st.noName=false;rClient();rExtra();rSum()};
      if(cfg.nc)clientField(pk,st,pick);else UI.clientPicker(pk,pick);
    }
  }
  /* — послуги — */
  function rSvc(){
    var el=sec('svc');if(!el)return;
    var cats=App.db.cats;
    el.innerHTML='<div class="cal-h">Послуги</div><div data-sel></div>'+
      '<button class="btn sm cal-svmore" data-x="svcmore" hidden>'+I('plus','s')+'Ще послуга</button>'+
      '<div data-svpick><div class="inp-ic" style="margin-top:8px">'+I('search')+'<input class="inp" placeholder="Знайти послугу…" data-q autocomplete="off"></div>'+
      '<div class="chips cal-cats scroll"><button class="chip" aria-pressed="true" data-cat="">Усі</button>'+cats.map(function(c){return '<button class="chip" aria-pressed="false" data-cat="'+c.id+'">'+esc(c.n)+'</button>'}).join('')+'</div>'+
      '<div class="cal-svlist" data-list></div></div>';
    rSel();rList();
  }
  /* телефон: коли послугу обрано, довгий список ховаємо за «Ще послуга» — час одразу під рукою */
  function svcFold(){var pk=root.querySelector('[data-svpick]'),mb=root.querySelector('[data-x=svcmore]');if(!pk||!mb)return;
    var fold=window.matchMedia('(max-width:899px)').matches&&st.items.length>0&&!st.svcOpen;pk.hidden=fold;mb.hidden=!fold}
  function rSel(){
    var el=root.querySelector('[data-sel]');if(!el)return;svcFold();
    if(!st.items.length){el.innerHTML='<div class="cal-hint">Оберіть одну чи кілька послуг зі списку нижче.</div>';return}
    el.innerHTML=st.items.map(function(x,i){var s=App.svc(x.svc);return '<div class="cal-sr"><div class="n"><b class="ell">'+esc(s?s.n:x.svc)+'</b><small>'+esc(s?catName(s.cat):'')+'</small></div>'+
      '<label class="inp-suf"><input type="number" inputmode="numeric" min="5" step="5" data-f="d" data-i="'+i+'" value="'+x.d+'" aria-label="Тривалість"><span>хв</span></label>'+
      '<label class="inp-suf"><input type="number" inputmode="numeric" min="0" step="10" data-f="price" data-i="'+i+'" value="'+x.price+'" aria-label="Ціна"><span>₴</span></label>'+
      '<button class="icobtn sm ghost" data-x="del" data-i="'+i+'" aria-label="Прибрати">'+I('x','s')+'</button></div>'}).join('');
  }
  function catName(id){var c=App.db.cats.find(function(x){return x.id===id});return c?c.n:''}
  function rList(){
    var el=root.querySelector('[data-list]');if(!el)return;
    var q=st.q.trim().toLowerCase(),so=staffObj();
    var list=App.db.services.filter(function(s){return s.active!==false&&(!st.cat||s.cat===st.cat)&&(!q||s.n.toLowerCase().indexOf(q)>=0)});
    if(!list.length){el.innerHTML='<div class="cal-hint">Нічого не знайдено</div>';return}
    var g=U.groupBy(list,function(s){return s.cat});var html='';
    App.db.cats.forEach(function(c){
      if(!g[c.id])return;
      html+=(st.cat?'':'<div class="cal-gh">'+esc(c.n)+'</div>')+g[c.id].map(function(s){var n=st.items.filter(function(x){return x.svc===s.id}).length;
        return '<button class="cal-so" data-x="add" data-id="'+s.id+'"><span class="ell">'+esc(s.n)+'</span>'+(n?'<em>×'+n+'</em>':'')+'<small>'+U.dur(s.d)+'</small><b>'+U.uah(App.priceFor(s,so))+'</b></button>'}).join('');
    });
    el.innerHTML=html;
  }
  /* — коли — */
  function rWhen(){
    var el=sec('when');if(!el)return;
    var mm=matchMasters(st.items);
    function opt(m){return '<option value="'+m.id+'"'+(st.staff===m.id?' selected':'')+'>'+esc(m.short)+(m.spec?' · '+esc(m.spec):'')+'</option>'}
    el.innerHTML='<div class="cal-h">Майстер і час</div><div class="grid2 m1"><label class="fld"><span>Майстер</span><select class="sel" data-f="staff">'+(cfg.noAny?'':'<option value="any"'+(st.staff==='any'?' selected':'')+'>Будь-хто вільний</option>')+
      (mm.other.length&&mm.fit.length?'<optgroup label="За спеціалізацією">'+mm.fit.map(opt).join('')+'</optgroup><optgroup label="Інші майстри">'+mm.other.map(opt).join('')+'</optgroup>':mastersAll().map(opt).join(''))+'</select></label>'+
      '<label class="fld"><span>Дата</span><input class="inp" type="date" data-f="date" value="'+st.date+'"></label></div>'+
      '<div class="cal-dq"><button class="chip" data-x="dd" data-n="0">Сьогодні</button><button class="chip" data-x="dd" data-n="1">Завтра</button><button class="chip" data-x="dd" data-n="-7">−тиждень</button><button class="chip" data-x="dd" data-n="7">+тиждень</button></div>'+
      (st.items.length&&st.items[0].svc?'<div class="cal-nf" data-nf><button class="btn sm" data-x="nfgo">'+I('zap','s')+'Найближче вільне</button></div>':'')+
      '<div class="cal-slots" data-slots></div>';
    rSlots();
  }
  function rSlots(){
    var el=root.querySelector('[data-slots]');if(!el)return;
    var map=slotMap(),ts=Object.keys(map).map(Number).sort(function(a,b){return a-b});
    var html='<div class="cal-sl-h"><span>Вільний час'+(st.staff==='any'?' (усі підходящі майстри)':'')+'</span><label class="cal-tm">Свій час <input type="time" step="'+(step*60)+'" data-f="time" value="'+(st.start!=null?hmp(st.start):'')+'"></label></div>';
    if(!ts.length){
      var wh=st.staff!=='any'&&App.workHours(st.staff,st.date);
      html+='<div class="cal-noslots">'+I('clock','s')+'<span>'+(st.staff!=='any'&&!wh?'Майстер не працює '+esc(D.shortH(st.date))+'.':'Немає вільних вікон на '+esc(D.shortH(st.date))+(dur()?' для '+U.dur(dur()):'')+'.')+'</span></div>';
      var sug=[];for(var i=1;i<=14&&sug.length<3;i++){var d=D.add(st.date,i);var best=null;
        cands().forEach(function(m){var f=App.freeSlots(m.id,d,Math.max(dur(),step));if(f.length&&(!best||f[0]<best.t))best={t:f[0],m:m}});if(best)sug.push({d:d,t:best.t,m:best.m})}
      if(sug.length)html+='<div class="cal-sug">Найближче: '+sug.map(function(s){return '<button class="chip" data-x="sug" data-d="'+s.d+'" data-t="'+s.t+'" data-m="'+s.m.id+'">'+esc(dShort(s.d))+' · '+hmp(s.t)+(st.staff==='any'?' · '+esc(s.m.short.split(' ')[0]):'')+'</button>'}).join('')+'</div>';
    }else{
      var gs=[['Ранок',0,720],['День',720,1020],['Вечір',1020,1440]];
      gs.forEach(function(g){var arr=ts.filter(function(t){return t>=g[1]&&t<g[2]});if(!arr.length)return;
        html+='<div class="cal-sg"><small>'+g[0]+'</small><div class="cal-sgrid">'+arr.map(function(t){return '<button class="cal-sb" data-x="slot" data-t="'+t+'" aria-pressed="'+(st.start===t)+'">'+hmp(t)+'</button>'}).join('')+'</div></div>'});
    }
    el.innerHTML=html;
  }
  /* — решта — */
  function rExtra(){
    var el=sec('extra');if(!el)return;
    var rule=depositRule(st.client,total()),dpOn=App.db.settings.deposit&&App.db.settings.deposit.on&&mods().deposits!==false;
    var h='<div class="cal-h">Додатково</div>'+
      '<div class="grid2 m1"><label class="fld"><span>Джерело запису</span><select class="sel" data-f="src">'+Object.keys(App.SRC).map(function(k){return '<option value="'+k+'"'+(st.src===k?' selected':'')+'>'+App.SRC[k]+'</option>'}).join('')+'</select></label>'+
      '<label class="fld"><span>Статус</span><select class="sel" data-f="conf"><option value="1"'+(st.confirmed?' selected':'')+'>Підтверджена</option><option value="0"'+(!st.confirmed?' selected':'')+'>Нова (ще не підтверджена)</option></select></label></div>'+
      '<label class="fld" style="margin-top:10px"><span>Нотатка до запису</span><textarea class="ta" rows="2" data-f="note" placeholder="Побажання, хто прийде, що підготувати…">'+esc(st.note)+'</textarea></label>';
    if(dpOn&&!cfg.edit){
      h+='<div class="cal-dep"><label class="fld"><span>Передоплата</span><div class="inp-suf"><input type="number" inputmode="numeric" min="0" step="10" data-f="deposit" value="'+(st.deposit||'')+'" placeholder="0"><span>₴</span></div></label>'+
        (rule&&st.deposit!==rule?'<button class="link" data-x="deprule">За правилами салону: '+U.uah(rule)+' — вказати</button>':'')+
        (st.deposit>0?'<div class="row" style="gap:10px;margin-top:8px"><label class="check" style="min-height:32px"><input type="checkbox" data-f="deppaid"'+(st.depPaid?' checked':'')+'> Внесена</label>'+
          (st.depPaid?'<select class="sel" data-f="depm" style="width:auto;flex:1">'+App.db.pay.filter(function(p){return p.on&&p.id!=='cash'||p.id==='cash'}).map(function(p){return '<option value="'+p.id+'"'+(st.depMethod===p.id?' selected':'')+'>'+esc(p.n)+'</option>'}).join('')+'</select>':'')+'</div>':'')+'</div>';
    }
    el.innerHTML=h;
  }
  /* — підсумок і конфлікти — */
  function rSum(){
    var el=sec('sum');if(!el)return;
    var d=dur(),t=total(),h='';
    var so=st.staff==='any'?null:st.staff;
    var warn='';
    if(st.start!=null&&(st.items.length||cfg.only)){
      var dd=Math.max(d,step);
      var cs=[],who=st.staff;
      if(st.staff==='any'){who=pickFree();if(!who){warn='<div class="note warn">'+I('alert')+'<span>На цей час усі підходящі майстри зайняті.</span></div>'}}
      if(who){cs=App.conflicts(who,st.date,st.start,dd,cfg.exceptId);if(cs.length)warn='<div class="note warn">'+I('alert')+'<span>'+conflictText(cs).map(esc).join('<br>')+'</span></div>'}
      st.autoStaff=who;
    }
    if(!cfg.only)h+='<div class="cal-sumline"><span>'+st.items.length+' '+U.plural(st.items.length,'послуга','послуги','послуг')+' · '+(d?U.dur(d):'—')+(st.start!=null&&d?' · '+hmp(st.start)+'–'+hmp(st.start+d):'')+'</span><b>'+U.uah(t)+'</b></div>';
    else if(st.start!=null)h+='<div class="cal-sumline"><span>'+esc(dShort(st.date))+' · '+hmp(st.start)+(d?'–'+hmp(st.start+d):'')+'</span><b></b></div>';
    if(st.staff==='any'&&st.autoStaff&&st.start!=null)h+='<div class="cal-hint">Буде призначено: <b>'+esc(App.staff(st.autoStaff).n)+'</b></div>';
    el.innerHTML=h+warn;
    if(cfg.onChange)cfg.onChange(st);
  }
  function refreshAll(){rSvc();rWhen();rExtra();rClient();rSum()}
  if(!only){rClient();rSvc()}rWhen();rExtra();rSum();

  /* події */
  root.addEventListener('click',function(e){
    var b=e.target.closest('[data-x]'),cat=e.target.closest('[data-cat]');
    if(cat){st.cat=cat.dataset.cat;$$('[data-cat]',root).forEach(function(c){c.setAttribute('aria-pressed',c===cat)});rList();return}
    if(!b)return;var x=b.dataset.x;
    if(x==='chg'){st.client=null;st.noName=false;st.nc=null;st.cq='';rClient()}
    else if(x==='last'){var lv=st.client&&lastVisit(st.client);if(!lv)return;
      if(!cfg.noAny&&lv.staff&&App.staff(lv.staff)&&App.staff(lv.staff).works!==false)st.staff=lv.staff;
      st.items=copyItems(lv.items).map(function(it){var s=App.svc(it.svc);return s?{svc:s.id,price:App.priceFor(s,staffObj()),d:s.d}:it});
      rClient();rSel();rList();rWhen();rExtra();rSum()}
    else if(x==='noname'){st.client=null;st.noName=true;st.nc=null;st.cq='';rClient();rSum()}
    else if(x==='svcmore'){st.svcOpen=true;svcFold();var qi=root.querySelector('[data-svpick] [data-q]');if(qi)qi.focus()}
    else if(x==='add'){var s=App.svc(b.dataset.id);var was=!st.items.length;st.items.push({svc:s.id,price:App.priceFor(s,staffObj()),d:s.d});st.svcOpen=false;
      rSel();rList();rWhen();rExtra();rSum();
      if(window.matchMedia('(max-width:899px)').matches){var wsec=sec('when');if(wsec&&wsec.scrollIntoView)wsec.scrollIntoView({block:'start'})}
      if(was&&st.staff==='any'){/* підказка */}}
    else if(x==='del'){st.items.splice(+b.dataset.i,1);rSel();rList();rWhen();rExtra();rSum()}
    else if(x==='slot'){st.start=+b.dataset.t;$$('.cal-sb',root).forEach(function(s){s.setAttribute('aria-pressed',+s.dataset.t===st.start)});var tm=root.querySelector('[data-f=time]');if(tm)tm.value=hmp(st.start);rSum()}
    else if(x==='dd'){var n=+b.dataset.n;st.date=n===0||n===1?D.add(T,n):D.add(st.date,n);rWhen();rSum()}
    else if(x==='nfgo'){var box=root.querySelector('[data-nf]');var sid=st.items[0]&&st.items[0].svc;if(!box||!sid)return;
      var r=App.nextFree(sid,{staff:st.staff!=='any'?st.staff:undefined,n:5});
      box.innerHTML=r.length?'<span class="cal-nf-l">Найближче вільне</span>'+r.map(function(x){var m=App.staff(x.staff);return '<button class="chip" data-x="nf" data-d="'+x.date+'" data-t="'+x.start+'" data-m="'+x.staff+'">'+esc(nfDay(x.date))+' '+hmp(x.start)+' · '+esc(m.short.split(' ')[0])+'</button>'}).join(''):'<span class="mute">Найближчі 2 тижні вільного часу немає</span>'}
    else if(x==='nf'){st.date=b.dataset.d;st.start=+b.dataset.t;st.staff=b.dataset.m;rWhen();rSum();UI.toast('Обрано: '+nfDay(st.date)+' '+hmp(st.start))}
    else if(x==='sug'){st.date=b.dataset.d;st.start=+b.dataset.t;if(st.staff==='any'){/* лишаємо any */}else st.staff=b.dataset.m;rWhen();rSum()}
    else if(x==='deprule'){st.deposit=depositRule(st.client,total());rExtra()}
  });
  root.addEventListener('input',function(e){
    var t=e.target,f=t.dataset.f;
    if(t.matches('[data-q]')){if(t.closest('[data-sec=svc]')){st.q=t.value;rList()}return}
    if(!f)return;
    if(f==='d'||f==='price'){var it=st.items[+t.dataset.i];if(!it)return;it[f]=Math.max(0,+t.value||0);if(f==='price')it.custom=true;
      if(f==='d'){rSlots()}rExtra&&0;rSum()}
    else if(f==='note')st.note=t.value;
    else if(f==='deposit')st.deposit=Math.max(0,+t.value||0);
  });
  root.addEventListener('change',function(e){
    var t=e.target,f=t.dataset.f;if(!f)return;
    if(f==='staff'){st.staff=t.value;recalcPrices();rSel();rList();rSlots();rSum()}
    else if(f==='date'){if(t.value){st.date=t.value;rSlots();rSum()}}
    else if(f==='time'){st.start=t.value?U.pm(t.value):null;rSlots();rSum()}
    else if(f==='src')st.src=t.value;
    else if(f==='conf')st.confirmed=t.value==='1';
    else if(f==='deposit'||f==='deppaid'){if(f==='deppaid')st.depPaid=t.checked;rExtra()}
    else if(f==='depm')st.depMethod=t.value;
    else if(f==='d'||f==='price'){rSum()}
  });
  return {
    st:st,
    refresh:refreshAll,
    get:function(){
      if(!only&&!st.items.length)return {error:'Оберіть хоча б одну послугу'};
      if(st.start==null)return {error:'Оберіть час'};
      var who=st.staff==='any'?pickFree():st.staff;
      if(!who){who=cands()[0]&&cands()[0].id}
      if(!who)return {error:'Оберіть майстра'};
      return {staff:who,date:st.date,start:st.start,items:st.items.map(function(x){return {svc:x.svc,price:+x.price||0,d:+x.d||0}}),
        dur:Math.max(dur(),step),client:st.client||null,nc:st.noName?null:ncPending(st),note:st.note.trim(),src:st.src,deposit:st.deposit||0,depPaid:st.depPaid,depMethod:st.depMethod,confirmed:st.confirmed};
    }
  };
}

/* ═════════ App.newAppt ═════════ */
App.newAppt=function(o){
  o=o||{};
  var items=o.items?copyItems(o.items):[];
  if(!items.length&&o.svc){var sv=App.svc(o.svc);if(sv)items=[{svc:sv.id,price:App.priceFor(sv,o.staff&&o.staff!=='any'?App.staff(o.staff):null),d:sv.d}]}
  var me=App.me();
  var init={staff:o.staff||(me.role==='master'?me.id:'any'),date:o.date||(App.cur&&App.cur.rt.id==='calendar'?S.d:App.today()),start:o.start!=null?o.start:null,client:o.client||null,items:items,note:o.note||'',src:o.src||'admin',noName:false};
  if(me.role==='master')init.staff=me.id;
  var tab='appt',form=null,bform=null;
  var m=UI.modal({title:'Новий запис',sub:esc(D.human(init.date,{wd:true})),size:'wide',
    body:'<div class="seg cal-tabs"><button data-t="appt" aria-pressed="true">Запис клієнта</button><button data-t="block" aria-pressed="false">'+I('lock','s')+'Заблокувати час</button></div><div data-pane="appt"></div><div data-pane="block" hidden></div>',
    foot:'<span class="cal-foot-sum" data-fs></span><span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Записати</button>',
    onMount:function(el,close){
      var pa=el.querySelector('[data-pane=appt]'),pb=el.querySelector('[data-pane=block]'),ok=el.querySelector('[data-ok]');
      form=bookingForm(pa,init,{noAny:me.role==='master',nc:true});
      el.querySelector('[data-no]').onclick=close;
      el.querySelectorAll('[data-t]').forEach(function(b){b.onclick=function(){
        tab=b.dataset.t;el.querySelectorAll('[data-t]').forEach(function(x){x.setAttribute('aria-pressed',x===b)});
        pa.hidden=tab!=='appt';pb.hidden=tab!=='block';ok.textContent=tab==='appt'?'Записати':'Заблокувати';
        if(tab==='block'&&!bform)bform=blockForm(pb,init);
      }});
      if(o.block){var tb=el.querySelector('[data-t=block]');if(tb)tb.click()}
      ok.onclick=function(){
        if(tab==='block'){var r=bform.get();if(r.error)return toastErr(r.error);
          var cs=App.conflicts(r.staff,r.date,r.start,r.dur).filter(function(c){return c.type==='overlap'});
          var go2=function(){var a=App.ops.createBlock(r);close();UI.toast('Час заблоковано: '+hmp(r.start)+'–'+hmp(r.start+r.dur),{undo:function(){App.ops.deleteAppt(a.id)}});afterCreate(r.date)};
          if(cs.length)askConflict(cs,'Все одно заблокувати').then(function(y){if(y)go2()});else go2();
          return}
        var r2=form.get();if(r2.error)return toastErr(r2.error);
        var cs2=App.conflicts(r2.staff,r2.date,r2.start,r2.dur);
        var fin=function(){
          if(!r2.client&&r2.nc)r2.client=ncCommit(r2.nc);
          var a=App.ops.createAppt({staff:r2.staff,date:r2.date,start:r2.start,items:r2.items,client:r2.client,status:r2.confirmed?'confirmed':'new',src:r2.src,note:r2.note,deposit:r2.deposit});
          if(r2.deposit>0&&r2.depPaid)App.ops.addPayment({appt:a.id,kind:'deposit',method:r2.depMethod,amount:r2.deposit,staff:r2.staff});
          if(o.wait){if(App.ops.waitSet)App.ops.waitSet(o.wait,'booked');else App.ops.removeWaitlist(o.wait)}
          close();
          UI.toast('Запис створено · '+hmp(r2.start)+' '+App.staff(r2.staff).short.split(' ')[0],{undo:function(){App.ops.deleteAppt(a.id)}});
          afterCreate(r2.date);
        };
        if(cs2.length)askConflict(cs2).then(function(y){if(y)fin()});else fin();
      };
    }});
  function afterCreate(date){
    if(App.cur&&App.cur.rt.id==='calendar'&&S.v==='day'&&date!==S.d)go({d:date});
  }
};

function blockForm(root,init){
  var st={staff:init.staff&&init.staff!=='any'?init.staff:(S.m||(visibleMasters()[0]||{}).id),date:init.date,start:init.start!=null?init.start:Math.max(540,Math.ceil(D.nowMin()/15)*15),dur:init.dur||60,label:init.label?(BLOCK_LABELS.indexOf(init.label)>=0?init.label:'Інше'):'Перерва',custom:init.label&&BLOCK_LABELS.indexOf(init.label)<0?init.label:''};
  var ms=visibleMasters();
  function draw(){
    root.innerHTML='<div class="cal-bf only-when"><div class="cal-bf-r" style="grid-column:1/-1"><div class="note">'+I('info')+'<span>Блок закриває час майстра для записів: перерва, особисті справи, навчання. У виторг і статистику клієнтів не входить.</span></div>'+
      '<div class="grid2 m1" style="margin-top:12px"><label class="fld"><span>Майстер</span><select class="sel" data-f="staff">'+ms.map(function(m){return '<option value="'+m.id+'"'+(st.staff===m.id?' selected':'')+'>'+esc(m.short)+'</option>'}).join('')+'</select></label>'+
      '<label class="fld"><span>Дата</span><input class="inp" type="date" data-f="date" value="'+st.date+'"></label>'+
      '<label class="fld"><span>Початок</span><input class="inp" type="time" data-f="start" value="'+hmp(st.start)+'" step="'+(stepMin()*60)+'"></label>'+
      '<label class="fld"><span>Тривалість, хв</span><input class="inp" type="number" min="5" step="5" data-f="dur" value="'+st.dur+'"></label></div>'+
      '<div class="chips" style="margin-top:10px">'+[30,60,90,120,180,240].map(function(d){return '<button class="chip" data-d="'+d+'" aria-pressed="'+(st.dur===d)+'">'+U.dur(d)+'</button>'}).join('')+'</div>'+
      '<div class="cal-h" style="margin-top:16px">Причина</div><div class="chips">'+BLOCK_LABELS.map(function(l){return '<button class="chip" data-l="'+l+'" aria-pressed="'+(st.label===l)+'">'+l+'</button>'}).join('')+'</div>'+
      '<label class="fld" style="margin-top:10px"><span>Підпис <small>необовʼязково</small></span><input class="inp" data-f="custom" value="'+esc(st.custom)+'" placeholder="Напр. Лікар"></label>'+
      '<div class="cal-hint" data-info style="margin-top:10px"></div></div></div>';
    info();
  }
  function info(){var el=root.querySelector('[data-info]');if(!el)return;
    var cs=App.conflicts(st.staff,st.date,st.start,st.dur).filter(function(c){return c.type==='overlap'});
    el.innerHTML=hmp(st.start)+'–'+hmp(st.start+st.dur)+' · '+U.dur(st.dur)+(cs.length?'<div class="note warn" style="margin-top:8px">'+I('alert')+'<span>'+conflictText(cs).map(esc).join('<br>')+'</span></div>':'')}
  root.addEventListener('click',function(e){var b=e.target.closest('[data-d],[data-l]');if(!b)return;if(b.dataset.d){st.dur=+b.dataset.d;draw()}else{st.label=b.dataset.l;st.custom='';draw()}});
  root.addEventListener('change',function(e){var t=e.target,f=t.dataset.f;if(!f)return;
    if(f==='staff')st.staff=t.value;else if(f==='date')st.date=t.value||st.date;else if(f==='start')st.start=t.value?U.pm(t.value):st.start;else if(f==='dur')st.dur=Math.max(5,+t.value||60);else if(f==='custom')st.custom=t.value;
    if(f==='dur'||f==='custom'){info();return}draw()});
  root.addEventListener('input',function(e){var t=e.target;if(t.dataset.f==='custom')st.custom=t.value;});
  draw();
  return {get:function(){if(!st.staff)return {error:'Оберіть майстра'};return {staff:st.staff,date:st.date,start:st.start,dur:st.dur,label:st.custom.trim()||st.label,note:''}}};
}

/* ═════════ Лист очікування ═════════ */
function waitlistForm(o){
  o=o||{};var d0=S.d<App.today()?App.today():S.d;
  var st={client:o.client||null,svc:o.svc||'',staff:o.staff||'',from:o.from||d0,to:o.to||D.add(o.from||d0,7),note:o.note||''};
  UI.modal({title:'У лист очікування',size:'narrow',
    body:'<div class="col-f g12"><div data-cl></div><label class="fld"><span>Послуга</span><select class="sel" data-f="svc"><option value="">Будь-яка</option>'+App.db.services.filter(function(s){return s.active!==false}).map(function(s){return '<option value="'+s.id+'"'+(st.svc===s.id?' selected':'')+'>'+esc(s.n)+'</option>'}).join('')+'</select></label>'+
      '<label class="fld"><span>Майстер</span><select class="sel" data-f="staff"><option value="">Будь-хто</option>'+mastersAll().map(function(m){return '<option value="'+m.id+'"'+(st.staff===m.id?' selected':'')+'>'+esc(m.short)+'</option>'}).join('')+'</select></label>'+
      '<div class="grid2"><label class="fld"><span>З</span><input class="inp" type="date" data-f="from" value="'+st.from+'"></label><label class="fld"><span>До</span><input class="inp" type="date" data-f="to" value="'+st.to+'"></label></div>'+
      '<label class="fld"><span>Побажання по часу</span><input class="inp" data-f="note" placeholder="Напр. після 17:00" value="'+esc(st.note)+'"></label></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Додати</button>',
    onMount:function(el,close){
      function drawC(){var box=el.querySelector('[data-cl]');var c=st.client&&cl(st.client);
        if(c){box.innerHTML='<div class="cal-cc">'+UI.av(c)+'<span class="t"><b>'+esc(c.n)+'</b><small>'+esc(U.phone(c.ph)||'без телефону')+'</small></span><button class="btn sm" data-chg>Змінити</button></div>';box.querySelector('[data-chg]').onclick=function(){st.client=null;drawC()}}
        else{box.innerHTML='<div class="cal-h">Клієнт</div><div data-p></div>';clientField(box.querySelector('[data-p]'),st,function(){drawC()})}}
      drawC();
      el.addEventListener('change',function(e){var f=e.target.dataset.f;if(f)st[f]=e.target.value});
      el.addEventListener('input',function(e){if(e.target.dataset.f==='note')st.note=e.target.value});
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){
        var pend=ncPending(st);if(!st.client&&!pend)return toastErr('Оберіть клієнта або впишіть імʼя');
        if(st.to<st.from)return toastErr('Дата «До» раніше за «З»');
        if(!st.client)st.client=ncCommit(pend);
        App.ops.setWaitlist({id:U.uid('w'),client:st.client,svc:st.svc,staff:st.staff,from:st.from,to:st.to,note:st.note,created:App.today(),status:'wait'});
        close();UI.toast('Додано до листа очікування',{ms:3500});
      };
    }});
}
function waitSlots(w){
  var sv=App.svc(w.svc),d=sv?sv.d:60,T=App.today();
  var after=null,before=null,mm;
  if(mm=/після\s+(\d{1,2})/i.exec(w.note||''))after=+mm[1]*60;
  if(mm=/до\s+(\d{1,2})/i.exec(w.note||''))before=+mm[1]*60;
  var ms=w.staff?[App.staff(w.staff)]:(sv?matchMasters([{svc:sv.id}]).fit:mastersAll());
  var res=[],from=w.from<T?T:w.from;
  for(var i=0;i<=30&&D.add(from,i)<=w.to;i++){
    var day=D.add(from,i);
    ms.forEach(function(m){
      var slots=App.freeSlots(m.id,day,d).filter(function(t){return (day!==T||t>D.nowMin())&&(after==null||t>=after)&&(before==null||t+d<=before)});
      if(slots.length)res.push({d:day,m:m,slots:slots.slice(0,5),more:Math.max(0,slots.length-5)});
    });
  }
  return res;
}
function waitlistFind(id){
  var w=App.db.waitlist.find(function(x){return x.id===id});if(!w)return;
  var c=cl(w.client),sv=App.svc(w.svc),d=sv?sv.d:60;
  var res=waitSlots(w);
  var body=res.length?'<div class="cal-wfind">'+res.slice(0,12).map(function(r){return '<div class="cal-wfr"><div class="t"><b>'+esc(dShort(r.d))+'</b><small>'+esc(r.m.short)+'</small></div><div class="cal-sgrid">'+r.slots.map(function(t){return '<button class="cal-sb" data-d="'+r.d+'" data-m="'+r.m.id+'" data-t="'+t+'">'+hmp(t)+'</button>'}).join('')+(r.more?'<small class="mute">+'+r.more+'</small>':'')+'</div></div>'}).join('')+'</div>'
    :UI.empty('clock','Вікон поки немає','У вказаний період немає вільного часу для цієї послуги. Спробуйте розширити дати.');
  UI.modal({title:'Знайти вікно',sub:esc((c?c.n:'Без імені')+' · '+(sv?sv.n+' · '+U.dur(d):'будь-яка послуга')+(w.note?' · '+w.note:'')),body:body,size:'narrow',
    onMount:function(el,close){el.addEventListener('click',function(e){var b=e.target.closest('.cal-sb');if(!b)return;close();App.newAppt({staff:b.dataset.m,date:b.dataset.d,start:+b.dataset.t,client:w.client,svc:w.svc||undefined,wait:w.id})})}});
}


/* ═════════ Екран «Лист очікування» (B2.2) ═════════ */
function wlDays(w){var n=D.diff(w.created||App.today(),App.today());return n<=0?'з сьогодні':'чекає '+n+' '+U.plural(n,'день','дні','днів')}
function wlWin(w){return (w.from===w.to?dShort(w.from):dShort(w.from)+' – '+dShort(w.to))}
function wlRow(w,sel){
  var c=cl(w.client),sv=App.svc(w.svc),m=w.staff&&App.staff(w.staff);
  return '<button class="wl-r'+(sel?' is-sel':'')+'" data-act="cal-wl-sel" data-id="'+w.id+'" aria-pressed="'+!!sel+'">'+(c?UI.av(c,''):'<span class="av">?</span>')+
    '<span class="t"><b class="ell">'+esc(c?c.n:'Без імені')+'</b><small class="ell">'+esc(sv?sv.n:'будь-яка послуга')+' · '+esc(m?m.short:'будь-який майстер')+'</small>'+
    '<small class="ell">'+esc(wlWin(w))+(w.note?' · '+esc(w.note):'')+'</small></span>'+
    '<span class="wl-m">'+(w.status==='offered'?'<span class="badge warn">Запропоновано</span>':'')+'<small>'+esc(wlDays(w))+'</small></span></button>';
}
function wlDetail(w){
  var c=cl(w.client),sv=App.svc(w.svc),m=w.staff&&App.staff(w.staff),res=waitSlots(w);
  var h='<div class="wl-d"><div class="wl-dh">'+(c?UI.av(c,''):'')+'<span class="t"><b>'+esc(c?c.n:'Без імені')+'</b><small>'+esc(sv?sv.n+' · '+U.dur(sv.d):'будь-яка послуга')+' · '+esc(m?m.short:'будь-який майстер')+'</small></span></div>'+
    '<dl class="dl cal-dl"><dt>Вікно</dt><dd>'+esc(wlWin(w))+'</dd><dt>Побажання</dt><dd>'+esc(w.note||'—')+'</dd><dt>У листі</dt><dd>'+esc(wlDays(w))+'</dd>'+(c&&c.ph&&App.canSeePhone()?'<dt>Телефон</dt><dd><a href="tel:+'+c.ph+'">'+esc(App.phoneOf(c))+'</a></dd>':'')+'</dl>';
  h+='<h4 class="wl-h">Вільні вікна</h4>';
  if(!res.length)h+=UI.empty('clock','Вікон поки немає','У вказаний період немає вільного часу. Розширте дати або чекайте сигналу — ми підкажемо, коли звільниться.');
  else h+='<div class="cal-wfind">'+res.slice(0,8).map(function(r){return '<div class="cal-wfr"><div class="t"><b>'+esc(dShort(r.d))+'</b><small>'+esc(r.m.short)+'</small></div><div class="cal-sgrid">'+r.slots.map(function(t){return '<button class="cal-sb" data-act="cal-wl-slot" data-id="'+w.id+'" data-d="'+r.d+'" data-m="'+r.m.id+'" data-t="'+t+'">'+hmp(t)+'</button>'}).join('')+(r.more?'<small class="mute">+'+r.more+'</small>':'')+'</div></div>'}).join('')+'</div>';
  h+='<div class="wl-acts"><button class="btn dng" data-act="cal-wl-del2" data-id="'+w.id+'">'+I('trash','s')+'Прибрати</button><span class="sp"></span>'+
    (res.length?'<button class="btn" data-act="cal-wl-offer" data-id="'+w.id+'">'+I('msg','s')+'Запропонувати</button><button class="btn pri" data-act="cal-wl-book" data-id="'+w.id+'">'+I('plus','s')+'Записати</button>':'<button class="btn pri" data-act="cal-wl-book" data-id="'+w.id+'">'+I('plus','s')+'Записати</button>')+'</div></div>';
  return h;
}
function wlList(){return (App.db.waitlist||[]).filter(function(w){var s=w.status||'wait';return s==='wait'||s==='offered'}).sort(function(a,b){return (a.created||'')<(b.created||'')?-1:1})}
var WL={sel:''};
App.route('waitlist',{title:'Лист очікування',icon:'clock',nav:true,group:'work',order:3.5,module:'waitlist',perm:'calendar.all',
  count:function(){return (App.db.waitlist||[]).filter(function(w){return (w.status||'wait')==='wait'}).length||''},
  render:function(view,params,q){
    var L=wlList();q=q||{};
    if(q.id&&L.find(function(w){return w.id===q.id}))WL.sel=q.id;
    if(!L.find(function(w){return w.id===WL.sel}))WL.sel=isMob()?'':(L[0]||{}).id||'';
    App.setTop(isMob()?'<button class="icobtn" data-act="cal-wl-add" aria-label="Додати в лист">'+I('plus')+'</button>':'<button class="btn" data-act="cal-wl-add">'+I('plus','s')+'Додати клієнта</button>');
    if(!L.length){view.innerHTML='<div class="wl wl-empty">'+UI.empty('clock','Ніхто не чекає','Коли зручного часу немає — додайте клієнта сюди, і ми підкажемо, коли звільниться вікно.','<button class="btn pri" data-act="cal-wl-add" style="margin-top:8px">'+I('plus','s')+'Додати клієнта</button>')+'</div>';return}
    var w=L.find(function(x){return x.id===WL.sel});
    view.innerHTML='<div class="wl"><div class="wl-list card"><div class="wl-lh"><b>Чекають</b><span class="pill-n">'+L.length+'</span></div>'+L.map(function(x){return wlRow(x,!isMob()&&x.id===WL.sel)}).join('')+'</div>'+
      (isMob()?'':'<div class="wl-side card">'+(w?wlDetail(w):'')+'</div>')+'</div>';
  }});
act('wl-sel',function(el){var id=el.dataset.id;WL.sel=id;
  if(isMob()){var w=App.db.waitlist.find(function(x){return x.id===id});if(!w)return;var c=cl(w.client);
    UI.drawer({title:esc(c?c.n:'Лист очікування'),body:wlDetail(w).replace('<div class="wl-acts">','<div class="wl-acts sheet-foot">'),size:'wl-sheet'});return}
  App.refresh()});
function wlCloseOv(){if($('.ov'))UI.closeAll()}
act('wl-slot',function(el){var w=App.db.waitlist.find(function(x){return x.id===el.dataset.id});if(!w)return;wlCloseOv();
  App.newAppt({staff:el.dataset.m,date:el.dataset.d,start:+el.dataset.t,client:w.client,svc:w.svc||undefined,wait:w.id})});
act('wl-book',function(el){var w=App.db.waitlist.find(function(x){return x.id===el.dataset.id});if(!w)return;var r=waitSlots(w)[0];wlCloseOv();
  App.newAppt({staff:r?r.m.id:(w.staff||undefined),date:r?r.d:w.from,start:r?r.slots[0]:undefined,client:w.client,svc:w.svc||undefined,wait:w.id})});
act('wl-offer',function(el){var w=App.db.waitlist.find(function(x){return x.id===el.dataset.id});if(!w)return;var c=cl(w.client),r=waitSlots(w)[0];
  if(!c)return toastErr('Клієнта не знайдено');
  var fake={client:c.id,items:w.svc?[{svc:w.svc}]:[],staff:r?r.m.id:w.staff,date:r?r.d:w.from,start:r?r.slots[0]:0};
  var txt=fillTpl('wait',fake),ch=c.tg?'tg':c.ph?'viber':'';
  if(!ch)return UI.toast('У клієнта немає Telegram/Viber — зателефонуйте',{type:'err'});
  UI.modal({title:'Запропонувати вікно',sub:esc(c.n)+' · '+(ch==='tg'?'Telegram':'Viber'),size:'narrow cal-nc',body:'<div class="bubble me">'+esc(txt)+'</div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Ні</button><button class="btn pri" data-ok>'+I('msg','s')+'Надіслати</button>',
    onMount:function(m,close){m.querySelector('[data-no]').onclick=close;m.querySelector('[data-ok]').onclick=function(){
      App.ops.sendMsg({client:c.id,ch:ch,tpl:'wait',txt:txt});App.ops.waitSet(w.id,'offered');close();wlCloseOv();UI.toast('Пропозицію надіслано · '+esc(U.short(c.n)))}}});
});
act('wl-del2',function(el){var id=el.dataset.id;var w=App.db.waitlist.find(function(x){return x.id===id});if(!w)return;var c=cl(w.client);
  UI.confirm({title:'Прибрати з листа?',text:esc(c?c.n:'Клієнт')+' більше не чекатиме вільного вікна.',ok:'Прибрати',danger:true}).then(function(y){if(!y)return;
    var prev=w.status||'wait';App.ops.waitSet(id,'removed');wlCloseOv();UI.toast('Прибрано з листа очікування',{undo:function(){App.ops.waitSet(id,prev)}})})});

/* ═════════ App.openAppt — картка запису (drawer) ═════════ */
var DR=null; /* поточний drawer: {id,el,render} */
App.on('change',function(){if(DR&&DR.el&&document.body.contains(DR.el)){try{DR.render()}catch(e){console.error(e)}}else DR=null});
function fmtTs(ts){if(!ts)return '';var d=ts.slice(0,10),t=ts.slice(11,16);return (d===App.today()?'сьогодні':D.shortH(d))+(t?', '+t:'')}
function whoName(id){var s=App.staff(id);return s?s.short:'—'}
function stDot(st){return '<span class="cal-dot st-'+statusCls(st)+'"></span>'}

App.openAppt=function(id){
  var a=App.appt(id);if(!a)return UI.toast('Запис не знайдено',{type:'err'});
  if(!canAll()&&a.staff!==App.db.meId)return UI.toast('Це запис іншого майстра',{type:'err'});
  if(isBlock(a))return openBlock(id);
  UI.closeAll();
  var drawer=UI.drawer({title:'',body:'',foot:'<div class="cal-dfoot"></div>',onClose:function(){DR=null}});
  var el=drawer.el;
  var h3=el.querySelector('h3'),body=el.querySelector('.modal-b'),foot=el.querySelector('.cal-dfoot');
  el.classList.add('cal-dr');
  function render(){
    var a=App.appt(id);if(!a){drawer.close();return}
    var c=a.client&&cl(a.client),m=App.staff(a.staff),st=c?App.clientStats(c.id):null;
    var total=App.apptTotal(a),disc=App.apptDiscount(a),paid=App.apptPaid(a),dep=depositPaid(a),due=App.apptDue(a);
    var pays=App.apptPays(a);
    var T=App.today();
    h3.innerHTML=esc(cname(a))+'<small>'+esc(D.human(a.date,{wd:true}))+' · '+hmp(a.start)+'–'+hmp(App.apptEnd(a))+'</small>';
    var h='<div class="cal-d">';
    /* стан */
    h+='<div class="cal-d-top">'+UI.badge(a.status)+(a.clientOk?'<span class="cal-cok">'+I('check','s')+'клієнт підтвердив</span>':a.status==='new'?'<span class="mute">Клієнт ще не підтвердив візит</span>':'')+
       (needDeposit(a)?'<span class="badge warn">Очікує передоплати</span><span class="mute">тримаємо слот ще '+(((App.db.settings.deposit||{}).holdMin)||24)+' хв</span>':'')+
       (isLate(a)?'<span class="badge dng">Запізнюється</span>':'')+
       (c&&st&&st.visits===0&&a.status!=='done'?'<span class="badge plain">Перший візит</span>':'')+
       (a.status==='cancelled'&&a.cancelReason?'<span class="mute">'+esc(a.cancelReason)+(a.lateCancel?' · пізнє скасування':'')+'</span>':'')+'</div>';
    /* клієнт */
    if(c){
      var seePh=App.canSeePhone(),rk=App.apptRisks(a),nx=st.next&&st.next.id!==a.id?st.next:null;
      h+='<div class="cal-d-cl"><button class="cal-cc click" data-d="client">'+UI.av(c,'')+'<span class="t"><b>'+esc(c.n)+(c.tags.indexOf('vip')>=0?' <span class="tag">VIP</span>':'')+'</b><small>'+(c.ph?(seePh?esc(App.phoneOf(c)):'телефон приховано'):'без телефону')+'</small></span>'+risksHtml(a)+I('right','s')+'</button>'+
        (rk.length?'<div class="cal-d-rk">'+rk.map(function(x){var m=RISK_IC[x.k]||['info',''];return '<span class="risk-l">'+I(m[0],m[1])+esc(x.t)+'</span>'}).join('')+'</div>':'')+
        '<div class="cal-d-ca">'+(c.ph&&c.tg?'<a class="btn sm" href="tg://resolve?phone='+c.ph+'">'+I('tg','s')+'Telegram</a>':'')+(c.ph?'<a class="btn sm" href="viber://chat?number=%2B'+c.ph+'">'+I('msg','s')+'Viber</a>':'')+(c.ph&&seePh?'<a class="btn sm" href="tel:+'+c.ph+'">'+I('phone','s')+'Подзвонити</a>':'')+'</div>'+
        '<div class="cal-d-st"><span>Останній: <b>'+(st.last?esc(D.shortH(st.last.date)):'—')+'</b></span><span>Наступний: <b>'+(nx?esc(D.shortH(nx.date))+' '+hmp(nx.start):'—')+'</b></span><span><b>'+st.visits+'</b> '+U.plural(st.visits,'візит','візити','візитів')+'</span>'+(st.noshow?'<span><b class="warn-t">'+st.noshow+'</b> не прийшов</span>':'')+'</div>'+
        (c.blocked?'<div class="note dng">'+I('ban')+'<span>Клієнт у чорному списку.</span></div>':'')+
        (c.tags.indexOf('allergy')>=0||c.note?'<div class="note warn">'+I('alert')+'<span>'+(c.tags.indexOf('allergy')>=0?'<b>Алергія. </b>':'')+esc(c.note||'')+'</span></div>':'')+'</div>';
    }else h+='<div class="cal-d-cl"><div class="cal-cc"><span class="av">?</span><span class="t"><b>Без імені</b><small>Швидкий запис</small></span><button class="btn sm" data-d="setclient">Обрати клієнта</button></div></div>';
    /* послуги */
    h+='<section class="cal-d-s"><h4>Послуги</h4><div class="cal-d-svc">'+a.items.map(function(x){var s=App.svc(x.svc);return '<div class="r"><span class="ell">'+esc(s?s.n:x.svc)+'<small>'+U.dur(x.d)+'</small></span><b>'+U.uah(x.price)+'</b></div>'}).join('')+
      (disc?'<div class="r mute"><span>Знижка'+(a.discount.type==='pct'?' '+a.discount.v+'%':'')+'</span><b>−'+U.uah(disc)+'</b></div>':'')+
      '<div class="r tot"><span>Разом</span><b>'+U.uah(total)+'</b></div></div></section>';
    /* коли / хто */
    h+='<section class="cal-d-s"><h4>Деталі</h4><dl class="dl cal-dl"><dt>Майстер</dt><dd>'+(m?UI.av(m,'xs')+' '+esc(m.n):'—')+'</dd><dt>Дата</dt><dd>'+esc(D.human(a.date,{wd:true,year:true}))+'</dd><dt>Час</dt><dd>'+hmp(a.start)+'–'+hmp(App.apptEnd(a))+' · '+U.dur(App.apptDur(a))+'</dd>'+
      '<dt>Джерело</dt><dd>'+esc(App.SRC[a.src]||a.src)+'</dd>'+
      (a.deposit>0||dep>0?'<dt>Передоплата</dt><dd>'+(dep>0?'<span class="ok-t">'+U.uah(dep)+' внесено</span>':'<span class="warn-t">'+U.uah(a.deposit)+' очікується</span>'+(canPay()?' <button class="link" data-d="dep">Внести</button>':''))+'</dd>':'')+
      (a.status==='done'||paid?'<dt>Оплачено</dt><dd>'+U.uah(paid)+(due>0?' · <span class="warn-t">борг '+U.uah(due)+'</span>':'')+'</dd>':'')+
      (App.apptTips(a)?'<dt>Чайові</dt><dd>'+U.uah(App.apptTips(a))+'</dd>':'')+
      '<dt>Створено</dt><dd>'+esc(fmtTs(a.created))+'</dd></dl></section>';
    /* нотатка */
    h+='<section class="cal-d-s"><h4>Нотатка <button class="link" data-d="note">'+(a.note?'Змінити':'Додати')+'</button></h4>'+(a.note?'<div class="cal-d-note">'+esc(a.note)+'</div>':'<div class="mute" style="font-size:13px">Немає нотаток</div>')+'</section>';
    /* оплати */
    var pr=pays.filter(function(p){return p.kind!=='cert_sale'&&p.kind!=='abon_sale'});
    if(pr.length){
      var KIND={service:'Оплата',deposit:'Передоплата',tip:'Чайові',product:'Товар',cert:'Сертифікат',abon:'Абонемент',refund:'Повернення'};
      h+='<section class="cal-d-s"><h4>Платежі</h4><div class="cal-d-pay">'+pr.map(function(p){return '<div class="r"><span>'+I(App.payMethod(p.method).ic||'coins','s')+'<span>'+esc(KIND[p.kind]||p.kind)+' · '+esc(App.payMethod(p.method).n||p.method)+'<small>'+esc(fmtTs(p.ts))+(p.note?' · '+esc(p.note):'')+'</small></span></span><b class="'+(p.amount<0?'dng-t':'')+'">'+U.uah(p.amount)+'</b>'+
        (canPay()&&p.amount>0&&(p.kind==='service'||p.kind==='deposit'||p.kind==='product'||p.kind==='tip')?'<button class="link" data-d="refund" data-p="'+p.id+'">Повернути</button>':'')+'</div>'}).join('')+'</div></section>';
    }
    /* дії */
    var acts=[];
    if(a.status==='new'||a.status==='confirmed'||a.status==='arrived'){
      acts.push(['move','Перенести','move']);acts.push(['edit','Редагувати','edit']);
      if(a.status!=='arrived')acts.push(['noshow','Не прийшов(ла)','ban']);
      acts.push(['cancel','Скасувати','x']);
    }
    if(a.status==='noshow'||a.status==='cancelled')acts.push(['restore','Відновити запис','undo']);
    acts.push(['repeat','Повторити запис','repeat']);acts.push(['dup','Дублювати','copy']);
    if(a.status==='done')acts.push(['edit','Редагувати','edit']);
    acts.push(['del','Видалити','trash',1]);
    DRACTS=acts;
    /* історія */
    var ev=(a.events||[]).slice().reverse();
    if(ev.length)h+='<section class="cal-d-s"><h4>Історія</h4><div class="cal-d-hist">'+ev.map(function(e){return '<div class="r"><i></i><span>'+esc(e.txt)+'<small>'+esc(fmtTs(e.ts))+' · '+esc(whoName(e.who))+'</small></span></div>'}).join('')+'</div></section>';
    body.innerHTML=h+'</div>';
    /* футер */
    var f='';
    var more='<button class="icobtn cal-dmore" data-d="more" aria-label="Інші дії" title="Перенести, скасувати, повторити…">'+I('more')+'</button>';
    if(a.status==='new')f='<button class="btn pri big" data-d="st" data-s="confirmed">'+I('check')+'Підтвердити</button>';
    else if(a.status==='confirmed')f='<button class="btn pri big" data-d="st" data-s="arrived">'+I('check')+'Прийшов(ла)</button>';
    else if(a.status==='arrived')f=canPay()?'<button class="btn pri big" data-d="pay">'+I('wallet')+'Оплата · '+U.uah(Math.max(0,total-paid))+'</button>':'<span class="mute">Оплату приймає адміністратор</span>';
    else if(a.status==='done')f=(due>0&&canPay()?'<button class="btn pri big" data-d="pay">Доплатити '+U.uah(due)+'</button>':'<button class="btn pri big" data-d="repeat">'+I('repeat')+'Записати знову</button>');
    else if(a.status==='noshow')f='<span class="mute">Клієнт не прийшов</span>';
    else f='<span class="mute">Запис скасовано</span>';
    foot.innerHTML=more+f;
  }
  var DRACTS=[];
  DR={id:id,el:el,render:render};
  render();
  function onClick(e){
    var b=e.target.closest('[data-d]');if(!b)return;var k=b.dataset.d,a=App.appt(id);if(!a)return;
    if(k==='client'){var cid=a.client;drawer.close();App.openClient(cid)}
    else if(k==='setclient'){pickClientModal(a)}
    else if(k==='more'){var L=[];
      if(a.status==='new')L.push({ic:'check',t:'Прийшов(ла)',fn:function(){setStatus(a,'arrived')}});
      if(a.status==='done')L.push({ic:'receipt',t:'Чек',fn:function(){showReceipt(id)}});
      DRACTS.forEach(function(x){if(x[0]==='move'){L.push({ic:'move',t:'Перенести (обрати в календарі)',fn:function(){App.moveAppt(id)}});L.push({ic:'cal',t:'Перенести (форма)',fn:function(){rescheduleAppt(App.appt(id))}});return}
        L.push({ic:x[2],t:x[1],dng:!!x[3]||x[0]==='cancel',fn:function(){onClick({target:{closest:function(){return {dataset:{d:x[0]}}}}})}})});
      if(a.client&&(a.status==='new'||a.status==='confirmed')){L.push('-');
        L.push({ic:'spark',t:'Демо: клієнт відповів «Так»',fn:function(){App.ops.simReply(id,'yes');UI.toast('Клієнт підтвердив запис')}});
        L.push({ic:'spark',t:'Демо: клієнт просить перенести',fn:function(){App.ops.simReply(id,'move');UI.toast('Клієнт просить перенести — сповіщення в дзвіночку')}});
        L.push({ic:'spark',t:'Демо: клієнт скасував',fn:function(){var fr={staff:a.staff,date:a.date,start:a.start,dur:App.apptDur(a)};App.ops.simReply(id,'no');UI.toast('Клієнт скасував у месенджері');waitSignal(fr)}});}
      UI.menu(b,L)}
    else if(k==='st'){setStatus(a,b.dataset.s)}
    else if(k==='pay'){App.checkout(id)}
    else if(k==='receipt'){showReceipt(id)}
    else if(k==='move')rescheduleAppt(a);
    else if(k==='edit')editAppt(a);
    else if(k==='noshow')markNoshow(a);
    else if(k==='cancel')cancelAppt(a);
    else if(k==='restore')setStatus(a,'confirmed');
    else if(k==='repeat')repeatMenu(b.getBoundingClientRect?b:el.querySelector('.cal-dmore'),a);
    else if(k==='dup')App.newAppt({items:a.items,client:a.client,staff:a.staff,date:a.date,start:Math.min(1380,App.apptEnd(a)),note:a.note});
    else if(k==='del')deleteAppt(a,drawer);
    else if(k==='note')editNote(a);
    else if(k==='refund')refundForm(a,b.dataset.p);
    else if(k==='dep')depositForm(a);
  }
  el.addEventListener('click',onClick);
};
function isLate(a){
  if(a.status!=='new'&&a.status!=='confirmed')return false;
  return a.date===App.today()&&D.nowMin()>a.start+10;
}
function setStatus(a,st){
  var prev=a.status;
  App.ops.setStatus(a.id,st);
  UI.toast(({confirmed:'Підтверджено',arrived:'Клієнт прийшов',noshow:'Позначено: не прийшов',new:'Статус змінено'})[st]||'Статус змінено',{undo:function(){App.ops.setStatus(a.id,prev)}});
}
function markNoshow(a){
  var c=a.client&&cl(a.client),n=c?App.clientStats(c.id).noshow:0,ns=App.db.settings.noshow||{};
  var txt='Статус зміниться на «Не прийшов(ла)». Запис перестане займати час майстра в статистиці.'+(depositPaid(a)>0?'<br>Передоплату '+esc(U.uah(depositPaid(a)))+' буде утримано.':'')+(c&&ns.blockAt&&n+1>=ns.blockAt?'<br><b>Це '+(n+1)+'-й неприхід — клієнт досягне ліміту для чорного списку.</b>':'');
  UI.confirm({title:'Не прийшов(ла)?',text:txt,ok:'Так, не прийшов(ла)'}).then(function(y){if(y)setStatus(a,'noshow')});
}
function cancelAppt(a){
  var hrs=(App.db.settings.booking||{}).cancelHours||12;
  var startTs=D.parse(a.date).getTime()+a.start*60000,hoursLeft=(startTs-Date.now())/36e5;
  var late=hoursLeft<hrs,dep=depositPaid(a);
  var REASONS=['Клієнт захворів','Перенесла на інший день','Не встигає','Передумала','Помилковий запис','Майстер захворів'];
  var st={reason:'',late:late,refund:dep>0&&!late};
  var m=UI.modal({title:'Скасувати запис?',sub:esc(cname(a)+' · '+D.shortH(a.date)+' '+hmp(a.start)),size:'narrow',
    body:'<div class="cal-h">Причина</div><div class="chips cal-rs-ch">'+REASONS.map(function(r){return '<button class="chip" data-r="'+esc(r)+'" aria-pressed="false">'+esc(r)+'</button>'}).join('')+'</div>'+
      '<label class="fld" style="margin-top:10px"><span>Або своя причина</span><input class="inp" data-c placeholder="Коментар"></label>'+
      '<label class="check" style="margin-top:12px"><input type="checkbox" data-late'+(late?' checked':'')+'> Пізнє скасування <small class="mute">(менш ніж за '+hrs+' год)</small></label>'+
      (dep>0?'<label class="check" style="margin-top:8px"><input type="checkbox" data-ref'+(st.refund?' checked':'')+'> Повернути передоплату '+esc(U.uah(dep))+'</label>':''),
    foot:'<span class="sp"></span><button class="btn" data-no>Назад</button><button class="btn pri dng" data-ok>Скасувати запис</button>',
    onMount:function(el,close){
      el.addEventListener('click',function(e){var b=e.target.closest('[data-r]');if(!b)return;st.reason=b.dataset.r;$$('[data-r]',el).forEach(function(x){x.setAttribute('aria-pressed',x===b)});el.querySelector('[data-c]').value=''});
      el.querySelector('[data-c]').oninput=function(){st.reason=this.value;$$('[data-r]',el).forEach(function(x){x.setAttribute('aria-pressed','false')})};
      var lt=el.querySelector('[data-late]');lt.onchange=function(){st.late=lt.checked;var r=el.querySelector('[data-ref]');if(r){r.checked=!st.late;st.refund=r.checked}};
      var rf=el.querySelector('[data-ref]');if(rf)rf.onchange=function(){st.refund=rf.checked};
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){
        var prev=a.status,freed={staff:a.staff,date:a.date,start:a.start,dur:App.apptDur(a)};
        App.ops.setStatus(a.id,'cancelled',{reason:st.reason||'Без причини',late:st.late});
        setTimeout(function(){afterChange(App.appt(a.id)||a,'cancel',freed)},30);
        if(st.refund&&dep>0){var dp=App.apptPays(a).filter(function(p){return p.kind==='deposit'&&p.amount>0})[0];App.ops.refund(a.id,dep,dp?dp.method:'cash','Скасування запису')}
        close();
        UI.toast('Запис скасовано'+(st.refund&&dep?' · передоплату повернено':''),st.refund&&dep?{}:{undo:function(){App.ops.setStatus(a.id,prev)}});
      };
    }});
}
function deleteAppt(a,drawer){
  UI.confirm({title:'Видалити запис?',text:'Запис «'+esc(cname(a))+'» '+esc(D.shortH(a.date)+' '+hmp(a.start))+' буде видалено разом з платежами. Для звичайного скасування краще скористатись «Скасувати».',ok:'Видалити',danger:true}).then(function(y){
    if(!y)return;var copy=JSON.parse(JSON.stringify(a)),pays=JSON.parse(JSON.stringify(App.apptPays(a)));
    if(drawer)drawer.close();
    App.ops.deleteAppt(a.id);
    UI.toast('Запис видалено',{undo:function(){App.ops.restoreAppt(copy,pays)}});
  });
}
function editNote(a){
  UI.modal({title:'Нотатка до запису',size:'narrow',body:'<textarea class="ta" data-n rows="4" placeholder="Побажання, нагадування…">'+esc(a.note||'')+'</textarea>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
    onMount:function(el,close){var t=el.querySelector('[data-n]');el.querySelector('[data-no]').onclick=close;el.querySelector('[data-ok]').onclick=function(){App.ops.updateAppt(a.id,{note:t.value.trim()},'Змінено нотатку');close();UI.toast('Збережено')}}});
}
function pickClientModal(a){
  UI.modal({title:'Клієнт запису',size:'narrow',body:'<div data-p></div>',onMount:function(el,close){
    UI.clientPicker(el.querySelector('[data-p]'),function(c){App.ops.updateAppt(a.id,{client:c.id},'Призначено клієнта: '+c.n);close();UI.toast('Клієнта додано до запису')})}});
}
function depositForm(a){
  var need=a.deposit||0;
  UI.modal({title:'Внести передоплату',size:'narrow',body:'<div class="col-f g12"><label class="fld"><span>Сума</span><div class="inp-suf"><input class="inp" type="number" min="0" step="10" data-a value="'+need+'"><span>₴</span></div></label><label class="fld"><span>Спосіб</span><select class="sel" data-m>'+App.db.pay.filter(function(p){return p.on}).map(function(p){return '<option value="'+p.id+'"'+(p.id==='mono'?' selected':'')+'>'+esc(p.n)+'</option>'}).join('')+'</select></label></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Внести</button>',
    onMount:function(el,close){el.querySelector('[data-no]').onclick=close;el.querySelector('[data-ok]').onclick=function(){
      var v=Math.round(+el.querySelector('[data-a]').value||0);if(v<=0)return toastErr('Вкажіть суму');
      App.ops.addPayment({appt:a.id,kind:'deposit',method:el.querySelector('[data-m]').value,amount:v,staff:a.staff,note:'Передоплата'});
      App.ops.updateAppt(a.id,{deposit:Math.max(a.deposit||0,v)},'Внесено передоплату '+U.uah(v));close();UI.toast('Передоплату внесено')}}});
}
function refundForm(a,pid){
  var p=App.db.payments.find(function(x){return x.id===pid});if(!p)return;
  UI.modal({title:'Повернення коштів',sub:esc(App.payMethod(p.method).n+' · '+U.uah(p.amount)),size:'narrow',
    body:'<div class="col-f g12"><label class="fld"><span>Сума повернення</span><div class="inp-suf"><input class="inp" type="number" min="1" max="'+p.amount+'" data-a value="'+p.amount+'"><span>₴</span></div></label><label class="fld"><span>Спосіб</span><select class="sel" data-m>'+App.db.pay.map(function(x){return '<option value="'+x.id+'"'+(x.id===p.method?' selected':'')+'>'+esc(x.n)+'</option>'}).join('')+'</select></label><label class="fld"><span>Причина</span><input class="inp" data-r placeholder="Напр. клієнт незадоволений"></label></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri dng" data-ok>Повернути</button>',
    onMount:function(el,close){el.querySelector('[data-no]').onclick=close;el.querySelector('[data-ok]').onclick=function(){
      var v=Math.round(+el.querySelector('[data-a]').value||0);if(v<=0||v>p.amount)return toastErr('Сума має бути від 1 до '+p.amount);
      App.ops.refund(a.id,v,el.querySelector('[data-m]').value,el.querySelector('[data-r]').value.trim());close();UI.toast('Повернено '+U.uah(v))}}});
}
function repeatMenu(anchor,a){
  var weeks=[2,3,4,6,8];
  UI.menu(anchor,weeks.map(function(w){var d=D.add(a.date,w*7);return {t:'Через '+w+' '+U.plural(w,'тиждень','тижні','тижнів')+' · '+dShort(d),ic:'repeat',fn:function(){
    UI.closeAll();App.newAppt({items:a.items,client:a.client,staff:a.staff,date:d,start:a.start})}}}));
}
function editAppt(a){
  var m=UI.modal({title:'Редагувати запис',sub:esc(cname(a)),size:'wide',body:'<div data-f></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
    onMount:function(el,close){
      var form=bookingForm(el.querySelector('[data-f]'),{client:a.client,staff:a.staff,date:a.date,start:a.start,items:a.items,note:a.note,src:a.src,deposit:a.deposit,status:a.status,extra:a.extra},{edit:true,exceptId:a.id,noAny:true,allowPast:true});
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){
        var r=form.get();if(r.error)return toastErr(r.error);
        var cs=App.conflicts(r.staff,r.date,r.start,r.dur,a.id);
        var save=function(){
          var patch={staff:r.staff,date:r.date,start:r.start,items:r.items,note:r.note,src:r.src};
          if(a.status==='new'||a.status==='confirmed')patch.status=r.confirmed?'confirmed':'new';
          if(r.client!==a.client)patch.client=r.client;
          var old=JSON.parse(JSON.stringify({staff:a.staff,date:a.date,start:a.start,items:a.items,note:a.note,src:a.src,status:a.status,client:a.client}));
          App.ops.updateAppt(a.id,patch,'Запис відредаговано');close();
          UI.toast('Зміни збережено',{undo:function(){App.ops.updateAppt(a.id,old,'Редагування скасовано')}});
        };
        if(cs.length)askConflict(cs,'Все одно зберегти').then(function(y){if(y)save()});else save();
      };
    }});
}
function rescheduleAppt(a){
  UI.modal({title:'Перенести запис',sub:esc(cname(a)+' · '+App.apptTitle(a)),size:'narrow',body:'<div data-f></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Перенести</button>',
    onMount:function(el,close){
      var form=bookingForm(el.querySelector('[data-f]'),{staff:a.staff,date:a.date,start:null,items:a.items,extra:a.extra},{only:'when',edit:true,exceptId:a.id,noAny:true});
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){
        var r=form.get();if(r.error)return toastErr(r.error);
        var cs=App.conflicts(r.staff,r.date,r.start,App.apptDur(a),a.id);
        var old={staff:a.staff,date:a.date,start:a.start};
        var go2=function(){App.ops.updateAppt(a.id,{staff:r.staff,date:r.date,start:r.start});close();S.move='';
          afterChange(a,'move',{staff:old.staff,date:old.date,start:old.start,dur:App.apptDur(a)});
          UI.toast('Перенесено: '+D.shortH(r.date)+' '+hmp(r.start),{undo:function(){App.ops.updateAppt(a.id,old,'Перенесення скасовано')}});
          if(App.cur&&App.cur.rt.id==='calendar'&&S.v==='day'&&r.date!==S.d)go({d:r.date})};
        if(cs.length)askConflict(cs).then(function(y){if(y)go2()});else go2();
      };
    }});
}
/* ── блок часу ── */
function openBlock(id){
  var a=App.appt(id);UI.closeAll();
  var m=App.staff(a.staff);
  UI.modal({title:esc(a.label||'Блок часу'),sub:esc(D.human(a.date,{wd:true})+' · '+hmp(a.start)+'–'+hmp(App.apptEnd(a))),size:'narrow',
    body:'<div class="note">'+I('lock')+'<span>Час закритий для записів. У виторг не входить.</span></div><dl class="dl cal-dl" style="margin-top:12px"><dt>Майстер</dt><dd>'+esc(m?m.n:'')+'</dd><dt>Тривалість</dt><dd>'+U.dur(App.apptDur(a))+'</dd></dl>',
    foot:'<button class="btn dng-o" data-del>'+I('trash','s')+'Видалити</button><span class="sp"></span><button class="btn" data-edit>Змінити</button>',
    onMount:function(el,close){
      el.querySelector('[data-del]').onclick=function(){var copy=JSON.parse(JSON.stringify(a));close();App.ops.deleteAppt(id);UI.toast('Блок видалено',{undo:function(){App.ops.restoreAppt(copy,[])}})};
      el.querySelector('[data-edit]').onclick=function(){close();editBlock(a)};
    }});
}
function editBlock(a){
  UI.modal({title:'Змінити блок',size:'wide',body:'<div data-f></div>',foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
    onMount:function(el,close){
      var f=blockForm(el.querySelector('[data-f]'),{staff:a.staff,date:a.date,start:a.start,dur:App.apptDur(a),label:a.label});
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){var r=f.get();if(r.error)return toastErr(r.error);
        var old={staff:a.staff,date:a.date,start:a.start,extra:a.extra,label:a.label};
        App.ops.updateAppt(a.id,{staff:r.staff,date:r.date,start:r.start,extra:r.dur,label:r.label},'Блок змінено');close();UI.toast('Блок збережено',{undo:function(){App.ops.updateAppt(a.id,old,'Скасовано')}})};
    }});
}

/* ═════════ App.checkout — каса візиту ═════════ */
function certOk(g){return g&&g.status!=='used'&&g.balance>0&&(!g.expires||g.expires>=App.today())}
App.checkout=function(id){
  var a=App.appt(id);if(!a)return UI.toast('Запис не знайдено',{type:'err'});
  if(isBlock(a))return;
  if(!canPay())return UI.toast('Оплату приймає адміністратор',{type:'err'});
  if(a.status==='cancelled'||a.status==='noshow')return UI.toast('Запис скасовано або клієнт не прийшов — спочатку відновіть його',{type:'err'});
  if(a.status==='done'&&App.apptDue(a)<=0)return showReceipt(id);
  UI.closeAll();
  var c=a.client&&cl(a.client);
  var mods_=mods(),payM=App.db.pay.filter(function(p){return p.on});
  var st={items:a.items.map(function(x){return {svc:x.svc,price:x.price,d:x.d}}),dtype:a.discount?a.discount.type:'pct',dv:a.discount?a.discount.v:0,
    prods:{},cert:null,abon:null,lines:{},touched:false,given:0,tipV:0,tipM:'card',paying:false};
  var origPrices=JSON.stringify(a.items.map(function(x){return x.price}));
  function gross(){return U.sum(st.items,function(x){return +x.price||0})}
  function disc(){var g=gross();if(!st.dv)return 0;return st.dtype==='pct'?Math.round(g*Math.min(100,st.dv)/100):Math.min(g,st.dv)}
  function svcTotal(){return gross()-disc()}
  function prodTotal(){var s=0;Object.keys(st.prods).forEach(function(k){var p=App.db.products.find(function(x){return x.id===k});if(p)s+=p.price*st.prods[k]});return s}
  function already(){return Math.min(App.apptPaid(a),svcTotal())}
  function certAmt(){if(!st.cert)return 0;var g=App.db.certs.find(function(x){return x.id===st.cert.id});if(!g)return 0;return Math.max(0,Math.min(st.cert.amount,g.balance,svcTotal()-already()))}
  function abonAmt(){if(!st.abon)return 0;var ab=App.db.abons.find(function(x){return x.id===st.abon.id});if(!ab)return 0;return Math.max(0,Math.min(Math.round(ab.price/ab.qty),svcTotal()-already()-certAmt()))}
  function svcToPay(){return Math.max(0,svcTotal()-already()-certAmt()-abonAmt())}
  function grand(){return svcToPay()+prodTotal()}
  function alloc(){return U.sum(Object.keys(st.lines),function(k){return +st.lines[k]||0})}
  function remaining(){return grand()-alloc()}
  function autoFill(){if(st.touched)return;st.lines={};var g=grand();if(g>0){var first=(payM.find(function(p){return p.id==='card'})||payM[0]);st.lines[first.id]=g}}

  var m=UI.modal({title:'Оплата візиту',sub:esc((c?c.n:'Без імені')+' · '+D.shortH(a.date)+' '+hmp(a.start)+' · '+(App.staff(a.staff)||{}).short),size:'wide cal-co',
    body:'<div class="cal-co-g"><div class="cal-co-l" data-left></div><div class="cal-co-r" data-right></div></div>',
    foot:'<span class="cal-foot-sum" data-fs></span><span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri big" data-pay disabled>Оплатити</button>',
    onMount:function(el,close){
      var L=el.querySelector('[data-left]'),R=el.querySelector('[data-right]'),payBtn=el.querySelector('[data-pay]'),fs=el.querySelector('[data-fs]');
      el.querySelector('[data-no]').onclick=close;
      /* ── ліва частина ── */
      function drawLeft(){
        var h='<section><div class="cal-h">Послуги</div>'+st.items.map(function(x,i){var s=App.svc(x.svc);return '<div class="cal-sr co"><div class="n"><b class="ell">'+esc(s?s.n:x.svc)+'</b><small>'+U.dur(x.d)+'</small></div><label class="inp-suf"><input type="number" min="0" step="10" inputmode="numeric" data-price="'+i+'" value="'+x.price+'" aria-label="Ціна"><span>₴</span></label></div>'}).join('')+'</section>';
        h+='<section><div class="cal-h">Знижка</div><div class="cal-disc"><div class="seg"><button data-dt="pct" aria-pressed="'+(st.dtype==='pct')+'">%</button><button data-dt="sum" aria-pressed="'+(st.dtype==='sum')+'">₴</button></div>'+
          '<label class="inp-suf"><input type="number" min="0" step="'+(st.dtype==='pct'?5:10)+'" inputmode="numeric" data-dv value="'+(st.dv||'')+'" placeholder="0"><span>'+(st.dtype==='pct'?'%':'₴')+'</span></label>'+
          '<div class="chips">'+[5,10,15].map(function(p){return '<button class="chip" data-dq="'+p+'">'+p+'%</button>'}).join('')+'<button class="chip" data-dq="0">Без знижки</button></div></div></section>';
        if(mods_.products!==false){
          var avail=App.db.products.filter(function(p){return p.sell!==false&&p.stock>0&&!st.prods[p.id]});
          h+='<section><div class="cal-h">Товари</div>';
          h+=Object.keys(st.prods).map(function(k){var p=App.db.products.find(function(x){return x.id===k});return '<div class="cal-sr co"><div class="n"><b class="ell">'+esc(p.n)+'</b><small>'+U.uah(p.price)+' · на складі '+p.stock+'</small></div><div class="cal-qty"><button class="icobtn sm" data-pq="'+k+'" data-n="-1">'+I('minus','s')+'</button><b>'+st.prods[k]+'</b><button class="icobtn sm" data-pq="'+k+'" data-n="1">'+I('plus','s')+'</button></div><b class="cal-co-sum">'+U.uah(p.price*st.prods[k])+'</b></div>'}).join('');
          h+=avail.length?'<select class="sel" data-padd><option value="">+ Додати товар…</option>'+avail.map(function(p){return '<option value="'+p.id+'">'+esc(p.n)+' — '+U.uah(p.price)+' (залишок '+p.stock+')</option>'}).join('')+'</select>':'<div class="cal-hint">Немає товарів у наявності</div>';
          h+='</section>';
        }
        if(mods_.certs!==false||mods_.abons!==false){
          h+='<section><div class="cal-h">Сертифікат / абонемент</div>';
          if(mods_.certs!==false){
            if(st.cert){var g=App.db.certs.find(function(x){return x.id===st.cert.id});
              h+='<div class="cal-red">'+I('gift')+'<span class="t"><b>Сертифікат '+esc(g.code)+'</b><small>Залишок '+U.uah(g.balance)+'</small></span><label class="inp-suf"><input type="number" min="0" max="'+g.balance+'" step="10" data-cert-amt value="'+st.cert.amount+'"><span>₴</span></label><button class="icobtn sm ghost" data-cert-x aria-label="Прибрати">'+I('x','s')+'</button></div>';
            }else{
              var mine=App.db.certs.filter(function(g){return certOk(g)&&c&&g.buyer===c.id});
              h+='<div class="cal-redin"><div class="inp-ic">'+I('gift')+'<input class="inp" data-cert-code placeholder="Код сертифіката, напр. SB-5000" autocomplete="off"></div><button class="btn" data-cert-go>Застосувати</button></div><div class="cal-hint" data-cert-msg></div>'+
                (mine.length?'<div class="chips">'+mine.map(function(g){return '<button class="chip" data-cert-pick="'+g.id+'">'+esc(g.code)+' · '+U.uah(g.balance)+'</button>'}).join('')+'</div>':'');
            }
          }
          if(mods_.abons!==false&&c){
            var sv=st.items.map(function(x){return x.svc});
            var abs=App.db.abons.filter(function(ab){var t=App.db.abonTypes.find(function(x){return x.id===ab.type});return ab.client===c.id&&ab.status==='active'&&ab.left>0&&(!ab.expires||ab.expires>=App.today())&&t&&t.svc.some(function(s){return sv.indexOf(s)>=0})});
            if(st.abon){var ab=App.db.abons.find(function(x){return x.id===st.abon.id}),t=App.db.abonTypes.find(function(x){return x.id===ab.type});
              h+='<div class="cal-red">'+I('ticket')+'<span class="t"><b>'+esc(t.n)+'</b><small>Залишилось '+ab.left+' з '+ab.qty+' · спишеться 1</small></span><button class="icobtn sm ghost" data-abon-x aria-label="Прибрати">'+I('x','s')+'</button></div>';
            }else if(abs.length){
              h+='<div class="cal-hint" style="margin-top:8px">Активний абонемент клієнта:</div><div class="chips">'+abs.map(function(ab){var t=App.db.abonTypes.find(function(x){return x.id===ab.type});return '<button class="chip" data-abon-pick="'+ab.id+'">'+I('ticket','s')+esc(t.n)+' · '+ab.left+' шт</button>'}).join('')+'</div>';
            }
          }
          h+='</section>';
        }
        L.innerHTML=h;
      }
      /* ── права частина: підсумок + методи ── */
      function drawRight(){
        var h='<section class="cal-co-sumbox" data-sum></section><section><div class="cal-h">Спосіб оплати</div><div class="cal-pm" data-pm>'+
          payM.map(function(p){return '<div class="cal-pr" data-m="'+p.id+'"><button class="cal-pn2" data-fill="'+p.id+'" title="Вся сума на цей спосіб">'+I(p.ic||'coins')+'<span>'+esc(p.n)+'</span></button><label class="inp-suf"><input type="number" min="0" step="10" inputmode="numeric" data-line="'+p.id+'" placeholder="0"><span>₴</span></label></div>'+
            (p.id==='cash'?'<div class="cal-cash" data-cashbox hidden><div class="r"><span>Дали готівкою</span><label class="inp-suf"><input type="number" min="0" step="10" inputmode="numeric" data-given placeholder="0"><span>₴</span></label></div><div class="chips" data-gq></div><div class="r chg" data-chg></div></div>':'')}).join('')+'</div><div class="cal-rem" data-rem></div></section>';
        h+='<section><div class="cal-h">Чайові <small class="mute">необовʼязково</small></div><div class="cal-tip-r"><div class="chips">'+[0,5,10,15].map(function(p){return '<button class="chip" data-tp="'+p+'" aria-pressed="false">'+(p?p+'%':'Без чайових')+'</button>'}).join('')+'</div><div class="row" style="gap:8px;margin-top:8px"><label class="inp-suf" style="flex:1"><input type="number" min="0" step="10" inputmode="numeric" data-tip placeholder="0"><span>₴</span></label><select class="sel" data-tipm style="flex:1">'+payM.map(function(p){return '<option value="'+p.id+'"'+(p.id===st.tipM?' selected':'')+'>'+esc(p.n)+'</option>'}).join('')+'</select></div></div></section>';
        R.innerHTML=h;
        syncInputs();
      }
      function syncInputs(){
        $$('[data-line]',R).forEach(function(i){var v=st.lines[i.dataset.line];if(document.activeElement!==i)i.value=v?v:''});
        var ti=R.querySelector('[data-tip]');if(ti&&document.activeElement!==ti)ti.value=st.tipV||'';
      }
      function upd(){
        autoFill();syncInputs();
        var g=grand(),rem=remaining();
        var sum=R.querySelector('[data-sum]');
        var rows=[['Послуги',U.uah(gross())]];
        if(disc())rows.push(['Знижка'+(st.dtype==='pct'?' '+st.dv+'%':''),'−'+U.uah(disc()),1]);
        if(already())rows.push(['Вже оплачено / передоплата','−'+U.uah(already()),1]);
        if(certAmt())rows.push(['Сертифікат','−'+U.uah(certAmt()),1]);
        if(abonAmt())rows.push(['Абонемент','−'+U.uah(abonAmt()),1]);
        if(prodTotal())rows.push(['Товари',U.uah(prodTotal())]);
        sum.innerHTML=rows.map(function(r){return '<div class="r'+(r[2]?' mute':'')+'"><span>'+r[0]+'</span><b>'+r[1]+'</b></div>'}).join('')+'<div class="r tot"><span>До сплати</span><b>'+U.uah(g)+'</b></div>';
        var remEl=R.querySelector('[data-rem]');
        remEl.className='cal-rem '+(rem===0?'ok':rem<0?'over':'');
        remEl.innerHTML=g===0?'<span>'+I('check','s')+' Доплата не потрібна</span>':rem===0?'<span>'+I('check','s')+' Розподілено повністю</span>':rem>0?'<span>Залишок</span><b>'+U.uah(rem)+'</b>':'<span>Забагато</span><b>'+U.uah(-rem)+'</b>';
        /* готівка */
        var cash=+st.lines.cash||0,cb=R.querySelector('[data-cashbox]');
        if(cb){cb.hidden=!(cash>0);
          if(cash>0){var chg=st.given-cash;
            R.querySelector('[data-gq]').innerHTML=[cash,Math.ceil(cash/100)*100,Math.ceil(cash/500)*500,Math.ceil(cash/1000)*1000].filter(function(v,i,arr){return arr.indexOf(v)===i}).slice(0,4).map(function(v){return '<button class="chip" data-gv="'+v+'" aria-pressed="'+(st.given===v)+'">'+(v===cash?'Без решти':U.uah(v))+'</button>'}).join('');
            R.querySelector('[data-chg]').innerHTML=st.given>0?(chg>=0?'<span>Решта</span><b class="'+(chg>0?'ok-t':'')+'">'+U.uah(chg)+'</b>':'<span class="dng-t">Не вистачає</span><b class="dng-t">'+U.uah(-chg)+'</b>'):'<span class="mute">Введіть, скільки дав клієнт — порахуємо решту</span>';
          }}
        var can=(rem===0)&&(st.items.length>0||prodTotal()>0)&&!st.paying;
        payBtn.disabled=!can;
        payBtn.innerHTML=g>0?'Оплатити '+U.uah(g):'Закрити візит';
        fs.innerHTML=st.tipV?'Чайові '+U.uah(st.tipV):'';
        /* чайові: активний чіп */
        $$('[data-tp]',R).forEach(function(b){var p=+b.dataset.tp;b.setAttribute('aria-pressed',p===0?!st.tipV:st.tipV===Math.round(svcTotal()*p/100/10)*10)});
      }
      function redraw(){drawLeft();upd()}
      drawLeft();drawRight();upd();
      /* ── події ліва ── */
      L.addEventListener('input',function(e){var t=e.target;
        if(t.matches('[data-price]')){st.items[+t.dataset.price].price=Math.max(0,+t.value||0);upd()}
        else if(t.matches('[data-dv]')){st.dv=Math.max(0,+t.value||0);if(st.dtype==='pct')st.dv=Math.min(100,st.dv);upd()}
        else if(t.matches('[data-cert-amt]')){st.cert.amount=Math.max(0,+t.value||0);upd()}
      });
      L.addEventListener('change',function(e){var t=e.target;
        if(t.matches('[data-padd]')&&t.value){st.prods[t.value]=1;redraw()}
      });
      L.addEventListener('click',function(e){
        var b=e.target.closest('button');if(!b)return;
        if(b.dataset.dt){st.dtype=b.dataset.dt;st.dv=0;redraw()}
        else if(b.dataset.dq!=null){st.dtype='pct';st.dv=+b.dataset.dq;redraw()}
        else if(b.dataset.pq){var k=b.dataset.pq,p=App.db.products.find(function(x){return x.id===k}),n=st.prods[k]+(+b.dataset.n);if(n<=0)delete st.prods[k];else if(n>p.stock)return toastErr('На складі лише '+p.stock);else st.prods[k]=n;redraw()}
        else if(b.hasAttribute('data-cert-x')){st.cert=null;redraw()}
        else if(b.hasAttribute('data-cert-go')){
          var code=L.querySelector('[data-cert-code]').value.trim().toLowerCase(),msg=L.querySelector('[data-cert-msg]');
          var g=App.db.certs.find(function(x){return x.code.toLowerCase()===code});
          if(!code){msg.textContent='Введіть код';return}
          if(!g){msg.textContent='Сертифікат з таким кодом не знайдено';msg.className='cal-hint dng-t';return}
          if(!certOk(g)){msg.textContent=g.balance<=0?'Сертифікат уже використано':'Термін дії сертифіката минув';msg.className='cal-hint dng-t';return}
          st.cert={id:g.id,amount:Math.min(g.balance,Math.max(0,svcTotal()-already()))};redraw()}
        else if(b.dataset.certPick){var g2=App.db.certs.find(function(x){return x.id===b.dataset.certPick});st.cert={id:g2.id,amount:Math.min(g2.balance,Math.max(0,svcTotal()-already()))};redraw()}
        else if(b.hasAttribute('data-abon-x')){st.abon=null;redraw()}
        else if(b.dataset.abonPick){st.abon={id:b.dataset.abonPick};redraw()}
      });
      L.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.matches('[data-cert-code]')){e.preventDefault();L.querySelector('[data-cert-go]').click()}});
      /* ── події права ── */
      R.addEventListener('input',function(e){var t=e.target;
        if(t.matches('[data-line]')){st.touched=true;var v=Math.max(0,Math.round(+t.value||0));if(v)st.lines[t.dataset.line]=v;else delete st.lines[t.dataset.line];upd()}
        else if(t.matches('[data-given]')){st.given=Math.max(0,+t.value||0);upd()}
        else if(t.matches('[data-tip]')){st.tipV=Math.max(0,Math.round(+t.value||0));upd()}
      });
      R.addEventListener('change',function(e){if(e.target.matches('[data-tipm]'))st.tipM=e.target.value});
      R.addEventListener('click',function(e){
        var b=e.target.closest('button');if(!b)return;
        if(b.dataset.fill){st.touched=true;var rem=remaining(),cur=+st.lines[b.dataset.fill]||0,g=grand();
          /* недорозподілений залишок (сплит вручну) — доливаємо на цей спосіб; інакше вся сума переходить на обраний спосіб (Картка → Готівка) */
          if(rem>0&&alloc()>0)st.lines[b.dataset.fill]=cur+rem;else{st.lines={};if(g>0)st.lines[b.dataset.fill]=g}
          if(!st.lines[b.dataset.fill])delete st.lines[b.dataset.fill];upd()}
        else if(b.dataset.gv){st.given=+b.dataset.gv;var gi=R.querySelector('[data-given]');gi.value=st.given;upd()}
        else if(b.dataset.tp!=null){var p=+b.dataset.tp;st.tipV=p?Math.round(svcTotal()*p/100/10)*10:0;upd()}
      });
      /* ── оплата ── */
      payBtn.onclick=function(){
        if(payBtn.disabled)return;
        var rem=remaining();if(rem!==0)return;
        st.paying=true;payBtn.disabled=true;
        /* ціни */
        var prices=JSON.stringify(st.items.map(function(x){return x.price}));
        if(prices!==origPrices)App.ops.updateAppt(id,{items:st.items.map(function(x){return {svc:x.svc,price:+x.price||0,d:x.d,custom:true}})},'Ціни змінено при оплаті');
        /* розподіл товарів по методах */
        var pool=payM.map(function(p){return {m:p.id,left:+st.lines[p.id]||0}}).filter(function(x){return x.left>0});
        var products=[];
        Object.keys(st.prods).forEach(function(k){
          var pr=App.db.products.find(function(x){return x.id===k}),need=pr.price*st.prods[k],method=null;
          pool.slice().sort(function(a,b){return b.left-a.left}).forEach(function(x){if(need<=0)return;if(!method)method=x.m;var t=Math.min(x.left,need);x.left-=t;need-=t});
          products.push({id:k,qty:st.prods[k],method:method||'cash'});
        });
        var lines=pool.filter(function(x){return x.left>0}).map(function(x){return {method:x.m,amount:x.left}});
        var o={lines:lines,tips:st.tipV>0?[{method:st.tipM,amount:st.tipV}]:[],products:products,discount:st.dv>0?{type:st.dtype,v:st.dv}:null};
        if(st.cert&&certAmt()>0)o.cert={id:st.cert.id,amount:certAmt()};
        if(st.abon&&abonAmt()>=0&&App.db.abons.find(function(x){return x.id===st.abon.id}))o.abon={id:st.abon.id};
        var total=grand(),tip=st.tipV,chg=st.given>0&&(+st.lines.cash||0)>0?Math.max(0,st.given-st.lines.cash):0;
        try{App.ops.checkout(id,o)}catch(err){console.error(err);st.paying=false;return toastErr('Не вдалося провести оплату: '+err.message)}
        showDone(el,close,id,{total:total,tip:tip,change:chg});
      };
    }});
};
function rebookOpts(a){
  var st=a.client?App.clientStats(a.client):null,wk=st&&st.avgGap?Math.max(1,Math.min(12,Math.round(st.avgGap/7))):4;
  var sid=a.items[0]&&a.items[0].svc,res=[];
  [wk-1,wk,wk+1].forEach(function(n){if(n<1)return;var from=D.add(a.date,n*7);
    var r=sid?App.nextFree(sid,{staff:a.staff,from:from,n:1}):[];
    res.push({n:n,date:r[0]?r[0].date:from,start:r[0]?r[0].start:a.start,staff:a.staff,ok:!!r[0]})});
  return {wk:wk,list:res};
}
function showDone(el,close,id,info){
  var a=App.appt(id),c=a.client&&cl(a.client);
  el.querySelector('.modal-h h3').innerHTML='Оплачено<small>'+esc(cname(a))+'</small>';
  var rb=c&&!a.block?rebookOpts(a):null;
  el.querySelector('.modal-b').innerHTML='<div class="cal-done"><span class="cal-done-ic">'+I('check','xl')+'</span><h2>Оплачено ✓ '+U.uah(App.apptTotal(a))+'</h2><p>Візит завершено'+(info.tip?' · чайові '+U.uah(info.tip):'')+'</p>'+
    (info.change?'<div class="cal-done-chg">Решта клієнту: <b>'+U.uah(info.change)+'</b></div>':'')+
    (rb?'<div class="cal-rb" data-rb><h4>Записати знову</h4><p class="mute">'+esc(c.n.split(' ')[0])+' зазвичай приходить раз на '+rb.wk+' '+U.plural(rb.wk,'тиждень','тижні','тижнів')+'</p><div class="cal-rb-c">'+
      rb.list.map(function(o,k){return '<button class="btn acc cal-rb-b" data-rbk="'+k+'"><b>через '+o.n+' '+U.plural(o.n,'тиждень','тижні','тижнів')+'</b><small>'+esc(dShort(o.date))+' · '+hmp(o.start)+(o.ok?'':' (зайнято)')+'</small></button>'}).join('')+
      '</div><div class="cal-rb-a"><button class="btn sm" data-rbother>'+I('cal','s')+'Обрати інший час</button><button class="btn sm" data-rbno>Клієнт відмовився</button></div></div>':'')+
    '<div class="cal-done-a"><button class="btn" data-receipt>'+I('receipt')+'Чек</button>'+(rb?'':'<button class="btn" data-next>'+I('repeat')+'Записати на наступний раз</button>')+'</div></div>';
  var f=el.querySelector('.modal-f');f.innerHTML='<span class="sp"></span><button class="btn pri big" data-fin>Готово</button>';
  el.querySelector('[data-fin]').onclick=close;
  el.querySelector('[data-receipt]').onclick=function(){showReceipt(id)};
  var nx=el.querySelector('[data-next]');if(nx)nx.onclick=function(){
    var w=4,aa=App.appt(id);close();
    App.newAppt({items:aa.items,client:aa.client,staff:aa.staff,date:D.add(aa.date,w*7),start:aa.start});
  };
  if(rb){
    var box=el.querySelector('[data-rb]');
    box.addEventListener('click',function(e){
      var b=e.target.closest('[data-rbk]');
      if(b){var o=rb.list[+b.dataset.rbk],aa=App.appt(id);
        var cs=App.conflicts(o.staff,o.date,o.start,App.apptDur(aa));
        var mk=function(){var na=App.ops.createAppt({staff:o.staff,date:o.date,start:o.start,items:copyItems(aa.items),client:aa.client,status:'confirmed',src:'admin'});
          var nid=(na&&na.id)||na;aa.rebook='booked:'+nid;App.save();
          box.innerHTML='<div class="cal-rb-ok">'+I('check','s')+'<span>Записано на <b>'+esc(dShort(o.date))+' '+hmp(o.start)+'</b> · '+esc(App.staff(o.staff).short)+'</span></div>';
          UI.toast('Наступний візит: '+dShort(o.date)+' '+hmp(o.start),{undo:function(){App.ops.deleteAppt(nid);delete aa.rebook;App.save()}})};
        if(cs.length)askConflict(cs,'Все одно записати').then(function(y){if(y)mk()});else mk();return}
      if(e.target.closest('[data-rbother]')){var aa2=App.appt(id);close();App.newAppt({items:aa2.items,client:aa2.client,staff:aa2.staff,date:D.add(aa2.date,rb.wk*7),start:aa2.start});return}
      if(e.target.closest('[data-rbno]')){var aa3=App.appt(id);aa3.rebook='declined';App.save();box.innerHTML='<div class="cal-rb-ok mute"><span>Добре, нагадаємо клієнту пізніше</span></div>';UI.toast('Позначено: клієнт відмовився від запису')}
    });
  }
  UI.toast('Оплату проведено · '+U.uah(App.apptTotal(a)));
}

/* ═════════ Чек ═════════ */
function receiptHtml(a){
  var c=a.client&&cl(a.client),pays=App.apptPays(a),s=App.db.salon;
  var prods=pays.filter(function(p){return p.kind==='product'});
  var KIND={service:'Оплата',deposit:'Передоплата',cert:'Сертифікат',abon:'Абонемент',refund:'Повернення',tip:'Чайові'};
  var h='<div class="cal-rc"><div class="hd"><b>'+esc(s.name)+'</b><small>'+esc(s.city+', '+s.addr)+'</small><small>'+esc(s.phone)+'</small></div><div class="hr"></div>'+
    '<div class="r2"><span>Дата</span><span>'+esc(D.human(a.date,{year:true})+', '+hmp(a.start))+'</span></div><div class="r2"><span>Майстер</span><span>'+esc((App.staff(a.staff)||{}).n||'')+'</span></div>'+(c?'<div class="r2"><span>Клієнт</span><span>'+esc(c.n)+'</span></div>':'')+'<div class="hr"></div>';
  a.items.forEach(function(x){var sv=App.svc(x.svc);h+='<div class="r2"><span>'+esc(sv?sv.n:x.svc)+'</span><span>'+U.uah(x.price)+'</span></div>'});
  prods.forEach(function(p){var pr=App.db.products.find(function(x){return x.id===p.product});h+='<div class="r2"><span>'+esc(pr?pr.n:'Товар')+(p.qty>1?' ×'+p.qty:'')+'</span><span>'+U.uah(p.amount)+'</span></div>'});
  if(App.apptDiscount(a))h+='<div class="r2"><span>Знижка</span><span>−'+U.uah(App.apptDiscount(a))+'</span></div>';
  var tot=App.apptTotal(a)+U.sum(prods,function(p){return p.amount});
  h+='<div class="hr"></div><div class="r2 tt"><span>Разом</span><span>'+U.uah(tot)+'</span></div><div class="hr"></div>';
  pays.filter(function(p){return KIND[p.kind]}).forEach(function(p){h+='<div class="r2 sm"><span>'+esc(KIND[p.kind])+' · '+esc(App.payMethod(p.method).n||p.method)+'</span><span>'+U.uah(p.amount)+'</span></div>'});
  return h+'<div class="hr"></div><div class="ft">Дякуємо, що обрали нас!<br>Чек № '+esc(a.id.toUpperCase())+'</div></div>';
}
function showReceipt(id){
  var a=App.appt(id);if(!a)return;
  UI.modal({title:'Чек',sub:esc(cname(a)),size:'narrow cal-rcm',body:receiptHtml(a),foot:'<span class="sp"></span><button class="btn" data-no>Закрити</button><button class="btn pri" data-pr>'+I('print','s')+'Друк</button>',
    onMount:function(el,close){el.querySelector('[data-no]').onclick=close;el.querySelector('[data-pr]').onclick=function(){
      document.body.classList.add('cal-printing');setTimeout(function(){try{window.print()}catch(e){}document.body.classList.remove('cal-printing')},60)}}});
}

})();
