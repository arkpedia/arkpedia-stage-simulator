// SPDX-License-Identifier: GPL-3.0-or-later
// Unregistered ordinary/S1 adapter. S2/S3 and public enablement remain separate gates.
import { WisadelProjectiles } from './arkpedia-wisadel-projectiles.js';
import evidence from '../../../data/arkpedia-wisadel-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { normalizeChess } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';

export const WISADEL_ID = 'char_1035_wisdel';
export const WISADEL_ATTACK_CONTRACT = Object.freeze({
  input:'PRECAST life identity; homing root-coordinate projectile retains impact centre',
  clocks:'original facing event and full clip use captured base/current interval; S1 animation capped at one',
  selection:'uniform ordinary A/B/C selection excluding last accepted ordinary clip; S1 uses Skill_1',
  outputs:'independent speed-ten root homing, five/eight-second lifetimes and absolute native reached delays .15/.5/.65; separate live-ATK receipts',
  marks:'nonstacking shared afterimage ID; first accepted source owns parent cleanup; successful detonation consumes mark',
  sp:'one offensive SP per accepted command; S1 holds SP through the full captured attack clip',
  invalid:'dead/changed-life input before birth refunds S1; control cancels unborn output without refund',
  limits:'Private ordinary/S1 implementation only. T2 Shadows, S2/S3, modules, original effects/audio and compiled Unity frame parity are pending. Root geometry/mount aliases, ordered post-damage explosion checks including lethal original-life centres, first-source mark claims, sampled homing, same-tick stun life snapshots, random clip choice/clocks and lifecycle are explicit local mappings.',
  frameParity:false,
});
const flat = rows => Object.fromEntries(rows.map(v => [v.key, v.value]));
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const grid = id => id ? evidence.tables.ranges[id].grids.map(v => [v.row, v.col]) : [];
const component = (group, id) => Object.values(evidence[group]).flatMap(rows => rows.flatMap(r => r.components))
  .find(c => c.pathId === id)?.data;
const ordinary=component('characters','-1978783587831353889');
const recovery=component('skills','7108071248172897171');
const model=u=>evidence.models[WISADEL_ID][['UP','LEFT'].includes(u.dir)?'Back':'Front'];
const interpolate = (frames, level) => {
  const lo = frames[0], hi = frames.at(-1);
  const t = hi.level === lo.level ? 0 : (level - lo.level) / (hi.level - lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([,v]) => typeof v === 'number')
    .map(([k,v]) => [k, v + (hi.data[k] - v) * t]));
};

/** Selected no-module source data, also usable by the later S2/S3 adapters. */
export function selectedWisadelBuild(build) {
  const c = evidence.tables.character;
  if (!build || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.trust ?? 0) || (build.trust ?? 0) < 0 || (build.trust ?? 0) > 200
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4,7,10][build.elite]
    || build.module && build.module !== 'none') throw Error('Invalid Wisadel source build');
  const index = ['skchr_wisdel_1','skchr_wisdel_2','skchr_wisdel_3'].indexOf(build.skillId);
  if (index < 0 || index > build.elite) throw Error('Locked Wisadel source skill');
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
        throw Error('Unreviewed Wisadel potential modifier');
      stats[attributes[mod.attributeType]] += mod.value;
    }
  const talents = c.talents.map(v => sourceCandidate(v.candidates, build)).filter(Boolean);
  return { build: { ...build }, index, skillId:build.skillId, source, bb:flat(source.blackboard), stats,
    rangeGrid:grid(phase.rangeId), talents,
    talent:flat(talents.find(v=>v.prefabKey==='1')?.blackboard??[])  };
}

export function validateWisadelSelection(u, contract, expectedContract, index) {
  if (contract !== expectedContract) throw Error('Wisadel requires the reviewed attack contract');
  if (u.def.charId !== WISADEL_ID || u.mem.wisadelAttackController || u.deploySeq !== 0)
    throw Error('Wisadel requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId:u.def.skill?.id }, r = selectedWisadelBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || r.index !== index || s.skillType !== r.source.skillType || s.spType !== (index===0?'attack':'time')
    || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp
    || s.maxCharges !== r.source.spData.maxChargeTime || s.duration !== r.source.duration
    || !same(s.bb, r.bb) || !same(s.rangeGrid ?? [], grid(r.source.rangeId))
    || !same(u.rangeGrid, r.rangeGrid) || !same(u.def.stats, normalizeChess({ stats:r.stats }).stats)
    || !same(u.def.talents.map(v => v.bb), r.talents.map(v => flat(v.blackboard))))
    throw Error('Incomplete Wisadel selected source');
  if(ordinary._waitForAttackEvent!==1 || recovery._recoverSpIfTargetDead!==1)
    throw Error('Unreviewed Wisadel native attack fields');
  return r;
}

