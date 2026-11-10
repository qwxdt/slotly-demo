/* Slotly demo — HOME: «Сьогодні» (дашборд за роллю) + «Задачі». Префікс стилів: .hm-  */
(function(){
'use strict';
var U=App.u,D=App.d,UI=App.ui,esc=U.esc,ic=App.icon,NB='\u00A0';
function T(){return App.today()}
function go(id,q){if(App.routes[id])App.go(id,q);else UI.toast('Розділ ще в роботі',{type:'err'})}
function hasRoute(id){return !!App.routes[id]}
function mod(m){return App.db.settings.modules[m]!==false}
function nowStamp(){return T()+'T'+U.hm(D.nowMin()).padStart(5,'0')}
function voc(n){n=(n||'').split(' ')[0];if(/ій$/.test(n))return n.slice(0,-2)+'ію';if(/ія$/.test(n))return n.slice(0,-2)+'іє';if(/а$/.test(n))return n.slice(0,-1)+'о';if(/я$/.test(n))return n.slice(0,-1)+'є';return n}
function greet(){var h=new Date().getHours();return h<5?'Доброї ночі':h<12?'Доброго ранку':h<18?'Добрий день':'Добрий вечір'}
function cname(a){var c=App.client(a.client);return c?c.n:'Без імені'}
function stf(a){var s=App.staff(a.staff);return s?s.short:'—'}
function isMasterRole(){return App.me().role==='master'}
function plan(n,a,b,c){return n+' '+U.plural(n,a,b,c)}

/* ───────── допоміжне: хвилини/розрахунки дня ───────── */
function capacity(date){
  var cap=0;App.masters().forEach(function(s){var w=App.workHours(s.id,date);if(!w)return;cap+=w.end-w.start-(w.brk?(w.brk[1]-w.brk[0]):0)});return cap}
function booked(date,staffId){
  return U.sum(App.apptsOn(date,staffId).filter(function(a){return a.status!=='cancelled'&&a.status!=='noshow'}),App.apptDur)}
function dayRevenue(date){return App.money(date,date).revenue}
function expectedLeft(date){
  var now=D.nowMin();
  return U.sum(App.apptsOn(date).filter(function(a){return a.status==='new'||a.status==='confirmed'||(a.status==='arrived')}),function(a){return App.apptDue(a)})}

/* ───────── задачі: логіка ───────── */
var PRIO={high:'Високий',mid:'Звичайний',low:'Низький'};
function taskScope(){
  var me=App.me();
  var all=App.db.tasks.slice();
  if(me.role==='master'||!App.can('tasks.view'))return all.filter(function(t){return t.who===me.id});
  return all}
function openCount(){
  var me=App.me(),t=T();
  var as=App.db.tasks.filter(function(x){return !x.done&&x.due&&x.due<=t});
  if(me.role==='master'||!App.can('tasks.view'))as=as.filter(function(x){return x.who===me.id});
  return as.length}
function toggleTask(id){
  var t=App.db.tasks.find(function(x){return x.id===id});if(!t)return;
  var O=App.ops;
  if(t.done){O.upsert('tasks',{id:id,done:false,doneAt:null},'Задачу відновлено: '+t.t);App.refresh();return}
  O.upsert('tasks',{id:id,done:true,doneAt:nowStamp()},'Задачу виконано: '+t.t);
  var nid=null;
  if(t.rec){var base=t.due&&t.due>T()?t.due:T();var nd=D.add(base,t.rec==='daily'?1:7);
    var n=O.upsert('tasks',{t:t.t,due:nd,who:t.who,done:false,prio:t.prio,by:t.by,client:t.client||null,rec:t.rec},'Створено повторну задачу: '+t.t);nid=n.id}
  App.refresh();
  UI.toast(nid?'Виконано · наступна на '+D.shortH(D.add(t.due&&t.due>T()?t.due:T(),t.rec==='daily'?1:7)):'Задачу виконано',{undo:function(){
    O.upsert('tasks',{id:id,done:false,doneAt:null},'Скасовано виконання: '+t.t);if(nid)O.remove('tasks',nid,'Видалено повторну задачу');App.refresh()}});
}
function dueLabel(d){if(!d)return 'без терміну';var n=D.diff(T(),d);if(n===0)return 'сьогодні';if(n===1)return 'завтра';if(n===-1)return 'вчора';return D.shortH(d)}
function taskRow(t,opt){
  opt=opt||{};var who=App.staff(t.who),cl=t.client&&App.client(t.client);
  var over=!t.done&&t.due&&t.due<T();
  return '<div class="hm-task'+(t.done?' done':'')+'" data-tid="'+t.id+'">'+
   '<button class="hm-chk" data-hm="tdone" data-id="'+t.id+'" aria-label="'+(t.done?'Повернути в роботу':'Виконано')+'" aria-pressed="'+(!!t.done)+'">'+(t.done?ic('check','s'):'')+'</button>'+
   '<div class="hm-task-t"><b>'+esc(t.t)+'</b><small>'+
     '<span class="hm-prio p-'+(t.prio||'low')+'" title="Пріоритет: '+(PRIO[t.prio]||'')+'"></span>'+
     (t.due?'<span class="'+(over?'dng-t':'')+'">'+(over?'прострочено · ':'')+dueLabel(t.due)+'</span>':'<span>без терміну</span>')+
     (t.rec?'<span>'+ic('repeat','s')+' '+(t.rec==='daily'?'щодня':'щотижня')+'</span>':'')+
     (cl?'<a class="hm-lnk" data-hm="client" data-id="'+cl.id+'">'+ic('user','s')+' '+esc(U.short(cl.n))+'</a>':'')+
     (!opt.noWho&&who?'<span class="hm-who">'+UI.av(who,'xs')+' '+esc(who.short)+'</span>':'')+
   '</small></div>'+
   (opt.compact?'':'<button class="icobtn ghost sm" data-hm="tmenu" data-id="'+t.id+'" aria-label="Дії">'+ic('more')+'</button>')+
  '</div>'}

function taskForm(t){
  t=t||{};var me=App.me(),isM=me.role==='master'||!App.can('tasks.view');
  var staff=App.db.staff.filter(function(s){return s.active!==false}).filter(function(s){return !isM||s.id===me.id});
  var cid=t.client||null;
  var m=UI.modal({title:t.id?'Редагувати задачу':'Нова задача',size:'narrow',
   body:'<div class="col-f g12">'+
    '<label class="fld"><span>Що зробити</span><input class="inp" name="t" value="'+esc(t.t||'')+'" placeholder="Напр. Замовити матеріали" autocomplete="off"></label>'+
    '<div class="grid2 m1"><label class="fld"><span>Термін</span><input class="inp" type="date" name="due" value="'+esc(t.due===undefined?T():(t.due||''))+'"></label>'+
    '<label class="fld"><span>Виконавець</span><select class="sel" name="who">'+staff.map(function(s){return '<option value="'+s.id+'"'+((t.who||me.id)===s.id?' selected':'')+'>'+esc(s.short)+'</option>'}).join('')+'</select></label></div>'+
    '<div class="fld"><span>Пріоритет</span><div class="seg" data-prio>'+['low','mid','high'].map(function(p){return '<button type="button" data-p="'+p+'" aria-pressed="'+((t.prio||'mid')===p)+'">'+PRIO[p]+'</button>'}).join('')+'</div></div>'+
    '<label class="fld"><span>Повторювати</span><select class="sel" name="rec"><option value="">Не повторювати</option><option value="daily"'+(t.rec==='daily'?' selected':'')+'>Щодня</option><option value="weekly"'+(t.rec==='weekly'?' selected':'')+'>Щотижня</option></select></label>'+
    '<div class="fld"><span>Клієнт <small>необовʼязково</small></span><div data-cl></div></div>'+
   '</div>',
   foot:(t.id?'<button class="btn dng" data-del>Видалити</button>':'')+'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
   onMount:function(el,close){
     var prio=t.prio||'mid';
     el.querySelector('[data-prio]').onclick=function(e){var b=e.target.closest('[data-p]');if(!b)return;prio=b.dataset.p;U.$$('[data-p]',el).forEach(function(x){x.setAttribute('aria-pressed',x===b)})};
     var box=el.querySelector('[data-cl]');
     function showCl(){var c=cid&&App.client(cid);
       if(c){box.innerHTML='<div class="hm-clchip">'+UI.av(c,'sm')+'<b>'+esc(c.n)+'</b><button class="icobtn ghost sm" data-rm aria-label="Прибрати">'+ic('x')+'</button></div>';box.querySelector('[data-rm]').onclick=function(){cid=null;showCl()}}
       else{box.innerHTML='<button type="button" class="btn sm" data-pick>'+ic('user','s')+' Прив’язати клієнта</button>';box.querySelector('[data-pick]').onclick=function(){UI.clientPicker(box,function(c){cid=c.id;showCl()})}}}
     showCl();
     el.querySelector('[data-no]').onclick=close;
     var del=el.querySelector('[data-del]');
     if(del)del.onclick=function(){close();UI.confirm({title:'Видалити задачу?',text:esc(t.t),ok:'Видалити',danger:true}).then(function(y){if(!y)return;var copy=Object.assign({},t);App.ops.remove('tasks',t.id,'Видалено задачу: '+t.t);App.refresh();UI.toast('Задачу видалено',{undo:function(){App.db.tasks.push(copy);App.save();App.refresh()}})})};
     el.querySelector('[data-ok]').onclick=function(){
       var f=function(n){return el.querySelector('[name='+n+']')};var txt=f('t').value.trim();
       if(!txt){f('t').classList.add('err');f('t').focus();return}
       var o={t:txt,due:f('due').value||null,who:f('who').value,prio:prio,rec:f('rec').value||null,client:cid||null};
       if(t.id){o.id=t.id;App.ops.upsert('tasks',o,'Змінено задачу: '+txt)}else{o.done=false;o.by=App.db.meId;App.ops.upsert('tasks',o,'Нова задача: '+txt)}
       close();UI.toast(t.id?'Збережено':'Задачу додано');App.refresh()}}});
  return m}
App.taskForm=taskForm;

function tasksPage(v,params,q){
  var me=App.me(),T0=T();
  var manager=me.role!=='master'&&App.can('tasks.view');
  var f=manager?(q.f||'all'):'mine';
  var list=taskScope();
  if(f==='mine')list=list.filter(function(t){return t.who===me.id});
  var open=list.filter(function(t){return !t.done}),done=list.filter(function(t){return t.done});
  var byPrio={high:0,mid:1,low:2};
  function srt(a,b){return (a.due||'9999').localeCompare(b.due||'9999')||byPrio[a.prio||'low']-byPrio[b.prio||'low']}
  var over=open.filter(function(t){return t.due&&t.due<T0}).sort(srt),
      today=open.filter(function(t){return t.due===T0}).sort(srt),
      later=open.filter(function(t){return !t.due||t.due>T0}).sort(srt);
  done.sort(function(a,b){return (b.doneAt||b.due||'').localeCompare(a.doneAt||a.due||'')});
  var showDone=q.done==='1',doneShown=showDone?done:done.slice(0,5);
  function sec(title,arr,cls,extra){if(!arr.length)return '';return '<section class="hm-sec"><h3 class="'+(cls||'')+'">'+title+' <span class="pill-n">'+arr.length+'</span>'+(extra||'')+'</h3><div class="hm-tasks">'+arr.map(function(t){return taskRow(t,{noWho:f==='mine'})}).join('')+'</div></section>'}
  App.setTop('<button class="btn pri" data-act="hm-tnew">'+ic('plus')+'<span class="d-only">Нова задача</span></button>');
  var html='<div class="page narrow hm-page">'+
   '<div class="hm-addbar"><div class="inp-ic" style="flex:1">'+ic('plus')+'<input class="inp" id="hm-quick" placeholder="Нова задача… (Enter — додати на сьогодні)" autocomplete="off"></div>'+
   (manager?'<div class="seg"><button data-hm="tf" data-f="mine" aria-pressed="'+(f==='mine')+'">Мої</button><button data-hm="tf" data-f="all" aria-pressed="'+(f==='all')+'">Усі</button></div>':'')+'</div>'+
   (over.length+today.length+later.length===0?UI.empty('task','Все виконано','Додайте першу задачу — наприклад, замовити матеріали чи передзвонити клієнту.','<button class="btn pri" data-hm="tnew" style="margin-top:8px">Нова задача</button>'):
     sec('Прострочені',over,'dng-t')+sec('Сьогодні',today)+sec('Пізніше',later))+
   (done.length?'<section class="hm-sec"><h3>Виконані <span class="pill-n">'+done.length+'</span>'+(done.length>5?'<button class="btn ghost sm" data-hm="tdoneall" style="margin-left:auto">'+(showDone?'Згорнути':'Показати всі')+'</button>':'')+'</h3><div class="hm-tasks">'+doneShown.map(function(t){return taskRow(t,{noWho:f==='mine'})}).join('')+'</div></section>':'')+
  '</div>';
  v.innerHTML=html;
  var qi=v.querySelector('#hm-quick');
  qi.onkeydown=function(e){if(e.key==='Enter'&&qi.value.trim()){App.ops.upsert('tasks',{t:qi.value.trim(),due:T0,who:me.id,done:false,prio:'mid',by:me.id},'Нова задача: '+qi.value.trim());UI.toast('Задачу додано');App.refresh();setTimeout(function(){var n=U.$('#hm-quick');n&&n.focus()},30)}};
  v.onclick=function(e){hmClick(e,{f:f,showDone:showDone})};
}

/* ───────── делегування кліків (home + tasks) ───────── */
function taskMenu(btn,id){
  var t=App.db.tasks.find(function(x){return x.id===id});if(!t)return;
  UI.menu(btn,[{t:'Редагувати',ic:'edit',fn:function(){taskForm(t)}},
    {t:t.done?'Повернути в роботу':'Виконано',ic:'check',fn:function(){toggleTask(id)}},
    {t:'Перенести на завтра',ic:'right',fn:function(){App.ops.upsert('tasks',{id:id,due:D.add(T(),1)},'Перенесено задачу: '+t.t);App.refresh();UI.toast('Перенесено на завтра')}},'-',
    {t:'Видалити',ic:'trash',dng:true,fn:function(){var copy=Object.assign({},t);App.ops.remove('tasks',id,'Видалено задачу: '+t.t);App.refresh();UI.toast('Задачу видалено',{undo:function(){App.db.tasks.push(copy);App.save();App.refresh()}})}}])}
function setSt(id,st,msg){
  var a=App.appt(id);if(!a)return;var prev=a.status;
  App.ops.setStatus(id,st);App.refresh();
  UI.toast(msg,{undo:function(){App.ops.setStatus(id,prev);App.refresh()}})}
function hmClick(e,ctx){
  var b=e.target.closest('[data-hm]');
  if(b){var k=b.dataset.hm,id=b.dataset.id;e.stopPropagation();
    if(k==='confirm')return setSt(id,'confirmed','Запис підтверджено');
    if(k==='arrive')return setSt(id,'arrived','Клієнт прийшов');
    if(k==='noshow')return setSt(id,'noshow','Позначено: не прийшов(ла)');
    if(k==='pay')return App.checkout(id);
    if(k==='open')return App.openAppt(id);
    if(k==='client')return App.openClient(id);
    if(k==='confirmall'){var ids=b.dataset.ids.split(',');ids.forEach(function(i){App.ops.setStatus(i,'confirmed')});App.refresh();return UI.toast('Підтверджено: '+ids.length,{undo:function(){ids.forEach(function(i){App.ops.setStatus(i,'new')});App.refresh()}})}
    if(k==='go')return go(b.dataset.to,b.dataset.q?JSON.parse(b.dataset.q):undefined);
    if(k==='tdone')return toggleTask(id);
    if(k==='tmenu')return taskMenu(b,id);
    if(k==='tnew')return taskForm();
    if(k==='tf')return App.setQ({f:b.dataset.f==='all'?'':b.dataset.f},true);
    if(k==='tdoneall')return App.setQ({done:ctx&&ctx.showDone?'':'1'},true);
    if(k==='wait'){var w=JSON.parse(b.dataset.w);return App.newAppt({staff:w.staff,date:w.date,start:w.start,client:w.client})}
    if(k==='waitdel'){App.ops.remove('waitlist',id,'Прибрано з листа очікування');App.refresh();return UI.toast('Прибрано з листа очікування')}
    if(k==='newappt')return App.newAppt({});
    if(k==='note'){return noteEdit()}
    if(k==='call'){return}
    return}
  var r=e.target.closest('[data-open]');if(r&&!e.target.closest('a,button'))App.openAppt(r.dataset.open);
}
App.actions['hm-new']=function(){App.newAppt({})};
App.actions['hm-tnew']=function(){taskForm()};

/* ───────── ДАШБОРД: компоненти ───────── */
function kpi(l,v,d,cls){return '<div class="kpi"><div class="l">'+l+'</div><div class="v">'+v+'</div>'+(d?'<div class="d '+(cls||'')+'">'+d+'</div>':'')+'</div>'}
function apRow(a,o){
  o=o||{};var c=App.client(a.client),st=a.status,end=App.apptEnd(a),late=o.late;
  var act='';
  if(o.act!==false){
    if(st==='new')act='<button class="btn sm" data-hm="confirm" data-id="'+a.id+'">Підтвердити</button>';
    else if(st==='confirmed')act='<button class="btn sm" data-hm="arrive" data-id="'+a.id+'">Прийшов</button>';
    else if(st==='arrived'&&App.can('checkout'))act='<button class="btn sm pri" data-hm="pay" data-id="'+a.id+'">Оплата</button>';
    if(st==='confirmed'&&App.can('checkout')&&a.date===T()&&false)act+='';
  }
  var tags='';
  if(c&&c.tags.indexOf('allergy')>=0)tags+=' <span class="tag hm-tag-a">алергія</span>';
  if(c&&c.tags.indexOf('vip')>=0)tags+=' <span class="tag">VIP</span>';
  var due=App.apptDue(a);
  return '<div class="li click hm-ap st-'+st+'" data-open="'+a.id+'" tabindex="0">'+
    '<div class="hm-time"><b>'+U.hm(a.start)+'</b><small>'+U.hm(end)+'</small></div>'+
    '<div class="t"><b class="ell">'+esc(cname(a))+tags+'</b><small class="ell">'+esc(App.apptTitle(a))+' · '+esc(stf(a))+'</small></div>'+
    (st==='new'&&!o.hideBadge?'<span class="badge new d-only">Нова</span>':'')+
    (late?'<span class="badge dng">+'+late+NB+'хв</span>':'')+
    (act?'<div class="hm-acts">'+act+'</div>':'')+
  '</div>'}
function nowList(){
  var T0=T(),now=D.nowMin();
  var as=App.apptsOn(T0).filter(function(a){return a.status==='arrived'});
  var h='<div class="card flush"><div class="card-h"><b>Зараз у салоні</b><span class="pill-n">'+as.length+'</span></div>';
  if(!as.length){
    var nx=App.apptsOn(T0).filter(function(a){return (a.status==='confirmed'||a.status==='new')&&a.start>=now}).shift();
    h+='<div class="hm-none">Зараз нікого.'+(nx?' Найближчий клієнт — о '+U.hm(nx.start)+' ('+esc(cname(nx))+').':' На сьогодні більше немає записів.')+'</div>'}
  else h+=as.map(function(a){
    var since=a.arrivedAt?(function(){var m=U.pm(a.arrivedAt.slice(11,16));return Math.max(0,now-m)})():null;
    var c=App.client(a.client);
    return '<div class="li click hm-ap st-arrived" data-open="'+a.id+'" tabindex="0"><div class="hm-time"><b>'+U.hm(a.start)+'</b><small>'+U.hm(App.apptEnd(a))+'</small></div>'+
     '<div class="t"><b class="ell">'+esc(cname(a))+(c&&c.tags.indexOf('allergy')>=0?' <span class="tag hm-tag-a">алергія</span>':'')+'</b><small class="ell">'+esc(App.apptTitle(a))+' · '+esc(stf(a))+(since!=null?' · у салоні '+U.dur(since):'')+'</small></div>'+
     '<div class="hm-acts">'+(App.can('checkout')?'<button class="btn sm pri" data-hm="pay" data-id="'+a.id+'">Оплата</button>':'')+'</div></div>'}).join('');
  return h+'</div>'}
function upcoming(){
  var T0=T(),now=D.nowMin(),Tm=D.add(T0,1);
  var as=App.db.appts.filter(function(a){return (a.status==='new'||a.status==='confirmed')&&((a.date===T0&&a.start>=now-60)||a.date>T0)}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:a.start-b.start}).slice(0,6);
  var h='<div class="card flush"><div class="card-h"><b>Найближчі записи</b><span class="sp"></span><a class="link" href="#/calendar">Календар</a></div>';
  if(!as.length)return h+'<div class="hm-none">Найближчих записів немає. <a class="link" data-act="hm-new">Створити запис</a></div></div>';
  var last=null;
  h+=as.map(function(a){var sep='';if(a.date!==last){last=a.date;if(a.date!==T0)sep='<div class="hm-sep">'+(a.date===Tm?'Завтра':D.human(a.date,{wd:true}))+'</div>'}
    var late=a.date===T0&&a.start<now-10?now-a.start:0;return sep+apRow(a,{late:late})}).join('');
  return h+'</div>'}
function attention(){
  var db=App.db,T0=T(),now=D.nowMin(),items=[];
  function add(tone,icn,title,sub,btns){items.push({tone:tone,ic:icn,title:title,sub:sub,btns:btns||''})}
  function btn(label,k,attrs,cls){return '<button class="btn sm '+(cls||'')+'" data-hm="'+k+'" '+(attrs||'')+'>'+label+'</button>'}
  /* прийшли, час вийшов, не оплачені */
  db.appts.filter(function(a){return a.status==='arrived'&&(a.date<T0||(a.date===T0&&App.apptEnd(a)<=now))}).sort(function(a,b){return a.date<b.date?-1:1}).slice(0,3).forEach(function(a){
    add('warn','wallet',esc(cname(a))+' — візит завершено, не оплачено',(a.date<T0?D.shortH(a.date)+' · ':'')+esc(App.apptTitle(a))+' · '+U.uah(App.apptDue(a)),App.can('checkout')?btn('Оплата','pay','data-id="'+a.id+'"','pri'):'')});
  /* запізнюються */
  db.appts.filter(function(a){return a.date===T0&&(a.status==='new'||a.status==='confirmed')&&a.start+10<=now&&a.start>now-240}).slice(0,3).forEach(function(a){
    var c=App.client(a.client);
    add('dng','clock',esc(cname(a))+' запізнюється на '+U.dur(now-a.start),'Запис на '+U.hm(a.start)+' · '+esc(stf(a))+(c&&c.ph?' · '+U.phone(c.ph):''),
      btn('Прийшов','arrive','data-id="'+a.id+'"')+btn('Не прийшов','noshow','data-id="'+a.id+'"','ghost'))});
  /* непідтверджені */
  var nw=db.appts.filter(function(a){return a.status==='new'&&a.date>=T0&&a.date<=D.add(T0,2)&&!(a.date===T0&&a.start+10<=now)}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:a.start-b.start});
  if(nw.length)add('warn','msg',plan(nw.length,'непідтверджений запис','непідтверджені записи','непідтверджених записів')+' на 3 дні',nw.slice(0,3).map(function(a){return esc(U.short(cname(a)))+' '+(a.date===T0?'':D.shortH(a.date)+' ')+U.hm(a.start)}).join(', ')+(nw.length>3?'…':''),btn('Підтвердити всі','confirmall','data-ids="'+nw.map(function(a){return a.id}).join(',')+'"','pri'));
  /* день не закрито вчора */
  var y=D.add(T0,-1);
  if(db.settings.accounting.dayClose&&!db.dayClose[y]&&db.payments.some(function(p){return p.date===y})&&App.can('cash.view'))add('warn','safe','Вчорашній день не закрито','Звірте готівку в касі та закрийте день',btn('Закрити день','go','data-to="cash"'));
  /* задачі */
  var tcount=openCount();
  if(mod('tasks')&&tcount)add(App.db.tasks.some(function(t){return !t.done&&t.due&&t.due<T0})?'dng':'plain','task',plan(tcount,'задача','задачі','задач')+' на сьогодні або прострочені','Відкрийте список, щоб виконати',btn('До задач','go','data-to="tasks"'));
  /* лист очікування */
  if(mod('waitlist'))(db.waitlist||[]).forEach(function(w){var sv=App.svc(w.svc);if(!sv||items.filter(function(i){return i.wait}).length>=2)return;
    for(var d=(w.from<T0?T0:w.from);d<=w.to;d=D.add(d,1)){var sl=App.freeSlots(w.staff,d,sv.d).filter(function(s){return d!==T0||s>now+30});if(sl.length){var c=App.client(w.client);
      items.push({wait:1,tone:'ok',ic:'clock',title:'Є вільний час для '+esc(c?c.n:'клієнта'),sub:esc(sv.n)+' · '+esc((App.staff(w.staff)||{}).short||'')+' · '+D.human(d)+' о '+U.hm(sl[0])+(w.note?' · '+esc(w.note):''),
        btns:btn('Записати','wait','data-w=\''+JSON.stringify({staff:w.staff,date:d,start:sl[0],client:w.client})+'\'','pri')+btn('Прибрати','waitdel','data-id="'+w.id+'"','ghost')});break}}});
  /* день народження */
  db.clients.filter(function(c){return c.bd&&c.bd.slice(5)===T0.slice(5)}).slice(0,3).forEach(function(c){
    add('plain','cake','Сьогодні день народження: '+esc(c.n),'Привітайте та запропонуйте знижку',btn('Відкрити','client','data-id="'+c.id+'"'))});
  /* склад */
  if(mod('products')&&App.can('products.view')){var low=db.products.filter(function(p){return p.stock<=p.min});if(low.length)add('warn','box',plan(low.length,'товар закінчується','товари закінчуються','товарів закінчується'),low.slice(0,3).map(function(p){return esc(p.n)+' ('+p.stock+')'}).join(', ')+(low.length>3?'…':''),hasRoute('products')?btn('Склад','go','data-to="products"'):'')}
  /* сертифікати */
  if(mod('certs')&&App.can('certs.view')){var ex=db.certs.filter(function(g){return g.status==='active'&&g.expires>=T0&&g.expires<=D.add(T0,14)});if(ex.length)add('warn','gift',plan(ex.length,'сертифікат спливає','сертифікати спливають','сертифікатів спливає')+' протягом 14 днів',ex.slice(0,3).map(function(g){return g.code+' до '+D.shortH(g.expires)}).join(', '),hasRoute('certs')?btn('Сертифікати','go','data-to="certs"'):'')}
  /* відгуки без відповіді */
  if(mod('reviews')&&App.can('reviews.view')){var un=db.reviews.filter(function(r){return !r.reply&&!r.hidden});if(un.length)add(un.some(function(r){return r.rating<=3})?'dng':'plain','star',plan(un.length,'відгук','відгуки','відгуків')+' без відповіді',un.some(function(r){return r.rating<=3})?'Є низька оцінка — варто відповісти першою':'Подякуйте клієнтам',btn('До відгуків','go','data-to="reviews"'))}
  return items}
