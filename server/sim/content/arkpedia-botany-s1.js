// SPDX-License-Identifier: GPL-3.0-or-later
import {BOTANY_ID, selectedBotanyInputs, botanyNativeInputs} from './arkpedia-botany-source.js';
import {BotanyOrdinaryAttacks, BOTANY_ORDINARY_CONTRACT} from './arkpedia-botany-ordinary.js';
import {BotanyBurstTalent, BOTANY_TALENT_CONTRACT} from './arkpedia-botany-talent.js';
import {hasHp} from '../damage.js';

export const BOTANY_S1_CONTRACT = Object.freeze({
 scope:'Selected Botany ordinary Arts attacks, owned burst talent and original automatic single-charge S1; no S2 or public registration.',
 mapping:'One next-attack automatic account captures one legal input. Original Skill_1 releases at its .8000000119 marker into speed-twelve finite transport. Native earlySkillFinishAtAttackFinished0 maps explicitly to holding SP through at least the full original clip and sampled attack cycle, including control after release; an interrupted unfired account keeps its existing deadline. Lost input life before projectile birth refunds one charge. Arrival uses primary Arts, independent non-missable extra-buff admission, then primary erosion. The accepted instant template checks the current per-element untouched erosion gauge, adds its extra Arts then erosion, and is removed synchronously. Erosion ratios use source ATK, not the HP-damage attack-scale multiplier. Each action rechecks target life and source lookup.',
 limitations:'Account/FSM completion, native numeric WATER, per-element full-gauge meaning and primary/buff/element ordering are explicit local mappings. A different element burst does not itself count as erosion injury, while the shared burst lock still rejects new injury. Compiled dispatch, per-callback source attributes, S2, public artwork/data/browser admission, modules, native effects/audio and game-frame/pixel parity remain unverified.',
 frameParity:false,
});
const present = u => u?.alive && u.deployed && !u.removed;
const due = (a, z) => a >= z - 1e-8;

export function verifyBotanyS1(n=botanyNativeInputs()){
 const s=n.s1,a=n.s1Attack,parts=n.projectiles.projectile_chr_botany_s1.flatMap(r=>r.components.map(c=>c.data)),
  p=parts.find(d=>d._lifeTime!=null),m=parts.find(d=>d._speed!=null),buff=a._activeBuffs[0],nodes=n.templates.botany_s1_extra.eventToActions.ON_BUFF_START;
 if(s._playSkillBeginAnim!==0||s._allowSpRecoveryWhenAffecting!==0||s._recoverSpIfTargetDead!==1
  ||s._stopAffectOnInterrupt!==0||s._earlySkillFinishAtAttackFinished!==0||s._canSilenced!==0||s._canUseInAbnormalState!==0
  ||a._animKey!=='Skill_1'||a._projectileKey!=='projectile_chr_botany_s1'||a._selectTargetSource!==2
  ||a._waitForAttackEvent!==1||a._maxAnimScale!==1||a._affectedBySlowDown!==0||a._elementDamageType!==2
  ||buff.templateKey!=='botany_s1_extra'||buff.stripBlackboardParamsWithBuffKey!==1||buff.isDamageMissable!==0
  ||nodes[0]._elementType!=='WATER'||!nodes[0].$type.includes('CheckTargetEpIsFull')
  ||nodes[1]._damageType!=='MAGICAL'||nodes[1]._atkScaleVar!=='atk_scale'||nodes[2]._elementDamageType!=='WATER'
  ||nodes[2]._epDamageScale!=='ep_damage_ratio'||p._lifeTime!==10||p._stopWhenSourceInvalid!==0||p._maxHitNum!==1||m._speed!==12)
  throw Error('Changed original Botany S1 inputs');
}

