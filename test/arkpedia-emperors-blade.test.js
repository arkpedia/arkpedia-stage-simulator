// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {DOMINION_BUFF} from '../server/sim/content/arkpedia-enemy-emperors-blade.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {emperorsBladeNative,emperorsBladeParams} from '../shared/arkpedia/enemy-emperors-blade-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_1520_empgrd',entry=ENEMY_RECORDS.enemies[id],record=entry.levels[0];

/** The Pursuer at row 9, col 5 (held still, not attacking); operators at [row, col]; a plain slime held at `slimeAt`. */
function fixture({positions=[[9,9]],slimeAt=[2,2],level=record}={}){
 const op=chessRec({id:'empgrd_target',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:level,enemy_1007_slime:ENEMY_RECORDS.enemies.enemy_1007_slime.levels[0]}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:3+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();ops.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[9,5],route:0}),slime=b.spawnEnemy('enemy_1007_slime',{pos:slimeAt,route:0});
 for(const u of [e,slime])b.addBuff(u,{key:'hold',persist:true,flags:{disarm:true,noMove:true}});
 slime.base.maxHp=slime.s.maxHp=slime.hp=1e6;
 const hits=[];b.on('hit',c=>{if(c.source===e)hits.push({target:c.target,amount:c.dmg.amount,type:c.dmg.type,tags:c.dmg.tags??[]});});
 return {...h,e,slime,ops,hits,p:emperorsBladeParams(level)};
}
const tagged=(hits,tag,u)=>hits.filter(x=>x.tags.includes(tag)&&(!u||x.target===u));

test("both Emperor's Blade levels are admitted only with the complete native tree",()=>{
 assert.ok(enemySupport(entry,clocks.prefabs,native).policy);
 const n=nativeComponents(native,id);
 for(const r of Object.values(entry.levels))assert.equal(emperorsBladeNative(r,n),true,`level ${r.level}`);
 assert.equal(emperorsBladeNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'Reborn.duration':6}}},n),false);
 assert.equal(emperorsBladeNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'BlackFogTriggerP2.hp_ratio':0}}},n),false);
 // DC-8 Challenge scales both Dominion thresholds.
 assert.equal(emperorsBladeNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'BlackFogTriggerP1.hp_ratio':.3,'BlackFogTriggerP2.hp_ratio':.2}}},n),true);
 const kill=structuredClone(native);kill.templates.enemy_empgrd_blackring.eventToActions.ON_BUFF_START[3]._skipReborn=true;
 assert.equal(emperorsBladeNative(record,nativeComponents(kill,id)),false);
 const aoe=structuredClone(native);for(const row of aoe.projectiles.projectile_enemy_empgrd_aoe){const d=JSON.parse(row.originalJson);if('m_Radius'in d){d.m_Radius=2.5;row.originalJson=JSON.stringify(d);}}
 assert.equal(emperorsBladeNative(record,nativeComponents(aoe,id)),false);
 const revive=structuredClone(native);
 for(const row of revive.prefabs['dyn/battle/prefabs/enemies/enemy_1520_empgrd.prefab']){const d=JSON.parse(row.originalJson);if('_hpRechargeRatio'in d){d._hpRechargeRatio=1;row.originalJson=JSON.stringify(d);}}
 assert.equal(emperorsBladeNative(record,nativeComponents(revive,id)),false);
});

