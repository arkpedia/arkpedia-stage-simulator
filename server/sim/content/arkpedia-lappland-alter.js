// SPDX-License-Identifier: GPL-3.0-or-later
// Private three-skill adapter. Public enablement still requires full-kit/asset review.
import evidence from '../../../data/arkpedia-lappland-alter-prefabs.json' with { type:'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { normalizeChess } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';
import {LapplandS3Drones,validateLapplandS3} from './arkpedia-lappland-s3.js';

export const LAPPLAND_ALTER_ID = 'char_1038_whitw2';
export const LAPPLAND_ATTACK_CONTRACT = Object.freeze({
  scope:'Source-selected no-module three-skill component; not public full-kit support',
  clocks:'Original facing entrance and owner attack clips/events; ordinary uncapped, active owner loops capped at one',
  ordinary:'Separate speed-ten caster and half-second drone receipts; normal drones share one target ramp per command',
  remote:'Independent whole-field stationary-target locks, immediate first receipt, live interval thereafter; moving or invalid targets release',
  s2:'Selected timed ATK/range; four drones plus Alpha upgrade, independent random range acquisitions and persistent moving-target locks; per-drone Fear Dice',
  s3:'Three/four source-bound cruise/attach pairs; spread, inertial chase and 1.25-radius idle orbit; arrival Fear, independent attached ramps and one shared immediate/one-second area clock',
  talents:'Three deployment-age Alpha Wolf rewards then terminal branch; separately installed Siracusa squad born-event SP persists while the owner is in the deck',
  mapping:'Sampled root coordinates, stationary=moving false or blocked, regular-stage caster priority, independent uniform S2 draws with replacement, root receipts, post-damage status order and mode-local ramps are local execution mappings',
  limits:'Full public factory integration, modules, original drone particles/audio and compiled Unity frame parity remain unverified. S3 source-selection ties, radial phase, angular-turn units, .04 root arrival tolerance, shared-owner handoff, damage attribution and begin-to-loop FSM dispatch are local mappings.',
  frameParity:false,
});
const ID=LAPPLAND_ALTER_ID, air={canHitFly:true};
const flat=rows=>Object.fromEntries((rows??[]).map(v=>[v.key,v.value]));
const same=(a,z)=>JSON.stringify(a)===JSON.stringify(z);
const live=u=>u?.alive&&u.deployed&&!u.hidden&&!u._removing;
const grid=id=>id?evidence.tables.ranges[id].grids.map(v=>[v.row,v.col]):[];
const components=Object.values({...evidence.characters,...evidence.skills,...evidence.projectiles})
  .flatMap(rs=>rs.flatMap(r=>r.components));
const component=id=>components.find(c=>c.pathId===id)?.data;
const ordinary=component('1782122181183635773'), remote=component('8116426389566882109'), hurricane=component('-5894285726353424067');
const model=u=>evidence.models[ID][['UP','LEFT'].includes(u.dir)?'Back':'Front'];
const factions=[evidence.tables.character.nationId,evidence.tables.character.groupId,evidence.tables.character.teamId]
  .filter(v=>typeof v==='string'&&v);
const honorDecks=new WeakMap();
const ramp=()=>({target:null,seq:null,scale:0});
const interpolate=(frames,level)=>{
  const lo=frames[0],hi=frames.at(-1),t=hi.level===lo.level?0:(level-lo.level)/(hi.level-lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([,v])=>typeof v==='number')
    .map(([k,v])=>[k,v+(hi.data[k]-v)*t]));
};

