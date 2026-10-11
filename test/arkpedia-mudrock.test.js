// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-mudrock-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack } from '../server/sim/ai.js';
const ID = 'char_311_mudrok';
const near = (a,z) => assert.ok(Math.abs(a-z)<1e-5,`${a} != ${z}`);
const layers = u => u.findBuff('mudrock:layers')?.shieldHits ?? 0;
function advance(b,seconds) {for(let i=0;i<Math.ceil(seconds/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function advanceTo(b,time) {while(b.time < time-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}) {
  const d=structuredClone(data),o=d.operators[ID];d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const build={...defaultBuild(o),elite,potential,level:o.phases[elite].maxLevel,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(d,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.addDp('arkpedia',99);
  const receipts=[];b.on('damaged',c=>receipts.push({...c,time:b.time}));const u=b.deployOperator(ID,5,5,dir);assert.ok(u);
  u.atkCd=1000;u.profile.canAttack=()=>false;return{b,u,receipts};
}
function enemy(b,{x=6,y=5,fly=false}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=100000;
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u,total=u.skill.spCost){u.skill.setSpTotal(total);assert.equal(u.skill.activate('test'),true);}
function shot(b,u,e){performAttack(b,u,effectiveProfile(u),[e]);u.atkCd=1000;}
const incoming=(b,u,e,amount=100)=>b.dealDamage(e,u,{amount,type:'true',isAttack:true,applyWay:'ranged'});
const outgoing=(rs,u)=>rs.filter(r=>r.source===u&&r.target.side==='enemy');
test('source evidence keeps all ranks, shield-cap recharge dispatch, native S2 action order and real facings',()=>{
  assert.equal(source.source.bundles.length,5);assert.equal(source.frameParity,false);assert.equal(source.moduleSupport,false);
  assert.equal(Object.values(source.tables.skills).flatMap(s=>s.levels).length,30);
  assert.equal(source.templates['mudrok_t_1[shield_a]'].eventToActions.ON_BUFF_START[0]._buffKey,'mudrok_t_1[recharge]');
  assert.equal(source.templates['mudrok_t_1[shield_a]'].eventToActions.ON_BUFF_FINISH[0]._buff.templateKey,'mudrok_t_1[recharge]');
  const ability=source.skills.skchr_mudrok_2.flatMap(g=>g.components).find(c=>c.data._actions)?.data;
  const actions=JSON.parse(ability._actions.SerializedState);assert.equal(actions[0]._abilityName,'RollAttack');assert.ok(actions[1].$type.endsWith('HealViaMaxHpRatio'));
  for(const face of ['Front','Back'])assert.equal(source.models[ID][face].sha256,source.officialSkeletonBindings[ID][face].sha256);
  assert.equal(source.models[ID].Back.durations.Skill_2_Awake,undefined);assert.equal(source.models[ID].Front.durations.Skill_2_Awake,1);
});
for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++)test(`S${skill+1} rank${rank}: selected source cost, timing and output`,()=>{
  const{b,u,receipts}=make({skill,rank}),id=['skcom_def_up[3]','skchr_mudrok_2','skchr_mudrok_3'][skill];
  const s=source.tables.skills[id].levels[rank-1],bb=Object.fromEntries(s.blackboard.map(x=>[x.key,x.value]));near(u.skill.spCost,s.spData.spCost);
  const atk=u.s.atk,def=u.s.def;u.hp-=1000;cast(b,u);
  if(skill===0){near(u.s.def,def*(1+bb.def));advance(b,s.duration+.1);near(u.s.def,def);}
  if(skill===1){const e=enemy(b);b.rng.chance=p=>{near(p,bb.buff_prob);return false;};const hp=u.hp;shot(b,u,e);
    advance(b,.633);assert.equal(outgoing(receipts,u).length,0);near(u.hp,hp);advance(b,.067);
    near(outgoing(receipts,u)[0].amount,atk*bb.atk_scale);near(u.hp,hp+u.s.maxHp*bb.hp_ratio);assert.equal(u.skill.pending,false);}
  if(skill===2){near(u.s.atk,atk);assert.equal(u.canAct,false);advanceTo(b,u.skill.lastStart+bb.sleep+1.034);
    assert.equal(u.mem.mudrockAwake,true);near(u.s.atk,atk*(1+bb.atk));near(u.s.def,def*(1+bb.def));near(u.s.interval,u.base.bat*(1+bb.base_attack_time));
    advanceTo(b,u.skill.lastStart+bb.sleep+1+bb.awake+.1);near(u.s.atk,atk);near(u.s.def,def);near(u.s.interval,u.base.bat);}
});
for(const elite of [0,1,2])for(const potential of [1,3,5,6])test(`E${elite} P${potential}: selected initial layers, cap and shield-break healing`,()=>{
  const{b,u}=make({elite,potential}),t=u.def.talents[0].bb,e=enemy(b);assert.equal(layers(u),t.times);u.hp-=2000;const hp=u.hp;
  incoming(b,u,e,50000);near(u.hp,hp+u.s.maxHp*t.hp_ratio);assert.equal(layers(u),0);
  advance(b,t.interval*5);assert.equal(layers(u),t.max_times);assert.equal(u.mem.mudrockRecharge,null);
});
test('below-cap timer keeps its phase after break; full-cap break restarts a fresh nine seconds',()=>{
  const{b,u}=make(),e=enemy(b);advance(b,4);incoming(b,u,e);assert.equal(layers(u),0);advance(b,4.9);assert.equal(layers(u),0);
  advance(b,.2);assert.equal(layers(u),1);advance(b,18);assert.equal(layers(u),3);assert.equal(u.mem.mudrockRecharge,null);
  advance(b,5);incoming(b,u,e);assert.equal(layers(u),2);const start=b.time;advanceTo(b,start+8.9);assert.equal(layers(u),2);
  advanceTo(b,start+9.1);assert.equal(layers(u),3);assert.equal(u.mem.mudrockRecharge,null);
});
for(const type of ['phys','arts','true','elemental'])test(`${type} HP damage spends one shield layer and is fully blocked`,()=>{
  const{b,u}=make({skill:1}),e=enemy(b);u.hp-=2000;const hp=u.hp;
  b.dealDamage(e,u,{amount:10000,type,isAttack:true});near(u.hp,hp+u.s.maxHp*.2);assert.equal(layers(u),0);near(u.skill.spTotal,1);
});
test('shield-break healing reads current MAX HP and respects ordinary healing modifiers',()=>{
  const{b,u}=make(),e=enemy(b);b.addBuff(u,{key:'test:hp',mods:{hpPct:.5,healingTakenMul:.5}});void u.s;u.hp-=2000;const hp=u.hp;
  incoming(b,u,e);near(u.hp,hp+u.s.maxHp*.2*.5);
});
test('native shield and S2 self-heals ignore heal-free, while ordinary external heals still fail',()=>{
  const{b,u}=make({skill:1}),e=enemy(b);b.addBuff(u,{key:'test:heal-free',flags:{healFree:true}});u.hp-=2000;let hp=u.hp;
  near(b.heal(e,u,100),0);incoming(b,u,e);near(u.hp,hp+u.s.maxHp*.2);
  hp=u.hp;cast(b,u);shot(b,u,e);advance(b,1);near(u.hp,hp+u.s.maxHp*.06);
});
for(const refusal of ['invulnerable','dodgePhys','cancel'])test(`${refusal} leaves shield layers, healing and defensive SP untouched`,()=>{
  const{b,u}=make({skill:1}),e=enemy(b);u.hp-=1000;const hp=u.hp;
  if(refusal==='cancel')b.on('hit',c=>{if(c.target===u)c.dmg.cancel=true;});
  else b.addBuff(u,{key:'test:refusal',...(refusal==='invulnerable'?{flags:{invulnerable:true}}:{mods:{dodgePhys:1}})});
  b.dealDamage(e,u,{amount:10000,type:'phys',isAttack:true});near(u.hp,hp);assert.equal(layers(u),1);near(u.skill.spTotal,0);
});
test('elemental buildup and HP loss bypass hit shields, shield healing and defensive SP',()=>{
  const{b,u}=make({skill:1}),e=enemy(b);u.hp-=1000;const hp=u.hp;b.dealDamage(e,u,{amount:1,type:'element',element:'burn'});
  near(u.hp,hp);assert.equal(layers(u),1);b.loseHp(u,100,{source:e});near(u.hp,hp-100);assert.equal(layers(u),1);near(u.skill.spTotal,0);
});
test('the mapped zero post-mitigation damage receipt still consumes its native hit layer',()=>{
  const{b,u}=make({skill:1}),e=enemy(b);b.addBuff(u,{key:'test:zero',mods:{trueTakenMul:0}});u.hp-=1000;const hp=u.hp;
  incoming(b,u,e);assert.equal(layers(u),0);near(u.hp,hp+u.s.maxHp*.2);near(u.skill.spTotal,1);
});
for(const type of ['phys','arts','true','elemental'])test(`Sarkaz talent uses actual source tag on ${type}, not sourceless credit`,()=>{
  const{b,u}=make(),e=enemy(b);b.removeBuff(u,'mudrock:layers');e.tags.add('sarkaz');const hp=u.hp;
  b.dealDamage(e,u,{amount:type==='phys'?u.s.def+100:100,type});const factor=type==='arts'?.9:1;near(hp-u.hp,100*factor*.7);
  const before=u.hp;b.dealDamage(e,u,{amount:100,type:'true',sourceless:true});near(before-u.hp,100);
});
test('Sarkaz reduction is E2-only and never applies to unrelated sources or HP loss',()=>{
  const{b,u}=make({elite:1}),e=enemy(b);e.tags.add('sarkaz');b.removeBuff(u,'mudrock:layers');const hp=u.hp;incoming(b,u,e);near(hp-u.hp,100);
  const m=make(),z=enemy(m.b);m.b.removeBuff(m.u,'mudrock:layers');const before=m.u.hp;incoming(m.b,m.u,z);near(before-m.u.hp,100);
  z.tags.add('sarkaz');const prior=m.u.hp;m.b.loseHp(m.u,100,{source:z});near(prior-m.u.hp,100);
});
test('trait rejects ally healing; ordinary attacks have no invented self heal; regeneration works',()=>{
  const{b,u}=make(),e=enemy(b);u.hp-=1000;const hp=u.hp;near(b.heal(e,u,500),0);shot(b,u,e);advance(b,1);near(u.hp,hp);
  b.addBuff(u,{key:'test:regen',mods:{hpRegen:10}});advance(b,1);near(u.hp,hp+10);
});
for(const dir of ['RIGHT','UP','LEFT','DOWN'])test(`${dir}: ordinary .633 and S2 .667 events use original facing data`,()=>{
  const{b,u,receipts}=make({dir}),e=enemy(b,{x:5,y:5});shot(b,u,e);advance(b,.6);assert.equal(outgoing(receipts,u).length,0);
  advance(b,.067);assert.equal(outgoing(receipts,u).length,1);
  const z=make({dir,skill:1}),q=enemy(z.b,{x:5,y:5});cast(z.b,z.u);shot(z.b,z.u,q);advance(z.b,.633);assert.equal(outgoing(z.receipts,z.u).length,0);
  advance(z.b,.067);assert.equal(outgoing(z.receipts,z.u).length,1);
});
test('S2 strikes all current cross-range ground occupants, reselects at hit, then heals once',()=>{
  const{b,u,receipts}=make({skill:1}),input=enemy(b),inside=enemy(b,{x:5,y:4}),far=enemy(b,{x:7}),fly=enemy(b,{fly:true}),hidden=enemy(b,{x:5,y:5});
  b.addBuff(hidden,{key:'test:hidden',flags:{untargetable:true}});b.rng.chance=()=>false;u.hp-=1000;const hp=u.hp;cast(b,u);shot(b,u,input);
  input.x=8;b._buildEnemyIndex();const entrant=enemy(b,{x:4,y:5});advance(b,1);
  assert.equal(outgoing(receipts,u).length,2);near(input.hp,input.s.maxHp);for(const e of [far,fly,hidden])near(e.hp,e.s.maxHp);
  assert.ok(inside.hp<inside.s.maxHp&&entrant.hp<entrant.s.maxHp);near(u.hp,hp+u.s.maxHp*.06);
});
test('S2 still heals once when every occupant leaves before release, with no refunded charge',()=>{
  const{b,u,receipts}=make({skill:1}),e=enemy(b);u.hp-=1000;const hp=u.hp;cast(b,u);shot(b,u,e);e.x=10;b._buildEnemyIndex();advance(b,1);
  assert.equal(outgoing(receipts,u).length,0);near(u.hp,hp+u.s.maxHp*.06);near(u.skill.charges,0);
});
test('S2 selected per-victim stun runs before each strike and respects enemy stun immunity',()=>{
  const{b,u,receipts}=make({skill:1}),a=enemy(b),z=enemy(b,{x:5,y:4});z.def={...z.def,immune:new Set(['stun'])};const state=[];let n=0;
  b.rng.chance=p=>{near(p,.3);n++;return true;};b.on('hit',c=>{if(c.source===u)state.push([c.target,c.target.s.flags.stun]);});cast(b,u);shot(b,u,a);advance(b,1);
  assert.equal(n,2);assert.equal(outgoing(receipts,u).length,2);assert.deepEqual(state,[[a,true],[z,false]]);assert.ok(a.findBuff('stun').timeLeft>0);
});
test('S2 resolves independent selected stun decisions for each victim and heals after the complete area pass',()=>{
  const{b,u}=make({skill:1}),a=enemy(b),z=enemy(b,{x:5,y:4});let chances=0;const events=[];u.hp-=1000;const hp=u.hp;
  b.rng.chance=p=>{near(p,.3);return ++chances===1;};b.on('damaged',c=>{if(c.source===u&&c.target.side==='enemy')events.push(['strike',u.hp]);});
  b.on('heal',c=>{if(c.target===u)events.push(['heal',u.hp]);});cast(b,u);shot(b,u,a);advance(b,1);
  assert.equal(chances,2);assert.equal(a.s.flags.stun,true);assert.equal(z.s.flags.stun,false);
  assert.deepEqual(events.slice(0,2),[['strike',hp],['strike',hp]]);near(u.hp,hp+u.s.maxHp*.06);
});
test('ordinary attacks retain a legal original victim; S2 cancellation does not leak a heal at retreat',()=>{
  const{b,u,receipts}=make(),a=enemy(b),z=enemy(b,{x:5.5});shot(b,u,a);b.addBuff(z,{key:'test:taunt',mods:{taunt:10}});advance(b,1);
  assert.equal(outgoing(receipts,u).length,1);assert.equal(outgoing(receipts,u)[0].target,a);
  const m=make({skill:1}),e=enemy(m.b);m.u.hp-=1000;const hp=m.u.hp;cast(m.b,m.u);shot(m.b,m.u,e);m.b.retreat(m.u);advance(m.b,1);
  near(m.u.hp,hp);assert.equal(outgoing(m.receipts,m.u).length,0);assert.equal(m.u.findBuff('mudrock:s2-lock'),null);
});
test('S2 takes defensive SP only, locks it during casting, and can arm from its source cross-range trigger',()=>{
  const{b,u}=make({skill:1}),e=enemy(b,{x:4});advance(b,1);near(u.skill.spTotal,0);
  for(let i=0;i<4;i++)incoming(b,u,e,1);near(u.skill.spTotal,4);advance(b,b.dt);assert.equal(u.skill.pending,true);
  incoming(b,u,e,1);near(u.skill.spTotal,0);shot(b,u,e);advance(b,1);assert.equal(u.skill.pending,false);incoming(b,u,e,1);near(u.skill.spTotal,1);
});
test('S2 interrupted before its strike has no area damage/heal and releases its SP lock',()=>{
  const{b,u,receipts}=make({skill:1}),e=enemy(b);u.hp-=1000;const hp=u.hp;cast(b,u);shot(b,u,e);b.applyStatus(u,'stun',{duration:.05});advance(b,1);
  near(u.hp,hp);assert.equal(outgoing(receipts,u).length,0);assert.equal(u.skill.pending,false);assert.equal(u.findBuff('mudrock:s2-lock'),null);
});
test('S2 speeds its original uncapped animation with ASPD; ordinary attacks remain capped',()=>{
  const{b,u,receipts}=make({skill:1}),e=enemy(b);b.addBuff(u,{key:'test:aspd',mods:{aspd:100}});cast(b,u);shot(b,u,e);
  advance(b,.3);assert.equal(outgoing(receipts,u).length,0);advance(b,.067);assert.equal(outgoing(receipts,u).length,1);
  const z=make(),q=enemy(z.b);z.b.addBuff(z.u,{key:'test:aspd',mods:{aspd:100}});shot(z.b,z.u,q);advance(z.b,.4);assert.equal(outgoing(z.receipts,z.u).length,0);
});
test('S3 shelter releases blockers, prevents selection/damage, and keeps shield recharge independent',()=>{
  const{b,u}=make({skill:2}),e=enemy(b,{x:5,y:5});u.blocking.push(e);e.blockedBy=u;cast(b,u);
  assert.equal(u.blocking.length,0);assert.equal(e.blockedBy,null);assert.equal(u.canAct,false);assert.equal(u.s.flags.sleep,true);
  const hp=u.hp;incoming(b,u,e,50000);near(u.hp,hp);assert.equal(layers(u),1);advance(b,9.1);assert.equal(layers(u),2);near(u.skill.spTotal,0);
});
for(const status of ['stun','cold','freeze'])test(`S3 shelter rejects source anti ${status} without granting immunity after waking`,()=>{
  const{b,u}=make({skill:2});cast(b,u);assert.equal(b.applyStatus(u,status,{duration:20}),false);
  advanceTo(b,u.skill.lastStart+11.1);assert.equal(b.applyStatus(u,status,{duration:1}),true);
});
test('S3 aura slows legal ground and air recipients, removes immediately on leave, and clears at sleep end',()=>{
  const{b,u}=make({skill:2}),a=enemy(b,{x:7}),fly=enemy(b,{x:5,y:4,fly:true}),far=enemy(b,{x:8});
  for(const e of [a,fly,far]){e.base.moveSpeed=1;e.markDirty();}cast(b,u);near(a.s.moveSpeed,.4);near(fly.s.moveSpeed,.4);near(far.s.moveSpeed,1);
  a.x=9;b._buildEnemyIndex();advance(b,b.dt);near(a.s.moveSpeed,1);advanceTo(b,u.skill.lastStart+10.034);near(fly.s.moveSpeed,1);assert.equal(u.mem.mudrockAwake,false);
});
test('S3 original Awake animation gates its buff and surrounding ground stun, with percentage BAT',()=>{
  const{b,u}=make({skill:2,dir:'UP'}),a=enemy(b,{x:5,y:5}),z=enemy(b,{x:5,y:4}),fly=enemy(b,{fly:true}),far=enemy(b,{x:8});const atk=u.s.atk,def=u.s.def;cast(b,u);
  advanceTo(b,u.skill.lastStart+10.034);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Awake');assert.equal(u.canAct,true);assert.equal(u.s.flags.disarm,true);near(u.s.atk,atk);assert.equal(a.s.flags.stun,false);
  advanceTo(b,u.skill.lastStart+11.067);assert.equal(u.mem.mudrockAwake,true);near(u.s.atk,atk*2.4);near(u.s.def,def*1.8);near(u.s.interval,u.base.bat*.7);
  assert.equal(a.s.flags.stun,true);assert.equal(z.s.flags.stun,true);assert.equal(fly.s.flags.stun,false);assert.equal(far.s.flags.stun,false);
  assert.equal(u.mem.regularFormVisual.forceFront,undefined);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');
});
test('S3 awake attack selects up to current block count, with blocked priority and no area attack-range extension',()=>{
  const{b,u,receipts}=make({skill:2});cast(b,u);advanceTo(b,u.skill.lastStart+11.1);
  const es=Array.from({length:4},()=>enemy(b,{x:6})),far=enemy(b,{x:7}),blocked=enemy(b,{x:4.5});u.blocking.push(blocked);blocked.blockedBy=u;
  shot(b,u,es[0]);advance(b,1);const hits=outgoing(receipts,u);assert.equal(hits.length,3);assert.ok(hits.some(r=>r.target===blocked));near(far.hp,far.s.maxHp);
  near(hits[0].amount,u.s.atk);
});
for(const moment of [1,10.1,12])for(const action of ['end','retreat','death'])test(`S3 ${action} at ${moment}s cleans owned aura/phase state without a later wake`,()=>{
  const{b,u}=make({skill:2}),e=enemy(b,{x:5,y:5});cast(b,u);advance(b,moment);
  if(action==='end')u.skill.end('test');else if(action==='retreat')b.retreat(u);else b.kill(u);
  advance(b,12);assert.equal(u.mem.mudrockAwake,false);assert.equal(e.findBuff(`mudrock:slow:${u.id}`),null);
  for(const key of ['mudrock:sheltering','mudrock:awakening','mudrock:awake'])assert.equal(u.findBuff(key),null);
});
test('retreat and redeployment replace the previous recharge timer with a fresh initial layer and cadence',()=>{
  const{b,u}=make();advance(b,8);b.retreat(u);assert.equal(layers(u),0);assert.equal(u.mem.mudrockRecharge,null);advance(b,71);b.addDp('arkpedia',99);
  const next=b.deployOperator(ID,5,5,'RIGHT');assert.ok(next);assert.equal(layers(next),1);advance(b,8.9);assert.equal(layers(next),1);advance(b,.2);assert.equal(layers(next),2);
});