export class WisadelAttackController {
  constructor(b,u,record) {
    this.b=b; this.u=u; this.record=record; this.phase=null; this.seq=null; this.epoch=u.attackControlEpoch;
    this.lastOrdinary=null; this.stopped=false; this.handles=[];
    this.projectiles=new WisadelProjectiles(b,u,record);
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
    if(!p.skill)this.lastOrdinary=p.clip;
    this.projectiles.launch(target,info,p.skill);
    return true;
  }
  cancelPhase(reason='control') {
    const p=this.phase; this.phase=null;
    if (p?.skill && !p.accepted && this.u.skill.active) {
      this.u.skill.end(reason);
      if (reason==='lost-input' && live(this.u)) this.u.skill.addCharge(1);
    }
    this.b.removeBuff(this.u,'wisadel:cast');
  }
  tick() {
    const b=this.b,u=this.u;
    if (!this.valid()) { if (!this.stopped && !b.finished && u.deploySeq===0) return; this.stop(); return; }

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
      this.phase=null; b.removeBuff(u,'wisadel:cast');
    }
    if (u.atkCd>1e-9) return;
    const target=this.targets()[0];
    if (!target) { this.visual('Idle',1,true); return; }
    const epoch=u.attackControlEpoch, targetSeq=target.deploySeq;
    const skill=this.record.index===0 && !u.s.flags.silence && u.skill.ready && u.skill.activate('source-next-attack');
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
    const choices=['Attack_A','Attack_B','Attack_C'].filter(c=>c!==this.lastOrdinary);
    const clip=skill?'Skill_1':choices[Math.min(choices.length-1,Math.floor(b.rng()*choices.length))];
    const speed=skill?Math.min(1,u.base.bat/u.s.interval):u.base.bat/u.s.interval;
    const event=model(u).eventPayloads[clip].find(e=>e.name==='OnAttack').time/speed;
    const full=model(u).durations[clip]/speed;
    this.phase={ kind:'attack',target,targetSeq:target.deploySeq,seq:u.deploySeq,epoch:u.attackControlEpoch,
      skill:!!skill,clip,speed,releaseAt:b.time+event,readyAt:b.time+Math.max(full,u.s.interval),
      accepted:false,released:false };
    this.visual(clip,speed); u.atkCd=u.s.interval;
    if (skill) b.addBuff(u,{ key:'wisadel:cast',flags:{ noSp:true },source:u });
  }
  install() {
    if (this.handles.length || this.stopped) return;
    const b=this.b,u=this.u;
    u.mem.wisadelAttackController=this;
    this.projectiles.install();
    this.handles=[b.on('tick',()=>this.tick(),{ owner:u }),
      b.on('deploy',({unit})=>{
        if (unit===u) {
          this.seq=u.deploySeq; this.epoch=u.attackControlEpoch; this.visual('Start');
          this.phase={ kind:'entrance',readyAt:b.time+model(u).durations.Start };
        }
      },{ owner:u }),b.on('death',({unit})=>{
        if(unit===u)this.stop();
      },{ owner:u })];
    this.handles.push(b.on('battleEnd',()=>this.stop()));
  }
  stop() {
    if (this.stopped) return;
    this.stopped=true; this.cancelPhase('owner-finish'); this.projectiles.finishOwner();
    this.u.mem.regularFormVisual=null;
    for (const h of this.handles) this.b.off(h); this.handles=[];
  }
}

export function prepareWisadelAttacks(b,u,{contract}={}) {
  const record=validateWisadelSelection(u,contract,WISADEL_ATTACK_CONTRACT,0),controller=new WisadelAttackController(b,u,record);
  const kit={ trait:{ noAttack:true,attackDrivenSkill:true,attack:'ranged',dmgType:'phys',projectile:'none',
    hits:1,hitsFn:null,chain:null,splashRadius:0,heal:null,canHitFly:false,groundOnly:true,
    install:null,afterAttack:null,onHit:null,onEachHit:null,requiresAcceptedLaunch:true,attackVisual:'none',
    launchAttack:(_b,_u,_p,t,info)=>controller.release(t,info) },
    skill:{ kind:'instant',trigger:{ rule:'NEVER' },attack:{},
      canActivate:()=>controller.valid() && !controller.phase && u.canAct && !u.s.flags.disarm && !u.s.flags.silence },
    talents:[],install:null };
  return { record,controller,kit };
}
