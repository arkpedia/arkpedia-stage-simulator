// SPDX-License-Identifier: GPL-3.0-or-later
// Opt-in selected S2 healing mode; token placement/repair/aura and S3 are separate.
import evidence from '../../../data/arkpedia-mon3tr-prefabs.json' with { type: 'json' };
import { mon3trSourceComponent as component } from './arkpedia-mon3tr-source.js';
import { prepareMon3trHealing, MON3TR_HEALING_CONTRACT } from './arkpedia-mon3tr-healing.js';
import { bodyInKeys } from '../body.js';

export const MON3TR_S2_CONTRACT = Object.freeze({
  scope: 'Diagnostic selected S2 owner mode, Reconstruction priority, delayed extra chain and Tactical Coordination override',
  mapping: 'Manual source duration and offensive SP; native Begin/Loop/Idle/End clips, capped release animation speed and retained attack cooldown. An owned in-range Reconstruction is preferred even at full HP. The non-damage-missable 0.6000000238418579-second max-stack-1 projectile buff produces one separate chain from Reconstruction, without another attack/SP account or recursive extra buff. The native talent wrapper scales attack_speed before buff creation, including Mon3tr and Reconstruction. Current S2 mode chooses the scaled value; delayed chains can finish after S2 ends and then grant the base value. Base/boosted deadlines are independent and only the strongest live source applies.',
  limits: 'Source EmitProjectile spatial origin is Reconstruction; this local adapter retains Mon3tr healing credit and snapshots the incoming pre-modifier heal power for its delayed chain. Compiled projectile/modifier source and scale transport remain unresolved. Owned-token priority, selector aliases, begin/end gating, retained cooldown and buff/receipt ordering are explicit simulator policies, not certified Unity dispatch. Reconstruction deployment/repair/aura, S3, modules, particles, audio and game-frame parity remain held.',
  frameParity: false,
});
const TOKEN = 'token_10050_monstr_prosts';
const live = a => a?.alive && a.deployed && !a.hidden && !a._removing;
const pending = new WeakMap();
const projection = component('-6176855876930541592')._activeBuffs[0];

function verify() {
  const attack = component('-6176855876930541592'), skill = component('-414017318533697675');
  const talent = component('8821816479889516520');
  const nodes = evidence.templates['monstr_s_2[proj]'].eventToActions.ON_BUFF_FINISH;
  if (attack._animKey !== 'Skill_2_Loop' || attack._endAnimKey !== 'Skill_2_Idle'
    || attack._waitForAttackEvent !== 1 || attack._projectileKey !== 'projectile_chr_monstr_s2'
    || projection.buffKey !== 'monstr_s_2[proj]' || projection.isDamageMissable !== 0
    || projection.lifeTime !== .6000000238418579 || projection.maxStackCnt !== 1
    || projection.refreshRemainingTimeWhenStackMax !== 0 || projection.independentCharacterSource !== 0
    || skill._canSilenced !== 0 || skill._allowSpRecoveryWhenAffecting !== 0
    || skill._beginAnim !== 'Skill_2_Begin' || skill._resetAbilityCooldownWhenCastEnd !== 0
    || skill._onlyAvailableWhenTokenValid !== 0 || skill._checkHasTargetBeforeDoCast !== 1
    || talent._applyTalentScale !== 1 || talent._scaleCertainKeyFlag !== 1
    || JSON.stringify(talent._scaleCertainKeyList) !== '["attack_speed"]' || talent._scaleCertainMode !== 0
    || nodes[0]._filterId !== TOKEN || nodes[1]._projectileKey !== 'projectile_chr_monstr_s2_extra'
    || nodes[1]._sourceType !== 'BUFF_OWNER' || nodes[1]._targetType !== 'BUFF_OWNER'
    || !nodes[1]._overwriteBuffs || nodes[1]._buffDataList.length !== 0)
    throw Error('Unreviewed Mon3tr S2 source mode');
  for (const face of ['Front', 'Back'])
    if (evidence.models.char_4179_monstr[face].eventPayloads.Skill_2_Loop[0].time !== .6666666865348816)
      throw Error('Unreviewed Mon3tr S2 release event');
}

