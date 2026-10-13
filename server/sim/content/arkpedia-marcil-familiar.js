// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit selected S2 diagnostic. Complete public kit remains held.
import evidence from '../../../data/arkpedia-marcil-prefabs.json' with { type: 'json' };
import { MARCIL_ID, marcilSourceComponent as component } from './arkpedia-marcil-source.js';
import { MARCIL_MANA_CONTRACT, prepareMarcilMana } from './arkpedia-marcil-mana.js';
import { MarcilAttackController, bindMarcilCombat, verifyMarcilAttackSource } from './arkpedia-marcil-attacks.js';
import { absoluteRangeKeys } from '../targeting.js';
import { makeDamageInfo } from '../damage.js';

export const MARCIL_FAMILIAR_CONTRACT = Object.freeze({
  scope: 'Selected S2 automatic chanting, first familiar, one cancel, upgraded familiar and original projectile diagnostic',
  cast: 'The selected table is AUTO. This diagnostic requests its free native cast after deployment when the wallet reaches skill_cost_min_sp. It debits that amount once after Begin/main/End successful chanting. The retained enhancement mark is owner-local: first successful enable establishes it, the next successful enable upgrades. Only the first running familiar may be manually deactivated.',
  attack: 'One selected ground/flying target. Original A/B loop event, captured maxAnimScale-one clock, source speed-ten ten-second projectile, cached ATK at launch, original mana-dependent 1.1/1.5 circle. All legal impact victims receive selected Slow; upgraded main input also receives selected Stun. No per-shot mana debit. Born projectiles keep their cached same-life data after owner retirement or cancellation.',
  control: 'Control interrupts a main chant. A running familiar retains its skill/modifiers through control, but an unfired attack is discarded on the control epoch. Automatic chanting waits for the shared deployment gate and selected minimum mana. Birth, callback retirement, hidden/life-changed inputs and battle finish are guarded.',
  limits: 'Automatic threshold polling, transition-frame inclusion, late-enable phase, retained input/area geometry, projectile expiry/target loss and same-frame dispatch are explicit local policies. Born-shot retention is not compiled certification: the ability has notClearProjectileWhenCastEnd zero despite source-managed false and stopWhenSourceInvalid false, and its cast-end clearing dispatch remains unresolved. Dynamic SP-cost modifiers, native particles/audio, modules and Unity frame parity are unverified. S3, party/terrain and public registration remain held.',
  frameParity: false,
});
const BUFF = 'marcil:s2';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const due = (b, t) => b.time + 1e-9 >= t;
const tier2Range = evidence.tables.ranges['3-3'].grids.map(g => [g.row, g.col]);
const sourcePairs = [
  { tier: 1, power: false, ability: '-4708622414451033109', key: 'projectile_chr_marcil_s2_1' },
  { tier: 1, power: true, ability: '-6527443115049075733', key: 'projectile_chr_marcil_s2_1_power' },
  { tier: 2, power: false, ability: '2055833074212027371', key: 'projectile_chr_marcil_s2_2' },
  { tier: 2, power: true, ability: '5132956933207505899', key: 'projectile_chr_marcil_s2_2_power' },
];
function projectileSource(key) {
  const components = evidence.projectiles[key].flatMap(r => r.components.map(c => c.data));
  return { mover: components.find(c => c._speed != null), root: components.find(c => c._lifeTime != null),
    circle: components.find(c => c.m_Radius != null) };
}
export function verifyMarcilFamiliarSource() {
  verifyMarcilAttackSource();
  const root = component('2321002891159124941'), chant = component('-3189074972744565811');
  if (root._canCastWithNoSp !== 1 || root._canSilenced !== 0 || root._canCastDuringBorn !== 1
    || root._suspendableLimitedTimes !== 1 || chant._suspendableWhenMainChant !== 0
    || component('5556964505251101675')._rangeId !== '3-3'
    || component('6588392524401687531')._rangeId !== '3-3') throw Error('Unreviewed Marcille S2 cast/range');
  for (const { ability, key, power, tier } of sourcePairs) {
    const a = component(ability), p = projectileSource(key);
    if (a._projectileKey !== key || a._waitForAttackEvent !== 1 || a._selectTargetTiming !== 0
      || a._damageType !== 2 || a._maxAnimScale !== 1 || a._useCachedAtkOnly !== 1
      || a._waitForProjectileInvalid !== 0 || a._notClearProjectileWhenCastEnd !== 0
      || a._interruptAbilityOnDetach !== 1 || p.mover._speed !== 10 || p.root._lifeTime !== 10
      || p.root._stopWhenSourceInvalid !== 0 || p.root._managedBySource !== 0
      || a._activeBuffs.length !== 1 || a._activeBuffs[0].buffKey !== 'sluggish'
      || p.root._actionController._onlyAddBuffsToTraceTarget !== 0
      || p.root._actionController._extraBuffsInTheEnd.length !== (tier === 2 ? 1 : 0)
      || tier === 2 && (p.root._actionController._extraBuffsInTheEnd[0].buffKey !== 'stun'
        || p.root._actionController._addExtraBuffsWhenReached !== 1)
      || p.circle.m_Radius !== (power ? 1.5 : 1.100000023841858)) throw Error('Unreviewed Marcille S2 projectile');
  }
  for (const m of [evidence.models[MARCIL_ID].Front, evidence.models[MARCIL_ID].Back])
    for (const tier of ['A', 'B']) {
      const clip = `Skill_2_Loop_${tier}`;
      if (m.durations[clip] !== 2 || m.eventPayloads[clip].length !== 1
        || m.eventPayloads[clip][0].name !== 'OnAttack' || m.eventPayloads[clip][0].time !== .4333333373069763)
        throw Error('Unreviewed Marcille familiar attack clock');
    }
}

