// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,ally,finish,near,advance} from './helpers/yukari-fixture.js';
import {YukariFinishHealing,YUKARI_TALENT_CONTRACT,verifyYukariTalent} from '../server/sim/content/arkpedia-yukari-talent.js';
import {yukariNativeInputs,yukariSourceComponent} from '../server/sim/content/arkpedia-yukari-source.js';
const fs=[],make=opts=>{const f=fixture(opts);fs.push(f);return f;};test.afterEach(()=>{for(const f of fs.splice(0))assert.deepEqual(f.b.errors,[]);});
const hurt=(u,ratio=.1)=>u.hp=u.s.maxHp*ratio;
test('Exact original talent contract and fresh selected source are required; E0 never gains a parent',()=>{
 verifyYukariTalent();assert.throws(()=>make({contract:{...YUKARI_TALENT_CONTRACT}}),/exact talent/);const f=make({elite:0});const a=ally(f);hurt(f.u);finish(f);assert.equal(f.talent.parent,null);assert.equal(f.heals.length,0);near(a.hp,1000);assert.throws(()=>new YukariFinishHealing(f.b,f.u,{contract:YUKARI_TALENT_CONTRACT}),/Fresh selected/);
});
for(const what of['parent','silence','control','priority','withdraw','alive','ability','derived','immediate','healFree','self','range','excludeOwner','motion','count','hpPriority'])test(`Changed ${what} cannot retain the original finish-heal contract`,()=>{
 const n=structuredClone(yukariNativeInputs()),a=n.templates.yukari_t.eventToActions.ON_SKILL_FINISH,read=(...args)=>{const v=structuredClone(yukariSourceComponent(...args));
  if(args[2]==='-3445508239539231991'&&what==='self')v.m_Script.m_PathID='0';
  if(args[2]==='-2169707945135561975'){if(what==='excludeOwner')v._excludeOwner=0;if(what==='motion')v._targetMotion=2;if(what==='count')v._maxTargetKey='max_target2';if(what==='hpPriority')v._postFilter=4;}return v;};
 if(what==='parent')n.talent._buffs[0].buffKey='other';if(what==='silence')n.talent._buffs[0].isSilenceable=1;if(what==='control')n.talent._buffs[0].isStunnable=1;if(what==='priority')n.templates.yukari_t.onEventPriority='DEFAULT';
 if(what==='withdraw')a[0]._finishReason='NORMAL_EXIT';if(what==='alive')a[2]._ownerType='TARGET';if(what==='ability')a[3]._abilityName='Other';if(what==='derived')a[3]._isDerivedBuff=true;if(what==='immediate')a[3]._buff.lifeTimeType='INFINITY';
 if(what==='healFree')n.templates['yukari_t[heal]'].eventToActions.ON_BUFF_START[0]._ignoreHealFree=true;if(what==='range')n.healSelector._rangeSelectorsList.reverse();assert.throws(()=>verifyYukariTalent(n,read),/Changed original/);
});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)test(`Selected S${skill} rank${rank} heals self and three other recipients from talent BB, not S2's separate target count`,()=>{
 const f=make({skill,rank});hurt(f.u);const as=[.4,.3,.2,.1].map(hpRatio=>ally(f,{hpRatio})),before=as.map(a=>a.hp),own=f.u.hp,amount=f.u.s.atk*f.talent.bb.heal_scale;
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate(),true);assert.equal(f.heals.length,0);f.u.skill.end('source');assert.equal(f.heals.length,4);near(f.u.hp-own,amount);
 assert.deepEqual(f.heals.map(h=>h.target.id),[f.u.id,...as.slice(1).reverse().map(a=>a.id)]);near(as[0].hp,before[0]);for(let i=1;i<4;i++)near(as[i].hp-before[i],amount);assert.equal(f.talent.grants.size,1);
});
for(const potential of[1,6])for(const trust of[0,200])test(`E1 P${potential}/trust${trust} retains two-other limit and half live ATK`,()=>{
 const f=make({elite:1,potential,trust});hurt(f.u);const as=[ally(f),ally(f),ally(f)];finish(f);assert.equal(f.heals.length,3);near(f.heals[0].amount,f.u.s.atk*.5);near(as[0].hp,1000);assert.ok(as[1].hp>1000&&as[2].hp>1000);
});
test('The higher-priority finish action precedes default listeners and never heals after ordinary attacks',()=>{
 const f=make();hurt(f.u);const a=ally(f);let observed=0;f.b.on('skillEnd',()=>observed=a.hp);f.b.emit('attack',{attacker:f.u,targets:[],isSkill:false});assert.equal(f.heals.length,0);finish(f);assert.ok(observed>1000);
});
test('Current ordinary range excludes outside allies but self remains independent of range and secondary targetability',()=>{
 const f=make();hurt(f.u);const outside=ally(f,{col:15}),inside=ally(f);f.b.addBuff(f.u,{key:'fixture:self',flags:{isolated:true,noHeal:true,untargetable:true}});f.u.hidden=true;finish(f);
 assert.equal(f.heals.length,2);near(outside.hp,1000);assert.ok(inside.hp>1000);assert.ok(f.u.hp>f.u.s.maxHp*.1);
});
for(const flag of['isolated','healFree','noHeal','untargetable','hidden'])test(`Secondary ${flag} does not consume the healable target slots`,()=>{
 const f=make(),a=ally(f,{flags:flag==='hidden'?{}:{[flag]:true}}),other=ally(f);if(flag==='hidden')a.hidden=true;hurt(f.u);finish(f);near(a.hp,1000);assert.ok(other.hp>1000);assert.equal(f.heals.length,2);
});
test('NoHeal on self is separate from healFree; source control and Silence do not silence the finish-heal parent',()=>{
 const f=make(),a=ally(f);hurt(f.u);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate(),true);
 f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true,silence:true,noHeal:true}});f.u.skill.end('control');assert.equal(f.heals.length,2);assert.ok(a.hp>1000);assert.equal(f.u.canAct,false);
 const g=make();hurt(g.u);g.b.addBuff(g.u,{key:'fixture:healFree',flags:{healFree:true}});finish(g);assert.equal(g.heals.length,0);near(g.u.hp,g.u.s.maxHp*.1);
});
test('Full-HP selected lives issue legal zero-restoration actions without over-healing or credit',()=>{
 const f=make();ally(f,{hpRatio:1});finish(f);assert.equal(f.heals.length,2);near(f.u.stats.heal,0);near(f.u.hp,f.u.s.maxHp);
});
test('Selection is captured once, keeps current lives, and does not backfill when one becomes ineligible',()=>{
 const f=make(),as=[.1,.2,.3,.4].map(hpRatio=>ally(f,{hpRatio}));hurt(f.u);let changed=false;
 f.b.on('heal',c=>{if(c.source!==f.u||changed)return;changed=true;as[0].hidden=true;as[3].hp=1;as[1].x=15;as[1].y=15;});finish(f);
 assert.equal(f.heals.length,3);near(as[0].hp,1000);assert.ok(as[1].hp>2000&&as[2].hp>3000);assert.equal(as[3].hp,1);
});
test('Live ATK and shared outgoing/incoming healing modifiers are read per separately admitted action',()=>{
 const f=make(),a=ally(f),base=f.u.s.atk;hurt(f.u);f.b.addBuff(a,{key:'fixture:incoming',mods:{healingTakenMul:1.5}});let changed=false;
 f.b.on('heal',c=>{if(c.source===f.u&&!changed){changed=true;f.b.addBuff(f.u,{key:'fixture:output',mods:{atkPct:1,healingDealtMul:2}});}});finish(f);
 near(f.heals[0].amount,base);near(f.heals[1].amount,base*2*2*1.5);
});
test('The same source activation is claimed before heal callbacks can recursively replay its finish event',()=>{
 const f=make();hurt(f.u);ally(f);let receipt;f.b.on('skillEnd',c=>{receipt=c;},{priority:200});f.b.on('heal',()=>f.b.emit('skillEnd',receipt));finish(f);assert.equal(f.heals.length,2);f.b.emit('skillEnd',receipt);assert.equal(f.heals.length,2);
});
test('A still-active or foreign account cannot fabricate finish healing',()=>{
 const f=make();hurt(f.u);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate(),true);const ctx={unit:f.u,skill:f.u.skill,activation:f.u.skill.activations};f.b.emit('skillEnd',ctx);f.b.emit('skillEnd',{...ctx,skill:{...f.u.skill,active:false}});assert.equal(f.heals.length,0);f.u.skill.end();assert.equal(f.heals.length,1);
});
test('A recast inside onEnd keeps the old finish identity and does not consume the new account',()=>{
 const f=make();hurt(f.u);const a=ally(f);f.u.skill.spec.onEnd=()=>{f.u.skill.spec.onEnd=null;f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate(),true);};finish(f);
 assert.equal(f.u.skill.active,true);assert.equal(f.u.skill.activations,2);assert.deepEqual(f.heals.map(h=>h.opts.yukariActivation),[1,1]);f.u.skill.end();assert.deepEqual(f.heals.map(h=>h.opts.yukariActivation),[1,1,2,2]);assert.ok(a.hp>1000);
});
test('An independently finished nested activation is allowed exactly once while the old accepted batch retains its targets',()=>{
 const f=make();hurt(f.u);ally(f);let nested=false;f.b.on('heal',()=>{if(!nested){nested=true;finish(f);}});finish(f);assert.equal(f.heals.length,4);assert.deepEqual(f.heals.map(h=>h.opts.yukariActivation),[1,2,2,1]);
});
test('An arbitrary finish-reason string is not mistaken for actual owner withdrawal',()=>{const f=make();hurt(f.u);finish(f,'WITHDRAW');assert.equal(f.heals.length,1);});
for(const why of['retreat','death','stop','replacement','battleEnd'])test(`${why} prevents later output and drains only owned source resources`,()=>{
 const f=make();hurt(f.u);ally(f);f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate(),true);const foreign=f.b.addBuff(f.u,{key:'fixture:foreign',mods:{defPct:.1}});
 if(why==='retreat')f.b.retreat(f.u);if(why==='death')f.b.kill(f.u,null);if(why==='stop')f.talent.stop();if(why==='replacement'){f.u.deploySeq++;advance(f.b,.1);}if(why==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}
 if(f.u.skill.active)f.u.skill.end();advance(f.b,.1);assert.equal(f.heals.length,0);assert.equal(f.talent.handles.length,0);assert.equal(f.talent.grants.size,0);if(!['retreat','death'].includes(why))assert.ok(f.u.buffs.includes(foreign));
});
for(const where of['parent','recipient'])for(const mutation of['veto','mods','flags','prefinish'])test(`${mutation} during ${where} admission cannot fabricate a heal`,()=>{
 const f=make({defer:true,beforeInstall:(b,u)=>b.on('beforeBuff',c=>{if(!(where==='parent'?c.buff.key.startsWith('yukari_t:'):c.buff.key.startsWith('yukari_t[heal]:')))return;
  if(mutation==='veto')c.cancel=true;if(mutation==='mods')c.buff.mods={atkPct:99};if(mutation==='flags')c.buff.flags={noSp:true};if(mutation==='prefinish')c.buff.onRemove();})});f.deploy();hurt(f.u);ally(f);finish(f);assert.equal(f.heals.length,0);assert.equal(f.talent.grants.size,where==='parent'?0:1);
});
test('Parent dispel inside an accepted nonderived batch preserves its immediate recipients but blocks future finish events',()=>{
 const f=make();hurt(f.u);ally(f);let removed=false;f.b.on('beforeBuff',c=>{if(!removed&&c.buff.key.startsWith('yukari_t[heal]:')){removed=true;f.b.removeBuff(f.u,f.talent.parent.buff);}});finish(f);assert.equal(f.heals.length,2);assert.equal(f.talent.grants.size,0);finish(f);assert.equal(f.heals.length,2);f.talent.stop();assert.equal(f.talent.handles.length,0);
});
test('Source death inside one accepted secondary heal keeps that packet on the old ledger and cancels unborn recipients',()=>{
 const f=make(),a=ally(f),z=ally(f,{hpRatio:.2});f.b.addBuff(f.u,{key:'fixture:selfFree',flags:{healFree:true}});const ledger=f.u.stats;let killed=false;
 f.b.on('heal',()=>{if(!killed){killed=true;f.b.kill(f.u,null);}});finish(f);assert.equal(f.heals.length,1);assert.ok(a.hp>1000);near(z.hp,2000);near(ledger.heal,f.heals[0].amount);assert.equal(f.talent.grants.size,0);assert.equal(f.talent.handles.length,0);
});
test('Replacement inside an accepted heal cannot give the new source life its old healing credit',()=>{
 const f=make(),a=ally(f);f.b.addBuff(f.u,{key:'fixture:selfFree',flags:{healFree:true}});const ledger=f.u.stats;f.b.on('heal',()=>{f.u.deploySeq++;f.u.stats={...f.u.stats,heal:0};});finish(f);advance(f.b,.1);assert.ok(a.hp>1000);near(ledger.heal,f.heals[0].amount);near(f.u.stats.heal,0);assert.equal(f.talent.grants.size,0);
});
test('Recipient replacement and foreign buff replacement inside callbacks cannot inherit or be removed by the old grant',()=>{
 const f=make(),a=ally(f);hurt(f.u);let foreign;
 f.b.on('heal',c=>{if(c.target!==a)return;a.deploySeq++;const own=a.buffs.find(x=>x.data?.yukariHeal);f.b.removeBuff(a,own);foreign=f.b.addBuff(a,{key:own.key,mods:{defPct:.2}});});finish(f);near(a.hp,1000);assert.ok(a.buffs.includes(foreign));assert.equal(f.talent.grants.size,1);
});
test('Duplicate deployment and repeated stop do not re-grant the passive or remove foreign state',()=>{
 const f=make(),parent=f.talent.parent;f.b.emit('deploy',{unit:f.u,move:false});assert.equal(f.talent.parent===parent,true);assert.throws(()=>f.talent.install(),/reinstalled/);const other=f.b.addBuff(f.u,{key:'fixture:foreign'});f.talent.stop();f.talent.stop();assert.ok(f.u.buffs.includes(other));assert.equal(f.talent.handles.length,0);assert.equal(f.talent.grants.size,0);
});
