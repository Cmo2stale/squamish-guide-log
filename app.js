/* Squamish Guide Log — everything is stored on this device (localStorage). No accounts, no server. */
(function(){
'use strict';
var APP_VERSION='2.0.0';
var GPS_ENABLED=false; /* set to true to bring back GPS location on trips */
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

/* ---------- storage ---------- */
var K_TRIPS='sgl_trips',K_SET='sgl_settings';
var storageOk=true;
function lsGet(k){try{return localStorage.getItem(k)}catch(e){storageOk=false;return null}}
function lsSet(k,v){try{localStorage.setItem(k,v);return true}catch(e){storageOk=false;return false}}
function loadJSON(k,d){try{var v=JSON.parse(lsGet(k)||'null');return v==null?d:v}catch(e){return d}}
var trips=loadJSON(K_TRIPS,[]);if(!Array.isArray(trips))trips=[];
var settings=Object.assign({guide:'',licence:'',gps:'auto',lastBackup:0,lastBc:2,fmt:'csv'},loadJSON(K_SET,{}));
function saveTrips(){var ok=lsSet(K_TRIPS,JSON.stringify(trips));if(!ok)toast('Could not save on this phone. Storage may be full or blocked.');return ok}
function saveSettings(){lsSet(K_SET,JSON.stringify(settings))}
function askPersist(){try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}}

/* ---------- reference data ---------- */
var RIVERS=[
  {id:'squamish',name:'Squamish River',short:'Squamish'},
  {id:'ashlu',name:'Ashlu River',short:'Ashlu'},
  {id:'mamquam',name:'Mamquam River',short:'Mamquam'},
  {id:'cheakamus',name:'Cheakamus River',short:'Cheakamus'},
  {id:'elaho',name:'Elaho River',short:'Elaho'}
];
var RIVER_IDS=RIVERS.map(function(r){return r.id});
function riverOf(id){return RIVERS.filter(function(r){return r.id===id})[0]||{id:id,name:id,short:id}}
var SPECIES=[
  {id:'bull',name:'Bull trout',g:'trout'},{id:'cutthroat',name:'Cutthroat trout',g:'trout'},
  {id:'rainbow',name:'Rainbow trout',g:'trout'},{id:'steelhead',name:'Steelhead',g:'trout'},
  {id:'chinook_h',name:'Chinook, hatchery',g:'salmon'},{id:'chinook_w',name:'Chinook, wild',g:'salmon'},
  {id:'chum',name:'Chum',g:'salmon'},{id:'coho_h',name:'Coho, hatchery',g:'salmon',keep:true},{id:'coho_w',name:'Coho, wild',g:'salmon'},
  {id:'pink',name:'Pink',g:'salmon',keep:true},{id:'sockeye',name:'Sockeye',g:'salmon'}
];
var GROUPS=[{id:'trout',name:'Trout and char'},{id:'salmon',name:'Salmon'}];
/* what a trip was fishing for; used for targeted CPUE so bycatch doesn't drag down rarely-targeted species */
var TARGETS=[
  {id:'trout',name:'Trout and char',sp:['bull','cutthroat','rainbow']},{id:'steelhead',name:'Steelhead',sp:['steelhead']},
  {id:'chinook',name:'Chinook',sp:['chinook_h','chinook_w']},{id:'chum',name:'Chum',sp:['chum']},
  {id:'coho',name:'Coho',sp:['coho_h','coho_w']},{id:'pink',name:'Pink',sp:['pink']},{id:'sockeye',name:'Sockeye',sp:['sockeye']}
];
var TARGET_IDS=TARGETS.map(function(x){return x.id});
function targetOf(spId){for(var i=0;i<TARGETS.length;i++){if(TARGETS[i].sp.indexOf(spId)>-1)return TARGETS[i].id}return null}
function targetName(id){for(var i=0;i<TARGETS.length;i++){if(TARGETS[i].id===id)return TARGETS[i].name}return id}
var LEGACY={chinook:'chinook_w',coho:'coho_w'}; /* trips logged before hatchery/wild split */
var SP_IDS=SPECIES.map(function(x){return x.id});
var KEEP_IDS=SPECIES.filter(function(x){return x.keep}).map(function(x){return x.id});
function canKeep(id){return KEEP_IDS.indexOf(id)>-1}
function legacy(o){if(!o)return o;var r={};Object.keys(o).forEach(function(k){var id=LEGACY[k]||k;r[id]=(r[id]||0)+num(o[k])});return r}
function spName(id){for(var i=0;i<SPECIES.length;i++){if(SPECIES[i].id===id)return SPECIES[i].name}return id}
var RES=[{id:'bc',name:'B.C. residents'},{id:'nr',name:'Non-residents'},{id:'nra',name:'Non-resident aliens'}];
var RES_IDS=['bc','nr','nra'];

/* ---------- dates ---------- */
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function todayStr(){return ymd(new Date())}
function fmtDate(s,withDow){var p=s.split('-').map(Number);var dt=new Date(p[0],p[1]-1,p[2]);var o={day:'numeric',month:'short'};if(withDow)o.weekday='short';if(p[0]!==new Date().getFullYear())o.year='numeric';return dt.toLocaleDateString('en-CA',o)}
function licenceStart(s){var y=+s.slice(0,4),m=+s.slice(5,7);return m>=4?y:y-1}
function lyLabel(y){return y+'–'+String(y+1).slice(2)}

/* ---------- model ---------- */
function num(x,d){var n=Number(x);return isFinite(n)?n:(d||0)}
function ints(o,ids){var r={};ids.forEach(function(id){var n=Math.max(0,Math.floor(num(o&&o[id])));if(n)r[id]=Math.min(n,500)});return r}
function sum(o){var n=0;Object.keys(o).forEach(function(k){n+=o[k]});return n}
function norm(t){
  var res=ints(t.res,RES_IDS),people=sum(res);
  if(!people){res={bc:1};people=1}
  var c=ints(legacy(t.c),SP_IDS),k=ints(legacy(t.k),KEEP_IDS);
  Object.keys(k).forEach(function(id){if(k[id]>(c[id]||0)){if(c[id])k[id]=c[id];else delete k[id]}});
  var g=t.gps&&isFinite(t.gps.lat)&&isFinite(t.gps.lon)?{lat:+t.gps.lat,lon:+t.gps.lon,acc:num(t.gps.acc),at:num(t.gps.at)}:null;
  return {id:String(t.id),date:typeof t.date==='string'?t.date:'',river:t.river,hours:num(t.hours),people:people,res:res,
    c:c,k:k,gps:g,tg:Array.isArray(t.tg)?TARGET_IDS.filter(function(id){return t.tg.indexOf(id)>-1}):[],
    createdAt:num(t.createdAt),updatedAt:num(t.updatedAt)};
}
function valid(t){return t&&t.id&&RIVER_IDS.indexOf(t.river)>-1&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)}
function all(){return trips.map(norm).filter(valid)}
function sorted(){return all().sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:b.createdAt-a.createdAt})}
function cnt(t,sp){return t.c[sp]||0}
function totalCaught(t){return sum(t.c)}
function ah(t){return t.hours*t.people}
function targeted(t,spId){return t.tg.indexOf(targetOf(spId))>-1}
function targetFish(t){var n=0;SP_IDS.forEach(function(id){if(targeted(t,id))n+=t.c[id]||0});return n}
function targetText(t){return t.tg.map(targetName).join(' + ')}
function fmtNum(n){return Number.isInteger(n)?String(n):n.toFixed(1)}
function r1(n){return fmtNum(Math.round(n*10)/10)}
function plural(n,w,p){return n+' '+(n===1?w:(p||w+'s'))}
function catchText(t){return SPECIES.filter(function(x){return t.c[x.id]}).map(function(x){return x.name+' '+t.c[x.id]+(t.k[x.id]?' ('+t.k[x.id]+' retained)':'')}).join(', ')}
function resText(t){var one={bc:'B.C. resident',nr:'non-resident',nra:'non-resident alien'};return RES.filter(function(x){return t.res[x.id]}).map(function(x){return t.res[x.id]+' '+one[x.id]+(t.res[x.id]===1?'':'s')}).join(', ')}
function gpsText(g){return g.lat.toFixed(5)+', '+g.lon.toFixed(5)+(g.acc?' (±'+Math.round(g.acc)+' m)':'')}

