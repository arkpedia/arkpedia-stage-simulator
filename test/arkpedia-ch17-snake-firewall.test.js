// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {installChapter17SnakeFirewall as install,crossedChapter17FirewallSides as crossed} from '../server/sim/content/chapter17-snake-firewall.js';
import {chapter17Environment,chapter17FirewallSnapshot as snapshot,clickChapter17Firewall as click,chapter17FirewallBlocksDeployment as blocked,registerChapter17Firewall} from '../server/sim/content/chapter17.js';
import {snakeFirewallContract} from '../tools/arkpedia/snake-firewall-contract.mjs';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {summonPlacementError} from '../server/sim/content/arkpedia-summons.js';
const bytes=p=>readFileSync(new URL('../'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const contract=read('data/candidates/arkpedia-ch17-snake-firewall-contract.json'),key=contract.enemy,record=()=>read('data/candidates/arkpedia-enemy-records.canonical.json').enemies[key].levels[0];
function fixture({beforeInstall}={}){
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:1e6,rect:{r0:0,r1:16,c0:0,c1:10},
  defs:{enemies:{[key]:record()},chess:{source:chessRec({id:'source',stats:{maxHp:10000}})}},units:[{chessId:'source',row:10,col:5}]});
 h.b.start();const e=h.spawn(key,{pos:[14,5]}),source=h.allies()[0];source.profile.noAttack=true;e.profile.noAttack=true;
 beforeInstall?.(h.b,e);const p=install(h.b,e);return{h,b:h.b,e,source,p,wall:p.wall};
}
function taps(b,input,n=3){for(let i=0;i<n;i++)assert.equal(click(b,input),true);}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function hit(f,type='phys',extra={}){const hp=f.e.hp;f.b.dealDamage(f.source,f.e,{amount:1000,type,canDodge:false,...extra});return hp-f.e.hp;}

