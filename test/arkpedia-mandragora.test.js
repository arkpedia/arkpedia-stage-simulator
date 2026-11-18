// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {GAZE_DEBUFF} from '../server/sim/content/arkpedia-enemy-mandragora.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {mandragoraNative,mandragoraParams} from '../shared/arkpedia/enemy-mandragora-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_1523_mandra',entry=ENEMY_RECORDS.enemies[id],record=entry.levels[0];

/** Mandragora at row 9, col 5 (held still, attacks off); operators [row, col, atk]; a stand-in pillar body far away. */
function fixture({operators=[[9,6,500],[10,5,100]]}={}){
 const defs={chess:{}};
 const units=operators.map(([, ,atk],i)=>{const op=chessRec({id:`mandra_op_${i}`,stats:{maxHp:1e7,atk,def:0,res:0,blockCnt:0}});defs.chess[op.chessId]=op;return {chessId:op.chessId,row:10,col:2+i,dir:'RIGHT'};});
 defs.enemies={[id]:record,enemy_1007_slime:ENEMY_RECORDS.enemies.enemy_1007_slime.levels[0]};
 const h=makeBattle({content:'generic',autoFinish:false,defs,units,setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();ops.forEach((u,i)=>{u.y=operators[i][0];u.x=operators[i][1];});
 const e=b.spawnEnemy(id,{pos:[9,5],route:0}),pillar=b.spawnEnemy('enemy_1007_slime',{pos:[2,2],route:0});
 pillar.mem.stageUnitDevice={pillar:true,state:'intact'};
 for(const u of [e,pillar])b.addBuff(u,{key:'hold',persist:true,flags:{disarm:true,noMove:true}});
 const hits=[];b.on('hit',c=>{if(c.source===e)hits.push({target:c.target,amount:c.dmg.amount,type:c.dmg.type,tags:c.dmg.tags??[],t:b.time});});
 const shield=()=>!!e.findBuff('mandra_stone_skin');
 return {...h,e,ops,pillar,hits,shield,p:mandragoraParams(record),run:s=>{h.run(s);assert.equal(b.finished,false,'the fixture battle must still run');}};
}
const tagged=(hits,tag,u)=>hits.filter(x=>x.tags.includes(tag)&&(!u||x.target===u));

test('both Mandragora levels are admitted, level one as a sparse overlay of talents and skills',()=>{
 assert.ok(enemySupport(entry,clocks.prefabs,native).policy);
 const n=nativeComponents(native,id);
 for(const r of Object.values(entry.levels))assert.equal(mandragoraNative(r,n),true,`level ${r.level}`);
 assert.equal(mandragoraNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'Reborn.duration':4}}},n),false);
 const shield=structuredClone(native);shield.templates['enemy_mandra_in_stone_skin'].eventToActions.ON_APPLIED_MODIFIER[1]._buffKeys=['other'];
 assert.equal(mandragoraNative(record,nativeComponents(shield,id)),false);
 // 9-19 Challenge scales the Gaze.
 const challenge={...record,skills:record.skills.map(s=>s.prefabKey==='PetrifiedRay'?{...s,bb:{...s.bb,atk_scale:1.2}}:s)};
 assert.equal(mandragoraNative(challenge,n),true);
 const one=mandragoraParams(entry.levels[1]);
 assert.deepEqual([one.resistance,one.restore.hpOffset,one.gaze.radius,one.collapse.initial,one.invincible,one.restore.duration],[.65,.35,1.6,20,3,25]);
});

test("Mandragora's Gaze channels on the highest-ATK operator for 7.1 s, then waits 15 s",()=>{
 const h=fixture(),{b,e,p,ops:[strong,weak]}=h,g=p.gaze;
 h.run(g.initial+g.predelay+.05);
 assert.ok(strong.findBuff(GAZE_DEBUFF));assert.ok(!weak.findBuff(GAZE_DEBUFF));
 assert.equal(strong.s.aspd,Math.max(20,100*g.aspdMul));
 h.run(g.window);
 const ticks=tagged(h.hits,'mandragoraGaze',strong);
 assert.equal(ticks.length,Math.floor((g.window-g.firstHit)/g.hitInterval)+1);
 assert.ok(ticks.every(x=>x.type==='arts'&&x.amount===e.s.atk*g.scale));
 assert.ok(!strong.findBuff(GAZE_DEBUFF),'released at the end of the channel');
 h.run(g.cooldown-1);assert.equal(tagged(h.hits,'mandragoraGaze').length,ticks.length,'cooling down');
 h.run(1.5);assert.ok(strong.findBuff(GAZE_DEBUFF),'gazes again after 15 s');
 assert.deepEqual(b.errors,[]);
});

test('a gazed operator that leaves seals its tile, and the Gaze moves to the next operator',()=>{
 const h=fixture(),{b,p,ops:[strong,weak]}=h,g=p.gaze;
 h.run(g.initial+g.predelay+.05);
 const row=Math.round(strong.y),col=Math.round(strong.x);
 b.kill(strong);h.run(.5);
 assert.equal(b.grid.tile(row,col).build,'NONE');assert.deepEqual(b.mandragoraSeals,[{row,col}]);
 assert.ok(weak.findBuff(GAZE_DEBUFF));
 assert.deepEqual(b.errors,[]);
});

