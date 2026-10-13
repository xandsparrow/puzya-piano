// Космос 3D — third-person neon space shooter with Three.js (CDN ES module) + pooled objects for 60fps on iPhone.
const scv = document.getElementById('scv');
const sover = document.getElementById('sover');
const sotitle = document.getElementById('sotitle');
const sotext = document.getElementById('sotext');
const sstart = document.getElementById('sstart');
const sscore = document.getElementById('sscore');
const sbest = document.getElementById('sbest');
const slives = document.getElementById('slives');
const sgun = document.getElementById('sgun');
const swave = document.getElementById('swave');
const supg = document.getElementById('supg');
const sfire = document.getElementById('sfire');
const sjoy = document.getElementById('sjoy');
const sknob = document.getElementById('sknob');

const LS_KEY = 'pzSpaceBest';
const MAX_GUN = 5;

export const GUN_LEVELS = [
  null,
  { lvl: 1, name: 'Ур. 1 · Лазер',      cd: 0.20, shots: 1, spread: 0,    dmg: 1.0, scale: 1.0,  color: 0x00f0ff, hex: '#00f0ff' },
  { lvl: 2, name: 'Ур. 2 · Скорострел', cd: 0.13, shots: 1, spread: 0,    dmg: 1.35, scale: 1.15, color: 0x39ff14, hex: '#39ff14' },
  { lvl: 3, name: 'Ур. 3 · Двойной',    cd: 0.115, shots: 2, spread: 0.36, dmg: 1.3, scale: 1.2,  color: 0xff2a85, hex: '#ff2a85' },
  { lvl: 4, name: 'Ур. 4 · Тройной',    cd: 0.10, shots: 3, spread: 0.44, dmg: 1.45, scale: 1.3, color: 0xffb800, hex: '#ffb800' },
  { lvl: 5, name: 'Ур. 5 · МАКС ГИПЕР', cd: 0.08, shots: 3, spread: 0.50, dmg: 2.1, scale: 1.55, color: 0xd946ef, hex: '#e879f9' }
];

const S = {
  st: 'idle',
  x: 0, y: -0.3,
  vx: 0, vy: 0,
  bank: 0, pitch: 0, yaw: 0,
  score: 0,
  best: +(localStorage.getItem(LS_KEY) || 0),
  lives: 3,
  gun: 1,
  wave: 1,
  kills: 0,
  t: 0,
  fireCd: 0,
  firing: false,
  invuln: 0,
  shake: 0,
  music: true,
  xBound: 2.4,
  yBound: 2.3,
  saucerTimer: 0.8,
  asteroidTimer: 3.2,
  lasers: [],
  saucers: [],
  asteroids: [],
  loots: [],
  particles: []
};

let active = false;
let raf = 0;
let last = 0;
let W = 1, H = 1, dpr = 1;
let joyX = 0, joyY = 0, joyId = null;
const keysDown = new Set();

// ---- Telegram Haptics & WebAudio SFX
function haptic(type) {
  try {
    const h = window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback;
    if (!h) return;
    if (type === 'err' || type === 'error') h.notificationOccurred('error');
    else if (type === 'success') h.notificationOccurred('success');
    else h.impactOccurred(type || 'light');
  } catch (e) {}
}

let noiseBuf = null;
function getNoise(a) {
  if (noiseBuf && noiseBuf.sampleRate === a.sampleRate) return noiseBuf;
  const len = Math.floor(a.sampleRate * 0.45);
  noiseBuf = a.createBuffer(1, len, a.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
  return noiseBuf;
}

function sfxShot(lvl) {
  try {
    if (typeof audio !== 'function') return;
    const a = audio(), now = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = lvl >= 4 ? 'sawtooth' : 'triangle';
    const baseF = 760 + lvl * 95;
    o.frequency.setValueAtTime(baseF, now);
    o.frequency.exponentialRampToValueAtTime(150, now + 0.085);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    o.connect(g);
    g.connect(typeof master !== 'undefined' && master ? master : a.destination);
    o.start(now);
    o.stop(now + 0.095);
  } catch (e) {}
}

function sfxExplosion(big = false) {
  try {
    if (typeof audio !== 'function') return;
    const a = audio(), now = a.currentTime;
    const out = typeof master !== 'undefined' && master ? master : a.destination;
    // noise burst
    const src = a.createBufferSource();
    src.buffer = getNoise(a);
    const fl = a.createBiquadFilter();
    fl.type = 'bandpass';
    fl.frequency.setValueAtTime(big ? 420 : 680, now);
    fl.frequency.exponentialRampToValueAtTime(110, now + (big ? 0.38 : 0.24));
    const gn = a.createGain();
    gn.gain.setValueAtTime(big ? 0.28 : 0.18, now);
    gn.gain.exponentialRampToValueAtTime(0.001, now + (big ? 0.4 : 0.26));
    src.connect(fl).connect(gn).connect(out);
    src.start(now);
    // sub drop
    const o = a.createOscillator(), go = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(big ? 130 : 170, now);
    o.frequency.exponentialRampToValueAtTime(34, now + (big ? 0.36 : 0.22));
    go.gain.setValueAtTime(big ? 0.26 : 0.16, now);
    go.gain.exponentialRampToValueAtTime(0.001, now + (big ? 0.38 : 0.24));
    o.connect(go).connect(out);
    o.start(now);
    o.stop(now + (big ? 0.4 : 0.25));
  } catch (e) {}
}

function sfxPickup(lvl) {
  try {
    if (typeof audio !== 'function') return;
    const a = audio(), now = a.currentTime;
    const out = typeof master !== 'undefined' && master ? master : a.destination;
    const freqs = lvl >= MAX_GUN ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [440, 554.37, 659.25, 880];
    freqs.forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'triangle';
      const t0 = now + i * 0.045;
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.14, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + 0.17);
    });
  } catch (e) {}
}

function sfxHit() {
  try {
    if (typeof audio !== 'function') return;
    const a = audio(), now = a.currentTime;
    const out = typeof master !== 'undefined' && master ? master : a.destination;
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(155, now);
    o.frequency.linearRampToValueAtTime(52, now + 0.32);
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    o.connect(g).connect(out);
    o.start(now);
    o.stop(now + 0.35);
    sfxExplosion(true);
  } catch (e) {}
}

