// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';

const near = (a,b,tolerance=1e-6) => assert.ok(Math.abs(a-b)<tolerance, `${a} != ${b}`);
function make(ids, overrides={}) {
  const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];
  const builds=ids.map(id=>({...defaultBuild(source.operators[id]),...overrides[id]}));
  const b=new StandardBattle(source,{operators:builds});b.autoFinish=false;
  b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
  return {b,source,builds};
}
function deploy(b,id,row,col,dir='RIGHT') { b.addDp('arkpedia',99);return b.deployOperator(id,row,col,dir); }
function advance(b,seconds) {for(let i=0;i<Math.round(seconds/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function activate(b,u) {u.skill.gainSp(u.skill.spCost,'test');assert.equal(b.activateOperator(u.defId),true);}

test('Myrrh deployment heals globally exactly once, includes self, and respects direct-heal restrictions',()=>{
  for (const [elite,potential,scale] of [[0,1,0],[1,1,1],[2,6,1.6]]) {
    const {b}=make(['char_117_myrrh','char_289_gyuki','char_122_beagle'],{
      char_117_myrrh:{elite,level:1,skillRank:1,potential}});
    const ally=deploy(b,'char_289_gyuki',2,2),other=deploy(b,'char_122_beagle',2,7);
    ally.hp=1;other.hp=1;b.addBuff(other,{key:'test:noheal',flags:{noHeal:true}});
    const u=deploy(b,'char_117_myrrh',1,7);u.atkCd=100;
    const expected=1+u.s.atk*scale;near(ally.hp,expected);near(other.hp,1);
    advance(b,1);near(ally.hp,expected);near(u.hp,u.s.maxHp);
  }
});

test('Myrrh S1 stores source charges and heals two distinct injured allies with scaled next heal',()=>{
  const id='char_117_myrrh';const {b}=make([id,'char_289_gyuki','char_500_noirc','char_122_beagle']);
  const u=deploy(b,id,1,7,'UP');u.atkCd=100;
  const allies=[deploy(b,'char_289_gyuki',2,6),deploy(b,'char_500_noirc',2,7),deploy(b,'char_122_beagle',3,7)];
  for(const ally of allies){ally.hp=1;ally.atkCd=100;}
  u.skill.gainSp(24,'test');assert.equal(u.skill.charges,3);
  assert.equal(b.activateOperator(id),false,'automatic skill is not manually activated');
  assert.equal(u.skill.activate('test'),true);assert.equal(u.skill.pending,true);
  const targets=acquireTargets(b,u,effectiveProfile(u));assert.equal(targets.length,2);
  b.forceAttack(u,targets);advance(b,1);
  for(const ally of targets)near(ally.hp,1+u.s.atk*1.25);
  const untouched=allies.find(a=>!targets.includes(a));near(untouched.hp,1);
  assert.equal(u.skill.charges,2);assert.equal(u.skill.pending,false);
  assert.equal(new Set(targets).size,2);
});

test('Myrrh S2 heals two during its duration and returns to one target afterwards',()=>{
  const id='char_117_myrrh';const {b}=make([id,'char_289_gyuki','char_500_noirc','char_122_beagle'],{
    [id]:{skillId:'skchr_myrrh_2'}});
  const u=deploy(b,id,1,7,'UP');u.atkCd=100;
  for(const [id,row,col] of [['char_289_gyuki',2,6],['char_500_noirc',2,7],['char_122_beagle',3,7]]){
    const ally=deploy(b,id,row,col);ally.hp=1;ally.atkCd=100;
  }
  assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);activate(b,u);
  near(u.s.atk,u.base.atk*1.65);assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,2);
  advance(b,25.1);near(u.s.atk,u.base.atk);assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);
});

test('Gavial buffs only medics present on deployment with percentage ATK and flat DEF; the timed buff survives her retreat',()=>{
  const id='char_187_ccheal';const {b}=make([id,'char_117_myrrh','char_120_hibisc','char_289_gyuki'],{[id]:{potential:6}});
  const medic=deploy(b,'char_117_myrrh',1,6),guard=deploy(b,'char_289_gyuki',2,7);
  const u=deploy(b,id,1,7);near(medic.s.atk,medic.base.atk*1.12);near(medic.s.def,medic.base.def+120);
  near(u.s.atk,u.base.atk*1.12);near(guard.s.atk,guard.base.atk);
  const late=deploy(b,'char_120_hibisc',1,5);near(late.s.atk,late.base.atk*1.08);
  b.retreatOperator(id);near(medic.s.def,medic.base.def+120);
  advance(b,17.1);near(medic.s.atk,medic.base.atk);near(medic.s.def,medic.base.def);
});

test('Gavial S1 retains the normal heal, applies source ATK snapshot ticks, rechecks low HP, and refreshes without stacking',()=>{
  const id='char_187_ccheal';const {b}=make([id,'char_289_gyuki']);
  const u=deploy(b,id,1,7,'UP'),ally=deploy(b,'char_289_gyuki',2,7);u.atkCd=100;ally.atkCd=100;
  advance(b,15.1);const attack=u.s.atk;ally.hp=1;
  u.skill.gainSp(24,'test');assert.equal(u.skill.activate('test'),true);
  b.forceAttack(u,[ally]);advance(b,.5);near(ally.hp,1+attack);
  const before=ally.hp;advance(b,.5);near(ally.hp-before,attack*.7);
  ally.hp=ally.s.maxHp*.75;const high=ally.hp;advance(b,1);near(ally.hp-high,attack*.35);
  assert.equal(u.skill.activate('test'),true);b.forceAttack(u,[ally]);advance(b,.5);
  assert.equal(ally.buffs.filter(buff=>buff.key.startsWith('gavial:restoration')).length,1);
  // Skill ATK is snapshotted: later source modifiers must not change existing ticks.
  b.addBuff(u,{key:'test:atk',mods:{atkPct:1}});const amount=ally.hp;
  advance(b,1);near(ally.hp-amount,attack*.35);
  advance(b,5.1);const ended=ally.hp;advance(b,1);near(ally.hp,ended);
});

