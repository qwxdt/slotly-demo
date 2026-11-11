/* Slotly demo · mod/shell.js (B1) — оболонка v2: Ctrl+K v2, гарячі клавіші, дзвіночок,
   сповіщення (#/notifications), лист «Створити», заглушки точок входу для B2/B3.
   Грузиться ПІСЛЯ system.js і перевизначає App.cmdk (старий блок у system.js приберe B4). */
(function(){
'use strict';
var U=App.u,D=App.d,UI=App.ui,O=App.ops;
var ic=function(n,c){return App.icon(n,c)};
var esc=function(s){return U.esc(s)};
var T=function(){return App.today()};
function mod(k){return App.db.settings.modules[k]!==false}
function cname(id){var c=App.client(id);return c?c.n:'Без клієнта'}
function sname(id){var s=App.staff(id);return s?s.short:''}
function plan(n,a,b,c){return n+' '+U.plural(n,a,b,c)}

/* ═════════════ заглушки точок входу (B2/B3 перевизначають) ═════════════ */
if(!App._b2wait)App.waitNew=function(){UI.toast('Лист очікування — у наступному оновленні демо')};
if(!App._b2move)App.moveAppt=function(id){App.openAppt(id)};
if(!App._b3close)App.closeDayWizard=function(){App.go('cash',{v:'close'})};

/* ═════════════ розкладка: латиниця → українська ЙЦУКЕН ═════════════ */
var LAY={q:'й',w:'ц',e:'у',r:'к',t:'е',y:'н',u:'г',i:'ш',o:'щ',p:'з','[':'х',']':'ї',a:'ф',s:'і',d:'в',f:'а',g:'п',h:'р',j:'о',k:'л',l:'д',';':'ж',"'":'є',z:'я',x:'ч',c:'с',v:'м',b:'и',n:'т',m:'ь',',':'б','.':'ю','`':'ʼ'};
function deLayout(q){return String(q||'').toLowerCase().split('').map(function(ch){return LAY[ch]||ch}).join('')}
App.deLayout=deLayout;
function norm(s){return String(s||'').toLowerCase().replace(/ʼ|'|’/g,"'")}

/* ═════════════ Ctrl+K v2 ═════════════ */
var RKEY='slotly-cmdk-recent';
function recent(){try{return JSON.parse(localStorage.getItem(RKEY)||'[]')}catch(e){return []}}
function pushRecent(it){var r=recent().filter(function(x){return x.k!==it.k});r.unshift({k:it.k,t:it.title,s:it.sub||'',ic:it.ic,type:it.type});try{localStorage.setItem(RKEY,JSON.stringify(r.slice(0,6)))}catch(e){}}
function parseDate(q){
  var m=q.match(/(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?/);
  if(m&&+m[2]>=1&&+m[2]<=12&&+m[1]>=1&&+m[1]<=31){var y=m[3]?(m[3].length===2?2000+ +m[3]:+m[3]):+T().slice(0,4);return y+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0')}
  if(/^сьогодні$/.test(q))return T();if(/^завтра$/.test(q))return D.add(T(),1);
  m=norm(q).match(/^(\d{1,2})\s+([а-яіїєґ]+)$/);if(m){var mi=D.MON.findIndex(function(x){return norm(x).indexOf(m[2].slice(0,4))===0});if(mi>=0)return +T().slice(0,4)+'-'+String(mi+1).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0')}
  return null}
function gotoDate(d){if(App.routes.calendar)App.go('calendar',{d:d||T(),v:'day'})}
function clientSub(c){var st=App.clientStats(c.id),bits=[];
  var nx=App.db.appts.filter(function(a){return a.client===c.id&&a.date>=T()&&a.status!=='cancelled'&&a.status!=='done'&&a.status!=='noshow'}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:a.start-b.start})[0];
  bits.push(App.phoneOf(c)||'');
  bits.push(nx?'наступний візит '+D.rel(nx.date)+' '+U.hm(nx.start):plan(st.visits,'візит','візити','візитів'));
  var debt=App.clientDebt(c.id);if(debt>0)bits.push('борг '+U.uah(debt));
  if(st.noshow)bits.push(plan(st.noshow,'неявка','неявки','неявок'));
  return bits.filter(Boolean).join(' · ')}
function acts(){var me=App.me(),L=[];
  if(App.canNew(null))L.push({type:'act',k:'act:newappt',ic:'plus',title:'Новий запис',kw:'запис записати створити',kbd:'N',fn:function(){App.newAppt({})}});
  if(mod('certs')&&App.can('certs.*'))L.push({type:'act',k:'act:cert',ic:'gift',title:'Продати сертифікат',kw:'сертифікат подарунковий продаж',fn:function(){App.sellCert({})}});
  if(App.can('expenses.add')||App.can('expenses.*'))L.push({type:'act',k:'act:exp',ic:'receipt',title:'Витрата',kw:'витрата витрати додати',fn:function(){App.addExpense()}});
  if(App.can('cash.close')||App.can('cash.*'))L.push({type:'act',k:'act:close',ic:'safe',title:'Закрити день',kw:'закрити день каса звірка',fn:function(){App.closeDayWizard()}});
  if(App.canNew(null))L.push({type:'act',k:'act:block',ic:'block',title:'Блок часу',kw:'блок перерва час',fn:function(){App.newAppt({block:true})}});
  if(me.role!=='master'&&me.role!=='accountant')L.push({type:'act',k:'act:wait',ic:'clock',title:'Лист очікування',kw:'лист очікування черга',fn:function(){App.waitNew({})}});
  if(App.can('clients.*'))L.push({type:'act',k:'act:newclient',ic:'user',title:'Новий клієнт',kw:'клієнт додати створити',fn:function(){UI.clientForm({},function(){})}});
  L.push({type:'act',k:'act:date',ic:'cal',title:'Перейти на дату…',kw:'дата календар перейти',fn:dateModal});
  L.push({type:'act',k:'act:keys',ic:'key',title:'Гарячі клавіші',kw:'клавіші шпаргалка',kbd:'?',fn:keysModal});
  L.forEach(function(x){x.sub='Дія'});return L}
function dateModal(){UI.modal({title:'Перейти на дату',size:'narrow',body:'<label class="fld"><span>Дата</span><input class="inp" type="date" id="sh-gd" value="'+T()+'"></label>',foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Перейти</button>',onMount:function(el,close){el.querySelector('[data-no]').onclick=close;el.querySelector('[data-ok]').onclick=function(){var d=el.querySelector('#sh-gd').value;close();gotoDate(d)}}})}
function cmdItems(qs){
  var raw=norm(qs).trim(),alt=norm(deLayout(raw)),qd=raw.replace(/\D/g,''),me=App.me(),T0=T();
  var qs2=[raw];if(alt!==raw)qs2.push(alt);
  var pages=App.navItems().map(function(r){return {type:'page',k:'page:'+r.id,ic:r.icon,title:r.title,sub:'Розділ',fn:function(){App.go(r.id)}}});
  if(App.routes.notifications)pages.push({type:'page',k:'page:notifications',ic:'bell',title:'Сповіщення',sub:'Розділ',fn:function(){App.go('notifications')}});
  var A=acts();
  function sc(t){t=norm(t);var best=0;qs2.forEach(function(q){if(!q)return;if(t.indexOf(q)===0)best=Math.max(best,3);else if((' '+t).indexOf(' '+q)>=0)best=Math.max(best,2);else if(t.indexOf(q)>=0)best=Math.max(best,1)});return best}
  if(!raw){var out0=[],rc=recent();
    if(rc.length)out0.push({group:'Останні',list:rc.slice(0,5).map(function(r){return {type:r.type,k:r.k,ic:r.ic,title:r.t,sub:r.s}})});
    out0.push({group:'Дії',list:A.slice(0,5)});return out0}
  var out=[],pd=parseDate(raw);
  var canAll=App.can('clients.*')||App.can('clients.view'),canOwn=App.can('clients.own');
  if(canAll||canOwn){
    var ownSet=null;if(!canAll){ownSet={};App.db.appts.forEach(function(a){if(a.staff===me.id)ownSet[a.client]=1})}
    var cs=[];App.db.clients.forEach(function(c){if(ownSet&&!ownSet[c.id])return;var n=norm(c.n),s=0;
      qs2.forEach(function(q){if(n.indexOf(q)===0)s=Math.max(s,4);else if(n.split(' ').some(function(w){return w.indexOf(q)===0}))s=Math.max(s,3);else if(q.length>1&&n.indexOf(q)>=0)s=Math.max(s,2)});
      if(!s&&qd.length>=4&&c.ph&&c.ph.indexOf(qd)>=0)s=2;
      if(!s&&c.ig&&qs2.some(function(q){return norm(c.ig).indexOf(q.replace(/^@/,''))>=0}))s=1;
      if(s)cs.push({c:c,s:s})});
    cs.sort(function(a,b){return b.s-a.s||a.c.n.localeCompare(b.c.n)});
    if(cs.length)out.push({group:'Клієнти',list:cs.slice(0,6).map(function(x){return {type:'client',k:'client:'+x.c.id,av:x.c,title:x.c.n,sub:clientSub(x.c),fn:function(){App.openClient(x.c.id)}}})});
    /* записи: «Мельник завтра» → імʼя + дата */
    var words=raw.split(/\s+/),dWord=null,nameQ=raw;
    if(words.length>1){var last=words[words.length-1],pd2=parseDate(last);if(pd2){dWord=pd2;nameQ=words.slice(0,-1).join(' ')}}
    var nq=[nameQ,norm(deLayout(nameQ))];
    var ap=App.db.appts.filter(function(a){if(a.status==='cancelled'||!a.client)return false;if(ownSet&&a.staff!==me.id)return false;
      if(dWord){if(a.date!==dWord)return false}else if(pd){return a.date===pd}else if(a.date<T0)return false;
      var cn=norm(cname(a.client));return nq.some(function(q){return q&&cn.indexOf(q)>=0})}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:a.start-b.start}).slice(0,5);
    if(ap.length)out.push({group:'Записи',list:ap.map(function(a){return {type:'appt',k:'appt:'+a.id,ic:'cal',title:cname(a.client)+' · '+D.rel(a.date)+' '+U.hm(a.start),sub:App.apptTitle(a)+' · '+sname(a.staff),fn:function(){App.openAppt(a.id)}}})})}
  if(mod('certs')&&(App.can('certs.view')||App.can('certs.*'))){var cq=raw.replace(/\s/g,'').toUpperCase();
    var gs=cq.length>=3?(App.db.certs||[]).filter(function(g){return g.code.replace(/[-\s]/g,'').indexOf(cq.replace(/-/g,''))>=0}).slice(0,4):[];
    if(gs.length)out.push({group:'Сертифікати',list:gs.map(function(g){return {type:'page',k:'cert:'+g.id,ic:'gift',title:g.code+' · '+U.uah(g.balance),sub:'Номінал '+U.uah(g.nominal)+' · до '+D.shortH(g.expires),fn:function(){App.go('certs',{q:g.code})}}})})}
  if(pd)out.push({group:'Дії',list:[{type:'act',k:'date:'+pd,ic:'cal',title:'Календар на '+D.human(pd,{wd:true}),sub:'Перейти на дату',fn:function(){gotoDate(pd)}}]});
  var as=A.map(function(x){return {x:x,s:sc(x.title+' '+(x.kw||''))}}).filter(function(z){return z.s}).sort(function(a,b){return b.s-a.s}).map(function(z){return z.x});
  if(as.length){var g0=out.find(function(g){return g.group==='Дії'});if(g0)g0.list=g0.list.concat(as);else out.push({group:'Дії',list:as})}
  var ps=pages.filter(function(x){return sc(x.title)});if(ps.length)out.push({group:'Розділи',list:ps});
  return out}
App.cmdItems=cmdItems;
function hl(t,q){if(!q)return esc(t);var n=norm(t),qs=[q,norm(deLayout(q))];for(var i=0;i<qs.length;i++){var j=n.indexOf(qs[i]);if(qs[i]&&j>=0)return esc(t.slice(0,j))+'<b>'+esc(t.slice(j,j+qs[i].length))+'</b>'+esc(t.slice(j+qs[i].length))}return esc(t)}
App.cmdk=function(){
  if(U.$('.cmdk'))return;
  return UI.modal({title:'Пошук',body:'<div class="q">'+ic('search','l')+'<input id="sh-cq" placeholder="Клієнт, телефон, сертифікат, дія…" autocomplete="off" aria-label="Пошук"><kbd class="d-only">Esc</kbd><button class="btn ghost m-only sh-cx" data-cx>Закрити</button></div><div class="res" id="sh-cr" role="listbox"></div><div class="sh-cfoot d-only"><span><kbd>↑</kbd><kbd>↓</kbd> вибір</span><span><kbd>Enter</kbd> відкрити</span><span><kbd>Esc</kbd> закрити</span></div>',
   onMount:function(el,close){
     el.classList.add('cmdk');el.querySelector('.modal-h').style.display='none';el.querySelector('.modal-b').style.padding='0';
     var inp=el.querySelector('#sh-cq'),res=el.querySelector('#sh-cr'),flat=[],cur=0;
     el.querySelector('[data-cx]').onclick=close;
     setTimeout(function(){inp.focus()},20);
     function sync(){U.$$('.it',res).forEach(function(b,i){b.setAttribute('aria-selected',i===cur)})}
     function draw(){var q=norm(inp.value).trim();
       var gs=cmdItems(inp.value);flat=[];var h='';
       gs.forEach(function(g){h+='<div class="grp">'+g.group+'</div>';g.list.forEach(function(it){var i=flat.length;flat.push(it);
         h+='<button class="it" role="option" data-i="'+i+'" aria-selected="'+(i===cur)+'">'+(it.av?UI.av(it.av,'sm'):'<span class="sh-cic">'+ic(it.ic||'search')+'</span>')+'<span class="sh-ct"><span class="ell sh-ctt">'+hl(it.title,q)+'</span>'+(it.sub?'<small class="ell">'+esc(it.sub)+'</small>':'')+'</span>'+(it.kbd?'<kbd class="d-only">'+it.kbd+'</kbd>':'')+'</button>'})});
       if(!flat.length)h='<div class="sh-cempty"><b>Нічого не знайдено</b><span>за «'+esc(inp.value)+'». Спробуйте телефон (4+ цифри) або код сертифіката.</span></div>';
       res.innerHTML=h}
     function run(it){if(!it)return;pushRecent(it);close();
       if(it.fn)return setTimeout(it.fn,10);
       var p=it.k.split(':'),t=p[0],id=p.slice(1).join(':');
       if(t==='page')App.go(id);else if(t==='client')App.openClient(id);else if(t==='appt')App.openAppt(id);
       else if(t==='cert'){var g=(App.db.certs||[]).find(function(x){return x.id===id});App.go('certs',g?{q:g.code}:null)}
       else{var f=acts().find(function(x){return x.k===it.k});if(f)setTimeout(f.fn,10)}}
     function move(d){if(!flat.length)return;cur=(cur+d+flat.length)%flat.length;sync();var s=res.querySelector('[aria-selected=true]');if(s)s.scrollIntoView({block:'nearest'})}
     inp.oninput=function(){cur=0;draw()};
     inp.onkeydown=function(e){if(e.key==='ArrowDown'){e.preventDefault();move(1)}else if(e.key==='ArrowUp'){e.preventDefault();move(-1)}else if(e.key==='Enter'){e.preventDefault();run(flat[cur])}};
     res.onclick=function(e){var b=e.target.closest('[data-i]');if(b)run(flat[+b.dataset.i])};
     res.onmousemove=function(e){var b=e.target.closest('[data-i]');if(b&&+b.dataset.i!==cur){cur=+b.dataset.i;sync()}};
     draw()}})};
App.actions.search=function(){App.cmdk()};

/* ═════════════ гарячі клавіші ═════════════ */
var KEYS=[['Ctrl / ⌘ + K','всюди','Пошук і команди'],['N','всюди','Новий запис'],['T','календар','Сьогодні'],['← →','календар','День або тиждень назад / вперед'],['1 2 3','календар','День / тиждень / список'],['/','списки','Фокус у поле фільтра'],['[','всюди','Згорнути / розгорнути меню'],['?','всюди','Ця шпаргалка'],['Esc','всюди','Закрити верхній шар'],['Ctrl / ⌘ + Enter','форми','Зберегти']];
function keysModal(){UI.modal({title:'Гарячі клавіші',size:'narrow',body:'<table class="tbl sh-keys"><tbody>'+KEYS.map(function(k){return '<tr><td><kbd>'+k[0]+'</kbd></td><td>'+k[2]+'</td><td class="mute r">'+k[1]+'</td></tr>'}).join('')+'</tbody></table><p class="mute" style="margin:12px 0 0;font-size:13px">Працюють і в українській розкладці, коли курсор не в полі вводу.</p>'})}
App.keysModal=keysModal;
try{if(localStorage.getItem('slotly-sb-min')==='1')document.body.classList.add('sb-min')}catch(e){}
document.addEventListener('keydown',function(e){
  var t=e.target,tag=(t&&t.tagName)||'';if(/INPUT|TEXTAREA|SELECT/.test(tag)||(t&&t.isContentEditable))return;
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  if(U.$('.ov')||U.$('.menu')||U.$('.sh-pop'))return;
  var rid=App.cur&&App.cur.rt.id;
  if(e.code==='KeyN'&&rid!=='calendar'){if(App.canNew(App.cur&&App.cur.rt)||App.canNew(null)){e.preventDefault();App.newAppt({})}return}
  if(e.key==='/'||e.code==='Slash'&&!e.shiftKey){var f=U.$('.page input[type=search]')||U.$('#view input[type=search]')||U.$('#view .inp-ic input');if(f){e.preventDefault();f.focus()}return}
  if(e.code==='BracketLeft'){e.preventDefault();var on=document.body.classList.toggle('sb-min');try{localStorage.setItem('slotly-sb-min',on?'1':'0')}catch(x){}return}
  if(e.key==='?'||(e.code==='Slash'&&e.shiftKey)){e.preventDefault();keysModal()}
});

/* ═════════════ сповіщення ═════════════ */
var KIND={'appt.new':['plus','Записи'],'appt.move':['move','Записи'],'appt.cancel':['x','Записи'],wait:['clock','Записи'],review:['star','Записи'],pay:['wallet','Гроші'],day:['safe','Гроші'],stock:['box','Гроші']};
function ago(ts){if(!ts)return '';var d=ts.slice(0,10),m=U.pm(ts.slice(11,16)||'00:00');var n=D.diff(d,T());
  if(n===0){var x=D.nowMin()-m;if(x<1)return 'щойно';if(x<60)return x+' хв';return Math.floor(x/60)+' год'}
  if(n===1)return 'вчора';return D.shortH(d)}
function mine(){return (App.db.notifs||[]).filter(function(n){return App.notifMine(n)})}
function openRef(ref){if(!ref)return;var p=ref.split(':');
  if(p[0]==='appt'&&App.appt(p[1]))return App.openAppt(p[1]);
  if(p[0]==='client'&&App.client(p[1]))return App.openClient(p[1]);
  if(App.routes[p[0]])App.go(ref);else App.go('home')}
function notifRows(tab){var L=mine().filter(function(n){return tab==='all'||(KIND[n.kind]||['','Записи'])[1]===tab});
  if(!L.length)return '<div class="sh-nempty">'+ic('bell','xl')+'<b>Нових сповіщень немає</b><span>Тут зʼявляться онлайн-записи, переноси, скасування й гроші.</span></div>';
  return L.map(function(n){var k=KIND[n.kind]||['info'];return '<button class="sh-n'+(n.read?'':' un')+'" data-n="'+n.id+'"><span class="sh-nic">'+ic(k[0])+'</span><span class="sh-nt">'+esc(n.txt)+'</span><span class="sh-ntm">'+ago(n.ts)+'</span></button>'}).join('')}
function notifTabs(cur){return '<div class="seg sh-ntabs" role="tablist">'+[['all','Усі'],['Записи','Записи'],['Гроші','Гроші']].filter(function(t){return t[0]!=='Гроші'||App.me().role!=='master'}).map(function(t){return '<button role="tab" data-tab="'+t[0]+'" aria-selected="'+(t[0]===cur)+'">'+t[1]+'</button>'}).join('')+'</div>'}
function bindNotif(root,redraw){
  root.addEventListener('click',function(e){var b=e.target.closest('[data-n]');if(b){var n=(App.db.notifs||[]).find(function(x){return x.id===b.dataset.n});if(n){O.readNotifs([n.id]);closePop();openRef(n.ref);App.refresh&&setTimeout(function(){var d=U.$('#bell .dot');if(d)d.hidden=!App.unread().length},0)}return}
    var t=e.target.closest('[data-tab]');if(t){redraw(t.dataset.tab);return}
    if(e.target.closest('[data-readall]')){var k=App.unread().length;O.readNotifs('all');redraw();var d=U.$('#bell .dot');if(d)d.hidden=true;UI.toast(k?'Позначено прочитаними: '+k:'Усе вже прочитано');return}
    if(e.target.closest('[data-nset]')){closePop();App.go(App.routes.settings&&App.can('settings.manage')?'settings/notify':'home')}})}
var _pop=null;
function closePop(){if(_pop){_pop.remove();_pop=null;document.removeEventListener('mousedown',_popOut)}}
function _popOut(e){if(_pop&&!_pop.contains(e.target)&&!e.target.closest('#bell'))closePop()}
App.bell=function(anchor){
  if(window.innerWidth<900)return App.go('notifications');
  if(_pop){closePop();return}
  anchor=anchor||U.$('#bell');var tab='all';
  var p=document.createElement('div');p.className='sh-pop';p.setAttribute('role','dialog');p.setAttribute('aria-label','Сповіщення');
  function draw(t){if(t)tab=t;var un=App.unread().length;
    p.innerHTML='<div class="sh-pop-h"><b>Сповіщення</b>'+(un?'<span class="badge">'+un+' нових</span>':'')+'<span class="sp"></span><button class="btn ghost sm" data-readall>Позначити все прочитаним</button></div>'+notifTabs(tab)+'<div class="sh-nlist">'+notifRows(tab)+'</div><div class="sh-pop-f"><a href="#/notifications" class="btn ghost sm">Усі сповіщення</a><span class="sp"></span><button class="btn ghost sm" data-nset>'+ic('cog','s')+'Налаштувати</button></div>'}
  draw();bindNotif(p,draw);document.body.appendChild(p);_pop=p;
  var r=anchor.getBoundingClientRect();p.style.top=(r.bottom+6)+'px';p.style.left=Math.max(8,Math.min(r.right-p.offsetWidth,window.innerWidth-p.offsetWidth-8))+'px';
  setTimeout(function(){document.addEventListener('mousedown',_popOut)},0)};
App.actions.bell=function(e){App.bell(e&&e.target.closest('#bell'))};
window.addEventListener('hashchange',closePop);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&_pop)closePop()});

App.route('notifications',{title:'Сповіщення',icon:'bell',noNew:true,render:function(v,params,q){
  var tab=(q&&q.tab)||'all';
  function draw(t){if(t)tab=t;var un=App.unread().length;
    v.innerHTML='<div class="page narrow sh-npage"><div class="page-h"><div><h2>Сповіщення</h2><p>'+(un?un+' '+U.plural(un,'нове','нові','нових'):'Усе прочитано')+'</p></div><span class="sp"></span>'+(un?'<button class="btn" data-readall>'+ic('checks')+'Прочитати все</button>':'')+'</div>'+notifTabs(tab)+'<div class="sh-nlist card">'+notifRows(tab)+'</div>'+
      (App.can('settings.manage')?'<button class="btn ghost" data-nset style="margin-top:12px">'+ic('cog','s')+'Налаштувати сповіщення</button>':'')+'</div>';bindNotif(v.firstChild,draw)}
  draw();}});

/* ═════════════ лист «Створити» ═════════════ */
function createItems(){var me=App.me(),own=me.role==='master',L=[];
  if(App.canNew(null))L.push({ic:'plus',t:'Новий запис',s:own?'На себе, найближчий вільний час':'Сьогодні, найближчий вільний час',kbd:'N',fn:function(){App.newAppt({})}});
  if(App.canNew(null)||own)L.push({ic:'block',t:'Блок часу',s:'Перерва, навчання, особисте',fn:function(){App.newAppt({block:true})}});
  if(!own&&me.role!=='accountant'){
    var sub=[];if(mod('products')&&App.can('products.view'))sub.push('товар');if(mod('certs')&&App.can('certs.*'))sub.push('сертифікат');if(mod('abons')&&App.can('abons.*'))sub.push('абонемент');
    if(sub.length)L.push({ic:'cash',t:'Продаж без запису',s:sub.join(', ').replace(/^./,function(c){return c.toUpperCase()}),fn:saleMenu});
    L.push({ic:'clock',t:'У лист очікування',s:'Клієнт чекає на вільне вікно',fn:function(){App.waitNew({})}});}
  if(App.can('expenses.add')||App.can('expenses.*'))L.push({ic:'receipt',t:'Витрата',s:'Оренда, матеріали, інше',fn:function(){App.addExpense()}});
  if(mod('tasks')&&(App.can('tasks.*')||App.can('tasks.own')))L.push({ic:'task',t:'Нова задача',s:'Нагадування собі або колезі',fn:function(){App.go('tasks');setTimeout(function(){var f=U.$('#view input[type=text],#view .inp');if(f)f.focus()},80)}});
  return L}
App.createItems=createItems;
function saleMenu(){var L=[];
  if(mod('products')&&App.can('products.view'))L.push({ic:'box',t:'Товар',s:'Продаж з вітрини',fn:function(){App.sellProduct({})}});
  if(mod('certs')&&App.can('certs.*'))L.push({ic:'gift',t:'Сертифікат',s:'Подарунковий, на суму',fn:function(){App.sellCert({})}});
  if(mod('abons')&&App.can('abons.*'))L.push({ic:'ticket',t:'Абонемент',s:'Пакет візитів',fn:function(){App.sellAbon({})}});
  sheet('Продаж без запису',L)}
function sheet(title,L){UI.modal({title:title,size:'narrow',noFocus:true,body:'<div class="sh-create">'+L.map(function(x,i){return '<button class="sh-ci" data-ci="'+i+'"><span class="sh-cic">'+ic(x.ic)+'</span><span class="sh-ct"><b>'+esc(x.t)+'</b><small>'+esc(x.s||'')+'</small></span>'+(x.kbd?'<kbd class="d-only">'+x.kbd+'</kbd>':'')+'</button>'}).join('')+'</div>',
  onMount:function(el,close){el.classList.add('sh-sheet');el.querySelector('.sh-create').onclick=function(e){var b=e.target.closest('[data-ci]');if(!b)return;var it=L[+b.dataset.ci];close();setTimeout(it.fn,10)}}})}
App.actions.create=function(e){var L=createItems();var a=e&&e.target&&e.target.closest&&e.target.closest('.split-more');
  if(a&&window.innerWidth>899){UI.menu(a,L.map(function(x){return {t:x.t,ic:x.ic,fn:x.fn}}));return}
  if(!L.length)return UI.toast('Для вашої ролі тут немає дій',{type:'err'});
  sheet('Створити',L)};

})();
