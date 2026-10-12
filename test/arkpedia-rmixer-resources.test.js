// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-rmixer-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { RMIXER_ID as ID, selectedRmixerBuild } from '../server/sim/content/arkpedia-rmixer-source.js';
import { RMIXER_RESOURCE_CONTRACT as CONTRACT, prepareRmixerResources } from '../server/sim/content/arkpedia-rmixer-resources.js';

const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(f, seconds) {
  for (let i = 0; i < Math.ceil(seconds / f.b.dt - 1e-9); i++) f.b.step();
  assert.deepEqual(f.b.errors, []);
}
function until(f, condition, seconds = .2) {
  const end = f.b.time + seconds;
  while (!condition() && f.b.time < end) advance(f, f.b.dt);
  assert.ok(condition(), `Condition missing at ${f.b.time}`);
}
function make({ skill = 2, elite = 2, rank = 10, potential = 1, trust = 0, contract = CONTRACT,
  defer = false, beforeInstall = null } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_208_melan)] }); b.autoFinish = false; b.recordEvents = true;
  b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level: e.tables.character.phases[elite].maxLevel, potential, trust,
    skillRank: Math.min(rank, [4, 7, 10][elite]), skillId: `skchr_rmixer_${skill}` };
  const r = selectedRmixerBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    tags: r.tags, talents: r.talents, skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.skillRange, trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 2, 2, { dir: 'RIGHT' });
  beforeInstall?.(b, u);
  const prepared = prepareRmixerResources(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.resources.install();
  const hits = []; b.on('damaged', ctx => hits.push(ctx));
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, build, hits, deploy, ...prepared };
}
function cast(f) {
  advance(f, f.u.skill.spCost - f.u.skill.sp + f.b.dt);
  assert.equal(f.u.skill.activate('manual'), true);
}
const hit = (f, amount, type = 'true', opts = {}) => f.b.dealDamage(null, f.u,
  { amount, type, ...opts });

test('resource implementation is opt-in and cannot become a public or incomplete skill kit', () => {
  assert.equal(data.operators[ID], undefined);
  assert.deepEqual(e.enabledOperators, []);
  assert.throws(() => make({ contract: { ...CONTRACT } }), /reviewed resource contract/);
  const f = make();
  assert.throws(() => prepareRmixerResources(f.b, f.u, { contract: CONTRACT }), /fresh original owner/);
  assert.equal(CONTRACT.frameParity, false);
  for (const skill of [1, 3]) {
    const g = make({ skill }); advance(g, 60);
    assert.equal(g.u.skill.activate('manual'), false);
  }
});

test('tampered selected stats, skill values, tags and talent records fail before resource installation', () => {
  for (const mutate of [u => { u.def.stats.atk++; }, u => { u.def.skill.spCost++; },
    u => { u.def.skill.bb.ammo_cost++; }, u => { u.def.tags = []; },
    u => { u.def.talents.at(-1).bb.shield = 1; }, u => { u.def.raw.arkpedia.skillId = 'skchr_rmixer_1'; }])
    assert.throws(() => make({ beforeInstall: (_b, u) => mutate(u) }), /Incomplete/);
});

test('source selection preserves promotion, trust, potentials and every unlocked rank', () => {
  for (let elite = 0; elite <= 2; elite++) for (let skill = 1; skill <= elite + 1; skill++)
    for (let rank = 1; rank <= [4, 7, 10][elite]; rank++) for (const potential of [1, 5, 6]) {
      const f = make({ skill, elite, rank, potential });
      assert.equal(f.record.source, e.tables.skills[`skchr_rmixer_${skill}`].levels[rank - 1]);
      assert.equal(f.record.stats.blockCnt, 3); assert.deepEqual(f.b.errors, []);
      assert.equal(!!f.resources.t2, elite === 2);
      if (elite === 2) near(f.resources.t2.shield, potential >= 5 ? .18 : .15);
    }
  const f = make({ trust: 200, potential: 6 });
  assert.equal(f.u.s.maxHp, 3677); assert.equal(f.u.s.atk, 504 + 60);
  assert.equal(f.u.s.def, 703 + 60); assert.equal(f.u.base.cost, 22); assert.equal(f.u.base.respawnTime, 70);
  for (const bad of [{ level: 0 }, { potential: 7 }, { elite: -1 }, { skillRank: 11 },
    { trust: 201 }, { module: 'HAM-X' }, { skillId: 'skchr_unknown_1' }])
    assert.throws(() => selectedRmixerBuild({ ...f.build, ...bad }));
  assert.throws(() => selectedRmixerBuild({ ...f.build, elite: 0, level: 50, skillRank: 4 }));
});

