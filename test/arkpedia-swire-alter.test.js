// SPDX-License-Identifier: GPL-3.0-or-later
// Public selected builds and regular-stage transactions on the original 0-1 map.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-swire-alter-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor, catalogueFor } from '../shared/arkpedia/loadout.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { regularSummonCards } from '../server/sim/content/arkpedia-summons.js';
import { regularTokenIdsFor } from '../shared/arkpedia/summons.js';
const ID = 'char_1033_swire2', BOMB = 'token_10031_swire2_gdtrap';
const flat = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
function until(f, predicate, seconds = 10) {
  const end = f.b.time + seconds;
  while (!predicate() && f.b.time < end) advance(f.b, f.b.dt);
  assert.ok(predicate(), `Expected condition at ${f.b.time}, ${f.controller.phase?.kind}`);
}
function make({ skill = 1, rank = 10, elite = 2, potential = 1, trust = 0, level,
  deploy = true, companion = false, dir = 'RIGHT', row = 2, col = 2 } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const op = d.operators[ID], build = { ...defaultBuild(op), elite,
    level: level ?? op.phases[elite].maxLevel, potential, trust, skillId: `skchr_swire2_${skill}`, skillRank: rank };
  const b = new StandardBattle(d, { operators: [build,
    ...(companion ? [defaultBuild(d.operators.char_208_melan)] : [])] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
  const u = deploy ? b.deployOperator(ID, row, col, dir) : null;
  const hits = [], gold = [], heal = [], bombs = [];
  b.on('damaged', ctx => hits.push(ctx)); b.on('swireGoldHit', ctx => gold.push(ctx));
  b.on('swireHeal', ctx => heal.push(ctx)); b.on('swireBombBirth', ctx => bombs.push(ctx));
  return { b, u, build, row, col, dir, controller: u?.mem.swireController, hits, gold, heal, bombs };
}
function enemy(f, { row = 2, col = 3, hp = 1e7, def = 0 } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, res: 0, moveSpeed: 0 });
  t.markDirty(); t.hp = hp;
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  f.b._buildEnemyIndex(); return t;
}

test('public Swire contains all thirty selected ranks, exact original art and explicit local execution limits', () => {
  assert.equal(REGULAR_OPERATORS[ID].mechanic, 'swire-alter');
  assert.deepEqual(source.enabledOperators, [ID]); assert.deepEqual(source.heldOperators, []);
  assert.equal(source.frameParity, false); assert.equal(source.moduleSupport, false);
  for (const face of ['front', 'back']) {
    const owner = data.sd.models[`operator/${ID}/default/${face}`];
    const original = source.models[ID][face === 'front' ? 'Front' : 'Back'];
    assert.equal(owner.skeleton.sha256, original.sha256);
    const bomb = data.sd.models[`operator/${BOMB}/default/${face}`];
    assert.equal(bomb.skeleton.sha256, source.tokenModels[BOMB][face].sha256);
    assert.equal(bomb.source.bundle.sha256, source.tokenArtwork.sourceBundle.sha256);
    assert.equal(bomb.textures.length, 1); assert.equal(bomb.hits.Attack[0], .2);
  }
  assert.equal(data.tokens[BOMB].automaticOnly, true);
  assert.deepEqual(regularTokenIdsFor([ID]), [BOMB]);
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill, rank }), s = source.tables.skills[f.build.skillId].levels[rank - 1];
    assert.deepEqual(f.u.def.skill.bb, flat(s.blackboard));
    assert.equal(f.u.skill.kind, skill === 3 ? 'toggle' : 'passive');
    assert.equal(f.u.skill.manual, false); assert.equal(f.u.skill.noSkill, false);
    assert.equal(f.u.profile.install, null); assert.equal(f.u.kit.install, null);
    assert.equal(f.controller.record.index, skill - 1);
    assert.equal(f.controller.wallet.coins, skill === 3 ? 0 : 1);
    assert.equal(f.controller.wallet.record.capacity, flat(s.blackboard).sp);
  }
});

test('public promotion, level, trust and potential stats do not double-install ATK stacks', () => {
  const c = source.tables.character, favor = c.favorKeyFrames.at(-1).data;
  for (const elite of [0, 1, 2]) for (const potential of [1, 3, 5, 6]) for (const trust of [0, 100, 200]) {
    const f = make({ elite, rank: [4, 7, 10][elite], potential, trust });
    const raw = { ...c.phases[elite].attributesKeyFrames.at(-1).data };
    for (const p of c.potentialRanks.slice(0, potential - 1))
      for (const m of p.buff?.attributes?.attributeModifiers ?? []) {
        const key = { COST: 'cost', RESPAWN_TIME: 'respawnTime', ATK: 'atk' }[m.attributeType];
        assert.ok(key, `Unreviewed public source potential ${m.attributeType}`); raw[key] += m.value;
      }
    near(f.u.s.atk, raw.atk + (trust ? favor.atk : 0));
    near(f.u.s.maxHp, raw.maxHp + (trust ? favor.maxHp : 0));
    near(f.u.s.def, raw.def + (trust ? favor.def : 0));
    near(recordFor(f.build, data).stats.cost, raw.cost);
    near(f.b.cost(ID), Math.floor(raw.cost * 1.5));
    near(f.u.base.respawnTime, raw.respawnTime); near(f.u.s.aspd, raw.attackSpeed);
    assert.equal(f.controller.wallet.stacks, 0); assert.deepEqual(f.u.def.raw.arkpedia.modifiers, {});
    assert.equal(f.u.def.raw.arkpedia.critical, undefined);
    near(f.controller.record.talent.atk, [0, .03, .04][elite]);
    assert.equal(f.controller.record.talent.max_stack_cnt, [0, 5, 8][elite] + (elite && potential >= 5 ? 1 : 0));
  }
  const f = make({ elite: 1, level: 1, rank: 7, skill: 2 });
  near(f.u.s.atk, c.phases[1].attributesKeyFrames[0].data.atk);
  assert.equal(f.controller.record.fatal, null);
});

