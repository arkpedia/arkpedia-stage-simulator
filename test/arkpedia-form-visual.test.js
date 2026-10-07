// SPDX-License-Identifier: GPL-3.0-or-later
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import evidence from '../data/arkpedia-support-expansion-prefabs.json' with { type: 'json' };
import { regularVisualHeight } from '../public/arkpedia/regular-form-visual.js';
import { installFakePixi } from './render/fakepixi.js';
let fake, BattleActor;
before(async()=>{fake=installFakePixi();({BattleActor}=await import('../public/arkpedia/battle-actor.js'));});
after(()=>fake.restore());
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
