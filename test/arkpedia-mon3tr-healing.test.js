// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../data/arkpedia-mon3tr-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { MON3TR_ID as ID, selectedMon3trBuild } from '../server/sim/content/arkpedia-mon3tr-source.js';
import { prepareMon3trHealing, MON3TR_HEALING_CONTRACT as CONTRACT } from '../server/sim/content/arkpedia-mon3tr-healing.js';
const TOKEN = 'token_10050_monstr_prosts';
const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
function advance(b, seconds) {
  for (let n = 0; n < Math.ceil(seconds / b.dt - 1e-9); n++) b.step();
  assert.deepEqual(b.errors, []);
}
function until(f, condition, seconds = 20) {
  const end = f.b.time + seconds;
  while (!condition() && f.b.time < end) advance(f.b, f.b.dt);
  assert.ok(condition(), `Condition missing at ${f.b.time}`);
}
function make({ skill = 1, elite = 2, rank = [4, 7, 10][elite], potential = 1, trust = 0,
  dir = 'RIGHT', defer = false, contract = CONTRACT, mutate } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level: e.tables.character.phases[elite].maxLevel, potential, trust,
    skillRank: rank, skillId: `skchr_monstr_${skill}`, module: 'none' };
  const r = selectedMon3trBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    tags: r.tags, talents: r.talents, skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.skillRangeGrid, trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, { dir });
  const prepared = prepareMon3trHealing(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  const heals = [], attacks = [];
  b.on('calculatedHeal', ctx => { if (ctx.source === u) heals.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, d, build, deploy, heals, attacks, ...prepared };
}
function ally(f, { row = 5, col = 6, hp = 10000, ratio = .1, token = false, flags } = {}) {
  const t = f.b.spawnToken(f.u, token ? TOKEN : 'diagnostic:healing-recipient', row, col, {
    def: { name: token ? 'Reconstruction' : 'Diagnostic recipient', profession: 'TOKEN', position: 'MELEE',
      stats: { maxHp: hp, atk: 0, def: 0, blockCnt: 0, cost: 0 }, skill: null },
    kit: { trait: { noAttack: true, noBlock: true }, talents: [], skill: { kind: 'passive' } },
  });
  assert.ok(t); t.hp = hp * ratio;
  if (flags) f.b.addBuff(t, { key: 'fixture:flags', flags });
  if (token) f.controller.attachReconstruction(t);
  return t;
}
const disarm = f => f.b.addBuff(f.u, { key: 'fixture:disarm', flags: { disarm: true } });

test('healing diagnostics require exact source and contract and do not enable S2/S3 or public selection', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /healing contract/);
  assert.throws(() => make({ mutate: def => { def.stats.atk++; } }), /selected source/);
  assert.equal(data.operators[ID], undefined);
  for (const skill of [2, 3]) {
    const f = make({ skill }); ally(f); f.u.skill.setSpTotal(99);
    assert.equal(f.u.skill.activate(), false); assert.equal(f.u.skill.active, false);
  }
});
for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank} heals four counted recipients with source scaling, decay and one attack account`, () => {
  const f = make({ rank });
  const recipients = [6, 7, 8, 9, 10].map((col, i) => ally(f, { col, ratio: .05 + i * .1 }));
  f.u.skill.setSpTotal(f.u.skill.spCost);
  until(f, () => f.heals.length >= 4);
  assert.deepEqual(f.heals.map(h => h.target), recipients.slice(0, 4));
  f.heals.forEach((h, i) => near(h.amount, f.record.stats.atk * f.record.bb.heal_scale * .75 ** i));
  assert.equal(f.attacks.length, 1); assert.equal(f.u.skill.activations, 1);
  assert.equal(f.u.skill.sp, 0); assert.equal(f.u.skill.active, false);
});
test('ordinary chain release waits for the native event and flying speed; S1 charges only ordinary attack accounts', () => {
  const f = make({ rank: 1 }), t = ally(f, { hp: 1e6 });
  advance(f.b, 1); assert.equal(f.heals.length, 0); assert.equal(f.attacks.length, 0);
  until(f, () => f.attacks.length === 1);
  const release = f.b.time; assert.ok(release >= 1 + .5666666626930237 - f.b.dt);
  assert.equal(f.heals.length, 0); assert.equal(f.u.skill.sp, 1);
  until(f, () => f.heals.length === 1);
  assert.ok(f.heals[0].time > release); near(f.heals[0].amount, f.record.stats.atk);
  until(f, () => f.u.skill.activations === 1 && !f.u.skill.active, 30);
  assert.equal(f.attacks.length, f.u.skill.spCost + 1); assert.equal(f.u.skill.sp, 0);
  assert.ok(t.alive);
});
test('Reconstruction adds a free recipient and no extra decay, and cannot be visited twice in one chain', () => {
  const f = make({ skill: 2 });
  const a = ally(f, { col: 6, ratio: .05 }), token = ally(f, { col: 7, token: true, ratio: .1 });
  const c = ally(f, { col: 8, ratio: .2 }), d = ally(f, { col: 9, ratio: .3 });
  until(f, () => f.heals.length === 4);
  assert.deepEqual(f.heals.map(h => h.target), [a, token, c, d]);
  for (const [i, scale] of [1, .75, .75, .75 ** 2].entries()) near(f.heals[i].amount, f.record.stats.atk * scale);
  assert.equal(f.attacks.length, 1); assert.equal(f.u.skill.sp, f.record.source.spData.initSp + 1);
});
test('foreign ordinary healers cannot heal attached Reconstruction; Mon3tr and self healing remain accepted', () => {
  const f = make(), t = ally(f, { token: true }), other = ally(f, { row: 6 });
  const hp = t.hp;
  assert.equal(f.b.heal(other, t, 100, { ignoreHealFree: true }), 0); near(t.hp, hp);
  near(f.b.heal(f.u, t, 100, { ignoreHealFree: true }), 100);
  near(f.b.heal(t, t, 100), 100);
  assert.throws(() => f.controller.attachReconstruction(t), /fresh owned/);
  assert.throws(() => f.controller.attachReconstruction(other), /fresh owned/);
});
test('isolation, no-heal, untargetable and device recipients are excluded while source ignore-heal-free remains honored', () => {
  const f = make({ skill: 2 });
  for (const [i, flags] of [{ isolated: true }, { noHeal: true }, { untargetable: true }].entries())
    ally(f, { row: 4 + i, col: 6, ratio: .001, flags });
  const t = ally(f, { row: 5, col: 7, flags: { healFree: true } });
  const device = f.b.spawnDevice('fixture:device', 5, 8, { hp: 1e4 }); device.hp = 1;
  until(f, () => f.heals.length === 1);
  assert.equal(f.heals[0].target, t); near(device.hp, 1);
});
test('healing selects the lowest ratio, reaches outside owner range by bounce and does not revisit a full or seen recipient', () => {
  const f = make({ skill: 2 });
  const a = ally(f, { col: 6, ratio: .05 }), c = ally(f, { col: 7, ratio: .1 });
  const d = ally(f, { col: 8, ratio: .15 }), full = ally(f, { row: 4, col: 7, ratio: 1 });
  until(f, () => f.heals.length === 3);
  assert.deepEqual(f.heals.map(h => h.target), [a, c, d]); near(full.hpRatio, 1);
});
test('an unfired heal is interrupted by control and a dead primary does not receive a heal or a stale chain', () => {
  const f = make({ skill: 2 }), t = ally(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  disarm(f); advance(f.b, .8);
  assert.equal(f.heals.length, 0); assert.equal(f.attacks.length, 0);
  f.b.removeBuff(f.u, 'fixture:disarm'); until(f, () => f.attacks.length === 1);
  f.b._remove(t, 'fixture:remove', null, true); advance(f.b, .5);
  assert.equal(f.heals.length, 0); assert.equal(f.b.projectiles.list.length, 0);
});
test('an already fired heal survives owner retirement but does not revive it or grant it a new ASPD buff', () => {
  const f = make({ skill: 2 }), t = ally(f);
  until(f, () => f.attacks.length === 1); const amount = f.record.stats.atk;
  f.b._remove(f.u, 'fixture:remove', null, true);
  until(f, () => f.heals.length === 1);
  near(f.heals[0].amount, amount); assert.ok(t.hp > 1000);
  assert.equal(f.u.alive, false); assert.equal(f.u.findBuff(`mon3tr:${f.u.id}:coordination`), null);
  assert.equal(f.controller.stopped, true);
});
for (const elite of [0, 1, 2]) test(`E${elite} base talent grants the selected ASPD for ten seconds without equal-priority refresh`, () => {
  const f = make({ elite, potential: 6 }), t = ally(f, { hp: 1e6 });
  until(f, () => f.heals.length === 1); disarm(f);
  const talent = f.record.talentBb[1], key = `mon3tr:${f.u.id}:coordination`;
  if (elite === 0) { assert.equal(t.findBuff(key), null); return; }
  near(f.u.s.aspd, 100 + talent.attack_speed); near(t.s.aspd, 100 + talent.attack_speed);
  const buff = t.findBuff(key); advance(f.b, 2); const left = buff.timeLeft;
  f.controller.chain(t); until(f, () => f.heals.length === 2);
  assert.equal(t.findBuff(key), buff); assert.ok(buff.timeLeft < left);
  advance(f.b, buff.timeLeft + f.b.dt); near(t.s.aspd, 100); near(f.u.s.aspd, 100);
});
test('a cancelled heal does not grant Tactical Coordination, and a modifier removing its target cannot leave a stale bounce', () => {
  const f = make({ skill: 2 }), a = ally(f), next = ally(f, { col: 7, ratio: .2 });
  f.b.on('heal', ctx => { if (ctx.target === a) { ctx.amount = 0; f.b._remove(a, 'fixture:modifier', null, true); } });
  until(f, () => f.attacks.length === 1); advance(f.b, .3); disarm(f);
  assert.equal(f.heals.length, 0); assert.equal(next.hp, 2000);
  assert.equal(f.u.findBuff(`mon3tr:${f.u.id}:coordination`), null);
});
test('overlapping Tactical Coordination sources use the strongest live bucket and resume a weaker unexpired source', () => {
  const f = make({ skill: 2 }), t = ally(f);
  const otherU = f.b._makeAlly(f.u.player, f.u.def, 'op', 6, 5, { dir: 'RIGHT' });
  const other = prepareMon3trHealing(f.b, otherU, { contract: CONTRACT });
  f.b._setupUnit(otherU, other.kit); other.controller.install();
  assert.ok(f.b._deploy(otherU, { initial: false }));
  disarm(f); f.b.addBuff(otherU, { key: 'fixture:disarm', flags: { disarm: true } });
  f.controller.coordination(t, { attack_speed: 22, buff_duration: 2 });
  other.controller.coordination(t, { attack_speed: 10, buff_duration: 4 });
  near(t.s.aspd, 122); advance(f.b, 2.1); near(t.s.aspd, 110);
  advance(f.b, 2); near(t.s.aspd, 100);
});
test('healing at the cap still carries the accepted modifier and talent without creating HP beyond max', () => {
  const f = make({ skill: 2 }), t = ally(f, { ratio: 1 }); disarm(f);
  f.controller.chain(t); until(f, () => f.heals.length === 1);
  near(t.hpRatio, 1); near(t.s.aspd, 120);
  assert.equal(f.u.stats.heal, 0);
});
test('a short control that expires before the next tick still cancels the unfired source ability', () => {
  const f = make({ skill: 2 }); ally(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  const control = f.b.addBuff(f.u, { key: 'fixture:brief-control', flags: { stun: true } });
  f.b.removeBuff(f.u, control); advance(f.b, .8);
  assert.equal(f.heals.length, 0); assert.equal(f.attacks.length, 0);
});
test('a redeployed projectile recipient is a new life and never inherits a stale in-flight heal', () => {
  const f = make({ skill: 2 }), t = ally(f);
  until(f, () => f.attacks.length === 1);
  t.deploySeq = ++f.b._deploySeq; advance(f.b, .3); disarm(f);
  assert.equal(f.heals.length, 0); near(t.hp, 1000);
});
test('source Front and Back attack events remain literal and animation speed is capped independently of cadence', () => {
  for (const [dir, row, col] of [['RIGHT', 5, 6], ['UP', 4, 5]]) {
    const f = make({ skill: 2, dir }); ally(f, { row, col });
    f.b.addBuff(f.u, { key: 'fixture:aspd', mods: { aspd: 200 } });
    until(f, () => f.controller.phase?.kind === 'attack');
    const p = f.controller.phase;
    near(p.releaseAt - p.startedAt, .5666666626930237);
    assert.equal(f.u.mem.regularFormVisual.speed, 1);
    assert.equal(f.u.mem.regularVisualDirection, dir === 'UP' ? 'UP' : 'RIGHT');
    until(f, () => f.heals.length === 1); assert.ok(f.heals[0].time >= p.releaseAt);
  }
});
test('S1 retains four counted allies plus the free Reconstruction recipient', () => {
  const f = make(), token = ally(f, { col: 6, token: true, ratio: .05 });
  const others = [7, 8, 9, 10].map((col, i) => ally(f, { col, ratio: .1 + i * .1 }));
  f.u.skill.setSpTotal(f.u.skill.spCost); until(f, () => f.heals.length === 5);
  assert.deepEqual(f.heals.map(h => h.target), [token, ...others]);
  f.heals.forEach((h, i) => near(h.amount, f.record.stats.atk * f.record.bb.heal_scale * .75 ** Math.max(0, i - 1)));
  assert.equal(f.attacks.length, 1);
});
test('temporary hiding pauses the healer without permanently retiring its deployment controller', () => {
  const f = make({ skill: 2 }); ally(f);
  until(f, () => f.controller.phase?.kind === 'attack');
  f.u.hidden = true; advance(f.b, 3);
  assert.equal(f.heals.length, 0); assert.equal(f.controller.stopped, false);
  f.u.hidden = false; until(f, () => f.heals.length === 1);
  assert.equal(f.controller.stopped, false);
});
test('Reconstruction rejects foreign healing before unrelated output modifiers can turn it back into positive healing', () => {
  const f = make(), token = ally(f, { token: true }), other = ally(f, { row: 6 });
  let modified = false;
  f.b.on('heal', ctx => { if (ctx.target === token) { modified = true; ctx.amount = 100; } });
  const hp = token.hp;
  near(f.b.heal(other, token, 100, { ignoreHealFree: true }), 0);
  near(token.hp, hp); assert.equal(modified, false);
});
test('a zeroed accepted heal grants no coordination while the chain retains its independent bounce budget', () => {
  const f = make({ skill: 2 }), a = ally(f), next = ally(f, { col: 7, ratio: .2 });
  f.b.on('heal', ctx => { if (ctx.target === a) ctx.amount = 0; });
  until(f, () => f.heals.length === 2); disarm(f);
  near(f.heals[0].amount, 0); near(a.hp, 1000);
  assert.equal(a.findBuff(`mon3tr:${f.u.id}:coordination`), null);
  assert.equal(f.heals[1].target, next); near(f.heals[1].amount, f.record.stats.atk * .75);
});
test('hiding during the shared pre-attack callback rejects release and offensive SP without retiring the controller', () => {
  const f = make({ skill: 2 }); ally(f);
  const sp = f.u.skill.sp;
  f.b.on('beforeAttack', ({ attacker }) => { if (attacker === f.u) f.u.hidden = true; });
  until(f, () => f.u.hidden); advance(f.b, .3);
  assert.equal(f.heals.length, 0); near(f.u.skill.sp, sp); assert.equal(f.controller.stopped, false);
});
test('S1 retains the native non-silenceable controller and does not suppress its selected healing talent', () => {
  const f = make(), t = ally(f);
  f.b.addBuff(f.u, { key: 'fixture:silence', flags: { silence: true } });
  f.u.skill.setSpTotal(f.u.skill.spCost);
  until(f, () => f.heals.length === 1);
  near(f.heals[0].amount, f.record.stats.atk * f.record.bb.heal_scale);
  near(t.s.aspd, 120); assert.equal(f.u.skill.activations, 1);
});
