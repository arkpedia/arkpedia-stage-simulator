// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {patriotNative,patriotParams} from '../shared/arkpedia/enemy-patriot-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const id='enemy_1506_patrt',entry=ENEMY_RECORDS.enemies[id],record=entry.levels[0];
const PREFAB='dyn/battle/prefabs/enemies/enemy_1506_patrt.prefab';
const SNIPER='enemy_1079_sotisp';

/** Patriot at row 10, col 5 (the field spans rows 9-12), held still and disarmed; operators (block 0) at [row, col]. */
function fixture(positions=[],{others=[]}={}){
 const op=chessRec({id:'patrt_target',stats:{maxHp:1e8,atk:0,def:0,res:0,blockCnt:0}});
 const enemies={[id]:record};for(const k of others)enemies[k]=ENEMY_RECORDS.enemies[k].levels[0];
 const h=makeBattle({content:'generic',autoFinish:false,timeLimit:2000,defs:{chess:{[op.chessId]:op},enemies},
  units:positions.map((_,i)=>({chessId:op.chessId,row:11,col:1+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();
 ops.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];u.tileR=positions[i][0];u.tileC=positions[i][1];});
 const e=b.spawnEnemy(id,{pos:[10,5],route:0});
 b.addBuff(e,{key:'hold',persist:true,flags:{noMove:true,disarm:true}});
 const ab=e.mem.ab.list.find(a=>'form'in a),attack=e.mem.ab.list.find(a=>a.attack);
 const releases=[];b.stageWaveScheduler={releaseCurrentWave:(...x)=>{releases.push(x);return true;}};
 const hits=[];b.on('hit',c=>{if(c.source===e)hits.push({target:c.target,amount:c.dmg.amount,type:c.dmg.type,tags:c.dmg.tags??[]});});
 return {...h,e,ops,ab,hits,releases,strike:t=>attack.attack({targets:[t]},b,e,ab),p:patriotParams(record),run:s=>{h.run(s);assert.equal(b.finished,false);}};
}
const tagged=(hits,tag)=>hits.filter(x=>x.tags.includes(tag));
const withComponent=(test,edit)=>{const n=structuredClone(native);for(const row of n.prefabs[PREFAB]){const d=JSON.parse(row.originalJson);if(test(d)){edit(d);row.originalJson=JSON.stringify(d);}}return nativeComponents(n,id);};

test('both levels of Patriot are admitted only with the complete native tree',()=>{
 assert.ok(enemySupport(entry,clocks.prefabs,native).policy);
 const n=nativeComponents(native,id);
 for(const r of Object.values(entry.levels))assert.equal(patriotNative(r,n),true,`level ${r.level}`);
 assert.equal(patriotNative({...record,talents:{...record.talents,bb:{...record.talents.bb,'reborn.duration':30}}},n),false);
 assert.equal(patriotNative({...record,skills:record.skills.map(s=>s.prefabKey==='throwspear[Rage]'?{...s,cooldown:10}:s)},n),false);
 assert.equal(patriotNative(record,withComponent(d=>d._additionalTimes===3,d=>{d._additionalTimes=1;})),false,'four hits');
 assert.equal(patriotNative(record,withComponent(d=>d.m_Radius===f32(1.75),d=>{d.m_Radius=2;})),false,'Sacrifice reach');
 const one=patriotParams(entry.levels[1]);
 assert.deepEqual([one.immo.scale,one.spear.scale,one.revive.dur],[.05,1.35,60],'level one over level zero');
});
const f32=Math.fround;

test('Strength: every enemy gains +20% ATK and +200 DEF once, and the Inspiration marker that its receivers read',()=>{
 const h=fixture([],{others:[SNIPER]}),{b,e}=h;
 const sniper=b.spawnEnemy(SNIPER,{pos:[11,8],route:0});const atk=sniper.def.atk;
 h.run(.1);
 assert.ok(sniper.findBuff('enemy_9D0_talent_strength'),'marker');assert.equal(sniper.profile.maxTargets,2,'Inspired: one extra target');
 assert.ok(Math.abs(sniper.s.atk-atk*1.2)<1e-6);assert.equal(sniper.s.def,sniper.def.def+200);
 const twin=b.spawnEnemy(id,{pos:[9,2],route:0});h.run(.1);
 assert.ok(Math.abs(sniper.s.atk-atk*1.2)<1e-6,'two Patriots do not stack');
 // A knock-out starts the revive and keeps the aura; the second one is final.
 b.kill(twin);b.kill(e);h.run(.3);assert.ok(sniper.findBuff('enemy_9D0_talent_strength'),'the aura holds through the revive');
 b.kill(twin);b.kill(e);h.run(.3);
 assert.ok(!sniper.findBuff('enemy_9D0_talent_strength'));assert.equal(sniper.profile.maxTargets,1);
});

test('Marching Stance: shield multipliers, taunt +2, pulse immunity and a blocked-only four-hit attack',()=>{
 const h=fixture([[10,6]]),{b,e,p,hits,strike}=h,[op]=h.ops;
 // MULTIPLIER items add up: +50% shield and +20% Strength; DEF = (base + 200 Strength) x (1 + 200%).
 assert.ok(Math.abs(e.s.atk-e.def.atk*1.7)<1e-6,'+50% and its own +20% Strength');
 assert.equal(e.s.def,(e.def.def+200)*3);assert.equal(e.s.res,e.def.res*2);assert.equal(e.s.taunt,2);assert.equal(e.profile.pulseImmune,true);
 assert.equal(e.profile.canTarget(op),false,'only the blocker');
 e.blockedBy=op;assert.equal(e.profile.canTarget(op),true);
 strike(op);h.run(.35);
 const march=tagged(hits,'patrtMarch');assert.equal(march.length,4);assert.ok(march.every(x=>x.target===op&&x.amount===e.s.atk&&x.type==='phys'));
 assert.deepEqual(b.errors,[]);
});

test('first knock-out: wave released, 60 s immobile revive with Sacrifice every 0.8 s, then Ruination Stance invincible for 15 s',()=>{
 const h=fixture([[10,6],[10,8]]),{b,e,p,hits,releases,ab}=h,[near,far]=h.ops;
 b.kill(e,near);assert.equal(e.alive,true);assert.equal(ab.state,'reborn');
 assert.deepEqual(releases.map(x=>x.length),[1],'the wave is released');
 h.run(p.revive.interval*3+.05);
 const sac=tagged(hits,'patrtSacrifice');
 assert.equal(sac.length,3);assert.ok(sac.every(x=>x.target===near&&x.type==='true'));
 assert.ok(Math.abs(sac[0].amount-e.s.atk*p.immo.scale)<1e-6);
 h.run(p.revive.dur-p.revive.interval*3);
 assert.equal(ab.form,2);assert.equal(e.hp,e.s.maxHp,'100% HP (PRTS)');assert.ok(e.s.flags.invulnerable,'15 s invincible');
 assert.ok(e.def.immune.has('stun')&&e.def.immune.has('frozen')&&e.def.immune.has('levitate'));
 assert.ok(Math.abs(e.s.bat-(e.def.bat-.4))<1e-9);assert.equal(e.s.rangeRadius??e.base.rangeRadius,p.ruin.radius);
 assert.ok(!e.findBuff('patrt_t_state_1[shield]'),'the shield stance is gone');
 h.run(p.revive.invincible);assert.ok(!e.s.flags.invulnerable);
 const n=tagged(hits,'patrtSacrifice').length;h.run(.85);assert.equal(tagged(hits,'patrtSacrifice').length,n+1,'Sacrifice continues');
 b.kill(e,near);assert.equal(e.alive,false,'the second knock-out is final');
 assert.deepEqual(b.errors,[]);
});

test('Ruination Stance: unblocked single hits and the spear at the farthest unit on a ranged tile after 15 s, then every 20 s',()=>{
 const h=fixture([[10,6],[9,9],[12,9]]),{b,e,p,hits,ab,strike}=h,[near,high,low]=h.ops;
 b.grid.setTile(9,9,{...b.grid.tile(9,9),build:'RANGED',height:'HIGH'});
 b.kill(e,near);h.run(p.revive.dur+.05);assert.equal(ab.form,2);
 strike(near);assert.deepEqual(tagged(hits,'patrtRuin').map(x=>[x.target,x.amount]),[[near,e.s.atk]]);
 h.run(p.spear.initial-.2);assert.equal(ab.cast,null);
 h.run(.25);assert.equal(ab.cast?.target,high,'the ranged-tile unit, not the farther ground-tile one');const cast0=b.time-ab.cast.elapsed;
 h.run(p.spear.anim.hit+p.spear.flight);
 assert.deepEqual(tagged(hits,'patrtSpear').map(x=>[x.target,x.amount,x.type]),[[high,e.s.atk*p.spear.scale,'phys']]);
 h.run(p.spear.anim.dur);assert.equal(ab.cast,null);assert.ok(Math.abs(ab.spearLeft-(p.spear.cooldown-(b.time-cast0)))<.05,'the cooldown runs from the cast start');
 assert.deepEqual(b.errors,[]);
});
