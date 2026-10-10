// SPDX-License-Identifier: GPL-3.0-or-later
import { SUPPORT_AURA_OPERATORS } from '../../../shared/arkpedia/support-aura-operators.js';
import evidence from '../../../data/arkpedia-support-aura-prefabs.json' with { type: 'json' };
import { bodyInKeys } from '../body.js';
import { aggregateMods } from '../buffs.js';
import { registerNamedSpRecovery } from './arkpedia-five-star-medic.js';

const HEIDI = 'char_4045_heidi', ANGELINA = 'char_291_aglina', SUZURAN = 'char_358_lisa';
const live = a => a?.alive && a.deployed && !a.hidden;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const timed = (clip, cap = 1) => (_b, u) => model(u).hits[clip][0] / Math.min(cap, u.s.aspd / 100);
const ally = (b, u, a, ignoreIsolation = false) => live(a) && a.kind !== 'device'
  && (ignoreIsolation || b.allySelectable(a, u));
// These source validators have purpose0, not ATTACK. Stealth and Sleep do not
// make an otherwise live aura recipient disappear. Exact native enum dispatch
// remains scoped in the retained source evidence.
const enemy = e => live(e) && !e.s.flags.untargetable;
const form = (u, clip, loop = false, attack) => {
  u.mem.regularFormVisual = { clip, loop, ...(attack ? { attack } : {}) };
};
function begin(b, u, clip, loop, attack) {
  const generation = u.mem.supportAuraGeneration = (u.mem.supportAuraGeneration ?? 0) + 1;
  form(u, clip);
  const duration = model(u).durations[clip];
  b.addBuff(u, { key: 'support-aura:transition', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.skill.active && u.mem.supportAuraGeneration === generation) form(u, loop, true, attack);
  }, { owner: u });
}
function end(b, u, clip, idle, reason) {
  const generation = u.mem.supportAuraGeneration = (u.mem.supportAuraGeneration ?? 0) + 1;
  b.removeBuff(u, 'support-aura:transition');
  if (!live(u) || reason === 'death') { u.mem.regularFormVisual = null; return; }
  form(u, clip);
  const duration = model(u).durations[clip];
  b.addBuff(u, { key: 'support-aura:transition', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (live(u) && u.mem.supportAuraGeneration === generation)
      u.mem.regularFormVisual = idle ? { clip: idle, loop: true } : null;
  }, { owner: u });
}
function recovery(b, u, a, ratio) {
  const final = aggregateMods(a.buffs).mul.hpRegenMul ?? 1;
  b.heal(u, a, u.s.atk * ratio * final, { self: true, regen: true });
}
function clearHeal(b, u, name) {
  for (const a of b.allyUnits) b.removeBuff(a, `${name}:recovery:${u.id}`);
}
function healAura(b, u, name, enabled, ratio, immediate) {
  const key = `${name}:recovery:${u.id}`;
  for (const a of b.allyUnits) {
    const eligible = enabled && live(u) && ally(b, u, a) && bodyInKeys(a, u.rangeKeySet);
    if (!eligible) b.removeBuff(a, key);
    else if (!a.findBuff(key)) {
      b.addBuff(a, { key, source: u, interval: 1, onTick: () => {
        if (live(u) && ally(b, u, a) && bodyInKeys(a, u.rangeKeySet)) recovery(b, u, a, ratio());
      } });
      if (immediate) recovery(b, u, a, ratio());
    }
  }
}

