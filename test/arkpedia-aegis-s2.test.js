// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,enemy,advance,near,until} from './helpers/aegis-fixture.js';
import {prepareAegisS2,AEGIS_S2_CONTRACT,verifyAegisS2} from '../server/sim/content/arkpedia-aegis-s2.js';
import {aegisNativeInputs,aegisSourceComponent} from '../server/sim/content/arkpedia-aegis-source.js';
import {explicitBlockMode} from '../server/sim/block-mode.js';
import data from '../data/arkpedia-mvp.json' with{type:'json'};
import source from '../data/arkpedia-native-operators/char_4218_aigis.json' with{type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';import {normalizeChess} from '../server/sim/simdata.js';import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {selectedAegisBuild,AEGIS_ID as ID} from '../server/sim/content/arkpedia-aegis-source.js';
const fs=[],make=opts=>{const f=fixture({skill:2,prepare:(b,u)=>prepareAegisS2(b,u,{contract:AEGIS_S2_CONTRACT}),...opts});fs.push(f);return f;};
test.afterEach(()=>{for(const f of fs.splice(0))assert.deepEqual(f.b.errors,[]);});
const hits=f=>f.hits.filter(h=>h.dmg.tags.includes('aegis:s2')),
 cast=f=>{f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('manual'),true);},
 phase=(f,kind)=>until(f,()=>f.controller.phase?.kind===`s2-${kind}`,5);
