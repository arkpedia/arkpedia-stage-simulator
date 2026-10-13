// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-marcil-prefabs.json' with { type: 'json' };
import { MARCIL_ID as ID } from '../server/sim/content/arkpedia-marcil-source.js';
import { MARCIL_ATTACK_CONTRACT as CONTRACT, prepareMarcilAttacks, verifyMarcilAttackSource }
  from '../server/sim/content/arkpedia-marcil-attacks.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { make, advance, until, born, enemy, ally, cast } from './helpers/marcil-fixture.js';
function beginManual(f) { born(f); return f.u.skill.activate('manual'); }
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);

test('native abilities and animation events are required; complete public kit stays held', () => {
  verifyMarcilAttackSource(); assert.equal(CONTRACT.frameParity, false);
  assert.deepEqual(evidence.enabledOperators, []); assert.equal(data.operators[ID], undefined);
  assert.throws(() => make({ contract: { ...CONTRACT } }), /explicit combat contract/);
  for (const mutate of [d => d.stats.atk++, d => d.skill.bb.sp_cost++, d => d.rangeGrid = [[0, 99]],
    d => d.tags = [], d => d.talents[0].bb.atk++, d => d.raw.arkpedia.module = 'unsupported'])
    assert.throws(() => make({ mutate }), /Incomplete|Invalid Marcille source build/);
  const f = make(); assert.throws(() => f.controller.install(), /already installed/);
  assert.throws(() => prepareMarcilAttacks(f.b, f.u, { contract: CONTRACT }), /fresh original owner/);
  for (const skill of [2, 3]) {
    const g = make({ skill }); enemy(g); until(g, () => g.hits.length > 0);
    assert.equal(g.u.skill.activate('manual'), false); assert.equal(g.hits[0].dmg.isSkill, false);
  }
});

test('ordinary attacks wait for original Start and OnAttack and do not spend mana', () => {
  const f = make(), a = enemy(f), z = enemy(f, { row: 5.7 });
  assert.equal(f.u.mem.regularFormVisual.clip, 'Start'); advance(f, .95);
  assert.equal(f.hits.length, 0); assert.equal(f.u.stats.attacks, 0);
  until(f, () => f.controller.phase?.kind === 'attack'); const started = f.b.time, p = f.controller.phase;
  assert.equal(f.u.mem.regularFormVisual.clip, 'Attack'); near(p.releaseAt - started, .5 - f.b.dt);
  const mana = f.wallet.value, atk = f.u.s.atk, play = f.u.mem.regularFormVisual.playId;
  advance(f, .4); assert.equal(f.hits.length, 0);
  until(f, () => f.outputs.length === 1);
  assert.equal(f.hits.length, 2); assert.equal(f.attacks.length, 1);
  assert.ok(f.hits.some(x => x.target === a)); assert.ok(f.hits.some(x => x.target === z));
  for (const h of f.hits) { near(h.hpLoss, atk); assert.equal(h.dmg.type, 'arts');
    assert.equal(h.dmg.isSplash, true); assert.equal(h.dmg.isSkill, false); }
  assert.equal(f.hits[0].dmg.attackId, f.hits[1].dmg.attackId);
  assert.equal(f.wallet.value, mana); assert.equal(f.b.projectiles.list.length, 0);
  assert.equal(f.controller.output(a, { attackId: 999 }), false);
  until(f, () => f.outputs.length === 2);
  assert.notEqual(f.u.mem.regularFormVisual.playId, play);
  near(f.outputs[1].time - f.outputs[0].time, f.u.s.interval);
});

test('mana enlarges the source circle from 1.1 to 1.5, without enlarging primary selection', () => {
  for (const mana of [0, .5, 1, 50]) {
    const f = make(); f.u.skill.setSpTotal(mana); const a = enemy(f);
    const z = enemy(f, { col: 8.3 });
    // Secondary is outside primary range; choose a stable captured input.
    until(f, () => f.controller.phase?.kind === 'attack'); assert.equal(f.controller.phase.target, a);
    until(f, () => f.outputs.length === 1);
    assert.equal(f.hits.some(h => h.target === z), mana >= 1);
    near(f.outputs[0].radius, mana >= 1 ? 1.5 : 1.100000023841858);
    near(f.hits[0].hpLoss, f.u.base.atk * (mana >= 1 ? 1 + f.record.talentBb[0].atk : 1));
    assert.equal(f.wallet.value, mana);
  }
  const f = make(); enemy(f, { col: 10 }); advance(f, 5); assert.equal(f.hits.length, 0);
});

