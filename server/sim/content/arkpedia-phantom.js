// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-phantom-prefabs.json' with { type: 'json' };
import { normalizeToken } from '../simdata.js';
import { absoluteRangeKeys } from '../targeting.js';

const OWNER = 'char_250_phatom', TOKEN = 'token_10007_phatom_twin';
const live = u => u?.alive && u.deployed;
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const mode = def => Number(def.skill.id.at(-1));
const charged = u => u.mem.phantomStacks > 0;
const clip = u => charged(u) ? 'Attack_2' : 'Attack';
const windup = (b, u) => model(u).hits[clip(u)][0] / Math.min(1.1, u.s.aspd / 100);
const key = u => `phantom:stacks:${u.id}`;

function syncStacks(b, u, bb) {
  if (charged(u)) b.addBuff(u, { key: key(u), mods: { atkPct: bb.atk * u.mem.phantomStacks } });
  else b.removeBuff(u, key(u));
}

/** Original S1/S2 are born effects. S3's mode hooks Born to literal Skill;
 * its single .433 OnAttack invokes one native RandomCastAbility branch. */
function onBorn({ battle: b, unit: u, skill }) {
  const s = u.def.skill, bb = s.bb, selected = mode(u.def);
  u.mem.phantomStacks = selected === 2 ? bb.times : 0;
  if (selected === 1) {
    b.addBuff(u, { key: 'phantom:physical-shield', source: u,
      duration: bb.duration, shield: u.s.maxHp * bb.hp_ratio, shieldTypes: ['phys'] });
    b.addBuff(u, { key: 'phantom:evade', source: u,
      duration: bb.duration, mods: { dodgePhys: bb.prob } });
  } else if (selected === 2) {
    syncStacks(b, u, bb);
    b.on('damaged', ({ source, dmg }) => {
      // Native ON_AFTER_OUTPUT_DAMAGE is after accepted mitigation/shields.
      // A canceled or dodged hit never reaches this event; absorbed output does.
      if (source !== u || !charged(u) || !dmg?.isAttack || dmg.isHpLoss || dmg.cancel) return;
      u.mem.phantomStacks--; syncStacks(b, u, bb);
    }, { owner: u });
  } else {
    const original = model(u), seq = u.deploySeq;
    u.mem.regularFormVisual = { clip: 'Skill', loop: false };
    // The original birth action allows abnormal states. Do not cancel its
    // emitted deployment pulse because a brief control was applied afterward.
    b.after(original.hits.Skill[0], () => {
      if (!live(u) || u.deploySeq !== seq) return;
      const statuses = ['sluggish', 'stun', 'bind'];
      const status = statuses[Math.min(2, Math.floor(b.rng() * statuses.length))];
      u.mem.phantomDeploymentStatus = status;
      const keys = absoluteRangeKeys(s.rangeGrid, u.tileR, u.tileC, u.dir);
      const targets = b.enemiesInKeys(keys, u, { canHitFly: false });
      for (const target of targets) {
        b.dealDamage(u, target, { amount: u.s.atk * u.s.atkScaleMul * bb.atk_scale,
          type: 'phys', isAttack: true, isSkill: true, applyWay: 'melee',
          tags: ['phantom:deployment'] });
        if (!live(target)) continue;
        b.push(target, bb.force, { from: u });
        b.applyStatus(target, status, { source: u,
          duration: bb[status === 'bind' ? 'root' : status] });
      }
    }, { owner: u });
    b.after(original.durations.Skill, () => {
      if (u.deploySeq === seq) u.mem.regularFormVisual = null;
    }, { owner: u });
  }
}

function sourceKit(def) {
  return {
    trait: { attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
      maxTargets: 1, hitAllBlocked: false, retargetOnRelease: true,
      windup, attackVisual: (b, u) => clip(u),
    },
    skill: { id: def.skill.id, name: def.skill.name, kind: 'passive',
      onStart: onBorn, onEnd: ({ unit: u }) => { u.mem.phantomStacks = 0; u.mem.regularFormVisual = null; } },
  };
}

export function customizePhantomKit({ id, def, kit }) {
  if (id !== OWNER) return;
  kit.install = null;
  Object.assign(kit, sourceKit(def));
}

/** Actual token source stats and distinct selected sktok skill are already
 * resolved by summonRecordFor. No parent ATK/HP or generic kit is copied. */
export function createPhantomClone(battle, state, row, col, dir) {
  if (state.record.id !== TOKEN || !state.record.skill) throw Error('Missing reviewed Phantom clone skill');
  const def = normalizeToken(TOKEN, state.record);
  const kit = sourceKit(def);
  kit.install = (b, u) => {
    b.addBuff(u, { key: 'phantom-clone:heal-free', persist: true, allowDead: true, flags: { healFree: true } });
    b.on('death', ({ unit: dead }) => {
      if (dead !== u) return;
      // Original charge_token[finish] calls RechargeToken ON_FINISH. The
      // independent token redeploy delay starts on removal, not on deployment.
      state.stock = Math.min(1, state.stock + 1);
      state.readyAt = b.time + state.record.stats.respawnTime;
    }, { owner: u });
  };
  return battle.spawnToken(state.owner, TOKEN, row, col, { dir, def: state.record, kit });
}
