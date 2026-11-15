// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const run=source=>JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',source],{
 cwd:new URL('../',import.meta.url),encoding:'utf8',maxBuffer:1024*1024,
}));
test('a fresh slim engine executes content-none/generic battles and refuses unprepared full mode synchronously',()=>{
 const result=run(`
  import {Battle}from'./server/sim/BattleCore.js';
  const input={data:{chess:{},enemies:{},tokens:{},stages:{},waves:{}},autoFinish:false};
  let refused='';try{new Battle(input);}catch(e){refused=e.message;}
  const battles=['none','generic'].map(content=>{const b=new Battle({...input,content});b.start();b.step();return{content,errors:b.errors,time:b.time};});
  console.log(JSON.stringify({refused,battles}));
 `);
 assert.match(result.refused,/Full battle content is not prepared/);
 for(const b of result.battles){assert.deepEqual(b.errors,[]);assert.ok(b.time>0);}
});
test('the public full-mode entry point preserves class identity, helpers and the full kit/domain registry',()=>{
 const result=run(`
  import PublicBattle,{Battle,pushTiles}from'./server/sim/Battle.js';
  import Core,{Battle as Shared,pushTiles as sharedPush}from'./server/sim/BattleCore.js';
  import {KITS,MODULES,setupUnitKit,selectSkillSpec}from'./server/sim/content/index.js';
  import *as common from'./server/sim/content/core.js';
  const b=new Battle({data:{chess:{},enemies:{},tokens:{},stages:{},waves:{}},autoFinish:false});b.start();b.step();
  console.log(JSON.stringify({same:Battle===Shared&&Battle===PublicBattle&&Battle===Core&&pushTiles===sharedPush,
   sharedSetup:setupUnitKit===common.setupUnitKit&&selectSkillSpec===common.selectSkillSpec,
   kits:Object.keys(KITS).length,domains:MODULES.map(([name])=>name),errors:b.errors}));
 `);
 assert.equal(result.same,true);assert.equal(result.sharedSetup,true);assert.ok(result.kits>100);
 assert.ok(result.domains.includes('enemies'));assert.ok(result.domains.includes('bosses'));assert.deepEqual(result.errors,[]);
});
test('loading full content later leaves an existing content-none battle unchanged',()=>{
 const result=run(`
  import {Battle}from'./server/sim/BattleCore.js';
  const input={data:{chess:{},enemies:{},tokens:{},stages:{},waves:{}},autoFinish:false};
  const b=new Battle({...input,content:'none'});b.start();const hooks=Object.keys(b._hooks);
  const full=await import('./server/sim/Battle.js');b.step();
  const other=new full.Battle(input);other.start();other.step();
  console.log(JSON.stringify({same:full.Battle===Battle,hooksBefore:hooks,hooksAfter:Object.keys(b._hooks),
   fullEnemyHooks:other._hooks.enemySpawn?.length??0,errors:[...b.errors,...other.errors]}));
 `);
 assert.equal(result.same,true);assert.deepEqual(result.hooksAfter,result.hooksBefore);assert.ok(result.fullEnemyHooks>0);
 assert.deepEqual(result.errors,[]);
});
