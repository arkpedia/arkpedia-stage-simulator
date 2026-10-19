// SPDX-License-Identifier: GPL-3.0-or-later
// Real held Persona buffs; the owning kit supplies the source entry boundaries.
import evidence from '../../../data/arkpedia-native-operators/char_4217_makoto.json' with {type:'json'};
import {MAKOTO_ID,selectedMakotoInputs} from './arkpedia-makoto-source.js';

export const MAKOTO_BODY_CONTRACT=Object.freeze({
  scope:'Selected original Persona ATK/BAT/HP, stopped SP, separate zero/P2 block producers, S3P1 ASPD and actual form countdown only.',
  mapping:'An explicit owner admits each source producer at its real entry boundary. The twenty-second parent has additive percentage ATK, flat BAT and a separately admitted parent-owned HP child. Missing trait MAX_HP is neutral only for the checked duration-only original trait. Native LIMITED zero child lifetime is mapped to its owning parent, not instant expiry. Separate S3P1 ASPD and infinite block buffs retain independent admission. P2 captures the old parent remaining/original duration before clearing it; its block producer removes zero, then adds negative two and selected block count independently. P2 entry retains the captured time. Real noSp flags block all ordinary recovery; manual cast eligibility is exposed separately for the real account owner. Natural parent finish authorizes an owner callback once, while early clear/dispel does not fabricate expiry. Shared stat recomputation preserves HP ratio; no full HP repair is invented here.',
  limitations:'Numeric block/formula aliases, missing-BB neutrality, parent-bound zero-lifetime child, source admission order and callback/tick boundaries remain explicit local mappings. Entry/return, source buff clears, HP repair, fatal interception, actual skill account composition, public art, native FX/audio/modules and compiled/frame parity remain separate. No public admission.',
  frameParity:false,
});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const kind=(n,t)=>n?.$type?.includes(`+${t},`);
export function makotoBodyInputs(e=evidence){
  const fail=()=>{throw Error('Changed original Makoto Persona body inputs');};
  const parts=e.characters[MAKOTO_ID].flatMap(r=>r.components),read=id=>{const a=parts.filter(p=>p.pathId===id);if(a.length!==1)fail();return a[0].data;};
  const parents=['-6032850912082670043','-3466145529244168667','-1294480160937161179'].map(read);
  for(const [i,p] of parents.entries()){
    const b=p._buffs[0];if(p.m_Script.m_PathID!=='3800760148018415462'||b.buffKey!=='makoto_standin'||b.templateKey!=='makoto_standin'
      ||b.lifeTimeType!==1||b.durationKey!=='duration'||b.isSilenceable!==0||b.isStunnable!==0
      ||!same(b.attributes.abnormalFlags,i===2?[1]:[1,24]))fail();
  }
  if(parents[2]._buffs[1].buffKey!=='makoto_s3_1_standin'||parents[2]._buffs[1].durationKey!=='duration')fail();
  const zeros=['1268721692273724965','6551988282310905381','7342522337367739941'].map(id=>read(id)._buffs.find(b=>b.buffKey==='makoto_stand[block_zero]'));
  for(const b of zeros)if(!b||b.lifeTimeType!==2||!same(b.attributes.abnormalFlags,[1])
    ||!same(b.attributes.attributeModifiers,[{attributeType:5,formulaItem:3,value:0,loadFromBlackboard:0,fetchBaseValueFromSourceEntity:0}]))fail();
  const ts=e.templates,start=ts.makoto_standin.eventToActions.ON_BUFF_START,finish=ts.makoto_standin.eventToActions.ON_BUFF_FINISH;
  const mod=(a,attr,key,formula)=>kind(a,'AttributeModifierWithBB')&&a._attributeType===attr&&a._valueKey===key&&a._formulaType===formula;
  if(!mod(start[2],'ATK','ATK','MULTIPLIER')||!mod(start[3],'BASE_ATTACK_TIME','BASE_ATTACK_TIME','ADDITION')
    ||start[0]._buffKey!=='makoto_talent_1'||start[0]._valueKey!=='atk'||start[1]._valueKey!=='BASE_ATTACK_TIME'
    ||start[4]._buffKey!=='makoto_tr'||start[4]._valueKey!=='MAX_HP'||!mod(start[6],'MAX_HP','MAX_HP','MULTIPLIER')
    ||!kind(start[7],'SpShowBuff')||start[7]._isSkillCountDown!==false
    ||finish[0]._conditionNode._checkTime!==0||finish[0]._conditionNode._condType!=='LE'||finish[0]._conditionNode._useSnapshotBuff!==true)fail();
  const create=start.at(-1),child=create._buff,hp=ts.makoto_standin_t1_max_hp.eventToActions.ON_BUFF_START;
  if(!kind(create,'CreateBuff')||create._isDerivedBuff!==true||create._finishDerivedBuffIfParentFinish!==true
    ||child.buffKey!=='makoto_standin_t1_max_hp'||child.lifeTimeType!=='LIMITED'||child.lifeTime!==0
    ||hp[0]._buffKeyAssignFrom!=='makoto_talent_1'||hp[0]._valueKey!=='max_hp_t1'||hp[0]._defaultValue!==0
    ||!mod(hp[1],'MAX_HP','max_hp_t1','MULTIPLIER'))fail();
  const speed=ts.makoto_s3_1_standin.eventToActions.ON_BUFF_START[0];if(!mod(speed,'ATTACK_SPEED','ATTACK_SPEED','ADDITION'))fail();
  const block=ts.makoto_s3_2_mod_block_cnt.eventToActions.ON_BUFF_START;
  if(block.length!==4||!kind(block[0],'FinishBuffsById')||block[0]._buffKey!=='makoto_stand[block_zero]'||block[0]._checkBuffSource!==false
    ||!kind(block[1],'CreateBuff')||block[1]._isDerivedBuff!==false||block[1]._buff.buffKey!=='makoto_stand[block_dec]'
    ||block[1]._buff.lifeTimeType!=='INFINITY'||!same(block[1]._buff.attributes.attributeModifiers,[{attributeType:'BLOCK_CNT',formulaItem:'ADDITION',value:-2,loadFromBlackboard:false,fetchBaseValueFromSourceEntity:false}])
    ||block[2]._buffKeyAssignFrom!=='makoto_skill_2'||block[2]._valueKey!=='attack@block_cnt'
    ||!kind(block[3],'CreateBuff')||block[3]._isDerivedBuff!==false||block[3]._buff.buffKey!=='makoto_stand[s3_2_block]'
    ||block[3]._buff.lifeTimeType!=='INFINITY'||!same(block[3]._buff.attributes.attributeModifiers,[{attributeType:'BLOCK_CNT',formulaItem:'ADDITION',value:0,loadFromBlackboard:true,fetchBaseValueFromSourceEntity:false}]))fail();
  const p2=ts.makoto_switchend.eventToActions.ON_BUFF_START[3]._failNodes[0]._failNodes[0]._succeedNodes[0]._succeedNodes;
  const reborn=p2[1]._buff;
  if(reborn.buffKey!=='makoto_standin'||reborn.durationKey!=='makoto_standin_duration'||!same(reborn.attributes.abnormalFlags,['SP_RECOVER_STOPPED','SKILL_NOT_ACTIVATABLE']))fail();
  const trait=e.tables.character.trait.candidates;
  if(trait.length!==1||!same(trait[0].blackboard,[{key:'duration',value:20,valueStr:null}]))fail();
  return {parents,zeros,templates:ts,block,duration:20};
}
const live=u=>u?.alive&&u.deployed&&!u.hidden&&!u.removed&&!u._removing;
const origins=new WeakMap();
export class MakotoPersonaBody{
  constructor(b,u,{contract,mayEnter,onExpired}={}){
    if(contract!==MAKOTO_BODY_CONTRACT||typeof mayEnter!=='function'||typeof onExpired!=='function'||u.def.charId!==MAKOTO_ID||u.deploySeq!==0)
      throw Error('Fresh selected Makoto, exact body contract and explicit source-entry/expiry owner required');
    const record=selectedMakotoInputs(u);makotoBodyInputs();
    Object.assign(this,{b,u,record,bb:record.talentBb[0],mayEnter,onExpired,seq:null,account:null,phase:null,prepared:null,stopped:false,busy:false,
      handles:[],buffs:new Set(),tickets:new WeakSet(),lastExpiry:null,serial:0});
  }
  valid(){return !this.stopped&&!this.b.finished&&this.seq!==null&&live(this.u)&&this.u.deploySeq===this.seq&&this.u.skill===this.account;}
  owns(buff){const r=origins.get(buff);return !!r&&r.manager===this&&buff.key===r.key&&buff.source===this.u&&this.u.buffs.includes(buff)&&buff.data?.makotoBody===this;}
  remove(buff){this.buffs.delete(buff);if(this.owns(buff))this.b.removeBuff(this.u,buff);}
  attach(p,name,{mods={},flags={},duration=Infinity,onFinish,guard=()=>true}={}){
    if(!this.valid()||p&&this.phase!==p||!guard())return null;
    const key=`makoto:body:${this.u.id}:${this.seq}:${name}`,descriptor={mods:{...mods},flags:{...flags},duration};
    let buff;const admit=(_u,a)=>this.valid()&&(!p||this.phase===p)&&guard()&&a.key===key&&a.source===this.u&&a.duration===duration&&a.timeLeft===duration
      &&same(a.mods,descriptor.mods)&&same(a.flags,descriptor.flags)&&a.data?.makotoBody===this&&a.data?.nativeKey===name;
    buff=this.b.addBuff(this.u,{key,source:this.u,duration,timeLeft:duration,mods:{...descriptor.mods},flags:{...descriptor.flags},data:{makotoBody:this,nativeKey:name},admit,
      onExpire:()=>{if(buff)onFinish?.(buff);},onRemove:()=>{if(buff)onFinish?.(buff);}});
    if(buff)origins.set(buff,{manager:this,key,nativeKey:name});
    if(!buff||!admit(this.u,buff)||!this.owns(buff)){this.remove(buff);return null;}
    this.buffs.add(buff);return buff;
  }
  countdown(){const p=this.phase;if(!this.valid()||!p||!this.owns(p.parent))return null;
    return {remaining:Math.max(0,p.parent.timeLeft),duration:p.originalDuration,canActivate:p.mode===3};}
  castBlocked(){const p=this.phase;return this.valid()&&!!p&&this.owns(p.parent)&&p.mode!==3;}
  finish(p,buff){
    if(this.phase!==p||p.parent!==buff||p.finished)return;p.finished=true;this.phase=null;this.buffs.delete(buff);this.remove(p.hp);
    const natural=buff.timeLeft<=1e-9;
    if(natural&&this.valid()){
      const info=Object.freeze({ticket:p.ticket,mode:p.mode,remaining:0,duration:p.originalDuration,seq:this.seq});this.lastExpiry=info;
      this.onExpired(info);
    }
  }
  permitted(input){try{return this.mayEnter(Object.freeze(input))===true&&this.valid();}catch(error){this.clear();throw error;}}
  enter({mode,ticket,remaining,duration}={}){
    if(this.busy||!this.valid()||this.phase||!ticket||typeof ticket!=='object'||this.tickets.has(ticket)
      ||!(mode===this.record.index+1||mode===4&&this.record.index===2))return false;
    if(mode===4){const s=this.prepared;if(!s||s.ticket!==ticket||remaining!==s.remaining||duration!==s.duration)return false;}
    else if(remaining!=null||duration!=null)return false;
    this.busy=true;
    try{
      if(!this.permitted({mode,ticket,seq:this.seq}))return false;
      this.tickets.add(ticket);const p={mode,ticket,originalDuration:mode===4?duration:20,span:mode===4?remaining:20,finished:false,parent:null,hp:null};
      this.phase=p;this.lastExpiry=null;this.prepared=null;
      p.parent=this.attach(p,'makoto_standin',{duration:p.span,mods:{atkPct:this.bb.atk,batFlat:this.bb.base_attack_time},flags:{noSp:true},onFinish:buff=>this.finish(p,buff)});
      if(!this.valid()||this.phase!==p){this.clearForm();return false;}
      if(p.parent)p.hp=this.attach(p,'makoto_standin_t1_max_hp',{mods:{hpPct:this.bb.max_hp_t1}});
      if(!this.valid()||this.phase!==p||p.parent&&!this.owns(p.parent)){this.clearForm();return false;}
      if(mode!==4){
        const zero=this.attach(p,'makoto_stand[block_zero]',{mods:{blockCntMul:0},flags:{noSp:true}});
        if(zero&&this.valid()&&this.phase===p)this.b.releaseBlocked(this.u);
      }
      if(mode===3)this.attach(p,'makoto_s3_1_standin',{duration:p.span,mods:{aspd:this.record.bb['talent@attack_speed']}});
      if(!this.valid()||this.phase!==p||p.parent&&!this.owns(p.parent)){this.clearForm();return false;}
      if(!p.parent){p.finished=true;this.phase=null;return false;}
      return true;
    }finally{this.busy=false;}
  }
  prepareP2(ticket){
    const p=this.phase;
    if(this.busy||!this.valid()||this.record.index!==2||!p||p.mode!==3||!this.owns(p.parent)||!ticket||typeof ticket!=='object'||this.tickets.has(ticket))return null;
    this.busy=true;
    try{
      if(!this.permitted({mode:4,ticket,seq:this.seq})||this.phase!==p||!this.owns(p.parent))return null;
      const remaining=p.parent.timeLeft;if(!(remaining>0))return null;
      const saved=Object.freeze({ticket,remaining,duration:p.originalDuration});this.clearForm();
      if(!this.valid())return null;this.prepared=saved;
      for(const buff of [...this.buffs])if(origins.get(buff)?.nativeKey==='makoto_stand[block_zero]')this.remove(buff);
      // Independent native additions: external block changes remain additive.
      const guard=()=>this.prepared===saved;
      this.attach(null,'makoto_stand[block_dec]',{mods:{blockCnt:-2},guard});
      this.attach(null,'makoto_stand[s3_2_block]',{mods:{blockCnt:this.record.bb['attack@block_cnt']},guard});
      if(!this.valid()||!guard()){this.clear();return null;}return saved;
    }finally{this.busy=false;}
  }
  clearForm(){const p=this.phase;this.phase=null;if(p){p.finished=true;this.remove(p.hp);this.remove(p.parent);}
    for(const buff of [...this.buffs])if(origins.get(buff)?.nativeKey==='makoto_s3_1_standin')this.remove(buff);}
  clear(){this.prepared=null;this.lastExpiry=null;this.clearForm();for(const buff of [...this.buffs])this.remove(buff);}
  tick(){if(!this.valid()){this.stop();return;}const p=this.phase;if(p&&!this.owns(p.parent)){this.phase=null;p.finished=true;this.remove(p.hp);}
    for(const buff of [...this.buffs])if(!this.owns(buff))this.buffs.delete(buff);}
  install(){if(this.stopped||this.handles.length||this.u.deploySeq!==0||!this.u.skill||this.u.skill.unit!==this.u||this.u.skill.battle!==this.b||this.u.skill.id!==this.u.def.skill.id
      ||this.u.mem.makotoBody&&this.u.mem.makotoBody!==this)throw Error('Fresh Makoto body with its real selected account required; cannot be reinstalled');
    this.account=this.u.skill;this.u.mem.makotoBody=this;const{b,u}=this;
    this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq!==null){if(this.seq!==u.deploySeq)this.stop();return;}this.seq=u.deploySeq;},{owner:u}),
      b.on('tick',()=>{if(this.seq!==null)this.tick();},{owner:u}),...['removed','death'].map(event=>b.on(event,({unit})=>{if(unit===u)this.stop();},{owner:u})),b.on('battleEnd',()=>this.stop(),{owner:u})];
  }
  stop(){if(this.stopped)return;this.stopped=true;this.clear();for(const h of this.handles)this.b.off(h);this.handles=[];}
}
