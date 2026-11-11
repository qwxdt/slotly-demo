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
   (over.length+today.length+later.length===0?UI.empty('task','Задач немає','Додайте першу — Enter, щоб зберегти.','<button class="btn pri" data-hm="tnew" style="margin-top:8px">Нова задача</button>'):
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
    if(k==='closeday')return App.closeDayWizard();
    if(k==='attmore'){var cd=b.closest('[data-attn]');if(cd)cd.classList.add('open');b.remove();return}
    if(k==='mday')return App.setQ({d:b.dataset.d===T()?'':b.dataset.d},true);
    if(k==='slot')return App.newAppt({staff:App.db.meId,date:b.dataset.d,start:+b.dataset.s});
    return}
  var r=e.target.closest('[data-open]');if(r&&!e.target.closest('a,button'))App.openAppt(r.dataset.open);
}
App.actions['hm-new']=function(){App.newAppt({})};
App.actions['hm-tnew']=function(){taskForm()};

/* ───────── ДАШБОРД v2: компоненти (DESIGN-V2 §7.2) ───────── */
var METH={cash:'Готівка',card:'Картка',transfer:'Переказ',online:'Онлайн',cert:'Сертифікат',abon:'Абонемент'};
function kpi(l,v,d,cls){return '<div class="kpi"><div class="l">'+l+'</div><div class="v num">'+v+'</div>'+(d?'<div class="d '+(cls||'')+'">'+d+'</div>':'')+'</div>'}
function risks(a){return App.apptRisks(a).map(function(r){return '<span class="tag hm-risk r-'+r.k+'">'+esc(r.t)+'</span>'}).join('')}
function mainBtn(a,o){var st=a.status;o=o||{};
  if(st==='new')return '<button class="btn sm" data-hm="confirm" data-id="'+a.id+'">Підтвердити</button>';
  if(st==='confirmed')return '<button class="btn sm" data-hm="arrive" data-id="'+a.id+'">Прийшов</button>';
  if(st==='arrived'&&App.can('checkout')&&o.pay!==false)return '<button class="btn sm pri" data-hm="pay" data-id="'+a.id+'">Оплата</button>';
  return ''}
function apRow(a,o){
  o=o||{};var st=a.status,end=App.apptEnd(a),now=D.nowMin(),T0=T();
  var late=a.date===T0&&(st==='new'||st==='confirmed')&&a.start+10<=now?now-a.start:0;
  var nowCls=st==='arrived'||(a.date===T0&&a.start<=now&&end>now&&st!=='done'&&st!=='noshow')?' now':'';
  var act=o.act===false?'':mainBtn(a,o);
  var sub=esc(App.apptTitle(a))+(o.noStaff?'':' · '+esc(stf(a)));
  return '<div class="li click hm-ap st-'+st+nowCls+((st==='done'||st==='noshow')?' dim':'')+'" data-open="'+a.id+'" tabindex="0">'+
    '<div class="hm-time num"><b>'+U.hm(a.start)+'</b><small>'+U.hm(end)+'</small></div>'+
    '<div class="t"><b class="ell">'+esc(cname(a))+'</b><small class="ell">'+sub+'</small>'+(o.risk!==false?'<span class="hm-risks">'+risks(a)+'</span>':'')+'</div>'+
    (late?'<span class="badge dng nw">+'+late+NB+'хв</span>':st==='done'?'<span class="badge done d-only">оплачено</span>':st==='noshow'?'<span class="badge noshow d-only">не прийшов</span>':'')+
    (act?'<div class="hm-acts">'+act+'</div>':'')+
  '</div>'}
