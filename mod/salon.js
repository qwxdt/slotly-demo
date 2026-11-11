/* Slotly demo — модуль САЛОН: Послуги, Команда, Графіки, Товари/склад, Кабінети й місця.
   Маршрути: services · team (+ team/<id>) · schedules · products · resources
   Глобальні точки входу: App.openService(id), App.openStaff(id), App.sellProduct(opts)
   Мутації — тільки через App.ops.* (власні: setShift, setShifts, bulkSvc, stockEx, requestShift). */
(function(){
'use strict';
var U=App.u,D=App.d,UI=App.ui,O=App.ops,esc=U.esc,NB='\u00A0';
var $=U.$,$$=U.$$;

/* ───────── загальні хелпери ───────── */
function ic(n,c){return App.icon(n,c||'')}
function mgr(){var r=App.me().role;return r==='owner'||r==='admin'}
function isOwner(){return App.me().role==='owner'}
function tv(m){var h=Math.floor(m/60),mm=m%60;return (h<10?'0':'')+h+':'+(mm<10?'0':'')+mm}   /* для <input type=time> */
function hh(m){var h=Math.floor(m/60),mm=m%60;return mm?h+':'+(mm<10?'0':'')+mm:String(h)}
function hrs(a,b){return hh(a)+'–'+hh(b)}
function num(v,def){var n=parseFloat(String(v==null?'':v).replace(/\s/g,'').replace(',','.'));return isFinite(n)?n:(def==null?0:def)}
function clone(o){return JSON.parse(JSON.stringify(o))}
function pc(n){return U.pct(n)}
function fld(label,inner,hint,cls){return '<label class="fld '+(cls||'')+'"><span>'+label+(hint?' <small>'+hint+'</small>':'')+'</span>'+inner+'</label>'}
function suf(name,val,unit,attrs){return '<div class="inp-suf"><input name="'+name+'" inputmode="decimal" value="'+esc(val==null?'':val)+'" '+(attrs||'')+'><span>'+unit+'</span></div>'}
function page(v,cls,html){init();v.innerHTML='<div class="page sl-pg '+(cls||'')+'">'+html+'</div>';return v.firstChild}
function g(el,n){return el.querySelector('[name="'+n+'"]')}
function gv(el,n){var x=g(el,n);return x?x.value:''}
function gc(el,n){var x=g(el,n);return !!(x&&x.checked)}
function sel(name,opts,cur,attrs){return '<select class="sel" name="'+name+'" '+(attrs||'')+'>'+opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(cur)?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select>'}
/* делегування кліків по data-a / change по data-c */
function act(root,map){root.addEventListener('click',function(e){var t=e.target.closest('[data-a]');if(!t||!root.contains(t))return;var f=map[t.dataset.a];if(f){if(t.tagName!=='INPUT')e.preventDefault();f(t,e)}})}
function chg(root,map){root.addEventListener('change',function(e){var t=e.target.closest('[data-c]');if(!t)return;var f=map[t.dataset.c];if(f)f(t,e)})}
function qset(patch){var r=App.parse();var q=Object.assign({},r.q,patch);var s='#/'+[r.id].concat(r.params).join('/');var p=Object.keys(q).filter(function(k){return q[k]!=null&&q[k]!==''}).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(q[k])}).join('&');history.replaceState(null,'',p?s+'?'+p:s)}
function copyText(t){try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).catch(function(){})}else{var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove()}}catch(e){}}
function modalFoot(extra,okLabel,okCls){return '<span class="sp"></span>'+(extra||'')+'<button class="btn" data-x2>Скасувати</button><button class="btn '+(okCls||'pri')+'" data-ok>'+okLabel+'</button>'}
function slug(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'')}

/* ───────── довідники ───────── */
var MODES={
  single:{n:'Одна ціна',d:'Одна ціна на послугу — однакова для всіх майстрів. Найпростіше: підходить, якщо в салоні немає різниці між майстрами.'},
  byLevel:{n:'За рівнем майстра',d:'Ціна залежить від рівня майстра (топ / майстер / молодший). Клієнт бачить ціну саме того майстра, до якого записується. Рівні й коефіцієнти налаштовуються в «Рівнях майстрів».'},
  byMaster:{n:'За майстром',d:'Кожен майстер має власну ціну на кожну послугу; якщо ціну не задано — береться базова. Підходить для авторських майстрів, барбершопів, тату та масажу.'}
};
var KIND={vacation:'Відпустка',sick:'Лікарняний',personal:'Відгул'};
var RTYPE={room:'Кабінет',chair:'Крісло',table:'Стіл',device:'Апарат'};
var MREASON={sale:'Продаж',in:'Надходження',use:'Використано в послугах',defect:'Брак',expired:'Прострочено',lost:'Втрата',inv:'Інвентаризація',init:'Початковий залишок',other:'Інше'};
var COLORS=[0,1,2,3,4,5,6,7];

/* ───────── дані: виконавці, ціни ───────── */
function performs(st,sv){if(!st||!sv)return false;if(st.svcs)return st.svcs.indexOf(sv.id)>=0;return (st.cats||[]).indexOf(sv.cat)>=0}
function performers(sv,all){return App.masters(all).filter(function(s){return performs(s,sv)})}
function staffSvcs(st){return App.db.services.filter(function(sv){return performs(st,sv)})}
function setPerforms(st,svcId,on){var list=st.svcs?st.svcs.slice():App.db.services.filter(function(x){return performs(st,x)}).map(function(x){return x.id});
  var i=list.indexOf(svcId);if(on&&i<0)list.push(svcId);if(!on&&i>=0)list.splice(i,1);return list}
function priceRange(sv){var db=App.db,mode=db.settings.pricing,arr=[];
  if(mode==='single')arr=[sv.price];
  else{var pf=performers(sv);if(pf.length)arr=pf.map(function(s){return App.priceFor(sv,s)});else if(mode==='byLevel')arr=db.levels.map(function(l){return sv.byLevel&&sv.byLevel[l.id]!=null?sv.byLevel[l.id]:sv.price});else arr=[sv.price]}
  if(!arr.length)arr=[sv.price];return [Math.min.apply(null,arr),Math.max.apply(null,arr)]}
function priceTxt(sv){var r=priceRange(sv);return r[0]===r[1]?U.uah(r[0]):U.fmt(r[0])+'–'+U.fmt(r[1])+NB+'₴'}
function avStack(list,max){max=max||4;if(!list.length)return '<span class="faint">—</span>';return '<span class="sl-stack">'+list.slice(0,max).map(function(s){return '<span title="'+esc(s.n)+'">'+UI.av(s,'sm')+'</span>'}).join('')+(list.length>max?'<span class="sl-more">+'+(list.length-max)+'</span>':'')+'</span>'}
function catName(id){var c=App.db.cats.find(function(x){return x.id===id});return c?c.n:'Без категорії'}
function resName(id){var r=(App.db.resources||[]).find(function(x){return x.id===id});return r?r.n:''}
function apptsOfSvc(id){return App.db.appts.filter(function(a){return a.items.some(function(i){return i.svc===id})}).length}

/* ───────── дані: співробітники ───────── */
function rawShift(stId,date){var s=App.staff(stId);if(!s||!s.week)return null;var o=App.db.sched[stId]&&App.db.sched[stId][date];
  if(o!==undefined)return o?{start:o[0],end:o[1],brk:o[2]||null,custom:true}:null;
  var w=s.week[D.wd1(date)];if(!w)return null;return {start:w[0],end:w[1],brk:s.brk&&s.brk[D.wd1(date)]||null}}
function shiftMin(wh){if(!wh)return 0;return wh.end-wh.start-(wh.brk?Math.max(0,wh.brk[1]-wh.brk[0]):0)}
function todayStatus(st){var T=App.today();
  if(!st.week)return {k:'na',t:st.role==='owner'||st.role==='admin'?'Не приймає клієнтів':'—'};
  var to=App.timeOff(st.id,T);if(to)return {k:to.kind,t:KIND[to.kind]+' до '+D.shortH(to.to)};
  var wh=App.workHours(st.id,T);if(!wh)return {k:'off',t:'Вихідний'};
  return {k:'work',t:'Працює '+hrs(wh.start,wh.end)}}
function loadWeek(st,from){from=from||D.weekStart(App.today());var cap=0,busy=0;
  for(var i=0;i<7;i++){var d=D.add(from,i),wh=App.workHours(st.id,d);if(!wh)continue;cap+=shiftMin(wh);
    App.apptsOn(d,st.id).forEach(function(a){if(a.status!=='cancelled'&&a.status!=='noshow')busy+=App.apptDur(a)})}
  return cap?Math.round(busy*100/cap):null}
function ratingOf(stId){var rv=App.db.reviews.filter(function(r){return r.staff===stId&&!r.hidden});if(!rv.length)return null;return {v:U.sum(rv,function(r){return r.rating})/rv.length,n:rv.length}}
function rateTxt(r){return r?'<span class="sl-rate">'+ic('star','s')+(Math.round(r.v*10)/10).toString().replace('.',',')+'</span> <small class="mute">'+r.n+'</small>':'<span class="faint">—</span>'}
function statDot(k){return '<i class="sl-dot k-'+k+'"></i>'}

/* ───────── власні операції ───────── */
O.setShift=function(staff,date,val,txt){var db=App.db;db.sched[staff]=db.sched[staff]||{};
  if(val===undefined)delete db.sched[staff][date];else db.sched[staff][date]=val;
  var s=App.staff(staff);App.log('schedule','staff:'+staff,txt||('Графік '+(s?s.short:'')+', '+D.shortH(date)+': '+(val===undefined?'за шаблоном':val?hrs(val[0],val[1]):'вихідний')));App.save()};
O.setShifts=function(list,txt){var db=App.db;list.forEach(function(x){db.sched[x.staff]=db.sched[x.staff]||{};if(x.val===undefined)delete db.sched[x.staff][x.date];else db.sched[x.staff][x.date]=x.val});
  App.log('schedule','sched',txt||('Змінено графік: '+list.length+' '+U.plural(list.length,'день','дні','днів')));App.save()};
O.bulkSvc=function(patches,txt){patches.forEach(function(p){var sv=App.svc(p.id);if(sv)Object.assign(sv,p)});App.log('edit','services',txt||'Змінено послуги');App.save()};
O.stockEx=function(id,qty,reason,o){o=o||{};O.stock(id,qty,reason,o.cost||0);var m=App.db.stockMoves[App.db.stockMoves.length-1];
  if(m&&m.product===id){if(o.note)m.note=o.note;if(o.unit!=null)m.unit=o.unit;m.by=App.db.meId;App.save(true)}};
O.requestShift=function(o){var s=App.staff(o.staff);return O.upsert('tasks',{t:(o.kind==='hours'?'Запит на зміну годин: ':'Запит на вихідний: ')+s.short+', '+D.human(o.date)+(o.note?' — '+o.note:''),due:o.date,who:(App.db.staff.find(function(x){return x.role==='owner'})||{}).id||'s0',done:false,prio:'mid',by:o.staff,req:{type:o.kind,staff:o.staff,date:o.date}},'Запит від майстра');};

/* ───────── одноразова ініціалізація даних модуля (ідемпотентно; переживає App.reset) ───────── */
function init(){var db=App.db;if(!db||db.settings.salonInit)return;db.settings.salonInit=1;var T=App.today();
  App.masters(true).forEach(function(s,i){if(s.schedUntil==null)s.schedUntil=D.add(T,s.id==='m2'?11:(60+i*7))});
  App.save(true)}

/* ═════════════════════════ ПОСЛУГИ ═════════════════════════ */
function svcFilter(q){var db=App.db,t=(q.q||'').trim().toLowerCase();
  return db.services.filter(function(s){
    if(q.st==='off'?s.active!==false:(q.st!=='all'&&s.active===false))return false;
    if(q.cat&&s.cat!==q.cat)return false;
    if(t&&s.n.toLowerCase().indexOf(t)<0&&(s.desc||'').toLowerCase().indexOf(t)<0)return false;
    return true}).sort(function(a,b){return (a.order||0)-(b.order||0)})}

function svcRow(s){var pf=performers(s),sub=[];
  if(s.type==='addon')sub.push('<span class="tag">додаткова</span>');
  if(s.hands4)sub.push('<span class="tag">у 4 руки</span>');
  if(s.active===false)sub.push('<span class="tag">вимкнена</span>');
  if(s.desc)sub.push('<small class="ell">'+esc(s.desc)+'</small>');
  var cost=s.cost?Math.round((s.price-s.cost)*100/s.price):null;
  return '<div class="sl-tr sl-svc'+(s.active===false?' is-off':'')+'" data-svc="'+s.id+'" tabindex="0">'+
   '<div class="sl-nm"><b class="ell">'+esc(s.n)+'</b>'+(sub.length?'<span class="sl-sub">'+sub.join('')+'</span>':'')+'</div>'+
   '<div class="sl-c sl-dur nw">'+ic('clock','s')+U.dur(s.d)+(s.buffer?'<small class="mute"> +'+s.buffer+NB+'хв</small>':'')+'</div>'+
   '<div class="sl-c sl-pr nw"><b class="num">'+priceTxt(s)+'</b>'+(cost!=null?'<small class="mute">маржа '+cost+'%</small>':'')+'</div>'+
   '<div class="sl-c sl-who">'+avStack(pf,4)+'</div>'+
   '<div class="sl-c sl-on" data-stop title="Показувати в онлайн-записі">'+UI.sw('',s.online&&s.active!==false,'data-c="online" data-id="'+s.id+'"'+(s.active===false?' disabled':'')+' aria-label="Онлайн-запис: '+esc(s.n)+'"')+'</div>'+
   '<button class="icobtn ghost sm sl-mn" data-a="svc-menu" data-id="'+s.id+'" aria-label="Дії">'+ic('more')+'</button></div>'}

function renderServices(v,params,q){
  var db=App.db,mode=db.settings.pricing,canEdit=mgr();
  q=Object.assign({st:'act'},q);
  var all=db.services,cntAct=all.filter(function(s){return s.active!==false}).length,cntOff=all.length-cntAct;
  var list=svcFilter(q),by=U.groupBy(list,function(s){return s.cat});
  var cats=db.cats.slice();if(by[''])cats.push({id:'',n:'Без категорії'});
  var h='';
  /* банер режиму цін */
  h+='<div class="sl-mode card"><div class="sl-mode-t"><div class="lab-s">Ціноутворення</div><b>'+MODES[mode].n+'</b><p>'+MODES[mode].d+'</p></div>'+
     '<div class="sl-mode-a">'+(canEdit?'<div class="seg" role="group" aria-label="Режим цін">'+Object.keys(MODES).map(function(k){return '<button data-a="mode" data-k="'+k+'" aria-pressed="'+(k===mode)+'">'+MODES[k].n+'</button>'}).join('')+'</div>':'')+
     (canEdit?'<div class="row wrap"><button class="btn sm" data-a="levels">'+ic('layers','s')+'Рівні майстрів</button><button class="btn sm" data-a="bulk">'+ic('percent','s')+'Змінити ціни</button><button class="btn sm" data-a="csv">'+ic('download','s')+'Прайс CSV</button></div>':'')+'</div></div>';
  /* тулбар */
  h+='<div class="sl-bar"><div class="inp-ic sl-q">'+ic('search')+'<input class="inp" data-q placeholder="Пошук послуги" value="'+esc(q.q||'')+'" aria-label="Пошук"></div>'+
     '<div class="seg"><button data-a="st" data-k="act" aria-pressed="'+(q.st==='act')+'">Активні <span class="mute">'+cntAct+'</span></button><button data-a="st" data-k="off" aria-pressed="'+(q.st==='off')+'">Вимкнені <span class="mute">'+cntOff+'</span></button><button data-a="st" data-k="all" aria-pressed="'+(q.st==='all')+'">Всі</button></div>'+
     (canEdit?'<button class="btn" data-a="cats">'+ic('tag','s')+'Категорії</button>':'')+'</div>';
  h+='<div class="chips sl-cats">'+'<button class="chip" data-a="cat" data-k="" aria-pressed="'+(!q.cat)+'">Всі</button>'+db.cats.map(function(c){var n=all.filter(function(s){return s.cat===c.id&&(q.st==='all'||(q.st==='off'?s.active===false:s.active!==false))}).length;return '<button class="chip" data-a="cat" data-k="'+c.id+'" aria-pressed="'+(q.cat===c.id)+'">'+esc(c.n)+' <span class="cnt">'+n+'</span></button>'}).join('')+'</div>';
  /* групи */
  var any=false;
  cats.forEach(function(c,ci){var items=by[c.id]||[];if(!items.length&&(q.q||q.st!=='all'||q.cat))return;if(q.cat&&q.cat!==c.id)return;any=true;
    var real=!!c.id;
    h+='<section class="sl-grp" data-cat="'+c.id+'"><header class="sl-grp-h"><h3>'+esc(c.n)+' <span class="mute">'+items.length+'</span></h3><span class="sp"></span>'+
      (canEdit&&real?'<button class="icobtn ghost sm" data-a="cat-up" data-k="'+c.id+'" aria-label="Вище"'+(ci===0?' disabled':'')+'>'+ic('up','s')+'</button><button class="icobtn ghost sm" data-a="cat-dn" data-k="'+c.id+'" aria-label="Нижче"'+(ci===db.cats.length-1?' disabled':'')+'>'+ic('down','s')+'</button><button class="icobtn ghost sm" data-a="cat-edit" data-k="'+c.id+'" aria-label="Перейменувати">'+ic('edit','s')+'</button>':'')+
      (canEdit?'<button class="btn sm ghost" data-a="svc-new" data-k="'+c.id+'">'+ic('plus','s')+'Послуга</button>':'')+'</header>';
    if(!items.length)h+='<div class="sl-empty-g">У цій категорії ще немає послуг</div>';
    else h+='<div class="sl-list"><div class="sl-tr sl-th"><div>Назва</div><div class="sl-c">Тривалість</div><div class="sl-c">Ціна</div><div class="sl-c">Виконують</div><div class="sl-c">Онлайн</div><div></div></div>'+items.map(svcRow).join('')+'</div>';
    h+='</section>'});
  if(!any)h+=UI.empty('scissors',all.length?'Нічого не знайдено':'Ще немає послуг',all.length?'Змініть пошук або фільтр.':'Додайте першу послугу — назва, тривалість і ціна.',canEdit?'<button class="btn pri" data-a="svc-new" data-k="">Додати послугу</button>':'');
  h+='<p class="sl-hint">Зміна ціни діє на нові записи. Вже створені записи зберігають ціну, за якою їх створили.</p>';
  var pg=page(v,'sl-services',h);
  App.setTop(canEdit?'<button class="btn pri" data-act="sl-svc-new">'+ic('plus')+'<span class="sl-lbl">Послуга</span></button>':'');
  var qi=$('[data-q]',pg);qi.oninput=U.debounce(function(){qset({q:qi.value||null});var pos=qi.selectionStart;renderServices(v,params,App.parse().q);var n=$('[data-q]',v);n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}},180);
  act(pg,{
    st:function(t){App.setQ({st:t.dataset.k==='act'?null:t.dataset.k},true)},
    cat:function(t){App.setQ({cat:t.dataset.k||null},true)},
    mode:function(t){var k=t.dataset.k;if(k===db.settings.pricing)return;
      var old=db.settings.pricing;O.set('settings.pricing',k,'Режим цін: '+MODES[k].n);UI.toast('Режим цін: '+MODES[k].n,{undo:function(){O.set('settings.pricing',old,'Режим цін: '+MODES[old].n);App.refresh()}});App.refresh()},
    levels:function(){levelsModal()},bulk:function(){bulkModal(q.cat)},csv:function(){exportPrice()},cats:function(){catsModal()},
    'svc-new':function(t){openService(null,{cat:t.dataset.k||q.cat||(db.cats[0]||{}).id})},
    'cat-up':function(t){moveCat(t.dataset.k,-1)},'cat-dn':function(t){moveCat(t.dataset.k,1)},
    'cat-edit':function(t){catForm(t.dataset.k)},
    'svc-menu':function(t,e){e.stopPropagation();svcMenu(t,t.dataset.id)}
  });
  pg.addEventListener('click',function(e){if(e.target.closest('[data-stop],[data-a],button,input,label'))return;var r=e.target.closest('[data-svc]');if(r)openService(r.dataset.svc)});
  pg.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.matches('[data-svc]'))openService(e.target.dataset.svc)});
  chg(pg,{online:function(t){var s=App.svc(t.dataset.id);O.upsert('services',{id:s.id,online:t.checked},(t.checked?'Показано в онлайн-записі: ':'Приховано з онлайн-запису: ')+s.n);UI.toast(t.checked?'«'+esc(s.n)+'» видно в онлайн-записі':'«'+esc(s.n)+'» приховано з онлайн-запису')}});
}
App.actions['sl-svc-new']=function(){openService(null,{cat:(App.parse().q.cat)||(App.db.cats[0]||{}).id})};

function exportPrice(){var rows=[['Категорія','Послуга','Тривалість, хв','Ціна','Ціна від','Ціна до','Онлайн','Активна']];
  App.db.services.forEach(function(s){var r=priceRange(s);rows.push([catName(s.cat),s.n,s.d,s.price,r[0],r[1],s.online?'так':'ні',s.active!==false?'так':'ні'])});
  U.download('prais-'+App.today()+'.csv',U.csv(rows),'text/csv;charset=utf-8');UI.toast('Прайс завантажено')}

function svcMenu(anchor,id){var s=App.svc(id);if(!s||!mgr())return;
  UI.menu(anchor,[
   {t:'Редагувати',ic:'edit',fn:function(){openService(id)}},
   {t:'Дублювати',ic:'copy',fn:function(){var c=clone(s);delete c.id;c.n=s.n+' (копія)';c.order=(s.order||0)+.5;var r=O.upsert('services',c,'Дубль послуги: '+s.n);normOrder();UI.toast('Створено копію');App.refresh();openService(r.id)}},
   {t:'Вище',ic:'up',fn:function(){moveSvc(id,-1)}},{t:'Нижче',ic:'down',fn:function(){moveSvc(id,1)}},'-',
   {t:s.active===false?'Увімкнути':'Вимкнути',ic:s.active===false?'check':'ban',fn:function(){O.upsert('services',{id:id,active:s.active===false},(s.active===false?'Увімкнено: ':'Вимкнено: ')+s.n);UI.toast(s.active===false?'Послугу увімкнено':'Послугу вимкнено',{undo:function(){O.upsert('services',{id:id,active:s.active===false},'Скасовано');App.refresh()}});App.refresh()}},
   {t:'Видалити',ic:'trash',dng:true,fn:function(){delSvc(id)}}])}
function normOrder(){App.db.services.sort(function(a,b){return (a.order||0)-(b.order||0)}).forEach(function(s,i){s.order=i});App.save(true)}
function moveSvc(id,dir){var s=App.svc(id),sib=App.db.services.filter(function(x){return x.cat===s.cat}).sort(function(a,b){return (a.order||0)-(b.order||0)});var i=sib.indexOf(s),j=i+dir;if(j<0||j>=sib.length)return UI.toast('Вже '+(dir<0?'перша':'остання')+' в категорії');
  var a=sib[i].order,b=sib[j].order;O.bulkSvc([{id:sib[i].id,order:b},{id:sib[j].id,order:a}],'Порядок послуг: '+s.n);App.refresh()}
