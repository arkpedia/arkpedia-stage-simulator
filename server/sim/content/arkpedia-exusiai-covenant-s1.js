// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-exusiai-covenant-prefabs.json' with { type: 'json' };
import { sortEnemyTargets } from '../targeting.js';
import { makeDamageInfo } from '../damage.js';

export const EXUSIAI_COVENANT_S1_CONTRACT = Object.freeze({
  scope: 'Selected-source automatic eight-round S1 and manual remaining-ammunition burst; public enablement remains held',
  mapping: 'Native .3-second mode pre-delay, capped normal clip speed and original OnAttack events; physical current-ATK arrivals; aerial normal priority and source-text random burst reselection; snapshot remaining ammo before close, consume it once at first burst event, separate .05-second projectile births, close-clip SP lock',
  limits: 'Compiled discard/progress dispatch and random selector comparator, rangeIdUsageType7, start/cancel ordering during Born, native timeMode conversion, particle/audio output, modules and Unity frame parity remain unverified. Base promotion attack range is retained; range_id display override is not applied as an undocumented attack-range change.',
  frameParity: false,
});
const ID = 'char_1041_angel2';
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const due = (b, time) => b.time + 1e-9 >= time;

export class ExusiaiCovenantS1 {
  constructor(core) { this.core = core; this.b = core.b; this.u = core.u; this.record = core.record; this.burst = null; }
  canCast() { return this.core.valid() && this.u.canAct && !this.u.s.flags.disarm && !this.burst; }
  start() {
    const { core, b, u } = this;
    core.phase = { kind: 's1-start', readyAt: b.time + .30000001192092896 };
    core.visual('Skill_1_Begin');
  }
  end(reason) {
    if (reason === 'manual-burst') return; // retain the close animation's tail and SP lock
    this.burst = null;
    this.b.removeBuff(this.u, 'angel2:s1-close');
    if (reason !== 'ammo' || this.core.phase?.kind !== 's1-attack') this.core.phase = null;
  }
  manualStop() {
    const { core, b, u } = this;
    if (!core.valid() || !u.canAct || u.s.flags.disarm || !u.skill.active || this.burst
      || core.phase?.kind === 's1-start') return false;
    const m = model(u), count = u.skill.ammoLeft;
    if (!(count > 0)) return false;
    this.burst = { count, epoch: u.attackControlEpoch, consumed: false, born: 0,
      releaseAt: b.time + m.eventPayloads.Skill_1_Close.find(e => e.name === 'OnAttack').time,
      readyAt: b.time + m.durations.Skill_1_Close };
    core.phase = null; core.visual('Skill_1_Close');
    b.addBuff(u, { key: 'angel2:s1-close', flags: { noSp: true } });
    return true;
  }
  projectile(target, kind, round = 0, attackId = 0) {
    const { core, b, u, record } = this, seq = target.deploySeq;
    const projectile = b.addProjectile({ from: u, target, source: u,
      speed: kind === 'burst' && round > 0 ? 10 : 30, maxAge: 10, visual: 'bolt',
      data: { arkpediaTrackedVisual: true, exusiaiCovenantOwner: core, exusiaiCovenantKind: `s1-${kind}` },
      onHit: ({ target: hit }) => {
        if (b.finished || hit !== target || target.deploySeq !== seq || !core.eligible(target)) return;
        b.dealDamage(u, target, makeDamageInfo({ amount: u.s.atk * u.s.atkScaleMul * record.bb['attack@atk_scale'],
          type: 'phys', isAttack: true, isSkill: true, attackId, applyWay: 'ranged', tags: [`angel2:s1-${kind}`] }));
      } });
    b.emit('exusiaiCovenantS1ProjectileBirth', { owner: u, target, projectile, kind, round });
    return projectile;
  }
  release(target, info) {
    const { core, b, u } = this, p = core.phase;
    if (!core.valid() || !u.canAct || u.s.flags.disarm || p?.kind !== 's1-attack'
      || p.accepted || !u.skill.active || p.target !== target || p.targetSeq !== target.deploySeq
      || p.epoch !== u.attackControlEpoch || !core.eligible(target) || !due(b, p.releaseAt)) return false;
    p.accepted = true; this.projectile(target, 'normal', 0, info.attackId); return true;
  }
  releaseBurst(target, info) {
    const { core, u } = this, c = this.burst;
    if (!c?.accepting || c.accepted || !core.valid() || !u.canAct || u.s.flags.disarm
      || c.epoch !== u.attackControlEpoch || !core.eligible(target)) return false;
    c.accepted = true; c.attackId = info.attackId;
    this.projectile(target, 'burst', 0, c.attackId); return true;
  }
  tick() {
    const { core, b, u } = this;
    if (this.burst) {
      const c = this.burst;
      if (!u.canAct || u.s.flags.disarm || c.epoch !== u.attackControlEpoch) {
        this.burst = null; u.skill.end('interrupted'); b.removeBuff(u, 'angel2:s1-close');
        core.visual('Idle', 1, true); return true;
      }
      if (due(b, c.releaseAt)) {
        if (!c.consumed) {
          c.consumed = true; u.skill.ammoLeft = 0;
          b.emit('ammoUsed', { unit: u, skill: u.skill, count: c.count, left: 0 });
        }
        while (this.burst === c && core.valid() && c.born < c.count && due(b, c.releaseAt + c.born * .05000000074505806)) {
          const targets = core.targets(), round = c.born++;
          const target = targets.length ? targets[Math.min(targets.length - 1, Math.floor(b.rng() * targets.length))] : null;
          if (target && round === 0) {
            c.accepting = true; b.forceAttack(u, [target]); c.accepting = false;
          } else if (target) this.projectile(target, 'burst', round, c.attackId ?? 0);
        }
      }
      if (!core.valid() || this.burst !== c) return true;
      if (c.born === c.count && u.skill.active) u.skill.end('manual-burst');
      if (due(b, Math.max(c.readyAt, c.releaseAt + (c.count - 1) * .05000000074505806))) {
        this.burst = null; b.removeBuff(u, 'angel2:s1-close'); core.visual('Idle', 1, true);
      }
      return true;
    }
    // Native canSilenced=0 and canCastDuringBorn=1. The generic automatic
    // trigger suppresses silence; this reviewed source cast does not.
    if (!u.skill.active && u.skill.ready && this.canCast()) {
      u.skill.activate('angel2:s1-auto'); return true;
    }
    let p = core.phase;
    if (p?.kind === 's1-start') {
      if (!due(b, p.readyAt)) return true;
      core.phase = null; p = null;
    }
    if (p?.kind === 's1-attack') {
      if (!u.canAct || u.s.flags.disarm || p.epoch !== u.attackControlEpoch) {
        core.phase = null; core.visual('Skill_1_Idle', 1, true); return true;
      }
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        if (core.eligible(p.target) && p.targetSeq === p.target.deploySeq) b.forceAttack(u, [p.target]);
      }
      if (!core.valid()) return true;
      if (!due(b, p.readyAt)) return true;
      core.phase = null;
    }
    if (!u.skill.active) return false;
    if (!u.canAct || u.s.flags.disarm || u.atkCd > 1e-9) return true;
    const targets = core.targets(); sortEnemyTargets(b, u, targets, 'fly');
    const target = targets[0];
    if (!target) { core.visual('Skill_1_Idle', 1, true); return true; }
    const m = model(u), clip = u.dir === 'DOWN' ? 'Skill_Down_1_Loop' : 'Skill_1_Loop';
    const speed = Math.min(1, u.base.bat / u.s.interval);
    core.phase = { kind: 's1-attack', target, targetSeq: target.deploySeq, epoch: u.attackControlEpoch,
      clip, speed, releaseAt: b.time + m.eventPayloads[clip].find(e => e.name === 'OnAttack').time / speed,
      readyAt: b.time + Math.max(u.s.interval, m.durations[clip] / speed), accepted: false, released: false };
    core.visual(clip, speed); u.atkCd = u.s.interval;
    return true;
  }
  hidden() {
    if (this.burst?.consumed && this.u.skill.active) this.u.skill.end('hidden');
    this.burst = null; this.b.removeBuff(this.u, 'angel2:s1-close');
  }
  ownerStop() { this.burst = null; this.b.removeBuff(this.u, 'angel2:s1-close'); }
}
