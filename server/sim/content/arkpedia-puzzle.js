// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-puzzle-prefabs.json' with {type:'json'};
import {resolveHit} from '../ai.js';
import {canTargetEnemy} from '../targeting.js';
const ID='char_4017_puzzle',KEY='puzzle_skill_2[damage]';
const live=u=>u?.alive&&u.deployed&&!u.hidden;
const model=u=>evidence.models[ID][['UP','LEFT'].includes(u.dir)?'Back':'Front'];
const combat=(u,targets)=>targets?.some(e=>e.blockedBy===u);
function clip(u,targets){return`${u.skill.active&&u.skill.id==='skchr_puzzle_2'?'Skill_2_':''}${combat(u,targets)?'Combat':'Attack'}`;}
function windup(b,u,targets){
 const key=clip(u,targets);u.mem.puzzleClip=key;
 if(u.skill.pending&&u.skill.id==='skchr_puzzle_1'){
  b.addBuff(u,{key:'puzzle:s1-no-sp',flags:{noSp:true}});
  u.mem.puzzleCast={seq:u.deploySeq,activation:u.skill.activations,control:u.attackControlEpoch};
 }
 return model(u).hits[key][0]*100/u.s.aspd;
}
function addPoison(b,u,e,s){
 // The original effect has one shared buff key, independentCharacterSource0
 // and an independent count modifier with checkBuffSourcefalse.
 let dot=e.findBuff(KEY);
 const life=s['attack@duration_2'],snapshot=u.s.atk,scale=s['attack@atk_scale_2'];
 if(!dot){
  const state={source:u,cachedAtk:snapshot,scale,count:0,max:s['attack@max_cnt'],nextAt:b.time+.15,
   expiresAt:b.time+life};
  dot=b.addBuff(e,{key:KEY,source:u,duration:life,data:state,onTick:()=>{
   if(!e.alive||!e.deployed||e.findBuff(KEY)!==dot)return;
   while(b.time+1e-9>=state.nextAt&&state.nextAt<state.expiresAt-1e-9){
    state.nextAt+=1;
    b.dealDamage(state.source,e,{amount:state.cachedAtk*state.scale*state.count,type:'arts',
     canDodge:false,isAttack:false,isSkill:false,applyWay:'none',ignoreSelect:true,
     tags:['dot','puzzle:dot']});
   }
  }});
 }else{
  // Source raw overrideType3/takeSnapshotWhenExtend1 is represented by a
  // refreshed16s lifetime and replaced ATK snapshot, retaining tick cadence.
  // The unrecovered native extension/counter dispatcher is explicitly scoped.
  dot.timeLeft=Math.max(dot.timeLeft,life);dot.duration=Math.max(dot.duration,life);
  Object.assign(dot.data,{source:u,cachedAtk:snapshot,scale,max:s['attack@max_cnt'],expiresAt:b.time+life});
  dot.source=u;
 }
 if(dot)dot.data.count=Math.min(dot.data.max,dot.data.count+1);
}
function launch(b,u,p,target,info){
 if(!canTargetEnemy(u,target,p))return;
 u.mem.puzzleEmittedAttack=info.attackId;
 const second=!!p.puzzleSecond;
 const melee=target.blockedBy===u;
 const hit={...p,attack:melee?'melee':'ranged',applyWay:melee?'melee':'ranged',
  hits:1,hitsFn:null,splashRadius:0,chain:null};
 const impact=(target,x,y)=>{
  if(!target||!canTargetEnemy(u,target,p))return;
  // Native active DOT buff is isDamageMissable0. Its attachment is independent
  // of mitigated HP loss, physical dodge or a fully absorbed ordinary output.
  if(second)addPoison(b,u,target,u.def.skill.bb);
  resolveHit(b,u,hit,target,info,x,y);
 };
 if(melee)impact(target,target.x,target.y);
 else b.addProjectile({from:u,target,source:u,speed:10,visual:'arrow',
  data:{arkpediaTrackedVisual:true},onHit:({target,x,y})=>impact(target,x,y)});
 if(info.isSkill&&u.skill.id==='skchr_puzzle_1')b.addDp(u.ownerId,u.def.skill.bb.cost);
}
export function customizePuzzleKit({battle:b,id,def,unit:u,kit}){
 if(id!==ID)return;
 kit.install=null;kit.talents=[];
 kit.trait={install:null,attack:'ranged',projectile:'arrow',dmgType:'phys',canHitFly:true,
  maxTargets:1,hitAllBlocked:false,hits:1,hitsFn:null,allInRange:false,rangeAoe:false,
  splashRadius:0,chain:null,dmgMul:null,windup,attackVisual:(_b,unit)=>unit.mem.puzzleClip,
  launchAttack:launch,retargetOnRelease:true,interruptOnSkillChange:true};
 const s=def.skill;
 if(s.id==='skchr_puzzle_1')kit.skill={kind:'instant',attack:{atkScale:s.bb.atk_scale,
  afterAttack:(_b,unit,targets,meta)=>{
   b.removeBuff(unit,'puzzle:s1-no-sp');unit.mem.puzzleCast=null;
   if(unit.mem.puzzleEmittedAttack!==meta.attackId&&!targets.length&&meta.inputTargets.length
    &&meta.inputTargets.every(e=>!e.alive))unit.skill.addCharge(1);
  }} };
 else kit.skill={kind:'duration',duration:s.duration,mods:{aspd:s.bb.attack_speed},
  attack:{puzzleSecond:true},onStart:()=>{u.mem.regularFormVisual={clip:'Skill_2_Idle',loop:true};},
  onEnd:()=>{u.mem.regularFormVisual=null;} };
 kit.skill.id=s.id;kit.skill.name=s.name;
}
export function installPuzzle({battle:b,unit:u,def}){
 if(def.charId!==ID)return;
 const talent=def.talents[0]?.bb;
 if(talent)b.on('hit',({source,target,dmg})=>{
  // Exact native ON_CALCULATE_DAMAGE has no IsAttack or damage-type gate.
  // It therefore also sees this source's typed BUFF/NONE poison calculations.
  if(source!==u||!live(u)||target.side!=='enemy'||dmg.cancel||target.hpRatio!==talent.hp_ratio)return;
  dmg.amount*=talent.atk_scale;u.skill.gainSp(talent.sp,'puzzle_t_1');
 },{owner:u});
 b.on('damaged',({source,target,dmg})=>{
  // NORMAL output only: the native FilterDamageModifier excludes BUFF poison.
  // Absorbed output is still output; dodged/canceled modifiers never reach it.
  if(source===u&&live(u)&&u.skill.active&&u.skill.id==='skchr_puzzle_2'
   &&target.side==='enemy'&&dmg?.isAttack&&!dmg.tags.includes('hpLoss'))b.addDp(u.ownerId,def.skill.bb.cost);
 },{owner:u});
 b.on('tick',()=>{
  const token=u.mem.puzzleCast;
  if(token&&(!live(u)||u.deploySeq!==token.seq||u.skill.activations!==token.activation
   ||u.attackControlEpoch!==token.control)){
   b.removeBuff(u,'puzzle:s1-no-sp');u.mem.puzzleCast=null;
  }
 },{owner:u});
}