function music(on) {
  try {
    if (on) {
      if (typeof timbre !== 'undefined') timbre = 'synth';
      if (typeof playing !== 'undefined' && !playing && typeof setPlaying === 'function') setPlaying(true);
    } else if (typeof playing !== 'undefined' && playing && typeof setPlaying === 'function') {
      setPlaying(false);
    }
  } catch (e) {}
}

let upgTimer = 0;
function showBanner(txt) {
  if (!supg) return;
  supg.textContent = txt;
  supg.classList.add('s');
  clearTimeout(upgTimer);
  upgTimer = setTimeout(() => supg.classList.remove('s'), 1900);
}

function updateHUD() {
  const g = GUN_LEVELS[S.gun] || GUN_LEVELS[1];
  if (sscore) sscore.textContent = '🎯 ' + Math.floor(S.score);
  if (sbest) sbest.textContent = '🏆 ' + S.best;
  if (slives) slives.textContent = S.lives > 0 ? '❤️'.repeat(S.lives) + '🖤'.repeat(Math.max(0, 3 - S.lives)) : '💀 0';
  if (sgun) {
    sgun.textContent = '⚡ ' + g.name;
    sgun.style.color = g.hex;
    sgun.style.borderColor = g.hex;
  }
  if (swave) swave.textContent = 'Волна ' + S.wave;
}

// ---- Three.js 3D Engine & Object Pools
let THREE = null;
let renderer = null, scene = null, camera = null;
let shipGroup = null, aimBeam = null, aimGlow = null, aimReticle = null, thrusterL = null, thrusterR = null, shieldMesh = null;
let starGeo = null, starPos = null, starSpeeds = null;
let streakGeo = null, streakPos = null;
let nebulae = [];
let laserPool = [], saucerPool = [], asteroidPool = [], lootPool = [];
let expGeo = null, expPos = null, expCol = null, expData = [];
let fallbackCtx = null;
let threeReady = false;
let threeFailed = false;

const STAR_COUNT = 340;
const STREAK_COUNT = 45;
const LASER_POOL_SIZE = 45;
const SAUCER_POOL_SIZE = 14;
const ASTEROID_POOL_SIZE = 8;
const LOOT_POOL_SIZE = 10;
const EXP_PARTICLES = 220;

