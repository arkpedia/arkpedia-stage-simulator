// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {summonCocoon,cocoonCount,hasCocoon,cocoonCages} from '../server/sim/content/arkpedia-enemy-cocoon-cage.js';
import {cocoonSpreadTile} from '../server/sim/content/arkpedia-enemy-theresa.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {theresaNative,theresaParams} from '../shared/arkpedia/enemy-theresa-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_1554_lrtsia',entry=ENEMY_RECORDS.enemies[id],record=entry.levels[0];
const PREFAB='dyn/battle/prefabs/enemies/enemy_1554_lrtsia.prefab';
const SOUL='enemy_1428_lrsoul',HOLDER='enemy_1554_lrtsia_2',CAGE='enemy_1432_lrccon';

/** Theresa at row 10, col 5 (the harness field spans rows 9-12); operators (block 0) at [row, col]. */
function fixture(positions=[],{rec=record}={}){
 const op=chessRec({id:'lrtsia_target',stats:{maxHp:1e7,atk:100,def:0,res:0,blockCnt:0}});
 const enemies={[id]:rec};for(const k of [SOUL,HOLDER,CAGE])enemies[k]=ENEMY_RECORDS.enemies[k].levels[0];
 const h=makeBattle({content:'generic',autoFinish:false,timeLimit:2000,defs:{chess:{[op.chessId]:op},enemies},
  units:positions.map((_,i)=>({chessId:op.chessId,row:11,col:1+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();b.life=3;const ops=h.allies();
 ops.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];u.tileR=positions[i][0];u.tileC=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[10,5],route:0});
 const ab=e.mem.ab.list.find(a=>'rings'in a);
 const releases=[],tracked=[];b.stageWaveScheduler={releaseCurrentWave:(...x)=>{releases.push(x);return true;},track:u=>{tracked.push(u);return u;}};
 const hits=[];b.on('hit',c=>{if(c.source===e||c.target===e)hits.push({target:c.target,amount:c.dmg.amount,type:c.dmg.type,tags:c.dmg.tags??[]});});
 return {...h,e,ops,ab,hits,releases,tracked,p:theresaParams(rec),run:s=>{h.run(s);}};
}
const tagged=(hits,tag)=>hits.filter(x=>x.tags.includes(tag));
const withComponent=(test,edit)=>{const n=structuredClone(native);for(const row of n.prefabs[PREFAB]){const d=JSON.parse(row.originalJson);if(test(d)){edit(d);row.originalJson=JSON.stringify(d);}}return nativeComponents(n,id);};

test('both levels of Theresa are admitted only with the complete native tree',()=>{
 assert.ok(enemySupport(entry,clocks.prefabs,native).policy);
 const n=nativeComponents(native,id);
 for(const r of Object.values(entry.levels))assert.equal(theresaNative(r,n),true,`level ${r.level}`);
 assert.equal(theresaNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'Doom.lrccon_count':40}}},n),false);
 assert.equal(theresaNative({...record,skills:record.skills.map(s=>s.prefabKey==='DuplicateLrcconP2'?{...s,cooldown:30}:s)},n),false);
 assert.equal(theresaNative(record,withComponent(d=>d._maxRespawnCnt===2,d=>{d._maxRespawnCnt=1;})),false,'two revives');
 assert.equal(theresaNative(record,withComponent(d=>d.m_Radius===1.5,d=>{d.m_Radius=2;})),false,'Banish reach');
 const one=theresaParams(entry.levels[1]);
 assert.deepEqual([one.banish.ratio,one.form2.hpPct,one.form2.def,one.doom.p1.count,one.dust.p1.rings[0].invisible,one.win.delay],[.35,2.5,2000,50,36,13],'level one over level zero');
});

test('Eternal Dust: visible motes hit a touching operator; invisible motes cut damage from behind them by 90%',()=>{
 const h=fixture([[10,6],[9,9]]),{b,e,p,ab,hits}=h,[near,far]=h.ops;
 h.run(1);
 const dust=tagged(hits,'lrtsiaDust');
 assert.ok(dust.length>=1&&dust.every(x=>x.target===near&&x.amount===e.s.atk&&x.type==='arts'),'the adjacent operator is struck');
 assert.ok(!dust.some(x=>x.target===far));
 // A far source: with all 36 invisible motes present, every direction lies within 10 deg behind one of them.
 near.x=e.x+3;near.y=e.y;for(const m of ab.rings[0].motes)m.back=0;
 const hp0=e.hp;b.dealDamage(far,e,{amount:1000,type:'true'});assert.ok(Math.abs(hp0-e.hp-100)<1e-6,'cut to 10%');
 const hp1=e.hp;b.dealDamage(null,e,{amount:1000,type:'true',sourceless:true});assert.ok(Math.abs(hp1-e.hp-100)<1e-6,'sourceless damage is cut');
 // Inside the ring radius the cut does not apply.
 near.x=e.x+.5;near.y=e.y-.5;const hp2=e.hp;b.dealDamage(near,e,{amount:1000,type:'true'});assert.ok(Math.abs(hp2-e.hp-1000)<1e-6,'source inside the ring');
 // With every invisible mote consumed there is no cut.
 for(const m of ab.rings[0].motes)if(!m.visible)m.back=b.time+10;
 const hp3=e.hp;b.dealDamage(far,e,{amount:1000,type:'true'});assert.ok(Math.abs(hp3-e.hp-1000)<1e-6,'gaps let damage through');
 assert.equal(p.dust.p1.rings[0].visibleCooldown,1.9);assert.deepEqual(b.errors,[]);
});

