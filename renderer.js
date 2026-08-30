'use strict';
/* ==========================================================================
   EGGRIFT — renderer.js
   Every pixel is generated at runtime: tilesets, parallax skies, characters,
   particles and HUD. No image files, so nothing can 404 on GitHub Pages.
   The screen is a 480x270 buffer scaled up by CSS with pixelated filtering,
   which is what gives the soft chunky Terraria-ish look.
   ========================================================================== */

const VIEW_W = 480, VIEW_H = 270;

/* ------------------------------------------------------------- palettes */
const PAL = {
  [DIM_PAST]: {
    sky0:'#16281f', sky1:'#22402c', sky2:'#3c5c38', haze:'rgba(142,210,78,.10)',
    far:'#1b3122', mid:'#152618', near:'#0e1a11',
    stoneD:'#1d2a1c', stone:'#31462c', stoneL:'#41603a',
    soil:'#3a2c1e', soilL:'#54402a',
    grass:'#6bb03a', grassL:'#8ed24e',
    ruinD:'#453f2e', ruin:'#6b6247', ruinL:'#8d8261',
    vine:'#3f7a2c', leaf:'#7cc44a', glow:'#c9ff8a',
    accent:'#8ed24e', accentDim:'#4e8c34',
    spikeD:'#33291a', spike:'#6b5a33', spikeL:'#9c8a4e',
    grade:'rgba(120,190,90,.07)', mote:'#cfff9a'
  },
  [DIM_FUTURE]: {
    sky0:'#0b1016', sky1:'#131c26', sky2:'#2a2028', haze:'rgba(55,230,255,.08)',
    far:'#141c26', mid:'#0f151d', near:'#0a0e14',
    stoneD:'#12161e', stone:'#232a35', stoneL:'#39424f',
    soil:'#1a1a20', soilL:'#2b2b34',
    grass:'#8a3c22', grassL:'#c8502f',
    ruinD:'#1e1c1a', ruin:'#3a332c', ruinL:'#574c3e',
    vine:'#2b2f2a', leaf:'#3c4438', glow:'#37e6ff',
    accent:'#37e6ff', accentDim:'#1b7f96',
    spikeD:'#241a18', spike:'#6a3527', spikeL:'#b6644a',
    grade:'rgba(60,180,220,.07)', mote:'#9fe8ff'
  }
};

/* --------------------------------------------------------- small helpers */
function makeCanvas(w, h){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return { c, x };
}
function px(x, cx, cy, w, h, col){ x.fillStyle = col; x.fillRect(cx, cy, w, h); }

