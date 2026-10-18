// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4222_taraxa.json' with {type:'json'};
import {selectedTaraxaBuild as select, selectedTaraxaInputs, taraxaNativeInputs, taraxaSourceComponent,
  TARAXA_ID as ID} from '../server/sim/content/arkpedia-taraxa-source.js';
import {normalizeChess} from '../server/sim/simdata.js';
const build=more=>({elite:2,level:80,potential:1,trust:0,skillId:'skchr_taraxa_1',skillRank:10,module:'none',...more});
test('Taraxacum retains complete held original source bytes, native roots and dependencies',async()=>{
 const raw=await readFile(new URL('../data/arkpedia-native-operators/'+ID+'.json',import.meta.url));
 assert.equal(raw.length,437163);assert.equal(createHash('sha256').update(raw).digest('hex'),'828005a80a067e4f3d92c857ffdf8350fd64dc504c409b17656df7ab73dd8750');
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);
 assert.equal(e.source.bundles.length,5);assert.equal(Object.keys(e.templates).length,12);assert.equal(Object.keys(e.projectiles).length,3);
 for(const k of['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[k],false);
 for(const group of['characters','artworkHierarchy','skills','projectiles'])for(const rows of Object.values(e[group]))
  for(const row of rows)for(const part of row.components)assert.equal(typeof part.pathId,'string');
});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)test(`Taraxacum S${skill} rank ${rank} retains its own complete original row`,()=>{
 for(const potential of[1,6])for(const trust of[0,200]){
  const s=select(build({skillId:`skchr_taraxa_${skill}`,skillRank:rank,potential,trust}));
  assert.deepEqual(s.source,e.tables.skills[`skchr_taraxa_${skill}`].levels[rank-1]);assert.equal(s.index,skill-1);
  assert.equal(s.source.skillType,'MANUAL');assert.equal(s.source.spData.spType,'INCREASE_WITH_TIME');
  assert.equal(s.stats.baseAttackTime,2.85);assert.deepEqual(Object.keys(s.bb).sort(),s.source.blackboard.map(b=>b.key).sort());
 }
});
test('Taraxacum promotion/potential/trust stats do not silently fold in flying-aura talent bonuses',()=>{
 const lo=select(build({elite:0,level:50,skillRank:4})),hi=select(build({potential:6,trust:200}));
 assert.deepEqual([lo.stats.maxHp,lo.stats.atk,lo.stats.def,lo.stats.cost],[1307,264,118,16]);
 assert.deepEqual([hi.stats.maxHp,hi.stats.atk,hi.stats.def,hi.stats.cost],[1810,505,225,16]);
 assert.deepEqual(lo.talentBb,[{damage_resistance:.03,block_cnt:1}]);assert.deepEqual(hi.talentBb,[{damage_resistance:.12,block_cnt:1}]);
 assert.equal(select(build({elite:1,level:70,skillRank:7})).talentBb[0].damage_resistance,.07);
});
test('Locked skills, unsupported modules, invalid ranks and unknown source components are rejected',()=>{
 for(const change of[{elite:0,level:50,skillRank:4,skillId:'skchr_taraxa_2'},{elite:0,level:50,skillRank:5},
  {elite:3},{level:81},{potential:0},{potential:7},{trust:201},{skillRank:11},{skillId:'made-up'},{module:'taraxa-x'}])assert.throws(()=>select(build(change)));
 assert.throws(()=>taraxaSourceComponent('characters',ID,'0'),/Missing original/);
});
test('Normalized selected input must retain the exact source build and canonical skill identity',()=>{
 const b=build(),r=select(b);
 const fresh=()=>({rangeGrid:r.rangeGrid,def:normalizeChess({chessId:ID,charId:ID,stats:r.stats,rangeGrid:r.rangeGrid,tags:r.tags,talents:r.talents,
  skill:{...r.source,...r.source.spData,skillId:b.skillId,rangeGrid:r.skillRangeGrid},arkpedia:b})});
 assert.equal(selectedTaraxaInputs(fresh()).index,0);
 for(const mutate of[u=>u.def.stats.atk++,u=>u.def.skill.bb.fake=1,u=>u.def.raw.arkpedia.skillId='skchr_taraxa_2']){
  const u=fresh();mutate(u);assert.throws(()=>selectedTaraxaInputs(u),/Incomplete original/);
 }
});
test('Seven original modes and both three-mode skill accounts remain distinct instead of becoming one generic heal loop',()=>{
 const n=taraxaNativeInputs();assert.equal(n.modes.length,7);
 assert.deepEqual(n.modes.map(m=>m.pathId),['1862616816941398204','8747101508441077948','-910060893440247620','1146166063823124668','-4165076598681962308','-4760609123717809988','570816843795724476']);
 assert.deepEqual([n.s1._attackBlackboardModeIndex,...n.s1._extraAttackBlackboardModeIndices],[1,2,3]);
 assert.deepEqual([n.s2._attackBlackboardModeIndex,...n.s2._extraAttackBlackboardModeIndices],[4,5,6]);
 assert.equal(n.modes[0].attack._animKey,'Attack');assert.equal(n.modes[2].attack._animKey,'');
 assert.equal(n.modes[2].attack._selectTargetSource,2);assert.equal(n.modes[5].attack._animKey,'Skill_2_Loop');
 assert.equal(n.modes[5].attack._projectileKey,'projectile_chr_taraxa_s2_1');
 for(const s of[n.s1,n.s2]){assert.equal(s._playSkillBeginAnim,0);assert.equal(s._allowNoTarget,1);assert.equal(s._allowSpRecoveryWhenAffecting,0);}
});
test('Flight, landing, conditional flying-aura buffs and separate S2 secondary/splash projectiles remain original actions',()=>{
 const n=taraxaNativeInputs(),flat=[];
 const walk=x=>{if(!x||typeof x!=='object')return;if(x.$type)flat.push(x);for(const v of Object.values(x))if(typeof v==='object')Array.isArray(v)?v.forEach(walk):walk(v);};
 walk(n.templates);
 assert.ok(flat.some(x=>x._blockMode==='FLY'&&x._targetType==='BUFF_OWNER'));
 assert.ok(flat.some(x=>x._OffsetKey==='fly_height'&&x._durationKey==='fly_duration'));
 assert.ok(flat.some(x=>x._OffsetKey===''&&x._durationKey==='fly_end_duration'));
 assert.ok(flat.some(x=>x._abilityName==='SecondSelector'&&x._projectileKey==='projectile_chr_taraxa_s2_1'&&x._excludeTarget===true));
 assert.ok(flat.some(x=>x._abilityName==='SplashSelector'&&x._projectileKey==='projectile_chr_taraxa_s2_2'&&x._excludeTarget===true));
});
