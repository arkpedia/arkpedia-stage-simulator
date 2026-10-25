// SPDX-License-Identifier: GPL-3.0-or-later
// Browser engine fixture, not a canonical stage clear or dialog/UI parity test.
import test from'node:test';import assert from'node:assert/strict';import{existsSync}from'node:fs';
const chrome=process.env.CHROME_PATH??'/usr/bin/google-chrome',enabled=process.env.RENDER_E2E==='1'&&existsSync(chrome);
test('browser engine registers and activates the four exact hidden cards alongside preset Viy',{skip:enabled?false:'set RENDER_E2E=1 with Chrome installed',timeout:60000},async()=>{
 const{startServer}=await import('../server/index.js'),puppeteer=(await import('puppeteer-core')).default,s=await startServer({port:0,host:'127.0.0.1',quiet:true});let browser;
 try{browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-first-run','--disable-gpu']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${s.port}/healthz`,{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
   const[{StandardBattle},{defaultBuild},{installStage17_16Cards},{installViyPredefined,applyViyTutorialSp},asset,tutorial]=await Promise.all([
    import('/sim/arkpedia.js'),import('/shared/arkpedia/loadout.js'),import('/sim/content/arkpedia-stage-17-16-cards.js'),import('/sim/content/arkpedia-viy-predefined.js'),
    import('/data/arkpedia-mvp.json',{with:{type:'json'}}),import('/data/candidates/arkpedia-predefined-tutorial-source.json',{with:{type:'json'}}),
   ]);
   const d=structuredClone(asset.default);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
   const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
   const ids=['char_473_mberry','char_128_plosis','char_4023_rfalcn','char_488_buildr'],get=b.data.getChess;for(const id of ids)b.data.getChess(id);
   const viy=installViyPredefined(b),cards=installStage17_16Cards(b,d),hidden=cards.cards().every(r=>!r.active)&&ids.every(id=>!b.bench[id]&&b.cost(id)===Infinity);
   const actions=tutorial.default.actions.filter(r=>r.action.actionType==='ACTIVATE_PREDEFINED').map(r=>r.action);for(const a of actions)cards.receive(a);
   const deploy=(id,row,col)=>{b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(id,row,col,'RIGHT');u.atkCd=1000;return u;};
   const mul=deploy(ids[0],2,4),pti=deploy(ids[1],2,3),kes=deploy(ids[2],3,5),pon=deploy(ids[3],3,4);for(const u of[mul,pti,kes,pon])u.skill.setSpTotal(0);for(let n=0;n<Math.round(1/b.dt);n++)b.step();
   const paid=b.bench[ids[2]].lastCost,sp=[mul,pti,kes,pon].map(u=>u.skill.spTotal),atk=[mul.s.atk,pti.s.atk],slots=b.deployedSlots(),instruction=applyViyTutorialSp(b),activated=b.activateOperator(viy.key);
   b.getPlayer('arkpedia').dp=0;b.retreatOperator(ids[2]);const ready=b.bench[ids[2]].readyAt;cards.receive(actions.find(a=>a.key===ids[2]+'#1'));
   return{hidden,unchangedGetter:b.data.getChess===get,visible:cards.cards().filter(r=>r.active).length,paid,sp,atk,slots,instruction,activated,refund:b.dp,deployments:b.bench[ids[2]].deployments,cooldownPreserved:b.bench[ids[2]].readyAt===ready,errors:b.errors};
  });
  assert.ok(result.hidden);assert.ok(result.unchangedGetter);assert.equal(result.visible,4);assert.equal(result.paid,9);assert.equal(result.slots,5);assert.ok(result.activated);assert.equal(result.instruction.after,49);
  for(const sp of result.sp)assert.ok(Math.abs(sp-1.35)<1e-6);assert.ok(Math.abs(result.atk[0]-458*1.15)<1e-6);assert.ok(Math.abs(result.atk[1]-437*1.15)<1e-6);
  assert.equal(result.refund,4);assert.equal(result.deployments,1);assert.ok(result.cooldownPreserved);assert.deepEqual(result.errors,[]);assert.deepEqual(errors,[]);
 }finally{await browser?.close();await s.close();}
});