test('S2 every selected rank consumes source ammo and rejects the whole fatal HP set', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ rank }); cast(f);
    const max = f.u.skill.ammoLeft, hp = f.u.hp;
    hit(f, hp * 100);
    near(f.u.hp, hp); assert.equal(f.u.alive, true);
    assert.equal(f.u.skill.ammoLeft, max - f.record.bb.ammo_cost);
    assert.equal(f.hits.at(-1).hpLoss, 0); assert.equal(f.u.stats.taken, 0);
    assert.equal(f.u.skill.active, true);
  }
});

test('S2 fewer than twenty rounds still rejects fatal damage and ends on empty ammo', () => {
  for (const count of [1, 3, 19, 20]) {
    const f = make(); cast(f); const hp = f.u.hp;
    f.u.skill.ammoLeft = count;
    hit(f, hp * 100);
    near(f.u.hp, hp); assert.equal(f.u.skill.active, false); assert.equal(f.u.skill.ammoLeft, 0);
    assert.equal(f.u.alive, true);
    hit(f, hp * 100); assert.equal(f.u.alive, false);
    assert.equal(f.resources.stopped, true);
  }
});

test('nonfatal damage, mitigation, invulnerability, existing shields and undeadable do not spend survival ammo', () => {
  const f = make({ elite: 1 }); cast(f); const ammo = f.u.skill.ammoLeft;
  f.u.hp = 1000; hit(f, 100);
  near(f.u.hp, 900); assert.equal(f.u.skill.ammoLeft, ammo);
  hit(f, 1, 'phys'); assert.equal(f.u.skill.ammoLeft, ammo);
  f.b.addBuff(f.u, { key: 'fixture:shield', shield: 10000 });
  hit(f, 1000); assert.equal(f.u.skill.ammoLeft, ammo);
  f.b.removeBuff(f.u, 'fixture:shield');
  f.b.addBuff(f.u, { key: 'fixture:invulnerable', flags: { invulnerable: true } });
  hit(f, 1e6); assert.equal(f.u.skill.ammoLeft, ammo);
  f.b.removeBuff(f.u, 'fixture:invulnerable');
  f.b.addBuff(f.u, { key: 'fixture:undeadable', flags: { undeadable: true } });
  hit(f, 1e6); near(f.u.hp, 1); assert.equal(f.u.skill.ammoLeft, ammo);
});

test('earlier accepted before-zero guard prevents duplicate expenditure', () => {
  const f = make({ beforeInstall: b => b.on('beforeHpZero', ctx => { ctx.blocked = true; }) });
  cast(f); const ammo = f.u.skill.ammoLeft, hp = f.u.hp;
  hit(f, 1e6); near(f.u.hp, hp); assert.equal(f.u.skill.ammoLeft, ammo);
});

test('before-zero callbacks observe existing HP and cannot undo scripted removal', () => {
  let observed;
  const f = make({ beforeInstall: (b, u) => b.on('beforeHpZero', ctx => { if (ctx.unit === u) observed = u.hp; }) });
  cast(f); const hp = f.u.hp;
  hit(f, 1e7); near(observed, hp); near(f.u.hp, hp);
  const g = make(); cast(g);
  g.b.on('rmixerFatalGuard', () => g.b.kill(g.u, null));
  hit(g, 1e7); assert.equal(g.u.alive, false); assert.equal(g.u.hp, 0);
  assert.equal(g.resources.stopped, true); assert.deepEqual(g.b.errors, []);
});

test('fatal Physical, Arts, True and HP loss pass the same original before-zero guard; scripted kill bypasses it', () => {
  for (const type of ['phys', 'arts', 'true']) {
    const f = make(); cast(f); const hp = f.u.hp, ammo = f.u.skill.ammoLeft;
    hit(f, 1e7, type); near(f.u.hp, hp); assert.equal(f.u.skill.ammoLeft, ammo - 20);
  }
  const f = make(); cast(f); const hp = f.u.hp;
  f.b.loseHp(f.u, 1e7); near(f.u.hp, hp); assert.equal(f.u.skill.ammoLeft, 30);
  f.b.kill(f.u, null); assert.equal(f.u.alive, false); assert.equal(f.resources.stopped, true);
});

test('S2 manual cancellation, inactive S2 and other selected skills cannot intercept fatal damage', () => {
  for (const skill of [1, 2, 3]) {
    const f = make({ skill });
    if (skill === 2) { cast(f); f.u.skill.end('manual'); }
    hit(f, 1e7); assert.equal(f.u.alive, false);
  }
});

