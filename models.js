import * as THREE from './node_modules/three/build/three.module.js';
const materials=new Map();
export function material(color,extra={}){const key=color+JSON.stringify(extra);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.88,...extra}));return materials.get(key);}
const sphereGeo=new THREE.SphereGeometry(1,16,12),boxGeo=new THREE.BoxGeometry(1,1,1);
export function ellipsoid(parent,color,x,y,z,sx,sy,sz){const mesh=new THREE.Mesh(sphereGeo,material(color));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
export function box(parent,color,x,y,z,sx,sy,sz){const mesh=new THREE.Mesh(boxGeo,material(color));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
export function cylinder(parent,color,x,y,z,top,bottom,height,sides=12){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,sides),material(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function joint(parent,x,y,z){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function eye(parent,x,y,z,size=.09){const open=ellipsoid(parent,'#352b29',x,y,z,size,size*1.25,size*.6);const glint=ellipsoid(parent,'#fffced',x-size*.24,y+size*.36,z+size*.48,size*.29,size*.29,size*.2);return {open,glint};}
function flower(parent,x,y,z,color,size){const g=joint(parent,x,y,z);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipsoid(g,color,Math.cos(a)*size*.7,Math.sin(a)*size*.7,0,size*.65,size*.65,size*.26);}ellipsoid(g,'#f6d78a',0,0,.08,size*.38,size*.38,size*.22);return g;}
function humanoidLeg(parent,x){const hip=joint(parent,x,1.05,0);ellipsoid(hip,'#ffe2c4',0,-.26,0,.15,.34,.17);const knee=joint(hip,0,-.48,0);ellipsoid(knee,'#ffe2c4',0,-.2,0,.13,.27,.14);const foot=ellipsoid(knee,'#915f58',0,-.4,.12,.19,.14,.3);return {hip,knee,foot};}
export function buildGirl(){
  const root=new THREE.Group(),pose=new THREE.Group();root.add(pose);
  const legs=[humanoidLeg(pose,-.29),humanoidLeg(pose,.29)];
  cylinder(pose,'#ffebd0',0,1.25,0,.47,.87,1.16,24);cylinder(pose,'#edaaaa',0,2.05,0,.37,.49,.68,18);
  // A softly flared hanfu skirt, sash and crossed lapels are modeled surfaces.
  const trim=cylinder(pose,'#dfa8a2',0,.73,0,.87,.9,.1,24);trim.castShadow=false;
  const collarL=box(pose,'#fff0d6',-.1,2.33,.36,.13,.5,.06);collarL.rotation.z=-.58;
  const collarR=box(pose,'#fff0d6',.1,2.33,.36,.13,.5,.06);collarR.rotation.z=.58;
  box(pose,'#bd7385',0,1.79,.04,.93,.14,.76);ellipsoid(pose,'#d58392',.45,1.75,.39,.2,.15,.12);
  const ribbon=box(pose,'#dc8493',.5,1.38,.42,.14,.65,.06);ribbon.rotation.z=-.12;
  const arms=[];for(const side of [-1,1]){const shoulder=joint(pose,side*.46,2.3,0);const sleeve=cylinder(shoulder,'#edaaaa',0,-.34,0,.22,.31,.66,12);sleeve.rotation.z=side*.1;ellipsoid(shoulder,'#ffe2c4',side*.06,-.69,.03,.17,.18,.17);arms.push(shoulder);}
  const head=joint(pose,0,2.88,0);ellipsoid(head,'#ffe2c4',0,0,.04,.65,.66,.62);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.68,20,14,0,Math.PI*2,0,Math.PI*.52),material('#574037'));hair.position.y=.07;hair.castShadow=true;head.add(hair);
  ellipsoid(head,'#574037',0,.02,-.26,.67,.64,.41);
  for(let i=-2;i<=2;i++){const bang=ellipsoid(head,'#574037',i*.19,.35,.47,.19,.26,.14);bang.rotation.z=i*.13;}
  for(const side of [-1,1]){ellipsoid(head,'#574037',side*.62,.48,-.02,.29,.3,.3);flower(head,side*.66,.44,.25,'#efa4b3',.14);const tassel=box(head,'#e7a2b0',side*.64,.08,.17,.08,.47,.04);tassel.rotation.z=side*.12;ellipsoid(head,'#f49c9b',side*.4,-.14,.53,.15,.06,.035);eye(head,side*.23,.02,.59,.1);}
  const smile=new THREE.Mesh(new THREE.TorusGeometry(.095,.018,6,16,Math.PI),material('#bd7773'));smile.position.set(0,-.23,.641);smile.rotation.z=Math.PI;head.add(smile);
  root.userData.kind='girl';return {root,pose,head,legs,arms,type:'girl'};
}
function animalLeg(parent,x,z,color,length=.58){const hip=joint(parent,x,.7,z);ellipsoid(hip,color,0,-length*.4,0,.2,length*.5,.21);const foot=ellipsoid(hip,color,0,-length*.85,.11,.25,.13,.32);return {hip,foot};}
export function buildRabbit(){
  const root=new THREE.Group(),pose=new THREE.Group();root.add(pose);
  ellipsoid(pose,'#fff2d9',0,.72,-.05,.53,.58,.63);const head=joint(pose,0,1.22,.36);ellipsoid(head,'#fff3df',0,0,0,.51,.47,.46);
  const ears=[];for(const side of [-1,1]){const ear=joint(head,side*.27,.35,-.04);ellipsoid(ear,'#fff1da',0,.44,0,.16,.54,.14);ellipsoid(ear,'#edacae',0,.46,.112,.084,.37,.025);ears.push(ear);eye(head,side*.19,.02,.416,.065);ellipsoid(head,'#edacae',side*.32,-.1,.35,.11,.055,.026);}
  ellipsoid(head,'#d99b8d',0,-.075,.463,.057,.041,.026);ellipsoid(pose,'#f4ba97',0,1.02,.21,.53,.12,.38);const scarf=box(pose,'#eeb092',.4,.82,.33,.17,.5,.1);scarf.rotation.z=-.3;
  ellipsoid(pose,'#fff5e6',0,.7,-.64,.22,.23,.21);
  const legs=[animalLeg(pose,-.32,.24,'#fff1da',.48),animalLeg(pose,.32,.24,'#fff1da',.48),animalLeg(pose,-.34,-.36,'#fff1da',.52),animalLeg(pose,.34,-.36,'#fff1da',.52)];
  root.userData.kind='rabbit';return {root,pose,head,legs,ears,type:'rabbit'};
}
export function buildCapy(){
  const root=new THREE.Group(),pivot=joint(root,0,1,0),pose=joint(pivot,0,-1,0);
  ellipsoid(pose,'#cfa16d',0,1,-.26,.77,.69,1.12);ellipsoid(pose,'#dfb27e',0,1.08,.57,.66,.59,.74);
  const head=joint(pose,0,1.35,.91),eyes=[];ellipsoid(head,'#d8ae7c',0,0,0,.63,.57,.58);ellipsoid(head,'#c79766',0,-.17,.47,.48,.29,.34);
  for(const side of [-1,1]){ellipsoid(head,'#bc8c5e',side*.44,.44,-.06,.15,.18,.15);ellipsoid(head,'#d5a480',side*.44,.47,.05,.09,.1,.06);const eyeData=eye(head,side*.42,.06,.38,.074);const closed=new THREE.Mesh(new THREE.TorusGeometry(.078,.012,5,12,Math.PI),material('#755541'));closed.position.set(side*.42,.063,.425);closed.rotation.z=Math.PI;closed.visible=false;head.add(closed);eyes.push({...eyeData,closed});ellipsoid(head,'#f1b58f',side*.5,-.09,.3,.11,.065,.035);ellipsoid(head,'#7e5e45',side*.15,-.1,.75,.043,.031,.015);}
  const mouth=new THREE.Mesh(new THREE.TorusGeometry(.16,.018,6,16,Math.PI),material('#7e5e45'));mouth.position.set(0,-.26,.763);mouth.rotation.z=Math.PI;head.add(mouth);
  const orange=ellipsoid(head,'#f5a33e',.04,.71,-.015,.28,.27,.28);const leaf=ellipsoid(head,'#659455',.18,.97,-.02,.2,.045,.095);leaf.rotation.z=.3;cylinder(head,'#866444',.05,.97,-.02,.025,.03,.13,6);
  const legs=[animalLeg(pose,-.49,.6,'#b78a5b',.7),animalLeg(pose,.49,.6,'#b78a5b',.7),animalLeg(pose,-.5,-.91,'#b78a5b',.7),animalLeg(pose,.5,-.91,'#b78a5b',.7)];
  root.userData.kind='capy';return {root,pose,pivot,head,legs,orange,eyes,type:'capy'};
}
export function animateModel(model,phase,moving,time,petElapsed=-1,pettingGirl=false){
  const gait=moving?1:0;
  if(model.type==='girl'){
    for(let i=0;i<2;i++){const swing=Math.sin(phase+i*Math.PI)*.48*gait;model.legs[i].hip.rotation.x=swing;model.legs[i].knee.rotation.x=Math.max(0,-Math.sin(phase+i*Math.PI))*.52*gait;model.legs[i].foot.rotation.x=-swing*.3;model.arms[i].rotation.x=-swing*.62;}
    model.pose.position.y=moving?Math.abs(Math.sin(phase))* .06:Math.sin(time*2)*.017;model.pose.rotation.z=moving?Math.sin(phase)*.025:0;model.head.rotation.y=Math.sin(time*.7)*.04;
    if(pettingGirl){model.arms[1].rotation.x=-1.15+Math.sin(time*9)*.16;model.pose.rotation.x=.18;}else model.pose.rotation.x=0;
  }else{
    for(let i=0;i<4;i++)model.legs[i].hip.rotation.x=Math.sin(phase+(i===0||i===3?0:Math.PI))*(model.type==='capy'?.26:.45)*gait;
    if(model.type==='rabbit'){model.pose.position.y=moving?Math.max(0,Math.sin(phase))* .15:Math.sin(time*2.3)*.018;model.ears.forEach((e,i)=>e.rotation.x=Math.sin(time*3+i)*.06+(moving?Math.sin(phase)*.13:0));}
    else{for(const eye of model.eyes){eye.open.visible=petElapsed<0;eye.glint.visible=petElapsed<0;eye.closed.visible=petElapsed>=0;}model.pose.rotation.x=moving?Math.sin(phase)*.025:0;model.pivot.position.y=1;model.pivot.rotation.z=0;if(petElapsed>=0){const ease=Math.min(1,petElapsed/.8,(6.5-petElapsed)/.8);model.pivot.rotation.z=ease*(1.45+Math.sin(petElapsed*4)*.48);model.pivot.position.y=1+ease*.1;model.head.rotation.x=Math.sin(petElapsed*3)*.09;}else model.head.rotation.x=Math.sin(time*1.6)*.02;}
  }
}
