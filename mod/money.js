/* Slotly demo — MONEY: Каса, Витрати, Зарплати, Сертифікати, Абонементи.
   Дані змінюємо ТІЛЬКИ через App.ops.* (своїх ops — нижче, за зразком core: журнал + App.save()).
   Правила бухгалтерії/зарплат — універсальні й налаштовувані: settings.accounting / settings.payroll / staff.pay. */
(function(){
'use strict';
var U=App.u,D=App.d,UI=App.ui,O=App.ops,esc=U.esc,uah=U.uah,fmt=U.fmt,I=App.icon,NB='\u00A0';
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var KIND={service:'послуга',deposit:'передоплата',tip:'чайові',product:'товар',cert:'сертифікат',abon:'абонемент',cert_sale:'продаж сертифіката',abon_sale:'продаж абонемента',refund:'повернення',transfer:'переміщення'};

/* ───────── утиліти ───────── */
function T(){return App.today()}
function pad2(n){return String(n).padStart(2,'0')}
function num(v){var n=parseFloat(String(v==null?'':v).replace(/[\s\u00A0]/g,'').replace(',','.'));return isFinite(n)?n:0}
function sum(a,f){return U.sum(a,f)}
function nowTs(d){var m=D.nowMin();return (d||T())+'T'+pad2(Math.floor(m/60))+':'+pad2(m%60)}
function monthLbl(d){var x=D.parse(d);return D.MONN[x.getMonth()]+' '+x.getFullYear()}
function dayHuman(d){return D.human(d,{wd:true})}
function mName(id){if(id==='cert')return 'Сертифікат';if(id==='abon')return 'Абонемент';var m=App.db.pay.find(function(p){return p.id===id});return m?m.n:(id||'—')}
function mKind(id){var m=App.db.pay.find(function(p){return p.id===id});return m?m.kind:'other'}
function payOn(){return App.db.pay.filter(function(p){return p.on!==false})}
function payOpts(sel){return payOn().map(function(m){return '<option value="'+m.id+'"'+(m.id===sel?' selected':'')+'>'+esc(m.n)+'</option>'}).join('')}
function feePct(id){var m=App.db.pay.find(function(p){return p.id===id});if(!m)return 0;if(m.feePct!=null)return m.feePct;return m.kind==='card'?(App.db.settings.accounting.cardFeePct||0):0}
function sname(id){var s=App.staff(id);return s?(s.short||s.n):'—'}
function cname(id){var c=App.client(id);return c?c.n:'Без клієнта'}
function svcName(id){var s=App.svc(id);return s?s.n:id}
function kpi(l,v,d,cls){return '<div class="kpi"><div class="l">'+l+'</div><div class="v">'+v+'</div>'+(d?'<div class="d '+(cls||'')+'">'+d+'</div>':'')+'</div>'}
function field(label,inner,hint){return '<label class="fld"><span>'+label+(hint?' <small>'+hint+'</small>':'')+'</span>'+inner+'</label>'}
function sufInp(name,val,suf,ph){return '<div class="inp-suf"><input name="'+name+'" inputmode="decimal" autocomplete="off" value="'+esc(val==null?'':val)+'" placeholder="'+(ph||'0')+'"><span>'+(suf||'₴')+'</span></div>'}
function segHtml(items,cur,attr){return '<div class="seg" role="group">'+items.map(function(it){return '<button type="button" '+attr+'="'+it[0]+'" aria-pressed="'+(it[0]===cur)+'">'+it[1]+'</button>'}).join('')+'</div>'}
function setSeg(root,attr,val){$$('['+attr+']',root).forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute(attr)===val))})}
/* делегування кліків по [data-a] */
function on(el,map,evt){el.addEventListener(evt||'click',function(e){var b=e.target.closest('[data-a]');if(!b||!el.contains(b))return;var f=map[b.dataset.a];if(f){if(b.tagName==='A')e.preventDefault();f(b,e)}})}
function rd(el,n){var f=el.querySelector('[name="'+n+'"]');return f?f.value:''}
function bad(f){if(!f)return;f.classList.add('err');try{f.focus()}catch(e){}setTimeout(function(){f.classList.remove('err')},1800)}
function can(p,alt){return App.can(p)||(alt&&App.can(alt))}
function ensure(coll){if(!Array.isArray(App.db[coll]))App.db[coll]=[];return App.db[coll]}
function nav(parts){return '<div class="mn-nav">'+parts+'</div>'}
function rerender(){App.refresh()}
/* друк: прихований iframe з окремим документом */
var PRINT_CSS='@font-face{font-family:Fixel;src:url(assets/fonts/FixelText-Regular.woff2) format("woff2");font-weight:400}@font-face{font-family:Fixel;src:url(assets/fonts/FixelText-SemiBold.woff2) format("woff2");font-weight:600}@font-face{font-family:FixelDisplay;src:url(assets/fonts/FixelDisplay-SemiBold.woff2) format("woff2");font-weight:600}'+
 '*{box-sizing:border-box}body{margin:0;padding:24px;font-family:Fixel,system-ui,-apple-system,"Segoe UI",sans-serif;color:#121214;font-size:13px;line-height:1.45}h1,h2,h3{margin:0;font-family:FixelDisplay,Fixel,sans-serif;font-weight:600}table{width:100%;border-collapse:collapse;margin:8px 0 16px}th,td{padding:6px 8px;border-bottom:1px solid #e3e3e6;text-align:left;font-size:12.5px}th{color:#6e6e73;font-weight:600;font-size:11.5px}td.r,th.r{text-align:right}.mute{color:#6e6e73}.b{font-weight:600}.sec{margin:18px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#6e6e73;font-weight:600}.tot td{font-weight:600;border-top:1.5px solid #121214;border-bottom:0}@page{size:A4;margin:14mm}';
function printDoc(title,html,css){
  var f=document.createElement('iframe');f.setAttribute('aria-hidden','true');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';document.body.appendChild(f);
  var d=f.contentWindow.document;d.open();d.write('<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>'+esc(title)+'</title><base href="'+esc(document.baseURI)+'"><style>'+PRINT_CSS+(css||'')+'</style></head><body>'+html+'</body></html>');d.close();
  setTimeout(function(){try{f.contentWindow.focus();f.contentWindow.print()}catch(e){}setTimeout(function(){f.remove()},5000)},400)}

/* ───────── власні ops (журнал + save) ───────── */
O.moveMoney=function(o){var db=App.db,pair=U.uid('mv'),date=o.date||T(),a=Math.abs(Math.round(o.amount)),ts=nowTs(date);
  var base={appt:null,date:date,ts:ts,kind:'transfer',staff:null,by:db.meId,pair:pair,note:o.note||''};
  db.payments.push(Object.assign({id:U.uid('p'),method:o.from,amount:-a},base));
  db.payments.push(Object.assign({id:U.uid('p'),method:o.to,amount:a},base));
  App.log('move','move:'+pair,'Переміщення '+uah(a)+': '+mName(o.from)+' → '+mName(o.to)+(o.note?' — '+o.note:''));App.save();return pair};
O.deleteMove=function(pair){var db=App.db,arr=db.payments.filter(function(p){return p.pair===pair});db.payments=db.payments.filter(function(p){return p.pair!==pair});App.log('delete','move:'+pair,'Скасовано переміщення між способами');App.save();return arr};
O.restoreMove=function(arr){arr.forEach(function(p){App.db.payments.push(p)});App.log('create','move:'+(arr[0]&&arr[0].pair),'Відновлено переміщення');App.save()};
O.deleteCashOp=function(id){var db=App.db,o=db.cashOps.find(function(x){return x.id===id});db.cashOps=db.cashOps.filter(function(x){return x.id!==id});App.log('delete','cash:'+id,'Видалено касову операцію '+(o?uah(o.amount):''));App.save();return o};
O.restoreCashOp=function(o){App.db.cashOps.push(o);App.log('cash','cash:'+o.id,'Відновлено касову операцію');App.save()};
O.closeDayFull=function(date,counted,note,denoms){O.closeDay(date,counted,note);var r=App.db.dayClose[date];if(r&&denoms){r.denoms=denoms;App.save(true)}return r};
O.reopenDay=function(date){var r=App.db.dayClose[date];delete App.db.dayClose[date];App.log('close','day:'+date,'День відкрито знову: '+D.human(date));App.save();return r};
O.restoreDay=function(date,r){App.db.dayClose[date]=r;App.log('close','day:'+date,'Закриття дня відновлено');App.save()};
O.extendCert=function(id,expires,note){var g=App.db.certs.find(function(x){return x.id===id});if(!g)return;var old=g.expires;g.expires=expires;
  (g.log=g.log||[]).push({ts:nowTs(),type:'extend',note:note||'',from:old,to:expires,by:App.db.meId});if(g.balance>0&&g.status==='expired'&&expires>=T())g.status='active';
  App.log('edit','cert:'+id,'Сертифікат '+g.code+': термін до '+D.human(expires,{year:true}));App.save();return g};
O.writeOffCert=function(id,amount,reason){var g=App.db.certs.find(function(x){return x.id===id});if(!g)return;amount=Math.min(g.balance,Math.round(amount));g.balance-=amount;
  (g.log=g.log||[]).push({ts:nowTs(),type:'writeoff',amount:amount,note:reason||'',by:App.db.meId});if(g.balance<=0){g.balance=0;g.status='used'}
  App.log('edit','cert:'+id,'Списано '+uah(amount)+' з сертифіката '+g.code+(reason?' — '+reason:''));App.save();return g};
O.patchCert=function(id,patch,txt){var g=App.db.certs.find(function(x){return x.id===id});if(!g)return;Object.assign(g,patch);if(txt)App.log('edit','cert:'+id,txt);App.save();return g};
O.freezeAbon=function(id,note){var a=App.db.abons.find(function(x){return x.id===id});if(!a)return;a.status='frozen';a.frozenAt=T();(a.log=a.log||[]).push({ts:nowTs(),type:'freeze',note:note||'',by:App.db.meId});
  App.log('edit','abon:'+id,'Абонемент заморожено'+(note?' — '+note:''));App.save();return a};
O.unfreezeAbon=function(id){var a=App.db.abons.find(function(x){return x.id===id});if(!a)return;var days=Math.max(0,D.diff(a.frozenAt||T(),T()));a.expires=D.add(a.expires,days);a.status=a.left>0?'active':'used';delete a.frozenAt;
  (a.log=a.log||[]).push({ts:nowTs(),type:'unfreeze',note:'Термін подовжено на '+days+' дн.',by:App.db.meId});App.log('edit','abon:'+id,'Абонемент розморожено, +'+days+' дн.');App.save();return a};
O.extendAbon=function(id,days,note){var a=App.db.abons.find(function(x){return x.id===id});if(!a)return;a.expires=D.add(a.expires<T()?T():a.expires,days);if(a.status==='expired')a.status='active';
  (a.log=a.log||[]).push({ts:nowTs(),type:'extend',note:(note||'')+' +'+days+' дн.',by:App.db.meId});App.log('edit','abon:'+id,'Абонемент подовжено на '+days+' дн.');App.save();return a};
O.adjustAbon=function(id,delta,note){var a=App.db.abons.find(function(x){return x.id===id});if(!a)return;a.left=Math.max(0,a.left+delta);if(a.left>a.qty)a.qty=a.left;
  if(a.status!=='frozen')a.status=a.left>0?'active':'used';(a.log=a.log||[]).push({ts:nowTs(),type:'adjust',note:(delta>0?'+':'')+delta+' візит. '+(note||''),by:App.db.meId});
  App.log('edit','abon:'+id,'Залишок абонемента '+(delta>0?'+':'')+delta+(note?' — '+note:''));App.save();return a};
O.setExpCats=function(arr){App.db.expCats=arr;App.log('settings','expCats','Змінено категорії витрат');App.save()};
O.skipRecur=function(tpl,month){var a=ensure('recurSkip');a.push(tpl+'|'+month);App.log('edit','exp:'+tpl,'Пропущено повторювану витрату за '+month);App.save()};
O.stopRecur=function(tpl){App.db.expenses.forEach(function(e){if((e.tpl||e.id)===tpl){e.recur=false;e.recurStop=true}});App.log('edit','exp:'+tpl,'Повторення витрати зупинено');App.save()};
O.saveExpense=function(e){var db=App.db;var isNew=!e.id;
  if(isNew){var o=O.addExpense(e);if(o.recur&&!o.tpl){o.tpl=o.id;App.save(true)}return o}
  var x=db.expenses.find(function(y){return y.id===e.id});if(!x)return;var was=!!x.recur;Object.assign(x,e);
  if(x.recur&&!x.tpl)x.tpl=x.id;if(was&&!x.recur)O.stopRecur(x.tpl||x.id);
  if(!was&&x.recur){db.expenses.forEach(function(y){if((y.tpl||y.id)===x.tpl)delete y.recurStop});x.recur=true}
  App.log('edit','exp:'+x.id,'Змінено витрату: '+x.note+' '+uah(x.amount));App.save();return x};

/* ═════════ КАСА ═════════ */
var DENOMS=[1000,500,200,100,50,20,10];
function dayOk(s){return /^\d{4}-\d\d-\d\d$/.test(s||'')&&!isNaN(D.parse(s).getTime())}
function expCat(id){var c=App.db.expCats.find(function(x){return x.id===id});return c?c.n:'Без категорії'}
function tm(p){return (p.ts||'').slice(11,16)}
function canCashOps(){return can('cash.ops')}
function canAddExp(){return can('expenses.add')||can('expenses.*')||can('expenses.view')}
function isCloser(){var r=App.me().role;return r==='owner'||r==='accountant'||r==='admin'}
function isBoss(){var r=App.me().role;return r==='owner'||r==='accountant'}

/* розрахунок дня: всі суми, що йдуть у зведення */
function dayData(d){
  var db=App.db,pays=db.payments.filter(function(p){return p.date===d}).sort(function(a,b){return (a.ts||'')<(b.ts||'')?-1:1});
  var m=App.money(d,d);
  var exps=db.expenses.filter(function(e){return e.date===d});
  var pouts=db.payouts.filter(function(p){return p.date===d&&(p.type==='salary'||p.type==='advance')});
  var ops=db.cashOps.filter(function(o){return o.date===d});
  var cashIn=sum(pays.filter(function(p){return p.method==='cash'}),function(p){return p.amount});
  var cashExp=sum(exps.filter(function(e){return e.method==='cash'}),function(e){return e.amount});
  var cashPay=sum(db.payouts.filter(function(p){return p.date===d&&p.method==='cash'}),function(p){return p.amount});
  var opsIn=sum(ops.filter(function(o){return o.type==='in'}),function(o){return o.amount});
  var opsOut=sum(ops.filter(function(o){return o.type==='out'}),function(o){return o.amount});
  var open=App.cashBalance(D.add(d,-1)),close=App.cashBalance(d);
  var byKind={card:0,transfer:0,cash:0};
  Object.keys(m.byMethod).forEach(function(k){var kd=mKind(k);if(byKind[kd]!=null)byKind[kd]+=m.byMethod[k]});
  return {pays:pays,m:m,exps:exps,pouts:pouts,ops:ops,cashIn:cashIn,cashExp:cashExp,cashPay:cashPay,opsIn:opsIn,opsOut:opsOut,open:open,close:close,byKind:byKind,rec:db.dayClose[d]||null,
    check:Math.round(open+cashIn-cashExp-cashPay+opsIn-opsOut)===Math.round(close)};
}
/* візити дня без повної оплати */
function unpaidOn(d){
  var T0=T(),now=D.nowMin();
  return App.apptsOn(d).filter(function(a){
    if(a.status==='cancelled'||a.status==='noshow')return false;
    var tot=App.apptTotal(a);if(tot<=0)return false;
    if(a.status==='arrived')return true;
    if(a.status==='done')return App.apptDue(a)>0;
    if(a.status==='new'||a.status==='confirmed'){return d<T0||(d===T0&&App.apptEnd(a)<=now)}
    return false}).map(function(a){return a})}
function unpaidLbl(a){return a.status==='arrived'?'у кріслі':a.status==='done'?'не доплачено':'не закрито'}

function groupPays(pays,d){
  var g={},order=[];
  pays.forEach(function(p){var k=p.pair?'m:'+p.pair:p.appt?'a:'+p.appt:'p:'+p.id;if(!g[k]){g[k]={k:k,pair:p.pair,appt:p.appt,items:[],ts:p.ts};order.push(k)}g[k].items.push(p)});
  return order.map(function(k){return g[k]}).sort(function(a,b){return (a.ts||'')<(b.ts||'')?1:-1})}
function groupInfo(gr,d){
  var p0=gr.items[0],a=gr.appt?App.appt(gr.appt):null,t='',s='',cls='';
  if(gr.pair){var neg=gr.items.find(function(p){return p.amount<0}),pos=gr.items.find(function(p){return p.amount>0});t='Переміщення між способами';s=(neg?mName(neg.method):'?')+' → '+(pos?mName(pos.method):'?')+(p0.note?' · '+p0.note:'');cls='mv'}
  else if(a){t=cname(a.client);s=App.apptTitle(a)+' · '+sname(a.staff)+(a.date!==d?' · запис '+D.shortH(a.date):'')}
  else if(p0.kind==='cert_sale'){var g=App.db.certs.find(function(x){return x.id===p0.cert});t='Продаж сертифіката '+(g?g.code:'');s=g&&g.buyer?cname(g.buyer):'покупець без імені'}
  else if(p0.kind==='abon_sale'){var ab=App.db.abons.find(function(x){return x.id===p0.abon});var ty=ab&&App.db.abonTypes.find(function(x){return x.id===ab.type});t='Продаж абонемента';s=(ty?ty.n:'')+(ab?' · '+cname(ab.client):'')}
  else if(p0.kind==='product'){var pr=App.db.products.find(function(x){return x.id===p0.product});t='Товар: '+(pr?pr.n:'—');s=(p0.client?cname(p0.client)+' · ':'')+(p0.staff?sname(p0.staff):'')}
  else{t=KIND[p0.kind]||p0.kind;s=p0.note||''}
  var total=gr.pair?Math.abs(gr.items[0].amount):sum(gr.items,function(p){return p.amount});
  return {t:t,s:s,cls:cls,total:total,appt:a}}

function weekStrip(d){
  var ws=D.weekStart(d),days=D.range(ws,D.add(ws,6)),db=App.db,T0=T();
  return '<div class="mn-week" role="group" aria-label="Тиждень">'+days.map(function(x){
    var m=App.money(x,x),closed=db.dayClose[x],has=m.inflow!==0||m.revenue!==0;
    return '<button class="mn-wd'+(x===d?' on':'')+(x===T0?' today':'')+'" data-a="day" data-d="'+x+'"'+(x===d?' aria-pressed="true"':'')+'><span class="w">'+D.WDS[D.wd(x)]+'</span><b>'+x.slice(8)+'</b><small>'+(has?fmtK(m.revenue):'—')+'</small><i class="'+(closed?(closed.diff?'warn':'lock'):(x<T0&&has?'open':''))+'"></i></button>'}).join('')+'</div>'}
function fmtK(n){n=Math.round(n);return Math.abs(n)>=10000?Math.round(n/1000)+'к':fmt(n)}

