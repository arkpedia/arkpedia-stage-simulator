// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-caster-utility-prefabs.json' with { type: 'json' };
import { FIVE_STAR_CASTER_UTILITY_OPERATORS } from '../shared/arkpedia/five-star-caster-utility-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { createRng } from '../server/sim/rng.js';
const ABS='char_405_absin',NIG='char_164_nightm',QAN='char_466_qanik',SAN='char_341_sntlla',DEL='char_4110_delphn';
const near=(a,e,tol=1e-5)=>assert.ok(Math.abs(a-e)<tol,`${a} != ${e}`);
function advance(b,seconds){for(let n=0;n<Math.round(seconds/b.dt);n++)b.step();assert.deepEqual(b.errors,[]);}
function make(id,{skill=0,elite=2,rank=10,potential=1,tags=[],others=[]}={}){
 const src=structuredClone(data),op=src.operators[id];assert.ok(op,`Reviewed snapshot required: ${id}`);
 src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;src.stage.mapTags=tags;
 const b=new StandardBattle(src,{operators:[{...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
  potential,skillId:op.skills[skill].id,skillRank:rank},...others.map(id=>defaultBuild(src.operators[id]))]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(who=id,row=1,col=4,dir='UP')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,row,col,dir);assert.ok(u);u.atkCd=1000;return u;};
 return{b,deploy,src};
}
function enemy(b,{row=2,col=4,res=0,fly=false,hp=100000,maxHp=100000}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});e.base.maxHp=maxHp;e.base.def=0;e.base.res=res;e.markDirty();void e.s;e.hp=hp;
 if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);u.atkCd=1000;}
function strike(b,u,targets,seconds=1){const hp=targets.map(e=>e.hp);b.forceAttack(u,targets);u.atkCd=1000;advance(b,seconds);return targets.map((e,i)=>hp[i]-e.hp);}
function bb(id,skill,rank){return Object.fromEntries(data.operators[id].skills[skill].levels[rank-1].blackboard.map(r=>[r.key,r.value]));}

