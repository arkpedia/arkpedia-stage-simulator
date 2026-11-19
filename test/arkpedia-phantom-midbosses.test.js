// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {ENEMY_RECORDS,spawnAny} from './helpers/enemyHarness.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemySupport,nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {lostColossusNative,lostColossusParams,jetmanNative,jetmanParams,wanderingPuppetNative,wanderingPuppetParams} from '../shared/arkpedia/enemy-phantom-midboss-features.js';
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import clocks from '../data/arkpedia-enemy-clock-source.json' with {type:'json'};

const ROCKMAN='enemy_2003_rockman',BALLOON='enemy_2004_balloon',CSBOT='enemy_2013_csbot';
const rec=id=>ENEMY_RECORDS.enemies[id].levels[0];
const prefab=id=>`dyn/battle/prefabs/enemies/${id}.prefab`;
const withComponent=(id,test,edit)=>{const n=structuredClone(native);for(const row of n.prefabs[prefab(id)]){const d=JSON.parse(row.originalJson);if(test(d)){edit(d);row.originalJson=JSON.stringify(d);}}return nativeComponents(n,id);};
const withTemplate=(id,key,edit)=>{const n=structuredClone(native);edit(n.templates[key]);return nativeComponents(n,id);};
const stunned=u=>u.buffs.some(x=>x.status==='stun');

/** One enemy at row 10, col 5 (the field spans rows 9-12), held still and disarmed; operators (block 0) at [row, col]. */
function fixture(ids,positions=[]){
 const op=chessRec({id:'midboss_target',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:0}});
 const h=makeBattle({content:'generic',autoFinish:false,timeLimit:2000,defs:{chess:{[op.chessId]:op},enemies:Object.fromEntries(ids.map(id=>[id,rec(id)]))},
  units:positions.map((_,i)=>({chessId:op.chessId,row:11,col:1+i,dir:'RIGHT'})),setup:b=>installEnemyFeatures(b)});
 const b=h.b;b.start();const ops=h.allies();
 ops.forEach((u,i)=>{u.y=positions[i][0];u.x=positions[i][1];u.tileR=positions[i][0];u.tileC=positions[i][1];});
 const hits=[];b.on('damaged',c=>hits.push({source:c.source,target:c.target,amount:c.amount,type:c.dmg?.type,tags:c.dmg?.tags??[],time:b.time}));
 const spawn=(id,pos)=>{const e=b.spawnEnemy(id,{pos,route:0});b.addBuff(e,{key:'hold',persist:true,flags:{noMove:true,disarm:true}});return e;};
 return {...h,ops,hits,spawn,run:s=>{h.run(s);assert.equal(b.finished,false);}};
}
const tagged=(hits,tag)=>hits.filter(x=>x.tags.includes(tag));

test('the three mid-bosses are admitted only with their complete native trees',()=>{
 for(const id of [ROCKMAN,BALLOON,CSBOT])assert.ok(enemySupport(ENEMY_RECORDS.enemies[id],clocks.prefabs,native).policy,id);
 const r=rec(ROCKMAN),rn=nativeComponents(native,ROCKMAN);
 assert.equal(lostColossusNative(r,rn),true);
 assert.equal(lostColossusNative({...r,skills:[{...r.skills[0],bb:{...r.skills[0].bb,stun:10}}]},rn),false,'stun');
 assert.equal(lostColossusNative(r,withComponent(ROCKMAN,d=>d.m_Radius===2.5,d=>{d.m_Radius=3;})),false,'trigger radius');
 assert.equal(lostColossusNative(r,withComponent(ROCKMAN,d=>d._buffKey==='stun',d=>{d._buffKeyExcluded=0;})),false,'stunned units excluded');
 const j=rec(BALLOON),jn=nativeComponents(native,BALLOON);
 assert.equal(jetmanNative(j,jn),true);
 assert.equal(jetmanNative(j,withTemplate(BALLOON,'enemy_balloon_s[trigger]',t=>{t.eventToActions.ON_BUFF_TRIGGER[0].$type='Torappu.Battle.Action.Nodes+CheckNotBlocked, Assembly-CSharp';})),false,'blocked check');
 assert.equal(jetmanNative({...j,skills:[{...j.skills[0],cooldown:20}]},jn),false,'cooldown');
 const w=rec(CSBOT),wn=nativeComponents(native,CSBOT);
 assert.equal(wanderingPuppetNative(w,wn),true);
 assert.equal(wanderingPuppetNative(w,withComponent(CSBOT,d=>d._removeBuffWhenAbilityDetached===1,d=>{d._removeBuffWhenAbilityDetached=0;})),false,'removed on detach');
 assert.equal(wanderingPuppetNative(w,withTemplate(CSBOT,'enemy_toxcar_t',t=>{t.eventToActions.ON_BUFF_TRIGGER[0]._damageType='PHYSICAL';})),false,'Arts');
});

