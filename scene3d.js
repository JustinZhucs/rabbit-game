import * as THREE from './node_modules/three/build/three.module.js';
import {mergeGeometries} from './node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import {material,ellipsoid,box,cylinder,buildGirl,buildRabbit,buildCapy,animateModel} from './models.js';
import {createRoads,distance,bridgeHeight} from './roads.js';
const TAU=Math.PI*2;
const lerp=THREE.MathUtils.lerp;
let rngSeed=29481;
function random(){rngSeed=(Math.imul(rngSeed,1664525)+1013904223)>>>0;return rngSeed/4294967296;}
function group(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function roof(parent,x,y,z,width,depth,color='#65968c'){
  const g=group(parent,x,y,z),positions=[],indices=[],nx=16,nz=12;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const px=(i/nx-.5)*width,pz=(j/nz-.5)*depth,t=Math.abs(pz)/(depth/2);positions.push(px,1.45*(1-t)+.5*t**5+.15*(Math.abs(px)/(width/2))**5,pz);}
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i;indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material(color,{side:THREE.DoubleSide}));mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
  for(let i=0;i<=nx;i++){const line=[];for(let j=0;j<=nz;j++){const p=(j*(nx+1)+i)*3;line.push(new THREE.Vector3(positions[p],positions[p+1]+.045,positions[p+2]));}const curve=new THREE.CatmullRomCurve3(line);const ridge=new THREE.Mesh(new THREE.TubeGeometry(curve,12,.035,4,false),material('#78a99e'));g.add(ridge);}
  const spine=cylinder(g,'#537e78',0,1.55,0,.13,.13,width+.6);spine.rotation.z=Math.PI/2;
  for(const side of [-1,1]){const tip=ellipsoid(g,color,side*(width/2+.12),.65,0,.35,.12,.32);tip.rotation.z=side*.3;}
  return g;
}
function lantern(parent,x,z){const g=group(parent,x,0,z);box(g,'#c8bea0',0,.22,0,.68,.4,.68);cylinder(g,'#c9bda0',0,1.08,0,.16,.22,1.4,6);box(g,'#d8c6a1',0,1.82,0,.64,.55,.64);box(g,'#fae2a3',0,1.82,.327,.42,.35,.022);roof(g,0,2.08,0,1.2,1.2);return g;}

function batchMeshes(root,skip=()=>false){
  root.updateWorldMatrix(true,true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),groups=new Map();
  root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isInstancedMesh||Array.isArray(mesh.material)||skip(mesh))return;
    let object=mesh;while(object&&object!==root){if(object.userData.kind==='gate')return;object=object.parent;}
    const geometry=mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
    const flat=geometry.index?geometry.toNonIndexed():geometry;
    for(const key of Object.keys(flat.attributes))if(key!=='position'&&key!=='normal')flat.deleteAttribute(key);
    if(!flat.attributes.normal)flat.computeVertexNormals();flat.clearGroups();
    if(!groups.has(mesh.material.uuid))groups.set(mesh.material.uuid,{material:mesh.material,geometries:[],meshes:[]});
    const data=groups.get(mesh.material.uuid);data.geometries.push(flat);data.meshes.push(mesh);
  });
  for(const data of groups.values()){
    const geometry=mergeGeometries(data.geometries,false);if(!geometry)continue;
    const mesh=new THREE.Mesh(geometry,data.material);mesh.castShadow=data.meshes.some(m=>m.castShadow);mesh.receiveShadow=true;
    root.add(mesh);for(const old of data.meshes)old.removeFromParent();for(const geo of data.geometries)geo.dispose();
  }
}

