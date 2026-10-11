// SPDX-License-Identifier: GPL-3.0-or-later
// Native battery graphs and all bounded dispatch choices are retained in the
// accompanying evidence. Idle's OnAttack0 does not create friendly damage.
import evidence from '../../../data/arkpedia-windflit-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
const ID = 'char_433_windft', TOKEN = 'token_10023_windft_wrench';
const exists = u => u?.alive && u.deployed;
const live = u => exists(u) && !u.hidden;
const own = (b, u) => b.allyUnits.filter(t => t.ownerUnit === u && t.defId === TOKEN && exists(t));
const key = t => `windft_wrench_t:${t.id}`;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const rate = (u, cap = 1) => Math.min(cap, u.base.bat / u.s.interval);
const second = u => u.skill?.id === 'skchr_windft_2' && u.skill.active;
const stateFor = (b, u) => {
  const s = b.regularSummons?.get(`summon:${ID}`);
  return s?.owner === u ? s : null;
};

function clearBattery(b, t) {
  for (const a of b.allyUnits) b.removeBuff(a, key(t));
  t.mem.windflitTarget = null;
}
function currentRecipient(b, t) {
  // Native MeleeAttack SELF/timing0 establishes a current target for the
  // non-damaging device. Only its facing occupied ally can carry the aura.
  // The exact postFilter4/abnormal26/Idle dispatch is not executable-recovered.
  return b.allyUnits.find(a => live(a) && a.kind === 'op'
    && !a.s.flags.untargetable && !a.s.flags.isolated
    && t.rangeKeySet.has(a.tileR * 21 + a.tileC)) ?? null;
}
function syncBattery(b, t) {
  const u = t.ownerUnit, ready = live(t) && exists(u) && t.mem.windflitBorn;
  const mode = ready && second(u) && !t.s.flags.untargetable && !t.s.flags.isolated;
  const value = t.mem.windflitAtk * (mode ? u.skill.bb.talent_scale : 1);
  t.mem.windflitTarget = ready ? currentRecipient(b, t) : null;
  for (const a of b.allyUnits) {
    // Original range BuffAura has purpose0 and ignores target-free, ally-free
    // and HealFree. Those healing/attack filters must not erase its ATK aura.
    const allowed = ready && live(a) && a.kind === 'op'
      && ['CASTER', 'SUPPORT'].includes(a.def.profession)
      && t.rangeKeySet.has(a.tileR * 21 + a.tileC);
    const old = a.findBuff(key(t));
    if (!allowed) b.removeBuff(a, key(t));
    else if (old?.mods.atkPct !== value || old.source !== t)
      b.addBuff(a, { key: key(t), source: t, mods: { atkPct: value } });
  }
}
function syncOwner(b, u) { for (const t of own(b, u)) syncBattery(b, t); }
function grantBatterySp(b, u, amount) {
  syncOwner(b, u);
  for (const t of own(b, u)) {
    const a = t.mem.windflitTarget;
    if (!live(t) || !t.mem.windflitBorn || !a?.findBuff(key(t)) || !a.skill
      || a.skill.noSkill || a.skill.kind === 'passive') continue;
    // Literal ModifySp forceFlagtrue bypasses active/noSP like the existing
    // source-owned forced-SP adapters; never creates an ordinary spGain event.
    a.skill.gainSp(amount, 'init', true);
  }
}
function select(b, u, p) {
  if (!p.windflitSkillOne) return null;
  return b.enemies.filter(e => live(e) && canTargetEnemy(u, e, p) && bodyInKeys(e, u.rangeKeySet));
}
function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  if (p.windflitSkillOne) u.mem.windflitEmitted = info.attackId;
  resolveHit(b, u, p, e, info, e.x, e.y);
}
function afterAttack(b, u, targets, { inputTargets, attackId }) {
  if (!u.def.skill.id.endsWith('_1') || u.mem.windflitSkillAttack !== attackId) return;
  if (u.mem.windflitEmitted === attackId) {
    grantBatterySp(b, u, u.skill.bb['attack@sp']);
    return;
  }
  // Native recoverSpIfTargetDead1 applies before any emission, not to an
  // already completed attack or a merely leaving/hidden/controlled victim.
  if (inputTargets.length && inputTargets.every(t => !t.alive)) u.skill.addCharge(1);
}
function startSecond(b, u) {
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
  b.addBuff(u, { key: 'windft:begin', source: u,
    duration: model(u).durations.Skill_2_Begin, flags: { disarm: true } });
  syncOwner(b, u);
  b.after(model(u).durations.Skill_2_Begin, () => {
    if (exists(u) && u.deploySeq === seq && second(u) && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true, attack: 'Skill_2_Loop' };
  }, { owner: u });
}
function endSecond(b, u, reason) {
  b.removeBuff(u, 'windft:begin'); syncOwner(b, u);
  if (!exists(u)) { u.mem.regularFormVisual = null; return; }
  if (reason === 'duration') {
    const s = stateFor(b, u);
    if (s) s.stock = Math.min(s.record.stats.maxDeckStackCnt,
      s.stock + u.skill.bb['windft_s_2_recharge.cnt']);
  }
  // Exact animator mix pairs map Skill_2_Idle/Loop→Idle/Attack to End. End
  // presents restored mode0 without inventing a second attack/SP lock.
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
  b.after(model(u).durations.Skill_2_End, () => {
    if (u.deploySeq === seq && u.skill.activations === activation && !u.skill.active)
      u.mem.regularFormVisual = null;
  }, { owner: u });
}

