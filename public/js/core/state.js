import { api } from './api.js';

export const state = { me: null, missing: [], lookups: { genres: [], difficulty_levels: [], services: [], games: [] } };
export async function loadMe() { state.me = (await api('/api/me')).user; }
export async function loadLookups() { state.lookups = await api('/api/lookups'); }
