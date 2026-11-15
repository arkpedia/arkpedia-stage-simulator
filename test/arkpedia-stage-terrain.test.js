// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { compileStageTerrain } from '../shared/arkpedia/stage-terrain.js';
const id = 'char_123_fang';
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-6, `${a} != ${b}`);
function fixture() {
  const geometry = structuredClone(mvp.stage.geometry);
  geometry.waves = [];
  const type = geometry.tileLegend.length;
  geometry.tileLegend.push({ key: 'tile_infection', height: 'low', walkable: true, deployable: 'melee', flyable: true,
    blackboard: { atk: .5, attack_speed: 50, damage: 60, duration: 2 } });
  geometry.tileGrid[2][7] = type;
  const source = { ...mvp, stage: { ...mvp.stage, geometry, terrain: compileStageTerrain(geometry) } };
  const b = new StandardBattle(source, { operators: [defaultBuild(mvp.operators[id])] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  return { b, geometry };
}
function advance(b, seconds) { for(let n=0;n<Math.ceil(seconds/b.dt);n++)b.step(); assert.deepEqual(b.errors, []); }

test('Active Originium uses level values, drains once per second and does not stack on repeated contact', () => {
  const { b } = fixture(), u = b.deployOperator(id, 2, 7, 'RIGHT');
  const atk = u.s.atk, hp = u.hp;
  assert.ok(u.findBuff('terrain:infection'));
  near(u.findBuff('terrain:infection').mods.atkPct, .5);
  near(u.findBuff('terrain:infection').mods.aspd, 50);
  advance(b, 3.05);
  near(hp-u.hp, 180);
  near(u.s.atk, atk);
  assert.equal(u.buffs.filter(x=>x.key==='terrain:infection').length, 1);
});

test('leaving retains the timed effect; withdrawal and a new deployment do not inherit it', () => {
  const { b } = fixture(), u = b.deployOperator(id, 2, 7, 'RIGHT');
  advance(b, .1);
  assert.ok(b.relocate(u, 2, 6));
  advance(b, 1.1);
  assert.ok(u.findBuff('terrain:infection'));
  advance(b, 1.1);
  assert.equal(u.findBuff('terrain:infection') ?? null, null);
  assert.ok(b.relocate(u, 2, 7)); advance(b, .1);
  assert.ok(u.findBuff('terrain:infection'));
  b.retreatOperator(id); b.bench[id].readyAt=0; b.addDp('arkpedia', 99);
  const replacement = b.deployOperator(id, 2, 6, 'RIGHT');
  assert.equal(replacement.findBuff('terrain:infection') ?? null, null);
});

test('ground enemies acquire the effect; airborne units do not', () => {
  const { b } = fixture();
  const ground = b.spawnEnemy('enemy_1007_slime', { pos: [2,7] });
  assert.ok(ground.findBuff('terrain:infection'));
  b.removeBuff(ground,'terrain:infection'); ground.motion = 'FLY';
  advance(b,.1);
  assert.equal(ground.findBuff('terrain:infection') ?? null,null);
});

test('missing or unknown terrain parameters block compilation', () => {
  const { geometry } = fixture(), tile=geometry.tileLegend.at(-1);
  tile.blackboard.unreviewed_rule=1;
  assert.throws(()=>compileStageTerrain(geometry),/Unsupported Active Originium/);
  delete tile.blackboard;
  assert.throws(()=>compileStageTerrain(geometry),/Unsupported Active Originium/);
});

test('mixed terrain strengths require a separate priority/replacement implementation', () => {
  const { geometry } = fixture();
  const tile = structuredClone(geometry.tileLegend.at(-1));
  tile.blackboard.atk = .9;
  geometry.tileGrid[2][6] = geometry.tileLegend.length;
  geometry.tileLegend.push(tile);
  assert.throws(() => compileStageTerrain(geometry), /mixed Active Originium/);
});
