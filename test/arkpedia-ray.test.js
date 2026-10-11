// SPDX-License-Identifier: GPL-3.0-or-later
// Selected builds and public deployment paths; isolated link/controller fixtures
// cover additional damage, interruption and phase-clock boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { summonRecordFor, summonCardId, summonUnitId } from '../shared/arkpedia/summons.js';
import { regularSummonCards, summonPlacementError, deployRegularSummon, retreatRegularSummon }
  from '../server/sim/content/arkpedia-summons.js';
import { rayPlacementKeys } from '../server/sim/content/arkpedia-ray-combat.js';
const ID = 'char_4117_ray', TOKEN = 'token_10034_ray_sndbst';
const near = (a, z, tolerance = 1e-5) => assert.ok(Math.abs(a - z) <= tolerance, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
};
function make({ skill = 1, rank = 10, elite = 2, level, potential = 1, trust = 0, dir = 'RIGHT', defer = false } = {}) {
  const d = structuredClone(data), op = d.operators[ID];
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const build = { ...defaultBuild(op), elite, level: level ?? op.phases[elite].maxLevel,
    potential, trust, skillId: `skchr_ray_${skill}`, skillRank: rank };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const deploy = () => { b.addDp('arkpedia', 99); return b.deployOperator(ID, 1, 4, dir); };
  return { b, build, u: defer ? null : deploy(), deploy };
}
const card = b => regularSummonCards(b).find(s => s.ownerId === ID);
const scout = b => deployRegularSummon(b, summonCardId(ID), 2, 5);
function enemy(b, { hp = 100000, x = 4.9, y = 1 } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] });
  e.x = x; e.y = y; e.base.maxHp = 100000; e.base.def = 0; e.base.moveSpeed = 0;
  e.markDirty(); void e.s; e.hp = hp;
  b.addBuff(e, { key: 'pin', flags: { noMove: true, disarm: true } }); b._buildEnemyIndex(); return e;
}
function cast(b, u) {
  u.skill.setSpTotal(u.skill.spCost);
  assert.equal(u.skill.manual ? b.activateOperator(ID) : u.skill.activate('fixture'), true);
}

