import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { HOME_SESSION_KEY, restoreHomePhase, rememberHomeExpanded, isHomeRoute } from '../src/lib/home-scene.ts';

const { basePath } = JSON.parse(readFileSync('out/.site-build.json', 'utf8'));

test('home activation persists within its session without accepting unrelated stored values', () => {
  const values = new Map([['other-key', '1']]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(restoreHomePhase(storage), 'intro');
  values.set(HOME_SESSION_KEY, 'false');
  assert.equal(restoreHomePhase(storage), 'intro');
  rememberHomeExpanded(storage);
  assert.equal(restoreHomePhase(storage), 'expanded');
  assert.equal(restoreHomePhase({ getItem: () => null }), 'intro', 'new session is independent');
});

test('blocked storage neither prevents a first visit nor throws during activation', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(restoreHomePhase(blocked), 'intro');
  assert.doesNotThrow(() => rememberHomeExpanded(blocked));
});

test('home scene route checks do not suppress navigation or search on documents', () => {
  for (const route of ['/', '/three_maps', '/three_maps/']) assert.equal(isHomeRoute(route, '/three_maps'), true);
  for (const route of ['/docs/domain/', '/three_maps/docs/cognition/', '/three_maps-copy/', '/other/']) assert.equal(isHomeRoute(route, '/three_maps'), false);
});

test('exported first visit has an activation target and usable no-script map links', () => {
  const html = readFileSync('out/index.html', 'utf8');
  const $ = load(html, { scriptingEnabled: false });
  assert.equal($('[data-home-phase="intro"]').length, 1);
  assert.equal($('button[aria-label="展开三张地图"]').length, 1);
  assert.equal($('#nd-nav').length, 0);
  assert.equal($('footer[hidden]').length, 1);
  assert.equal($('#explore, a[href="#explore"]').length, 0);
  for (const map of ['domain', 'ecosystem', 'cognition']) {
    assert.equal($(`noscript a[href="${basePath}/docs/${map}/"]`).length, 1, map);
    assert.equal($(`[data-home-map="${map}"]`).closest('[inert][aria-hidden="true"]').length, 1, map);
  }
  assert.equal($('canvas[aria-hidden="true"]').length, 1);
});
