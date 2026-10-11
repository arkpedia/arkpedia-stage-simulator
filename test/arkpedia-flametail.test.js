// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-flametail-prefabs.json' with { type: 'json' };
import { FLAMETAIL_OPERATORS } from '../shared/arkpedia/flametail-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const ID='char_420_flamtl', MEL='char_208_melan', KAZ='char_237_gravel', DUSK='char_2015_dusk';
const near=(a,z,e=1e-6)=>assert.ok(Math.abs(a-z)<e,`${a} != ${z}`);
const advance=(b,t)=>{for(let i=0;i<Math.ceil(t/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);};
const bb=(skill,rank=10)=>Object.fromEntries(evidence.tables.skills[`skchr_flamtl_${skill+1}`][rank-1].blackboard.map(x=>[x.key,x.value]));
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
 const src=structuredClone(data),op=src.operators[ID];assert.ok(op,'Reviewed source Flametail snapshot required');
 src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 src.stage.geometry.rows=13;src.stage.geometry.cols=13;src.stage.geometry.tileGrid=Array.from({length:13},()=>Array(13).fill(2));
 const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(src,{operators:[build,defaultBuild(src.operators[MEL]),defaultBuild(src.operators[KAZ]),defaultBuild(src.operators[DUSK])]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const u=b.deployOperator(ID,5,5,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';b.getPlayer('arkpedia').dp=0;
 const hits=[],dodge=[];b.on('damaged',c=>hits.push({...c,time:b.time}));b.on('dodge',c=>dodge.push({...c,time:b.time}));
 return{b,u,hits,dodge};
}
function enemy(b,{x=6,y=5,hp=100000,def=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,def,res:0,moveSpeed:0});if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;
 b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function ally(b,id=MEL,r=6,c=5){b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,'RIGHT');assert.ok(a);a.atkCd=1000;a.skill.rule='NEVER';return a;}
function move(b,e,x,y){b._unblock(e);e.x=x;e.y=y;b._buildEnemyIndex();}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function shot(b,u,e){b.forceAttack(u,[e]);u.atkCd=1000;}
function evade(b,u,e,type='phys') {b.addBuff(u,{key:'test:guarantee',mods:{dodgePhys:1,dodgeArts:1}});b.dealDamage(e,u,{amount:1000,type,isAttack:true,applyWay:'ranged'});b.removeBuff(u,'test:guarantee');}
const own=(hits,u)=>hits.filter(h=>h.source===u&&h.type==='phys');

test('all three exact skills,30 ranks,five bundles and native facing pointer proof retained',()=>{
 assert.deepEqual(FLAMETAIL_OPERATORS[ID].skillIds,['skchr_flamtl_1','skchr_flamtl_2','skchr_flamtl_3']);assert.equal(evidence.source.bundles.length,5);assert.equal(evidence.frameParity,false);
 for(const face of['Front','Back'])assert.equal(evidence.models[ID][face].sha256,evidence.originalFacingBindings[ID][face].sha256);
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{u}=make({skill,rank});assert.deepEqual(u.skill.bb,bb(skill,rank));near(u.skill.spCost,evidence.tables.skills[u.skill.id][rank-1].spData.spCost);}
});
test('natural ordinary attack emits one physical melee NORMAL event, no adjacent AOE or air hit',()=>{
 const{b,u,hits}=make(),e=enemy(b),z=enemy(b,{x:6.1}),air=enemy(b,{x:5.9,fly:true});u.atkCd=0;b.step();u.atkCd=1000;advance(b,.5);near(e.hp+z.hp,200000);advance(b,.2);assert.equal(own(hits,u).length,1);assert.equal(own(hits,u)[0].dmg.applyWay,'melee');assert.ok(own(hits,u)[0].dmg.isAttack);near(air.hp,100000);
});
test('ordinary SELF release substitutes entered legal targets and rejects departed/free/hidden input',()=>{
 for(const state of['leave','hidden','free']){const{b,u,hits}=make(),e=enemy(b),z=enemy(b,{x:9});shot(b,u,e);advance(b,.2);if(state==='leave')move(b,e,9,9);if(state==='hidden')e.hidden=true;if(state==='free')b.addBuff(e,{key:'free',flags:{untargetable:true}});move(b,z,6,5);advance(b,.6);near(e.hp,100000);assert.equal(own(hits,u)[0].target,z);}
});
test('literal normal .6 event/cap1 handles all facings and external BAT/ASPD',()=>{
 for(const dir of['UP','LEFT','DOWN','RIGHT']){const{b,u}=make({dir}),e=enemy(b,{x:5});b.addBuff(u,{key:'slow',mods:{batPct:1}});shot(b,u,e);let ev=b._evq.findLast(x=>x[0]==='atk'&&x[1]===u.id);near(ev[4].windup,1.2);b.addBuff(u,{key:'fast',mods:{aspd:400}});shot(b,u,e);ev=b._evq.findLast(x=>x[0]==='atk'&&x[1]===u.id);near(ev[4].windup,.6);assert.equal(ev[4].animation,'Attack');}
});
test('T1 unlock distinguishes E0 none/E1 one target/E2 current block capacity',()=>{
 for(const elite of[0,1,2]){const{b,u,hits}=make({elite}),e=enemy(b),z=enemy(b,{x:6.1}),k=enemy(b,{x:6.2});evade(b,u,e);shot(b,u,e);advance(b,1);assert.equal(own(hits,u).length,elite===0?1:elite===1?2:4);near(k.hp,100000);}
});
test('T1 literal unfiltered evade event accepts Physical and Arts but never True/gauge/HP loss/cancellation',()=>{
 for(const type of['phys','arts','true','element']){const{b,u,hits}=make(),e=enemy(b);if(type==='element')b.dealDamage(e,u,{amount:1,type:'element',element:'burn'});else evade(b,u,e,type);shot(b,u,e);advance(b,1);assert.equal(own(hits,u).length,['phys','arts'].includes(type)?2:1);}
 const{b,u}=make(),e=enemy(b);b.loseHp(u,1,{source:e});assert.equal(u.mem.flametailPending,null);b.on('hit',c=>{if(c.target===u)c.dmg.cancel=true;});evade(b,u,e);assert.equal(u.mem.flametailPending,null);
});
test('multiple evades create only one pending family and child does not create another attack event',()=>{
 const{b,u,hits}=make(),e=enemy(b);evade(b,u,e);const token=u.mem.flametailPending;evade(b,u,e,'arts');assert.equal(u.mem.flametailPending,token);let count=0;b.on('attack',c=>{if(c.attacker===u)count++;});shot(b,u,e);advance(b,1);assert.equal(count,1);assert.equal(own(hits,u).length,2);assert.equal(own(hits,u)[0].dmg.attackId,own(hits,u)[1].dmg.attackId);assert.equal(u.mem.flametailPending,null);shot(b,u,e);advance(b,.8);assert.equal(own(hits,u).length,3);
});
test('T1 extra is separately mitigated, same victim, exact .2 after actual main release',()=>{
 const{b,u,hits}=make(),e=enemy(b,{def:100});evade(b,u,e);shot(b,u,e);advance(b,.7);assert.equal(own(hits,u).length,1);advance(b,.2);const h=own(hits,u);assert.equal(h.length,2);near(h[0].amount,u.s.atk-100);near(h[1].amount,u.s.atk-100);near(h[1].time-h[0].time,.2,b.dt+1e-8);
});
test('current block capacity caps release, prioritizes blockers and is not unlimited range AOE',()=>{
 const{b,u,hits}=make(),e=enemy(b),z=enemy(b,{x:6.1}),q=enemy(b,{x:6.2});evade(b,u,e);shot(b,u,e);b.addBuff(u,{key:'block',mods:{blockCnt:1}});advance(b,1);assert.equal(own(hits,u).length,6);assert.ok(own(hits,u).some(h=>h.target===q));
});
test('unborn ordinary family interrupted by short control retains pending evade',()=>{
 for(const status of['stun','freeze','sleep','levitate']){const{b,u,hits}=make(),e=enemy(b);evade(b,u,e);shot(b,u,e);b.applyStatus(u,status,{duration:.001});advance(b,1);assert.equal(own(hits,u).length,0);assert.ok(u.mem.flametailPending);}
});
test('born target-bound T1 child survives source control and withdrawal; target death removes it',()=>{
 for(const state of['control','withdraw','target-death']){const{b,u,hits}=make(),e=enemy(b);evade(b,u,e);shot(b,u,e);advance(b,.65);if(state==='control')b.applyStatus(u,'stun',{duration:.001});if(state==='withdraw')b.retreat(u,{permanent:true});if(state==='target-death')b.kill(e);advance(b,.3);assert.equal(own(hits,u).length,state==='target-death'?1:2);assert.equal(e.buffs.filter(x=>x.key.startsWith('flametail:extra:')).length,0);}
});
test('born T1 child honors independent dodge and core Sleep immunity without source control cancellation',()=>{
 for(const state of['dodge','sleep']){const{b,u,hits}=make(),e=enemy(b);evade(b,u,e);shot(b,u,e);advance(b,.65);if(state==='dodge')b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});else b.applyStatus(e,'sleep',{duration:1});advance(b,.3);assert.equal(own(hits,u).length,1);}
});
test('T2 selected Kazimierz-only Physical dodge includes self and eligible unhealable ally',()=>{
 for(const potential of[1,5]){const{b,u}=make({potential}),n=ally(b,KAZ),m=ally(b,MEL,4,5);b.addBuff(n,{key:'healFree',flags:{healFree:true,noHeal:true}});advance(b,.05);near(u.s.dodgePhys,potential===5?.25:.22);near(n.s.dodgePhys,potential===5?.25:.22);near(m.s.dodgePhys,0);near(n.s.dodgeArts,0);}
});
test('T2 target-free/isolation removes owned contribution, hidden owner keeps it, retirement removes it',()=>{
 const{b,u}=make(),n=ally(b,KAZ);advance(b,.05);near(n.s.dodgePhys,.22);b.addBuff(n,{key:'free',flags:{untargetable:true}});advance(b,.05);near(n.s.dodgePhys,0);b.removeBuff(n,'free');b.addBuff(n,{key:'isolated',flags:{isolated:true}});advance(b,.05);near(n.s.dodgePhys,0);b.removeBuff(n,'isolated');u.hidden=true;advance(b,.05);near(n.s.dodgePhys,.22);u.hidden=false;b.retreat(u,{permanent:true});advance(b,.05);near(n.s.dodgePhys,0);
});
test('S1 exact all-rank immediate DP6 and one guaranteed physical evade; no fabricated attack',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({rank});cast(b,u);near(b.getPlayer('arkpedia').dp,6);assert.equal(u.skill.active,false);assert.ok(u.findBuff('flametail:s1'));assert.equal(u.stats.attacks,0);}
});
test('S1 physical consumption does not spend on Arts/True/gauge/HP loss or cancelled physical',()=>{
 const{b,u}=make({elite:0}),e=enemy(b);cast(b,u);for(const type of['arts','true'])b.dealDamage(e,u,{amount:1,type});b.dealDamage(e,u,{amount:1,type:'element',element:'burn'});b.loseHp(u,1);assert.ok(u.findBuff('flametail:s1'));const hook=b.on('hit',c=>{if(c.target===u)c.dmg.cancel=true;});b.dealDamage(e,u,{amount:1000,type:'phys'});assert.ok(u.findBuff('flametail:s1'));b.off(hook);const hp=u.hp;b.dealDamage(e,u,{amount:1000,type:'phys'});near(u.hp,hp);assert.equal(u.findBuff('flametail:s1'),null);
});
test('S1 actual Physical evade grants unlocked one pending T1 family',()=>{
 const{b,u,hits}=make(),e=enemy(b);cast(b,u);b.dealDamage(e,u,{amount:1000,type:'phys'});assert.ok(u.mem.flametailPending);shot(b,u,e);advance(b,1);assert.equal(own(hits,u).length,2);
});
test('S2 all ranks command DP/field precede literal .5 damage and .2 second spell',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,hits}=make({skill:1,rank}),e=enemy(b);cast(b,u);near(b.getPlayer('arkpedia').dp,bb(1,rank).cost);advance(b,.4);near(e.hp,100000);advance(b,.15);assert.equal(own(hits,u).length,1);near(own(hits,u)[0].amount,u.s.atk*bb(1,rank).atk_scale);assert.ok(e.s.flags.stun);advance(b,.25);assert.equal(own(hits,u).length,2);assert.equal(own(hits,u)[0].dmg.attackId,own(hits,u)[1].dmg.attackId);}
});
test('S2 retained up-to6 ALL-motion input list excludes seventh and new entrants',()=>{
 const{b,u,hits}=make({skill:1}),inputs=Array.from({length:7},(_,i)=>enemy(b,{x:5+(i%3)*.1,y:5+Math.floor(i/3)*.1,fly:i===0})),enter=enemy(b,{x:10});cast(b,u);move(b,enter,5,5);advance(b,.9);assert.equal(own(hits,u).length,12);assert.equal(new Set(own(hits,u).map(h=>h.target)).size,6);near(enter.hp,100000);assert.ok(own(hits,u).some(h=>h.target===inputs[0]));
});
test('S2 leave/hidden/free/dead inputs cancel their own output without synthetic replacement',()=>{
 for(const state of['leave','hidden','free','dead']){const{b,u,hits}=make({skill:1}),e=enemy(b),z=enemy(b,{x:9});cast(b,u);if(state==='leave')move(b,e,10,10);if(state==='hidden')e.hidden=true;if(state==='free')b.addBuff(e,{key:'free',flags:{untargetable:true}});if(state==='dead')b.kill(e);move(b,z,6,5);advance(b,1);assert.equal(own(hits,u).length,0);}
});
test('S2 short pre-release control cancels both unborn spells but retains command DP/field',()=>{
 const{b,u,hits}=make({skill:1}),e=enemy(b),a=ally(b);b.getPlayer('arkpedia').dp=0;cast(b,u);b.applyStatus(u,'stun',{duration:.001});advance(b,.9);assert.equal(own(hits,u).length,0);near(b.getPlayer('arkpedia').dp,13);assert.ok(a.findBuff(`flametail:s2:${u.id}`));assert.equal(u.findBuff('flametail:cast'),null);
});
test('S2 between-spell control preserves first damage but cancels unborn second; retreat clears derived field',()=>{
 const{b,u,hits}=make({skill:1}),e=enemy(b),a=ally(b);cast(b,u);advance(b,.55);assert.equal(own(hits,u).length,1);b.applyStatus(u,'stun',{duration:.001});advance(b,.3);assert.equal(own(hits,u).length,1);assert.ok(a.findBuff(`flametail:s2:${u.id}`));b.retreat(u,{permanent:true});advance(b,.05);assert.equal(a.findBuff(`flametail:s2:${u.id}`),null);
});
test('S2 ten-second field includes unhealable allies, detaches on range/free/isolation and has no Arts dodge',()=>{
 const{b,u}=make({skill:1}),a=ally(b);b.addBuff(a,{key:'noheal',flags:{healFree:true,noHeal:true}});cast(b,u);advance(b,.05);near(a.s.dodgePhys,0);advance(b,.17);near(a.s.dodgePhys,.5);near(a.s.dodgeArts,0);a.x=10;advance(b,.05);near(a.s.dodgePhys,0);a.x=5;advance(b,.05);near(a.s.dodgePhys,0);advance(b,.15);near(a.s.dodgePhys,.5);b.addBuff(a,{key:'isolated',flags:{isolated:true}});advance(b,.05);near(a.s.dodgePhys,0);b.removeBuff(a,'isolated');advance(b,9.9);near(a.s.dodgePhys,0);
});
test('S3 all ranks exact ATK/block/BAT multiplier and independent Physical+Arts dodge',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:2,rank});const atk=u.s.atk,block=u.s.blockCnt,interval=u.s.interval;cast(b,u);near(u.s.atk,atk*(1+bb(2,rank).atk));near(u.s.blockCnt,block+1);near(u.s.interval,interval*.7);near(u.s.dodgeArts,bb(2,rank).prob);near(u.s.dodgePhys,1-(1-.22)*(1-bb(2,rank).prob));}
});
test('S3 .7 BAT is multiplicative after independent external flat and percent modifiers',()=>{
 const{b,u}=make({skill:2});b.addBuff(u,{key:'external',mods:{batPct:.5,batFlat:.3}});const interval=u.s.interval;cast(b,u);near(u.s.interval,interval*.7);advance(b,8.2);near(u.s.interval,interval);
});
test('S3 literal facing Begin/Loop/End and eight periodic DP separately expose output versus presentation',()=>{
 for(const dir of['RIGHT','UP']){const{b,u,hits}=make({skill:2,dir}),e=enemy(b,{x:5});cast(b,u);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');u.atkCd=0;advance(b,.15);assert.equal(u.stats.attacks,0);advance(b,.2);assert.ok(u.stats.attacks>0);u.atkCd=1000;advance(b,.3);assert.ok(own(hits,u).length);advance(b,7.45);near(b.getPlayer('arkpedia').dp,8);assert.equal(u.skill.active,false);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');advance(b,.3);assert.equal(u.mem.regularFormVisual,null);}
});
test('S3 enhanced hit uses literal .2 event/.15 extra and current increased block capacity',()=>{
 const{b,u,hits}=make({skill:2}),e=enemy(b),z=enemy(b,{x:6.1}),q=enemy(b,{x:6.2});cast(b,u);advance(b,.3);evade(b,u,e,'arts');shot(b,u,e);advance(b,.25);assert.equal(own(hits,u).length,3);advance(b,.2);assert.equal(own(hits,u).length,6);near(own(hits,u)[3].time-own(hits,u)[0].time,.15,b.dt+1e-9);assert.ok(own(hits,u).some(h=>h.target===q));assert.equal(b._evq.findLast(x=>x[0]==='atk'&&x[1]===u.id)[4].animation,'Skill_2_Attack_2');
});
test('S3 early end/retirement cancels future DP, cleans modifiers and owned End/source aura',()=>{
 for(const state of['end','retreat']){const{b,u}=make({skill:2});const atk=u.s.atk;cast(b,u);advance(b,2.2);if(state==='end')u.skill.end('manual');else b.retreat(u,{permanent:true});advance(b,7);near(b.getPlayer('arkpedia').dp,2);near(u.s.atk,atk);assert.equal(u.mem.regularFormVisual,null);}
});

