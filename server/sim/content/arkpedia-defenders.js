// SPDX-License-Identifier: GPL-3.0-or-later
// See data/arkpedia-defender-prefabs.json for original selectors/buff formulas.
export const DEFENDER_CLIENT_EVIDENCE = Object.freeze({
  version: '26-09-23-17-49-43_b9cc4a',
  charpacks: {
    char_150_snakek: '189cf92c1e54422e68e08c381dafe0b3',
    char_381_bubble: '477801945b767c737d5fc12a6f38a9fd',
    char_196_sunbr: '77b2c9b48b9650e8619643c2a232fb6b',
    char_260_durnar: '28d19a07f25e2311dafd6319e6d0e7db',
  },
});

/** Before SkillRuntime construction; each deployment receives its own kit. */
export function customizeDefenderKit({ id, def, kit }) {
  const skill = def.skill;
  if (!skill) return;
  const bb = skill.bb;
  if (id === 'char_150_snakek' && skill.id === 'skchr_snakek_2') {
    kit.skill = {
      id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration,
      flags: { disarm: true }, attack: { noAttack: true },
      mods: { defPct: bb.def, blockCnt: bb.block_cnt,
        hpRegenRatio: bb.hp_recovery_per_sec_by_max_hp_ratio },
    };
  } else if (id === 'char_381_bubble' && skill.id === 'skchr_bubble_2') {
    kit.skill = {
      id: skill.id, name: skill.name, kind: 'duration', duration: skill.duration,
      flags: { disarm: true }, attack: { noAttack: true },
      mods: { defPct: bb.def, taunt: bb.taunt_level },
    };
  } else if (id === 'char_260_durnar') {
    // The Arts Protector trait changes BOTH skills' attack modes to Arts.
    kit.skill.attack = { ...kit.skill.attack, dmgType: 'arts' };
  } else if (id === 'char_196_sunbr') {
    if (!skill.rangeGrid?.length) throw Error('Missing source Gummy skill range');
    const heal = { dmgType: 'heal', healScale: 1,
      heal: { mode: 'single', count: 1 }, maxTargets: 1 };
    if (skill.id === 'skchr_sunbr_1') {
      kit.skill = {
        id: skill.id, name: skill.name, kind: 'charges', charges: bb.ct,
        heal: true, trigger: { rule: 'SKILL_RANGE', allies: true,
          grid: skill.rangeGrid, hpAtMost: 1 },
        targeting: { rangeGrid: skill.rangeGrid },
        attack: { ...heal, healScale: bb.heal_scale },
      };
    } else {
      // The client sequence waits for the ten-second DEF/disarm buff to finish,
      // then switches to healing for the full source duration (30s).
      const prepKey = 'gummy:cooking:prep', healKey = 'gummy:cooking:heal';
      kit.skill = {
        id: skill.id, name: skill.name, kind: 'duration',
        duration: bb.disarm + skill.duration,
        heal: true, targeting: { rangeGrid: skill.rangeGrid }, attack: heal,
        onStart: ({ battle, unit, skill: runtime }) => {
          const activation = runtime.activations;
          battle.addBuff(unit, { key: prepKey, source: unit, duration: bb.disarm,
            flags: { disarm: true }, mods: { defPct: bb.def },
            onExpire: () => {
              if (!unit.alive || !unit.deployed || !runtime.active
                || runtime.activations !== activation) return;
              // Transition on the preparation buff's expiry, as the client
              // sequence does. A separate scheduler would leave one tick of
              // healing without the ATK buff after disarm has already expired.
              battle.addBuff(unit, { key: healKey, source: unit,
                mods: { atkPct: bb.atk, batPct: bb.base_attack_time } });
            },
          });
        },
        onEnd: ({ battle, unit }) => {
          battle.removeBuff(unit, prepKey); battle.removeBuff(unit, healKey);
        },
      };
    }
  }
}

/** After setup, before deployment, so hooks exist for the first incoming hit. */
export function installDefender({ battle, unit, def }) {
  const id = def.charId, talent = def.talents[0]?.bb;
  if (id === 'char_381_bubble') {
    battle.on('damaged', ({ source, target, dmg }) => {
      if (target !== unit || !source?.alive || source.side !== 'enemy' || !dmg
        || dmg.tags?.includes('hpLoss')) return;
      if (talent) battle.applyStatus(source, 'weaken', {
        duration: talent.duration, source: unit, value: -talent.atk,
      });
      if (unit.skill.active && unit.skill.id === 'skchr_bubble_2') {
        // bubble_s_2's IsDamage has no attack-only filter: sourced enemy skill
        // damage also triggers the DEF-scaled physical counter, even through a
        // shield or on a fatal hit. Dodged and sourceless hits do not reach here.
        battle.dealDamage(unit, source, { amount: unit.s.def * def.skill.bb.atk_scale,
          type: 'phys', tags: ['bubble:counter'] });
      }
    }, { owner: unit });
  } else if (id === 'char_260_durnar') {
    unit.profile.hitAllBlocked = false;
    Object.defineProperty(unit.profile, 'maxTargets', {
      enumerable: true, get: () => unit.skill.active && unit.skill.id === 'skchr_durnar_2'
        ? Math.max(1, unit.s.blockCnt) : 1,
    });
  } else if (id === 'char_196_sunbr' && talent) {
    const prev = unit.profile.dmgMul, after = unit.profile.afterHit;
    // This damage callback never executes for a healing attack. Keep the roll
    // on the one physical damage instance rather than mutating the shared
    // profile during beforeAttack (the inactive profile is used by reference).
    unit.profile.dmgMul = (b, u, target) => {
      u.mem.gummyCritical = b.rng.chance(talent.prob);
      return (u.mem.gummyCritical ? talent.atk_scale : 1)
        * (typeof prev === 'function' ? prev(b, u, target) : prev ?? 1);
    };
    unit.profile.afterHit = (b, u, target, ctx) => {
      if (u.mem.gummyCritical && target?.alive) b.applyStatus(target, 'stun', {
        duration: talent.stun, source: u,
      });
      if (after) after(b, u, target, ctx);
    };
  }
}
