// SPDX-License-Identifier: GPL-3.0-or-later
// Unregistered controller. S2 requires a caller-supplied experimental event /
// selector contract: neither identical native payload is silently preferred.
import evidence from '../../../data/arkpedia-nymph-prefabs.json' with { type: 'json' };
import { NymphCombatLinks, NYMPH_ID } from './arkpedia-nymph-links.js';
import { bodyInKeys } from '../body.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';

const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const profile = Object.freeze({ canHitFly: true, attack: 'ranged', dmgType: 'arts' });
const model = u => evidence.models[NYMPH_ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
// Native Ranged caps animation playback at one. Attack interval is independent
// of clip completion; fast attacks can replace the previous visual clip.
const rate = u => Math.min(1, u.base.bat / u.s.interval);
const modKey = u => `nymph:s3:${u.id}`;
const castKey = u => `nymph:s2-cast:${u.id}`;
export function nymphCandidates(b, u, count = 1) {
  const rows = b.enemies.filter(e => canTargetEnemy(u, e, profile)
    && (bodyInKeys(e, u.rangeKeySet) || e.blockedBy === u));
  sortEnemyTargets(b, u, rows);
  return rows.slice(0, count);
}

export class NymphController {
  constructor(b, u, links, s2Contract) {
    this.b = b; this.u = u; this.links = links; this.mode = 0;
    this.phase = null; this.stopped = false; this.controlEpoch = u.attackControlEpoch;
    this.skill = Number(u.def.skill.id.at(-1));
    if (![1, 2, 3].includes(this.skill) || u.def.skill.id !== `skchr_nymph_${this.skill}`)
      throw Error('Invalid Nymph selected skill');
    if (this.skill === 2 && (!s2Contract || ![0, 1].includes(s2Contract.eventIndex)
      || typeof s2Contract.selectTarget !== 'function' || typeof s2Contract.reviewNote !== 'string'
      || !s2Contract.reviewNote.trim())) throw Error('Nymph S2 requires an explicit experimental event/selector contract');
    this.s2Contract = s2Contract;
  }
  visual(clip, { loop = false, speed = 1 } = {}) {
    if (!Object.hasOwn(model(this.u).durations, clip)) throw Error(`Missing original Nymph clip: ${clip}`);
    this.u.mem.regularFormVisual = { clip, loop, speed };
  }
  idle() { this.visual(this.mode === 3 ? 'Skill_3_Idle' : 'Idle', { loop: true }); }
  canCast() {
    const u = this.u;
    return !this.stopped && live(u) && u.canAct && !u.s.flags.silence
      && !['s2', 's3-begin', 's3-end'].includes(this.phase?.kind)
      && (this.skill !== 2 || !!this.s2Target());
  }
  s2Target() {
    const target = this.s2Contract.selectTarget(this.b, this.u);
    return target && nymphCandidates(this.b, this.u, Infinity).includes(target) ? target : null;
  }
  startSkill() {
    const { b, u } = this;
    if (this.skill === 1) { this.mode = 1; return; } // switch_mode does not restart the attack FSM
    this.phase = null;
    if (this.skill === 3) {
      const speed = rate(u); this.visual('Skill_3_Begin', { speed });
      u.skill.timeLeft = Infinity;
      this.phase = { kind: 's3-begin', readyAt: b.time + model(u).durations.Skill_3_Begin / speed };
      return;
    }
    const target = this.s2Target();
    if (!target) throw Error('Nymph S2 selector changed during accepted activation');
    const events = model(u).eventPayloads.Skill_2;
    if (events.length !== 2 || events.some(e => e.name !== 'OnAttack')) throw Error('Unreviewed Nymph S2 events');
    const speed = rate(u); this.visual('Skill_2', { speed });
    // A charged command owns a finite pending cast, not a duration skill.
    // Hold all SP sources explicitly until completion or interruption.
    u.skill.pending = true;
    b.addBuff(u, { key: castKey(u), source: u, flags: { noSp: true } });
    this.phase = { kind: 's2', target, point: { x: target.x, y: target.y }, released: false,
      releaseAt: b.time + events[this.s2Contract.eventIndex].time / speed,
      readyAt: b.time + model(u).durations.Skill_2 / speed,
      attackId: `nymph:${u.id}:s2:${u.skill.activations}` };
  }
  finishS3Begin() {
    const { b, u } = this, selected = u.def.skill.bb;
    this.mode = 3;
    b.addBuff(u, { key: modKey(u), source: u, mods: { atkPct: selected.atk, aspd: selected.attack_speed } });
    u.skill.spec.targeting = { rangeGrid: u.def.skill.rangeGrid, maxTargets: selected['attack@max_target'] };
    b.refreshRange(u); u.skill.timeLeft = u.def.skill.duration;
    // Entering the new attack FSM cancels the previous ordinary attack cooldown.
    u.atkCd = 0; this.phase = null; this.idle();
  }
  endSkill() {
    const { b, u } = this;
    if (this.skill === 1) { this.mode = 0; return; }
    this.phase = null; this.mode = 0;
    if (this.skill === 3) {
      b.removeBuff(u, modKey(u)); u.skill.spec.targeting = null; b.refreshRange(u);
      if (live(u) && !this.stopped) {
        const speed = rate(u); this.visual('Skill_3_End', { speed });
        this.phase = { kind: 's3-end', readyAt: b.time + model(u).durations.Skill_3_End / speed };
      }
    } else {
      b.removeBuff(u, castKey(u));
      if (live(u) && !this.stopped) this.idle();
    }
  }
  startAttack() {
    const { b, u } = this;
    const targets = nymphCandidates(b, u, this.mode === 3 ? u.def.skill.bb['attack@max_target'] : 1);
    if (!targets.length) return;
    const clip = this.mode === 3 ? 'Skill_3_Attack' : 'Attack', speed = rate(u);
    const events = model(u).eventPayloads[clip];
    if (events.length !== 1 || events[0].name !== 'OnAttack') throw Error('Unreviewed Nymph attack event');
    this.visual(clip, { speed });
    const delay = events[0].time / speed;
    this.phase = { kind: 'attack', targets, mode: this.mode, released: false,
      releaseAt: b.time + delay, readyAt: b.time + Math.max(delay, u.s.interval) };
    u.atkCd = Math.max(delay, u.s.interval);
  }
  fire(e, info) {
    const p = this.phase, u = this.u;
    if (this.stopped || !live(u) || !u.canAct || u.s.flags.disarm || p?.kind !== 'attack'
      || !p.released || !p.targets.includes(e) || p.born?.has(e)) return false;
    // S1 enters/leaves mode without restarting an in-progress ordinary cast.
    const mode = p.mode === 3 ? 3 : this.mode;
    if (!this.links.launchAttack(e, info.attackId, mode, u.def.skill.bb)) return false;
    (p.born ??= new Set()).add(e); return true;
  }
  tick() {
    const { b, u } = this;
    if (this.stopped) return;
    if (!live(u)) { this.stop(); return; }
    // Native S3 activation predelay is explicitly uninterruptible. Control
    // blocks later attacks, but does not cancel the committed mode transition.
    if (this.phase?.kind === 's3-begin') {
      if (b.time + 1e-9 >= this.phase.readyAt) this.finishS3Begin();
      this.controlEpoch = u.attackControlEpoch; return;
    }
    if (this.phase?.kind === 's3-end') {
      if (b.time + 1e-9 >= this.phase.readyAt) { this.phase = null; this.idle(); }
      this.controlEpoch = u.attackControlEpoch; return;
    }
    if (!u.canAct || u.s.flags.disarm || this.controlEpoch !== u.attackControlEpoch) {
      this.controlEpoch = u.attackControlEpoch;
      const s2 = this.phase?.kind === 's2'; this.phase = null;
      if (s2) u.skill.end('interrupted-cast');
      this.idle(); return;
    }
    const p = this.phase;
    if (p?.kind === 's2') {
      if (!p.released && b.time + 1e-9 >= p.releaseAt) {
        p.released = true;
        p.born = this.links.launchS2({ target: p.target, point: p.point,
          attackId: p.attackId, selected: u.def.skill.bb });
      }
      if (b.time + 1e-9 >= p.readyAt) u.skill.end('command-finish');
      return;
    }
    if (p?.kind === 'attack') {
      if (!p.released && b.time + 1e-9 >= p.releaseAt) {
        p.released = true;
        b.forceAttack(u, p.targets.filter(e => canTargetEnemy(u, e, profile)));
      }
      if (b.time + 1e-9 < p.readyAt) return;
      this.phase = null; u.atkCd = 0; this.idle();
    }
    if (!this.phase && u.atkCd <= 1e-9) this.startAttack();
  }
  install() {
    this.idle(); this.timer = this.b.every(this.b.dt, () => this.tick(), { owner: this.u });
    this.deathHook = this.b.on('death', ({ unit }) => { if (unit === this.u) this.stop(); });
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.timer?.cancel(); this.links.stop();
    this.b.removeBuff(this.u, modKey(this.u));
    this.b.removeBuff(this.u, castKey(this.u));
    if (this.u.skill) { this.u.skill.spec.targeting = null; this.b.refreshRange(this.u); }
    this.u.mem.regularFormVisual = null;
    if (this.deathHook) this.b.off(this.deathHook);
  }
}

/** Test/integration entry point only. No runtime import or roster enables it. */
export function prepareNymphKit(b, u, { s2Contract } = {}) {
  if (u.def.charId !== NYMPH_ID) throw Error('Nymph controller requires Nymph source data');
  const s = u.def.skill, rank = u.def.raw.arkpedia?.skillRank;
  const selected = Number.isInteger(rank) && rank >= 1 && rank <= 10
    ? evidence.tables.skills[s.id]?.levels[rank - 1] : null;
  const values = selected && Object.fromEntries(selected.blackboard.map(r => [r.key, r.value]));
  const range = selected?.rangeId ? evidence.tables.ranges[selected.rangeId].grids.map(p => [p.row, p.col]) : [];
  if (!selected || s.duration !== selected.duration || s.spType !== 'time'
    || s.spCost !== selected.spData.spCost || s.initSp !== selected.spData.initSp
    || s.maxCharges !== selected.spData.maxChargeTime
    || Object.keys(s.bb).length !== Object.keys(values).length
    || Object.entries(values).some(([k, v]) => s.bb[k] !== v)
    || JSON.stringify(s.rangeGrid) !== JSON.stringify(range)) throw Error('Incomplete Nymph selected source skill');
  const links = new NymphCombatLinks(b, u);
  let controller;
  try { controller = new NymphController(b, u, links, s2Contract); }
  catch (error) { links.stop(); throw error; }
  Object.assign(u.mem, { nymphLinks: links, nymphController: controller });
  const kit = {
    trait: { noAttack: true, attackDrivenSkill: true, attack: 'ranged', dmgType: 'arts',
      canHitFly: true, projectile: 'orb', maxTargets: 1, hits: 1, attackVisual: 'none',
      requiresAcceptedLaunch: true,
      launchAttack: (_b, _u, _p, e, info) => controller.fire(e, info) },
    skill: { id: s.id, name: s.name, kind: controller.skill === 2 ? 'charges' : 'duration',
      ...(controller.skill === 2 ? { pendingText: 'Skill casting' } : { duration: s.duration }),
      charges: s.maxCharges, trigger: { rule: 'NEVER' },
      canActivate: () => controller.canCast(),
      ...(controller.skill === 1 ? { mods: { atkPct: s.bb.atk } } : {}),
      onStart: () => controller.startSkill(), onEnd: () => controller.endSkill() },
  };
  return { kit, controller, links };
}
