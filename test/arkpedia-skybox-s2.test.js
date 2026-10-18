// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,enemy,near,advance,until} from './helpers/skybox-fixture.js';
import {prepareSkyboxS2,SKYBOX_S2_CONTRACT,verifySkyboxS2} from '../server/sim/content/arkpedia-skybox-s2.js';
import {skyboxNativeInputs,skyboxSourceComponent,SKYBOX_ID} from '../server/sim/content/arkpedia-skybox-source.js';
import {explicitBlockMode} from '../server/sim/block-mode.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
const fixtures=[];
const make=opts=>{const f=fixture({skill:2,...opts,prepare:(b,u)=>prepareSkyboxS2(b,u,{contract:SKYBOX_S2_CONTRACT})});fixtures.push(f);return f;};
test.afterEach(()=>{for(const f of fixtures.splice(0))assert.deepEqual(f.b.errors,[]);});
const hits=f=>f.hits.filter(h=>h.dmg.tags.includes('skybox:s2'));
const cast=f=>{f.u.skill.addCharge(1);assert.equal(f.u.skill.activate('manual'),true);};
const mode=f=>until(f,()=>f.flight.mode===2);
const rounds=(f,n)=>until(f,()=>f.u.skill.ammoLeft===n,30);
const close=f=>assert.equal(f.controller.discard(),true);
const done=f=>until(f,()=>!f.u.skill.active,30);
test('S2 account requires its selected source and rejects mutated progress, counter, burst and selector facts',()=>{
 verifySkyboxS2();assert.throws(()=>make({skill:1}),/selected S2/);
 for(const mutate of[n=>n.s2._canCastDuringBorn=0,n=>n.s2._burstOnOverload=0,n=>n.s2._finishSkillWithProgress=0,
  n=>n.templates['skybx_s_2[ammo_assign]'].eventToActions.ON_BUFF_START[1]._abilityName='unknown']){
  const n=structuredClone(skyboxNativeInputs());mutate(n);assert.throws(()=>verifySkyboxS2(n),/Changed original/);
 }
 for(const [id,key,value]of[['-7408980494276821745','_additionalTimes',8],['-7408980494276821745','_selectTargetTiming',0],
  ['6385093638462045455','_postFilter',4],['-10982645048738545','_runActionOnEvent',3]])
  assert.throws(()=>verifySkyboxS2(skyboxNativeInputs(),path=>{const a=structuredClone(skyboxSourceComponent('characters',SKYBOX_ID,path));if(path===id)a[key]=value;return a;}),/Changed original/);
});
for(let rank=1;rank<=10;rank++)test(`Rank${rank} naturally charges, manually fires ten source-scaled shells and completes End with no extra shot`,()=>{
 const f=make({rank}),t=enemy(f);advance(f.b,f.u.skill.spCost-f.u.skill.initSp+.1);assert.equal(f.u.skill.ready,true);
 assert.equal(f.u.skill.activations,0);assert.equal(f.u.skill.activate('manual'),true);mode(f);assert.equal(explicitBlockMode(f.u),'WALK');
 assert.equal(f.u.skill.ammoLeft,10);done(f);until(f,()=>hits(f).length===10);near(t.s.maxHp-t.hp,10*f.u.s.atk*f.record.bb['attack@atk_scale']);
 assert.equal(f.receipts.length,10);assert.equal(f.flight.mode,0);assert.equal(explicitBlockMode(f.u),'FLY');assert.equal(f.payload.flights.size,0);
 advance(f.b,.2);assert.ok(f.u.skill.sp>0);assert.equal(f.controller.phase,null);
});
test('No target is required during Born; an empty mode keeps its ammo and SP lock until manual discard',()=>{
 const f=make();cast(f);assert.equal(f.flight.mode,1);mode(f);advance(f.b,5);assert.equal(f.u.skill.ammoLeft,10);assert.equal(f.receipts.length,0);
 assert.equal(f.u.skill.gainSp(100,'fixture'),0);close(f);assert.equal(f.flight.mode,3);done(f);assert.equal(hits(f).length,0);
});
test('Ordinary aerial attacks stop in ground-only S2, but an aerial bystander can receive its independently mixed-motion splash',()=>{
 const f=make(),g=enemy(f),a=enemy(f,{col:7.5,motion:'FLY'});until(f,()=>f.hits.length===1);assert.equal(f.hits[0].target.id,a.id);near(g.hp,g.s.maxHp);
 cast(f);mode(f);until(f,()=>hits(f).length===2);assert.equal(f.receipts.filter(r=>r.isSkill).length,1);assert.equal(f.u.skill.ammoLeft,9);
 f.b.kill(g,null);const shots=f.receipts.length;advance(f.b,4);assert.equal(f.receipts.length,shots);assert.equal(f.u.skill.ammoLeft,9);
 close(f);done(f);until(f,()=>f.receipts.length>shots);assert.equal(f.receipts.at(-1).isSkill,false);
});
for(const dir of['RIGHT','LEFT','UP','DOWN'])test(`${dir} uses literal Begin/loop/End clips and retains a single primary per ammo`,()=>{
 const f=make({dir}),row=dir==='UP'?7:dir==='DOWN'?3:5,col=dir==='RIGHT'?7:dir==='LEFT'?3:5;enemy(f,{row,col});cast(f);mode(f);
 until(f,()=>f.controller.phase?.s2);assert.equal(f.u.mem.regularFormVisual.clip,dir==='DOWN'?'Skill_Down_2_Loop':'Skill_2_Loop');
 rounds(f,9);assert.equal(f.receipts.length,1);assert.equal(f.flight.modeParent.times,9);close(f);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');done(f);
});
test('Skill grid applies only in mode2 and resets before the independent End clip',()=>{
 const f=make();cast(f);assert.deepEqual(f.u.liveRangeGrid,f.record.rangeGrid);mode(f);assert.deepEqual(f.u.liveRangeGrid,f.record.skillRangeGrid);
 close(f);assert.deepEqual(f.u.liveRangeGrid,f.record.rangeGrid);done(f);
});
test('Early manual discard before overload creates no Close or synthetic burst',()=>{
 const f=make();enemy(f);cast(f);rounds(f,8);const n=f.receipts.length;close(f);assert.equal(f.flight.mode,3);assert.equal(f.controller.canCancel(),false);
 done(f);assert.equal(f.receipts.length,n);assert.equal(hits(f).length,2);
});
for(const left of[5,4,3,2,1])test(`Overload manual Close uses exactly${left} remaining shells, not the serialized default eight`,()=>{
 const f=make();enemy(f);cast(f);rounds(f,left);const start=f.b.time,n=f.receipts.length;close(f);
 assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Close');assert.equal(f.controller.phase.count,left);assert.equal(f.controller.canCancel(),false);
 advance(f.b,.2);assert.equal(f.receipts.length,n);done(f);until(f,()=>hits(f).length===10);assert.equal(f.receipts.length,n+left);
 near(f.b.time-start,2,.08);assert.equal(f.flight.mode,0);assert.equal(f.controller.phase,null);
});
test('The shared HUD switches from the upper ammo half to overload and blocks another Close while bursting',()=>{
 const f=make();enemy(f);cast(f);rounds(f,6);let hud=skillHud(f.u.skill);near(hud.fraction,.2);assert.equal(hud.state,'active');assert.equal(hud.canCancel,true);
 rounds(f,5);hud=skillHud(f.u.skill);near(hud.fraction,1);assert.equal(hud.state,'overloaded');assert.equal(hud.canCancel,true);
 close(f);hud=skillHud(f.u.skill);assert.equal(hud.canCancel,false);done(f);
});
test('Random Close reselects at each original marker/interval instead of locking every shell to one retained input',()=>{
 const f=make(),a=enemy(f),z=enemy(f,{row:6,col:7});cast(f);rounds(f,5);const n=f.receipts.length,values=[0,.99,0,.99,0];let calls=0;
 f.b.rng=()=>values[calls++]??0;const times=[];f.b.on('attack',c=>{if(c.attacker===f.u&&f.controller.phase?.kind==='s2-close')times.push(f.b.time);});
 close(f);done(f);const burst=f.receipts.slice(n);assert.equal(calls,5);assert.deepEqual(burst.map(r=>r.targets[0].id),[a.id,z.id,a.id,z.id,a.id]);
 for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]>=1/30-1e-7&&times[i]-times[i-1]<=2/30+1e-7);
});
test('Empty Close slots neither invent targets nor consume ammo receipts; the fixed Close/End discards the remainder',()=>{
 const f=make(),a=enemy(f);cast(f);rounds(f,5);f.b.kill(a,null);const n=f.receipts.length;close(f);advance(f.b,.8);
 assert.equal(f.u.skill.ammoLeft,5);assert.equal(f.receipts.length,n);done(f);assert.equal(f.flight.mode,0);
});
for(const change of['dead','replacement','hidden'])test(`A ${change} captured loop input before birth rejects the shot and preserves ammo`,()=>{
 const f=make(),t=enemy(f);cast(f);mode(f);until(f,()=>f.controller.phase?.s2);if(change==='dead')f.b.kill(t,null);
 if(change==='replacement'){t.deploySeq++;t.x=15;t.y=15;}if(change==='hidden')t.hidden=true;advance(f.b,1);
 assert.equal(f.u.skill.ammoLeft,10);assert.equal(f.receipts.length,0);assert.equal(hits(f).length,0);close(f);done(f);
});
for(const flag of['stun','disarm','hidden'])test(`Brief ${flag} during Close cancels only unborn slots and completes return`,()=>{
 const f=make();enemy(f);cast(f);rounds(f,5);close(f);until(f,()=>f.receipts.length===6);
 if(flag==='hidden')f.u.hidden=true;else f.b.applyStatus(f.u,flag,{duration:.1});advance(f.b,.04);if(flag==='hidden')f.u.hidden=false;
 done(f);assert.equal(f.receipts.length,6);until(f,()=>hits(f).length===6);assert.equal(f.flight.mode,0);
});
test('A refused ammo_assign command cannot fabricate a remaining-ammo burst or retire the live account',()=>{
 const f=make();enemy(f);cast(f);rounds(f,5);f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('skybx_s_2[ammo_assign]:'))c.cancel=true;});
 assert.equal(f.controller.discard(),false);assert.equal(f.flight.mode,2);assert.equal(f.u.skill.active,true);assert.notEqual(f.controller.phase?.kind,'s2-close');
 done(f);assert.equal(f.receipts.length,10);
});
test('Refusing the independent counter command preserves actual ammo while declining its mode-parent copy',()=>{
 const f=make();enemy(f);cast(f);mode(f);f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('skybx_s_2[counter]:'))c.cancel=true;});rounds(f,9);
 assert.equal(f.flight.modeParent.times,10);assert.equal(f.u.skill.ammoLeft,9);close(f);done(f);
});
test('Free-shot hooks use the existing ammo account and do not fabricate a counter decrement',()=>{
 const f=make();enemy(f);cast(f);mode(f);f.b.on('beforeAmmoUse',c=>{if(c.unit===f.u)c.spareShotProb=1;});
 until(f,()=>f.receipts.length===3);assert.equal(f.u.skill.ammoLeft,10);assert.equal(f.flight.modeParent.times,10);close(f);done(f);
});
test('Control and ASPD cannot scale Close, but the loop retains source-capped attack playback',()=>{
 const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd:300,slowDownMul:.1}});cast(f);rounds(f,5);
 const start=f.b.time;close(f);until(f,()=>f.flight.mode===3);near(f.b.time-start,1,.04);done(f);near(f.b.time-start,2,.08);
});
for(const reason of['retreat','death','replacement','battleEnd'])test(`${reason} during Close drains owned account/mode/listeners and never issues old-life subshots`,()=>{
 const f=make();enemy(f);cast(f);rounds(f,5);close(f);const n=f.receipts.length;
 if(reason==='retreat')f.b.retreat(f.u);if(reason==='death')f.b.kill(f.u,null);if(reason==='replacement'){f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'replacement'};advance(f.b,.1);}
 if(reason==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}advance(f.b,3);
 assert.equal(f.controller.stopped,true);assert.equal(f.controller.handles.length,0);assert.equal(f.controller.accountHandles.length,0);assert.equal(f.flight.handles.length,0);
 assert.equal(f.flight.s2Grants.size,0);assert.equal(f.flight.modeParent,null);assert.equal(f.talent.handles.length,0);assert.equal(f.receipts.length,n);
 if(reason!=='replacement')assert.equal(f.u.skill.active,false);else assert.equal(f.u.mem.regularFormVisual.playId,'replacement');
});
test('BeforeAttack veto and recursive forcing cannot duplicate Close launch or ammo consumption',()=>{
 for(const veto of[true,false]){const f=make(),a=enemy(f);cast(f);rounds(f,5);const n=f.receipts.length;
  f.b.on('beforeAttack',c=>{if(c.attacker!==f.u||f.controller.phase?.kind!=='s2-close')return;if(veto)c.targets=[];else f.b.forceAttack(f.u,[a]);});
  close(f);done(f);assert.equal(f.receipts.length,veto?n:n+5);
 }
});
test('Missing mode1 Die2 and Back death tracks use an explicit hide policy; Front mode2/3 uses literal Die_2',()=>{
 const f=make();cast(f);assert.equal(f.u.mem.regularDeathVisual.hide,true);mode(f);assert.equal(f.u.mem.regularDeathVisual.clip,'Die_2');
 close(f);assert.equal(f.u.mem.regularDeathVisual.clip,'Die_2');done(f);assert.equal(f.u.mem.regularDeathVisual.clip,'Die');
 const back=make({dir:'UP'});cast(back);mode(back);assert.equal(back.u.mem.regularDeathVisual.hide,true);close(back);done(back);
});

