// SPDX-License-Identifier: GPL-3.0-or-later
// One ability dispatcher/state per battle, shared by full and selected content.
// No concrete enemy kit registry is imported here.
import {TICK} from '../constants.js';
import {elem,alliesInTiles} from './arkpedia-enemy-effects.js';

const STATE = new WeakMap();
export function stOf(b) {
  let st = STATE.get(b);
  if (!st) { st = { lpLoss: 0, freedAll: false, deathWatch: new Set() }; STATE.set(b, st); }
  return st;
}

/** Register one fixed enemy-kit scope per battle. Full-mode callers keep the original registry. */
export function installDispatch(b, scope, kits) {
  const st = stOf(b);
  if (st.installed) {
    if (st.kitScope !== scope) throw Error('Enemy kit scope cannot change within a battle');
    return st;
  }
  if (scope !== 'full' && scope !== 'features' && b.enemies.length) throw Error('Select enemy kits before the first spawn');
  st.installed = true; st.kitScope = scope; st.kits = kits;
  b.on('enemySpawn', ({ enemy }) => onSpawn(b, enemy, st.kits), { priority: 100 });
  b.on('hit', (c) => onHitOut(b, c), { priority: 200 });
  b.on('hit', (c) => chaliceShare(b, c), { priority: -400 });
  b.on('hit', (c) => onHitIn(b, c), { priority: -500 });
  b.on('damaged', (c) => onDamaged(b, c), { priority: 50 });
  b.on('beforeAttack', (c) => onBeforeAttack(b, c), { priority: 50 });
  b.on('attack', (c) => { if (c.attacker && c.attacker.side === 'enemy') dispatch(b, c.attacker, 'attack', c); }, { priority: 50 });
  b.on('enemyStandbyWake', c => { if (c.unit?.side === 'enemy') dispatch(b, c.unit, 'wake', c); });
  b.on('stagePulse', c => { if (c.unit?.side === 'enemy') dispatch(b, c.unit, 'pulse', c); });
  b.on('blocked', (c) => dispatch(b, c.enemy, 'blocked', c), { priority: 50 });
  b.on('unblocked', (c) => {
    for (const enemy of c.enemy ? [c.enemy] : c.enemies ?? []) dispatch(b, enemy, 'unblocked', c);
  }, { priority: 50 });
  b.on('kill', (c) => onKill(b, c), { priority: 1000 });
  b.on('death', (c) => onDeath(b, c), { priority: 50 });
  b.on('beforeStatus', (c) => {
    const ab = c.target && c.target.mem && c.target.mem.ab;
    if (!ab) return;
    if (ab.immune && ab.immune.has(c.status)) c.cancel = true;
  }, { priority: 50 });
  b.on('statusApplied', (c) => { if (c.target && c.target.side === 'enemy') dispatch(b, c.target, 'status', c); }, { priority: 50 });
  b.on('enemyHidden', ({ enemy, hidden }) => { if (hidden) dispatch(b, enemy, 'status', { target: enemy, status: 'hidden' }); }, { priority: 50 });
  b.on('enemyUnbalanced', ({ enemy }) => dispatch(b, enemy, 'status', { target: enemy, status: 'unbalanced' }), { priority: 50 });
  b.on('heal', (c) => {
    // 逐腐兽 bleeding ends when the target receives healing (natural regeneration excluded)
    if (c.amount > 0 && c.target && c.target.side === 'ally' && !(c.opts && c.opts.regen) && c.target.findBuff('ab:bleed')) b.removeBuff(c.target, 'ab:bleed');
  }, { priority: -50 });
  b.on('elementBurst', (c) => onBurst(b, c), { priority: 50 });
  b.on('tick', (c) => onTick(b, c.dt), { priority: 50 });
  b.on('battleEnd', ({ result }) => { if (st.lpLoss > 0 && result) result.lpLoss = (result.lpLoss ?? 0) + st.lpLoss; });
  return st;
}

/** Common dispatchers only, no per-enemy kits: the regular-stage feature runtime
 * (content/arkpedia-enemy-features.js) attaches reviewed abilities per data feature. */
export function installFeatureDispatch(b) {
  // Feature abilities need only the common dispatchers: reuse any scope already installed, and allow a late
  // install (there are no per-enemy kits to have missed).
  const st = stOf(b);
  if (st.installed) return st;
  return installDispatch(b, 'features', Object.freeze({}));
}

/** Enter an already-attached hit-count form without a knockout/rebirth. Native
 * summon actions can select this form immediately; no synthetic kill is emitted. */