test('public skill unlock, mastery and module gates reject builds before battle placement', () => {
  const f = make({ deploy: false }), catalogue = catalogueFor(data)[ID];
  assert.deepEqual(catalogue.skills.map(s => s.unlockElite), [0, 1, 2]); assert.deepEqual(catalogue.modules, []);
  for (const build of [{ ...f.build, elite: 0, skillRank: 4, level: 50, skillId: 'skchr_swire2_2' },
    { ...f.build, elite: 1, skillRank: 7, level: 80, skillId: 'skchr_swire2_3' },
    { ...f.build, elite: 1, skillRank: 10, level: 80 }, { ...f.build, level: 91 },
    { ...f.build, module: { id: 'unreviewed', stage: 3 } }]) assert.throws(() => recordFor(build, data));
});

test('public deployment preserves fullscreen, facing, tile, DP and slot transactions', () => {
  const f = make({ deploy: false }), dp = f.b.dp;
  f.b.setViewport('preview'); assert.throws(() => f.b.deployOperator(ID, 2, 2, 'RIGHT'), /fullscreen/);
  f.b.setViewport('fullscreen-workspace'); assert.throws(() => f.b.deployOperator(ID, 2, 2, 'invalid'), /facing/);
  assert.throws(() => f.b.deployOperator(ID, 1, 1, 'RIGHT'), /melee tile/);
  near(f.b.dp, dp); assert.equal(f.b.deployedSlots(), 0);
  const cost = f.b.cost(ID), u = f.b.deployOperator(ID, 2, 2, 'RIGHT');
  near(f.b.dp, dp - cost); assert.equal(f.b.deployedSlots(), 1); assert.equal(u.mem.swireController.u, u);
  assert.throws(() => f.b.deployOperator(ID, 2, 2, 'RIGHT'), /unavailable/);
  near(f.b.dp, dp - cost); assert.equal(f.b.deployedSlots(), 1);
});

test('public passive coins and S3 SP have distinct gauges and exactly one merchant upkeep payment', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill }), paid = f.b.dp;
    const hud = skillHud(f.u.skill);
    assert.equal(hud.ready, false); assert.equal(hud.canActivate, false); assert.equal(hud.canCancel, false);
    assert.match(hud.text, skill === 3 ? /0 \/ 5 SP/ : new RegExp(`1 / ${skill === 1 ? 3 : 5} Coins`));
    advance(f.b, 2.99); near(f.b.dp, paid); advance(f.b, .1); near(f.b.dp, paid - 3);
    assert.equal(f.controller.wallet.stacks, skill === 3 ? 0 : 1);
    near(f.u.s.atk, f.u.base.atk * (skill === 3 ? 1 : 1.04));
    assert.equal(f.u.mem.merchantNext, undefined);
  }
});

test('public S1 heals through the source attack replacement and changes only its wallet gauge', () => {
  const f = make({ companion: true }), ally = f.b.deployOperator('char_208_melan', 2, 3, 'RIGHT');
  ally.hp *= .2; const hp = ally.hp;
  assert.equal(f.b.activateOperator(ID), false);
  until(f, () => f.heal.length === 1); near(ally.hp - hp, f.u.s.atk * .8);
  assert.equal(f.heal[0].target, ally); assert.equal(f.controller.wallet.coins, 0);
  assert.match(skillHud(f.u.skill).text, /^0 \/ 3 Coins$/); assert.equal(skillHud(f.u.skill).fraction, 0);
  assert.equal(f.u.skill.spTotal, 0); assert.equal(f.b.deployedSlots(), 2);
});

test('public S2 spawns only original automatic zero-slot bombs with token credit and first-hit Slow', () => {
  const f = make({ skill: 2 }), t = enemy(f);
  const dp = f.b.dp, slotCount = f.b.deployedSlots();
  until(f, () => f.bombs.length === 1); const bomb = f.bombs[0].token;
  assert.equal(bomb.defId, BOMB); assert.equal(bomb.deploymentSlotCost, 0);
  assert.equal(bomb.mem.regularHideHp, true); assert.equal(bomb.s.flags.untargetable, true);
  assert.equal(bomb.kind, 'device'); near(f.b.dp, dp); assert.equal(f.b.deployedSlots(), slotCount);
  until(f, () => !bomb.alive);
  const hit = f.hits.find(h => h.source === bomb); assert.ok(hit); assert.equal(hit.target, t);
  near(hit.amount, 810 * 2); assert.ok(t.buffs.some(x => x.status === 'sluggish'));
  assert.equal(f.controller.wallet.coins, 0); assert.equal(regularSummonCards(f.b).some(x => x.record.id === BOMB), false);
  assert.equal(f.b.bench[BOMB], undefined); assert.equal(f.b.deployedSlots(), slotCount);
});

