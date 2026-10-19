// SPDX-License-Identifier: GPL-3.0-or-later
// Held P2 source-owned heal producer, independently finishing recipient buffs.
import evidence from '../../../data/arkpedia-native-operators/char_4217_makoto.json' with {type:'json'};
import {MAKOTO_ID as ID,selectedMakotoInputs,makotoS3HealingInputs} from './arkpedia-makoto-source.js';
import {absoluteRangeKeys} from '../targeting.js';import {bodyInKeys} from '../body.js';
export const MAKOTO_S3_HEALING_CONTRACT=Object.freeze({
 scope:'Selected original S3 P2 world-time healing pulses and half-second recipient finish-heals only.',
 mapping:'An explicit owning P2 predicate supplies mode presence. The no-ordinary-attack mode keeps its literal force-Front continuous loop. Native ON_BUFF_START/ON_BUFF_TRIGGER map to an entry pulse and selected attack@interval world cadence, independent of ASPD/slowdown/action control. Lowest HP ratio, newest deployment then stable ID select at most attack@max_target_heal legal friendly input lives in the selected nonextended x-1 range, including self/full-HP allies. The no-action-node heal ability attaches independent nonderived override-disabled recipient buffs with original duration0.5. Accepted buff finish, including an ordinary dispel, claims one live-ATK/attack-scale selected-heal output; it is never an instant heal or ordinary attack receipt. Born recipient buffs survive source mode departure and exit. Current matching source life supplies finish attributes; source retirement uses its issue-time attribute view and original ledger. Replaced/hidden/removed recipients and battle end suppress inherited output.',
 limitations:'Numeric selector aliases, ties, generic negative interval resolving through selected interval, entry/pulse ordering, empty-animation ability invocation, independent receiver override policy, source-retirement fallback and finish/dispel dispatch are explicit local mappings. No native compiled invalid-source semantics or frame/pixel parity is claimed. P2 evasion/block passives, free recast, entry/return/fatal/all-out ownership, public art, modules and native effects/audio compose separately.',frameParity:false,
});
const present=t=>t?.alive&&t.deployed&&!t.removed&&!t._removing;
const retained=(t,life)=>present(t)&&!t.hidden&&t.side==='ally'&&t.deploySeq===life;
const due=(a,z)=>a>=z-1e-7,same=(a,z)=>JSON.stringify(a)===JSON.stringify(z);
export function verifyMakotoS3Healing(n=makotoS3HealingInputs()){
 const {mode:m,heal:h,selector:s,producer:p,templates:ts}=n,child=h._activeBuffs[0],clock=p._buffs[0];
 if(m._attack.m_PathID!=='0'||m._attackTrigger.m_PathID!=='0'||!m._generalAbilities.some(p=>p.m_PathID==='7398850004267028005')
  ||h._metadata.namedAsAlias!=='makoto[s3_heal_others]'||h._selector.m_PathID!=='-7680531105110897115'
  ||h._hasNoActionNode!==1||h._isCont!==0||h._isHpRatio!==0||h._ignoreHealFree!==0||h._applyEPHeal!==0||h._affectedBySlowDown!==0
  ||h._timeMode!==2||h._animKey!==''||h._waitForAttackEvent!==1||h._faceToFront!==1||h._preDelay!==0||h._selectTargetSource!==2
  ||h._selectTargetTiming!==0||h._allowNoTarget!==0||h._alwaysIncludeTarget!==0||h._interruptAbilityOnDetach!==1)throw Error('Changed original Makoto S3 healing ability');
 if(s._targetSide!==1||s._targetMotion!==3||s._targetCategory!==1||s._postFilter!==3||s._ignoreTargetFree!==0||s._ignoreAllyTargetFree!==0
  ||s._ignoreHealFree!==0||s._ignoreMotionMode!==0||s._needProfessionMask!==0||s._excludeOwner!==0||s._ignoreHitRange!==0
  ||s._maxTargetKey!=='max_target_heal'||s._maxNum!==4||s._limitTargetNum!==1)throw Error('Changed original Makoto S3 healing selection');
 if(h._activeBuffs.length!==1||child.buffKey!=='makoto_s3_2_be_healed'||child.templateKey!=='makoto_s3_2_be_healed'
  ||child.lifeTimeType!==1||child.disableOverride!==1||child.isDamageMissable!==0||child.isDurableBuff!==0
  ||!same(child.blackboard,[{key:'duration',value:.5,valueStr:''}])||child.durationKey!=='duration'
  ||p._buffs.length!==1||clock.templateKey!=='makoto_s3_2_heal_others'||clock.lifeTimeType!==2||clock.triggerLifeType!==2
  ||clock.triggerInterval!==-1||clock.waitFirstTriggerInterval!==1||clock.isStunnable!==0||clock.isSilenceable!==0)throw Error('Changed original Makoto S3 heal producer/recipient');
 const producer=ts.makoto_s3_2_heal_others.eventToActions,finish=ts.makoto_s3_2_be_healed.eventToActions.ON_BUFF_FINISH;
 for(const event of ['ON_BUFF_START','ON_BUFF_TRIGGER'])if(producer[event].length!==1||producer[event][0]._abilityName!=='makoto[s3_heal_others]'
  ||producer[event][0]._checkCanUseAblityFlag!==false||producer[event][0]._castDirectly!==false)throw Error('Changed original Makoto S3 healing trigger');
 if(!finish[0].$type.includes('+ApplyHeal,')||finish[0]._isCont!==false||finish[0]._isHpRatio!==false||finish[0]._useBlackboardHealScale!==true
  ||ts.makoto_s3_2_be_healed.eventToActions.ON_BUFF_START.some(n=>n.$type.includes('+ApplyHeal,')))throw Error('Changed original Makoto S3 finish heal');
}
function captureSource(u){const view=Object.assign(Object.create(Object.getPrototypeOf(u)),{...u,base:{...u.base},mem:{},buffs:u.buffs.slice(),tags:new Set(u.tags),
 profile:{hitSleep:u.profile.hitSleep},stats:u.stats,alive:false,deployed:false,removed:true});Object.defineProperty(view,'s',{value:structuredClone(u.s),enumerable:true});return view;}
