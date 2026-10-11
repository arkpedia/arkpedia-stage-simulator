// SPDX-License-Identifier: GPL-3.0-or-later
// Literal graphs and bounded dispatch: data/arkpedia-lee-prefabs.json.
import evidence from '../../../data/arkpedia-lee-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys, bodyInRadius } from '../body.js';
import { isHpLoss } from '../damage.js';
import { resolveHit } from '../ai.js';
const ID = 'char_322_lmlee';
const live = u => u?.alive && u.deployed && !u.hidden;
const n = u => Number(u.skill.id.at(-1));
const s3 = u => u.skill.active && n(u) === 3;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const key = (u, role) => `lmlee:${role}:${u.id}`;
const ground = { groundOnly: true, canHitFly: false };
const grid = evidence.tables.ranges['x-4'].grids.map(p => [p.row, p.col]);
const around = u => absoluteRangeKeys(grid, u.tileR, u.tileC, 'RIGHT');
const talent = (u, k) => u.def.talents.find(t => t.bb[k] != null)?.bb;
const speed = u => u.s.aspd / 100; // native maxAnimScale=-1
function idle(u) { u.mem.regularFormVisual = { clip: s3(u) ? 'Skill_3_Idle' : 'Idle', loop: true }; }
function target(b,u) {
  const es = b.enemiesInKeys(u.rangeKeys,u,ground);
  for (const e of u.blocking) if (live(e) && !es.includes(e)) es.push(e);
  sortEnemyTargets(b,u,es);
  return es[0];
}
function syncBlock(b,u) {
  const t = talent(u,'cnt'), blocked = live(u) ? u.blocking.filter(live) : [];
  const previous = u.mem.leeDebuffed ??= new Set();
  const count = b.enemies.filter(e => live(e) && bodyInKeys(e,around(u))).length;
  const multiplier = count === t?.cnt ? 2 : 1;
  const own = blocked.length && t ? t['lmlee_t_1[self].attack_speed'] * multiplier : 0;
  if (own) {
    if (u.findBuff(key(u,'block'))?.mods.aspd !== own)
      b.addBuff(u,{key:key(u,'block'),mods:{aspd:own},refresh:'replace'});
  } else b.removeBuff(u,key(u,'block'));
  for (const e of previous) if (!blocked.includes(e)) { b.removeBuff(e,key(u,'block')); previous.delete(e); }
  if (!t) return;
  for (const e of blocked) {
    const value=t['lmlee_t_1[enemy].attack_speed']*multiplier;
    if (e.findBuff(key(u,'block'))?.mods.aspd !== value)
      b.addBuff(e,{key:key(u,'block'),source:u,mods:{aspd:value},refresh:'replace'});
    previous.add(e);
  }
}
function finishPaper(b,u,explode=true) {
  const paper=u.mem.leePaper;
  if (!paper) return;
  u.mem.leePaper=null;paper.timer.cancel();b.removeBuff(paper.target,key(u,'paper'));
  if (!explode) return;
  const {target:e,bb}=paper, amount=u.s.atk*u.s.atkScaleMul
    *(bb.default_atk_scale+bb.factor_atk_scale*Math.min(bb.max_stack_cnt,paper.count));
  // Remove the mark before dispatch: no recursive counting/explosion. The
  // immediate-reach source AoE keeps the victim's location after its death.
  for (const z of b.enemies) if (z.hp>0 && canTargetEnemy(u,z,{canHitFly:true}) && bodyInRadius(z,e.x,e.y,1))
    b.dealDamage(u,z,{amount,type:'arts',isSkill:true,isAttack:false,noSp:true,
      applyWay:'ranged',isProjectile:true,tags:['lmlee:paper-explosion']});
}
function attachPaper(b,u,e) {
  if (!canTargetEnemy(u,e,ground)) return;
  finishPaper(b,u);
  const bb={...u.skill.bb},paper={target:e,bb,count:0,ends:b.time+bb.paper_duration};
  u.mem.leePaper=paper;
  b.addBuff(e,{key:key(u,'paper'),source:u,mods:{taunt:bb.taunt_level}});
  paper.timer=b.every(.10000000149011612,()=>{
    if (u.mem.leePaper!==paper) return;
    if (!live(e)) { finishPaper(b,u); return; }
    if (paper.count>=bb.max_stack_cnt || b.time+1e-8>=paper.ends) finishPaper(b,u);
  },{owner:u});
}
function castPaper(b,u) {
  const e=target(b,u),state={seq:u.deploySeq,control:u.attackControlEpoch};
  finishPaper(b,u);u.mem.leeCast=state;
  const clip=u.dir==='UP'?'Skill_2_start':'Skill_2_Start',m=model(u);
  u.mem.regularFormVisual={clip,loop:false,speed:1};
  const valid=()=>live(u)&&u.mem.leeCast===state&&u.attackControlEpoch===state.control&&u.canAct;
  // RunePaper waits on the skill-begin attack marker, not the two cosmetic
  // Skill_2_Attack markers. Native empty projectile performs no damage.
  b.after(m.hits[clip][0],()=>{if(valid())attachPaper(b,u,e);},{owner:u});
  b.after(m.durations[clip],()=>{
    if(u.mem.leeCast!==state)return;
    u.mem.leeCast=null;if(live(u))idle(u);
  },{owner:u});
}
function launch(b,u,p,e,info) {
  if (!s3(u)) { resolveHit(b,u,p,e,info,e.x,e.y); return; }
  // BuffSetter runs at the attack event. Only the primary projectile carries
  // actions; four additional trails must not multiply damage or push events.
  for (const z of b.enemiesInKeys(u.rangeKeys,u,ground)) if (z!==e)
    b.push(z,u.skill.bb['attack@force'],{from:u,effect:true});
  const shot={...p,launchAttack:null,hits:1},time=.15000000596046448;
  const from={x:u.x,y:u.y};
  b.addProjectile({from,source:u,target:e,flightTime:time,maxAge:10,
    visual:'orb',data:{arkpediaTrackedVisual:true},
    onHit:({target:z})=>{if(z&&canTargetEnemy(u,z,ground))resolveHit(b,u,shot,z,info,z.x,z.y);}});
}
export function customizeLeeKit({battle:b,id,def,unit:u,kit}) {
  if(id!==ID)return;
  kit.install=null;kit.talents=[];
  kit.trait={install:null,attack:'melee',dmgType:'phys',applyWay:'melee',projectile:'none',...ground,
    maxTargets:1,hits:1,hitsFn:null,maxTargetsByBlock:false,hitAllBlocked:false,splashRadius:0,
    chain:null,dmgMul:null,retargetOnRelease:false,interruptOnSkillChange:true,
    canAttack:()=>!u.mem.leeCast&&!u.mem.leeBeginning,
    windup:()=>model(u).hits[s3(u)?'Skill_3_Loop':'Attack'][0]/speed(u),
    attackVisual:()=>s3(u)?'Skill_3_Loop':'Attack',launchAttack:launch};
  const number=Number(def.skill.id.at(-1)),bb=def.skill.bb;
  kit.skill=number===2?{kind:'instant',trigger:'NEVER',canActivate:()=>!u.mem.leeCast&&!!target(b,u),
    onStart:()=>castPaper(b,u)}:{kind:'toggle',trigger:'SP_FULL',
    mods:number===1?{atkPct:bb.atk,dodgeArts:bb.prob}:{atkPct:bb.atk,defPct:bb.def,taunt:bb.taunt_level},
    ...(number===3?{targeting:{rangeGrid:def.skill.rangeGrid},
      onStart:()=>{
        const state={};u.mem.leeBeginning=state;u.atkCd=0;
        u.mem.regularFormVisual={clip:'Skill_3_Start',loop:false,speed:1};
        b.after(model(u).durations.Skill_3_Start,()=>{
          if(live(u)&&u.mem.leeBeginning===state&&s3(u)){u.mem.leeBeginning=null;idle(u);}
        },{owner:u});
      },onEnd:()=>{u.mem.leeBeginning=null;u.mem.regularFormVisual=null;}}:{})};
}
export function installLee({battle:b,unit:u,def}) {
  if(def.charId!==ID)return;
  const t2=talent(u,'extra_cost');
  u.mem.leeBlocked=new Set();u.mem.leeDebuffed=new Set();
  b.on('deploy',({unit})=>{
    if(unit!==u)return;
    u.mem.leeCast=null;u.mem.leeBeginning=null;u.mem.leeShield=false;
    u.mem.leeBlocked.clear();idle(u);
    if(n(u)===2)b.addBuff(u,{key:key(u,'passive'),mods:{aspd:u.skill.bb.attack_speed}});
    u.mem.leeUpkeep=b.every(def.traitBb.interval,()=>{
      if(!u.alive||!u.deployed)return;
      const p=b.getPlayer(u.ownerId),normal=-def.traitBb.cost,extra=-t2?.extra_cost;
      if(p.dp<normal){b.retreat(u,{reason:'merchant'});return;}
      const charge=t2&&!u.mem.leeShield&&p.dp>=extra;
      b.addDp(u.ownerId,-(charge?extra:normal));if(charge)u.mem.leeShield=true;
    },{owner:u});
    u.mem.leeBlockTimer=b.every(.10000000149011612,()=>syncBlock(b,u),{owner:u});
  },{owner:u});
  b.on('blocked',({blocker,enemy})=>{if(blocker===u){u.mem.leeBlocked.add(enemy);syncBlock(b,u);}},{owner:u});
  b.on('unblocked',({blocker,enemy,enemies})=>{
    if(blocker!==u||!u.alive)return; // retain pre-removal block state for paper cleanup
    for(const e of enemies??[enemy])u.mem.leeBlocked.delete(e);syncBlock(b,u);
  },{owner:u});
  b.on('beforeStatus',ctx=>{
    if(ctx.target!==u||!u.mem.leeShield||!['stun','freeze'].includes(ctx.status))return;
    ctx.cancel=true;u.mem.leeShield=false;
    if(ctx.source?.side==='enemy'&&live(ctx.source))b.applyStatus(ctx.source,'stun',{duration:t2.stun,source:u});
  },{owner:u});
  b.on('hit',ctx=>{
    if(ctx.target===u&&s3(u)&&ctx.dmg.canDodge&&['phys','arts'].includes(ctx.dmg.type)
      &&(!ctx.source||!bodyInKeys(ctx.source,around(u)))&&b.rng()<u.skill.bb.prob){
      ctx.dmg.cancel=true;b.fx('dodge',{x:u.x,y:u.y,id:u.id});
      b.emit('dodge',{source:ctx.source,target:u,dmg:ctx.dmg});
    }
    const paper=u.mem.leePaper;
    if(paper&&ctx.target===paper.target&&ctx.source?.side==='ally'&&!isHpLoss(ctx.dmg)
      &&ctx.dmg.type!=='element'&&!ctx.dmg.tags.includes('lmlee:paper-explosion'))
      paper.count=Math.min(paper.bb.max_stack_cnt,paper.count+1);
  },{owner:u});
  b.on('kill',({victim})=>{if(victim===u||victim===u.mem.leePaper?.target)finishPaper(b,u);},{owner:u});
  b.on('death',({unit,reason})=>{
    if(unit!==u)return;
    finishPaper(b,u,reason==='killed'||u.mem.leeBlocked.has(u.mem.leePaper?.target));
    u.mem.leeUpkeep?.cancel();u.mem.leeBlockTimer?.cancel();u.mem.leeShield=false;
    u.mem.leeCast=null;u.mem.leeBeginning=null;u.mem.regularFormVisual=null;
    syncBlock(b,u);u.mem.leeBlocked.clear();
  },{owner:u});
}
