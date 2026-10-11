// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated original-art review; never exposes Ling in the playable roster.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME to a Chromium executable.');
const origin = 'http://127.0.0.1:3182', path = '/arkpedia/ling-dragon-art-review.html';
const root = '.cache/arkpedia/ling-source/dragon-art/', out = root + 'browser/';
const receipt = JSON.parse(await readFile('data/arkpedia-ling-dragon-art.json', 'utf8'));
await mkdir(out, { recursive: true });
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ling original dragon artwork review</title>
<script src="/vendor/pixi.min.js"></script><script src="/vendor/pixi-spine.js"></script>
<style>body{margin:0;background:#10191d;color:#dae9ed;font:14px sans-serif}header{padding:12px}#scene{height:calc(100dvh - 52px)}canvas{display:block}</style>
<header>CONTROLLED ART REVIEW · original lower / ranged / lower S3 / higher S3 · not a battle</header><div id="scene"></div>
<script>
(async()=>{
 const P=PIXI, models=${JSON.stringify(receipt.models)}, host=document.querySelector('#scene');
 const app=new P.Application({width:innerWidth,height:host.clientHeight,backgroundColor:0x10191d,autoStart:false,antialias:true});host.append(app.view);
 const actors=[];
 for(const [i,n] of [1,2,3,3].entries()){
  const id='token_10020_ling_soul'+n;
  const a=await P.Assets.load({src:'/ling-review-assets/'+id+'/'+id+'.skel',data:{spineAtlasFile:'/ling-review-assets/'+id+'/'+id+'.atlas',imageMetadata:{alphaMode:P.ALPHA_MODES.PMA}}});
  const s=new P.spine.Spine(a.spineData);s.autoUpdate=false;app.stage.addChild(s);
  const label=new P.Text(n===3?(i===3?'S3 · Higher form':'S3 · Lower form'):'S'+n+' · Dragon',{fontFamily:'sans-serif',fontSize:16,fill:0xdbeaed});
  label.anchor.set(.5);app.stage.addChild(label);actors.push({s,label,id,higher:i===3});
 }
 function draw(phase='Idle',age=.35){
  app.renderer.resize(innerWidth,host.clientHeight);const w=innerWidth/4,h=host.clientHeight;
  return actors.map((a,i)=>{
   let clip=a.higher?phase+'_02':phase;
   if(phase==='Skill')clip=a.id.endsWith('2')?'Skill':a.higher?'Attack_02':'Attack';
   a.s.skeleton.setToSetupPose();a.s.state.clearTracks();a.s.state.setAnimation(0,clip,phase==='Idle');a.s.scale.set(1);a.s.position.set(0);a.s.update(age);
   const b=a.s.getLocalBounds();const scale=Math.min((w-24)/b.width,(h-60)/b.height);
   a.s.scale.set(scale);a.s.position.set((i+.5)*w-(b.x+b.width/2)*scale,(h-28)/2-(b.y+b.height/2)*scale);
   a.label.position.set((i+.5)*w,h-28);
   return {id:a.id,clip,age,width:b.width,height:b.height,scale};
  });
 }
 window.lingArtReview={actors,app,draw,ready:true};draw();app.renderer.render(app.stage);
})().catch(e=>{window.reviewError=e.stack;console.error(e)});
</script>`;
const browser = await puppeteer.launch({ executablePath, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const errors = [], failed = [], report = { artworkOnly: true, publicBattleTest: false, captures: [], clips: [] };
try {
 const page = await browser.newPage();
 page.on('pageerror', e => errors.push(e.message));
 page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
 page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });
 await page.setRequestInterception(true);
 page.on('request', async r => {
  const url = new URL(r.url());
  if (url.pathname === path) return r.respond({ status: 200, contentType: 'text/html', body: html });
  if (url.pathname === '/favicon.ico') return r.respond({ status: 204 });
  const m = url.pathname.match(/^\/ling-review-assets\/(token_10020_ling_soul[123])\/\1\.(skel|atlas|png)$/);
  if (m) return r.respond({ status: 200, contentType: {skel:'application/octet-stream',atlas:'text/plain',png:'image/png'}[m[2]],
    body: await readFile(root + m[1] + '/' + m[1] + '.' + m[2]) });
  return r.continue();
 });
 await page.setViewport({ width: 1280, height: 720 });
 await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
 await page.waitForFunction(() => window.lingArtReview?.ready || window.reviewError, { timeout: 60000 });
 assert.equal(await page.evaluate(() => window.reviewError), undefined);
 report.clips = await page.evaluate(() => lingArtReview.actors.slice(0,3).flatMap(a => a.s.spineData.animations
  .filter(c => c.name !== 'Default').map(c => {
   a.s.skeleton.setToSetupPose();a.s.state.clearTracks();a.s.state.setAnimation(0,c.name,false);a.s.update(Math.min(.5,c.duration/2));
   const b=a.s.getLocalBounds();return {id:a.id,clip:c.name,duration:c.duration,width:b.width,height:b.height};
  })));
 assert.equal(report.clips.length, 22);
 assert.ok(report.clips.every(c => c.width > 0 && c.height > 0 && Number.isFinite(c.width+c.height)));
 for (const [name,width,height] of [['desktop',1280,720],['landscape-phone',844,390]]) {
  await page.setViewport({width,height});
  for (const phase of ['Idle','Attack','Skill']) {
   const states=await page.evaluate(phase=>{const r=lingArtReview.draw(phase);lingArtReview.app.renderer.render(lingArtReview.app.stage);return r},phase);
   assert.ok(states.every(s=>s.scale>0 && Number.isFinite(s.scale)));
   const file=out+name+'-'+phase.toLowerCase()+'.png';await page.screenshot({path:file});
   report.captures.push({name,width,height,phase,file,states});
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(out+'report.json',JSON.stringify({...report,errors,failed},null,2)+'\n');
 console.log(JSON.stringify({clips:report.clips.length,captures:report.captures.length,errors,failed}));
} finally {await browser.close();}
