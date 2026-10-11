// SPDX-License-Identifier: GPL-3.0-or-later
// Private combat foundation. No public kit registration until all three skills are reviewed.
import evidence from '../../../data/arkpedia-thorns-lodestar-prefabs.json' with {type:'json'};
import {sourceCandidate} from '../../../shared/arkpedia/summons.js';
import {normalizeChess,flattenBlackboard} from '../simdata.js';
import {absoluteRangeKeys,canTargetEnemy,sortEnemyTargets,tileKeyOf} from '../targeting.js';
import {bodyInKeys} from '../body.js';
import {makeDamageInfo} from '../damage.js';
import {COLS} from '../constants.js';
import {ThornsS1Fields,THORNS_S1_CONTRACT} from './arkpedia-thorns-s1.js';
export {THORNS_S1_CONTRACT};

export const THORNS_LODESTAR_ID='char_1039_thorn2';
export const THORNS_CORE_CONTRACT=Object.freeze({
  scope:'Private selected-source ordinary attack and two-talent foundation; no activated skills',
  attacks:'Original Front/Back Attack or passive S3 Skill_3_Loop events, speed capped at one; one Arts projectile per accepted command',
  lifetime:'Released speed-ten projectiles survive owner removal; target life and eligibility are rechecked at impact',
  talents:'Selected unconditional self ATK; ability-start duration extension from other in-range operators; global speed and extra speed on six-tile straight ground runs',
  mapping:'Root-position targeting, no-device unit categories, operator professionMask639, groundPassable tile runs, strongest shared aura with fallback, tick-sampled aura changes and clip-end cadence are local execution mappings',
  limits:'S1/S2/S3 activated fields, original particles/audio, modules, compiled target filters/override priorities and Unity frame parity remain unreviewed',
  frameParity:false,
});
const ID=THORNS_LODESTAR_ID,air={canHitFly:true};
const flat=flattenBlackboard;
const same=(a,z)=>JSON.stringify(a)===JSON.stringify(z);
const live=u=>u?.alive&&u.deployed&&!u.hidden&&!u._removing;
const grid=id=>id?evidence.tables.ranges[id].grids.map(v=>[v.row,v.col]):[];
const components=Object.values({...evidence.characters,...evidence.skills,...evidence.projectiles}).flatMap(rs=>rs.flatMap(r=>r.components));
const component=id=>components.find(c=>c.pathId===id)?.data;
const model=u=>evidence.models[ID][['UP','LEFT'].includes(u.dir)?'Back':'Front'];
const factions=[evidence.tables.character.nationId,evidence.tables.character.groupId,evidence.tables.character.teamId].filter(v=>typeof v==='string'&&v);
const interpolate=(frames,level)=>{
  const lo=frames[0],hi=frames.at(-1),t=hi.level===lo.level?0:(level-lo.level)/(hi.level-lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([,v])=>typeof v==='number').map(([k,v])=>[k,v+(hi.data[k]-v)*t]));
};

