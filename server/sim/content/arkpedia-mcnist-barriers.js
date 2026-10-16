// SPDX-License-Identifier: GPL-3.0-or-later
// Selected deployment barriers only; token construction, skills and public admission are separate.
import {MCNIST_ID as ID,MCGRAF_ID as TOKEN,selectedMechanistBuild,mechanistNativeInputs} from './arkpedia-mcnist-source.js';
import {normalizeChess,normSpType} from '../simdata.js';
export const MCNIST_BARRIER_CONTRACT=Object.freeze({
 scope:'Selected Mechanist E2 deployment HP barrier on the owner and caller-registered original McGraf lives; no attack/skill/summon/public admission',
 mapping:'Each accepted native deployment barrier snapshots recipient maximum HP times the selected .3/.4 operand. It absorbs accepted HP damage after mitigation and hit-count barriers. The exhausted source barrier may cancel the whole residual packet when no accepted same-family HP barrier remains, preserving the recovered source-filtered overflow guard. Linked original owner/token instances define that family; foreign-source shields are excluded. A callback observes accepted absorption before exhausted-buff removal, and replacement shields cannot absorb the same packet twice. Calculated damage retains the pre-shield amount; damage-received receipts retain zero HP loss for a completely blocked packet. Silence/control do not remove the passive barrier. Source retirement removes its owner barrier; registered token lives retain their own independently owned barrier until caller removal or battle end.',
 limits:'Native event priority against external shields, host/token source-filter equivalence, null-source filter semantics and callback ordering remain explicit local mappings. Token stats, deployment lifetime/stock/owner-finish kill behavior and all three skills still require their own reviewed controllers. Modules, native particles/audio, original game-frame/pixel parity and public admission remain unverified.',
 frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function prepareMechanistBarriers(b,u,{contract}={}){
 if(contract!==MCNIST_BARRIER_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.mcnistBarriers)throw Error('Fresh selected Mechanist and explicit barrier contract required');
 const r=selectedMechanistBuild({...u.def.raw.arkpedia,skillId:u.def.skill?.id}),s=u.def.skill;
 if(u.def.raw.arkpedia.skillId!=null&&u.def.raw.arkpedia.skillId!==s.id||!same(u.def.stats,normalizeChess({stats:r.stats}).stats)
  ||!same(u.rangeGrid,r.rangeGrid)||!same(u.def.tags,r.tags)||!same(u.def.talents.map(t=>t.bb),r.talentBb)
  ||!same(s.bb,r.bb)||s.skillType!==r.source.skillType||s.durationType!==r.source.durationType||s.spType!==normSpType(r.source.spData.spType)
  ||s.spCost!==r.source.spData.spCost||s.initSp!==r.source.spData.initSp||s.duration!==r.source.duration||s.maxCharges!==r.source.spData.maxChargeTime||!same(s.rangeGrid??[],r.skillRangeGrid))throw Error('Incomplete Mechanist selected barrier inputs');
 const t=mechanistNativeInputs().templates.mcnist_t_2.eventToActions,start=t.ON_BUFF_START[0],take=t.ON_TAKE_DAMAGE;
 if(start._attributeType!=='MAX_HP'||start._scaleVar!=='hp_ratio'||take[0]._filterDamageType!==false||take[0]._filterApplyWay!==false
  ||!take[0]._useDynamicVar||take[0]._allowNegativeDynamicVar!==false||take[1]._blackboardKey!=='dynamic'||take[1]._condType!=='LE'
  ||take[2]._conditionNode._filterSource!=='BUFF_OWNER'||take[2]._conditionNode._enableFilterSource!==true||take[2]._conditionNode._filterHostOrToken!==false
  ||take[2]._succeedNodes[0]._filterHostOrToken!==true||take[2]._succeedNodes[1]._reason!=='BLOCKED')throw Error('Changed Mechanist native barrier graph');
 const resources=new MechanistBarriers(b,u,r);u.mem.mcnistBarriers=resources;return resources;
}
export class MechanistBarriers{
 constructor(b,u,record){this.b=b;this.u=u;this.record=record;this.ratio=record.talentBb.find(t=>'hp_ratio'in t)?.hp_ratio??0;this.seq=null;this.stopped=false;this.handles=[];this.tokenHandles=[];this.tokens=new Map();this.members=new Set([u]);this.entries=new Map();}
 valid(){return !this.stopped&&!this.b.finished&&present(this.u)&&this.seq===this.u.deploySeq;}
 registerToken(t){if(!this.valid()||this.record.build.elite<1||!t||t===this.u||t.def?.charId!==TOKEN||t.ownerUnit!==this.u||t.ownerId!==this.u.ownerId||t.deploySeq!==0||t.deployed||this.tokens.has(t))throw Error('Fresh source-linked original McGraf registration required');
  this.tokens.set(t,{life:null});this.members.add(t);this.watchTokens();return t;
 }
 watchTokens(){if(this.tokenHandles.length)return;const b=this.b;
  this.tokenHandles.push(b.on('deploy',({unit,move})=>{if(move||!this.tokens.has(unit))return;const r=this.tokens.get(unit);if(r.life!==null)return;r.life=unit.deploySeq;this.attach(unit,r.life);}),
   b.on('removed',({unit})=>{if(this.tokens.has(unit))this.removeToken(unit);}),b.on('death',({unit})=>{if(this.tokens.has(unit))this.removeToken(unit);}),
   b.on('tick',()=>{for(const[t,r]of this.tokens)if(r.life!==null&&(!present(t)||t.deploySeq!==r.life))this.removeToken(t);}),
   b.on('battleEnd',()=>{for(const t of [...this.tokens.keys()])this.removeToken(t);}));
 }
 removeToken(t){const e=this.entries.get(t);if(e)this.b.removeBuff(t,e.buff);this.entries.delete(t);this.tokens.delete(t);
  this.pruneMembers();
  if(!this.tokens.size){for(const h of this.tokenHandles)this.b.off(h);this.tokenHandles=[];}
 }
 pruneMembers(){for(const m of this.members)if(m!==this.u&&!this.tokens.has(m)&&![...this.entries.values()].some(e=>e.target.buffs.some(b=>b.source===m&&b.shield>0)))this.members.delete(m);}
 familyRemaining(t){return t.buffs.reduce((n,b)=>n+(this.members.has(b.source)&&Number.isFinite(b.shield)?Math.max(0,b.shield):0),0);}
 admitted(t,life){return !this.b.finished&&present(t)&&t.deploySeq===life&&(t===this.u?this.valid():this.tokens.get(t)?.life===life);}
 attach(t,life){if(!(this.ratio>0)||!this.admitted(t,life))return false;
  const key=`mcnist:t2:barrier:${t.id}`,e={target:t,life,key,buff:null,absorbed:0,overflows:0};
  const buff=this.b.addBuff(t,{key,source:t,shield:t.s.maxHp*this.ratio,visible:true,
   onShieldAbsorb:c=>{if(!this.admitted(t,life)||t.findBuff(key)!==c.buff||this.entries.get(t)!==e)return;
    e.absorbed+=c.absorbed;if(c.depleted&&this.familyRemaining(t)===0){c.remaining=0;e.overflows++;}},
   onRemove:({buff})=>{if(this.entries.get(t)?.buff===buff)this.entries.delete(t);this.pruneMembers();}});
  e.buff=buff;if(!buff||!this.admitted(t,life)||t.findBuff(key)!==buff){if(buff)this.b.removeBuff(t,buff);return false;}
  this.entries.set(t,e);return true;
 }
 install(){if(this.handles.length||this.stopped)throw Error('Mechanist barriers cannot be reinstalled');const{b,u}=this;
  this.handles.push(b.on('deploy',({unit,move})=>{if(unit!==u||move)return;this.seq=u.deploySeq;this.attach(u,this.seq);},{owner:u}),
   b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();},{owner:u}),b.on('removed',({unit})=>{if(unit===u)this.stop();},{owner:u}),b.on('death',({unit})=>{if(unit===u)this.stop();},{owner:u}),
   b.on('battleEnd',()=>{this.stop();for(const t of [...this.tokens.keys()])this.removeToken(t);},{owner:u}));
 }
 stop(){if(this.stopped)return;this.stopped=true;for(const h of this.handles)this.b.off(h);this.handles=[];const e=this.entries.get(this.u);if(e)this.b.removeBuff(this.u,e.buff);this.entries.delete(this.u);for(const[t,r]of [...this.tokens])if(r.life===null)this.removeToken(t);}
}