export function enterEnemyHusk(b, e) {
  if (!e?.alive) return false;
  const ability = e.mem.ab?.list.find(a => typeof a.enterHusk === 'function');
  return ability ? ability.enterHusk(b, e, ability) : false;
}
export function watchDeaths(b, e) { stOf(b).deathWatch.add(e); }

/** The enemy's ability record (created on demand). */
export function abOf(b, e) {
  if (e.mem.ab) return e.mem.ab;
  const key = e.defId;
  const ov = (b.enemyOverrides && (b.enemyOverrides[key] ?? b.enemyOverrides[e.def && e.def.key])) || null;
  const raw = (e.def && e.def.raw) || {};
  const t = { ...((e.def && e.def.talent) || {}), ...((ov && ov.talents && ov.talents.bb) || {}) };
  const tS = { ...((raw.talents && raw.talents.bbStr) || {}), ...((ov && ov.talents && ov.talents.bbStr) || {}) };
  const sk = {};
  for (const s of (ov && Array.isArray(ov.skills) ? ov.skills : (e.def && e.def.skills) || [])) {
    if (!s || s.prefabKey == null) continue;
    sk[s.prefabKey] = { cd: num(s.cooldown, 0), icd: num(s.initCooldown, 0), sp: num(s.spCost, 0), bb: s.bb || {}, bs: s.bbStr || {},
      affectedBySlowDown: s.affectedBySlowDown === true };
  }
  e.mem.ab = { key, t, tS, sk, list: [], times: null, hitShield: 0, atkType: null, immune: null, origMaxHp: e.base.maxHp };
  return e.mem.ab;
}

/** Attach abilities to an enemy (calls their spawn()). */
export function attach(b, e, list) {
  const ab = abOf(b, e);
  for (const a of list) {
    if (!a) continue;
    if (a.cd != null) a.left = num(a.left, num(a.icd, 0));
    ab.list.push(a);
    if (a.spawn) safe(b, e, () => a.spawn(b, e, a, ab));
  }
  return ab;
}

export function safe(b, e, fn) {
  try { return fn(); } catch (err) { b._handlerError('content:enemies', e, err); return undefined; }
}

function dispatch(b, e, name, c) {
  const ab = e && e.mem && e.mem.ab;
  if (!ab) return false;
  let any = false;
  for (const a of ab.list) {
    const f = a[name];
    if (!f) continue;
    if (a.sil && e.s.flags.silence) continue;
    try { if (f.call(a, c, b, e, a, ab)) any = true; } catch (err) { b._handlerError(`enemies:${name}`, e, err); }
  }
  return any;
}

export const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
/** First finite talent value among keys. */
export function T(ab, ...keys) { for (const k of keys) { const v = ab.t[k]; if (typeof v === 'number' && Number.isFinite(v)) return v; } return undefined; }

export function silenced(e) { return !!e.s.flags.silence; }
export function canCast(e, sil) { return e.alive && !e.hidden && !e.s.flags.stun && !e.mem.regularShift && !(sil && e.s.flags.silence); }

// ---------------------------------------------------------------------------------------------------------------
// global dispatchers

function onSpawn(b, e, kits) {
  const kit = Object.hasOwn(kits, e.defId) ? kits[e.defId] : null;
  if (typeof kit !== 'function') return;
  const ab = abOf(b, e);
  const list = safe(b, e, () => kit(ab, e, b)) || [];
  attach(b, e, list);
}

function onHitOut(b, c) {
  const s = c.source;
  if (!s || s.side !== 'enemy' || !s.mem.ab || c.dmg.cancel) return;
  const ab = s.mem.ab;
  if (ab.atkType && c.dmg.isAttack && c.dmg.type !== 'element') c.dmg.type = ab.atkType;
  dispatch(b, s, 'hitOut', c);
}

function onHitIn(b, c) {
  const t = c.target;
  if (!t || t.side !== 'enemy' || !t.mem.ab || c.dmg.cancel) return;
  const ab = t.mem.ab;
  dispatch(b, t, 'hitIn', c);
  if (c.dmg.cancel) return;
  const ty = c.dmg.type;
  if (ab.hitShield > 0 && (ty === 'phys' || ty === 'arts')) {
    // "可以抵挡一次物理或法术伤害" / 再生's aura shield: the whole instance is negated
    c.dmg.cancel = true;
    ab.hitShield--;
    if (ab.hitShield <= 0) b.fx('shieldBreak', { x: t.x, y: t.y, id: t.id });
  }
}