function delSvc(id,after){var s=App.svc(id),n=apptsOfSvc(id);
  if(n>0){return UI.confirm({title:'Не можна видалити «'+esc(s.n)+'»',text:'Послуга є в '+n+' '+U.plural(n,'записі','записах','записах')+' (історія). Щоб прибрати її з запису й онлайн-запису — вимкніть її: історія й звіти збережуться.',ok:'Вимкнути',danger:false}).then(function(y){if(y){O.upsert('services',{id:id,active:false},'Вимкнено: '+s.n);UI.toast('Послугу вимкнено');if(after)after();App.refresh()}})}
  return UI.confirm({title:'Видалити «'+esc(s.n)+'»?',text:'Послугу ще не використано в записах — її буде видалено остаточно.',ok:'Видалити',danger:true}).then(function(y){if(!y)return;var copy=clone(s);O.remove('services',id,'Видалено послугу: '+s.n);UI.toast('Послугу видалено',{undo:function(){App.db.services.push(copy);App.log('create','services:'+id,'Відновлено: '+copy.n);App.save();App.refresh()}});if(after)after();App.refresh()})}

/* категорії */
function moveCat(id,dir){var a=App.db.cats.slice(),i=a.findIndex(function(c){return c.id===id}),j=i+dir;if(i<0||j<0||j>=a.length)return;var t=a[i];a[i]=a[j];a[j]=t;O.set('cats',a,'Порядок категорій');App.refresh()}
function catForm(id,done){var c=id?App.db.cats.find(function(x){return x.id===id}):null;
  UI.modal({title:c?'Категорія':'Нова категорія',size:'narrow',body:'<div class="col-f g12">'+fld('Назва','<input class="inp" name="n" value="'+esc(c?c.n:'')+'" placeholder="Напр. Масаж, Тату, Стрижки" maxlength="40">')+'</div>',
   foot:(c?'<button class="btn dng" data-del>'+ic('trash','s')+'Видалити</button>':'')+modalFoot('','Зберегти'),
   onMount:function(el,cl){el.querySelector('[data-x2]').onclick=cl;
     el.querySelector('[data-ok]').onclick=function(){var n=gv(el,'n').trim();if(!n){g(el,'n').classList.add('err');return g(el,'n').focus()}
       if(App.db.cats.some(function(x){return x.n.toLowerCase()===n.toLowerCase()&&(!c||x.id!==c.id)})){UI.toast('Категорія з такою назвою вже є',{type:'err'});return}
       var arr=App.db.cats.slice();if(c){arr=arr.map(function(x){return x.id===c.id?Object.assign({},x,{n:n}):x})}else{var id2=slug(n)||'c';while(arr.some(function(x){return x.id===id2}))id2+=Math.floor(Math.random()*9);arr.push({id:id2,n:n})}
       O.set('cats',arr,(c?'Категорію перейменовано: ':'Нова категорія: ')+n);cl();UI.toast(c?'Збережено':'Категорію додано');App.refresh();done&&done()};
     var d=el.querySelector('[data-del]');if(d)d.onclick=function(){var cnt=App.db.services.filter(function(s){return s.cat===c.id}).length;cl();delCat(c,cnt)};
     el.querySelector('[name=n]').onkeydown=function(e){if(e.key==='Enter')el.querySelector('[data-ok]').click()}}})}
function delCat(c,cnt){
  if(!cnt){return UI.confirm({title:'Видалити категорію «'+esc(c.n)+'»?',text:'Вона порожня.',ok:'Видалити',danger:true}).then(function(y){if(y){O.set('cats',App.db.cats.filter(function(x){return x.id!==c.id}),'Видалено категорію '+c.n);UI.toast('Категорію видалено');App.refresh()}})}
  var others=App.db.cats.filter(function(x){return x.id!==c.id});
  if(!others.length)return UI.toast('Це остання категорія — спочатку створіть іншу',{type:'err'});
  UI.modal({title:'Видалити «'+esc(c.n)+'»?',size:'narrow',body:'<p class="mute" style="margin:0 0 12px">У категорії '+cnt+' '+U.plural(cnt,'послуга','послуги','послуг')+'. Куди їх перенести?</p>'+fld('Перенести в',sel('to',others.map(function(x){return [x.id,x.n]}),others[0].id)),
   foot:modalFoot('','Перенести й видалити','dng pri'),onMount:function(el,cl){el.querySelector('[data-x2]').onclick=cl;el.querySelector('[data-ok]').onclick=function(){var to=gv(el,'to');
     O.bulkSvc(App.db.services.filter(function(s){return s.cat===c.id}).map(function(s){return {id:s.id,cat:to}}),'Послуги перенесено в «'+catName(to)+'»');O.set('cats',App.db.cats.filter(function(x){return x.id!==c.id}),'Видалено категорію '+c.n);cl();UI.toast('Категорію видалено, послуги перенесено');App.refresh()}}})}
function catsModal(){
  function body(){return '<div class="list">'+App.db.cats.map(function(c,i){var n=App.db.services.filter(function(s){return s.cat===c.id}).length;
    return '<div class="li"><span class="t"><b>'+esc(c.n)+'</b><small>'+n+' '+U.plural(n,'послуга','послуги','послуг')+'</small></span><button class="icobtn ghost sm" data-a="up" data-k="'+c.id+'" aria-label="Вище"'+(i?'':' disabled')+'>'+ic('up','s')+'</button><button class="icobtn ghost sm" data-a="dn" data-k="'+c.id+'" aria-label="Нижче"'+(i===App.db.cats.length-1?' disabled':'')+'>'+ic('down','s')+'</button><button class="icobtn ghost sm" data-a="ed" data-k="'+c.id+'" aria-label="Редагувати">'+ic('edit','s')+'</button></div>'}).join('')+'</div>'}
  var m=UI.modal({title:'Категорії послуг',sub:'Порядок тут = порядок у прайсі й онлайн-записі',size:'narrow',body:body(),foot:'<button class="btn" data-add>'+ic('plus','s')+'Категорія</button><span class="sp"></span><button class="btn pri" data-ok>Готово</button>',
   onMount:function(el,cl){var redraw=function(){el.querySelector('.modal-b').innerHTML=body()};
     el.querySelector('[data-ok]').onclick=cl;el.querySelector('[data-add]').onclick=function(){catForm(null,redraw)};
     act(el,{up:function(t){moveCat(t.dataset.k,-1);redraw()},dn:function(t){moveCat(t.dataset.k,1);redraw()},ed:function(t){catForm(t.dataset.k,redraw)}})}})}

/* рівні майстрів */
function levelsModal(){var lv=clone(App.db.levels);
  function body(){return '<p class="mute" style="margin:0 0 12px;font-size:13px">Рівень задає відсоток майстра за замовчуванням і коефіцієнт до базової ціни (в режимі «За рівнем»).</p>'+
    '<div class="sl-lv-h"><span>Назва</span><span>% майстра</span><span>Коеф. ціни</span><span></span></div>'+lv.map(function(l,i){var n=App.db.staff.filter(function(s){return s.lvl===l.id}).length;
     return '<div class="sl-lv" data-i="'+i+'"><input class="inp" data-f="n" value="'+esc(l.n)+'" aria-label="Назва рівня"><div class="inp-suf"><input data-f="pct" inputmode="decimal" value="'+l.pct+'" aria-label="Відсоток"><span>%</span></div><div class="inp-suf"><input data-f="k" inputmode="decimal" value="'+String(l.k).replace('.',',')+'" aria-label="Коефіцієнт"><span>×</span></div><button class="icobtn ghost sm" data-a="rm" data-i="'+i+'" aria-label="Видалити"'+(n?' title="Є майстри на цьому рівні"':'')+'>'+ic('trash','s')+'</button></div>'}).join('')+
    '<button class="btn sm" data-a="add" style="margin-top:10px">'+ic('plus','s')+'Рівень</button>'+
    '<label class="check" style="margin-top:12px"><input type="checkbox" name="recalc"> Перерахувати ціни за рівнями за коефіцієнтами <span class="mute">(базова ціна × коеф., округлення до 10 ₴)</span></label>'}
  UI.modal({title:'Рівні майстрів',size:'wide',body:'<div data-b>'+body()+'</div>',foot:modalFoot('','Зберегти'),onMount:function(el,cl){var b=el.querySelector('[data-b]');
    function read(){$$('.sl-lv',b).forEach(function(r){var i=+r.dataset.i;lv[i].n=$('[data-f=n]',r).value;lv[i].pct=num($('[data-f=pct]',r).value);lv[i].k=num($('[data-f=k]',r).value,1)})}
    el.querySelector('[data-x2]').onclick=cl;
    act(b,{rm:function(t){read();var i=+t.dataset.i,l=lv[i];var n=App.db.staff.filter(function(s){return s.lvl===l.id}).length;if(n)return UI.toast('На рівні «'+l.n+'» є майстри ('+n+') — спочатку змініть їм рівень',{type:'err'});if(lv.length<=1)return UI.toast('Потрібен хоча б один рівень',{type:'err'});lv.splice(i,1);b.innerHTML=body()},
      add:function(){read();var id='l'+Math.floor(Math.random()*9000+1000);lv.push({id:id,n:'Новий рівень',pct:30,k:1});b.innerHTML=body();var ins=$$('.sl-lv [data-f=n]',b);ins[ins.length-1].select()}});
    el.querySelector('[data-ok]').onclick=function(){read();if(lv.some(function(l){return !l.n.trim()||l.pct<0||l.pct>100||l.k<=0})){UI.toast('Перевірте назви, відсотки (0–100) і коефіцієнти (>0)',{type:'err'});return}
      var recalc=gc(b,'recalc');var oldLv=clone(App.db.levels);
      O.set('levels',lv,'Змінено рівні майстрів');
      if(recalc){O.bulkSvc(App.db.services.map(function(s){var bl={};lv.forEach(function(l){bl[l.id]=Math.round(s.price*l.k/10)*10});return {id:s.id,byLevel:bl}}),'Ціни за рівнями перераховано')}
      else{O.bulkSvc(App.db.services.map(function(s){var bl=Object.assign({},s.byLevel);lv.forEach(function(l){if(bl[l.id]==null)bl[l.id]=Math.round(s.price*l.k/10)*10});return {id:s.id,byLevel:bl}}),'Додано ціни нових рівнів')}
      cl();UI.toast('Рівні збережено'+(recalc?', ціни перераховано':''));App.refresh()}}})}

/* масова зміна цін */
function bulkModal(cat0){var db=App.db;
  UI.modal({title:'Масова зміна цін',sub:'Перегляньте результат перед застосуванням',size:'wide',body:
   '<div class="grid2 m1">'+fld('Які послуги',sel('scope',[['all','Всі активні послуги']].concat(db.cats.map(function(c){return ['c:'+c.id,'Категорія: '+c.n]})),cat0?'c:'+cat0:'all'))+
   fld('Як змінити',sel('how',[['pct','Підвищити на %'],['pctd','Знизити на %'],['uah','Додати ₴'],['uahd','Відняти ₴']],'pct'))+
   fld('Значення',suf('val','10','%'))+fld('Округлити до',sel('rnd',[['1','1 ₴'],['5','5 ₴'],['10','10 ₴'],['50','50 ₴'],['100','100 ₴']],'10'))+'</div>'+
   '<label class="check" style="margin-top:6px"><input type="checkbox" name="lv" checked> Змінити також ціни за рівнями / майстрами</label>'+
   '<div class="sl-prev" data-prev></div>',foot:modalFoot('','Застосувати'),
   onMount:function(el,cl){var plan=[];
     function calc(){var scope=gv(el,'scope'),how=gv(el,'how'),val=num(gv(el,'val')),rnd=+gv(el,'rnd')||1,withLv=gc(el,'lv');
       el.querySelector('.inp-suf span').textContent=how.indexOf('pct')===0?'%':'₴';
       var f=function(p){var n=how==='pct'?p*(1+val/100):how==='pctd'?p*(1-val/100):how==='uah'?p+val:p-val;return Math.max(0,Math.round(n/rnd)*rnd)};
       plan=db.services.filter(function(s){return s.active!==false&&(scope==='all'||s.cat===scope.slice(2))}).map(function(s){
         var p={id:s.id,n:s.n,old:priceRange(s),price:f(s.price)};
         if(withLv){p.byLevel={};Object.keys(s.byLevel||{}).forEach(function(k){p.byLevel[k]=f(s.byLevel[k])});p.byMaster={};Object.keys(s.byMaster||{}).forEach(function(k){p.byMaster[k]=f(s.byMaster[k])})}
         var tmp=Object.assign({},s,{price:p.price},withLv?{byLevel:p.byLevel,byMaster:p.byMaster}:{});p.nw=priceRange(tmp);p.changed=p.price!==s.price||p.nw[0]!==p.old[0]||p.nw[1]!==p.old[1];return p});
       var ch=plan.filter(function(p){return p.changed});
       var rg=function(r){return r[0]===r[1]?U.fmt(r[0]):U.fmt(r[0])+'–'+U.fmt(r[1])};
       el.querySelector('[data-prev]').innerHTML='<div class="lab-s" style="margin:14px 0 6px">Попередній перегляд · зміниться '+ch.length+' з '+plan.length+'</div>'+
         (ch.length?'<div class="sl-pv">'+ch.slice(0,40).map(function(p){var d=p.price-App.svc(p.id).price;return '<div class="sl-pv-r"><span class="ell">'+esc(p.n)+'</span><span class="mute nw num">'+rg(p.old)+'</span><span class="mute">→</span><b class="nw num">'+rg(p.nw)+' ₴</b><span class="nw num '+(d>0?'ok-t':d<0?'dng-t':'mute')+'">'+(d>0?'+':d<0?'−':'')+U.fmt(Math.abs(d))+'</span></div>'}).join('')+(ch.length>40?'<div class="mute" style="padding:8px 0">… ще '+(ch.length-40)+'</div>':'')+'</div>':'<div class="mute">Нічого не змінюється.</div>')}
     el.addEventListener('input',calc);el.addEventListener('change',calc);calc();
     el.querySelector('[data-x2]').onclick=cl;
     el.querySelector('[data-ok]').onclick=function(){var ch=plan.filter(function(p){return p.changed});if(!ch.length)return UI.toast('Нема що змінювати',{type:'err'});
       var backup=ch.map(function(p){var s=App.svc(p.id);return {id:s.id,price:s.price,byLevel:clone(s.byLevel||{}),byMaster:clone(s.byMaster||{})}});
       O.bulkSvc(ch.map(function(p){var o={id:p.id,price:p.price};if(p.byLevel){o.byLevel=p.byLevel;o.byMaster=p.byMaster}return o}),'Масова зміна цін: '+ch.length+' '+U.plural(ch.length,'послуга','послуги','послуг'));
       cl();UI.toast('Ціни оновлено: '+ch.length+' '+U.plural(ch.length,'послуга','послуги','послуг'),{undo:function(){O.bulkSvc(backup,'Скасовано масову зміну цін');App.refresh()}});App.refresh()}}})}

/* редактор послуги */
function openService(id,def){
  var db=App.db,isNew=!id,old=id?App.svc(id):null;
  if(id&&!old)return UI.toast('Послугу не знайдено',{type:'err'});
  var s=old?clone(old):Object.assign({id:null,n:'',cat:(db.cats[0]||{}).id,desc:'',d:60,buffer:0,price:500,byLevel:{},byMaster:{},cost:0,online:true,active:true,type:'main',attach:[],hands4:false,res:[]},def||{});
  s.byLevel=s.byLevel||{};s.byMaster=s.byMaster||{};s.res=Array.isArray(s.res)?s.res:(s.res?[s.res]:[]);s.attach=s.attach||[];
  var canEdit=mgr(),mode=db.settings.pricing,masters=App.masters(true);
  var perf={};masters.forEach(function(m){perf[m.id]=old?performs(m,old):((m.cats||[]).indexOf(s.cat)>=0)});
  function pricesBlock(){var h='';
    h+=fld(mode==='single'?'Ціна':'Базова ціна',suf('price',s.price,'₴','data-p'),mode==='single'?'':'для нових майстрів і як запасна');
    if(mode==='byLevel'){h+='<div class="sl-pt"><div class="lab-s">Ціни за рівнем майстра</div>'+db.levels.map(function(l){var auto=Math.round(s.price*l.k/10)*10,v=s.byLevel[l.id];
      return '<div class="sl-pt-r"><span>'+esc(l.n)+' <small class="mute">×'+String(l.k).replace('.',',')+'</small></span><div class="inp-suf"><input name="lv_'+l.id+'" inputmode="decimal" value="'+(v!=null?v:'')+'" placeholder="'+auto+'" data-p><span>₴</span></div></div>'}).join('')+'<button type="button" class="btn sm ghost" data-a="auto">'+ic('repeat','s')+'Порахувати за коефіцієнтами</button></div>'}
    if(mode==='byMaster'){var pm=masters.filter(function(m){return perf[m.id]});h+='<div class="sl-pt"><div class="lab-s">Ціни за майстром</div>'+(pm.length?pm.map(function(m){var v=s.byMaster[m.id];
      return '<div class="sl-pt-r"><span class="row">'+UI.av(m,'sm')+esc(m.short)+'</span><div class="inp-suf"><input name="ms_'+m.id+'" inputmode="decimal" value="'+(v!=null?v:'')+'" placeholder="'+s.price+'" data-p><span>₴</span></div></div>'}).join(''):'<div class="mute">Спочатку відмітьте майстрів нижче — тут зʼявляться їхні ціни.</div>')+'</div>'}
    return h}
  var body='<div class="sl-ed col-f g16">'+
   '<div class="grid2 m1">'+fld('Назва','<input class="inp" name="n" value="'+esc(s.n)+'" placeholder="Напр. Манікюр з покриттям" maxlength="80">')+fld('Категорія',sel('cat',db.cats.map(function(c){return [c.id,c.n]}),s.cat))+'</div>'+
   fld('Опис','<textarea class="ta" name="desc" rows="2" placeholder="Що входить, для кого — бачить клієнт в онлайн-записі" style="min-height:60px">'+esc(s.desc||'')+'</textarea>')+
   '<div class="sl-sec"><h4>Час</h4><div class="grid2 m1">'+fld('Тривалість',suf('d',s.d,'хв'))+fld('Прибирання / перерва після',suf('buffer',s.buffer||0,'хв'),'не продається клієнтам')+'</div>'+
     '<div class="chips" style="margin-top:8px">'+[15,30,45,60,90,120,180].map(function(m){return '<button type="button" class="chip" data-a="dur" data-m="'+m+'">'+U.dur(m)+'</button>'}).join('')+'</div></div>'+
   '<div class="sl-sec"><h4>Ціна</h4><div data-prices class="col-f g12">'+pricesBlock()+'</div>'+
     '<div class="note" style="margin-top:12px">'+ic('info')+'<span>Режим цін: <b>'+MODES[mode].n+'</b>. '+(isOwner()?'Змінюється на сторінці «Послуги».':'')+'</span></div></div>'+
   '<div class="sl-sec"><h4>Собівартість</h4><div class="grid2 m1">'+fld('Матеріали на одну послугу',suf('cost',s.cost||0,'₴'),'гель-лак, фарба, розхідники')+'<div class="sl-margin" data-margin></div></div></div>'+
   '<div class="sl-sec"><h4>Хто виконує</h4><div class="sl-perf" data-perf>'+(masters.length?masters.map(function(m){var l=App.level(m.lvl);return '<label class="sl-pf"><input type="checkbox" name="pf_'+m.id+'"'+(perf[m.id]?' checked':'')+'>'+UI.av(m,'sm')+'<span class="t"><b>'+esc(m.short)+'</b><small>'+esc(m.spec||'')+(l?' · '+esc(l.n):'')+'</small></span></label>'}).join(''):'<div class="mute">Спочатку додайте майстрів у розділі «Команда».</div>')+'</div>'+
     '<div class="row wrap" style="margin-top:8px"><button type="button" class="btn sm ghost" data-a="pf-cat">Усі з категорії</button><button type="button" class="btn sm ghost" data-a="pf-all">Усі</button><button type="button" class="btn sm ghost" data-a="pf-none">Нікого</button></div></div>'+
   '<div class="sl-sec"><h4>Параметри</h4>'+
     '<div class="set-row"><span class="t"><b>Онлайн-запис</b><small>Клієнти бачать і обирають цю послугу самостійно</small></span>'+UI.sw('online',s.online)+'</div>'+
     '<div class="set-row"><span class="t"><b>Активна</b><small>Вимкнені послуги не можна додати в запис</small></span>'+UI.sw('active',s.active!==false)+'</div>'+
     '<div class="set-row"><span class="t"><b>Додаткова послуга</b><small>Не продається окремо — додається до основної (зняття покриття, дизайн, борода)</small></span>'+UI.sw('addon',s.type==='addon')+'</div>'+
     '<div data-attach'+(s.type==='addon'?'':' hidden')+' class="sl-attach">'+fld('До яких послуг можна додати','<div class="chips" data-chips>'+db.services.filter(function(x){return x.id!==s.id&&x.type!=='addon'}).map(function(x){return '<button type="button" class="chip" data-a="att" data-id="'+x.id+'" aria-pressed="'+(s.attach.indexOf(x.id)>=0)+'">'+esc(x.n)+'</button>'}).join('')+'</div>','якщо нічого не вибрано — до будь-якої')+'</div>'+
     '<div class="set-row"><span class="t"><b>У 4 руки</b><small>Послугу виконують двоє майстрів одночасно (обоє зайняті в календарі)</small></span>'+UI.sw('hands4',!!s.hands4)+'</div>'+
     '<div class="set-row" style="align-items:flex-start"><span class="t"><b>Потрібне місце / кабінет</b><small>'+(db.settings.modules.resources?'Запис блокує одне з вибраних місць':'Модуль «Кабінети й місця» вимкнено. Увімкніть у розділі «Кабінети й місця», якщо майстри ділять кабінети, крісла чи апарати.')+'</small>'+
       (db.settings.modules.resources&&db.resources.length?'<div class="chips" style="margin-top:8px">'+db.resources.map(function(r){return '<button type="button" class="chip" data-a="res" data-id="'+r.id+'" aria-pressed="'+(s.res.indexOf(r.id)>=0)+'">'+esc(r.n)+'</button>'}).join('')+'</div>':'')+'</span></div>'+
   '</div>'+(old?'<div class="mute" style="font-size:12.5px">У записах: '+apptsOfSvc(old.id)+'</div>':'')+'</div>';
  var foot=canEdit?(old?'<button class="btn dng" data-del>'+ic('trash','s')+'<span class="d-only">Видалити</span></button>':'')+'<span class="sp"></span><button class="btn" data-x2>Скасувати</button><button class="btn pri" data-ok>'+(isNew?'Створити':'Зберегти')+'</button>':'<span class="sp"></span><button class="btn" data-x2>Закрити</button>';
  UI.drawer({title:isNew?'Нова послуга':esc(s.n),sub:isNew?'':catName(s.cat),size:'wide',body:body,foot:foot,onMount:function(el,cl){
    var priceBox=el.querySelector('[data-prices]');
    function readPrices(){s.price=num(gv(el,'price'));if(mode==='byLevel')db.levels.forEach(function(l){var x=g(el,'lv_'+l.id);if(x){var t=x.value.trim();if(t==='')delete s.byLevel[l.id];else s.byLevel[l.id]=num(t)}});
      if(mode==='byMaster')masters.forEach(function(m){var x=g(el,'ms_'+m.id);if(x){var t=x.value.trim();if(t==='')delete s.byMaster[m.id];else s.byMaster[m.id]=num(t)}})}
    function margin(){readPrices();var cost=num(gv(el,'cost'));var prices=[s.price];
      if(mode==='byLevel')prices=db.levels.map(function(l){return s.byLevel[l.id]!=null?s.byLevel[l.id]:Math.round(s.price*l.k/10)*10});
      if(mode==='byMaster'){var p2=masters.filter(function(m){return $('[name=pf_'+m.id+']',el).checked}).map(function(m){return s.byMaster[m.id]!=null?s.byMaster[m.id]:s.price});if(p2.length)prices=p2}
      var lo=Math.min.apply(null,prices),hi=Math.max.apply(null,prices);var mg=function(p){return p-cost};
      var pc2=function(p){return p?Math.round(mg(p)*100/p):0};
      el.querySelector('[data-margin]').innerHTML='<div class="lab-s">Маржа з послуги</div>'+(lo===hi?'<b class="num '+(mg(lo)<0?'dng-t':'')+'">'+U.uah(mg(lo))+'</b> <span class="mute">('+pc2(lo)+'% від ціни)</span>':'<b class="num">'+U.fmt(mg(lo))+'–'+U.fmt(mg(hi))+NB+'₴</b> <span class="mute">('+pc2(lo)+'–'+pc2(hi)+'%)</span>')+'<small class="mute" style="display:block;margin-top:2px">до зарплати майстра й податків</small>'}
    margin();
    el.addEventListener('input',function(e){if(e.target.matches('[data-p],[name=cost]')){if(e.target.name==='price'&&mode==='byLevel'){readPrices();$$('[name^=lv_]',el).forEach(function(x){var l=db.levels.find(function(l){return 'lv_'+l.id===x.name});x.placeholder=Math.round(s.price*l.k/10)*10})}margin()}});
    function rebuildPrices(){readPrices();priceBox.innerHTML=pricesBlock();margin()}
    el.addEventListener('change',function(e){if(e.target.name&&e.target.name.indexOf('pf_')===0){perf[e.target.name.slice(3)]=e.target.checked;if(mode==='byMaster')rebuildPrices();else margin()}
      if(e.target.name==='cat'){s.cat=e.target.value}
      if(e.target.name==='addon'){el.querySelector('[data-attach]').hidden=!e.target.checked}});
    var pfSet=function(fn){masters.forEach(function(m){var c=$('[name=pf_'+m.id+']',el);c.checked=fn(m);perf[m.id]=c.checked});if(mode==='byMaster')rebuildPrices();else margin()};
    act(el,{dur:function(t){g(el,'d').value=t.dataset.m},
      auto:function(){readPrices();db.levels.forEach(function(l){g(el,'lv_'+l.id).value=Math.round(s.price*l.k/10)*10});margin()},
      'pf-cat':function(){var c=gv(el,'cat');pfSet(function(m){return (m.cats||[]).indexOf(c)>=0||(m.svcs||[]).some(function(x){var sv=App.svc(x);return sv&&sv.cat===c})})},'pf-all':function(){pfSet(function(){return true})},'pf-none':function(){pfSet(function(){return false})},
      att:function(t){var on=t.getAttribute('aria-pressed')!=='true';t.setAttribute('aria-pressed',on);var i=s.attach.indexOf(t.dataset.id);if(on&&i<0)s.attach.push(t.dataset.id);if(!on&&i>=0)s.attach.splice(i,1)},
      res:function(t){var on=t.getAttribute('aria-pressed')!=='true';t.setAttribute('aria-pressed',on);var i=s.res.indexOf(t.dataset.id);if(on&&i<0)s.res.push(t.dataset.id);if(!on&&i>=0)s.res.splice(i,1)}});
    el.querySelector('[data-x2]').onclick=cl;
    if(!canEdit){$$('input,select,textarea,button[data-a]',el).forEach(function(x){x.disabled=true});return}
    var dl=el.querySelector('[data-del]');if(dl)dl.onclick=function(){delSvc(s.id,cl)};
    el.querySelector('[data-ok]').onclick=function(){readPrices();
      var n=gv(el,'n').trim();if(!n){g(el,'n').classList.add('err');g(el,'n').focus();return UI.toast('Вкажіть назву послуги',{type:'err'})}
      var d=Math.round(num(gv(el,'d')));if(d<5||d>720){g(el,'d').closest('.inp-suf').style.borderColor='var(--danger)';return UI.toast('Тривалість — від 5 хвилин до 12 годин',{type:'err'})}
      if(s.price<0)return UI.toast('Ціна не може бути відʼємною',{type:'err'});
      if(db.services.some(function(x){return x.id!==s.id&&x.cat===gv(el,'cat')&&x.n.toLowerCase()===n.toLowerCase()})){return UI.toast('У цій категорії вже є послуга «'+n+'»',{type:'err'})}
      var obj={n:n,cat:gv(el,'cat'),desc:gv(el,'desc').trim(),d:d,buffer:Math.round(num(gv(el,'buffer'))),price:Math.round(s.price),byLevel:mode==='byLevel'?s.byLevel:(old?old.byLevel:{}),byMaster:s.byMaster,cost:Math.round(num(gv(el,'cost'))),online:gc(el,'online'),active:gc(el,'active'),type:gc(el,'addon')?'addon':'main',attach:gc(el,'addon')?s.attach:[],hands4:gc(el,'hands4'),res:s.res};
      if(mode==='byLevel'){db.levels.forEach(function(l){if(obj.byLevel[l.id]==null)obj.byLevel[l.id]=Math.round(obj.price*l.k/10)*10})}
      if(old)obj.id=old.id;else{obj.order=db.services.length}
      var r=O.upsert('services',obj,(isNew?'Нова послуга: ':'Змінено послугу: ')+n);
      /* виконавці: звести фактичний стан із вибором у формі */
      masters.forEach(function(m){var cur=performs(m,r),want=perf[m.id];if(cur!==want)O.upsert('staff',{id:m.id,svcs:setPerforms(m,r.id,want)},'Послуги майстра '+m.short)});
      cl();UI.toast(isNew?'Послугу «'+esc(n)+'» створено':'Збережено');App.refresh()}
  }});
}
App.openService=openService;
App.performs=performs;App.svcPerformers=performers;App.staffSvcs=staffSvcs;

