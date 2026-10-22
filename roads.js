// Navigation follows the exact same segments used to build the visible stone roads.
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const bridgeHeight = x => .13+Math.sin(Math.PI*Math.max(0,Math.min(1,(x-22)/18)))*1.8;
export function createRoads(){
  const nodes=[],edges=[],byKey=new Map(),edgeKeys=new Set();
  const node=p=>{const k=`${p[0]},${p[1]}`;if(!byKey.has(k)){byKey.set(k,nodes.length);nodes.push({id:nodes.length,x:p[0],z:p[1],links:[]});}return byKey.get(k);};
  function line(points,options={}){for(let i=1;i<points.length;i++){const a=node(points[i-1]),b=node(points[i]),key=[a,b].sort((x,y)=>x-y).join(',');if(edgeKeys.has(key))continue;edgeKeys.add(key);const e={id:edges.length,a,b,width:options.width||2.8,gate:!!options.gate,bridge:!!options.bridge,length:distance(nodes[a],nodes[b])};edges.push(e);nodes[a].links.push(e.id);nodes[b].links.push(e.id);}}
  const xs=[-12,-6,0,6,12],zs=[-3,3,9,15,21];
  for(const z of zs)line(xs.map(x=>[x,z]),{width:2});
  for(const x of xs)line(zs.map(z=>[x,z]),{width:2});
  const fx=[-38,-32,-26],fz=[-3,3,9,15];
  for(const z of fz)line(fx.map(x=>[x,z]),{width:2});
  for(const x of fx)line(fz.map(z=>[x,z]),{width:2});
  line([[-26,-3],[-24,-3],[-12,-3]]);
  line([[-24,-3],[-24,-8]]);
  line([[-24,-8],[-24,-13]],{gate:true});
  line([[-24,-13],[-24,-22]]);
  line([[-34,-22],[-24,-22],[-14,-22]]);
  line([[-34,-22],[-34,-13],[-24,-13],[-14,-13],[-14,-22]]);
  line([[12,-3],[18,-7],[22,-11]]);
  line([[22,-11],[31,-11],[40,-11]],{bridge:true,width:3.1});
  line([[40,-11],[43,-11],[49,-18],[49,-29],[37,-35],[24,-29],[12,-23],[1,-25],[2,-18],[0,-12],[0,-3]]);
  line([[24,-29],[23,-21],[22,-11]]);
  line([[43,-11],[45,-2],[48,10],[37,18],[23,28],[12,21]]);
  line([[12,21],[23,28],[37,26],[48,30],[51,40],[32,42],[15,38],[0,34],[-12,34],[-25,33],[-38,28],[-47,17],[-48,3],[-49,-11],[-44,-25],[-49,-32],[-54,-40]]);
  line([[0,21],[0,28],[0,34]]);
  line([[-12,21],[-20,23],[-25,33]]);
  line([[-26,15],[-34,19],[-34,25],[-27,27],[-20,29],[-12,34]]);
  line([[-38,15],[-47,17]]);
  line([[-38,-3],[-48,3]]);
  line([[-24,-3],[-30,-5],[-41,-5],[-49,-11]]);
  line([[-44,-25],[-44,-36],[-30,-41],[-14,-40],[1,-38],[12,-23]]);
  line([[0,28],[16,29],[23,28]]);
  line([[37,18],[33,10],[25,4],[12,3]]);
  function projectOnEdge(p,e){const a=nodes[e.a],b=nodes[e.b],t=Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.z-a.z)*(b.z-a.z))/(e.length*e.length)));return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,edge:e.id,t};}
  function project(p,gateOpen=true,allowed=null){let nearest=null,best=Infinity;for(const e of edges){if(e.gate&&!gateOpen||allowed&&!allowed.has(e.a))continue;const point=projectOnEdge(p,e),d=distance(point,p);if(d<best){nearest=point;best=d;}}return nearest;}
  function reachable(start,gateOpen){const reached=new Set([start]),queue=[start];while(queue.length){const id=queue.shift();for(const eid of nodes[id].links){const e=edges[eid];if(e.gate&&!gateOpen)continue;const next=e.a===id?e.b:e.a;if(!reached.has(next)){reached.add(next);queue.push(next);}}}return reached;}
  function route(from,to,gateOpen){
    const start=project(from,gateOpen);if(!start)return [];
    const edge=edges[start.edge],component=reachable(edge.a,gateOpen),target=project(to,gateOpen,component);if(!target)return [];
    if(start.edge===target.edge)return [target];
    const costs=new Map([[edge.a,distance(start,nodes[edge.a])],[edge.b,distance(start,nodes[edge.b])]]),previous=new Map(),open=new Set([edge.a,edge.b]);
    while(open.size){let id=null;for(const n of open)if(id===null||costs.get(n)<costs.get(id))id=n;open.delete(id);for(const eid of nodes[id].links){const e=edges[eid];if(e.gate&&!gateOpen)continue;const next=e.a===id?e.b:e.a,score=costs.get(id)+e.length;if(score<(costs.get(next)??Infinity)){costs.set(next,score);previous.set(next,id);open.add(next);}}}
    const endEdge=edges[target.edge],end=[endEdge.a,endEdge.b].sort((a,b)=>(costs.get(a)+distance(nodes[a],target))-(costs.get(b)+distance(nodes[b],target)))[0];
    if(!costs.has(end))return [];
    let id=end;const points=[target];while(id!==undefined){points.unshift({...nodes[id]});id=previous.get(id);}
    return points.filter((p,i)=>i?distance(p,points[i-1])>.001:distance(p,from)>.001);
  }
  function height(p){const q=project(p);return q&&edges[q.edge].bridge?bridgeHeight(p.x):.13;}
  function isOnRoad(p,tolerance=.02){const q=project(p);return !!q&&distance(p,q)<=tolerance;}
  return {nodes,edges,route,project,height,isOnRoad};
}