export class MakotoSkillThreeHealing{
 constructor(b,u,{contract,inPersona}={}){
  if(contract!==MAKOTO_S3_HEALING_CONTRACT||typeof inPersona!=='function'||u.def.charId!==ID||u.deploySeq!==0)throw Error('Fresh selected Makoto S3, exact healing contract and explicit P2 predicate required');
  const record=selectedMakotoInputs(u);if(record.index!==2)throw Error('Fresh selected Makoto S3 required');verifyMakotoS3Healing();
  Object.assign(this,{b,u,record,inPersona,seq:null,stopped:false,ended:false,busy:false,ticking:false,pulsePermit:false,currentInput:null,inMode:false,nextAt:Infinity,serial:0,handles:[],watchers:[],pending:new Set(),visuals:new WeakSet(),range:null});
 }
 valid(){return !this.stopped&&!this.ended&&!this.b.finished&&this.seq!==null&&present(this.u)&&this.u.deploySeq===this.seq;}
 active(){if(!this.valid())return false;const yes=this.inPersona();return this.valid()&&yes===true&&!this.u.hidden;}
 keys(){const{tileR:r,tileC:c,dir}=this.u;if(!this.range||this.range.r!==r||this.range.c!==c||this.range.dir!==dir)
  this.range={r,c,dir,keys:new Set(absoluteRangeKeys(this.record.skillRangeGrid,r,c,dir))};return this.range.keys;}
 healable(t){return present(t)&&!t.hidden&&t.side==='ally'&&t.kind!=='device'&&!t.s.flags.untargetable&&!t.s.flags.healFree
  &&this.b.allySelectable(t,this.u)&&(t===this.u||!t.s.flags.noHeal&&!t.profile?.noHeal);}
 choices(){const keys=this.keys();return this.b.allyUnits.filter(t=>this.healable(t)&&bodyInKeys(t,keys))
  .sort((a,z)=>a.hp/a.s.maxHp-z.hp/z.s.maxHp||z.deploySeq-a.deploySeq||String(a.id).localeCompare(String(z.id))).slice(0,this.record.bb['attack@max_target_heal']);}
 visual(){const old=this.u.mem.regularFormVisual;if(this.visuals.has(old))return;const clip='Doll_Skill_3_P2_Loop';
  if(!evidence.models[ID].Front.durations[clip]||evidence.models[ID].Back.durations[clip]!=null)throw Error('Changed original Makoto P2 force-Front loop');
  const v={clip,speed:1,loop:true,replace:true};this.visuals.add(v);this.u.mem.regularFormVisual=v;this.u.mem.regularVisualDirection='DOWN';}
 finish(p,{cancel=false}={}){
  if(p.finished)return;const admitted=p.admitted;p.finished=true;this.pending.delete(p);
  if(p.buff?.data?.makotoHeal===p&&p.target.buffs.includes(p.buff))this.b.removeBuff(p.target,p.buff);
  try{if(!cancel&&admitted&&!this.ended&&!this.b.finished&&p.buff?.data?.makotoHeal===p&&retained(p.target,p.life)){
    const source=!p.retired&&present(this.u)&&this.u.deploySeq===p.sourceLife?this.u:p.source;
    this.b.heal(source,p.target,source.s.atk*source.s.atkScaleMul*this.record.bb['attack@heal_scale'],
      {isAttack:false,isSkill:false,isProjectile:false,self:p.target===this.u,tags:['makoto:s3-heal']});
  }}finally{this.unwatch();}
 }
 attach(t,life){const input=this.currentInput;if(!this.busy||input?.target!==t||input.life!==life)return null;this.currentInput=null;
  if(!this.active()||!this.valid()||!retained(t,life)||!this.healable(t))return null;
  const key=`makoto:s3-heal:${this.u.id}:${this.seq}:${++this.serial}`,p={target:t,life,sourceLife:this.seq,source:captureSource(this.u),retired:false,key,buff:null,admitted:false,finished:false,bornAt:this.b.time,endAt:this.b.time+.5};
  const permit=(_target,buff)=>!p.finished&&this.active()&&this.valid()&&retained(t,life)&&this.healable(t)
    &&buff.key===key&&buff.source===this.u&&buff.data?.makotoHeal===p&&buff.duration===.5&&(buff.timeLeft==null||buff.timeLeft===.5)
    &&Object.keys(buff.mods??{}).length===0&&Object.keys(buff.flags??{}).length===0;
  p.buff=this.b.addBuff(t,{key,source:this.u,duration:.5,data:{makotoHeal:p},admit:permit,onRemove:()=>this.finish(p),onExpire:()=>this.finish(p)});
  if(!p.buff||p.finished||!permit(t,p.buff)||!t.buffs.includes(p.buff)){this.finish(p,{cancel:true});return null;}
  p.admitted=true;this.pending.add(p);this.watch();return p;
 }
 pulse(){if(this.busy||!this.pulsePermit)return false;this.pulsePermit=false;this.busy=true;try{
  if(!this.active())return false;
  const inputs=this.choices().map(t=>({target:t,life:t.deploySeq}));let accepted=false;
  for(const i of inputs){if(!this.active())break;this.currentInput=i;if(this.attach(i.target,i.life))accepted=true;}return accepted;
 }finally{this.currentInput=null;this.busy=false;}}
 tick(){if(this.ticking||this.busy)return;this.ticking=true;try{
  if(!this.active()){this.inMode=false;this.nextAt=Infinity;return;}
  const pulse=()=>{this.pulsePermit=true;try{this.pulse();}finally{this.pulsePermit=false;}};
  this.visual();if(!this.inMode){this.inMode=true;this.nextAt=this.b.time+this.record.bb['attack@interval'];pulse();}
  else if(due(this.b.time,this.nextAt)){const interval=this.record.bb['attack@interval'];this.nextAt+=interval*(1+Math.floor(Math.max(0,this.b.time-this.nextAt+1e-7)/interval));pulse();}
 }finally{this.ticking=false;}
 }
 watch(){if(this.watchers.length||!this.pending.size)return;const{b}=this;this.watchers=[b.on('tick',()=>{
   for(const p of [...this.pending]){if(!present(this.u)||this.u.deploySeq!==p.sourceLife)p.retired=true;
    if(!retained(p.target,p.life)||!p.target.buffs.includes(p.buff))this.finish(p,{cancel:true});}
  }),b.on('battleEnd',()=>this.drain())];}
 unwatch(){if(this.pending.size)return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 trait(){return{noAttack:true,heal:null};}
 install(){if(this.stopped||this.handles.length||this.u.mem.makotoS3Healing&&this.u.mem.makotoS3Healing!==this)throw Error('Makoto S3 healing cannot be reinstalled');
  this.u.mem.makotoS3Healing=this;const{b,u}=this;this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq!==null){if(this.seq!==u.deploySeq)this.stop();return;}this.seq=u.deploySeq;},{owner:u}),
   b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),...['removed','death'].map(event=>b.on(event,({unit})=>{if(unit===u)this.stop();},{owner:u})),
   b.on('battleEnd',()=>{this.stop();this.drain();},{owner:u})];}
 stop(){if(this.stopped)return;this.stopped=true;this.inMode=false;for(const p of this.pending)if(!present(this.u)||this.u.deploySeq!==p.sourceLife)p.retired=true;
  for(const h of this.handles)this.b.off(h);this.handles=[];if(this.seq===this.u.deploySeq&&this.visuals.has(this.u.mem.regularFormVisual)){delete this.u.mem.regularFormVisual;delete this.u.mem.regularVisualDirection;}
  if(this.b.finished)this.drain();}
 drain(){if(this.ended)return;this.ended=true;for(const p of [...this.pending])this.finish(p,{cancel:true});this.unwatch();}
}
