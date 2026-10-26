// SPDX-License-Identifier: GPL-3.0-or-later
// Actual source field and unmodified app; all game changes use visible controls.
import test from 'node:test';import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
const chrome=process.env.CHROME_PATH??'/usr/bin/google-chrome',enabled=process.env.RENDER_E2E==='1'&&existsSync(chrome);
async function dragCard(page,id,tile,mobile){
 const center=selector=>page.$eval(selector,e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
 const from=await center(`#deployment button[data-id="${id}"]`),to=await center(tile);
 if(mobile){
  const touch=await page.touchscreen.touchStart(from.x,from.y);
  try{for(let n=1;n<=8;n++)await touch.move(from.x+(to.x-from.x)*n/8,from.y+(to.y-from.y)*n/8);}finally{await touch.end();}
 }else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();}
}
test('17-14 selectable preparation, separate preset, natural skill and restart use the actual desktop/phone workspace',{skip:enabled?false:'set RENDER_E2E=1 with Chrome installed',timeout:300000},async()=>{
 const {startServer}=await import('../server/index.js'),{createStage17_14ReviewServer}=await import('../tools/arkpedia/internal-17-14-review.mjs'),puppeteer=(await import('puppeteer-core')).default;
 const s=await startServer({port:0,host:'127.0.0.1',quiet:true});let fixture,browser;
 try{
  fixture=await createStage17_14ReviewServer({origin:`http://127.0.0.1:${s.port}`,geometryOnly:true});
  browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-first-run','--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-background-timer-throttling']});mkdirSync('.cache',{recursive:true});
  for(const[url,message]of [[`http://127.0.0.1:${s.port}/arkpedia/?stage=17-14&experimental=1`,'Unknown stage: 17-14'],[fixture.origin+'/arkpedia/','Stage 17-14 is test-only: open it with ?experimental=1']]){
   const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.body.textContent.includes('Stage not supported yet'));assert.equal(await p.$('#start'),null);assert.deepEqual(errors,[message]);await p.close();
  }
  for(const mobile of [false,true]){
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport(mobile?{width:844,height:390,isMobile:true,hasTouch:true}:{width:1440,height:1000});
   await page.goto(fixture.origin+'/arkpedia/?experimental=1',{waitUntil:'domcontentloaded'});await page.waitForSelector('#start:not(:disabled)');
   assert.ok((await page.$eval('.stage-meta',e=>e.textContent)).includes('5 enemy types'));
   const preset=await page.$eval('[aria-label="Stage-supplied operators"]',e=>e.textContent);for(const text of ['Closure','Lv 90','S3 M3','Potential 1','Trust 100%','Module Lv 3'])assert.ok(preset.includes(text),text);
   assert.equal(await page.$$eval('[aria-label="Stage-supplied operators"] li',e=>e.length),1);assert.equal(await page.$('#roster [data-id="char_4228_closur"]'),null);assert.equal(await page.$('#support option[value="char_4228_closur"]'),null);
   for(const id of ['roster','build','support','roster-search'])assert.ok(await page.$('#'+id));
   // Keep a real selectable squad, edit one build, and choose distinct support.
   await page.click('#roster [data-id="char_002_amiya"]');await page.click('#toggle');await page.select('#support','char_002_amiya');await page.select('#support-skill','skchr_amiya_2');
   await page.click('#roster [data-id="char_122_beagle"]');await page.$eval('#level',e=>{e.value='50';e.dispatchEvent(new Event('change',{bubbles:true}));});await page.$eval('#trust',e=>{e.value='100';e.dispatchEvent(new Event('change',{bubbles:true}));});
   assert.equal(await page.$('#support option[value="char_4228_closur"]'),null);await page.screenshot({path:`.cache/stage17-14-preparation-${mobile?'phone':'desktop'}.png`,fullPage:true});
   await page.click('#start');await page.waitForSelector('.workspace #pause');const read=()=>page.evaluate(()=>__stage17_14Review.read());let r=await read();
   assert.equal(r.code,'17-14');assert.equal(r.dp,10);assert.equal(r.slots,1);assert.equal(r.total,52);assert.equal(r.pending,52);assert.equal(r.preset.build.moduleLevel,3);assert.equal(r.preset.build.potential,1);
   assert.deepEqual(r.selection.operators.map(b=>b.id),['char_122_beagle','char_151_myrtle','char_128_plosis']);assert.equal(r.selection.support.id,'char_002_amiya');assert.equal(r.selection.support.skillId,'skchr_amiya_2');assert.equal(r.records.char_122_beagle.build.level,50);assert.equal(r.records.char_122_beagle.build.trust,100);assert.equal(r.records.char_002_amiya.build.level,80);assert.equal(r.records.char_002_amiya.build.skillRank,10);assert.equal(r.records.char_4228_closur,undefined);
   const originalSelection=r.selection;
   await page.click('.tile-hit[aria-label*="row 4, column 4"]');await page.waitForSelector('#field-command #skill');assert.equal(await page.$('#field-command #retreat'),null);assert.equal((await read()).selected,r.preset.key);
   assert.ok((await page.$eval('#command .operator-build',e=>e.textContent)).includes('Module Lv 3'));assert.ok((await page.$eval('#command .hp-readout',e=>e.textContent)).includes('1942'));
   await page.click('#deployment button[data-id="summon:char_4228_closur"]');await page.click('.tile-hit[aria-label*="row 4, column 7"]');await page.waitForFunction(()=>!!__stage17_14Review.read().point);r=await read();assert.equal(r.dp,10);assert.equal(r.slots,1);assert.deepEqual(r.point.tile,[3,6]);
   await dragCard(page,'char_151_myrtle','.tile-hit[aria-label*="row 2, column 7"]',mobile);assert.equal(await page.$eval('.facing-picker',e=>e.hidden),false,JSON.stringify(await read()));
   const facingHit=await page.$eval('button[data-facing="DOWN"]',e=>{const r=e.getBoundingClientRect();window.__inputTrace=[];for(const type of ['pointerdown','pointerup','touchstart','touchend','click'])document.addEventListener(type,e=>window.__inputTrace.push({type,target:e.target.outerHTML.slice(0,120),x:e.clientX,y:e.clientY}),{capture:true,once:true});return{rect:r.toJSON(),hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,500),viewport:{width:innerWidth,height:innerHeight,scale:visualViewport.scale,x:visualViewport.offsetLeft,y:visualViewport.offsetTop,scrollY}};});
   assert.ok(facingHit.hit.includes('data-facing="DOWN"'),'the facing tap must reach its arrow rather than the central handle');
   if(mobile){
    const t=await page.touchscreen.touchStart(facingHit.rect.x+22,facingHit.rect.y+22);
    await t.move(facingHit.rect.x+90,facingHit.rect.y-40);await t.end();
    r=await read();assert.equal(r.records.char_151_myrtle.alive,false);assert.equal(r.dp,10);assert.ok(r.placement);
   }
   if(mobile)await page.tap('button[data-facing="DOWN"]');else await page.click('button[data-facing="DOWN"]');await page.waitForFunction(()=>__stage17_14Review.read().records.char_151_myrtle.alive||__stage17_14Review.read().error,{timeout:5000}).catch(async e=>{throw Error('Facing touch: '+JSON.stringify({facingHit,trace:await page.evaluate(()=>__inputTrace),state:await read()}),{cause:e});});r=await read();if(!r.records.char_151_myrtle.alive)await page.screenshot({path:'.cache/stage17-14-facing-failure.png'});assert.equal(r.records.char_151_myrtle.alive,true,JSON.stringify({state:r,facingHit,mobile}));
   assert.equal(r.records.char_151_myrtle.deployments,1);assert.equal(r.dp,0);
   await page.click('#speed');await page.click('#pause');
   await page.waitForFunction(()=>{const r=__stage17_14Review.read();return r.dp>=r.records.char_128_plosis.cost-5&&!document.querySelector('#deployment button[data-id="char_128_plosis"]').classList.contains('unavailable');},{timeout:45000});await page.click('#pause');
   // Drag reaches the left-hand tile beneath the inspector, using actual touch
   // input on the phone. The inspector becomes inert during the placement drag.
   await dragCard(page,'char_128_plosis','.tile-hit[aria-label*="row 5, column 3"]',mobile);r=await read();assert.equal(r.error,'',JSON.stringify(r));assert.equal(await page.$eval('.facing-picker',e=>e.hidden),false,JSON.stringify(r));if(mobile)await page.tap('button[data-facing="RIGHT"]');else await page.click('button[data-facing="RIGHT"]');await page.waitForFunction(()=>__stage17_14Review.read().records.char_128_plosis.alive||__stage17_14Review.read().error,{timeout:5000});r=await read();assert.equal(r.records.char_128_plosis.alive,true,JSON.stringify(r));
   assert.equal(r.records.char_128_plosis.deployments,1);assert.ok(r.dp>=-5&&r.dp<0,'the legal source borrowing allowance is available through the actual UI');
   await page.click('#command .inspector-close');await page.click('.tile-hit[aria-label*="row 4, column 4"]');await page.waitForSelector('#field-command #skill');assert.equal((await read()).selected,r.preset.key);await page.click('#pause');
   await page.waitForFunction(()=>{const r=__stage17_14Review.read();return r.preset.alive&&r.preset.sp>=r.preset.maxSp&&!document.querySelector('#field-command #skill')?.disabled;},{timeout:90000}).catch(async e=>{throw Error('Natural preset skill readiness: '+JSON.stringify(await read()),{cause:e});});
   await page.click('#field-command #skill');assert.equal((await read()).preset.skillActive,true);await page.click('#pause');
   r=await read();assert.ok(r.time>0);assert.ok(r.pending<52);assert.equal(r.preset.build.moduleLevel,3);assert.equal(r.records.char_4228_closur,undefined);assert.equal(r.error,'');assert.deepEqual(r.errors,[]);
   await page.screenshot({path:`.cache/stage17-14-workspace-${mobile?'phone':'desktop'}.png`});
   await page.click('#settings');await page.click('#restart');await page.waitForFunction(()=>__stage17_14Review.read().time===0&&__stage17_14Review.read().point===null);
   r=await read();assert.equal(r.dp,10);assert.equal(r.slots,1);assert.equal(r.pending,52);assert.equal(r.preset.alive,true);assert.equal(r.preset.skillActive,false);assert.deepEqual(r.selection,originalSelection);assert.equal(r.records.char_122_beagle.build.level,50);assert.ok(Object.values(r.records).every(e=>!e.alive&&e.deployments===0));
   await page.click('.tile-hit[aria-label*="row 4, column 4"]');await page.waitForSelector('#field-command #skill');assert.equal((await read()).selected,r.preset.key);assert.equal(await page.$('#field-command #retreat'),null);
   await page.click('#deployment button[data-id="summon:char_4228_closur"]');await page.click('.tile-hit[aria-label*="row 4, column 7"]');await page.waitForFunction(()=>!!__stage17_14Review.read().point);assert.equal((await read()).point.mode,'born');assert.equal((await read()).dp,10);assert.equal((await read()).error,'');assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser?.close();await fixture?.close();await s.close();}
});
