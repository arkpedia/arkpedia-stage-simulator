// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make, enemy, killer, hit, advance, near} from './helpers/ju-fixture.js';
import {JU_WOUND_CONTRACT, verifyJuWoundSource} from '../server/sim/content/arkpedia-ju-wounds.js';
import {juNativeInputs} from '../server/sim/content/arkpedia-ju-source.js';
import canonical from '../data/candidates/arkpedia-enemy-records.canonical.json' with {type:'json'};
import {installChapter17MutwinCore} from '../server/sim/content/chapter17-mutwin-core.js';

test('Ju wounds require the original source contract and reject changed native dispatch', () => {
  assert.throws(() => make({contract: {...JU_WOUND_CONTRACT}}), /exact wound contract/);
  assert.throws(() => make({mutate: d => { d.stats.atk++; }}), /Incomplete/);
  const paths = [n => n.talent._buffs[0].blackboard[0].value++,
    n => n.templates.ju_t_1.eventToActions.ON_OUTPUT_DAMAGE[0]._sharedFlagIndex = 'OTHER',
    n => n.templates.cripple.eventToActions.ON_OWNER_KILLED_BY_MAIN_TARGET[0]._forceFlag = true,
    n => n.templates.cripple.eventToActions.ON_BUFF_TRIGGER[2]._skipReborn = true,
    n => n.templates.cripple.eventToActions.ON_BEFORE_APPEAR[0]._skipReborn = true];
  for (const mutate of paths) { const n = structuredClone(juNativeInputs()); mutate(n); assert.throws(() => verifyJuWoundSource(n), /Changed original/); }
});

for (const [elite, sp] of [[0, 1], [1, 1], [2, 2]])
  test(`Ju E${elite} keeps the source SP gift and critically wounded flags`, () => {
    const f = make({elite}), e = enemy(f), k = killer(f);
    hit(f, e); assert.equal(e.hp, 1); assert.ok(e.findBuff('cripple'));
    assert.equal(e.s.flags.healFree, true); assert.equal(e.s.flags.noHpRecovery, true);
    assert.equal(e.s.flags.noCombat, true); assert.equal(e.s.blockCnt, 0);
    f.b.dealDamage(k, e, {amount: 10, type: 'true'});
    near(k.skill.spTotal, sp); assert.equal(f.wounds.pending.size, 0); assert.equal(f.wounds.watchers.length, 0);
    assert.equal(e.findBuff('cripple'), null); assert.deepEqual(f.b.errors, []);
  });

test('Ju observes actual post-shield lethal attempts, including an exactly lethal hit', () => {
  const f = make(), e = enemy(f);
  f.b.addBuff(e, {key: 'shield', shield: 200});
  hit(f, e, 250); near(e.hp, 50); assert.equal(e.findBuff('cripple'), null);
  const nonfatal = f.hits.at(-1).hpFloor;
  assert.deepEqual([nonfatal.before, nonfatal.unflooredAmount, nonfatal.amount, nonfatal.lethal], [100, 50, 50, false]);
  assert.equal(Object.isFrozen(nonfatal), true);
  hit(f, e, 50); near(e.hp, 1); assert.ok(e.findBuff('cripple'));
  const fatal = f.hits.at(-1).hpFloor;
  assert.deepEqual([fatal.before, fatal.unflooredAmount, fatal.amount, fatal.lethal], [50, 50, 49, true]);
});

test('A shielded one-HP target is never fabricated into a lethal wound', () => {
  const f = make(), e = enemy(f, {hp: 1});
  f.b.addBuff(e, {key: 'shield', shield: 100}); hit(f, e, 50);
  assert.equal(e.hp, 1); assert.equal(e.findBuff('cripple'), null); assert.equal(f.hits.at(-1).hpFloor.lethal, false);
});

