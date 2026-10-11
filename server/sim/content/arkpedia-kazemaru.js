// SPDX-License-Identifier: GPL-3.0-or-later
// Native mode graph, token bindings and dispatch bounds are retained in evidence.
import evidence from '../../../data/arkpedia-kazemaru-prefabs.json' with { type: 'json' };
import { applyHpLoss, makeDamageInfo } from '../damage.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { resolveHit } from '../ai.js';
import { COLS } from '../constants.js';
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
const ID = 'char_4016_kazema', TOKEN = 'token_10022_kazema_shadow';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[u.defId][u.dir === 'UP' ? 'Back' : 'Front'];
const second = u => u.skill.active && u.skill.id === 'skchr_kazema_2';
const clip = u => u.trait.doll ? 'Attack_B' : second(u) ? 'Skill2' : 'Attack';
function idle(u) {
  u.mem.regularFormVisual = { clip: u.trait.doll ? 'Idle_B' : 'Idle', loop: true,
    attack: clip(u), die: u.trait.doll ? 'Die_B' : 'Die' };
}
function cost(b, u, amount, tag) {
  // Native PURE/NORMAL, ignoreForSp, skipModifierEvent. This is not HPLOSS
  // damage; applyHpLoss is the engine's direct HP-write bridge, not a tag.
  applyHpLoss(b, u, u, amount, makeDamageInfo({ type: 'true', isAttack: true,
    noSp: true, canDodge: false, applyWay: 'none', tags: [tag] }));
}
function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  // ON_OUTPUT_DAMAGE must only see this selected S1 output, not normal
  // attacks, entrance pulses, cancelled hits or its own recursive HP cost.
  u.mem.kazemaruS1Output = p.isSkill && u.skill.id === 'skchr_kazema_1';
  try { resolveHit(b, u, { ...p, launchAttack: null }, e, info, e.x, e.y); }
  finally { u.mem.kazemaruS1Output = false; }
}
function entrance(b, u, grid, scale) {
  const keys = absoluteRangeKeys(grid, u.tileR, u.tileC, u.dir);
  for (const target of b.enemiesInKeys(keys, u, { canHitFly: false, groundOnly: true }))
    b.dealDamage(u, target, { amount: u.s.atk * u.s.atkScaleMul * scale,
      type: 'arts', isAttack: true, applyWay: 'melee', tags: ['kazemaru:entrance'] });
}
function killShadows(b, u) {
  for (const token of b.allyUnits.slice())
    if (token.ownerUnit === u && token.defId === TOKEN && live(token))
      b.kill(token);
}
function tokenRecord(b, owner) {
  const source = b.data.rawToken(TOKEN), build = owner.def.raw.arkpedia;
  if (!source || !build) throw Error('Missing reviewed Kaminingyo source/build');
  const phase = source.phases[build.elite], frames = phase.attributesKeyFrames;
  const low = frames[0], high = frames.at(-1);
  const ratio = high.level === low.level ? 0 : (build.level - low.level) / (high.level - low.level);
  const stats = Object.fromEntries(Object.entries(low.data).filter(([,v]) => typeof v === 'number')
    .map(([k,v]) => [k, v + ((high.data[k] ?? v) - v) * ratio]));
  for (const k of ['maxHp','atk','def']) stats[k] = Math.round(stats[k]);
  const talent = sourceCandidate(source.talents[0].candidates, build);
  return { id: TOKEN, name: source.name, profession: source.profession,
    position: source.position, subProfessionId: source.subProfessionId,
    stats, rangeGrid: phase.rangeGrid, dmgType: 'phys', attackKind: 'melee',
    canHitFly: false, talents: [{ ...talent,
      bb: Object.fromEntries(talent.blackboard.map(({key,value}) => [key,value])) }] };
}
function spawnShadow(b, owner) {
  const grid = owner.def.raw.trait.rangeGrid;
  const keys = absoluteRangeKeys(grid, owner.tileR, owner.tileC, owner.dir);
  // Native filter7's enum is not available. Preserve literal ground-build,
  // passability/occupancy and alwaysRandomInTheEnd, without inventing priority.
  const tiles = keys.filter(k => {
    const r = Math.floor(k / COLS), c = k % COLS, t = b.grid.tile(r,c);
    return b.grid.inRect(r,c) && t && ['MELEE','ALL'].includes(t.build)
      && t.pass !== 'NONE' && !b.grid.isObstacle(r,c) && !b.downOn(r,c)
      && !(b._occ[k]?.alive && b._occ[k]?.deployed);
  });
  if (!tiles.length) return null;
  const key = tiles[Math.min(tiles.length-1, Math.floor(b.rng()*tiles.length))];
  const record = tokenRecord(b, owner), bb = owner.def.skill.bb;
  return b.spawnToken(owner, TOKEN, Math.floor(key / COLS), key % COLS, {
    def: record, dir: 'RIGHT', kit: {
      trait: { attack: 'melee', projectile: 'none', dmgType: 'phys', applyWay: 'melee',
        canHitFly: false, groundOnly: true, maxTargets: 1, hits: 1,
        hitAllBlocked: false, maxTargetsByBlock: false, splashRadius: 0,
        windup: (_,u) => model(u).hits.Attack[0] / (u.s.aspd/100),
        attackVisual: 'Attack', canAttack: (_,u) => !u.mem.kazemaruBorn },
      install: (battle,u) => {
        u.deploymentSlotCost = 0;
        battle.on('deploy', ({unit}) => {
          if (unit !== u) return;
          const seq = u.deploySeq;
          u.mem.kazemaruBorn = true;
          u.mem.regularFormVisual = { clip: 'Start', loop: false, speed: 1 };
          battle.addBuff(u, { key: 'kazemaru:s2-token', source: owner,
            duration: owner.def.skill.duration, mods: { atkPct: bb.atk } });
          battle.addBuff(u, { key: 'kazemaru:token-born', flags: { disarm: true } });
          const buff = evidence.tokens[0].components.find(c =>
            c.data._buffs?.some(x => x.buffKey === 'kazema_standin[damage]')).data._buffs[0];
          battle.after(model(u).hits.Start[0] + buff.lifeTime, () => {
            if (live(u) && u.deploySeq === seq)
              entrance(battle,u,record.rangeGrid,record.talents[0].bb.damage_scale);
          }, { owner: u });
          battle.after(model(u).durations.Start, () => {
            if (!live(u) || u.deploySeq !== seq) return;
            u.mem.kazemaruBorn = false; battle.removeBuff(u,'kazemaru:token-born');
            u.mem.regularFormVisual = null; u.atkCd = 0;
          }, { owner: u });
        }, { owner: u });
        battle.on('beforeAttack', ({attacker,targets}) => {
          if (attacker !== u || !targets[0]) return;
          const dx = targets[0].x-u.x, dy = targets[0].y-u.y;
          u.dir = Math.abs(dx) >= Math.abs(dy) ? dx<0?'LEFT':'RIGHT' : dy<0?'DOWN':'UP';
          battle.refreshRange(u);
        }, { owner: u });
      },
    },
  });
}
export function customizeKazemaruKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'phys',
    applyWay: 'melee', groundOnly: true, canHitFly: false, hits: 1,
    maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    splashRadius: 0, chain: null, dmgMul: null, interruptOnSkillChange: true,
    windup: () => model(u).hits[clip(u)][0] / (u.s.aspd / 100),
    attackVisual: () => clip(u), launchAttack: launch,
    canAttack: () => !u.trait.dollSwitching };
  const s = def.skill, bb = s.bb;
  kit.skill = { id: s.id, name: s.name,
    canActivate: () => !u.trait.doll && !u.trait.dollSwitching,
    ...(s.id === 'skchr_kazema_1' ? { kind: 'instant',
      attack: { atkScale: bb.atk_scale, maxTargets: 1 } } : {
      kind: 'duration', mods: { atkPct: bb.atk },
      onStart: () => {
        cost(b,u,Math.min(Math.max(0,u.hp-1),u.hp*bb.hp_ratio),'kazemaru:s2-cost');
        if (!live(u) || !second(u)) return;
        spawnShadow(b,u); u.atkCd=0; idle(u);
      },
      onEnd: () => { killShadows(b,u); u.atkCd=0; if (!u.trait.dollSwitching) idle(u); },
    }) };
}
export function installKazemaru({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const originalRange = u.rangeGrid, grid = def.raw.trait.rangeGrid;
  if (!grid?.length) throw Error('Missing original Kazemaru substitute range');
  const clear = () => {
    if (u.skill.active) u.skill.end('substitute');
    for (const buff of u.buffs.slice()) if (!buff.persist) b.removeBuff(u,buff);
    u.skill.sp=0; u.skill.charges=0;
  };
  const switchForm = doll => {
    const state = { seq: u.deploySeq };
    u.mem.kazemaruSwitch=state; u.trait.dollSwitching=true; clear();
    const valid = () => live(u) && u.deploySeq===state.seq && u.mem.kazemaruSwitch===state;
    b.addBuff(u,{key:'kazemaru:transition',flags:{invulnerable:true,undeadable:true,
      noSp:true,noHeal:true,healFree:true,isolated:true,disarm:true}});
    b.addBuff(u,{key:'kazemaru:zero-block',mods:{blockCntMul:0}});
    b.releaseBlocked(u); u.hp=u.s.maxHp;
    const out = doll?'Die_2':'Die_B', born = doll?'Start_B':'Start';
    u.mem.regularFormVisual={clip:out,loop:false,speed:1,forceFront:true};
    b.after(evidence.models[ID].Front.durations[out],()=>{
      if (!valid()) return;
      u.trait.doll=doll; u.form=doll?'doll':null;
      u.rangeGrid=doll?grid:originalRange;
      u.profile.canHitFly=doll; u.profile.groundOnly=!doll; b.refreshRange(u);
      u.mem.regularFormVisual={clip:born,loop:false,speed:1};
      if (doll) b.after(model(u).hits.Start_B[0],()=>{
        if (valid()) entrance(b,u,grid,def.talents[0].bb.damage_scale);
      },{owner:u});
      b.after(model(u).durations[born],()=>{
        if (!valid()) return;
        b.removeBuff(u,'kazemaru:transition'); u.trait.dollSwitching=false;
        if (doll) {
          b.addBuff(u,{key:'kazemaru:substitute-sp',flags:{noSp:true}});
          // Mode1 is entered by the SwitchEnd passive after original birth.
          // Controller completion is bounded by the existing clip duration.
          b.after(def.traitBb.duration,()=>{if(valid() && u.trait.doll)switchForm(false);},{owner:u});
        } else b.removeBuff(u,'kazemaru:zero-block');
        idle(u); u.atkCd=0;
      },{owner:u});
    },{owner:u});
  };
  b.on('deploy',({unit})=>{
    if(unit!==u)return;
    u.mem.kazemaruSwitch=null;u.mem.kazemaruS1Output=false;
    u.trait.doll=false;u.trait.dollSwitching=false;u.form=null;
    u.rangeGrid=originalRange;u.profile.canHitFly=false;u.profile.groundOnly=true;
    b.refreshRange(u);idle(u);
  },{owner:u});
  b.on('fatal',ctx=>{
    if(ctx.unit!==u||ctx.prevented)return;
    if(!u.trait.dollSwitching)switchForm(!u.trait.doll);
    ctx.prevented=true;
  },{owner:u,priority:-100});
  b.on('beforeStatus',ctx=>{
    if(ctx.target===u && u.trait.dollSwitching && ['stun','freeze','sleep'].includes(ctx.status))ctx.cancel=true;
  },{owner:u});
  b.on('damaged',({source,target,type,dmg})=>{
    if(source===u && target!==u && live(u) && u.mem.kazemaruS1Output
      && type!=='element' && !dmg.cancel)
      cost(b,u,u.s.maxHp*def.skill.bb.hp_ratio,'kazemaru:s1-cost');
  },{owner:u});
  b.on('death',({unit})=>{
    if(unit!==u)return;
    killShadows(b,u);u.mem.kazemaruSwitch=null;u.mem.regularFormVisual=null;
    u.mem.kazemaruS1Output=false;u.trait.doll=false;u.trait.dollSwitching=false;u.form=null;
  },{owner:u});
}
