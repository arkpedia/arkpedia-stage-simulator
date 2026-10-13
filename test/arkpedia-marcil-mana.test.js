// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-marcil-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { selectedMarcilBuild, MARCIL_ID as ID } from '../server/sim/content/arkpedia-marcil-source.js';
import { prepareMarcilMana, MARCIL_MANA_CONTRACT as CONTRACT }
  from '../server/sim/content/arkpedia-marcil-mana.js';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function advance(f, seconds) {
  for (let i = 0; i < Math.ceil(seconds / f.b.dt - 1e-9); i++) f.b.step();
  assert.deepEqual(f.b.errors, []);
}
// A source-only actor in an empty, controlled stage, not a public roster claim.
function make({ skill = 1, rank = 10, elite = 2, potential = 1, deferred = false } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = [];
  d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const senshi = { ...defaultBuild(d.operators.char_4143_sensi), elite: 2, level: 80,
    skillId: 'skchr_sensi_2', skillRank: 10, trust: 0, potential: 1 };
  const b = new StandardBattle(d, { operators: [senshi, defaultBuild(d.operators.char_208_melan)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  b.addDp('arkpedia', 99);
  const build = { elite, level: 1, skillId: `skchr_marcil_${skill}`,
    skillRank: Math.min(rank, [4, 7, 10][elite]), potential, trust: 0, module: 'none' };
  const r = selectedMarcilBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    talents: r.talents, tags: r.tags, arkpedia: build,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId, rangeGrid: r.skillRange } });
  const create = ({ contract = CONTRACT, mutate, deploy = true } = {}) => {
    const selectedDef = structuredClone(def); mutate?.(selectedDef);
    const u = b._makeAlly(b.getPlayer('arkpedia'), selectedDef, 'op', 5, 6, { dir: 'RIGHT' });
    const prepared = prepareMarcilMana(b, u, { contract });
    b._setupUnit(u, prepared.kit); prepared.controller.install();
    if (deploy) assert.ok(b._deploy(u, { initial: false }));
    return { u, ...prepared };
  };
  const f = { b, build, def, create, ...create({ deploy: !deferred }) };
  return f;
}

for (let skill = 1; skill <= 3; skill++) test(`S${skill} selected starting mana persists without on-field recovery`, () => {
  const f = make({ skill }), initial = f.record.mana.initial;
  assert.equal(f.wallet.value, initial); assert.equal(f.u.skill.spTotal, initial);
  advance(f, 10); assert.equal(f.wallet.value, initial);
  assert.equal(f.u.skill.gainSp(10, 'time'), 0);
  assert.equal(f.u.skill.gainSp(1, 'attack'), 0);
  assert.equal(f.u.skill.gainSp(1, 'hurt'), 0);
  assert.equal(f.wallet.value, initial);
  assert.equal(f.u.skill.activate('manual'), false);
});

test('off-field ticks recover before first deployment and cap at the selected 80, not placeholder 100', () => {
  const f = make({ deferred: true });
  advance(f, .95); assert.equal(f.wallet.value, 50);
  advance(f, .1); assert.equal(f.wallet.value, 51);
  advance(f, 50); assert.equal(f.wallet.value, 80);
  assert.ok(f.b._deploy(f.u, { initial: false }));
  assert.equal(f.u.skill.spTotal, 80); assert.equal(f.u.skill.charges, 1);
  advance(f, 2); assert.equal(f.wallet.value, 80);
});

test('spending mana is atomic; threshold one controls the source ATK talent', () => {
  for (const elite of [0, 1, 2]) for (const potential of [1, 3]) {
    const f = make({ elite, potential }), base = f.u.base.atk, initial = f.wallet.value;
    near(f.u.s.atk, base * (1 + f.record.talentBb[0].atk));
    assert.equal(f.wallet.consume(initial + 1), false); assert.equal(f.wallet.value, initial);
    assert.equal(f.wallet.consume(initial - .5), true); near(f.wallet.value, .5);
    near(f.u.s.atk, base);
    assert.equal(f.u.skill.gainSp(.5, 'gift'), .5); near(f.u.s.atk, base * (1 + f.record.talentBb[0].atk));
    assert.equal(f.wallet.consume(1), true); assert.equal(f.wallet.value, 0); near(f.u.s.atk, base);
    for (const n of [0, -1, Infinity, NaN]) assert.throws(() => f.wallet.consume(n));
  }
});

