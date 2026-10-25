// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { StandardBattle, stageAdapter } from '../server/sim/arkpedia.js';
import { chapter16BranchSpawner } from '../server/sim/content/chapter16-branch.js';
import { resolveStage, applyStage } from '../shared/arkpedia/stages.js';
import { assertRegularEnemies } from '../shared/arkpedia/enemies.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const bytes = p => readFileSync(new URL('../data/' + p, import.meta.url));
const read = p => JSON.parse(bytes(p));
const mvp = read('arkpedia-mvp.json'), index = read('arkpedia-stages.json');
const hash = b => createHash('sha256').update(b).digest('hex');
const specs = {
  '17-10': { total:29, scheduled:30, counts:{enemy_10211_murad:1,enemy_10201_muinf:20,enemy_10208_mucow:2,enemy_10203_mumag:4,enemy_10209_mubag:3}, hidden:['hidden1'], reason:'timeout' },
  '17-12': { total:38, counts:{enemy_10208_mucow:6,enemy_10203_mumag:10,enemy_10205_mufly:16,enemy_10209_mubag:6}, hidden:[], reason:'timeout' },
  '17-11': { total:50, scheduled:52, counts:{enemy_10211_murad:2,enemy_10201_muinf:29,enemy_10204_mudia:3,enemy_10205_mufly:14,enemy_10207_mubrut:4}, hidden:[] },
  '17-13': { total:72, counts:{enemy_10204_mudia_2:66,enemy_10201_muinf_2:3,enemy_10207_mubrut_2:3}, hidden:[] },
  '17-5': { total:18, scheduled:19, counts:{enemy_10201_muinf:14,enemy_10204_mudia:2,enemy_10205_mufly:2,enemy_10211_murad:1}, hidden:['raid','raid6A'], clearsBefore:293 },
  '17-6': { total:30, scheduled:31, counts:{enemy_10201_muinf:13,enemy_10203_mumag:4,enemy_10204_mudia:8,enemy_10205_mufly:5,enemy_10211_murad:1}, hidden:['hidden1'], cap:400, clearsBefore:367 },
  '16-10': { total:27, counts:{enemy_10120_uaghst_2:12,enemy_10126_rkbomb:8,enemy_10124_uashld:6,enemy_10127_rkmbst:1}, hidden:[] },
  '16-11': { total:28, counts:{enemy_10126_rkbomb:23,enemy_10127_rkmbst:5}, hidden:['raid4'] },
  '16-14': { total:28, counts:{enemy_10124_uashld_2:2,enemy_10120_uaghst_2:21,enemy_10127_rkmbst_2:5}, hidden:['raid4'] },
  '16-15': { total:27, counts:{enemy_10124_uashld_2:3,enemy_10120_uaghst_2:18,enemy_10122_uacann_2:3,enemy_10127_rkmbst_2:3}, hidden:['group1'], cap:600, clearsBefore:330 },
  '17-7': { total:28, counts:{enemy_10206_muveg:6,enemy_10201_muinf:13,enemy_10202_mubow:3,enemy_10204_mudia:6}, hidden:['h1','h2'] },
  '17-8': { total:40, counts:{enemy_10206_muveg:3,enemy_10201_muinf:24,enemy_10202_mubow:8,enemy_10207_mubrut:5}, hidden:['h2'] },
  '17-9': { total:22, scheduled:23, counts:{enemy_10208_mucow:4,enemy_10211_murad:1,enemy_10202_mubow:10,enemy_10206_muveg:4,enemy_10207_mubrut:4}, hidden:['raid','raid5A','raid5B'], cap:330, clearsBefore:302 },
};
const data = code => {
  const stage = read('arkpedia-stage-' + code + '.json');
  return { ...structuredClone(mvp), stage, enemies:structuredClone(stage.enemies) };
};
function battle(code, seed=19) {
  const b = new StandardBattle(data(code), {operators:[defaultBuild(mvp.operators.char_122_beagle)]}, {seed});
  b.life=1000; b.setViewport('fullscreen-workspace'); return b;
}