test('firewall contract reproduces source environment, passive, initial action and native root collider without support admission',async()=>{
 assert.deepEqual(await snakeFirewallContract(),contract);for(const s of Object.values(contract.sources))assert.equal(createHash('sha256').update(bytes(s.path)).digest('hex'),s.sha256);
 assert.deepEqual(contract.body,{w:7,h:4,dx:0,dy:0});assert.deepEqual(contract.defaults.initialSides,[0,1,3]);assert.equal(contract.init.lifeTime,.5);
 assert.equal(contract.damage[1]._damageMask,'PHYSICAL_AND_MAGICAL');assert.equal(contract.damage[1]._isOneMinus,true);
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies[key].policy,null);
});
test('three initial vulnerability windows appear after the source half-second and never include the top',()=>{
 const f=fixture();let firstSeen;f.b.on('tick',()=>{firstSeen??=snapshot(f.b)[0];});
 assert.deepEqual(snapshot(f.b),[]);f.h.run(.4);assert.deepEqual(snapshot(f.b),[]);f.h.run(.15);
 const inputs=snapshot(f.b);assert.deepEqual(inputs.map(i=>i.side),[0,1,3]);assert.ok(inputs.every(i=>i.required===3&&i.remaining>4.8));assert.equal(firstSeen.remaining,5);
 taps(f.b,inputs[0]);assert.equal(f.wall.sides[0].broken,true);assert.deepEqual(snapshot(f.b).map(i=>i.side),[1,3]);assert.deepEqual(f.b.errors,[]);
});
test('initial side timers expire independently and a leaked-source exposure selects a nearest remaining side',()=>{
 const f=fixture();f.h.run(.55);const first=snapshot(f.b);taps(f.b,first[0],1);f.h.run(1);
 chapter17Environment(f.b).expose({x:f.e.x-8,y:f.e.y});const left=snapshot(f.b).find(i=>i.side===3);assert.notEqual(left.exposureId,first[2].exposureId);
 f.b.time+=4;assert.equal(click(f.b,first[0]),false);assert.equal(click(f.b,left),true);assert.equal(f.wall.sides[0].broken,false);assert.deepEqual(f.b.errors,[]);
});
test('Physical and Arts reductions use the committed live wall after DEF/RES',()=>{
 const f=fixture();close(hit(f),11.2);close(hit(f,'arts'),92);
 f.source.y=13;close(hit(f),112);close(hit(f,'arts'),920);assert.deepEqual(f.b.errors,[]);
});
for(const type of ['true','elemental'])test(type+' HP damage never gains firewall reduction',()=>{
 const f=fixture();close(hit(f,type),1000);assert.deepEqual(f.b.errors,[]);
});
test('sourceless damage bypasses the wall even when its credit unit stands outside',()=>{
 const f=fixture();close(hit(f,'phys',{sourceless:true}),112);assert.deepEqual(f.b.errors,[]);
});
test('post-mitigation reduction reaches shields without altering an area attack packet reused for another recipient',()=>{
 const f=fixture(),shield=f.b.addBuff(f.e,{key:'fixture-shield',shield:100}),other=f.h.spawn(key,{pos:[14,9]});other.profile.noAttack=true;
 const packet=f.b.makeDamage({amount:1000,type:'phys',canDodge:false}),hp=f.e.hp,otherHp=other.hp;
 f.b.dealDamage(f.source,f.e,packet);assert.equal(f.e.hp,hp);close(shield.shield,88.8);assert.equal(packet.amount,1000);assert.equal(packet.mul,1);
 f.b.dealDamage(f.source,other,packet);close(otherHp-other.hp,112);assert.deepEqual(f.b.errors,[]);
});
test('breaking a side opens that incoming direction without disabling another wall or applying a corner multiplier twice',()=>{
 const f=fixture();f.h.run(.55);taps(f.b,snapshot(f.b).find(i=>i.side===0));close(hit(f),112);
 f.source.x=-5;f.source.y=14;close(hit(f),11.2);
 f.source.x=-2;f.source.y=10;assert.deepEqual(crossed(f.wall,f.source,f.e),[3]);close(hit(f),11.2);
 assert.deepEqual(f.b.errors,[]);
});
test('corner crossing checks both adjacent unbroken sides and still applies reduction only once',()=>{
 const f=fixture();f.source.x=-2;f.source.y=10;assert.deepEqual(crossed(f.wall,f.source,f.e),[0,3]);close(hit(f),11.2);
 f.h.run(.55);taps(f.b,snapshot(f.b).find(i=>i.side===3));assert.deepEqual(crossed(f.wall,f.source,f.e),[0]);close(hit(f),11.2);
 taps(f.b,snapshot(f.b).find(i=>i.side===0));assert.deepEqual(crossed(f.wall,f.source,f.e),[]);close(hit(f),112);assert.deepEqual(f.b.errors,[]);
});
test('a boundary endpoint or segment wholly on one side does not invent a crossing',()=>{
 const f=fixture();assert.deepEqual(crossed(f.wall,{x:5,y:12},f.e),[]);assert.deepEqual(crossed(f.wall,{x:3,y:13},f.e),[]);
 assert.deepEqual(crossed(f.wall,{x:1,y:10},{x:1,y:17}),[]);assert.deepEqual(crossed(f.wall,{x:4,y:10},{x:4,y:17}),[0,2]);
 assert.deepEqual(crossed(f.wall,null,f.e),[]);assert.deepEqual(crossed(f.wall,{x:NaN,y:10},f.e),[]);
});
test('the native huge body participates in tile/radius targeting well away from its origin and restores exact previous geometry on retirement',()=>{
 const f=fixture();assert.deepEqual(f.e.hitArea,{w:7,h:4,dx:0,dy:0});assert.ok(f.b.enemiesInRadius(2,14,.1).includes(f.e));
 assert.ok(f.b.enemiesInKeys([14*21+2],f.source,{canHitFly:true}).includes(f.e));assert.ok(!f.b.enemiesInRadius(1,14,.1).includes(f.e));
 f.p.stop();assert.equal(f.e.hitArea,null);assert.ok(!f.b.enemiesInKeys([14*21+2],f.source,{canHitFly:true}).includes(f.e));assert.deepEqual(f.b.errors,[]);
});
test('tile-center exclusion is inside the rectangle, and the interaction-only port never silently blocks deployment',()=>{
 const f=fixture();assert.equal(blocked(f.b,14,2),true);assert.equal(blocked(f.b,13,8),true);assert.equal(blocked(f.b,12,5),false);
 assert.equal(blocked(f.b,16,5),false);assert.equal(blocked(f.b,14,1),false);assert.equal(blocked(f.b,NaN,5),false);
 f.p.stop();const port=registerChapter17Firewall(f.b,f.e,{width:7,height:4});assert.equal(blocked(f.b,14,5),false);port.retire();assert.deepEqual(f.b.errors,[]);
});
test('the retained canonical snake branch places its body on the nondeployable upper battlefield footprint',()=>{
 const s=read('data/candidates/arkpedia-stage-17-18-source.json');assert.deepEqual([s.geometry.rows,s.geometry.cols],[17,11]);
 assert.deepEqual(s.geometry.extraRoutes[0].start,{row:14,col:5});
 for(let row=13;row<=15;row++)for(let col=2;col<=8;col++)assert.equal(s.geometry.tileLegend[s.geometry.tileGrid[row][col]].deployable,'none');
 assert.ok(s.geometry.tileGrid[16].every(i=>s.geometry.tileLegend[i].key==='tile_forbidden'));
 // This is a geometry cross-check, not branch activation or stage admission.
 assert.equal(s.admitted,false);
});
test('source passive remains active under silence and control while ordinary HP loss bypasses it',()=>{
 const f=fixture();f.b.applyStatus(f.e,'silence',{duration:10});f.b.applyStatus(f.e,'stun',{duration:10});close(hit(f),11.2);
 const hp=f.e.hp;f.b.loseHp(f.e,1000);close(hp-f.e.hp,1000);assert.ok(!f.e.s.flags.selfBound);assert.ok(!f.e.s.flags.noDisplace);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['death','reuse','battleEnd','parentRemoval','wallRetirement'])test('firewall, modifier, geometry and windows retire together on '+mode,()=>{
 const f=fixture();f.h.run(.55);const input=snapshot(f.b)[0];if(mode==='death')f.b.kill(f.e,null);if(mode==='reuse')f.e.deploySeq++;
 if(mode==='battleEnd')f.b.forceEnd();if(mode==='parentRemoval')f.b.removeBuff(f.e,f.p.parent);if(mode==='wallRetirement')f.wall.retire();
 assert.equal(blocked(f.b,14,5),false);assert.equal(f.p.active,false);assert.equal(f.wall.active,false);assert.equal(click(f.b,input),false);
 assert.equal(f.b._takenMultipliers.has(f.p),false);assert.equal(f.e.hitArea,null);assert.ok(!f.e.buffs.includes(f.p.parent));
 assert.ok(!Object.values(f.b._hooks).flat().some(h=>h.owner===f.p||h.owner===f.wall));assert.deepEqual(f.b.errors,[]);
});
test('a reused body can install a fresh firewall without restoring a retired area or accepting old inputs',()=>{
 const f=fixture();f.h.run(.55);const input=snapshot(f.b)[0];f.e.deploySeq++;f.e.deployedAt=f.b.time;
 const next=install(f.b,f.e);assert.equal(f.p.active,false);assert.equal(next.active,true);assert.equal(click(f.b,input),false);assert.notEqual(next.wall.id,f.wall.id);
 next.stop();assert.equal(f.e.hitArea,null);assert.equal(f.e.mem.ch17SnakeFirewall,undefined);assert.deepEqual(f.b.errors,[]);
});
test('uncommitted movement leaves the old wall while explicit refresh changes its crossing and placement geometry',()=>{
 const f=fixture(),old=f.wall.sides.map(s=>[s.x,s.y]);f.e.x+=5;assert.deepEqual(f.wall.sides.map(s=>[s.x,s.y]),old);
 assert.equal(blocked(f.b,14,3),true);assert.equal(f.wall.refresh(),true);assert.equal(blocked(f.b,14,3),false);assert.equal(blocked(f.b,14,10),true);
 assert.deepEqual(snapshot(f.b),[]);assert.deepEqual(f.b.errors,[]);
});
for(const buff of ['enemy_musnake_t[damage_resistance]','enemy_musnake_init_fire_button'])test('rejecting '+buff+' rolls back the whole firewall admission',()=>{
 let battle,enemy;assert.throws(()=>fixture({beforeInstall:(b,e)=>{battle=b;enemy=e;b.on('beforeBuff',q=>{if(q.buff.key===buff)q.cancel=true;});}}),/admission failed/);
 assert.equal(enemy.mem.ch17SnakeFirewall,undefined);assert.equal(enemy.hitArea,null);assert.equal(blocked(battle,14,5),false);assert.deepEqual(snapshot(battle),[]);
 assert.equal(battle._takenMultipliers?.size??0,0);assert.deepEqual(battle.errors,[]);
});
test('ending the initial native buff once emits owned side windows, while stopping its controller does not',()=>{
 const f=fixture();f.b.removeBuff(f.e,f.p.init.buff);assert.deepEqual(snapshot(f.b).map(i=>i.side),[0,1,3]);const inputs=snapshot(f.b);
 f.b.removeBuff(f.e,f.p.init.buff);assert.deepEqual(snapshot(f.b),inputs);f.p.stop();assert.deepEqual(snapshot(f.b),[]);assert.deepEqual(f.b.errors,[]);
});
test('source contract rejects changed environment and root collider even with new component hashes',async()=>{
 for(const file of ['arkpedia-ch17-firewall-environment-source.json','arkpedia-ch17-firewall-boss-source.json'])await assert.rejects(()=>snakeFirewallContract({read:async url=>{
  const raw=readFileSync(url);if(!url.pathname.endsWith(file))return raw;const data=JSON.parse(raw);
  const row=Object.values(data.prefabs).flat().find(c=>c.originalJson.includes(file.includes('environment')?'_bossFirewallEffectConfigs':'"m_Size":{"x":7.0'));
  row.originalJson+=' ';row.sha256=createHash('sha256').update(row.originalJson).digest('hex');return Buffer.from(JSON.stringify(data));
 }}));
});

test('actual ordinary-stage operator and stage-token APIs reject direct placement before spending DP/stock',()=>{
 const mvp=read('data/arkpedia-mvp.json'),data=structuredClone(mvp);data.stage.geometry.waves=[];
 data.stage.tokens=[{unitId:'trap_001_crate',count:2,cost:5,hp:100,block:1,name:'Crate'}];
 const b=new StandardBattle(data,{operators:[defaultBuild(mvp.operators.char_122_beagle)]});b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const e=b.spawnEnemy(key,{def:record(),pos:[1,3]}),p=install(b,e),dp=b.dp,stock=b.mvpStageTokens.get('trap_001_crate');
 assert.match(b.placementError('char_122_beagle',1,3),/Firewall/);assert.throws(()=>b.deployOperator('char_122_beagle',1,3,'RIGHT'),/Firewall/);
 assert.throws(()=>b.deployToken('trap_001_crate',1,3),/Firewall/);assert.equal(b.dp,dp);assert.equal(b.mvpStageTokens.get('trap_001_crate'),stock);
 assert.equal(b.bench.char_122_beagle.deployments,0);p.stop();assert.doesNotMatch(b.placementError('char_122_beagle',1,3)??'',/Firewall/);assert.deepEqual(b.errors,[]);
});
test('manual summon-card placement checks the firewall before dispatching a custom source deck',()=>{
 const f=fixture();let calls=0;f.b.regularSummons=new Map([['fixture-card',{deck:{placementError:()=>{calls++;return null;}}}]]);
 assert.match(summonPlacementError(f.b,'fixture-card',14,5),/Firewall/);assert.equal(calls,0);f.p.stop();assert.equal(summonPlacementError(f.b,'fixture-card',14,5),null);assert.equal(calls,1);
});
