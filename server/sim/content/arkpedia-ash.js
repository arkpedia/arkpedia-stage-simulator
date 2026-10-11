// SPDX-License-Identifier: GPL-3.0-or-later
// Full source graphs and bounded native dispatch are retained in
// data/arkpedia-ash-prefabs.json. Modules and native Unity FX are excluded.
import evidence from '../../../data/arkpedia-ash-prefabs.json' with { type: 'json' };
import { acquireTargets, effectiveProfile, resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { dirVec, toLocal } from '../dir.js';
import { hitRect } from '../body.js';
const ID='char_456_ash';
const live=u=>u?.alive&&u.deployed&&!u.hidden;
const model=u=>evidence.models[ID][u.dir==='UP'?'Back':'Front'];
const mode=u=>u.skill?.active?Number(u.skill.id.at(-1)):0;
const rate=u=>u.s.aspd/100;
const plain={attack:'ranged',dmgType:'phys',canHitFly:true,hits:1,maxTargets:1,
  splashRadius:0,chain:null,applyWay:'ranged'};
// The shared convenience flag includes Freeze/Sleep/Levitate. The native
// damage template specifically checks STUNNED, so inspect real buff flags.
const stunned=e=>e.buffs.some(buff=>buff.status==='stun'
  ||buff.flags?.stun&&!buff.flags.freeze&&!buff.flags.sleep&&!buff.flags.levitate);
export function adjustAshCost(b,id,cost){
  if(id!==ID||b.bench[id]?.deployments!==0||!Number.isFinite(cost))return cost;
  const t=b.data.getChess(id).talents.find(t=>t.bb.runtime_cost!=null)?.bb;
  return Math.max(0,cost+(t?.runtime_cost??0));
}
function loop(u,n=mode(u)){
  const name=n===1?'Skill_1_Loop':n===2?'Skill_2_Loop':'Attack_Loop';
  return u.dir==='DOWN'?`${name}_Down`:name;
}
function windup(b,u){
  const n=mode(u),clip=loop(u,n),begin=n!==2&&u.mem.ashBegun!==n;
  const start=clip.replace('_Loop','_Begin'),playback=n===1?Math.min(2,rate(u)):rate(u);
  u.mem.ashAttackVisual=begin?{begin:start,loop:clip,beginDuration:model(u).durations[start]/playback}:clip;
  return (model(u).hits[clip][0]+(begin?model(u).durations[start]:0))/playback;
}
function bullet(b,u,p,e,info){
  if(!canTargetEnemy(u,e,p))return;
  const n=mode(u),scale=n===2?u.def.skill.bb['ash_s_2[atk_scale].atk_scale']:1;
  u.mem.ashBegun=n;
  const emit=()=>b.addProjectile({from:u,target:e,source:u,speed:15,maxAge:5,visual:'arrow',
    data:{arkpediaTrackedVisual:true},onHit:({target,x,y})=>{
      if(target&&canTargetEnemy(u,target,p))resolveHit(b,u,{...p,hits:1,hitsFn:null,
        atkScale:(p.atkScale??1)*(n===2&&stunned(target)?scale:1)},target,info,x,y);
    }});
  emit();
  if(n!==1)return;
  const seq=u.deploySeq,epoch=u.attackControlEpoch,activation=u.skill.activations;
  // Multi-ranged source uses triggerDelta, not another skeleton OnAttack.
  const count=u.def.skill.bb['attack@times'],playback=Math.min(2,rate(u));
  for(let i=1;i<count;i++)b.after(.05*i/playback,()=>{
    if(live(u)&&u.canAct&&!u.s.flags.disarm&&u.deploySeq===seq
      &&u.attackControlEpoch===epoch&&u.skill.active&&u.skill.activations===activation
      &&canTargetEnemy(u,e,p))emit();
  },{owner:u});
}
function flash(b,u,seq,epoch,valid){
  b.after(.233,()=>{
    if(!valid()||!live(u)||!u.canAct||u.deploySeq!==seq||u.attackControlEpoch!==epoch)return;
    const t=u.def.talents.find(t=>t.bb.stun!=null)?.bb;
    if(!t)return;
    const target=acquireTargets(b,u,{...plain,priority:'fly'})[0];
    if(!target)return;
    b.addProjectile({from:u,target,source:u,speed:10,maxAge:10,visual:'bomb',
      data:{arkpediaTrackedVisual:true},onHit:({x,y})=>{
        for(const e of b.enemiesInRadius(x,y,1))if(canTargetEnemy(u,e,{...plain,ignoreCamouflage:true}))
          b.applyStatus(e,'stun',{duration:t.stun,source:u});
      }});
  },{owner:u});
}
function startup(b,u){
  const seq=u.deploySeq,activation=u.skill.activations;
  u.mem.ashBegun=null;u.mem.regularFormVisual={clip:'Start_Attack',loop:false};
  const delay=model(u).durations.Start_Attack+model(u).durations.Skill_2_Begin;
  b.addBuff(u,{key:'ash:startup',duration:delay,flags:{disarm:true}});
  const epoch=u.attackControlEpoch;
  const valid=()=>live(u)&&u.skill.active&&u.skill.activations===activation&&u.deploySeq===seq;
  flash(b,u,seq,epoch,valid);
  b.after(model(u).durations.Start_Attack,()=>{
    if(valid())u.mem.regularFormVisual={clip:u.dir==='DOWN'?'Skill_2_Begin_Down':'Skill_2_Begin',loop:false};
  },{owner:u});
  b.after(delay,()=>{if(valid())u.mem.regularFormVisual={clip:'Skill_2_Idle',loop:true};},{owner:u});
}
function swept(e,origin,dir,start,end,radius){
  const rect=hitRect(e),pts=rect?[[rect.y0,rect.x0],[rect.y0,rect.x1],[rect.y1,rect.x0],[rect.y1,rect.x1]]:[[e.y,e.x]];
  const ps=pts.map(([y,x])=>toLocal(y-origin.y,x-origin.x,dir));
  const cross0=Math.min(...ps.map(p=>p[0])),cross1=Math.max(...ps.map(p=>p[0]));
  const cross=cross0>0?cross0:cross1<0?-cross1:0;
  if(cross>radius)return false;
  const reach=Math.sqrt(radius*radius-cross*cross),lo=Math.min(...ps.map(p=>p[1]))-reach,
    hi=Math.max(...ps.map(p=>p[1]))+reach;
  return hi>=start-1e-9&&lo<=end+1e-9;
}
function breach(b,u){
  const origin={x:u.x,y:u.y},dir=u.dir,[dr,dc]=dirVec(dir),bb=u.def.skill.bb;
  const low=b.grid.tile(u.tileR,u.tileC)?.height==='LOW';
  let distance=4,wall=false;
  for(let i=1;i<=4;i++){
    const tile=b.grid.tile(u.tileR+i*dr,u.tileC+i*dc);
    if(low&&tile?.height==='HIGH'){distance=i-.5;wall=true;break;}
    if(!tile||tile.pass==='NONE'){distance=i-.5;break;}
  }
  const to={x:origin.x+dc*distance,y:origin.y+dr*distance},hit=new Set();
  const info={isSkill:true,attackId:++b._attackSeq},p={...plain,ignoreCamouflage:true};
  b.addProjectile({from:origin,to,source:u,speed:10,maxAge:5,expireInPlace:true,visual:'arrow',
    data:{arkpediaTrackedVisual:true},onMove:({previous,x,y})=>{
      const a=Math.hypot(previous.x-origin.x,previous.y-origin.y),z=Math.hypot(x-origin.x,y-origin.y);
      for(const e of b.enemies){
        if(hit.has(e)||!canTargetEnemy(u,e,p)||!swept(e,origin,dir,a,z,1.2))continue;
        hit.add(e);resolveHit(b,u,{...p,atkScale:bb.atk_scale},e,info,e.x,e.y);
        if(e.alive)b.push(e,bb.force,{from:origin,dir:{x:dc,y:dr}});
      }
    },onHit:({x,y})=>{
      for(const e of b.enemiesInRadius(x,y,bb.range_radius))if(canTargetEnemy(u,e,p))
        resolveHit(b,u,{...p,atkScale:wall?bb.hitwall_scale:bb.not_hitwall_scale},e,
          {isSkill:true,attackId:++b._attackSeq},e.x,e.y);
      b.fx('explode',{x,y,radius:bb.range_radius});
    }});
}
function castBreach(b,u){
  const playback=Math.min(1,rate(u)),clip=u.dir==='DOWN'?'Skill_3_Down':'Skill_3';
  const duration=model(u).durations[clip]/playback;
  const state={seq:u.deploySeq,emitted:false};u.mem.ashBreach=state;
  u.mem.regularFormVisual={clip,loop:false};u.skill.timeLeft=duration;
  b.addBuff(u,{key:'ash:breach',flags:{disarm:true,noSp:true}});
  const epoch=u.attackControlEpoch;
  const valid=()=>live(u)&&u.mem.ashBreach===state&&u.deploySeq===state.seq&&u.skill.active;
  const watch=b.every(b.dt,()=>{
    if(!valid()){watch.cancel();return;}
    if(!state.emitted&&(!u.canAct||u.attackControlEpoch!==epoch)){u.skill.end('interrupt');watch.cancel();}
  },{owner:u});
  b.after(model(u).hits[clip][0]/playback,()=>{
    if(valid()&&u.canAct&&u.attackControlEpoch===epoch){breach(b,u);state.emitted=true;}
  },{owner:u});
  b.after(duration,()=>{if(valid())u.skill.end('cast');watch.cancel();},{owner:u});
}
export function customizeAshKit({battle:b,id,def,unit:u,kit}){
  if(id!==ID)return;
  kit.install=null;kit.talents=[];
  kit.trait={...plain,projectile:'none',priority:'fly',install:null,dmgMul:null,hitsFn:null,
    allInRange:false,hitAllBlocked:false,maxTargetsByBlock:false,
    retargetOnRelease:false,interruptOnSkillChange:true,windup:()=>windup(b,u),
    attackVisual:()=>u.mem.ashAttackVisual,launchAttack:bullet};
  const s=def.skill,n=Number(s.id.at(-1));
  kit.skill={id:s.id,name:s.name,kind:n===2?'ammo':'toggle',
    ...(n===1?{trigger:'SP_FULL',mods:{atkPct:s.bb.atk},onStart:()=>{u.mem.ashBegun=null;}}:n===2?{ammo:31,manualCancel:true,
      mods:{batPct:s.bb.base_attack_time},onStart:()=>startup(b,u)}:
      {attack:{noAttack:true},isExhausted:()=>u.skill?.activations>=2,onStart:()=>castBreach(b,u),
        onTick:({dt,skill})=>{skill.timeLeft=Math.max(0,skill.timeLeft-dt);}}),
    onEnd:()=>{
      u.mem.ashBegun=null;u.mem.ashBreach=null;u.mem.regularFormVisual=null;
      b.removeBuff(u,'ash:startup');b.removeBuff(u,'ash:breach');
    }};
}
export function installAsh({battle:b,unit:u,def}){
  if(def.charId!==ID)return;
  b.on('deploy',({unit})=>{
    if(unit!==u)return;
    if(b.bench[ID].deployments===0)u.skill.gainSp(def.talents.find(t=>t.bb.sp!=null)?.bb.sp??0,'talent');
    flash(b,u,u.deploySeq,u.attackControlEpoch,()=>true);
  },{owner:u});
  b.on('tick',()=>{
    if(!live(u))return;
    if(!u.canAct||!acquireTargets(b,u,effectiveProfile(u)).length)u.mem.ashBegun=null;
  },{owner:u});
  b.on('skillStart',({unit})=>{if(unit===u)u.mem.ashBegun=null;},{owner:u});
}
