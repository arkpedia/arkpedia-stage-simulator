// SPDX-License-Identifier: GPL-3.0-or-later
// Held return clocks; a separate owner executes the original buff actions.
import evidence from '../../../data/arkpedia-native-operators/char_4217_makoto.json' with {type:'json'};
import clocks from '../../../data/arkpedia-makoto-clocks.json' with {type:'json'};
import {MAKOTO_ID,selectedMakotoInputs} from './arkpedia-makoto-source.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';

export const MAKOTO_RETURN_CONTRACT=Object.freeze({
  scope:'Original plain/all-out return branches, fixed force-Front outgoing/end clocks and separate mode-five owner-buff wait only.',
  mapping:'An explicit owner authorizes natural persona expiry and acknowledges begin, heal, broadcast, loop and normal instructions. The all-out parallel broadcast starts at branch entry, independently of the outgoing sequence. SwitchOut finishes at its original full clip duration; its cooldown is not a second wait. Plain return commits mode zero; all-out return commits mode five and checks the actual owning on-enter-normal buff immediately and at the original world interval. Absence starts the original full end clip, then commits mode zero through the attached finish producer. The early OnAttack marker is not substituted for that finish producer. Subability/parallel order, full-clip finish dispatch, poll coalescing and callback ordering are explicit local mappings.',
  limitations:'The owner must implement real buff admission/lifetimes, health/clear/SP/fatal actions and all-out grant composition. No enter_normal_duration is guessed from the independent damage timer or raw zero lifetime. Stop-affect/native compiled finish dispatch, frame parity, effects/audio/modules and public admission remain unapproved.',
  frameParity:false,
});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const due=(a,z)=>a>=z-1e-8;
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
const type=(n,k)=>n?.$type?.includes(`+${k},`);

