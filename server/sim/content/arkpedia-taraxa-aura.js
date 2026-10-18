// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-native-operators/char_4222_taraxa.json' with {type:'json'};
import {selectedTaraxaInputs, taraxaNativeInputs, taraxaSourceComponent, TARAXA_ID as ID} from './arkpedia-taraxa-source.js';
import {COLS} from '../constants.js';
import {airBlockMode} from '../targeting.js';
export const TARAXA_AURA_CONTRACT=Object.freeze({
  scope:'Selected Taraxacum derived flying-recipient Sanctuary and shared nonstacking block bonus; no healing/flight controller or public admission.',
  mapping:'Original aura entry and block-mode notifications map to living friendly recipients on the current attack grid, refreshed on world ticks and immediately after controller-owned block-mode changes. Native FLY block mode maps to the current explicit block-mode command or the existing ally liftoff flag unless a WALK override is active; flight motion alone does not imply air blocking. Each accepted parent owns one ordinary physical/Arts Sanctuary instance; the common taraxa_t[block] family admits at most one +block buff across sources. Rejected or foreign children are never adopted. Parent loss, range exit, landing and source/recipient life changes remove owned children.',
  limitations:'Native selector masks, per-source parent identity, notification scheduling and buff-family arbitration use explicit local mappings. Compiled-client/frame parity, modules, native particles/audio/shaders and public admission remain unverified.',frameParity:false,
});
const alive=u=>u?.alive&&u.deployed&&!u.removed&&!u._removing;
export const taraxaAirBlocking=airBlockMode;
export function verifyTaraxaAura(n=taraxaNativeInputs()){
 const events=n.templates['taraxa_t[aura]']?.eventToActions,check=events?.ON_BUFF_TRIGGER?.[0];
 const shield=check?._succeedNodes?.[0],block=check?._succeedNodes?.[2];
 const createShield=shield?._failNodes?.[0],createBlock=block?._failNodes?.[0];
 const db=evidence.buffDatabase['damage_resistance[inf]'];
 const validator=taraxaSourceComponent('characters',ID,'-6749640743847331652')._targetOptions;
 if(n.talent._buffs[0]?.buffKey!=='taraxa_t[aura]'||n.talent._buffs[0]?.isSilenceable!==0
  ||n.talent._ignoreOwnerFakeDeath!==0||n.talent._removeBuffWhenTargetLeave!==1||n.talent._removeBuffWhenAbilityDetached!==1
  ||check?._conditionsNode?.[0]?._blockMode!=='FLY'
  ||shield?._conditionsNode?.[0]?._checkBuffSource!==true
  ||block?._conditionsNode?.[0]?._checkBuffSource!==false
  ||createShield?._isDerivedBuff!==true||createShield?._finishDerivedBuffIfParentFinish!==true
  ||createShield?._buff?.buffKey!=='damage_resistance[inf]'||createShield?._buff?.loadFromDB!==true
  ||createBlock?._isDerivedBuff!==true||createBlock?._buff?.buffKey!=='taraxa_t[block]'
  ||createBlock?._buff?.attributes.attributeModifiers[0]?.attributeType!=='BLOCK_CNT'
  ||createBlock?._buff?.attributes.attributeModifiers[0]?.formulaItem!=='ADDITION'
  ||db.buffKey!=='damage_resistance'||db.templateKey!=='damage_resistance'||db.priorityBBKeys.join()!=='damage_resistance'
  ||events?.ON_OWNER_BLOCK_MODE_CHANGED?.[0]?._force!==true||events?.ON_BUFF_ENABLE?.[0]?._force!==true
  ||validator.targetSide!==1||validator.ignoreTargetFree!==0)
  throw Error('Changed original Taraxacum aura inputs');
}
export class TaraxaAura{
 constructor(b,u,{contract}={}){
  if(contract!==TARAXA_AURA_CONTRACT||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Taraxacum and exact aura contract required');
  verifyTaraxaAura();this.b=b;this.u=u;this.record=selectedTaraxaInputs(u);this.bb=this.record.talentBb[0];
  this.seq=null;this.stopped=false;this.records=new Map();this.handles=[];this.scanning=false;
 }
 presentSource(){return !this.stopped&&!this.b.finished&&alive(this.u)&&this.u.deploySeq===this.seq;}
 valid(){return this.presentSource()&&!this.u.hidden;}
 eligible(t){return alive(t)&&!t.hidden&&t.side==='ally'&&t.kind!=='device'&&!t.s.flags.untargetable&&!t.s.flags.sleep
  &&this.b.allySelectable(t,this.u)&&this.u.rangeKeySet.has(t.tileR*COLS+t.tileC);}
 identity(p){return !p.finished&&alive(p.target)&&p.target.deploySeq===p.life&&p.parent?.data?.taraxaParent===p
  &&p.target.findBuff(p.parent.key)===p.parent;}
 removeOwned(t,buff,p){if(buff?.data?.taraxaChild===p&&t.buffs.includes(buff))this.b.removeBuff(t,buff);}
 clearChildren(p){const shield=p.shield,block=p.block;p.shield=p.block=null;
  this.removeOwned(p.target,shield,p);this.removeOwned(p.target,block,p);}
 finish(p){if(p.finished)return;p.finished=true;this.clearChildren(p);
  if(p.parent?.data?.taraxaParent===p&&p.target.buffs.includes(p.parent))this.b.removeBuff(p.target,p.parent);
  if(this.records.get(p.target)===p)this.records.delete(p.target);}
 attach(t){const p={target:t,life:t.deploySeq,parent:null,shield:null,block:null,finished:false};
  p.parent=this.b.addBuff(t,{key:`taraxa_t[aura]:${this.u.id}:${this.seq}`,source:this.u,refresh:'keep',
   data:{taraxaParent:p},onRemove:()=>this.finish(p)});
  if(p.parent?.data?.taraxaParent!==p)return null;
  if(!this.valid()||!this.identity(p)||!this.eligible(t)){this.finish(p);
   // A beforeBuff callback can finish p before addBuff returns its late parent.
   if(t.buffs.includes(p.parent))this.b.removeBuff(t,p.parent);return null;}
  this.records.set(t,p);return p;
 }
 child(p,key,fields){
  const buff=this.b.addBuff(p.target,{key,source:this.u,refresh:'keep',...fields,data:{taraxaChild:p}});
  if(buff?.data?.taraxaChild!==p)return null;
  if(!this.valid()||!this.identity(p)||!this.eligible(p.target)||!taraxaAirBlocking(p.target)){
   this.removeOwned(p.target,buff,p);
   if(!this.valid()||!this.identity(p)||!this.eligible(p.target))this.finish(p);else this.clearChildren(p);return null;}
  return buff;
 }
 refresh(p){
  if(!taraxaAirBlocking(p.target)){this.clearChildren(p);return;}
  if(p.shield&&p.target.findBuff(p.shield.key)!==p.shield)p.shield=null;
  if(p.block&&p.target.findBuff(p.block.key)!==p.block)p.block=null;
  if(!p.shield)p.shield=this.child(p,`damage_resistance:taraxa:${this.u.id}:${this.seq}`,{status:'sanctuary',
   mods:{physTakenMul:1-this.bb.damage_resistance,artsTakenMul:1-this.bb.damage_resistance}});
  if(!this.valid()||!this.identity(p))return;
  if(!p.block&&!p.target.findBuff('taraxa_t[block]'))p.block=this.child(p,'taraxa_t[block]',{mods:{blockCnt:this.bb.block_cnt}});
 }
 tick(){if(this.scanning||!this.valid())return;this.scanning=true;
  try{if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);
   for(const p of [...this.records.values()])if(!this.identity(p)||!this.eligible(p.target))this.finish(p);
   for(const t of this.b.allyUnits){if(!this.valid())break;if(!this.eligible(t))continue;
    const p=this.records.get(t)??this.attach(t);if(p&&this.identity(p))this.refresh(p);
   }
  }finally{this.scanning=false;}
 }
 install(){if(this.stopped||this.handles.length)throw Error('Taraxacum aura cannot be reinstalled');const{b,u}=this;
  this.handles=[b.on('deploy',({unit,move})=>{if(unit===u&&!move){this.seq=u.deploySeq;this.tick();}},{owner:u}),
   b.on('blockModeChanged',()=>this.tick(),{owner:u}),
   b.on('tick',()=>{if(this.seq!==null&&!this.presentSource())this.stop();else if(this.u.hidden)this.clear();else this.tick();},{owner:u}),
   b.on('removed',({unit})=>{if(unit===u)this.stop();else{const p=this.records.get(unit);if(p)this.finish(p);}},{owner:u}),
   b.on('death',({unit})=>{if(unit===u)this.stop();else{const p=this.records.get(unit);if(p)this.finish(p);}},{owner:u}),
   b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 clear(){for(const p of [...this.records.values()])this.finish(p);}
 stop(){if(this.stopped)return;this.stopped=true;this.clear();
  for(const h of this.handles)this.b.off(h);this.handles=[];}
}