test('losing half his HP raises a permanent Dominion on the top damage dealer after 1.45 s',()=>{
 const h=fixture({positions:[[9,9],[9,13]]}),{b,e,p}=h,[top,other]=h.ops;
 b.dealDamage(other,e,{amount:100,type:'true'});b.dealDamage(top,e,{amount:e.s.maxHp/2-100,type:'true'});
 h.run(1.4);assert.equal(b.emperorDominion.zones.length,0,'not before the delay');
 h.run(.2);
 assert.deepEqual(b.emperorDominion.zones.map(z=>[z.row,z.col]),[[9,9]]);
 assert.equal(tagged(h.hits,'dominion',top).length,1);assert.equal(tagged(h.hits,'dominion',other).length,0);
 assert.ok(tagged(h.hits,'dominion').every(x=>x.type==='arts'&&x.amount===e.s.atk*p.aoeScale));
 assert.ok(top.findBuff(DOMINION_BUFF));assert.equal(top.s.aspd,100+p.fogAspd);assert.ok(!other.findBuff(DOMINION_BUFF));
 // The `x-1` diamond: two tiles straight out, one diagonally.
 const keys=b.emperorDominion.zones[0].keys;assert.equal(keys.size,13);
 // Standing in it, he takes half the Physical and Arts damage.
 const taken=[];b.on('damaged',c=>{if(c.target===e)taken.push(c.amount);});
 b.dealDamage(other,e,{amount:1000,type:'arts'});e.x=9;e.y=9;h.run(.35);
 assert.ok(e.findBuff(DOMINION_BUFF));b.dealDamage(other,e,{amount:1000,type:'arts'});
 assert.ok(Math.abs(taken[1]-taken[0]*p.fogResistance)<1e-6,`${taken}`);
 assert.deepEqual(b.errors,[]);
});

test('the Dominion prefers an operator outside every Dominion over a bigger damage dealer inside one',()=>{
 const h=fixture({positions:[[9,9],[9,13]]}),{b,e}=h,[inside,outside]=h.ops;
 b.addBuff(inside,{key:DOMINION_BUFF,duration:100});
 b.dealDamage(outside,e,{amount:1000,type:'true'});b.dealDamage(inside,e,{amount:e.s.maxHp/2-1000,type:'true'});
 h.run(1.5);
 assert.deepEqual(b.emperorDominion.zones.map(z=>[z.row,z.col]),[[9,13]]);
 assert.deepEqual(b.errors,[]);
});

test('Collapsing Fear at 20 s deals Arts splash within 2 and defeats operators holding a Dominion',()=>{
 const h=fixture({positions:[[9,6.5],[10.5,5],[9,8]]}),{b,e,p}=h,[held,near,far]=h.ops;
 b.addBuff(held,{key:DOMINION_BUFF,duration:100});
 h.run(20);assert.equal(tagged(h.hits,'collapsingFear').length,0,'not before its initial cooldown');
 h.run(p.fearRelease+.05);
 assert.equal(held.alive,false);assert.equal(near.alive,true);assert.equal(far.alive,true);
 assert.equal(tagged(h.hits,'collapsingFear',near).length,1);assert.equal(tagged(h.hits,'collapsingFear',far).length,0);
 assert.ok(tagged(h.hits,'collapsingFear').every(x=>x.type==='arts'&&x.amount===e.s.atk*p.form1.scale));
 assert.deepEqual(b.errors,[]);
});

test('the first knock-out casts Collapsing Fear on the whole field, then revives into the second form',()=>{
 const h=fixture({positions:[[2,14],[16,14]]}),{b,e,p}=h,[held,free]=h.ops,atk=e.s.atk;
 b.addBuff(held,{key:DOMINION_BUFF,duration:100});
 b.kill(e,free);assert.equal(e.alive,true,'the knock-out is a revive');
 h.run(p.ringRelease+.05);
 assert.equal(held.alive,false);assert.equal(tagged(h.hits,'collapsingFear',free).length,1);
 h.run(p.rebirth);
 assert.equal(e.hp,e.s.maxHp*p.rebornHp);assert.equal(e.s.atk,atk*(1+p.rebornAtk));assert.ok(e.s.flags.invulnerable,'10 s of invincibility');
 h.run(p.invincible);assert.ok(!e.s.flags.invulnerable);
 // Second form: a Dominion for every further quarter of max HP lost.
 b.dealDamage(free,e,{amount:e.s.maxHp*p.form2.hpRatio,type:'true'});h.run(1.5);
 assert.equal(b.emperorDominion.zones.length,1);
 assert.deepEqual(b.errors,[]);
});