export function customizeWindflitKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    maxTargets: 1, allInRange: false, rangeAoe: false, splashRadius: 0, hits: 1,
    hitsFn: null, hitAllBlocked: false, install: null, retargetOnRelease: true,
    interruptOnSkillChange: true, acquireTargets: select, launchAttack: launch,
    afterAttack, attackVisual: (_b, a) => second(a) ? 'Skill_2_Loop' : 'Attack',
    windup: (_b, a) => model(a).hits[second(a) ? 'Skill_2_Loop' : 'Attack'][0] / rate(a) };
  const s = def.skill;
  kit.skill = s.id.endsWith('_1') ? { id: s.id, name: s.name, kind: 'charges',
    charges: s.bb.ct, flags: { noSp: true },
    targeting: { rangeGrid: s.rangeGrid, allInRange: true, maxTargets: 1 },
    attack: { windflitSkillOne: true, atkScale: s.bb.atk_scale,
      retargetOnRelease: true, attackVisual: 'Skill_1',
      windup: (battle, a) => { a.mem.windflitSkillAttack = battle._attackSeq;
        return model(a).hits.Skill_1[0] / rate(a, Infinity); } } }
    : { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
      mods: { atkPct: s.bb.atk, batFlat: s.bb.base_attack_time },
      attack: {},
      onStart: () => startSecond(b, u), onTick: () => syncOwner(b, u),
      onEnd: ({ reason }) => endSecond(b, u, reason) };
  u.mem.summonSkillSync = () => syncOwner(b, u);
}
export function installWindflit({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  u.mem.windflitEmitted = null;
  b.on('deploy', () => syncOwner(b, u), { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) {
    for (const t of b.allyUnits) if (t.ownerUnit === u && t.defId === TOKEN) clearBattery(b, t);
    u.mem.regularFormVisual = null;
  } }, { owner: u });
}

/** Root owns card DP/stock/redeploy and placement. This factory owns only the
 * original device's zero-damage lifetime, current target and talent auras. */
export function createWindflitBattery(b, state, row, col, dir) {
  if (state.record.id !== TOKEN || state.record.stats.maxDeployCount !== 2
    || state.record.stats.maxDeckStackCnt !== 3 || !state.record.talents[0]?.bb)
    throw Error('Missing reviewed Windflit battery source');
  const talent = state.record.talents[0].bb;
  const kit = { skill: null, trait: { noAttack: true, canAttack: () => false },
    install: (battle, t) => {
      t.mem.windflitBorn = false; t.mem.windflitAtk = talent.atk;
      battle.addBuff(t, { key: 'windft:invincible', source: t,
        flags: { invulnerable: true, healFree: true }, persist: true, allowDead: true });
      battle.on('deploy', ({ unit }) => {
        if (unit !== t) return;
        const seq = t.deploySeq;
        t.mem.regularFormVisual = { clip: 'Start', loop: false, die: 'End' };
        battle.after(evidence.models[TOKEN].durations.Start, () => {
          if (!exists(t) || !exists(state.owner) || t.deploySeq !== seq) return;
          t.mem.windflitBorn = true;
          t.mem.regularFormVisual = { clip: 'Idle', loop: true, die: 'End' };
          syncBattery(battle, t);
          // Native real-born clock + owner's finite lifetime TokenBuffAura is
          // represented explicitly; its exact attachment phase is bounded.
          battle.after(talent.duration, () => {
            if (exists(t) && t.deploySeq === seq) battle.retreat(t, { permanent: true, reason: 'windflit-expired' });
          }, { owner: t });
        }, { owner: t });
      }, { owner: t });
      battle.every(battle.dt, () => syncBattery(battle, t), { owner: t });
      battle.on('deploy', () => syncBattery(battle, t), { owner: t });
      battle.on('death', ({ unit }) => { if (unit === t) clearBattery(battle, t); }, { owner: t });
    } };
  const t = b.spawnToken(state.owner, TOKEN, row, col, { dir, def: state.record, kit });
  if (t) { t.kind = 'device'; t.deploymentSlotCost = 0; }
  return t;
}
