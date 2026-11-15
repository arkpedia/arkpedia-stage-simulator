// SPDX-License-Identifier: GPL-3.0-or-later
// Decode every registered clip and render each body's idle in the browser runtime.
// Controlled galleries verify asset delivery; they are not battle fidelity tests.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182';
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname))throw Error('Use a loopback simulator preview');
const out=resolve(process.env.ARKPEDIA_REVIEW_OUT??'.cache/arkpedia/enemy-artwork-review');await mkdir(out,{recursive:true});
const kind=process.env.ARKPEDIA_REVIEW_KIND??'enemy';
if(!['enemy','device'].includes(kind))throw Error('Unknown artwork review kind');
const registry=JSON.parse(await readFile(new URL(`../../data/arkpedia-${kind}-artwork.json`,import.meta.url)));
const selected=process.env.ARKPEDIA_REVIEW_IDS_FILE?JSON.parse(await readFile(process.env.ARKPEDIA_REVIEW_IDS_FILE)):null;
const keys=selected?selected.map(id=>`${kind}/${id}/default/default`).sort():Object.keys(registry.models).sort();assert.ok(keys.length);
assert.equal(new Set(keys).size,keys.length);for(const key of keys)assert.ok(registry.models[key],key);
const browser=await puppeteer.launch({executablePath:process.env.ARKPEDIA_REVIEW_CHROME??'/usr/bin/chromium',headless:true,
 args:['--no-sandbox','--enable-unsafe-swiftshader']});
const results=[];
try {
 for(const mobile of [false,true]) {
  const page=await browser.newPage(),errors=[],failures=[];
  await page.setViewport({width:1280,height:900,isMobile:mobile,hasTouch:mobile});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('/models/')&&r.status()>=400)failures.push({url:r.url(),status:r.status()});});
  page.on('requestfailed',r=>{if(r.url().includes('/models/'))failures.push({url:r.url(),error:r.failure()?.errorText});});
  await page.goto(origin+'/arkpedia/?experimental=1&snapshot=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>globalThis.PIXI?.spine?.Spine);
  await page.evaluate(async()=>{
   const data=await(await fetch('/data/arkpedia-mvp.json')).json();
   const {modelEntry}=await import('/shared/arkpedia/model-entry.js');
   const host=document.createElement('div');host.style='position:fixed;inset:0;z-index:99999;background:#14212a';document.body.append(host);
   const app=new PIXI.Application({width:1280,height:900,backgroundColor:0x14212a,autoStart:false,antialias:true});host.append(app.view);
   window.artReview={data,app,modelEntry};
  });
  const models=[];
  for(let offset=0;offset<keys.length;offset+=16) {
   const batch=await page.evaluate(async keys=>{
    const {data,app,modelEntry}=artReview,results=[];
    for(const child of app.stage.removeChildren())child.destroy({children:true,texture:false,baseTexture:false});
    for(const [index,key] of keys.entries()) {
     const model=data.sd.models[key];if(!model)throw Error('Model missing from snapshot: '+key);
     const entry=modelEntry(data.sd,key);
     const loaded=await PIXI.Assets.load({src:entry.skel,data:{spineAtlasFile:entry.atlas,
      imageMetadata:{alphaMode:PIXI.ALPHA_MODES.PMA}}});
     const body=new PIXI.spine.Spine(loaded.spineData);body.autoUpdate=false;
     app.stage.addChild(body);
     let clips=0;
     for(const animation of loaded.spineData.animations) {
      body.skeleton.setToSetupPose();body.state.setAnimation(0,animation.name,false);body.update(animation.duration/2);
      const b=body.getLocalBounds();if(![b.x,b.y,b.width,b.height].every(Number.isFinite))throw Error('Non-finite clip: '+key+'/'+animation.name);
      clips++;
     }
     body.skeleton.setToSetupPose();body.state.setAnimation(0,model.animationRoles.idle,true);body.update(.1);
     const bounds=body.getLocalBounds();if(!(bounds.width>0&&bounds.height>0))throw Error('Empty idle pose: '+key);
     const scale=Math.min(220/bounds.width,155/bounds.height);body.scale.set(scale);
     body.position.set((index%4)*320+160-(bounds.x+bounds.width/2)*scale,Math.floor(index/4)*220+180-(bounds.y+bounds.height)*scale);
     const label=new PIXI.Text(model.id,{fontSize:13,fill:0xffffff});label.position.set((index%4)*320+12,Math.floor(index/4)*220+195);app.stage.addChild(label);
     results.push({id:model.id,version:model.spineVersion,clips,width:bounds.width,height:bounds.height});
    }
    app.render();return results;
   },keys.slice(offset,offset+16));
   models.push(...batch);await page.screenshot({path:resolve(out,`${mobile?'mobile':'desktop'}-${String(offset/16).padStart(2,'0')}.png`)});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  results.push({viewport:mobile?'mobile':'desktop',models,errors,failures});await page.close();
  console.log(`${mobile?'Mobile':'Desktop'}: ${models.length} bodies, ${models.reduce((n,m)=>n+m.clips,0)} clips`);
 }
 await writeFile(resolve(out,'review.json'),JSON.stringify({scope:'Chromium clip decoding/finite poses and idle body rendering; no native combat/frame/pixel parity claim',browser:await browser.version(),results},null,2)+'\n');
} finally {await browser.close();}
