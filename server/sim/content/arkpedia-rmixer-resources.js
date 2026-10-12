// SPDX-License-Identifier: GPL-3.0-or-later
// Opted-in resource diagnostic. The complete combat controller is still held.
import evidence from '../../../data/arkpedia-rmixer-prefabs.json' with { type: 'json' };
import { RMIXER_ID, selectedRmixerBuild } from './arkpedia-rmixer-source.js';
import { normalizeChess, normSpType, flattenBlackboard as flat } from '../simdata.js';

export const RMIXER_RESOURCE_CONTRACT = Object.freeze({
  scope: 'Selected-source barrier and S2 before-zero ammunition diagnostic; public kit remains held',
  mapping: 'The idle barrier snapshots current Max HP after eight seconds. An ordinary completed attack restarts an unfinished timer; a surviving barrier keeps its value. S3Attack counterattacks do not restart this timer. Depletion starts a new eight-second wait and repeated damage does not postpone it. S2 rejects the complete fatal HP set and spends twenty rounds, or every remaining round when fewer remain; empty ammo ends the skill. Existing undeadable protection and an earlier accepted guard do not spend rounds.',
  limits: 'The future combat controller must supply original completed-ability identities. S1 ammo recipient selection, native normal/S1/S2/S3 attack clocks, damage-output stacks, source priority against other barriers/guards, compiled HP-set dispatch, skills, modules, particles/audio and public battle integration are not approved. The sufficient-ammo native branch suppresses its consume event; the exact finish frame when that branch reaches zero remains unresolved. The barrier uses the simulator accepted-damage pipeline; an externally rejected attachment retries after another full interval, an explicit defensive runtime policy. beforeHpZero is a local mapping; no Unity frame parity claim.',
  frameParity: false,
});
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const key = 'rmixer:idle-barrier';

function verify(u, contract) {
  if (contract !== RMIXER_RESOURCE_CONTRACT) throw Error('Sankta Miksaparato requires the reviewed resource contract');
  if (u.def.charId !== RMIXER_ID || u.deploySeq !== 0 || u.mem.rmixerResources)
    throw Error('Sankta Miksaparato requires a fresh original owner');
  const r = selectedRmixerBuild({ ...u.def.raw.arkpedia, skillId: u.def.skill?.id }), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId !== s.id || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats)
    || !same(u.def.tags, r.tags) || !same(u.rangeGrid, r.rangeGrid)
    || !same(u.def.talents.map(t => t.bb), r.talentBb) || !same(s.bb, r.bb)
    || !same(s.rangeGrid ?? [], r.skillRange) || s.skillType !== r.source.skillType
    || s.durationType !== r.source.durationType || s.spType !== normSpType(r.source.spData.spType)
    || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp
    || s.maxCharges !== r.source.spData.maxChargeTime || s.duration !== r.source.duration)
    throw Error('Incomplete Sankta Miksaparato selected source');
  const t2 = evidence.templates.rmixer_t2.eventToActions, s2 = evidence.templates.rmixer_sk2.eventToActions.ON_BEFORE_TRY_SET_HP_ZERO;
  if (t2.ON_AFTER_ATTACK[0]._abilityName !== 'S3Attack' || t2.ON_AFTER_ATTACK[1].$type.split('+').at(-1).split(',')[0] !== 'IfNot'
    || t2.ON_BUFF_TRIGGER[0]._attributeType !== 'MAX_HP' || t2.ON_BUFF_TRIGGER[0]._scaleVar !== 'shield'
    || t2.ON_TAKE_DAMAGE[0]._filterDamageType || t2.ON_TAKE_DAMAGE[0]._filterApplyWay
    || s2[1]._conditionsNode[0]._condType !== 'GE' || s2[1]._conditionsNode[0]._anotherKeyToCompare !== 'ammo_cost'
    || s2[1]._succeedNodes[0]._blockThisHpSet !== true || s2[1]._failNodes[0]._blockThisHpSet !== true
    || s2[1]._succeedNodes[1]._consumeCountBBKey !== 'ammo_cost' || s2[1]._failNodes[1]._consumeCountBBKey !== 'cur_count')
    throw Error('Unreviewed Sankta Miksaparato resource source');
  return r;
}