function renderCash(view,params,q){
  if(params&&params[0]==='close')return renderClose(view,q);
  App.setTop('');
  var T0=T(),d=dayOk(q.d)?q.d:T0,dd=dayData(d),db=App.db,m=dd.m,rec=dd.rec,ops=canCashOps();
  var un=unpaidOn(d),groups=groupPays(dd.pays,d);
  var prevOpen=null;
  /* стислий огляд попередніх днів без закриття — нагадування */
  if(db.settings.accounting.dayClose&&d===T0){var y=D.add(T0,-1);if(!db.dayClose[y]&&App.money(y,y).inflow)prevOpen=y}
  var h='<div class="page mn-page">';
  h+='<div class="mn-head"><div class="mn-ttl"><h2>Каса</h2><p>'+esc(dayHuman(d))+(d===T0?' · сьогодні':'')+(rec?' <span class="badge '+(rec.diff?'warn':'ok')+' mn-lockb">'+I('lock','s')+' День закрито'+(rec.diff?' · '+(rec.diff>0?'+':'')+fmt(rec.diff)+NB+'₴':'')+'</span>':'')+'</p></div>'+
    '<div class="mn-daynav"><button class="icobtn" data-a="day" data-d="'+D.add(d,-1)+'" aria-label="Попередній день">'+I('left')+'</button>'+
    '<input class="inp mn-date" type="date" value="'+d+'" data-a-in="date" aria-label="Дата">'+
    '<button class="icobtn" data-a="day" data-d="'+D.add(d,1)+'" aria-label="Наступний день">'+I('right')+'</button>'+(d!==T0?'<button class="btn" data-a="day" data-d="'+T0+'">Сьогодні</button>':'')+'</div></div>';
  h+=weekStrip(d);
  if(prevOpen)h+='<div class="note warn mn-note">'+I('alert')+'<span>Вчорашній день ('+D.human(prevOpen)+') не закрито. <a class="link" href="#/cash/close?d='+prevOpen+'">Закрити вчорашній день</a></span></div>';
  /* дії */
  h+='<div class="mn-actions">'+
    (canAddExp()?'<button class="btn" data-a="exp">'+I('receipt')+' Витрата</button>':'')+
    '<span class="sp"></span>'+
    (ops?'<button class="btn mn-opsb" data-a="ops" aria-label="Операції з касою">'+I('more')+'<span>Операції</span></button>':'')+
    (ops&&!rec?'<a class="btn pri mn-closeb" href="#/cash/close'+(d!==T0?'?d='+d:'')+'">'+I('lock')+' Закрити день</a>':'')+
    (rec&&isBoss()?'<button class="btn" data-a="reopen">'+I('undo')+' Відкрити день знову</button>':'')+'</div>';
  /* KPI */
  h+='<div class="kpis mn-kpis mn-kpis4">'+
    kpi('В касі зараз',uah(dd.close),'готівка за обліком')+
    kpi('Виторг',uah(m.revenue),m.visits+' '+plural3(m.visits,'візит','візити','візитів')+(m.avgCheck?' · чек '+uah(m.avgCheck):''))+
    kpi('Готівка',uah(dd.cashIn),m.tips?'з них чайові '+uah(m.tips):'надійшло за день')+
    kpi('Картка',uah(dd.byKind.card),dd.byKind.transfer?'+ перекази '+uah(dd.byKind.transfer):(dd.byKind.card?'у виписці '+uah(netBank(m.byMethod,'card')):'—'))+'</div>';
  h+='<div class="mn-cols"><div class="mn-main">';
  /* неоплачені */
  if(un.length){
    h+='<div class="card flush mn-unpaid"><div class="card-h">'+I('alert')+'<b>Не оплачено · '+un.length+'</b><span class="sp"></span><small class="mute">очікують розрахунку</small></div><div class="list mn-ul">'+un.map(function(a){
      var due=a.status==='done'?App.apptDue(a):App.apptTotal(a)-App.apptPaid(a);
      return '<div class="li"><button class="t mn-lk" data-a="appt" data-id="'+a.id+'"><b>'+U.hm(a.start)+' · '+esc(cname(a.client))+'</b><small>'+esc(App.apptTitle(a))+' · '+esc(sname(a.staff))+'</small></button>'+
        '<span class="badge warn">'+unpaidLbl(a)+'</span><b class="num mn-amt">'+uah(due)+'</b><button class="btn sm pri" data-a="pay" data-id="'+a.id+'">Оплатити</button></div>'}).join('')+'</div></div>'}
  /* платежі */
  h+='<div class="card flush"><div class="card-h"><b>Оплати за день</b><span class="pill-n">'+groups.length+'</span><span class="sp"></span><span class="mute mn-sm">'+uah(m.inflow)+' надійшло</span></div>';
  if(!groups.length)h+=UI.empty('wallet','Оплат за цей день немає',d>T0?'День ще не настав.':'Коли клієнт розрахується, оплата зʼявиться тут.');
  else h+='<div class="list mn-pays">'+groups.map(function(gr){
    var gi=groupInfo(gr,d);
    return '<div class="li mn-pay '+gi.cls+'"><span class="mn-tm num">'+tm(gr.items[0])+'</span><div class="t"><b class="ell">'+(gi.appt?'<button class="mn-lk" data-a="appt" data-id="'+gi.appt.id+'">'+esc(gi.t)+'</button>':esc(gi.t))+'</b><small class="mn-sub">'+esc(gi.s)+'</small>'+
      '<div class="mn-lines">'+gr.items.map(function(p){return '<span class="mn-ln'+(p.kind==='tip'?' tip':'')+(p.amount<0?' neg':'')+'">'+esc(mName(p.method))+' · '+(KIND[p.kind]||p.kind)+' <b class="num">'+(p.amount>0&&gr.pair?'+':'')+fmt(p.amount)+'</b></span>'}).join('')+'</div></div>'+
      '<div class="mn-r"><b class="num mn-amt">'+uah(gi.total)+'</b>'+(ops||gi.appt?'<button class="icobtn sm ghost" data-a="paymenu" data-k="'+gr.k+'" aria-label="Дії">'+I('more')+'</button>':'')+'</div></div>'}).join('')+'</div>';
  h+='</div>';
  /* витрати + виплати + операції */
  var rowsOut=[];
  dd.exps.forEach(function(e){rowsOut.push('<div class="li"><div class="t"><b class="ell">'+esc(e.note||expCat(e.cat))+'</b><small>'+esc(expCat(e.cat))+' · '+esc(mName(e.method))+'</small></div><b class="num mn-amt dng-t">−'+uah(e.amount)+'</b>'+(expEditable(e)?'<button class="icobtn sm ghost" data-a="expmenu" data-id="'+e.id+'" aria-label="Дії">'+I('more')+'</button>':'')+'</div>')});
  dd.pouts.forEach(function(p){rowsOut.push('<div class="li"><div class="t"><b class="ell">'+(p.type==='advance'?'Аванс':'Зарплата')+' · '+esc(sname(p.staff))+'</b><small>Виплата · '+esc(mName(p.method))+(p.note?' · '+esc(p.note):'')+'</small></div><b class="num mn-amt dng-t">−'+uah(p.amount)+'</b><span class="mn-sp"></span></div>')});
  h+='<div class="card flush"><div class="card-h"><b>Витрати та виплати</b><span class="pill-n">'+rowsOut.length+'</span><span class="sp"></span>'+(canAddExp()?'<button class="btn sm" data-a="exp">'+I('plus','s')+' Додати</button>':'')+'</div>'+
    (rowsOut.length?'<div class="list">'+rowsOut.join('')+'</div>':'<div class="mn-none">Витрат за день немає</div>')+'</div>';
  h+='</div>';
  /* права колонка */
  h+='<div class="mn-side">';
  /* закриття дня */
  h+=closeCard(d,dd);
  /* готівка */
  h+='<div class="card mn-card"><h3>Готівка в касі</h3><div class="mn-rec">'+
    recRow('На початок дня',dd.open)+recRow('Оплати готівкою',dd.cashIn,'+')+(dd.cashExp?recRow('Витрати готівкою',-dd.cashExp):'')+(dd.cashPay?recRow('Виплати зарплат готівкою',-dd.cashPay):'')+
    dd.ops.map(function(o){return '<div class="mn-rr"><span>'+(o.type==='in'?'Внесення':'Інкасація')+(o.note?' · <i>'+esc(o.note)+'</i>':'')+'</span><b class="num '+(o.type==='in'?'':'dng-t')+'">'+(o.type==='in'?'+':'−')+uah(o.amount)+'</b>'+(ops?'<button class="icobtn sm ghost" data-a="opdel" data-id="'+o.id+'" aria-label="Видалити">'+I('trash','s')+'</button>':'')+'</div>'}).join('')+
    '<div class="mn-rr tot"><span>Має бути в касі</span><b class="num">'+uah(dd.close)+'</b></div></div>'+
    (dd.check?'':'<div class="note dng">'+I('alert')+'<span>Розбіжність у розрахунку каси — перевірте операції.</span></div>')+'</div>';
  /* розріз по способах */
  h+='<div class="card mn-card"><h3>Способи оплати</h3><div class="mn-meth">'+methodsRows(dd)+'</div>'+
    '<p class="mn-fn">«У виписці» = надійшло мінус комісія еквайрингу'+(' ('+U.pct(db.settings.accounting.cardFeePct||0)+' для картки; задається в способі оплати). Витрати й виплати з рахунку у виписці йдуть окремо.')+'</p></div>';
  /* калькулятор решти */
  h+='<div class="card mn-card"><h3>Калькулятор решти</h3><div class="mn-calc"><label class="fld"><span>До сплати</span>'+sufInp('due','','₴')+'</label><label class="fld"><span>Отримано</span>'+sufInp('got','','₴')+'</label></div>'+
    '<div class="mn-quick">'+[100,200,500,1000].map(function(n){return '<button class="chip" data-a="got" data-n="'+n+'">'+n+'</button>'}).join('')+'<button class="chip" data-a="gotr">Рівно</button></div>'+
    '<div class="mn-change" data-change>Решта: <b>—</b></div></div>';
  h+='</div></div></div>';
  view.innerHTML=h;
  var root=view.firstElementChild;
  bindCash(root,d,dd,groups);
}
function plural3(n,a,b,c){return U.plural(n,a,b,c)}
function recRow(l,v,sign){return '<div class="mn-rr"><span>'+l+'</span><b class="num '+(v<0?'dng-t':'')+'">'+(v<0?'−':(sign||''))+uah(Math.abs(v))+'</b></div>'}
function netBank(byMethod,kind){var s=0;Object.keys(byMethod).forEach(function(k){if(mKind(k)===kind)s+=byMethod[k]-byMethod[k]*feePct(k)/100});return Math.round(s)}
function methodsRows(dd){
  var by=dd.m.byMethod,rows='',ms=payOn();Object.keys(by).forEach(function(k){if(!ms.some(function(x){return x.id===k}))ms.push({id:k,n:k,kind:'other'})});
  var tot=0,totNet=0;
  ms.forEach(function(p){var v=by[p.id]||0;if(!v)return;var fee=p.kind==='cash'?0:Math.round(v*feePct(p.id)/100),net=v-fee;tot+=v;
    rows+='<div class="mn-mr"><span class="mn-mi">'+I(p.ic||'coins','s')+'</span><div class="t"><b>'+esc(p.n)+'</b>'+(p.kind==='cash'?'<small>в касі</small>':'<small>'+(fee?'комісія −'+uah(fee):'без комісії')+'</small>')+'</div><div class="r"><b class="num">'+uah(v)+'</b>'+(p.kind==='cash'?'':'<small class="num">у виписці '+uah(net)+'</small>')+'</div></div>'; if(p.kind!=='cash')totNet+=net});
  if(dd.m.certRedeemed)rows+='<div class="mn-mr mut"><span class="mn-mi">'+I('gift','s')+'</span><div class="t"><b>Сертифікатами</b><small>не рух грошей</small></div><div class="r"><b class="num">'+uah(dd.m.certRedeemed)+'</b></div></div>';
  if(dd.m.abonRedeemed)rows+='<div class="mn-mr mut"><span class="mn-mi">'+I('ticket','s')+'</span><div class="t"><b>Абонементами</b><small>не рух грошей</small></div><div class="r"><b class="num">'+uah(dd.m.abonRedeemed)+'</b></div></div>';
  if(!rows)return '<div class="mn-none">Рухів по способах немає</div>';
  return rows+'<div class="mn-mr tot"><div class="t"><b>Має бути в банківській виписці</b><small>картка і переказ, без готівки</small></div><div class="r"><b class="num">'+uah(totNet)+'</b></div></div>'}

function closeCard(d,dd){
  var rec=dd.rec,ops=canCashOps();
  if(rec){
    var stale=Math.round(dd.close-rec.expected);
    return '<div class="card mn-card mn-closed"><h3>'+I('lock','s')+' День закрито</h3><dl class="dl"><dt>Очікувалось</dt><dd class="num">'+uah(rec.expected)+'</dd><dt>Порахували</dt><dd class="num">'+uah(rec.counted)+'</dd><dt>Різниця</dt><dd class="num '+(rec.diff<0?'dng-t':rec.diff>0?'warn-t':'ok-t')+'"><b>'+(rec.diff>0?'+':rec.diff<0?'−':'')+uah(Math.abs(rec.diff))+'</b></dd><dt>Закрив(ла)</dt><dd>'+esc(sname(rec.by))+' · '+esc((rec.ts||'').slice(11,16))+'</dd></dl>'+
      (rec.note?'<p class="mn-fn" style="margin-top:10px">«'+esc(rec.note)+'»</p>':'')+
      (rec.denoms?'<p class="mn-fn">'+Object.keys(rec.denoms).filter(function(k){return rec.denoms[k]}).map(function(k){return k==='coins'?'монети '+fmt(rec.denoms[k]):k+'×'+rec.denoms[k]}).join(' · ')+'</p>':'')+
      (stale?'<div class="note warn" style="margin-top:10px">'+I('alert')+'<span>Після закриття каса змінилась на '+(stale>0?'+':'−')+uah(Math.abs(stale))+' (нова операція чи оплата).</span></div>':'')+'</div>'}
  if(!ops)return '';
  var isPast=d<T();
  return '<div class="card mn-card mn-closecard"><h3>Закриття дня</h3><p class="mn-fn" style="margin:0 0 10px">Порахуйте готівку в касі за купюрами — система порівняє з очікуваною сумою <b class="num">'+uah(dd.close)+'</b>.</p><button class="btn pri blk" data-a="close">'+I('lock')+' Закрити день'+(isPast?' ('+D.shortH(d)+')':'')+'</button></div>'}

function expEditable(e){return can('expenses.view')||(e.by===App.db.meId&&e.date===T())}

function bindCash(root,d,dd,groups){
  var T0=T();
  on(root,{
    day:function(b){App.setQ({d:b.dataset.d===T0?'':b.dataset.d})},
    appt:function(b){App.openAppt(b.dataset.id)},
    pay:function(b){App.checkout(b.dataset.id)},
    exp:function(){expModal({date:d},rerender)},
    op:function(){cashOpModal(d)},
    ops:function(b){opsMenu(b,d,groups)},
    move:function(){moveModal(d)},
    close:function(){App.go('cash/close',d!==T0?{d:d}:null)},
    reopen:function(){UI.confirm({title:'Відкрити день знову?',text:'Закриття '+D.human(d)+' буде скасовано — потім його можна закрити заново.',ok:'Відкрити'}).then(function(y){if(!y)return;var r=O.reopenDay(d);UI.toast('День відкрито',{undo:function(){O.restoreDay(d,r);rerender()}});rerender()})},
    opdel:function(b){var o=O.deleteCashOp(b.dataset.id);UI.toast('Операцію видалено',{undo:function(){O.restoreCashOp(o);rerender()}});rerender()},
    expmenu:function(b){var e=App.db.expenses.find(function(x){return x.id===b.dataset.id});UI.menu(b,[{t:'Редагувати',ic:'edit',fn:function(){expModal(e,rerender)}},{t:'Видалити',ic:'trash',dng:true,fn:function(){delExpense(e.id,rerender)}}])},
    paymenu:function(b){var gr=groups.find(function(x){return x.k===b.dataset.k});if(!gr)return;var items=[];
      if(gr.appt){items.push({t:'Відкрити запис',ic:'cal',fn:function(){App.openAppt(gr.appt)}});if(canCashOps()||can('checkout'))items.push({t:'Повернення коштів',ic:'undo',fn:function(){refundModal(gr.appt)}})}
      if(gr.pair&&canCashOps())items.push({t:'Скасувати переміщення',ic:'trash',dng:true,fn:function(){var arr=O.deleteMove(gr.pair);UI.toast('Переміщення скасовано',{undo:function(){O.restoreMove(arr);rerender()}});rerender()}});
      if(items.length)UI.menu(b,items)},
    got:function(b){var f=root.querySelector('[name=got]');f.value=b.dataset.n;calc()},
    gotr:function(){var f=root.querySelector('[name=got]'),du=root.querySelector('[name=due]');f.value=du.value;calc()}
  });
  var dt=root.querySelector('[data-a-in=date]');if(dt)dt.onchange=function(){if(dayOk(dt.value))App.setQ({d:dt.value===T0?'':dt.value})};
  function calc(){var due=num(rd(root,'due')),got=num(rd(root,'got')),el=root.querySelector('[data-change]');
    if(!due&&!got){el.innerHTML='Решта: <b>—</b>';el.className='mn-change';return}
    var ch=got-due;el.className='mn-change '+(ch<0?'neg':'ok');el.innerHTML=ch<0?'Не вистачає: <b>'+uah(-ch)+'</b>':'Решта: <b>'+uah(ch)+'</b>'+(ch>0?' <small>'+changeNotes(ch)+'</small>':'')}
  ['due','got'].forEach(function(n){var f=root.querySelector('[name='+n+']');if(f)f.oninput=calc});
}
function changeNotes(n){var out=[],r=Math.round(n);[500,200,100,50,20,10].forEach(function(x){var c=Math.floor(r/x);if(c){out.push(c+'×'+x);r-=c*x}});if(r)out.push(r+' монетами');return out.join(' + ')}

/* ── модалки каси ── */
function warnClosed(date){var r=App.db.dayClose[date];return r?'<div class="note warn" style="margin-bottom:12px">'+I('lock')+'<span>День '+D.human(date)+' уже закрито — операція змінить очікувану суму в касі.</span></div>':''}
function cashOpModal(d,t0){t0=t0==='in'?'in':'out';
  var m=UI.modal({title:t0==='in'?'Внесення готівки':'Вилучення з каси',sub:dayHuman(d),size:'narrow',
    body:warnClosed(d)+'<div class="col-f g12">'+segHtml([['in','Внесення'],['out','Вилучення']],t0,'data-t')+
      field('Сума',sufInp('amount','','₴'))+field('Коментар','<input class="inp" name="note" placeholder="Напр. Розмінка / здали власниці" autocomplete="off">')+
      '<p class="mn-fn" data-hint></p></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
    onMount:function(el,close){var type=t0;
      function hint(){var bal=App.cashBalance(d),a=num(rd(el,'amount'));el.querySelector('[data-hint]').innerHTML='Зараз у касі: <b class="num">'+uah(bal)+'</b>'+(a?' → після: <b class="num">'+uah(bal+(type==='in'?a:-a))+'</b>':'')}
      hint();$$('[data-t]',el).forEach(function(b){b.onclick=function(){type=b.dataset.t;setSeg(el,'data-t',type);var n=el.querySelector('[name=note]');if(!n.value||n.dataset.auto){n.value=type==='in'?'Розмінна готівка':'Інкасація у сейф';n.dataset.auto=1}hint()}});
      var n=el.querySelector('[name=note]');n.value=type==='in'?'Розмінна готівка':'Інкасація у сейф';n.dataset.auto=1;n.oninput=function(){delete n.dataset.auto};el.querySelector('[name=amount]').oninput=hint;
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){var a=Math.round(num(rd(el,'amount')));if(a<=0)return bad(el.querySelector('[name=amount]'));
        if(type==='out'&&a>App.cashBalance(d)){UI.toast('У касі лише '+uah(App.cashBalance(d)),{type:'err'});return bad(el.querySelector('[name=amount]'))}
        O.cashOp({type:type,amount:a,note:rd(el,'note').trim()||(type==='in'?'Внесення':'Інкасація'),date:d});close();UI.toast((type==='in'?'Внесено ':'Інкасовано ')+uah(a));rerender()}}})}

function moveModal(d){
  var ms=payOn();
  UI.modal({title:'Переміщення між способами',sub:'Виправлення: пробили не тим способом',size:'narrow',
    body:warnClosed(d)+'<div class="col-f g12"><div class="grid2">'+field('З',"<select class='sel' name='from'>"+payOpts('card')+'</select>')+field('На',"<select class='sel' name='to'>"+payOpts('cash')+'</select>')+'</div>'+
      field('Сума',sufInp('amount','','₴'))+field('Причина','<input class="inp" name="note" placeholder="Напр. клієнт доплатив готівкою замість картки" autocomplete="off">')+
      '<p class="mn-fn">Це не нова оплата й не виторг: сума просто перераховується між касою, карткою й рахунком. Запис лишається в журналі дня.</p></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Перемістити</button>',
    onMount:function(el,close){var fr=el.querySelector('[name=from]'),to=el.querySelector('[name=to]');fr.value=ms.some(function(x){return x.id==='card'})?'card':ms[0].id;to.value=ms.some(function(x){return x.id==='cash'})?'cash':ms[1].id;
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){var a=Math.round(num(rd(el,'amount')));if(fr.value===to.value){UI.toast('Оберіть різні способи',{type:'err'});return bad(to)}if(a<=0)return bad(el.querySelector('[name=amount]'));
        if(fr.value==='cash'&&a>App.cashBalance(d)){UI.toast('У касі лише '+uah(App.cashBalance(d)),{type:'err'});return bad(el.querySelector('[name=amount]'))}
        var pair=O.moveMoney({from:fr.value,to:to.value,amount:a,note:rd(el,'note').trim(),date:d});close();UI.toast('Переміщено '+uah(a)+': '+mName(fr.value)+' → '+mName(to.value),{undo:function(){O.deleteMove(pair);rerender()}});rerender()}}})}

function refundModal(apptId){
  var a=App.appt(apptId);if(!a)return;var paid=App.apptPaid(a);
  UI.modal({title:'Повернення коштів',sub:esc(cname(a.client))+' · '+esc(App.apptTitle(a)),size:'narrow',
    body:'<div class="col-f g12"><p class="mn-fn" style="margin:0">Сплачено за запис: <b class="num">'+uah(paid)+'</b></p>'+field('Сума повернення',sufInp('amount',paid>0?paid:'','₴'))+field('Способом',"<select class='sel' name='m'>"+payOpts('cash')+'</select>')+field('Причина','<input class="inp" name="why" placeholder="Напр. брак послуги" autocomplete="off">')+'</div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn dng pri" data-ok>Повернути</button>',
    onMount:function(el,close){el.querySelector('[data-no]').onclick=close;el.querySelector('[data-ok]').onclick=function(){var v=Math.round(num(rd(el,'amount')));if(v<=0||v>Math.max(paid,0))return bad(el.querySelector('[name=amount]'));
      var meth=rd(el,'m');if(meth==='cash'&&v>App.cashBalance(T())){UI.toast('У касі лише '+uah(App.cashBalance(T())),{type:'err'});return}
      O.refund(apptId,v,meth,rd(el,'why').trim());close();UI.toast('Повернено '+uah(v));rerender()}}})}

