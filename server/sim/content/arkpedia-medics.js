// SPDX-License-Identifier: GPL-3.0-or-later
// Ordinary-stage skills use pinned Global blackboards and the original client selectors.
import { MEDIC_OPERATORS } from '../../../shared/arkpedia/medic-operators.js';
import { bodyInKeys } from '../body.js';

const liveAllies = battle => battle.allyUnits.filter(u => u.alive && u.deployed && !u.hidden);
function applyRestoration(battle, source, target, bb, attack) {
  // ccheal_s_heal: snapshot ATK at application; first heal after one interval,
  // evaluate the 50% HP threshold on each tick, and refresh rather than stack.
  battle.addBuff(target, {
    key: `gavial:restoration:${source.defId}`, source, duration: bb.duration, interval: bb.interval,
    onTick: ({ unit }) => battle.heal(source, unit,
      attack * (unit.hpRatio < bb.hp_ratio ? bb.heal_scale_2 : bb.heal_scale)),
  });
}

export function customizeMedicKit({ battle, id, def, kit }) {
  if (!MEDIC_OPERATORS[id]) return;
  const bb = def.skill.bb;
  if (id === 'char_117_myrrh') {
    kit.skill.attack = { ...kit.skill.attack, heal: { mode: 'multi', count: 2 } };
  }
  if (id === 'char_187_ccheal') {
    if (def.skill.id === 'skchr_ccheal_1') {
      kit.skill.kind = 'charges';
      kit.skill.attack = { dmgType: 'heal', healScale: 1, heal: { mode: 'single', count: 1 } };
      kit.skill.onHit = ({ unit, target }) => applyRestoration(battle, unit, target, bb, unit.s.atk);
    } else {
      // S2 is a single application to all in-range allies, including full-HP ones;
      // normal healing resumes immediately while the recipient buffs tick.
      kit.skill = { kind: 'instant', onStart: ({ unit }) => {
        const attack = unit.s.atk;
        for (const ally of liveAllies(battle).filter(ally => bodyInKeys(ally, unit.rangeKeySet)
          && (ally === unit || !(ally.s.flags.noHeal || ally.profile.noHeal))))
          applyRestoration(battle, unit, ally, bb, attack);
      } };
    }
  }
  if (def.skill.id === 'skchr_susuro_2') {
    const key = `${id}:${def.skill.id}`, limit = bb.skill_max_trigger_time;
    kit.skill.remainingUses = () => Math.max(0, limit - (battle.regularSkillUses.get(key) ?? 0));
    kit.skill.isExhausted = () => kit.skill.remainingUses() <= 0;
    kit.skill.onStart = () => battle.regularSkillUses.set(key, (battle.regularSkillUses.get(key) ?? 0) + 1);
  }
}

export function installMedic({ battle, unit, def }) {
  const id = def.charId;
  if (!MEDIC_OPERATORS[id]) return;
  const talent = def.talents[0]?.bb;
  if (!talent) return;
  if (id === 'char_117_myrrh') {
    battle.on('deploy', ({ unit: deployed }) => {
      if (deployed !== unit) return;
      for (const ally of liveAllies(battle)) battle.heal(unit, ally, unit.s.atk * talent.heal_scale);
    }, { owner: unit });
  }
  if (id === 'char_187_ccheal') {
    battle.on('deploy', ({ unit: deployed }) => {
      if (deployed !== unit) return;
      for (const ally of liveAllies(battle).filter(u => u.def.profession === 'MEDIC'))
        battle.addBuff(ally, { key: `gavial:deploy:${unit.id}`, source: unit,
          duration: talent.duration, mods: { atkPct: talent.atk, defFlat: talent.def } });
    }, { owner: unit });
  }
  if (id === 'char_181_flower') {
    const key = `perfumer:lavender:${unit.id}`;
    const sync = () => {
      if (!unit.alive || !unit.deployed) return;
      const rate = unit.s.atk * talent.atk_to_hp_recovery_ratio;
      for (const ally of liveAllies(battle)) {
        const buff = ally.findBuff(key);
        if (buff) {
          if (buff.mods.hpRegen !== rate) { buff.mods.hpRegen = rate; ally.markDirty(); }
        } else battle.addBuff(ally, { key, source: unit, mods: { hpRegen: rate } });
      }
    };
    // Regeneration is an attribute effect, including on units that cannot receive
    // direct heals. It tracks the current ATK and stops when Perfumer leaves.
    battle.on('deploy', sync, { owner: unit });
    battle.on('tick', sync, { owner: unit });
    battle.on('skillStart', ({ unit: caster }) => { if (caster === unit) sync(); }, { owner: unit });
    battle.on('death', ({ unit: dead }) => {
      if (dead === unit) for (const ally of battle.allyUnits) {
        const buff = ally.findBuff(key); if (buff) battle.removeBuff(ally, buff);
      }
    }, { owner: unit });
  }
}

/** Sussurro's talent applies from the selected squad, even before deployment. */
export function installMedicSquad({ battle, records }) {
  const source = records['char_298_susuro'];
  const talent = source?.talents[0]?.bb;
  if (!talent) return;
  battle.on('heal', ctx => {
    if (ctx.opts.regen || ctx.target.side !== 'ally' || ctx.target.kind !== 'op') return;
    const record = records[ctx.target.defId];
    // Check the selected build's potential-adjusted DP cost, not redeploy inflation.
    if (record && record.stats.cost <= talent.cost) ctx.amount *= talent.heal_scale;
  });
}
