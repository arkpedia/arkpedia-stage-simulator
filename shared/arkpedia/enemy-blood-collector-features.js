// SPDX-License-Identifier: GPL-3.0-or-later
// Sarkaz Bloodwalker / Bloodnexus (enemy_1366_dcolle, _2; PRTS 血之收集者): talent Collect. Reviewed from the pinned
// prefab (Collect's ability, its trigger circle and target validator; Default/Attack; Passive) and three CN templates.
// - It never attacks (`Attack` has no selector; record damage type none) and cannot be blocked.
// - Collect: a trigger circle of radius 0.5 whose validator admits ground enemy-side units carrying
//   `enemy_dcolle_mark` (Blood Amber's own passive) puts `enemy_dcolle_collected` on them. That template, while the
//   Collector's `enemy_bonore_mark[cnt]` stack is below `max_stack_cnt` (Collect.max_stack_cnt, 5): stacks it (+1),
//   gives the Collector +1 SP, and kills the Amber (InstantKill).
// - Each `enemy_bonore_mark[cnt]` stack (`enemy_dcolle_collect[cnt]`) creates one `enemy_bonore_mark` on the Collector
//   (`enemy_dcolle_bonore[action]`, override disabled so they coexist):
//   - when the Collector is killed, unless by falling, each drops one Blood Amber on the Collector's route;
//   - when the mark finishes, the Collector loses 1 SP and one `[cnt]` stack.
// - So a Bloodcalling Altar's pulse (it selects units carrying `enemy_bonore_mark`; stage-blood-altar.js) counts the
//   Collector's marks into Bloodborn Spawn and finishes them: the Collector survives, empty, and may collect again.
import {sameOutcomeValue as same} from "./enemy-outcome-contracts.js";
import {BLOOD_ALTAR_MARK, BLOOD_AMBER} from "./stage-blood-altar.js";

export const BLOOD_COLLECTOR_TEXT="Collects up to 5 pieces of dropped <Blood Amber>. When defeated, drops all collected <Blood Amber>.";
export const isBloodCollector=r=>r?.prefabKey==="enemy_1366_dcolle"||r?.prefabKey==="enemy_1366_dcolle_2";
/** Blood Amber's root CircleCollider2D (enemy_1367_dseed prefab, 0.1); the extraction does not retain it. */
export const BLOOD_AMBER_COLLIDER=Math.fround(.1);
const COUNT="enemy_bonore_mark[cnt]";
const type=a=>a?.$type?.split("+")[1]?.split(",")[0];
const types=list=>(list??[]).map(type).join();

export function bloodCollectorNative(r,n){
 if(!isBloodCollector(r)||r.talents?.bb?.["Collect.max_stack_cnt"]!==5||r.stats?.dmgType!=="none"||r.skills?.length) return false;
 const ab=(n?.Collect??[]).find(c=>c._buffs?.[0]?.buffKey==="enemy_dcolle_collected"),buff=ab?._buffs?.[0];
 const circle=ab?n.$siblings(ab).find(c=>"m_Radius" in c):null,validator=n?.$ref?.(ab?._targetValidator),v=validator?._targetOptions;
 const attack=n?.Attack?.[0],passive=n?.Passive?.[0]?._buffs;
 const T=k=>n?.$template?.(k)?.eventToActions;
 const collected=T("enemy_dcolle_collected")?.ON_BUFF_START,stack=T("enemy_dcolle_collect[cnt]")?.ON_BUFF_START;
 const action=T("enemy_dcolle_bonore[action]"),killed=action?.ON_OWNER_KILLED,finish=action?.ON_BUFF_FINISH;
 return ab?._buffs.length===1&&buff.templateKey==="enemy_dcolle_collected"&&buff.lifeTimeType===0&&buff.attributes.abnormalFlags.length===0
  &&ab._selfOption===0&&ab._removeBuffWhenTargetLeave===1&&ab._passiveBuffs?.length===0
  &&circle?.m_Radius===.5&&circle.m_IsTrigger===true&&same(circle.m_Offset,{x:0,y:0})
  &&v?.targetSide===1&&v.targetMotion===1&&v.targetCategory===1&&validator._excludeKey===0&&same(validator._buffs,["enemy_dcolle_mark"])
  &&attack?._selector?.m_PathID==="0"&&passive?.length===1&&passive[0].templateKey==="empty"
  &&types(collected)==="FilterByBuffStackCount,CreateBuff,ModifySp,PlayAudio,InstantKill"
  &&collected[0]._targetType==="BUFF_SOURCE"&&collected[0]._buffKey===COUNT&&collected[0]._stackCountKey==="max_stack_cnt"&&collected[0]._condType==="LT"
  &&collected[1]._buffOwner==="BUFF_SOURCE"&&collected[1]._buff.buffKey===COUNT&&collected[1]._buff.templateKey==="enemy_dcolle_collect[cnt]"
  &&collected[1]._buff.overrideType==="STACK"&&collected[1]._buff.maxStackCnt===10
  &&collected[2]._targetType==="BUFF_SOURCE"&&collected[2]._modifyValue===1&&collected[4]._targetType==="BUFF_OWNER"
  &&types(stack)==="CreateBuff"&&stack[0]._buffOwner==="BUFF_OWNER"&&stack[0]._buff.buffKey===BLOOD_ALTAR_MARK
  &&stack[0]._buff.templateKey==="enemy_dcolle_bonore[action]"&&stack[0]._buff.disableOverride===true
  &&types(killed)==="FilterDeathReason,IfNot,SummonEnemiesFollowMyRoute"&&killed[0]._finishReason==="FALLDOWN"
  &&killed[2]._enemyKey===BLOOD_AMBER&&killed[2]._summonCount===1&&killed[2]._delayTime===0&&killed[2]._unharmful===false
  &&types(finish)==="ModifySp,FinishBuffsById"&&finish[0]._modifyValue===-1&&finish[1]._buffKey===COUNT&&finish[1]._decCntIfStack===true;
}

export function bloodCollectorParams(r){
 const radius=.5;
 return {max:r.talents.bb["Collect.max_stack_cnt"],contact:radius+BLOOD_AMBER_COLLIDER,amber:BLOOD_AMBER};
}

export const BLOOD_COLLECTOR_FEATURES={
 "talent:Collect":{matchesRecord:isBloodCollector,covers:bloodCollectorNative,explains:text=>text===BLOOD_COLLECTOR_TEXT,
  dependsOn:()=>[BLOOD_AMBER],nativeClaim:()=>({active:1}),
  note:"Blood Collector: picks up Blood Amber (up to 5), drops them on death, gives them to a Bloodcalling Altar's pulse",
  ability:{kind:"bloodCollector",params:bloodCollectorParams}},
};
