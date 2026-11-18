// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {applyStageEnemyBlackboard} from '../shared/arkpedia/stage-enemy-talents.js';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {manfredNative,manfredParams} from '../shared/arkpedia/enemy-manfred-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_1528_manfri',entry=ENEMY_RECORDS.enemies[id],record=entry.levels[0];
const PREFAB='dyn/battle/prefabs/enemies/enemy_1528_manfri.prefab';
const ARTILLERY='Londinium Secondary Defense Artillery';
const H10_1=[{key:'Shield.disable_duration',value:12,valueStr:null},{key:'Funnel_s1.attack@ep_damage_ratio',value:.2,valueStr:null},{key:'Funnel_s2.attack@ep_damage_ratio',value:.2,valueStr:null}];
const H10_2=[{key:'Funnel_s2.times',value:2,valueStr:null},{key:'Funnel_s2_charge.sp',value:12,valueStr:null}];
const staged=(blackboard,r=entry.levels[1])=>applyStageEnemyBlackboard(r,{level:r.level,blackboard,skills:null,spData:null});

/** Manfred at row 9, col 5, held still and disarmed; operators (block 0) at [row, col]; one stage artillery whose SP is read directly. */
function fixture(positions=[[9,6]],{rec=record}={}){
 const op=chessRec({id:'manfri_target',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:rec}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:2+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();ops.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const device={kind:'device',name:ARTILLERY,key:'trap_058_gunctrl',row:0,col:0,sp:0,acc:0};
 b.mvpStageDevices=[device];
 // The harness battle is not the stage battle; borrow the stage battle's own charge method.
 b.chargeStageArtillery=StandardBattle.prototype.chargeStageArtillery;
 const releases=[];b.stageWaveScheduler={releaseCurrentWave:(...args)=>{releases.push(args);return true;}};
 const e=b.spawnEnemy(id,{pos:[9,5],route:0});
 // Held and disarmed: the tests call his attack hook directly.
 b.addBuff(e,{key:'hold',persist:true,flags:{noMove:true,disarm:true}});
 const ab=e.mem.ab.list.find(a=>'posing'in a),attack=e.mem.ab.list.find(a=>a.attack);
 const hits=[];b.on('hit',c=>{if(c.source===e||c.target===e)hits.push({target:c.target,amount:c.dmg.amount,type:c.dmg.type,isAttack:!!c.dmg.isAttack,tags:c.dmg.tags??[]});});
 // Element damage has no 'hit' event; its HP damage arrives as 'damaged'.
 const necrosis=[];b.on('damaged',c=>{if(c.source===e&&c.dmg?.type==='element')necrosis.push([c.target,c.dmg.element,c.dmg.amount]);});
 const strike=target=>attack.attack({targets:[target]},b,e,ab);
 return {...h,e,ops,ab,hits,necrosis,device,releases,strike,p:manfredParams(rec),run:s=>{h.run(s);assert.equal(b.finished,false,'the fixture battle must still run');}};
}
const tagged=(hits,tag)=>hits.filter(x=>x.tags.includes(tag));
const withComponent=(test,edit)=>{const n=structuredClone(native);for(const row of n.prefabs[PREFAB]){const d=JSON.parse(row.originalJson);if(test(d)){edit(d);row.originalJson=JSON.stringify(d);}}return nativeComponents(n,id);};
const evading=e=>e.buffs.some(x=>x.key==='enemy_manfri_evade');
const artilleryHit=(b,e)=>b.dealDamage(null,e,{amount:3000,type:'true',sourceless:true,ignoreSelect:true,tags:['device','artillery']});

test('both levels of Manfred are admitted only with the complete native tree; H10-1 and H10-2 overrides only',()=>{
 assert.ok(enemySupport(entry,clocks.prefabs,native).policy);
 const n=nativeComponents(native,id);
 for(const r of Object.values(entry.levels))assert.equal(manfredNative(r,n),true,`level ${r.level}`);
 assert.equal(manfredNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'Shield.prob':.5}}},n),false);
 assert.equal(manfredNative({...record,talents:{...record.talents,bbStr:{'aura.isenabled':'aura_on'}}},n),false,'the H10-3 aura is not built');
 assert.equal(manfredNative({...record,skills:record.skills.map(s=>s.prefabKey==='Funnel_rage'?{...s,bb:{atk_scale:.5}}:s)},n),false);
 assert.equal(manfredNative(record,withComponent(d=>d._hpRechargeRatio===1,d=>{d._hpRechargeRatio=.5;})),false,'revive HP');
 assert.equal(manfredNative(record,withComponent(d=>d._maxRespawnCnt===1,d=>{d._maxRespawnCnt=2;})),false,'one revive');
 // Stage overrides: the reviewed parameters change, the aura stays off.
 const one=staged(H10_1),two=staged(H10_2);
 for(const r of [one,two])assert.equal(manfredNative(r,n),true);
 assert.deepEqual([manfredParams(one).evade.disable,manfredParams(one).form1.ep,manfredParams(one).form2.ep],[12,.2,.2]);
 assert.deepEqual([manfredParams(two).funnel.times,manfredParams(two).charge.funnel],[2,12]);
 assert.throws(()=>staged([{key:'aura.isenabled',value:0,valueStr:'aura_on'}]),/Unsupported original enemy parameter/);
 assert.throws(()=>staged([{key:'aura.range_radius',value:1.25,valueStr:null}]),/Unsupported original enemy parameter/);
});

