// SPDX-License-Identifier: GPL-3.0-or-later
// Normal snapshot by default; ARKPEDIA_REVIEW_APHRISSA=1 reads the pending candidate.
import {readFile} from 'node:fs/promises';
import normal from '../../data/arkpedia-mvp.json' with {type:'json'};
export const APHRISSA_CANDIDATE = process.env.ARKPEDIA_REVIEW_APHRISSA === '1';
export const aphrissaData = APHRISSA_CANDIDATE
  ? JSON.parse(await readFile(new URL('../../.cache/arkpedia/arkpedia-aphrissa-candidate.json', import.meta.url))) : normal;
