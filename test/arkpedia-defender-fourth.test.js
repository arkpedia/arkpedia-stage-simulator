// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-defender-fourth-prefabs.json' with { type: 'json' };
import { DEFENDER_FOURTH_OPERATORS as configs } from '../shared/arkpedia/defender-fourth-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const BLITZ='char_457_blitz',UNDER='char_4137_udflow',ASH='char_431_ashlok',FIRE='char_493_firwhl',CEMENT='char_464_cement';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
function advance(b,s){for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function make(id,{skill=0,rank=10,elite=2,potential=1}={}){
 const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const op=source.operators[id],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(source,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(v=>({...v,height:'LOW',build:'ALL',pass:'ALL'}));
 const rng=()=>.999;rng.int=()=>0;b.rng=rng;
 const deploy=(r=3,c=4,dir='RIGHT')=>{b.addDp('arkpedia',99);const u=b.deployOperator(id,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;};return{b,deploy};
}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost*u.skill.maxCharges);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function enemy(b,{r=3,c=5,fly=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});e.base.maxHp=100000;e.base.atk=1000;e.base.def=0;e.base.res=0;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=100000;b.addBuff(e,{key:'test:pin',persist:true,flags:{disarm:true,noMove:true}});b._buildEnemyIndex();return e;}
const bb=(id,skill,rank=10)=>Object.fromEntries(data.operators[id].skills[skill].levels[rank-1].blackboard.map(v=>[v.key,v.value]));
const nodes=rows=>rows.flatMap(r=>r.components);
function move(b,e,r,c){e.x=c;e.y=r;e.tileR=r;e.tileC=c;b._enemiesDirty=true;b._buildEnemyIndex();}
const shot=(b,u,e)=>{b.forceAttack(u,[e]);u.atkCd=1000;};
function block(b,u,e){move(b,e,u.tileR,u.tileC+.1);e.blockedBy=u;u.blocking=[e];b._buildEnemyIndex();}
function hp(b,u){b.addBuff(u,{key:'test:HP',mods:{hpFlat:20000}});void u.s;u.hp=10000;return u;}
function tile(b,r,c,height){const k=r*b.grid.cols+c;b.grid.tiles[k]={...b.grid.tiles[k],height,build:'NONE'};}

test('five complete source kits retain ten original skills, animator aliases, typed selectors and native bounds',()=>{
 for(const[id,c]of Object.entries(configs)){
  assert.match(evidence.sourceBundles.find(v=>v.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  assert.match(evidence.originalModels[id].Front.sha256,/^[a-f0-9]{64}$/);
  for(const s of c.skillIds)assert.ok(evidence.skills[s.replace(/\[.*\]$/,'')].length);
 }
 const alias=evidence.originalAnimatorAliases[BLITZ];assert.equal(alias.pathId,'-2103837946957941041');
 assert.equal(alias.animations.find(v=>v.animKey==='Skill_1').animName,'Skill_01');
 assert.equal(alias.animations.find(v=>v.animKey==='Skill_2').animName,'Skill_02');
 const under=nodes(evidence.characters[UNDER]).filter(c=>c._animKey==='Skill_2_Loop');
 assert.ok(under.some(c=>c._attackType===1&&!('_projectileKey'in c)));
 assert.equal(evidence.buffTemplates.cement_s_2.eventToActions.ON_APPLIED_MODIFIER[0]._modifierTargetType,'HP');
 assert.equal(evidence.buffTemplates['burn_s_2[listener]'].eventToActions.ON_BUFF_START[2]._buff.waitFirstTriggerInterval,false);
 assert.ok(evidence.verificationLimits.some(v=>v.includes('actionEvent1')));
});
test('all ten skills and all ten source ranks load without generic duplicate talents',()=>{
 for(const[id,c]of Object.entries(configs))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,c.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
 for(const id of Object.keys(configs)){const{deploy}=make(id,{elite:0,rank:4});assert.equal(deploy().def.talents.length,0);}
});
test('Blitz opening uses original begin plus event once, uncapped ASPD and speed10 flight',()=>{
 const{b,deploy}=make(BLITZ),u=deploy(),e=enemy(b,{c:6,fly:true});assert.ok(acquireTargets(b,u,u.profile).includes(e));
 near(u.profile.windup(b,u,[e]),.366);u.mem.blitzOpened=false;shot(b,u,e);
 advance(b,.3);near(e.hp,100000);advance(b,.15);near(e.hp,100000);advance(b,.2);near(100000-e.hp,u.s.atk);
 b.addBuff(u,{key:'test:ASPD',mods:{aspd:200}});near(u.profile.windup(b,u,[e]),.033/3);
 move(b,e,5,7);advance(b,.1);assert.equal(u.mem.blitzOpened,false);near(u.profile.windup(b,u,[e]),.366/3);
});
test('Blitz talent prioritizes stunned targets and applies selected ATK scale only while stunned',()=>{
 for(const potential of [1,5]){const{b,deploy}=make(BLITZ,{potential}),u=deploy(),a=enemy(b,{c:4.3}),z=enemy(b,{c:5.7});
 b.applyStatus(z,'stun',{duration:5,source:u});assert.equal(acquireTargets(b,u,u.profile)[0],z);shot(b,u,z);advance(b,.65);
 near(100000-z.hp,u.s.atk*u.def.talents[0].bb.atk_scale);shot(b,u,a);advance(b,.2);near(100000-a.hp,u.s.atk);}
});
test('Blitz S1 waits literal source Skill_01 event and applies stun/silence to all normal-range ALL targets',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(BLITZ,{rank}),u=deploy(),a=enemy(b),air=enemy(b,{c:6,fly:true}),outside=enemy(b,{c:7});cast(b,u);
 advance(b,.2);assert.ok(!a.s.flags.stun);advance(b,.2);assert.equal(a.s.flags.stun,true);assert.equal(air.s.flags.stun,true);assert.equal(a.s.flags.silence,true);assert.ok(!outside.s.flags.stun);
 advance(b,bb(BLITZ,0,rank).stun+.1);assert.ok(!a.s.flags.stun);assert.ok(!a.s.flags.silence);}
});
test('Blitz S1 use cap is four each deployment, empty cast consumes a use, brief control cancels pending status',()=>{
 const{b,deploy}=make(BLITZ),u=deploy();for(let i=0;i<4;i++){cast(b,u);advance(b,1.1);assert.equal(u.skill.remainingUses,3-i);}
 u.skill.setSpTotal(99);assert.equal(u.skill.exhausted,true);assert.equal(u.skill.activate('test'),false);
 b.retreat(u);advance(b,75);const redeploy=deploy();assert.equal(redeploy.skill.remainingUses,4);
 const e=enemy(b);cast(b,redeploy);b.applyStatus(redeploy,'stun',{duration:.1,source:e});advance(b,.5);assert.ok(!e.s.flags.stun);assert.equal(redeploy.skill.remainingUses,3);
});
test('Blitz S2 strikes only currently blocked targets once, selected talent multiplier and ASPD clean up',()=>{
 const{b,deploy}=make(BLITZ,{skill:1}),u=deploy(),e=enemy(b),other=enemy(b,{c:5.8});block(b,u,e);const base=u.s.aspd;cast(b,u);
 near(u.s.aspd,base+bb(BLITZ,1).attack_speed);advance(b,.2);near(e.hp,100000);advance(b,.2);
 near(100000-e.hp,u.s.atk*2*u.def.talents[0].bb.atk_scale*1.5);assert.equal(e.s.flags.stun,true);near(other.hp,100000);
 advance(b,6.8);near(u.s.aspd,base);assert.ok(!u.mem.regularFormVisual);assert.equal(u.mem.blitzOpened,false);
});
test('Blitz physical block checks HIGH neighbors beside/behind with facing rotation, retains hurt SP and rejects Arts/HP loss',()=>{
 for(const dir of ['RIGHT','UP']){const{b,deploy}=make(BLITZ),u=hp(b,deploy(3,4,dir)),e=enemy(b);const rng=()=>0;rng.int=()=>0;b.rng=rng;
 tile(b,3,dir==='RIGHT'?3:5,'HIGH');u.skill.setSpTotal(0);u.skill.spType='hurt';let health=u.hp;b.dealDamage(e,u,{amount:u.s.def+100,type:'phys',isAttack:true});near(u.hp,health);near(u.skill.spTotal,1);
 b.dealDamage(e,u,{amount:100,type:'arts',isAttack:true});near(u.hp,health-100);b.loseHp(u,10,{source:e});near(u.hp,health-110);}
 const{b,deploy}=make(BLITZ),u=hp(b,deploy()),e=enemy(b);const rng=()=>0;rng.int=()=>0;b.rng=rng;tile(b,3,5,'HIGH');const health=u.hp;
 b.dealDamage(e,u,{amount:u.s.def+100,type:'phys',isAttack:true});near(u.hp,health-100);
});
test('Underflow S1 buffs selected ranks and normal attacks retain speed10 projectile timing',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(UNDER,{rank}),u=deploy(),base=u.s.atk,armor=u.s.def,e=enemy(b);cast(b,u);near(u.s.atk,base*(1+bb(UNDER,0,rank).atk));near(u.s.def,armor*(1+bb(UNDER,0,rank).def));shot(b,u,e);
 advance(b,.2);near(e.hp,100000);advance(b,.2);near(100000-e.hp,u.s.atk);u.skill.end('test');near(u.s.atk,base);near(u.s.def,armor);}
});
test('Underflow poison waits one second, doubles actual seamonster tags, preserves cadence on extend and persists after retreat',()=>{
 const{b,deploy}=make(UNDER),u=deploy(),e=enemy(b);e.tags.add('seamonster');shot(b,u,e);advance(b,.4);const normal=100000-e.hp;
 advance(b,.7);near(100000-e.hp,normal);shot(b,u,e);advance(b,.4);near(100000-e.hp,normal+u.s.atk+160);
 assert.equal(e.buffs.filter(v=>v.key==='underflow:poison').length,1);const beforeRetreat=e.hp;b.retreat(u);advance(b,1);near(beforeRetreat-e.hp,160);
 assert.ok(e.findBuff('underflow:poison'));advance(b,2.2);assert.equal(e.findBuff('underflow:poison'),null);
});
test('Underflow poison is normal-origin Arts damage and selected E1/E2/potential fixed values',()=>{
 for(const [elite,potential]of [[1,1],[2,1],[2,5]]){const{b,deploy}=make(UNDER,{elite,potential,rank:elite===1?7:10}),u=deploy(),e=enemy(b),t=u.def.talents[0].bb,seen=[];
 b.on('hit',c=>{if(c.dmg.tags.includes('underflow:poison'))seen.push(c.dmg);});shot(b,u,e);advance(b,.4);const health=e.hp;advance(b,1);near(health-e.hp,t.damage);assert.ok(seen[0].isAttack);assert.equal(seen[0].applyWay,'none');}
});
test('Underflow S2 source direct strip pierces selected cap, accepts air, slows and excludes behind/side with no fake flight',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(UNDER,{skill:1,rank}),u=deploy(),victims=[4.1,4.7,5.3,6,6.8].map((c,i)=>enemy(b,{c,fly:i===2})),side=enemy(b,{r:4,c:5}),behind=enemy(b,{c:3});cast(b,u);advance(b,.3);
 const p=effectiveProfile(u),targets=acquireTargets(b,u,p);assert.equal(targets.length,bb(UNDER,1,rank)['attack@max_target']);assert.equal(p.launchAttack,null);assert.equal(p.attack,'melee');
 const count=b.projectiles.list.length;b.forceAttack(u,targets);u.atkCd=1000;advance(b,.1);assert.equal(b.projectiles.list.length,count);
 for(const e of targets){near(100000-e.hp,u.s.atk);assert.ok(e.findBuff('sluggish'));}
 near(side.hp,100000);near(behind.hp,100000);for(const e of victims.filter(v=>!targets.includes(v)))near(e.hp,100000);
 u.skill.end('test');advance(b,.4);assert.equal(u.mem.regularFormVisual,null);}
});
test('Underflow S2 Down literal clip and source begin/end cleanup survive retreat and no stale form reappears',()=>{
 const{b,deploy}=make(UNDER,{skill:1}),u=deploy(3,4,'DOWN');cast(b,u);assert.equal(u.mem.regularFormVisual.clip,'Skill_Down_2_Begin');advance(b,.3);assert.equal(u.mem.regularFormVisual.clip,'Skill_Down_2_Idle');
 b.retreat(u);assert.equal(u.mem.regularFormVisual,null);advance(b,2);assert.equal(u.mem.regularFormVisual,null);
});
test('Ashlock tile talent tests four LOW ANY neighbors, excludes missing boundary and replaces rather than stacks conditional ATK',()=>{
 const{b,deploy}=make(ASH),u=deploy(),t=u.def.talents[0].bb;near(u.s.atk,u.base.atk*(1+t['ashlok_t_1.atk']));
 tile(b,3,5,'HIGH');advance(b,.1);near(u.s.atk,u.base.atk*(1+t.atk));tile(b,3,5,'LOW');advance(b,.1);near(u.s.atk,u.base.atk*(1+t['ashlok_t_1.atk']));
 const x=make(ASH),edge=x.deploy(0,2);near(edge.s.atk,edge.base.atk*(1+edge.def.talents[0].bb.atk));
});
test('Ashlock normal has source distant ground AoE speed5 and no duplicate area damage',()=>{
 const{b,deploy}=make(ASH),u=deploy(3,2),e=enemy(b,{c:5}),nearby=enemy(b,{r:3,c:5.7}),air=enemy(b,{r:3,c:5.3,fly:true}),outside=enemy(b,{c:7});const p=effectiveProfile(u),targets=acquireTargets(b,u,p);assert.equal(targets.length,1);assert.ok(!p._fortressMelee);shot(b,u,e);
 advance(b,.6);near(e.hp,100000);advance(b,.7);near(100000-e.hp,u.s.atk);near(100000-nearby.hp,u.s.atk);near(air.hp,100000);near(outside.hp,100000);
});
test('Ashlock own-tile melee fallback and blocked melee use source Attack02 while a range gap remains untargeted',()=>{
 const{b,deploy}=make(ASH),u=deploy(3,2),own=enemy(b,{c:2.1}),gap=enemy(b,{c:3.4});let p=effectiveProfile(u);assert.deepEqual(acquireTargets(b,u,p),[own]);assert.equal(p._fortressMelee,true);assert.equal(p.attackVisual(b,u),'Attack02');shot(b,u,own);advance(b,.8);near(100000-own.hp,u.s.atk);near(gap.hp,100000);
 b._unblock(own);move(b,own,3,3.7);assert.equal(acquireTargets(b,u,p).length,0);block(b,u,gap);assert.deepEqual(acquireTargets(b,u,p),[gap]);
});
test('Ashlock ranged shell impact remains on last point when primary becomes untargetable/dead',()=>{
 for(const disappear of ['untargetable','death']){const{b,deploy}=make(ASH),u=deploy(3,2),primary=enemy(b,{c:5}),other=enemy(b,{c:5.5});acquireTargets(b,u,u.profile);shot(b,u,primary);advance(b,.6);
 if(disappear==='death')b.kill(primary,null);else b.addBuff(primary,{key:'test:free',flags:{untargetable:true}});advance(b,.7);near(100000-other.hp,u.s.atk);}
});
test('Ashlock S1 selected ATK and S2 source BAT/block0/ranged-only profile cleanup',()=>{
 for(const rank of [1,7,10])for(const skill of [0,1]){const{b,deploy}=make(ASH,{skill,rank}),u=deploy(3,2),base=u.s.atk,bat=u.s.bat,e=enemy(b,{c:2.1}),far=enemy(b,{c:5});block(b,u,e);cast(b,u);near(u.s.atk,u.base.atk*(1+u.def.talents[0].bb['ashlok_t_1.atk']+bb(ASH,skill,rank).atk));
 if(skill===1){near(u.s.bat,bat*(1+bb(ASH,skill,rank).base_attack_time));near(u.s.blockCnt,0);advance(b,.1);assert.equal(e.blockedBy,null);const p=effectiveProfile(u);assert.deepEqual(acquireTargets(b,u,p),[far]);assert.ok(!p._fortressMelee);}
 u.skill.end('test');near(u.s.atk,base);near(u.s.bat,bat);assert.ok(u.s.blockCnt>0);}
});
test('Ashlock S2 original facing-specific literal loop/idle clips and natural ranged firing cadence',()=>{
 for(const dir of ['RIGHT','UP','DOWN','LEFT']){const{b,deploy}=make(ASH,{skill:1}),u=deploy(3,3,dir);cast(b,u);const p=effectiveProfile(u),suffix=dir==='UP'?'_Up':dir==='DOWN'?'_Down':'';assert.equal(p.attackVisual(b,u),`Skill_Loop${suffix}`);near(p.windup(b,u),dir==='DOWN'?.5:.533);assert.equal(u.mem.regularFormVisual.clip,`Skill_Idle${suffix}`);u.skill.end('test');assert.equal(u.mem.regularFormVisual,null);}
 const{b,deploy}=make(ASH,{skill:1}),u=deploy(3,2),e=enemy(b,{c:5});cast(b,u);u.atkCd=0;advance(b,3.2);assert.equal(u.stats.attacks,4);assert.ok(e.hp<100000);
});
test('Firewhistle blocking talent switches selected ATK/DEF rather than retaining both',()=>{
 const{b,deploy}=make(FIRE),u=deploy(3,2),t=u.def.talents[0].bb,e=enemy(b);near(u.s.atk,u.base.atk*(1+t.atk));near(u.s.def,u.base.def);block(b,u,e);advance(b,.1);near(u.s.atk,u.base.atk);near(u.s.def,u.base.def*(1+t.def));
 b.kill(e,null);advance(b,.1);near(u.s.atk,u.base.atk*(1+t.atk));near(u.s.def,u.base.def);
});
test('Firewhistle S1 applies selected physical scale and one-second burn to all eligible radius victims, no air',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(FIRE,{rank}),u=deploy(3,2),e=enemy(b,{c:5}),other=enemy(b,{c:5.7}),air=enemy(b,{c:5.3,fly:true});acquireTargets(b,u,u.profile);cast(b,u);shot(b,u,e);advance(b,1.2);const a=u.s.atk;
 near(100000-e.hp,a*bb(FIRE,0,rank).atk_scale);near(100000-other.hp,a*bb(FIRE,0,rank).atk_scale);near(air.hp,100000);advance(b,1.1);near(100000-e.hp,a*(bb(FIRE,0,rank).atk_scale+bb(FIRE,0,rank)['burn.atk_scale']));}
});
test('Firewhistle S1 burn uses live current ATK and after retreat cached attachment ATK, refresh default resets cadence',()=>{
 const{b,deploy}=make(FIRE),u=deploy(3,2),e=enemy(b,{c:5});acquireTargets(b,u,u.profile);cast(b,u);shot(b,u,e);advance(b,1.2);const cached=u.s.atk,health=e.hp;
 b.addBuff(u,{key:'test:atk',mods:{atkPct:1}});advance(b,1);near(health-e.hp,u.s.atk*.5);const h=e.hp;b.retreat(u);advance(b,1);near(h-e.hp,cached*.5);
});
test('Firewhistle S2 field is fixed original x-5 plus center, immediate tick then one per second; excludes diagonal and air',()=>{
 const{b,deploy}=make(FIRE,{skill:1}),u=deploy(3,2),e=enemy(b,{c:5}),adjacent=enemy(b,{r:4,c:5.3}),diagonal=enemy(b,{r:4,c:6}),air=enemy(b,{r:3,c:6,fly:true});cast(b,u);advance(b,.4);acquireTargets(b,u,effectiveProfile(u));shot(b,u,e);advance(b,1.2);const a=u.s.atk;
 near(100000-e.hp,a*(1+.85));near(100000-adjacent.hp,a*.85);near(diagonal.hp,100000);near(air.hp,100000);advance(b,1);near(100000-adjacent.hp,2*a*.85);
});
test('Firewhistle S2 overlapping fields share one damage controller and preserve interval cadence',()=>{
 const{b,deploy}=make(FIRE,{skill:1}),u=deploy(3,2),e=enemy(b,{c:5}),adjacent=enemy(b,{r:4,c:5.3});cast(b,u);advance(b,.4);acquireTargets(b,u,effectiveProfile(u));shot(b,u,e);advance(b,1.2);const a=u.s.atk;
 shot(b,u,e);advance(b,1.2);near(100000-adjacent.hp,2*a*.85);assert.equal(adjacent.buffs.filter(v=>v.key==='firewhistle:field-damage').length,1);assert.equal(b._arkpediaFireFields.fields.length,2);
 advance(b,1);near(100000-adjacent.hp,3*a*.85);
});
test('Firewhistle S2 field survives source/target removal, uses cached source ATK, exit/reentry and expiry are bounded',()=>{
 const{b,deploy}=make(FIRE,{skill:1}),u=deploy(3,2),e=enemy(b,{c:5}),adjacent=enemy(b,{r:4,c:5.3});cast(b,u);advance(b,.4);acquireTargets(b,u,effectiveProfile(u));shot(b,u,e);advance(b,1.2);const a=u.s.atk,health=adjacent.hp;b.kill(e,null);b.retreat(u);advance(b,1);near(health-adjacent.hp,a*.85);
 move(b,adjacent,5,7);advance(b,1.1);const outside=adjacent.hp;assert.equal(adjacent.findBuff('firewhistle:field-damage'),null);move(b,adjacent,4,5);advance(b,.1);near(outside-adjacent.hp,a*.85);
 advance(b,5);const end=adjacent.hp;advance(b,2);near(adjacent.hp,end);assert.equal(adjacent.findBuff('firewhistle:field-listener'),null);
});
test('Firewhistle S2 melee fallback burns target-root tile while facing form cleanup remains owned',()=>{
 const{b,deploy}=make(FIRE,{skill:1}),u=deploy(3,2),e=enemy(b,{c:2.1});cast(b,u);advance(b,.4);const p=effectiveProfile(u);assert.deepEqual(acquireTargets(b,u,p),[e]);assert.ok(p._fortressMelee);shot(b,u,e);advance(b,.6);assert.equal(b._arkpediaFireFields.fields.length,1);near(100000-e.hp,u.s.atk*1.85);u.skill.end('test');advance(b,.4);assert.equal(u.mem.regularFormVisual,null);
});
test('Cement SP stops unblocked for natural, offensive/defensive/external grants and resumes with actual blocks',()=>{
 const{b,deploy}=make(CEMENT),u=deploy(),e=enemy(b);u.skill.setSpTotal(0);advance(b,1);near(u.skill.spTotal,0);u.skill.gainSp(5,'test:grant');near(u.skill.spTotal,0);block(b,u,e);advance(b,.1);u.skill.gainSp(1,'test:grant');assert.ok(u.skill.spTotal>=1);b.kill(e,null);advance(b,.1);const sp=u.skill.spTotal;advance(b,1);near(u.skill.spTotal,sp);
});
test('Cement S1 manual source charges, current all-range target selection, uncapped event and full cast lock',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(CEMENT,{rank}),u=deploy(),e=enemy(b,{c:4.4}),other=enemy(b,{c:5.2}),outside=enemy(b,{c:6}),air=enemy(b,{c:5,fly:true});cast(b,u);assert.equal(u.skill.maxCharges,bb(CEMENT,0,rank).cnt);assert.equal(u.skill.activate('test'),false);
 advance(b,.4);near(e.hp,100000);advance(b,.2);near(100000-e.hp,u.s.atk*bb(CEMENT,0,rank).atk_scale);near(100000-other.hp,u.s.atk*bb(CEMENT,0,rank).atk_scale);near(outside.hp,100000);near(air.hp,100000);assert.ok(u.s.flags.disarm);advance(b,1);assert.ok(!u.mem.defenderFourthCast);}
});
test('Cement S1 rejects no target without consuming and refunds current source charge when target leaves before release',()=>{
 const{b,deploy}=make(CEMENT),u=deploy();u.skill.setSpTotal(12);const full=u.skill.spTotal;assert.equal(u.skill.activate('test'),false);near(u.skill.spTotal,full);
 const e=enemy(b);assert.equal(u.skill.activate('test'),true);const used=u.skill.spTotal;move(b,e,5,7);advance(b,.6);near(u.skill.spTotal,used+u.skill.spCost);near(e.hp,100000);
});
test('Cement S1 brief interruption cannot recover and emit later; actual redeploy owns new cast state',()=>{
 const{b,deploy}=make(CEMENT),u=deploy(),e=enemy(b);cast(b,u);b.applyStatus(u,'stun',{duration:.1,source:e});advance(b,.7);near(e.hp,100000);b.retreat(u);advance(b,75);const next=deploy();assert.equal(next.mem.defenderFourthCast,undefined);cast(b,next);advance(b,.6);assert.ok(e.hp<100000);
});
test('Cement selected physical resistance doubles at actual deploy35 seconds; Arts/true/HP loss unaffected',()=>{
 for(const potential of [1,5]){const{b,deploy}=make(CEMENT,{potential}),u=hp(b,deploy()),e=enemy(b),t=u.def.talents[0].bb;let h=u.hp;
 b.dealDamage(e,u,{amount:u.s.def+100,type:'phys'});near(h-u.hp,100*(1-t.damage_resistance));h=u.hp;advance(b,35.1);b.dealDamage(e,u,{amount:u.s.def+100,type:'phys'});near(h-u.hp,100*(1-t.damage_resistance-t.damage_resistance_addtion));
 h=u.hp;b.dealDamage(e,u,{amount:100,type:'arts'});near(h-u.hp,100);h=u.hp;b.dealDamage(e,u,{amount:100,type:'true'});near(h-u.hp,100);h=u.hp;b.loseHp(u,100,{source:e});near(h-u.hp,100);}
});
test('Cement S2 selected additive DEF stack count decreases per real HP loss and manually cancels',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(CEMENT,{skill:1,rank}),u=hp(b,deploy()),e=enemy(b),base=u.s.def,z=bb(CEMENT,1,rank);cast(b,u);near(u.s.def,base*(1+z.def*z.cnt));
 b.dealDamage(e,u,{amount:1,type:'true'});assert.equal(u.mem.cementStacks,z.cnt-1);near(u.s.def,base*(1+z.def*(z.cnt-1)));b.loseHp(u,1,{source:e});assert.equal(u.mem.cementStacks,z.cnt-2);u.skill.end('manual');near(u.s.def,base);assert.equal(u.mem.cementStacks,0);advance(b,.4);assert.equal(u.mem.regularFormVisual,null);}
});
test('Cement S2 shield/dodge/floor/gauge preserve DEF stack; true and elemental HP damage consume exactly once',()=>{
 const{b,deploy}=make(CEMENT,{skill:1}),u=hp(b,deploy()),e=enemy(b);cast(b,u);const initial=u.mem.cementStacks;
 b.addBuff(u,{key:'test:shield',shield:10});b.dealDamage(e,u,{amount:10,type:'true'});assert.equal(u.mem.cementStacks,initial);
 b.addBuff(u,{key:'test:dodge',mods:{dodgePhys:1}});const rng=()=>0;rng.int=()=>0;b.rng=rng;b.dealDamage(e,u,{amount:100000,type:'phys'});assert.equal(u.mem.cementStacks,initial);b.removeBuff(u,'test:dodge');
 b.dealDamage(e,u,{amount:10,type:'element',element:'neural'});assert.equal(u.mem.cementStacks,initial);
 b.addBuff(u,{key:'test:floor',flags:{undeadable:true}});u.hp=1;b.dealDamage(e,u,{amount:10,type:'true'});assert.equal(u.mem.cementStacks,initial);b.loseHp(u,10,{source:e});assert.equal(u.mem.cementStacks,initial);
 u.hp=20;b.dealDamage(e,u,{amount:10,type:'elemental',element:'burn'});assert.equal(u.mem.cementStacks,initial-1);b.dealDamage(e,u,{amount:10,type:'true'});assert.equal(u.mem.cementStacks,initial-2);
});
test('Cement S2 exhausts stacks without ending duration early and duration/retreat/death clear owned modifiers',()=>{
 const{b,deploy}=make(CEMENT,{skill:1}),u=hp(b,deploy()),e=enemy(b);const base=u.s.def;cast(b,u);for(let i=0;i<21;i++)b.loseHp(u,1,{source:e});assert.equal(u.mem.cementStacks,0);near(u.s.def,base);assert.equal(u.skill.active,true);advance(b,60.1);assert.equal(u.skill.active,false);near(u.s.def,base);
 for(const reason of ['retreat','death']){const{b,deploy}=make(CEMENT,{skill:1}),u=deploy();cast(b,u);if(reason==='retreat')b.retreat(u);else b.kill(u,null);assert.equal(u.mem.cementStacks,0);assert.equal(u.findBuff('cement:stack-defense'),null);assert.equal(u.mem.regularFormVisual,null);}
});

