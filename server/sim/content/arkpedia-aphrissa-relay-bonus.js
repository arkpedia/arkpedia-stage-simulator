// SPDX-License-Identifier: GPL-3.0-or-later
// Held related-relay aura; the owner supplies its explicit relation adapter.
import {APHRISSA_ID as ID, APHRISSA_RELAY_ID as TOKEN, selectedAphrissaInputs,
  aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';

export const APHRISSA_RELAY_BONUS_CONTRACT = Object.freeze({
  scope: 'Selected relay-presence talent parent and derived owner ATK modifier; no relation decoding or public admission.',
  mapping: 'An explicit owner adapter supplies related relay entities. Original live friendly relay lives receive separate aura parents. At most one common derived owner ATK child is active, using the selected talent value; local arbitration binds it to the earliest related deployment/stable ID and falls back when that parent leaves. E0 has no invented ATK coefficient. Exact parent/child instances remain owned through dispel, retirement, replacement and callbacks; foreign replacements are preserved.',
  limits: 'The custom relationship validator retains isTargetEnemy0/isOwnerEnemy0/checkIsSameHost0, but its compiled meaning is unrecovered. This component does not equate it with the ray ID-only filter or infer a same-owner rule. Related-set selection, first-parent arbitration and world-tick re-admission are explicit local policies. Skills, RES aura, native particles/audio, modules and public admission are separate gates.',
  frameParity: false,
});
const PARENT = 'aphris_token_add_atk_tohost', CHILD = 'aphris_t1[atk]';
const present = unit => unit?.alive && unit.deployed && !unit.removed && !unit._removing;

export function prepareAphrissaRelayBonus(b, u, {contract, relatedRelays} = {}) {
  if (contract !== APHRISSA_RELAY_BONUS_CONTRACT || typeof relatedRelays !== 'function'
    || u.def.charId !== ID || u.deploySeq !== 0 || u.mem.aphrissaRelayBonus)
    throw Error('Fresh selected Aphrissa, exact relay bonus contract and explicit related-relay adapter required');
  const selected = selectedAphrissaInputs(u), n = aphrissaNativeInputs(), relation = n.relayRelationValidator;
  const parent = n.relayTalent._buffs[0], create = n.templates[PARENT].eventToActions.ON_BUFF_START[0], child = create._buff;
  if (n.relayTalent._removeBuffWhenAbilityDetached !== 1 || parent.buffKey !== PARENT
    || parent.templateKey !== PARENT || parent.isSilenceable !== 0 || parent.isStunnable !== 0
    || relation._isTargetEnemy !== 0 || relation._isOwnerEnemy !== 0 || relation._checkIsSameHost !== 0
    || create._buffOwner !== 'BUFF_SOURCE' || create._isDerivedBuff !== true
    || create._finishDerivedBuffIfParentFinish !== true || child.buffKey !== CHILD
    || child.lifeTimeType !== 'INFINITY' || child.maxStackCnt !== 1 || child.independentCharacterSource !== false
    || child.attributes.attributeModifiers[0].attributeType !== 'ATK'
    || child.attributes.attributeModifiers[0].formulaItem !== 'MULTIPLIER')
    throw Error('Changed original Aphrissa relay bonus graph');
  const controller = new RelayBonus(b, u, selected, relatedRelays);
  u.mem.aphrissaRelayBonus = controller;
  return controller;
}

class RelayBonus {
  constructor(b, u, selected, relatedRelays) {
    Object.assign(this, {b, u, selected, relatedRelays, seq: null, stopped: false,
      busy: false, members: new Map(), active: null, child: null, handles: []});
    this.power = selected.talentBb.find(bb => 'cnt' in bb)?.atk ?? 0;
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && !this.u.hidden
    && this.seq === this.u.deploySeq && this.u.mem.aphrissaRelayBonus === this; }
  related() {
    if (!this.valid()) return [];
    let units;
    try { units = this.relatedRelays(); }
    catch (error) { this.clear(); throw error; }
    if (!Array.isArray(units)) { this.clear(); throw Error('Related relay adapter must return original entities'); }
    return this.valid() ? [...new Set(units)].filter(t => present(t) && !t.hidden && t.side === this.u.side && t.defId === TOKEN)
      .sort((a, z) => a.deploySeq - z.deploySeq || a.id.localeCompare(z.id)) : [];
  }
  ownsParent(record) { return record.target.findBuff(PARENT) === record.parent
    && record.parent?.source === this.u && record.parent.data?.aphrissaRelayParent === record; }
  removeChild() {
    const child = this.child; this.child = null; this.active = null;
    if (child && this.u.findBuff(CHILD) === child && child.source === this.u
      && child.data?.aphrissaRelayBonus === this) this.b.removeBuff(this.u, child);
  }
  remove(record) {
    if (record.finished) return;
    record.finished = true;
    if (this.members.get(record.target) === record) this.members.delete(record.target);
    if (this.active === record) this.removeChild();
    if (this.ownsParent(record)) this.b.removeBuff(record.target, record.parent);
  }
  clear() { this.removeChild(); for (const record of [...this.members.values()]) this.remove(record); }
  attach(target) {
    if (!this.valid() || this.members.has(target) || target.findBuff(PARENT)) return;
    const record = {target, life: target.deploySeq, parent: null, finished: false};
    this.members.set(target, record);
    const permit = (unit, buff) => unit === target && this.valid() && !record.finished
      && this.members.get(target) === record && target.deploySeq === record.life
      && this.related().includes(target) && !target.findBuff(PARENT)
      && buff.key === PARENT && buff.source === this.u && buff.data?.aphrissaRelayParent === record
      && buff.duration === Infinity && Object.keys(buff.mods ?? {}).length === 0 && Object.keys(buff.flags ?? {}).length === 0;
    record.parent = this.b.addBuff(target, {key: PARENT, source: this.u, duration: Infinity,
      data: {aphrissaRelayParent: record}, admit: permit, onRemove: () => this.remove(record)});
    if (!this.valid() || !this.ownsParent(record) || !this.related().includes(target)
      || target.deploySeq !== record.life) this.remove(record);
  }
  sync() {
    if (this.busy) return;
    this.busy = true;
    try {
      if (!this.valid()) { this.clear(); return; }
      const targets = this.related(), wanted = new Set(targets);
      for (const record of [...this.members.values()])
        if (!wanted.has(record.target) || record.target.deploySeq !== record.life || !this.ownsParent(record)) this.remove(record);
      for (const target of targets) this.attach(target);
      if (!this.valid()) { this.clear(); return; }
      const current = this.related();
      for (const record of [...this.members.values()])
        if (!current.includes(record.target) || record.target.deploySeq !== record.life || !this.ownsParent(record)) this.remove(record);
      const active = current.map(t => this.members.get(t)).find(record => record && this.ownsParent(record));
      if (this.child && (this.active !== active || this.u.findBuff(CHILD) !== this.child)) this.removeChild();
      if (!active || !this.power || this.child || this.u.findBuff(CHILD)) return;
      const permit = (unit, buff) => unit === this.u && this.valid() && !active.finished && this.ownsParent(active)
        && active.target.deploySeq === active.life && this.related().includes(active.target)
        && !this.u.findBuff(CHILD) && buff.key === CHILD && buff.source === this.u
        && buff.data?.aphrissaRelayBonus === this && buff.data?.parent === active
        && buff.duration === Infinity && Object.keys(buff.flags ?? {}).length === 0
        && Object.keys(buff.mods ?? {}).length === 1 && buff.mods.atkPct === this.power;
      const child = this.b.addBuff(this.u, {key: CHILD, source: this.u, duration: Infinity,
        data: {aphrissaRelayBonus: this, parent: active}, mods: {atkPct: this.power}, admit: permit});
      if (!child) return;
      if (this.valid() && this.u.findBuff(CHILD) === child && this.ownsParent(active)
        && active.target.deploySeq === active.life && this.related().includes(active.target)) {
        this.active = active; this.child = child;
      } else if (this.u.findBuff(CHILD) === child && child.data?.aphrissaRelayBonus === this)
        this.b.removeBuff(this.u, child);
    } finally { this.busy = false; }
  }
  install() {
    if (this.stopped || this.handles.length) throw Error('Relay bonus cannot be reinstalled');
    this.handles = [this.b.on('deploy', ({unit, move}) => {
      if (unit === this.u && !move) {
        if (this.seq !== null) { this.stop(); return; }
        this.seq = unit.deploySeq;
      }
      this.sync();
    }, {owner: this.u}), this.b.on('tick', () => {
      if (this.seq !== null && (!present(this.u) || this.u.deploySeq !== this.seq
        || this.u.mem.aphrissaRelayBonus !== this)) this.stop(); else this.sync();
    }, {owner: this.u}), this.b.on('death', ({unit}) => {
      if (unit === this.u) this.stop(); else this.sync();
    }, {owner: this.u}), this.b.on('battleEnd', () => this.stop(), {owner: this.u})];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.clear();
    for (const handle of this.handles) this.b.off(handle);
    this.handles = [];
  }
}
