// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { prisonerLeaderNative } from '../shared/arkpedia/enemy-prisoner-leaders-features.js';
import { enemySupport, nativeComponents } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with { type: 'json' };
import index from '../data/arkpedia-enemy-clock-source.json' with { type: 'json' };
const ids = ['enemy_1120_vofwiz','enemy_1120_vofwiz_2','enemy_1121_lifbos','enemy_1121_lifbos_2'];
const sniper = 'enemy_1117_liiprr', ordinary = 'enemy_1116_liprr';
const state = e => e.mem.ab.list.find(a => a.confine);
function fixture(id = ids[0]) {
  const ops = ['prison_target','prison_decoy','prison_spare'].map((id, i) => chessRec({ id,
    stats: { maxHp: 1e6, atk: 0, def: 0, res: 0, blockCnt: i ? 0 : 10, tauntLevel: i ? 99 : 0 }, skill: null }));
  const h = makeBattle({ content: 'none', autoFinish: false, captureNoisy: true, timeLimit: 300,
    defs: { enemies: Object.fromEntries([...ids,sniper,ordinary].map(id => { const r = structuredClone(ENEMY_RECORDS.enemies[id].levels[0]);
      r.stats.moveSpeed = 0; return [id, r]; })), chess: Object.fromEntries(ops.map(op => [op.chessId, op])) },
    kits: Object.fromEntries(ops.map(op => [op.chessId, () => ({ trait: { noAttack: true } })])),
    units: ops.map((op, i) => ({ chessId: op.chessId, row: 9, col: 4 + i })), setup: installEnemyFeatures });
  h.b.start(); const [target, decoy, spare] = h.b.allyUnits; target.tags.add('prison');
  const e = h.b.spawnEnemy(id, { pos: [9, 4] }); const hits = [];
  h.b.on('damaged', c => { if (c.source === e) hits.push({ ...c, time: h.b.time }); });
  return { ...h, e, target, decoy, spare, hits, a: state(e) };
}
test('Caster Prisoners stay disarmed with one DEF bonus until forced liberation', () => {
  for (const id of ids.slice(0,2)) {
    const f = fixture(id); f.run(25); assert.equal(f.e.stats.attacks, 0); assert.equal(f.a.n, 0);
    assert.equal(f.e.s.def, f.e.base.def + 300); assert.equal(f.e.s.flags.disarm, true);
    f.a.liberate(f.b,f.e,f.a); assert.equal(f.e.s.def, f.e.base.def); assert.equal(!!f.e.s.flags.disarm, false);
    f.run(5); assert.ok(f.hits.length >= 2); assert.equal(f.e.s.atk, f.e.base.atk * 1.5);
    assert.equal(f.hits[0].dmg.type, 'arts'); assert.deepEqual(f.b.errors, []);
  }
});
test('freed Caster captures two targets in one attack, prioritizes the device tag and retains independent deployment locks', () => {
  const f = fixture(); f.a.liberate(f.b,f.e,f.a); f.e.atkCd = 0; f.run(.2);
  assert.equal(f.e.stats.attacks, 1); assert.equal(f.hits.length, 0);
  const captured = f.a.cast.targets.map(x => x.unit); assert.equal(captured.length, 2); assert.ok(captured.includes(f.target));
  const lost = captured.find(u => u !== f.target); lost.deploySeq++; f.run(1);
  assert.equal(f.hits.length, 1); assert.equal(f.hits[0].target, f.target);
  assert.equal(f.e.stats.attacks, 1); assert.deepEqual(f.b.errors, []);
});
test('both Caster projectiles share one attack receipt and land independently', () => {
  const f = fixture(); f.a.liberate(f.b,f.e,f.a); f.e.atkCd = 0; f.run(1.3);
  assert.equal(f.e.stats.attacks,1); assert.equal(f.hits.length,2);
  assert.equal(new Set(f.hits.map(h=>h.target.id)).size,2);
  assert.equal(new Set(f.hits.map(h=>h.dmg.attackId)).size,1);
  assert.ok(f.hits.every(h=>h.dmg.applyWay==='ranged')); assert.deepEqual(f.b.errors,[]);
});
test('reconfinement cancels an unreleased dual cast and preserves cooldown and DEF', () => {
  const f = fixture(); f.a.liberate(f.b,f.e,f.a); f.e.atkCd = 0; f.run(.2);
  f.a.confine(f.b,f.e,f.a); f.run(5); assert.equal(f.hits.length, 0);
  assert.equal(f.e.stats.attacks, 1); assert.equal(f.a.mode, 0); assert.equal(f.e.s.def, f.e.base.def + 300);
  assert.equal(f.e.s.flags.disarm, true); assert.deepEqual(f.b.errors, []);
});
test('the strongest ASPD aura wins, weaker owners resume immediately, and new recipients inherit it', () => {
  const f = fixture(); assert.equal(f.e.s.aspd, 80);
  const other = f.b.spawnEnemy(ids[0], {pos:[8,4]}); f.run(.1); assert.equal(f.e.s.aspd, 80); assert.equal(other.s.aspd, 80);
  const elite = f.b.spawnEnemy(ids[1], {pos:[8,5]}); f.run(.1); assert.equal(f.e.s.aspd, 100);
  const u = f.b.spawnEnemy(sniper, {pos:[7,4]}); f.run(.1); assert.equal(u.s.aspd, 100);
  f.b.kill(elite); assert.equal(u.s.aspd, 80); f.b.kill(other); assert.equal(u.s.aspd, 80);
  f.b.kill(f.e); assert.equal(u.s.aspd, 50); assert.deepEqual(f.b.errors, []);
});
test('a Caster leaving the map releases its owned aura immediately', () => {
  const f = fixture(), u=f.b.spawnEnemy(sniper,{pos:[7,4]});f.run(.1);assert.equal(u.s.aspd,80);
  f.b._remove(f.e,'leak');assert.equal(u.s.aspd,50);f.run(.1);assert.equal(u.s.aspd,50);assert.deepEqual(f.b.errors,[]);
});
test('same-side aura respects isolation, sleep and recipient silence, while opponent TARGET_FREE does not block it', () => {
  const f = fixture(), u = f.b.spawnEnemy(sniper, {pos:[7,4]}); f.run(.1);
  f.b.addBuff(u,{key:'targetfree',flags:{targetFree:true}}); f.run(.1); assert.equal(u.s.aspd,80);
  for (const flag of ['isolated','sleep','silence']) {
    f.b.addBuff(u,{key:'filter',flags:{[flag]:true}}); f.run(.1); assert.equal(u.s.aspd,50,flag);
    f.b.removeBuff(u,'filter'); f.run(.1); assert.equal(u.s.aspd,80,flag);
  }
  f.e.hidden = true; f.run(.1); assert.equal(u.s.aspd,80); assert.deepEqual(f.b.errors, []);
});
test('each Recidivist frees the field once; reconfinement does not restore that one-shot', () => {
  for (const id of ids.slice(2)) {
    const f = fixture(id), u = f.b.spawnEnemy(sniper,{pos:[7,4]}), hidden = f.b.spawnEnemy(sniper,{pos:[7,5]});
    hidden.hidden = true; f.a.liberate(f.b,f.e,f.a); assert.equal(state(u).free,true); assert.equal(state(hidden).free,false);
    state(u).confine(f.b,u,state(u)); f.a.confine(f.b,f.e,f.a); f.a.liberate(f.b,f.e,f.a);
    assert.equal(state(u).free,false);
    const second = f.b.spawnEnemy(id,{pos:[8,4]}); state(second).liberate(f.b,second,state(second));
    assert.equal(state(u).free,true); assert.equal(state(hidden).free,false); assert.deepEqual(f.b.errors, []);
  }
});
test('ordinary Recidivist attacks self-liberate on the fourth cast and release Casters through the same controller', () => {
  const f = fixture(ids[2]), c = f.b.spawnEnemy(ids[0],{pos:[8,4]}); f.run(23);
  assert.equal(f.a.free,true); assert.equal(state(c).free,true); assert.equal(f.a.freedOthers,true);
  assert.ok(f.hits.length >= 4); assert.ok(f.hits.every(h=>h.dmg.type==='phys' && h.dmg.applyWay==='melee'));
  assert.equal(f.e.s.def,f.e.base.def); assert.equal(f.e.s.atk,f.e.base.atk*1.5); assert.deepEqual(f.b.errors, []);
});
test('field-wide liberation restarts ordinary prisoners once and preserves an already-free cooldown', () => {
  const f=fixture(ids[2]),u=f.b.spawnEnemy(ordinary,{pos:[7,4]}),a=state(u);u.atkCd=.1;
  f.a.liberate(f.b,f.e,f.a);assert.equal(a.free,true);assert.equal(u.atkCd,u.s.interval);
  u.atkCd=.25;a.liberate(f.b,u,a);assert.equal(u.atkCd,.25);assert.deepEqual(f.b.errors,[]);
});
test('liberation chains terminate before revisiting a Recidivist', () => {
  const f = fixture(ids[2]), other = f.b.spawnEnemy(ids[3],{pos:[8,4]});
  f.a.liberate(f.b,f.e,f.a); assert.equal(f.a.freedOthers,true); assert.equal(state(other).freedOthers,true);
  assert.equal(state(other).free,true); assert.deepEqual(f.b.errors, []);
});
test('native leader admission refuses changed aura ownership, targeting, once guards and forced mode switches', () => {
  for (const id of ids) assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],index.prefabs,evidence).policy,id);
  for (const kind of ['aura','target','once','force']) {
    const ev = structuredClone(evidence), id = ['aura','target'].includes(kind) ? ids[0] : ids[2];
    if(kind==='once') ev.templates.lifbos_trigger_ability_once.eventToActions.ON_BUFF_START[2]._finishDerivedBuffIfParentFinish=true;
    if(kind==='force') ev.templates.enemy_liberty_force.eventToActions.ON_BUFF_START[2]._restartFSM=false;
    if(kind==='aura'||kind==='target') {
      const rows=ev.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];
      const row=rows.find(x=>kind==='aura'?JSON.parse(x.originalJson)._selfOption===0:JSON.parse(x.originalJson)._filterTag==='prison');
      const d=JSON.parse(row.originalJson); if(kind==='aura')d._selfOption=1;else d._filterTag='other';row.originalJson=JSON.stringify(d);
    }
    assert.equal(prisonerLeaderNative(ENEMY_RECORDS.enemies[id].levels[0],nativeComponents(ev,id)),false,kind);
  }
});
test('original MB-5/6/7 load shared prisoner elements and resolve the complete wave schedules', async () => {
  const {loadContentContext,planStage}=await import('../tools/arkpedia/content-inventory.mjs');
  const {StandardBattle}=await import('../server/sim/arkpedia.js'); const {defaultBuild}=await import('../shared/arkpedia/loadout.js');
  const c=await loadContentContext();
  for(const key of ['mb-5','mb-6','mb-7']) {
    const p=await planStage(c,key,{waves:true});assert.deepEqual(p.blockers,[],key);
    const b=new StandardBattle({...c.mvp,stage:p.stage,enemies:{...c.mvp.enemies,...p.stage.enemies}},{operators:[defaultBuild(c.mvp.operators.char_123_fang)]});
    let leaders=0;b.on('enemySpawn',({enemy})=>{if(ids.includes(enemy.defId))leaders++;b.after(.5,()=>b.kill(enemy));});
    const life=b.life;b.start();b.runToEnd(600);assert.equal(b.reason,'cleared',key);assert.ok(leaders>0);assert.equal(b.life,life);assert.deepEqual(b.errors,[]);
  }
});