test('ordinary grants, cap clipping, noSp and active-skill locks use the same wallet', () => {
  const f = make();
  assert.equal(f.u.skill.gainSp(99, 'gift'), 30);
  assert.equal(f.wallet.value, 80); assert.equal(f.u.skill.spTotal, 80);
  assert.equal(f.wallet.consume(7), true); assert.equal(f.u.skill.charges, 0);
  assert.equal(f.u.skill.spTotal, 73);
  f.b.addBuff(f.u, { key: 'fixture:block-sp', flags: { noSp: true } });
  assert.equal(f.u.skill.gainSp(10, 'senshi:mana'), 0); assert.equal(f.wallet.value, 73);
  f.b.removeBuff(f.u, 'fixture:block-sp');
  f.u.skill.active = true;
  assert.equal(f.u.skill.gainSp(10, 'senshi:mana'), 0); assert.equal(f.wallet.value, 73);
  f.u.skill.active = false;
  assert.equal(f.u.skill.gainSp(10, 'senshi:mana'), 7); assert.equal(f.wallet.value, 80);
  for (const n of [Infinity, NaN, -1, 0]) assert.equal(f.u.skill.gainSp(n, 'gift'), 0);
});

test('real Senshi S2 final meal restores Marcille mana at full HP, with both native resource locks', () => {
  for (const lock of ['none', 'noSp', 'active']) {
    const f = make(), senshi = f.b.deployOperator('char_4143_sensi', 5, 5, 'RIGHT');
    senshi.atkCd = 1000; senshi.skill.rule = 'NEVER';
    if (lock === 'noSp') f.b.addBuff(f.u, { key: 'fixture:noSp', flags: { noSp: true } });
    if (lock === 'active') f.u.skill.active = true;
    const before = f.wallet.value;
    senshi.skill.setSpTotal(senshi.skill.spCost); assert.equal(senshi.skill.activate('fixture'), true);
    advance(f, 9.2); assert.equal(f.wallet.value, before);
    advance(f, .15); assert.equal(f.wallet.value, before + (lock === 'none' ? 10 : 0));
    assert.equal(f.u.hp, f.u.s.maxHp);
  }
});

test('retreat preserves spent mana; a fresh selected actor binds the same recovered wallet', () => {
  const f = make(); f.wallet.consume(12); const oldSkill = f.u.skill, oldGain = oldSkill.gainSp;
  f.b.retreat(f.u, { permanent: true });
  assert.equal(f.controller.stopped, true); assert.equal(f.wallet.owner, null);
  assert.equal(f.wallet.value, 38); assert.equal(f.u.findBuff('marcil:mana-atk'), null);
  const value = f.wallet.value; oldSkill.gainSp(99, 'gift'); assert.equal(f.wallet.value, value);
  advance(f, 5.05); assert.equal(f.wallet.value, 43);
  const next = f.create(); assert.equal(next.wallet, f.wallet);
  assert.equal(next.u.skill.spTotal, 43); assert.notEqual(next.u, f.u);
  assert.equal(f.wallet.owner, next.u);
  assert.equal(oldGain(10, 'gift'), 0); assert.equal(f.controller.consume(1), false);
  assert.equal(f.controller.markExtraChant(true), false);
  advance(f, 5.05); assert.equal(f.wallet.value, 43);
});

test('ordinary death preserves mana, extended S3 death clears it, and retreat during that diagnostic phase preserves it', () => {
  for (const mode of ['normal-death', 'extended-death', 'extended-retreat']) {
    const f = make({ skill: 3 }); f.wallet.consume(10);
    if (mode.startsWith('extended')) assert.equal(f.wallet.markExtraChant(true), true);
    if (mode.endsWith('retreat')) f.b.retreat(f.u, { permanent: true }); else f.b.kill(f.u);
    assert.equal(f.wallet.value, mode === 'extended-death' ? 0 : 55);
    advance(f, 1.05); assert.equal(f.wallet.value, mode === 'extended-death' ? 1 : 56);
    const next = f.create(); assert.equal(next.u.skill.spTotal, f.wallet.value);
    assert.equal(f.wallet.extraChant, false);
  }
});

test('mutated or missing source/build contracts cannot bind the resource adapter', () => {
  const f = make(); f.b.retreat(f.u, { permanent: true });
  assert.throws(() => f.create({ contract: { ...CONTRACT } }));
  for (const mutate of [d => d.stats.atk++, d => d.skill.bb.sp_cost++, d => d.tags.pop(),
    d => d.skill.initSp++, d => d.skill.spCost++, d => d.talents[0].bb.atk++,
    d => d.raw.arkpedia.level++, d => d.raw.arkpedia.module = 'unsupported'])
    assert.throws(() => f.create({ mutate }));
  assert.equal(f.wallet.owner, null);
});

test('a live or merely reserved owner cannot share the same battle wallet with a second actor', () => {
  for (const deferred of [false, true]) { const f = make({ deferred }); assert.throws(() => f.create()); }
});

test('SP hooks may modify a grant; retirement inside a hook cannot credit a ghost owner', () => {
  const f = make(); const hook = f.b.on('spGain', x => { if (x.unit === f.u) x.amount = 3; });
  assert.equal(f.u.skill.gainSp(10, 'gift'), 3); assert.equal(f.wallet.value, 53);
  f.b.off(hook); f.b.on('spGain', x => { if (x.unit === f.u) f.b.retreat(f.u, { permanent: true }); });
  assert.equal(f.u.skill.gainSp(10, 'gift'), 0); assert.equal(f.wallet.value, 53);
  advance(f, 1.05); assert.equal(f.wallet.value, 54);
});

