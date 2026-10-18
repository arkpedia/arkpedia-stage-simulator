// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import{make as base,enemy,advance,near,until}from'./helpers/makoto-fixture.js';
import{MakotoSkillTwoCombat,MAKOTO_S2_COMBAT_CONTRACT as CONTRACT,verifyMakotoS2Combat}from'../server/sim/content/arkpedia-makoto-s2-combat.js';
import{makotoS2Inputs}from'../server/sim/content/arkpedia-makoto-source.js';
const active=new Set();
test.afterEach(()=>{for(const f of active){assert.deepEqual(f.b.errors,[]);f.combat.stop();}active.clear();});
function make({inPersona,defer=false,roll=false,...build}={}){
 const f=base({...build,skill:2,defer:true});f.controller.stop();f.allow=true;f.executions=[];f.statuses=[];
 f.combat=new MakotoSkillTwoCombat(f.b,f.u,{contract:CONTRACT,inPersona:inPersona?()=>inPersona(f):()=>f.allow});
 f.b._setupUnit(f.u,{trait:f.combat.trait(),talents:[],skill:{kind:'instant',completeOnAttack:false,trigger:{rule:'NEVER'}}});f.combat.install();
 f.b.rng.chance=()=>roll;
 f.b.on('damaged',h=>{if(h.dmg?.tags.includes('makoto:s2-execution'))f.executions.push({...h,time:f.b.time});});
 f.b.on('statusApplied',h=>{if(h.source===f.u&&h.status==='fear')f.statuses.push({...h,time:f.b.time});});
 active.add(f);if(!defer)f.deploy();return f;
}
const attacks=f=>f.hits.filter(h=>h.dmg.tags.includes('makoto:s2'));
function fear(f,t,{source=f.u,duration=10,key='fear'}={}){assert.equal(f.b.applyStatus(t,'fear',{source,duration,key}),true);}
function frozen(f){f.b.addBuff(f.u,{key:'fixture:freeze-attacks',flags:{disarm:true}});}
function member(f,t){return f.combat.members.get(t);}

test('S2 retains its empty animation key, original pre-delay, ordered Fear/damage buffs and independent all-motion aura',()=>{
 verifyMakotoS2Combat();const n=makotoS2Inputs();assert.equal(n.attack._animKey,'');assert.equal(n.attack._preDelay,.800000011920929);
 assert.equal(n.selector._targetMotion,1);assert.equal(n.validator._targetOptions.targetMotion,3);
 assert.equal(n.aura._buffs[0].triggerInterval,.10000000149011612);assert.equal(n.aura._buffs[0].waitFirstTriggerInterval,0);
});
for(const[label,edit]of[
 ['fabricated attack clip',n=>n.attack._animKey='Attack'],['removed pre-delay',n=>n.attack._preDelay=0],['capped playback',n=>n.attack._maxAnimScale=1],
 ['no slowdown',n=>n.attack._affectedBySlowDown=0],['air attack',n=>n.selector._targetMotion=3],['missable producer',n=>n.attack._activeBuffs[0].isDamageMissable=1],
 ['reversed actions',n=>n.attack._activeBuffs.reverse()],['ground-only execute aura',n=>n.validator._targetOptions.targetMotion=1],
 ['source-shared aura',n=>n.aura._buffs[0].independentCharacterSource=0],['rounded native cadence',n=>n.aura._buffs[0].triggerInterval=.1],
 ['lost leave cleanup',n=>n.aura._removeBuffWhenTargetLeave=0],['strict HP predicate',n=>{
  const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if(v.$type?.includes('+FilterByTargetHp,'))v._condType='LE';Object.values(v).forEach(x=>{if(x&&typeof x==='object')visit(x);});}};visit(n.templates.makoto_s2_fear_aura_inst_kill);
 }],
])test(`Changed S2 ${label} fails source verification`,()=>{const n=structuredClone(makotoS2Inputs());edit(n);assert.throws(()=>verifyMakotoS2Combat(n),/Changed original/);});

