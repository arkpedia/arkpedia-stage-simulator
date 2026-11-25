// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { installStageSight } from '../server/sim/content/arkpedia-stage-sight.js';
import { nativeComponents } from '../shared/arkpedia/enemy-support.js';
import { norportIdentityNative, norportIdentityParams, isReviewedIdentity, isUnreviewedIdentity, IDENTITY_PREFABS, PENDING_IDENTITY_PREFABS,
  eblanaNative, eblanaParams }
  from '../shared/arkpedia/enemy-norport-identity-features.js';
import { sightNativeReviewed } from '../shared/arkpedia/stage-sight.js';
import { COLS } from '../server/sim/constants.js';
import { enemyStealthed } from '../server/sim/targeting.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };

const SPY = 'enemy_1314_wdnjd', CIVILIAN = 'enemy_1313_wdfmr', SENTRY = 'enemy_1315_wdyjd';
const ARMED = 'enemy_1316_wdpjd';
const CLUSTER = 'enemy_1541_wdslms', EBLANA = 'enemy_1540_wdncr';
const REVIEWED = [SPY, 'enemy_1314_wdnjd_2', SENTRY, 'enemy_1315_wdyjd_2', ARMED, 'enemy_1316_wdpjd_2', CIVILIAN, 'enemy_1313_wdfmr_2', CLUSTER];
const rec = id => ENEMY_RECORDS.enemies[id].levels[0];

test('every chapter-12 identity record is pinned and reviewed; changed kits are refused', () => {
  for (const id of REVIEWED) {
    assert.equal(isReviewedIdentity(rec(id)), true, id);
    assert.equal(norportIdentityNative(rec(id), nativeComponents(native, id)), true, id);
  }
  const r = rec(SPY);
  assert.equal(norportIdentityNative({ ...r, talents: { ...r.talents, bb: { ...r.talents.bb, 'EnhancedAttack.atk_scale': 3 } } },
    nativeComponents(native, SPY)), false, 'a changed attack bonus');
  const s = rec(SENTRY);
  assert.equal(norportIdentityNative({ ...s, talents: { ...s.talents, bb: { 'moveSpeed.move_speed': .3 } } }, nativeComponents(native, SENTRY)), false,
    'a changed sentry speed');
  assert.equal(norportIdentityNative(s, nativeComponents(native, SPY)), false, 'the Pathfinder tree is not the Sentry tree');
  assert.deepEqual(IDENTITY_PREFABS.filter(k => !REVIEWED.includes(k)), []);
  for (const id of REVIEWED) assert.equal(isUnreviewedIdentity(rec(id)), false, id);
  assert.equal(isUnreviewedIdentity({ ...rec(ARMED), level: 1 }), true, 'an unpinned level');
  const c2 = rec('enemy_1313_wdfmr_2');
  assert.equal(norportIdentityNative({ ...c2, talents: { ...c2.talents, bb: { 'civilianTalent.max_cost': 2 } } },
    nativeComponents(native, 'enemy_1313_wdfmr_2')), false, 'a changed elite reward');
  assert.equal(sightNativeReviewed(), true);
  // The 12-20/H12 boss family carries `ability:Spy` but runs its own contract (enemy-damazti-features.js, tested in
  // arkpedia-damazti.test.js): the generic spy keys refuse every level of it.
  for (const id of PENDING_IDENTITY_PREFABS) for (const r of Object.values(ENEMY_RECORDS.enemies[id].levels))
    assert.equal(isUnreviewedIdentity(r), true, `${id}@${r.level}`);
  assert.equal(norportIdentityNative(rec(CLUSTER), nativeComponents(native, SPY)), false, 'the Cluster tree is its own');
});

test('12-16: the Damazti Cluster and Eblana are pinned; changed kits are refused', () => {
  const e = rec(EBLANA), n = nativeComponents(native, EBLANA);
  assert.equal(eblanaNative(e, n), true);
  assert.equal(eblanaNative({ ...e, stats: { ...e.stats, aspd: 100 } }, n), false, 'a changed attack speed');
  assert.equal(eblanaNative({ ...e, skills: [{ ...e.skills[0], initCooldown: 60 }] }, n), false, 'a changed detectAll');
  assert.equal(eblanaNative(e, nativeComponents(native, CLUSTER)), false);
  const c = rec(CLUSTER);
  assert.equal(norportIdentityNative({ ...c, stats: { ...c.stats, lpr: 1 } }, nativeComponents(native, CLUSTER)), false, 'a changed life cost');
  const p = norportIdentityParams(c);
  assert.deepEqual([p.kind, p.switchDur, p.move, p.atkScale, p.invisible, p.attackAnim, p.guarded, p.clips.switch, p.clips.revealed],
    ['spy', 2, null, null, null, null, { key: 'enemy_wdslms[invincibleAndBlockFree]' }, 'Die', { move: '2_Move', idle: '2_Idle', die: '2_Die_2' }]);
  const q = eblanaParams(e);
  assert.deepEqual([q.range, q.aspd, q.attack.dur, q.attack.hit, q.detectAll.initCooldown, q.detectAll.clip, Math.round(q.detectAll.dur * 100),
    Math.round(q.detectAll.hit * 10)], [2, 0, 1.5, .5, 92, 'Skill_b_3', 1167, 92]);
});