function makeGlowTexture(innerHex, midHex, outerHex = 'rgba(0,0,0,0)') {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, innerHex);
  g.addColorStop(0.38, midHex);
  g.addColorStop(1, outerHex);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function initThreeScene() {
  if (!THREE || threeReady) return;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: scv,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x050312, 1);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060318, 0.0085);

    camera = new THREE.PerspectiveCamera(58, 1, 0.1, 180);
    camera.position.set(0, 1.55, 7.2);
    camera.lookAt(0, 0, -25);

    // Lighting
    const amb = new THREE.AmbientLight(0x5b6ee1, 1.35);
    scene.add(amb);
    const dir1 = new THREE.DirectionalLight(0x00f0ff, 1.7);
    dir1.position.set(6, 12, 10);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0xff2a85, 1.2);
    dir2.position.set(-8, -6, 4);
    scene.add(dir2);

    const glowTexWhite = makeGlowTexture('#ffffff', 'rgba(0,240,255,0.65)');
    const glowTexPink = makeGlowTexture('#ffffff', 'rgba(255,42,133,0.65)');
    const glowTexGold = makeGlowTexture('#ffffff', 'rgba(255,190,0,0.7)');

    // Nebula background sprites (colorful additive glow clouds)
    const nebColors = [0x8b00ff, 0x00d8ff, 0xff007f, 0x3a0ca3, 0x00f5d4, 0xc77dff];
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.SpriteMaterial({
        map: i % 2 === 0 ? glowTexWhite : glowTexPink,
        color: nebColors[i % nebColors.length],
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.24,
        depthWrite: false
      });
      const sp = new THREE.Sprite(mat);
      const sx = (i % 2 === 0 ? -1 : 1) * (10 + (i * 5) % 14);
      const sy = ((i % 3) - 1) * 8;
      const sz = -55 - i * 16;
      sp.position.set(sx, sy, sz);
      const sc = 36 + (i % 3) * 14;
      sp.scale.set(sc, sc * 0.65, 1);
      scene.add(sp);
      nebulae.push({ sp, baseScale: sc, phase: i * 1.3 });
    }

    // Starfield (Points rushing toward camera)
    starGeo = new THREE.BufferGeometry();
    starPos = new Float32Array(STAR_COUNT * 3);
    const starCol = new Float32Array(STAR_COUNT * 3);
    starSpeeds = new Float32Array(STAR_COUNT);
    const palette = [
      [1, 1, 1],
      [0.35, 0.95, 1],
      [1, 0.45, 0.82],
      [1, 0.88, 0.45],
      [0.68, 0.55, 1]
    ];
    for (let i = 0; i < STAR_COUNT; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 44;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 34;
      starPos[i * 3 + 2] = -Math.random() * 140 + 6;
      starSpeeds[i] = 28 + Math.random() * 34;
      const c = palette[i % palette.length];
      starCol[i * 3] = c[0];
      starCol[i * 3 + 1] = c[1];
      starCol[i * 3 + 2] = c[2];
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.42,
      map: glowTexWhite,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // Warp speed streaks
    streakGeo = new THREE.BufferGeometry();
    streakPos = new Float32Array(STREAK_COUNT * 6);
    for (let i = 0; i < STREAK_COUNT; i++) {
      const x = (Math.random() - 0.5) * 28;
      const y = (Math.random() - 0.5) * 22;
      const z = -Math.random() * 130;
      streakPos[i * 6] = x; streakPos[i * 6 + 1] = y; streakPos[i * 6 + 2] = z;
      streakPos[i * 6 + 3] = x; streakPos[i * 6 + 4] = y; streakPos[i * 6 + 5] = z - 3.5;
    }
    streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
    const streakMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    scene.add(new THREE.LineSegments(streakGeo, streakMat));

    // ---- Player Spaceship Group + Aiming Laser Beam
    shipGroup = new THREE.Group();
    scene.add(shipGroup);

    // Main hull
    const hullGeo = new THREE.ConeGeometry(0.46, 1.9, 6);
    hullGeo.rotateX(Math.PI / 2);
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.7
    });
    shipGroup.add(new THREE.Mesh(hullGeo, hullMat));

    // Cockpit canopy
    const cockGeo = new THREE.SphereGeometry(0.24, 10, 8);
    cockGeo.scale(0.85, 0.65, 1.65);
    const cockMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00b4d8,
      emissiveIntensity: 0.85,
      roughness: 0.1,
      metalness: 0.9
    });
    const cock = new THREE.Mesh(cockGeo, cockMat);
    cock.position.set(0, 0.16, -0.1);
    shipGroup.add(cock);

    // Swept delta wings
    const wingGeo = new THREE.BoxGeometry(1.75, 0.06, 0.68);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.6
    });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.set(0, -0.02, 0.22);
    shipGroup.add(wings);

    // Neon wingtip cannons
    const tipGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.85, 6);
    tipGeo.rotateX(Math.PI / 2);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xff2a85 });
    for (const side of [-0.84, 0.84]) {
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(side, 0, 0.08);
      shipGroup.add(tip);
    }

    // Twin engine glow sprites
    const thrMat = new THREE.SpriteMaterial({
      map: glowTexPink,
      color: 0x00f0ff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    thrusterL = new THREE.Sprite(thrMat);
    thrusterL.position.set(-0.22, -0.02, 0.98);
    thrusterL.scale.set(0.65, 0.65, 1);
    thrusterR = new THREE.Sprite(thrMat.clone());
    thrusterR.position.set(0.22, -0.02, 0.98);
    thrusterR.scale.set(0.65, 0.65, 1);
    shipGroup.add(thrusterL, thrusterR);

    // Invulnerability / hit shield sphere
    const shGeo = new THREE.SphereGeometry(1.05, 12, 10);
    const shMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    shieldMesh = new THREE.Mesh(shGeo, shMat);
    shipGroup.add(shieldMesh);

    // Thin Aiming Laser Beam extending forward from the ship and moving with it
    const beamLen = 92;
    const beamCoreGeo = new THREE.CylinderGeometry(0.016, 0.01, beamLen, 6, 1, true);
    beamCoreGeo.rotateX(Math.PI / 2);
    beamCoreGeo.translate(0, 0, -beamLen / 2 - 0.9);
    const beamCoreMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    aimBeam = new THREE.Mesh(beamCoreGeo, beamCoreMat);
    shipGroup.add(aimBeam);

    const beamHaloGeo = new THREE.CylinderGeometry(0.055, 0.03, beamLen, 6, 1, true);
    beamHaloGeo.rotateX(Math.PI / 2);
    beamHaloGeo.translate(0, 0, -beamLen / 2 - 0.9);
    const beamHaloMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    aimGlow = new THREE.Mesh(beamHaloGeo, beamHaloMat);
    shipGroup.add(aimGlow);

    const retMat = new THREE.SpriteMaterial({
      map: glowTexWhite,
      color: 0x00f0ff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    aimReticle = new THREE.Sprite(retMat);
    aimReticle.position.set(0, 0, -28);
    aimReticle.scale.set(0.9, 0.9, 1);
    shipGroup.add(aimReticle);

    // ---- Pooled Laser Bolts
    const boltGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.55, 6);
    boltGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < LASER_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.95
      });
      const mesh = new THREE.Mesh(boltGeo, mat);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexWhite,
        color: 0x00f0ff,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.75,
        depthWrite: false
      }));
      spr.scale.set(0.75, 0.75, 1);
      mesh.add(spr);
      mesh.visible = false;
      scene.add(mesh);
      laserPool.push({ mesh, mat, spr });
    }

    // ---- Pooled Alien Flying Saucers
    const saucerDiscGeo = new THREE.CylinderGeometry(0.45, 0.95, 0.26, 12);
    const saucerRimGeo = new THREE.TorusGeometry(0.92, 0.08, 6, 14);
    saucerRimGeo.rotateX(Math.PI / 2);
    const saucerDomeGeo = new THREE.SphereGeometry(0.46, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    for (let i = 0; i < SAUCER_POOL_SIZE; i++) {
      const grp = new THREE.Group();
      const discMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        emissive: 0x3b0764,
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.75
      });
      const rimMat = new THREE.MeshBasicMaterial({ color: 0xff2a85 });
      const domeMat = new THREE.MeshBasicMaterial({
        color: 0x00f5d4,
        transparent: true,
        opacity: 0.85
      });
      const disc = new THREE.Mesh(saucerDiscGeo, discMat);
      const rim = new THREE.Mesh(saucerRimGeo, rimMat);
      const dome = new THREE.Mesh(saucerDomeGeo, domeMat);
      dome.position.y = 0.08;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexPink,
        color: 0xff2a85,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      }));
      glow.scale.set(2.9, 1.7, 1);
      grp.add(disc, rim, dome, glow);
      grp.visible = false;
      scene.add(grp);
      saucerPool.push({ grp, discMat, rimMat, domeMat, glow });
    }

    // ---- Pooled Asteroids (rare hazards to dodge)
    const astGeo = new THREE.DodecahedronGeometry(0.95, 1);
    for (let i = 0; i < ASTEROID_POOL_SIZE; i++) {
      const grp = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: 0x7c2d12,
        emissive: 0x450a0a,
        emissiveIntensity: 0.5,
        roughness: 0.85,
        metalness: 0.15,
        flatShading: true
      });
      const rock = new THREE.Mesh(astGeo, mat);
      const warn = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexGold,
        color: 0xff4500,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.48,
        depthWrite: false
      }));
      warn.scale.set(2.8, 2.8, 1);
      grp.add(rock, warn);
      grp.visible = false;
      scene.add(grp);
      asteroidPool.push({ grp, rock, warn });
    }

    // ---- Pooled Loot Pickups (glowing crystals dropped by saucers)
    const lootGeo = new THREE.OctahedronGeometry(0.42, 0);
    const lootRingGeo = new THREE.TorusGeometry(0.58, 0.04, 6, 14);
    for (let i = 0; i < LOOT_POOL_SIZE; i++) {
      const grp = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: false });
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const core = new THREE.Mesh(lootGeo, mat);
      const ring = new THREE.Mesh(lootRingGeo, ringMat);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexGold,
        color: 0x39ff14,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      }));
      halo.scale.set(2.2, 2.2, 1);
      grp.add(core, ring, halo);
      grp.visible = false;
      scene.add(grp);
      lootPool.push({ grp, core, ring, mat, halo });
    }

    // ---- Pooled Explosion Particles (single Points system = 1 draw call)
    expGeo = new THREE.BufferGeometry();
    expPos = new Float32Array(EXP_PARTICLES * 3);
    expCol = new Float32Array(EXP_PARTICLES * 3);
    for (let i = 0; i < EXP_PARTICLES; i++) {
      expPos[i * 3 + 1] = -9999;
      expData.push({ life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0 });
    }
    expGeo.setAttribute('position', new THREE.BufferAttribute(expPos, 3));
    expGeo.setAttribute('color', new THREE.BufferAttribute(expCol, 3));
    const expMat = new THREE.PointsMaterial({
      size: 0.85,
      map: glowTexWhite,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const expPoints = new THREE.Points(expGeo, expMat);
    expPoints.frustumCulled = false;
    scene.add(expPoints);

    threeReady = true;
    size();
  } catch (e) {
    threeReady = false;
  }
}