for (const [code,spec] of Object.entries(specs)) {
  const stage=read('arkpedia-stage-'+code+'.json');
  const source=read('candidates/arkpedia-stage-'+code+'-source.json');
  const review=read('candidates/arkpedia-'+(code.startsWith('17-')?'ch17':'ch16')+'-reviewed-stage-'+code+'.json');
  test(code+' normal source counts and test-only ownership stay separate from public admission',async()=>{
    assert.equal(index.stages.filter(s=>!s.testOnly).length,597);
    assert.throws(()=>resolveStage(index,code),/test-only/);
    const d=structuredClone(mvp);
    await applyStage(d,index,code,async()=>({ok:true,json:async()=>structuredClone(stage)}),{experimental:true});
    assert.doesNotThrow(()=>assertRegularEnemies(d));
    for(const mutate of [s=>{s.testOnly=false;},s=>{delete s.enemyCatalogue;},s=>{s.code='16-9';}]) {
      const changed=data(code);mutate(changed.stage);
      assert.throws(()=>assertRegularEnemies(changed),/Unsupported/);
    }
    assert.equal(stage.chapter16Source.canonicalData.commit,'245d7c601ce3a4a42adcfb84faa1bd1123d507bb');
    assert.equal(stage.canonicalData.repository,'arkpedia/arkpedia-data');
    assert.equal(stage.pathing.moveScale,.5);
    assert.deepEqual(stage.excludedHiddenGroups,spec.hidden);
    assert.deepEqual(stage.includedHiddenGroups,[]);
    const spawns=stageAdapter(stage).spawns;
    assert.equal(spawns.length,spec.scheduled??spec.total);
    for(const [key,n] of Object.entries(spec.counts))assert.equal(spawns.filter(s=>s.enemyKey===key).length,n,key);
    assert.deepEqual(Object.keys(stage.enemies).sort(),review.expected.enemies.slice().sort());
    if(code==='16-11') {
      assert.equal(source.rawLevel.waves.flatMap(w=>w.fragments.flatMap(f=>f.actions)).filter(a=>a.hiddenGroup==='raid4').reduce((n,a)=>n+a.count,0),4);
      assert.ok(source.rawLevel.runes.filter(r=>r.key==='level_hidden_group_enable').every(r=>r.difficultyMask==='SIX_STAR'));
    }
  });
  test(code+' normal builder reproduces exact output and rejects changed canonical bytes',()=>{
    for(const file of Object.values(review.sources))
      assert.equal(hash(readFileSync(new URL('../'+file.path,import.meta.url))),file.sha256);
    const dir=mkdtempSync(join(tmpdir(),'ch16-next-build-')),out=join(dir,'out.json');
    for(const key of ['stage','geometry','conditional']) {
      const text=JSON.stringify(source[key]);assert.equal(hash(text),source.inputs[key].sha256);
      writeFileSync(join(dir,key+'.json'),text);
    }
    const args=['tools/arkpedia/build-stage.mjs','--candidate','ch16','--stage',join(dir,'stage.json'),
      '--geometry',join(dir,'geometry.json'),'--conditional',join(dir,'conditional.json'),'--out',out];
    execFileSync(process.execPath,args,{stdio:'pipe'});
    assert.deepEqual(readFileSync(out),bytes('arkpedia-stage-'+code+'.json'));
    writeFileSync(join(dir,'stage.json'),JSON.stringify({...source.stage,name:'Altered'}));
    const refused=join(dir,'refused.json');args[args.length-1]=refused;
    assert.throws(()=>execFileSync(process.execPath,args,{stdio:'pipe'}),e=>/does not match its reviewed canonical source/.test(String(e.stderr)));
    assert.equal(existsSync(refused),false);
  });
  for(const seed of [19,71,129])test(code+' seeded normal battle '+seed,()=>{
    const b=battle(code,seed),born=[],hiddenSince=new Map(),hiddenDurations=[];let bruteArmed=false,bagConsumed=0,maxBagStacks=0;
    assert.equal(b.timeLimit,300);
    assert.equal(b.total,spec.total);
    if(spec.cap)b.timeLimit=spec.cap;
    b.on('enemySpawn',({enemy})=>born.push(enemy));
    b.on('ch17BagConsumed',()=>bagConsumed++);b.on('ch17BagStack',({stacks})=>maxBagStacks=Math.max(maxBagStacks,stacks));
    while(!b.finished) {
      for(const[id,e]of b.stageDeviceActions??[])if(b.time<121&&e.state.canActivate())b.activateStageDevice(id);
      b.step();
      bruteArmed ||= b.enemies.some(e=>e.defId==='enemy_10207_mubrut'&&e.mem.ab?.list.some(a=>a.mode===1));
      if(code==='17-13'){
        for(const e of born){
          if(!e.alive||e.defId!=='enemy_10204_mudia_2')continue;
          if(e.hidden&&!hiddenSince.has(e))hiddenSince.set(e,b.time);
          else if(!e.hidden&&hiddenSince.has(e)){hiddenDurations.push(b.time-hiddenSince.get(e));hiddenSince.delete(e);}
        }
      }
    }
    assert.equal(b.result().reason,spec.reason??'cleared');
    if(spec.reason==='timeout')assert.equal(b.time,300);else assert.ok(b.time<(spec.clearsBefore??280));
    assert.equal(b.total,spec.total+born.filter(e=>e.mem.ch17RockbreakerParent).length);assert.deepEqual(b.errors,[]);
    const children=born.filter(e=>e.mem.ch16Branch);
    if(code.startsWith('16-'))assert.ok(children.length>0);
    assert.ok(children.every(e=>e.holdsBattle===false&&!e.counted));
    assert.deepEqual([...new Set(children.map(e=>e.mem.ch16Branch.route))].sort(),code==='16-15'?[0,1]:code.startsWith('16-')?[0]:[]);
    if(code==='16-10') {
      const phantoms=born.filter(e=>e.defId==='enemy_10120_uaghst_2');
      assert.equal(phantoms.length,12);
      assert.ok(phantoms.every(e=>e.mem.ab.list.length===1));
    } else if(code==='16-11')assert.ok(born.some(e=>e.defId==='enemy_10126_rkbomb'&&e.mem.ab.list.some(a=>a.changeMode&&a.mode===1)));
    if(code==='17-7')assert.ok(born.some(e=>e.mem.ch17RockbreakerParent),'natural marker pollution triggers a real split');
    if(code==='17-8')assert.ok(bruteArmed,'natural Leak Source contact arms a real scheduled Brute');
    if(['17-5','17-6','17-11','17-12'].includes(code))assert.ok(born.some(e=>e.defId==='enemy_10205_mufly'&&e.mem.ch17FlyerMode===2),'scheduled Flyers find two real Leak Sources and finish both growth steps');
    if(['17-10','17-12'].includes(code)){assert.ok(bagConsumed>0,'scheduled Bags consume real natural sources');assert.equal(maxBagStacks,40);}
    if(code==='17-13'){
      assert.ok(hiddenDurations.length>0,'source teleports keep their hidden wait and reappear');
      assert.ok(hiddenDurations.every(t=>Math.abs(t-10)<=2*b.dt),'each original tunnel wait remains hidden for ten seconds');
      assert.ok(born.some(e=>e.mem.ch17RockbreakerParent),'natural sources split stronger Rockbreakers');
      assert.ok(b.total>spec.total);
    }
  });
}

