// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedMon3trBuild } from '../server/sim/content/arkpedia-mon3tr-source.js';
import { prepareMon3trReconstruction, selectedReconstruction, MON3TR_RECONSTRUCTION_CONTRACT as CONTRACT }
  from '../server/sim/content/arkpedia-mon3tr-reconstruction.js';
import { summonCardId, summonUnitId } from '../shared/arkpedia/summons.js';
import { deployRegularSummon, regularSummonCards, summonPlacementError, selectedRegularSummon, retreatRegularSummon } from '../server/sim/content/arkpedia-summons.js';
import { make as base, addOwner, ally, advance, until, near, disarm } from './helpers/mon3tr-fixture.js';
const ID = 'char_4179_monstr', TOKEN = 'token_10050_monstr_prosts', CARD = summonCardId(ID), AURA = 'mon3tr:reconstruction-attack';
const make = (opts = {}) => base({ prepare: prepareMon3trReconstruction, contract: CONTRACT, ...opts });
const place = (f, row = 5, col = 6) => deployRegularSummon(f.b, CARD, row, col);

test('Reconstruction requires the normal source contract and enters the existing common summon card APIs', () => {
  assert.throws(() => make({ contract: { ...CONTRACT } }), /normal Reconstruction contract/);
  const f = make({ defer: true });
  assert.match(summonPlacementError(f.b, CARD, 5, 6), /Deploy Mon3tr/);
  f.deploy(); assert.equal(f.deck.stock, 1);
  const card = regularSummonCards(f.b).find(c => c.key === CARD);
  assert.equal(card.cost, 3); assert.equal(card.config.chooseFacing, false); assert.equal(card.config.deploymentSlotCost, 0);
  f.b.unitLimit = 1;
  const dp = f.b.dp, token = place(f);
  assert.equal(token.defId, TOKEN); assert.equal(token.deploymentSlotCost, 0); assert.equal(f.b.deployedSlots(), 1);
  near(f.b.dp, dp - 3); assert.equal(f.deck.stock, 0); assert.equal(f.deck.readyAt, Infinity);
  assert.equal(selectedRegularSummon(f.b, summonUnitId(token)).unit, token);
});
for (const elite of [0, 1, 2]) for (const potential of [1, 6])
  test(`E${elite}/P${potential} preserves Reconstruction phase stats, source HP loss and selected host aura`, () => {
    const f = make({ elite, potential, trust: 200 }); disarm(f);
    const r = f.deck.record;
    near(r.stats.maxHp, [3347, 4292, 5433][elite]); near(r.stats.def, [131, 175, 221][elite]);
    near(r.stats.atk, 0); near(r.stats.cost, 3); near(r.stats.respawnTime, 15);
    assert.equal(r.stats.maxDeployCount, 1); assert.equal(r.trait.damage_per_second, 80);
    const atk = f.u.s.atk, token = place(f);
    near(token.s.maxHp, r.stats.maxHp); near(token.s.def, r.stats.def); near(token.s.taunt, -1);
    near(token.hp, r.stats.maxHp - 8); near(f.u.s.atk, atk * (1 + r.aura));
    assert.equal(token.mem.regularFormVisual.clip, 'Start'); assert.equal(token.profile.noAttack, true);
    const sp = f.u.skill.sp;
    f.b.addBuff(token, { key: 'fixture:shield', shield: 99999, flags: { invuln: true }, mods: { def: 99999, res: 100 } });
    advance(f.b, .6); near(token.hp, r.stats.maxHp - 48); near(token.findBuff('fixture:shield').shield, 99999);
    near(f.u.skill.sp, sp); assert.equal(token.stats.attacks, 0);
    advance(f.b, .5); assert.equal(token.mem.regularFormVisual.clip, 'Idle');
    const pose = token.mem.regularFormVisual; advance(f.b, .2); assert.equal(token.mem.regularFormVisual, pose);
  });