export class FarmWorld {
  constructor(canvas,options){
    this.canvas=canvas;this.options=options;this.roads=createRoads();this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#d5e8db');this.scene.fog=new THREE.Fog('#d5e8db',115,210);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;
    this.camera=new THREE.OrthographicCamera(-25,25,25,-25,.1,300);this.target=innerWidth<700?new THREE.Vector3(-2,0,14):new THREE.Vector3(0,0,10);this.zoom=1;this.time=0;this.follow=false;this.gateOpen=!!options.gateOpen;this.gateAngle=this.gateOpen?1:0;this.actors=[];this.treeData=[];this.waterRings=[];this.plots=new Map();this.heartParticles=[];this.raycaster=new THREE.Raycaster();this.ndc=new THREE.Vector2();this.groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);this.vector=new THREE.Vector3();this.labels=[];
    this.buildLights();this.buildGround();this.buildRoads();this.buildCourtyard();this.buildPond();this.buildPavilion();this.buildTrees();this.buildMountains();
    batchMeshes(this.scene,mesh=>mesh===this.water||this.waterRings.some(r=>r.mesh===mesh));
    this.girl=this.makeActor('girl',{x:0,z:21},buildGirl(),4.2);this.rabbit=this.makeActor('rabbit',{x:-2.7,z:21},buildRabbit(),5.2);this.rabbitTrail=[{x:0,z:21}];
    const spawns=[{x:12,z:9},{x:-26,z:9},{x:-27,z:27},{x:43,z:-11},{x:0,z:34},{x:-12,z:-3}];this.capy=this.makeActor('capy',spawns[Math.floor(Math.random()*spawns.length)],buildCapy(),1.6);this.capy.nextWalk=2;this.capy.petStarted=-100;
    this.destination=new THREE.Mesh(new THREE.RingGeometry(.35,.55,24),new THREE.MeshBasicMaterial({color:'#fff1ae',transparent:true,opacity:.9,side:THREE.DoubleSide}));this.destination.rotation.x=-Math.PI/2;this.destination.visible=false;this.scene.add(this.destination);
    this.label('小院菜园',0,2,-5);this.label('春日花园',-33,2,-5);this.label('青瓦小院',-24,5,-34);this.label('一池荷香',31,2,-25);this.label('甜甜果园',-27,3,31);this.label('听风亭',49,5,-32);this.girlLabel=this.label('小桃',0,4,21,'character-label');this.capyLabel=this.label('挠挠我 ♥',this.capy.x,3,this.capy.z,'character-label');
    this.gateLabel=this.label(this.gateOpen?'关上院门':'开门 · 进小院',-24,4.4,-8,'gate-marker',()=>this.options.onGate());
    this.installInput();this.resize();this.start();
  }
  buildLights(){this.scene.add(new THREE.HemisphereLight('#fff5df','#92b68b',1.9));const sun=new THREE.DirectionalLight('#fff1d5',2.2);sun.position.set(-30,65,32);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;sun.shadow.camera.top=60;sun.shadow.camera.bottom=-60;sun.shadow.camera.far=160;sun.shadow.normalBias=.055;sun.shadow.bias=-.00012;this.scene.add(sun);}
  buildGround(){
    box(this.scene,'#9abb78',0,-.5,0,130,1,104);box(this.scene,'#759b65',0,-1.5,0,130,1.2,104);
    // Shallow grass patches soften the meadow without obscuring walkable roads.
    const patchGeometry=new THREE.CircleGeometry(1,18),patchMaterial=material('#aac783');const patches=new THREE.InstancedMesh(patchGeometry,patchMaterial,140);const dummy=new THREE.Object3D();
    for(let i=0;i<140;i++){dummy.position.set((random()-.5)*122,.012,(random()-.5)*94);dummy.rotation.set(-Math.PI/2,0,random()*TAU);dummy.scale.set(1+random()*3,.6+random()*2,1);dummy.updateMatrix();patches.setMatrixAt(i,dummy.matrix);}patches.receiveShadow=true;this.scene.add(patches);
  }
  buildRoads(){
    const stoneGeo=new THREE.IcosahedronGeometry(1,0),stoneMat=material('#d9d2b4'),stones=[];
    for(const e of this.roads.edges){
      if(e.bridge)continue;const a=this.roads.nodes[e.a],b=this.roads.nodes[e.b],angle=Math.atan2(b.x-a.x,b.z-a.z);const base=box(this.scene,'#c7bfa2',(a.x+b.x)/2,.045,(a.z+b.z)/2,e.width,.08,e.length+.45);base.rotation.y=angle;
      const steps=Math.max(1,Math.ceil(e.length/.85)),across=e.width>2.5?3:2;
      for(let j=0;j<steps;j++)for(let k=0;k<across;k++){const t=(j+.5)/steps,side=((k+.5)/across-.5)*e.width;stones.push({x:lerp(a.x,b.x,t)+Math.cos(angle)*side,z:lerp(a.z,b.z,t)-Math.sin(angle)*side,angle:angle+(random()-.5)*.17,sx:e.width/across*.52,sz:.42+random()*.12,tint:random()});}
    }
    this.stones=new THREE.InstancedMesh(stoneGeo,stoneMat,stones.length);const d=new THREE.Object3D();for(let i=0;i<stones.length;i++){const s=stones[i];d.position.set(s.x,.11,s.z);d.rotation.set(0,s.angle,0);d.scale.set(s.sx,.13,s.sz);d.updateMatrix();this.stones.setMatrixAt(i,d.matrix);this.stones.setColorAt(i,new THREE.Color().setHSL(.13,.17,.68+s.tint*.16,THREE.SRGBColorSpace));}this.stones.receiveShadow=true;this.scene.add(this.stones);
    for(const n of this.roads.nodes){if(n.links.length>=3)cylinder(this.scene,'#d0c8ab',n.x,.053,n.z,1.08,1.08,.075,12);}
    for(const [x,z]of [[-24,-3],[14,-3],[18,24],[-25,31],[-40,15],[43,-15],[0,30],[-12,-14],[47,33]])lantern(this.scene,x+2.1,z);
  }
  buildCourtyard(){
    const yard=group(this.scene);box(yard,'#d7d0b4',-24,.018,-20,29,.035,23);
    box(yard,'#f2ebd5',-40,1.3,-21.5,.65,2.6,27);box(yard,'#f2ebd5',-8,1.3,-21.5,.65,2.6,27);box(yard,'#f2ebd5',-24,1.3,-35,32,2.6,.65);
    for(const x of [-33,-15]){box(yard,'#f2ebd5',x,1.3,-8,14,2.6,.65);box(yard,'#65968c',x,2.67,-8,14.6,.24,1.05);}
    for(const x of [-40,-8])box(yard,'#65968c',x,2.67,-21.5,1,.25,27.5);box(yard,'#65968c',-24,2.67,-35,33,.25,1);
    const house=group(yard,-24,0,-31);box(house,'#f6eed8',0,2.4,0,22,4.7,7.4);box(house,'#bda889',0,.3,4.25,24,.6,1.6);box(house,'#d9caad',0,.14,5.08,25,.28,.6);
    roof(house,0,4.65,0,25,11);roof(house,0,3.4,3.25,24,3.2);
    for(const x of [-10,-5,0,5,10]){cylinder(house,'#966e4e',x,2.2,4,.14,.17,4.1,10);}
    box(house,'#91684c',0,1.65,3.76,3,3.1,.12);
    for(const side of [-1,1]){box(house,'#c3b68b',side*.64,2.1,3.85,.9,1.55,.07);for(let i=0;i<4;i++)box(house,'#805c43',side*.64+(i-1.5)*.22,2.1,3.92,.055,1.55,.04);ellipsoid(house,'#c8b779',side*.27,1.52,3.96,.06,.06,.04);}
    for(const x of [-7,7]){box(house,'#a9855d',x,2.25,3.78,3.4,1.8,.13);box(house,'#e9dfb9',x,2.25,3.9,3.1,1.5,.035);for(let i=0;i<5;i++)box(house,'#a9855d',x+(i-2)*.58,2.25,3.94,.06,1.52,.035);box(house,'#a9855d',x,2.25,3.96,3.3,.07,.045);}
    for(const x of [-26.2,-21.8]){box(yard,'#dbcdb0',x,1.8,-8,.65,3.6,.72);box(yard,'#a87b50',x,1.84,-7.57,.23,3.1,.22);}roof(yard,-24,3.42,-8,6.2,3.6);
    this.gateLeft=group(yard,-25.85,0,-8);this.gateRight=group(yard,-22.15,0,-8);
    const left=box(this.gateLeft,'#ad7a58',.91,1.65,0,1.82,3.2,.18),right=box(this.gateRight,'#ad7a58',-.91,1.65,0,1.82,3.2,.18);
    for(const [g,side]of [[this.gateLeft,1],[this.gateRight,-1]]){for(let i=1;i<=4;i++)box(g,'#bc8a66',side*i*.36,1.65,.12,.23,3,.06);box(g,'#76593f',side*.9,.8,.17,1.72,.15,.07);box(g,'#76593f',side*.9,2.6,.17,1.72,.15,.07);const ring=new THREE.Mesh(new THREE.TorusGeometry(.11,.025,6,12),material('#e1c277'));ring.position.set(side*1.5,1.5,.17);g.add(ring);g.userData.kind='gate';}
    left.userData.kind='gate';right.userData.kind='gate';
    // Courtyard furnishings sit beside, rather than on, the paved walking loop.
    cylinder(yard,'#aeb9a3',-18,.7,-17,1.2,1.05,.24);cylinder(yard,'#98a08a',-18,.38,-17,.23,.34,.75);for(const [x,z]of [[-20,-17],[-18,-19],[-16,-17]])cylinder(yard,'#b3bea6',x,.4,z,.45,.5,.65);
    const pot=cylinder(yard,'#6e9885',-18,.98,-17,.18,.23,.3);ellipsoid(yard,'#6e9885',-17.73,1.02,-17,.23,.07,.09);ellipsoid(yard,'#d5ddad',-18.48,.95,-17,.12,.06,.12);
    box(yard,'#997449',-30,.6,-16,3,.25,.65);for(const x of [-31,-29])box(yard,'#997449',x,.3,-16,.18,.6,.4);
    this.addTree(-12,-17,'pink',.85);this.addTree(-36,-16,'pink',.7);
  }
  buildPond(){
    const pondShape=new THREE.Shape();for(let i=0;i<=48;i++){const a=i/48*TAU,r=1+Math.sin(a*5)*.03,x=31+Math.cos(a)*10*r,z=-10+Math.sin(a)*13*r;if(i===0)pondShape.moveTo(x,-z);else pondShape.lineTo(x,-z);}
    const geo=new THREE.ShapeGeometry(pondShape,32);geo.rotateX(-Math.PI/2);this.water=new THREE.Mesh(geo,material('#75c4ba',{metalness:.1,roughness:.35,transparent:true,opacity:.93}));this.water.position.y=.025;this.water.receiveShadow=true;this.scene.add(this.water);
    const rockGeo=new THREE.IcosahedronGeometry(1,0),rocks=new THREE.InstancedMesh(rockGeo,material('#b9c3ad'),66),dummy=new THREE.Object3D();
    for(let i=0;i<66;i++){const a=i/66*TAU,x=31+Math.cos(a)*10.5,z=-10+Math.sin(a)*13.5;if(Math.abs(z+11)<2.2&&Math.abs(x-31)>8){dummy.scale.set(.01,.01,.01);}else dummy.scale.set(.6+random()*.7,.4+random()*.6,.6+random()*.65);dummy.position.set(x,.15,z);dummy.rotation.set(random(),random()*TAU,random());dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}rocks.castShadow=true;rocks.receiveShadow=true;this.scene.add(rocks);
    const bridge=group(this.scene);for(let i=0;i<36;i++){const x=22+(i+.5)*.5,y=bridgeHeight(x);box(bridge,'#b79061',x,y-.08,-11,.47,.16,3.15);for(const side of [-1,1]){box(bridge,'#a77b50',x,y+.85,-11+side*1.58,.54,.12,.1);}}
    for(let i=0;i<=9;i++){const x=22+i*2,y=bridgeHeight(x);for(const side of [-1,1]){cylinder(bridge,'#97704c',x,y+.48,-11+side*1.58,.07,.085,1.02,8);ellipsoid(bridge,'#caa575',x,y+1.04,-11+side*1.58,.12,.09,.12);}}
    for(const x of [22,40])for(const side of [-1,1])cylinder(bridge,'#d3c6a5',x,.16,-11+side*1.7,.36,.42,.42,10);
    for(let i=0;i<18;i++){const a=random()*TAU,r=.3+random()*.6,x=31+Math.cos(a)*8*r,z=-10+Math.sin(a)*11*r;if(Math.abs(z+11)<2.4)continue;const lily=group(this.scene,x,.08,z);cylinder(lily,'#83ae6b',0,0,0,.7,.7,.07,14);for(let j=0;j<6;j++){const angle=j*TAU/6;const petal=ellipsoid(lily,'#ecacb6',Math.cos(angle)*.25,.18,Math.sin(angle)*.25,.2,.13,.35);petal.rotation.y=-angle;}ellipsoid(lily,'#f5d18c',0,.25,0,.15,.12,.15);}
    for(let i=0;i<9;i++){const ring=new THREE.Mesh(new THREE.RingGeometry(.8,.84,36),new THREE.MeshBasicMaterial({color:'#eefbe1',transparent:true,opacity:.22,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(26+random()*11,.085,-20+random()*18);this.scene.add(ring);this.waterRings.push({mesh:ring,phase:random()*5});}
  }
  buildPavilion(){
    const pavilion=group(this.scene,48,0,-28);cylinder(pavilion,'#d4c5a4',0,.15,0,4.4,4.4,.3,8);for(const x of [-2.7,2.7])for(const z of [-2.7,2.7])cylinder(pavilion,'#9d7650',x,1.9,z,.17,.22,3.6,10);roof(pavilion,0,3.45,0,8.6,8.6,'#709c8a');box(pavilion,'#a88157',0,.7,1.8,3.8,.2,.6);box(pavilion,'#a88157',0,1.05,2.1,3.8,.75,.15);
    for(const [x,z]of [[-46,21],[42,32],[-47,-34]]){const g=group(this.scene,x,0,z);box(g,'#ae8b5c',0,.6,0,3.4,.22,.7);box(g,'#ae8b5c',0,1,.29,3.4,.75,.13);for(const px of [-1.2,1.2])box(g,'#92744d',px,.3,0,.2,.6,.55);}
  }
  addTree(x,z,type='green',scale=1){this.treeData.push({x,z,type,scale,phase:random()*TAU});}
  buildTrees(){
    for(let i=0;i<62;i++){const a=i/62*TAU,x=Math.cos(a)*(57+random()*4),z=Math.sin(a)*(44+random()*3);if(distance(this.roads.project({x,z}),{x,z})>4)this.addTree(x,z,i%7===0?'pink':'green',.85+random()*.65);}
    for(const [x,z,type]of [[-44,-4,'pink'],[-42,0,'green'],[-41,12,'pink'],[-16,-15,'pink'],[-2,-16,'green'],[10,-17,'pink'],[15,-31,'green'],[30,-30,'pink'],[42,-20,'green'],[47,5,'green'],[39,8,'pink'],[31,23,'pink'],[19,34,'green'],[-8,29,'pink'],[-16,38,'green'],[-31,36,'pink'],[-40,24,'green'],[-48,-19,'green'],[-42,-30,'pink']])this.addTree(x,z,type,.75+random()*.35);
    const leavesGeo=new THREE.IcosahedronGeometry(1,2),trunkGeo=new THREE.CylinderGeometry(.21,.35,3.1,7);this.treeLeaves=new THREE.InstancedMesh(leavesGeo,material('#ffffff'),this.treeData.length*6);this.treeTrunks=new THREE.InstancedMesh(trunkGeo,material('#a7865d'),this.treeData.length);this.treeLeaves.castShadow=true;this.treeLeaves.receiveShadow=true;this.treeTrunks.castShadow=true;const d=new THREE.Object3D();
    this.treeData.forEach((tree,i)=>{d.position.set(tree.x,1.5*tree.scale,tree.z);d.scale.set(tree.scale,tree.scale,tree.scale);d.rotation.set(0,0,0);d.updateMatrix();this.treeTrunks.setMatrixAt(i,d.matrix);for(let j=0;j<6;j++){const color=tree.type==='pink'?new THREE.Color().setHSL(.96,.46,.67+j*.012,THREE.SRGBColorSpace):new THREE.Color().setHSL(.27,.36,.44+j*.021,THREE.SRGBColorSpace);this.treeLeaves.setColorAt(i*6+j,color);}});this.scene.add(this.treeTrunks,this.treeLeaves);this.treeDummy=d;this.updateTrees(0);
    // Bamboo groves: real thin culms and small leaf clusters at the edges.
    for(const [gx,gz]of [[-54,8],[-50,-28],[53,15],[54,-22]]){const g=group(this.scene,gx,0,gz);for(let i=0;i<8;i++){const x=(random()-.5)*5,z=(random()-.5)*5,h=4+random()*3;cylinder(g,'#7f9b5b',x,h/2,z,.07,.09,h,6);for(let j=0;j<3;j++){const l=ellipsoid(g,'#85a768',x+.3,h-1-j*.8,z,.6,.07,.22);l.rotation.z=.35;}}}
  }
  updateTrees(t){const d=this.treeDummy;if(!d)return;this.treeData.forEach((tree,i)=>{const sway=Math.sin(t*1.3+tree.phase)*.16+Math.sin(t*.67+tree.phase)*.1;for(let j=0;j<6;j++){const a=j*TAU/5,r=j===5?0:1.25;d.position.set(tree.x+(Math.cos(a)*r+sway)*tree.scale,(3.15+(j===5?1.1:Math.sin(a)*.2))*tree.scale,tree.z+(Math.sin(a)*r+Math.cos(t+tree.phase)*.08)*tree.scale);d.rotation.set(sway*.11,tree.phase,sway*.13);d.scale.set((j===5?1.7:1.6)*tree.scale,(j===5?1.5:1.25)*tree.scale,(j===5?1.65:1.45)*tree.scale);d.updateMatrix();this.treeLeaves.setMatrixAt(i*6+j,d.matrix);}});this.treeLeaves.instanceMatrix.needsUpdate=true;}
  buildMountains(){
    for(let layer=0;layer<3;layer++)for(let i=0;i<15;i++){const x=(i-7)*13+(layer%2)*6,z=-62-layer*15,h=8+random()*15;const mountain=new THREE.Mesh(new THREE.ConeGeometry(9+random()*5,h,7),material(['#95b7a0','#a9c8b7','#bfd6ca'][layer]));mountain.position.set(x,h/2-1,z);mountain.scale.z=.85;this.scene.add(mountain);}
    // A second distant ridge closes the visible side boundary.
    for(const side of [-1,1])for(let i=0;i<8;i++){const h=7+random()*10;const m=new THREE.Mesh(new THREE.ConeGeometry(9,h,6),material('#aac6ad'));m.position.set(side*(75+random()*7),h/2-1,-48+i*13);this.scene.add(m);}
  }
  label(text,x,y,z,className='',onClick=null){const element=document.createElement(onClick?'button':'span');element.className='scene-label '+className;element.textContent=text;if(onClick)element.onclick=e=>{e.stopPropagation();onClick();};$('sceneLabels').append(element);const label={element,x,y,z};this.labels.push(label);return label;}
  makeActor(type,p,model,speed){const spawn=this.roads.project(p,this.gateOpen),actor={type,x:spawn.x,z:spawn.z,model,speed,path:[],phase:0,angle:0,moving:false};model.root.position.set(actor.x,this.roads.height(actor),actor.z);model.root.scale.setScalar(type==='girl'?1:1.08);this.scene.add(model.root);this.actors.push(actor);return actor;}
  addPlots(plots,seedById){this.seedById=seedById;for(const plot of plots){const root=group(this.scene,plot.x,0,plot.y);root.userData.plotId=plot.id;const size=plot.kind==='fruit'?2.6:plot.kind==='water'?1.35:4.05;if(plot.kind==='vegetable'||plot.kind==='flower'){box(root,'#b28c62',0,.16,0,size,.3,size);for(const side of [-1,1]){box(root,'#d0aa7a',side*2.07,.23,0,.13,.26,4.3);box(root,'#d0aa7a',0,.23,side*2.07,4.3,.26,.13);}}
      else{const ring=new THREE.Mesh(new THREE.RingGeometry(size,size+.14,32),material(plot.kind==='water'?'#e9efb9':'#d8d7b2',{side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.13;root.add(ring);}
      const hit=box(root,'#f6efcd',0,.22,0,size,.05,size);hit.material=new THREE.MeshBasicMaterial({visible:false});hit.userData.plotId=plot.id;
      const plants=group(root),plus=this.label('+',plot.x,.5,plot.y,'plot-label',()=>this.options.onPlot(plot.id));plus.element.dataset.plotId=plot.id;this.plots.set(plot.id,{plot,root,plants,label:plus,lastSeed:undefined,lastStage:-1});}
    this.updatePlots(true);
  }
  plantModel(parent,seed,kind){
    if(kind==='fruit'){
      cylinder(parent,'#aa8053',0,1.35,0,.17,.3,2.7,8);for(let i=0;i<5;i++){const a=i*TAU/5;ellipsoid(parent,'#8ba965',Math.cos(a)*.85,2.4+Math.sin(a)*.3,Math.sin(a)*.85,1.3,1,1.3);}for(let i=0;i<7;i++){const a=i*TAU/7;const fruit=ellipsoid(parent,seed?.color||'#c5ce9a',Math.cos(a)*1.35,2.2+Math.sin(a)*.35,Math.sin(a)*1.35,.23,seed?.id==='pear'?.31:.23,.23);if(seed?.id==='peach')ellipsoid(parent,'#edb4a2',fruit.position.x+.06,fruit.position.y,fruit.position.z,.19,.21,.2);}return;
    }
    if(kind==='water'){
      cylinder(parent,'#7baa64',0,.18,0,.9,.9,.06,18);for(let i=0;i<7;i++){const a=i*TAU/7;const p=ellipsoid(parent,seed?.color||'#e9eed7',Math.cos(a)*.28,.37,Math.sin(a)*.28,.22,.14,.47);p.rotation.y=-a;}ellipsoid(parent,'#efd083',0,.52,0,.19,.12,.19);return;
    }
    cylinder(parent,'#79a15c',0,.6,0,.035,.05,1.1,7);
    for(let i=0;i<3;i++){const leaf=ellipsoid(parent,i%2?'#83ae62':'#719853',(i%2?1:-1)*.24,.34+i*.2,0,.34,.075,.13);leaf.rotation.z=(i%2?1:-1)*.3;}
    if(kind==='flower'){for(let i=0;i<6;i++){const a=i*TAU/6;const petal=ellipsoid(parent,seed?.color||'#ecc3b6',Math.cos(a)*.21,1.12,Math.sin(a)*.21,.2,.12,.3);petal.rotation.y=-a;}ellipsoid(parent,'#e5c775',0,1.19,0,.13,.1,.13);}
    else if(seed?.id==='carrot'){const carrot=cylinder(parent,seed.color,0,.19,0,.15,.035,.45,10);carrot.rotation.z=.13;}
    else if(seed?.id==='tomato'){for(let i=0;i<3;i++)ellipsoid(parent,seed.color,(i%2?1:-1)*.25,.45+i*.22,.1,.21,.21,.21);}
    else ellipsoid(parent,seed?.color||'#e8edce',0,.26,0,.21,.3,.21);
  }
  updatePlots(force=false){
    const now=Date.now();for(const data of this.plots.values()){const {plot,plants,label}=data,seed=this.seedById(plot.seed),p=seed?Math.min(1,(now-plot.planted)/(seed.time*1000)):0,stage=seed?Math.floor(p*8):-1;
      if(force||data.lastSeed!==plot.seed||data.lastStage!==stage){while(plants.children.length){const child=plants.children[0];plants.remove(child);if(child.isMesh)child.geometry.dispose();}if(seed||plot.kind==='fruit'){if(plot.kind==='flower'||plot.kind==='vegetable'){for(const x of [-1.05,1.05])for(const z of [-1.05,1.05])this.plantModel(group(plants,x,0,z),seed,plot.kind);}else this.plantModel(plants,seed,plot.kind);}batchMeshes(plants);data.lastSeed=plot.seed;data.lastStage=stage;}
      plants.scale.setScalar(plot.kind==='fruit'? .75+p*.25:seed?.2+.8*p:1);label.element.textContent=!seed?'+':p>=1?'✓':Math.ceil((1-p)*seed.time)+'s';label.element.classList.toggle('mature',p>=1);label.element.setAttribute('aria-label',seed?`${seed.name}，${p>=1?'可收获':'生长中，点击查看'}`:`${{vegetable:'菜园',flower:'花园',fruit:'果园',water:'荷塘'}[plot.kind]}空种植地，点击播种`);label.y=plot.kind==='fruit'?4.3:1.5;}
  }
  focus(x,z){this.follow=false;this.target.set(x,0,z);this.clampTarget();this.updateCamera();}
  setZoom(value){this.zoom=Math.max(.48,Math.min(2,value));this.updateCamera();}
  zoomBy(amount){this.setZoom(this.zoom*amount);}
  clampTarget(){this.target.x=Math.max(-55,Math.min(55,this.target.x));this.target.z=Math.max(-42,Math.min(43,this.target.z));}
  updateCamera(){const h=(innerWidth<700?37:69)/this.zoom,aspect=innerWidth/innerHeight;this.camera.left=-h*aspect/2;this.camera.right=h*aspect/2;this.camera.top=h/2;this.camera.bottom=-h/2;this.camera.position.copy(this.target).add(new THREE.Vector3(37,49,53));this.camera.lookAt(this.target);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();}
  resize(){this.renderer.setSize(innerWidth,innerHeight,false);this.updateCamera();}
  groundPoint(x,y){this.ndc.set(x/innerWidth*2-1,-y/innerHeight*2+1);this.raycaster.setFromCamera(this.ndc,this.camera);return this.raycaster.ray.intersectPlane(this.groundPlane,new THREE.Vector3());}
  screenPoint(x,y,z){const v=new THREE.Vector3(x,y,z).project(this.camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2,visible:v.z>-1&&v.z<1};}
  projectRoad(p){return this.roads.project({x:p.x,z:p.z},this.gateOpen);}
  moveGirl(p,follow=false){
    this.girl.path=this.roads.route(this.girl,p,this.gateOpen);this.follow=follow;const target=this.girl.path.at(-1);if(target){this.destination.position.set(target.x,this.roads.height(target)+.02,target.z);this.destination.visible=true;this.destinationUntil=this.time+3;}return target;
  }
  moveToPlot(plot){this.moveGirl({x:plot.x,z:plot.y},false);}
  enterYard(){if(!this.gateOpen)this.options.onGate(true);this.moveGirl({x:-24,z:-22},true);}
  toggleGate(open=!this.gateOpen){
    if(!open&&this.actors.some(a=>distance(a,{x:-24,z:-10.5})<3.2||a.path.some(p=>Math.abs(p.x+24)<.1&&p.z<-8&&p.z>=-13))){return false;}
    this.gateOpen=open;this.gateLabel.element.textContent=open?'关上院门':'开门 · 进小院';return true;
  }
  advanceActor(actor,budget,record=false){
    let traveled=0;actor.moving=actor.path.length>0&&budget>.001;if(this.gateOpen&&this.gateAngle<.8&&Math.abs(actor.x+24)<.2&&actor.z<=-7.9&&actor.z>=-13.1){actor.moving=false;return 0;}while(actor.path.length&&budget>0){const next=actor.path[0],dx=next.x-actor.x,dz=next.z-actor.z,d=Math.hypot(dx,dz),step=Math.min(budget,d);if(d<.001){actor.path.shift();continue;}actor.angle=Math.atan2(dx,dz);actor.x+=dx/d*step;actor.z+=dz/d*step;budget-=step;traveled+=step;if(record)this.rabbitTrail.push({x:actor.x,z:actor.z});if(step>=d-.00001)actor.path.shift();}actor.phase+=traveled*(actor.type==='girl'?5.3:actor.type==='rabbit'?7.5:4.1);return traveled;
  }
  petCapy(){
    if(this.time-this.capy.petStarted<6.5){this.hearts(this.capy.x,this.capy.z,3);return false;}
    this.capy.path=[];this.capy.moving=false;this.capy.petStarted=this.time;this.capy.nextWalk=this.time+9;this.capy.rewarded=false;const approach=this.roads.route(this.girl,this.capy,this.gateOpen);if(approach.length){let remaining=2;const end=approach.at(-1);if(approach.length>1){const prev=approach.at(-2),len=distance(prev,end);if(len>remaining){end.x=lerp(end.x,prev.x,remaining/len);end.z=lerp(end.z,prev.z,remaining/len);}else approach.pop();}this.girl.path=approach;}
    this.hearts(this.capy.x,this.capy.z,10);return true;
  }
  hearts(x,z,count=6){for(let i=0;i<count;i++){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),material('#e494a7',{emissive:'#77384b',emissiveIntensity:.12}));mesh.position.set(x+(Math.random()-.5)*1.3,2+Math.random()*.5,z+(Math.random()-.5));this.scene.add(mesh);this.heartParticles.push({mesh,life:1.5+Math.random(),age:0});}}
  installInput(){
    const pointers=new Map();let gesture=null;const canvas=this.canvas;
    canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1)gesture={sx:e.clientX,sy:e.clientY,x:e.clientX,y:e.clientY,moved:false,multi:false};else if(pointers.size===2){const [a,b]=[...pointers.values()];gesture.multi=true;gesture.moved=true;gesture.distance=Math.hypot(a.x-b.x,a.y-b.y);}});
    canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);this.setZoom(this.zoom*d/Math.max(1,gesture.distance));gesture.distance=d;}else{if(Math.hypot(e.clientX-gesture.sx,e.clientY-gesture.sy)>7)gesture.moved=true;if(gesture.moved){const a=this.groundPoint(gesture.x,gesture.y),b=this.groundPoint(e.clientX,e.clientY);if(a&&b){this.target.x+=a.x-b.x;this.target.z+=a.z-b.z;this.follow=false;this.clampTarget();this.updateCamera();}}gesture.x=e.clientX;gesture.y=e.clientY;}});
    canvas.addEventListener('pointerup',e=>{if(!pointers.has(e.pointerId))return;const tap=gesture&&!gesture.moved&&!gesture.multi;pointers.delete(e.pointerId);if(tap)this.handleTap(e.clientX,e.clientY);if(pointers.size===1){const p=[...pointers.values()][0];gesture={sx:p.x,sy:p.y,x:p.x,y:p.y,moved:true,multi:true};}if(!pointers.size)gesture=null;});
    canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);if(!pointers.size)gesture=null;});canvas.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(this.zoom*Math.exp(-e.deltaY*.001));},{passive:false});window.addEventListener('resize',()=>this.resize());
  }
  handleTap(x,y){
    this.ndc.set(x/innerWidth*2-1,-y/innerHeight*2+1);this.raycaster.setFromCamera(this.ndc,this.camera);
    const hits=this.raycaster.intersectObjects(this.scene.children,true);for(const hit of hits){if(hit.object.material?.visible===false)continue;let object=hit.object;while(object){if(object.userData.kind==='gate'){this.options.onGate();return;}if(object.userData.plotId){this.options.onPlot(object.userData.plotId);return;}if(object.userData.kind==='capy'){this.options.onCapy();return;}if(object.userData.kind==='rabbit'){this.options.onRabbit();return;}object=object.parent;}if(hit.object===this.water)break;}
    const p=this.groundPoint(x,y);if(!p)return;if(p.x>-40&&p.x<-8&&p.z<-8&&p.z>-35&&!this.gateOpen){this.moveGirl({x:-24,z:-8},true);this.options.onBlockedGate();return;}
    this.moveGirl(p,true);this.options.onMove();
  }
  update(dt){
    this.time+=dt;if(this.time-(this.lastShadowUpdate||0)>.16){this.renderer.shadowMap.needsUpdate=true;this.lastShadowUpdate=this.time;}this.advanceActor(this.girl,dt*this.girl.speed,true);
    let queued=0,prev=this.rabbit;for(const p of this.rabbitTrail){queued+=distance(prev,p);prev=p;}const allowed=Math.min(dt*this.rabbit.speed,Math.max(0,queued-2.7));this.rabbit.path=this.rabbitTrail;this.advanceActor(this.rabbit,allowed,false);this.rabbitTrail=this.rabbit.path;
    const petElapsed=this.time-this.capy.petStarted,petting=petElapsed>=0&&petElapsed<6.5;
    if(!petting){if(this.capy.petStarted>0&&!this.capy.rewarded){this.capy.rewarded=true;this.options.onPetEnd();}if(this.time>this.capy.nextWalk&&!this.capy.path.length){const allowed=this.roads.nodes.filter(n=>distance(n,this.capy)>5&&distance(n,this.capy)<19);if(allowed.length)this.capy.path=this.roads.route(this.capy,allowed[Math.floor(Math.random()*allowed.length)],this.gateOpen);this.capy.nextWalk=this.time+7+Math.random()*5;}this.advanceActor(this.capy,dt*this.capy.speed);}else if(Math.random()<dt*2)this.hearts(this.capy.x,this.capy.z,1);
    for(const actor of this.actors){actor.model.root.position.set(actor.x,this.roads.height(actor),actor.z);const angle=actor.model.root.rotation.y;actor.model.root.rotation.y=angle+Math.atan2(Math.sin(actor.angle-angle),Math.cos(actor.angle-angle))*Math.min(1,dt*9);animateModel(actor.model,actor.phase,actor.moving,this.time,actor.type==='capy'&&petting?petElapsed:-1,actor.type==='girl'&&petting&&distance(actor,this.capy)<3.5);}
    this.gateAngle=lerp(this.gateAngle,this.gateOpen?1:0,Math.min(1,dt*4));this.gateLeft.rotation.y=-this.gateAngle*Math.PI*.56;this.gateRight.rotation.y=this.gateAngle*Math.PI*.56;
    this.updateTrees(this.time);for(const data of this.plots.values()){data.plants.rotation.z=Math.sin(this.time*1.2+data.plot.x)*.015;}for(const r of this.waterRings){const p=(this.time*.25+r.phase)%1;r.mesh.scale.setScalar(.8+p*2);r.mesh.material.opacity=(1-p)*.2;}
    this.water.material.opacity=.91+Math.sin(this.time*.7)*.025;
    for(const p of this.heartParticles){p.age+=dt;p.mesh.position.y+=dt*.9;p.mesh.scale.setScalar(Math.max(0,1-p.age/p.life));}this.heartParticles=this.heartParticles.filter(p=>{if(p.age<p.life)return true;this.scene.remove(p.mesh);p.mesh.geometry.dispose();return false;});
    if(this.follow&&this.girl.moving){this.target.x=lerp(this.target.x,this.girl.x,dt*2);this.target.z=lerp(this.target.z,this.girl.z,dt*2);this.updateCamera();}
    if(this.destination.visible&&this.time>this.destinationUntil)this.destination.visible=false;
    this.girlLabel.x=this.girl.x;this.girlLabel.z=this.girl.z;this.capyLabel.x=this.capy.x;this.capyLabel.z=this.capy.z;this.capyLabel.element.textContent=petting?'呼噜…好舒服':'挠挠我 ♥';
    for(const l of this.labels){const p=this.screenPoint(l.x,l.y,l.z);l.element.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;l.element.hidden=!p.visible||p.x<-80||p.x>innerWidth+80||p.y<120||p.y>innerHeight-120;}
    if(Math.floor(this.time*2)!==this.lastGrowth){this.lastGrowth=Math.floor(this.time*2);this.updatePlots();this.options.onTick?.();this.options.onLocation?.(this.target.x,this.target.z);}
    if(new URLSearchParams(location.search).has('qa')){this.canvas.dataset.snapshot=JSON.stringify({girl:{x:this.girl.x,z:this.girl.z,moving:this.girl.moving,onRoad:this.roads.isOnRoad(this.girl)},rabbit:{x:this.rabbit.x,z:this.rabbit.z,moving:this.rabbit.moving,onRoad:this.roads.isOnRoad(this.rabbit)},capy:{x:this.capy.x,z:this.capy.z,petting,moving:this.capy.moving,onRoad:this.roads.isOnRoad(this.capy)},gateOpen:this.gateOpen,gateAngle:this.gateAngle,bridgeY:this.roads.height(this.girl),camera:{x:this.target.x,z:this.target.z,zoom:this.zoom},drawCalls:this.renderer.info.render.calls});}
  }
  start(){let previous=0;const frame=timestamp=>{const dt=previous?Math.min((timestamp-previous)/1000,.05):0;previous=timestamp;if(!document.hidden){this.update(dt);this.renderer.render(this.scene,this.camera);}requestAnimationFrame(frame);};requestAnimationFrame(frame);}
}
function $(id){return document.getElementById(id);}