function closeDayModal(d){
  var dd=dayData(d),exp=dd.close,mode='den',cnt={};DENOMS.forEach(function(x){cnt[x]=0});var coins=0,manual=0;
  var un=unpaidOn(d);
  UI.modal({title:'Закрити день',sub:dayHuman(d),size:'wide',
    body:(un.length?'<div class="note warn" style="margin-bottom:12px">'+I('alert')+'<span>Є неоплачені візити: '+un.length+'. Після закриття оплати все одно можна додати, але каса «розійдеться» із закриттям.</span></div>':'')+warnClosed(d)+
     '<div class="mn-cd"><div class="mn-cd-l"><div class="row wrap" style="margin-bottom:10px">'+segHtml([['den','За купюрами'],['sum','Одна сума']],'den','data-md')+'</div>'+
      '<div class="mn-den" data-den>'+DENOMS.map(function(x){return '<div class="mn-dr"><span class="nom">'+x+' ₴</span><div class="mn-step"><button type="button" class="icobtn sm" data-s="-1" data-x="'+x+'" aria-label="Менше">'+I('minus','s')+'</button><input class="inp" inputmode="numeric" name="n'+x+'" value="" placeholder="0" autocomplete="off"><button type="button" class="icobtn sm" data-s="1" data-x="'+x+'" aria-label="Більше">'+I('plus','s')+'</button></div><b class="num sub" data-sub="'+x+'">0</b></div>'}).join('')+
       '<div class="mn-dr"><span class="nom">Монети</span><div class="mn-step wide"><div class="inp-suf"><input name="coins" inputmode="decimal" placeholder="0" autocomplete="off"><span>₴</span></div></div><b class="num sub" data-sub="coins">0</b></div></div>'+
      '<div data-sumbox hidden>'+field('Порахована сума',sufInp('manual','','₴'))+'</div></div>'+
     '<div class="mn-cd-r"><div class="mn-cd-tot"><div class="mn-rr"><span>Очікується за обліком</span><b class="num">'+uah(exp)+'</b></div><div class="mn-rr"><span>Пораховано</span><b class="num" data-counted>0 ₴</b></div><div class="mn-rr big" data-diffrow><span>Різниця</span><b class="num" data-diff>—</b></div></div>'+
      field('Коментар <small data-nreq></small>','<textarea class="ta" name="note" style="min-height:64px" placeholder="Напр. не вистачає 50 ₴, шукаємо"></textarea>')+'</div></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>'+I('lock')+' Закрити день</button>',
    onMount:function(el,close){
      function counted(){return mode==='den'?sum(DENOMS,function(x){return x*cnt[x]})+coins:manual}
      function upd(){var c=Math.round(counted()),df=c-exp;el.querySelector('[data-counted]').textContent=uah(c);
        DENOMS.forEach(function(x){el.querySelector('[data-sub="'+x+'"]').textContent=fmt(x*cnt[x])});el.querySelector('[data-sub=coins]').textContent=fmt(coins);
        var row=el.querySelector('[data-diffrow]'),dv=el.querySelector('[data-diff]');
        if(!c&&mode==='den'&&!sum(DENOMS,function(x){return cnt[x]})){dv.textContent='—';row.className='mn-rr big';el.querySelector('[data-nreq]').textContent='';return}
        dv.textContent=df===0?'Збігається':(df>0?'Надлишок +':'Нестача −')+uah(Math.abs(df));row.className='mn-rr big '+(df===0?'ok':df<0?'neg':'warn');el.querySelector('[data-nreq]').textContent=df?'обовʼязково при розбіжності':''}
      $$('[data-md]',el).forEach(function(b){b.onclick=function(){mode=b.dataset.md;setSeg(el,'data-md',mode);el.querySelector('[data-den]').hidden=mode!=='den';el.querySelector('[data-sumbox]').hidden=mode!=='sum';upd()}});
      DENOMS.forEach(function(x){var f=el.querySelector('[name=n'+x+']');f.oninput=function(){cnt[x]=Math.max(0,Math.floor(num(f.value)));upd()}});
      $$('[data-s]',el).forEach(function(b){b.onclick=function(){var x=+b.dataset.x,f=el.querySelector('[name=n'+x+']');cnt[x]=Math.max(0,cnt[x]+(+b.dataset.s));f.value=cnt[x]||'';upd()}});
      el.querySelector('[name=coins]').oninput=function(e){coins=Math.max(0,num(e.target.value));upd()};
      el.querySelector('[name=manual]').oninput=function(e){manual=Math.max(0,num(e.target.value));upd()};
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){var c=Math.round(counted());if(c<=0&&!window.confirm('Порахована сума — 0 ₴. Закрити день із порожньою касою?'))return;var df=c-exp,note=rd(el,'note').trim();
        if(df!==0&&!note){UI.toast('Вкажіть коментар до розбіжності',{type:'err'});return bad(el.querySelector('[name=note]'))}
        var dn=null;if(mode==='den'){dn={};DENOMS.forEach(function(x){if(cnt[x])dn[x]=cnt[x]});if(coins)dn.coins=coins}
        O.closeDayFull(d,c,note,dn);close();UI.toast('День закрито'+(df?' · розбіжність '+(df>0?'+':'−')+uah(Math.abs(df)):''));rerender()};
      upd()}})}

