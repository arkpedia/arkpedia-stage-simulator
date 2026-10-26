// SPDX-License-Identifier: GPL-3.0-or-later
// Browser engine fixture, not a canonical stage clear or dialog/UI parity test.
import test from'node:test';import assert from'node:assert/strict';import{existsSync}from'node:fs';
const chrome=process.env.CHROME_PATH??'/usr/bin/google-chrome',enabled=process.env.RENDER_E2E==='1'&&existsSync(chrome);
test('browser engine holds source dialogs and activates the four exact hidden cards alongside preset Viy',{skip:enabled?false:'set RENDER_E2E=1 with Chrome installed',timeout:60000},async()=>{
 const{startServer}=await import('../server/index.js'),puppeteer=(await import('puppeteer-core')).default,s=await startServer({port:0,host:'127.0.0.1',quiet:true});let browser;
 try{browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-first-run','--disable-gpu']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${s.port}/healthz`,{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
   const[{StandardBattle},{defaultBuild},{installStage17_16Cards},{installViyPredefined},asset,tutorial,{installStage17_16Dialogs}]=await Promise.all([
    import('/sim/arkpedia.js'),import('/shared/arkpedia/loadout.js'),import('/sim/content/arkpedia-stage-17-16-cards.js'),import('/sim/content/arkpedia-viy-predefined.js'),
    import('/data/arkpedia-mvp.json',{with:{type:'json'}}),import('/data/candidates/arkpedia-predefined-tutorial-source.json',{with:{type:'json'}}),
    import('/sim/content/arkpedia-stage-17-16-dialogs.js'),
   ]);
   const d=structuredClone(asset.default);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
   const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
   const ids=['char_473_mberry','char_128_plosis','char_4023_rfalcn','char_488_buildr'],get=b.data.getChess;for(const id of ids)b.data.getChess(id);
   const viy=installViyPredefined(b),cards=installStage17_16Cards(b,d),hidden=cards.cards().every(r=>!r.active)&&ids.every(id=>!b.bench[id]&&b.cost(id)===Infinity);
   const actions=tutorial.default.actions.filter(r=>r.action.actionType==='ACTIVATE_PREDEFINED').map(r=>r.action),dialogs=installStage17_16Dialogs(b);let acknowledgements=0,instruction;
   for(const{action}of tutorial.default.actions){
    if(action.actionType==='ACTIVATE_PREDEFINED')cards.receive(action);
    else if(action.actionType==='STORY')instruction=dialogs.receive(action).operation;
    else{dialogs.receive(action);for(let n=0;n<100;n++)b.step();if(b.time!==0||!b.simulationHeld)throw Error('Dialog advanced combat time');
     while(dialogs.state()){const receipt=dialogs.state().receipt;if(!dialogs.complete(receipt)||dialogs.complete(receipt))throw Error('Invalid dialog receipt ownership');acknowledgements++;}
     if(b.simulationHeld)throw Error('Completed dialog retained its hold');}
   }
   const deploy=(id,row,col)=>{b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(id,row,col,'RIGHT');u.atkCd=1000;return u;};
   const mul=deploy(ids[0],2,4),pti=deploy(ids[1],2,3),kes=deploy(ids[2],3,5),pon=deploy(ids[3],3,4);for(const u of[mul,pti,kes,pon])u.skill.setSpTotal(0);for(let n=0;n<Math.round(1/b.dt);n++)b.step();
   const paid=b.bench[ids[2]].lastCost,sp=[mul,pti,kes,pon].map(u=>u.skill.spTotal),atk=[mul.s.atk,pti.s.atk],slots=b.deployedSlots(),activated=b.activateOperator(viy.key);
   b.getPlayer('arkpedia').dp=0;b.retreatOperator(ids[2]);const ready=b.bench[ids[2]].readyAt;cards.receive(actions.find(a=>a.key===ids[2]+'#1'));
   return{hidden,acknowledgements,unchangedGetter:b.data.getChess===get,visible:cards.cards().filter(r=>r.active).length,paid,sp,atk,slots,instruction,activated,refund:b.dp,deployments:b.bench[ids[2]].deployments,cooldownPreserved:b.bench[ids[2]].readyAt===ready,errors:b.errors};
  });
  assert.ok(result.hidden);assert.ok(result.unchangedGetter);assert.equal(result.visible,4);assert.equal(result.paid,9);assert.equal(result.slots,5);assert.ok(result.activated);assert.equal(result.instruction.after,49);
  assert.equal(result.acknowledgements,14);
  for(const sp of result.sp)assert.ok(Math.abs(sp-1.35)<1e-6);assert.ok(Math.abs(result.atk[0]-458*1.15)<1e-6);assert.ok(Math.abs(result.atk[1]-437*1.15)<1e-6);
  assert.equal(result.refund,4);assert.equal(result.deployments,1);assert.ok(result.cooldownPreserved);assert.deepEqual(result.errors,[]);assert.deepEqual(errors,[]);
 }finally{await browser?.close();await s.close();}
});

