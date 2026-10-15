// SPDX-License-Identifier: GPL-3.0-or-later
// Selected source resources; original cast clocks and tile selection belong to the caller.
import {THUMPY_ID as ID,selectedThumpyBuild,thumpyNativeInputs} from './arkpedia-thumpy-source.js';
import {normalizeChess,normSpType} from '../simdata.js';
import {isHpLoss,hasHp} from '../damage.js';
import {canTargetEnemy,enemyStealthed} from '../targeting.js';
import {bodyInKeys} from '../body.js';
import {dirVec} from '../dir.js';
import {registerBerryProtection} from './arkpedia-five-star-medic-second.js';
export const THUMPY_RESOURCE_CONTRACT=Object.freeze({
 scope:'Selected Thumpy elemental intake/physical injury, source-derived burst marks, permanent DEF/barrier, three mode buffs, glue/conveyor recipient effects; no attack/cast/public admission',
 mapping:'Accepted HP-damage receipts (including fully shielded hits, excluding HP loss and gauge receipts) attach the second-talent mark before the physical talent rider. Physical output uses current ATK, or shortens an existing erosion recovery lock. Source-specific derived marks observe any later erosion burst while their parent remains. Selected thirty-stack talent cap takes priority over the raw twenty-stack template. Initial/forced shield dispatch is coalesced to one selected increment per burst, with a fresh current-max-HP cap; native creation order is not certified. The caller begins/ends the selected mode and supplies independently reviewed captured tiles at the original release. Ground field bodies plus own blockees receive immediate periodic children using the selected interval. S2 other-operator physical hit dispatch runs before dodge; cancelled hits are not filtered by that native node. S3 adds a permanent shared DEF cut before erosion burst effects and moves eligible unblocked bodies at the selected speed through the shared collision/route-aware mover.',
 limits:'Table-versus-template stack priority, coalesced first shield grant, mark-before-rider order, accepted-output versus native modifier dispatch, pre-dodge glue callback ordering, expiry-frame pulses, tile/body aliases and conveyor collision/force immunity are explicit local mappings. Original cast clocks, S2 flood/seed and S3 tile selection, attack targeting/push, modules, particles/shaders/audio and game-frame/pixel parity remain unverified; this diagnostic layer does not admit Thumpy publicly.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hpType=type=>['phys','arts','true','elemental'].includes(type);
export function prepareThumpyResources(b,u,{contract}={}){
 if(contract!==THUMPY_RESOURCE_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.thumpyResources)throw Error('Fresh selected Thumpy and explicit resource contract required');
 const r=selectedThumpyBuild({...u.def.raw.arkpedia,skillId:u.def.skill?.id}),s=u.def.skill;
 if(u.def.raw.arkpedia.skillId!=null&&u.def.raw.arkpedia.skillId!==s.id||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
  ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,r.tags)||!same(u.def.talents.map(t=>t.bb),r.talentBb)
  ||!same(s.bb,r.bb)||s.skillType!==r.source.skillType||s.durationType!==r.source.durationType||s.spType!==normSpType(r.source.spData.spType)
  ||s.spCost!==r.source.spData.spCost||s.initSp!==r.source.spData.initSp||s.duration!==r.source.duration
  ||s.maxCharges!==r.source.spData.maxChargeTime||!same(s.rangeGrid??[],r.skillRangeGrid))throw Error('Incomplete Thumpy selected resource inputs');
 const n=thumpyNativeInputs(),t=n.templates,burst=t['thumpy[water_break_detect]'].eventToActions.ON_BEFORE_EP_BREAK_START,
  rider=t['thumpy[t_2]'].eventToActions.ON_AFTER_OUTPUT_DAMAGE;
 if(n.talent1._buffs[0].templateKey!=='thumpy[t_2]'||n.talent2._buffs[0].templateKey!=='thumpy[t_1]'
  ||rider[0]._damageMask!=='PHYSICAL'||rider[1]._conditionNode._elementType!=='WATER'
  ||rider[1]._succeedNodes[0]._durationSecondsKey!=='duration_dec'||rider[1]._failNodes[0]._epDamageScale!=='ep_damage_ratio[trigger]'
  ||burst[0]._recoveryType!=='WATER'||burst[1]._buff.maxStackCnt!==20||burst[1]._isDerivedBuff!==false
  ||!burst[3]._forceTrigger||n.s1Buff._waitForCasting!==0||n.s2Buff._waitForCasting!==0||n.s3Buff._waitForCasting!==0
  ||!same(n.conveyorImmunity._buffs,['immune_shu_blink','immune_yu_blink'])||n.conveyorMass._massLevelBlackboardKey!=='mass_level'||n.conveyorMass._compareType!==1
  ||n.glue._removeBuffWhenTargetLeave!==1||n.conveyor._removeBuffWhenAbilityDetached!==1||n.glueValidator._targetOptions.targetMotion!==1)
  throw Error('Unreviewed Thumpy native resource graph');
 if(r.index>0){const copied=n.transfer._config.filter(x=>x._skillIndices.includes(r.index));
  for(const key of r.index===1?['interval','atk_scale','ep_damage_ratio[trigger]','ep_damage_ratio[damage]']:['interval','atk_scale','ep_damage_ratio[trigger]','conveyor_speed','mass_level','thumpy[ep_break_water].def'])
   if(!copied.some(x=>x._sourceKey===key&&x._targetKey===key&&x._targetTalentKey===String(r.index+2)))throw Error('Missing Thumpy hidden-talent transfer');}
 const resources=new ThumpyResources(b,u,r);u.mem.thumpyResources=resources;return resources;
}
export class ThumpyResources{
 constructor(b,u,record){this.b=b;this.u=u;this.record=record;this.seq=null;this.stopped=false;this.handles=[];
  this.first=record.talentBb.find(t=>'ep_damage_scale'in t);this.second=record.talentBb.find(t=>'shield_value'in t);
  this.parents=[null,null];this.parentKeys=[`thumpy:t1:${u.id}`,`thumpy:t2:${u.id}`];this.markKey=`thumpy:mark:${u.id}`;
  this.defKey=`thumpy:def:${u.id}`;this.shieldKey=`thumpy:shield:${u.id}`;this.modeKey=`thumpy:mode:${u.id}`;
  this.fieldKey=`thumpy:field:${u.id}`;this.marks=new Map();this.children=new Map();this.tiles=new Set();
  this.mode=0;this.modeBuff=null;this.fieldReleased=false;this.fieldDir=u.dir;this.protection=null;this.bursts=0;this.pulses=0;this.moved=0;
 }
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 parent(index){return this.valid()&&this.parents[index]!=null&&this.u.findBuff(this.parentKeys[index])===this.parents[index];}
 mark(target){if(!this.parent(1)||!present(target)||target.side!=='enemy')return;
  const old=this.marks.get(target);if(old&&old.life===target.deploySeq&&target.findBuff(this.markKey)===old.buff)return;
  if(old)this.clearMark(target);const life=target.deploySeq,buff=this.b.addBuff(target,{key:this.markKey,source:this.u});
  if(!this.parent(1)||!present(target)||target.deploySeq!==life){if(buff)this.b.removeBuff(target,buff);return;}
  if(buff)this.marks.set(target,{life,buff});
 }
 clearMark(t){const p=this.marks.get(t);if(!p)return;this.marks.delete(t);this.b.removeBuff(t,p.buff);}
 clearMarks(){for(const t of [...this.marks.keys()])this.clearMark(t);}
 injury(target,ratio,tag){if(!this.valid()||!(ratio>0)||!hasHp(target))return;
  this.b.dealDamage(this.u,target,{amount:this.u.s.atk*ratio,type:'element',element:'erosion',canDodge:false,isAttack:false,
   isSkill:this.mode>0,applyWay:'none',tags:[tag]});
 }
 output({source,target,dmg,type}){if(source!==this.u||!this.valid()||!hpType(type)||isHpLoss(dmg)||dmg?.cancel)return;
  this.mark(target);
  if(type!=='phys'||!this.parent(0)||!hasHp(target))return;
  const lock=target.findBuff('erosionBurst');
  if(lock){lock.timeLeft=Math.max(0,lock.timeLeft-this.first.duration_dec);if(lock.timeLeft<=1e-9)this.b.removeBuff(target,lock);}
  else this.injury(target,this.first['ep_damage_ratio[trigger]'],'thumpy:talent-injury');
 }
 grant(){if(!this.parent(1)||!this.second)return;
  const{b,u,second:t}=this;b.addBuff(u,{key:this.defKey,source:u,stacks:1,maxStacks:t.max_stack_cnt,refresh:'stack',mods:{defFlat:t.def},visible:true});
  if(!this.parent(1))return;
  const value=Math.min(u.s.maxHp*t.scale,(u.findBuff(this.shieldKey)?.shield??0)+t.shield_value);
  const buff=b.addBuff(u,{key:this.shieldKey,source:u,shield:value,visible:true});
  if(!this.parent(1)){if(buff)b.removeBuff(u,buff);return;}
  if(buff){buff.shield=value;u.markDirty();}this.bursts++;
 }
 burst({target,element}){if(!this.valid()||element!=='erosion')return;
  if(this.mode===3&&this.child(target))this.b.addBuff(target,{key:'thumpy[ep_break_water]',source:this.u,
   refresh:'stack',stacks:1,maxStacks:1e6,mods:{defFlat:this.record.bb['thumpy[ep_break_water].def']},visible:true});
  const m=this.marks.get(target);if(this.parent(1)&&m&&m.life===target.deploySeq&&target.findBuff(this.markKey)===m.buff)this.grant();
 }
 beginMode(){if(!this.valid()||this.mode)return false;const mode=this.record.index+1,{b,u,record:r}=this;
  const buff=b.addBuff(u,{key:this.modeKey,source:u,mods:{atkPct:r.bb.atk,defPct:r.bb.def,...(mode===3?{blockCnt:r.bb.block_cnt}:{})},
   onRemove:({buff})=>{if(this.modeBuff===buff)this.endMode();}});
  if(!this.valid()){if(buff)b.removeBuff(u,buff);return false;}
  if(!buff)return false;this.modeBuff=buff;this.mode=mode;return true;
 }
 releaseField(tiles){if(!this.valid()||this.mode<2||this.fieldReleased)return false;
  if(!Array.isArray(tiles)||tiles.length>this.record.bb.max_cnt||tiles.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isInteger)
    ||!this.b.grid.inRect(...p)||!this.b.grid.groundPassable(...p)||this.b.grid.tile(...p).height!=='LOW'))throw Error('Unreviewed Thumpy field tiles');
  const keys=tiles.map(([r,c])=>r*this.b.grid.cols+c);if(new Set(keys).size!==keys.length)throw Error('Duplicate Thumpy field tile');
  this.tiles=new Set(keys);this.fieldReleased=true;this.fieldDir=this.u.dir;this.tick(0);return true;
 }
 child(t){const p=this.children.get(t);return this.valid()&&this.mode>=2&&this.fieldReleased&&p&&p.life===t.deploySeq&&t.findBuff(this.fieldKey)===p.buff?p:null;}
 covered(t){return present(t)&&t.side==='enemy'&&!t.isFlying&&(t.blockedBy===this.u||bodyInKeys(t,this.tiles));}
 recipients(){return this.b.enemies.filter(t=>this.covered(t)&&canTargetEnemy(this.u,t,{canHitFly:false}));}
 clearChild(t){const p=this.children.get(t);if(!p)return;this.children.delete(t);this.b.removeBuff(t,p.buff);}
 pulse(t,p){if(!this.child(t)||this.children.get(t)!==p||t.hidden||t.s.flags.hidden||t.s.flags.invulnerable||enemyStealthed(t))return;
  const{b,u,record:r}=this;this.pulses++;
  if(this.mode===2)b.applyStatus(t,'sluggish',{duration:r.bb.sluggish,source:u});
  if(!this.child(t))return;
  b.dealDamage(u,t,{amount:u.s.atk*r.bb.atk_scale,type:'phys',isAttack:false,isSkill:true,canDodge:true,applyWay:'none',tags:['thumpy:field']});
  if(this.child(t))this.injury(t,r.bb['ep_damage_ratio[trigger]'],'thumpy:field-injury');
 }
 glueHit({source,target,dmg}){if(this.mode!==2||!this.child(target)||source===this.u||source?.kind!=='op'||source.side!=='ally'||dmg.type!=='phys')return;
  this.injury(target,this.record.bb['ep_damage_ratio[damage]'],'thumpy:glue-ally-injury');
 }
 tick(dt){if(!this.valid())return;
  for(const[t,m]of this.marks)if(!this.parent(1)||!present(t)||t.deploySeq!==m.life||t.findBuff(this.markKey)!==m.buff)this.clearMark(t);
  if(!this.mode||this.u.findBuff(this.modeKey)!==this.modeBuff){if(this.mode)this.endMode();return;}
  if(this.mode<2||!this.fieldReleased)return;
  const active=new Set(this.recipients());for(const t of this.children.keys())if(!active.has(t))this.clearChild(t);
  for(const t of active){if(!this.valid()||this.mode<2||!this.fieldReleased)break;let p=this.children.get(t);
   if(!p||!this.child(t)){if(p)this.clearChild(t);p={life:t.deploySeq,buff:null,next:this.b.time+this.record.bb.interval};
    const buff=this.b.addBuff(t,{key:this.fieldKey,source:this.u});p.buff=buff;
    if(!buff||!this.valid()||this.mode<2||!this.covered(t)||t.deploySeq!==p.life){if(buff)this.b.removeBuff(t,buff);continue;}
    this.children.set(t,p);this.pulse(t,p);
   }else while(this.child(t)&&this.b.time+1e-7>=p.next){p.next+=this.record.bb.interval;this.pulse(t,p);}
  }
  if(this.mode===3&&dt>0){const[dr,dc]=dirVec(this.fieldDir);
   for(const t of [...this.children.keys()])if(this.child(t)&&!t.blockedBy&&t.weight<=this.record.bb.mass_level&&!t.findBuff('immune_shu_blink')&&!t.findBuff('immune_yu_blink')&&bodyInKeys(t,this.tiles))
    this.moved+=this.b.displace(t,{x:-dc,y:-dr},this.record.bb.conveyor_speed*dt);
  }
 }
 endMode(){this.mode=0;this.fieldReleased=false;this.tiles.clear();for(const t of [...this.children.keys()])this.clearChild(t);
  const buff=this.modeBuff;this.modeBuff=null;if(buff)this.b.removeBuff(this.u,buff);}
 install(){if(this.handles.length||this.stopped)throw Error('Thumpy resources cannot be reinstalled');
  this.handles.push(this.b.on('deploy',({unit,move})=>{if(unit!==this.u||move)return;this.seq=unit.deploySeq;
   for(const[index,t]of [[0,this.first],[1,this.second]])if(t){const buff=this.b.addBuff(unit,{key:this.parentKeys[index],source:unit,
     onRemove:()=>{if(index===1)this.clearMarks();else this.protection?.();}});
    if(!this.valid()){if(buff)this.b.removeBuff(unit,buff);return;}this.parents[index]=buff;}
   this.protection?.();},{owner:this.u}),this.b.on('damaged',c=>this.output(c),{owner:this.u}),
   this.b.on('hit',c=>this.glueHit(c),{owner:this.u,priority:0}),this.b.on('elementBurst',c=>this.burst(c),{owner:this.u}),
   this.b.on('tick',({dt})=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick(dt);},{owner:this.u}),
   this.b.on('death',({unit})=>{if(unit===this.u)this.stop();else{this.clearMark(unit);this.clearChild(unit);}},{owner:this.u}),
   this.b.on('removed',({unit})=>{if(unit===this.u)this.stop();else{this.clearMark(unit);this.clearChild(unit);}},{owner:this.u}),
   this.b.on('battleEnd',()=>this.stop(),{owner:this.u}));
  if(this.first)this.protection=registerBerryProtection(this.b,this.u,1-this.first.ep_damage_scale,a=>a===this.u,()=>this.parent(0),{self:true});
 }
 stop(){if(this.stopped)return;this.stopped=true;for(const h of this.handles)this.b.off(h);this.handles=[];
  this.endMode();this.clearMarks();for(const key of [...this.parentKeys,this.defKey,this.shieldKey])this.b.removeBuff(this.u,key);
  this.parents=[null,null];this.protection?.remove();}
}
