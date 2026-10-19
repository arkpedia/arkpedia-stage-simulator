// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with{type:'json'};import {StandardBattle} from '../server/sim/arkpedia.js';import {defaultBuild} from '../shared/arkpedia/loadout.js';
const M='char_208_melan',G='char_122_beagle';
function make(){const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];const b=new StandardBattle(d,{operators:[defaultBuild(d.operators[M]),defaultBuild(d.operators[G])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(M,3,1,'RIGHT'),target=b.deployOperator(G,3,4,'RIGHT');assert.ok(u&&target);return{b,u,target,sk:u.skill};}
const cast=sk=>{sk.setSpTotal(sk.spCost);assert.equal(sk.activate('fixture'),true);};
test('Ordinary start/end events carry their own source activation number',()=>{
 const{b,sk}=make(),events=[];b.on('skillStart',c=>events.push(['start',c.activation]));b.on('skillEnd',c=>events.push(['end',c.activation]));cast(sk);sk.end();cast(sk);sk.end();assert.deepEqual(events,[['start',1],['end',1],['start',2],['end',2]]);assert.deepEqual(b.errors,[]);
});
test('A new activation inside onEnd cannot relabel the old source finish event',()=>{
 const{b,sk}=make(),events=[];b.on('skillStart',c=>events.push(['start',c.activation]));b.on('skillEnd',c=>events.push(['end',c.activation]));sk.spec.onEnd=()=>{sk.spec.onEnd=null;cast(sk);};cast(sk);sk.end('first');assert.equal(sk.active,true);assert.equal(sk.activations,2);assert.deepEqual(events,[['start',1],['start',2],['end',1]]);assert.deepEqual(b.errors,[]);
});
test('A finish/recast inside onStart cannot relabel the accepted outer start event',()=>{
 const{b,sk}=make(),events=[];b.on('skillStart',c=>events.push(['start',c.activation]));b.on('skillEnd',c=>events.push(['end',c.activation]));sk.spec.onStart=()=>{sk.spec.onStart=null;sk.end('early');cast(sk);};cast(sk);assert.equal(sk.activations,2);assert.deepEqual(events,[['end',1],['start',2],['start',1]]);assert.deepEqual(b.errors,[]);
});
for(const phase of['heal','calculatedHeal','overheal'])test(`A source replaced during ${phase} keeps accepted healing on its original ledger/team`,()=>{
 const{b,u,target}=make(),ledger=u.stats,team=b._pp(u.ownerId),before=team.healingDone;target.hp-=200;let changed=false;
 b.on(phase==='overheal'?'beforeBuff':phase,c=>{if(changed||phase==='overheal'&&c.buff.key!=='overheal')return;changed=true;u.deploySeq++;u.stats={...u.stats,heal:0};u.ownerId='replacement-owner';});
 const actual=b.heal(u,target,500,{overheal:phase==='overheal'});assert.equal(actual,200);assert.equal(changed,true);assert.equal(ledger.heal,200);assert.equal(u.stats.heal,0);assert.equal(team.healingDone-before,200);assert.deepEqual(b.errors,[]);
});