test('second form attacks its blocker for 250% physical melee damage, others for 100%',()=>{
 const h=fixture({positions:[[9,6],[9,6.8]]}),{b,e,p}=h,[blocker,other]=h.ops;
 b.kill(e,other);h.run(p.rebirth+.05);
 const attack=e.mem.ab.list.find(a=>a.attack);
 e.blockedBy=blocker;attack.attack({targets:[blocker,other]},b,e,attack);e.blockedBy=null;
 assert.deepEqual(h.hits.filter(x=>x.tags.includes('empgrdCombat')).map(x=>[x.target,x.amount]),[[blocker,e.s.atk*p.combatScale]]);
 assert.deepEqual(h.hits.filter(x=>x.tags.includes('empgrdAttack')).map(x=>[x.target,x.amount]),[[other,e.s.atk]]);
 assert.deepEqual(b.errors,[]);
});

test('a Dominion outlives the Pursuer and then slows enemies too',()=>{
 const h=fixture({positions:[[9,9]],slimeAt:[2,2]}),{b,e,p,slime}=h,[top]=h.ops;
 b.dealDamage(top,e,{amount:e.s.maxHp/2,type:'true'});h.run(1.5);
 slime.x=9;slime.y=9;h.run(.35);assert.ok(!slime.findBuff(DOMINION_BUFF),'his own side is spared while he is on the field');
 b.leak(e);h.run(.35);
 assert.ok(slime.findBuff(DOMINION_BUFF));assert.equal(slime.s.aspd,slime.base.aspd+p.fogAspd);assert.ok(top.findBuff(DOMINION_BUFF));
 assert.deepEqual(b.errors,[]);
});

test('compiled DC-8 runs the Pursuer through both forms',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {StandardBattle}=await import('../server/sim/arkpedia.js');
 const {createStageLibraryLoader}=await import('../shared/arkpedia/stage-library.js');
 const {defaultBuild}=await import('../shared/arkpedia/loadout.js');
 const mvp=JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json',import.meta.url)));
 const manifest=JSON.parse(await readFile(new URL('../data/arkpedia-library.json',import.meta.url)));
 const loader=createStageLibraryLoader(async url=>new Response(await readFile(new URL(`..${url}`,import.meta.url))));
 const stage=await loader.load(manifest.stages.find(s=>s.id==='dc-8'));
 const b=new StandardBattle({...mvp,stage,enemies:{...mvp.enemies,...stage.enemies}},{operators:[{...defaultBuild(mvp.operators.char_151_myrtle)}]},{seed:1});
 let boss=null;
 // Clear the escort as it arrives, so the stage lasts until the Pursuer appears.
 while(!b.finished&&b.time<900&&!(boss=b.enemies.find(e=>e.alive&&e.defId===id))){
  for(const e of b.enemies)if(e.alive&&e.defId!==id)b.kill(e);
  b.step();
 }
 assert.ok(boss,'the Pursuer spawns');
 b.dealDamage(null,boss,{amount:boss.s.maxHp,type:'true',sourceless:true});
 assert.equal(boss.alive,true,'the first knock-out revives him');
 const until=b.time+7.3;while(b.time<until&&!b.finished)b.step();
 assert.equal(boss.alive,true);assert.equal(boss.form,'form2');
 b.dealDamage(null,boss,{amount:boss.s.maxHp,type:'true',sourceless:true});
 assert.equal(boss.alive,true,'still invincible after the revive');
 const later=b.time+10.1;while(b.time<later&&!b.finished)b.step();
 b.dealDamage(null,boss,{amount:boss.s.maxHp,type:'true',sourceless:true});
 assert.equal(boss.alive,false,'the second knock-out is final');
 assert.deepEqual(b.errors,[]);
});