export function selectedThornsBuild(build){
  const c=evidence.tables.character;
  if(!build||!Number.isInteger(build.elite)||!c.phases[build.elite]
    ||!Number.isInteger(build.level)||build.level<1||build.level>c.phases[build.elite].maxLevel
    ||!Number.isInteger(build.potential)||build.potential<1||build.potential>6
    ||!Number.isInteger(build.trust??0)||(build.trust??0)<0||(build.trust??0)>200
    ||!Number.isInteger(build.skillRank)||build.skillRank<1||build.skillRank>[4,7,10][build.elite]
    ||build.module&&build.module!=='none')throw Error('Invalid Thorns source build');
  const index=['skchr_thorn2_1','skchr_thorn2_2','skchr_thorn2_3'].indexOf(build.skillId);
  if(index<0||index>build.elite)throw Error('Locked Thorns source skill');
  const phase=c.phases[build.elite],source=evidence.tables.skills[build.skillId].levels[build.skillRank-1];
  const stats=interpolate(phase.attributesKeyFrames,build.level),favor=interpolate(c.favorKeyFrames,Math.min(100,build.trust??0)/2);
  for(const k of ['maxHp','atk','def'])stats[k]=Math.round(stats[k]+favor[k]);
  const attrs={COST:'cost',RESPAWN_TIME:'respawnTime',MAGIC_RESISTANCE:'magicResistance'};
  for(const p of c.potentialRanks.slice(0,build.potential-1))for(const m of p.buff?.attributes.attributeModifiers??[]){
    if(!attrs[m.attributeType]||m.formulaItem!=='ADDITION')throw Error('Unreviewed Thorns potential');
    stats[attrs[m.attributeType]]+=m.value;
  }
  const talents=c.talents.map(t=>sourceCandidate(t.candidates,build)).filter(Boolean);
  return {build:{...build},index,source,bb:flat(source.blackboard),stats,
    // S3 changes the default attack mode/range even before activation.
    rangeGrid:grid(index===2?source.rangeId:phase.rangeId),talents,
    extension:flat(talents.find(t=>t.prefabKey==='1')?.blackboard),speed:flat(talents.find(t=>t.prefabKey==='2')?.blackboard)};
}

function validate(u,contract){
  if(contract!==THORNS_CORE_CONTRACT)throw Error('Thorns requires the reviewed core contract');
  if(u.def.charId!==ID||u.deploySeq!==0||u.mem.thornsController)throw Error('Thorns requires a fresh original owner');
  const build={...u.def.raw.arkpedia,skillId:u.def.skill?.id},r=selectedThornsBuild(build),s=u.def.skill;
  if(u.def.raw.arkpedia.skillId!=null&&u.def.raw.arkpedia.skillId!==build.skillId
    ||s.skillType!==r.source.skillType||s.spType!=='time'||s.spCost!==r.source.spData.spCost
    ||s.initSp!==r.source.spData.initSp||s.maxCharges!==r.source.spData.maxChargeTime
    ||s.duration!==r.source.duration||!same(s.bb,r.bb)||!same(s.rangeGrid??[],grid(r.source.rangeId))
    ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,factions)
    ||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
    ||!same(u.def.talents.map(t=>t.bb),r.talents.map(t=>flat(t.blackboard))))throw Error('Incomplete Thorns selected source');
  for(const id of ['5263414674818827161','-4247744120608619623']){
    const a=component(id);
    if(a._waitForAttackEvent!==1||a._maxAnimScale!==1||a._damageType!==1||a._atkScale!==1
      ||a._useCachedAtkOnly!==0||a._projectileKey!=='projectile_chr_thorn2')throw Error('Unreviewed Thorns native attack');
  }
  if(component('-7228355187252926179')._speed!==10||component('4915877701454457117')._lifeTime!==10
    ||component('4915877701454457117')._stopWhenSourceInvalid!==0
    ||component('-6331025592883772519')._passableCnt!==6||component('-6454678035786310245')._defaultModeIndex!==1)
    throw Error('Unreviewed Thorns native lifecycle');
  return r;
}