test('public S3 automatically opens, displays coins, hits twice and manually spends one ending snapshot', () => {
  const f = make({ skill: 3 }); until(f, () => f.u.skill.active && f.controller.phase?.kind !== 'begin');
  assert.match(skillHud(f.u.skill).text, /^1 \/ 10 Coins$/); assert.equal(skillHud(f.u.skill).canCancel, true);
  const t = enemy(f); until(f, () => f.hits.length === 2);
  near(f.hits[0].amount, 810); near(f.hits[1].amount, 810);
  assert.equal(f.hits[0].attackId, f.hits[1].attackId);
  f.controller.wallet.coins = 3;
  assert.equal(f.b.activateOperator(ID), true); assert.equal(f.u.skill.active, false);
  assert.match(skillHud(f.u.skill).text, /^0 \/ 10 Coins · Ending$/);
  assert.equal(skillHud(f.u.skill).canCancel, false); assert.equal(f.u.skill.gainSp(100, 'gift'), 0);
  until(f, () => f.gold.length === 3); assert.ok(f.gold.every(x => x.target === t));
  until(f, () => f.controller.mode === 0); assert.doesNotMatch(skillHud(f.u.skill).text, /Coins/);
  assert.equal(f.u.skill.spTotal, 0);
});

test('public S3 controls retain real manual cancellation eligibility in both UI and action path', () => {
  for (const flag of ['silence', 'stun', 'disarm']) {
    const f = make({ skill: 3 }); until(f, () => f.u.skill.active);
    f.b.addBuff(f.u, { key: 'fixture:control', flags: { [flag]: true } });
    assert.equal(skillHud(f.u.skill).canCancel, false); assert.equal(f.b.activateOperator(ID), false);
    f.b.removeBuff(f.u, 'fixture:control'); assert.equal(skillHud(f.u.skill).canCancel, true);
    assert.equal(f.b.activateOperator(ID), true);
  }
});

test('public lethal recovery retains selected potential, five/doubling DP and excludes unavailable promotion', () => {
  for (const potential of [1, 3]) {
    const f = make({ potential }), wallet = f.controller.wallet;
    for (const cost of [5, 10, 20]) {
      const dp = f.b.dp; f.b.loseHp(f.u, 1e8);
      assert.equal(f.u.alive, true); near(f.b.dp, dp - cost); near(f.u.hp, 1);
      advance(f.b, .1); near(f.u.hp, 1 + f.u.s.maxHp * (potential === 3 ? .8 : .7));
      assert.equal(wallet.fatalCost, cost * 2);
    }
  }
  const f = make({ elite: 1, rank: 7 }); f.b.loseHp(f.u, 1e8); assert.equal(f.u.alive, false);
});

test('public withdrawal refunds no DP and fresh placement resets coin/ATK/fatal state after redeploy cooldown', () => {
  const f = make(); advance(f.b, 6.2);
  assert.equal(f.controller.wallet.stacks, 2); const old = f.u, dp = f.b.dp;
  f.b.retreatOperator(ID); near(f.b.dp, dp); assert.equal(old.alive, false);
  assert.equal(f.controller.stopped, true); assert.equal(old.mem.swireCoinEconomy, undefined);
  assert.equal(f.b.deployedSlots(), 0); assert.throws(() => f.b.deployOperator(ID, 2, 2, 'RIGHT'), /redeploying/);
  advance(f.b, old.base.respawnTime + .1); f.b.addDp('arkpedia', 99);
  const fresh = f.b.deployOperator(ID, 2, 2, 'LEFT'); assert.notEqual(fresh, old);
  const wallet = fresh.mem.swireController.wallet;
  assert.equal(wallet.coins, 1); assert.equal(wallet.stacks, 0); assert.equal(wallet.fatalCost, 5);
  near(fresh.s.atk, fresh.base.atk); assert.equal(fresh.dir, 'LEFT'); assert.equal(f.b.deployedSlots(), 1);
});

test('public unpaid upkeep withdraws Swire and clears her bombs without partial payment or slot leakage', () => {
  const f = make({ skill: 2 }); until(f, () => f.bombs.length === 1);
  const bomb = f.bombs[0].token; assert.equal(bomb.alive, true);
  f.b.getPlayer('arkpedia').dp = 2; advance(f.b, 2);
  assert.equal(f.u.alive, false); assert.equal(bomb.alive, false); near(f.b.dp, 2);
  assert.equal(f.b.deployedSlots(), 0); assert.equal(f.controller.bombs.tokens.size, 0);
  assert.equal(skillHud(f.u.skill), null);
});
