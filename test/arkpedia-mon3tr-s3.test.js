// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMon3trReconstruction, MON3TR_RECONSTRUCTION_CONTRACT as CONTRACT }
  from '../server/sim/content/arkpedia-mon3tr-reconstruction.js';
import { prepareMon3trS3, MON3TR_S3_CONTRACT } from '../server/sim/content/arkpedia-mon3tr-s3.js';
import { deployRegularSummon, selectedRegularSummon } from '../server/sim/content/arkpedia-summons.js';
import { summonCardId, summonUnitId } from '../shared/arkpedia/summons.js';
import { make as base, ally, advance, until, near } from './helpers/mon3tr-fixture.js';
const ID = 'char_4179_monstr', CARD = summonCardId(ID);
const make = (opts = {}) => base({ skill: 3, prepare: prepareMon3trReconstruction, contract: CONTRACT, ...opts });
function charge(f, { row = 5, col = 6 } = {}) {
  const point = deployRegularSummon(f.b, CARD, row, col);
  until(f, () => f.u.skill.ready, 100);
  return point;
}
function cast(f) { assert.equal(f.u.skill.activate('test'), true); assert.deepEqual(f.b.errors, []); }
function reborn(f) { until(f, () => f.skills.state?.mode === 'combat'); }
function enemy(f, { row = 5, col = 7, flying = false } = {}) {
  const e = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(e.base, { maxHp: 1000000, def: 99999, res: 100, atk: 1 }); e.markDirty(); e.hp = e.s.maxHp;
  if (flying) e.motion = 'FLY';
  f.b.addBuff(e, { key: 'fixture:enemy', flags: { noMove: true, disarm: true, unblockable: true } });
  f.b._buildEnemyIndex(); return e;
}
test('S3 requires a selected source contract and an owned current normal Reconstruction', () => {
  assert.throws(() => base({ skill: 3, prepare: prepareMon3trS3, contract: { ...MON3TR_S3_CONTRACT } }), /selected-skill contract/);
  const f = make(); f.u.skill.setSpTotal(15); assert.equal(f.u.skill.activate(), false);
  charge(f); assert.equal(f.skills.canCast(), true);
});
for (let rank = 1; rank <= 10; rank++) test(`S3 rank ${rank} naturally charges, moves with source stats, uses original Front and returns to its origin`, () => {
  const f = make({ rank, potential: 6, dir: 'LEFT' });
  const p = charge(f, { row: 5, col: 4 }), dp = f.b.dp, seq = f.u.deploySeq;
  const ratio = f.u.hpRatio; cast(f);
  assert.equal(p.alive, false); near(f.b.dp, dp); assert.equal(f.deck.stock, 1);
  near(f.deck.readyAt, f.b.time + 15); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_Begin');
  until(f, () => f.skills.state?.mode === 'reborn');
  assert.equal(f.u.tileC, 4); assert.ok(f.u.deploySeq > seq); assert.equal(f.controller.seq, f.u.deploySeq);
  near(f.u.s.maxHp, f.u.base.maxHp + f.record.bb.max_hp); near(f.u.s.atk, f.u.base.atk * (1 + f.record.bb.atk));
  near(f.u.s.bat, f.u.base.bat + f.record.bb.base_attack_time); assert.equal(f.u.s.blockCnt, 3);
  near(f.u.hpRatio, ratio); assert.equal(f.u.mem.regularModelFacing, 'front');
  const marker = f.skills.state.marker;
  assert.equal(marker.tileC, 5); assert.equal(marker.deploymentSlotCost, 0); assert.equal(marker.mem.regularHideHp, true);
  assert.equal(marker.mem.regularFormVisual.clip, 'Skill_3'); assert.equal(marker.s.flags.invuln, true);
  assert.equal(selectedRegularSummon(f.b, summonUnitId(marker)), null);
  const time = f.b.time; reborn(f); assert.ok(f.b.time >= time + .95);
  near(f.u.skill.sp, 0); assert.equal(f.skills.state.mode, 'combat');
  until(f, () => !f.skills.state, 30);
  assert.equal(f.u.tileC, 5); assert.equal(f.u.tileR, 5); assert.equal(f.u.alive, true);
  near(f.u.s.maxHp, f.u.base.maxHp); near(f.u.s.atk, f.u.base.atk);
  assert.equal(marker.alive, false); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_3_Back');
  assert.equal(f.u.mem.regularVisualDirection, 'UP'); assert.equal(f.u.mem.regularModelFacing, undefined);
  assert.equal(f.u.skill.active, false); near(f.b.dp, dp);
});
test('one accepted S3 attack hits only current block-count ground targets and makes one immediate self/free-jump chain', () => {
  const f = make(); charge(f); cast(f); reborn(f);
  const targets = [enemy(f), enemy(f, { row: 4, col: 7 }), enemy(f, { row: 6, col: 7 }),
    enemy(f, { row: 5, col: 6 }), enemy(f, { flying: true })];
  const a = ally(f, { row: 4, col: 6 }), z = ally(f, { row: 4, col: 5 }), out = ally(f, { row: 3, col: 5 });
  f.u.hp = f.u.s.maxHp * .5; const events = [];
  f.b.on('damaged', ctx => { if (ctx.dmg?.tags.includes('mon3tr:s3')) events.push(ctx); });
  const before = f.attacks.length, heals = f.heals.length;
  until(f, () => events.length > 0, 5);
  assert.equal(events.length, 3); assert.equal(f.attacks.length, before + 1); assert.equal(f.u.blocking.length, 0);
  assert.equal(events.every(x => x.type === 'true'), true); near(events[0].amount, f.u.s.atk * f.u.s.atkScaleMul);
  assert.equal(targets.slice(0, 4).filter(t => t.hp < t.s.maxHp).length, 3); near(targets[4].hp, targets[4].s.maxHp);
  const chain = f.heals.slice(heals).filter(h => h.opts.mon3trTag === 's3');
  assert.equal(chain.length, 4); assert.equal(chain[0].target, f.u);
  assert.equal(chain.every(h => h.time === chain[0].time), true);
  near(chain[0].amount, events[0].amount * .5); near(chain[1].amount, chain[0].amount);
  near(chain[2].amount, chain[1].amount * .75); near(chain[3].amount, chain[2].amount * .75);
  assert.deepEqual(new Set(chain.slice(1).map(h => h.target)), new Set([a, z, out]));
  near(f.u.skill.sp, 0);
});
test('lethal True damage ends S3, returns at one HP ratio and protects the returned owner for exactly one second', () => {
  const f = make(); charge(f); cast(f); reborn(f); const attacker = enemy(f);
  const max = f.u.s.maxHp;
  f.b.dealDamage(attacker, f.u, { amount: max * 10, type: 'true', tags: ['fixture:lethal'] });
  assert.equal(f.u.alive, true); assert.equal(f.u.skill.active, false); near(f.u.hp, 1);
  assert.equal(f.skills.state.mode, 'ending'); assert.equal(f.u.s.flags.undeadable, true);
  advance(f.b, .2); f.b.loseHp(f.u, 999999); near(f.u.hp, 1);
  until(f, () => !f.skills.state); assert.equal(f.u.tileC, 5); assert.equal(f.u.alive, true);
  assert.equal(f.u.s.flags.undeadable, true); near(f.u.hpRatio, 1 / max);
  advance(f.b, .8); f.b.loseHp(f.u, 999999); near(f.u.hp, 1);
  advance(f.b, .3); assert.equal(!!f.u.s.flags.undeadable, false);
  f.b.loseHp(f.u, 999999); assert.equal(f.u.alive, false);
});
test('normal return preserves the current HP ratio and supplies one-second floor without silently healing', () => {
  const f = make(); charge(f); cast(f); reborn(f); f.u.hp = f.u.s.maxHp * .4;
  f.u.skill.end('test'); const ratio = f.u.hpRatio; until(f, () => !f.skills.state);
  near(f.u.hpRatio, ratio); assert.equal(f.u.s.flags.undeadable, true);
});
test('a changed initial destination fails closed and restores the spent source SP', () => {
  const f = make(); charge(f); cast(f);
  const occupant = ally(f); until(f, () => !f.skills.state);
  assert.equal(f.u.tileC, 5); assert.equal(f.u.alive, true); assert.equal(occupant.alive, true);
  assert.equal(f.u.skill.ready, true); assert.equal(f.u.findBuff('mon3tr:s3-mode'), null);
  assert.equal(f.skills.state, null);
});
test('a newly placed normal Reconstruction outside the restored range withdraws with immediately ready stock', () => {
  const f = make({ dir: 'LEFT' }); charge(f, { col: 3 }); cast(f); reborn(f);
  until(f, () => f.b.time >= f.deck.readyAt, 20);
  const p = deployRegularSummon(f.b, CARD, 5, 2), dp = f.b.dp;
  f.u.skill.end('test'); until(f, () => !f.skills.state);
  assert.equal(p.alive, false); assert.equal(f.deck.stock, 1);
  assert.ok(f.deck.readyAt <= f.b.time && f.b.time - f.deck.readyAt <= f.b.dt + 1e-8); near(f.b.dp, dp);
});
test('a normal point still inside the restored range survives return with its current HP and stock remains paused', () => {
  const f = make(); charge(f); cast(f); reborn(f); until(f, () => f.b.time >= f.deck.readyAt, 20);
  const p = deployRegularSummon(f.b, CARD, 5, 7); f.u.skill.end('test'); until(f, () => !f.skills.state);
  assert.equal(p.alive, true); assert.equal(f.deck.point.unit, p); assert.equal(f.deck.readyAt, Infinity);
});
test('owner retirement in S3 removes its hidden marker and normal deck and never schedules a later return', () => {
  const f = make(); charge(f); cast(f); reborn(f); const marker = f.skills.state.marker;
  f.b._remove(f.u, 'fixture:retreat', null, true); assert.equal(marker.alive, false);
  assert.equal(f.skills.state, null); assert.equal(f.deck.stopped, true);
  advance(f.b, 30); assert.equal(f.u.alive, false); assert.equal(f.b.unitAt(5, 5), null);
});
test('a lost or replaced protected origin cannot overwrite another deployment on return', () => {
  const f = make(); charge(f); cast(f); reborn(f); const marker = f.skills.state.marker;
  f.b._remove(marker, 'fixture:scripted-origin-removal', null, true);
  const occupant = ally(f, { col: 5 }); f.u.skill.end('test'); advance(f.b, 1);
  assert.equal(f.u.alive, false); assert.equal(occupant.alive, true); assert.equal(f.b.unitAt(5, 5), occupant);
});
test('owner removal inside source finish/born callbacks never revives the owner or leaks the marker', () => {
  for (const event of ['sourceMoveFinish', 'sourceMoveBorn']) {
    const f = make(); charge(f); cast(f);
    f.b.on(event, ({ unit }) => { if (unit === f.u) f.b._remove(unit, 'fixture:move-callback', null, true); });
    advance(f.b, 3); assert.equal(f.u.alive, false); assert.equal(f.skills.state, null);
    assert.equal(f.b.allyUnits.filter(a => a.alive && a.defId === 'token_10050_monstr_prosts').length, 0);
  }
});
test('S3 honours its original release event and blocks arbitrary force-attack calls outside that accepted release', () => {
  const f = make(); charge(f); cast(f); reborn(f); const e = enemy(f);
  let releasedAt;
  f.b.on('damaged', ctx => { if (ctx.dmg?.tags.includes('mon3tr:s3')) releasedAt = f.b.time; });
  until(f, () => !!f.skills.state.attack);
  const phase = f.skills.state.attack, hp = e.hp;
  f.b.forceAttack(f.u, [e]); near(e.hp, hp);
  while (f.b.time + f.b.dt < phase.releaseAt - 1e-8) advance(f.b, f.b.dt);
  near(e.hp, hp); until(f, () => e.hp < hp, f.b.dt * 2);
  assert.ok(releasedAt + 1e-8 >= phase.releaseAt && releasedAt < phase.releaseAt + f.b.dt + 1e-8);
  const after = e.hp; f.b.forceAttack(f.u, [e]); near(e.hp, after);
});
test('a control epoch cancels the old windup even if the control is removed before the next tick', () => {
  const f = make(); charge(f); cast(f); reborn(f); const e = enemy(f);
  until(f, () => !!f.skills.state.attack); const phase = f.skills.state.attack, hp = e.hp;
  f.b.addBuff(f.u, { key: 'fixture:brief-stun', flags: { stun: true } }); f.b.removeBuff(f.u, 'fixture:brief-stun');
  while (f.b.time <= phase.releaseAt + f.b.dt) advance(f.b, f.b.dt);
  near(e.hp, hp); assert.equal(phase.accepted, false);
  until(f, () => e.hp < hp, 5);
});
test('S3 targets use shared enemy priority and respond to changed block-count capacity', () => {
  const f = make(); charge(f); cast(f); reborn(f);
  const a = enemy(f, { row: 4, col: 5 }), z = enemy(f, { row: 6, col: 7 });
  f.b.addBuff(z, { key: 'fixture:taunt', mods: { taunt: 100 } });
  f.b.addBuff(f.u, { key: 'fixture:reduce-capacity', mods: { blockCnt: -2 } });
  assert.equal(f.u.s.blockCnt, 1); assert.deepEqual(f.skills.enemyTargets().map(x => x.id), [z.id]);
  until(f, () => z.hp < z.s.maxHp, 5); near(a.hp, a.s.maxHp);
});
test('S3 HP loss bypasses shields and normal mitigation without adding attack SP', () => {
  const f = make(); charge(f); cast(f); reborn(f);
  f.b.addBuff(f.u, { key: 'fixture:shields', shield: 99999, flags: { invuln: true }, mods: { def: 99999, res: 100 } });
  const hp = f.u.hp; advance(f.b, .6); near(f.u.hp, hp - 48);
  near(f.u.findBuff('fixture:shields').shield, 99999); near(f.u.skill.sp, 0);
});
test('death inside marker admission cannot leave an origin marker or resume the moved owner', () => {
  const f = make(); charge(f); cast(f);
  f.b.on('beforeBuff', ctx => { if (ctx.buff.key === 'mon3tr:s3-origin') f.b._remove(f.u, 'fixture:marker-admission', null, true); });
  advance(f.b, 3); assert.equal(f.u.alive, false); assert.equal(f.skills.state, null);
  assert.equal(f.b.allyUnits.some(a => a.alive && a.defId === 'token_10050_monstr_prosts'), false);
});
test('death in a True-damage callback stops the remaining hits and the self-heal without revival', () => {
  const f = make(); charge(f); cast(f); reborn(f); const es = [enemy(f), enemy(f), enemy(f)]; let hits = 0;
  f.b.on('damaged', ctx => { if (ctx.dmg?.tags.includes('mon3tr:s3')) { hits++; f.b._remove(f.u, 'fixture:strike-retirement', null, true); } });
  until(f, () => !f.u.alive, 5); assert.equal(hits, 1); assert.equal(es.filter(x => x.hp < x.s.maxHp).length, 1);
  assert.equal(f.heals.some(x => x.opts.mon3trTag === 's3'), false); assert.equal(f.skills.state, null);
});
test('temporary hiding suppresses attacks but does not orphan the HP clock or timed return', () => {
  const f = make(); charge(f); cast(f); reborn(f); const marker = f.skills.state.marker;
  f.u.hidden = true; const hp = f.u.hp; advance(f.b, .6); near(f.u.hp, hp - 48);
  f.u.skill.end('test'); until(f, () => !f.skills.state);
  assert.equal(marker.alive, false); assert.equal(f.u.alive, true); assert.equal(f.u.tileC, 5);
  f.u.hidden = false; advance(f.b, 1); assert.equal(f.controller.stopped, false);
});