function attnCard(){
  var it=attention();
  var h='<div class="card flush hm-attn"><div class="card-h"><b>Потребує уваги</b>'+(it.length?'<span class="pill-n">'+it.length+'</span>':'')+'</div>';
  if(!it.length)return h+'<div class="hm-none hm-ok">'+ic('check')+' Усе під контролем — нічого термінового.</div></div>';
  return h+it.slice(0,9).map(function(i){return '<div class="hm-att t-'+i.tone+'"><span class="hm-att-i">'+ic(i.ic)+'</span><div class="t"><b>'+i.title+'</b><small>'+i.sub+'</small></div>'+(i.btns?'<div class="hm-acts">'+i.btns+'</div>':'')+'</div>'}).join('')+'</div>'}
function weekCard(){
  var T0=T(),ws=D.weekStart(T0),pw=D.add(ws,-7),days=D.range(ws,D.add(ws,6));
  var cur=days.map(function(d){return d>T0?0:dayRevenue(d)}),prv=days.map(function(d){return dayRevenue(D.add(d,-7))});
  var idx=D.wd1(T0);
  var curSum=U.sum(cur.slice(0,idx+1)),prvSum=U.sum(prv.slice(0,idx+1));
  var delta=prvSum?Math.round((curSum-prvSum)/prvSum*100):null;
  var mx=Math.max.apply(null,cur.concat(prv).concat([1]));
  var h='<div class="card hm-week"><h3>Виторг тижня<span class="sp"></span>'+(hasRoute('reports')&&App.can('reports.view')?'<a class="link hm-rep" href="#/reports">Звіти</a>':'')+'</h3>'+
   '<div class="hm-week-top"><span class="hm-big">'+U.uah(curSum)+'</span>'+(delta!=null?'<span class="'+(delta>=0?'ok-t':'dng-t')+'">'+(delta>=0?'+':'−')+Math.abs(delta)+'% до минулого тижня</span>':'')+'</div>'+
   '<div class="hm-wk">'+days.map(function(d,i){return '<div class="hm-wk-c'+(d===T0?' now':'')+(d>T0?' fut':'')+'" title="'+D.WDS[(i+1)%7]+' '+D.shortH(d)+': '+U.uah(cur[i])+' (минулого тижня '+U.uah(prv[i])+')"><div class="hm-wk-b"><i class="p" style="height:'+Math.round(prv[i]/mx*100)+'%"></i><i class="c" style="height:'+Math.max(cur[i]?2:0,Math.round(cur[i]/mx*100))+'%"></i></div><span>'+D.WDS[(i+1)%7]+'</span></div>'}).join('')+'</div>'+
   '<div class="hm-legend"><span><i class="c"></i> Цей тиждень</span><span><i class="p"></i> Минулий</span><span class="sp"></span><span class="mute">Минулий тиждень разом: '+U.uah(U.sum(prv))+'</span></div></div>';
  return h}