test('An accepted wound releases blockers, applies the original speed scale and prevents HP recovery', () => {
  const f = make(), e = enemy(f);
  Object.assign(e.base, {moveSpeed: 1, hpRecoveryPerSec: 20}); e.markDirty();
  e.blockedBy = f.u; f.u.blocking.push(e); hit(f, e);
  assert.equal(e.blockedBy, null); assert.equal(f.u.blocking.includes(e), false);
  near(e.s.moveSpeed, .2); near(e.s.hpRegen, 0);
  near(f.b.heal(f.u, e, 100), 0); near(f.b.heal(e, e, 100, {self: true}), 0);
  advance(f.b, 1); near(e.hp, 1);
});

test('Dodge, cancellation and gauge damage cannot create a wound; HP loss bypasses its floor', () => {
  const f = make(), a = enemy(f), z = enemy(f);
  f.b.addBuff(a, {key: 'dodge', mods: {dodgePhys: 1}}); hit(f, a, 200, {type: 'phys'});
  assert.equal(a.hp, 100); assert.equal(a.findBuff('cripple'), null);
  f.b.on('hit', c => { if (c.dmg.tags.includes('cancel')) c.dmg.cancel = true; });
  hit(f, z, 200, {tags: ['cancel']}); assert.equal(z.hp, 100);
  hit(f, z, 10, {type: 'element', element: 'erosion'}); assert.equal(z.findBuff('cripple'), null);
  f.b.loseHp(z, 200, {source: f.u}); assert.equal(z.alive, false); assert.equal(f.wounds.pending.size, 0);
});

test('Vetoed or dispelled owner talent cannot grant the floor or wounds', () => {
  for (const veto of [true, false]) {
    const f = make({defer: true});
    if (veto) f.b.on('beforeBuff', c => { if (c.buff.key === 'ju_t_1') c.cancel = true; });
    f.deploy(); if (!veto) f.b.removeBuff(f.u, 'ju_t_1');
    const e = enemy(f); hit(f, e); assert.equal(e.alive, false); assert.equal(f.wounds.pending.size, 0);
  }
});

test('Vetoed target wound preserves the accepted damage floor but creates no timers or flags', () => {
  const f = make(), e = enemy(f);
  f.b.on('beforeBuff', c => { if (c.buff.key === 'cripple') c.cancel = true; });
  hit(f, e); assert.equal(e.hp, 1); assert.equal(e.findBuff('cripple'), null);
  assert.equal(f.wounds.pending.size, 0); assert.equal(f.wounds.watchers.length, 0);
});

test('Wound expires after ten world seconds without credit or SP for its source', () => {
  const f = make(), e = enemy(f); hit(f, e); advance(f.b, 9.9); assert.equal(e.alive, true);
  advance(f.b, .2); assert.equal(e.alive, false); assert.equal(f.wounds.pending.size, 0);
  assert.equal(f.wounds.watchers.length, 0); assert.equal(e.findBuff('cripple'), null);
});

test('Existing wounds retain their timer and source, and do not refresh from repeated damage', () => {
  const f = make(), e = enemy(f); hit(f, e); const p = f.wounds.pending.get(e);
  advance(f.b, 9); hit(f, e); assert.equal(f.wounds.pending.get(e), p);
  advance(f.b, 1.1); assert.equal(e.alive, false); assert.equal(f.wounds.pending.size, 0);
});

test('Non-derived wounds and the real killer gift survive source withdrawal', () => {
  const f = make(), a = enemy(f), z = enemy(f), k = killer(f);
  hit(f, a); hit(f, z); f.b.retreat(f.u);
  assert.equal(f.wounds.stopped, true); assert.equal(f.wounds.handles.length, 0);
  assert.equal(f.wounds.pending.size, 2);
  f.b.dealDamage(k, a, {amount: 10, type: 'true'}); near(k.skill.spTotal, 2);
  advance(f.b, 10.1); assert.equal(z.alive, false); assert.equal(f.wounds.watchers.length, 0);
});

