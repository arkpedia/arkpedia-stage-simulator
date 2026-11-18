// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {mephistoNative,mephistoParams} from '../shared/arkpedia/enemy-mephisto-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_1514_smephi',entry=ENEMY_RECORDS.enemies[id],record=entry.levels[0];

/** Mephisto at row 9, col 5 (attacks off); one ground operator far away; a Host slime (tag mutant) beside him. */
function fixture(){
 const op=chessRec({id:'smephi_target',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record,enemy_1007_slime:ENEMY_RECORDS.enemies.enemy_1007_slime.levels[0]}},
  units:[{chessId:op.chessId,row:10,col:2,dir:'RIGHT'}],setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const [far]=h.allies();far.y=2;far.x=14;
 const e=b.spawnEnemy(id,{pos:[9,5],route:0}),host=b.spawnEnemy('enemy_1007_slime',{pos:[9,7],route:0});
 host.tags.add('mutant');host.base.maxHp=host.s.maxHp=host.hp=1e6;
 for(const u of [e,host])b.addBuff(u,{key:'hold',persist:true,flags:{disarm:true,noMove:true}});
 const ab=e.mem.ab.list.find(a=>'stacks'in a);ab.blinkLeft=1e9;
 const dust=[];b.on('hit',c=>{if(c.dmg?.tags?.includes('mephistoDust'))dust.push({target:c.target,amount:c.dmg.amount,t:b.time});});
 return {...h,e,far,host,ab,dust,p:mephistoParams(record),run:s=>{h.run(s);assert.equal(b.finished,false,'the fixture battle must still run');}};
}

test('both Mephisto levels are admitted, level one as a sparse skill overlay',()=>{
 assert.ok(enemySupport(entry,clocks.prefabs,native).policy);
 const n=nativeComponents(native,id);
 for(const r of Object.values(entry.levels))assert.equal(mephistoNative(r,n),true,`level ${r.level}`);
 assert.equal(mephistoNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'shield.def':2000}}},n),false);
 const doubled={...record,skills:record.skills.map(s=>s.prefabKey==='Poison'?{...s,bb:{...s.bb,damage:100}}:s)};
 assert.equal(mephistoNative(doubled,n),true,'M8-8 doubles the dust');
 const one=mephistoParams(entry.levels[1]);
 assert.deepEqual([one.toxicity.damage,one.blink.initial,one.blink.cooldowns[0],one.heal.cooldown],[80,90,105,10]);
 assert.ok(Math.abs(one.blink.hide-1.4167)<1e-3);
});

test('Hosts gain ATK and ASPD while he is Active, more in Rage, none while Dormant',()=>{
 const h=fixture(),{b,e,p,host}=h,atk=host.s.atk;
 h.run(.1);assert.ok(Math.abs(host.s.atk-atk*(1+p.active.hostAtk))<1e-9);assert.equal(host.s.aspd,100+p.active.hostAspd);
 b.kill(e,h.far);h.run(p.rebirth+.1);assert.equal(host.s.atk,atk,'Dormant: no aura');
 h.ab.dormantUntil=b.time;h.run(p.rebirth+.2);
 assert.ok(Math.abs(host.s.atk-atk*(1+p.rage.hostAtk))<1e-9);assert.equal(host.s.aspd,100+p.rage.hostAspd);
 assert.deepEqual(b.errors,[]);
});

test('every 20% of HP lost adds a 30 s Toxicity stack; the dust deals stacks x 50 true damage each second',()=>{
 const h=fixture(),{b,e,p,far,dust}=h;
 b.dealDamage(far,e,{amount:e.s.maxHp*.2,type:'true'});assert.equal(h.ab.stacks.length,1);assert.ok(e.s.flags.invulnerable,'Dust Release');
 h.run(2.05);assert.deepEqual(dust.filter(x=>x.target===far).map(x=>x.amount),[p.toxicity.damage,p.toxicity.damage]);
 b.dealDamage(far,e,{amount:e.s.maxHp*.2,type:'true'});h.run(1.05);
 assert.equal(dust.filter(x=>x.target===far).at(-1).amount,2*p.toxicity.damage);
 h.run(p.toxicity.duration);assert.equal(h.ab.stacks.length,0,'stacks lapse');
 assert.deepEqual(b.errors,[]);
});

