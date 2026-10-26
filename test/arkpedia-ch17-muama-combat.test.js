// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {installChapter17MuamaCombat as install} from '../server/sim/content/chapter17-muama-combat.js';
import {chapter17Environment,chapter17FirewallSnapshot as snapshot,clickChapter17Firewall as click,chapter17FirewallBlocksDeployment as blocked} from '../server/sim/content/chapter17.js';
import {muamaCombatContract} from '../tools/arkpedia/muama-combat-contract.mjs';
import {verifiedMuamaDurability} from '../server/sim/content/chapter17-muama-durability.js';
import {execFileSync} from 'node:child_process';
import durability from '../data/candidates/arkpedia-ch17-muama-durability-contract.json' with {type:'json'};
const bytes=p=>readFileSync(new URL('../'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const contract=read('data/candidates/arkpedia-ch17-muama-combat-contract.json'),keys=Object.keys(contract.enemies),records=read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
function fixture({key=keys[0],positions=[[10,5]],beforeInstall}={}){
 const chess=Object.fromEntries(positions.map((_,i)=>['muama_op_'+i,chessRec({id:'muama_op_'+i,stats:{maxHp:10000,def:0,res:0,blockCnt:0}})]));
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:1e6,defs:{enemies:Object.fromEntries(keys.map(k=>[k,records[k].levels[0]])),chess},
  units:positions.map(([row,col],i)=>({chessId:'muama_op_'+i,row,col}))});
 h.b.start();for(const t of h.allies())t.profile.noAttack=true;const e=h.spawn(key,{pos:[10,6]});beforeInstall?.(h.b,e);
 const p=install(h.b,e),hits=[];h.b.on('hit',c=>{if(c.source?.id===e.id)hits.push({amount:c.dmg.amount,type:c.dmg.type,target:c.target,source:c.source});});
 return{h,b:h.b,e,p,t:h.allies()[0],targets:h.allies(),hits};
}
function nextShot(f){f.p.interrupt();f.p.cooldown=0;assert.equal(f.p.begin(),true);f.h.run(1);}
function breakSide(f,source){chapter17Environment(f.b).expose(source);const input=snapshot(f.b)[0];for(let i=0;i<3;i++)assert.equal(click(f.b,input),true);return input;}

test('durability source reproduces the full native action, original creators and independently witnessed take-damage alias',()=>{
 for(const pin of Object.values(durability.sources))assert.equal(createHash('sha256').update(bytes(pin.path)).digest('hex'),pin.sha256);
 execFileSync(process.execPath,['tools/arkpedia/muama-durability-contract.mjs','--check'],{stdio:'pipe'});
 assert.equal(durability.event.number,10);assert.equal(durability.event.name,'ON_TAKE_DAMAGE');assert.equal(durability.actions[1]._damageMask,'PHYSICAL_AND_MAGICAL');assert.equal(durability.actions[1]._filterApplyWay,false);assert.equal(durability.actions[1]._isStackable,false);
 for(const key of keys){const p=durability.enemies[key];assert.equal(createHash('sha256').update(p.creator.originalJson).digest('hex'),p.creator.sha256);const selected=verifiedMuamaDurability(key,records[key].levels[0],contract.enemies[key].passive);assert.equal(selected.ratio,.9);assert.ok(Object.isFrozen(selected)&&Object.isFrozen(selected.damageTypes));}
});

test('durability admission rejects changed actions, native creators, aliases, parent fields, duplicate parents and record ratios',()=>{
 const key=keys[0],r=records[key].levels[0],parents=contract.enemies[key].passive;
 for(const change of [s=>s.actions[1]._damageMask='ALL',s=>s.actions[1]._filterApplyWay=true,s=>s.actions[1]._isStackable=true,s=>s.actions[0]._targetType='TARGET',s=>s.template.originalJson+=' ',s=>s.event.name='ON_HIT',s=>s.enemies[key].creator.originalJson+=' ']){const s=structuredClone(durability);change(s);assert.throws(()=>verifiedMuamaDurability(key,r,parents,s),/action source/);}
 for(const change of [p=>p[0].isSilenceable=1,p=>p[0].attributes.abnormalFlags=[],p=>p.push(structuredClone(p[0])),p=>p.shift()]){const p=structuredClone(parents);change(p);assert.throws(()=>verifiedMuamaDurability(key,r,p),/parent or ratio/);}
 const changed=structuredClone(r);changed.talents.bb['DamageResistance.damage_resistance']=.5;assert.throws(()=>verifiedMuamaDurability(key,changed,parents),/parent or ratio/);
});