App.route('services',{title:'Послуги',icon:'scissors',nav:true,group:'salon',order:20,perm:'services.view',render:renderServices});

/* ═════════════════════════ КОМАНДА ═════════════════════════ */
var PERM_ROWS=[['home','Головна'],['calendar','Календар і записи'],['clients','Клієнти'],['checkout','Оплата візитів'],['cash','Каса'],['expenses','Витрати'],['certs','Сертифікати'],['abons','Абонементи'],['products','Товари й склад'],['tasks','Задачі'],['reviews','Відгуки'],['schedules','Графіки'],['services','Послуги'],['team','Команда'],['payroll','Зарплата'],['reports','Звіти'],['audit','Журнал дій'],['settings','Налаштування']];
function permLevel(mod,role){var a=App.PERMS[role];if(a==='*')return 'all';
  if(mod==='checkout'||mod==='home')return a.indexOf(mod)>=0?'all':'none';
  if(a.indexOf(mod+'.*')>=0)return 'all';if(a.indexOf(mod+'.view')>=0)return 'view';if(a.indexOf(mod+'.own')>=0)return 'own';
  var any=a.some(function(x){return x.indexOf(mod+'.')===0});return any?'part':'none'}
var PL={all:['Повний доступ','ok'],view:['Перегляд','plain'],own:['Лише своє','plain'],part:['Частково','plain'],none:['—','']};
function ensureMaster(st){ /* якщо роль стала «майстер» — дати шаблон графіка й оплати */
  var p={};if(!st.week){p.week=[[600,1140],[600,1140],[600,1140],[600,1140],[600,1140],null,null];p.brk=[[780,840],[780,840],[780,840],[780,840],[780,840],null,null]}
  if(!st.pay)p.pay={type:'pct',pct:null,fixed:0,svc:{},productPct:10,tipsPct:100};
  if(st.online==null)p.online=true;return p}
function revMonth(st){var T=App.today(),m=App.money(D.monthStart(T),T,st.id);return m.services+m.products}
function statsOf(st,from,to){var as=App.db.appts.filter(function(a){return a.staff===st.id&&a.date>=from&&a.date<=to});
  var done=as.filter(function(a){return a.status==='done'});var m=App.money(from,to,st.id);
  var cl={};done.forEach(function(a){if(a.client)cl[a.client]=(cl[a.client]||0)+1});
  var life={};App.db.appts.forEach(function(a){if(a.staff===st.id&&a.status==='done'&&a.client)life[a.client]=(life[a.client]||0)+1});
  var ids=Object.keys(cl),ret=ids.filter(function(c){return life[c]>=2}).length;
  var ns=as.filter(function(a){return a.status==='noshow'}).length,tot=as.filter(function(a){return a.status==='done'||a.status==='noshow'}).length;
  var bySvc={};done.forEach(function(a){a.items.forEach(function(i){var k=i.svc;bySvc[k]=bySvc[k]||{n:0,sum:0};bySvc[k].n++;bySvc[k].sum+=i.price})});
  return {visits:done.length,rev:m.services+m.products,avg:m.avgCheck,clients:ids.length,ret:ids.length?Math.round(ret*100/ids.length):null,noshow:tot?Math.round(ns*100/tot):0,bySvc:bySvc,m:m}}

function teamList(q){var t=(q.q||'').toLowerCase();
  return App.db.staff.filter(function(s){if(q.st==='arch'?s.active!==false:s.active===false)return false;
    if(q.role&&s.role!==q.role)return false;if(t&&(s.n+' '+(s.spec||'')).toLowerCase().indexOf(t)<0)return false;return true})}
function teamRow(s){var st=todayStatus(s),l=App.level(s.lvl),ld=s.week?loadWeek(s):null,r=ratingOf(s.id),isM=s.role==='master';
  return '<a class="sl-tr sl-tm'+(s.active===false?' is-off':'')+'" href="#/team/'+s.id+'" data-id="'+s.id+'">'+
   '<div class="sl-nm sl-nm-av">'+UI.av(s,'lg')+'<span class="t"><b class="ell">'+esc(s.n)+'</b><small class="ell">'+esc(App.ROLES[s.role].n)+(s.spec&&s.spec!==App.ROLES[s.role].n?' · '+esc(s.spec):'')+'</small></span></div>'+
   '<div class="sl-c sl-lvl">'+(l?'<span class="tag">'+esc(l.n)+'</span>':'<span class="faint">—</span>')+'</div>'+
   '<div class="sl-c sl-st">'+statDot(st.k)+'<span>'+esc(st.t)+'</span></div>'+
   '<div class="sl-c sl-ld">'+(ld!=null?'<span class="num">'+ld+'%</span><span class="bar-h"><i style="width:'+Math.min(100,ld)+'%"></i></span>':'<span class="faint">—</span>')+'</div>'+
   '<div class="sl-c sl-rt">'+(isM?rateTxt(r):'<span class="faint">—</span>')+'</div>'+
   '<div class="sl-c sl-rv r num">'+(isM&&s.active!==false?'<b>'+U.uah(revMonth(s))+'</b>':'<span class="faint">—</span>')+'</div>'+
   '<span class="sl-go">'+ic('right','s')+'</span></a>'}

function renderTeam(v,params,q){
  if(params[0])return renderStaffPage(v,params[0],q);
  var db=App.db;q=Object.assign({st:'act'},q);
  var act_n=db.staff.filter(function(s){return s.active!==false}).length,arc_n=db.staff.length-act_n;
  var list=teamList(q).sort(function(a,b){var o={owner:0,admin:1,master:2,accountant:3};return (o[a.role]-o[b.role])||0});
  var canEdit=mgr();
  var h='<div class="sl-bar"><div class="inp-ic sl-q">'+ic('search')+'<input class="inp" data-q placeholder="Пошук за імʼям чи спеціалізацією" value="'+esc(q.q||'')+'" aria-label="Пошук"></div>'+
   '<div class="seg"><button data-a="st" data-k="act" aria-pressed="'+(q.st==='act')+'">Активні <span class="mute">'+act_n+'</span></button><button data-a="st" data-k="arch" aria-pressed="'+(q.st==='arch')+'">Архів <span class="mute">'+arc_n+'</span></button></div></div>';
  h+='<div class="chips sl-cats"><button class="chip" data-a="role" data-k="" aria-pressed="'+(!q.role)+'">Всі</button>'+Object.keys(App.ROLES).map(function(k){var n=db.staff.filter(function(s){return s.role===k&&(q.st==='arch'?s.active===false:s.active!==false)}).length;return n?'<button class="chip" data-a="role" data-k="'+k+'" aria-pressed="'+(q.role===k)+'">'+App.ROLES[k].n+' <span class="cnt">'+n+'</span></button>':''}).join('')+'</div>';
  if(list.length)h+='<div class="sl-list"><div class="sl-tr sl-th sl-tm"><div>Співробітник</div><div class="sl-c">Рівень</div><div class="sl-c">Сьогодні</div><div class="sl-c">Завантаження тижня</div><div class="sl-c">Рейтинг</div><div class="sl-c r">Виторг за місяць</div><div></div></div>'+list.map(teamRow).join('')+'</div>';
  else h+=UI.empty('team',q.st==='arch'?'В архіві нікого немає':'Нікого не знайдено',q.st==='arch'?'Звільнені або призупинені співробітники зʼявляться тут — з історією записів і виплат.':'Змініть пошук або фільтр.',canEdit&&q.st!=='arch'?'<button class="btn pri" data-a="new">Додати співробітника</button>':'');
  h+='<p class="sl-hint">Завантаження тижня — частка робочого часу, зайнята записами (без скасованих). Виторг — оплачені послуги й товари за поточний місяць.</p>';
  var pg=page(v,'sl-team',h);
  App.setTop(canEdit?'<button class="btn pri" data-act="sl-staff-new">'+ic('plus')+'<span class="sl-lbl">Співробітник</span></button>':'');
  var qi=$('[data-q]',pg);qi.oninput=U.debounce(function(){qset({q:qi.value||null});var pos=qi.selectionStart;renderTeam(v,params,App.parse().q);var n=$('[data-q]',v);n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}},180);
  act(pg,{st:function(t){App.setQ({st:t.dataset.k==='act'?null:t.dataset.k},true)},role:function(t){App.setQ({role:t.dataset.k||null},true)},'new':function(){staffWizard()}});
}
App.actions['sl-staff-new']=function(){staffWizard()};
function openStaff(id){if(!id)return staffWizard();var s=App.staff(id);if(!s)return UI.toast('Співробітника не знайдено',{type:'err'});
  if(!App.can('team.view')&&App.me().id!==id)return UI.toast('Немає доступу до розділу «Команда»',{type:'err'});App.go('team/'+id)}
App.openStaff=openStaff;

/* ── профіль співробітника ── */
function renderStaffPage(v,id,q){
  var db=App.db,s=App.staff(id);
  if(!s){v.innerHTML='<div class="page">'+UI.empty('team','Співробітника не знайдено','Можливо, запис видалено.','<a class="btn" href="#/team">До команди</a>')+'</div>';return}
  var canView=App.can('team.view')||App.me().id===s.id;
  if(!canView){v.innerHTML='<div class="page">'+UI.empty('lock','Немає доступу','Розділ «Команда» недоступний для вашої ролі.','<a class="btn" href="#/home">На головну</a>')+'</div>';return}
  var isM=s.role==='master',payOk=App.can('payroll.view')||App.can('payroll.*')||(App.me().id===s.id&&App.can('payroll.own'));
  var tabs=[['profile','Профіль'],['services','Послуги'],['schedule','Графік'],['pay','Оплата'],['access','Доступ'],['stats','Статистика']].filter(function(t){
    if(t[0]==='services'||t[0]==='stats')return isM;if(t[0]==='schedule')return !!s.week||isM;if(t[0]==='pay')return payOk&&(isM||s.pay);return true});
  var self=App.me().id===s.id&&!App.can('team.view');
  if(self){tabs=tabs.filter(function(t){return t[0]!=='access'});var ord={schedule:0,services:1,stats:2,pay:3,profile:4};tabs.sort(function(a,b){return ord[a[0]]-ord[b[0]]})}
  var defTab=self&&tabs.some(function(t){return t[0]==='schedule'})?'schedule':'profile';
  var tab=q.tab&&tabs.some(function(t){return t[0]===q.tab})?q.tab:defTab;
  var st=todayStatus(s);
  var h=(self?'<a class="sl-back" href="#/more">'+ic('left','s')+'Ще</a>':'<a class="sl-back" href="#/team">'+ic('left','s')+'Команда</a>')+
   '<div class="sl-ph">'+UI.av(s,'xl')+'<div class="t"><h2>'+esc(s.n)+'</h2><div class="row wrap g12" style="margin-top:4px"><span class="badge plain">'+App.ROLES[s.role].n+'</span>'+(s.active===false?'<span class="badge cancelled">В архіві</span>':'<span class="sl-st">'+statDot(st.k)+esc(st.t)+'</span>')+(App.level(s.lvl)?'<span class="mute">'+esc(App.level(s.lvl).n)+'</span>':'')+(s.spec?'<span class="mute">· '+esc(s.spec)+'</span>':'')+'</div></div></div>'+
   '<div class="tabs" role="tablist">'+tabs.map(function(t){return '<button role="tab" data-a="tab" data-k="'+t[0]+'" aria-selected="'+(t[0]===tab)+'">'+t[1]+'</button>'}).join('')+'</div><div data-tab></div>';
  var pg=page(v,'sl-staff narrow',h);
  App.setTop(isM&&App.can('calendar.*')?'<a class="btn" href="#/calendar?staff='+s.id+'">'+ic('cal','s')+'<span class="sl-lbl">Календар</span></a>':'');
  act(pg,{tab:function(t){App.setQ({tab:t.dataset.k===defTab?null:t.dataset.k},true)}});
  var box=$('[data-tab]',pg);
  ({profile:tabProfile,services:tabServices,schedule:tabSchedule,pay:tabPay,access:tabAccess,stats:tabStats})[tab](box,s,q);
}
function saveStaff(id,patch,txt){var r=O.upsert('staff',Object.assign({id:id},patch),txt||'Змінено співробітника');return r}
function canEditStaff(s){return mgr()||false}

function tabProfile(box,s){
  var db=App.db,own=App.me().id===s.id,canEdit=mgr(),roleEd=isOwner();
  var levels=db.levels;
  var h='<div class="card sl-form"><div class="col-f g16">'+
   '<div class="grid2 m1">'+fld('Імʼя та прізвище','<input class="inp" name="n" value="'+esc(s.n)+'" maxlength="60">')+fld('Телефон','<input class="inp" name="ph" inputmode="tel" value="'+esc(s.ph?U.phone(s.ph):'')+'" placeholder="+380">')+'</div>'+
   '<div class="grid2 m1">'+fld('Роль',sel('role',Object.keys(App.ROLES).map(function(k){return [k,App.ROLES[k].n]}),s.role,roleEd?'':'disabled'),roleEd?'':'змінює власник')+
     '<div data-lvl-w>'+fld('Рівень майстра',sel('lvl',[['','— без рівня —']].concat(levels.map(function(l){return [l.id,l.n+' · '+l.pct+'%']})),s.lvl||''))+'</div></div>'+
   fld('Спеціалізація','<input class="inp" name="spec" value="'+esc(s.spec||'')+'" placeholder="Напр. Манікюр, тату, масаж" maxlength="60">')+
   '<div class="fld"><span>Колір у календарі</span><div class="sl-cols">'+COLORS.map(function(c){return '<label class="sl-col" title="Колір '+(c+1)+'"><input type="radio" name="c" value="'+c+'"'+(s.c===c?' checked':'')+'><span class="av" data-c="'+c+'">'+esc(s.ini||U.ini(s.n))+'</span></label>'}).join('')+'</div></div>'+
   '<div data-m-only>'+
     '<div class="set-row"><span class="t"><b>Приймає клієнтів</b><small>Показується в календарі й розкладі. Вимкніть для адміністратора чи власника, які не працюють з клієнтами.</small></span>'+UI.sw('works',!!s.week)+'</div>'+
     '<div class="set-row"><span class="t"><b>Видно в онлайн-записі</b><small>Клієнти можуть обрати цього майстра самостійно</small></span>'+UI.sw('online',s.online!==false)+'</div>'+
     (db.settings.modules.resources&&db.resources.length?'<div class="set-row"><span class="t"><b>Постійне місце</b><small>Кабінет чи крісло за замовчуванням</small></span><div style="width:200px;max-width:50%">'+sel('res',[['','—']].concat(db.resources.map(function(r){return [r.id,r.n]})),s.res||'')+'</div></div>':'')+
   '</div>'+
   fld('Про майстра','<textarea class="ta" name="bio" rows="3" placeholder="Кілька речень для сторінки онлайн-запису: досвід, сертифікати, стиль роботи">'+esc(s.bio||'')+'</textarea>')+
   '<div class="row"><span class="sp"></span><button class="btn" data-a="reset">Скасувати зміни</button><button class="btn pri" data-a="save">Зберегти</button></div></div></div>';
  box.innerHTML=h;
  var wrapEl=box;
  function sync(){var r=gv(box,'role');box.querySelector('[data-lvl-w]').hidden=r!=='master';var sw=g(box,'works'),on=r==='master'||sw.checked;box.querySelector('[data-m-only]').querySelectorAll('.set-row').forEach(function(x,i){if(i>0)x.hidden=!on})}
  sync();chg(box,{});box.addEventListener('change',function(e){if(e.target.name==='role'){var r=e.target.value;if(r==='master')g(box,'works').checked=true;sync()}if(e.target.name==='works')sync()});
  if(!canEdit){$$('input,select,textarea,button[data-a]',box).forEach(function(x){x.disabled=true});$('.sl-form .row',box).hidden=true}
  act(box,{reset:function(){App.refresh()},save:function(){
    var n=gv(box,'n').trim();if(!n){g(box,'n').classList.add('err');g(box,'n').focus();return UI.toast('Вкажіть імʼя',{type:'err'})}
    var ph=gv(box,'ph').replace(/\D/g,'');if(ph.length===10)ph='38'+ph;if(ph&&ph.length!==12)return UI.toast('Телефон: 12 цифр у форматі 380…',{type:'err'});
    if(ph&&db.staff.some(function(x){return x.id!==s.id&&x.ph===ph}))return UI.toast('Цей номер вже в іншого співробітника',{type:'err'});
    var role=gv(box,'role');
    if(s.role==='owner'&&role!=='owner'&&db.staff.filter(function(x){return x.role==='owner'&&x.active!==false}).length<2)return UI.toast('У салоні має лишитися хоча б один власник',{type:'err'});
    var works=role==='master'||gc(box,'works');
    var p={n:n,short:U.short(n),ini:U.ini(n),ph:ph,role:role,lvl:role==='master'?(gv(box,'lvl')||null):(gv(box,'lvl')||s.lvl||null),spec:gv(box,'spec').trim(),bio:gv(box,'bio').trim(),online:gc(box,'online')};
    var cc=box.querySelector('[name=c]:checked');if(cc)p.c=+cc.value;
    var rs=g(box,'res');if(rs)p.res=rs.value||null;
    if(works){Object.assign(p,ensureMaster(Object.assign({},s,p)));if(!s.week)p.works=true}else{p.week=null}
    if(role!=='master'&&works&&!s.week)p.week=ensureMaster({}).week;
    if(!works)p.works=false;
    saveStaff(s.id,p,'Змінено профіль: '+n);UI.toast('Профіль збережено');App.refresh()}})
}

