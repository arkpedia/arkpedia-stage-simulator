// SPDX-License-Identifier: GPL-3.0-or-later
// Source graphs and explicitly bounded dispatch: data/arkpedia-yato-alter-prefabs.json.
import evidence from '../../../data/arkpedia-yato-alter-prefabs.json' with { type: 'json' };
import { canTargetEnemy, absoluteRangeKeys } from '../targeting.js';
import { bodyInRadius } from '../body.js';
import { RESIST_STATUSES } from '../buffs.js';
const ID = 'char_1029_yato2';
const live = u => u.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const selected = u => Number(u.skill.id.at(-1));
const key = (u, role) => `yato2:${role}:${u.id}`;
const t1 = u => u.def.talents.find(t => t.bb['attack@atk_scale_1'] != null)?.bb['attack@atk_scale_1'] ?? 0;
const t2 = u => u.def.talents.find(t => t.bb.duration != null)?.bb;
const ground = { groundOnly: true, canHitFly: false }, air = { canHitFly: true };
function hit(b, u, e, scale, artsScale = 1, tag = 'ordinary', info = {}, profile = ground) {
  if (!canTargetEnemy(u, e, profile)) return;
  const atk = u.s.atk * u.s.atkScaleMul;
  // Active native talent buff is dispatched before the main Physical receipt;
  // each component keeps its own dodge/mitigation. Arts grants no defensive SP.
  b.dealDamage(u, e, { amount: atk * t1(u) * artsScale, type: 'arts',
    isAttack: true, isSkill: u.skill.active, noSp: true, applyWay: 'melee',
    ...info, tags: [`yato2:${tag}:arts`] });
  if (canTargetEnemy(u, e, profile)) b.dealDamage(u, e, { amount: atk * scale,
    type: 'phys', isAttack: true, isSkill: u.skill.active, applyWay: 'melee',
    ...info, tags: [`yato2:${tag}:phys`] });
}
function idle(u) { u.mem.regularFormVisual = { clip: u.skill.active && selected(u) === 1 ? 'Skill_Idle' : 'Idle', loop: true }; }
function launch(b, u, p, e, info) {
  const plan = u.mem.yatoPlan;
  if (!live(u) || !u.canAct) return;
  if (!u.skill.active || selected(u) !== 1 || !plan) { hit(b, u, e, 1, 1, 'ordinary', info, p); return; }
  const state = u.mem.yatoDeployment, activation = u.skill.activations, control = u.attackControlEpoch;
  const valid = () => live(u) && u.canAct && !u.s.flags.disarm && u.mem.yatoDeployment === state
    && u.skill.active && u.skill.activations === activation && u.attackControlEpoch === control;
  const pair = () => { if (!valid()) return; hit(b,u,e,1,1,'s1',info,p); hit(b,u,e,1,1,'s1',info,p); };
  pair();
  if (!plan.combo) { u.mem.yatoCounts.set(e, (u.mem.yatoCounts.get(e) ?? 0) + 1); return; }
  u.mem.yatoCounts.set(e, 0);
  const m = model(u), playback = rate(u), events = m.hits.Skill_Attack3;
  b.after((events[1] - events[0]) / playback, pair, { owner: u });
  const secondStart = Math.max(u.s.interval, events[1] / playback);
  // ThirdAttack is a native Sequence: its two clips retain the input victim.
  b.after(secondStart - events[0] / playback, () => {
    if (!valid()) return;
    u.mem.regularFormVisual = { clip: 'Skill_Attack4', loop: false, speed: playback };
  }, { owner: u });
  b.after(secondStart + m.hits.Skill_Attack4[0] / playback - events[0] / playback, pair, { owner: u });
  b.after(secondStart + m.durations.Skill_Attack4 / playback - events[0] / playback, () => {
    if (valid() && u.mem.yatoPlan === plan) idle(u);
  }, { owner: u });
}
function finish(b,u,reason) {
  u.mem.yatoPlan = null; u.mem.yatoPhase = null; u.mem.yatoDash = null;
  b.removeBuff(u,key(u,'taunt')); b.removeBuff(u,key(u,'protected'));
  b.removeBuff(u,key(u,'archdemon'));
  if (!live(u) || reason === 'death') { u.mem.regularFormVisual = null; return; }
  const talent=t2(u);
  if (talent) b.addBuff(u,{key:key(u,'archdemon'),duration:talent.duration,mods:{atkMul:1+talent.atk}});
  u.mem.yatoCounts.clear(); u.atkCd=0;
  if (selected(u)!==1) { idle(u); return; }
  const state=u.mem.yatoDeployment;
  u.mem.regularFormVisual={clip:'Skill_End',loop:false,speed:1};
  b.after(model(u).durations.Skill_End,()=>{if(live(u)&&u.mem.yatoDeployment===state&&!u.skill.active)idle(u);},{owner:u});
}
function start(b,u) {
  const n=selected(u),m=model(u),state=u.mem.yatoDeployment,seq=u.deploySeq;
  const valid=()=>live(u)&&u.mem.yatoDeployment===state&&u.deploySeq===seq&&u.skill.active;
  const talent=t2(u);
  if(talent)b.addBuff(u,{key:key(u,'archdemon'),mods:{atkMul:1+talent.atk}});
  u.mem.yatoCounts=new Map();u.atkCd=0;
  u.mem.yatoPhase='born'; u.mem.regularFormVisual={clip:`Start_${n}`,loop:false,speed:1};
  if(n===3){
    b.addBuff(u,{key:key(u,'protected'),flags:{invulnerable:true,untargetable:true,noBlock:true}});
    b.releaseBlocked(u);
  }
  if(n===2)b.addBuff(u,{key:key(u,'taunt'),mods:{taunt:u.skill.bb.taunt_level}});
  b.after(m.durations[`Start_${n}`],()=>{
    if(!valid())return;
    if(n===1){u.mem.yatoPhase=null;idle(u);return;}
    if(n===2){
      u.mem.yatoPhase='slashes';u.mem.regularFormVisual={clip:'Skill_2',loop:false,speed:1};
      // Input/START selector is retained for the complete MultiMelee cast.
      const targets=b.enemiesInKeys(absoluteRangeKeys(u.def.rangeGrid,u.tileR,u.tileC,u.dir),u,ground);
      for(const t of m.hits.Skill_2)b.after(t,()=>{
        if(!valid()||!u.canAct)return;
        for(const e of targets)hit(b,u,e,u.skill.bb.atk_scale,u.skill.bb.talent_scale,'s2');
      },{owner:u});
      b.after(m.durations.Skill_2,()=>{if(valid())u.skill.end('finished');},{owner:u});return;
    }
    const [dx,dy]={RIGHT:[1,0],LEFT:[-1,0],UP:[0,-1],DOWN:[0,1]}[u.dir];
    const boundary=dx?dx>0?b.regularMapSize.cols-.5-u.x:u.x+.5:dy>0?b.regularMapSize.rows-.5-u.y:u.y+.5;
    u.mem.yatoPhase='dash';u.mem.yatoDash={x:u.x,y:u.y,dx,dy,distance:0,lastHit:0,
      limit:Math.min(u.skill.bb.min_dist,boundary),boundary:Math.min(u.skill.bb.max_dist,boundary)};
    // Native moving projectile effects are not Unity-rendered here. Keep the
    // reviewed original body visible at its deployment tile; no fake walking.
    u.mem.regularFormVisual={clip:'Start_3',loop:false,speed:1};
  },{owner:u});
}
export function customizeYatoAlterKit({battle:b,id,def,unit:u,kit}) {
  if(id!==ID)return;
  kit.install=null;kit.talents=[];
  kit.trait={install:null,attack:'melee',projectile:'none',dmgType:'phys',applyWay:'melee',
    ...ground,hits:1,hitsFn:null,maxTargets:1,maxTargetsByBlock:false,hitAllBlocked:false,
    splashRadius:0,chain:null,dmgMul:null,interruptOnSkillChange:true,retargetOnRelease:false,
    canAttack:()=>!u.mem.yatoPhase,
    windup:()=>model(u).hits[u.mem.yatoPlan?.clip??'Attack1'][0]/rate(u),
    attackVisual:()=>u.mem.yatoPlan?.clip??'Attack1',launchAttack:launch};
  const n=Number(def.skill.id.at(-1));
  kit.skill={id:def.skill.id,name:def.skill.name,kind:n===1?'duration':'toggle',duration:n===1?def.skill.duration:0,
    spType:'none',trigger:'NEVER',hideInactiveHud:true,
    canActivate:()=>!!u.mem.yatoPermission,
    mods:n===1?{aspd:def.skill.bb.attack_speed}:{},
    durationRemaining:()=>n===1?u.skill.timeLeft:Infinity,
    onStart:()=>start(b,u),onEnd:({reason})=>finish(b,u,reason)};
}
export function installYatoAlter({battle:b,unit:u,def}) {
  if(def.charId!==ID)return;
  b.on('deploy',({unit})=>{
    if(unit!==u)return;
    u.mem.yatoDeployment={};u.mem.yatoPlan=null;u.mem.yatoCounts=new Map();
    u.mem.yatoPhase=null;u.mem.yatoDash=null;u.mem.yatoPermission=true;
    try{u.skill.activate('deploy',{free:true});}finally{u.mem.yatoPermission=false;}
  },{owner:u});
  b.on('beforeStatus',ctx=>{
    if(ctx.target!==u||!u.skill.active||selected(u)<2)return;
    if(['stun','freeze','sleep'].includes(ctx.status))ctx.cancel=true;
    else if(selected(u)===3&&RESIST_STATUSES.has(ctx.status)&&Number.isFinite(ctx.duration))
      ctx.duration*=.001; // Native final duration floor; do not change the shared Resist cap.
  },{owner:u});
  b.on('beforeAttack',({attacker,targets})=>{
    if(attacker!==u)return;
    const combo=u.skill.active&&selected(u)===1&&(u.mem.yatoCounts.get(targets[0])??0)>=2;
    const clip=combo?'Skill_Attack3':u.skill.active&&selected(u)===1
      ?u.stats.attacks%2?'Skill_Attack2':'Skill_Attack1':`Attack${u.stats.attacks%3+1}`;
    u.mem.yatoPlan={clip,combo};
    if(combo)u.atkCd=Math.max(2*u.s.interval,
      Math.max(u.s.interval,model(u).hits.Skill_Attack3[1]/rate(u))+model(u).hits.Skill_Attack4[0]/rate(u));
  },{owner:u});
  b.on('tick',({dt})=>{
    const dash=u.mem.yatoDash;
    if(!dash||!live(u)||!u.skill.active)return;
    // Source distance gate overrides .25 with .2, speed8. One check per local
    // tick, not a time-scheduled burst at the deployment tile.
    dash.distance=Math.min(dash.limit,dash.distance+8*dt);
    if(dash.distance-dash.lastHit+1e-9>=u.skill.bb.dist_interval){
      dash.lastHit=dash.distance;
      const x=dash.x+dash.dx*dash.distance,y=dash.y+dash.dy*dash.distance;
      for(const e of b.enemies)if(canTargetEnemy(u,e,air)&&bodyInRadius(e,x,y,.5099999904632568)){
        hit(b,u,e,u.skill.bb.atk_scale,u.skill.bb.atk_scale,'s3',{},air);
        dash.limit=Math.min(dash.boundary,dash.limit+u.skill.bb.dist_unit);
      }
    }
    if(dash.distance+1e-9<dash.limit)return;
    u.mem.yatoDash=null;u.mem.yatoPhase='tail';u.mem.regularFormVisual={clip:'Skill_3_End',loop:false,speed:1};
    const state=u.mem.yatoDeployment;
    b.after(model(u).durations.Skill_3_End,()=>{
      if(live(u)&&u.mem.yatoDeployment===state&&u.skill.active)u.skill.end('finished');
    },{owner:u});
  },{owner:u});
  for(const event of ['retreat','death'])b.on(event,({unit})=>{
    if(unit!==u)return;
    u.mem.yatoDeployment=null;u.mem.yatoDash=null;u.mem.yatoPhase=null;
    u.mem.yatoCounts.clear();u.mem.regularFormVisual=null;
  },{owner:u});
}