for(const key of keys)test(key+' scales only outside Physical/Arts damage after DEF/RES and does not mutate reused packets',()=>{
 const f=fixture({key,positions:[[10,2],[10,5]]});f.p.suspended=true;const[outside,inside]=f.targets;
 const hpDamage=(source,type,extra={})=>{const before=f.e.hp;f.b.dealDamage(source,f.e,{amount:3000,type,canDodge:false,...extra});return before-f.e.hp;};
 const def=f.e.s.def,res=f.e.s.res,physical=Math.max(3000-def,150),arts=3000*(1-res/100);
 assert.ok(Math.abs(hpDamage(outside,'phys')-physical*.1)<1e-6);assert.ok(Math.abs(hpDamage(outside,'arts')-arts*.1)<1e-6);
 assert.ok(Math.abs(hpDamage(inside,'phys')-physical)<1e-6);assert.ok(Math.abs(hpDamage(inside,'arts')-arts)<1e-6);
 for(const type of ['true','elemental'])assert.equal(hpDamage(outside,type),3000);
 assert.equal(hpDamage(null,'phys'),physical);assert.equal(hpDamage(outside,'arts',{sourceless:true}),arts);
 f.b.addBuff(f.e,{key:'fixture:control',flags:{silence:true,disarm:true,noCombat:true}});assert.ok(Math.abs(hpDamage(outside,'phys')-physical*.1)<1e-6);
 const packet={amount:3000,type:'arts',canDodge:false,applyWay:'melee'},before=structuredClone(packet);let hp=f.e.hp;f.b.dealDamage(outside,f.e,packet);assert.ok(Math.abs(hp-f.e.hp-arts*.1)<1e-6);hp=f.e.hp;f.b.dealDamage(inside,f.e,packet);assert.ok(Math.abs(hp-f.e.hp-arts)<1e-6);assert.deepEqual(packet,before);
 breakSide(f,outside);assert.equal(hpDamage(outside,'phys'),physical);assert.deepEqual(f.b.errors,[]);
});

