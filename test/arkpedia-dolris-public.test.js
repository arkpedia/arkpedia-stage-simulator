// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-dolris-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedDolrisBuild} from '../server/sim/content/arkpedia-dolris.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4184_dolris',N='char_4185_amoris',G='char_122_beagle',candidate=process.env.ARKPEDIA_REVIEW_DOLRIS==='1';
const check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-dolris-candidate.json',import.meta.url))):normal;
function make({skill=1,rank=10,elite=2}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,70,80][elite],skillId:`skchr_dolris_${skill}`,skillRank:rank};
 const b=new StandardBattle(d,{operators:[build,defaultBuild(d.operators[G]),defaultBuild(d.operators[N])]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;b.timeLimit=1000;
 const before=b.dp,u=b.deployOperator(ID,2,4,'RIGHT');assert.ok(u);
 const heals=[],hits=[];b.on('heal',h=>{if(h.source===u)heals.push({time:b.time,target:h.target,amount:h.amount,opts:h.opts});});
 b.on('damaged',h=>{if(h.source===u)hits.push({time:b.time,target:h.target,amount:h.amount,type:h.dmg.type,tags:h.dmg.tags});});
 return{b,u,build:b.bench[ID].build,cost:before-b.dp,heals,hits};
}
function enemy(f,{row=3,col=5}={}){
 const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=1e9;
 f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;
}
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)check(`S${skill} rank ${rank} keeps source stats, cost and SP account`,()=>{
 const f=make({skill,rank}),r=selectedDolrisBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.cost,r.stats.cost);assert.equal(f.u.skill.spCost,r.source.spData.spCost);
});
check('Bard trait heals every injured ally in range each second; talent 1 adds a 35% heal every 4 s outside skills',()=>{
 const f=make(),g=f.b.deployOperator(G,3,4,'RIGHT');advance(f.b,1.5);g.hp=100;const n=f.heals.length;advance(f.b,3.95);
 const toG=f.heals.slice(n).filter(h=>h.target===g);assert.ok(toG.filter(h=>h.opts?.aura).length>=3);
 const t1=toG.filter(h=>!h.opts?.aura);assert.equal(t1.length,1);near(t1[0].amount,f.u.s.atk*f.u.def.talents.find(t=>t.bb['attack@heal_cd']).bb['attack@heal_scale'],1e-6);
});
check('Healing an Ave Mujica member adds Fever +5 per heal; non-members add nothing',()=>{
 const f=make(),g=f.b.deployOperator(G,3,4,'RIGHT'),ny=f.b.deployOperator(N,3,3,'RIGHT'),fv=f.b._aveMujicaFever;advance(f.b,1.5);
 g.hp=100;const v0=fv.value,pre=f.heals.length;advance(f.b,1.01);const gain=fv.value-v0-3;void pre;assert.equal(gain,0);
 ny.hp=100;const v1=fv.value;advance(f.b,1.01);assert.ok(fv.value-v1>=5);
});
check('Talent 2 adds 30% of her ATK as Arts damage to each target of a member attacking in her range',()=>{
 const f=make(),ny=f.b.deployOperator(N,3,3,'RIGHT'),e=enemy(f,{row:3,col:4});f.b.on('damaged',()=>{});
 const until=f.b.time+6;while(!f.hits.some(h=>h.tags.includes('dolris:talent'))&&f.b.time<until)f.b.step();
 const add=f.hits.find(h=>h.tags.includes('dolris:talent'));assert.ok(add);assert.equal(add.type,'arts');assert.equal(add.target,e);
 near(add.amount,f.u.s.atk*f.u.def.talents.find(t=>t.bb.normal_cnt).bb.atk_scale,1e-6);void ny;
});
check('S1 inspires ATK and DEF in its x-2 range and heals 100 per hit an inspired ally takes',()=>{
 const f=make({skill:1}),g=f.b.deployOperator(G,3,4,'RIGHT');f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);advance(f.b,.1);
 const bb=f.u.skill.bb,ins=g.findBuff(`dolris:inspire:${f.u.id}`);assert.ok(ins);near(ins.mods.atkFinalFlat,f.u.s.atk*bb['attack@atk'],1e-6);near(ins.mods.defFinalFlat,f.u.s.def*bb['attack@def'],1e-6);
 assert.ok(!f.u.findBuff(`dolris:inspire:${f.u.id}`));
 const e=enemy(f);g.hp=g.s.maxHp/2;const n=f.heals.length;f.b.dealDamage(e,g,{amount:100,type:'phys'});const h=f.heals.slice(n).find(x=>x.target===g&&x.amount===bb['attack@heal_value_s1']);assert.ok(h);
});
check('S2 stops the trait heal, pulses Arts damage and a heal every 0.3 s, and inspires the other allies ATK',()=>{
 const f=make({skill:2}),g=f.b.deployOperator(G,3,4,'RIGHT'),e=enemy(f);g.hp=100;f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);
 const n=f.heals.length,m=f.hits.length;advance(f.b,3.05);
 assert.equal(f.heals.slice(n).filter(h=>h.opts?.aura).length,0);assert.equal(f.hits.slice(m).filter(h=>h.tags.includes('dolris:s2')&&h.type==='arts').length,10);
 assert.ok(f.heals.slice(n).length>=1);near(g.findBuff(`dolris:inspire:${f.u.id}`).mods.atkFinalFlat,f.u.s.atk*f.u.skill.bb['attack@atk'],1e-6);void e;
});
for(const skill of[1,2])check(`S${skill} clears unchanged original 0-1 with natural DP`,()=>{
 const M='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_dolris_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');
 let u,m,g;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(g&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,2,4,'RIGHT');if(u?.skill.ready)b.activateOperator(ID);b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;assert.ok(u);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.deepEqual(b.errors,[]);
});
