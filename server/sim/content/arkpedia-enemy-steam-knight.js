// SPDX-License-Identifier: GPL-3.0-or-later
// "The Last Steam Knight" (enemy_1533_stmkgt). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-steam-knight-features.js). Forms: 'first' -> 'reviving' -> 'second' -> dead; a HeroBomb
// (the native HeroBomb_1 / HeroBomb_2 modes) runs inside either form as `a.bomb`.
import { canTargetAlly } from '../targeting.js';

const CAST = 'ab:stmkgtCast', HOLD = 'ab:stmkgtHold', DEBUFF = 'stmkgt_t_debuff', BOOST = 'stmkgt_t_boost',
  SECOND = 'stmkgt_boost[second]', INV = 'stmkgt_t_state_2[reborn_invincible]', AFTER = 'stmkgt2_after_boost[weak]';
// Boost (stmkgt_t_boost) and the second form: abnormalImmunes STUNNED, SILENCED, DISARMED, FROZEN, COLD, LEVITATE and
// the SLEEPING combo. HeroBomb (stmkgt_invincible[hero_bomb]): STUNNED, SILENCED, FROZEN, LEVITATE, DISARMED_COMBAT,
// PALSY/PALSYING and SLEEPING.
const BOOST_IMMUNE = ['stun', 'silence', 'disarm', 'frozen', 'cold', 'levitate', 'sleep'];
const BOMB_IMMUNE = ['stun', 'silence', 'frozen', 'levitate', 'disarmedcombat', 'palsy', 'sleep'];
const CONTROL = ['stun', 'freeze', 'cold', 'sleep', 'levitate', 'disarm', 'tremble', 'palsy', 'silence'];
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const key = (r, c) => `${r},${c}`;