test('parameters: 0.1 s identification steps, +2 then +3 to 300, -1 out of sight; spy and civilian outcomes', () => {
  const spy = norportIdentityParams(rec(SPY)), civ = norportIdentityParams(rec(CIVILIAN));
  assert.deepEqual(spy.detect, { interval: .1, threshold: 300, cap: 301, gain: [2, 3], loss: 1 });
  assert.deepEqual([spy.kind, spy.switchDur, spy.move, spy.atkScale, spy.clips.disguised, spy.clips.revealed], ['spy', 1, .05, 2, 'A', 'B']);
  assert.deepEqual([civ.kind, civ.dp], ['civilian', 2]);
  const spy2 = norportIdentityParams(rec('enemy_1314_wdnjd_2'));
  assert.deepEqual([spy2.move, spy2.atkScale, spy2.invisible], [.05, 2, null]);
  for (const id of [ARMED, 'enemy_1316_wdpjd_2']) {
    const p = norportIdentityParams(rec(id));
    assert.deepEqual([p.kind, p.switchDur, p.move, p.atkScale, p.invisible, p.attackAnim.dur, Math.round(p.attackAnim.hit * 10)],
      ['spy', 1, null, null, null, 1.5, 6], id);
  }
  assert.deepEqual([norportIdentityParams(rec('enemy_1313_wdfmr_2')).kind, norportIdentityParams(rec('enemy_1313_wdfmr_2')).dp], ['civilian', 5]);
  for (const id of [SENTRY, 'enemy_1315_wdyjd_2']) {
    const p = norportIdentityParams(rec(id));
    assert.deepEqual([p.kind, p.switchDur, p.move, p.atkScale, p.invisible], ['spy', 1, .2, null, { key: 'enemy_wdyjd[enemyMode]', restore: 3 }], id);
  }
});

/** One identity unit held at row 2, col 6; `seen` controls the stubbed chapter-12 sight. */
function fixture(id) {
  const op = chessRec({ id: 'norport_target', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: 1 } });
  const h = makeBattle({ content: 'generic', autoFinish: false, timeLimit: 1000, defs: { chess: { [op.chessId]: op }, enemies: { [id]: rec(id) } },
    units: [{ chessId: op.chessId, row: 10, col: 2, dir: 'RIGHT' }], setup: b => installEnemyFeatures(b) });
  const b = h.b; b.start();
  const sight = { seen: false }; b.stageSight = { inSight: () => sight.seen };
  const e = b.spawnEnemy(id, { pos: [2, 6], route: 0 }); e.y = 2; e.x = 6;
  b.addBuff(e, { key: 'hold', persist: true, flags: { noMove: true } });
  const a = e.mem.ab.list.find(x => x.norportIdentity);
  const run = s => { const until = b.time + s; while (b.time < until - 1e-9) b.step(); };
  return { b, e, a, sight, op: h.allies()[0], run };
}

test('in sight: phase 2 after 15.0 s, complete after 10.0 s more; the spy then switches for 1 s and reveals', () => {
  const { b, e, a, sight, run } = fixture(SPY);
  assert.equal(e.profile.noAttack, true);
  assert.ok(e.findBuff('enemy_mainline12[civilianMode]'), 'disguised and invincible');
  sight.seen = true;
  run(14.95); assert.equal(a.phase, 1); assert.ok(a.progress >= 296 && a.progress < 300, `progress ${a.progress}`);
  run(.1); assert.equal(a.phase, 2); assert.ok(a.progress <= 3);
  run(9.85); assert.equal(a.state, 'detecting');
  run(.1); assert.equal(a.state, 'switching'); assert.equal(e.profile.revealed, true);
  assert.ok(e.findBuff('enemy_mainline12[switchModeAbnormals]'));
  run(.9); assert.equal(a.state, 'switching');
  run(.15); assert.equal(a.state, 'revealed');
  assert.equal(e.findBuff('enemy_mainline12[civilianMode]'), null, 'the disguise is gone');
  assert.equal(e.profile.noAttack, false);
  assert.ok(e.findBuff('enemy_wdnjd[moveSpeed]'));
  assert.equal(b.time < 27, true);
});

test('out of sight the progress falls by 1 per 0.1 s, never below 0; blocking counts without sight', () => {
  const { e, a, sight, op, run } = fixture(SPY);
  sight.seen = true; run(5.05); const peak = a.progress; assert.ok(peak >= 100 && peak <= 102, `peak ${peak}`);
  sight.seen = false; run(3); assert.ok(Math.abs(a.progress - (peak - 30)) <= 1, `after 3 s ${a.progress}`);
  run(20); assert.equal(a.progress, 0); assert.equal(a.phase, 1);
  e.blockedBy = op; run(15.05); assert.equal(a.phase, 2, 'blocked, unseen');
});

