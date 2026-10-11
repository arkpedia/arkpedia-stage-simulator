// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-caster-overload-prefabs.json' with { type: 'json' };
import { FIVE_STAR_CASTER_OVERLOAD_OPERATORS } from '../shared/arkpedia/five-star-caster-overload-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { createRng } from '../server/sim/rng.js';
const TOM='char_411_tomimi',BEE='char_344_beewax',MIN='char_388_mint',LAV='char_1011_lava2',ROC='char_4040_rockr';
const near=(a,e)=>assert.ok(Math.abs(a-e)<1e-5,`${a} != ${e}`);
function advance(b,seconds){for(let n=0;n<Math.round(seconds/b.dt);n++)b.step();assert.deepEqual(b.errors,[]);}
function make(id,{skill=0,elite=2,rank=10,potential=1,others=[]}={}){
 const src=structuredClone(data),op=src.operators[id];assert.ok(op,`Reviewed snapshot required: ${id}`);
 src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 const b=new StandardBattle(src,{operators:[{...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
  potential,skillId:op.skills[skill].id,skillRank:rank},...others.map(id=>defaultBuild(src.operators[id]))]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(who=id,row=1,col=4,dir='UP')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,row,col,dir);u.atkCd=1000;return u;};
 return{b,deploy,src};
}
function enemy(b,{row=2,col=4,def=0,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});e.base.maxHp=e.hp=100000;e.base.def=def;e.base.res=res;e.markDirty();
 if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(b.activateOperator(u.defId),true);u.atkCd=1000;}
function strike(b,u,targets,seconds=1){const hp=targets.map(e=>e.hp);b.forceAttack(u,targets);u.atkCd=1000;advance(b,seconds);return targets.map((e,i)=>hp[i]-e.hp);}
function bb(id,skill,rank){const s=data.operators[id].skills[skill].levels[rank-1];return Object.fromEntries(s.blackboard.map(r=>[r.key,r.value]));}