test('barrier waits from deployment and samples current Max HP at trigger, with potential-specific ratios', () => {
  for (const potential of [1, 5, 6]) {
    const f = make({ skill: 1, potential, defer: true });
    advance(f, 9); assert.equal(f.resources.barrier, null);
    f.deploy(); advance(f, 7.9); assert.equal(f.resources.barrier, null);
    f.b.addBuff(f.u, { key: 'fixture:maxhp', mods: { hpPct: 1 } });
    until(f, () => f.resources.barrier); near(f.resources.barrier.shield, f.u.s.maxHp * (potential >= 5 ? .18 : .15));
    f.b.removeBuff(f.u, 'fixture:maxhp');
    near(f.resources.barrier.shield, f.u.s.maxHp * 2 * (potential >= 5 ? .18 : .15));
  }
  const f = make({ skill: 1, elite: 1 }); advance(f, 20); assert.equal(f.resources.barrier, null);
});

test('ordinary completed attacks reset unfinished barrier wait, while S3Attack does not', () => {
  const f = make({ skill: 1 }); advance(f, 7);
  assert.equal(f.resources.completeAttack('Attack', 'cast:1'), true);
  advance(f, 7); assert.equal(f.resources.barrier, null);
  assert.equal(f.resources.completeAttack('Attack', 'cast:1'), false);
  f.resources.completeAttack('S3Attack', 'cast:2');
  advance(f, 1); until(f, () => f.resources.barrier);
  const value = f.resources.barrier.shield;
  f.resources.completeAttack('Attack', 'cast:3'); advance(f, 10);
  near(f.resources.barrier.shield, value); assert.equal(f.resources.waitAt, null);
});

test('zero-interval counterattack alias restarts barrier wait exactly as the native alias filter requires', () => {
  const f = make({ skill: 1 }); advance(f, 7);
  f.resources.completeAttack('S3Attack_Zero', 'zero:1'); advance(f, 1);
  assert.equal(f.resources.barrier, null); advance(f, 7); until(f, () => f.resources.barrier);
});

test('barrier absorbs each damage type, retains partial value and replenishes eight seconds after depletion', () => {
  for (const type of ['phys', 'arts', 'true']) {
    const f = make({ skill: 1 }); advance(f, 8); until(f, () => f.resources.barrier);
    const hp = f.u.hp, capacity = f.resources.barrier.shield;
    hit(f, 100, type); near(f.u.hp, hp); assert.ok(f.resources.barrier.shield < capacity);
    hit(f, capacity + f.u.s.def + 10, type);
    assert.equal(f.resources.barrier, null); assert.ok(f.u.hp < hp);
    advance(f, 4); hit(f, 1, type); advance(f, 3.9); assert.equal(f.resources.barrier, null);
    until(f, () => f.resources.barrier); near(f.resources.barrier.shield, capacity);
  }
});

test('withdrawal and battle finish retire resource callbacks without adding stale barriers', () => {
  const f = make({ skill: 1 }); advance(f, 7); f.b.retreat(f.u);
  assert.equal(f.resources.stopped, true); advance(f, 10); assert.equal(f.resources.barrier, null);
  assert.equal(f.resources.completeAttack('Attack', 'retired'), false);
  const g = make({ skill: 1 }); advance(g, 8); until(g, () => g.resources.barrier); g.b.emit('battleEnd', {});
  assert.equal(g.resources.stopped, true); assert.equal(g.resources.barrier, null);
  assert.equal(g.resources.hooks.length, 0);
});

test('a rejected barrier retries after a full interval instead of an unbounded same-tick loop', () => {
  const f = make({ skill: 1 }); let requests = 0;
  f.b.on('beforeBuff', ctx => {
    if (ctx.unit === f.u && ctx.buff.key === 'rmixer:idle-barrier' && ++requests === 1) ctx.cancel = true;
  });
  advance(f, 8.1); assert.equal(requests, 1); assert.equal(f.resources.barrier, null);
  advance(f, 7.8); assert.equal(requests, 1);
  until(f, () => f.resources.barrier, .4); assert.equal(requests, 2);
});

test('retirement during barrier attachment cannot leave a new shield or callback behind', () => {
  const f = make({ skill: 1 });
  f.b.on('beforeBuff', ctx => {
    if (ctx.unit === f.u && ctx.buff.key === 'rmixer:idle-barrier') f.resources.stop();
  });
  advance(f, 8.1); assert.equal(f.resources.stopped, true);
  assert.equal(f.resources.barrier, null); assert.equal(f.u.findBuff('rmixer:idle-barrier'), null);
  assert.equal(f.resources.hooks.length, 0);
});