function noteCard(){
  var n=App.db.dayNotes[T()]||'';
  return '<div class="card hm-note-c"><h3>Нотатка дня<span class="sp"></span><button class="btn ghost sm" data-hm="note">'+ic('edit','s')+' '+(n?'Змінити':'Додати')+'</button></h3>'+(n?'<p class="hm-note-t">'+esc(n)+'</p>':'<p class="mute" style="margin:0">Напр., хто з майстрів раніше йде чи що не забути.</p>')+'</div>'}
function noteEdit(){
  var cur=App.db.dayNotes[T()]||'';
  UI.modal({title:'Нотатка дня',sub:D.human(T(),{wd:true}),size:'narrow',body:'<textarea class="ta" id="hm-nt" placeholder="Що важливо знати команді сьогодні…">'+esc(cur)+'</textarea>',
   foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
   onMount:function(el,close){el.querySelector('[data-no]').onclick=close;el.querySelector('[data-ok]').onclick=function(){App.ops.set('dayNotes.'+T(),el.querySelector('#hm-nt').value.trim(),'Нотатка дня');close();UI.toast('Збережено');App.refresh()}}})}
function tasksCard(){
  if(!mod('tasks'))return '';
  var me=App.me(),T0=T();
  var ts=taskScope().filter(function(t){return !t.done&&t.due&&t.due<=T0}).sort(function(a,b){return a.due<b.due?-1:1}).slice(0,5);
  var h='<div class="card flush"><div class="card-h"><b>Задачі на сьогодні</b><span class="sp"></span><a class="link" href="#/tasks">Усі</a></div>';
  if(!ts.length)return h+'<div class="hm-none">На сьогодні задач немає.</div></div>';
  return h+'<div class="hm-tasks in">'+ts.map(function(t){return taskRow(t,{compact:true})}).join('')+'</div></div>'}