test('primary selectors reject sleep, stealth and camouflage; legal splash can hit aerial and camouflaged secondaries', () => {
  const f = make(); enemy(f, { flags: { stealth: true } }); enemy(f, { flags: { camou: true } });
  const sleeper = enemy(f); f.b.applyStatus(sleeper, 'sleep', { duration: 99 });
  advance(f, 5); assert.equal(f.hits.length, 0);
  const g = make(), main = enemy(g), fly = enemy(g, { row: 5.5, fly: true });
  const camo = enemy(g, { row: 5.6, flags: { camou: true } });
  const stealth = enemy(g, { row: 5.7, flags: { stealth: true } });
  const sleeping = enemy(g, { row: 5.8 }); g.b.applyStatus(sleeping, 'sleep', { duration: 99 });
  until(g, () => g.outputs.length === 1);
  for (const t of [main, fly, camo]) assert.ok(g.hits.some(x => x.target === t));
  for (const t of [stealth, sleeping]) assert.equal(g.hits.some(x => x.target === t), false);
  const h = make(); enemy(h, { fly: true }); until(h, () => h.outputs.length === 1);
});

test('four facings rotate the primary range and select original Front/Back attack clips', () => {
  for (const [dir, row, col, face] of [['RIGHT', 5, 7, 'Front'], ['UP', 6, 6, 'Back'],
    ['LEFT', 5, 5, 'Back'], ['DOWN', 4, 6, 'Front']]) {
    const f = make({ dir }), t = enemy(f, { row, col }); until(f, () => f.outputs.length === 1);
    assert.equal(f.hits[0].target, t); assert.equal(f.controller.model(), evidence.models[ID][face]);
    assert.equal(f.u.mem.regularVisualDirection, face === 'Back' ? 'UP' : 'RIGHT');
    assert.equal(f.u.mem.regularDeathVisual?.clip, face === 'Front' ? 'Die' : undefined);
  }
});

test('native maxAnimScale one caps fast events; slow attacks stretch captured event and full clip', () => {
  for (const [aspd, speed] of [[200, 1], [-50, .5]]) {
    const f = make(); enemy(f); f.b.addBuff(f.u, { key: 'fixture:speed', mods: { aspd } });
    until(f, () => f.controller.phase?.kind === 'attack'); const p = f.controller.phase;
    near(p.speed, speed); const origin = f.b.time - f.b.dt;
    near(p.releaseAt - origin, .5 / speed);
    near(p.readyAt - origin, Math.max(f.u.s.interval, 2 / speed));
    until(f, () => f.outputs.length === 1);
  }
});

test('original retained damage input samples its final position, including a dead input, without crossing life epochs', () => {
  for (const action of ['dead', 'move', 'new-life']) {
    const f = make(), main = enemy(f), z = enemy(f, { row: 5.7 });
    until(f, () => f.controller.phase?.kind === 'attack'); assert.equal(f.controller.phase.target, main);
    if (action === 'dead') f.b.kill(main);
    if (action === 'move') { main.x = 11; main.y = 5; z.x = 11.5; z.y = 5; f.b._buildEnemyIndex(); }
    if (action === 'new-life') main.deploySeq++;
    advance(f, .6);
    assert.equal(f.hits.some(h => h.target === z), action !== 'new-life');
    assert.equal(f.outputs.length, action === 'new-life' ? 0 : 1);
  }
});