/* ── послуги співробітника ── */
function tabServices(box,s){
  var db=App.db,canEdit=mgr(),mode=db.settings.pricing;
  var h='';
  if(mode!=='byMaster')h+='<div class="note" style="margin-bottom:12px">'+ic('info')+'<span>Особисті ціни застосовуються лише в режимі <b>«За майстром»</b> — зараз обрано «'+MODES[mode].n+'». Особиста тривалість діє завжди.'+(isOwner()?' <a class="link" data-a="mode">Увімкнути «За майстром»</a>':'')+'</span></div>';
  h+='<div class="row wrap" style="margin-bottom:12px"><span class="mute">Виконує <b data-cnt>'+staffSvcs(s).length+'</b> з '+db.services.length+' послуг</span><span class="sp"></span>'+(canEdit?'<button class="btn sm" data-a="all">Усі</button><button class="btn sm" data-a="none">Нікого</button>':'')+'</div>';
  h+=db.cats.map(function(c){var items=db.services.filter(function(x){return x.cat===c.id}).sort(function(a,b){return (a.order||0)-(b.order||0)});if(!items.length)return '';
    return '<section class="sl-grp"><header class="sl-grp-h"><h3>'+esc(c.n)+'</h3></header><div class="sl-list sl-ps"><div class="sl-ps-r sl-th"><div>Послуга</div><div class="r">Ціна, ₴</div><div class="r">Хвилин</div></div>'+items.map(function(x){var on=performs(s,x),bp=x.byMaster&&x.byMaster[s.id],dp=s.dur&&s.dur[x.id];
      return '<div class="sl-ps-r'+(on?'':' is-dim')+'" data-sv="'+x.id+'"><label class="check"><input type="checkbox" data-c="pf" data-id="'+x.id+'"'+(on?' checked':'')+(canEdit?'':' disabled')+'><span class="ell">'+esc(x.n)+'</span></label>'+
        '<div class="inp-suf sm"><input data-f="price" inputmode="decimal" value="'+(bp!=null?bp:'')+'" placeholder="'+App.priceFor(x,Object.assign({},s,{id:'-'}))+'" aria-label="Особиста ціна"'+(on&&canEdit?'':' disabled')+'><span>₴</span></div>'+
        '<div class="inp-suf sm"><input data-f="dur" inputmode="numeric" value="'+(dp!=null?dp:'')+'" placeholder="'+x.d+'" aria-label="Особиста тривалість"'+(on&&canEdit?'':' disabled')+'><span>хв</span></div></div>'}).join('')+'</div></section>'}).join('');
  box.innerHTML=h;
  function cnt(){box.querySelector('[data-cnt]').textContent=staffSvcs(App.staff(s.id)).length}
  chg(box,{pf:function(t){var st=App.staff(s.id);var on=t.checked;saveStaff(s.id,{svcs:setPerforms(st,t.dataset.id,on)},'Послуги майстра '+st.short);
    var r=t.closest('.sl-ps-r');r.classList.toggle('is-dim',!on);$$('input[data-f]',r).forEach(function(x){x.disabled=!on});cnt()}});
  box.addEventListener('change',function(e){var t=e.target;if(!t.dataset.f)return;var row=t.closest('[data-sv]'),x=App.svc(row.dataset.sv),st=App.staff(s.id);var val=t.value.trim();
    if(t.dataset.f==='price'){var bm=Object.assign({},x.byMaster||{});if(val==='')delete bm[s.id];else{var n=num(val);if(n<0)return UI.toast('Ціна не може бути відʼємною',{type:'err'});bm[s.id]=Math.round(n)}
      O.upsert('services',{id:x.id,byMaster:bm},'Особиста ціна: '+st.short+' — '+x.n);UI.toast(val===''?'Особисту ціну скинуто':'Особиста ціна збережена')}
    else{var du=Object.assign({},st.dur||{});if(val==='')delete du[x.id];else{var m=Math.round(num(val));if(m<5||m>720){t.value='';return UI.toast('Тривалість — від 5 до 720 хв',{type:'err'})}du[x.id]=m}
      saveStaff(s.id,{dur:du},'Особиста тривалість: '+st.short+' — '+x.n);UI.toast(val===''?'Тривалість скинуто':'Тривалість збережена')}});
  act(box,{all:function(){saveStaff(s.id,{svcs:db.services.map(function(x){return x.id})},'Усі послуги майстру '+s.short);UI.toast('Майстер виконує всі послуги');App.refresh()},
    none:function(){saveStaff(s.id,{svcs:[]},'Послуги майстра очищено: '+s.short);UI.toast('Список послуг очищено');App.refresh()},
    mode:function(){O.set('settings.pricing','byMaster','Режим цін: За майстром');UI.toast('Режим цін: За майстром');App.refresh()}});
}

/* ── шаблон графіка ── */
function weekEditor(box,s,onSave,opts){opts=opts||{};
  var week=clone(s.week||[null,null,null,null,null,null,null]),brk=clone(s.brk||[null,null,null,null,null,null,null]);
  while(brk.length<7)brk.push(null);
  var canEdit=opts.canEdit!==false;
  function draw(){var tot=0;
    box.innerHTML='<div class="sl-wk">'+D.WD.slice(1).concat([D.WD[0]]).map(function(nm,i){var w=week[i],b=brk[i];if(w)tot+=w[1]-w[0]-(b?b[1]-b[0]:0);
     return '<div class="sl-wk-r'+(w?'':' is-off')+'" data-i="'+i+'"><div class="sl-wk-d">'+UI.sw('',!!w,'data-c="on" data-i="'+i+'" aria-label="'+nm+'"'+(canEdit?'':' disabled'))+'<b>'+nm+'</b></div>'+
       (w?'<div class="sl-wk-t"><input type="time" class="inp" data-c="t" data-i="'+i+'" data-k="s" value="'+tv(w[0])+'" step="900" aria-label="Початок"'+(canEdit?'':' disabled')+'><span class="mute">–</span><input type="time" class="inp" data-c="t" data-i="'+i+'" data-k="e" value="'+tv(w[1])+'" step="900" aria-label="Кінець"'+(canEdit?'':' disabled')+'></div>'+
       '<div class="sl-wk-b">'+(b?'<span class="mute sl-wk-bl">перерва</span><input type="time" class="inp" data-c="b" data-i="'+i+'" data-k="s" value="'+tv(b[0])+'" step="900" aria-label="Початок перерви"'+(canEdit?'':' disabled')+'><span class="mute">–</span><input type="time" class="inp" data-c="b" data-i="'+i+'" data-k="e" value="'+tv(b[1])+'" step="900" aria-label="Кінець перерви"'+(canEdit?'':' disabled')+'><button class="icobtn ghost sm" data-a="nobrk" data-i="'+i+'" aria-label="Прибрати перерву"'+(canEdit?'':' disabled')+'>'+ic('x','s')+'</button>':'<button class="btn sm ghost" data-a="addbrk" data-i="'+i+'"'+(canEdit?'':' disabled')+'>'+ic('coffee','s')+'Перерва</button>')+'</div>':'<div class="sl-wk-t mute">Вихідний</div><div></div>')+'</div>'}).join('')+'</div>'+
     '<div class="row wrap" style="margin-top:12px"><span class="mute">Годин на тиждень: <b class="ink">'+hh(Math.round(tot/6)/10*60/6*6)+'</b></span>'+
     '</div>'}
  function hhTot(){}
  draw();
  /* швидкі шаблони */
  var presets=[['Пн–Пт','5/2',[0,1,2,3,4]],['Вт–Сб','5/2',[1,2,3,4,5]],['Пн–Сб','6/1',[0,1,2,3,4,5]],['Пн, Ср, Пт','3/4',[0,2,4]]];
  var pb=document.createElement('div');pb.className='row wrap sl-presets';pb.innerHTML=(canEdit?'<span class="mute">Швидко:</span>'+presets.map(function(p,i){return '<button class="chip" data-a="pre" data-i="'+i+'">'+p[0]+'</button>'}).join('')+'<button class="chip" data-a="copy1">Пн → усі робочі</button>':'');
  box.parentNode&&box.parentNode.insertBefore(pb,box);
  function fix(){}
  box.addEventListener('change',function(e){var t=e.target.closest('[data-c]');if(!t)return;var i=+t.dataset.i;
    if(t.dataset.c==='on'){week[i]=t.checked?(week.find(function(x){return x})||[600,1140]).slice():null;brk[i]=t.checked?((brk.find(function(x,j){return x&&week[j]})||null)&&brk.find(function(x,j){return x&&week[j]}).slice()):null;draw();return}
    var arr=t.dataset.c==='t'?week[i]:brk[i];var m=U.pm(t.value||'0:00');if(t.dataset.k==='s')arr[0]=m;else arr[1]=m;
    if(arr[1]<=arr[0]){UI.toast('Кінець має бути пізніше за початок',{type:'err'});arr[1]=Math.min(arr[0]+60,1439);}
    draw()});
  function bind(root){act(root,{addbrk:function(t){var i=+t.dataset.i,w=week[i];brk[i]=[Math.min(w[0]+240,w[1]-60),Math.min(w[0]+270,w[1]-30)];draw()},nobrk:function(t){brk[+t.dataset.i]=null;draw()},
    pre:function(t){var p=presets[+t.dataset.i][2];var ref=week.find(function(x){return x})||[600,1140],rb=brk.find(function(x,j){return x&&week[j]})||[780,840];week=week.map(function(_,j){return p.indexOf(j)>=0?ref.slice():null});brk=brk.map(function(_,j){return p.indexOf(j)>=0?rb.slice():null});draw()},
    copy1:function(){var j=week.findIndex(function(x){return x});if(j<0)return;var w0=week[j],b0=brk[j];week=week.map(function(x){return x?w0.slice():null});brk=brk.map(function(x,k){return week[k]?(b0?b0.slice():null):null});draw()}})}
  bind(box);bind(pb);
  return {get:function(){return {week:clone(week),brk:clone(brk)}},bar:pb};
}
function tabSchedule(box,s){
  var canEdit=mgr()||App.can('schedules.*');var db=App.db;
  box.innerHTML='<div class="card"><h3>Шаблон тижня</h3><p class="mute" style="margin:-4px 0 12px;font-size:13px">Звичайний графік. Конкретні дні, зміни й відпустки правляться в розділі «Графіки» — вони мають пріоритет над шаблоном.</p><div data-wk></div><div class="row" style="margin-top:14px"><a class="btn" href="#/schedules?staff='+s.id+'">'+ic('grid','s')+'Графіки</a><span class="sp"></span>'+(canEdit?'<button class="btn" data-a="reset">Скасувати</button><button class="btn pri" data-a="save">Зберегти шаблон</button>':'')+'</div></div>'+
    '<div class="card" style="margin-top:12px"><h3>Горизонт графіка</h3><div class="row wrap g12"><span class="t">Графік заповнено до <b>'+D.human(s.schedUntil||D.add(App.today(),30))+'</b></span><span class="sp"></span>'+(canEdit?'<button class="btn sm" data-a="ext">Продовжити на 4 тижні</button>':'')+'</div></div>';
  var ed=weekEditor(box.querySelector('[data-wk]'),s,null,{canEdit:canEdit});
  act(box,{reset:function(){App.refresh()},
    save:function(){var r=ed.get();if(!r.week.some(function(x){return x}) &&!(await0()))return;saveStaff(s.id,r,'Змінено шаблон графіка: '+s.short);UI.toast('Шаблон графіка збережено');App.refresh()},
    ext:function(){var u=D.add(s.schedUntil&&s.schedUntil>App.today()?s.schedUntil:App.today(),28);saveStaff(s.id,{schedUntil:u},'Графік продовжено до '+u);UI.toast('Графік продовжено до '+D.human(u));App.refresh()}});
  function await0(){UI.toast('Увімкніть хоча б один робочий день або вимкніть «Приймає клієнтів» у профілі',{type:'err'});return false}
}

/* ── оплата ── */
function tabPay(box,s){
  var db=App.db,canEdit=App.can('payroll.edit')||App.can('payroll.*')||isOwner();
  var pay=clone(s.pay||{type:'pct',pct:null,fixed:0,svc:{},productPct:0,tipsPct:100});pay.svc=pay.svc||{};
  var l=App.level(s.lvl),basePct=pay.pct!=null?pay.pct:(l?l.pct:0);
  var TYPES={pct:['Відсоток від послуг','Майстер отримує % від вартості виконаних послуг'],fixed:['Фіксована ставка','Фіксована сума на місяць, без відсотка'],fixed_pct:['Ставка + відсоток','Фіксована сума + % від послуг']};
  function body(){var svcs=Object.keys(pay.svc);
    return '<div class="card"><h3>Модель оплати</h3><div class="sl-radios">'+Object.keys(TYPES).map(function(k){return '<label class="sl-rad"><input type="radio" name="type" value="'+k+'"'+(pay.type===k?' checked':'')+(canEdit?'':' disabled')+'><span><b>'+TYPES[k][0]+'</b><small>'+TYPES[k][1]+'</small></span></label>'}).join('')+'</div>'+
     '<div class="grid2 m1" style="margin-top:14px">'+
       (pay.type!=='fixed'?fld('Відсоток від послуг',suf('pct',pay.pct!=null?String(pay.pct).replace('.',','):'','%',(canEdit?'':'disabled')+' placeholder="'+(l?l.pct:0)+'"'),l?'порожньо = за рівнем «'+esc(l.n)+'» ('+l.pct+'%)':'порожньо = 0%'):'')+
       (pay.type!=='pct'?fld('Ставка на місяць',suf('fixed',pay.fixed||0,'₴',canEdit?'':'disabled')):'')+
       fld('Відсоток з продажу товарів',suf('productPct',pay.productPct!=null?pay.productPct:'','%',canEdit?'':'disabled'),'за замовчуванням в салоні: '+db.settings.payroll.productPctDefault+'%')+
       fld('Чайові майстру',suf('tipsPct',pay.tipsPct!=null?pay.tipsPct:100,'%',canEdit?'':'disabled'),'100% = всі чайові майстру')+'</div></div>'+
     (pay.type!=='fixed'?'<div class="card" style="margin-top:12px"><h3>Особливі відсотки за послугами <span class="sp"></span>'+(canEdit?'<button class="btn sm" data-a="addsvc">'+ic('plus','s')+'Послуга</button>':'')+'</h3>'+
       (svcs.length?'<div class="sl-list">'+svcs.map(function(id){var sv=App.svc(id);return '<div class="li"><span class="t"><b>'+esc(sv?sv.n:id)+'</b><small>замість '+pc(basePct)+'</small></span><div class="inp-suf sm"><input data-f="svc" data-id="'+id+'" inputmode="decimal" value="'+pay.svc[id]+'"'+(canEdit?'':' disabled')+'><span>%</span></div>'+(canEdit?'<button class="icobtn ghost sm" data-a="rmsvc" data-id="'+id+'" aria-label="Прибрати">'+ic('x','s')+'</button>':'')+'</div>'}).join('')+'</div>':'<div class="mute" style="font-size:13px">Немає. Для всіх послуг діє відсоток вище. Додайте виняток, напр. 50% з хімічних процедур.</div>')+'</div>':'')+
     '<div class="card" style="margin-top:12px"><h3>Продаж сертифікатів і абонементів</h3><div class="sumrow"><span>Із продажу сертифікатів</span><b class="num">'+pc(db.settings.payroll.certSalePct||0)+'</b></div><div class="sumrow"><span>Із продажу абонементів</span><b class="num">'+pc(db.settings.payroll.abonSalePct||0)+'</b></div><p class="sl-hint" style="margin:8px 0 0">Спільні для всіх співробітників. '+(App.can('settings.manage')?'<a href="#/settings/payroll">Змінити в налаштуваннях</a>':'Змінює власник у налаштуваннях.')+'</p></div>'+
     '<div class="card" style="margin-top:12px"><h3>Приклад розрахунку</h3><div data-ex></div></div>'+
     (canEdit?'<div class="row" style="margin-top:14px"><span class="sp"></span><button class="btn" data-a="reset">Скасувати</button><button class="btn pri" data-a="save">Зберегти</button></div>':'')}
  function example(){var ex=db.services.find(function(x){return performs(s,x)})||db.services[0];if(!ex)return;var price=App.priceFor(ex,s);
    var p=pay.svc[ex.id]!=null?pay.svc[ex.id]:basePct;var e=pay.type==='fixed'?0:Math.round(price*p/100);
    box.querySelector('[data-ex]').innerHTML='<div class="sumrow"><span>'+esc(ex.n)+'</span><b class="num">'+U.uah(price)+'</b></div><div class="sumrow"><span>Майстру ('+(pay.type==='fixed'?'ставка — без відсотка':pc(p))+')</span><b class="num">'+U.uah(e)+'</b></div><div class="sumrow"><span>Салону</span><b class="num">'+U.uah(price-e)+'</b></div>'+(pay.type!=='pct'?'<div class="sumrow"><span class="mute">Ставка щомісяця</span><span class="num">'+U.uah(pay.fixed||0)+'</span></div>':'')}
  function draw(){box.innerHTML=body();example()}
  draw();
  function read(){pay.type=(box.querySelector('[name=type]:checked')||{}).value||pay.type;var f=function(n){var x=g(box,n);return x?x.value.trim():null};
    var p=f('pct');if(p!==null)pay.pct=p===''?null:Math.min(100,Math.max(0,num(p)));var fx=f('fixed');if(fx!==null)pay.fixed=Math.max(0,num(fx));var pp=f('productPct');if(pp!==null)pay.productPct=pp===''?null:Math.min(100,Math.max(0,num(pp)));var tp=f('tipsPct');if(tp!==null)pay.tipsPct=Math.min(100,Math.max(0,num(tp,100)));
    $$('[data-f=svc]',box).forEach(function(x){pay.svc[x.dataset.id]=Math.min(100,Math.max(0,num(x.value)))})}
  box.addEventListener('input',function(){read();basePct=pay.pct!=null?pay.pct:(l?l.pct:0);example()});
  box.addEventListener('change',function(e){if(e.target.name==='type'){read();draw()}});
  act(box,{reset:function(){App.refresh()},rmsvc:function(t){read();delete pay.svc[t.dataset.id];draw()},
    addsvc:function(){read();var opts=db.services.filter(function(x){return pay.svc[x.id]==null&&performs(s,x)});if(!opts.length)return UI.toast('Немає послуг для винятку',{type:'err'});
      UI.modal({title:'Особливий відсоток',size:'narrow',body:'<div class="col-f g12">'+fld('Послуга',sel('svc',opts.map(function(x){return [x.id,x.n]}),opts[0].id))+fld('Відсоток майстру',suf('p',String(basePct),'%'))+'</div>',foot:modalFoot('','Додати'),onMount:function(el,cl){el.querySelector('[data-x2]').onclick=cl;el.querySelector('[data-ok]').onclick=function(){pay.svc[gv(el,'svc')]=Math.min(100,Math.max(0,num(gv(el,'p'))));cl();draw()}}})},
    save:function(){read();if(pay.type!=='fixed'&&pay.pct==null&&!l){UI.toast('Вкажіть відсоток — у майстра немає рівня',{type:'err'});return}
      saveStaff(s.id,{pay:pay},'Змінено умови оплати: '+s.short);UI.toast('Умови оплати збережено');App.refresh()}});
}

/* ── доступ ── */
function tabAccess(box,s){
  var role=s.role,own=App.me().id===s.id,canEdit=mgr()&&!own;
  var link='https://'+(App.db.salon.site||'sola.slotly.ua')+'/join/'+slug(s.id+s.n).slice(0,4)+Math.abs(U.color(s.id+s.n)*7919+s.n.length*104729).toString(36).slice(0,5);
  var fut=App.db.appts.filter(function(a){return a.staff===s.id&&a.date>=App.today()&&(a.status==='new'||a.status==='confirmed'||a.status==='arrived')});
  var h='<div class="card"><h3>Права ролі «'+App.ROLES[role].n+'» <span class="sp"></span></h3><div class="sl-perms">'+PERM_ROWS.map(function(r){var lv=permLevel(r[0],role),p=PL[lv];return '<div class="sl-perm"><span>'+r[1]+'</span>'+(p[1]?'<span class="badge '+p[1]+'">'+p[0]+'</span>':'<span class="faint">—</span>')+'</div>'}).join('')+'</div>'+
    '<p class="mute" style="font-size:12.5px;margin:12px 0 0">Права задаються роллю. Щоб змінити роль співробітника — вкладка «Профіль».</p></div>';
  h+='<div class="card" style="margin-top:12px"><h3>Застосунок майстра</h3><p class="mute" style="margin:-4px 0 12px;font-size:13px">Майстер бачить свій календар, графік і заробіток у телефоні — без доступу до чужих клієнтів і каси.</p>'+
    '<div class="sl-link"><input class="inp" readonly value="'+esc(link)+'" aria-label="Посилання-запрошення"><button class="btn" data-a="copy">'+ic('copy','s')+'Копіювати</button></div>'+
    '<div class="row wrap" style="margin-top:10px"><button class="btn pri" data-a="invite">'+ic('tg','s')+'Запросити в застосунок майстра</button><span class="mute" style="font-size:12.5px">'+(s.invited?'Запрошення надіслано '+D.shortH(s.invited):'Ще не запрошено')+'</span></div></div>';
  h+='<div class="card" style="margin-top:12px"><h3>'+(s.active===false?'Архів':'Доступ до системи')+'</h3>'+
    (s.active===false?'<p class="mute" style="margin:0 0 12px">Співробітник в архіві: не показується в календарі й онлайн-записі, не може увійти. Історія записів і виплат збережена.</p><button class="btn pri" data-a="restore">Повернути з архіву</button>'
     :'<p class="mute" style="margin:0 0 12px">'+(own?'Це ваш обліковий запис — архівувати його не можна.':'Архівація прибирає співробітника з календаря й онлайн-запису та закриває вхід. Історію, виплати й відгуки зберігаємо.')+'</p><div class="row wrap">'+(canEdit?'<button class="btn dng" data-a="arch">'+ic('ban','s')+'Архівувати</button>':'')+'</div>')+'</div>';
  box.innerHTML=h;
  act(box,{copy:function(){copyText(link);UI.toast('Посилання скопійовано')},
    invite:function(){if(!mgr())return UI.toast('Запрошувати може власник або адміністратор',{type:'err'});saveStaff(s.id,{invited:App.today()},'Запрошення в застосунок: '+s.short);UI.toast('Запрошення надіслано в Telegram'+(s.ph?' ('+U.phone(s.ph)+')':''));App.refresh()},
    restore:function(){saveStaff(s.id,{active:true},'Повернуто з архіву: '+s.short);UI.toast('Співробітника повернуто');App.refresh()},
    arch:function(){
      if(s.role==='owner'&&App.db.staff.filter(function(x){return x.role==='owner'&&x.active!==false}).length<2)return UI.toast('Не можна архівувати єдиного власника',{type:'err'});
      UI.confirm({title:'Архівувати '+esc(s.short)+'?',text:(fut.length?'<b>Увага:</b> є '+fut.length+' '+U.plural(fut.length,'майбутній запис','майбутні записи','майбутніх записів')+' — їх треба перенести або скасувати вручну. ':'')+'Співробітник зникне з календаря й онлайн-запису. Історія збережеться.',ok:'Архівувати',danger:true}).then(function(y){if(!y)return;saveStaff(s.id,{active:false},'Архівовано: '+s.short);UI.toast('Співробітника архівовано',{undo:function(){saveStaff(s.id,{active:true},'Повернуто з архіву: '+s.short);App.refresh()}});App.go('team')})}});
}

