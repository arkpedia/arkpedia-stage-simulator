// SPDX-License-Identifier: GPL-3.0-or-later
import {isHpLoss} from '../damage.js';
import {JU_ID, juNativeInputs, selectedJuInputs} from './arkpedia-ju-source.js';
import {executeEnemyInstantKill,verifyEnemyInstantKill} from '../enemy-instant-kill.js';

export const JU_WOUND_CONTRACT = Object.freeze({
  policy: 'source-cn-ju-damage-floor-and-target-owned-cripple-v1',
  frameParity: false,
  limitations: 'Native output/after-output dispatch and enum aliases map to the local damage receipt and buff lifecycle; compiled-client/frame parity remains unverified.',
});
const due = (time, end) => time >= end - 1e-8;
const alive = unit => unit?.alive && unit.deployed && !unit.removed;

export function verifyJuWoundSource(native = juNativeInputs()) {
  const fail = () => { throw Error('Changed original Ju wound inputs'); };
  const talent = native.talent._buffs;
  const events = native.templates.ju_t_1?.eventToActions;
  const outer = events?.ON_AFTER_OUTPUT_DAMAGE?.[0];
  const condition = outer?._failNodes?.[0];
  const create = condition?._succeedNodes?.[0];
  const wound = create?._buff;
  const cripple = native.templates.cripple?.eventToActions;
  if (talent?.length !== 1 || talent[0].buffKey !== 'ju_t_1' || talent[0].isSilenceable !== 0
    || talent[0].blackboard.length !== 1 || talent[0].blackboard[0].key !== 'hp' || talent[0].blackboard[0].value !== 1
    || events?.ON_OUTPUT_DAMAGE?.length !== 1
    || events.ON_OUTPUT_DAMAGE[0]._sharedFlagIndex !== 'DAMAGE_IS_UNDEADABLE_THIS_TIME'
    || outer?._conditionNode?._buffKeys?.join() !== 'cripple'
    || condition?._conditionNode?._targetType !== 'MODIFIER_TARGET'
    || condition?._conditionNode?._condType !== 'LE' || condition?._conditionNode?._hpValue?._serializedValue !== 0
    || create?._buffOwner !== 'MODIFIER_TARGET' || create?._isDerivedBuff !== false
    || wound?.buffKey !== 'cripple' || wound.templateKey !== 'cripple' || wound.overrideType !== 'UNIQUE'
    || wound.lifeTimeType !== 'INFINITY' || wound.triggerLifeType !== 'LIMITED' || wound.triggerCnt !== 1
    || wound.waitFirstTriggerInterval !== true || wound.isDamageMissable !== false || wound.isSilenceable !== false
    || wound.attributes.abnormalFlags.join() !== 'HEAL_FREE,DISABLE_COMBAT'
    || cripple?.ON_BUFF_TRIGGER?.[0]?._ownerType !== 'BUFF_OWNER'
    || cripple?.ON_BUFF_TRIGGER?.[2]?._noSource !== true
    || cripple?.ON_OWNER_KILLED_BY_MAIN_TARGET?.[0]?._spString !== 'sp'
    || cripple?.ON_OWNER_KILLED_BY_MAIN_TARGET?.[0]?._forceFlag !== false
    || cripple?.ON_OWNER_KILLED_BY_MAIN_TARGET?.[1]?._checkBuffSource !== false
    || cripple?.ON_BEFORE_APPEAR?.[0]?._noSource !== true) fail();
  const modifiers = wound.attributes.attributeModifiers;
  if (JSON.stringify(modifiers.map(m => [m.attributeType, m.formulaItem, m.loadFromBlackboard, m.value]))
    !== JSON.stringify([['MOVE_SPEED','FINAL_SCALER',true,0],['BLOCK_CNT','FINAL_SCALER',false,0],
      ['HP_RECOVERY_PER_SEC','FINAL_SCALER',false,0],['HP_RECOVERY_PER_SEC_BY_MAX_HP_RATIO','FINAL_SCALER',false,0]])) fail();
  let triggerKill,appearKill;
  try{triggerKill=verifyEnemyInstantKill(cripple.ON_BUFF_TRIGGER[2]);appearKill=verifyEnemyInstantKill(cripple.ON_BEFORE_APPEAR[0]);}catch{fail();}
  if(triggerKill._skipReborn||appearKill._skipReborn||triggerKill._killSource||appearKill._killSource||triggerKill._targetType!=='TARGET'||appearKill._targetType!=='TARGET')fail();
  return {floor: talent[0].blackboard[0].value,triggerKill,appearKill};
}

