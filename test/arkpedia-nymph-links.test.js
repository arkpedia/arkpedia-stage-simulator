// SPDX-License-Identifier: GPL-3.0-or-later
// Source-fed real-engine fixtures bypass public builds and the S2 cast
// controller. No fixture chooses one of its two original OnAttack events.
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-nymph-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { sourceCandidate } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { NymphCombatLinks, NYMPH_ID, selectedNymphBlackboard }
  from '../server/sim/content/arkpedia-nymph-links.js';

const near = (a, z, epsilon = 1e-5) => assert.ok(Math.abs(a - z) < epsilon, `${a} != ${z}`);
const advance = (b, seconds) => {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
};
function make({ skill = 1, rank = 10, elite = 2, potential = 1, dir = 'RIGHT' } = {}) {
  const src = structuredClone(data);
  src.stage.geometry.waves[0].spawns = []; src.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(src, { operators: [defaultBuild(src.operators.char_289_gyuki)] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  const c = evidence.tables.character, phase = c.phases[elite], id = `skchr_nymph_${skill}`;
  const build = { elite, level: phase.maxLevel, potential, skillRank: rank, skillId: id };
  const level = evidence.tables.skills[id].levels[rank - 1];
  const def = normalizeChess({ chessId: NYMPH_ID, charId: NYMPH_ID, name: c.name,
    profession: c.profession, subProfessionId: c.subProfessionId, position: c.position,
    stats: phase.attributesKeyFrames.at(-1).data,
    rangeGrid: evidence.tables.ranges[phase.rangeId].grids.map(p => [p.row, p.col]),
    talents: c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean),
    skill: { ...level, ...level.spData, skillId: id, bb: selectedNymphBlackboard(skill, rank),
      trigger: { rule: 'NEVER' } }, arkpedia: build });
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 1, 4, { dir });
  b._setupUnit(u, { trait: { noAttack: true }, skill: { id, kind: 'duration', duration: 100 } });
  assert.equal(b._deploy(u, { initial: false }), true);
  const links = new NymphCombatLinks(b, u), hits = [];
  b.on('damaged', ctx => hits.push({ ...ctx, time: b.time }));
  return { b, u, links, hits, selected: def.skill.bb };
}
function enemy(b, { x = 5, y = 1, res = 0, fly = false } = {}) {
  const e = b.spawnEnemy('enemy_1007_slime', { pos: [0, 0] });
  e.x = x; e.y = y; Object.assign(e.base, { maxHp: 1e7, def: 0, res, moveSpeed: 0 });
  if (fly) e.motion = 'FLY'; e.markDirty(); void e.s; e.hp = 1e7;
  Object.defineProperty(e, 'gaugeMax', { value: 1e7, configurable: true });
  b.addBuff(e, { key: 'fixture:pin', flags: { noMove: true, disarm: true } });
  b._buildEnemyIndex(); return e;
}
const dark = (b, e, duration = 10) => b.addBuff(e,
  { key: 'apoptosisBurst', duration, flags: { burstLock: true } });
const tagHits = (f, suffix) => f.hits.filter(h => h.dmg?.tags.includes(`nymph:${suffix}`));
const active = f => { f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate('fixture'), true); };

