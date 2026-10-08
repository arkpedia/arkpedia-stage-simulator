// SPDX-License-Identifier: GPL-3.0-or-later
// Exact original components/templates and bounded native dispatch mappings are
// retained in data/arkpedia-silence-paradigmatic-prefabs.json.
import evidence from '../../../data/arkpedia-silence-paradigmatic-prefabs.json' with { type: 'json' };
import { bodyInKeys } from '../body.js';
import { aggregateMods } from '../buffs.js';
import { resolveHit } from '../ai.js';

const ID = 'char_1031_slent2', TOKEN = 'token_10029_slent2_protrb';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const timed = (clip, cap = Infinity) => (_b, u) => model(u).hits[clip][0] / Math.min(cap, u.s.aspd / 100);
const ally = (b, u, a, free = false, isolated = false) => live(a) && a.kind !== 'device'
  && (free || !a.s.flags.untargetable) && (isolated || b.allySelectable(a, u));
const healable = (b, u, a) => ally(b, u, a) && !a.s.flags.healFree
  && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal));
const injured = (b, u) => b.allyUnits.filter(a => healable(b, u, a)
  && bodyInKeys(a, u.rangeKeySet) && a.hp < a.s.maxHp - .01)
  .sort((a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq)
  .slice(0, 1 + Math.max(0, Math.floor(u.s.maxTargets)));
const sanctuaryKey = u => `slent2:sentinel:${u.id}`;
const checkerKey = u => `slent2:sentinel-checker:${u.id}`;

export function silenceSanctuaryValue(bb, hpRatio) {
  const bins = Math.floor((1 - Math.max(bb.min_hp_ratio, Math.min(1, hpRatio))) / bb.hp_ratio + 1e-8);
  return bb.damage_resistance_base * (1 + bb.resistance_scale * bins);
}
function syncSentinel(b, u, bb, enabled) {
  const ck = checkerKey(u), key = sanctuaryKey(u);
  for (const a of b.allyUnits) {
    const eligible = enabled && bb && ally(b, u, a) && bodyInKeys(a, u.rangeKeySet);
    if (!eligible) { b.removeBuff(a, ck); b.removeBuff(a, key); continue; }
    const evaluate = () => {
      if (!live(u) || !ally(b, u, a) || !bodyInKeys(a, u.rangeKeySet)) return;
      const current = a.findBuff(ck)?.data.bb;
      if (!current) return;
      const value = silenceSanctuaryValue(current, a.hpRatio);
      if (a.findBuff(key)?.data.value !== value)
        b.applyStatus(a, 'sanctuary', { key, source: u, value });
    };
    let old = a.findBuff(ck);
    // Mode/talent-scale changes detach and attach the source aura. Its native
    // waitFirst0 checker evaluates immediately; ordinary HP changes sample .1s.
    if (!old || old.data.bb.damage_resistance_base !== bb.damage_resistance_base) {
      b.removeBuff(a, ck); b.removeBuff(a, key);
      old = b.addBuff(a, { key: ck, source: u, interval: .1, data: { bb }, onTick: evaluate });
      evaluate();
    } else old.data.bb = bb;
  }
}
function regen(b, source, a, ratio) {
  const multiplier = aggregateMods(a.buffs).mul.hpRegenMul ?? 1;
  b.heal(source, a, source.s.atk * ratio * multiplier, { self: true, regen: true });
}
function syncRecoveryChannels(b, a) {
  const candidates = [...(b._arkpediaSilenceParadigmatic?.values() ?? [])].filter(({ u }) =>
    live(u) && ally(b, u, a, true) && bodyInKeys(a, u.rangeKeySet)
    && a.findBuff(`slent2:plumes-checker:${u.id}`)?.data.low);
  for (const channel of ['normal', 'rhine']) {
    const key = `slent2_t_2[${channel}]`;
    const eligible = channel === 'rhine' && !a.def.raw.tags?.includes('rhine') ? [] : candidates;
    const selected = eligible.sort((x, z) => z.def.talents[1].bb.atk_to_hp_recovery_ratio
      - x.def.talents[1].bb.atk_to_hp_recovery_ratio || x.u.deploySeq - z.u.deploySeq)[0];
    if (!selected) { b.removeBuff(a, key); continue; }
    const ratio = selected.def.talents[1].bb.atk_to_hp_recovery_ratio, old = a.findBuff(key);
    if (old?.source === selected.u && old.data.ratio === ratio) continue;
    b.addBuff(a, { key, source: selected.u, interval: 1, data: { ratio }, onTick: () => {
      if (live(selected.u) && ally(b, selected.u, a, true) && bodyInKeys(a, selected.u.rangeKeySet))
        regen(b, selected.u, a, ratio);
    } });
  }
}
function syncPlumes(b, u, def) {
  const bb = def.talents[1]?.bb, key = `slent2:plumes-checker:${u.id}`;
  for (const a of b.allyUnits) {
    const eligible = bb && live(u) && ally(b, u, a, true) && bodyInKeys(a, u.rangeKeySet);
    if (!eligible) b.removeBuff(a, key);
    else if (!a.findBuff(key)) {
      const evaluate = () => {
        const checker = a.findBuff(key);
        if (checker) checker.data.low = a.hpRatio < bb.hp_ratio;
        syncRecoveryChannels(b, a);
      };
      b.addBuff(a, { key, source: u, interval: .1, data: { low: false }, onTick: evaluate }); evaluate();
    }
    syncRecoveryChannels(b, a);
  }
}
function syncOwner(b, u, def) {
  const talent = def.talents[0]?.bb;
  const scale = u.skill.active && u.skill.id === 'skchr_slent2_3' ? def.skill.bb.talent_scale : 1;
  syncSentinel(b, u, talent ? { ...talent, damage_resistance_base: talent.damage_resistance_base * scale } : null, live(u));
  syncPlumes(b, u, def);
}
function droneSkillEnd(b, u) {
  const state = u.mem.slent2State;
  if (!state || state.owner !== u) return;
  // Exact source order: WithdrawTokens → recharge refreshRemainingCnt with cnt0.
  // The token removal listener may charge first; the owner finish then clears it.
  for (const t of b.allyUnits) if (t.ownerUnit === u && t.defId === TOKEN && live(t))
    b.retreat(t, { permanent: true, reason: 'silence2-skill-ended' });
  state.stock = 0;
}
function form(u, clip, loop = false) { u.mem.regularFormVisual = { clip, loop }; }
function phaseVisual(b, u, begin) {
  const gen = u.mem.slent2VisualGeneration = (u.mem.slent2VisualGeneration ?? 0) + 1;
  if (!live(u)) { u.mem.regularFormVisual = null; return; }
  form(u, begin ? 'Skill_2_Begin' : 'Skill_2_End');
  b.after(model(u).durations[begin ? 'Skill_2_Begin' : 'Skill_2_End'], () => {
    if (u.mem.slent2VisualGeneration !== gen) return;
    u.mem.regularFormVisual = live(u) && u.skill.active && begin ? { clip: 'Skill_2_Idle', loop: true } : null;
  }, { owner: u });
}

export function customizeSilenceParadigmaticKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  const s = def.skill, index = Number(s.id.at(-1));
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'orb', projectileSpeed: 8,
    maxTargets: 1, hits: 1, canHitFly: true, hitAllBlocked: false, install: null, heal: null,
    attackVisual: 'Attack', windup: timed('Attack', 1), retargetOnRelease: true,
    interruptOnSkillChange: true,
    acquireTargets: (battle, unit, profile) => profile.dmgType === 'heal' ? injured(battle, unit) : null,
    launchAttack: (battle, unit, profile, target, info) => battle.addProjectile({
      from: unit, target, source: unit, speed: 8, visual: profile.dmgType === 'heal' ? 'heal' : 'orb',
      data: { arkpediaTrackedVisual: true }, onHit: ({ target: a }) => {
        if (profile.dmgType !== 'heal') { resolveHit(battle, unit, profile, a, info, a.x, a.y); return; }
        if (healable(battle, unit, a)) battle.heal(unit, a, unit.s.atk * def.traitBb.heal_scale);
      } }),
  };
  const useKey = `${ID}:${s.id}`;
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    mods: index === 2 ? { aspd: s.bb.attack_speed } : { atkPct: s.bb.atk },
    attack: { heal: null, projectile: 'none', attackVisual: index === 1 ? 'Attack' : index === 2 ? 'Skill' : 'Skill_2_Loop',
      windup: timed(index === 1 ? 'Attack' : index === 2 ? 'Skill' : 'Skill_2_Loop') },
    ...(index === 3 ? { manualCancel: true,
      remainingUses: () => Math.max(0, s.bb.skill_max_trigger_time - (b.regularSkillUses.get(useKey) ?? 0)),
      isExhausted: () => (b.regularSkillUses.get(useKey) ?? 0) >= s.bb.skill_max_trigger_time } : {}),
    onStart: ({ battle }) => {
      u.profile.dmgType = 'heal';
      if (index === 2) {
        const state = u.mem.slent2State;
        if (state?.owner === u) { state.stock = Math.min(1, state.stock + 1); state.readyAt = battle.time; }
      } else if (index === 3) {
        battle.regularSkillUses.set(useKey, (battle.regularSkillUses.get(useKey) ?? 0) + 1);
        u.mem.slent2GraveAvailable = true; phaseVisual(battle, u, true);
      }
      syncOwner(battle, u, def);
    }, onEnd: ({ battle }) => {
      u.profile.dmgType = 'arts'; u.mem.slent2GraveAvailable = false;
      if (index === 2) droneSkillEnd(battle, u);
      if (index === 3) phaseVisual(battle, u, false);
      syncOwner(battle, u, def);
    },
  };
}

