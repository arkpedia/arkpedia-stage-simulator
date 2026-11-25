// SPDX-License-Identifier: GPL-3.0-or-later
// Sarkaz Boneguard Fluxcaster / Captain (enemy_1365_spnwiz, _2; PRTS 萨卡兹骸骨漂泊术师). Reviewed from the pinned prefab
// (its two modes, Reborn, Reborning, Revive and both Passives) and three CN templates; the Bloodcalling Altar's side
// (SpnwizInRange, SpnwizInRange2, trap_bonore_s, trap_bonore_spnwiz_revive[trigger]) is reviewed in stage-blood-altar.js.
// - Caster mode (Default): a ranged Arts attacker (projectile_enemy_spnwiz). Its Passive carries
//   `enemy_spnwiz_default_mark` (enemy_spnwiz_reborn_ctrl) and `enemy_spnwiz_undeadable`, plus a 0.15 s INVINCIBLE.
//   reborn_ctrl, ON_BEFORE_TRY_SET_HP_ZERO: if the unit holds `trap_bonore_in_range[default]` (an Altar covers it) it
//   switches to its reborn state; otherwise the mark and undeadable finish and it dies. (The pinned Global template;
//   the current CN one also adds a 0.01 s INVINCIBLE around the switch.)
// - Reborn (`_maxRespawnCnt` -1, `_modeIndex` 1): the Reborning ability (Reborn.duration, 2 s), then Ghost mode.
//   `_hpRechargeRatio` 0.5 is read as full HP, as for the reviewed bosses (PRTS: 100%).
// - Ghost mode: no attack (`Attack` has no selector); its Passive carries `enemy_spnwiz_ghost_mark`
//   (enemy_spnwiz_bonore[action]), `enemy_spnwiz_ghost_suicide` (every 0.5 s: no `trap_bonore_in_range[ghost]`, i.e. no
//   Altar covers it -> InstantKill) and `enemy_spnwiz_ghost_invincible` (abnormal flags 5 INVINCIBLE, 6, 22
//   UNMOVABLE_PRIVATE). The Captain's also carries `enemy_bonore_mark` itself; otherwise the Altar's SpnwizInRange2
//   gives the Ghost that mark while it covers it.
// - An Altar's pulse finishes the ghost mark (trap_bonore_spnwiz_revive[trigger]); enemy_spnwiz_bonore[action] then,
//   while an Altar covers it, finishes the suicide check and triggers Revive: SwitchMode to Default, restoring it.


export const BONEGUARD_TEXT=["If defeated within range of a Bloodcalling Altar, slips into a turbulence in spacetime and cannot be attacked during this period.",
 "Will revive on the field when affected by an altar's pulse."];
export const isBoneguard=r=>r?.prefabKey==="enemy_1365_spnwiz"||r?.prefabKey==="enemy_1365_spnwiz_2";
export const BONEGUARD_GHOST_MARK="enemy_spnwiz_ghost_mark";
const f32=Math.fround;
/** The Captain's Ghost Passive also carries `enemy_bonore_mark` itself; the Fluxcaster's comes from the Altar. */
const ownMark=r=>r.prefabKey==="enemy_1365_spnwiz_2";
const type=a=>a?.$type?.split("+")[1]?.split(",")[0];
const types=list=>(list??[]).map(type).join();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const buffs=list=>(list??[]).map(b=>[b.buffKey,b.templateKey,b.attributes.abnormalFlags.join("/"),b.lifeTimeType].join(":")).join();

