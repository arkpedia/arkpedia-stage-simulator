// SPDX-License-Identifier: GPL-3.0-or-later
// Public selected builds/deployment. Native cast cursor and frame parity are
// explicitly unverified; these checks exercise the documented local contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-nymph-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { NYMPH_ID } from '../server/sim/content/arkpedia-nymph-links.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';

const near = (a, z, tolerance = 1e-5) => assert.ok(Math.abs(a - z) < tolerance, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
const bb = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
function make({ skill = 1, rank = 10, elite = 2, potential = 1, trust = 0, dir = 'RIGHT' } = {}) {
  const d = structuredClone(data), op = d.operators[NYMPH_ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const build = { ...defaultBuild(op), elite, level: op.phases[elite].maxLevel, potential, trust,
    skillId: `skchr_nymph_${skill}`, skillRank: rank };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  const deploy = () => { b.addDp('arkpedia', 99); return b.deployOperator(NYMPH_ID, 1, 4, dir); };
  const u = deploy(); assert.ok(u);
  const hits = [], attacks = [];
  b.on('damaged', c => hits.push({ ...c, time: b.time }));
  b.on('attack', c => { if (c.attacker === u) attacks.push({ ...c, time: b.time }); });
  return { b, u, build, deploy, hits, attacks };
}
function enemy(f, { x = 5, y = 1, fly = false } = {}) {
  const e = f.b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] }); e.x = x; e.y = y;
  Object.assign(e.base, { maxHp: 1e7, def: 0, res: 0, moveSpeed: 0 });
  if (fly) e.motion = 'FLY'; e.markDirty(); void e.s; e.hp = 1e7;
  Object.defineProperty(e, 'gaugeMax', { value: 1e7, configurable: true });
  f.b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  f.b._buildEnemyIndex(); return e;
}
const cast = f => { f.u.skill.setSpTotal(f.u.skill.spCost * f.u.skill.maxCharges);
  assert.equal(f.b.activateOperator(NYMPH_ID), true); };