/** mulberry32 — tiny seeded PRNG so generated art is identical every load. */
function seeded(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ========================================================================
   Tileset generation
   ======================================================================== */
const TILES = {};   // key: `${type}_${dim}_${top}_${v}` -> canvas

function genStone(dim, top, v){
  const p = PAL[dim], { c, x } = makeCanvas(TILE, TILE), rnd = seeded(v * 977 + dim * 31 + 7);
  px(x, 0, 0, TILE, TILE, p.stone);
  for(let i = 0; i < 26; i++){
    const bx = Math.floor(rnd() * TILE), by = Math.floor(rnd() * TILE);
    px(x, bx, by, 1 + (rnd() < .3 ? 1 : 0), 1, rnd() < .5 ? p.stoneD : p.stoneL);
  }
  /* soil band at the bottom keeps the ground reading as earth, not brick */
  for(let i = 0; i < 10; i++){
    const bx = Math.floor(rnd() * TILE);
    px(x, bx, 10 + Math.floor(rnd() * 6), 2, 1, rnd() < .5 ? p.soil : p.soilL);
  }
  if(top){
    px(x, 0, 0, TILE, 3, p.grass);
    px(x, 0, 0, TILE, 1, p.grassL);
    for(let i = 0; i < TILE; i += 2){
      if(rnd() < .55) px(x, i, dim === DIM_PAST ? -1 : 0, 1, dim === DIM_PAST ? 3 : 1, p.grassL);
    }
    if(dim === DIM_PAST){
      for(let i = 0; i < 3; i++){
        const bx = Math.floor(rnd() * (TILE - 2));
        px(x, bx, 3, 1, 1 + Math.floor(rnd() * 2), p.grass);
      }
    } else {
      for(let i = 0; i < 4; i++) px(x, Math.floor(rnd() * TILE), 3 + Math.floor(rnd() * 3), 1, 1, p.grassL);
    }
  } else {
    px(x, 0, 0, TILE, 1, p.stoneD);
  }
  return c;
}

/** Buried rock: earth tones, not the mossy surface stone. */
function genStoneDeep(dim, v){
  const p = PAL[dim], { c, x } = makeCanvas(TILE, TILE), rnd = seeded(v * 1523 + dim * 71 + 13);
  const base   = dim === DIM_PAST ? '#3a2c1e' : '#1b1f26';
  const baseL  = dim === DIM_PAST ? '#4b3927' : '#262c35';
  const baseD  = dim === DIM_PAST ? '#281e14' : '#12151b';
  const rock   = dim === DIM_PAST ? '#5a5348' : '#39424f';
  const rockL  = dim === DIM_PAST ? '#6f6656' : '#4c5764';
  px(x, 0, 0, TILE, TILE, base);
  for(let i = 0; i < 40; i++){
    const bx = Math.floor(rnd() * TILE), by = Math.floor(rnd() * TILE);
    px(x, bx, by, 1 + (rnd() < .25 ? 1 : 0), 1, rnd() < .5 ? baseD : baseL);
  }
  /* embedded rocks */
  const rocks = 1 + Math.floor(rnd() * 3);
  for(let i = 0; i < rocks; i++){
    const bw = 3 + Math.floor(rnd() * 4), bh = 2 + Math.floor(rnd() * 3);
    const bx = Math.floor(rnd() * (TILE - bw)), by = Math.floor(rnd() * (TILE - bh));
    px(x, bx, by, bw, bh, rock);
    px(x, bx, by, bw, 1, rockL);
    px(x, bx, by + bh - 1, bw, 1, baseD);
  }
  /* roots in the past, conduit in the future */
  if(rnd() < .4){
    if(dim === DIM_PAST){
      const ry = Math.floor(rnd() * (TILE - 4));
      for(let i = 0; i < TILE; i++) px(x, i, ry + Math.round(Math.sin(i * .8 + v) * 1.5), 1, 1, '#4e3a20');
    } else {
      const ry = 3 + Math.floor(rnd() * 9);
      px(x, 0, ry, TILE, 2, '#2b333d');
      px(x, 0, ry, TILE, 1, '#3d4854');
      if(rnd() < .5) px(x, Math.floor(rnd() * TILE), ry, 1, 2, '#7a3a22');
    }
  }
  /* a rare ore glint gives the depth some life */
  if(rnd() < .3){
    const ox = 2 + Math.floor(rnd() * 12), oy = 2 + Math.floor(rnd() * 12);
    px(x, ox, oy, 2, 2, dim === DIM_PAST ? '#7cc44a' : '#37e6ff');
    px(x, ox, oy, 1, 1, '#ffffff');
  }
  return c;
}

function genRuin(dim, top, v){
  const p = PAL[dim], { c, x } = makeCanvas(TILE, TILE), rnd = seeded(v * 613 + dim * 17 + 3);
  px(x, 0, 0, TILE, TILE, p.ruin);
  px(x, 0, 0, TILE, 1, p.ruinL);
  px(x, 0, TILE - 1, TILE, 1, p.ruinD);
  /* carved block seams */
  px(x, 0, 7, TILE, 1, p.ruinD);
  px(x, 7, 0, 1, 7, p.ruinD);
  px(x, 3, 8, 1, 8, p.ruinD);
  px(x, 11, 8, 1, 8, p.ruinD);
  for(let i = 0; i < 14; i++){
    const bx = Math.floor(rnd() * TILE), by = Math.floor(rnd() * TILE);
    px(x, bx, by, 1, 1, rnd() < .5 ? p.ruinD : p.ruinL);
  }
  if(dim === DIM_PAST){
    for(let i = 0; i < 6; i++){
      const bx = Math.floor(rnd() * TILE), by = Math.floor(rnd() * TILE);
      px(x, bx, by, 2, 1, p.vine);
    }
    if(top) px(x, 0, 0, TILE, 2, p.grass);
  }
  return c;
}

/** In the future the ruin is gone — only a faint dust outline remains. */
function genRuinGhost(v){
  const { c, x } = makeCanvas(TILE, TILE), rnd = seeded(v * 91 + 5);
  x.globalAlpha = .5;
  px(x, 0, 0, TILE, 1, 'rgba(120,110,90,.35)');
  px(x, 0, TILE - 1, TILE, 1, 'rgba(120,110,90,.2)');
  for(let i = 0; i < 8; i++) px(x, Math.floor(rnd() * TILE), Math.floor(rnd() * TILE), 1, 1, 'rgba(150,140,115,.3)');
  x.globalAlpha = 1;
  return c;
}

function genTech(dim, top, v){
  const p = PAL[dim], { c, x } = makeCanvas(TILE, TILE), rnd = seeded(v * 431 + 11);
  if(dim === DIM_FUTURE){
    px(x, 0, 0, TILE, TILE, '#242c36');
    px(x, 0, 0, TILE, 2, '#4c6273');
    px(x, 0, 0, TILE, 1, '#6a8496');
    px(x, 0, TILE - 2, TILE, 2, '#161c24');
    for(let i = 0; i < 3; i++) px(x, 2 + i * 5, 4, 3, 1, '#3a4653');
    /* rust streaks + an energy line so the platform reads as powered */
    for(let i = 0; i < 7; i++){
      const bx = Math.floor(rnd() * TILE);
      px(x, bx, 3 + Math.floor(rnd() * 10), 1, 1 + Math.floor(rnd() * 3), rnd() < .5 ? '#7a3a22' : '#96482a');
    }
    px(x, 1, 8, TILE - 2, 1, '#1b7f96');
    px(x, 3, 8, 4, 1, '#37e6ff');
    px(x, 1, 11, 2, 2, '#37e6ff');
    px(x, TILE - 3, 11, 2, 2, '#37e6ff');
  } else {
    /* in the past the platform is only a blueprint hologram — not solid */
    x.globalAlpha = .55;
    px(x, 0, 0, TILE, 1, 'rgba(80,200,220,.5)');
    px(x, 0, TILE - 1, TILE, 1, 'rgba(80,200,220,.28)');
    for(let i = 0; i < TILE; i += 3) px(x, i, 0, 1, TILE, 'rgba(80,200,220,.13)');
    px(x, 0, 7, TILE, 1, 'rgba(80,200,220,.22)');
    x.globalAlpha = 1;
  }
  return c;
}

function genVine(dim, v){
  const p = PAL[dim], { c, x } = makeCanvas(TILE, TILE), rnd = seeded(v * 733 + 19);
  if(dim === DIM_PAST){
    const cx = 5 + Math.floor(rnd() * 4);
    for(let y = 0; y < TILE; y++){
      const w = 2 + (y % 5 === 0 ? 1 : 0);
      const off = Math.round(Math.sin(y * .6 + v) * 1.6);
      px(x, cx + off, y, w, 1, y % 3 === 0 ? p.leaf : p.vine);
    }
    for(let i = 0; i < 4; i++){
      const ly = Math.floor(rnd() * TILE), side = rnd() < .5 ? -1 : 1;
      px(x, cx + side * 3, ly, 3, 2, p.leaf);
      if(rnd() < .4) px(x, cx + side * 4, ly, 1, 1, p.glow);
    }
  } else {
    /* decayed: a few dead fibres hanging in the air */
    x.globalAlpha = .5;
    const cx = 6 + Math.floor(rnd() * 3);
    for(let y = 0; y < TILE; y += 2) if(rnd() < .45) px(x, cx + Math.round(Math.sin(y) * 1.5), y, 1, 1, '#3c4438');
    x.globalAlpha = 1;
  }
  return c;
}

function genSpike(dim, v){
  const p = PAL[dim], { c, x } = makeCanvas(TILE, TILE), rnd = seeded(v * 271 + 23);
  px(x, 0, TILE - 3, TILE, 3, p.spikeD);
  for(let s = 0; s < 3; s++){
    const bx = s * 5 + 1;
    for(let i = 0; i < 6; i++){
      const w = 5 - i;
      px(x, bx + Math.floor((5 - w) / 2), TILE - 3 - i * 2, w, 2, i > 3 ? p.spikeL : p.spike);
    }
  }
  return c;
}

function genLaserEmitter(dim, v){
  const p = PAL[dim], { c, x } = makeCanvas(TILE, TILE);
  px(x, 2, 0, 12, 5, dim === DIM_FUTURE ? '#39424f' : '#463f2e');
  px(x, 2, 0, 12, 1, dim === DIM_FUTURE ? '#5d6c7c' : '#6b6247');
  px(x, 5, 5, 6, 2, dim === DIM_FUTURE ? '#ff2b4a' : '#3a3428');
  if(dim === DIM_FUTURE){ px(x, 6, 5, 4, 1, '#ff8ba0'); }
  return c;
}

function genLamp(dim, v){
  const p = PAL[dim], { c, x } = makeCanvas(TILE, TILE), rnd = seeded(v * 199 + 29);
  if(dim === DIM_PAST){
    px(x, 6, 3, 4, 4, p.glow);
    px(x, 7, 2, 2, 6, p.glow);
    px(x, 5, 7, 6, 2, p.leaf);
    for(let i = 0; i < 3; i++) px(x, 4 + Math.floor(rnd() * 8), 9 + Math.floor(rnd() * 4), 1, 1, p.leaf);
  } else {
    px(x, 5, 2, 6, 6, '#101820');
    px(x, 6, 3, 4, 4, '#37e6ff');
    px(x, 7, 8, 2, 4, '#1b7f96');
  }
  return c;
}

function genMoss(dim, v){
  const p = PAL[dim], { c, x } = makeCanvas(TILE, TILE), rnd = seeded(v * 353 + 31);
  const col = dim === DIM_PAST ? [p.grass, p.grassL, p.leaf] : ['#3a332c', '#4a3f34', '#7a3a22'];
  for(let i = 0; i < 9; i++){
    const bx = Math.floor(rnd() * TILE), h = 2 + Math.floor(rnd() * 4);
    px(x, bx, TILE - h, 1, h, col[Math.floor(rnd() * col.length)]);
  }
  return c;
}

function buildTiles(){
  for(const dim of [DIM_PAST, DIM_FUTURE]){
    for(let v = 0; v < 6; v++){
      TILES[`1_${dim}_1_${v}`] = genStone(dim, true, v);
      TILES[`1_${dim}_0_${v}`] = genStone(dim, false, v);
      TILES[`1d_${dim}_0_${v}`] = genStoneDeep(dim, v);
      TILES[`2_${dim}_1_${v}`] = dim === DIM_PAST ? genRuin(dim, true, v) : genRuinGhost(v);
      TILES[`2_${dim}_0_${v}`] = dim === DIM_PAST ? genRuin(dim, false, v) : genRuinGhost(v);
      TILES[`3_${dim}_1_${v}`] = genTech(dim, true, v);
      TILES[`3_${dim}_0_${v}`] = TILES[`3_${dim}_1_${v}`];
      TILES[`4_${dim}_0_${v}`] = genVine(dim, v);
      TILES[`5_${dim}_0_${v}`] = genSpike(dim, v);
      TILES[`6_${dim}_0_${v}`] = genLaserEmitter(dim, v);
      TILES[`8_${dim}_0_${v}`] = genMoss(dim, v);
      TILES[`9_${dim}_0_${v}`] = genLamp(dim, v);
    }
    /* one-way platform */
    for(let v = 0; v < 3; v++){
      const p = PAL[dim], { c, x } = makeCanvas(TILE, TILE), rnd = seeded(v * 97 + 41);
      if(dim === DIM_PAST){
        px(x, 0, 0, TILE, 4, p.soilL);
        px(x, 0, 0, TILE, 1, p.grass);
        for(let i = 0; i < 6; i++) px(x, Math.floor(rnd() * TILE), 1 + Math.floor(rnd() * 3), 1, 1, p.soil);
      } else {
        px(x, 0, 0, TILE, 4, '#39424f');
        px(x, 0, 0, TILE, 1, '#6a8496');
        px(x, 0, 3, TILE, 1, '#141820');
        for(let i = 0; i < 3; i++) px(x, 2 + i * 5, 1, 2, 2, '#7a3a22');
      }
      TILES[`7_${dim}_0_${v}`] = c;
      TILES[`7_${dim}_1_${v}`] = c;
    }
  }
}

/* ========================================================================
   Parallax backgrounds
   ======================================================================== */
const BG = {};

function buildBackgrounds(){
  for(const dim of [DIM_PAST, DIM_FUTURE]){
    const p = PAL[dim];
    /* --- sky --- */
    {
      const { c, x } = makeCanvas(VIEW_W, VIEW_H);
      const g = x.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, p.sky0); g.addColorStop(.55, p.sky1); g.addColorStop(1, p.sky2);
      x.fillStyle = g; x.fillRect(0, 0, VIEW_W, VIEW_H);
      const rnd = seeded(dim * 7919 + 5);
      if(dim === DIM_PAST){
        /* soft sun and drifting light shafts */
        const sx = 360, sy = 54;
        const rg = x.createRadialGradient(sx, sy, 0, sx, sy, 120);
        rg.addColorStop(0, 'rgba(220,255,180,.5)');
        rg.addColorStop(.4, 'rgba(150,220,120,.16)');
        rg.addColorStop(1, 'rgba(150,220,120,0)');
        x.fillStyle = rg; x.fillRect(sx - 130, sy - 130, 260, 260);
        for(let i = 0; i < 40; i++){
          const bx = rnd() * VIEW_W, by = rnd() * 150;
          x.fillStyle = `rgba(200,255,170,${.05 + rnd() * .08})`;
          x.fillRect(bx, by, 1, 1);
        }
      } else {
        /* rust-lit smog and a cold moon */
        const rg = x.createRadialGradient(120, 46, 0, 120, 46, 90);
        rg.addColorStop(0, 'rgba(180,240,255,.42)');
        rg.addColorStop(1, 'rgba(120,200,230,0)');
        x.fillStyle = rg; x.fillRect(30, -44, 180, 180);
        const mrows = [6, 10, 12, 14, 14, 14, 14, 12, 10, 6];
        for(let i = 0; i < mrows.length; i++){
          const w = mrows[i];
          px(x, 120 - w / 2, 36 + i, w, 1, '#cfe9f5');
          px(x, 120 - w / 2, 36 + i, Math.max(1, w * .3), 1, '#eef8ff');
        }
        px(x, 117, 40, 3, 2, '#a8c6d6');
        px(x, 122, 44, 2, 2, '#a8c6d6');
        px(x, 118, 46, 2, 1, '#a8c6d6');
        for(let i = 0; i < 60; i++){
          x.fillStyle = `rgba(180,230,255,${.1 + rnd() * .25})`;
          x.fillRect(rnd() * VIEW_W, rnd() * 130, 1, 1);
        }
      }
      BG[`sky_${dim}`] = c;
    }

    /* --- far + near silhouette layers (tiled horizontally) --- */
    for(const [name, col, scale] of [['far', p.far, 1], ['near', p.near, 1.6]]){
      const w = 960, h = VIEW_H;
      const { c, x } = makeCanvas(w, h);
      const rnd = seeded(dim * 131 + (name === 'far' ? 3 : 9));
      if(dim === DIM_PAST){
        /* layered canopy: trunks with round crowns */
        const base = name === 'far' ? 190 : 226;
        for(let i = 0; i < (name === 'far' ? 26 : 18); i++){
          const bx = Math.floor(rnd() * w), th = (30 + rnd() * 70) * scale;
          const tw = 4 + Math.floor(rnd() * 4);
          x.fillStyle = col;
          x.fillRect(bx, base - th, tw, th + 60);
          const cr = 12 + rnd() * 20 * scale;
          x.beginPath();
          x.arc(bx + tw / 2, base - th, cr, 0, Math.PI * 2);
          x.fill();
          x.beginPath();
          x.arc(bx + tw / 2 - cr * .6, base - th + cr * .4, cr * .7, 0, Math.PI * 2);
          x.fill();
          x.beginPath();
          x.arc(bx + tw / 2 + cr * .6, base - th + cr * .4, cr * .7, 0, Math.PI * 2);
          x.fill();
        }
        x.fillStyle = col;
        x.fillRect(0, base + 40, w, h - base - 40);
      } else {
        /* broken skyline with lit windows */
        const base = name === 'far' ? 200 : 232;
        for(let i = 0; i < (name === 'far' ? 30 : 20); i++){
          const bw = 14 + Math.floor(rnd() * 30), bh = (30 + rnd() * 90) * scale;
          const bx = Math.floor(rnd() * w);
          x.fillStyle = col;
          x.fillRect(bx, base - bh, bw, bh + 60);
          /* snapped-off top */
          if(rnd() < .5) x.clearRect(bx + bw / 2, base - bh, bw / 2, 6 + rnd() * 14);
          if(name === 'far'){
            for(let wy = base - bh + 6; wy < base; wy += 7){
              for(let wx = bx + 2; wx < bx + bw - 3; wx += 5){
                if(rnd() < .18) x.fillStyle = rnd() < .5 ? 'rgba(55,230,255,.5)' : 'rgba(200,90,50,.45)';
                else continue;
                x.fillRect(wx, wy, 2, 2);
              }
            }
          }
          if(rnd() < .3){ x.fillStyle = 'rgba(255,60,60,.6)'; x.fillRect(bx + bw / 2, base - bh - 4, 1, 4); }
        }
        x.fillStyle = col;
        x.fillRect(0, base + 40, w, h - base - 40);
      }
      BG[`${name}_${dim}`] = c;
    }
  }
}