test('browser source-field scheduler waits for wave clearance and composes dialogs, cards and native caster departures',{skip:enabled?false:'set RENDER_E2E=1 with Chrome installed',timeout:60000},async()=>{
 const{startServer}=await import('../server/index.js'),puppeteer=(await import('puppeteer-core')).default,s=await startServer({port:0,host:'127.0.0.1',quiet:true});let browser;
 try{browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-first-run','--disable-gpu']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${s.port}/healthz`,{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
   const[{createStage17_16MechanicsBattle},asset]=await Promise.all([import('/sim/arkpedia.js'),import('/data/arkpedia-mvp.json',{with:{type:'json'}})]);
   const b=createStage17_16MechanicsBattle(asset.default),{viy,cards,dialogs,schedule:scheduler}=b.internalStageMechanics;
   const initial={bench:Object.keys(b.bench),allies:b.allyUnits.length,slots:b.deployedSlots(),dp:b.dp};
   // Parked enemies and extra Viy HP isolate scheduling/retirement from
   // stage-clear balancing; construction itself has exactly the source roles.
   viy.unit.profile.noAttack=true;
   b.addBuff(viy.unit,{key:'fixture:durability',mods:{hpFlat:1e6},persist:true});viy.unit.hp=viy.unit.s.maxHp;b.on('enemySpawn',({enemy})=>{enemy.base.moveSpeed=0;enemy.markDirty();});
   const leaves=[];b.on('ch17WarCasterLeave',c=>leaves.push({age:c.age,status:c.status}));
   const precount=b.total;for(let n=0;n<2700;n++)b.step();const heldFirstWave=scheduler.state().wave===0&&scheduler.spawned().length===11&&!b.finished;
   for(const r of scheduler.spawned())b.kill(r.unit,null);let acknowledgements=0;
   for(let n=0;n<7000&&!b.finished;n++){
    b.step();if(dialogs.state()){const time=b.time;for(let j=0;j<10;j++)b.step();if(b.time!==time)throw Error('Dialog advanced combat');while(dialogs.state()){const{receipt}=dialogs.state();if(!dialogs.complete(receipt)||dialogs.complete(receipt))throw Error('Invalid dialog completion receipt');acknowledgements++;}}
   }
   const state=scheduler.state(),actions=state.history.filter(r=>r.offset!==undefined);return{initial,precount,heldFirstWave,acknowledgements,visible:cards.cards().filter(r=>r.active).length,sp:viy.unit.skill.spTotal,
    offsets:actions.map(r=>r.time-state.waveStartedAt-r.offset),killed:b.killed,total:b.total,reason:b.reason,scheduleReason:state.reason,leaves,errors:b.errors};
  });
  assert.deepEqual(result.initial,{bench:[],allies:1,slots:1,dp:10});assert.equal(result.precount,14);assert.ok(result.heldFirstWave);assert.equal(result.acknowledgements,14);assert.equal(result.visible,4);assert.equal(result.sp,49);
  assert.equal(result.offsets.length,7);for(const delta of result.offsets)assert.ok(Math.abs(delta)<1e-6);assert.equal(result.killed,14);assert.equal(result.total,14);assert.equal(result.reason,'cleared');assert.equal(result.scheduleReason,'complete');
  assert.equal(result.leaves.length,3);for(const leave of result.leaves){assert.equal(leave.status,'killed');assert.ok(Math.abs(leave.age-120)<.034);}assert.deepEqual(result.errors,[]);assert.deepEqual(errors,[]);
 }finally{await browser?.close();await s.close();}
});

test('browser exact internal fixed squad completes through natural combat and paid deployment commands',{skip:enabled?false:'set RENDER_E2E=1 with Chrome installed',timeout:60000},async()=>{
 const{startServer}=await import('../server/index.js'),puppeteer=(await import('puppeteer-core')).default,s=await startServer({port:0,host:'127.0.0.1',quiet:true});let browser;
 try{browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-first-run','--disable-gpu']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${s.port}/healthz`,{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
   const[{createStage17_16MechanicsBattle},asset]=await Promise.all([import('/sim/arkpedia.js'),import('/data/arkpedia-mvp.json',{with:{type:'json'}})]);
   const b=createStage17_16MechanicsBattle(asset.default);b.setViewport('fullscreen-workspace');const m=b.internalStageMechanics,paid=[],casts=[];let first=false,second=false,acknowledgements=0;
   const placements=[['char_473_mberry',2,2,'RIGHT'],['char_128_plosis',6,2,'RIGHT'],['char_4023_rfalcn',5,4,'RIGHT'],['char_488_buildr',3,4,'RIGHT']];
   for(let n=0;n<10000&&!b.finished;n++){
    b.step();while(m.dialogs.state()){if(!m.dialogs.complete(m.dialogs.state().receipt))throw Error('Dialog completion failed');acknowledgements++;}
    if(!first&&b.killed>=2&&m.schedule.state().wave===0&&m.viy.unit.skill.spTotal>=49){first=b.activateOperator(m.viy.key);if(first)casts.push(b.time);}
    if(!second&&m.schedule.state().history.some(r=>r.kind==='STORY')&&m.viy.unit.alive){second=b.activateOperator(m.viy.key);if(second)casts.push(b.time);}
    for(const[id,row,col,dir]of placements)if(b.bench[id]&&!b.bench[id].deployments){const before=b.dp,cost=b.cost(id),u=b.deployOperator(id,row,col,dir);if(!u.alive||Math.abs(before-b.dp-cost)>1e-6)throw Error('Fixed-card payment failed');paid.push({id,cost});}
   }
   return{reason:b.reason,life:b.life,total:b.total,finishedCount:b.killed+b.leakedCount,scheduleReason:m.schedule.state().reason,acknowledgements,casts:casts.length,paid,roles:b.allyUnits.map(u=>u.defId),errors:b.errors};
  });
  assert.equal(result.reason,'cleared');assert.equal(result.life,3);assert.equal(result.total,14);assert.equal(result.finishedCount,14);assert.equal(result.scheduleReason,'complete');assert.equal(result.acknowledgements,14);assert.equal(result.casts,2);
  assert.equal(result.paid.length,4);assert.equal(result.paid.find(r=>r.id==='char_4023_rfalcn').cost,9);assert.deepEqual(result.roles,['char_4226_veen','char_473_mberry','char_128_plosis','char_4023_rfalcn','char_488_buildr']);assert.deepEqual(result.errors,[]);assert.deepEqual(errors,[]);
 }finally{await browser?.close();await s.close();}
});