test('Ashlock in-flight ranged source origin stays ranged after its selector switches to blocked melee',()=>{
 const{b,deploy}=make(ASH),u=deploy(3,2),target=enemy(b,{c:5}),blocker=enemy(b,{c:3.5}),seen=[];acquireTargets(b,u,u.profile);shot(b,u,target);advance(b,.6);
 block(b,u,blocker);assert.deepEqual(acquireTargets(b,u,u.profile),[blocker]);assert.ok(u.profile._fortressMelee);
 b.on('hit',({source,target:e,dmg})=>{if(source===u&&e===target)seen.push(dmg.applyWay);});advance(b,.7);assert.deepEqual(seen,['ranged']);
});
test('Firewhistle S1 default target buff refresh restarts first-tick wait and retains one controller',()=>{
 const{b,deploy}=make(FIRE),u=deploy(3,2),e=enemy(b,{c:2.1});block(b,u,e);advance(b,.1);acquireTargets(b,u,u.profile);cast(b,u);shot(b,u,e);advance(b,.7);
 advance(b,.5);cast(b,u);shot(b,u,e);advance(b,.7);const h=e.hp;assert.equal(e.buffs.filter(v=>v.key==='firewhistle:S1').length,1);
 advance(b,.6);near(e.hp,h);advance(b,.5);near(h-e.hp,u.s.atk*.5);
});
test('Firewhistle old and new deployment fields share listener union, original damage source and existing cadence',()=>{
 const{b,deploy}=make(FIRE,{skill:1}),first=deploy(3,2),e=enemy(b,{c:5}),adjacent=enemy(b,{r:4,c:5.3});cast(b,first);advance(b,.4);acquireTargets(b,first,effectiveProfile(first));shot(b,first,e);advance(b,1.2);const original=first.s.atk,health=adjacent.hp;
 b.retreat(first);b.bench[FIRE].readyAt=b.time;const second=deploy(3,2);b.addBuff(second,{key:'test:atk',mods:{atkPct:1}});cast(b,second);advance(b,.4);acquireTargets(b,second,effectiveProfile(second));shot(b,second,e);advance(b,1.2);
 assert.equal(adjacent.buffs.filter(v=>v.key==='firewhistle:field-damage').length,1);assert.equal(adjacent.findBuff('firewhistle:field-damage').source,first);near(health-adjacent.hp,original*.85);assert.equal(b._arkpediaFireFields.fields.length,2);
});
test('Cement selected stacked DEF uses the explicit additive percentage contract with an external DEF modifier',()=>{
 const{b,deploy}=make(CEMENT,{skill:1}),u=deploy(),z=bb(CEMENT,1);b.addBuff(u,{key:'test:external-def',mods:{defPct:.3}});cast(b,u);
 near(u.s.def,u.base.def*(1+.3+z.def*z.cnt));b.loseHp(u,1);near(u.s.def,u.base.def*(1+.3+z.def*(z.cnt-1)));u.skill.end('manual');near(u.s.def,u.base.def*1.3);
});
test('Ashlock LEFT source literal Front presentation cleans up on retreat and death',()=>{
 for(const reason of ['retreat','death']){const{b,deploy}=make(ASH,{skill:1}),u=deploy(3,3,'LEFT');cast(b,u);assert.equal(u.mem.regularAttackFacing,'Front');assert.equal(u.mem.regularFormVisual.forceFront,true);
 if(reason==='retreat')b.retreat(u);else b.kill(u,null);assert.equal(u.mem.regularAttackFacing,null);assert.equal(u.mem.regularFormVisual,null);}
});