export class BotanySkillOne extends BotanyOrdinaryAttacks {
  constructor(b, u, talent, {contract} = {}) {
    if (contract !== BOTANY_S1_CONTRACT || selectedBotanyInputs(u).index !== 0)
      throw Error('Original selected Botany S1 and exact contract required');
    super(b, u, {contract: BOTANY_ORDINARY_CONTRACT, mayBegin: () => true});
    verifyBotanyS1(); this.talent = talent; this.reservation = null; this.startingInput = null; this.finishing = false;
    this.mayBegin = () => !this.reservation?.interrupted;
    this.skillShot = Object.freeze({clip: 'Skill_1', scale: this.record.bb.atk_scale,
      projectileSpeed: 12, isSkill: true, tag: 'botany:s1', projectileKey:'projectile_chr_botany_s1'});
  }
  skillChoices() { return super.choices(); }
  choices() {
    if (this.u.skill.ready && !this.u.skill.active) {
      const candidates = this.skillChoices(); if (candidates.length) return candidates;
    }
    return super.choices();
  }
  canStart() {
    return this.valid() && !this.u.hidden && this.u.canAct && !this.u.s.flags.disarm && !this.u.skill.active
      && !this.phase && due(this.b.time, this.bornUntil) && this.u.atkCd <= 1e-8 && this.skillChoices().length > 0;
  }
  canCast() { return !!this.startingInput && this.canStart(); }
  begin(target) {
    if (this.u.skill.ready && this.canStart()) {
      const input = this.skillChoices()[0];
      this.startingInput = {target: input, life: input.deploySeq};
      try { this.u.skill.activate('source-auto'); } finally { this.startingInput = null; }
      return;
    }
    super.begin(target);
  }
  startSkill() {
    if (!this.valid() || !this.u.skill.active) return;
    const input = this.startingInput;
    if (!input) throw Error('Botany S1 requires its captured activation input');
    const {target, life} = input;
    super.begin(target, this.skillShot);
    const p = this.phase;
    p.life = life; p.untilAge=Math.max(p.untilAge,this.model().exactDurations.Skill_1);
    this.reservation = {phase: p, activation: this.u.skill.activations, sourceLife: this.seq,
      target, life, interrupted: false,
      endsAt: this.b.time + p.untilAge / p.speed};
  }
  admit(targets) {
    if (this.phase?.shot.isSkill && (!this.u.skill.active || !this.u.skill.pending
      || this.reservation?.activation !== this.u.skill.activations || this.reservation?.interrupted)) return false;
    return super.admit(targets);
  }
  finishSkill(reason, refund = false) {
    const reservation = this.reservation;
    if (reservation && reservation.activation !== this.u.skill.activations) return;
    this.finishing = true;
    try {
      if (this.u.skill.active) this.u.skill.end(reason);
      if (refund && this.valid()) this.u.skill.addCharge(1);
    } finally { this.finishing = false; this.reservation = null; }
  }
  completeReservation(reason) {
    const r = this.reservation;
    if (!r || !this.valid()) return;
    const lost = !present(r.target) || r.target.deploySeq !== r.life;
    this.finishSkill(reason, !r.phase.accepted && lost);
  }
  completed(p) { if (p.shot.isSkill && this.reservation?.phase === p) this.completeReservation('attack-finished'); }
  interrupted(p) {
    if (p?.shot.isSkill && this.reservation?.phase === p) this.reservation.interrupted = true;
  }
  skillEnded() {
    if (this.finishing) return;
    this.reservation = null;
    if (this.phase?.shot.isSkill) this.phase = null;
    if (this.valid()) this.idle();
  }
  tick() {
    if (this.valid() && this.reservation?.interrupted && due(this.b.time, this.reservation.endsAt)) {
      this.completeReservation('interrupted-cycle-finished');
      if (this.valid()) this.idle();
    }
    super.tick();
  }
  impact(ctx){
    if(!ctx.shot.isSkill)return super.impact(ctx);
    const {source,target,life,info}=ctx,b=this.b,bb=this.record.bb;
    const alive=()=>!b.finished&&hasHp(target)&&target.deployed&&!target.removed&&!target.hidden&&target.deploySeq===life;
    const injury=(ratio,tag)=>{if(!alive())return;const u=source();b.dealDamage(u,target,{amount:u.s.atk*ratio,type:'element',element:'erosion',
      isAttack:false,isSkill:true,isProjectile:true,attackId:info.attackId,canDodge:false,tags:[tag]});};
    super.impact(ctx);if(!alive())return;
    const token={owner:this,life,finished:false};let buff;
    try{
      buff=b.addBuff(target,{key:`botany_s1_extra:${this.u.id}:${this.seq}:${info.attackId}`,source:source(),duration:0,refresh:'keep',
        data:{botanyExtra:token},onRemove:()=>{token.finished=true;}});
      if(buff?.data?.botanyExtra===token&&!token.finished&&alive()&&(target.elem.erosion??0)<=1e-9
        &&!target.findBuff('erosionBurst')&&!target.burstPending?.erosion){
        const u=source();b.dealDamage(u,target,{amount:u.s.atk*u.s.atkScaleMul*bb['botany_s1_extra.atk_scale'],type:'arts',
          isAttack:false,isSkill:true,isProjectile:true,applyWay:'ranged',attackId:info.attackId,tags:['botany:s1-extra']});
        if(!token.finished)injury(bb['botany_s1_extra.ep_damage_ratio'],'botany:s1-extra-injury');
      }
    }finally{if(buff?.data?.botanyExtra===token&&target.buffs.includes(buff))b.removeBuff(target,buff);}
    injury(bb.ep_damage_ratio,'botany:s1-injury');
  }
  spec() { return {kind: 'instant', silenceable: false, trigger: {rule: 'NEVER'}, flags: {noSp: true}, holdSpWhileActive: true,
    attack: {}, completeOnAttack: false, pendingText: 'Skill active',
    canActivate: () => this.canCast(), onStart: () => this.startSkill(), onEnd: () => this.skillEnded()}; }
  install() { this.talent.install(); super.install(); }
  stop() {
    if(this.stopped||this.stopping)return;this.stopping=true;
    try{
      if(this.reservation&&this.u.deploySeq===this.seq&&this.reservation.activation===this.u.skill.activations)
        this.finishSkill('controller-removed');
      super.stop();this.reservation=null;this.talent.stop();
    }finally{this.stopping=false;}
  }
}

export function prepareBotanyS1(b, u, {contract} = {}) {
  if (contract !== BOTANY_S1_CONTRACT || u.def.charId !== BOTANY_ID || u.deploySeq !== 0 || u.mem.botany)
    throw Error('Fresh selected Botany S1 and exact controller contract required');
  const talent = new BotanyBurstTalent(b, u, {contract: BOTANY_TALENT_CONTRACT});
  const controller = new BotanySkillOne(b, u, talent, {contract}); u.mem.botany = controller;
  return {record: controller.record, talent, controller, kit: {install: null, talents: [],
    trait: controller.trait(), skill: controller.spec()}};
}
