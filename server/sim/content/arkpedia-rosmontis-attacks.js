// SPDX-License-Identifier: GPL-3.0-or-later
// Unregistered ordinary/S1 adapter. S2/S3 and public enablement remain separate gates.
import evidence from '../../../data/arkpedia-rosmontis-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { normalizeChess } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';

export const ROSMONTIS_ID = 'char_391_rosmon';
export const ROSMONTIS_ATTACK_CONTRACT = Object.freeze({
  input: 'PRECAST life identity; main centre sampled at accepted birth; aftershock retains that centre',
  clocks: 'original facing event and native delta scale by captured base-attack-time/current interval',
  alternation: 'first ordinary Attack_A then alternate accepted ordinary attacks; S1 always Attack_A',
  damage: 'separate current-ATK Physical main/aftershock; main-only current-ATK Arts S1 receipt',
  sp: 'one offensive SP per accepted ordinary command; S1 holds SP through captured full attack clip',
  invalid: 'dead/changed-life input before birth refunds S1; control cancels unborn output without refund',
  aura: 'random existing Caster on owner deployment; later deployments fill a vacant extra recipient slot',
  auraEvidence: 'Native conditional count/aura fields; deployment-order and retained self bonus corroborated by authored PRTS notes',
  auraSource: 'https://prts.wiki/w/Rosmontis#天赋',
  limits: 'First-clip choice, centre geometry, clocks, receipt ordering, refund/control and aura claims are local mappings; native compiled callback/FSM/frame parity, particles/audio and modules are unverified',
  frameParity: false,
});
const flat = rows => Object.fromEntries(rows.map(v => [v.key, v.value]));
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const grid = id => id ? evidence.tables.ranges[id].grids.map(v => [v.row, v.col]) : [];
const component = (group, id) => Object.values(evidence[group]).flatMap(rows => rows.flatMap(r => r.components))
  .find(c => c.pathId === id)?.data;
const ordinary = component('characters', '2024263541393947419');
const nextAttack = component('skills', '-3989187602593460007');
const recovery = component('skills', '1896313461372113113');
const radius = component('projectiles', '6236940736852187368').m_Radius;
const model = u => evidence.models[ROSMONTIS_ID][['UP','LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const interpolate = (frames, level) => {
  const lo = frames[0], hi = frames.at(-1);
  const t = hi.level === lo.level ? 0 : (level - lo.level) / (hi.level - lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([,v]) => typeof v === 'number')
    .map(([k,v]) => [k, v + (hi.data[k] - v) * t]));
};

/** Selected no-module source data, also usable by the later S2/S3 adapters. */
export function selectedRosmontisBuild(build) {
  const c = evidence.tables.character;
  if (!build || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.trust ?? 0) || (build.trust ?? 0) < 0 || (build.trust ?? 0) > 200
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4,7,10][build.elite]
    || build.module && build.module !== 'none') throw Error('Invalid Rosmontis source build');
  const index = ['skchr_rosmon_1','skchr_rosmon_2','skchr_rosmon_3'].indexOf(build.skillId);
  if (index < 0 || index > build.elite) throw Error('Locked Rosmontis source skill');
  const phase = c.phases[build.elite], source = evidence.tables.skills[build.skillId].levels[build.skillRank - 1];
  const stats = interpolate(phase.attributesKeyFrames, build.level);
  // Match the ordinary selected-loadout path: combine interpolated level and
  // trust first, round integral HP/ATK/DEF once, preserve fractional timings.
  const favor = interpolate(c.favorKeyFrames, Math.min(100, build.trust ?? 0) / 2);
  for (const k of ['maxHp','atk','def']) stats[k] = Math.round(stats[k] + favor[k]);
  const attributes = { COST:'cost', RESPAWN_TIME:'respawnTime', ATK:'atk' };
  for (const rank of c.potentialRanks.slice(0, build.potential - 1))
    for (const mod of rank.buff?.attributes.attributeModifiers ?? []) {
      if (!attributes[mod.attributeType] || mod.formulaItem !== 'ADDITION')
        throw Error('Unreviewed Rosmontis potential modifier');
      stats[attributes[mod.attributeType]] += mod.value;
    }
  const talents = c.talents.map(v => sourceCandidate(v.candidates, build)).filter(Boolean);
  return { build: { ...build }, index, skillId:build.skillId, source, bb:flat(source.blackboard), stats,
    rangeGrid:grid(phase.rangeId), talents,
    penetration:flat(talents.find(v => v.prefabKey === '1')?.blackboard ?? []).def_penetrate_fixed ?? 0,
    aura:flat(talents.find(v => v.prefabKey === '2')?.blackboard ?? []).atk ?? 0 };
}