/* ---------- state ---------- */
var shown=20,openIds={},editingId=null,sel={},toastTimer=null,opener=null,lyear=null;
var currentDay=todayStr(),dateTouched=false,keptMode=false,formGps=null,gpsBusy=false,gpsWatch=null;
var deferredInstall=null,swWaiting=null;

/* ---------- render ---------- */
function render(){renderNotice();renderTrips();renderReport();renderSettings()}
function renderNotice(){
  var el=$('#notice'),html='',list=all();
  if(!storageOk)html='<p>This browser is blocking storage, so trips cannot be saved. Turn off private browsing, or open the app from your home screen.</p>';
  else if(swWaiting)html='<p>A new version of the app is ready.</p><button type="button" data-act="update">Update now</button>';
  else if(list.length>=5&&(!settings.lastBackup||Date.now()-settings.lastBackup>30*864e5))html='<p>'+(settings.lastBackup?'Your last backup was over a month ago.':'You haven\'t saved a backup yet.')+' Your trips live only on this phone.</p><button type="button" data-act="backup">Save a backup</button>';
  el.innerHTML=html;el.hidden=!html;
}
function detail(t){
  var rows=[];
  function add(k,v,raw){if(v!==undefined&&v!==null&&v!=='')rows.push('<div><dt>'+k+'</dt><dd>'+(raw?v:esc(v))+'</dd></div>')}
  add('People fishing',t.people+' ('+resText(t)+')');
  add('Hours fished',r1(t.hours)+' h · '+r1(ah(t))+' angler-hours');
  add('Target',targetText(t)||'Not recorded');
  add('Catch',catchText(t)||'No fish');
  if(GPS_ENABLED&&t.gps)add('Location',esc(gpsText(t.gps))+' · <a href="https://www.google.com/maps/search/?api=1&query='+t.gps.lat.toFixed(6)+','+t.gps.lon.toFixed(6)+'" target="_blank" rel="noopener">Map</a>',true);
  return '<div class="e-body"><dl>'+rows.join('')+'</dl><div class="e-actions"><button type="button" data-act="edit" data-id="'+esc(t.id)+'">Edit</button><button type="button" data-act="copy" data-id="'+esc(t.id)+'">Log another like this</button><button type="button" class="danger" data-act="del" data-id="'+esc(t.id)+'">Delete</button></div></div>';
}
function renderTrips(){
  var el=$('#entries'),list=sorted();
  $('#tr-sub').textContent=list.length?plural(list.length,'trip')+' on this phone':'';
  if(!list.length){el.innerHTML='<p class="empty" style="padding-top:14px">No trips yet. Tap “Log a trip” when you\'re off the water. A day with no fish counts too.</p>';$('#moreBtn').hidden=true;return}
  el.innerHTML=list.slice(0,shown).map(function(t){
    var any=totalCaught(t);
    var pill=any>0?'<span class="pill hit">'+plural(any,'fish','fish')+'</span>':'<span class="pill blank">No fish</span>';
    var bits=[riverOf(t.river).short];if(t.tg.length)bits.push('for '+targetText(t).toLowerCase());bits.push(plural(t.people,'person','people')+' · '+r1(t.hours)+' h');
    var sp=SPECIES.filter(function(x){return t.c[x.id]}).map(function(x){return x.name+' '+t.c[x.id]});
    if(sp.length)bits.push(sp.join(', '));
    return '<details class="entry" data-id="'+esc(t.id)+'"'+(openIds[t.id]?' open':'')+'><summary><div class="e-main"><div class="e-date">'+esc(fmtDate(t.date,true))+'</div><div class="e-sub">'+esc(bits.join(' · '))+'</div></div><div>'+pill+'</div></summary>'+detail(t)+'</details>';
  }).join('');
  $('#moreBtn').hidden=list.length<=shown;
}
function reportYears(){
  var set={};set[licenceStart(todayStr())]=1;
  all().forEach(function(t){set[licenceStart(t.date)]=1});
  return Object.keys(set).map(Number).sort(function(a,b){return b-a});
}
function reportTrips(){
  var a=lyear+'-04-01',b=(lyear+1)+'-03-31';
  return all().filter(function(t){return t.date>=a&&t.date<=b}).sort(function(x,y){return x.date<y.date?-1:x.date>y.date?1:x.createdAt-y.createdAt});
}
function renderReport(){
  var years=reportYears();
  if(lyear===null||years.indexOf(lyear)<0)lyear=years[0];
  var s=$('#lyear');
  if(s.getAttribute('data-built')!==years.join(',')){
    s.innerHTML=years.map(function(y){return '<option value="'+y+'">'+lyLabel(y)+' licence year</option>'}).join('');
    s.setAttribute('data-built',years.join(','));
  }
  s.value=String(lyear);
  var el=$('#report'),list=reportTrips();
  $('#exportBC').disabled=!list.length;$('#exportAll').disabled=!list.length;
  if(!list.length){el.innerHTML='<p class="empty">No trips in the '+lyLabel(lyear)+' licence year (April 1 '+lyear+' to March 31 '+(lyear+1)+').</p>';return}
  var days={},people=0,hrs=0,caught={},kept={},byR={},tAh={},tCaught={},inc={},byT={};
  list.forEach(function(t){
    days[t.date]=1;people+=t.people;hrs+=ah(t);
    var r=byR[t.river]||(byR[t.river]={n:0,ah:0,all:0});r.n++;r.ah+=ah(t);r.all+=totalCaught(t);
    t.tg.forEach(function(id){var x=byT[id]||(byT[id]={n:0,ah:0,fish:0});x.n++;x.ah+=ah(t)});
    SP_IDS.forEach(function(id){
      var c=t.c[id]||0;
      if(c)caught[id]=(caught[id]||0)+c;if(t.k[id])kept[id]=(kept[id]||0)+t.k[id];
      if(targeted(t,id)){tAh[id]=(tAh[id]||0)+ah(t);tCaught[id]=(tCaught[id]||0)+c;byT[targetOf(id)].fish+=c}
      else if(c)inc[id]=(inc[id]||0)+c;
    });
  });
  var sp=SPECIES.filter(function(x){return caught[x.id]||tAh[x.id]}).map(function(x){
    var kp=kept[x.id]||0;
    return '<tr><td>'+esc(x.name)+'</td><td>'+(caught[x.id]||0)+'</td><td>'+(x.keep?kp:'–')+'</td><td class="rate">'+(tAh[x.id]?(tCaught[x.id]/tAh[x.id]).toFixed(2):'–')+'</td><td>'+(inc[x.id]||0)+'</td></tr>';
  }).join('');
  var tr=TARGETS.filter(function(x){return byT[x.id]}).map(function(x){var v=byT[x.id];return '<tr><td>'+esc(x.name)+'</td><td>'+v.n+'</td><td>'+r1(v.ah)+'</td><td>'+v.fish+'</td><td class="rate">'+(v.ah?(v.fish/v.ah).toFixed(2):'–')+'</td></tr>'}).join('');
  var rv=RIVERS.filter(function(r){return byR[r.id]}).map(function(r){var x=byR[r.id];return '<tr><td>'+esc(r.short)+'</td><td>'+x.n+'</td><td>'+r1(x.ah)+'</td><td>'+x.all+'</td><td class="rate">'+(x.ah?(x.all/x.ah).toFixed(2):'–')+'</td></tr>'}).join('');
  el.innerHTML='<ul class="facts"><li><b>'+Object.keys(days).length+'</b> guided '+(Object.keys(days).length===1?'day':'days')+' · <b>'+list.length+'</b> '+(list.length===1?'group':'groups')+' · <b>'+people+'</b> anglers · <b>'+r1(hrs)+'</b> angler-hours</li></ul>'+
    (sp?'<div class="tablewrap"><table class="dt"><thead><tr><th>Species</th><th>Caught</th><th>Kept</th><th>Per hr*</th><th>Bycatch</th></tr></thead><tbody>'+sp+'</tbody></table></div>'+
      '<p class="legend"><b>*Per hr</b> is targeted catch per angler-hour. It counts only trips that were fishing for that species, so bycatch on other trips doesn\'t lower it. <b>Bycatch</b> is fish caught while targeting something else.</p>':'<p class="empty" style="margin-top:12px">No fish logged this licence year.</p>')+
    (tr?'<h3 class="subh">Effort by target</h3><div class="tablewrap"><table class="dt"><thead><tr><th>Target</th><th>Trips</th><th>Ang-hrs</th><th>Fish</th><th>Per hr</th></tr></thead><tbody>'+tr+'</tbody></table></div>':'')+
    '<h3 class="subh">By river</h3><div class="tablewrap"><table class="dt"><thead><tr><th>River</th><th>Trips</th><th>Ang-hrs</th><th>All fish</th><th>Per hr</th></tr></thead><tbody>'+rv+'</tbody></table></div>';
}
function renderSettings(){
  $$('#fmt button').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-v')===settings.fmt))});
  if(document.activeElement!==$('#s-guide'))$('#s-guide').value=settings.guide||'';
  if(document.activeElement!==$('#s-licence'))$('#s-licence').value=settings.licence||'';
  $$('#s-gps .chip').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-v')===settings.gps))});
  var lb=settings.lastBackup?'Last backup saved '+new Date(settings.lastBackup).toLocaleDateString('en-CA',{day:'numeric',month:'short',year:'numeric'})+'.':'No backup saved yet.';
  $('#bk-status').textContent=lb;
  $('#bk-sub').textContent=settings.guide||'';
  var standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
  var ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  $('#installHint').textContent=standalone?'Installed. Open it from your home screen, even with no signal.':
    (ios?'In Safari, tap the Share button, then “Add to Home Screen”. Open it from there and it works with no signal.':'Add this app to your home screen so it opens with no signal. In Chrome, use the menu, then “Add to Home screen” or “Install app”.');
  $('#installBtn').hidden=!deferredInstall||standalone;
  $('#version').textContent='Version '+APP_VERSION+' · trips are stored only on this device.';
}

