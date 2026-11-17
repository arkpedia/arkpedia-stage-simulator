// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {FIELD_BUFF,LOCK_BUFF} from '../server/sim/content/arkpedia-enemy-andoain.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {andoainNative,andoainParams} from '../shared/arkpedia/enemy-andoain-features.js';
import {applyStageEnemyTalentMultipliers} from '../shared/arkpedia/stage-enemy-talents.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_1527_martyr',entry=ENEMY_RECORDS.enemies[id],record=entry.levels[0];
const STATION='TAG_TRAP_WPNSTS';

/** Andoain at row 9, col 5 (held still, not attacking); operators at [row, col]; a sturdy slime at `slimeAt`. */
function fixture({positions=[[9,8]],stations=[],slimeAt=[2,2]}={}){
 const op=chessRec({id:'martyr_target',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{chess:{[op.chessId]:op},enemies:{[id]:record,enemy_1007_slime:ENEMY_RECORDS.enemies.enemy_1007_slime.levels[0]}},
  units:positions.map((_,i)=>({chessId:op.chessId,row:10,col:2+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();ops.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];if(stations.includes(i))u.tags.add(STATION);});
 const e=b.spawnEnemy(id,{pos:[9,5],route:0}),slime=b.spawnEnemy('enemy_1007_slime',{pos:slimeAt,route:0});
 for(const u of [e,slime])b.addBuff(u,{key:'hold',persist:true,flags:{disarm:true,noMove:true}});
 slime.base.maxHp=slime.s.maxHp=slime.hp=1e7;
 const hits=[];b.on('hit',c=>{if(c.source===e)hits.push({target:c.target,amount:c.dmg.amount,type:c.dmg.type,tags:c.dmg.tags??[]});});
 const ab=e.mem.ab.list.find(a=>a.attack);
 return {...h,e,slime,ops,hits,ab,p:andoainParams(record),shoot:u=>ab.attack({targets:[u]},b,e,ab)};
}
const tagged=(hits,tag)=>hits.filter(x=>x.tags.includes(tag));

test('both Andoain levels are admitted only with the complete native tree',()=>{
 assert.ok(enemySupport(entry,clocks.prefabs,native).policy);
 const n=nativeComponents(native,id);
 for(const r of Object.values(entry.levels))assert.equal(andoainNative(r,n),true,`level ${r.level}`);
 assert.equal(andoainNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'Reborn.duration':6}}},n),false);
 assert.equal(andoainNative({...record,sp:{...record.sp,maxSp:4}},n),false);
 const scan=structuredClone(native);
 for(const row of scan.projectiles.projectile_enemy_martyr_scan){const d=JSON.parse(row.originalJson);if('_scanSelector'in d){d._interval=.1;row.originalJson=JSON.stringify(d);}}
 assert.equal(andoainNative(record,nativeComponents(scan,id)),false);
 const wave=structuredClone(native);wave.templates.track_at_next_wave_when_buff_finish.eventToActions.ON_BUFF_FINISH[0]._trackSourceAtNextWave=false;
 assert.equal(andoainNative(record,nativeComponents(wave,id)),false);
 // The two challenge modes add to the field's values.
 const hard=applyStageEnemyTalentMultipliers(record,{},{'SmokeBomb.damage_scale':-.35});
 const harder=applyStageEnemyTalentMultipliers(record,{},{'SmokeBomb.prob':.25});
 assert.ok(Math.abs(hard.talents.bb['SmokeBomb.damage_scale']-.35)<1e-9);assert.equal(andoainNative(hard,n),true);
 assert.equal(harder.talents.bb['SmokeBomb.prob'],.75);assert.equal(andoainNative(harder,n),true);
});

test('a round bounces up to five hits, Gelato Stops first, with the extra hit on stations',()=>{
 const h=fixture({positions:[[9,7],[9,8],[10,7]],stations:[1]}),{b,e,p,ops:[first,station]}=h;
 assert.equal(h.ab.ammo.current,5);
 h.shoot(first);h.run(4);
 const bounces=tagged(h.hits,'martyrBounce');
 assert.equal(bounces.length,p.bounce.times);assert.equal(bounces[0].target,first);assert.equal(bounces[1].target,station);
 assert.ok(bounces.every(x=>x.type==='phys'&&x.amount===e.s.atk*p.bounce.scale));
 const bonus=tagged(h.hits,'martyrBounceStation');
 assert.equal(bonus.length,bounces.filter(x=>x.target===station).length);assert.ok(bonus.every(x=>x.amount===e.s.atk*p.bounce.stationScale));
 assert.equal(h.ab.ammo.current,4);
 assert.deepEqual(b.errors,[]);
});