test('all thirty rank blackboards are retained exactly; invalid selections do not get defaults', () => {
  for (const skill of [1, 2, 3]) for (let rank = 1; rank <= 10; rank++)
    assert.deepEqual(selectedNymphBlackboard(skill, rank), Object.fromEntries(
      evidence.tables.skills[`skchr_nymph_${skill}`].levels[rank - 1].blackboard.map(r => [r.key, r.value])));
  for (const [s, r] of [[0, 1], [4, 1], [1, 0], [1, 11], [1, 1.5]])
    assert.throws(() => selectedNymphBlackboard(s, r));
});
test('ordinary impact is one Arts instance without trait injury, splash or fake skill/SP events', () => {
  const f = make(), e = enemy(f.b), other = enemy(f.b, { x: 5.1 });
  const sp = f.u.skill.spTotal;
  assert.equal(f.links.normalImpact(e, 'normal-1'), true);
  near(1e7 - e.hp, f.u.s.atk); near(other.hp, 1e7); near(e.elem.apoptosis, 0);
  assert.equal(tagHits(f, 'normal').length, 1); assert.equal(f.u.stats.attacks, 0);
  near(f.u.skill.spTotal, sp); assert.equal(f.u.skill.activations, 0);
});
test('Talent1 delays its first check, emits immediately after check, then once each second', () => {
  const f = make(), e = enemy(f.b); dark(f.b, e);
  f.links.normalImpact(e, 'talent-1'); near(tagHits(f, 'dot').length, 0);
  advance(f.b, .08); assert.equal(tagHits(f, 'dot').length, 0);
  advance(f.b, .04); assert.equal(tagHits(f, 'dot').length, 1);
  near(tagHits(f, 'dot')[0].amount, f.u.s.atk * .4);
  advance(f.b, .9); assert.equal(tagHits(f, 'dot').length, 1);
  advance(f.b, .1); assert.equal(tagHits(f, 'dot').length, 2);
});
test('listener samples Necrosis after damage; other elements and nonburst victims cannot start DoT', () => {
  for (const mode of ['none', 'burn', 'new-dark', 'removed-dark']) {
    const f = make(), e = enemy(f.b);
    if (mode === 'burn') f.b.addBuff(e, { key: 'burnBurst', duration: 10, flags: { burstLock: true } });
    if (mode === 'removed-dark') dark(f.b, e);
    f.links.normalImpact(e, mode);
    if (mode === 'new-dark') dark(f.b, e);
    if (mode === 'removed-dark') f.b.removeBuff(e, 'apoptosisBurst');
    advance(f.b, .2); assert.equal(tagHits(f, 'dot').length, mode === 'new-dark' ? 1 : 0);
  }
});
test('promotion Talent1 coefficients are exact and cannot become passive build ATK', () => {
  for (const [elite, scale] of [[0, 0], [1, .3], [2, .4]]) {
    const f = make({ elite }), e = enemy(f.b); dark(f.b, e);
    const atk = f.u.s.atk; f.links.normalImpact(e, `elite-${elite}`); advance(f.b, .2);
    near(f.u.s.atk, atk);
    if (scale) near(tagHits(f, 'dot')[0].amount, atk * scale);
    else assert.equal(tagHits(f, 'dot').length, 0);
  }
});
test('per-source DoTs coexist, read current ATK, and keep clocks through Silence/Stun', () => {
  const f = make(), e = enemy(f.b); dark(f.b, e);
  // Separate sources share one engine; same character identity is insufficient
  // to override the other source's enemy-owned damage effect.
  const z = f.b._makeAlly(f.b.getPlayer('arkpedia'), f.u.def, 'op', 2, 4, { dir: 'RIGHT' });
  f.b._setupUnit(z, { trait: { noAttack: true }, skill: { id: z.def.skill.id, kind: 'duration', duration: 100 } });
  assert.equal(f.b._deploy(z, { initial: false }), true);
  const other = new NymphCombatLinks(f.b, z);
  f.links.dot(e, .4); other.dot(e, .4); assert.equal(tagHits(f, 'dot').length, 2);
  f.b.addBuff(f.u, { key: 'boost', mods: { atkPct: .5 } });
  f.b.applyStatus(f.u, 'silence', { duration: 3 }); f.b.applyStatus(f.u, 'stun', { duration: 3 });
  // Tick hooks observe the start-of-step clock; execute the boundary tick too.
  advance(f.b, 1.04); const own = tagHits(f, 'dot').filter(h => h.source === f.u);
  assert.equal(own.length, 2); near(own[1].amount, f.u.s.atk * .4);
  f.b.retreat(f.u); advance(f.b, 1);
  assert.equal(f.links.entries.size, 0); assert.equal(other.entries.size, 1);
  assert.equal(tagHits(f, 'dot').filter(h => h.source === f.u).length, 2);
});
test('higher S2 priority pulses once on replacement; equal/weaker repeats preserve its next deadline', () => {
  const f = make({ skill: 2 }), e = enemy(f.b); dark(f.b, e);
  f.links.dot(e, .4); advance(f.b, .5);
  assert.equal(f.links.dot(e, 1), true); assert.equal(tagHits(f, 'dot').length, 2);
  const next = f.links.entries.get(e).next;
  assert.equal(f.links.dot(e, 1), false); assert.equal(f.links.dot(e, .4), false);
  near(f.links.entries.get(e).next, next); advance(f.b, .8);
  assert.equal(tagHits(f, 'dot').length, 2); advance(f.b, .24);
  assert.equal(tagHits(f, 'dot').length, 3); near(tagHits(f, 'dot').at(-1).amount, f.u.s.atk);
});
test('burst expiry/cleanse, target death and owner death/retreat clear old DoT without extra output', () => {
  for (const mode of ['expire', 'cleanse', 'victim-death', 'owner-death', 'retreat']) {
    const f = make(), e = enemy(f.b); dark(f.b, e, .5); f.links.dot(e, .4);
    if (mode === 'cleanse') f.b.removeBuff(e, 'apoptosisBurst');
    if (mode === 'victim-death') f.b.kill(e, null);
    if (mode === 'owner-death') f.b.kill(f.u, null);
    if (mode === 'retreat') f.b.retreat(f.u);
    advance(f.b, 1.2); assert.equal(tagHits(f, 'dot').length, 1);
    assert.equal(f.links.entries.size, 0); assert.equal(f.links.listeners.size, 0);
  }
});
test('listener deduplicates repeated damage and cannot recursively create extra DoT clocks', () => {
  const f = make(), e = enemy(f.b); dark(f.b, e);
  f.links.normalImpact(e, 'a'); f.links.normalImpact(e, 'b');
  assert.equal(f.links.listeners.size, 1); advance(f.b, 2.2);
  assert.equal(tagHits(f, 'dot').length, 3); assert.equal(f.links.entries.size, 1);
  assert.equal(f.links.listeners.size, 0);
});
test('Talent2 reacts to real Necrosis starts, not ordinary injury or sourceless credited burst ticks', () => {
  const f = make(), e = enemy(f.b), base = f.u.s.atk;
  Object.defineProperty(e, 'gaugeMax', { value: 1000, configurable: true });
  f.links.injury(e, 100, 'fixture'); assert.equal(f.links.stacks, 0);
  f.links.injury(e, 900, 'fixture'); assert.equal(f.links.stacks, 1); near(f.u.s.atk, base * 1.02);
  advance(f.b, 1.2); assert.equal(f.links.stacks, 1);
});
test('Talent2 range, promotion and potential cap are independent of burst initiator', () => {
  for (const [elite, potential, cap] of [[0, 1, 0], [1, 1, 0], [2, 1, 10], [2, 5, 12]]) {
    const f = make({ elite, potential }), e = enemy(f.b), far = enemy(f.b, { x: 11, y: 4 });
    const atk = f.u.s.atk;
    for (let i = 0; i < 14; i++) f.b.emit('elementBurst', { source: null, target: e, element: 'apoptosis' });
    assert.equal(f.links.stacks, cap); near(f.u.s.atk, atk * (1 + cap * .02));
    f.b.emit('elementBurst', { source: f.u, target: far, element: 'apoptosis' });
    f.b.emit('elementBurst', { source: f.u, target: e, element: 'burn' });
    assert.equal(f.links.stacks, cap);
  }
});
test('all S1 ranks derive injury from accepted Arts after RES, including shielded damage', () => {
  for (let rank = 1; rank <= 10; rank++) for (const shield of [false, true]) {
    const f = make({ rank }), e = enemy(f.b, { res: 50 }); active(f);
    if (shield) f.b.addBuff(e, { key: 'shield', shield: 1e7 });
    f.links.s1Impact(e, `s1-${rank}`, f.selected);
    near(e.elem.apoptosis, f.u.s.atk * .5 * f.selected['attack@ep_damage_ratio']);
    if (shield) near(e.hp, 1e7);
  }
});
test('S1 extra Elemental damage requires current S1 effect and a DARK burst, not merely any burst', () => {
  for (const mode of ['active-dark', 'inactive-dark', 'active-burn', 'ended-dark']) {
    const f = make(), e = enemy(f.b); if (mode !== 'inactive-dark') active(f);
    if (mode === 'active-burn') f.b.addBuff(e, { key: 'burnBurst', duration: 10, flags: { burstLock: true } });
    else dark(f.b, e);
    if (mode === 'ended-dark') f.u.skill.end('fixture');
    f.links.s1Impact(e, mode, f.selected);
    assert.equal(tagHits(f, 's1:extra').length, mode === 'active-dark' ? 1 : 0);
    near(e.elem.apoptosis, 0);
  }
});
test('all S2 ranks retain direct and splash as separate Arts/injury effects; only direct Fear applies', () => {
  for (let rank = 1; rank <= 10; rank++) {
    const f = make({ skill: 2, rank }), a = enemy(f.b), z = enemy(f.b, { x: 5.8 }), far = enemy(f.b, { x: 7 });
    f.links.s2Direct(a, `s2-${rank}`, f.selected);
    assert.ok(a.findBuff('fear')); near(a.findBuff('fear').timeLeft, f.selected.fear);
    assert.equal(z.findBuff('fear'), null);
    near(a.elem.apoptosis, f.u.s.atk * f.selected.atk_scale * f.selected.ep_damage_ratio);
    const victims = f.links.s2Stop(5, 1, `s2-${rank}`, f.selected);
    assert.equal(victims.length, 2);
    near(a.elem.apoptosis, f.u.s.atk * f.selected.atk_scale * f.selected.ep_damage_ratio * 2);
    near(z.elem.apoptosis, f.u.s.atk * f.selected.atk_scale * f.selected.ep_damage_ratio);
    near(far.hp, 1e7); assert.equal(z.findBuff('fear'), null);
  }
});
test('S2 splash samples stop-point bodies, including flyers and camouflage, excluding hidden/free enemies', () => {
  const f = make({ skill: 2 }), a = enemy(f.b), moved = enemy(f.b, { x: 5.2 }), fly = enemy(f.b, { x: 6, fly: true });
  const hidden = enemy(f.b), free = enemy(f.b), camo = enemy(f.b, { x: 5.3 });
  hidden.hidden = true; f.b.addBuff(free, { key: 'free', flags: { untargetable: true } });
  f.b.addBuff(camo, { key: 'camo', flags: { camou: true } });
  moved.x = 8; f.b._buildEnemyIndex();
  const targets = f.links.s2Stop(5, 1, 'stop', f.selected);
  assert.deepEqual(new Set(targets), new Set([a, fly, camo]));
  for (const e of [moved, hidden, free]) near(e.hp, 1e7);
});
test('S2 Fear respects immunity and resistance, misses cannot apply it; failed Arts can still upgrade existing DoT', () => {
  for (const mode of ['immune', 'resist', 'dodge', 'cancel']) {
    const f = make({ skill: 2 }), e = enemy(f.b); dark(f.b, e);
    if (mode === 'immune') e.def.immune.add('feared');
    if (mode === 'resist') f.b.applyStatus(e, 'resist', { duration: 10 });
    if (mode === 'dodge') f.b.addBuff(e, { key: 'dodge', mods: { dodgeArts: 1 } });
    if (mode === 'cancel') f.b.on('hit', c => { if (c.dmg.tags.includes('nymph:s2:direct')) c.dmg.cancel = true; });
    f.links.s2Direct(e, mode, f.selected);
    if (mode === 'resist') near(e.findBuff('fear').timeLeft, f.selected.fear / 2);
    else assert.equal(e.findBuff('fear'), null);
    assert.equal(tagHits(f, 'dot').length, 1); near(tagHits(f, 'dot')[0].amount, f.u.s.atk);
  }
});
test('all S3 ranks choose Arts or Elemental at impact using the current DARK state', () => {
  for (let rank = 1; rank <= 10; rank++) for (const burst of [false, true]) {
    const f = make({ skill: 3, rank }), e = enemy(f.b, { res: 90 });
    if (burst) dark(f.b, e);
    f.links.s3Impact(e, `s3-${rank}`, f.selected);
    near(1e7 - e.hp, f.u.s.atk * (burst ? f.selected['attack@split_atk_scale'] : .1));
    near(e.elem.apoptosis, 0);
    assert.equal(tagHits(f, 's3:elemental').length, burst ? 1 : 0);
  }
});
test('removal suppresses S2 source-alive branches but born ordinary/S3 impacts retain current ATK', () => {
  const f = make({ skill: 3 }), e = enemy(f.b); dark(f.b, e); f.b.retreat(f.u);
  const atk = f.u.s.atk; assert.equal(f.links.s2Direct(e, 'dead', selectedNymphBlackboard(2, 10)), false);
  assert.deepEqual(f.links.s2Stop(5, 1, 'dead', selectedNymphBlackboard(2, 10)), []);
  assert.equal(f.links.s3Impact(e, 'born', f.selected), true); near(1e7 - e.hp, atk);
  advance(f.b, 1); assert.equal(tagHits(f, 'dot').length, 0);
});
test('listeners reject unrelated sources and teardown is idempotent', () => {
  const f = make(), e = enemy(f.b); dark(f.b, e);
  f.b.dealDamage(null, e, { amount: 100, type: 'true', sourceless: true });
  advance(f.b, .2); assert.equal(tagHits(f, 'dot').length, 0);
  f.links.listen(e); f.links.stop(); f.links.stop(); advance(f.b, 2);
  assert.equal(f.links.listeners.size, 0); assert.equal(f.links.hooks.length, 0);
});
test('accepted original projectile births track one target and use current ATK at impact', () => {
  for (const mode of [0, 1, 3]) {
    const f = make({ skill: mode || 1 }), e = enemy(f.b, { x: 6 }), other = enemy(f.b, { x: 6.1 });
    if (mode === 1) active(f);
    assert.equal(f.links.launchAttack(e, 'born', mode, f.selected), true);
    assert.equal(f.b.projectiles.list.length, 1); near(e.hp, 1e7);
    f.b.addBuff(f.u, { key: 'late-atk', mods: { atkPct: .5 } });
    advance(f.b, .3); near(1e7 - e.hp, f.u.s.atk); near(other.hp, 1e7);
  }
});
test('born S3 samples burst at impact, including a state changed after emission', () => {
  for (const enters of [false, true]) {
    const f = make({ skill: 3 }), e = enemy(f.b, { x: 6 });
    if (!enters) dark(f.b, e);
    f.links.launchAttack(e, 'changed', 3, f.selected);
    if (enters) dark(f.b, e); else f.b.removeBuff(e, 'apoptosisBurst');
    advance(f.b, .3);
    assert.equal(tagHits(f, 's3:elemental').length, enters ? 1 : 0);
  }
});
test('S2 arrival has direct Fear/damage; a distinct delayed stop samples the fixed arrival centre', () => {
  const f = make({ skill: 2 }), a = enemy(f.b), z = enemy(f.b, { x: 5.8 });
  f.links.launchS2({ target: a, attackId: 's2-flight', selected: f.selected });
  advance(f.b, .12); assert.equal(tagHits(f, 's2:direct').length, 1);
  assert.ok(a.findBuff('fear')); assert.equal(tagHits(f, 's2:splash').length, 0);
  a.x = 8; z.x = 5; f.b._buildEnemyIndex();
  advance(f.b, .24); assert.equal(tagHits(f, 's2:splash').length, 0);
  advance(f.b, .14); assert.equal(tagHits(f, 's2:splash').length, 1);
  assert.equal(tagHits(f, 's2:splash')[0].target, z);
  assert.equal(z.findBuff('fear'), null);
});
test('S2 invalid trace target can retain selected input point without fabricating direct Fear', () => {
  const f = make({ skill: 2 }), dead = enemy(f.b), z = enemy(f.b, { x: 5.2 });
  f.b.kill(dead, null);
  assert.equal(f.links.launchS2({ target: dead, point: { x: 5, y: 1 }, attackId: 'point', selected: f.selected }), true);
  advance(f.b, .5); assert.equal(tagHits(f, 's2:direct').length, 0);
  assert.equal(tagHits(f, 's2:splash').length, 1); assert.equal(z.findBuff('fear'), null);
});
test('S2 owner removal stops flight and delayed-stop damage; ordinary born projectiles persist', () => {
  for (const stage of ['flight', 'after-arrival']) {
    const f = make({ skill: 2 }), e = enemy(f.b, { x: stage === 'flight' ? 6 : 5 });
    f.links.launchS2({ target: e, attackId: stage, selected: f.selected });
    if (stage === 'after-arrival') advance(f.b, .12);
    f.b.retreat(f.u); advance(f.b, 1);
    assert.equal(tagHits(f, 's2:splash').length, 0); assert.equal(f.b.projectiles.list.length, 0);
  }
  const f = make(), e = enemy(f.b); f.links.launchAttack(e, 'ordinary', 0);
  f.b.retreat(f.u); advance(f.b, .3); assert.equal(tagHits(f, 'normal').length, 1);
});
test('S2 finite lifetime never teleports a distant projectile into forced reach or damage', () => {
  const f = make({ skill: 2 }); enemy(f.b);
  // Fixed input point avoids the engine clamping a live enemy back to the map.
  f.links.launchS2({ target: null, point: { x: 500, y: 1 }, attackId: 'timeout', selected: f.selected });
  advance(f.b, 20.5); assert.equal(tagHits(f, 's2:direct').length, 0);
  assert.equal(tagHits(f, 's2:splash').length, 0); assert.equal(f.b.projectiles.list.length, 0);
});
