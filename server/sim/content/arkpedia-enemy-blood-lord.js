// SPDX-License-Identifier: GPL-3.0-or-later
// Duq'arael, 'Regent's Crimson': first form (kind bloodLord) and second form (kind bloodLordTwo). Numbers arrive in `p`
// from the reviewed contract (shared/arkpedia/enemy-blood-lord-features.js); the Throne of Blood is b.stageBloodThrone
// (arkpedia-stage-blood-throne.js), Blood Mist and Blood Surge are arkpedia-blood-mist.js.
// Casts root him and stop his attacks (he is immune to stun and silence).
import { bloodMists, BloodSurgeRound, holdRedeploy, releaseRedeploy, rampDamage } from './arkpedia-blood-mist.js';
import { OwnedStageAura } from './arkpedia-stage-auras.js';
import { remainingRoute, spawnChildren } from './arkpedia-enemy-spawn.js';

const CAST = 'ab:bloodLordCast', AFFLICT = 'bloodAffliction';
const afflicted = b => {
  if (b.bloodAfflicted) return b.bloodAfflicted;
  const set = b.bloodAfflicted = new Set();
  b.on('tick', () => {
    for (const u of [...set]) {
      const buff = live(u) ? u.findBuff(AFFLICT) : null;
      if (!buff) { set.delete(u); releaseRedeploy(b, u, AFFLICT); continue; }
      const d = buff.data;
      while (live(u) && b.time + 1e-9 >= d.next) {
        b.dealDamage(null, u, { amount: rampDamage(d.ramp, d.next - d.start), type: 'arts', sourceless: true, noSp: true, canDodge: false,
          applyWay: 'none', tags: ['periodic', 'bloodAffliction'] });
        d.next += 1;
      }
    }
  });
  return set;
};
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const pick = (b, list) => list.length ? list[list.length === 1 ? 0 : b.rng.int(list.length)] : null;
const root = (b, e, a, clip, length) => {
  a.prevNoAttack ??= e.profile.noAttack; e.profile.noAttack = true; e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
  if (!e.findBuff(CAST)) b.addBuff(e, { key: CAST, flags: { noMove: true } });
  e.mem.regularFormVisual = { clip, loop: false, speed: 1, playId: `bloodLord:${++a.seq}` };
  e.skillAnimUntil = b.time + length;
};
const unroot = (b, e, a) => {
  if (a.prevNoAttack !== undefined) { e.profile.noAttack = a.prevNoAttack; a.prevNoAttack = undefined; }
  b.removeBuff(e, CAST); e.mem.regularFormVisual = null; e.skillAnimUntil = b.time;
};

/** First form. BloodFog every `mist.cooldown` s from `mist.initial`: a random operator's tile, the mist at the clip's
 * OnAttack. UNDEADABLE: an HP-zero attempt starts BloodFountain instead (INVINCIBLE; the Throne's Blood Surge at the
 * clip's OnAttack; the clip's end kills him). Without the Throne's buff he dies `markCheck` s in. */
