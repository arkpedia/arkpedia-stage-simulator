// SPDX-License-Identifier: GPL-3.0-or-later
// Held operator aura. This never changes an enemy's printed RES.
import {APHRISSA_ID as ID, selectedAphrissaInputs, aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';
import {aphrissaRayCells, APHRISSA_RAY_CONTRACT} from './arkpedia-aphrissa-ray.js';
import {bodyOnTile} from '../body.js';

export const APHRISSA_RESISTANCE_CONTRACT = Object.freeze({
  scope: 'Selected E2 source RES-penetration aura on friendly operators; no owner skill or public admission.',
  mapping: 'Current living friendly operators, including self, on the explicitly dispatched normal/S2 ray receive the selected fixed RES penetration. Native mask639 maps to operators, with target-free and ally-isolation exclusions; heal prohibition and control do not exclude a purpose0 recipient. One shared aphris[t2] family is nonstacking. Local arbitration chooses highest selected value, then earliest source deployment/stable ID; removing that source restores the next eligible source. Exact owned instances retire on source/recipient exit, replacement, mode/range change or controller removal. Foreign replacement buffs are never adopted or deleted.',
  limits: 'Custom ray geometry, profession/flag aliases, world-tick refresh, equal-source arbitration and strongest-source fallback are explicit local mappings. Native aura/override ordering and compiled attribute/frame parity are unverified. Relay ATK, active skills, native effects/audio, modules and public admission remain separate.',
  frameParity: false,
});
const fields = new WeakMap(), KEY = 'aphris[t2]';
const present = unit => unit?.alive && unit.deployed && !unit.removed && !unit._removing;

export function prepareAphrissaResistance(b, u, {contract, rangeMode} = {}) {
  if (contract !== APHRISSA_RESISTANCE_CONTRACT || typeof rangeMode !== 'function'
    || u.def.charId !== ID || u.deploySeq !== 0 || u.mem.aphrissaResistance)
    throw Error('Fresh selected Aphrissa, exact resistance contract and explicit range mode required');
  const selected = selectedAphrissaInputs(u), n = aphrissaNativeInputs();
  const aura = n.resistanceTalent, options = n.resistanceValidator._targetOptions, buff = aura._buffs[0];
  if (aura._useOwnerAttackRange !== 1 || aura._removeBuffWhenAbilityDetached !== 1
    || aura._interval !== 0 || aura._buffs.length !== 1 || options.targetSide !== 1
    || options.targetMotion !== 3 || options.professionMask !== 639 || options.purposeMask !== 0
    || options.ignoreTargetFree !== 0 || options.ignoreAllyTargetFree !== 0
    || buff.buffKey !== KEY || buff.independentCharacterSource !== 0 || buff.maxStackCnt !== 1
    || buff.isSilenceable !== 0 || buff.isStunnable !== 0 || buff.lifeTimeType !== 2
    || buff.attributes.attributeModifiers.length !== 1 || buff.attributes.attributeModifiers[0].attributeType !== 27
    || buff.attributes.attributeModifiers[0].loadFromBlackboard !== 1)
    throw Error('Changed original Aphrissa resistance aura');
  const source = new ResistanceSource(b, u, selected, rangeMode);
  u.mem.aphrissaResistance = source;
  return source;
}

class ResistanceSource {
  constructor(b, u, selected, rangeMode) {
    Object.assign(this, {b, u, selected, rangeMode, seq: null, stopped: false, handles: [], field: null});
    this.power = selected.talentBb.find(bb => 'magic_resist_penetrate_fixed' in bb)?.magic_resist_penetrate_fixed ?? 0;
  }
  valid() {
    return !this.stopped && !this.b.finished && present(this.u) && !this.u.hidden
      && this.seq === this.u.deploySeq && this.u.mem.aphrissaResistance === this;
  }
  cells() {
    if (!this.valid() || !this.power) return [];
    let mode;
    try { mode = this.rangeMode(); }
    catch (error) { this.field?.clearSource(this); throw error; }
    if (!this.valid()) return [];
    if (mode !== 'normal' && mode !== 's2') { this.field?.clearSource(this); throw Error('Unreviewed Aphrissa aura range mode'); }
    return aphrissaRayCells(this.b, this.u, {skill2: mode === 's2', contract: APHRISSA_RAY_CONTRACT}).cells;
  }
  legal(target, cells) {
    return this.valid() && present(target) && !target.hidden && target.side === this.u.side
      && target.kind === 'op' && !['TOKEN', 'TRAP', 'DEVICE'].includes(target.def.profession)
      && !target.s.flags.untargetable && !target.s.flags.isolated
      && cells.some(cell => bodyOnTile(target, cell.row, cell.col));
  }
  sync() { this.field?.sync(); }
  install() {
    if (this.stopped || this.handles.length) throw Error('Resistance aura cannot be reinstalled');
    let field = fields.get(this.b);
    if (!field) { field = new ResistanceField(this.b); fields.set(this.b, field); }
    this.field = field; field.sources.add(this);
    this.handles = [this.b.on('deploy', ({unit, move}) => {
      if (unit !== this.u || move) return;
      if (this.seq !== null) { this.stop(); return; }
      this.seq = unit.deploySeq; field.sync();
    }, {owner: this.u}), this.b.on('death', ({unit}) => {
      if (unit === this.u) this.stop();
    }, {owner: this.u}), this.b.on('tick', () => {
      if (this.seq !== null && (!present(this.u) || this.seq !== this.u.deploySeq
        || this.u.mem.aphrissaResistance !== this)) this.stop();
    }, {owner: this.u})];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    for (const handle of this.handles) this.b.off(handle);
    this.handles = [];
    this.field?.sources.delete(this);
    this.field?.clearSource(this); this.field?.sync(); this.field?.idle();
  }
}

class ResistanceField {
  constructor(b) {
    Object.assign(this, {b, sources: new Set(), members: new Map(), busy: false, handles: []});
    this.handles = ['tick', 'deploy', 'death'].map(event => b.on(event, () => this.sync()));
    this.handles.push(b.on('battleEnd', () => {
      for (const source of [...this.sources]) source.stop();
      this.clear(); this.idle();
    }));
  }
  owns(record) {
    return record.target.findBuff(KEY) === record.buff && record.buff?.data?.aphrissaResistance === record;
  }
  remove(record) {
    if (this.members.get(record.target) === record) this.members.delete(record.target);
    if (this.owns(record)) this.b.removeBuff(record.target, record.buff);
  }
  clearSource(source) { for (const record of [...this.members.values()]) if (record.source === source) this.remove(record); }
  clear() { for (const record of [...this.members.values()]) this.remove(record); }
  candidates() {
    return [...this.sources].filter(source => source.valid() && source.power > 0)
      .sort((a, z) => z.power - a.power || a.seq - z.seq || a.u.id.localeCompare(z.u.id))
      .map(source => ({source, cells: source.cells()}));
  }
  winner(target, candidates) { return candidates.find(({source, cells}) => source.legal(target, cells))?.source; }
  sync() {
    if (this.busy) return;
    this.busy = true;
    try {
      const candidates = this.candidates();
      for (const record of [...this.members.values()])
        if (!this.owns(record) || record.life !== record.target.deploySeq
          || this.winner(record.target, candidates) !== record.source) this.remove(record);
      for (const target of this.b.allyUnits.slice()) {
        if (this.members.has(target) || target.findBuff(KEY)) continue;
        const source = this.winner(target, candidates);
        if (!source) continue;
        const record = {target, source, life: target.deploySeq, sourceLife: source.seq, buff: null};
        const permit = (unit, buff) => unit === target && target.deploySeq === record.life
          && source.seq === record.sourceLife && this.sources.has(source)
          && this.winner(target, this.candidates()) === source && !target.findBuff(KEY)
          && buff.key === KEY && buff.source === source.u && buff.data?.aphrissaResistance === record
          && buff.duration === Infinity && Object.keys(buff.flags ?? {}).length === 0
          && Object.keys(buff.mods ?? {}).length === 1 && buff.mods.resIgnoreFlat === source.power;
        const buff = this.b.addBuff(target, {key: KEY, source: source.u, duration: Infinity,
          mods: {resIgnoreFlat: source.power}, data: {aphrissaResistance: record}, admit: permit});
        if (!buff) continue;
        record.buff = buff;
        if (target.findBuff(KEY) === buff && target.deploySeq === record.life && source.valid()
          && source.seq === record.sourceLife && this.winner(target, this.candidates()) === source)
          this.members.set(target, record);
        else if (target.findBuff(KEY) === buff && buff.data?.aphrissaResistance === record)
          this.b.removeBuff(target, buff);
      }
      // A later beforeBuff callback can retire a source that supplied children
      // earlier in this same pass. Do not leave those prior grants until a tick.
      const current = this.candidates();
      for (const record of [...this.members.values()])
        if (!this.owns(record) || record.life !== record.target.deploySeq
          || this.winner(record.target, current) !== record.source) this.remove(record);
    } finally { this.busy = false; }
  }
  idle() {
    if (this.sources.size) return;
    this.clear();
    for (const handle of this.handles) this.b.off(handle);
    this.handles = [];
    if (fields.get(this.b) === this) fields.delete(this.b);
  }
}
