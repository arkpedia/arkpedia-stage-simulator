// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {blinkToNextCheckpoint} from '../server/sim/content/arkpedia-enemy-awaken.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {awakenBossNative,awakenParams} from '../shared/arkpedia/enemy-awaken-boss-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_1531_bbrain',entry=ENEMY_RECORDS.enemies[id],record=entry.levels[0];

/** 'Awaken' at row 9, col 5; operators at [row, col]. */
function fixture({positions=[[9,2],[9,8],[12,5]]}={}){
 const op=chessRec({id:'bbrain_target',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:2+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();ops.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[9,5],route:0});
 const hits=[];b.on('hit',c=>{if(c.source===e)hits.push({target:c.target,amount:c.dmg.amount,type:c.dmg.type,tags:c.dmg.tags??[],t:b.time});});
 const ab=e.mem.ab.list.find(a=>'journeyLeft'in a);
 return {...h,e,ops,hits,ab,p:awakenParams(record),run:s=>{h.run(s);assert.equal(b.finished,false,'the fixture battle must still run');}};
}
const tagged=(hits,tag,u)=>hits.filter(x=>x.tags.includes(tag)&&(!u||x.target===u));

test("both 'Awaken' levels are admitted only with the complete native tree",()=>{
 assert.ok(enemySupport(entry,clocks.prefabs,native).policy);
 const n=nativeComponents(native,id);
 for(const r of Object.values(entry.levels))assert.equal(awakenBossNative(r,n),true,`level ${r.level}`);
 assert.equal(awakenBossNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'M2.atk':.3}}},n),false);
 const proj=structuredClone(native);
 for(const row of proj.projectiles.projectile_enemy_bbrain_left){const d=JSON.parse(row.originalJson);if('_speed'in d){d._speed=4;row.originalJson=JSON.stringify(d);}}
 assert.equal(awakenBossNative(record,nativeComponents(proj,id)),false);
});

test('Journey shoots left and right at speed 3 and stops on the first ground unit',()=>{
 const h=fixture(),{b,e,p,ops:[left,right,above]}=h,j=p.journey;
 h.run(j.initial+j.anim.release+3/j.speed+.3);
 assert.deepEqual([left,right,above].map(u=>tagged(h.hits,'awakenJourney',u).length),[1,1,0]);
 assert.ok(tagged(h.hits,'awakenJourney').every(x=>x.type==='phys'&&x.amount===e.s.atk*j.scale));
 assert.ok(e.s.flags.noMove);assert.equal(e.profile.noAttack,true);
 assert.deepEqual(b.errors,[]);
});

test('Blink jumps to the next checkpoint and, 1 s later, Shattered Vision splits 500% ATK over the ground units',()=>{
 const h=fixture(),{b,e,p,ab,ops}=h,v=p.vision;
 e.route={legs:[{t:'move',r:9,c:7},{t:'move',r:9,c:11,final:true}],legIdx:0};
 ab.blinkLeft=0;ab.journeyLeft=1e9;h.run(.1);
 assert.deepEqual([e.y,e.x],[9,7]);assert.ok(e.s.flags.untargetable,'blink protection');
 h.run(p.blink.hide+v.prepare+v.release+.1);
 const shares=tagged(h.hits,'awakenVision');
 assert.equal(shares.length,ops.length);assert.ok(shares.every(x=>Math.abs(x.amount-e.s.atk*v.scale/ops.length)<1e-9&&x.type==='phys'));
 assert.equal(blinkToNextCheckpoint(e),false,'no further checkpoint');
 assert.deepEqual(b.errors,[]);
});

