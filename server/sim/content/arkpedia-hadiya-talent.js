// SPDX-License-Identifier: GPL-3.0-or-later
import {HADIYA_ID, selectedHadiyaInputs, hadiyaTalentInputs} from './arkpedia-hadiya-source.js';
import {absoluteRangeKeys, canTargetEnemy} from '../targeting.js';
import {bodyInKeys} from '../body.js';

export const HADIYA_TALENT_CONTRACT = Object.freeze({
  scope: 'Held selected Hadiya deployment/authorized-trigger ATK stacks and ground stun; no complete skill owner or public admission.',
  mapping: 'Born is dispatched once on the accepted deployment, independently of deployment DP bookkeeping. A live original talent parent owns its ATK stack; selected talent blackboard supplies additive ATK and cap. Explicit owner-authorized trigger receipts are claimed once before output. S2 trigger branches use mode-two displayed range even before a skill mode switch; Born and other branches use the current displayed range. Stat-buff rejection or stack cap does not cancel the separate stun action. Stun respects shared immunity/resistance and remains after its nonderived source parent finishes. Hiding, departure, replacement and source removal cancel unborn work; cleanup preserves foreign buffs.',
  limits: 'Deployment versus native Born frame, blackboard cap binding over template maxStackCnt=1, purposeMask NONE target legality, current displayed-range extension and same-tick callbacks are explicit local mappings. Sleep/stealth/target-free use existing shared legality, camouflage is not an attack-purpose filter. No guessed global DP-spend listener, compiled event enum parity, skill adaptation owner, native VFX, modules or public admission.',
  frameParity: false,
});
const present = u => u?.alive && u.deployed && !u.hidden && !u.removed && !u._removing;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function verifyHadiyaTalent(n = hadiyaTalentInputs()) {
  const p = n.producer._buffs[0], events = n.template.eventToActions;
  if (p.buffKey !== 'hadiya_t_1' || p.templateKey !== 'hadiya_t_1' || p.lifeTimeType !== 2
    || p.isSilenceable !== 0 || p.isStunnable !== 0 || p.isDamageMissable !== 0
    || n.binding._applyTalentRange !== 0 || n.binding._checkValidBySkillIndex.length
    || !same(events.ON_BUFF_TRIGGER, events.ON_SKILL_RETRIGGERED)
    || n.stun.durationKey !== 'stun' || n.stun.statusResistable !== 'AUTOMATIC')
    throw Error('Changed original Hadiya talent parent/trigger');
  for (const name of ['ON_OWNER_BORN', 'ON_BUFF_TRIGGER', 'ON_SKILL_RETRIGGERED']) {
    const actions = events[name], stack = actions[0], buff = stack._buff;
    if (actions.length !== 2 || stack._buffOwner !== 'BUFF_OWNER' || !stack._isDerivedBuff
      || !stack._finishDerivedBuffIfParentFinish || buff.buffKey !== 'hadiya_t_1[atk]'
      || buff.overrideType !== 'STACK' || buff.maxStackCnt !== 1 || buff.lifeTimeType !== 'INFINITY'
      || !same(buff.attributes.attributeModifiers, [{attributeType: 'ATK', formulaItem: 'MULTIPLIER',
        value: 0, loadFromBlackboard: true, fetchBaseValueFromSourceEntity: false}]))
      throw Error('Changed original Hadiya talent stack');
    const branch = actions[1];
    const ranges = name === 'ON_OWNER_BORN' ? [branch] : [...branch._succeedNodes, ...branch._failNodes];
    if (name !== 'ON_OWNER_BORN' && branch._conditionNode._skillIndex !== 1)
      throw Error('Changed original Hadiya talent skill branch');
    for (const [i, r] of ranges.entries()) {
      const o = r._targetOptions, stun = r._buffs[0];
      if (r._rangeModeIndex !== (name !== 'ON_OWNER_BORN' && i === 0 ? 2 : -1)
        || !r._useRangeToShow || r._useAttackRange || r._useCurrentModeRange || r._useRadius
        || r._limitMaxTarget || r._excludeTarget || r._alwaysIncludeSourceBlocker
        || r._isDerivedBuff || r._finishDerivedBuffIfParentFinish || r._buffs.length !== 1
        || o.targetSide !== 'ENEMY' || o.targetMotion !== 'WALK_ONLY' || o.purposeMask !== 'NONE'
        || o.ignoreTargetFree || o.ignoreMotionMode || o.ignoreTargetSide
        || stun.buffKey !== 'stun' || !stun.loadFromDB || stun.isDamageMissable)
        throw Error('Changed original Hadiya talent range/stun');
    }
  }
}

export class HadiyaTalent {
  constructor(b, u, {contract, ownsTrigger} = {}) {
    if (contract !== HADIYA_TALENT_CONTRACT || u.def.charId !== HADIYA_ID
      || u.deploySeq !== 0 || typeof ownsTrigger !== 'function')
      throw Error('Fresh selected Hadiya, explicit trigger owner and exact talent contract required');
    verifyHadiyaTalent();
    this.record = selectedHadiyaInputs(u);
    this.bb = this.record.talentBb[0];
    Object.assign(this, {b, u, ownsTrigger, seq: null, stopped: false, installed: false,
      busy: false, bornClaimed: false, parent: null, stack: null, handles: []});
    this.claimed = new WeakSet();
  }

