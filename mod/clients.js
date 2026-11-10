/* Slotly demo — модуль CLIENTS (CRM).
   Маршрути: #/clients (список), #/clients/<id> (картка), #/clients-dups (дублікати).
   Точка входу для інших модулів: App.openClient(id).
   Дані міняємо ТІЛЬКИ через App.ops.* . Власні ops модуля: tagClients, deleteTag, blockClient, unblockClient,
   ignoreDup, restoreClient, importClients; deleteClient/mergeClients обгорнуті (доочищають відгуки, платежі, уподобання). */
(function(){
'use strict';
var U=App.u,D=App.d,UI=App.ui,O=App.ops,$=U.$,esc=U.esc,NB='\u00A0',I=App.icon;

/* ═════════ довідники ═════════ */
var SRC={ig:'Instagram',online:'Онлайн-запис',phone:'Дзвінок',walkin:'Без запису',friend:'Рекомендація',tg:'Telegram',import:'Імпорт',admin:'Адміністратор'};
var SEGS=[['all','Усі'],['new','Нові'],['active','Активні'],['regular','Постійні'],['lost','Давно не були 60+'],['bday','Іменинники тижня'],['blocked','Чорний список']];
var PAGE=50;
function srcName(s){return SRC[s]||App.SRC[s]||s||'—'}
function isFull(){return App.can('clients.view')}
function myId(){return App.me().id}
function plu(n,a,b,c){return n+NB+U.plural(n,a,b,c)}
function tagObj(id){return App.db.tags.find(function(t){return t.id===id})}
function copyText(t,msg){
  var ok=function(){UI.toast(msg||'Скопійовано')};
  var fb=function(){var ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;opacity:0;top:0;left:0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');ok()}catch(e){UI.toast('Не вдалося скопіювати',{type:'err'})}ta.remove()};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok,fb)}else fb();
}
function normPh(s){var d=String(s||'').replace(/\D/g,'');if(!d)return {ph:'',ok:true,empty:true};
  if(d.length===10&&d[0]==='0')d='38'+d;else if(d.length===9)d='380'+d;
  return {ph:d,ok:d.length===12&&d.slice(0,2)==='38'}}
function relDays(n){if(n==null)return '—';if(n<=0)return 'сьогодні';if(n===1)return 'вчора';if(n<7)return n+' дн. тому';
  if(n<30){var w=Math.round(n/7);return w+NB+U.plural(w,'тиждень','тижні','тижнів')+' тому'}
  if(n<365){var m=Math.round(n/30);return m+NB+'міс. тому'}var y=Math.floor(n/365);return y+NB+U.plural(y,'рік','роки','років')+' тому'}
function bdNext(c){if(!c.bd||c.bd.length<10)return null;var T=App.today(),y=+T.slice(0,4),n=D.diff(T,y+c.bd.slice(4,10));if(n<0)n=D.diff(T,(y+1)+c.bd.slice(4,10));return n}
function bdText(c){if(!c.bd)return '';var d=+c.bd.slice(8,10),m=+c.bd.slice(5,7),y=+c.bd.slice(0,4);return d+' '+D.MON[m-1]+(y>1920?' '+y:'')}
function ageOf(c){if(!c.bd)return null;var y=+c.bd.slice(0,4);if(y<=1920)return null;var T=App.today(),a=+T.slice(0,4)-y;if(T.slice(5)<c.bd.slice(5))a--;return a}
function nextTxt(a){return a?D.rel(a.date)+' '+U.hm(a.start):'—'}
function money(n){return U.uah(n)}

/* ═════════ статистика (кеш) ═════════ */
var CACHE={sig:'',st:{},rows:null,dups:null};
function sig(){var d=App.db;return d.appts.length+':'+d.clients.length+':'+App.today()+':'+d.meId}
App.on('change',function(){CACHE.sig=''});
function fresh(){var s=sig();if(CACHE.sig!==s)CACHE={sig:s,st:{},rows:null,dups:null}}
function stats(id){fresh();var s=CACHE.st[id];if(s)return s;
  s=App.clientStats(id);var cfg=App.db.settings.noshow||{warnAt:2,blockAt:3};
  var late=s.all.filter(function(a){return a.status==='cancelled'&&a.lateCancel}).length,bad=s.noshow+late,den=s.visits+bad;
  s.rk={ns:s.noshow,late:late,bad:bad,lvl:bad>=cfg.blockAt?2:bad>=cfg.warnAt?1:0,rel:den?Math.round(100*s.visits/den):null,warnAt:cfg.warnAt,blockAt:cfg.blockAt};
  CACHE.st[id]=s;return s}
/* статистика в «межах» ролі: майстер бачить лише свої візити з клієнтом */
function scoped(c){var st=stats(c.id);if(isFull())return st;
  if(st._m&&st._m.me===myId())return st._m.o;
  var me=myId(),T=App.today(),all=st.all.filter(function(a){return a.staff===me});
  var done=all.filter(function(a){return a.status==='done'}),spent=U.sum(done,function(a){return App.apptTotal(a)}),last=done[done.length-1];
  var gaps=[];for(var i=1;i<done.length;i++)gaps.push(D.diff(done[i-1].date,done[i].date));
  var o=Object.assign({},st,{all:all,visits:done.length,spent:spent,avg:done.length?Math.round(spent/done.length):0,last:last||null,lastDate:last&&last.date,daysSince:last?D.diff(last.date,T):null,
    next:all.find(function(a){return a.date>=T&&(a.status==='new'||a.status==='confirmed'||a.status==='arrived')}),fav:me,avgGap:gaps.length?Math.round(U.sum(gaps)/gaps.length):null,first:all[0]&&all[0].date});
  st._m={me:me,o:o};return o}
function allRows(){fresh();if(CACHE.rows)return CACHE.rows;var rows=[];
  App.db.clients.forEach(function(c){var g=stats(c.id),st=scoped(c);
    if(!isFull()&&!st.all.some(function(a){return a.status!=='cancelled'}))return;
    var stf={};g.all.forEach(function(a){if(a.status!=='cancelled')stf[a.staff]=1});
    rows.push({c:c,st:st,rk:g.rk,seg:App.clientSegment(c,g),bd:bdNext(c),text:c.n.toLowerCase(),stf:stf})});
  return CACHE.rows=rows}
function canSee(c){return isFull()||allRows().some(function(r){return r.c.id===c.id})}

/* ═════════ ops (власні) ═════════ */
O.tagClients=function(ids,tagId,on){var t=tagObj(tagId),n=0;ids.forEach(function(id){var c=App.client(id);if(!c)return;var has=c.tags.indexOf(tagId)>=0;
  if(on&&!has){c.tags.push(tagId);n++}else if(!on&&has){c.tags=c.tags.filter(function(x){return x!==tagId});n++}});
  App.log('edit','clients',(on?'Мітка «':'Знято мітку «')+(t?t.n:tagId)+'» — '+plu(n,'клієнт','клієнти','клієнтів'));App.save();return n};
O.deleteTag=function(id){var t=tagObj(id),n=0;App.db.clients.forEach(function(c){if(c.tags.indexOf(id)>=0){c.tags=c.tags.filter(function(x){return x!==id});n++}});
  App.db.tags=App.db.tags.filter(function(x){return x.id!==id});App.log('delete','tags:'+id,'Видалено мітку «'+(t?t.n:id)+'» (у '+n+' клієнтів)');App.save();return n};
O.blockClient=function(id,reason){var c=App.client(id);if(!c)return;c.blocked=true;c.blockReason=reason||'';c.blockedAt=App.today();App.log('block','client:'+id,'До чорного списку: '+c.n+(reason?' — '+reason:''));App.save()};
O.unblockClient=function(id){var c=App.client(id);if(!c)return;c.blocked=false;c.blockReason='';c.blockedAt=null;App.log('unblock','client:'+id,'Знято з чорного списку: '+c.n);App.save()};
O.ignoreDup=function(ids){var arr=(App.db.settings.dupIgnore||[]).slice();ids.forEach(function(a,i){ids.slice(i+1).forEach(function(b){var k=[a,b].sort().join('|');if(arr.indexOf(k)<0)arr.push(k)})});O.set('settings.dupIgnore',arr,'Позначено «не дублікат»')};
O.restoreClient=function(snap){App.db.clients.push(snap.c);App.db.appts.forEach(function(a){if(snap.appts.indexOf(a.id)>=0)a.client=snap.c.id});(snap.reviews||[]).forEach(function(id){var r=App.db.reviews.find(function(x){return x.id===id});if(r)r.client=snap.c.id});App.log('create','client:'+snap.c.id,'Відновлено клієнта '+snap.c.n);App.save()};
var _del=O.deleteClient;
O.deleteClient=function(id){App.db.reviews.forEach(function(r){if(r.client===id)r.client=null});App.db.payments.forEach(function(p){if(p.client===id)p.client=null});App.db.waitlist=App.db.waitlist.filter(function(w){return w.client!==id});return _del(id)};
var _merge=O.mergeClients;
O.mergeClients=function(keepId,dropId){var k=App.client(keepId),d=App.client(dropId);if(!k||!d||keepId===dropId)return;
  App.db.reviews.forEach(function(r){if(r.client===dropId)r.client=keepId});App.db.payments.forEach(function(p){if(p.client===dropId)p.client=keepId});App.db.waitlist.forEach(function(w){if(w.client===dropId)w.client=keepId});
  if(d.allergy)k.allergy=(k.allergy?k.allergy+'\n':'')+d.allergy;
  if(d.prefs&&d.prefs.length)k.prefs=(k.prefs||[]).concat(d.prefs);
  if(d.tg)k.tg=true;if(d.blocked&&!k.blocked){k.blocked=true;k.blockReason=d.blockReason;k.blockedAt=d.blockedAt}
  k.consent=k.consent||{sms:true,promo:false};if(d.consent){k.consent.sms=k.consent.sms||d.consent.sms;k.consent.promo=k.consent.promo&&d.consent.promo!==false}
  if(d.created&&(!k.created||d.created<k.created))k.created=d.created;
  return _merge(keepId,dropId)};
O.importClients=function(rows,mode){var added=0,upd=0,skip=0,T=App.today();
  rows.forEach(function(r){
    if(r.status==='new'){App.db.clients.push({id:U.uid('c'),n:r.n,male:false,gender:'f',ph:r.ph,tg:false,bd:r.bd,tags:[],note:r.note,src:'import',created:T,blocked:false,consent:{sms:true,promo:false},fav:null,vipManual:false});added++}
    else if(r.status==='dup'&&mode==='fill'&&r.dupId){var c=App.client(r.dupId);if(!c){skip++;return}var ch=false;
      if(!c.bd&&r.bd){c.bd=r.bd;ch=true}if(!c.ph&&r.ph){c.ph=r.ph;ch=true}if(r.note&&(c.note||'').indexOf(r.note)<0){c.note=(c.note?c.note+'\n':'')+r.note;ch=true}if(ch)upd++;else skip++}
    else skip++});
  App.log('import','clients','Імпорт клієнтів: додано '+added+(upd?', оновлено '+upd:'')+(skip?', пропущено '+skip:''));App.save();return {added:added,upd:upd,skip:skip}};

/* ═════════ глобальна точка входу ═════════ */
App.openClient=function(id){if(!id)return App.go('clients');App.go('clients/'+id)};

/* ═════════ список ═════════ */
var S={q:'',seg:'all',m:'',tag:'',src:'',tg:false,sort:'last',dir:'desc',limit:PAGE,sel:new Set(),sm:false,fopen:false};
function defDir(k){return k==='name'?'asc':'desc'}
function syncUrl(){var q={};if(S.q)q.q=S.q;if(S.seg!=='all')q.seg=S.seg;if(S.m)q.m=S.m;if(S.tag)q.tag=S.tag;if(S.src)q.src=S.src;if(S.tg)q.tg='1';if(S.sort!=='last')q.sort=S.sort;if(S.dir!==defDir(S.sort))q.dir=S.dir;
  var k=Object.keys(q);history.replaceState(null,'','#/clients'+(k.length?'?'+k.map(function(x){return x+'='+encodeURIComponent(q[x])}).join('&'):''))}
function baseOK(r){var c=r.c;
  if(S.m&&!r.stf[S.m])return false;if(S.tag&&c.tags.indexOf(S.tag)<0)return false;if(S.src&&c.src!==S.src)return false;if(S.tg&&!c.tg)return false;
  var q=S.q.trim().toLowerCase();if(q){
    if(/^[\d+\s()-]+$/.test(q)){var dg=q.replace(/\D/g,'');if(dg.length<2)return false;if(dg[0]==='0')dg=dg.slice(1);return (c.ph||'').indexOf(dg)>=0}
    var toks=q.split(/\s+/);for(var i=0;i<toks.length;i++)if(r.text.indexOf(toks[i])<0)return false}
  return true}
function segOK(r,seg){switch(seg){case 'all':return true;case 'bday':return r.bd!=null&&r.bd<=6;case 'lostreg':return r.seg==='lost'&&r.st.visits>=2;default:return r.seg===seg}}
var SORT={last:function(r){return r.st.lastDate||''},spent:function(r){return r.st.spent},visits:function(r){return r.st.visits},name:function(r){return r.text},avg:function(r){return r.st.avg},rel:function(r){return r.rk.rel==null?-1:r.rk.rel}};
function sortRows(rows){var f=SORT[S.sort]||SORT.last,dir=S.dir==='asc'?1:-1;
  return rows.slice().sort(function(a,b){var x=f(a),y=f(b);if(S.sort==='last'){if(!x&&y)return 1;if(x&&!y)return -1}
    if(x<y)return -dir;if(x>y)return dir;return a.text<b.text?-1:1})}
function filtered(){return sortRows(allRows().filter(function(r){return baseOK(r)&&segOK(r,S.seg)}))}

function tagsLine(c){var h='';if(c.blocked)h+='<span class="badge dng plain">ЧС</span>';
  c.tags.forEach(function(id){var t=tagObj(id);if(t)h+='<span class="tag'+(id==='vip'?' cl-vip':'')+'">'+esc(t.n)+'</span>'});return h?'<span class="cl-tgs">'+h+'</span>':''}
function riskBadge(rk){if(!rk.bad)return '';
  var t='Неявок: '+rk.ns+', пізніх скасувань: '+rk.late+'. Попередження з '+rk.warnAt+', високий ризик з '+rk.blockAt+'.';
  if(rk.lvl===2)return '<span class="badge dng" title="'+t+'">Ризик · '+rk.bad+'</span>';
  if(rk.lvl===1)return '<span class="badge warn" title="'+t+'">Ризик · '+rk.bad+'</span>';
  return '<span class="cl-bad" title="'+t+'">'+plu(rk.bad,'неявка','неявки','неявок')+'</span>'}
function bdIcon(r){return r.bd!=null&&r.bd<=6?'<span class="cl-bd" title="День народження: '+bdText(r.c)+(r.bd===0?' (сьогодні)':' (через '+r.bd+' дн.)')+'">'+I('cake','s')+'</span>':''}

function trHtml(r,full){var c=r.c,st=r.st,fav=App.staff(st.fav);
  return '<tr class="click" data-id="'+c.id+'">'+(full?'<td class="cl-ck"><input type="checkbox" data-ck="'+c.id+'"'+(S.sel.has(c.id)?' checked':'')+' aria-label="Вибрати '+esc(c.n)+'"></td>':'')+
   '<td><div class="cl-nm">'+UI.av(c)+'<div class="cl-nt"><b class="ell">'+esc(c.n)+'</b>'+bdIcon(r)+tagsLine(c)+'</div></div></td>'+
   '<td class="num">'+(c.ph?U.phone(c.ph):'<span class="faint">—</span>')+(c.tg?' <span class="cl-tgi" title="Є Telegram">'+I('tg','s')+'</span>':'')+'</td>'+
   '<td class="r num">'+st.visits+'</td>'+(full?'<td class="r num">'+(st.spent?money(st.spent):'—')+'</td><td class="r num">'+(st.avg?money(st.avg):'—')+'</td>':'')+
   '<td class="nw" title="'+(st.lastDate?D.human(st.lastDate,{year:true}):'')+'">'+(st.lastDate?relDays(st.daysSince):'<span class="faint">—</span>')+'</td>'+
   '<td class="nw">'+(st.next?nextTxt(st.next):'<span class="faint">—</span>')+'</td>'+
   '<td class="nw">'+(fav?esc(fav.short):'<span class="faint">—</span>')+'</td>'+
   '<td class="nw">'+(r.rk.rel==null?'<span class="faint">—</span>':'<span class="num">'+r.rk.rel+'%</span> ')+riskBadge(r.rk)+'</td></tr>'}
function mcHtml(r,full){var c=r.c,st=r.st;
  return '<a class="cl-mc" href="#/clients/'+c.id+'" data-id="'+c.id+'">'+(S.sm&&full?'<span class="cl-mck"><input type="checkbox" data-ck="'+c.id+'"'+(S.sel.has(c.id)?' checked':'')+' aria-label="Вибрати"></span>':'')+UI.av(c)+
   '<span class="cl-mt"><b class="ell">'+esc(c.n)+(bdIcon(r)?' '+bdIcon(r):'')+'</b><small class="ell">'+(c.ph?U.phone(c.ph):'без телефону')+(st.lastDate?' · '+relDays(st.daysSince):'')+'</small>'+
   ((c.tags.length||c.blocked||r.rk.bad)?'<span class="cl-mb">'+tagsLine(c)+riskBadge(r.rk)+'</span>':'')+'</span>'+
   '<span class="cl-mr">'+(full?'<b class="num">'+(st.spent?money(st.spent):'—')+'</b>':'')+'<small>'+plu(st.visits,'візит','візити','візитів')+'</small></span></a>'}

function drawList(root){
  var full=isFull(),base=allRows().filter(baseOK),counts={all:base.length,lostreg:0};
  SEGS.forEach(function(s){counts[s[0]]=0});counts.all=base.length;
  base.forEach(function(r){SEGS.forEach(function(s){if(s[0]!=='all'&&segOK(r,s[0]))counts[s[0]]++});if(segOK(r,'lostreg'))counts.lostreg++});
  var rows=sortRows(base.filter(function(r){return segOK(r,S.seg)}));
  var ch=SEGS.map(function(s){return '<button class="chip" data-a="seg" data-v="'+s[0]+'" aria-pressed="'+(S.seg===s[0])+'">'+s[1]+' <span class="cnt">'+counts[s[0]]+'</span></button>'}).join('');
  if(S.seg==='lostreg')ch+='<button class="chip" data-a="seg" data-v="lostreg" aria-pressed="true">Ходили регулярно, давно не були <span class="cnt">'+counts.lostreg+'</span></button>';
  root.querySelector('#cl-chips').innerHTML=ch;
  S.sel.forEach(function(id){if(!App.client(id))S.sel.delete(id)});
  var n=S.sel.size;
  root.querySelector('#cl-bulk').innerHTML=(full&&n)?'<div class="cl-bulk"><b>Вибрано '+n+'</b>'+(n<rows.length?'<button class="btn sm ghost" data-a="selall">Усіх ('+rows.length+')</button>':'')+'<span class="sp"></span>'+
    '<button class="btn sm" data-a="b-tag">'+I('tag')+'Мітка</button><button class="btn sm" data-a="b-call">'+I('phone')+'Обзвін</button><button class="btn sm" data-a="b-csv">'+I('download')+'CSV</button><button class="icobtn sm ghost" data-a="b-clear" aria-label="Зняти вибір">'+I('x')+'</button></div>':'';
  var nf=(S.m?1:0)+(S.tag?1:0)+(S.src?1:0)+(S.tg?1:0);var fn=root.querySelector('#cl-fn');fn.textContent=nf?nf:'';fn.style.display=nf?'':'none';
  var res=root.querySelector('#cl-res');
  if(!rows.length){res.innerHTML=(allRows().length?UI.empty('search','Нікого не знайдено','Спробуйте змінити пошук або прибрати фільтри.','<button class="btn" data-a="reset">Скинути фільтри</button>'):
    UI.empty('users','Поки немає клієнтів',full?'Додайте першого клієнта або імпортуйте базу з Excel.':'Тут зʼявляться клієнти, які записувалися до вас.',full?'<button class="btn pri" data-a="new">+ Клієнт</button>':''));return}
  var shown=rows.slice(0,S.limit);
  var th=function(k,t,cls){var on=S.sort===k;return '<th'+(cls?' class="'+cls+'"':'')+(k?' data-sort="'+k+'" style="cursor:pointer"':'')+'>'+t+(on?' '+I(S.dir==='asc'?'up':'down','s'):'')+'</th>'};
  var head='<tr>'+(full?'<th class="cl-ck"><input type="checkbox" data-a="ckall" aria-label="Вибрати всіх на сторінці"'+(shown.length&&shown.every(function(r){return S.sel.has(r.c.id)})?' checked':'')+'></th>':'')+th('name','Клієнт')+th('','Телефон')+th('visits','Візитів','r')+(full?th('spent','Витрачено','r')+th('avg','Сер. чек','r'):'')+th('last','Останній візит')+th('','Наступний')+th('','Майстер')+th('rel','Надійність')+'</tr>';
  res.innerHTML='<div class="cl-cntrow"><span class="mute">'+plu(rows.length,'клієнт','клієнти','клієнтів')+'</span><span class="sp"></span>'+(full?'<button class="btn sm ghost cl-monly" data-a="smode">'+(S.sm?'Готово':'Вибрати')+'</button>':'')+'</div>'+
    '<div class="tbl-wrap cl-tw"><table class="tbl cl-tbl"><thead>'+head+'</thead><tbody>'+shown.map(function(r){return trHtml(r,full)}).join('')+'</tbody></table></div>'+
    '<div class="cl-ml'+(S.sm?' sm':'')+'">'+shown.map(function(r){return mcHtml(r,full)}).join('')+'</div>'+
    (rows.length>shown.length?'<div class="cl-more"><button class="btn" data-a="more">Показати ще '+Math.min(PAGE,rows.length-shown.length)+'</button><button class="btn ghost" data-a="all">Показати всіх ('+rows.length+')</button></div>':'');
}
function drawHelp(root){var full=isFull(),rs=allRows(),lr=rs.filter(function(r){return segOK(r,'lostreg')}),bd=rs.filter(function(r){return segOK(r,'bday')}),dups=full?findDups():[];
  var h='';
  if(lr.length)h+='<div class="cl-hc"><div class="cl-hct"><b>Давно не були</b><span>'+plu(lr.length,'клієнт','клієнти','клієнтів')+', які ходили регулярно (2+ візити, 60+ днів без візиту)</span></div><div class="cl-hca"><button class="btn sm" data-a="lostreg">Показати</button><button class="btn sm ghost" data-a="lostcopy">'+I('copy')+'Телефони</button></div></div>';
  if(bd.length)h+='<div class="cl-hc"><div class="cl-hct"><b>Іменинники тижня</b><span>'+bd.slice().sort(function(a,b){return a.bd-b.bd}).slice(0,2).map(function(r){return esc(U.short(r.c.n))+' · '+(r.bd===0?'сьогодні':r.bd===1?'завтра':'через '+r.bd+' дн.')}).join(', ')+(bd.length>2?' і ще '+(bd.length-2):'')+'</span></div><div class="cl-hca"><button class="btn sm" data-a="bday">Показати</button></div></div>';
  if(dups.length)h+='<div class="cl-hc"><div class="cl-hct"><b>Можливі дублікати</b><span>'+plu(dups.length,'група','групи','груп')+' з однаковим телефоном чи схожим імʼям</span></div><div class="cl-hca"><a class="btn sm" href="#/clients-dups">Переглянути</a></div></div>';
  root.querySelector('#cl-help').innerHTML=h}

function renderList(v,params,q){
  var full=isFull();
  S.q=q.q||'';S.seg=q.seg||'all';S.m=q.m||'';S.tag=q.tag||'';S.src=q.src||'';S.tg=q.tg==='1';S.sort=q.sort||'last';S.dir=q.dir||defDir(S.sort);S.limit=PAGE;S.fopen=!!(S.m||S.tag||S.src||S.tg);
  if(!full||S.sort==='spent'&&!full){S.sel.clear();S.sm=false;if(S.sort==='spent')S.sort='last'}
  App.setTop(full?'<button class="btn d-only" data-act="cl-tags">'+I('tag')+'Мітки</button><button class="btn d-only" data-act="cl-import">'+I('upload')+'Імпорт</button><button class="btn d-only" data-act="cl-export">'+I('download')+'Експорт CSV</button>'+
    '<button class="btn pri d-only" data-act="cl-new">'+I('plus')+'Клієнт</button><button class="icobtn cl-monly" data-act="cl-more" aria-label="Ще">'+I('more')+'</button><button class="icobtn cl-monly" data-act="cl-new" aria-label="Новий клієнт">'+I('plus')+'</button>':'');
  var usedSrc={};App.db.clients.forEach(function(c){if(c.src)usedSrc[c.src]=1});
  var sortKey=['last','spent','visits','name'].indexOf(S.sort)>=0?S.sort:'last';
  v.innerHTML='<div class="page wide cl-page" id="cl-root"><div class="cl-help" id="cl-help"></div>'+
   '<div class="cl-bar"><div class="inp-ic cl-search">'+I('search')+'<input class="inp" id="cl-q" type="search" placeholder="Пошук за імʼям чи телефоном" value="'+esc(S.q)+'" autocomplete="off" aria-label="Пошук клієнтів"></div>'+
   '<button class="btn cl-fbtn" data-a="ftoggle" aria-label="Фільтри">'+I('filter')+'<span>Фільтри</span><i id="cl-fn" class="pill-n"></i></button></div>'+
   '<div class="cl-filters'+(S.fopen?' open':'')+'" id="cl-filters">'+
     (full?'<select class="sel" id="cl-fm" aria-label="Майстер"><option value="">Усі майстри</option>'+App.masters(true).map(function(m){return '<option value="'+m.id+'"'+(S.m===m.id?' selected':'')+'>'+esc(m.short)+'</option>'}).join('')+'</select>':'')+
     '<select class="sel" id="cl-ft" aria-label="Мітка"><option value="">Усі мітки</option>'+App.db.tags.map(function(t){return '<option value="'+t.id+'"'+(S.tag===t.id?' selected':'')+'>'+esc(t.n)+'</option>'}).join('')+'</select>'+
     '<select class="sel" id="cl-fs" aria-label="Джерело"><option value="">Усі джерела</option>'+Object.keys(usedSrc).map(function(k){return '<option value="'+k+'"'+(S.src===k?' selected':'')+'>'+esc(srcName(k))+'</option>'}).join('')+'</select>'+
     '<button class="chip" data-a="ftg" aria-pressed="'+S.tg+'">'+I('tg','s')+'Є Telegram</button>'+
     '<select class="sel cl-fsort" id="cl-fo" aria-label="Сортування"><option value="last">Спершу: останній візит</option>'+(full?'<option value="spent">Спершу: витрачено</option>':'')+'<option value="visits">Спершу: візитів</option><option value="name">За імʼям А–Я</option></select></div>'+
   '<div class="chips scroll cl-chips" id="cl-chips"></div><div id="cl-bulk"></div><div id="cl-res"></div></div>';
  var root=$('#cl-root',v);
  root.querySelector('#cl-fo').value=sortKey;
  drawHelp(root);drawList(root);
  var redraw=function(){S.limit=PAGE;syncUrl();drawList(root)};
  var qi=root.querySelector('#cl-q');qi.oninput=U.debounce(function(){S.q=qi.value;redraw()},120);
  qi.onkeydown=function(e){if(e.key==='Enter'){var r=filtered();if(r.length===1)App.openClient(r[0].c.id)}};
  var bindSel=function(id,key){var el=root.querySelector(id);if(el)el.onchange=function(){S[key]=el.value;redraw()}};
  bindSel('#cl-fm','m');bindSel('#cl-ft','tag');bindSel('#cl-fs','src');
  root.querySelector('#cl-fo').onchange=function(e){S.sort=e.target.value;S.dir=defDir(S.sort);redraw()};
  root.addEventListener('change',function(e){var t=e.target;
    if(t.dataset.ck){if(t.checked)S.sel.add(t.dataset.ck);else S.sel.delete(t.dataset.ck);drawList(root)}
    else if(t.dataset.a==='ckall'){filtered().slice(0,S.limit).forEach(function(r){if(t.checked)S.sel.add(r.c.id);else S.sel.delete(r.c.id)});drawList(root)}});
  root.addEventListener('click',function(e){var t=e.target;
    if(t.closest('.cl-ck')||t.closest('.cl-mck')){if(t.closest('.cl-mck')&&t.tagName!=='INPUT')e.preventDefault();return}
    var b=t.closest('[data-a]'),a=b&&b.dataset.a;
    if(!a){var th=t.closest('th[data-sort]');if(th){var k=th.dataset.sort;if(S.sort===k)S.dir=S.dir==='asc'?'desc':'asc';else{S.sort=k;S.dir=defDir(k)}root.querySelector('#cl-fo').value=['last','spent','visits','name'].indexOf(S.sort)>=0?S.sort:'last';redraw();return}
      var mc=t.closest('a.cl-mc');if(mc&&S.sm&&isFull()){e.preventDefault();var id=mc.dataset.id;if(S.sel.has(id))S.sel.delete(id);else S.sel.add(id);drawList(root);return}
      var tr=t.closest('tr[data-id]');if(tr)App.openClient(tr.dataset.id);return}
    switch(a){
      case 'seg':S.seg=b.dataset.v;redraw();break;
      case 'ftoggle':S.fopen=!S.fopen;root.querySelector('#cl-filters').classList.toggle('open',S.fopen);break;
      case 'ftg':S.tg=!S.tg;b.setAttribute('aria-pressed',S.tg);redraw();break;
      case 'reset':S.q='';S.seg='all';S.m=S.tag=S.src='';S.tg=false;App.go('clients');break;
      case 'more':S.limit+=PAGE;drawList(root);break;
      case 'all':S.limit=99999;drawList(root);break;
      case 'smode':S.sm=!S.sm;if(!S.sm)S.sel.clear();drawList(root);break;
      case 'selall':filtered().forEach(function(r){S.sel.add(r.c.id)});drawList(root);break;
      case 'b-clear':S.sel.clear();drawList(root);break;
      case 'b-tag':bulkTag(selRows(),function(){drawList(root);drawHelp(root)});break;
      case 'b-call':callList(selRows());break;
      case 'b-csv':exportCsv(selRows(),'vybrani');break;
      case 'lostreg':App.go('clients',{seg:'lostreg'});break;
      case 'lostcopy':callList(allRows().filter(function(r){return segOK(r,'lostreg')}),'Давно не були — для обзвону');break;
      case 'bday':App.go('clients',{seg:'bday'});break;
      case 'new':newClient();break}
  });
}
function selRows(){return allRows().filter(function(r){return S.sel.has(r.c.id)})}

function newClient(){UI.clientForm({},function(c){if(c&&c.id)App.openClient(c.id)})}
Object.assign(App.actions,{
  'cl-new':newClient,
  'cl-tags':function(){tagsModal()},
  'cl-import':function(){importModal()},
  'cl-export':function(){exportCsv(filtered(),'klienty')},
  'cl-more':function(e){var el=e.target.closest('[data-act]');UI.menu(el,[{t:'Імпорт з CSV',ic:'upload',fn:importModal},{t:'Експорт CSV',ic:'download',fn:function(){exportCsv(filtered(),'klienty')}},{t:'Мітки',ic:'tag',fn:tagsModal},'-',{t:'Дублікати',ic:'merge',fn:function(){App.go('clients-dups')}}])}
});

/* ───── експорт / обзвін ───── */
function exportCsv(rs,name){if(!isFull()){UI.toast('Експорт доступний адміністратору',{type:'err'});return}
  if(!rs||!rs.length){UI.toast('Немає кого експортувати',{type:'err'});return}
  var rows=[['Імʼя','Телефон','День народження','Мітки','Джерело','Візитів','Витрачено, ₴','Середній чек, ₴','Останній візит','Наступний візит','Улюблений майстер','Надійність, %','Нотатка']];
  rs.forEach(function(r){var c=r.c,st=r.st,fav=App.staff(st.fav);
    rows.push([c.n,c.ph?'+'+c.ph:'',c.bd||'',c.tags.map(function(id){var t=tagObj(id);return t?t.n:id}).join(', '),srcName(c.src),st.visits,st.spent,st.avg,st.lastDate||'',st.next?st.next.date+' '+U.hm(st.next.start):'',fav?fav.short:'',r.rk.rel==null?'':r.rk.rel,(c.note||'').replace(/\n/g,' ')])});
  U.download(name+'-'+App.today()+'.csv',U.csv(rows),'text/csv;charset=utf-8');
  UI.toast('Експортовано '+plu(rs.length,'клієнта','клієнтів','клієнтів'))}
function callList(rs,title){
  var withPh=rs.filter(function(r){return r.c.ph}),no=rs.length-withPh.length;
  UI.modal({title:title||'Список для обзвону',sub:plu(withPh.length,'номер','номери','номерів')+(no?' · '+plu(no,'клієнт','клієнти','клієнтів')+' без телефону':''),size:'wide',
    body:withPh.length?'<div class="tbl-wrap"><table class="tbl cl-call"><tbody>'+withPh.map(function(r){var c=r.c;return '<tr><td><div class="cl-nm">'+UI.av(c,'sm')+'<div class="cl-nt"><b class="ell">'+esc(c.n)+'</b></div></div></td><td class="num nw">'+U.phone(c.ph)+'</td><td class="nw cl-callx">'+(r.st.lastDate?'був(ла) '+relDays(r.st.daysSince):'ще не був(ла)')+'</td><td class="r"><a class="icobtn sm ghost" href="tel:+'+c.ph+'" aria-label="Подзвонити">'+I('phone')+'</a></td></tr>'}).join('')+'</tbody></table></div>':UI.empty('phone','Немає номерів','У вибраних клієнтів не вказано телефон.'),
    foot:'<button class="btn" data-c1>'+I('copy')+'Номери</button><button class="btn" data-c2>'+I('copy')+'Імʼя + номер</button><span class="sp"></span><button class="btn pri" data-csv>'+I('download')+'CSV</button>',
    onMount:function(el){el.querySelector('[data-c1]').onclick=function(){copyText(withPh.map(function(r){return '+'+r.c.ph}).join('\n'),'Скопійовано '+plu(withPh.length,'номер','номери','номерів'))};
      el.querySelector('[data-c2]').onclick=function(){copyText(withPh.map(function(r){return r.c.n+' — '+U.phone(r.c.ph)}).join('\n'),'Список скопійовано')};
      el.querySelector('[data-csv]').onclick=function(){exportCsv(rs,'obdzvin')}}})}

/* ───── масова мітка ───── */
function bulkTag(rs,done){if(!rs.length)return;
  UI.modal({title:'Мітка для '+plu(rs.length,'клієнта','клієнтів','клієнтів'),size:'narrow',
    body:'<div class="col-f g12"><div class="seg" style="align-self:flex-start"><button data-m="add" aria-pressed="true">Додати</button><button data-m="del" aria-pressed="false">Зняти</button></div>'+
     '<label class="fld"><span>Мітка</span><select class="sel" name="t">'+App.db.tags.map(function(t){return '<option value="'+t.id+'">'+esc(t.n)+'</option>'}).join('')+'<option value="__new">+ Нова мітка…</option></select></label>'+
     '<label class="fld" data-nw style="display:none"><span>Назва нової мітки</span><input class="inp" name="nn" placeholder="Напр. Весільний макіяж"></label></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Застосувати</button>',
    onMount:function(el,close){var mode='add',sel=el.querySelector('[name=t]'),nw=el.querySelector('[data-nw]');
      el.querySelectorAll('[data-m]').forEach(function(b){b.onclick=function(){mode=b.dataset.m;el.querySelectorAll('[data-m]').forEach(function(x){x.setAttribute('aria-pressed',x===b)})}});
      sel.onchange=function(){nw.style.display=sel.value==='__new'?'':'none'};
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){var tid=sel.value;
        if(tid==='__new'){var nm=el.querySelector('[name=nn]').value.trim();if(!nm){el.querySelector('[name=nn]').classList.add('err');return}tid=O.upsert('tags',{n:nm},'Нова мітка «'+nm+'»').id}
        var n=O.tagClients(rs.map(function(r){return r.c.id}),tid,mode==='add');close();UI.toast((mode==='add'?'Мітку додано: ':'Мітку знято: ')+plu(n,'клієнт','клієнти','клієнтів'));done&&done()}}})}

/* ───── керування мітками ───── */
function tagsModal(){
  UI.modal({title:'Мітки клієнтів',sub:'Створюйте, перейменовуйте, видаляйте',size:'narrow',body:'<div id="cl-tg"></div>',foot:'<span class="sp"></span><button class="btn pri" data-ok>Готово</button>',
    onClose:function(){if(App.cur&&App.cur.rt.id==='clients')App.refresh()},
    onMount:function(el,close){el.querySelector('[data-ok]').onclick=close;var box=el.querySelector('#cl-tg');
      function draw(){var cnt={};App.db.clients.forEach(function(c){c.tags.forEach(function(t){cnt[t]=(cnt[t]||0)+1})});
        box.innerHTML='<div class="cl-tgl">'+App.db.tags.map(function(t){return '<div class="cl-tgr" data-id="'+t.id+'"><input class="inp" value="'+esc(t.n)+'" data-ren aria-label="Назва мітки"'+(t.id==='vip'?' disabled':'')+'><span class="mute nw cl-tgc">'+(cnt[t.id]||0)+'</span>'+(t.id==='vip'?'<span class="icobtn ghost" title="Системна мітка: впливає на сегмент «Постійні»">'+I('lock')+'</span>':'<button class="icobtn ghost" data-del aria-label="Видалити мітку">'+I('trash')+'</button>')+'</div>'}).join('')+'</div>'+
          '<div class="cl-tgr cl-tgnew"><input class="inp" id="cl-tgn" placeholder="Нова мітка"><button class="btn pri" data-add>'+I('plus')+'Додати</button></div>'}
      draw();
      box.addEventListener('change',function(e){var inp=e.target.closest('[data-ren]');if(!inp)return;var id=inp.closest('[data-id]').dataset.id,v=inp.value.trim();if(!v){draw();return}O.upsert('tags',{id:id,n:v},'Мітку перейменовано: «'+v+'»');UI.toast('Збережено')});
      box.addEventListener('click',function(e){
        var d=e.target.closest('[data-del]');if(d){var id=d.closest('[data-id]').dataset.id,t=tagObj(id),n=App.db.clients.filter(function(c){return c.tags.indexOf(id)>=0}).length;
          UI.confirm({title:'Видалити мітку «'+esc(t.n)+'»?',text:n?'Мітку буде знято з '+plu(n,'клієнта','клієнтів','клієнтів')+'. Самих клієнтів це не зачепить.':'Мітку ніхто не використовує.',ok:'Видалити',danger:true}).then(function(y){if(y){O.deleteTag(id);draw();UI.toast('Мітку видалено')}});return}
        if(e.target.closest('[data-add]')){var inp=box.querySelector('#cl-tgn'),v=inp.value.trim();if(!v){inp.classList.add('err');inp.focus();return}
          if(App.db.tags.some(function(t){return t.n.toLowerCase()===v.toLowerCase()})){UI.toast('Така мітка вже є',{type:'err'});return}
          O.upsert('tags',{n:v},'Нова мітка «'+v+'»');draw();UI.toast('Мітку додано')}});
      box.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.id==='cl-tgn')box.querySelector('[data-add]').click()})}})}