export function makotoReturnPlans(e=evidence,c=clocks){
  const fail=()=>{throw Error('Changed original Makoto persona-return inputs');};
  const parts=e.characters[MAKOTO_ID].flatMap(r=>r.components);
  const get=id=>{const p=parts.filter(p=>p.pathId===id);if(p.length!==1)fail();return p[0].data;};
  const root=get('-1218499832398557659'),plain=get('2240692631751609893'),parallel=get('-6620331043525112283'),chain=get('-7724450873279001051');
  if(c.receiptSha256!=='7489e0dea8732f27fdbe6bd90b7ab2584f9a30d6547f7de14d1b82581072c817'
    ||!same(root._modes.map(p=>p.m_PathID),['-3985492384108261851','2113126334119661093','-2876292474294186459','-2027711911729967579','4051779512619945509','-8446961385296114139'])
    ||!['2240692631751609893','-6620331043525112283'].every(id=>root._commonAbilities.some(p=>p.m_PathID===id))
    ||plain._metadata.namedAsAlias!=='makoto[switch2normal]'||parallel._metadata.namedAsAlias!=='makoto[switch2normal_allout]'
    ||!same(plain._abilities.map(p=>p.m_PathID),['1173964339455184421','-8663945982730842587','-84933387190612443'])
    ||!same(parallel._abilities.map(p=>p.m_PathID),['-7724450873279001051','351623471385726501'])
    ||!same(chain._abilities.map(p=>p.m_PathID),['-7444929567886029275','8808127334714560037','6602398469392944677','-6537069888397455835'])
    ||parallel._alsoInterruptSubAbilities!==1||parallel._finishAllAbilitiesIfOneFinish!==0||parallel._timeMode!==1)fail();
  for(const a of [plain,chain])if(a._alwaysNext!==1||a._forceNextIfCastFail!==0||a._checkCanUseSubAbility!==0||a._timeMode!==1
    ||a._fireCastStartEventWhenCast!==0||a._stopMoveNextWhenNotCasting!==0||a._alsoStopSubAbilityAffect!==1||a._alsoResetSubAbilityCooldown!==1)fail();
  const makeClip=(a,key,wait)=>{
    if(a._animKey!==key||a._timeMode!==1||a._maxAnimScale!==1||a._affectedBySlowDown!==1||a._faceToFront!==1
      ||a._faceToTarget!==0||a._preDelay!==0||a._escapeTime!==0||a._waitForAttackEvent!==wait||a._ignorePalsyInterrupt!==0
      ||a._endAnimKey!==''||a._activeBuffs.length)fail();
    return {clip:key,duration:c.models.Front.exactDurations[key],cooldown:a._cooldown};
  };
  const modeBuff=(b,mode)=>b?.buffKey==='makoto_switchend2normal'&&b.templateKey==='makoto_switchend2normal'&&b.lifeTimeType===0
    &&same(b.blackboard,[{key:'mode',value:mode,valueStr:''}]);
  const finish=(id,a)=>{const p=get(id);if(p.m_GameObject.m_PathID!==a.m_GameObject.m_PathID||p.m_Script.m_PathID!=='7085803614365642631'
    ||p._onlyCheckOnStopAffect!==0||p._buffs.length!==1||!modeBuff(p._buffs[0],0))fail();return p._buffs[0];};
  const loop=get('-8446961385296114139'),end=get('3959151697636412965'),hook=get('25925036447354405'),commit=get('-6537069888397455835'),broadcast=get('351623471385726501');
  if(loop._attack.m_PathID!=='0'||loop._attackTrigger.m_PathID!=='0'||loop._animatorHooker.m_PathID!=='25925036447354405'
    ||!loop._generalAbilities.some(p=>p.m_PathID==='3959151697636412965')||end._metadata.namedAsAlias!=='Allout_LoopEnd'
    ||!same(hook._replaceAnimPairs,[{fromAnimKey:'Idle',toAnimKey:'Skill_AllOutAttack_Loop'}])||hook._excludeAnimKeys.length
    ||commit._waitForCasting!==0||commit._checkBuffEarlyFinish!==1||commit._buffs.length!==2||!modeBuff(commit._buffs[0],5)
    ||commit._buffs[1].buffKey!=='makoto_switchend2normal_endcheck'||commit._buffs[1].lifeTimeType!==2
    ||commit._buffs[1].triggerInterval!==0.009999999776482582||commit._buffs[1].waitFirstTriggerInterval!==1
    ||broadcast._waitForCasting!==0||broadcast._checkBuffEarlyFinish!==1||broadcast._buffs.length!==1)fail();
  const enter=broadcast._buffs[0];
  if(enter.buffKey!=='makoto_on_enter_normal'||enter.templateKey!=='makoto_on_enter_normal'||enter.lifeTimeType!==1
    ||enter.durationKey!=='enter_normal_duration'||enter.lifeTime!==0||!same(enter.blackboard,[{key:'enter_normal_duration',value:0,valueStr:''}]))fail();
  const checks=e.templates.makoto_switchend2normal_endcheck.eventToActions;
  for(const event of ['ON_BUFF_START','ON_BUFF_TRIGGER']){
    const a=checks[event];if(a.length!==1||!type(a[0],'IfElse')||!type(a[0]._conditionNode,'CheckContainsBuff')
      ||!same(a[0]._conditionNode._buffKeys,['makoto_on_enter_normal'])||a[0]._conditionNode._checkBuffSource!==false
      ||a[0]._failNodes.length!==2||!type(a[0]._failNodes[0],'TriggerAbility')||a[0]._failNodes[0]._abilityName!=='Allout_LoopEnd'
      ||a[0]._failNodes[0]._checkCanUseAblityFlag!==false||!type(a[0]._failNodes[1],'FinishBuff'))fail();
  }
  const actions=e.templates.makoto_switchend2normal.eventToActions.ON_BUFF_START;
  if(actions.length!==3||!type(actions[0],'ClearAllBuffs')||actions[0]._alsoRemoveDurableBuff!==false||!type(actions[1],'OnRallyPointLikeReborn')
    ||!type(actions[2],'SwitchMode')||actions[2]._loadModeFromBlackboard!==true||actions[2]._restartFSM!==true)fail();
  const ending=makeClip(end,'Skill_AllOutAttack_End',1),normal=finish('-2365002026277941723',end);
  if(ending.duration!==1.4333332777023315||ending.cooldown!==0.20000000298023224||c.models.Front.exactDurations.SwitchOut!==1
    ||c.models.Front.exactDurations.Skill_AllOutAttack_Loop!==0.1666666716337204
    ||!same((e.models[MAKOTO_ID].Front.eventPayloads.Skill_AllOutAttack_End??[]).filter(v=>v.name==='OnAttack').map(v=>v.time),[0.13333334028720856]))fail();
  return freeze([false,true].map(allOut=>{
    const begin=get(allOut?'-7444929567886029275':'1173964339455184421'),heal=get(allOut?'8808127334714560037':'-8663945982730842587'),out=get(allOut?'6602398469392944677':'-84933387190612443');
    if(begin._waitForCasting!==0||begin._preDelay!==0||begin._escapeTime!==0||begin._buffs.length!==(allOut?2:1)
      ||begin._buffs[0].buffKey!=='makoto_switchbegin'||!same(begin._buffs[0].attributes.abnormalFlags,allOut?[5,18,1,6,7,15,24]:[5,18,1,6,7,15])
      ||!same(begin._buffs[0].attributes.abnormalImmunes,[0,16,19])||allOut&&begin._buffs[1].buffKey!=='makoto_forbid_idle'
      ||heal._animKey!==''||heal._waitForAttackEvent!==0||heal._activeBuffs.length!==(allOut?2:1)
      ||heal._activeBuffs[0].buffKey!=='makoto_switch[heal]'||heal._activeBuffs[0].templateKey!=='HealViaMaxHpRatio'
      ||!same(heal._activeBuffs[0].blackboard,[{key:'hp_ratio',value:1,valueStr:''}])
      ||allOut&&(heal._activeBuffs[1].buffKey!=='makoto_switchend2normal_talent_2_effect'||heal._activeBuffs[1].lifeTime!==0.30000001192092896))fail();
    const outgoing=makeClip(out,'SwitchOut',1);if(outgoing.cooldown!==(allOut?5:0))fail();
    return structuredClone({allOut,alias:allOut?parallel._metadata.namedAsAlias:plain._metadata.namedAsAlias,
      beginBuffs:begin._buffs,healBuffs:heal._activeBuffs,out:outgoing,normalBuff:allOut?normal:finish('-1013804012337574363',out),
      loopBuffs:allOut?commit._buffs:[],broadcastBuff:allOut?enter:null,ending:allOut?ending:null,
      loop:allOut?{clip:'Skill_AllOutAttack_Loop',duration:c.models.Front.exactDurations.Skill_AllOutAttack_Loop}:null,
      pollInterval:allOut?commit._buffs[1].triggerInterval:null,normalActions:actions});
  }));
}