for(const code of ['17-10','17-12'])test(code+' legally deployed sniper attacks scheduled Bags and retires a killed feeding controller',()=>{
  const id='char_124_kroos',b=new StandardBattle(data(code),{operators:[defaultBuild(mvp.operators[id])]},{seed:19});
  b.life=1000;b.setViewport('fullscreen-workspace');
  const killed=[];let hits=0;
  b.on('death',c=>{if(c.unit.defId==='enemy_10209_mubag'&&c.killer?.side==='ally')killed.push(c.unit);});
  b.on('damaged',c=>{if(c.source?.defId===id&&c.target.defId==='enemy_10209_mubag')hits++;});
  while(b.time<150)b.step();
  assert.equal(b.placementError(id,3,6),null);
  const sniper=b.deployOperator(id,3,6,code==='17-10'?'RIGHT':'DOWN');assert.ok(sniper);
  // Controlled durability/output fixture; targeting, attack clocks, damage and
  // death ownership still use the actual legally deployed operator pipeline.
  b.addBuff(sniper,{key:'bag-combat-fixture',persist:true,mods:{hpFlat:1e6,atkFlat:10000}});sniper.hp=sniper.s.maxHp;
  while(!b.finished)b.step();
  assert.ok(hits>0);assert.ok(killed.length>0);
  for(const e of killed){const a=e.mem.ab.list.find(a=>a.contacts);assert.equal(a.active,false);assert.equal(a.phase,null);assert.equal(a.contacts.size,0);assert.equal(e.profile.nativeFlyingTrace,undefined);}
  assert.equal(b.timeLimit,300);assert.deepEqual(b.errors,[]);
});

test('17-6 route-only fixture retains the unchanged 300-second game timeout',()=>{
  const b=battle('17-6');while(!b.finished)b.step();
  assert.equal(b.result().reason,'timeout');assert.equal(b.timeLimit,300);assert.deepEqual(b.errors,[]);
});

