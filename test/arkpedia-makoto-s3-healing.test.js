// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as base,advance,near,until} from './helpers/makoto-fixture.js';
import {MakotoSkillThreeHealing,MAKOTO_S3_HEALING_CONTRACT as CONTRACT,verifyMakotoS3Healing} from '../server/sim/content/arkpedia-makoto-s3-healing.js';
import {makotoS3HealingInputs} from '../server/sim/content/arkpedia-makoto-source.js';
const active=new Set();
test.afterEach(()=>{for(const f of active){f.combat.stop();f.combat.drain();assert.deepEqual(f.b.errors,[]);}active.clear();});
function make({inPersona,defer=false,...build}={}){
 const f=base({...build,skill:3,defer:true});f.controller.stop();f.allow=false;f.heals=[];
 f.combat=new MakotoSkillThreeHealing(f.b,f.u,{contract:CONTRACT,inPersona:inPersona?()=>inPersona(f):()=>f.allow});
 f.b._setupUnit(f.u,{trait:f.combat.trait(),talents:[],skill:{kind:'instant',completeOnAttack:false,trigger:{rule:'NEVER'}}});f.combat.install();
 f.b.on('calculatedHeal',h=>{if(h.opts.tags?.includes('makoto:s3-heal'))f.heals.push({...h,time:f.b.time});});
 active.add(f);if(!defer)f.deploy();return f;
}
function ally(f,{row=5,col=6,ratio=.1,flags={},kind='op'}={}){
 const t=f.b._makeAlly(f.u.player,f.u.def,kind,row,col,{dir:'RIGHT'});f.b._setupUnit(t,{trait:{noAttack:true,noBlock:true},talents:[],skill:{kind:'passive'}});
 f.u.player.dp=99;assert.ok(f.b._deploy(t,{initial:false}));t.base.maxHp=10000;t.markDirty();t.hp=t.s.maxHp*ratio;
 f.b.addBuff(t,{key:'fixture:recipient',flags});return t;
}
const enter=f=>{f.allow=true;advance(f.b,f.b.dt);};
const child=(f,t)=>[...f.combat.pending].find(p=>p.target===t);
for(const rank of Array.from({length:10},(_,i)=>i+1))test(`P2 rank${rank} attaches a half-second child and restores the selected amount once at finish`,()=>{
 const f=make({rank}),t=ally(f),hp=t.hp;enter(f);const p=child(f,t);assert.ok(p);assert.equal(p.buff.duration,.5);near(p.endAt-p.bornAt,.5);assert.equal(t.hp,hp);advance(f.b,.4);assert.equal(t.hp,hp);
 until(f,()=>f.heals.some(h=>h.target===t));f.allow=false;near(t.hp-hp,f.u.s.atk*f.record.bb['attack@heal_scale']);assert.equal(f.heals.filter(h=>h.target===t).length,1);
 assert.equal(p.finished,true);assert.equal(f.b.projectiles.list.length,0);assert.equal(f.receipts.length,0);
});
test('P2 starts with an entry pulse and preserves the selected world cadence independently of source attack speed and slowdown',()=>{
 const f=make(),t=ally(f);f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true,disarm:true,silence:true},mods:{aspd:500,slowDownMul:0}});enter(f);
 const first=child(f,t).bornAt;until(f,()=>f.heals.filter(h=>h.target===t).length===3,3);f.allow=false;
 const heals=f.heals.filter(h=>h.target===t);near(heals[1].time-heals[0].time,1);near(heals[2].time-heals[1].time,1);assert.ok(heals[0].time>=first+.5-1e-6);
 assert.equal(f.u.mem.regularFormVisual.clip,'Doll_Skill_3_P2_Loop');assert.equal(f.u.mem.regularVisualDirection,'DOWN');
});
test('P2 chooses the four lowest HP ratios with latest deployment ties, then stable IDs; full-HP self is eligible',()=>{
 const f=make(),a=ally(f,{ratio:.6}),z=ally(f,{col:4,ratio:.2}),b=ally(f,{row:6,col:5,ratio:.2}),c=ally(f,{row:4,col:5,ratio:.1}),d=ally(f,{row:5,col:7,ratio:.5});
 enter(f);const ts=[...f.combat.pending].map(p=>p.target);assert.deepEqual(ts.map(t=>t.id),[c,b,z,d].map(t=>t.id));assert.equal(ts.includes(a),false);assert.equal(ts.includes(f.u),false);
});
test('Self and full-HP legal allies can receive a finish heal without inventing an injured-only filter',()=>{
 const f=make(),t=ally(f,{ratio:1});enter(f);assert.ok(child(f,t));assert.ok(child(f,f.u));until(f,()=>f.heals.length>=2);f.allow=false;near(t.hp,t.s.maxHp);assert.equal(f.heals.filter(h=>h.target===t).length,1);
});
for(const flags of [{healFree:true},{noHeal:true},{untargetable:true},{isolated:true}])test(`Native healing selection excludes ${JSON.stringify(flags)}`,()=>{
 const f=make(),t=ally(f,{flags});enter(f);assert.equal(child(f,t),undefined);advance(f.b,.7);assert.equal(f.heals.some(h=>h.target===t),false);
});
test('Hidden, device and far inputs cannot borrow range extension; an airborne ally can receive the original ALL-motion heal',()=>{
 const f=make(),h=ally(f),d=ally(f,{col:4,kind:'device'}),far=ally(f,{col:10}),air=ally(f,{row:6,col:5});h.hidden=true;air.motion='FLY';
 f.b.addBuff(f.u,{key:'fixture:extension',mods:{rangeExtend:10}});enter(f);for(const t of [h,d,far])assert.equal(child(f,t),undefined);assert.ok(child(f,air));
});
test('A born heal keeps its recipient when it leaves range and becomes target-free',()=>{
 const f=make(),t=ally(f),hp=t.hp;enter(f);t.x+=10;t.tileC+=10;f.b.addBuff(t,{key:'fixture:free',flags:{untargetable:true}});f.allow=false;
 until(f,()=>f.heals.some(h=>h.target===t));near(t.hp-hp,f.u.s.atk*f.record.bb['attack@heal_scale']);
});
test('Mode departure stops new pulses but leaves already born finish heals alive',()=>{
 const f=make(),t=ally(f);enter(f);f.allow=false;until(f,()=>f.heals.some(h=>h.target===t));advance(f.b,2);assert.equal(f.heals.filter(h=>h.target===t).length,1);assert.equal(f.combat.pending.size,0);
});
test('Ordinary dispel runs native ON_BUFF_FINISH once; duplicate retained callbacks cannot heal again',()=>{
 const f=make(),t=ally(f),hp=t.hp;enter(f);const p=child(f,t),finish=p.buff.onRemove;f.b.removeBuff(t,p.buff);near(t.hp-hp,f.u.s.atk*f.record.bb['attack@heal_scale']);
 finish();p.buff.onExpire();assert.equal(f.heals.filter(h=>h.target===t).length,1);assert.equal(f.combat.pending.has(p),false);
});
for(const how of ['retreat','death','replacement','hide'])test(`Recipient ${how} cannot inherit a born heal`,()=>{
 const f=make(),t=ally(f),hp=t.hp;enter(f);f.allow=false;if(how==='retreat')f.b.retreat(t);if(how==='death')f.b.kill(t,null);if(how==='replacement')t.deploySeq++;if(how==='hide')t.hidden=true;
 advance(f.b,.7);assert.equal(f.heals.some(h=>h.target===t),false);if(how!=='death')near(t.hp,hp);assert.equal(f.combat.pending.size,0);
});
for(const how of ['retreat','death','replacement'])test(`Source ${how} preserves a born recipient finish heal with its original ledger`,()=>{
 const f=make(),t=ally(f),oldLedger=f.u.stats,amount=f.u.s.atk*f.record.bb['attack@heal_scale'];enter(f);f.allow=false;
 if(how==='retreat')f.b.retreat(f.u);if(how==='death')f.b.kill(f.u,null);if(how==='replacement')f.u.deploySeq++;
 f.u.stats={...f.u.stats,heal:0};f.u.base.atk=1;f.u.markDirty();until(f,()=>f.heals.some(h=>h.target===t));near(t.hp-1000,amount);near(f.u.stats.heal,0);near(oldLedger.heal,amount);
});
test('A matching live source uses finish-time ATK and output healing modifiers; receiver modifiers run once',()=>{
 const f=make(),t=ally(f);enter(f);f.allow=false;f.b.addBuff(f.u,{key:'fixture:power',mods:{atkPct:1,healingDealtMul:2}});f.b.addBuff(t,{key:'fixture:incoming',mods:{healingTakenMul:.5}});
 until(f,()=>f.heals.some(h=>h.target===t));near(t.hp-1000,f.u.s.atk*f.record.bb['attack@heal_scale']);
});
test('A newly heal-free recipient prevents the pending normal heal; it is not HP regeneration',()=>{
 const f=make(),t=ally(f);enter(f);f.allow=false;f.b.addBuff(t,{key:'fixture:noheal',flags:{healFree:true}});advance(f.b,.7);near(t.hp,1000);assert.equal(f.heals.some(h=>h.target===t),false);
});
for(const how of ['reject','recipient','source','key','duration'])test(`beforeBuff ${how} cannot install an inherited or modified heal child`,()=>{
 const f=make(),t=ally(f);f.b.on('beforeBuff',h=>{if(h.unit!==t||!h.buff.key.startsWith('makoto:s3-heal:'))return;
  if(how==='reject')h.cancel=true;if(how==='recipient')t.deploySeq++;if(how==='source')f.u.deploySeq++;if(how==='key')h.buff.key='foreign';if(how==='duration')h.buff.duration=0;
 });enter(f);f.allow=false;advance(f.b,.7);assert.equal(f.heals.some(h=>h.target===t),false);assert.equal(child(f,t),undefined);
});
test('Recursive attachment callbacks cannot issue another producer pulse',()=>{
 const f=make(),t=ally(f);let checks=0;f.b.on('beforeBuff',h=>{if(h.buff.key.startsWith('makoto:s3-heal:')){checks++;assert.equal(f.combat.pulse(),false);}});enter(f);
 assert.equal(checks,2);assert.equal([...f.combat.pending].filter(p=>p.target===t).length,1);
});
test('Battle end removes owned pending buffs without executing their finish heal',()=>{
 const f=make(),t=ally(f);enter(f);f.b.finished=true;f.b.emit('battleEnd',{});advance(f.b,1);assert.equal(f.heals.length,0);assert.equal(f.combat.pending.size,0);assert.equal(f.combat.watchers.length,0);assert.equal(t.buffs.some(b=>b.key.startsWith('makoto:s3-heal:')),false);
});
test('Fresh selected S3 and an explicit P2 predicate are required',()=>{
 const f=make({defer:true});assert.throws(()=>new MakotoSkillThreeHealing(f.b,f.u),/Fresh selected/);assert.throws(()=>f.combat.install(),/reinstalled/);
 const other=base({skill:2,defer:true});other.controller.stop();assert.throws(()=>new MakotoSkillThreeHealing(other.b,other.u,{contract:CONTRACT,inPersona:()=>true}),/Fresh selected/);
});
for(const [label,edit]of[
 ['ordinary attack',n=>n.mode._attack.m_PathID='1'],['instant heal',n=>n.heal._activeBuffs[0].blackboard[0].value=0],['ground selector',n=>n.selector._targetMotion=1],
 ['missing finish',n=>n.templates.makoto_s3_2_be_healed.eventToActions.ON_BUFF_FINISH[0]._useBlackboardHealScale=false],['slowdown',n=>n.heal._affectedBySlowDown=1],
 ['overriding recipient',n=>n.heal._activeBuffs[0].disableOverride=0],['silenced producer',n=>n.producer._buffs[0].isSilenceable=1],
])test(`Changed original P2 ${label} is rejected`,()=>{const n=structuredClone(makotoS3HealingInputs());edit(n);assert.throws(()=>verifyMakotoS3Healing(n),/Changed original/);});
test('An explicit pulse cannot bypass the native producer interval',()=>{
 const f=make(),t=ally(f);enter(f);const before=[...f.combat.pending].filter(p=>p.target===t).length;assert.equal(f.combat.pulse(),false);assert.equal([...f.combat.pending].filter(p=>p.target===t).length,before);
});
test('A recursive form query cannot fabricate an entry pulse before the producer claims it',()=>{
 let armed=true,nested;const f=make({inPersona:f=>{if(f.allow&&armed){armed=false;nested=f.combat.pulse();}return f.allow;}}),t=ally(f);enter(f);
 assert.equal(nested,false);assert.equal([...f.combat.pending].filter(p=>p.target===t).length,1);
});
test('Changed child remaining time cannot shorten the source half-second delay',()=>{
 const f=make(),t=ally(f);f.b.on('beforeBuff',h=>{if(h.unit===t&&h.buff.key.startsWith('makoto:s3-heal:'))h.buff.timeLeft=0;});enter(f);f.allow=false;advance(f.b,.7);assert.equal(f.heals.some(h=>h.target===t),false);
});
test('A recipient callback cannot issue another child outside the claimed producer input',()=>{
 const f=make(),t=ally(f);f.b.on('beforeBuff',h=>{if(h.buff.key.startsWith('makoto:s3-heal:'))assert.equal(f.combat.attach(t,t.deploySeq),null);});enter(f);assert.equal([...f.combat.pending].filter(p=>p.target===t).length,1);
});
test('Reentrant finish callbacks claim each born heal before ordinary modifier hooks',()=>{
 const f=make(),t=ally(f);enter(f);f.allow=false;const p=child(f,t);f.b.on('heal',h=>{if(h.target===t){f.combat.finish(p);p.buff.onRemove();}});
 until(f,()=>f.heals.some(h=>h.target===t));assert.equal(f.heals.filter(h=>h.target===t).length,1);
});
test('Replaced recipient during the actual heal modifier cannot inherit old HP or credit',()=>{
 const f=make(),t=ally(f);enter(f);f.allow=false;f.b.on('heal',h=>{if(h.target===t)t.deploySeq++;});advance(f.b,.7);near(t.hp,1000);near(f.u.stats.heal,0);
});
