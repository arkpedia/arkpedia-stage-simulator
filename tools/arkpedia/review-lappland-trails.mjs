// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createEffectTrail} from '../../shared/arkpedia/native-effect-trail.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),dir=path.join(root,'.cache/arkpedia/lappland-alter-source/effects');
const meta=JSON.parse(await readFile(path.join(root,'data/arkpedia-lappland-effects.json'))),raw=await readFile(path.join(dir,'native-effects.bin'));
const digest=createHash('sha256').update(raw).digest('hex');
if(digest!==meta.pack.sha256||raw.length!==meta.pack.bytes)throw Error('Changed original trail input pack');
const pack=JSON.parse(gunzipSync(raw));
// Numerical fixture, explicitly not a recovered wolf flight path. Alternating
// distances, a turn, a stop, pause/resume and complete expiry exercise controls.
const history=Array.from({length:121},(_,i)=>({time:i/60,
 position:i<45?[i/60,0,0]:i<90?[.75,(i-45)/60,0]:[.75,.75,0],emitting:i<65||i>75}));
const camera=[.2,.4,5],trails=[];
for(const [record,r]of Object.entries(pack.records))if(r.type==='TrailRenderer'){
 const trail=createEffectTrail(r.data),samples=[0,.1,.5,1,1.25,2,3].map(time=>({time,data:trail.sample(time,history,camera)}));trails.push({record,samples});
}
const report={schemaVersion:1,sourcePackSha256:digest,scope:{fixtureMotionOnly:true,rendererVerified:false,compiledFrameParity:false,enabledOperators:[]},history,camera,trails};
await writeFile(path.join(dir,'native-trail-samples.json'),JSON.stringify(report)+'\n');
console.log(JSON.stringify({trails:trails.length,snapshots:trails.reduce((n,t)=>n+t.samples.length,0)}));