for(const rank of Array.from({length:10},(_,i)=>i+1))for(const dir of['RIGHT','UP'])test(`S2 rank${rank} ${dir} uses one delayed receipt and its selected max-target Arts coefficient`,()=>{
 const f=make({rank,dir}),ts=Array.from({length:6},()=>enemy(f));until(f,()=>!!f.combat.phase);
 const captured=f.combat.phase.inputs.map(i=>i.target),period=f.u.s.interval;
 assert.equal(captured.length,f.record.bb['attack@max_target']);advance(f.b,.7);assert.equal(attacks(f).length,0);
 until(f,()=>f.receipts.length===1);f.allow=false;
 assert.equal(attacks(f).length,captured.length);assert.equal(new Set(attacks(f).map(h=>h.dmg.attackId)).size,1);
 for(const h of attacks(f)){near(h.amount,f.u.s.atk*f.record.bb['attack@atk_scale']);assert.equal(h.type,'arts');assert.equal(h.dmg.isProjectile,false);assert.equal(h.dmg.isSkill,false);assert.ok(captured.includes(h.target));}
 for(const t of ts.filter(t=>!captured.includes(t)))near(t.hp,t.s.maxHp);
 assert.equal(f.b.projectiles.list.length,0);assert.equal(f.statuses.length,0);assert.ok(period>0);
 assert.equal(f.u.mem.regularFormVisual.clip,'Doll_Skill_2_Loop');
});
test('S2 keeps its continuous original loop instead of restarting an invented attack animation',()=>{
 const f=make();enemy(f);until(f,()=>f.receipts.length===1);const visual=f.u.mem.regularFormVisual;
 until(f,()=>f.receipts.length===3);assert.equal(f.u.mem.regularFormVisual===visual,true);assert.equal(visual.loop,true);assert.equal(visual.playId,undefined);
});
test('Native x-1 attack range excludes air, hidden, target-free and unblocked camouflage inputs without extension',()=>{
 const f=make();const a=enemy(f,{motion:'FLY'}),h=enemy(f),t=enemy(f,{flags:{untargetable:true}}),c=enemy(f,{flags:{camou:true}}),far=enemy(f,{col:8});h.hidden=true;
 f.b.addBuff(f.u,{key:'fixture:range',mods:{rangeExtend:10}});assert.equal(f.combat.choices().length,0);
 f.b.removeBuff(c,'fixture:pin');assert.deepEqual(f.combat.choices().map(t=>t.id),[c.id]);assert.ok([a,t,far].every(t=>!f.combat.choices().includes(t)));
});
test('Lost captured inputs do not cancel remaining original victims or acquire a replacement',()=>{
 const f=make(),ts=Array.from({length:5},()=>enemy(f));until(f,()=>!!f.combat.phase);const old=f.combat.phase.inputs.map(i=>i.target),lost=old[0],extra=ts.find(t=>!old.includes(t));
 f.b.kill(lost,null);until(f,()=>f.receipts.length===1);f.allow=false;
 assert.equal(attacks(f).length,old.length-1);near(extra.hp,extra.s.maxHp);
});
test('A beforeAttack subset veto removes only those original inputs and cannot substitute others',()=>{
 const f=make();Array.from({length:4},()=>enemy(f));until(f,()=>!!f.combat.phase);const excluded=f.combat.phase.inputs[1].target;
 f.b.on('beforeAttack',h=>{if(h.attacker===f.u)h.targets=h.targets.filter(t=>t!==excluded);});until(f,()=>f.receipts.length===1);f.allow=false;
 assert.equal(attacks(f).length,3);near(excluded.hp,excluded.s.maxHp);
});
test('Fear rolls once per captured recipient before its separate Arts damage and does not add a projectile',()=>{
 const f=make({roll:true});Array.from({length:4},()=>enemy(f));let rolls=0;f.b.rng.chance=p=>{near(p,.35);rolls++;return true;};
 until(f,()=>f.receipts.length===1);f.allow=false;assert.equal(rolls,4);assert.equal(f.statuses.length,4);assert.equal(attacks(f).length,4);
 for(const h of attacks(f)){assert.ok(f.statuses.find(s=>s.target===h.target&&s.time<=h.time));assert.equal(h.target.s.flags.fear,true);}
});
test('Fear probability failure leaves the independent Arts action intact',()=>{
 const f=make({roll:false});enemy(f);until(f,()=>f.receipts.length===1);f.allow=false;assert.equal(f.statuses.length,0);assert.equal(attacks(f).length,1);
});
test('Fear immunity and resistance use the shared source status path without suppressing damage',()=>{
 const f=make({roll:true}),a=enemy(f),z=enemy(f);a.def={...a.def,immune:new Set(['feared'])};f.b.applyStatus(z,'resist',{duration:10,value:.5});
 until(f,()=>f.receipts.length===1);f.allow=false;assert.equal(!!a.s.flags.fear,false);assert.equal(z.s.flags.fear,true);assert.equal(attacks(f).length,2);
 near(z.findBuff('fear').duration,.75);assert.equal(z.findBuff('fear').source===f.u,true);assert.ok(z.findBuff('fear').data.fear);
});
test('The non-missable Fear producer is separate from normal Arts evasion',()=>{
 const f=make({roll:true}),t=enemy(f);f.b.addBuff(t,{key:'fixture:evade',mods:{dodgeArts:1}});
 until(f,()=>f.receipts.length===1);f.allow=false;assert.equal(t.s.flags.fear,true);assert.equal(attacks(f).length,0);assert.equal(f.statuses.length,1);
});
test('A vetoed Fear application does not cancel the separate Arts action',()=>{
 const f=make({roll:true});enemy(f);f.b.on('beforeStatus',h=>{if(h.source===f.u&&h.status==='fear')h.cancel=true;});
 until(f,()=>f.receipts.length===1);f.allow=false;assert.equal(f.statuses.length,0);assert.equal(attacks(f).length,1);
});
test('Source loss inside Fear callbacks stops unborn damage and later recipients',()=>{
 const f=make({roll:true});Array.from({length:4},()=>enemy(f));f.b.on('beforeStatus',h=>{if(h.source===f.u&&h.status==='fear')f.u.deploySeq++;});
 advance(f.b,1.1);assert.equal(attacks(f).length,0);assert.equal(f.statuses.length,0);
});
test('Recipient replacement inside Fear callbacks cannot inherit old damage or cancel different original victims',()=>{
 const f=make({roll:true});Array.from({length:4},()=>enemy(f));until(f,()=>!!f.combat.phase);const lost=f.combat.phase.inputs[0].target;
 f.b.on('beforeStatus',h=>{if(h.target===lost&&h.status==='fear')lost.deploySeq++;});until(f,()=>f.receipts.length===1);f.allow=false;
 assert.equal(attacks(f).length,3);near(lost.hp,lost.s.maxHp);
});