  lifeValid() {
    return !this.stopped && !this.b.finished && present(this.u)
      && this.u.deploySeq === this.seq && this.b.unitById(this.u.id) === this.u
      && this.u.mem.hadiyaTalent === this;
  }
  valid() {
    if (!this.lifeValid()) return false;
    // Shared replace semantics intentionally omit the displaced onRemove.
    // Observe identity loss without clearing the foreign replacement.
    if (this.parent && this.u.findBuff(this.parent.key) !== this.parent) this.removeParent();
    return !!this.parent;
  }

  install() {
    if (this.installed || this.stopped || this.u.mem.hadiyaTalent)
      throw Error('Hadiya talent cannot be reinstalled');
    const {b, u} = this;
    this.installed = true;
    u.mem.hadiyaTalent = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => {
        if (unit !== u || move) return;
        if (this.seq != null) { if (this.seq !== u.deploySeq) this.stop(); return; }
        this.seq = u.deploySeq;
        this.born();
      }, {owner: u}),
      b.on('tick', () => {
        if (this.seq == null) return;
        if (!this.lifeValid()) this.stop();
        else this.valid();
      }, {owner: u}),
      b.on('removed', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }

  born() {
    if (!this.bb || !this.lifeValid() || this.busy || this.bornClaimed) return false;
    this.bornClaimed = true;
    this.busy = true;
    try {
      const key = `hadiya:talent:${this.u.id}:${this.seq}`;
      const parent = this.b.addBuff(this.u, {key, source: this.u,
        duration: Infinity, data: {hadiyaTalent: this, nativeKey: 'hadiya_t_1'},
        admit: () => this.lifeValid() && this.parent == null && !this.u.findBuff(key),
        onRemove: ({buff}) => { if (this.parent === buff) this.removeParent(); }});
      if (!parent) return false;
      if (!this.lifeValid()) { this.b.removeBuff(this.u, parent); return false; }
      this.parent = parent;
      return this.apply(true);
    } finally { this.busy = false; }
  }

  trigger(receipt, event) {
    if (this.busy || !this.valid() || !receipt || typeof receipt !== 'object'
      || !['ON_BUFF_TRIGGER', 'ON_SKILL_RETRIGGERED'].includes(event) || this.claimed.has(receipt)) return false;
    this.busy = true;
    try {
      if (this.ownsTrigger(receipt, event) !== true || !this.valid()) return false;
      this.claimed.add(receipt);
      return this.apply(false);
    } finally { this.busy = false; }
  }

  apply(born) {
    if (!this.valid()) return false;
    const {b, u, bb} = this, key = `hadiya:talent-atk:${u.id}:${this.seq}`;
    const existing = u.findBuff(key);
    if ((!existing || existing === this.stack) && (!existing || existing.stacks < bb.max_stack_cnt)) {
      const stack = b.addBuff(u, {key, source: u, duration: Infinity, refresh: 'stack',
        maxStacks: bb.max_stack_cnt, mods: {atkPct: bb.atk},
        data: {hadiyaTalent: this, nativeKey: 'hadiya_t_1[atk]'},
        admit: () => this.valid() && u.findBuff(key) === existing,
        onRemove: ({buff}) => { if (this.stack === buff) this.stack = null; }});
      if (stack) {
        if (!this.valid()) { b.removeBuff(u, stack); return false; }
        this.stack = stack;
      }
    }
    if (!this.valid()) return false;
    let keys;
    if (!born && this.record.index === 1) {
      keys = new Set(absoluteRangeKeys(this.record.skillRangeGrid, u.tileR, u.tileC, u.dir));
    } else {
      if (b.rangeChanged(u)) b._refreshRange(u);
      keys = new Set(u.rangeKeySet);
    }
    const legal = t => present(t) && t.side === 'enemy' && b.unitById(t.id) === t
      && canTargetEnemy(u, t, {groundOnly: true, canHitFly: false}) && bodyInKeys(t, keys);
    const targets = b.enemies.filter(legal).map(t => ({t, life: t.deploySeq}));
    for (const {t, life} of targets) {
      if (!this.valid()) break;
      b.applyStatus(t, 'stun', {duration: bb.stun, source: u,
        sourceStatusResistable: true, key: `hadiya:talent-stun:${u.id}:${this.seq}`,
        admit: () => this.valid() && t.deploySeq === life && legal(t)});
    }
    return true;
  }

  removeParent() {
    this.parent = null;
    const stack = this.stack;
    this.stack = null;
    if (stack) this.b.removeBuff(this.u, stack);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    for (const h of this.handles) this.b.off(h);
    this.handles = [];
    const parent = this.parent;
    this.removeParent();
    if (parent) this.b.removeBuff(this.u, parent);
    if (this.u.mem.hadiyaTalent === this) delete this.u.mem.hadiyaTalent;
  }
}
