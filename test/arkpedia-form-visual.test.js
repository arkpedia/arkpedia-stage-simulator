// SPDX-License-Identifier: GPL-3.0-or-later
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import evidence from '../data/arkpedia-support-expansion-prefabs.json' with { type: 'json' };
import rmixer from '../data/arkpedia-rmixer-prefabs.json' with { type: 'json' };
import { regularVisualHeight } from '../public/arkpedia/regular-form-visual.js';
import { installFakePixi } from './render/fakepixi.js';
let fake, BattleActor;
before(async()=>{fake=installFakePixi();({BattleActor}=await import('../public/arkpedia/battle-actor.js'));});
after(()=>fake.restore());

test('literal form alias speed scales the transition and its clock without restarting across frames',()=>{
  const entry={anims:{idle:'Idle',attack:{loop:'Attack'}},
    animations:{Idle:1,Attack:1,Skill_End:.8},hits:{Attack:[.3]}};
  const skeleton={animations:Object.keys(entry.animations).map(name=>({name}))};
  const a=new BattleActor(skeleton,entry);
  a.setRegularVisual({clip:'Skill_End',loop:false,speed:2});
  assert.equal(a.current,'Skill_End');assert.equal(a.spine.state.tracks[0].timeScale,2);
  assert.equal(a.changeUntil,.4);const track=a.spine.state.tracks[0];
  a.update(.2);a.setRegularVisual({clip:'Skill_End',loop:false,speed:2});
  assert.equal(a.spine.state.tracks[0],track);
  a.update(.21);assert.equal(a.current,'Idle');
  assert.equal(a.spine.state.tracks[0].timeScale,1);a.destroy();
});

test('literal loop speed remains local to the selected clip and actor and resets with the form',()=>{
  const entry={anims:{idle:'Idle',attack:{loop:'Attack'}},
    animations:{Idle:1,Attack:1,Skill_Loop:.6},hits:{Attack:[.3]}};
  const skeleton={animations:Object.keys(entry.animations).map(name=>({name}))};
  const a=new BattleActor(skeleton,entry),other=new BattleActor(skeleton,entry);
  a.setRegularVisual({clip:'Skill_Loop',loop:true,speed:2});
  assert.equal(a.current,'Skill_Loop');assert.equal(a.spine.state.tracks[0].timeScale,2);
  assert.equal(other.spine.state.tracks[0].timeScale,1);
  a.attack(1,false,{animation:'Attack',windup:.3});
  assert.equal(a.current,'Attack');assert.ok(Math.abs(a.windUntil-a.clock-.3)<1e-9);
  a.update(1.1);assert.equal(a.current,'Skill_Loop');assert.equal(a.spine.state.tracks[0].timeScale,2);
  a.setRegularVisual(null);assert.equal(a.current,'Idle');assert.equal(a.spine.state.tracks[0].timeScale,1);
  a.destroy();other.destroy();
});

test('a changing native clock retimes only the remaining one-shot clip without replaying its beginning', () => {
  const entry = { anims: { idle: 'Idle' }, animations: { Idle: 1, Cast: 1 } };
  const a = new BattleActor({ animations: [{ name: 'Idle' }, { name: 'Cast' }] }, entry);
  const visual = { clip: 'Cast', loop: false, speed: 1, playId: 'cast:1' };
  a.setRegularVisual(visual); a.update(.25);
  const track = a.spine.state.tracks[0]; track.trackTime = .25;
  a.setRegularVisual({ ...visual, speed: .5 });
  assert.equal(a.spine.state.tracks[0], track); assert.equal(track.trackTime, .25);
  assert.equal(track.timeScale, .5); nearDuration(a.changeUntil, 1.75);
  a.update(.25); track.trackTime = .375;
  a.setRegularVisual({ ...visual, speed: 2 });
  assert.equal(a.spine.state.tracks[0], track); assert.equal(track.trackTime, .375);
  assert.equal(track.timeScale, 2); nearDuration(a.changeUntil, .8125);
  a.update(.3124); assert.equal(a.current, 'Cast');
  a.update(.0002); assert.equal(a.current, 'Idle');
  a.setRegularVisual({ ...visual, speed: .5 }); assert.equal(a.current, 'Idle');
  a.setRegularVisual({ ...visual, speed: .5, playId: 'cast:2' });
  assert.equal(a.current, 'Cast'); assert.notEqual(a.spine.state.tracks[0], track);
  nearDuration(a.changeUntil, a.clock + 2); a.destroy();
});

