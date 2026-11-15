// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle,chessRec } from './helpers/battleHarness.js';
import { ENEMY_RECORDS } from './helpers/enemyHarness.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { jesseltonNative } from '../shared/arkpedia/enemy-jesselton-features.js';
import { nativeComponents,enemySupport } from '../shared/arkpedia/enemy-support.js';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import index from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};
const id='enemy_1516_jakill',prisoner='enemy_1120_vofwiz';
function fixture(level=0){
  const records=Object.fromEntries([[id,level],[prisoner,0]].map(([key,lv])=>{const r=structuredClone(ENEMY_RECORDS.enemies[key].levels[lv]);r.stats.moveSpeed=0;return[key,r];}));
  const ops=['warden_blocker','warden_target','warden_device'].map((key,i)=>chessRec({id:key,stats:{maxHp:1e6,atk:0,def:500,res:0,blockCnt:i?0:10,tauntLevel:i*20},skill:null}));
  const h=makeBattle({content:'none',autoFinish:false,captureNoisy:true,timeLimit:300,
    defs:{enemies:records,chess:Object.fromEntries(ops.map(op=>[op.chessId,op]))},kits:Object.fromEntries(ops.map(op=>[op.chessId,()=>({trait:{noAttack:true}})])),
    units:ops.map((op,i)=>({chessId:op.chessId,row:9,col:i?4+i:4})),setup:installEnemyFeatures});
  h.b.start();const[target,second,device]=h.b.allyUnits;device.tags.add('prison');
  const e=h.b.spawnEnemy(id,{pos:[9,4]}),a=e.mem.ab.list.find(x=>'sp'in x),hits=[];
  h.b.on('damaged',c=>{if(c.source===e)hits.push({...c,time:h.b.time});});
  return{...h,e,a,target,second,device,hits};
}
test('both database levels retain the base form parameters while applying their own ATK override',()=>{
  for(const level of[0,1]){const f=fixture(level);assert.equal(f.e.s.res,70);assert.equal(f.e.profile.dmgType,'arts');
    f.b.kill(f.e);assert.equal(f.e.alive,true);f.run(4.1);assert.equal(f.e.s.atk,f.e.base.atk+(level?800:700));
    assert.equal(f.e.s.def,1400);assert.equal(f.e.s.res,20);assert.equal(f.e.s.bat,2.5);assert.equal(f.e.s.moveSpeed,.3);
    assert.equal(f.e.hp,f.e.s.maxHp);assert.equal(f.e.profile.melee,true);assert.deepEqual(f.b.errors,[]);
  }
});
test('Jailer excludes the prison tag, emits original Arts projectiles and uses the fourth cast to stun two recipients',()=>{
  const f=fixture();f.run(15.5);assert.equal(f.e.stats.attacks,4);assert.equal(f.hits.length,5);
  assert.equal(f.hits.some(h=>h.target===f.device),false);assert.ok(f.hits.every(h=>h.dmg.type==='arts'));
  assert.equal(f.a.sp,0);assert.equal(f.target.s.flags.stun,true);assert.equal(f.second.s.flags.stun,true);
  assert.equal(f.hits.at(-1).dmg.attackId,f.hits.at(-2).dmg.attackId);assert.deepEqual(f.b.errors,[]);
});
test('first lethal hit cancels an unfinished cast, frees eligible prisoners and prevents a second rebirth',()=>{
  const f=fixture(),p=f.b.spawnEnemy(prisoner,{pos:[7,4]});f.run(.2);assert.ok(f.a.cast);
  f.b.kill(f.e);assert.equal(f.a.cast,null);assert.equal(p.mem.ab.list.find(x=>x.confine).free,true);
  assert.equal(f.e.s.flags.invulnerable,true);f.run(2);assert.equal(f.hits.length,0);assert.equal(f.e.mem.regularFormVisual.clip,'C1_Die');
  f.run(2.1);assert.ok(f.e.stats.attacks>=2);f.b.kill(f.e);assert.equal(f.e.alive,false);assert.deepEqual(f.b.errors,[]);
});
test('Killer fourth cast has two source-timed physical hits with armour penetration',()=>{
  const f=fixture();f.b.kill(f.e);f.run(4.1);f.hits.length=0;f.a.cancel(f.b,f.e,f.a);f.a.sp=3;f.e.atkCd=0;f.run(.2);
  assert.equal(f.hits.length,0);f.run(.3);assert.equal(f.hits.length,1);f.run(.25);assert.equal(f.hits.length,2);
  assert.ok(f.hits.every(h=>h.dmg.type==='phys'&&h.dmg.applyWay==='melee'&&h.dmg.defIgnorePct===.6));
  assert.ok(f.hits.every(h=>h.target===f.target));assert.equal(f.hits[0].dmg.attackId,f.hits[1].dmg.attackId);
  assert.ok(Math.abs(f.hits[1].time-f.hits[0].time-.2)<.04);assert.deepEqual(f.b.errors,[]);
});
test('control cancels a pending second armour-piercing hit; emitted Jailer projectiles survive source departure',()=>{
  const f=fixture();f.b.kill(f.e);f.run(4.1);f.hits.length=0;f.a.cancel(f.b,f.e,f.a);f.a.sp=3;f.e.atkCd=0;f.run(.5);assert.equal(f.hits.length,1);
  f.b.applyStatus(f.e,'stun',{duration:2});f.run(.5);assert.equal(f.hits.length,1);
  const g=fixture();g.target.x=6;g.second.x=6.1;g.run(1.01);g.b._remove(g.e,'leak');g.run(.5);assert.equal(g.hits.length,1);
  assert.deepEqual(f.b.errors,[]);assert.deepEqual(g.b.errors,[]);
});
test('native admission checks skill repeats, selector exclusions, respawn and forced liberation',()=>{
  assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],index.prefabs,evidence).policy);
  for(const kind of['repeat','tag','reborn','mode']){const ev=structuredClone(evidence);
    if(kind==='mode')ev.templates.jakill_reborn.eventToActions.ON_BUFF_START[1]._restartFSM=false;
    else{const key=kind==='repeat'?'_additionalTimes':kind==='tag'?'_tagExcluded':'_maxRespawnCnt';const rows=ev.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];
      const row=rows.find(x=>key in JSON.parse(x.originalJson));const d=JSON.parse(row.originalJson);d[key]=0;row.originalJson=JSON.stringify(d);}
    assert.equal(jesseltonNative(ENEMY_RECORDS.enemies[id].levels[0],nativeComponents(ev,id)),false,kind);
  }
});
test('original MB-8 resolves its complete schedule, including two-stage Jesselton defeat',async()=>{
  const{loadContentContext,planStage}=await import('../tools/arkpedia/content-inventory.mjs');const{StandardBattle}=await import('../server/sim/arkpedia.js');const{defaultBuild}=await import('../shared/arkpedia/loadout.js');
  const c=await loadContentContext(),p=await planStage(c,'mb-8',{waves:true});assert.deepEqual(p.blockers,[]);
  const b=new StandardBattle({...c.mvp,stage:p.stage,enemies:{...c.mvp.enemies,...p.stage.enemies}},{operators:[defaultBuild(c.mvp.operators.char_123_fang)]});
  let bosses=0;b.on('enemySpawn',({enemy})=>{if(enemy.defId===id){bosses++;b.after(.5,()=>b.kill(enemy));b.after(5,()=>b.kill(enemy));}else b.after(.5,()=>b.kill(enemy));});
  const life=b.life;b.start();b.runToEnd(600);assert.equal(b.reason,'cleared');assert.equal(bosses,1);assert.equal(b.life,life);assert.deepEqual(b.errors,[]);
});
