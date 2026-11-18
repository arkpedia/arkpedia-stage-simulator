// SPDX-License-Identifier: GPL-3.0-or-later
// Mephisto, "The Singer" (enemy_1514_smephi). Every number arrives in `p` from
// the reviewed contract (shared/arkpedia/enemy-mephisto-features.js). He runs
// through three native modes: Active, Dormant (Shield) and Rage.
import { rebornAbility } from './arkpedia-enemy-forms.js';
import { blinkToNextCheckpoint } from './arkpedia-enemy-awaken.js';
import { auraSelectable } from '../targeting.js';

export const TOXICITY = 'smephi_poison_trigger';
const AURA_BUFF = 'smephi_state_1_aura[derived]', DORMANT_BUFF = 'smephi_state_2[shield]', CAST_BUFF = 'ab:smephiCast';
const HIDE_BUFF = 'smephi_move_flag';
const live = u => u?.alive && u.deployed !== false && !u.hidden;

export function mephisto(p) {
  validate(p);
  let mode = 'active';
  const stage = () => mode === 'rage' ? p.rage : p.active;

  const finishCast = (b, e, a) => {
    if (!a.cast) return;
    const cast = a.cast; a.cast = null;
    if (cast.kind === 'dust') b.removeBuff(e, 'smephi_c_poison_release');
    e.profile.noAttack = mode === 'dormant'; e.skillAnimUntil = b.time; b.removeBuff(e, CAST_BUFF);
  };
  const startCast = (b, e, a, cast) => {
    finishCast(b, e, a);
    a.cast = { elapsed: 0, released: false, ...cast };
    e.profile.noAttack = true; e.skillAnimUntil = b.time + cast.duration;
    b.addBuff(e, { key: CAST_BUFF, persist: true, flags: { noMove: true } });
  };
  const tickCast = (b, e, a, dt) => {
    const cast = a.cast;
    cast.elapsed += dt * e.s.slowDownRate;
    if (!cast.released && cast.elapsed + 1e-9 >= cast.release) { cast.released = true; cast.onRelease?.(b, e, a); }
    e.skillAnimUntil = b.time + Math.max(0, cast.duration - cast.elapsed);
    if (cast.elapsed + 1e-9 >= cast.duration) { const end = cast.onEnd; finishCast(b, e, a); end?.(b, e, a); }
  };

  // --- Host aura (Active and Rage): enemies tagged `mutant` gain ATK and ASPD while he is on the field ---
  const hosts = (b, e) => b.enemies.filter(u => u !== e && live(u) && u.side === e.side && u.tags?.has(p.hostTag));
  const refreshAura = (b, e, a) => {
    const on = e.alive && mode !== 'dormant' && a.state !== 'reborn' && a.second?.state !== 'reborn';
    const want = on ? new Set(hosts(b, e)) : new Set();
    for (const u of a.auraTargets) if (!want.has(u)) { if (u.findBuff(AURA_BUFF)?.source === e) b.removeBuff(u, AURA_BUFF); a.auraTargets.delete(u); }
    const s = stage();
    for (const u of want) {
      const buff = u.findBuff(AURA_BUFF);
      if (!buff || buff.source !== e || buff.level !== s) {
        b.addBuff(u, { key: AURA_BUFF, source: e, persist: true, visible: true, mods: { atkPct: s.hostAtk, aspd: s.hostAspd } });
        const fresh = u.findBuff(AURA_BUFF); if (fresh) fresh.level = s;
      }
      a.auraTargets.add(u);
    }
  };

  // --- Toxicity: a 30 s stack (at most five, each on its own clock) per ratio of HP lost, and the dust it drives ---
  const addStack = (b, e, a) => {
    a.stacks.push(b.time + p.toxicity.duration);
    a.stacks.sort((x, y) => x - y);
    while (a.stacks.length > p.toxicity.max) a.stacks.shift();
    if (a.dustAt == null) a.dustAt = b.time + p.toxicity.interval;
    // Dust Release: a short cast with invincibility and disarm (smephi_c_poison_release).
    startCast(b, e, a, { kind: 'dust', duration: p.dust.duration, release: p.dust.duration });
    b.addBuff(e, { key: 'smephi_c_poison_release', persist: true, flags: { invulnerable: true, disarm: true } });
  };
  const tickDust = (b, e, a) => {
    a.stacks = a.stacks.filter(t => t > b.time + 1e-9);
    if (!a.stacks.length) { a.dustAt = null; return; }
    while (a.dustAt != null && b.time + 1e-9 >= a.dustAt) {
      a.dustAt += p.toxicity.interval;
      const amount = p.toxicity.damage * a.stacks.length;
      for (const u of b.allies(null, { includeTargetableDevices: true })) {
        if (!live(u) || u.isFlying || u.s.flags.untargetable) continue;
        b.dealDamage(null, u, { amount, type: 'true', sourceless: true, noSp: true, canDodge: false, ignoreSelect: true, tags: ['mephistoDust'] });
      }
    }
  };
  const thresholds = (e, a) => Math.floor((a.mark - e.hp / e.s.maxHp) / stage().toxicityRatio + 1e-9);

  // --- Heal (Active and Rage): up to three hurt allies, the lowest HP ratio first; never himself ---
  const hurt = (b, e) => b.enemies.filter(u => u !== e && live(u) && u.side === e.side && u.hp < u.s.maxHp && !u.mem?.stageUnitDevice)
    .sort((x, y) => x.hp / x.s.maxHp - y.hp / y.s.maxHp);
  const heal = (b, e) => { for (const u of hurt(b, e).slice(0, p.heal.max)) b.heal(e, u, e.s.atk * p.heal.scale); };

  // --- Two revives: Active -> Dormant, then Dormant -> Rage ---
  const enterMode = (b, e, a, next) => {
    mode = next;
    a.mark = e.hp / e.s.maxHp; a.fired = 0;
    if (next === 'dormant') {
      b.addBuff(e, { key: DORMANT_BUFF, persist: true, visible: true, mods: { defFlat: p.dormant.def, resFlat: p.dormant.res }, flags: { disarm: true } });
      a.dormantUntil = b.time + p.dormant.duration;
      e.profile.noAttack = true;
    } else {
      b.removeBuff(e, DORMANT_BUFF); a.dormantUntil = null;
      b.addBuff(e, { key: 'smephi_t_state_3[reborn]', persist: true, visible: true, mods: { atkPct: p.rage.atk } });
      e.profile.noAttack = false; a.healLeft = p.heal.initial;
    }
    refreshAura(b, e, a);
  };
  const first = rebornAbility({ dur: p.rebirth, hpRatio: 1, invincible: p.dormant.invincible, key: 'ab:smephiReborn1',
    onKo(b, e, a) { finishCast(b, e, a); b.stageWaveScheduler?.releaseCurrentWave(e, { trackSourceAtNextWave: true }); },
    onReborn(b, e, a) { enterMode(b, e, a, 'dormant'); } });
  const second = rebornAbility({ dur: p.rebirth, hpRatio: 1, invincible: p.rage.invincible, key: 'ab:smephiReborn2',
    onKo(b, e) { b.stageWaveScheduler?.releaseCurrentWave(e); },
    onReborn(b, e, a2) {
      const a = a2.parent;
      // Back with the HP he had (at least half): a knock-out leaves the minimum, the 100 s timeout his current HP.
      const ratio = Math.max(p.rage.minHp, a.markBeforeRage ?? 0);
      b.after(0, () => { if (e.alive) { e.hp = Math.max(1, e.s.maxHp * ratio); a.mark = e.hp / e.s.maxHp; } }, { owner: e });
      enterMode(b, e, a, 'rage');
    } });

  return {
    iv: 0,
    spawn(b, e, a) {
      a.cast = null; a.stacks = []; a.dustAt = null; a.auraTargets = new Set(); a.mark = 1; a.fired = 0;
      a.healLeft = p.heal.initial; a.blinkLeft = p.blink.initial; a.blinks = 0; a.hideUntil = null;
      a.second = { parent: a };
      e.profile.shot = 'none'; e.profile.deferHit = true; e.profile.melee = false;
      e.profile.maxTargets = p.attack.maxTargets; e.profile.canTarget = u => !u.isFlying;
      e.def = { ...e.def, attackAnim: p.attack.anim };
      b.addBuff(e, { key: 'smephi_immune', persist: true, flags: { noMove: true, unblockable: true } });
    },
    attack(c, b, e) {
      if (mode === 'dormant') return;
      const attackId = b._attackSeq;
      for (const u of c.targets) b.addProjectile({ from: e, target: u, speed: p.attack.speed, visual: 'enemy', source: e, onHit: hit => {
        if (hit.target?.alive) b.dealDamage(e, hit.target, { amount: e.s.atk, type: 'arts', isAttack: true, attackId, applyWay: 'ranged', tags: ['mephistoAttack'] });
      } });
    },
    taken(_c, b, e, a) {
      if (!e.alive || e.hp <= 0 || a.state === 'reborn' || a.second.state === 'reborn' || mode === 'dormant') return;
      const k = thresholds(e, a);
      while (a.fired < k) { a.fired++; addStack(b, e, a); }
    },
    tick(b, e, a, dt) {
      tickDust(b, e, a);
      refreshAura(b, e, a);
      if (a.state === 'reborn' || a.second.state === 'reborn') return;
      if (mode === 'dormant') {
        a.healTick = (a.healTick ?? 0) + dt;
        while (a.healTick >= 1) { a.healTick -= 1; b.heal(e, e, p.dormant.heal); }
        if (a.dormantUntil != null && b.time + 1e-9 >= a.dormantUntil) { a.markBeforeRage = e.hp / e.s.maxHp; a.dormantUntil = null; b.kill(e, e); }
        return;
      }
      a.blinkLeft -= dt; a.healLeft -= dt;
      // Blink: hidden and protected, then he reappears at the next route checkpoint.
      if (a.hideUntil != null) {
        if (b.time + 1e-9 >= a.hideUntil) { a.hideUntil = null; blinkToNextCheckpoint(e); b.removeBuff(e, HIDE_BUFF); e.profile.noAttack = false; }
        return;
      }
      if (a.cast) { tickCast(b, e, a, dt); return; }
      if (!e.canAct) return;
      if (a.blinkLeft <= 1e-9) {
        a.blinkLeft = p.blink.cooldowns[Math.min(a.blinks, p.blink.cooldowns.length - 1)]; a.blinks++;
        a.hideUntil = b.time + p.blink.hide; e.profile.noAttack = true;
        b.addBuff(e, { key: HIDE_BUFF, duration: p.blink.hide, flags: { invulnerable: true, untargetable: true, unblockable: true } });
        return;
      }
      if (a.healLeft <= 1e-9 && hurt(b, e).length) {
        a.healLeft = p.heal.cooldown;
        startCast(b, e, a, { kind: 'heal', duration: p.heal.anim.duration, release: p.heal.anim.release, onRelease: heal });
      }
    },
    killed(c, b, e, a) {
      if (mode === 'active') return first.killed(c, b, e, a);
      if (mode === 'dormant') { a.markBeforeRage ??= 0; return second.killed(c, b, e, a.second); }
      return false;
    },
    death(_c, b, e, a) { finishCast(b, e, a); refreshAura(b, e, a); },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, nn = v => Number.isFinite(v) && v >= 0;
  const st = s => s && pos(s.toxicityRatio) && nn(s.hostAtk) && nn(s.hostAspd);
  if (!p || !st(p.active) || !st(p.rage) || !nn(p.rage.atk) || !nn(p.rage.invincible) || !(p.rage.minHp > 0 && p.rage.minHp <= 1)
    || !p.dormant || !nn(p.dormant.def) || !nn(p.dormant.res) || !nn(p.dormant.heal) || !pos(p.dormant.duration) || !nn(p.dormant.invincible)
    || !p.toxicity || !pos(p.toxicity.duration) || !pos(p.toxicity.interval) || !nn(p.toxicity.damage) || !Number.isSafeInteger(p.toxicity.max)
    || !p.dust || !pos(p.dust.duration) || !p.heal || !pos(p.heal.cooldown) || !nn(p.heal.initial) || !Number.isSafeInteger(p.heal.max) || !pos(p.heal.scale)
    || !p.heal.anim || !pos(p.heal.anim.duration) || !p.blink || !nn(p.blink.initial) || !nn(p.blink.hide) || !Array.isArray(p.blink.cooldowns) || !p.blink.cooldowns.every(pos)
    || !p.attack || !pos(p.attack.speed) || !Number.isSafeInteger(p.attack.maxTargets) || !p.attack.anim || !pos(p.attack.anim.dur)
    || !pos(p.rebirth) || typeof p.hostTag !== 'string') throw Error('Invalid Mephisto');
}
mephisto.validate = validate;
