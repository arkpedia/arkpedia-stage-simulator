// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {SHIELD_BUFF} from '../server/sim/content/arkpedia-enemy-the-leader.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {theLeaderNative,theLeaderParams} from '../shared/arkpedia/enemy-the-leader-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_1536_ncrmcr',entry=ENEMY_RECORDS.enemies[id],record=entry.levels[0];
const SOLDIER='enemy_1288_duskls',FLAME='enemy_1294_duchns';

/** The Leader at row 9, col 5 (held still, not attacking); operators at [row, col]; `soldiers` Flamechasers held far away. */
function fixture({positions=[[9,6]],soldiers=0}={}){
 const op=chessRec({id:'ncrmcr_target',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:0}});
 const enemies={[id]:record};for(const k of [SOLDIER,FLAME])enemies[k]=ENEMY_RECORDS.enemies[k].levels[0];
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:2+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();ops.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[9,5],route:0});
 const crowd=Array.from({length:soldiers},(_,i)=>b.spawnEnemy(SOLDIER,{pos:[2,2+i],route:0}));
 for(const u of [e,...crowd])b.addBuff(u,{key:'hold',persist:true,flags:{disarm:true,noMove:true}});
 const hits=[];b.on('hit',c=>{if(c.source===e)hits.push({target:c.target,amount:c.dmg.amount,type:c.dmg.type,tags:c.dmg.tags??[],t:b.time});});
 const ab=e.mem.ab.list.find(a=>a.attack);
 return {...h,e,ops,crowd,hits,ab,p:theLeaderParams(record),flames:()=>b.enemies.filter(u=>u.alive&&u.defId===FLAME)};
}

test('both levels of The Leader are admitted, level one as a sparse overlay on level zero',()=>{
 assert.ok(enemySupport(entry,clocks.prefabs,native).policy);
 const n=nativeComponents(native,id);
 for(const r of Object.values(entry.levels))assert.equal(theLeaderNative(r,n),true,`level ${r.level}`);
 assert.equal(theLeaderNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'Reborn.invincible':10}}},n),false);
 const hp=structuredClone(native);
 for(const row of hp.prefabs['dyn/battle/prefabs/enemies/enemy_1536_ncrmcr.prefab']){const d=JSON.parse(row.originalJson);if('_hpRechargeRatio'in d){d._hpRechargeRatio=.5;row.originalJson=JSON.stringify(d);}}
 assert.equal(theLeaderNative(record,nativeComponents(hp,id)),false);
 const shield=structuredClone(native);shield.templates.enemy_ncrmcr_shield.eventToActions.ON_TAKE_DAMAGE[0]._damageMask='PHYSICAL';
 assert.equal(theLeaderNative(record,nativeComponents(shield,id)),false);
 const one=entry.levels[1],p1=theLeaderParams(one);
 assert.deepEqual([p1.form1.chain.key,p1.form1.sacrifice.key,p1.form2.chain.initial,p1.invincible,p1.form2.atk],['enemy_1294_duchns_2','enemy_1288_duskls_2',0,15,.3]);
});

test('Sovereign summons an Exhausted Flame on the target tile, skipping an operator already held by one',()=>{
 const h=fixture({positions:[[9,6],[10,5]]}),{b,p,ops:[held,free]}=h;
 b.addBuff(held,{key:'ab:exhaustedFlame:test',persist:true});
 h.run(p.form1.chain.initial+p.form1.chain.anim.release+.3);
 const flames=h.flames();
 assert.equal(flames.length,1);assert.deepEqual([flames[0].y,flames[0].x],[10,5]);
 assert.ok(free.s.flags.disarm,'the flame holds its operator');
 assert.deepEqual(b.errors,[]);
});

test('Give and Take knocks out up to five soldiers into Embers and grants one 60 s barrier per sacrifice',()=>{
 const h=fixture({positions:[[2,14]],soldiers:6}),{b,e,p,crowd}=h,s=p.form1.sacrifice;
 h.run(s.initial+s.anim.release+.05);
 assert.equal(crowd.filter(u=>u.form==='husk').length,5,'five Embers');
 assert.equal(crowd.filter(u=>u.form!=='husk').length,1);
 h.run(5);
 const shields=e.buffs.filter(x=>x.key===SHIELD_BUFF);
 assert.equal(shields.length,5);assert.ok(shields.every(x=>x.shield===e.s.maxHp*s.scale));
 // Independent clocks: each barrier keeps its own 60 s timer from its own arrival.
 assert.ok(shields.every(x=>x.duration===s.duration));assert.ok(new Set(shields.map(x=>x.timeLeft.toFixed(3))).size>1);
 assert.deepEqual(b.errors,[]);
});

