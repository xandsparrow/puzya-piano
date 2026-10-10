const tg=window.Telegram&&Telegram.WebApp;try{tg.ready();tg.expand();tg.setHeaderColor&&tg.setHeaderColor('secondary_bg_color')}catch(e){}
const $=id=>document.getElementById(id);
const NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const midi=n=>{const m=/^([A-G]#?)(\d)$/.exec(n);return NAMES.indexOf(m[1])+12*(+m[2]+1)};
const LO=60,HI=84,COLORS=['#ff5fa2','#ffb547','#5eb5f7','#7ee787','#c084fc'];
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('s');clearTimeout(toast.h);toast.h=setTimeout(()=>e.classList.remove('s'),2600)}
// ---- melody loading
function b64json(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0))))}
async function loadMelody(){
  const q=new URLSearchParams(location.search);
  const p=(tg&&tg.initDataUnsafe&&tg.initDataUnsafe.start_param)||q.get('tgWebAppStartParam')||q.get('startapp')||q.get('m');
  if(p){try{return b64json(p)}catch(e){}
    if(/^[\w-]{1,40}$/.test(p)){try{const r=await fetch('melodies/'+p+'.json');if(r.ok)return await r.json()}catch(e){}}
    toast('Не удалось загрузить мелодию, играю демо')}
  return DEMO}
// ---- audio
let ac,master;
function audio(){if(!ac){ac=new (window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.gain.value=.5;master.connect(ac.destination)}
  if(ac.state!=='running')ac.resume();return ac}
document.addEventListener('pointerdown',()=>{const a=audio();const b=a.createBuffer(1,1,22050),s=a.createBufferSource();s.buffer=b;s.connect(a.destination);s.start()},{once:true,capture:true});
let timbre='piano';
function tone(m,dur,vel=1,when=0){
  const a=audio(),t=Math.max(a.currentTime,when||a.currentTime),f=440*2**((m-69)/12),g=a.createGain();g.connect(master);
  const v=.6*vel,o=a.createOscillator();
  if(timbre==='piano'){o.type='triangle';const o2=a.createOscillator();o2.type='sine';o2.frequency.value=f*2;const g2=a.createGain();g2.gain.value=.3;o2.connect(g2).connect(g);o2.start(t);o2.stop(t+dur+1.2);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.005);g.gain.exponentialRampToValueAtTime(v*.25,t+Math.min(dur,1));g.gain.exponentialRampToValueAtTime(.0001,t+dur+1)}
  else if(timbre==='synth'){o.type='sawtooth';const fl=a.createBiquadFilter();fl.frequency.setValueAtTime(3000,t);fl.frequency.exponentialRampToValueAtTime(600,t+dur);o.connect(fl).connect(g);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v*.5,t+.03);g.gain.setValueAtTime(v*.4,t+dur);g.gain.exponentialRampToValueAtTime(.0001,t+dur+.4)}
  else{o.type='square';g.gain.setValueAtTime(v*.3,t);g.gain.setValueAtTime(v*.3,t+dur);g.gain.linearRampToValueAtTime(0,t+dur+.03)}
  o.frequency.value=f;if(timbre!=='synth')o.connect(g);o.start(t);o.stop(t+dur+1.3)}
// ---- keyboard
const kbd=$('kbd'),keys={};
function buildKeys(){kbd.innerHTML='';const whites=[];for(let m=LO;m<=HI;m++)if(!NAMES[m%12].includes('#'))whites.push(m);
  const W=kbd.clientWidth/whites.length;
  for(let m=LO;m<=HI;m++){const e=document.createElement('div'),n=NAMES[m%12]+(Math.floor(m/12)-1);
    if(n.includes('#')){const i=whites.filter(x=>x<m).length;e.className='b';e.style.left=(i*W-W*.32)+'px';e.style.width=W*.64+'px';e.dataset.x=i*W}
    else{const i=whites.indexOf(m);e.className='w';e.style.left=i*W+'px';e.style.width=W+'px';e.innerHTML='<span>'+n+'</span>';e.dataset.x=i*W+W/2}
    e.dataset.m=m;kbd.appendChild(e);keys[m]=e}
  const lane=$('lane');lane.querySelectorAll('.g').forEach(x=>x.remove());whites.forEach((_,i)=>{const g=document.createElement('div');g.className='g';g.style.left=i*W+'px';lane.appendChild(g)});keyW=W}
