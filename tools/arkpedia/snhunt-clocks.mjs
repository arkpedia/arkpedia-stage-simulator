// SPDX-License-Identifier: GPL-3.0-or-later
// Additive clocks: never rewrite the immutable original receipt or default parser output.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { recoverOriginalClocks } from './original-clocks.mjs';
const id='char_4211_snhunt';
const receipt=new URL(`../../data/arkpedia-native-operators/${id}.json`,import.meta.url);
const cache=new URL(`../../.cache/arkpedia/cn-operators/${id}/`,import.meta.url);
const output=new URL('../../data/arkpedia-snhunt-clocks.json',import.meta.url);
export async function recoverClocks({read=readFile}={}){
 return recoverOriginalClocks({id,receipt,cache,read,sha256:'37d0ab829cd389fe71eb180e858aa6d82bb43bea0f34bec1a70658ba361d95dd'});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const actual=JSON.stringify(await recoverClocks(),null,2)+'\n';
 if(process.argv.includes('--write'))await writeFile(output,actual);else assert.equal(await readFile(output,'utf8'),actual);
 console.log('Snow Hunter exact original animation clocks verified; default parser and source receipt unchanged.');
}
