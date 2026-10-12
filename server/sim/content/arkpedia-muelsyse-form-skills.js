// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-muelsyse-prefabs.json' with { type: 'json' };
import { flattenBlackboard as flat } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';
import { muelsyseSourceComponent as component } from './arkpedia-muelsyse.js';
import { MUELSYSE_OWNER_SKILL_CONTRACT, MuelsyseOwnerSkills, prepareMuelsyseOwnerSkills } from './arkpedia-muelsyse-owner-skills.js';

export const MUELSYSE_FORM_SKILL_CONTRACT = Object.freeze({
  scope: 'Owner skills plus S2/S3 copied-form skill diagnostic with active-host birth/recovery dispatch',
  mapping: 'S2 melee forms regenerate selected max-HP ratio and receive Physical/Arts resistance. Ranged forms switch to native mode four and reselect one random eligible target at each B_Attack_2 event; each accepted receipt advances the split counter. S3 melee forms switch to mode five, pull eligible neighbouring enemies with source force zero over half a second every two seconds, and retain source-owned stun only while blocking each victim. S3 ranged forms bind accepted spell targets for the selected duration and the original point refreshes/spawns up to five source-cross tiles; generated copies do not recursively burst. Active-host birth/recovery attaches shared attributes and the current form effect. Refresh restarts a clone expiry clock; all effects and copy locks retire with their source.',
  limits: 'Source holder/trigger dispatch, random-selection ordering, derived block attachment, timed pull geometry, recovery/soft withdrawal, clone expiry/protection, independent EmitProjectile/SpawnToken selectors and native FSM/modifier clocks are explicit simulator mappings, not compiled Unity parity. S1 still uses the strict owner diagnostic pulse clipping and its authored display/end-frame discrepancy remains unresolved. Squad cost talent, delivered artwork, mouse/touch copying and public approval remain held. Native particle/shader/audio and modules remain unsupported.',
  frameParity: false,
});
const live = u => u?.alive && u.deployed && !u._removing && !u.hidden;
const due = (b, time) => b.time + 1e-9 >= time;
const grids = id => evidence.tables.ranges[id].grids.map(v => [v.row, v.col]);
const copyFields = ['maxHp', 'atk', 'def', 'res', 'blockCnt', 'bat'];

function verify() {
  const a = component('-3633190244100056981'), selector = component('-2549743587281250197');
  const hook = component('-6290542621344180117')._replaceAnimPairs;
  const regen = evidence.templates['mlyss_s_2[token_melee_holder]'].eventToActions.ON_BUFF_START[5]._buff;
  const resistance = evidence.templates['mlyss_s_2[token_buff_melee]'].eventToActions.ON_BUFF_START[0];
  const bind = evidence.templates['mlyss_s_3[token_buff_range]'].eventToActions.ON_ABILITY_SPELL_ON;
  const stun = evidence.templates['mlyss_wtrman_s_3[block]'].eventToActions.ON_BUFF_START[0];
  const pull = component('-7927345257167594536'), spawn = component('1538351550693366744');
  const tiles = component(spawn._selector.m_PathID);
  const trigger = evidence.templates['mlyss_s_3[token_range_trigger]'].eventToActions.ON_BUFF_START;
  if (a._selectTargetSource !== 1 || a._selectTargetTiming !== 1 || a._alwaysIncludeTarget !== 0
    || a._additionalTimes !== 1 || a._waitAttackEventForAllAttacks !== 1 || a._splitDamage !== 0
    || a._maxAnimScale !== 1 || selector._selectNum !== 1 || selector._targetMotion !== 3
    || selector._ignoreTargetFree !== 0 || hook.find(v => v.fromAnimKey === 'Attack')?.toAnimKey !== 'B_Attack_2'
    || regen.attributes.attributeModifiers[0].attributeType !== 'HP_RECOVERY_PER_SEC_BY_MAX_HP_RATIO'
    || regen.attributes.attributeModifiers[0].formulaItem !== 'ADDITION'
    || resistance._buffKey !== 'damage_resistance[inf]' || !resistance._isDerivedBuff
    || !resistance._finishDerivedBuffIfParentFinish || bind[0]._familyGroupMask !== 'ATTACK_OR_COMBAT'
    || bind[1]._buff.attributes.abnormalFlags.join() !== 'UNMOVABLE' || bind[1]._buffOwner !== 'MAIN_TARGET'
    || bind[1]._isDerivedBuff || !stun._isDerivedBuff || !stun._finishDerivedBuffIfParentFinish
    || stun._buff.attributes.abnormalFlags.join() !== 'STUNNED'
    || pull._pullDuration !== .5 || pull._pullSourceOffset !== .5 || pull._forceKey !== 'force'
    || tiles._maxNum !== 5 || tiles._limitTargetNum !== 1 || spawn._forceSpawn !== 0
    || spawn._useOwnerHost !== 1 || spawn._addBuffsIfOverlay !== 1
    || trigger[0]._buffKeys.join() !== 'mlyss_wtrman_summon[override]' || !trigger[1].$type.includes('+IfNot,')
    || flat(evidence.tables.tokenSkills.sktok_mlyss_wtrman_3.levels[0].blackboard).force !== 0)
    throw Error('Unreviewed Muelsyse copied-form skill source');
}