export function selectedLapplandBuild(build) {
  const c=evidence.tables.character;
  if(!build||!Number.isInteger(build.elite)||!c.phases[build.elite]
    ||!Number.isInteger(build.level)||build.level<1||build.level>c.phases[build.elite].maxLevel
    ||!Number.isInteger(build.potential)||build.potential<1||build.potential>6
    ||!Number.isInteger(build.trust??0)||(build.trust??0)<0||(build.trust??0)>200
    ||!Number.isInteger(build.skillRank)||build.skillRank<1||build.skillRank>[4,7,10][build.elite]
    ||build.module&&build.module!=='none')throw Error('Invalid Lappland source build');
  const index=['skchr_whitw2_1','skchr_whitw2_2','skchr_whitw2_3'].indexOf(build.skillId);
  if(index<0||index>build.elite)throw Error('Locked Lappland source skill');
  const phase=c.phases[build.elite],source=evidence.tables.skills[build.skillId].levels[build.skillRank-1];
  const stats=interpolate(phase.attributesKeyFrames,build.level);
  const favor=interpolate(c.favorKeyFrames,Math.min(100,build.trust??0)/2);
  for(const k of ['maxHp','atk','def'])stats[k]=Math.round(stats[k]+favor[k]);
  const attrs={COST:'cost',ATK:'atk'};
  for(const p of c.potentialRanks.slice(0,build.potential-1))for(const m of p.buff?.attributes.attributeModifiers??[]){
    if(!attrs[m.attributeType]||m.formulaItem!=='ADDITION')throw Error('Unreviewed Lappland potential');
    stats[attrs[m.attributeType]]+=m.value;
  }
  const talents=c.talents.map(t=>sourceCandidate(t.candidates,build)).filter(Boolean);
  return {build:{...build},index,source,bb:flat(source.blackboard),stats,rangeGrid:grid(phase.rangeId),talents,
    trait:flat(sourceCandidate(c.trait.candidates,build)?.blackboard),
    alpha:flat(talents.find(t=>t.prefabKey==='1')?.blackboard),
    honor:flat(talents.find(t=>t.prefabKey==='2')?.blackboard)};
}

function validate(u,contract) {
  if(contract!==LAPPLAND_ATTACK_CONTRACT)throw Error('Lappland requires the reviewed attack contract');
  if(u.def.charId!==ID||u.deploySeq!==0||u.mem.lapplandController)throw Error('Lappland requires a fresh original owner');
  const build={...u.def.raw.arkpedia,skillId:u.def.skill?.id},r=selectedLapplandBuild(build),s=u.def.skill;
  if(u.def.raw.arkpedia.skillId!=null&&u.def.raw.arkpedia.skillId!==build.skillId
    ||s.skillType!==r.source.skillType||s.spType!=='time'||s.spCost!==r.source.spData.spCost
    ||s.initSp!==r.source.spData.initSp||s.maxCharges!==r.source.spData.maxChargeTime
    ||s.duration!==r.source.duration||!same(s.bb,r.bb)||!same(s.rangeGrid??[],grid(r.source.rangeId))
    ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,factions)||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
    ||!same(u.def.talents.map(t=>t.bb),r.talents.map(t=>flat(t.blackboard))))
    throw Error('Incomplete Lappland selected three-skill source');
  if(ordinary._waitForAttackEvent!==1||ordinary._maxAnimScale!==-1||remote._maxAnimScale!==1
    ||remote._alwaysUseFunnelSelector!==1||component('2014658073790792809')._delayTime!==.5
    ||component('-1523539542428573500')._waitFirstPeriod!==0
    ||component('-5130080421960187587')._normalAttackMultiFunnelsButSingleAbility!==1)
    throw Error('Unreviewed Lappland native attack fields');
  if(r.index===1){
    const metadata=component('4913539509723790075'),mover=component('-7084995549198631118');
    if(hurricane._maxAnimScale!==1||hurricane._alwaysUseFunnelSelector!==1||hurricane._waitForAttackEvent!==1
      ||hurricane._funnelActions.length!==6||metadata._allowNoTarget!==1||metadata._rangeIdModeIndex!==2
      ||metadata._allowSpRecoveryWhenAffecting!==0||mover._immediatelyReach!==1||mover._followTarget!==0
      ||component('-2169631968293109966')._waitFirstPeriod!==0
      ||component('7977793446701154098')._stopWhenSourceInvalid!==1
      ||component('-8123329514783014061')._stopWhenSourceInvalid!==0)
      throw Error('Unreviewed Lappland S2 native fields');
    for(const ref of hurricane._funnelActions){
      const action=component(ref.m_PathID),selector=component(action._selector.m_PathID);
      if(action._interruptAbilityOnDetach!==1||action._waitForProjectileInvalid!==1
        ||selector._postFilter!==14||selector._maxNum!==1||selector._targetMotion!==3
        ||selector._forceIgnoreCamouflage!==0||selector._ignoreHitRange!==0)
        throw Error('Unreviewed Lappland S2 random selector');
    }
  }
  if(r.index===2)validateLapplandS3();
  return r;
}

