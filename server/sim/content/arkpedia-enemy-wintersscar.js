// SPDX-License-Identifier: GPL-3.0-or-later
// FrostNova, "Winter's Scar" (enemy_1510_frstar2). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-wintersscar-features.js).
import { rebornAbility } from './arkpedia-enemy-forms.js';
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
import { canTargetAlly } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const CAST = 'ab:frstar2Cast', REBORN_UP = 'reborn_up';
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const key = (r, c) => `${r},${c}`;
const pos = v => Number.isFinite(v) && v > 0;

export function wintersScar(p) {
  validate(p);
  // Ordinary attack: Arts bolt; AttackFreeze adds e2c_cold (Cold) for attack.cold s to the target hit.
  const shot = projectileSingleAttack({ speed: p.attack.speed, lifetime: p.attack.lifetime, type: 'arts',
    onImpact: (b, e, target) => { if (target?.alive) b.applyStatus(target, 'cold', { duration: p.attack.cold, source: e }); } });
  const burstTargets = (b, e, form) => b.alliesInRadius(e.x, e.y, form.burst.radius + ALLY_COLLIDER_RADIUS)
    .filter(u => live(u) && canTargetAlly(e, u, true));
  // IceShield's tile selector (the first FrostNova's): deployable tiles within its collider, not sealed yet.
  const shieldTiles = (b, e, form) => {
    const out = [], r0 = Math.round(e.y), c0 = Math.round(e.x), n = Math.ceil(form.shield.radius);
    for (let r = r0 - n; r <= r0 + n; r++) for (let c = c0 - n; c <= c0 + n; c++) {
      if (!b.grid.inRect(r, c) || Math.hypot(r - e.y, c - e.x) > form.shield.radius + 1e-9) continue;
      const t = b.grid.tile(r, c);
      if (!['MELEE', 'RANGED', 'ALL'].includes(t.build) || b.noDeployTiles?.has(key(r, c))) continue;
      out.push([r, c]);
    }
    return out;
  };
  const release = (b, e, a) => {
    const c = a.cast;
    if (c.kind === 'burst') {
      const burst = c.form.burst;
      for (const u of burstTargets(b, e, c.form)) {
        // frstar2_s, attached while IceBurst casts: double damage to FROZEN targets (checked before the new Cold).
        const scale = burst.scale * (u.s.flags.freeze ? burst.frozenScale : 1);
        b.dealDamage(e, u, { amount: e.s.atk * scale, type: 'arts', isSkill: true, applyWay: 'ranged', tags: ['frstar2IceBurst'] });
        if (u.alive) b.applyStatus(u, 'cold', { duration: burst.cold, source: e });
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
  const finish = (b, e, a) => { a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST);
    if (e.mem.regularFormVisual?.playId === `frstar2:${e.id}`) e.mem.regularFormVisual = null; };
  const start = (b, e, a, cast, anim, clip) => {
    a.cast = { ...cast, anim, elapsed: 0, released: false };
    e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
    e.profile.noAttack = true; e.skillAnimUntil = b.time + anim.dur;
    e.mem.regularFormVisual = { clip, loop: false, speed: 1, playId: `frstar2:${e.id}` };
    b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true } });
  };
  const arm = (b, a, form) => { a.burstLeft = form.burst.initial; a.shieldLeft = form.shield.initial; };
  const rebirth = rebornAbility({
    dur: p.revive.dur, hpRatio: 1, invincible: p.revive.invincible,
    onKo(b, e, a) { if (a.cast) finish(b, e, a); },
    onReborn(b, e, a) {
      b.addBuff(e, { key: REBORN_UP, persist: true, visible: true, mods: { atkPct: p.revive.atkPct } });
      a.mode = 1; arm(b, a, p.forms[1]); a.frostsPending = true;
    },
  });
  return {
    ...rebirth,
    spawn(b, e, a) {
      shot.spawn(b, e);
      a.cast = null; a.mode = 0; a.frostsPending = false; arm(b, a, p.forms[0]);
      e.def = { ...e.def, attackAnim: p.attack.anim, immune: new Set([...e.def.immune, 'sleep']) }; // frstar_2_c, both modes
    },
    attack(c, b, e) { shot.attack(c, b, e); },
    tick(b, e, a, dt) {
      if (!e.alive || a.state === 'reborn') return;
      // SummonFrosts (Reborn mode, cooldown 0, once; ignores silence): the frstar_frosts phase while one is left.
      if (a.frostsPending) { a.frostsPending = false; if (b.stageBranches?.hasNext(p.frosts)) b.stageBranches.advance(p.frosts); }
      const form = p.forms[a.mode];
      a.burstLeft -= dt; a.shieldLeft -= dt; // cooldowns run from the cast start
      if (a.cast) {
        if (!e.canAct) { finish(b, e, a); return; }
        a.cast.elapsed += dt * e.s.slowDownRate;
        if (!a.cast.released && a.cast.elapsed + 1e-9 >= a.cast.anim.hit) { a.cast.released = true; release(b, e, a); }
        if (a.cast.elapsed + 1e-9 >= a.cast.anim.dur) finish(b, e, a);
        return;
      }
      if (!e.canAct || e.s.flags.silence) return;
      // IceShield (priority 2) before IceBurst (priority 1); each trigger needs a tile or a target.
      if (a.shieldLeft <= 1e-9) {
        const tiles = shieldTiles(b, e, form);
        if (tiles.length) {
          a.shieldLeft = form.shield.cooldown;
          start(b, e, a, { kind: 'shield', form, tiles: b.rng.shuffle([...tiles]).slice(0, form.shield.count) }, form.shield.anim, 'Skill_1');
          return;
        }
      }
      if (a.burstLeft <= 1e-9 && burstTargets(b, e, form).length) {
        a.burstLeft = form.burst.cooldown;
        start(b, e, a, { kind: 'burst', form }, form.burst.anim, a.mode ? 'Skill_3' : 'Attack');
      }
    },
  };
}

function validate(p) {
  const anim = x => pos(x?.dur) && pos(x.hit) && x.hit <= x.dur;
  const form = f => pos(f?.burst?.cooldown) && f.burst.initial >= 0 && pos(f.burst.radius) && pos(f.burst.scale) && pos(f.burst.frozenScale)
    && pos(f.burst.cold) && anim(f.burst.anim) && pos(f.shield?.cooldown) && f.shield.initial >= 0 && Number.isInteger(f.shield.count)
    && f.shield.count > 0 && pos(f.shield.radius) && anim(f.shield.anim);
  if (!pos(p?.attack?.speed) || !pos(p.attack.lifetime) || !anim(p.attack.anim) || !pos(p.attack.cold) || p.forms?.length !== 2 || !p.forms.every(form)
    || !pos(p.revive?.dur) || !pos(p.revive.atkPct) || !pos(p.revive.invincible) || typeof p.frosts !== 'string' || !p.frosts)
    throw Error("Invalid Winter's Scar parameters");
}