test('the revive releases the wave, fills the inactive Power Armors and brings the four-way second form',()=>{
 const h=fixture(),{b,e,p,ops:[left,right,above]}=h,calls=[],atk=e.s.atk;
 b.stageWaveScheduler={releaseCurrentWave:(...args)=>{calls.push(args);return true;}};
 const armor=b.spawnEnemy(id,{pos:[2,2],route:0});armor.mem.ab=null;armor.skill={sp:0,spCost:30};b.addBuff(armor,{key:'lypa[car_mark]',persist:true});
 b.kill(e,left);assert.equal(e.alive,true);h.run(p.rebirth+.05);
 assert.deepEqual(calls,[[e,{trackSourceAtNextWave:true}]]);assert.equal(armor.skill.sp,30);
 assert.equal(e.hp,e.s.maxHp);assert.ok(Math.abs(e.s.atk-atk*(1+p.form2Atk))<1e-9);
 h.run(p.journey.initial+p.journey.anim.release+3/p.journey.speed+.3);
 assert.deepEqual([left,right,above].map(u=>tagged(h.hits,'awakenJourney',u).length),[1,1,1]);
 assert.deepEqual(b.errors,[]);
});

test('second form: Shattered Vision also stuns units on high ground for 15 s shared among them',()=>{
 const h=fixture({positions:[[9,2],[11,5],[12,5]]}),{b,e,p,ab,ops:[ground,highA,highB]}=h;
 for(const u of [highA,highB])b.grid.setTile(u.y,u.x,{...b.grid.tile(u.y,u.x),height:'HIGHLAND',build:'RANGED'});
 b.kill(e,ground);h.run(p.rebirth+.05);
 e.route={legs:[{t:'move',r:9,c:6},{t:'move',r:9,c:11,final:true}],legIdx:0};ab.blinkLeft=0;ab.journeyLeft=1e9;
 h.run(p.blink.hide+p.vision.prepare+p.vision.release+.2);
 assert.ok(!ground.s.flags.stun);assert.ok(highA.s.flags.stun&&highB.s.flags.stun);
 const stun=highA.buffs.find(x=>x.status==='stun'||x.key==='stun');assert.ok(stun.timeLeft<=p.vision.stun/2+1e-6);
 assert.deepEqual(b.errors,[]);
});

for(const [stageId,level,first] of [['dv-8',0,[2,8]],['dv-ex-8',1,[5,5]]])
 test(`compiled ${stageId}: 'Awaken' (level ${level}) blinks to her first checkpoint, then her revive fills every Power Armor`,async()=>{
  const {readFile}=await import('node:fs/promises');
  const {StandardBattle}=await import('../server/sim/arkpedia.js');
  const {createStageLibraryLoader}=await import('../shared/arkpedia/stage-library.js');
  const {defaultBuild}=await import('../shared/arkpedia/loadout.js');
  const mvp=JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json',import.meta.url)));
  const manifest=JSON.parse(await readFile(new URL('../data/arkpedia-library.json',import.meta.url)));
  const loader=createStageLibraryLoader(async url=>new Response(await readFile(new URL(`..${url}`,import.meta.url))));
  const stage=await loader.load(manifest.stages.find(s=>s.id===stageId));
  const b=new StandardBattle({...mvp,stage,enemies:{...mvp.enemies,...stage.enemies}},{operators:[{...defaultBuild(mvp.operators.char_151_myrtle)}]},{seed:1});
  const keep=e=>e.findBuff?.('lypa[car_mark]')||e.mem.stageUnitDevice;
  let boss=null;
  const clear=()=>{for(const e of b.enemies)if(e.alive&&e!==boss&&e.defId!==id&&!keep(e))b.kill(e);};
  while(!b.finished&&b.time<900&&!boss){clear();boss=b.enemies.find(e=>e.alive&&e.defId===id);b.step();}
  assert.ok(boss);assert.equal(boss.def.raw?.level,level);
  const armors=b.enemies.filter(e=>e.findBuff?.('lypa[car_mark]'));assert.ok(armors.length>0);
  const run=s=>{const until=b.time+s;while(!b.finished&&b.time<until){clear();b.step();}};
  run(52);assert.deepEqual([boss.y,boss.x],first,'blinked to the next checkpoint');
  b.dealDamage(null,boss,{amount:boss.s.maxHp,type:'true',sourceless:true});assert.equal(boss.alive,true);
  run(10.5);
  assert.equal(boss.form,'form2');
  assert.ok(armors.every(a=>!a.alive||!a.findBuff('lypa[car_mark]')||a.skill.sp>=a.skill.spCost),'every inactive Power Armor filled or activated');
  assert.equal(b.finished,false);assert.deepEqual(b.errors,[]);
 });