/* ── статистика ── */
function tabStats(box,s,q){
  var T=App.today(),per=q.per||'30';
  var from=per==='mon'?D.monthStart(T):D.add(T,-(+per-1));
  var st=statsOf(s,from,T),r=ratingOf(s.id);
  var prevFrom=per==='mon'?D.addMonths(T,-1):D.add(from,-(+per)),prevTo=per==='mon'?D.add(D.monthStart(T),-1):D.add(from,-1);
  var pv=statsOf(s,prevFrom,prevTo);
  function dlt(a,b){if(!b)return '';var p=Math.round((a-b)*100/b);return '<div class="d '+(p>=0?'up':'down')+'">'+(p>=0?'▲ ':'▼ ')+Math.abs(p)+'% до попер. періоду</div>'}
  var days=D.range(from,T),byDay=days.map(function(d){return App.money(d,d,s.id)});
  var bucket=days.length>35?7:1,vals=[],labels=[];for(var i=0;i<days.length;i+=bucket){var chunk=byDay.slice(i,i+bucket);vals.push(U.sum(chunk,function(m){return m.services+m.products}));labels.push(D.shortH(days[i]))}
  var top=Object.keys(st.bySvc).map(function(k){return {id:k,n:st.bySvc[k].n,sum:st.bySvc[k].sum}}).sort(function(a,b){return b.sum-a.sum}).slice(0,5),mx=top.length?top[0].sum:1;
  var rvs=App.db.reviews.filter(function(x){return x.staff===s.id&&!x.hidden}).slice(0,3);
  var h='<div class="row wrap" style="margin-bottom:14px"><div class="seg">'+[['30','30 днів'],['90','90 днів'],['mon','Цей місяць']].map(function(p){return '<button data-a="per" data-k="'+p[0]+'" aria-pressed="'+(per===p[0])+'">'+p[1]+'</button>'}).join('')+'</div></div>'+
   '<div class="kpis sl-kpis"><div class="kpi"><div class="l">Візитів</div><div class="v num">'+st.visits+'</div>'+dlt(st.visits,pv.visits)+'</div><div class="kpi"><div class="l">Виторг</div><div class="v num">'+U.uah(st.rev)+'</div>'+dlt(st.rev,pv.rev)+'</div><div class="kpi"><div class="l">Середній чек</div><div class="v num">'+U.uah(st.avg)+'</div>'+dlt(st.avg,pv.avg)+'</div><div class="kpi"><div class="l">Повертаються</div><div class="v num">'+(st.ret!=null?st.ret+'%':'—')+'</div><div class="d">клієнтів, що були ≥ 2 разів</div></div></div>'+
   '<div class="grid2 m1" style="margin-top:12px"><div class="card"><h3>Виторг</h3>'+(U.sum(vals)?UI.bars(vals,{labels:labels,fmt:function(x){return U.uah(x)},h:110}):'<div class="mute">Немає даних за період</div>')+'</div>'+
   '<div class="card"><h3>Показники</h3><dl class="dl"><dt>Унікальних клієнтів</dt><dd>'+st.clients+'</dd><dt>Не прийшли</dt><dd>'+st.noshow+'%</dd><dt>Рейтинг</dt><dd>'+(r?rateTxt(r):'—')+'</dd><dt>Чайові</dt><dd>'+U.uah(st.m.tips)+'</dd><dt>Завантаження тижня</dt><dd>'+(loadWeek(s)!=null?loadWeek(s)+'%':'—')+'</dd></dl></div></div>'+
   '<div class="grid2 m1" style="margin-top:12px"><div class="card"><h3>Топ послуг</h3>'+(top.length?top.map(function(x){var sv=App.svc(x.id);return '<div class="sl-top"><span class="ell">'+esc(sv?sv.n:x.id)+'</span><span class="mute num">'+x.n+'×</span><b class="num">'+U.uah(x.sum)+'</b><span class="bar-h"><i style="width:'+Math.round(x.sum*100/mx)+'%"></i></span></div>'}).join(''):'<div class="mute">Немає даних</div>')+'</div>'+
   '<div class="card"><h3>Останні відгуки</h3>'+(rvs.length?rvs.map(function(x){return '<div class="sl-rv"><div class="row"><span class="sl-rate">'+ic('star','s')+x.rating+'</span><small class="mute">'+D.shortH(x.date)+'</small></div><p>'+esc(x.text)+'</p></div>'}).join(''):'<div class="mute">Відгуків ще немає</div>')+'</div></div>';
  box.innerHTML=h;act(box,{per:function(t){App.setQ({per:t.dataset.k==='30'?null:t.dataset.k},true)}});
}

/* ── майстер «+ Співробітник» ── */
function staffWizard(){
  if(!mgr())return UI.toast('Додавати співробітників може власник або адміністратор',{type:'err'});
  var db=App.db,st={n:'',ph:'',role:'master',lvl:(db.levels[1]||db.levels[0]||{}).id||null,spec:'',works:true,svcs:[]},step=0,wk=null;
  var ed=null;
  function steps(){var s=['Основне'];if(st.role==='master'){s.push('Послуги','Графік')}else if(st.works){s.push('Графік')}return s}
  function ui(el,cl){
    var S=steps(),cur=S[step];
    var head='<div class="sl-steps">'+S.map(function(x,i){return '<span class="'+(i===step?'on':i<step?'done':'')+'"><i>'+(i<step?'✓':(i+1))+'</i>'+x+'</span>'}).join('')+'</div>';
    var b='';
    if(cur==='Основне'){b='<div class="col-f g12">'+fld('Імʼя та прізвище','<input class="inp" name="n" value="'+esc(st.n)+'" placeholder="Напр. Анна Лисенко" maxlength="60">')+
      '<div class="grid2 m1">'+fld('Телефон','<input class="inp" name="ph" inputmode="tel" value="'+esc(st.ph)+'" placeholder="+380">')+fld('Роль',sel('role',Object.keys(App.ROLES).filter(function(k){return k!=='owner'||isOwner()}).map(function(k){return [k,App.ROLES[k].n]}),st.role))+'</div>'+
      (st.role==='master'?'<div class="grid2 m1">'+fld('Рівень',sel('lvl',db.levels.map(function(l){return [l.id,l.n+' · '+l.pct+'%']}),st.lvl))+fld('Спеціалізація','<input class="inp" name="spec" value="'+esc(st.spec)+'" placeholder="Манікюр, барбер, масаж…">')+'</div>':
        fld('Посада','<input class="inp" name="spec" value="'+esc(st.spec)+'" placeholder="Напр. Адміністратор">')+'<label class="check"><input type="checkbox" name="works"'+(st.works?' checked':'')+'> Приймає клієнтів (потрібен графік)</label>')+'</div>'}
    else if(cur==='Послуги'){b='<p class="mute" style="margin:0 0 10px;font-size:13px">Оберіть послуги, які виконуватиме майстер. Ціни візьмуться за його рівнем.</p>'+
      db.cats.map(function(c){var items=db.services.filter(function(x){return x.cat===c.id&&x.active!==false});if(!items.length)return '';return '<div class="sl-wz-c"><div class="row"><b>'+esc(c.n)+'</b><span class="sp"></span><button class="btn sm ghost" data-a="wz-cat" data-k="'+c.id+'">Усі / жодної</button></div><div class="chips" style="margin-top:6px">'+items.map(function(x){return '<button class="chip" data-a="wz-svc" data-id="'+x.id+'" aria-pressed="'+(st.svcs.indexOf(x.id)>=0)+'">'+esc(x.n)+'</button>'}).join('')+'</div></div>'}).join('')}
    else{b='<p class="mute" style="margin:0 0 10px;font-size:13px">Звичайний тиждень. Конкретні дні й відпустки можна змінити потім у «Графіках».</p><div data-wk></div>'}
    el.querySelector('.modal-b').innerHTML=head+b;
    el.querySelector('[data-ok]').textContent=step===S.length-1?'Створити':'Далі';
    el.querySelector('[data-back]').hidden=step===0;
    if(cur==='Графік'){var tmpl={week:wk?wk.week:[[600,1140],[600,1140],[600,1140],[600,1140],[600,1140],null,null],brk:wk?wk.brk:[[780,840],[780,840],[780,840],[780,840],[780,840],null,null]};ed=weekEditor(el.querySelector('[data-wk]'),tmpl,null,{})}
    var f=el.querySelector('input:not([type=hidden])');if(f&&window.innerWidth>899&&cur==='Основне')f.focus();
  }
  function collect(el){var cur=steps()[step];if(cur==='Основне'){st.n=gv(el,'n').trim();st.ph=gv(el,'ph');st.role=gv(el,'role');if(g(el,'lvl'))st.lvl=gv(el,'lvl');st.spec=gv(el,'spec').trim();if(g(el,'works'))st.works=gc(el,'works');else if(st.role==='master')st.works=true}
    if(cur==='Графік'&&ed)wk=ed.get()}
  UI.modal({title:'Новий співробітник',size:'wide',body:'',foot:'<button class="btn" data-back hidden>Назад</button><span class="sp"></span><button class="btn" data-x2>Скасувати</button><button class="btn pri" data-ok>Далі</button>',
   onMount:function(el,cl){
     ui(el,cl);
     el.querySelector('[data-x2]').onclick=cl;
     el.addEventListener('change',function(e){if(e.target.name==='role'||e.target.name==='works'){collect(el);ui(el,cl)}});
     el.querySelector('[data-back]').onclick=function(){collect(el);step--;ui(el,cl)};
     act(el,{'wz-svc':function(t){var i=st.svcs.indexOf(t.dataset.id);if(i<0)st.svcs.push(t.dataset.id);else st.svcs.splice(i,1);t.setAttribute('aria-pressed',i<0)},
       'wz-cat':function(t){var ids=db.services.filter(function(x){return x.cat===t.dataset.k&&x.active!==false}).map(function(x){return x.id});var all=ids.every(function(i){return st.svcs.indexOf(i)>=0});
         st.svcs=st.svcs.filter(function(i){return ids.indexOf(i)<0});if(!all)st.svcs=st.svcs.concat(ids);ui(el,cl)}});
     el.querySelector('[data-ok]').onclick=function(){collect(el);var S=steps(),cur=S[step];
       if(cur==='Основне'){if(!st.n){g(el,'n').classList.add('err');g(el,'n').focus();return UI.toast('Вкажіть імʼя',{type:'err'})}
         var ph=st.ph.replace(/\D/g,'');if(ph.length===10)ph='38'+ph;if(ph&&ph.length!==12)return UI.toast('Телефон: 12 цифр у форматі 380…',{type:'err'});st.ph=ph;
         if(ph&&db.staff.some(function(x){return x.ph===ph}))return UI.toast('Співробітник з таким номером вже є',{type:'err'})}
       if(cur==='Графік'&&!wk.week.some(function(x){return x}))return UI.toast('Увімкніть хоча б один робочий день',{type:'err'});
       if(step<S.length-1){step++;ui(el,cl);return}
       var isM=st.role==='master',id=U.uid(isM?'m':'s');
       var obj={id:id,n:st.n,short:U.short(st.n),ini:U.ini(st.n),c:db.staff.length%8,role:st.role,lvl:isM?st.lvl:null,spec:st.spec||App.ROLES[st.role].n,ph:st.ph,active:true,since:App.today(),tg:true,works:st.works,online:isM,schedUntil:D.add(App.today(),28)};
       if(st.works&&wk){obj.week=wk.week;obj.brk=wk.brk}else obj.week=null;
       if(isM){obj.svcs=st.svcs.slice();var cs={};st.svcs.forEach(function(x){var sv=App.svc(x);if(sv)cs[sv.cat]=1});obj.cats=Object.keys(cs);obj.pay={type:'pct',pct:null,fixed:0,svc:{},productPct:10,tipsPct:100}}
       else if(st.role==='admin')obj.pay={type:'fixed',fixed:0,pct:0};
       O.upsert('staff',obj,'Новий співробітник: '+st.n);cl();UI.toast('Співробітника «'+esc(st.n)+'» додано');App.go('team/'+id)}}})
}

/* ═════════════════════════ ГРАФІКИ ═════════════════════════ */
var SCH_V={week:[7,'Тиждень'],two:[14,'2 тижні'],month:[0,'Місяць']};
function schView(q){return SCH_V[q.v]?q.v:'two'}
function schRange(q){var T=App.today(),v=schView(q),st=q.d&&/^\d{4}-\d\d-\d\d$/.test(q.d)?q.d:null;
  if(v==='month'){var m=D.monthStart(st||T);return {v:v,from:m,to:D.monthEnd(m),title:D.MONN[D.parse(m).getMonth()]+' '+D.parse(m).getFullYear()}}
  var from=D.weekStart(st||T),n=SCH_V[v][0],to=D.add(from,n-1);
  var a=D.parse(from),b=D.parse(to);return {v:v,from:from,to:to,title:a.getDate()+(a.getMonth()!==b.getMonth()?' '+D.MONS[a.getMonth()]:'')+' – '+b.getDate()+' '+D.MONS[b.getMonth()]+' '+b.getFullYear()}}
function schStep(q,dir){var r=schRange(q);return r.v==='month'?D.addMonths(r.from,dir):D.add(r.from,dir*SCH_V[r.v][0])}
/* стан клітинки */
function cellState(stId,date){var to=App.timeOff(stId,date);if(to)return {k:'to',kind:to.kind,to:to};
  var w=rawShift(stId,date);if(!w)return {k:'off',custom:!!(App.db.sched[stId]&&App.db.sched[stId][date]===null)};return {k:'on',w:w,custom:!!w.custom}}
function cellHtml(s,date,T){var c=cellState(s.id,date),cls='sl-cell k-'+c.k+(c.custom?' cu':'')+(date===T?' tdy':'')+(date>(s.schedUntil||'9')?' fut':''),inner;
  if(c.k==='on')inner='<b>'+hrs(c.w.start,c.w.end)+'</b>'+(c.w.brk?'<i class="brk" title="перерва '+hrs(c.w.brk[0],c.w.brk[1])+'"></i>':'');
  else if(c.k==='to')inner='<span class="to">'+({vacation:'Відп.',sick:'Лік.',personal:'Відг.'}[c.kind])+'</span>';
  else inner='<span class="no">вих.</span>';
  return '<button class="'+cls+'" data-cell data-s="'+s.id+'" data-d="'+date+'" aria-label="'+esc(s.short+', '+D.human(date)+': '+cellLabel(c))+'">'+inner+'</button>'}
function cellLabel(c){return c.k==='on'?hrs(c.w.start,c.w.end):c.k==='to'?KIND[c.kind]:'вихідний'}

function renderSchedules(v,params,q){
  var db=App.db,T=App.today(),me=App.me(),isM=me.role==='master'&&!App.can('schedules.*'),edit=!isM&&(mgr()||App.can('schedules.*'));
  var R=schRange(q),days=D.range(R.from,R.to);
  var staff=App.masters().filter(function(s){return s.week||true});
  if(isM)staff=staff.filter(function(s){return s.id===me.id});
  staff=staff.slice();
  var selStaff=q.staff&&staff.some(function(s){return s.id===q.staff})?q.staff:staff[0]&&staff[0].id;
  var h='';
  /* горизонт */
  var short=staff.filter(function(s){return (s.schedUntil||'')<D.add(T,14)});
  if(short.length&&edit)h+='<div class="note warn sl-hz">'+ic('alert')+'<span style="flex:1"><b>Графік заповнено лише до '+short.map(function(s){return s.short+' — '+D.shortH(s.schedUntil||T)}).join('; ')+'.</b> Менше ніж на 14 днів вперед: клієнти не зможуть записатися далі. Продовжіть за шаблоном тижня.</span><button class="btn sm" data-a="hz">Продовжити на 4 тижні</button></div>';
  /* тулбар */
  h+='<div class="sl-bar"><div class="row"><button class="icobtn" data-a="nav" data-n="-1" aria-label="Назад">'+ic('left')+'</button><button class="icobtn" data-a="nav" data-n="1" aria-label="Вперед">'+ic('right')+'</button><b class="sl-per">'+R.title+'</b><button class="btn sm ghost" data-a="today">Сьогодні</button></div><span class="sp"></span>'+
    '<div class="seg">'+Object.keys(SCH_V).map(function(k){return '<button data-a="view" data-k="'+k+'" aria-pressed="'+(R.v===k)+'">'+SCH_V[k][1]+'</button>'}).join('')+'</div>'+
    (edit?'<button class="btn" data-a="copy">'+ic('copy','s')+'<span class="sl-lbl">Копіювати тиждень</span></button><button class="btn" data-a="pick" aria-pressed="false">'+ic('checks','s')+'<span class="sl-lbl">Вибрати</span></button>':'')+
    (isM?'<button class="btn pri" data-a="req">'+ic('hand','s')+'Запит на вихідний</button>':'')+'</div>';
  /* десктоп-сітка */
  var colMin=R.v==='month'?46:R.v==='two'?64:90;
  h+='<div class="sl-sch d-grid" data-grid><div class="sl-sch-w"><table class="sl-gt" style="--cm:'+colMin+'px"><thead><tr><th class="sl-who">Майстер</th>'+days.map(function(d){var wd=D.wd1(d);return '<th class="'+(d===T?'tdy ':'')+(wd>=5?'we':'')+'"><span>'+D.WDS[(wd+1)%7]+'</span><b>'+(+d.slice(8))+'</b></th>'}).join('')+'<th class="sl-sum">Годин</th></tr></thead><tbody>'+
   (staff.length?staff.map(function(s){var tot=0;days.forEach(function(d){var c=cellState(s.id,d);if(c.k==='on')tot+=shiftMin(c.w)});
    return '<tr data-row="'+s.id+'"><th class="sl-who"><a href="#/team/'+s.id+'" class="row">'+UI.av(s,'sm')+'<span class="t"><b class="ell">'+esc(s.short)+'</b><small class="ell mute">'+esc((App.level(s.lvl)||{}).n||s.spec||'')+'</small></span></a></th>'+days.map(function(d){return '<td>'+cellHtml(s,d,T)+'</td>'}).join('')+'<td class="sl-sum num">'+Math.round(tot/60)+'</td></tr>'}).join('')
    :'<tr><td colspan="'+(days.length+2)+'">'+UI.empty('grid','Немає майстрів','Додайте майстра в розділі «Команда».')+'</td></tr>')+'</tbody>'+
   (staff.length>1?'<tfoot><tr><th class="sl-who">Працює</th>'+days.map(function(d){var n=staff.filter(function(s){return cellState(s.id,d).k==='on'}).length;return '<td class="num'+(n===0?' zero':'')+'">'+n+'</td>'}).join('')+'<td></td></tr></tfoot>':'')+'</table></div></div>';
  /* мобільний: один майстер, список днів */
  var s1=App.staff(selStaff);
  h+='<div class="sl-mlist" data-mlist>'+(isM||staff.length<2?'':'<div class="chips scroll sl-mchips">'+staff.map(function(s){return '<button class="chip" data-a="ms" data-id="'+s.id+'" aria-pressed="'+(s.id===selStaff)+'">'+esc(s.short)+'</button>'}).join('')+'</div>')+
   (s1?'<div class="list">'+days.map(function(d){var c=cellState(s1.id,d),wd=D.wd1(d);
    return '<button class="li sl-md k-'+c.k+(d===T?' tdy':'')+(c.custom?' cu':'')+'" data-cell data-s="'+s1.id+'" data-d="'+d+'"><span class="sl-md-d"><b>'+(+d.slice(8))+'</b><small>'+D.WDS[(wd+1)%7]+'</small></span><span class="t"><b>'+(c.k==='on'?hrs(c.w.start,c.w.end):c.k==='to'?KIND[c.kind]:'Вихідний')+'</b><small>'+(c.k==='on'?(c.w.brk?'перерва '+hrs(c.w.brk[0],c.w.brk[1]):'без перерви'):c.k==='to'&&c.to.note?esc(c.to.note):(c.custom?'змінено вручну':''))+(App.apptsOn(d,s1.id).filter(App.active).length?' · '+App.apptsOn(d,s1.id).filter(App.active).length+' зап.':'')+'</small></span><span class="sl-chk" aria-hidden="true"></span>'+ic('right','s')+'</button>'}).join('')+'</div>':'')+'</div>';
  h+='<div class="sl-legend"><span><i class="lg on"></i>Працює</span><span><i class="lg off"></i>Вихідний</span><span><i class="lg to"></i>Відпустка / лікарняний</span><span><i class="lg cu"></i>Змінено вручну</span><span><i class="lg fut"></i>Після горизонту графіка</span>'+(edit?'<span class="mute">Клік — змінити день · протягніть мишею — вибрати діапазон</span>':'')+'</span></div>';
  /* відпустки */
  var tos=db.timeoff.filter(function(t){return (!isM||t.staff===me.id)&&t.to>=T}).sort(function(a,b){return a.from<b.from?-1:1}),pastN=db.timeoff.filter(function(t){return (!isM||t.staff===me.id)&&t.to<T}).length;
  h+='<section class="sl-grp sl-to"><header class="sl-grp-h"><h3>Відпустки та лікарняні <span class="mute">'+tos.length+'</span></h3><span class="sp"></span>'+(edit?'<button class="btn sm" data-a="to-new">'+ic('plus','s')+'Додати</button>':'')+'</header>'+
   (tos.length?'<div class="list">'+tos.map(function(t){var s=App.staff(t.staff),ap=apptsInRange(t.staff,t.from,t.to);
    return '<div class="li"><span class="t"><b>'+(s?esc(s.short):'—')+' · '+KIND[t.kind]+'</b><small>'+D.shortH(t.from)+(t.to!==t.from?' – '+D.shortH(t.to):'')+' · '+(D.diff(t.from,t.to)+1)+' '+U.plural(D.diff(t.from,t.to)+1,'день','дні','днів')+(t.note&&t.note!==KIND[t.kind]?' · '+esc(t.note):'')+'</small></span>'+(ap.length?'<span class="badge warn" title="Записи в цей період">'+ap.length+' '+U.plural(ap.length,'запис','записи','записів')+'</span>':'')+(edit?'<button class="icobtn ghost sm" data-a="to-edit" data-id="'+t.id+'" aria-label="Редагувати">'+ic('edit','s')+'</button><button class="icobtn ghost sm" data-a="to-del" data-id="'+t.id+'" aria-label="Видалити">'+ic('trash','s')+'</button>':'')+'</div>'}).join('')+'</div>':'<div class="sl-empty-g">Майбутніх відпусток і лікарняних немає</div>')+
   (pastN?'<p class="sl-hint" style="margin-top:8px">Минулих записів: '+pastN+'</p>':'')+'</section>';
  /* панель вибору */
  h+='<div class="sl-selbar" data-selbar hidden><b data-sn></b><span class="sp"></span><button class="btn sm" data-a="sel-clear">Скасувати</button><button class="btn pri sm" data-a="sel-apply">Змінити вибране</button></div>';
  var pg=page(v,'sl-schedules wide',h);
  App.setTop(edit?'<button class="icobtn" data-act="sl-sch-more" aria-label="Ще дії">'+ic('morev')+'</button><button class="btn pri" data-act="sl-to-new">'+ic('plus')+'<span class="sl-lbl">Відпустка</span></button>':'');
  /* вибір */
  var sel={},anchor=null,pickMode=false,dragging=false,moved=false;
  function selKeys(){return Object.keys(sel)}
  function paint(){$$('[data-cell]',pg).forEach(function(c){c.classList.toggle('sel',!!sel[c.dataset.s+'|'+c.dataset.d])});var n=selKeys().length,bar=$('[data-selbar]',pg);bar.hidden=!n;$('[data-sn]',bar).textContent='Вибрано: '+n+' '+U.plural(n,'день','дні','днів')}
  function rect(a,b){var rows=$$('[data-row]',pg).map(function(r){return r.dataset.row});var ra=rows.indexOf(a.s),rb=rows.indexOf(b.s);var out={};
    if(ra<0||rb<0){if(a.s===b.s){D.range(a.d<b.d?a.d:b.d,a.d<b.d?b.d:a.d).forEach(function(d){out[a.s+'|'+d]=1})}return out}
    var r1=Math.min(ra,rb),r2=Math.max(ra,rb),d1=a.d<b.d?a.d:b.d,d2=a.d<b.d?b.d:a.d;
    for(var i=r1;i<=r2;i++)D.range(d1,d2).forEach(function(d){if(days.indexOf(d)>=0)out[rows[i]+'|'+d]=1});return out}
  function info(c){return {s:c.dataset.s,d:c.dataset.d}}
  var grid=$('[data-grid]',pg);
  if(edit){
    grid.addEventListener('mousedown',function(e){var c=e.target.closest('[data-cell]');if(!c||e.button)return;dragging=true;moved=false;
      if(e.shiftKey&&anchor){sel=rect(anchor,info(c));paint();e.preventDefault();dragging=false;moved=true;return}
      anchor=info(c);grid._start=anchor;e.preventDefault()});
    grid.addEventListener('mouseover',function(e){if(!dragging)return;var c=e.target.closest('[data-cell]');if(!c)return;var i=info(c);if(i.s===anchor.s&&i.d===anchor.d&&!moved)return;moved=true;sel=rect(anchor,i);paint()});
    document.addEventListener('mouseup',function up(){if(!document.body.contains(pg)){document.removeEventListener('mouseup',up);return}dragging=false});
    grid.addEventListener('click',function(e){var c=e.target.closest('[data-cell]');if(!c)return;e.preventDefault();
      if(moved){moved=false;return}
      if(e.shiftKey)return;
      if(pickMode||selKeys().length){var k=c.dataset.s+'|'+c.dataset.d;if(sel[k])delete sel[k];else sel[k]=1;anchor=info(c);paint();return}
      dayModal(c.dataset.s,[c.dataset.d])});
  }
  $('[data-mlist]',pg).addEventListener('click',function(e){var c=e.target.closest('[data-cell]');if(!c)return;
    if(isM)return reqModal(c.dataset.s,c.dataset.d);
    if(pickMode||selKeys().length){var k=c.dataset.s+'|'+c.dataset.d;if(sel[k])delete sel[k];else sel[k]=1;paint();return}
    if(edit)dayModal(c.dataset.s,[c.dataset.d])});
  if(isM)grid.addEventListener('click',function(e){var c=e.target.closest('[data-cell]');if(c)reqModal(c.dataset.s,c.dataset.d)});
  document.addEventListener('keydown',function kd(e){if(!document.body.contains(pg)){document.removeEventListener('keydown',kd);return}if(e.key==='Escape'&&selKeys().length&&!$('.ov')){sel={};paint()}});
  function go(patch){App.setQ(patch,true)}
  act(pg,{
    nav:function(t){go({d:schStep(q,+t.dataset.n)})},today:function(){go({d:null})},view:function(t){go({v:t.dataset.k==='two'?null:t.dataset.k,d:t.dataset.k==='month'?R.from:R.from})},
    ms:function(t){go({staff:t.dataset.id})},
    pick:function(t){pickMode=!pickMode;t.setAttribute('aria-pressed',pickMode);t.classList.toggle('on',pickMode);pg.classList.toggle('picking',pickMode);if(!pickMode){sel={};paint()}else UI.toast('Режим вибору: торкайтесь днів, потім «Змінити вибране»')},
    'sel-clear':function(){sel={};pickMode=false;pg.classList.remove('picking');paint()},
    'sel-apply':function(){bulkShift(selKeys().map(function(k){var a=k.split('|');return {staff:a[0],date:a[1]}}),function(){sel={};App.refresh()})},
    hz:function(){short.forEach(function(s){O.upsert('staff',{id:s.id,schedUntil:D.add(s.schedUntil&&s.schedUntil>T?s.schedUntil:T,28)},'Горизонт графіка: '+s.short)});UI.toast('Графік продовжено за шаблоном на 4 тижні');App.refresh()},
    copy:function(){copyWeekModal(R.from)},req:function(){reqModal(me.id,null)},
    'to-new':function(){timeoffModal(null,{staff:selStaff})},'to-edit':function(t){timeoffModal(t.dataset.id)},'to-del':function(t){delTimeoff(t.dataset.id)}
  });
}
App.actions['sl-to-new']=function(){timeoffModal(null,{staff:(App.parse().q||{}).staff})};
App.actions['sl-sch-more']=function(e){var b=e.target.closest('[data-act]');UI.menu(b,[{t:'Лікарняний на сьогодні',ic:'alert',fn:function(){sickToday((App.parse().q||{}).staff)}},{t:'Відпустка або відгул',ic:'plus',fn:function(){timeoffModal(null,{staff:(App.parse().q||{}).staff})}}])};
/* «Лікарняний на сьогодні» (SYSTEM §4.12): одна дія — день закрито, далі розібрати записи */
function sickToday(stId){var T=App.today(),ms=App.masters().filter(function(s){return s.week});if(!ms.length)return UI.toast('Немає майстрів із графіком',{type:'err'});
  var cur=App.staff(stId)&&App.staff(stId).week?stId:(ms.find(function(s){return apptsInRange(s.id,T,T).length})||ms[0]).id;
  function list(id){var ap=apptsInRange(id,T,T);return ap.length?'<div class="sl-list sl-sick">'+ap.map(function(a){var c=App.client(a.client);return '<div class="li" data-id="'+a.id+'"><span class="t"><b class="num">'+U.hm(a.start)+' · '+esc(c?c.n:'Без імені')+'</b><small class="ell">'+esc(App.apptTitle(a))+'</small></span><button class="btn sm" data-sk="move" data-id="'+a.id+'">Перенести</button><button class="btn sm dng" data-sk="cancel" data-id="'+a.id+'">Скасувати</button></div>'}).join('')+'</div>':UI.empty('cal','Записів на сьогодні немає','Можна просто закрити день — клієнтів повідомляти не треба.')}
  UI.modal({title:'Лікарняний на сьогодні',size:'narrow',body:'<div class="col-f g12">'+fld('Майстер',sel('staff',ms.map(function(s){return [s.id,s.short]}),cur))+'<p class="sl-hint" style="margin:0">'+D.human(T)+'. Онлайн-запис до майстра закриється, записи нижче треба перенести або скасувати з повідомленням клієнту.</p><div data-sl></div></div>',
   foot:modalFoot('','Закрити день'),onMount:function(el,cl){var box=el.querySelector('[data-sl]');function draw(){box.innerHTML=list(gv(el,'staff'))}draw();
    el.addEventListener('change',function(e){if(e.target.name==='staff')draw()});
    box.addEventListener('click',function(e){var b=e.target.closest('[data-sk]');if(!b)return;var a=App.appt(b.dataset.id);if(!a)return;var c=App.client(a.client);
     if(b.dataset.sk==='move'){cl();return App.moveAppt(a.id)}
     UI.confirm({title:'Скасувати запис о '+U.hm(a.start)+'?',text:(c?esc(c.n)+' отримає повідомлення про скасування.':'Клієнта не вказано.'),ok:'Скасувати й повідомити',danger:true}).then(function(y){if(!y)return;
      O.setStatus(a.id,'cancelled',{reason:'Майстер на лікарняному'});if(c&&(c.tg||c.ph))O.sendMsg({client:c.id,appt:a.id,tpl:'cancel',txt:'Вибачте, майстер захворів. Запис скасовано — напишіть, підберемо інший час.'});UI.toast('Запис скасовано'+(c&&(c.tg||c.ph)?', клієнта повідомлено':''));draw()})});
    el.querySelector('[data-ok]').onclick=function(){var id=gv(el,'staff'),s=App.staff(id),ov=App.db.timeoff.some(function(x){return x.staff===id&&x.from<=T&&x.to>=T});
     if(!ov)O.upsert('timeoff',{staff:id,kind:'sick',from:T,to:T,note:'Лікарняний'},'Лікарняний на сьогодні: '+s.short);
     var n=apptsInRange(id,T,T).length;cl();UI.toast('Лікарняний: '+s.short+(n?'. Ще не розібрано записів: '+n:''),n?{type:'ok',ms:4500}:undefined);App.refresh()}}})}