test('shared combat contract reproduces all three native attack bindings, clocks, passives and independently pinned x-4 range',async()=>{
 assert.deepEqual(await muamaCombatContract(),contract);for(const s of Object.values(contract.sources))assert.equal(createHash('sha256').update(bytes(s.path)).digest('hex'),s.sha256);
 assert.equal(contract.range.grids.length,9);assert.deepEqual(keys,['enemy_1590_muama','enemy_1591_mutwin','enemy_1591_mutwin_2']);
 assert.equal(contract.enemies[keys[0]].defaults.hit,.6333333253860474);assert.equal(contract.enemies[keys[1]].defaults.hit,.6000000238418579);
 for(const k of keys)assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies[k].policy,null);
});
for(const key of keys)test(key+' uses its original marker and type, with the first +100 ATK applied before projectile damage',()=>{
 const f=fixture({key});f.h.run(.5);assert.equal(f.hits.length,0);assert.equal(f.p.count,0);assert.equal(f.e.stats.attacks,0);f.h.run(.6);
 assert.equal(f.p.count,1);assert.equal(f.hits.length,1);assert.equal(f.hits[0].amount,700);assert.equal(f.hits[0].type,contract.enemies[key].defaults.type);
 assert.equal(f.e.s.atk,700);assert.equal(f.e.stats.attacks,1);assert.equal(f.e.buffs.filter(b=>b.key==='enemy_muama_t').length,1);assert.deepEqual(f.b.errors,[]);
});
test('repeated accepted ordinary attacks cap the persistent target ramp at four and idle does not erase it',()=>{
 const f=fixture();for(let i=0;i<6;i++)nextShot(f);assert.deepEqual(f.hits.map(h=>h.amount),[700,800,900,1000,1000,1000]);
 assert.equal(f.p.count,4);f.p.interrupt();f.t.x=1;f.h.run(10);assert.equal(f.e.s.atk,1000);assert.equal(f.p.count,4);assert.deepEqual(f.b.errors,[]);
});
test('automatic combat keeps its canonical six-second period and native immobility without forced test releases',()=>{
 const f=fixture();f.h.run(20);assert.equal(f.e.stats.attacks,4);assert.deepEqual(f.hits.map(h=>h.amount),[700,800,900,1000]);
 assert.equal(f.t.hp,6600);assert.deepEqual([f.e.x,f.e.y],[6,10]);assert.equal(f.p.count,4);assert.deepEqual(f.b.errors,[]);
});
test('a target change resets prior layers and admits exactly the first layer for the new target',()=>{
 const f=fixture({positions:[[10,5],[10,8]]});f.targets[0].base.tauntLevel=2;f.targets[0].markDirty();nextShot(f);nextShot(f);assert.equal(f.e.s.atk,800);
 f.targets[1].base.tauntLevel=3;f.targets[1].markDirty();nextShot(f);assert.equal(f.p.count,1);assert.equal(f.e.s.atk,700);assert.equal(f.hits.at(-1).target,f.targets[1]);assert.deepEqual(f.b.errors,[]);
});
test('reusing the same target object is a different target life and cannot inherit old layers',()=>{
 const f=fixture();nextShot(f);nextShot(f);assert.equal(f.p.count,2);f.t.deploySeq++;nextShot(f);
 assert.equal(f.p.count,1);assert.equal(f.e.s.atk,700);assert.deepEqual(f.b.errors,[]);
});
test('ordinary cooldown and full clip prevent instant repeat releases even under high ASPD',()=>{
 const f=fixture();f.b.addBuff(f.e,{key:'fixture-aspd',mods:{aspd:500}});f.h.run(1.9);assert.equal(f.e.stats.attacks,1);f.h.run(1);
 assert.equal(f.e.stats.attacks,2);assert.deepEqual(f.b.errors,[]);
});
test('a short accepted control epoch cancels an unborn release even when the flag expires before the marker',()=>{
 const f=fixture();f.h.run(.2);f.b.applyStatus(f.e,'stun',{duration:.05});f.h.run(1);
 assert.equal(f.hits.length,0);assert.equal(f.p.count,0);assert.equal(f.e.stats.attacks,0);assert.deepEqual(f.b.errors,[]);
});
test('silence does not disable ordinary attacks or the source ramp/passive',()=>{
 const f=fixture();f.b.applyStatus(f.e,'silence',{duration:10});nextShot(f);assert.equal(f.p.count,1);assert.equal(f.hits[0].amount,700);
 assert.ok(f.e.findBuff('immune_shu_blink'));assert.ok(f.e.findBuff('immune_yu_blink'));assert.equal(f.e.s.flags.noMove,true);assert.deepEqual(f.b.errors,[]);
});
test('damage prevention does not turn an admitted source attack into a failed ramp event',()=>{
 const f=fixture();f.b.addBuff(f.t,{key:'fixture-shield',shield:1e9});nextShot(f);assert.equal(f.p.count,1);assert.equal(f.t.hp,10000);
 assert.equal(f.hits[0].amount,700);assert.deepEqual(f.b.errors,[]);
});
test('the ramp is a native direct ATK addition before percentage and final additions',()=>{
 const f=fixture();f.b.addBuff(f.e,{key:'fixture-atk-order',mods:{atkPct:.2,atkFinalFlat:10}});nextShot(f);
 assert.equal(f.hits[0].amount,850);assert.equal(f.p.count,1);assert.deepEqual(f.b.errors,[]);
});
test('rejected stack admission or accepted control during admission cannot emit a partial ordinary attack',()=>{
 for(const mode of ['reject','control']){
  const f=fixture();f.b.on('beforeBuff',c=>{if(c.buff.key==='enemy_muama_t'){if(mode==='reject')c.cancel=true;else f.b.applyStatus(f.e,'stun',{duration:.1});}});
  f.h.run(1);assert.equal(f.hits.length,0);assert.equal(f.e.stats.attacks,0);assert.equal(f.p.count,0);assert.ok(!f.e.findBuff('enemy_muama_t'));assert.deepEqual(f.b.errors,[]);
 }
});
test('fabricated legacy attack events cannot manufacture target layers or ordinary projectiles',()=>{
 const f=fixture();for(let i=0;i<5;i++)f.b.emit('attack',{attacker:f.e,targets:[f.t],isSkill:false});
 assert.equal(f.p.count,0);assert.equal(f.e.s.atk,600);assert.equal(f.b.projectiles.list.length,0);assert.deepEqual(f.b.errors,[]);
});
test('a captured target lost before release consumes no ramp and never redirects the unborn shot',()=>{
 const f=fixture({positions:[[10,5],[10,8]]});f.p.begin();const selected=f.p.pending.target;selected.deploySeq++;f.h.run(1);
 assert.equal(f.hits.length,0);assert.equal(f.p.count,0);assert.equal(f.e.stats.attacks,0);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['death','reuse'])test('a born ordinary projectile survives source '+mode+' with its accepted ATK and original attribution',()=>{
 const f=fixture();f.t.x=8;f.p.begin();f.h.run(.65);assert.ok(f.b.projectiles.list.length);const oldLife=f.e.deploySeq;
 if(mode==='death')f.b.kill(f.e,null);else{f.e.deploySeq++;f.b.addBuff(f.e,{key:'fixture-new-source',mods:{atkFlat:9000}});}
 f.h.run(.4);assert.equal(f.hits.length,1);assert.equal(f.hits[0].amount,700);assert.equal(f.hits[0].source.deploySeq,oldLife);assert.notEqual(f.hits[0].source,f.e);
 assert.equal(f.p.active,false);assert.deepEqual(f.b.errors,[]);
});
test('a born projectile cannot hit a redeployed trace target',()=>{
 const f=fixture();f.t.x=8;f.p.begin();f.h.run(.65);assert.ok(f.b.projectiles.list.length);f.t.deploySeq++;f.h.run(.4);
 assert.equal(f.hits.length,0);assert.equal(f.t.hp,10000);assert.deepEqual(f.b.errors,[]);
});
test('ordinary output reads current original-life ATK while a still-living projectile is in flight',()=>{
 const f=fixture();f.t.x=8;f.p.begin();f.h.run(.65);f.b.addBuff(f.e,{key:'fixture-live-atk',mods:{atkFlat:50}});f.h.run(.4);
 assert.equal(f.hits[0].amount,750);assert.deepEqual(f.b.errors,[]);
});
test('breaking one side releases three boundary tiles, including both corners, but never the center',()=>{
 const f=fixture();f.p.suspended=true;
 for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)assert.equal(blocked(f.b,10+dr,6+dc),true);
 const input=breakSide(f,{x:6,y:6});assert.equal(input.side,0);
 for(const dc of [-1,0,1])assert.equal(blocked(f.b,9,6+dc),false);
 assert.equal(blocked(f.b,10,6),true);assert.equal(blocked(f.b,11,5),true);assert.equal(blocked(f.b,10,5),true);
 for(const side of [{x:12,y:10},{x:6,y:14},{x:0,y:10}])breakSide(f,side);
 assert.equal(blocked(f.b,10,6),true);assert.equal(blocked(f.b,10,5),false);assert.deepEqual(f.b.errors,[]);
});
test('shared firewall reduction is after defense and breaking a side restores only that direction',()=>{
 const f=fixture({positions:[[10,2]]});f.p.suspended=true;f.e.base.def=100;f.e.markDirty();const hp=f.e.hp;
 f.b.dealDamage(f.t,f.e,{amount:1000,type:'phys',canDodge:false});assert.ok(Math.abs(hp-f.e.hp-90)<1e-7);
 breakSide(f,f.t);const hp2=f.e.hp;f.b.dealDamage(f.t,f.e,{amount:1000,type:'phys',canDodge:false});assert.equal(hp2-f.e.hp,900);assert.deepEqual(f.b.errors,[]);
});
test('explicit perimeter refresh restores broken boundaries without changing another owner',()=>{
 const f=fixture();f.p.suspended=true;breakSide(f,{x:6,y:6});const other=f.h.spawn(keys[1],{pos:[10,9]}),p2=install(f.b,other);p2.suspended=true;
 const old=p2.wall.sides.map(s=>[s.x,s.y]);f.e.x=4;f.p.wall.refresh();assert.ok(f.p.wall.sides.every(s=>!s.broken));assert.equal(blocked(f.b,9,4),true);
 assert.deepEqual(p2.wall.sides.map(s=>[s.x,s.y]),old);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['death','reuse','battleEnd','parentRemoval','wallRetirement'])test('ordinary state, ramp, passives, windows and modifiers retire together on '+mode,()=>{
 const f=fixture();nextShot(f);chapter17Environment(f.b).expose(f.t);const input=snapshot(f.b)[0];
 if(mode==='death')f.b.kill(f.e,null);if(mode==='reuse')f.e.deploySeq++;if(mode==='battleEnd')f.b.forceEnd();if(mode==='parentRemoval')f.b.removeBuff(f.e,f.p.buffs[0]);if(mode==='wallRetirement')f.p.wall.retire();
 if(!f.b.finished)f.h.run(.1);assert.equal(f.p.active,false);assert.equal(f.p.pending,null);assert.equal(click(f.b,input),false);assert.ok(!f.e.buffs.includes(f.p.ramp));
 assert.equal(f.b._takenMultipliers.has(f.p),false);assert.ok(!Object.values(f.b._hooks).flat().some(h=>h.owner===f.p));assert.deepEqual(f.b.errors,[]);
});
test('rejected passive admission cannot leave a partial wall, movement flag or teleport marker',()=>{
 let b,e;assert.throws(()=>fixture({beforeInstall:(battle,enemy)=>{b=battle;e=enemy;b.on('beforeBuff',c=>{if(c.buff.key==='immune_yu_blink')c.cancel=true;});}}),/admission failed/);
 assert.equal(e.mem.ch17MuamaCombat,undefined);assert.equal(blocked(b,10,6),false);assert.ok(!e.findBuff('immune_shu_blink'));assert.ok(!e.s.flags.noMove);assert.deepEqual(b.errors,[]);
});
test('owner retirement during the pre-release stack buff cannot release old output into a replacement body',()=>{
 const f=fixture();f.b.on('beforeBuff',c=>{if(c.buff.key==='enemy_muama_t')f.e.deploySeq++;});f.h.run(1);
 assert.equal(f.hits.length,0);assert.equal(f.e.stats.attacks,0);assert.equal(f.p.active,false);assert.deepEqual(f.b.errors,[]);
});
test('reusing the same profile for a fresh source controller does not inherit an old no-attack override',()=>{
 const f=fixture();f.e.deploySeq++;f.e.deployedAt=f.b.time;const next=install(f.b,f.e);
 assert.equal(f.p.active,false);assert.equal(next.active,true);assert.equal(f.e.profile.noAttack,true);
 next.stop();assert.equal(f.e.profile.noAttack,false);assert.equal(f.e.mem.ch17MuamaCombat,undefined);assert.deepEqual(f.b.errors,[]);
});
test('changed source records, original clocks and range-table bytes cannot broaden combat support',async()=>{
 const f=fixture();f.p.stop();const def=f.e.def,raw=structuredClone(def.raw);raw.talents.bb['SameTargetAtkUp.atk']=101;f.e.def={...def,raw};
 assert.throws(()=>install(f.b,f.e),/Unreviewed/);f.e.def=def;
 for(const name of ['arkpedia-ch17-channel-carrier-range-source.json','arkpedia-ch17-firewall-boss-animation-source.json'])await assert.rejects(()=>muamaCombatContract({read:async url=>{
  const bytes=readFileSync(url);if(!url.pathname.endsWith(name))return bytes;const d=JSON.parse(bytes);
  if(d.originalTableBase64)d.originalTableBase64='AA==';else d.enemies[keys[0]].base64='AA==';return Buffer.from(JSON.stringify(d));
 }}));
});
test('a forged range table with self-consistent replacement hashes still fails the original Git-blob pin',async()=>{
 await assert.rejects(()=>muamaCombatContract({read:async url=>{
  const raw=readFileSync(url);if(!url.pathname.endsWith('arkpedia-ch17-channel-carrier-range-source.json'))return raw;
  const data=JSON.parse(raw),table=JSON.parse(Buffer.from(data.originalTableBase64,'base64'));table['x-4'].direction=2;const changed=Buffer.from(JSON.stringify(table));
  data.originalTableBase64=changed.toString('base64');data.source.bytes=changed.length;data.source.sha256=createHash('sha256').update(changed).digest('hex');
  data.source.gitBlob=createHash('sha1').update(`blob ${changed.length}\0`).update(changed).digest('hex');return Buffer.from(JSON.stringify(data));
 }}),/Unreviewed firewall x-4/);
});
