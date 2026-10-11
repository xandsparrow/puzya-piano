// Пузя Ран — endless 3-lane runner, pseudo-3D on canvas 2D. Original blocky character (no third-party assets).
(()=>{
const cv=document.getElementById('gcv'),cx=cv.getContext('2d'),ov=document.getElementById('gover');
const LS='pzRunBest',ZP=2.2,FAR=60,LW=1.5;
let W=0,H=0,dpr=1,active=false,raf=0,last=0;
const S={st:'idle',x:0,lane:0,y:0,vy:0,z:0,v:9,score:0,best:+(localStorage.getItem(LS)||0),obs:[],nextZ:20,t:0,music:true,shake:0};
function size(){dpr=Math.min(window.devicePixelRatio||1,3);const r=cv.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',()=>active&&size());
// projection: camera behind & above the player
const camH=2.3,camZ=-1.2;
function proj(X,Y,Z){const dz=Math.max(.05,Z-S.z-camZ),f=H*.95/dz,hor=H*.30;return{x:W/2+(X-S.x*.35)*f,y:hor+(camH-Y)*f*.62,f}}
function haptic(t){try{const h=Telegram.WebApp.HapticFeedback;t==='err'?h.notificationOccurred('error'):h.impactOccurred(t||'light')}catch(e){}}
function beep(f,d,type){try{const a=audio(),o=a.createOscillator(),g=a.createGain();o.type=type||'square';o.frequency.setValueAtTime(f,a.currentTime);o.frequency.exponentialRampToValueAtTime(f*2,a.currentTime+d);
  g.gain.setValueAtTime(.15,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d);o.connect(g);g.connect(master);o.start();o.stop(a.currentTime+d)}catch(e){}}
function reset(){Object.assign(S,{st:'run',x:0,lane:0,y:0,vy:0,z:0,v:9,score:0,obs:[],nextZ:22,t:0,shake:0});ov.classList.add('h')}
function spawn(){while(S.nextZ<S.z+FAR){const z=S.nextZ,r=Math.random();
    if(r<.35){const free=Math.floor(Math.random()*3)-1;[-1,0,1].forEach(l=>{if(l!==free&&Math.random()<.75)S.obs.push({t:'pillar',l,z})})}
    else if(r<.68){const l=Math.floor(Math.random()*3)-1;S.obs.push({t:'hole',l,z});if(Math.random()<.4)S.obs.push({t:'hole',l:l?0:1,z})}
    else{const all=Math.random()<.35;[-1,0,1].forEach(l=>{if(all||Math.random()<.5)S.obs.push({t:'bar',l,z})})}
    S.nextZ+=Math.max(7,13-S.v*.25)+Math.random()*6}}
function act(a){if(!active)return;if(S.st!=='run'){if(a==='jump'&&(S.st==='idle'||performance.now()-S.overAt>600))start();return}
  if(a==='l'&&S.lane>-1){S.lane--;haptic('light')}if(a==='r'&&S.lane<1){S.lane++;haptic('light')}
  if(a==='jump'&&S.y<=0.001){S.vy=8.2;beep(330,.18);haptic('light')}}
function hit(o){if(Math.abs(S.x-o.l)>.45)return false;const dz=o.z-(S.z+ZP);
  if(o.t==='pillar')return Math.abs(dz)<.45;if(o.t==='bar')return Math.abs(dz)<.3&&S.y<.65;
  if(o.t==='hole')return dz<.35&&dz>-.75&&S.y<.05&&Math.abs(S.x-o.l)<.35;return false}
function over(o){S.st='over';S.overAt=performance.now();S.shake=.35;haptic('err');beep(110,.4,'sawtooth');
  const sc=Math.floor(S.score);let nb='';if(sc>S.best){S.best=sc;localStorage.setItem(LS,sc);nb='\n🏆 Новый рекорд!'}
  document.getElementById('gotitle').textContent=o.t==='hole'?'Упал в яму!':o.t==='bar'?'Споткнулся!':'Бум! Столб!';
  document.getElementById('gotext').textContent='Счёт: '+sc+' м   Рекорд: '+S.best+' м'+nb;document.getElementById('gstart').textContent='↻ Ещё раз';ov.classList.remove('h')}
function step(dt){S.t+=dt;if(S.shake>0)S.shake-=dt;if(S.st!=='run')return;
  S.v=Math.min(26,9+S.t*.18);S.z+=S.v*dt;S.score+=S.v*dt;
  S.x+=(S.lane-S.x)*Math.min(1,dt*14);
  S.vy-=24*dt;S.y=Math.max(0,S.y+S.vy*dt);if(S.y===0)S.vy=Math.max(0,S.vy);
  spawn();S.obs=S.obs.filter(o=>o.z>S.z-2);
  for(const o of S.obs)if(hit(o)){over(o);break}}
// ---- drawing
function quad(a,b,c,d,col){cx.fillStyle=col;cx.beginPath();cx.moveTo(a.x,a.y);cx.lineTo(b.x,b.y);cx.lineTo(c.x,c.y);cx.lineTo(d.x,d.y);cx.closePath();cx.fill()}
function box(X,Y,Z,w,h,dep,top,front,side){// axis box: centre X, bottom Y, near face Z
  const x0=X-w/2,x1=X+w/2,z1=Z+dep;
  const fl=proj(x0,Y,Z),fr=proj(x1,Y,Z),tl=proj(x0,Y+h,Z),tr=proj(x1,Y+h,Z),bl=proj(x0,Y+h,z1),br=proj(x1,Y+h,z1),sl=proj(x0,Y,z1),sr=proj(x1,Y,z1);
  if(proj(0,0,Z).y>tl.y)quad(tl,tr,br,bl,top);
  if(fl.x>W/2)quad(fl,tl,bl,sl,side);if(fr.x<W/2)quad(fr,tr,br,sr,side);
  quad(fl,fr,tr,tl,front)}
function drawWorld(){
  const hor=H*.30,g=cx.createLinearGradient(0,0,0,hor);g.addColorStop(0,'#5fb4ff');g.addColorStop(1,'#cfeaff');cx.fillStyle=g;cx.fillRect(0,0,W,hor+1);
  cx.fillStyle='#fff8';for(let i=0;i<4;i++){const x=((i*137+S.t*6)%(W+120))-60;cx.beginPath();cx.ellipse(x,hor*.35+i*14,40,12,0,0,7);cx.fill()}
  cx.fillStyle='#57b04a';cx.fillRect(0,hor,W,H-hor);
  const zn=S.z+camZ+.25,zf=S.z+FAR,a=proj(-LW*1.5-.2,0,zn),b=proj(LW*1.5+.2,0,zn),c=proj(LW*1.5+.2,0,zf),d=proj(-LW*1.5-.2,0,zf);quad(a,b,c,d,'#8a6a4a');
  const a2=proj(-LW*1.5,0,zn),b2=proj(LW*1.5,0,zn),c2=proj(LW*1.5,0,zf),d2=proj(-LW*1.5,0,zf);quad(a2,b2,c2,d2,'#c79a6a');
  // moving stripes
  for(let k=Math.floor(S.z/4)*4;k<zf;k+=4){if(k<zn)continue;const p=proj(-LW*1.5,0,k),q=proj(LW*1.5,0,k),p2=proj(LW*1.5,0,k+2),q2=proj(-LW*1.5,0,k+2);quad(p,q,p2,q2,'#b98c5e')}
  cx.strokeStyle='#fff9';cx.lineWidth=2;for(const X of[-LW/2,LW/2]){const p=proj(X,0,zn),q=proj(X,0,zf);cx.beginPath();cx.moveTo(p.x,p.y);cx.lineTo(q.x,q.y);cx.stroke()}}
function drawObs(o){const X=o.l*LW;
  if(o.t==='hole'){const a=proj(X-.7,0,o.z),b=proj(X+.7,0,o.z),c=proj(X+.7,0,o.z+1.4),d=proj(X-.7,0,o.z+1.4);quad(a,b,c,d,'#1a120c');const e=proj(X-.7,-.4,o.z+1.4),f=proj(X+.7,-.4,o.z+1.4);quad(d,c,f,e,'#3b2a1c')}
  else if(o.t==='bar')box(X,0,o.z,1.3,.5,.3,'#ffd84d','#ff9f1c','#d97a00');
  else box(X,0,o.z,1.0,2.6,.9,'#bfc6d1','#8d97a6','#6b7482')}
function drawHero(){const X=S.x*LW,Z=S.z+ZP,run=S.st==='run'&&S.y===0,ph=Math.sin(S.t*S.v*.9)*(run?1:.15),Y=S.y;
  const sh=proj(X,0,Z);cx.fillStyle='#0004';cx.beginPath();cx.ellipse(sh.x,sh.y,sh.f*.38*(1-Math.min(.5,Y*.2)),sh.f*.08,0,0,7);cx.fill();
  const leg=(dx,s)=>box(X+dx,Y+Math.max(0,s)*.12,Z+s*.12,.24,.62,.24,'#3fae3f','#2e8b2e','#256f25');
  const arm=(dx,s)=>box(X+dx,Y+.62+Math.max(0,-s)*.1,Z-s*.14,.2,.6,.22,'#ffd84d','#f2c230','#d8a91e');
  // back view: legs, torso, arms, head
  leg(-.14,ph);leg(.14,-ph);box(X,Y+.6,Z,.62,.66,.34,'#3a7bff','#2a62e0','#1f4fbf');arm(-.42,-ph);arm(.42,ph);
  box(X,Y+1.28,Z+.02,.46,.44,.4,'#ffe066','#f5cc2f','#dcb21c')}
function drawHUD(){cx.fillStyle='#000a';cx.beginPath();cx.roundRect?cx.roundRect(10,10,W-20,40,12):cx.rect(10,10,W-20,40);cx.fill();
  cx.fillStyle='#fff';cx.font='700 18px -apple-system,Inter,Roboto,sans-serif';cx.textBaseline='middle';cx.textAlign='left';cx.fillText('🏃 '+Math.floor(S.score)+' м',22,30);
  cx.textAlign='right';cx.fillText('🏆 '+S.best+' м',W-22,30);cx.textAlign='center';cx.font='600 13px -apple-system,sans-serif';cx.fillText((S.v*3.6|0)+' км/ч',W/2,30)}
function draw(){cx.save();if(S.shake>0)cx.translate((Math.random()-.5)*12*S.shake,(Math.random()-.5)*12*S.shake);
  drawWorld();const far=S.obs.filter(o=>o.z<S.z+FAR).sort((a,b)=>b.z-a.z);
  for(const o of far)if(o.z+(o.t==='pillar'?.9:0)>S.z+ZP||o.t==='hole')drawObs(o);
  drawHero();for(const o of far)if(!(o.z+(o.t==='pillar'?.9:0)>S.z+ZP||o.t==='hole'))drawObs(o);cx.restore();drawHUD()}
function loop(now){if(!active)return;const dt=Math.min(.05,(now-last)/1000||0);last=now;step(dt);draw();raf=requestAnimationFrame(loop)}
function music(on){try{if(on){timbre='piano';if(!playing)setPlaying(true)}else if(playing)setPlaying(false)}catch(e){}}
function start(){audio();reset();if(S.music)music(true)}
// ---- input
const bind=(id,a)=>{const e=document.getElementById(id);e.addEventListener('pointerdown',ev=>{ev.preventDefault();act(a)})};
bind('gl','l');bind('gr','r');bind('gj','jump');
document.getElementById('gstart').onclick=()=>start();
let tx=0,ty=0,tt=0;cv.addEventListener('touchstart',e=>{const t=e.changedTouches[0];tx=t.clientX;ty=t.clientY;tt=Date.now();e.preventDefault()},{passive:false});
cv.addEventListener('touchend',e=>{const t=e.changedTouches[0],dx=t.clientX-tx,dy=t.clientY-ty;e.preventDefault();
  if(Math.max(Math.abs(dx),Math.abs(dy))<20){act('jump');return}if(Math.abs(dx)>Math.abs(dy))act(dx<0?'l':'r');else if(dy<0)act('jump')},{passive:false});
addEventListener('keydown',e=>{if(!active)return;const k=e.key;if(k==='ArrowLeft'||k==='a')act('l');else if(k==='ArrowRight'||k==='d')act('r');else if(k===' '||k==='ArrowUp'||k==='w'){act('jump');if(S.st==='idle')start()}else return;e.preventDefault()});
window.PZG={S,step,hit,act,start,enter(){active=true;S.st='idle';ov.classList.remove('h');document.getElementById('gotitle').textContent='Пузя Ран';
    document.getElementById('gotext').textContent='← → — смена дорожки, ⬆️ — прыжок\nПрыгай через ямы и барьеры, обегай столбы!\nРекорд: '+S.best+' м';document.getElementById('gstart').textContent='▶ Старт';
    requestAnimationFrame(()=>{size();last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop)})},
  leave(){active=false;cancelAnimationFrame(raf);music(false)},toggleMusic(){S.music=!S.music;music(S.music);toast(S.music?'Музыка включена 🎶':'Музыка выключена')}};
})();
