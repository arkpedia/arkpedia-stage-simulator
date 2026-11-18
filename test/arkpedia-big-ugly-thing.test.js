// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {StageScenery} from '../server/sim/content/arkpedia-stage-scenery.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {bigUglyThingNative,bigUglyThingParams} from '../shared/arkpedia/enemy-big-ugly-thing-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_1512_mcmstr',entry=ENEMY_RECORDS.enemies[id],record=entry.levels[0];
const PREFAB='dyn/battle/prefabs/enemies/enemy_1512_mcmstr.prefab';

/** The machine at row 9, col 5, held still; operators (block 0) at [row, col]. */
function fixture(positions=[[9,12]],{disarm=true}={}){
 const op=chessRec({id:'mcmstr_target',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:2+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();ops.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[9,5],route:0});
 b.addBuff(e,{key:'hold',persist:true,flags:{noMove:true,...disarm?{disarm:true}:{}}});
 const ab=e.mem.ab.list.find(a=>'cutLeft'in a);
 const hits=[];b.on('hit',c=>{if(c.source===e||c.target===e)hits.push({source:c.source,target:c.target,amount:c.dmg.amount,type:c.dmg.type,splash:!!c.dmg.isSplash,applyWay:c.dmg.applyWay,tags:c.dmg.tags??[]});});
 return {...h,e,ops,ab,hits,p:bigUglyThingParams(record),run:s=>{h.run(s);assert.equal(b.finished,false,'the fixture battle must still run');}};
}
const tagged=(hits,tag)=>hits.filter(x=>x.tags.includes(tag));
const withComponent=(test,edit)=>{const n=structuredClone(native);for(const row of n.prefabs[PREFAB]){const d=JSON.parse(row.originalJson);if(test(d)){edit(d);row.originalJson=JSON.stringify(d);}}return nativeComponents(n,id);};

test('both levels of The Big Ugly Thing are admitted only with the complete native tree',()=>{
 assert.ok(enemySupport(entry,clocks.prefabs,native).policy);
 const n=nativeComponents(native,id);
 for(const r of Object.values(entry.levels))assert.equal(bigUglyThingNative(r,n),true,`level ${r.level}`);
 assert.equal(bigUglyThingNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'bird_run.def':300}}},n),false);
 assert.equal(bigUglyThingNative({...record,skills:record.skills.map(s=>({...s,cooldown:20}))},n),false);
 assert.equal(bigUglyThingNative(record,withComponent(d=>d.m_Radius===f32(1.8),d=>{d.m_Radius=2;})),false,'cut reach');
 assert.equal(bigUglyThingNative(record,withComponent(d=>d._preDelay>2,d=>{d._preDelay=1;})),false,'bomb delay');
 const one=bigUglyThingParams(entry.levels[1]);
 assert.deepEqual([one.attack.meleeScale,one.bomb.stun,one.priest.def,one.priest.res,one.cut.cooldown],[3.5,25,500,40,30]);
});
const f32=Math.fround;

test('unblocked, a ranged shot hits one ground operator within 2.5 and splashes the eight tiles around it',()=>{
 const h=fixture([[9,7],[10,8],[9,9]],{disarm:false}),{e,p,hits}=h,[main,beside,far]=h.ops;
 h.run(p.attack.ranged.hit+1.5);
 assert.deepEqual(tagged(hits,'mcmstrShot').map(x=>[x.target,x.amount,x.type,x.splash]),[[main,e.s.atk,'phys',false]]);
 assert.deepEqual(tagged(hits,'mcmstrSplash').map(x=>[x.target,x.amount,x.splash]),[[beside,e.s.atk,true]]);
 assert.ok(!hits.some(x=>x.target===far));
 assert.deepEqual(h.b.errors,[]);
});

test('blocked, he strikes the blocker in melee for 300% ATK',()=>{
 const h=fixture([[9,5.6]]),{b,e,p,ab,hits}=h,[blocker]=h.ops;
 e.blockedBy=blocker;const attack=e.mem.ab.list.find(a=>a.attack);attack.attack({targets:[blocker]},b,e,ab);e.blockedBy=null;
 assert.deepEqual(tagged(hits,'mcmstrMelee').map(x=>[x.target,x.amount,x.applyWay]),[[blocker,e.s.atk*p.attack.meleeScale,'melee']]);
 assert.equal(p.attack.meleeScale,3);assert.deepEqual(b.errors,[]);
});