// Load Three.js from CDN ES module
(async () => {
  const urls = [
    'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
    'https://unpkg.com/three@0.160.0/build/three.module.js'
  ];
  for (const u of urls) {
    try {
      THREE = await import(u);
      initThreeScene();
      if (threeReady) break;
    } catch (e) {}
  }
  if (!threeReady) threeFailed = true;
})();

function size() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = scv.getBoundingClientRect();
  W = Math.max(1, r.width || window.innerWidth || 360);
  H = Math.max(1, r.height || window.innerHeight || 520);
  const aspect = W / H;
  // Compute visible playfield bounds at z = 0 (distance 7.2 from camera with fov 58 deg)
  const visH = 7.2 * Math.tan((58 * Math.PI) / 360);
  const visW = visH * aspect;
  S.xBound = Math.max(1.65, Math.min(4.2, visW * 0.82));
  S.yBound = Math.max(1.65, Math.min(2.7, visH * 0.56));

  if (threeReady && renderer && camera) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  } else {
    scv.width = Math.round(W * dpr);
    scv.height = Math.round(H * dpr);
  }
}
addEventListener('resize', () => active && size());

// ---- Spawning & Pooling Helpers
function spawnExplosion(x, y, z, colorHex = 0xff2a85, count = 26) {
  S.particles.push({ x, y, z, colorHex, t: 0 });
  if (S.particles.length > 20) S.particles.shift();
  if (!threeReady) return;
  const r = ((colorHex >> 16) & 255) / 255;
  const g = ((colorHex >> 8) & 255) / 255;
  const b = (colorHex & 255) / 255;
  let spawned = 0;
  for (let i = 0; i < EXP_PARTICLES && spawned < count; i++) {
    const p = expData[i];
    if (p.life <= 0) {
      p.life = 0.45 + Math.random() * 0.35;
      p.maxLife = p.life;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = 4 + Math.random() * 14;
      p.vx = Math.sin(phi) * Math.cos(theta) * spd;
      p.vy = Math.sin(phi) * Math.sin(theta) * spd;
      p.vz = Math.cos(phi) * spd;
      expPos[i * 3] = x;
      expPos[i * 3 + 1] = y;
      expPos[i * 3 + 2] = z;
      const mix = Math.random() * 0.45;
      expCol[i * 3] = r + (1 - r) * mix;
      expCol[i * 3 + 1] = g + (1 - g) * mix;
      expCol[i * 3 + 2] = b + (1 - b) * mix;
      spawned++;
    }
  }
}

function fireVolley() {
  const cfg = GUN_LEVELS[S.gun] || GUN_LEVELS[1];
  S.fireCd = cfg.cd;
  sfxShot(S.gun);
  if ( cfg.shots === 1 ) {
    S.lasers.push({ x: S.x, y: S.y, z: -0.9, vx: 0, vy: 0, vz: -92, dmg: cfg.dmg, color: cfg.color, scale: cfg.scale });
  } else if ( cfg.shots === 2 ) {
    for (const dx of [-cfg.spread, cfg.spread]) {
      S.lasers.push({ x: S.x + dx, y: S.y - 0.04, z: -0.85, vx: 0, vy: 0, vz: -95, dmg: cfg.dmg, color: cfg.color, scale: cfg.scale });
    }
  } else {
    for (const k of [-1, 0, 1]) {
      S.lasers.push({
        x: S.x + k * cfg.spread,
        y: S.y + (k === 0 ? 0.06 : -0.04),
        z: -0.9,
        vx: k * 2.2,
        vy: 0,
        vz: -98,
        dmg: cfg.dmg,
        color: k === 0 && S.gun === MAX_GUN ? 0x00f0ff : cfg.color,
        scale: k === 0 ? cfg.scale * 1.15 : cfg.scale
      });
    }
  }
}

function spawnSaucer() {
  const w = S.wave;
  const elite = w >= 2 && Math.random() < Math.min(0.65, (w - 1) * 0.16);
  const hp = elite ? 1.8 + w * 0.55 : 1 + (w - 1) * 0.32;
  const bx = (Math.random() * 2 - 1) * S.xBound * 0.82;
  const by = (Math.random() * 2 - 1) * S.yBound * 0.78;
  S.saucers.push({
    x: bx,
    y: by,
    baseX: bx,
    baseY: by,
    z: -96 - Math.random() * 14,
    vz: 15 + Math.min(18, w * 1.7) + Math.random() * 4,
    ampX: (0.45 + Math.random() * 0.75) * Math.min(1.2, S.xBound * 0.45),
    ampY: 0.25 + Math.random() * 0.45,
    freq: 1.5 + Math.random() * 1.6,
    phase: Math.random() * Math.PI * 2,
    hp,
    maxHp: hp,
    elite,
    hitFlash: 0
  });
}

