// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { installFeatureDispatch } from '../server/sim/content/enemies.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { applySourceSlowDown, NATIVE_SLOW_DOWN_CONTRACT } from '../server/sim/content/arkpedia-slow-down.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
const read = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const records = read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
const ids = ['enemy_10126_rkbomb', 'enemy_10126_rkbomb_2', 'enemy_10127_rkmbst', 'enemy_10127_rkmbst_2'];
function fixture(id = ids[0]) {
  const h = makeBattle({ content: 'generic', autoFinish: false, setup: b => { installFeatureDispatch(b); installEnemyFeatures(b); },
    defs: { enemies: Object.fromEntries([id, 'enemy_3010_mcreep'].map(k => [k, records[k].levels[0]])),
      chess: { dummy: chessRec({ id: 'dummy', stats: { maxHp: 1e6, atk: 0, def: 0, blockCnt: 1 } }) } },
    units: [{ chessId: 'dummy', row: 10, col: 7 }] });
  h.b.start(); const e = h.spawn(id, { pos: [10, 7] }); e.base.moveSpeed = 0; e.markDirty();
  e.profile.noAttack = true; h.run(.1); e.profile.noAttack = false;
  for (const key of Object.keys(e.profile.attackCooldowns)) e.profile.attackCooldowns[key] = 1e6;
  const a = e.mem.ab.list.find(a => a.changeMode); assert.ok(a?.ordinary); assert.equal(e.blockedBy, h.unit('dummy'));
  return { h, b: h.b, e, a, u: h.unit('dummy'), hit: id.includes('rkmbst') ? .800000011920929 : .5333333611488342 };
}
function begin(f) { assert.equal(f.a.ordinary.begin([f.u]), true); return f.a.ordinary.pending; }
function slow(f) { return applySourceSlowDown(f.b, f.u, f.e, { key: 'shielded-clock-fixture', increment: .5,
  maxStrength: .5, maxStacks: 1, duration: 30, contract: NATIVE_SLOW_DOWN_CONTRACT }); }

test('shielded enemy clock contract reproduces exact retained graphs and original skeleton bytes', () => {
  const c = read('data/candidates/arkpedia-ch16-shielded-clock-contract.json');
  assert.deepEqual(Object.keys(c.enemies).sort(), ids.slice().sort());
  for (const row of Object.values(c.sources)) assert.equal(createHash('sha256').update(readFileSync(new URL('../' + row.path, import.meta.url))).digest('hex'), row.sha256);
  execFileSync(process.execPath, ['tools/arkpedia/shielded-enemy-clock-contract.mjs', '--check'], { stdio: 'pipe' });
});

for (const id of ids) for (const mode of [0, 1]) test(id + ': mode ' + mode + ' delays one ordinary receipt until the original marker', () => {
  const f = fixture(id); if (mode) { f.a.changeMode(); f.h.run(1.1); }
  const hp = f.u.hp, attacks = f.e.stats.attacks, events = [];
  f.b.on('attack', c => { if (c.attacker === f.e) events.push(c); });
  const p = begin(f); assert.equal(p.rate, 1); assert.equal(f.e.stats.attacks, attacks+1);
  f.h.run(f.hit-.1); assert.equal(f.u.hp, hp); assert.equal(events.length, 0);
  f.b.addBuff(f.e, { key: 'live-atk', persist: true, mods: { atkFlat: 100 } });
  f.h.run(.15); assert.equal(hp-f.u.hp, f.e.s.atk); assert.equal(events.length, 1);
  assert.equal(events[0].attackId, p.attackId); assert.equal(f.e.stats.attacks, attacks+1);
  assert.ok(f.e.findBuff('ch16:shielded-ordinary')); f.h.run(2); assert.equal(events.length, 1);
  assert.equal(f.a.ordinary.pending, null); assert.equal(f.e.findBuff('ch16:shielded-ordinary'), null); assert.deepEqual(f.b.errors, []);
});

for (const id of [ids[0], ids[2]]) test(id + ': pending clip and all four cooldowns consume live slowdown once', () => {
  const f = fixture(id); f.e.profile.attackCooldowns.m0Combat = 0; f.b.step();
  const p = f.a.ordinary.pending; assert.ok(p); f.h.run(.1); const age = p.age;
  const before = { ...f.e.profile.attackCooldowns }, buff = slow(f); f.h.run(.4);
  assert.ok(Math.abs(p.age-age-.2) <= f.b.dt+1e-7); assert.equal(p.released, false);
  for (const key of Object.keys(before)) assert.ok(Math.abs(f.e.profile.attackCooldowns[key]-before[key]+.2) <= f.b.dt+1e-7, key);
  f.b.removeBuff(f.e, buff); f.h.run(f.hit); assert.equal(p.released, true); assert.deepEqual(f.b.errors, []);
});