test('Held S2 requires exact fresh selected contract and rejects S1',()=>{
 verifyAegisS2();const f=fixture({skill:2,defer:true});assert.throws(()=>prepareAegisS2(f.b,f.u),/exact controller/);
 assert.throws(()=>make({skill:1}),/selected S2/);const g=make();assert.throws(()=>prepareAegisS2(g.b,g.u,{contract:AEGIS_S2_CONTRACT}),/Fresh selected/);
});
for(const what of['SP','target','manual','refund','cooldown','born','interrupt','sequence','skip','inputs','loop','selector','motion','camou','trigger','missiles','kick','end','slowdown','palsy'])test(`Changed ${what} rejects original S2 composition`,()=>{
 const n=structuredClone(aegisNativeInputs()),read=(...args)=>{const v=structuredClone(aegisSourceComponent(...args));
  if(args[2]==='-618453496724616670'){if(what==='sequence')v._abilities.reverse();if(what==='skip')v._alwaysNext=1;if(what==='inputs')v._castToInputPosIfTargetInvalid=0;if(what==='loop')v._enableLoop=1;}
  if(args[2]==='-7523144579431822814'){if(what==='selector')v._postFilter=14;if(what==='motion')v._targetMotion=2;if(what==='camou')v._forceIgnoreCamouflage=1;}
  if(args[2]==='-4917732959508002270'&&what==='trigger')v._minTargetNum=0;return v;};
 if(what==='SP')n.s2._allowSpRecoveryWhenAffecting=1;if(what==='target')n.s2._allowNoTarget=1;if(what==='manual')n.s2._useTriggerInManualMode=0;
 if(what==='refund')n.s2._recoverSpIfNoTarget=0;if(what==='cooldown')n.s2._resetAbilityCooldownWhenCastEnd=0;if(what==='born')n.s2._canCastDuringBorn=0;
 if(what==='interrupt')n.s2._stopAffectOnInterrupt=1;if(what==='missiles')n.s2Missiles._selectTargetSource=1;if(what==='kick')n.s2Kick._waitForProjectileInvalid=0;
 if(what==='end')n.s2End._waitForAttackEvent=1;if(what==='slowdown')n.s2Missiles._affectedBySlowDown=0;if(what==='palsy')n.s2Kick._ignorePalsyInterrupt=1;
 assert.throws(()=>verifyAegisS2(n,read),/Changed original/);
});
for(let rank=1;rank<=10;rank++)test(`Rank${rank} casts all six missiles, separate delayed kick and End with source coefficients`,()=>{
 const f=make({rank}),a=enemy(f);assert.equal(f.u.skill.spType,'time');assert.equal(f.u.skill.manual,true);cast(f);
 assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Begin');assert.equal(explicitBlockMode(f.u),'WALK');assert.equal('mode' in f.flight,false);
 advance(f.b,.65);assert.equal(f.receipts.length,0);assert.equal(hits(f).length,0);assert.equal(f.u.skill.gainSp(100),0);
 phase(f,'kick');assert.equal(f.receipts.length,2);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Loop');assert.equal(f.u.skill.active,true);
 assert.equal(f.controller.model().exactDurations.Skill_2_Loop,0);assert.equal(f.controller.model().eventPayloads.Skill_2_Loop?.length??0,0);
 const ticket=f.controller.phase.ticket;assert.ok(f.payload.active(ticket));assert.equal(explicitBlockMode(f.u),'WALK');advance(f.b,.05);assert.equal(f.controller.phase.kind,'s2-kick');
 phase(f,'end');assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');assert.equal(explicitBlockMode(f.u),'FLY');assert.ok(f.flight.walkParent);
 assert.equal(hits(f).length,7);const missile=hits(f).filter(h=>h.dmg.tags.includes('aegis:s2:missile')),kick=hits(f).find(h=>h.dmg.tags.includes('aegis:s2:kick'));
 assert.equal(missile.length,6);assert.equal(new Set(missile.map(h=>h.dmg.attackId)).size,1);assert.notEqual(kick.dmg.attackId,missile[0].dmg.attackId);
 near(missile[0].amount,f.u.s.atk*f.record.bb.atk_scale*f.u.s.physDealtMul);near(kick.amount,f.u.s.atk*f.record.bb.kick_atk_scale*f.u.s.physDealtMul);
 advance(f.b,.8);assert.equal(f.u.skill.active,true);until(f,()=>!f.u.skill.active,1);assert.equal(f.flight.skillPhase,null);assert.equal(f.flight.walkParent,null);assert.equal(f.controller.phase,null);
 near(f.flight.heightNow(),.4000000059604645);near(f.u.atkCd,0);near(f.u.skill.sp,0);assert.equal(f.u.skill.charges,0);advance(f.b,1);assert.ok(f.u.skill.sp>.9);assert.equal(hits(f).length,7);assert.ok(a.alive);
});
for(const dir of['RIGHT','LEFT','UP','DOWN'])test(`${dir} uses original six OnAttack markers without mistaking the later audio marker for missile7`,()=>{
 const f=make({dir}),a=enemy(f,{row:dir==='UP'?7:dir==='DOWN'?3:5,col:['UP','DOWN'].includes(dir)?5:dir==='LEFT'?3:7}),times=[];
 const launch=f.payload.launch.bind(f.payload);f.payload.launch=c=>{times.push({time:f.b.time,kind:c.kind,index:c.index,facing:c.facing});return launch(c);};cast(f);until(f,()=>!f.u.skill.active,5);
 const ms=times.filter(x=>x.kind==='missile');assert.equal(ms.length,6);assert.deepEqual(ms.map(x=>x.index),[1,2,3,4,5,6]);assert.equal(times.filter(x=>x.kind==='kick').length,1);
 for(let i=0;i<6;i++){assert.equal(ms[i].facing,dir);near(ms[i].time,[.6666666865,.8000000119,.9333333373,1.0666667223,1.2000000477,1.3333333731][i],f.b.dt+1e-6);}assert.ok(a.alive);
});
test('S2 remains locked at E0 instead of inventing a source build',()=>assert.throws(()=>make({elite:0,rank:4}),/Locked selected CN source skill/));
for(const build of[{elite:1,rank:7},{elite:2,rank:10,potential:6,trust:200}])test(`S2 E${build.elite} retains selected stats and physical talent`,()=>{
 const f=make(build);enemy(f);cast(f);until(f,()=>hits(f).length===7,5);near(hits(f)[0].amount,f.u.s.atk*f.record.bb.atk_scale*f.u.s.physDealtMul);assert.equal(!!f.talent.parent,build.elite>0);
});
test('S2 needs a legal input: an empty ready cast consumes nothing and does not end Born',()=>{
 const f=make();f.u.skill.setSpTotal(f.u.skill.spCost);const until=f.controller.bornUntil;
 assert.equal(f.u.skill.activate(),false);assert.equal(f.u.skill.charges,1);assert.equal(f.controller.bornUntil,until);assert.equal(f.flight.skillPhase,null);
});
for(const flag of['stealth','untargetable','sleep','camou'])test(`S2 cannot initially select unblocked ${flag}`,()=>{
 const f=make();enemy(f,{flags:{[flag]:true}});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate(),false);assert.equal(f.u.skill.charges,1);
});
test('Selection takes normal priority across ground/air and includes its own blocked enemy outside range',()=>{
 const f=make(),a=enemy(f,{col:7,motion:'FLY'});enemy(f,{col:8});cast(f);assert.equal(f.controller.phase.target.id,a.id);f.controller.finishAccount();
 const own=enemy(f,{col:4.3,motion:'FLY'});assert.ok(f.b._checkBlock(own));cast(f);assert.equal(f.controller.phase.target.id,own.id);
});
test('Loss of all input during activation modifiers refunds exactly one charge without creating the flight parent',()=>{
 const f=make(),a=enemy(f);f.b.on('beforeBuff',c=>{if(c.unit===f.u&&c.buff.key===f.u.skill._buffKey)f.b.kill(a,null);});cast(f);
 assert.equal(f.u.skill.active,false);assert.equal(f.u.skill.charges,1);assert.equal(f.flight.skillPhase,null);assert.equal(f.receipts.length,0);near(f.u.atkCd,0);
});
test('Loss after capture retains the input point and spent charge instead of refunding or acquiring a new life',()=>{
 const f=make(),a=enemy(f),nearby=enemy(f,{col:7.5});f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('aigis_s2_block_walk:'))f.b.kill(a,null);});cast(f);
 assert.equal(f.controller.phase.target.id,a.id);assert.equal(f.u.skill.charges,0);until(f,()=>!f.u.skill.active,5);assert.equal(hits(f).length,7);assert.ok(hits(f).every(h=>h.target===nearby));
});
for(const state of['stun','freeze','sleep','levitate','hidden'])test(`${state} blocks new S2 and interrupts unborn sequence, including brief controls`,()=>{
 const f=make();enemy(f);f.u.skill.setSpTotal(f.u.skill.spCost);let buff;
 if(state==='hidden')f.u.hidden=true;else buff=f.b.addBuff(f.u,{key:'fixture:control',flags:{[state]:true}});
 assert.equal(f.u.skill.activate(),false);assert.equal(f.u.skill.charges,1);if(buff)f.b.removeBuff(f.u,buff);else f.u.hidden=false;
 cast(f);advance(f.b,.2);if(state==='hidden'){f.u.hidden=true;f.controller.tick();f.u.hidden=false;}else{buff=f.b.addBuff(f.u,{key:'fixture:brief',flags:{[state]:true}});f.b.removeBuff(f.u,buff);f.controller.tick();}
 assert.equal(f.u.skill.active,false);assert.equal(f.controller.phase,null);assert.equal(explicitBlockMode(f.u),'FLY');near(f.flight.heightNow(),.4000000059604645);advance(f.b,4);assert.equal(hits(f).length,0);assert.equal(f.u.skill.charges,0);
});
test('Silence and ordinary-only disarm permit S2 while short disarm still advances only the ordinary epoch',()=>{
 const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:silence',flags:{silence:true}});f.b.addBuff(f.u,{key:'fixture:disarm',flags:{disarm:true}});
 cast(f);advance(f.b,.3);const epoch=f.u.actionControlEpoch;f.b.addBuff(f.u,{key:'fixture:brief',flags:{disarm:true},duration:.001});advance(f.b,.1);
 assert.equal(f.u.actionControlEpoch,epoch);assert.ok(f.u.attackControlEpoch>epoch);until(f,()=>!f.u.skill.active,5);assert.equal(hits(f).length,7);
});
test('Rejected or kept-away action control cannot interrupt S2',()=>{
 const f=make();enemy(f);cast(f);f.b.on('beforeBuff',c=>{if(c.buff.key==='fixture:reject')c.cancel=true;});const epoch=f.u.actionControlEpoch;
 assert.equal(f.b.addBuff(f.u,{key:'fixture:reject',flags:{stun:true}}),null);f.b.addBuff(f.u,{key:'fixture:keep',refresh:'keep'});f.b.addBuff(f.u,{key:'fixture:keep',flags:{stun:true},refresh:'keep'});
 assert.equal(f.u.actionControlEpoch,epoch);until(f,()=>!f.u.skill.active,5);assert.equal(hits(f).length,7);
});
test('Original instant Begin and End ignore ASPD but follow live slowdown independently of born projectiles',()=>{
 const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:slow',mods:{aspd:300,slowDownMul:.5}});cast(f);const p=f.controller.phase;
 advance(f.b,1);assert.equal(f.receipts.length,0);near(p.visual.speed,.5);f.b.removeBuff(f.u,'fixture:slow');until(f,()=>f.receipts.length===1,1);
 phase(f,'end');const end=f.controller.phase;f.b.addBuff(f.u,{key:'fixture:end-slow',mods:{slowDownMul:.5}});advance(f.b,1.5);assert.equal(f.u.skill.active,true);near(end.visual.speed,.5);
 until(f,()=>!f.u.skill.active,1);assert.equal(hits(f).length,7);
});
for(const kind of['missiles','kick','end'])test(`External interruption during ${kind} ends account, resets cooldown and preserves foreign state`,()=>{
 const f=make();enemy(f);cast(f);phase(f,kind);const foreign=f.b.addBuff(f.u,{key:'fixture:foreign',mods:{atkPct:.1}});f.u.atkCd=8;f.u.skill.end('fixture');
 assert.equal(f.u.skill.active,false);assert.equal(f.flight.skillPhase,null);near(f.u.atkCd,0);assert.ok(f.u.buffs.includes(foreign));assert.equal(explicitBlockMode(f.u),'FLY');assert.equal(f.u.skill.charges,0);
});
for(const key of['block_walk','block_fly'])test(`Refused ${key} cannot fabricate normal source completion`,()=>{
 const f=make();enemy(f);f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith(`aigis_s2_${key}:`))c.cancel=true;});cast(f);until(f,()=>!f.u.skill.active,5);
 assert.equal(f.flight.skillPhase,null);assert.equal(f.controller.phase,null);assert.equal(explicitBlockMode(f.u),'FLY');assert.equal(hits(f).length,key==='block_walk'?0:7);
});
test('Dispel of the ability-owned WALK parent interrupts without refund; no-SP dispel alone cannot bypass the account',()=>{
 const f=make();enemy(f);cast(f);f.b.removeBuff(f.u,f.u.skill._buffKey);assert.equal(f.u.skill.gainSp(99),0);f.b.removeBuff(f.u,f.flight.walkParent.buff);
 assert.equal(f.u.skill.active,false);assert.equal(f.controller.phase,null);assert.equal(f.u.skill.charges,0);assert.equal(explicitBlockMode(f.u),'FLY');
});
for(const kind of['veto','substitute','clear','control','recursive'])test(`First missile ${kind} callback cannot duplicate or substitute captured output`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:10});f.b.on('beforeAttack',c=>{if(c.attacker!==f.u)return;
  if(kind==='veto')c.cancel=true;if(kind==='substitute')c.targets=[other];if(kind==='clear')c.targets=[];
  if(kind==='control'){const x=f.b.addBuff(f.u,{key:'fixture:brief',flags:{stun:true}});f.b.removeBuff(f.u,x);}
  if(kind==='recursive')f.b.forceAttack(f.u,[a]);});cast(f);until(f,()=>!f.u.skill.active,5);
 assert.equal(hits(f).length,kind==='recursive'?7:0);assert.equal(f.receipts.length,kind==='recursive'?2:0);
});
test('Vetoed kick does not undo six accepted missiles or continue into End',()=>{
 const f=make();enemy(f);f.b.on('beforeAttack',c=>{if(f.controller.phase?.kind==='s2-kick')c.cancel=true;});cast(f);until(f,()=>!f.u.skill.active,5);
 assert.equal(hits(f).length,6);assert.equal(f.receipts.length,1);assert.equal(f.flight.skillPhase,null);
});
test('An intercepted kick still invalidates its ticket and advances into End without fake kick damage',()=>{
 const f=make();enemy(f);cast(f);phase(f,'kick');f.b.projectiles.registerInterceptor({owner:f.u,intercept:({projectile:p})=>p.data?.kind==='kick'});
 phase(f,'end');assert.equal(hits(f).length,6);until(f,()=>!f.u.skill.active,2);assert.equal(f.payload.watchers.length,0);
});
test('Born missiles survive control and no further marker, kick or refund occurs',()=>{
 const f=make();enemy(f,{col:8});cast(f);until(f,()=>f.receipts.length===1,2);f.b.addBuff(f.u,{key:'fixture:stun',flags:{stun:true},duration:2});advance(f.b,3);
 assert.equal(hits(f).length,1);assert.equal(f.receipts.length,1);assert.equal(f.u.skill.active,false);assert.equal(f.payload.flights.size,0);
});
test('Owner departure preserves born payload and old ledger, drains controller resources and cannot affect a replacement life',()=>{
 const f=make();enemy(f,{col:8});cast(f);until(f,()=>f.receipts.length===1,2);f.b.kill(f.u,null);advance(f.b,2);
 assert.equal(hits(f).length,1);assert.equal(f.controller.stopped,true);assert.equal(f.controller.handles.length,0);assert.equal(f.controller.accountHandles.length,0);assert.equal(f.payload.watchers.length,0);assert.equal(f.u.mem.regularFormVisual,undefined);
});
test('Only an actual palsy-trigger bridge interrupts; granting/decaying a stack does not fabricate native PALSYING',()=>{
 const f=make();enemy(f);cast(f);f.b.addBuff(f.u,{key:'palsy',stacks:1,duration:.05});advance(f.b,.1);assert.equal(f.u.skill.active,true);
 f.b.emit('palsyTriggered',{unit:f.u,source:null});assert.equal(f.u.skill.active,false);advance(f.b,4);assert.equal(hits(f).length,0);
});
test('Ordinary aerial attacks resume after End; a cast during their windup discards unborn ordinary damage',()=>{
 const f=make();enemy(f,{motion:'FLY'});until(f,()=>!!f.controller.phase,2);cast(f);until(f,()=>!f.u.skill.active,5);
 assert.equal(f.hits.some(h=>h.dmg.tags.includes('aegis:ordinary')),false);until(f,()=>f.hits.some(h=>h.dmg.tags.includes('aegis:ordinary')),3);
});

