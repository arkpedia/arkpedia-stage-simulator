// SPDX-License-Identifier: GPL-3.0-or-later
// Beanstalk's original rally point has a persistent inactive mode. It is not a
// generic replacement summon and never borrows another operator's attributes.
import evidence from '../../../data/arkpedia-summon-prefabs.json' with { type: 'json' };
import { summonCardId } from '../../../shared/arkpedia/summons.js';
const live = u => u?.alive && u.deployed;
const tokenId = 'token_10014_bstalk_crab';
const owned = (b, u) => b.allyUnits.filter(t => t.ownerUnit === u && t.defId === tokenId && live(t));
const spawnDelay = evidence.tokens[tokenId].character.find(row => row._animKey === 'Skill_Begin')._preDelay;
const skillHit = (id, index) => evidence.operators[id].models.Front.hits[index ? 'Skill02' : 'Skill01'][0];

export function createMetalCrab(battle, state, row, col, { extra = false } = {}) {
  const token = battle.spawnToken(state.owner, tokenId, row, col, { def: state.record,
    dir: 'RIGHT', kit: { skill: null, trait: { attack: 'melee', dmgType: 'phys', projectile: 'none',
      canHitFly: false, attackVisual: 'Y_Attack',
      canAttack: (_battle, unit) => unit.mem.crabMode === 'active',
      windup: evidence.tokens[tokenId].model.hits.Y_Attack[0],
    }, install: (b, u) => b.addBuff(u, { key: 'summon:heal-free', flags: { healFree: true }, persist: true }) },
  });
  if (!token) return null;
  token.deploymentSlotCost = 0; token.mem.regularSummonCard = state.key;
  token.mem.crabExtra = extra; token.mem.crabMode = 'inactive'; token.mem.crabGeneration = 0;
  const inactiveKey = `crab:inactive:${token.id}`, blockKey = `crab:block:${token.id}`;
  const activate = () => {
    if (!live(token) || !live(state.owner)) return;
    token.mem.crabMode = 'active'; token.hp = token.s.maxHp;
    battle.removeBuff(token, inactiveKey);
    battle.addBuff(token, { key: blockKey, mods: { blockCnt: state.record.talents[0].bb.block_cnt } });
    token.mem.regularFormVisual = { clip: 'Y_Idle', loop: true, attack: 'Y_Attack', die: 'Y_Die' };
    token.atkCd = 0;
  };
  const warm = () => {
    if (!live(token) || !live(state.owner) || token.mem.crabMode === 'active') return;
    const generation = ++token.mem.crabGeneration;
    token.mem.crabMode = 'warming'; token.mem.crabReadyAt = battle.time + spawnDelay;
    token.mem.regularFormVisual = { clip: 'Y_Start', loop: false, die: 'P_Die' };
    battle.after(spawnDelay, () => {
      if (token.mem.crabGeneration === generation) activate();
    }, { owner: token });
  };
  const rest = () => {
    if (!live(token) || token.mem.crabMode !== 'active') return;
    const generation = ++token.mem.crabGeneration;
    token.mem.crabMode = 'inactive'; token.hp = 1;
    // The original retained list includes its source skill DEF, while temporary
    // statuses and other buffs finish when the active reinforcement is defeated.
    for (const buff of token.buffs.slice()) if (!buff.persist && buff.key !== `beanstalk:def:${state.owner.id}`)
      battle.removeBuff(token, buff);
    battle.removeBuff(token, blockKey); battle.releaseBlocked(token);
    battle.addBuff(token, { key: inactiveKey, flags: { invulnerable: true, untargetable: true,
      isolated: true, noHeal: true, disarm: true, noSp: true }, mods: { blockCntMul: 0 } });
    token.mem.regularFormVisual = { clip: 'Y_Die', loop: false, die: 'P_Die' };
    token.mem.crabReadyAt = battle.time + state.record.talents[0].bb.interval + spawnDelay;
    battle.after(evidence.tokens[tokenId].model.durations.Y_Die, () => {
      if (live(token) && token.mem.crabGeneration === generation)
        token.mem.regularFormVisual = { clip: 'P_Idle', loop: true, die: 'P_Die' };
    }, { owner: token });
    battle.after(state.record.talents[0].bb.interval, () => {
      if (token.mem.crabGeneration === generation) warm();
    }, { owner: token });
  };
  token.mem.metalCrabRest = extra ? null : rest;
  token.mem.metalCrabWarm = warm;
  battle.addBuff(token, { key: inactiveKey, flags: { invulnerable: true, untargetable: true,
    isolated: true, noHeal: true, disarm: true }, mods: { blockCntMul: 0 } });
  if (!extra) battle.on('fatal', ctx => {
    if (ctx.unit === token && token.mem.crabMode === 'active') { ctx.prevented = true; rest(); }
  }, { owner: token });
  battle.on('beforeAttack', ctx => {
    if (ctx.attacker === token && ctx.targets[0]) token.dir = ctx.targets[0].x < token.x ? 'LEFT' : 'RIGHT';
  }, { owner: token });
  warm();
  return token;
}