/* ───────── ДАШБОРД: власник / адмін ───────── */
function dashStaff(v){
  var T0=T(),me=App.me(),now=D.nowMin();
  var all=App.apptsOn(T0).filter(function(a){return a.status!=='cancelled'});
  var done=all.filter(function(a){return a.status==='done'}).length;
  var m=App.money(T0,T0),left=expectedLeft(T0);
  var cap=capacity(T0),bk=booked(T0),load=cap?Math.round(bk/cap*100):0;
  var y=D.add(T0,-1),ym=App.money(y,y).revenue;
  App.setTop('<button class="btn pri" data-act="hm-new">'+ic('plus')+'<span class="d-only">Новий запис</span></button>');
  v.innerHTML='<div class="page hm-page">'+
   '<div class="page-h"><div><h2>'+greet()+', '+esc(voc(me.n))+'</h2><p>'+D.human(T0,{wd:true})+' · '+esc(App.db.salon.name)+'</p></div></div>'+
   '<div class="kpis hm-kpis">'+
     kpi('Записів сьогодні',all.length,done+' з '+all.length+' завершено')+
     kpi('Виторг на цей час',U.uah(m.revenue),ym?'вчора за день '+U.uah(ym):'')+
     kpi('Очікується до кінця дня',U.uah(left),left?'за записами, що лишились':'всі оплати прийнято')+
     kpi('Завантаженість',load+'%','майстрів: '+App.masters().filter(function(s){return App.workHours(s.id,T0)}).length+' на зміні')+
   '</div>'+
   '<div class="hm-grid"><div class="hm-col hm-l">'+nowList()+upcoming()+weekCard()+'</div>'+
   '<div class="hm-col hm-r">'+attnCard()+tasksCard()+noteCard()+'</div></div></div>';
  v.onclick=function(e){hmClick(e)};
}