test('durable original source records prove all ten skill bindings, token zero-slot/heal-free, physical Tomimi, animation-free Mint, and Rockrock cap-only overload',()=>{
 for(const[id,c]of Object.entries(FIVE_STAR_CASTER_OVERLOAD_OPERATORS)){
  assert.match(evidence.source.bundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  assert.ok(evidence.characters[id].length);assert.ok(evidence.models[id].Front.hits);
  for(const sid of c.skillIds)assert.ok(evidence.skills[sid==='skcom_magic_rage[3]'?'skcom_attack_speed_up':sid].length);
 }
 const token=evidence.tokens.token_10011_beewax_oblisk;
 assert.equal(token.find(x=>'_occupiedRemainingCharacterCnt'in x)._occupiedRemainingCharacterCnt,0);
 assert.equal(token.find(x=>'_useRealBornTimeFromAnim'in x)._useRealBornTimeFromAnim,1);
 assert.equal(evidence.tokenModels.token_10011_beewax_oblisk.durations.Start,1);
 assert.deepEqual(evidence.tokenModels.token_10011_beewax_oblisk.hits,{});
 assert.ok(token.some(x=>x._buffs?.some(y=>y.buffKey==='beewax_healfree')));
 const attack=evidence.characters[MIN].find(x=>x._activeBuffs?.some(y=>y.buffKey==='mint_s_2[pull]'));
 assert.equal(attack._waitForAttackEvent,0);assert.equal(attack._preDelay,0);assert.equal(attack._animKey,'');
 assert.match(JSON.stringify(evidence.templates['rockr_s_2[overload]']),/ModifyFunnelMaxAtkScaleMultiplier/);
});
test('all ten skills load every source rank with exact IDs and without inferred passive talents',()=>{
 for(const[id,c]of Object.entries(FIVE_STAR_CASTER_OVERLOAD_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,c.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
});
test('Tomimi base Arts projectile and talent physical conversion respect promotion/potential, reduced range and ground-only selection',()=>{
 for(const[elite,potential,talent]of[[0,1,.5],[0,5,.7],[1,1,.75],[1,5,.95],[2,1,1],[2,5,1.2]]){
  const{b,deploy}=make(TOM,{elite,potential,rank:[4,7,10][elite]}),u=deploy(),e=enemy(b,{def:100,res:50}),air=enemy(b,{fly:true});
  const base=u.s.atk,range=[...u.rangeKeys];near(strike(b,u,[e],.8)[0],base*.5);cast(b,u);near(u.s.atk,base*(1+talent));
  assert.equal(effectiveProfile(u).canHitFly,false);assert.equal(acquireTargets(b,u,effectiveProfile(u)).includes(air),false);
  near(strike(b,u,[e],1)[0],u.s.atk-100);assert.notDeepEqual(u.rangeKeys,range);
  advance(b,u.skill.timeLeft+.1);near(u.s.atk,base);assert.deepEqual(u.rangeKeys,range);assert.equal(effectiveProfile(u).dmgType,'arts');
 }
});
test('Tomimi S2 seeded Dice emits exactly one of AoE/ATK-scale/Stun, without double-hitting the AoE primary or reaching air targets',()=>{
 for(let rank=1;rank<=10;rank++)for(const choice of[0,1,2]){
  const{b,deploy}=make(TOM,{skill:1,rank}),u=deploy(),a=enemy(b),z=enemy(b,{col:4.3}),air=enemy(b,{col:4.2,fly:true});
  cast(b,u);b.rng.chance=()=>true;b.rng.int=n=>{assert.equal(n,3);return choice;};
  const s=bb(TOM,1,rank),amount=strike(b,u,[a],1);
  near(amount[0],u.s.atk*(choice===1?s['attack@tomimi_s_2.atk_scale']:1));
  near(100000-z.hp,choice===0?u.s.atk:0);near(air.hp,100000);assert.equal(Boolean(a.findBuff('stun')),choice===2);
  if(choice===2){advance(b,s['attack@tomimi_s_2.stun']);assert.equal(Boolean(a.findBuff('stun')),false);}
 }
});
test('Tomimi real seeded Dice reaches each of the three mutually exclusive outcomes',()=>{
 const seen=new Set();
 for(let seed=1;seed<=30;seed++){
  const{b,deploy}=make(TOM,{skill:1}),u=deploy(),a=enemy(b),z=enemy(b,{col:4.3});cast(b,u);
  b.rng=createRng(seed);b.rng.chance=()=>true;
  const damage=strike(b,u,[a],1)[0];
  if(z.hp<100000){seen.add('area');near(damage,u.s.atk);}
  else if(a.findBuff('stun')){seen.add('stun');near(damage,u.s.atk);}
  else{seen.add('scale');near(damage,u.s.atk*u.skill.bb['attack@tomimi_s_2.atk_scale']);}
 }
 assert.deepEqual(seen,new Set(['area','scale','stun']));
});
test('Tomimi S2 failed Dice stays a single normal physical hit',()=>{
 const{b,deploy}=make(TOM,{skill:1,rank:1}),u=deploy(),a=enemy(b),z=enemy(b,{col:4.3});cast(b,u);b.rng.chance=()=>false;
 near(strike(b,u,[a],1)[0],u.s.atk);near(z.hp,100000);assert.equal(Boolean(a.findBuff('stun')),false);
});
test('Phalanx idle traits suppress attacks and keep DEF/RES; Beeswax idle regen and Mint adjacent ally aura obey source elite/potential',()=>{
 for(const id of[BEE,MIN])for(const[elite,potential]of[[0,1],[1,1],[1,5],[2,1],[2,5]]){
  const{b,deploy}=make(id,{elite,potential,rank:[4,7,10][elite],others:['char_123_fang']}),u=deploy(id,2,4),a=deploy('char_123_fang',3,4);
  near(u.s.def,u.base.def*3);near(u.s.res,u.base.res+20);assert.equal(effectiveProfile(u).noAttack,true);
  near(u.s.hpRegen,id===BEE?u.s.maxHp*(elite===2?.04:elite===1?.025:0):0);
  const pct=elite===2?(potential===5?.12:.1):elite===1?(potential===5?.07:.05):0;near(a.s.def,a.base.def*(1+(id===MIN?pct:0)));
  cast(b,u);near(u.s.def,u.base.def);near(u.s.res,u.base.res);near(u.s.hpRegen,0);near(a.s.def,a.base.def);
 }
});
test('Beeswax S1 expands range, attacks all eligible ground/air enemies once after the original entrance, and restores idle traits',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(BEE,{rank}),u=deploy(),a=enemy(b),air=enemy(b,{col:4.2,fly:true}),atk=u.s.atk,s=bb(BEE,0,rank);cast(b,u);
  assert.ok(u.s.flags.disarm);near(u.s.atk,atk*(1+s.atk));advance(b,.7);assert.equal(Boolean(u.s.flags.disarm),false);
  assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,2);const p=strike(b,u,[a,air],.25);near(p[0],u.s.atk);near(p[1],u.s.atk);
  advance(b,u.skill.timeLeft+.1);assert.equal(effectiveProfile(u).noAttack,true);near(u.s.def,u.base.def*3);near(u.s.atk,atk);
 }
});
test('Beeswax S2 auto-selects a valid enemy melee tile, creates a zero-slot block3 token and one ground-only birth burst, then expires',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(BEE,{skill:1,rank}),u=deploy(),a=enemy(b,{row:3,col:4}),air=enemy(b,{row:3,col:4,fly:true}),s=bb(BEE,1,rank);b.rng.pick=list=>list[0];cast(b,u);advance(b,.8);
  const t=u.mem.obelisk;assert.ok(t);assert.equal(t.tileR,3);assert.equal(t.tileC,4);assert.equal(t.s.blockCnt,3);assert.equal(t.deploymentSlotCost,0);assert.equal(b.deployedSlots(),1);
  near(a.hp,100000);advance(b,1.05);near(100000-a.hp,u.s.atk*s.atk_scale);near(air.hp,100000);assert.ok(a.findBuff('stun'));assert.equal(effectiveProfile(t).noAttack,true);
  t.hp=100;b.addBuff(t,{key:'test:regen',mods:{hpRegen:100,hpRegenRatio:.1}});near(t.s.hpRegen,0);near(b.heal(u,t,100),0);advance(b,1);near(t.hp,100);
  advance(b,20);assert.equal(t.alive,false);assert.equal(t.deployed,false);
 }
});
test('Beeswax S2 cannot overwrite an occupied melee tile and removes the original token when its owner withdraws',()=>{
 const{b,deploy}=make(BEE,{skill:1,others:['char_123_fang']}),u=deploy(),a=deploy('char_123_fang',3,4);enemy(b,{row:3,col:4});cast(b,u);advance(b,.8);
 assert.ok(u.mem.obelisk);assert.notEqual(u.mem.obelisk.tileR*21+u.mem.obelisk.tileC,a.tileR*21+a.tileC);b.retreat(u);assert.equal(u.mem.obelisk.alive,false);
});
test('Mint S1 uses source attack scaling and expanded range at every rank; E2 active taunt is -1 without leaked idle aura',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(MIN,{rank}),u=deploy(),a=enemy(b),s=bb(MIN,0,rank);cast(b,u);advance(b,.55);near(u.s.taunt,-1);
  near(strike(b,u,[a],.3)[0],u.s.atk*s['attack@atk_scale']);advance(b,u.skill.timeLeft+.1);near(u.s.taunt,0);
 }
});
test('Mint S2 has source animation-free immediate attacks, weight-aware pulls and one end-event finisher with idle trait held until clip ends',()=>{
 const{b,deploy}=make(MIN,{skill:1}),u=deploy(),a=enemy(b,{row:3,col:4}),s=bb(MIN,1,10);cast(b,u);advance(b,.55);
 assert.equal(effectiveProfile(u).windup,0);assert.equal(effectiveProfile(u).attackVisual,'none');const before=a.y;
 near(strike(b,u,[a],.05)[0],u.s.atk*s['attack@atk_scale']);assert.ok(a.y<before);
 a.x=4;a.y=2;b._buildEnemyIndex();const hp=a.hp;advance(b,u.skill.timeLeft+.1);assert.ok(u.mem.phalanxEnding);near(u.s.def,u.base.def);near(a.hp,hp);
 advance(b,.55);near(hp-a.hp,u.s.atk*s.atk_scale);advance(b,.8);assert.equal(u.mem.phalanxEnding,false);near(u.s.def,u.base.def*3);
});
test('Lava the Purgatory talent grants first-deploy self SP, deploy SP to other casters only, and never repeats self bonus on redeploy',()=>{
 const{b,deploy}=make(LAV,{others:['char_210_stward','char_123_fang']}),a=deploy('char_210_stward',1,3),v=deploy('char_123_fang',2,7);
 const sp=a.skill.sp,vsp=v.skill.sp,u=deploy();near(a.skill.sp,sp+4);near(v.skill.sp,vsp);near(u.skill.sp,Math.min(u.skill.spCost,u.skill.def.initSp+30));
 b.retreat(a);b.bench[a.defId].readyAt=0;const z=deploy(a.defId,1,3);near(z.skill.sp,Math.min(z.skill.spCost,z.skill.def.initSp+4));
 b.retreat(u);b.bench[u.defId].readyAt=0;const r=deploy();near(r.skill.sp,r.skill.def.initSp);
});
test('Lava the Purgatory S1 extends range and fires two source AoEs, with intentional double damage in their overlap',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(LAV,{rank}),u=deploy(),a=enemy(b),z=enemy(b,{col:4.3}),s=bb(LAV,0,rank),atk=u.s.atk,range=[...u.rangeKeys];cast(b,u);
  near(u.s.atk,atk*(1+s.atk));advance(b,.05);assert.notDeepEqual(u.rangeKeys,range);assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,2);
  const output=strike(b,u,[a,z],.5);near(output[0],u.s.atk*2);near(output[1],u.s.atk*2);assert.equal(b.projectiles.list.length,0);
  advance(b,u.skill.timeLeft+.1);near(u.s.atk,atk);assert.deepEqual(u.rangeKeys,range);
 }
});
test('Lava S2 selects highest current-HP ally, follows two surrounding-8 rings with delayed 1s pulses and removes the ally ring when eligibility ends',()=>{
 const{b,deploy}=make(LAV,{skill:1,others:['char_123_fang','char_122_beagle']}),u=deploy(LAV,2,4),a=deploy('char_122_beagle',2,3),z=deploy('char_123_fang',2,5);
 a.hp=100;z.hp=200;assert.ok(a.s.maxHp>z.s.maxHp);const e=enemy(b,{row:2,col:4});cast(b,u);assert.equal(u.mem.lavaRings[1].host,z);const scale=u.s.atk*.5;
 advance(b,.9);near(e.hp,100000);advance(b,.15);near(100000-e.hp,scale*2);
 z.hidden=true;advance(b,1);near(100000-e.hp,scale*3);assert.equal(u.mem.lavaRings[1].done,true);
 b.retreat(u);const hp=e.hp;advance(b,2);near(e.hp,hp);assert.equal(Boolean(z.findBuff(`lava2:ring:${u.id}`)),false);
});
test('Lava normal and S1 reacquire their source selector at release when the original target disappears',()=>{
 for(const active of[false,true]){
  const{b,deploy}=make(LAV),u=deploy(),a=enemy(b),z=enemy(b,{row:3,col:4});if(active){cast(b,u);advance(b,.1);}
  assert.equal(effectiveProfile(u).retargetOnRelease,true);b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.2);a.hidden=true;advance(b,.4);
  near(a.hp,100000);near(100000-z.hp,u.s.atk);assert.equal(b.projectiles.list.length,0);
 }
});
test('Rockrock normal drone ramps only its hit while caster hit stays full, resets per target, and S1 ASPD scales both releases',()=>{
 const{b,deploy}=make(ROC),u=deploy(),a=enemy(b),z=enemy(b,{col:4.3}),atk=u.s.atk;
 for(let n=0;n<9;n++)near(strike(b,u,[a],.8)[0],atk*(1+Math.min(1.1,.2+n*.15)));
 near(strike(b,u,[z],.8)[0],atk*1.2);cast(b,u);near(u.s.aspd,190);near(u.s.interval,u.base.bat/1.9);
});
test('Rockrock talent stacks every source 15s, observes elite/potential maximum and resets on withdrawal',()=>{
 for(const[elite,potential,step,max]of[[0,1,0,0],[1,1,.02,3],[1,5,.03,3],[2,1,.04,4],[2,5,.05,4]]){
  const{b,deploy}=make(ROC,{elite,potential,rank:[4,7,10][elite]}),u=deploy(),atk=u.s.atk;advance(b,14.9);near(u.s.atk,atk);advance(b,.2);near(u.s.atk,atk*(1+step));
  advance(b,60);near(u.s.atk,atk*(1+step*max));b.retreat(u);b.bench[u.defId].readyAt=0;const r=deploy();near(r.s.atk,atk);
 }
});
test('Rockrock S2 persistent drone follows outside range, skips hidden periods without backlog, raises only the ramp cap in Overload and self-stuns for actual overloaded time',()=>{
 const{b,deploy}=make(ROC,{skill:1}),u=deploy(),a=enemy(b);cast(b,u);advance(b,.55);strike(b,u,[a],.4);assert.ok(u.mem.rockDrone);
 a.x=7;advance(b,2);assert.ok(a.hp<100000);a.hidden=true;advance(b,4);const hits=[];b.on('damaged',ctx=>{if(ctx.source===u&&ctx.target===a)hits.push(b.time);});a.hidden=false;advance(b,.5);assert.equal(hits.length,1);
 advance(b,Math.max(0,21.1-(40-u.skill.timeLeft)));assert.equal(u.mem.rockOverload,true);assert.equal(u.mem.rockDrone.scale>1.1,true);
 const elapsed=b.time-u.mem.rockOverloadAt;assert.equal(b.activateOperator(u.defId),true);assert.equal(u.skill.active,false);assert.equal(u.mem.rockDrone,null);
 assert.ok(u.findBuff('stun'));near(u.findBuff('stun').timeLeft,elapsed);advance(b,elapsed+.1);assert.equal(Boolean(u.findBuff('stun')),false);
});
test('Rockrock S2 cancellation before Overload never applies self-stun or retains persistent drone/ASPD',()=>{
 const{b,deploy}=make(ROC,{skill:1}),u=deploy(),a=enemy(b);cast(b,u);advance(b,.55);strike(b,u,[a],.8);assert.ok(u.mem.rockDrone);
 assert.equal(b.activateOperator(u.defId),true);assert.equal(Boolean(u.findBuff('stun')),false);assert.equal(u.mem.rockDrone,null);near(u.s.aspd,100);
});
