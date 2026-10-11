// SPDX-License-Identifier: GPL-3.0-or-later
// Global tables: 57010cb5b2afea112cae57daa756b58676ba6850.
// Original client skill/character prefab evidence is in data/arkpedia-sniper-prefabs.json.

export function customizeSniperKit({ id, def, unit, kit }) {
  const skill = def.skill;
  if (!skill) return;
  const bb = skill.bb;
  if (id === 'char_235_jesica' && skill.id === 'skchr_jesica_2') {
    // jesica_s_2 uses the evade template's PHYSICAL_AND_MAGICAL mask.
    kit.skill.mods = { atkPct: bb.atk, dodgePhys: bb.prob, dodgeArts: bb.prob };
    kit.skill.attack = { dmgType: 'phys' };
  }
  if (id === 'char_126_shotst') {
    // The skill's DEF modifier belongs to the victim, never Meteor herself.
    // MUL_FINAL composes with other DEF reductions and only one stack refreshes.
    kit.skill.mods = {};
    kit.skill.targeting = { maxTargets: skill.id === 'skchr_shotst_2' ? 5 : 1 };
    const airScale = def.talents[0]?.bb.atk_scale ?? 1;
    kit.skill.attack = {
      dmgType: 'phys', atkScale: bb.atk_scale,
      dmgMul: (battle, attacker, target) => {
        battle.addBuff(target, {
          key: `meteor:def:${attacker.id}`, duration: bb.duration, source: attacker,
          mods: { defMul: 1 + bb.def }, refresh: 'replace',
        });
        return target.isFlying ? airScale : 1;
      },
    };
  }
  if (id === 'char_190_clour' && skill.id === 'skchr_clour_2') {
    kit.skill.mods = { atkPct: bb.atk };
    kit.skill.targeting = { maxTargets: bb['attack@max_target'] };
    kit.skill.attack = { dmgType: 'phys' };
  }
  if (id === 'char_133_mm') {
    // Store status callbacks in the attack profile: a fired skill attack still
    // carries its effects if the instant skill has ended before damage resolves.
    delete kit.skill.onHit;
    if (skill.id === 'skchr_mm_1') {
      kit.skill.attack = {
        dmgType: 'phys', atkScale: bb.atk_scale,
        onEachHit: ({ battle, unit, target }) => battle.applyStatus(target, 'sluggish', {
          duration: bb.sluggish, source: unit,
        }),
      };
    } else {
      // BASE_ATTACK_TIME formulaItem ADDITION_PERCENT: 0.5 gives 1.5× BAT.
      kit.skill.mods = { atkPct: bb.atk, batPct: bb.base_attack_time };
      kit.skill.attack = {
        dmgType: 'phys',
        onEachHit: ({ battle, unit, target }) => {
          battle.applyStatus(target, 'sluggish', { duration: bb['attack@sluggish'], source: unit });
          if (target.alive && battle.rng.chance(bb['attack@prob']))
            battle.applyStatus(target, 'stun', { duration: bb['attack@stun'], source: unit });
        },
      };
    }
  }
}

export function installSniper({ battle, unit, def }) {
  const talent = def.talents[0]?.bb;
  if (unit.defId === 'char_126_shotst' && talent) {
    const normalMultiplier = unit.profile.dmgMul;
    unit.profile.dmgMul = (b, u, target) =>
      (typeof normalMultiplier === 'function' ? normalMultiplier(b, u, target) : normalMultiplier ?? 1)
      * (target.isFlying ? talent.atk_scale : 1);
  }
  if (unit.defId === 'char_190_clour' && talent) {
    // Her prefab adds 15/30% of the base SP recovery attribute; timed skills
    // still block regeneration while active through the ordinary skill runtime.
    battle.addBuff(unit, {
      key: 'vermeil:sp', source: unit, persist: true, allowDead: true,
      mods: { spRecoveryFlat: unit.base.spRecovery * talent.sp_recovery_per_sec },
    });
  }
}
