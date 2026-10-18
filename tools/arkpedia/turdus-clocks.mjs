// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {recoverOriginalClocks} from './original-clocks.mjs';
const id='char_4224_turdus',output=new URL('../../data/arkpedia-turdus-clocks.json',import.meta.url);
export const recoverClocks=({read=readFile}={})=>recoverOriginalClocks({id,read,
 receipt:new URL(`../../data/arkpedia-native-operators/${id}.json`,import.meta.url),cache:new URL(`../../.cache/arkpedia/cn-operators/${id}/`,import.meta.url),
 sha256:'e2d258828ebfc9d6c7752cea5c26ad3857ac74fd056ec45d810fbc8810cea6d6'});
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const bytes=JSON.stringify(await recoverClocks(),null,2)+'\n';
 if(process.argv.includes('--write'))await writeFile(output,bytes);else assert.equal(await readFile(output,'utf8'),bytes);console.log('Ukusik original exact clocks verified; no public admission.');}
