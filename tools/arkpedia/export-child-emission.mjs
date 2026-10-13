// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {createChildEmissionSchedule} from '../../shared/arkpedia/native-child-emission.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const links=JSON.parse(await readFile(root+'data/arkpedia-particle-birth-links.json'));
const fixtureBytes=await readFile(root+links.fixture.path);if(sha(fixtureBytes)!==links.fixture.sha256)throw Error('Changed original birth-link fixture');
const sources={},samples={};
for(const name of ['tragodia','lappland-alter']){
 const bytes=await readFile(root+`.cache/arkpedia/${name}-source/effects/native-effects.bin`);
 if(sha(bytes)!==links.sources[name].sourcePackSha256)throw Error('Changed original child emission pack');
 const pack=JSON.parse(gunzipSync(bytes)),schedule=createChildEmissionSchedule(pack);
 sources[name]=links.sources[name];
 const children=Object.keys(links.children).filter(id=>links.children[id].source===name);
 for(const child of children)samples[child]=[0,.03,.1,.5,1,2,4].map(time=>({time,births:schedule.births(child,time),alive:schedule.sample(child,time)}));
}
const output='.cache/arkpedia/tragodia-source/child-emission-samples.json',bytes=Buffer.from(JSON.stringify(samples)+'\n');await writeFile(root+output,bytes);
const manifest={schemaVersion:1,sources,fixture:links.fixture,
 scope:{sourceMapping:true,childEmissionScheduling:true,parentLifetimeWindows:true,sharedChildCapacity:true,childEmissionPlaying:false,childMotionPlaying:false,compiledFrameParity:false,enabledOperators:[]},
 samples:{path:output,bytes:bytes.length,sha256:sha(bytes)},children:links.children,
 counts:{children:Object.keys(samples).length,births:Object.values(samples).flat().reduce((n,s)=>n+s.births.length,0),alive:Object.values(samples).flat().reduce((n,s)=>n+s.alive.length,0)}};
await writeFile(root+'data/arkpedia-child-emission.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({...manifest.counts,bytes:bytes.length}));