/* ---------- toast ---------- */
function toast(msg){var el=$('#toast');el.textContent=msg;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.hidden=true},3600)}

/* ---------- form ---------- */
function stepperHtml(id,val,cls,min,max,label){
  return '<div class="stepper '+(cls||'')+'" data-min="'+min+'" data-max="'+max+'"><button type="button" data-step="-1" aria-label="One fewer '+esc(label)+'">−</button><input type="number" id="'+id+'" inputmode="numeric" min="'+min+'" max="'+max+'" step="1" value="'+val+'" aria-label="'+esc(label)+'"><button type="button" data-step="1" aria-label="One more '+esc(label)+'">+</button></div>';
}
function buildForm(){
  $('#f-rivers').innerHTML=RIVERS.map(function(r){return '<label><input type="radio" name="river" value="'+r.id+'"><span>'+esc(r.name)+'</span></label>'}).join('');
  $('#res-rows').innerHTML=RES.map(function(x){return '<div class="row"><span>'+esc(x.name)+'</span>'+stepperHtml('r-'+x.id,0,'sm',0,60,x.name)+'</div>'}).join('');
  $('#sp-grid').innerHTML=GROUPS.map(function(g){
    return '<div class="sp-group"><span>'+esc(g.name)+'</span></div>'+SPECIES.filter(function(x){return x.g===g.id}).map(function(x){
      return '<div class="row"><span>'+esc(x.name)+'</span>'+stepperHtml('c-'+x.id,0,'sm',0,500,x.name+' caught')+'</div>';
    }).join('');
  }).join('');
  $('#f-target').innerHTML=TARGETS.map(function(x){return '<button type="button" class="chip" data-v="'+x.id+'" aria-pressed="false">'+esc(x.name)+'</button>'}).join('');
  $('#kept-box').innerHTML=SPECIES.filter(function(x){return x.keep}).map(function(x){
    return '<div class="row"><span>'+esc(x.name)+' retained</span>'+stepperHtml('k-'+x.id,0,'sm',0,500,x.name+' retained')+'</div>';
  }).join('');
}
function setKeptMode(on){keptMode=on;$('#kept-box').hidden=!on;$('#keptToggle').setAttribute('aria-pressed',String(on))}
function find(id){return all().filter(function(x){return x.id===id})[0]||null}
function openSheet(id,copyFrom){
  var t=id?find(id):null,src=t||(copyFrom?find(copyFrom):null);
  editingId=t?t.id:null;
  $('#sheet-title').textContent=t?'Edit trip':'Log a trip';
  $('#saveBtn').textContent=t?'Save changes':'Save trip';
  $('#formMsg').textContent='';
  $('#f-date').max=todayStr();
  $('#f-date').value=t?t.date:todayStr();
  dateTouched=false;currentDay=todayStr();
  $$('input[name=river]').forEach(function(r){r.checked=!!src&&r.value===src.river});
  RES_IDS.forEach(function(k){$('#r-'+k).value=src?(src.res[k]||0):0});
  $('#f-hours').value=t?t.hours:'';
  $$('#f-target .chip').forEach(function(b){b.setAttribute('aria-pressed',String(!!src&&src.tg.indexOf(b.getAttribute('data-v'))>-1))});
  SP_IDS.forEach(function(k){$('#c-'+k).value=t?(t.c[k]||0):0});
  KEEP_IDS.forEach(function(k){$('#k-'+k).value=t?(t.k[k]||0):0});
  setKeptMode(!!t&&sum(t.k)>0);
  formGps=t?t.gps:null;stopGps();renderGps();
  updateReadout();
  opener=document.activeElement;
  $('#sheet').hidden=false;document.body.style.overflow='hidden';
  $('#sheet-title').focus();
  if(GPS_ENABLED&&!t&&settings.gps==='auto')getGps(true);
}
function closeSheet(){
  stopGps();
  $('#sheet').hidden=true;document.body.style.overflow='';editingId=null;
  if(opener&&opener.focus&&document.contains(opener)){try{opener.focus()}catch(e){}}
}
function newId(){
  try{if(window.crypto&&crypto.randomUUID)return 't'+crypto.randomUUID().replace(/-/g,'').slice(0,20)}catch(e){}
  return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
}
function val(id){return parseInt($('#'+id).value,10)||0}
function updateReadout(){
  var el=$('#readout');
  var h=parseFloat($('#f-hours').value),people=val('r-bc')+val('r-nr')+val('r-nra'),tot=0;
  SP_IDS.forEach(function(k){var n=val('c-'+k);tot+=n;var row=$('#c-'+k).closest('.row');row.classList.toggle('has',n>0)});
  if(!(h>0)||!(people>0)){el.textContent=people>0?'Enter hours fished to see catch per angler-hour.':'Add the people fishing to see catch per angler-hour.';return}
  var a=h*people;
  el.innerHTML=plural(people,'person','people')+' · <b>'+r1(a)+'</b> angler-hours<br>'+plural(tot,'fish','fish')+' · <b>'+(tot/a).toFixed(2)+'</b> per angler-hour';
}

