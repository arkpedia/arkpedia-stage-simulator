// SPDX-License-Identifier: GPL-3.0-or-later
// Recovered mode graph, selectors and original facing clips are retained in
// data/arkpedia-crownslayer-prefabs.json; native FSM/frame parity is unverified.
import evidence from '../../../data/arkpedia-crownslayer-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
const ID = 'char_1502_crosly';
const live = u => u?.alive && u.deployed && !u.hidden;
const selected = u => Number(u.skill.id.at(-1));
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const mode = u => u.skill.active && (selected(u) === 3 || !u.mem.croslyBorn) ? selected(u) : 0;
const key = (u, role) => `crosly:${role}:${u.id}`;
const ground = { canHitFly: false, attack: 'melee', dmgType: 'phys', projectile: 'none' };
const visual = (u, clip, loop = true) => { u.mem.regularFormVisual = clip ? { clip, loop } : null; };
function keys(u, range) { return absoluteRangeKeys(evidence.tables.ranges[range].grids.map(p => [p.row,p.col]), u.tileR, u.tileC, u.dir); }
function smokeKeys(u) { return keys(u, selected(u) === 3 ? 'x-1' : 'x-4'); }
function syncSmoke(b, u) {
  const talent = u.def.talents.find(t => t.bb.damage_hitrate_physical != null)?.bb;
  const n = live(u) ? mode(u) : 0;
  const victims = new Set(n && talent ? b.enemiesInKeys(smokeKeys(u), u, ground) : []);
  for (const e of b.enemies) {
    if (!victims.has(e)) { b.removeBuff(e,key(u,'smoke')); continue; }
    if (!e.findBuff(key(u,'smoke'))) {
      const scale = n === 2 ? u.skill.bb.talent_scale : 1;
      b.addBuff(e,{key:key(u,'smoke'),source:u,mods:{hitRatePhys:talent.damage_hitrate_physical*scale,hitRateArts:talent.damage_hitrate_magical*scale}});
    }
  }
}
function strike(b, u, e, scale, tag) {
  if (canTargetEnemy(u,e,ground)) b.dealDamage(u,e,{amount:u.s.atk*scale,type:'phys',isAttack:true,isSkill:true,applyWay:'melee',tags:[tag]});
}
function finishBlast(b,u) {
  // S2 start's expiry changes to mode 4. Its CAST selector samples the cloud
  // at the original .6-second event, not at the start of the eight-second wait.
  if (!live(u) || !u.canAct || u.s.flags.disarm) { visual(u,null); return; }
  const token = { seq:u.deploySeq, epoch:u.attackControlEpoch }; u.mem.croslyBlast=token;
  visual(u,'Skill_2_End',false);
  const valid = () => live(u) && u.mem.croslyBlast===token && u.deploySeq===token.seq && u.attackControlEpoch===token.epoch && u.canAct && !u.s.flags.disarm;
  b.after(model(u).hits.Skill_2_End[0],()=>{
    if (!valid()) return;
    for (const e of b.enemiesInKeys(keys(u,'x-4'),u,ground)) strike(b,u,e,u.skill.bb['attack@atk_scale_s2'],'crosly:blast');
  },{owner:u});
  b.after(model(u).durations.Skill_2_End,()=>{
    if(u.mem.croslyBlast===token){u.mem.croslyBlast=null;visual(u,null);u.atkCd=0;}
  },{owner:u});
}
function execution(b,u) {
  if (u.mem.croslyBorn || !u.canAct || u.s.flags.disarm || b.time+1e-9 < u.mem.croslyNext) return;
  const candidates=b.enemiesInKeys(smokeKeys(u),u,ground).filter(e=>!e.findBuff(key(u,'mark')));
  const e=sortEnemyTargets(b,u,candidates,'default')[0]; if(!e)return;
  const s=u.skill,seq=u.deploySeq,epoch=u.attackControlEpoch;
  u.mem.croslyNext=b.time+s.bb['attack@s3_cd'];
  const hit=()=>{
    if(!live(u)||u.deploySeq!==seq||u.attackControlEpoch!==epoch||mode(u)!==3||!u.canAct||u.s.flags.disarm||!canTargetEnemy(u,e,ground))return;
    strike(b,u,e,s.bb['attack@atk_scale_s3'],'crosly:execution');
    if(e.alive)b.applyStatus(e,'stun',{source:u,duration:s.bb['attack@stun']});
  };
  hit();b.after(s.bb['attack@hit_interval'],hit,{owner:u});
}
export function customizeCrownslayerKit({battle:b,id,def,unit:u,kit}) {
  if(id!==ID)return;
  kit.install=null;kit.talents=[];
  kit.trait={...ground,hits:1,hitsFn:null,chain:null,splashRadius:0,maxTargets:1,
    allInRange:false,hitAllBlocked:false,maxTargetsByBlock:false,install:null,
    retargetOnRelease:false,interruptOnSkillChange:true,
    canAttack:()=>!u.mem.croslyBorn&&!u.mem.croslyBlast&&mode(u)<2,
    windup:()=>{
      const clip=(mode(u)===1?'Skill_1_':'Attack_')+(b.rng()<.5?'A':'B');u.mem.croslyAttack=clip;
      return model(u).hits[clip][0]/Math.min(1,u.base.bat/u.s.interval);
    },attackVisual:()=>u.mem.croslyAttack};
  const s=def.skill,n=Number(s.id.at(-1)),duration=n===2?s.bb.duration:s.duration;
  kit.skill={id:s.id,name:s.name,kind:'duration',duration,spType:'none',trigger:'NEVER',
    activateOnDeploy:true,hideInactiveHud:true,canActivate:()=>u.skill.activations===0,
    durationRemaining:()=>Math.min(duration,u.skill.timeLeft),
    onStart:()=>{
      const seq=u.deploySeq,token={};u.mem.croslyBorn=token;u.mem.croslyHarmed=new Set();u.mem.croslyNext=b.time;
      const born=model(u).durations[n===1?'Start':`Start_${n}`];
      visual(u,n===1?'Start':`Start_${n}`,false);
      if(n<3){
        u.skill.timeLeft+=born;b.addBuff(u,{key:key(u,'born'),duration:born,flags:{untargetable:true,noBlock:true}});
      }else{
        // S3 switches on creation: block/invisibility and smoke begin now;
        // native mode restart loses ordinary deployment protection.
        b.addBuff(u,{key:key(u,'invisible'),flags:{stealth:true},mods:{blockCnt:-u.base.blockCnt}});
        u.mem.croslyBorn=null;syncSmoke(b,u);u.mem.croslyBorn=token;
      }
      b.after(born,()=>{
        if(!live(u)||u.deploySeq!==seq||u.mem.croslyBorn!==token||!u.skill.active)return;
        u.mem.croslyBorn=null;u.atkCd=0;
        if(n===1)b.addBuff(u,{key:key(u,'s1'),mods:{atkPct:s.bb.atk,dodgePhys:s.bb.prob,dodgeArts:s.bb.prob}});
        if(n===2)b.addBuff(u,{key:key(u,'s2'),mods:{taunt:s.bb.taunt_level}});
        visual(u,n===2?'Skill_2_Idle':n===3?'Skill_3_Loop':null);syncSmoke(b,u);
      },{owner:u});
    },onTick:()=>{
      if(n===3&&u.s.flags.reveal)b.removeBuff(u,key(u,'invisible'));
      syncSmoke(b,u);
      if(mode(u)===3)execution(b,u);
    },onEnd:({reason})=>{
      u.mem.croslyBorn=null;b.removeBuff(u,key(u,'born'));b.removeBuff(u,key(u,'s1'));b.removeBuff(u,key(u,'s2'));b.removeBuff(u,key(u,'invisible'));
      syncSmoke(b,u);for(const e of b.enemies)b.removeBuff(e,key(u,'mark'));
      if(n===2&&reason==='duration')finishBlast(b,u);
      else if(n===3&&live(u)){
        const token={};u.mem.croslyEnd=token;visual(u,'Skill_3_End',false);
        b.after(model(u).durations.Skill_3_End,()=>{if(u.mem.croslyEnd===token)visual(u,null);},{owner:u});
      }else visual(u,null);
    }};
}
export function installCrownslayer({battle:b,unit:u,def}) {
  if(def.charId!==ID)return;
  const talent=def.talents.find(t=>t.bb.damage_scale!=null)?.bb;
  b.on('hit',({source,target,dmg})=>{
    if(source!==u||!live(u)||target.side!=='enemy')return;
    if(talent&&dmg.type==='phys'&&!target.isFlying&&!u.mem.croslyHarmed?.has(target))dmg.mul*=talent.damage_scale;
    // Native ON_OUTPUT_MODIFIER attaches this mark before evasion/cancellation,
    // with no max-stack refresh. The retained second strike is not reselected.
    if(mode(u)===3&&!target.findBuff(key(u,'mark')))b.addBuff(target,{key:key(u,'mark'),source:u,duration:u.skill.bb.mark_duration});
  },{owner:u});
  b.on('damaged',({source,target,amount,dmg})=>{
    if(target===u&&source&&source!==u&&amount>0&&!dmg?.sourceless)u.mem.croslyHarmed?.add(source);
  },{owner:u});
  b.on('beforeBuff',({unit,buff})=>{
    if(unit===u&&buff.flags?.reveal)b.removeBuff(u,key(u,'invisible'));
  },{owner:u});
  b.on('tick',()=>{
    // A brief control between frames still cancels the pending S2 end ability.
    const c=u.mem.croslyBlast;
    if(c&&(!live(u)||u.attackControlEpoch!==c.epoch||!u.canAct||u.s.flags.disarm)){u.mem.croslyBlast=null;visual(u,null);u.atkCd=0;}
    syncSmoke(b,u);
  },{owner:u});
  b.on('death',({unit})=>{
    if(unit!==u)return;u.mem.croslyBorn=null;u.mem.croslyBlast=null;u.mem.croslyHarmed=null;
    syncSmoke(b,u);for(const e of b.enemies)b.removeBuff(e,key(u,'mark'));visual(u,null);
  },{owner:u});
}