export function customizeSupportAuraKit({ id, def, unit: u, kit }) {
  if (!SUPPORT_AURA_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb, index = SUPPORT_AURA_OPERATORS[id].skillIds.indexOf(s.id);
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'orb', projectileSpeed: 10,
    canHitFly: true, maxTargets: 1, hits: 1, hitAllBlocked: false, allInRange: false,
    attackVisual: 'Attack', windup: timed('Attack'), interruptOnSkillChange: true,
    onHitStatus: { key: 'sluggish', duration: def.traitBb.sluggish }, install: null };
  if (id === HEIDI) {
    kit.trait.canAttack = () => false; kit.trait.onHitStatus = null;
    kit.skill = { kind: 'duration', duration: s.duration,
      onStart: ({ battle: b }) => {
        clearHeal(b, u, 'heidi'); syncHeidi(b, u, def);
        begin(b, u, `Skill_${index + 1}_Begin`, `Skill_${index + 1}_Loop`);
      }, onEnd: ({ battle: b, reason }) => {
        clearHeal(b, u, 'heidi'); syncHeidi(b, u, def);
        end(b, u, `Skill_${index + 1}_End`, null, reason);
      } };
  } else if (id === ANGELINA) {
    kit.trait.noAttackUnlessSkill = index > 0;
    kit.skill = index === 0 ? { kind: 'duration', duration: s.duration, trigger: 'SP_FULL', mods: { atkPct: bb.atk },
      onStart: ({ battle: b }) => syncAngelina(b, u, def), onEnd: ({ battle: b }) => syncAngelina(b, u, def) }
      : { kind: 'duration', duration: s.duration,
        ...(index === 1 ? { mods: { batMul: bb.base_attack_time }, attack: { dmgMul: bb.damage_scale } }
          : { mods: { atkPct: bb.atk }, targeting: { rangeGrid: s.rangeGrid, maxTargets: bb['attack@max_target'] } }),
        attack: { ...(index === 1 ? { dmgMul: bb.damage_scale } : {}),
          attackVisual: index === 1 ? 'Skill1_Loop' : 'Skill2_Loop',
          // Source animKey is empty; active mode's original loop supplies the
          // release event. Its BAT/ASPD dispatcher is a bounded interpretation.
          windup: (_b, unit) => model(unit).hits[index === 1 ? 'Skill1_Loop' : 'Skill2_Loop'][0]
            / (unit.base.bat / unit.s.interval) },
        onStart: ({ battle: b }) => {
          syncAngelina(b, u, def);
          // Original chararts maps both Skill_1_Begin and Skill_2_Begin to the
          // literal Skill1_Begin (the unused Skill2_Begin is not substituted).
          begin(b, u, 'Skill1_Begin', index === 1 ? 'Skill1_Loop' : 'Skill2_Loop', index === 1 ? 'Skill1_Loop' : 'Skill2_Loop');
        }, onEnd: ({ battle: b, reason }) => {
          syncAngelina(b, u, def); end(b, u, index === 1 ? 'Skill1_End' : 'Skill2_End', 'Idle_Charge', reason);
        } };
  } else {
    kit.skill = index === 0 ? { kind: 'duration', duration: s.duration, trigger: 'SP_FULL',
      mods: { atkPct: bb.atk, aspd: bb.attack_speed } }
      : index === 1 ? { kind: 'toggle', trigger: 'SP_FULL', mods: { atkPct: bb.atk },
        targeting: { maxTargets: bb['attack@max_target'] }, attack: { attackVisual: 'Skill2', windup: timed('Skill2') } }
      : { kind: 'duration', duration: s.duration, flags: { disarm: true }, targeting: { rangeGrid: s.rangeGrid },
        onStart: ({ battle: b }) => {
          syncSuzuran(b, u, def); begin(b, u, 'Skill3_Begin', 'Skill3_Loop');
        }, onEnd: ({ battle: b, reason }) => {
          syncSuzuran(b, u, def); end(b, u, 'Skill3_End', null, reason);
        } };
  }
  kit.skill.id = s.id; kit.skill.name = s.name;
}

function syncHeidi(b, u, def) {
  const first = def.skill.id.endsWith('_1'), active = live(u) && u.skill.active;
  const talent = def.talents[0]?.bb;
  const ratio = () => u.skill.active ? def.skill.bb['attack@atk_to_hp_recovery_ratio'] : def.traitBb['attack@atk_to_hp_recovery_ratio'];
  for (const a of b.allyUnits) {
    const inside = live(u) && bodyInKeys(a, u.rangeKeySet);
    const talentKey = `heidi:talent:${u.id}`, blockKey = `heidi:block:${u.id}`;
    if (talent && inside && ally(b, u, a, true)) {
      if (!a.findBuff(talentKey)) b.addBuff(a, { key: talentKey, source: u,
        mods: first ? { atkPct: talent.atk } : { defPct: talent.def } });
    } else b.removeBuff(a, talentKey);
    if (active && inside && ally(b, u, a)) {
      if (!a.findBuff(blockKey)) b.addBuff(a, { key: blockKey, source: u, mods: { blockCnt: def.skill.bb.block_cnt } });
    } else b.removeBuff(a, blockKey);
    const inspireKey = `heidi:inspire:${u.id}`, checkerKey = `heidi:inspire-checker:${u.id}`;
    const inspire = active && inside && ally(b, u, a, true) && a.def.subProf !== 'bard'
      && !a.mem.noInspire && !a.findBuff('immune_to_encourage');
    if (!inspire) { b.removeBuff(a, checkerKey); b.removeBuff(a, inspireKey); }
    else if (!a.findBuff(checkerKey)) {
      const refresh = () => {
        if (!live(u) || !u.skill.active) return;
        const mods = first ? { atkFinalFlat: u.s.atk * def.skill.bb.atk }
          : { defFinalFlat: u.s.def * def.skill.bb.def, hpFinalFlat: u.s.maxHp * def.skill.bb.max_hp };
        const old = a.findBuff(inspireKey);
        if (!old || Object.keys(mods).some(k => old.mods[k] !== mods[k]))
          b.addBuff(a, { key: inspireKey, source: u, tags: ['inspire'], mods,
            data: { inspirePriority: first ? { atkFinalFlat: def.skill.bb.atk }
              : { defFinalFlat: def.skill.bb.def, hpFinalFlat: def.skill.bb.max_hp } } });
      };
      b.addBuff(a, { key: checkerKey, source: u, interval: 1, onTick: refresh }); refresh();
    }
  }
  healAura(b, u, 'heidi', true, ratio, true);
}