// Native maxStackCnt1/independentCharacterSource0: do not compound identical
// talents from private duplicate owners. Retain weaker claims for removal fallback.
// Choosing the greatest magnitude is a local override mapping, not recovered Unity priority.
const auraBattles=new WeakMap();
function claimsFor(b,t,key){
  let recipients=auraBattles.get(b);if(!recipients){recipients=new Map();auraBattles.set(b,recipients);}
  let channels=recipients.get(t);if(!channels){channels=new Map();recipients.set(t,channels);}
  let channel=channels.get(key);if(!channel){channel={claims:new Map(),applied:null};channels.set(key,channel);}
  return {recipients,channels,channel};
}
function auraClaim(controller,t,key,value){
  const b=controller.b,{recipients,channels,channel}=claimsFor(b,t,key);
  if(value)channel.claims.set(controller,{value,seq:t.deploySeq});else channel.claims.delete(controller);
  for(const [owner,claim]of channel.claims)if(!owner.valid()||!live(t)||claim.seq!==t.deploySeq)channel.claims.delete(owner);
  let selected=null;
  for(const [owner,claim]of channel.claims)if(!selected||Math.abs(claim.value)>Math.abs(selected.value))selected={owner,...claim};
  if(selected){
    if(channel.applied!==t.findBuff(key)||channel.applied?.source!==selected.owner.u
      ||channel.applied?.mods.aspd!==selected.value){
      if(channel.applied)b.removeBuff(t,channel.applied);
      channel.applied=b.addBuff(t,{key,source:selected.owner.u,mods:{aspd:selected.value}});
    }
  }else{
    if(channel.applied)b.removeBuff(t,channel.applied);
    channels.delete(key);if(!channels.size)recipients.delete(t);
  }
}

/** Union of horizontal/vertical maximal passable runs; six units never substitute for six tiles. */
export function thornsStraightTiles(field,min=6){
  const result=new Set(),R=field.rect;
  for(const horizontal of [true,false]){
    const outer0=horizontal?R.r0:R.c0,outer1=horizontal?R.r1:R.c1;
    const inner0=horizontal?R.c0:R.r0,inner1=horizontal?R.c1:R.r1;
    for(let outer=outer0;outer<=outer1;outer++){
      let run=[];
      const flush=()=>{if(run.length>=min)for(const k of run)result.add(k);run=[];};
      for(let inner=inner0;inner<=inner1;inner++){
        const r=horizontal?outer:inner,c=horizontal?inner:outer;
        if(field.groundPassable(r,c))run.push(r*COLS+c);else flush();
      }
      flush();
    }
  }
  return result;
}

