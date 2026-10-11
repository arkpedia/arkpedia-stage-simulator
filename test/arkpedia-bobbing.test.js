// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-bobbing-prefabs.json' with { type: 'json' };
import { BOBBING_OPERATORS as configs } from '../shared/arkpedia/bobbing-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const ID='char_487_bobb';
const near=(a,z,e=1e-5)=>assert.ok(Math.abs(a-z)<e,`${a} != ${z}`);
const rows=r=>r.flatMap(x=>x.components.map(c=>({pathId:c.pathId,...c.data})));
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
 const d=structuredClone(data),op=d.operators[ID];assert.ok(op,'Reviewed Bobbing snapshot required');
 d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(d,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.recordEvents=true;
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.addDp('arkpedia',99);
 const u=b.deployOperator(ID,5,5,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';
 const receipts=[];b.on('damaged',c=>receipts.push({...c,time:b.time}));return{b,u,receipts};
}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function enemy(b,{x=6,y=5,hp=100000,def=0,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,def,res,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;Object.defineProperty(e,'gaugeMax',{value:100000,configurable:true});
 if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function move(b,e,x,y=5){e.x=x;e.y=y;e.tileR=Math.round(y);e.tileC=Math.round(x);b._enemiesDirty=true;b._buildEnemyIndex();}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.id.endsWith('_1')?u.skill.activate('DEFAULT'):b.activateOperator(ID),true);u.atkCd=1000;}
function shot(b,u,e){assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;}
const own=(rs,u,e,type='arts')=>rs.filter(r=>r.source===u&&r.type===type&&(!e||r.target===e));
const talent=u=>u.def.talents[0]?.bb['attack@ep_damage_ratio_talent']??0;
const point=dir=>dir==='LEFT'?{x:4,y:5}:dir==='UP'?{x:5,y:6}:dir==='DOWN'?{x:5,y:4}:{x:6,y:5};

test('Bobbing retains exact both skills, first-hit native fields, official facings, perpendicular collider transforms and no parity claim',()=>{
 assert.deepEqual(Object.keys(configs),[ID]);assert.deepEqual(configs[ID].skillIds,['skchr_bobb_1','skchr_bobb_2']);assert.equal(source.frameParity,false);assert.equal(source.source.bundles.length,5);
 for(const face of['Front','Back']){assert.equal(source.models[ID][face].sha256,source.originalFacingBindings[ID][face].sha256);near(source.models[ID][face].hits.Attack[0],.4);near(source.models[ID][face].hits.Skill_1[0],.367);}
 const ch=rows(source.characters[ID]),fire=ch.find(x=>x.pathId==='1385808001630499485');near(fire._preDelay,.5);assert.equal(fire._waitForAttackEvent,0);assert.equal(fire._waitForProjectileInvalid,1);assert.equal(fire._interruptAbilityOnDetach,0);
 assert.equal(source.buffTemplates['bobb_t_1'].eventToActions.ON_BUFF_START[1]._checkBuffSource,true);
 assert.equal(source.buffTemplates['bobb_t_1[damage]'].eventToActions.ON_BUFF_START[0]._elementDamageType,'FIRE');
 for(const key of['projectile_chr_bobb_s2','projectile_chr_bobb_s2_Up']){const cs=rows(source.projectiles[key]);assert.equal(cs.find(x=>x._stopWhenSourceInvalid!=null)._stopWhenSourceInvalid,1);assert.deepEqual(cs.find(x=>x.m_Size!=null).m_Size,{x:1,y:3});}
 const transforms=source.projectileTransforms.projectile_chr_bobb_s2_Up_logic;const body=transforms.find(x=>x.object==='Body').data;near(Math.abs(body.m_LocalRotation.z),Math.SQRT1_2,1e-6);
 assert.ok(source.verificationLimits.some(x=>x.includes('waitForCasting1')));
});
test('all20 skill ranks preserve native SP, storage, selected duration and independent elemental ratios',()=>{
 for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){const{b,u}=make({skill,rank}),row=source.tables[ID].skills[u.skill.id].levels[rank-1];near(u.skill.spCost,row.spData.spCost);near(u.skill.spTotal,row.spData.initSp);assert.equal(u.skill.maxCharges,1);assert.equal(u.profile.maxTargets,1);if(skill===1){near(u.skill.duration,11);near(u.skill.bb['attack@projectile_life_time'],11);}advance(b,.1);}
});
test('T1 promotion/potential law is selected source-only, absent atE0, with no passive ATK approximation',()=>{
 for(const[elite,potential,pct]of[[0,1,0],[1,1,.10],[1,5,.12],[2,1,.16],[2,5,.18]]){const{b,u}=make({elite,potential}),e=enemy(b);near(talent(u),pct);near(u.s.atk,u.base.atk);shot(b,u,e);advance(b,.8);near(e.elem.burn,u.s.atk*pct);}
});
test('normal native .4 event plus speed8 flight is one Arts/ranged receipt across each facing',()=>{
 for(const dir of['RIGHT','UP','LEFT','DOWN']){const{b,u,receipts}=make({dir}),e=enemy(b,point(dir)),other=enemy(b,{...point(dir),x:point(dir).x+.1});shot(b,u,e);advance(b,.35);assert.equal(b.projectiles.list.length,0);near(e.hp,100000);advance(b,.1);assert.equal(b.projectiles.list.length,1);advance(b,.2);assert.equal(own(receipts,u).length,1);near(100000-e.hp,u.s.atk);near(other.hp,100000);assert.equal(own(receipts,u)[0].dmg.applyWay,'ranged');assert.equal(own(receipts,u)[0].dmg.isAttack,true);}
});
test('ordinary natural AI hits one ground or flying victim without adjacent duplication',()=>{
 for(const fly of[false,true]){const{b,u,receipts}=make(),e=enemy(b,{fly}),other=enemy(b,{x:6.1});u.atkCd=0;b.step();u.atkCd=1000;advance(b,.8);assert.equal(u.stats.attacks,1);assert.equal(own(receipts,u).length,1);assert.equal([e,other].filter(x=>x.hp<100000).length,1);}
});
test('T1 starts immediately then four one-second triggers, expires at5 without a sixth or reapplication',()=>{
 const{b,u}=make(),e=enemy(b);shot(b,u,e);advance(b,.8);const n=u.s.atk*talent(u);near(e.elem.burn,n);advance(b,4.9);near(e.elem.burn,5*n);assert.equal(e.findBuff(`bobb_t_1[damage]:${u.id}`),null);assert.ok(e.findBuff(`bobb_t_1[mark]:${u.id}`));shot(b,u,e);advance(b,1);near(e.elem.burn,5*n);
});
test('T1 is per-victim and per-source, keeps cadence, and samples later actual source ATK',()=>{
 const{b,u}=make(),e=enemy(b),z=enemy(b,{x:7});shot(b,u,e);advance(b,.8);const base=u.s.atk;shot(b,u,e);b.addBuff(u,{key:'late',mods:{atkPct:.5}});advance(b,.8);near(e.elem.burn,base*talent(u)+u.s.atk*talent(u));move(b,e,15);shot(b,u,z);advance(b,.9);assert.ok(z.elem.burn>0);assert.ok(z.findBuff(`bobb_t_1[mark]:${u.id}`));
});
test('T1 born nonderived DOT and released projectile survive retirement, without new normal attacks',()=>{
 const{b,u}=make(),e=enemy(b);shot(b,u,e);advance(b,.45);assert.equal(b.projectiles.list.length,1);b.retreat(u);advance(b,5.5);near(100000-e.hp,u.s.atk);near(e.elem.burn,u.s.atk*talent(u)*5);assert.ok(e.findBuff(`bobb_t_1[mark]:${u.id}`));assert.equal(u.stats.attacks,1);
});
test('redeployment is a new source identity and can create a new first-hit mark on the same victim',()=>{
 const{b,u}=make(),e=enemy(b);shot(b,u,e);advance(b,5.8);const before=e.elem.burn;b.retreat(u);b.bench[ID].readyAt=b.time;b.addDp('arkpedia',99);const z=b.deployOperator(ID,5,5,'RIGHT');assert.ok(z);z.atkCd=1000;z.skill.rule='NEVER';shot(b,z,e);advance(b,.8);assert.notEqual(z.id,u.id);near(e.elem.burn-before,z.s.atk*talent(z));assert.ok(e.findBuff(`bobb_t_1[mark]:${z.id}`));
});
test('S1 all ranks use independent actual-ATK Burn injury rather than Arts scale, RES or attack output multiplier',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,receipts}=make({rank}),e=enemy(b,{res:60});b.addBuff(u,{key:'output-only',mods:{atkScaleMul:2}});cast(b,u);shot(b,u,e);advance(b,.8);near(100000-e.hp,u.s.atk*u.skill.bb.atk_scale*2*.4);near(e.elem.burn,u.s.atk*(talent(u)+u.skill.bb.ep_damage_ratio));assert.equal(own(receipts,u)[0].dmg.isSkill,true);assert.equal(u.skill.active,false);}
});
test('S1 automatic activation consumes one ready charge on its next attack and returns ordinary Arts',()=>{
 const{b,u}=make({elite:0}),e=enemy(b);u.skill.rule='AUTO';u.skill.setSpTotal(u.skill.spCost);u.atkCd=0;b.step();u.atkCd=1000;advance(b,.8);near(100000-e.hp,u.s.atk*u.skill.bb.atk_scale);near(e.elem.burn,u.s.atk*u.skill.bb.ep_damage_ratio);assert.equal(u.skill.charges,0);u.skill.rule='NEVER';u.skill.setSpTotal(0);const hp=e.hp,gauge=e.elem.burn;shot(b,u,e);advance(b,.8);near(hp-e.hp,u.s.atk);near(e.elem.burn,gauge);
});
test('S1 description priority chooses nonburst victim while ordinary default order stays unchanged',()=>{
 const{b,u}=make(),first=enemy(b),second=enemy(b,{x:6.1});b.addBuff(first,{key:'test:burst',flags:{burstLock:true}});assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],first);cast(b,u);assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],second);shot(b,u,first);advance(b,.8);near(first.hp,100000);assert.ok(second.hp<100000);
});
test('S1 pending noSP gate ends at release, retaining selected skill ratio on born flight',()=>{
 const{b,u}=make(),e=enemy(b,{x:7});cast(b,u);shot(b,u,e);assert.equal(u.skill.gainSp(10,'test'),0);advance(b,.45);assert.equal(u.skill.active,false);assert.ok(u.skill.gainSp(1,'test')>0);advance(b,.5);near(e.elem.burn,u.s.atk*(talent(u)+u.skill.bb.ep_damage_ratio));
});
test('S1 CAST reselects entering victims and rejects range exit, hidden or target-free release inputs',()=>{
 for(const state of['entrant','leave','hidden','free']){const{b,u}=make(),old=enemy(b),next=enemy(b,{x:15});cast(b,u);shot(b,u,old);if(state==='entrant'){move(b,old,15);move(b,next,6);}if(state==='leave')move(b,old,15);if(state==='hidden')old.hidden=true;if(state==='free')b.addBuff(old,{key:'free',flags:{untargetable:true}});advance(b,.8);near(old.hp,100000);assert.equal(next.hp<100000,state==='entrant');assert.equal(b.projectiles.list.length,0);}
});
test('S1 dead-input recovery refunds only an un-emitted release, not a selected live replacement',()=>{
 for(const replacement of[false,true]){const{b,u}=make(),old=enemy(b),next=replacement?enemy(b,{x:7}):null;cast(b,u);shot(b,u,old);b.kill(old,null);advance(b,.8);assert.equal(u.skill.charges,replacement?0:1);if(next)assert.ok(next.hp<100000);}
});
test('S1 born flight target death spends its charge and source retreat preserves emitted selected injury',()=>{
 for(const dying of[false,true]){const{b,u}=make(),e=enemy(b,{x:7});cast(b,u);shot(b,u,e);advance(b,.45);assert.equal(b.projectiles.list.length,1);if(dying)b.kill(e,null);else b.retreat(u);advance(b,.7);assert.equal(u.skill.charges,0);if(!dying)near(e.elem.burn,u.s.atk*(talent(u)+u.skill.bb.ep_damage_ratio));}
});
test('accepted-output bridge creates talent and skill injury through absorbed Arts, but not dodge, cancel or invulnerability',()=>{
 for(const state of['shield','dodge','cancel','immune']){const{b,u}=make(),e=enemy(b);if(state==='shield')b.addBuff(e,{key:state,shield:100000});if(state==='dodge')b.addBuff(e,{key:state,mods:{dodgeArts:1}});if(state==='immune')b.addBuff(e,{key:state,flags:{invulnerable:true}});if(state==='cancel')b.on('hit',c=>{if(c.source===u&&c.dmg.type==='arts')c.dmg.cancel=true;});cast(b,u);shot(b,u,e);advance(b,.8);near(e.hp,100000);near(e.elem.burn,state==='shield'?u.s.atk*(talent(u)+u.skill.bb.ep_damage_ratio):0);assert.equal(!!e.findBuff(`bobb_t_1[mark]:${u.id}`),state==='shield');}
});
test('scoped damage observer does not borrow unrelated, nested or later Arts output',()=>{
 const{b,u}=make(),e=enemy(b),z=enemy(b,{x:7});const before=b._hooks.damaged.length;cast(b,u);shot(b,u,e);advance(b,.8);assert.equal(b._hooks.damaged.length,before);b.dealDamage(u,z,{amount:10,type:'arts',isAttack:true,attackId:500});near(z.elem.burn,0);assert.equal(z.findBuff(`bobb_t_1[mark]:${u.id}`),null);
});
test('ordinary and S1 sub-tick control cancel unborn shots while rejected immunity preserves release',()=>{
 for(const skilled of[false,true])for(const immune of[false,true]){const{b,u}=make(),e=enemy(b);if(skilled)cast(b,u);if(immune)u.def.immune.add('stun');shot(b,u,e);b.applyStatus(u,'stun',{duration:.001});advance(b,.9);assert.equal(e.hp<100000,immune);assert.equal(e.elem.burn>0,immune);}
});
test('S2 requires a legal ground input, retains full-SP readiness on empty/air-only field, then admits ground',()=>{
 const{b,u}=make({skill:1});u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),false);assert.equal(u.skill.ready,true);enemy(b,{fly:true});assert.equal(b.activateOperator(ID),false);enemy(b,{x:7});assert.equal(b.activateOperator(ID),true);
});
test('S2 all ranks deal selected Arts and independent Burn to every ground rectangle victim without duplication',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,receipts}=make({skill:1,rank}),e=enemy(b,{res:60}),z=enemy(b,{y:6,res:60}),outside=enemy(b,{x:7}),air=enemy(b,{y:4,fly:true});cast(b,u);advance(b,.6);for(const v of[e,z]){near(100000-v.hp,u.s.atk*u.skill.bb['attack@atk_scale']*.4);near(v.elem.burn,u.s.atk*(talent(u)+u.skill.bb['attack@ep_damage_ratio']));assert.equal(own(receipts,u,v).length,1);}near(outside.hp,100000);near(air.hp,100000);}
});
test('S2 exact perpendicular1x3 versus3x1 field geometry follows all four facings and literal box edges',()=>{
 for(const dir of['RIGHT','LEFT','UP','DOWN']){const{b,u}=make({skill:1,dir}),p=point(dir),main=enemy(b,p),horizontal=['UP','DOWN'].includes(dir),inside=enemy(b,{x:p.x+(horizontal?1.49:.49),y:p.y+(horizontal?.49:1.49)}),outside=enemy(b,{x:p.x+(horizontal?1.51:.51),y:p.y+(horizontal?.49:1.49)});cast(b,u);advance(b,.6);assert.ok(main.hp<100000);assert.ok(inside.hp<100000);near(outside.hp,100000);const f=u.mem.bobbingFields[0];near(f.width,horizontal?3:1);near(f.height,horizontal?1:3);}
});
test('S2 large-body rectangle overlap is included independently from centre outside literal box',()=>{
 const{b,u}=make({skill:1}),e=enemy(b),large=enemy(b,{x:7});large.hitArea={w:1.2,h:1,dx:0,dy:0};cast(b,u);advance(b,.6);assert.ok(e.hp<100000);assert.ok(large.hp<100000);
});
test('S2 .5 CAST uses current selected ground tile and static field stays after victim leaves/dies',()=>{
 const{b,u}=make({skill:1}),old=enemy(b);cast(b,u);advance(b,.2);move(b,old,15);const next=enemy(b,{x:7});advance(b,.4);near(u.mem.bobbingFields[0].x,7);b.kill(next,null);const entrant=enemy(b,{x:7,y:6});advance(b,1);assert.ok(entrant.hp<100000);near(old.hp,100000);near(u.mem.bobbingFields[0].x,7);
});
test('S2 static field applies only legal ground victims, accepting camouflage but rejecting invisibility/hidden/free/Sleep',()=>{
 const{b,u}=make({skill:1}),main=enemy(b),camou=enemy(b,{y:6}),stealth=enemy(b,{y:4}),hidden=enemy(b,{x:6.1}),free=enemy(b,{x:6.2}),sleep=enemy(b,{x:6.3});b.addBuff(camou,{key:'camou',flags:{camou:true}});b.addBuff(stealth,{key:'stealth',flags:{stealth:true}});hidden.hidden=true;b.addBuff(free,{key:'free',flags:{untargetable:true}});b.applyStatus(sleep,'sleep',{duration:5});cast(b,u);advance(b,.6);assert.ok(main.hp<100000);assert.ok(camou.hp<100000);for(const e of[stealth,hidden,free,sleep])near(e.hp,100000);
});
test('S2 accepted sub-tick child interruption keeps main11s lock; immune rejection preserves born field',()=>{
 for(const immune of[false,true]){const{b,u}=make({skill:1}),e=enemy(b);if(immune)u.def.immune.add('stun');cast(b,u);advance(b,.1);b.applyStatus(u,'stun',{duration:.001});advance(b,.6);assert.equal(u.mem.bobbingFields.length,immune?1:0);assert.equal(e.hp<100000,immune);assert.equal(u.skill.active,true);assert.equal(effectiveProfile(u).noAttack,true);assert.equal(u.skill.gainSp(1,'test'),0);advance(b,10.5);assert.equal(u.skill.active,false);assert.equal(!!u.s.flags.disarm,false);}
});
test('S2 born field ignores later operator stun, preserves own cadence and changes victim membership each pulse',()=>{
 const{b,u,receipts}=make({skill:1}),e=enemy(b),late=enemy(b,{x:10});cast(b,u);advance(b,.6);b.applyStatus(u,'stun',{duration:3});move(b,e,10);move(b,late,6);advance(b,1);assert.equal(own(receipts,u,e).length,1);assert.equal(own(receipts,u,late).length,1);assert.equal(u.mem.bobbingFields.length,1);
});
test('S2 field11life is independent from main11s and ordinary attacks/SP resume before field11.5 expiry',()=>{
 const{b,u,receipts}=make({skill:1}),e=enemy(b);cast(b,u);advance(b,10.8);assert.equal(u.skill.active,true);assert.equal(u.stats.attacks,0);assert.equal(own(receipts,u,e).length,11);advance(b,.3);assert.equal(u.skill.active,false);assert.equal(u.mem.bobbingFields.length,1);assert.equal(!!effectiveProfile(u).noAttack,false);assert.ok(u.skill.gainSp(1,'test')>0);u.atkCd=0;b.step();u.atkCd=1000;advance(b,.6);assert.equal(u.stats.attacks,1);assert.equal(own(receipts,u,e).length,12);assert.equal(u.mem.bobbingFields.length,0);
});
test('S2 actual source retreat/death/hide cancels born field and releases unowned watches, not just main mode',()=>{
 for(const invalid of['retreat','death','hide']){const{b,u,receipts}=make({skill:1}),e=enemy(b);cast(b,u);advance(b,.6);if(invalid==='retreat')b.retreat(u);if(invalid==='death')b.kill(u,null);if(invalid==='hide')u.hidden=true;advance(b,1);assert.equal(u.mem.bobbingFields.length,0);assert.equal(own(receipts,u,e).length,1);assert.equal(b._sched.filter(x=>x.interval>0&&!x.cancelled&&x.owner==null).length,0);}
});
test('S2 parent ending restores mode without prematurely removing independent born projectile',()=>{
 const{b,u,receipts}=make({skill:1}),e=enemy(b);cast(b,u);advance(b,.6);u.skill.end('test');assert.equal(u.mem.regularFormVisual,null);assert.equal(!!u.s.flags.disarm,false);advance(b,1);assert.equal(own(receipts,u,e).length,2);assert.equal(u.mem.bobbingFields.length,1);advance(b,10);assert.equal(u.mem.bobbingFields.length,0);
});
test('S2 samples later current ATK per pulse, and per-victim T1 is not recreated on each field tick',()=>{
 const{b,u,receipts}=make({skill:1}),e=enemy(b);cast(b,u);advance(b,.6);const first=u.s.atk;const n=e.elem.burn;b.addBuff(u,{key:'late',mods:{atkPct:.5}});advance(b,1);near(e.elem.burn-n,u.s.atk*(talent(u)+u.skill.bb['attack@ep_damage_ratio']));const damage=own(receipts,u,e);near(damage[0].amount,first*u.skill.bb['attack@atk_scale']);near(damage[1].amount,u.s.atk*u.skill.bb['attack@atk_scale']);assert.equal(e.buffs.filter(x=>x.key===`bobb_t_1[mark]:${u.id}`).length,1);
});
test('S2 uses only literal Begin1.2 then Idle and clears at parent end without invented End across all facings',()=>{
 for(const dir of['RIGHT','LEFT','UP','DOWN']){const{b,u}=make({skill:1,dir});enemy(b,point(dir));cast(b,u);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');advance(b,1.3);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');u.skill.end('test');assert.equal(u.mem.regularFormVisual,null);assert.equal(u.mem.bobbingCast,null);}
});
test('actual standard1000 Burn injury bursts and locks further talent/field gauge until recovery',()=>{
 const{b,u}=make({skill:1}),e=enemy(b);delete e.gaugeMax;near(e.gaugeMax,1000);e.elem.burn=999;cast(b,u);advance(b,.6);assert.ok(e.findBuff('burnBurst'));near(e.elem.burn,1000);advance(b,2);near(e.elem.burn,1000);assert.ok(e.findBuff('burnBurst'));
});
