/* Slotly demo — SYSTEM: Звіти, Відгуки, Налаштування, Журнал дій, глобальний пошук (Ctrl+K). Префікс стилів: .sy- */
(function(){
'use strict';
var U=App.u,D=App.d,UI=App.ui,esc=U.esc,ic=App.icon,NB='\u00A0';
function T(){return App.today()}
function mod(m){return App.db.settings.modules[m]!==false}
function hasRoute(id){return !!App.routes[id]}
function plan(n,a,b,c){return n+NB+U.plural(n,a,b,c)}
function cname(id){var c=App.client(id);return c?c.n:'Без імені'}
function sname(id){var s=App.staff(id);return s?s.short:'—'}
function stamp(){return T()+'T'+U.hm(D.nowMin()).padStart(5,'0')}
function sel(name,val,opts,attrs){return '<select class="sel" name="'+name+'" '+(attrs||'')+'>'+opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(val)?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select>'}
function delta(cur,prev,inv){ /* HTML-дельта до попереднього періоду */
  if(prev==null||!isFinite(prev))return '';if(!prev)return cur?'<span class="sy-dl up">нове</span>':'';
  var p=Math.round((cur-prev)/Math.abs(prev)*100);if(p===0)return '<span class="sy-dl">без змін</span>';
  var good=inv?p<0:p>0;return '<span class="sy-dl '+(good?'up':'down')+'">'+(p>0?'+':'−')+Math.abs(p)+'%</span>'}

/* ═════════════ ЖУРНАЛ ДІЙ ═════════════ */
var ACT={create:['Створення','ok'],edit:['Зміна','plain'],move:['Перенос','new'],status:['Статус','new'],delete:['Видалення','dng'],checkout:['Оплата','done'],refund:['Повернення','dng'],pay:['Платіж','done'],cash:['Каса','warn'],close:['Закриття дня','warn'],payout:['Виплата','warn'],sale:['Продаж','ok'],stock:['Склад','plain'],settings:['Налаштування','plain'],login:['Вхід','plain'],merge:['Обʼєднання','plain'],import:['Імпорт','ok'],export:['Експорт','plain']};
function entInfo(ent){
  if(!ent)return null;var p=ent.split(':'),k=p[0],id=p.slice(1).join(':');
  if(k==='appt'&&App.appt(id))return {fn:function(){App.openAppt(id)}};
  if(k==='client'&&App.client(id))return {fn:function(){App.openClient(id)}};
  if(k==='staff'&&App.staff(id))return {fn:function(){App.openStaff(id)}};
  if(k==='exp'&&hasRoute('expenses'))return {fn:function(){App.go('expenses')}};
  if(k==='cert'&&hasRoute('certs'))return {fn:function(){App.go('certs')}};
  if(k==='abon'&&hasRoute('certs'))return {fn:function(){App.go('certs')}};
  if(k==='prod'&&hasRoute('products'))return {fn:function(){App.go('products')}};
  if(k==='tasks'&&hasRoute('tasks'))return {fn:function(){App.go('tasks')}};
  if(k==='reviews'&&hasRoute('reviews'))return {fn:function(){App.go('reviews')}};
  return null}
var AUD_PAGE=80;
App.route('audit',{title:'Журнал дій',icon:'log',nav:true,group:'sys',order:31,perm:'audit.view',render:function(v,params,q){
  var all=App.db.audit.map(function(e,i){return Object.assign({_i:i},e)}).sort(function(a,b){return a.ts<b.ts?1:a.ts>b.ts?-1:b._i-a._i});
  var shown=+q.n||AUD_PAGE;
  var whoSet={};all.forEach(function(e){whoSet[e.who]=1});
  var actSet={};all.forEach(function(e){actSet[e.act]=1});
  var per=q.p||'all',fl=[];
  function filtered(){
    var s=(q.q||'').toLowerCase().trim(),T0=T(),from=per==='today'?T0:per==='7'?D.add(T0,-6):per==='30'?D.add(T0,-29):'';
    return all.filter(function(e){return (!q.who||e.who===q.who)&&(!q.act||e.act===q.act)&&(!from||e.ts.slice(0,10)>=from)&&(!s||(e.txt||'').toLowerCase().indexOf(s)>=0||sname(e.who).toLowerCase().indexOf(s)>=0)})}
  App.setTop('<button class="btn" data-sy="audit-csv">'+ic('download')+'<span class="d-only">CSV</span></button>');
  v.innerHTML='<div class="page narrow sy-page"><div class="page-h"><div><h2>Журнал дій</h2><p>Хто, що і коли змінив у системі — записи, оплати, налаштування. Нічого не стирається.</p></div></div>'+
   '<div class="sy-filters"><div class="inp-ic sy-grow">'+ic('search')+'<input class="inp" id="sy-aq" placeholder="Пошук за текстом або іменем" value="'+esc(q.q||'')+'" autocomplete="off"></div>'+
   sel('who',q.who||'',[['','Усі співробітники']].concat(Object.keys(whoSet).map(function(k){return [k,sname(k)]})),'data-q="who"')+
   sel('act',q.act||'',[['','Усі дії']].concat(Object.keys(actSet).map(function(k){return [k,(ACT[k]||[k])[0]]})),'data-q="act"')+
   sel('p',per,[['all','За весь час'],['today','Сьогодні'],['7','7 днів'],['30','30 днів']],'data-q="p"')+'</div>'+
   '<div id="sy-alist"></div></div>';
  function draw(){
    fl=filtered();var box=U.$('#sy-alist',v);if(!box)return;
    if(!fl.length){box.innerHTML=UI.empty('log','Нічого не знайдено','Змініть фільтри або пошуковий запит.');return}
    var h='',last='';
    fl.slice(0,shown).forEach(function(e,i){
      var d=e.ts.slice(0,10),a=ACT[e.act]||[e.act,'plain'],info=entInfo(e.ent);
      if(d!==last){last=d;h+=(i?'</div>':'')+'<h3 class="sy-day">'+(d===T()?'Сьогодні':D.human(d,{wd:true}))+'</h3><div class="list sy-alog">'}
      var s=App.staff(e.who);
      h+='<div class="li sy-au'+(info?' click':'')+'" '+(info?'data-ai="'+e._i+'"':'')+'>'+UI.av(s,'sm')+'<div class="t"><b class="sy-wrap">'+esc(e.txt||'')+'</b><small>'+esc(s?s.short:'Система')+' · '+e.ts.slice(11,16)+'</small></div><span class="badge plain '+a[1]+'">'+a[0]+'</span>'+(info?'<span class="d-only mute">'+ic('right','s')+'</span>':'')+'</div>'});
    h+='</div>';
    if(fl.length>shown)h+='<div class="sy-more"><button class="btn" data-sy="more">Показати ще ('+(fl.length-shown)+')</button></div>';
    h+='<div class="foot-note"><span>Показано '+Math.min(shown,fl.length)+' з '+fl.length+'</span></div>';
    box.innerHTML=h}
  draw();
  var qi=U.$('#sy-aq',v);qi.oninput=U.debounce(function(){q.q=qi.value;history.replaceState(null,'',location.hash.split('?')[0]+(qi.value?'?q='+encodeURIComponent(qi.value):''));draw()},120);
  v.onchange=function(e){var s=e.target.closest('[data-q]');if(s){var o={};o[s.dataset.q]=s.value;o.n='';App.setQ(o,true)}};
  v.onclick=function(e){
    var b=e.target.closest('[data-sy]');
    if(b&&b.dataset.sy==='more'){shown+=AUD_PAGE;draw();return}
    if(b&&b.dataset.sy==='audit-csv'){U.download('audit-'+T()+'.csv',U.csv([['Дата','Час','Хто','Дія','Обʼєкт','Опис']].concat(fl.map(function(e){return [e.ts.slice(0,10),e.ts.slice(11,16),sname(e.who),(ACT[e.act]||[e.act])[0],e.ent,e.txt]}))),'text/csv;charset=utf-8');return UI.toast('Журнал експортовано')}
    var r=e.target.closest('[data-ai]');if(r){var en=all.find(function(x){return x._i===+r.dataset.ai});var inf=en&&entInfo(en.ent);inf&&inf.fn()}};
}});

/* ═════════════ ВІДГУКИ ═════════════ */
function stars(n,cls){var s='';for(var i=1;i<=5;i++)s+='<span class="sy-st'+(i<=n?' on':'')+'">'+ic('star','s')+'</span>';return '<span class="sy-stars '+(cls||'')+'" aria-label="'+n+' з 5">'+s+'</span>'}
function unanswered(){return App.db.reviews.filter(function(r){return !r.reply&&!r.hidden}).length}
var SRC_R={google:'Google',tg:'Telegram',ig:'Instagram',fb:'Facebook'};
var REPLY_T=['Дякуємо за теплий відгук! Чекаємо на вас знову.','Дякуємо, що поділилися. Нам дуже приємно!','Перепрошуємо за незручності. Зателефонуємо вам, щоб все виправити.'];
App.route('reviews',{title:'Відгуки',icon:'star',nav:true,group:'salon',order:25,module:'reviews',perm:'reviews.view',count:unanswered,render:function(v,params,q){
  var db=App.db,all=db.reviews.slice().sort(function(a,b){return a.date<b.date?1:-1});
  var vis=all.filter(function(r){return !r.hidden});
  var avg=vis.length?U.sum(vis,function(r){return r.rating})/vis.length:0;
  var dist=[5,4,3,2,1].map(function(n){return vis.filter(function(r){return r.rating===n}).length});
  var f=q.f||'all';
  var list=all.filter(function(r){
    if(q.staff&&r.staff!==q.staff)return false;if(q.r&&String(r.rating)!==q.r)return false;
    if(f==='open')return !r.reply&&!r.hidden;if(f==='done')return !!r.reply&&!r.hidden;if(f==='hidden')return r.hidden;return true});
  var cnt={all:all.length,open:all.filter(function(r){return !r.reply&&!r.hidden}).length,done:all.filter(function(r){return r.reply&&!r.hidden}).length,hidden:all.filter(function(r){return r.hidden}).length};
  var byM=App.masters(true).map(function(s){var rs=vis.filter(function(r){return r.staff===s.id});return {s:s,n:rs.length,avg:rs.length?U.sum(rs,function(r){return r.rating})/rs.length:0}}).filter(function(x){return x.n});
  function reviewCard(r){
    var c=App.client(r.client),s=App.staff(r.staff);
    return '<article class="card sy-rv'+(r.hidden?' hid':'')+'" data-id="'+r.id+'"><div class="row g12">'+UI.av(c,'')+'<div class="t sy-grow"><b>'+(c?'<a class="sy-lk" data-sy="client" data-id="'+c.id+'">'+esc(c.n)+'</a>':'Анонімно')+'</b><small class="mute">'+D.human(r.date)+' · '+(SRC_R[r.src]||r.src||'')+(s?' · майстер '+esc(s.short):'')+'</small></div>'+stars(r.rating)+'</div>'+
    '<p class="sy-rv-t">'+esc(r.text)+'</p>'+
    (r.reply?'<div class="sy-reply">'+ic('msg','s')+'<div><b>Відповідь салону</b><p>'+esc(r.reply)+'</p></div></div>':'')+
    '<div class="sy-rv-act" data-act-box>'+(r.hidden?'<span class="badge plain">Приховано</span>':'')+'<span class="sp"></span>'+
    '<button class="btn sm" data-sy="reply" data-id="'+r.id+'">'+ic('msg','s')+' '+(r.reply?'Змінити відповідь':'Відповісти')+'</button>'+
    '<button class="btn sm ghost" data-sy="hide" data-id="'+r.id+'">'+ic(r.hidden?'eye':'ban','s')+' '+(r.hidden?'Показати':'Приховати')+'</button></div></article>'}
  App.setTop('');
  v.innerHTML='<div class="page narrow sy-page"><div class="page-h"><div><h2>Відгуки</h2><p>Відповідайте клієнтам від імені салону. Приховані відгуки не враховуються в рейтингу.</p></div></div>'+
   '<div class="card sy-rv-sum"><div class="sy-rv-avg"><b>'+(avg?U.pct(avg).replace('%',''):'—')+'</b>'+stars(Math.round(avg))+'<small>'+plan(vis.length,'відгук','відгуки','відгуків')+'</small></div>'+
   '<div class="sy-rv-dist">'+dist.map(function(c,i){var n=5-i;return '<button class="sy-dist-r" data-sy="rate" data-r="'+n+'" aria-pressed="'+(q.r===String(n))+'"><span>'+n+NB+ic('star','s')+'</span><div class="bar-h"><i style="width:'+(vis.length?Math.round(c/vis.length*100):0)+'%"></i></div><em>'+c+'</em></button>'}).join('')+'</div>'+
   (byM.length?'<div class="sy-rv-m">'+byM.map(function(x){return '<div class="sy-rv-mr">'+UI.av(x.s,'xs')+'<span class="ell">'+esc(x.s.short)+'</span><b>'+U.pct(x.avg).replace('%','')+'</b><small>('+x.n+')</small></div>'}).join('')+'</div>':'')+'</div>'+
   '<div class="sy-filters"><div class="chips scroll">'+[['all','Усі'],['open','Без відповіді'],['done','З відповіддю'],['hidden','Приховані']].map(function(c){return '<button class="chip" aria-pressed="'+(f===c[0])+'" data-sy="f" data-f="'+c[0]+'">'+c[1]+' <span class="cnt">'+cnt[c[0]]+'</span></button>'}).join('')+'</div>'+
   '<span class="sp d-only"></span>'+sel('staff',q.staff||'',[['','Усі майстри']].concat(App.masters(true).map(function(s){return [s.id,s.short]})),'data-q="staff"')+
   sel('r',q.r||'',[['','Будь-яка оцінка'],['5','5 зірок'],['4','4 зірки'],['3','3 зірки'],['2','2 зірки'],['1','1 зірка']],'data-q="r"')+'</div>'+
   '<div class="col-f g12" id="sy-rvl">'+(list.length?list.map(reviewCard).join(''):UI.empty('star','Відгуків немає','За цим фільтром нічого не знайдено.'))+'</div></div>';
  v.onchange=function(e){var s=e.target.closest('[data-q]');if(s){var o={};o[s.dataset.q]=s.value;App.setQ(o,true)}};
  v.onclick=function(e){
    var b=e.target.closest('[data-sy]');if(!b)return;var k=b.dataset.sy,id=b.dataset.id;
    if(k==='f')return App.setQ({f:b.dataset.f==='all'?'':b.dataset.f},true);
    if(k==='rate')return App.setQ({r:q.r===b.dataset.r?'':b.dataset.r},true);
    if(k==='client')return App.openClient(id);
    var rv=db.reviews.find(function(x){return x.id===id});
    if(k==='hide'){var nv=!rv.hidden;App.ops.upsert('reviews',{id:id,hidden:nv},(nv?'Приховано':'Показано')+' відгук');App.refresh();return UI.toast(nv?'Відгук приховано':'Відгук знову видно',{undo:function(){App.ops.upsert('reviews',{id:id,hidden:!nv},'Скасовано');App.refresh()}})}
    if(k==='reply'){var art=b.closest('.sy-rv'),box=art.querySelector('[data-act-box]');
      box.outerHTML='<div class="sy-rbox"><textarea class="ta" id="sy-rt" placeholder="Ваша відповідь клієнту…">'+esc(rv.reply||'')+'</textarea><div class="chips">'+REPLY_T.map(function(t,i){return '<button class="chip" data-sy="tpl" data-i="'+i+'">'+esc(t.slice(0,28))+'…</button>'}).join('')+'</div><div class="row"><span class="sp"></span><button class="btn" data-sy="rcancel">Скасувати</button><button class="btn pri" data-sy="rsend" data-id="'+id+'">Надіслати</button></div></div>';
      var ta=art.querySelector('#sy-rt');ta.focus();return}
    if(k==='tpl'){var t=U.$('#sy-rt',v);t.value=REPLY_T[+b.dataset.i];t.focus();return}
    if(k==='rcancel')return App.refresh();
    if(k==='rsend'){var val=U.$('#sy-rt',v).value.trim();if(!val){U.$('#sy-rt',v).classList.add('err');return}
      App.ops.upsert('reviews',{id:id,reply:val,repliedAt:stamp()},'Відповідь на відгук: '+cname(rv.client));App.refresh();UI.toast('Відповідь збережено')}};
}});

/* ═════════════ CMD+K ═════════════ */
var RKEY='slotly-cmdk-recent';
function recent(){try{return JSON.parse(localStorage.getItem(RKEY)||'[]')}catch(e){return []}}
function pushRecent(it){var r=recent().filter(function(x){return x.k!==it.k});r.unshift({k:it.k,t:it.title,s:it.sub||'',ic:it.ic,type:it.type});try{localStorage.setItem(RKEY,JSON.stringify(r.slice(0,6)))}catch(e){}}
function norm(s){return String(s||'').toLowerCase().replace(/ʼ|'|’/g,"'")}
function parseDate(q){
  var m=q.match(/(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?/);
  if(m&&+m[2]>=1&&+m[2]<=12&&+m[1]>=1&&+m[1]<=31){var y=m[3]?(m[3].length===2?2000+ +m[3]:+m[3]):+T().slice(0,4);return y+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0')}
  m=norm(q).match(/^(\d{1,2})\s+([а-яіїє]+)$/);if(m){var mi=D.MON.findIndex(function(x){return norm(x).indexOf(m[2].slice(0,4))===0});if(mi>=0)return +T().slice(0,4)+'-'+String(mi+1).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0')}
  return null}
function gotoDate(date){var d=date||T();if(hasRoute('calendar'))App.go('calendar',{d:d,v:'day'});else UI.toast('Календар ще в роботі',{type:'err'})}
function dateModal(){UI.modal({title:'Перейти на дату',size:'narrow',body:'<label class="fld"><span>Дата</span><input class="inp" type="date" id="sy-gd" value="'+T()+'"></label>',foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Перейти</button>',onMount:function(el,close){el.querySelector('[data-no]').onclick=close;el.querySelector('[data-ok]').onclick=function(){var d=el.querySelector('#sy-gd').value;close();gotoDate(d||T())}}})}
function cmdItems(qs){
  var q=norm(qs).trim(),qd=q.replace(/\D/g,''),me=App.me(),T0=T();
  var pages=App.navItems().map(function(r){return {type:'page',k:'page:'+r.id,ic:r.icon,title:r.title,sub:'Розділ',fn:function(){App.go(r.id)}}});
  var acts=[];
  if(me.role!=='accountant')acts.push({type:'act',k:'act:newappt',ic:'plus',title:'Новий запис',sub:'Дія',kw:'запис записати створити',fn:function(){App.newAppt({})}});
  if(App.can('clients.*')||App.can('clients.view'))acts.push({type:'act',k:'act:newclient',ic:'user',title:'Новий клієнт',sub:'Дія',kw:'клієнт додати створити',fn:function(){UI.clientForm({},function(){})}});
  if(mod('certs')&&App.can('certs.*'))acts.push({type:'act',k:'act:cert',ic:'gift',title:'Продати сертифікат',sub:'Дія',kw:'сертифікат подарунковий',fn:function(){App.sellCert({})}});
  if(App.can('expenses.add')||App.can('expenses.*'))acts.push({type:'act',k:'act:exp',ic:'receipt',title:'Додати витрату',sub:'Дія',kw:'витрата витрати',fn:function(){App.addExpense()}});
  if(mod('tasks')&&(App.can('tasks.*')||App.can('tasks.own')))acts.push({type:'act',k:'act:task',ic:'task',title:'Нова задача',sub:'Дія',kw:'задача',fn:function(){App.taskForm()}});
  acts.push({type:'act',k:'act:date',ic:'cal',title:'Перейти на дату…',sub:'Дія',kw:'дата календар перейти',fn:dateModal});
  function match(it){if(!q)return 1;var t=norm(it.title+' '+(it.kw||''));if(t.indexOf(q)===0)return 3;if((' '+t).indexOf(' '+q)>=0)return 2;if(t.indexOf(q)>=0)return 1;return 0}
  if(!q){
    var out0=[],rc=recent();if(rc.length)out0.push({group:'Нещодавні',list:rc.map(function(r){return {type:r.type,k:r.k,ic:r.ic,title:r.t,sub:r.s}})});
    out0.push({group:'Дії',list:acts});out0.push({group:'Розділи',list:pages.slice(0,7)});return out0}
  var out=[],pd=parseDate(q);
  if(pd)out.push({group:'Дата',list:[{type:'act',k:'date:'+pd,ic:'cal',title:'Календар на '+D.human(pd,{wd:true}),sub:'Перейти на дату',fn:function(){gotoDate(pd)}}]});
  var as=acts.map(function(x){return {x:x,s:match(x)}}).filter(function(z){return z.s}).sort(function(a,b){return b.s-a.s}).map(function(z){return z.x});if(as.length)out.push({group:'Дії',list:as});
  if(App.can('clients.*')||App.can('clients.view')||App.can('clients.own')){
    var own=!(App.can('clients.*')||App.can('clients.view')),ownSet=null;
    if(own){ownSet={};App.db.appts.forEach(function(a){if(a.staff===me.id)ownSet[a.client]=1})}
    var cs=[];App.db.clients.forEach(function(c){if(ownSet&&!ownSet[c.id])return;var n=norm(c.n),sc=0;
      if(n.indexOf(q)===0)sc=4;else if(n.split(' ').some(function(w){return w.indexOf(q)===0}))sc=3;else if(n.indexOf(q)>=0)sc=2;else if(qd.length>=3&&c.ph&&c.ph.indexOf(qd)>=0)sc=2;
      if(sc)cs.push({c:c,sc:sc})});
    cs.sort(function(a,b){return b.sc-a.sc||a.c.n.localeCompare(b.c.n)});
    if(cs.length)out.push({group:'Клієнти',list:cs.slice(0,6).map(function(x){var st=App.clientStats(x.c.id);return {type:'client',k:'client:'+x.c.id,av:x.c,title:x.c.n,sub:(x.c.ph?U.phone(x.c.ph)+' · ':'')+plan(st.visits,'візит','візити','візитів'),fn:function(){App.openClient(x.c.id)}}})});
    var ap=App.db.appts.filter(function(a){return a.date>=T0&&a.status!=='cancelled'&&(!own||a.staff===me.id)&&a.client&&norm(cname(a.client)).indexOf(q)>=0}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:a.start-b.start}).slice(0,4);
    if(ap.length)out.push({group:'Записи',list:ap.map(function(a){return {type:'appt',k:'appt:'+a.id,ic:'cal',title:cname(a.client)+' · '+D.rel(a.date)+' '+U.hm(a.start),sub:App.apptTitle(a)+' · '+sname(a.staff),fn:function(){App.openAppt(a.id)}}})})}
  var ps=pages.filter(match);if(ps.length)out.push({group:'Розділи',list:ps});
  return out}
App.cmdk=function(){
  if(U.$('.cmdk'))return;
  return UI.modal({title:'Пошук',body:'<div class="q">'+ic('search','l')+'<input id="sy-cq" placeholder="Клієнт, телефон, розділ або дія…" autocomplete="off"><kbd>Esc</kbd></div><div class="res" id="sy-cr"></div>',
   onMount:function(el,close){
     el.classList.add('cmdk');el.querySelector('.modal-h').style.display='none';el.querySelector('.modal-b').style.padding='0';
     var inp=el.querySelector('#sy-cq'),res=el.querySelector('#sy-cr'),flat=[],cur=0;
     setTimeout(function(){inp.focus()},20);
     function sync(){U.$$('.it',res).forEach(function(b,i){b.setAttribute('aria-selected',i===cur)})}
     function draw(){
       var gs=cmdItems(inp.value);flat=[];var h='';
       gs.forEach(function(g){h+='<div class="grp">'+g.group+'</div>';g.list.forEach(function(it){var i=flat.length;flat.push(it);
         h+='<button class="it" data-i="'+i+'" aria-selected="'+(i===cur)+'">'+(it.av?UI.av(it.av,'sm'):'<span class="sy-cic">'+ic(it.ic||'search')+'</span>')+'<span class="sy-ct"><b class="ell">'+esc(it.title)+'</b>'+(it.sub?'<small class="ell">'+esc(it.sub)+'</small>':'')+'</span></button>'})});
       if(!flat.length)h='<div class="sy-cempty">Нічого не знайдено за «'+esc(inp.value)+'»</div>';
       res.innerHTML=h}
     function run(it){if(!it)return;pushRecent(it);close();
       if(it.fn)return setTimeout(it.fn,10);
       var p=it.k.split(':'),t=p[0],id=p.slice(1).join(':');
       if(t==='page')App.go(id);else if(t==='client')App.openClient(id);else if(t==='appt')App.openAppt(id);
       else{var all=[].concat.apply([],cmdItems('').map(function(g){return g.list}));var f=all.find(function(x){return x.k===it.k&&x.fn});if(f)setTimeout(f.fn,10)}}
     function move(d){if(!flat.length)return;cur=(cur+d+flat.length)%flat.length;sync();var s=res.querySelector('[aria-selected=true]');if(s)s.scrollIntoView({block:'nearest'})}
     inp.oninput=function(){cur=0;draw()};
     inp.onkeydown=function(e){if(e.key==='ArrowDown'){e.preventDefault();move(1)}else if(e.key==='ArrowUp'){e.preventDefault();move(-1)}else if(e.key==='Enter'){e.preventDefault();run(flat[cur])}};
     res.onclick=function(e){var b=e.target.closest('[data-i]');if(b)run(flat[+b.dataset.i])};
     res.onmousemove=function(e){var b=e.target.closest('[data-i]');if(b&&+b.dataset.i!==cur){cur=+b.dataset.i;sync()}};
     draw()}})};
App.actions.search=function(){App.cmdk()};

/* ═════════════ ЗВІТИ ═════════════ */
var P1=function(x){return (Math.round(x*10)/10).toString().replace('.',',')};
var _first=null,_firstN=-1;
function firstDone(){ /* перший завершений візит клієнта */
  if(_first&&_firstN===App.db.appts.length)return _first;
  _first={};App.db.appts.forEach(function(a){if(a.status==='done'&&a.client&&(!_first[a.client]||a.date<_first[a.client]))_first[a.client]=a.date});_firstN=App.db.appts.length;return _first}
function dataStart(){var m=T();App.db.appts.forEach(function(a){if(a.date<m)m=a.date});return m}
function periodOf(q,restricted){
  var T0=T(),k=q.p||(restricted?'today':'month'),f,t;
  if(k==='today'){f=t=T0}else if(k==='yday'){f=t=D.add(T0,-1)}
  else if(k==='week'){f=D.add(T0,-6);t=T0}else if(k==='quarter'){f=D.add(T0,-89);t=T0}
  else if(k==='custom'&&q.from&&q.to&&q.from<=q.to){f=q.from;t=q.to}
  else{k='month';f=D.add(T0,-29);t=T0}
  var len=D.diff(f,t)+1,pt=D.add(f,-1),pf=D.add(pt,-(len-1));
  var lab={today:'Сьогодні',yday:'Вчора',week:'7 днів',month:'30 днів',quarter:'90 днів',custom:D.human(f)+' — '+D.human(t)}[k];
  return {k:k,from:f,to:t,len:len,pf:pf,pt:pt,label:lab,full:D.human(f)+' — '+D.human(t)}}
/* завантаженість */
function loadRange(from,to,staffId){
  var cap=0,bk=0,db=App.db,ms=staffId?[App.staff(staffId)]:App.masters(true);
  for(var d=from;d<=to;d=D.add(d,1)){ms.forEach(function(s){if(!s)return;var w=App.workHours(s.id,d);if(!w)return;
    var c=w.end-w.start-(w.brk?w.brk[1]-w.brk[0]:0);var b=0;App.apptsOn(d,s.id).forEach(function(a){if(a.status!=='cancelled'&&a.status!=='noshow')b+=App.apptDur(a)});cap+=c;bk+=Math.min(b,c)})}
  return cap?Math.round(bk/cap*100):0}
function stats(from,to){
  var db=App.db,o=App.money(from,to),fd=firstDone(),s={from:from,to:to,o:o};
  var ap=db.appts.filter(function(a){return a.date>=from&&a.date<=to});
  s.done=ap.filter(function(a){return a.status==='done'});
  s.ns=ap.filter(function(a){return a.status==='noshow'}).length;
  s.cancelled=ap.filter(function(a){return a.status==='cancelled'}).length;
  s.rev=o.revenue;s.visits=o.visits;s.avg=o.avgCheck;s.exp=o.expenses;
  s.nsPct=s.done.length+s.ns?s.ns/(s.done.length+s.ns)*100:0;
  s.pay=App.masters(true).map(function(m){return App.payroll(m.id,from,to)});
  s.payCost=U.sum(s.pay,function(p){return p.total-p.tips});
  s.fees=0;db.pay.forEach(function(m){if(m.feePct&&o.byMethod[m.id])s.fees+=o.byMethod[m.id]*m.feePct/100});s.fees=Math.round(s.fees);
  s.profit=s.rev-s.exp-s.payCost-s.fees;
  var ids={};s.done.forEach(function(a){if(a.client)ids[a.client]=1});s.clientIds=Object.keys(ids);
  s.retN=s.clientIds.filter(function(c){return fd[c]&&fd[c]<from}).length;
  s.retPct=s.clientIds.length?s.retN/s.clientIds.length*100:0;
  s.newC=db.clients.filter(function(c){return c.created>=from&&c.created<=to}).length;
  s.load=loadRange(from,to);
  s.days=[];for(var d=from;d<=to;d=D.add(d,1))s.days.push(d);
  var byD=App.money;s.daily=s.days.map(function(d){return App.money(d,d).revenue});
  return s}
function svcStats(from,to){
  var m={};
  App.db.appts.forEach(function(a){if(a.status!=='done'||a.date<from||a.date>to)return;var g=U.sum(a.items,function(x){return x.price}),disc=App.apptDiscount(a);
    a.items.forEach(function(x){var sv=App.svc(x.svc),r=m[x.svc]=m[x.svc]||{id:x.svc,n:sv?sv.n:x.svc,rev:0,cnt:0,cost:0};
      r.rev+=x.price-(g?disc*x.price/g:0);r.cnt++;r.cost+=sv&&sv.cost||0})});
  return m}
function rebook(staffId,from,to){ /* % клієнтів майстра, що мають майбутній/наступний запис */
  var seen={},n=0,yes=0;
  App.db.appts.forEach(function(a){if(a.staff!==staffId||a.status!=='done'||a.date<from||a.date>to||!a.client||seen[a.client])return;seen[a.client]=1;n++;
    var has=App.db.appts.some(function(b){return b.client===a.client&&b.id!==a.id&&b.status!=='cancelled'&&b.status!=='noshow'&&(b.date>a.date||(b.date===a.date&&b.start>a.start))});if(has)yes++});
  return n?yes/n*100:0}
function avgRating(staffId){var rs=App.db.reviews.filter(function(r){return !r.hidden&&(!staffId||r.staff===staffId)});return rs.length?U.sum(rs,function(r){return r.rating})/rs.length:0}
function clientsLost(days){var T0=T();return App.db.clients.filter(function(c){if(c.blocked)return false;var st=App.clientStats(c.id);return st.visits>0&&!st.next&&st.daysSince>=days}).map(function(c){return {c:c,st:App.clientStats(c.id)}}).sort(function(a,b){return b.st.spent-a.st.spent})}

/* таблиця (desktop) + картки (mobile) */
function rtable(head,rows,o){
  o=o||{};var t='<div class="tbl-wrap d-only"><table class="tbl"><thead><tr>'+head.map(function(h,i){return '<th class="'+(i?'r':'')+'">'+h+'</th>'}).join('')+'</tr></thead><tbody>'+
   rows.map(function(r){return '<tr>'+r.map(function(c,i){return '<td class="'+(i?'r num':'')+'">'+c+'</td>'}).join('')+'</tr>'}).join('')+'</tbody>'+(o.foot?'<tfoot><tr>'+o.foot.map(function(c,i){return '<td class="'+(i?'r num':'')+'">'+c+'</td>'}).join('')+'</tr></tfoot>':'')+'</table></div>';
  t+='<div class="m-only sy-mcards">'+rows.map(function(r){return '<div class="sy-mcard"><div class="h"><b class="ell">'+r[0]+'</b><span>'+r[1]+'</span></div><div class="g">'+r.slice(2).map(function(c,i){return '<span><small>'+head[i+2]+'</small>'+c+'</span>'}).join('')+'</div></div>'}).join('')+
   (o.foot?'<div class="sy-mcard tot"><div class="h"><b>'+o.foot[0]+'</b><span>'+o.foot[1]+'</span></div></div>':'')+'</div>';
  return t}
function kpi(l,v,d){return '<div class="kpi"><div class="l">'+l+'</div><div class="v">'+v+'</div><div class="d">'+(d||'&nbsp;')+'</div></div>'}
function cmp(cur,prev,P,inv,fmtf){ /* підпис «vs попередній період» */
  if(!P||!P.cmp)return '';return delta(cur,prev,inv)+(prev!=null?' <span class="sy-prev">було '+(fmtf?fmtf(prev):U.fmt(prev))+'</span>':'')}

/* ── вкладки ── */
function tabOverview(S,Pv,P,restricted){
  var o=S.o,pc=P.cmp?Pv:null,pm=Object.keys(o.byMethod).map(function(k){return {id:k,v:o.byMethod[k]}}).filter(function(x){return x.v>0}).sort(function(a,b){return b.v-a.v}),pmT=U.sum(pm,function(x){return x.v});
  var labs=S.days.map(function(d){return S.days.length>31?d.slice(8)+'.'+d.slice(5,7):d.slice(8)});
  var hl=S.days.indexOf(T());
  var h='<div class="kpis sy-kpis">'+
   kpi('Виторг',U.uah(S.rev),pc&&cmp(S.rev,pc.rev,P,0,U.uah))+
   kpi('Візити',U.fmt(S.visits),pc&&cmp(S.visits,pc.visits,P))+
   kpi('Середній чек',U.uah(S.avg),pc&&cmp(S.avg,pc.avg,P,0,U.uah))+
   kpi('Прибуток',U.uah(S.profit),pc&&cmp(S.profit,pc.profit,P,0,U.uah))+
   kpi('Нові клієнти',U.fmt(S.newC),pc&&cmp(S.newC,pc.newC,P))+
   kpi('Повернення клієнтів',P1(S.retPct)+'%',pc&&cmp(S.retPct,pc.retPct,P,0,function(x){return P1(x)+'%'}))+
   kpi('Завантаженість',S.load+'%',pc&&cmp(S.load,pc.load,P,0,function(x){return x+'%'}))+
   kpi('Неявки',P1(S.nsPct)+'%',pc&&cmp(S.nsPct,pc.nsPct,P,1,function(x){return P1(x)+'%'}))+'</div>';
  h+='<div class="sy-grid"><div class="card"><h3>Виторг по днях <span class="sp"></span><span class="mute sy-sm">'+U.uah(S.rev)+'</span></h3><div class="sy-chart">'+UI.bars(S.daily,{labels:labs,hl:hl>=0?hl:null,fmt:U.uah,h:150})+'</div></div>'+
   '<div class="card"><h3>Способи оплати</h3>'+(pm.length?pm.map(function(x){var m=App.payMethod(x.id);return '<div class="sy-pm"><span>'+ic(m.ic||'coins','s')+' '+esc(m.n)+'</span><b>'+U.uah(x.v)+'</b><div class="bar-h"><i style="width:'+Math.round(x.v/pmT*100)+'%"></i></div><em>'+Math.round(x.v/pmT*100)+'%</em></div>'}).join(''):'<div class="mute">Платежів за період немає</div>')+'</div></div>';
  if(!restricted)h+='<div class="card sy-profit"><h3>Як складається прибуток</h3><div class="sy-pl">'+
    '<div><small>Виторг</small><b>'+U.uah(S.rev)+'</b></div><span>−</span><div><small>Витрати</small><b>'+U.uah(S.exp)+'</b></div><span>−</span><div><small>Зарплати</small><b>'+U.uah(S.payCost)+'</b></div><span>−</span><div><small>Комісії еквайрингу</small><b>'+U.uah(S.fees)+'</b></div><span>=</span><div class="res"><small>Прибуток</small><b>'+U.uah(S.profit)+'</b></div></div></div>';
  return h}
function tabMasters(S,Pv,P){
  var rows=App.masters(true).map(function(m,i){var pr=S.pay[i],ds=S.done.filter(function(a){return a.staff===m.id}),rev=U.sum(ds,function(a){return App.apptTotal(a)}),rt=avgRating(m.id);
    return {m:m,v:ds.length,rev:rev,avg:ds.length?rev/ds.length:0,load:loadRange(S.from,S.to,m.id),rb:rebook(m.id,S.from,S.to),rt:rt,pay:pr.total-pr.tips}}).sort(function(a,b){return b.rev-a.rev});
  var mx=rows.length?rows[0].rev:1,T0=rows.reduce(function(a,r){a.v+=r.v;a.rev+=r.rev;a.pay+=r.pay;return a},{v:0,rev:0,pay:0});
  var h='<div class="card sy-rank"><h3>Виторг за майстрами</h3>'+rows.map(function(r){return '<div class="sy-rk">'+UI.av(r.m,'sm')+'<span class="ell">'+esc(r.m.short)+'</span><div class="bar-h"><i style="width:'+Math.round(r.rev/(mx||1)*100)+'%"></i></div><b>'+U.uah(r.rev)+'</b></div>'}).join('')+'</div>';
  h+=rtable(['Майстер','Виторг','Візити','Сер. чек','Завант.','Повторні','Рейтинг','Зарплата'],rows.map(function(r){return [esc(r.m.short),U.uah(r.rev),r.v,U.uah(r.avg),r.load+'%',Math.round(r.rb)+'%',r.rt?P1(r.rt):'—',U.uah(r.pay)]}),{foot:['Разом',U.uah(T0.rev),T0.v,U.uah(T0.v?T0.rev/T0.v:0),S.load+'%','','',U.uah(T0.pay)]});
  h+='<p class="sy-hint">«Повторні» — частка клієнтів майстра, які вже записані на наступний візит. Зарплата — нарахування за період без чайових.</p>';
  return h}
function tabServices(S,Pv,P){
  var cur=svcStats(S.from,S.to),pv=P.cmp?svcStats(P.pf,P.pt):null;
  var rows=Object.keys(cur).map(function(k){return cur[k]}).sort(function(a,b){return b.rev-a.rev});
  var tot=U.sum(rows,function(r){return r.rev}),mx=rows.length?rows[0].rev:1;
  if(!rows.length)return UI.empty('scissors','Немає даних','За вибраний період немає завершених візитів.');
  var h='<div class="card sy-rank"><h3>Топ послуг за виторгом</h3>'+rows.slice(0,8).map(function(r){return '<div class="sy-rk"><span class="ell sy-rkn">'+esc(r.n)+'</span><div class="bar-h"><i style="width:'+Math.round(r.rev/mx*100)+'%"></i></div><b>'+U.uah(r.rev)+'</b></div>'}).join('')+'</div>';
  h+=rtable(['Послуга','Виторг','Візити','Сер. ціна','Маржа','Частка','Динаміка'],rows.map(function(r){var mg=r.rev-r.cost,pr=pv&&pv[r.id];
    return [esc(r.n),U.uah(r.rev),r.cnt,U.uah(r.rev/r.cnt),Math.round(r.rev?mg/r.rev*100:0)+'%',Math.round(tot?r.rev/tot*100:0)+'%',pv?delta(r.rev,pr?pr.rev:0):'—']}),{foot:['Разом',U.uah(tot),U.sum(rows,function(r){return r.cnt}),'','','100%','']});
  h+='<p class="sy-hint">Маржа = ціна мінус собівартість матеріалів (задається в картці послуги). Динаміка порівнює виторг з попереднім періодом.</p>';
  return h}
function tabClients(S,Pv,P){
  var h='<div class="kpis sy-kpis4">'+kpi('Унікальних клієнтів',U.fmt(S.clientIds.length))+kpi('Нових',U.fmt(S.newC),P.cmp?cmp(S.newC,Pv.newC,P):'')+kpi('Повернулись',U.fmt(S.retN),P1(S.retPct)+'% від усіх')+kpi('Пішли (60+ днів)',U.fmt(clientsLost(60).length),'без запису наперед')+'</div>';
  /* когорти по місяцях */
  var fd=firstDone(),T0=T(),months=[];for(var i=3;i>=0;i--){months.push(D.monthStart(D.addMonths(T0,-i)))}
  var coh=months.map(function(ms){var me=D.monthEnd(ms);var first=Object.keys(fd).filter(function(c){return fd[c]>=ms&&fd[c]<=me});
    var cells=[0,1,2,3].map(function(k){var ms2=D.monthStart(D.addMonths(ms,k)),me2=D.monthEnd(ms2);if(ms2>T0)return null;
      var back=first.filter(function(c){return App.db.appts.some(function(a){return a.client===c&&a.status==='done'&&a.date>=ms2&&a.date<=me2&&a.date>fd[c]})}).length;return first.length?Math.round(back/first.length*100):0});
    return {ms:ms,n:first.length,cells:cells}});
  h+='<div class="card flush sy-coh"><div class="card-h"><b>Утримання клієнтів по місяцях</b></div><div class="sy-cohw"><table class="tbl"><thead><tr><th>Перший візит</th><th class="r">Клієнтів</th><th class="r">Місяць 0</th><th class="r">+1</th><th class="r">+2</th><th class="r">+3</th></tr></thead><tbody>'+
   coh.map(function(r){return '<tr><td>'+D.MONN[+r.ms.slice(5,7)-1]+'</td><td class="r num">'+r.n+'</td>'+r.cells.map(function(c){return '<td class="r num">'+(c==null?'<span class="faint">—</span>':'<span class="sy-heat" style="--a:'+(c/100)+'">'+c+'%</span>')}).join('')+'</tr>'}).join('')+'</tbody></table></div></div>';
  h+='<p class="sy-hint">Частка клієнтів, які вперше прийшли в місяці зліва і повернулись у відповідному місяці. «Місяць 0» — повторний візит у той самий місяць.</p>';
  /* джерела */
  var by=U.groupBy(S.done.filter(function(a){return a.client}),function(a){var c=App.client(a.client);return c&&c.src||'walkin'}),srcMap=Object.assign({friend:'За рекомендацією'},App.SRC);
  var sr=Object.keys(by).map(function(k){return {k:k,n:by[k].length,rev:U.sum(by[k],function(a){return App.apptTotal(a)}),c:new Set(by[k].map(function(a){return a.client})).size}}).sort(function(a,b){return b.rev-a.rev}),srT=U.sum(sr,function(x){return x.rev}),srM=sr.length?sr[0].rev:1;
  h+='<div class="card sy-rank"><h3>Звідки приходять клієнти</h3>'+sr.map(function(x){return '<div class="sy-rk"><span class="ell sy-rkn">'+esc(srcMap[x.k]||x.k)+'</span><div class="bar-h"><i style="width:'+Math.round(x.rev/srM*100)+'%"></i></div><b>'+U.uah(x.rev)+'</b><small class="mute">'+x.c+' кл.</small></div>'}).join('')+'</div>';
  var lost=clientsLost(60);
  h+='<div class="card flush"><div class="card-h"><b>Пішли: не були 60+ днів і не записані</b><span class="sp"></span><span class="mute sy-sm">'+lost.length+'</span></div>'+(lost.length?lost.slice(0,8).map(function(x){return '<button class="li" data-sy="client" data-id="'+x.c.id+'">'+UI.av(x.c,'sm')+'<span class="t"><b>'+esc(x.c.n)+'</b><small>'+plan(x.st.daysSince,'день','дні','днів')+' тому · '+plan(x.st.visits,'візит','візити','візитів')+' · '+U.uah(x.st.spent)+'</small></span>'+ic('right','s')+'</button>'}).join(''):'<div class="sy-pad mute">Втрачених клієнтів немає</div>')+'</div>';
  return h}
function plRows(S){
  var o=S.o,acc=App.db.settings.accounting,cats=App.db.expCats,exps=App.db.expenses.filter(function(e){return e.date>=S.from&&e.date<=S.to});
  var rv=[['Послуги',o.services],['Продаж товарів',o.products],['Абонементи (продаж)',o.abonSales]];
  if(acc.certRevenue==='sale')rv.push(['Сертифікати (продаж)',o.certSales]);
  if(o.refunds)rv.push(['Повернення коштів',o.refunds]);
  var ex=cats.map(function(c){return [c.n,U.sum(exps.filter(function(e){return e.cat===c.id}),function(e){return e.amount})]}).filter(function(x){return x[1]});
  return {rev:rv.filter(function(x){return x[1]||x[0]==='Послуги'}),ex:ex}}
function tabFinance(S,Pv,P){
  var o=S.o,pl=plRows(S),acc=App.db.settings.accounting;
  function blk(title,rows,total,cls){return '<div class="card"><h3>'+title+'</h3>'+rows.map(function(r){return '<div class="sumrow"><span>'+esc(r[0])+'</span><b>'+U.uah(r[1])+'</b></div>'}).join('')+'<div class="sumrow tot"><span>Разом</span><span>'+U.uah(total)+'</span></div></div>'}
  var h='<div class="sy-grid">'+blk('Доходи',pl.rev,S.rev)+
   '<div class="card"><h3>Витрати</h3>'+pl.ex.map(function(r){return '<div class="sumrow"><span>'+esc(r[0])+'</span><b>'+U.uah(r[1])+'</b></div>'}).join('')+
   '<div class="sumrow"><span>Зарплати майстрів</span><b>'+U.uah(S.payCost)+'</b></div><div class="sumrow"><span>Комісії еквайрингу</span><b>'+U.uah(S.fees)+'</b></div>'+
   '<div class="sumrow tot"><span>Разом</span><span>'+U.uah(S.exp+S.payCost+S.fees)+'</span></div></div></div>';
  h+='<div class="card sy-profit"><div class="sumrow tot" style="border:0;margin:0;padding:0"><span>Прибуток за період</span><span class="'+(S.profit<0?'dng-t':'ok-t')+'">'+U.uah(S.profit)+'</span></div><div class="mute sy-sm" style="margin-top:6px">Рентабельність '+(S.rev?P1(S.profit/S.rev*100):'0')+'%'+(P.cmp?' · '+delta(S.profit,Pv.profit)+' до попереднього періоду':'')+'</div></div>';
  h+='<div class="card"><h3>Поза виторгом</h3><div class="sumrow"><span>Чайові (йдуть майстрам)</span><b>'+U.uah(o.tips)+'</b></div>'+(acc.certRevenue==='redeem'?'<div class="sumrow"><span>Продано сертифікатів (ще не використані)</span><b>'+U.uah(o.certSales)+'</b></div>':'<div class="sumrow"><span>Сертифікатів використано (вже в виторгу)</span><b>'+U.uah(o.certRedeemed)+'</b></div>')+'<div class="sumrow"><span>Передоплати (враховано в послугах)</span><b>'+U.uah(o.deposits)+'</b></div></div>';
  return h}
function csvFor(tab,S,Pv,P){
  var rows=[];
  if(tab==='finance'){var pl=plRows(S);rows=[['Стаття','Сума, грн']].concat(pl.rev.map(function(r){return ['Дохід: '+r[0],Math.round(r[1])]}),[['Дохід разом',Math.round(S.rev)]],pl.ex.map(function(r){return ['Витрата: '+r[0],Math.round(r[1])]}),[['Зарплати',S.payCost],['Комісії еквайрингу',S.fees],['Прибуток',S.profit]])}
  else if(tab==='masters'){rows=[['Майстер','Візити','Виторг','Сер.чек','Завантаженість %','Зарплата']].concat(App.masters(true).map(function(m,i){var ds=S.done.filter(function(a){return a.staff===m.id}),rev=U.sum(ds,function(a){return App.apptTotal(a)});return [m.n,ds.length,Math.round(rev),ds.length?Math.round(rev/ds.length):0,loadRange(S.from,S.to,m.id),S.pay[i].total-S.pay[i].tips]}))}
  else if(tab==='services'){var c=svcStats(S.from,S.to);rows=[['Послуга','Візити','Виторг','Собівартість']].concat(Object.keys(c).map(function(k){return [c[k].n,c[k].cnt,Math.round(c[k].rev),Math.round(c[k].cost)]}))}
  else if(tab==='clients'){rows=[['Клієнт','Телефон','Візитів','Днів без візиту','Витрачено']].concat(clientsLost(60).map(function(x){return [x.c.n,x.c.ph,x.st.visits,x.st.daysSince,Math.round(x.st.spent)]}))}
  else rows=[['Дата','Виторг, грн']].concat(S.days.map(function(d,i){return [d,Math.round(S.daily[i])]}));
  return rows}

/* ── AI-помічник (локальні детерміновані відповіді) ── */
var AI_CHIPS=['Який виторг за місяць?','Хто найбільше заробив?','Які послуги падають?','Скільки неявок за тиждень?','Кого повернути?'];
function aiPeriod(t,P){
  var T0=T();
  if(/сьогодні/.test(t))return {from:T0,to:T0,l:'сьогодні'};if(/вчора/.test(t))return {from:D.add(T0,-1),to:D.add(T0,-1),l:'вчора'};
  if(/тиж/.test(t))return {from:D.add(T0,-6),to:T0,l:'за 7 днів'};if(/квартал|90/.test(t))return {from:D.add(T0,-89),to:T0,l:'за 90 днів'};
  if(/минул\S* місяц/.test(t))return {from:D.monthStart(D.addMonths(T0,-1)),to:D.monthEnd(D.addMonths(T0,-1)),l:'за минулий місяць'};
  if(/місяц/.test(t))return {from:D.add(T0,-29),to:T0,l:'за 30 днів'};
  return {from:P.from,to:P.to,l:'за вибраний період ('+P.label.toLowerCase()+')'}}
function aiAnswer(text,P){
  var t=norm(text),pr=aiPeriod(t,P),len=D.diff(pr.from,pr.to)+1,pf=D.add(pr.from,-len),pt=D.add(pr.from,-1),S=stats(pr.from,pr.to),h='';
  function b(x){return '<b>'+x+'</b>'}
  if(/неяв|не прийш/.test(t)){var Sp=stats(pf,pt);
    var by=U.groupBy(App.db.appts.filter(function(a){return a.status==='noshow'&&a.date>=pr.from&&a.date<=pr.to}),function(a){return a.staff}),top=Object.keys(by).sort(function(a,b2){return by[b2].length-by[a].length})[0];
    var lost=U.sum(App.db.appts.filter(function(a){return a.status==='noshow'&&a.date>=pr.from&&a.date<=pr.to}),function(a){return App.apptTotal(a)});
    return '<p>'+pr.l.replace(/^./,function(c){return c.toUpperCase()})+': '+b(plan(S.ns,'неявка','неявки','неявок'))+' ('+P1(S.nsPct)+'% від усіх візитів). '+(Sp.ns||S.ns?'Раніше було '+Sp.ns+' ('+P1(Sp.nsPct)+'%).':'')+'</p>'+(S.ns?'<p>Не отримано приблизно '+b(U.uah(lost))+'.'+(top?' Найбільше неявок у майстра '+b(esc(sname(top)))+' ('+by[top].length+').':'')+'</p><p class="mute">Порада: увімкніть передоплату для нових клієнтів у Налаштування → Передоплата.</p>':'<p class="mute">Чудово — без неявок.</p>')}
  if(/верн|пішл|втрат|відтік|давно не|повернути/.test(t)){var l=clientsLost(60);
    return '<p>Клієнтів, які не були 60+ днів і не записані: '+b(l.length)+'. Найцінніші для повернення (за сумою витрат):</p><ul>'+l.slice(0,5).map(function(x){return '<li><a class="sy-lk" data-sy="client" data-id="'+x.c.id+'">'+esc(x.c.n)+'</a> — '+U.uah(x.st.spent)+', '+x.st.daysSince+' '+U.plural(x.st.daysSince,'день','дні','днів')+' без візиту</li>'}).join('')+'</ul>'+(l.length?'<p class="mute">Відкрийте картку клієнта, щоб записати його або надіслати нагадування.</p>':'')}
  if(/падаю|просід|зменш|гірш|знизил|спад|впал/.test(t)){var c=svcStats(pr.from,pr.to),p=svcStats(pf,pt),dec=Object.keys(p).map(function(k){var cu=c[k]?c[k].rev:0;return {n:p[k].n,cur:cu,prev:p[k].rev,d:p[k].rev?(cu-p[k].rev)/p[k].rev*100:0}}).filter(function(x){return x.d<-5&&x.prev>=1500}).sort(function(a,b2){return (a.cur-a.prev)-(b2.cur-b2.prev)}).slice(0,5);
    return dec.length?'<p>Послуги, виторг яких впав '+pr.l+' порівняно з попереднім періодом:</p><ul>'+dec.map(function(x){return '<li>'+b(esc(x.n))+': '+U.uah(x.cur)+' проти '+U.uah(x.prev)+' ('+Math.round(x.d)+'%)</li>'}).join('')+'</ul>':'<p>Суттєвого падіння послуг '+pr.l+' не видно — виторг за послугами не знизився більш ніж на 5%.</p>'}
  if(/(хто|майстр)/.test(t)&&/(заробив|виторг|найбільше|топ|кращ)/.test(t)||/майстр/.test(t)){
    var rows=App.masters(true).map(function(m){var ds=S.done.filter(function(a){return a.staff===m.id});return {m:m,v:ds.length,rev:U.sum(ds,function(a){return App.apptTotal(a)})}}).sort(function(a,b2){return b2.rev-a.rev}).filter(function(r){return r.v});
    return rows.length?'<p>Лідер '+pr.l+' — '+b(esc(rows[0].m.n))+': '+b(U.uah(rows[0].rev))+' за '+plan(rows[0].v,'візит','візити','візитів')+'.</p><ul>'+rows.map(function(r,i){return '<li>'+(i+1)+'. '+esc(r.m.short)+' — '+U.uah(r.rev)+' ('+Math.round(S.rev?r.rev/S.rev*100:0)+'%)</li>'}).join('')+'</ul>':'<p>Завершених візитів за цей період немає.</p>'}
  if(/послуг|популяр|топ/.test(t)){var cs=svcStats(pr.from,pr.to),r2=Object.keys(cs).map(function(k){return cs[k]}).sort(function(a,b2){return b2.rev-a.rev}).slice(0,5);
    return r2.length?'<p>Топ послуг '+pr.l+' за виторгом:</p><ul>'+r2.map(function(x,i){return '<li>'+(i+1)+'. '+esc(x.n)+' — '+U.uah(x.rev)+', '+x.cnt+' раз.</li>'}).join('')+'</ul>':'<p>Даних немає.</p>'}
  if(/чек/.test(t)){var Sp2=stats(pf,pt);return '<p>Середній чек '+pr.l+': '+b(U.uah(S.avg))+' '+delta(S.avg,Sp2.avg)+' <span class="mute">(було '+U.uah(Sp2.avg)+')</span>.</p>'}
  if(/нов\S*\s+клієнт|клієнт\S*\s+нов|приплив|залучен/.test(t)){var Sp3=stats(pf,pt);return '<p>Нових клієнтів '+pr.l+': '+b(S.newC)+' '+delta(S.newC,Sp3.newC)+' <span class="mute">(було '+Sp3.newC+')</span>. Повернення: '+P1(S.retPct)+'% клієнтів вже були у вас раніше.</p>'}
  if(/завантаж|заповн/.test(t)){return '<p>Завантаженість майстрів '+pr.l+': '+b(S.load+'%')+'.</p><ul>'+App.masters(true).map(function(m){return '<li>'+esc(m.short)+' — '+loadRange(pr.from,pr.to,m.id)+'%</li>'}).join('')+'</ul>'}
  if(/прибут|маржа|рентаб/.test(t)){return '<p>Прибуток '+pr.l+': '+b(U.uah(S.profit))+' = виторг '+U.uah(S.rev)+' − витрати '+U.uah(S.exp)+' − зарплати '+U.uah(S.payCost)+' − комісії '+U.uah(S.fees)+'.</p>'}
  if(/витрат|розхід|витрач/.test(t)){var ex=plRows(S).ex.sort(function(a,b2){return b2[1]-a[1]});return '<p>Витрати '+pr.l+': '+b(U.uah(S.exp))+'. Найбільші статті: '+ex.slice(0,3).map(function(x){return esc(x[0])+' '+U.uah(x[1])}).join(', ')+'.</p>'}
  if(/виторг|дохід|оборот|заробив|гроші|продаж|виручк/.test(t)){var Sp4=stats(pf,pt);return '<p>Виторг '+pr.l+': '+b(U.uah(S.rev))+' '+delta(S.rev,Sp4.rev)+' <span class="mute">(попередній період: '+U.uah(Sp4.rev)+')</span>. Візитів: '+S.visits+', середній чек '+U.uah(S.avg)+'.</p>'}
  return '<p>Поки не розумію це питання. Я відповідаю на питання про виторг, прибуток, витрати, майстрів, послуги, неявки, нових клієнтів, завантаженість та кого повернути. Спробуйте одне з прикладів нижче.</p>'}

App.route('reports',{title:'Звіти',icon:'chart',nav:true,group:'money',order:13,perm:'reports.view',permAlt:'reports.day',render:function(v,params,q){
  var restricted=!App.can('reports.view');
  var P=periodOf(q,restricted);if(restricted){P=periodOf({p:q.p==='yday'?'yday':'today'},true)}
  P.cmp=q.cmp!=='0';
  var tabs=restricted?[['overview','Огляд']]:[['overview','Огляд'],['masters','Майстри'],['services','Послуги'],['clients','Клієнти'],['finance','Фінанси']];
  var tab=tabs.some(function(x){return x[0]===q.tab})?q.tab:'overview';
  var S=stats(P.from,P.to),Pv=P.cmp?stats(P.pf,P.pt):null;
  var ds=dataStart(),warn=P.cmp&&P.pf<ds;
  App.setTop('<button class="btn" data-sy="rep-csv">'+ic('download')+'<span class="d-only">CSV</span></button>');
  var body=tab==='masters'?tabMasters(S,Pv,P):tab==='services'?tabServices(S,Pv,P):tab==='clients'?tabClients(S,Pv,P):tab==='finance'?tabFinance(S,Pv,P):tabOverview(S,Pv,P,restricted);
  var perSeg=restricted?[['today','Сьогодні'],['yday','Вчора']]:[['week','Тиждень'],['month','Місяць'],['quarter','Квартал'],['custom','Період']];
  v.innerHTML='<div class="page sy-page"><div class="page-h"><div><h2>Звіти</h2><p>'+(restricted?'Підсумки дня':'Аналітика салону')+' · '+esc(P.full)+'</p></div></div>'+
   '<div class="sy-bar"><div class="seg">'+perSeg.map(function(s){return '<button data-sy="per" data-p="'+s[0]+'" aria-pressed="'+(P.k===s[0])+'">'+s[1]+'</button>'}).join('')+'</div>'+
   (P.k==='custom'?'<div class="sy-custom"><input class="inp" type="date" id="sy-df" value="'+P.from+'" max="'+T()+'"><span class="mute">—</span><input class="inp" type="date" id="sy-dt" value="'+P.to+'" max="'+T()+'"></div>':'')+
   '<span class="sp"></span><label class="check sy-cmp"><input type="checkbox" id="sy-cmp"'+(P.cmp?' checked':'')+'> Порівняти з попереднім періодом</label></div>'+
   (warn&&!restricted?'<div class="note warn sy-note">'+ic('info','s')+'<span>Попередній період частково виходить за межі даних демо ('+D.human(ds)+'), тому порівняння занижене.</span></div>':'')+
   (restricted?'':'<div class="card sy-ai"><h3>'+ic('spark','s')+' AI-помічник <span class="sp"></span><span class="badge plain">локально, без інтернету</span></h3><form id="sy-aif" class="sy-aiform"><input class="inp" id="sy-aiq" placeholder="Запитайте про виторг, майстрів, послуги, неявки…" autocomplete="off"><button class="btn pri" type="submit">Запитати</button></form><div class="chips">'+AI_CHIPS.map(function(c){return '<button class="chip" data-sy="chip">'+c+'</button>'}).join('')+'</div><div class="sy-ans" id="sy-ans" hidden></div></div>')+
   (tabs.length>1?'<div class="tabs">'+tabs.map(function(t){return '<button data-sy="tab" data-t="'+t[0]+'" aria-selected="'+(tab===t[0])+'">'+t[1]+'</button>'}).join('')+'</div>':'')+
   '<div class="sy-tab">'+body+'</div></div>';
  function ask(text){if(!text.trim())return;var a=U.$('#sy-ans',v);a.hidden=false;a.innerHTML='<div class="sy-qq">'+esc(text)+'</div><div class="sy-aa">'+aiAnswer(text,P)+'</div>'}
  var form=U.$('#sy-aif',v);if(form)form.onsubmit=function(e){e.preventDefault();ask(U.$('#sy-aiq',v).value)};
  v.onchange=function(e){
    if(e.target.id==='sy-cmp')return App.setQ({cmp:e.target.checked?'':'0'},true);
    if(e.target.id==='sy-df'||e.target.id==='sy-dt'){var f=U.$('#sy-df',v).value,t=U.$('#sy-dt',v).value;if(f&&t&&f<=t)App.setQ({p:'custom',from:f,to:t},true)}};
  v.onclick=function(e){
    var b=e.target.closest('[data-sy]');if(!b)return;var k=b.dataset.sy;
    if(k==='per'){var p=b.dataset.p;if(p==='custom')return App.setQ({p:'custom',from:q.from||D.add(T(),-13),to:q.to||T()},true);return App.setQ({p:p,from:'',to:''},true)}
    if(k==='tab')return App.setQ({tab:b.dataset.t==='overview'?'':b.dataset.t},true);
    if(k==='client')return App.openClient(b.dataset.id);
    if(k==='chip'){U.$('#sy-aiq',v).value=b.textContent;ask(b.textContent);return}
    if(k==='rep-csv'){U.download('slotly-'+tab+'-'+P.from+'_'+P.to+'.csv',U.csv(csvFor(tab,S,Pv,P)),'text/csv;charset=utf-8');UI.toast('Звіт експортовано')}};
}});

/* ═════════════ НАЛАШТУВАННЯ ═════════════ */
var DEFAULT_PERMS=JSON.parse(JSON.stringify(App.PERMS));
function applyPerms(){var ov=(App.db&&App.db.settings&&App.db.settings.perms)||{};
  Object.keys(DEFAULT_PERMS).forEach(function(r){App.PERMS[r]=r==='owner'?'*':(ov[r]?ov[r].slice():DEFAULT_PERMS[r].slice())})}
App.on('boot',applyPerms);App.on('change',applyPerms);

function gp(path){var o=App.db,p=path.split('.');for(var i=0;i<p.length&&o!=null;i++)o=o[p[i]];return o}
function t2(m){var h=Math.floor(m/60),mm=m%60;return (h<10?'0':'')+h+':'+(mm<10?'0':'')+mm}
function row(title,hint,ctl,cls){return '<div class="set-row'+(cls?' '+cls:'')+'"><div class="t"><b>'+title+'</b>'+(hint?'<small>'+hint+'</small>':'')+'</div>'+ctl+'</div>'}
function tgl(path,label,hint,dis){var on=!!gp(path);return row(label,hint,'<label class="sw"><input type="checkbox" data-set="'+path+'" data-t="bool" data-l="'+esc(label)+'"'+(on?' checked':'')+(dis?' disabled':'')+'><i></i></label>')}
function num(path,label,hint,suf,o){o=o||{};var v=gp(path);return row(label,hint,'<div class="inp-suf sy-ctl"><input type="number" inputmode="decimal" data-set="'+path+'" data-t="num" data-l="'+esc(label)+'" value="'+(v==null?'':v)+'" min="'+(o.min!=null?o.min:0)+'"'+(o.max!=null?' max="'+o.max+'"':'')+(o.step?' step="'+o.step+'"':'')+'>'+(suf?'<span>'+suf+'</span>':'')+'</div>')}
function sl(path,label,hint,opts,o){var v=gp(path);return row(label,hint,'<select class="sel sy-ctl w" data-set="'+path+'" data-t="'+((o&&o.t)||'str')+'" data-l="'+esc(label)+'">'+opts.map(function(x){return '<option value="'+esc(x[0])+'"'+(String(x[0])===String(v)?' selected':'')+'>'+esc(x[1])+'</option>'}).join('')+'</select>','stack')}
function txt(path,label,hint,o){o=o||{};var v=gp(path);return row(label,hint,'<input class="inp sy-ctl w" data-set="'+path+'" data-t="str" data-l="'+esc(label)+'" value="'+esc(v||'')+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+(o.max?' maxlength="'+o.max+'"':'')+'>','stack')}
function noteBox(cls,t){return '<div class="note '+(cls||'')+' sy-note">'+ic('info','s')+'<span>'+t+'</span></div>'}

var WD_ORDER=[1,2,3,4,5,6,0];
var SECTIONS=[
 {id:'profile',t:'Профіль салону',ic:'door',d:'Назва, контакти, графік роботи',r:function(){var s=App.db.salon;
   return txt('salon.name','Назва салону','Показується у шапці, чеках та повідомленнях',{max:40})+txt('salon.addr','Адреса','',{ph:'вул., будинок'})+txt('salon.city','Місто','')+txt('salon.phone','Телефон','',{ph:'+380…'})+txt('salon.tg','Telegram','',{ph:'@нік'})+txt('salon.ig','Instagram','',{ph:'нік без @'})+txt('salon.site','Сайт','')+
   row('Логотип','Дві літери у кружечку замість картинки','<div class="row g12"><span class="sy-logo">'+esc(s.logo||'')+'</span><input class="inp sy-ctl" style="width:90px;text-transform:uppercase" maxlength="2" data-set="salon.logo" data-t="str" data-l="Логотип" value="'+esc(s.logo||'')+'"></div>')+
   '<h4 class="sy-h4">Години роботи</h4><div class="sy-hours">'+WD_ORDER.map(function(d){var h=s.hours[d];return '<div class="sy-hr" data-hrs="'+d+'"><label class="check"><input type="checkbox" data-h="on"'+(h?' checked':'')+'><b>'+D.WD[d]+'</b></label><div class="sy-hrt"'+(h?'':' style="visibility:hidden"')+'><input class="inp" type="time" data-h="s" value="'+t2(h?h[0]:540)+'"><span class="mute">—</span><input class="inp" type="time" data-h="e" value="'+t2(h?h[1]:1200)+'"></div>'+(h?'':'<span class="mute sy-off">Вихідний</span>')+'</div>'}).join('')+'</div>'}},
 {id:'booking',t:'Онлайн-запис',ic:'globe',d:'Правила для записів клієнтів',r:function(){
   return noteBox('','Це правила, за якими працюватиме сторінка онлайн-запису. Сама сторінка — окремий продукт Slotly; тут ви задаєте поведінку.')+
   sl('settings.booking.step','Крок сітки запису','Інтервал між слотами в календарі та онлайн-записі',[[5,'5 хв'],[10,'10 хв'],[15,'15 хв'],[20,'20 хв'],[30,'30 хв'],[60,'60 хв']],{t:'num'})+
   sl('settings.booking.minNotice','Мінімум до візиту','Запис «на зараз» заборонено ближче за цей час',[[0,'Без обмежень'],[30,'30 хв'],[60,'1 година'],[120,'2 години'],[240,'4 години'],[720,'12 годин'],[1440,'1 доба']],{t:'num'})+
   num('settings.booking.maxDays','Записувати наперед','Максимум днів від сьогодні','днів',{min:1,max:365})+
   num('settings.booking.cancelHours','Скасування без штрафу','Клієнт може скасувати або перенести не пізніше ніж за N годин','год',{min:0,max:168})+
   num('settings.booking.buffer','Перерва між візитами','Додається автоматично після кожної послуги','хв',{min:0,max:60})+
   tgl('settings.booking.allowAny','«Будь-який майстер»','Клієнт може не обирати майстра — система підбере вільного')+
   sl('settings.booking.confirmMode','Підтвердження запису','Автоматично — запис одразу в календарі. Вручну — спочатку статус «Новий»',[['auto','Автоматично'],['manual','Вручну адміністратором']])+
   tgl('settings.booking.needPhone','Телефон обовʼязковий','Без номера запис не створиться')}},
 {id:'deposit',t:'Передоплата',ic:'safe',d:'Захист від неявок',r:function(){var on=gp('settings.deposit.on');
   return (mod('deposits')?'':noteBox('warn','Модуль «Передоплата» вимкнено в розділі «Модулі». Налаштування збережуться, але не діятимуть.'))+
   tgl('settings.deposit.on','Передоплата','Клієнт вносить частину суми, щоб запис став підтвердженим')+
   (on?sl('settings.deposit.mode','Для кого','Ризикові — клієнти з неявками або без жодного візиту й з дорогою послугою',[['all','Усі клієнти'],['new','Тільки нові клієнти'],['risky','Тільки ризикові']])+
   num('settings.deposit.pct','Розмір передоплати','Відсоток від вартості записаних послуг','%',{min:5,max:100})+
   num('settings.deposit.minPrice','Від суми візиту','Для дешевших візитів передоплату не просимо','₴',{min:0})+
   num('settings.deposit.refundHours','Повернення передоплати','Якщо клієнт скасував не пізніше ніж за N годин — передоплата повертається','год',{min:0,max:168}):'')}},
 {id:'reminders',t:'Нагадування',ic:'bell',d:'Повідомлення клієнтам',r:function(){
   var ch=gp('settings.reminders.channel'),n=App.db.appts.filter(function(a){return a.date>=T()&&a.date<=D.add(T(),29)&&a.status!=='cancelled'}).length,r=gp('settings.reminders');
   var per=(r.h24?1:0)+(r.h2?1:0)+(r.afterVisit?1:0),msgs=n*per;
   return tgl('settings.reminders.h24','За 24 години до візиту','Клієнт може підтвердити або скасувати запис одним дотиком')+tgl('settings.reminders.h2','За 2 години до візиту','Коротке нагадування з адресою')+tgl('settings.reminders.afterVisit','Після візиту','Подяка та прохання залишити відгук')+
   num('settings.reminders.returnDays','Повернення клієнта','Нагадати, якщо клієнт не записався через N днів після візиту. 0 — вимкнено','днів',{min:0,max:365})+
   sl('settings.reminders.channel','Канал','',[['tg','Telegram'],['viber','Viber'],['sms','SMS']])+
   noteBox(ch==='sms'?'warn':'',ch==='sms'?'SMS платні: ≈ 1,3 ₴ за повідомлення. За найближчі 30 днів це приблизно <b>'+U.fmt(msgs)+'</b> повідомлень — ≈ <b>'+U.uah(Math.round(msgs*1.3))+'</b>.':'Telegram та Viber безкоштовні. Клієнти без месенджера отримають SMS (≈ 1,3 ₴) — лише якщо дали на це згоду.')}},
 {id:'noshow',t:'Неявки',ic:'ban',d:'Автоматичні відмітки та блокування',r:function(){
   return num('settings.noshow.markAfter','Позначати «Не прийшов» через','Якщо клієнт не відмічений як «Прийшов» після початку візиту','хв',{min:5,max:240})+
   num('settings.noshow.warnAt','Попереджати після','Адміністратор побачить мітку в картці клієнта','неявок',{min:1,max:10})+
   num('settings.noshow.blockAt','Блокувати онлайн-запис після','Клієнт у чорному списку записується тільки через адміністратора','неявок',{min:1,max:20})+
   (gp('settings.noshow.warnAt')>gp('settings.noshow.blockAt')?noteBox('warn','Поріг блокування менший за поріг попередження — спочатку клієнт буде заблокований, а попередження не покажемо.'):'')}},
 {id:'pay',t:'Способи оплати',ic:'card',d:'Готівка, картка, перекази',r:function(){
   return '<div class="list sy-paylist">'+App.db.pay.map(function(m){return '<div class="li"><span class="sy-cic">'+ic(m.ic||'coins')+'</span><div class="t"><b>'+esc(m.n)+'</b><small>'+({cash:'Готівка',card:'Картка'+(m.feePct?' · комісія '+P1(m.feePct)+'%':''),transfer:'Переказ'}[m.kind]||m.kind)+'</small></div><label class="sw"><input type="checkbox" data-sy="pay-on" data-id="'+m.id+'"'+(m.on!==false?' checked':'')+'><i></i></label><button class="icobtn sm" data-sy="pay-edit" data-id="'+m.id+'" aria-label="Редагувати">'+ic('edit')+'</button></div>'}).join('')+'</div>'+
   '<div class="sy-actions"><button class="btn" data-sy="pay-add">'+ic('plus')+' Додати спосіб</button></div>'+noteBox('','Вимкнений спосіб не показується в касі, але історія платежів зберігається. Комісія еквайрингу враховується в прибутку у звітах.')}},
 {id:'accounting',t:'Облік',ic:'receipt',d:'Сертифікати, чайові, каса',r:function(){var cr=gp('settings.accounting.certRevenue');
   return '<div class="set-row stack"><div class="t"><b>Коли сертифікат стає виторгом</b><small>Впливає на звіти та зарплату</small></div></div><div class="sy-radio">'+
   [['redeem','Коли клієнт ним розплатився','Рекомендовано. Продаж сертифіката — це лише гроші в касі (зобовʼязання перед клієнтом), виторг зʼявляється, коли послуга надана. Так податки і зарплата рахуються за реально виконану роботу.'],['sale','У день продажу','Простіше в обліку: виторг зараховується одразу. Мінус — гроші зараховані, а послуга ще не надана; при використанні сертифіката виторг вдруге не рахується.']].map(function(o){return '<label class="sy-opt'+(cr===o[0]?' on':'')+'"><input type="radio" name="certRev" data-set="settings.accounting.certRevenue" data-t="str" data-l="Виторг із сертифікатів" value="'+o[0]+'"'+(cr===o[0]?' checked':'')+'><span><b>'+o[1]+'</b><small>'+o[2]+'</small></span></label>'}).join('')+'</div>'+
   num('settings.accounting.tipsToMaster','Чайові майстру','Яка частина чайових іде майстру','%',{min:0,max:100})+
   tgl('settings.accounting.dayClose','Обовʼязкове закриття дня','Щодня звіряти готівку в касі з розрахунковою. Незакриті дні підсвічуються на «Сьогодні»')+
   sl('settings.accounting.roundTo','Округлення ціни','Підсумок візиту округлюється до',[[0,'Без округлення'],[1,'1 ₴'],[5,'5 ₴'],[10,'10 ₴']],{t:'num'})+
   row('Касовий апарат (ПРРО Checkbox)','Автоматичні фіскальні чеки при оплаті <span class="badge plain">скоро</span>','<label class="sw"><input type="checkbox" disabled><i></i></label>')}},
 {id:'payroll',t:'Зарплата',ic:'wallet',d:'Правила нарахування',r:function(){
   return sl('settings.payroll.period','Розрахунковий період','Як часто виплачуєте майстрам',[['week','Тиждень'],['half','Півмісяця'],['month','Місяць']])+
   sl('settings.payroll.basis','База для відсотка','Від якої суми майстер отримує відсоток',[['afterDiscount','Після знижки'],['beforeDiscount','До знижки']])+
   tgl('settings.payroll.certAsRevenue','Оплата сертифікатом входить у відсоток','Майстер отримує відсоток і з візитів, оплачених сертифікатом')+
   num('settings.payroll.productPctDefault','Відсоток із продажу товарів','За замовчуванням для нових майстрів','%',{min:0,max:100})+noteBox('','Індивідуальні відсотки та фіксовані ставки задаються в картці майстра («Команда»).')}},
 {id:'modules',t:'Модулі',ic:'layers',d:'Увімкніть тільки потрібне',r:function(){
   var M=[['certs','Сертифікати','Подарункові сертифікати: продаж, баланс, погашення'],['abons','Абонементи','Пакети процедур зі знижкою'],['products','Товари','Склад і продаж косметики'],['tasks','Задачі','Список справ для команди'],['reviews','Відгуки','Збір та відповіді на відгуки'],['resources','Ресурси','Столи, крісла, кабінети — запис займає ресурс'],['deposits','Передоплата','Облік передоплат і їх повернень'],['waitlist','Лист очікування','Клієнти, які чекають вільного місця']];
   return M.map(function(m){return tgl('settings.modules.'+m[0],m[1],m[2])}).join('')+'<p class="sy-hint">Вимкнені модулі зникають із меню; дані не видаляються.</p>'}},
 {id:'roles',t:'Ролі та доступ',ic:'key',d:'Хто що бачить і може',r:function(){return rolesHtml()}},
 {id:'alert',t:'Режим тривоги',ic:'siren',d:'Повітряна тривога в області',r:function(){var a=gp('settings.alert');
   var regs=['Вінницька область','Волинська область','Дніпропетровська область','Донецька область','Житомирська область','Закарпатська область','Запорізька область','Івано-Франківська область','Київська область','Кіровоградська область','Луганська область','Львівська область','Миколаївська область','Одеська область','Полтавська область','Рівненська область','Сумська область','Тернопільська область','Харківська область','Херсонська область','Хмельницька область','Черкаська область','Чернівецька область','Чернігівська область','м. Київ'];
   return (a.on?'<div class="note dng sy-note">'+ic('siren','s')+'<span><b>Триває тривога.</b> '+(a.mode==='pause'?'Онлайн-запис призупинено.':'Клієнти бачать попередження про тривогу.')+'</span><button class="btn sm" data-sy="alert-off">Відбій</button></div>':'')+
   tgl('settings.alert.on','Режим тривоги','Вмикається вручну або автоматично за даними сповіщень вашої області')+
   sl('settings.alert.region','Область','Звідки брати сигнали',regs.map(function(r){return [r,r]}))+
   sl('settings.alert.mode','Що робити під час тривоги','Призупинити — онлайн-запис недоступний, чинні записи не змінюються. Попереджати — клієнт бачить повідомлення, але може записатись',[['pause','Призупинити онлайн-запис'],['notify','Лише попереджати']])+
   '<div class="sy-actions"><button class="btn'+(a.on?'':' dng')+'" data-sy="alert-sim">'+ic('siren')+' '+(a.on?'Відбій тривоги':'Симулювати тривогу')+'</button></div>'}},
 {id:'offline',t:'Офлайн-режим',ic:'wifioff',d:'Робота без інтернету',r:function(){var off=gp('settings.offline');
   return (off?'<div class="note warn sy-note">'+ic('wifioff','s')+'<span><b>Немає звʼязку.</b> Зміни зберігаються на пристрої.</span><button class="btn sm" data-sy="off-sim">Відновити</button></div>':'')+
   '<div class="card sy-expl"><b>Що відбувається без інтернету</b><ul><li>Календар, картки клієнтів і каса працюють — дані зберігаються на пристрої.</li><li>Усі зміни позначаються й автоматично синхронізуються, коли зʼявиться звʼязок.</li><li>Нагадування клієнтам та онлайн-запис відновляться після підключення.</li><li>У верхній панелі зʼявиться жовтий індикатор «Офлайн».</li></ul></div>'+
   '<div class="sy-actions"><button class="btn" data-sy="off-sim">'+ic('wifioff')+' '+(off?'Відновити звʼязок':'Симулювати офлайн')+'</button></div>'}},
 {id:'data',t:'Дані та імпорт',ic:'download',d:'Експорт, імпорт, скидання демо',r:function(){var db=App.db;
   return row('Експорт усіх даних','Повна копія в JSON — клієнти, записи, платежі, налаштування','<button class="btn" data-sy="exp-json">'+ic('download')+' JSON</button>')+
   row('Клієнти','CSV для Excel · '+U.fmt(db.clients.length),'<button class="btn" data-sy="exp-clients">'+ic('download')+' CSV</button>')+
   row('Записи','CSV · '+U.fmt(db.appts.length),'<button class="btn" data-sy="exp-appts">'+ic('download')+' CSV</button>')+
   row('Платежі','CSV · '+U.fmt(db.payments.length),'<button class="btn" data-sy="exp-pays">'+ic('download')+' CSV</button>')+
   '<h4 class="sy-h4">Імпорт клієнтів</h4>'+row('З Altegio, DIKIDI, Excel','Завантажте CSV або вставте таблицю — перед імпортом ви побачите, які колонки куди підуть','<button class="btn pri" data-sy="imp">'+ic('upload')+' Імпортувати</button>')+
   '<h4 class="sy-h4">Демо</h4>'+row('Скинути демо-дані','Усі зміни буде втрачено, повернуться стартові дані','<button class="btn dng" data-sy="reset">'+ic('undo')+' Скинути</button>')}},
 {id:'plan',t:'Тариф',ic:'zap',d:'Салон · 449 ₴/міс',r:function(){var db=App.db,nm=db.staff.filter(function(s){return s.role==='master'&&s.active}).length;
   var PL=[['Старт','0',['1 майстер','Календар і клієнти','До 100 клієнтів'],1,100],['Соло','199',['До 2 майстрів','Нагадування в Telegram','Базові звіти'],2,0],['Салон','449',['До 10 майстрів','Усі модулі','Передоплата, зарплата, звіти'],10,0],['Мережа','999',['Необмежено майстрів','Кілька філій','Пріоритетна підтримка'],99,0]];
   return '<div class="card sy-usage"><h3>Використання</h3><div class="sy-use"><div><small>Майстри</small><b>'+nm+' <em>з 10</em></b><div class="bar-h"><i style="width:'+Math.min(100,nm*10)+'%"></i></div></div><div><small>Клієнти</small><b>'+U.fmt(db.clients.length)+' <em>без ліміту</em></b></div><div><small>Записів за 30 днів</small><b>'+U.fmt(db.appts.filter(function(a){return a.date>=D.add(T(),-29)&&a.date<=T()}).length)+'</b></div></div></div>'+
   '<div class="sy-plans">'+PL.map(function(p){var cur=p[0]==='Салон';return '<div class="card sy-plan'+(cur?' cur':'')+'"><b>'+p[0]+'</b><div class="pr">'+p[1]+' <small>₴/міс</small></div><ul>'+p[2].map(function(x){return '<li>'+ic('check','s')+x+'</li>'}).join('')+'</ul>'+(cur?'<span class="badge ok">Ваш тариф</span>':'<button class="btn blk" data-sy="plan">Обрати</button>')+'</div>'}).join('')+'</div>'+
   '<p class="sy-hint">У демо тариф лише відображається. Оплата та перехід між тарифами працюватимуть у робочій версії.</p>'}}
];
/* ролі */
var PERM_ROWS=[['Дашборд «Сьогодні»','home'],['Календар: усі записи','calendar.*'],['Календар: лише свої','calendar.own'],['Клієнти: усі','clients.*'],['Клієнти: лише свої','clients.own'],['Прийом оплати візиту','checkout'],['Каса: перегляд','cash.view'],['Каса: операції','cash.ops'],['Витрати: додавати','expenses.add'],['Витрати: повний доступ','expenses.*'],['Сертифікати: керування','certs.*'],['Сертифікати: перегляд','certs.view'],['Абонементи: керування','abons.*'],['Абонементи: перегляд','abons.view'],['Товари: продаж','products.sell'],['Товари: перегляд','products.view'],['Задачі: усі','tasks.*'],['Задачі: лише свої','tasks.own'],['Відгуки','reviews.*'],['Графіки: усі','schedules.*'],['Графік: лише свій','schedules.own'],['Послуги: перегляд','services.view'],['Команда: перегляд','team.view'],['Зарплата: усі','payroll.*'],['Зарплата: лише своя','payroll.own'],['Звіти: повні','reports.*'],['Звіти: підсумки дня','reports.day'],['Журнал дій','audit.view']];
var ROLE_COLS=[['owner','Власн.'],['admin','Адмін'],['master','Майстер'],['accountant','Бухг.']];
function permOn(role,perm){var a=App.PERMS[role];if(a==='*')return {on:true,locked:true};if(a.indexOf(perm)>=0)return {on:true};var m=perm.split('.')[0];if(perm.indexOf('.')>0&&perm!==m+'.*'&&a.indexOf(m+'.*')>=0)return {on:true,derived:true};return {on:false}}
function rolesHtml(){
  var h=noteBox('','Налаштуйте, що бачать і можуть адміністратор, майстер і бухгалтер. Власник має повний доступ завжди. «Усі» включає «лише свої».')+
   '<div class="card flush sy-roles"><div class="sy-rrow hd"><span>Можливість</span>'+ROLE_COLS.map(function(c){return '<span>'+c[1]+'</span>'}).join('')+'</div>';
  PERM_ROWS.forEach(function(p){h+='<div class="sy-rrow"><span>'+p[0]+'</span>'+ROLE_COLS.map(function(c){var s=permOn(c[0],p[1]),dis=s.locked||s.derived;
    return '<label class="sy-rc" title="'+(s.locked?'Власник має повний доступ':s.derived?'Дозволено через «'+p[1].split('.')[0]+'.*»':c[1])+'"><input type="checkbox" data-sy="perm" data-role="'+c[0]+'" data-perm="'+p[1]+'"'+(s.on?' checked':'')+(dis?' disabled':'')+' aria-label="'+esc(p[0]+' — '+c[1])+'"></label>'}).join('')+'</div>'});
  return h+'</div><div class="sy-actions"><button class="btn" data-sy="perm-reset">Скинути до стандартних</button></div>'}
function setPerm(role,perm,on){
  var cur=App.PERMS[role].slice(),i=cur.indexOf(perm);
  if(on&&i<0)cur.push(perm);if(!on&&i>=0)cur.splice(i,1);
  /* «усі» прибрали → лишаємо немає; «усі» додали → видаляємо «лише свої» не потрібно */
  var all=JSON.parse(JSON.stringify(App.db.settings.perms||{}));all[role]=cur;
  App.ops.set('settings.perms',all,'Права ролі «'+App.ROLES[role].n+'»: '+(on?'+':'−')+' '+perm);applyPerms()}

/* імпорт */
function parseCSV(text){
  text=text.replace(/^\uFEFF/,'');var first=text.split(/\r?\n/)[0]||'';
  var cands=[';','\t',','],del=cands.sort(function(a,b){return first.split(b).length-first.split(a).length})[0];
  var rows=[],r=[],c='',q=false;
  for(var i=0;i<text.length;i++){var ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){c+='"';i++}else q=false}else c+=ch}
    else if(ch==='"')q=true;else if(ch===del){r.push(c);c=''}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;r.push(c);c='';if(r.some(function(x){return x.trim()}))rows.push(r);r=[]}else c+=ch}
  r.push(c);if(r.some(function(x){return x.trim()}))rows.push(r);return rows}
function normPhone(p){var d=String(p||'').replace(/\D/g,'');if(d.length===12&&d.indexOf('380')===0)return d;if(d.length===11&&d[0]==='8')return '3'+d;if(d.length===10&&d[0]==='0')return '38'+d;if(d.length===9)return '380'+d;return d.length>=10?d:''}
function normDate(s){s=String(s||'').trim();var m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[0]:''}
var IMP_F=[['name','Імʼя / ПІБ',/^(імʼя|имя|імя|клієнт|клиент|name|піб|фио|ф\.?и\.?о|full)/],['last','Прізвище (окремо)',/^(прізвище|фамилия|surname|last)/],['phone','Телефон',/(телефон|phone|тел|моб|mobile)/],['bd','День народження',/(народж|рожд|birth|bd|дн\b)/],['note','Нотатка',/(коментар|комментар|нотат|примітк|заметк|note|comment)/]];
App.ops.importClients=function(list,src){var n=0,db=App.db,have={};db.clients.forEach(function(c){if(c.ph)have[c.ph]=1});
  list.forEach(function(x){if(x.ph&&have[x.ph])return;var c={id:U.uid('c'),n:x.n,male:false,ph:x.ph,tg:false,bd:x.bd||'',tags:[],note:x.note||'',src:'walkin',created:T(),blocked:false,consent:{sms:true,promo:false},gender:'f',fav:null,vipManual:false};db.clients.push(c);if(x.ph)have[x.ph]=1;n++});
  App.log('import','','Імпорт клієнтів ('+(src||'CSV')+'): додано '+n+', пропущено дублікатів '+(list.length-n));App.save();return n};
var SAMPLE="Імʼя;Телефон;Дата народження;Коментар\nАнна Мельник;067 111 22 33;14.03.1991;Любить каву без цукру\nОксана Бондар;+380 50 222 33 44;;Алергія на акрил\nІгор Петренко;0931112233;02.11.1988;\nДарʼя Поліщук;380674089668;;(вже є в базі)";
function importModal(){
  var st={rows:[],map:{}};
  UI.modal({title:'Імпорт клієнтів',sub:'Altegio, DIKIDI, Excel — будь-який CSV',size:'wide',body:
   '<div class="sy-imp"><div class="sy-imp-in"><textarea class="ta" id="sy-it" placeholder="Вставте таблицю сюди (перший рядок — назви колонок)…" rows="5"></textarea><div class="row wrap"><label class="btn sm">'+ic('upload','s')+' Файл CSV<input type="file" id="sy-if" accept=".csv,.txt,text/csv" hidden></label><button class="btn sm" data-i="sample">Вставити приклад</button></div></div><div id="sy-iprev"></div></div>',
   foot:'<span class="sp mute sy-sm" id="sy-icnt"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok disabled>Імпортувати</button>',
   onMount:function(el,close){
     var ta=el.querySelector('#sy-it'),pv=el.querySelector('#sy-iprev'),ok=el.querySelector('[data-ok]'),cnt=el.querySelector('#sy-icnt');
     el.querySelector('[data-no]').onclick=close;
     function build(){
       st.rows=parseCSV(ta.value);if(st.rows.length<2){pv.innerHTML='';ok.disabled=true;cnt.textContent='';return}
       var hd=st.rows[0];if(!Object.keys(st.map).length||st.fresh!==hd.join('|')){st.fresh=hd.join('|');st.map={};
         IMP_F.forEach(function(f){var i=hd.findIndex(function(h,ix){return f[2].test(h.trim().toLowerCase())&&Object.keys(st.map).every(function(k){return st.map[k]!==ix})});if(i>=0)st.map[f[0]]=i})}
       draw()}
     function conv(){var out=[],have={};App.db.clients.forEach(function(c){if(c.ph)have[c.ph]=1});var dup=0,bad=0;
       st.rows.slice(1).forEach(function(r){var g=function(k){return st.map[k]!=null&&st.map[k]>=0?String(r[st.map[k]]||'').trim():''};
         var n=(g('name')+' '+g('last')).trim(),ph=normPhone(g('phone'));if(!n){bad++;return}if(ph&&have[ph]){dup++;return}out.push({n:n,ph:ph,bd:normDate(g('bd')),note:g('note')});if(ph)have[ph]=1});
       return {list:out,dup:dup,bad:bad}}
     function draw(){
       var hd=st.rows[0],c=conv();
       var opts='<option value="-1">— не імпортувати —</option>'+hd.map(function(h,i){return '<option value="'+i+'">'+esc(h||('Колонка '+(i+1)))+'</option>'}).join('');
       pv.innerHTML='<h4 class="sy-h4">Відповідність колонок</h4><div class="sy-map">'+IMP_F.map(function(f){return '<label class="fld"><span>'+f[1]+(f[0]==='name'?' *':'')+'</span><select class="sel" data-f="'+f[0]+'">'+opts.replace('value="'+(st.map[f[0]]!=null?st.map[f[0]]:-1)+'"','value="'+(st.map[f[0]]!=null?st.map[f[0]]:-1)+'" selected')+'</select></label>'}).join('')+'</div>'+
        '<h4 class="sy-h4">Попередній перегляд</h4><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Імʼя</th><th>Телефон</th><th>Дата нар.</th><th>Нотатка</th></tr></thead><tbody>'+
        (c.list.slice(0,5).map(function(x){return '<tr><td>'+esc(x.n)+'</td><td>'+(x.ph?U.phone(x.ph):'<span class="faint">—</span>')+'</td><td>'+(x.bd?D.human(x.bd,{year:true}):'<span class="faint">—</span>')+'</td><td class="ell" style="max-width:200px">'+esc(x.note)+'</td></tr>'}).join('')||'<tr><td colspan="4" class="mute">Нічого імпортувати — перевірте колонку «Імʼя»</td></tr>')+'</tbody></table></div>';
       cnt.textContent='Буде додано '+c.list.length+(c.dup?' · дублікатів '+c.dup:'')+(c.bad?' · без імені '+c.bad:'');ok.disabled=!c.list.length;
       U.$$('[data-f]',pv).forEach(function(s){s.onchange=function(){var v=+s.value;if(v<0)delete st.map[s.dataset.f];else st.map[s.dataset.f]=v;draw()}})}
     ta.oninput=build;
     el.querySelector('[data-i=sample]').onclick=function(){ta.value=SAMPLE;build()};
     el.querySelector('#sy-if').onchange=function(e){var f=e.target.files[0];if(!f)return;var rd=new FileReader();rd.onload=function(){ta.value=String(rd.result);build()};rd.readAsText(f)};
     ok.onclick=function(){var c=conv();var n=App.ops.importClients(c.list,'CSV');close();UI.toast('Імпортовано клієнтів: '+n);App.refresh()}}})}
function payModal(id){
  var m=id?App.db.pay.find(function(x){return x.id===id}):{n:'',kind:'transfer',on:true,feePct:0};
  var used=id&&App.db.payments.some(function(p){return p.method===id});
  UI.modal({title:id?'Спосіб оплати':'Новий спосіб оплати',size:'narrow',body:'<div class="col-f g12"><label class="fld"><span>Назва</span><input class="inp" id="sy-pn" value="'+esc(m.n)+'" placeholder="Наприклад, Apple Pay"></label><label class="fld"><span>Тип</span><select class="sel" id="sy-pk">'+[['cash','Готівка'],['card','Картка (термінал)'],['transfer','Переказ / онлайн']].map(function(o){return '<option value="'+o[0]+'"'+(m.kind===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select></label><label class="fld" id="sy-pfw"><span>Комісія еквайрингу, %</span><input class="inp" id="sy-pf" type="number" step="0.1" min="0" max="10" value="'+(m.feePct||0)+'"></label></div>',
   foot:(id?'<button class="btn dng" data-del>'+ic('trash','s')+' Видалити</button>':'')+'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
   onMount:function(el,close){var kind=el.querySelector('#sy-pk'),fw=el.querySelector('#sy-pfw');function vis(){fw.style.display=kind.value==='card'?'':'none'}kind.onchange=vis;vis();
     el.querySelector('[data-no]').onclick=close;
     var del=el.querySelector('[data-del]');if(del)del.onclick=function(){
       if(used){UI.toast('Є платежі цим способом — вимкніть його замість видалення',{type:'err'});return}
       if(App.db.pay.length<=1){UI.toast('Має лишитись хоча б один спосіб',{type:'err'});return}
       UI.confirm({title:'Видалити «'+m.n+'»?',text:'Спосіб оплати зникне з каси.',ok:'Видалити',danger:true}).then(function(y){if(y){App.ops.remove('pay',id,'Видалено спосіб оплати '+m.n);close();App.refresh()}})};
     el.querySelector('[data-ok]').onclick=function(){var n=el.querySelector('#sy-pn').value.trim();if(!n){el.querySelector('#sy-pn').classList.add('err');return}
       var k=kind.value,o={id:id||undefined,n:n,kind:k,ic:{cash:'cash',card:'card',transfer:'bank'}[k],on:m.on!==false};if(k==='card')o.feePct=Math.max(0,+el.querySelector('#sy-pf').value||0);else o.feePct=0;
       if(!id)delete o.id;App.ops.upsert('pay',id?Object.assign({id:id},o):o,(id?'Змінено':'Додано')+' спосіб оплати: '+n);
       if(k==='card'&&(id==='card'||!App.db.pay.some(function(x){return x.kind==='card'&&x.id!==id&&x.id!==(o.id||'')})))App.ops.set('settings.accounting.cardFeePct',o.feePct,'Комісія еквайрингу');
       close();UI.toast('Збережено');App.refresh()}}})}

function csvClients(){return U.csv([['Імʼя','Телефон','Дата народження','Теги','Джерело','Створено','Візитів','Витрачено']].concat(App.db.clients.map(function(c){var s=App.clientStats(c.id);return [c.n,c.ph,c.bd,(c.tags||[]).join(' '),c.src,c.created,s.visits,Math.round(s.spent)]})))}
function csvAppts(){return U.csv([['Дата','Початок','Майстер','Клієнт','Послуги','Статус','Сума']].concat(App.db.appts.slice().sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:a.start-b.start}).map(function(a){return [a.date,U.hm(a.start),sname(a.staff),cname(a.client),App.apptTitle(a),(App.ST[a.status]||{}).n||a.status,Math.round(App.apptTotal(a))]})))}
function csvPays(){return U.csv([['Дата','Тип','Спосіб','Сума','Майстер','Запис']].concat(App.db.payments.slice().sort(function(a,b){return a.date<b.date?-1:1}).map(function(p){return [p.date,p.kind,App.payMethod(p.method).n,p.amount,p.staff?sname(p.staff):'',p.appt||'']})))}

App.route('settings',{title:'Налаштування',icon:'cog',nav:true,group:'sys',order:30,perm:'settings.manage',render:function(v,params,q){
  var sid=params[0],sec=SECTIONS.find(function(s){return s.id===sid}),cur=sec||SECTIONS[0];
  App.setTop('');
  v.innerHTML='<div class="page sy-page sy-set'+(sec?' has-sec':'')+'"><div class="page-h sy-sh"><div><h2>Налаштування</h2><p>Салон «'+esc(App.db.salon.name)+'»</p></div></div><div class="sy-sgrid"><nav class="sy-snav" aria-label="Розділи налаштувань">'+
   SECTIONS.map(function(s){return '<a class="sy-sn" href="#/settings/'+s.id+'" aria-current="'+(cur.id===s.id&&(sec||window.innerWidth>=900))+'">'+ic(s.ic)+'<span class="t"><b>'+s.t+'</b><small>'+s.d+'</small></span><span class="m-only">'+ic('right','s')+'</span></a>'}).join('')+'</nav>'+
   '<section class="sy-sec"><div class="sy-sec-h"><a class="btn ghost m-only" href="#/settings" aria-label="Назад">'+ic('left')+'</a><h3>'+cur.t+'</h3></div><div class="sy-sec-b">'+cur.r()+'</div></section></div></div>';
  function saved(){UI.toast('Збережено')}
  v.onchange=function(e){
    var el=e.target;
    var hr=el.closest('[data-hrs]');
    if(hr&&el.dataset.h){var d=hr.dataset.hrs,on=hr.querySelector('[data-h=on]').checked,s=U.pm(hr.querySelector('[data-h=s]').value||'09:00'),en=U.pm(hr.querySelector('[data-h=e]').value||'20:00');
      if(on&&en<=s){UI.toast('Закриття має бути пізніше за відкриття',{type:'err'});return App.refresh()}
      App.ops.set('salon.hours.'+d,on?[s,en]:null,'Години роботи, '+D.WD[d]+': '+(on?t2(s)+'–'+t2(en):'вихідний'));return App.refresh()}
    var p=el.dataset.set;
    if(p){var t=el.dataset.t,val;
      if(el.type==='checkbox')val=el.checked;else if(t==='num'){val=el.value===''?0:+el.value;var mn=(el.min!==undefined&&el.min!=='')?+el.min:-Infinity,mx=(el.max!==undefined&&el.max!=='')?+el.max:Infinity;if(isNaN(val))val=0;val=Math.max(mn,Math.min(mx,val));el.value=val}else val=el.value;
      if(t==='numstr'||(el.tagName==='SELECT'&&t==='num'))val=+el.value;
      var disp=el.type==='checkbox'?(val?'увімкнено':'вимкнено'):el.tagName==='SELECT'?el.options[el.selectedIndex].text:val;
      if(p==='salon.logo')val=String(val).toUpperCase().trim();
      if(p==='salon.name'&&!String(val).trim()){UI.toast('Назва не може бути порожньою',{type:'err'});return App.refresh()}
      App.ops.set(p,val,(el.dataset.l||'Налаштування')+': '+disp);saved();
      if(p.indexOf('settings.modules.')===0||p.indexOf('salon.')===0||p==='settings.deposit.on'||p==='settings.alert.on'||p==='settings.alert.mode'||p==='settings.reminders.channel'||p.indexOf('settings.reminders.')===0||p.indexOf('settings.noshow.')===0)App.render();
      return}
    var sy=el.dataset.sy;
    if(sy==='pay-on'){var m=App.db.pay.find(function(x){return x.id===el.dataset.id});
      if(!el.checked&&App.db.pay.filter(function(x){return x.on!==false}).length<=1){el.checked=true;return UI.toast('Має лишитись хоча б один активний спосіб',{type:'err'})}
      App.ops.upsert('pay',{id:m.id,on:el.checked},(el.checked?'Увімкнено':'Вимкнено')+' спосіб оплати: '+m.n);saved()}
    if(sy==='perm'){setPerm(el.dataset.role,el.dataset.perm,el.checked);saved();App.render()}};
  v.onclick=function(e){
    var b=e.target.closest('[data-sy]');if(!b||b.tagName==='INPUT')return;var k=b.dataset.sy;
    if(k==='pay-edit')return payModal(b.dataset.id);if(k==='pay-add')return payModal();
    if(k==='alert-off'){App.ops.set('settings.alert.on',false,'Відбій тривоги');UI.toast('Відбій. Онлайн-запис знову працює');return App.render()}
    if(k==='alert-sim'){var on=!App.db.settings.alert.on;App.ops.set('settings.alert.on',on,on?'Симуляція: повітряна тривога':'Відбій тривоги');UI.toast(on?'Тривога увімкнена (симуляція)':'Відбій тривоги');return App.render()}
    if(k==='off-sim'){var o=!App.db.settings.offline;App.ops.set('settings.offline',o,o?'Симуляція: немає інтернету':'Звʼязок відновлено');UI.toast(o?'Офлайн-режим (симуляція)':'Синхронізовано 3 зміни');return App.render()}
    if(k==='perm-reset'){return UI.confirm({title:'Скинути права?',text:'Усі ролі повернуться до стандартних налаштувань.',ok:'Скинути'}).then(function(y){if(y){App.ops.set('settings.perms',{},'Права ролей скинуто до стандартних');applyPerms();App.render()}})}
    if(k==='exp-json'){U.download('slotly-'+App.db.salon.name.replace(/\s+/g,'-').toLowerCase()+'-'+T()+'.json',JSON.stringify(App.db,null,1),'application/json');App.ops.set('settings.export.last',T(),'Експорт усіх даних (JSON)');return UI.toast('Файл збережено')}
    if(k==='exp-clients'){U.download('clients-'+T()+'.csv',csvClients(),'text/csv;charset=utf-8');return UI.toast('Клієнтів експортовано')}
    if(k==='exp-appts'){U.download('appointments-'+T()+'.csv',csvAppts(),'text/csv;charset=utf-8');return UI.toast('Записи експортовано')}
    if(k==='exp-pays'){U.download('payments-'+T()+'.csv',csvPays(),'text/csv;charset=utf-8');return UI.toast('Платежі експортовано')}
    if(k==='imp')return importModal();
    if(k==='plan')return UI.toast('У демо тариф змінити не можна');
    if(k==='reset')return UI.confirm({title:'Скинути демо-дані?',text:'Усі ваші зміни зникнуть, повернуться стартові клієнти та записи.',ok:'Скинути',danger:true}).then(function(y){if(y){App.reset();UI.toast('Демо скинуто до початкових даних')}})};
}});
})();
