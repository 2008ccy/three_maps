import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { HOME_SESSION_KEY, restoreHomePhase, rememberHomeExpanded, isHomeRoute } from '../src/lib/home-scene.ts';
import { transitionTiming, handoffProgress, titleFrame, homeMapLink, mapAtPath, isTransitionPage, plainLinkActivation, mapTransitionTarget } from '../src/lib/map-transition.ts';
import { explorationPaths } from '../src/app/(home)/home-content.ts';
import { maps, flattenNodes } from '../src/lib/maps/content.ts';
import { isLegacyMapArticle } from '../src/lib/document-navigation.ts';
import { filesIn } from './content-utils.mjs';

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

test('exported first visit immediately exposes navigation and usable map links without JavaScript', () => {
  const html = readFileSync('out/index.html', 'utf8');
  const $ = load(html, { scriptingEnabled: false });
  const unavailable = '[hidden], [inert], [aria-hidden="true"]';
  assert.equal($('[data-home-phase="expanded"]').length, 1);
  assert.equal($('h1#home-title').length, 1);
  assert.equal($('h1').length, 1);
  assert.equal($('#nd-nav').length, 1);
  assert.equal($('#nd-nav').closest(unavailable).length, 0);
  assert.equal($('footer').length, 1);
  assert.equal($('footer').closest(unavailable).length, 0);
  assert.equal($('#explore, a[href="#explore"]').length, 0);
  for (const map of ['domain', 'ecosystem', 'cognition']) {
    const link = $(`a[data-home-map="${map}"]`);
    assert.equal(link.length, 1, map);
    assert.equal(link.attr('href'), `${basePath}/docs/${map}/`, map);
    assert.equal(link.find('h2').text().trim(), maps.find((item) => item.id === map).title, map);
    assert.equal(link.closest(unavailable).length, 0, `${map} remains available without activation`);
  }
  const hero = $('[data-home-hero]');
  assert.equal(hero.length, 1);
  assert.equal(hero.find('a, button').length, 0, 'hero has no duplicate exploration or search actions');
  const search = $('#nd-nav button[aria-label="搜索地图"]');
  assert.equal(search.length, 1, 'search remains available in the shared header');
  assert.equal(search.closest(unavailable).length, 0);
  assert.equal($('canvas[aria-hidden="true"]').length, 1);
  assert.equal($('[data-map-transition="idle"][hidden]').length, 1, 'transition layer is inactive in static/no-script output');
  assert.equal($(`footer nav a[href="${basePath}/docs/project/updates/"]`).length, 1);
  assert.equal($(`footer nav a[href="${basePath}/feedback/"]`).length, 1);
  assert.equal($(`footer a[href^="${basePath}/docs/sources"], footer a[href^="${basePath}/docs/project/status"]`).length, 0);
});