/* ═════════ B3: ЗАКРИТТЯ ДНЯ — майстер cash/close ═════════ */
var CLW={d:null,step:1,counted:'',note:'',cnt:null,coins:0,useDen:false,bound:false};
App._b3close=1;
App.closeDayWizard=function(d){App.go('cash/close',d&&d!==T()?{d:d}:null)};
function clwReset(d){CLW.d=d;CLW.step=1;CLW.counted='';CLW.note='';CLW.cnt={};DENOMS.forEach(function(x){CLW.cnt[x]=0});CLW.coins=0;CLW.useDen=false}
function clwDen(){return sum(DENOMS,function(x){return x*(CLW.cnt[x]||0)})+(CLW.coins||0)}
function clwCounted(){return CLW.useDen?Math.round(clwDen()):Math.round(num(CLW.counted))}
function renderClose(view,q){
  var T0=T(),d=dayOk(q.d)?q.d:T0,db=App.db;
  App.setTop('');
  if(!CLW.bound){CLW.bound=true;App.on('change',function(){if(/^#\/cash\/close/.test(location.hash)&&!document.querySelector('.modal-bg'))setTimeout(function(){App.refresh()},0)})}
  if(CLW.d!==d)clwReset(d);
  var back='<a class="btn ghost sm mn-back" href="#/cash'+(d!==T0?'?d='+d:'')+'">'+I('left')+'Каса</a>';
  if(!canCashOps()){view.innerHTML='<div class="page narrow mn-page">'+back+UI.empty('lock','Немає доступу','Закрити день може адміністратор або власник.')+'</div>';return}
  if(d>T0){view.innerHTML='<div class="page narrow mn-page">'+back+UI.empty('cal','День ще не настав','Закрити можна сьогоднішній або минулий день.','<a class="btn" href="#/cash/close">До сьогодні</a>')+'</div>';return}
  var rec=db.dayClose[d],ds=App.dayStatus(d);
  var h='<div class="page narrow mn-page mn-wz" id="mn-wz">'+back+'<div class="mn-head"><div class="mn-ttl"><h2>Закриття дня</h2><p>'+esc(dayHuman(d))+(d===T0?' · сьогодні':'')+'</p></div></div>';
  if(rec){var who=App.staff(rec.by),tm2=(rec.ts||'').slice(11,16);
    h+='<div class="card mn-card mn-wzdone"><div class="mn-wzic">'+I('lock')+'</div><h3>День закрито'+(tm2?' '+tm2:'')+'</h3>'+
      '<p class="mn-wzsum"><span class="'+(rec.diff?(rec.diff<0?'dng-t':'warn-t'):'ok-t')+'">'+(rec.diff?'розбіжність '+(rec.diff>0?'+':'−')+uah(Math.abs(rec.diff)):'без розбіжності')+'</span>'+(who?' · '+esc(who.short||who.n):'')+'</p>'+
      '<dl class="dl"><dt>Очікувалось</dt><dd class="num">'+uah(rec.expected)+'</dd><dt>Пораховано</dt><dd class="num">'+uah(rec.counted)+'</dd>'+(rec.note?'<dt>Коментар</dt><dd>'+esc(rec.note)+'</dd>':'')+'</dl>'+
      '<div class="row wrap mn-wzdonea"><a class="btn" href="#/cash'+(d!==T0?'?d='+d:'')+'">До каси</a>'+(App.me().role==='owner'?'<button class="btn" data-a="reopen">'+I('undo')+' Відкрити повторно</button>':'')+'</div></div></div>';
    view.innerHTML=h;var r0=view.firstElementChild;
    on(r0,{reopen:function(){UI.confirm({title:'Відкрити день повторно?',text:'Закриття '+D.human(d)+' буде скасовано. Потім день треба буде закрити заново.',ok:'Відкрити'}).then(function(y){if(!y)return;O.reopenDay(d);clwReset(d);UI.toast('День відкрито — можна закрити заново');App.refresh()})}});
    return}
  var st=CLW.step,todo=ds.unpaid.length+ds.open.length;
  var stl=[['Візити',todo?todo:0],['Каса',0],['Підсумок',0]];
  h+='<div class="steps mn-steps" aria-label="Кроки">'+stl.map(function(x,i){var n=i+1;return (i?'<span class="ln"></span>':'')+'<span class="st'+(n===st?' on':n<st?' ok':'')+'"><i>'+(n<st?I('check','s'):n)+'</i>'+x[0]+'</span>'}).join('')+'</div>';
  h+='<div class="card mn-card mn-wzc">';
  if(st===1){
    var row=function(id,kind){var a=App.appt(id);if(!a)return '';var due=App.apptTotal(a)-App.apptPaid(a);
      return '<div class="li mn-wzr"><button class="t mn-lk" data-a="appt" data-id="'+a.id+'"><b class="ell">'+U.hm(a.start)+' · '+esc(cname(a.client))+'</b><small class="ell">'+esc(App.apptTitle(a))+' · '+esc(sname(a.staff))+'</small></button>'+
        (kind==='unpaid'?'<b class="num mn-amt">'+uah(due)+'</b><button class="btn pri" data-a="pay" data-id="'+a.id+'">Оплатити</button>':
        '<div class="mn-wzb"><button class="btn" data-a="arr" data-id="'+a.id+'">Прийшов</button><button class="btn" data-a="nos" data-id="'+a.id+'">Не прийшов</button></div>')+'</div>'};
    h+='<h3>Візити за день</h3>';
    if(!todo){var rest=Math.max(0,ds.visits-ds.done-ds.noshow.length);h+='<div class="mn-wzok">'+I('check')+'<div><b>'+(rest?'Незакритих візитів немає':'Усі візити закриті')+'</b><span>Завершено '+ds.done+' з '+ds.visits+(ds.noshow.length?', '+ds.noshow.length+' '+plural3(ds.noshow.length,'неявка','неявки','неявок'):'')+(rest?', ще '+rest+' '+plural3(rest,'візит','візити','візитів')+' попереду':'')+'. Можна рахувати касу.</span></div></div>'}
    if(ds.unpaid.length)h+='<div class="mn-wzg"><div class="mn-wzgh"><b>Не оплачено</b><span class="pill-n">'+ds.unpaid.length+'</span></div><div class="list">'+ds.unpaid.map(function(id){return row(id,'unpaid')}).join('')+'</div></div>';
    if(ds.open.length)h+='<div class="mn-wzg"><div class="mn-wzgh"><b>Без статусу</b><span class="pill-n">'+ds.open.length+'</span><small class="mute">час минув, а візит не відмічено</small></div><div class="list">'+ds.open.map(function(id){return row(id,'open')}).join('')+'</div></div>';
  }else if(st===2){
    var exp=ds.expected,cn=clwCounted(),has=CLW.useDen?clwDen()>0:String(CLW.counted).trim()!=='',df=cn-exp;
    h+='<h3>Готівка в касі</h3><div class="mn-wzexp"><span>Має бути за обліком</span><b class="num">'+uah(exp)+'</b></div>'+
      '<label class="fld"><span>Пораховано готівки</span><div class="inp-suf mn-wzin"><input name="counted" inputmode="decimal" autocomplete="off" placeholder="0" value="'+esc(CLW.useDen?(clwDen()?String(Math.round(clwDen())):''):CLW.counted)+'"'+(CLW.useDen?' readonly':'')+'><span>₴</span></div></label>'+
      '<div class="mn-wzdiff '+(has?(df===0?'ok':'neg'):'')+'" data-diff>'+(has?(df===0?'Збігається з обліком':(df>0?'Надлишок +':'Нестача −')+uah(Math.abs(df))):'Введіть суму — різниця порахується одразу')+'</div>'+
      '<details class="mn-wzden"'+(CLW.useDen?' open':'')+'><summary>Порахувати купюрами</summary><div class="mn-den">'+DENOMS.map(function(x){return '<div class="mn-dr"><span class="nom">'+x+' ₴</span><div class="mn-step"><button type="button" class="icobtn" data-s="-1" data-x="'+x+'" aria-label="Менше '+x+'">'+I('minus','s')+'</button><input class="inp" name="n'+x+'" inputmode="numeric" value="'+(CLW.cnt[x]||'')+'" placeholder="0" aria-label="Купюр по '+x+'"><button type="button" class="icobtn" data-s="1" data-x="'+x+'" aria-label="Більше '+x+'">'+I('plus','s')+'</button></div><b class="num sub" data-sub="'+x+'">'+fmt(x*(CLW.cnt[x]||0))+'</b></div>'}).join('')+
        '<div class="mn-dr"><span class="nom">Монети</span><div class="mn-step wide"><div class="inp-suf"><input name="coins" inputmode="decimal" placeholder="0" autocomplete="off" value="'+(CLW.coins||'')+'"><span>₴</span></div></div><b class="num sub" data-sub="coins">'+fmt(CLW.coins||0)+'</b></div></div></details>'+
      '<label class="fld"><span>Коментар <small data-nreq>'+(has&&df!==0?'обовʼязково при розбіжності':'')+'</small></span><textarea class="ta" name="note" placeholder="Напр. не вистачає 50 ₴ — видали решту з власних">'+esc(CLW.note)+'</textarea></label>';
  }else{
    var m=App.money(d,d),cn3=clwCounted(),df3=cn3-ds.expected;
    h+='<h3>Підсумок дня</h3><div class="mn-wzk">'+
      kpi('Виторг',uah(ds.revenue))+kpi('Середній чек',ds.avg?uah(ds.avg):'—')+kpi('Візити',String(ds.done),ds.visits!==ds.done?'з '+ds.visits+' записів':'')+kpi('Неявки',String(ds.noshow.length))+kpi('Чайові',uah(ds.tips||0))+'</div>'+
      '<div class="mn-rec">'+recRow('Каса за обліком',ds.expected)+recRow('Пораховано',cn3)+'<div class="mn-rr tot '+(df3===0?'ok':'neg')+'"><span>Різниця</span><b class="num">'+(df3===0?'0 ₴':(df3>0?'+':'−')+uah(Math.abs(df3)))+'</b></div></div>'+
      (CLW.note?'<p class="mn-fn">«'+esc(CLW.note)+'»</p>':'');
  }
  h+='</div>';
  var nxt=st===1?(todo?'<button class="btn" data-a="skip">Пропустити</button><button class="btn pri" data-a="next" disabled>Далі</button>':'<button class="btn pri" data-a="next">Далі</button>'):
    st===2?'<button class="btn pri" data-a="next">Далі</button>':'<button class="btn pri" data-a="finish">'+I('lock')+' Закрити день</button>';
  h+='<div class="sheet-foot mn-wzf">'+(st>1?'<button class="btn" data-a="prev">'+I('left')+'Назад</button>':'')+'<span class="sp"></span>'+nxt+'</div></div>';
  view.innerHTML=h;
  var root=view.firstElementChild;
  function go(n){CLW.step=n;App.refresh();window.scrollTo(0,0)}
  function chk2(){var c=clwCounted(),has=CLW.useDen?clwDen()>0:String(CLW.counted).trim()!=='';
    if(!has){UI.toast('Введіть порахованую суму',{type:'err'});bad(root.querySelector('[name=counted]'));return false}
    if(c!==ds.expected&&!CLW.note.trim()){UI.toast('Вкажіть коментар до розбіжності',{type:'err'});bad(root.querySelector('[name=note]'));return false}return true}
  on(root,{
    appt:function(b){App.openAppt(b.dataset.id)},
    pay:function(b){App.checkout(b.dataset.id)},
    arr:function(b){O.setStatus(b.dataset.id,'arrived');UI.toast('Відмічено: прийшов');App.refresh()},
    nos:function(b){var a=App.appt(b.dataset.id);UI.confirm({title:'Позначити неявку?',text:esc(cname(a&&a.client))+' не прийшов(ла) '+D.human(d)+'. Неявка піде в історію клієнта й рахується в ризику.',ok:'Не прийшов',danger:true}).then(function(y){if(!y)return;O.setStatus(b.dataset.id,'noshow');UI.toast('Позначено неявку');App.refresh()})},
    skip:function(){UI.confirm({title:'Пропустити незакриті візити?',text:'Залишилось '+todo+' '+plural3(todo,'візит','візити','візитів')+' без оплати чи статусу. Касу можна закрити, але звіт за день буде неповним.',ok:'Пропустити'}).then(function(y){if(y)go(2)})},
    next:function(){if(st===2&&!chk2())return;go(st+1)},
    prev:function(){go(st-1)},
    finish:function(){if(!chk2()){go(2);return}var c=clwCounted(),dn=null;
      if(CLW.useDen){dn={};DENOMS.forEach(function(x){if(CLW.cnt[x])dn[x]=CLW.cnt[x]});if(CLW.coins)dn.coins=CLW.coins}
      var r=O.closeDayFull(d,c,CLW.note.trim(),dn);clwReset(null);UI.toast('День закрито'+(r&&r.diff?' · розбіжність '+(r.diff>0?'+':'−')+uah(Math.abs(r.diff)):' · без розбіжності'));App.go('cash',d!==T0?{d:d}:null)}
  });
  if(st===2){
    var ci=root.querySelector('[name=counted]'),ni=root.querySelector('[name=note]');
    function upd(){var c=clwCounted(),has=CLW.useDen?clwDen()>0:String(CLW.counted).trim()!=='',df=c-ds.expected,el=root.querySelector('[data-diff]');
      el.className='mn-wzdiff '+(has?(df===0?'ok':'neg'):'');el.textContent=has?(df===0?'Збігається з обліком':(df>0?'Надлишок +':'Нестача −')+uah(Math.abs(df))):'Введіть суму — різниця порахується одразу';
      root.querySelector('[data-nreq]').textContent=has&&df!==0?'обовʼязково при розбіжності':'';
      if(CLW.useDen){ci.value=clwDen()?String(Math.round(clwDen())):'';DENOMS.forEach(function(x){root.querySelector('[data-sub="'+x+'"]').textContent=fmt(x*(CLW.cnt[x]||0))});root.querySelector('[data-sub=coins]').textContent=fmt(CLW.coins||0)}}
    ci.oninput=function(){CLW.counted=ci.value;upd()};ni.oninput=function(){CLW.note=ni.value};
    var det=root.querySelector('.mn-wzden');det.addEventListener('toggle',function(){CLW.useDen=det.open;ci.readOnly=det.open;if(!det.open)ci.value=CLW.counted;upd()});
    DENOMS.forEach(function(x){var f=root.querySelector('[name=n'+x+']');f.oninput=function(){CLW.cnt[x]=Math.max(0,Math.floor(num(f.value)));upd()}});
    $$('[data-s]',root).forEach(function(b){b.onclick=function(){var x=+b.dataset.x,f=root.querySelector('[name=n'+x+']');CLW.cnt[x]=Math.max(0,(CLW.cnt[x]||0)+(+b.dataset.s));f.value=CLW.cnt[x]||'';upd()}});
    root.querySelector('[name=coins]').oninput=function(e){CLW.coins=Math.max(0,num(e.target.value));upd()};
  }
}

/* ═════════ B3: меню операцій каси ═════════ */
function opsMenu(b,d,groups){var it=[{t:'Внесення',ic:'plus',fn:function(){cashOpModal(d,'in')}},{t:'Вилучення',ic:'safe',fn:function(){cashOpModal(d,'out')}},{t:'Переказ між касами',ic:'move',fn:function(){moveModal(d)}}];
  var pg=(groups||[]).filter(function(g){return g.appt});
  it.push({t:'Повернення клієнту',ic:'undo',fn:function(){if(!pg.length){UI.toast('Сьогодні немає оплат, які можна повернути',{type:'err'});return}if(pg.length===1)refundModal(pg[0].appt);else UI.toast('Відкрийте «⋯» біля потрібної оплати в стрічці')}});
  it.push('-');it.push({t:'Порахувати касу (швидко)',ic:'lock',fn:function(){closeDayModal(d)}});
  UI.menu(b,it)}

/* ═════════ ВИТРАТИ ═════════ */
function expPerm(){return {view:can('expenses.view'),add:can('expenses.add')||can('expenses.*')||can('expenses.view')}}
function tplId(e){return e.tpl||e.id}
function templates(){return App.db.expenses.filter(function(e){return e.recur&&!e.recurStop})}
function monthKey(d){return d.slice(0,7)}
function lastDayOf(m){return +D.monthEnd(m+'-01').slice(8)}
function pendingFor(month){
  var db=App.db,cur=monthKey(T()),maxM=monthKey(D.addMonths(T(),1)),skip=db.recurSkip||[],res=[];
  if(month>maxM)return res;
  templates().forEach(function(t){var tm=monthKey(t.date);if(month<=tm)return;
    var id=tplId(t);if(db.expenses.some(function(e){return e!==t&&e.tpl===id&&monthKey(e.date)===month}))return;
    if(skip.indexOf(id+'|'+month)>=0)return;
    var day=Math.min(+t.date.slice(8),lastDayOf(month));
    res.push({tpl:id,t:t,date:month+'-'+pad2(day),amount:t.amount,cat:t.cat,note:t.note,method:t.method,pending:true,late:month+'-'+pad2(day)<=T()})});
  return res}
function pendingCount(){return pendingFor(monthKey(T())).filter(function(p){return p.late}).length}

function delExpense(id,after){var e=O.deleteExpense(id);if(!e)return;UI.toast('Витрату видалено',{undo:function(){App.db.expenses.push(e);App.log('create','exp:'+e.id,'Відновлено витрату');App.save();(after||rerender)()}});(after||rerender)()}

function expModal(e,done){
  e=e||{};var isEdit=!!e.id,db=App.db,cats=db.expCats;if(!cats.length)cats=[{id:'other',n:'Інше'}];
  var date=e.date||T(),preCat=e.cat||(cats[0]&&cats[0].id);
  var meth=e.method||'cash';
  var m=UI.modal({title:isEdit?'Редагувати витрату':'Нова витрата',size:'narrow',
    body:'<div class="col-f g12">'+field('Сума',sufInp('amount',e.amount||'','₴'))+
      '<div class="grid2 m1">'+field('Дата','<input class="inp" type="date" name="date" value="'+date+'">')+field('Категорія','<select class="sel" name="cat">'+cats.map(function(c){return '<option value="'+c.id+'"'+(c.id===preCat?' selected':'')+'>'+esc(c.n)+'</option>'}).join('')+'</select>')+'</div>'+
      field('Опис','<input class="inp" name="note" value="'+esc(e.note||'')+'" placeholder="Напр. Гель-лаки, вода, оренда" autocomplete="off">')+
      field('Чим оплачено','<select class="sel" name="method">'+payOpts(meth)+'</select>')+
      '<p class="mn-fn" data-hint></p>'+
      '<label class="check"><input type="checkbox" name="recur"'+(e.recur?' checked':'')+'> Повторювати щомісяця <small class="mute">— зʼявляться рядки «очікується»</small></label></div>',
    foot:(isEdit?'<button class="btn dng" data-del>'+I('trash','s')+' Видалити</button>':'')+'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>'+(isEdit?'Зберегти':'Додати')+'</button>',
    onMount:function(el,close){
      function hint(){var a=num(rd(el,'amount')),mt=rd(el,'method'),dt=rd(el,'date'),h=el.querySelector('[data-hint]');
        if(mt==='cash'){var bal=App.cashBalance(dt||T())+(isEdit&&e.method==='cash'&&e.date<=dt?e.amount:0);h.innerHTML='Готівка: буде знято з каси. Зараз у касі <b class="num">'+uah(bal)+'</b>'+(a&&a>bal?' — <span class="dng-t">не вистачає '+uah(a-bal)+'</span>':'')}
        else h.innerHTML='Оплата не з каси ('+esc(mName(mt))+') — залишок готівки не зміниться.'}
      ['amount','method','date'].forEach(function(n){var f=el.querySelector('[name='+n+']');f.oninput=f.onchange=hint});hint();
      el.querySelector('[data-no]').onclick=close;
      var del=el.querySelector('[data-del]');if(del)del.onclick=function(){close();delExpense(e.id,done)};
      el.querySelector('[data-ok]').onclick=function(){var a=Math.round(num(rd(el,'amount')));if(a<=0)return bad(el.querySelector('[name=amount]'));
        var dt=rd(el,'date');if(!dayOk(dt))return bad(el.querySelector('[name=date]'));
        var note=rd(el,'note').trim();if(!note){var c=cats.find(function(x){return x.id===rd(el,'cat')});note=c?c.n:'Витрата'}
        var rec=el.querySelector('[name=recur]').checked;
        var obj={amount:a,date:dt,cat:rd(el,'cat'),note:note,method:rd(el,'method'),recur:rec};
        if(isEdit)obj.id=e.id;
        if(e.tpl&&isEdit)obj.tpl=e.tpl;
        var r=O.saveExpense(obj);close();UI.toast(isEdit?'Збережено':'Витрату додано: '+uah(a),isEdit?undefined:{undo:function(){O.deleteExpense(r.id);(done||rerender)()}});(done||rerender)();if(App.cur&&App.cur.rt.id==='cash')rerender()}}});
  return m}
App.addExpense=function(o){o=o||{};expModal({date:o.date||T(),cat:o.cat,amount:o.amount,note:o.note,method:o.method},function(){if(o.onDone)o.onDone();if(App.cur&&(App.cur.rt.id==='expenses'||App.cur.rt.id==='cash'))rerender()})};

function catsModal(done){
  var cats=App.db.expCats.map(function(c){return Object.assign({},c)});
  var used={};App.db.expenses.forEach(function(e){used[e.cat]=(used[e.cat]||0)+1});
  UI.modal({title:'Категорії витрат',sub:'Додавайте, перейменовуйте, прибирайте зайве',size:'narrow',
    body:'<div class="col-f" data-list></div><button class="btn blk" style="margin-top:12px" data-add>'+I('plus','s')+' Нова категорія</button>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
    onMount:function(el,close){
      var list=el.querySelector('[data-list]');
      function draw(){list.innerHTML=cats.map(function(c,i){var u=used[c.id]||0;return '<div class="mn-catrow"><input class="inp" data-i="'+i+'" value="'+esc(c.n)+'" aria-label="Назва категорії" autocomplete="off"><small class="mute nw">'+(u?u+' '+plural3(u,'запис','записи','записів'):'не використ.')+'</small><button class="icobtn sm ghost" data-del="'+i+'" '+(u?'disabled title="Є витрати — спершу перенесіть їх" style="opacity:.35"':'')+' aria-label="Видалити">'+I('trash','s')+'</button></div>'}).join('')}
      draw();
      list.addEventListener('input',function(e){var i=e.target.dataset.i;if(i!=null)cats[+i].n=e.target.value});
      list.addEventListener('click',function(e){var b=e.target.closest('[data-del]');if(!b||b.disabled)return;cats.splice(+b.dataset.del,1);draw()});
      el.querySelector('[data-add]').onclick=function(){cats.push({id:U.uid('ec'),n:''});draw();var ins=$$('input',list);ins[ins.length-1].focus()};
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){var out=cats.map(function(c){return {id:c.id,n:c.n.trim()}}).filter(function(c){return c.n});if(!out.length)return UI.toast('Потрібна хоча б одна категорія',{type:'err'});
        var names={};for(var i=0;i<out.length;i++){var k=out[i].n.toLowerCase();if(names[k])return UI.toast('Повтор назви: '+out[i].n,{type:'err'});names[k]=1}
        O.setExpCats(out);close();UI.toast('Категорії збережено');(done||rerender)()}}})}

function renderExpenses(view,params,q){
  var P=expPerm(),T0=T(),db=App.db;
  var month=/^\d{4}-\d\d$/.test(q.m||'')?q.m:monthKey(T0),cat=q.cat||'',qq=(q.q||'').trim().toLowerCase();
  var from=month+'-01',to=D.monthEnd(from),lite=!P.view;
  if(lite){month=monthKey(T0);from=to=T0}
  var real=db.expenses.filter(function(e){return e.date>=from&&e.date<=to&&(!lite||e.by===db.meId)});
  var pend=lite?[]:pendingFor(month);
  var rowsAll=real.map(function(e){return Object.assign({},e)}).concat(pend);
  var totalReal=sum(real,function(e){return e.amount}),totalPend=sum(pend,function(e){return e.amount});
  var prevM=monthKey(D.addMonths(from,-1)),prevTotal=sum(db.expenses.filter(function(e){return monthKey(e.date)===prevM}),function(e){return e.amount});
  var byCat={};real.forEach(function(e){byCat[e.cat]=(byCat[e.cat]||0)+e.amount});
  var catRows=Object.keys(byCat).map(function(k){return {id:k,n:expCat(k),v:byCat[k]}}).sort(function(a,b){return b.v-a.v});
  var rows=rowsAll.filter(function(e){return (!cat||e.cat===cat)&&(!qq||(e.note||'').toLowerCase().indexOf(qq)>=0||expCat(e.cat).toLowerCase().indexOf(qq)>=0)}).sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:0});
  var fTotal=sum(rows.filter(function(r){return !r.pending}),function(r){return r.amount});
  var h='<div class="page mn-page"><div class="mn-head"><div class="mn-ttl"><h2>Витрати</h2><p>'+(lite?'Сьогодні · ваші записи':esc(monthLbl(from)))+'</p></div>';
  if(!lite)h+='<div class="mn-daynav"><button class="icobtn" data-a="mon" data-m="'+prevM+'" aria-label="Попередній місяць">'+I('left')+'</button><b class="mn-mon">'+esc(monthLbl(from))+'</b><button class="icobtn" data-a="mon" data-m="'+monthKey(D.addMonths(from,1))+'" aria-label="Наступний місяць">'+I('right')+'</button>'+(month!==monthKey(T0)?'<button class="btn" data-a="mon" data-m="'+monthKey(T0)+'">Цей місяць</button>':'')+'</div>';
  h+='</div><div class="mn-actions">'+(P.add?'<button class="btn pri" data-a="add">'+I('plus','s')+' Додати витрату</button>':'')+'<span class="sp"></span>'+(P.view?'<button class="btn" data-a="cats">'+I('tag')+' Категорії</button><button class="btn" data-a="csv">'+I('download')+' CSV</button>':'')+'</div>';
  if(!lite){
    var dl=prevTotal?Math.round((totalReal-prevTotal)/prevTotal*100):null;
    h+='<div class="kpis mn-kpis4">'+kpi('Витрати за місяць',uah(totalReal),real.length+' '+plural3(real.length,'запис','записи','записів'))+
      kpi('Минулий місяць',uah(prevTotal),dl==null?'—':(dl>0?'+':dl<0?'−':'')+Math.abs(dl)+'% до минулого',dl>0?'down':dl<0?'up':'')+
      kpi('Очікується',uah(totalPend),pend.length?pend.length+' '+plural3(pend.length,'платіж','платежі','платежів')+' за шаблонами':'немає шаблонів')+
      kpi('Найбільша стаття',catRows[0]?esc(catRows[0].n):'—',catRows[0]?uah(catRows[0].v)+' · '+Math.round(catRows[0].v/totalReal*100)+'%':'')+'</div>';
    /* категорії */
    if(catRows.length){var COL=['var(--ink)','#44464C','#6E6E73','#8A8A90','#B4B4BA','#C7C7CC','#D9D9DE','#E9E9EC'];
      h+='<div class="card mn-card mn-cats"><h3>За категоріями'+(cat?' <button class="btn sm" data-a="cat" data-c="">Скинути фільтр</button>':'')+'</h3><div class="mn-stack" role="img" aria-label="Розподіл витрат за категоріями">'+catRows.map(function(c,i){return '<i style="width:'+(c.v/totalReal*100)+'%;background:'+COL[i%COL.length]+'" title="'+esc(c.n)+': '+uah(c.v)+'"></i>'}).join('')+'</div>'+
      '<div class="mn-catlist">'+catRows.map(function(c,i){return '<button class="mn-cl'+(cat===c.id?' on':'')+'" data-a="cat" data-c="'+(cat===c.id?'':c.id)+'"><span class="dot" style="background:'+COL[i%COL.length]+'"></span><span class="n ell">'+esc(c.n)+'</span><b class="num">'+uah(c.v)+'</b><small class="num mute">'+Math.round(c.v/totalReal*100)+'%</small></button>'}).join('')+'</div></div>'}
    h+='<div class="mn-filter"><div class="inp-ic" style="flex:1;max-width:320px">'+I('search')+'<input class="inp" data-q placeholder="Пошук по опису" value="'+esc(q.q||'')+'" autocomplete="off"></div></div>';
  }
  h+='<div class="tbl-wrap mn-exp"><table class="tbl"><thead><tr><th>Дата</th><th>Категорія</th><th>Опис</th><th>Спосіб</th><th class="r">Сума</th><th></th></tr></thead><tbody>';
  if(!rows.length)h+='<tr><td colspan="6" style="height:auto;padding:0">'+UI.empty('receipt',lite?'Сьогодні витрат немає':'Витрат за цей період немає',lite?'Додані вами витрати за сьогодні зʼявляться тут.':'Додайте першу витрату або змініть місяць.')+'</td></tr>';
  rows.forEach(function(e){
    var by=e.by?sname(e.by):'';
    h+='<tr class="'+(e.pending?'mn-pend':'click')+'" '+(e.pending?'':'data-a="edit" data-id="'+e.id+'"')+'><td class="nw">'+D.shortH(e.date)+(e.recur?' '+I('repeat','s'):'')+'</td><td><span class="tag">'+esc(expCat(e.cat))+'</span></td><td class="ell" style="max-width:340px">'+esc(e.note)+(e.pending?' <span class="badge '+(e.late?'warn':'plain')+'">очікується'+(e.late?' · час підтвердити':'')+'</span>':'')+'</td><td class="mute">'+esc(mName(e.method))+(by&&!e.pending?' · '+esc(by):'')+'</td><td class="r num">'+(e.pending?'<span class="mute">':'<b>')+uah(e.amount)+(e.pending?'</span>':'</b>')+'</td><td class="r nw">'+
      (e.pending?'<button class="btn sm pri" data-a="confirm" data-tpl="'+e.tpl+'" data-date="'+e.date+'">Підтвердити</button> <button class="icobtn sm ghost" data-a="pmenu" data-tpl="'+e.tpl+'" data-date="'+e.date+'" aria-label="Дії">'+I('more')+'</button>':(expEditable(e)?'<button class="icobtn sm ghost" data-a="menu" data-id="'+e.id+'" aria-label="Дії">'+I('more')+'</button>':''))+'</td></tr>'});
  h+='</tbody>'+(rows.length?'<tfoot><tr><td colspan="4">Разом'+(cat||qq?' (за фільтром)':'')+'</td><td class="r num">'+uah(fTotal)+'</td><td></td></tr></tfoot>':'')+'</table></div></div>';
  view.innerHTML=h;
  var root=view.firstElementChild;
  var qi=root.querySelector('[data-q]');if(qi)qi.oninput=U.debounce(function(){App.setQ({q:qi.value.trim()},true);var n=$('[data-q]');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},250);
  on(root,{
    mon:function(b){App.setQ({m:b.dataset.m===monthKey(T0)?'':b.dataset.m,cat:''})},
    cat:function(b){App.setQ({cat:b.dataset.c})},
    add:function(){expModal({date:lite?T0:(month===monthKey(T0)?T0:from)},rerender)},
    cats:function(){catsModal(rerender)},
    csv:function(){var r=[['Дата','Категорія','Опис','Спосіб оплати','Сума','Статус']];rows.slice().sort(function(a,b){return a.date<b.date?-1:1}).forEach(function(e){r.push([e.date,expCat(e.cat),e.note,mName(e.method),e.amount,e.pending?'очікується':'проведено'])});r.push(['','','','Разом',fTotal,'']);U.download('vytraty-'+month+'.csv',U.csv(r),'text/csv;charset=utf-8');UI.toast('CSV завантажено')},
    edit:function(b,ev){if(ev.target.closest('button'))return;var e=db.expenses.find(function(x){return x.id===b.dataset.id});if(e&&expEditable(e))expModal(e,rerender)},
    menu:function(b){var e=db.expenses.find(function(x){return x.id===b.dataset.id});UI.menu(b,[{t:'Редагувати',ic:'edit',fn:function(){expModal(e,rerender)}},{t:'Копіювати на сьогодні',ic:'copy',fn:function(){expModal({date:T0,cat:e.cat,amount:e.amount,note:e.note,method:e.method},rerender)}},'-',{t:'Видалити',ic:'trash',dng:true,fn:function(){delExpense(e.id)}}])},
    confirm:function(b){confirmPending(b.dataset.tpl,b.dataset.date)},
    pmenu:function(b){var tpl=b.dataset.tpl,dt=b.dataset.date;var t=db.expenses.find(function(x){return tplId(x)===tpl&&x.recur});UI.menu(b,[{t:'Підтвердити',ic:'check',fn:function(){confirmPending(tpl,dt)}},{t:'Змінити суму…',ic:'edit',fn:function(){expModal({date:dt,cat:t.cat,amount:t.amount,note:t.note,method:t.method,tpl:tpl},function(){/* нова витрата створюється як інстанс */rerender()})}},{t:'Пропустити цей місяць',ic:'x',fn:function(){O.skipRecur(tpl,monthKey(dt));UI.toast('Пропущено');rerender()}},'-',{t:'Зупинити повторення',ic:'ban',dng:true,fn:function(){UI.confirm({title:'Зупинити повторення?',text:'«'+esc(t.note)+'» більше не зʼявлятиметься як очікувана витрата. Минулі записи залишаться.',ok:'Зупинити',danger:true}).then(function(y){if(y){O.stopRecur(tpl);UI.toast('Повторення зупинено');rerender()}})}}])}
  });
}
function confirmPending(tpl,date){var t=App.db.expenses.find(function(x){return tplId(x)===tpl&&x.recur});if(!t)return;
  var e=O.addExpense({date:date,cat:t.cat,amount:t.amount,note:t.note,method:t.method,tpl:tpl});UI.toast('Проведено: '+t.note+' · '+uah(t.amount),{undo:function(){O.deleteExpense(e.id);rerender()}});rerender()}

/* ═════════ ЗАРПЛАТИ ═════════ */
var PER={half:'Півмісяця',week:'Тиждень',month:'Місяць'};
function perOf(date,per){
  if(per==='month')return {from:D.monthStart(date),to:D.monthEnd(date)};
  if(per==='week'){var w=D.weekStart(date);return {from:w,to:D.add(w,6)}}
  var d=+date.slice(8);return d<=15?{from:D.monthStart(date),to:date.slice(0,8)+'15'}:{from:date.slice(0,8)+'16',to:D.monthEnd(date)}}
function perLbl(p){var a=D.parse(p.from),b=D.parse(p.to);if(p.from.slice(0,7)===p.to.slice(0,7))return a.getDate()+'–'+b.getDate()+' '+D.MON[b.getMonth()]+(a.getFullYear()!==D.parse(T()).getFullYear()?' '+a.getFullYear():'');return D.shortH(p.from)+' – '+D.shortH(p.to)}
/* обгортка над App.payroll: сума == сума рядків; фікс «за місяць» пропорційно періоду */
function PR(id,from,to){
  var s=App.staff(id),p=App.payroll(id,from,to),cfg=s.pay||{};
  var fixed=0;if(cfg.type==='fixed'||cfg.type==='fixed_pct'){var f=cfg.fixed||0;
    if(from===D.monthStart(from)&&to===D.monthEnd(from))fixed=f;
    else if(from.slice(0,7)===to.slice(0,7)&&((from.slice(8)==='01'&&to.slice(8)==='15')||(from.slice(8)==='16'&&to===D.monthEnd(from))))fixed=Math.round(f/2);
    else fixed=Math.round(f*(D.diff(from,to)+1)/(+D.monthEnd(from).slice(8)))}
  var svcEarn=sum(p.lines,function(l){return l.earn}),svcSum=sum(p.lines,function(l){return l.base});
  p.svcEarn=svcEarn;p.svcSum=svcSum;p.fixed=fixed;p.total=svcEarn+p.tips+p.prodEarn+fixed+p.bonus-p.fine;p.left=p.total-p.paid;
  p.cfg=cfg;p.tipsAll=App.db.payments.filter(function(x){return x.kind==='tip'&&x.staff===id&&x.date>=from&&x.date<=to});
  p.prodAll=App.db.payments.filter(function(x){return x.kind==='product'&&x.staff===id&&x.date>=from&&x.date<=to});
  return p}
function ruleLbl(s,p){var c=s.pay||{type:'pct'},base=p?p.pct:(c.pct!=null?c.pct:(App.level(s.lvl)||{}).pct||0);var ov=c.svc?Object.keys(c.svc).length:0;
  if(c.type==='fixed')return 'фікс '+uah(c.fixed||0)+'/міс';
  var t=U.pct(base)+(ov?' + '+ov+' '+plural3(ov,'виняток','винятки','винятків'):'');
  if(c.type==='fixed_pct')return uah(c.fixed||0)+'/міс + '+t;
  var lv=App.level(s.lvl);return t+(c.pct==null&&lv?' · '+lv.n.toLowerCase():'')}
function payStaff(){return App.db.staff.filter(function(s){return s.active!==false&&(s.role==='master'||(s.pay&&(s.pay.type==='fixed'||s.pay.type==='fixed_pct')))})}
function payoutLabel(t){return {salary:'Виплата',advance:'Аванс',bonus:'Премія',fine:'Штраф'}[t]||t}

function renderPayroll(view,params,q){
  var me=App.me(),T0=T();
  var per=PER[q.per]?q.per:App.db.settings.payroll.period;
  var anchor=dayOk(q.d)?q.d:T0,P=perOf(anchor,per);
  var master=!can('payroll.view');
  if(master)return renderMyPay(view,q,per,P);
  var rows=payStaff().map(function(s){return {s:s,p:PR(s.id,P.from,P.to)}});
  var tot={visits:sum(rows,function(r){return r.p.visits}),svcSum:sum(rows,function(r){return r.p.svcSum}),svcEarn:sum(rows,function(r){return r.p.svcEarn}),prodEarn:sum(rows,function(r){return r.p.prodEarn}),tips:sum(rows,function(r){return r.p.tips}),fixed:sum(rows,function(r){return r.p.fixed}),bonus:sum(rows,function(r){return r.p.bonus}),fine:sum(rows,function(r){return r.p.fine}),total:sum(rows,function(r){return r.p.total}),paid:sum(rows,function(r){return r.p.paid}),left:sum(rows,function(r){return r.p.left})};
  var rev=App.money(P.from,P.to).revenue;
  var h='<div class="page mn-page"><div class="mn-head"><div class="mn-ttl"><h2>Зарплати</h2><p>'+esc(PER[per])+' · '+esc(perLbl(P))+(P.to<T0?'':' <span class="badge acc plain">поточний</span>')+'</p></div>'+
   '<div class="mn-daynav"><button class="icobtn" data-a="pnav" data-d="'+D.add(P.from,-1)+'" aria-label="Попередній період">'+I('left')+'</button><button class="icobtn" data-a="pnav" data-d="'+D.add(P.to,1)+'" aria-label="Наступний період">'+I('right')+'</button>'+((P.from<=T0&&P.to>=T0)?'':'<button class="btn" data-a="pnav" data-d="'+T0+'">Поточний</button>')+'</div></div>';
  h+='<div class="mn-actions">'+segHtml([['half','Півмісяця'],['week','Тиждень'],['month','Місяць']],per,'data-per')+'<span class="sp"></span><button class="btn" data-a="psett">'+I('cog')+'<span class="mn-hl"> Правила розрахунку</span></button><button class="btn" data-a="pcsv">'+I('download')+'<span class="mn-hl"> CSV</span></button>'+(rows.length?'<button class="btn d-only" data-a="pmore" aria-label="Аванс, премія, штраф">'+I('more')+'</button><button class="btn pri d-only" data-a="ppay">'+I('wallet')+' Виплатити</button>':'')+'</div>';
  h+='<div class="kpis mn-kpis4">'+kpi('Нараховано',uah(tot.total),rev?Math.round(tot.total/rev*100)+'% від виторгу':'')+kpi('Виплачено',uah(tot.paid),'за період')+kpi('До виплати',uah(tot.left),tot.left<0?'є аванс понад нараховане':rows.filter(function(r){return r.p.left>0}).length+' '+plural3(rows.filter(function(r){return r.p.left>0}).length,'співробітник','співробітники','співробітників'),tot.left>0?'warn-t':'')+kpi('Чайові майстрам',uah(tot.tips),'вже в нарахуванні')+'</div>';
  /* B3: список + розрахунковий лист (desktop) */
  var selS=(q.s&&rows.some(function(r){return r.s.id===q.s}))?q.s:((rows.find(function(r){return r.p.left>0})||rows[0]||{s:{}}).s.id);
  if(rows.length)h+='<div class="mn-prs d-only"><div class="mn-prl card flush"><div class="card-h"><b>Співробітники</b><span class="pill-n">'+rows.length+'</span></div><div class="list">'+rows.map(function(r){var s=r.s,p=r.p;return '<button class="li mn-prli'+(s.id===selS?' on':'')+'" data-a="sel" data-id="'+s.id+'" aria-pressed="'+(s.id===selS)+'">'+UI.av(s,'sm')+'<div class="t"><b class="ell">'+esc(s.short||s.n)+'</b><small class="ell">'+p.visits+' '+plural3(p.visits,'візит','візити','візитів')+' · '+esc(ruleLbl(s,p))+'</small></div><div class="mn-prlv"><small>до виплати</small>'+leftHtml(p.left)+'</div></button>'}).join('')+'</div></div>'+
    '<div class="mn-prsl" id="mn-prsl">'+(selS?slipHtml(selS,P):'')+'</div></div>';
  else h+=UI.empty('team','Немає кого розраховувати','Додайте майстрів у розділі «Команда» — тут зʼявиться їхній заробіток.','<a class="btn" href="#/team">До команди</a>');
  /* таблиця (desktop) */
  h+='<details class="mn-prsum d-only"><summary>Зведена таблиця за період</summary><div class="tbl-wrap mn-prt"><table class="tbl"><thead><tr><th>Співробітник</th><th class="r">Візитів</th><th class="r">Послуги</th><th>Правило</th><th class="r">За послуги</th><th class="r">Товари</th><th class="r">Чайові</th><th class="r">Фікс</th><th class="r">Премії</th><th class="r">Штрафи</th><th class="r">Нараховано</th><th class="r">Виплачено</th><th class="r">До виплати</th></tr></thead><tbody>'+
   rows.map(function(r){var s=r.s,p=r.p;return '<tr class="click" data-a="open" data-id="'+s.id+'"><td><div class="row">'+UI.av(s,'sm')+'<div class="t"><b>'+esc(s.short||s.n)+'</b><small class="mute" style="display:block;font-size:12px">'+esc(s.spec||'')+'</small></div></div></td><td class="r num">'+p.visits+'</td><td class="r num">'+fmt(p.svcSum)+'</td><td class="mute">'+esc(ruleLbl(s,p))+'</td><td class="r num">'+fmt(p.svcEarn)+'</td><td class="r num">'+(p.prodEarn?fmt(p.prodEarn):'<span class="faint">—</span>')+'</td><td class="r num">'+(p.tips?fmt(p.tips):'<span class="faint">—</span>')+'</td><td class="r num">'+(p.fixed?fmt(p.fixed):'<span class="faint">—</span>')+'</td><td class="r num">'+(p.bonus?'+'+fmt(p.bonus):'<span class="faint">—</span>')+'</td><td class="r num">'+(p.fine?'<span class="dng-t">−'+fmt(p.fine)+'</span>':'<span class="faint">—</span>')+'</td><td class="r num"><b>'+fmt(p.total)+'</b></td><td class="r num">'+(p.paid?fmt(p.paid):'<span class="faint">—</span>')+'</td><td class="r num">'+leftHtml(p.left)+'</td></tr>'}).join('')+
   '</tbody><tfoot><tr><td>Разом</td><td class="r num">'+tot.visits+'</td><td class="r num">'+fmt(tot.svcSum)+'</td><td></td><td class="r num">'+fmt(tot.svcEarn)+'</td><td class="r num">'+fmt(tot.prodEarn)+'</td><td class="r num">'+fmt(tot.tips)+'</td><td class="r num">'+fmt(tot.fixed)+'</td><td class="r num">'+fmt(tot.bonus)+'</td><td class="r num">'+(tot.fine?'−':'')+fmt(tot.fine)+'</td><td class="r num">'+fmt(tot.total)+'</td><td class="r num">'+fmt(tot.paid)+'</td><td class="r num">'+fmt(tot.left)+'</td></tr></tfoot></table></div></details>';
  /* картки (mobile) */
  h+='<div class="m-only mn-prcards">'+rows.map(function(r){var s=r.s,p=r.p;return '<button class="mn-prc" data-a="open" data-id="'+s.id+'"><div class="row">'+UI.av(s)+'<div class="t" style="flex:1;min-width:0"><b class="ell" style="display:block">'+esc(s.short||s.n)+'</b><small class="mute ell" style="display:block">'+p.visits+' '+plural3(p.visits,'візит','візити','візитів')+' · '+esc(ruleLbl(s,p))+'</small></div><div class="r"><small class="mute" style="display:block">до виплати</small>'+leftHtml(p.left)+'</div></div><div class="mn-prc-g"><span>Нараховано<b class="num">'+uah(p.total)+'</b></span><span>Виплачено<b class="num">'+uah(p.paid)+'</b></span><span>Чайові<b class="num">'+uah(p.tips)+'</b></span></div></button>'}).join('')+
   '<div class="card mn-card"><div class="mn-rr"><span>Нараховано разом</span><b class="num">'+uah(tot.total)+'</b></div><div class="mn-rr"><span>Виплачено</span><b class="num">'+uah(tot.paid)+'</b></div><div class="mn-rr tot"><span>До виплати</span><b class="num">'+uah(tot.left)+'</b></div></div></div>';
  h+='<p class="mn-fn" style="margin-top:12px">База нарахування: '+(App.db.settings.payroll.basis==='afterDiscount'?'сума послуг після знижки':'сума послуг до знижки')+'. Чайові нараховуються у частці, заданій для співробітника. Виплати рахуються за датою виплати.</p></div>';
  view.innerHTML=h;var root=view.firstElementChild;
  on(root,{
    pnav:function(b){App.setQ({d:b.dataset.d===T0?'':b.dataset.d})},
    open:function(b){payDrawer(b.dataset.id,P,per)},
    sel:function(b){App.setQ({s:b.dataset.id})},
    ppay:function(){payoutModal(selS,P,rerender)},
    pmore:function(b){var nm=(App.staff(selS)||{}).short||'';UI.menu(b,[{t:'Аванс · '+nm,ic:'wallet',fn:function(){payoutModal(selS,P,rerender,true)}},{t:'Премія · '+nm,ic:'plus',fn:function(){adjModal(selS,rerender,'bonus')}},{t:'Штраф · '+nm,ic:'minus',fn:function(){adjModal(selS,rerender,'fine')}}])},
    psett:function(){payrollSettingsModal()},
    pcsv:function(){var r=[['Співробітник','Візитів','Послуги','Правило','За послуги','Товари','Чайові','Фікс','Премії','Штрафи','Нараховано','Виплачено','До виплати']];rows.forEach(function(x){var p=x.p;r.push([x.s.n,p.visits,p.svcSum,ruleLbl(x.s,p),p.svcEarn,p.prodEarn,p.tips,p.fixed,p.bonus,p.fine,p.total,p.paid,p.left])});r.push(['Разом',tot.visits,tot.svcSum,'',tot.svcEarn,tot.prodEarn,tot.tips,tot.fixed,tot.bonus,tot.fine,tot.total,tot.paid,tot.left]);U.download('zarplaty-'+P.from+'_'+P.to+'.csv',U.csv(r),'text/csv;charset=utf-8');UI.toast('CSV завантажено')}});
  $$('[data-per]',root).forEach(function(b){b.onclick=function(){App.setQ({per:b.dataset.per===App.db.settings.payroll.period?'':b.dataset.per,d:anchor===T0?'':anchor})}});
  var sl=root.querySelector('#mn-prsl');
  if(sl)on(sl,{pay:function(){payoutModal(selS,P,rerender)},adj:function(){adjModal(selS,rerender)},rules:function(){rulesModal(selS,rerender)},slip:function(){paySlip(selS,P,per)},appt:function(b){App.openAppt(b.dataset.id)},
    pdel:function(b){var x=App.db.payouts.find(function(z){return z.id===b.dataset.id});if(!x)return;UI.confirm({title:'Видалити запис?',text:payoutLabel(x.type)+' '+uah(x.amount)+' від '+D.human(x.date)+'. Це змінить баланс до виплати.',ok:'Видалити',danger:true}).then(function(y){if(!y)return;O.remove('payouts',x.id,'Видалено запис');UI.toast('Запис видалено');rerender()})}});
  if(q.s&&App.staff(q.s)&&innerWidth<900&&!App._mnOpened){App._mnOpened=1;payDrawer(q.s,P,per);setTimeout(function(){App._mnOpened=0},500)}
}
function leftHtml(v){return v>0?'<b class="warn-t">'+fmt(v)+'</b>':v<0?'<span class="mute" title="Виплачено більше, ніж нараховано (аванс)">−'+fmt(-v)+' аванс</span>':'<span class="ok-t">0</span>'}

/* ── drawer співробітника ── */
function slipHtml(sid,P){var s=App.staff(sid);
    var p=PR(sid,P.from,P.to),db=App.db,all=p.lines.slice().sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0}),lines=all.filter(function(l){return l.kind!=='sale'}),sales=all.filter(function(l){return l.kind==='sale'});
    var adj=db.payouts.filter(function(x){return x.staff===sid&&x.date>=P.from&&x.date<=P.to}).sort(function(a,b){return a.date<b.date?1:-1});
    var hist=db.payouts.filter(function(x){return x.staff===sid&&(x.type==='salary'||x.type==='advance')}).sort(function(a,b){return a.date<b.date?1:-1}).slice(0,6);
    var h='<div class="mn-dw">';
    h+='<div class="mn-dw-h"><div class="row g12">'+UI.av(s,'lg')+'<div class="t" style="min-width:0"><b style="font-size:16px">'+esc(s.n)+'</b><div class="mute">'+esc(s.spec||App.ROLES[s.role].n)+' · '+esc(ruleLbl(s,p))+'</div></div></div></div>';
    h+='<div class="mn-dw-big"><div><small>До виплати</small><b class="num '+(p.left>0?'warn-t':'')+'">'+(p.left<0?'−':'')+uah(Math.abs(p.left))+'</b></div><div><small>Нараховано</small><b class="num">'+uah(p.total)+'</b></div><div><small>Виплачено</small><b class="num">'+uah(p.paid)+'</b></div></div>';
    h+='<div class="mn-dw-act"><button class="btn pri" data-a="pay">'+I('wallet')+' Виплатити</button><button class="btn" data-a="adj">'+I('plus','s')+' Премія / штраф</button><button class="btn" data-a="rules">'+I('percent')+' Правила</button><button class="btn" data-a="slip">'+I('print')+' Розрахунковий лист</button></div>';
    h+='<div class="card mn-card"><h3>Нарахування · '+esc(perLbl(P))+'</h3><div class="mn-rec">'+
      recRow2('Послуги: '+p.visits+' '+plural3(p.visits,'візит','візити','візитів')+' на '+uah(p.svcSum),p.svcEarn)+
      (p.fixed?recRow2('Фіксована частина',p.fixed):'')+(p.prodEarn||p.prod?recRow2('Товари: '+uah(p.prod)+' × '+(p.cfg.productPct||0)+'%',p.prodEarn):'')+(p.tips||p.tipsAll.length?recRow2('Чайові ('+(p.cfg.tipsPct!=null?p.cfg.tipsPct:100)+'% з '+uah(sum(p.tipsAll,function(x){return x.amount}))+')',p.tips):'')+
      (p.saleEarn?recRow2('Продажі: '+sales.length+' '+plural3(sales.length,'продаж','продажі','продажів'),p.saleEarn):'')+(p.bonus?recRow2('Премії',p.bonus):'')+(p.fine?recRow2('Штрафи',-p.fine):'')+
      '<div class="mn-rr tot"><span>Нараховано</span><b class="num">'+uah(p.total)+'</b></div></div></div>';
    /* рядки візитів */
    h+='<div class="card flush mn-card"><div class="card-h"><b>Візити</b><span class="pill-n">'+lines.length+'</span><span class="sp"></span><small class="mute">база × % = заробіток</small></div>';
    if(!lines.length)h+='<div class="mn-none">За цей період завершених візитів немає</div>';
    else h+='<div class="mn-lines-t"><table class="tbl mn-lt"><thead><tr><th>Дата</th><th>Клієнт · послуга</th><th class="r">База</th><th class="r">%</th><th class="r">Заробіток</th></tr></thead><tbody>'+lines.map(function(l){return '<tr class="click" data-a="appt" data-id="'+l.appt+'"><td class="nw">'+D.shortH(l.date)+'</td><td><b class="ell" style="display:block;max-width:230px">'+esc(cname(l.client))+'</b><small class="mute ell" style="display:block;max-width:230px">'+esc(svcName(l.svc))+'</small></td><td class="r num">'+fmt(l.base)+'</td><td class="r num">'+(l.pct||0)+'</td><td class="r num"><b>'+fmt(l.earn)+'</b></td></tr>'}).join('')+'</tbody><tfoot><tr><td colspan="2">Разом</td><td class="r num">'+fmt(p.svcSum)+'</td><td></td><td class="r num">'+fmt(p.svcEarn)+'</td></tr></tfoot></table></div>';
    h+='</div>';
    h+='<div class="card flush mn-card mn-sales"><div class="card-h"><b>Продажі</b><span class="pill-n">'+sales.length+'</span><span class="sp"></span><small class="mute">сертифікати й абонементи</small></div>'+(sales.length?'<div class="list">'+sales.map(function(l){return '<div class="li"><div class="t"><b class="ell">'+esc(l.t)+'</b><small>'+D.shortH(l.date)+(l.client?' · '+esc(cname(l.client)):'')+' · '+uah(l.base)+' × '+l.pct+'%</small></div><b class="num">'+uah(l.earn)+'</b></div>'}).join('')+'</div>':'<div class="mn-none">Продажів за період немає. % з продажу сертифікатів і абонементів зʼявиться тут.</div>')+'</div>';
    if(p.tipsAll.length||p.prodAll.length){
      h+='<div class="card flush mn-card"><div class="card-h"><b>Чайові й товари</b></div><div class="list">'+
       p.tipsAll.map(function(x){var a=x.appt&&App.appt(x.appt);return '<div class="li"><div class="t"><b>Чайові · '+D.shortH(x.date)+'</b><small>'+esc(a?cname(a.client):'')+' · '+esc(mName(x.method))+'</small></div><span class="num">'+uah(x.amount)+'</span></div>'}).join('')+
       p.prodAll.map(function(x){var pr=db.products.find(function(z){return z.id===x.product});return '<div class="li"><div class="t"><b>Товар · '+D.shortH(x.date)+'</b><small>'+esc(pr?pr.n:'')+'</small></div><span class="num">'+uah(x.amount)+'</span></div>'}).join('')+'</div></div>'}
    /* виплати за період */
    h+='<div class="card flush mn-card"><div class="card-h"><b>Операції за період</b><span class="pill-n">'+adj.length+'</span></div>'+(adj.length?'<div class="list">'+adj.map(function(x){var minus=x.type==='fine';return '<div class="li"><div class="t"><b>'+payoutLabel(x.type)+' · '+D.shortH(x.date)+'</b><small>'+esc(x.note||'')+(x.method&&(x.type==='salary'||x.type==='advance')?' · '+esc(mName(x.method)):'')+'</small></div><b class="num '+(minus?'dng-t':'')+'">'+(minus?'−':(x.type==='bonus'?'+':''))+uah(x.amount)+'</b><button class="icobtn sm ghost" data-a="pdel" data-id="'+x.id+'" aria-label="Видалити">'+I('trash','s')+'</button></div>'}).join('')+'</div>':'<div class="mn-none">Виплат і коригувань немає</div>')+'</div>';
    if(hist.length)h+='<div class="card flush mn-card"><div class="card-h"><b>Останні виплати</b></div><div class="list">'+hist.map(function(x){return '<div class="li"><div class="t"><b>'+payoutLabel(x.type)+'</b><small>'+D.human(x.date)+' · '+esc(mName(x.method))+'</small></div><span class="num">'+uah(x.amount)+'</span></div>'}).join('')+'</div></div>';
    return h+'</div>'}