test('with two targets the round goes back and forth; alone it stops after one hit; empty, he shoots plainly',()=>{
 const pair=fixture({positions:[[9,7],[9,8]]});pair.shoot(pair.ops[0]);pair.run(4);
 assert.deepEqual(tagged(pair.hits,'martyrBounce').map(x=>pair.ops.indexOf(x.target)),[0,1,0,1,0]);
 const alone=fixture({positions:[[9,7]]});alone.shoot(alone.ops[0]);alone.run(4);
 assert.equal(tagged(alone.hits,'martyrBounce').length,1);
 const empty=fixture({positions:[[9,7]]});empty.ab.ammo.modify(-5);empty.shoot(empty.ops[0]);empty.run(2);
 assert.deepEqual(empty.hits.map(x=>[x.tags[0],x.amount]),[['martyrAttack',empty.e.s.atk]]);
 assert.deepEqual([pair,alone,empty].flatMap(h=>h.b.errors),[]);
});

test('losing half his HP lays a permanent field on his tile that protects enemies only',()=>{
 const h=fixture({positions:[[9,6]],slimeAt:[2,2]}),{b,e,p,slime,ops:[op]}=h;
 b.dealDamage(op,e,{amount:e.s.maxHp/2,type:'true'});
 h.run(1.4);assert.equal((b.andoainFields??[]).length,0);
 h.run(.2);assert.deepEqual(b.andoainFields.map(f=>[f.row,f.col]),[[9,5]]);
 slime.x=6;slime.y=9;h.run(.35);
 for(const u of [e,slime]){const f=u.findBuff(FIELD_BUFF);assert.ok(f);assert.deepEqual(f.mods,{dodgePhys:p.field.prob,dodgeArts:p.field.prob,physTakenMul:p.field.damageScale,artsTakenMul:p.field.damageScale});}
 assert.equal(e.s.dodgePhys,.5);assert.ok(!op.findBuff(FIELD_BUFF));
 assert.deepEqual(b.errors,[]);
});

test('the first knock-out revives him in 5 s at full HP, releases the wave, and adds ATK and 20 s invincibility',()=>{
 const h=fixture({positions:[[9,8]]}),{b,e,p}=h,atk=e.s.atk,calls=[];
 b.stageWaveScheduler={releaseCurrentWave:(...args)=>{calls.push(args);return true;}};
 b.kill(e,h.ops[0]);assert.equal(e.alive,true);assert.equal(calls.length,0);
 h.run(p.rebirth+.05);
 assert.deepEqual(calls,[[e,{trackSourceAtNextWave:true}]]);
 assert.equal(e.hp,e.s.maxHp);assert.ok(Math.abs(e.s.atk-atk*(1+p.form2.atk))<1e-9);assert.ok(e.s.flags.invulnerable);
 h.run(p.form2.invincible);assert.ok(!e.s.flags.invulnerable);
 // Second form: a field for every quarter of max HP lost.
 b.dealDamage(h.ops[0],e,{amount:e.s.maxHp*p.field.form2,type:'true'});h.run(1.5);
 assert.equal(b.andoainFields.length,1);
 assert.deepEqual(b.errors,[]);
});

test('second form: the scan locks five operators left to right, top first, then fires and reloads',()=>{
 // Rows are bottom-origin: in the last column the higher row (10) is the top one and takes the fifth lock.
 const positions=[[9,3],[8,4],[6,4],[9,6],[7,8],[10,8]];
 const h=fixture({positions,stations:[3]}),{b,e,p,ops}=h,n=p.noon;
 b.kill(e,ops[0]);h.run(p.rebirth+.02);
 h.ab.ammo.modify(-5);assert.equal(h.ab.ammo.current,0);
 h.run(n.begin+n.scan+.01);
 const locked=ops.filter(u=>u.findBuff(LOCK_BUFF));
 assert.deepEqual(locked.map(u=>ops.indexOf(u)),[0,1,2,3,5]);
 h.run(n.release+.5);
 const skill=tagged(h.hits,'martyrSkill');
 assert.deepEqual(skill.map(x=>ops.indexOf(x.target)).sort(),[0,1,2,3,5]);
 assert.ok(skill.every(x=>x.type==='phys'&&x.amount===e.s.atk*n.scale));
 assert.deepEqual(tagged(h.hits,'martyrSkillStation').map(x=>[ops.indexOf(x.target),x.amount]),[[3,e.s.atk*n.stationScale]]);
 h.run(n.end);
 assert.equal(h.ab.ammo.current,p.ammo.max);assert.ok(!ops.some(u=>u.findBuff(LOCK_BUFF)));
 assert.deepEqual(b.errors,[]);
});
