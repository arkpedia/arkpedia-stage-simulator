// SPDX-License-Identifier: GPL-3.0-or-later
import { FIVE_STAR_VANGUARD_OPERATORS } from '../../../shared/arkpedia/five-star-vanguard-operators.js';
import evidence from '../../../data/arkpedia-five-star-vanguard-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys } from '../targeting.js';

const live = u => u?.alive && u.deployed && !u.hidden;
const robots = new Set(['char_285_medic2', 'char_286_cast3', 'char_376_therex',
  'char_4000_jnight', 'char_4093_frston', 'char_4188_confes', 'char_4077_palico',
  'char_4091_ulika', 'char_4136_phonor']);
export const isRegularRobot = id => robots.has(id);
const components = key => evidence.skills[key].flatMap(r => r.components);
const attackHit = id => evidence.models[id].Front.attackHit;
function buff(b, u, key, mods, enabled = true) {
  if (!enabled) b.removeBuff(u, key);
  else if (JSON.stringify(u.findBuff(key)?.mods) !== JSON.stringify(mods))
    b.addBuff(u, { key, mods });
}

/** Card talents run once for the selected squad, including a bench/support unit. */
export function prepareFiveStarVanguardSquad(records) {
  const zima = records.char_115_headbr;
  if (zima?.arkpedia.elite >= 2 && zima.talents.length) {
    for (const [id, record] of Object.entries(records))
      if (id !== 'char_115_headbr' && record.profession === 'PIONEER')
        record.stats.cost += zima.talents[0].bb.cost;
  }
  return records.char_102_texas?.talents[0]?.bb.cost ?? 0;
}

export function customizeFiveStarVanguardKit({ id, def, unit, kit }) {
  if (!FIVE_STAR_VANGUARD_OPERATORS[id]) return;
  const s = def.skill, bb = s.bb;
  kit.trait = { ...kit.trait, attack: 'melee', dmgType: 'phys', projectile: 'none',
    canHitFly: false, windup: attackHit(id) };
  if (s.id === 'skcom_charge_cost[3]') {
    kit.skill = { kind: 'instant', onStart: ({ battle }) => battle.addDp(unit.ownerId, bb.cost) };
  } else if (id === 'char_115_headbr') {
    const key = `zima:aura:${unit.id}`;
    const sync = b => {
      for (const ally of b.allyUnits) buff(b, ally, key, { atkPct: bb.atk, defPct: bb.def },
        live(unit) && unit.skill.active && live(ally) && ally.def.profession === 'PIONEER');
    };
    kit.skill = { kind: 'duration', onStart: ({ battle }) => {
      unit.mem.zimaClock = unit.mem.zimaGrants = 0; sync(battle);
    }, onTick: ({ battle, dt, skill }) => {
      unit.mem.zimaClock += Math.min(dt, skill.timeLeft);
      while (unit.mem.zimaGrants < bb.value && unit.mem.zimaClock + 1e-9 >= (unit.mem.zimaGrants + 1) * bb.interval) {
        unit.mem.zimaGrants++; battle.addDp(unit.ownerId, bb.cost);
      }
      sync(battle);
    }, onEnd: ({ battle }) => { for (const ally of battle.allyUnits) battle.removeBuff(ally, key); } };
    unit.mem.zimaSync = sync;
  } else if (id === 'char_102_texas' || id === 'char_349_chiave') {
    const texas = id === 'char_102_texas', source = components(s.id).find(c => c._damageType === 2);
    const castHit = texas ? source._preDelay : evidence.models[id].Front.skillHit;
    const select = b => b.enemiesInKeys(absoluteRangeKeys(s.rangeGrid, unit.tileR, unit.tileC, unit.dir), unit,
      { dmgType: 'arts', canHitFly: true });
    // Both FSMs disable early finish at the damage event: keep the whole
    // original cast animation, including Texas's second sword-rain release.
    const recovery = evidence.models[id].Front.animations.Skill;
    kit.skill = { kind: 'duration', duration: recovery, flags: { disarm: true }, onStart: ({ battle }) => {
      battle.addDp(unit.ownerId, bb.cost);
      const seq = unit.deploySeq;
      unit.atkCd = Math.max(unit.atkCd, recovery);
      const release = () => {
        if (!live(unit) || unit.deploySeq !== seq || !unit.canAct) return;
        for (const target of select(battle)) {
          const hit = () => {
            if (!target.alive) return;
            const dealt = battle.dealDamage(unit, target, { amount: unit.s.atk * bb.atk_scale,
              type: 'arts', isSkill: true, isAttack: true, applyWay: 'ranged' });
            if (!target.alive || !(dealt >= 0)) return;
            if (texas) battle.applyStatus(target, 'stun', { source: unit, duration: bb.stun });
            else battle.addBuff(target, { key: `chiave:RES:${unit.id}`, source: unit,
              duration: bb.duration, mods: { resMul: 1 + bb.magic_resistance } });
          };
          if (texas) {
            // Original sword-rain projectile has up to .5s random birth delay,
            // a .2s lifetime and alwaysHitTraceTargetInTheEnd.
            const p = evidence.projectile;
            battle.after(battle.rng() * p.randomDelayToBorn + p.lifeTime, hit);
          } else hit();
        }
      };
      battle.after(castHit, release, { owner: unit });
      if (texas) battle.after(castHit + source._triggerDelta, release, { owner: unit });
    } };
  } else if (id === 'char_488_buildr') {
    kit.skill = { kind: 'duration', mods: { atkPct: bb.atk, defPct: bb.def },
      onStart: ({ battle, skill }) => {
        battle.addDp(unit.ownerId, bb.cost); unit.mem.poncirusClock = 0;
        // The second activation enters the permanent skill mode for this life.
        if (skill.activations >= 2) { skill.kind = 'toggle'; skill.timeLeft = Infinity; }
      }, onTick: ({ battle, dt, skill }) => {
        if (skill.activations < 2) return;
        unit.mem.poncirusClock += dt;
        const interval = bb['buildr_s_2[b].interval'];
        while (unit.mem.poncirusClock + 1e-9 >= interval) {
          unit.mem.poncirusClock -= interval; battle.addDp(unit.ownerId, bb['buildr_s_2[b].cost']);
        }
      } };
  } else if (id === 'char_261_sddrag') {
    kit.skill = { kind: 'duration', mods: { atkPct: bb.atk,
      ...(s.id === 'skcom_quickattack[3]' ? { aspd: bb.attack_speed } : {}) },
      ...(s.id === 'skchr_sddrag_2' ? { attack: { onHit: ({ battle, unit, target }) => {
        if (target?.alive) battle.dealDamage(unit, target, {
          amount: unit.s.atk * bb['attack@skill.atk_scale'], type: 'arts',
          isSkill: true, isAttack: true, applyWay: 'none',
        });
      } }, onStart: () => { unit.profile.dpOnKill = 2; },
      onEnd: () => { unit.profile.dpOnKill = 1; } } : {}) };
  }
}