function selected(u, contract) {
  if (contract !== ROSMONTIS_ATTACK_CONTRACT) throw Error('Rosmontis requires the reviewed attack contract');
  if (u.def.charId !== ROSMONTIS_ID || u.mem.rosmontisAttackController || u.deploySeq !== 0)
    throw Error('Rosmontis requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId:u.def.skill?.id }, r = selectedRosmontisBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || r.index !== 0 || s.skillType !== 'AUTO' || s.spType !== 'attack'
    || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp
    || s.maxCharges !== r.source.spData.maxChargeTime || s.duration !== r.source.duration
    || !same(s.bb, r.bb) || !same(s.rangeGrid ?? [], grid(r.source.rangeId))
    || !same(u.rangeGrid, r.rangeGrid) || !same(u.def.stats, normalizeChess({ stats:r.stats }).stats)
    || !same(u.def.talents.map(v => v.bb), r.talents.map(v => flat(v.blackboard))))
    throw Error('Incomplete Rosmontis ordinary/S1 selected source');
  if (ordinary._additionalTimes !== 1 || ordinary._waitForAttackEvent !== 1
    || nextAttack._onlyFeedActiveBuffToFirstOne !== 1 || nextAttack._additionalTimes !== 1
    || recovery._recoverSpIfTargetDead !== 1 || ordinary._triggerDelta <= 0)
    throw Error('Unreviewed Rosmontis native attack fields');
  return r;
}

/** Source conditional aura, with independent claims for separate owner lives.
 * Leaving recipients lose their bonus. Existing other Casters keep the self
 * condition true; a later Caster deployment may fill the vacant extra slot.
 * Eligibility changes temporarily suspend the chosen recipient's buff. */
class RosmontisCasterAura {
  constructor(controller) {
    this.c = controller; this.b = controller.b; this.u = controller.u;
    this.recipient = null; this.claims = new Map(); this.key = null; this.refreshing = false;
  }
  casters() { return this.b.allyUnits.filter(a => live(a) && a.kind === 'op' && a.def.profession === 'CASTER'); }
  eligible(a) { return live(a) && a.kind === 'op' && a.def.profession === 'CASTER' && this.b.allySelectable(a, this.u); }
  begin() {
    this.clear(); this.key = `rosmontis:aura:${this.u.id}:${this.u.deploySeq}`;
    const candidates = this.casters().filter(a => this.eligible(a));
    if (this.c.record.aura && candidates.length) this.recipient = candidates[Math.floor(this.b.rng() * candidates.length)];
    this.refresh();
  }
  refresh(deployed = null) {
    // A synchronous buff/death callback can re-enter the aura. Its enclosing
    // refresh rechecks eligibility before claiming any just-created buff.
    if (this.refreshing) return;
    this.refreshing = true;
    try { this.refreshClaims(deployed); } finally { this.refreshing = false; }
  }
  refreshClaims(deployed) {
    if (!this.c.valid() || !this.c.record.aura) { this.clear(); return; }
    if (this.recipient && !live(this.recipient)) this.recipient = null;
    if (!this.recipient && deployed && this.eligible(deployed)) this.recipient = deployed;
    const targets = new Set();
    if (this.casters().length) {
      targets.add(this.u); if (this.eligible(this.recipient)) targets.add(this.recipient);
    }
    for (const [a, buff] of this.claims) if (!targets.has(a) || a.findBuff(this.key) !== buff) {
      if (a.findBuff(this.key) === buff) this.b.removeBuff(a, buff);
      this.claims.delete(a);
    }
    for (const a of targets) if (!this.claims.has(a)) {
      // An external replacement under the same key is not this aura's claim.
      if (a.findBuff(this.key)) continue;
      const buff = this.b.addBuff(a, { key:this.key, source:this.u, mods:{ atkPct:this.c.record.aura } });
      // Buff hooks may synchronously withdraw either side or reject the buff.
      if (buff && this.c.valid() && targets.has(a) && (a === this.u || this.eligible(a))
        && this.casters().length && a.findBuff(this.key) === buff) this.claims.set(a, buff);
      else if (buff && a.findBuff(this.key) === buff) this.b.removeBuff(a, buff);
    }
  }
  clear() {
    for (const [a,buff] of this.claims) if (a.findBuff(this.key) === buff) this.b.removeBuff(a, buff);
    this.claims.clear(); this.recipient = null;
  }
}