for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank} chants before its ATK buff and spends once for a complete splash group`, () => {
  const f = make({ rank }); enemy(f); enemy(f, { row: 5.7 });
  const ordinary = f.u.s.atk, mana = f.wallet.value;
  assert.equal(beginManual(f), true);
  assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1_Begin'); near(f.u.s.atk, ordinary);
  assert.equal(f.u.skill.end('manual'), false); assert.equal(f.u.skill.active, false);
  advance(f, .4); assert.equal(f.u.mem.regularFormVisual.clip, 'Skill_1_Chant');
  assert.equal(f.outputs.length, 0); near(f.u.s.atk, ordinary);
  until(f, () => f.controller.mode === 's1', 10);
  near(f.u.s.atk, f.u.base.atk * (1 + f.record.bb.atk + f.record.talentBb[0].atk));
  assert.equal(f.wallet.value, mana); assert.equal(f.u.skill.gainSp(99, 'gift'), 0);
  until(f, () => f.outputs.length === 1);
  assert.equal(f.outputs[0].skill, true); assert.equal(f.hits.length, 2);
  assert.equal(f.attacks[0].isSkill, true); assert.equal(f.wallet.value, mana - f.record.bb.sp_cost);
  for (const h of f.hits) near(h.hpLoss, f.outputs[0].amount);
  assert.equal(f.u.skill.activations, 1); assert.equal(f.u.skill.active, true);
});

test('the last legal S1 output keeps full captured ATK and circle before ending at zero mana', () => {
  const f = make(); f.u.skill.setSpTotal(2); cast(f); enemy(f); const z = enemy(f, { col: 8.3 });
  const atk = f.u.s.atk; until(f, () => f.outputs.length === 1);
  near(f.outputs[0].amount, atk); assert.ok(f.hits.some(h => h.target === z));
  assert.equal(f.wallet.value, 0); assert.equal(f.u.skill.active, false);
  assert.equal(f.u.findBuff('marcil:s1'), null); near(f.u.s.atk, f.u.base.atk);
  until(f, () => f.outputs.length === 2); assert.equal(f.outputs[1].skill, false);
  near(f.outputs[1].radius, 1.100000023841858);
});

test('S1 denies sub-minimum mana instead of starting and then interrupting a cast', () => {
  for (const mana of [0,1,1.99]) {
    const f=make(); born(f); f.u.skill.setSpTotal(mana);
    assert.equal(skillHud(f.u.skill).ready,false); assert.equal(skillHud(f.u.skill).canActivate,false);
    assert.equal(f.u.skill.activate('manual'),false); advance(f,2);
    assert.equal(f.u.skill.active,false); assert.equal(f.wallet.value,mana);
    assert.equal(f.u.skill.activations,0); assert.equal(f.outputs.length,0);
  }
});

test('S1 chooses enemies before healing; fallback is one injured ally, including self', () => {
  const f = make(), a = ally(f); cast(f); const t = enemy(f);
  until(f, () => f.outputs.length === 1); assert.equal(f.outputs[0].heal, false);
  assert.equal(f.hits[0].target, t); assert.equal(f.heals.length, 0);
  f.b.kill(t); until(f, () => f.outputs.some(x => x.heal), 6);
  assert.equal(f.heals.length, 1); assert.equal(f.heals[0].target, a);
  const g = make(); g.u.hp = g.u.s.maxHp * .1; cast(g);
  until(g, () => g.outputs.length === 1); assert.equal(g.outputs[0].heal, true);
  assert.equal(g.heals[0].target, g.u);
});

test('healing snapshots one recipient, uses ATK and normal heal modifiers, and debits one output cost', () => {
  const f = make(), a = ally(f); cast(f);
  f.b.addBuff(f.u, { key: 'fixture:healing', mods: { healingDealtMul: .5 } });
  until(f, () => f.controller.phase?.kind === 'attack'); assert.equal(f.controller.phase.target, a);
  enemy(f); const mana = f.wallet.value, before = a.hp, atk = f.u.s.atk;
  until(f, () => f.outputs.length === 1);
  assert.equal(f.outputs[0].heal, true); assert.equal(f.hits.length, 0);
  near(a.hp - before, Math.min(atk * .5, a.s.maxHp - before));
  assert.equal(f.wallet.value, mana - 2); assert.equal(f.attacks.length, 1);
});

test('healing rejects full HP, devices, isolation, noHeal, healFree and untargetability', () => {
  for (const opts of [{ ratio: 1 }, { kind: 'device' }, { flags: { isolated: true } },
    { flags: { noHeal: true } }, { flags: { healFree: true } }, { flags: { untargetable: true } }]) {
    const f = make(); ally(f, opts); cast(f); advance(f, 4);
    assert.equal(f.outputs.length, 0); assert.equal(f.wallet.value, 50);
  }
});

test('a lost healing input or cancelled attack cannot spend mana or retarget a new ally', () => {
  for (const action of ['dead', 'hidden', 'new-life', 'targets', 'retreat', 'cancel']) {
    const f = make(), a = ally(f); cast(f);
    until(f, () => f.controller.phase?.kind === 'attack'); const mana = f.wallet.value;
    if (action === 'dead') f.b.kill(a);
    if (action === 'hidden') a.hidden = true;
    if (action === 'new-life') a.deploySeq++;
    if (['targets', 'retreat', 'cancel'].includes(action)) f.b.on('beforeAttack', ctx => {
      if (ctx.attacker !== f.u) return;
      if (action === 'targets') ctx.targets = [];
      if (action === 'retreat') f.b.retreat(f.u, { permanent: true });
      if (action === 'cancel') f.u.skill.end('manual');
    });
    advance(f, .6); assert.equal(f.outputs.length, 0); assert.equal(f.heals.length, 0);
    assert.equal(f.wallet.value, mana); assert.equal(f.attacks.length, 0);
  }
});

test('empty or hook-cancelled damage groups spend nothing and retirement cancels pending ordinary attacks', () => {
  for (const action of ['hidden', 'new-life', 'targets', 'retreat', 'cancel']) {
    const f = make(); cast(f); const t = enemy(f);
    until(f, () => f.controller.phase?.kind === 'attack'); const mana = f.wallet.value;
    if (action === 'hidden') t.hidden = true;
    if (action === 'new-life') t.deploySeq++;
    if (['targets', 'retreat', 'cancel'].includes(action)) f.b.on('beforeAttack', ctx => {
      if (ctx.attacker !== f.u) return;
      if (action === 'targets') ctx.targets = [];
      if (action === 'retreat') f.b.retreat(f.u, { permanent: true });
      if (action === 'cancel') f.u.skill.end('manual');
    });
    advance(f, .6); assert.equal(f.outputs.length, 0); assert.equal(f.hits.length, 0);
    assert.equal(f.wallet.value, mana); assert.equal(f.attacks.length, 0);
  }
});

test('brief control invalidates a windup or chant; silence preserves source-unsilenceable S1', () => {
  for (const mode of ['ordinary', 'chant', 's1']) {
    const f = make(); enemy(f);
    if (mode === 'chant') assert.equal(beginManual(f), true);
    else { if (mode === 's1') cast(f); until(f, () => f.controller.phase?.kind === 'attack'); }
    f.b.applyStatus(f.u, 'stun', { duration: f.b.dt }); advance(f, .1);
    assert.equal(f.hits.length, 0); assert.equal(f.u.skill.active, false);
    assert.equal(f.u.findBuff('marcil:s1'), null); assert.equal(f.wallet.value, 50);
    until(f, () => f.outputs.length === 1);
    assert.equal(f.outputs[0].skill, false);
  }
  const f = make(); f.b.applyStatus(f.u, 'silence', { duration: 10 }); cast(f); enemy(f);
  until(f, () => f.outputs.length === 1); assert.equal(f.outputs[0].skill, true);
});

test('manual command and HUD allow running cancellation, without allowing chant cancellation or spending more mana', () => {
  const f = make(); born(f); f.b.bench[ID] = { unit: f.u };
  assert.equal(f.b.activateOperator(ID), true); assert.equal(skillHud(f.u.skill).canCancel, false);
  assert.equal(f.b.activateOperator(ID), false);
  until(f, () => f.controller.mode === 's1'); assert.equal(skillHud(f.u.skill).canCancel, true);
  assert.equal(f.b.activateOperator(ID), true); assert.equal(f.wallet.value, 50);
  assert.equal(f.u.skill.active, false); assert.equal(f.u.skill.activations, 1);
  assert.equal(skillHud(f.u.skill).ready, true);
});

test('real Senshi meal recovers mana during a pending chant but is locked by active S1', () => {
  for (const phase of ['chant', 's1']) {
    const f = make(), senshi = f.b.deployOperator('char_4143_sensi', 5, 5, 'RIGHT');
    senshi.atkCd = 1000; senshi.skill.rule = 'NEVER';
    senshi.skill.setSpTotal(senshi.skill.spCost); assert.equal(senshi.skill.activate('fixture'), true);
    advance(f, phase === 'chant' ? 8.9 : 6.5);
    assert.equal(beginManual(f), true);
    until(f, () => f.b.time >= 9.4); assert.equal(f.wallet.value, phase === 'chant' ? 60 : 50);
    assert.equal(f.controller.mode, phase);
  }
});

test('battle end clears active modifiers, wrappers, hooks and future output', () => {
  const f = make(); cast(f); enemy(f);
  until(f, () => f.controller.phase?.kind === 'attack'); const activate = f.u.skill.activate;
  f.b.forceEnd('fixture'); assert.equal(f.controller.stopped, true);
  assert.equal(f.u.skill.active, false); assert.equal(f.u.findBuff('marcil:s1'), null);
  assert.equal(f.u.findBuff('marcil:mana-atk'), null); assert.equal(f.controller.handles.length, 0);
  assert.notEqual(f.u.skill.activate, activate); advance(f, 10);
  assert.equal(f.outputs.length, 0); assert.equal(f.wallet.closed, true);
});

test('retired controllers cannot cast or consume against a fresh deployment that keeps its mana', () => {
  const f = make(); cast(f); enemy(f); until(f, () => f.controller.phase?.kind === 'attack');
  const bound = f.u.skill.activate; f.b.retreat(f.u, { permanent: true });
  assert.equal(f.controller.stopped, true); assert.equal(f.u.skill.active, false);
  advance(f, 1.05); const next = f.create(); assert.equal(next.wallet, f.wallet);
  const value = f.wallet.value; assert.equal(bound('manual'), false);
  assert.equal(f.mana.controller.consume(2), false); assert.equal(f.wallet.value, value);
  assert.equal(f.outputs.length, 0); assert.equal(next.u.skill.spTotal, value);
});

test('retirement inside S1 buff application leaves no ghost modifier', () => {
  const f = make(); f.b.on('beforeBuff', x => {
    if (x.unit === f.u && x.buff?.key === 'marcil:s1') f.b.retreat(f.u, { permanent: true });
  });
  assert.equal(beginManual(f), true); advance(f, 3);
  assert.equal(f.u.alive, false); assert.equal(f.u.findBuff('marcil:s1'), null);
  assert.equal(f.controller.handles.length, 0); assert.equal(f.outputs.length, 0);
});

test('all selected ordinary skill ranks preserve source stats, including low-elite mana talent', () => {
  for (const [skill, elite, cap] of [[1, 0, 4], [1, 1, 7], [2, 1, 7], [2, 2, 10], [3, 2, 10]])
    for (let rank = 1; rank <= cap; rank++) {
      const f = make({ skill, elite, rank, potential: 3 }); enemy(f);
      until(f, () => f.outputs.length === 1);
      near(f.outputs[0].amount, f.record.stats.atk * (1 + f.record.talentBb[0].atk));
      assert.equal(f.wallet.value, f.record.mana.initial); assert.equal(f.outputs[0].skill, false);
    }
});

test('S1 keeps Start during birth, then activates with only its selected minimum', () => {
  const f=make(); enemy(f); f.u.skill.setSpTotal(2);
  assert.equal(f.controller.phase.kind,'born'); assert.equal(f.u.skill.activate('manual'),false);
  assert.equal(f.u.mem.regularFormVisual.clip,'Start'); assert.equal(skillHud(f.u.skill).ready,false);
  advance(f,.9); assert.equal(f.u.skill.activate('manual'),false); assert.equal(f.outputs.length,0);
  born(f); assert.equal(f.u.skill.activate('manual'),true);
  until(f,()=>f.outputs.length===1); assert.equal(f.outputs[0].skill,true); assert.equal(f.wallet.value,0);
});

test('damage mitigation does not charge once per victim; owner retirement during an output stops later victims', () => {
  const f = make(); cast(f); const a = enemy(f), z = enemy(f, { row: 5.6 }), last = enemy(f, { row: 5.7 });
  f.b.addBuff(a, { key: 'fixture:invuln', flags: { invulnerable: true } });
  f.b.on('damaged', x => { if (x.source === f.u) f.b.retreat(f.u, { permanent: true }); });
  until(f, () => f.outputs.length === 1);
  assert.equal(f.wallet.value, 48); assert.equal(f.controller.stopped, true);
  assert.equal(f.u.findBuff('marcil:s1'), null); assert.ok(z.hp < z.s.maxHp);
  assert.equal(a.hp, a.s.maxHp); assert.equal(last.hp, last.s.maxHp);
  advance(f, .1); assert.equal(f.outputs.length, 1); assert.equal(f.wallet.value, 48);
});

test('canceling within the S1 ATK modifier callback cannot install a stale modifier', () => {
  const f = make(); f.b.on('beforeBuff', x => {
    if (x.unit === f.u && x.buff?.key === 'marcil:s1') f.u.skill.end('manual');
  });
  assert.equal(beginManual(f), true); advance(f, 3);
  assert.equal(f.u.skill.active, false); assert.equal(f.u.findBuff('marcil:s1'), null);
  near(f.u.s.atk, f.u.base.atk * (1 + f.record.talentBb[0].atk));
  assert.equal(f.outputs.length, 0);
});

test('source resource readiness does not invent readiness for existing coin and ammunition descriptors', () => {
  for (const resource of [{ label: 'Coins', current: 5, maximum: 9 },
    { label: 'Ammo', current: 0, maximum: 8, ending: true }]) {
    const hud = skillHud({ castEligible: true, spec: { resourceGauge: () => resource } });
    assert.equal(hud.ready, false); assert.equal(hud.canActivate, false); assert.equal(hud.state, 'active');
  }
  const f = make(); f.b.applyStatus(f.u, 'stun', { duration: 1 });
  assert.equal(skillHud(f.u.skill).ready, false); assert.equal(f.u.skill.activate('manual'), false);
  advance(f, 1.1); assert.equal(skillHud(f.u.skill).ready, true);
});

test('S1’s original periodic mana check also ends an idle skill without manufacturing an output', () => {
  const f = make(); cast(f); const at = f.b.time;
  assert.equal(f.mana.controller.consume(49), true); advance(f, .4);
  assert.equal(f.u.skill.active, true);
  until(f, () => !f.u.skill.active, 1);
  assert.ok(f.b.time - at <= .5 + f.b.dt);
  assert.equal(f.wallet.value, 1); assert.equal(f.outputs.length, 0);
  assert.equal(f.u.findBuff('marcil:s1'), null);
});

test('temporary owner hiding discards pending ordinary/S1 attacks and interrupts an unfinished chant', () => {
  for (const mode of ['ordinary', 'chant', 's1']) {
    const f = make(); enemy(f);
    if (mode === 'chant') assert.equal(beginManual(f), true);
    else { if (mode === 's1') cast(f); until(f, () => f.controller.phase?.kind === 'attack'); }
    f.u.hidden = true; advance(f, 1); assert.equal(f.outputs.length, 0); assert.equal(f.controller.phase, null);
    f.u.hidden = false; advance(f, .1); assert.equal(f.outputs.length, 0);
    assert.equal(f.u.skill.active, mode === 's1');
    until(f, () => f.outputs.length === 1); assert.equal(f.outputs[0].skill, mode === 's1');
  }
});
