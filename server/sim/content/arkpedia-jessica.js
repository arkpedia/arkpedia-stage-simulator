// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs/ranks/facings: arkpedia-jessica-prefabs.json. Native body/face,
// selector12, event4 counters and hit/stop dispatch use documented local clocks.
import evidence from '../../../data/arkpedia-jessica-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
const ID = 'char_1034_jesca2', TOKEN = 'token_10032_jesca2_jckshd';
const live = u => u?.alive && u.deployed && !u._removing;
const mode = u => u.skill?.active ? Number(u.skill.id.at(-1)) : 0;
const visualDirection = u => u.mem.regularVisualDirection ?? u.dir;
const model = u => evidence.models[ID][visualDirection(u) === 'UP' ? 'Back' : 'Front'];
function clip(u, stem, n = mode(u)) {
  if (!n) return stem === 'Loop' ? visualDirection(u) === 'DOWN' ? 'Attack_Down' : 'Attack' : 'Idle';
  const common = `Skill_${n}_${stem}`;
  const down = `Skill_Down_${n}_${stem}`;
  // S1/S2 have Down attack clips only; their original Begin/Idle/End clips
  // are shared. S3 supplies its own complete Down animation sequence.
  return visualDirection(u) === 'DOWN' && model(u).durations[down] != null ? down : common;
}
const rate = (u, name) => Math.min(1, model(u).durations[name] / u.s.interval);
const own = (b, u) => b.allyUnits.find(t => live(t) && t.ownerUnit === u && t.defId === TOKEN);
const grid = id => evidence.tables.ranges[id].grids.map(g => [g.row, g.col]);
function idle(u) {
  if (mode(u) && !u.mem.jessicaOpening && !u.mem.jessicaShell)
    u.mem.regularFormVisual = { clip: clip(u, 'Idle'), loop: true };
}
function direction(b, u, dir) {
  u.mem.regularVisualDirection ??= u.dir;
  u.dir = dir; u.mem.jessicaFaceWait = true; u.mem.jessicaFaceClock = 0;
  u.attackControlEpoch++; u.atkCd = 0; b._refreshRange(u); idle(u);
}
function startup(b, u) {
  const name = clip(u, 'Begin'), seq = u.deploySeq, activation = u.skill.activations;
  u.mem.jessicaOpening = true;
  u.mem.regularFormVisual = { clip: name, loop: false };
  b.addBuff(u, { key: 'jessica:begin', duration: model(u).durations[name], flags: { disarm: true } });
  b.after(model(u).durations[name], () => {
    if (!live(u) || u.deploySeq !== seq || u.skill.activations !== activation || !u.skill.active) return;
    u.mem.jessicaOpening = false; idle(u);
    u.mem.jessicaSync?.();
  }, { owner: u });
}
function finish(b, u, reason) {
  const n = Number(u.skill.id.at(-1));
  u.mem.jessicaBombPending = null; u.mem.jessicaShell = null; u.mem.jessicaOpening = false;
  b.removeBuff(u, 'jessica:begin'); b.removeBuff(u, 'jessica:shell'); b.removeBuff(u, 'jessica:last-round');
  const t = own(b, u); if (t) b.removeBuff(t, 'jessica:skill-def');
  if (!live(u) || n === 1 || ['death','retreat'].includes(reason)) { u.mem.regularFormVisual = null; return; }
  const name = clip(u, 'End', n), seq = u.deploySeq;
  u.mem.regularFormVisual = { clip: name, loop: false };
  b.addBuff(u, { key: 'jessica:end', duration: model(u).durations[name], flags: { disarm: true } });
  b.after(model(u).durations[name], () => { if (u.deploySeq === seq && !u.skill.active)
    u.mem.regularFormVisual = null; }, { owner: u });
}
function explosion(b, u, bb, x, y) {
  for (const e of b.foesInRadius(x, y, bb['attack@extrabomb.projectile_range'], true)) {
    if (!canTargetEnemy(u, e, { canHitFly: true })) continue;
    b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * bb['attack@extrabomb.atk_scale'],
      type: 'phys', isAttack: true, isSkill: true, isSplash: true,
      applyWay: 'ranged', tags: ['jessica:shell'] });
    if (live(e)) b.applyStatus(e, 'stun', { duration: bb['attack@extrabomb.stun'], source: u });
  }
}
function launchShell(b, u) {
  const name = clip(u, 'Skill'), playback = rate(u, name), bb = { ...u.skill.bb };
  const s = { seq: u.deploySeq, activation: u.skill.activations, epoch: u.attackControlEpoch, emitted: false };
  u.mem.jessicaShell = s; u.mem.jessicaBombPending = null;
  u.mem.regularFormVisual = { clip: name, loop: false };
  // The shell occupies the composite attack while its original clip plays;
  // ordinary attacks cannot spend a round during this independent ability.
  b.addBuff(u, { key: 'jessica:shell', flags: { disarm: true } });
  s.epoch = u.attackControlEpoch;
  const valid = () => live(u) && mode(u) === 3 && u.deploySeq === s.seq
    && u.skill.activations === s.activation && u.mem.jessicaShell === s
    && u.canAct && u.attackControlEpoch === s.epoch;
  b.after(model(u).hits[name][0] / playback, () => {
    if (!valid()) return;
    s.emitted = true;
    const from = { x: u.x, y: u.y }, [dr, dc] = u.fwd;
    // Native tile filter12 is closed. Map it to the furthest on-map forward
    // tile of the active source range. A swept collider avoids tick tunnelling.
    const end = u.liveRangeGrid.reduce((z, [r,c]) => r === 0 ? Math.max(z,c) : z, 0);
    let distance = 0;
    for (let i = 1; i <= end; i++) if (b.grid.inRect(u.tileR + dr*i,u.tileC + dc*i)) distance = i;
    let detonated = false;
    const detonate = (p,x,y) => {
      if (detonated) return; detonated = true; p.removed = true; explosion(b,u,bb,x,y);
    };
    b.addProjectile({ from, source: u, to: { x: from.x+dc*distance, y: from.y+dr*distance },
      speed: 5, maxAge: 10, visual: 'arrow', data: { arkpediaTrackedVisual: true, jessica: 'shell' },
      onMove: ({projectile:p,previous,x,y}) => {
        if (detonated) return;
        const dx=x-previous.x,dy=y-previous.y,len=dx*dx+dy*dy;
        const hits=b.enemies.filter(e=>canTargetEnemy(u,e,{canHitFly:true})).map(e=>{
          const f=len ? Math.max(0,Math.min(1,((e.x-previous.x)*dx+(e.y-previous.y)*dy)/len)):0;
          return {e,f,x:previous.x+f*dx,y:previous.y+f*dy};
        }).filter(h=>Math.hypot(h.e.x-h.x,h.e.y-h.y)<=.5+1e-9).sort((a,z)=>a.f-z.f||a.e.id-z.e.id);
        if(hits.length)detonate(p,hits[0].x,hits[0].y);
      },onHit:({projectile:p,x,y})=>detonate(p,x,y) });
  }, { owner: u });
  b.after(model(u).durations[name] / playback, () => {
    if (u.mem.jessicaShell !== s) return;
    u.mem.jessicaShell = null; b.removeBuff(u, 'jessica:shell');
    if (live(u) && mode(u) === 3) { idle(u); u.atkCd = 0; }
  }, { owner: u });
}
function consume(ctx) {
  const { battle:b,unit:u,skill:s }=ctx;
  ctx.noAmmo=true; s.ammoLeft=Math.max(0,s.ammoLeft-1);
  if(b._hooks.ammoUsed)b.emit('ammoUsed',{unit:u,left:s.ammoLeft,skill:s});
  if(s.ammoLeft)return;
  const name=clip(u,'Loop'),seq=u.deploySeq,activation=s.activations;
  b.addBuff(u,{key:'jessica:last-round',flags:{disarm:true}});
  const post=(model(u).durations[name]-model(u).hits[name][0])/rate(u,name);
  b.after(post,()=>{if(live(u)&&u.deploySeq===seq&&s.active&&s.activations===activation)s.end('ammo');},{owner:u});
}
export function customizeJessicaKit({battle:b,id,def,unit:u,kit}) {
  if(id!==ID)return;
  kit.install=null;kit.talents=[];
  kit.trait={attack:'ranged',projectile:'none',dmgType:'phys',applyWay:'ranged',canHitFly:true,
    maxTargets:1,hits:1,hitAllBlocked:false,maxTargetsByBlock:false,allInRange:false,
    retargetOnRelease:false,interruptOnSkillChange:true,
    canAttack:()=>!u.mem.jessicaShell&&(!u.skill?.active||mode(u)!==3||u.skill.ammoLeft>0),
    windup:()=>{const name=clip(u,'Loop');return model(u).hits[name][0]/rate(u,name);},
    attackVisual:()=>clip(u,'Loop'),
    launchAttack:(_b,a,p,e,info)=>{
      if(!canTargetEnemy(a,e,p))return;
      b.addProjectile({from:a,source:a,target:e,speed:10,maxAge:10,visual:'arrow',
        data:{arkpediaTrackedVisual:true,jessica:'normal'},
        onHit:({target})=>{if(target&&canTargetEnemy(a,target,p))resolveHit(b,a,p,target,info,target.x,target.y);}});
    }};
  const s=def.skill,bb=s.bb,n=Number(s.id.at(-1));
  kit.skill={id:s.id,name:s.name,kind:n===1?'toggle':n===2?'duration':'ammo',
    ...(n===3?{ammo:bb['attack@trigger_time'],duration:0,manualCancel:true,onAttack:consume}:{}),
    trigger:n===1?'SP_FULL':'NEVER',canActivate:()=>!u.findBuff('jessica:end'),
    mods:{atkPct:bb.atk,...(n===1?{defPct:bb.def}:n===2?{batFlat:bb.base_attack_time,dodgePhys:bb.prob,dodgeArts:bb.prob}
      :{batFlat:bb.base_attack_time,rangeExtend:bb.ability_range_forward_extend,defPct:bb['jesca2_s_3[def].def']})},
    ...(n===2?{targeting:{rangeGrid:s.rangeGrid}}:{}),
    onStart:()=>{startup(b,u);u.mem.jessicaSync?.();if(n===3&&own(b,u))u.mem.jessicaBombPending=b.time;},
    onEnd:({reason})=>finish(b,u,reason)};
}
export function installJessica({battle:b,unit:u,def}) {
  if(def.charId!==ID)return;
  const aura=new Set(),key=`jessica:def:${u.id}`;
  const sync=()=>{
    const t=live(u)&&own(b,u),keys=t?absoluteRangeKeys(grid('b-1'),u.tileR,u.tileC,u.dir):[];
    const allies=t?b.allyUnits.filter(a=>live(a)&&!a.s.flags.untargetable&&!a.s.flags.isolate&&keys.includes(a.tileR*21+a.tileC)):[];
    for(const a of aura)if(!allies.includes(a)){b.removeBuff(a,key);aura.delete(a);}
    for(const a of allies)if(!aura.has(a)){b.addBuff(a,{key,source:u,mods:{defPct:def.talents[0].bb.def}});aura.add(a);}
    if(t){const n=mode(u),value=n===1?u.skill.bb.def:n===3?u.skill.bb['jesca2_s_3_token[def].def']:null;
      if(value===null)b.removeBuff(t,'jessica:skill-def');
      else if(!t.findBuff('jessica:skill-def'))b.addBuff(t,{key:'jessica:skill-def',source:u,mods:{defPct:value}});
      if(n===1&&!t.mem.jessicaExtended){t.mem.jessicaExtended=true;t.mem.jessicaExpiry+=u.skill.bb.duration;t.mem.jessicaLifetime+=u.skill.bb.duration;}
    }
  };u.mem.jessicaSync=sync;
  b.on('deploy',({unit})=>{if(unit===u){u.mem.jessicaOriginalDirection=u.dir;u.mem.regularVisualDirection=u.dir;
    u.mem.jessicaBombPending=null;u.mem.jessicaFaceWait=false;}sync();},{owner:u});
  b.on('tick',({dt})=>{
    if(!live(u))return;sync();
    if(u.mem.jessicaFaceWait){u.mem.jessicaFaceClock+=dt;
      if(u.mem.jessicaFaceClock+1e-9>=.1){u.mem.jessicaFaceClock=0;
        if(u.canAct&&!u.blocking.some(live)){u.mem.regularVisualDirection=u.dir;u.mem.jessicaFaceWait=false;idle(u);}}
    }
    if(u.mem.jessicaShell&&!u.canAct){u.mem.jessicaShell=null;b.removeBuff(u,'jessica:shell');idle(u);}
    if(mode(u)===3&&u.mem.jessicaBombPending!=null&&b.time+1e-9>=u.mem.jessicaBombPending
      &&u.canAct&&!u.mem.jessicaOpening&&!u.mem.jessicaShell&&!u.findBuff('jessica:last-round')){
      u.attackControlEpoch++;u.atkCd=0;launchShell(b,u);
    }
  },{owner:u});
  b.on('death',({unit})=>{if(unit===u){for(const a of aura)b.removeBuff(a,key);aura.clear();
    u.mem.regularVisualDirection=null;u.mem.regularFormVisual=null;u.mem.jessicaBombPending=null;
  }else if(aura.has(unit))sync();},{owner:u});
}
export function createJessicaShield(b,state,row,col) {
  const u=state.owner,r=state.record;
  if(r.id!==TOKEN||r.stats.maxDeployCount!==1||r.stats.blockCnt!==2||r.stats.respawnTime!==30)
    throw Error('Unreviewed Jessica shield source');
  const dir=col>u.tileC?'RIGHT':col<u.tileC?'LEFT':row>u.tileR?'UP':'DOWN';
  return b.spawnToken(u,TOKEN,row,col,{dir,def:r,kit:{trait:{canAttack:()=>false},
    skill:{id:'jessica:shield-lifetime',kind:'passive',formCountdown:()=>{
      const t=own(b,u);return t?{remaining:Math.max(0,t.mem.jessicaExpiry-b.time),duration:t.mem.jessicaLifetime,label:'Shield remaining'}:null;
    }},install:(battle,t)=>{
      battle.addBuff(t,{key:'jessica:shield-trait',flags:{healFree:true},mods:{taunt:r.talents[0].bb.taunt_level},persist:true,allowDead:true});
      battle.on('deploy',({unit})=>{if(unit!==t)return;
        t.mem.jessicaOldDirection=u.dir;t.mem.jessicaLifetime=r.talents[0].bb.duration;
        t.mem.jessicaExpiry=b.time+t.mem.jessicaLifetime;direction(b,u,dir);u.mem.jessicaSync?.();
        if(mode(u)===3)u.mem.jessicaBombPending=b.time+.1;
      },{owner:t});
      battle.on('tick',()=>{if(live(t)&&b.time+1e-9>=t.mem.jessicaExpiry)
        b.retreat(t,{permanent:true,reason:'jessica-shield-expired'});},{owner:t});
      battle.on('damaged',({target,dmg,amount})=>{if(target!==t||!live(u)||amount<=0||!dmg||dmg.tags?.includes('hpLoss'))return;
        const talent=u.def.talents.find(a=>a.bb.prob!=null);
        if(talent&&b.rng()<talent.bb.prob)u.skill.gainSp(talent.bb.sp,'jessica-shield');
      },{owner:t});
      battle.on('death',({unit})=>{if(unit!==t)return;
        state.stock=Math.min(1,state.stock+1);state.readyAt=b.time+r.stats.respawnTime;
        if(live(u)){direction(b,u,t.mem.jessicaOldDirection);u.mem.jessicaSync?.();}
      },{owner:t});
    }}});
}