test('form one: a 50% Arts shot that charges the artillery 3 SP; Focus stacks on one target and resets',()=>{
 const h=fixture([[9,6],[9,7]]),{b,e,p,ab,hits,device,strike}=h,[one,two]=h.ops;
 strike(one);
 assert.deepEqual(tagged(hits,'manfriCannon').map(x=>[x.target,x.amount,x.type,x.isAttack]),[[one,e.s.atk*.5,'arts',true]]);
 assert.equal(device.sp,p.charge.attack);assert.equal(p.charge.attack,3);
 const aspd=e.s.aspd;
 for(let i=1;i<=6;i++)strike(one);
 assert.equal(ab.focus,5,'capped at 5 stacks');assert.equal(e.s.aspd,aspd+5*60);
 assert.equal(device.sp,7*3);
 strike(two);assert.equal(ab.focus,0,'switching targets resets');assert.equal(e.s.aspd,aspd);
 strike(two);assert.equal(ab.focus,1);
 h.run(p.focus.hold+.1);assert.equal(ab.focus,0,'six idle seconds reset');assert.equal(e.s.aspd,aspd);
 device.sp=118;strike(two);assert.equal(device.sp,120,'capped at the artillery cost');
 assert.deepEqual(b.errors,[]);
});

test('Military Training: 80% dodge until the artillery hits him, then an 8 s stun and 30 s without it; a re-hit restarts it',()=>{
 const h=fixture(),{b,e,p,ab}=h;
 assert.ok(evading(e));assert.equal(e.s.dodgePhys,.8);assert.equal(e.s.dodgeArts,.8);
 b.dealDamage(null,e,{amount:100,type:'true',sourceless:true,tags:['device','pulse']});assert.ok(evading(e),'only the artillery');
 artilleryHit(b,e);
 assert.ok(!evading(e));assert.equal(e.s.dodgePhys,0);assert.ok(e.s.flags.stun);
 h.run(p.evade.stun-.1);assert.ok(e.s.flags.stun);h.run(.2);assert.ok(!e.s.flags.stun,'8 s stun');
 h.run(10);artilleryHit(b,e);assert.ok(e.s.flags.stun,'a hit while disabled stuns again');
 h.run(p.evade.disable-.2);assert.ok(!evading(e),'the timer restarted');
 h.run(.3);assert.ok(evading(e),'dodge restored');assert.equal(ab.disableTimer,null);
 assert.deepEqual(b.errors,[]);
});

test('first knock-out: wave released, a 20 s barrage every 0.8 s charging 6 SP, full HP, the Pose clip, then the sword and funnel',()=>{
 const h=fixture([[9,6],[3,3]]),{b,e,p,ab,hits,device,releases,strike}=h,[near,far]=h.ops;
 artilleryHit(b,e);assert.ok(ab.disableTimer);
 b.kill(e,near);assert.equal(e.alive,true);
 assert.deepEqual(releases.map(([u,o])=>[u,o.trackSourceAtNextWave]),[[e,true]]);
 assert.ok(!evading(e));assert.equal(ab.disableTimer,null);
 device.sp=0;
 h.run(p.rebirth.dur-.05);
 const rage=tagged(hits,'manfriRage');
 assert.equal(rage.length,Math.floor((p.rebirth.dur-.05)/p.rebirth.interval));
 assert.ok(rage.every(x=>x.amount===e.s.atk*p.rebirth.rageScale&&x.type==='arts'));
 assert.ok(rage.some(x=>x.target===far)&&rage.some(x=>x.target===near),'random operators anywhere');
 assert.equal(device.sp,Math.min(120,rage.length*p.charge.rage));
 h.run(.1);
 assert.equal(e.hp,e.s.maxHp,'full HP');assert.ok(e.s.flags.invulnerable,'5 s invincible');
 const count=tagged(hits,'manfriRage').length;
 h.run(p.rebirth.pose-.2);assert.equal(e.profile.noAttack,true,'the Revive clip');assert.equal(tagged(hits,'manfriRage').length,count,'the barrage ended');
 assert.ok(!evading(e));
 h.run(.3);assert.equal(e.profile.noAttack,false);assert.ok(!e.s.flags.invulnerable);assert.ok(evading(e),'dodge again in the sword form');
 hits.length=0;device.sp=0;strike(near);
 assert.deepEqual(tagged(hits,'manfriSword').map(x=>[x.target,x.amount,x.type]),[[near,e.s.atk,'phys']]);
 assert.equal(device.sp,0,'the sword does not charge');
 h.run(.3);
 assert.deepEqual(tagged(hits,'manfriFunnel').map(x=>[x.target,x.amount,x.type,x.isAttack]),[[near,e.s.atk*p.funnel.scale,'arts',false]]);
 assert.equal(device.sp,p.charge.funnel);
 b.kill(e,near);assert.equal(e.alive,false,'the second knock-out is final');
 assert.deepEqual(b.errors,[]);
});

