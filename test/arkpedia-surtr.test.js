// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-surtr-prefabs.json' with { type: 'json' };
import { SURTR_OPERATORS } from '../shared/arkpedia/surtr-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const ID='char_350_surtr',MEL='char_208_melan';
const near=(a,z,e=1e-6)=>assert.ok(Math.abs(a-z)<e,`${a} != ${z}`);
const advance=(b,t)=>{for(let i=0;i<Math.ceil(t/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);};
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',deploy=true}={}){
 const src=structuredClone(data),op=src.operators[ID];assert.ok(op,'Reviewed Surtr snapshot required');
 src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;src.stage.geometry.rows=13;src.stage.geometry.cols=13;src.stage.geometry.tileGrid=Array.from({length:13},()=>Array(13).fill(2));
 const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(src,{operators:[build,defaultBuild(src.operators[MEL])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const u=deploy?b.deployOperator(ID,5,5,dir):null;if(u){u.atkCd=1000;u.skill.rule='NEVER';b.getPlayer('arkpedia').dp=0;}
 const hits=[];b.on('damaged',c=>hits.push({...c,time:b.time}));return{b,u,hits};
}
function enemy(b,{x=6,y=5,hp=100000,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,def:0,res,moveSpeed:0});if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;b.addBuff(e,{key:'pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
const shot=(b,u,e)=>{b.forceAttack(u,[e]);u.atkCd=1000;};
const cast=(b,u)=>{u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;};
const damage=(hits,u)=>hits.filter(h=>h.source===u&&h.target.side==='enemy');
const bleeding=(hits,u)=>hits.filter(h=>h.target===u&&h.dmg.tags.includes('surtr:bleed'));
const move=(b,e,x,y)=>{b._unblock(e);e.x=x;e.y=y;b._buildEnemyIndex();};

test('exact three skills/all30 ranks, official five bundles and actual facing hashes retained',()=>{
 assert.deepEqual(SURTR_OPERATORS[ID].skillIds,['skchr_surtr_1','skchr_surtr_2','skchr_surtr_3']);assert.equal(evidence.source.bundles.length,5);assert.equal(evidence.frameParity,false);
 for(const f of['Front','Back'])assert.equal(evidence.models[ID][f].sha256,evidence.originalFacingBindings[ID][f].sha256);
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{u}=make({skill,rank}),level=evidence.tables.skills[`skchr_surtr_${skill+1}`][rank-1];assert.deepEqual(u.skill.bb,Object.fromEntries(level.blackboard.map(x=>[x.key,x.value])));near(u.skill.spCost,level.spData.spCost);}
});
test('natural normal one Arts/NORMAL/MELEE output at literal .4, no adjacent AOE/flying hit',()=>{
 const{b,u,hits}=make(),e=enemy(b),z=enemy(b,{x:6.1}),air=enemy(b,{x:6.2,fly:true});u.atkCd=0;b.step();u.atkCd=1000;advance(b,.3);near(e.hp+z.hp,200000);advance(b,.15);assert.equal(damage(hits,u).length,1);const h=damage(hits,u)[0];assert.equal(h.type,'arts');assert.equal(h.dmg.applyWay,'melee');assert.equal(h.dmg.isAttack,true);near(air.hp,100000);
});
test('normal INPUT2 retains original startup victim rather than later range replacement',()=>{
 const{b,u,hits}=make(),e=enemy(b),z=enemy(b,{x:9});shot(b,u,e);advance(b,.1);move(b,e,9,9);move(b,z,6,5);advance(b,.5);assert.equal(damage(hits,u)[0].target,e);near(z.hp,100000);
});
test('T1 exact E0/E1/E2/potential RES penetration applies once and stacks with independent flat source',()=>{
 for(const elite of[0,1,2])for(const potential of[1,2,3,4,5,6]){const{b,u,hits}=make({elite,potential}),e=enemy(b,{res:50});const talent= u.def.talents.find(t=>t.bb.magic_resist_penetrate_fixed!=null)?.bb;const r=talent?.magic_resist_penetrate_fixed??0;near(r,elite===0?0:(elite===1?12:20)+(potential>=5?2:0));near(u.s.resIgnoreFlat,r);b.addBuff(u,{key:'foreign',mods:{resIgnoreFlat:3}});shot(b,u,e);advance(b,.6);near(damage(hits,u)[0].amount,u.s.atk*(1-(50-r-3)/100));}
});
test('literal normal event obeys external BAT/ASPD and all facing skeletons',()=>{
 for(const dir of['UP','LEFT','DOWN','RIGHT']){const{b,u}=make({dir}),e=enemy(b,{x:5});b.addBuff(u,{key:'slow',mods:{batPct:1}});shot(b,u,e);near(b._evq.findLast(x=>x[0]==='atk'&&x[1]===u.id)[4].windup,.8);b.addBuff(u,{key:'fast',mods:{aspd:100}});shot(b,u,e);near(b._evq.findLast(x=>x[0]==='atk'&&x[1]===u.id)[4].windup,.4);}
});
test('S1 allrank exact selected scale and one hit, ordinary before emission untouched',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,hits}=make({rank}),e=enemy(b);cast(b,u);shot(b,u,e);advance(b,.6);assert.equal(damage(hits,u).length,1);near(damage(hits,u)[0].amount,u.s.atk*u.skill.bb.atk_scale);assert.equal(u.skill.pending,false);assert.equal(damage(hits,u)[0].dmg.isSkill,true);}
});
test('S1 own emitted fatal restores full selected SP; shield/dodge/nonfatal do not',()=>{
 for(const state of['kill','shield','dodge','nonfatal']){const{b,u}=make(),e=enemy(b,{hp:state==='nonfatal'?100000:1});if(state==='shield')b.addBuff(e,{key:'shield',shield:100000});if(state==='dodge')b.addBuff(e,{key:'dodge',mods:{dodgeArts:1}});cast(b,u);shot(b,u,e);advance(b,.6);near(u.skill.sp,state==='kill'?u.skill.spCost:0);assert.equal(u.skill.charges,state==='kill'?1:0);}
});
test('S1 ordinary kill/unrelated victim never grants source skill refund',()=>{
 const{b,u}=make(),e=enemy(b,{hp:1}),z=enemy(b,{x:8});shot(b,u,e);advance(b,.6);near(u.skill.sp,1);cast(b,u);shot(b,u,z);b.kill(enemy(b,{x:9}),u);advance(b,.6);near(u.skill.sp,0);
});
test('S1 unborn dead input refunds; accepted short control preserves pending without output',()=>{
 const{b,u,hits}=make(),e=enemy(b);cast(b,u);shot(b,u,e);b.kill(e);advance(b,.6);assert.equal(damage(hits,u).length,0);assert.equal(u.skill.charges,1);
 const h=make(),z=enemy(h.b);cast(h.b,h.u);shot(h.b,h.u,z);h.b.applyStatus(h.u,'stun',{duration:.001});advance(h.b,.6);assert.equal(damage(h.hits,h.u).length,0);assert.equal(h.u.skill.pending,true);assert.equal(h.u.skill.charges,0);
});
test('S2 everyrank exact ATK/duration/range/max2 and duration cleanup preserves foreign buff',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:1,rank}),base=u.s.atk;b.addBuff(u,{key:'foreign',mods:{atkPct:.2}});cast(b,u);near(u.s.atk,base*(1.2+u.skill.bb.atk));assert.equal(u.profile.maxTargets,1);advance(b,u.skill.duration+.1);near(u.s.atk,base*1.2);assert.ok(u.findBuff('foreign'));assert.equal(u.skill.active,false);}
});
test('S2 exact solo target multiplier versus two separately mitigated victims',()=>{
 for(const n of[1,2]){const{b,u,hits}=make({skill:1}),e=enemy(b,{res:50});if(n===2)enemy(b,{x:7,res:50});cast(b,u);shot(b,u,e);advance(b,.6);const h=damage(hits,u);assert.equal(h.length,n);for(const x of h)near(x.amount,u.s.atk*(n===1?u.skill.bb['attack@surtr_s_2[critical].atk_scale']:1)*.7);}
});
test('S2 first of two dying cannot grant solo multiplier to surviving second',()=>{
 const{b,u,hits}=make({skill:1}),e=enemy(b,{hp:1}),z=enemy(b,{x:7});cast(b,u);shot(b,u,e);advance(b,.6);const h=damage(hits,u);assert.equal(h.length,2);near(h.find(x=>x.target===z).amount,u.s.atk);
});
test('S2 release membership preserves legal input and picks new eligible substitute; excludes air/free',()=>{
 const{b,u,hits}=make({skill:1}),e=enemy(b),z=enemy(b,{x:9}),air=enemy(b,{x:7,fly:true}),free=enemy(b,{x:7.2});b.addBuff(free,{key:'free',flags:{untargetable:true}});cast(b,u);shot(b,u,e);advance(b,.1);move(b,z,7,5);advance(b,.5);assert.equal(damage(hits,u).length,2);assert.ok(damage(hits,u).some(x=>x.target===z));near(air.hp,100000);near(free.hp,100000);
});
test('S2 original facing/Down clips .433 and no fabricated Begin/End lock',()=>{
 for(const dir of['UP','LEFT','DOWN','RIGHT']){const{b,u}=make({skill:1,dir}),e=enemy(b,{x:5});cast(b,u);shot(b,u,e);const ev=b._evq.findLast(x=>x[0]==='atk'&&x[1]===u.id);near(ev[4].windup,.433);assert.equal(ev[4].animation,dir==='DOWN'?'Skill_2_Down':'Skill_2');u.skill.end('test');assert.equal(Boolean(u.s.flags.disarm),false);}
});
test('S3 allrank command additive5000HP/range/ATK and source full heal after own maxHP effect',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:2,rank}),hp=u.s.maxHp,atk=u.s.atk;u.hp=100;cast(b,u);near(u.s.maxHp,hp+5000);near(u.hp,hp+5000);near(u.s.atk,atk*(1+u.skill.bb.atk));assert.equal(u.skill.timeLeft,Infinity);assert.equal(u.mem.regularFormVisual.clip,'Skill_3_Begin');}
});
test('S3 heal honors source modifiers while ignoring source HealFree explicitly',()=>{
 const{b,u}=make({skill:2});b.addBuff(u,{key:'foreign',flags:{healFree:true,noHeal:true},mods:{healingTakenMul:.1}});u.hp=1;const oldMax=u.s.maxHp;cast(b,u);near(u.hp,u.s.maxHp/oldMax+u.s.maxHp*.1);assert.ok(u.findBuff('foreign'));
});
test('S3 no attack during .6 Begin; literal Loop speed1.3/event.4 and source cap1',()=>{
 const{b,u,hits}=make({skill:2}),e=enemy(b);cast(b,u);u.atkCd=0;advance(b,.5);assert.equal(damage(hits,u).length,0);advance(b,.15);u.atkCd=1000;advance(b,.35);assert.equal(damage(hits,u).length,1);const ev=b._evq.findLast(x=>x[0]==='atk'&&x[1]===u.id);near(ev[4].windup,.4/1.3);assert.equal(ev[4].animation,'Skill_3_Loop');assert.equal(damage(hits,u)[0].dmg.isSkill,true);
});
test('S3 source speed cap1 independent of excessive ASPD and slow external BAT',()=>{
 const{b,u}=make({skill:2}),e=enemy(b);cast(b,u);advance(b,.65);b.addBuff(u,{key:'fast',mods:{aspd:200}});shot(b,u,e);near(b._evq.findLast(x=>x[0]==='atk'&&x[1]===u.id)[4].windup,.4/1.3);b.removeBuff(u,'fast');b.addBuff(u,{key:'slow',mods:{batPct:1}});shot(b,u,e);near(b._evq.findLast(x=>x[0]==='atk'&&x[1]===u.id)[4].windup,.8/1.3);
});
test('S3 four ground targets through third-front extension, no beyond/front4 or flying',()=>{
 const{b,u,hits}=make({skill:2}),e=enemy(b);for(const x of[7,8,8.1,8.2])enemy(b,{x});const far=enemy(b,{x:9}),air=enemy(b,{x:7.5,fly:true});cast(b,u);advance(b,.65);shot(b,u,e);advance(b,.4);assert.equal(damage(hits,u).length,4);near(far.hp,100000);near(air.hp,100000);
});
test('S3 exact first .2 wait and increasing right-endpoint PURE/NORMAL hp drain',()=>{
 const{b,u,hits}=make({skill:2});cast(b,u);const max=u.s.maxHp;advance(b,.15);assert.equal(bleeding(hits,u).length,0);advance(b,.05);const h=bleeding(hits,u)[0];near(h.amount,max*.2*(.2/60)*.2);assert.equal(h.type,'true');assert.equal(h.dmg.isAttack,true);assert.equal(h.dmg.noSp,true);assert.equal(h.dmg.tags.includes('HPLOSS'),false);advance(b,.2);near(bleeding(hits,u)[1].amount,2*h.amount);
});
test('S3 bleed bypasses ordinary shield/dodge/Sanctuary/final-damage modifiers, not existing floor',()=>{
 const{b,u,hits}=make({skill:2});b.addBuff(u,{key:'foreign',shield:10000,mods:{dmgTakenMul:.1,dodgePhys:1,dodgeArts:1},flags:{undeadable:true}});cast(b,u);u.hp=1;advance(b,.2+b.dt);near(u.hp,1);assert.equal(u.findBuff('foreign').shield,10000);assert.ok(bleeding(hits,u)[0].amount>0);assert.equal(u.mem.surtrFatalUsed,false);
});
test('S3 ongoing drain samples foreign current maxHP changes, leaves foreign modifiers owned',()=>{
 const{b,u,hits}=make({skill:2});cast(b,u);advance(b,.2+b.dt);const max=u.s.maxHp;b.addBuff(u,{key:'foreign',mods:{hpFlat:1000}});advance(b,.2);near(bleeding(hits,u)[1].amount,(max+1000)*.2*(.4/60)*.2);u.skill.end('test');assert.ok(u.findBuff('foreign'));near(u.s.maxHp,max-5000+1000);
});
test('S3 linear ramp reaches selected20percent cap at60 then stays capped with real healing',()=>{
 const{b,u,hits}=make({skill:2});cast(b,u);b.on('tick',()=>{if(u.alive)b.heal(u,u,u.s.maxHp,{self:true,ignoreHealFree:true});});advance(b,61);const h=bleeding(hits,u);assert.ok(u.alive);assert.ok(h.length>=300);near(h.find(x=>x.time>=60-1e-8).amount,u.s.maxHp*.2*.2);near(h.at(-1).amount,u.s.maxHp*.2*.2);assert.equal(u.mem.surtrFatalUsed,false);
});
test('S3 nonhealed death time is corroborated sqrt600 bridge plus exact talent delay within .2 tick',()=>{
 const{b,u}=make({skill:2});cast(b,u);while(!u.mem.surtrFatalUsed&&b.time<30)b.step();assert.deepEqual(b.errors,[]);near(b.time,Math.sqrt(600),.25);const deathAt=b.time+8;advance(b,7.8);assert.ok(u.alive);advance(b,.25);assert.equal(u.alive,false);near(u.deathAt,deathAt,b.dt+1e-8);assert.equal(u.removeReason,'killed');
});
test('T2 E0 absent, E1 exact4/5sec and E2 exact8/9sec; direct lethal and fractional HPLOSS clamp',()=>{
 for(const elite of[0,1,2])for(const potential of[1,2,3,4,5,6]){const{b,u}=make({elite,potential});b.loseHp(u,u.hp+100);if(elite===0){assert.equal(u.alive,false);continue;}near(u.hp,1);assert.equal(u.mem.surtrFatalUsed,true);b.loseHp(u,.8);near(u.hp,1);const delay=u.def.talents.find(t=>t.bb['surtr_t_2[withdraw].interval']!=null).bb['surtr_t_2[withdraw].interval'];near(delay,(elite===1?4:8)+(potential>=3?1:0));advance(b,delay-.1);assert.ok(u.alive);advance(b,.15);assert.equal(u.alive,false);}
});
test('T2 removes no HP floor from unrelated owner and never consumes while foreign undeadable prevents fatal',()=>{
 const{b,u}=make();b.addBuff(u,{key:'foreign',flags:{undeadable:true}});b.loseHp(u,u.hp+1);near(u.hp,1);assert.equal(u.mem.surtrFatalUsed,false);b.removeBuff(u,'foreign');b.loseHp(u,1);assert.equal(u.mem.surtrFatalUsed,true);
});
test('T2 protection has no damage/control immunity, healing blocked unless original explicit ignore',()=>{
 const{b,u,hits}=make(),e=enemy(b);b.loseHp(u,u.hp+1);b.dealDamage(e,u,{amount:10,type:'true',isAttack:true});near(u.hp,1);assert.ok(hits.some(x=>x.target===u&&x.source===e));b.applyStatus(u,'stun',{duration:1});assert.equal(u.canAct,false);near(b.heal(u,u,100,{self:true}),0);near(b.heal(u,u,100,{self:true,ignoreHealFree:true}),100);
});
test('T2 deadline is neither reset by S3 activation nor ended with its mode',()=>{
 const{b,u}=make({skill:2});b.loseHp(u,u.hp+1);advance(b,2);cast(b,u);near(u.hp,u.s.maxHp);advance(b,1);u.skill.end('test');advance(b,5.05);assert.equal(u.alive,false);near(u.deathAt,8,b.dt+1e-8);
});
test('forced talent withdrawal uses killed-state with no ordinary retreat DP refund',()=>{
 const{b,u}=make();const dp=b.getPlayer('arkpedia').dp;let killed=0;b.on('death',c=>{if(c.unit===u){assert.equal(c.reason,'killed');killed++;}});b.loseHp(u,u.hp+1);advance(b,8.1);near(b.getPlayer('arkpedia').dp,dp);assert.equal(killed,1);assert.equal(b.deployedSlots(),0);assert.equal(u.deployed,false);
});
test('scripted kill bypasses T2; real retreat clears timer and active S3/bleed',()=>{
 for(const why of['kill','retreat']){const{b,u,hits}=make({skill:2});cast(b,u);advance(b,.3);b.loseHp(u,u.hp+1);if(why==='kill')b.kill(u);else b.retreat(u);const n=bleeding(hits,u).length;advance(b,9);assert.equal(bleeding(hits,u).length,n);assert.equal(u.mem.surtrThird,null);assert.equal(u.mem.regularFormVisual,null);assert.equal(u.skill.active,false);}
});
test('redeployment resets source one-use fatal talent, stats/skill and owns no leaked earlier deadline',()=>{
 const{b,u}=make({skill:2});const baseHp=u.s.maxHp;cast(b,u);b.loseHp(u,u.hp+1);advance(b,1);b.retreat(u);advance(b,71);b.addDp('arkpedia',99);const z=b.deployOperator(ID,5,5,'RIGHT');assert.notEqual(z,u);z.atkCd=1000;z.skill.rule='NEVER';near(z.s.maxHp,baseHp);near(z.hp,baseHp);assert.equal(z.mem.surtrFatalUsed,false);assert.equal(z.findBuff('surtr:remnant'),null);assert.equal(z.skill.active,false);b.loseHp(z,z.hp+1);advance(b,7.9);assert.ok(z.alive);advance(b,.15);assert.equal(z.alive,false);
});
test('delayed fractional first deployment starts S3 bleed from actual command, not construction time',()=>{
 const{b,hits}=make({skill:2,deploy:false});advance(b,1.5);const u=b.deployOperator(ID,5,5,'RIGHT');u.skill.rule='NEVER';u.atkCd=1000;cast(b,u);advance(b,.15);assert.equal(bleeding(hits,u).length,0);advance(b,.1);const h=bleeding(hits,u)[0];near(h.time-u.skill.lastStart,.2,b.dt+1e-8);near(h.amount,u.s.maxHp*.2*(.2/60)*.2,b.dt);
});
test('short control cancels unborn S2/S3 output; already attached S3 HP/drain survive control',()=>{
 for(const skill of[1,2]){const{b,u,hits}=make({skill}),e=enemy(b);cast(b,u);if(skill===2)advance(b,.65);shot(b,u,e);b.applyStatus(u,'freeze',{duration:.001});advance(b,.7);assert.equal(damage(hits,u).length,0);assert.equal(u.skill.active,true);if(skill===2)assert.ok(bleeding(hits,u).length>0);}
});
test('source permanent RES talent survives removal; foreign persistent HP source is not erased or duplicated',()=>{
 const{b,u}=make({skill:2});b.addBuff(u,{key:'foreign',persist:true,mods:{hpFlat:123}});const baseline=u.s.maxHp;cast(b,u);b.retreat(u);assert.ok(u.findBuff('foreign'));assert.ok(u.findBuff('surtr:res-ignore'));advance(b,71);b.addDp('arkpedia',99);const z=b.deployOperator(ID,5,5,'RIGHT');assert.notEqual(z,u);near(u.s.maxHp,baseline);near(z.s.maxHp,baseline-123);assert.equal(z.findBuff('foreign'),null);near(z.s.resIgnoreFlat,20);assert.equal(u.buffs.filter(x=>x.key==='surtr:res-ignore').length,1);assert.equal(u.buffs.filter(x=>x.key==='foreign').length,1);assert.equal(z.buffs.filter(x=>x.key==='surtr:res-ignore').length,1);
});

test('S3 public command cannot manually cancel its unlimited stance or drain',()=>{
 const{b,u,hits}=make({skill:2});u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);assert.equal(b.activateOperator(ID),false);advance(b,.3);assert.equal(u.skill.active,true);assert.ok(bleeding(hits,u).length);assert.equal(u.mem.surtrThird!==null,true);
});