/* ───── імпорт CSV ───── */
function parseCsv(text){text=String(text||'').replace(/^\uFEFF/,'');var first=text.split(/\r?\n/)[0]||'';
  var sp=[';','\t',','].map(function(s){return [s,first.split(s).length]}).sort(function(a,b){return b[1]-a[1]})[0];var sep=sp[1]>1?sp[0]:';';
  var rows=[],row=[],cur='',q=false;
  for(var i=0;i<text.length;i++){var ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}
    else if(ch==='"')q=true;else if(ch===sep){row.push(cur);cur=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cur);cur='';if(row.some(function(x){return x.trim()}))rows.push(row);row=[]}
    else cur+=ch}
  row.push(cur);if(row.some(function(x){return x.trim()}))rows.push(row);return rows}
function parseBd(s){s=String(s||'').trim();if(!s)return '';var m,y,mo,d;
  if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))){y=+m[1];mo=+m[2];d=+m[3]}
  else if((m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/))){d=+m[1];mo=+m[2];y=+m[3];if(y<100)y+=y>30?1900:2000}
  else if((m=s.match(/^(\d{1,2})[.\/-](\d{1,2})$/))){d=+m[1];mo=+m[2];y=1900}
  else return null;
  if(mo<1||mo>12||d<1||d>31||y<1900||y>2100)return null;
  return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