test('H10-1 and H10-2 overrides: Necrosis on both normal attacks, a 12 s disable, two funnel hits charging 12 each',()=>{
 {
  const h=fixture([[9,6]],{rec:staged(H10_1)}),{b,e,p,necrosis,strike}=h,[op]=h.ops;
  strike(op);
  assert.deepEqual(necrosis,[[op,'apoptosis',e.s.atk*.2]],'the cannon shot');
  artilleryHit(b,e);h.run(p.evade.disable-.1);assert.ok(!evading(e));h.run(.2);assert.ok(evading(e),'12 s');
  b.kill(e,op);h.run(p.rebirth.dur+p.rebirth.pose+.1);necrosis.length=0;
  strike(op);h.run(.3);
  assert.deepEqual(necrosis,[[op,'apoptosis',e.s.atk*.2]],'the sword; the funnel keeps its own ratio (0)');
  assert.deepEqual(b.errors,[]);
 }
 for(const [positions,expect] of [[[[9,6],[9,7]],'other'],[[[9,6]],'same']]){
  const h=fixture(positions,{rec:staged(H10_2)}),{b,e,p,ab,hits,device,strike}=h,[op,other]=h.ops;
  b.kill(e,op);h.run(p.rebirth.dur+p.rebirth.pose+.1);
  hits.length=0;device.sp=0;strike(op);
  h.run(.3);assert.deepEqual(tagged(hits,'manfriFunnel').map(x=>x.target),[op]);
  h.run(p.funnel.bounceInterval);
  assert.deepEqual(tagged(hits,'manfriFunnel').map(x=>x.target),expect==='other'?[op,other]:[op,op],expect);
  assert.equal(device.sp,2*12);assert.equal(ab.form,2);
  assert.deepEqual(b.errors,[]);
 }
});

for(const [stageId,level] of [['10-17',0],['10-17_adverse_environment',0],['h10-1_adverse_environment',1],['h10-2_adverse_environment',1]])
 test(`compiled ${stageId}: Manfred (level ${level}) charges the artillery, releases the wave and revives into the sword form`,async()=>{
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
  while(!b.finished&&b.time<1200&&!boss){clear();boss=b.enemies.find(e=>e.alive&&e.defId===id);b.step();}
  assert.ok(boss);assert.equal(boss.def.raw?.level,level);
  const artillery=b.mvpStageDevices.find(d=>d.name===ARTILLERY);assert.ok(artillery,'one artillery');
  const ab=boss.mem.ab.list.find(a=>'posing'in a);
  const run=s=>{const until=b.time+s;while(!b.finished&&b.time<until){clear();b.step();}};
  b.addBuff(boss,{key:'hold',persist:true,flags:{noMove:true}});
  const myrtle=b.allies().find(u=>u.alive)??null;
  if(myrtle){myrtle.x=boss.x+1;myrtle.y=boss.y;}
  const sp0=artillery.sp,t0=b.time;run(12);
  if(myrtle?.alive)assert.ok(artillery.sp>=Math.min(120,sp0+(b.time-t0))+ (artillery.sp>=120?0:3)-1e-6||artillery.sp<sp0,'his attacks add SP on top of 1/s');
  b.dealDamage(null,boss,{amount:boss.hp,type:'true',sourceless:true});assert.equal(boss.alive,true);assert.equal(ab.state,'reborn');
  run(manfredParams(boss.def.raw).rebirth.dur+manfredParams(boss.def.raw).rebirth.pose+.5);
  assert.equal(ab.form,2,'sword form');assert.ok(evading(boss));
  assert.equal(b.finished,false);assert.deepEqual(b.errors,[]);
 });