/* ---------- GPS ---------- */
function renderGps(msg,isErr){
  var v=$('#gpsVal'),help=$('#gpsHelp');
  help.hidden=true;
  if(gpsBusy){v.textContent=msg||'Finding your location…';v.className='gps-val';$('#gpsBtn').textContent='Stop';$('#gpsClear').hidden=true;return}
  if(formGps){v.textContent=gpsText(formGps);v.className='gps-val ok';$('#gpsBtn').textContent='Update location';$('#gpsClear').hidden=false;return}
  v.textContent=msg||'No location yet';v.className='gps-val'+(isErr?' err':'');$('#gpsBtn').textContent=isErr?'Try again':'Use my location';$('#gpsClear').hidden=true;
  if(isErr==='denied'){help.innerHTML=gpsHelpHtml();help.hidden=false}
}
function gpsHelpHtml(){
  var ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(ios)return '<b>To allow location on iPhone:</b><ol><li>Open the <b>Settings</b> app, then <b>Privacy &amp; Security → Location Services</b>. Turn it on at the top.</li><li>On the same screen, scroll down to <b>Safari Websites</b> and choose <b>While Using the App</b> (or <b>Ask Next Time</b>).</li><li>Swipe this app closed completely, open it again from your home screen, and tap <b>Try again</b>.</li></ol>';
  return '<b>To allow location on Android:</b><ol><li>Swipe down from the top of the screen and make sure <b>Location</b> is on.</li><li>Open <b>Chrome → ⋮ → Settings → Site settings → Location</b>. If <b>cmo2stale.github.io</b> is under Blocked, tap it and choose <b>Allow</b>.</li><li>Close this app completely, open it again, and tap <b>Try again</b>.</li></ol>';
}
function stopGps(){
  if(gpsWatch!==null){try{navigator.geolocation.clearWatch(gpsWatch)}catch(e){}gpsWatch=null}
  clearTimeout(stopGps.t);gpsBusy=false;
}
function getGps(auto){
  if(!('geolocation' in navigator)){renderGps('This phone or browser does not offer location.',true);return}
  stopGps();gpsBusy=true;renderGps();
  var best=null,started=Date.now();
  function finish(msg,kind){stopGps();if(best){formGps=best}renderGps(best?null:msg,best?false:(kind||true));if(!best&&!auto&&kind==='denied')toast('Location is blocked on this phone. See the steps under Location.')}
  try{
    gpsWatch=navigator.geolocation.watchPosition(function(p){
      var g={lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy||0,at:p.timestamp||Date.now()};
      if(!best||g.acc<best.acc){best=g;formGps=g}
      renderGps('Got ±'+Math.round(best.acc)+' m, refining…');
      if(best.acc<=25)finish();
    },function(err){
      if(err.code===1){finish('Location is blocked for this app on your phone.','denied')}
      else if(!best&&Date.now()-started>55000)finish('Could not get a GPS fix. Try again in a more open spot.');
    },{enableHighAccuracy:true,maximumAge:0,timeout:60000});
    stopGps.t=setTimeout(function(){finish(best?null:'Could not get a GPS fix. Try again in a more open spot.')},60000);
  }catch(e){finish('Location is not available here.')}
}