test('selected owner level, potential and trust interpolate source stats without applying focus passively', () => {
  const op = data.operators[ID];
  for (const elite of [0, 1, 2]) for (const level of [1, Math.ceil(op.phases[elite].maxLevel / 2), op.phases[elite].maxLevel])
    for (const potential of [1, 5, 6]) for (const trust of [0, 100, 200]) {
      const build = { ...defaultBuild(op), elite, level, potential, trust, skillRank: [4, 7, 10][elite] };
      const r = recordFor(build, data), p = op.phases[elite], lo = p.attributesKeyFrames[0], hi = p.attributesKeyFrames.at(-1);
      const ratio = (level - lo.level) / (hi.level - lo.level);
      for (const k of ['maxHp', 'atk', 'def']) {
        const favor = trust ? op.favorKeyFrames.at(-1).data[k] : op.favorKeyFrames[0].data[k];
        const bonus = op.potentialRanks.slice(0, potential - 1).flat().filter(m => m.attributeType === { maxHp: 'MAX_HP', atk: 'ATK', def: 'DEF' }[k]).reduce((s, m) => s + m.value, 0);
        near(r.stats[k], Math.round(lo.data[k] + (hi.data[k] - lo.data[k]) * ratio + favor) + bonus);
      }
      assert.deepEqual(r.arkpedia.modifiers, {});
    }
});
test('all thirty selected skill ranks retain exact source coefficients, charges and recovery types', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const { b, u } = make({ skill, rank }); const raw = data.operators[ID].skills[skill - 1].levels[rank - 1];
    assert.deepEqual(u.def.skill.bb, Object.fromEntries(raw.blackboard.map(v => [v.key, v.value])));
    near(u.skill.spCost, raw.spData.spCost); near(u.skill.spTotal, raw.spData.initSp);
    assert.equal(u.skill.maxCharges, raw.spData.maxChargeTime); assert.equal(u.skill.manual, skill !== 2);
    assert.equal(u.mem.rayMagazine.bullets, 8); assert.equal(card(b).record.skill?.skillId ?? null, skill === 2 ? 'sktok_ray_2' : null);
  }
});
test('E0 has four bullets and no Sandbeast deck; locked skills and excessive ranks fail closed', () => {
  const { b, u, build } = make({ elite: 0, rank: 4 }); assert.equal(u.mem.rayMagazine.bullets, 4);
  assert.equal(card(b), undefined); assert.throws(() => scout(b), /summoner/);
  assert.throws(() => recordFor({ ...build, skillId: 'skchr_ray_2' }, data));
  assert.throws(() => recordFor({ ...build, skillRank: 5 }, data));
  assert.throws(() => summonRecordFor(ID, build, data.tokens), /Sandbeast/);
});
test('Sandbeast uses independent source levels, original null skill slots and promotion lifetime', () => {
  for (const elite of [1, 2]) for (const level of [1, data.operators[ID].phases[elite].maxLevel]) for (const skill of [1, 2]) {
    const { b, build } = make({ elite, level, skill, rank: elite === 1 ? 7 : 10, potential: 6, trust: 200 });
    const r = summonRecordFor(ID, build, data.tokens), frames = data.tokens[TOKEN].phases[elite].attributesKeyFrames;
    for (const k of ['maxHp', 'atk', 'def']) near(r.stats[k], (level === 1 ? frames[0] : frames.at(-1)).data[k]);
    assert.equal(r.talents[0].bb.duration, elite === 1 ? 15 : 25); assert.equal(r.stats.cost, 3);
    assert.equal(r.stats.respawnTime, 30); assert.equal(r.stats.blockCnt, 0); assert.equal(r.stats.maxDeployCount, 1);
    assert.equal(card(b).stock, 1); assert.equal(r.skill?.skillId ?? null, skill === 2 ? 'sktok_ray_2' : null);
    assert.throws(() => summonRecordFor(ID, { ...build, skillRank: 11 }, data.tokens));
  }
  const source = structuredClone(data.tokens); source[TOKEN].skills[0].id = 'invented';
  assert.throws(() => summonRecordFor(ID, defaultBuild(data.operators[ID]), source), /original skill slots/);
});
test('public Sandbeast placement costs3DP, zero slots, fixed facing and refuses duplicates before mutation', () => {
  const { b } = make(), dp = b.dp, slots = b.deployedSlots(); const t = scout(b);
  near(dp - b.dp, 3); assert.equal(b.deployedSlots(), slots); assert.equal(t.dir, 'RIGHT'); assert.equal(t.kind, 'device');
  assert.equal(card(b).stock, 0); assert.equal(card(b).deployed, 1); assert.equal(t.s.flags.noHeal, true);
  assert.equal(t.s.flags.invulnerable, true); assert.equal(t.skill.noSkill, true);
  const after = b.dp, count = b.allyUnits.length;
  assert.throws(() => deployRegularSummon(b, summonCardId(ID), 2, 6), /remaining/);
  near(b.dp, after); assert.equal(b.allyUnits.length, count); assert.equal(card(b).stock, 0);
});
test('invalid terrain, outside range, occupied tile, insufficientDP and nonfullscreen placement preserve ready stock', () => {
  const { b } = make(); const dp = b.dp, count = b.allyUnits.length;
  for (const [r, c] of [[-1, 2], [1, 4], [0, 0]]) {
    assert.ok(summonPlacementError(b, summonCardId(ID), r, c));
    assert.throws(() => deployRegularSummon(b, summonCardId(ID), r, c));
    near(b.dp, dp); assert.equal(card(b).stock, 1); assert.equal(b.allyUnits.length, count);
  }
  b.getPlayer('arkpedia').dp = 2; assert.match(summonPlacementError(b, summonCardId(ID), 2, 5), /DP/);
  b.setViewport('embedded'); assert.match(summonPlacementError(b, summonCardId(ID), 2, 5), /fullscreen/);
  assert.equal(card(b).stock, 1);
});
test('extra Sandbeast targeting never expands its public deployment range; S2/S3 source grids do', () => {
  for (const skill of [2, 3]) {
    const { b, u } = make({ skill }); const before = rayPlacementKeys(u); scout(b); advance(b, .134);
    const extra = [...u.rangeKeySet].find(k => !before.has(k) && b.grid.inRect(Math.floor(k / 21), k % 21));
    assert.ok(extra != null); assert.equal(rayPlacementKeys(u).has(extra), false);
    // Independently restore a ready card for the selector boundary only; the
    // actual max-one limit still applies while the first token remains alive.
    const state = b.regularSummons.get(summonCardId(ID)); state.stock = 1;
    const t = b.allyUnits.find(a => a.defId === TOKEN); b.retreat(t, { permanent: true });
    state.stock = 1; state.readyAt = 0;
    assert.match(summonPlacementError(b, summonCardId(ID), Math.floor(extra / 21), extra % 21), /attack range/);
    u.atkCd = 1000; cast(b, u); assert.notDeepEqual([...rayPlacementKeys(u)], [...before]);
    assert.deepEqual([...rayPlacementKeys(u)], [...u.rangeKeySet]);
  }
});
test('natural selected attacks spend one bullet per accepted birth and S2 starts after sixteen births', () => {
  for (const skill of [1, 2, 3]) {
    const { b, u } = make({ skill }), e = enemy(b); const events = [];
    b.on('attack', ({ attacker }) => { if (attacker === u) events.push(b.time); });
    advance(b, .7); assert.equal(events.length, 1); assert.equal(u.mem.rayMagazine.bullets, 7); assert.ok(e.hp < 100000);
    if (skill === 2) {
      for (let i = 0; i < Math.round(80 / b.dt) && !u.skill.active; i++) b.step();
      assert.deepEqual(b.errors, []); assert.equal(events.length, 16); assert.equal(u.skill.active, true);
      assert.equal(u.mem.rayController.mode, 2); assert.equal(u.skill.timeLeft, Infinity);
    }
  }
});
test('public manual S1 requires enemy; S3 starts full-refill gate with selected deadline', () => {
  const first = make(); first.u.skill.setSpTotal(first.u.skill.spCost);
  assert.equal(first.b.activateOperator(ID), false); const e = enemy(first.b); first.u.atkCd = 1000;
  assert.equal(first.b.activateOperator(ID), true); advance(first.b, .6); assert.ok(e.hp < 100000);
  const third = make({ skill: 3 }); third.u.atkCd = 1000; third.u.mem.rayMagazine.commitFire(0);
  cast(third.b, third.u); advance(third.b, .3); assert.equal(third.u.mem.rayMagazine.refillOnly, true);
  advance(third.b, .6); assert.equal(third.u.mem.rayMagazine.bullets, 8); assert.equal(third.u.mem.rayMagazine.refillOnly, false);
});
test('manual token retreat refunds1DP once and stock returns only after thirty seconds', () => {
  const { b, u } = make(); u.atkCd = 1000; const t = scout(b), dp = b.dp;
  retreatRegularSummon(b, summonUnitId(t)); near(b.dp - dp, 1); assert.equal(card(b).stock, 0);
  assert.throws(() => retreatRegularSummon(b, summonUnitId(t)), /not deployed/); near(b.dp - dp, 1);
  advance(b, 29.9); assert.equal(card(b).stock, 0); advance(b, .2); assert.equal(card(b).stock, 1);
  assert.equal(card(b).available, true); assert.equal(summonPlacementError(b, summonCardId(ID), 2, 5), null);
});
test('owner withdraw removes unborn token; redeployment has fresh stock and magazine, detached clocks cannot mutate it', () => {
  const f = make(); f.u.atkCd = 1000; const oldCard = f.b.regularSummons.get(summonCardId(ID)), t = scout(f.b), oldMag = f.u.mem.rayMagazine;
  oldMag.commitFire(0); f.b.retreatOperator(ID); assert.equal(f.u.alive, false); assert.equal(t.alive, false);
  assert.equal(oldMag.removed, true); assert.equal(card(f.b).available, false); advance(f.b, 71);
  const u = f.deploy(); u.atkCd = 1000; assert.notEqual(u, f.u); assert.notEqual(f.b.regularSummons.get(summonCardId(ID)), oldCard);
  assert.equal(u.mem.rayMagazine.bullets, 8); assert.equal(card(f.b).stock, 1);
  advance(f.b, 35); assert.equal(card(f.b).stock, 1); assert.equal(oldCard.stock, 0); assert.equal(t.alive, false);
});