App.sickToday=sickToday;

function apptsInRange(stId,from,to){return App.db.appts.filter(function(a){return a.staff===stId&&a.date>=from&&a.date<=to&&(a.status==='new'||a.status==='confirmed'||a.status==='arrived')}).sort(function(a,b){return a.date===b.date?a.start-b.start:a.date<b.date?-1:1})}
function apptsListHtml(list,max){if(!list.length)return '';max=max||8;
  return '<div class="sl-aps">'+list.slice(0,max).map(function(a){var c=App.client(a.client);return '<button type="button" class="sl-ap" data-appt="'+a.id+'"><b class="num">'+D.shortH(a.date)+' '+U.hm(a.start)+'</b><span class="ell">'+esc(c?c.n:'Без імені')+' · '+esc(App.apptTitle(a))+'</span>'+ic('right','s')+'</button>'}).join('')+(list.length>max?'<div class="mute" style="font-size:12.5px;padding:4px 0">… ще '+(list.length-max)+'</div>':'')+'</div>'}
function bindAppts(el){el.addEventListener('click',function(e){var b=e.target.closest('[data-appt]');if(b){UI.closeAll();App.openAppt(b.dataset.appt)}})}
/* записи, що опиняться поза новим графіком */
function outsideAppts(stId,date,val){return App.apptsOn(date,stId).filter(function(a){if(!(a.status==='new'||a.status==='confirmed'||a.status==='arrived'))return false;if(!val)return true;var e=App.apptEnd(a);if(a.start<val[0]||e>val[1])return true;if(val[2]&&a.start<val[2][1]&&e>val[2][0])return true;return false})}
function sameAsTpl(stId,date,val){var s=App.staff(stId);var w=s.week&&s.week[D.wd1(date)],b=s.brk&&s.brk[D.wd1(date)];
  if(!val)return !w;if(!w)return false;return w[0]===val[0]&&w[1]===val[1]&&JSON.stringify(b||null)===JSON.stringify(val[2]||null)}
function timeFields(w,pfx){w=w||{start:600,end:1140,brk:null};pfx=pfx||'';
  return '<div class="grid2 m1">'+fld('Початок','<input type="time" class="inp" name="'+pfx+'s" value="'+tv(w.start)+'" step="900">')+fld('Кінець','<input type="time" class="inp" name="'+pfx+'e" value="'+tv(w.end)+'" step="900">')+'</div>'+
   '<label class="check"><input type="checkbox" name="'+pfx+'hb"'+(w.brk?' checked':'')+'> Перерва</label><div class="grid2 m1" data-brk'+(w.brk?'':' hidden')+'>'+fld('З','<input type="time" class="inp" name="'+pfx+'bs" value="'+tv(w.brk?w.brk[0]:780)+'" step="900">')+fld('До','<input type="time" class="inp" name="'+pfx+'be" value="'+tv(w.brk?w.brk[1]:840)+'" step="900">')+'</div>'}
function readTimes(el,pfx){pfx=pfx||'';var s=U.pm(gv(el,pfx+'s')||'0:00'),e=U.pm(gv(el,pfx+'e')||'0:00');if(!(e>s))return {err:'Кінець має бути пізніше за початок'};
  var v=[s,e,null];if(gc(el,pfx+'hb')){var bs=U.pm(gv(el,pfx+'bs')||'0:00'),be=U.pm(gv(el,pfx+'be')||'0:00');if(!(be>bs)||bs<s||be>e)return {err:'Перерва має бути в межах зміни'};v[2]=[bs,be]}return {v:v}}

/* редагування одного дня */
function dayModal(stId,dates){
  var s=App.staff(stId),date=dates[0],c=cellState(stId,date),to=c.k==='to';
  var wh=c.k==='on'?c.w:null,mode=c.k==='on'?'on':'off';
  var tplTxt=(function(){var w=s.week&&s.week[D.wd1(date)];return w?hrs(w[0],w[1]):'вихідний'})();
  var ap=App.apptsOn(date,stId).filter(App.active);
  UI.modal({title:s.short+' · '+D.human(date,{wd:true}),sub:to?KIND[c.kind]+' (керується у відпустках)':'Шаблон: '+tplTxt+(c.custom?' · змінено вручну':''),size:'narrow',
   body:(to?'<div class="note warn">'+ic('info')+'<span>У цей день — <b>'+KIND[c.kind].toLowerCase()+'</b> ('+D.shortH(c.to.from)+' – '+D.shortH(c.to.to)+'). Змініть або скасуйте її внизу, щоб редагувати години.</span></div>':
    '<div class="seg sl-seg3" role="group"><button data-a="m" data-k="on" aria-pressed="'+(mode==='on')+'">Працює</button><button data-a="m" data-k="off" aria-pressed="'+(mode==='off')+'">Вихідний</button><button data-a="m" data-k="tpl" aria-pressed="false">За шаблоном</button></div>'+
    '<div data-hrs class="col-f g12" style="margin-top:14px"'+(mode==='on'?'':' hidden')+'>'+timeFields(wh||(s.week&&s.week[D.wd1(date)]?{start:s.week[D.wd1(date)][0],end:s.week[D.wd1(date)][1],brk:s.brk&&s.brk[D.wd1(date)]}:null))+'</div>')+
    '<div data-warn style="margin-top:12px"></div>'+(ap.length?'<div class="lab-s" style="margin:14px 0 6px">Записи в цей день ('+ap.length+')</div>'+apptsListHtml(ap,6):''),
   foot:to?'<span class="sp"></span><button class="btn" data-x2>Закрити</button><button class="btn" data-to>Відкрити відпустку</button>':modalFoot('','Зберегти'),
   onMount:function(el,cl){bindAppts(el);el.querySelector('[data-x2]').onclick=cl;
     if(to){el.querySelector('[data-to]').onclick=function(){cl();timeoffModal(c.to.id)};return}
     var hrsBox=el.querySelector('[data-hrs]');
     function warn(){var val=cur();var w=el.querySelector('[data-warn]');
       if(val&&val.err){w.innerHTML='<div class="note dng">'+ic('alert')+'<span>'+val.err+'</span></div>';return}
       var out=val==='tpl'?[]:outsideAppts(stId,date,val===null?null:val);
       w.innerHTML=out.length?'<div class="note warn">'+ic('alert')+'<span><b>'+out.length+' '+U.plural(out.length,'запис потрапляє','записи потрапляють','записів потрапляє')+' поза графіком.</b> Їх треба перенести або скасувати.</span></div>':''}
     var mmode=mode;
     function cur(){if(mmode==='off')return null;if(mmode==='tpl')return 'tpl';var r=readTimes(el);return r.err?{err:r.err}:r.v}
     act(el,{m:function(t){mmode=t.dataset.k;$$('[data-a=m]',el).forEach(function(b){b.setAttribute('aria-pressed',b===t)});hrsBox.hidden=mmode!=='on';warn()}});
     el.addEventListener('change',function(e){if(e.target.name==='hb')el.querySelector('[data-brk]').hidden=!e.target.checked;warn()});warn();
     el.querySelector('[data-ok]').onclick=function(){var val=cur();if(val&&val.err)return UI.toast(val.err,{type:'err'});
       var prev=App.db.sched[stId]&&App.db.sched[stId][date];var had=prev!==undefined;
       if(val==='tpl')O.setShift(stId,date,undefined,'Графік '+s.short+', '+D.shortH(date)+': за шаблоном');
       else if(sameAsTpl(stId,date,val))O.setShift(stId,date,undefined);
       else O.setShift(stId,date,val);
       cl();UI.toast('Графік дня збережено',{undo:function(){O.setShift(stId,date,had?prev:undefined,'Скасовано зміну графіка');App.refresh()}});App.refresh()}}})
}

/* масова зміна вибраних днів */
function bulkShift(cells,done){
  if(!cells.length)return;var staffIds=Array.from(new Set(cells.map(function(c){return c.staff})));
  var dates=Array.from(new Set(cells.map(function(c){return c.date}))).sort();
  UI.modal({title:'Змінити '+cells.length+' '+U.plural(cells.length,'день','дні','днів'),sub:staffIds.length+' '+U.plural(staffIds.length,'майстер','майстри','майстрів')+' · '+D.shortH(dates[0])+(dates.length>1?' – '+D.shortH(dates[dates.length-1]):''),size:'wide',
   body:'<div class="col-f g12">'+fld('Що зробити',sel('how',[['hours','Задати години роботи'],['off','Зробити вихідними'],['tpl','Повернути за шаблоном'],['pat','Застосувати чергування (2/2, 5/2…)']],'hours'))+
    '<div data-hours class="col-f g12">'+timeFields(null)+'</div>'+
    '<div data-pat hidden class="col-f g12"><div class="chips">'+[['2/2',2,2],['3/3',3,3],['1/2',1,2],['5/2',5,2],['6/1',6,1]].map(function(p,i){return '<button type="button" class="chip" data-a="pp" data-w="'+p[1]+'" data-o="'+p[2]+'" aria-pressed="'+(i===0)+'">'+p[0]+'</button>'}).join('')+'</div>'+
     '<div class="grid2 m1">'+fld('Робочих днів підряд','<input class="inp" name="pw" inputmode="numeric" value="2">')+fld('Вихідних підряд','<input class="inp" name="po" inputmode="numeric" value="2">')+'</div>'+
     '<p class="mute" style="margin:0;font-size:13px">Чергування рахується окремо для кожного майстра від його першого вибраного дня. Години — з полів вище.</p></div>'+
    '<div data-warn></div></div>',
   foot:modalFoot('','Застосувати'),
   onMount:function(el,cl){el.querySelector('[data-x2]').onclick=cl;var how=function(){return gv(el,'how')};
     function plan(){var h=how(),out=[];var t=readTimes(el);
       if(h==='hours'||h==='pat'){if(t.err)return {err:t.err}}
       staffIds.forEach(function(sid){var ds=cells.filter(function(c){return c.staff===sid}).map(function(c){return c.date}).sort();
         ds.forEach(function(d,i){var val;
           if(h==='hours')val=t.v;else if(h==='off')val=null;else if(h==='tpl')val=undefined;
           else{var w=Math.max(1,Math.round(num(gv(el,'pw'),2))),o=Math.max(0,Math.round(num(gv(el,'po'),2))),k=D.diff(ds[0],d)%(w+o);val=k<w?t.v:null}
           if(App.timeOff(sid,d))return;out.push({staff:sid,date:d,val:(val!==undefined&&sameAsTpl(sid,d,val))?undefined:val})})});
       return {list:out}}
     function warn(){var h=how();el.querySelector('[data-hours]').hidden=!(h==='hours'||h==='pat');el.querySelector('[data-pat]').hidden=h!=='pat';
       var p=plan();var w=el.querySelector('[data-warn]');if(p.err){w.innerHTML='<div class="note dng">'+ic('alert')+'<span>'+p.err+'</span></div>';return}
       var bad=[];p.list.forEach(function(x){outsideAppts(x.staff,x.date,x.val===undefined?(function(){var s=App.staff(x.staff),wk=s.week&&s.week[D.wd1(x.date)];return wk?[wk[0],wk[1],s.brk&&s.brk[D.wd1(x.date)]]:null})():x.val).forEach(function(a){bad.push(a)})});
       var skipped=cells.length-p.list.length;
       w.innerHTML=(skipped?'<div class="note">'+ic('info')+'<span>'+skipped+' '+U.plural(skipped,'день пропущено','дні пропущено','днів пропущено')+' — у ці дні відпустка чи лікарняний.</span></div>':'')+(bad.length?'<div class="note warn" style="margin-top:8px">'+ic('alert')+'<span style="flex:1"><b>'+bad.length+' '+U.plural(bad.length,'запис потрапляє','записи потрапляють','записів потрапляє')+' поза графіком:</b>'+apptsListHtml(bad,5)+'</span></div>':'')}
     bindAppts(el);el.addEventListener('change',function(e){if(e.target.name==='hb')el.querySelector('[data-brk]').hidden=!e.target.checked;warn()});el.addEventListener('input',function(e){if(e.target.name==='pw'||e.target.name==='po')warn()});warn();
     act(el,{pp:function(t){$$('[data-a=pp]',el).forEach(function(b){b.setAttribute('aria-pressed',b===t)});g(el,'pw').value=t.dataset.w;g(el,'po').value=t.dataset.o;warn()}});
     el.querySelector('[data-ok]').onclick=function(){var p=plan();if(p.err)return UI.toast(p.err,{type:'err'});if(!p.list.length)return UI.toast('Нічого змінювати',{type:'err'});
       var prev=p.list.map(function(x){var o=App.db.sched[x.staff]&&App.db.sched[x.staff][x.date];return {staff:x.staff,date:x.date,val:o}});
       O.setShifts(p.list,'Масова зміна графіка: '+p.list.length+' '+U.plural(p.list.length,'день','дні','днів'));cl();UI.toast('Графік оновлено: '+p.list.length+' '+U.plural(p.list.length,'день','дні','днів'),{undo:function(){O.setShifts(prev,'Скасовано масову зміну графіка');App.refresh()}});done&&done()}}})
}

/* копіювати тиждень */
function copyWeekModal(from){
  var T=App.today(),masters=App.masters(),w0=D.weekStart(from||T);
  UI.modal({title:'Копіювати тиждень',sub:'Скопіюйте години конкретного тижня на наступні',size:'narrow',
   body:'<div class="col-f g12">'+fld('Звідки (тиждень)','<input type="date" class="inp" name="src" value="'+w0+'">',D.human(w0)+' – '+D.human(D.add(w0,6)))+
    fld('Майстер',sel('who',[['all','Усі майстри']].concat(masters.map(function(s){return [s.id,s.n]})),'all'))+
    fld('На скільки тижнів вперед',sel('n',[1,2,3,4,6,8].map(function(n){return [n,n+' '+U.plural(n,'тиждень','тижні','тижнів')]}),2))+
    '<div data-pv class="mute" style="font-size:13px"></div></div>',foot:modalFoot('','Копіювати'),
   onMount:function(el,cl){el.querySelector('[data-x2]').onclick=cl;
     function plan(){var src=D.weekStart(gv(el,'src')||w0),n=+gv(el,'n'),who=gv(el,'who'),out=[];var ms=who==='all'?masters:masters.filter(function(s){return s.id===who});
       ms.forEach(function(s){for(var k=1;k<=n;k++)for(var i=0;i<7;i++){var sd=D.add(src,i),td=D.add(src,k*7+i);if(App.timeOff(s.id,td))continue;var c=cellState(s.id,sd);var val=c.k==='on'?[c.w.start,c.w.end,c.w.brk||null]:null;
         if(c.k==='to')val=undefined;out.push({staff:s.id,date:td,val:val===undefined?undefined:(sameAsTpl(s.id,td,val)?undefined:val)})}});return {src:src,list:out,n:n,ms:ms}}
     function pv(){var p=plan();el.querySelector('[data-pv]').textContent='Буде змінено до '+p.list.length+' днів ('+p.ms.length+' '+U.plural(p.ms.length,'майстер','майстри','майстрів')+' × '+p.n+' '+U.plural(p.n,'тиждень','тижні','тижнів')+'). Відпустки не чіпаємо.'}
     el.addEventListener('change',pv);pv();
     el.querySelector('[data-ok]').onclick=function(){var p=plan();var prev=p.list.map(function(x){return {staff:x.staff,date:x.date,val:App.db.sched[x.staff]&&App.db.sched[x.staff][x.date]}});
       O.setShifts(p.list,'Скопійовано тиждень '+D.shortH(p.src)+' на '+p.n+' '+U.plural(p.n,'тиждень','тижні','тижнів'));
       p.ms.forEach(function(s){var u=D.add(p.src,(p.n+1)*7-1);if((s.schedUntil||'')<u)O.upsert('staff',{id:s.id,schedUntil:u},'Горизонт графіка')});
       cl();UI.toast('Тиждень скопійовано',{undo:function(){O.setShifts(prev,'Скасовано копіювання тижня');App.refresh()}});App.refresh()}}})
}

