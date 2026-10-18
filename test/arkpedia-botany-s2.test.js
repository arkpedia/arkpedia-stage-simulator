// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,enemy,near,advance,until,burst} from './helpers/botany-fixture.js';
import {prepareBotanyS2,BOTANY_S2_CONTRACT,verifyBotanyS2} from '../server/sim/content/arkpedia-botany-s2.js';
import {botanyNativeInputs} from '../server/sim/content/arkpedia-botany-source.js';
import {absoluteRangeKeys} from '../server/sim/targeting.js';
import {COLS} from '../server/sim/constants.js';
const make=opts=>fixture({skill:2,prepare:(b,u)=>prepareBotanyS2(b,u,{contract:BOTANY_S2_CONTRACT}),...opts});
const hp=f=>f.hits.filter(h=>h.dmg.tags.includes('botany:s2'));
const extra=f=>f.hits.filter(h=>h.dmg.tags.includes('botany:s2-extra'));
const injury=f=>f.hits.filter(h=>h.dmg.tags.includes('botany:s2-injury'));
const cast=f=>{f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('manual'),true);};
const mode=f=>until(f,()=>f.controller.mode);
const phase=f=>until(f,()=>f.controller.phase?.kind==='s2');
const born=f=>until(f,()=>f.controller.flights.size>0);
const landed=(f,count=1)=>until(f,()=>injury(f).length>=count);
const range=(f,skill=false)=>absoluteRangeKeys(skill?f.record.skillRangeGrid:f.record.rangeGrid,f.u.tileR,f.u.tileC,f.u.dir);
const clean=t=>assert.ok(!t.buffs.some(b=>b.key.startsWith('botany_s2_extra:')));
test('S2 retains exact original mode, selector, projectile, physical rider and both literal End edges',()=>{
 assert.throws(()=>fixture({skill:2,prepare:(b,u)=>prepareBotanyS2(b,u,{contract:{...BOTANY_S2_CONTRACT}})}),/exact controller contract/);
 assert.throws(()=>make({skill:1}),/selected Botany S2/);verifyBotanyS2();
 for(const change of[n=>n.s2._rangeIdModeIndex=0,n=>n.modes[1].attack._projectileKey='invented',n=>n.templates.botany_s2_extra.eventToActions.ON_BUFF_START[0]._damageType='MAGICAL',
  n=>n.artController._mixSettings.pop()]){const n=structuredClone(botanyNativeInputs());change(n);assert.throws(()=>verifyBotanyS2(n),/Changed original/);}
});
for(let rank=1;rank<=10;rank++)test(`Selected S2 rank${rank} releases one receipt to two retained inputs with independent original Arts, physical and erosion`,()=>{
 const f=make({rank}),a=enemy(f),b=enemy(f),third=enemy(f);cast(f);phase(f);
 assert.deepEqual(f.controller.phase.targets.map(t=>t.id),[a.id,b.id]);landed(f,2);const bb=f.record.bb,atk=f.u.s.atk;
 assert.equal(f.receipts.length,1);assert.equal(hp(f).length,2);assert.equal(extra(f).length,2);assert.equal(injury(f).length,2);
 for(const h of hp(f))near(h.amount,atk);for(const h of extra(f))near(h.amount,atk*bb['attack@extra_atk_scale']);
 for(const h of injury(f))near(h.amount,atk*bb['attack@ep_damage_ratio']);near(third.hp,third.s.maxHp);near(third.elem.erosion,0);
 assert.equal(f.u.s.atk,f.u.base.atk);assert.equal(f.u.skill.gainSp(5,'fixture'),0);clean(a);clean(b);
});
test('The manual account includes Begin; only accepted mode completion expands source range and recovery',()=>{
 const f=make();cast(f);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Begin');assert.equal(f.controller.mode,false);
 assert.deepEqual(f.u.rangeKeys,range(f));advance(f.b,.3);assert.equal(f.controller.mode,false);assert.equal(f.u.skill.sp,0);
 mode(f);assert.deepEqual(f.u.rangeKeys,range(f,true));assert.ok(f.u.skill.timeLeft<f.record.source.duration);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Idle');
});
test('An original y-7-only tile can really be attacked while mode is active and disappears after expiry',()=>{
 const f=make(),base=new Set(range(f)),key=range(f,true).find(k=>!base.has(k)),t=enemy(f,{row:Math.floor(key/COLS),col:key%COLS});
 advance(f.b,1.1);assert.equal(f.receipts.length,0);cast(f);landed(f);assert.equal(hp(f)[0].target.id,t.id);f.u.skill.end('fixture');
 assert.deepEqual(f.u.rangeKeys,range(f));advance(f.b,2);assert.equal(f.hits.filter(h=>h.dmg.tags.includes('botany:ordinary')).length,0);
});
test('Natural SP becomes ready without automatically spending this manual account',()=>{
 const f=make();advance(f.b,21);assert.equal(f.u.skill.ready,true);assert.equal(f.u.skill.activations,0);assert.equal(f.controller.mode,false);
 assert.equal(f.u.skill.activate('manual'),true);mode(f);assert.equal(f.u.skill.activations,1);
});
test('S2 can cast during original Start without a target and does not invent an immediate attack',()=>{
 const f=make();assert.equal(f.u.mem.regularFormVisual.clip,'Start');cast(f);mode(f);assert.equal(f.receipts.length,0);
 assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Idle');assert.equal(f.u.skill.active,true);
});
test('Mode-entry preserves positive ordinary cooldown and cancels its unfired input',()=>{
 const f=make();enemy(f);until(f,()=>!!f.controller.phase);assert.equal(f.controller.phase.shot.isSkill,false);const before=f.u.atkCd;
 cast(f);mode(f);assert.ok(f.u.atkCd>0);assert.ok(f.u.atkCd<before);assert.equal(f.receipts.length,0);landed(f);assert.equal(f.receipts[0].isSkill,true);
});
test('S2 caps playback at the original speed while preserving separate marker, flight and sampled attack clocks',()=>{
 const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:fast',mods:{aspd:200}});cast(f);phase(f);
 const p=f.controller.phase,start=f.b.time;near(p.speed,1);near(p.releaseAge,.5);near(f.u.atkCd,Math.max(f.u.s.interval,.5));
 advance(f.b,.45);assert.equal(f.receipts.length,0);assert.equal(hp(f).length,0);born(f);
 assert.ok(f.b.time-start>=.5-1e-7);assert.equal(f.receipts.length,1);assert.equal(hp(f).length,0);
 const projectile=[...f.controller.flights.keys()][0];near(projectile.speed,12);near(projectile.maxAge,10);landed(f);
});
for(const dir of['RIGHT','LEFT','UP','DOWN'])test(`Selected S2 range, original facing and arrival work when deployed ${dir}`,()=>{
 const f=make({dir}),key=range(f,true).find(k=>k>=0&&k<19*COLS&&k!==f.u.tileR*COLS+f.u.tileC),
  t=enemy(f,{row:Math.floor(key/COLS),col:key%COLS});cast(f);landed(f);
 assert.equal(hp(f)[0].target.id,t.id);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Loop');
 assert.ok(['RIGHT','LEFT','UP','DOWN'].includes(f.u.mem.regularVisualDirection));
 assert.equal(f.u.mem.regularFormVisual.loop,false);
});
test('Rejected mode leaves a still-running account with ordinary single-target behavior and base range',()=>{
 const f=make(),a=enemy(f),b=enemy(f,{row:6});f.b.on('beforeBuff',c=>{if(c.buff.key==='botany_s_2')c.cancel=true;});cast(f);advance(f.b,1.5);
 assert.equal(f.controller.mode,false);assert.equal(f.u.skill.active,true);assert.equal(f.u.skill.sp,0);assert.deepEqual(f.u.rangeKeys,range(f));
 assert.equal(f.hits.filter(h=>h.dmg.tags.includes('botany:ordinary')).length,1);assert.equal(injury(f).length,0);assert.equal(extra(f).length,0);
 assert.ok(f.receipts.every(r=>!r.isSkill));near(b.hp,b.s.maxHp);clean(a);
});
test('A foreign mode buff is never adopted, refreshed or removed',()=>{
 const f=make(),foreign=f.b.addBuff(f.u,{key:'botany_s_2',source:{},duration:99});cast(f);advance(f.b,1);
 assert.equal(f.controller.mode,false);assert.deepEqual(f.u.rangeKeys,range(f));f.u.skill.end('fixture');assert.ok(f.u.buffs.includes(foreign));
});
test('A pre-finished mode grant cannot leave late range or recovery output',()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(c.buff.key==='botany_s_2')c.buff.onRemove();});cast(f);advance(f.b,1);
 assert.equal(f.controller.mode,false);assert.ok(!f.u.findBuff('botany_s_2'));assert.deepEqual(f.u.rangeKeys,range(f));assert.equal(f.recovery.records.size,0);
});
test('External mode removal cancels unfired S2 work, restores range and recovery, but does not release the account SP lock',()=>{
 const f=make(),t=enemy(f);cast(f);phase(f);burst(f,t);assert.ok(f.recovery.records.size>0);f.b.removeBuff(f.u,f.controller.modeBuff);
 assert.equal(f.controller.mode,false);assert.equal(f.u.skill.active,true);assert.equal(f.u.skill.sp,0);assert.deepEqual(f.u.rangeKeys,range(f));
 assert.equal(f.recovery.records.size,0);advance(f.b,.6);assert.equal(f.receipts.length,0);assert.equal(extra(f).length,0);
});
test('The exact Idle-to-Idle End edge plays half a second and then returns to ordinary idle',()=>{
 const f=make();cast(f);mode(f);f.u.skill.end('fixture');assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');
 advance(f.b,.4);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');advance(f.b,.15);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');
 assert.ok(f.u.skill.sp>0);assert.equal(f.controller.mode,false);
});
test('The literal Loop-to-Attack edge selects End only for a next eligible ordinary attack',()=>{
 const f=make();enemy(f);cast(f);phase(f);f.u.atkCd=0;f.u.skill.end('fixture');
 assert.equal(f.controller.phase.kind,'end');assert.equal(f.controller.phase.destination,'Attack');assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');
 advance(f.b,.55);assert.equal(f.u.mem.regularFormVisual.clip,'Attack');until(f,()=>f.hits.some(h=>h.dmg.tags.includes('botany:ordinary')));
 assert.equal(hp(f).length,0);assert.equal(extra(f).length,0);
});
test('Loop-to-Idle has no invented End and preserves a positive attack cooldown',()=>{
 const f=make();enemy(f);cast(f);phase(f);const cd=f.u.atkCd;f.u.skill.end('fixture');assert.equal(f.u.mem.regularFormVisual.clip,'Idle');
 near(f.u.atkCd,cd);advance(f.b,.5);assert.equal(f.receipts.length,0);
});
test('Idle-to-Attack has no invented End when a legal ordinary input appears at exit',()=>{
 const f=make();cast(f);mode(f);enemy(f);f.u.skill.end('fixture');assert.equal(f.u.mem.regularFormVisual.clip,'Attack');
 assert.notEqual(f.controller.phase?.kind,'end');
});
test('Natural duration restores source mode/range and SP while removing only owned recovery',()=>{
 const f=make(),t=enemy(f);cast(f);mode(f);burst(f,t);until(f,()=>!f.u.skill.active,40);
 assert.equal(f.controller.mode,false);assert.deepEqual(f.u.rangeKeys,range(f));assert.equal(f.recovery.records.size,0);assert.equal(f.u.s.atk,f.u.base.atk);
 advance(f.b,.1);assert.ok(f.u.skill.sp>0);assert.ok(!f.u.findBuff('botany_s_2'));
});
test('Natural idle expiry preserves the original End transition for its entire half second',()=>{
 const f=make();cast(f);mode(f);until(f,()=>!f.u.skill.active,40);
 assert.equal(f.controller.phase?.kind,'end');assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');
 advance(f.b,.4);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');advance(f.b,.15);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');
});
test('An account ending after external mode removal cannot cancel or restart its already-running End',()=>{
 const f=make();cast(f);mode(f);f.u.skill.timeLeft=.25;f.b.removeBuff(f.u,f.controller.modeBuff);
 const deadline=f.controller.phase.until;advance(f.b,.3);assert.equal(f.u.skill.active,false);
 assert.equal(f.controller.phase.until,deadline);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');
 advance(f.b,.25);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');
});
test('Transient control before an S2 marker cancels the unfired phase without ending the manual account',()=>{
 const f=make();enemy(f);cast(f);phase(f);f.b.applyStatus(f.u,'stun',{duration:.01});advance(f.b,.7);
 assert.equal(f.receipts.length,0);assert.equal(f.u.skill.active,true);assert.ok(f.u.atkCd>0);assert.equal(f.u.skill.sp,0);
});
test('Begin continues through control and a controlled active owner still supplies the original recovery aura',()=>{
 const f=make(),t=enemy(f);cast(f);f.b.applyStatus(f.u,'stun',{duration:2});mode(f);burst(f,t);const before=t.findBuff('erosionBurst').timeLeft;
 advance(f.b,1);near(t.findBuff('erosionBurst').timeLeft,before-1.25);assert.equal(f.receipts.length,0);assert.equal(f.u.skill.active,true);
});
test('Lost retained inputs cannot be replaced by a third target during the same release',()=>{
 const f=make(),a=enemy(f),b=enemy(f),third=enemy(f);cast(f);phase(f);assert.deepEqual(f.controller.phase.targets.map(t=>t.id),[a.id,b.id]);
 f.b.kill(a,null);b.deploySeq++;advance(f.b,.7);assert.equal(f.receipts.length,0);near(third.hp,third.s.maxHp);near(third.elem.erosion,0);
});
test('One lost input leaves only the other captured life and one real attack receipt',()=>{
 const f=make(),a=enemy(f),b=enemy(f),third=enemy(f);cast(f);phase(f);assert.deepEqual(f.controller.phase.targets.map(t=>t.id),[a.id,b.id]);f.b.kill(a,null);landed(f);
 assert.equal(f.receipts.length,1);assert.equal(hp(f).length,1);assert.equal(hp(f)[0].target.id,b.id);near(third.hp,third.s.maxHp);
});
for(const kind of['duplicate','foreign','reentrant'])test(`S2 admission rejects forged inputs or duplicate receipts (${kind})`,()=>{
 const f=make(),a=enemy(f),b=enemy(f),third=enemy(f);cast(f);phase(f);assert.deepEqual(f.controller.phase.targets.map(t=>t.id),[a.id,b.id]);
 f.b.on('beforeAttack',c=>{if(c.attacker!==f.u)return;if(kind==='duplicate')c.targets=[a,a];else if(kind==='foreign')c.targets=[third];else f.b.forceAttack(f.u,c.targets);});
 advance(f.b,.8);assert.equal(f.receipts.length,kind==='reentrant'?1:0);assert.equal(hp(f).length,kind==='reentrant'?2:0);
});
test('Primary Arts, independent physical armor and ATK-based erosion use their separate damage paths',()=>{
 const f=make(),t=enemy(f);t.base.res=25;t.base.def=100;t.markDirty();cast(f);landed(f);
 near(hp(f)[0].amount,f.u.s.atk*.75);near(extra(f)[0].amount,f.u.s.atk*1.5-100);near(injury(f)[0].amount,f.u.s.atk*.65);clean(t);
});
test('Independent physical dodge and full HP shields do not turn erosion into HP-damage scaling',()=>{
 const f=make(),t=enemy(f);f.b.addBuff(t,{key:'fixture:avoid',mods:{dodgePhys:1},shield:1e7});cast(f);landed(f);
 near(t.hp,t.s.maxHp);assert.equal(extra(f).length,0);near(injury(f)[0].amount,f.u.s.atk*.65);clean(t);
});
test('Rejected physical-extra admission preserves primary Arts and independent erosion',()=>{
 const f=make(),t=enemy(f);f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('botany_s2_extra:'))c.cancel=true;});cast(f);landed(f);
 assert.equal(hp(f).length,1);assert.equal(extra(f).length,0);assert.equal(injury(f).length,1);clean(t);
});
test('A born S2 projectile keeps its original payload after account expiry',()=>{
 const f=make(),t=enemy(f);cast(f);born(f);f.u.skill.end('fixture');landed(f);assert.equal(f.controller.mode,false);assert.equal(extra(f).length,1);clean(t);
});
test('Source replacement during first arrival cannot donate attributes to either old target payload',()=>{
 const f=make(),a=enemy(f),b=enemy(f,{row:6}),atk=f.u.s.atk;let changed=false;
 f.b.on('damaged',c=>{if(!changed&&c.dmg.tags.includes('botany:s2')){changed=true;f.b.retreat(f.u);f.u.deploySeq++;f.u.base.atk=9999;
  f.b.addBuff(f.u,{key:'fixture:new-life',mods:{dmgDealtMul:9}});f.u.markDirty();}});cast(f);landed(f,2);
 for(const h of extra(f))near(h.amount,atk*1.5);for(const h of injury(f))near(h.amount,atk*.65);
 assert.equal(f.controller.handles.length,0);assert.equal(f.recovery.handles.length,0);assert.equal(f.controller.flights.size,0);clean(a);clean(b);
});
for(const tag of['botany:s2','botany:s2-extra'])test(`Recipient replacement inside ${tag} cannot receive later old-life packets`,()=>{
 const f=make(),t=enemy(f);f.b.on('outputDamage',c=>{if(c.dmg.tags.includes(tag)){t.deploySeq++;t.hp=t.s.maxHp;}});cast(f);born(f);advance(f.b,.5);
 near(t.hp,t.s.maxHp);near(t.elem.erosion,0);assert.equal(injury(f).length,0);clean(t);
});
test('Natural repeated S2 attacks cause real erosion bursts, selected talent stacks and accelerated recovery',()=>{
 const f=make(),a=enemy(f),b=enemy(f,{row:6});cast(f);until(f,()=>!!a.findBuff('erosionBurst')&&!!b.findBuff('erosionBurst'));
 near(f.u.s.aspd,112);assert.equal(f.talent.gift.stacks,2);assert.equal(f.recovery.records.size,2);
 const before=a.findBuff('erosionBurst').timeLeft;advance(f.b,1);near(a.findBuff('erosionBurst').timeLeft,before-1.25);clean(a);clean(b);
});
test('Source withdrawal during mode admission cannot leave a late owned mode or range resource',()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(c.buff.key==='botany_s_2')f.b.retreat(f.u);});cast(f);advance(f.b,.6);
 assert.equal(f.controller.handles.length,0);assert.equal(f.recovery.handles.length,0);assert.ok(!f.u.findBuff('botany_s_2'));
});
test('Matching controller removal ends its owned account without removing a later source life account',()=>{
 const f=make();cast(f);mode(f);f.controller.stop();assert.equal(f.u.skill.active,false);assert.equal(!!f.u.s.flags.noSp,false);
 assert.equal(f.recovery.handles.length,0);assert.equal(f.talent.handles.length,0);
 const g=make();cast(g);mode(g);let ends=0;g.u.deploySeq++;g.u.skill={active:true,activations:g.controller.castActivation,end(){ends++;}};
 const visual={clip:'replacement-life'};g.u.mem.regularFormVisual=visual;g.u.mem.regularVisualDirection='UP';
 const keys=g.u.rangeKeys;g.controller.stop();assert.equal(ends,0);assert.equal(g.u.mem.regularFormVisual,visual);
 assert.equal(g.u.mem.regularVisualDirection,'UP');assert.equal(g.u.rangeKeys,keys);
});
