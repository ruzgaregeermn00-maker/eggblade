'use strict';
/* ==========================================================================
   EGGRIFT — physics.js
   Tilemap world + collision. The map is a single grid; each tile decides for
   itself whether it is solid in the past, the future, or both, so a dimension
   shift is just a change of one variable, never a rebuild of the level.
   ========================================================================== */

const TILE = 16;

/* Tile types. Solidity is resolved per dimension in World.solid(). */
const TT = {
  EMPTY: 0,
  STONE: 1,   // solid in both dimensions — the bedrock of the map
  RUIN:  2,   // ancient masonry: solid in the PAST, crumbled away in the FUTURE
  TECH:  3,   // rusty/energised platform: solid in the FUTURE, not yet built in the PAST
  VINE:  4,   // climbable in the PAST, decayed to open air in the FUTURE
  SPIKE: 5,   // hazard in both (thorns / rusted spikes)
  LASER: 6,   // hazard in the FUTURE only (dormant emitter in the PAST)
  PLAT:  7,   // one-way platform, solid in both
  MOSS:  8,   // decoration, never solid
  LAMP:  9    // glowing flora / neon lamp, never solid
};

const DIM_PAST = 0;
const DIM_FUTURE = 1;

const World = {
  cols: 0,
  rows: 0,
  data: null,
  dim: DIM_PAST,

  create(cols, rows){
    this.cols = cols;
    this.rows = rows;
    this.data = new Uint8Array(cols * rows);
  },
  get(tx, ty){
    if(tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return TT.EMPTY;
    return this.data[ty * this.cols + tx];
  },
  set(tx, ty, v){
    if(tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return;
    this.data[ty * this.cols + tx] = v;
  },
  /** Solid blocks stop movement. Off-map sides count as walls; the bottom does not. */
  solid(tx, ty, dim){
    if(tx < 0 || tx >= this.cols) return true;
    if(ty < 0 || ty >= this.rows) return false;
    const t = this.data[ty * this.cols + tx];
    if(t === TT.STONE) return true;
    if(t === TT.RUIN)  return dim === DIM_PAST;
    if(t === TT.TECH)  return dim === DIM_FUTURE;
    return false;
  },
  oneWay(tx, ty){ return this.get(tx, ty) === TT.PLAT; },
  hazard(tx, ty, dim){
    const t = this.get(tx, ty);
    if(t === TT.SPIKE) return true;
    if(t === TT.LASER) return dim === DIM_FUTURE;
    return false;
  },
  climbable(tx, ty, dim){
    return dim === DIM_PAST && this.get(tx, ty) === TT.VINE;
  },
  /** True when this tile exists in one dimension but not the other. */
  isPhased(t){
    return t === TT.RUIN || t === TT.TECH || t === TT.VINE || t === TT.LASER;
  }
};

/* ---------------------------------------------------------------- helpers */

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp  = (a, b, t) => a + (b - a) * t;
const sign  = v => v < 0 ? -1 : (v > 0 ? 1 : 0);
const rand  = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

/** Deterministic per-tile noise, so procedural texture never flickers. */
function tileHash(x, y){
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function rectsOverlap(a, b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Does an axis-aligned box overlap any solid tile in this dimension? */
function rectSolid(x, y, w, h, dim){
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
  for(let ty = y0; ty <= y1; ty++)
    for(let tx = x0; tx <= x1; tx++)
      if(World.solid(tx, ty, dim)) return true;
  return false;
}

/** Run a callback over every tile a box touches; return the first truthy result. */
function eachTileIn(x, y, w, h, fn){
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
  for(let ty = y0; ty <= y1; ty++){
    for(let tx = x0; tx <= x1; tx++){
      const r = fn(tx, ty, World.get(tx, ty));
      if(r) return r;
    }
  }
  return null;
}

function rectHazard(x, y, w, h, dim){
  return !!eachTileIn(x, y, w, h, (tx, ty) => World.hazard(tx, ty, dim));
}
function rectClimbable(x, y, w, h, dim){
  return !!eachTileIn(x, y, w, h, (tx, ty) => World.climbable(tx, ty, dim));
}

/* -------------------------------------------------------------- integration */

/**
 * Move an entity by its velocity, resolving tile collisions on each axis
 * separately. Sub-steps keep fast movers from tunnelling through thin tiles.
 * Sets: e.onGround, e.wallDir (-1 left wall, 1 right wall, 0 none), e.hitCeil.
 */
function moveEntity(e, dt, dim){
  e.onGround = false;
  e.wallDir = 0;
  e.hitCeil = false;

  const travel = Math.max(Math.abs(e.vx * dt), Math.abs(e.vy * dt));
  const steps = Math.max(1, Math.ceil(travel / (TILE * 0.5)));
  const sdt = dt / steps;

  for(let s = 0; s < steps; s++){
    /* ---- horizontal ---- */
    if(e.vx !== 0){
      const nx = e.x + e.vx * sdt;
      if(rectSolid(nx, e.y, e.w, e.h, dim)){
        if(e.vx > 0){
          e.x = Math.floor((nx + e.w) / TILE) * TILE - e.w - 0.01;
          e.wallDir = 1;
        } else {
          e.x = Math.floor(nx / TILE) * TILE + TILE + 0.01;
          e.wallDir = -1;
        }
        e.vx = 0;
      } else {
        e.x = nx;
      }
    }

    /* ---- vertical ---- */
    if(e.vy !== 0){
      const feetBefore = e.y + e.h;
      const ny = e.y + e.vy * sdt;
      if(rectSolid(e.x, ny, e.w, e.h, dim)){
        if(e.vy > 0){
          e.y = Math.floor((ny + e.h) / TILE) * TILE - e.h - 0.01;
          e.onGround = true;
        } else {
          e.y = Math.floor(ny / TILE) * TILE + TILE + 0.01;
          e.hitCeil = true;
        }
        e.vy = 0;
      } else {
        /* One-way platforms catch a falling entity only when its feet cross
           the platform's top edge this step, and never while dropping through. */
        let landed = false;
        if(e.vy > 0 && !e.dropThrough){
          const feetAfter = ny + e.h;
          const ty = Math.floor(feetAfter / TILE);
          const top = ty * TILE;
          if(feetBefore <= top + 0.5 && feetAfter > top){
            const x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w - 0.001) / TILE);
            for(let tx = x0; tx <= x1; tx++){
              if(World.oneWay(tx, ty)){
                e.y = top - e.h - 0.01;
                e.vy = 0;
                e.onGround = true;
                landed = true;
                break;
              }
            }
          }
        }
        if(!landed) e.y = ny;
      }
    }
  }

  /* Wall contact must be probed, not inferred from the collision that just
     happened: once a wall zeroes vx, later frames never re-enter the branch
     above, and wall-slide/wall-jump would silently stop working. */
  if(e.wallDir === 0){
    if(rectSolid(e.x + 1.5, e.y, e.w, e.h, dim)) e.wallDir = 1;
    else if(rectSolid(e.x - 1.5, e.y, e.w, e.h, dim)) e.wallDir = -1;
  }
}

/** Is there solid ground within `dist` px below the box? Used by walker AI. */
function groundAhead(x, y, w, h, dim, dist){
  return rectSolid(x, y + h, w, dist, dim);
}
