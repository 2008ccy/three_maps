import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { HOME_SESSION_KEY, restoreHomePhase, rememberHomeExpanded, isHomeRoute } from '../src/lib/home-scene.ts';
import { transitionTiming, titleFrame, mapAtPath, plainLinkActivation, mapTransitionTarget } from '../src/lib/map-transition.ts';

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
  assert.equal($('[data-map-transition="idle"][hidden]').length, 1, 'transition layer is inactive in static/no-script output');
});

test('map transitions preserve native modified, new-tab, middle-button and download link actions', () => {
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
  assert.equal(plainLinkActivation(click), true, 'ordinary click / synthesized keyboard click');
  for (const change of [{ button: 1 }, { button: 2 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { defaultPrevented: true }]) assert.equal(plainLinkActivation({ ...click, ...change }), false);
  assert.equal(plainLinkActivation(click, '_blank'), false);
  assert.equal(plainLinkActivation(click, '_self'), true);
  assert.equal(plainLinkActivation(click, '', true), false);
});

test('curtain only accepts the selected same-origin map and preserves GitHub Pages base paths', () => {
  const origin = 'https://2008ccy.github.io';
  for (const map of ['domain', 'ecosystem', 'cognition']) {
    assert.deepEqual(mapTransitionTarget(map, `${origin}/three_maps/docs/${map}/`, origin, '/three_maps'), { href: `${origin}/three_maps/docs/${map}/`, route: `/docs/${map}/` });
    assert.ok(mapTransitionTarget(map, `${origin}/docs/${map}`, origin));
  }
  for (const href of ['https://example.com/three_maps/docs/domain/', '/docs/domain/', '/three_maps/docs/ecosystem/', '/three_maps/docs/domain/entries/k-rag/']) assert.equal(mapTransitionTarget('domain', href, origin, '/three_maps'), null);
  assert.equal(mapTransitionTarget('unknown', '/docs/unknown', origin), null);
});

test('map destinations declare readiness without adding a visible overlay to the static/no-script page', () => {
  for (const map of ['domain', 'ecosystem', 'cognition']) {
    const $ = load(readFileSync(`out/docs/${map}/index.html`, 'utf8'));
    assert.equal($(`[data-map-arrival="${map}"][hidden]`).length, 1);
    assert.equal($('[data-map-transition="idle"][hidden]').length, 1);
    assert.equal($('[data-transition-title]').length, 0);
  }
});

test('return-home targets preserve base paths and only exact map overview routes initiate the return curtain', () => {
  const origin = 'https://2008ccy.github.io';
  assert.deepEqual(mapTransitionTarget('home', '/', origin), { href: `${origin}/`, route: '/' });
  for (const home of ['/three_maps', '/three_maps/']) assert.deepEqual(mapTransitionTarget('home', home, origin, '/three_maps'), { href: `${origin}${home}`, route: '/' });
  for (const wrong of ['/', '/three_maps-copy/', '/three_maps/docs/domain/', 'https://example.com/three_maps/']) assert.equal(mapTransitionTarget('home', wrong, origin, '/three_maps'), null);
  for (const map of ['domain', 'ecosystem', 'cognition']) {
    assert.equal(mapAtPath(`/three_maps/docs/${map}/`, '/three_maps'), map);
    assert.equal(mapAtPath(`/docs/${map}`), map);
  }
  for (const wrong of ['/', '/three_maps/', '/three_maps-copy/docs/domain/', '/three_maps/docs/domain/entries/k-rag/']) assert.equal(mapAtPath(wrong, '/three_maps'), null);
});

test('title continuity lands exactly on the destination and gives returning home a lighter motion budget', () => {
  const source = { x: 178, y: 500, fontSize: 22, lineHeight: 29, letterSpacing: 0, weight: 600 };
  const target = { x: 40, y: 139, fontSize: 34, lineHeight: 44.2, letterSpacing: -1.19, weight: 650 };
  assert.deepEqual(titleFrame(source, target, 0), source);
  assert.deepEqual(titleFrame(source, target, 1), target);
  assert.deepEqual(titleFrame(source, target, -1), source);
  assert.deepEqual(titleFrame(source, target, 2), target);
  for (let p = 0; p <= 1; p += .05) {
    const frame = titleFrame(source, target, p);
    for (const key of Object.keys(source)) assert.ok(frame[key] >= Math.min(source[key], target[key]) - 1e-10 && frame[key] <= Math.max(source[key], target[key]) + 1e-10);
  }
  const enter = transitionTiming('domain'), back = transitionTiming('home');
  assert.ok(back.departure + back.arrival < (enter.departure + enter.arrival) * .6);
  assert.ok(back.particles < enter.particles && back.particleAlpha < enter.particleAlpha);
});
