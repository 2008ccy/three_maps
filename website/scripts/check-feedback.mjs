import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { maps } from '../src/lib/maps/content.ts';
import { buildCatalog } from '../src/lib/maps/catalog.ts';

const expected = { maps: maps.map((map) => ({ id: map.id, title: map.title, nodes: buildCatalog(map).map((node) => ({ id: node.id, title: node.title })) })) };
const actual = JSON.parse(readFileSync('../feedback-cloud/data/targets.json', 'utf8'));
assert.deepEqual(actual, expected, 'Feedback cloud whitelist must match current active maps; update feedback-cloud/data/targets.json after map changes.');
const migration = readFileSync('../feedback-cloud/sql/003-workbuddy-targets.sql', 'utf8');
const sqlTargets = [...migration.matchAll(/^\s*\('(domain|ecosystem|cognition)', '([a-z0-9-]*)', true\)/gm)].map((match) => `${match[1]}:${match[2]}`).sort();
const expectedTargets = expected.maps.flatMap((map) => [`${map.id}:`, ...map.nodes.map((node) => `${map.id}:${node.id}`)]).sort();
assert.deepEqual(sqlTargets, expectedTargets, 'Hosted SQL target migration must match current active maps; update sql/003-workbuddy-targets.sql after map changes.');
console.log(`Feedback target catalog OK: ${maps.length} maps, ${expected.maps.flatMap((map) => map.nodes).length} active nodes.`);