/* ---------- save ---------- */
function fail(msg,selector){$('#formMsg').textContent=msg;var el=selector&&$(selector);if(el&&el.focus)el.focus();return null}
function readForm(){
  var date=$('#f-date').value,rv=$('input[name=river]:checked'),hours=parseFloat($('#f-hours').value);
  var res={};RES_IDS.forEach(function(k){var n=val('r-'+k);if(n>0)res[k]=n});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return fail('Pick the date of the trip.','#f-date');
  if(date>todayStr())return fail('That date is in the future.','#f-date');
  if(!rv)return fail('Pick the waterbody.','#f-rivers input');
  if(!(sum(res)>=1))return fail('Add at least one person fishing.','#r-bc');
  if(!(hours>0&&hours<=24))return fail('Enter the hours fished, up to 24.','#f-hours');
  var tg=$$('#f-target .chip[aria-pressed="true"]').map(function(b){return b.getAttribute('data-v')});
  if(!tg.length)return fail('Pick what the group was targeting.','#f-target .chip');
  var c={},k={};
  for(var i=0;i<SP_IDS.length;i++){
    var id=SP_IDS[i],n=val('c-'+id),kp=keptMode&&canKeep(id)?val('k-'+id):0;
    if(kp>n)return fail('Retained cannot be more than caught for '+spName(id).toLowerCase()+'.','#k-'+id);
    if(n>0)c[id]=n;if(kp>0)k[id]=kp;
  }
  var t={id:editingId||newId(),date:date,river:rv.value,hours:hours,res:res,tg:tg,c:c,v:1};
  if(Object.keys(k).length)t.k=k;
  if(GPS_ENABLED&&formGps)t.gps=formGps;
  else if(editingId){var prev=trips.filter(function(x){return x.id===editingId})[0];if(prev&&prev.gps)t.gps=prev.gps}
  return t;
}
function onSubmit(e){
  e.preventDefault();
  if(gpsBusy)stopGps();
  var t=readForm();if(!t)return;
  var old=editingId?trips.filter(function(x){return x.id===editingId})[0]:null;
  t.createdAt=old&&old.createdAt?old.createdAt:Date.now();
  t.updatedAt=Date.now();
  trips=trips.filter(function(x){return x.id!==t.id});trips.push(t);
  if(!saveTrips())return;
  settings.lastBc=t.res.bc||0;saveSettings();askPersist();
  lyear=licenceStart(t.date);
  closeSheet();render();
  toast(old?'Changes saved.':'Trip saved on this phone.');
}
function removeTrip(id){trips=trips.filter(function(x){return x.id!==id});saveTrips();delete openIds[id];render();toast('Trip deleted.')}