export class ThornsCoreController{
  constructor(b,u,record){this.b=b;this.u=u;this.record=record;this.seq=null;this.stopped=false;this.phase=null;this.handles=[];this.auraClaims=new Map();this.atkBuff=null;this.s1=null;}
  valid(){return !this.stopped&&!this.b.finished&&live(this.u)&&this.seq===this.u.deploySeq;}
  eligible(t){return live(t)&&canTargetEnemy(this.u,t,air)&&(!t.s.flags.camou||!!t.blockedBy);}
  visual(clip,speed=1,loop=false){
    this.u.mem.regularVisualDirection=['UP','LEFT'].includes(this.u.dir)?'UP':'RIGHT';
    this.u.mem.regularFormVisual={clip,speed,loop};
  }
  idle(){return this.record.index===2?'Skill_3_Idle':'Idle';}
  rangeKeys(){return this.u.rangeKeySet??new Set(absoluteRangeKeys(this.u.rangeGrid,this.u.tileR,this.u.tileC,this.u.dir,this.u.s.rangeExtend));}
  targets(){
    const keys=this.rangeKeys();
    const targets=this.b.enemies.filter(t=>this.eligible(t)&&(bodyInKeys(t,keys)||t.blockedBy===this.u));
    sortEnemyTargets(this.b,this.u,targets);return targets;
  }
  extensionRecipients(){
    if(!this.valid())return [];
    const keys=this.rangeKeys();
    // Original professionMask639 is mapped to actual operators. The native validator
    // ignores ally-target-free (isolation) but not target-free/heal-free.
    return this.b.allyUnits.filter(t=>t!==this.u&&live(t)&&t.kind==='op'
      &&!t.s.flags.untargetable&&!t.s.flags.healFree&&bodyInKeys(t,keys));
  }
  fieldDuration(base=this.record.bb.projectile_delay_time){
    if(!Number.isFinite(base)||base<0)throw Error('Invalid Thorns field duration');
    const t=this.record.extension;
    return base+Math.min(t.projectile_extend_max??0,(t.projectile_extend??0)*this.extensionRecipients().length);
  }
  syncTalents(){
    if(!this.valid())return;
    const {b,u,record:r}=this;
    if(!this.atkBuff||u.findBuff(this.atkBuff.key)!==this.atkBuff)
      this.atkBuff=b.addBuff(u,{key:'thorn2_t_1',source:u,mods:{atkPct:r.extension.atk}});
    const desired=new Map(),tiles=r.speed.cnt?thornsStraightTiles(b.grid,r.speed.cnt):new Set();
    if(r.speed.cnt)for(const t of [...b.allyUnits,...b.enemies]){
      if(!live(t)||t.kind==='device')continue;
      const ally=t.side==='ally';
      if(ally?!b.allySelectable(t,u):t.s.flags.untargetable)continue;
      const side=ally?'ally':'enemy',base=r.speed[`attack_speed_${side}`],extra=r.speed[`attack_speed_${side}_extra`];
      const values=new Map([[`thorn2_t_2_speed_${side}`,base]]);
      if(tiles.has(tileKeyOf(t)))values.set(`thorn2_t_2_${side}_extra`,extra);
      desired.set(t,values);
    }
    // Delete obsolete claims before adding new ones, including changed deployment lives.
    for(const [t,values]of this.auraClaims)for(const key of values.keys())if(!desired.get(t)?.has(key))auraClaim(this,t,key,0);
    for(const [t,values]of desired)for(const [key,value]of values)auraClaim(this,t,key,value);
    this.auraClaims=desired;
  }
  release(t,info){
    const p=this.phase,{u,b}=this;
    if(!this.valid()||!u.canAct||u.s.flags.disarm||!p||p.kind!=='attack'||p.accepted
      ||p.target!==t||p.targetSeq!==t.deploySeq||p.epoch!==u.attackControlEpoch
      ||!this.eligible(t)||b.time+1e-9<p.releaseAt)return false;
    p.accepted=true;
    const seq=t.deploySeq,projectile=b.addProjectile({from:u,target:t,source:u,speed:10,maxAge:10,visual:'bolt',
      data:{arkpediaTrackedVisual:true,thornsOwner:this,thornsKind:'ordinary'},
      onHit:({target})=>{
        // Native _stopWhenSourceInvalid0: receipt does not require a live owner.
        if(b.finished||target!==t||t.deploySeq!==seq||!this.eligible(t))return;
        b.dealDamage(u,t,makeDamageInfo({amount:u.s.atk*u.s.atkScaleMul,type:'arts',isAttack:info.isAttack??true,
          isSkill:!!info.isSkill,attackId:info.attackId??0,applyWay:info.applyWay??'ranged',tags:['thorns:ordinary']}));
      }});
    b.emit('thornsProjectileBirth',{owner:u,target:t,projectile});return true;
  }
  tick(){
    if(!this.valid()){
      if(this.seq!==null&&this.u.alive&&this.u.deployed&&this.seq===this.u.deploySeq&&this.u.hidden){
        this.clearTalents();this.s1?.interrupt('hidden');this.phase=null;return;
      }
      if(this.seq!==null)this.stop();return;
    }
    this.syncTalents();if(!this.valid())return;
    if(this.s1?.tick())return;
    const {u,b}=this;let p=this.phase;
    if(p?.kind==='entrance'){
      if(b.time+1e-9<p.readyAt)return;
      this.phase=null;p=null;
    }
    if(!u.canAct||u.s.flags.disarm||p&&p.epoch!==u.attackControlEpoch){this.phase=null;this.visual(this.idle(),1,true);return;}
    if(p){
      // Source _interuptIfTargetDead0: losing a target suppresses release without
      // cancelling the original clip/cooldown and accelerating the next attack.
      if(!p.released&&b.time+1e-9>=p.releaseAt){
        p.released=true;
        if(this.eligible(p.target)&&p.targetSeq===p.target.deploySeq)b.forceAttack(u,[p.target]);
        if(!this.valid()||this.phase!==p)return;
      }
      if(b.time+1e-9<p.readyAt)return;
      this.phase=null;
    }
    if(u.atkCd>1e-9)return;
    const target=this.targets()[0];if(!target){this.visual(this.idle(),1,true);return;}
    const clip=this.record.index===2?'Skill_3_Loop':'Attack',speed=Math.min(1,u.base.bat/u.s.interval);
    this.phase={kind:'attack',target,targetSeq:target.deploySeq,epoch:u.attackControlEpoch,
      releaseAt:b.time+model(u).eventPayloads[clip].find(e=>e.name==='OnAttack').time/speed,
      readyAt:b.time+Math.max(u.s.interval,model(u).durations[clip]/speed),released:false,accepted:false};
    this.visual(clip,speed);u.atkCd=u.s.interval;
  }
  install(){
    if(this.stopped||this.handles.length)return;
    const {b,u}=this;u.mem.thornsController=this;
    this.handles=[b.on('deploy',({unit,move})=>{if(unit===u&&!move){
      this.seq=u.deploySeq;const clip=this.record.index===2?'Start_2':'Start';
      this.phase={kind:'entrance',readyAt:b.time+model(u).durations[clip]};this.visual(clip);this.syncTalents();
    }},{owner:u}),b.on('tick',()=>this.tick(),{owner:u}),
    b.on('removed',({unit})=>{if(unit===u)this.stop();else if(this.valid())this.syncTalents();},{owner:u}),
    b.on('death',({unit})=>{if(unit===u)this.stop();else if(this.valid())this.syncTalents();},{owner:u}),b.on('battleEnd',()=>this.stop())];
  }
  clearTalents(){
    for(const [t,values]of this.auraClaims)for(const key of values.keys())auraClaim(this,t,key,0);
    this.auraClaims.clear();if(this.atkBuff)this.b.removeBuff(this.u,this.atkBuff);this.atkBuff=null;
  }
  stop(){
    if(this.stopped)return;
    this.stopped=true;this.s1?.ownerStop();this.phase=null;this.clearTalents();
    // Emitted ordinary shots survive owner removal, but never a finished battle.
    if(this.b.finished)this.b.projectiles.remove(p=>p.data?.thornsOwner===this);
    this.u.mem.regularFormVisual=null;delete this.u.mem.regularVisualDirection;
    for(const h of this.handles)this.b.off(h);this.handles=[];
  }
}