test('loop rate changes preserve phase and keep a frozen source animation frozen', () => {
  const entry = { anims: { idle: 'Idle' }, animations: { Idle: 1, Loop: 1 } };
  const a = new BattleActor({ animations: [{ name: 'Idle' }, { name: 'Loop' }] }, entry);
  a.setRegularVisual({ clip: 'Loop', loop: true, speed: .8 });
  const track = a.spine.state.tracks[0]; track.trackTime = 1.3;
  a.setRegularVisual({ clip: 'Loop', loop: true, speed: .4 });
  assert.equal(a.spine.state.tracks[0], track); assert.equal(track.trackTime, 1.3); assert.equal(track.timeScale, .4);
  a.setBase('stun'); assert.equal(a.frozen, true);
  a.setRegularVisual({ clip: 'Loop', loop: true, speed: .7 });
  assert.equal(a.spine.state.tracks[0], track); assert.equal(track.timeScale, .4); assert.equal(a.frozen, true);
  a.setBase('idle'); assert.equal(a.frozen, false); assert.equal(a.spine.state.tracks[0].timeScale, .7); a.destroy();
});

test('retiming an idle source loop leaves an intervening attack and its deadline unchanged', () => {
  const entry = { anims: { idle: 'Idle', attack: { loop: 'Attack' } },
    animations: { Idle: 1, Loop: 1, Attack: 1 }, hits: { Attack: [.3] } };
  const a = new BattleActor({ animations: Object.keys(entry.animations).map(name => ({ name })) }, entry);
  a.setRegularVisual({ clip: 'Loop', loop: true, speed: 1 });
  a.attack(1, false, { animation: 'Attack', windup: .3 });
  const track = a.spine.state.tracks[0], deadline = a.windUntil, scale = track.timeScale;
  a.setRegularVisual({ clip: 'Loop', loop: true, speed: .2 });
  assert.equal(a.spine.state.tracks[0], track); assert.equal(track.timeScale, scale); assert.equal(a.windUntil, deadline);
  a.update(1.2); assert.equal(a.current, 'Loop'); assert.equal(a.spine.state.tracks[0].timeScale, .2); a.destroy();
});

test('a combat-owned strike keeps its explicit rate even when the resting form uses the same clip', () => {
  const entry = { anims: { idle: 'Idle', attack: { loop: 'Attack' } },
    animations: { Idle: 1, Attack: 1 }, hits: { Attack: [.3] } };
  const a = new BattleActor({ animations: Object.keys(entry.animations).map(name => ({ name })) }, entry);
  a.setRegularVisual({ clip: 'Attack', loop: true, speed: 1 });
  a.attack(1, false, { animation: 'Attack', windup: .3 });
  const track = a.spine.state.tracks[0], deadline = a.windUntil, scale = track.timeScale;
  a.setRegularVisual({ clip: 'Attack', loop: true, speed: .2 });
  assert.equal(a.spine.state.tracks[0], track); assert.equal(track.timeScale, scale); assert.equal(a.windUntil, deadline);
  a.update(1.2); assert.equal(a.current, 'Attack'); assert.equal(a.mode, 'base');
  assert.equal(a.spine.state.tracks[0].timeScale, .2); a.destroy();
});