test('Heal restores ATK to hurt allies, never himself',()=>{
 const h=fixture(),{b,e,p,host}=h;
 host.hp=host.s.maxHp/2;e.hp=e.s.maxHp*.9;h.ab.healLeft=0;
 h.run(p.heal.anim.release+.1);
 assert.equal(host.hp,host.s.maxHp/2+e.s.atk*p.heal.scale);assert.equal(e.hp,e.s.maxHp*.9);
 assert.deepEqual(b.errors,[]);
});

test('two revives: Dormant (DEF, RES, healing, no attacks, 100 s), then Rage with at least half HP',()=>{
 const h=fixture(),{b,e,p,far}=h,calls=[],atk=e.s.atk,def=e.s.def;
 b.stageWaveScheduler={releaseCurrentWave:(...args)=>{calls.push(args);return true;}};
 b.kill(e,far);assert.equal(e.alive,true);assert.deepEqual(calls,[[e,{trackSourceAtNextWave:true}]]);
 h.run(p.rebirth+.05);
 assert.equal(e.hp,e.s.maxHp);assert.equal(e.s.def,def+p.dormant.def);assert.equal(e.profile.noAttack,true);assert.ok(e.s.flags.invulnerable);
 e.hp=e.s.maxHp*.3;h.run(2);assert.ok(e.hp>e.s.maxHp*.3,'heals while Dormant');
 b.kill(e,far);assert.equal(e.alive,true);assert.deepEqual(calls.at(-1),[e]);
 h.run(p.rebirth+.2);
 assert.ok(Math.abs(e.hp/e.s.maxHp-p.rage.minHp)<1e-9,'knocked out while Dormant: half HP');assert.equal(e.s.def,def);
 assert.ok(Math.abs(e.s.atk-atk*(1+p.rage.atk))<1e-9);assert.ok(e.s.flags.invulnerable);
 h.run(p.rage.invincible);b.kill(e,far);assert.equal(e.alive,false,'the Rage knock-out is final');
 assert.deepEqual(b.errors,[]);
});

test('blink: hidden and protected, then at the next checkpoint; cooldowns follow the list',()=>{
 const h=fixture(),{b,e,p,ab}=h;
 e.route={legs:[{t:'move',r:9,c:8},{t:'move',r:9,c:10},{t:'move',r:9,c:12,final:true}],legIdx:0};
 ab.blinkLeft=0;h.run(.05);assert.ok(e.s.flags.untargetable&&e.s.flags.invulnerable);
 h.run(p.blink.hide);assert.deepEqual([e.y,e.x],[9,8]);assert.ok(!e.s.flags.untargetable);
 assert.ok(Math.abs(ab.blinkLeft-(p.blink.cooldowns[0]-p.blink.hide))<.2);
 assert.deepEqual(b.errors,[]);
});

// M8-8 Challenge doubles the dust (a FOUR_STAR rune); normal M8-8 keeps 50.
for(const [stageId,level,dust] of [['m8-8',0,50],['m8-8_challenge_mode',0,100],['h8-3',1,80]])
 test(`compiled ${stageId}: Mephisto (level ${level}) goes Dormant, then into Rage; the dust deals ${dust} per stack`,async()=>{
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
  assert.equal(boss.def.raw.skills.find(s=>s.prefabKey==='Poison').bb.damage,dust);
  const run=s=>{const until=b.time+s;while(!b.finished&&b.time<until){clear();b.step();}};
  b.addBuff(boss,{key:'hold',persist:true,flags:{noMove:true}});
  const def=boss.s.def;
  b.dealDamage(null,boss,{amount:boss.s.maxHp,type:'true',sourceless:true});assert.equal(boss.alive,true);
  run(3);assert.ok(boss.s.def>def+2000,'Dormant');
  run(3);b.dealDamage(null,boss,{amount:boss.s.maxHp*3,type:'true',sourceless:true});assert.equal(boss.alive,true);
  run(3);assert.ok(boss.s.def<def+1,'Rage');assert.ok(boss.hp>=boss.s.maxHp*.5-1);
  assert.equal(b.finished,false);assert.deepEqual(b.errors,[]);
 });
