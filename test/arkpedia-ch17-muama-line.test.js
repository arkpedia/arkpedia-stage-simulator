// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {installChapter17MuamaCombat} from '../server/sim/content/chapter17-muama-combat.js';
import {installChapter17MuamaLine as install} from '../server/sim/content/chapter17-muama-line.js';
import {muamaLineContract} from '../tools/arkpedia/muama-line-contract.mjs';
const bytes=p=>readFileSync(new URL('../'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const contract=read('data/candidates/arkpedia-ch17-muama-line-contract.json'),keys=Object.keys(contract.enemies),records=read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
const H='HorizontalLineAttack',V='VerticalLine';
function fixture({key=keys[0],positions=[[10,3]],enemyPos=[10,6]}={}){
 const chess=Object.fromEntries(positions.map((_,i)=>['muama_line_op_'+i,chessRec({id:'muama_line_op_'+i,stats:{maxHp:20000,def:0,res:0,blockCnt:0}})]));
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:1e6,defs:{enemies:Object.fromEntries(keys.map(k=>[k,records[k].levels[0]])),chess},units:positions.map(([row,col],i)=>({chessId:'muama_line_op_'+i,row,col}))});
 h.b.start();for(const t of h.allies())t.profile.noAttack=true;const e=h.spawn(key,{pos:enemyPos}),combat=installChapter17MuamaCombat(h.b,e),line=install(h.b,e,{combat});
 return{h,b:h.b,e,combat,line,t:h.allies()[0],targets:h.allies()};
}
function cast(f,name=H){f.combat.interrupt();f.combat.cooldown=0;f.line.cooldowns[name]=0;assert.equal(f.line.cast(name),true);}
function impact(f,name=H){cast(f,name);f.h.run(3.5);assert.ok(f.t.findBuff(contract.enemies[f.e.defId].skills[name].defaults.buffKey));}
const noErrors=f=>assert.deepEqual(f.b.errors,[]);