test('opted-in repeated ability clips restart once for a new identity and stay stable between frames', () => {
  const entry = { anims: { idle: 'Idle', attack: { loop: 'Attack' } },
    animations: { Idle: 1, Attack: 1.2 }, hits: { Attack: [0] } };
  const skeleton = { animations: Object.keys(entry.animations).map(name => ({ name })) };
  const a = new BattleActor(skeleton, entry);
  const visual = { clip: 'Attack', speed: .5, playId: 'life:1:attack:1' };
  a.setRegularVisual(visual); const first = a.spine.state.tracks[0];
  a.update(.4); a.setRegularVisual({ ...visual });
  assert.equal(a.spine.state.tracks[0], first);
  a.update(2.1); assert.equal(a.current, 'Idle');
  a.setRegularVisual({ ...visual, playId: 'life:1:attack:2' });
  assert.equal(a.current, 'Attack'); assert.notEqual(a.spine.state.tracks[0], first);
  assert.equal(a.spine.state.tracks[0].timeScale, .5);
  nearDuration(a.changeUntil - a.clock, 2.4);
  const second = a.spine.state.tracks[0];
  a.setRegularVisual({ ...visual, playId: 'life:1:attack:2' });
  assert.equal(a.spine.state.tracks[0], second); a.destroy();
});
function nearDuration(a, z) { assert.ok(Math.abs(a - z) < 1e-9, `${a} != ${z}`); }

test('Sankta original shot clips return to their selected stance while a long projectile is still flying', () => {
  for (const facing of ['Front', 'Back']) {
    const m = rmixer.models.char_4194_rmixer[facing];
    const entry = { anims: { idle: 'Idle', attack: { loop: 'Attack_Loop' } },
      animations: m.durations, hits: m.hits };
    const skeleton = { animations: Object.keys(m.durations).map(name => ({ name })) };
    const a = new BattleActor(skeleton, entry);
    const s2 = { clip: 'Skill_2_Loop', idle: 'Skill_2_Idle', speed: 1, playId: 'shot:1' };
    a.setRegularVisual(s2); assert.equal(a.current, 'Skill_2_Loop');
    a.update(1.3); assert.equal(a.current, 'Skill_2_Idle');
    const idle = a.spine.state.tracks[0]; a.setRegularVisual({ ...s2 });
    assert.equal(a.spine.state.tracks[0], idle);
    a.setRegularVisual({ ...s2, playId: 'shot:2' }); assert.equal(a.current, 'Skill_2_Loop');
    a.setRegularVisual({ clip: 'Skill_2_End', idle: 'Idle', speed: 1 });
    a.update(.7); assert.equal(a.current, 'Idle'); a.destroy();
  }
});

test('invalid alias speeds fall back to original1 and absent clips never inherit another form speed',()=>{
  const entry={anims:{idle:'Idle',attack:{loop:'Attack'}},animations:{Idle:1,Attack:1,End:.8}};
  const skeleton={animations:Object.keys(entry.animations).map(name=>({name}))};
  for(const speed of[NaN,Infinity,0,-2]) {
    const a=new BattleActor(skeleton,entry);a.setRegularVisual({clip:'End',loop:false,speed});
    assert.equal(a.spine.state.tracks[0].timeScale,1);assert.equal(a.changeUntil,.8);a.destroy();
  }
  const a=new BattleActor(skeleton,entry);a.setRegularVisual({clip:'Missing',loop:true,speed:2});
  assert.equal(a.current,'Idle');assert.equal(a.spine.state.tracks[0].timeScale,1);a.destroy();
});
function actor(id,facing='Front',skill=1) {
  const source=evidence.operators[id].models[facing];
  const roles={idle:'Idle',deploy:'Start',attack:{loop:'Attack'},die:'Die',skills:{
    0:{index:0,begin:'Skill_Begin',loop:'Skill_Loop',idle:'Skill_Idle',end:'Skill_End'},
    1:{index:1,begin:'Skill_2_Begin',loop:'Skill_2_Loop',idle:'Skill_2_Idle',end:'Skill_2_End'},
  }};
  const entry={anims:roles,animations:source.durations,hits:source.hits};
  const skeleton={animations:Object.keys(source.durations).map(name=>({name}))};
  return{a:new BattleActor(skeleton,entry,skill),entry};
}

