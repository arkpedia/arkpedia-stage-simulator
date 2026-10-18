// SPDX-License-Identifier: GPL-3.0-or-later
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {installFakePixi} from './render/fakepixi.js';
import {make as fixture,ally,advance,until} from './helpers/taraxa-fixture.js';
import {prepareTaraxaS1,TARAXA_S1_CONTRACT} from '../server/sim/content/arkpedia-taraxa-s1.js';
import {prepareTaraxaS2,TARAXA_S2_CONTRACT} from '../server/sim/content/arkpedia-taraxa-s2.js';
import art from '../data/arkpedia-taraxa-art.json' with {type:'json'};
let fake,BattleActor;before(async()=>{fake=installFakePixi();({BattleActor}=await import('../public/arkpedia/battle-actor.js'));});after(()=>fake.restore());
function make(skill){const f=fixture({skill,prepare:(b,u)=>skill===1?prepareTaraxaS1(b,u,{contract:TARAXA_S1_CONTRACT}):prepareTaraxaS2(b,u,{contract:TARAXA_S2_CONTRACT})});
 ally(f);const meta=art.ownerModels.front.metadata,entry={anims:meta.animationRoles,animations:meta.animations,hits:meta.hits,bounds:meta.bounds};
 const a=new BattleActor({animations:Object.keys(meta.animations).map(name=>({name}))},entry,skill-1,{attackDrivenSkill:true});
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.ok(f.u.skill.activate('fixture'));a.setRegularVisual(f.u.mem.regularFormVisual);assert.equal(a.current,`Skill_${skill}_Begin`);
 return{...f,a};}
for(const skill of[1,2])test(`Taraxacum S${skill} source FSM replaces its completed Begin even between sparse render samples`,()=>{
 const f=make(skill);until(f,()=>f.flight.mode===(skill===1?2:5));f.a.setRegularVisual(f.u.mem.regularFormVisual);
 assert.equal(f.a.current,`Skill_${skill}_Loop`);assert.equal(f.u.profile.attackVisual,'none');const track=f.a.spine.state.tracks[0];
 f.a.attack(f.u.s.interval,false,{animation:f.u.profile.attackVisual});assert.equal(f.a.spine.state.tracks[0],track);
 f.u.skill.end('fixture');f.a.setRegularVisual(f.u.mem.regularFormVisual);assert.equal(f.a.current,`Skill_${skill}_End`);
 until(f,()=>f.flight.mode===0);f.a.setRegularVisual(f.u.mem.regularFormVisual);assert.ok(['Idle','Attack'].includes(f.u.mem.regularFormVisual.clip));assert.equal(f.a.current,f.u.mem.regularFormVisual.clip);f.a.destroy();
});
test('S1 direct healing receipts leave its continuous source loop and phase untouched',()=>{
 const f=make(1);until(f,()=>f.flight.mode===2);f.a.setRegularVisual(f.u.mem.regularFormVisual);const first=f.a.spine.state.tracks[0];first.trackTime=.2;
 advance(f.b,2);f.a.setRegularVisual(f.u.mem.regularFormVisual);f.a.attack(f.u.s.interval,false,{animation:f.u.profile.attackVisual});
 assert.equal(f.a.spine.state.tracks[0],first);assert.equal(first.trackTime,.2);assert.equal(f.a.current,'Skill_1_Loop');f.a.destroy();
});
test('S2 repeated fast source abilities restart their native looping clip once per new receipt cycle',()=>{
 const f=make(2);f.b.addBuff(f.u,{key:'fixture:fast',mods:{aspd:200}});until(f,()=>f.flight.mode===5);f.a.setRegularVisual(f.u.mem.regularFormVisual);
 const first=f.a.spine.state.tracks[0],key=f.u.mem.regularFormVisual.playId;assert.ok(key);first.trackTime=.4;
 until(f,()=>f.u.mem.regularFormVisual.playId!==key);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Loop');
 f.a.setRegularVisual(f.u.mem.regularFormVisual);assert.notEqual(f.a.spine.state.tracks[0],first);const second=f.a.spine.state.tracks[0];
 f.a.setRegularVisual(f.u.mem.regularFormVisual);assert.equal(f.a.spine.state.tracks[0],second);f.a.destroy();
});
