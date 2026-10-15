// SPDX-License-Identifier: GPL-3.0-or-later
// Real Spine phase/rate regression review, isolated from playable battle approval.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start the port-3182 preview.');
const origin = 'http://127.0.0.1:3182', route = '/arkpedia/animation-rate-review.html';
const out = '.cache/arkpedia/animation-rate-review/';
const beforeCommit = '006e28c5a4adbc76499aef8fe0aa860c4e409d88';
const beforeSource = execFileSync('git', ['show', beforeCommit + ':public/arkpedia/battle-actor.js']);
const afterSource = await readFile('public/arkpedia/battle-actor.js');
const manifest = JSON.parse(await readFile('../arkpedia-sd-assets/manifest.json', 'utf8'));
const rows = [
  ['Closure', 'operator/char_4228_closur/default/front', 'Skill_3_Begin', 'Idle'],
  ['Basic Slug', 'enemy/enemy_10001_trslim/default/default', 'Skill_Begin', 'Move_A'],
].map(([name, key, cast, loop]) => {
  const entry = manifest.models[key];
  assert.equal(typeof entry?.premultipliedAlpha, 'boolean');
  assert.ok(entry.animations[cast] > 0 && entry.animations[loop] > 0);
  return { name, key, cast, loop, entry,
    files: Object.fromEntries([entry.skeleton, entry.atlas, ...entry.textures]
      .map(f => [f.path.split('/').at(-1), '../arkpedia-sd-assets/' + f.path])) };
});
await mkdir(out, { recursive: true });
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Original animation clock review</title><script src="/vendor/pixi.min.js"></script><script src="/vendor/pixi-spine.js"></script>
<style>body{margin:0;background:#10191d;color:#dae9ed;font:14px sans-serif}header{padding:12px;min-height:32px}canvas{display:block}</style>
<header>CONTROLLED ANIMATION REVIEW · original clips · rate changes must preserve phase · not a battle</header><div id="scene"></div>
<script type="module">
import { BattleActor } from '/arkpedia/battle-actor.js';
(async()=>{
 const P=PIXI,rows=${JSON.stringify(rows.map(({ files, ...r }) => ({ ...r, names: Object.keys(files) })))},host=document.querySelector('#scene');
 const app=new P.Application({width:innerWidth,height:innerHeight-document.querySelector('header').offsetHeight,backgroundColor:0x10191d,autoStart:false,antialias:true});host.append(app.view);
 const actors=[];
 for(const [i,r]of rows.entries()){
  const prefix='/rate-review-assets/'+i+'/',skel=r.names.find(k=>k.endsWith('.skel')),atlas=r.names.find(k=>k.endsWith('.atlas'));
  const loaded=await P.Assets.load({src:prefix+skel,data:{spineAtlasFile:prefix+atlas,imageMetadata:{alphaMode:r.entry.premultipliedAlpha?P.ALPHA_MODES.PMA:P.ALPHA_MODES.UNPACK}}});
  const actor=new BattleActor(loaded.spineData,{...r.entry,anims:r.entry.animationRoles});
  const label=new P.Text('',{fontFamily:'sans-serif',fontSize:14,fill:0xdbeaed});label.anchor.set(.5);app.stage.addChild(actor.spine,label);actors.push({...r,actor,label});
 }
 function metrics(){return actors.map(r=>{const a=r.actor,t=a.spine.state.getCurrent(0);return{name:r.name,clip:a.current,clock:a.clock,trackTime:t?.trackTime,rate:t?.timeScale,sameTrackObject:t===r.track,changeUntil:a.changeUntil}})}
 function draw(){const w=innerWidth/actors.length,h=app.screen.height;for(const[rindex,r]of actors.entries()){
  const s=r.actor.spine;s.scale.set(1);s.position.set(0);s.update(0);const b=s.getLocalBounds();if(!(b.width>0&&b.height>0))throw Error('Empty original pose');
  const scale=Math.min((w-44)/b.width,(h-56)/b.height),cx=(rindex+.5)*w;s.scale.set(scale);s.position.set(cx-(b.x+b.width/2)*scale,(h-42)/2-(b.y+b.height/2)*scale);
  const m=metrics()[rindex];r.label.text=r.name+' · '+m.clip+' · rate '+m.rate.toFixed(2)+' · phase '+m.trackTime.toFixed(3);r.label.position.set(cx,h-20);
 }app.renderer.render(app.stage)}
 function phase(name){for(const r of actors){const a=r.actor;
  if(name==='start'){a.setRegularVisual({clip:r.cast,loop:false,speed:1,playId:'cast:1'});r.track=a.spine.state.getCurrent(0);a.update(.1)}
  if(name==='slow'){a.setRegularVisual({clip:r.cast,loop:false,speed:.4,playId:'cast:1'});a.update(.1)}
  if(name==='faster'){a.setRegularVisual({clip:r.cast,loop:false,speed:.8,playId:'cast:1'});a.update(.1)}
  if(name==='finished')a.update(Math.max(0,a.changeUntil-a.clock)+.001);
  if(name==='loop'){a.setRegularVisual({clip:r.loop,loop:true,speed:1,playId:'loop:1'});r.track=a.spine.state.getCurrent(0);a.update(.1);a.setRegularVisual({clip:r.loop,loop:true,speed:.3,playId:'loop:1'});a.update(.1)}
 }draw();const expected={start:.1,slow:.14,faster:.22,loop:.13}[name];return metrics().map(s=>({...s,phasePreserved:expected==null?null:Math.abs(s.trackTime-expected)<1e-6}))}
 window.nativeRateReview={actors,app,phase,ready:true};
})().catch(e=>{window.reviewError=e.stack;console.error(e)});</script>`;
const browser = await puppeteer.launch({ executablePath, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [], failed = [], report = { artworkOnly: true, publicBattleTest: false, beforeCommit,
  rendererAfterSha256: createHash('sha256').update(afterSource).digest('hex'),
  sources: rows.map(({ key, entry }) => ({ key, skeleton: entry.skeleton, atlas: entry.atlas, textures: entry.textures })), captures: [] };
let revision = 'before';
try {
  const page = await browser.newPage(); await page.setCacheEnabled(false);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });
  await page.setRequestInterception(true);
  page.on('request', async req => {
    const url = new URL(req.url());
    if (url.pathname === route) return req.respond({ status: 200, contentType: 'text/html', body: html });
    if (url.pathname === '/arkpedia/battle-actor.js') return req.respond({ status: 200, contentType: 'application/javascript', body: revision === 'before' ? beforeSource : afterSource });
    if (url.pathname === '/favicon.ico') return req.respond({ status: 204 });
    const match = /^\/rate-review-assets\/(\d+)\/([^/]+)$/.exec(url.pathname), file = match && rows[Number(match[1])]?.files[match[2]];
    if (file) return req.respond({ status: 200, contentType: file.endsWith('.png') ? 'image/png' : file.endsWith('.atlas') ? 'text/plain' : 'application/octet-stream', body: await readFile(file) });
    return req.continue();
  });
  for (const [name, width, height, touch] of [['desktop', 1280, 720, false], ['landscape-phone', 844, 390, true]]) {
    await page.setViewport({ width, height, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    for (revision of ['before', 'after']) {
      await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.nativeRateReview?.ready || window.reviewError, { timeout: 60000 });
      assert.equal(await page.evaluate(() => window.reviewError), undefined);
      for (const phase of ['start', 'slow', 'faster', 'finished', 'loop']) {
        const states = await page.evaluate(p => nativeRateReview.phase(p), phase);
        assert.ok(states.every(s => Number.isFinite(s.clock + s.trackTime + s.rate)));
        if (['slow', 'faster', 'loop'].includes(phase)) {
          assert.ok(states.every(s => s.phasePreserved === (revision === 'after')), JSON.stringify({ revision, phase, states }));
          if (revision === 'after') assert.ok(states.every(s => s.sameTrackObject));
        }
        if (revision === 'after' && ['start', 'slow', 'faster', 'loop'].includes(phase)) {
          const expected = { start: .1, slow: .14, faster: .22, loop: .13 }[phase];
          assert.ok(states.every(s => Math.abs(s.trackTime - expected) < 1e-6));
        }
        if (phase === 'finished') assert.ok(states.every(s => s.clip === rows.find(r => r.name === s.name).entry.animationRoles.idle));
        const file = out + name + '-' + revision + '-' + phase + '.png'; await page.screenshot({ path: file });
        report.captures.push({ name, width, height, touch, revision, phase, file, states });
      }
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  await writeFile(out + 'report.json', JSON.stringify({ ...report, errors, failed }, null, 2) + '\n');
  console.log(JSON.stringify({ captures: report.captures.length, reproducedBefore: true, preservesPhaseAfter: true, errors, failed }));
} finally { await browser.close(); }
