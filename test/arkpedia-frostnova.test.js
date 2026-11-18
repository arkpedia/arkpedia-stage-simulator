// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {frostNovaNative,frostNovaParams} from '../shared/arkpedia/enemy-frostnova-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_1505_frstar',entry=ENEMY_RECORDS.enemies[id],record=entry.levels[0];
const PREFAB='dyn/battle/prefabs/enemies/enemy_1505_frstar.prefab';

/** FrostNova at row 10, col 5 (the field spans rows 9-12), held still and disarmed; operators (block 0) at [row, col]. */
function fixture(positions=[]){
 const op=chessRec({id:'frstar_target',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,timeLimit:2000,defs:{chess:{[op.chessId]:op},enemies:{[id]:record}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:11,col:1+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();
 ops.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];u.tileR=positions[i][0];u.tileC=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[10,5],route:0});
 b.addBuff(e,{key:'hold',persist:true,flags:{noMove:true,disarm:true}});
 const ab=e.mem.ab.list.find(a=>'blastLeft'in a);
 const hits=[];b.on('damaged',c=>{if(c.source===e)hits.push({target:c.target,amount:c.amount,type:c.dmg?.type,tags:c.dmg?.tags??[]});});
 return {...h,e,ops,ab,hits,p:frostNovaParams(record),run:s=>{h.run(s);assert.equal(b.finished,false);}};
}
const tagged=(hits,tag)=>hits.filter(x=>x.tags.includes(tag));
const withComponent=(test,edit)=>{const n=structuredClone(native);for(const row of n.prefabs[PREFAB]){const d=JSON.parse(row.originalJson);if(test(d)){edit(d);row.originalJson=JSON.stringify(d);}}return nativeComponents(n,id);};

test('both levels of FrostNova are admitted only with the complete native tree',()=>{
 assert.ok(enemySupport(entry,clocks.prefabs,native).policy);
 const n=nativeComponents(native,id);
 for(const r of Object.values(entry.levels))assert.equal(frostNovaNative(r,n),true,`level ${r.level}`);
 assert.equal(frostNovaNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'reborn.atk':1}}},n),false);
 assert.equal(frostNovaNative({...record,skills:record.skills.map(s=>s.prefabKey==='IceShield'?{...s,bb:{max_cnt:4}}:s)},n),false);
 assert.equal(frostNovaNative(record,withComponent(d=>d._preDelay>.9,d=>{d._preDelay=.5;})),false,'Ice Nova pre-delay');
 assert.equal(frostNovaNative(record,withComponent(d=>d._maxRespawnCnt===1,d=>{d._maxRespawnCnt=2;})),false,'one revive');
 assert.deepEqual([frostNovaParams(entry.levels[1]).shield.count,frostNovaParams(entry.levels[1]).blast.cooldown],[3,7]);
});

test('Ice Nova at 8.5 s: 150% Arts to the target and every operator within 2 of it, -50 ASPD for 8 s',()=>{
 const h=fixture([[10,7],[11,8],[9,10]]),{b,e,p,ab,hits}=h,[target,beside,far]=h.ops;
 h.run(p.blast.initial-.1);assert.equal(ab.cast,null);
 h.run(.15);assert.equal(ab.cast?.kind,'blast');assert.equal(ab.cast.target,target,'the nearest ground operator within 2.5');
 h.run(p.blast.anim.hit);
 const nova=tagged(hits,'frstarNova');
 assert.deepEqual(nova.map(x=>[x.target,x.type]).sort((a,c)=>a[0].x-c[0].x),[[target,'arts'],[beside,'arts']]);
 assert.ok(nova.every(x=>Math.abs(x.amount-e.s.atk*1.5)<1e-6));assert.ok(!nova.some(x=>x.target===far));
 const aspd=target.findBuff('arctic_blast');assert.ok(aspd);assert.equal(target.s.aspd,100-50);
 h.run(p.blast.duration);assert.ok(!target.findBuff('arctic_blast'));
 assert.deepEqual(b.errors,[]);
});

