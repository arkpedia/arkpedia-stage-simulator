// SPDX-License-Identifier: GPL-3.0-or-later
// Selected S3 aura only. Charge/respawn and public summon admission are separate.
import evidence from '../../../data/arkpedia-native-operators/char_4230_mcnist.json' with {type:'json'};
import {MCGRAF_ID as TOKEN,mechanistNativeInputs,mechanistSourceComponent} from './arkpedia-mcnist-source.js';
import {selectedMcGrafBuild} from './arkpedia-mcgraf-source.js';
import {canTargetEnemy} from '../targeting.js';
import {bodyDist} from '../body.js';
export const MCGRAF_S3_AURA_CONTRACT=Object.freeze({
 scope:'Selected original McGraf S3 affecting marker, enemy aura marks and decaying final ATK reduction; no charge, token lifecycle or public admission',
 mapping:'An explicit caller attaches the native affecting marker to a currently registered McGraf life during its host S3 activation. Its hidden E2 talent starts at -50% final ATK and adds .025 toward zero each one-second passive interval. Newly entering enemies read the current source value; leaving or losing the aura mark removes only its derived reduction. Existing marks replace their derived child at the source interval, not every rendering tick; a rejected or dispelled child waits for that next interval. Decay belongs to that token ability, not each victim, and does not restart on re-entry. Ground and air bodies participate; camouflage does not block the aura. Independent named Weaken instances choose the strongest live value and retain other sources for fallback. Owner mode exit, source/token retirement, marker removal and battle end clean only this instance.',
 limits:'The negative native triggerInterval maps to the selected interval operand with waitFirstTriggerInterval respected. World-time cadence, body-radius geometry, target legality and explicit invulnerability refusal for the missable derived buff, named-Weaken composition, admission ordering and marker/derived-buff cleanup are local mappings. This component does not deploy, charge, relocate, respawn or time out McGraf, and cannot admit owner S3 or a public operator. Native C# dispatch, particle/audio, modules and original game-frame/pixel parity remain unverified.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const nodeType=n=>n.$type.split('+')[1].split(',')[0];
function verify(){const n=mechanistNativeInputs(),c=id=>mechanistSourceComponent('tokens',TOKEN,id),area=c('-5394773317144918733'),passive=area._passiveBuffs[0],
 trigger=n.templates.mcgraf_s_3_trigger.eventToActions.ON_BUFF_TRIGGER,mark=n.templates.mcgraf_s_3_mark.eventToActions,aura=n.templates.mcgraf_s_3_trigger_aura.eventToActions.ON_BUFF_START;
 const attr=evidence.buffDatabase['attr_down[atk][inf]'],validator=c('2892683410138023219')._targetOptions;
 if(c('4997574520685806899')._abilities[0].m_PathID!=='-5394773317144918733'||c('655897344156517683')._buffKey!=='mcnist_s_3_affecting'
  ||area._removeBuffWhenTargetLeave!==1||area._removeBuffWhenAbilityDetached!==1||area._buffs[0].disableOverride!==1
  ||area._buffs[0].templateKey!=='mcgraf_s_3_mark'||passive.templateKey!=='mcgraf_s_3_trigger'||passive.triggerInterval!==-1||passive.waitFirstTriggerInterval!==1
  ||validator.targetMotion!==3||validator.ignoreTargetFree!==0||validator.targetSide!==2
  ||trigger[0]._inputKey!=='atk'||trigger[0]._outputKey!=='atk'||trigger[0]._addParamKey!=='atk_interval'||trigger[0]._maxValueKey!=='atk_min'
  ||trigger[1]._targetOptions.targetMotion!=='ALL'||trigger[1]._targetOptions.ignoreTargetFree!==false
  ||mark.ON_BUFF_START[0]._buffKey!=='mcgraf_s_3_trigger'||mark.ON_BUFF_START[1]._isDerivedBuff!==true||nodeType(mark.ON_BUFF_FINISH[0])!=='FinishDerivedBuff'
  ||aura[0]._checkBuffSource!==true||aura[1]._condType!=='LT'||aura[2]._filterBuffBySource!==true||aura[2]._useSnapshotSource!==true
  ||attr.attributes.attributeModifiers[0].formulaItem!=='FINAL_SCALER'||attr.isDamageMissable!==true)throw Error('Changed native McGraf S3 aura graph');
}
export function prepareMcGrafS3Aura(b,t,{contract,barriers}={}){
 const u=t?.ownerUnit;
 if(contract!==MCGRAF_S3_AURA_CONTRACT||barriers!==u?.mem.mcnistBarriers||barriers?.b!==b||!barriers?.valid()
  ||barriers.record.index!==2||!u.skill.active||!present(t)||t.def.charId!==TOKEN||t.ownerId!==u.ownerId
  ||barriers.tokens.get(t)?.life!==t.deploySeq||t.mem.mcgrafS3Aura&&!t.mem.mcgrafS3Aura.stopped)throw Error('Current registered McGraf, active selected host S3 and explicit aura contract required');
 verify();const record=selectedMcGrafBuild(barriers.record.build),bb=record.talentBb.find(bb=>'atk_interval'in bb);
 if(!bb||bb.atk!==-.5||bb.interval!==1||bb.atk_interval!==.025||bb.atk_min!==0||bb.range_radius!==1.5)throw Error('Changed selected McGraf S3 hidden talent');
 const aura=new McGrafS3Aura(b,t,barriers,bb);t.mem.mcgrafS3Aura=aura;return aura;
}
export class McGrafS3Aura{
 constructor(b,t,barriers,bb){Object.assign(this,{b,t,u:t.ownerUnit,barriers,bb,life:t.deploySeq,ownerLife:t.ownerUnit.deploySeq,activation:t.ownerUnit.skill.activations,
  bornAt:b.time,steps:0,value:bb.atk,stopped:false,installed:false,marker:null,entries:new Map(),pending:new Map(),handles:[],serial:0});
  t.mem.mcgrafS3AuraSeq=(t.mem.mcgrafS3AuraSeq??0)+1;this.key=`mcgraf:s3:${t.id}:${this.life}:${this.activation}:${t.mem.mcgrafS3AuraSeq}`;
 }
 valid(){return !this.stopped&&!this.b.finished&&this.barriers.valid()&&this.u.deploySeq===this.ownerLife&&this.u.skill.active&&this.u.skill.activations===this.activation
  &&present(this.t)&&this.t.deploySeq===this.life&&this.barriers.tokens.get(this.t)?.life===this.life&&this.t.mem.mcgrafS3Aura===this;}
 active(){return this.valid()&&this.marker!=null&&this.t.findBuff(this.key)===this.marker;}
 legal(t){return t.side!==this.t.side&&canTargetEnemy(this.t,t,{canHitFly:true})&&bodyDist(t,this.t.x,this.t.y)<=this.bb.range_radius+1e-8;}
 current(e){return this.active()&&this.entries.get(e.target)===e&&e.target.deploySeq===e.life&&this.legal(e.target)&&e.target.findBuff(e.key)===e.mark;}
 forget(e){if(this.entries.get(e.target)===e)this.entries.delete(e.target);e.serial=++this.serial;
  const weak=e.weak;e.weak=null;if(weak)this.b.removeBuff(e.target,weak);
 }
 remove(e){this.forget(e);if(e.mark)this.b.removeBuff(e.target,e.mark);}
 derive(e){if(!this.current(e)||e.applying||e.lastStep===this.steps)return;const value=this.value;e.lastStep=this.steps;
  if(value>=0||e.target.s.flags.invulnerable){if(e.weak)this.b.removeBuff(e.target,e.weak);e.weak=null;return;}
  if(e.weak&&e.target.buffs.includes(e.weak)&&e.weak.data.value===-value)return;
  // The source trigger first removes its previous attribute child. Never
  // remove another producer's Weaken or a newer mark from a callback.
  if(e.weak)this.b.removeBuff(e.target,e.weak);e.weak=null;
  if(!this.current(e))return;const serial=e.serial=++this.serial,remove=()=>{};
  this.pending.set(remove,{e,serial,derived:true,value});let buff;e.applying=true;
  try{buff=this.b.addBuff(e.target,{key:`${e.key}:atk`,source:this.t,status:'weaken',visible:true,mods:{atkMul:1+value},data:{value:-value},onRemove:remove});}
  finally{this.pending.delete(remove);e.applying=false;}
  if(!buff)return;
  if(!this.current(e)||serial!==e.serial||this.value!==value||e.target.s.flags.invulnerable){this.b.removeBuff(e.target,buff);return;}e.weak=buff;
 }
 enter(t){if(this.entries.has(t)||!this.active()||!this.legal(t))return;
  const e={target:t,life:t.deploySeq,key:`${this.key}:mark`,mark:null,weak:null,serial:++this.serial,lastStep:-1};this.entries.set(t,e);
  const remove=({buff})=>{if(e.mark===buff)this.forget(e);};this.pending.set(remove,{e,serial:e.serial,derived:false});let mark;
  try{mark=this.b.addBuff(t,{key:e.key,source:this.t,onRemove:remove});}finally{this.pending.delete(remove);}
  e.mark=mark;if(!mark||!this.current(e)){this.remove(e);return;}this.derive(e);
 }
 tick(){if(this.ticking)return;this.ticking=true;try{this.update();}finally{this.ticking=false;}}
 update(){if(!this.active()){this.stop();return;}
  this.steps=Math.max(this.steps,Math.floor((this.b.time-this.bornAt+1e-8)/this.bb.interval));
  this.value=Math.min(this.bb.atk_min,this.bb.atk+this.steps*this.bb.atk_interval);
  for(const e of [...this.entries.values()]){if(!this.current(e))this.remove(e);else this.derive(e);}
  if(!this.active()){this.stop();return;}for(const t of this.b.foesInRadius(this.t.x,this.t.y,this.bb.range_radius)){if(!this.active())break;this.enter(t);}
  if(!this.active())this.stop();
 }
 install(){if(this.installed||!this.valid())throw Error('McGraf S3 aura requires one live installation');this.installed=true;
  const b=this.b;this.handles=[b.on('beforeBuff',c=>{const p=this.pending.get(c.buff.onRemove);if(!p)return;const{e,serial,derived}=p;
    if(!this.active()||this.entries.get(e.target)!==e||e.serial!==serial||e.target.deploySeq!==e.life||!this.legal(e.target)
     ||derived&&(!this.current(e)||e.target.s.flags.invulnerable||p.value!==this.value))c.cancel=true;
   },{owner:this.t,priority:-1000000}),b.on('tick',()=>this.tick(),{owner:this.t}),
   b.on('removed',({unit})=>{if(unit===this.t||unit===this.u)this.stop();else{const e=this.entries.get(unit);if(e)this.remove(e);}},{owner:this.t}),
   b.on('death',({unit})=>{if(unit===this.t||unit===this.u)this.stop();else{const e=this.entries.get(unit);if(e)this.remove(e);}},{owner:this.t}),
   b.on('skillEnd',({unit})=>{if(unit===this.u)this.stop();},{owner:this.t}),b.on('battleEnd',()=>this.stop(),{owner:this.t})];
  const marker=b.addBuff(this.t,{key:this.key,source:this.t,onRemove:({buff})=>{if(this.marker===buff)this.stop();}});
  if(!marker||!this.valid()){if(marker)b.removeBuff(this.t,marker);this.stop();return false;}this.marker=marker;this.tick();return this.active();
 }
 stop(){if(this.stopped)return;this.stopped=true;for(const h of this.handles)this.b.off(h);this.handles=[];
  for(const e of [...this.entries.values()])this.remove(e);const old=this.marker;this.marker=null;if(old)this.b.removeBuff(this.t,old);
 }
}