test('Banish: every 55% of max HP lost cages the operators within 1.5 at the strike; the low-HP poll cages a downed one',()=>{
 const h=fixture([[10,6],[11,6],[10,9]]),{b,e,p,ab}=h,[a1,a2,farOp]=h.ops;
 for(const m of ab.rings[0].motes)m.back=Infinity;
 b.dealDamage(a1,e,{amount:e.s.maxHp*p.banish.ratio,type:'true'});
 assert.deepEqual(ab.queue,['banish']);
 h.run(p.banish.anim.hit-.05);assert.equal(cocoonCount(b),0);
 h.run(.1);assert.ok(hasCocoon(b,10,6)&&hasCocoon(b,11,6));assert.ok(!hasCocoon(b,10,9),'out of reach');
 h.run(p.banish.anim.dur);assert.equal(ab.cast,null);
 farOp.hp=0;h.run(.4);assert.ok(hasCocoon(b,10,9),'an operator at 0% HP');
 assert.deepEqual(b.errors,[]);
});

test('Weave Cocoon: from 400 s in form one every cage spreads to its free neighbours; Doom removes 100 Life Points',()=>{
 const h=fixture([]),{b,e,p,ab}=h;
 for(const m of ab.rings[0].motes)m.back=Infinity;
 summonCocoon(b,10,8);
 b.grid.setObstacle(9,8,true);
 assert.equal(cocoonSpreadTile(b,9,8),false,'obstacle');assert.equal(cocoonSpreadTile(b,10,8),false,'caged');
 h.run(p.weave.p1.init-1);assert.equal(cocoonCount(b),1);
 h.run(1+p.weave.p1.anim.hit+.05);
 assert.ok(hasCocoon(b,11,8)&&hasCocoon(b,10,7)&&hasCocoon(b,10,9));assert.ok(!hasCocoon(b,9,8),'not onto the obstacle');
 h.run(p.weave.p1.anim.dur);assert.equal(ab.cast?.kind,'weave','cooldown 0: cast again at once');
 // Doom: enough cages on the field.
 const fake=cocoonCages(b);for(let i=0;i<p.doom.p1.count;i++)fake.set(`fake${i}`,{alive:true});
 h.run(p.weave.p1.anim.dur+p.doom.p1.anim.dur+.1);
 assert.ok(b.life<=0);assert.equal(b.finished,true);
});

test('soul capture heals by the Soul Maelstrom\'s remaining HP; first revive into form two; second into the winning form three',()=>{
 const h=fixture([[10,6]]),{b,e,p,ab,releases,tracked}=h,[op]=h.ops;
 for(const m of ab.rings[0].motes)m.back=Infinity;
 e.hp=e.s.maxHp/2;const soul=b.spawnEnemy(SOUL,{pos:[10,5.6],route:0});soul.hp=1234;
 h.run(.05);assert.equal(soul.alive,false);assert.ok(Math.abs(e.hp-(e.s.maxHp/2+1234))<1e-6);
 const max1=e.s.maxHp,def1=e.s.def,res1=e.s.res;
 b.kill(e,op);assert.equal(e.alive,true);assert.equal(ab.state,'revive');assert.ok(e.s.flags.invulnerable);
 h.run(p.revive1.healAt+.05);assert.ok(Math.abs(e.hp-max1*.5)<1e-6,'50% within 1.33 s');
 h.run(p.revive1.dur-p.revive1.healAt);
 assert.equal(ab.form,2);assert.ok(!e.s.flags.invulnerable);
 assert.equal(e.s.maxHp,max1*3);assert.equal(e.s.def,def1+1000);assert.equal(e.s.res,res1-40);assert.ok(Math.abs(e.hp/e.s.maxHp-.5)<1e-6);
 assert.deepEqual(releases.map(x=>x.length),[1],'the wave is released');
 assert.deepEqual(ab.rings.map(r=>[r.radius,r.clockwise]),[[1,false],[2,true]]);
 for(const r of ab.rings)for(const m of r.motes)m.back=Infinity;
 b.dealDamage(op,e,{amount:e.s.maxHp*p.weave.p2.ratio,type:'true'});assert.deepEqual(ab.queue,['forcedWeave']);
 b.kill(e,op);assert.equal(e.alive,true);assert.equal(ab.state,'revive');
 h.run(p.revive2.holdAt+.05);assert.equal(tracked.length,1);assert.equal(tracked[0].defId,HOLDER,'a body holds the wave');
 h.run(p.revive2.dur);assert.equal(ab.form,3);assert.ok(e.s.flags.invulnerable);assert.equal(ab.rings.length,0);
 summonCocoon(b,11,4);h.run(p.weave.p3.anim.hit+.1);assert.ok(hasCocoon(b,11,3)||hasCocoon(b,11,5),'form three weaves at once');
 h.run(p.win.delay-p.weave.p3.anim.hit-.3);assert.equal(b.finished,false);
 h.run(.4);assert.equal(b.finished,true);assert.equal(b.reason,'cleared');
});