function analyzeImport(text){var raw=parseCsv(text),idx={n:0,ph:1,bd:2,note:3},skipFirst=false;
  if(raw.length){var h=raw[0].map(function(x){return x.trim().toLowerCase()});
    if(h.some(function(x){return /^(ім|им|name|піб|клієнт|телефон|phone)/.test(x)})){skipFirst=true;
      h.forEach(function(x,i){if(/ім|им|name|піб|клієнт/.test(x)&&!/телеф/.test(x))idx.n=i;else if(/тел|phone|моб/.test(x))idx.ph=i;else if(/нар|birth|^дн|дата/.test(x))idx.bd=i;else if(/нотат|note|коментар|примітк/.test(x))idx.note=i})}}
  var byPh={},byName={};App.db.clients.forEach(function(c){if(c.ph)byPh[c.ph]=c;byName[c.n.toLowerCase()]=c});
  var seenPh={},seenName={},out=[];
  raw.slice(skipFirst?1:0).forEach(function(r,i){var n=(r[idx.n]||'').trim().replace(/\s+/g,' '),p=normPh(r[idx.ph]),bd=parseBd(r[idx.bd]),note=(r[idx.note]||'').trim();
    var o={i:i+1,n:n,ph:p.ph,bd:bd||'',note:note,status:'new',msg:''};
    if(!n){o.status='err';o.msg='Немає імені'}
    else if(!p.empty&&!p.ok){o.ph='';o.warn='Некоректний телефон «'+(r[idx.ph]||'').trim()+'» — без номера'}
    if(o.status==='new'&&bd===null){o.bd='';o.warn=(o.warn?o.warn+'; ':'')+'Не розпізнано дату народження'}
    if(o.status==='new'){
      var ex=o.ph&&byPh[o.ph]||(!o.ph&&byName[n.toLowerCase()]);
      if(ex){o.status='dup';o.dupId=ex.id;o.msg='Вже є: '+ex.n}
      else if(o.ph&&seenPh[o.ph]||(!o.ph&&seenName[n.toLowerCase()])){o.status='dupf';o.msg='Дублює рядок '+(seenPh[o.ph]||seenName[n.toLowerCase()])}
      else{if(o.ph)seenPh[o.ph]=o.i;else seenName[n.toLowerCase()]=o.i}}
    out.push(o)});
  return out}