export class JuWounds {
  constructor(battle, unit, {contract} = {}) {
    if (contract !== JU_WOUND_CONTRACT || unit.def.charId !== JU_ID || unit.deploySeq !== 0)
      throw Error('Fresh original selected Ju and exact wound contract required');
    this.b = battle; this.u = unit; this.record = selectedJuInputs(unit);
    const native=verifyJuWoundSource();this.floor=native.floor;this.killActions=native;
    this.bb = this.record.talentBb[0];
    this.seq = null; this.marker = null; this.stopped = false;
    this.handles = []; this.watchers = []; this.pending = new Map();
    this.admitting = new WeakSet(); this.receipts = new WeakMap();
  }
  valid() { return !this.stopped && alive(this.u) && this.u.deploySeq === this.seq; }
  accepted() { return this.valid() && this.marker?.data?.juWounds === this
    && this.u.findBuff('ju_t_1') === this.marker; }
  install() {
    if (this.handles.length || this.stopped) throw Error('Ju wounds cannot be reinstalled');
    const {b, u} = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => {
        if (unit !== u || move) return;
        this.seq = u.deploySeq;
        this.marker = b.addBuff(u, {key: 'ju_t_1', source: u, refresh: 'keep', data: {juWounds: this}});
        if (!this.valid()) this.clearMarker();
      }, {owner: u}),
      b.on('hit', ({source, target, dmg}) => {
        if (source !== u || !this.accepted() || target.side !== 'enemy' || !alive(target)
          || dmg.type === 'element' || isHpLoss(dmg)) return;
        dmg.hpFloor = Math.max(dmg.hpFloor ?? 0, this.floor);
        let targets = this.receipts.get(dmg);
        if (!targets) this.receipts.set(dmg, targets = new WeakMap());
        targets.set(target, {life: target.deploySeq, sourceLife: this.seq, marker: this.marker});
      }, {owner: u}),
      b.on('damaged', ({source, target, dmg, hpFloor}) => {
        if (source !== u || !dmg) return;
        const targets = this.receipts.get(dmg), receipt = targets?.get(target);
        targets?.delete(target);
        if (!receipt || !this.accepted() || this.marker !== receipt.marker || this.seq !== receipt.sourceLife
          || target.deploySeq !== receipt.life || hpFloor?.life !== receipt.life
          || !hpFloor.lethal || !alive(target) || target.hp > this.floor) return;
        this.attach(target);
      }, {owner: u}),
      b.on('tick', () => { if (this.seq !== null && !this.valid()) this.stop(); }, {owner: u}),
      b.on('removed', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => { this.stop(); this.drain(); }, {owner: u}),
    ];
  }
  clearMarker() {
    if (this.marker?.data?.juWounds === this && this.u.findBuff('ju_t_1') === this.marker)
      this.b.removeBuff(this.u, this.marker);
    this.marker = null;
  }
  identity(p) { return !p.done && p.target.deploySeq === p.life
    && p.target.findBuff('cripple') === p.mark; }
  attach(target) {
    if (target.findBuff('cripple') || this.admitting.has(target)) return;
    const p = {target, life: target.deploySeq, done: false, mark: null,
      until: this.b.time + this.bb.interval, sp: this.bb.sp};
    this.admitting.add(target);
    try {
      p.mark = this.b.addBuff(target, {key: 'cripple', status: 'cripple', source: this.u, refresh: 'keep',
        flags: {noCombat: true, healFree: true, noHpRecovery: true},
        mods: {moveMul: 1 + this.bb.move_speed, blockCntMul: 0, hpRegenMul: 0},
        data: {juWound: p, sp: p.sp}, onRemove: () => this.finish(p)});
    } finally { this.admitting.delete(target); }
    if (!p.mark || p.mark.data?.juWound !== p) return;
    if (p.done) { if (target.buffs.includes(p.mark)) this.b.removeBuff(target, p.mark); return; }
    if (!alive(target) || target.deploySeq !== p.life || this.b.finished
      || target.findBuff('cripple') !== p.mark) { this.finish(p); return; }
    this.pending.set(target, p);
    this.b._unblock(target);
    this.watch();
  }
  watch() {
    if (this.watchers.length || !this.pending.size) return;
    const {b} = this;
    // Target resources are explicitly non-derived. These finite shared
    // listeners survive source retirement, and are removed with the last mark.
    this.watchers = [
      b.on('tick', () => {
        if (b.finished) { this.drain(); return; }
        for (const p of [...this.pending.values()]) {
          if (!this.identity(p) || !alive(p.target)) { this.finish(p); continue; }
          if (due(b.time, p.until)) {
            if (!p.target.hidden) executeEnemyInstantKill(b,{source:this.u,target:p.target,action:this.killActions.triggerKill});
            this.finish(p);
          }
        }
      }),
      b.on('kill', ({victim, killer}) => {
        const p = this.pending.get(victim);
        if (!p || !this.identity(p)) return;
        if (alive(killer)) killer.skill?.gainSp(p.sp, 'ju:cripple-gift');
        this.finish(p);
      }),
      b.on('enemyBeforeAppear', ({enemy}) => {
        const p = this.pending.get(enemy);
        if (p && this.identity(p)) { executeEnemyInstantKill(b,{source:this.u,target:enemy,action:this.killActions.appearKill}); this.finish(p); }
      }),
      b.on('removed', ({unit}) => { const p = this.pending.get(unit); if (p) this.finish(p); }),
      b.on('battleEnd', () => this.drain()),
    ];
  }
  finish(p) {
    if (p.done) return;
    p.done = true;
    if (this.pending.get(p.target) === p) this.pending.delete(p.target);
    if (p.mark?.data?.juWound === p && p.target.buffs.includes(p.mark)) this.b.removeBuff(p.target, p.mark);
    if (!this.pending.size) { for (const h of this.watchers) this.b.off(h); this.watchers = []; }
  }
  drain() { for (const p of [...this.pending.values()]) this.finish(p); }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.clearMarker();
    for (const h of this.handles) this.b.off(h);
    this.handles = []; this.receipts = new WeakMap();
    if (this.b.finished) this.drain();
  }
}
