// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-exusiai-covenant-prefabs.json' with { type: 'json' };
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';

export const EXUSIAI_COVENANT_S2_CONTRACT = Object.freeze({
  scope: 'Selected-source manual S2 ammunition, allied ASPD transfer and independent decaying barriers; public enablement remains held',
  mapping: 'Capture the latest deployed eligible in-range operator at cast; apply the ordered shield/mode/steal work after the unscaled Begin clip; flat ASPD transfer with native strongest victim modifier, retain owner gain after target invalidation, restore bonus capacity without deleting already granted ammo; accepted eventless cast births and selected interval cadence with capped visual speed; cached cast ATK on impact',
  barriers: 'Both capacities snapshot BUFF_SOURCE Max HP; subtract the original capacity divided by thirty once per second from the remaining shield. Shared shield replacement is independent of the parent skill and lives until damage, decay, recipient removal or battle end.',
  limits: 'Compiled postFilter4 comparator, low-ASPD transfer saturation, max-count restoration, ordered waitForAttackEvent1 setup dispatch without a Begin hit event, eventless attack birth clock, timeMode conversion, particles/audio, modules and Unity frame parity are not certified. Source silence permission is tested through the private runtime; public action integration remains held.',
  frameParity: false,
});
const ID = 'char_1041_angel2', SHIELD = 'angel2:s2-shield';
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const due = (b, t) => b.time + 1e-9 >= t;