test('Native non-forced SP does not bypass the killer skill lock', () => {
  const f = make(), e = enemy(f), k = killer(f); hit(f, e);
  f.b.addBuff(k, {key: 'no-sp', flags: {noSp: true}});
  f.b.dealDamage(k, e, {amount: 10, type: 'true'}); near(k.skill.spTotal, 0);
});

test('A dispelled wound leaves no gift or pending timeout on its former target', () => {
  const f = make(), e = enemy(f), k = killer(f); hit(f, e);
  f.b.removeBuff(e, 'cripple'); assert.equal(f.wounds.pending.size, 0);
  f.b.kill(e, k); near(k.skill.spTotal, 0); advance(f.b, 10.1); assert.equal(f.wounds.watchers.length, 0);
});

test('A foreign replacement survives old wound cleanup and receives no old SP gift', () => {
  const f = make(), e = enemy(f), k = killer(f); hit(f, e);
  const foreign = f.b.addBuff(e, {key: 'cripple', source: k, duration: 30});
  advance(f.b, .1); assert.equal(e.findBuff('cripple'), foreign); assert.equal(f.wounds.pending.size, 0);
  f.b.kill(e, k); near(k.skill.spTotal, .1); // only ordinary natural SP during the two ticks
});

test('A replacement target life never inherits the old wound timer or gift', () => {
  const f = make(), e = enemy(f), k = killer(f); hit(f, e);
  e.deploySeq++; e.hp = 100; advance(f.b, .1);
  assert.equal(e.findBuff('cripple'), null); assert.equal(f.wounds.pending.size, 0);
  advance(f.b, 10.1); assert.equal(e.alive, true); assert.equal(f.wounds.watchers.length, 0);
  assert.ok(k.skill.spTotal < 20);
});

test('A life replacement during target admission cleans the late owned mark', () => {
  const f = make(), e = enemy(f);
  f.b.on('beforeBuff', c => { if (c.unit === e && c.buff.key === 'cripple') e.deploySeq++; });
  hit(f, e); assert.equal(e.findBuff('cripple'), null); assert.equal(f.wounds.pending.size, 0);
  assert.equal(f.wounds.watchers.length, 0);
});

test('Reentrant target admission cannot create multiple marks or orphan listeners', () => {
  const f = make(), e = enemy(f); let entered = false;
  f.b.on('beforeBuff', c => { if (!entered && c.buff.key === 'cripple') { entered = true; hit(f, e); } });
  hit(f, e); assert.equal(e.buffs.filter(b => b.key === 'cripple').length, 1);
  assert.equal(f.wounds.pending.size, 1); advance(f.b, 10.1); assert.equal(f.wounds.watchers.length, 0);
});

test('Retirement during admission does not cancel an already accepted non-derived wound', () => {
  const f = make(), e = enemy(f);
  f.b.on('beforeBuff', c => { if (c.buff.key === 'cripple') f.b.retreat(f.u); });
  hit(f, e); assert.equal(f.wounds.stopped, true); assert.ok(e.findBuff('cripple'));
  advance(f.b, 10.1); assert.equal(e.alive, false); assert.equal(f.wounds.watchers.length, 0);
});

test('A hidden enemy skips timeout killing but loses the wound; appearance before expiry kills sourcelessly', () => {
  for (const before of [true, false]) {
    const f = make(), e = enemy(f), k = killer(f); hit(f, e); e.hidden = true;
    if (before) { advance(f.b, 2); f.b.emit('enemyBeforeAppear', {enemy: e}); assert.equal(e.alive, false); }
    else { advance(f.b, 10.1); assert.equal(e.alive, true); assert.equal(e.findBuff('cripple'), null); f.b.emit('enemyBeforeAppear', {enemy: e}); assert.equal(e.alive, true); }
    assert.equal(f.wounds.pending.size, 0); assert.equal(f.wounds.watchers.length, 0);
  }
});

