// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../../data/arkpedia-native-operators/char_4207_branch.json' with { type: 'json' };
import { StandardBattle } from '../../server/sim/arkpedia.js';
import { normalizeChess } from '../../server/sim/simdata.js';
import { defaultBuild } from '../../shared/arkpedia/loadout.js';
import { BRANCH_ID as ID, selectedBranchBuild } from '../../server/sim/content/arkpedia-branch-source.js';
import { prepareBranch, BRANCH_CONTRACT } from '../../server/sim/content/arkpedia-branch.js';
export { near, advance, until } from './mon3tr-fixture.js';
export function make({ skill = 1, elite = 2, rank = [4, 7, 10][elite], potential = 1, trust = 0,
  dir = 'RIGHT', defer = false, install = true, contract = BRANCH_CONTRACT, mutate } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_122_beagle)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.recordEvents = true;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level: e.tables.character.phases[elite].maxLevel, skillId: `skchr_branch_${skill}`,
    skillRank: rank, potential, trust, module: 'none' }, r = selectedBranchBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.appellation, profession: c.profession, position: c.position,
    subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId, rangeGrid: r.skillRangeGrid, trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 3, 3, { dir });
  const prepared = prepareBranch(b, u, { contract }); b._setupUnit(u, prepared.kit); if(install)prepared.controller.install();
  const shots = [], heals = [], attacks = [], hits = [];
  const add = b.addProjectile.bind(b); b.addProjectile = p => { if (p.source === u) shots.push({ ...p, time: b.time }); return add(p); };
  b.on('calculatedHeal', ctx => { if (ctx.source === u) heals.push({ ...ctx, time: b.time }); });
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  if (!defer) assert.ok(b._deploy(u));
  return { b, u, build, ...prepared, shots, heals, attacks, hits };
}
export function enemy(f,{row=3,col=3,hp=1000000,flying=false,flags={}}={}) {
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
 Object.assign(e.base,{maxHp:hp,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;
 if(flying)e.motion='FLY';
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});f.b._buildEnemyIndex();return e;
}
export function cast(f){f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate(),true);}
