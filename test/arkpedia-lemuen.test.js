// SPDX-License-Identifier: GPL-3.0-or-later
// Public selected builds/deployment. Native cast cursor and frame parity are
// explicitly unverified; these checks exercise the documented local contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-lemuen-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { LEMUEN_ID } from '../server/sim/content/arkpedia-lemuen-links.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';

const near = (a, z, tolerance = 1e-5) => assert.ok(Math.abs(a - z) < tolerance, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
const bb = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
function make({ skill = 1, rank = 10, elite = 2, potential = 1, trust = 0, dir = 'RIGHT' } = {}) {
  const d = structuredClone(data), op = d.operators[LEMUEN_ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const build = { ...defaultBuild(op), elite, level: op.phases[elite].maxLevel, potential, trust,
    skillId: `skchr_lemuen_${skill}`, skillRank: rank };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  const deploy = () => { b.addDp('arkpedia', 99); return b.deployOperator(LEMUEN_ID, 1, 4, dir); };
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
  assert.equal(f.b.activateOperator(LEMUEN_ID), true); };

test('public Lemuen builds preserve pinned promotion/level/potential/trust and exclude conditional talent ATK', () => {
  const c = evidence.tables.character, op = data.operators[LEMUEN_ID];
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
      if (elite === 2) {
        assert.equal(r.talents[0].bb.interval, potential >= 5 ? 6 : 8);
        assert.equal(r.talents[1].bb.add_count, 1);
      }
    }
});
test('Lemuen rejects locked skills and ranks before promotion; Elite0 has no invented Wanted passive', () => {
  const f = make({ elite: 0, rank: 4 }); assert.deepEqual(f.u.def.talents, []);
  for (const skillId of ['skchr_lemuen_2', 'skchr_lemuen_3'])
    assert.throws(() => recordFor({ ...f.build, skillId }, data));
  assert.throws(() => recordFor({ ...f.build, skillRank: 5 }, data));
  const e1 = make({ elite: 1, rank: 7 }); assert.equal(e1.u.def.talents.length, 1);
  assert.throws(() => recordFor({ ...e1.build, skillId: 'skchr_lemuen_3' }, data));
  assert.throws(() => recordFor({ ...e1.build, skillRank: 8 }, data));
  enemy(f); advance(f.b, 2); assert.equal(f.hits.length, 1);
});

test('public entrance waits in every facing and does not give automatic S1 a manual command', () => {
  for (const dir of ['RIGHT', 'LEFT', 'UP', 'DOWN']) {
    const f = make({ dir }), [x, y] = { RIGHT: [5, 1], LEFT: [3, 1], UP: [4, 2], DOWN: [4, 0] }[dir];
    enemy(f, { x, y, fly: true });
    assert.equal(f.u.mem.regularFormVisual.clip, 'Start');
    assert.equal(f.b.activateOperator(LEMUEN_ID), false);
    advance(f.b, .9); assert.equal(f.attacks.length, 0);
    advance(f.b, 1); assert.equal(f.attacks.length, 1); assert.equal(f.hits.length, 1);
  }
});
test('all thirty public ranks retain source blackboards, SP, ammunition and selected skill modifiers', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), raw = evidence.tables.skills[`skchr_lemuen_${skill}`].levels[rank - 1];
    assert.deepEqual(f.u.def.skill.bb, bb(raw.blackboard));
    near(f.u.skill.spCost, raw.spData.spCost); near(f.u.skill.spTotal, raw.spData.initSp);
    assert.equal(f.u.skill.manual, skill !== 1); assert.equal(f.u.skill.kind, 'ammo');
    advance(f.b, 1.1); enemy(f); const base = f.u.s.atk;
    if (skill === 1) { f.u.skill.setSpTotal(f.u.skill.spCost); advance(f.b, f.b.dt); }
    else cast(f);
    assert.equal(f.u.skill.active, true);
    near(f.u.skill.ammoLeft, bb(raw.blackboard)['attack@trigger_time']);
    assert.equal(f.u.skill.gainSp(10, 'fixture'), 0);
    if (skill === 2) near(f.u.s.atk, base * (1 + bb(raw.blackboard).atk));
    assert.equal(skillHud(f.u.skill).text, `${f.u.skill.ammoLeft} ammo remaining`);
  }
});
test('public S1 spends one round on two distinct original-event targets and preserves controller animation', () => {
  const f = make(); advance(f.b, 1.1); enemy(f); enemy(f, { x: 5.1 });
  f.u.skill.setSpTotal(f.u.skill.spCost); advance(f.b, 1);
  assert.equal(f.attacks.length, 1); assert.equal(new Set(f.attacks[0].targets).size, 2);
  assert.equal(f.hits.length, 2);
  assert.equal(f.u.skill.ammoLeft, f.u.skill.ammoMax - 1);
  const event = f.b.drainEvents().find(e => e[0] === 'atk' && e[1] === f.u.id);
  assert.equal(event[4].animation, 'none');
});
test('public S2 preserves unspent ammunition on ordinary fallback and aims at a Wanted elite', () => {
  const f = make({ skill: 2 }); const e = enemy(f); e.def = { ...e.def, rank: 'ELITE' };
  advance(f.b, 1.1); cast(f); const count = f.u.skill.ammoLeft;
  advance(f.b, 5); assert.equal(f.u.skill.ammoLeft, count); assert.ok(f.attacks.length > 0);
  advance(f.b, 3); assert.ok(e.findBuff(`lemuen:${f.u.id}:wanted`));
  advance(f.b, 3); assert.ok(f.u.skill.ammoLeft < count);
  advance(f.b, f.u.def.skill.bb['attack@aim_duration'] + 2);
  assert.ok(f.hits.some(h => h.dmg.tags.includes('lemuen:s2')));
});
test('public S3 releases source-counted marks with reproducible bounded spread and cached output after retreat', () => {
  const outputs = [];
  for (let run = 0; run < 2; run++) {
    const f = make({ skill: 3 }); advance(f.b, 1.1); enemy(f); cast(f);
    advance(f.b, .9); const bomb = f.u.mem.lemuenController.bombardment;
    assert.ok(bomb.marks.length > 0); assert.equal(f.b.activateOperator(LEMUEN_ID), true);
    assert.equal(bomb.released, true); assert.ok(bomb.emitted.length > 0);
    outputs.push(bomb.emitted.map(p => [p.to.x, p.to.y]));
    const maximum = f.u.def.skill.bb['attack@emit_offset'];
    for (const p of bomb.emitted) assert.ok(Math.hypot(p.to.x - p.x, p.to.y - p.y) <= maximum);
    f.b.retreatOperator(LEMUEN_ID); advance(f.b, 2);
    assert.ok(f.hits.some(h => h.dmg.tags.includes('lemuen:s3')));
  }
  assert.deepEqual(outputs[0], outputs[1]); assert.notEqual(outputs[0][0][0], 5);
});
test('actual redeployment owns a fresh entrance, selected SP and full twenty-second capacity clock', () => {
  const f = make({ skill: 2 }); advance(f.b, 23); const old = f.u.mem.lemuenController;
  assert.equal(old.talents.talent2Applied, true); f.b.retreatOperator(LEMUEN_ID);
  assert.equal(old.stopped, true); advance(f.b, 81);
  const u = f.deploy(), fresh = u.mem.lemuenController;
  assert.notEqual(fresh, old); assert.equal(fresh.talents.talent2Applied, false);
  assert.equal(u.mem.regularFormVisual.clip, 'Start');
  near(fresh.talents.talent2At, f.b.time + 20);
  near(u.skill.spTotal, evidence.tables.skills.skchr_lemuen_2.levels[9].spData.initSp);
  near(u.s.atk, u.base.atk); advance(f.b, 19.9); assert.equal(fresh.talents.talent2Applied, false);
  advance(f.b, .2); assert.equal(fresh.talents.talent2Applied, true);
});