export class MarcilFamiliarController extends MarcilAttackController {
  constructor(...args) {
    super(...args); this.enhancement = false; this.tier = 0; this.flights = new Set();
  }
  canActivate() { return this.canBegin(); }
  canCancel() { return this.valid() && this.mode === 's2' && this.tier === 1
    && this.u.skill.active && this.u.canAct && !this.u.s.flags.disarm; }
  visual(clip, speed = 1, loop = false) {
    if (clip === 'Idle' && this.mode === 's2') clip = `Skill_2_Idle_${this.tier === 2 ? 'B' : 'A'}`;
    super.visual(clip, speed, loop);
    if (this.mode === 's2' && this.u.mem.regularFormVisual.idle)
      this.u.mem.regularFormVisual.idle = `Skill_2_Idle_${this.tier === 2 ? 'B' : 'A'}`;
  }
  keys() { return this.mode === 's2' && this.tier === 2
    ? new Set(absoluteRangeKeys(tier2Range, this.u.tileR, this.u.tileC, this.u.dir)) : super.keys(); }
  start() {
    const suffix = this.enhancement ? 'B' : 'A';
    this.phase = { kind: 'chant', stage: 'begin', epoch: this.u.attackControlEpoch,
      nextCheck: this.b.time + .5, deadline: this.b.time + this.model().durations[`Skill_2_Begin_${suffix}`],
      loopClip: 'Skill_2_Chant', endClip: `Skill_2_End_${suffix}` };
    this.mode = 'chant'; this.visual(`Skill_2_Begin_${suffix}`);
  }
  finishChant() {
    if (!this.mana.controller.consume(this.record.bb.skill_cost_min_sp)) { this.u.skill.end('insufficient-mana'); return; }
    if (!this.valid() || !this.u.skill.active || this.mode !== 'chant') return;
    this.tier = this.enhancement ? 2 : 1; this.enhancement = true;
    this.phase = null; this.mode = 's2';
    const buff = this.b.addBuff(this.u, { key: BUFF, source: this.u,
      mods: { atkPct: this.record.bb.atk, ...(this.tier === 2 ? { aspd: this.record.bb.attack_speed } : {}) } });
    if (!this.valid() || !this.u.skill.active || this.mode !== 's2') {
      if (buff) this.b.removeBuff(this.u, buff); return;
    }
    this.u.skill.spec.targeting = { rangeGrid: this.tier === 2 ? tier2Range : this.record.rangeGrid, noRangeExtend: true };
    this.b.refreshRange(this.u);
    this.visual('Idle', 1, true);
    this.b.emit('marcilFamiliarEnabled', { unit: this.u, tier: this.tier, mana: this.wallet.value });
  }
  end(reason) {
    this.b.removeBuff(this.u, BUFF); delete this.u.skill.spec.targeting;
    this.b.refreshRange(this.u); super.end(reason);
  }
  beginAttack(target, heal = false) {
    if (this.mode !== 's2') { super.beginAttack(target, heal); return; }
    const u = this.u, m = this.model(), speed = Math.min(1, u.base.bat / u.s.interval);
    const clip = `Skill_2_Loop_${this.tier === 2 ? 'B' : 'A'}`;
    this.phase = { kind: 'attack', target, targetSeq: target.deploySeq, epoch: u.attackControlEpoch,
      skill: true, heal: false, tier: this.tier, power: this.wallet.value >= this.record.talentBb[0].sp,
      startedAt: this.b.time, speed, accepted: false, released: false,
      releaseAt: this.b.time + m.eventPayloads[clip][0].time / speed,
      readyAt: this.b.time + Math.max(u.s.interval, m.durations[clip] / speed) };
    this.visual(clip, speed); u.atkCd = u.s.interval;
  }
  output(target, info) {
    const p = this.phase;
    if (this.mode !== 's2') return super.output(target, info);
    if (!this.accepting || !this.valid() || !this.u.canAct || this.u.s.flags.disarm || p?.kind !== 'attack'
      || p.accepted || p.target !== target || !live(target) || p.targetSeq !== target.deploySeq
      || p.epoch !== this.u.attackControlEpoch || !due(this.b, p.releaseAt)) return false;
    const source = sourcePairs.find(s => s.tier === p.tier && s.power === p.power), native = projectileSource(source.key);
    const flight = { amount: this.u.s.atk * this.u.s.atkScaleMul, main: target, targetSeq: target.deploySeq,
      radius: native.circle.m_Radius, tier: p.tier, attackId: info.attackId, key: source.key };
    flight.projectile = this.b.addProjectile({ from: this.u, target, source: this.u,
      speed: native.mover._speed, maxAge: native.root._lifeTime, hitDead: true, visual: 'orb',
      data: { arkpediaTrackedVisual: true, projectileKey: source.key },
      onHit: ctx => this.impact(flight, ctx) });
    this.flights.add(flight); p.accepted = true;
    this.b.emit('marcilFamiliarProjectile', { unit: this.u, flight }); return true;
  }
  impact(f, { x, y }) {
    this.flights.delete(f);
    if (this.b.finished || this.b._endReq) return;
    const victims = this.b.foesInRadius(x, y, f.radius).filter(t => live(t) && !t.s.flags.sleep);
    for (const t of victims) {
      if (this.b.finished || this.b._endReq) return;
      this.b.dealDamage(this.u, t, makeDamageInfo({ amount: f.amount, type: 'arts', isAttack: true,
        isSkill: true, isSplash: true, applyWay: 'ranged', attackId: f.attackId, tags: ['marcil:s2'] }));
      if (this.b.finished || this.b._endReq) return;
      if (live(t)) this.b.applyStatus(t, 'sluggish', { source: this.u, duration: this.record.bb['attack@sluggish'] });
    }
    if (f.tier === 2 && live(f.main) && f.main.deploySeq === f.targetSeq && victims.includes(f.main))
      this.b.applyStatus(f.main, 'stun', { source: this.u, duration: this.record.bb['attack@stun'] });
    this.b.emit('marcilFamiliarImpact', { unit: this.u, flight: f, victims });
  }
  tick() {
    for (const f of this.flights) if (f.projectile.removed || !this.b.projectiles.list.includes(f.projectile)) this.flights.delete(f);
    if (this.mode === 's2' && this.valid() && (!this.u.canAct || this.u.s.flags.disarm
      || this.phase && this.phase.epoch !== this.u.attackControlEpoch)) {
      this.phase = null; this.visual('Idle', 1, true); return;
    }
    if (this.canActivate()) this.u.skill.activate('auto');
    super.tick();
  }
  stop(reason) {
    super.stop(reason);
    // Diagnostic retention policy: unmanaged projectiles do not consult a
    // redeployed owner. Native ability cast-end clearing remains unresolved.
    this.flights.clear(); this.enhancement = false;
    delete this.u.skill.spec.targeting;
    this.b.removeBuff(this.u, BUFF);
  }
}

export function prepareMarcilFamiliar(b, u, { contract } = {}) {
  if (contract !== MARCIL_FAMILIAR_CONTRACT) throw Error('Marcille S2 requires her explicit familiar contract');
  if (u.def.skill?.id !== 'skchr_marcil_2') throw Error('Marcille familiar requires selected S2');
  verifyMarcilFamiliarSource();
  const mana = prepareMarcilMana(b, u, { contract: MARCIL_MANA_CONTRACT });
  if (mana.record.index !== 1) throw Error('Marcille familiar requires selected S2');
  const controller = new MarcilFamiliarController(b, u, mana.record, mana); u.mem.marcilAttacks = controller;
  const prepared = bindMarcilCombat(mana, controller);
  prepared.kit.skill.resourceGauge = () => controller.valid()
    ? { current: mana.wallet.value, maximum: mana.record.mana.maximum, label: 'Mana',
      canActivate: false, canCancel: controller.canCancel() } : null;
  return prepared;
}