test('An accepted final loop retains its original completion boundary before End and keeps SP locked',()=>{
 const f=make();enemy(f);cast(f);rounds(f,0);assert.equal(f.flight.mode,2);assert.equal(f.u.skill.active,true);
 assert.equal(f.u.skill.gainSp(100,'fixture'),0);assert.equal(f.flight.modeParent.times,0);until(f,()=>f.flight.mode===3);
 assert.equal(f.u.skill.active,true);assert.equal(f.u.skill.gainSp(100,'fixture'),0);done(f);
});
for(const point of['parent','counter','assign'])test(`Retirement inside ${point} admission cannot leave a late account, resource or Close shot`,()=>{
 const f=make();enemy(f);if(point!=='parent'){cast(f);if(point==='assign')rounds(f,5);else mode(f);}
 const n=f.receipts.length,key={parent:'skybx_s_2[switch_mode]',counter:'skybx_s_2[counter]',assign:'skybx_s_2[ammo_assign]'}[point];
 f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith(key+':'))f.b.retreat(f.u);});
 if(point==='parent')cast(f);else if(point==='assign')assert.equal(f.controller.discard(),false);else until(f,()=>f.controller.stopped);
 advance(f.b,2);assert.equal(f.controller.stopped,true);assert.equal(f.u.skill.active,false);assert.equal(f.flight.modeParent,null);
 assert.equal(f.u.buffs.some(b=>b.data?.skyboxS2Command||b.data?.skyboxS2Flight),false);assert.equal(f.receipts.length,n+(point==='counter'?1:0));
});
for(const change of['retreat','replacement'])test(`Owner ${change} inside Close beforeAttack rejects old-life shell and preserves replacement presentation`,()=>{
 const f=make();enemy(f);cast(f);rounds(f,5);const n=f.receipts.length;
 f.b.on('beforeAttack',c=>{if(c.attacker!==f.u||f.controller.phase?.kind!=='s2-close')return;
  if(change==='retreat')f.b.retreat(f.u);else{f.u.deploySeq++;f.u.mem.regularFormVisual={clip:'Idle',playId:'replacement'};}});
 close(f);advance(f.b,2);assert.equal(f.receipts.length,n);assert.equal(f.controller.stopped,true);assert.equal(f.flight.modeParent,null);
 if(change==='replacement')assert.equal(f.u.mem.regularFormVisual.playId,'replacement');
});
for(const kind of['loop','close'])test(`External account end during ${kind} cancels unborn output, preserves born transport and completes End`,()=>{
 const f=make();enemy(f);cast(f);if(kind==='close'){rounds(f,5);close(f);until(f,()=>f.receipts.length===6);}else rounds(f,9);
 const n=f.receipts.length;f.u.skill.end('fixture:external');assert.equal(f.flight.mode,3);advance(f.b,1.2);
 assert.equal(f.receipts.length,n);assert.equal(hits(f).length,n);assert.equal(f.flight.mode,0);assert.equal(f.payload.flights.size,0);assert.equal(f.payload.watchers.length,0);
});
test('Foreign source-parent removal enters one End, releases ground blocking immediately and ends the matching account',()=>{
 const f=make();enemy(f);cast(f);mode(f);f.b.removeBuff(f.u,f.flight.modeParent.buff);assert.equal(f.flight.mode,3);
 assert.equal(explicitBlockMode(f.u),'FLY');done(f);assert.equal(f.flight.mode,0);assert.equal(f.flight.modeParent,null);
});
test('Refusing the source mode parent cannot fabricate a landed active skill or leave its spent account locked',()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('skybx_s_2[switch_mode]:'))c.cancel=true;});cast(f);
 assert.equal(f.u.skill.active,false);assert.equal(f.flight.mode,0);assert.equal(f.flight.modeParent,null);advance(f.b,.5);assert.ok(f.u.skill.sp>0);
});
test('Extra shared ammunition appears in the same capacity/HUD and the counter uses actual remaining count',()=>{
 const f=make();enemy(f);f.b.on('skillStart',c=>{if(c.unit===f.u)f.u.skill.ammoLeft+=2;});cast(f);mode(f);
 assert.equal(f.u.skill.ammoMax,12);rounds(f,6);assert.equal(f.flight.modeParent.times,6);assert.equal(f.controller.overloaded(),true);close(f);
 assert.equal(f.controller.phase.count,6);done(f);until(f,()=>hits(f).length===12);assert.equal(f.receipts.length,12);
});
