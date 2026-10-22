import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoads,distance,bridgeHeight} from '../roads.js';
const roads=createRoads();
function checkPath(from,to,gateOpen){const route=roads.route(from,to,gateOpen);assert.ok(route.length,'reachable road must produce a route');let previous=from;for(const next of route){for(let t=0;t<=1;t+=.025){const p={x:previous.x+(next.x-previous.x)*t,z:previous.z+(next.z-previous.z)*t};assert.ok(roads.isOnRoad(p,1e-6),`route left the visible road at ${JSON.stringify(p)}`);if(!gateOpen)assert.ok(!(Math.abs(p.x+24)<.01&&p.z<-8.01&&p.z>-12.99),'closed gate was crossed');}previous=next;}return route;}
test('Every sampled route remains on the rendered road network, including all intersections',()=>{for(const gateOpen of [false,true]){const candidates=roads.nodes.filter(n=>gateOpen||!(n.x>=-40&&n.x<=-8&&n.z<-8&&n.z>-35));for(let i=0;i<90;i++){const from=candidates[(i*17)%candidates.length],to=candidates[(i*31+19)%candidates.length];checkPath(from,to,gateOpen);}}});
test('Opening gate connects the inner courtyard; closed gate stops outside',()=>{const from={x:0,z:21},target={x:-24,z:-22},closed=checkPath(from,target,false),open=checkPath(from,target,true);assert.ok(distance(closed.at(-1),target)>5);assert.ok(distance(open.at(-1),target)<.001);assert.ok(open.some(p=>p.x===-24&&p.z===-13));});
test('Bridge is the shortest route from west to east bank and changes actor elevation continuously',()=>{const path=checkPath({x:22,z:-11},{x:40,z:-11},false);assert.ok(path.some(p=>p.x===31));assert.ok(bridgeHeight(31)>1.9);assert.ok(Math.abs(bridgeHeight(22)-bridgeHeight(40))<.0001);for(let x=22;x<=40;x+=.2){assert.ok(Math.abs(roads.height({x,z:-11})-bridgeHeight(x))<.001);}});
test('Off-road destinations are projected onto paths instead of cutting through growing beds',()=>{for(let row=0;row<4;row++)for(let col=0;col<4;col++){const crop={x:-9+col*6,z:row*6};const path=checkPath({x:0,z:21},crop,false);assert.ok(roads.isOnRoad(path.at(-1)));assert.ok(distance(path.at(-1),crop)>=2.9);}});
test('Courtyard walls have exactly one navigable entrance, through the gate',()=>{
  const start=roads.project({x:0,z:21},false),seen=new Set([roads.edges[start.edge].a]),queue=[...seen];
  while(queue.length){const id=queue.shift();for(const eid of roads.nodes[id].links){const e=roads.edges[eid];if(e.gate)continue;const next=e.a===id?e.b:e.a;if(!seen.has(next)){seen.add(next);queue.push(next);}}}
  for(const id of seen){const p=roads.nodes[id];assert.ok(!(p.x>-39.6&&p.x<-8.4&&p.z<-8.35&&p.z>-34.6),'An outside road passed through a solid courtyard wall');}
});