test('Ice Shield at 30 s: up to two deployable tiles within 2 are sealed and their units defeated; it goes before Ice Nova',()=>{
 const h=fixture([[10,6]]),{b,e,p,ab}=h,[op]=h.ops;
 ab.blastLeft=Infinity;
 h.run(p.shield.initial+.05);assert.equal(ab.cast?.kind,'shield');assert.equal(ab.cast.tiles.length,2);
 const tiles=ab.cast.tiles;assert.ok(tiles.every(([r,c])=>Math.hypot(r-e.y,c-e.x)<=2+1e-9));
 // Seal the operator's tile for the check: put it on the first chosen tile.
 op.y=tiles[0][0];op.x=tiles[0][1];
 h.run(p.shield.anim.hit);
 assert.equal(op.alive,false,'defeated');assert.ok(tiles.every(([r,c])=>b.noDeployTiles.has(`${r},${c}`)),'sealed');
 h.run(p.shield.anim.dur);
 // Both ready: Ice Shield (priority 2) first.
 ab.blastLeft=0;ab.shieldLeft=0;h.run(.05);assert.equal(ab.cast?.kind,'shield');
 assert.deepEqual(b.errors,[]);
});

test('one 5 s revive at full HP with ATK +50%; sleep immunity is gone afterwards',()=>{
 const h=fixture([[10,7]]),{b,e,p,ab}=h,[op]=h.ops;
 assert.ok(e.def.immune.has('sleep'));const atk=e.s.atk;
 b.kill(e,op);assert.equal(e.alive,true);assert.equal(ab.state,'reborn');
 h.run(p.revive.dur+.05);
 assert.equal(e.hp,e.s.maxHp);assert.ok(Math.abs(e.s.atk-atk*1.5)<1e-6);assert.ok(!e.def.immune.has('sleep'));
 b.kill(e,op);assert.equal(e.alive,false,'the second knock-out is final');
});

for(const [stageId,maxHp] of [['4-10',25000]])
 test(`compiled ${stageId}: FrostNova casts Ice Nova and Ice Shield and revives`,async()=>{
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
  const run=s=>{const until=b.time+s;while(!b.finished&&b.time<until){clear();b.step();}};
  while(!b.finished&&b.time<600&&!boss){clear();boss=b.enemies.find(e=>e.alive&&e.defId===id);b.step();}
  assert.ok(boss);assert.equal(boss.def.raw?.level,0);assert.equal(boss.s.maxHp,maxHp);
  const ab=boss.mem.ab.list.find(a=>'blastLeft'in a),p=frostNovaParams(boss.def.raw);
  b.addBuff(boss,{key:'hold',persist:true,flags:{noMove:true}});
  b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
  let myrtle=null;
  for(let r=0;r<stage.geometry.tileGrid.length&&!myrtle;r++)for(let c=0;c<stage.geometry.tileGrid[0].length&&!myrtle;c++){try{myrtle=b.deployOperator('char_151_myrtle',r,c,'RIGHT');}catch{}}
  assert.ok(myrtle);myrtle.base.maxHp=1e9;myrtle.markDirty();myrtle.hp=myrtle.s.maxHp;myrtle.y=boss.y;myrtle.x=boss.x+1;
  const kinds=new Set();const watch=s=>{const until=b.time+s;while(!b.finished&&b.time<until){clear();b.step();if(ab.cast)kinds.add(ab.cast.kind);}};
  watch(p.shield.initial+p.shield.anim.dur+1);
  assert.ok(kinds.has('blast'),'Ice Nova');assert.ok(kinds.has('shield'),'Ice Shield');assert.ok(b.noDeployTiles?.size>=1,'sealed tiles');
  b.dealDamage(null,boss,{amount:boss.hp,type:'true',sourceless:true});assert.equal(ab.state,'reborn');
  run(p.revive.dur+.2);assert.equal(boss.hp,boss.s.maxHp);
  assert.equal(b.finished,false);assert.deepEqual(b.errors,[]);
 });
