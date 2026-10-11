// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-entelechia-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { canTargetEnemy } from '../server/sim/targeting.js';
const ID='char_4010_etlchi',CANDLE='enemy_5601_entlec';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){const end=b.time+s;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',others=[]}={}) {
  const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
  const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,
    skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(src,{operators:[build,...others.map(id=>defaultBuild(src.operators[id]))]});
  b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  b.addDp('arkpedia',99);const u=b.deployOperator(ID,3,2,dir);
  u.profile.noAttack=true;u.atkCd=1000;u.skill.rule='NEVER';
  const hits=[];b.on('damaged',c=>hits.push({...c,time:b.time}));return{b,u,hits,build};
}
function enemy(b,{r=3,c=3,hp=100000,def=0,res=0,fly=false}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});
  Object.assign(e.base,{maxHp:hp,atk:0,def,res});e.markDirty();void e.s;e.hp=hp;
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});
  b._buildEnemyIndex();return e;
}
function cast(u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);}
function fire(b,u,targets){b.forceAttack(u,targets??acquireTargets(b,u,effectiveProfile(u)));u.atkCd=1000;}
const tagged=(hs,t)=>hs.filter(h=>h.dmg.tags.includes(t));
const candles=b=>b.enemies.filter(e=>e.defId===CANDLE&&e.alive);
function ally(b,id,r,c){b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,'RIGHT');assert.ok(a);
  a.profile.noAttack=true;a.atkCd=1000;a.skill.rule='NEVER';return a;}

