// SPDX-License-Identifier: GPL-3.0-or-later
// Source selection only. No combat installer or public registration is implied.
import e from '../../../data/arkpedia-native-operators/char_4228_closur.json' with { type: 'json' };
import { selectedCNSourceBuild } from './arkpedia-selected-cn-source.js';
export const CLOSUR_ID = 'char_4228_closur';
export const CLOSUR_TOKEN_ID = 'token_10066_closur_ourbase';
export const CLOSUR_SKILLS = Object.freeze(['skchr_closur_1', 'skchr_closur_2', 'skchr_closur_3']);
export const selectedClosurBuild = build => selectedCNSourceBuild(e, CLOSUR_ID, build);
