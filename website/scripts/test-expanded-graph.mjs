import test from 'node:test';
import assert from 'node:assert/strict';
import { maps } from '../src/lib/maps/content.ts';
import { buildAtlas, buildExpandedGraph, resolveRef } from '../src/lib/maps/expanded-graph.ts';
import { expandedLayout } from '../src/lib/maps/expanded-layout.ts';
import { explorerUrl, readExplorerState, initialExplorerState } from '../src/lib/maps/explorer-state.ts';
import { cameraTransitionDuration, interpolateCamera, stepGraphMotion, stillMotion, movingPath, dragThreshold, elasticPan, panInput, panRadius, stepPanGravity } from '../src/lib/maps/graph-motion.ts';
const atlas = buildAtlas(maps);
for (const map of maps) {
  const nodes = atlas.catalogs.get(map.id);
  test(`${map.id}: independent branches retain map and theme anchors`, () => {
    const root = buildExpandedGraph(atlas,map,nodes,[],'core',null);
    assert.equal(root.nodes.length,map.branches.length+1);
    const [first,second] = map.branches;
    const two = buildExpandedGraph(atlas,map,nodes,[first.id,second.id],'core',null);
    assert.equal(two.hub,root.hub);
    assert.equal(two.nodes.filter(n=>n.kind==='point').length,first.children.length+second.children.length);
    const collapsed = buildExpandedGraph(atlas,map,nodes,[second.id],'core',null);
    assert.ok(!collapsed.nodes.some(n=>n.kind==='point'&&n.group===first.id));
    const layout = expandedLayout(two);
    for(const box of expandedLayout(root).boxes) assert.deepEqual(layout.byId.get(box.id),box);
  });
  test(`${map.id}: all incoming/outgoing relations survive with unique cross-map targets`, () => {
    const expanded = map.branches.map(b=>b.id);
    const graph = buildExpandedGraph(atlas,map,nodes,expanded,'all',null);
    const expected = atlas.edges.filter(e=>e.kind!=='hierarchy'&&(e.sourceMap===map.id||e.targetMap===map.id));
    assert.deepEqual(graph.relations.map(e=>e.id).sort(),expected.map(e=>e.id).sort());
    assert.equal(new Set(graph.nodes.map(n=>n.key)).size,graph.nodes.length);
    for(const line of graph.lines) {
      assert.ok(graph.nodes.some(n=>n.key===line.from)); assert.ok(graph.nodes.some(n=>n.key===line.to));
      if(line.kind==='cross') for(const edge of line.edges) assert.ok(edge.from===line.from&&edge.to===line.to||edge.from===line.to&&edge.to===line.from);
    }
    const core = buildExpandedGraph(atlas,map,nodes,expanded,'core',null);
    assert.deepEqual(core.relations.filter(e=>e.sourceMap!==e.targetMap).map(e=>e.id).sort(),expected.filter(e=>e.sourceMap!==e.targetMap).map(e=>e.id).sort());
  });
  test(`${map.id}: expanded labels avoid collisions and all routes remain finite`, () => {
    for(const compact of [false,true]) for(const expanded of [[],[map.branches[0].id],map.branches.map(b=>b.id)]) {
      const layout=expandedLayout(buildExpandedGraph(atlas,map,nodes,expanded,'all',null),compact);
      for(const [i,a] of layout.boxes.entries()) {
        assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));
        for(const b of layout.boxes.slice(i+1)) assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=(a.height+b.height)/2,a.id+' '+b.id);
      }
      for(const route of layout.routes) assert.doesNotMatch(route.d,/NaN|Infinity/);
    }
  });
  test(`${map.id}: filtered-out reading retains its branch and only directly related foreign nodes`, () => {
    const point=nodes.find(n=>n.parent);
    const graph=buildExpandedGraph(atlas,map,[],[point.groupId],'all',{mapId:map.id,nodeId:point.id});
    assert.ok(graph.nodes.some(n=>n.key===`${map.id}:${point.id}`));
    for(const node of graph.nodes.filter(n=>n.kind==='external')) assert.ok(graph.lines.some(l=>l.kind==='cross'&&(l.from===node.key||l.to===node.key)));
  });
}
test('URL restores branches, cross-map reading, filters and relation scope', () => {
  const state={...initialExplorerState,expanded:['task','model'],selected:{mapId:'cognition',nodeId:'ranking-task'},scope:'all',filters:{...initialExplorerState.filters,q:'接口'}};
  const url=new URL('https://local/docs/domain/'+explorerUrl(state,maps[0]));
  assert.deepEqual(readExplorerState(url.search,url.hash,maps[0],atlas),state);
  assert.equal(readExplorerState('?peek=missing:node&branches=unknown','#node-unknown',maps[0],atlas).selected,null);
});
test('old card/stage/hash URLs and aliases restore graph and reader context', () => {
  const state=readExplorerState('?view=cards&stage=model','#node-rag',maps[0],atlas);
  assert.ok(state.expanded.includes('model')&&state.expanded.includes('system'));
  assert.deepEqual(state.selected,{mapId:'domain',nodeId:'rag'});
  for(const map of maps) for(const [old,id] of Object.entries(map.nodeAliases??{})) assert.equal(readExplorerState('',`#node-${old}`,map,atlas).selected.nodeId,id);
});
test('learning overrides stay independent of verification and other maps', () => {
  const edited=buildAtlas(maps,{}, {'domain:task':'已初步理解'});
  assert.equal(resolveRef(edited,{mapId:'domain',nodeId:'task'}).understanding,'已初步理解');
  assert.equal(resolveRef(edited,{mapId:'domain',nodeId:'task'}).verification,'待核实');
  assert.equal(resolveRef(edited,{mapId:'cognition',nodeId:'ranking-task'}).understanding,'待自评');
});
test('drag propagates to neighbors and release settles within two seconds', () => {
  const states=new Map([['a',{x:100,y:40,vx:0,vy:0}],['b',stillMotion()],['c',stillMotion()]]);
  const neighbors=new Map([['a',['b']],['b',['a','c']],['c',['b']]]);
  for(let i=0;i<15;i++) stepGraphMotion(states,neighbors,1/60,'a');
  assert.ok(states.get('b').x>0&&states.get('c').x>0);
  for(let i=0;i<120;i++) stepGraphMotion(states,neighbors,1/60);
  assert.equal(stepGraphMotion(states,neighbors,1/60),false);
  for(const state of states.values()) assert.deepEqual(state,stillMotion());
  assert.equal(dragThreshold,6);
});
test('moving paths follow both endpoints and long frame gaps are bounded', () => {
  assert.equal(movingPath('M 10 20 Q 30 40 50 60',{x:10,y:20,vx:0,vy:0},{x:20,y:40,vx:0,vy:0}),'M 20 40 Q 45 70 70 100');
  const states=new Map([['a',{x:260,y:-260,vx:200,vy:-200}]]);
  stepGraphMotion(states,new Map(),100);
  assert.ok(Number.isFinite(states.get('a').x)&&Math.abs(states.get('a').x)<300);
});