test('ammunition HUD tracks owner shots and S2-only collected ammunition without replacing SP readiness', async () => {
  const { ammunitionHud, skillHud } = await import('../shared/arkpedia/skill-hud.js');
  for (const skill of [1, 2, 3]) {
    const { b, u } = make({ skill }), t = scout(b); advance(b, .134);
    assert.equal(ammunitionHud(u).current, 8); assert.equal(ammunitionHud(t)?.maximum ?? null, skill === 2 ? 8 : null);
    enemy(b); advance(b, .7); assert.equal(ammunitionHud(u).current, 7);
    if (skill === 2) assert.equal(ammunitionHud(t).current, 1);
    assert.equal(skillHud(u.skill).ready, skill === 1);
    retreatRegularSummon(b, summonUnitId(t)); assert.equal(ammunitionHud(t), null);
    assert.equal(ammunitionHud(u).current, skill === 2 ? 8 : 7);
  }
});
test('accepted attack event does not restart or replace a controller-owned original Loop animation', async () => {
  const { installFakePixi } = await import('./render/fakepixi.js'), fake = installFakePixi();
  try {
    const { BattleActor } = await import('../public/arkpedia/battle-actor.js');
    const { b, u } = make(); enemy(b); b.recordEvents = true; advance(b, .7);
    const shot = b.drainEvents().find(e => e[0] === 'atk' && e[1] === u.id);
    assert.equal(shot[4].animation, 'none');
    const model = data.sd.models[`operator/${ID}/default/front`];
    const skeleton = { animations: Object.keys(model.animations).map(name => ({ name })) };
    const actor = new BattleActor(skeleton, { anims: model.animationRoles, animations: model.animations, hits: model.hits }, 0, { attackDrivenSkill: true });
    actor.setRegularVisual(u.mem.regularFormVisual); actor.update(.2); const current = actor.current;
    actor.attack(1.6, false, shot[4]); assert.equal(actor.current, current); assert.equal(current, 'Attack_Loop');
  } finally { fake.restore(); }
});
