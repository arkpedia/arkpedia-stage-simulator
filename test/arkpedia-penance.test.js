// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-penance-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack } from '../server/sim/ai.js';
const ID = 'char_4065_judge';
const near = (a,z) => assert.ok(Math.abs(a-z)<1e-5,`${a} != ${z}`);
const barrier = u => u.findBuff('penance:barrier')?.shield ?? 0;
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
test('source evidence retains 30 ranks, native first pulse, exact facings and explicit callback limits',()=>{
  assert.equal(source.source.bundles.length,5);assert.equal(source.frameParity,false);assert.equal(source.moduleSupport,false);
  assert.equal(Object.values(source.tables.skills).flatMap(s=>s.levels).length,30);
  assert.equal(source.templates['damage_resistance'].eventToActions.ON_TAKE_DAMAGE[0]._damageMask,'PHYSICAL_AND_MAGICAL');
  const buffs=source.skills.skchr_judge_2.flatMap(g=>g.components.flatMap(c=>c.data._buffs??[]));
  assert.equal(buffs.find(b=>b.buffKey==='judge_s_2[aoe]').firstTriggerInterval,.8999999761581421);
  for(const f of ['Front','Back'])assert.equal(source.models[ID][f].sha256,source.officialSkeletonBindings[ID][f].sha256);
  assert.ok(source.verificationLimits.some(s=>s.includes('T1 BlockDamage')));
});
for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++)test(`S${skill+1} rank${rank}: selected source cost and output`,()=>{
  const{b,u,receipts}=make({skill,rank}),s=source.tables.skills[`skchr_judge_${skill+1}`].levels[rank-1];
  const bb=Object.fromEntries(s.blackboard.map(x=>[x.key,x.value]));near(u.skill.spCost,s.spData.spCost);
  const atk=u.s.atk,initial=barrier(u);cast(b,u);
  if(skill===0){const e=enemy(b);shot(b,u,e);advance(b,1);const h=outgoing(receipts,u);assert.equal(h.length,2);
    near(h[0].amount,atk*bb.atk_scale_2);near(h[1].amount,atk);assert.equal(e.s.flags.stun,false);}
  if(skill===1){const e=enemy(b);advance(b,.867);assert.equal(outgoing(receipts,u).length,0);advance(b,.034);
    near(outgoing(receipts,u)[0].amount,atk*bb.atk_scale);near(u.s.physTakenMul,1-bb.damage_resistance);
    near(u.skill.timeLeft,s.duration-(b.time-u.skill.lastStart));}
  if(skill===2){near(u.s.atk,atk*(1+bb.atk));near(u.s.interval,u.base.bat+bb.base_attack_time);near(barrier(u),initial+u.s.maxHp*bb.hp_ratio);
    const e=enemy(b);shot(b,u,e);advance(b,1);near(outgoing(receipts,u)[0].amount,atk*(1+bb.atk));}
});
for(const elite of [0,1,2])for(const potential of [1,3,5,6])test(`E${elite} P${potential}: deployment and kill barrier, selected retaliation`,()=>{
  const{b,u}=make({elite,potential}),e=enemy(b);const t=u.def.talents[0].bb;
  near(barrier(u),u.s.maxHp*t.born_hp_ratio);const hp=e.hp;incoming(b,u,e);
  const reflect=elite===2?(potential>=5?.53:.5):0;near(hp-e.hp,u.s.atk*reflect);
  const before=barrier(u);b.kill(e,u);near(barrier(u),before+u.s.maxHp*t.kill_hp_ratio);
});
test('barrier absorbs post-DEF damage, is capped, preserves consumed value, and shares S3 gains',()=>{
  const{b,u}=make({skill:2}),e=enemy(b),initial=barrier(u),hp=u.hp;
  b.dealDamage(e,u,{amount:u.s.def+100,type:'phys',isAttack:true});near(barrier(u),initial-100);near(u.hp,hp);near(u.skill.spTotal,1);
  for(let i=0;i<100;i++)b.kill(enemy(b),u);near(barrier(u),u.s.maxHp*3);
  cast(b,u);near(barrier(u),u.s.maxHp*3);advance(b,30.1);near(barrier(u),u.s.maxHp*3);near(u.s.atk,u.base.atk);near(u.s.interval,u.base.bat);
});
test('external maxHP changes do not rescale or trim existing barrier; new gains read current cap',()=>{
  const{b,u}=make({skill:2}),e=enemy(b);cast(b,u);u.skill.end('test');const value=barrier(u);
  b.addBuff(u,{key:'test:hp',mods:{hpMul:.1}});void u.s;near(barrier(u),value);b.kill(e,u);near(barrier(u),value);
  b.removeBuff(u,'test:hp');void u.s;b.kill(enemy(b),u);near(barrier(u),value+u.s.maxHp*.1);
});
test('S2 boosts only new talent barrier gains, not existing value or its cap',()=>{
  const{b,u}=make({skill:1}),initial=barrier(u);cast(b,u);near(barrier(u),initial);
  b.kill(enemy(b),u);near(barrier(u),initial+u.s.maxHp*.2);u.skill.end('test');b.kill(enemy(b),u);near(barrier(u),initial+u.s.maxHp*.3);
});
test('mapped T1-first breaking receipt has no retaliation; external shield alone is not its own mark',()=>{
  const{b,u,receipts}=make(),e=enemy(b),sh=barrier(u);incoming(b,u,e,sh);near(barrier(u),0);near(e.hp,e.s.maxHp);
  b.addBuff(u,{key:'external:shield',shield:5000});incoming(b,u,e);assert.equal(outgoing(receipts,u).length,0);
  b.kill(enemy(b),u);assert.ok(barrier(u)>0);incoming(b,u,e);near(e.s.maxHp-e.hp,u.s.atk*.5);
});
test('retaliation uses current ATK and enemy source, not friendly damage, HP loss or element filling',()=>{
  const{b,u}=make({skill:2}),e=enemy(b);b.loseHp(u,1,{source:e});near(e.hp,e.s.maxHp);
  b.dealDamage(u,u,{amount:10,type:'true',isAttack:true});near(e.hp,e.s.maxHp);
  b.dealDamage(e,u,{amount:1,type:'element',element:'burn'});near(e.hp,e.s.maxHp);
  cast(b,u);incoming(b,u,e);near(e.s.maxHp-e.hp,u.s.atk*.5);
});
test('retaliation kills credit Penance and refill the same dynamic barrier',()=>{
  const{b,u}=make(),e=enemy(b);e.hp=1;const sh=barrier(u);incoming(b,u,e,100);
  assert.equal(e.alive,false);near(barrier(u),sh-100+u.s.maxHp*.1);
});
for(const refusal of ['invulnerable','dodgePhys'])test(`${refusal} refuses incoming damage without spending barrier or triggering retaliation`,()=>{
  const{b,u,receipts}=make(),e=enemy(b),value=barrier(u);
  b.addBuff(u,{key:'test:refusal',...(refusal==='invulnerable'?{flags:{invulnerable:true}}:{mods:{dodgePhys:1}})});
  b.dealDamage(e,u,{amount:1000,type:'phys',isAttack:true});near(barrier(u),value);assert.equal(outgoing(receipts,u).length,0);
});
test('no ally heals, no self-heal on ordinary attack, and regeneration remains distinct',()=>{
  const{b,u}=make(),e=enemy(b);u.hp-=1000;const hp=u.hp;assert.equal(b.heal(e,u,100),0);
  shot(b,u,e);advance(b,1);near(u.hp,hp);b.addBuff(u,{key:'test:regen',mods:{hpRegen:10}});advance(b,1);near(u.hp,hp+10);
});
for(const charged of [false,true])test(`S1 ${charged?'charged':'ordinary'} has independent Arts rider, one Physical hit and correct SP clear`,()=>{
  const{b,u,receipts}=make(),e=enemy(b);e.base.def=200;e.base.res=25;e.markDirty();const atk=u.s.atk;
  cast(b,u,u.skill.spCost*(charged?2:1)+.5);near(u.skill.spTotal,0);shot(b,u,e);advance(b,1);
  const h=outgoing(receipts,u);assert.equal(h.length,2);assert.equal(h[0].type,'arts');assert.equal(h[1].type,'phys');
  near(h[0].amount,atk*2*.75);near(h[1].amount,atk*(charged?2:1)-200);assert.equal(e.s.flags.stun,charged);
  assert.equal(u.skill.pending,false);assert.equal(u.findBuff('penance:s1-lock'),null);
});
for(const dir of ['RIGHT','UP','LEFT','DOWN'])test(`charged S1 ${dir} strikes at original .300 event; normal uses .567`,()=>{
  const{b,u,receipts}=make({dir}),e=enemy(b,{x:5,y:5});cast(b,u,u.skill.spCost*2);shot(b,u,e);
  advance(b,.267);assert.equal(outgoing(receipts,u).length,0);advance(b,.034);assert.equal(outgoing(receipts,u).length,2);
});
test('S1 active Arts rider can kill before the primary; it gives one kill reward, not a second target hit',()=>{
  const{b,u,receipts}=make(),e=enemy(b),other=enemy(b,{x:5.5});e.hp=1;const sh=barrier(u);cast(b,u);shot(b,u,e);advance(b,1);
  assert.equal(outgoing(receipts,u).length,1);near(other.hp,other.s.maxHp);near(barrier(u),sh+u.s.maxHp*.1);
});
test('S1 retains a legal input, reselects a dead one, and refunds only if no replacement survives',()=>{
  for(const replace of [false,true]){const{b,u,receipts}=make(),e=enemy(b),other=replace?enemy(b,{x:5.5}):null;
    cast(b,u);shot(b,u,e);b.kill(e);advance(b,1);assert.equal(outgoing(receipts,u).length,replace?2:0);
    near(u.skill.charges,replace?0:1);if(other)assert.ok(other.hp<other.s.maxHp);}
});
test('S1 keeps its legal original victim when another enemy becomes higher priority during windup',()=>{
  const{b,u,receipts}=make(),e=enemy(b),other=enemy(b,{x:5.5});cast(b,u);shot(b,u,e);
  b.addBuff(other,{key:'test:taunt',mods:{taunt:10}});advance(b,1);
  assert.ok(outgoing(receipts,u).every(r=>r.target===e));near(other.hp,other.s.maxHp);
});
test('S1 max-SP charged pose follows original mix, clears after its strike, and allows recharge',()=>{
  const{b,u}=make(),e=enemy(b);u.skill.setSpTotal(u.skill.spCost*2);advance(b,b.dt);
  assert.equal(u.mem.regularFormVisual.clip,'Skill_1_Begin');advance(b,.34);
  assert.equal(u.mem.regularFormVisual.clip,'Skill_1_Idle');cast(b,u,u.skill.spCost*2);shot(b,u,e);advance(b,1);
  assert.equal(u.mem.regularFormVisual,null);assert.equal(u.mem.penanceCharged,false);assert.ok(u.skill.spTotal>0);
});
test('S1 short control interrupt cancels the pending attack and its charge mode without stale SP lock',()=>{
  const{b,u,receipts}=make(),e=enemy(b);cast(b,u,u.skill.spCost*2);shot(b,u,e);b.applyStatus(u,'stun',{duration:.05});advance(b,1);
  assert.equal(outgoing(receipts,u).length,0);assert.equal(u.skill.pending,false);assert.equal(u.findBuff('penance:s1-lock'),null);
  assert.equal(u.mem.penanceCharged,false);
});
test('S2 selects all current legal ground occupants on .9/1s pulses and ignores ASPD/control',()=>{
  const{b,u,receipts}=make({skill:1,dir:'UP'}),a=enemy(b,{x:5,y:5}),z=enemy(b,{x:5,y:4}),far=enemy(b,{x:8}),fly=enemy(b,{fly:true}),hidden=enemy(b);
  b.addBuff(hidden,{key:'test:untargetable',flags:{untargetable:true}});
  cast(b,u);b.addBuff(u,{key:'test:aspd',mods:{aspd:200}});b.applyStatus(u,'stun',{duration:2});
  advanceTo(b,u.skill.lastStart+.867);assert.equal(outgoing(receipts,u).length,0);
  advanceTo(b,u.skill.lastStart+.901);assert.equal(outgoing(receipts,u).length,2);
  advanceTo(b,u.skill.lastStart+1.867);assert.equal(outgoing(receipts,u).length,2);
  advanceTo(b,u.skill.lastStart+1.901);assert.equal(outgoing(receipts,u).length,4);
  for(const e of [far,fly,hidden])near(e.hp,e.s.maxHp);assert.ok(a.hp<a.s.maxHp&&z.hp<z.s.maxHp);assert.equal(u.mem.regularFormVisual.forceFront,true);
});
test('S2 strongest Sanctuary cuts only Physical/Arts, cannot stack, and restores external producer on end',()=>{
  const{b,u}=make({skill:1});cast(b,u);b.applyStatus(u,'sanctuary',{key:'external:sanctuary',value:.8,duration:30});
  near(u.s.physTakenMul,.2);near(u.s.artsTakenMul,.2);near(u.s.trueTakenMul,1);
  u.skill.end('test');near(u.s.physTakenMul,.2);assert.equal(u.findBuff('penance:s2'),null);assert.ok(u.findBuff('external:sanctuary'));
});
test('S2 completes exactly 20 source pulses and cannot leak a pulse or Sanctuary after expiry',()=>{
  const{b,u,receipts}=make({skill:1}),e=enemy(b);cast(b,u);const start=u.skill.lastStart;
  advanceTo(b,start+19.901);assert.equal(outgoing(receipts,u).length,20);assert.equal(u.skill.active,true);
  advanceTo(b,start+20.1);assert.equal(u.skill.active,false);assert.equal(u.findBuff('penance:s2'),null);
  advance(b,2);assert.equal(outgoing(receipts,u).length,20);assert.equal(u.mem.regularFormVisual,null);
  assert.ok(e.hp<e.s.maxHp);
});
for(const action of ['end','retreat','death'])test(`S2 ${action} invalidates future pulses and cleans owned state`,()=>{
  const{b,u,receipts}=make({skill:1}),e=enemy(b);cast(b,u);advance(b,.901);const count=outgoing(receipts,u).length;
  if(action==='end')u.skill.end('test');else if(action==='retreat')b.retreat(u);else b.kill(u);
  advance(b,2);assert.equal(outgoing(receipts,u).length,count);assert.equal(u.findBuff('penance:s2'),null);
});
test('S3 shield persists at skill end, with no natural or attack SP, and exactly one SP per incoming receipt',()=>{
  const{b,u}=make({skill:2}),e=enemy(b);advance(b,2);near(u.skill.spTotal,0);shot(b,u,e);advance(b,1);near(u.skill.spTotal,0);
  for(let i=0;i<20;i++)incoming(b,u,e,1);near(u.skill.spTotal,20);assert.equal(b.activateOperator(ID),true);const sh=barrier(u);
  const atk=u.s.atk;incoming(b,u,e,1);near(u.skill.spTotal,0);near(e.s.maxHp-e.hp,u.base.atk+20*u.base.atk*.5+atk*.5);
  u.skill.end('test');near(barrier(u),sh-1);near(u.s.atk,u.base.atk);near(u.s.taunt,0);
});
test('retreat clears the own barrier; redeployment gets only the selected deployment amount and fresh state',()=>{
  const{b,u}=make({skill:2});cast(b,u);b.retreat(u);near(barrier(u),0);advance(b,71);b.addDp('arkpedia',99);
  const next=b.deployOperator(ID,5,5,'RIGHT');assert.ok(next);near(barrier(next),next.s.maxHp*.5);assert.equal(next.mem.penanceCharged,false);
});