function spawnAsteroid() {
  const ax = (Math.random() * 2 - 1) * S.xBound * 0.88;
  const ay = (Math.random() * 2 - 1) * S.yBound * 0.82;
  S.asteroids.push({
    x: ax,
    y: ay,
    z: -105,
    vz: 22 + Math.min(20, S.wave * 1.9) + Math.random() * 5,
    rx: Math.random() * 3,
    ry: Math.random() * 3,
    rz: Math.random() * 3,
    vrx: (Math.random() - 0.5) * 3.5,
    vry: (Math.random() - 0.5) * 3.5,
    r: 0.85 + Math.random() * 0.25
  });
}

function spawnLoot(x, y, z) {
  const nextLvl = Math.min(MAX_GUN, S.gun + 1);
  const col = GUN_LEVELS[nextLvl].color;
  S.loots.push({
    x: Math.max(-S.xBound * 0.85, Math.min(S.xBound * 0.85, x)),
    y: Math.max(-S.yBound * 0.8, Math.min(S.yBound * 0.8, y)),
    z: Math.max(-68, z),
    vz: 15.5,
    rot: 0,
    color: col
  });
}

function collectLoot() {
  if (S.gun < MAX_GUN) {
    S.gun++;
    const g = GUN_LEVELS[S.gun];
    showBanner('⚡ АПГРЕЙД: ' + g.name.toUpperCase() + '!');
  } else {
    S.score += 200;
    if (S.lives < 3 && Math.random() < 0.4) {
      S.lives++;
      showBanner('❤️ +1 ЖИЗНЬ И БОНУС +200!');
    } else {
      showBanner('👑 МАКС ОРУЖИЕ · БОНУС +200!');
    }
  }
  S.score += 50;
  haptic('success');
  sfxPickup(S.gun);
  updateHUD();
}

function damagePlayer(reason) {
  if (S.invuln > 0 || S.st !== 'run') return;
  S.lives--;
  S.invuln = 1.6;
  S.shake = 0.45;
  haptic('err');
  sfxHit();
  spawnExplosion(S.x, S.y, -0.5, 0xff4500, 34);
  updateHUD();
  if (S.lives <= 0) {
    gameOver(reason);
  }
}

function gameOver(reason) {
  S.st = 'over';
  S.overAt = performance.now();
  S.firing = false;
  sfire && sfire.classList.remove('on');
  const sc = Math.floor(S.score);
  let nb = '';
  if (sc > S.best) {
    S.best = sc;
    localStorage.setItem(LS_KEY, sc);
    nb = '\n🏆 Новый рекорд!';
  }
  updateHUD();
  if (sotitle) sotitle.textContent = reason === 'asteroid' ? '💥 Столкновение с астероидом!' : '🛸 Подбит пришельцами!';
  if (sotext) {
    sotext.textContent =
      'Счёт: ' + sc + '   Рекорд: ' + S.best +
      '\nВолна: ' + S.wave + '   Оружие: ' + GUN_LEVELS[S.gun].name + nb;
  }
  if (sstart) sstart.textContent = '↻ Ещё раз';
  sover && sover.classList.remove('h');
}

function reset() {
  Object.assign(S, {
    st: 'run',
    x: 0, y: -0.25,
    vx: 0, vy: 0,
    bank: 0, pitch: 0, yaw: 0,
    score: 0,
    lives: 3,
    gun: 1,
    wave: 1,
    kills: 0,
    t: 0,
    fireCd: 0,
    invuln: 0,
    shake: 0,
    saucerTimer: 0.45,
    asteroidTimer: 2.8,
    lasers: [],
    saucers: [],
    asteroids: [],
    loots: [],
    particles: []
  });
  sover && sover.classList.add('h');
  updateHUD();
}

function start() {
  if (typeof audio === 'function') audio();
  reset();
  if (S.music) music(true);
}

