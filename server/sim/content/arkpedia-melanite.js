// SPDX-License-Identifier: GPL-3.0-or-later
// Native graphs, rank rows and bounded controller mappings are retained in
// data/arkpedia-melanite-prefabs.json. No module effects are included.
import evidence from '../../../data/arkpedia-melanite-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { dirVec, toLocal } from '../dir.js';
import { hitRect } from '../body.js';

const ID = 'char_4006_melnte', FIRST = 'skchr_melnte_1';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const first = u => u.skill?.active && u.skill.id === FIRST;
const shotProfile = { attack: 'ranged', dmgType: 'phys', canHitFly: true,
  maxTargets: 1, hits: 1, splashRadius: 0, chain: null, applyWay: 'ranged' };
const rate = u => Math.min(1, u.s.aspd / 100);
const curve = evidence.projectiles.projectile_chr_melnte_s2[0].components
  .find(c => c.data._scaleCurve).data._scaleCurve.m_Curve;

/** Original unweighted Unity Hermite keys. Input normalization is the explicit
 * local controller boundary, not a recovered native method body. */
function curveValue(t) {
  t = Math.max(0, Math.min(1, t));
  const right = curve.findIndex(k => k.time >= t);
  if (right <= 0) return curve[0].value;
  const a = curve[right - 1], z = curve[right], span = z.time - a.time;
  const q = (t - a.time) / span, q2 = q*q, q3 = q2*q;
  return (2*q3 - 3*q2 + 1)*a.value + (q3 - 2*q2 + q)*span*a.outSlope
    + (-2*q3 + 3*q2)*z.value + (q3 - q2)*span*z.inSlope;
}

function ordinary(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  b.addProjectile({ from: u, target, source: u, speed: 10, maxAge: 10,
    visual: 'arrow', data: { arkpediaTrackedVisual: true }, onHit: ({ target: e }) => {
      if (e && canTargetEnemy(u, e, p)) resolveHit(b, u, p, e, info, e.x, e.y);
    } });
}

/** First contact with a swept radius-.5 circle along one cardinal lane. Huge
 * shared bodies use their rectangle; ordinary shared bodies remain points. */
function contact(e, origin, dir, start, end) {
  const rect = hitRect(e), positions = rect
    ? [[rect.y0, rect.x0], [rect.y0, rect.x1], [rect.y1, rect.x0], [rect.y1, rect.x1]]
    : [[e.y, e.x]];
  const local = positions.map(([y,x]) => toLocal(y-origin.y, x-origin.x, dir));
  const lo = Math.min(...local.map(p => p[1])), hi = Math.max(...local.map(p => p[1]));
  const bottom = Math.min(...local.map(p => p[0])), top = Math.max(...local.map(p => p[0]));
  const cross = bottom > 0 ? bottom : top < 0 ? -top : 0;
  if (cross > .5 + 1e-9) return null;
  const reach = Math.sqrt(Math.max(0, .25-cross*cross));
  const enter = lo-reach, leave = hi+reach;
  if (leave < start-1e-9 || enter > end+1e-9) return null;
  return Math.max(start, enter);
}

function piercing(b, u, state) {
  const origin = {x:u.x,y:u.y}, dir = u.dir, [dr,dc] = dirVec(dir);
  const bb = u.def.skill.bb, targets = new Set(), attackId = ++b._attackSeq;
  const p = { ...shotProfile, ignoreCamouflage: true };
  b.addProjectile({ from: origin, to: {x:origin.x+4*dc,y:origin.y+4*dr}, source: u,
    speed: 10, maxAge: .4, expireInPlace: true, visual: 'arrow',
    data: { arkpediaTrackedVisual: true }, onMove: ({projectile,previous,x,y}) => {
      const from = Math.hypot(previous.x-origin.x,previous.y-origin.y);
      const to = Math.hypot(x-origin.x,y-origin.y);
      for (const e of b.enemies) {
        if (targets.has(e) || !canTargetEnemy(u,e,p)) continue;
        const distance = contact(e,origin,dir,from,to);
        if (distance == null) continue;
        targets.add(e);
        const fraction = to > from ? (distance-from)/(to-from) : 0;
        const age = previous.age + (Math.min(.4,projectile.age)-previous.age)*fraction;
        const scale = bb.scale+(bb.atk_scale-bb.scale)*Math.max(0,Math.min(1,curveValue(age/.4)));
        resolveHit(b,u,{...p,atkScale:scale},e,{isSkill:true,attackId},e.x,e.y);
      }
    } });
  state.emitted = true;
}

function cast(b,u) {
  const clip = u.dir === 'DOWN' ? 'Skill_Down_2' : 'Skill_2';
  const speed = rate(u), duration = model(u).durations[clip]/speed;
  const state = {seq:u.deploySeq,epoch:u.attackControlEpoch,emitted:false};
  u.mem.melaniteCast = state; u.skill.timeLeft = duration;
  u.mem.regularFormVisual = {clip,loop:false};
  b.addBuff(u,{key:'melanite:cast',flags:{disarm:true,noSp:true}});
  state.epoch = u.attackControlEpoch;
  const valid = () => live(u) && u.deploySeq === state.seq && u.mem.melaniteCast === state
    && u.skill.active;
  const watch = b.every(b.dt,() => {
    if (!valid()) { watch.cancel(); return; }
    if (!state.emitted && (!u.canAct || u.attackControlEpoch !== state.epoch)) {
      u.skill.end('interrupt'); watch.cancel();
    }
  },{owner:u});
  b.after(model(u).hits[clip][0]/speed,() => {
    if (valid() && u.canAct && u.attackControlEpoch === state.epoch) piercing(b,u,state);
    else if (valid()) u.skill.end('interrupt');
  },{owner:u});
  b.after(duration,() => { if(valid())u.skill.end('cast');watch.cancel(); },{owner:u});
}

export function customizeMelaniteKit({battle:b,id,def,unit:u,kit}) {
  if(id!==ID)return;
  kit.install=null;kit.talents=[];
  kit.trait={...shotProfile,projectile:'none',allInRange:false,hitAllBlocked:false,
    maxTargetsByBlock:false,hitsFn:null,dmgMul:null,install:null,
    retargetOnRelease:false,interruptOnSkillChange:true,launchAttack:ordinary,
    windup:()=>model(u).hits[first(u)?'Skill_1_Loop':'Attack'][0]
      /(first(u)?rate(u):u.s.aspd/100),
    attackVisual:()=>first(u)?'Skill_1_Loop':'Attack'};
  const s=def.skill;
  kit.skill={id:s.id,name:s.name,kind:s.id===FIRST?'duration':'toggle',duration:s.duration};
  if(s.id===FIRST)Object.assign(kit.skill,{mods:{atkPct:s.bb.atk,batFlat:s.bb.base_attack_time},
    onStart:()=>{u.mem.regularFormVisual={clip:'Skill_1_Idle',loop:true};},
    onEnd:()=>{u.mem.regularFormVisual=null;}});
  else Object.assign(kit.skill,{attack:{noAttack:true},onStart:()=>cast(b,u),
    onEnd:()=>{u.mem.melaniteCast=null;u.mem.regularFormVisual=null;b.removeBuff(u,'melanite:cast');}});
}

export function installMelanite({battle:b,unit:u,def}) {
  if(def.charId!==ID)return;
  b.on('hit',({source,dmg})=>{
    const talent=def.talents[0]?.bb.damage_scale;
    if(source===u&&talent&&u.skill.active&&u.skill.activations>=2)dmg.mul*=talent;
  },{owner:u});
}