test('Lost Colossus: a rock at 13 s on the nearest operator in reach, 70% ATK Physical and a 25 s Stun; stunned operators are skipped',()=>{
 const h=fixture([ROCKMAN],[[10,7],[11,7],[10,9]]),{b,hits}=h,[near,second,far]=h.ops,e=h.spawn(ROCKMAN,[10,5]);
 const ab=e.mem.ab.list.find(a=>'left'in a&&'cast'in a),p=lostColossusParams(rec(ROCKMAN));
 h.run(p.rock.initial-.1);assert.equal(ab.cast,null);
 h.run(.15);assert.equal(ab.cast?.target,near,'the nearest operator within 2.5');
 h.run(p.rock.anim.hit+.3);
 const rock=tagged(hits,'rockmanRock');
 assert.deepEqual(rock.map(x=>[x.target,x.type]),[[near,'phys']]);assert.ok(Math.abs(rock[0].amount-e.s.atk*p.rock.scale)<1e-6);
 const stun=near.buffs.find(x=>x.status==='stun');assert.ok(stun);assert.ok(stun.timeLeft>p.rock.stun-.35&&stun.timeLeft<=p.rock.stun,'a fresh 25 s Stun');
 h.run(p.rock.cooldown-p.rock.anim.hit-.3);
 assert.equal(ab.cast?.target,second,'the stunned operator is skipped');assert.ok(!tagged(hits,'rockmanRock').some(x=>x.target===far));
 assert.deepEqual(b.errors,[]);
});

test('Lost Colossus waits while every operator in reach is stunned',()=>{
 const h=fixture([ROCKMAN],[[10,7]]),{b}=h,[op]=h.ops,e=h.spawn(ROCKMAN,[10,5]);
 const ab=e.mem.ab.list.find(a=>'left'in a&&'cast'in a),p=lostColossusParams(rec(ROCKMAN));
 b.applyStatus(op,'stun',{duration:p.rock.initial+3,source:null});
 h.run(p.rock.initial+1);assert.equal(ab.cast,null);assert.ok(ab.left<=0,'ready, no target');
 h.run(2.5);assert.equal(ab.cast?.target,op,'casts once the Stun ends');
 assert.deepEqual(b.errors,[]);
});

test('Jetman: armed after 1 s, he takes off when blocked: 7 s aerial and block-free, x1.5 speed (x0.1 for the first 1.5 s), no attacks, then lands',()=>{
 const h=spawnAny(BALLOON,{autoFinish:false,seconds:.02}),{b}=h,e=h.b.units.find(u=>u.defId===BALLOON);
 const ab=e.mem.ab.list.find(a=>'armLeft'in a),p=jetmanParams(rec(BALLOON)),base=e.s.moveSpeed;
 h.run(1.03);assert.equal(ab.armed,true);
 let blockedAt=null;b.on('blocked',c=>{if(c.enemy===e&&blockedAt==null)blockedAt=b.time;});
 h.runUntil(()=>e.motion==='FLY',60);
 assert.ok(blockedAt!=null,'the guard blocks him');assert.ok(b.time-blockedAt<=p.takeOff.check+.05,'within one 0.33 s check');
 assert.equal(e.blockedBy??null,null);assert.ok(e.hasFlag('unblockable'));assert.equal(e.isFlying,true);assert.equal(e.profile.noAttack,true);
 assert.ok(Math.abs(e.s.moveSpeed-base*1.5*p.takeOff.rise.moveMul)<1e-6,'lift-off');
 h.run(p.takeOff.rise.dur);assert.ok(Math.abs(e.s.moveSpeed-base*1.5)<1e-6,'+50%');
 h.run(p.takeOff.fly.dur-p.takeOff.rise.dur);
 assert.equal(e.motion,'WALK');assert.equal(e.profile.noAttack,false);assert.ok(e.hasFlag('unblockable'),'landing');
 assert.ok(Math.abs(e.s.moveSpeed-base*p.takeOff.land.moveMul)<1e-6);
 h.run(p.takeOff.land.dur+.05);assert.ok(!e.hasFlag('unblockable'));assert.equal(ab.armed,false,'re-armed only by the next cast');
 assert.deepEqual(b.errors,[]);
});

