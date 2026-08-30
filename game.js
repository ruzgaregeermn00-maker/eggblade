'use strict';
/* ==========================================================================
   EGGRIFT — game.js
   Level construction, entities, the rift mechanic, HUD and the main loop.
   ========================================================================== */

/* ------------------------------------------------------------------ input */
const Input = {
  left:false, right:false, up:false, down:false,
  jumpHeld:false, jumpEdge:false, attackEdge:false, shiftEdge:false,
  clearEdges(){ this.jumpEdge = this.attackEdge = this.shiftEdge = false; }
};

const KEYMAP = {
  ArrowLeft:'left', KeyA:'left',
  ArrowRight:'right', KeyD:'right',
  ArrowUp:'up', KeyW:'up',
  ArrowDown:'down', KeyS:'down'
};

function bindInput(canvas){
  addEventListener('keydown', e => {
    if(e.repeat) { if(KEYMAP[e.code]) e.preventDefault(); return; }
    const m = KEYMAP[e.code];
    if(m){ Input[m] = true; e.preventDefault(); }
    if(e.code === 'KeyW' || e.code === 'ArrowUp'){
      Input.jumpHeld = true; Input.jumpEdge = true; e.preventDefault();
    }
    if(e.code === 'Space' || e.code === 'KeyF'){ Input.attackEdge = true; e.preventDefault(); }
    if(e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') Input.shiftEdge = true;
    if(e.code === 'Escape' || e.code === 'KeyP') Game.togglePause();
    if(e.code === 'KeyM') Sfx.setMuted(!Sfx.muted);
    Sfx.resume();
  });
  addEventListener('keyup', e => {
    const m = KEYMAP[e.code];
    if(m) Input[m] = false;
    if(e.code === 'KeyW' || e.code === 'ArrowUp') Input.jumpHeld = false;
  });
  addEventListener('blur', () => {
    Input.left = Input.right = Input.up = Input.down = Input.jumpHeld = false;
    if(Game.state === 'play') Game.togglePause();
  });
  canvas.addEventListener('mousedown', e => {
    if(e.button === 0){ Input.attackEdge = true; Sfx.resume(); }
    e.preventDefault();
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  /* touch pad — only wired up when the device reports touch support */
  if('ontouchstart' in window || navigator.maxTouchPoints > 0){
    document.body.classList.add('touch');
    for(const b of document.querySelectorAll('.tbtn')){
      const key = b.dataset.key;
      const down = e => {
        e.preventDefault();
        b.classList.add('held');
        Sfx.resume();
        if(key === 'left') Input.left = true;
        else if(key === 'right') Input.right = true;
        else if(key === 'jump'){ Input.jumpHeld = true; Input.jumpEdge = true; }
        else if(key === 'attack') Input.attackEdge = true;
        else if(key === 'shift') Input.shiftEdge = true;
      };
      const up = e => {
        e.preventDefault();
        b.classList.remove('held');
        if(key === 'left') Input.left = false;
        else if(key === 'right') Input.right = false;
        else if(key === 'jump') Input.jumpHeld = false;
      };
      b.addEventListener('touchstart', down, { passive:false });
      b.addEventListener('touchend', up, { passive:false });
      b.addEventListener('touchcancel', up, { passive:false });
    }
  }
}

/* ------------------------------------------------------------ level build */
const COLS = 212, ROWS = 30, GY = 22;

const LB = {
  rect(x, y, w, h, t){
    for(let j = 0; j < h; j++) for(let i = 0; i < w; i++) World.set(x + i, y + j, t);
  },
  clear(x, y, w, h){ this.rect(x, y, w, h, TT.EMPTY); },
  col(x, y0, y1, t){ for(let y = y0; y <= y1; y++) World.set(x, y, t); }
};

/** Returns spawn metadata for the level; the grid itself lives in World. */
function buildLevel(){
  World.create(COLS, ROWS);
  const spawns = [];
  const hints = [];
  const checkpoints = [];

  /* bedrock everywhere, then carve */
  LB.rect(0, GY, COLS, ROWS - GY, TT.STONE);

  /* ---------- A: arrival ---------- */
  LB.rect(11, 19, 4, 1, TT.PLAT);
  LB.rect(18, 16, 4, 1, TT.PLAT);
  World.set(9, GY - 1, TT.LAMP);
  World.set(20, 15, TT.LAMP);
  for(let i = 3; i < 30; i += 4) World.set(i, GY - 1, TT.MOSS);
  hints.push({ x: 6 * TILE, y: (GY - 5) * TILE, text:'A / D ile yürü · W ile zıpla' });
  hints.push({ x: 22 * TILE, y: (GY - 6) * TILE, text:'Space veya sol tık: kılıç' });
  spawns.push({ type:'plant', x: 26 * TILE, y: (GY - 1) * TILE });

  /* ---------- B: vine wall (past-only climb) ---------- */
  LB.rect(35, 8, 3, GY - 8, TT.STONE);          // the wall
  LB.col(34, 9, GY - 1, TT.VINE);               // climbable face
  LB.rect(38, 8, 4, 1, TT.STONE);               // top ledge
  World.set(39, 7, TT.LAMP);
  LB.rect(43, 11, 4, 1, TT.PLAT);
  LB.rect(48, 14, 5, 1, TT.STONE);
  hints.push({ x: 32 * TILE, y: (GY - 6) * TILE, text:'Sarmaşık yalnızca geçmişte tırmanılır' });
  hints.push({ x: 40 * TILE, y: 5 * TILE, text:'Duvara yaslanıp W: duvar zıplaması' });
  spawns.push({ type:'plant', x: 45 * TILE, y: 10 * TILE });

  /* ---------- C: the shifting gap ---------- */
  checkpoints.push({ x: 54 * TILE, y: (GY - 3) * TILE });
  LB.clear(57, GY, 23, ROWS - GY);              // the pit
  LB.rect(57, 27, 23, 1, TT.SPIKE);
  LB.rect(59, 17, 3, 1, TT.RUIN);
  LB.rect(63, 14, 3, 1, TT.TECH);
  LB.rect(67, 17, 3, 1, TT.RUIN);
  LB.rect(71, 14, 3, 1, TT.TECH);
  LB.rect(75, 17, 3, 1, TT.RUIN);
  World.set(56, GY - 1, TT.LAMP);
  hints.push({ x: 55 * TILE, y: (GY - 6) * TILE, text:'E veya Shift: boyut değiştir — havada da çalışır' });

  /* ---------- D: laser corridor (alternate or die) ---------- */
  checkpoints.push({ x: 84 * TILE, y: (GY - 3) * TILE });
  LB.rect(84, 16, 30, 2, TT.STONE);             // ceiling
  for(const lx of [88, 94, 100, 106]) LB.col(lx, 18, GY - 1, TT.LASER);
  for(const rx of [91, 97, 103]) LB.rect(rx, 18, 1, GY - 18, TT.RUIN);
  World.set(86, 18, TT.LAMP);
  World.set(110, 18, TT.LAMP);
  hints.push({ x: 85 * TILE, y: 19 * TILE, text:'Geçmişte lazer yok, gelecekte harabe yok' });
  spawns.push({ type:'drone', x: 116 * TILE, y: 17 * TILE });

  /* ---------- E: descent and the wall-jump shaft ---------- */
  LB.clear(120, GY, 22, 4);                     // sunken floor
  LB.rect(120, 26, 22, ROWS - 26, TT.STONE);
  LB.rect(126, 19, 3, 1, TT.TECH);
  LB.rect(132, 21, 3, 1, TT.RUIN);
  LB.rect(137, 10, 1, 16, TT.STONE);            // shaft: left wall
  LB.rect(142, 8, 1, 18, TT.STONE);             // shaft: right wall
  LB.rect(138, 8, 4, 1, TT.STONE);              // shaft ceiling / exit ledge
  LB.clear(138, 9, 4, 17);
  LB.rect(143, 12, 6, 1, TT.PLAT);
  LB.rect(150, 15, 6, 1, TT.STONE);
  World.set(139, 24, TT.LAMP);
  spawns.push({ type:'drone', x: 123 * TILE, y: 18 * TILE });
  spawns.push({ type:'plant', x: 133 * TILE, y: 20 * TILE });
  hints.push({ x: 138 * TILE, y: 20 * TILE, text:'Duvara yaslan, W ile sek' });

  /* ---------- F: guardian arena ---------- */
  checkpoints.push({ x: 158 * TILE, y: (GY - 3) * TILE });
  LB.rect(205, 6, 2, GY - 6, TT.STONE);         // arena back wall
  LB.rect(166, 17, 4, 1, TT.RUIN);
  LB.rect(180, 17, 4, 1, TT.TECH);
  LB.rect(173, 13, 4, 1, TT.PLAT);
  for(const lx of [162, 172, 182, 192, 202]) World.set(lx, GY - 1, TT.MOSS);
  World.set(160, GY - 2, TT.LAMP);
  World.set(203, GY - 2, TT.LAMP);
  hints.push({ x: 159 * TILE, y: (GY - 6) * TILE, text:'Muhafızın çekirdeği açılınca vur' });

  /* Rift shards: optional collectibles, several tucked behind a shift. */
  const shards = [
    [13, 17], [20, 14], [34, 12], [44, 9],
    [61, 12], [69, 12], [89, 19], [102, 19],
    [127, 17], [139, 13], [146, 10], [174, 11]
  ].map(([tx, ty]) => ({ x: tx * TILE + 4, y: ty * TILE + 4 }));

  return {
    shards,
    playerSpawn: { x: 6 * TILE, y: (GY - 4) * TILE },
    bossSpawn:   { x: 192 * TILE, y: (GY - 4) * TILE },
    bossTrigger: 162 * TILE,
    spawns, hints, checkpoints
  };
}

/* ------------------------------------------------------------- entities */
let seedCounter = 0;

function makePlayer(x, y){
  return {
    x, y, w:12, h:18, vx:0, vy:0,
    face:1, onGround:false, wallDir:0, hitCeil:false, dropThrough:false,
    hp:100, maxHp:100, iframes:0, hurtFlash:0,
    coyote:0, jumpBuf:0, climbing:false, wallSlide:false,
    attackT:0, attackDur:.26, attackHits:null, attackCd:0,
    animRun:0, dead:false
  };
}

function makePlant(x, y){
  return { type:'plant', x, y, w:14, h:15, vx:0, vy:0, face:-1,
           hp:30, maxHp:30, hurtT:0, lungeT:0, cool:rand(.5,1.6),
           onGround:false, wallDir:0, seed:++seedCounter, dead:false, dim:DIM_PAST };
}
function makeDrone(x, y){
  return { type:'drone', x, y, w:14, h:12, vx:26, vy:0, face:1, baseY:y,
           hp:25, maxHp:25, hurtT:0, chargeT:0, cool:rand(.6,1.8),
           onGround:false, wallDir:0, seed:++seedCounter, dead:false, dim:DIM_FUTURE };
}
function makeBoss(x, y){
  return { type:'boss', x, y, w:44, h:56, vx:0, vy:0, face:-1,
           hp:320, maxHp:320, hurtT:0, onGround:false, wallDir:0,
           phase:1, state:'idle', stateT:1.2, telegraphT:0, vulnT:0,
           attackName:'', seed:++seedCounter, dead:false, active:false };
}
function makeShard(x, y){
  return { kind:'shard', x, y, w:8, h:8, vy:0, bob:rand(0, 6.28), taken:false, grounded:true };
}
function makeHeart(x, y){
  return { kind:'heart', x, y, w:8, h:8, vy:-120, vx:rand(-40, 40), bob:rand(0, 6.28),
           taken:false, grounded:false, life:0 };
}
function makeProjectile(x, y, vx, vy, kind, dim, dmg, grav){
  return { x, y, w:5, h:5, vx, vy, kind, dim, dmg, grav: grav || 0, life:0, max:4, dead:false };
}

/* --------------------------------------------------------------- storage */
const SAVE_KEY = 'eggrift.save.v1';
function loadSave(){
  try{ return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; }
  catch(e){ return {}; }          // private mode / corrupt data: just play on
}
function storeSave(rec){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(rec)); }catch(e){}
}
function fmtTime(sec){
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ game */
const Game = {
  state:'title',
  time:0, acc:0, last:0,
  dim: DIM_PAST,
  player:null, enemies:[], projectiles:[], particles:[], boss:null,
  level:null,
  warpT:0, warpX:0, warpY:0,
  shiftCd:0, shiftBlockT:0,
  checkpoint:null, checkpointIdx:-1,
  hintText:'', hintAlpha:0,
  hpShown:100, hpGhost:100,
  beamT:0, beamY:0, beamDir:1,
  fps:60, fpsAcc:0, fpsN:0, fpsT:0,
  kills:0, shifts:0, runTime:0, deaths:0,
  pickups:[], shards:0, save:{},

  init(){
    const canvas = document.getElementById('screen');
    R.init(canvas);
    bindInput(canvas);
    this.level = buildLevel();
    this.reset();
    this.showOverlay('ovTitle');

    this.save = loadSave();
    this.refreshBestLine();
    const soundBtns = ['btnSound', 'btnSound2'].map(id => document.getElementById(id));
    const syncSound = () => soundBtns.forEach(b => { if(b) b.textContent = `Ses: ${Sfx.muted ? 'kapalı' : 'açık'}`; });
    soundBtns.forEach(b => { if(b) b.onclick = () => { Sfx.init(); Sfx.setMuted(!Sfx.muted); syncSound(); }; });
    this.syncSound = syncSound;
    syncSound();

    document.getElementById('btnStart').onclick = () => this.start();
    document.getElementById('btnResume').onclick = () => this.togglePause();
    document.getElementById('btnRestart').onclick = () => { this.reset(); this.start(); };
    document.getElementById('btnRespawn').onclick = () => this.respawn();
    document.getElementById('btnAgain').onclick = () => { this.reset(); this.start(); };

    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  },

  reset(){
    const L = this.level;
    this.dim = World.dim = DIM_PAST;
    this.player = makePlayer(L.playerSpawn.x, L.playerSpawn.y);
    this.enemies = L.spawns.map(s => s.type === 'plant' ? makePlant(s.x, s.y) : makeDrone(s.x, s.y));
    this.projectiles = [];
    this.particles = [];
    this.boss = makeBoss(L.bossSpawn.x, L.bossSpawn.y);
    this.checkpoint = { x: L.playerSpawn.x, y: L.playerSpawn.y };
    this.checkpointIdx = -1;
    this.warpT = 0; this.shiftCd = 0; this.shiftBlockT = 0;
    this.hpShown = this.hpGhost = 100;
    this.beamT = 0;
    this.kills = 0; this.shifts = 0; this.runTime = 0; this.deaths = 0;
    this.pickups = L.shards.map(s => makeShard(s.x, s.y));
    this.shards = 0;
    R.cam.x = clamp(this.player.x - VIEW_W / 2, 0, COLS * TILE - VIEW_W);
    R.cam.y = clamp(this.player.y - VIEW_H / 2, 0, ROWS * TILE - VIEW_H);
    R.cam.shake = 0;
  },

  refreshBestLine(){
    const el = document.getElementById('bestLine');
    if(!el) return;
    el.textContent = this.save.bestTime
      ? `En iyi: ${fmtTime(this.save.bestTime)} · ${this.save.bestShards || 0}/12 yarık kırığı`
      : '';
  },
  showOverlay(id){
    for(const el of document.querySelectorAll('.overlay')) el.classList.toggle('on', el.id === id);
  },

  start(){
    Sfx.init(); Sfx.resume(); Sfx.ui();
    this.state = 'play';
    this.showOverlay(null);
  },
  togglePause(){
    if(this.state === 'play'){ this.state = 'pause'; this.showOverlay('ovPause'); }
    else if(this.state === 'pause'){ this.state = 'play'; this.showOverlay(null); }
    if(this.state === 'pause'){
      const el = document.getElementById('pauseStats');
      if(el) el.textContent = `Süre ${fmtTime(this.runTime)} · ${this.shards}/12 kırık · ${this.kills} düşman`;
    }
  },
  respawn(){
    const p = this.player;
    p.x = this.checkpoint.x; p.y = this.checkpoint.y;
    p.vx = p.vy = 0; p.hp = p.maxHp; p.dead = false; p.iframes = 1.2;
    this.hpShown = this.hpGhost = p.maxHp;
    this.projectiles.length = 0;
    /* enemies near the checkpoint come back so the run stays winnable */
    for(const e of this.enemies) if(e.dead && Math.abs(e.x - p.x) > 260){ e.dead = false; e.hp = e.maxHp; }
    if(this.boss.active && !this.boss.dead){ this.boss.hp = this.boss.maxHp; this.boss.state = 'idle'; this.boss.stateT = 1.4; }
    this.state = 'play';
    this.showOverlay(null);
  },

  /* --------------------------------------------------------- rift shift */
  tryShift(){
    const p = this.player;
    if(this.shiftCd > 0) return;
    const target = this.dim === DIM_PAST ? DIM_FUTURE : DIM_PAST;
    /* the knight cannot materialise inside matter: nudge, else refuse */
    let ok = !rectSolid(p.x, p.y, p.w, p.h, target);
    if(!ok){
      const nudges = [[0,-2],[0,-4],[0,-6],[2,0],[-2,0],[4,0],[-4,0],[0,2]];
      for(const [dx, dy] of nudges){
        if(!rectSolid(p.x + dx, p.y + dy, p.w, p.h, target)){
          p.x += dx; p.y += dy; ok = true; break;
        }
      }
    }
    if(!ok){
      this.shiftBlockT = .4;
      this.shiftCd = .25;
      Sfx.shiftBlocked();
      return;
    }
    this.dim = World.dim = target;
    this.shiftCd = .32;
    this.shifts++;
    this.warpT = 1;
    this.warpX = p.x + p.w / 2;
    this.warpY = p.y + p.h / 2;
    R.cam.shake = Math.max(R.cam.shake, 3);
    Sfx.shift(target);
    const col = target === DIM_PAST ? '#8ed24e' : '#37e6ff';
    for(let i = 0; i < 26; i++){
      const a = rand(0, Math.PI * 2), s = rand(40, 180);
      this.particles.push({ x:this.warpX, y:this.warpY, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
                            life:0, max:rand(.3,.7), s:2, col, glow:true, grav:0 });
    }
  },

  /* --------------------------------------------------------- combat bits */
  playerAttack(){
    const p = this.player;
    if(p.attackCd > 0 || p.attackT > 0) return;
    p.attackT = p.attackDur;
    p.attackCd = .3;
    p.attackHits = new Set();
    Sfx.slash();
  },
  attackBox(){
    const p = this.player;
    const w = 20, h = p.h + 4;
    return { x: p.face > 0 ? p.x + p.w - 2 : p.x - w + 2, y: p.y - 2, w, h };
  },
  hurtPlayer(dmg, fromX){
    const p = this.player;
    if(p.iframes > 0 || p.dead) return;
    p.hp -= dmg;
    p.iframes = 1;
    p.hurtFlash = 1;
    this.hpGhost = Math.max(this.hpGhost, this.hpShown);
    p.vy = -170;
    p.vx = (p.x + p.w / 2 < fromX ? -1 : 1) * 150;
    R.cam.shake = Math.max(R.cam.shake, 5);
    Sfx.hurt();
    this.burst(p.x + p.w / 2, p.y + p.h / 2, '#ff6b6b', 12);
    if(p.hp <= 0){
      p.hp = 0; p.dead = true;
      this.deaths++;
      this.state = 'dead';
      Sfx.die();
      this.burst(p.x + p.w / 2, p.y + p.h / 2, '#ffd0d0', 30);
      setTimeout(() => { if(this.state === 'dead') this.showOverlay('ovDead'); }, 550);
    }
  },
  burst(x, y, col, n, spd){
    for(let i = 0; i < n; i++){
      const a = rand(0, Math.PI * 2), s = rand(30, spd || 150);
      this.particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s - 30,
                            life:0, max:rand(.25,.7), s:randInt(1,2), col, glow:Math.random() < .4, grav:320 });
    }
  },

  /* ------------------------------------------------------------- update */
  update(dt){
    this.time += dt;
    R.time = this.time;
    this.runTime += dt;
    const p = this.player;

    if(this.warpT > 0) this.warpT = Math.max(0, this.warpT - dt * 2.4);
    if(this.shiftCd > 0) this.shiftCd -= dt;
    if(this.shiftBlockT > 0) this.shiftBlockT -= dt;
    if(p.hurtFlash > 0) p.hurtFlash -= dt * 2;

    if(Input.shiftEdge) this.tryShift();
    if(Input.attackEdge) this.playerAttack();

    if(!p.dead) this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.updateHud(dt);

    /* checkpoints */
    this.level.checkpoints.forEach((c, i) => {
      if(i > this.checkpointIdx && p.x > c.x){
        this.checkpointIdx = i;
        this.checkpoint = { x:c.x, y:c.y };
        Sfx.checkpoint();
        this.burst(c.x + 6, c.y + 8, '#ffe27a', 16);
      }
    });

    /* hints */
    let near = null;
    for(const h of this.level.hints){
      if(Math.abs(p.x - h.x) < 92 && Math.abs(p.y - h.y) < 140){ near = h; break; }
    }
    if(near){ this.hintText = near.text; this.hintAlpha = Math.min(1, this.hintAlpha + dt * 3); }
    else this.hintAlpha = Math.max(0, this.hintAlpha - dt * 3);

    /* boss gate */
    if(!this.boss.active && p.x > this.level.bossTrigger){
      this.boss.active = true;
      Sfx.bossRoar();
      R.cam.shake = 7;
    }
    Input.clearEdges();
  },

  updatePlayer(dt){
    const p = this.player;
    const A = 1500, MAX = 104, FRIC = 1400;
    const GRAV = 900, FALL_MAX = 340;

    if(p.iframes > 0) p.iframes -= dt;
    if(p.attackCd > 0) p.attackCd -= dt;
    if(p.attackT > 0){
      p.attackT -= dt;
      const k = 1 - p.attackT / p.attackDur;
      if(k > .15 && k < .8) this.resolveAttack();
      if(p.attackT <= 0) p.attackHits = null;
    }

    /* --- climbing overrides normal locomotion --- */
    const onVine = rectClimbable(p.x, p.y, p.w, p.h, this.dim);
    p.climbing = onVine && (Input.up || Input.down || p.climbing) && !p.onGround;
    if(onVine && (Input.up || Input.down)) p.climbing = true;
    if(!onVine) p.climbing = false;

    const dir = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
    if(dir !== 0) p.face = dir;

    if(p.climbing){
      p.vy = (Input.down ? 78 : 0) - (Input.up ? 78 : 0);
      p.vx = dir * 52;
      if(Input.jumpEdge){
        p.climbing = false;
        p.vy = -300;
        p.vx = dir * 120;
        Sfx.jump();
      }
    } else {
      /* horizontal */
      if(dir !== 0){
        p.vx += dir * A * dt;
        p.vx = clamp(p.vx, -MAX, MAX);
      } else {
        const d = FRIC * dt;
        p.vx = Math.abs(p.vx) <= d ? 0 : p.vx - Math.sign(p.vx) * d;
      }

      /* gravity + wall slide */
      p.wallSlide = !p.onGround && p.wallDir !== 0 && dir === p.wallDir && p.vy > 0;
      p.vy += GRAV * dt;
      if(p.wallSlide) p.vy = Math.min(p.vy, 74);
      p.vy = Math.min(p.vy, FALL_MAX);

      /* jump: coyote time + input buffer + variable height */
      if(p.onGround) p.coyote = .1; else p.coyote -= dt;
      if(Input.jumpEdge) p.jumpBuf = .12; else p.jumpBuf -= dt;

      if(p.jumpBuf > 0){
        if(p.coyote > 0){
          p.vy = -308; p.coyote = 0; p.jumpBuf = 0;
          Sfx.jump();
          this.burst(p.x + p.w / 2, p.y + p.h, '#cfe8b0', 6, 80);
        } else if(p.wallDir !== 0 && !p.onGround){
          p.vy = -292;
          p.vx = -p.wallDir * 190;
          p.face = -p.wallDir;
          p.jumpBuf = 0;
          Sfx.jump();
          this.burst(p.x + (p.wallDir > 0 ? p.w : 0), p.y + p.h / 2, '#cfe8b0', 8, 110);
        }
      }
      if(!Input.jumpHeld && p.vy < -120) p.vy = -120;   // release to cut the jump short
    }

    p.dropThrough = Input.down && !p.climbing;
    const wasAir = !p.onGround;
    moveEntity(p, dt, this.dim);
    if(p.onGround && wasAir && p.vy >= 0) Sfx.land();
    if(p.onGround) p.animRun += Math.abs(p.vx) * dt * .02;

    /* hazards + pit */
    if(rectHazard(p.x + 2, p.y + 2, p.w - 4, p.h - 4, this.dim)){
      this.hurtPlayer(this.dim === DIM_FUTURE ? 22 : 26, p.x + p.w / 2 + p.face * 10);
      Sfx.laser();
    }
    if(p.y > ROWS * TILE + 40) this.hurtPlayer(999, p.x);
  },

  resolveAttack(){
    const p = this.player, box = this.attackBox();
    for(const e of this.enemies){
      if(e.dead || e.dim !== this.dim || p.attackHits.has(e)) continue;
      if(rectsOverlap(box, e)){
        p.attackHits.add(e);
        e.hp -= 14;
        e.hurtT = .18;
        e.vx += p.face * 90;
        Sfx.hitEnemy();
        this.burst(e.x + e.w / 2, e.y + e.h / 2, '#ffffff', 8, 120);
        if(e.hp <= 0){
          e.dead = true;
          this.kills++;
          if(Math.random() < .35) this.pickups.push(makeHeart(e.x + e.w / 2 - 4, e.y + e.h / 2));
          Sfx.kill();
          this.burst(e.x + e.w / 2, e.y + e.h / 2, e.type === 'plant' ? '#7cc44a' : '#ff8ba0', 20);
        }
      }
    }
    /* the blade knocks hostile shots out of the air */
    for(const pr of this.projectiles){
      if(pr.dead || p.attackHits.has(pr)) continue;
      if(rectsOverlap(box, pr)){
        p.attackHits.add(pr);
        pr.dead = true;
        this.burst(pr.x, pr.y, '#ffffff', 8, 130);
        Sfx.hitEnemy();
      }
    }
    /* the guardian: only the exposed core takes damage */
    const b = this.boss;
    if(b.active && !b.dead && !p.attackHits.has(b) && rectsOverlap(box, b)){
      p.attackHits.add(b);
      if(b.vulnT > 0){
        b.hp -= 18;
        b.hurtT = .2;
        Sfx.hitEnemy();
        this.burst(b.x + b.w / 2, b.y + b.h * .5, '#ff8de0', 14, 170);
        R.cam.shake = Math.max(R.cam.shake, 3);
        if(b.hp <= 0) this.killBoss();
      } else {
        Sfx.shiftBlocked();
        this.burst(p.face > 0 ? b.x : b.x + b.w, p.y + 6, '#ffe27a', 8, 120);
      }
    }
  },

  killBoss(){
    const b = this.boss;
    b.dead = true; b.hp = 0;
    Sfx.win();
    R.cam.shake = 10;
    for(let i = 0; i < 60; i++){
      const a = rand(0, Math.PI * 2), s = rand(40, 260);
      this.particles.push({ x:b.x + b.w / 2, y:b.y + b.h / 2, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
                            life:0, max:rand(.4,1.2), s:randInt(1,3),
                            col: Math.random() < .5 ? '#ff8de0' : '#ffe27a', glow:true, grav:200 });
    }
    setTimeout(() => {
      if(this.state !== 'play') return;
      this.state = 'win';
      const prevT = this.save.bestTime, prevS = this.save.bestShards || 0;
      const recordTime = !prevT || this.runTime < prevT;
      const recordShards = this.shards > prevS;
      this.save.bestTime = recordTime ? this.runTime : prevT;
      this.save.bestShards = Math.max(prevS, this.shards);
      this.save.runs = (this.save.runs || 0) + 1;
      storeSave(this.save);
      this.refreshBestLine();
      const flag = recordTime ? '  ★ yeni rekor' : '';
      document.getElementById('winStats').textContent =
        `Süre ${fmtTime(this.runTime)}${flag} · ${this.shards}/12 yarık kırığı · ` +
        `${this.kills} düşman · ${this.shifts} geçiş · ${this.deaths} ölüm`;
      this.showOverlay('ovWin');
    }, 1100);
  },

  /* ------------------------------------------------------------ enemies */
  updateEnemies(dt){
    const p = this.player;
    for(const e of this.enemies){
      if(e.dead) continue;
      const active = e.dim === this.dim;
      if(e.hurtT > 0) e.hurtT -= dt;

      if(e.type === 'plant'){
        if(active){
          e.vy += 900 * dt;
          if(e.lungeT > 0){
            e.lungeT -= dt;
          } else {
            e.cool -= dt;
            const near = Math.abs(p.x - e.x) < 60 && Math.abs(p.y - e.y) < 34;
            if(near && e.cool <= 0 && e.onGround){
              e.lungeT = .45;
              e.cool = rand(1.1, 2);
              e.face = p.x < e.x ? -1 : 1;
              e.vx = e.face * 150;
              e.vy = -170;
            } else if(e.onGround){
              /* patrol, turning at ledges and walls */
              e.vx = e.face * 26;
              const probeX = e.face > 0 ? e.x + e.w + 2 : e.x - 3;
              if(!groundAhead(probeX, e.y, 2, e.h, this.dim, 6) || e.wallDir === e.face) e.face *= -1;
            }
          }
          moveEntity(e, dt, this.dim);
          if(e.onGround && e.lungeT <= 0) e.vx *= .8;
        }
      } else { /* drone */
        if(active){
          e.vy = 0;
          const dx = p.x - e.x, dy = p.y - e.y;
          if(e.chargeT > 0){
            e.chargeT -= dt;
            e.vx *= .82;
            if(e.chargeT <= 0){
              const d = Math.hypot(dx, dy) || 1;
              this.projectiles.push(makeProjectile(e.x + e.w / 2, e.y + e.h / 2,
                dx / d * 175, dy / d * 175, 'bolt', DIM_FUTURE, 16));
              Sfx.laser();
            }
          } else {
            e.cool -= dt;
            if(Math.abs(dx) < 150 && Math.abs(dy) < 90 && e.cool <= 0){
              e.chargeT = .55;
              e.cool = rand(1.4, 2.4);
              e.face = dx < 0 ? -1 : 1;
            } else {
              e.vx = e.face * 34;
              const probeX = e.face > 0 ? e.x + e.w + 3 : e.x - 4;
              if(rectSolid(probeX, e.y, 2, e.h, this.dim)) e.face *= -1;
              /* drift back toward the patrol height */
              e.y += (e.baseY - e.y) * Math.min(1, dt * 2);
            }
          }
          e.x += e.vx * dt;
          if(rectSolid(e.x, e.y, e.w, e.h, this.dim)){ e.x -= e.vx * dt; e.face *= -1; }
        }
      }

      /* contact damage only in the dimension the creature belongs to */
      if(active && rectsOverlap(p, e) && p.iframes <= 0 && !p.dead){
        this.hurtPlayer(e.type === 'plant' ? 14 : 12, e.x + e.w / 2);
      }
    }
  },

  /* --------------------------------------------------------------- boss */
  updateBoss(dt){
    const b = this.boss, p = this.player;
    if(!b.active || b.dead) return;
    if(b.hurtT > 0) b.hurtT -= dt;
    if(b.vulnT > 0) b.vulnT -= dt;
    if(b.telegraphT > 0) b.telegraphT -= dt;

    /* phase escalation */
    const frac = b.hp / b.maxHp;
    const newPhase = frac > .66 ? 1 : frac > .33 ? 2 : 3;
    if(newPhase !== b.phase){
      b.phase = newPhase;
      Sfx.bossRoar();
      R.cam.shake = 8;
      this.burst(b.x + b.w / 2, b.y + b.h / 2, '#ffe27a', 26, 200);
    }
    const speedUp = 1 + (b.phase - 1) * .28;

    b.face = p.x + p.w / 2 < b.x + b.w / 2 ? -1 : 1;
    b.vy += 900 * dt;
    b.stateT -= dt * speedUp;

    switch(b.state){
      case 'idle': {
        /* stalk the knight */
        const dx = (p.x + p.w / 2) - (b.x + b.w / 2);
        b.vx = clamp(dx, -1, 1) * (Math.abs(dx) > 60 ? 34 : 0) * speedUp;
        if(b.stateT <= 0){
          b.state = 'telegraph';
          b.stateT = .7;
          b.telegraphT = .7;
          /* the attack is chosen by the dimension the player is standing in */
          b.attackName = this.dim === DIM_PAST
            ? (Math.random() < .5 ? 'slam' : 'spores')
            : (Math.random() < .5 ? 'beam' : 'drones');
          Sfx.bossRoar();
        }
        break;
      }
      case 'telegraph': {
        b.vx *= .8;
        if(b.stateT <= 0){ this.bossAttack(); b.state = 'recover'; b.stateT = .55; }
        break;
      }
      case 'recover': {
        b.vx *= .85;
        if(b.stateT <= 0){
          b.state = 'open';
          b.stateT = 2.3;
          b.vulnT = 2.3;
        }
        break;
      }
      case 'open': {
        b.vx *= .9;
        if(b.stateT <= 0){ b.state = 'idle'; b.stateT = rand(.9, 1.5); }
        break;
      }
    }

    moveEntity(b, dt, this.dim);

    /* sweeping beam (future attack) lives on after the swing */
    if(this.beamT > 0){
      this.beamT -= dt;
      const bx = { x: 0, y: this.beamY - 3, w: COLS * TILE, h: 7 };
      if(rectsOverlap(p, bx) && p.iframes <= 0) this.hurtPlayer(20, b.x + b.w / 2);
    }

    if(rectsOverlap(p, b) && p.iframes <= 0 && !p.dead) this.hurtPlayer(18, b.x + b.w / 2);
  },

  bossAttack(){
    const b = this.boss, p = this.player;
    switch(b.attackName){
      case 'slam': {
        b.vy = -260;
        Sfx.bossSlam();
        R.cam.shake = 9;
        /* shockwave along the floor */
        for(let i = 0; i < 34; i++){
          const dir = i % 2 ? 1 : -1;
          this.particles.push({ x:b.x + b.w / 2, y:b.y + b.h - 2,
                                vx:dir * rand(60, 300), vy:rand(-140, -30),
                                life:0, max:rand(.3,.8), s:randInt(1,3), col:'#8ed24e', glow:true, grav:420 });
        }
        if(Math.abs((p.x + p.w / 2) - (b.x + b.w / 2)) < 96 && p.onGround) this.hurtPlayer(22, b.x + b.w / 2);
        break;
      }
      case 'spores': {
        Sfx.bossRoar();
        for(let i = 0; i < 3 + b.phase; i++){
          const vx = b.face * rand(60, 150), vy = rand(-260, -170);
          this.projectiles.push(makeProjectile(b.x + b.w / 2, b.y + 14, vx, vy, 'spore', DIM_PAST, 16, 520));
        }
        break;
      }
      case 'beam': {
        Sfx.laser();
        this.beamT = .45;
        this.beamY = p.y + p.h / 2;
        R.cam.shake = 6;
        break;
      }
      case 'drones': {
        Sfx.laser();
        for(let i = 0; i < 2; i++){
          const d = makeDrone(b.x + rand(-40, 40), b.y - 20 - i * 16);
          d.baseY = d.y;
          this.enemies.push(d);
        }
        break;
      }
    }
  },

  /* -------------------------------------------------------- projectiles */
  updateProjectiles(dt){
    const p = this.player;
    for(const pr of this.projectiles){
      if(pr.dead) continue;
      pr.life += dt;
      pr.vy += pr.grav * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if(pr.life > pr.max || rectSolid(pr.x, pr.y, pr.w, pr.h, this.dim)){
        pr.dead = true;
        this.burst(pr.x, pr.y, pr.kind === 'spore' ? '#8ed24e' : '#ff8ba0', 6, 90);
        continue;
      }
      /* a shot fired in one dimension cannot hit you in the other */
      if(pr.dim === this.dim && rectsOverlap(p, pr) && p.iframes <= 0 && !p.dead){
        pr.dead = true;
        this.hurtPlayer(pr.dmg, pr.x);
      }
    }
    this.projectiles = this.projectiles.filter(pr => !pr.dead);
  },

  updatePickups(dt){
    const p = this.player;
    for(const q of this.pickups){
      if(q.taken) continue;
      q.bob += dt * 3;
      if(!q.grounded){
        q.life += dt;
        q.vy += 620 * dt;
        q.x += (q.vx || 0) * dt;
        q.y += q.vy * dt;
        if(rectSolid(q.x, q.y, q.w, q.h, this.dim)){
          q.y = Math.floor((q.y + q.h) / TILE) * TILE - q.h - .01;
          q.vy = 0; q.vx = 0; q.grounded = true;
        }
        if(q.y > ROWS * TILE + 40) q.taken = true;
      }
      if(rectsOverlap(p, q) && !p.dead){
        q.taken = true;
        if(q.kind === 'shard'){
          this.shards++;
          Sfx.pickup();
          this.burst(q.x + 4, q.y + 4, '#9ff2ff', 16, 120);
        } else {
          p.hp = Math.min(p.maxHp, p.hp + 25);
          Sfx.checkpoint();
          this.burst(q.x + 4, q.y + 4, '#7cffa8', 12, 110);
        }
      }
    }
    /* hearts are transient; shards stay until collected */
    this.pickups = this.pickups.filter(q => !q.taken && !(q.kind === 'heart' && q.life > 12));
  },

  updateParticles(dt){
    for(const q of this.particles){
      q.life += dt;
      q.vy += (q.grav || 0) * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    this.particles = this.particles.filter(q => q.life < q.max);
    if(this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  },

  updateCamera(dt){
    const p = this.player;
    const tx = clamp(p.x + p.w / 2 - VIEW_W / 2 + p.face * 26, 0, COLS * TILE - VIEW_W);
    /* bias the view upward: the play space is above ground, not below it */
    const ty = clamp(p.y + p.h / 2 - VIEW_H * .62, 0, ROWS * TILE - VIEW_H);
    R.cam.x = lerp(R.cam.x, tx, 1 - Math.pow(.0015, dt));
    R.cam.y = lerp(R.cam.y, ty, 1 - Math.pow(.004, dt));
    if(R.cam.shake > 0) R.cam.shake = Math.max(0, R.cam.shake - dt * 22);
  },

  updateHud(dt){
    const p = this.player;
    this.hpShown = lerp(this.hpShown, p.hp, 1 - Math.pow(.001, dt));
    if(Math.abs(this.hpShown - p.hp) < .4) this.hpShown = p.hp;
    if(this.hpGhost > this.hpShown) this.hpGhost = Math.max(this.hpShown, this.hpGhost - 46 * dt);
    else this.hpGhost = this.hpShown;
  },

  /* ------------------------------------------------------------- render */
  render(){
    const x = R.x;
    const shakeX = R.cam.shake ? rand(-R.cam.shake, R.cam.shake) : 0;
    const shakeY = R.cam.shake ? rand(-R.cam.shake, R.cam.shake) : 0;
    const camX = R.cam.x, camY = R.cam.y;
    R.cam.x += shakeX; R.cam.y += shakeY;

    R.drawBackground(this.dim, 1 / 60);
    R.drawWorld(this.dim);

    /* entities */
    for(const e of this.enemies){
      if(e.dead) continue;
      if(e.type === 'plant') R.drawPlant(e, this.dim); else R.drawDrone(e, this.dim);
    }
    if(this.boss.active && !this.boss.dead) R.drawBoss(this.boss, this.dim);
    for(const q of this.pickups) R.drawPickup(q, this.dim);
    for(const pr of this.projectiles) R.drawProjectile(pr, this.dim);
    if(!this.player.dead) R.drawPlayer(this.player, this.dim);
    R.drawParticles(this.particles);

    /* guardian beam */
    if(this.beamT > 0){
      const a = clamp(this.beamT / .45, 0, 1);
      x.save();
      x.globalCompositeOperation = 'lighter';
      x.fillStyle = `rgba(255,43,74,${.35 + .5 * a})`;
      x.fillRect(0, Math.round(this.beamY - camY - 3), VIEW_W, 7);
      x.fillStyle = `rgba(255,220,230,${.6 * a})`;
      x.fillRect(0, Math.round(this.beamY - camY - 1), VIEW_W, 2);
      x.restore();
    }

    R.flushLights();
    R.grade(this.dim);

    R.cam.x = camX; R.cam.y = camY;

    if(this.warpT > 0) R.applyWarp(this.warpT, this.dim, this.warpX, this.warpY);
    this.drawHud();
  },

  drawHud(){
    const x = R.x, p = this.player;
    const past = this.dim === DIM_PAST;
    const accent = past ? '#8ed24e' : '#37e6ff';
    const accentDim = past ? '#3f6b26' : '#1b5f70';

    /* panel */
    x.save();
    x.fillStyle = 'rgba(6,12,10,.72)';
    x.fillRect(4, 4, 124, 36);
    x.strokeStyle = accentDim;
    x.lineWidth = 1;
    x.strokeRect(4.5, 4.5, 123, 35);
    x.fillStyle = accent;
    x.fillRect(4, 4, 124, 1);
    x.restore();

    /* avatar plate */
    x.fillStyle = past ? 'rgba(60,110,40,.35)' : 'rgba(20,90,110,.35)';
    x.fillRect(7, 7, 26, 30);
    R.drawAvatar(7, 8, this.dim, Math.max(0, p.hurtFlash));

    /* health bar with a lagging damage ghost */
    const bx = 37, by = 11, bw = 84, bh = 8;
    x.fillStyle = '#0c1410';
    x.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    x.fillStyle = 'rgba(255,80,80,.75)';
    x.fillRect(bx, by, bw * (this.hpGhost / p.maxHp), bh);
    const frac = clamp(this.hpShown / p.maxHp, 0, 1);
    const g = x.createLinearGradient(bx, 0, bx + bw, 0);
    if(frac > .5){ g.addColorStop(0, '#3ddc84'); g.addColorStop(1, '#9dff62'); }
    else if(frac > .25){ g.addColorStop(0, '#ffb648'); g.addColorStop(1, '#ffe27a'); }
    else { g.addColorStop(0, '#ff4d4d'); g.addColorStop(1, '#ff9a6b'); }
    x.fillStyle = g;
    x.fillRect(bx, by, bw * frac, bh);
    /* gloss + hit flash */
    x.fillStyle = 'rgba(255,255,255,.18)';
    x.fillRect(bx, by, bw * frac, 2);
    if(p.hurtFlash > 0){
      x.save();
      x.globalAlpha = Math.max(0, p.hurtFlash) * .8;
      x.fillStyle = '#ffffff';
      x.fillRect(bx, by, bw, bh);
      x.restore();
    }
    R.text(`${Math.ceil(this.hpShown)}`, bx + bw - 2, by - 1, '#dfe9d8', 8, 'right');

    /* dimension indicator */
    const label = past ? 'Geçmiş' : 'Gelecek';
    x.fillStyle = accent;
    x.fillRect(bx, by + 12, 3, 8);
    R.text(label, bx + 7, by + 12, accent, 9);
    /* rift cooldown pips */
    const cd = clamp(1 - this.shiftCd / .32, 0, 1);
    x.fillStyle = '#0c1410';
    x.fillRect(bx + 62, by + 14, 22, 4);
    x.fillStyle = this.shiftBlockT > 0 ? '#ff4d4d' : accent;
    x.fillRect(bx + 62, by + 14, 22 * cd, 4);

    /* boss bar */
    const b = this.boss;
    if(b.active && !b.dead){
      const w = 200, bx2 = (VIEW_W - w) / 2, by2 = VIEW_H - 22;
      x.fillStyle = 'rgba(6,12,10,.72)';
      x.fillRect(bx2 - 2, by2 - 10, w + 4, 22);
      R.text('Yarık Muhafızı', VIEW_W / 2, by2 - 10, '#ffd0f2', 8, 'center');
      x.fillStyle = '#160a12';
      x.fillRect(bx2, by2, w, 7);
      const bg = x.createLinearGradient(bx2, 0, bx2 + w, 0);
      bg.addColorStop(0, '#ff5ec4'); bg.addColorStop(1, '#ffb0ea');
      x.fillStyle = bg;
      x.fillRect(bx2, by2, w * clamp(b.hp / b.maxHp, 0, 1), 7);
      if(b.vulnT > 0){
        R.text('Çekirdek açık', VIEW_W / 2, by2 + 9, '#ffe27a', 8, 'center');
      }
      for(let i = 1; i < 3; i++){ x.fillStyle = '#160a12'; x.fillRect(bx2 + w * i / 3, by2, 1, 7); }
    }

    /* hint ribbon */
    if(this.hintAlpha > .01){
      x.save();
      x.globalAlpha = this.hintAlpha;
      x.fillStyle = 'rgba(6,12,10,.7)';
      x.fillRect(0, 48, VIEW_W, 14);
      R.text(this.hintText, VIEW_W / 2, 51, past ? '#c9ff8a' : '#9ff2ff', 9, 'center');
      x.restore();
    }

    /* shift-blocked warning */
    if(this.shiftBlockT > 0){
      x.save();
      x.globalAlpha = clamp(this.shiftBlockT / .4, 0, 1);
      R.text('Yarık engellendi — içeride katı madde var', VIEW_W / 2, 70, '#ff8080', 9, 'center');
      x.restore();
    }

    /* shard counter */
    x.save();
    x.fillStyle = 'rgba(6,12,10,.72)';
    x.fillRect(132, 4, 52, 16);
    x.strokeStyle = accentDim;
    x.strokeRect(132.5, 4.5, 51, 15);
    R.drawShardIcon(138, 8, this.time);
    R.text(`${this.shards}/12`, 150, 8, '#9ff2ff', 9);
    x.restore();
  },

  /* --------------------------------------------------------------- loop */
  frame(now){
    requestAnimationFrame(t => this.frame(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if(dt > .25) dt = .25;

    /* fixed 60 Hz simulation keeps physics identical on any refresh rate */
    if(this.state === 'play' || this.state === 'dead'){
      this.acc += dt;
      const STEP = 1 / 60;
      let steps = 0;
      while(this.acc >= STEP && steps < 5){
        if(this.state === 'play') this.update(STEP);
        else { this.updateParticles(STEP); this.updateCamera(STEP); this.time += STEP; R.time = this.time; }
        this.acc -= STEP;
        steps++;
      }
      if(steps === 5) this.acc = 0;
    } else {
      this.time += dt;
      R.time = this.time;
      this.updateParticles(dt);
      Input.clearEdges();
    }

    this.render();

    /* fps readout */
    this.fpsAcc += dt; this.fpsN++;
    if(this.fpsAcc >= .5){ this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    if(this.state === 'play'){
      R.text(fmtTime(this.runTime), VIEW_W - 4, 4, 'rgba(200,220,190,.5)', 8, 'right');
      R.text(`${this.fps} fps`, VIEW_W - 4, 14, 'rgba(200,220,190,.28)', 8, 'right');
    }
  }
};

addEventListener('DOMContentLoaded', () => Game.init());
