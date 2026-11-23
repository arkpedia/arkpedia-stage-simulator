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
const H10_3=[{key:'aura.isenabled',value:0,valueStr:'aura_on'},{key:'Shield.disable_duration',value:8,valueStr:null},{key:'aura.range_radius',value:1.25,valueStr:null}];
const H10_2=[{key:'Funnel_s2.times',value:2,valueStr:null},{key:'Funnel_s2_charge.sp',value:12,valueStr:null}];
const staged=(blackboard,r=entry.levels[1])=>applyStageEnemyBlackboard(r,{level:r.level,blackboard,skills:null,spData:null});

/** Manfred at row 9, col 5, held still and disarmed; operators (block 0) at [row, col]; one stage artillery whose SP is read directly. */
function fixture(positions=[[9,6]],{rec=record}={}){
 const op=chessRec({id:'manfri_target',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:rec}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:2+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();ops.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const device={kind:'device',name:ARTILLERY,key:'trap_058_gunctrl',row:0,col:0,hidden:false,sp:0,acc:0,artillery:{damage:3000,spCost:120,initSp:0,spPerSecond:1,area:'artillery'}};
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
 assert.equal(manfredNative({...record,talents:{...record.talents,bbStr:{'aura.isenabled':'aura_on'}}},n),true,'the H10-3 switch');
 assert.equal(manfredNative({...record,talents:{...record.talents,bbStr:{'aura.isenabled':'aura_x'}}},n),false,'only the two native values');
 assert.equal(manfredNative({...record,skills:record.skills.map(s=>s.prefabKey==='Funnel_rage'?{...s,bb:{atk_scale:.5}}:s)},n),false);
 assert.equal(manfredNative(record,withComponent(d=>d._hpRechargeRatio===1,d=>{d._hpRechargeRatio=.5;})),false,'revive HP');
 assert.equal(manfredNative(record,withComponent(d=>d._maxRespawnCnt===1,d=>{d._maxRespawnCnt=2;})),false,'one revive');
 // Stage overrides: the reviewed parameters change; only H10-3 turns the aura on.
 const one=staged(H10_1),two=staged(H10_2);
 for(const r of [one,two])assert.equal(manfredNative(r,n),true);
 assert.deepEqual([manfredParams(one).evade.disable,manfredParams(one).form1.ep,manfredParams(one).form2.ep],[12,.2,.2]);
 assert.deepEqual([manfredParams(two).funnel.times,manfredParams(two).charge.funnel],[2,12]);
 for(const r of [one,two])assert.equal(manfredParams(r).aura.on,false);
 const three=staged(H10_3);
 assert.equal(manfredNative(three,n),true);
 assert.deepEqual(manfredParams(three).aura,{on:true,interval:.5,scale:.05,radius:1.25,creationMark:'ab:bloodsuckerMark',
  rebirthable:['enemy_1222_dpvt','enemy_1222_dpvt_2','enemy_1223_dmech','enemy_1223_dmech_2','enemy_1225_dkmage','enemy_1225_dkmage_2','enemy_1226_dklord','enemy_1226_dklord_2']});
 assert.equal(manfredParams(three).evade.disable,8);
 assert.throws(()=>staged([{key:'aura.isenabled',value:0,valueStr:'aura_x'}]),/Unsupported injected enemy parameter/);
 assert.throws(()=>staged([{key:'aura.isenabled',value:1,valueStr:'aura_on'}]),/Unsupported injected enemy parameter/);
 assert.throws(()=>staged([{key:'aura.range_radius',value:0,valueStr:null}]),/Unsupported original enemy parameter/);
});