test('Gavial S2 applies once to every in-range ally, including full-HP targets, and persists after retreat',()=>{
  const id='char_187_ccheal';const {b}=make([id,'char_289_gyuki','char_500_noirc','char_122_beagle'],{[id]:{skillId:'skchr_ccheal_2'}});
  const u=deploy(b,id,1,7,'UP'),nearby=deploy(b,'char_289_gyuki',2,7),full=deploy(b,'char_500_noirc',2,6),far=deploy(b,'char_122_beagle',2,2);
  u.atkCd=100;nearby.hp=1;far.hp=1;const attack=u.s.atk;activate(b,u);
  near(nearby.hp,1);assert.equal(u.skill.pending,false);assert.equal(u.skill.active,false);
  full.hp=1;b.retreatOperator(id);advance(b,1);
  near(nearby.hp,1+attack*.8);near(full.hp,1+attack*.8);near(far.hp,1);
  advance(b,10);assert.equal(nearby.buffs.some(buff=>buff.key.startsWith('gavial:restoration')),false);
});

test('Perfumer heals three allies; global regeneration follows skill ATK and reaches allies immune to direct healing',()=>{
  const id='char_181_flower';const {b}=make([id,'char_289_gyuki','char_500_noirc','char_122_beagle'],{[id]:{skillId:'skchr_flower_2',potential:6}});
  const u=deploy(b,id,1,7,'UP');u.atkCd=100;
  const allies=[deploy(b,'char_289_gyuki',2,7),deploy(b,'char_500_noirc',2,6),deploy(b,'char_122_beagle',3,7)];
  for(const ally of allies){ally.hp=1;ally.atkCd=100;}
  assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,3);
  const protectedAlly=allies[0];b.addBuff(protectedAlly,{key:'test:healfree',flags:{noHeal:true,healFree:true}});
  assert.equal(b.heal(u,protectedAlly,100),0);near(protectedAlly.s.hpRegen,u.s.atk*.055);
  advance(b,1);assert.ok(protectedAlly.hp>1);const normal=u.s.atk;
  activate(b,u);near(u.s.atk,normal*3.5);near(u.s.aspd,u.base.aspd-50);near(protectedAlly.s.hpRegen,u.s.atk*.055);
  advance(b,30.1);near(u.s.atk,normal);near(u.s.aspd,u.base.aspd);near(protectedAlly.s.hpRegen,normal*.055);
  b.retreatOperator(id);near(protectedAlly.s.hpRegen,0);const before=protectedAlly.hp;advance(b,1);near(protectedAlly.hp,before);
});

test('Sussurro squad talent enhances low-cost direct heals without altering DP cost or regeneration, even undeployed',()=>{
  const id='char_298_susuro';
  for(const [elite,potential,scale] of [[0,1,1],[1,1,1.1],[2,6,1.23]]){
    const {b,source,builds}=make([id,'char_502_nblade','char_289_gyuki'],{[id]:{elite,level:1,skillRank:1,potential}});
    assert.equal(b.bench[id].unit,null);const low=deploy(b,'char_502_nblade',2,7),high=deploy(b,'char_289_gyuki',2,6);
    low.hp=1;high.hp=1;near(b.heal(high,low,100),100*scale);near(b.heal(low,high,100),100);
    low.hp=1;near(b.heal(low,low,100,{self:true,regen:true}),100);
    const record=recordFor(builds[0],source);near(record.stats.cost,source.operators[id].phases[elite].attributesKeyFrames[0].data.cost
      +(potential===6?-2:0));
  }
});

test('Sussurro S2 permits exactly two activations across the entire battle, including retreat and redeployment',()=>{
  const id='char_298_susuro';const {b}=make([id],{[id]:{skillId:'skchr_susuro_2'}});
  const u=deploy(b,id,1,7);activate(b,u);near(u.s.atk,u.base.atk*2);near(u.s.aspd,u.base.aspd+100);
  advance(b,30.1);b.retreatOperator(id);advance(b,70.1);
  const next=deploy(b,id,1,7);assert.equal(next.skill.remainingUses,1);activate(b,next);
  assert.equal(next.skill.remainingUses,0);assert.equal(next.skill.exhausted,true);
  assert.equal(skillHud(next.skill).state,'active','last cast still shows active duration');
  advance(b,30.1);next.skill.gainSp(99,'test');assert.equal(next.skill.ready,false);
  assert.equal(next.skill.castEligible,false);assert.equal(skillHud(next.skill).canActivate,false);
  assert.equal(b.activateOperator(id),false);assert.equal(next.skill.activate('test',{free:true}),false);
  assert.match(skillHud(next.skill).text,/No skill uses remaining/);
  b.retreatOperator(id);advance(b,70.1);const last=deploy(b,id,1,7);last.skill.gainSp(99,'test');
  assert.equal(b.activateOperator(id),false);assert.equal(last.skill.remainingUses,0);
});