function payDrawer(sid,P,per){
  var s=App.staff(sid),mdl;
  function body(){return slipHtml(sid,P)}
  mdl=UI.drawer({title:esc(s.short||s.n),sub:esc(PER[per])+' · '+esc(perLbl(P)),size:'wide',body:body(),
    onMount:function(el,close){var bodyEl=el.querySelector('.modal-b');
      function redraw(){bodyEl.innerHTML=body();rerender()}
      on(bodyEl,{
        pay:function(){payoutModal(sid,P,redraw)},
        adj:function(){adjModal(sid,redraw)},
        rules:function(){rulesModal(sid,redraw)},
        slip:function(){paySlip(sid,P,per)},
        appt:function(b){App.openAppt(b.dataset.id)},
        pdel:function(b){var x=App.db.payouts.find(function(z){return z.id===b.dataset.id});if(!x)return;UI.confirm({title:'Видалити запис?',text:payoutLabel(x.type)+' '+uah(x.amount)+' від '+D.human(x.date)+'. Це змінить баланс до виплати'+(x.method==='cash'&&(x.type==='salary'||x.type==='advance')?' і готівку в касі':'')+'.',ok:'Видалити',danger:true}).then(function(y){if(!y)return;O.remove('payouts',x.id,'Видалено '+payoutLabel(x.type).toLowerCase()+' '+uah(x.amount));UI.toast('Видалено',{undo:function(){App.db.payouts.push(x);App.log('create','payouts:'+x.id,'Відновлено');App.save();redraw()}});redraw()})}
      })}})}
function recRow2(l,v){return '<div class="mn-rr"><span>'+l+'</span><b class="num '+(v<0?'dng-t':'')+'">'+(v<0?'−':'')+uah(Math.abs(v))+'</b></div>'}

function payoutModal(sid,P,done,adv){
  var s=App.staff(sid),p=PR(sid,P.from,P.to),left=Math.max(0,p.left);
  UI.modal({title:(adv?'Аванс · ':'Виплатити · ')+esc(s.short||s.n),sub:esc(perLbl(P))+' · до виплати '+uah(p.left),size:'narrow',
    body:'<div class="col-f g12">'+field('Сума',sufInp('amount',left||'','₴'))+
      '<div class="row wrap"><button type="button" class="chip" data-full>Усе: '+uah(left)+'</button><button type="button" class="chip" data-half>Половина</button></div>'+
      field('Способом','<select class="sel" name="method">'+payOpts('iban')+'</select>')+field('Коментар','<input class="inp" name="note" placeholder="Напр. Зарплата за листопад (1-ша половина)" autocomplete="off">')+
      '<div class="note" data-after></div></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Виплатити</button>',
    onMount:function(el,close){
      var amtF=el.querySelector('[name=amount]'),after=el.querySelector('[data-after]');
      function upd(){var a=num(amtF.value),rest=p.left-a;var cashLow=rd(el,'method')==='cash'&&a>App.cashBalance(T());
        after.className='note '+(a>p.left&&a>0?'warn':'');
        after.innerHTML=I(a>p.left&&a>0?'alert':'info')+'<span>'+(a<=0?'Введіть суму виплати.':a>p.left?'Це більше за суму до виплати на '+uah(a-Math.max(0,p.left))+' — запишемо як <b>аванс</b>, він зменшить наступну виплату.':(rest>0?'Залишиться виплатити: <b>'+uah(rest)+'</b> (часткова виплата).':'Виплачено повністю.'))+(cashLow?' <b class="dng-t">У касі лише '+uah(App.cashBalance(T()))+'.</b>':'')+'</span>'}
      amtF.oninput=upd;el.querySelector('[name=method]').onchange=upd;
      el.querySelector('[data-full]').onclick=function(){amtF.value=left;upd()};el.querySelector('[data-half]').onclick=function(){amtF.value=Math.round(left/2);upd()};upd();
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){var a=Math.round(num(amtF.value));if(a<=0)return bad(amtF);var m=rd(el,'method');
        if(m==='cash'&&a>App.cashBalance(T())){UI.toast('У касі лише '+uah(App.cashBalance(T()))+' — інкасуйте з сейфа або оберіть інший спосіб',{type:'err'});return bad(amtF)}
        var type=a>p.left||p.left<=0?'advance':'salary';
        var o=O.payout({staff:sid,amount:a,type:type,method:m,note:rd(el,'note').trim()||(type==='advance'?'Аванс':'Зарплата за '+perLbl(P))});close();UI.toast((type==='advance'?'Аванс ':'Виплачено ')+uah(a)+' · '+(s.short||s.n),{undo:function(){O.remove('payouts',o.id,'Скасовано виплату');done&&done()}});done&&done()}}})}

