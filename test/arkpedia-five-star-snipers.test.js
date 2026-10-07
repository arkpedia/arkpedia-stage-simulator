// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-sniper-prefabs.json' with { type: 'json' };
import { FIVE_STAR_SNIPER_OPERATORS } from '../shared/arkpedia/five-star-sniper-operators.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const BLUE='char_129_bluep',PLAT='char_204_platnm',METEO='char_219_meteo',PROVE='char_145_prove',CUTTLE='char_218_cuttle';
const near=(a,e)=>assert.ok(Math.abs(a-e)<1e-5,`${a} != ${e}`);
function make(ids, overrides={}){
  const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  const b=new StandardBattle(d,{operators:ids.map(id=>({...defaultBuild(d.operators[id]),...overrides[id]}))});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');return b;
}
function deploy(b,id,r=1,c=7){b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(id,r,c,'UP');assert.ok(u);u.atkCd=1000;return u;}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function enemy(b,x=7,y=2,hp=100000){const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});
 e.x=x;e.y=y;e.base.maxHp=hp;e.base.def=e.base.res=e.base.moveSpeed=0;e.markDirty();void e.s;e.hp=hp;
 b.addBuff(e,{key:'pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
function cast(u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(u.skill.activate('test'),true);}
function attack(b,u,e,time=1){const hp=e.hp;b.forceAttack(u,[e]);advance(b,time);return hp-e.hp;}

test('five snipers keep original source hashes, radius colliders, every rank and false fidelity claim',()=>{
  assert.equal(evidence.sourceVersion,'26-09-23-17-49-43_b9cc4a');
  assert.ok(evidence.colliders.some(c=>c.group==='projectile_meteo_s1'&&c.data.m_Radius===2));
  for(const [id,config]of Object.entries(FIVE_STAR_SNIPER_OPERATORS)){
    assert.match(evidence.sourceBundles.find(s=>s.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
    assert.ok(evidence.models[id].front.hits.Attack[0]>0);
    for(const skillId of config.skillIds)for(let skillRank=1;skillRank<=10;skillRank++){
      const b=make([id],{[id]:{skillId,skillRank}}),u=deploy(b,id);
      assert.equal(u.skill.noSkill,false);assert.equal(u.skill.id,skillId);near(u.skill.spCost,u.def.skill.spCost);
    }
  }
});
test('Blue Poison prioritizes flyers and S1 damages two separate targets with the source ATK scale',()=>{
  const b=make([BLUE]),u=deploy(b,BLUE),a=enemy(b),f=enemy(b,7.2,2);
  f.motion='FLY';b._buildEnemyIndex();
  assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],f);
  cast(u);b.forceAttack(u,acquireTargets(b,u,effectiveProfile(u)));advance(b,.8);
  near(100000-a.hp,u.s.atk*2);near(100000-f.hp,u.s.atk*2);
});
test('Blue Poison S1 uses uncapped animation speed; ordinary attacks retain source cap',()=>{
  const b=make([BLUE]),u=deploy(b,BLUE);b.addBuff(u,{key:'speed',mods:{aspd:100}});
  near(effectiveProfile(u).windup(b,u),.5);cast(u);near(effectiveProfile(u).windup(b,u),.25);
});
test('Blue Poison repeated hits refresh expiry while retaining the first one-second poison tick',()=>{
  const b=make([BLUE],{[BLUE]:{skillId:'skchr_bluep_2'}}),u=deploy(b,BLUE),e=enemy(b);
  let poison=0;b.on('damaged',({target,dmg,amount})=>{if(target===e&&dmg.tags.includes('poison'))poison+=amount;});
  cast(u);attack(b,u,e,.7);assert.equal(poison,0);advance(b,.95);
  near(poison,75);advance(b,2.4);near(poison,225);assert.equal(e.buffs.some(v=>v.key.startsWith('blue-poison:')),false);
});
test('Blue Poison S2 repeats only the first selected target and respects withdrawal before the extra release',()=>{
  const b=make([BLUE],{[BLUE]:{skillId:'skchr_bluep_2'}}),u=deploy(b,BLUE),e=enemy(b),f=enemy(b,7.2,2),g=enemy(b,7.4,2);
  cast(u);b.forceAttack(u,[e,f,g]);advance(b,.9);
  near(100000-e.hp,u.s.atk*2);near(100000-f.hp,u.s.atk);near(100000-g.hp,u.s.atk);
  const c=make([BLUE],{[BLUE]:{skillId:'skchr_bluep_2'}}),v=deploy(c,BLUE),t=enemy(c);
  cast(v);c.forceAttack(v,[t]);advance(c,.55);c.retreatOperator(BLUE);advance(c,.4);
  near(100000-t.hp,v.s.atk);
});
test('Blue Poison poison applies on a dodged shot and the attached periodic damage cannot be dodged',()=>{
  const b=make([BLUE]),u=deploy(b,BLUE),e=enemy(b);
  b.addBuff(e,{key:'evasion',mods:{dodgePhys:1,dodgeArts:1}});b.rng.chance=()=>true;
  b.forceAttack(u,[e]);advance(b,.8);near(e.hp,100000);
  assert.ok(e.buffs.some(v=>v.key.startsWith('blue-poison:')));advance(b,1);near(100000-e.hp,75);
});
test('Platinum talent scales damage with release interval and returns to maximum after a long idle',()=>{
  const b=make([PLAT]),u=deploy(b,PLAT),e=enemy(b);
  near(attack(b,u,e,.9),u.s.atk*1.8);
  u.mem.platinumLastRelease=b.time+.5;near(attack(b,u,e,.9),u.s.atk);
  advance(b,3);near(attack(b,u,e,.9),u.s.atk*1.8);
});
test('Platinum S2 waits for SP, permanently changes source range/ATK/ASPD, and resets on retreat',()=>{
  const b=make([PLAT],{[PLAT]:{skillId:'skchr_platnm_2'}}),u=deploy(b,PLAT),atk=u.s.atk,range=u.rangeKeys.slice();
  cast(u);assert.equal(u.skill.kind,'toggle');near(u.s.atk,atk*2);near(u.s.aspd,u.base.aspd-20);
  assert.ok(u.rangeKeys.length>range.length);advance(b,50);assert.equal(u.skill.active,true);
  b.retreatOperator(PLAT);advance(b,80);const v=deploy(b,PLAT);assert.equal(v.skill.active,false);near(v.s.atk,atk);
});
test('Meteorite S1 uses its larger original radius and rolls additive ATK once for all splash victims',()=>{
  const b=make([METEO]),u=deploy(b,METEO),main=enemy(b),nearby=enemy(b,8.8,2),far=enemy(b,7,5);
  b.rng.chance=()=>true;cast(u);attack(b,u,main,1.3);
  near(100000-main.hp,u.s.atk*1.6*2.15);near(100000-nearby.hp,u.s.atk*1.6*2.15);near(far.hp,100000);
});
test('Meteorite S2 manual cast launches once, holds SP/normal attacks through the clip and debuff expires',()=>{
  const b=make([METEO],{[METEO]:{skillId:'skchr_meteo_2'}}),u=deploy(b,METEO),e=enemy(b);
  b.rng.chance=()=>false;e.base.def=500;e.markDirty();u.atkCd=0;cast(u);advance(b,.7);
  assert.equal(u.skill.active,true);near(u.skill.spTotal,0);near(e.s.def,170);
  near(100000-e.hp,u.s.atk*3-170);
  const hp=e.hp;advance(b,.3);near(e.hp,hp);assert.equal(u.skill.active,true);
  advance(b,.1);assert.equal(u.skill.active,false);assert.ok(u.skill.spTotal>0);
  u.atkCd=1000;advance(b,10);near(e.s.def,500);
});
test('Meteorite source radius still lands when the primary turns untargetable in flight',()=>{
  const b=make([METEO]),u=deploy(b,METEO),main=enemy(b),other=enemy(b,7.5,2);
  b.rng.chance=()=>false;cast(u);b.forceAttack(u,[main]);advance(b,.43);
  b.addBuff(main,{key:'hide',flags:{untargetable:true}});advance(b,1);
  near(main.hp,100000);near(100000-other.hp,u.s.atk*2.15);assert.equal(u.skill.active,false);
});
test('Meteorite finishes a dead-target splash cast and a no-target manual cast without a locked skill',()=>{
  const b=make([METEO]),u=deploy(b,METEO),e=enemy(b);cast(u);b.forceAttack(u,[e]);advance(b,.43);b.kill(e);advance(b,1);
  assert.equal(u.skill.active,false);
  const c=make([METEO],{[METEO]:{skillId:'skchr_meteo_2'}}),v=deploy(c,METEO);cast(v);assert.equal(v.skill.active,false);
});
test('Provence S1 applies the current-HP slope before mitigation; front-tile talent uses its stronger probability',()=>{
  const b=make([PROVE]),u=deploy(b,PROVE),e=enemy(b);b.rng.chance=()=>false;e.hp=50000;
  near(attack(b,u,e,.8),u.s.atk*(1+.5/.2*.25));
  e.hp=100000;b.rng.chance=p=>.3<p;near(attack(b,u,e,.8),u.s.atk*1.8);
  e.x=7.9;e.hp=100000;b._buildEnemyIndex();near(attack(b,u,e,.8),u.s.atk);
});
test('Provence S2 rejects healthy targets but does not discard a fired shot when HP rises',()=>{
  const b=make([PROVE],{[PROVE]:{skillId:'skchr_prove_2'}}),u=deploy(b,PROVE),e=enemy(b);b.rng.chance=()=>false;cast(u);
  assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,0);
  e.hp=80000;assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],e);
  b.forceAttack(u,[e]);advance(b,.45);e.hp=100000;advance(b,.2);near(100000-e.hp,u.s.atk);
});
test('Andreana squad talent buffs Abyssal Hunters on the bench and herself without affecting unrelated operators',()=>{
  const specter='char_143_ghost',plain=make([specter,BLUE]),b=make([CUTTLE,specter,BLUE]);
  near(b.data.getChess(specter).stats.aspd,plain.data.getChess(specter).stats.aspd+12);
  near(b.data.getChess(BLUE).stats.aspd,plain.data.getChess(BLUE).stats.aspd);
  const u=deploy(b,CUTTLE);near(u.s.aspd,u.base.aspd);assert.ok(u.s.aspd>=112);
});
test('Andreana selects the lowest-DEF eligible target and S2 stops selecting enemies below half HP',()=>{
  const b=make([CUTTLE],{[CUTTLE]:{skillId:'skchr_cuttle_2'}}),u=deploy(b,CUTTLE),a=enemy(b),low=enemy(b,7.3,2);
  a.base.def=500;low.base.def=10;a.markDirty();low.markDirty();b._buildEnemyIndex();
  assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],low);cast(u);
  low.hp=49999;assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],a);
  low.hp=50000;assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],low);
  low.base.moveSpeed=1;low.markDirty();attack(b,u,low,1);near(low.s.moveSpeed,.6);advance(b,6.1);near(low.s.moveSpeed,1);
});