/* «Зараз і далі» — стрічка дня */
function feedCard(){
  var T0=T(),now=D.nowMin(),Tm=D.add(T0,1);
  var day=App.apptsOn(T0).filter(function(a){return a.status!=='cancelled'&&!a.block});
  var cur=day.filter(function(a){return a.status==='arrived'});
  var next=day.filter(function(a){return (a.status==='new'||a.status==='confirmed')&&App.apptEnd(a)>now-60});
  var done=day.filter(function(a){return a.status==='done'||a.status==='noshow'});
  var list=cur.concat(next);
  var h='<div class="card flush hm-feed"><div class="card-h"><b>Зараз і далі</b>'+(list.length?'<span class="pill-n">'+list.length+'</span>':'')+'<span class="sp"></span>'+(hasRoute('calendar')?'<a class="link" href="#/calendar">Календар</a>':'')+'</div>';
  if(!list.length){var tm=App.apptsOn(Tm).filter(function(a){return a.status!=='cancelled'&&!a.block});
    h+='<div class="hm-empty">'+ic('cal','l')+'<b>'+(day.length?'На сьогодні все — більше записів немає':'Сьогодні записів немає')+'</b><span>'+(tm.length?'Завтра '+plan(tm.length,'запис','записи','записів')+', перший о '+U.hm(tm[0].start)+'.':'Завтра поки порожньо.')+'</span>'+(App.canNew(null)?'<button class="btn" data-hm="newappt">'+ic('plus')+'Новий запис</button>':'')+'</div>';
    if(tm.length)h+='<div class="hm-sep">Завтра</div>'+tm.slice(0,4).map(function(a){return apRow(a)}).join('')}
  else{var LIM=8;h+=list.slice(0,LIM).map(function(a){return apRow(a)}).join('');
    if(list.length>LIM)h+=hasRoute('calendar')?'<a class="hm-more" href="#/calendar?v=list">Ще '+(list.length-LIM)+' — у календарі</a>':'<div class="hm-none">Ще '+(list.length-LIM)+'</div>'}
  if(done.length)h+='<details class="hm-done"><summary>Завершені сьогодні · '+done.length+'</summary>'+done.map(function(a){return apRow(a,{act:false,risk:false})}).join('')+'</details>';
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
    add('dng','clock',esc(cname(a))+' запізнюється на '+U.dur(now-a.start),'Запис на '+U.hm(a.start)+' · '+esc(stf(a))+(App.phoneOf(c)?' · '+App.phoneOf(c):''),
      btn('Прийшов','arrive','data-id="'+a.id+'"')+btn('Не прийшов','noshow','data-id="'+a.id+'"','ghost'))});
  /* непідтверджені */
  var nw=db.appts.filter(function(a){return a.status==='new'&&a.date>=T0&&a.date<=D.add(T0,2)&&!(a.date===T0&&a.start+10<=now)}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:a.start-b.start});
  if(nw.length)add('warn','msg',plan(nw.length,'непідтверджений запис','непідтверджені записи','непідтверджених записів')+' на 3 дні',nw.slice(0,3).map(function(a){return esc(U.short(cname(a)))+' '+(a.date===T0?'':D.shortH(a.date)+' ')+U.hm(a.start)}).join(', ')+(nw.length>3?'…':''),btn('Підтвердити всі','confirmall','data-ids="'+nw.map(function(a){return a.id}).join(',')+'"','pri'));
  /* день не закрито вчора */
  var y=D.add(T0,-1);
  if(db.settings.accounting.dayClose&&!db.dayClose[y]&&db.payments.some(function(p){return p.date===y})&&App.can('cash.view'))add('warn','safe','Вчорашній день не закрито','Звірте готівку в касі та закрийте день',btn('Закрити день','closeday','','pri'));
  /* задачі */
  var tcount=openCount();
  if(mod('tasks')&&tcount)add(App.db.tasks.some(function(t){return !t.done&&t.due&&t.due<T0})?'dng':'plain','task',plan(tcount,'задача','задачі','задач')+' на сьогодні або прострочені','Відкрийте список, щоб виконати',btn('До задач','go','data-to="tasks"'));
  /* лист очікування */
  if(mod('waitlist'))(db.waitlist||[]).forEach(function(w){var sv=App.svc(w.svc);if(!sv||items.filter(function(i){return i.wait}).length>=2)return;
    for(var d=(w.from<T0?T0:w.from);d<=w.to;d=D.add(d,1)){var sl=App.freeSlots(w.staff,d,sv.d).filter(function(s){return d!==T0||s>now+30});if(sl.length){var c=App.client(w.client);
      items.push({wait:1,tone:'ok',ic:'clock',title:'Вільне вікно: '+esc(c?c.n:'клієнт з листа очікування'),sub:esc(sv.n)+' · '+esc((App.staff(w.staff)||{}).short||'')+' · '+D.human(d)+' о '+U.hm(sl[0])+(w.note?' · '+esc(w.note):''),
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
  var h='<div class="card flush hm-attn" data-attn><div class="card-h"><b>Потребує уваги</b>'+(it.length?'<span class="pill-n">'+it.length+'</span>':'')+'</div>';
  if(!it.length)return h+'<div class="hm-none hm-ok">'+ic('check')+' Усе під контролем — нічого термінового.</div></div>';
  return h+it.slice(0,8).map(function(i,n){return '<div class="hm-att t-'+i.tone+(n>=3?' hm-x':'')+'"><span class="hm-att-i">'+ic(i.ic)+'</span><div class="t"><b>'+i.title+'</b><small>'+i.sub+'</small></div>'+(i.btns?'<div class="hm-acts">'+i.btns+'</div>':'')+'</div>'}).join('')+
   (it.length>3?'<button class="hm-more m-only" data-hm="attmore">Ще '+(Math.min(it.length,8)-3)+'</button>':'')+'</div>'}
/* «Каса дня» */
function cashCard(){
  if(!App.can('cash.view'))return '';
  var T0=T(),ds=App.dayStatus(T0),bm=ds.byMethod||{},keys=Object.keys(bm).filter(function(k){return bm[k]});
  var dc=App.db.dayClose[T0];
  var h='<div class="card hm-cash"><h3>Каса дня<span class="sp"></span>'+(hasRoute('cash')?'<a class="link" href="#/cash">Каса</a>':'')+'</h3>'+
    '<div class="hm-cash-top"><span class="hm-big num">'+U.uah(ds.revenue)+'</span><span class="mute">виторг · '+plan(ds.done,'візит','візити','візитів')+'</span></div>';
  h+=keys.length?'<div class="hm-meth">'+keys.map(function(k){return '<div><span>'+esc(METH[k]||k)+'</span><b class="num">'+U.uah(bm[k])+'</b></div>'}).join('')+'<div class="hm-meth-t"><span>Готівка в касі зараз</span><b class="num">'+U.uah(ds.expected)+'</b></div></div>':
    '<p class="mute hm-cash-e">Оплат сьогодні ще не було. Готівка в касі: <b class="num">'+U.uah(ds.expected)+'</b></p>';
  if(dc)h+='<div class="note'+(dc.diff?' warn':'')+'">'+ic(dc.diff?'alert':'check')+'<span>День закрито'+(dc.diff?' · розбіжність '+U.uah(dc.diff):' без розбіжностей')+'</span></div>';
  else if(App.can('cash.close')||App.can('cash.*'))h+='<button class="btn blk" data-hm="closeday">'+ic('safe')+'Закрити день</button>';
  return h+'</div>'}
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

/* ───────── ДАШБОРД: власник / адмін (DESIGN-V2 §7.2) ───────── */
function hrs(min){var h=Math.round(min/30)/2;return String(h).replace('.',',')+NB+'год'}
function dashStaff(v){
  var T0=T(),me=App.me();
  var all=App.apptsOn(T0).filter(function(a){return a.status!=='cancelled'&&!a.block});
  var came=all.filter(function(a){return a.status==='arrived'||a.status==='done'}).length;
  var ds=App.dayStatus(T0),unpaid=U.sum(ds.unpaid.map(App.appt).filter(Boolean),function(a){return App.apptDue(a)});
  var cap=capacity(T0),bk=booked(T0),free=Math.max(0,cap-bk),load=cap?Math.round(bk/cap*100):0;
  var y=D.add(T0,-1),ym=App.money(y,y).revenue;
  App.setTop('');
  v.innerHTML='<div class="page hm-page hm-owner">'+
   '<div class="page-h"><div><h2>'+greet()+', '+esc(voc(me.n))+'</h2><p>'+D.human(T0,{wd:true})+' · '+esc(App.db.salon.name)+'</p></div></div>'+
   '<div class="kpis hm-kpis">'+
     kpi('Виторг сьогодні',U.uah(ds.revenue),ym?'вчора '+U.uah(ym):'')+
     kpi('Записів',came+NB+'/'+NB+all.length,'прийшли / всього')+
     kpi('Вільно',hrs(free),cap?'завантаженість '+load+'%':'ніхто не працює')+
     kpi('Неоплачено',U.uah(unpaid),ds.unpaid.length?plan(ds.unpaid.length,'візит','візити','візитів')+' чекають оплати':'усе оплачено',ds.unpaid.length?'down':'')+
   '</div>'+
   '<div class="hm-grid2">'+
     '<div class="hm-a">'+attnCard()+'</div>'+
     '<div class="hm-m">'+feedCard()+weekCard()+'</div>'+
     '<div class="hm-s">'+cashCard()+tasksCard()+noteCard()+'</div>'+
   '</div></div>';
  v.onclick=function(e){hmClick(e)};
}

/* ───────── ДАШБОРД: майстер «Мій день» (DESIGN-V2 §6.6) ───────── */
function gaps(staffId,date,as){var wh=App.workHours(staffId,date);if(!wh)return [];
  var busy=as.filter(function(a){return a.status!=='cancelled'&&a.status!=='noshow'}).map(function(a){return [a.start,App.apptEnd(a)]});
  if(wh.brk)busy.push([wh.brk[0],wh.brk[1]]);busy.sort(function(a,b){return a[0]-b[0]});
  var out=[],t=wh.start,now=date===T()?D.nowMin():-1;
  busy.forEach(function(b){if(b[0]-t>=30)out.push([t,b[0]]);t=Math.max(t,b[1])});
  if(wh.end-t>=30)out.push([t,wh.end]);
  return out.map(function(g){return [Math.max(g[0],now>g[0]&&now<g[1]?Math.ceil(now/15)*15:g[0]),g[1]]}).filter(function(g){return g[1]-g[0]>=30&&g[1]>now})}
function dashMaster(v,q){
  var T0=T(),me=App.me(),day=(q&&q.d)||T0,now=D.nowMin(),acc=App.db.settings.access||{};
  var canPay=App.can('checkout')||!!acc.masterPay;
  var as=App.apptsOn(day,me.id).filter(function(a){return a.status!=='cancelled'&&!a.block}).sort(function(a,b){return a.start-b.start});
  var pr=App.payroll(me.id,day,day);
  var wh=App.workHours(me.id,day),off=App.timeOff&&App.timeOff(me.id,day);
  var gp=gaps(me.id,day,App.apptsOn(day,me.id));
  var freeMin=U.sum(gp,function(g){return g[1]-g[0]});
  var cur=day===T0?(as.filter(function(a){return a.status==='arrived'})[0]||as.filter(function(a){return (a.status==='new'||a.status==='confirmed')&&App.apptEnd(a)>now})[0]):null;
  var ttl=U.$('#ttl');if(ttl)ttl.textContent='Мій день';
  App.setTop('');
  function curCard(){
    if(!cur)return '';
    var c=App.client(cur.client),st=c?App.clientStats(c.id):null,ph=App.phoneOf(c);
    var h='<div class="card hm-cur'+(cur.status==='arrived'?' on':'')+'"><div class="hm-cur-h"><span class="hm-cur-l">'+(cur.status==='arrived'?'Зараз у вас':'Наступний клієнт')+'</span><span class="sp"></span><b class="num">'+U.hm(cur.start)+'–'+U.hm(App.apptEnd(cur))+'</b></div>'+
     '<div class="hm-cur-c">'+UI.av(c,'lg')+'<div class="t"><div class="hm-nm ell">'+esc(cname(cur))+'</div><div class="mute ell">'+esc(App.apptTitle(cur))+'</div></div></div>';
    var notes=[];var al=c&&(c.allergy||(c.tags.indexOf('allergy')>=0?(c.note||'Уточніть матеріали перед початком'):''));
    if(al)notes.push('<div class="note dng">'+ic('alert')+'<span><b>Алергія.</b> '+esc(al)+'</span></div>');
    if(c&&c.formula)notes.push('<div class="note">'+ic('note')+'<span><b>Формула.</b> '+esc(c.formula)+'</span></div>');
    else if(c&&c.note&&!al)notes.push('<div class="note">'+ic('note')+'<span>'+esc(c.note)+'</span></div>');
    if(cur.note)notes.push('<div class="note">'+ic('msg')+'<span>'+esc(cur.note)+'</span></div>');
    if(notes.length)h+='<div class="col-f hm-cur-n">'+notes.join('')+'</div>';
    /* майстру між клієнтами — тільки «новий/постійний», без середнього чеку */
    if(st&&!st.visits)h+='<div class="hm-mini"><span class="hm-new">Новий клієнт · перший візит</span></div>';
    else if(st)h+='<div class="hm-mini"><span>'+st.visits+' '+U.plural(st.visits,'візит','візити','візитів')+(st.lastDate?' · останній '+D.rel(st.lastDate):'')+'</span></div>';
    var b='';
    if(cur.status==='new'||cur.status==='confirmed')b='<button class="btn pri big" data-hm="arrive" data-id="'+cur.id+'">'+ic('check')+'Прийшов</button>';
    else if(cur.status==='arrived'&&canPay)b='<button class="btn pri big" data-hm="pay" data-id="'+cur.id+'">'+ic('wallet')+'Оплата · '+U.uah(Math.max(0,App.apptDue?App.apptDue(cur):App.apptTotal(cur)))+'</button>';
    h+='<div class="hm-cur-b">'+b+'<button class="btn big" data-hm="open" data-id="'+cur.id+'">Відкрити</button>'+(ph?'<a class="icobtn hm-call" href="tel:'+esc(c.ph)+'" aria-label="Подзвонити">'+ic('phone')+'</a>':'')+'</div>';
    /* «Далі» — щоб наступний був видно без скролу */
    var nx=as.filter(function(a){return a.id!==cur.id&&a.start>=cur.start&&(a.status==='new'||a.status==='confirmed')})[0];
    if(nx)h+='<div class="hm-next" role="button" tabindex="0" data-open="'+nx.id+'"><span class="mute">Далі</span><b class="num">'+U.hm(nx.start)+'</b><span class="ell">'+esc(cname(nx))+' · '+esc(App.apptTitle(nx))+'</span>'+ic('right','s')+'</div>';
    return h+'</div>'}
  function line(){
    var rows=[],past=[],nx1=as.filter(function(a){return !(cur&&a.id===cur.id)&&(a.status==='new'||a.status==='confirmed')&&(day!==T0||App.apptEnd(a)>now)})[0];
    /* AUDIT-master: велика кнопка лише в найближчої, у боргу чи «прийшов»; решта рядків — спокійні (менше шуму) */
    as.forEach(function(a){if(cur&&a.id===cur.id)return;var need=a===nx1||a.status==='arrived'||(App.apptDue&&App.apptDue(a)>0&&a.status==='done');var r={t:a.start,h:apRow(a,{noStaff:true,pay:canPay,act:need?undefined:false})};
      if(day===T0&&(a.status==='done'||a.status==='noshow')&&App.apptEnd(a)<=now&&!(App.apptDue&&App.apptDue(a)>0))past.push(r);else rows.push(r)});
    gp.forEach(function(g){if(day===T0&&g[1]<=now)return;rows.push({t:g[0],h:'<button class="li hm-gap" data-hm="slot" data-d="'+day+'" data-s="'+g[0]+'"><div class="hm-time num"><b>'+U.hm(g[0])+'</b><small>'+U.hm(g[1])+'</small></div><div class="t"><b>вільно '+U.dur(g[1]-g[0])+'</b></div><span class="hm-gap-a">'+ic('plus','s')+'записати</span></button>'})});
    rows.sort(function(a,b){return a.t-b.t});
    var h='<div class="card flush"><div class="card-h"><b>'+(day===T0?'Сьогодні':'Записи')+'</b>'+(as.length?'<span class="pill-n">'+as.length+'</span>':'')+'<span class="sp"></span>'+(wh?'<span class="mute">'+U.hm(wh.start)+'–'+U.hm(wh.end)+'</span>':'')+'</div>';
    if(past.length)h+='<details class="hm-past"><summary>'+ic('check','s')+'Завершено: '+past.length+'</summary>'+past.map(function(r){return r.h}).join('')+'</details>';
    if(!rows.length&&past.length)return h+'<div class="hm-empty sm"><b>На сьогодні все</b><span>Більше записів немає.</span></div></div>';
    if(!rows.length)return h+'<div class="hm-empty">'+ic('cal','l')+'<b>'+(off?'Вихідний: '+esc(off.note||'відпустка'):wh?'Записів немає':'Цей день не робочий')+'</b><span>'+(wh?'Увесь день вільний.':'Графік змінює адміністратор.')+'</span></div></div>';
    return h+rows.map(function(r){return r.h}).join('')+'</div>'}
  var rel=D.diff(T0,day);
  var dayLbl=(rel===0?'Сьогодні':rel===1?'Завтра':rel===-1?'Вчора':'')+(rel>=-1&&rel<=1?', ':'')+D.human(day,{wd:true});
  v.innerHTML='<div class="page narrow hm-page hm-myday">'+
   '<div class="hm-dnav"><button class="icobtn" data-hm="mday" data-d="'+D.add(day,-1)+'" aria-label="Попередній день">'+ic('left')+'</button><div class="hm-dnav-t"><b>'+(rel===0?'Сьогодні':rel===1?'Завтра':rel===-1?'Вчора':D.human(day,{wd:true}).split(',')[0])+'</b><span>'+D.human(day,{wd:true})+'</span></div><button class="icobtn" data-hm="mday" data-d="'+D.add(day,1)+'" aria-label="Наступний день">'+ic('right')+'</button></div>'+
   (day!==T0?'<button class="btn ghost sm hm-today" data-hm="mday" data-d="'+T0+'">До сьогодні</button>':'')+
   '<div class="kpis hm-kpis hm-k2">'+kpi('Записів · вільно',as.length+NB+'·'+NB+hrs(freeMin),wh?'':'не робочий день')+
    '<a class="hm-kpi-a" href="#/payroll">'+kpi('Зароблено',U.uah(pr.total),pr.tips?'чайові '+U.uah(pr.tips):'')+'</a></div>'+
   curCard()+line()+(day===T0?tasksCard():'')+'</div>';
  v.onclick=function(e){hmClick(e)};
  var pg=v.querySelector('.hm-myday'),x0=null,y0=0;
  pg.addEventListener('touchstart',function(e){var t=e.touches[0];x0=t.clientX;y0=t.clientY},{passive:true});
  pg.addEventListener('touchend',function(e){if(x0==null)return;var t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;x0=null;
    if(Math.abs(dx)>window.innerWidth*0.3&&Math.abs(dx)>Math.abs(dy)*1.5)App.setQ({d:D.add(day,dx<0?1:-1)},true)});
}

/* ───────── ДАШБОРД: бухгалтер ───────── */
function openDays(){var T0=T(),out=[];for(var i=1;i<=14;i++){var d=D.add(T0,-i);if(App.db.dayClose[d])continue;
  var pays=App.db.payments.filter(function(p){return p.date===d});if(!pays.length)continue;
  out.push({d:d,rev:App.money(d,d).revenue,n:pays.length})}return out}
function dashAcc(v){
  var T0=T(),me=App.me(),ms=D.monthStart(T0),pp=App.payPeriod();
  var m=App.money(ms,T0);
  var pays=App.masters().map(function(s){return {s:s,p:App.payroll(s.id,pp.from,pp.to)}});
  var owe=U.sum(pays,function(x){return Math.max(0,x.p.left)});
  var dcs=Object.keys(App.db.dayClose).filter(function(d){return d>=ms&&d<=T0}).map(function(d){return App.db.dayClose[d]});
  var diffs=dcs.filter(function(r){return r.diff});var diffSum=U.sum(diffs,function(r){return r.diff});
  var od=openDays();
  var exp=App.db.expenses.slice().sort(function(a,b){return a.date<b.date?1:-1}).slice(0,6);
  var cat=function(id){var c=App.db.expCats.find(function(x){return x.id===id});return c?c.n:id};
  App.setTop('');
  v.innerHTML='<div class="page hm-page"><div class="page-h"><div><h2>'+greet()+', '+esc(voc(me.n))+'</h2><p>'+D.human(T0,{wd:true})+' · фінанси з '+D.shortH(ms)+'</p></div></div>'+
   '<div class="kpis hm-kpis">'+kpi('Виторг',U.uah(m.revenue),plan(m.visits,'візит','візити','візитів')+' за місяць')+
    kpi('Витрати',U.uah(m.expenses),m.revenue?Math.round(m.expenses/m.revenue*100)+'% від виторгу':'')+
    kpi('До виплати майстрам',U.uah(owe),D.shortH(pp.from)+' – '+D.shortH(pp.to))+
    kpi('Розбіжності каси',diffs.length?U.uah(diffSum):'0'+NB+'₴',diffs.length?plan(diffs.length,'день','дні','днів')+' з розбіжністю':'усе зійшлося',diffs.length?'down':'')+'</div>'+
   '<div class="hm-grid2 hm-acc">'+
    '<div class="hm-a"><div class="card flush"><div class="card-h"><b>Не закриті дні</b>'+(od.length?'<span class="pill-n">'+od.length+'</span>':'')+'<span class="sp"></span>'+(hasRoute('cash')?'<a class="link" href="#/cash">Каса</a>':'')+'</div>'+
      (od.length?od.map(function(o){return '<button class="li click" data-hm="go" data-to="cash" data-q=\''+JSON.stringify({d:o.d})+'\'><div class="t"><b>'+D.human(o.d,{wd:true})+'</b><small>'+plan(o.n,'оплата','оплати','оплат')+' · каса не звірена</small></div><b class="num nw">'+U.uah(o.rev)+'</b>'+ic('right','s')+'</button>'}).join(''):'<div class="hm-none hm-ok">'+ic('check')+' Усі дні за 2 тижні закриті.</div>')+'</div></div>'+
    '<div class="hm-m"><div class="card flush"><div class="card-h"><b>До виплати майстрам</b><span class="sp"></span>'+(hasRoute('payroll')?'<a class="link" href="#/payroll">Зарплати</a>':'')+'</div>'+
     pays.map(function(x){return '<div class="li">'+UI.av(x.s,'sm')+'<div class="t"><b>'+esc(x.s.short)+'</b><small>нараховано '+U.uah(x.p.total)+' · виплачено '+U.uah(x.p.paid)+'</small></div><b class="num nw">'+U.uah(Math.max(0,x.p.left))+'</b></div>'}).join('')+
     '<div class="li hm-tot"><div class="t"><b>Разом</b></div><b class="num nw">'+U.uah(owe)+'</b></div></div></div>'+
    '<div class="hm-s"><div class="card flush"><div class="card-h"><b>Останні витрати</b><span class="sp"></span>'+(hasRoute('expenses')?'<a class="link" href="#/expenses">Усі</a>':'')+'</div>'+
     (exp.length?exp.map(function(e){return '<div class="li"><div class="t"><b class="ell">'+esc(e.note||cat(e.cat))+'</b><small>'+D.shortH(e.date)+' · '+esc(cat(e.cat))+'</small></div><b class="num nw">'+U.uah(e.amount)+'</b></div>'}).join(''):'<div class="hm-none">Витрат ще немає.</div>')+'</div>'+
     (hasRoute('reports')?'<a class="btn blk" href="#/reports">Відкрити звіти</a>':'')+'</div>'+
   '</div></div>';
  v.onclick=function(e){hmClick(e)};
}

App.route('home',{title:'Сьогодні',icon:'home',nav:true,group:'work',order:1,render:function(v,params,q){
  var role=App.me().role;
  if(role==='master')return dashMaster(v,q||{});
  if(role==='accountant')return dashAcc(v);
  dashStaff(v)}});

App.route('tasks',{title:'Задачі',icon:'task',nav:true,group:'work',order:4,module:'tasks',perm:'tasks.view',permAlt:'tasks.own',
  count:function(){return openCount()},countDot:true,render:tasksPage});

})();