function adjModal(sid,done,t0){
  var s=App.staff(sid),type=t0==='fine'?'fine':'bonus';
  UI.modal({title:'Премія або штраф',sub:esc(s.short||s.n),size:'narrow',
    body:'<div class="col-f g12">'+segHtml([['bonus','Премія'],['fine','Штраф']],type,'data-t')+field('Сума',sufInp('amount','','₴'))+field('Причина <small>обовʼязково</small>','<input class="inp" name="note" placeholder="Напр. за перевиконання плану / запізнення" autocomplete="off">')+field('Дата','<input class="inp" type="date" name="date" value="'+T()+'">')+'</div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
    onMount:function(el,close){$$('[data-t]',el).forEach(function(b){b.onclick=function(){type=b.dataset.t;setSeg(el,'data-t',type)}});
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){var a=Math.round(num(rd(el,'amount')));if(a<=0)return bad(el.querySelector('[name=amount]'));var n=rd(el,'note').trim();if(!n){UI.toast('Вкажіть причину',{type:'err'});return bad(el.querySelector('[name=note]'))}
        var dt=rd(el,'date');if(!dayOk(dt))return bad(el.querySelector('[name=date]'));
        var o=O.payout({staff:sid,amount:a,type:type,note:n,date:dt,method:null});close();UI.toast((type==='bonus'?'Премію':'Штраф')+' записано',{undo:function(){O.remove('payouts',o.id,'Скасовано');done&&done()}});done&&done()}}})}

function rulesModal(sid,done){
  var s=App.staff(sid),c=Object.assign({type:'pct',pct:null,fixed:0,svc:{},productPct:App.db.settings.payroll.productPctDefault||0,tipsPct:100},s.pay||{});c.svc=Object.assign({},c.svc||{});
  var lv=App.level(s.lvl);
  UI.modal({title:'Правила оплати',sub:esc(s.n),size:'wide',
    body:'<div class="col-f g16"><div class="grid2">'+
      field('Тип оплати','<select class="sel" name="type"><option value="pct">% від послуг</option><option value="fixed">Фіксована ставка</option><option value="fixed_pct">Фікс + % від послуг</option></select>')+
      field('Фікс за місяць <small>пропорційно періоду</small>',sufInp('fixed',c.fixed||'','₴'))+'</div>'+
      '<div class="grid2">'+field('% від послуг'+(lv?' <small>порожньо = за рівнем: '+lv.pct+'%</small>':''),sufInp('pct',c.pct==null?'':c.pct,'%',lv?String(lv.pct):'0'))+field('% з продажу товарів',sufInp('productPct',c.productPct==null?'':c.productPct,'%'))+'</div>'+
      '<div class="grid2">'+field('Частка чайових співробітнику',sufInp('tipsPct',c.tipsPct==null?100:c.tipsPct,'%','100'))+'<div></div></div>'+
      '<div><div class="mn-sec">Індивідуальні % за послугами <small class="mute">перекривають основний %</small></div><div class="col-f" data-ovs></div>'+
      '<div class="row wrap" style="margin-top:8px"><select class="sel" data-osvc style="flex:1;min-width:160px"></select><div class="inp-suf" style="width:110px"><input data-opct inputmode="decimal" placeholder="%"><span>%</span></div><button class="btn" data-oadd>'+I('plus','s')+' Додати</button></div></div></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
    onMount:function(el,close){
      el.querySelector('[name=type]').value=c.type||'pct';
      var ovs=el.querySelector('[data-ovs]'),sel=el.querySelector('[data-osvc]');
      function drawOv(){var ks=Object.keys(c.svc);ovs.innerHTML=ks.length?ks.map(function(k){return '<div class="mn-catrow"><div class="t ell"><b>'+esc(svcName(k))+'</b></div><b class="num">'+c.svc[k]+'%</b><button class="icobtn sm ghost" data-orm="'+k+'" aria-label="Прибрати">'+I('x','s')+'</button></div>'}).join(''):'<small class="mute">Винятків немає — всі послуги за основним %.</small>';
        var sv=App.db.services.filter(function(x){return x.active!==false&&c.svc[x.id]==null});sel.innerHTML=sv.map(function(x){return '<option value="'+x.id+'">'+esc(x.n)+'</option>'}).join('')}
      drawOv();
      function syncType(){var t=rd(el,'type');el.querySelector('[name=fixed]').closest('.fld').style.opacity=t==='pct'?.45:1;el.querySelector('[name=pct]').closest('.fld').style.opacity=t==='fixed'?.45:1}
      el.querySelector('[name=type]').onchange=syncType;syncType();
      ovs.onclick=function(e){var b=e.target.closest('[data-orm]');if(b){delete c.svc[b.dataset.orm];drawOv()}};
      el.querySelector('[data-oadd]').onclick=function(){var v=el.querySelector('[data-opct]'),n=num(v.value);if(!sel.value)return;if(v.value===''||n<0||n>100)return bad(v);c.svc[sel.value]=n;v.value='';drawOv()};
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){var type=rd(el,'type'),pct=rd(el,'pct').trim(),fx=num(rd(el,'fixed')),pp=num(rd(el,'productPct')),tp=rd(el,'tipsPct').trim()===''?100:num(rd(el,'tipsPct'));
        if(pct!==''&&(num(pct)<0||num(pct)>100))return bad(el.querySelector('[name=pct]'));if(tp<0||tp>100)return bad(el.querySelector('[name=tipsPct]'));if((type==='fixed'||type==='fixed_pct')&&fx<=0){UI.toast('Вкажіть фіксовану суму',{type:'err'});return bad(el.querySelector('[name=fixed]'))}
        O.upsert('staff',{id:sid,pay:{type:type,pct:pct===''?null:num(pct),fixed:fx,svc:c.svc,productPct:pp,tipsPct:tp}},'Змінено правила оплати: '+s.short);close();UI.toast('Правила збережено');done&&done()}}})}

function payrollSettingsModal(){
  var st=App.db.settings.payroll;
  UI.modal({title:'Правила розрахунку',sub:'Діють для всього салону',size:'narrow',
    body:'<div class="col-f g16"><div class="fld"><span>Розрахунковий період</span>'+segHtml([['half','Півмісяця'],['week','Тиждень'],['month','Місяць']],st.period,'data-per')+'<small>1–15 і 16–кінець місяця / пн–нд / календарний місяць</small></div>'+
      '<div class="fld"><span>База для % від послуг</span>'+segHtml([['afterDiscount','Після знижки'],['gross','До знижки']],st.basis==='afterDiscount'?'afterDiscount':'gross','data-basis')+'<small>Знижка зменшує базу майстра або салон її компенсує — у вас вирішує цей перемикач.</small></div>'+
      field('% з товарів за замовчуванням',sufInp('pp',st.productPctDefault!=null?st.productPctDefault:10,'%'),'для нових співробітників')+
      '<div class="note">'+I('info')+'<span>Індивідуальні відсотки, винятки за послугами, чайові й фікс задаються для кожного співробітника: відкрийте його і натисніть «Правила».</span></div></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Закрити</button>',
    onMount:function(el,close){el.querySelector('[data-no]').onclick=close;
      $$('[data-per]',el).forEach(function(b){b.onclick=function(){O.set('settings.payroll.period',b.dataset.per,'Період зарплат: '+PER[b.dataset.per]);setSeg(el,'data-per',b.dataset.per);UI.toast('Період: '+PER[b.dataset.per].toLowerCase());App.setQ({per:'',d:''},true)}});
      $$('[data-basis]',el).forEach(function(b){b.onclick=function(){O.set('settings.payroll.basis',b.dataset.basis,'База нарахування: '+(b.dataset.basis==='afterDiscount'?'після знижки':'до знижки'));setSeg(el,'data-basis',b.dataset.basis);UI.toast('Збережено');rerender()}});
      var pp=el.querySelector('[name=pp]');pp.onchange=function(){O.set('settings.payroll.productPctDefault',Math.max(0,Math.min(100,num(pp.value))),'% з товарів за замовчуванням');UI.toast('Збережено')}}})}

function paySlip(sid,P,per){
  var s=App.staff(sid),p=PR(sid,P.from,P.to),db=App.db,sal=db.salon;
  var lines=p.lines.slice().sort(function(a,b){return a.date<b.date?-1:1});
  var adj=db.payouts.filter(function(x){return x.staff===sid&&x.date>=P.from&&x.date<=P.to});
  var html='<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h1 style="font-size:22px">Розрахунковий лист</h1><div class="mute" style="margin-top:4px">'+esc(sal.name)+' · '+esc(sal.city+', '+sal.addr)+'</div></div><div style="text-align:right"><div class="b">'+esc(s.n)+'</div><div class="mute">'+esc(s.spec||'')+'</div><div class="mute">'+esc(PER[per])+': '+esc(D.human(P.from,{year:true}))+' – '+esc(D.human(P.to,{year:true}))+'</div></div></div>'+
   '<div class="sec">Підсумок</div><table><tbody><tr><td>Послуги: '+p.visits+' візит. на '+uah(p.svcSum)+' ('+esc(ruleLbl(s,p))+')</td><td class="r">'+uah(p.svcEarn)+'</td></tr>'+(p.fixed?'<tr><td>Фіксована частина</td><td class="r">'+uah(p.fixed)+'</td></tr>':'')+(p.prodEarn?'<tr><td>Товари: '+uah(p.prod)+' × '+(p.cfg.productPct||0)+'%</td><td class="r">'+uah(p.prodEarn)+'</td></tr>':'')+(p.tips?'<tr><td>Чайові</td><td class="r">'+uah(p.tips)+'</td></tr>':'')+(p.bonus?'<tr><td>Премії</td><td class="r">'+uah(p.bonus)+'</td></tr>':'')+(p.fine?'<tr><td>Штрафи</td><td class="r">−'+uah(p.fine)+'</td></tr>':'')+
   '<tr class="tot"><td>Нараховано</td><td class="r">'+uah(p.total)+'</td></tr><tr><td>Виплачено за період</td><td class="r">−'+uah(p.paid)+'</td></tr><tr class="tot"><td>До виплати</td><td class="r">'+uah(p.left)+'</td></tr></tbody></table>'+
   (adj.length?'<div class="sec">Виплати та коригування</div><table><tbody>'+adj.map(function(x){return '<tr><td>'+esc(D.human(x.date))+' · '+payoutLabel(x.type)+(x.note?' — '+esc(x.note):'')+'</td><td class="r">'+(x.type==='fine'?'−':'')+uah(x.amount)+'</td></tr>'}).join('')+'</tbody></table>':'')+
   '<div class="sec">Візити</div><table><thead><tr><th>Дата</th><th>Послуга</th><th class="r">База</th><th class="r">%</th><th class="r">Заробіток</th></tr></thead><tbody>'+lines.map(function(l){return '<tr><td>'+D.shortH(l.date)+'</td><td>'+esc(svcName(l.svc))+' <span class="mute">· '+esc(cname(l.client))+'</span></td><td class="r">'+fmt(l.base)+'</td><td class="r">'+(l.pct||0)+'</td><td class="r">'+fmt(l.earn)+'</td></tr>'}).join('')+'</tbody></table>'+
   '<div style="display:flex;gap:40px;margin-top:36px"><div style="flex:1;border-top:1px solid #121214;padding-top:4px" class="mute">Роботодавець</div><div style="flex:1;border-top:1px solid #121214;padding-top:4px" class="mute">Співробітник</div></div>';
  printDoc('Розрахунковий лист — '+s.n,html)}

/* ── «Мій заробіток» (майстер) ── */
function renderMyPay(view,q,per,P){
  var me=App.me(),T0=T(),sid=me.id,pT=PR(sid,T0,T0),pP=PR(sid,P.from,P.to),mo=perOf(T0,'month'),pM=PR(sid,mo.from,mo.to);
  var lines=pP.lines.slice().sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:0}),days=U.groupBy(lines,function(l){return l.date});
  var tipsByDay=U.groupBy(pP.tipsAll,function(x){return x.date});
  var h='<div class="page narrow mn-page"><div class="mn-head"><div class="mn-ttl"><h2>Мій заробіток</h2><p>'+esc(PER[per])+' · '+esc(perLbl(P))+'</p></div><div class="mn-daynav"><button class="icobtn" data-a="pnav" data-d="'+D.add(P.from,-1)+'" aria-label="Попередній період">'+I('left')+'</button><button class="icobtn" data-a="pnav" data-d="'+D.add(P.to,1)+'" aria-label="Наступний період">'+I('right')+'</button>'+((P.from<=T0&&P.to>=T0)?'':'<button class="btn" data-a="pnav" data-d="'+T0+'">Поточний</button>')+'</div></div>';
  h+=segHtml([['half','Півмісяця'],['week','Тиждень'],['month','Місяць']],per,'data-per');
  h+='<div class="kpis mn-kpis3" style="margin-top:12px">'+kpi('Сьогодні',uah(pT.total-pT.fixed),pT.visits+' '+plural3(pT.visits,'візит','візити','візитів'))+kpi('За період',uah(pP.total),pP.visits+' '+plural3(pP.visits,'візит','візити','візитів'))+kpi('Місяць',uah(pM.total),'нараховано')+'</div>';
  h+='<div class="card mn-card" style="margin-top:12px"><div class="mn-rec">'+recRow2('Послуги ('+ruleLbl(me,pP)+')',pP.svcEarn)+(pP.prodEarn?recRow2('Товари',pP.prodEarn):'')+(pP.tips?recRow2('Чайові',pP.tips):'')+(pP.fixed?recRow2('Фіксована частина',pP.fixed):'')+(pP.bonus?recRow2('Премії',pP.bonus):'')+(pP.fine?recRow2('Штрафи',-pP.fine):'')+'<div class="mn-rr tot"><span>Нараховано</span><b class="num">'+uah(pP.total)+'</b></div><div class="mn-rr"><span>Вже виплачено</span><b class="num">'+uah(pP.paid)+'</b></div><div class="mn-rr tot"><span>До виплати</span><b class="num '+(pP.left>0?'warn-t':'')+'">'+uah(pP.left)+'</b></div></div></div>';
  h+='<div class="card flush mn-card" style="margin-top:12px"><div class="card-h"><b>Візити за період</b><span class="pill-n">'+lines.length+'</span></div>';
  if(!lines.length)h+=UI.empty('coins','Поки що немає візитів','Заробіток зʼявляється після завершення візиту й оплати.');
  else h+='<div class="list">'+Object.keys(days).sort().reverse().map(function(d){var ls=days[d],t=sum(ls,function(l){return l.earn});return '<div class="mn-dayh"><b>'+esc(D.human(d,{wd:true}))+'</b><span class="num">'+uah(t)+'</span></div>'+ls.map(function(l){return '<button class="li" data-a="appt" data-id="'+l.appt+'"><div class="t"><b class="ell">'+esc(svcName(l.svc))+'</b><small>'+esc(cname(l.client))+' · '+fmt(l.base)+' × '+(l.pct||0)+'%</small></div><b class="num">'+uah(l.earn)+'</b></button>'}).join('')+(tipsByDay[d]?'<div class="li"><div class="t"><b>Чайові</b></div><b class="num">'+uah(sum(tipsByDay[d],function(x){return x.amount})*(pP.cfg.tipsPct!=null?pP.cfg.tipsPct:100)/100)+'</b></div>':'')}).join('')+'</div>';
  h+='</div>';
  var po=App.db.payouts.filter(function(x){return x.staff===sid}).sort(function(a,b){return a.date<b.date?1:-1}).slice(0,6);
  if(po.length)h+='<div class="card flush mn-card" style="margin-top:12px"><div class="card-h"><b>Мої виплати</b></div><div class="list">'+po.map(function(x){return '<div class="li"><div class="t"><b>'+payoutLabel(x.type)+'</b><small>'+D.human(x.date)+(x.note?' · '+esc(x.note):'')+'</small></div><b class="num '+(x.type==='fine'?'dng-t':'')+'">'+(x.type==='fine'?'−':'')+uah(x.amount)+'</b></div>'}).join('')+'</div></div>';
  h+='</div>';view.innerHTML=h;var root=view.firstElementChild;
  on(root,{pnav:function(b){App.setQ({d:b.dataset.d===T0?'':b.dataset.d})},appt:function(b){App.openAppt(b.dataset.id)}});
  $$('[data-per]',root).forEach(function(b){b.onclick=function(){App.setQ({per:b.dataset.per===App.db.settings.payroll.period?'':b.dataset.per,d:''})}});
}

/* ═════════ СЕРТИФІКАТИ ═════════ */
function certState(g){return g.balance<=0?'used':g.expires<T()?'expired':'active'}
var CST={active:['Активний','ok'],used:['Використаний','done'],expired:['Прострочений','dng']};
function codePrefix(){var l=(App.db.salon.logo||'SB').replace(/[^A-Za-z0-9А-Яа-яІіЇїЄє]/g,'').toUpperCase();return (l||'SB').slice(0,3)}
function newCode(){var used={};App.db.certs.forEach(function(g){used[g.code]=1});var c,n=0;do{c=codePrefix()+'-'+(1000+Math.floor(Math.random()*9000));n++}while(used[c]&&n<500);return c}
O.issueCert=function(o){var db=App.db,g={id:U.uid('g'),code:o.code||newCode(),nominal:o.nominal,balance:o.nominal,buyer:o.buyer||null,recipient:o.recipient||'',sold:T(),expires:D.add(T(),o.days||180),status:'active',note:o.note||'',method:o.method,log:[]};
  db.certs.push(g);db.payments.push({id:U.uid('p'),cert:g.id,appt:null,date:T(),ts:nowTs(),method:o.method,amount:o.nominal,kind:'cert_sale',staff:null,by:db.meId});
  App.log('create','cert:'+g.id,'Продано сертифікат '+g.code+' на '+uah(o.nominal));App.save();return g};
O.deleteCert=function(id){var db=App.db,g=db.certs.find(function(x){return x.id===id});if(!g)return;var pays=db.payments.filter(function(p){return p.cert===id&&p.kind==='cert_sale'});
  db.certs=db.certs.filter(function(x){return x.id!==id});db.payments=db.payments.filter(function(p){return !(p.cert===id&&p.kind==='cert_sale')});App.log('delete','cert:'+id,'Видалено сертифікат '+g.code);App.save();return {g:g,pays:pays}};
O.restoreCert=function(r){App.db.certs.push(r.g);r.pays.forEach(function(p){App.db.payments.push(p)});App.log('create','cert:'+r.g.id,'Відновлено сертифікат '+r.g.code);App.save()};
function certRedeems(g){return App.db.payments.filter(function(p){return p.cert===g.id&&p.kind==='cert'}).sort(function(a,b){return (a.ts||'')<(b.ts||'')?1:-1})}
function certSale(g){return App.db.payments.find(function(p){return p.cert===g.id&&p.kind==='cert_sale'})}
function balBar(g){var st=certState(g),pc=g.nominal?Math.max(g.balance/g.nominal*100,g.balance>0?3:0):0;return '<div class="bar-h mn-bb '+st+'"><i style="width:'+pc+'%"></i></div>'}