test('compiled Entelechia has exactly the original 30 skill ranks and source ranges',()=>{
  for(const s of data.operators[ID].skills)assert.deepEqual(s.levels.map(({rangeGrid,...l})=>l),evidence.tables.skills[s.id].levels);
  const{b,u,hits}=make({elite:0});const es=[enemy(b),enemy(b,{r:4}),enemy(b,{r:2}),enemy(b,{fly:true})];
  assert.deepEqual(new Set(acquireTargets(b,u,effectiveProfile(u))),new Set(es.slice(0,3)));
  fire(b,u);advance(b,.35);assert.equal(hits.length,0);advance(b,.1);assert.equal(hits.length,3);
  for(const e of es.slice(0,3))near(e.hp,100000-u.s.atk);near(es[3].hp,100000);
  assert.equal(u.mem.entelechiaStolen,0);assert.equal(u.profile.noHeal,true);
  b.addBuff(u,{key:'aspd',mods:{aspd:100}});near(u.profile.windup(b,u),.2);
});
for(let rank=1;rank<=10;rank++)test(`S1 rank ${rank}: two immediate same-target strikes, source multiplier and SP lock`,()=>{
  const{b,u,hits}=make({rank});const es=[enemy(b),enemy(b,{r:4}),enemy(b,{fly:true})];
  cast(u);assert.equal(u.s.flags.noSp,true);near(u.skill.gainSp(3,'gift'),0);
  fire(b,u);advance(b,.35);assert.equal(hits.length,0);advance(b,.1);
  const hs=tagged(hits,'entelechia:attack');assert.equal(hs.length,4);
  assert.equal(new Set(hs.map(h=>h.time)).size,1);assert.equal(new Set(hs.map(h=>h.dmg.attackId)).size,1);
  hs.forEach(h=>near(h.amount,u.s.atk*u.skill.bb.atk_scale));near(es[2].hp,100000);
  assert.equal(u.skill.active,false);
});
test('S1 captures inputs once and does not replace a dead target at release',()=>{
  const{b,u,hits}=make();const e=enemy(b);cast(u);fire(b,u,[e]);b.kill(e);const other=enemy(b);
  advance(b,.5);assert.equal(hits.length,0);near(other.hp,100000);assert.equal(u.skill.active,false);
});
test('attack interruption survives a control shorter than a combat tick',()=>{
  const{b,u,hits}=make();enemy(b);fire(b,u);b.applyStatus(u,'stun',{duration:.001});advance(b,.5);
  assert.equal(hits.length,0);
});
for(const elite of[1,2])for(const potential of[1,3,5])test(`E${elite} P${potential}: HP steal is before mitigation, final addition and capped`,()=>{
  const{b,u,hits}=make({elite,potential});const e=enemy(b);const talent=u.def.talents.find(t=>t.bb.magic_value)?.bb;
  u.hp=500;e.hp=50000;b.addBuff(u,{key:'hpPct',mods:{hpPct:.5}});b.addBuff(e,{key:'hpPct',mods:{hpPct:.5}});
  const own=u.s.maxHp,host=e.s.maxHp;u.hp=500;e.hp=50000;
  const hit=()=>b.dealDamage(u,e,{amount:10,type:'phys',tags:['entelechia:attack'],isAttack:true});
  hit();near(u.s.maxHp,own+talent['attack@steal_hp']);near(e.s.maxHp,host-talent['attack@steal_hp']);
  near(u.hp,550);near(e.hp,49990);
  for(let i=0;i<30;i++)hit();near(u.mem.entelechiaStolen,talent['attack@steal_hp_max']);
  near(u.s.maxHp,own+talent['attack@steal_hp_max']);near(e.s.maxHp,host-talent['attack@steal_hp_max']);
  const stolen=u.mem.entelechiaStolen;b.kill(e);advance(b,.05);near(u.mem.entelechiaStolen,stolen);
  near(u.s.maxHp,own+stolen);b.retreatOperator(ID);assert.equal(e.findBuff(`entelechia:stolen:${u.id}`),null);
  assert.ok(hits.length>0);
});
test('victim HP clamps to its new maximum, owner gain never heals by ratio, foreign/Buff damage never steals',()=>{
  const{b,u}=make();const e=enemy(b);u.hp=500;
  b.dealDamage(u,e,{amount:1,type:'phys',tags:['entelechia:attack']});near(e.hp,99924);near(u.hp,550);
  const stolen=u.mem.entelechiaStolen;
  b.dealDamage(u,e,{amount:100,type:'arts',tags:['dot','entelechia:dot']});
  b.loseHp(e,100,{source:u,tags:['entelechia:attack']});near(u.mem.entelechiaStolen,stolen);
});
test('independent source DoT extends without resetting its first tick and survives retreat',()=>{
  const{b,u,hits}=make();const e=enemy(b);u.hp=500;
  const hit=()=>b.dealDamage(u,e,{amount:1,type:'phys',tags:['entelechia:attack']});
  hit();advance(b,.5);hit();advance(b,.45);assert.equal(tagged(hits,'entelechia:dot').length,0);
  advance(b,.1);const dot=tagged(hits,'entelechia:dot');assert.equal(dot.length,1);near(dot[0].amount,200);
  const hp=u.hp,stolen=u.mem.entelechiaStolen;advance(b,1);near(u.hp,hp);near(u.mem.entelechiaStolen,stolen);
  b.retreatOperator(ID);advance(b,2);assert.equal(tagged(hits,'entelechia:dot').length,4);
});
test('source healing has a .05s block cap and .12s queue; no ally heal or DoT healing',()=>{
  const{b,u,hits}=make({elite:1});u.hp=100;const es=Array.from({length:5},()=>enemy(b));
  for(const e of es)b.dealDamage(u,e,{amount:1,type:'phys',tags:['entelechia:attack']});
  near(u.hp,150);advance(b,.1);near(u.hp,150);advance(b,.05);near(u.hp,200);
  assert.equal(u.mem.entelechiaHeal.count,2);near(b.heal(es[0],u,100),0);
  b.addBuff(u,{key:'block',mods:{blockCnt:1}});
  for(const e of es)b.dealDamage(u,e,{amount:1,type:'phys',tags:['entelechia:attack']});
  advance(b,.4);near(u.hp,350);assert.equal(tagged(hits,'entelechia:dot').length,0);
});
for(const potential of[1,3])test(`E2 P${potential}: one emergency heal, strict threshold, physical-only resistance and lethal guard`,()=>{
  const{b,u}=make({potential});const e=enemy(b);const t=u.def.talents.find(t=>t.bb.hp_ratio)?.bb,max=u.s.maxHp;
  u.hp=max*.25;advance(b,.05);assert.equal(u.mem.entelechiaServed,false);
  b.dealDamage(e,u,{amount:1,type:'true'});near(u.hp,max*(.25+t['etlchi_t_2[heal].hp_ratio'])-1);
  assert.equal(u.s.flags.undeadable,undefined);assert.equal(u.mem.entelechiaServed,true);
  const hp=u.hp;b.dealDamage(e,u,{amount:100,type:'phys'});near(u.hp,hp-5*(1-t.damage_resistance));
  b.dealDamage(e,u,{amount:100,type:'arts'});near(u.hp,hp-5*(1-t.damage_resistance)-100);
  b.dealDamage(e,u,{amount:1e9,type:'true'});assert.equal(u.alive,false);
  const next=make({potential});next.b.dealDamage(enemy(next.b),next.u,{amount:1e9,type:'true'});
  near(next.u.hp,1+next.u.s.maxHp*t['etlchi_t_2[heal].hp_ratio']);assert.equal(next.u.alive,true);
});
test('E0/E1 have no lethal guard; scripted E2 removal and HP loss are distinct',()=>{
  for(const elite of[0,1]){const{b,u}=make({elite});b.dealDamage(enemy(b),u,{amount:1e9,type:'true'});assert.equal(u.alive,false);}
  const{b,u}=make();b.loseHp(u,1e9);assert.equal(u.mem.entelechiaServed,true);assert.equal(u.alive,true);
  b.kill(u);assert.equal(u.alive,false);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank}: two tile-grid sickles, normal damage talents, no ordinary attacks and cleanup`,()=>{
  const{b,u,hits}=make({skill:1,rank,others:['char_158_milu']});const a=ally(b,'char_158_milu',2,4);
  const e=enemy(b,{c:2}),f=enemy(b,{r:2,c:4}),diagonal=enemy(b,{r:3,c:5}),far=enemy(b,{r:2,c:6}),air=enemy(b,{r:2,c:4,fly:true});
  cast(u);assert.deepEqual(u.mem.entelechiaCarriers,[u,a]);assert.equal(u.s.flags.disarm,true);
  advance(b,.45);assert.equal(hits.length,0);advance(b,.1);
  const hs=tagged(hits,'entelechia:sickle');assert.equal(hs.length,3);
  hs.forEach(h=>near(h.amount,u.s.atk*u.skill.bb.atk_scale));assert.ok(u.mem.entelechiaStolen>0);
  near(far.hp,100000);near(air.hp,100000);assert.ok(diagonal.hp<100000);assert.ok(e.hp<100000);assert.ok(f.hp<100000);
  assert.equal(tagged(hits,'entelechia:attack').length,0);
  u.skill.end('manual');const n=tagged(hits,'entelechia:sickle').length;advance(b,.6);
  assert.equal(tagged(hits,'entelechia:sickle').length,n);assert.deepEqual(u.mem.entelechiaCarriers,[]);
});
test('S2 carrier choice favours enemy count, excludes high ground, tracks liftoff and stops when carrier dies',()=>{
  const{b,u,hits}=make({skill:1,others:['char_158_milu','char_172_svrash','char_502_nblade']});
  const nearAlly=ally(b,'char_502_nblade',2,2),a=ally(b,'char_172_svrash',2,4),high=ally(b,'char_158_milu',4,4);
  high.ground=false;enemy(b,{r:2,c:4});enemy(b,{r:2,c:5});enemy(b,{r:4,c:4});enemy(b,{r:4,c:4});enemy(b,{r:4,c:4});
  const air=enemy(b,{r:2,c:4,fly:true});cast(u);assert.deepEqual(u.mem.entelechiaCarriers,[u,a]);
  advance(b,.55);near(air.hp,100000);b.addBuff(a,{key:'fly',flags:{liftoff:true}});advance(b,.5);assert.ok(air.hp<100000);
  b.kill(a);const hp=air.hp;advance(b,.5);near(air.hp,hp);assert.ok(nearAlly.alive);
  b.retreatOperator(ID);const count=tagged(hits,'entelechia:sickle').length;advance(b,1);assert.equal(tagged(hits,'entelechia:sickle').length,count);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank ${rank}: highest HP ground hosts, current HP/DEF/RES copies, non-scoring candles`,()=>{
  const{b,u}=make({skill:2,rank});const low=enemy(b,{hp:10000}),mid=enemy(b,{r:4,hp:20000,def:333,res:22}),
    high=enemy(b,{r:2,hp:30000}),higher=enemy(b,{c:4,hp:40000}),air=enemy(b,{hp:50000,fly:true});
  high.hp=21000;const total=b.total,kills=b.killed;cast(u);near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));near(u.s.aspd,200);
  advance(b,.3);assert.equal(candles(b).length,0);advance(b,.1);
  const cs=candles(b);assert.equal(cs.length,3);assert.deepEqual(cs.map(c=>c.mem.entelechiaHost),[higher,high,mid]);
  for(const c of cs){near(c.hp,c.mem.entelechiaHost.hp*.6);near(c.s.def,c.mem.entelechiaHost.s.def);near(c.s.res,c.mem.entelechiaHost.s.res);
    assert.equal(c.counted,false);assert.equal(c.s.flags.noMove,true);assert.equal(c.s.flags.unblockable,true);assert.equal(c.profile.noAttack,true);}
  assert.equal(cs.some(c=>c.mem.entelechiaHost===air||c.mem.entelechiaHost===low),false);
  near(b.total,total);near(b.killed,kills);
  const profile=effectiveProfile(u);assert.ok(acquireTargets(b,u,profile).some(c=>cs.includes(c)));
  near(u.profile.windup(b,u),.467/2);assert.match(u.mem.entelechiaAttackClip,/Skill_3_Loop_[AB]/);
  u.skill.end('manual');assert.equal(candles(b).length,0);near(b.total,total);near(b.killed,kills);
});
test('S3 candle selection is explicit; other operators cannot attack/hurt/fill element on candles',()=>{
  const{b,u}=make({skill:2,others:['char_172_svrash']});const a=ally(b,'char_172_svrash',2,2);const host=enemy(b);cast(u);advance(b,.4);
  const c=candles(b)[0],hp=c.hp;assert.equal(canTargetEnemy(a,c,effectiveProfile(a)),false);
  assert.equal(canTargetEnemy(u,c,effectiveProfile(u)),true);assert.equal(canTargetEnemy(u,c,u.profile),false);
  b.dealDamage(a,c,{amount:999,type:'true'});near(c.hp,hp);
  b.dealDamage(null,c,{amount:999,type:'true',sourceless:true});near(c.hp,hp);
  b.dealDamage(a,c,{amount:100,type:'element',element:'neural'});near(c.elem.neural,0);
  b.addBuff(host,{key:'targetFree',flags:{untargetable:true}});assert.equal(canTargetEnemy(u,host,effectiveProfile(u)),false);
});
test('candle keeps physical damage type and resistance multipliers at35%ATK floor; DoT never gets floor or HP steal',()=>{
  const{b,u,hits}=make({skill:2});const host=enemy(b,{def:1000000,res:90});cast(u);advance(b,.4);const c=candles(b)[0];
  b.addBuff(c,{key:'resistance',mods:{physTakenMul:.5}});const hp=host.hp,own=u.s.maxHp;
  b.dealDamage(u,c,{amount:u.s.atk,type:'phys',isAttack:true,tags:['entelechia:attack']});
  const main=tagged(hits,'entelechia:attack').find(h=>h.target===c);near(main.amount,u.s.atk*.35*.5);assert.equal(main.dmg.type,'phys');
  near(host.hp,hp-main.amount);near(u.s.maxHp,own);assert.equal(u.mem.entelechiaStolen,0);
  const linked=tagged(hits,'entelechia:linked')[0];assert.equal(linked.source,null);near(u.stats.dmg,main.amount);
  advance(b,1.05);const dots=tagged(hits,'entelechia:dot').filter(h=>h.target===c);assert.equal(dots.length,1);near(dots[0].amount,20);
});
test('ordinary S3 attacks strike normal enemies and candles together; source-mark acceptance is not owner identity',()=>{
  const{b,u,hits}=make({skill:2});const host=enemy(b);cast(u);advance(b,.4);const c=candles(b)[0];
  fire(b,u);advance(b,.3);assert.equal(tagged(hits,'entelechia:attack').filter(h=>h.source===u).length,2);
  assert.ok(tagged(hits,'entelechia:attack').some(h=>h.target===c));assert.ok(tagged(hits,'entelechia:attack').some(h=>h.target===host));
  const other=make({skill:2}).u,hp=c.hp;b.dealDamage(other,c,{amount:1,type:'true',tags:['entelechia:attack']});assert.ok(c.hp<hp);
});
test('host death/escape, owner retreat, out-of-range skill finish and early casting removal clear candles',()=>{
  for(const mode of['host','leak','owner','finish','early']){
    const{b,u}=make({skill:2});const host=enemy(b);cast(u);
    if(mode==='early')b.retreatOperator(ID);advance(b,.4);
    if(mode!=='early')assert.equal(candles(b).length,1);
    if(mode==='host')b.kill(host);
    if(mode==='leak')b._remove(host,'leak');
    if(mode==='owner')b.retreatOperator(ID);
    if(mode==='finish'){candles(b)[0].x=15;u.skill.end('manual');}
    assert.equal(candles(b).length,0);assert.deepEqual(b.errors,[]);
  }
});
test('S3 source global cleanup removes marked candles outside its owner and range',()=>{
  const{b,u}=make({skill:2});enemy(b);cast(u);advance(b,.4);const c=candles(b)[0];
  c.mem.entelechiaOwner={id:'another-source'};c.x=15;u.skill.end('manual');assert.equal(c.alive,false);
});
test('duration expiry stops S2 pulses and removes S3 candles without a manual finish',()=>{
  for(const skill of[1,2]){
    const{b,u,hits}=make({skill});enemy(b,{hp:1000000});cast(u);advance(b,.6);
    if(skill===2)assert.equal(candles(b).length,1);
    advance(b,u.skill.duration+.1);assert.equal(u.skill.active,false);
    assert.equal(candles(b).length,0);assert.deepEqual(u.mem.entelechiaCarriers??[],[]);
    const count=tagged(hits,'entelechia:sickle').length;advance(b,1);
    assert.equal(tagged(hits,'entelechia:sickle').length,count);
    assert.equal(u.s.flags.disarm||false,false);
  }
});
test('Heart Candle maps the native frozen and disarmed immunity names',()=>{
  const{b,u}=make({skill:2});enemy(b);cast(u);advance(b,.4);const c=candles(b)[0];
  for(const status of['stun','silence','sleep','freeze','levitate','tremble']){
    assert.equal(b.applyStatus(c,status,{duration:2}),false,status);
    assert.equal(c.s.flags[status]||false,false,status);
  }
  assert.equal(c.s.flags.noMove,true);assert.equal(c.s.flags.untargetable,true);
});