test('Verdant original transition clips do not restart between frames and restore the selected skill roles',()=>{
  const{a,entry}=actor('char_4107_vrdant');const shared=structuredClone(entry);
  a.setRegularVisual({clip:'SwitchOut',loop:false});assert.equal(a.current,'SwitchOut');
  const track=a.spine.state.tracks[0];a.update(.4);a.setRegularVisual({clip:'SwitchOut',loop:false});
  assert.equal(a.spine.state.tracks[0],track);a.update(.6);
  a.setRegularVisual({clip:'Doll_SwitchIn',loop:false});assert.equal(a.current,'Doll_SwitchIn');
  a.update(1);a.setRegularVisual({clip:'Doll_Idle',loop:true,attack:'Doll_Attack',die:'Doll_Die'});
  assert.equal(a.current,'Doll_Idle');
  a.attack(1.5,false,{animation:'Doll_Attack',windup:.433});assert.equal(a.current,'Doll_Attack');
  assert.ok(Math.abs(a.windUntil-a.clock-.433)<1e-9);a.update(1.5);assert.equal(a.current,'Doll_Idle');
  a.setRegularVisual({clip:'Doll_SwitchOut',loop:false});assert.equal(a.current,'Doll_SwitchOut');
  a.update(1);a.setRegularVisual({clip:'Start',loop:false});assert.equal(a.current,'Start');
  a.update(1);a.setRegularVisual(null);assert.equal(a.roles.skill.index,1);assert.equal(a.current,'Idle');
  assert.deepEqual(entry,shared);a.destroy();
});

test('Contrail chooses exact original downward shots while back skeletons retain their source flying loop',()=>{
  for(const facing of['Front','Back']) {
    const{a}=actor('char_4165_ctrail',facing);
    a.setSkill(true);a.setRegularVisual({clip:'Skill_2_Begin',loop:false});a.update(1);
    a.setRegularVisual({clip:'Skill_2_Idle',loop:true,attack:'Skill_2_Loop'});
    assert.equal(a.current,'Skill_2_Idle');
    a.attack(1.3,false,{animation:'Skill_Down_2_Loop',windup:.533});
    assert.equal(a.current,facing==='Front'?'Skill_Down_2_Loop':'Skill_2_Loop');
    a.update(1.3);a.setSkill(false);a.setRegularVisual({clip:'Skill_2_End',loop:false});
    assert.equal(a.current,'Skill_2_End');a.update(1);a.setRegularVisual(null);
    assert.equal(a.roles.skill.index,1);assert.equal(a.current,'Idle');a.destroy();
  }
});

test('missing literal source clips fail closed without mutating cached model roles',()=>{
  const{a,entry}=actor('char_4107_vrdant','Back'),shared=structuredClone(entry);
  a.setRegularVisual({clip:'Doll_SwitchOut',loop:false});assert.equal(a.current,'Idle');
  a.setRegularVisual({clip:'Doll_Idle',loop:true,attack:'Doll_Attack'});
  a.attack(1.5,false,{animation:'Not_A_Clip',windup:.433});assert.equal(a.current,'Doll_Attack');
  assert.deepEqual(entry,shared);a.destroy();
});

test('source height tween follows the combat clock, clamps at both ends and keeps paused state stable',()=>{
  const rise={height:{start:10.167,from:0,to:.8,duration:.8333}};
  assert.equal(regularVisualHeight(rise,10),0);
  const halfway=regularVisualHeight(rise,10.167+.8333/2);assert.ok(Math.abs(halfway-.4)<1e-9);
  assert.equal(regularVisualHeight(rise,10.167+.8333/2),halfway);
  assert.equal(regularVisualHeight(rise,12),.8);
  const fall={height:{start:20,from:.8,to:0,duration:.8333}};
  assert.equal(regularVisualHeight(fall,19),.8);assert.equal(regularVisualHeight(fall,22),0);
  assert.equal(regularVisualHeight({heightOffset:.8},22),.8);
  assert.equal(regularVisualHeight({height:{start:NaN,from:0,to:.8,duration:1}},22),0);
});