function renderCerts(view,params,q){
  var db=App.db,T0=T(),tab=['active','used','expired','all'].indexOf(q.t)>=0?q.t:'active',qq=(q.q||'').trim().toLowerCase(),mng=App.can('certs.*');
  var all=db.certs.map(function(g){return {g:g,st:certState(g)}});
  var cnt={active:0,used:0,expired:0,all:all.length};all.forEach(function(x){cnt[x.st]++});
  var rows=all.filter(function(x){if(tab!=='all'&&x.st!==tab)return false;if(!qq)return true;var g=x.g;return g.code.toLowerCase().indexOf(qq)>=0||cname(g.buyer).toLowerCase().indexOf(qq)>=0||(g.recipient||'').toLowerCase().indexOf(qq)>=0}).sort(function(a,b){return a.g.sold<b.g.sold?1:-1});
  var liab=sum(all.filter(function(x){return x.st==='active'}),function(x){return x.g.balance});
  var soon=all.filter(function(x){return x.st==='active'&&D.diff(T0,x.g.expires)<=30}).length;
  var ms=T0.slice(0,7),soldM=db.payments.filter(function(p){return p.kind==='cert_sale'&&p.date.slice(0,7)===ms});
  var mode=db.settings.accounting.certRevenue;
  var h='<div class="page mn-page"><div class="mn-head"><div class="mn-ttl"><h2>Сертифікати</h2><p>Подарункові сертифікати та їх залишки</p></div></div>';
  h+='<div class="mn-actions">'+(mng?'<button class="btn pri" data-a="sell">'+I('plus','s')+' Продати сертифікат</button>':'')+'<span class="sp"></span><button class="btn" data-a="acc">'+I('info')+' Облік виторгу</button></div>';
  h+='<div class="kpis mn-kpis4">'+kpi('Активних',String(cnt.active),'сертифікатів')+kpi('Залишок за активними',uah(liab),'зобовʼязання салону')+kpi('Продано за місяць',uah(sum(soldM,function(p){return p.amount})),soldM.length+' '+plural3(soldM.length,'сертифікат','сертифікати','сертифікатів'))+kpi('Спливає за 30 днів',String(soon),soon?'нагадайте власникам':'—',soon?'warn-t':'')+'</div>';
  h+='<div class="note acc mn-note" style="margin-top:12px">'+I('info')+'<span>'+(mode==='redeem'?'Виторг рахується <b>при використанні</b>: продаж сертифіката — не виторг, а зобовʼязання; виторгом стає оплата візиту сертифікатом.':'Виторг рахується <b>при продажу</b>: сертифікат одразу в виторгу, а використання сертифікатом виторгу вдруге не збільшує.')+' </span><button class="btn sm" data-a="acc" style="margin-left:auto;align-self:center">Змінити</button></div>';
  h+='<div class="tabs mn-tabs" role="tablist" style="margin-top:16px">'+[['active','Активні'],['used','Використані'],['expired','Прострочені'],['all','Усі']].map(function(t){return '<button role="tab" aria-selected="'+(tab===t[0])+'" data-a="tab" data-t="'+t[0]+'">'+t[1]+' <span class="cnt">'+cnt[t[0]]+'</span></button>'}).join('')+'</div>';
  h+='<div class="mn-filter"><div class="inp-ic" style="flex:1;max-width:340px">'+I('search')+'<input class="inp" data-q placeholder="Код, покупець або отримувач" value="'+esc(q.q||'')+'" autocomplete="off"></div></div>';
  if(!rows.length)h+='<div class="card flush">'+UI.empty('gift',qq?'Нічого не знайдено':'Тут поки порожньо',qq?'Спробуйте інший код або імʼя.':(tab==='active'?'Продайте перший сертифікат — він зʼявиться в цьому списку.':'Немає сертифікатів у цьому статусі.'),mng&&!qq&&tab==='active'?'<button class="btn pri" data-a="sell" style="margin-top:8px">Продати сертифікат</button>':'')+'</div>';
  else h+='<div class="list mn-gl">'+rows.map(function(x){var g=x.g,s=CST[x.st],dl=D.diff(T0,g.expires);
    return '<button class="li mn-g" data-a="card" data-id="'+g.id+'"><span class="mn-gic">'+I('gift')+'</span><div class="t"><b><span class="mn-code">'+esc(g.code)+'</span></b><small class="ell">'+esc(g.buyer?cname(g.buyer):'Покупець без імені')+(g.recipient?' → '+esc(g.recipient.replace(/^Для:\s*/,'')):'')+' · продано '+D.shortH(g.sold)+'</small></div>'+
     '<div class="mn-gm"><div class="r"><b class="num">'+uah(g.balance)+'</b><small class="mute num"> / '+uah(g.nominal)+'</small></div>'+balBar(g)+'</div>'+
     '<div class="mn-gs"><span class="badge '+s[1]+'">'+s[0]+'</span><small class="mute nw">'+(x.st==='expired'?'до '+D.shortH(g.expires):x.st==='used'?'':(dl<=30?'ще '+dl+' '+plural3(dl,'день','дні','днів'):'до '+D.shortH(g.expires)))+'</small></div></button>'}).join('')+'</div>';
  h+='</div>';view.innerHTML=h;var root=view.firstElementChild;
  var qi=root.querySelector('[data-q]');qi.oninput=U.debounce(function(){App.setQ({q:qi.value.trim()},true);var n=$('[data-q]');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},250);
  on(root,{sell:function(){App.sellCert()},tab:function(b){App.setQ({t:b.dataset.t==='active'?'':b.dataset.t})},card:function(b){certDrawer(b.dataset.id)},acc:function(){accModal()}});
  if(params[0]&&db.certs.some(function(g){return g.id===params[0]})&&!App._mnCo){App._mnCo=1;certDrawer(params[0]);setTimeout(function(){App._mnCo=0},500)}
}
function accModal(){
  var cur=App.db.settings.accounting.certRevenue,cn=can('settings.accounting')||App.me().role==='owner'||App.me().role==='accountant';
  UI.modal({title:'Облік виторгу по сертифікатах',size:'narrow',
    body:'<div class="col-f g12"><p class="mn-fn" style="margin:0">Це вплине на «Виторг» у касі, звітах і на головній. Гроші в касі й виписці від цього не змінюються.</p>'+
     '<label class="mn-opt"><input type="radio" name="m" value="redeem"'+(cur==='redeem'?' checked':'')+'><span><b>Коли використали</b><small>Продаж = зобовʼязання (аванс від клієнта). Виторг зʼявляється в день, коли клієнт оплатив візит сертифікатом. Це класичний облік.</small></span></label>'+
     '<label class="mn-opt"><input type="radio" name="m" value="sale"'+(cur==='sale'?' checked':'')+'><span><b>Коли продали</b><small>Продаж сертифіката одразу в виторгу. Використання не додає виторгу вдруге. Простіше, але прострочені сертифікати вже «пораховані».</small></span></label>'+
     (cn?'':'<div class="note warn">'+I('lock')+'<span>Змінювати може власник або бухгалтер.</span></div>')+'</div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Закрити</button><button class="btn pri" data-ok '+(cn?'':'disabled')+'>Зберегти</button>',
    onMount:function(el,close){el.querySelector('[data-no]').onclick=close;el.querySelector('[data-ok]').onclick=function(){var v=el.querySelector('[name=m]:checked').value;if(v!==cur){O.set('settings.accounting.certRevenue',v,'Облік виторгу по сертифікатах: '+(v==='sale'?'при продажу':'при використанні'))}close();UI.toast('Збережено');rerender()}}})}

function soldByFld(){var me=App.db.meId;return field('Продав(ла) <small>для % з продажу</small>','<select class="sel" name="soldBy">'+App.db.staff.filter(function(x){return x.active!==false}).map(function(x){return '<option value="'+x.id+'"'+(x.id===me?' selected':'')+'>'+esc(x.short||x.n)+'</option>'}).join('')+'</select>')}
App.sellCert=function(o){o=o||{};
  var buyer=o.buyer&&App.client(o.buyer)?o.buyer:null,nominal=1000,custom=false,days=180;
  var m=UI.modal({title:'Продати сертифікат',size:'wide',
    body:'<div class="mn-sell"><div class="col-f g16">'+
     '<div class="fld"><span>Номінал</span><div class="chips" data-nom>'+[500,1000,1500,2000].map(function(n){return '<button type="button" class="chip" data-n="'+n+'" aria-pressed="'+(n===1000)+'">'+fmt(n)+' ₴</button>'}).join('')+'<button type="button" class="chip" data-n="custom" aria-pressed="false">Інша сума</button></div><div data-cust hidden style="margin-top:8px">'+sufInp('custom','','₴','Сума')+'</div></div>'+
     '<div class="fld"><span>Покупець <small>необовʼязково</small></span><div data-buyer></div></div>'+
     field('Для кого <small>імʼя отримувача, необовʼязково</small>','<input class="inp" name="rec" placeholder="Напр. Оксані на день народження" autocomplete="off">')+
    '</div><div class="col-f g16">'+
     '<div class="fld"><span>Діє</span><div class="chips" data-days>'+[[90,'3 міс.'],[180,'6 міс.'],[365,'рік']].map(function(d){return '<button type="button" class="chip" data-d="'+d[0]+'" aria-pressed="'+(d[0]===180)+'">'+d[1]+'</button>'}).join('')+'</div><small data-until></small></div>'+
     field('Оплата','<select class="sel" name="method">'+payOpts('cash')+'</select>')+soldByFld()+
     field('Код <small>можна змінити</small>','<input class="inp" name="code" value="'+newCode()+'" autocomplete="off" spellcheck="false">')+
     field('Нотатка','<input class="inp" name="note" placeholder="Напр. Подарунок від чоловіка" autocomplete="off">')+
     '<div class="note">'+I('info')+'<span data-mode></span></div></div></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Продати</button>',
    onMount:function(el,close){
      var bx=el.querySelector('[data-buyer]');
      function drawBuyer(){if(buyer){var c=App.client(buyer);bx.innerHTML='<div class="mn-picked">'+UI.av(c,'sm')+'<b class="ell">'+esc(c.n)+'</b><span class="sp"></span><button type="button" class="icobtn sm ghost" data-clr aria-label="Прибрати">'+I('x','s')+'</button></div>';bx.querySelector('[data-clr]').onclick=function(){buyer=null;drawBuyer()}}
        else{bx.innerHTML='<button type="button" class="btn blk" data-pick>'+I('user','s')+' Обрати клієнта</button>';bx.querySelector('[data-pick]').onclick=function(){bx.innerHTML='<div data-cp></div>';UI.clientPicker(bx.firstChild,function(c){buyer=c.id;drawBuyer()})}}}
      drawBuyer();
      function nomVal(){return custom?Math.round(num(rd(el,'custom'))):nominal}
      function upd(){el.querySelector('[data-until]').textContent='до '+D.human(D.add(T(),days),{year:true});
        el.querySelector('[data-mode]').textContent=App.db.settings.accounting.certRevenue==='redeem'?'Гроші надходять у касу/банк зараз, але виторгом це стане, коли клієнт використає сертифікат.':'Продаж одразу піде у виторг (налаштування обліку).'}
      upd();
      $$('[data-nom] .chip',el).forEach(function(b){b.onclick=function(){$$('[data-nom] .chip',el).forEach(function(x){x.setAttribute('aria-pressed','false')});b.setAttribute('aria-pressed','true');custom=b.dataset.n==='custom';if(!custom)nominal=+b.dataset.n;el.querySelector('[data-cust]').hidden=!custom;if(custom)el.querySelector('[name=custom]').focus()}});
      $$('[data-days] .chip',el).forEach(function(b){b.onclick=function(){$$('[data-days] .chip',el).forEach(function(x){x.setAttribute('aria-pressed','false')});b.setAttribute('aria-pressed','true');days=+b.dataset.d;upd()}});
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){var nv=nomVal();if(nv<=0)return bad(custom?el.querySelector('[name=custom]'):null)||UI.toast('Вкажіть суму',{type:'err'});
        var code=rd(el,'code').trim().toUpperCase();if(!code)return bad(el.querySelector('[name=code]'));if(App.db.certs.some(function(g){return g.code.toUpperCase()===code})){UI.toast('Сертифікат з кодом '+code+' уже є',{type:'err'});return bad(el.querySelector('[name=code]'))}
        var g=O.issueCert({nominal:nv,buyer:buyer,recipient:rd(el,'rec').trim(),days:days,method:rd(el,'method'),note:rd(el,'note').trim(),code:code});if(g){g.soldBy=rd(el,'soldBy')||App.db.meId;App.save(true)}close();UI.toast('Сертифікат '+g.code+' на '+uah(nv)+' продано');
        if(App.cur&&(App.cur.rt.id==='certs'||App.cur.rt.id==='cash'))rerender();certDrawer(g.id)}}});
  return m};

function certDrawer(id){
  var g0=App.db.certs.find(function(x){return x.id===id});if(!g0)return;
  function body(){var g=App.db.certs.find(function(x){return x.id===id}),st=certState(g),s=CST[st],sale=certSale(g),red=certRedeems(g),mng=App.can('certs.*');
    var wo=(g.log||[]).filter(function(l){return l.type==='writeoff'}),ext=(g.log||[]).filter(function(l){return l.type==='extend'});
    var used=g.nominal-g.balance,known=sum(red,function(p){return p.amount})+sum(wo,function(l){return l.amount}),prior=used-known;
    var h='<div class="mn-gd"><div class="mn-gcard '+st+'"><div class="mn-gcard-t"><span class="mn-code">'+esc(g.code)+'</span><span class="badge '+s[1]+'">'+s[0]+'</span></div><div class="mn-gbal"><b class="num">'+uah(g.balance)+'</b><small>залишок із '+uah(g.nominal)+'</small></div>'+balBar(g)+'<div class="mn-gcard-f"><span>діє до '+D.human(g.expires,{year:true})+'</span>'+(st==='active'?'<span>'+(D.diff(T(),g.expires)+' '+plural3(D.diff(T(),g.expires),'день','дні','днів'))+'</span>':'')+'</div></div>';
    h+='<div class="mn-dw-act">'+'<button class="btn" data-a="print">'+I('print')+' Друк</button><button class="btn" data-a="copy">'+I('copy')+' Копіювати код</button>'+(mng?'<button class="btn" data-a="ext">'+I('clock')+' Продовжити</button>'+(g.balance>0?'<button class="btn" data-a="wo">'+I('minus','s')+' Списати</button>':''):'')+'</div>';
    h+='<div class="card mn-card"><dl class="dl"><dt>Покупець</dt><dd>'+(g.buyer&&App.client(g.buyer)?'<a class="link" href="#" data-a="client" data-id="'+g.buyer+'">'+esc(cname(g.buyer))+'</a>':'—')+'</dd><dt>Отримувач</dt><dd>'+esc((g.recipient||'—').replace(/^Для:\s*/,''))+'</dd><dt>Продано</dt><dd>'+D.human(g.sold,{year:true})+(sale?' · '+esc(mName(sale.method)):'')+'</dd><dt>Діє до</dt><dd>'+D.human(g.expires,{year:true})+'</dd>'+(g.note?'<dt>Нотатка</dt><dd>'+esc(g.note)+'</dd>':'')+'</dl></div>';
    h+='<div class="card flush mn-card"><div class="card-h"><b>Історія</b></div><div class="list">';
    var ev=[];
    ev.push({d:g.sold,t:'Продаж · '+uah(g.nominal),s:sale?mName(sale.method):'',v:'+'+uah(g.nominal)});
    red.forEach(function(p){var a=p.appt&&App.appt(p.appt);ev.push({d:p.date,t:'Оплата візиту',s:a?cname(a.client)+' · '+App.apptTitle(a):'',v:'−'+uah(p.amount),appt:p.appt})});
    wo.forEach(function(l){ev.push({d:(l.ts||'').slice(0,10),t:'Ручне списання',s:l.note||'',v:'−'+uah(l.amount)})});
    ext.forEach(function(l){ev.push({d:(l.ts||'').slice(0,10),t:'Термін продовжено',s:'до '+D.human(l.to,{year:true})+(l.note?' · '+l.note:''),v:''})});
    if(prior>0)ev.push({d:g.sold,t:'Використано раніше',s:'до початку обліку в системі',v:'−'+uah(prior),late:true});
    ev.sort(function(a,b){return a.d<b.d?1:a.d>b.d?-1:(a.late?1:0)});
    h+=ev.map(function(e){return '<'+(e.appt?'button data-a="appt" data-id="'+e.appt+'"':'div')+' class="li"><div class="t"><b>'+esc(e.t)+'</b><small>'+D.human(e.d)+(e.s?' · '+esc(e.s):'')+'</small></div><span class="num">'+e.v+'</span></'+(e.appt?'button':'div')+'>'}).join('');
    h+='</div></div>';return h+'</div>'}
  var mdl=UI.drawer({title:'Сертифікат '+esc(g0.code),sub:'на '+uah(g0.nominal),body:body(),
    onMount:function(el,close){var bodyEl=el.querySelector('.modal-b');function redraw(){bodyEl.innerHTML=body();rerender()}
      on(bodyEl,{print:function(){printCert(id)},copy:function(){var g=App.db.certs.find(function(x){return x.id===id});try{navigator.clipboard.writeText(g.code)}catch(e){}UI.toast('Код '+g.code+' скопійовано')},ext:function(){extendModal(id,redraw)},wo:function(){writeOffModal(id,redraw)},client:function(b){App.openClient(b.dataset.id)},appt:function(b){App.openAppt(b.dataset.id)}})}});
  return mdl}

function extendModal(id,done){
  var g=App.db.certs.find(function(x){return x.id===id}),from=g.expires>T()?g.expires:T();
  UI.modal({title:'Продовжити термін',sub:esc(g.code)+' · зараз до '+D.human(g.expires,{year:true}),size:'narrow',
    body:'<div class="col-f g12"><div class="chips">'+[[30,'+1 міс.'],[90,'+3 міс.'],[180,'+6 міс.'],[365,'+рік']].map(function(d){return '<button type="button" class="chip" data-add="'+d[0]+'">'+d[1]+'</button>'}).join('')+'</div>'+field('Діє до','<input class="inp" type="date" name="to" value="'+D.add(from,90)+'">')+field('Причина','<input class="inp" name="note" placeholder="Напр. клієнтка була у від’їзді" autocomplete="off">')+'</div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Продовжити</button>',
    onMount:function(el,close){$$('[data-add]',el).forEach(function(b){b.onclick=function(){el.querySelector('[name=to]').value=D.add(from,+b.dataset.add)}});el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){var to=rd(el,'to');if(!dayOk(to)||to<=T())return bad(el.querySelector('[name=to]'))||UI.toast('Дата має бути в майбутньому',{type:'err'});var old=g.expires;O.extendCert(id,to,rd(el,'note').trim());close();UI.toast('Діє до '+D.human(to,{year:true}),{undo:function(){O.patchCert(id,{expires:old,status:certState(Object.assign({},g,{expires:old}))},'Скасовано продовження');done&&done()}});done&&done()}}})}
function writeOffModal(id,done){
  var g=App.db.certs.find(function(x){return x.id===id});
  UI.modal({title:'Списати з сертифіката',sub:esc(g.code)+' · залишок '+uah(g.balance),size:'narrow',
    body:'<div class="col-f g12"><div class="note warn">'+I('alert')+'<span>Це ручне списання без оплати візиту: сума просто зникає із залишку (втрата, брак, помилка). Виторг не змінюється.</span></div>'+field('Сума',sufInp('amount',g.balance,'₴'))+field('Причина <small>обовʼязково</small>','<input class="inp" name="why" placeholder="Напр. сертифікат втрачено" autocomplete="off">')+'</div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn dng pri" data-ok>Списати</button>',
    onMount:function(el,close){el.querySelector('[data-no]').onclick=close;el.querySelector('[data-ok]').onclick=function(){var a=Math.round(num(rd(el,'amount')));if(a<=0||a>g.balance)return bad(el.querySelector('[name=amount]'));var w=rd(el,'why').trim();if(!w){UI.toast('Вкажіть причину',{type:'err'});return bad(el.querySelector('[name=why]'))}
      var prev={balance:g.balance,status:g.status,len:(g.log||[]).length};O.writeOffCert(id,a,w);close();UI.toast('Списано '+uah(a),{undo:function(){O.patchCert(id,{balance:prev.balance,status:prev.status,log:(g.log||[]).slice(0,prev.len)},'Скасовано списання');done&&done()}});done&&done()}}})}

function printCert(id){
  var g=App.db.certs.find(function(x){return x.id===id}),sal=App.db.salon;
  var css='body{padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh}.cert{width:640px;margin:32px auto;border:1px solid #121214;padding:10px}.cert-in{border:1px solid #d9d9de;padding:44px 40px;text-align:center}.cert small{display:block;letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#6e6e73}.cert h1{font-size:34px;margin:14px 0 6px;letter-spacing:-.01em}.cert .amt{font-family:FixelDisplay,Fixel,sans-serif;font-weight:600;font-size:64px;margin:26px 0 6px;letter-spacing:-.02em}.cert .rec{font-size:16px;margin-top:18px}.cert .code{display:inline-block;margin-top:26px;border:1px solid #121214;border-radius:8px;padding:8px 18px;font-weight:600;font-size:18px;letter-spacing:.12em}.cert .meta{margin-top:22px;color:#6e6e73;font-size:12.5px;line-height:1.7}.cert .brand{font-size:15px;font-weight:600;letter-spacing:.02em}.line{width:48px;height:1px;background:#121214;margin:16px auto}';
  var rec=(g.recipient||'').replace(/^Для:\s*/,'');
  var html='<div class="cert"><div class="cert-in"><div class="brand">'+esc(sal.name)+'</div><small style="margin-top:4px">'+esc(sal.city)+'</small><div class="line"></div><small>Подарунковий сертифікат</small><div class="amt">'+fmt(g.nominal)+' ₴</div>'+(rec?'<div class="rec">для <b>'+esc(rec)+'</b></div>':'<div class="rec mute">на послуги салону</div>')+'<div class="code">'+esc(g.code)+'</div><div class="meta">Діє до '+esc(D.human(g.expires,{year:true}))+'<br>Дійсний на всі послуги салону. Залишок зберігається.<br>'+esc(sal.addr+', '+sal.city)+' · '+esc(sal.phone)+'</div></div></div>';
  printDoc('Сертифікат '+g.code,html,css)}

/* ═════════ АБОНЕМЕНТИ ═════════ */
function abType(id){return App.db.abonTypes.find(function(t){return t.id===id})}
function abState(a){if(a.status==='frozen')return 'frozen';if(a.left<=0)return 'used';if(a.expires<T())return 'expired';return 'active'}
var AST={active:['Активний','ok'],frozen:['Заморожений','acc'],used:['Використаний','done'],expired:['Прострочений','dng']};
function abName(a){var t=abType(a.type);return t?t.n:'Абонемент'}
function abSvc(t){return (t.svc||[]).map(svcName).join(', ')||'будь-які послуги'}
function abUnit(a){return Math.round(a.price/Math.max(1,a.qty))}
function abUses(a){return App.db.payments.filter(function(p){return p.abon===a.id&&p.kind==='abon'}).sort(function(x,y){return (x.ts||'')<(y.ts||'')?1:-1})}
O.saveAbonType=function(t){var db=App.db,x=t.id&&abType(t.id);if(x){Object.assign(x,t);App.log('edit','abonType:'+x.id,'Змінено тип абонемента «'+x.n+'»')}else{x=Object.assign({id:U.uid('at'),on:true},t);db.abonTypes.push(x);App.log('create','abonType:'+x.id,'Новий тип абонемента «'+x.n+'»')}App.save();return x};
O.deleteAbonType=function(id){var t=abType(id);App.db.abonTypes=App.db.abonTypes.filter(function(x){return x.id!==id});App.log('delete','abonType:'+id,'Видалено тип абонемента «'+(t&&t.n)+'»');App.save();return t};
O.deleteAbon=function(id){var db=App.db,a=db.abons.find(function(x){return x.id===id});if(!a)return;var pays=db.payments.filter(function(p){return p.abon===id&&p.kind==='abon_sale'});db.abons=db.abons.filter(function(x){return x.id!==id});db.payments=db.payments.filter(function(p){return !(p.abon===id&&p.kind==='abon_sale')});App.log('delete','abon:'+id,'Видалено абонемент');App.save();return {a:a,pays:pays}};
O.restoreAbon=function(r){App.db.abons.push(r.a);r.pays.forEach(function(p){App.db.payments.push(p)});App.log('create','abon:'+r.a.id,'Відновлено абонемент');App.save()};