test('stored home exploration routes only target current map nodes', () => {
  for (const path of explorationPaths) for (const step of path.steps) {
    const [, mapId, nodeId] = step.href.match(/^\/docs\/(domain|ecosystem|cognition)\/#node-([a-z0-9-]+)$/) ?? [];
    assert.ok(mapId && nodeId, step.href);
    assert.ok(flattenNodes(maps.find((map) => map.id === mapId).branches).some((node) => node.id === nodeId), step.href);
  }
});

test('home artwork crops embedded mockup text independently of SVG masks', () => {
  const $ = load(readFileSync('out/index.html', 'utf8'));
  const hero = $('[data-home-hero]');
  const images = hero.find('svg image');
  assert.ok(images.length > 0);
  for (const image of images.toArray()) {
    const viewport = $(image).parent('svg');
    assert.equal(viewport.attr('overflow'), 'hidden');
    const bounds = ['x', 'y', 'width', 'height'].map((key) => Number(viewport.attr(key)));
    assert.ok(bounds.every(Number.isFinite));
    const [x, y, width, height] = bounds;
    assert.equal(viewport.attr('viewBox'), bounds.join(' '));
    assert.ok(width > 0 && height > 0 && x + width <= 1487 && y >= 90 && y + height <= 750);
    assert.ok(x >= 700 || x >= 430 && y >= 500 || x >= 280 && y >= 600,
      'Every image viewport must exclude the title, description and buttons baked into the source.');
    assert.equal($(image).attr('href'), `${basePath}/images/home/particle-surfaces.png`);
  }
});

test('every exported page omits navigation to the original map articles', () => {
  const origin = 'https://three-maps.test';
  for (const file of filesIn('out').filter((file) => file.endsWith('.html'))) {
    const $ = load(readFileSync(file, 'utf8'), { scriptingEnabled: false });
    const route = `${basePath}/${file.slice(4).replace(/index\.html$/, '')}`;
    for (const item of $('a[href], area[href], form[action]').toArray()) {
      const href = $(item).attr('href') ?? $(item).attr('action');
      if (!href || href.startsWith('#')) continue;
      const url = new URL(href, origin + route);
      if (url.origin !== origin) continue;
      const pathname = basePath && url.pathname.startsWith(basePath + '/') ? url.pathname.slice(basePath.length) : url.pathname;
      assert.ok(!isLegacyMapArticle(pathname), `${file}: ${href}`);
    }
  }
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

test('route commits keep transitions alive for Next pathnames with the deployment prefix stripped', () => {
  const prefix = '/three_maps';
  for (const page of ['/', '/docs/domain', '/docs/domain/', '/docs/ecosystem/', '/docs/cognition/']) {
    assert.equal(isTransitionPage(page, prefix), true, `Next pathname: ${page}`);
    const browserPath = page === '/' ? prefix + '/' : prefix + page;
    assert.equal(isTransitionPage(browserPath, prefix), true, `browser pathname: ${browserPath}`);
    assert.equal(isTransitionPage(page), true, `root deployment: ${page}`);
  }
  assert.equal(isTransitionPage(prefix, prefix), true);
  for (const page of ['/docs/domain/entries/k-lora/', '/docs/sources/', '/docs/project/updates/', '/docs/unknown/', '/three_maps-copy/docs/domain/', '/other/', '/three_maps/other/']) {
    assert.equal(isTransitionPage(page, prefix), false, `unrelated page cancels: ${page}`);
  }
  assert.equal(mapAtPath('/docs/domain/', prefix), null, 'browser URL validators must still reject missing deployment prefixes');
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

test('shared title stays present while complementary content blending prevents a blank route seam', () => {
  assert.deepEqual(handoffProgress(-20), { title: 0, source: 1, content: 0 });
  assert.deepEqual(handoffProgress(480), { title: 1, source: 0, content: 1 });
  let previous = handoffProgress(0);
  for (let ms = 10; ms <= 600; ms += 10) {
    const frame = handoffProgress(ms);
    assert.equal(frame.source + frame.content, 1);
    assert.ok(frame.title >= previous.title && frame.content >= previous.content);
    if (frame.content >= .5) assert.ok(frame.title > .9, 'title has nearly landed before target text gains emphasis');
    previous = frame;
  }
});

test('homepage header and card links resolve to the same map without intercepting other destinations', () => {
  const origin = 'https://2008ccy.github.io';
  for (const map of ['domain', 'ecosystem', 'cognition']) {
    assert.equal(homeMapLink(`/three_maps/docs/${map}/`, origin, '/three_maps'), map);
    assert.equal(homeMapLink(`${origin}/three_maps/docs/${map}/?view=graph#node-task`, origin, '/three_maps'), map);
    assert.equal(homeMapLink(`/docs/${map}/`, origin), map);
  }
  for (const wrong of ['https://example.com/three_maps/docs/domain/', '/three_maps/docs/domain/entries/k-lora/', '/three_maps/docs/project/updates/', '/docs/domain/', '/', 'javascript:alert(1)']) {
    assert.equal(homeMapLink(wrong, origin, '/three_maps'), null);
  }
});
