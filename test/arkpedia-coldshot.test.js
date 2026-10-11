// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { ammunitionHud, skillHud } from '../shared/arkpedia/skill-hud.js';
const ID = 'char_4104_coldst';
const near = (a, z, tolerance = 1e-5) => assert.ok(Math.abs(a - z) <= tolerance, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
};
function make({ skill = 1, rank = 10, elite = 2, potential = 1, trust = 0, dir = 'RIGHT' } = {}) {
  const d = structuredClone(data), op = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const build = { ...defaultBuild(op), elite, level: op.phases[elite].maxLevel, potential, trust,
    skillId: skill === 1 ? 'skcom_atk_up[3]' : 'skchr_coldst_2', skillRank: rank };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const deploy = () => { b.addDp('arkpedia', 99); return b.deployOperator(ID, 1, 4, dir); };
  return { b, build, u: deploy(), deploy };
}
function enemy(b, { x = 4.9, y = 1 } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] }); e.x = x; e.y = y;
  e.base.maxHp = 100000; e.base.def = 0; e.base.moveSpeed = 0; e.markDirty(); void e.s; e.hp = 100000;
  b.addBuff(e, { key: 'pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
test('Coldshot selected levels, potential and trust preserve source interpolation without passive talent scaling', () => {
  const op = data.operators[ID];
  for (const elite of [0, 1, 2]) for (const level of [1, Math.ceil(op.phases[elite].maxLevel / 2), op.phases[elite].maxLevel])
    for (const potential of [1, 5, 6]) for (const trust of [0, 100, 200]) {
      const build = { ...defaultBuild(op), elite, level, potential, trust, skillRank: [4, 7, 10][elite] };
      const r = recordFor(build, data), p = op.phases[elite], lo = p.attributesKeyFrames[0], hi = p.attributesKeyFrames.at(-1);
      const ratio = (level - lo.level) / (hi.level - lo.level);
      for (const k of ['maxHp', 'atk', 'def']) {
        const favor = trust ? op.favorKeyFrames.at(-1).data[k] : op.favorKeyFrames[0].data[k];
        near(r.stats[k], Math.round(lo.data[k] + (hi.data[k] - lo.data[k]) * ratio + favor));
      }
      near(r.stats.cost, p.attributesKeyFrames.at(-1).data.cost - (potential === 6 ? 3 : potential >= 4 ? 2 : 0));
      near(r.stats.respawnTime, 80 - (potential >= 3 ? 10 : 0));
      assert.deepEqual(r.arkpedia.modifiers, {});
      if (elite) near(r.talents[0].bb.atk_scale, (elite === 1 ? 1.2 : 1.3) + (potential >= 5 ? .03 : 0));
    }
});
test('all20 public selected skills retain exact rank coefficients, manual recovery and ammunition HUD', () => {
  for (const skill of [1, 2]) for (let rank = 1; rank <= 10; rank++) {
    const { b, u } = make({ skill, rank }), raw = data.operators[ID].skills[skill - 1].levels[rank - 1];
    assert.deepEqual(u.def.skill.bb, Object.fromEntries(raw.blackboard.map(v => [v.key, v.value])));
    near(u.skill.spCost, raw.spData.spCost); near(u.skill.spTotal, raw.spData.initSp);
    assert.equal(u.skill.maxCharges, 1); assert.equal(u.skill.manual, true);
    assert.deepEqual(ammunitionHud(u), { current: 8, maximum: 8, text: '8 / 8 ammunition' });
    assert.equal(skillHud(u.skill).ready, false); advance(b, raw.spData.spCost - raw.spData.initSp + .1);
    assert.equal(skillHud(u.skill).ready, true); const before = u.s.atk;
    assert.equal(b.activateOperator(ID), true); near(u.s.atk, before * (1 + u.def.skill.bb.atk));
    assert.equal(ammunitionHud(u).current, 8); assert.equal(skillHud(u.skill).state, 'active');
    enemy(b); advance(b, .7); assert.equal(ammunitionHud(u).current, 7);
  }
});
test('E0 has four rounds and refuses lockedS2/excessive ranks; promotion1 has six rounds', () => {
  const f = make({ elite: 0, rank: 4 }); assert.equal(ammunitionHud(f.u).current, 4);
  assert.throws(() => recordFor({ ...f.build, skillId: 'skchr_coldst_2' }, data));
  assert.throws(() => recordFor({ ...f.build, skillRank: 5 }, data));
  const e1 = make({ elite: 1, rank: 7 }); assert.equal(ammunitionHud(e1.u).current, 6);
  assert.throws(() => recordFor({ ...e1.build, skillRank: 8 }, data));
});
test('selected normal attack has one victim, includes flying targets and spends no reload attackSP', () => {
  const { b, u } = make(), e = enemy(b), other = enemy(b, { x: 5.1 });
  e.motion = 'FLY'; const events = [];
  b.on('attack', ({ attacker }) => { if (attacker === u) events.push(b.time); });
  advance(b, .7); assert.equal(events.length, 1); assert.ok(e.hp < 100000); near(other.hp, 100000);
  assert.equal(ammunitionHud(u).current, 7);
  e.x = 0; e.y = 0; other.x = 0; other.y = 0; b._buildEnemyIndex(); const sp = u.skill.spTotal;
  advance(b, 4); assert.equal(events.length, 1); assert.equal(ammunitionHud(u).current, 8);
  near(u.skill.spTotal, Math.min(u.skill.spCost, sp + 4), .05);
});
test('withdraw and redeploy create fresh magazines; detached refill cannot mutate either deployment', () => {
  const f = make(); f.u.mem.coldshotMagazine.consume(); advance(f.b, .3);
  const old = f.u.mem.coldshotMagazine; f.b.retreatOperator(ID); assert.equal(old.removed, true);
  advance(f.b, 81); const u = f.deploy(); assert.notEqual(u, f.u);
  assert.equal(ammunitionHud(u).current, 8); advance(f.b, 4);
  assert.equal(old.bullets, 7); assert.equal(ammunitionHud(u).current, 8);
});
test('original Coldshot controller animation survives accepted attack renderer events', async () => {
  const { installFakePixi } = await import('./render/fakepixi.js'), fake = installFakePixi();
  try {
    const { BattleActor } = await import('../public/arkpedia/battle-actor.js');
    const { b, u } = make({ skill: 2 }); u.skill.setSpTotal(u.skill.spCost); b.activateOperator(ID);
    enemy(b); b.recordEvents = true; advance(b, .7);
    const shot = b.drainEvents().find(e => e[0] === 'atk' && e[1] === u.id); assert.equal(shot[4].animation, 'none');
    const m = data.sd.models[`operator/${ID}/default/front`];
    const skeleton = { animations: Object.keys(m.animations).map(name => ({ name })) };
    const actor = new BattleActor(skeleton, { anims: m.animationRoles, animations: m.animations, hits: m.hits }, 0, { attackDrivenSkill: true });
    actor.setRegularVisual(u.mem.regularFormVisual); actor.update(.2);
    const current = actor.current; actor.attack(1.6, true, shot[4]); assert.equal(actor.current, current);
    assert.equal(current, 'Skill_2_Loop');
  } finally { fake.restore(); }
});
