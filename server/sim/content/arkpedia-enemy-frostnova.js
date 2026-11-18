// SPDX-License-Identifier: GPL-3.0-or-later
// FrostNova (enemy_1505_frstar). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-frostnova-features.js).
import { rebornAbility } from './arkpedia-enemy-forms.js';
import { canTargetAlly } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const NOVA = 'arctic_blast', CAST = 'ab:frstarCast', REBORN_UP = 'reborn_up';
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const key = (r, c) => `${r},${c}`;

export function frostNova(p) {
  validate(p);

  const novaTarget = (b, e) => b.alliesInRadius(e.x, e.y, p.blast.range + ALLY_COLLIDER_RADIUS)
    .filter(u => live(u) && !u.isFlying && canTargetAlly(e, u, true))
    .sort((x, y) => Math.hypot(x.x - e.x, x.y - e.y) - Math.hypot(y.x - e.x, y.y - e.y))[0] ?? null;
  // IceShield's tile selector: deployable tiles within its collider that are not sealed yet.
  const shieldTiles = (b, e) => {
    const out = [], r0 = Math.round(e.y), c0 = Math.round(e.x), n = Math.ceil(p.shield.radius);
    for (let r = r0 - n; r <= r0 + n; r++) for (let c = c0 - n; c <= c0 + n; c++) {
      if (!b.grid.inRect(r, c) || Math.hypot(r - e.y, c - e.x) > p.shield.radius + 1e-9) continue;
      const t = b.grid.tile(r, c);
      if (!['MELEE', 'RANGED', 'ALL'].includes(t.build) || b.noDeployTiles?.has(key(r, c))) continue;
      out.push([r, c]);
    }
    return out;
  };

  const release = (b, e, a) => {
    const c = a.cast;
    if (c.kind === 'blast') {
      const t = c.target;
      for (const u of b.alliesInRadius(t.x, t.y, p.blast.radius + ALLY_COLLIDER_RADIUS)) {
        if (!live(u)) continue;
        b.dealDamage(e, u, { amount: e.s.atk * p.blast.scale, type: 'arts', isSkill: true, isSplash: u !== t, applyWay: 'ranged', tags: ['frstarNova'] });
        if (u.alive) b.addBuff(u, { key: NOVA, source: e, duration: p.blast.duration, visible: true, mods: { aspd: p.blast.aspd } });
      }
      return;
    }
    // trap_004_iceblock on each tile: whoever stands there is defeated, and the tile can no longer be deployed on.
    b.noDeployTiles ??= new Set();
    for (const [r, col] of c.tiles) {
      for (const u of b.allies(null, { includeTargetableDevices: true }))
        if (u.alive && u.deployed && Math.round(u.y) === r && Math.round(u.x) === col) b.kill(u, e);
      b.noDeployTiles.add(key(r, col));
      b.fx?.('telegraph', { x: col, y: r, r: .5, dur: .5, kind: 'iceblock' });
    }
  };
  const finish = (b, e, a) => { a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST); };
  const start = (b, e, a, cast, anim) => {
    a.cast = { ...cast, anim, elapsed: 0, released: false };
    e.profile.noAttack = true; e.skillAnimUntil = b.time + anim.dur;
    b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true } });
  };

  const rebirth = rebornAbility({
    dur: p.revive.dur, hpRatio: p.revive.hp,
    onKo(b, e, a) { if (a.cast) finish(b, e, a); },
    onReborn(b, e) {
      b.addBuff(e, { key: REBORN_UP, persist: true, visible: true, mods: { atkPct: p.revive.atkPct } });
      // frstar_c (the common SleepImmune buff) is not retained through the revive.
      e.def = { ...e.def, immune: new Set([...e.def.immune].filter(k => k !== 'sleep')) };
    },
  });

  return {
    ...rebirth,
    spawn(b, e, a) {
      a.cast = null; a.blastLeft = p.blast.initial; a.shieldLeft = p.shield.initial;
      e.def = { ...e.def, attackAnim: p.attack.anim, immune: new Set([...e.def.immune, 'sleep']) };
    },
    tick(b, e, a, dt) {
      if (!e.alive || a.state === 'reborn') return;
      a.blastLeft -= dt; a.shieldLeft -= dt; // cooldowns run from the cast start
      if (a.cast) {
        a.cast.elapsed += dt * e.s.slowDownRate;
        if (!a.cast.released && a.cast.elapsed + 1e-9 >= a.cast.anim.hit) {
          a.cast.released = true;
          if (a.cast.kind !== 'blast' || live(a.cast.target)) release(b, e, a);
        }
        if (a.cast.elapsed + 1e-9 >= a.cast.anim.dur) finish(b, e, a);
        return;
      }
      if (!e.canAct) return;
      // IceShield (priority 2) before ArcticBlast (priority 1); each trigger needs a tile or a target.
      if (a.shieldLeft <= 1e-9) {
        const tiles = shieldTiles(b, e);
        if (tiles.length) {
          // _alwaysRandomInTheEnd: a random pick among the eligible tiles.
          const picked = b.rng.shuffle([...tiles]).slice(0, p.shield.count);
          a.shieldLeft = p.shield.cooldown;
          start(b, e, a, { kind: 'shield', tiles: picked }, p.shield.anim);
          return;
        }
      }
      if (a.blastLeft <= 1e-9) {
        const target = novaTarget(b, e);
        if (target) { a.blastLeft = p.blast.cooldown; start(b, e, a, { kind: 'blast', target }, p.blast.anim); }
      }
    },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0;
  const anim = x => pos(x?.dur) && pos(x.hit) && x.hit <= x.dur;
  const ok = pos(p?.attack?.speed) && anim(p.attack.anim)
    && pos(p.blast?.cooldown) && p.blast.initial >= 0 && pos(p.blast.range) && pos(p.blast.radius) && pos(p.blast.scale) && Number.isFinite(p.blast.aspd)
    && pos(p.blast.duration) && anim(p.blast.anim)
    && pos(p.shield?.cooldown) && p.shield.initial >= 0 && Number.isInteger(p.shield.count) && p.shield.count > 0 && pos(p.shield.radius) && anim(p.shield.anim)
    && pos(p.revive?.dur) && Number.isFinite(p.revive.atkPct) && p.revive.hp > 0 && p.revive.hp <= 1;
  if (!ok) throw Error('Invalid FrostNova parameters');
}