test('a per-attack original begin clip precedes the strike once and does not restart for multiple targets',()=>{
  const entry={anims:{idle:'Idle',attack:{loop:'Attack_Loop'}},
    animations:{Idle:1,Attack_Begin:1.167,Attack_Loop:.5},hits:{Attack_Loop:[.2]}};
  const skeleton={animations:Object.keys(entry.animations).map(name=>({name}))};
  const a=new BattleActor(skeleton,entry);
  const visual={animation:{begin:'Attack_Begin',loop:'Attack_Loop'},windup:1.367};
  a.attack(1.5,false,visual);assert.equal(a.current,'Attack_Begin');
  const track=a.spine.state.tracks[0];a.update(.6);a.attack(1.5,false,visual);
  assert.equal(a.spine.state.tracks[0],track);a.update(.567);
  assert.equal(a.current,'Attack_Loop');assert.ok(Math.abs(a.windUntil-1.367)<1e-9);
  a.update(.6);a.attack(1.5,false,{animation:'Attack_Loop',windup:.2});
  assert.equal(a.current,'Attack_Loop');assert.equal(a.attackBeginPending,null);
  a.update(1);
  a.attack(1.5,false,{animation:{begin:'Attack_Begin',loop:'Attack_Loop',beginDuration:1.167/2},windup:1.367/2});
  assert.equal(a.current,'Attack_Begin');assert.equal(a.spine.state.tracks[0].timeScale,2);
  const start=a.clock;a.update(1.167/2);assert.equal(a.current,'Attack_Loop');
  assert.ok(Math.abs(a.windUntil-start-1.367/2)<1e-9);a.destroy();
});

test('a control interruption cancels an uncompleted per-attack begin sequence',()=>{
  const entry={anims:{idle:'Idle',attack:{loop:'Attack_Loop'}},
    animations:{Idle:1,Attack_Begin:1.167,Attack_Loop:.5},hits:{Attack_Loop:[.2]}};
  const skeleton={animations:Object.keys(entry.animations).map(name=>({name}))};
  const a=new BattleActor(skeleton,entry);
  a.attack(1.5,false,{animation:{begin:'Attack_Begin',loop:'Attack_Loop'},windup:1.367});
  a.die();a.update(2);assert.equal(a.attackBeginPending,null);assert.notEqual(a.current,'Attack_Loop');a.destroy();
});

test('reviewed original skin switches only instance attachments without restarting shared animations',()=>{
 const{a,entry}=actor('char_4107_vrdant');const shared=structuredClone(entry);
 const names=['default','White','Yellow','Red'],skins=names.map(name=>({name}));let updates=0,applies=0;
 a.spine.skeleton.data={skins,defaultSkin:skins[0],findSkin:name=>skins.find(s=>s.name===name)};
 a.spine.skeleton.skin=skins[0];a.spine.skeleton.setSkin=skin=>{a.spine.skeleton.skin=skin;updates++;};
 a.spine.state.apply=()=>applies++;
 a.attack(1.5,false,{animation:'Attack',windup:.433});a.update(.2);
 const track=a.spine.state.tracks[0],time=track.trackTime,clock=a.clock,deadline=a.windUntil;
 for(const name of names){assert.equal(a.setRegularSkin(name),true);assert.equal(a.spine.skeleton.skin.name,name);assert.equal(a.setRegularSkin(name),false);}
 assert.equal(updates,4);assert.equal(applies,4);assert.equal(a.spine.state.tracks[0],track);assert.equal(track.trackTime,time);assert.equal(a.clock,clock);assert.equal(a.windUntil,deadline);
 assert.equal(a.setRegularSkin('RedBlade'),false);assert.equal(a.spine.skeleton.skin.name,'Red');
 assert.equal(a.setRegularSkin(null),true);assert.equal(a.spine.skeleton.skin.name,'default');assert.deepEqual(entry,shared);assert.deepEqual(skins.map(s=>s.name),names);a.destroy();
});