export class RosmontisAttackController {
  constructor(b,u,record) {
    this.b=b; this.u=u; this.record=record; this.phase=null; this.seq=null; this.epoch=u.attackControlEpoch;
    this.nextOrdinary='Attack_A'; this.stopped=false; this.handles=[]; this.outputs=new Set();
    this.aura=new RosmontisCasterAura(this); this.finishHook=null;
  }
  valid() { return !this.stopped && !this.b.finished && live(this.u) && this.seq === this.u.deploySeq; }
  visual(clip,speed=1,loop=false) { this.u.mem.regularFormVisual={ clip,speed,loop }; }
  targets() {
    const keys=new Set(absoluteRangeKeys(this.u.rangeGrid,this.u.tileR,this.u.tileC,this.u.dir));
    const rows=this.b.enemies.filter(e => canTargetEnemy(this.u,e,{ groundOnly:true,canHitFly:false })
      && (!e.s.flags.camou || !!e.blockedBy) && (bodyInKeys(e,keys) || e.blockedBy===this.u));
    sortEnemyTargets(this.b,this.u,rows); return rows;
  }
  release(target,info) {
    const p=this.phase,u=this.u,b=this.b;
    if (!this.valid() || !u.canAct || u.s.flags.disarm || !p || p.kind!=='attack' || p.accepted
      || p.target!==target || p.epoch!==u.attackControlEpoch || p.seq!==u.deploySeq
      || target.deploySeq!==p.targetSeq || !canTargetEnemy(u,target,{ groundOnly:true,canHitFly:false })
      || b.time+1e-9<p.releaseAt || !!info.isSkill!==p.skill) return false;
    p.accepted=true;
    if (!p.skill) this.nextOrdinary=p.clip==='Attack_A'?'Attack_B':'Attack_A';
    const command={ x:target.x,y:target.y,attackId:info.attackId,isSkill:p.skill,
      timer:null,cancelled:false };
    this.outputs.add(command);
    // Schedule before damage hooks: a born aftershock belongs to this accepted
    // command and may finish after owner withdrawal/death. It never follows the
    // original target, substitutes a target life, or produces another attack SP.
    command.timer=b.after(ordinary._triggerDelta/p.speed,() => {
      this.hit(command,1); this.outputs.delete(command); this.releaseFinishHook();
    });
    b.emit('rosmontisProjectileBirth',{ owner:u,command,index:0 });
    this.hit(command,0); return true;
  }
  hit(command,index) {
    const b=this.b,u=this.u;
    if (b.finished || command.cancelled) return;
    const targets=b.foesInRadius(command.x,command.y,radius,true)
      .filter(e => canTargetEnemy(u,e,{ groundOnly:true,canHitFly:false }));
    if (index) b.emit('rosmontisProjectileBirth',{ owner:u,command,index });
    for (const target of targets) {
      if (b.finished || command.cancelled) break;
      // Every receipt uses the ordinary damage pipeline independently: DEF,
      // RES, penetration, dodge, shields, hit hooks, hurt SP and kill credit.
      if (!canTargetEnemy(u,target,{ groundOnly:true,canHitFly:false })) continue;
      const scale=index ? this.record.bb.append_atk_scale : 1;
      b.dealDamage(u,target,{ amount:u.s.atk*u.s.atkScaleMul*scale,type:'phys',
        isAttack:true,isSkill:command.isSkill,isSplash:true,applyWay:'ranged',attackId:command.attackId,
        tags:index?['aftershock']:[] });
      // The native active buff is fed only to the main projectile. Arts is a
      // separate current-ATK receipt, never half-scaled or repeated afterwards.
      if (!index && command.isSkill && live(target) && !b.finished && !command.cancelled)
        b.dealDamage(u,target,{ amount:u.s.atk*u.s.atkScaleMul*this.record.bb.extra_atk_scale,type:'arts',
          isAttack:true,isSkill:true,isSplash:true,applyWay:'none',attackId:command.attackId });
    }
  }
  cancelPhase(reason='control') {
    const p=this.phase; this.phase=null;
    if (p?.skill && !p.accepted && this.u.skill.active) {
      this.u.skill.end(reason);
      if (reason==='lost-input' && live(this.u)) this.u.skill.addCharge(1);
    }
    this.b.removeBuff(this.u,'rosmontis:cast');
  }
  tick() {
    const b=this.b,u=this.u;
    if (!this.valid()) { if (!this.stopped && !b.finished && u.deploySeq===0) return; this.stop(); return; }
    this.aura.refresh();
    let p=this.phase;
    if (p?.kind==='entrance') {
      this.epoch=u.attackControlEpoch;
      if (b.time+1e-9<p.readyAt) return;
      this.phase=null; p=null; this.visual('Idle',1,true);
    }
    if (!u.canAct || u.s.flags.disarm || this.epoch!==u.attackControlEpoch) {
      this.cancelPhase(); this.epoch=u.attackControlEpoch; this.visual('Idle',1,true); return;
    }
    if (p) {
      if (!p.accepted && (!live(p.target) || p.target.deploySeq!==p.targetSeq)) {
        this.cancelPhase('lost-input'); this.visual('Idle',1,true); return;
      }
      if (!p.released && b.time+1e-9>=p.releaseAt) {
        p.released=true; b.forceAttack(u,[p.target]);
        if (!this.valid()) return;
        if (!p.accepted) this.cancelPhase(!live(p.target)||p.target.deploySeq!==p.targetSeq?'lost-input':'rejected');
      }
      if (b.time+1e-9<p.readyAt) return;
      this.phase=null; b.removeBuff(u,'rosmontis:cast');
    }
    if (u.atkCd>1e-9) return;
    const target=this.targets()[0];
    if (!target) { this.visual('Idle',1,true); return; }
    const epoch=u.attackControlEpoch, targetSeq=target.deploySeq;
    const skill=!u.s.flags.silence && u.skill.ready && u.skill.activate('source-next-attack');
    // Skill-start hooks may remove/control the owner or kill the chosen input
    // before the attack phase exists. Do not leave a spent pending S1 behind.
    if (!this.valid() || !u.canAct || u.s.flags.disarm || epoch!==u.attackControlEpoch) {
      if (skill && u.skill.active) u.skill.end('control');
      this.epoch=u.attackControlEpoch; return;
    }
    if (!live(target) || target.deploySeq!==targetSeq) {
      if (skill && u.skill.active) { u.skill.end('lost-input'); u.skill.addCharge(1); }
      return;
    }
    const clip=skill?'Attack_A':this.nextOrdinary,speed=u.base.bat/u.s.interval;
    const event=model(u).eventPayloads[clip].find(e=>e.name==='OnAttack').time/speed;
    const full=model(u).durations[clip]/speed;
    this.phase={ kind:'attack',target,targetSeq:target.deploySeq,seq:u.deploySeq,epoch:u.attackControlEpoch,
      skill:!!skill,clip,speed,releaseAt:b.time+event,readyAt:b.time+Math.max(full,u.s.interval),
      accepted:false,released:false };
    this.visual(clip,speed); u.atkCd=u.s.interval;
    if (skill) b.addBuff(u,{ key:'rosmontis:cast',flags:{ noSp:true },source:u });
  }
  install() {
    if (this.handles.length || this.stopped) return;
    const b=this.b,u=this.u;
    u.mem.rosmontisAttackController=this;
    if (this.record.penetration) b.addBuff(u,{ key:'rosmontis:penetration',persist:true,allowDead:true,
      source:u,mods:{ defIgnoreFlat:this.record.penetration } });
    this.handles=[b.on('tick',()=>this.tick(),{ owner:u }),
      b.on('deploy',({unit})=>{
        if (unit===u) {
          this.seq=u.deploySeq; this.epoch=u.attackControlEpoch; this.visual('Start');
          this.phase={ kind:'entrance',readyAt:b.time+model(u).durations.Start }; this.aura.begin();
        } else this.aura.refresh(unit);
      },{ owner:u }),b.on('death',({unit})=>{
        if (unit===u) this.stop(); else this.aura.refresh();
      },{ owner:u })];
    this.finishHook=b.on('battleEnd',()=>{ this.stop(); this.cancelOutputs(); });
  }
  stop() {
    if (this.stopped) return;
    this.stopped=true; this.cancelPhase('owner-finish'); this.aura.clear();
    this.b.removeBuff(this.u,'rosmontis:penetration'); this.u.mem.regularFormVisual=null;
    for (const h of this.handles) this.b.off(h); this.handles=[];
    this.releaseFinishHook();
  }
  cancelOutputs() {
    for (const command of this.outputs) { command.cancelled=true; command.timer?.cancel(); }
    this.outputs.clear(); this.releaseFinishHook();
  }
  releaseFinishHook() {
    if ((this.stopped || this.b.finished) && !this.outputs.size && this.finishHook) {
      this.b.off(this.finishHook); this.finishHook=null;
    }
  }
}

export function prepareRosmontisAttacks(b,u,{contract}={}) {
  const record=selected(u,contract),controller=new RosmontisAttackController(b,u,record);
  const kit={ trait:{ noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'phys',projectile:'none',
    hits:1,hitsFn:null,chain:null,splashRadius:0,heal:null,canHitFly:false,groundOnly:true,
    install:null,afterAttack:null,onHit:null,onEachHit:null,requiresAcceptedLaunch:true,attackVisual:'none',
    launchAttack:(_b,_u,_p,t,info)=>controller.release(t,info) },
    skill:{ kind:'instant',trigger:{ rule:'NEVER' },attack:{},
      canActivate:()=>controller.valid() && !controller.phase && u.canAct && !u.s.flags.disarm && !u.s.flags.silence },
    talents:[],install:null };
  return { record,controller,kit };
}