test('the first knock-out releases the wave at once, then she revives at full HP and casts Arson',()=>{
 const h=fixture({positions:[[2,14]]}),{b,e,p}=h,calls=[],ignitions=[],atk=e.s.atk;
 b.stageWaveScheduler={releaseCurrentWave:(...args)=>{calls.push(args);return true;}};
 b.stageReeds={igniteAll:()=>ignitions.push(b.time),hasBurningNear:()=>false};
 b.kill(e,h.ops[0]);assert.equal(e.alive,true);assert.deepEqual(calls,[[e,{trackSourceAtNextWave:true}]]);
 h.run(p.rebirth+.05);
 const start=b.time;
 assert.equal(e.hp,e.s.maxHp);assert.ok(Math.abs(e.s.atk-atk*(1+p.form2.atk))<1e-9);assert.ok(e.s.flags.invulnerable);
 assert.equal(e.profile.noAttack,true,'Arson holds her');
 h.run(p.arson.duration);
 assert.equal(ignitions.length,1);assert.ok(Math.abs(ignitions[0]-start-p.arson.release)<.2,`ignited ${ignitions[0]-start} s after standing up`);
 assert.equal(e.profile.noAttack,false);
 assert.deepEqual(b.errors,[]);
});

test('second form: two 0.8x Arts strikes on the blocker, two ranged targets otherwise',()=>{
 const h=fixture({positions:[[9,6],[9,7]]}),{b,e,p,ops:[blocker,other]}=h;
 b.kill(e,other);h.run(p.rebirth+p.arson.duration+.1);
 assert.equal(e.profile.maxTargets,2);
 e.blockedBy=blocker;h.ab.attack({targets:[blocker,other]},b,e,h.ab);
 h.run(p.form2.melee.followUps[0]+.05);e.blockedBy=null;
 const combat=h.hits.filter(x=>x.tags.includes('ncrmcrCombat'));
 assert.deepEqual(combat.map(x=>[x.target,x.type,x.amount]),[[blocker,'arts',e.s.atk*p.form2.melee.scale],[blocker,'arts',e.s.atk*p.form2.melee.scale]]);
 assert.ok(Math.abs(combat[1].t-combat[0].t-p.form2.melee.followUps[0])<.05);
 assert.equal(h.hits.filter(x=>x.tags.includes('ncrmcrAttack')).length,0,'blocked, she does not shoot');
 h.ab.attack({targets:[blocker,other]},b,e,h.ab);h.run(1);
 assert.equal(h.hits.filter(x=>x.tags.includes('ncrmcrAttack')).length,2);
 assert.deepEqual(b.errors,[]);
});

for(const [stageId,level] of [['fc-8',0],['fc-ex-8',1]])
 test(`compiled ${stageId} runs The Leader (level ${level}) through both forms`,async()=>{
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
  while(!b.finished&&b.time<900&&!boss){for(const e of b.enemies)if(e.alive&&e.defId!==id)b.kill(e);boss=b.enemies.find(e=>e.alive&&e.defId===id);b.step();}
  assert.ok(boss,'The Leader spawns');
  assert.equal(boss.def.raw?.level,level,'the stage uses this level');assert.equal(boss.base.maxHp,entry.levels[level].stats.maxHp);
  b.addBuff(boss,{key:'hold',persist:true,flags:{noMove:true}});
  b.dealDamage(null,boss,{amount:boss.s.maxHp,type:'true',sourceless:true});
  assert.equal(boss.alive,true);
  const until=b.time+20;while(!b.finished&&b.time<until){for(const e of b.enemies)if(e.alive&&e!==boss&&e.form!=='husk')b.kill(e);b.step();}
  assert.equal(boss.form,'form2');assert.deepEqual(b.errors,[]);
 });