/* ---------- files ---------- */
function csvCell(v){var s=String(v==null?'':v);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function toCsv(rows){return '﻿'+rows.map(function(r){return r.map(csvCell).join(',')}).join('\r\n')}
function slug(s){return (s||'guide').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'guide'}
async function deliver(filename,text,mime){
  var blob=new Blob([text],{type:mime});
  var touch=window.matchMedia&&matchMedia('(pointer:coarse)').matches;
  if(touch&&navigator.canShare&&typeof File==='function'){
    try{
      var file=new File([blob],filename,{type:mime});
      if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:filename});return true}
    }catch(e){if(e&&e.name==='AbortError')return false}
  }
  var url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;a.rel='noopener';document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(url);a.remove()},4000);
  return true;
}
function cpue(fish,anglerHours){return anglerHours>0?Math.round(1000*fish/anglerHours)/1000:''}
function r2(n){return Math.round(n*100)/100}
/* columns: {h:header, v:value(trip), add:true to sum in the totals row, tot:function(list) for a computed total} */
function sumOver(list,f){var n=0;list.forEach(function(t){n+=f(t)});return n}
function fishCols(){
  var cols=[];
  SPECIES.forEach(function(x){
    cols.push({h:x.name,v:function(t){return (t.c[x.id]||0)-(t.k[x.id]||0)},add:true});
    if(x.keep)cols.push({h:x.name+' retained',v:function(t){return t.k[x.id]||0},add:true});
  });
  var tl=function(l){return l.filter(function(t){return t.tg.length})};
  return cols.concat([
    {h:'Total fish',v:totalCaught,add:true},
    {h:'CPUE, all fish (per angler-hour)',v:function(t){return cpue(totalCaught(t),ah(t))},tot:function(l){return cpue(sumOver(l,totalCaught),sumOver(l,ah))}},
    {h:'Target fish',v:targetFish,add:true},
    {h:'Target CPUE (per angler-hour)',v:function(t){return t.tg.length?cpue(targetFish(t),ah(t)):''},tot:function(l){return cpue(sumOver(tl(l),targetFish),sumOver(tl(l),ah))}}
  ]);
}
function buildTable(list,cols){
  var rows=[cols.map(function(c){return c.h})];
  list.forEach(function(t){rows.push(cols.map(function(c){return c.v(t)}))});
  if(list.length){
    var tot=cols.map(function(c){return c.tot?c.tot(list):(c.add?r2(sumOver(list,function(t){return +c.v(t)||0})):'')});
    tot[0]='Total';tot[1]=plural(list.length,'trip');rows.push(tot);
  }
  return rows;
}
function bcRows(list){
  return buildTable(list,[
    {h:'Date (yyyy-mm-dd)',v:function(t){return t.date}},{h:'Waterbody',v:function(t){return riverOf(t.river).name}},
    {h:'B.C. residents',v:function(t){return t.res.bc||0},add:true},{h:'Non-residents',v:function(t){return t.res.nr||0},add:true},
    {h:'Non-resident aliens',v:function(t){return t.res.nra||0},add:true},
    {h:'Hours fished',v:function(t){return t.hours},add:true},{h:'Angler-hours',v:function(t){return r2(ah(t))},add:true},
    {h:'Target species',v:targetText}
  ].concat(fishCols()));
}
var XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function sendTable(base,sheet,rows){
  var season=lyear+'-'+String(lyear+1).slice(2);
  if(settings.fmt==='xlsx'&&window.makeXlsx){
    var bytes;try{bytes=window.makeXlsx(rows,sheet+' '+season)}catch(e){toast('Could not make the Excel file. Try CSV instead.');return}
    deliver(base+'-'+season+'.xlsx',bytes,XLSX_MIME);
  }else deliver(base+'-'+season+'.csv',toCsv(rows),'text/csv');
}
function exportBC(){
  var list=reportTrips();if(!list.length)return;
  sendTable('bc-guide-report-'+slug(settings.guide),'BC report',bcRows(list));
}
function allRows(list){
  var g=function(f){return function(t){return t.gps?f(t.gps):''}};
  return buildTable(list,[
    {h:'Date',v:function(t){return t.date}},{h:'River',v:function(t){return riverOf(t.river).name}}
  ].concat(GPS_ENABLED?[{h:'Latitude',v:g(function(p){return p.lat.toFixed(6)})},{h:'Longitude',v:g(function(p){return p.lon.toFixed(6)})},{h:'GPS accuracy (m)',v:g(function(p){return p.acc?Math.round(p.acc):''})}]:[]).concat([
    {h:'Hours fished',v:function(t){return t.hours},add:true},{h:'People fishing',v:function(t){return t.people},add:true},
    {h:'B.C. residents',v:function(t){return t.res.bc||0},add:true},{h:'Non-residents',v:function(t){return t.res.nr||0},add:true},
    {h:'Non-resident aliens',v:function(t){return t.res.nra||0},add:true},{h:'Angler-hours',v:function(t){return r2(ah(t))},add:true},
    {h:'Target species',v:targetText}
  ]).concat(fishCols()).concat([{h:'Guide',v:function(){return settings.guide}},{h:'Guide licence',v:function(){return settings.licence}}]));
}
function exportAll(){
  var list=reportTrips();if(!list.length)return;
  sendTable('guide-log-trips-'+slug(settings.guide),'Trips',allRows(list));
}
async function backup(){
  var data={app:'squamish-guide-log',format:1,exportedAt:new Date().toISOString(),settings:{guide:settings.guide,licence:settings.licence},trips:trips};
  var ok=await deliver('guide-log-backup-'+slug(settings.guide)+'-'+todayStr()+'.json',JSON.stringify(data,null,1),'application/json');
  if(ok){settings.lastBackup=Date.now();saveSettings();render();toast('Backup file made. Keep it somewhere safe.')}
}
function mergeBackup(data){
  if(!data||data.app!=='squamish-guide-log'||!Array.isArray(data.trips))throw new Error('not ours');
  var byId={},added=0,updated=0;
  trips.forEach(function(t){byId[t.id]=t});
  data.trips.forEach(function(t){
    if(!t||!t.id||!valid(norm(t)))return;
    var cur=byId[t.id];
    if(!cur){byId[t.id]=t;added++}
    else if(num(t.updatedAt)>num(cur.updatedAt)){byId[t.id]=t;updated++}
  });
  trips=Object.keys(byId).map(function(k){return byId[k]});
  if(data.settings){if(!settings.guide&&data.settings.guide)settings.guide=data.settings.guide;if(!settings.licence&&data.settings.licence)settings.licence=data.settings.licence}
  return {added:added,updated:updated};
}
function restoreFile(file){
  var r=new FileReader();
  r.onload=function(){
    try{
      var res=mergeBackup(JSON.parse(r.result));
      saveTrips();saveSettings();render();
      toast(res.added||res.updated?'Restored: '+plural(res.added,'new trip')+(res.updated?', '+res.updated+' updated':'')+'.':'Nothing new in that backup. Your trips are unchanged.');
    }catch(e){toast('That file is not a Guide Log backup.')}
  };
  r.onerror=function(){toast('Could not read that file.')};
  r.readAsText(file);
}