// [stage, max HP after the stage runes]; both stages place level 0 and restate Doom at 59 (the database value).
for(const [stageId,maxHp] of [['14-21',50000],['14-21_adverse_environment',60000]])
 test(`compiled ${stageId}: Banish cages a deployed operator, two revives, and the third form wins`,async()=>{
  const {readFile}=await import('node:fs/promises');
  const {StandardBattle}=await import('../server/sim/arkpedia.js');
  const {createStageLibraryLoader}=await import('../shared/arkpedia/stage-library.js');
  const {defaultBuild}=await import('../shared/arkpedia/loadout.js');
  const mvp=JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json',import.meta.url)));
  const manifest=JSON.parse(await readFile(new URL('../data/arkpedia-library.json',import.meta.url)));
  const loader=createStageLibraryLoader(async url=>new Response(await readFile(new URL(`..${url}`,import.meta.url))));
  const stage=await loader.load(manifest.stages.find(s=>s.id===stageId));
  const b=new StandardBattle({...mvp,stage,enemies:{...mvp.enemies,...stage.enemies}},{operators:[{...defaultBuild(mvp.operators.char_151_myrtle)}]},{seed:1});
  // Cages and the wave-holding body stay; everything else (Soul Maelstroms included) is removed.
  const keep=new Set([id,CAGE,HOLDER]);let boss=null;
  const clear=()=>{for(const e of b.enemies)if(e.alive&&!keep.has(e.defId)&&!e.mem.stageUnitDevice)b.kill(e);};
  const run=s=>{const until=b.time+s;while(!b.finished&&b.time<until){clear();b.step();}};
  while(!b.finished&&b.time<600&&!boss){clear();boss=b.enemies.find(e=>e.alive&&e.defId===id);b.step();}
  assert.ok(boss);assert.equal(boss.def.raw?.level,0);assert.equal(boss.s.maxHp,maxHp,'stage runes');
  const ab=boss.mem.ab.list.find(a=>'rings'in a),p=theresaParams(boss.def.raw);
  assert.equal(p.doom.p1.count,59);
  b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
  let myrtle=null;
  for(let r=0;r<stage.geometry.tileGrid.length&&!myrtle;r++)for(let c=0;c<stage.geometry.tileGrid[0].length&&!myrtle;c++){try{myrtle=b.deployOperator('char_151_myrtle',r,c,'RIGHT');}catch{}}
  assert.ok(myrtle);myrtle.x=boss.x+1;myrtle.y=boss.y;myrtle.tileR=Math.round(boss.y);myrtle.tileC=Math.round(boss.x)+1;
  b.dealDamage(null,boss,{amount:boss.s.maxHp*p.banish.ratio/p.dust.p1.scale+1,type:'true',sourceless:true});
  run(p.banish.anim.dur+.5);
  assert.ok(hasCocoon(b,myrtle.tileR,myrtle.tileC),'Banish cages the operator beside her');
  assert.ok(myrtle.s.flags.stun&&myrtle.s.flags.noRetreat);assert.throws(()=>b.retreatOperator('char_151_myrtle'),/cannot retreat/);
  b.dealDamage(null,boss,{amount:1e9,type:'true',sourceless:true});assert.equal(ab.state,'revive');
  run(p.revive1.dur+.2);
  assert.equal(ab.form,2);assert.equal(boss.s.maxHp,maxHp*(1+p.form2.hpPct));
  b.dealDamage(null,boss,{amount:1e9,type:'true',sourceless:true});assert.equal(ab.state,'revive');
  run(p.revive2.dur+.2);
  assert.equal(ab.form,3);const holder=b.enemies.find(e=>e.alive&&e.defId===HOLDER);assert.ok(holder,'the wave-holding body');
  const life=b.life;run(p.win.delay-.5);assert.equal(b.finished,false);assert.equal(b.life,life,'nothing leaks');
  assert.ok(Math.abs(holder.x-boss.x)<.6&&Math.abs(holder.y-boss.y)<.6,'it stands with her');
  run(1);assert.equal(b.finished,true);assert.equal(b.reason,'cleared');
  assert.deepEqual(b.errors,[]);
 });