export class RmixerResources {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null; this.hooks = [];
    this.stopped = false; this.waitAt = null; this.barrier = null;
    this.t2 = record.talentBb.find(t => t.shield != null);
    this.completed = new Set();
  }
  valid() { return !this.stopped && !this.b.finished && live(this.u) && this.seq === this.u.deploySeq; }
  arm() { if (this.valid() && this.t2 && this.waitAt == null && !this.barrier) this.waitAt = this.b.time + this.t2.interval; }
  completeAttack(abilityName, identity) {
    if (typeof abilityName !== 'string' || !abilityName || typeof identity !== 'string' || !identity)
      throw Error('Missing original completed ability identity');
    if (!this.valid() || this.completed.has(identity)) return false;
    this.completed.add(identity);
    // Only the named normal S3 mode is exempt in the original template. The
    // zero-interval branch has a different alias and follows the other path.
    if (abilityName !== 'S3Attack') { this.waitAt = null; this.arm(); }
    return true;
  }
  tick() {
    if (!this.valid()) return;
    if (!this.t2 || this.waitAt == null || this.b.time + 1e-9 < this.waitAt) return;
    this.waitAt = null;
    const seq = this.seq;
    this.barrier = this.b.addBuff(this.u, { key, source: this.u, shield: this.u.s.maxHp * this.t2.shield,
      visible: true, onRemove: ({ buff }) => {
        if (this.barrier !== buff || this.seq !== seq) return;
        this.barrier = null; this.arm();
      } });
    // beforeBuff can reject an attachment or retire its source synchronously.
    // Never leave the newly accepted object attached to a retired controller.
    if (!this.valid() || this.seq !== seq) {
      if (this.barrier) this.b.removeBuff(this.u, this.barrier);
      this.barrier = null;
    } else if (!this.barrier) this.arm();
  }
  intercept(ctx) {
    const s = this.u.skill;
    if (!this.valid() || ctx.unit !== this.u || ctx.blocked || this.u.s.flags.undeadable
      || this.record.index !== 1 || !s.active || s.kind !== 'ammo' || !(s.ammoLeft > 0)) return false;
    const consume = Math.min(s.ammoLeft, this.record.bb.ammo_cost);
    ctx.blocked = true; s.ammoLeft -= consume;
    this.b.emit('rmixerFatalGuard', { owner: this.u, consumed: consume, left: s.ammoLeft });
    if (s.ammoLeft <= 0) s.end('ammo');
    return true;
  }
  install() {
    if (this.hooks.length || this.stopped) throw Error('Sankta Miksaparato resources already installed');
    this.hooks = [
      this.b.on('deploy', ({ unit }) => { if (unit === this.u) { this.seq = unit.deploySeq; this.arm(); } }),
      this.b.on('tick', () => this.tick()),
      this.b.on('beforeHpZero', ctx => this.intercept(ctx)),
      this.b.on('removed', ({ unit }) => { if (unit === this.u) this.stop(); }),
      this.b.on('death', ({ unit }) => { if (unit === this.u) this.stop(); }),
      this.b.on('battleEnd', () => this.stop()),
    ];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.waitAt = null; this.completed.clear();
    this.b.removeBuff(this.u, key); this.barrier = null;
    for (const h of this.hooks) this.b.off(h); this.hooks = [];
  }
}

export function prepareRmixerResources(b, u, { contract } = {}) {
  const record = verify(u, contract), resources = new RmixerResources(b, u, record);
  u.mem.rmixerResources = resources;
  // No placeholder attacks: this diagnostic is deliberately outside the public
  // registry. The eventual controller supplies the original completion events.
  const kind = record.index ? 'ammo' : 'instant';
  return { record, resources, kit: { trait: { noAttack: true, attackDrivenSkill: true }, talents: [], install: null,
    skill: { kind, trigger: { rule: 'NEVER' }, ammo: record.bb['attack@trigger_time'],
      canActivate: () => record.index === 1 && resources.valid() && u.canAct && !u.s.flags.disarm,
      mods: record.index === 1 ? { atkPct: record.bb.atk, defPct: record.bb.def } : {} } } };
}
