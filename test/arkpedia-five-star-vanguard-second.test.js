// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-vanguard-second-prefabs.json' with { type: 'json' };
import { FIVE_STAR_VANGUARD_SECOND_OPERATORS } from '../shared/arkpedia/five-star-vanguard-second-operators.js';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { enemyStealthed } from '../server/sim/targeting.js';
const G='char_220_grani',E='char_401_elysm',W='char_496_wildmn',K='char_4023_rfalcn';
const F='char_123_fang',M='char_208_melan',D='char_122_beagle',S='char_124_kroos';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
function build(id,{skill=0,rank=10,elite=2,potential=1}={}){const o=data.operators[id];assert.ok(o,`Reviewed snapshot required: ${id}`);return{...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:rank};}
function make(id,opts={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const b=new StandardBattle(d,{operators:[build(id,opts),...(opts.others??[]).map(o=>typeof o==='string'?defaultBuild(d.operators[o]):o)]});
 b.autoFinish=false;b.timeLimit=Infinity;b.setViewport('fullscreen-workspace');
 const deploy=(who=id,r=2,c=7,dir='RIGHT')=>{b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(who,r,c,dir);assert.ok(u);u.atkCd=1000;b.getPlayer('arkpedia').dp=0;return u;};return{b,deploy};
}
const advance=(b,s)=>{for(let n=0;n<Math.round(s/b.dt);n++)b.step();assert.deepEqual(b.errors,[]);};
function cast(b,u){u.skill.gainSp(u.skill.spCost*u.skill.maxCharges,'test');assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);u.atkCd=1000;}
function enemy(b,x=8,y=2,{flying=false,def=0}={}){const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});e.x=x;e.y=y;e.base.maxHp=e.hp=100000;e.base.def=def;e.base.res=e.base.moveSpeed=0;if(flying)e.motion='FLY';e.markDirty();b.addBuff(e,{key:'pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
const nodes=(rows)=>rows.flatMap(r=>r.components);
const bb=(id,skill,rank=10)=>Object.fromEntries(data.operators[id].skills[skill].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
function redeployReady(b,id){b.retreatOperator(id);b.bench[id].readyAt=b.time;}

test('four complete vanguard kits retain original hashes, card lifetimes, buff formulas and historical Fang investigation',()=>{
 assert.equal(Object.keys(FIVE_STAR_VANGUARD_SECOND_OPERATORS).length,4);assert.equal(REGULAR_OPERATORS.char_1036_fang2.mechanic,'fang-fire-sharpened');
 assert.match(evidence.deferredOperators.char_1036_fang2.reason,/runtime_cost/);
 for(const id of [...Object.keys(FIVE_STAR_VANGUARD_SECOND_OPERATORS),'char_1036_fang2']){
  assert.match(evidence.source.bundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  for(const facing of['Front','Back']){assert.match(evidence.models[id][facing].sha256,/^[a-f0-9]{64}$/);assert.ok(Object.values(evidence.models[id][facing].hits).some(v=>v[0]>0));}
 }
 assert.equal(evidence.templates.modify_deck_cost_for_sniper.eventToActions.ON_BUFF_START[0]._lifeType,'HOLD_BY_BUFF');
 const wild=evidence.templates.wildmn_t_1.eventToActions.ON_BUFF_START[0];assert.equal(wild._succeedNodes[0]._checkBuildCnt,1);assert.equal(wild._failNodes[0]._lifeType,'UNTIL_NEXT_SPAWN');assert.equal(wild._failNodes[0]._filterIsInHand,true);
 assert.equal(nodes(evidence.skills.skchr_elysm_2).find(x=>x.pathId==='7049696127201179292')._ignoreTargetFree,1);
 assert.equal(evidence.templates['knockback[dir]'].eventToActions.ON_BUFF_START[0]._decreaseForceLevelWhenNotInDirection,2);
 assert.equal(Object.keys(evidence.templates.rfalcn_t_1.eventToActions)[0],'ON_CALCULATE_DAMAGE');assert.equal(evidence.frameParity,false);
});

test('every selected skill rank and elite/potential variant loads an owned complete skill',()=>{
 for(const[id,cfg]of Object.entries(FIVE_STAR_VANGUARD_SECOND_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,cfg.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
});

test('original normal releases respect facing OnAttack and native animation scaling caps',()=>{
 for(const id of[G,E,W,K])for(const dir of['RIGHT','UP']){
  const{b,deploy}=make(id,{skill:id===W?1:0}),u=deploy(id,2,7,dir),e=enemy(b);
  b.addBuff(u,{key:'test:ASPD',mods:{aspd:300}});const profile=effectiveProfile(u),facing=dir==='UP'?'Back':'Front';
  const clip=id===G&&facing==='Back'?'Attack_Up':'Attack';
  const cap=id===G?2:id===K?1:Infinity,release=evidence.models[id][facing].hits[clip][0]/Math.min(cap,u.s.aspd/100);
  near(profile.windup(b,u),release);b.forceAttack(u,[e]);advance(b,Math.max(0,release-.04));near(e.hp,100000);advance(b,.1);assert.ok(e.hp<100000);
 }
});

test('Grani promotion/potential Physical Dodge aura is Vanguard-only, includes owner and cleans its own eligible recipients',()=>{
 for(const[elite,potential,prob]of[[0,1,0],[1,1,.1],[1,5,.15],[2,1,.2],[2,5,.25]]){
  const{b,deploy}=make(G,{elite,potential,rank:[4,7,10][elite],others:[F,M]}),u=deploy(),f=deploy(F,2,6),m=deploy(M,2,5);
  advance(b,.05);near(u.s.dodgePhys,prob);near(f.s.dodgePhys,prob);near(m.s.dodgePhys,0);
  b.addBuff(f,{key:'another:dodge',mods:{dodgePhys:.3}});b.retreatOperator(G);advance(b,.05);near(f.s.dodgePhys,.3);
 }
});

test('Grani Dodge source validator ignores healing/target-free but dynamically rejects ally isolation/disappearance',()=>{
 const{b,deploy}=make(G,{others:[F]}),u=deploy(),f=deploy(F,2,6);advance(b,.05);
 b.addBuff(f,{key:'free',flags:{healFree:true,untargetable:true}});advance(b,.05);near(f.s.dodgePhys,.2);
 b.addBuff(f,{key:'iso',flags:{isolated:true}});advance(b,.05);near(f.s.dodgePhys,0);b.removeBuff(f,'iso');advance(b,.05);near(f.s.dodgePhys,.2);
 f.hidden=true;advance(b,.05);near(f.s.dodgePhys,0);f.hidden=false;advance(b,.05);near(f.s.dodgePhys,.2);assert.ok(u.alive);
});

test('Grani S1 source additive DEF expires; S2 blocks two and strikes only every blocked target once',()=>{
 const first=make(G),g=first.deploy(),def=g.s.def;cast(first.b,g);near(g.s.def,def*2);advance(first.b,40.1);near(g.s.def,def);
 const{b,deploy}=make(G,{skill:1}),u=deploy(),a=enemy(b,7.2,2),z=enemy(b,7.3,2),outside=enemy(b,8,2),atk=u.s.atk;
 assert.equal(b._checkBlock(a),true);cast(b,u);assert.equal(b._checkBlock(z),true);assert.equal(u.s.blockCnt,2);near(u.s.atk,atk*1.8);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a,z]);
 b.forceAttack(u);advance(b,.4);near(100000-a.hp,u.s.atk);near(100000-z.hp,u.s.atk);near(outside.hp,100000);
 advance(b,30);assert.equal(u.s.blockCnt,1);assert.equal(z.blockedBy,null);near(u.s.atk,atk);
});

test('both source chargers grant only their own kill DP and refund original deploy cost after redeployment',()=>{
 for(const id of[G,W]){
  const{b,deploy}=make(id,{others:[M]}),u=deploy(),m=deploy(M,2,6),e=enemy(b);b.kill(e,m);near(b.dp,0);b.kill(enemy(b),u);near(b.dp,1);
  const raw=u.base.cost;b.retreatOperator(id);near(b.dp,1+raw);b.bench[id].readyAt=b.time;const next=deploy(id);assert.ok(b.bench[id].lastCost>raw);b.retreatOperator(id);near(b.dp,next.base.cost);
 }
});

test('Elysium both DP channels apply final block0, release existing blocks immediately and never attack during channel',()=>{
 for(const skill of[0,1]){
  const{b,deploy}=make(E,{skill}),u=deploy(),e=enemy(b,7.2,2);b.addBuff(u,{key:'outside:block',mods:{blockCnt:5}});assert.equal(b._checkBlock(e),true);
  let hits=0;b.on('damaged',({source})=>{if(source===u)hits++;});cast(b,u);assert.equal(u.s.blockCnt,0);assert.equal(e.blockedBy,null);u.atkCd=0;
  const info=bb(E,skill);advance(b,info.interval-.05);near(b.dp,0);advance(b,.1);near(b.dp,1);
  b.applyStatus(u,'stun',{duration:1});advance(b,u.def.skill.duration-b.time-.1);assert.equal(hits,0);u.atkCd=1000;advance(b,.2);near(b.dp,info.value);
  assert.equal(u.s.blockCnt,6);assert.equal(u.skill.active,false);
 }
});

test('Elysium original override, profession cost and skill ASPD use exact promotion/potential and source lifetime',()=>{
 for(const[elite,potential,cost,aspd]of[[0,1,0,0],[1,1,1,10],[1,5,1,13],[2,1,2,20],[2,5,2,23]]){
  const{b,deploy}=make(E,{elite,potential,rank:[4,7,10][elite],others:[S,M]}),normal=b.cost(S),guard=b.cost(M),u=deploy();
  near(b.cost(S),normal-cost);near(b.cost(M),guard);const s=deploy(S,1,3),m=deploy(M,2,6),speed=s.s.aspd;cast(b,u);near(s.s.aspd,speed+aspd);near(m.s.aspd,m.base.aspd);
  advance(b,8.1);near(s.s.aspd,speed);near(b.cost(S),Math.floor(normal*1.5)-cost);b.retreatOperator(E);near(b.cost(S),Math.floor(normal*1.5));near(s.s.aspd,speed);
 }
});

test('Elysium S2 locks a fixed capped set including stealth/air/target-free, follows them out of range and restores exactly',()=>{
 const{b,deploy}=make(E,{skill:1}),u=deploy(),all=[enemy(b,7.1,2,{def:100}),enemy(b,7.2,2,{def:100,flying:true}),enemy(b,7.3,2,{def:100}),enemy(b,7.4,2,{def:100}),enemy(b,7.5,2,{def:100})];
 for(const e of all)e.base.moveSpeed=1,e.markDirty();b.addBuff(all[0],{key:'invisible',flags:{stealth:true}});b.addBuff(all[2],{key:'untargetable',flags:{untargetable:true}});cast(b,u);
 for(const e of all.slice(0,4)){near(e.s.def,65);near(e.s.moveSpeed,.4);assert.equal(e.s.flags.reveal,true);}near(all[4].s.def,100);assert.equal(enemyStealthed(all[0]),false);
 all[0].x=0;const late=enemy(b,7,2,{def:100});advance(b,.1);near(all[0].s.def,65);near(late.s.def,100);
 advance(b,15);for(const e of all){near(e.s.def,100);near(e.s.moveSpeed,1);}assert.equal(enemyStealthed(all[0]),true);
});

test('Elysium source-owned S2 locks clean up by the original .25s source-alive poll after retreat',()=>{
 const{b,deploy}=make(E,{skill:1}),u=deploy(),e=enemy(b,7.3,2,{def:100});cast(b,u);near(e.s.def,65);b.retreatOperator(E);near(e.s.def,65);advance(b,.3);near(e.s.def,100);assert.equal(e.s.flags.reveal,undefined);
});

test('Elysium redeployed sniper card additions follow documented post-multiplier interpretation and failed placement consumes nothing',()=>{
 const{b,deploy}=make(E,{others:[S]}),u=deploy(),raw=b.data.getChess(S).stats.cost;near(b.cost(S),raw-2);const s=deploy(S,1,3);b.retreatOperator(S);b.bench[S].readyAt=b.time;
 near(b.cost(S),Math.floor(raw*1.5)-2);b.getPlayer('arkpedia').dp=0;assert.throws(()=>b.deployOperator(S,1,3,'RIGHT'),/DP/);near(b.cost(S),Math.floor(raw*1.5)-2);
 b.retreatOperator(E);near(b.cost(S),Math.floor(raw*1.5));assert.ok(s.removed&&u.removed);
});

test('Wild Mane finite deploy S1 uses selected ASPD once per life, expires and restarts only after redeployment',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(W,{rank}),u=deploy(),info=bb(W,0,rank),speed=u.base.aspd;assert.equal(u.skill.active,true);near(u.s.aspd,speed+info.attack_speed);
  advance(b,u.def.skill.duration+.1);assert.equal(u.skill.active,false);near(u.s.aspd,speed);assert.equal(u.skill.activate('test'),false);u.atkCd=0;enemy(b);advance(b,1);assert.equal(u.skill.active,false);
  redeployReady(b,W);const next=deploy();assert.equal(next.skill.active,true);near(next.s.aspd,speed+info.attack_speed);
 }
});

test('Wild Mane E1 first-deploy and E2 per-ready-guard card discounts retain max count and consume only each successful Guard spawn',()=>{
 for(const elite of[1,2]){
  const{b,deploy}=make(W,{elite,rank:elite===1?7:10,others:[M,F]}),raw=b.cost(M),fang=b.cost(F);deploy();near(b.cost(M),raw-1);near(b.cost(F),fang);
  redeployReady(b,W);deploy();near(b.cost(M),raw-(elite===1?1:2));
  for(let n=0;n<5;n++){redeployReady(b,W);deploy();}near(b.cost(M),raw-(elite===1?1:5));
  b.getPlayer('arkpedia').dp=0;assert.throws(()=>b.deployOperator(M,2,6,'RIGHT'),/DP/);near(b.cost(M),raw-(elite===1?1:5));
  const m=deploy(M,2,6);assert.equal(b._wildManeCardDiscounts.has(M),false);b.retreatOperator(M);near(b.cost(M),Math.floor(raw*1.5));assert.ok(m.removed);
 }
});

test('Wild Mane source in-hand filter excludes deployed and cooling Guard cards, and discounts survive the producer leaving',()=>{
 const{b,deploy}=make(W,{others:[M]}),raw=b.cost(M),m=deploy(M,2,6);deploy();near(b.cost(M),Math.floor(raw*1.5));b.retreatOperator(M);redeployReady(b,W);deploy();near(b.cost(M),Math.floor(raw*1.5));
 b.bench[M].readyAt=b.time;redeployReady(b,W);deploy();near(b.cost(M),Math.floor(raw*1.5)-1);b.retreatOperator(W);near(b.cost(M),Math.floor(raw*1.5)-1);assert.ok(m.removed);
});

test('Wild Mane S2 uses source release and facing-direction push with weight and behind-force penalties',()=>{
 const{b,deploy}=make(W,{skill:1}),u=deploy(),e=enemy(b,8,2),atk=u.s.atk;cast(b,u);near(u.s.atk,atk*1.8);const start=e.x;b.forceAttack(u,[e]);advance(b,.4);near(e.hp,100000);advance(b,.2);assert.ok(e.hp<100000);assert.ok(e.x>start);
 const behind=enemy(b,6.8,2);assert.equal(b._checkBlock(behind),true);const x=behind.x,probe=enemy(b,6.8,3),before=probe.x;b.push(probe,1,{from:{x:u.x,y:3},dir:{x:1,y:0}});const expected=before-probe.x;b.forceAttack(u,[behind]);advance(b,.6);assert.ok(behind.hp<100000);near(x-behind.x,expected);
 advance(b,20);near(u.s.atk,atk);assert.equal(u.skill.active,false);
});

test('Kestrel S1 natural full-SP gains exactly12DP; S2 first-wait periodic clock yields selected-rank9/11/12 without extra on expiry',()=>{
 const first=make(K),u=first.deploy();u.skill.gainSp(u.skill.spCost-u.skill.spTotal-.1,'test');advance(first.b,.15);near(first.b.dp,12);
 for(const rank of[1,7,10]){
  const{b,deploy}=make(K,{skill:1,rank}),k=deploy(),info=bb(K,1,rank),atk=k.s.atk,aspd=k.s.aspd;cast(b,k);near(k.s.atk,atk*(1+info.atk));near(k.s.aspd,aspd+info.attack_speed);
  advance(b,info['rfalcn_s_2[cost].interval']-.05);near(b.dp,0);advance(b,.1);near(b.dp,1);advance(b,15);near(b.dp,info.value);near(k.s.atk,atk);near(k.s.aspd,aspd);assert.equal(k.skill.active,false);
 }
});

test('Kestrel crit rolls per damage event before DEF, selected S2 scales chance and promotion/potential never duplicate generic crit',()=>{
 for(const[elite,potential,prob]of[[0,1,0],[1,1,.15],[1,5,.17],[2,1,.2],[2,5,.22]]){
  const{b,deploy}=make(K,{elite,potential,rank:[4,7,10][elite]}),u=deploy(),a=enemy(b,8,2,{def:100});assert.equal(u.def.raw.arkpedia.critical,undefined);
  const seen=[];b.rng.chance=p=>{seen.push(p);return true;};b.forceAttack(u,[a]);advance(b,.5);
  near(100000-a.hp,u.s.atk*(prob?1.4:1)-100);assert.deepEqual(seen,prob?[prob]:[]);
 }
 const{b,deploy}=make(K,{skill:1}),u=deploy(),a=enemy(b,8,2,{def:100}),z=enemy(b,8.2,2,{def:100});cast(b,u);
 const seen=[];b.rng.chance=p=>{seen.push(p);return seen.length===1;};b.forceAttack(u,[a,z]);advance(b,.6);assert.deepEqual(seen,[.5,.5]);near(100000-a.hp,u.s.atk*1.4-100);near(100000-z.hp,u.s.atk-100);
});
