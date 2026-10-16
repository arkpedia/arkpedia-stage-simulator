// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import review from '../data/arkpedia-gallus-runtime-review.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild,recordFor} from '../shared/arkpedia/loadout.js';
import {selectedGallusBuild} from '../server/sim/content/arkpedia-gallus-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {near,advance} from './helpers/mon3tr-fixture.js';
const ID='char_4227_gallus',candidate=process.env.ARKPEDIA_REVIEW_GALLUS==='1',enabled=candidate||review.enabledOperators.includes(ID),check=enabled?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-gallus-candidate.json',import.meta.url))):normal;
function until(b,p,seconds=90){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition not reached at '+b.time);assert.deepEqual(b.errors,[]);}
function make({level=30,potential=1,trust=0,support=false}={}){const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),level,potential,trust},b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators.char_122_beagle)],support:build}:{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,u=b.deployOperator(ID,4,5,'DOWN');near(before-b.dp,3);const hits=[];b.on('damaged',c=>{if(c.source===u)hits.push(c);});const t=b.spawnEnemy('enemy_1007_slime',{pos:[3,5]});Object.assign(t.base,{maxHp:1e9,atk:0,def:0,res:50,moveSpeed:0});t.markDirty();void t.s;t.hp=t.s.maxHp;b.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return{b,u,t,hits,c:u.mem.gallus,build:b.bench[ID].build};}
check('Public GALLUS binds original source/artwork/clocks and two immutable interface files without active skills',async()=>{assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Gallus²');assert.deepEqual(data.operators[ID].skills,[]);assert.equal(review.interfaceAssets.length,2);
 for(const[path,key]of[['native-operators/char_4227_gallus','sourceFoundationSha256'],['gallus-art','ownerArtworkSha256'],['gallus-clocks','sourceClocksSha256']])assert.equal(createHash('sha256').update(await readFile(new URL(`../data/arkpedia-${path}.json`,import.meta.url))).digest('hex'),review[key]);for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
});
for(let potential=1;potential<=6;potential++)for(const trust of[0,100,200])check(`Public GALLUS P${potential}/trust ${trust} keeps source stats, zero slots and passive projectile work`,()=>{const f=make({potential,trust}),r=selectedGallusBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.u.s.atk,r.stats.atk);assert.equal(f.b.deployedSlots(),0);assert.equal(f.b.deploymentSlotCost(ID),0);assert.equal(f.u.skill.noSkill,true);assert.equal(skillHud(f.u.skill),null);assert.equal(f.b.activateOperator(ID),false);until(f.b,()=>f.hits.length>0,4);near(f.t.s.res,50*(.85-.02*(potential-1)));assert.equal(f.c.inWindow(),true);});
check('Public maxed support remains a level-30 passive operator with no invented promotion/skills',()=>{const f=make({level:1,potential:1,support:true});assert.equal(f.build.elite,0);assert.equal(f.build.level,30);assert.equal(f.build.potential,6);assert.equal(f.build.trust,200);assert.equal(f.build.skillId,null);assert.equal(f.u.deploymentSlotCost,0);});
check('Public retreat preserves accepted recipient work, then redeploys a fresh original window after 200 seconds',()=>{const f=make();until(f.b,()=>f.hits.length>0,4);f.b.retreatOperator(ID);assert.equal(f.c.stopped,true);near(f.t.s.res,42.5);advance(f.b,10.1);near(f.t.s.res,50);assert.equal(f.c.watchers.length,0);until(f.b,()=>f.b.bench[ID].readyAt<=f.b.time,210);f.b.getPlayer('arkpedia').dp=99;const next=f.b.deployOperator(ID,4,5,'UP');assert.notEqual(next.mem.gallus,f.c);assert.equal(next.mem.gallus.inWindow(),true);assert.equal(next.skill.noSkill,true);});
check('Public GALLUS clears original 0-1 with natural DP, original waves and unchanged terrain',()=>{const M='char_208_melan',b=new StandardBattle(data,{operators:[defaultBuild(data.operators[ID]),defaultBuild(data.operators[M])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);let helper=false,owner=false,hits=0,marks=0;b.on('damaged',c=>{if(c.source?.defId===ID)hits++;});b.on('beforeBuff',c=>{if(c.buff.key.startsWith('gallus:res:'))marks++;});
 for(let n=0;n<9001&&!b.finished;n++){if(!owner&&b.dp>=b.cost(ID)){b.deployOperator(ID,4,5,'DOWN');owner=true;}if(!helper&&b.dp>=b.cost(M)){b.deployOperator(M,3,1,'RIGHT');helper=true;}b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;console.log(JSON.stringify({kills:r.killed,leaks,life:b.life,hits,marks,reason:r.reason}));assert.ok(owner&&helper);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);assert.ok(hits>0);assert.ok(marks>0);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});
