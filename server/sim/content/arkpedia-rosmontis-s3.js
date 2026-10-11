// SPDX-License-Identifier: GPL-3.0-or-later
// Private full S3/equipment adapter; public registration is a separate gate.
import evidence from '../../../data/arkpedia-rosmontis-prefabs.json' with {type:'json'};
import { RosmontisAttackController, validateRosmontisSelection } from './arkpedia-rosmontis-attacks.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { COLS } from '../constants.js';
export const ROSMONTIS_EQUIPMENT='token_10012_rosmon_shield';
export const ROSMONTIS_S3_CONTRACT=Object.freeze({
  placement:'PRECAST legal ground tiles; enemy-root minimum-taunt priority, then nearest other selectable ground enemies, random ties/fallback; zero/one/two tiles never gate mode activation',
  sequence:'equipment first, then selected mode modifiers; original Begin/End hold phases with SP blocked through End',
  targeting:'up to two PRECAST blocked ground/air inputs, owned equipment blockees first; dead/changed-life inputs omitted independently',
  clocks:'selected-S3 base/current interval scales explicit native .17 pre-delay and .15 aftershock delta; capped Loop visual does not hold attacks for the full four-second clip',
  damage:'independent main/half-aftershock circles per input; only each main trace can be airborne; ground splash recipients need not be blocked',
  equipment:'selected token level stats, fixed facing, no deck/DP/slot cost, heal/recovery prohibition; original Start completion maps to zero-ATK ground stun within its source grid',
  limits:'tile filter/ties/nearest geometry, FSM transitions, original Begin/End holds, born-completion/block timing, zero-damage/status order, callback clocks and claim lifecycle are local mappings; compiled frame parity, modules, particles/audio remain unverified',
  frameParity:false,
});
const components=Object.values({...evidence.characters,...evidence.tokens,...evidence.skills,...evidence.projectiles})
  .flatMap(rows=>rows.flatMap(r=>r.components));
