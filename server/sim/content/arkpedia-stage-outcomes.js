// SPDX-License-Identifier: GPL-3.0-or-later
import {ADD_KEYS,MUL_KEYS} from '../buffs.js';
const presenceMods=new Set([...ADD_KEYS,...MUL_KEYS]);
/** Native battle-result counters. A stage reports these to its caller; it does
 * not invent a run wallet, rewards, or progression from a counter's name. */
export function recordStageOutcome(battle, enemy, key, value = 1) {
  if (!key || !Number.isSafeInteger(value) || value <= 0) throw Error('Invalid stage outcome');
  return recordStageDelta(battle, enemy, key, value);
}
/** Signed native result values (for example a count of surviving objects).
 * Kept separate from the positive-event API so a mistaken negative reward or
 * kill count still fails at its original boundary. */
export function recordStageDelta(battle, enemy, key, value) {
  if (typeof key !== 'string' || !key || !Number.isSafeInteger(value) || value === 0)
    throw Error('Invalid stage result delta');
  const outcomes = battle.stageOutcomes ??= { counters: Object.create(null), events: [] };
  const total = (outcomes.counters[key] ?? 0) + value;
  if (!Number.isSafeInteger(total)) throw Error('Stage result overflow');
  outcomes.counters[key] = total;
  const event = { key, value, time: battle.time, enemy: enemy.defId, instance: enemy.id };
  outcomes.events.push(event);
  return event;
}
/** One contribution per attached passive, released on passive removal or any
 * owner removal. Enemy death does not run buff onRemove in the shared engine,
 * so both paths deliberately share the same idempotent release operation. */
export function stagePresenceGauge(params) {
  validatePresence(params);const {key,buffKey,value=1,flags={},mods={}}=params;
  const release = (battle, enemy, state) => {
    if (!state.contributing) return;
    recordStageDelta(battle, enemy, key, -value);
    state.contributing = false;
  };
  return {
    spawn(battle, enemy, state) {
      if (state.contributing) return;
      state.ended=false;
      state.buff=battle.addBuff(enemy,{key:buffKey,source:enemy,flags,mods,onRemove:()=>{state.ended=true;release(battle,enemy,state);}});
      if(!state.buff||state.ended||!enemy.alive||!enemy.deployed||!enemy.buffs.includes(state.buff))return;
      try{recordStageDelta(battle,enemy,key,value);state.contributing=true;}
      catch(error){battle.removeBuff(enemy,state.buff);state.buff=null;throw error;}
    },
    death(_context, battle, enemy, state) { release(battle, enemy, state); },
  };
}
function validatePresence({key,buffKey,value=1,flags={},mods={}}){
  if(typeof key!=='string'||!key||typeof buffKey!=='string'||!buffKey||!Number.isSafeInteger(value)||value<=0
    ||!flags||typeof flags!=='object'||Array.isArray(flags)||Object.entries(flags).some(([k,v])=>!['noMove','noDisplace'].includes(k)||typeof v!=='boolean')
    ||!mods||typeof mods!=='object'||Array.isArray(mods)||Object.entries(mods).some(([k,v])=>!presenceMods.has(k)||!Number.isFinite(v)))
    throw Error('Invalid stage presence gauge');
}
stagePresenceGauge.validate=validatePresence;

export function readStageOutcomes(battle) {
  return { ...(battle.stageReeds ? { tileStates: battle.stageReeds.resultTiles() } : {}), counters: { ...battle.stageOutcomes?.counters }, events: (battle.stageOutcomes?.events ?? []).map(e => ({ ...e })) };
}
export function stageOutcomeCounter({ killedKey, exitKey, exitTile, immediateAttackType = null }) {
  return {
    spawn(_battle, enemy) {
      if (immediateAttackType) { enemy.profile.deferHit = true; enemy.profile.shot = 'none'; }
    },
    attack(c, battle, enemy) {
      if (!immediateAttackType) return;
      for (const target of c.targets) if (target.alive && target.deployed)
        battle.dealDamage(enemy, target, { amount: enemy.s.atk * (enemy.profile.atkScale ?? 1),
          type: immediateAttackType, isAttack: true, attackId: battle._attackSeq, applyWay: 'ranged' });
    },
    death(c, battle, enemy, state) {
    if (state.recorded) return;
    state.recorded = true;
    if (c.reason === 'killed' && killedKey) recordStageOutcome(battle, enemy, killedKey);
    if (c.reason === 'leak' && exitKey && battle.grid.tile(enemy.tileR, enemy.tileC)?.key === exitTile)
      recordStageOutcome(battle, enemy, exitKey);
  } };
}
