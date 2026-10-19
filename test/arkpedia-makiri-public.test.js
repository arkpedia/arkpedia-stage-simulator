// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-makiri-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedMakiriBuild} from '../server/sim/content/arkpedia-makiri.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4199_makiri',G='char_122_beagle',SP='char_4185_amoris',candidate=process.env.ARKPEDIA_REVIEW_MAKIRI==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-makiri-candidate.json',import.meta.url))):normal;
// A Defender (Beagle) and a non-eligible Guard, plus a Supporter if one is in the roster.
const SUPPORTER=Object.values(data.operators).find(o=>o.profession==='SUPPORT'&&o.id!==ID)?.id;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,80][elite],skillId:`skchr_makiri_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G]),defaultBuild(d.operators[SP]),...(SUPPORTER?[defaultBuild(d.operators[SUPPORTER])]:[])]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=50;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,3,3,'RIGHT');assert.ok(u);
 return{b,u,build:b.bench[ID].build,cost:before-b.dp};
}
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP account`,()=>{
 const f=make({skill,rank}),r=selectedMakiriBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('S1 fires itself at full SP: +10 DP and the rightmost card costs 4 less until that operator deploys',()=>{
 const f=make({skill:1}),last=Object.keys(f.b.bench).at(-1),before=f.b.cost(last),dp=f.b.dp;f.u.skill.setSpTotal(f.u.skill.spCost);advance(f.b,.1);
 assert.equal(f.u.skill.activations,1);near(f.b.dp,dp+f.u.skill.bb.cost,1e-9);assert.equal(f.b.cost(last),Math.max(0,before+f.u.skill.bb.value));
 const others=Object.keys(f.b.bench).filter(id=>id!==last&&id!==ID);for(const id of others)assert.equal(f.b.bench[id].costDelta??0,0);
});
check('S2: 15 DP over the skill, ATK +70%, regen, and Defender/Supporter cards cost 1 less with max HP stacks on deploy',()=>{
 const f=make({skill:2}),beagleCost=f.b.cost(G),nyamuCost=f.b.cost(SP),dp=f.b.dp,atk=f.u.s.atk;f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 near(f.u.s.atk,atk*(1+f.u.skill.bb['makiri_s_2[passive].atk']),1e-6);assert.equal(f.b.cost(G),beagleCost-1);assert.equal(f.b.cost(SP),nyamuCost);
 advance(f.b,15.1);assert.equal(f.b.dp-dp,15);f.b.getPlayer('arkpedia').dp=99;const beagle=f.b.deployOperator(G,3,4,'RIGHT');assert.ok(beagle.findBuff('makiri:s2-hp'));near(beagle.findBuff('makiri:s2-hp').mods.hpPct,.15,1e-9);
});
check('Talent: after 30 s on the field Defenders and Supporters get ATK +12% (P1 E2 +10%), including later deployments',()=>{
 const f=make(),t=f.u.def.talents.find(x=>x.bb.interval!=null).bb;f.b.getPlayer('arkpedia').dp=99;const beagle=f.b.deployOperator(G,3,4,'RIGHT');
 advance(f.b,t.interval-.5);assert.ok(!beagle.findBuff('makiri:t1'));advance(f.b,.6);near(beagle.findBuff('makiri:t1').mods.atkPct,t.atk,1e-9);
 const ny=f.b.deployOperator(SP,3,1,'RIGHT');assert.ok(ny&&!ny.findBuff('makiri:t1'));
});
for(const skill of[1,2])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const M='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_makiri_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