export function steamKnight(p) {
  validate(p);
  const form2 = a => a.form === 'second';
  const pick = (a, pair) => pair[form2(a) ? 1 : 0];

  // --- Immunities: the record's own set plus whatever the current state grants ---
  const immunity = (e, a) => {
    const extra = [...(a.boosting || a.secondBoost ? BOOST_IMMUNE : []), ...(a.bomb ? BOMB_IMMUNE : [])];
    e.def = { ...e.def, immune: new Set([...a.baseImmune, ...extra]) };
  };
  const clearControl = (b, e) => { for (const k of CONTROL) if (e.findBuff(k)) b.removeStatus(e, k); };

  const finishCast = (b, e, a) => { a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST); };
  const startCast = (b, e, a, cast) => {
    a.cast = { ...cast, elapsed: 0, released: false };
    e.profile.noAttack = true; e.skillAnimUntil = b.time + cast.dur;
    b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true } });
  };
  const hold = (b, e, a) => {
    if (a.cast) finishCast(b, e, a);
    e.profile.noAttack = true;
    b.addBuff(e, { key: HOLD, persist: true, flags: { invulnerable: true, unblockable: true, untargetable: true, noMove: true, noDisplace: true } });
    b.releaseBlocked?.(e);
  };
  const unhold = (b, e) => { b.removeBuff(e, HOLD); e.profile.noAttack = false; if (e.route) e.route.pts = null; e.atkCd = 0; };

  // --- Boost (first form): 15 s of attack speed, movement and control immunity; a hard level adds 30% damage
  // resistance, a normal one stuns him for 5 s when it ends (stmkgt_t_boost[buff] ON_BUFF_FINISH, first state only).
  const boost = (b, e, a) => {
    b.removeBuff(e, DEBUFF); // stmkgt_t_finish_weak: the debut slow ends with the first Boost
    a.boosting = true; immunity(e, a);
    b.addBuff(e, { key: BOOST, duration: p.boost.duration, visible: true,
      mods: { aspd: p.boost.aspd, moveMul: 1 + p.boost.move, ...(p.boost.hard ? { dmgTakenMul: 1 - p.boost.resistance } : {}) },
      onExpire: () => end(), onRemove: () => end() });
    const end = () => {
      a.boosting = false; immunity(e, a);
      if (!p.boost.hard && a.form === 'first' && e.alive) b.applyStatus(e, 'stun', { duration: p.boost.stun, source: e });
    };
  };

  // --- HeroBomb (誓死) ---
  const bombSpec = a => form2(a) ? p.bomb.second : p.bomb.first;
  const byMaxHp = (b, e, n) => b.allies().filter(u => live(u) && !u.isFlying && canTargetAlly(e, u, true))
    .sort((x, y) => y.s.maxHp - x.s.maxHp || x.deploySeq - y.deploySeq).slice(0, n);
  const startBomb = (b, e, a) => {
    a.pendingBomb = false;
    if (a.cast) finishCast(b, e, a);
    const spec = bombSpec(a);
    a.bomb = { spec, phase: 'fly', t: 0, fly: pick(a, p.bomb.fly), land: pick(a, p.bomb.land), marked: [], areas: [] };
    hold(b, e, a); immunity(e, a); clearControl(b, e);
  };
  const fireArea = (b, e, a, target) => {
    const spec = a.bomb.spec, r0 = Math.round(target.y), c0 = Math.round(target.x);
    const tiles = new Set(p.bomb.tiles.map(([dr, dc]) => key(r0 + dr, c0 + dc)));
    if (spec.hard) {
      // stmkgt_s[hero_hard]: trap_055_tileblock (封印的地面, permanent, no deployment) on each buildable tile of the
      // x-4 area. A token cannot be placed on an occupied tile, so units already standing there are untouched.
      b.noDeployTiles ??= new Set();
      for (const k of tiles) {
        const [r, c] = k.split(',').map(Number);
        if (!b.grid.inRect(r, c) || !['MELEE', 'RANGED', 'ALL'].includes(b.grid.tile(r, c).build)) continue;
        if (b.allies(null, { includeTargetableDevices: true }).some(u => live(u) && Math.round(u.y) === r && Math.round(u.x) === c)) continue;
        b.noDeployTiles.add(k);
      }
    }
    b.fx?.('telegraph', { x: c0, y: r0, r: 1.5, dur: p.bomb.life, kind: 'stmkgtBombard' });
    a.bomb.areas.push({ tiles, t: 0, ticks: 0, hits: 0, done: false });
  };
  const tickArea = (b, e, a, area, dt) => {
    area.t += dt;
    // projectile_enemy_stmkgt_s: every 0.5 s (first after 0.5 s) for 5.5 s, the unit in the area with the highest HP
    // ratio (ground and air); at most 8 hits. stmkgt_s[damage] lands 0.2 s after the hit.
    while (!area.done && area.t + 1e-9 >= (area.ticks + 1) * p.bomb.interval && (area.ticks + 1) * p.bomb.interval <= p.bomb.life + 1e-9) {
      area.ticks++;
      const target = b.allies(null, { includeTargetableDevices: true })
        .filter(u => live(u) && canTargetAlly(e, u, true) && area.tiles.has(key(Math.round(u.y), Math.round(u.x))))
        .sort((x, y) => y.hp / y.s.maxHp - x.hp / x.s.maxHp || x.deploySeq - y.deploySeq)[0];
      if (!target) continue;
      area.hits++;
      const scale = a.bomb.spec.scale;
      b.after(p.bomb.delay, () => {
        if (e.alive && live(target)) b.dealDamage(e, target, { amount: e.s.atk * scale, type: 'arts', isSkill: true, applyWay: 'none', tags: ['stmkgtBomb'] });
      }, { owner: e });
      if (area.hits >= p.bomb.maxHits) area.done = true;
    }
    if (area.t + 1e-9 >= p.bomb.life) area.done = true;
  };
  const tickBomb = (b, e, a, dt) => {
    const s = a.bomb; s.t += dt;
    if (s.phase === 'fly' && s.t + 1e-9 >= s.fly) {
      s.phase = 'mark'; s.t = 0; s.marked = byMaxHp(b, e, s.spec.targets);
    } else if (s.phase === 'mark' && s.t + 1e-9 >= s.spec.mark) {
      s.phase = 'bomb'; s.t = 0;
      for (const target of byMaxHp(b, e, s.spec.targets)) fireArea(b, e, a, target);
    } else if (s.phase === 'bomb') {
      for (const area of s.areas) if (!area.done) tickArea(b, e, a, area, dt);
      if (s.areas.every(x => x.done)) { s.phase = 'land'; s.t = 0; }
    } else if (s.phase === 'land' && s.t + 1e-9 >= s.land) {
      // stmkgt_finish_buff[when_interrupt_skill]: invincibility ends and he returns to his form (FSM restart).
      a.bomb = null; unhold(b, e); immunity(e, a);
      a.mark = e.hp / e.s.maxHp; resetSkills(a);
    }
  };

  const resetSkills = a => { a.left = { boost: form2(a) || !p.boost ? Infinity : p.boost.initial }; };

  const enterSecond = (b, e, a) => {
    a.form = 'second'; unhold(b, e); e.hp = e.s.maxHp;
    // The second-form boost: permanent for the Steam Knight; Steam Knight S's lasts boost_duration (999 s), then
    // stmkgt2_after_boost[weak] lowers DEF and RES.
    a.secondBoost = true;
    const finite = Number.isFinite(p.revive.boostDuration);
    b.addBuff(e, { key: SECOND, ...(finite ? { duration: p.revive.boostDuration } : { persist: true }), visible: true,
      mods: { aspd: p.revive.aspd, moveFlat: p.revive.move, moveMul: 1 + p.revive.moveMul,
        defFlat: p.revive.def, resFlat: p.revive.res, ...(p.revive.hard ? { dmgTakenMul: 1 - p.revive.resistance } : {}) },
      ...(finite ? { onExpire: () => {
        a.secondBoost = false; immunity(e, a);
        b.addBuff(e, { key: AFTER, persist: true, visible: true, mods: { defFlat: p.revive.after.def, resFlat: p.revive.after.res } });
      } } : {}) });
    if (p.revive.invincible > 0) b.addBuff(e, { key: INV, duration: p.revive.invincible, visible: true, flags: { invulnerable: true } });
    immunity(e, a); resetSkills(a); a.mark = 1;
    // stmkgt_t[reborn_bomb]: 0.1 s later, HeroBomb[second_state] (the Steam Knight only).
    if (p.revive.bombDelay != null)
      b.after(p.revive.bombDelay, () => { if (e.alive && a.form === 'second' && !a.bomb) startBomb(b, e, a); }, { owner: e });
  };

  return {
    spawn(b, e, a) {
      a.stmkgt = true; a.form = 'first'; a.cast = null; a.bomb = null; a.pendingBomb = false; a.boosting = false;
      a.sp = p.sp.initial; a.mark = 1; a.baseImmune = new Set(e.def.immune); resetSkills(a);
      e.profile.deferHit = true; e.profile.canTarget = u => u === e.blockedBy;
      e.def = { ...e.def, attackAnim: p.attack.anim[0] };
      // BornWeak: attack speed -50 and movement x0.5 until the first Boost.
      if (p.debut) b.addBuff(e, { key: DEBUFF, persist: true, visible: true, mods: { aspd: p.debut.aspd, moveMul: 1 + p.debut.move } });
      // Steam Knight S: talent `kill` (stmkgt2_t[failure_level_buff], InstantKill) at once, so he enters his revive.
      if (p.entry === 'reviving') { a.form = 'reviving'; a.until = b.time + p.revive.duration; hold(b, e, a); immunity(e, a); e.hp = Math.min(1, e.s.maxHp); }
    },
    attack(c, b, e, a) {
      if (!['first', 'second'].includes(a.form) || a.bomb) return;
      const target = c.targets.find(u => u?.alive);
      if (!target) return;
      b.dealDamage(e, target, { amount: e.s.atk * p.attack.scale, type: 'phys', isAttack: true, attackId: b._attackSeq, applyWay: 'melee', tags: ['stmkgtAttack'] });
      if (!e.s.flags.noSp) a.sp = Math.min(p.sp.max, a.sp + p.sp.increment);
    },
    killed(c, b, e, a) {
      if (a.form === 'first') {
        // First knock-out: the current wave is released; an 8 s revive at full HP, then the second form.
        b.stageWaveScheduler?.releaseCurrentWave(e);
        // His buffs carry on (only Boost's finish_weak ends the debut slow); a Boost that ends after this point does
        // not stun him: the stun is first-state only, and the second form is stun-immune anyway.
        a.form = 'reviving'; a.bomb = null; a.pendingBomb = false;
        a.until = b.time + p.revive.duration; hold(b, e, a); immunity(e, a); e.hp = Math.min(1, e.s.maxHp);
        return true;
      }
      return a.form === 'reviving';
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      if (a.form === 'reviving') { if (b.time + 1e-9 >= a.until) enterSecond(b, e, a); return; }
      if (a.bomb) { tickBomb(b, e, a, dt); return; }
      // stmkgt2_reach_checkpoint: once past his route's checkpoint `fromEnd` counted from the last one, the stage branch
      // advances once (MoveNextLevelBranch on reborn.branch_id).
      if (p.checkpoint && a.form === 'second' && !a.checkpointDone && e.route?.legs) {
        // The compiled route repeats the end tile as a last ordinary leg before the final one; that is not an original
        // checkpoint, so it is not counted from the back.
        const legs = e.route.legs, last = legs.at(-1), cps = legs.filter(l => !l.final);
        const repeat = last?.final && cps.length && cps.at(-1).t === 'move' && cps.at(-1).r === last.r && cps.at(-1).c === last.c;
        const checkpoints = cps.length - (repeat ? 1 : 0), index = checkpoints - 1 - p.checkpoint.fromEnd;
        if (index >= 0 && e.route.legIdx > index) {
          a.checkpointDone = true;
          if (b.stageBranches?.branches?.[p.checkpoint.branch]) b.stageBranches.advance(p.checkpoint.branch);
        }
      }
      e.def.attackAnim = pick(a, p.attack.anim);
      // HpRatioTrigger: every `threshold` of max HP lost since the mark (spawn, revive or the last HeroBomb). During
      // Zantetsuken (stmkgt_s_zantetsuken[flag]) the HeroBomb waits for the cast to end.
      if (!a.pendingBomb && a.mark - e.hp / e.s.maxHp > bombSpec(a).threshold + 1e-12) a.pendingBomb = true;
      if (a.pendingBomb && a.cast?.kind !== 'zantetsuken') { startBomb(b, e, a); return; }
      a.left.boost -= dt; // Boost's cooldown runs from the cast start
      if (a.cast) {
        if (!e.canAct) { finishCast(b, e, a); return; }
        a.cast.elapsed += dt * e.s.slowDownRate;
        if (!a.cast.released && a.cast.elapsed + 1e-9 >= a.cast.hit) {
          a.cast.released = true;
          const t = a.cast.target;
          if (a.cast.kind === 'zantetsuken' && live(t))
            for (let i = 0; i < p.zantetsuken.times && live(t); i++)
              b.dealDamage(e, t, { amount: e.s.atk * p.zantetsuken.scale, type: 'phys', isSkill: true, applyWay: 'melee', tags: ['stmkgtZantetsuken'] });
        }
        if (a.cast.elapsed + 1e-9 >= a.cast.dur) finishCast(b, e, a);
        return;
      }
      if (!e.canAct) return;
      if (a.form === 'first' && p.boost && a.left.boost <= 1e-9) {
        // Boost needs no target; its effects start with the cast (_runActionOnEvent 2) and the cooldown restarts.
        a.left.boost = p.boost.cooldown;
        startCast(b, e, a, { kind: 'boost', dur: p.boost.anim.dur, hit: Infinity });
        boost(b, e, a);
        return;
      }
      const target = e.blockedBy;
      if (a.sp + 1e-9 >= p.zantetsuken.cost && live(target)) {
        // Zantetsuken locks the blocked target: Skill_1_Begin charges until duration - Skill_1_Attack, then three hits
        // at Skill_1_Attack's OnAttack (PRTS: 4.5 s charge, 7 s skill).
        a.sp -= p.zantetsuken.cost;
        const strike = pick(a, p.zantetsuken.strike);
        startCast(b, e, a, { kind: 'zantetsuken', target, dur: p.zantetsuken.duration,
          hit: p.zantetsuken.duration - strike.dur + strike.hit });
      }
    },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, nn = v => Number.isFinite(v) && v >= 0;
  const anim = x => pos(x?.dur) && nn(x.hit) && x.hit <= x.dur, pair = x => Array.isArray(x) && x.length === 2 && x.every(anim);
  const two = x => Array.isArray(x) && x.length === 2 && x.every(pos);
  const bomb = s => pos(s?.threshold) && s.threshold < 1 && Number.isInteger(s.targets) && s.targets > 0 && pos(s.scale) && pos(s.mark) && typeof s.hard === 'boolean';
  const ok = pos(p?.attack?.scale) && pair(p.attack.anim)
    && Number.isInteger(p.sp?.max) && p.sp.max > 0 && nn(p.sp.initial) && pos(p.sp.increment)
    && (p.debut == null || Number.isFinite(p.debut.aspd) && p.debut.move > -1 && p.debut.move <= 0)
    && (p.boost == null ? p.entry === 'reviving' : pos(p.boost.cooldown) && nn(p.boost.initial) && pos(p.boost.duration) && nn(p.boost.aspd)
      && nn(p.boost.move) && p.boost.resistance > 0 && p.boost.resistance < 1 && pos(p.boost.stun) && typeof p.boost.hard === 'boolean' && anim(p.boost.anim))
    && [undefined, 'reviving'].includes(p.entry)
    && (p.checkpoint == null || Number.isInteger(p.checkpoint.fromEnd) && p.checkpoint.fromEnd >= 0 && typeof p.checkpoint.branch === 'string')
    && pos(p.zantetsuken?.cost) && p.zantetsuken.cost <= p.sp.max && Number.isInteger(p.zantetsuken.times) && p.zantetsuken.times > 0
    && pos(p.zantetsuken.scale) && pos(p.zantetsuken.duration) && pair(p.zantetsuken.strike)
    && p.zantetsuken.strike.every(s => s.dur <= p.zantetsuken.duration)
    && bomb(p.bomb?.first) && bomb(p.bomb.second) && two(p.bomb.fly) && two(p.bomb.land) && pos(p.bomb.life) && pos(p.bomb.interval)
    && Number.isInteger(p.bomb.maxHits) && p.bomb.maxHits > 0 && nn(p.bomb.delay) && Array.isArray(p.bomb.tiles) && p.bomb.tiles.length === 9
    && pos(p.revive?.duration) && nn(p.revive.invincible) && nn(p.revive.aspd) && Number.isFinite(p.revive.move) && Number.isFinite(p.revive.def)
    && Number.isFinite(p.revive.res) && typeof p.revive.hard === 'boolean' && (!p.revive.hard || p.revive.resistance > 0 && p.revive.resistance < 1)
    && (p.revive.bombDelay == null || nn(p.revive.bombDelay)) && Number.isFinite(p.revive.moveMul) && p.revive.moveMul > -1
    && (p.revive.boostDuration == null || pos(p.revive.boostDuration) && Number.isFinite(p.revive.after?.def) && Number.isFinite(p.revive.after?.res));
  if (!ok) throw Error('Invalid Steam Knight parameters');
}