// ---- Simulation Step
function step(dt) {
  S.t += dt;
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 1.4);
  if (S.invuln > 0) S.invuln = Math.max(0, S.invuln - dt);

  // Keyboard directional input
  let kx = 0, ky = 0;
  if (keysDown.has('ArrowLeft') || keysDown.has('a') || keysDown.has('ф')) kx -= 1;
  if (keysDown.has('ArrowRight') || keysDown.has('d') || keysDown.has('в')) kx += 1;
  if (keysDown.has('ArrowUp') || keysDown.has('w') || keysDown.has('ц')) ky += 1;
  if (keysDown.has('ArrowDown') || keysDown.has('s') || keysDown.has('ы')) ky -= 1;

  const ix = Math.max(-1, Math.min(1, joyX + kx));
  const iy = Math.max(-1, Math.min(1, joyY + ky));

  if (S.st === 'run') {
    const speedX = 7.4;
    const speedY = 6.2;
    S.vx += (ix * speedX - S.vx) * Math.min(1, dt * 13);
    S.vy += (iy * speedY - S.vy) * Math.min(1, dt * 13);
    S.x = Math.max(-S.xBound, Math.min(S.xBound, S.x + S.vx * dt));
    S.y = Math.max(-S.yBound, Math.min(S.yBound, S.y + S.vy * dt));

    // Smooth banking & pitch
    const targetBank = -S.vx * 0.105;
    const targetPitch = S.vy * 0.065;
    const targetYaw = -S.vx * 0.035;
    S.bank += (targetBank - S.bank) * Math.min(1, dt * 12);
    S.pitch += (targetPitch - S.pitch) * Math.min(1, dt * 12);
    S.yaw += (targetYaw - S.yaw) * Math.min(1, dt * 12);

    // Wave progression
    const newWave = 1 + Math.floor(S.t / 16) + Math.floor(S.kills / 10);
    if (newWave > S.wave) {
      S.wave = newWave;
      showBanner('🌊 ВОЛНА ' + S.wave + '!');
      updateHUD();
    }

    // Passive distance score
    S.score += dt * (4 + S.wave);

    // Auto-fire when holding FIRE button or Space
    S.fireCd = Math.max(0, S.fireCd - dt);
    if ((S.firing || keysDown.has(' ')) && S.fireCd <= 0) {
      fireVolley();
    }

    // Spawn saucers
    S.saucerTimer -= dt;
    if (S.saucerTimer <= 0 && S.saucers.length < SAUCER_POOL_SIZE) {
      spawnSaucer();
      const baseInterval = Math.max(0.48, 1.55 - S.wave * 0.11);
      S.saucerTimer = baseInterval * (0.75 + Math.random() * 0.5);
    }

    // Spawn rare asteroids to dodge
    S.asteroidTimer -= dt;
    if (S.asteroidTimer <= 0 && S.asteroids.length < ASTEROID_POOL_SIZE) {
      spawnAsteroid();
      const astInterval = Math.max(1.8, 4.4 - S.wave * 0.22);
      S.asteroidTimer = astInterval * (0.8 + Math.random() * 0.5);
    }

    // Update lasers
    for (let i = S.lasers.length - 1; i >= 0; i--) {
      const b = S.lasers[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      if (b.z < -112) {
        S.lasers.splice(i, 1);
      }
    }

    // Update saucers & check laser collisions
    for (let i = S.saucers.length - 1; i >= 0; i--) {
      const u = S.saucers[i];
      u.z += u.vz * dt;
      u.x = Math.max(-S.xBound * 0.92, Math.min(S.xBound * 0.92, u.baseX + Math.sin(S.t * u.freq + u.phase) * u.ampX));
      u.y = Math.max(-S.yBound * 0.88, Math.min(S.yBound * 0.88, u.baseY + Math.cos(S.t * u.freq * 0.8 + u.phase) * u.ampY));
      if (u.hitFlash > 0) u.hitFlash = Math.max(0, u.hitFlash - dt * 5);

      // Check laser hits on saucer
      let destroyed = false;
      for (let j = S.lasers.length - 1; j >= 0; j--) {
        const b = S.lasers[j];
        if (Math.abs(b.z - u.z) < 2.3 && Math.hypot(b.x - u.x, b.y - u.y) < 1.18) {
          u.hp -= b.dmg;
          u.hitFlash = 1;
          S.lasers.splice(j, 1);
          spawnExplosion(b.x, b.y, u.z, b.color, 8);
          if (u.hp <= 0) {
            destroyed = true;
            break;
          } else {
            haptic('light');
          }
        }
      }

      if (destroyed) {
        S.kills++;
        S.score += (u.elite ? 150 : 100) + (S.wave - 1) * 15;
        S.shake = Math.max(S.shake, 0.16);
        haptic('medium');
        sfxExplosion(u.elite);
        spawnExplosion(u.x, u.y, u.z, u.elite ? 0xffb800 : 0xff2a85, 30);
        // Destroyed saucers drop glowing loot pickup to upgrade the gun
        spawnLoot(u.x, u.y, u.z);
        S.saucers.splice(i, 1);
        updateHUD();
        continue;
      }

      // Check collision with player ship at z = 0
      if (Math.abs(u.z) < 1.15 && Math.hypot(u.x - S.x, u.y - S.y) < 1.12) {
        spawnExplosion(u.x, u.y, u.z, 0xff2a85, 28);
        S.saucers.splice(i, 1);
        damagePlayer('saucer');
        continue;
      }

      if (u.z > 8) {
        S.saucers.splice(i, 1);
      }
    }

    // Update asteroids (rare hazards to dodge; collision = lose life)
    for (let i = S.asteroids.length - 1; i >= 0; i--) {
      const a = S.asteroids[i];
      a.z += a.vz * dt;
      a.rx += a.vrx * dt;
      a.ry += a.vry * dt;

      // Lasers spark off asteroids
      for (let j = S.lasers.length - 1; j >= 0; j--) {
        const b = S.lasers[j];
        if (Math.abs(b.z - a.z) < 1.8 && Math.hypot(b.x - a.x, b.y - a.y) < a.r + 0.25) {
          spawnExplosion(b.x, b.y, a.z, 0xff7b00, 6);
          S.lasers.splice(j, 1);
        }
      }

      // Ship-asteroid collision -> lose life
      if (Math.abs(a.z) < 1.15 && Math.hypot(a.x - S.x, a.y - S.y) < a.r + 0.42) {
        S.asteroids.splice(i, 1);
        damagePlayer('asteroid');
        continue;
      }

      if (a.z > 8) {
        S.asteroids.splice(i, 1);
      }
    }

    // Update loot pickups (with gentle magnetic pull near the ship)
    for (let i = S.loots.length - 1; i >= 0; i--) {
      const l = S.loots[i];
      l.z += l.vz * dt;
      l.rot += dt * 3.8;
      if (l.z > -22 && l.z < 2.5) {
        const dx = S.x - l.x, dy = S.y - l.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 2.9 && dist > 0.001) {
          const pull = (1 - dist / 2.9) * 9.5 * dt;
          l.x += (dx / dist) * pull;
          l.y += (dy / dist) * pull;
        }
      }
      if (Math.abs(l.z) < 1.65 && Math.hypot(l.x - S.x, l.y - S.y) < 1.25) {
        spawnExplosion(l.x, l.y, l.z, 0x39ff14, 18);
        S.loots.splice(i, 1);
        collectLoot();
        continue;
      }
      if (l.z > 7) {
        S.loots.splice(i, 1);
      }
    }

    if (Math.floor(S.t * 4) !== Math.floor((S.t - dt) * 4)) {
      if (sscore) sscore.textContent = '🎯 ' + Math.floor(S.score);
    }
  }

  // Update 3D scene buffers (stars, streaks, explosions)
  if (threeReady) {
    const spdMul = S.st === 'run' ? 1 + S.wave * 0.08 : 0.45;
    for (let i = 0; i < STAR_COUNT; i++) {
      let z = starPos[i * 3 + 2] + starSpeeds[i] * spdMul * dt;
      if (z > 9) {
        z = -135 - Math.random() * 15;
        starPos[i * 3] = (Math.random() - 0.5) * 44;
        starPos[i * 3 + 1] = (Math.random() - 0.5) * 34;
      }
      starPos[i * 3 + 2] = z;
    }
    starGeo.attributes.position.needsUpdate = true;

    for (let i = 0; i < STREAK_COUNT; i++) {
      let z = streakPos[i * 6 + 2] + 68 * spdMul * dt;
      if (z > 9) {
        z = -125 - Math.random() * 20;
        const x = (Math.random() - 0.5) * 26;
        const y = (Math.random() - 0.5) * 20;
        streakPos[i * 6] = x; streakPos[i * 6 + 1] = y;
        streakPos[i * 6 + 3] = x; streakPos[i * 6 + 4] = y;
      }
      streakPos[i * 6 + 2] = z;
      streakPos[i * 6 + 5] = z - 4.2;
    }
    streakGeo.attributes.position.needsUpdate = true;

    let anyExp = false;
    for (let i = 0; i < EXP_PARTICLES; i++) {
      const p = expData[i];
      if (p.life > 0) {
        p.life -= dt;
        anyExp = true;
        if (p.life <= 0) {
          expPos[i * 3 + 1] = -9999;
        } else {
          expPos[i * 3] += p.vx * dt;
          expPos[i * 3 + 1] += p.vy * dt;
          expPos[i * 3 + 2] += p.vz * dt;
        }
      }
    }
    if (anyExp) expGeo.attributes.position.needsUpdate = true;
  }
}

