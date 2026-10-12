// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-stainless-prefabs.json' with { type: 'json' };
import review from '../data/arkpedia-stainless-runtime-review.json' with { type: 'json' };
import art from '../data/arkpedia-stainless-device-art.json' with { type: 'json' };
import { deployRegularSummon, retreatRegularSummon, selectedRegularSummon, regularSummonCards, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { summonCardId, summonUnitId, regularTokenIdsFor } from '../shared/arkpedia/summons.js';
import { regularModelKey, spriteFacing } from '../shared/arkpedia/facing.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { catalogueFor, defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { selectedStainlessBuild, STAINLESS_ID as ID } from '../server/sim/content/arkpedia-stainless.js';
const near = (a, z) => assert.ok(Math.abs(a - z) < 1e-5, `${a} != ${z}`);
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt - 1e-9); i++) b.step();
  assert.deepEqual(b.errors, []);
}
function until(b, condition, seconds = 80) {
  const end = b.time + seconds;
  while (!condition() && b.time < end) b.step();
  assert.ok(condition(), `Condition missing at ${b.time}`); assert.deepEqual(b.errors, []);
}
function make({ skill = 1, rank = 10, elite = 2, level = data.operators[ID].phases[elite].maxLevel,
  potential = 1, trust = 0, support = false, squad = [] } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const build = { ...defaultBuild(d.operators[ID]), elite, level, potential, trust,
    skillId: `skchr_ironmn_${skill}`, skillRank: rank };
  const members = ['char_500_noirc', 'char_196_sunbr', ...squad].map(id => defaultBuild(d.operators[id]));
  const b = new StandardBattle(d, support ? { operators: members, support: build } : { operators: [build, ...members] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.getPlayer('arkpedia').dp = 99;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  return { b, build: b.bench[ID].build };
}

function enemy(b, row = 5, col = 6) {
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
 Object.assign(e.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
 b.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
const card=summonCardId(ID);
test('public Stainless separately approves source builds and every owner/device model, leaving immutable receipts held',async()=>{
 for(const [file,key] of [['arkpedia-stainless-prefabs.json','sourceFoundationSha256'],['arkpedia-stainless-device-art.json','deviceArtworkSha256']]){
  assert.equal(review[key],createHash('sha256').update(await readFile(new URL('../data/'+file,import.meta.url))).digest('hex'));
 }
 assert.deepEqual(evidence.enabledOperators,[]);assert.deepEqual(art.enabledOperators,[]);assert.deepEqual(review.enabledOperators,[ID]);
 assert.equal(review.frameParity,false);assert.equal(review.moduleSupport,false);assert.equal(review.nativeParticleSupport,false);
 assert.equal(evidence.source.commit,data.sources[evidence.source.repository]);
 assert.deepEqual(catalogueFor(data)[ID].skills.map(s=>s.id),[1,2,3].map(n=>`skchr_ironmn_${n}`));
 assert.deepEqual(catalogueFor(data)[ID].modules,[]);
 assert.deepEqual(regularTokenIdsFor([ID]),[1,2,3].map(n=>`token_10027_ironmn_pile${n}`));
 assert.equal(Object.keys(review.originalArtwork).length,9);
 for(const [key,model] of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[key],model);
 for(const face of ['front','back']){
  const m=data.sd.models[`operator/${ID}/default/${face}`],native=evidence.officialSkeletonBindings[ID][face==='front'?'Front':'Back'];
  assert.equal(m.skeleton.sha256,native.sha256);assert.equal(m.skeleton.bytes,native.byteLength);
 }
 for(const [id,record] of Object.entries(art.models))for(const [face,r] of Object.entries(record.facings??{front:record,back:record})){
  const m=data.sd.models[`operator/${id}/default/${face}`];
  for(const f of [m.skeleton,m.atlas,...m.textures,m.avatar]){
   const source=r.files[f.path.split('/').at(-1)];assert.equal(f.sha256,source.sha256);assert.equal(f.bytes,source.bytes);
  }
  assert.deepEqual(m.source.originalPathIds,r.originalPathIds);assert.deepEqual(m.animations,r.durations);
 }
 for(const change of [{elite:0,level:1,skillId:'skchr_ironmn_2',skillRank:1},{elite:1,level:1,skillId:'skchr_ironmn_3',skillRank:1},{module:'CRA-X'}])
  assert.throws(()=>recordFor({...defaultBuild(data.operators[ID]),...change},data));
});
for(const skill of [1,2,3])for(let rank=1;rank<=10;rank++)test(`public Stainless S${skill} rank ${rank}: selected source, natural SP, device mode and cleanup`,()=>{
 const {b,build}=make({skill,rank}),r=selectedStainlessBuild(build),dp=b.dp,cost=b.cost(ID);
 const u=b.deployOperator(ID,5,5,'RIGHT'),c=u.mem.stainlessController;
 near(b.dp,dp-cost);near(u.base.atk,r.stats.atk);near(u.skill.sp,r.source.spData.initSp);
 const e=enemy(b),hits=[];b.on('damaged',h=>{if(h.source===u)hits.push({...h,atk:u.s.atk});});
 assert.equal(regularSummonCards(b).find(v=>v.key===card).tokenId,r.token.id);
 for(const k of ['elite','level','potential','trust','skillId','skillRank'])assert.equal(c.devices.record.arkpedia[k],build[k]);
 const available=c.devices.stock,limit=b.deployedSlots();
 const t=deployRegularSummon(b,card,7,7,'RIGHT');assert.equal(t.ownerUnit,u);assert.equal(t.deploymentSlotCost,0);
 assert.equal(c.devices.stock,available-1);assert.equal(t.side,skill===3?'enemy':'ally');
 assert.equal(b.deployedSlots(),limit);assert.equal(selectedRegularSummon(b,summonUnitId(t)).unit,t);
 const tokenBase={atk:t.s.atk,def:t.s.def,aspd:t.s.aspd};
 until(b,()=>u.skill.ready);assert.equal(skillHud(u.skill).ready,true);assert.equal(b.activateOperator(ID),true);
 near(u.s.atk,r.stats.atk*(1+(skill===1?0:r.bb.atk)));near(u.s.def,r.stats.def*(1+(skill===2?r.bb.def:0)));
 if(skill!==3)assert.equal(c.devices.mode,true);
 assert.deepEqual({atk:t.s.atk,def:t.s.def,aspd:t.s.aspd},tokenBase);
 until(b,()=>hits.some(h=>h.dmg.tags.includes(`ironmn:s${skill}`)));
 const h=hits.find(h=>h.dmg.tags.includes(`ironmn:s${skill}`));assert.equal(h.target,e);assert.equal(h.dmg.isSkill,true);
 near(h.amount,h.atk*(skill===1?r.bb['attack@atk_scale']:1));
 assert.equal(u.mem.regularFormVisual.clip,`Skill_${skill}`);
 until(b,()=>!u.skill.active,45);near(u.s.atk,r.stats.atk);near(u.s.def,r.stats.def);assert.equal(c.devices.mode,false);
 if(skill===1)assert.equal(t.alive,false);else{assert.ok(t.alive);retreatRegularSummon(b,summonUnitId(t));assert.equal(t.alive,false);}
 b.retreatOperator(ID);assert.equal(c.stopped,true);assert.equal(c.devices.stopped,true);assert.equal(c.devices.stock,0);
 assert.equal(b.regularSummons.has(card),false);assert.equal(c.handles.length+c.devices.handles.length,0);
 assert.equal(c.phase,null);assert.equal(c.devices.devices.size,0);assert.deepEqual(b.errors,[]);
});
for(const elite of [0,1,2])test(`public Stainless E${elite} preserves level, trust, potential and native device capacity`,()=>{
 const {b,build}=make({skill:elite+1,elite,rank:[4,7,10][elite],level:1,trust:200,potential:6});
 const r=selectedStainlessBuild(build),u=b.deployOperator(ID,5,5,'UP'),c=u.mem.stainlessController;
 for(const k of ['atk','def','maxHp'])near(u.base[k],r.stats[k]);assert.deepEqual(u.def.tags,r.tags);
 for(const k of ['elite','level','potential','trust','skillId','skillRank'])assert.equal(c.record.build[k],build[k]);
 assert.equal(c.devices.stock,Math.min(r.token.stats.maxDeckStackCnt,r.recharge.cnt));
 assert.equal(r.token.stats.maxDeployCount,[1,2,2][elite]);
});
for(const dir of ['UP','DOWN','LEFT','RIGHT'])test(`public turret ${dir}: original model, fixed facing, real allied attacks charge shots and retreat`,()=>{
 const {b}=make({skill:3,squad:['char_289_gyuki']}),u=b.deployOperator(ID,5,3,dir),c=u.mem.stainlessController;
 const t=deployRegularSummon(b,card,5,6,dir),a=b.deployOperator('char_289_gyuki',5,5,'RIGHT');
 const face=dir==='UP'?'back':dir==='DOWN'?'down':'front';assert.equal(regularModelKey(t),`operator/${t.defId}/default/${face}`);
 assert.equal(spriteFacing(t,{x:t.x+1,facing:-1}),dir==='LEFT'?-1:1);assert.equal(t.kind,'token');
 const target=enemy(b,dir==='UP'?6:dir==='DOWN'?4:5,dir==='LEFT'?4:dir==='RIGHT'?8:6);
 // Existing allied range/attack runtime supplies the native hurt-SP inputs; no forced SP.
 const shots=[];b.on('damaged',h=>{if(h.source===t&&h.dmg.tags.includes('ironmn:turret-main'))shots.push(h);});
 const hp=t.hp;until(b,()=>shots.length,40);assert.equal(shots[0].target,target);
 assert.ok(t.hp<hp);assert.equal(shots[0].dmg.tags.includes('ironmn:turret-main'),true);
 assert.equal(shots[0].type,'phys');assert.ok(a.alive);assert.equal(t.s.blockCnt,0);
 retreatRegularSummon(b,summonUnitId(t));assert.equal(t.alive,false);assert.equal(selectedRegularSummon(b,summonUnitId(t)),null);
 const old=shots.length;advance(b,4);assert.equal(shots.length,old);assert.equal(c.devices.devices.size,0);
});
test('public support, portrait-mode placement gate, abnormal cast rejection and owner removal retain source semantics',()=>{
 const {b,build}=make({skill:2,support:true,trust:200,potential:6}),u=b.deployOperator(ID,5,5,'RIGHT'),c=u.mem.stainlessController;
 const r=selectedStainlessBuild(build);near(u.base.maxHp,r.stats.maxHp);
 b.setViewport('inline');assert.match(summonPlacementError(b,card,6,6),/fullscreen/);b.setViewport('fullscreen-workspace');
 const t=deployRegularSummon(b,card,6,6,'LEFT');until(b,()=>u.skill.ready);
 b.addBuff(u,{key:'qa:stun',flags:{stun:true}});assert.equal(b.activateOperator(ID),false);assert.ok(u.skill.ready);
 b.removeBuff(u,'qa:stun');assert.equal(b.activateOperator(ID),true);
 b.retreatOperator(ID);assert.equal(t.alive,false);assert.equal(c.devices.devices.size,0);
 until(b,()=>b.bench[ID].readyAt<=b.time);b.getPlayer('arkpedia').dp=99;
 const next=b.deployOperator(ID,5,5,'RIGHT');assert.notEqual(next,u);assert.notEqual(next.mem.stainlessController,c);
 assert.equal(next.mem.stainlessController.devices.stock,Math.min(r.token.stats.maxDeckStackCnt,r.recharge.cnt));
});