test('Battle end drains independent wounds after the source has retired', () => {
  const f = make(), e = enemy(f); hit(f, e); f.b.retreat(f.u);
  f.b.finished = true; f.b.emit('battleEnd', {});
  assert.equal(e.findBuff('cripple'), null); assert.equal(f.wounds.pending.size, 0);
  assert.equal(f.wounds.watchers.length, 0);
});

for (const phase of ['outputDamage', 'hit', 'damageFinal', 'calculatedDamage'])
  test(`A recipient replaced during ${phase} cannot inherit the old damage or wound`, () => {
    const f = make(), e = enemy(f);
    f.b.on(phase, c => { if (c.target === e) { e.deploySeq++; e.hp = 100; } });
    assert.equal(hit(f, e), 0);
    assert.equal(e.hp, 100); assert.equal(e.stats.taken, 0);
    assert.equal(e.findBuff('cripple'), null); assert.equal(f.wounds.pending.size, 0);
  });

test('A target mark created and removed during admission cannot leave a late owned child', () => {
  const f = make(), e = enemy(f); let entered = false;
  f.b.on('beforeBuff', c => {
    if (entered || c.buff.key !== 'cripple') return;
    entered = true; const child = f.b.addBuff(e, {...c.buff}); f.b.removeBuff(e, child);
  });
  hit(f, e); assert.equal(e.findBuff('cripple'), null);
  assert.equal(f.wounds.pending.size, 0); assert.equal(f.wounds.watchers.length, 0);
});

test('An independently inserted owner marker cannot be adopted as Ju talent admission', () => {
  const f = make({defer: true}); let entered = false;
  f.b.on('beforeBuff', c => {
    if (entered || c.unit !== f.u || c.buff.key !== 'ju_t_1') return;
    entered = true; f.b.addBuff(f.u, {key: 'ju_t_1', data: {foreign: true}});
  });
  f.deploy(); const foreign = f.u.findBuff('ju_t_1'), e = enemy(f);
  hit(f, e); assert.equal(e.alive, false); f.wounds.stop();
  assert.equal(f.u.findBuff('ju_t_1'), foreign);
});
test('real Ju wound expiry uses the native non-skipping kill and lets a paired twin enter rebirth',()=>{
 const f=make(),rooms=[],cores=[];for(const[key,col]of [['enemy_1591_mutwin',7],['enemy_1591_mutwin_2',10]]){
  const e=f.b.spawnEnemy(key,{pos:[5,col],def:canonical.enemies[key].levels[0]});cores.push(installChapter17MutwinCore(f.b,e,{finishRoom:r=>rooms.push(r)}));
 }
 const e=cores[0].lifecycle.owner;hit(f,e,1e6);assert.equal(e.hp,1);assert.ok(e.findBuff('cripple'));assert.ok(!e.s.flags.disarm);assert.equal(cores[0].lifecycle.phase,'active');
 advance(f.b,f.record.talentBb[0].interval+.2);assert.ok(e.alive);assert.equal(cores[0].lifecycle.phase,'fake');assert.equal(e.hp,1000);assert.equal(e.findBuff('cripple'),null);
 assert.equal(f.wounds.pending.size,0);assert.equal(f.wounds.watchers.length,0);assert.ok(e.stats.attacks>0);assert.equal(f.u.stats.kills,0);assert.equal(f.b.killed,0);assert.equal(rooms.length,0);assert.deepEqual(f.b.errors,[]);
});
test('Ju native DISABLE_COMBAT prevents blocking independently of ordinary unblockable immunity',()=>{
 const f=make(),e=enemy(f),k=killer(f);e.blockedBy=k;k.blocking.push(e);f.b.addBuff(e,{key:'fixture-immunity',data:{nativeUnblockableImmune:true}});
 hit(f,e);assert.equal(e.blockedBy,null);assert.ok(e.s.flags.noCombat);assert.equal(e.s.flags.unblockable,false);assert.equal(f.b._checkBlock(e),false);assert.ok(e.findBuff('cripple'));assert.deepEqual(f.b.errors,[]);
});