function importModal(){
  UI.modal({title:'Імпорт клієнтів',sub:'CSV: імʼя; телефон; день народження; нотатка',size:'wide',
    body:'<div class="col-f g12"><div class="row wrap g12"><label class="btn" style="cursor:pointer">'+I('upload')+'Обрати файл<input type="file" accept=".csv,.txt,text/csv,text/plain" hidden id="cl-file"></label><button class="btn ghost" data-tpl>Шаблон CSV</button></div><span class="mute" style="font-size:13px">Або вставте рядки з Excel / Google Таблиць:</span>'+
     '<textarea class="ta cl-imp-ta" id="cl-imp" placeholder="Оксана Бойко;+380671234567;14.03.1992;Алергія на латекс&#10;Ірина Мазур;0501112233;;Любить каву"></textarea>'+
     '<div id="cl-imp-out"></div></div>',
    foot:'<label class="cl-impm"><span class="mute">Дублікати:</span><select class="sel" id="cl-imp-mode"><option value="skip">Пропускати</option><option value="fill">Доповнити порожні поля</option></select></label><span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok disabled>Імпортувати</button>',
    onMount:function(el,close){var ta=el.querySelector('#cl-imp'),out=el.querySelector('#cl-imp-out'),ok=el.querySelector('[data-ok]'),mode=el.querySelector('#cl-imp-mode'),rows=[];
      function calc(){rows=ta.value.trim()?analyzeImport(ta.value):[];
        if(!rows.length){out.innerHTML='';ok.disabled=true;ok.textContent='Імпортувати';return}
        var c={new:0,dup:0,dupf:0,err:0};rows.forEach(function(r){c[r.status]++});
        var lab={new:'<span class="badge ok">Новий</span>',dup:'<span class="badge warn">Є в базі</span>',dupf:'<span class="badge warn">Дубль у файлі</span>',err:'<span class="badge dng">Помилка</span>'};
        out.innerHTML='<div class="row wrap g12 cl-imp-sum"><span><b>'+rows.length+'</b> '+U.plural(rows.length,'рядок','рядки','рядків')+'</span><span class="ok-t"><b>'+c.new+'</b> нових</span>'+(c.dup+c.dupf?'<span class="warn-t"><b>'+(c.dup+c.dupf)+'</b> '+U.plural(c.dup+c.dupf,'дублікат','дублікати','дублікатів')+'</span>':'')+(c.err?'<span class="dng-t"><b>'+c.err+'</b> з помилками</span>':'')+'</div>'+
          '<div class="tbl-wrap cl-imp-tw"><table class="tbl cl-imp-t"><thead><tr><th>№</th><th>Імʼя</th><th>Телефон</th><th>ДН</th><th>Нотатка</th><th>Статус</th></tr></thead><tbody>'+rows.slice(0,200).map(function(r){return '<tr><td class="faint">'+r.i+'</td><td>'+esc(r.n||'—')+'</td><td class="num">'+(r.ph?U.phone(r.ph):'<span class="faint">—</span>')+'</td><td>'+(r.bd?bdText({bd:r.bd}):'<span class="faint">—</span>')+'</td><td class="ell" style="max-width:180px">'+esc(r.note)+'</td><td>'+lab[r.status]+(r.msg||r.warn?' <small class="mute">'+esc(r.msg||r.warn)+'</small>':'')+'</td></tr>'}).join('')+'</tbody></table></div>'+(rows.length>200?'<small class="mute">Показано перші 200 рядків</small>':'');
        ok.disabled=!c.new&&!(mode.value==='fill'&&c.dup);ok.textContent=c.new?'Імпортувати '+c.new:(mode.value==='fill'&&c.dup?'Доповнити '+c.dup:'Нічого імпортувати')}
      ta.oninput=U.debounce(calc,200);mode.onchange=calc;
      el.querySelector('#cl-file').onchange=function(e){var f=e.target.files[0];if(!f)return;var rd=new FileReader();
        rd.onload=function(){var t=rd.result;if(t.indexOf('\uFFFD')>=0){var r2=new FileReader();r2.onload=function(){ta.value=r2.result;calc()};r2.readAsText(f,'windows-1251')}else{ta.value=t;calc()}};rd.readAsText(f,'utf-8')};
      el.querySelector('[data-tpl]').onclick=function(){U.download('shablon-klienty.csv',U.csv([['Імʼя','Телефон','День народження','Нотатка'],['Оксана Бойко','+380671234567','14.03.1992','Алергія на латекс'],['Ірина Мазур','0501112233','','Любить каву']]),'text/csv;charset=utf-8')};
      el.querySelector('[data-no]').onclick=close;
      ok.onclick=function(){var r=O.importClients(rows,mode.value);close();UI.toast('Імпорт: додано '+r.added+(r.upd?', оновлено '+r.upd:'')+(r.skip?', пропущено '+r.skip:''));if(App.cur&&App.cur.rt.id==='clients')App.refresh()}}})}