for(const state of['dead','replacement','hidden','untargetable'])test(`A ${state} retained input uses the captured point at later births, never the replacement position`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.5});cast(f);
 if(state==='dead')f.b.kill(a,null);if(state==='replacement')a.deploySeq++;if(state==='hidden')a.hidden=true;
 if(state==='untargetable')f.b.addBuff(a,{key:'fixture:invalid',flags:{untargetable:true}});a.x=15;a.y=15;f.b._buildEnemyIndex();
 until(f,()=>!f.u.skill.active,5);assert.equal(hits(f).length,7);assert.ok(hits(f).every(h=>h.target===other));assert.ok(f.receipts.every(r=>r.targets[0]===a));
});
for(const mutation of['end','stop','brief-stun','replacement'])test(`A nested ${mutation} during parent admission cannot issue a stale WALK command`,()=>{
 const f=make();enemy(f);const modes=[];f.b.on('blockModeChanged',c=>{if(c.unit===f.u)modes.push(c.mode);});
 f.b.on('beforeBuff',c=>{if(!c.buff.key.startsWith('aigis_s2_block_walk:'))return;
  if(mutation==='end')f.u.skill.end('nested');if(mutation==='stop')f.controller.stop();
  if(mutation==='brief-stun'){const x=f.b.addBuff(f.u,{key:'fixture:brief',flags:{stun:true}});f.b.removeBuff(f.u,x);}
  if(mutation==='replacement'){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'replacement'};}
 });cast(f);advance(f.b,4);assert.equal(modes.includes('WALK'),false);assert.equal(hits(f).length,0);assert.equal(f.flight.walkParent,null);
 if(mutation==='replacement')assert.equal(f.u.mem.regularFormVisual.playId,'replacement');
});
for(const why of['stop','retreat','replacement','battleEnd'])test(`${why} drains S2-owned resources and preserves newer foreign visuals`,()=>{
 const f=make();enemy(f);cast(f);const foreign={clip:'Idle',playId:'foreign'};f.u.mem.regularFormVisual=foreign;
 if(why==='stop')f.controller.stop();if(why==='retreat')f.b.retreat(f.u);if(why==='replacement'){f.u.deploySeq++;f.b.emit('deploy',{unit:f.u});}
 if(why==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}advance(f.b,4);
 assert.equal(f.controller.stopped,true);assert.equal(f.controller.handles.length,0);assert.equal(f.controller.accountHandles.length,0);assert.equal(f.flight.grants.size,0);assert.equal(f.flight.handles.length,0);
 assert.equal(f.talent.handles.length,0);assert.equal(hits(f).length,0);assert.equal(f.u.mem.regularFormVisual===foreign,true);
});