let keyW=26;const down=new Map();
function pressUser(m){keys[m]&&keys[m].classList.add('on');tone(m,.6);if(recording)recNotes.push({m,t0:performance.now()});onUserNote(m)}
function releaseUser(m){keys[m]&&keys[m].classList.remove('on');if(recording){const r=[...recNotes].reverse().find(x=>x.m===m&&!x.t1);if(r)r.t1=performance.now()}}
const keyAt=(x,y)=>{const el=document.elementFromPoint(x,y);return el&&el.closest&&el.closest('.kbd>div')};
kbd.addEventListener('pointerdown',e=>{e.preventDefault();const k=keyAt(e.clientX,e.clientY);if(!k)return;down.set(e.pointerId,+k.dataset.m);pressUser(+k.dataset.m)});
kbd.addEventListener('pointermove',e=>{if(!down.has(e.pointerId))return;const k=keyAt(e.clientX,e.clientY);const m=k?+k.dataset.m:null,o=down.get(e.pointerId);if(m!==o){releaseUser(o);if(m!=null){down.set(e.pointerId,m);pressUser(m)}else down.delete(e.pointerId)}});
const up=e=>{if(down.has(e.pointerId)){releaseUser(down.get(e.pointerId));down.delete(e.pointerId)}};
['pointerup','pointercancel','pointerleave'].forEach(t=>kbd.addEventListener(t,up));
// ---- player
let song,notes=[],mode='listen',playing=false,pos=0,lastT=0,tempo=1,waiting=null,scheduled=new Set();
const spb=()=>60/song.bpm/(mode==='learn'?Math.min(tempo,.6):tempo);
const total=()=>Math.max(...notes.map(n=>n.t+n.d));
const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
function setSong(s){song=s;notes=s.notes.map((n,i)=>({...n,m:midi(n.note),i,mel:!(n.v<1)})).filter(n=>n.m>=LO&&n.m<=HI);
  $('title').textContent=s.title||'Мелодия';$('meta').textContent='🐶 Пузя · '+s.bpm+' BPM';pos=0;updUI()}