export function installSilenceParadigmatic({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  if (!b._arkpediaSilenceParadigmatic) b._arkpediaSilenceParadigmatic = new Map();
  b._arkpediaSilenceParadigmatic.set(u.id, { u, def });
  const sync = () => syncOwner(b, u, def);
  for (const event of ['deploy', 'death', 'tick']) b.on(event, sync, { owner: u });
  b.on('fatal', ctx => {
    const a = ctx.unit;
    // Original purpose0 mask639: Operators, including isolated/HEAL-free ones.
    // Shared fatal is damage/HP-loss only; scripted self-removal never enters it.
    if (ctx.prevented || !live(u) || !u.skill.active || u.skill.id !== 'skchr_slent2_3'
      || !u.mem.slent2GraveAvailable || !live(a) || a.kind !== 'op'
      || a.s.flags.undeadable || !bodyInKeys(a, u.rangeKeySet)) return;
    b.addBuff(a, { key: 'slent2_shallow_grave', source: u,
      duration: def.skill.bb.grave_duration, flags: { undeadable: true } });
    u.mem.slent2GraveAvailable = false; ctx.prevented = true;
  }, { owner: u, priority: -100 });
}

export function installSilenceParadigmaticDrone(b, token, state) {
  token.kind = 'device'; token.mem.regularHideHp = true;
  token.mem.regularFormVisual = { clip: 'Idle', loop: true };
  token.profile.noAttack = true; token.profile.noHeal = true;
  const original = state.record.talents[0]?.bb;
  if (!original) throw Error('Missing original Night Banisher talent');
  const bb = { ...original, damage_resistance_base: original.damage_resistance_base * state.owner.def.skill.bb.damage_resistance_scale };
  const enabled = () => live(token) && live(state.owner) && state.owner.skill.active
    && state.owner.skill.id === 'skchr_slent2_2';
  const sync = () => syncSentinel(b, token, bb, enabled());
  for (const event of ['deploy', 'death', 'tick']) b.on(event, sync, { owner: token });
  b.on('death', ({ unit }) => {
    if (unit !== token) return;
    sync();
    if (live(state.owner) && state.owner.skill.active && state.owner.skill.id === 'skchr_slent2_2') {
      state.stock = Math.min(1, state.stock + 1); state.readyAt = b.time + state.record.stats.respawnTime;
    }
  }, { owner: token });
  sync();
}
