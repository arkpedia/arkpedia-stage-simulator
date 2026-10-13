// SPDX-License-Identifier: GPL-3.0-or-later
// Opt-in source resource diagnostic. Not registered in the public roster.
import { MARCIL_ID, validateMarcilDefinition } from './arkpedia-marcil-source.js';

export const MARCIL_MANA_CONTRACT = Object.freeze({
  scope: 'Selected-source mana storage, owner lifecycle, recovery and Talent 1 ATK diagnostic',
  clock: 'One recovery tick per original period from wallet creation, processed by the scheduler at the start of the first due step; ticks on the field do not add mana. The phase of the compiled dummy-card clock and same-frame ordering are unverified.',
  removal: 'Owner finish preserves mana; an explicitly marked S3 extended chant clears mana on death, following marcil_3_extra_chant. Normal retreat preserves it.',
  assignment: 'Inactive direct SP assignments update mana without emitting a gain event, retaining this engine’s init-assignment bypass of noSp. Active-skill assignments are held. Compiled forced assignment dispatch remains unverified.',
  limits: 'No attacks, skill activation, chant controller, splash enlargement, party buffs, terrain changes, dynamic SP-cost mapping, native particles/audio, modules, public registration or Unity frame parity.',
  frameParity: false,
});
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const POWER = 'marcil:mana-atk';
function selected(u, contract) {
  if (contract !== MARCIL_MANA_CONTRACT || u.def.charId !== MARCIL_ID || u.deploySeq !== 0
    || u.mem.marcilMana) throw Error('Marcille requires a fresh original owner and explicit mana contract');
  const r = validateMarcilDefinition(u.def);
  if (!same(u.rangeGrid, r.rangeGrid)) throw Error('Incomplete Marcille selected source');
  return r;
}

export class MarcilManaWallet {
  constructor(b, record) {
    this.b = b; this.record = record; this.value = record.mana.initial;
    this.closed = false; this.owner = null; this.claimed = null; this.extraChant = false;
    this.period = b.every(record.mana.period, () => {
      if (this.closed || b.finished || this.owner) return;
      this.value = Math.min(record.mana.maximum, this.value + record.mana.recovery);
      b.emit('marcilManaRecovery', { wallet: this, current: this.value });
    });
    this.handles = [b.on('battleEnd', () => this.close())];
  }
  valid(u = this.owner) { return !this.closed && !this.b.finished && u === this.owner && live(u); }
  sync() {
    const u = this.owner;
    if (!u) return;
    const s = u.skill;
    s.sp = this.value; s.charges = this.value >= this.record.mana.maximum ? 1 : 0;
    const talent = this.record.talentBb.find(t => t.mana_add != null);
    if (this.valid() && this.value >= talent.sp) {
      if (!u.findBuff(POWER)) {
        const buff = this.b.addBuff(u, { key: POWER, source: u, mods: { atkPct: talent.atk } });
        if (!this.valid(u) && buff) this.b.removeBuff(u, buff);
      }
    } else this.b.removeBuff(u, POWER);
  }
  attach(u) {
    if (this.closed || this.b.finished || !live(u) || this.claimed !== u || this.owner && this.owner !== u)
      throw Error('Marcille mana wallet cannot attach this owner');
    this.owner = u; this.extraChant = false; this.sync();
  }
  finish(u, reason) {
    if (this.claimed === u) this.claimed = null;
    if (u !== this.owner) return;
    if (this.extraChant && reason !== 'retreat') this.value = 0;
    this.b.removeBuff(u, POWER);
    this.owner = null; this.claimed = null; this.extraChant = false;
  }
  gain(amount, reason, silent = false) {
    const u = this.owner;
    if (!Number.isFinite(amount) || !(amount > 0) || !this.valid() || u.skill.active
      || u.s.flags.noSp || ['time', 'attack', 'hurt'].includes(reason)) return 0;
    if (!silent) {
      const ctx = { unit: u, skill: u.skill, amount, reason };
      this.b.emit('spGain', ctx); amount = ctx.amount;
      if (!this.valid(u) || u.skill.active || u.s.flags.noSp || !Number.isFinite(amount) || !(amount > 0)) return 0;
    }
    const before = this.value;
    this.value = Math.min(this.record.mana.maximum, before + amount); this.sync();
    return this.value - before;
  }
  consume(amount) {
    if (!Number.isFinite(amount) || !(amount > 0)) throw Error('Invalid Marcille mana expenditure');
    if (!this.valid() || this.value < amount) return false;
    this.value -= amount; this.sync(); return true;
  }
  markExtraChant(active) {
    if (typeof active !== 'boolean' || this.record.index !== 2) throw Error('Invalid Marcille extended chant');
    if (!this.valid()) return false;
    this.extraChant = active; return true;
  }
  close() {
    if (this.closed) return;
    this.closed = true; this.period.cancel();
    if (this.owner) this.b.removeBuff(this.owner, POWER);
    this.owner = null; this.claimed = null; this.extraChant = false;
    for (const h of this.handles) this.b.off(h);
    this.handles = [];
  }
}