/* відпустки / лікарняні */
function timeoffModal(id,def){
  var t=id?App.db.timeoff.find(function(x){return x.id===id}):null,T=App.today();
  var o=t||Object.assign({staff:(App.masters()[0]||{}).id,kind:'vacation',from:T,to:D.add(T,6),note:''},def||{});
  if(!o.staff||!App.staff(o.staff))o.staff=(App.masters()[0]||{}).id;
  UI.modal({title:t?'Редагувати':'Відпустка / лікарняний',size:'narrow',
   body:'<div class="col-f g12">'+fld('Майстер',sel('staff',App.masters(true).map(function(s){return [s.id,s.n]}),o.staff))+
    '<div class="chips" role="group">'+Object.keys(KIND).map(function(k){return '<button type="button" class="chip" data-a="kind" data-k="'+k+'" aria-pressed="'+(o.kind===k)+'">'+KIND[k]+'</button>'}).join('')+'</div>'+
    '<div class="grid2 m1">'+fld('З','<input type="date" class="inp" name="from" value="'+o.from+'">')+fld('По','<input type="date" class="inp" name="to" value="'+o.to+'">')+'</div>'+
    fld('Примітка','<input class="inp" name="note" value="'+esc(o.note&&o.note!==KIND[o.kind]?o.note:'')+'" placeholder="Напр. навчання, сімейні обставини" maxlength="80">')+'<div data-warn></div></div>',
   foot:(t?'<button class="btn dng" data-del>'+ic('trash','s')+'</button>':'')+modalFoot('','Зберегти'),
   onMount:function(el,cl){var kind=o.kind;el.querySelector('[data-x2]').onclick=cl;
     function warn(){var f=gv(el,'from'),tt=gv(el,'to'),w=el.querySelector('[data-warn]');if(!f||!tt||tt<f){w.innerHTML='';return}
       var ap=apptsInRange(gv(el,'staff'),f,tt);
       var ov=App.db.timeoff.filter(function(x){return x.id!==(t&&t.id)&&x.staff===gv(el,'staff')&&x.from<=tt&&x.to>=f});
       w.innerHTML=(ov.length?'<div class="note warn" style="margin-bottom:8px">'+ic('alert')+'<span>Перетинається з: '+ov.map(function(x){return KIND[x.kind].toLowerCase()+' '+D.shortH(x.from)+'–'+D.shortH(x.to)}).join(', ')+'</span></div>':'')+
        (ap.length?'<div class="note warn">'+ic('alert')+'<span style="flex:1"><b>У цей період '+ap.length+' '+U.plural(ap.length,'запис','записи','записів')+'.</b> Їх треба перенести або скасувати:'+apptsListHtml(ap,6)+'</span></div>':'')}
     bindAppts(el);el.addEventListener('change',warn);act(el,{kind:function(b){kind=b.dataset.k;$$('[data-a=kind]',el).forEach(function(x){x.setAttribute('aria-pressed',x===b)})}});warn();
     var dl=el.querySelector('[data-del]');if(dl)dl.onclick=function(){cl();delTimeoff(t.id)};
     el.querySelector('[data-ok]').onclick=function(){var f=gv(el,'from'),tt=gv(el,'to');if(!f||!tt)return UI.toast('Вкажіть дати',{type:'err'});if(tt<f)return UI.toast('Дата «по» раніше за «з»',{type:'err'});
       var obj={staff:gv(el,'staff'),kind:kind,from:f,to:tt,note:gv(el,'note').trim()||KIND[kind]};if(t)obj.id=t.id;
       var s=App.staff(obj.staff);O.upsert('timeoff',obj,(t?'Змінено: ':'Додано: ')+KIND[kind].toLowerCase()+' '+s.short+', '+D.shortH(f)+'–'+D.shortH(tt));
       var n=apptsInRange(obj.staff,f,tt).length;cl();UI.toast(KIND[kind]+' збережено'+(n?'. Є записи, які треба перенести: '+n:''),n?{type:'ok',ms:4500}:undefined);App.refresh()}}})
}
function delTimeoff(id){var t=App.db.timeoff.find(function(x){return x.id===id});if(!t)return;var s=App.staff(t.staff);
  UI.confirm({title:'Скасувати '+KIND[t.kind].toLowerCase()+'?',text:esc(s?s.short:'')+', '+D.shortH(t.from)+' – '+D.shortH(t.to)+'. Майстер знову працюватиме за графіком.',ok:'Скасувати',danger:true}).then(function(y){if(!y)return;var c=clone(t);O.remove('timeoff',id,'Скасовано '+KIND[t.kind].toLowerCase()+' '+(s?s.short:''));UI.toast('Скасовано',{undo:function(){App.db.timeoff.push(c);App.log('create','timeoff:'+c.id,'Відновлено');App.save();App.refresh()}});App.refresh()})}

/* запит майстра */
function reqModal(stId,date){
  var T=App.today();date=date||D.add(T,1);var s=App.staff(stId);
  UI.modal({title:'Запит на зміну графіка',sub:'Власник отримає задачу й підтвердить',size:'narrow',
   body:'<div class="col-f g12">'+fld('День','<input type="date" class="inp" name="d" value="'+date+'" min="'+T+'">')+fld('Що потрібно',sel('k',[['off','Вихідний у цей день'],['hours','Змінити години роботи']],'off'))+fld('Коментар','<textarea class="ta" name="note" rows="2" placeholder="Причина, бажані години"></textarea>')+'</div>',foot:modalFoot('','Надіслати запит'),
   onMount:function(el,cl){el.querySelector('[data-x2]').onclick=cl;el.querySelector('[data-ok]').onclick=function(){var d=gv(el,'d');if(!d||d<T)return UI.toast('Оберіть майбутню дату',{type:'err'});
     O.requestShift({staff:stId,date:d,kind:gv(el,'k'),note:gv(el,'note').trim()});cl();UI.toast('Запит надіслано власнику')}}})
}

App.route('team',{title:'Команда',icon:'team',nav:true,group:'salon',order:21,perm:'team.view',render:renderTeam});
App.route('schedules',{title:'Графіки',icon:'grid',nav:true,group:'salon',order:22,perm:'schedules.view',permAlt:'schedules.own',render:renderSchedules});

/* ═════════════════════════ ТОВАРИ / СКЛАД ═════════════════════════ */
var WOFF=[['use','Використано в послугах'],['defect','Брак / пошкоджено'],['expired','Прострочено'],['lost','Втрата'],['other','Інше']];
function prodCats(){var seen={},out=[];App.db.cats.forEach(function(c){seen[c.id]=1;out.push([c.id,c.n])});App.db.products.forEach(function(p){if(p.cat&&!seen[p.cat]){seen[p.cat]=1;out.push([p.cat,p.cat])}});if(!seen.other)out.push(['other','Інше']);return out}
function pcat(id){var c=prodCats().find(function(x){return x[0]===id});return c?c[1]:'Без категорії'}
function low(p){return p.stock<=p.min}
function margin(p){return p.price>0?Math.round((p.price-p.cost)*100/p.price):0}
function canSell(){return App.can('products.sell')||App.can('products.*')}
function canManage(){return mgr()||App.can('products.*')}
function prodSel(name,cur,filter){var l=App.db.products.filter(function(p){return p.hidden!==true&&(!filter||filter(p))});return sel(name,l.map(function(p){return [p.id,p.n+' · '+p.stock+' шт']}),cur||(l[0]&&l[0].id))}

function prodRow(p){var l=low(p);
  return '<tr data-id="'+p.id+'"'+(p.hidden?' class="is-off"':'')+'><td data-l="Товар"><div class="sl-pn"><b class="ell">'+esc(p.n)+'</b><small class="mute">'+esc(p.sku||'')+(p.sell===false?' · не для продажу':'')+(p.hidden?' · в архіві':'')+'</small></div></td>'+
   '<td data-l="Категорія" class="mute">'+esc(pcat(p.cat))+'</td><td data-l="Ціна" class="r num">'+U.uah(p.price)+'</td><td data-l="Собівартість" class="r num mute">'+U.uah(p.cost)+'</td>'+
   '<td data-l="Маржа" class="r num">'+margin(p)+'%</td>'+
   '<td data-l="Залишок" class="r"><span class="sl-stock'+(l?' low':'')+'"><b class="num">'+p.stock+'</b>'+(l?'<span class="badge '+(p.stock<=0?'dng':'warn')+'">'+(p.stock<=0?'Немає':'Мало')+'</span>':'')+'<small class="mute">мін. '+p.min+'</small></span></td>'+
   '<td class="r sl-act"><button class="icobtn ghost" data-a="pmenu" data-id="'+p.id+'" aria-label="Дії">'+ic('morev')+'</button></td></tr>'}

function renderProducts(v,params,q){
  var db=App.db,tab=['cat','moves','inv'].indexOf(q.tab)>=0?q.tab:'cat';
  var prods=db.products,act_=prods.filter(function(p){return !p.hidden});
  var lowN=act_.filter(low).length,cost=U.sum(act_,function(p){return Math.max(0,p.stock)*p.cost}),retail=U.sum(act_,function(p){return Math.max(0,p.stock)*p.price});
  var h='<div class="kpis sl-kpis"><div class="kpi"><div class="l">Позицій</div><div class="v num">'+act_.length+'</div></div><div class="kpi"><div class="l">Склад за собівартістю</div><div class="v num">'+U.uah(cost)+'</div></div><div class="kpi"><div class="l">У роздрібі</div><div class="v num">'+U.uah(retail)+'</div></div><div class="kpi"><div class="l">Закінчується</div><div class="v num'+(lowN?' warn-t':'')+'">'+lowN+'</div><div class="d">залишок ≤ мінімуму</div></div></div>';
  h+='<div class="tabs" style="margin-top:16px">'+[['cat','Каталог'],['moves','Рух товару'],['inv','Інвентаризація']].map(function(t){return '<button data-a="tab" data-k="'+t[0]+'" aria-selected="'+(t[0]===tab)+'">'+t[1]+'</button>'}).join('')+'</div>';
  if(tab==='cat'){
    var t=(q.q||'').toLowerCase(),list=prods.filter(function(p){if(q.arch?!p.hidden:p.hidden)return false;if(q.cat&&p.cat!==q.cat)return false;if(q.low&&!low(p))return false;if(t&&(p.n+' '+(p.sku||'')).toLowerCase().indexOf(t)<0)return false;return true});
    h+='<div class="sl-bar"><div class="inp-ic sl-q">'+ic('search')+'<input class="inp" data-q placeholder="Назва або артикул" value="'+esc(q.q||'')+'" aria-label="Пошук"></div><span class="sp"></span><button class="chip" data-a="low" aria-pressed="'+!!q.low+'">Закінчується'+(lowN?' <span class="cnt">'+lowN+'</span>':'')+'</button><button class="chip" data-a="arch" aria-pressed="'+!!q.arch+'">Архів</button></div>';
    h+='<div class="chips sl-cats"><button class="chip" data-a="cat" data-k="" aria-pressed="'+!q.cat+'">Всі</button>'+prodCats().filter(function(c){return prods.some(function(p){return p.cat===c[0]})}).map(function(c){return '<button class="chip" data-a="cat" data-k="'+c[0]+'" aria-pressed="'+(q.cat===c[0])+'">'+esc(c[1])+'</button>'}).join('')+'</div>';
    h+=list.length?'<div class="tbl-wrap cards sl-pt"><table class="tbl"><thead><tr><th>Товар</th><th>Категорія</th><th class="r">Ціна</th><th class="r">Собівартість</th><th class="r">Маржа</th><th class="r">Залишок</th><th></th></tr></thead><tbody>'+list.map(prodRow).join('')+'</tbody></table></div>':
      UI.empty('box',prods.length?'Нічого не знайдено':'Каталог порожній',prods.length?'Змініть пошук або фільтри.':'Додайте товари, які продаєте клієнтам або використовуєте в роботі.',canManage()&&!prods.length?'<button class="btn pri" data-a="new">Додати товар</button>':'');
  }
  if(tab==='moves'){
    var mv=db.stockMoves.slice().reverse().filter(function(m){return (!q.p||m.product===q.p)&&(!q.r||m.reason===q.r)});
    var lim=+q.n||60;
    h+='<div class="sl-bar"><div style="min-width:200px;flex:1;max-width:320px">'+sel('mp',[['','Усі товари']].concat(prods.map(function(p){return [p.id,p.n]})),q.p||'','data-c="mp"')+'</div><div style="min-width:180px">'+sel('mr',[['','Усі причини']].concat(Object.keys(MREASON).map(function(k){return [k,MREASON[k]]})),q.r||'','data-c="mr"')+'</div><span class="sp"></span><span class="mute">'+mv.length+' '+U.plural(mv.length,'рух','рухи','рухів')+'</span></div>';
    h+=mv.length?'<div class="list sl-mv">'+mv.slice(0,lim).map(function(m){var p=prods.find(function(x){return x.id===m.product}),by=m.by&&App.staff(m.by);
      return '<div class="li"><span class="sl-mq num '+(m.qty>0?'in':'out')+'">'+(m.qty>0?'+':'−')+Math.abs(m.qty)+'</span><span class="t"><b class="ell">'+esc(p?p.n:m.product)+'</b><small>'+(MREASON[m.reason]||m.reason)+(m.note?' · '+esc(m.note):'')+(m.appt?' · до візиту':'')+(by?' · '+esc(by.short):'')+'</small></span><span class="mute sl-mdt">'+D.shortH(m.date)+'</span></div>'}).join('')+'</div>'+(mv.length>lim?'<div style="text-align:center;margin-top:12px"><button class="btn" data-a="more">Показати ще</button></div>':''):UI.empty('log','Рухів немає','Надходження, продажі й списання зʼявляться тут.');
  }
  if(tab==='inv'){
    var il=act_.slice().sort(function(a,b){return pcat(a.cat)<pcat(b.cat)?-1:1});
    h+='<div class="note" style="margin-bottom:12px">'+ic('info')+'<span>Порахуйте залишки на полицях і впишіть фактичну кількість. Розбіжності застосуються як рухи «Інвентаризація» — історія збережеться. Порожнє поле = без змін.</span></div>'+
     '<div class="tbl-wrap cards sl-pt"><table class="tbl"><thead><tr><th>Товар</th><th class="r">В обліку</th><th class="r">Фактично</th><th class="r">Різниця</th></tr></thead><tbody>'+il.map(function(p){return '<tr data-id="'+p.id+'"><td data-l="Товар"><div class="sl-pn"><b class="ell">'+esc(p.n)+'</b><small class="mute">'+esc(pcat(p.cat))+'</small></div></td><td data-l="В обліку" class="r num">'+p.stock+'</td><td data-l="Фактично" class="r"><input class="inp sl-inv" inputmode="numeric" data-inv="'+p.id+'" placeholder="'+p.stock+'" aria-label="Фактична кількість: '+esc(p.n)+'"></td><td data-l="Різниця" class="r num" data-diff>—</td></tr>'}).join('')+'</tbody></table></div>'+
     '<div class="row" style="margin-top:14px"><span class="mute" data-isum></span><span class="sp"></span><button class="btn" data-a="inv-clear">Очистити</button><button class="btn pri" data-a="inv-apply" disabled>Застосувати</button></div>';
  }
  var pg=page(v,'sl-products',h);
  App.setTop((canManage()?'<button class="icobtn m-only" data-act="sl-prod-more" aria-label="Ще дії">'+ic('morev')+'</button>':'')+(canManage()?'<button class="btn d-only" data-act="sl-receive">'+ic('down','s')+'<span class="sl-lbl">Надходження</span></button><button class="btn" data-act="sl-writeoff">'+ic('minus','s')+'<span class="sl-lbl">Списання</span></button>':'')+(canSell()?'<button class="btn pri" data-act="sl-sell">'+ic('receipt','s')+'<span class="sl-lbl">Продаж</span></button>':'')+(canManage()?'<button class="btn d-only" data-act="sl-prod-new" aria-label="Новий товар">'+ic('plus','s')+'<span class="sl-lbl">Товар</span></button>':''));
  var qi=$('[data-q]',pg);if(qi)qi.oninput=U.debounce(function(){qset({q:qi.value||null});var pos=qi.selectionStart;renderProducts(v,params,App.parse().q);var n=$('[data-q]',v);n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}},180);
  chg(pg,{mp:function(t){App.setQ({p:t.value||null},true)},mr:function(t){App.setQ({r:t.value||null},true)}});
  act(pg,{tab:function(t){App.setQ({tab:t.dataset.k==='cat'?null:t.dataset.k,q:null,cat:null,low:null,arch:null,p:null,r:null,n:null},true)},
    cat:function(t){App.setQ({cat:t.dataset.k||null},true)},low:function(){App.setQ({low:q.low?null:'1'},true)},arch:function(){App.setQ({arch:q.arch?null:'1'},true)},more:function(){App.setQ({n:(+q.n||60)+60},true)},
    'new':function(){productForm()},
    pmenu:function(t){var p=db.products.find(function(x){return x.id===t.dataset.id});if(!p)return;var mg=canManage();
      UI.menu(t,[canSell()&&p.sell!==false&&!p.hidden?{t:'Продати',ic:'receipt',fn:function(){sellProduct({product:p.id})}}:null,mg?{t:'Надходження',ic:'down',fn:function(){receiveModal(p.id)}}:null,mg?{t:'Списання',ic:'minus',fn:function(){writeoffModal(p.id)}}:null,mg?{t:'Рух товару',ic:'log',fn:function(){App.setQ({tab:'moves',p:p.id})}}:null,mg?'-':null,mg?{t:'Редагувати',ic:'edit',fn:function(){productForm(p.id)}}:null,mg?{t:p.hidden?'Повернути з архіву':'В архів',ic:p.hidden?'undo':'ban',fn:function(){O.upsert('products',{id:p.id,hidden:!p.hidden},(p.hidden?'Повернено з архіву: ':'В архів: ')+p.n);UI.toast(p.hidden?'Товар повернено':'Товар в архіві');App.refresh()}}:null].filter(Boolean).filter(function(x,i,a){return !(x==='-'&&(i===0||i===a.length-1))}))}});
  pg.addEventListener('click',function(e){var r=e.target.closest('tr[data-id]');if(!r||tab!=='cat'||e.target.closest('button,a,input,select'))return;var b=r.querySelector('[data-a=pmenu]');if(b&&b.offsetParent)return;if(window.innerWidth<900)act_menu(r)});
  function act_menu(r){var p=db.products.find(function(x){return x.id===r.dataset.id});if(!p)return;var mg=canManage();UI.menu(r,[canSell()&&p.sell!==false&&!p.hidden?{t:'Продати',ic:'receipt',fn:function(){sellProduct({product:p.id})}}:null,mg?{t:'Надходження',ic:'down',fn:function(){receiveModal(p.id)}}:null,mg?{t:'Списання',ic:'minus',fn:function(){writeoffModal(p.id)}}:null,mg?{t:'Редагувати',ic:'edit',fn:function(){productForm(p.id)}}:null].filter(Boolean))}
  if(tab==='inv'){var sum=$('[data-isum]',pg),btn=$('[data-a=inv-apply]',pg);
    function upd(){var n=0,tot=0;$$('[data-inv]',pg).forEach(function(i){var p=db.products.find(function(x){return x.id===i.dataset.inv}),c=i.closest('tr').querySelector('[data-diff]');
      if(i.value.trim()===''){c.textContent='—';c.className='r num';return}var f=Math.round(num(i.value,NaN));if(!isFinite(f)||f<0){c.textContent='?';return}var d=f-p.stock;c.textContent=d>0?'+'+d:d<0?'−'+Math.abs(d):'0';c.className='r num '+(d>0?'ok-t':d<0?'dng-t':'mute');if(d){n++;tot+=d*p.cost}});
      sum.textContent=n?'Розбіжностей: '+n+' · вартість '+(tot<0?'−':'+')+U.uah(Math.abs(tot)):'';btn.disabled=!n;return n}
    pg.addEventListener('input',function(e){if(e.target.dataset.inv)upd()});
    act(pg,{'inv-clear':function(){$$('[data-inv]',pg).forEach(function(i){i.value=''});upd()},
      'inv-apply':function(){if(!canManage())return UI.toast('Інвентаризацію проводить власник або адміністратор',{type:'err'});var ch=[];$$('[data-inv]',pg).forEach(function(i){if(i.value.trim()==='')return;var p=db.products.find(function(x){return x.id===i.dataset.inv}),f=Math.round(num(i.value,NaN));if(isFinite(f)&&f>=0&&f!==p.stock)ch.push({p:p,d:f-p.stock})});
        if(!ch.length)return;UI.confirm({title:'Застосувати інвентаризацію?',text:'Буде скориговано '+ch.length+' '+U.plural(ch.length,'позицію','позиції','позицій')+': '+ch.slice(0,4).map(function(c){return esc(c.p.n)+' '+(c.d>0?'+':'−')+Math.abs(c.d)}).join(', ')+(ch.length>4?'…':'')+'.',ok:'Застосувати'}).then(function(y){if(!y)return;
          ch.forEach(function(c){O.stockEx(c.p.id,c.d,'inv',{note:'Інвентаризація '+D.shortH(App.today())})});UI.toast('Залишки скориговано: '+ch.length);App.refresh()})}})}
}
App.actions['sl-receive']=function(){receiveModal()};App.actions['sl-prod-more']=function(e){UI.menu(e.target.closest('[data-act]'),[{t:'Надходження',ic:'down',fn:function(){receiveModal()}},{t:'Списання',ic:'minus',fn:function(){writeoffModal()}},'-',{t:'Новий товар',ic:'plus',fn:function(){App.actions['sl-prod-new']()}}])};App.actions['sl-writeoff']=function(){writeoffModal()};App.actions['sl-sell']=function(){sellProduct()};App.actions['sl-prod-new']=function(){productForm()};

