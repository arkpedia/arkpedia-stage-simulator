// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import e from '../data/arkpedia-exusiai-covenant-prefabs.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {normalizeChess} from '../server/sim/simdata.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
import {EXUSIAI_COVENANT_ID as ID,EXUSIAI_COVENANT_CORE_CONTRACT as CONTRACT,selectedExusiaiCovenantBuild,
  prepareExusiaiCovenantCore} from '../server/sim/content/arkpedia-exusiai-covenant.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function owner(b,{rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=1,dir='RIGHT',defer=false,row=5,col=5,contract=CONTRACT}={}){
  const build={elite,level,potential,trust,skillId:`skchr_angel2_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedExusiaiCovenantBuild(build),c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,
    subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    tags:r.tags,
    skill:{...r.source,...r.source.spData,skillId:build.skillId,
      rangeGrid:r.source.rangeId?e.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir});
  const prepared=prepareExusiaiCovenantCore(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
  const hits=[],attacks=[],births=[],bombs=[];
  b.on('exusiaiCovenantBombBirth',ctx=>{if(ctx.owner===u)bombs.push({...ctx,time:b.time});});
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});
  b.on('exusiaiCovenantProjectileBirth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
  const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));u.player.dp=99;};if(!defer)deploy();
  return {b,u,build,deploy,hits,attacks,births,bombs,...prepared};
}
function make(opts={}){
  const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_289_gyuki), {...defaultBuild(d.operators.char_1013_chen2),elite:2,level:90,skillId:'skchr_chen2_3',skillRank:10}, {...defaultBuild(d.operators.char_4039_horn),elite:2,level:90,skillId:'skchr_horn_2',skillRank:10}]});
  b.autoFinish=false;b.recordEvents=true;b.rng=()=>.99;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  return owner(b,opts);
}
function enemy(f,{row=5,col=6,hp=1e7,res=0,fly=false,taunt=0,flags={}}={}){
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(t.base,{maxHp:hp,atk:0,def:0,res,moveSpeed:0,tauntLevel:taunt});t.markDirty();void t.s;t.hp=hp;
  if(fly)t.motion='FLY';f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});
  f.b._buildEnemyIndex();return t;
}

function ally(f, { ammo = true, laterano = false, row = 5, col = 7 } = {}) {
  const def = normalizeChess({ chessId: 'fixture:ammo', charId: 'fixture:ammo', profession: 'SNIPER',
    stats: { maxHp: 1000, atk: 100, def: 0, baseAttackTime: 1, attackSpeed: 100 },
    tags: laterano ? ['laterano'] : [], rangeGrid: [[0, 0], [0, 1], [0, 2]],
    skill: { skillId: 'fixture:ammo', skillType: 'MANUAL', durationType: ammo ? 'AMMO' : 'NONE',
      duration: -1, spType: 'INCREASE_WITH_TIME', spCost: 1, initSp: 1 } });
  const a = f.b._makeAlly(f.u.player, def, 'op', row, col, { dir: 'RIGHT' });
  f.b._setupUnit(a, { trait: { noAttack: true }, talents: [], skill: {
    kind: ammo ? 'ammo' : 'instant', ammo: 10, trigger: { rule: 'NEVER' } } });
  a.player.dp = 99; assert.ok(f.b._deploy(a, { initial: false })); return a;
}

test('diagnostic core stays held and rejects unreviewed contracts and incomplete or locked selected builds', () => {
  assert.equal(REGULAR_OPERATORS[ID], undefined); assert.equal(data.operators[ID], undefined);
  assert.deepEqual(e.enabledOperators, []); assert.equal(CONTRACT.frameParity, false);
  assert.throws(() => make({ contract: { ...CONTRACT } }), /contract/);
  for (const skill of [1, 2, 3]) { const f = make({ skill }); f.u.skill.addCharge(1); assert.equal(f.u.skill.activate(), false); }
  const valid = make().build;
  for (const change of [{ elite: 3 }, { level: 0 }, { level: 91 }, { potential: 0 }, { potential: 7 },
    { trust: 201 }, { skillRank: 11 }, { module: 'mod-x' }, { elite: 0, skillId: 'skchr_angel2_3' }])
    assert.throws(() => selectedExusiaiCovenantBuild({ ...valid, ...change }));
  const f = make({ defer: true }); assert.throws(() => prepareExusiaiCovenantCore(f.b, f.u, { contract: CONTRACT }), /fresh/);
});

test('selected promotion, trust and both potential talent upgrades use pinned source', () => {
  const base = { elite: 2, level: 90, potential: 1, trust: 0, skillId: 'skchr_angel2_1', skillRank: 10 };
  const r = selectedExusiaiCovenantBuild(base), p = selectedExusiaiCovenantBuild({ ...base, potential: 6, trust: 200 });
  near(r.ammoTalent.hp_ratio, .06); near(r.ammoTalent.prob, .25); near(r.ammoTalent.aoe_atk_scale, 1.5);
  near(r.auraTalent.atk, .09); near(p.auraTalent.atk, .13); near(p.ammoTalent.aoe_atk_scale, 1.65);
  assert.deepEqual(r.tags, ['lungmen', 'penguin', 'laterano']);
  near(p.stats.cost, r.stats.cost - 2); assert.ok(p.stats.atk >= r.stats.atk + 30);
  assert.deepEqual(selectedExusiaiCovenantBuild({ ...base, elite: 0, level: 50, skillRank: 4 }).auraTalent, {});
});

test('ordinary attacks have a first-attack opening, original hit event, one projectile and one victim', () => {
  for (const dir of ['RIGHT', 'UP', 'DOWN', 'LEFT']) {
    const f = make({ dir }), t = enemy(f, { row: dir === 'UP' ? 6 : dir === 'DOWN' ? 4 : 5,
      col: dir === 'RIGHT' ? 6 : dir === 'LEFT' ? 4 : 5 }), spare = enemy(f, { row: t.tileR, col: t.tileC });
    until(f, () => f.controller.phase?.kind === 'opening');
    const p = f.controller.phase; advance(f.b, .1); assert.equal(f.births.length, 0);
    until(f, () => f.births.length === 1); assert.ok(f.births[0].time + f.b.dt >= p.releaseAt);
    until(f, () => f.hits.some(h => h.dmg.tags.includes('angel2:ordinary')));
    assert.equal(f.hits.filter(h => h.dmg.tags.includes('angel2:ordinary')).length, 1);
    near(spare.hp, spare.s.maxHp); assert.ok(t.hp < t.s.maxHp);
  }
});

test('ordinary windup cancels on control interruption and cannot release outside its accepted event', () => {
  const f = make(), t = enemy(f); assert.equal(f.controller.release(t, {}), false);
  until(f, () => f.controller.phase?.kind === 'attack');
  f.b.applyStatus(f.u, 'stun', { duration: 1, source: t }); advance(f.b, .4);
  assert.equal(f.births.length, 0); until(f, () => f.births.length > 0);
});

test('ordinary projectile survives owner withdrawal but battle finish clears it', () => {
  const f = make(), t = enemy(f, { col: 8 }); until(f, () => f.births.length === 1);
  near(t.hp, t.s.maxHp);
  f.b.retreat(f.u); advance(f.b, .1); assert.ok(t.hp < t.s.maxHp);
  assert.equal(f.controller.stopped, true); assert.equal(f.controller.handles.length, 0);
  const z = make(); enemy(z); until(z, () => z.births.length === 1);
  z.b.finished = true; z.b.emit('battleEnd', {});
  assert.equal(z.b.projectiles.list.filter(p => p.data?.exusiaiCovenantOwner === z.controller).length, 0);
});

test('one-percent drain waits a second, uses current max HP, bypasses shields and cannot kill', () => {
  const f = make(); f.b.addBuff(f.u, { key: 'fixture:shield', shield: 1e6 });
  const hp = f.u.hp; advance(f.b, .5); near(f.u.hp, hp);
  until(f, () => f.u.hp < hp, 1); near(f.u.hp, hp - f.u.s.maxHp * .01);
  f.b.addBuff(f.u, { key: 'fixture:maxhp', mods: { hpPct: 1 } });
  void f.u.s;
  const before = f.u.hp; advance(f.b, 1); near(f.u.hp, before - f.u.s.maxHp * .01);
  f.u.hp = 1.1; advance(f.b, 1); near(f.u.hp, 1); assert.equal(f.u.alive, true);
  f.b.retreat(f.u); const after = f.u.hp; advance(f.b, 2); near(f.u.hp, after);
});

test('ammo aura reaches the whole field, includes self, doubles Laterano and excludes non-ammo skills', () => {
  const f = make(), a = ally(f, { row: 14, col: 14 }), l = ally(f, { laterano: true, row: 14, col: 15 }), n = ally(f, { ammo: false });
  near(f.u.s.atk, f.u.base.atk * 1.18); near(a.s.atk, a.base.atk * 1.09); near(l.s.atk, l.base.atk * 1.18);
  near(n.s.atk, n.base.atk); assert.equal(n.findBuff('angel2:covenant'), null);
  f.b.retreat(f.u); near(a.s.atk, a.base.atk); near(l.s.atk, l.base.atk);
});

test('aura removes from withdrawn or isolated recipients and reapplies when eligibility returns', () => {
  const f = make(), a = ally(f); f.b.addBuff(a, { key: 'fixture:isolated', flags: { isolated: true } });
  advance(f.b, f.b.dt); near(a.s.atk, a.base.atk);
  f.b.removeBuff(a, 'fixture:isolated'); advance(f.b, f.b.dt); near(a.s.atk, a.base.atk * 1.09);
  f.b.retreat(a); assert.ok(!f.controller.auraRecipients.has(a));
});

test('an ammo attack heals once per consumed bullet; free shots and non-ammo attacks do not heal', () => {
  const f = make(), a = ally(f); f.b.rng = () => .99; f.u.hp = 200;
  assert.ok(a.skill.activate()); const hp = f.u.hp;
  a.skill.onAttackPerformed([], false); near(f.u.hp, hp + f.u.s.maxHp * .06);
  const after = f.u.hp; a.skill.onAttackPerformed([], false, true); near(f.u.hp, after);
  f.controller.consume({ unit: a, count: 5 }); near(f.u.hp, after + 5 * f.u.s.maxHp * .06);
  const final = f.u.hp;
  for (const count of [0, -1, .5, NaN, Infinity]) f.controller.consume({ unit: a, count });
  near(f.u.hp, final); assert.equal(f.bombs.length, 0);
});

test('talent healing respects heal-free and healing modifiers', () => {
  const f = make(), a = ally(f); f.b.rng = () => .99; f.u.hp = 100;
  f.b.addBuff(f.u, { key: 'fixture:healfree', flags: { healFree: true } });
  f.controller.consume({ unit: a }); near(f.u.hp, 100);
  f.b.removeBuff(f.u, 'fixture:healfree'); f.b.addBuff(f.u, { key: 'fixture:healing', mods: { healingTakenMul: .5 } });
  f.controller.consume({ unit: a }); near(f.u.hp, 100 + f.u.s.maxHp * .06 * .5);
});

test('bombardment rolls per bullet, marks the consuming ally range and preserves separate splash receipts', () => {
  const f = make(), a = ally(f, { row: 12, col: 10 }), t = enemy(f, { row: 12, col: 11 }), splash = enemy(f, { row: 12, col: 12, flags: { camou: true } });
  f.b.rng = () => 0; f.controller.consume({ unit: a, count: 3 });
  advance(f.b, .6); assert.equal(f.bombs.length, 3);
  assert.equal(f.hits.filter(h => h.dmg.tags.includes('angel2:talent') && h.target === t).length, 3);
  assert.equal(f.hits.filter(h => h.dmg.tags.includes('angel2:talent') && h.target === splash).length, 3);
  assert.equal(f.births.length, 0);
  assert.ok(f.bombs[1].time - f.bombs[0].time >= .1 - f.b.dt);
});

test('withdrawal cancels unborn bombs while a born fixed-point bomb retains its impact', () => {
  const f = make(), a = ally(f, { row: 12, col: 10 }), t = enemy(f, { row: 12, col: 11 });
  f.b.rng = () => 0; f.controller.consume({ unit: a, count: 3 }); advance(f.b, f.b.dt);
  assert.equal(f.bombs.length, 1); f.b.retreat(f.u); advance(f.b, .5);
  assert.equal(f.bombs.length, 1); assert.equal(f.hits.filter(h => h.dmg.tags.includes('angel2:talent')).length, 1);
  assert.ok(t.hp < t.s.maxHp);
});

test('real Ch’en the Holungday S3 consumes two bullets and supplies two healing loops', () => {
  const f = make(); f.u.player.dp = 99;
  f.b.deployOperator('char_1013_chen2', 12, 10, 'RIGHT');
  const a = f.b.bench.char_1013_chen2.unit;
  enemy(f, { row: 12, col: 11 }); a.skill.addCharge(1); assert.ok(a.skill.activate());
  f.b.rng = () => .99; f.u.hp = 100;
  const heals = []; f.b.on('calculatedHeal', c => { if (c.target === f.u) heals.push(c); });
  const ammo = a.skill.ammoLeft; until(f, () => a.skill.ammoLeft < ammo);
  assert.equal(ammo - a.skill.ammoLeft, 2); assert.equal(heals.length, 2);
});

test('real Horn S2 dump reports every consumed bullet to Exusiai before the skill ends', () => {
  const f = make(); f.u.player.dp = 99; f.b.deployOperator('char_4039_horn', 12, 10, 'RIGHT');
  const a = f.b.bench.char_4039_horn.unit; enemy(f, { row: 12, col: 13 });
  a.skill.addCharge(1); assert.ok(a.skill.activate()); advance(f.b, .2);
  a.skill.ammoLeft = 3; f.u.hp = 100; f.b.rng = () => .99;
  const heals = [], consumptions = [];
  f.b.on('calculatedHeal', c => { if (c.target === f.u) heals.push(c); });
  f.b.on('ammoUsed', c => { if (c.unit === a) consumptions.push(c); });
  assert.ok(f.b.activateOperator('char_4039_horn'));
  until(f, () => consumptions.length > 0);
  assert.equal(consumptions[0].count, 3); assert.equal(heals.length, 3);
});

test('temporary hidden state cancels windup without removing the core and attacks resume', () => {
  const f = make(); enemy(f); until(f, () => f.controller.phase?.kind === 'opening');
  f.u.hidden = true; advance(f.b, .4); assert.equal(f.births.length, 0); assert.equal(f.controller.stopped, false);
  f.u.hidden = false; until(f, () => f.births.length > 0); assert.equal(f.controller.stopped, false);
});

test('ordinary release rejects a changed target life and ordinary hidden targets', () => {
  for (const change of ['life', 'stealth', 'camou', 'sleep', 'untargetable']) {
    const f = make(), t = enemy(f); until(f, () => f.controller.phase?.kind === 'opening');
    if (change === 'life') t.deploySeq++;
    else f.b.addBuff(t, { key: 'fixture:invalid', flags: { [change]: true } });
    advance(f.b, .6); assert.equal(f.births.length, 0);
  }
});

test('all ammo healing receipts precede bombardment rolls and a healing callback can invalidate the owner', () => {
  const f = make(), a = ally(f); const order = []; f.u.hp = 100;
  f.b.on('calculatedHeal', c => { if (c.target === f.u) order.push('heal'); });
  f.b.rng = () => { order.push('dice'); return .99; };
  f.controller.consume({ unit: a, count: 2 }); assert.deepEqual(order, ['heal', 'heal', 'dice', 'dice']);
  const z = make(), other = ally(z); let rolls = 0;
  z.b.rng = () => { rolls++; return 0; }; z.u.hp = 100;
  z.b.on('calculatedHeal', c => { if (c.target === z.u) z.b.retreat(z.u); });
  z.controller.consume({ unit: other, count: 3 }); assert.equal(rolls, 0); assert.equal(z.bombs.length, 0);
});
