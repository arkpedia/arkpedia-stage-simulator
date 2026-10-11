// SPDX-License-Identifier: GPL-3.0-or-later
// Original marker/owner talent graphs, ranks and bounded native dispatch are
// retained in the source evidence. The crane is a device without an attack.
import evidence from '../../../data/arkpedia-alanna-prefabs.json' with { type: 'json' };
const ID = 'char_4178_alanna', TOKEN = 'token_10045_alanna_crane';
const exists = u => u?.alive && u.deployed;
const live = u => exists(u) && !u.hidden;
const own = (b, u) => b.allyUnits.filter(t => t.ownerUnit === u && t.defId === TOKEN && exists(t));
const auraKey = u => `alanna_t:${u.id}`;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const first = u => u.skill?.id === 'skchr_alanna_1';
const second = u => u.skill?.id === 'skchr_alanna_2' && u.skill.active;
const selectedState = (b, u) => {
  const s = b.regularSummons?.get(`summon:${ID}`);
  return s?.owner === u ? s : null;
};
function legalRecipient(b, a, u) {
  // purposeNONE/profession639 covers ordinary Operators, not devices/tokens.
  // HealFree/noHeal do not turn this non-HEAL marker into a healing selector.
  return live(a) && a.kind === 'op' && !a.s.flags.untargetable && b.allySelectable(a, u);
}
function marked(b, u, a) {
  return own(b, u).some(t => live(t) && t.rangeKeySet.has(a.tileR * 21 + a.tileC));
}
function clearOwner(b, u) {
  for (const a of b.allyUnits) b.removeBuff(a, auraKey(u));
}
function syncOwner(b, u) {
  const aspd = first(u) ? u.skill.bb.attack_speed : 0;
  for (const a of b.allyUnits) {
    const allowed = live(u) && legalRecipient(b, a, u) && marked(b, u, a);
    const old = a.findBuff(auraKey(u));
    if (!allowed) b.removeBuff(a, auraKey(u));
    else if (!old || old.mods.aspd !== aspd)
      b.addBuff(a, { key: auraKey(u), source: u, mods: { aspd } });
  }
}
function clip(u) { return second(u) ? 'Skill_2_Loop' : first(u) ? 'Skill_1' : 'Attack'; }
function startSecond(b, u) {
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
  b.addBuff(u, { key: 'alanna:begin', source: u,
    duration: model(u).durations.Skill_2_Begin, flags: { disarm: true } });
  b.after(model(u).durations.Skill_2_Begin, () => {
    if (exists(u) && u.deploySeq === seq && second(u) && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true, attack: 'Skill_2_Loop' };
  }, { owner: u });
}
function endSecond(b, u, reason) {
  b.removeBuff(u, 'alanna:begin');
  if (!exists(u)) { u.mem.regularFormVisual = null; return; }
  if (reason === 'duration') {
    const s = selectedState(b, u);
    if (s) s.stock = Math.min(s.record.stats.maxDeckStackCnt, s.stock + u.skill.bb.cnt);
  }
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
  b.after(model(u).durations.Skill_2_End, () => {
    if (u.deploySeq === seq && u.skill.activations === activation && !u.skill.active)
      u.mem.regularFormVisual = null;
  }, { owner: u });
}
export function customizeAlannaKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    maxTargets: 1, allInRange: false, rangeAoe: false, splashRadius: 0, hits: 1,
    hitsFn: null, hitAllBlocked: false, install: null, retargetOnRelease: true,
    interruptOnSkillChange: true, attackVisual: (_b, a) => clip(a),
    windup: (_b, a) => model(a).hits[clip(a)][0] / (a.base.bat / a.s.interval) };
  const s = def.skill;
  kit.skill = s.id.endsWith('_1') ? { id: s.id, name: s.name, kind: 'passive' }
    : { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
      mods: { atkPct: s.bb.atk, aspd: s.bb.attack_speed }, attack: {},
      onStart: () => startSecond(b, u), onEnd: ({ reason }) => endSecond(b, u, reason) };
  u.mem.summonSkillSync = () => syncOwner(b, u);
}
export function installAlanna({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  // Native forceTick1/.1 owner aura has one talent buff across every device's
  // shared marker. Per-device DEF modifiers would incorrectly stack.
  b.every(.1, () => syncOwner(b, u), { owner: u });
  b.on('deploy', ({ unit }) => {
    if (unit === u) {
      // NORMAL birth recharge adds selected count to retained finite stock;
      // root's additiveBornStock integration preserves that previous state.
      const s = selectedState(b, u);
      if (s) s.stock = Math.min(s.record.stats.maxDeckStackCnt, s.stock);
    }
    syncOwner(b, u);
  }, { owner: u });
  b.on('hit', ({ source, dmg }) => {
    if (!live(u) || !source?.findBuff(auraKey(u))) return;
    // Literal ON_CALCULATE_DAMAGE/CACHED_PROJECTILE_DAMAGE performs this
    // fixed-DEF addition from the owner Skill2's current selected multiplier.
    dmg.defIgnoreFlat += def.talents[0].bb.def_penetrate_fixed_bb * (second(u) ? u.skill.bb.multi : 1);
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit === u) { clearOwner(b, u); u.mem.regularFormVisual = null; }
    else if (unit.ownerUnit === u && unit.defId === TOKEN) syncOwner(b, u);
  }, { owner: u });
}

/** Parent owns original token card/factory routing, cost/stock and placement. */
export function createAlannaDevice(b, state, row, col, dir) {
  if (state.record.id !== TOKEN || state.record.stats.maxDeployCount !== 2
    || state.record.stats.maxDeckStackCnt !== 3 || state.record.talents[0]?.bb.duration !== 30)
    throw Error('Missing reviewed Alanna device source');
  const owner = state.owner, duration = state.record.talents[0].bb.duration
    + (first(owner) ? owner.skill.bb.extend_time : 0);
  const kit = { skill: null, trait: { noAttack: true, canAttack: () => false },
    install: (battle, t) => {
      t.mem.regularHideHp = true;
      battle.addBuff(t, { key: 'alanna:device-free', source: t,
        flags: { invulnerable: true, healFree: true }, persist: true, allowDead: true });
      battle.on('deploy', ({ unit }) => {
        if (unit !== t) return;
        const seq = t.deploySeq;
        t.mem.alannaExpiry = battle.time + duration;
        t.mem.regularFormVisual = { clip: 'Start', loop: false, die: 'Die' };
        // Native useRealBornTimeFromAnim0: original Start is presentation;
        // marker and selected lifetime begin now, without invented birth wait.
        syncOwner(battle, owner);
        battle.after(evidence.models[TOKEN].durations.Start, () => {
          if (exists(t) && t.deploySeq === seq)
            t.mem.regularFormVisual = { clip: 'Idle', loop: true, die: 'Die' };
        }, { owner: t });
        battle.after(duration, () => {
          if (exists(t) && t.deploySeq === seq)
            battle.retreat(t, { permanent: true, reason: 'alanna-expired' });
        }, { owner: t });
      }, { owner: t });
      battle.on('death', ({ unit }) => { if (unit === t) syncOwner(battle, owner); }, { owner: t });
    } };
  const t = b.spawnToken(owner, TOKEN, row, col, { dir, def: state.record, kit });
  if (t) { t.kind = 'device'; t.deploymentSlotCost = 0; syncOwner(b, owner); }
  return t;
}