const c=id=>components.find(r=>r.pathId===id)?.data;
const attack=c('-525305113394709733'),selector=c('-4062741853108798693');
const mainRadius=c('6641270259893966817').m_Radius,aftershockRadius=c('-7765152505234818704').m_Radius;
const spawn=c('7280470274788913405'),tiles=c('-7679568899476983555');
const tokenRoot=c('4110751172866130270'),block=c('-5764927146475863714');
const tokenModel=evidence.tokenModels[ROSMONTIS_EQUIPMENT].front;
const flat=rows=>Object.fromEntries(rows.map(v=>[v.key,v.value]));
const same=(a,z)=>JSON.stringify(a)===JSON.stringify(z);
const live=u=>u?.alive&&u.deployed&&!u.hidden&&!u._removing;
const ground=(u,e)=>canTargetEnemy(u,e,{groundOnly:true,canHitFly:false});
const grid=id=>evidence.tables.ranges[id].grids.map(v=>[v.row,v.col]);
const model=u=>evidence.models.char_391_rosmon[['UP','LEFT'].includes(u.dir)?'Back':'Front'];
function reviewed(u,contract){
  const r=validateRosmontisSelection(u,contract,ROSMONTIS_S3_CONTRACT,2);
  const paired=evidence.tables.tokenSkills.sktok_rosmon.levels[r.build.skillRank-1];
  const sequence=c('-1685444342655389443');
  if(!same(paired.blackboard,r.source.blackboard)||paired.skillType!=='AUTO'||paired.spData.spCost!==0
    ||!same(sequence._abilities.map(v=>v.m_PathID),['7280470274788913405','2308109288669081853'])
    ||sequence._alwaysNext!==1||attack._waitForAttackEvent!==0||attack._selectTargetTiming!==1
    ||attack._additionalTimes!==1||attack._castToFirstRoundTargetLocationsAtProjectileBirth!==1
    ||attack._preDelay<=0||attack._triggerDelta<=0||attack._maxAnimScale!==1
    ||selector._targetMotion!==3||selector._shrinkNum!==2||selector._pickMyTokenFirst!==1
    ||tiles._filterType!==7||tiles._maxNum!==2||tiles._options.buildableType!==1
    ||tokenRoot._occupiedRemainingCharacterCnt!==0||tokenRoot._notShowInDeck!==1
    ||tokenRoot._isFixedRotation!==1||tokenRoot._useRealBornTimeFromAnim!==1
    ||block._buffsToBlockee[0].attributes.attributeModifiers[0].formulaItem!==0)
    throw Error('Unreviewed Rosmontis S3/equipment source');
  r.tokenBb=flat(paired.blackboard);r.tokenTalent=flat(evidence.tables.token.talents[0].candidates[0].blackboard);
  return r;
}
export class RosmontisEquipment {
  constructor(controller){this.c=controller;this.b=controller.b;this.u=controller.u;
    this.tokens=new Map();this.claims=new Map();this.refreshing=false;this.clearing=false;}
  legal(row,col){
    const b=this.b;if(!Number.isInteger(row)||!Number.isInteger(col)||!b.grid.inRect(row,col))return false;
    const t=b.grid.tile(row,col),o=b._occ[row*COLS+col];
    return t.height==='LOW'&&['MELEE','ALL'].includes(t.build)&&b.grid.groundPassable(row,col)
      &&!(o?.alive&&o.deployed)&&!b.tileReservation(row,col)&&!b.downOn(row,col);
  }
  select(){
    const keys=new Set(absoluteRangeKeys(this.u.rangeGrid,this.u.tileR,this.u.tileC,this.u.dir));
    const enemies=this.b.enemies.filter(e=>ground(this.u,e)&&bodyInKeys(e,keys));
    const rows=[...keys].map(k=>({row:Math.floor(k/COLS),col:k%COLS})).filter(t=>this.legal(t.row,t.col));
    for(const t of rows){
      const on=enemies.filter(e=>Math.round(e.y)===t.row&&Math.round(e.x)===t.col);
      t.tier=on.length?0:enemies.length?1:2;
      t.score=on.length?-Math.min(...on.map(e=>e.s.taunt))
        :enemies.length?Math.min(...enemies.map(e=>Math.hypot(e.x-t.col,e.y-t.row))):0;
      t.tie=this.b.rng();
    }
    rows.sort((a,z)=>a.tier-z.tier||a.score-z.score||a.tie-z.tie||a.row-z.row||a.col-z.col);
    return rows.slice(0,Math.max(0,tiles._maxNum-this.tokens.size));
  }
  definition(){
    const token=evidence.tables.token,phase=token.phases[this.c.record.build.elite],frames=phase.attributesKeyFrames;
    const a=frames[0],z=frames.at(-1),ratio=(this.c.record.build.level-a.level)/(z.level-a.level);
    const stats=Object.fromEntries(Object.entries(a.data).map(([k,v])=>[k,typeof v==='number'?v+(z.data[k]-v)*ratio:v]));
    for(const k of ['maxHp','atk','def'])stats[k]=Math.round(stats[k]);
    return {name:token.name,profession:token.profession,position:token.position,subProfessionId:token.subProfessionId,
      stats,rangeGrid:grid(phase.rangeId),spine:ROSMONTIS_EQUIPMENT,arkpedia:{...this.c.record.build}};
  }
  place(tile){
    const b=this.b,u=this.u;if(this.clearing||!this.c.valid()||!u.skill.active||this.tokens.size>=tiles._maxNum
      ||!tile||!this.legal(tile.row,tile.col))return null;
    const entry={token:null,ready:false,timer:null,cancelled:false};
    const kit={skill:null,trait:{noAttack:true},install:(_b,t)=>{
      entry.token=t;this.tokens.set(t,entry);t.deploymentSlotCost=0;
      t.mem.rosmontisEquipment={owner:u};t.mem.regularFormVisual={clip:'Start',loop:false};
      b.addBuff(t,{key:'rosmontis:equipment-trait',allowDead:true,persist:true,
        flags:{healFree:true,noHeal:true,noSp:true},mods:{hpRegenMul:0}});
      b.addBuff(t,{key:'rosmontis:equipment-born',allowDead:true,flags:{noBlock:true}});
    }};
    const token=b.spawnToken(u,ROSMONTIS_EQUIPMENT,tile.row,tile.col,{def:this.definition(),kit,dir:'RIGHT'});
    if(!token||!live(token)||entry.cancelled||!this.c.valid()||!u.skill.active){
      if(token&&live(token))b.retreat(token,{permanent:true,reason:'rosmontis-placement-cancelled'});
      if(entry.token)this.remove(entry.token);return null;
    }
    b.addBuff(token,{key:'rosmon_token_s3_mark',source:u});
    if(!live(token)||entry.cancelled||!this.c.valid()||!u.skill.active){
      if(live(token))b.retreat(token,{permanent:true,reason:'rosmontis-mark-cancelled'});this.remove(token);return null;
    }
    entry.timer=b.after(tokenModel.durations.Start,()=>this.born(entry),{owner:token});
    b.emit('rosmontisEquipmentSpawn',{owner:u,token});return token;
  }
  born(entry){
    const b=this.b,t=entry.token;if(entry.cancelled||!live(t)||!this.c.valid()||!this.u.skill.active)return;
    entry.ready=true;b.removeBuff(t,'rosmontis:equipment-born');t.mem.regularFormVisual={clip:'Idle',loop:true};
    const keys=new Set(absoluteRangeKeys(t.rangeGrid,t.tileR,t.tileC,t.dir));
    const targets=b.enemies.filter(e=>ground(t,e)&&bodyInKeys(e,keys));
    b.emit('rosmontisEquipmentReady',{owner:this.u,token:t});
    for(const target of targets){
      if(entry.cancelled||!live(t)||b.finished)break;
      if(!ground(t,target))continue;const life=target.deploySeq;
      b.dealDamage(t,target,{amount:0,type:'phys',isAttack:true,isSkill:true,applyWay:'none'});
      if(live(target)&&target.deploySeq===life&&live(t)&&!entry.cancelled&&!b.finished)
        b.applyStatus(target,'stun',{duration:this.c.record.tokenBb.stun,source:t});
    }
    this.sync();
  }
  sync(){
    if(this.refreshing)return;this.refreshing=true;
    try{
      const targets=new Set(this.b.enemies.filter(e=>live(e)&&this.tokens.get(e.blockedBy)?.ready
        &&live(e.blockedBy)&&!this.tokens.get(e.blockedBy).cancelled));
      for(const [e,claim] of this.claims)if(!targets.has(e)||e.deploySeq!==claim.life||e.findBuff(claim.key)!==claim.buff){
        if(e.findBuff(claim.key)===claim.buff)this.b.removeBuff(e,claim.buff);this.claims.delete(e);
      }
      const key=`rosmontis:block-def:${this.u.id}:${this.u.deploySeq}`;
      for(const e of targets)if(!this.claims.has(e)&&!e.findBuff(key)){
        const life=e.deploySeq,buff=this.b.addBuff(e,{key,source:e.blockedBy,mods:{defFlat:this.c.record.tokenTalent.def}});
        if(buff&&live(e)&&e.deploySeq===life&&this.tokens.get(e.blockedBy)?.ready&&live(e.blockedBy)
          &&e.findBuff(key)===buff)this.claims.set(e,{key,buff,life});
        else if(buff&&e.findBuff(key)===buff)this.b.removeBuff(e,buff);
      }
    }finally{this.refreshing=false;}
  }
  remove(token){
    const entry=this.tokens.get(token);if(entry){entry.cancelled=true;entry.timer?.cancel();this.tokens.delete(token);}
    this.sync();
  }
  clear(){
    if(this.clearing)return;this.clearing=true;
    try{for(const [token,entry] of [...this.tokens]){
      entry.cancelled=true;entry.timer?.cancel();this.tokens.delete(token);
      if(live(token))this.b.retreat(token,{permanent:true,reason:'rosmontis-equipment-finish'});
    }this.sync();}finally{this.clearing=false;}
  }
}
export class RosmontisS3Controller extends RosmontisAttackController {
  constructor(...args){super(...args);this.equipment=new RosmontisEquipment(this);this.mode=false;}
  install(){
    if(this.handles.length||this.stopped)return;
    super.install();this.handles.push(this.b.on('blocked',()=>this.equipment.sync(),{owner:this.u}),
      this.b.on('unblocked',()=>this.equipment.sync(),{owner:this.u}),
      this.b.on('death',({unit})=>{if(this.equipment.tokens.has(unit))this.equipment.remove(unit);},{owner:this.u}));
  }
  cancelPhase(reason='control'){
    if(this.phase?.kind==='s3-attack'){this.phase=null;return;}super.cancelPhase(reason);
  }
  start(){
    if(!this.valid())return;this.cancelPhase('mode-switch');
    this.b.removeBuff(this.u,'rosmontis:s3-ending');this.u.atkCd=0;
    const selected=this.equipment.select();for(const tile of selected){
      if(!this.valid()||!this.u.skill.active)break;this.equipment.place(tile);
    }
    if(!this.valid()||!this.u.skill.active){this.equipment.clear();return;}
    this.b.addBuff(this.u,{key:'rosmontis:s3-mode',source:this.u,
      mods:{atkPct:this.record.bb.atk,batPct:this.record.bb.base_attack_time,defMul:this.record.bb.def}});
    if(!this.valid()||!this.u.skill.active){this.b.removeBuff(this.u,'rosmontis:s3-mode');this.equipment.clear();return;}
    this.mode=true;this.epoch=this.u.attackControlEpoch;this.visual('Skill_3_Begin');
    this.phase={kind:'s3-begin',readyAt:this.b.time+model(this.u).durations.Skill_3_Begin};
  }
  end(){
    this.mode=false;this.b.removeBuff(this.u,'rosmontis:s3-mode');this.equipment.clear();this.phase=null;
    if(!this.valid())return;
    this.visual('Skill_3_End');this.b.addBuff(this.u,{key:'rosmontis:s3-ending',source:this.u,flags:{noSp:true}});
    this.phase={kind:'s3-end',readyAt:this.b.time+model(this.u).durations.Skill_3_End};
  }
  targetsS3(){
    const keys=new Set(absoluteRangeKeys(this.u.rangeGrid,this.u.tileR,this.u.tileC,this.u.dir));
    const targets=this.b.enemies.filter(e=>live(e)&&live(e.blockedBy)
      &&canTargetEnemy(this.u,e,{canHitFly:true})&&(!e.s.flags.camou||e.blockedBy)
      &&(bodyInKeys(e,keys)||e.blockedBy===this.u));
    sortEnemyTargets(this.b,this.u,targets);
    targets.sort((a,z)=>Number(this.equipment.tokens.has(z.blockedBy))-Number(this.equipment.tokens.has(a.blockedBy)));
    return targets.slice(0,this.record.bb['attack@max_target']);
  }
  tick(){
    const b=this.b,u=this.u;this.equipment.sync();
    if(!this.valid()){super.tick();return;}
    this.aura.refresh();
    if(['s3-begin','s3-end'].includes(this.phase?.kind)){
      if(b.time+1e-9<this.phase.readyAt)return;
      const ending=this.phase.kind==='s3-end';this.phase=null;
      if(ending)b.removeBuff(u,'rosmontis:s3-ending');this.visual(this.mode?'Skill_3_Loop':'Idle',1,true);
    }
    if(!this.mode||!u.skill.active){super.tick();return;}
    if(!u.canAct||u.s.flags.disarm||this.epoch!==u.attackControlEpoch){
      this.cancelPhase('control');this.epoch=u.attackControlEpoch;this.visual('Stun_Skill_3',1,true);return;
    }
    const p=this.phase;
    if(p){
      if(!p.released&&b.time+1e-9>=p.releaseAt){
        p.released=true;const inputs=p.inputs.filter(v=>live(v.target)&&v.target.deploySeq===v.life).map(v=>v.target);
        if(inputs.length)b.forceAttack(u,inputs);
        if(!this.valid())return;
      }
      if(b.time+1e-9<p.readyAt)return;this.phase=null;
    }
    if(u.atkCd>1e-9)return;
    const targets=this.targetsS3();if(!targets.length){this.visual('Skill_3_Loop',1,true);return;}
    const rate=u.base.bat*(1+this.record.bb.base_attack_time)/u.s.interval;
    this.phase={kind:'s3-attack',inputs:targets.map(target=>({target,life:target.deploySeq})),seq:u.deploySeq,
      epoch:u.attackControlEpoch,rate,accepted:new Set(),released:false,
      releaseAt:b.time+attack._preDelay/rate,readyAt:b.time+u.s.interval};
    this.visual('Skill_3_Loop',Math.min(attack._maxAnimScale,rate),true);u.atkCd=u.s.interval;
  }
  release(target,info){
    const p=this.phase,u=this.u,b=this.b;if(p?.kind!=='s3-attack')return super.release(target,info);
    const input=p.inputs.find(v=>v.target===target);
    if(!this.valid()||!this.mode||!u.skill.active||!u.canAct||u.s.flags.disarm||!info.isSkill
      ||!input||input.life!==target.deploySeq||p.accepted.has(target)||p.epoch!==u.attackControlEpoch
      ||p.seq!==u.deploySeq||b.time+1e-9<p.releaseAt||!canTargetEnemy(u,target,{canHitFly:true}))return false;
    p.accepted.add(target);
    const command={mode:'s3',x:target.x,y:target.y,trace:target,traceLife:target.deploySeq,
      attackId:info.attackId,isSkill:true,cancelled:false,timer:null};this.outputs.add(command);
    command.timer=b.after(attack._triggerDelta/p.rate,()=>{
      this.hitS3(command,1);this.outputs.delete(command);this.releaseFinishHook();
    });
    b.emit('rosmontisS3Birth',{owner:u,command,index:0});this.hitS3(command,0);return true;
  }
  hitS3(command,index){
    const b=this.b,u=this.u;if(b.finished||command.cancelled)return;
    const targets=b.foesInRadius(command.x,command.y,index?aftershockRadius:mainRadius,true).filter(e=>ground(u,e));
    if(!index&&live(command.trace)&&command.trace.deploySeq===command.traceLife&&command.trace.isFlying
      &&canTargetEnemy(u,command.trace,{canHitFly:true}))targets.push(command.trace);
    if(index)b.emit('rosmontisS3Birth',{owner:u,command,index});
    for(const target of targets){
      if(command.cancelled||b.finished)break;
      if(!canTargetEnemy(u,target,{canHitFly:!index&&target===command.trace}))continue;
      b.dealDamage(u,target,{amount:u.s.atk*u.s.atkScaleMul*(index?this.record.bb['attack@append_atk_scale']:1),
        type:'phys',isAttack:true,isSkill:true,isSplash:true,applyWay:'ranged',attackId:command.attackId,
        tags:index?['aftershock']:[]});
    }
  }
  stop(){
    if(this.b.finished&&this.u.skill.active)this.u.skill.end('battle-finish');
    this.mode=false;this.equipment.clear();
    this.b.removeBuff(this.u,'rosmontis:s3-mode');this.b.removeBuff(this.u,'rosmontis:s3-ending');super.stop();
  }
}
export function prepareRosmontisS3(b,u,{contract}={}){
  const record=reviewed(u,contract),controller=new RosmontisS3Controller(b,u,record);
  const kit={trait:{noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'phys',projectile:'none',
    hits:1,hitsFn:null,chain:null,splashRadius:0,heal:null,groundOnly:true,canHitFly:false,
    install:null,afterAttack:null,onHit:null,onEachHit:null,requiresAcceptedLaunch:true,attackVisual:'none',
    launchAttack:(_b,_u,_p,t,info)=>controller.release(t,info)},
    skill:{kind:'duration',duration:record.source.duration,trigger:{rule:'NEVER'},attack:{},
      canActivate:()=>controller.valid()&&!u.skill.active&&u.canAct&&!u.s.flags.disarm&&controller.phase?.kind!=='s3-end',
      onStart:()=>controller.start(),onEnd:()=>controller.end()},talents:[],install:null};
  return {record,controller,kit};
}