test('the cut fells a Giant Mushroom before a Stump, standing still through the Skill clip',()=>{
 const h=fixture(),{b,p,ab}=h;
 const scenery=b.stageScenery=new StageScenery(b,[]);
 for(const [r,c] of [[9,6],[10,5],[12,5]]){scenery.stumps.set(`${r},${c}`,{row:r,col:c});b.grid.setTile(r,c,{...b.grid.tile(r,c),build:'MELEE',pass:'ALL'});}
 scenery.entries.set('mushroom',{row:10,col:5,unit:{alive:true}});
 h.run(p.cut.initial-1);assert.equal(ab.cast,null,'initial cooldown');
 h.run(1.05);assert.deepEqual([ab.cast?.row,ab.cast?.col],[10,5],'the mushroom first');
 h.run(p.cut.anim.hit-.1);assert.equal(scenery.brokenStumps.size,0);
 h.run(.15);assert.deepEqual([...scenery.brokenStumps.keys()],['10,5']);assert.equal(b.grid.tile(10,5).build,'NONE');
 h.run(p.cut.anim.dur);assert.equal(ab.cast,null);
 assert.ok(Math.abs(ab.cutLeft-(p.cut.cooldown-(b.time-p.cut.initial)))<.1,'the cooldown restarts when the cast starts');
 ab.cutLeft=0;h.run(p.cut.anim.dur+.1);assert.deepEqual([...scenery.brokenStumps.keys()].sort(),['10,5','9,6'],'the stump next; 12,5 is out of reach');
 assert.deepEqual(b.errors,[]);
});

test('first knock-out: the bomb stuns ground operators within 3.0 at 2.17 s, then the High Priest burns at full HP',()=>{
 const h=fixture([[9,7],[9,9]]),{b,e,p,hits}=h,[near,far]=h.ops,def=e.s.def,res=e.s.res,move=e.s.moveSpeed;
 b.kill(e,near);assert.equal(e.alive,true);
 h.run(p.bomb.delay-.05);assert.equal(tagged(hits,'mcmstrBomb').length,0);
 h.run(.1);
 assert.deepEqual(tagged(hits,'mcmstrBomb').map(x=>[x.target,x.amount,x.type]),[[near,e.s.atk*p.bomb.scale,'phys']]);
 assert.ok(near.s.flags.stun);assert.ok(!far.s.flags.stun);
 h.run(p.rebirth-p.bomb.delay);
 assert.equal(e.hp,e.s.maxHp,'full HP');assert.equal(e.s.def,def+p.priest.def);assert.equal(e.s.res,res+p.priest.res);
 assert.ok(Math.abs(e.s.moveSpeed-(move+p.priest.move))<1e-9);assert.ok(e.s.flags.unblockable);assert.equal(e.profile.noAttack,true);
 h.run(1.05);
 const burn=tagged(hits,'mcmstrPriestBurn');assert.equal(burn.length,1);assert.deepEqual([burn[0].amount,burn[0].type,burn[0].source??null],[p.priest.damage,'true',null]);
 assert.ok(near.s.flags.stun,'16 s stun');
 b.kill(e,far);assert.equal(e.alive,false,'the High Priest knock-out is final');
 assert.deepEqual(b.errors,[]);
});

for(const [stageId,level] of [['ri-8',0],['ri-ex-8',1],['ri-ex-8_challenge_mode',1]])
 test(`compiled ${stageId}: The Big Ugly Thing (level ${level}) cuts, explodes and ejects the High Priest`,async()=>{
  const {readFile}=await import('node:fs/promises');
  const {StandardBattle}=await import('../server/sim/arkpedia.js');
  const {createStageLibraryLoader}=await import('../shared/arkpedia/stage-library.js');
  const {defaultBuild}=await import('../shared/arkpedia/loadout.js');
  const mvp=JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json',import.meta.url)));
  const manifest=JSON.parse(await readFile(new URL('../data/arkpedia-library.json',import.meta.url)));
  const loader=createStageLibraryLoader(async url=>new Response(await readFile(new URL(`..${url}`,import.meta.url))));
  const stage=await loader.load(manifest.stages.find(s=>s.id===stageId));
  const b=new StandardBattle({...mvp,stage,enemies:{...mvp.enemies,...stage.enemies}},{operators:[{...defaultBuild(mvp.operators.char_151_myrtle)}]},{seed:1});
  let boss=null;
  const clear=()=>{for(const e of b.enemies)if(e.alive&&e!==boss&&e.defId!==id&&!e.mem.stageUnitDevice)b.kill(e);};
  while(!b.finished&&b.time<900&&!boss){clear();boss=b.enemies.find(e=>e.alive&&e.defId===id);b.step();}
  assert.ok(boss);assert.equal(boss.def.raw?.level,level);
  const run=s=>{const until=b.time+s;while(!b.finished&&b.time<until){clear();b.step();}};
  const broken=b.stageScenery.brokenStumps.size;
  run(40);assert.ok(b.stageScenery.brokenStumps.size>broken,'the cut fells a mushroom or stump on his route');
  b.addBuff(boss,{key:'hold',persist:true,flags:{noMove:true}});
  const def=boss.s.def;
  b.dealDamage(null,boss,{amount:boss.s.maxHp,type:'true',sourceless:true});assert.equal(boss.alive,true);
  run(10.2);assert.equal(boss.hp>boss.s.maxHp-2*1300-1,true,'full HP, then the burn');assert.ok(boss.s.def>def,'High Priest');
  assert.equal(b.finished,false);assert.deepEqual(b.errors,[]);
 });