test('line receipt independently reproduces retained source clocks, selectors, projectiles and impact actions',async()=>{
 assert.deepEqual(await muamaLineContract(),contract);for(const s of Object.values(contract.sources))assert.equal(createHash('sha256').update(bytes(s.path)).digest('hex'),s.sha256);
 for(const key of keys){assert.equal(contract.enemies[key].skills[H].defaults.duration,4.5);assert.equal(contract.enemies[key].skills[H].defaults.radius,.25);
  assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies[key].policy,null);}
});
for(const key of keys)for(const name of [H,V])test(key+' '+name+' applies physical impact then its own fixed true damage and duration',()=>{
 const f=fixture({key,positions:name===H?[[10,3]]:[[9,6]],enemyPos:name===H?[10,6]:[12,6]});impact(f,name);assert.equal(f.t.hp,19400);assert.ok(f.t.s.flags.stun);assert.equal(f.combat.count,0);
 const d=contract.enemies[key].skills[name].defaults;f.h.run(d.dotDuration+.1);assert.equal(f.t.hp,19400-d.damage*d.dotDuration);assert.ok(!f.t.s.flags.stun);noErrors(f);
});
test('automatic vertical admission waits its canonical initial cooldown and takes a ready ordinary opportunity',()=>{
 const f=fixture({positions:[[9,6]],enemyPos:[12,6]});f.h.run(19.9);assert.equal(f.line.pending,null);f.h.run(.2);assert.equal(f.line.pending?.name,V);
 assert.equal(f.combat.pending,null);f.h.run(4.6);assert.equal(f.line.pending,null);assert.ok(f.line.cooldowns[V]>39.7);noErrors(f);
});
test('a ready line neither interrupts a normal clip nor bypasses its cooldown',()=>{
 const f=fixture({positions:[[10,5]]});assert.equal(f.combat.begin(),true);f.line.cooldowns[H]=0;assert.equal(f.line.cast(H),false);
 f.h.run(2.1);assert.equal(f.line.pending,null);assert.ok(f.combat.cooldown>3);f.h.run(4);assert.equal(f.line.pending?.name,H);assert.equal(f.e.stats.attacks,1);noErrors(f);
});
test('ordinary cooldown continues during a cast and normal release cannot overlap a line',()=>{
 const f=fixture({positions:[[10,5]]});cast(f);assert.equal(f.combat.actionBusy,f.line.pending);assert.equal(f.combat.begin(),false);f.h.run(4.6);
 assert.equal(f.line.pending,null);assert.equal(f.combat.actionBusy,null);assert.ok(f.combat.cooldown>1&&f.combat.cooldown<1.6);assert.equal(f.e.stats.attacks,0);noErrors(f);
});
for(const name of [H,V])test(name+' emits three parallel rays on the source marker, in the captured axis direction',()=>{
 const f=fixture({positions:name===H?[[10,2]]:[[9,6]],enemyPos:name===H?[10,6]:[12,6]});cast(f,name);f.h.run(3);assert.equal(f.line.output.beams.size,0);f.h.run(.15);
 const rays=[...f.line.output.beams];assert.equal(rays.length,3);assert.deepEqual(rays.map(p=>name===H?p.y:p.x),name===H?[9,10,11]:[5,6,7]);
 assert.ok(rays.every(p=>name===H?p.dx===-1&&p.dy===0:p.dx===0&&p.dy===-1));noErrors(f);
});
test('each parallel lane stops at its nearest contact and leaves a later body untouched',()=>{
 const f=fixture({positions:[[9,3],[10,3],[11,3],[10,1]]});cast(f);f.h.run(3.6);
 for(const t of f.targets.slice(0,3))assert.equal(t.hp,19400);assert.equal(f.targets[3].hp,20000);assert.equal(f.line.output.beams.size,0);noErrors(f);
});
for(const flag of ['untargetable','stealth','camou','liftoff'])test('cast selection respects '+flag+' while born collision ignores it',()=>{
 const f=fixture();f.b.addBuff(f.t,{key:'fixture-filter',flags:{[flag]:true}});f.line.cooldowns[H]=0;assert.equal(f.line.cast(H),false);
 f.b.removeBuff(f.t,'fixture-filter');cast(f);f.b.addBuff(f.t,{key:'fixture-filter',flags:{[flag]:true}});f.h.run(3.5);assert.ok(f.t.findBuff('enemy_muama_line_buff'));noErrors(f);
});
for(const kind of ['FLY','device','hidden'])test('collision skips '+kind+' bodies and admits the next ground body',()=>{
 const f=fixture({positions:[[10,4],[10,2]]});f.t.base.tauntLevel=-1;f.t.markDirty();cast(f);if(kind==='FLY')f.t.motion='FLY';if(kind==='device')f.t.kind='device';if(kind==='hidden')f.t.hidden=true;
 f.h.run(3.7);assert.equal(f.t.hp,20000);assert.equal(f.targets[1].hp,19400);noErrors(f);
});
test('stun immunity affects only the derived status and physical shields do not prevent the impact parent',()=>{
 const f=fixture();f.t.def={...f.t.def,immune:new Set(['stun'])};f.b.addBuff(f.t,{key:'fixture-shield',shield:1e6});impact(f);
 assert.equal(f.t.hp,20000);assert.ok(!f.t.s.flags.stun);assert.ok(f.t.findBuff('enemy_muama_line_buff'));const q=f.line.output.impacts.get('enemy_muama_line_buff').get(f.t);
 f.h.run(1.1);assert.equal(q.hits,1);noErrors(f);
});
test('damage rejection cannot suppress the independently admitted DOT and stun',()=>{
 const f=fixture();f.b.on('hit',c=>{if(c.dmg.tags?.includes('initial'))c.cancel=true;});impact(f);assert.equal(f.t.hp,20000);assert.ok(f.t.s.flags.stun);
 f.h.run(1.1);assert.equal(f.t.hp,19880);noErrors(f);
});
test('a target life changed by initial damage cannot receive an old-life parent',()=>{
 const f=fixture();f.b.on('hit',c=>{if(c.target===f.t&&c.dmg.tags?.includes('initial'))f.t.deploySeq++;});cast(f);f.h.run(3.5);
 assert.ok(!f.t.findBuff('enemy_muama_line_buff'));assert.ok(!f.t.s.flags.stun);noErrors(f);
});
for(const mode of ['death','reuse','stop'])test('born rays survive caster '+mode+' with captured modifiers and attribution',()=>{
 const f=fixture({positions:[[10,1]]});f.b.addBuff(f.e,{key:'fixture-atk',mods:{atkFlat:300}});cast(f);f.h.run(3.15);assert.ok(f.line.output.beams.size);
 if(mode==='death')f.b.kill(f.e,null);else if(mode==='reuse'){f.e.deploySeq++;f.b.addBuff(f.e,{key:'fixture-new-atk',mods:{atkFlat:9000}});}else{f.line.stop();f.combat.stop();f.b.removeBuff(f.e,'fixture-atk');}
 f.h.run(.55);assert.equal(f.t.hp,19100);f.h.run(1.1);assert.equal(f.t.hp,18980);noErrors(f);
});
test('brief intrinsic control invalidates an unborn cast by epoch, without granting cast stun immunity',()=>{
 const f=fixture();cast(f);f.h.run(.5);f.b.applyStatus(f.e,'stun',{duration:.01});f.h.run(3.5);assert.equal(f.line.output.beams.size,0);assert.equal(f.t.hp,20000);
 assert.equal(f.combat.actionBusy,null);assert.ok(f.line.cooldowns[H]>36);noErrors(f);
});
test('silence blocks admission but does not cancel a cast or a born impact parent',()=>{
 const f=fixture();f.b.applyStatus(f.e,'silence',{duration:1});f.line.cooldowns[H]=0;assert.equal(f.line.cast(H),false);f.h.run(1.1);f.line.interrupt();
 cast(f);f.b.applyStatus(f.e,'silence',{duration:20});f.h.run(3.5);assert.equal(f.t.hp,19400);f.h.run(1.1);assert.equal(f.t.hp,19280);noErrors(f);
});
test('literal sequence dispatch is unaffected by ASPD and slowdown in the scoped local mapping',()=>{
 const f=fixture({positions:[[10,2]]});f.b.addBuff(f.e,{key:'fixture-speed',mods:{aspd:500,slowDownMul:.5}});assert.equal(f.e.s.slowDownRate,.5);cast(f);f.h.run(3);assert.equal(f.line.output.beams.size,0);
 f.h.run(.15);assert.equal(f.line.output.beams.size,3);noErrors(f);
});
test('target life loss before the marker cancels output without redirecting to a new body',()=>{
 const f=fixture({positions:[[10,3],[10,1]]});cast(f);f.line.pending.target.deploySeq++;f.h.run(3.5);assert.equal(f.line.output.beams.size,0);assert.ok(f.targets.every(t=>t.hp===20000));noErrors(f);
});
test('target redeployment retires an existing parent and its exact derived status',()=>{
 const f=fixture();impact(f);f.t.deploySeq++;f.h.run(.1);assert.ok(!f.t.findBuff('enemy_muama_line_buff'));assert.ok(!f.t.s.flags.stun);noErrors(f);
});
test('removing an owned parent preserves an unrelated stun',()=>{
 const f=fixture();impact(f);f.b.applyStatus(f.t,'stun',{key:'fixture-other-stun',duration:20});f.b.removeBuff(f.t,'enemy_muama_line_buff');
 assert.ok(f.t.findBuff('fixture-other-stun'));assert.equal(f.line.output.impacts.get('enemy_muama_line_buff').size,0);noErrors(f);
});
test('battle end retires all actors, rays, parents and action locks',()=>{
 const f=fixture();impact(f);f.b._finish('defeat');assert.equal(f.line.active,false);assert.equal(f.line.output.beams.size,0);assert.ok(!f.t.findBuff('enemy_muama_line_buff'));assert.equal(f.combat.actionBusy,null);noErrors(f);
});
test('a line actor refuses an unrelated combat owner or changed exact canonical record',()=>{
 const f=fixture();assert.throws(()=>install(f.b,f.e,{combat:{valid:()=>true,ownerLife:f.e.deploySeq}}),/fresh deployment/);
 assert.throws(()=>install(f.b,f.e,{combat:f.combat}),/only one/);f.line.stop();f.e.def={...f.e.def,raw:{...f.e.def.raw,skills:[]}};assert.throws(()=>install(f.b,f.e,{combat:f.combat}),/Unreviewed/);noErrors(f);
});
test('the native named parent replaces same-key casters and keeps Muama and twin namespaces independent',()=>{
 const f=fixture();impact(f);const first=f.line.output.impacts.get('enemy_muama_line_buff').get(f.t);
 const other=f.h.spawn(keys[0],{pos:[10,6]}),otherCombat=installChapter17MuamaCombat(f.b,other),otherLine=install(f.b,other,{combat:otherCombat});
 otherLine.cooldowns[H]=0;assert.equal(otherLine.cast(H),true);f.h.run(3.5);
 const replacement=f.line.output.impacts.get('enemy_muama_line_buff').get(f.t);assert.notEqual(replacement,first);assert.equal(first.active,false);assert.ok(!f.t.buffs.includes(first.child));
 const twin=f.h.spawn(keys[1],{pos:[10,6]}),twinCombat=installChapter17MuamaCombat(f.b,twin),twinLine=install(f.b,twin,{combat:twinCombat});
 twinLine.cooldowns[H]=0;assert.equal(twinLine.cast(H),true);f.h.run(3.5);
 assert.ok(f.t.findBuff('enemy_muama_line_buff'));assert.ok(f.t.findBuff('enemy_mutwin_line_buff'));assert.equal(f.t.buffs.filter(b=>b.key==='enemy_muama_line_buff').length,1);noErrors(f);
});
test('the parent clock survives child removal and hidden time without gaining extra damage ticks',()=>{
 const f=fixture();impact(f);const q=f.line.output.impacts.get('enemy_muama_line_buff').get(f.t);f.b.removeBuff(f.t,q.child);assert.ok(!f.t.s.flags.stun);
 f.t.hidden=true;f.h.run(2.1);assert.equal(q.hits,2);assert.equal(f.t.hp,19400);f.t.hidden=false;f.h.run(6.1);
 assert.equal(f.t.hp,19400-6*120);assert.equal(q.hits,8);assert.equal(q.active,false);noErrors(f);
});
test('equal ready line skills consume RNG only when the combat actor can accept one action',()=>{
 const f=fixture({positions:[[10,5]]});f.line.cooldowns[H]=0;f.line.cooldowns[V]=0;f.combat.cooldown=5;const seed=f.b.rng.state();
 f.h.run(1);assert.equal(f.b.rng.state(),seed);f.h.run(4.1);assert.ok([H,V].includes(f.line.pending?.name));assert.notEqual(f.b.rng.state(),seed);noErrors(f);
});
test('fresh-life ownership cannot be clobbered by retiring an older line actor',()=>{
 const f=fixture();cast(f);f.e.deploySeq++;f.e.deployedAt=f.b.time;const combat=installChapter17MuamaCombat(f.b,f.e),line=install(f.b,f.e,{combat});
 line.cooldowns[H]=0;assert.equal(line.cast(H),true);const q=line.pending;f.line.stop();assert.equal(combat.actionBusy,q);assert.equal(combat.readyAction,line.tryReady);
 assert.equal(f.e.mem.ch17MuamaLine,line);f.h.run(3.5);assert.equal(f.t.hp,19400);noErrors(f);
});
test('source mutation refuses a forged line selector or projectile even with a self-rehashed local graph',async()=>{
 for(const mode of ['selector','projectile'])await assert.rejects(muamaLineContract({read:async url=>{
  const raw=readFileSync(url);
  if(!String(url).endsWith('arkpedia-ch17-firewall-boss-source.json'))return raw;
  const graph=JSON.parse(raw),rows=mode==='selector'?graph.prefabs['dyn/battle/prefabs/enemies/'+keys[0]+'.prefab']:graph.projectiles['dyn/battle/prefabs/[uc]projectiles/projectile_enemy_muama_line_h.prefab'];
  const row=rows.find(r=>mode==='selector'?'_horizonSize'in JSON.parse(r.originalJson):r.componentType==='CircleCollider2D'),c=JSON.parse(row.originalJson);
  if(mode==='selector')c._horizonSize=9;else c.m_Radius=2;row.originalJson=JSON.stringify(c);row.sha256=createHash('sha256').update(row.originalJson).digest('hex');return Buffer.from(JSON.stringify(graph));
 }}));
});
test('control blocks new casts and a missing eligible lane keeps a ready skill pending',()=>{
 for(const status of ['disarm','stun','freeze','sleep']){
  const f=fixture();f.b.applyStatus(f.e,status,{duration:5});f.line.cooldowns[H]=0;assert.equal(f.line.cast(H),false);noErrors(f);
 }
 const f=fixture({positions:[[12,3]]});f.line.cooldowns[H]=0;f.h.run(2);assert.equal(f.line.pending,null);assert.equal(f.line.cooldowns[H],0);noErrors(f);
});
test('rays that miss terminate at their native lifetime after the actor retires',()=>{
 const f=fixture();cast(f);f.h.run(3.15);f.t.hidden=true;f.line.stop();f.combat.stop();const output=f.line.output;
 f.h.run(9.9);assert.equal(output.beams.size,3);f.h.run(.2);assert.equal(output.beams.size,0);assert.equal(output.active,false);assert.equal(f.t.hp,20000);noErrors(f);
});