test('whole-map dragging stays free near the center and resists only near its boundary', () => {
  for (const size of [{width:356,height:560},{width:820,height:720},{width:1360,height:790}]) {
    const radius=panRadius(size), near={x:radius*.3,y:radius*.2};
    assert.deepEqual(elasticPan(near,size),near);
    let previous = 0, previousGain = Infinity;
    for (const distance of [radius*.3,radius*.6,radius*.9,radius*1.2,radius*1.5]) {
      const offset = elasticPan({x:distance,y:0},size);
      const gain = offset.x-previous;
      assert.ok(gain > 0 && gain < previousGain);
      previous = offset.x; previousGain = gain;
    }
    for (const input of [{x:1e7,y:1e7},{x:-1e7,y:100},{x:100,y:-1e7}]) {
      const offset=elasticPan(input,size);
      assert.ok(Math.hypot(offset.x,offset.y)<panRadius(size));
      assert.equal(Math.sign(offset.x),Math.sign(input.x));
      assert.equal(Math.sign(offset.y),Math.sign(input.y));
    }
    assert.ok(panRadius(size)<=300);
  }
});
test('re-grabbing a returning map is continuous and repeated drags cannot accumulate drift', () => {
  const size={width:820,height:720};
  let offset={x:80,y:-40};
  const restored=elasticPan(panInput(offset,size),size);
  assert.ok(Math.hypot(restored.x-offset.x,restored.y-offset.y)<1e-8);
  for(let i=0;i<100;i++) {
    const input=panInput(offset,size);
    offset=elasticPan({x:input.x+500,y:input.y-100},size);
    assert.ok(Math.hypot(offset.x,offset.y)<panRadius(size));
  }
});
test('whole-map gravity returns to its resting view with a damped overshoot', () => {
  const state={x:170,y:-50,vx:0,vy:0};
  let overshot=false;
  for(let frame=0;frame<240;frame++) {
    stepPanGravity(state,1/60);
    overshot ||= state.x<0;
    assert.ok(Math.hypot(state.x,state.y)<=Math.hypot(170,50));
  }
  assert.ok(overshot,'return should have a soft pendulum-like overshoot');
  assert.deepEqual(state,stillMotion());
  assert.equal(stepPanGravity(state,1/60),false);
});
test('whole-map gravity handles long or paused frames without a jump', () => {
  const state={x:120,y:20,vx:0,vy:0};
  const before={...state};
  stepPanGravity(state,0);
  assert.deepEqual(state,before);
  stepPanGravity(state,30);
  assert.ok(state.x>100&&state.x<120);
  assert.ok(Number.isFinite(state.vx));
});