test('Held S2 clears unchanged original 0-1 with natural DP and actual Aegis damage',()=>{
 const M='char_208_melan',G='char_122_beagle',b=new StandardBattle(data,{operators:[defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});
 b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles),geometry=JSON.stringify(data.stage.geometry),
  build={elite:2,level:80,potential:1,trust:0,skillId:'skchr_aigis_2',skillRank:10,module:'none'},r=selectedAegisBuild(build),c=source.tables.character;
 let u,m,g,casts=0,cost=0;
 for(let n=0;n<9001&&!b.finished;n++){
  if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');
  if(m&&!u&&b.dp>=r.stats.cost){const def=normalizeChess({chessId:ID,charId:ID,name:c.appellation,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,
    stats:r.stats,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:r.skillRangeGrid},arkpedia:build});
   assert.equal(b.grid.tile(1,4).build,'RANGED');u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',1,4,{dir:'UP'});
   const prepared=prepareAegisS2(b,u,{contract:AEGIS_S2_CONTRACT});b._setupUnit(u,prepared.kit);prepared.controller.install();
   const before=b.dp;b.addDp('arkpedia',-r.stats.cost);assert.ok(b._deploy(u,{initial:false,costAttribute:r.stats.cost}));cost=before-b.dp;
  }
  if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');
  if(u?.skill.ready&&u.skill.activate('manual'))casts++;b.step();
 }
 const result=b.result(),leaks=result.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;
 console.log(JSON.stringify({scope:'held direct-controller original-wave diagnostic',skill:2,reason:result.reason,kills:result.killed,leaks,life:b.life,cost,casts,activations:u?.skill.activations,damage:u?.stats.dmg}));
 assert.ok(u&&m&&g&&u.stats.dmg>0&&casts>0);near(cost,22);assert.equal(result.reason,'cleared');assert.equal(result.killed,11);assert.equal(leaks,0);
 assert.equal(b.life,data.stage.battle.max_life);assert.deepEqual(b.grid.tiles,tiles);assert.equal(JSON.stringify(data.stage.geometry),geometry);assert.deepEqual(b.errors,[]);
});

for(const first of[true,false])test(`Retired payload at ${first?'first':'later'} missile birth aborts instead of silently advancing a failed subability`,()=>{
 const f=make();enemy(f);cast(f);if(!first)until(f,()=>f.receipts.length===1,2);f.payload.retire();advance(f.b,4);
 assert.equal(f.u.skill.active,false);assert.equal(f.flight.skillPhase,null);assert.equal(hits(f).length,first?0:1);assert.equal(f.receipts.length,first?0:1);
});
