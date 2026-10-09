// SPDX-License-Identifier: GPL-3.0-or-later
// Original contracts: arkpedia-entelechia-prefabs.json. Closed native selector,
// receipt and FSM timing are bounded engine bridges, not frame/particle parity.
import evidence from '../../../data/arkpedia-entelechia-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { resolveHit } from '../ai.js';
import { isHpLoss } from '../damage.js';
const ID = 'char_4010_etlchi', CANDLE = 'enemy_5601_entlec';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const candle = e => e?.defId === CANDLE && e.mem?.entelechiaHost != null;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const third = u => u.skill?.active && u.skill.id === 'skchr_etlchi_3';
const blood = d => d && !isHpLoss(d) && d.type !== 'element' && d.type !== 'elemental'
  && d.tags.some(t => t === 'entelechia:attack' || t === 'entelechia:sickle');
const range = key => evidence.tables.ranges[key].grids.map(g => [g.row, g.col]);
const around = (b, a, u, fly = false) => b.enemiesInKeys(
  absoluteRangeKeys(range('x-4'), Math.round(a.y), Math.round(a.x), 'RIGHT'), u, { canHitFly: fly });
const stealKey = u => `entelechia:stolen:${u.id}`;

// FINAL_ADDITION, not the pre-percentage hpFlat bucket. Attribute changes do
// not silently heal the owner or rescale the victim's current HP in this bridge.
function maxHpBuff(b, target, spec) {
  const hp = target.hp;
  b.addBuff(target, spec); target.hp = Math.min(hp, target.s.maxHp);
}
function removeMaxHpBuff(b, target, key) {
  const hp = target.hp;
  b.removeBuff(target, key); target.hp = Math.min(hp, target.s.maxHp);
}
function steal(b, u, e, talent) {
  if (!talent || candle(e) || e.bossPool || e.kind === 'device' || e.mem?.propLike || e.mem?.trap) return;
  const amount = Math.min(talent['attack@steal_hp'], talent['attack@steal_hp_max'] - u.mem.entelechiaStolen,
    Math.max(0, e.s.maxHp - 1));
  if (!(amount > 0)) return;
  const total = (u.mem.entelechiaVictims.get(e) ?? 0) + amount;
  u.mem.entelechiaVictims.set(e, total); u.mem.entelechiaStolen += amount;
  maxHpBuff(b, e, { key: stealKey(u), source: u, mods: { hpFinalFlat: -total } });
  maxHpBuff(b, u, { key: 'entelechia:gain', source: u, mods: { hpFinalFlat: u.mem.entelechiaStolen } });
}
function installHealing(b, u, def) {
  const state = { at: -Infinity, count: 0, queue: 0, timer: null };
  u.mem.entelechiaHeal = state;
  const consume = () => {
    if (!live(u)) { state.queue = 0; state.timer = null; return; }
    state.queue--; b.heal(u, u, def.traitBb.value, { self: true, ignoreHealFree: true });
    state.timer = b.after(.12, () => {
      state.timer = null; if (state.queue > 0) consume();
    }, { owner: u });
  };
  b.on('damaged', ({ source, target, dmg }) => {
    if (source !== u || !live(u) || target.side !== 'enemy' || !blood(dmg)) return;
    if (b.time - state.at >= .05 - 1e-9) { state.at = b.time; state.count = 0; }
    if (state.count >= Math.max(0, u.s.blockCnt)) return;
    state.count++; state.queue++; if (!state.timer) consume();
  }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) {
    state.timer?.cancel(); state.timer = null; state.queue = 0;
  } }, { owner: u });
}
function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  const hit = { ...p, hits: 1, hitsFn: null, tags: ['entelechia:attack'] };
  const n = info.isSkill && u.skill.id === 'skchr_etlchi_1' ? 2 : 1;
  // One OnAttack event, two immediate strikes on each captured input.
  for (let i = 0; i < n && canTargetEnemy(u, e, p); i++) resolveHit(b, u, hit, e, info, e.x, e.y);
}
function form(b, u, n, end = false) {
  const clip = `Skill_${n}_${end ? 'End' : 'Begin'}`, duration = model(u).durations[clip];
  const state = {}; u.mem.entelechiaForm = state;
  u.mem.regularFormVisual = { clip, loop: false };
  b.addBuff(u, { key: 'entelechia:transition', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (!live(u) || u.mem.entelechiaForm !== state) return;
    u.mem.regularFormVisual = end ? null : { clip: `Skill_${n}_${n === 2 ? 'Loop' : 'Idle'}`, loop: true };
  }, { owner: u });
}
function stopForm(b, u, n, reason) {
  b.removeBuff(u, 'entelechia:transition'); u.mem.entelechiaForm = null;
  if (live(u) && ['duration', 'manual'].includes(reason)) form(b, u, n, true);
  else u.mem.regularFormVisual = null;
}
function startSickles(b, u) {
  // Native postFilter34/professionMask767 is bridged to most nearby enemies,
  // then proximity and ID. This is an explicit selector fidelity boundary.
  const others = b.allyUnits.filter(a => a !== u && live(a) && a.kind !== 'device' && a.ground
    && !a.s.flags.untargetable && b.grid.tile(Math.round(a.y), Math.round(a.x))?.height !== 'HIGH');
  others.sort((a, z) => around(b, z, u).length - around(b, a, u).length
    || Math.hypot(a.x-u.x, a.y-u.y) - Math.hypot(z.x-u.x, z.y-u.y) || a.id-z.id);
  u.mem.entelechiaCarriers = [u, ...others.slice(0, 1)]; u.mem.entelechiaPulse = 0;
  form(b, u, 2);
}
function pulseSickles(b, u, dt) {
  u.mem.entelechiaPulse += dt;
  while (u.mem.entelechiaPulse >= u.skill.bb.interval - 1e-9) {
    u.mem.entelechiaPulse -= u.skill.bb.interval;
    for (const a of u.mem.entelechiaCarriers ?? []) {
      if (!live(a)) continue;
      for (const e of around(b, a, u, !!a.s.flags.liftoff)) b.dealDamage(u, e, {
        amount: u.s.atk * u.s.atkScaleMul * u.skill.bb.atk_scale, type: 'phys',
        isSkill: true, isSplash: true, tags: ['entelechia:sickle'] });
    }
  }
}
function candlePosition(b, u, host) {
  // Source nearest-to-host, meanwhile nearest-to-owner, with .35 offset.
  // Closed native placement is bounded to passable cells on this stage.
  const cells = [];
  for (let r=b.rect.r0; r<=b.rect.r1; r++) for (let c=b.rect.c0; c<=b.rect.c1; c++) {
    const tile = b.grid.tile(r,c);
    if (tile?.height === 'HIGH' || tile?.pass === 'NONE' || !tile) continue;
    cells.push({r,c,host:Math.hypot(c-host.x,r-host.y),owner:Math.hypot(c-u.x,r-u.y)});
  }
  cells.sort((a,z)=>a.host-z.host || a.owner-z.owner || a.r-z.r || a.c-z.c);
  const tile=cells[0]; if (!tile) return null;
  const dx=u.x-tile.c, dy=u.y-tile.r, d=Math.hypot(dx,dy);
  return [tile.r+(d?dy/d*.3499999940395355:0),tile.c+(d?dx/d*.3499999940395355:0)];
}
function createCandle(b, u, host) {
  const bb=u.skill.bb, pos=candlePosition(b,u,host); if (!pos) return null;
  const source=evidence.tables.enemies[CANDLE][0].enemyData, attributes=source.attributes;
  const immunityKeys = { stunImmune:'stun',silenceImmune:'silence',sleepImmune:'sleep',frozenImmune:'frozen',
    levitateImmune:'levitate',disarmedCombatImmune:'disarmedcombat',fearedImmune:'feared',palsyImmune:'palsy',attractImmune:'attract' };
  const immunities=Object.fromEntries(Object.entries(immunityKeys)
    .filter(([key])=>attributes[key].m_defined).map(([key,status])=>[status,attributes[key].m_value]));
  const stats={maxHp:Math.max(1,host.hp*bb['attack@max_hp_scale']),atk:attributes.atk.m_value,
    def:host.s.def*bb['attack@def_scale'],magicResistance:host.s.res*bb['attack@magic_resistance_scale'],
    moveSpeed:attributes.moveSpeed.m_value,massLevel:attributes.massLevel.m_value,
    baseAttackTime:attributes.baseAttackTime.m_value,attackSpeed:attributes.attackSpeed.m_value,immunities};
  const e=b.spawnEnemy(CANDLE,{def:{name:'Heart Candle',rank:source.levelType.m_value,applyWay:'NONE',
    motion:'WALK',staticBody:true,stats,notCountInTotal:true},pos,countInTotal:false,
    ownerPlayerId:host.ownerId,route:{start:pos,end:pos,motion:'WALK',checkpoints:[]}});
  if (!e) return null;
  e.mem.entelechiaHost=host; e.mem.entelechiaOwner=u; e.mem.noLeak=true;
  e.blockWeight=0;
  b.addBuff(e,{key:'entelechia:candle',flags:{unblockable:true,noMove:true,untargetable:true}});
  b.on('hit',({source,target,dmg})=>{
    if(target!==e)return;
    if(source?.def.charId!==ID) {dmg.cancel=true;return;}
    if(blood(dmg))dmg.minimumAmount=Math.max(dmg.minimumAmount,source.s.atk*.35);
  },{owner:e,priority:100});
  b.on('elementHit',({source,target,dmg})=>{if(target===e && source?.def.charId!==ID)dmg.cancel=true;},{owner:e});
  b.on('damaged',({target,dmg,amount})=>{
    if(target===e && amount>0 && live(host)) {
      // Native unmodifiable NoSourceDamage is bridged to a sourceless receipt,
      // avoiding a second owner damage/talent/SP credit. Native shield/mask
      // dispatch is explicitly unverified; this bypasses the host's mitigation.
      b.loseHp(host,amount,{sourceless:true,from:dmg,tags:['entelechia:linked']});
    }
  },{owner:e});
  b.on('death',({unit})=>{if(unit===host && live(e))b.kill(e,null);},{owner:e});
  return e;
}
function startCandles(b,u) {
  form(b,u,3); const state=u.mem.entelechiaForm;
  b.after(model(u).durations.Skill_3_Begin,()=>{
    if(!live(u)||!third(u)||u.mem.entelechiaForm!==state)return;
    // Native ground enemy mask639/postFilter15: source-backed highest-current
    // HP bridge; special prop/trap categories are excluded, bosses allowed.
    const targets=b.enemiesInKeys(u.rangeKeys,u,{canHitFly:false})
      .filter(e=>!candle(e)&&!e.mem?.propLike&&!e.mem?.trap)
      .sort((a,z)=>z.hp-a.hp||a.spawnSeq-z.spawnSeq).slice(0,u.skill.bb['attack@max_target']);
    u.mem.entelechiaCandles=targets.map(e=>createCandle(b,u,e)).filter(Boolean);
  },{owner:u});
}
function clearCandles(b) {
  // Native SelectEntlecWithoutHitRange has neither owner nor range filter.
  for(const e of b.enemies)if(candle(e)&&live(e))b.kill(e,null);
}
export function customizeEntelechiaKit({battle:b,id,def,unit:u,kit}) {
  if(id!==ID)return;
  kit.install=null; kit.talents=[];
  kit.trait={install:null,noHeal:true,attack:'melee',projectile:'none',dmgType:'phys',canHitFly:false,
    hits:1,hitsFn:null,allInRange:true,maxTargetsByBlock:false,hitAllBlocked:false,splashRadius:0,
    chain:null,dmgMul:null,retargetOnRelease:false,interruptOnSkillChange:true,launchAttack:launch,
    windup:(_b,a)=>{
      a.mem.entelechiaAttackClip=third(a)?`Skill_3_Loop_${b.rng()<.5?'A':'B'}`:'Attack';
      return model(a).hits[a.mem.entelechiaAttackClip][0]/(a.s.aspd/100);
    },attackVisual:(_b,a)=>a.mem.entelechiaAttackClip??'Attack'};
  const s=def.skill,bb=s.bb;
  if(s.id.endsWith('_1'))kit.skill={id:s.id,name:s.name,kind:'instant',flags:{noSp:true},
    attack:{atkScale:bb.atk_scale,windup:()=>model(u).hits.Skill_1[0]/(u.s.aspd/100),attackVisual:'Skill_1'}};
  else if(s.id.endsWith('_2'))kit.skill={id:s.id,name:s.name,kind:'duration',duration:s.duration,
    flags:{disarm:true},attack:{noAttack:true},onStart:()=>startSickles(b,u),
    onTick:({dt})=>pulseSickles(b,u,dt),onEnd:({reason})=>{
      u.mem.entelechiaCarriers=[];u.mem.entelechiaPulse=0;stopForm(b,u,2,reason);
    }};
  else kit.skill={id:s.id,name:s.name,kind:'duration',duration:s.duration,
    mods:{atkPct:bb.atk,aspd:bb.attack_speed},targeting:{rangeGrid:s.rangeGrid},
    attack:{ignoreTargetFree:(a,e)=>a.def.charId===ID&&candle(e)},onStart:()=>startCandles(b,u),
    onEnd:({reason})=>{clearCandles(b);u.mem.entelechiaCandles=[];stopForm(b,u,3,reason);}};
}
export function installEntelechia({battle:b,unit:u,def}) {
  if(def.charId!==ID)return;
  u.mem.entelechiaStolen=0;u.mem.entelechiaVictims=new Map();u.mem.entelechiaServed=false;
  installHealing(b,u,def);
  const talent=def.talents.find(t=>t.bb['attack@steal_hp']!=null)?.bb;
  const emergency=def.talents.find(t=>t.bb.hp_ratio!=null)?.bb;
  if(emergency)b.addBuff(u,{key:'entelechia:undead',flags:{undeadable:true},allowDead:true});
  b.on('hit',({source,target,dmg})=>{
    if(source===u && live(u) && live(target) && target.side==='enemy' && blood(dmg) && !dmg.cancel)
      steal(b,u,target,talent);
  },{owner:u});
  b.on('damaged',({source,target,dmg})=>{
    if(source!==u || !live(u) || !talent || target.side!=='enemy' || !live(target) || target.hp<=0
      || !blood(dmg))return;
    b.addBuff(target,{key:`entelechia:dot:${u.id}`,source:u,duration:talent.dot_duration,
      interval:talent.interval,refresh:'extend',onTick:({unit:e})=>b.dealDamage(u,e,{
        amount:talent.magic_value,type:'arts',tags:['talent','dot','entelechia:dot'],ignoreSelect:true})});
  },{owner:u});
  const serve=()=>{
    if(!emergency||!live(u)||u.mem.entelechiaServed||u.hpRatio>=emergency.hp_ratio)return;
    u.mem.entelechiaServed=true;
    b.heal(u,u,u.s.maxHp*emergency['etlchi_t_2[heal].hp_ratio'],{self:true,ignoreHealFree:true});
    b.removeBuff(u,'entelechia:undead');
    b.addBuff(u,{key:'entelechia:resistance',mods:{physTakenMul:1-emergency.damage_resistance}});
  };
  b.on('damaged',({target})=>{if(target===u)serve();},{owner:u});
  b.on('tick',()=>{
    serve();for(const e of u.mem.entelechiaVictims.keys())if(!live(e)||e.s.flags.untargetable)
      removeMaxHpBuff(b,e,stealKey(u));
  },{owner:u});
  b.on('death',({unit})=>{if(unit!==u)return;
    for(const e of u.mem.entelechiaVictims.keys())removeMaxHpBuff(b,e,stealKey(u));
    u.mem.entelechiaVictims.clear();u.mem.entelechiaForm=null;u.mem.regularFormVisual=null;
  },{owner:u});
}