/* ---------- clock ---------- */
function updateToday(){$('#today').textContent=new Date().toLocaleDateString('en-CA',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
function tick(){
  var t=todayStr();
  if(t!==currentDay){
    currentDay=t;$('#f-date').max=t;
    if(!$('#sheet').hidden&&!editingId&&!dateTouched){$('#f-date').value=t;toast('Date moved on to today.')}
    render();
  }
  updateToday();
}

/* ---------- events ---------- */
function bind(){
  $('#openLog').addEventListener('click',function(){openSheet(null)});
  $('#closeSheet').addEventListener('click',closeSheet);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('#sheet').hidden)closeSheet()});
  $('#tripForm').addEventListener('submit',onSubmit);
  $('#moreBtn').addEventListener('click',function(){shown+=20;renderTrips()});
  $('#lyear').addEventListener('change',function(e){lyear=parseInt(e.target.value,10);renderReport()});
  $('#fmt').addEventListener('click',function(e){var b=e.target.closest('button[data-v]');if(!b)return;settings.fmt=b.getAttribute('data-v');saveSettings();renderSettings()});
  $('#exportBC').addEventListener('click',exportBC);
  $('#exportAll').addEventListener('click',exportAll);
  $('#backupBtn').addEventListener('click',backup);
  $('#restoreBtn').addEventListener('click',function(){$('#restoreFile').click()});
  $('#restoreFile').addEventListener('change',function(e){var f=e.target.files&&e.target.files[0];if(f)restoreFile(f);e.target.value=''});
  $('#s-guide').addEventListener('input',function(e){settings.guide=e.target.value.trim();saveSettings();$('#bk-sub').textContent=settings.guide});
  $('#s-licence').addEventListener('input',function(e){settings.licence=e.target.value.trim();saveSettings()});
  $('#s-gps').addEventListener('click',function(e){var b=e.target.closest('.chip');if(!b)return;settings.gps=b.getAttribute('data-v');saveSettings();renderSettings()});
  if($('#updateBtn'))$('#updateBtn').addEventListener('click',checkForUpdate);
  $('#installBtn').addEventListener('click',async function(){if(!deferredInstall)return;deferredInstall.prompt();try{await deferredInstall.userChoice}catch(e){}deferredInstall=null;renderSettings()});
  $('#notice').addEventListener('click',function(e){
    var b=e.target.closest('button[data-act]');if(!b)return;
    if(b.getAttribute('data-act')==='backup')backup();
    if(b.getAttribute('data-act')==='update'&&swWaiting)swWaiting.postMessage('skipWaiting');
  });
  $('#gpsBtn').addEventListener('click',function(){if(gpsBusy){stopGps();renderGps()}else getGps(false)});
  $('#gpsClear').addEventListener('click',function(){formGps=null;renderGps()});
  $('#f-date').addEventListener('input',function(){dateTouched=true});
  $('#f-date').addEventListener('change',function(){dateTouched=true});
  $('#tripForm').addEventListener('input',updateReadout);
  $('#keptToggle').addEventListener('click',function(){setKeptMode(!keptMode)});
  $('#f-target').addEventListener('click',function(e){var b=e.target.closest('.chip');if(!b)return;b.setAttribute('aria-pressed',String(b.getAttribute('aria-pressed')!=='true'));$('#formMsg').textContent=''});
  $('#tripForm').addEventListener('click',function(e){
    var st=e.target.closest('.stepper button');
    if(st){
      var box=st.closest('.stepper'),inp=$('input',box),min=+box.getAttribute('data-min'),max=+box.getAttribute('data-max');
      var v=parseInt(inp.value,10);if(isNaN(v))v=min-(+st.getAttribute('data-step')>0?1:0);
      inp.value=Math.min(max,Math.max(min,v+parseInt(st.getAttribute('data-step'),10)));updateReadout();return;
    }
  });
  $('#entries').addEventListener('toggle',function(e){var d=e.target;if(d.classList&&d.classList.contains('entry')){var id=d.getAttribute('data-id');if(d.open)openIds[id]=1;else delete openIds[id]}},true);
  $('#entries').addEventListener('click',function(e){
    var b=e.target.closest('button[data-act]');if(!b)return;
    var id=b.getAttribute('data-id'),act=b.getAttribute('data-act');
    if(act==='edit'){openSheet(id);return}
    if(act==='copy'){openSheet(null,id);return}
    if(act==='del'){
      if(b.classList.contains('sure')){removeTrip(id);return}
      b.classList.add('sure');b.textContent='Yes, delete this trip';
      setTimeout(function(){if(document.contains(b)){b.classList.remove('sure');b.textContent='Delete'}},5000);
    }
  });
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredInstall=e;renderSettings()});
  window.addEventListener('storage',function(e){if(e.key===K_TRIPS||e.key===K_SET){trips=loadJSON(K_TRIPS,[]);settings=Object.assign(settings,loadJSON(K_SET,{}));render()}});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')tick()});
  setInterval(tick,20000);
}

