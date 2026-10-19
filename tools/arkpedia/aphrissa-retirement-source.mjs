// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {deriveAphrissaRetirement} from '../../shared/arkpedia/aphrissa-retirement-source.js';
export async function recoverAphrissaRetirement(){
 const meta=JSON.parse(await readFile(new URL('../../data/arkpedia-aphrissa-effects.json',import.meta.url))),
  bytes=await readFile(new URL('../../.cache/arkpedia/aphrissa-source/effects/native-effects.bin',import.meta.url));
 assert.equal(bytes.length,meta.pack.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.pack.sha256);
 const animationMeta=JSON.parse(await readFile(new URL('../../data/arkpedia-aphrissa-effect-animations.json',import.meta.url))),
  animationBytes=await readFile(new URL('../../.cache/arkpedia/aphrissa-source/effects/native-animations.json',import.meta.url));
 assert.equal(animationBytes.length,animationMeta.artifact.bytes);assert.equal(createHash('sha256').update(animationBytes).digest('hex'),animationMeta.artifact.sha256);
 const animations=JSON.parse(animationBytes);
 return deriveAphrissaRetirement(JSON.parse(gunzipSync(bytes)),animations);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const value=JSON.stringify(await recoverAphrissaRetirement(),null,2)+'\n',path=new URL('../../data/arkpedia-aphrissa-retirement.json',import.meta.url);
 if(process.argv.includes('--write'))await writeFile(path,value);else assert.equal(await readFile(path,'utf8'),value);
 console.log('Original Aphrissa particle lifetimes, speed-scaled drain bounds and geometry gates verified.');
}
