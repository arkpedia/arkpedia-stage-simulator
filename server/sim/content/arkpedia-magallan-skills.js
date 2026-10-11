// SPDX-License-Identifier: GPL-3.0-or-later
import { bodyInKeys } from '../body.js';
import { areaSelectable } from '../targeting.js';
import { MAGALLAN_ID, prepareMagallanCore, MAGALLAN_CORE_CONTRACT, magallanSourceComponent as comp } from './arkpedia-magallan.js';

export const MAGALLAN_SKILL_CONTRACT = Object.freeze({
  scope: 'Selected-source S1 passive/active pulses, S2 owner/drone ASPD and direct area attacks, S3 owner/drone ATK and enlarged arrival splash; public approval is separately source/artwork-bound',
  mapping: 'Source time SP and fifteen-second manual duration, silence permission, mode changes without FSM restart; owner-driven delayed interval pulses propagate immediate token range actions. Slow uses -80% movement, Bind uses UNMOVABLE and rank duration. Existing and newly deployed drones receive the active modifier. Natural/manual skill finish returns surviving drones through ordered recycle; removal kills them without card recovery.',
  limits: 'Compiled trigger clock/first pulse, duration key prefixing, mode detachment/release ordering, selector postFilter4 and collision-group dispatch are explicit local mappings, not certified Unity frame parity. Modules, native default drone textures, shaders, particles/audio and public browser integration still require review.',
  frameParity: false,
});

const due = (b, time) => b.time + 1e-9 >= time;
const present = u => u?.alive && u.deployed && !u._removing;

function verifySkills() {
  for (const id of ['-7517917715348533091', '8642975028533401869', '8571353450288844490']) {
    const s = comp(id);
    if (s._canSilenced !== 0 || s._allowSpRecoveryWhenAffecting !== 0 || s._playSkillBeginAnim !== 0)
      throw Error('Unreviewed Magallan skill holder');
  }
  for (const [id, attr, formula, mode] of [['6739444615076452621', 7, 0, 3], ['1633772105727872714', 1, 1, 4]]) {
    const ability = comp(id);
    for (const v of [...ability._buffs, ...ability._passiveBuffs]) {
      const m = v.attributes.attributeModifiers;
      if (v.templateKey !== 'switch_mode' || m.length !== 1 || m[0].attributeType !== attr
        || m[0].formulaItem !== formula || m[0].loadFromBlackboard !== 1 || v.isSilenceable !== 0)
        throw Error('Unreviewed Magallan mode modifier');
    }
    if (ability._passiveBuffs[0].blackboard[0].value !== mode || ability._onlyDetactTargetWhenStarted !== 0)
      throw Error('Unreviewed Magallan mode propagation');
  }
  if (comp('1441197292955717818')._waitForAttackEvent !== 1
    || comp('1441197292955717818')._maxAnimScale !== -1
    || comp('-2559454158479470406')._limitTargetNum !== 0
    || comp('-2559454158479470406')._targetMotion !== 3
    || comp('5620763496570893951').m_Radius !== 1.25)
    throw Error('Unreviewed Magallan active attacks');
}

export class MagallanSkills {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record;
    this.key = `mgllan:mode:${this.u.id}`; this.nextPulse = Infinity;
  }
  get active() { return this.core.valid() && !!this.u.skill.active; }
  get mods() { return this.record.index === 1 ? { aspd: this.record.bb.attack_speed }
    : this.record.index === 2 ? { atkPct: this.record.bb.atk } : null; }
  get interval() { return this.record.bb['attack@interval']; }
  born() { if (this.record.index === 0) this.nextPulse = this.b.time + this.interval; }
  canCast() { return this.core.valid() && !this.u.hidden && this.u.canAct && !this.u.s.flags.disarm; }
  syncToken(t) {
    if (!present(t) || t.ownerUnit !== this.u) return;
    if (this.active && this.mods) {
      if (!t.findBuff(this.key)) this.b.addBuff(t, { key: this.key, source: this.u, mods: this.mods });
    } else this.b.removeBuff(t, this.key);
  }
  start() {
    if (this.record.index === 0) this.nextPulse = this.b.time + this.interval;
    for (const t of this.core.deck.own()) this.syncToken(t);
  }
  end(reason) {
    for (const t of this.core.deck.own()) this.b.removeBuff(t, this.key);
    if (this.record.index === 0) this.nextPulse = this.b.time + this.interval;
    if (this.core.valid() && reason !== 'death' && reason !== 'withdrawn') this.core.deck.recycleOwned();
  }
  pulse() {
    const active = this.active, status = active ? 'bind' : 'sluggish';
    const duration = this.record.bb[active ? 'attack@frozen_duration' : 'attack@sluggish'];
    // The native token's immediate buff invokes its range action at finish;
    // its empty passive template does not create a second independent clock.
    for (const source of [this.u, ...this.core.deck.own()]) {
      if (!this.core.valid()) break;
      if (!present(source) || source.hidden) continue;
      const victims = this.b.enemies.filter(t => areaSelectable(source, t) && bodyInKeys(t, source.rangeKeySet));
      for (const t of victims) {
        if (!this.core.valid() || !present(source)) break;
        this.b.applyStatus(t, status, { source, duration });
      }
      this.b.emit('magallanPulse', { owner: this.u, source, active, status, duration, victims });
    }
  }
  tick() {
    if (!this.core.valid()) return;
    if (this.record.index === 0) {
      if (this.u.hidden) { this.nextPulse = this.b.time + this.interval; return; }
      if (due(this.b, this.nextPulse)) { this.nextPulse = this.b.time + this.interval; this.pulse(); }
    } else for (const t of this.core.deck.own()) this.syncToken(t);
  }
  stop() {
    this.nextPulse = Infinity;
    for (const t of this.core.deck.own()) this.b.removeBuff(t, this.key);
  }
}

export function prepareMagallanSkills(b, u, { contract } = {}) {
  if (contract !== MAGALLAN_SKILL_CONTRACT) throw Error('Magallan requires the reviewed skill contract');
  verifySkills();
  const prepared = prepareMagallanCore(b, u, { contract: MAGALLAN_CORE_CONTRACT });
  const bridge = new MagallanSkills(prepared.controller); prepared.controller.skills = bridge;
  return { ...prepared, skills: bridge, kit: { ...prepared.kit, skill: {
    kind: 'duration', duration: prepared.record.source.duration, trigger: { rule: 'NEVER' },
    silenceable: false, mods: bridge.mods, canActivate: () => bridge.canCast(),
    onStart: () => bridge.start(), onEnd: ({ reason }) => bridge.end(reason),
  } } };
}

// Public selected-kit adapter. The historical extraction receipt stays held;
// runtime approval is separately bound to it and the default-drone artwork.
export function customizeMagallanKit({ battle, id, unit, kit }) {
  if (id !== MAGALLAN_ID) return;
  const prepared = prepareMagallanSkills(battle, unit, { contract: MAGALLAN_SKILL_CONTRACT });
  // Shared summon inspection reads the selected owner's build from its record.
  // This display context does not transfer trust or potential stats to drones.
  prepared.record.token.arkpedia = { ...unit.def.raw.arkpedia };
  Object.assign(kit, prepared.kit);
}
export function installMagallan({ unit }) { unit.mem.magallanController?.install(); }