/* ========================================================================
   Renderer
   ======================================================================== */
const R = {
  cvs: null, x: null,
  fx: null,            // scratch buffer for the warp effect
  cam: { x: 0, y: 0, shake: 0 },
  lights: [],
  motes: [],
  time: 0,

  init(canvas){
    this.cvs = canvas;
    this.x = canvas.getContext('2d');
    this.x.imageSmoothingEnabled = false;
    this.fx = makeCanvas(VIEW_W, VIEW_H);
    buildTiles();
    buildBackgrounds();
    for(let i = 0; i < 70; i++){
      this.motes.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H,
                        s: rand(.15, .7), p: Math.random() * 6.28, r: rand(.6, 1.6) });
    }
  },

  /* -------------------------------------------------- camera + lighting */
  addLight(x, y, r, col, a){ this.lights.push({ x, y, r, col, a }); },

  flushLights(){
    const x = this.x;
    x.save();
    x.globalCompositeOperation = 'lighter';
    for(const l of this.lights){
      const sx = Math.round(l.x - this.cam.x), sy = Math.round(l.y - this.cam.y);
      if(sx < -l.r || sx > VIEW_W + l.r || sy < -l.r || sy > VIEW_H + l.r) continue;
      const g = x.createRadialGradient(sx, sy, 0, sx, sy, l.r);
      g.addColorStop(0, l.col.replace('ALPHA', l.a));
      g.addColorStop(1, l.col.replace('ALPHA', 0));
      x.fillStyle = g;
      x.fillRect(sx - l.r, sy - l.r, l.r * 2, l.r * 2);
    }
    x.restore();
    this.lights.length = 0;
  },

  /* ---------------------------------------------------------- background */
  drawBackground(dim, dt){
    const x = this.x, p = PAL[dim];
    x.drawImage(BG[`sky_${dim}`], 0, 0);

    const layers = [['far', .12, 0.06], ['near', .3, 0.12]];
    for(const [name, px_, py_] of layers){
      const img = BG[`${name}_${dim}`];
      let ox = -(this.cam.x * px_) % img.width;
      if(ox > 0) ox -= img.width;
      const oy = -this.cam.y * py_;
      for(let i = 0; i < 3; i++) x.drawImage(img, Math.round(ox + i * img.width), Math.round(oy));
    }

    /* ambient motes: pollen in the past, ash in the future */
    x.save();
    for(const m of this.motes){
      m.p += dt * (dim === DIM_PAST ? .6 : 1.4);
      m.y += dt * (dim === DIM_PAST ? 4 * m.s : 16 * m.s);
      if(m.y > VIEW_H) { m.y = -2; m.x = Math.random() * VIEW_W; }
      const dx = Math.sin(m.p) * (dim === DIM_PAST ? 6 : 2);
      x.fillStyle = p.mote;
      x.globalAlpha = (dim === DIM_PAST ? .35 : .22) * (.4 + .6 * Math.abs(Math.sin(m.p)));
      x.fillRect(Math.round(m.x + dx), Math.round(m.y), m.r, m.r);
    }
    x.restore();
  },

  /* --------------------------------------------------------------- world */
  drawWorld(dim){
    const x = this.x;
    const t0x = Math.floor(this.cam.x / TILE) - 1, t1x = Math.floor((this.cam.x + VIEW_W) / TILE) + 1;
    const t0y = Math.floor(this.cam.y / TILE) - 1, t1y = Math.floor((this.cam.y + VIEW_H) / TILE) + 1;
    const pulse = .5 + .5 * Math.sin(this.time * 3);

    for(let ty = t0y; ty <= t1y; ty++){
      for(let tx = t0x; tx <= t1x; tx++){
        const t = World.get(tx, ty);
        if(t === TT.EMPTY) continue;
        const sx = tx * TILE - Math.round(this.cam.x), sy = ty * TILE - Math.round(this.cam.y);
        const v = Math.floor(tileHash(tx, ty) * 6) % 6;

        if(t === TT.LASER){
          this.drawLaserTile(tx, ty, sx, sy, dim, v, pulse);
          continue;
        }
        const above = World.get(tx, ty - 1);
        const covered = World.solid(tx, ty - 1, dim) || above === t;
        const topOpen = (t === TT.STONE || t === TT.RUIN) && !covered ? 1 : 0;

        let img;
        if(t === TT.STONE && covered){
          /* buried rock gets the earth texture plus depth shading */
          img = TILES[`1d_${dim}_0_${v}`];
          x.drawImage(img, sx, sy);
          const depth = clamp((ty - 22) / 7, 0, 1);
          x.fillStyle = `rgba(0,0,0,${(.1 + .34 * depth).toFixed(3)})`;
          x.fillRect(sx, sy, TILE, TILE);
          continue;
        }
        img = TILES[`${t}_${dim}_${topOpen}_${v}`] || TILES[`${t}_${dim}_0_${v}`];
        if(img) x.drawImage(img, sx, sy);

        /* glow sources */
        if(t === TT.LAMP){
          this.addLight(tx * TILE + 8, ty * TILE + 6, 34,
            dim === DIM_PAST ? 'rgba(180,255,120,ALPHA)' : 'rgba(55,230,255,ALPHA)', .28 + pulse * .12);
        }
        if(t === TT.VINE && dim === DIM_PAST && v === 0){
          this.addLight(tx * TILE + 8, ty * TILE + 8, 18, 'rgba(180,255,120,ALPHA)', .12);
        }
        if(t === TT.TECH && dim === DIM_FUTURE){
          this.addLight(tx * TILE + 8, ty * TILE + 8, 20, 'rgba(55,230,255,ALPHA)', .13);
        }
      }
    }
  },

  /** A laser column: dormant emitter in the past, cutting beam in the future. */
  drawLaserTile(tx, ty, sx, sy, dim, v, pulse){
    const x = this.x;
    const img = TILES[`6_${dim}_0_${v}`];
    /* Emitters render at the top of the run; the beam fills the rest. */
    const isHead = World.get(tx, ty - 1) !== TT.LASER;
    if(isHead && img) x.drawImage(img, sx, sy);
    if(dim === DIM_FUTURE){
      const y0 = sy + (isHead ? 7 : 0), h = TILE - (isHead ? 7 : 0);
      const w = 2 + Math.round(pulse);
      x.fillStyle = 'rgba(255,43,74,.85)';
      x.fillRect(sx + 8 - Math.floor(w / 2), y0, w, h);
      x.fillStyle = 'rgba(255,190,200,.9)';
      x.fillRect(sx + 7, y0, 1, h);
      this.addLight(tx * TILE + 8, ty * TILE + 8, 26, 'rgba(255,60,90,ALPHA)', .22 + pulse * .1);
    } else if(!isHead){
      /* dormant: a faint dotted trace where the beam will be */
      x.fillStyle = 'rgba(150,140,110,.18)';
      for(let i = 0; i < TILE; i += 3) x.fillRect(sx + 7, sy + i, 1, 1);
    }
  },

  /* ------------------------------------------------------------ entities */

  /** Egg-armoured dimension knight, drawn as pixel spans (no sprite sheet). */
  drawPlayer(p, dim){
    const x = this.x;
    const sx = Math.round(p.x - this.cam.x), sy = Math.round(p.y - this.cam.y);
    const pal = PAL[dim];
    const face = p.face;
    const t = this.time;

    x.save();
    x.translate(sx + p.w / 2, sy + p.h);
    x.scale(face, 1);

    /* invulnerability blink */
    if(p.iframes > 0 && Math.floor(p.iframes * 22) % 2 === 0) x.globalAlpha = .35;

    const squash = p.onGround ? 1 + Math.sin(t * 6) * .015 : (p.vy < 0 ? 1.06 : .96);
    x.scale(1 / squash, squash);

    /* --- legs --- */
    const legPhase = p.onGround && Math.abs(p.vx) > 8 ? Math.sin(p.animRun * 12) : 0;
    const legY = -3;
    px(x, -5 + legPhase * 2, legY, 4, 3, '#2b3a45');
    px(x,  1 - legPhase * 2, legY, 4, 3, '#2b3a45');
    px(x, -5 + legPhase * 2, legY + 2, 4, 1, '#161e26');
    px(x,  1 - legPhase * 2, legY + 2, 4, 1, '#161e26');

    /* --- egg shell body (row spans, widest low: an egg, not an oval) --- */
    const rows = [4, 7, 9, 10, 11, 12, 12, 13, 13, 13, 13, 12, 11, 9, 7];
    const bodyTop = -3 - rows.length;
    for(let i = 0; i < rows.length; i++){
      const w = rows[i], yy = bodyTop + i;
      const shellL = '#f2f4e4', shell = '#dcdfc6', shellD = '#a9ae90';
      px(x, -Math.floor(w / 2), yy, w, 1, shell);
      px(x, -Math.floor(w / 2), yy, Math.max(1, Math.floor(w * .28)), 1, shellL);
      px(x,  Math.ceil(w / 2) - 2, yy, 2, 1, shellD);
    }
    /* helmet band + visor */
    px(x, -6, bodyTop + 3, 12, 4, '#38506a');
    px(x, -6, bodyTop + 3, 12, 1, '#5a7896');
    px(x, -4, bodyTop + 4, 8, 2, '#0d1420');
    const eyeCol = dim === DIM_PAST ? '#9dff62' : '#4ef2ff';
    px(x, 0, bodyTop + 4, 3, 2, eyeCol);
    px(x, 1, bodyTop + 4, 1, 1, '#ffffff');
    /* crest */
    px(x, -1, bodyTop - 1, 2, 2, dim === DIM_PAST ? '#8ed24e' : '#37e6ff');

    /* --- the dimensional crack: a glowing fault across the shell --- */
    const crackGlow = .55 + .45 * Math.sin(t * 4);
    const crack = [[-4, 8], [-2, 9], [-3, 10], [-1, 11], [-2, 12], [0, 13]];
    for(const [cx, cy] of crack){
      px(x, cx, bodyTop + cy, 1, 1, dim === DIM_PAST ? '#c9ff8a' : '#9ff2ff');
    }
    x.save();
    x.globalCompositeOperation = 'lighter';
    x.globalAlpha = crackGlow * .5;
    px(x, -5, bodyTop + 8, 7, 6, dim === DIM_PAST ? 'rgba(140,220,80,.5)' : 'rgba(55,230,255,.5)');
    x.restore();

    /* --- sword --- */
    if(p.attackT > 0){
      const k = 1 - p.attackT / p.attackDur;         // 0 -> 1 through the swing
      const ang = lerp(-1.15, 1.15, k);
      x.save();
      x.translate(5, bodyTop + 9);
      x.rotate(ang);
      px(x, 0, -1, 16, 2, '#e9f2ff');
      px(x, 0, -2, 14, 1, '#ffffff');
      px(x, 14, -2, 3, 3, '#cfd8e6');
      px(x, -2, -3, 3, 6, '#6a5230');
      x.restore();
      /* arc trail */
      x.save();
      x.globalCompositeOperation = 'lighter';
      x.globalAlpha = (1 - k) * .8;
      x.strokeStyle = dim === DIM_PAST ? 'rgba(190,255,140,.9)' : 'rgba(140,240,255,.9)';
      x.lineWidth = 2;
      x.beginPath();
      x.arc(5, bodyTop + 9, 16, -1.2 + k * .6, .9 + k * .6);
      x.stroke();
      x.restore();
    } else {
      /* sheathed on the back */
      px(x, -9, bodyTop + 6, 2, 11, '#8a94a6');
      px(x, -10, bodyTop + 5, 4, 2, '#6a5230');
    }

    x.restore();

    /* soft rim light so the hero reads against both palettes */
    this.addLight(p.x + p.w / 2, p.y + p.h / 2, 40,
      dim === DIM_PAST ? 'rgba(150,230,110,ALPHA)' : 'rgba(70,220,255,ALPHA)', .16);
  },

  /** HUD avatar: same egg + crack motif, drawn large and lit. */
  drawAvatar(ax, ay, dim, hurtFlash){
    const x = this.x, t = this.time;
    x.save();
    x.translate(ax, ay);
    const rows = [4, 8, 11, 13, 15, 16, 17, 18, 18, 18, 17, 15, 12, 8];
    for(let i = 0; i < rows.length; i++){
      const w = rows[i];
      px(x, 13 - Math.floor(w / 2), 4 + i, w, 1, i < 3 ? '#f2f4e4' : (i > 10 ? '#a9ae90' : '#dcdfc6'));
      px(x, 13 - Math.floor(w / 2), 4 + i, Math.max(1, Math.round(w * .25)), 1, '#ffffff');
    }
    /* helmet */
    px(x, 5, 8, 16, 5, '#38506a');
    px(x, 5, 8, 16, 1, '#5a7896');
    px(x, 8, 9, 10, 3, '#0d1420');
    const eye = dim === DIM_PAST ? '#9dff62' : '#4ef2ff';
    px(x, 9, 10, 3, 2, eye);
    px(x, 15, 10, 3, 2, eye);
    px(x, 12, 2, 2, 3, dim === DIM_PAST ? '#8ed24e' : '#37e6ff');
    /* dimensional crack */
    const cg = .5 + .5 * Math.sin(t * 3.4);
    const crack = [[8, 14], [10, 15], [9, 16], [11, 17], [10, 18], [12, 19], [11, 20]];
    for(const [cx, cy] of crack) px(x, cx, cy, 2, 1, dim === DIM_PAST ? '#c9ff8a' : '#9ff2ff');
    x.save();
    x.globalCompositeOperation = 'lighter';
    x.globalAlpha = cg * .55;
    px(x, 6, 13, 9, 9, dim === DIM_PAST ? 'rgba(140,220,80,.6)' : 'rgba(55,230,255,.6)');
    x.restore();
    if(hurtFlash > 0){
      x.globalAlpha = hurtFlash * .7;
      px(x, 0, 0, 26, 26, '#ff5a5a');
      x.globalAlpha = 1;
    }
    x.restore();
  },

  drawPlant(e, dim){
    const x = this.x;
    const sx = Math.round(e.x - this.cam.x), sy = Math.round(e.y - this.cam.y);
    const alive = dim === DIM_PAST;
    x.save();
    x.globalAlpha = alive ? (e.hurtT > 0 ? .7 : 1) : .22;
    x.translate(sx + e.w / 2, sy + e.h);
    x.scale(e.face, 1);
    const sway = Math.sin(this.time * 3 + e.seed) * 1.2;
    /* roots */
    px(x, -6, -3, 3, 3, '#2f4a1e'); px(x, 3, -3, 3, 3, '#2f4a1e');
    px(x, -1, -2, 2, 2, '#2f4a1e');
    /* bulb */
    const body = e.hurtT > 0 ? '#ffb4b4' : '#4f8c2e';
    for(let i = 0; i < 9; i++){
      const w = [6, 9, 11, 12, 12, 12, 11, 9, 6][i];
      px(x, -Math.floor(w / 2) + sway * .3, -12 + i, w, 1, i < 3 ? '#6fb03c' : body);
    }
    /* maw */
    const open = e.lungeT > 0 ? 4 : 2;
    px(x, -4, -9, 8, open, '#2a0f16');
    for(let i = 0; i < 4; i++) px(x, -3 + i * 2, -9, 1, 1, '#ffe8c8');
    for(let i = 0; i < 3; i++) px(x, -2 + i * 2, -9 + open - 1, 1, 1, '#ffe8c8');
    /* corrupted eyes */
    px(x, -3, -11, 2, 2, '#c86bff'); px(x, 1, -11, 2, 2, '#c86bff');
    /* leaves */
    px(x, -9, -8 + sway, 4, 2, '#7cc44a'); px(x, 5, -8 - sway, 4, 2, '#7cc44a');
    x.restore();
    if(alive) this.addLight(e.x + e.w / 2, e.y + e.h / 2, 26, 'rgba(200,107,255,ALPHA)', .14);
  },

  drawDrone(e, dim){
    const x = this.x;
    const sx = Math.round(e.x - this.cam.x), sy = Math.round(e.y - this.cam.y);
    const alive = dim === DIM_FUTURE;
    const bob = Math.sin(this.time * 4 + e.seed) * 1.5;
    x.save();
    x.globalAlpha = alive ? (e.hurtT > 0 ? .7 : 1) : .22;
    x.translate(sx + e.w / 2, sy + e.h / 2 + bob);
    x.scale(e.face, 1);
    /* rotors */
    const spin = (this.time * 30 + e.seed) % 2 < 1 ? 1 : -1;
    px(x, -10, -6, 7, 1, '#7d8ea0'); px(x, 3, -6, 7, 1, '#7d8ea0');
    px(x, -8 * spin, -7, 3, 1, '#aab8c6');
    /* chassis */
    const body = e.hurtT > 0 ? '#ffb4b4' : '#39424f';
    px(x, -7, -5, 14, 8, body);
    px(x, -7, -5, 14, 1, '#5d6c7c');
    px(x, -7, 2, 14, 1, '#141820');
    px(x, -5, -3, 4, 2, '#7a3a22');
    /* eye */
    const eye = e.chargeT > 0 ? '#ffe27a' : '#ff2b4a';
    px(x, 2, -3, 4, 3, eye);
    px(x, 3, -3, 2, 1, '#ffffff');
    /* thruster */
    px(x, -2, 3, 4, 1, '#37e6ff');
    x.restore();
    if(alive){
      this.addLight(e.x + e.w / 2, e.y + e.h / 2, 30, 'rgba(255,60,90,ALPHA)', e.chargeT > 0 ? .32 : .16);
    }
  },

  /** The guardian keeps one silhouette but wears each dimension's armour. */
  drawBoss(b, dim){
    const x = this.x;
    const sx = Math.round(b.x - this.cam.x), sy = Math.round(b.y - this.cam.y);
    const past = dim === DIM_PAST;
    const t = this.time;
    x.save();
    x.translate(sx + b.w / 2, sy + b.h);
    x.scale(b.face, 1);
    if(b.hurtT > 0 && Math.floor(b.hurtT * 30) % 2 === 0) x.globalAlpha = .8;

    const breathe = Math.sin(t * 1.6) * 1.5;
    const plateD = past ? '#2f4128' : '#1b222b';
    const plate  = past ? '#4a6b3a' : '#2f3a46';
    const plateL = past ? '#6b9450' : '#4c6273';
    const trim   = past ? '#8ed24e' : '#37e6ff';

    /* legs */
    px(x, -18, -12, 12, 12, plateD);
    px(x, 6, -12, 12, 12, plateD);
    px(x, -18, -12, 12, 2, plate);
    px(x, 6, -12, 12, 2, plate);
    /* torso */
    px(x, -20, -40 + breathe, 40, 30, plate);
    px(x, -20, -40 + breathe, 40, 3, plateL);
    px(x, -20, -13 + breathe, 40, 3, plateD);
    /* shoulder pauldrons */
    px(x, -26, -38 + breathe, 8, 14, plateL);
    px(x, 18, -38 + breathe, 8, 14, plateL);
    /* head */
    px(x, -11, -52 + breathe, 22, 13, plate);
    px(x, -11, -52 + breathe, 22, 2, plateL);
    px(x, -8, -47 + breathe, 16, 4, '#0b1016');
    const eyeGlow = b.telegraphT > 0 ? '#ffe27a' : trim;
    px(x, -6, -47 + breathe, 4, 3, eyeGlow);
    px(x, 2, -47 + breathe, 4, 3, eyeGlow);

    /* dimension dressing */
    if(past){
      for(let i = 0; i < 7; i++){
        const vx = -20 + i * 6, vy = -38 + Math.sin(t * 2 + i) * 2 + breathe;
        px(x, vx, vy, 2, 10 + (i % 3) * 4, '#3f7a2c');
        px(x, vx - 1, vy + 6, 4, 2, '#7cc44a');
      }
      px(x, -20, -40 + breathe, 40, 2, '#6bb03a');
    } else {
      for(let i = 0; i < 5; i++){
        px(x, -18 + i * 9, -36 + breathe, 7, 1, '#1b7f96');
        px(x, -18 + i * 9, -30 + breathe, 7, 1, i % 2 ? '#37e6ff' : '#1b7f96');
      }
      px(x, -24, -30 + breathe, 4, 6, '#7a3a22');
      px(x, 20, -30 + breathe, 4, 6, '#7a3a22');
    }

    /* the core: shielded most of the time, exposed in the vulnerable window */
    const cy = -27 + breathe;
    if(b.vulnT > 0){
      const pulse = .6 + .4 * Math.sin(t * 12);
      px(x, -7, cy - 7, 14, 14, '#120a12');
      for(let i = 0; i < 5; i++){
        const w = [10, 12, 12, 10, 6][i];
        px(x, -Math.floor(w / 2), cy - 5 + i * 2, w, 2, i % 2 ? '#ff8de0' : '#ffd0f2');
      }
      x.save();
      x.globalCompositeOperation = 'lighter';
      x.globalAlpha = pulse;
      px(x, -10, cy - 10, 20, 20, 'rgba(255,120,220,.45)');
      x.restore();
    } else {
      px(x, -8, cy - 8, 16, 16, plateD);
      px(x, -6, cy - 6, 12, 12, plate);
      px(x, -4, cy - 4, 8, 8, trim);
      px(x, -2, cy - 2, 4, 4, plateD);
    }
    x.restore();

    this.addLight(b.x + b.w / 2, b.y + b.h * .45, b.vulnT > 0 ? 70 : 50,
      b.vulnT > 0 ? 'rgba(255,110,210,ALPHA)' : (past ? 'rgba(140,220,80,ALPHA)' : 'rgba(55,230,255,ALPHA)'),
      b.vulnT > 0 ? .4 : .2);
  },

  drawProjectile(pr, dim){
    const x = this.x;
    const sx = Math.round(pr.x - this.cam.x), sy = Math.round(pr.y - this.cam.y);
    if(pr.kind === 'spore'){
      px(x, sx, sy, 5, 5, '#8ed24e');
      px(x, sx + 1, sy + 1, 3, 3, '#c9ff8a');
      this.addLight(pr.x + 2, pr.y + 2, 18, 'rgba(160,240,110,ALPHA)', .3);
    } else if(pr.kind === 'bolt'){
      px(x, sx - 2, sy + 1, 8, 2, '#ff8ba0');
      px(x, sx, sy, 5, 4, '#ff2b4a');
      px(x, sx + 1, sy + 1, 3, 2, '#ffe0e6');
      this.addLight(pr.x + 2, pr.y + 2, 20, 'rgba(255,60,90,ALPHA)', .32);
    } else { /* shard */
      px(x, sx, sy, 6, 6, dim === DIM_PAST ? '#7cc44a' : '#37e6ff');
      px(x, sx + 1, sy + 1, 4, 4, '#ffffff');
      this.addLight(pr.x + 3, pr.y + 3, 22, dim === DIM_PAST ? 'rgba(140,220,80,ALPHA)' : 'rgba(55,230,255,ALPHA)', .3);
    }
  },

  drawParticles(list){
    const x = this.x;
    for(const p of list){
      const a = clamp(1 - p.life / p.max, 0, 1);
      const sx = Math.round(p.x - this.cam.x), sy = Math.round(p.y - this.cam.y);
      x.globalAlpha = a;
      if(p.glow){
        x.save();
        x.globalCompositeOperation = 'lighter';
        x.fillStyle = p.col;
        x.fillRect(sx - 1, sy - 1, p.s + 2, p.s + 2);
        x.restore();
      }
      x.fillStyle = p.col;
      x.fillRect(sx, sy, p.s, p.s);
      x.globalAlpha = 1;
    }
  },

  /* ------------------------------------------------------------ post fx */
  grade(dim){
    const x = this.x, p = PAL[dim];
    x.save();
    x.fillStyle = p.grade;
    x.fillRect(0, 0, VIEW_W, VIEW_H);
    /* vignette */
    const g = x.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 90, VIEW_W / 2, VIEW_H / 2, 320);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, dim === DIM_PAST ? 'rgba(4,10,4,.55)' : 'rgba(2,4,8,.62)');
    x.fillStyle = g;
    x.fillRect(0, 0, VIEW_W, VIEW_H);
    x.restore();
  },

  /**
   * Dimension warp: slice the finished frame, offset the slices, add a
   * chromatic ghost and a shockwave ring. t runs 1 -> 0.
   */
  applyWarp(t, dim, cx, cy){
    if(t <= 0) return;
    const x = this.x, f = this.fx;
    f.x.clearRect(0, 0, VIEW_W, VIEW_H);
    f.x.drawImage(this.cvs, 0, 0);

    const k = t * t;
    x.clearRect(0, 0, VIEW_W, VIEW_H);
    /* sliced redraw */
    const slices = 14;
    for(let i = 0; i < slices; i++){
      const h = Math.ceil(VIEW_H / slices);
      const y = i * h;
      const off = Math.round((Math.random() - .5) * 44 * k);
      x.drawImage(f.c, 0, y, VIEW_W, h, off, y, VIEW_W, h);
    }
    /* chromatic ghost */
    x.save();
    x.globalCompositeOperation = 'lighter';
    x.globalAlpha = .35 * k;
    x.drawImage(f.c, Math.round(7 * k), 0);
    x.drawImage(f.c, -Math.round(7 * k), 0);
    x.restore();

    /* shockwave from the knight */
    const sx = cx - this.cam.x, sy = cy - this.cam.y;
    const rad = (1 - t) * 340;
    x.save();
    x.globalCompositeOperation = 'lighter';
    x.strokeStyle = dim === DIM_PAST ? `rgba(160,240,110,${k * .9})` : `rgba(80,230,255,${k * .9})`;
    x.lineWidth = 2 + 5 * k;
    x.beginPath();
    x.arc(sx, sy, rad, 0, Math.PI * 2);
    x.stroke();
    x.globalAlpha = k * .3;
    x.fillStyle = dim === DIM_PAST ? '#8ed24e' : '#37e6ff';
    x.fillRect(0, 0, VIEW_W, VIEW_H);
    x.restore();

    /* scanlines while the rift is open */
    x.save();
    x.globalAlpha = .25 * k;
    x.fillStyle = '#000';
    for(let y = 0; y < VIEW_H; y += 3) x.fillRect(0, y, VIEW_W, 1);
    x.restore();
  },

  /* ---------------------------------------------------------------- text */
  text(str, tx, ty, col, size, align){
    const x = this.x;
    x.save();
    x.font = `${size || 8}px ui-monospace, "DejaVu Sans Mono", monospace`;
    x.textAlign = align || 'left';
    x.textBaseline = 'top';
    x.fillStyle = 'rgba(0,0,0,.75)';
    x.fillText(str, tx + 1, ty + 1);
    x.fillStyle = col;
    x.fillText(str, tx, ty);
    x.restore();
  }
};