export function installFiveStarVanguard({ battle: b, unit: u, def }) {
  const id = def.charId, talent = def.talents[0]?.bb;
  if (!FIVE_STAR_VANGUARD_OPERATORS[id]) return;
  if (id === 'char_115_headbr' && def.skill.id === 'skchr_headbr_2') {
    b.on('kill', ({ killer, victim }) => {
      if (live(u) && u.skill.active && live(killer) && killer.def.profession === 'PIONEER' && victim.side === 'enemy')
        b.addDp(u.ownerId, 1);
    }, { owner: u });
    b.on('deploy', () => u.mem.zimaSync?.(b), { owner: u });
  } else if (id === 'char_349_chiave' && talent) {
    const key = `chiave:robots:${u.id}`;
    const sync = () => {
      if (!live(u)) return;
      const count = b.allyUnits.filter(t => live(t) && isRegularRobot(t.defId)).length;
      buff(b, u, key, { atkPct: talent.atk * count, defPct: talent.def * count });
      for (const ally of b.allyUnits) if (live(ally) && isRegularRobot(ally.defId))
        buff(b, ally, key, { redeployMul: talent.respawn_time });
    };
    b.on('deploy', sync, { owner: u }); b.on('tick', sync, { owner: u });
    b.on('death', ({ unit }) => {
      if (unit === u) for (const ally of b.allyUnits) b.removeBuff(ally, key);
      else sync();
    }, { owner: u });
  } else if (id === 'char_488_buildr' && talent) {
    b.on('deploy', ({ unit }) => {
      if (unit !== u) return;
      b.after(talent.interval, () => { if (live(u)) b.addBuff(u, {
        key: 'poncirus:endurance', mods: { hpPct: talent.max_hp },
      }); }, { owner: u });
    }, { owner: u });
  } else if (id === 'char_261_sddrag' && talent)
    b.addBuff(u, { key: 'reed:RES', mods: { resFlat: talent.magic_resistance }, persist: true, allowDead: true });
}
