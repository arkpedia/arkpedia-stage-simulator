// SPDX-License-Identifier: GPL-3.0-or-later
// Selected original recipient resources; owner throwing/ordinary attacks stay held.
import e from '../../../data/arkpedia-native-operators/char_4215_buddy.json' with {type:'json'};
import {reconNativeInputs} from './arkpedia-recon-source.js';
import {preparePalamuteBirth,PALAMUTE_BIRTH_CONTRACT} from './arkpedia-palamute-birth.js';
export const RECON_BOMBS_CONTRACT=Object.freeze({
 scope:'Selected Recon three-bomb stock, source-derived recipient markers/bombs, allied-damage detonation, Physical explosion, independent stun, DP and own-point trait; owner throwing/ordinary attacks and public admission remain held',
 mapping:'The first three distinct marked recipients consume one bomb each per owner life. Source graph ordering spends stock before bomb and marker attachment, with no invented refund after veto/expiry/detonation. The explicit CreateBuff receiver does not repeat selector checks after capture. A marker survives its thirty-second bomb. Each source bomb accepts an emitted non-element HP-damage receipt from another allied source, including zero after shields, never its owner, an enemy or a sourceless receipt. The guard is set before recursive explosion damage. The explosion reads current owner ATK, then independently attempts resistable stun and grants one DP even if its victim died or was replaced; a later recipient life cannot inherit the old stun. Source loss cancels remaining actions. Its own active Palamute blocking the receiver scales owner damage by the original trait before mitigation. Derived bombs/markers and the shared live-bomb counter drain with the owner parent; already accepted independent stuns keep their own lifetime.',
 limits:'Native ON_TAKE_DAMAGE-to-shared receipt dispatch, zero/element boundaries, default override cleanup, source parent identity, veto/reentrant reservations, damage/status/DP callback ordering and target-death completion are explicit local mappings. Native audio-count state is tracked without delivering its audio. Damage retains normal dodge; status attachment is independent. Owner mode/attack/projectile integration, original art/data admission, native effects/audio, modules, physical devices and game-frame/pixel parity remain unverified.',
 frameParity:false,
});
const globals=new WeakMap(),present=u=>u?.alive&&u.deployed&&!u._removing;
function verify(){const n=reconNativeInputs(),tryAdd=n.templates['buddy[try_add_boom]'].eventToActions.ON_BUFF_START[0],branch=tryAdd._failNodes[0],nodes=branch._failNodes,boom=n.templates['buddy[boom]'].eventToActions,trigger=boom.ON_TAKE_DAMAGE[0]._succeedNodes[0];
 const actions=trigger._failNodes,damage=actions[2]._conditionNode,stun=actions[3],trait=n.templates.buddy_tr_1.eventToActions.ON_CALCULATE_DAMAGE;
 if(tryAdd._conditionNode._buffKey!=='buddy[boom_cnt]'||tryAdd._conditionNode._stackCountKey!=='max_boom_cnt'||tryAdd._conditionNode._condType!=='GE'||tryAdd._succeedNodes[0]._modeIndex!==0
  ||branch._conditionNode._buffKeys.join()!=='buddy[marker]'||!branch._conditionNode._checkBuffSource
  ||nodes.slice(0,3).map(c=>c._buff?.buffKey).join()!=='buddy[boom_cnt],buddy[boom],buddy[marker]'
  ||nodes[1]._buff.durationKey!=='boom_duration'||!nodes[1]._buff.independentCharacterSource||nodes[1]._buff.isDamageMissable!==false
  ||boom.ON_BUFF_START[0]._buffKey!=='buddy_tr_1'||!boom.ON_BUFF_START[0]._finishDerivedBuffIfParentFinish
  ||n.templates['buddy[marker]'].eventToActions.ON_BUFF_START[0]._buffKey!=='buddy_tr_1'
  ||trigger._conditionNode._target1!=='MODIFIER_SOURCE'||trigger._conditionNode._target2!=='BUFF_SOURCE'
  ||actions[0]._sideMask!=='ALLY'||actions[1]._blackboardKey!=='boom_triggerred'||actions[1]._value!==1
  ||damage._damageType!=='PHYSICAL'||damage._attackType!=='BUFF'||damage._sourceType!=='BUFF_SOURCE'||damage._atkScaleVar!=='atk_scale_boom'
  ||stun._isDerivedBuff!==false||stun._buff.durationKey!=='stun_duration'||stun._buff.attributes.abnormalFlags.join()!=='STUNNED'
  ||actions[4]._blackboardKey!=='cost'||actions[4]._sourceType!=='BUFF_SOURCE'
  ||trait[0]._checkBlockedBySourceToken!==true||trait[1]._atkScaleKey!=='atk_scale'||trait[1]._filterApplyWay!==false)throw Error('Changed original Recon bomb/trait resource graph');
 const scale=e.tables.character.trait.candidates[0].blackboard.find(p=>p.key==='atk_scale')?.value;if(scale!==1.5)throw Error('Changed original Recon trait scale');return scale;
}
export function prepareReconBombs(b,u,{contract}={}){
 if(contract!==RECON_BOMBS_CONTRACT)throw Error('Exact selected Recon bomb contract required');verify();
 const prepared=preparePalamuteBirth(b,u,{contract:PALAMUTE_BIRTH_CONTRACT}),resources=new ReconBombs(prepared.controller);prepared.kit.install=()=>resources.install();return{...prepared,resources};
}
export class ReconBombs{
 constructor(point){Object.assign(this,{point,b:point.b,u:point.u,record:point.ownerRecord,seq:null,parent:null,count:0,bombs:new Map(),markers:new Map(),pending:new Set(),handles:[],stopped:false});
  this.traitScale=verify();this.bb=this.record.talentBb[1];if(this.bb.max_cnt!==3||this.bb['attack@max_boom_cnt']!==3||this.bb['attack@cost']!==1||this.bb['attack@boom_duration']!==30)throw Error('Changed selected Recon bomb stock');
  if(!globals.has(this.b))globals.set(this.b,{count:0});this.global=globals.get(this.b);
 }
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.u.deploySeq===this.seq&&!!this.parent&&this.u.findBuff(this.parent.key)===this.parent;}
 get remaining(){return Math.max(0,this.bb.max_cnt-this.count);}
 // This is an explicit captured receiver, not another selector. The original
 // CreateBuff graph does not re-run TargetFree/stealth/sleep acquisition here.
 target(t){return present(t)&&t.kind==='enemy'&&t.side==='enemy';}
 marked(t){const m=this.markers.get(t);if(!m)return false;if(t.deploySeq!==m.life||t.findBuff(m.buff.key)!==m.buff){this.dropMarker(t,m);return false;}return true;}
 key(t,kind){return`recon:${kind}:${this.u.id}:${this.seq}:${t.id}:${t.deploySeq}`;}
 dropBomb(c){if(!c)return;if(c.counted){c.counted=false;this.global.count--;}if(this.bombs.get(c.target)===c)this.bombs.delete(c.target);}
 dropMarker(t,m){if(this.markers.get(t)===m)this.markers.delete(t);if(m?.buff)this.b.removeBuff(t,m.buff);}
 attach(t){if(!this.valid()||!this.target(t)||!this.remaining||this.marked(t)||this.pending.has(t))return false;
  const life=t.deploySeq,c={target:t,life,triggered:false,counted:false,buff:null};this.count++;this.pending.add(t);
  try{
   const old=this.bombs.get(t);if(old)this.b.removeBuff(t,old.buff);
   if(!this.valid()||!this.target(t)||t.deploySeq!==life)return false;
   const buff=this.b.addBuff(t,{key:this.key(t,'bomb'),source:this.u,duration:this.bb['attack@boom_duration'],sourceStatusResistable:false,data:{nativeKey:'buddy[boom]'},onRemove:()=>this.dropBomb(c),onExpire:()=>this.dropBomb(c)});c.buff=buff;
   if(buff){if(!this.valid()||!this.target(t)||t.deploySeq!==life||t.findBuff(buff.key)!==buff)this.b.removeBuff(t,buff);else{c.counted=true;this.global.count++;this.bombs.set(t,c);}}
   if(!this.valid()||!this.target(t)||t.deploySeq!==life)return false;
   const m={life,buff:null},marker=this.b.addBuff(t,{key:this.key(t,'marker'),source:this.u,data:{nativeKey:'buddy[marker]'},onRemove:()=>{if(this.markers.get(t)===m)this.markers.delete(t);}});m.buff=marker;
   if(marker){if(!this.valid()||!this.target(t)||t.deploySeq!==life||t.findBuff(marker.key)!==marker)this.b.removeBuff(t,marker);else this.markers.set(t,m);}
   if(!this.valid()||!this.target(t)||t.deploySeq!==life){if(c.buff)this.b.removeBuff(t,c.buff);this.dropBomb(c);return false;}
   return !!c.counted;
  }finally{this.pending.delete(t);}
 }
 explode(c){const t=c.target;if(!this.valid()||c.triggered||!c.counted||!present(t)||t.deploySeq!==c.life||t.findBuff(c.buff.key)!==c.buff)return;
  c.triggered=true;this.b.dealDamage(this.u,t,{amount:this.u.s.atk*this.u.s.atkScaleMul*this.bb['attack@atk_scale_boom'],type:'phys',isAttack:false,isSkill:false,canDodge:true,applyWay:'none',tags:['recon:explosion']});
  if(this.valid()){
   if(present(t)&&t.deploySeq===c.life){const key=`recon:stun:${this.u.id}:${this.seq}:${t.id}:${c.life}`;this.b.applyStatus(t,'stun',{key,source:this.u,duration:this.bb['attack@stun_duration'],sourceStatusResistable:true});const buff=t.findBuff(key);if(buff?.source===this.u&&t.deploySeq!==c.life)this.b.removeBuff(t,buff);}
   if(this.valid())this.b.addDp(this.u.ownerId,this.bb['attack@cost']);
  }
  this.b.removeBuff(t,c.buff);this.dropBomb(c);
 }
 tick(){if(this.seq!==null&&!this.valid()){this.stop();return;}
  for(const c of[...this.bombs.values()])if(!present(c.target)||c.target.deploySeq!==c.life||c.target.findBuff(c.buff.key)!==c.buff){this.b.removeBuff(c.target,c.buff);this.dropBomb(c);}
  for(const[t,m]of[...this.markers])if(!present(t)||t.deploySeq!==m.life||t.findBuff(m.buff.key)!==m.buff)this.dropMarker(t,m);
 }
 install(){if(this.handles.length||this.stopped)throw Error('Recon recipient resources cannot be reinstalled');const{b,u}=this;
  this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;this.seq=u.deploySeq;
   const parent=b.addBuff(u,{key:`recon:trait:${u.id}:${this.seq}`,source:u,persist:true,data:{nativeKey:'buddy_tr_1'},onRemove:()=>this.stop()});this.parent=parent;if(!this.valid()){if(parent)b.removeBuff(u,parent);this.stop();}
  },{owner:u}),b.on('damaged',c=>{if(!this.valid()||c.source===u||c.source?.side!=='ally'||c.type==='element')return;const bomb=this.bombs.get(c.target);if(bomb)this.explode(bomb);},{owner:u}),
   b.on('hit',c=>{const p=this.point.point;if(this.valid()&&c.source===u&&this.point.current(p)&&p.mode==='active'&&c.target.blockedBy===p.unit)c.dmg.amount*=this.traitScale;},{owner:u}),
   b.on('tick',()=>this.tick(),{owner:u}),b.on('death',({unit})=>{if(unit===u)this.stop();else{const c=this.bombs.get(unit);if(c){b.removeBuff(unit,c.buff);this.dropBomb(c);}const m=this.markers.get(unit);if(m)this.dropMarker(unit,m);}},{owner:u}),
   b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;for(const c of[...this.bombs.values()]){this.b.removeBuff(c.target,c.buff);this.dropBomb(c);}for(const[t,m]of[...this.markers])this.dropMarker(t,m);this.pending.clear();if(this.parent)this.b.removeBuff(this.u,this.parent);this.parent=null;for(const h of this.handles)this.b.off(h);this.handles=[];}
}