test('Execution aura polls strict live HP/ATK threshold independently of attacks and accepts foreign Fear',()=>{
 const f=make();frozen(f);const t=enemy(f,{hp:1e6});until(f,()=>!!member(f,t));fear(f,t,{source:f.b.allyUnits.find(a=>a!==f.u)??null});
 const threshold=f.u.s.atk*f.record.bb['attack@kill_atk_scale'];t.hp=threshold;advance(f.b,.2);assert.equal(t.alive,true);
 t.hp=threshold-1;until(f,()=>!t.alive);assert.equal(f.receipts.length,0);assert.equal(f.executions.length,1);
 assert.equal(f.executions[0].source,null);assert.equal(f.executions[0].credit===f.u,true);assert.equal(f.executions[0].type,'true');assert.equal(f.executions[0].dmg.applyWay,'none');
});
test('Low HP without a logical Fear buff is not sufficient for execution',()=>{
 const f=make();frozen(f);const t=enemy(f,{hp:1000});f.b.addBuff(t,{key:'fixture:raw-fear-flag',flags:{fear:true}});advance(f.b,.5);
 assert.equal(t.alive,true);assert.equal(f.executions.length,0);fear(f,t);until(f,()=>!t.alive);assert.equal(f.executions.length,1);
});
test('An incoming already-feared enemy triggers immediately on first aura attachment',()=>{
 const f=make();frozen(f);const t=enemy(f,{hp:1000,col:9});fear(f,t);advance(f.b,.2);assert.equal(t.alive,true);
 t.x=6;t.y=5;advance(f.b,f.b.dt);assert.equal(t.alive,false);assert.equal(f.executions.length,1);
});
test('The execution aura accepts airborne Fear although ordinary S2 attacks are ground-only',()=>{
 const f=make();frozen(f);const t=enemy(f,{motion:'FLY',hp:1000});fear(f,t);advance(f.b,f.b.dt);
 assert.equal(t.alive,false);assert.equal(f.executions.length,1);assert.equal(f.receipts.length,0);
});
test('The aura threshold uses current ATK, not attack scale or outgoing damage multipliers',()=>{
 const f=make();frozen(f);const t=enemy(f,{hp:1e6});fear(f,t);const threshold=f.u.s.atk*f.record.bb['attack@kill_atk_scale'];t.hp=threshold*1.5;
 f.b.addBuff(f.u,{key:'fixture:scalers',mods:{atkScaleMul:10,dmgDealtMul:10}});advance(f.b,.3);assert.equal(t.alive,true);
 f.b.addBuff(f.u,{key:'fixture:real-atk',mods:{atkPct:1}});until(f,()=>!t.alive);assert.equal(f.executions.length,1);
});
test('Aura cadence ignores source ASPD, slowDown zero and action control',()=>{
 const f=make();frozen(f);const t=enemy(f,{hp:1e6});until(f,()=>!!member(f,t));fear(f,t);t.hp=100;
 f.b.addBuff(f.u,{key:'fixture:zero',mods:{slowDownMul:0,aspd:500},flags:{stun:true}});until(f,()=>!t.alive,.3);
 assert.equal(f.executions.length,1);assert.equal(f.receipts.length,0);
});
test('Fear from an S2 strike is executed by a later independent aura poll, not an on-hit direct kill',()=>{
 const f=make({roll:true}),t=enemy(f,{hp:1e6});t.hp=f.u.s.atk*f.record.bb['attack@atk_scale']+100;
 until(f,()=>f.receipts.length===1);assert.equal(t.alive,true);const strike=f.b.time;
 until(f,()=>!t.alive);assert.ok(f.executions[0].time>strike);assert.ok(f.executions[0].time-strike<=.1+f.b.dt);
});
test('Mode departure removes only this owner aura while accepted Fear survives',()=>{
 const f=make({roll:true}),t=enemy(f);until(f,()=>f.receipts.length===1);assert.ok(member(f,t));const own=member(f,t).buff;
 f.b.addBuff(t,{key:'foreign:aura',data:{foreign:true}});f.allow=false;advance(f.b,.1);
 assert.equal(t.buffs.includes(own),false);assert.ok(t.findBuff('foreign:aura'));assert.equal(t.s.flags.fear,true);assert.equal(f.combat.members.size,0);
});
test('Aura leave and reentry detach the old marker and create a fresh immediate check',()=>{
 const f=make();frozen(f);const t=enemy(f,{hp:1e6});until(f,()=>!!member(f,t));const old=member(f,t).buff;
 t.x=10;advance(f.b,.05);assert.equal(member(f,t),undefined);assert.equal(t.buffs.includes(old),false);
 fear(f,t);t.hp=100;t.x=6;advance(f.b,.05);assert.equal(t.alive,false);assert.equal(f.executions.length,1);
});
for(const flag of ['invulnerable','untargetable','sleep'])test(`A protected ${flag} recipient cannot inherit an execution aura`,()=>{
 const f=make();frozen(f);const t=enemy(f,{hp:1000,flags:{[flag]:true}});f.b.addBuff(t,{key:'fear'});advance(f.b,.3);
 assert.equal(t.alive,true);assert.equal(f.executions.length,0);assert.equal(member(f,t),undefined);
});
for(const how of ['retreat','death','replacement','stop','battleEnd'])test(`Source ${how} cancels both unborn attack and aura work`,()=>{
 const f=make(),t=enemy(f,{hp:1e6});until(f,()=>!!f.combat.phase);const before=f.executions.length;
 if(how==='retreat')f.b.retreat(f.u);if(how==='death')f.b.kill(f.u,null);if(how==='replacement'){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'new-life'};}
 if(how==='stop')f.combat.stop();if(how==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}fear(f,t);t.hp=100;advance(f.b,1);
 assert.equal(attacks(f).length,0);assert.equal(f.executions.length,before);assert.equal(f.combat.members.size,0);assert.equal(f.combat.handles.length,0);
 if(how==='replacement')assert.equal(f.u.mem.regularFormVisual.clip,'new-life');
});
test('An execution callback can replace a target without a later hit being donated to that target life',()=>{
 const f=make();frozen(f);const t=enemy(f,{hp:1000});fear(f,t);let seen=0;
 f.b.on('hit',h=>{if(h.dmg.tags.includes('makoto:s2-execution')){seen++;t.deploySeq++;}});advance(f.b,f.b.dt);
 assert.equal(seen,1);near(t.hp,1000);assert.equal(f.executions.length,0);
});
test('Recursive aura execution cannot repeat one claimed native attempt',()=>{
 const f=make();frozen(f);const t=enemy(f,{hp:1e6});until(f,()=>!!member(f,t));const e=member(f,t);fear(f,t);t.hp=100;
 f.b.on('hit',h=>{if(h.dmg.tags.includes('makoto:s2-execution'))f.combat.execute(e);});f.combat.execute(e);
 assert.equal(f.executions.length,1);assert.equal(f.combat.members.size,0);
});
test('Removing and rescanning an aura during its hit cannot create a second same-stack execution attempt',()=>{
 const f=make();frozen(f);const t=enemy(f,{hp:1e6});until(f,()=>!!member(f,t));fear(f,t);t.hp=100;
 f.b.addBuff(t,{key:'fixture:two-shields',shieldHits:2});let nested=false,attempts=0;
 f.b.on('hit',h=>{if(!h.dmg.tags.includes('makoto:s2-execution'))return;attempts++;
  if(!nested){nested=true;f.b.removeBuff(t,member(f,t).buff);f.combat.syncAura();}
 });f.combat.execute(member(f,t));assert.equal(attempts,1);assert.equal(t.findBuff('fixture:two-shields').shieldHits,1);
});
test('Native target-free selection does not acquire an invulnerable enemy for an S2 attack',()=>{
 const f=make(),t=enemy(f,{flags:{invulnerable:true}});assert.equal(f.combat.choices().length,0);advance(f.b,1);assert.equal(f.receipts.length,0);near(t.hp,t.s.maxHp);
});
test('The existing ordinary-stage shield/HP-floor pipeline is retained for the source fixed True execution amount',()=>{
 for(const protection of ['shield','floor','undeadable']){
  const f=make();frozen(f);const t=enemy(f,{hp:1000});fear(f,t);
  f.b.addBuff(t,{key:'fixture:protect',...(protection==='shield'?{shieldHits:2}:protection==='floor'?{mods:{damageHpFloorRatio:.5}}:{flags:{undeadable:true}})});
  advance(f.b,.05);assert.equal(t.alive,true);assert.equal(f.receipts.length,0);
 }
});
test('BeforeBuff rejection, replacement and metadata substitution do not install an inherited aura marker',()=>{
 for(const action of ['reject','source','recipient','key']){
  const f=make();frozen(f);const t=enemy(f,{hp:1e6});f.b.on('beforeBuff',h=>{if(!h.buff.key.startsWith('makoto:s2-aura:'))return;
   if(action==='reject')h.cancel=true;if(action==='source')f.u.deploySeq++;if(action==='recipient')t.deploySeq++;if(action==='key')h.buff.key='foreign:substitution';
  });advance(f.b,.05);assert.equal(f.combat.members.size,0);assert.equal(t.buffs.some(b=>b.key.startsWith('makoto:s2-aura:')),false);
 }
});
for(const how of ['veto','substitute','recursive','replacement','control'])test(`S2 ${how} at beforeAttack cannot fabricate a second receipt or foreign victim`,()=>{
 const f=make();Array.from({length:4},()=>enemy(f));const foreign=enemy(f,{col:9});f.b.on('beforeAttack',h=>{if(h.attacker!==f.u)return;
  if(how==='veto')h.targets=[];if(how==='substitute')h.targets=[foreign];if(how==='recursive')f.b.forceAttack(f.u,h.targets);
  if(how==='replacement')f.u.deploySeq++;if(how==='control')f.b.applyStatus(f.u,'stun',{duration:.2});
 });advance(f.b,1.1);assert.equal(f.receipts.length,how==='recursive'?1:0);assert.equal(attacks(f).length,how==='recursive'?4:0);near(foreign.hp,foreign.s.maxHp);
});
test('Stored palsy and silence do not invent an interruption; a real palsy trigger cancels the pre-delay',()=>{
 for(const triggered of [false,true]){
  const f=make();enemy(f);until(f,()=>!!f.combat.phase);f.b.applyStatus(f.u,'palsy',{duration:10,value:1});f.b.applyStatus(f.u,'silence',{duration:10});
  if(triggered)f.b.emit('palsyTriggered',{unit:f.u});advance(f.b,.85);assert.equal(f.receipts.length,triggered?0:1);
 }
});
test('The uncapped sampled pre-delay uses live slow once and ignores a later ASPD change',()=>{
 const f=make();enemy(f);until(f,()=>!!f.combat.phase);const p=f.combat.phase;
 f.b.addBuff(f.u,{key:'fixture:slow',mods:{slowDownMul:.5,aspd:500}});advance(f.b,1);assert.equal(f.receipts.length,0);
 until(f,()=>f.receipts.length===1);near(p.speed,1);assert.equal(attacks(f).length,1);
});
test('Expired logical Fear does not execute a low-HP target at a later poll',()=>{
 const f=make();frozen(f);const t=enemy(f,{hp:1000});until(f,()=>!!member(f,t));fear(f,t,{duration:.001});advance(f.b,.3);
 assert.equal(t.alive,true);assert.equal(f.executions.length,0);
});
test('Fixed execution damage ignores source outgoing multipliers but retains incoming True modifiers',()=>{
 const f=make();frozen(f);const t=enemy(f,{hp:1e6});t.hp=100000;f.b.addBuff(f.u,{key:'fixture:power',mods:{atkPct:100,dmgDealtMul:100}});
 f.b.addBuff(t,{key:'fixture:incoming',mods:{trueTakenMul:.001}});fear(f,t);advance(f.b,f.b.dt);
 assert.equal(t.alive,true);assert.equal(f.executions.length,1);near(f.executions[0].amount,9999.999);near(t.hp,100000-9999.999);
});
test('Two diagnostic sources keep independent aura markers and one source leaving does not erase the other',()=>{
 const f=make();frozen(f);const other=f.b._makeAlly(f.u.player,f.u.def,'op',5,4,{dir:'RIGHT'});
 const second=new MakotoSkillTwoCombat(f.b,other,{contract:CONTRACT,inPersona:()=>true});
 f.b._setupUnit(other,{trait:second.trait(),talents:[],skill:{kind:'instant',completeOnAttack:false,trigger:{rule:'NEVER'}}});second.install();
 f.b.addBuff(other,{key:'fixture:disarm',flags:{disarm:true}});f.u.player.dp=99;assert.ok(f.b._deploy(other,{initial:false}));active.add({b:f.b,combat:second});
 const t=enemy(f,{hp:1e6});until(f,()=>!!member(f,t)&&second.members.has(t));
 const first=member(f,t).buff,foreign=second.members.get(t).buff;assert.notEqual(first.key,foreign.key);
 f.allow=false;advance(f.b,.1);assert.equal(t.buffs.includes(first),false);assert.equal(t.buffs.includes(foreign),true);
 fear(f,t);t.hp=100;until(f,()=>!t.alive);assert.equal(f.executions[0].credit===other,true);near(f.u.stats.dmg,0);assert.ok(other.stats.dmg>0);
});
test('Recursive form queries cannot create a second pre-delay or old-source cooldown',()=>{
 let reenter=false,nested=null;
 const f=make({inPersona(f){if(reenter){reenter=false;nested=f.combat.begin();}return f.allow;}});enemy(f);
 reenter=true;assert.equal(f.combat.begin(),true);assert.equal(nested,false);until(f,()=>f.receipts.length===1);assert.equal(attacks(f).length,1);
});
test('Source replacement at final admission cannot give a new life the old S2 command',()=>{
 let checks=0;
 const f=make({inPersona(f){if(f.combat?.accepting&&++checks===2){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'new-life'};f.u.atkCd=7;}return f.allow;}});
 enemy(f);advance(f.b,1.1);assert.equal(f.receipts.length,0);assert.equal(attacks(f).length,0);assert.equal(f.u.mem.regularFormVisual.clip,'new-life');assert.equal(f.combat.members.size,0);
});
test('A fresh explicit S2 begin cannot skip the positive cooldown left by a real interruption',()=>{
 const f=make();enemy(f);until(f,()=>!!f.combat.phase);f.b.emit('palsyTriggered',{unit:f.u});assert.ok(f.u.atkCd>0);
 assert.equal(f.combat.begin(),false);assert.equal(f.combat.phase===null,true);
});
test('Fresh original S2 and an explicit form contract are required',()=>{
 const f=make({defer:true});assert.throws(()=>new MakotoSkillTwoCombat(f.b,f.u),/Fresh selected/);assert.throws(()=>f.combat.install(),/reinstalled/);
 const other=base({skill:1,defer:true});other.controller.stop();assert.throws(()=>new MakotoSkillTwoCombat(other.b,other.u,{contract:CONTRACT,inPersona:()=>true}),/Fresh selected/);
 f.deploy();assert.throws(()=>new MakotoSkillTwoCombat(f.b,f.u,{contract:CONTRACT,inPersona:()=>true}),/Fresh selected/);
});