export function prepareThornsCore(b,u,{contract}={}){
  const record=validate(u,contract),controller=new ThornsCoreController(b,u,record);
  const kit={trait:{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'arts',projectile:'none',
    hits:1,hitsFn:null,chain:null,splashRadius:0,heal:null,...air,install:null,onHit:null,onEachHit:null,
    requiresAcceptedLaunch:true,attackVisual:'none',launchAttack:(_b,_u,_p,t,info)=>controller.release(t,info)},
    skill:{kind:'instant',trigger:{rule:'NEVER'},canActivate:()=>false},talents:[],install:null};
  return {record,controller,kit};
}

/** Private S1 gameplay review path. Public registration still requires the complete three-skill kit. */
export function prepareThornsS1(b,u,{contract}={}){
  if(contract!==THORNS_S1_CONTRACT)throw Error('Thorns S1 requires the reviewed field contract');
  const prepared=prepareThornsCore(b,u,{contract:THORNS_CORE_CONTRACT});
  if(prepared.record.index!==0)throw Error('Thorns S1 requires the selected first skill');
  const {controller,kit}=prepared;
  controller.s1=new ThornsS1Fields(controller);
  kit.skill={kind:'toggle',trigger:{rule:'NEVER'},manualCancel:false,
    canActivate:()=>controller.s1.canCast(),onStart:()=>controller.s1.start(),onEnd:()=>controller.s1.end()};
  return prepared;
}