function refreshCrabDef(battle, owner, bb) {
  const key = `beanstalk:def:${owner.id}`;
  for (const token of owned(battle, owner)) {
    if (owner.skill.active && owner.skill.id === 'skchr_bstalk_2') {
      if (!token.findBuff(key)) battle.addBuff(token, { key, source: owner, mods: { defPct: bb['attack@def'] } });
    } else battle.removeBuff(token, key);
  }
}

export function customizeBeanstalk({ id, def, unit, kit }) {
  const skill = def.skill, bb = skill.bb;
  kit.trait = { ...kit.trait, install: null, attack: 'ranged', projectile: 'arrow',
    projectileSpeed: 10, canHitFly: true,
    windup: evidence.operators[id].models.Front.hits.Attack[0] };
  const first = skill.id === 'skchr_bstalk_1';
  kit.skill = { id: skill.id, name: skill.name, kind: first ? 'instant' : 'duration',
    onStart: ({ battle }) => {
      const state = battle.regularSummons.get(summonCardId(id));
      const hit = skillHit(id, first ? 0 : 1), seq = unit.deploySeq;
      unit.atkCd = Math.max(unit.atkCd, hit);
      if (!first) { unit.mem.beanstalkDpCount = 0; unit.mem.beanstalkDpClock = 0; }
      battle.after(hit, () => {
        if (!live(unit) || unit.deploySeq !== seq) return;
        const primary = owned(battle, unit).find(token => !token.mem.crabExtra);
        if (first) {
          battle.addDp(unit.ownerId, bb.cost);
          if (primary?.mem.crabMode === 'inactive') primary.mem.metalCrabWarm();
          else if (primary?.mem.crabMode === 'active') battle.heal(unit, primary, primary.s.maxHp, { ignoreHealFree: true, self: true });
        } else if (unit.skill.active && primary) {
          for (const [dr, dc] of [[0,1],[1,0],[0,-1],[-1,0]]) {
            const row = primary.tileR + dr, col = primary.tileC + dc;
            if (!battle.grid.inRect(row,col) || !['MELEE','ALL'].includes(battle.grid.tile(row,col).build)
              || battle.grid.tile(row,col).pass !== 'ALL'
              || battle.allyUnits.some(t=>live(t)&&t.tileR===row&&t.tileC===col)) continue;
            const extra = createMetalCrab(battle, state, row, col, { extra: true });
            if (extra) battle.after(skill.duration, () => {
              if (live(extra)) battle.retreat(extra, { permanent: true, reason: 'reinforcement-expired' });
            }, { owner: extra });
          }
          refreshCrabDef(battle, unit, bb);
        }
      }, { owner: unit });
      if (!first) refreshCrabDef(battle, unit, bb);
    },
    ...(!first ? { onTick: ({ battle, dt }) => {
      unit.mem.beanstalkDpClock += dt;
      while (unit.mem.beanstalkDpClock + 1e-9 >= bb.interval && unit.mem.beanstalkDpCount < bb.value) {
        unit.mem.beanstalkDpClock -= bb.interval; unit.mem.beanstalkDpCount++;
        battle.addDp(unit.ownerId, bb.cost);
      }
      refreshCrabDef(battle, unit, bb);
    }, onEnd: ({ battle, reason }) => {
      // The twelfth source tick is exactly the duration boundary. Handle it if
      // the skill's duration bookkeeping ran before that frame's periodic tick.
      if (reason === 'duration' && live(unit) && unit.mem.beanstalkDpCount < bb.value)
        battle.addDp(unit.ownerId, (bb.value - unit.mem.beanstalkDpCount) * bb.cost);
      refreshCrabDef(battle, unit, bb);
    } } : {}),
  };
  unit.mem.summonSkillSync = battle => refreshCrabDef(battle, unit, bb);
}

export function installBeanstalk({ battle, unit, def }) {
  battle.on('hit', ctx => {
    if (ctx.source === unit && ctx.dmg.isAttack && ctx.target.blockedBy?.ownerUnit === unit)
      ctx.dmg.amount *= def.traitBb.atk_scale;
  }, { owner: unit });
}