function syncAngelina(b, u, def) {
  const speed = def.talents[0]?.bb.attack_speed, regen = def.talents[1]?.bb.hp_recovery_per_sec;
  const speedKey = `angelina:aspd:${u.id}`, healKey = `angelina:regen:${u.id}`;
  for (const a of b.allyUnits) {
    const eligible = live(u) && ally(b, u, a);
    if (speed && eligible) {
      if (!a.findBuff(speedKey)) b.addBuff(a, { key: speedKey, source: u, mods: { aspd: speed } });
    } else b.removeBuff(a, speedKey);
    if (regen && eligible && !u.skill.active) {
      if (!a.findBuff(healKey)) b.addBuff(a, { key: healKey, source: u, mods: { hpRegen: regen } });
    } else b.removeBuff(a, healKey);
  }
  const weightKey = `angelina:weightless:${u.id}`;
  for (const e of b.enemies) {
    if (live(u) && u.skill.active && def.skill.id.endsWith('_3') && enemy(e)) {
      if (!e.findBuff(weightKey)) b.applyStatus(e, 'weightless', { key: weightKey, source: u, value: 1 });
    } else b.removeBuff(e, weightKey);
  }
}

function syncSuzuran(b, u, def) {
  const active = live(u) && u.skill.active && def.skill.id.endsWith('_3');
  const talent = def.talents[1]?.bb;
  healAura(b, u, 'suzuran', active, () => def.skill.bb['attack@atk_to_hp_recovery_ratio'], false);
  for (const e of b.enemies) {
    const inside = live(u) && enemy(e) && bodyInKeys(e, u.rangeKeySet);
    const slowKey = `suzuran:sluggish:${u.id}`, checkerKey = `suzuran:checker:${u.id}`, fragileKey = `suzuran:fragile:${u.id}`;
    if (active && inside) {
      if (!e.findBuff(slowKey)) b.applyStatus(e, 'sluggish', { key: slowKey, source: u });
    } else b.removeBuff(e, slowKey);
    if (!talent || !inside) { b.removeBuff(e, checkerKey); b.removeBuff(e, fragileKey); }
    else if (!e.findBuff(checkerKey)) {
      b.addBuff(e, { key: checkerKey, source: u, interval: .03, onTick: () => {
        const sluggish = e.buffs.some(x => x.status === 'sluggish' || x.key === 'sluggish' || x.key === 'sluggish[inf]');
        if (!sluggish) b.removeBuff(e, fragileKey);
        else {
          const boosted = u.skill.active && def.skill.id.endsWith('_3');
          const value = (talent.damage_scale - 1) * (boosted ? def.skill.bb.scale_delta_to_one : 1);
          if (e.findBuff(fragileKey)?.data.value !== value) b.applyStatus(e, 'fragile', { key: fragileKey, source: u, value });
        }
      } });
    }
  }
}

export function installSupportAura({ battle: b, unit: u, def }) {
  if (!SUPPORT_AURA_OPERATORS[def.charId]) return;
  const id = def.charId, sync = () => id === HEIDI ? syncHeidi(b, u, def)
    : id === ANGELINA ? syncAngelina(b, u, def) : syncSuzuran(b, u, def);
  if (id === HEIDI) {
    b.addBuff(u, { key: 'immune_to_encourage', persist: true, allowDead: true });
    const messenger = def.talents[1]?.bb.sp_recovery_per_sec;
    if (messenger) registerNamedSpRecovery(b, u, messenger, a => b.mapTags.includes('main_10')
      && a.kind === 'op' && bodyInKeys(a, u.rangeKeySet));
  } else if (id === ANGELINA) {
    if (!def.skill.id.endsWith('_1')) b.on('deploy', ({ unit }) => {
      if (unit === u) form(u, 'Idle_Charge', true);
    }, { owner: u });
  } else {
    const value = def.talents[0]?.bb.sp_recovery_per_sec;
    if (value) registerNamedSpRecovery(b, u, value, a => a.def.profession === 'SUPPORT');
  }
  for (const event of ['deploy', 'death', 'tick']) b.on(event, sync, { owner: u });
}