export function bloodLord(p) {
  if (!(p?.mist && p.surge && p.mist.cooldown > 0 && p.mist.release <= p.mist.cast && p.surge.release <= p.surge.cast))
    throw Error('Invalid Duq\'arael parameters');
  const fountain = (b, e, a) => {
    if (a.cast) { a.cast = null; unroot(b, e, a); }
    a.fountain = { t: 0, released: false };
    b.addBuff(e, { key: 'ab:bloodLordFountain', persist: true, flags: { invulnerable: true } });
    root(b, e, a, 'Skill_2', p.surge.cast);
  };
  return {
    spawn(b, e, a) {
      a.seq = 0; a.fog = p.mist.initial; a.cast = null; a.fountain = null; a.markAt = b.time + p.markCheck;
      a.mists = 0; a.surges = 0;
      b.addBuff(e, { key: 'ab:bloodLordUndying', persist: true, flags: { undeadable: true } });
      b.stageBloodThrone?.adopt(e);
      b.on('hpZeroAttempt', c => { if (c.unit === e && e.alive && !a.fountain) fountain(b, e, a); }, { owner: e });
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      if (a.markAt != null && b.time + 1e-9 >= a.markAt) {
        a.markAt = null;
        if (!b.stageBloodThrone?.holds(e)) { e.mem.bloodLordOrphaned = true; b.kill(e, null); return; }
      }
      if (a.fountain) {
        const f = a.fountain; f.t += dt;
        if (!f.released && f.t + 1e-9 >= p.surge.release) { f.released = true; if (b.stageBloodThrone?.surge(e)) a.surges++; }
        if (f.t + 1e-9 >= p.surge.cast) {
          b.removeBuff(e, 'ab:bloodLordFountain'); unroot(b, e, a);
          e.mem.bloodLordDefeated = true; b.kill(e, null);
        }
        return;
      }
      a.fog -= dt;
      if (a.cast) {
        const c = a.cast; c.t += dt;
        if (!c.released && c.t + 1e-9 >= p.mist.release) { c.released = true; a.mists++; bloodMists(b).release(e, c.at[1], c.at[0], p.mist); }
        if (c.t + 1e-9 >= p.mist.cast) { a.cast = null; unroot(b, e, a); }
        return;
      }
      if (a.fog > 1e-9 || !e.deployed) return;
      const target = pick(b, b.allies().filter(live));
      if (!target) return;
      a.fog = p.mist.cooldown;
      a.cast = { t: 0, released: false, at: [Math.round(target.y), Math.round(target.x)] };
      root(b, e, a, 'Skill_1', p.mist.cast);
    },
    death(c, b, e, a) {
      a.cast = null; a.fountain = null;
      const throne = b.stageBloodThrone;
      if (!throne) return;
      if (c.reason === 'exit') throne.lordExited(e);
      else throne.lordKilled(e);
    },
  };
}