/* ───────── ДАШБОРД: майстер «Мій день» ───────── */
function dashMaster(v){
  var T0=T(),me=App.me(),now=D.nowMin();
  var as=App.apptsOn(T0,me.id).filter(function(a){return a.status!=='cancelled'});
  var pr=App.payroll(me.id,T0,T0),pp=App.payPeriod(),per=App.payroll(me.id,pp.from,pp.to);
  var rest=as.filter(function(a){return a.status==='new'||a.status==='confirmed'||a.status==='arrived'});
  var est=Math.round(U.sum(rest,function(a){return App.apptTotal(a)})*(pr.pct||0)/100);
  var next=as.filter(function(a){return a.status==='arrived'}).shift()||as.filter(function(a){return (a.status==='new'||a.status==='confirmed')&&a.start>=now-30}).shift();
  var wh=App.workHours(me.id,T0),off=App.timeOff(me.id,T0);
  function nextCard(){
    if(!next)return '<div class="card"><h3>Наступний клієнт</h3><p class="mute" style="margin:0">'+(as.length?'На сьогодні клієнтів більше немає — гарна робота.':'Записів на сьогодні немає.')+'</p></div>';
    var c=App.client(next.client),st=c?App.clientStats(c.id):null;
    var h='<div class="card hm-next"><h3>'+(next.status==='arrived'?'Зараз у вас':'Наступний клієнт')+'<span class="sp"></span><span class="hm-nt">'+U.hm(next.start)+'–'+U.hm(App.apptEnd(next))+'</span></h3>'+
     '<div class="row g12">'+UI.av(c,'lg')+'<div style="min-width:0"><div class="hm-nm">'+esc(cname(next))+'</div><div class="mute">'+esc(App.apptTitle(next))+'</div></div></div>';
    var notes=[];
    if(c&&c.tags.indexOf('allergy')>=0)notes.push('<div class="note dng">'+ic('alert')+'<span><b>Алергія.</b> '+esc(c.note||'Уточніть матеріали перед початком.')+'</span></div>');
    else if(c&&c.note)notes.push('<div class="note">'+ic('note')+'<span>'+esc(c.note)+'</span></div>');
    if(next.note)notes.push('<div class="note">'+ic('msg')+'<span>'+esc(next.note)+'</span></div>');
    if(c&&c.tags.indexOf('late')>=0)notes.push('<div class="note warn">'+ic('clock')+'<span>Часто запізнюється</span></div>');
    h+=(notes.length?'<div class="col-f" style="margin-top:12px">'+notes.join('')+'</div>':'');
    if(st)h+='<div class="hm-mini"><span><b>'+st.visits+'</b> візитів</span><span>середній чек <b>'+U.uah(st.avg)+'</b></span><span>останній '+(st.lastDate?D.rel(st.lastDate):'—')+'</span></div>';
    h+='<div class="row" style="margin-top:14px">'+(next.status==='new'||next.status==='confirmed'?'<button class="btn pri" data-hm="arrive" data-id="'+next.id+'">Клієнт прийшов</button>':'')+'<button class="btn" data-hm="open" data-id="'+next.id+'">Відкрити запис</button></div></div>';
    return h}
  function line(){
    if(!as.length)return '<div class="card flush"><div class="card-h"><b>Мій день</b></div>'+'<div class="hm-none">'+(off?'У вас вихідний: '+esc(off.note||'відпустка'):(wh?'Записів ще немає.':'Сьогодні вихідний.'))+'</div></div>';
    return '<div class="card flush"><div class="card-h"><b>Мій день</b><span class="pill-n">'+as.length+'</span><span class="sp"></span>'+(wh?'<span class="mute">зміна '+U.hm(wh.start)+'–'+U.hm(wh.end)+'</span>':'')+'</div>'+
     as.map(function(a){var cur=a.status==='arrived',dn=a.status==='done'||a.status==='noshow';
       return '<div class="li click hm-ap st-'+a.status+(dn?' dim':'')+'" data-open="'+a.id+'" tabindex="0"><div class="hm-time"><b>'+U.hm(a.start)+'</b><small>'+U.hm(App.apptEnd(a))+'</small></div>'+
        '<div class="t"><b class="ell">'+esc(cname(a))+'</b><small class="ell">'+esc(App.apptTitle(a))+'</small></div>'+
        (cur?'<span class="badge arrived">у вас</span>':a.status==='done'?'<span class="badge done">готово</span>':a.status==='noshow'?'<span class="badge noshow">не прийшов</span>':a.status==='new'?'<span class="badge new">нова</span>':'')+'</div>'}).join('')+'</div>'}
  App.setTop('');
  v.innerHTML='<div class="page hm-page">'+
   '<div class="page-h"><div><h2>'+greet()+', '+esc(voc(me.n))+'</h2><p>'+D.human(T0,{wd:true})+' · мій день</p></div></div>'+
   '<div class="kpis hm-kpis">'+kpi('Записів сьогодні',as.length,as.filter(function(a){return a.status==='done'}).length+' завершено')+
    kpi('Зароблено сьогодні',U.uah(pr.total),pr.tips?'з них чайові '+U.uah(pr.tips):'ставка '+pr.pct+'%')+
    kpi('Ще очікується',U.uah(est),rest.length?plan(rest.length,'запис','записи','записів')+' попереду':'на сьогодні все')+
    kpi('За поточний період',U.uah(per.total),D.shortH(pp.from)+' – '+D.shortH(pp.to)+(per.left>0?' · до виплати '+U.uah(per.left):''))+'</div>'+
   '<div class="hm-grid"><div class="hm-col hm-l">'+nextCard()+line()+'</div><div class="hm-col hm-r">'+tasksCard()+noteCard()+'</div></div></div>';
  v.onclick=function(e){hmClick(e)};
}

