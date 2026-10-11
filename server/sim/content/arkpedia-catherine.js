// SPDX-License-Identifier: GPL-3.0-or-later
// Native graphs, all ranks, original facing chains and bounded scheduling are
// retained in arkpedia-catherine-prefabs.json. The crawler never attacks.
import evidence from '../../../data/arkpedia-catherine-prefabs.json' with { type: 'json' };
const ID = 'char_4162_cathy', TOKEN = 'token_10041_cathy_catsld';
const exists = u => u?.alive && u.deployed;
const first = u => u.skill?.id === 'skchr_cathy_1';
const second = u => u.skill?.id === 'skchr_cathy_2' && u.skill.active;
const coreKey = u => `cathy:core:${u.id}`;
const attrKey = u => `cathy:s1:${u.id}`;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const tokenModel = u => evidence.models[TOKEN][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const devices = (b, u) => b.allyUnits.filter(t => t.ownerUnit === u && t.defId === TOKEN && exists(t));
function legalRecipient(b, a, u) {
  // Native purposeNONE/profession639: no healing gate, no device/token actors.
  return exists(a) && !a.hidden && a.kind === 'op' && !a.s.flags.untargetable && b.allySelectable(a, u);
}
function syncAttr(b, u) {
  for (const a of b.allyUnits) {
    const allowed = exists(u) && first(u) && exists(a)
      && (a === u || legalRecipient(b, a, u) && a.findBuff(coreKey(u))?.shield > 0);
    if (!allowed) b.removeBuff(a, attrKey(u));
    else if (!a.findBuff(attrKey(u))) b.addBuff(a, { key: attrKey(u), source: u,
      mods: { atkPct: u.skill.bb.s1_atk, defPct: u.skill.bb.s1_def } });
  }
}
function regenerate(u, a, core, bb) {
  // Native ON_TRIGGER reads live source MAX_HP. Ending S2 does not clamp the
  // previous pool until another core trigger recomputes the source cap.
  const hp = u.s.maxHp, ratio = second(u) ? u.skill.bb.overwrite_ratio : bb.shield_ratio_each_trigger;
  core.shield = Math.min(hp * bb.max_shield_ratio, core.shield + hp * ratio);
  a.markDirty();
}
function syncOwner(b, u, { attrs = true } = {}) {
  const ts = devices(b, u), state = u.mem.cathyBarriers;
  for (const a of b.allyUnits) {
    const t = exists(u) && legalRecipient(b, a, u)
      && ts.find(z => z.rangeKeySet.has(a.tileR * 21 + a.tileC));
    let s = state.get(a), core = a.findBuff(coreKey(u));
    if (!t) {
      state.delete(a); b.removeBuff(a, coreKey(u)); continue;
    }
    if (!s || !core) {
      const bb = t.def.talents[0].bb;
      // mods:{} keeps the native core alive at zero; shield_mark is its
      // positive pool, not a new refilling buff on every owner aura tick.
      core = b.addBuff(a, { key: coreKey(u), source: u, mods: {},
        shield: u.s.maxHp * bb.max_shield_ratio });
      s = { bb, nextNormal: b.time + bb.interval + bb['catsld_t_1[timer][interval].interval'],
        nextSkill: null };
      state.set(a, s);
    }
    const normalInterval = s.bb['catsld_t_1[timer][interval].interval'];
    if (second(u)) {
      // Native forceTick/.1 aura, trigger interval1 with waitFirst=false.
      if (s.nextSkill == null) s.nextSkill = b.time;
      while (s.nextSkill <= b.time + 1e-9) {
        regenerate(u, a, core, s.bb); s.nextSkill += u.skill.bb.interval;
      }
    } else s.nextSkill = null;
    while (s.nextNormal <= b.time + 1e-9) {
      // Quiet timer still advances in S2 but its own trigger is suppressed.
      if (!second(u)) regenerate(u, a, core, s.bb);
      s.nextNormal += normalInterval;
    }
  }
  if (attrs) syncAttr(b, u);
}
function clearOwner(b, u) {
  for (const a of b.allyUnits) {
    b.removeBuff(a, coreKey(u)); b.removeBuff(a, attrKey(u));
  }
  u.mem.cathyBarriers.clear(); u.mem.regularFormVisual = null;
}
function startSecond(b, u) {
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
  syncOwner(b, u);
  b.after(model(u).durations.Skill_2_Begin, () => {
    if (exists(u) && u.deploySeq === seq && second(u) && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: 'Skill_2_Loop', loop: true };
  }, { owner: u });
}
function endSecond(b, u) {
  for (const s of u.mem.cathyBarriers.values()) s.nextSkill = null;
  if (!exists(u)) { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
  b.after(model(u).durations.Skill_2_End, () => {
    if (u.deploySeq === seq && u.skill.activations === activation && !u.skill.active)
      u.mem.regularFormVisual = null;
  }, { owner: u });
}
export function customizeCatherineKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; u.mem.cathyBarriers = new Map();
  kit.trait = { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    maxTargets: 1, allInRange: false, rangeAoe: false, splashRadius: 0, hits: 1,
    hitsFn: null, hitAllBlocked: false, install: null, retargetOnRelease: true,
    interruptOnSkillChange: true, canAttack: () => !second(u),
    attackVisual: () => first(u) ? 'Skill_1' : 'Attack',
    windup: () => model(u).hits[first(u) ? 'Skill_1' : 'Attack'][0]
      / Math.min(1, u.base.bat / u.s.interval) };
  const s = def.skill;
  kit.skill = s.id.endsWith('_1') ? { id: s.id, name: s.name, kind: 'passive' }
    : { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
      mods: { hpPct: s.bb.max_hp, defPct: s.bb.def }, flags: { disarm: true },
      onStart: () => startSecond(b, u), onEnd: () => endSecond(b, u) };
  u.mem.summonSkillSync = () => syncOwner(b, u);
}
export function installCatherine({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.every(.1, () => syncOwner(b, u, { attrs: false }), { owner: u });
  b.every(.2, () => syncAttr(b, u), { owner: u });
  b.on('deploy', () => syncOwner(b, u), { owner: u });
  b.on('damaged', ({ target, type, dmg }) => {
    const s = u.mem.cathyBarriers.get(target);
    // Native TAKE_DAMAGE is bridged after accepted mitigation/shields.
    // Dodge/cancel have no callback; elemental gauges and HPLOSS are excluded.
    if (!s || type === 'element' || dmg?.tags?.includes('hpLoss')) return;
    s.nextNormal = b.time + s.bb.interval + s.bb['catsld_t_1[timer][interval].interval'];
    syncAttr(b, u);
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit === u) clearOwner(b, u);
    else syncOwner(b, u);
  }, { owner: u });
}
export function createCatherineDevice(b, state, row, col, dir) {
  const r = state.record, bb = r.talents[0]?.bb;
  if (r.id !== TOKEN || r.stats.maxDeployCount !== 2 || r.stats.maxDeckStackCnt !== 3
    || !bb || bb.interval !== 5 || bb['catsld_t_1[timer][interval].interval'] !== 1
    || bb.shield_ratio_each_trigger !== .06 || !(bb.max_shield_ratio > 0))
    throw Error('Missing reviewed Catherine device source');
  const owner = state.owner, kit = { skill: null,
    trait: { noAttack: true, canAttack: () => false },
    install: (battle, t) => {
      battle.addBuff(t, { key: 'cathy:device-free', source: t,
        flags: { invulnerable: true, healFree: true }, persist: true, allowDead: true });
      battle.on('deploy', ({ unit }) => {
        if (unit !== t) return;
        const seq = t.deploySeq, m = tokenModel(t);
        t.mem.regularFormVisual = { clip: 'Start', loop: false, die: m.durations.Die ? 'Die' : null };
        // Native realBornTimeFromAnim0: Start is presentation, no birth wait.
        syncOwner(battle, owner);
        battle.after(m.durations.Start, () => {
          if (exists(t) && t.deploySeq === seq)
            t.mem.regularFormVisual = { clip: 'Idle', loop: true, die: m.durations.Die ? 'Die' : null };
        }, { owner: t });
      }, { owner: t });
    } };
  const t = b.spawnToken(owner, TOKEN, row, col, { dir, def: r, kit });
  if (t) { t.kind = 'device'; t.deploymentSlotCost = 0; syncOwner(b, owner); }
  return t;
}
