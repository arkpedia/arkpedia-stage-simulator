// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import models from '../data/arkpedia-aphrissa-review-models.json' with {type:'json'};
import review from '../data/arkpedia-aphrissa-runtime-review.json' with {type:'json'};
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import {aphrissaData as data, APHRISSA_CANDIDATE as candidate} from './helpers/aphrissa-data.js';
import {verifyAphrissaArtwork, APHRISSA_ID as ID} from '../tools/arkpedia/aphrissa-artwork.mjs';
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
import {defaultBuild, catalogueFor} from '../shared/arkpedia/loadout.js';
import {regularTokenIdsFor} from '../shared/arkpedia/summons.js';
import {interfaceAssetUrl} from '../shared/arkpedia/interface-assets.js';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {selectedAphrissaBuild} from '../server/sim/content/arkpedia-aphrissa-source.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {advance, near} from './helpers/mon3tr-fixture.js';
const TOKEN='token_10070_aphris_pc';

const fixtures=[],check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
test.afterEach(()=>{for(const f of fixtures.splice(0)){assert.deepEqual(f.b.errors,[]);f.c.stop();}});
function until(f,p,seconds=50){const end=f.b.time+seconds;while(!p()&&f.b.time<end)f.b.step();assert.ok(p(),'Missing Aphrissa phase at '+f.b.time);}
function make({skill=1,rank=10,potential=1,trust=0,elite=2,support=false}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level:[50,80,90][elite],potential,trust,skillId:`skchr_aphris_${skill}`,skillRank:rank};
 const g=defaultBuild(d.operators.char_122_beagle),b=new StandardBattle(d,support?{operators:[g],support:build}:{operators:[build,g]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,u=b.deployOperator(ID,2,4,'RIGHT');assert.ok(u);
 const f={b,u,c:u.mem.aphrissaOwner,cost:before-b.dp,build:b.bench[ID].build,hits:[],attacks:[]};fixtures.push(f);
 b.on('damaged',h=>{if(h.source===u)f.hits.push({id:h.target.id,amount:h.amount,skill:h.dmg.isSkill,tags:h.dmg.tags});});
 b.on('attack',h=>{if(h.attacker===u)f.attacks.push({targets:h.targets.map(t=>t.id),skill:h.isSkill});});return f;
}
function enemy(f){const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[2,5]});Object.assign(e.base,{maxHp:1e9,res:0,def:0,atk:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;f.b.addBuff(e,{key:'review:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;}
check('Admission binds the reviewed original owner/relay art, interface pixels and source receipts',async()=>{
 assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.ok(REGULAR_OPERATORS[ID]);assert.equal(data.operators[ID].name,'Aphrissa');assert.equal(data.operatorSourceChannels[ID],'cn');
 assert.deepEqual(data.operators[ID].skills.map(s=>s.assetIcon),['skill-icons/Aphrissa - Continuous Mapping.webp','skill-icons/Aphrissa - Critical Burst.webp','skill-icons/Aphrissa - The Essence of Chaos.webp']);
 for(const[path,key]of[['native-operators/'+ID,'sourceFoundationSha256'],['aphrissa-art','ownerArtworkSha256'],['aphrissa-token-art','tokenArtworkSha256'],['aphrissa-token-avatar','tokenAvatarSha256'],['aphrissa-interface-art','interfaceArtworkSha256'],['aphrissa-clocks','sourceClocksSha256']])
  assert.equal(createHash('sha256').update(await readFile(new URL('../data/arkpedia-'+path+'.json',import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork)){assert.deepEqual(data.sd.models[k],v);assert.deepEqual(models.models[k],v);}
 assert.equal(data.sd.commit,models.commit);assert.equal(review.interfaceAssets.length,4);
 for(const a of review.interfaceAssets){assert.deepEqual(data.interfaceAssets[a.repository][a.path],{commit:a.commit,bytes:a.bytes,sha256:a.sha256});assert.ok(interfaceAssetUrl(data,a.repository,a.path).includes('/'+a.commit+'/'));}
 assert.ok(data.tokens[TOKEN].avatar.includes('/'+data.sd.commit+'/'));assert.deepEqual(data.tokens[TOKEN].skills.map(s=>s.id),[null,null,null]);
 assert.deepEqual(data.stage.geometry,normal.stage.geometry);assert.deepEqual(data.enemies,normal.enemies);assert.ok(catalogueFor(data)[ID]);
});
for(const skill of [1,2,3])for(let rank=1;rank<=10;rank++)check(`Real battle selection binds S${skill} rank ${rank} and spends source DP once`,()=>{
 const f=make({skill,rank}),s=selectedAphrissaBuild({...f.build,module:'none'});near(f.u.s.atk,s.stats.atk);near(f.cost,s.stats.cost);
 assert.equal(f.c.record.index,skill-1);assert.equal(f.u.skill.sp,s.source.spData.initSp);assert.equal(f.b.deployedSlots(),1);
 assert.equal(f.b.regularSummons.get('summon:'+ID),f.c.deck.state);
 const t=f.c.deck.place(3,4,'RIGHT');assert.ok(t);assert.equal(t.defId,TOKEN);assert.equal(f.b.deployedSlots(),1);near(f.b.dp,99-f.cost-3);
 assert.equal(t.mem.regularModelFacing,'single');assert.equal(t.mem.regularFormVisual.clip,'Start');
});
for(const skill of [1,2,3])check(`Real S${skill} uses ordinary damage, natural SP, selected HUD and retreat/redeployment`,()=>{
 const f=make({skill}),target=enemy(f);until(f,()=>f.hits.length>0,8);assert.ok(f.hits.every(h=>h.amount>0));
 if(skill===1){until(f,()=>f.c.mode==='s1');assert.equal(f.u.skill.active,true);assert.equal(f.b.activateOperator(ID),false);}
 else{until(f,()=>f.u.skill.ready);assert.equal(skillHud(f.u.skill).canActivate,true);assert.equal(f.b.activateOperator(ID),true);assert.equal(f.u.skill.sp,0);
  if(skill===2){until(f,()=>f.hits.some(h=>h.tags.includes('aphrissa:s2')));assert.equal(f.u.skill.active,true);until(f,()=>f.c.mode==='normal',12);}
  else{until(f,()=>f.c.state?.stage==='active',4);until(f,()=>f.u.skill.ammoLeft<20,8);assert.match(skillHud(f.u.skill).text,/19/);assert.equal(f.b.activateOperator(ID),true);}
 }
 assert.equal(target.alive,true);const old=f.u;f.b.retreatOperator(ID);advance(f.b,1);assert.equal(f.c.stopped,true);assert.equal(f.c.handles.length,0);assert.equal(f.b.regularSummons.has('summon:'+ID),false);
 advance(f.b,f.b.bench[ID].readyAt-f.b.time+f.b.dt);f.b.getPlayer('arkpedia').dp=99;const next=f.b.deployOperator(ID,2,4,'RIGHT');assert.ok(next);assert.notEqual(next,old);assert.notEqual(next.mem.aphrissaOwner,f.c);assert.equal(next.skill.activations,0);next.mem.aphrissaOwner.stop();
});
check('Maxed support selection binds original P6/trust stats and rejects altered inputs before kit installation',()=>{
 const f=make({skill:3,potential:6,trust:200,support:true});near(f.u.s.atk,1021);near(f.cost,32);
 for(const kind of ['stats','skill']){const d=structuredClone(data);if(kind==='stats')d.operators[ID].phases[2].attributesKeyFrames.at(-1).data.atk++;else d.operators[ID].skills[0].levels[9].blackboard[0].value=999;
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators[ID])]});b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;assert.throws(()=>b.deployOperator(ID,2,4,'RIGHT'),/original selected Aphrissa/);}
});

test('Renderer dependencies preload the relay with its selected owner only',()=>{
 assert.deepEqual(regularTokenIdsFor([ID]),[TOKEN]);assert.deepEqual(regularTokenIdsFor([ID,ID]),[TOKEN]);assert.deepEqual(regularTokenIdsFor(['char_122_beagle']),[]);
});
check('A missing candidate marker or pending normal build fails without replacing the published snapshot',async()=>{
 if(!candidate||review.enabledOperators.includes(ID))return;
 const d=structuredClone(data);delete d.reviewCandidates;const b=new StandardBattle(d,{operators:[defaultBuild(d.operators[ID])]});b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;assert.throws(()=>b.deployOperator(ID,2,4,'RIGHT'),/Missing Aphrissa runtime review/);
 const path=new URL('../data/arkpedia-mvp.json',import.meta.url),before=await readFile(path);
 assert.throws(()=>execFileSync(process.execPath,['tools/arkpedia/build-mvp.mjs','--sd-commit',models.commit],{stdio:'pipe'}),/Aphrissa lacks/);assert.deepEqual(await readFile(path),before);
 assert.throws(()=>execFileSync(process.execPath,['tools/arkpedia/build-mvp.mjs','--review-candidate-aphrissa','--review-candidate-makoto'],{stdio:'pipe'}),/Review one candidate/);
});
for(const skill of [1,2,3])check(`Public S${skill} clears the unchanged original 0-1 with natural DP and actual source damage`,()=>{
 const M='char_208_melan',G='char_122_beagle',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_aphris_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);let u,m,g,casts=0;
 for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,2,4,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready&&b.activateOperator(ID))casts++;b.step();}
 const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;console.log(JSON.stringify({skill,reason:r.reason,kills:r.killed,leaks,life:b.life,casts,activations:u?.skill.activations,actualDamage:u?.stats.dmg}));assert.ok(u&&m&&g&&u.stats.dmg>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);u.mem.aphrissaOwner.stop();
});

test('Changed original owner or passive relay artwork cannot enter the normal build',async()=>{
 await verifyAphrissaArtwork(models.models);
 for(const kind of ['ownerPixels','ownerRole','relayRole','relayAlpha','relayAvatar']){
  const m=structuredClone(models.models),owner=m[`operator/${ID}/default/front`],relay=m[`operator/${TOKEN}/default/front`];
  if(kind==='ownerPixels')owner.textures[0].sha256='0'.repeat(64);
  if(kind==='ownerRole')owner.animationRoles.attack={loop:'invented'};
  if(kind==='relayRole')relay.animationRoles.attack={loop:'Attack'};
  if(kind==='relayAlpha')relay.premultipliedAlpha=false;
  if(kind==='relayAvatar')relay.avatar.sha256='0'.repeat(64);
  await assert.rejects(verifyAphrissaArtwork(m));
 }
});
