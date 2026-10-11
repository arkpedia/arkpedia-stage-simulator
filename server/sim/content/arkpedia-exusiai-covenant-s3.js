// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-exusiai-covenant-prefabs.json' with { type: 'json' };
import { makeDamageInfo } from '../damage.js';

export const EXUSIAI_COVENANT_S3_CONTRACT = Object.freeze({
  scope: 'Selected-source manual fifty-round S3 enemy volley; Delivery Coordinates and public enablement remain held',
  mapping: 'First original OnAttack event starts one accepted command; four additional native .1-second births reselect live in-range targets. Consume up to five actual bullets once through the shared free-ammo boundary. Current ATK on each physical impact; cap clip speed at one. Hold the depleted skill through the accepted command tail, then restore ordinary mode.',
  limits: 'Compiled multi-attack/event/progress dispatch, selector comparators, timeMode conversion, final-command completion clock and surplus-ammo remainder behavior are explicit local mappings, not Unity frame parity. Delivery Coordinates, redeployment, modules, native particles/audio and public/browser action integration remain unfinished.',
  frameParity: false,
});
const ID = 'char_1041_angel2', DELTA = .10000000149011612;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const due = (b, time) => b.time + 1e-9 >= time;

export class ExusiaiCovenantS3 {
  constructor(core) { this.core = core; this.b = core.b; this.u = core.u; this.record = core.record; }
  canCast() { return this.core.valid() && this.u.canAct && !this.u.s.flags.disarm && this.core.phase?.kind !== 's3-end'; }
  start() {
    const { core, b, u } = this, clip = u.dir === 'DOWN' ? 'Skill_Down_3_Begin' : 'Skill_3_Begin';
    core.phase = { kind: 's3-start', readyAt: b.time + model(u).durations[clip] }; core.visual(clip);
  }
  end(reason) {
    const { core, b, u } = this;
    if (core.valid() && ['manual', 'ammo'].includes(reason)) {
      const clip = u.dir === 'DOWN' ? 'Skill_Down_3_End' : 'Skill_3_End';
      core.phase = { kind: 's3-end', readyAt: b.time + model(u).durations[clip] }; core.visual(clip);
    } else core.phase = null;
  }
  projectile(target, p, round) {
    const { core, b, u, record } = this, seq = target.deploySeq;
    const projectile = b.addProjectile({ from: u, target, source: u, speed: 30, maxAge: 10, visual: 'bolt',
      data: { arkpediaTrackedVisual: true, exusiaiCovenantOwner: core, exusiaiCovenantKind: 's3' },
      onHit: ({ target: hit }) => {
        if (b.finished || hit !== target || target.deploySeq !== seq || !core.eligible(target)) return;
        b.dealDamage(u, target, makeDamageInfo({ amount: u.s.atk * u.s.atkScaleMul * record.bb['attack@atk_scale'],
          type: 'phys', isAttack: true, isSkill: true, attackId: p.attackId, applyWay: 'ranged', tags: ['angel2:s3'] }));
      } });
    b.emit('exusiaiCovenantS3ProjectileBirth', { owner: u, target, projectile, round, attackId: p.attackId });
  }
  release(target, info) {
    const { core, b, u } = this, p = core.phase;
    if (!core.valid() || !u.skill.active || !u.canAct || u.s.flags.disarm || p?.kind !== 's3-attack'
      || p.accepted || p.target !== target || p.targetSeq !== target.deploySeq || p.epoch !== u.attackControlEpoch
      || !core.eligible(target) || !due(b, p.releaseAt)) return false;
    p.accepted = true; p.attackId = info.attackId; p.round = 1;
    this.projectile(target, p, 0); return true;
  }
  consume(ctx) {
    const { core, b, u } = this, p = core.phase;
    // Shared beforeAmmoUse has already made its single free-command decision.
    // Additional projectile births never enter this boundary again.
    const free = ctx.noAmmo; ctx.noAmmo = true;
    if (free || !core.valid() || p?.kind !== 's3-attack' || !p.accepted || p.consumed) return;
    p.consumed = true;
    const count = Math.min(5, u.skill.ammoLeft);
    if (count <= 0) return;
    u.skill.ammoLeft -= count;
    b.emit('ammoUsed', { unit: u, skill: u.skill, count, left: u.skill.ammoLeft });
  }
  tick() {
    const { core, b, u } = this;
    let p = core.phase;
    if (p?.kind === 's3-end') {
      if (!due(b, p.readyAt)) return true;
      core.phase = null; core.visual('Idle', 1, true); return true;
    }
    if (!u.skill.active) return false;
    if (p?.kind === 's3-start') {
      if (!due(b, p.readyAt)) return true;
      core.phase = null; p = null;
    }
    if (!u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      core.phase = null;
      if (u.skill.ammoLeft <= 0) u.skill.end('control');
      else core.visual(u.dir === 'DOWN' ? 'Skill_Down_3_Idle' : 'Skill_3_Idle', 1, true);
      return true;
    }
    if (core.coordinates?.tick()) return true;
    if (p?.kind === 's3-attack') {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        if (p.targetSeq === p.target.deploySeq && core.eligible(p.target)) b.forceAttack(u, [p.target]);
      }
      // Hooks may stop/replace the skill or remove its owner at the first birth
      // or ammunition receipt. Never resurrect that detached command.
      if (!core.valid() || core.phase !== p || !u.skill.active) return true;
      while (p.accepted && p.round < 5 && due(b, p.releaseAt + p.round * DELTA / p.speed)) {
        const round = p.round++, target = core.targets()[0];
        if (target) this.projectile(target, p, round);
        if (!core.valid() || core.phase !== p || !u.skill.active) return true;
      }
      if (!due(b, p.readyAt)) return true;
      core.phase = null;
      if (u.skill.ammoLeft <= 0) { u.skill.end('ammo'); return true; }
    }
    if (core.coordinates?.tick()) return true;
    if (u.atkCd > 1e-9) return true;
    const target = core.targets()[0];
    if (!target) { core.visual(u.dir === 'DOWN' ? 'Skill_Down_3_Idle' : 'Skill_3_Idle', 1, true); return true; }
    const clip = u.dir === 'DOWN' ? 'Skill_Down_3_Loop' : 'Skill_3_Loop', m = model(u);
    const speed = Math.min(1, u.base.bat / u.s.interval);
    const event = m.eventPayloads[clip].find(e => e.name === 'OnAttack').time;
    core.phase = { kind: 's3-attack', target, targetSeq: target.deploySeq, epoch: u.attackControlEpoch,
      speed, releaseAt: b.time + event / speed, readyAt: b.time + Math.max(u.s.interval, m.durations[clip] / speed),
      accepted: false, released: false, consumed: false, round: 0 };
    core.visual(clip, speed); u.atkCd = u.s.interval;
    return true;
  }
  hidden() {
    if (this.u.skill.active && this.u.skill.ammoLeft <= 0) this.u.skill.end('hidden');
  }
}
