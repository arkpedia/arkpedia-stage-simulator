// SPDX-License-Identifier: GPL-3.0-or-later
// Record the actual private regular-stage controller in a deterministic fixture.
import {mkdir,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {createLapplandMotionFixture} from './lappland-motion-fixture.mjs';
import {recordLapplandS3Motion} from '../../server/sim/content/arkpedia-lappland-motion.js';
import {readLapplandMotionInput} from '../../shared/arkpedia/lappland-effect-motion.js';
const f=createLapplandMotionFixture(),recorder=recordLapplandS3Motion(f.b),target=f.enemy();
f.activate();
for(let i=0;i<600&&!f.controller.s3.drones.every(d=>d.phase==='attach');i++)f.advance(f.b.dt);
if(!f.controller.s3.drones.every(d=>d.phase==='attach'))throw Error('Fixture drones did not attach');
const attachAt=f.b.time;target.hidden=true;f.enemy(14);f.advance(3);f.u.skill.end('fixture');recorder.dispose();
const replay=recorder.snapshot();readLapplandMotionInput(replay,replay.sourcePackSha256);
const file=path.resolve('.cache/arkpedia/lappland-alter-source/battle-motion-replay.json');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(replay,null,2)+'\n');
const hash=b=>createHash('sha256').update(b).digest('hex');
const inputs=await Promise.all(['data/arkpedia-lappland-alter-prefabs.json','data/arkpedia-mvp.json','server/sim/content/arkpedia-lappland-alter.js',
 'server/sim/content/arkpedia-lappland-s3.js','server/sim/content/arkpedia-lappland-motion.js','tools/arkpedia/lappland-motion-fixture.mjs',
 'tools/arkpedia/record-lappland-motion.mjs'].map(async file=>({path:file,sha256:hash(await readFile(file))})));
await writeFile(path.join(path.dirname(file),'battle-motion-receipt.json'),JSON.stringify({inputs,outputSha256:hash(await readFile(file)),
 fixture:{board:[19,21],elite:2,level:90,potential:1,trust:0,skillId:'skchr_whitw2_3',skillRank:10,rng:.99},
 coordinateMapping:'board(x,y) to effect(x,0,y); native mount-point height and rotation are not replayed',compiledFrameParity:false},null,2)+'\n');
console.log(JSON.stringify({file,tracks:replay.tracks.length,samples:replay.tracks.reduce((n,t)=>n+t.samples.length,0),attachAt,simulationTime:f.b.time,compiledFrameParity:false}));
