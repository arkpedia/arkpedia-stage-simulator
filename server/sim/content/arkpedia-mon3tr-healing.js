// SPDX-License-Identifier: GPL-3.0-or-later
// Opt-in healing mechanics. Reconstruction placement/repair and S2/S3 are held.
import evidence from '../../../data/arkpedia-mon3tr-prefabs.json' with { type: 'json' };
import { MON3TR_ID as ID, selectedMon3trBuild, mon3trSourceComponent as component } from './arkpedia-mon3tr-source.js';
import { normalizeChess, normSpType } from '../simdata.js';
import { absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';

export const MON3TR_HEALING_CONTRACT = Object.freeze({
  scope: 'Diagnostic ordinary and S1 chain healing, native owner release timing, offensive SP and base Tactical Coordination',
  mapping: 'One injured input; three counted recipients, or S1 selected chain.max_target. Reconstruction consumes neither a bounce nor decay. Each chain visits a deployment once, chooses the lowest HP ratio within x-4, and uses the original speed-10 flight. The fired chain retains its release ATK/scale/talent snapshot independently of owner removal. Positive healing modifiers grant separate ten-second nonstacking owner/recipient ASPD buckets without refreshing an existing equal-priority bucket.',
  limits: 'Selector numeric aliases, free-jump count/decay dispatch, target tie-breaking, launch snapshot and modifier ordering are explicit simulator policies, not recovered compiled Unity behavior. Full-HP ordinary bounce targets are excluded. Reconstruction can be attached only as an explicit diagnostic recipient: deployment, repair, aura and S2/S3 are not supplied here. Modules, native particles, audio and game-frame parity remain held.',
  frameParity: false,
});
const TOKEN = 'token_10050_monstr_prosts';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const due = (b, at) => b.time + 1e-8 >= at;
const grid = evidence.tables.ranges['x-4'].grids.map(g => [g.row, g.col]);
function syncCoordination(b, a) {
  const key = 'mon3tr:coordination-effect';
  const strongest = a.buffs.filter(buff => buff.tags.includes('mon3tr:coordination-source'))
    .sort((x, y) => y.data.attackSpeed - x.data.attackSpeed || x.seq - y.seq)[0];
  if (!live(a) || !strongest) { b.removeBuff(a, key); return; }
  const old = a.findBuff(key);
  if (old?.source !== strongest.source || old?.mods.aspd !== strongest.data.attackSpeed)
    b.addBuff(a, { key, source: strongest.source, mods: { aspd: strongest.data.attackSpeed } });
}

function selected(u, contract) {
  if (contract !== MON3TR_HEALING_CONTRACT) throw Error('Mon3tr requires its reviewed healing contract');
  if (u.def.charId !== ID || u.deploySeq !== 0 || u.mem.mon3trHealing)
    throw Error('Mon3tr requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedMon3trBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || s.skillType !== r.source.skillType || s.durationType !== r.source.durationType
    || s.spType !== normSpType(r.source.spData.spType) || s.spCost !== r.source.spData.spCost
    || s.initSp !== r.source.spData.initSp || s.maxCharges !== r.source.spData.maxChargeTime
    || s.duration !== r.source.duration || !same(s.bb, r.bb)
    || !same(s.rangeGrid ?? [], r.skillRangeGrid) || !same(u.rangeGrid, r.rangeGrid)
    || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats)
    || !same(u.def.tags, r.tags) || !same(u.def.talents.map(t => t.bb), r.talentBb))
    throw Error('Incomplete Mon3tr selected source');
  const attack = component('-8786417442084198424');
  if (attack._animKey !== 'Attack' || attack._maxAnimScale !== 1 || attack._waitForAttackEvent !== 1
    || attack._projectileKey !== 'projectile_chr_monstr' || attack._ignoreHealFree !== 1)
    throw Error('Unreviewed Mon3tr native healing ability');
  return r;
}