for (const id of [ids[0], ids[2]]) for (const aspd of [-50, 900]) test(id + ': ordinary sampled playback cap at ASPD delta ' + aspd, () => {
  const f = fixture(id); if (id.includes('rkmbst')) f.a.changeMode(); f.h.run(1.1);
  f.b.addBuff(f.e, { key: 'rate', persist: true, mods: { aspd } }); const p = begin(f), rate = aspd < 0 ? .5 : 1;
  assert.equal(p.rate, rate); f.h.run((f.hit-.1)/rate); assert.equal(p.released, false);
  f.h.run(.15/rate); assert.equal(p.released, true); assert.deepEqual(f.b.errors, []);
});

for (const id of [ids[0], ids[2]]) for (const flag of ['stun', 'freeze', 'sleep', 'levitate', 'fear', 'disarm'])
test(id + ': ' + (flag === 'fear' ? 'sampled ' : 'brief ') + flag + ' cancels unborn ordinary output', () => {
  const f = fixture(id), hp = f.u.hp; begin(f); f.h.run(.1);
  const buff = f.b.addBuff(f.e, { key: 'brief-control', persist: true, flags: { [flag]: true } });
  if (flag === 'fear') f.b.step(); // Fear has no generic between-tick epoch bridge.
  f.b.removeBuff(f.e, buff);
  f.h.run(1); assert.equal(f.u.hp, hp); assert.equal(f.a.ordinary.pending, null); assert.equal(f.e.findBuff('ch16:shielded-ordinary'), null);
  assert.deepEqual(f.b.errors, []);
});

for (const id of [ids[0], ids[2]]) for (const invalid of ['death', 'reuse']) test(id + ': input ' + invalid + ' does not transfer an ordinary hit', () => {
  const f = fixture(id), hp = f.u.hp; begin(f); f.h.run(.1);
  if (invalid === 'death') f.b.kill(f.u, null); else f.u.deploySeq++;
  const m = f.h.spawn('enemy_3010_mcreep', { pos: [10, 7.5] }); m.atkCd = 1e6; m.base.moveSpeed = 0; m.markDirty(); const mhp = m.hp;
  f.h.run(1); assert.equal(f.u.hp, invalid === 'death' ? 0 : hp); assert.equal(m.hp, mhp); assert.deepEqual(f.b.errors, []);
});

for (const id of ids) test(id + ': shield break cancels the old mode windup before its marker', () => {
  const f = fixture(id), hp = f.u.hp; begin(f); f.h.run(.1); f.a.changeMode();
  assert.equal(f.a.mode, 1); assert.equal(f.a.ordinary.pending, null); assert.equal(f.e.findBuff('ch16:shielded-ordinary'), null);
  assert.equal(f.a.ordinary.begin([f.u]), false); f.h.run(.7); assert.equal(f.u.hp, hp); assert.ok(f.a.phase);
  f.h.run(.4); assert.equal(f.a.phase, null); assert.deepEqual(f.b.errors, []);
});

for (const id of ids) test(id + ': transition consumes live slowdown without replay or early unlock', () => {
  const f = fixture(id); f.a.changeMode(); const phase = f.a.phase; f.h.run(.4); const age = phase.age, buff = slow(f);
  f.h.run(.6); assert.ok(Math.abs(phase.age-age-.3) <= f.b.dt+1e-7); assert.equal(f.a.phase, phase);
  f.b.removeBuff(f.e, buff); f.h.run(.4); assert.equal(f.a.phase, null); assert.equal(f.a.mode, 1); assert.deepEqual(f.b.errors, []);
});

for (const id of [ids[0], ids[2]]) for (const aspd of [-50, 100]) test(id + ': distinct native transition playback at ASPD delta ' + aspd, () => {
  const f = fixture(id); f.b.addBuff(f.e, { key: 'rate', persist: true, mods: { aspd } }); f.a.changeMode();
  const p = f.a.phase, rate = id.includes('rkmbst') ? (100+aspd)/100 : 1; assert.equal(p.rate, rate);
  f.h.run(.85/rate); assert.equal(f.a.phase, p); f.h.run(.2/rate); assert.equal(f.a.phase, null); assert.deepEqual(f.b.errors, []);
});

for (const id of [ids[0], ids[2]]) for (const invalid of ['death', 'removed', 'reuse', 'battleEnd'])
test(id + ': ' + invalid + ' retires ordinary and transition work, including miner links', () => {
  for (const transition of [false, true]) {
    const f = fixture(id), m = f.h.spawn('enemy_3010_mcreep', { pos: [10, 7.5] }); m.base.moveSpeed = 0; m.markDirty();
    f.h.run(.4); assert.ok(f.a.engagements.size > 0); if (transition) f.a.changeMode(); else begin(f); const hp = f.u.hp;
    if (invalid === 'death') f.b.kill(f.e, null);
    else if (invalid === 'removed') { f.e.deployed = false; f.b.emit('removed', { unit: f.e }); }
    else if (invalid === 'reuse') f.e.deploySeq++;
    else f.b.emit('battleEnd', {});
    f.h.run(2); assert.equal(f.a.phase, null); assert.equal(f.a.ordinary.pending, null); assert.equal(f.a.engagements.size, 0);
    assert.equal(f.a.ordinary.begin([f.u]), false); assert.equal(f.u.hp, hp); assert.deepEqual(f.b.errors, []);
  }
});