function productForm(id){var db=App.db,p=id?db.products.find(function(x){return x.id===id}):null,isNew=!p;
  if(!canManage())return UI.toast('Недостатньо прав',{type:'err'});
  var o=p||{n:'',sku:'SB'+(1001+db.products.length),cat:(prodCats()[0]||['other'])[0],price:0,cost:0,stock:0,min:2,sell:true};
  UI.modal({title:isNew?'Новий товар':'Редагувати товар',size:'wide',
   body:'<div class="col-f g12">'+fld('Назва','<input class="inp" name="n" value="'+esc(o.n)+'" maxlength="80" placeholder="Напр. Шампунь, олія для кутикули">')+
    '<div class="grid2 m1">'+fld('Артикул (SKU)','<input class="inp" name="sku" value="'+esc(o.sku||'')+'" maxlength="24">')+fld('Категорія',sel('cat',prodCats(),o.cat))+'</div>'+
    '<div class="grid2 m1">'+fld('Ціна продажу',suf('price',o.price,'₴'))+fld('Собівартість',suf('cost',o.cost,'₴'),'закупівельна ціна')+'</div>'+
    '<div class="sl-marg" data-marg></div>'+
    '<div class="grid2 m1">'+(isNew?fld('Початковий залишок','<input class="inp" name="stock" inputmode="numeric" value="0">'):fld('Залишок','<input class="inp" value="'+o.stock+' шт" disabled>','змінюється через рухи'))+fld('Мінімальний залишок','<input class="inp" name="min" inputmode="numeric" value="'+o.min+'">','нижче — попередження')+'</div>'+
    '<div class="set-row"><span class="t"><b>Продається клієнтам</b><small>Вимкніть для витратних матеріалів — вони лише списуються</small></span>'+UI.sw('sell',o.sell!==false)+'</div></div>',
   foot:modalFoot('','Зберегти'),
   onMount:function(el,cl){el.querySelector('[data-x2]').onclick=cl;
     function m(){var pr=num(gv(el,'price')),c=num(gv(el,'cost'));el.querySelector('[data-marg]').innerHTML=pr>0?'Маржа: <b>'+U.uah(pr-c)+'</b> · '+Math.round((pr-c)*100/pr)+'% <span class="mute">· націнка '+(c>0?Math.round((pr-c)*100/c)+'%':'—')+'</span>':'<span class="mute">Вкажіть ціну — покажемо маржу</span>'}
     el.addEventListener('input',m);m();
     el.querySelector('[data-ok]').onclick=function(){var n=gv(el,'n').trim();if(!n){g(el,'n').classList.add('err');g(el,'n').focus();return UI.toast('Вкажіть назву',{type:'err'})}
       var pr=Math.round(num(gv(el,'price'))),c=Math.round(num(gv(el,'cost')));if(pr<0||c<0)return UI.toast('Ціна не може бути відʼємною',{type:'err'});
       var sku=gv(el,'sku').trim();if(sku&&db.products.some(function(x){return x.id!==id&&x.sku===sku}))return UI.toast('Артикул «'+esc(sku)+'» вже використовується',{type:'err'});
       var obj={n:n,sku:sku,cat:gv(el,'cat'),price:pr,cost:c,min:Math.max(0,Math.round(num(gv(el,'min')))),sell:gc(el,'sell')};
       if(p)obj.id=p.id;else{var st=Math.max(0,Math.round(num(gv(el,'stock'))));obj.stock=0}
       var r=O.upsert('products',obj,(isNew?'Новий товар: ':'Змінено товар: ')+n);
       if(isNew&&st>0)O.stockEx(r.id,st,'init',{note:'Початковий залишок'});
       cl();UI.toast(isNew?'Товар додано':'Збережено');App.refresh()}}})
}

function receiveModal(pid){if(!canManage())return UI.toast('Надходження оформлює власник або адміністратор',{type:'err'});
  var db=App.db;if(!db.products.length)return UI.toast('Спочатку додайте товар',{type:'err'});
  UI.modal({title:'Надходження товару',sub:'Поставка від постачальника',size:'narrow',
   body:'<div class="col-f g12">'+fld('Товар',prodSel('p',pid,function(p){return !p.hidden}))+
    '<div class="grid2 m1">'+fld('Кількість','<input class="inp" name="qty" inputmode="numeric" value="1">')+fld('Ціна за одиницю',suf('unit','','₴'))+'</div>'+
    '<div class="sumrow tot" data-tot><span>Разом</span><b class="num">—</b></div>'+
    fld('Постачальник / примітка','<input class="inp" name="note" placeholder="Напр. Beauty Opt, накладна №12" maxlength="80">')+
    '<label class="check"><input type="checkbox" name="exp" checked> Записати витрату на матеріали</label>'+
    '<label class="check"><input type="checkbox" name="upc"> Оновити собівартість товару</label></div>',
   foot:modalFoot('','Прийняти'),
   onMount:function(el,cl){el.querySelector('[data-x2]').onclick=cl;
     function pre(){var p=db.products.find(function(x){return x.id===gv(el,'p')});if(p&&!num(gv(el,'unit')))g(el,'unit').placeholder=String(p.cost)}
     function tot(){var p=db.products.find(function(x){return x.id===gv(el,'p')}),q=Math.round(num(gv(el,'qty'))),u=g(el,'unit').value.trim()===''?(p?p.cost:0):num(gv(el,'unit'));el.querySelector('[data-tot] b').textContent=q>0?U.uah(q*u):'—'}
     el.addEventListener('input',tot);el.addEventListener('change',function(){pre();tot()});pre();tot();
     el.querySelector('[data-ok]').onclick=function(){var p=db.products.find(function(x){return x.id===gv(el,'p')}),q=Math.round(num(gv(el,'qty')));if(!p)return;if(!(q>0)||q>100000)return UI.toast('Вкажіть кількість більше нуля',{type:'err'});
       var u=g(el,'unit').value.trim()===''?p.cost:num(gv(el,'unit'));if(u<0)return UI.toast('Ціна не може бути відʼємною',{type:'err'});
       O.stockEx(p.id,q,'in',{cost:gc(el,'exp')?Math.round(q*u):0,note:gv(el,'note').trim()});
       if(gc(el,'upc')&&u>0&&u!==p.cost)O.upsert('products',{id:p.id,cost:Math.round(u)},'Оновлено собівартість: '+p.n);
       cl();UI.toast('Прийнято: '+esc(p.n)+' ×'+q+(gc(el,'exp')?' · витрату записано':''));App.refresh()}}})
}
function writeoffModal(pid){if(!canManage())return UI.toast('Списання оформлює власник або адміністратор',{type:'err'});
  var db=App.db,l=db.products.filter(function(p){return p.stock>0&&!p.hidden});if(!l.length)return UI.toast('Немає товарів із залишком',{type:'err'});
  if(pid&&!l.some(function(p){return p.id===pid}))pid=null;
  UI.modal({title:'Списання товару',sub:'Витрата в роботі, брак чи втрата',size:'narrow',
   body:'<div class="col-f g12">'+fld('Товар',prodSel('p',pid,function(p){return p.stock>0}))+'<div class="grid2 m1">'+fld('Кількість','<input class="inp" name="qty" inputmode="numeric" value="1">')+fld('Причина',sel('r',WOFF,'use'))+'</div>'+fld('Примітка','<input class="inp" name="note" maxlength="80" placeholder="Необовʼязково">')+'<div class="mute" data-left style="font-size:13px"></div></div>',
   foot:modalFoot('','Списати'),
   onMount:function(el,cl){el.querySelector('[data-x2]').onclick=cl;function left(){var p=db.products.find(function(x){return x.id===gv(el,'p')});el.querySelector('[data-left]').textContent=p?'На складі: '+p.stock+' шт · собівартість списання '+U.uah(Math.round(num(gv(el,'qty'))*p.cost)):''}
     el.addEventListener('input',left);el.addEventListener('change',left);left();
     el.querySelector('[data-ok]').onclick=function(){var p=db.products.find(function(x){return x.id===gv(el,'p')}),q=Math.round(num(gv(el,'qty')));if(!p)return;if(!(q>0))return UI.toast('Вкажіть кількість',{type:'err'});if(q>p.stock)return UI.toast('На складі лише '+p.stock+' шт',{type:'err'});
       O.stockEx(p.id,-q,gv(el,'r'),{note:gv(el,'note').trim()});cl();UI.toast('Списано: '+esc(p.n)+' ×'+q);App.refresh()}}})
}

/* ── ПРОДАЖ ТОВАРУ (глобальна точка входу) ── */
function sellProduct(opts){opts=opts||{};
  if(!canSell())return UI.toast('Немає прав на продаж товарів',{type:'err'});
  var db=App.db;init();var prods=db.products.filter(function(p){return !p.hidden&&p.sell!==false});
  if(!prods.length)return UI.toast('Немає товарів для продажу — додайте їх у «Товари»',{type:'err'});
  var lines=[{id:opts.product&&prods.some(function(p){return p.id===opts.product})?opts.product:prods.find(function(p){return p.stock>0})?prods.find(function(p){return p.stock>0}).id:prods[0].id,qty:1}];
  var client=opts.client?(typeof opts.client==='object'?opts.client:App.client(opts.client)):null;
  var me=App.me(),masters=App.masters();
  var master=opts.staff||(me.role==='master'?me.id:'');
  UI.modal({title:'Продаж товару',size:'wide',
   body:'<div class="col-f g16"><div data-lines class="col-f g8"></div><div><button class="btn sm" data-a="addl">'+ic('plus','s')+'Ще товар</button></div>'+
     '<div class="grid2 m1">'+fld('Метод оплати',sel('m',db.pay.filter(function(x){return x.on}).map(function(x){return [x.id,x.n]}),opts.method||'card'))+fld('Майстер','<select class="sel" name="staff"><option value="">— без майстра —</option>'+masters.map(function(s){return '<option value="'+s.id+'"'+(s.id===master?' selected':'')+'>'+esc(s.n)+'</option>'}).join('')+'</select>','отримає відсоток з продажу')+'</div>'+
     '<div class="fld"><span>Клієнт <small>необовʼязково</small></span><div data-cl></div></div>'+
     '<div class="card sl-sell-sum" data-sum></div></div>',
   foot:modalFoot('','Продати'),
   onMount:function(el,cl){el.querySelector('[data-x2]').onclick=cl;
     function draw(){el.querySelector('[data-lines]').innerHTML=lines.map(function(l,i){var p=db.products.find(function(x){return x.id===l.id});
       return '<div class="sl-sl" data-i="'+i+'"><select class="sel" data-f="id" aria-label="Товар">'+prods.map(function(x){return '<option value="'+x.id+'"'+(x.id===l.id?' selected':'')+(x.stock<=0?' disabled':'')+'>'+esc(x.n)+' · '+U.uah(x.price)+' · '+x.stock+' шт</option>'}).join('')+'</select>'+
        '<div class="sl-qty"><button class="icobtn" data-a="qm" data-i="'+i+'" aria-label="Менше">'+ic('minus','s')+'</button><input class="inp" data-f="qty" inputmode="numeric" value="'+l.qty+'" aria-label="Кількість"><button class="icobtn" data-a="qp" data-i="'+i+'" aria-label="Більше">'+ic('plus','s')+'</button></div>'+
        '<b class="num sl-lt">'+U.uah(p.price*l.qty)+'</b>'+(lines.length>1?'<button class="icobtn ghost" data-a="rml" data-i="'+i+'" aria-label="Прибрати">'+ic('x','s')+'</button>':'<span></span>')+'</div>'}).join('');sum()}
     function sum(){var tot=0,err='';lines.forEach(function(l){var p=db.products.find(function(x){return x.id===l.id});tot+=p.price*l.qty;if(l.qty>p.stock)err='Недостатньо «'+p.n+'»: на складі '+p.stock+' шт'});
       var st=App.staff(gv(el,'staff')),pct=st&&st.pay&&st.pay.productPct!=null?st.pay.productPct:db.settings.payroll.productPctDefault;
       el.querySelector('[data-sum]').innerHTML='<div class="sumrow tot" style="border:0;margin:0;padding:0"><span>До сплати</span><b class="num">'+U.uah(tot)+'</b></div>'+(st?'<div class="sumrow mute" style="padding-bottom:0"><span>Відсоток майстру '+esc(st.short)+' ('+pc(pct)+')</span><span class="num">'+U.uah(Math.round(tot*pct/100))+'</span></div>':'')+(err?'<div class="note dng" style="margin-top:8px">'+ic('alert')+'<span>'+err+'</span></div>':'');el._err=err;el._tot=tot}
     function setClient(c){client=c;var b=el.querySelector('[data-cl]');if(c){b.innerHTML='<div class="li sl-cli">'+UI.av(c,'sm')+'<span class="t"><b>'+esc(c.n)+'</b><small>'+(c.ph?U.phone(c.ph):'без телефону')+'</small></span><button class="icobtn ghost" data-a="clx" aria-label="Прибрати клієнта">'+ic('x','s')+'</button></div>'}else{b.innerHTML='<button class="btn" data-a="clp">'+ic('user','s')+'Обрати клієнта</button> <span class="mute" style="font-size:13px">Без клієнта — продаж без прив\u02bcязки</span>'}}
     draw();setClient(client);
     el.addEventListener('change',function(e){var t=e.target,r=t.closest('[data-i]');if(t.name==='staff'){sum();return}if(!r||!t.dataset.f)return;var l=lines[+r.dataset.i];if(t.dataset.f==='id'){l.id=t.value;l.qty=1}else l.qty=Math.max(1,Math.min(999,Math.round(num(t.value,1))));draw()});
     act(el,{addl:function(){var used=lines.map(function(l){return l.id});var nx=prods.find(function(p){return used.indexOf(p.id)<0&&p.stock>0})||prods.find(function(p){return p.stock>0})||prods[0];lines.push({id:nx.id,qty:1});draw()},
       rml:function(t){lines.splice(+t.dataset.i,1);draw()},qm:function(t){var l=lines[+t.dataset.i];l.qty=Math.max(1,l.qty-1);draw()},qp:function(t){var l=lines[+t.dataset.i];l.qty=Math.min(999,l.qty+1);draw()},
       clx:function(){setClient(null)},
       clp:function(){var m=UI.modal({title:'Клієнт',size:'narrow',body:'<div data-pk></div>',onMount:function(e2,c2){UI.clientPicker(e2.querySelector('[data-pk]'),function(c){c2();setClient(c)})}})}});
     el.querySelector('[data-ok]').onclick=function(){sum();if(el._err)return UI.toast(el._err,{type:'err'});
       var stf=gv(el,'staff')||null,m=gv(el,'m');
       lines.forEach(function(l){O.sellProduct({id:l.id,qty:l.qty,method:m,staff:stf,client:client?client.id:null})});
       var n=U.sum(lines,function(l){return l.qty});cl();UI.toast('Продано '+n+' '+U.plural(n,'товар','товари','товарів')+' на '+U.uah(el._tot)+(client?' · '+esc(client.n):''));App.refresh()}}})
}
App.sellProduct=sellProduct;

/* ═════════════════════════ КАБІНЕТИ Й МІСЦЯ ═════════════════════════ */
function resOf(s){return Array.isArray(s.res)?s.res:(s.res?[s.res]:[])}
function hasRes(s,id){return resOf(s).indexOf(id)>=0}
function renderResources(v){
  var db=App.db,on=!!db.settings.modules.resources,list=db.resources.filter(function(r){return r.active!==false}),T=App.today(),edit=isOwner()||App.can('settings.manage');
  var h='<div class="card sl-res-intro"><div class="set-row" style="padding:0;border:0"><span class="t"><b>Кабінети й місця: '+(on?'увімкнено':'вимкнено')+'</b><small>Модуль для салонів, де майстри ділять приміщення чи обладнання: масажисти в одному кабінеті, оренда крісел (коворкінг), один апарат на кількох косметологів, манікюрні столи. При записі система не дозволить зайняти одне місце двом клієнтам одночасно.</small></span>'+UI.sw('mod',on,edit?'':'disabled')+'</div>'+
    (on?'':'<p class="mute" style="margin:12px 0 0;font-size:13px">Поки вимкнено: розділ ховається з меню, а в записі не питається місце. Налаштуйте список нижче й увімкніть — і поле «Місце» зʼявиться в календарі та в послугах.</p>')+'</div>';
  h+='<section class="sl-grp"><header class="sl-grp-h"><h3>Місця <span class="mute">'+list.length+'</span></h3><span class="sp"></span>'+(edit?'<button class="btn pri sm" data-a="new">'+ic('plus','s')+'Додати</button>':'')+'</header>';
  h+=list.length?'<div class="sl-list sl-res'+(on?'':' is-dim')+'">'+list.map(function(r){
    var svcs=db.services.filter(function(s){return hasRes(s,r.id)}),who=db.staff.filter(function(s){return s.res===r.id&&s.active!==false}),today=db.appts.filter(function(a){return a.res===r.id&&a.date===T&&App.active(a)}).length;
    return '<div class="sl-tr sl-rs" data-id="'+r.id+'"><div class="sl-nm"><span class="sl-rico">'+ic(({room:'door',chair:'user',table:'layers',device:'zap'})[r.type]||'door')+'</span><span class="t"><b class="ell">'+esc(r.n)+'</b><small class="ell mute">'+(RTYPE[r.type||'room'])+(r.cap>1?' · до '+r.cap+' клієнтів одночасно':'')+(r.note?' · '+esc(r.note):'')+'</small></span></div>'+
     '<div class="sl-c sl-rw">'+(who.length?avStack(who,3):'<span class="faint">без закріплення</span>')+'</div><div class="sl-c sl-rsv">'+(svcs.length?'<span class="tag">'+svcs.length+' '+U.plural(svcs.length,'послуга','послуги','послуг')+'</span>':'<span class="faint">усі послуги</span>')+'</div><div class="sl-c sl-rt2">'+(today?'<span class="badge acc">'+today+' '+U.plural(today,'запис','записи','записів')+' сьогодні</span>':'<span class="faint">вільно</span>')+'</div>'+
     (edit?'<span class="sl-c r"><button class="icobtn ghost" data-a="edit" data-id="'+r.id+'" aria-label="Редагувати">'+ic('edit','s')+'</button><button class="icobtn ghost" data-a="del" data-id="'+r.id+'" aria-label="Видалити">'+ic('trash','s')+'</button></span>':'<span></span>')+'</div>'}).join('')+'</div>':UI.empty('door','Місць ще немає','Додайте кабінети, крісла чи столи, щоб розподіляти записи.',edit?'<button class="btn pri" data-a="new">Додати місце</button>':'');
  h+='</section>';
  var pg=page(v,'sl-resources narrow',h);App.setTop('');
  chg(pg,{});
  var sw=$('[name=mod]',pg);if(sw)sw.addEventListener('change',function(){O.set('settings.modules.resources',sw.checked,'Модуль «Кабінети й місця»: '+(sw.checked?'увімкнено':'вимкнено'));UI.toast(sw.checked?'Модуль увімкнено':'Модуль вимкнено');App.refresh()});
  act(pg,{'new':function(){resForm()},edit:function(t){resForm(t.dataset.id)},del:function(t){var r=db.resources.find(function(x){return x.id===t.dataset.id});if(!r)return;
    var n=db.appts.filter(function(a){return a.res===r.id&&a.date>=T&&App.active(a)}).length;
    UI.confirm({title:'Видалити «'+esc(r.n)+'»?',text:(n?'<b>Увага:</b> на це місце є '+n+' '+U.plural(n,'майбутній запис','майбутні записи','майбутніх записів')+' — вони залишаться без місця. ':'')+'Привʼязки послуг і майстрів буде знято.',ok:'Видалити',danger:true}).then(function(y){if(!y)return;
      O.bulkSvc(db.services.filter(function(s){return hasRes(s,r.id)}).map(function(s){return {id:s.id,res:resOf(s).filter(function(x){return x!==r.id})}}),'Знято привʼязку до «'+r.n+'»');
      db.staff.forEach(function(s){if(s.res===r.id)s.res=null});db.appts.forEach(function(a){if(a.res===r.id&&a.date>=T)a.res=null});
      O.remove('resources',r.id,'Видалено місце: '+r.n);UI.toast('Місце видалено');App.refresh()})}});
}
function resForm(id){var db=App.db,r=id?db.resources.find(function(x){return x.id===id}):null,o=r||{n:'',type:'room',cap:1,note:''};
  var svcSel=db.services.filter(function(s){return r&&hasRes(s,r.id)}).map(function(s){return s.id});
  UI.modal({title:r?'Редагувати місце':'Нове місце',size:'wide',
   body:'<div class="col-f g12">'+fld('Назва','<input class="inp" name="n" value="'+esc(o.n)+'" maxlength="50" placeholder="Напр. Кабінет 1, Крісло A, Апарат Hydrafacial">')+
    '<div class="grid2 m1">'+fld('Тип',sel('type',Object.keys(RTYPE).map(function(k){return [k,RTYPE[k]]}),o.type||'room'))+fld('Скільки клієнтів одночасно','<input class="inp" name="cap" inputmode="numeric" value="'+(o.cap||1)+'">','1 — індивідуально; більше — для групових процедур')+'</div>'+
    fld('Примітка','<input class="inp" name="note" value="'+esc(o.note||'')+'" maxlength="80" placeholder="Напр. 2 поверх, є душ">')+
    '<div class="fld"><span>Які послуги потребують це місце <small>порожньо = будь-які</small></span><div class="chips">'+db.services.filter(function(s){return s.active!==false}).map(function(s){var other=resOf(s).length&&(!r||!hasRes(s,r.id));return '<button type="button" class="chip" data-a="sv" data-id="'+s.id+'" aria-pressed="'+(svcSel.indexOf(s.id)>=0)+'" title="'+esc(catName(s.cat))+(other?' · зараз: '+esc(resOf(s).map(resName).join(', ')):'')+'">'+esc(s.n)+'</button>'}).join('')+'</div></div></div>',
   foot:modalFoot('','Зберегти'),
   onMount:function(el,cl){el.querySelector('[data-x2]').onclick=cl;act(el,{sv:function(t){var i=svcSel.indexOf(t.dataset.id);if(i<0)svcSel.push(t.dataset.id);else svcSel.splice(i,1);t.setAttribute('aria-pressed',i<0)}});
     el.querySelector('[data-ok]').onclick=function(){var n=gv(el,'n').trim();if(!n){g(el,'n').classList.add('err');g(el,'n').focus();return UI.toast('Вкажіть назву',{type:'err'})}
       if(db.resources.some(function(x){return x.id!==id&&x.n.toLowerCase()===n.toLowerCase()}))return UI.toast('Місце з такою назвою вже є',{type:'err'});
       var cap=Math.round(num(gv(el,'cap'),1));if(cap<1||cap>50)return UI.toast('Кількість клієнтів — від 1 до 50',{type:'err'});
       var obj={n:n,type:gv(el,'type'),cap:cap,note:gv(el,'note').trim(),active:true};if(r)obj.id=r.id;
       var res=O.upsert('resources',obj,(r?'Змінено місце: ':'Нове місце: ')+n);
       var patches=[];db.services.forEach(function(s){var want=svcSel.indexOf(s.id)>=0,cur=resOf(s),has=cur.indexOf(res.id)>=0;if(want&&!has)patches.push({id:s.id,res:cur.concat(res.id)});else if(!want&&has)patches.push({id:s.id,res:cur.filter(function(x){return x!==res.id})})});
       if(patches.length)O.bulkSvc(patches,'Привʼязано послуги до «'+n+'»');
       cl();UI.toast(r?'Збережено':'Місце додано');App.refresh()}}})
}

App.route('products',{title:'Товари',icon:'box',nav:true,group:'salon',order:23,module:'products',perm:'products.view',render:renderProducts,count:function(){try{var n=App.db.products.filter(function(p){return !p.hidden&&low(p)}).length;return n||''}catch(e){return ''}},countDot:true});
App.route('resources',{title:'Кабінети й місця',icon:'door',nav:true,group:'salon',order:24,module:'resources',perm:'settings.manage',render:renderResources});

/* закрити початкову ініціалізацію даних модуля, якщо БД уже є */
try{if(App.db)init()}catch(e){}
})();