function renderAbons(view,params,q){
  var db=App.db,T0=T(),mng=can('abons.*'),tab=['types','active','used','all'].indexOf(q.t)>=0?q.t:'active',qq=(q.q||'').trim().toLowerCase();
  var all=db.abons.map(function(a){return {a:a,st:abState(a)}});
  var cnt={active:0,used:0,all:all.length,types:db.abonTypes.length};all.forEach(function(x){if(x.st==='active'||x.st==='frozen')cnt.active++;else cnt.used++});
  var rows=all.filter(function(x){if(tab==='active'&&x.st!=='active'&&x.st!=='frozen')return false;if(tab==='used'&&(x.st==='active'||x.st==='frozen'))return false;if(!qq)return true;return cname(x.a.client).toLowerCase().indexOf(qq)>=0||abName(x.a).toLowerCase().indexOf(qq)>=0}).sort(function(x,y){return x.a.sold<y.a.sold?1:-1});
  var ms=T0.slice(0,7),sold=db.payments.filter(function(p){return p.kind==='abon_sale'&&p.date.slice(0,7)===ms});
  var liab=sum(all.filter(function(x){return x.st==='active'||x.st==='frozen'}),function(x){return abUnit(x.a)*x.a.left});
  var soon=all.filter(function(x){return x.st==='active'&&D.diff(T0,x.a.expires)<=14}).length;
  var h='<div class="page mn-page"><div class="mn-head"><div class="mn-ttl"><h2>Абонементи</h2><p>Пакети візитів зі знижкою — продаж, залишки, терміни</p></div></div>';
  h+='<div class="mn-actions">'+(mng?'<button class="btn pri" data-a="sell">'+I('plus','s')+' Продати абонемент</button>':'')+'<span class="sp"></span>'+(mng?'<button class="btn" data-a="newtype">'+I('plus','s')+' Новий тип</button>':'')+'</div>';
  h+='<div class="kpis mn-kpis4">'+kpi('Активних',String(cnt.active),'абонементів')+kpi('Залишок візитів у вартості',uah(liab),'невикористаний залишок')+kpi('Продано за місяць',uah(sum(sold,function(p){return p.amount})),sold.length+' '+plural3(sold.length,'абонемент','абонементи','абонементів'))+kpi('Спливає за 14 днів',String(soon),soon?'нагадайте клієнтам':'—',soon?'warn-t':'')+'</div>';
  h+='<div class="tabs mn-tabs" role="tablist" style="margin-top:16px">'+[['active','Активні'],['used','Завершені'],['all','Усі'],['types','Типи абонементів']].map(function(t){return '<button role="tab" aria-selected="'+(tab===t[0])+'" data-a="tab" data-t="'+t[0]+'">'+t[1]+' <span class="cnt">'+cnt[t[0]]+'</span></button>'}).join('')+'</div>';
  if(tab==='types'){
    if(!db.abonTypes.length)h+='<div class="card flush">'+UI.empty('ticket','Типів абонементів ще немає','Створіть пакет, наприклад «5 манікюрів».',mng?'<button class="btn pri" data-a="newtype" style="margin-top:8px">Новий тип</button>':'')+'</div>';
    else h+='<div class="list mn-gl" style="margin-top:12px">'+db.abonTypes.map(function(t){var n=db.abons.filter(function(a){return a.type===t.id}).length,per=Math.round(t.price/t.qty),full=sum((t.svc||[]).map(App.svc).filter(Boolean),function(s){return s.price})/Math.max(1,(t.svc||[]).length),sv=full&&full>per?Math.round((1-per/full)*100):0;
      return '<button class="li mn-g" data-a="edtype" data-id="'+t.id+'"><span class="mn-gic">'+I('ticket')+'</span><div class="t"><b>'+esc(t.n)+(t.on===false?' <span class="badge plain">вимкнено</span>':'')+'</b><small class="ell">'+t.qty+' візит. · '+esc(abSvc(t))+' · діє '+t.days+' дн.</small></div><div class="mn-gm"><div class="r"><b class="num">'+uah(t.price)+'</b></div><small class="mute num">'+uah(per)+' за візит'+(sv?' · −'+sv+'%':'')+'</small></div><div class="mn-gs"><small class="mute">продано '+n+'</small></div></button>'}).join('')+'</div>';
  }else{
    h+='<div class="mn-filter"><div class="inp-ic" style="flex:1;max-width:340px">'+I('search')+'<input class="inp" data-q placeholder="Клієнт або назва" value="'+esc(q.q||'')+'" autocomplete="off"></div></div>';
    if(!rows.length)h+='<div class="card flush">'+UI.empty('ticket',qq?'Нічого не знайдено':'Тут поки порожньо',qq?'Спробуйте інше імʼя.':'Продайте перший абонемент клієнту.',mng&&!qq?'<button class="btn pri" data-a="sell" style="margin-top:8px">Продати абонемент</button>':'')+'</div>';
    else h+='<div class="list mn-gl">'+rows.map(function(x){var a=x.a,s=AST[x.st],dl=D.diff(T0,a.expires),pc=a.qty?a.left/a.qty*100:0;
      return '<button class="li mn-g" data-a="card" data-id="'+a.id+'"><span class="mn-gic">'+I('ticket')+'</span><div class="t"><b class="ell">'+esc(cname(a.client))+'</b><small class="ell">'+esc(abName(a))+' · продано '+D.shortH(a.sold)+'</small></div><div class="mn-gm"><div class="r"><b class="num">'+a.left+'</b><small class="mute num"> / '+a.qty+' візит.</small></div><div class="bar-h mn-bb '+(x.st==='active'||x.st==='frozen'?'active':x.st)+'"><i style="width:'+(a.left?Math.max(pc,4):0)+'%"></i></div></div><div class="mn-gs"><span class="badge '+s[1]+'">'+s[0]+'</span><small class="mute nw">'+(x.st==='used'?'':x.st==='expired'?'до '+D.shortH(a.expires):(dl<=14?'ще '+dl+' '+plural3(dl,'день','дні','днів'):'до '+D.shortH(a.expires)))+'</small></div></button>'}).join('')+'</div>';
  }
  h+='</div>';view.innerHTML=h;var root=view.firstElementChild;
  var qi=root.querySelector('[data-q]');if(qi)qi.oninput=U.debounce(function(){App.setQ({q:qi.value.trim()},true);var n=$('[data-q]');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},250);
  on(root,{sell:function(){App.sellAbon()},newtype:function(){typeModal()},edtype:function(b){typeModal(b.dataset.id)},tab:function(b){App.setQ({t:b.dataset.t==='active'?'':b.dataset.t})},card:function(b){abonDrawer(b.dataset.id)}});
  if(params[0]&&db.abons.some(function(g){return g.id===params[0]})&&!App._mnAo){App._mnAo=1;abonDrawer(params[0]);setTimeout(function(){App._mnAo=0},500)}
}

function typeModal(id){
  var t=id?abType(id):null,svcs=App.db.services.filter(function(s){return s.active!==false}),sel=(t&&t.svc)||[];
  var cats=App.db.cats||[];
  UI.modal({title:t?'Тип абонемента':'Новий тип абонемента',size:'wide',
    body:'<div class="mn-sell"><div class="col-f g12">'+field('Назва','<input class="inp" name="n" value="'+esc(t?t.n:'')+'" placeholder="Напр. 5 манікюрів + гель-лак" autocomplete="off">')+
     '<div class="grid2">'+field('Кількість візитів',sufInp('qty',t?t.qty:5,'шт'))+field('Ціна пакета',sufInp('price',t?t.price:'','₴'))+'</div>'+
     '<div class="grid2">'+field('Діє, днів',sufInp('days',t?t.days:120,'дн'))+'<label class="check" style="align-self:end;min-height:40px"><input type="checkbox" name="on"'+(!t||t.on!==false?' checked':'')+'> Доступний для продажу</label></div>'+
     '<div class="note">'+I('info')+'<span data-per></span></div></div>'+
     '<div class="fld"><span>Для яких послуг <small data-cnt></small></span><div class="mn-svcpick" data-sv>'+svcs.map(function(s){return '<label class="check"><input type="checkbox" value="'+s.id+'"'+(sel.indexOf(s.id)>=0?' checked':'')+'> <span class="ell">'+esc(s.n)+'</span> <small class="mute num nw">'+fmt(s.price)+'</small></label>'}).join('')+'</div></div></div>',
    foot:(t?'<button class="btn dng" data-del>'+I('trash','s')+' Видалити</button>':'')+'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
    onMount:function(el,close){
      function upd(){var q=Math.max(1,Math.round(num(rd(el,'qty')))),p=num(rd(el,'price'));el.querySelector('[data-per]').innerHTML=p?'Один візит коштує клієнту <b>'+uah(Math.round(p/q))+'</b>. Виторг фіксується при продажу; використання візитів його не збільшує.':'Вкажіть ціну пакета — покажемо вартість одного візиту.';
        var c=$$('[data-sv] input:checked',el).length;el.querySelector('[data-cnt]').textContent=c?'обрано '+c:'порожньо = будь-які'}
      ['qty','price'].forEach(function(n){el.querySelector('[name='+n+']').oninput=upd});el.querySelector('[data-sv]').onchange=upd;upd();
      el.querySelector('[data-no]').onclick=close;
      var del=el.querySelector('[data-del]');if(del)del.onclick=function(){var used=App.db.abons.filter(function(a){return a.type===id}).length;close();UI.confirm({title:'Видалити тип «'+t.n+'»?',text:used?'Продані '+used+' абонем. залишаться в системі, але втратять назву типу.':'Тип буде видалено.',ok:'Видалити',danger:true}).then(function(y){if(!y)return;var old=O.deleteAbonType(id);UI.toast('Тип видалено',{undo:function(){App.db.abonTypes.push(old);App.save();rerender()}});rerender()})};
      el.querySelector('[data-ok]').onclick=function(){var n=rd(el,'n').trim();if(!n)return bad(el.querySelector('[name=n]'));var qty=Math.round(num(rd(el,'qty'))),pr=Math.round(num(rd(el,'price'))),dy=Math.round(num(rd(el,'days')));
        if(qty<1)return bad(el.querySelector('[name=qty]'));if(pr<=0)return bad(el.querySelector('[name=price]'));if(dy<1)return bad(el.querySelector('[name=days]'));
        O.saveAbonType({id:id||undefined,n:n,qty:qty,price:pr,days:dy,svc:$$('[data-sv] input:checked',el).map(function(i){return i.value}),on:el.querySelector('[name=on]').checked});close();UI.toast(t?'Збережено':'Тип додано');rerender()}}})}

App.sellAbon=function(o){o=o||{};
  var types=App.db.abonTypes.filter(function(t){return t.on!==false});
  if(!types.length){UI.toast('Спершу створіть тип абонемента',{type:'err'});if(App.cur&&App.cur.rt.id!=='abons')App.go('abons',{t:'types'});else typeModal();return}
  var client=o.client&&App.client(o.client)?o.client:null,tid=o.type&&types.some(function(t){return t.id===o.type})?o.type:types[0].id;
  UI.modal({title:'Продати абонемент',size:'wide',
    body:'<div class="mn-sell"><div class="col-f g16"><div class="fld"><span>Клієнт</span><div data-cl></div></div>'+
     '<div class="fld"><span>Абонемент</span><div class="col-f" data-types>'+types.map(function(t){return '<label class="mn-opt"><input type="radio" name="t" value="'+t.id+'"'+(t.id===tid?' checked':'')+'><span><b>'+esc(t.n)+' <span class="num">'+uah(t.price)+'</span></b><small>'+t.qty+' візит. · '+uah(Math.round(t.price/t.qty))+' за візит · діє '+t.days+' дн.</small></span></label>'}).join('')+'</div></div></div>'+
     '<div class="col-f g16">'+field('Сума до оплати',sufInp('price',(types.find(function(t){return t.id===tid})||types[0]).price,'₴'),'можна змінити для індивідуальної знижки')+field('Оплата','<select class="sel" name="method">'+payOpts('card')+'</select>')+soldByFld()+
     '<div class="note">'+I('info')+'<span data-info></span></div></div></div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Продати</button>',
    onMount:function(el,close){
      var bx=el.querySelector('[data-cl]');
      function drawCl(){if(client){var c=App.client(client);bx.innerHTML='<div class="mn-picked">'+UI.av(c,'sm')+'<b class="ell">'+esc(c.n)+'</b><span class="sp"></span><button type="button" class="icobtn sm ghost" data-clr aria-label="Змінити">'+I('x','s')+'</button></div>';bx.querySelector('[data-clr]').onclick=function(){client=null;drawCl()}}
        else{bx.innerHTML='<div data-cp></div>';UI.clientPicker(bx.firstChild,function(c){client=c.id;drawCl()})}}
      drawCl();
      function cur(){return types.find(function(t){return t.id===el.querySelector('[name=t]:checked').value})}
      function info(){var t=cur();el.querySelector('[data-info]').textContent='Гроші надходять зараз і йдуть у виторг при продажу. Кожен візит за абонементом оплачується на касі способом «Абонемент» — без руху грошей. До '+D.human(D.add(T(),t.days),{year:true})+'.'}
      info();
      $$('[name=t]',el).forEach(function(r){r.onchange=function(){el.querySelector('[name=price]').value=cur().price;info()}});
      el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){if(!client){UI.toast('Оберіть клієнта',{type:'err'});return}var pr=Math.round(num(rd(el,'price')));if(pr<=0)return bad(el.querySelector('[name=price]'));
        var ab=O.sellAbon({type:cur().id,client:client,price:pr,method:rd(el,'method')});if(ab){ab.soldBy=rd(el,'soldBy')||App.db.meId;App.save(true)}close();UI.toast('Абонемент продано: '+cname(client)+' · '+uah(pr),{undo:function(){O.deleteAbon(ab.id);rerender()}});
        if(App.cur&&(App.cur.rt.id==='abons'||App.cur.rt.id==='cash'))rerender();if(!o.silent)abonDrawer(ab.id)}}})};

function abonDrawer(id){
  var a0=App.db.abons.find(function(x){return x.id===id});if(!a0)return;
  function body(){var a=App.db.abons.find(function(x){return x.id===id}),st=abState(a),s=AST[st],t=abType(a.type),uses=abUses(a),mng=can('abons.*'),sale=App.db.payments.find(function(p){return p.abon===id&&p.kind==='abon_sale'});
    var h='<div class="mn-gd"><div class="mn-gcard '+(st==='active'?'':st)+'"><div class="mn-gcard-t"><span class="mn-code">'+esc(abName(a))+'</span><span class="badge '+s[1]+'">'+s[0]+'</span></div><div class="mn-gbal"><b class="num">'+a.left+' з '+a.qty+'</b><small>візитів залишилось</small></div><div class="bar-h mn-bb active"><i style="width:'+(a.qty?a.left/a.qty*100:0)+'%"></i></div><div class="mn-gcard-f"><span>діє до '+D.human(a.expires,{year:true})+'</span>'+(st==='frozen'?'<span>з '+D.shortH(a.frozenAt||T())+'</span>':'')+'</div></div>';
    if(mng)h+='<div class="mn-dw-act">'+(st==='frozen'?'<button class="btn pri" data-a="unfreeze">'+I('check')+' Розморозити</button>':(st==='active'?'<button class="btn" data-a="freeze">'+I('lock')+' Заморозити</button>':''))+'<button class="btn" data-a="ext">'+I('clock')+' Подовжити</button><button class="btn" data-a="adj">'+I('edit')+' Змінити залишок</button><button class="btn dng ghost" data-a="del">'+I('trash','s')+'</button></div>';
    h+='<div class="card mn-card"><dl class="dl"><dt>Клієнт</dt><dd><a class="link" href="#" data-a="client">'+esc(cname(a.client))+'</a></dd><dt>Послуги</dt><dd>'+esc(t?abSvc(t):'—')+'</dd><dt>Продано</dt><dd>'+D.human(a.sold,{year:true})+(sale?' · '+esc(mName(sale.method)):'')+'</dd><dt>Сплачено</dt><dd class="num">'+uah(a.price)+' · '+uah(abUnit(a))+' за візит</dd></dl></div>';
    var ev=uses.map(function(p){var ap=p.appt&&App.appt(p.appt);return {d:p.date,t:'Візит за абонементом',s:ap?App.apptTitle(ap):'',v:'−1',appt:p.appt}});
    (a.log||[]).forEach(function(l){ev.push({d:(l.ts||'').slice(0,10),t:{freeze:'Заморожено',unfreeze:'Розморожено',extend:'Подовжено',adjust:'Коригування залишку'}[l.type]||l.type,s:l.note||'',v:''})});
    var usedN=a.qty-a.left,known=uses.length+(a.log||[]).filter(function(l){return l.type==='adjust'}).length;
    ev.push({d:a.sold,t:'Продаж · '+a.qty+' візит.',s:uah(a.price),v:'+'+a.qty,z:1});
    if(usedN>uses.length&&!(a.log||[]).length)ev.push({d:a.sold,t:'Використано до початку обліку',s:'',v:'−'+(usedN-uses.length),z:2});
    ev.sort(function(x,y){return x.d<y.d?1:x.d>y.d?-1:(x.z||0)-(y.z||0)});
    h+='<div class="card flush mn-card"><div class="card-h"><b>Історія</b></div><div class="list">'+ev.map(function(e){return '<'+(e.appt?'button data-a="appt" data-id="'+e.appt+'"':'div')+' class="li"><div class="t"><b>'+esc(e.t)+'</b><small>'+D.human(e.d)+(e.s?' · '+esc(e.s):'')+'</small></div><span class="num">'+e.v+'</span></'+(e.appt?'button':'div')+'>'}).join('')+'</div></div></div>';
    return h}
  UI.drawer({title:esc(cname(a0.client)),sub:esc(abName(a0)),body:body(),
    onMount:function(el,close){var bodyEl=el.querySelector('.modal-b');function redraw(){bodyEl.innerHTML=body();rerender()}
      on(bodyEl,{
        client:function(){App.openClient(App.db.abons.find(function(x){return x.id===id}).client)},appt:function(b){App.openAppt(b.dataset.id)},
        freeze:function(){UI.confirm({title:'Заморозити абонемент?',text:'Візити за абонементом на паузі. Після розмороження термін дії подовжиться на кількість днів заморозки.',ok:'Заморозити',input:'Причина',placeholder:'Напр. відпустка'}).then(function(v){if(v===false||v==null)return;O.freezeAbon(id,typeof v==='string'?v:'');UI.toast('Заморожено');redraw()})},
        unfreeze:function(){var a=App.db.abons.find(function(x){return x.id===id});var days=Math.max(0,D.diff(a.frozenAt||T(),T()));O.unfreezeAbon(id);UI.toast('Розморожено · +'+days+' дн. до терміну');redraw()},
        ext:function(){abExtModal(id,redraw)},adj:function(){abAdjModal(id,redraw)},
        del:function(){UI.confirm({title:'Видалити абонемент?',text:'Запис про продаж теж зникне з каси. Використані візити в минулих оплатах залишаться.',ok:'Видалити',danger:true}).then(function(y){if(!y)return;var r=O.deleteAbon(id);close();UI.toast('Абонемент видалено',{undo:function(){O.restoreAbon(r);rerender()}});rerender()})}})}})}

function abExtModal(id,done){
  var a=App.db.abons.find(function(x){return x.id===id});
  UI.modal({title:'Подовжити абонемент',sub:'зараз до '+D.human(a.expires,{year:true}),size:'narrow',
    body:'<div class="col-f g12"><div class="chips">'+[[14,'+2 тиж.'],[30,'+1 міс.'],[60,'+2 міс.'],[90,'+3 міс.']].map(function(d){return '<button type="button" class="chip" data-add="'+d[0]+'">'+d[1]+'</button>'}).join('')+'</div>'+field('Днів',sufInp('days',30,'дн'))+field('Причина','<input class="inp" name="note" autocomplete="off" placeholder="необовʼязково">')+'</div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Подовжити</button>',
    onMount:function(el,close){$$('[data-add]',el).forEach(function(b){b.onclick=function(){el.querySelector('[name=days]').value=b.dataset.add}});el.querySelector('[data-no]').onclick=close;
      el.querySelector('[data-ok]').onclick=function(){var d=Math.round(num(rd(el,'days')));if(d<1||d>730)return bad(el.querySelector('[name=days]'));var old=a.expires,os=a.status;O.extendAbon(id,d,rd(el,'note').trim());close();UI.toast('Подовжено на '+d+' дн.',{undo:function(){var x=App.db.abons.find(function(z){return z.id===id});x.expires=old;x.status=os;x.log.pop();App.save();done&&done()}});done&&done()}}})}
function abAdjModal(id,done){
  var a=App.db.abons.find(function(x){return x.id===id});
  UI.modal({title:'Змінити залишок візитів',sub:'зараз '+a.left+' з '+a.qty,size:'narrow',
    body:'<div class="col-f g12">'+field('Новий залишок',sufInp('left',a.left,'шт'))+field('Причина <small>обовʼязково</small>','<input class="inp" name="note" autocomplete="off" placeholder="Напр. візит не внесено на касі">')+'</div>',
    foot:'<span class="sp"></span><button class="btn" data-no>Скасувати</button><button class="btn pri" data-ok>Зберегти</button>',
    onMount:function(el,close){el.querySelector('[data-no]').onclick=close;el.querySelector('[data-ok]').onclick=function(){var l=Math.round(num(rd(el,'left')));if(l<0||l>99||l===a.left)return bad(el.querySelector('[name=left]'));var n=rd(el,'note').trim();if(!n){UI.toast('Вкажіть причину',{type:'err'});return bad(el.querySelector('[name=note]'))}
      var snap=JSON.parse(JSON.stringify(a));O.adjustAbon(id,l-a.left,n);close();UI.toast('Залишок: '+l,{undo:function(){var x=App.db.abons.find(function(z){return z.id===id});Object.assign(x,snap);App.save();done&&done()}});done&&done()}}})}

/* ═════════ МАРШРУТИ ═════════ */
App.route('cash',{title:'Каса',icon:'wallet',nav:true,group:'money',order:10,perm:'cash.view',render:renderCash});
App.route('expenses',{title:'Витрати',icon:'receipt',nav:true,group:'money',order:11,perm:'expenses.view',permAlt:'expenses.add',count:function(){return pendingCount()},render:renderExpenses});
App.route('payroll',{title:'Зарплати',icon:'coins',nav:true,group:'money',order:12,perm:'payroll.view',permAlt:'payroll.own',render:renderPayroll});
App.route('certs',{title:'Сертифікати',icon:'gift',nav:true,group:'money',order:14,module:'certs',perm:'certs.view',permAlt:'certs.*',render:renderCerts});
App.route('abons',{title:'Абонементи',icon:'ticket',nav:true,group:'money',order:15,module:'abons',perm:'abons.view',permAlt:'abons.*',render:renderAbons});

})();