test('battle end cleans timers, hooks, owner power and adapter replacements', () => {
  const f = make(); const bound = f.u.skill.gainSp, boundSet = f.u.skill.setSpTotal, value = f.wallet.value;
  f.b._finish('victory');
  assert.equal(f.wallet.closed, true); assert.equal(f.controller.stopped, true);
  assert.equal(f.wallet.period.cancelled, true); assert.equal(f.wallet.owner, null);
  assert.equal(f.wallet.handles.length, 0); assert.equal(f.controller.handles.length, 0);
  assert.notEqual(f.u.skill.gainSp, bound); assert.equal(f.u.findBuff('marcil:mana-atk'), null);
  assert.notEqual(f.u.skill.setSpTotal, boundSet);
  assert.equal(f.wallet.consume(1), false); assert.equal(f.wallet.gain(10, 'gift'), 0);
  advance(f, 5); assert.equal(f.wallet.value, value);
});

test('resource HUD displays mana while this diagnostic deliberately exposes no skill activation', () => {
  const f = make(), hud = skillHud(f.u.skill);
  assert.equal(hud.text, '50 / 80 Mana'); assert.equal(hud.fraction, .625);
  assert.equal(hud.canActivate, false); assert.equal(hud.canCancel, false);
  assert.equal(hud.ready, false); assert.equal(f.u.profile.noAttack, true);
  assert.equal(data.operators[ID], undefined);
});

test('separate battles never share starting, spent or recovered mana', () => {
  const a = make(), b = make(); assert.notEqual(a.wallet, b.wallet);
  a.wallet.consume(20); assert.equal(a.wallet.value, 30); assert.equal(b.wallet.value, 50);
  a.b.retreat(a.u, { permanent: true }); advance(a, 2.05);
  assert.equal(a.wallet.value, 32); assert.equal(b.wallet.value, 50);
});

test('off-field recovery ignores a removed actor’s noSp flag and does not inherit it on redeploy', () => {
  const f = make(); f.b.addBuff(f.u, { key: 'fixture:noSp', flags: { noSp: true } });
  f.wallet.consume(10); f.b.retreat(f.u, { permanent: true }); advance(f, 2.05);
  assert.equal(f.wallet.value, 42);
  const next = f.create(); assert.equal(!!next.u.s.flags.noSp, false);
  assert.equal(next.u.skill.gainSp(1, 'gift'), 1); assert.equal(f.wallet.value, 43);
});

test('retirement during a newly applied power buff leaves no ghost modifier', () => {
  const f = make(); f.wallet.consume(50);
  f.b.on('beforeBuff', ctx => {
    if (ctx.unit === f.u && ctx.buff?.key === 'marcil:mana-atk') f.b.retreat(f.u, { permanent: true });
  });
  f.u.skill.gainSp(10, 'gift');
  assert.equal(f.u.alive, false); assert.equal(f.wallet.owner, null);
  assert.equal(f.u.findBuff('marcil:mana-atk'), null);
});

test('diagnostic extended chant requires S3 and a valid owner', () => {
  const a = make(); assert.throws(() => a.wallet.markExtraChant(true));
  const b = make({ skill: 3 }); assert.throws(() => b.wallet.markExtraChant('true'));
  assert.equal(b.wallet.markExtraChant(true), true); assert.equal(b.wallet.markExtraChant(false), true);
  b.b.retreat(b.u, { permanent: true }); assert.equal(b.wallet.markExtraChant(true), false);
});

test('direct inactive SP assignments update mana; retired setters cannot alter a new owner', () => {
  const f = make(), oldSet = f.u.skill.setSpTotal;
  f.u.skill.setSpTotal(0); assert.equal(f.wallet.value, 0);
  assert.equal(f.u.findBuff('marcil:mana-atk'), null);
  f.b.addBuff(f.u, { key: 'fixture:noSp', flags: { noSp: true } });
  f.u.skill.setSpTotal(99); assert.equal(f.wallet.value, 80);
  f.u.skill.setSpTotal(-1); assert.equal(f.wallet.value, 0);
  f.u.skill.setSpTotal(33); assert.equal(f.wallet.value, 33);
  f.u.skill.active = true; f.u.skill.setSpTotal(12); assert.equal(f.wallet.value, 33);
  f.u.skill.active = false;
  for (const n of [NaN, Infinity]) f.u.skill.setSpTotal(n);
  assert.equal(f.wallet.value, 33);
  f.b.retreat(f.u, { permanent: true }); f.u.skill.setSpTotal(1);
  assert.equal(f.wallet.value, 33);
  const next = f.create(); oldSet(1); assert.equal(next.wallet.value, 33);
});
