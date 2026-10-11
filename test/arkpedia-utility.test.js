// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-utility-prefabs.json' with {type:'json'};
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { UTILITY_OPERATORS } from '../shared/arkpedia/utility-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { battleHud } from '../shared/arkpedia/battle-hud.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function make(ids,overrides={}) {
 const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];
 const b=new StandardBattle(source,{operators:ids.map(id=>({...defaultBuild(source.operators[id]),...overrides[id]}))});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);return b;
}
function deploy(b,id,r=2,c=7,dir='RIGHT') {b.addDp('arkpedia',99);const u=b.deployOperator(id,r,c,dir);u.atkCd=1000;return u;}
function advance(b,t) {for(let i=0;i<Math.round(t/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function cast(b,u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(b.activateOperator(u.defId),true);}
function enemy(b,x=8,y=2,fly=false){const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});e.x=x;e.y=y;e.base.maxHp=100000;e.hp=100000;e.base.def=0;e.base.res=0;e.base.moveSpeed=0;e.motion=fly?'FLY':'WALK';e.markDirty();b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}

test('utility kits preserve original source hashes, components, blackboards and robot slot flags',()=>{
 for(const id of Object.keys(UTILITY_OPERATORS)){
  assert.ok(evidence.characters[id]?.length);assert.match(evidence.sourceBundles.find(v=>v.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
 }
 assert.equal(evidence.buffTemplates.frston_t_1.eventToActions.ON_TAKE_DAMAGE.some(v=>v.$type.includes('DamageFixedValueResistance')),true);
});

test('Matterhorn S2 scales talent RES instead of adding a flat percentage number and restores on expiry',()=>{
 const id='char_199_yak';const b=make([id],{[id]:{skillId:'skchr_yak_2',potential:6}}),u=deploy(b,id);
 const hp=u.s.maxHp,res=u.s.res,def=u.s.def;u.hp=hp/2;const bb=u.def.skill.bb;
 cast(b,u);near(u.s.res,res*(1+bb.magic_resistance));near(u.s.def,def+u.base.def*bb.def);near(u.hp,u.s.maxHp/2);
 advance(b,u.def.skill.duration+.1);near(u.s.res,res);near(u.s.def,def);near(u.hp,hp/2);
});

test('Matterhorn S1 gains maximum HP and timed self regeneration independently of direct healing',()=>{
 const id='char_199_yak';const b=make([id]),u=deploy(b,id);u.hp=u.s.maxHp*.1;cast(b,u);u.s;const hp=u.hp;
 b.addBuff(u,{key:'test:healFree',flags:{noHeal:true,healFree:true}});advance(b,1);near(u.hp-hp,u.def.skill.bb.hp_recovery_per_sec);
});

test('Lutonada heals only deaths of her own blocked enemies and refuses external direct healing',()=>{
 const id='char_4130_luton',b=make([id,'char_122_beagle']),u=deploy(b,id),ally=deploy(b,'char_122_beagle',2,6);
 u.hp=1;near(b.heal(ally,u,1000),0);
 const e=enemy(b);e.blockedBy=ally;b.dealDamage(ally,e,{amount:1e6,type:'true'});near(u.hp,1);
 const own=enemy(b);own.blockedBy=u;b.dealDamage(ally,own,{amount:1e6,type:'true'});near(u.hp,1+u.s.maxHp*u.def.talents[0].bb.hp_ratio);
});

test('Lutonada S2 suspends normal attacks, applies periodic Arts to ground targets and restores its profile',()=>{
 const id='char_4130_luton',b=make([id],{[id]:{skillId:'skchr_luton_2'}}),u=deploy(b,id),e=enemy(b),air=enemy(b,8,2,true);
 e.blockedBy=u;u.blocking.push(e);const hp=e.hp;cast(b,u);u.atkCd=0;
 assert.equal(effectiveProfile(u).noAttack,true);advance(b,1.9);near(e.hp,hp);advance(b,.1);
 near(e.hp,hp-u.s.atk*u.def.skill.bb.magic_atk_scale);near(air.hp,100000);assert.equal(u.stats.attacks,0);
 advance(b,u.def.skill.duration+.1);assert.equal(Boolean(effectiveProfile(u).noAttack),false);
});

test('Purestream ordinary healing applies the inner-range penalty and resistance even to full-HP skill targets',()=>{
 const id='char_385_finlpp',b=make([id,'char_122_beagle','char_500_noirc']),u=deploy(b,id,1,7,'UP');
 const inner=deploy(b,'char_122_beagle',2,7),outer=deploy(b,'char_500_noirc',3,6);inner.hp=1;outer.hp=1;
 b.forceAttack(u,[inner]);advance(b,.5);near(inner.hp,1+u.s.atk);near(b.resistOf(inner),.5);
 b.forceAttack(u,[outer]);advance(b,.7);near(outer.hp,1+u.s.atk*.8);
 inner.hp=inner.s.maxHp;cast(b,u);advance(b,.6);near(b.resistOf(inner),.5);assert.ok(outer.hp>1+u.s.atk*.8);
 advance(b,4.1);near(b.resistOf(inner),0);
});

test('Purestream S2 uses the source BAT final multiplier and randomly heals only eligible injured targets',()=>{
 const id='char_385_finlpp',b=make([id,'char_122_beagle','char_500_noirc'],{[id]:{skillId:'skchr_finlpp_2'}}),u=deploy(b,id,1,7,'UP');
 const a=deploy(b,'char_122_beagle',2,7),c=deploy(b,'char_500_noirc',3,6);a.hp=c.hp=1;cast(b,u);
 near(u.s.bat,u.base.bat*u.def.skill.bb.base_attack_time);near(u.s.interval,.342);
 const picked=new Set();for(let i=0;i<30;i++)picked.add(acquireTargets(b,u,effectiveProfile(u))[0]);assert.equal(picked.size,2);
 a.hp=a.s.maxHp;assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[c]);
 b.forceAttack(u,[c]);advance(b,.1);near(c.hp,1+u.s.atk*u.def.skill.bb['attack@heal_scale']*.8);
 advance(b,25.1);near(u.s.bat,u.base.bat);
});

test('Chestnut heals elemental injury at full HP, with a ground-only talent and no enhancement on ranged allies',()=>{
 const id='char_4041_chnut',b=make([id,'char_122_beagle','char_120_hibisc']),u=deploy(b,id,1,7,'UP');
 const g=deploy(b,'char_122_beagle',2,7),r=deploy(b,'char_120_hibisc',1,6);g.elem.neural=r.elem.neural=900;
 assert.ok(acquireTargets(b,u,effectiveProfile(u)).includes(g));b.forceAttack(u,[g]);advance(b,1.1);
 near(g.hp,g.s.maxHp);near(g.elem.neural,900-u.s.atk*.5*1.2);
 b.forceAttack(u,[r]);advance(b,1.1);near(r.elem.neural,900-u.s.atk*.5);
});

test('Chestnut S1 stores two charges, refuses empty casts and immediately enhances only the elemental heal',()=>{
 const id='char_4041_chnut',b=make([id,'char_122_beagle']),u=deploy(b,id,1,7,'UP'),a=deploy(b,'char_122_beagle',2,7);
 u.skill.gainSp(u.skill.spCost*2,'test');assert.equal(u.skill.charges,2);assert.equal(b.activateOperator(id),false);
 a.hp=1;a.elem.neural=900;assert.equal(b.activateOperator(id),true);assert.equal(u.skill.charges,1);advance(b,.5);
 near(a.hp,1+u.s.atk);near(a.elem.neural,900-u.s.atk*.5*1.2*3);assert.equal(u.skill.pending,false);
});

test('Chestnut S2 boosts consecutive healing, resets on a target change and restores normal range at expiry',()=>{
 const id='char_4041_chnut',b=make([id,'char_122_beagle','char_500_noirc'],{[id]:{skillId:'skchr_chnut_2'}}),u=deploy(b,id,1,7,'UP');
 const a=deploy(b,'char_122_beagle',2,7),other=deploy(b,'char_500_noirc',2,6);a.hp=other.hp=1;
 const range=[...u.rangeKeys];cast(b,u);assert.notDeepEqual(u.rangeKeys,range);const scale=u.def.skill.bb['attack@heal_continuously_scale'];
 b.forceAttack(u,[a]);advance(b,.9);near(a.hp,1+u.s.atk);
 const hp=a.hp;b.forceAttack(u,[a]);advance(b,.9);near(a.hp-hp,u.s.atk*scale);
 b.forceAttack(u,[other]);advance(b,1.1);near(other.hp,1+u.s.atk);advance(b,u.def.skill.duration+.1);
 assert.deepEqual(u.rangeKeys,range);assert.equal(u.mem.chestnutPrevious,null);
});

test('robots deploy into a full deployment limit without consuming slots; DP, tile validity and cooldown still apply',()=>{
 const robots=Object.entries(UTILITY_OPERATORS).filter(([,r])=>r.deploymentSlotCost===0).map(([id])=>id);
 const b=make(['char_122_beagle',...robots]);b.unitLimit=1;deploy(b,'char_122_beagle');
 assert.equal(b.deployedSlots(),1);for(const id of robots)assert.equal(b.placementError(id,2,2),id==='char_285_medic2'||id==='char_4000_jnight'?'Choose a ranged tile.':null);
 const lancet=deploy(b,'char_285_medic2',1,7);assert.equal(skillHud(lancet.skill),null);
 assert.equal(battleHud(b,false).slots,0);assert.equal(battleHud(b,false).deployed,2);
 b.retreatOperator(lancet.defId);assert.equal(b.placementError(lancet.defId,1,7),'Operator is still redeploying.');
 const castle=deploy(b,'char_286_cast3',2,2);assert.equal(b.deployedSlots(),1);
 b.retreatOperator(castle.defId);b.getPlayer('arkpedia').dp=0;assert.equal(b.placementError('char_376_therex',2,2),'Not enough DP.');
});

test('Lancet deployment heals globally once, uses potential-specific value, and respects unhealable recipients',()=>{
 const id='char_285_medic2',b=make([id,'char_122_beagle','char_4130_luton'],{[id]:{potential:6}});
 const a=deploy(b,'char_122_beagle'),unhealable=deploy(b,'char_4130_luton',2,2);a.hp=unhealable.hp=1;
 deploy(b,id,1,7);near(a.hp,501);near(unhealable.hp,1);advance(b,1);near(a.hp,501);
});

test('Castle buff covers existing and late ground units but excludes ranged units and ends with the source',()=>{
 const id='char_286_cast3',b=make([id,'char_122_beagle','char_500_noirc','char_120_hibisc']);
 const a=deploy(b,'char_122_beagle'),r=deploy(b,'char_120_hibisc',1,7),rAtk=r.s.atk,u=deploy(b,id,2,2);
 near(a.s.atk,a.base.atk*1.1);near(r.s.atk,rAtk);const late=deploy(b,'char_500_noirc',2,6);near(late.s.atk,late.base.atk*1.1);
 b.retreatOperator(id);near(a.s.atk,a.base.atk);near(late.s.atk,late.base.atk);
});

test('Justice air Fragile and ranged taunt aura track entry, exit and expiry without erasing stronger named effects',()=>{
 const id='char_4000_jnight',b=make([id,'char_120_hibisc','char_122_beagle']);
 const ally=deploy(b,'char_120_hibisc',1,6),ground=deploy(b,'char_122_beagle',2,7),u=deploy(b,id,1,7,'UP');
 const air=enemy(b,7,2,true),e=enemy(b,7,2);advance(b,.1);near(air.s.dmgTakenMul,1.1);near(e.s.dmgTakenMul,1);near(ground.s.taunt,ground.base.tauntLevel);near(ally.s.taunt,ally.base.tauntLevel-1);
 b.applyStatus(air,'fragile',{duration:20,value:.3});near(air.s.dmgTakenMul,1.3);air.x=1;advance(b,.1);near(air.s.dmgTakenMul,1.3);
 b.removeStatus(air,'fragile');near(air.s.dmgTakenMul,1);air.x=7;advance(b,.1);near(air.s.dmgTakenMul,1.1);
 b.retreatOperator(id);near(air.s.dmgTakenMul,1);near(ally.s.taunt,ally.base.tauntLevel);
});

test('Friston duration aura grants flat HP-damage resistance to nearby late arrivals and cleans it up',()=>{
 const id='char_4093_frston',b=make([id,'char_122_beagle','char_500_noirc']),a=deploy(b,'char_122_beagle'),u=deploy(b,id,2,6);
 near(a.s.flatDamageResistance,50);const late=deploy(b,'char_500_noirc',3,6);near(late.s.flatDamageResistance,50);
 const e=enemy(b);near(b.dealDamage(e,a,{amount:100,type:'true'}),50);near(b.dealDamage(e,a,{amount:40,type:'true'}),0);
 advance(b,10.1);near(a.s.flatDamageResistance,0);near(late.s.flatDamageResistance,0);
});

test('THRM-EX does not attack, explodes after three seconds against ground and air, applies Fragile after damage and retreats',()=>{
 const id='char_376_therex',b=make([id]),u=deploy(b,id),e=enemy(b),air=enemy(b,8,2,true);u.atkCd=0;
 const hp=e.hp;advance(b,2.9);near(e.hp,hp);assert.equal(u.stats.attacks,0);advance(b,.2);
 near(hp-e.hp,u.s.atk*3);near(100000-air.hp,u.s.atk*3);near(e.s.dmgTakenMul,1.1);assert.equal(u.alive,false);
 assert.ok(b.bench[id].readyAt>=3+u.base.respawnTime && b.bench[id].readyAt<=b.time+u.base.respawnTime);advance(b,8.1);near(e.s.dmgTakenMul,1);
});

test('CONFESS first block generates DP and sleep exactly once per deployment and never changes its printed deployment cost',()=>{
 const id='char_4188_confes',b=make([id],{[id]:{potential:6}}),u=deploy(b,id);near(u.base.cost,3);
 const e=enemy(b);b.getPlayer('arkpedia').dp=20;b.emit('blocked',{blocker:u,enemy:e});near(b.dp,24);assert.equal(e.s.flags.sleep,true);
 const other=enemy(b);b.emit('blocked',{blocker:u,enemy:other});near(b.dp,24);assert.equal(Boolean(other.s.flags.sleep),false);
 advance(b,8.1);assert.equal(Boolean(e.s.flags.sleep),false);
});

test('robot advanced selectors reject unhealable or unselectable recipients; retained Friston effects survive range departure',()=>{
 const b=make(['char_4093_frston','char_286_cast3','char_4130_luton','char_122_beagle','char_500_noirc']);
 const unhealable=deploy(b,'char_4130_luton',2,7),a=deploy(b,'char_122_beagle',3,6),u=deploy(b,'char_4093_frston',2,6);
 near(unhealable.s.flatDamageResistance,0);near(a.s.flatDamageResistance,50);
 a.tileC=1;a.x=1;advance(b,.1);near(a.s.flatDamageResistance,50);
 const late=deploy(b,'char_500_noirc',2,5);near(late.s.flatDamageResistance,50);
 const castle=deploy(b,'char_286_cast3',2,2);near(a.s.atk,a.base.atk*1.1);
 b.addBuff(a,{key:'test:untargetable',flags:{untargetable:true}});advance(b,.1);near(a.s.atk,a.base.atk);
 b.removeBuff(a,'test:untargetable');advance(b,.1);near(a.s.atk,a.base.atk*1.1);
 b.retreatOperator(castle.defId);b.retreatOperator(u.defId);near(a.s.flatDamageResistance,0);
});

test('source healing projectiles land after release and flight; instant casts do not inherit the flight path',()=>{
 const id='char_4041_chnut',b=make([id,'char_122_beagle']),u=deploy(b,id,1,7,'UP'),a=deploy(b,'char_122_beagle',2,7);a.hp=1;
 b.forceAttack(u,[a]);advance(b,.9);near(a.hp,1);assert.equal(b.projectiles.list.length,1);advance(b,.2);near(a.hp,1+u.s.atk);
 a.hp=1;cast(b,u);advance(b,.5);near(a.hp,1+u.s.atk);assert.equal(b.projectiles.list.length,0);
});