test('16-15 route-only fixture retains the default 300-second timeout rather than raising the game cap',()=>{
  const b=battle('16-15');
  while(!b.finished){for(const[id,e]of b.stageDeviceActions)if(b.time<121&&e.state.canActivate())b.activateStageDevice(id);b.step();}
  assert.equal(b.result().reason,'timeout');assert.equal(b.timeLimit,300);assert.deepEqual(b.errors,[]);
});

test('17-9 source route-only fixture still times out at the default 300-second gameplay cap',()=>{
  const b=battle('17-9');while(!b.finished)b.step();
  assert.equal(b.result().reason,'timeout');assert.equal(b.timeLimit,300);assert.deepEqual(b.errors,[]);
});

for(const code of ['17-8','17-9'])test(code+' scheduled Brutes fight a legally placed guard with one shared attack receipt per cast',()=>{
  const b=battle(code);b.timeLimit=330;
  while(b.time<60)b.step();
  const row=code==='17-8'?1:2;
  assert.equal(b.placementError('char_122_beagle',row,9),null);
  const guard=b.deployOperator('char_122_beagle',row,9,'LEFT');
  // Explicit survivability fixture: preserve the original waves/attack output,
  // then legally retreat this guard rather than holding the route forever.
  b.addBuff(guard,{key:'brute-stage-survival-fixture',persist:true,mods:{hpFlat:1e6}});guard.hp=guard.s.maxHp;
  const hits=[];b.on('ch17BruteHit',c=>hits.push(c));
  while(b.time<210&&!b.finished)b.step();
  assert.ok(hits.length>0);assert.ok(hits.every(c=>c.target===guard));
  if(code==='17-8') {
    const enhanced=hits.filter(c=>c.mode===1);assert.ok(enhanced.length>0);
    const packets=new Map();for(const c of enhanced)packets.set(c.attackId,(packets.get(c.attackId)??0)+1);
    assert.ok([...packets.values()].some(n=>n===3));assert.ok([...packets.values()].every(n=>n<=3));
  }
  b.retreatOperator('char_122_beagle');while(!b.finished)b.step();
  assert.equal(b.result().reason,'cleared');assert.deepEqual(b.errors,[]);
});

test('16-11 native branch preserves hidden ten-second wait and displaced reappearance',()=>{
  const b=battle('16-11');b.autoFinish=false;
  const source=data('16-11').stage.chapter16Source;
  const spawn=chapter16BranchSpawner(b,source),child=spawn('mcreep_route',0,{id:12345});
  const r=child.route,offset={...r.cursorOffset};
  assert.deepEqual(r.legs.slice(-4).map(l=>l.t),['disappear','wait','appear','move']);
  assert.equal(r.legs.at(-3).time,10);
  r.legIdx=r.legs.findIndex(l=>l.t==='disappear');r.pts=null;
  child.base.moveSpeed=0;child.atkCd=1e6;child.markDirty();
  b.step();assert.equal(child.hidden,true);
  for(let i=0;i<Math.round(9/b.dt);i++)b.step();
  assert.equal(child.hidden,true);assert.ok(r.waitLeft>.8&&r.waitLeft<1.1);
  for(let i=0;i<Math.round(1.1/b.dt);i++)b.step();
  assert.equal(child.hidden,false);
  assert.ok(Math.abs(child.x-offset.x)<1e-9);assert.ok(Math.abs(child.y-6-offset.y)<1e-9);
  assert.deepEqual(b.errors,[]);
});

test('branch control validation refuses malformed timing, unmatched appearance and unsupported checkpoints',()=>{
  const b=battle('16-11'),source=data('16-11').stage.chapter16Source;
  for(const mutate of [
    p=>{p[7].time=-1;},p=>{p[7].time=null;},p=>{p[6].type='APPEAR_AT_POS';},
    p=>{p[8].type='MOVE';},p=>{p[7].type='WAIT_CURRENT_FRAGMENT';},p=>{p[8].reachOffset.x=.1;}
  ]) {
    const changed=structuredClone(source);mutate(changed.rawLevel.extraRoutes[0].checkpoints);
    assert.throws(()=>chapter16BranchSpawner(b,changed),/Unreviewed|Unclosed/);
  }
});

test('catalogue and candidate support check commands actually execute on Windows as well as Linux',()=>{
  assert.match(execFileSync(process.execPath,['tools/arkpedia/stage-index.mjs','--check'],{encoding:'utf8'}),new RegExp('Stage catalogue matches '+index.stages.length+' entries'));
  assert.match(execFileSync(process.execPath,['tools/arkpedia/enemy-support.mjs','--candidate-ch16','--check'],{encoding:'utf8'}),/Enemy support matches/);
});
