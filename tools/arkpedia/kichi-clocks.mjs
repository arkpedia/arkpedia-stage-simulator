// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {recoverOriginalClocks} from './original-clocks.mjs';
const id='char_4203_kichi',output=new URL('../../data/arkpedia-kichi-clocks.json',import.meta.url);
export const recoverClocks=({read=readFile}={})=>recoverOriginalClocks({id,read,
 receipt:new URL(`../../data/arkpedia-native-operators/${id}.json`,import.meta.url),cache:new URL(`../../.cache/arkpedia/cn-operators/${id}/`,import.meta.url),
 sha256:'171761adf7b8bc65b03ea6f0d95f2a8bf9c3d0c16bcf836d99e2a1088448b025'});
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const bytes=JSON.stringify(await recoverClocks(),null,2)+'\n';
 if(process.argv.includes('--write'))await writeFile(output,bytes);else assert.equal(await readFile(output,'utf8'),bytes);
 console.log('Kichisei original exact animation clocks verified; source receipt and default parser unchanged.');
}