function onDamaged(b, c) {
  const { source: s, target: t, dmg } = c;
  if (!dmg || dmg.type === 'element') return;
  if (t && t.side === 'enemy' && t.mem.ab) dispatch(b, t, 'taken', c);
  if (s && s.side === 'enemy' && s.mem.ab) dispatch(b, s, 'output', c);
  if (s && s.side === 'enemy' && s.mem.ab && dmg.isAttack && t && t.side === 'ally') dispatch(b, s, 'dealt', c);
}

function onBeforeAttack(b, c) {
  const a = c.attacker;
  if (a && a.side === 'enemy' && a.mem.ab) dispatch(b, a, 'before', c);
}

function onKill(b, c) {
  const v = c.victim;
  if (!v || v.side !== 'enemy' || !v.mem.ab) return;
  if (dispatch(b, v, 'killed', c) && v.hp > 0) c.stopPropagation = true; // revived: not a kill for anyone else
}

function onDeath(b, c) {
  const u = c.unit;
  const st = stOf(b);
  if (u && u.kind === 'enemy' && u.mem.ab) dispatch(b, u, 'death', c);
  if (st.deathWatch.size) for (const w of [...st.deathWatch]) { if (!w.alive) { st.deathWatch.delete(w); continue; } dispatch(b, w, 'otherDeath', c); }
}

function onBurst(b, c) {
  const t = c.target;
  if (!t) return;
  if (t.side === 'enemy') { if (t.mem.ab) dispatch(b, t, 'burst', c); return; }
  // 假想敌：淤困 parasite: the host's burst spreads the same element to the 4 neighbouring allies — PRTS 天赋 "（中点判定，
  // 无视目标可选性，不受迷彩制约）": every ally there, 隐匿 / untargetable / airborne 起飞 ones included (`ignoreSelect`)
  const par = t.findBuff('ab:parasite');
  if (par && par.data && par.data.src) {
    const src = par.data.src;
    for (const o of alliesInTiles(b, t.tileR, t.tileC, 'plus', 1)) if (o !== t) elem(b, src, o, c.element, par.data.spread, { ignoreSelect: true });
  }
}

function onTick(b, dt) {
  const list = b.neutralUnits.length ? [...b.enemies, ...b.neutralUnits] : b.enemies;
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const e = list[i];
    if (!e || !e.alive || !e.mem.ab) continue;
    const ab = e.mem.ab;
    for (let j = 0; j < ab.list.length; j++) {
      const a = ab.list[j];
      if (!e.alive) break;
      if (a.tick) {
        if (!(a.sil && e.s.flags.silence)) {
          if (!(a.iv > 0)) safe(b, e, () => a.tick(b, e, a, dt));
          else {
            a._acc = (a._acc ?? 0) + dt;
            let k = 0;
            while (a._acc >= a.iv - 1e-9 && k++ < 4 && e.alive) { a._acc -= a.iv; safe(b, e, () => a.tick(b, e, a, a.iv)); }
          }
        }
      }
      if (a.fire && a.cd != null) {
        a.left -= dt * (a.affectedBySlowDown === true ? e.s.slowDownRate : 1);
        if (a.left <= 1e-9 && canCast(e, a.sil) && (!a.cond || safe(b, e, () => a.cond(b, e, a)))) {
          a.left = Math.max(TICK, a.cd);
          a.casts = (a.casts ?? 0) + 1;
          e.skillAnimUntil = b.time + 0.5;
          safe(b, e, () => a.fire(b, e, a));
        }
      }
    }
  }
}

// 圣杯 damage sharing: ground enemies near a living chalice pass `share` of the damage they take to it.
function chaliceShare(b, c) {
  const st = stOf(b);
  if (!(st.chalices > 0)) return;
  const t = c.target;
  if (!t || t.side !== 'enemy' || t.isFlying || c.dmg.cancel || c.dmg.type === 'element' || (c.dmg.tags && c.dmg.tags.includes('chalice'))) return;
  for (const o of b.enemies) {
    if (!o.alive || o === t || o.defId !== 'enemy_1430_lrrook' || !o.mem.ab) continue;
    const a = o.mem.ab.list[0];
    if (!a || !(a.share > 0) || Math.hypot(o.x - t.x, o.y - t.y) > a.r) continue;
    const part = c.dmg.amount * a.share;
    c.dmg.amount -= part;
    // a 无来源 burst's share stays 无来源, credited like the burst (damage.js)
    b.dealDamage(c.dmg.sourceless ? c.credit : c.source, o, { amount: part, type: c.dmg.type, canDodge: false, sourceless: c.dmg.sourceless, tags: [...(c.dmg.tags || []), 'chalice'] });
    break;
  }
}