/* ═════════ дублікати: пошук ═════════ */
function lev(a,b){if(a===b)return 0;var m=a.length,n=b.length;if(!m)return n;if(!n)return m;var p=[],i,j;for(j=0;j<=n;j++)p[j]=j;
  for(i=1;i<=m;i++){var prev=p[0];p[0]=i;for(j=1;j<=n;j++){var t=p[j];p[j]=Math.min(p[j]+1,p[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=t}}return p[n]}
function nameKey(n){return n.toLowerCase().replace(/[ʼ'’`\-]/g,'').split(/\s+/).filter(Boolean).sort().join(' ')}
function findDups(){fresh();if(CACHE.dups)return CACHE.dups;
  var cl=App.db.clients,ign=App.db.settings.dupIgnore||[],par={},why={};
  function f(x){while(par[x]!==x){par[x]=par[par[x]];x=par[x]}return x}
  cl.forEach(function(c){par[c.id]=c.id});
  var keys=cl.map(function(c){return nameKey(c.n)});
  for(var i=0;i<cl.length;i++)for(var j=i+1;j<cl.length;j++){var a=cl[i],b=cl[j];
    if(ign.length&&ign.indexOf([a.id,b.id].sort().join('|'))>=0)continue;var r=null;
    if(a.ph&&a.ph===b.ph)r='Однаковий телефон';
    else if(keys[i]===keys[j])r='Те саме імʼя';
    else{var ka=keys[i],kb=keys[j];if(Math.min(ka.length,kb.length)>=8&&Math.abs(ka.length-kb.length)<=2){var th=Math.max(ka.length,kb.length)<14?1:2;if(lev(ka,kb)<=th)r='Схоже імʼя'}}
    if(r){par[f(a.id)]=f(b.id);if(!why[a.id])why[a.id]=r;if(!why[b.id])why[b.id]=r}}
  var groups={};cl.forEach(function(c){var r=f(c.id);(groups[r]=groups[r]||[]).push(c.id)});
  var out=[];Object.keys(groups).forEach(function(k){var ids=groups[k];if(ids.length<2)return;
    var reasons={};ids.forEach(function(id){if(why[id])reasons[why[id]]=1});
    ids.sort(function(x,y){return stats(y).visits-stats(x).visits});out.push({ids:ids,why:Object.keys(reasons)})});
  return CACHE.dups=out}

/* ═════════ картка клієнта ═════════ */
var CT={vf:'all'};
var PAYK={service:'Послуга',deposit:'Депозит',tip:'Чайові',product:'Товар',cert:'Оплата сертифікатом',abon:'З абонемента',cert_sale:'Купівля сертифіката',abon_sale:'Купівля абонемента',refund:'Повернення'};
var PREF_SUG=['Формула фарби','Довжина та форма','Матеріали й бренди','Комфорт (напої, музика)','Інше'];
function tabsFor(){return isFull()?[['visits','Візити'],['fin','Фінанси'],['notes','Нотатки'],['rev','Відгуки'],['consent','Згоди'],['log','Журнал']]:[['visits','Візити'],['notes','Нотатки'],['rev','Відгуки']]}
function svcName(id){var s=App.svc(id);return s?s.n:id}
function methodName(m){return m==='cert'?'Сертифікат':m==='abon'?'Абонемент':App.payMethod(m).n}
function stfName(id){var s=App.staff(id);return s?s.short:'—'}
function clientReviews(id){return App.db.reviews.filter(function(r){return r.client===id}).sort(function(a,b){return a.date<b.date?1:-1})}
function clientPays(c){var ids={},certB={},abB={};
  App.db.appts.forEach(function(a){if(a.client===c.id)ids[a.id]=1});
  App.db.certs.forEach(function(g){if(g.buyer===c.id)certB[g.id]=1});App.db.abons.forEach(function(g){if(g.client===c.id)abB[g.id]=1});
  return App.db.payments.filter(function(p){return (p.appt&&ids[p.appt])||p.client===c.id||(p.kind==='cert_sale'&&certB[p.cert])||(p.kind==='abon_sale'&&abB[p.abon])}).sort(function(a,b){return (a.ts||a.date)<(b.ts||b.date)?1:-1})}
function favSvc(st){var cnt={};st.all.forEach(function(a){if(a.status==='done')a.items.forEach(function(x){if(x.svc!=='dz'&&x.svc!=='sn')cnt[x.svc]=(cnt[x.svc]||0)+1})});var best=null,m=0;for(var k in cnt)if(cnt[k]>m){m=cnt[k];best=k}return best}
function monthsSince(d){var n=D.diff(d,App.today());return n<45?n+NB+'дн.':n<700?Math.round(n/30)+NB+'міс.':(n/365).toFixed(1).replace('.',',')+NB+'р.'}

function renderCard(v,id,q){
  App.setTop('');
  var c=App.client(id);
  if(!c||!canSee(c)){v.innerHTML='<div class="page">'+UI.empty(c?'lock':'users',c?'Немає доступу до цього клієнта':'Клієнта не знайдено',c?'Майстер бачить лише клієнтів, які ходили до нього.':'Можливо, його видалено або обʼєднано з іншим.','<a class="btn" href="#/clients" style="margin-top:8px">До списку клієнтів</a>')+'</div>';return}
  var full=isFull(),g=stats(id),st=scoped(c),rk=g.rk,tabs=tabsFor();
  var tab=tabs.some(function(t){return t[0]===q.tab})?q.tab:'visits';
  var h='<div class="page cl-cardpage" id="cl-card" data-id="'+id+'">';
  h+='<a class="btn ghost sm cl-back" href="#/clients">'+I('left')+'Клієнти</a>';
  /* шапка */
  var ph=c.ph?U.phone(c.ph):'';
  h+='<div class="cl-hd">'+UI.av(c,'xl')+'<div class="cl-hm"><h2>'+esc(c.n)+(c.blocked?' <span class="badge dng plain">Чорний список</span>':'')+'</h2>'+
    '<div class="cl-ct">'+(ph?'<span class="cl-ph num">'+ph+'</span><a class="icobtn sm" href="tel:+'+c.ph+'" aria-label="Подзвонити" title="Подзвонити">'+I('phone')+'</a>'+(c.tg?'<a class="icobtn sm" href="https://t.me/+'+c.ph+'" target="_blank" rel="noopener" aria-label="Написати в Telegram" title="Telegram">'+I('tg')+'</a>':'')+'<button class="icobtn sm" data-a="copy" aria-label="Скопіювати номер" title="Скопіювати номер">'+I('copy')+'</button>':'<span class="mute">Телефон не вказано</span>')+
    (c.bd?'<span class="cl-bdt">'+I('cake','s')+bdText(c)+(bdNext(c)!=null&&bdNext(c)<=14?' · '+(bdNext(c)===0?'сьогодні':'через '+bdNext(c)+' дн.'):'')+'</span>':'')+'</div>'+
    '<div class="cl-tr">'+c.tags.map(function(t){var o=tagObj(t);return o?'<span class="tag'+(t==='vip'?' cl-vip':'')+'">'+esc(o.n)+'</span>':''}).join('')+(full?'<button class="btn sm ghost cl-tgb" data-a="tags">'+I('tag')+(c.tags.length?'Мітки':'Додати мітку')+'</button>':'')+'</div></div>'+
    '<div class="cl-ha"><button class="btn pri" data-a="book">'+I('plus')+'Записати</button>'+(full?'<button class="icobtn" data-a="menu" aria-label="Дії">'+I('more')+'</button>':'')+'</div></div>';
  /* попередження */
  var al='';
  if(c.blocked)al+='<div class="note dng">'+I('ban')+'<div><b>У чорному списку</b>'+(c.blockedAt?' з '+D.human(c.blockedAt):'')+(c.blockReason?'. Причина: '+esc(c.blockReason):'')+'</div></div>';
  else if(rk.lvl>=1)al+='<div class="note '+(rk.lvl===2?'dng':'warn')+'">'+I('alert')+'<div><b>'+(rk.lvl===2?'Високий ризик неявки':'Підвищений ризик неявки')+'.</b> '+plu(rk.ns,'неявка','неявки','неявок')+(rk.late?', '+plu(rk.late,'пізнє скасування','пізніх скасувань','пізніх скасувань'):'')+'.'+(App.db.settings.deposit.on?' Варто попросити депозит при записі.':'')+'</div></div>';
  if(c.allergy)al+='<div class="note warn">'+I('alert')+'<div><b>Алергія / протипоказання:</b> '+esc(c.allergy).replace(/\n/g,'<br>')+'</div></div>';
  else if(c.tags.indexOf('allergy')>=0)al+='<div class="note warn">'+I('alert')+'<div><b>Позначено «Алергія».</b> '+(c.note?esc(c.note):'Уточніть деталі у вкладці «Нотатки».')+'</div></div>';
  if(al)h+='<div class="cl-al">'+al+'</div>';
  /* KPI */
  var k=function(l,val,d){return '<div class="kpi"><div class="l">'+l+'</div><div class="v">'+val+'</div>'+(d?'<div class="d">'+d+'</div>':'')+'</div>'};
  h+='<div class="kpis cl-kpis">'+k(full?'Візитів':'Візитів у вас',st.visits,st.lastDate?'остан. '+relDays(st.daysSince):'')+
    (full?k('Витрачено',money(st.spent))+k('Середній чек',st.avg?money(st.avg):'—'):k('Останній візит',st.lastDate?D.shortH(st.lastDate):'—'))+
    k('Не прийшов',rk.ns,rk.late?plu(rk.late,'пізнє скасування','пізніх скасувань','пізніх скасувань'):(rk.ns?'':'жодної неявки'))+
    k('Інтервал',st.avgGap?st.avgGap+NB+'дн.':'—',st.avgGap?'у середньому між візитами':'замало візитів')+
    k('Надійність',rk.rel==null?'—':rk.rel+'%',rk.lvl===2?'високий ризик':rk.lvl===1?'підвищений ризик':rk.rel==null?'':'без ризику')+'</div>';
  /* сітка */
  h+='<div class="cl-grid"><aside class="cl-aside" id="cl-aside">'+asideHtml(c,g,st,full)+'</aside><section class="cl-main"><div class="tabs" role="tablist" id="cl-tabs">'+tabsHtml(c,tabs,tab)+'</div><div id="cl-tab">'+tabBody(tab,c,g,st)+'</div></section></div></div>';
  v.innerHTML=h;
  var root=$('#cl-card',v);
  wireCard(root,c,tabs);
}
function tabsHtml(c,tabs,tab){var cnt={visits:stats(c.id).all.length,rev:clientReviews(c.id).length,notes:(c.prefs||[]).length};
  return tabs.map(function(t){return '<button role="tab" data-a="tab" data-v="'+t[0]+'" aria-selected="'+(t[0]===tab)+'">'+t[1]+(cnt[t[0]]?' <span class="cnt">'+(t[0]==='visits'?scopedCount(c):cnt[t[0]])+'</span>':'')+'</button>'}).join('')}
function scopedCount(c){return scoped(c).all.length}

function asideHtml(c,g,st,full){var rk=g.rk,h='',nx=st.next;
  /* наступний запис */
  h+='<div class="card cl-nx"><h3>Наступний запис</h3>';
  if(nx){var ms=App.staff(nx.staff);h+='<button class="cl-nxb" data-a="openappt" data-id="'+nx.id+'"><b>'+D.human(nx.date,{wd:true})+', '+U.hm(nx.start)+'</b><span>'+esc(App.apptTitle(nx))+'</span><small>'+(ms?esc(ms.short):'')+' · '+App.ST[nx.status].n.toLowerCase()+(full?' · '+money(App.apptTotal(nx)):'')+'</small></button>'}
  else{var hint='';if(st.avgGap&&st.lastDate){var due=D.add(st.lastDate,st.avgGap);hint=D.diff(App.today(),due)>=0?'Зазвичай повертається раз на '+st.avgGap+NB+'дн. — наступний візит близько '+D.human(due)+'.':'Мав(ла) прийти близько '+D.human(due)+' (раз на '+st.avgGap+NB+'дн.).'}
    h+='<p class="cl-nxe">Майбутніх записів немає.'+(hint?'<br><span class="mute">'+hint+'</span>':'')+'</p><button class="btn pri blk" data-a="book">'+I('plus')+'Записати</button>'}
  h+='</div>';
  /* надійність */
  var relV=rk.rel==null?0:rk.rel;
  h+='<div class="card"><h3>Ризик не прийти'+(rk.lvl?'<span class="sp"></span><span class="badge '+(rk.lvl===2?'dng':'warn')+'">'+(rk.lvl===2?'Високий':'Середній')+'</span>':'<span class="sp"></span><span class="badge ok">Низький</span>')+'</h3>'+
    '<div class="cl-rel"><b class="num">'+(rk.rel==null?'—':rk.rel+'%')+'</b><div class="bar-h"><i style="width:'+relV+'%;background:'+(rk.lvl===2?'var(--danger)':rk.lvl===1?'var(--warn)':'var(--ok)')+'"></i></div></div>'+
    '<dl class="dl"><dt>Неявок</dt><dd>'+rk.ns+'</dd><dt>Пізніх скасувань</dt><dd>'+rk.late+'</dd><dt>Скасовано завчасно</dt><dd>'+(g.cancelled-rk.late)+'</dd></dl>'+
    '<p class="cl-hint">Попередження з '+rk.warnAt+' випадків, високий ризик з '+rk.blockAt+'. Налаштовується в «Налаштування → Запис».</p></div>';
  /* профіль */
  var fs=favSvc(g),lastS=st.last?st.last.items.map(function(x){return svcName(x.svc)}).join(' + '):'';
  var can=full;
  var srcOpts=Object.keys(SRC).map(function(k){return '<option value="'+k+'"'+(c.src===k?' selected':'')+'>'+SRC[k]+'</option>'}).join('')+(c.src&&!SRC[c.src]?'<option value="'+esc(c.src)+'" selected>'+esc(srcName(c.src))+'</option>':'');
  h+='<div class="card"><h3>Профіль</h3><dl class="dl cl-prof">'+
    '<dt>День народження</dt><dd>'+(c.bd?bdText(c)+(ageOf(c)!=null?' · '+ageOf(c)+NB+'р.':''):'<span class="faint">не вказано</span>')+'</dd>'+
    '<dt>Клієнт</dt><dd>'+(c.created?'з '+D.human(c.created,{year:true})+' ('+monthsSince(c.created)+')':'—')+'</dd>'+
    '<dt>Перший візит</dt><dd>'+(st.first?D.human(st.first,{year:true}):'—')+'</dd>'+
    '<dt>Останній візит</dt><dd>'+(st.lastDate?D.human(st.lastDate,{year:true}):'—')+'</dd>'+
    (lastS?'<dt>Остання послуга</dt><dd class="cl-wrapd">'+esc(lastS)+'</dd>':'')+
    (fs?'<dt>Частіше обирає</dt><dd class="cl-wrapd">'+esc(svcName(fs))+'</dd>':'')+
    '<dt>Майстер</dt><dd>'+(st.fav?esc(stfName(st.fav)):'—')+'</dd>'+
    '<dt>Джерело</dt><dd>'+(can?'<select class="sel cl-sel" data-f="src" aria-label="Джерело">'+srcOpts+'</select>':esc(srcName(c.src)))+'</dd>'+
    '<dt>Є Telegram</dt><dd>'+(can?UI.sw('tg',c.tg,'data-f="tg" aria-label="Є Telegram"'):(c.tg?'так':'ні'))+'</dd></dl></div>';
  return h}

function tabBody(tab,c,g,st){return ({visits:tabVisits,fin:tabFin,notes:tabNotes,rev:tabRev,consent:tabConsent,log:tabLog}[tab]||tabVisits)(c,g,st)}

function tabVisits(c,g,st){var full=isFull(),T=App.today();
  var all=st.all.slice().sort(function(a,b){return (a.date+String(a.start).padStart(4,'0'))<(b.date+String(b.start).padStart(4,'0'))?1:-1});
  var fl={all:all,done:all.filter(function(a){return a.status==='done'}),up:all.filter(function(a){return a.date>=T&&a.status!=='done'&&a.status!=='cancelled'&&a.status!=='noshow'}),bad:all.filter(function(a){return a.status==='noshow'||a.status==='cancelled'})};
  var vf=CT.vf;if(!fl[vf])vf='all';
  var seg='<div class="seg cl-vseg">'+[['all','Усі'],['done','Завершені'],['up','Майбутні'],['bad','Скасовані']].map(function(s){return '<button data-a="vf" data-v="'+s[0]+'" aria-pressed="'+(vf===s[0])+'">'+s[1]+' <span class="mute">'+fl[s[0]].length+'</span></button>'}).join('')+'</div>';
  var rows=fl[vf];
  if(!all.length)return UI.empty('cal','Візитів ще не було','Запишіть клієнта — історія зʼявиться тут.','<button class="btn pri" data-a="book" style="margin-top:8px">'+I('plus')+'Записати</button>');
  var body=rows.length?'<div class="tbl-wrap cards"><table class="tbl cl-vt"><thead><tr><th>Дата</th><th>Послуги</th><th>Майстер</th><th>Статус</th>'+(full?'<th class="r">Сума</th>':'')+'</tr></thead><tbody>'+rows.map(function(a){
      var tot=App.apptTotal(a),dim=a.status==='cancelled'||a.status==='noshow';
      return '<tr class="click" data-a="openappt" data-id="'+a.id+'"><td class="nw cl-vd"><b>'+D.human(a.date,{year:true})+'</b> <span class="mute">'+U.hm(a.start)+'</span></td><td class="cl-vs">'+esc(App.apptTitle(a))+(a.discount?' <span class="tag">−'+(a.discount.type==='pct'?a.discount.v+'%':money(a.discount.v))+'</span>':'')+'</td><td class="nw cl-vm">'+esc(stfName(a.staff))+'</td><td class="nw cl-vst">'+UI.badge(a.status)+'</td>'+(full?'<td class="r num nw cl-vsum'+(dim?' faint':'')+'">'+money(tot)+'</td>':'')+'</tr>'}).join('')+'</tbody>'+
      (full&&vf!=='up'?'<tfoot><tr><td colspan="5" class="cl-vf"><span>'+plu(fl.done.length,'завершений візит','завершені візити','завершених візитів')+'</span><b class="num">'+money(U.sum(fl.done,function(a){return App.apptTotal(a)}))+'</b></td></tr></tfoot>':'')+'</table></div>':UI.empty('search','Немає записів','У цьому фільтрі нічого немає.');
  return '<div class="cl-vh hscroll">'+seg+'</div>'+body}

function tabFin(c,g,st){var h='',pays=clientPays(c),T=App.today(),mod=App.db.settings.modules;
  var sum=function(kinds){return U.sum(pays.filter(function(p){return kinds.indexOf(p.kind)>=0}),function(p){return p.amount})};
  var paid=sum(['service','deposit','product','cert_sale','abon_sale','refund']),tips=sum(['tip']),ref=-sum(['refund']);
  var upDep=g.all.filter(function(a){return a.deposit>0&&a.date>=T&&a.status!=='cancelled'&&a.status!=='done'&&a.status!=='noshow'});
  var depSum=U.sum(upDep,function(a){return a.deposit});
  h+='<div class="cl-fin">';
  h+='<div class="card"><h3>Підсумок</h3><dl class="dl"><dt>Оплачено всього</dt><dd class="num">'+money(paid)+'</dd><dt>З них за послуги</dt><dd class="num">'+money(st.spent)+'</dd><dt>Чайові</dt><dd class="num">'+money(tips)+'</dd><dt>Повернення</dt><dd class="num">'+(ref?money(ref):'—')+'</dd><dt>Депозити в майбутніх записах</dt><dd class="num">'+(depSum?money(depSum):'—')+'</dd></dl>'+
    '<div class="cl-fa"><button class="btn sm" data-a="sellprod">'+I('box')+'Продати товар</button></div></div>';
  if(mod.abons!==false){var abs=App.db.abons.filter(function(a){return a.client===c.id});
    h+='<div class="card"><h3>Абонементи<span class="sp"></span><button class="btn sm" data-a="sellabon">'+I('plus')+'Продати</button></h3>'+(abs.length?abs.map(function(ab){var t=App.db.abonTypes.find(function(x){return x.id===ab.type}),exp=ab.expires<T&&ab.left>0,used=ab.left<=0;
      return '<div class="cl-ab"><div class="row"><b class="ell">'+esc(t?t.n:'Абонемент')+'</b><span class="sp"></span><span class="badge '+(used?'plain':exp?'dng':'ok')+'">'+(used?'Використано':exp?'Прострочено':'Активний')+'</span></div><div class="bar-h"><i style="width:'+Math.round(100*(ab.qty-ab.left)/ab.qty)+'%"></i></div><small class="mute">Залишилось '+ab.left+' з '+ab.qty+' · до '+D.human(ab.expires,{year:true})+' · '+money(ab.price)+'</small></div>'}).join(''):'<p class="cl-nxe mute">Абонементів немає.</p>')+'</div>'}
  if(mod.certs!==false){var cs=App.db.certs.filter(function(g2){return g2.buyer===c.id});
    h+='<div class="card"><h3>Сертифікати куплені<span class="sp"></span><button class="btn sm" data-a="sellcert">'+I('plus')+'Продати</button></h3>'+(cs.length?cs.map(function(g2){var exp=g2.status==='active'&&g2.expires<T,stt=g2.status==='used'?'Використано':exp||g2.status==='expired'?'Прострочено':'Активний';
      return '<div class="cl-ab"><div class="row"><b class="ell">'+esc(g2.code)+(g2.recipient?' <span class="mute">· '+esc(g2.recipient)+'</span>':'')+'</b><span class="sp"></span><span class="badge '+(stt==='Активний'?'ok':stt==='Використано'?'plain':'dng')+'">'+stt+'</span></div><small class="mute">Номінал '+money(g2.nominal)+' · залишок '+money(g2.balance)+' · до '+D.human(g2.expires,{year:true})+'</small></div>'}).join(''):'<p class="cl-nxe mute">Сертифікатів не купував(ла).</p>')+'</div>'}
  if(upDep.length)h+='<div class="card"><h3>Депозити</h3>'+upDep.map(function(a){return '<button class="cl-ab cl-abb" data-a="openappt" data-id="'+a.id+'"><div class="row"><b>'+D.human(a.date)+' '+U.hm(a.start)+'</b><span class="sp"></span><b class="num">'+money(a.deposit)+'</b></div><small class="mute">'+esc(App.apptTitle(a))+'</small></button>'}).join('')+'</div>';
  h+='</div>';
  h+='<div class="card flush cl-pays"><div class="card-h"><b>Платежі</b><span class="sp"></span><span class="mute">'+pays.length+'</span></div>'+(pays.length?'<div class="tbl-wrap cards" style="border:0;border-radius:0"><table class="tbl cl-pt"><thead><tr><th>Дата</th><th>За що</th><th>Спосіб</th><th class="r">Сума</th></tr></thead><tbody>'+pays.slice(0,60).map(function(p){var a=p.appt&&App.appt(p.appt);
      return '<tr'+(a?' class="click" data-a="openappt" data-id="'+a.id+'"':'')+'><td class="nw cl-pd">'+D.human(p.date,{year:true})+'</td><td class="cl-pk">'+PAYK[p.kind]+(a?' <span class="mute">· '+esc(App.apptTitle(a))+'</span>':'')+'</td><td class="nw cl-pm mute">'+esc(methodName(p.method))+'</td><td class="r num nw cl-pa'+(p.amount<0?' dng-t':'')+'">'+(p.amount<0?'−':'')+money(Math.abs(p.amount))+'</td></tr>'}).join('')+'</tbody></table></div>'+(pays.length>60?'<div class="cl-note-s mute">Показано 60 останніх платежів із '+pays.length+'.</div>':''):UI.empty('receipt','Платежів ще немає'))+'</div>';
  return h}

function tabNotes(c,g,st){var full=isFull(),prefs=c.prefs||[],h='<div class="cl-notes">';
  h+='<div class="card"><h3>Нотатка про клієнта</h3><textarea class="ta" data-f="note" rows="4" placeholder="Характер, побажання, важливе для адміністратора…"'+(full?'':' ')+'>'+esc(c.note||'')+'</textarea><small class="mute">Зберігається, коли ви виходите з поля.</small></div>';
  h+='<div class="card cl-warnc"><h3>'+I('alert','s')+'Алергії та протипоказання</h3><textarea class="ta" data-f="allergy" rows="3" placeholder="Напр.: алергія на акрилати, вагітність, чутлива шкіра…">'+esc(c.allergy||'')+'</textarea><small class="mute">Показується застереженням у верхній частині картки.</small></div>';
  h+='<div class="card"><h3>Уподобання та формули<span class="sp"></span><button class="btn sm" data-a="prefadd">'+I('plus')+'Додати</button></h3>'+(prefs.length?prefs.map(function(p,i){return '<div class="cl-pref"><div class="cl-prefh"><b>'+esc(p.title||'Нотатка')+'</b>'+(p.svc?'<span class="tag">'+esc(svcName(p.svc))+'</span>':'')+'<span class="sp"></span><button class="icobtn sm ghost" data-a="prefedit" data-i="'+i+'" aria-label="Редагувати">'+I('edit')+'</button><button class="icobtn sm ghost" data-a="prefdel" data-i="'+i+'" aria-label="Видалити">'+I('trash')+'</button></div><p>'+esc(p.text||'').replace(/\n/g,'<br>')+'</p>'+(p.upd?'<small class="mute">оновлено '+D.human(p.upd)+'</small>':'')+'</div>'}).join(''):'<p class="cl-nxe mute">Тут можна зберігати формулу фарби, довжину, улюблені матеріали, побажання по кожній послузі.</p>')+'</div>';
  var an=st.all.filter(function(a){return a.note}).sort(function(a,b){return a.date<b.date?1:-1}).slice(0,10);
  if(an.length)h+='<div class="card"><h3>Нотатки з записів</h3>'+an.map(function(a){return '<button class="cl-ab cl-abb" data-a="openappt" data-id="'+a.id+'"><div class="row"><b>'+D.human(a.date,{year:true})+'</b><span class="sp"></span><small class="mute">'+esc(stfName(a.staff))+'</small></div><small>'+esc(a.note)+'</small></button>'}).join('')+'</div>';
  return h+'</div>'}

function tabRev(c){var rs=clientReviews(c.id);
  if(!rs.length)return UI.empty('star','Відгуків немає','Відгуки клієнта з Google та Telegram зʼявляться тут.');
  var avg=U.sum(rs,function(r){return r.rating})/rs.length;
  return '<div class="cl-revsum"><b class="num">'+avg.toFixed(1).replace('.',',')+'</b><span class="cl-stars">'+stars(Math.round(avg))+'</span><span class="mute">'+plu(rs.length,'відгук','відгуки','відгуків')+'</span></div><div class="list">'+rs.map(function(r){return '<div class="li cl-rev"><div class="t"><div class="row"><span class="cl-stars">'+stars(r.rating)+'</span><span class="mute">'+D.human(r.date,{year:true})+' · '+esc(stfName(r.staff))+' · '+(r.src==='google'?'Google':r.src==='tg'?'Telegram':esc(r.src||''))+'</span>'+(r.hidden?'<span class="badge plain">Прихований</span>':'')+'</div><p>'+esc(r.text)+'</p>'+(r.reply?'<div class="cl-reply"><small class="mute">Відповідь салону</small><br>'+esc(r.reply)+'</div>':'')+'</div></div>'}).join('')+'</div>'}
function stars(n){var s='';for(var i=1;i<=5;i++)s+=i<=n?'★':'☆';return s}

function tabConsent(c){var cs=c.consent||{sms:true,promo:false};
  return '<div class="card cl-cons"><h3>Згоди клієнта</h3>'+
   '<div class="set-row"><div class="t"><b>Службові повідомлення</b><small>Нагадування про запис, перенесення, підтвердження</small></div>'+UI.sw('sms',cs.sms,'data-f="sms" aria-label="Службові повідомлення"')+'</div>'+
   '<div class="set-row"><div class="t"><b>Акції та розсилки</b><small>Знижки, новини салону, привітання з днем народження</small></div>'+UI.sw('promo',cs.promo,'data-f="promo" aria-label="Акції та розсилки"')+'</div>'+
   (cs.at?'<small class="mute">Остання зміна: '+D.human(cs.at,{year:true})+'</small>':'')+'</div>'+
   '<div class="card"><h3>Персональні дані</h3><p class="cl-cp">За запитом клієнта ви можете передати йому всі дані, що зберігаються про нього, або видалити його профіль. Записи залишаться в журналі салону без імені.</p><div class="row wrap"><button class="btn" data-a="export">'+I('download')+'Вивантажити дані клієнта</button><button class="btn dng" data-a="del">'+I('trash')+'Видалити клієнта</button></div></div>'}

function logEntries(c,g){var ids={};g.all.forEach(function(a){ids[a.id]=a});var out=[];
  App.db.audit.forEach(function(e){var m=e.ent&&e.ent.indexOf('appt:')===0&&ids[e.ent.slice(5)];if(e.ent==='client:'+c.id||m)out.push({ts:e.ts,who:e.who,txt:e.txt,apx:!!m})});
  g.all.forEach(function(a){(a.events||[]).forEach(function(ev){out.push({ts:ev.ts,who:ev.who,txt:ev.txt,ap:a})})});
  var seen={};out=out.filter(function(e){if(!e.ap&&!e.apx)return true;var k=e.ts+e.txt;if(seen[k])return false;seen[k]=1;return true});
  return out.sort(function(a,b){return a.ts<b.ts?1:a.ts>b.ts?-1:0})}
function tabLog(c,g){var es=logEntries(c,g).slice(0,80);
  if(!es.length)return UI.empty('history','Журнал порожній','Тут зʼявляться зміни по клієнту та його записах.');
  return '<div class="list">'+es.map(function(e){var w=App.staff(e.who);return '<div class="li cl-lg"><div class="t"><b>'+esc(e.txt)+'</b><small>'+D.shortH(e.ts.slice(0,10))+' '+e.ts.slice(11,16)+' · '+(w?esc(w.short):'система')+'</small></div></div>'}).join('')+'</div>'+(logEntries(c,g).length>80?'<div class="cl-note-s mute">Показано 80 останніх записів.</div>':'')}

/* ───── обробники картки ───── */
function wireCard(root,c,tabs){
  var id=c.id;
  function setTab(t){var g=stats(id),st=scoped(c);history.replaceState(null,'','#/clients/'+id+(t!=='visits'?'?tab='+t:''));
    root.querySelector('#cl-tabs').innerHTML=tabsHtml(c,tabs,t);root.querySelector('#cl-tab').innerHTML=tabBody(t,c,g,st)}
  function curTab(){var b=root.querySelector('#cl-tabs [aria-selected=true]');return b?b.dataset.v:'visits'}
  function save(patch,msg){O.upsertClient(Object.assign({id:id},patch));if(msg!==false)UI.toast(msg||'Збережено')}
  root.addEventListener('click',function(e){var b=e.target.closest('[data-a]');if(!b)return;var a=b.dataset.a;
    switch(a){
      case 'tab':setTab(b.dataset.v);break;
      case 'vf':CT.vf=b.dataset.v;setTab(curTab());break;
      case 'copy':copyText('+'+c.ph,'Номер скопійовано');break;
      case 'book':App.newAppt({client:id});break;
      case 'openappt':App.openAppt(b.dataset.id);break;
      case 'tags':tagPicker(c);break;
      case 'menu':cardMenu(b,c);break;
      case 'sellabon':App.sellAbon({client:id});break;
      case 'sellcert':App.sellCert({buyer:id});break;
      case 'sellprod':App.sellProduct({client:id});break;
      case 'prefadd':prefModal(c,-1);break;
      case 'prefedit':prefModal(c,+b.dataset.i);break;
      case 'prefdel':prefDel(c,+b.dataset.i);break;
      case 'export':exportClientData(c);break;
      case 'del':deleteFlow(c);break}
  });
  root.addEventListener('change',function(e){var t=e.target,f=t.dataset.f;if(!f)return;
    if(f==='note'){if(t.value!==(c.note||''))save({note:t.value.trim()})}
    else if(f==='allergy'){if(t.value.trim()!==(c.allergy||'')){save({allergy:t.value.trim()});App.refresh()}}
    else if(f==='src'){save({src:t.value})}
    else if(f==='tg'){save({tg:t.checked});App.refresh()}
    else if(f==='sms'||f==='promo'){var cs=Object.assign({sms:true,promo:false},c.consent);cs[f]=t.checked;cs.at=App.today();save({consent:cs},t.checked?'Згоду надано':'Згоду знято');App.refresh()}
  });
}

function tagPicker(c){
  UI.modal({title:'Мітки',sub:esc(c.n),size:'narrow',body:'<div id="cl-tp"></div>',foot:'<button class="btn ghost" data-mg>Керувати мітками</button><span class="sp"></span><button class="btn pri" data-ok>Готово</button>',
    onClose:function(){App.refresh()},
    onMount:function(el,close){var box=el.querySelector('#cl-tp');
      function draw(){var cc=App.client(c.id);box.innerHTML='<div class="col-f">'+App.db.tags.map(function(t){return '<label class="check"><input type="checkbox" data-t="'+t.id+'"'+(cc.tags.indexOf(t.id)>=0?' checked':'')+'> '+esc(t.n)+'</label>'}).join('')+'</div>'+
        '<div class="cl-tgr cl-tgnew" style="margin-top:12px"><input class="inp" id="cl-tpn" placeholder="Нова мітка"><button class="btn" data-add>'+I('plus')+'Додати</button></div>'}
      draw();
      box.addEventListener('change',function(e){var t=e.target.dataset.t;if(t)O.tagClients([c.id],t,e.target.checked)});
      box.addEventListener('click',function(e){if(!e.target.closest('[data-add]'))return;var inp=box.querySelector('#cl-tpn'),v=inp.value.trim();if(!v){inp.classList.add('err');return}
        if(App.db.tags.some(function(t){return t.n.toLowerCase()===v.toLowerCase()})){UI.toast('Така мітка вже є',{type:'err'});return}
        var t=O.upsert('tags',{n:v},'Нова мітка «'+v+'»');O.tagClients([c.id],t.id,true);draw()});
      box.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.id==='cl-tpn')box.querySelector('[data-add]').click()});
      el.querySelector('[data-ok]').onclick=close;el.querySelector('[data-mg]').onclick=function(){close();setTimeout(tagsModal,0)}}})}

function cardMenu(anchor,c){var vip=c.tags.indexOf('vip')>=0;
  UI.menu(anchor,[
    {t:'Редагувати',ic:'edit',fn:function(){UI.clientForm(c,function(){App.refresh()})}},
    {t:vip?'Зняти VIP':'Позначити VIP',ic:'star',fn:function(){O.tagClients([c.id],'vip',!vip);UI.toast(vip?'VIP знято':'Позначено VIP');App.refresh()}},
    {t:'Обʼєднати з дублікатом…',ic:'merge',fn:function(){mergeModal(c.id)}},
    {t:'Вивантажити дані (JSON)',ic:'download',fn:function(){exportClientData(c)}},'-',
    c.blocked?{t:'Зняти з чорного списку',ic:'check',fn:function(){O.unblockClient(c.id);UI.toast('Знято з чорного списку');App.refresh()}}:{t:'До чорного списку…',ic:'ban',fn:function(){blockFlow(c)}},
    {t:'Видалити…',ic:'trash',dng:true,fn:function(){deleteFlow(c)}}])}

function blockFlow(c){UI.confirm({title:'Додати до чорного списку?',text:esc(c.n)+' буде позначено в списку клієнтів і в картці. Записи, що вже створені, не змінюються.',input:'Причина (необовʼязково)',placeholder:'Напр. 3 неявки поспіль',ok:'Додати',danger:true}).then(function(y){
  if(!y)return;O.blockClient(c.id,typeof y==='string'?y.trim():'');UI.toast('Додано до чорного списку',{undo:function(){O.unblockClient(c.id);App.refresh()}});App.refresh()})}

function deleteFlow(c){var g=stats(c.id),n=g.all.length;
  UI.confirm({title:'Видалити клієнта?',text:'<b>'+esc(c.n)+'</b> зникне зі списку. '+(n?plu(n,'запис','записи','записів')+' залишаться в календарі та касі як «без імені» — виручка й звіти не зміняться.':'Записів у клієнта немає.')+' Відгуки лишаться без привʼязки до клієнта.',ok:'Видалити',danger:true}).then(function(y){
    if(!y)return;
    var snap={c:JSON.parse(JSON.stringify(c)),appts:g.all.map(function(a){return a.id}),reviews:App.db.reviews.filter(function(r){return r.client===c.id}).map(function(r){return r.id}),pays:App.db.payments.filter(function(p){return p.client===c.id}).map(function(p){return p.id}),wl:App.db.waitlist.filter(function(w){return w.client===c.id}).map(function(w){return JSON.parse(JSON.stringify(w))})};
    O.deleteClient(c.id);
    UI.toast('Клієнта видалено',{undo:function(){O.restoreClient(snap);UI.toast('Клієнта відновлено');if(App.cur&&App.cur.rt.id==='clients')App.refresh()}});
    App.go('clients')})}

function exportClientData(c){var g=stats(c.id),ids={};g.all.forEach(function(a){ids[a.id]=1});
  var data={exportedAt:new Date().toISOString(),salon:App.db.salon.name,client:c,
    appointments:g.all.map(function(a){return {id:a.id,date:a.date,start:U.hm(a.start),master:stfName(a.staff),status:a.status,services:a.items,total:App.apptTotal(a),note:a.note}}),
    payments:clientPays(c),certificates:App.db.certs.filter(function(x){return x.buyer===c.id}),abonements:App.db.abons.filter(function(x){return x.client===c.id}),
    reviews:clientReviews(c.id),journal:logEntries(c,g)};
  U.download('klient-'+c.id+'-'+App.today()+'.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
  App.log('export','client:'+c.id,'Вивантажено дані клієнта '+c.n);App.save(true);UI.toast('Дані клієнта вивантажено')}

function prefModal(c,i){var cc=App.client(c.id),prefs=(cc.prefs||[]).slice(),p=i>=0?prefs[i]:{title:'',svc:'',text:''};
  UI.modal({title:i>=0?'Редагувати':'Нове уподобання',size:'narrow',
    body:'<div class="col-f g12"><label class="fld"><span>Назва</span><input class="inp" name="t" list="cl-pl" value="'+esc(p.title||'')+'" placeholder="Напр. Формула фарби"><datalist id="cl-pl">'+PREF_SUG.map(function(s){return '<option value="'+s+'">'}).join('')+'</datalist></label>'+
     '<label class="fld"><span>Послуга <small>необовʼязково</small></span><select class="sel" name="s"><option value="">Загальне</option>'+App.db.services.filter(function(s){return s.active!==false}).map(function(s){return '<option value="'+s.id+'"'+(p.svc===s.id?' selected':'')+'>'+esc(s.n)+'</option>'}).join('')+'</select></label>'+
     '<label class="fld"><span>Опис</span><textarea class="ta" name="x" rows="4" placeholder="Напр. 6.1 + 7.0 (1:1), окисник 6%, 40 хв">'+esc(p.text||'')+'</textarea></label></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
    onMount:function(el,close){el.querySelector('[data-no]').onclick=close;el.querySelector('[data-ok]').onclick=function(){var f=function(n){return el.querySelector('[name='+n+']')};
      var t=f('t').value.trim(),x=f('x').value.trim();if(!t&&!x){f('x').classList.add('err');return}
      var np={id:p.id||U.uid('pf'),title:t||'Нотатка',svc:f('s').value,text:x,upd:App.today()};if(i>=0)prefs[i]=np;else prefs.push(np);
      O.upsertClient({id:c.id,prefs:prefs});close();UI.toast(i>=0?'Збережено':'Додано');App.refresh()}}})}
function prefDel(c,i){var cc=App.client(c.id),prev=(cc.prefs||[]).slice(),next=prev.filter(function(_,k){return k!==i});
  O.upsertClient({id:c.id,prefs:next});UI.toast('Видалено',{undo:function(){O.upsertClient({id:c.id,prefs:prev});App.refresh()}});App.refresh()}

/* ───── обʼєднання ───── */
function mergeModal(keepId,dropId,after){
  var m=UI.modal({title:'Обʼєднати клієнтів',sub:'Усі записи, абонементи й відгуки перейдуть до одного профілю',size:'wide',body:'<div id="cl-mg"></div>',foot:'<div id="cl-mgf" style="display:contents"></div>',
    onMount:function(el,close){var box=el.querySelector('#cl-mg'),foot=el.querySelector('#cl-mgf'),keep=keepId,drop=dropId,preset=!!dropId;
      function pickView(){foot.innerHTML='<span class="sp"></span><button class="btn" data-no>Скасувати</button>';foot.querySelector('[data-no]').onclick=close;
        var cand=findDups().filter(function(g){return g.ids.indexOf(keep)>=0}).reduce(function(a,g){return a.concat(g.ids.filter(function(x){return x!==keep}))},[]);
        box.innerHTML='<p class="cl-cp">Оберіть клієнта-дублікат до <b>'+esc(App.client(keep).n)+'</b>:</p><div class="inp-ic">'+I('search')+'<input class="inp" id="cl-mq" placeholder="Імʼя або телефон" autocomplete="off"></div><div class="list cl-mres" id="cl-mr"></div>';
        var q=box.querySelector('#cl-mq'),res=box.querySelector('#cl-mr');
        function draw(){var v=q.value.trim().toLowerCase(),vd=v.replace(/\D/g,'');
          var list=App.db.clients.filter(function(x){return x.id!==keep&&(!v||x.n.toLowerCase().indexOf(v)>=0||(vd.length>=3&&(x.ph||'').indexOf(vd)>=0))});
          if(!v)list.sort(function(a,b){return (cand.indexOf(b.id)>=0)-(cand.indexOf(a.id)>=0)});
          res.innerHTML=list.slice(0,8).map(function(x){var s=stats(x.id);return '<button class="li" data-p="'+x.id+'">'+UI.av(x,'sm')+'<span class="t"><b>'+esc(x.n)+(cand.indexOf(x.id)>=0?' <span class="badge warn plain">можливий дублікат</span>':'')+'</b><small>'+(x.ph?U.phone(x.ph):'без телефону')+' · '+plu(s.visits,'візит','візити','візитів')+'</small></span></button>'}).join('')||'<div class="li mute">Нікого не знайдено</div>'}
        q.oninput=draw;draw();if(window.innerWidth>899)q.focus();
        res.onclick=function(e){var b=e.target.closest('[data-p]');if(b){drop=b.dataset.p;prevView()}}}
      function prevView(){var A=App.client(keep),B=App.client(drop);if(!A||!B){close();return}
        var sa=stats(A.id),sb=stats(B.id);
        var tg=function(c){return c.tags.map(function(t){var o=tagObj(t);return o?esc(o.n):''}).filter(Boolean).join(', ')||'—'};
        var row=function(l,a,b){return '<div class="cl-cr"><span class="cl-cl">'+l+'</span><span>'+a+'</span><span>'+b+'</span></div>'};
        var tot={v:sa.visits+sb.visits,s:sa.spent+sb.spent,n:sa.all.length+sb.all.length};
        box.innerHTML='<div class="cl-cmp"><div class="cl-cr cl-ch"><span></span><span><span class="badge ok">Залишиться</span><b>'+esc(A.n)+'</b></span><span><span class="badge dng">Буде видалено</span><b>'+esc(B.n)+'</b></span></div>'+
          row('Телефон',A.ph?U.phone(A.ph):'—',B.ph?U.phone(B.ph):'—')+row('Народження',A.bd?bdText(A):'—',B.bd?bdText(B):'—')+row('Візитів',sa.visits,sb.visits)+row('Витрачено',money(sa.spent),money(sb.spent))+row('Останній візит',sa.lastDate?D.human(sa.lastDate,{year:true}):'—',sb.lastDate?D.human(sb.lastDate,{year:true}):'—')+row('Мітки',tg(A),tg(B))+row('Нотатка',esc(A.note||'—'),esc(B.note||'—'))+'</div>'+
          '<div class="note acc" style="margin-top:14px">'+I('info')+'<div>Після обʼєднання: <b>'+plu(tot.n,'запис','записи','записів')+'</b>, <b>'+plu(tot.v,'візит','візити','візитів')+'</b>, <b>'+money(tot.s)+'</b>. Телефон і день народження, яких бракує, будуть взяті з другого профілю, мітки й нотатки обʼєднаються. <b>Дію не можна скасувати.</b></div></div>';
        foot.innerHTML=(preset?'':'<button class="btn ghost" data-back>Назад</button>')+'<button class="btn" data-swap>'+I('repeat')+'Поміняти місцями</button><span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Обʼєднати</button>';
        foot.querySelector('[data-no]').onclick=close;var bk=foot.querySelector('[data-back]');if(bk)bk.onclick=pickView;
        foot.querySelector('[data-swap]').onclick=function(){var t=keep;keep=drop;drop=t;prevView()};
        foot.querySelector('[data-ok]').onclick=function(){var kn=App.client(keep).n,dn=App.client(drop).n,onDrop=App.cur&&App.cur.r.params[0]===drop;O.mergeClients(keep,drop);close();UI.toast('Обʼєднано: «'+dn+'» → «'+kn+'»');
          if(after)after(keep);else if(onDrop)App.openClient(keep);else App.refresh()}}
      if(drop)prevView();else pickView()}})}

/* ═════════ дублікати ═════════ */
function renderDups(v){
  App.setTop('');
  if(!isFull()){v.innerHTML='<div class="page">'+UI.empty('lock','Немає доступу','Розділ доступний адміністратору.')+'</div>';return}
  var gs=findDups();
  var h='<div class="page"><a class="btn ghost sm cl-back" href="#/clients">'+I('left')+'Клієнти</a><div class="page-h"><h2>Дублікати клієнтів</h2><span class="mute">'+(gs.length?plu(gs.length,'група','групи','груп'):'')+'</span></div>'+
    '<p class="cl-cp">Шукаємо клієнтів з однаковим телефоном або дуже схожим імʼям. Обʼєднання переносить усі записи, абонементи й відгуки в один профіль.</p>';
  if(!gs.length)h+=UI.empty('check','Дублікатів не знайдено','Усі клієнти унікальні — база в порядку.','<a class="btn" href="#/clients" style="margin-top:8px">До списку</a>');
  else h+='<div class="cl-dups">'+gs.map(function(g,gi){
    return '<div class="card cl-dg" data-gi="'+gi+'"><div class="cl-dgh"><b>'+g.why.join(' · ')+'</b><span class="sp"></span><button class="btn sm ghost" data-a="ign" data-gi="'+gi+'">Не дублікат</button></div>'+
      g.ids.map(function(id,i){var c=App.client(id),s=stats(id);return '<div class="cl-dr"><a class="cl-dn" href="#/clients/'+id+'">'+UI.av(c,'sm')+'<span class="t"><b>'+esc(c.n)+'</b><small>'+(c.ph?U.phone(c.ph):'без телефону')+' · '+plu(s.visits,'візит','візити','візитів')+' · '+money(s.spent)+'</small></span></a>'+
        (i>0?'<button class="btn sm" data-a="merge" data-gi="'+gi+'" data-i="'+i+'">'+I('merge')+'Обʼєднати з «'+esc(App.client(g.ids[0]).n.split(' ')[0])+'»</button>':'<span class="badge ok plain">Основний</span>')+'</div>'}).join('')+'</div>'}).join('')+'</div>';
  h+='</div>';v.innerHTML=h;
  v.onclick=function(e){var b=e.target.closest('[data-a]');if(!b)return;var g=gs[+b.dataset.gi];
    if(b.dataset.a==='ign'){O.ignoreDup(g.ids);UI.toast('Позначено: це не дублікат');App.refresh()}
    else if(b.dataset.a==='merge'){mergeModal(g.ids[0],g.ids[+b.dataset.i],function(){App.refresh()})}}}

/* ═════════ маршрути ═════════ */
App.route('clients',{title:'Клієнти',icon:'users',nav:true,group:'work',order:3,perm:'clients.view',permAlt:'clients.own',
  count:function(){return allRows().length},
  render:function(v,params,q){if(params[0])renderCard(v,params[0],q);else renderList(v,params,q)}});
App.route('clients-dups',{title:'Дублікати клієнтів',icon:'users',parent:'clients',perm:'clients.view',render:renderDups});
})();