test('Jetman does not take off unblocked, and a waiting trigger is not doubled',()=>{
 const h=spawnAny(BALLOON,{autoFinish:false,units:[],seconds:.02}),{b}=h,e=h.b.units.find(u=>u.defId===BALLOON);
 const ab=e.mem.ab.list.find(a=>'armLeft'in a),p=jetmanParams(rec(BALLOON));
 b.addBuff(e,{key:'hold',persist:true,flags:{noMove:true}});
 h.run(p.takeOff.initial+p.takeOff.cooldown+1);
 assert.equal(e.motion,'WALK');assert.equal(ab.armed,true);assert.ok(ab.armLeft>p.takeOff.cooldown-1.5);
 assert.deepEqual(b.errors,[]);
});

test('Wandering Puppet: 100 Arts per second to every operator while not blocked, nothing while blocked',()=>{
 // The harness guard on the route (row 9) blocks; the second one is off the route.
 const G='test_enemy_harness_guard',h=spawnAny(CSBOT,{autoFinish:false,units:[{chessId:G,row:9,col:6},{chessId:G,row:11,col:3}],seconds:.02}),{b}=h;
 const hits=[];b.on('damaged',c=>{if(c.dmg?.tags?.includes('csbotPoison'))hits.push({target:c.target,amount:c.amount,type:c.dmg.type,source:c.source,time:b.time});});
 const e=h.b.units.find(u=>u.defId===CSBOT),p=wanderingPuppetParams(rec(CSBOT));
 const blocker=b.units.find(u=>u.side==='ally'&&u.y===9),away=b.units.find(u=>u.side==='ally'&&u.y===11);
 assert.ok(blocker&&away,'operators placed');
 h.run(.9);assert.equal(hits.length,0,'the first tick after 1 s');
 h.run(.15);assert.deepEqual(hits.map(x=>x.target).sort((x,y)=>x.x-y.x),[away,blocker].sort((x,y)=>x.x-y.x));
 assert.ok(hits.every(x=>x.amount===p.poison.damage&&x.type==='arts'&&x.source==null));
 h.runUntil(()=>e.blockedBy,60);const n=hits.length,at=b.time;
 h.run(5);assert.equal(hits.length,n,'blocked: no damage');assert.ok(!away.findBuff('enemy_csbot_t'));
 b.kill(blocker,null);h.run(1.05);assert.ok(hits.filter(x=>x.time>at+5).length>=1,'released: the melody resumes');
 assert.deepEqual(b.errors,[]);
});

test('two Wandering Puppets do not stack; when the playing one is blocked the other takes over',()=>{
 const h=fixture([CSBOT],[[11,3]]),{b}=h,[op]=h.ops,a=h.spawn(CSBOT,[10,8]),c=h.spawn(CSBOT,[10,9]);
 const ticks=()=>h.hits.filter(x=>x.target===op&&x.tags.includes('csbotPoison')).length;
 h.run(3.05);assert.equal(ticks(),3,'100 per second, not 200');
 // Held puppets cannot walk into a blocker: mark the playing one blocked directly (the runtime reads blockedBy).
 const owner=op.findBuff('enemy_csbot_t').data.src,other=owner===a?c:a;
 owner.blockedBy=op;h.run(.05);assert.ok(!op.findBuff('enemy_csbot_t')||op.findBuff('enemy_csbot_t').data.src===other);
 h.run(1.1);assert.equal(op.findBuff('enemy_csbot_t').data.src,other);assert.equal(ticks(),4,'the other puppet, after its own 1 s');
 owner.blockedBy=null;assert.deepEqual(b.errors,[]);
});