test('H10-3 aura: rebirthable Heirbearers and Reborn Creations burn nearby operators for 5% of his ATK every 0.5 s',()=>{
 const rec=staged(H10_3),keys=['enemy_1222_dpvt_2','enemy_1220_dzoms_2','enemy_1224_dsuply_2'];
 const defs=Object.fromEntries([[id,rec],...keys.map(k=>[k,ENEMY_RECORDS.enemies[k].levels[0]])]);
 const op=chessRec({id:'manfri_aura_target',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:defs},
  units:[0,1,2,3].map(i=>({chessId:op.chessId,row:10,col:2+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();
 const hold=u=>b.addBuff(u,{key:'hold',persist:true,flags:{noMove:true,disarm:true}});
 const burns=[];b.on('damaged',c=>{if(c.dmg?.tags?.includes('manfriAura'))burns.push([c.target,c.dmg.amount,c.dmg.type,b.time,c.source??null]);});
 // Warrior Captain at (2,2), Touch of Benevolence at (2,8), Retrofit ASV (no marker) at (6,5); Manfred far away.
 const [w,t,asv]=[[2,2],[2,8],[6,5]].map((pos,i)=>{const u=b.spawnEnemy(keys[i],{pos,route:0});hold(u);return u;});
 // Operators: 1.2 from the Warrior (in), 1.3 from the Touch (out), 0.5 from the ASV (no carrier), and one in both.
 [[w,1.2,0],[t,1.3,0],[asv,.5,0],[w,0,1]].forEach(([u,dx,dy],i)=>{ops[i].x=u.x+dx;ops[i].y=u.y+dy;});
 h.run(1);assert.equal(burns.length,0,'nothing before Manfred is present');
 const m=b.spawnEnemy(id,{pos:[9,5],route:0});hold(m);
 const start=b.time;
 h.run(.45);assert.equal(burns.length,0,'the derived buff waits one interval');
 h.run(.1);
 const amount=m.s.atk*.05;assert.equal(amount,1200*.05);
 assert.deepEqual(burns.map(x=>[x[0],x[1],x[2],x[4]]),[[ops[0],amount,'arts',null],[ops[3],amount,'arts',null]]);
 h.run(1.5);
 assert.equal(burns.filter(x=>x[0]===ops[0]).length,4,'every 0.5 s');
 assert.equal(burns.some(x=>x[0]===ops[1]||x[0]===ops[2]),false,'outside 1.25 / not a carrier');
 // The Touch carries it too: move an operator to 1.0 from it.
 ops[1].x=t.x+1;const before=burns.length;h.run(.5);
 assert.ok(burns.slice(before).some(x=>x[0]===ops[1]),'a Reborn Creation burns as well');
 // Manfred's final departure ends the aura.
 b.removeUnit?.(m)??(m.alive=false);
 const n=burns.length;h.run(2);assert.equal(burns.length,n,'no ticks once he is gone');
 assert.ok(b.time>start);assert.deepEqual(b.errors,[]);
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

// Literal per-stage expectations, so the compiled overrides are observed rather than read back from the record:
// [stage, level, max HP after the stage runes, funnel hits per shot, SP per funnel hit, dodge disable seconds].
// H10-3's two attribute runes are NORMAL-difficulty only, so its adverse environment keeps the database HP.
for(const [stageId,level,maxHp,times,hitSp,disable] of [['10-17',0,40000,1,6,30],['10-17_adverse_environment',0,48000,1,6,30],
 ['h10-1_adverse_environment',1,60000,1,6,12],['h10-2_adverse_environment',1,72000,2,12,30],['h10-3_adverse_environment',1,60000,1,6,8]])
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
  assert.ok(boss);assert.equal(boss.def.raw?.level,level);assert.equal(boss.s.maxHp,maxHp,'stage runes');
  const artillery=b.mvpStageDevices.find(d=>d.name===ARTILLERY);assert.ok(artillery,'one artillery');
  const ab=boss.mem.ab.list.find(a=>'posing'in a);
  const run=s=>{const until=b.time+s;while(!b.finished&&b.time<until){clear();b.step();}};
  b.addBuff(boss,{key:'hold',persist:true,flags:{noMove:true}});
  // One invulnerable operator beside him, so that both his shots and the barrage have a target.
  b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
  let myrtle=null;
  for(let r=0;r<stage.geometry.tileGrid.length&&!myrtle;r++)for(let c=0;c<stage.geometry.tileGrid[0].length&&!myrtle;c++){try{myrtle=b.deployOperator('char_151_myrtle',r,c,'RIGHT');}catch{}}
  assert.ok(myrtle);b.addBuff(myrtle,{key:'probe',persist:true,flags:{invulnerable:true}});myrtle.y=boss.y;myrtle.x=boss.x+1;
  let charged=0;const calls=[];const charge=b.chargeStageArtillery.bind(b);b.chargeStageArtillery=n=>{charged+=n;calls.push(n);return charge(n);};
  const p=manfredParams(boss.def.raw),h3=stageId==='h10-3_adverse_environment';
  assert.deepEqual([p.aura.on,p.aura.radius],[h3,h3?1.25:1.1],'only H10-3 switches the aura on, at 1.25');
  // At least one shot: an artillery blast aimed at the operator beside him also stuns him for 8 s.
  run(12);assert.ok(charged>=p.charge.attack&&charged%p.charge.attack===0,`his shots charge the artillery (${charged})`);
  const wave=b.stageWaveScheduler.membership(boss).wave;
  b.dealDamage(null,boss,{amount:boss.hp,type:'true',sourceless:true});assert.equal(boss.alive,true);assert.equal(ab.state,'reborn');
  // FinishCurrentWave with the next-wave option: he joins the next wave when there is one (H10-2 has a single wave).
  const last=wave+1>=b.stageWaveScheduler.program.waves.length;
  assert.equal(b.stageWaveScheduler.membership(boss).wave,last?wave:wave+1,'the knock-out releases the wave');
  charged=0;run(p.rebirth.dur+.05);
  // 24 shots: the 25th tick would fall at the instant the 20 s revive ends.
  assert.equal(charged,Math.floor((p.rebirth.dur-1e-6)/p.rebirth.interval)*p.charge.rage,'the barrage charges every 0.8 s');
  assert.equal(boss.hp,boss.s.maxHp);
  run(p.rebirth.pose+.5);
  assert.equal(ab.form,2,'sword form');assert.ok(evading(boss));
  // The stage's disable duration, through the real artillery-tagged damage path.
  artillery.sp=0;b.dealDamage(null,boss,{amount:3000,type:'true',sourceless:true,ignoreSelect:true,tags:['device','artillery']});
  // The artillery is held empty meanwhile: a real blast at the operator beside him would re-hit him and restart the timer.
  const quiet=t=>{const until=b.time+t;while(!b.finished&&b.time<until){clear();artillery.sp=0;b.step();}};
  assert.ok(!evading(boss));quiet(disable-.2);assert.ok(!evading(boss),`still disabled before ${disable} s`);quiet(.4);assert.ok(evading(boss),`dodge back after ${disable} s`);
  // Sword-form attacks through the engine: each funnel shot charges times x Funnel_s2_charge.sp.
  // The invulnerable operator raises no 'hit' events: attacks come from the attack event, funnel hits from the charge calls.
  const swords=[];b.on('attack',c=>{if(c.attacker===boss)swords.push(c.targets[0]);});
  charged=0;calls.length=0;run(20);const funnels=calls;
  assert.ok(swords.length>0,'he attacks in the sword form');assert.ok(funnels.every(n=>n===hitSp),`${hitSp} SP per funnel hit (${funnels})`);
  // `times` hits per shot, give or take one shot straddling each end of the window.
  assert.ok(funnels.length<=(swords.length+1)*times&&funnels.length>=(swords.length-1)*times,`${funnels.length} funnel hits for ${swords.length} sword attacks`);
  assert.equal(b.finished,false);assert.deepEqual(b.errors,[]);
 });