test('the revealed spy\'s next attack is doubled once', () => {
  const { b, e, a, sight, op, run } = fixture(SPY);
  sight.seen = true; run(26.15); assert.equal(a.state, 'revealed');
  const hits = []; b.on('damaged', c => { if (c.source === e) hits.push(c.dmg.amount); });
  for (let i = 0; i < 2; i++) b.dealDamage(e, op, { amount: 100, type: 'phys', isAttack: true, canDodge: false });
  assert.deepEqual(hits, [200, 100]);
});

test('a confirmed civilian is unblockable and raises max DP at the exit, never past the stage ceiling', () => {
  const { b, e, a, sight, run } = fixture(CIVILIAN);
  assert.equal(e.profile.friendly, true);
  b.flags.dpMax = 98; b.flags.dpMaxCeil = 99;
  sight.seen = true; run(25.05);
  assert.equal(a.state, 'confirmed');
  assert.equal(e.profile.civilianDp, 2);
  assert.ok(e.findBuff('civilian_mainline12[detectComplete]'));
  const life = b.life; b.leak(e);
  assert.equal(b.flags.dpMax, 99); assert.equal(b.life, life);
  // An unconfirmed civilian reaching the exit gives nothing and costs nothing.
  const other = fixture(CIVILIAN); other.b.flags.dpMax = 20;
  const l2 = other.b.life; other.b.leak(other.e);
  assert.equal(other.b.flags.dpMax, 20); assert.equal(other.b.life, l2);
});

test('sight: each own-side unit contributes its range tiles, refreshed every 0.5 s and at skill start and end', () => {
  const op = chessRec({ id: 'sight_op', stats: { maxHp: 1e7, atk: 0, def: 0, res: 0, blockCnt: 1 } });
  const h = makeBattle({ content: 'generic', autoFinish: false, timeLimit: 1000, defs: { chess: { [op.chessId]: op } },
    units: [{ chessId: op.chessId, row: 10, col: 2, dir: 'RIGHT' }] });
  const b = h.b; b.start();
  const u = h.allies()[0], key = (r, c) => r * COLS + c;
  u.rangeKeySet = new Set([key(1, 1)]);
  const sight = installStageSight(b, { kind: 'mainline12_sightManager', interval: .5 });
  b.step();
  assert.equal(sight.inSight(1, 1), true); assert.equal(sight.inSight(1, 2), false);
  u.rangeKeySet = new Set([key(1, 2)]);
  b.step(); assert.equal(sight.inSight(1, 1), true, 'not yet refreshed');
  const until = b.time + .5; while (b.time < until) b.step();
  assert.equal(sight.inSight(1, 1), false); assert.equal(sight.inSight(1, 2), true);
  u.rangeKeySet = new Set([key(3, 3)]); b.emit('skillStart', { unit: u });
  assert.equal(sight.inSight(3, 3), true, 'skill start refreshes at once');
  u.alive = false; assert.equal(sight.inSight(3, 3), false, 'a unit that leaves stops contributing');
});

test('the revealed Sentry Spy is Invisible except while blocked, and again 3 s after its release; no attack bonus', () => {
  const { b, e, a, sight, op, run } = fixture(SENTRY);
  sight.seen = true; run(26.15); assert.equal(a.state, 'revealed');
  assert.ok(e.findBuff('enemy_wdyjd[moveSpeed]')); assert.equal(e.findBuff('enemy_wdnjd[moveSpeed]'), null);
  assert.equal(enemyStealthed(e), true);
  e.blockedBy = op; assert.equal(enemyStealthed(e), false, 'blocked');
  e.blockedBy = null; b._stealthSwitch(e); run(2.9); assert.equal(enemyStealthed(e), false, 'within 3 s of the release');
  run(.2); assert.equal(enemyStealthed(e), true, 'Invisible again');
  const hits = []; b.on('damaged', c => { if (c.source === e) hits.push(c.dmg.amount); });
  b.dealDamage(e, op, { amount: 100, type: 'phys', isAttack: true, canDodge: false });
  assert.deepEqual(hits, [100]);
});

test('the revealed Armed Spy just fights: no speed buff, no attack bonus, not Invisible', () => {
  const { b, e, a, sight, op, run } = fixture(ARMED);
  sight.seen = true; run(26.15); assert.equal(a.state, 'revealed');
  assert.equal(e.profile.noAttack, false);
  assert.equal(e.buffs.some(x => /moveSpeed|enemyMode/.test(x.key)), false);
  assert.equal(enemyStealthed(e), false);
  const hits = []; b.on('damaged', c => { if (c.source === e) hits.push(c.dmg.amount); });
  b.dealDamage(e, op, { amount: 100, type: 'phys', isAttack: true, canDodge: false });
  assert.deepEqual(hits, [100]);
});

test('the elite civilian (enemy_1313_wdfmr_2) raises max DP by 5 once confirmed', () => {
  const { b, e, a, sight, run } = fixture('enemy_1313_wdfmr_2');
  b.flags.dpMax = 20; b.flags.dpMaxCeil = 99;
  sight.seen = true; run(25.05); assert.equal(a.state, 'confirmed');
  b.leak(e); assert.equal(b.flags.dpMax, 25);
});