const STAGES={b1:'isw-df_level_obt_roguelike_ro1_level_rogue1_b-1',b2:'isw-df_level_obt_roguelike_ro1_level_rogue1_b-2',b4:'isw-df_level_obt_roguelike_ro1_level_rogue1_b-4'};
async function compiled(stageId,id){
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
 const clear=()=>{for(const e of b.enemies)if(e.alive&&e.defId!==id&&!e.mem.stageUnitDevice)b.kill(e);};
 while(!b.finished&&b.time<900&&!boss){clear();boss=b.enemies.find(e=>e.alive&&e.defId===id);b.step();}
 assert.ok(boss,`${id} in ${stageId}`);
 b.addBuff(boss,{key:'hold',persist:true,flags:{noMove:true}});
 b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 let myrtle=null;
 for(let r=0;r<stage.geometry.tileGrid.length&&!myrtle;r++)for(let c=0;c<stage.geometry.tileGrid[0].length&&!myrtle;c++){try{myrtle=b.deployOperator('char_151_myrtle',r,c,'RIGHT');}catch{}}
 assert.ok(myrtle);myrtle.base.maxHp=1e9;myrtle.markDirty();myrtle.hp=myrtle.s.maxHp;myrtle.y=boss.y;myrtle.x=boss.x+1;
 const run=s=>{const until=b.time+s;while(!b.finished&&b.time<until){clear();b.step();}};
 return {b,boss,myrtle,run};
}

test('compiled b-1: Lost Colossus at the stage HP throws a stunning rock',async()=>{
 const {b,boss,myrtle,run}=await compiled(STAGES.b1,ROCKMAN);
 assert.equal(boss.s.maxHp,80000);assert.equal(boss.s.atk,1500);
 const ab=boss.mem.ab.list.find(a=>'left'in a&&'cast'in a);assert.ok(ab);
 ab.left=0;run(3);assert.ok(stunned(myrtle),'the rock stuns');
 assert.equal(b.finished,false);assert.deepEqual(b.errors,[]);
});

test('compiled b-2: Jetman at the stage HP and ATK arms his take-off',async()=>{
 const {b,boss,run}=await compiled(STAGES.b2,BALLOON);
 assert.equal(boss.s.maxHp,70000);assert.equal(boss.s.atk,500);
 const ab=boss.mem.ab.list.find(a=>'armLeft'in a);assert.ok(ab);
 run(1.5);assert.equal(ab.armed,true);
 assert.equal(b.finished,false);assert.deepEqual(b.errors,[]);
});

test('compiled b-4: an unblocked Wandering Puppet hurts the deployed operator every second',async()=>{
 const {b,boss,myrtle,run}=await compiled(STAGES.b4,CSBOT);
 assert.equal(boss.s.maxHp,40000);
 myrtle.y=boss.y+2;myrtle.x=boss.x;
 const hits=[];b.on('damaged',c=>{if(c.target===myrtle&&c.dmg?.tags?.includes('csbotPoison'))hits.push(c.amount);});
 run(3.1);assert.ok(hits.length>=2&&hits.length<=3,`${hits.length} ticks in 3 s`);
 assert.equal(b.finished,false);assert.deepEqual(b.errors,[]);
});

test('an empty random-group spawn choice passes the stage enemy check only with an original wave program',async()=>{
 const {assertRegularEnemies}=await import('../shared/arkpedia/enemies.js');
 const data={enemies:{},stage:{rules:null,geometry:{waves:[{spawns:[{enemy_id:'',random:{group:'g1',weight:20}}]}]},waveProgram:{waves:[]}}};
 assert.doesNotThrow(()=>assertRegularEnemies(data));
 assert.throws(()=>assertRegularEnemies({...data,stage:{...data.stage,waveProgram:undefined}}),/Missing supported enemy record/);
 const plain=structuredClone(data);delete plain.stage.geometry.waves[0].spawns[0].random;
 assert.throws(()=>assertRegularEnemies(plain),/Missing supported enemy record/);
});
