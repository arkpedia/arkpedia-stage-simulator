// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,enemy,advance,near,until} from './helpers/aegis-fixture.js';
import {prepareAegisS1,AEGIS_S1_CONTRACT,verifyAegisS1} from '../server/sim/content/arkpedia-aegis-s1.js';
import {aegisNativeInputs,aegisSourceComponent} from '../server/sim/content/arkpedia-aegis-source.js';
import {explicitBlockMode} from '../server/sim/block-mode.js';
import data from '../data/arkpedia-mvp.json' with{type:'json'};
import source from '../data/arkpedia-native-operators/char_4218_aigis.json' with{type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';import {normalizeChess} from '../server/sim/simdata.js';import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {selectedAegisBuild,AEGIS_ID as ID} from '../server/sim/content/arkpedia-aegis-source.js';
const fs=[],make=opts=>{const f=fixture({prepare:(b,u)=>prepareAegisS1(b,u,{contract:AEGIS_S1_CONTRACT}),...opts});fs.push(f);return f;};
test.afterEach(()=>{for(const f of fs.splice(0))assert.deepEqual(f.b.errors,[]);});
const hits=f=>f.hits.filter(h=>h.dmg.tags.includes('aegis:s1'));
const cast=f=>{f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('manual'),true);};
const active=f=>{cast(f);until(f,()=>f.flight.mode===2,3);};
test('Held S1 requires the exact fresh selected contract and rejects S2',()=>{
 verifyAegisS1();const f=fixture({defer:true});assert.throws(()=>prepareAegisS1(f.b,f.u),/exact controller/);
 assert.throws(()=>make({skill:2}),/selected S1/);const g=make();assert.throws(()=>prepareAegisS1(g.b,g.u,{contract:AEGIS_S1_CONTRACT}),/Fresh selected/);
});
for(const what of['SP','born','target','refund','beginClock','loopClock','returnClock','selector','motion','effect','trait'])test(`Changed ${what} rejects original Aegis S1 composition`,()=>{
 const n=structuredClone(aegisNativeInputs()),read=(...args)=>{const v=structuredClone(aegisSourceComponent(...args));
  if(args[2]==='3075325240047253509'){if(what==='selector')v._postFilter=4;if(what==='motion')v._targetMotion=2;}
  if(args[2]==='539941508882184197'&&what==='effect')v._buffs[0].attributes.abnormalFlags=[1];return v;};
 if(what==='SP')n.s1._allowSpRecoveryWhenAffecting=1;if(what==='born')n.s1._canCastDuringBorn=0;if(what==='target')n.s1._allowNoTarget=0;
 if(what==='refund')n.s1._recoverSpIfNoTarget=1;if(what==='beginClock')n.modes[1].attack._timeMode=0;
 if(what==='loopClock')n.modes[2].attack._affectedBySlowDown=0;if(what==='returnClock')n.modes[3].attack._animKey='Skill_1_End';
 if(what==='trait')n.templates.aigis_tr.eventToActions.ON_CALCULATE_DAMAGE[2]._defaultValue=2;
 assert.throws(()=>verifyAegisS1(n,read));
});
for(let rank=1;rank<=10;rank++)test(`Rank${rank} uses source manual/time SP, fixed landing, actual area attacks and separate self-stun/return`,()=>{
 const f=make({rank}),a=enemy(f),other=enemy(f,{col:7.5,motion:'FLY'}),baseAtk=f.u.s.atk,baseDef=f.u.s.def;
 assert.equal(f.u.skill.manual,true);assert.equal(f.u.skill.spType,'time');assert.equal(f.u.skill.active,false);assert.equal(f.u.skill.activate(),false);
 until(f,()=>f.u.skill.ready,50);assert.equal(hits(f).length,0);f.hits.length=0;f.receipts.length=0;f.b.rng=()=>0;
 assert.equal(f.u.skill.activate('manual'),true);assert.equal(f.flight.mode,1);
 assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1_Begin');near(f.u.s.atk,baseAtk*(1+f.record.bb.atk));near(f.u.s.def,baseDef*(1+f.record.bb.def));
 advance(f.b,.8);assert.equal(f.flight.mode,1);assert.equal(hits(f).length,0);until(f,()=>f.flight.mode===2,1);
 until(f,()=>hits(f).length>=2,4);assert.ok(f.receipts.length>=1);assert.equal(f.receipts[0].targets.length,1);assert.equal(f.receipts[0].targets[0].id,a.id);
 near(hits(f).find(h=>h.target===a).amount,baseAtk*(1+f.record.bb.atk)*f.u.s.physDealtMul);assert.ok(hits(f).some(h=>h.target===other));
 assert.equal(f.u.skill.gainSp(99),0);near(f.u.skill.sp,0);until(f,()=>f.flight.mode===3,25);assert.equal(f.u.skill.active,false);
 near(f.u.s.atk,baseAtk);near(f.u.s.def,baseDef);assert.equal(f.u.canAct,false);assert.equal(!!f.u.s.flags.noBlock,false);
 advance(f.b,1);assert.ok(f.u.skill.sp>.9);assert.equal(explicitBlockMode(f.u),'WALK');
 until(f,()=>f.flight.mode===0,15);assert.equal(explicitBlockMode(f.u),'FLY');near(f.flight.heightNow(),.4000000059604645);
 const before=hits(f).length;advance(f.b,3);assert.equal(hits(f).length,before); // ordinary remains air-only and direct
});
for(const build of[{elite:0,rank:4},{elite:1,rank:7},{elite:2,rank:10,potential:6,trust:200}])test(`E${build.elite} S1 preserves selected promotion/potential/trust and talent gates`,()=>{
 const f=make(build),atk=f.u.s.atk,scale=f.u.s.physDealtMul;enemy(f);active(f);until(f,()=>hits(f).length===1,4);
 near(hits(f)[0].amount,atk*(1+f.record.bb.atk)*scale);assert.equal(!!f.talent.parent,build.elite>0);
});
test('The original nonsilenceable S1 can cast under Silence and retain its active holder',()=>{
 const f=make();f.b.addBuff(f.u,{key:'fixture:silence',flags:{silence:true}});cast(f);advance(f.b,1.1);
 assert.equal(f.flight.mode,2);assert.equal(f.u.skill.silenceBlocked,false);assert.equal(f.u.skill.active,true);
});
test('A source-ready cast can interrupt Born without a target or a refund',()=>{
 const f=make();assert.ok(f.controller.bornUntil>f.b.time);cast(f);assert.equal(f.u.mem.regularBornUntil,f.b.time);assert.equal(f.u.skill.charges,0);
 advance(f.b,1.1);assert.equal(f.flight.mode,2);assert.equal(hits(f).length,0);f.u.skill.end('fixture');assert.equal(f.flight.mode,3);
 assert.equal(f.u.skill.charges,0);assert.equal(f.u.skill.sp,0);
});
test('Casting during an ordinary windup discards unborn ordinary output and preserves positive cooldown',()=>{
 const f=make(),a=enemy(f,{motion:'FLY'});until(f,()=>!!f.controller.phase,2);const old=f.u.atkCd;cast(f);
 near(f.u.atkCd,old);assert.equal(f.controller.phase.kind,'s1-begin');advance(f.b,.8);assert.equal(f.hits.length,0);
 until(f,()=>hits(f).length>0,4);assert.equal(f.hits.some(h=>h.dmg.tags.includes('aegis:ordinary')),false);assert.ok(a.hp<a.s.maxHp);
});
test('Manual S1 can start while disarmed, but no loop attacks occur until disarm ends',()=>{
 const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:disarm',flags:{disarm:true},duration:3});cast(f);advance(f.b,2);
 assert.equal(f.flight.mode,2);assert.equal(hits(f).length,0);advance(f.b,3);assert.ok(hits(f).length>0);
});
for(const state of['stun','freeze','sleep','hidden'])test(`${state} blocks a new manual cast without consuming source SP`,()=>{
 const f=make();f.u.skill.setSpTotal(f.u.skill.spCost);if(state==='hidden')f.u.hidden=true;else f.b.addBuff(f.u,{key:'fixture:control',flags:{[state]:true}});
 assert.equal(f.u.skill.activate(),false);assert.equal(f.u.skill.charges,1);assert.equal(f.flight.mode,0);
});
test('S1 random acquisition is one seeded draw per attack and does not impose an invented no-repeat cycle',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{row:6,col:7});active(f);f.controller.phase=null;f.u.atkCd=0;
 let draws=0;f.b.rng=()=>{draws++;return .999;};f.controller.tick();assert.equal(f.controller.phase.target.id,other.id);assert.equal(draws,1);
 advance(f.b,.2);assert.equal(draws,1);f.controller.phase=null;f.u.atkCd=0;f.controller.tick();assert.equal(f.controller.phase.target.id,other.id);assert.equal(draws,2);
 f.controller.phase=null;f.u.atkCd=0;f.b.rng=()=>0;f.controller.tick();assert.equal(f.controller.phase.target.id,a.id);
});
test('Own blocked ground input takes priority even outside the range grid, without a random draw',()=>{
 const f=make();enemy(f);active(f);const own=enemy(f,{col:4.3});assert.ok(f.b._checkBlock(own));f.controller.phase=null;f.u.atkCd=0;
 f.b.rng=()=>{throw Error('Blocked target must not need random acquisition');};f.controller.tick();assert.equal(f.controller.phase.target.id,own.id);
});
for(const flag of['stealth','untargetable','sleep','camou'])test(`Unblocked ${flag} input is not selected for a S1 windup`,()=>{
 const f=make();enemy(f,{flags:{[flag]:true}});active(f);advance(f.b,3);assert.equal(f.receipts.length,0);assert.equal(hits(f).length,0);
});
for(const dir of['RIGHT','LEFT','UP','DOWN'])test(`${dir} retains the original S1 attack track and exact release marker`,()=>{
 const f=make({dir});const pos={RIGHT:{row:5,col:7},LEFT:{row:5,col:3},UP:{row:7,col:5},DOWN:{row:3,col:5}}[dir];enemy(f,pos);active(f);
 until(f,()=>f.controller.phase?.kind==='s1-loop',1);const p=f.controller.phase;assert.equal(p.releaseAge,.5666666626930237);
 assert.equal(f.u.mem.regularFormVisual.clip,dir==='DOWN'?'Skill_Down_1_Loop':'Skill_1_Loop');advance(f.b,.5);assert.equal(f.payload.flights.size,0);
 until(f,()=>f.payload.flights.size===1,1);assert.equal(f.receipts.length,1);assert.equal(f.hits.length,0);advance(f.b,.3);assert.equal(hits(f).length,1);
});
test('Source maxAnimScale caps ASPD playback while live slowdown independently stretches the release',()=>{
 const f=make();enemy(f);active(f);f.controller.phase=null;f.u.atkCd=0;f.b.addBuff(f.u,{key:'fixture:clock',mods:{aspd:300,slowDownMul:.5}});f.controller.tick();
 const p=f.controller.phase;assert.equal(p.speed,1);near(p.visual.speed,.5);advance(f.b,.8);assert.equal(f.receipts.length,0);
 f.b.removeBuff(f.u,'fixture:clock');until(f,()=>f.receipts.length===1,1);assert.equal(p.accepted,true);assert.equal(p.visual.speed,1);
});
test('The initial landing height command retains the live Begin animation object and slowdown updates',()=>{
 const f=make();cast(f);const p=f.controller.phase;assert.equal(f.u.mem.regularFormVisual===p.visual,true);
 f.b.addBuff(f.u,{key:'fixture:slow',mods:{slowDownMul:.5}});advance(f.b,.2);assert.equal(f.u.mem.regularFormVisual===p.visual,true);
 near(p.visual.speed,.5);assert.ok(p.age<.2);f.controller.stop();assert.equal(f.u.mem.regularFormVisual,undefined);assert.equal(f.u.mem.regularVisualDirection,undefined);
});
test('Retiring the owned flight component makes the full controller stop instead of continuing attacks',()=>{
 const f=make();enemy(f,{motion:'FLY'});f.flight.stop();advance(f.b,3);assert.equal(f.controller.stopped,true);assert.equal(f.receipts.length,0);
 assert.equal(f.controller.handles.length,0);assert.equal(f.controller.accountHandles.length,0);
});
for(const change of['dead','replacement','hidden','untargetable'])test(`A ${change} captured input falls back to its point instead of retargeting the windup`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});f.b.rng=()=>0;active(f);until(f,()=>f.controller.phase?.kind==='s1-loop',1);
 const p=f.controller.phase;if(change==='dead')f.b.kill(a,null);if(change==='replacement'){a.deploySeq++;a.x=15;a.y=15;}
 if(change==='hidden')a.hidden=true;if(change==='untargetable')f.b.addBuff(a,{key:'fixture:lost',flags:{untargetable:true}});
 until(f,()=>hits(f).length===1,2);assert.equal(hits(f)[0].target.id,other.id);assert.equal(f.receipts[0].targets[0].id,a.id);assert.equal(p.accepted,true);
});
for(const what of['stun','disarm','hidden'])test(`Brief ${what} invalidates the unborn loop output without ending the holder or resetting cooldown`,()=>{
 const f=make();enemy(f);active(f);until(f,()=>f.controller.phase?.kind==='s1-loop',1);const old=f.u.atkCd;
 if(what==='hidden'){f.u.hidden=true;f.controller.tick();f.u.hidden=false;}else{const buff=f.b.addBuff(f.u,{key:'fixture:brief',flags:{[what]:true}});f.b.removeBuff(f.u,buff);}
 f.controller.tick();assert.equal(f.controller.phase,null);near(f.u.atkCd,old);assert.equal(f.u.skill.active,true);advance(f.b,.7);assert.equal(hits(f).length,0);
});
for(const phase of['begin','return'])test(`External control during ${phase} retries its source transition after action returns`,()=>{
 const f=make();cast(f);if(phase==='return'){advance(f.b,1.1);f.u.skill.end('fixture');f.b.removeBuff(f.u,f.flight.stun.buff);until(f,()=>f.controller.phase?.kind==='s1-return',1);}
 advance(f.b,.4);const p=f.controller.phase,buff=f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true},duration:.5});advance(f.b,.7);
 assert.ok(!f.u.buffs.includes(buff));assert.equal(f.controller.phase,p);assert.ok(p.age<.4);until(f,()=>f.flight.mode===(phase==='begin'?2:0),2);
});
test('Front stun mix is literal; Back missing stun/return clips retain its original facing and presentation',()=>{
 for(const dir of['RIGHT','UP']){const f=make({dir});active(f);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1_Idle');f.u.skill.end('fixture');
  assert.equal(f.u.mem.regularFormVisual.clip,dir==='UP'?'Skill_1_Idle':'nSkill_1_Stun_Begin');
  f.b.removeBuff(f.u,f.flight.stun.buff);until(f,()=>f.controller.phase?.kind==='s1-return',1);
  assert.equal(f.u.mem.regularFormVisual.clip,dir==='UP'?'Skill_1_Idle':'nSkill_1_Stun_End');assert.equal(f.controller.facing,dir);
  advance(f.b,.8);assert.equal(f.flight.mode,3);until(f,()=>f.flight.mode===0,1);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');
 }
});
test('Foreign control keeps return waiting after the owned self-stun is cleansed',()=>{
 const f=make();active(f);f.u.skill.end('fixture');const own=f.flight.stun.buff;f.b.applyStatus(f.u,'stun',{key:'foreign:stun',duration:2,source:f.u});
 f.b.removeBuff(f.u,own);advance(f.b,1);assert.equal(explicitBlockMode(f.u),'WALK');assert.equal(f.flight.mode,3);assert.equal(f.controller.phase.kind,'s1-stun');
 until(f,()=>f.flight.mode===0,4);
});
test('Dispel of no-SP does not bypass the timed account; dispel of the holder commits the spent charge and creates self-stun',()=>{
 const f=make();active(f);f.b.removeBuff(f.u,f.u.skill._buffKey);assert.equal(!!f.u.s.flags.noSp,false);assert.equal(f.u.skill.gainSp(99),0);
 f.b.removeBuff(f.u,f.flight.holder.buff);assert.equal(f.u.skill.active,false);assert.equal(f.flight.mode,3);assert.equal(f.u.skill.charges,0);advance(f.b,1);assert.ok(f.u.skill.sp>.9);
});
for(const refusal of['immune','veto'])test(`Holder dispel ends the account even when the independent self-stun is ${refusal}`,()=>{
 const f=make();enemy(f);active(f);if(refusal==='immune')f.u.def.immune.add('stun');
 else f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('aigis_s1_stun_ctrl:'))c.cancel=true;});
 f.b.removeBuff(f.u,f.flight.holder.buff);assert.equal(f.u.skill.active,false);assert.equal(f.flight.stun,null);assert.equal(!!f.u.s.flags.noSp,false);
 const receipts=f.receipts.length;advance(f.b,2);assert.equal(f.receipts.length,receipts);assert.ok(f.u.skill.sp>1.9);assert.equal(f.flight.mode,2);
});
for(const key of['holder','landing[end]','stun_ctrl','takeoff[begin]','takeoff[end]'])test(`Refused ${key} cannot synthesize a later S1 account/command/attack`,()=>{
 const f=make();let grants=0;f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('aigis_s1_'+key+':')){grants++;c.cancel=true;}});
 cast(f);if(key==='holder'){assert.equal(f.u.skill.active,false);assert.equal(f.flight.mode,0);assert.equal(f.u.skill.charges,0);return;}
 advance(f.b,1.1);if(key==='landing[end]'){assert.equal(f.flight.mode,1);assert.equal(grants,1);advance(f.b,1);assert.equal(grants,1);return;}
 f.u.skill.end('fixture');if(key==='stun_ctrl'){assert.equal(f.flight.mode,2);advance(f.b,2);assert.equal(f.receipts.length,0);return;}
 f.b.removeBuff(f.u,f.flight.stun.buff);advance(f.b,3);assert.equal(f.flight.mode,3);assert.equal(grants,1);
});
test('Vetoed and substituted shared attack inputs cannot launch the captured skill payload',()=>{
 for(const substitute of[false,true]){const f=make(),a=enemy(f),other=enemy(f,{col:9});f.b.rng=()=>0;active(f);
  f.b.on('beforeAttack',c=>{if(c.attacker!==f.u)return;if(substitute)c.targets=[other];else c.cancel=true;});advance(f.b,2);
  assert.equal(hits(f).length,0);assert.equal(f.payload.flights.size,0);near(a.hp,a.s.maxHp);
 }
});
test('Recursive forceAttack during a captured release cannot double the source output',()=>{
 const f=make(),a=enemy(f);active(f);f.b.on('beforeAttack',c=>{if(c.attacker===f.u)f.b.forceAttack(f.u,[a]);});advance(f.b,2);
 assert.equal(f.receipts.length,1);assert.equal(hits(f).length,1);
});
test('A born S1 payload stays live after account end and reads the now-unbuffed current ATK at impact',()=>{
 const f=make(),a=enemy(f),atk=f.u.s.atk,scale=f.u.s.physDealtMul;active(f);until(f,()=>f.payload.flights.size===1,3);
 f.u.skill.end('fixture');assert.equal(f.flight.mode,3);advance(f.b,.3);assert.equal(hits(f).length,1);near(hits(f)[0].amount,atk*scale);assert.ok(a.hp<a.s.maxHp);
});
test('An emitted payload survives controller retirement on its original source ledger',()=>{
 const f=make();enemy(f);active(f);until(f,()=>f.payload.flights.size===1,3);const ledger=f.u.stats;
 f.b.retreat(f.u);advance(f.b,.3);assert.equal(hits(f).length,1);assert.equal(hits(f)[0].source.stats,ledger);assert.equal(f.payload.watchers.length,0);
});
test('Retirement inside skillStart cannot leave a late Begin, holder, or self-stun',()=>{
 const f=make();f.b.on('skillStart',c=>{if(c.unit===f.u)f.b.retreat(f.u);});cast(f);advance(f.b,32);
 assert.equal(f.controller.stopped,true);assert.equal(f.flight.grants.size,0);assert.equal(f.payload.flights.size,0);assert.equal(f.u.skill.active,false);
});
test('Ending the account from beforeAttack invalidates that unborn skill output',()=>{
 const f=make();enemy(f);active(f);f.b.on('beforeAttack',c=>{if(c.attacker===f.u)f.u.skill.end('fixture');});advance(f.b,2);
 assert.equal(hits(f).length,0);assert.equal(f.receipts.length,0);assert.equal(f.flight.mode,3);
});
test('A source life change from beforeAttack cannot emit an old controller payload',()=>{
 const f=make();enemy(f);active(f);f.b.on('beforeAttack',c=>{if(c.attacker===f.u)f.u.deploySeq++;});advance(f.b,2);
 assert.equal(hits(f).length,0);assert.equal(f.payload.flights.size,0);assert.equal(f.controller.stopped,true);
});
test('Full charge or free direct activation cannot reenter a running S1 account or its return',()=>{
 const f=make();active(f);assert.equal(f.u.skill.activate('fixture',{free:true}),false);assert.equal(f.u.skill.activations,1);
 f.u.skill.end('fixture');f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('fixture',{free:true}),false);assert.equal(f.u.skill.activations,1);
});
test('An enemy blocked by another ally loses ordinary camouflage exclusion without gaining own-block priority',()=>{
 const f=make(),a=enemy(f,{flags:{camou:true}});active(f);assert.deepEqual(f.controller.skillChoices(),[]);
 a.blockedBy={id:999};assert.equal(f.controller.skillChoices()[0].id,a.id);a.blockedBy=null;
});
test('A new life at the reached area can receive splash without being adopted as the retained primary',()=>{
 const f=make(),a=enemy(f);active(f);until(f,()=>f.controller.phase?.kind==='s1-loop',1);a.deploySeq++;
 until(f,()=>hits(f).length===1,2);assert.equal(hits(f)[0].dmg.isSplash,true);assert.equal(f.controller.record.index,0);
});
for(const why of['stop','retreat','death','replacement','battleEnd'])test(`${why} drains account, holder, self-stun and controller hooks without late output`,()=>{
 const f=make();enemy(f);active(f);f.u.skill.end('fixture');
 if(why==='stop')f.controller.stop();if(why==='retreat')f.b.retreat(f.u);if(why==='death')f.b.kill(f.u,null);
 if(why==='replacement'){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'replacement'};advance(f.b,.1);}
 if(why==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}advance(f.b,20);
 assert.equal(f.controller.stopped,true);assert.equal(f.flight.grants.size,0);assert.equal(f.controller.handles.length,0);assert.equal(f.controller.accountHandles.length,0);
 assert.equal(f.talent.handles.length,0);assert.equal(f.flight.handles.length,0);assert.equal(f.u.buffs.some(x=>x.data?.aegisS1State),false);
 if(why==='replacement')assert.equal(f.u.mem.regularFormVisual.playId,'replacement');
});
test('Held S1 clears unchanged original 0-1 with natural DP and actual Aegis damage',()=>{
 const M='char_208_melan',G='char_122_beagle',b=new StandardBattle(data,{operators:[defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});
 b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles),geometry=JSON.stringify(data.stage.geometry),
  build={elite:2,level:80,potential:1,trust:0,skillId:'skchr_aigis_1',skillRank:10,module:'none'},r=selectedAegisBuild(build),c=source.tables.character;
 let u,m,g,casts=0,cost=0;
 for(let n=0;n<9001&&!b.finished;n++){
  if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');
  if(m&&!u&&b.dp>=r.stats.cost){const def=normalizeChess({chessId:ID,charId:ID,name:c.appellation,profession:c.profession,position:c.position,subProfessionId:c.subProfessionId,
    stats:r.stats,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,skill:{...r.source,...r.source.spData,skillId:build.skillId,rangeGrid:r.skillRangeGrid},arkpedia:build});
   assert.equal(b.grid.tile(1,4).build,'RANGED');u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',1,4,{dir:'UP'});
   const prepared=prepareAegisS1(b,u,{contract:AEGIS_S1_CONTRACT});b._setupUnit(u,prepared.kit);prepared.controller.install();
   const before=b.dp;b.addDp('arkpedia',-r.stats.cost);assert.ok(b._deploy(u,{initial:false,costAttribute:r.stats.cost}));cost=before-b.dp;
  }
  if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');
  if(u?.skill.ready&&u.skill.activate('manual'))casts++;b.step();
 }
 const result=b.result(),leaks=result.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;
 console.log(JSON.stringify({scope:'held direct-controller original-wave diagnostic',skill:1,reason:result.reason,kills:result.killed,leaks,life:b.life,cost,casts,activations:u?.skill.activations,damage:u?.stats.dmg}));
 assert.ok(u&&m&&g&&u.stats.dmg>0&&casts>0);near(cost,22);assert.equal(result.reason,'cleared');assert.equal(result.killed,11);assert.equal(leaks,0);
 assert.equal(b.life,data.stage.battle.max_life);assert.deepEqual(b.grid.tiles,tiles);assert.equal(JSON.stringify(data.stage.geometry),geometry);assert.deepEqual(b.errors,[]);
});