test('camera zoom progresses gradually, eases at both ends, and stops at its exact destination', () => {
  const size={width:900,height:650}, from={x:-1150,y:-1275,scale:1}, to={x:-680,y:-980,scale:.75};
  const samples=Array.from({length:36},(_,i)=>interpolateCamera(from,to,i/35,size));
  assert.deepEqual(samples[0],from);
  assert.deepEqual(samples.at(-1),to);
  for(let i=1;i<samples.length;i++) {
    assert.ok(samples[i].scale<samples[i-1].scale);
    assert.ok(Number.isFinite(samples[i].x)&&Number.isFinite(samples[i].y));
  }
  assert.ok(Math.abs(samples[1].scale-from.scale)<Math.abs(samples[18].scale-samples[17].scale)/10);
  assert.ok(Math.abs(samples.at(-2).scale-to.scale)<Math.abs(samples[18].scale-samples[17].scale)/10);
  assert.deepEqual(interpolateCamera(from,to,10,size),to);
  assert.ok(cameraTransitionDuration>=400&&cameraTransitionDuration<=700);
});
test('pure camera zoom keeps its focal point centered on desktop and narrow screens', () => {
  for(const size of [{width:900,height:650},{width:356,height:560}]) {
    const center={x:1600,y:1600};
    const camera=scale=>({x:size.width/2-center.x*scale,y:size.height/2-center.y*scale,scale});
    for(let step=0;step<=20;step++) {
      const view=interpolateCamera(camera(.75),camera(1.5),step/20,size);
      assert.ok(Math.abs(center.x*view.scale+view.x-size.width/2)<1e-8);
      assert.ok(Math.abs(center.y*view.scale+view.y-size.height/2)<1e-8);
    }
  }
});
test('interrupting a camera transition starts the next move from the visible frame', () => {
  const size={width:900,height:650}, initial={x:-1150,y:-1275,scale:1};
  const frame=interpolateCamera(initial,{x:-680,y:-980,scale:.75},.4,size);
  const next={x:-1800,y:-1500,scale:1.5};
  assert.deepEqual(interpolateCamera(frame,next,0,size),frame);
  const after=interpolateCamera(frame,next,.01,size);
  assert.ok(Math.hypot(after.x-frame.x,after.y-frame.y)<.1);
  assert.ok(after.scale>frame.scale&&after.scale<next.scale);
  assert.deepEqual(interpolateCamera(frame,next,1,size),next);
});