test('evade during an ordinary startup arms the next family without changing the already chosen branch',()=>{
 const{b,u,hits}=make(),e=enemy(b);shot(b,u,e);advance(b,.2);evade(b,u,e,'arts');advance(b,.7);assert.equal(own(hits,u).length,1);assert.ok(u.mem.flametailPending);shot(b,u,e);advance(b,1);assert.equal(own(hits,u).length,3);
});
test('S3 natural ordinary mode outputs carry skill metadata; cosmetic End has no extra disarm/SP gate',()=>{
 const{b,u,hits}=make({skill:2}),e=enemy(b);cast(b,u);advance(b,.3);shot(b,u,e);advance(b,.3);assert.equal(own(hits,u)[0].dmg.isSkill,true);advance(b,7.45);assert.equal(u.skill.active,false);assert.equal(!!u.s.flags.disarm,false);assert.ok(u.skill.gainSp(1,'test')>0);
});
test('explicit allowZeroBlockCntLimit0 keeps minimum-one enhanced victim at zero current block',()=>{
 const{b,u,hits}=make(),e=enemy(b),z=enemy(b,{x:6.1});b.addBuff(u,{key:'zeroBlock',mods:{blockCnt:-u.s.blockCnt}});near(u.s.blockCnt,0);evade(b,u,e);shot(b,u,e);advance(b,1);assert.equal(own(hits,u).length,2);near(z.hp,100000);assert.equal(u.mem.flametailPending,null);assert.ok(evidence.verificationLimits.some(x=>x.includes('allowZeroBlockCntLimit0')));
});