export class MuelsyseFormSkills extends MuelsyseOwnerSkills {
  constructor(core) { super(core); this.forms = new Map(); }
  formValid(s, p) { return this.active && this.core.devices.valid(s)
    && p.seq === s.seq && p.generation === s.generation && this.forms.get(s) === p; }
  tokenRemoved(s) {
    super.tokenRemoved(s);
    const p = this.forms.get(s); if (!p) return;
    this.forms.delete(s);
    for (const key of p.keys) this.b.removeBuff(s.unit, key);
    for (const [t, record] of p.stuns) this.b.removeBuff(t, record.key);
    p.stuns.clear(); p.pulls.clear(); s.phase = null;
    if ([4, 5].includes(s.mode)) { s.mode = s.copy?.ranged ? 3 : 2; this.core.devices.sync(s); }
  }
  clearParents() {
    super.clearParents();
    for (const s of [...this.forms.keys()]) this.tokenRemoved(s);
  }
  start() {
    super.start();
    for (const s of [...this.core.devices.tokens.values()]) this.attachForm(s);
  }
  tokenActivated(s) {
    if (!this.active) return;
    this.attachToken(s); this.attachForm(s);
  }
  tokenRefreshed(s) { if (this.core.devices.valid(s) && s.clone) s.expiresAt = this.b.time + 25; }
  attachForm(s) {
    if (!this.active || !this.core.devices.valid(s) || ![2, 3].includes(s.mode) || this.forms.has(s)
      || !this.record.index) return;
    const p = { seq: s.seq, generation: s.generation, keys: [], stuns: new Map(), pulls: new Map(),
      nextPull: this.b.time + this.record.bb['mlyss_s_3[token_melee_trigger].interval'] };
    this.forms.set(s, p);
    const { b, record: r } = this, t = s.unit;
    if (r.index === 1 && s.mode === 2) {
      const regen = `muelsyse:s2:regen:${this.castSeq}`, resistance = `muelsyse:s2:resistance:${this.castSeq}`;
      p.keys.push(regen, resistance);
      b.addBuff(t, { key: regen, source: this.u, mods: { hpRegenRatio: r.bb.hp_recovery_per_sec_by_max_hp_ratio } });
      if (!this.formValid(s, p)) { b.removeBuff(t, regen); return; }
      b.applyStatus(t, 'sanctuary', { key: resistance, source: this.u, value: r.bb.damage_resistance });
      if (!this.formValid(s, p)) b.removeBuff(t, resistance);
    } else if (r.index === 1) {
      s.phase = null; s.mode = 4; t.atkCd = 0; this.core.devices.sync(s);
    } else if (s.mode === 2) {
      s.mode = 5; this.core.devices.sync(s); this.syncStuns(s, p);
    } else if (!s.clone) this.burst(s, p);
  }
  beforeTokenHit(s, target) {
    const p = this.forms.get(s);
    if (!p || !this.formValid(s, p) || this.record.index !== 2 || !s.copy?.ranged || !live(target)
      || target.def.immune?.has('bind') || target.def.immune?.has('unmovable')) return;
    // Native ON_ABILITY_SPELL_ON is not a derived buff. It expires by its
    // own duration even if the parent skill/source finishes after this cast.
    this.b.applyStatus(target, 'bind', { key: `muelsyse:s3:bind:${s.unit.id}:${s.seq}`,
      source: s.unit, duration: this.record.bb['mlyss_s_3[unmoveable].duration'] });
  }
  syncStuns(s, p) {
    for (const [t, record] of [...p.stuns]) if (!live(t) || t.deploySeq !== record.seq || t.blockedBy !== s.unit) {
      p.stuns.delete(t); this.b.removeBuff(t, record.key);
    }
    for (const t of this.b.enemies.filter(t => live(t) && t.blockedBy === s.unit)) {
      if (!this.formValid(s, p) || p.stuns.has(t)) continue;
      const record = { seq: t.deploySeq, key: `muelsyse:s3:block:${s.unit.id}:${s.seq}` };
      p.stuns.set(t, record);
      const accepted = this.b.applyStatus(t, 'stun', { key: record.key, source: s.unit });
      if (!this.formValid(s, p) || p.stuns.get(t) !== record || t.deploySeq !== record.seq || t.blockedBy !== s.unit) {
        this.b.removeBuff(t, record.key); p.stuns.delete(t);
      } else if (!accepted) p.stuns.delete(t);
    }
  }
  pull(s, p) {
    const t = s.unit, keys = new Set(absoluteRangeKeys(grids('x-4'), t.tileR, t.tileC, 'RIGHT'));
    for (const e of this.b.enemies.filter(e => live(e) && e.blockedBy !== t
      && canTargetEnemy(t, e, { canHitFly: true }) && (!e.s.flags.camou || e.blockedBy) && bodyInKeys(e, keys))) {
      if (!this.formValid(s, p)) return;
      const dx = e.x - t.x, dy = e.y - t.y, len = Math.hypot(dx, dy);
      if (!len) continue;
      const plan = this.b.planPull(e, 0, { to: { x: t.x + .5 * dx / len, y: t.y + .5 * dy / len }, center: t, stop: .5 });
      if (plan) p.pulls.set(e, { seq: e.deploySeq, plan, elapsed: 0 });
    }
  }
  tickPulls(s, p) {
    for (const [t, item] of [...p.pulls]) {
      if (!this.formValid(s, p) || !live(t) || t.deploySeq !== item.seq || t.blockedBy === s.unit) {
        p.pulls.delete(t); continue;
      }
      const spent = Math.min(this.b.dt, .5 - item.elapsed); item.elapsed += spent;
      this.b.displace(t, item.plan.direction, item.plan.distance * spent / .5);
      if (item.elapsed + 1e-9 >= .5) p.pulls.delete(t);
    }
  }
  burst(s, p) {
    const d = this.core.devices, b = this.b;
    for (const [dr, dc] of grids('x-5')) {
      if (!this.formValid(s, p)) return;
      const r = s.unit.tileR + dr, c = s.unit.tileC + dc, occupant = b.unitAt(r, c), old = d.tokens.get(occupant);
      if (!d.tileEligible(r, c, d.valid(old) && old.copy?.ranged ? occupant : null)) continue;
      b.addProjectile({ from: s.unit, to: { x: c, y: r }, source: s.unit, speed: 4, maxAge: 10, visual: 'arrow',
        data: { arkpediaTrackedVisual: true, projectileKey: 'projectile_chr_mlyss_wtrman', zeroDamage: true } });
      if (!this.formValid(s, p)) return;
      if (old) {
        b.heal(occupant, occupant, occupant.s.maxHp, { self: true, ignoreHealFree: true, skipModifierEvent: true });
        this.tokenRefreshed(old); continue;
      }
      const snapshot = structuredClone(s.copy);
      snapshot.stats = Object.fromEntries(copyFields.map(k => [k, s.unit.base[k]]));
      const clone = d.create(r, c, snapshot); if (clone) clone.expiresAt = b.time + 25;
    }
  }
  tickToken(s) {
    const p = this.forms.get(s);
    if (!p || !this.formValid(s, p)) return false;
    if (s.mode === 5) {
      this.syncStuns(s, p); this.tickPulls(s, p);
      while (this.formValid(s, p) && due(this.b, p.nextPull)) {
        p.nextPull += this.record.bb['mlyss_s_3[token_melee_trigger].interval']; this.pull(s, p);
      }
    }
    if (s.mode !== 4) return false;
    this.tickRepeat(s, p); return true;
  }
  tickRepeat(s, parent) {
    const d = this.core.devices, b = this.b, t = s.unit; let p = s.phase;
    if (!live(t) || !t.canAct || t.s.flags.disarm || s.selecting || p && p.epoch !== t.attackControlEpoch) {
      s.phase = null; d.visual(s, 'B_Idle', true); return;
    }
    if (p) {
      for (const event of p.events) {
        if (event.released || !due(b, event.at)) continue;
        event.released = true;
        const target = b.rng.pick(d.targets(s, { all: true })); if (!target) continue;
        p.target = target; p.targetSeq = target.deploySeq; p.releaseAt = event.at; p.accepted = false;
        s.accepting = true;
        try { b.forceAttack(t, [target]); } finally { s.accepting = false; }
        if (!this.formValid(s, parent) || s.phase !== p || s.mode !== 4 || !t.canAct || t.s.flags.disarm) return;
      }
      if (!due(b, p.readyAt)) return;
      s.phase = null;
    }
    if (t.atkCd > 1e-9 || !d.targets(s).length) { if (!s.phase) d.visual(s, 'B_Idle', true); return; }
    const m = d.record.models.Single, clip = 'B_Attack_2', speed = Math.min(1, t.base.bat / t.s.interval);
    s.phase = { kind: 'muelsyse:s2-repeat', epoch: t.attackControlEpoch,
      events: m.eventPayloads[clip].filter(v => v.name === 'OnAttack').map(v => ({ at: b.time + v.time / speed, released: false })),
      readyAt: b.time + Math.max(t.s.interval, m.durations[clip] / speed) };
    d.visual(s, clip, false, speed); t.atkCd = t.s.interval;
  }
  releaseToken(s, target, info) {
    const d = this.core.devices, t = s.unit, p = s.phase, parent = this.forms.get(s);
    if (!parent || !this.formValid(s, parent) || !s.accepting || s.mode !== 4
      || !live(t) || !t.canAct || t.s.flags.disarm || p?.kind !== 'muelsyse:s2-repeat' || p.accepted
      || p.epoch !== t.attackControlEpoch || p.target !== target || p.targetSeq !== target.deploySeq
      || !due(this.b, p.releaseAt) || !live(target) || !canTargetEnemy(t, target, { canHitFly: true })) return false;
    p.accepted = true;
    this.b.dealDamage(t, target, makeDamageInfo({ amount: t.s.atk * t.s.atkScaleMul,
      type: s.copy.damageType, isAttack: true, isSkill: true, applyWay: 'ranged', attackId: info.attackId ?? 0,
      tags: ['muelsyse:s2-shape'] }));
    if (this.formValid(s, parent) && ++s.casts >= 10) { s.casts = 0; d.split(s); }
    return true;
  }
}

export function prepareMuelsyseFormSkills(b, u, { contract } = {}) {
  if (contract !== MUELSYSE_FORM_SKILL_CONTRACT) throw Error('Muelsyse requires the reviewed copied-form skill contract');
  verify();
  const prepared = prepareMuelsyseOwnerSkills(b, u, { contract: MUELSYSE_OWNER_SKILL_CONTRACT });
  const skills = new MuelsyseFormSkills(prepared.controller); prepared.controller.skills = skills;
  return { ...prepared, skills, kit: { ...prepared.kit, skill: { ...prepared.kit.skill,
    canActivate: () => skills.canCast(), onStart: () => skills.start(),
    onTick: ({ dt }) => skills.tickDp(dt), onEnd: ({ reason }) => skills.end(reason),
  } } };
}