test('durable source binds every utility skill and proves precise burst/link/column/infinite-DOT fields',()=>{
 for(const[id,c]of Object.entries(FIVE_STAR_CASTER_UTILITY_OPERATORS)){
  assert.match(evidence.source.bundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  for(const sid of c.skillIds)assert.ok(evidence.skills[sid.startsWith('skcom')?'skcom_quickattack':sid].length);
  assert.match(evidence.models[id].Front.sha256,/^[a-f0-9]{64}$/);
 }
 assert.equal(evidence.characters[ABS].find(x=>'_triggerDelta'in x)._triggerDelta,.05000000074505806);
 const linked=evidence.projectiles.projectile_chr_qanik_s2.find(x=>'_linkDuration'in x);assert.equal(linked._linkDuration,7);
 const columns=evidence.characters[SAN].filter(x=>x.m_Size?.x===1&&x.m_Size.y===4);
 assert.deepEqual(columns.map(x=>x.m_Offset.x).sort(),[-1,0,1]);
 const dot=evidence.characters[DEL].flatMap(x=>x._activeBuffs??[]).find(x=>x.buffKey==='delphn_s_2[damage]');
 assert.equal(dot.lifeTimeType,2);assert.equal(dot.firstTriggerInterval,.15000000596046448);assert.equal(dot.triggerInterval,1);
 assert.equal(evidence.source.frameParityVerified,false);
});
test('all ten utility skills load every source rank and preserve distinct verified selected-skill IDs',()=>{
 for(const[id,c]of Object.entries(FIVE_STAR_CASTER_UTILITY_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,c.skillIds[skill]);assert.equal(u.skill.noSkill,false);
 }
});
test('Absinthe normal first-attack opening and source speed15 flight delay damage until the original loop event',()=>{
 const{b,deploy}=make(ABS,{elite:0,rank:4}),u=deploy(),e=enemy(b);b.forceAttack(u,[e]);u.atkCd=1000;
 advance(b,.75);near(e.hp,100000);advance(b,.15);near(100000-e.hp,u.s.atk);assert.equal(u.mem.absintheStarted,true);
});
test('Absinthe talent uses strict below40% output damage and follows all promotion/potential values',()=>{
 for(const[elite,potential,scale]of[[0,1,1],[1,1,1.12],[1,5,1.18],[2,1,1.24],[2,5,1.3]]){
  const{b,deploy}=make(ABS,{elite,potential,rank:[4,7,10][elite]}),u=deploy(),edge=enemy(b,{hp:40000}),low=enemy(b,{col:4.3,hp:39999,res:50});
  near(strike(b,u,[edge],1)[0],u.s.atk);near(strike(b,u,[low],1)[0],u.s.atk*.5*scale);
 }
});
test('Absinthe S1 activates on full SP without a target, persists and chooses lowest HP ratio rather than absolute HP',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(ABS,{rank}),u=deploy(),atk=u.s.atk;u.skill.gainSp(u.skill.spCost,'test');advance(b,.05);
  assert.equal(u.skill.active,true);near(u.s.atk,atk*(1+bb(ABS,0,rank).atk));
  const low=enemy(b,{hp:30000,maxHp:100000}),small=enemy(b,{col:4.3,hp:10000,maxHp:20000});
  assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],low);advance(b,120);assert.equal(u.skill.active,true);
  assert.ok(low.alive&&small.alive);b.retreat(u);assert.equal(u.skill.active,false);
 }
});
test('Absinthe S2 accepts exactly50% HP, rejects above, and emits four .05-spaced projectiles with per-hit talent checks',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(ABS,{skill:1,rank}),u=deploy(),e=enemy(b,{hp:50000}),high=enemy(b,{col:4.3,hp:50001});cast(b,u);advance(b,.55);
  assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e]);const hp=e.hp;
  b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.067);assert.ok(b.projectiles.list.length>0);advance(b,.25);
  near(hp-e.hp,u.s.atk*bb(ABS,1,rank)['attack@atk_scale']*4);near(high.hp,50001);
 }
});
test('Absinthe interrupted S2 burst never resumes unfired rounds after brief control, while already launched rounds persist',()=>{
 const{b,deploy}=make(ABS,{skill:1}),u=deploy(),e=enemy(b,{hp:50000});cast(b,u);advance(b,.55);
 b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.067);b.applyStatus(u,'stun',{duration:.04});advance(b,.3);
 near(50000-e.hp,u.s.atk*bb(ABS,1,10)['attack@atk_scale']);assert.equal(u.canAct,true);
});
test('Nightmare selected talent supplies both dodges for S1 and only ATK for S2 at each source promotion/potential',()=>{
 for(const[elite,potential,dodge,atk]of[[1,1,.2,.09],[1,5,.25,.12],[2,1,.4,.15],[2,5,.45,.18]])for(const skill of[0,1]){
  const{b,deploy}=make(NIG,{elite,potential,skill,rank:elite===1?7:10}),u=deploy();
  near(u.s.dodgePhys,skill===0?dodge:0);near(u.s.dodgeArts,skill===0?dodge:0);near(u.s.atk,u.base.atk*(skill===1?1+atk:1));
 }
});
test('Nightmare S1 directly damages at .733 then heals lowest-ratio recipients from actual mitigated damage after speed5 flight',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(NIG,{rank,others:['char_123_fang','char_122_beagle']}),u=deploy(NIG,2,4),a=deploy('char_123_fang',3,4),z=deploy('char_122_beagle',3,5);
  a.hp=a.s.maxHp*.1;z.hp=z.s.maxHp*.2;const ah=a.hp,zh=z.hp,e=enemy(b,{row:3,col:4,res:50});cast(b,u);
  b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.8);near(100000-e.hp,u.s.atk*.5);near(a.hp,ah);near(z.hp,zh);
  advance(b,.35);near(a.hp-ah,u.s.atk*.5*bb(NIG,0,rank)['attack@heal_scale']);
  near(z.hp-zh,bb(NIG,0,rank)['attack@max_target']===2?u.s.atk*.5*bb(NIG,0,rank)['attack@heal_scale']:0);
 }
});
test('Nightmare S1 skips heal-free/untargetable allies and causes no healing from cancelled enemy damage',()=>{
 const{b,deploy}=make(NIG,{others:['char_123_fang','char_122_beagle']}),u=deploy(NIG,2,4),a=deploy('char_123_fang',3,4),z=deploy('char_122_beagle',3,5),e=enemy(b,{row:3,col:4});
 a.hp=100;z.hp=100;b.addBuff(a,{key:'test:healFree',flags:{healFree:true}});z.hidden=true;cast(b,u);
 strike(b,u,[e],1.2);near(a.hp,100);near(z.hp,100);
 z.hidden=false;b.addBuff(e,{key:'test:invuln',flags:{invulnerable:true}});strike(b,u,[e],1.2);near(z.hp,100);
});
test('Nightmare S1 excludes isolated secondary-heal recipients at selection and rechecks isolation at projectile impact',()=>{
 const{b,deploy}=make(NIG,{others:['char_123_fang','char_122_beagle']}),u=deploy(NIG,2,4),a=deploy('char_123_fang',3,4),z=deploy('char_122_beagle',3,5),e=enemy(b,{row:3,col:4});
 a.hp=100;z.hp=100;b.addBuff(a,{key:'test:isolate',flags:{isolated:true}});cast(b,u);
 b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.8);b.addBuff(z,{key:'test:isolate',flags:{isolated:true}});advance(b,.5);
 near(a.hp,100);near(z.hp,100);b.removeBuff(a,'test:isolate');b.removeBuff(z,'test:isolate');
 strike(b,u,[e],1.3);assert.ok(a.hp>100&&z.hp>100);
});
test('Nightmare S2 source rupture is pure distance damage, never stationary DPS, and flushes the final path segment on removal',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(NIG,{skill:1,rank}),u=deploy(),e=enemy(b,{res:100});cast(b,u);advance(b,.8);
  const key=`nightmare:rupture:${u.id}`;assert.ok(e.findBuff(key));near(e.s.moveSpeed,e.base.moveSpeed*.4);
  advance(b,.5);near(e.hp,100000);e.x+=.2;advance(b,.1);near(100000-e.hp,240);
  e.x+=.1;b.removeBuff(e,key);near(100000-e.hp,360);near(e.s.moveSpeed,e.base.moveSpeed);advance(b,1);near(100000-e.hp,360);
 }
});
test('Nightmare S2 caps its source targets and retains cast lock/no-SP until the original attack clip ends',()=>{
 const{b,deploy}=make(NIG,{skill:1,rank:1}),u=deploy(),list=Array.from({length:5},(_,n)=>enemy(b,{col:3.6+n*.2}));cast(b,u);
 assert.ok(u.s.flags.disarm&&u.s.flags.noSp);u.skill.gainSp(100,'test');near(u.skill.sp,0);assert.equal(b.activateOperator(u.defId),false);
 advance(b,.8);assert.equal(list.filter(e=>e.findBuff(`nightmare:rupture:${u.id}`)).length,3);advance(b,1.05);assert.equal(Boolean(u.s.flags.disarm),false);assert.ok(u.skill.sp>0);
});
test('Nightmare brief interruptible predelay control cancels rupture even after recovery before the release event',()=>{
 const{b,deploy}=make(NIG,{skill:1}),u=deploy(),e=enemy(b);cast(b,u);advance(b,.1);b.applyStatus(u,'stun',{duration:.1});advance(b,.9);
 assert.equal(u.canAct,true);assert.equal(e.findBuff(`nightmare:rupture:${u.id}`),null);near(e.hp,100000);
 advance(b,1);assert.ok(!u.s.flags.disarm&&!u.s.flags.noSp);
});
test('Qanipalaat aura dynamically targets aerial/levitated units and preserves unrelated Arts Fragility when eligibility ends',()=>{
 for(const[elite,potential,value]of[[1,1,.1],[1,5,.12],[2,1,.2],[2,5,.22]]){
  const{b,deploy}=make(QAN,{elite,potential,rank:elite===1?7:10}),u=deploy(),e=enemy(b),air=enemy(b,{col:4.3,fly:true});advance(b,.15);
  near(e.s.artsTakenMul,1);near(air.s.artsTakenMul,1+value);b.applyStatus(e,'levitate',{duration:1,source:u});advance(b,.15);near(e.s.artsTakenMul,1+value);
  b.applyStatus(air,'artsFragile',{key:'test:other-fragile',value:.4,duration:Infinity});air.hidden=true;advance(b,.15);near(air.s.artsTakenMul,1.4);
  assert.equal(Boolean(air.findBuff(`qanipalaat:fragile:${u.id}`)),false);air.hidden=false;advance(b,.15);b.retreat(u);near(air.s.artsTakenMul,1.4);
 }
});
test('Qanipalaat S1 uses source ASPD and aerial priority while base projectiles retain speed10',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(QAN,{rank}),u=deploy(),ground=enemy(b),air=enemy(b,{col:4.3,fly:true});cast(b,u);
  near(u.s.aspd,100+bb(QAN,0,rank).attack_speed);assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],air);
  b.forceAttack(u,[ground]);u.atkCd=1000;advance(b,.3);assert.ok(ground.hp===100000);advance(b,.5);assert.ok(ground.hp<100000);
 }
});
test('Qanipalaat S2 links only two ground targets, delays pulses .5s, levitates and explodes once on original seven-second finish',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(QAN,{skill:1,rank}),u=deploy(),a=enemy(b),z=enemy(b,{col:4.3}),extra=enemy(b,{col:4.6}),air=enemy(b,{col:4.1,fly:true}),s=bb(QAN,1,rank);cast(b,u);
  advance(b,.1);assert.ok(a.s.flags.levitate&&z.s.flags.levitate);assert.equal(Boolean(extra.s.flags.levitate),false);near(a.hp,100000);advance(b,.35);near(a.hp,100000);
  advance(b,.15);near(100000-a.hp,u.s.atk*s.trigger_atk_scale*1.2);near(extra.hp,100000);near(air.hp,100000);
  let finish=0;b.on('damaged',({dmg,target})=>{if(target===air&&dmg.tags.includes('qanipalaat:finish'))finish++;});
  advance(b,6.7);assert.equal(Boolean(a.s.flags.levitate),false);assert.equal(finish,2);assert.ok(air.hp<100000);assert.equal(u.skill.active,true);
  advance(b,1);assert.equal(u.skill.active,false);assert.equal(Boolean(u.s.flags.disarm),false);
 }
});
test('Qanipalaat S2 immune levitation still receives periodic damage without a fabricated end blast',()=>{
 const{b,deploy}=make(QAN,{skill:1}),u=deploy(),e=enemy(b);e.def={...e.def,immune:new Set(['levitate'])};cast(b,u);advance(b,.1);
 assert.equal(Boolean(e.s.flags.levitate),false);advance(b,.5);near(100000-e.hp,u.s.atk*.75);let finish=0;
 b.on('damaged',({dmg})=>{if(dmg.tags.includes('qanipalaat:finish'))finish++;});advance(b,8);assert.equal(finish,0);
});
test('Qanipalaat link host death triggers the source finish area and invalidates that link without interrupting the other',()=>{
 const{b,deploy}=make(QAN,{skill:1}),u=deploy(),a=enemy(b),z=enemy(b,{col:4.3}),air=enemy(b,{col:4.1,fly:true});cast(b,u);advance(b,.2);
 const hp=air.hp;b.kill(a);assert.ok(air.hp<hp);assert.ok(z.findBuff(`qanipalaat:link:${u.id}`));advance(b,7.8);assert.equal(u.skill.active,false);
});
test('Qanipalaat seven-second link preserves the terminal half-second pulse before expiry and never pulses afterward',()=>{
 const{b,deploy}=make(QAN,{skill:1}),u=deploy(),e=enemy(b);e.def={...e.def,immune:new Set(['levitate'])};
 const pulses=[];b.on('damaged',({dmg,target})=>{if(target===e&&dmg.tags.includes('qanipalaat:periodic'))pulses.push(b.time);});
 cast(b,u);advance(b,.45);assert.equal(pulses.length,0);advance(b,6.65);assert.equal(pulses.length,14);
 near(100000-e.hp,u.s.atk*.75*14);assert.equal(Boolean(e.findBuff(`qanipalaat:link:${u.id}`)),false);
 for(let i=1;i<pulses.length;i++)near(pulses[i]-pulses[i-1],.5);
 advance(b,2);assert.equal(pulses.length,14);
});
test('Santalla delayed talent grants source ATK and Status Resistance once at20s and resets on redeployment',()=>{
 for(const[elite,potential,pct]of[[1,1,.1],[1,5,.13],[2,1,.15],[2,5,.18]]){
  const{b,deploy}=make(SAN,{elite,potential,rank:elite===1?7:10}),u=deploy(),atk=u.s.atk;advance(b,19.9);near(u.s.atk,atk);
  advance(b,.2);near(u.s.atk,atk*(1+pct));b.applyStatus(u,'stun',{duration:2});near(u.findBuff('stun').duration,1);
  b.retreat(u);b.bench[u.defId].readyAt=0;const z=deploy();near(z.s.atk,z.base.atk);assert.equal(Boolean(z.findBuff(`santalla:resist:${z.id}`)),false);
 }
});
test('Santalla normal/S1 attacks use direct source radius1.1 and retarget at release with no extra projectile delay',()=>{
 const{b,deploy}=make(SAN),u=deploy(),a=enemy(b),z=enemy(b,{col:4.3}),s=bb(SAN,0,10);b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.45);near(a.hp,100000);
 a.hidden=true;advance(b,.1);near(a.hp,100000);near(100000-z.hp,u.s.atk);assert.equal(b.projectiles.list.length,0);a.hidden=false;
 const atk=u.s.atk;cast(b,u);near(u.s.atk,atk*(1+s.atk));near(u.s.aspd,145);const hp=z.hp;strike(b,u,[z],.6);near(hp-z.hp,u.s.atk);
});
test('Santalla S2 chooses each original collider column through real seeded RNG, creates one delayed area and can hit air without duplicate main damage',()=>{
 const seen=new Set();for(let seed=1;seed<=15;seed++){
  const{b,deploy}=make(SAN,{skill:1}),u=deploy(),e=enemy(b);cast(b,u);advance(b,.55);b.rng=createRng(seed);
  b.forceAttack(u,[e]);u.atkCd=1000;const p=b.projectiles.list.at(-1);assert.ok(p);seen.add(p.tx-u.tileC);
  const ground=enemy(b,{row:p.ty,col:p.tx}),air=enemy(b,{row:p.ty,col:p.tx+.2,fly:true}),hp=ground.hp;
  advance(b,.55);near(ground.hp,hp);advance(b,.1);near(hp-ground.hp,u.s.atk*.9);near(100000-air.hp,u.s.atk*.9);assert.ok(ground.findBuff('cold'));
 }
 assert.deepEqual(seen,new Set([0,-1,1]));
});
test('Santalla S2 all ranks shorten BAT by exactly2.4s, use one original column per attack and repeated Cold creates Freeze',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(SAN,{skill:1,rank}),u=deploy(),e=enemy(b);cast(b,u);advance(b,.55);near(u.s.interval,.5);
  b.rng.int=n=>{assert.equal(n,3);return 0;};b.rng.pick=list=>list[1];const hp=e.hp;
  b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.65);near(hp-e.hp,u.s.atk*bb(SAN,1,rank)['attack@atk_scale']);
  b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.65);assert.ok(e.s.flags.freeze);advance(b,u.skill.timeLeft+.1);near(u.s.interval,u.base.bat);
 }
});
test('Santalla source ground-enemy parent trigger prevents empty-map and air-only icicles before its tile subability executes',()=>{
 const{b,deploy}=make(SAN,{skill:1}),u=deploy();cast(b,u);u.atkCd=0;advance(b,1.5);
 assert.equal(u.stats.attacks,0);assert.equal(b.projectiles.list.length,0);
 const air=enemy(b,{fly:true});advance(b,1.5);assert.equal(u.stats.attacks,0);near(air.hp,100000);
 const ground=enemy(b);advance(b,1.1);assert.ok(u.stats.attacks>0);assert.ok(b.projectiles.list.length>0);
 ground.hidden=true;const attacks=u.stats.attacks;advance(b,1.2);assert.equal(u.stats.attacks,attacks);
});
test('Santalla source BAT seconds addition composes separately with percentage and final-scaler modifiers',()=>{
 const{b,deploy}=make(SAN,{skill:1}),u=deploy();b.addBuff(u,{key:'test:bat',mods:{batPct:.2,batMul:1.5}});cast(b,u);advance(b,.55);
 near(u.s.bat,(u.base.bat+bb(SAN,1,10).base_attack_time)*1.2*1.5);
 u.skill.end('test');near(u.s.bat,u.base.bat*1.2*1.5);
});
test('Delphine stores three separate projectiles, consumes them once and S1 final BAT scale/active-mode shot scale apply at every rank',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(DEL,{rank}),u=deploy();advance(b,u.s.interval*3+.1);assert.equal(u.trait.stored,3);
  const e=enemy(b,{hp:50000}),atk=u.s.atk;near(strike(b,u,[e],.8)[0],atk*4);assert.equal(u.trait.stored,0);
  e.hidden=true;advance(b,u.s.interval*3+.1);assert.equal(u.trait.stored,3);e.hidden=false;cast(b,u);near(u.s.interval,u.base.bat*.2);
  const hp=e.hp;strike(b,u,[e],.5);near(hp-e.hp,atk*bb(DEL,0,rank)['attack@atk_scale']*4);
  advance(b,u.skill.timeLeft+.1);near(u.s.interval,u.base.bat);
 }
});
test('Delphine talent uses strict above80% and ignores S2 periodic damage, while selected S2 rejects only below50%',()=>{
 const{b,deploy}=make(DEL,{skill:1}),u=deploy(),edge=enemy(b,{hp:80000}),high=enemy(b,{hp:80001,col:4.3});
 near(strike(b,u,[edge],.8)[0],u.s.atk);near(strike(b,u,[high],.8)[0],u.s.atk*1.18);cast(b,u);advance(b,.75);
 const low=enemy(b,{hp:49999,col:3.7}),half=enemy(b,{hp:50000,col:4.1});assert.equal(effectiveProfile(u).canTarget(u,low),false);assert.equal(effectiveProfile(u).canTarget(u,half),true);
 const hp=high.hp;strike(b,u,[high],.8);const after=high.hp;advance(b,.2);near(after-high.hp,u.s.atk*.06);assert.ok(hp>after);
});
test('Delphine S2 separate stored hits each add a DOT stack, first .15s tick then one-second cadence, cap4 and cleanup at skillend',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(DEL,{skill:1,rank}),u=deploy();advance(b,u.s.interval*3+.1);const e=enemy(b,{hp:50000});cast(b,u);advance(b,.75);
  b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.733);const key=`delphine:dot:${u.id}`,dot=e.findBuff(key);assert.ok(dot);near(dot.data.scale,.24);
  const hp=e.hp;advance(b,.1);near(e.hp,hp);advance(b,.1);near(hp-e.hp,u.s.atk*.24);const h=e.hp;advance(b,.8);near(e.hp,h);advance(b,.2);near(h-e.hp,u.s.atk*.24);
  strike(b,u,[e],.8);near(e.findBuff(key).data.scale,.24);advance(b,u.skill.timeLeft+.1);assert.equal(Boolean(e.findBuff(key)),false);const end=e.hp;advance(b,2);near(e.hp,end);
 }
});
test('Delphine chapter13 E2 talent gates source Sarkaz ATK and fourth charge without granting the extra shot to ordinary enemies',()=>{
 for(const[tags,elite,extra]of[[[],2,0],[['main_12'],2,0],[['main_13'],1,0],[['main_13'],2,1]]){
  const{b,deploy}=make(DEL,{tags,elite,rank:elite===1?7:10}),u=deploy();advance(b,u.s.interval*4+.1);assert.equal(u.trait.stored,3);assert.equal(u.trait.extraStored,extra);
  const ordinary=enemy(b,{hp:50000});near(strike(b,u,[ordinary],.8)[0],u.s.atk*4);assert.equal(u.trait.extraStored,extra);
  const sarkaz=enemy(b,{hp:50000,col:4.3});sarkaz.tags=new Set(['sarkaz']);near(strike(b,u,[sarkaz],.8)[0],u.s.atk*(extra?2*1.2:1));assert.equal(u.trait.extraStored,0);
 }
});
test('source-owned utility controllers cancel pending ordinary casts/charges on control and do not leak across withdrawal',()=>{
 const{b,deploy}=make(DEL),u=deploy();advance(b,1);b.applyStatus(u,'stun',{duration:4});advance(b,4);assert.equal(u.trait.stored,0);
 const e=enemy(b);b.forceAttack(u,[e]);u.atkCd=1000;b.retreat(u);advance(b,2);near(e.hp,100000);
 const n=make(NIG,{skill:1}),q=n.deploy(),t=enemy(n.b);cast(n.b,q);n.b.applyStatus(q,'stun',{duration:2});advance(n.b,1);assert.equal(Boolean(t.findBuff(`nightmare:rupture:${q.id}`)),false);
});
