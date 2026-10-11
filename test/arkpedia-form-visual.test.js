// SPDX-License-Identifier: GPL-3.0-or-later
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import evidence from '../data/arkpedia-support-expansion-prefabs.json' with { type: 'json' };
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