function updUI(){const T=total();$('progi').style.width=(pos/T*100)+'%';$('cur').textContent=fmt(pos*60/song.bpm/tempo);$('dur').textContent=fmt(T*60/song.bpm/tempo);$('play').textContent=playing?'⏸':'▶'}
function setPlaying(p){playing=p;if(p){audio();if(pos>=total())pos=0;scheduled.clear();lastT=performance.now()}else{waiting=null;clearHints()}updUI()}
$('play').onclick=()=>{if(mode==='free'){toast('В режиме «Свободно» играй сам 🙂');return}setPlaying(!playing)};
$('prog').onpointerdown=e=>{const r=e.currentTarget.getBoundingClientRect();pos=(e.clientX-r.left)/r.width*total();scheduled.clear();waiting=null;clearHints();updUI()};
$('tempo').oninput=e=>{tempo=e.target.value/100;$('tv').textContent=e.target.value+'%';updUI()};
function seg(id,cb){$(id).onclick=e=>{const d=e.target.closest('[data-v]');if(!d)return;[...$(id).children].forEach(c=>c.classList.toggle('a',c===d));cb(d.dataset.v)}}
seg('timbre',v=>{timbre=v;tone(72,.3)});
seg('mode',v=>{mode=v;setPlaying(false);pos=0;clearAuto();updUI();if(v==='learn')toast('Нажимай подсвеченные клавиши — я подожду 🐾')});
const autoOn=new Set();function clearAuto(){autoOn.forEach(m=>keys[m].classList.remove('on'));autoOn.clear()}
function clearHints(){Object.values(keys).forEach(k=>k.classList.remove('hint'))}
function onUserNote(m){if(waiting&&waiting.has(m)){waiting.delete(m);keys[m].classList.remove('hint');if(!waiting.size){waiting=null;lastT=performance.now()}}}
const lane=$('lane');const LOOK=4;
function frame(now){
  if(playing&&!waiting){pos+=(now-lastT)/1000/spb()}lastT=now;
  if(playing){
    if(mode==='learn'&&!waiting){const due=notes.filter(n=>n.mel&&!scheduled.has(n.i)&&n.t<=pos);if(due.length){pos=due[0].t;waiting=new Set();notes.filter(n=>n.mel&&Math.abs(n.t-pos)<1e-6).forEach(n=>{scheduled.add(n.i);waiting.add(n.m);keys[n.m].classList.add('hint')})}
      notes.filter(n=>!n.mel&&!scheduled.has(n.i)&&n.t<=pos).forEach(n=>{scheduled.add(n.i);tone(n.m,n.d*spb(),.35)})}
    if(mode==='listen'){notes.filter(n=>!scheduled.has(n.i)&&n.t<=pos).forEach(n=>{scheduled.add(n.i);if(pos-n.t<.25)tone(n.m,n.d*spb(),n.v??1)})}
    if(pos>=total()){setPlaying(false);pos=total();toast(mode==='learn'?'Браво! 🎉 Мелодия выучена':'Конец 🎶')}
  }
  // highlight & lane
  if(mode==='listen'){const act=new Set(notes.filter(n=>n.t<=pos&&pos<n.t+n.d&&playing).map(n=>n.m));
    autoOn.forEach(m=>{if(!act.has(m)){keys[m].classList.remove('on');autoOn.delete(m)}});act.forEach(m=>{keys[m].classList.add('on');autoOn.add(m)})}
  const H=lane.clientHeight,px=H/LOOK;let html='';
  if(mode!=='free')for(const n of notes){if(n.t+n.d<pos||n.t>pos+LOOK)continue;const k=keys[n.m],bk=k.classList.contains('b'),w=bk?keyW*.55:keyW-6,
    x=(+k.dataset.x)-w/2,bot=(n.t-pos)*px,h=n.d*px,c=COLORS[n.m%5];
    html+='<div class=bar style="left:'+x+'px;width:'+w+'px;bottom:'+bot+'px;height:'+h+'px;background:'+c+';box-shadow:0 0 10px '+c+(n.mel?'':';opacity:.35')+'"></div>'}
  let bars=lane.querySelector('.bars');if(!bars){bars=document.createElement('div');bars.className='bars';lane.appendChild(bars)}bars.innerHTML=html;
  if(playing)updUI();requestAnimationFrame(frame)}
// ---- record / send
let recording=false,recNotes=[],recStart=0,lastRec=null;
$('rec').onclick=()=>{recording=!recording;$('rec').classList.toggle('recon',recording);
  if(recording){recNotes=[];recStart=performance.now();$('rec').textContent='⏹ Стоп';toast('Запись пошла 🎙')}
  else{$('rec').textContent='⏺ Запись';const bpm=100,b=60000/bpm;
    lastRec={title:'Моя мелодия',bpm,notes:recNotes.map(r=>({note:NAMES[r.m%12]+(Math.floor(r.m/12)-1),t:+((r.t0-recStart)/b).toFixed(2),d:+(Math.max(.1,((r.t1||performance.now())-r.t0)/b)).toFixed(2)}))};
    if(lastRec.notes.length){toast('Записано нот: '+lastRec.notes.length+' — можно слушать');setSong(lastRec)}else toast('Пусто — ничего не сыграно')}};
$('send').onclick=async()=>{const d=lastRec||song,s=JSON.stringify(d);
  if(tg&&tg.initData&&tg.sendData&&tg.initDataUnsafe&&!tg.initDataUnsafe.query_id){try{tg.sendData(s.slice(0,4096));return}catch(e){}}
  try{await navigator.clipboard.writeText(s);toast('JSON мелодии скопирован — вставь его в чат Пузе')}catch(e){toast('Отправка доступна при открытии из кнопки меню бота')}};
addEventListener('resize',buildKeys);
(async()=>{buildKeys();setSong(await loadMelody());requestAnimationFrame(frame)})();
