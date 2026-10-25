// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';import assert from'node:assert/strict';
import{mkdtemp,rm,mkdir,rmdir,stat}from'node:fs/promises';import{fileURLToPath,pathToFileURL}from'node:url';import{join,resolve}from'node:path';import{tmpdir}from'node:os';
import data from'../data/arkpedia-mvp.json' with{type:'json'};
import source from'../data/candidates/arkpedia-predefined-tutorial-source.json' with{type:'json'};
import{StandardBattle}from'../server/sim/arkpedia.js';import{defaultBuild}from'../shared/arkpedia/loadout.js';
import{predefinedTutorialSource,parsePredefinedTutorial}from'../tools/arkpedia/predefined-tutorial-source.mjs';
import{installViyPredefined,selectedViyPredefined,applyViyTutorialSp,VIY_PREDEFINED_KEY,VIY_SP_TUTORIAL}from'../server/sim/content/arkpedia-viy-predefined.js';
const ID='char_4226_veen',near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function fixture(){const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));return b;}
async function withCache(fn,root=fileURLToPath(new URL('../.cache/',import.meta.url))){root=resolve(root);await mkdir(root,{recursive:true});const prefix=join(root,'tutorial-proof-'),dir=await mkdtemp(prefix);
 try{return await fn(pathToFileURL(dir+'/'));}finally{if(!resolve(dir).startsWith(prefix))throw Error('Unsafe tutorial cache cleanup');await rm(dir,{recursive:true,force:true});}}
