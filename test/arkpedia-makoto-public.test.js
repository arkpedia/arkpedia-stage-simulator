// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
import normal from'../data/arkpedia-mvp.json'with{type:'json'};import review from'../data/arkpedia-makoto-runtime-review.json'with{type:'json'};
import{StandardBattle}from'../server/sim/arkpedia.js';import{defaultBuild,recordFor}from'../shared/arkpedia/loadout.js';import{selectedMakotoBuild}from'../server/sim/content/arkpedia-makoto-source.js';import{skillHud}from'../shared/arkpedia/skill-hud.js';import{interfaceAssetUrl}from'../shared/arkpedia/interface-assets.js';import{near,advance}from'./helpers/mon3tr-fixture.js';import{regularModelKey}from'../shared/arkpedia/facing.js';
const ID='char_4217_makoto',G='char_122_beagle',Y='char_4219_yukari',candidate=process.env.ARKPEDIA_REVIEW_MAKOTO==='1',check=candidate||review.enabledOperators.includes(ID)?test:test.skip;
const data=candidate?JSON.parse(await readFile(new URL('../.cache/arkpedia/arkpedia-makoto-candidate.json',import.meta.url))):normal,fixtures=[];
test.afterEach(()=>{for(const f of fixtures.splice(0)){assert.deepEqual(f.b.errors,[]);f.c.stop();}});
function until(b,p,seconds=90){const end=b.time+seconds;while(!p()&&b.time<end&&!b.finished)b.step();assert.ok(p(),'Condition missing at '+b.time);assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,potential=1,trust=0,support=false,elite=2,level=[50,80,90][elite],dir='RIGHT',yukariSkill=1}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const build={...defaultBuild(d.operators[ID]),elite,level,skillId:`skchr_makoto_${skill}`,skillRank:rank,potential,trust};
 const yukari={...defaultBuild(d.operators[Y]),skillId:`skchr_yukari_${yukariSkill}`};
 const b=new StandardBattle(d,support?{operators:[defaultBuild(d.operators[G]),yukari],support:build}:{operators:[build,defaultBuild(d.operators[G]),yukari]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 const before=b.dp,u=b.deployOperator(ID,3,3,dir);assert.ok(u);const hits=[],receipts=[],heals=[];b.on('damaged',h=>{if(h.source===u)hits.push({...h,time:b.time});});b.on('attack',h=>{if(h.attacker===u)receipts.push({...h,time:b.time});});b.on('heal',h=>{if(h.source===u)heals.push({...h});});
 const f={b,u,c:u.mem.makotoOwner,build:b.bench[ID].build,cost:before-b.dp,hits,receipts,heals};fixtures.push(f);return f;
}
function enemy(f,{col=4,row=3,hp=1e8}={}){const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:hp,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return e;}
const cast=f=>{f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),true);};
const persona=f=>until(f.b,()=>!f.c.transition&&f.c.mode===f.c.record.index+1);
check('Public candidate binds all five source-ID interface files and exact original native modes without changing prior records',async()=>{
 assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Makoto Yuki');
 assert.deepEqual(data.operators[ID].skills.map(s=>s.assetIcon),['skill-icons/Makoto Yuki - Harp of Orpheus.webp','skill-icons/Makoto Yuki - Chains of Thanatos.webp','skill-icons/Makoto Yuki - Dawn-Piercing Blade.webp']);
 for(const[path,key]of[['native-operators/'+ID,'sourceFoundationSha256'],['makoto-art','ownerArtworkSha256'],['makoto-clocks','sourceClocksSha256'],['makoto-status-source','sourceStatusSha256'],['makoto-visibility','sourceVisibilitySha256']])assert.equal(createHash('sha256').update(await readFile(new URL('../data/arkpedia-'+path+'.json',import.meta.url))).digest('hex'),review[key]);
 for(const[k,v]of Object.entries(review.originalArtwork))assert.deepEqual(data.sd.models[k],v);
 for(const a of review.interfaceAssets){assert.deepEqual(data.interfaceAssets[a.repository][a.path],{commit:a.commit,bytes:a.bytes,sha256:a.sha256});assert.ok(interfaceAssetUrl(data,a.repository,a.path).includes('/'+a.commit+'/'));}
 assert.equal(review.interfaceAssets.length,5);const front=data.sd.models[`operator/${ID}/default/front`],back=data.sd.models[`operator/${ID}/default/back`];assert.equal(front.premultipliedAlpha,true);assert.equal(back.premultipliedAlpha,true);assert.equal(front.animationRoles.skill,null);assert.deepEqual(front.animationRoles.skills,{});assert.ok(front.animations.Doll_Skill_3_P2_Loop);assert.equal(back.animations.Doll_Skill_3_P2_Loop,undefined);assert.equal(back.animations.Skill_AllOutAttack_Loop,undefined);
 for(const a of Object.values(normal.operators))assert.deepEqual(data.operators[a.id],a);for(const[k,v]of Object.entries(normal.sd.models))assert.deepEqual(data.sd.models[k],v);
});
for(const skill of[1,2,3])for(const potential of[1,6])for(const trust of[0,200])check(`Public S${skill} P${potential}/trust${trust} preserves actual stats, cost and independent Persona modifiers`,()=>{
 const f=make({skill,potential,trust}),r=selectedMakotoBuild(f.build);assert.deepEqual(recordFor(f.build,data).stats,r.stats);near(f.u.s.atk,r.stats.atk);near(f.cost,r.stats.cost);assert.equal(f.b.deploymentSlotCost(ID),1);assert.equal(f.u._profInstalled,undefined);assert.equal(f.u.profile.install,null);
 cast(f);persona(f);near(f.u.s.atk,r.stats.atk*(1+r.talentBb[0].atk));near(f.u.s.maxHp,r.stats.maxHp*1.35);assert.match(skillHud(f.u.skill).text,/^Persona · \d+s/);assert.equal(f.u.deploySeq,1);assert.equal(f.u.skill.activations,1);
});
for(const skill of[1,2,3])for(let rank=1;rank<=10;rank++)check(`Public S${skill} rank${rank} uses its exact source account and actual Persona combat`,()=>{
 const f=make({skill,rank}),r=selectedMakotoBuild(f.build);enemy(f);assert.equal(f.u.skill.spCost,r.source.spData.spCost);assert.equal(f.u.skill.spTotal,r.source.spData.initSp);
 cast(f);assert.equal(f.b.activateOperator(ID),false);persona(f);assert.equal(f.u.skill.spTotal,0);assert.equal(f.u.s.flags.noSp,true);assert.equal(f.u.skill.gainSp(100,'gift'),0);
 const tag=skill===1?'makoto:s1':skill===2?'makoto:s2':'makoto:s3-p1';until(f.b,()=>f.hits.some(h=>h.dmg.tags.includes(tag)),6);assert.ok(f.hits.some(h=>h.amount>0&&h.dmg.tags.includes(tag)));
 if(skill<3){assert.equal(skillHud(f.u.skill).canActivate,false);assert.equal(f.b.activateOperator(ID),false);}else{until(f.b,()=>f.u.skill.ready);assert.equal(skillHud(f.u.skill).canActivate,true);assert.match(skillHud(f.u.skill).text,/Ready/);}
});
for(const skill of[1,2,3])check(`Public S${skill} max support retains the original build and one deployment slot`,()=>{const f=make({skill,support:true});assert.deepEqual([f.build.elite,f.build.level,f.build.potential,f.build.trust,f.build.skillRank],[2,90,6,200,10]);assert.deepEqual(recordFor(f.build,data).stats,selectedMakotoBuild(f.build).stats);assert.equal(f.b.deploymentSlotCost(ID),1);});
for(const[elite,skill,rank]of[[0,1,4],[1,1,7],[1,2,7]])check(`Public E${elite} S${skill} preserves promotion passives and the source all-out return`,()=>{
 const f=make({elite,skill,rank}),r=selectedMakotoBuild(f.build);cast(f);persona(f);near(f.u.s.atk,r.stats.atk*(1+r.talentBb[0].atk));until(f.b,()=>f.c.transition?.kind==='return',25);assert.equal(f.c.ret.phase.plan.allOut,true);until(f.b,()=>f.c.mode===0&&!f.c.transition,5);near(f.u.s.maxHp,r.stats.maxHp);near(f.u.s.atk,r.stats.atk);assert.equal(f.u.hpRatio,1);
});
for(const forced of[false,true])check(`Public S3 ${forced?'fatal':'manual'} P1-to-P2 preserves life/account and the real remaining Persona timer`,()=>{
 const f=make({skill:3}),g=f.b.deployOperator(G,3,4,'RIGHT');assert.ok(g);cast(f);persona(f);until(f.b,()=>f.u.skill.ready);advance(f.b,2);const remaining=f.c.body.countdown().remaining,life=f.u.deploySeq,account=f.u.skill;
 assert.equal(f.u.skill.spTotal,0);assert.equal(skillHud(account).canActivate,true);
 if(forced){const t=enemy(f);f.b.dealDamage(t,f.u,{amount:1e8,type:'true',canDodge:false,applyWay:'melee'});assert.equal(f.u.hp,1);}else assert.equal(f.b.activateOperator(ID),true);
 assert.equal(account.activations,2);until(f.b,()=>f.c.mode===4&&!f.c.transition);near(f.c.body.countdown().remaining,remaining,2*f.b.dt+1e-6);assert.equal(f.u.skill,account);assert.equal(f.u.deploySeq,life);assert.equal(f.u.s.blockCnt,2);assert.equal(f.u.profile.noAttack,true);assert.equal(skillHud(account).canActivate,false);
 f.u.hp=100;g.hp=100;until(f.b,()=>f.heals.some(h=>h.target===g)&&f.heals.some(h=>h.target===f.u),3);assert.ok(f.u.hp>100&&g.hp>100);assert.equal(regularModelKey(f.u),`operator/${ID}/default/front`);
});
for(const skill of[1,2,3])check(`Public S${skill} natural SP and fatal normal entry use the real manual/source account`,()=>{
 const f=make({skill});until(f.b,()=>f.u.skill.ready);assert.equal(f.u.skill.activations,0);assert.equal(skillHud(f.u.skill).canActivate,true);const t=enemy(f),before=f.u.hp;f.b.dealDamage(t,f.u,{amount:1e8,type:'true',canDodge:false,applyWay:'melee'});assert.equal(f.u.alive,true);assert.equal(f.u.hp,1);near(f.u.stats.taken,before-1);assert.equal(f.u.skill.activations,skill===3?1:0);persona(f);assert.equal(f.u.hpRatio,1);
});
for(const skill of[1,2,3])check(`Public S${skill} retreat drains source ownership and redeployment creates a fresh account`,()=>{
 const f=make({skill});cast(f);persona(f);const old=f.u;f.b.retreatOperator(ID);advance(f.b,2);assert.equal(f.c.stopped,true);for(const p of[f.c,...f.c.parts])assert.equal(p.handles.length,0);assert.equal(f.b.deployedSlots(),0);
 advance(f.b,f.b.bench[ID].readyAt-f.b.time+f.b.dt);f.b.getPlayer('arkpedia').dp=99;const next=f.b.deployOperator(ID,3,3,'RIGHT');assert.ok(next);assert.notEqual(next,old);assert.notEqual(next.mem.makotoOwner,f.c);assert.equal(next.skill.activations,0);assert.equal(next.mem.makotoOwner.mode,0);
});
for(const skill of[1,2,3])check(`Public S${skill} all-out uses actual deployed S.E.E.S. records and one delayed True hit per participant`,()=>{
 const f=make({skill}),y=f.b.deployOperator(Y,2,4,'UP'),g=f.b.deployOperator(G,3,4,'RIGHT');assert.ok(y&&g);assert.equal(y.tags.has('sees'),true);assert.equal(f.u.tags.has('sees'),true);assert.equal(g.tags.has('sees'),false);
 const target=enemy(f,{hp:1e9}),all=[];f.b.on('damaged',h=>{if(h.target===target&&h.dmg.tags.includes('makoto:allout'))all.push({h,at:f.b.time});});cast(f);persona(f);until(f.b,()=>f.c.transition?.kind==='return',25);const start=f.b.time;
 assert.deepEqual([...f.c.allout.grants].map(p=>p.owner.id).sort(),[f.u.id,y.id].sort());assert.equal(all.length,0);advance(f.b,1.5);assert.equal(all.length,0);until(f.b,()=>all.length===2,1);for(const h of all){near(h.at-start,1.6,f.b.dt+1e-6);assert.equal(h.h.dmg.type,'true');assert.equal(h.h.credit?.id,f.u.id);assert.equal(h.h.source?.id??null,h.h.dmg.sourceless?null:f.u.id);}assert.equal(f.c.allout.grants.size,0);until(f.b,()=>f.c.mode===0&&!f.c.transition,4);advance(f.b,1);assert.equal(all.length,2);
});
for(const forced of[false,true])check(`Actual public Yukari output survives Makoto ${forced?'forced':'manual'} source clears and retains its real expiry`,()=>{
 const f=make({skill:3,yukariSkill:2}),y=f.b.deployOperator(Y,2,4,'UP');assert.ok(y);y.skill.setSpTotal(y.skill.spCost);assert.equal(f.b.activateOperator(Y),true);until(f.b,()=>!!y.mem.yukari.effects.marker(f.u));
 if(forced){const t=enemy(f);f.b.dealDamage(t,f.u,{amount:1e8,type:'true',canDodge:false,applyWay:'melee'});}else cast(f);
 assert.equal(f.u.skill.activations,1);assert.equal(y.mem.yukari.effects.marker(f.u),null);near(f.u.s.artsDealtMul,1.3);persona(f);near(f.u.s.artsDealtMul,1.3);advance(f.b,15.1);near(f.u.s.artsDealtMul,1);
});
check('A held Makoto rejects a missing candidate marker and altered source inputs instead of installing generic Dollkeeper behavior',()=>{
 if(candidate&&review.enabledOperators.length===0){const d=structuredClone(data);delete d.reviewCandidates;const b=new StandardBattle(d,{operators:[defaultBuild(d.operators[ID])]});b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;assert.throws(()=>b.deployOperator(ID,3,3,'RIGHT'),/Missing Makoto runtime review/);}
 for(const kind of['stats','skill','id']){const d=structuredClone(data);if(kind==='stats')d.operators[ID].phases[2].attributesKeyFrames.at(-1).data.atk++;if(kind==='skill')d.operators[ID].skills[0].levels[9].blackboard[0].value=999;if(kind==='id')d.operators[ID].skills[0].id='invented';if(kind==='id'){assert.throws(()=>new StandardBattle(d,{operators:[defaultBuild(d.operators[ID])]}),/Unsupported regular-stage/);continue;}const b=new StandardBattle(d,{operators:[defaultBuild(d.operators[ID])]});b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;assert.throws(()=>b.deployOperator(ID,3,3,'RIGHT'),/original selected Makoto inputs/);}
});
for(const skill of[1,2,3])check(`Public S${skill} clears unchanged original 0-1 with natural DP and actual Makoto damage`,()=>{
 const M='char_208_melan',b=new StandardBattle(data,{operators:[{...defaultBuild(data.operators[ID]),skillId:`skchr_makoto_${skill}`},defaultBuild(data.operators[M]),defaultBuild(data.operators[G])]});b.setViewport('fullscreen-workspace');const tiles=structuredClone(b.grid.tiles);let u,m,g,casts=0;for(let n=0;n<9001&&!b.finished;n++){if(!m&&b.dp>=b.cost(M))m=b.deployOperator(M,3,1,'RIGHT');if(m&&!u&&b.dp>=b.cost(ID))u=b.deployOperator(ID,3,3,'RIGHT');if(u&&!g&&b.dp>=b.cost(G))g=b.deployOperator(G,3,4,'RIGHT');if(u?.skill.ready&&b.activateOperator(ID))casts++;b.step();}const r=b.result(),leaks=r.perPlayer.arkpedia.leaked.filter(e=>e.counted).length;console.log(JSON.stringify({skill,reason:r.reason,kills:r.killed,leaks,life:b.life,casts,activations:u?.skill.activations,actualDamage:u?.stats.dmg}));assert.ok(u&&m&&g&&u.stats.dmg>0&&casts>0);assert.equal(r.reason,'cleared');assert.equal(r.killed,11);assert.equal(leaks,0);assert.equal(b.life,data.stage.battle.max_life);assert.deepEqual(b.grid.tiles,tiles);assert.deepEqual(b.errors,[]);
});
check('A pending normal build and conflicting candidates fail without replacing the published snapshot',async()=>{
 if(!candidate||review.enabledOperators.includes(ID))return;const path=new URL('../data/arkpedia-mvp.json',import.meta.url),before=await readFile(path);assert.throws(()=>execFileSync(process.execPath,['tools/arkpedia/build-mvp.mjs','--sd-commit','2f118a74f9ebbce5266dc7fbd27dcdd9b6f3e959'],{stdio:'pipe'}),/Makoto lacks/);assert.deepEqual(await readFile(path),before);assert.throws(()=>execFileSync(process.execPath,['tools/arkpedia/build-mvp.mjs','--review-candidate-makoto','--review-candidate-yukari'],{stdio:'pipe'}),/Review one candidate/);
});