export function boneguardNative(r,n){
 if(!isBoneguard(r)||r.talents?.bb?.["Reborn.duration"]!==2||r.stats?.dmgType!=="arts"||r.applyWay!=="RANGED") return false;
 const sk=k=>r.skills?.find(s=>s.prefabKey===k);
 if(r.skills?.length!==2||sk("Reborning")?.bb?.duration!==2||!sk("Revive")) return false;
 const reborn=n?.Reborn?.[0]?n.$siblings(n.Reborn[0]).find(c=>"_hpRechargeRatio" in c):null;
 const reborning=(n?.Reborning??[]).find(c=>c._buffs)?._buffs;
 const revive=(n?.Revive??[]).find(c=>c._animKey),switcher=revive?n.$siblings(revive).find(c=>"_runActionOnEvent" in c):null;
 let sw=null; try{sw=JSON.parse(switcher._actions.SerializedState);}catch{}
 const pass=n?.Passive??[],caster=pass.find(c=>c._buffs?.some(b=>b.buffKey==="enemy_spnwiz_default_mark"))?._buffs;
 const ghost=pass.find(c=>c._buffs?.some(b=>b.buffKey===BONEGUARD_GHOST_MARK))?._buffs;
 const ghostMode=(n?.Ghost??[]).find(c=>"_generalAbilities" in c);
 const T=k=>n?.$template?.(k)?.eventToActions;
 const ctrl=T("enemy_spnwiz_reborn_ctrl")?.ON_BEFORE_TRY_SET_HP_ZERO?.[0];
 const suicide=T("enemy_spnwiz_ghost_suicide"),action=T("enemy_spnwiz_bonore[action]")?.ON_BUFF_FINISH;
 return reborn?._maxRespawnCnt===-1&&reborn._modeIndex===1&&reborn._useAbilityToHandle===1&&reborn._abilityName==="Reborning"
  &&reborn._hpRechargeRatio===.5&&reborn._keepAlive===0
  &&same(reborn._buffsRetainedWhenReborn,["enemy_spnwiz_bonore_mark","trap_bonore_in_range[default]","enemy_spnwiz_default_mark"])
  &&reborning?.length===1&&reborning[0].buffKey==="enemy_spnwiz_reborning"&&reborning[0].lifeTimeType===1&&reborning[0].durationKey==="duration"
  &&sw?.length===1&&type(sw[0])==="SwitchMode"&&sw[0]._modeIndex===0&&sw[0]._restoreDefault===true&&sw[0]._restartFSM===true
  &&buffs(caster)==="enemy_spnwiz_effects[default]:empty::2,enemy_spnwiz_default_mark:enemy_spnwiz_reborn_ctrl::2,enemy_spnwiz_undeadable:empty:6:2,enemy_spnwiz_default[tick_invincible]:empty:5:1"
  &&caster[3].lifeTime===f32(.15)
  &&buffs(ghost)===`enemy_spnwiz_ghost_mark:enemy_spnwiz_bonore[action]::2,enemy_spnwiz_ghost_suicide:enemy_spnwiz_ghost_suicide::2,${ownMark(r)?"enemy_bonore_mark:empty::2,":""}enemy_spnwiz_ghost_invincible:empty:5/6/22:2`
  &&ghost[1].triggerLifeType===2&&ghost[1].triggerInterval===.5&&ghost[1].waitFirstTriggerInterval===1
  &&ghostMode?._combat?.m_PathID==="0"
  &&type(ctrl)==="IfElse"&&type(ctrl._conditionNode)==="CheckContainsBuff"&&same(ctrl._conditionNode._buffKeys,["trap_bonore_in_range[default]"])
  &&types(ctrl._succeedNodes)==="SwitchToRebornState"
  &&types(ctrl._failNodes)==="FinishBuff,FinishBuffsById"&&ctrl._failNodes[1]._buffKey==="enemy_spnwiz_undeadable"
  &&types(suicide?.ON_BUFF_TRIGGER)==="CheckContainsBuff,IfNot,InstantKill"&&same(suicide.ON_BUFF_TRIGGER[0]._buffKeys,["trap_bonore_in_range[ghost]"])
  &&types(action)==="CheckContainsBuff,FinishBuffsById,TriggerAbility"&&same(action[0]._buffKeys,["trap_bonore_in_range[ghost]"])
  &&action[1]._buffKey==="enemy_spnwiz_ghost_suicide"&&action[2]._abilityName==="Revive";
}

export function boneguardParams(r){
 // Reborning for Reborn.duration s; the Ghost's suicide check every 0.5 s (first 0.5 s in); 0.15 s INVINCIBLE on each
 // entry to caster mode (enemy_spnwiz_default[tick_invincible]).
 return {reborn:r.talents.bb["Reborn.duration"],check:.5,spawnInvincible:f32(.15),hp:1,ownMark:ownMark(r)};
}

const feature={matchesRecord:isBoneguard,covers:boneguardNative};
const lines=new Set(BONEGUARD_TEXT);
// talent:Reborn is the shared rebirth key (enemy-features.js rebornFamily): for these two it checks boneguardNative and
// runs kind `boneguard` with boneguardParams.
export const BONEGUARD_FEATURES={
 "skill:Reborning":{...feature,explains:text=>lines.has(text),nativeClaim:()=>({wrappers:2,active:2}),
  note:"Boneguard Fluxcaster: killed while a Bloodcalling Altar covers it, it drifts (untouchable, rooted) until a pulse revives it (talent:Reborn)"},
 "skill:Revive":{...feature,note:"the Altar-pulse revive (talent:Reborn)"},
};