test('minimum levels select independent original token keyframes without copying host trust or potential stats', () => {
  for (const elite of [0, 1, 2]) {
    const r = selectedReconstruction(selectedMon3trBuild({ elite, level: 1, potential: 6, trust: 200,
      skillId: 'skchr_monstr_1', skillRank: [4, 7, 10][elite], module: 'none' }));
    near(r.stats.maxHp, [2510, 3347, 4292][elite]); near(r.stats.def, [93, 136, 181][elite]); near(r.stats.atk, 0);
    assert.equal(r.models.Single.durations.Skill_3, 0);
  }
});
test('placement rejects inactive viewport, height, range, occupancy, reservations and insufficient DP without spending stock', () => {
  const f = make();
  f.b.setViewport('inline'); assert.match(f.deck.placementError(5, 6), /fullscreen/); f.b.setViewport('fullscreen-workspace');
  assert.match(f.deck.placementError(5, 15), /attack range/);
  const tile = f.b.grid.tile(5, 6); tile.height = 'HIGH'; assert.match(f.deck.placementError(5, 6), /low-ground/); tile.height = 'LOW';
  const occupied = ally(f); assert.match(f.deck.placementError(5, 6), /occupied/); f.b._remove(occupied, 'fixture:clear', null, true);
  assert.ok(f.b.reserveTile(f.u, 5, 6, 'fixture:reserve')); assert.match(f.deck.placementError(5, 6), /reserved/);
  f.b.releaseTileReservations(f.u);
  f.u.player.dp = 2; assert.match(f.deck.placementError(5, 6), /DP/);
  assert.equal(f.deck.stock, 1); assert.equal(f.deck.point, null);
});
test('normal withdrawal refunds one DP and starts a fifteen-second recharge only after departure', () => {
  const f = make(); disarm(f); f.u.player.dp = 20; const t = place(f);
  advance(f.b, 20); assert.equal(f.deck.readyAt, Infinity); near(f.b.dp, 17);
  retreatRegularSummon(f.b, summonUnitId(t));
  near(f.b.dp, 18); assert.equal(t.alive, false); assert.equal(t.mem.regularDeathVisual.hide, true);
  near(f.deck.readyAt, f.b.time + 15); assert.equal(f.deck.stock, 1); assert.equal(f.deck.own().length, 0);
  assert.match(f.deck.placementError(5, 6), /redeploying/); advance(f.b, 14.9);
  assert.match(f.deck.placementError(5, 6), /redeploying/); advance(f.b, .2);
  const next = place(f); assert.notEqual(next, t); near(f.b.dp, 15); assert.equal(next.alive, true);
});
test('natural defeat returns a card with its own cooldown and gives no voluntary withdrawal refund', () => {
  const f = make(); disarm(f); f.u.player.dp = 20; const t = place(f);
  f.b.loseHp(t, t.hp + 1); near(f.b.dp, 17); assert.equal(f.deck.stock, 1);
  near(f.deck.readyAt, f.b.time + 15); assert.equal(t.mem.regularDeathVisual.clip, 'Die');
  assert.equal(f.u.findBuff(AURA), null); assert.equal(f.controller.reconstructions.has(t), false);
});
test('the HP-loss clock naturally defeats an unhealed Reconstruction and never adds owner attack SP', () => {
  const f = make({ elite: 0 }); disarm(f); const t = place(f), sp = f.u.skill.sp;
  until(f, () => !t.alive, 45); assert.ok(f.b.time >= 41.6 && f.b.time <= 42.0);
  near(f.u.skill.sp, sp); assert.equal(f.deck.stock, 1); near(f.deck.readyAt, t.deathAt + 15);
});
test('the ATK aura follows adjacent selectable recipients, including no-heal units, and is removed on departure', () => {
  const f = make(); disarm(f);
  const immune = ally(f, { row: 4, col: 6, flags: { noHeal: true, healFree: true } });
  const isolated = ally(f, { row: 4, col: 7, flags: { isolated: true } });
  const targetFree = ally(f, { row: 6, col: 6, flags: { untargetable: true } });
  const t = place(f);
  near(immune.findBuff(AURA).mods.atkPct, .15); assert.equal(isolated.findBuff(AURA), null); assert.equal(targetFree.findBuff(AURA), null);
  assert.ok(f.b.relocate(immune, 4, 10)); advance(f.b, f.b.dt); assert.equal(immune.findBuff(AURA), null);
  retreatRegularSummon(f.b, summonUnitId(t)); assert.equal(f.u.findBuff(AURA), null);
});
test('overlapping source auras take the strongest and resume a weaker surviving producer without stacking', () => {
  const f = make(); disarm(f); const a = place(f);
  const other = addOwner(f.b, { ...f.build, potential: 6 }, { row: 6, col: 5, contract: CONTRACT,
    prepare: (b, u, opts) => {
      const p = prepareMon3trReconstruction(b, u, opts); p.deck.state.key += ':second-diagnostic-owner'; return p;
    } });
  assert.ok(f.b._deploy(other.u, { initial: false }));
  f.b.addBuff(other.u, { key: 'fixture:disarm', flags: { disarm: true } });
  const second = other.deck.place(6, 6);
  near(f.u.findBuff(AURA).mods.atkPct, .2);
  f.b.addBuff(f.u, { key: 'fixture:unrelated-atk', mods: { atkPct: .1 } });
  near(f.u.s.atk, f.record.stats.atk * 1.3);
  other.deck.retreat(second); near(f.u.findBuff(AURA).mods.atkPct, .15); near(f.u.s.atk, f.record.stats.atk * 1.25);
  f.deck.retreat(a); assert.equal(f.u.findBuff(AURA), null); near(f.u.s.atk, f.record.stats.atk * 1.1);
});
test('owner retirement removes Reconstruction, its card and aura, with no later card or HP-loss resurrection', () => {
  const f = make(), t = place(f);
  f.b._remove(f.u, 'fixture:owner-retreat', null, true);
  assert.equal(t.alive, false); assert.equal(f.deck.stopped, true); assert.equal(f.b.regularSummons.has(CARD), false);
  assert.equal(f.deck.stock, 0); assert.equal(f.deck.readyAt, Infinity); advance(f.b, 16);
  assert.equal(t.alive, false); assert.equal(f.deck.point, null); assert.equal(f.deck.stock, 0);
});
test('a deploy hook invalidating the owner rolls back DP and never leaves a detached token or card', () => {
  const f = make(); f.u.player.dp = 20;
  f.b.on('deploy', ({ unit }) => { if (unit.defId === TOKEN) f.b._remove(f.u, 'fixture:reentrant-owner', null, true); });
  assert.throws(() => place(f), /deployment failed/); near(f.b.dp, 20);
  assert.equal(f.b.allyUnits.some(a => a.defId === TOKEN && a.alive), false); assert.equal(f.deck.point, null);
  assert.equal(f.b.regularSummons.has(CARD), false);
});
test('a reentrant second placement cannot duplicate a card or spend a second deployment cost', () => {
  const f = make(); f.u.player.dp = 20; let refused = false;
  f.b.on('deploy', ({ unit }) => { if (unit.defId === TOKEN) {
    assert.throws(() => place(f, 4, 6), /already deployed/); refused = true;
  } });
  place(f); assert.equal(refused, true); near(f.b.dp, 17); assert.equal(f.deck.own().length, 1);
});
test('reentrant source removal during aura admission leaves neither the retired aura nor a stale card', () => {
  const f = make();
  f.b.on('beforeBuff', ({ unit, buff }) => { if (unit === f.u && buff.key === AURA) f.b._remove(f.u, 'fixture:aura-owner-exit', null, true); });
  place(f); assert.equal(f.u.alive, false); assert.equal(f.u.findBuff(AURA), null); assert.equal(f.deck.point, null);
  assert.equal(f.b.regularSummons.has(CARD), false); assert.deepEqual(f.b.errors, []);
});
test('selected S2 naturally charges from healing the real declining token, then emits the extra chain through the common card', () => {
  const f = make({ skill: 2 }), t = place(f);
  until(f, () => f.u.skill.ready, 15); assert.ok(f.u.skill.activate('manual'));
  until(f, () => f.heals.some(h => h.opts.mon3trTag === 's2-extra'));
  assert.equal(f.u.skill.sp, 0); assert.equal(t.stats.attacks, 0); assert.equal(f.skills.active(), true);
  near(f.u.s.aspd, 156); assert.equal(f.deck.own().length, 1); assert.deepEqual(f.b.errors, []);
});