export class Mon3trS2Controller {
  constructor(core) { this.core = core; this.b = core.b; this.u = core.u; this.record = core.record; this.stopped = false; }
  active() { return !this.stopped && this.core.valid() && live(this.u) && this.u.skill.active; }
  targets() {
    if (!this.active()) return undefined;
    const tokens = [...this.core.reconstructions].filter(([a, entry]) => a.deploySeq === entry.seq
      && this.core.eligible(a) && bodyInKeys(a, this.u.rangeKeySet))
      .map(([a]) => a).sort((a, z) => a.deploySeq - z.deploySeq);
    return tokens.length ? tokens.slice(0, 1) : this.core.candidates(this.u.rangeKeySet).slice(0, 1);
  }
  canCast() {
    if (this.stopped || !this.core.valid() || !live(this.u) || !this.u.canAct || this.u.s.flags.disarm || this.u.skill.active) return false;
    return [...this.core.reconstructions].some(([a, e]) => a.deploySeq === e.seq
      && this.core.eligible(a) && bodyInKeys(a, this.u.rangeKeySet))
      || this.core.candidates(this.u.rangeKeySet).length > 0;
  }
  spec() {
    return { kind: 'duration', silenceable: false, trigger: { rule: 'NEVER' }, attack: {},
      canActivate: () => this.canCast(), onStart: () => this.start(), onEnd: ({ reason }) => this.end(reason) };
  }
  start() {
    this.core.phase = { kind: 'born', readyAt: this.b.time + this.core.model().durations.Skill_2_Begin };
    this.core.visual('Skill_2_Begin');
  }
  end(reason) {
    if (this.stopped || !this.core.valid() || !live(this.u) || reason === 'death') return;
    this.core.phase = { kind: 'born', readyAt: this.b.time + this.core.model().durations.Skill_2_End };
    this.core.visual('Skill_2_End');
  }
  idleClip() { return this.active() ? 'Skill_2_Idle' : 'Idle'; }
  coordinationScale() { return !this.stopped && this.u.skill.active ? this.record.bb.talent_scale : 1; }
  attackConfig() {
    if (!this.active()) return {};
    return { clip: 'Skill_2_Loop', chainOptions: { tag: 's2', coordinationScale: () => this.coordinationScale(),
      onRecipient: ctx => this.armExtra(ctx) } };
  }
  armExtra({ target, seq, power }) {
    if (this.b.finished || !live(target) || target.deploySeq !== seq || target.defId !== TOKEN) return;
    const old = pending.get(target);
    if (target.findBuff(projection.buffKey) || old?.seq === seq && (old.admitting || target.buffs.includes(old.buff))) return;
    const entry = { seq, power, admitting: true, finished: false, cancelled: false, buff: null };
    pending.set(target, entry);
    const finish = () => {
      if (entry.finished) return;
      entry.finished = true;
      if (pending.get(target) !== entry) return;
      pending.delete(target);
      if (entry.cancelled || this.b.finished || !live(target) || target.deploySeq !== seq) return;
      this.core.chain(target, { amount: power, from: target, tag: 's2-extra',
        coordinationScale: () => this.coordinationScale() });
    };
    entry.buff = this.b.addBuff(target, { key: projection.buffKey, source: this.u,
      duration: projection.lifeTime, onExpire: finish, onRemove: finish });
    entry.admitting = false;
    if (!entry.buff || !live(target) || target.deploySeq !== seq || pending.get(target) !== entry) {
      entry.cancelled = true;
      if (pending.get(target) === entry) pending.delete(target);
      if (entry.buff) this.b.removeBuff(target, entry.buff);
    }
  }
  stop() { this.stopped = true; } // Fired active buffs have their own recipient lifetime.
}

export function prepareMon3trS2(b, u, { contract } = {}) {
  if (contract !== MON3TR_S2_CONTRACT || u.def.skill?.id !== 'skchr_monstr_2')
    throw Error('Mon3tr S2 requires its reviewed selected-skill contract');
  verify();
  const prepared = prepareMon3trHealing(b, u, { contract: MON3TR_HEALING_CONTRACT });
  const skills = new Mon3trS2Controller(prepared.controller);
  prepared.controller.ownerSkills = skills; prepared.kit.skill = skills.spec();
  return { ...prepared, skills };
}