export class LapplandAttackController {
  constructor(b,u,r){
    this.b=b;this.u=u;this.record=r;this.seq=null;this.stopped=false;this.phase=null;this.handles=[];
    this.modeEpoch=0;this.normalRamp=ramp();this.slots=Array.from({length:6},()=>({...ramp(),lock:null,lockSeq:null,nextAt:0}));
    this.alphaStage=0;this.capMultiplier=1;this.silence=false;this.bornAt=null;
    this.s3=r.index===2?new LapplandS3Drones(this):null;
  }
  valid(){return !this.stopped&&!this.b.finished&&live(this.u)&&this.seq===this.u.deploySeq;}
  eligible(t){return live(t)&&canTargetEnemy(this.u,t,air);}
  stationary(t){return this.eligible(t)&&(!t.moving||!!t.blockedBy)&&(!t.s.flags.camou||!!t.blockedBy);}
  count(){return 1+(this.record.index===0?1:this.u.skill.active?this.record.bb['attack@cnt']:0)+(this.alphaStage>=3?1:0);}
  skillClip(suffix){return `Skill_${this.record.index+1}_${suffix}`;}
  locked(t){return this.record.index===0?this.stationary(t):this.eligible(t);}
  visual(clip,speed=1,loop=false){this.u.mem.regularFormVisual={clip,speed,loop};}
  targets(global=false){
    const selected=this.u.skill.active&&this.record.index===1?grid(this.record.source.rangeId):this.u.rangeGrid;
    const keys=new Set(absoluteRangeKeys(selected,this.u.tileR,this.u.tileC,this.u.dir));
    const es=this.b.enemies.filter(t=>this.eligible(t)&&(!t.s.flags.camou||!!t.blockedBy)
      &&(global&&this.record.index===0?this.stationary(t):bodyInKeys(t,keys)||t.blockedBy===this.u));
    sortEnemyTargets(this.b,this.u,es);return es;
  }
  scale(slot,t){
    const bb=this.record.trait;
    slot.scale=slot.target===t&&slot.seq===t.deploySeq
      ?Math.min(bb.max_atk_scale*this.capMultiplier,slot.scale+bb.delta_atk_scale):bb.init_atk_scale;
    slot.target=t;slot.seq=t.deploySeq;return slot.scale;
  }
  receipt(t,scale,info,kind){
    if(!this.eligible(t))return;
    const b=this.b,u=this.u,seq=t.deploySeq,mode=this.modeEpoch;
    const dmg=makeDamageInfo({amount:u.s.atk*u.s.atkScaleMul*scale,type:'arts',isAttack:info.isAttack??true,
      isSkill:!!info.isSkill,attackId:info.attackId??0,applyWay:info.applyWay??'ranged',tags:[`lappland:${kind}`]});
    let accepted=false;
    const receipt=b.on('calculatedDamage',ctx=>{if(ctx.dmg===dmg)accepted=true;});
    try{b.dealDamage(u,t,dmg);}finally{b.off(receipt);}
    // A damage callback may kill/remove/redeploy either endpoint or switch mode.
    if(kind==='caster'||!this.valid()||mode!==this.modeEpoch||!this.eligible(t)||t.deploySeq!==seq)return;
    if(kind==='remote-drone'&&this.record.index===1&&u.skill.active){
      // The action's Dice is independent per drone. DB Fear is damage-missable;
      // the local receipt mapping gates application on accepted damage.
      const rolled=b.rng(),success=rolled<this.record.bb['attack@prob'];
      b.emit('lapplandFearRoll',{owner:u,target:t,rolled,success});
      if(success&&accepted&&this.valid()&&mode===this.modeEpoch&&u.skill.active
        &&this.eligible(t)&&t.deploySeq===seq)
        b.applyStatus(t,'fear',{duration:this.record.bb['attack@fear'],source:u,sourceStatusResistable:true});
    }
    if(this.valid()&&mode===this.modeEpoch&&this.silence&&this.eligible(t)&&t.deploySeq===seq)
      b.applyStatus(t,'silence',{duration:this.record.alpha['attack@silence_duration'],source:u});
  }
  caster(t,info){
    const b=this.b,u=this.u;
    const p=b.addProjectile({from:u,target:t,source:u,speed:10,maxAge:10,visual:'bolt',
      data:{arkpediaTrackedVisual:true,lapplandOwner:this,lapplandKind:'caster'},
      onHit:({target})=>{if(target)this.receipt(target,1,info,'caster');}});
    b.emit('lapplandProjectileBirth',{owner:u,target:t,kind:'caster',projectile:p});
  }
  ordinaryDrones(t,info){
    const b=this.b,u=this.u,scale=this.scale(this.normalRamp,t),mode=this.modeEpoch;
    for(let i=0;i<this.count()&&this.valid()&&!u.skill.active&&mode===this.modeEpoch;i++){
      const p=b.addProjectile({from:t,to:t,target:t,source:u,flightTime:.5,maxAge:10,visual:'drone',
        data:{arkpediaTrackedVisual:true,lapplandOwner:this,lapplandKind:'drone',slot:i},
        onHit:({target})=>{if(this.valid()&&mode===this.modeEpoch&&!u.skill.active&&target)
          this.receipt(target,scale,info,'normal-drone');}});
      b.emit('lapplandProjectileBirth',{owner:u,target:t,kind:'normal-drone',slot:i,scale,projectile:p});
    }
  }
  release(t,info){
    const p=this.phase,u=this.u;
    if(!this.valid()||!u.canAct||u.s.flags.disarm||!p||p.kind!=='attack'||p.accepted
      ||p.target!==t||p.targetSeq!==t.deploySeq||p.epoch!==u.attackControlEpoch
      ||p.mode!==this.modeEpoch||!this.eligible(t)||this.b.time+1e-9<p.releaseAt)return false;
    p.accepted=true;this.caster(t,info);
    if(!this.valid()||p.mode!==this.modeEpoch)return true;
    if(!u.skill.active)this.ordinaryDrones(t,info);
    else if(this.record.index<2)this.acquireRemote(info);
    return true;
  }
  acquireRemote(info={isSkill:true}){
    if(!this.valid()||!this.u.skill.active||!this.u.canAct||this.u.s.flags.disarm)return;
    const mode=this.modeEpoch;
    for(let i=0;i<this.count()&&this.valid()&&mode===this.modeEpoch&&this.u.canAct&&!this.u.s.flags.disarm;i++){
      const s=this.slots[i];if(s.lock)continue;
      const candidates=this.targets(true);
      if(!candidates.length)continue;
      const t=this.record.index===0?candidates[0]:candidates[Math.min(candidates.length-1,Math.floor(this.b.rng()*candidates.length))];
      if(!t)continue;
      s.lock=t;s.lockSeq=t.deploySeq;s.nextAt=this.b.time;
      this.b.emit('lapplandDroneLock',{owner:this.u,target:t,slot:i});
      if(this.valid()&&mode===this.modeEpoch)this.remoteSlot(i,info);
    }
    this.remoteTicks(info);
  }
  remoteTicks(info={isSkill:true}){
    const mode=this.modeEpoch;
    for(let i=0;i<this.count()&&this.valid()&&this.u.skill.active&&mode===this.modeEpoch;i++){
      this.remoteSlot(i,info);
    }
  }
  remoteSlot(i,info){
    const s=this.slots[i],t=s.lock,mode=this.modeEpoch;
    if(!t)return;
    if(s.lockSeq!==t.deploySeq||!this.locked(t)){s.lock=null;return;}
    if(this.b.time+1e-9<s.nextAt)return;
    s.nextAt=this.b.time+this.u.s.interval;
    const seq=t.deploySeq,scale=this.scale(s,t);
    this.b.emit('lapplandDroneStrike',{owner:this.u,target:t,slot:i,scale});
    if(this.valid()&&this.u.skill.active&&mode===this.modeEpoch&&s.lock===t
      &&seq===t.deploySeq&&this.locked(t))this.receipt(t,scale,info,'remote-drone');
  }
  changeMode(active){
    const mode=++this.modeEpoch;this.phase=null;this.u.atkCd=0;
    this.s3?.stop();
    if(this.modeEpoch!==mode)return;
    for(const s of this.slots)s.lock=null;
    this.b.projectiles.remove(p=>p.data?.lapplandOwner===this&&p.data.lapplandKind==='drone');
    if(!this.valid())return;
    const clip=this.skillClip(active?'Begin':'End');
    this.phase={kind:'transition',readyAt:Math.max(this.b.time+model(this.u).durations[clip],
      this.bornAt+model(this.u).durations.Start),mode:this.modeEpoch};
    this.visual(clip);
    if(active)this.s3?.start();
  }
  toggle(){
    if(!this.valid()||!this.u.canAct||this.u.s.flags.disarm)return false;
    if(this.u.skill.active){if(this.record.index!==0)return false;this.u.skill.end('manual-toggle');return true;}
    return this.u.skill.activate('manual');
  }
  installSquad(){
    // The original effect is a deck buff. No owner-bound hook or living aura:
    // an undeployed or withdrawn Lappland still supplies the selected squad talent.
    const b=this.b,u=this.u,amount=this.record.honor.sp;
    if(!amount)return false;
    if(u.deploySeq!==0||b.time!==0||b.finished)throw Error('Install Lappland squad talent before deployment/combat');
    let decks=honorDecks.get(b);if(!decks){decks=new Map();honorDecks.set(b,decks);}
    if(decks.has(u.player.id))throw Error('Duplicate Lappland in one squad');
    const claims=new WeakMap();
    const deploy=b.on('deploy',({unit:t,move})=>{
      if(move||t.side!=='ally'||t.kind!=='op'||t.player!==u.player||!t.def.tags.includes('siracusa')
        ||claims.get(t)===t.deploySeq||!live(t)||!t.skill)return;
      claims.set(t,t.deploySeq);
      t.skill.gainSp(amount,'lappland-squad');
    });
    const finish=b.on('battleEnd',()=>{b.off(deploy);b.off(finish);decks.delete(u.player.id);});
    decks.set(u.player.id,{deploy,finish});return true;
  }
  alpha(){
    const a=this.record.alpha;
    if(!a.interval||this.alphaStage>=4||this.b.time+1e-9<this.bornAt+a.interval*(this.alphaStage+1))return;
    this.alphaStage++;
    if(this.alphaStage===1)this.capMultiplier=a.scale;
    else if(this.alphaStage===2)this.silence=true;
    this.b.emit('lapplandAlphaWolf',{owner:this.u,stage:this.alphaStage});
  }
  tick(){
    if(!this.valid()){
      if(!this.stopped&&!this.b.finished&&this.u.deploySeq===0)return;
      this.stop();return;
    }
    const u=this.u,b=this.b;this.alpha();
    if(!this.valid())return;
    // Already attached native remote projectiles keep ticking through owner control.
    if(u.skill.active){if(this.s3)this.s3.tick();else this.remoteTicks();}
    if(!this.valid())return;
    let p=this.phase;
    if(p?.kind==='entrance'||p?.kind==='transition'){
      if(b.time+1e-9<p.readyAt)return;
      this.phase=null;p=null;
    }
    if(!u.canAct||u.s.flags.disarm||p&&p.epoch!==u.attackControlEpoch){
      this.phase=null;this.visual(u.skill.active?this.skillClip('Idle'):'Idle',1,true);return;
    }
    if(p){
      if(!p.accepted&&p.target&&(!this.eligible(p.target)||p.targetSeq!==p.target.deploySeq)){
        this.phase=null;return;
      }
      if(!p.released&&b.time+1e-9>=p.releaseAt){
        p.released=true;
        if(p.target)b.forceAttack(u,[p.target]);else this.acquireRemote();
        if(!this.valid()||this.phase!==p)return;
      }
      if(b.time+1e-9<p.readyAt)return;
      this.phase=null;
    }
    if(u.atkCd>1e-9)return;
    const target=this.targets()[0];
    if(!target&&(this.s3||!u.skill.active||!this.slots.slice(0,this.count()).some(s=>!s.lock)||!this.targets(true).length)){
      this.visual(u.skill.active?this.skillClip('Idle'):'Idle',1,true);return;
    }
    const clip=u.skill.active?this.skillClip('Loop'):'Attack';
    const rawSpeed=u.base.bat/u.s.interval,speed=u.skill.active?Math.min(1,rawSpeed):rawSpeed;
    this.phase={kind:'attack',target,targetSeq:target?.deploySeq,mode:this.modeEpoch,epoch:u.attackControlEpoch,
      releaseAt:b.time+model(u).eventPayloads[clip].find(e=>e.name==='OnAttack').time/speed,
      readyAt:b.time+Math.max(u.s.interval,model(u).durations[clip]/speed),released:false,accepted:false};
    this.visual(clip,speed);u.atkCd=u.s.interval;
  }
  install(){
    if(this.stopped||this.handles.length)return;
    const b=this.b,u=this.u;u.mem.lapplandController=this;
    this.handles=[b.on('deploy',({unit})=>{if(unit===u){
      this.seq=u.deploySeq;this.bornAt=b.time;this.phase={kind:'entrance',readyAt:b.time+model(u).durations.Start};
      this.visual('Start');
    }},{owner:u}),b.on('tick',()=>this.tick(),{owner:u}),
    b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),
    b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop())];
  }
  stop(){
    if(this.stopped)return;
    this.stopped=true;this.phase=null;this.modeEpoch++;
    this.s3?.stop();
    for(const s of this.slots)s.lock=null;
    if(this.u.skill?.active)this.u.skill.end(this.b.finished?'battle-finish':'owner-finish');
    this.b.projectiles.remove(p=>p.data?.lapplandOwner===this&&p.data.lapplandKind==='drone');
    this.u.mem.regularFormVisual=null;
    for(const h of this.handles)this.b.off(h);this.handles=[];
  }
}

export function prepareLapplandAttacks(b,u,{contract}={}){
  const record=validate(u,contract),controller=new LapplandAttackController(b,u,record);
  const kit={trait:{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'arts',projectile:'none',
    hits:1,hitsFn:null,chain:null,splashRadius:0,heal:null,...air,install:null,onHit:null,onEachHit:null,
    requiresAcceptedLaunch:true,attackVisual:'none',launchAttack:(_b,_u,_p,t,info)=>controller.release(t,info)},
    skill:{kind:record.index===0?'toggle':'duration',trigger:{rule:'NEVER'},mods:{atkPct:record.bb.atk},attack:{},
      ...(record.index===1?{targeting:{rangeGrid:grid(record.source.rangeId)}}:{}),
      canActivate:()=>controller.valid()&&u.canAct&&!u.s.flags.disarm,
      onStart:()=>controller.changeMode(true),onEnd:()=>controller.changeMode(false)},talents:[],install:null};
  return {record,controller,kit};
}