export class Mon3trHealingController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null;
    this.phase = null; this.accepting = false; this.stopped = false; this.handles = [];
    this.reconstructions = new Map();
  }
  valid() { return !this.stopped && !this.b.finished && live(this.u) && this.seq === this.u.deploySeq; }
  model() { return evidence.models[ID][['UP', 'LEFT'].includes(this.u.dir) ? 'Back' : 'Front']; }
  visual(clip, speed = 1, loop = false) {
    this.u.mem.regularFormVisual = { clip, speed, loop };
    this.u.mem.regularVisualDirection = ['UP', 'LEFT'].includes(this.u.dir) ? 'UP' : 'RIGHT';
  }
  eligible(a, source = this.u) {
    return live(a) && a.side === 'ally' && a.kind !== 'device' && !a.s.flags.untargetable
      && this.b.allySelectable(a, source) && (source === a || !(a.s.flags.noHeal || a.profile?.noHeal));
  }
  candidates(keys, seen = null) {
    return this.b.allyUnits.filter(a => this.eligible(a) && a.hp < a.s.maxHp - 1e-8
      && (!seen || !seen.has(a)) && bodyInKeys(a, keys))
      .sort((a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq);
  }
  targets() { return this.candidates(this.u.rangeKeySet).slice(0, 1); }
  // No token creation or deployment approval is implied by attaching a recipient.
  attachReconstruction(token) {
    if (this.stopped || !live(token) || token.defId !== TOKEN || token.ownerUnit !== this.u
      || this.reconstructions.has(token)) throw Error('Expected a fresh owned diagnostic Reconstruction');
    const seq = token.deploySeq;
    const guard = this.b.on('heal', ctx => {
      if (ctx.target === token && token.deploySeq === seq && ctx.source !== token && ctx.source?.defId !== ID)
        ctx.amount = 0;
    }, { owner: token });
    this.b.addBuff(token, { key: 'monstr[free_jump]', source: this.u });
    this.reconstructions.set(token, { seq, guard });
    return token;
  }
  freeJump(a) { return a.defId === TOKEN && !!a.findBuff('monstr[free_jump]'); }
  coordination(target, talent) {
    if (!talent) return;
    for (const a of new Set([this.u, target])) {
      if (!live(a)) continue;
      const key = `mon3tr:${this.u.id}:coordination`;
      // Native same-source equal-priority max-stack entries do not refresh.
      if (!a.findBuff(key)) {
        this.b.addBuff(a, { key, source: this.u, duration: talent.buff_duration,
          tags: ['mon3tr:coordination-source'], data: { attackSpeed: talent.attack_speed },
          onRemove: () => syncCoordination(this.b, a), onExpire: () => syncCoordination(this.b, a) });
        syncCoordination(this.b, a);
      }
    }
  }
  chain(target, { skill = false, amount = this.u.s.atk * this.u.s.atkScaleMul } = {}) {
    const { b, u, record } = this, seen = new Set(), life = new Map();
    const limit = skill ? record.bb['chain.max_target'] : 3;
    const talent = record.talentBb[1] && { ...record.talentBb[1] };
    const visited = a => seen.has(a) && life.get(a) === a.deploySeq;
    const bounce = (from, next, remaining, power) => {
      const seq = next.deploySeq;
      b.addProjectile({ from, target: next, source: u, speed: 10, visual: 'orb',
        data: { arkpediaTrackedVisual: true, mon3trChain: true, isSkill: skill },
        onHit: ({ target: a }) => {
          if (b.finished || !a || a.deploySeq !== seq || !this.eligible(a) || visited(a)) return;
          seen.add(a); life.set(a, seq);
          // A source identity/sequence stays fixed across modifier callbacks.
          let accepted = false;
          const h = b.on('calculatedHeal', ctx => {
            if (ctx.source === u && ctx.target === a && ctx.opts === opts && ctx.amount > 0) accepted = true;
          });
          const opts = { ignoreHealFree: true, mon3trChain: true };
          try { b.heal(u, a, power, opts); } finally { b.off(h); }
          if (accepted && live(a) && a.deploySeq === seq) this.coordination(a, talent);
          if (!live(a) || a.deploySeq !== seq || b.finished) return;
          const free = this.freeJump(a), left = remaining - (free ? 0 : 1);
          if (left <= 0) return;
          const keys = new Set(absoluteRangeKeys(grid, a.tileR, a.tileC, 'RIGHT'));
          const next = this.candidates(keys).find(t => !visited(t));
          if (next) bounce({ x: a.x, y: a.y }, next, left, power * (free ? 1 : .75));
        } });
    };
    if (!Number.isInteger(limit) || limit < 1) throw Error('Invalid Mon3tr chain target budget');
    bounce(u, target, limit, amount);
  }
  release(target) {
    const p = this.phase;
    if (!this.accepting || !this.valid() || !this.u.canAct || this.u.s.flags.disarm || !p
      || p.kind !== 'attack' || p.target !== target || p.targetSeq !== target.deploySeq || p.accepted
      || p.epoch !== this.u.attackControlEpoch || !due(this.b, p.releaseAt) || !this.eligible(target)) return false;
    p.accepted = true;
    this.chain(target, { skill: p.skill, amount: this.u.s.atk * this.u.s.atkScaleMul
      * (p.skill ? this.record.bb.heal_scale : 1) });
    return true;
  }
  canS1() { return this.record.index === 0 && this.valid() && this.u.canAct && !this.u.s.flags.disarm
    && !this.u.skill.active && this.u.atkCd <= 1e-9 && !this.phase && this.targets().length > 0; }
  tick() {
    if (!this.valid()) return;
    const { b, u } = this;
    let p = this.phase;
    if (p?.kind === 'born') { if (!due(b, p.readyAt)) return; this.phase = p = null; }
    if (!u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.phase = null; if (u.skill.active && this.record.index === 0) u.skill.end('interrupted');
      this.visual('Idle', 1, true); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        if (live(p.target) && p.target.deploySeq === p.targetSeq) {
          this.accepting = true;
          try { b.forceAttack(u, [p.target]); } finally { this.accepting = false; }
        }
        if (p.skill) u.skill.end(p.accepted ? 'heal-released' : 'input-lost');
      }
      if (!due(b, p.readyAt)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const target = this.targets()[0];
    if (!target) { this.visual('Idle', 1, true); return; }
    if (this.record.index === 0 && u.skill.ready && this.canS1()) u.skill.activate('DEFAULT');
    const skill = this.record.index === 0 && u.skill.active;
    const clip = skill ? 'Skill_1' : 'Attack', speed = Math.min(1, u.base.bat / u.s.interval);
    const release = this.model().eventPayloads[clip][0].time / speed;
    const cadence = Math.max(release, u.s.interval);
    this.phase = { kind: 'attack', startedAt: b.time, target, targetSeq: target.deploySeq, skill,
      epoch: u.attackControlEpoch, releaseAt: b.time + release, readyAt: b.time + cadence };
    u.atkCd = cadence; this.visual(clip, speed);
  }
  install() {
    if (this.handles.length || this.stopped) throw Error('Mon3tr healing controller cannot be reinstalled');
    const { b, u } = this;
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit !== u || move) return;
      this.seq = u.deploySeq;
      this.phase = { kind: 'born', readyAt: b.time + this.model().durations.Start };
      this.visual('Start');
    }, { owner: u }), b.on('tick', () => {
      if (this.stopped || b.finished || this.seq !== null && !this.valid()) this.stop(); else this.tick();
    }, { owner: u }), b.on('death', ({ unit }) => { if (unit === u) this.stop(); }, { owner: u }),
    b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.accepting = false;
    for (const h of this.handles) this.b.off(h); this.handles = [];
    // Token guards belong to their recipient lifetimes, including an already
    // fired projectile after the owner retires. No owner hook owns those guards.
    this.u.mem.regularFormVisual = null; delete this.u.mem.regularVisualDirection;
  }
}

export function prepareMon3trHealing(b, u, { contract } = {}) {
  const record = selected(u, contract), controller = new Mon3trHealingController(b, u, record);
  u.mem.mon3trHealing = controller;
  return { record, controller, kit: { talents: [], install: null,
    trait: { noAttack: true, attackDrivenSkill: true, attack: 'ranged', projectile: 'none', dmgType: 'none',
      heal: null, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false, chain: null,
      splashRadius: 0, attackVisual: 'none', requiresAcceptedLaunch: true,
      launchAttack: (_b, _u, _p, target) => controller.release(target) },
    skill: record.index === 0 ? { kind: 'instant', trigger: { rule: 'NEVER' }, attack: {},
      flags: { noSp: true }, completeOnAttack: false, canActivate: () => controller.canS1() }
      : { kind: 'instant', trigger: { rule: 'NEVER' }, canActivate: () => false } } };
}