test('public Nymph builds preserve pinned promotion/level/potential/trust and exclude conditional talent ATK', () => {
  const c = evidence.tables.character, op = data.operators[NYMPH_ID];
  for (const elite of [0, 1, 2]) for (const level of [1, Math.ceil(op.phases[elite].maxLevel / 2), op.phases[elite].maxLevel])
    for (const potential of [1, 2, 3, 4, 5, 6]) for (const trust of [0, 50, 100, 200]) {
      const build = { ...defaultBuild(op), elite, level, potential, trust, skillRank: [4, 7, 10][elite] };
      const r = recordFor(build, data), frames = c.phases[elite].attributesKeyFrames;
      const lo = frames[0], hi = frames.at(-1), t = (level - lo.level) / (hi.level - lo.level);
      for (const k of ['maxHp', 'atk', 'def', 'cost', 'respawnTime', 'attackSpeed', 'magicResistance']) {
        let expected = lo.data[k] + (hi.data[k] - lo.data[k]) * t;
        if (['maxHp', 'atk', 'def'].includes(k)) {
          const fs = c.favorKeyFrames;
          const favor = fs[0].data[k] + (fs.at(-1).data[k] - fs[0].data[k]) * Math.min(trust, 100) / 100;
          expected = Math.round(expected + favor);
        }
        const types = { maxHp: 'MAX_HP', atk: 'ATK', def: 'DEF', cost: 'COST', respawnTime: 'RESPAWN_TIME',
          attackSpeed: 'ATTACK_SPEED', magicResistance: 'MAGIC_RESISTANCE' };
        for (const p of c.potentialRanks.slice(0, potential - 1))
          for (const m of p.buff?.attributes?.attributeModifiers ?? [])
            if (m.attributeType === types[k]) expected += m.value;
        near(r.stats[k], expected);
      }
      assert.deepEqual(r.arkpedia.modifiers, {});
      const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
      assert.deepEqual(r.talents.map(t => t.bb), talents.map(t => bb(t.blackboard)));
      if (elite === 2) assert.equal(r.talents[1].bb.max_stack_cnt, potential >= 5 ? 12 : 10);
    }
});
test('Nymph rejects locked skills and ranks before promotion; Elite0 has no invented Necrosis passive', () => {
  const f = make({ elite: 0, rank: 4 }); assert.deepEqual(f.u.def.talents, []);
  for (const skillId of ['skchr_nymph_2', 'skchr_nymph_3'])
    assert.throws(() => recordFor({ ...f.build, skillId }, data));
  assert.throws(() => recordFor({ ...f.build, skillRank: 5 }, data));
  const e1 = make({ elite: 1, rank: 7 }); assert.equal(e1.u.def.talents.length, 1);
  assert.throws(() => recordFor({ ...e1.build, skillId: 'skchr_nymph_3' }, data));
  assert.throws(() => recordFor({ ...e1.build, skillRank: 8 }, data));
  enemy(f); advance(f.b, 2); assert.equal(f.hits.length, 1); near(f.hits[0].target.elem.apoptosis, 0);
});
test('one-second original entrance prevents attacks/activation, preserves selected SP, and works in every facing', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ dir }), [x, y] = { RIGHT: [5, 1], LEFT: [3, 1], UP: [4, 2], DOWN: [4, 0] }[dir];
    enemy(f, { x, y, fly: true }); f.u.skill.setSpTotal(f.u.skill.spCost);
    assert.equal(f.u.mem.regularFormVisual.clip, 'Start');
    assert.equal(f.b.activateOperator(NYMPH_ID), false);
    advance(f.b, .9); assert.equal(f.attacks.length, 0); assert.equal(f.u.mem.regularFormVisual.clip, 'Start');
    advance(f.b, .3); assert.equal(f.u.mem.regularFormVisual.clip, 'Attack');
    advance(f.b, .6); assert.equal(f.attacks.length, 1); assert.equal(f.hits.length, 1);
  }
});
test('all thirty public skill ranks retain exact blackboards, SP, charges, duration and expanded range', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), raw = evidence.tables.skills[`skchr_nymph_${skill}`].levels[rank - 1];
    assert.deepEqual(f.u.def.skill.bb, bb(raw.blackboard));
    near(f.u.skill.spCost, raw.spData.spCost); near(f.u.skill.spTotal, raw.spData.initSp);
    assert.equal(f.u.skill.maxCharges, raw.spData.maxChargeTime); assert.equal(f.u.skill.manual, true);
    advance(f.b, 1.1); enemy(f); const keys = [...f.u.rangeKeys], base = f.u.s.atk; cast(f);
    if (skill === 2) {
      assert.equal(f.u.skill.kind, 'charges'); assert.equal(f.u.skill.pending, true);
      assert.equal(skillHud(f.u.skill).text, 'Skill casting');
      near(f.u.skill.spTotal, (raw.spData.maxChargeTime - 1) * raw.spData.spCost);
      assert.equal(f.u.skill.gainSp(10, 'fixture'), 0); assert.equal(f.b.activateOperator(NYMPH_ID), false);
      const p = f.u.mem.nymphController.phase;
      near(p.releaseAt - f.b.time, .2666666805744171); near(p.readyAt - f.b.time, 1.1, 1e-6);
      advance(f.b, .8); assert.equal(f.hits.filter(h => h.dmg.tags.includes('nymph:s2:direct')).length, 1);
      assert.equal(f.attacks.length, 0); assert.equal(f.u.skill.pending, true);
      advance(f.b, .4); assert.equal(f.u.skill.pending, false); assert.equal(f.u.skill.active, false);
    } else if (skill === 1) {
      near(f.u.s.atk, base * (1 + f.u.def.skill.bb.atk)); near(f.u.skill.timeLeft, raw.duration);
      assert.deepEqual(f.u.rangeKeys, keys);
    } else {
      near(f.u.s.atk, base); advance(f.b, .31);
      near(f.u.s.atk, base * (1 + f.u.def.skill.bb.atk));
      near(f.u.s.aspd, 100 + f.u.def.skill.bb.attack_speed);
      assert.notDeepEqual(f.u.rangeKeys, keys); assert.ok(f.u.skill.timeLeft > raw.duration - .1);
    }
  }
});
test('S2 local first-event mapping spends one command, keeps direct Fear separate from delayed splash, and resumes SP', () => {
  const f = make({ skill: 2 }); advance(f.b, 1.1); const a = enemy(f), z = enemy(f, { x: 5.1 }); cast(f);
  advance(f.b, .6); assert.ok(a.findBuff('fear')); assert.equal(z.findBuff('fear'), null);
  advance(f.b, .4); assert.equal(f.hits.filter(h => h.dmg.tags.includes('nymph:s2:direct')).length, 1);
  assert.equal(f.hits.filter(h => h.dmg.tags.includes('nymph:s2:splash')).length, 2);
  assert.equal(f.attacks.length, 0); near(f.u.skill.spTotal, 12);
  advance(f.b, .3); assert.ok(f.u.skill.spTotal > 12); assert.equal(f.u.skill.pending, false);
  assert.equal(f.u.skill.activations, 1);
});
test('public S3 attacks two distinct victims without replacing controller animation or inventing normal Necrosis injury', () => {
  const f = make({ skill: 3 }); advance(f.b, 1.1);
  enemy(f); enemy(f, { x: 7, y: 2 }); enemy(f, { x: 6 }); cast(f); advance(f.b, 1.4);
  assert.equal(f.attacks.length, 1); assert.equal(new Set(f.attacks[0].targets).size, 2);
  const event = f.b.drainEvents().find(e => e[0] === 'atk' && e[1] === f.u.id);
  assert.equal(event[4].animation, 'none');
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_Attack');
  assert.equal(f.hits.length, 2);
  for (const h of f.hits) { assert.ok(h.dmg.tags.includes('nymph:s3')); near(h.target.elem.apoptosis, 0); }
});
test('retreat clears pending S2 output/stacks/listeners and redeploy starts fresh controller/SP/entrance', () => {
  const f = make({ skill: 2, potential: 5 }); advance(f.b, 1.1); const e = enemy(f); cast(f);
  const old = f.u.mem.nymphController, links = f.u.mem.nymphLinks;
  f.b.emit('elementBurst', { target: e, element: 'apoptosis' }); assert.equal(links.stacks, 1);
  advance(f.b, .1); f.b.retreatOperator(NYMPH_ID); assert.equal(f.u.deployed, false);
  assert.equal(old.stopped, true); assert.equal(links.stopped, true);
  advance(f.b, 81); assert.equal(f.hits.length, 0);
  const u = f.deploy(); assert.ok(u); assert.notEqual(u.mem.nymphController, old);
  assert.equal(u.mem.nymphLinks.stacks, 0); assert.equal(u.mem.regularFormVisual.clip, 'Start');
  near(u.skill.spTotal, 9); near(u.s.atk, u.base.atk);
  advance(f.b, 2); assert.equal(old.phase, null); assert.ok(f.hits.length > 0);
});