test('tutorial test setup creates an absent cache parent on a fresh checkout',async()=>{
 const outer=await mkdtemp(join(tmpdir(),'arkpedia-tutorial-root-')),root=join(outer,'fresh-cache');
 try{await withCache(async cache=>assert.ok((await stat(fileURLToPath(cache))).isDirectory()),root);}finally{await rmdir(root);await rmdir(outer);}
});
test('three pinned scripts and all seven canonical actions reproduce from a cold verified cache',async()=>{
 const urls=[];await withCache(async cacheDir=>{const actual=await predefinedTutorialSource({fetching:true,cacheDir,fetchImpl:async url=>{
  urls.push(url);const script=Object.values(source.scripts).find(r=>url.endsWith(r.source.path));assert.ok(script);return{ok:true,arrayBuffer:async()=>Buffer.from(script.originalText)};
 }});assert.deepEqual(actual,source);});assert.equal(urls.length,3);assert.ok(urls.every(u=>u.includes(source.source.commit)));
 assert.deepEqual(source.actions.map(a=>[a.action.actionType,a.action.preDelay]),[['DIALOG',3],['DIALOG',12],['STORY',12.1],['ACTIVATE_PREDEFINED',13],['ACTIVATE_PREDEFINED',13.1],['ACTIVATE_PREDEFINED',13.2],['ACTIVATE_PREDEFINED',13.3]]);
});
test('corrupt tutorial bytes and unsupported commands fail before a receipt can be produced',async()=>{
 await withCache(async cacheDir=>assert.rejects(()=>predefinedTutorialSource({fetching:true,cacheDir,fetchImpl:async()=>({ok:true,arrayBuffer:async()=>Buffer.from('changed')})}),/checksum/));
 for(const line of ['[Battle.EnsureMinSp(charId="char_4226_veen", sp=51)]','[Battle.EnsureMinSp(charId="char_128_plosis", sp=50)]','[Battle.Unknown()]'])assert.throws(()=>parsePredefinedTutorial(line),/Unsupported/);
});
test('source camera and dialog instructions remain distinct from the sole mechanical SP instruction',()=>{
 const scripts=Object.values(source.scripts);assert.equal(scripts[0].instructions.filter(s=>s.kind==='dialogue').length,3);assert.equal(scripts[1].instructions.filter(s=>s.kind==='dialogue').length,6);
 assert.deepEqual(scripts[2].instructions,[{kind:'header',tutorial:true},{kind:'ensureMinSp',charId:ID,sp:50}]);
 assert.deepEqual(scripts[1].instructions.filter(s=>s.kind==='cameraFocus').map(s=>[s.duration,s.offsetX,s.offsetY]),[[1,7,4],[1,3,4]]);
});
test('the preset is the exact canonical S3 build and occupies a separate unpaid deployment slot',()=>{
 const b=fixture(),dp=b.dp,slots=b.deployedSlots(),entry=installViyPredefined(b),u=entry.unit;
 assert.deepEqual(entry.build,{id:ID,elite:2,level:90,potential:6,trust:200,skillId:'skchr_veen_3',skillRank:8,module:null,stage:'17-16'});
 assert.deepEqual([u.tileR,u.tileC,u.dir],[4,3,'RIGHT']);assert.equal(b.bench[ID],undefined);near(b.dp,dp);assert.equal(b.deployedSlots(),slots+1);near(u.base.atk,1510);near(u.skill.spCost,49);near(u.skill.spTotal,24);
 assert.equal(b.withdrawOperator(u),false);assert.equal(b.activateOperator(ID),false);assert.ok(u.mem.veenOwner);assert.equal(b.predefinedOperators.get(VIY_PREDEFINED_KEY),entry);assert.deepEqual(b.errors,[]);
});
test('the source requests fifty SP through a silent modification and enables the real private S3 control',()=>{
 const b=fixture(),entry=installViyPredefined(b),u=entry.unit;let gains=0;b.on('spGain',()=>gains++);
 const result=applyViyTutorialSp(b);assert.deepEqual(result,{status:'applied',requested:50,before:24,after:49});assert.equal(gains,0);assert.ok(b.activateOperator(VIY_PREDEFINED_KEY));assert.equal(u.skill.active,true);
 const ammo=u.mem.veenOwner.ammo;assert.ok(ammo>0);assert.equal(applyViyTutorialSp(b).status,'active-skill');assert.equal(u.mem.veenOwner.ammo,ammo);near(u.skill.spTotal,0);
});
test('the minimum-SP modification never reduces an already higher balance',()=>{
 const b=fixture(),u=installViyPredefined(b).unit;u.skill.spCostMul=2;u.skill.setSpTotal(75);
 assert.deepEqual(applyViyTutorialSp(b),{status:'applied',requested:50,before:75,after:75});
});
test('the exact preset stores native energy and the tutorial-readied S3 fires real Arts shots and bounces',()=>{
 const b=fixture(),u=installViyPredefined(b).unit,o=u.mem.veenOwner;
 for(let n=0;n<600&&o.units<4;n++)b.step();assert.equal(o.units,4);
 for(const col of[4,5]){const e=b.spawnEnemy('enemy_1007_slime',{pos:[4,col]});Object.assign(e.base,{maxHp:1e8,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});}
 b._buildEnemyIndex();u.skill.setSpTotal(0);assert.equal(applyViyTutorialSp(b).after,49);assert.ok(b.activateOperator(VIY_PREDEFINED_KEY));const ammo=o.ammo,hits=[];
 b.on('damaged',h=>{if(h.source===u)hits.push({type:h.dmg.type,tags:h.dmg.tags});});
 for(let n=0;n<180&&!hits.some(h=>h.tags?.includes('veen:s3-bounce'));n++)b.step();
 assert.ok(hits.some(h=>h.tags?.includes('veen:s3-shot')&&h.type==='arts'));assert.ok(hits.some(h=>h.tags?.includes('veen:s3-bounce')&&h.type==='arts'));assert.ok(o.ammo<ammo);assert.deepEqual(b.errors,[]);
});
test('body lifetime replacement and forged same-role entries cannot adopt an old receiver',()=>{
 for(const mode of ['body','entry','life','skill']){const b=fixture(),entry=installViyPredefined(b),u=entry.unit;
  if(mode==='body'){u.deploySeq++;entry.life=u.deploySeq;}else if(mode==='entry')b.predefinedOperators.set(entry.key,{...entry});else if(mode==='skill')u.skill={spTotal:0};else entry.life++;
  const before=u.skill.spTotal;assert.equal(applyViyTutorialSp(b).status,'cancelled');near(u.skill.spTotal,before);
 }
});
test('absence, source death and battle completion cancel the exact SP receiver',()=>{
 assert.equal(applyViyTutorialSp(fixture()).status,'cancelled');
 for(const stop of ['death','end']){const b=fixture(),u=installViyPredefined(b).unit;if(stop==='death')b.kill(u,null);else b.finished=true;
  const before=u.skill.spTotal;assert.equal(applyViyTutorialSp(b).status,'cancelled');near(u.skill.spTotal,before);}
});
test('changed source roles, occupied placement, duplicate installs and late attachment fail closed',()=>{
 const changed=structuredClone(source);changed.predefines.characterInsts[0].mainSkillLvl=10;assert.throws(()=>selectedViyPredefined({source:changed}),/Unreviewed/);
 const b=fixture();installViyPredefined(b);assert.throws(()=>installViyPredefined(b),/fresh/);assert.throws(()=>applyViyTutorialSp(b,{key:'Obt/Tutorial/Level/main_17-15_a'}),/Unreviewed/);
 const late=fixture();late.time=1;assert.throws(()=>installViyPredefined(late),/fresh/);
 const occupied=fixture();occupied.getPlayer('arkpedia').dp=99;occupied.deployOperator('char_122_beagle',4,3,'RIGHT');assert.throws(()=>installViyPredefined(occupied),/placement/);
});
