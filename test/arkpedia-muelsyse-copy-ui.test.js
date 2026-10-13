// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-muelsyse-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { MUELSYSE_ID as ID, selectedMuelsyseBuild } from '../server/sim/content/arkpedia-muelsyse.js';
import { MUELSYSE_FORM_SKILL_CONTRACT, prepareMuelsyseFormSkills } from '../server/sim/content/arkpedia-muelsyse-form-skills.js';
import { FlowingShapeCopyInteraction as Copy, flowingShapeDeck } from '../public/arkpedia/muelsyse-copy.js';

const DONOR = 'char_208_melan', RANGED = 'char_103_angel';
function fixture() {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = [];
  d.stage.battle.initial_dp = 99; d.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(d, { operators: [DONOR, RANGED].map(id => defaultBuild(d.operators[id])) });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  const build = { elite: 2, level: 90, potential: 1, trust: 0, skillRank: 10, skillId: 'skchr_mlyss_1' };
  const r = selectedMuelsyseBuild(build), c = evidence.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    tags: r.tags, talents: r.talents, skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: [], trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 3, 4, { dir: 'RIGHT' });
  const prepared = prepareMuelsyseFormSkills(b, u, { contract: MUELSYSE_FORM_SKILL_CONTRACT });
  b._setupUnit(u, prepared.kit); prepared.controller.install(); assert.ok(b._deploy(u, { initial: false }));
  const deck = prepared.deck, t = deck.place(3, 5), entry = { ...deck.state, unit: t };
  const until = (condition, limit = 110) => {
    const end = b.time + limit; while (!condition() && b.time < end) b.step();
    assert.ok(condition(), `Condition missing at ${b.time}`); assert.deepEqual(b.errors, []);
  };
  const ready = () => until(() => t.skill.ready && t.mem.muelsyseMode === 1);
  return { b, u, t, deck, entry, until, ready };
}

test('copy input opens only a ready original Flowing Shape; extraction receipt stays immutable', () => {
  const f = fixture(); assert.deepEqual(evidence.enabledOperators, []);
  assert.equal(flowingShapeDeck({ ...f.entry, ownerId: DONOR }), null);
  assert.equal(Copy.open({ ...f.entry, ownerId: DONOR }), null);
  assert.equal(Copy.open(f.entry), null); f.ready();
  const copy = Copy.open(f.entry); assert.ok(copy.active); assert.equal(Copy.open(f.entry), null);
  assert.deepEqual(copy.donorIds, [DONOR, RANGED]);
  assert.throws(() => copy.choose(ID), /undeployed operator/);
});

test('all four copy facings preserve donor state and require no DP or deployment slot', () => {
  for (const dir of ['UP', 'RIGHT', 'DOWN', 'LEFT']) for (const id of [DONOR, RANGED]) {
    const f = fixture(); f.ready(); f.b.getPlayer('arkpedia').dp = 0;
    const before = structuredClone(f.b.bench[id]), slots = f.b.deployedSlots();
    const copy = Copy.open(f.entry), pending = copy.choose(id);
    assert.deepEqual(pending, { kind: 'copy', donorId: id, row: 3, col: 5, dir: null });
    const range = copy.rangeGrid; range[0][0] = 999;
    assert.notEqual(copy.rangeGrid[0][0], 999);
    assert.equal(copy.confirm(dir), true); assert.equal(copy.active, false);
    assert.equal(f.t.dir, dir); assert.equal(f.deck.point.copy.donorId, id);
    assert.equal(f.b.dp, 0); assert.equal(f.b.deployedSlots(), slots);
    assert.deepEqual(f.b.bench[id], before); assert.throws(() => copy.confirm(dir), /no longer/);
  }
});

test('invalid facing keeps selection open; a donor deployed after selection cannot be copied', () => {
  const f = fixture(); f.ready(); const copy = Copy.open(f.entry); copy.choose(DONOR);
  assert.throws(() => copy.confirm('SIDEWAYS'), /copy facing/); assert.ok(copy.active);
  f.b.deployOperator(DONOR, 2, 5, 'RIGHT');
  assert.ok(!copy.donorIds.includes(DONOR)); assert.deepEqual(copy.rangeGrid, []);
  assert.throws(() => copy.confirm('RIGHT'), /no longer/);
  copy.choose(RANGED); assert.equal(copy.confirm('LEFT'), true);
});

test('cancel ends only its own source window, including after leaving the viewport', () => {
  for (const viewport of ['fullscreen-workspace', 'preview']) {
    const f = fixture(); f.ready(); const copy = Copy.open(f.entry); copy.choose(DONOR);
    f.b.setViewport(viewport); copy.cancel(); copy.cancel();
    assert.equal(f.t.skill.active, false); assert.equal(f.deck.copying, null);
    assert.equal(f.t.skill.sp, 0); assert.equal(copy.current, false);
  }
});

test('expired input cannot select, confirm or cancel a later copy activation', () => {
  const f = fixture(); f.ready(); const old = Copy.open(f.entry); old.choose(DONOR);
  f.until(() => !f.t.skill.active, 21); assert.equal(old.active, false);
  assert.throws(() => old.choose(RANGED), /undeployed operator/);
  f.until(() => f.t.skill.ready); const fresh = Copy.open(f.entry); fresh.choose(RANGED);
  assert.throws(() => old.confirm('RIGHT'), /no longer/); old.cancel();
  assert.ok(fresh.active); assert.equal(fresh.confirm('DOWN'), true);
});

test('source recovery, owner withdrawal and owner skill interrupt the pending copy', () => {
  for (const interrupt of ['rest', 'withdraw', 'ownerSkill']) {
    const f = fixture(); f.ready(); const copy = Copy.open(f.entry); copy.choose(DONOR);
    if (interrupt === 'rest') f.deck.rest(f.deck.point);
    if (interrupt === 'withdraw') f.b.retreat(f.u, { permanent: true });
    if (interrupt === 'ownerSkill') { f.until(() => f.u.skill.ready); assert.equal(f.u.skill.activate('manual'), true); }
    assert.equal(copy.active, false); assert.throws(() => copy.confirm('UP'), /no longer/);
    copy.cancel(); assert.equal(f.deck.point?.copy?.donorId ?? null, null);
  }
});

test('closing the battle prevents copy confirmation without touching a donor', () => {
  const f = fixture(); f.ready(); const copy = Copy.open(f.entry); copy.choose(DONOR);
  f.b.finished = true; assert.equal(copy.active, false);
  assert.throws(() => copy.confirm('LEFT'), /no longer/); copy.cancel();
  assert.equal(f.b.bench[DONOR].unit, null);
});

test('retirement during the copy-opening callback does not leave an input session', () => {
  const f = fixture(); f.ready();
  f.b.on('skillStart', ({ unit }) => {
    if (unit === f.t) f.b.retreat(f.u, { permanent: true });
  });
  assert.equal(Copy.open(f.entry), null);
  assert.equal(f.t.alive, false); assert.equal(f.b.bench[DONOR].unit, null);
  assert.deepEqual(f.b.errors, []);
});