test('S2 first and reentry benefits wait for the next owned .2 pulse, invalid recipients detach promptly',()=>{
 const{b,u}=make({skill:1}),a=ally(b);cast(b,u);advance(b,.13);near(a.s.dodgePhys,0);advance(b,.08);near(a.s.dodgePhys,.5);a.x=10;advance(b,.04);near(a.s.dodgePhys,0);a.x=5;advance(b,.08);near(a.s.dodgePhys,0);advance(b,.08);near(a.s.dodgePhys,.5);b.addBuff(a,{key:'free',flags:{untargetable:true}});advance(b,.04);near(a.s.dodgePhys,0);
});
test('S2 no-profession ALLY aura reaches a real combat token while T2 operator-only faction aura does not',()=>{
 const{b,u}=make({skill:1}),d=ally(b,DUSK,4,5),t=b.spawnToken(d,'token_10015_dusk_drgn',6,5);assert.ok(t);t.atkCd=1000;t.tags.add('kazimierz');cast(b,u);advance(b,.23);near(t.s.dodgePhys,.5);assert.equal(t.findBuff('flametail:t2'),null);b.retreat(u,{permanent:true});advance(b,.05);near(t.s.dodgePhys,0);
});
test('same-key T2 strongest source never stacks, weaker source resumes and foreign dodge survives',()=>{
 const{b,u}=make(),a=ally(b,KAZ);b.addBuff(a,{key:'foreign-dodge',mods:{dodgePhys:.4}});advance(b,.05);near(a.s.dodgePhys,1-.6*.78);const other={...u,id:'synthetic-source',def:{...u.def,talents:[u.def.talents[0],{...u.def.talents[1],bb:{prob:.25}}]},mem:{}};b._arkpediaFlametail.set(other.id,other);advance(b,.05);near(a.s.dodgePhys,1-.6*.75);other.alive=false;advance(b,.05);near(a.s.dodgePhys,1-.6*.78);b.retreat(u,{permanent:true});advance(b,.05);near(a.s.dodgePhys,.4);assert.ok(a.findBuff('foreign-dodge'));
});
test('S1 automatic full-SP activation grants immediately and repeated command remains one evade charge',()=>{
 const{b,u}=make(),e=enemy(b);u.skill.rule='SP_FULL';u.skill.setSpTotal(u.skill.spCost);advance(b,.04);near(b.getPlayer('arkpedia').dp,6);u.skill.rule='NEVER';cast(b,u);near(b.getPlayer('arkpedia').dp,12);assert.equal(u.buffs.filter(x=>x.key==='flametail:s1').length,1);b.dealDamage(e,u,{amount:1000,type:'phys'});assert.equal(u.findBuff('flametail:s1'),null);assert.ok(u.mem.flametailPending);
});