test('gauge anchor uses the original resting pose once despite distant source effect bounds',()=>{
 const original=fake.P.spine.Spine.prototype.getLocalBounds;let calls=0;
 fake.P.spine.Spine.prototype.getLocalBounds=function(){calls++;return{y:-355,height:380,x:-180,width:360};};
 try{const entry={anims:{idle:'Idle',attack:{loop:'Attack'}},animations:{Idle:1,Attack:1},bounds:{height:2142.65}};
 const a=new BattleActor({animations:[{name:'Idle'},{name:'Attack'}]},entry);
 assert.equal(a.gaugeHeight,355);assert.equal(calls,1);a.deploy();a.update(1);a.attack(1);a.update(.5);assert.equal(a.gaugeHeight,355);assert.equal(calls,1);a.destroy();
 }finally{if(original)fake.P.spine.Spine.prototype.getLocalBounds=original;else delete fake.P.spine.Spine.prototype.getLocalBounds;}
});


test('Robin trap transitions retain their literal variant withdrawal and restore the base form',()=>{
  const entry={anims:{idle:'Idle_01',die:'Retreat_01'},
    animations:{Idle_01:1,Idle_02:1,Start_02:.5,Skill_02:.167,Retreat_01:.167,Retreat_02:.167}};
  const skeleton={animations:Object.keys(entry.animations).map(name=>({name}))};
  for(const clip of ['Start_02','Skill_02']) {
    const a=new BattleActor(skeleton,entry);
    a.setRegularVisual({clip,loop:false,die:'Retreat_02'});
    assert.equal(a.current,clip);
    a.die();assert.equal(a.current,'Retreat_02');a.destroy();
  }
  const a=new BattleActor(skeleton,entry);
  a.setRegularVisual({clip:'Start_02',loop:false,die:'Retreat_02'});a.update(.5);
  a.setRegularVisual(null);assert.equal(a.roles.die,'Retreat_01');
  a.die();assert.equal(a.current,'Retreat_01');a.destroy();
});

// Original Ling mode aliases exclude Born; the higher death role survives cleanup.
test('Ling higher-form death uses its original clip after an attack or controller removal', () => {
  const entry = { anims: { idle: 'Idle', die: 'Die', attack: { loop: 'Attack' } },
    animations: { Idle: 1.333, Attack: 1, Die: 1, Idle_02: 2, Attack_02: 1.667, Die_02: 1 } };
  const skeleton = { animations: Object.keys(entry.animations).map(name => ({ name })) };
  for (const clip of ['Idle_02', 'Attack_02']) {
    const a = new BattleActor(skeleton, entry);
    a.setRegularVisual({ clip, loop: clip === 'Idle_02', die: 'Die_02' });
    a.setRegularVisual({ clip: 'Die_02', die: 'Die_02', duration: 1 });
    a.die(); assert.equal(a.current, 'Die_02'); assert.equal(a.dur(a.current), 1); a.destroy();
  }
});

test('a Ling higher attack settles into its original higher idle without replaying Born or a lower pose', () => {
  const entry = { anims: { idle: 'Idle', die: 'Die', attack: { loop: 'Attack' } },
    animations: { Idle: 1.333, Attack: 1, Die: 1, Start_02: .667, Idle_02: 2, Attack_02: 1.667, Die_02: 1 } };
  const skeleton = { animations: Object.keys(entry.animations).map(name => ({ name })) };
  const a = new BattleActor(skeleton, entry);
  a.setRegularVisual({ clip: 'Attack_02', idle: 'Idle_02', die: 'Die_02' });
  assert.equal(a.current, 'Attack_02'); a.update(2); assert.equal(a.current, 'Idle_02');
  assert.equal(a.roles.die, 'Die_02'); a.destroy();
});