export class MakotoPersonaReturn{
  constructor(b,u,{contract,currentMode,mayBegin,hasEnterNormal,applySource}={}){
    if(contract!==MAKOTO_RETURN_CONTRACT||[currentMode,mayBegin,hasEnterNormal,applySource].some(f=>typeof f!=='function')
      ||u.def.charId!==MAKOTO_ID||u.deploySeq!==0)throw Error('Fresh selected Makoto, exact return contract and explicit owner adapters required');
    const record=selectedMakotoInputs(u);
    Object.assign(this,{b,u,record,currentMode,mayBegin,hasEnterNormal,applySource,plans:makotoReturnPlans(),seq:null,phase:null,busy:false,stopped:false,
      handles:[],visuals:new WeakSet(),visualSeq:0});
  }
  valid(){return !this.stopped&&!this.b.finished&&this.seq!==null&&this.u.deploySeq===this.seq&&this.u.alive&&this.u.deployed&&!this.u.hidden&&!this.u.removed&&!this.u._removing;}
  owned(p){return this.valid()&&this.phase===p;}
  query(fn){try{return fn();}catch(error){this.cancel();throw error;}}
  modeIs(p,mode){const current=this.query(()=>this.currentMode());if(!this.owned(p)||current!==mode){this.cancel();return false;}return true;}
  instruction(p,kind,to=p.from){
    if(!this.owned(p))return false;
    const info=Object.freeze({from:p.from,to,seq:this.seq,ticket:p.ticket});
    const accepted=this.query(()=>this.applySource(kind,p.plan,info));
    if(accepted!==true){this.cancel();return false;}
    return this.modeIs(p,to);
  }
  visual(p,clip,loop=false){if(!this.owned(p))return;const v={clip,loop,speed:this.u.s.slowDownRate,forceFront:true,playId:`makoto:return:${this.seq}:${++this.visualSeq}`};
    this.visuals.add(v);p.visual=v;this.u.mem.regularFormVisual=v;}
  start({allOut}={}){
    if(this.busy||this.phase||!this.valid()||typeof allOut!=='boolean')return false;
    this.busy=true;
    try{
      const from=this.query(()=>this.currentMode());if(!this.valid()||!(from===this.record.index+1||this.record.index===2&&from===4))return false;
      if(this.query(()=>this.mayBegin({from,allOut,seq:this.seq}))!==true||!this.valid()||this.query(()=>this.currentMode())!==from||!this.valid())return false;
      const p={from,plan:this.plans[allOut?1:0],ticket:Object.freeze({}),step:'out',age:0,lastAt:this.b.time};this.phase=p;
      if(!this.instruction(p,'begin')||!this.instruction(p,'heal'))return false;
      // The broadcast is a parallel branch, not an outgoing animation marker.
      if(allOut&&!this.instruction(p,'broadcast'))return false;
      this.visual(p,p.plan.out.clip);return true;
    }finally{this.busy=false;}
  }
  poll(p){
    if(!this.owned(p)||p.step!=='loop'||!this.modeIs(p,5))return;
    const present=this.query(()=>this.hasEnterNormal(p.ticket));
    if(!this.owned(p)||!this.modeIs(p,5))return;
    if(typeof present!=='boolean'){this.cancel();throw Error('Explicit owning on-enter-normal buff presence required');}
    if(!present){p.step='end';p.age=0;p.lastAt=this.b.time;this.visual(p,p.plan.ending.clip);}
    else p.nextPollAt=this.b.time+p.plan.pollInterval;
  }
  tick(){
    const p=this.phase;if(!p||this.busy)return;this.busy=true;
    try{
      if(!this.modeIs(p,p.step==='out'?p.from:5))return;
      if(this.u.mem.regularFormVisual===p.visual)p.visual.speed=this.u.s.slowDownRate;
      if(p.step==='loop'){if(due(this.b.time,p.nextPollAt))this.poll(p);return;}
      p.age+=sourceAbilityDelta(this.u,Math.max(0,this.b.time-p.lastAt),true);p.lastAt=this.b.time;
      if(!due(p.age,p.step==='out'?p.plan.out.duration:p.plan.ending.duration))return;
      if(p.step==='out'&&p.plan.allOut){
        if(!this.instruction(p,'loop',5))return;p.step='loop';this.visual(p,p.plan.loop.clip,true);this.poll(p);return;
      }
      if(!this.instruction(p,'normal',0))return;this.phase=null;this.clearVisual();
    }finally{this.busy=false;}
  }
  clearVisual(){if(this.u.deploySeq===this.seq&&this.visuals.has(this.u.mem.regularFormVisual))delete this.u.mem.regularFormVisual;}
  cancel(){this.phase=null;this.clearVisual();}
  install(){
    if(this.stopped||this.handles.length||this.u.deploySeq!==0||this.u.mem.makotoReturn&&this.u.mem.makotoReturn!==this)throw Error('Fresh Makoto return owner required; cannot reinstall');
    this.u.mem.makotoReturn=this;const{b,u}=this;
    this.handles=[b.on('deploy',({unit,move})=>{if(unit!==u||move)return;if(this.seq!==null){if(u.deploySeq!==this.seq)this.stop();return;}this.seq=u.deploySeq;},{owner:u}),
      b.on('tick',()=>{if(this.seq!==null&&!this.valid())this.stop();else this.tick();},{owner:u}),
      ...['removed','death'].map(event=>b.on(event,({unit})=>{if(unit===u)this.stop();},{owner:u})),b.on('battleEnd',()=>this.stop(),{owner:u})];
  }
  stop(){if(this.stopped)return;this.stopped=true;this.cancel();for(const h of this.handles)this.b.off(h);this.handles=[];}
}