// ---- Rendering (Three.js WebGL + Fallback)
function drawThree() {
  const gCfg = GUN_LEVELS[S.gun] || GUN_LEVELS[1];

  // Camera follow & screen shake
  const sx = S.shake > 0 ? (Math.random() - 0.5) * 0.45 * S.shake : 0;
  const sy = S.shake > 0 ? (Math.random() - 0.5) * 0.45 * S.shake : 0;
  camera.position.x = S.x * 0.24 + sx;
  camera.position.y = 1.45 + S.y * 0.2 + sy;
  camera.lookAt(S.x * 0.35, S.y * 0.25, -24);

  // Nebula pulse
  for (const n of nebulae) {
    const s = n.baseScale * (1 + 0.08 * Math.sin(S.t * 0.7 + n.phase));
    n.sp.scale.set(s, s * 0.65, 1);
  }

  // Ship position, smooth banking, thrusters, aiming laser color
  shipGroup.position.set(S.x, S.y, 0);
  shipGroup.rotation.set(S.pitch, S.yaw, S.bank);

  const pulse = 0.58 + 0.22 * Math.sin(S.t * 28);
  thrusterL.scale.set(pulse, pulse, 1);
  thrusterR.scale.set(pulse, pulse, 1);

  if (S.invuln > 0) {
    shieldMesh.material.opacity = 0.35 + 0.35 * Math.sin(S.t * 26);
    shipGroup.visible = Math.floor(S.t * 18) % 2 === 0;
  } else {
    shieldMesh.material.opacity = 0;
    shipGroup.visible = true;
  }

  aimBeam.material.color.setHex(gCfg.color);
  aimGlow.material.color.setHex(gCfg.color);
  aimReticle.material.color.setHex(gCfg.color);

  // Snap aiming reticle distance to any saucer in line of sight
  let retZ = -32;
  for (const u of S.saucers) {
    if (Math.hypot(u.x - S.x, u.y - S.y) < 1.25 && u.z < -2 && u.z > retZ) {
      retZ = u.z;
    }
  }
  aimReticle.position.z = retZ;
  const rs = 0.8 + 0.2 * Math.sin(S.t * 14);
  aimReticle.scale.set(rs, rs, 1);

  // Sync pooled lasers
  for (let i = 0; i < LASER_POOL_SIZE; i++) {
    const item = laserPool[i];
    const b = S.lasers[i];
    if (b) {
      item.mesh.visible = true;
      item.mesh.position.set(b.x, b.y, b.z);
      item.mesh.scale.set(b.scale, 1, b.scale);
      item.mat.color.setHex(b.color);
      item.spr.material.color.setHex(b.color);
    } else {
      item.mesh.visible = false;
    }
  }

  // Sync pooled saucers
  for (let i = 0; i < SAUCER_POOL_SIZE; i++) {
    const item = saucerPool[i];
    const u = S.saucers[i];
    if (u) {
      item.grp.visible = true;
      item.grp.position.set(u.x, u.y, u.z);
      item.grp.rotation.y = S.t * 3.2 + u.phase;
      item.grp.rotation.z = Math.cos(S.t * u.freq + u.phase) * 0.22;
      const rimCol = u.hitFlash > 0 ? 0xffffff : u.elite ? 0xffb800 : 0xff2a85;
      item.rimMat.color.setHex(rimCol);
      item.glow.material.color.setHex(rimCol);
      item.domeMat.color.setHex(u.hitFlash > 0 ? 0xffffff : u.elite ? 0xff0055 : 0x00f5d4);
    } else {
      item.grp.visible = false;
    }
  }

  // Sync pooled asteroids
  for (let i = 0; i < ASTEROID_POOL_SIZE; i++) {
    const item = asteroidPool[i];
    const a = S.asteroids[i];
    if (a) {
      item.grp.visible = true;
      item.grp.position.set(a.x, a.y, a.z);
      item.grp.scale.setScalar(a.r);
      item.rock.rotation.set(a.rx, a.ry, a.rz);
    } else {
      item.grp.visible = false;
    }
  }

  // Sync pooled loot pickups
  for (let i = 0; i < LOOT_POOL_SIZE; i++) {
    const item = lootPool[i];
    const l = S.loots[i];
    if (l) {
      item.grp.visible = true;
      item.grp.position.set(l.x, l.y, l.z);
      item.core.rotation.set(l.rot, l.rot * 1.3, 0);
      item.ring.rotation.set(Math.PI / 3, l.rot * -1.5, 0);
      item.mat.color.setHex(l.color);
      item.halo.material.color.setHex(l.color);
    } else {
      item.grp.visible = false;
    }
  }

  renderer.render(scene, camera);
}

