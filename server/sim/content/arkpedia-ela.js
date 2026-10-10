// SPDX-License-Identifier: GPL-3.0-or-later
// Unregistered owner adapter. Owner-finish output and public build/asset
// integration remain separate work; this file never enables roster support.
import evidence from '../../../data/arkpedia-ela-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys, bodyInRadius } from '../body.js';
import { ELA_ID, ELA_INFLUENCE, ElaMineDeck, selectedElaMine } from './arkpedia-ela-mines.js';

const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const flat = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
const same = (a, z) => JSON.stringify(a ?? []) === JSON.stringify(z ?? []);
const model = u => evidence.models[ELA_ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const ownerComponents = evidence.characters[ELA_ID].flatMap(o => o.components);
const attackSources = ['-5815782764201512154', '-7345763969213795546', '5400400117896966950']
  .map(id => ownerComponents.find(c => c.pathId === id)?.data);
const projectile = name => {
  const rows = evidence.projectiles[name].flatMap(o => o.components.map(c => c.data));
  return { name, root: rows.find(c => '_lifeTime' in c), mover: rows.find(c => '_speed' in c || '_immediatelyReach' in c),
    selector: rows.find(c => '_targetOptions' in c) };
};
const shots = [projectile('projectile_chr_ela'), projectile('projectile_chr_ela_s2'), projectile('projectile_chr_ela_s3')];

// Explicit, opt-in web scheduling choices. Numeric native FSM callbacks,
// critical/dodge ordering and transferred-source damage are not frame certified.
export const ELA_OWNER_CONTRACT = Object.freeze({
  phasePolicy: 'source-clips-local-v1', entrance: 'whole-source-start-clip',
  attackPost: 'max-interval-and-source-loop', skillTransitions: 'whole-source-begin-and-end-clips',
  criticalTiming: 'ordinary-impact-and-s3-birth', splashTiming: 'source-projectile-stop',
  reviewNote: 'Uncapped clip scaling, current source stats for ordinary/S2 impacts, captured S3 ATK/critical and marker-first priority are local mappings. Owner-finish output is not implemented.',
});
const validContract = c => ['phasePolicy', 'entrance', 'attackPost', 'skillTransitions', 'criticalTiming', 'splashTiming']
  .every(k => c?.[k] === ELA_OWNER_CONTRACT[k]) && typeof c?.reviewNote === 'string' && !!c.reviewNote.trim();

function checkNative() {
  if (attackSources.some((a, i) => !a || a._waitForAttackEvent !== (i ? 0 : 1)
    || a._maxAnimScale !== -1 || a._selectTargetTiming !== 0 || a._preDelay !== 0
    || a._useCachedAtkOnly !== (i === 2 ? 1 : 0) || a._transferSource !== (i === 2 ? 1 : 0))
    || shots.some(s => !s.root || !s.mover || s.root._stopWhenSourceInvalid !== 0)
    || [shots[0], shots[2]].some(s => s.mover._speed !== 15 || s.root._lifeTime !== 10
      || s.root._maxHitNum !== 1 || s.root._alwaysHitTraceTargetInTheEnd !== 1)
    || shots[1].mover._immediatelyReach !== 1 || shots[1].mover._followTarget !== 0
    || shots[1].selector?._onlyCheckHitWhenStop !== 1 || shots[1].selector?._ignoreCamouflage !== 1
    || shots[1].selector?._targetOptions.targetMotion !== 3
    || Math.abs(shots[1].root._lifeTime - .1) > 1e-7)
    throw Error('Unreviewed Ela owner attack/projectile source');
}

export function selectedElaCritical(build) {
  selectedElaMine(build); // Shared promotion/rank/potential/no-module validation.
  const t = sourceCandidate(evidence.tables.character.talents[1].candidates, build);
  return t ? Object.freeze(flat(t.blackboard)) : null;
}

export class ElaOwnerController {
  constructor(b, u, record, critical, contract) {
    if (!validContract(contract)) throw Error('Ela owner requires reviewed phase contracts');
    checkNative();
    this.b = b; this.u = u; this.record = record; this.critical = critical;
    this.skill = record.index + 1; this.mode = 0; this.phase = null; this.chain = false;
    this.stopped = false; this.handles = []; this.deck = null;
    this.controlEpoch = u.attackControlEpoch;
  }
  clip(mode, part) {
    return mode ? `Skill_${this.u.dir === 'DOWN' && part === 'Loop' ? 'Down_' : ''}${mode}_${part}`
      : `Attack_${this.u.dir === 'DOWN' && part === 'Loop' ? 'Down_' : ''}${part}`;
  }
  visual(clip, { speed = 1, loop = false } = {}) {
    if (!Object.hasOwn(model(this.u).durations, clip)) throw Error(`Missing original Ela clip: ${clip}`);
    this.u.mem.regularFormVisual = { clip, speed, loop };
  }
  idle() { this.visual(this.mode ? this.clip(this.mode, 'Idle') : 'Idle', { loop: true }); }
  legal(e, selecting = false) {
    return e?.side === 'enemy' && live(e) && canTargetEnemy(this.u, e, { canHitFly: true })
      && (!selecting || !e.s.flags.camou || !!e.blockedBy);
  }
  candidates() {
    const rows = this.b.enemies.filter(e => this.legal(e, true)
      && (bodyInKeys(e, this.u.rangeKeySet) || e.blockedBy === this.u));
    sortEnemyTargets(this.b, this.u, rows);
    // Keep core blocker priority, then prefer ANY influence marker. Native
    // filterBuffSource=0 does not restrict it to this deployment's mines.
    if (this.mode === 3) rows.sort((a, z) => Number(z.blockedBy === this.u) - Number(a.blockedBy === this.u)
      || Number(!!z.findBuff(ELA_INFLUENCE)) - Number(!!a.findBuff(ELA_INFLUENCE)));
    return rows;
  }
  criticalScale(e) {
    const t = this.critical;
    if (!t) return 1;
    return e.findBuff(ELA_INFLUENCE) || this.b.rng() < t.prob ? t.atk_scale : 1;
  }
  impact(e, shot) {
    if (this.b.finished || !this.legal(e)) return;
    const u = this.u;
    // Dynamic ordinary/S2 values are sampled at each accepted recipient.
    // S3's cached damage keeps its born ATK and critical after skill expiry.
    const amount = shot.mode === 3 ? shot.cachedAmount
      : u.s.atk * u.s.atkScaleMul * this.criticalScale(e);
    this.b.dealDamage(u, e, { amount, type: 'phys', applyWay: 'ranged',
      isProjectile: true, isAttack: true, isSkill: shot.mode > 0, isSplash: shot.mode === 2,
      defIgnoreFlat: shot.mode === 2 ? shot.penetration : 0,
      attackId: shot.attackId, tags: [`ela:${shot.mode ? `s${shot.mode}` : 'normal'}`] });
  }
  validInput(e) {
    const p = this.phase, u = this.u;
    return !this.stopped && !this.b.finished && live(u) && u.canAct && !u.s.flags.disarm
      && p?.kind === 'attack' && p.released && !p.born && p.target === e
      && p.seq === u.deploySeq && p.controlEpoch === u.attackControlEpoch && p.mode === this.mode
      && e.deploySeq === p.targetSeq && this.legal(e, true)
      && (bodyInKeys(e, u.rangeKeySet) || e.blockedBy === u);
  }
  fire(e, { attackId }) {
    if (!this.validInput(e)) return false;
    const { b, u } = this, p = this.phase, mode = p.mode, bb = u.def.skill.bb;
    const shot = { mode, attackId, targetSeq: e.deploySeq,
      penetration: mode === 2 ? bb.def_penetrate_fixed : 0,
      cachedAmount: mode === 3 ? u.s.atk * u.s.atkScaleMul * this.criticalScale(e) : null };
    p.born = true;
    if (mode === 2) {
      // Native immediateReach/no-follow splash samples this captured point at
      // the .1s stop boundary, independently of trace/source survival.
      const point = { x: e.x, y: e.y }, radius = bb['attack@projectile_range'];
      b.after(shots[1].root._lifeTime, () => {
        if (b.finished) return;
        for (const victim of [...b.enemies])
          if (this.legal(victim) && bodyInRadius(victim, point.x, point.y, radius)) this.impact(victim, shot);
      });
    } else {
      const source = mode === 3 ? shots[2] : shots[0];
      b.addProjectile({ from: u, source: u, target: e, speed: source.mover._speed,
        maxAge: source.root._lifeTime, visual: 'arrow', data: { arkpediaTrackedVisual: true },
        onHit: ({ target }) => { if (target?.deploySeq === shot.targetSeq) this.impact(target, shot); } });
    }
    return true;
  }
  canCast() {
    const u = this.u;
    return !this.stopped && !this.b.finished && live(u) && u.canAct && !u.s.flags.silence
      && !u.s.flags.noSp && !u.skill?.active && this.deck?.valid()
      && !['entrance', 'skill-begin', 'skill-end', 'attack-end'].includes(this.phase?.kind)
      && (this.skill !== 1 || this.deck.state.stock < this.record.stats.maxDeckStackCnt);
  }
  startSkill() {
    if (this.skill === 1) { this.deck.recharge(1); return; }
    this.mode = this.skill; this.chain = false; this.u.atkCd = 0;
    const clip = this.clip(this.mode, 'Begin'); this.visual(clip);
    this.phase = { kind: 'skill-begin', readyAt: this.b.time + model(this.u).durations[clip] };
  }
  endSkill() {
    if (this.skill === 1 || this.stopped || !live(this.u) || this.b.finished) return;
    this.deck.recharge(this.skill === 3 ? this.u.def.skill.bb.cnt : 1);
    this.mode = 0; this.chain = false; this.u.atkCd = 0;
    const clip = this.clip(this.skill, 'End'); this.visual(clip);
    this.b.addBuff(this.u, { key: 'ela:finish-sp', flags: { noSp: true } });
    this.phase = { kind: 'skill-end', readyAt: this.b.time + model(this.u).durations[clip] };
  }
  startLoop(p) {
    const clip = this.clip(p.mode, 'Loop'), m = model(this.u), events = m.eventPayloads[clip];
    if (events?.length !== 1 || events[0].name !== 'OnAttack') throw Error('Unreviewed Ela attack event');
    this.visual(clip, { speed: p.speed, loop: true });
    this.phase = { ...p, kind: 'attack', released: false, born: false,
      releaseAt: this.b.time + (p.mode ? 0 : events[0].time / p.speed),
      readyAt: this.b.time + Math.max(this.u.s.interval, m.durations[clip] / p.speed) };
    this.u.atkCd = this.u.s.interval;
  }
  startAttack() {
    const target = this.candidates()[0];
    if (!target) {
      if (this.chain && this.mode === 0) {
        const clip = this.clip(0, 'End'); this.visual(clip);
        this.phase = { kind: 'attack-end', readyAt: this.b.time + model(this.u).durations[clip] };
      }
      this.chain = false; return;
    }
    const p = { mode: this.mode, target, targetSeq: target.deploySeq, seq: this.u.deploySeq,
      controlEpoch: this.u.attackControlEpoch, speed: this.u.base.bat / this.u.s.interval };
    if (!this.chain && this.mode === 0) {
      const clip = this.clip(0, 'Begin'); this.visual(clip, { speed: p.speed });
      this.phase = { ...p, kind: 'attack-begin', readyAt: this.b.time + model(this.u).durations[clip] / p.speed };
    } else this.startLoop(p);
    this.chain = true;
  }
  tick() {
    const { b, u } = this;
    if (this.stopped) return;
    if (!live(u) || b.finished) { this.stop(); return; }
    let p = this.phase;
    if (['entrance', 'skill-begin', 'skill-end', 'attack-end'].includes(p?.kind)) {
      if (b.time + 1e-9 >= p.readyAt) {
        if (p.kind === 'skill-end') b.removeBuff(u, 'ela:finish-sp');
        this.phase = null; this.idle();
      }
      this.controlEpoch = u.attackControlEpoch; return;
    }
    if (!u.canAct || u.s.flags.disarm || this.controlEpoch !== u.attackControlEpoch) {
      this.controlEpoch = u.attackControlEpoch; this.phase = null; this.chain = false; this.idle(); return;
    }
    // noAttack disables the generic AI loop; the source AUTO supply skill
    // still casts at full SP without requiring an enemy.
    if (this.skill === 1 && u.skill.ready && this.canCast()) u.skill.activate('SP_FULL');
    if (p?.kind === 'attack-begin') {
      if (b.time + 1e-9 < p.readyAt) return;
      if (p.target.deploySeq !== p.targetSeq || !this.legal(p.target, true)
        || !bodyInKeys(p.target, u.rangeKeySet) && p.target.blockedBy !== u) {
        this.phase = null; this.chain = false; this.idle(); return;
      }
      this.startLoop(p); p = this.phase;
    }
    if (p?.kind === 'attack') {
      if (!p.released && b.time + 1e-9 >= p.releaseAt) {
        p.released = true;
        if (this.validInput(p.target)) b.forceAttack(u, [p.target]);
        // The last S3 birth ends the skill synchronously. Preserve its End
        // phase instead of overwriting it with this old loop's completion.
        if (this.phase !== p) return;
      }
      if (b.time + 1e-9 < p.readyAt) return;
      this.phase = null; this.idle();
    }
    if (!this.phase && u.atkCd <= 1e-9) this.startAttack();
  }
  enter() {
    if (this.stopped) return;
    this.mode = 0; this.chain = false; this.controlEpoch = this.u.attackControlEpoch;
    this.visual('Start'); this.phase = { kind: 'entrance', readyAt: this.b.time + model(this.u).durations.Start };
  }
  install() {
    if (this.handles.length || this.stopped) return;
    const { b, u } = this;
    this.deck = new ElaMineDeck(b, u, this.record.build);
    this.handles = [b.on('tick', () => this.tick(), { owner: u }),
      b.on('deploy', ({ unit }) => { if (unit === u) this.enter(); }, { owner: u }),
      b.on('death', ({ unit }) => { if (unit === u) this.stop(); }, { owner: u }),
      b.on('battleEnd', () => this.stop(), { owner: u })];
    if (live(u)) this.enter(); else this.idle();
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.chain = false; this.mode = 0;
    this.u.skill?.end('owner-finish'); this.b.removeBuff(this.u, 'ela:finish-sp');
    this.deck?.close(); this.u.mem.regularFormVisual = null;
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareElaKit(b, u, { contract } = {}) {
  if (u.def.charId !== ELA_ID) throw Error('Ela owner controller requires Ela source data');
  const build = u.def.raw.arkpedia, record = selectedElaMine(build), critical = selectedElaCritical(build);
  const s = u.def.skill, selected = evidence.tables.skills[build.skillId].levels[build.skillRank - 1];
  const grids = id => id ? evidence.tables.ranges[id].grids.map(p => [p.row, p.col]) : [];
  if (!s || s.id !== build.skillId || s.spType !== (record.index === 1 ? 'attack' : 'time')
    || s.skillType !== selected.skillType || s.spCost !== selected.spData.spCost
    || s.initSp !== selected.spData.initSp || s.maxCharges !== selected.spData.maxChargeTime
    || s.duration !== selected.duration || Object.keys(s.bb).length !== selected.blackboard.length
    || Object.entries(flat(selected.blackboard)).some(([k, v]) => s.bb[k] !== v)
    || !same(s.rangeGrid, grids(selected.rangeId))
    || !same(u.rangeGrid, grids(evidence.tables.character.phases[build.elite].rangeId)))
    throw Error('Incomplete Ela selected source skill/build');
  const controller = new ElaOwnerController(b, u, record, critical, contract), n = record.index + 1;
  const kit = {
    trait: { noAttack: true, attackDrivenSkill: true, attack: 'ranged', dmgType: 'phys',
      canHitFly: true, projectile: 'arrow', maxTargets: 1, hits: 1, attackVisual: 'none',
      requiresAcceptedLaunch: true, acceptAttackInput: e => controller.validInput(e),
      launchAttack: (_b, _u, _p, e, info) => controller.fire(e, info) },
    skill: { id: s.id, name: s.name, kind: n === 1 ? 'instant' : n === 2 ? 'duration' : 'ammo',
      duration: s.duration, ammo: n === 3 ? s.bb['attack@trigger_time'] : 0,
      manualCancel: n === 3, canActivate: () => controller.canCast(), trigger: { rule: 'NEVER' },
      ...(n > 1 ? { attack: {}, mods: n === 2 ? { defPct: s.bb.def }
        : { atkPct: s.bb.atk, batFlat: s.bb.base_attack_time } } : {}),
      ...(n === 2 ? { targeting: { rangeGrid: s.rangeGrid } } : {}),
      onStart: () => controller.startSkill(), onEnd: () => controller.endSkill() },
  };
  return { kit, controller, record, critical };
}