/* ───────── ДАШБОРД: бухгалтер ───────── */
function dashAcc(v){
  var T0=T(),me=App.me(),ws=D.weekStart(T0),ms=D.monthStart(T0),pp=App.payPeriod();
  var d=App.money(T0,T0),w=App.money(ws,T0),m=App.money(ms,T0);
  var pays=App.masters().map(function(s){return {s:s,p:App.payroll(s.id,pp.from,pp.to)}});
  var owe=U.sum(pays,function(x){return Math.max(0,x.p.left)});
  var exp=App.db.expenses.slice().sort(function(a,b){return a.date<b.date?1:-1}).slice(0,6);
  var y=D.add(T0,-1),dc=App.db.dayClose[y];
  var cat=function(id){var c=App.db.expCats.find(function(x){return x.id===id});return c?c.n:id};
  App.setTop('');
  v.innerHTML='<div class="page hm-page"><div class="page-h"><div><h2>'+greet()+', '+esc(voc(me.n))+'</h2><p>'+D.human(T0,{wd:true})+' · фінансовий огляд</p></div></div>'+
   '<div class="kpis hm-kpis">'+kpi('Виторг сьогодні',U.uah(d.revenue),plan(d.visits,'візит','візити','візитів'))+kpi('Виторг тижня',U.uah(w.revenue),'з понеділка')+kpi('Виторг місяця',U.uah(m.revenue),'витрати '+U.uah(m.expenses))+kpi('Готівка в касі',U.uah(App.cashBalance(T0)),dc?(dc.diff?'вчора розбіжність '+U.uah(dc.diff):'вчора день закрито'):'вчора не закрито',dc&&dc.diff?'down':'')+'</div>'+
   '<div class="hm-grid"><div class="hm-col hm-l">'+
    '<div class="card flush"><div class="card-h"><b>До виплати майстрам</b><span class="sp"></span><span class="mute">'+D.shortH(pp.from)+' – '+D.shortH(pp.to)+'</span></div>'+
    pays.map(function(x){return '<div class="li">'+UI.av(x.s,'sm')+'<div class="t"><b>'+esc(x.s.short)+'</b><small>нараховано '+U.uah(x.p.total)+' · виплачено '+U.uah(x.p.paid)+'</small></div><b class="num nw">'+U.uah(Math.max(0,x.p.left))+'</b></div>'}).join('')+
    '<div class="li hm-tot"><div class="t"><b>Разом до виплати</b></div><b class="num nw">'+U.uah(owe)+'</b></div></div></div>'+
   '<div class="hm-col hm-r"><div class="card flush"><div class="card-h"><b>Останні витрати</b><span class="sp"></span>'+(hasRoute('expenses')?'<a class="link" href="#/expenses">Усі</a>':'')+'</div>'+
    exp.map(function(e){return '<div class="li"><div class="t"><b class="ell">'+esc(e.note||cat(e.cat))+'</b><small>'+D.shortH(e.date)+' · '+esc(cat(e.cat))+'</small></div><b class="num nw">'+U.uah(e.amount)+'</b></div>'}).join('')+'</div>'+
    (hasRoute('reports')?'<a class="btn blk" href="#/reports">Відкрити звіти</a>':'')+'</div></div></div>';
  v.onclick=function(e){hmClick(e)};
}

App.route('home',{title:'Сьогодні',icon:'home',nav:true,group:'work',order:1,render:function(v){
  var role=App.me().role;
  if(role==='master')return dashMaster(v);
  if(role==='accountant')return dashAcc(v);
  dashStaff(v)}});

App.route('tasks',{title:'Задачі',icon:'task',nav:true,group:'work',order:4,module:'tasks',perm:'tasks.view',permAlt:'tasks.own',
  count:function(){return openCount()},countDot:true,render:tasksPage});

})();