// Software 3D fallback if CDN or WebGL is unavailable in headless environment
function drawFallback() {
  if (!fallbackCtx) {
    try { fallbackCtx = scv.getContext('2d'); } catch (e) { return; }
  }
  if (!fallbackCtx) return;
  const cx = fallbackCtx;
  cx.save();
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.fillStyle = '#060316';
  cx.fillRect(0, 0, W, H);
  const f = H * 0.65;
  const proj = (x, y, z) => {
    const dz = Math.max(0.2, 7.2 - z);
    const s = f / dz;
    return { x: W / 2 + (x - S.x * 0.24) * s, y: H * 0.52 - (y - S.y * 0.2) * s, s };
  };
  const gCfg = GUN_LEVELS[S.gun] || GUN_LEVELS[1];
  // Aiming laser beam
  const p0 = proj(S.x, S.y, -0.5), p1 = proj(S.x, S.y, -85);
  cx.strokeStyle = gCfg.hex;
  cx.lineWidth = 2;
  cx.beginPath(); cx.moveTo(p0.x, p0.y); cx.lineTo(p1.x, p1.y); cx.stroke();
  // Saucers
  for (const u of S.saucers) {
    const p = proj(u.x, u.y, u.z);
    cx.fillStyle = u.elite ? '#ffb800' : '#ff2a85';
    cx.beginPath(); cx.ellipse(p.x, p.y, Math.max(3, p.s * 0.9), Math.max(2, p.s * 0.35), 0, 0, Math.PI * 2); cx.fill();
  }
  // Asteroids
  for (const a of S.asteroids) {
    const p = proj(a.x, a.y, a.z);
    cx.fillStyle = '#c2410c';
    cx.beginPath(); cx.arc(p.x, p.y, Math.max(3, p.s * a.r), 0, Math.PI * 2); cx.fill();
  }
  // Loot
  for (const l of S.loots) {
    const p = proj(l.x, l.y, l.z);
    cx.fillStyle = '#39ff14';
    cx.beginPath(); cx.arc(p.x, p.y, Math.max(3, p.s * 0.45), 0, Math.PI * 2); cx.fill();
  }
  // Ship
  const sp = proj(S.x, S.y, 0);
  cx.translate(sp.x, sp.y);
  cx.rotate(-S.bank);
  cx.fillStyle = '#00f0ff';
  cx.beginPath(); cx.moveTo(0, -16); cx.lineTo(-22, 14); cx.lineTo(22, 14); cx.closePath(); cx.fill();
  cx.restore();
}

function draw() {
  if (threeReady) drawThree();
  else if (threeFailed) drawFallback();
}

function loop(now) {
  if (!active) return;
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  step(dt);
  draw();
  raf = requestAnimationFrame(loop);
}

// ---- Controls: Right-thumb Virtual Joystick & Left-thumb Big FIRE Button + Keyboard
function updateJoystickFromClient(clientX, clientY) {
  if (!sjoy || !sknob) return;
  const r = sjoy.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const maxR = Math.max(24, r.width * 0.37);
  let dx = clientX - cx;
  let dy = clientY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist > maxR) {
    dx = (dx / dist) * maxR;
    dy = (dy / dist) * maxR;
  }
  sknob.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px))`;
  joyX = dx / maxR;
  joyY = -dy / maxR;
}

function resetJoystick() {
  joyId = null;
  joyX = 0;
  joyY = 0;
  if (sknob) sknob.style.transform = 'translate(-50%, -50%)';
}

if (sjoy) {
  sjoy.addEventListener('pointerdown', e => {
    e.preventDefault();
    joyId = e.pointerId;
    try { sjoy.setPointerCapture(e.pointerId); } catch (_) {}
    updateJoystickFromClient(e.clientX, e.clientY);
  });
  sjoy.addEventListener('pointermove', e => {
    if (e.pointerId !== joyId) return;
    e.preventDefault();
    updateJoystickFromClient(e.clientX, e.clientY);
  });
  const endJoy = e => {
    if (e.pointerId === joyId) resetJoystick();
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => sjoy.addEventListener(ev, endJoy));
}

if (sfire) {
  sfire.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { sfire.setPointerCapture(e.pointerId); } catch (_) {}
    if (S.st !== 'run') {
      if (S.st === 'idle' || performance.now() - (S.overAt || 0) > 500) start();
      return;
    }
    S.firing = true;
    sfire.classList.add('on');
    if (S.fireCd <= 0) fireVolley();
  });
  const stopFire = e => {
    e.preventDefault();
    S.firing = false;
    sfire.classList.remove('on');
  };
  ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach(ev => sfire.addEventListener(ev, stopFire));
}

if (sstart) {
  sstart.onclick = () => start();
}

addEventListener('keydown', e => {
  if (!active) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', 'ф', 'в', 'ц', 'ы', ' '].includes(k)) {
    keysDown.add(k);
    if (k === ' ' && S.st !== 'run' && (S.st === 'idle' || performance.now() - (S.overAt || 0) > 500)) {
      start();
    }
    e.preventDefault();
  }
});

addEventListener('keyup', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keysDown.delete(k);
});

window.PZS = {
  S,
  GUN_LEVELS,
  step,
  start,
  fireVolley,
  collectLoot,
  damagePlayer,
  enter() {
    active = true;
    S.st = 'idle';
    S.best = +(localStorage.getItem(LS_KEY) || 0);
    resetJoystick();
    keysDown.clear();
    S.firing = false;
    updateHUD();
    if (sover) sover.classList.remove('h');
    if (sotitle) sotitle.textContent = '🚀 Космос 3D';
    if (sotext) {
      sotext.textContent =
        '🕹 Правый палец — джойстик (вверх/вниз/влево/вправо)\n' +
        '🔥 Левый палец — зажми ОГОНЬ для автострельбы\n' +
        '🛸 Сбивай НЛО и лови кристаллы апгрейда пушки!\n' +
        '☄️ Уклоняйся от редких астероидов!\n' +
        '🏆 Рекорд: ' + S.best;
    }
    if (sstart) sstart.textContent = '▶ Старт';
    requestAnimationFrame(() => {
      size();
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    });
  },
  leave() {
    active = false;
    S.firing = false;
    resetJoystick();
    keysDown.clear();
    cancelAnimationFrame(raf);
    music(false);
  },
  toggleMusic() {
    S.music = !S.music;
    music(S.music);
    if (typeof toast === 'function') toast(S.music ? 'Музыка включена 🎶' : 'Музыка выключена');
  }
};
