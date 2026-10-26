// SPDX-License-Identifier: GPL-3.0-or-later
// Existing app, exact internal construction, real controls and read-only QA.
// The normal prep screen is review scaffolding; native stage admission stays shut.
import test from'node:test';import assert from'node:assert/strict';import{existsSync,mkdirSync}from'node:fs';
const chrome=process.env.CHROME_PATH??'/usr/bin/google-chrome',enabled=process.env.RENDER_E2E==='1'&&existsSync(chrome);

test('preset Closure command-center placement, inspection, recovery and restart use the existing workspace',{skip:enabled?false:'set RENDER_E2E=1 with Chrome installed',timeout:240000},async()=>{
 const{startServer}=await import('../server/index.js'),{createClosurControlsReviewServer}=await import('../tools/arkpedia/internal-closur-controls-review.mjs'),puppeteer=(await import('puppeteer-core')).default;
 const s=await startServer({port:0,host:'127.0.0.1',quiet:true});let browser,fixture;
 try{
  fixture=await createClosurControlsReviewServer({origin:`http://127.0.0.1:${s.port}`});browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-first-run','--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-background-timer-throttling']});mkdirSync('.cache',{recursive:true});
  for(const mobile of [false,true]){
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport(mobile?{width:844,height:390,isMobile:true,hasTouch:true}:{width:1440,height:900});await page.goto(fixture.origin+'/arkpedia/',{waitUntil:'domcontentloaded'});await page.waitForSelector('#start:not(:disabled)');await page.click('#start');await page.waitForSelector('.workspace #pause');
   const read=()=>page.evaluate(()=>__closurControlsReview.read());let state=await read();assert.deepEqual(state.bench,['char_122_beagle']);assert.equal(state.slots,1);assert.equal(state.point,null);
   await page.evaluate(()=>__closurControlsReview.read().errors.push('observation-copy'));assert.deepEqual((await read()).errors,[]);
   const card='#deployment button[data-id="summon:char_4228_closur"]',tile='.tile-hit[aria-label*="row 4, column 5"]';
   await page.waitForSelector(card);await page.click(card);assert.ok((await page.$eval('#command',e=>e.textContent)).includes('Closure'));assert.equal(await page.$('#field-command #skill'),null);
   const dp=state.dp;await page.click(tile);await page.waitForFunction(()=>!!__closurControlsReview.read().point);state=await read();assert.equal(state.dp,dp);assert.equal(state.slots,1);assert.deepEqual(state.point.tile,[3,4]);assert.equal(state.point.skill,true);const pointId=state.point.id;
   await page.click(tile);await page.waitForSelector('#command:not([hidden])');assert.equal(await page.$('#field-command #skill'),null);assert.ok((await page.$eval('#command',e=>e.textContent)).includes('0 deployment slots'));
   await page.click('#speed');await page.click('#pause');await page.waitForSelector('#field-command #retreat:not(:disabled)');await page.click('#pause');
   await page.screenshot({path:`.cache/closur-controls-${mobile?'phone':'desktop'}.png`});const restDp=(await read()).dp;await page.click('#field-command #retreat');state=await read();assert.equal(state.point.mode,'recharge');assert.equal(state.point.id,pointId);assert.equal(state.point.alive,true);assert.equal(state.dp,restDp);assert.equal(state.slots,1);
   await page.click(tile);await page.waitForSelector('#field-command #retreat:disabled');assert.ok((await page.$eval('#command',e=>e.textContent)).includes('Command center recovering'));assert.equal(await page.$('#field-command #skill'),null);
   // Software rendering can run slower than wall time because the app caps
   // frame delta. Check the literal world-clock recovery/OnStart deadline;
   // a stalled transition fails shortly after that deadline, even on a fast host.
   const activationAt=state.point.readyAt+state.point.activationDelay;
   await page.click('#pause');assert.equal((await read()).paused,false);
   const recovery=await page.waitForFunction(at=>{const r=__closurControlsReview.read();return r.point?.mode==='active'||r.time>at+.25?r:false;},{timeout:90000},activationAt).catch(async error=>{throw new Error('Command-center recovery timed out: '+JSON.stringify(await read()),{cause:error});});
   const observed=await recovery.jsonValue();await recovery.dispose();assert.equal(observed.point.mode,'active');assert.ok(observed.time+1e-7>=activationAt);
   await page.click('#pause');state=await read();assert.equal(state.point.mode,'active');assert.equal(state.point.id,pointId);assert.equal(state.point.hp,state.point.maxHp);await page.waitForSelector('#field-command #retreat:not(:disabled)');
   await page.click('#settings');await page.click('#restart');await page.waitForFunction(()=>__closurControlsReview.read().time===0&&__closurControlsReview.read().point===null);state=await read();assert.deepEqual(state.bench,['char_122_beagle']);assert.equal(state.slots,1);assert.ok(state.owner.alive);
   // Numeric unit IDs may restart; this card and its callbacks must still bind
   // the new battle's source instance rather than retaining the retired deck.
   await page.click(card);await page.click(tile);await page.waitForFunction(()=>!!__closurControlsReview.read().point);state=await read();assert.equal(state.point.mode,'born');assert.equal(state.dp,dp);assert.equal(state.slots,1);assert.equal(state.error,'');assert.deepEqual(state.errors,[]);assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser?.close();await fixture?.close();await s.close();}
});
test('internal preset and module cards use the actual app command panels on desktop and phone',{skip:enabled?false:'set RENDER_E2E=1 with Chrome installed',timeout:240000},async()=>{
 const{startServer}=await import('../server/index.js'),{createStage17_16ReviewServer}=await import('../tools/arkpedia/internal-17-16-review.mjs'),puppeteer=(await import('puppeteer-core')).default,s=await startServer({port:0,host:'127.0.0.1',quiet:true});let browser,fixture;
 try{fixture=await createStage17_16ReviewServer({origin:`http://127.0.0.1:${s.port}`,geometryOnly:true});browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-first-run','--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-background-timer-throttling']});mkdirSync('.cache',{recursive:true});
  const denied=await browser.newPage(),deniedErrors=[];denied.on('pageerror',e=>deniedErrors.push(e.message));await denied.goto(`http://127.0.0.1:${s.port}/arkpedia/?stage=17-16&experimental=1`,{waitUntil:'domcontentloaded'});await denied.waitForFunction(()=>document.body.textContent.includes('Stage not supported yet'));assert.equal(await denied.$('#start'),null);assert.deepEqual(deniedErrors,['Unknown stage: 17-16']);await denied.close();
  for(const mobile of [false,true]){
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport(mobile?{width:844,height:390,isMobile:true,hasTouch:true}:{width:1440,height:900});await page.goto(fixture.origin+'/arkpedia/',{waitUntil:'domcontentloaded'});await page.waitForSelector('#start:not(:disabled)');await page.click('#start');await page.waitForSelector('.workspace #pause');
   assert.deepEqual(await page.evaluate(()=>Object.keys(__stage17_16Review.read().records)),[]);assert.equal(await page.evaluate(()=>__stage17_16Review.read().slots),1);
   await page.click('.tile-hit[aria-label*="row 5, column 4"]');await page.waitForSelector('#field-command #skill');assert.equal(await page.$('#field-command #retreat'),null);assert.equal(await page.evaluate(()=>__stage17_16Review.read().selected),'predefined:17-16:char_4226_veen:0');
   await page.click('#speed');await page.click('#pause');await page.waitForFunction(()=>__stage17_16Review.read().killed>=2&&!document.querySelector('#field-command #skill')?.disabled,{timeout:90000});await page.click('#field-command #skill');assert.equal(await page.evaluate(()=>__stage17_16Review.read().preset.skillActive),true);
   let lines=0;for(let n=0;n<9;n++){await page.waitForSelector('.stage-tutorial[open][data-instruction="dialogue"]',{timeout:90000});const before=await page.$eval('.stage-tutorial',e=>e.dataset.index);await page.click('.stage-tutorial button');lines++;await page.waitForFunction(index=>!document.querySelector('.stage-tutorial')?.open||document.querySelector('.stage-tutorial').dataset.index!==index,{},before);}
   await page.waitForFunction(()=>__stage17_16Review.read().cards?.every(c=>c.active),{timeout:15000});await page.click('#pause');assert.equal(await page.evaluate(()=>__stage17_16Review.read().paused),true);assert.equal(lines,9);
   await page.click('.tile-hit[aria-label*="row 5, column 4"]');await page.waitForSelector('#field-command #skill:not(:disabled)');await page.click('#field-command #skill');assert.equal(await page.evaluate(()=>__stage17_16Review.read().preset.skillActive),true);
   const cards=[['char_473_mberry',1597],['char_128_plosis',1710],['char_4023_rfalcn',2140],['char_488_buildr',2475]];
   for(const[id,hp]of cards){await page.click(`#deployment button[data-id="${id}"]`);await page.waitForSelector('#command:not([hidden])');assert.ok((await page.$eval('#command .operator-build',e=>e.textContent)).includes('Module Lv 3'));assert.ok((await page.$eval('#command .hp-readout',e=>e.textContent)).includes(String(hp)));for(const tab of ['trait','talent','skill']){await page.click(`#operator-tab-${tab}`);assert.ok((await page.$eval('#operator-tabpanel',e=>e.textContent)).trim());}}
   await page.screenshot({path:`.cache/operator-controls-${mobile?'phone':'desktop'}.png`});
   const kestrel='char_4023_rfalcn';await page.click(`#deployment button[data-id="${kestrel}"]`);const before=await page.evaluate(()=>__stage17_16Review.read().dp);await page.click('.tile-hit[aria-label*="row 6, column 5"]');await page.click('button[data-facing="RIGHT"]');await page.waitForFunction(id=>__stage17_16Review.read().records[id]?.alive,{},kestrel);
   const deployed=await page.evaluate(id=>__stage17_16Review.read().records[id],kestrel);assert.deepEqual(deployed.tile,[5,4]);assert.equal(deployed.dir,'RIGHT');assert.equal(deployed.deployments,1);assert.equal(before-await page.evaluate(()=>__stage17_16Review.read().dp),9);
   await page.click('.tile-hit[aria-label*="row 6, column 5"]');await page.waitForSelector('#field-command #retreat');const paid=await page.evaluate(()=>__stage17_16Review.read().dp);await page.click('#field-command #retreat');assert.equal(await page.evaluate(()=>__stage17_16Review.read().dp)-paid,4);assert.equal(await page.evaluate(id=>__stage17_16Review.read().records[id].alive,kestrel),false);
   // Keep the preset selected across restart: the same control key must bind
   // the new battle/body instead of retaining the old button's captured unit.
   await page.click('.tile-hit[aria-label*="row 5, column 4"]');await page.waitForSelector('#field-command #skill');await page.click('#settings');await page.click('#restart');await page.waitForFunction(()=>__stage17_16Review.read().time===0&&Object.keys(__stage17_16Review.read().records).length===0);assert.equal(await page.evaluate(()=>__stage17_16Review.read().slots),1);assert.equal(await page.evaluate(()=>__stage17_16Review.read().dp),10);
   await page.click('.tile-hit[aria-label*="row 5, column 4"]');await page.waitForSelector('#field-command #skill');await page.click('#pause');await page.waitForFunction(()=>__stage17_16Review.read().preset.sp>=49&&!document.querySelector('#field-command #skill')?.disabled,{timeout:45000});await page.click('#field-command #skill');assert.equal(await page.evaluate(()=>__stage17_16Review.read().preset.skillActive),true);
   assert.equal(await page.evaluate(()=>__stage17_16Review.read().error),'');assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser?.close();await fixture?.close();await s.close();}
});