/* ---------- service worker ---------- */
function registerSW(){
  if(!('serviceWorker' in navigator))return;
  var reloading=false,hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',function(){if(reloading||!hadController)return;reloading=true;location.reload()});
  navigator.serviceWorker.register('sw.js').then(function(reg){
    function watch(w){w.addEventListener('statechange',function(){if(w.state==='installed'&&navigator.serviceWorker.controller){swWaiting=w;renderNotice()}})}
    if(reg.waiting&&navigator.serviceWorker.controller){swWaiting=reg.waiting;renderNotice()}
    if(reg.installing)watch(reg.installing);
    reg.addEventListener('updatefound',function(){if(reg.installing)watch(reg.installing)});
    swReg=reg;
    /* phones often resume the app instead of relaunching it, so check for a new version whenever it comes back to the screen */
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&navigator.onLine!==false){try{reg.update()}catch(e){}}});
    setInterval(function(){if(navigator.onLine!==false){try{reg.update()}catch(e){}}},30*60*1000);
  }).catch(function(){});
}
var swReg=null;
async function checkForUpdate(){
  var btn=$('#updateBtn');
  if(navigator.onLine===false){toast('No signal. Check for updates when you\'re back in service.');return}
  if(!swReg){location.reload();return}
  btn.disabled=true;btn.textContent='Checking…';
  try{await swReg.update()}catch(e){}
  await new Promise(function(r){setTimeout(r,1500)});
  btn.disabled=false;btn.textContent='Check for updates';
  var w=swReg.waiting||swReg.installing;
  if(w){toast('Updating…');if(swReg.waiting)swReg.waiting.postMessage('skipWaiting');else w.addEventListener('statechange',function(){if(w.state==='installed')w.postMessage('skipWaiting')})}
  else toast('You have the latest version ('+APP_VERSION+').');
}

/* ---------- start ---------- */
buildForm();bind();updateToday();
if(!GPS_ENABLED){$('#gpsField').hidden=true;$('#gpsSetting').hidden=true}
render();registerSW();
window.__sgl={mergeBackup:mergeBackup,bcRows:bcRows,allRows:allRows,all:all,licenceStart:licenceStart};
})();