export class ExusiaiCovenantS2 {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record;
    this.loan = null; this.shields = new Set(); this.shieldHooks = []; this.monitor = null;
  }
  canCast() { return this.core.valid() && this.u.canAct && !this.u.s.flags.disarm && this.core.phase?.kind !== 's2-end'; }
  eligibleAlly(a) {
    return a !== this.u && live(a) && a.kind === 'op' && !a.s.flags.untargetable && !a.s.flags.sleep
      && this.b.allySelectable(a, this.u);
  }
  candidates() {
    return this.b.allyUnits.filter(a => this.eligibleAlly(a) && bodyInKeys(a, this.u.rangeKeySet))
      .sort((a, z) => z.deploySeq - a.deploySeq);
  }
  start() {
    const { core, u, b } = this, target = this.candidates()[0], clip = u.dir === 'DOWN' ? 'Skill_Down_2_Begin' : 'Skill_2_Begin';
    this.clearLoan();
    core.phase = { kind: 's2-start', target, targetSeq: target?.deploySeq, readyAt: b.time + model(u).durations[clip] };
    core.visual(clip);
  }
  shield(a) {
    const { b, u, record } = this, capacity = u.s.maxHp * record.bb.shield_max_hp_ratio;
    b.removeBuff(a, SHIELD); // native replacement does not filter the shield's source
    const state = { target: a, seq: a.deploySeq, buff: null, capacity, decrement: capacity / record.bb.shield_max_duration };
    state.buff = b.addBuff(a, { key: SHIELD, source: u, shield: capacity, visible: true, interval: 1,
      data: { exusiaiCovenantS2Shield: state },
      onTick: ({ buff }) => {
        buff.shield = Math.max(0, buff.shield - state.decrement); a.markDirty();
        if (!a.alive || a.deploySeq !== state.seq || buff.shield <= 1e-9) b.removeBuff(a, buff);
      }, onRemove: () => { this.shields.delete(state); this.releaseShieldHooks(); } });
    if (!state.buff) return null;
    this.shields.add(state);
    if (!this.shieldHooks.length) this.shieldHooks = [
      b.on('removed', ({ unit }) => { for (const s of [...this.shields]) if (s.target === unit) this.retireShield(s); }),
      b.on('death', ({ unit }) => { for (const s of [...this.shields]) if (s.target === unit) this.retireShield(s); }),
      b.on('battleEnd', () => { for (const s of [...this.shields]) this.retireShield(s); }),
    ];
    return state;
  }
  releaseShieldHooks() {
    if (this.shields.size) return;
    for (const h of this.shieldHooks) this.b.off(h); this.shieldHooks = [];
  }
  retireShield(state) {
    this.b.removeBuff(state.target, state.buff);
    // Unit removal clears its buff list before delivering `removed`; the
    // producer still has to retire that original identity and its hooks.
    this.shields.delete(state); this.releaseShieldHooks();
  }
  transfer(a) {
    const { b, u, record: r } = this;
    const amount = Math.min(r.bb.steal, r.bb.steal_max), key = `angel2:s2-victim:${u.id}`;
    const marker = `angel2:s2-select:${u.id}`;
    this.loan = { target: a, seq: a.deploySeq, amount, key, marker, granted: r.bb.recover_each_cnt };
    b.addBuff(a, { key, source: u, tags: ['steal-victim'], mods: { aspd: -amount } });
    b.addBuff(a, { key: marker, source: u });
    b.addBuff(u, { key: 'angel2:s2-owner', source: u, mods: { aspd: amount } });
    u.skill.addAmmo(r.bb.recover_each_cnt);
    this.monitor = b.on('tick', () => {
      if (this.loan && (!this.eligibleAlly(a) || this.loan.seq !== a.deploySeq)) this.clearLoan(true);
    });
    b.emit('exusiaiCovenantS2Transfer', { owner: u, target: a, amount });
  }
  clearLoan(keepGain = false) {
    const { b, u } = this, loan = this.loan;
    this.loan = null;
    if (loan) {
      b.removeBuff(loan.target, loan.key); b.removeBuff(loan.target, loan.marker);
      if (u.skill?.active) u.skill.ammoMax = Math.max(u.skill.ammoLeft, u.skill.ammoMax - loan.granted);
    }
    if (!keepGain) b.removeBuff(u, 'angel2:s2-owner');
    if (this.monitor) b.off(this.monitor); this.monitor = null;
  }
  end(reason) {
    const { core, u, b } = this;
    this.clearLoan(); b.removeBuff(u, 'angel2:s2-mode');
    if (core.valid() && ['manual', 'ammo'].includes(reason)) {
      const clip = u.dir === 'DOWN' ? 'Skill_Down_2_End' : 'Skill_2_End';
      core.phase = { kind: 's2-end', readyAt: b.time + model(u).durations[clip] }; core.visual(clip);
    } else core.phase = null;
  }
  release(target, info) {
    const { core, b, u, record } = this, p = core.phase;
    if (!core.valid() || !u.skill.active || !u.canAct || u.s.flags.disarm || p?.kind !== 's2-attack'
      || p.accepted || p.target !== target || p.targetSeq !== target.deploySeq || p.epoch !== u.attackControlEpoch
      || !core.eligible(target)) return false;
    p.accepted = true;
    const seq = target.deploySeq, cachedAtk = u.s.atk * u.s.atkScaleMul;
    const projectile = b.addProjectile({ from: u, target, source: u, speed: 30, maxAge: 10, visual: 'bolt',
      data: { arkpediaTrackedVisual: true, exusiaiCovenantOwner: core, exusiaiCovenantKind: 's2' },
      onHit: ({ target: hit }) => {
        if (b.finished || hit !== target || target.deploySeq !== seq || !core.eligible(target)) return;
        b.dealDamage(u, target, makeDamageInfo({ amount: cachedAtk * record.bb['attack@atk_scale'], type: 'phys',
          isAttack: true, isSkill: true, attackId: info.attackId, applyWay: 'ranged', tags: ['angel2:s2'] }));
      } });
    b.emit('exusiaiCovenantS2ProjectileBirth', { owner: u, target, projectile, cachedAtk }); return true;
  }
  tick() {
    const { core, b, u, record } = this;
    let p = core.phase;
    if (p?.kind === 's2-end') {
      if (!due(b, p.readyAt)) return true;
      core.phase = null; core.visual('Idle', 1, true); return true;
    }
    if (!u.skill.active) return false;
    if (p?.kind === 's2-start') {
      if (!due(b, p.readyAt)) return true;
      core.phase = null; this.shield(u);
      b.addBuff(u, { key: 'angel2:s2-mode', source: u, mods: { batFlat: record.bb.base_attack_time } });
      if (p.target && p.targetSeq === p.target.deploySeq && this.eligibleAlly(p.target)) {
        this.shield(p.target); this.transfer(p.target);
      }
      p = null;
    }
    if (!u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      core.phase = null; core.visual(u.dir === 'DOWN' ? 'Skill_Down_2_Idle' : 'Skill_2_Idle', 1, true); return true;
    }
    if (u.atkCd > 1e-9) return true;
    const target = core.targets()[0];
    if (!target) { core.visual(u.dir === 'DOWN' ? 'Skill_Down_2_Idle' : 'Skill_2_Idle', 1, true); return true; }
    const clip = u.dir === 'DOWN' ? 'Skill_Down_2_Loop' : 'Skill_2_Loop';
    core.phase = { kind: 's2-attack', target, targetSeq: target.deploySeq, epoch: u.attackControlEpoch, accepted: false };
    core.visual(clip, Math.min(1, u.base.bat / u.s.interval)); u.atkCd = u.s.interval;
    b.forceAttack(u, [target]);
    return true;
  }
  ownerStop() {
    this.clearLoan(); this.b.removeBuff(this.u, 'angel2:s2-mode');
    for (const s of [...this.shields]) if (this.b.finished || s.target === this.u) this.retireShield(s);
    this.releaseShieldHooks();
  }
}