export function prepareMarcilMana(b, u, { contract } = {}) {
  const record = selected(u, contract), key = `${u.ownerId}:${u.def.charId}`;
  b._marcilManaWallets ??= new Map();
  let wallet = b._marcilManaWallets.get(key);
  if (wallet && (!same(wallet.record.build, record.build) || wallet.closed || wallet.owner || wallet.claimed))
    throw Error('Marcille mana wallet requires the same selected build and a retired previous owner');
  if (!wallet) { wallet = new MarcilManaWallet(b, record); b._marcilManaWallets.set(key, wallet); }
  wallet.claimed = u;
  const controller = {
    stopped: false, handles: [],
    valid() { return !this.stopped && wallet.valid(u); },
    consume(amount) { return this.valid() && wallet.consume(amount); },
    markExtraChant(active) { return this.valid() && wallet.markExtraChant(active); },
    install() {
      if (this.handles.length || this.stopped || !u.skill) throw Error('Marcille mana controller cannot be installed');
      this.originalGain = u.skill.gainSp;
      this.originalSet = u.skill.setSpTotal;
      this.boundGain = (amount, reason = 'time', silent = false) => {
        if (this.stopped) return 0;
        if (reason === 'init') return this.originalGain.call(u.skill, amount, reason, silent);
        return this.valid() ? wallet.gain(amount, reason, silent) : 0;
      };
      u.skill.gainSp = this.boundGain;
      this.boundSet = total => {
        if (this.stopped || !Number.isFinite(total)) return;
        if (!wallet.owner) return this.originalSet.call(u.skill, total);
        if (!this.valid() || u.skill.active) return;
        wallet.value = Math.max(0, Math.min(record.mana.maximum, total)); wallet.sync();
      };
      u.skill.setSpTotal = this.boundSet;
      this.handles = [
        b.on('deploy', ({ unit }) => { if (unit === u) wallet.attach(u); }),
        b.on('tick', () => { if (wallet.owner === u) wallet.sync(); }),
        b.on('death', ({ unit, reason }) => { if (unit === u) this.stop(reason); }),
        b.on('battleEnd', () => this.stop('battle-end')),
      ];
    },
    stop(reason) {
      if (this.stopped) return;
      this.stopped = true; wallet.finish(u, reason);
      if (this.boundGain && u.skill?.gainSp === this.boundGain) u.skill.gainSp = this.originalGain;
      if (this.boundSet && u.skill?.setSpTotal === this.boundSet) u.skill.setSpTotal = this.originalSet;
      for (const h of this.handles) b.off(h);
      this.handles = [];
    },
  };
  u.mem.marcilMana = { wallet, controller };
  return { record, wallet, controller, kit: { trait: { noAttack: true, attackDrivenSkill: true },
    talents: [], install: null, skill: { kind: 'instant', spType: 'none', initSp: 0,
      spCost: record.mana.maximum, trigger: { rule: 'NEVER' }, canActivate: () => false,
      resourceGauge: () => wallet.valid(u) ? { current: wallet.value, maximum: record.mana.maximum,
        label: 'Mana', canCancel: false } : null } } };
}