test('a Tattered Pillar breaks the Stoneshield: the Gaze stops without a seal, and the shield returns after 25 s or 40% HP',()=>{
 const h=fixture(),{b,e,p,pillar,ops:[strong]}=h,g=p.gaze;
 const taken=[];b.on('damaged',c=>{if(c.target===e)taken.push(c.amount);});
 b.dealDamage(strong,e,{amount:1000,type:'arts'});assert.ok(Math.abs(taken[0]-1000*(1-e.s.res/100)*(1-p.resistance))<1e-6);
 h.run(g.initial+g.predelay+.05);assert.ok(strong.findBuff(GAZE_DEBUFF));
 b.dealDamage(pillar,e,{amount:100,type:'true'});
 assert.equal(h.shield(),false);assert.ok(!strong.findBuff(GAZE_DEBUFF));assert.equal((b.mandragoraSeals??[]).length,0);
 h.run(p.restore.duration-.5);assert.equal(h.shield(),false);
 h.run(1+p.skin.duration);assert.equal(h.shield(),true,'back after 25 s');
 // The HP path: a further 40% of max HP lost brings it back early.
 b.dealDamage(pillar,e,{amount:100,type:'true'});assert.equal(h.shield(),false);
 b.dealDamage(strong,e,{amount:e.s.maxHp*(p.restore.hpOffset+.02),type:'true'});h.run(p.skin.duration+.2);
 assert.equal(h.shield(),true,'back after losing 40% HP');
 assert.deepEqual(b.errors,[]);
});

test('the revive releases the wave and brings the second form: hovering, 3 s invincible, burning aura, Gaze after 10 s',()=>{
 const h=fixture({operators:[[9,6,500]]}),{b,e,p,pillar,ops:[near]}=h,calls=[];
 b.stageWaveScheduler={releaseCurrentWave:(...args)=>{calls.push(args);return true;}};
 b.kill(e,near);assert.equal(e.alive,true);
 h.run(p.rebirth+.05);
 assert.deepEqual(calls,[[e]]);assert.equal(e.hp,e.s.maxHp);assert.ok(e.s.flags.invulnerable);assert.ok(e.s.flags.float);
 h.run(2);const aura=tagged(h.hits,'mandragoraAura',near);
 assert.ok(aura.length>=2);assert.ok(aura.every(x=>x.type==='arts'&&x.amount===e.s.atk*p.aura.scale));
 h.run(p.gaze.form2Reset-2-.5);assert.ok(!near.findBuff(GAZE_DEBUFF));h.run(1);assert.ok(near.findBuff(GAZE_DEBUFF));
 // A pillar in the second form: the shield, hover and aura go; she staggers, then recovers them.
 b.dealDamage(pillar,e,{amount:100,type:'true'});assert.equal(h.shield(),false);assert.ok(!e.s.flags.float);
 const before=tagged(h.hits,'mandragoraAura').length;h.run(3);assert.equal(tagged(h.hits,'mandragoraAura').length,before);
 h.run(p.restore.duration+p.skin.duration);assert.equal(h.shield(),true);assert.ok(e.s.flags.float);
 assert.deepEqual(b.errors,[]);
});

async function compiled(stageId){
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
 while(!b.finished&&b.time<900&&!boss){for(const e of b.enemies)if(e.alive&&e.defId!==id&&!e.mem.stageUnitDevice)b.kill(e);boss=b.enemies.find(e=>e.alive&&e.defId===id);b.step();}
 assert.ok(boss,'Mandragora spawns');
 const run=s=>{const until=b.time+s;while(!b.finished&&b.time<until){for(const e of b.enemies)if(e.alive&&e!==boss&&!e.mem.stageUnitDevice)b.kill(e);b.step();}};
 return {b,boss,run};
}
for(const [stageId,level] of [['9-19',0],['h9-6',1]])
 test(`compiled ${stageId} runs Mandragora (level ${level}) into the second form`,async()=>{
  const {b,boss,run}=await compiled(stageId);
  assert.equal(boss.def.raw?.level,level);
  b.addBuff(boss,{key:'hold',persist:true,flags:{noMove:true}});
  b.dealDamage(null,boss,{amount:boss.s.maxHp,type:'true',sourceless:true});assert.equal(boss.alive,true);
  run(8);assert.equal(boss.form,'form2');assert.ok(boss.s.flags.float,'hovering behind her Stoneshield');
  assert.equal(b.finished,false);assert.deepEqual(b.errors,[]);
 });
test('compiled 9-19: a real Tattered Pillar collapse breaks her Stoneshield',async()=>{
 const {b,boss,run}=await compiled('9-19');
 const pillar=b.enemies.find(e=>e.alive&&e.mem.stageUnitDevice?.pillar&&b.grid.inRect(e.tileR,e.tileC+1));
 b.addBuff(boss,{key:'hold',persist:true,flags:{noMove:true}});
 boss.x=pillar.tileC+1;boss.y=pillar.tileR;assert.ok(boss.findBuff('mandra_stone_skin'));
 b.stageDemolition.collapse(pillar,'RIGHT');run(2);
 assert.ok(!boss.findBuff('mandra_stone_skin'),'the pillar broke the Stoneshield');assert.deepEqual(b.errors,[]);
});
test('compiled 9-19 Challenge scales the Gaze and the aura',async()=>{
 const {boss}=await compiled('9-19_challenge_mode');
 const raw=boss.def.raw;
 assert.equal(raw.skills.find(s=>s.prefabKey==='PetrifiedRay').bb.atk_scale,1.2);
 assert.ok(Math.abs(raw.talents.bb['StoneSkin_2.atk_scale']-.45)<1e-9);
});
