// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync}from'node:fs';
import {createHash}from'node:crypto';
import {makeBattle,chessRec}from'./helpers/battleHarness.js';
import {installEnemyFeatures}from'../server/sim/content/arkpedia-enemy-features.js';
import {chapter17Environment}from'../server/sim/content/chapter17.js';
import {strongChannel,strongCarrier}from'../server/sim/content/chapter17-channel-carrier.js';
import {verifiedNative,verifiedChapter16FamilyGraph}from'../tools/arkpedia/enemy-support.mjs';
import {deriveEnemySupport,prefabPath}from'../shared/arkpedia/enemy-support.js';
import {parseSkel}from'../tools/assets/skel.mjs';
const bytes=p=>readFileSync(new URL('../data/'+p,import.meta.url)),read=p=>JSON.parse(bytes(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const records=read('candidates/arkpedia-enemy-records.canonical.json').enemies,review=read('candidates/arkpedia-ch17-reviewed-channel-carrier.json');
const graph=read('candidates/arkpedia-ch17-channel-carrier-source.json'),native=read('candidates/arkpedia-ch17-channel-carrier-native.json');
const channels=['enemy_10203_mumag','enemy_10203_mumag_2'],carriers=['enemy_10208_mucow','enemy_10208_mucow_2'],murad='enemy_10211_murad';
function fixture(key,{unitCol=8}={}){
 const h=makeBattle({content:'generic',autoFinish:false,timeLimit:180,setup:installEnemyFeatures,
  defs:{enemies:Object.fromEntries([...channels,...carriers,murad].map(k=>[k,records[k].levels[0]])),chess:{dummy:chessRec({id:'dummy',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:1}})}},units:[{chessId:'dummy',row:10,col:unitCol}]});
 h.b.start();const e=h.spawn(key,{pos:[10,6]});e.base.moveSpeed=0;e.markDirty();return{h,b:h.b,e,a:e.mem.ab.list[0],u:h.unit('dummy')};
}
function marker(f,extra={}){
 const t={alive:true,x:6,y:10,sp:0,spCost:10000,s:{taunt:0},deploySeq:0,cycle:0,gainSp(n){this.sp+=n;},...extra};
 chapter17Environment(f.b).rifts.push(t);return t;
}
function begin(f){f.a.left=0;f.h.run(.1);assert.ok(f.a.target);}

// Compare semantic component fields using original local hierarchy and script
// identities. Graphics are intentionally excluded; no path IDs are edited.
function shape(path){
 const nodes=new Map(graph.prefabs[path].map(r=>[r.pathId,JSON.parse(r.originalJson)]));
 const transforms=new Map([...nodes].filter(([,n])=>n.m_Father).map(([id,n])=>[n.m_GameObject.m_PathID,{id,...n}]));
 function hierarchy(id){const go=nodes.get(id);if(!go)return'?';const t=transforms.get(id),parent=t&&nodes.get(t.m_Father.m_PathID),name=go.m_Name.startsWith('enemy_')?'enemy-root':go.m_Name;return parent?.m_GameObject?hierarchy(parent.m_GameObject.m_PathID)+'/'+name:name;}
 function reference(id){if(id==='0')return null;const n=nodes.get(id);if(!n)return'UNKNOWN:'+id;return hierarchy(n.m_GameObject?.m_PathID??id)+'#'+(n.m_Script?.m_PathID??(n.m_Component?'GameObject':n.m_Father?'Transform':Object.keys(n).sort().join(',')));}
 function normalize(n){if(Array.isArray(n))return n.map(normalize);if(n&&typeof n==='object'){if(n.m_FileID===0&&typeof n.m_PathID==='string')return reference(n.m_PathID);return Object.fromEntries(Object.keys(n).sort().map(k=>[k,normalize(n[k])]));}return n;}
 return native.prefabs[path].filter(r=>!['Spine','Shadow','Graphic','FaceSwitcher'].includes(r.objectName)).map(r=>JSON.stringify({where:reference(r.pathId),value:normalize(JSON.parse(r.originalJson))})).sort();
}
test('four original family graphs/indexed claims/clocks and named range source are checksum-bound',()=>{
 for(const file of Object.values(review.sources))assert.equal(sha(readFileSync(new URL('../'+file.path,import.meta.url))),file.sha256);
 const idx=read('arkpedia-enemy-clock-source.json');
 verifiedNative(native,idx.prefabs,sha(bytes('arkpedia-enemy-clock-source.json')),read('arkpedia-mvp.json').behaviors.source);
 verifiedChapter16FamilyGraph(bytes('candidates/arkpedia-ch17-channel-carrier-source.json'),bytes('arkpedia-cn-native-source.json'),bytes('arkpedia-cn-enemy-native-source.json'),idx);
 for(const key of [channels[0],carriers[0]]){
  const a=shape(prefabPath(key)),b=shape(prefabPath(key+'_2'));assert.deepEqual(a,b);assert.equal(a.length,key===channels[0]?8:4);assert.ok(a.every(p=>!p.includes('UNKNOWN:')));
  const collider=k=>graph.prefabs[prefabPath(k)].map(r=>JSON.parse(r.originalJson)).filter(n=>n.m_Radius!==undefined).map(n=>n.m_Radius).sort();
  assert.deepEqual(collider(key),collider(key+'_2'));
  for(const k of [key,key+'_2'])assert.equal(JSON.parse(native.prefabs[prefabPath(k)].find(r=>r.objectName==='Spine').originalJson).timeScale,1);
 }
 const clocks=read('candidates/arkpedia-ch17-channel-carrier-animation-source.json');assert.equal(clocks.source.graph.sha256,review.sources.graph.sha256);
 for(const[key,row]of Object.entries(clocks.enemies)){const raw=Buffer.from(row.base64,'base64');assert.equal(sha(raw),row.sha256);assert.ok(parseSkel(raw).animations.length>0);}
 const range=read('candidates/arkpedia-ch17-channel-carrier-range-source.json'),raw=Buffer.from(range.originalTableBase64,'base64');
 assert.equal(range.source.commit,'57010cb5b2afea112cae57daa756b58676ba6850');assert.equal(range.source.gitBlob,'c1e28a9f2c7350bb5f5de13ba27950dca49f0de7');
 assert.equal(raw.length,range.source.bytes);assert.equal(sha(raw),range.source.sha256);assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from('blob '+raw.length+'\0'),raw])).digest('hex'),range.source.gitBlob);
 assert.deepEqual(JSON.parse(raw)['x-4'],range.range);assert.equal(range.range.grids.length,9);
});
for(const key of channels)test(key+' retains target,15-second channel, source SP and DEF before a fresh cooldown',()=>{
 const f=fixture(key),t=marker(f);begin(f);assert.equal(f.e.s.def,2100);t.x=15;f.h.run(.8);assert.equal(t.sp,1);assert.equal(f.a.target,t);
 f.h.run(15);assert.equal(t.sp,15);assert.equal(f.a.target,null);assert.equal(f.e.s.def,700);assert.ok(f.a.left>8);assert.deepEqual(f.b.errors,[]);
});
for(const status of ['stun','freeze','sleep','levitate'])test('accepted brief '+status+' retires stronger channel and DEF before another SP pulse',()=>{
 const f=fixture(channels[1]),t=marker(f);begin(f);const sp=t.sp,buff=f.b.addBuff(f.e,{key:'fixture-control',persist:true,flags:{[status]:true}});f.b.removeBuff(f.e,buff);f.h.run(1.1);
 assert.equal(f.a.target,null);assert.equal(t.sp,sp);assert.equal(f.e.s.def,700);assert.ok(!f.e.s.flags.noMove);assert.deepEqual(f.b.errors,[]);
});
test('canonical silence immunity is preserved; accepted forced brief silence interrupts the native silenceable link',()=>{
 const f=fixture(channels[1]),t=marker(f);begin(f);assert.equal(f.b.applyStatus(f.e,'silence',{duration:1}),false);f.h.run(.1);assert.equal(f.a.target,t);
 const sp=t.sp;assert.equal(f.b.applyStatus(f.e,'silence',{duration:.01,force:true}),true);f.b.removeBuff(f.e,'silence');f.h.run(1.1);
 assert.equal(f.a.target,null);assert.equal(t.sp,sp);assert.equal(f.e.s.def,700);assert.deepEqual(f.b.errors,[]);
});
test('rejected silence cannot create an interruption epoch or end the channel',()=>{
 const f=fixture(channels[1]),t=marker(f);begin(f);const epoch=f.e.silenceEpoch;
 f.b.on('beforeBuff',c=>{if(c.unit===f.e&&c.buff.flags?.silence)c.cancel=true;});assert.equal(f.b.addBuff(f.e,{key:'fixture-silence',flags:{silence:true},duration:1}),null);
 f.h.run(.1);assert.equal(f.e.silenceEpoch,epoch);assert.equal(f.a.target,t);assert.deepEqual(f.b.errors,[]);
});
for(const event of ['death','battleEnd','removed','reuse'])test(event+' retires channel holds and unborn SP',()=>{
 const f=fixture(channels[1]),t=marker(f);begin(f);const sp=t.sp;
 if(event==='death')f.b.kill(f.e,null);else if(event==='battleEnd')f.b.emit('battleEnd',{});else if(event==='removed'){f.e.deployed=false;f.b.emit('removed',{unit:f.e});}else f.e.deploySeq++;
 f.h.run(3);assert.equal(t.sp,sp);assert.equal(f.a.active,false);assert.equal(f.a.target,null);assert.equal(f.e.findBuff('ch16:charge'),null);assert.equal(f.e.findBuff('ch17:charge-def'),null);assert.deepEqual(f.b.errors,[]);
});
for(const event of ['death','battleEnd','cycle'])test('marker gain callback '+event+' cannot dispatch a second stale SP pulse',()=>{
 const f=fixture(channels[1]);let calls=0;
 marker(f,{gainSp(){calls++;if(event==='death')f.b.kill(f.e,null);else if(event==='battleEnd')f.b.emit('battleEnd',{});else this.cycle++;}});
 f.a.left=0;f.h.run(2);assert.equal(calls,1);assert.equal(f.a.target,null);assert.equal(f.e.findBuff('ch17:charge-def'),null);assert.deepEqual(f.b.errors,[]);
});
for(const mode of ['live','death','reuse','targetReuse'])test('ordinary channel-caster born projectile retains '+mode+' lifetime rules',()=>{
 const f=fixture(channels[1]);f.e.profile.noAttack=true;const hp=f.u.hp,life=f.e.deploySeq;
 f.a.attack({targets:[f.u]},f.b,f.e,f.a);
 if(mode==='live')f.b.addBuff(f.e,{key:'fixture-power',persist:true,mods:{atkPct:1,dmgDealtMul:2}});
 if(mode==='death')f.b.kill(f.e,null);
 if(mode==='reuse'){f.e.deploySeq++;f.e.base.atk=9999;f.e.markDirty();f.b.addBuff(f.e,{key:'fixture-new-life',persist:true,mods:{dmgDealtMul:9}});}
 if(mode==='targetReuse')f.u.deploySeq++;
 f.h.run(.4);assert.equal(hp-f.u.hp,mode==='live'?520:mode==='targetReuse'?0:130);assert.ok(life!==undefined);assert.deepEqual(f.b.errors,[]);
});
for(const key of carriers)test(key+' chooses the retained x-4 neighborhood, including an available diagonal, once per death',()=>{
 const f=fixture(key),env=chapter17Environment(f.b);
 const grids=read('candidates/arkpedia-ch17-channel-carrier-range-source.json').range.grids.map(p=>[10+p.row,6+p.col]).sort();assert.deepEqual(env.summonTiles(f.e).sort(),grids);
 for(const[r,c]of grids)if(r!==11||c!==7)f.b.grid.setObstacle(r,c,true);
 assert.deepEqual(env.summonTiles(f.e),[[11,7]]);assert.equal(f.e.s.taunt,1);f.b.kill(f.e,null);
 f.a.death({reason:'killed'},f.b,f.e,f.a);const children=f.b.enemies.filter(e=>e.defId===murad);assert.equal(children.length,1);assert.equal(children[0].tileR,11);assert.equal(children[0].tileC,7);assert.equal(children[0].counted,false);assert.equal(children[0].holdsBattle,false);assert.deepEqual(f.b.errors,[]);
});
for(const event of ['leak','battleEnd','reuse','noTile'])test('carrier '+event+' cannot synthesize a late summon',()=>{
 const f=fixture(carriers[1]);if(event==='leak')f.b.leak(f.e);else{
  if(event==='battleEnd')f.b.emit('battleEnd',{});if(event==='reuse')f.e.deploySeq++;
  if(event==='noTile')chapter17Environment(f.b).summonTiles=()=>[];
  f.b.kill(f.e,null);
 }
 assert.equal(f.b.enemies.filter(e=>e.defId===murad).length,0);assert.deepEqual(f.b.errors,[]);
});
for(const key of carriers)test(key+' uses canonical normal melee attacks against a real blocker',()=>{
 const f=fixture(key,{unitCol:6}),hits=[];f.b.on('damaged',c=>{if(c.source===f.e)hits.push(c);});f.h.run(5);
 assert.ok(hits.length>0);assert.ok(hits.every(c=>c.type==='phys'&&c.amount===records[key].levels[0].stats.atk));assert.deepEqual(f.b.errors,[]);
});
test('stronger support requires its own complete record/native claims and retains the summon dependency',()=>{
 const idx=read('arkpedia-enemy-clock-source.json'),base=read('candidates/arkpedia-ch16-native-abilities.json');
 const evidence={...base,prefabs:{...base.prefabs,...native.prefabs},actions:read('candidates/arkpedia-ch16-action-source.json'),chapter16Families:{channelCarrier:{graphSha256:review.sources.graph.sha256}}};
 const entries=Object.fromEntries([...Object.keys(review.enemies),murad].map(k=>[k,records[k]]));
 for(const key of Object.keys(review.enemies)){
  assert.equal(read('candidates/arkpedia-ch16-enemy-support.json').enemies[key].policy,'stats-attacks-and-features');assert.equal(deriveEnemySupport(entries,idx.prefabs,evidence)[key].policy,'stats-attacks-and-features');assert.equal(deriveEnemySupport(entries,idx.prefabs,native)[key].policy,null);
  const changed=structuredClone(evidence);changed.prefabs[prefabPath(key)][0].originalJson+=' ';assert.equal(deriveEnemySupport(entries,idx.prefabs,changed)[key].policy,null);
  const wrong=structuredClone(entries);wrong[key].levels[0].talents.bb.extra=1;assert.equal(deriveEnemySupport(wrong,idx.prefabs,evidence)[key].policy,null);
  const added=structuredClone(idx.prefabs);added[prefabPath(key)].clockComponents.push({fields:{_familyMask:1,_trigger:{}}});assert.equal(deriveEnemySupport(entries,added,evidence)[key].policy,null);
  const r=structuredClone(records[key].levels[0]);r.abilities[0].text+=' changed';assert.throws(()=>key===channels[1]?strongChannel(r):strongCarrier(r),/Unreviewed/);
 }
 const missing={...entries};delete missing[murad];assert.equal(deriveEnemySupport(missing,idx.prefabs,evidence)[carriers[1]].policy,null);
 assert.deepEqual(read('candidates/arkpedia-ch16-regular-enemies.json').spawns[carriers[1]],[murad]);
});