/** Second form. See enemy-blood-lord-features.js for the reviewed behaviour. */
export function bloodLordTwo(p) {
  if (!(p?.edict && p.sunken && p.aura && p.affliction && p.edict.cooldown > 0 && p.edict.every > 0))
    throw Error('Invalid Duq\'arael second-form parameters');
  /** enemy_blord2_extra_damage[timer]: refreshed by each hit; the ramp runs from the first. */
  // A knocked-out operator drops the (non-persistent) Affliction without onRemove; its penalty was already read at the
  // knock-out, so the holder is released on the next battle tick (b.bloodAfflicted), also after his own death.
  const afflict = (b, e, a, u) => {
    const cur = u.findBuff(AFFLICT);
    if (cur) { cur.timeLeft = p.affliction.duration; return; }
    // enemy_blord_fog_damage as enemy_blord2_extra_damage (waitFirstTriggerInterval): ticks 1 s apart from the first hit.
    b.addBuff(u, { key: AFFLICT, source: e, visible: true, duration: p.affliction.duration,
      data: { start: b.time, next: b.time + p.affliction.firstTick, ramp: p.affliction } });
    holdRedeploy(b, u, AFFLICT, p.affliction.redeploy); afflicted(b).add(u);
  };
  const auraOn = (b, a) => b.time + 1e-9 >= a.auraOffUntil;
  const setAura = (b, e, a) => {
    const on = auraOn(b, a) && e.alive;
    if (on && !e.findBuff('ab:crimsonCrown'))
      b.addBuff(e, { key: 'ab:crimsonCrown', persist: true, status: 'sanctuary',
        mods: { physTakenMul: 1 - p.aura.sanctuary, artsTakenMul: 1 - p.aura.sanctuary } });
    if (!on && e.findBuff('ab:crimsonCrown')) b.removeBuff(e, 'ab:crimsonCrown');
    a.heal.update(on ? b.enemiesInRadius(e.x, e.y, p.aura.radius).filter(u => u !== e && live(u)) : []);
  };
  const endEdict = (b, e, a) => { a.cast = null; unroot(b, e, a); };
  const sunken = (b, e, a, kind) => {
    if (a.cast) endEdict(b, e, a);
    a.sunken = { t: 0, destroyed: false };
    a.rounds.push(new BloodSurgeRound(b, e, { interval: p.sunken.interval, duration: p.sunken.duration, scale: p.sunken.scale,
      stun: p.sunken.stun, cross: p.sunken.cross }));
    a.sunkenCasts++; a.lastSunken = kind;
    root(b, e, a, 'Skill_2_1', p.sunken.cast);
  };
  return {
    spawn(b, e, a, ab) {
      ab.atkType = 'arts';
      a.seq = 0; a.edict = p.edict.initial; a.cast = null; a.sunken = null; a.rounds = []; a.sunkenCasts = 0; a.edicts = 0; a.ambers = 0;
      a.auraOffUntil = -Infinity; a.check = b.time + p.aura.check; a.exploded = false; a.lastSunken = null;
      a.heal = new OwnedStageAura(b, e, { key: `ab:crimsonCrownHeal:${e.id}`, strength: p.aura.heal, mods: { hpRegen: p.aura.heal } });
      b.on('damaged', c => { if (c.target === e && c.dmg?.tags?.includes('bombExplosion')) a.exploded = true; }, { owner: e });
      // The bomb (KillBmbcar) and the Loading Points (Blord2Trigger) reach him through this handle.
      e.mem.bloodLordTwo = {
        contact: p.bombContact, casting: () => !!a.sunken,
        /** A bomb's explosion against him ended: mark its Loading Point and force Sunken Death, unless casting it. */
        bombed: loader => { if (!e.alive || a.sunken) return false; if (loader) loader.marked = true; sunken(b, e, a, 'bomb'); return true; },
        /** He came within a Loading Point's Blord2Trigger: the same, for that Loading Point. */
        reached: loader => { if (!e.alive || a.sunken) return false; loader.marked = true; sunken(b, e, a, 'loader'); return true; },
      };
      setAura(b, e, a);
    },
    dealt(c, b, e, a) { if (c.dmg.isAttack && c.target?.alive) afflict(b, e, a, c.target); },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      while (b.time + 1e-9 >= a.check) {
        a.check += p.aura.check;
        // enemy_blord2_hp_aura[trigger]: hit by a bomb's Explosion -> the aura is off; Crimson Edict is interrupted.
        if (a.exploded) { a.exploded = false; a.auraOffUntil = b.time + p.aura.off; if (a.cast) endEdict(b, e, a); }
      }
      setAura(b, e, a);
      a.rounds = a.rounds.filter(r => r.tick(dt));
      if (a.sunken) {
        const s = a.sunken; s.t += dt;
        if (!s.destroyed && s.t + 1e-9 >= p.sunken.destroyAt) { s.destroyed = true; b.stageBombLoaders?.destroyMarked(); }
        if (s.t + 1e-9 >= p.sunken.cast) { a.sunken = null; unroot(b, e, a); }
        return;
      }
      a.edict -= dt;
      if (a.cast) {
        const c = a.cast; c.t += dt;
        // enemy_blord2_fog[summon]: from the cast's start, one Blood Amber every `every` s, each `delay` s later.
        while (c.nextAmber <= Math.min(c.t, p.edict.duration) + 1e-9) {
          c.nextAmber += p.edict.every;
          const route = remainingRoute(e), at = [e.y + b.rng.range(-p.edict.offset, p.edict.offset), e.x + b.rng.range(-p.edict.offset, p.edict.offset)];
          const spawn = () => { a.ambers++; return spawnChildren(b, e, p.edict.amber, 1, { route, pos: at, mods: {}, countInTotal: false }); };
          if (b.stageWaveScheduler) b.stageWaveScheduler.scheduleSummon(e, p.edict.delay, spawn); else b.after(p.edict.delay, spawn, { holdsBattle: true });
        }
        if (c.t + 1e-9 >= p.edict.duration && !c.ending) { c.ending = true; root(b, e, a, 'Skill_1_End', p.edict.end); }
        if (c.ending && !c.released && c.t + 1e-9 >= p.edict.duration + p.edict.release) {
          c.released = true;
          const at = live(e.blockedBy) ? e.blockedBy : e;
          bloodMists(b).release(e, Math.round(at.x), Math.round(at.y), p.edict.mist);
        }
        if (c.t + 1e-9 >= p.edict.duration + p.edict.end) endEdict(b, e, a);
        return;
      }
      if (a.edict > 1e-9 || !e.deployed) return;
      a.edict = p.edict.cooldown; a.edicts++;
      a.cast = { t: 0, nextAmber: 0, ending: false, released: false };
      root(b, e, a, 'Skill_1_Begin', p.edict.duration + p.edict.end);
    },
    death(c, b, e, a) {
      a.cast = null; a.sunken = null; a.rounds = [];
      a.heal?.update([]); e.mem.bloodLordTwo = null;
    },
  };
}
