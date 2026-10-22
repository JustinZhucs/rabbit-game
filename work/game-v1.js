'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('world'), ctx = canvas.getContext('2d');
  const W = 2000, H = 1500, SAVE_KEY = new URLSearchParams(location.search).has('qa') ? 'taoxi-farm-qa-v1' : 'taoxi-farm-v1';
  const CATALOG = {
    vegetable: [
      {id:'carrot',name:'胡萝卜',icon:'🥕',time:45,cost:8,value:16,color:'#ed9449'},
      {id:'radish',name:'白萝卜',icon:'🥬',time:75,cost:12,value:24,color:'#eee5ca'},
      {id:'tomato',name:'小番茄',icon:'🍅',time:120,cost:18,value:36,color:'#dd6859'}],
    flower: [
      {id:'daisy',name:'小雏菊',icon:'🌼',time:60,cost:10,value:20,color:'#f4e5b7'},
      {id:'peony',name:'粉芍药',icon:'🌸',time:100,cost:16,value:32,color:'#e696ac'},
      {id:'tulip',name:'郁金香',icon:'🌷',time:150,cost:24,value:48,color:'#d983ad'}],
    fruit: [
      {id:'orange',name:'小橘子',icon:'🍊',time:90,cost:15,value:30,color:'#f4a849'},
      {id:'peach',name:'水蜜桃',icon:'🍑',time:150,cost:24,value:48,color:'#efa6a5'},
      {id:'pear',name:'雪梨',icon:'🍐',time:180,cost:30,value:60,color:'#d7ce7c'}],
    water: [
      {id:'lotus',name:'粉荷花',icon:'🪷',time:80,cost:12,value:24,color:'#efa5b7'},
      {id:'lily',name:'白睡莲',icon:'🌺',time:130,cost:20,value:40,color:'#fff1d3'},
      {id:'chestnut',name:'小菱角',icon:'🌱',time:160,cost:26,value:52,color:'#ab8970'}]
  };
  const KIND = {vegetable:'菜园',flower:'花园',fruit:'果园',water:'荷塘'};
  const SEEDS = Object.values(CATALOG).flat();
  const seedById = id => SEEDS.find(s => s.id === id);
  const initialPlots = [];
  for(let row=0;row<4;row++) for(let col=0;col<4;col++) initialPlots.push({id:`v${row}${col}`,kind:'vegetable',x:1085+(col-row)*64,y:805+(col+row)*35,seed:null,planted:0,watered:false});
  for(let row=0;row<3;row++) for(let col=0;col<2;col++) initialPlots.push({id:`f${row}${col}`,kind:'flower',x:755+(col-row)*64,y:745+(col+row)*35,seed:null,planted:0,watered:false});
  [{x:405,y:1060},{x:625,y:1180},{x:495,y:1145}].forEach((p,i)=>initialPlots.push({id:`o${i}`,kind:'fruit',...p,seed:null,planted:0,watered:false}));
  [{x:1590,y:685},{x:1740,y:795},{x:1650,y:890}].forEach((p,i)=>initialPlots.push({id:`w${i}`,kind:'water',...p,seed:null,planted:0,watered:false}));
  function defaultState(){
    const plots = initialPlots.map(p=>({...p}));
    plots[0].seed='carrot';plots[0].planted=Date.now()-45000;
    plots[5].seed='tomato';plots[5].planted=Date.now()-25000;
    plots[16].seed='peony';plots[16].planted=Date.now()-50000;
    return {coins:260,love:0,inventory:{},plots,harvests:0};
  }
  let state=defaultState(), storageAvailable=true;
  try{
    const saved=JSON.parse(localStorage.getItem(SAVE_KEY));
    if(saved && Number.isFinite(saved.coins) && saved.coins>=0 && Array.isArray(saved.plots)){
      state={...defaultState(),coins:saved.coins,love:Number(saved.love)||0,harvests:Number(saved.harvests)||0,inventory:{}};
      for(const s of SEEDS) if(Number.isFinite(saved.inventory?.[s.id])&&saved.inventory[s.id]>0) state.inventory[s.id]=Math.floor(saved.inventory[s.id]);
      state.plots=initialPlots.map(p=>{const old=saved.plots.find(o=>o.id===p.id);return old&&CATALOG[p.kind].some(s=>s.id===old.seed)&&Number.isFinite(old.planted)?{...p,seed:old.seed,planted:old.planted,watered:!!old.watered}:{...p};});
    }
  }catch{storageAvailable=false;}
  function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{if(storageAvailable)toast('浏览器暂时不能保存进度，请保持页面开启');storageAvailable=false;}updateHud();}
  const girl={x:1140,y:1100,path:[],moving:false,face:1};
  const rabbit={x:1070,y:1100,moving:false,face:1};
  const CAPY_SPAWNS=[{x:925,y:1080},{x:1270,y:1110},{x:790,y:980},{x:1090,y:650},{x:1310,y:950},{x:720,y:1070}];
  const capy={...CAPY_SPAWNS[Math.floor(Math.random()*CAPY_SPAWNS.length)],path:[],moving:false,face:1,petUntil:0,nextWalk:2+Math.random()*3};
  const camera={x:1070,y:840,zoom:1};
  let width=0,height=0,dpr=1,lastTime=0,clock=0,ready=false,lastGrowthRefresh=0;
  let hearts=[],ripples=[],petRewarded=false,activePlot=null,selectedCategory='vegetable',activeTab='',soundOn=false,audioContext=null,audioTimer=null;
  const bg=new Image(),sprites=new Image();bg.src='assets/farm-map.png';sprites.src='assets/characters.png';
  const imagesReady=Promise.all([bg,sprites].map(img=>new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;})));
  imagesReady.then(()=>{ready=true;$('loading').style.opacity='0';setTimeout(()=>$('loading').remove(),550);toast(state.plots.some(p=>p.seed&&progress(p)>=1)?'欢迎回家！有作物成熟啦，去看看吧':'欢迎回家！小桃和兔兔在等你');}).catch(()=>{$('loading').innerHTML='<h1>小院还没有打开</h1><p>图片未加载，请使用文件夹里的启动方式打开。</p>';});
  function resize(first=false){
    width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;
    if(first) camera.zoom=width<700?.76:Math.max(.48,Math.min(.88,width/2100,height/1450));
    clampCamera();
  }
  function clampCamera(){
    const hx=width/camera.zoom/2,hy=height/camera.zoom/2;
    camera.x=hx>W/2?W/2:Math.max(hx,Math.min(W-hx,camera.x));
    camera.y=hy>H/2?H/2:Math.max(hy,Math.min(H-hy,camera.y));
  }
  function toWorld(x,y){return {x:(x-width/2)/camera.zoom+camera.x,y:(y-height/2)/camera.zoom+camera.y};}
  function toScreen(x,y){return {x:(x-camera.x)*camera.zoom+width/2,y:(y-camera.y)*camera.zoom+height/2};}
  function setZoom(z,screenX=width/2,screenY=height/2){const p=toWorld(screenX,screenY);camera.zoom=Math.max(.38,Math.min(1.5,z));const after=toWorld(screenX,screenY);camera.x+=p.x-after.x;camera.y+=p.y-after.y;clampCamera();}
  function focus(x,y){camera.x=x;camera.y=y;clampCamera();updateLocation();}
  const CELL=32,COLS=Math.ceil(W/CELL),ROWS=Math.ceil(H/CELL);
  // Navigable lawn and paths. Buildings, lake, trees and mountain boundary are solid.
  function isWalkable(x,y){
    if(x<280||x>1770||y<355||y>1390)return false;
    if(x<920&&y<625)return false;
    if(y<400)return false;
    if(x>1280&&y<575)return false;
    if(x>1370&&y<1005&&((x-1640)/300)**2+((y-775)/275)**2<1)return false;
    if(x<615&&y>925&&y<1260)return false;
    if(x>1710&&y>1100)return false;
    return true;
  }
  function nearestCell(p){
    const cx=Math.max(0,Math.min(COLS-1,Math.floor(p.x/CELL))),cy=Math.max(0,Math.min(ROWS-1,Math.floor(p.y/CELL)));
    if(isWalkable((cx+.5)*CELL,(cy+.5)*CELL))return {x:cx,y:cy};
    for(let radius=1;radius<35;radius++){
      let best=null,dist=Infinity;
      for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
        const x=cx+dx,y=cy+dy;
        if(x<0||x>=COLS||y<0||y>=ROWS||!isWalkable((x+.5)*CELL,(y+.5)*CELL))continue;
        const d=Math.hypot((x+.5)*CELL-p.x,(y+.5)*CELL-p.y);if(d<dist){best={x,y};dist=d;}
      }
      if(best)return best;
    }
    return null;
  }
  function pathTo(from,target){
    const start=nearestCell(from),end=nearestCell(target);if(!start||!end)return [];
    const key=p=>p.y*COLS+p.x,startKey=key(start),endKey=key(end),open=[startKey],came=new Map(),score=new Map([[startKey,0]]),closed=new Set();
    const heuristic=id=>Math.hypot(id%COLS-end.x,Math.floor(id/COLS)-end.y);
    let found=false,iterations=0;
    while(open.length&&iterations++<3500){
      let best=0;for(let i=1;i<open.length;i++)if((score.get(open[i])+heuristic(open[i]))<(score.get(open[best])+heuristic(open[best])))best=i;
      const current=open.splice(best,1)[0];if(current===endKey){found=true;break;}closed.add(current);
      const x=current%COLS,y=Math.floor(current/COLS);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const nx=x+dx,ny=y+dy,id=ny*COLS+nx;if(nx<0||nx>=COLS||ny<0||ny>=ROWS||closed.has(id)||!isWalkable((nx+.5)*CELL,(ny+.5)*CELL))continue;
        if(dx&&dy&&(!isWalkable((x+dx+.5)*CELL,(y+.5)*CELL)||!isWalkable((x+.5)*CELL,(y+dy+.5)*CELL)))continue;
        const g=score.get(current)+(dx&&dy?Math.SQRT2:1);if(g<(score.get(id)??Infinity)){came.set(id,current);score.set(id,g);if(!open.includes(id))open.push(id);}
      }
    }
    if(!found)return [];
    const points=[];let id=endKey;while(id!==startKey){points.unshift({x:(id%COLS+.5)*CELL,y:(Math.floor(id/COLS)+.5)*CELL});id=came.get(id);if(id===undefined)return [];}
    if(isWalkable(target.x,target.y))points.push(target);
    else if(!points.length)points.push({x:(end.x+.5)*CELL,y:(end.y+.5)*CELL});
    return points;
  }
  function moveGirl(p){girl.path=pathTo(girl,p);const destination=girl.path.at(-1);if(destination)ripples.push({...destination,t:0});}
  function moveActor(actor,dt,speed){
    actor.moving=actor.path.length>0;if(!actor.moving)return;
    let budget=dt*speed;
    while(actor.path.length&&budget>0){const goal=actor.path[0],dx=goal.x-actor.x,dy=goal.y-actor.y,dist=Math.hypot(dx,dy);if(Math.abs(dx)>.5)actor.face=dx<0?-1:1;if(dist<=budget){actor.x=goal.x;actor.y=goal.y;actor.path.shift();budget-=dist;}else{actor.x+=dx/dist*budget;actor.y+=dy/dist*budget;budget=0;}}
  }
  function progress(plot){if(!plot.seed)return 0;return Math.min(1,Math.max(0,(Date.now()-plot.planted)/(seedById(plot.seed).time*1000)));}
  function secondsLeft(plot){return Math.max(0,Math.ceil((seedById(plot.seed).time*1000-(Date.now()-plot.planted))/1000));}
  function duration(s){return s<60?`${s}秒`:`${Math.floor(s/60)}分${s%60?s%60+'秒':''}`;}
  function updateHud(){$('coins').textContent=state.coins;$('love').textContent=state.love;$('bagDot').hidden=!Object.values(state.inventory).some(n=>n>0);}
  let toastTimer;
  function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3300);}
  let previousFocus=null;
  function openSheet(title,eyebrow,content,tab){previousFocus=document.activeElement;activeTab=tab;$('sheetTitle').textContent=title;$('sheetEyebrow').textContent=eyebrow;$('sheetContent').innerHTML=content;$('modalBackdrop').hidden=false;requestAnimationFrame(()=>$('closeSheet').focus());}
  function closeSheet(){$('modalBackdrop').hidden=true;activePlot=null;activeTab='';previousFocus?.focus?.();}
  $('closeSheet').onclick=closeSheet;
  $('modalBackdrop').onclick=e=>{if(e.target===$('modalBackdrop'))closeSheet();};
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')closeSheet();
    if(!$('modalBackdrop').hidden){
      if(e.key==='Tab'){const focusables=[...$('modalBackdrop').querySelectorAll('button:not([disabled]),[tabindex="0"]')];const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;
    }
    if(document.activeElement!==canvas)return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();moveGirl({x:girl.x+(e.key==='ArrowRight'?96:e.key==='ArrowLeft'?-96:0),y:girl.y+(e.key==='ArrowDown'?96:e.key==='ArrowUp'?-96:0)});}
    if(e.key==='+'||e.key==='=')setZoom(camera.zoom*1.12);if(e.key==='-')setZoom(camera.zoom/1.12);
  });
  function seedCards(kind){return CATALOG[kind].map(s=>`<button class="seed-card" data-seed="${s.id}" ${state.coins<s.cost?'disabled':''}><span class="seed-art">${s.icon}</span><strong>${s.name}</strong><small>${duration(s.time)}长成 · 收获 2 份</small><span class="cost">◎ ${s.cost} 种子钱</span></button>`).join('');}
  function showSeeds(kind='vegetable',plot=null){
    selectedCategory=kind;activePlot=plot;
    const tabs=plot?'':`<div class="tabs">${Object.keys(KIND).map(k=>`<button data-kind="${k}" class="${k===kind?'active':''}">${KIND[k]}</button>`).join('')}</div>`;
    openSheet(plot?'给这片小地种点什么':'春日种子铺',`${KIND[kind]} · ${plot?'一颗种子，一点期待':'挑一颗喜欢的种子'}`,`${tabs}<div class="seed-grid">${seedCards(kind)}</div><p class="subtle">${plot?'种好后可浇一次水，让它提前 20% 长成。':'选好种子后，会种进对应区域的第一块空地。'}</p>`,'seeds');
    $('sheetContent').querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>showSeeds(b.dataset.kind));
    $('sheetContent').querySelectorAll('[data-seed]').forEach(b=>b.onclick=()=>plant(b.dataset.seed,plot));
  }
  function plant(id,plot){
    const seed=seedById(id),kind=Object.keys(CATALOG).find(k=>CATALOG[k].includes(seed));
    plot=plot||state.plots.find(p=>p.kind===kind&&!p.seed);
    if(!plot){toast(`${KIND[kind]}暂时种满啦，收获后再来吧`);return;}
    if(plot.seed){toast('这片小地已经种上了');return;}
    if(state.coins<seed.cost){toast('种子钱不够啦，可以把收获放进集市');return;}
    state.coins-=seed.cost;plot.seed=id;plot.planted=Date.now();plot.watered=false;save();closeSheet();focus(plot.x,plot.y);moveGirl({x:plot.x+45,y:plot.y+35});chime();toast(`${seed.icon} ${seed.name}种好了，${duration(seed.time)}后长成`);
  }
  function showPlot(plot){
    activePlot=plot;moveGirl({x:plot.x+55,y:plot.y+42});
    if(!plot.seed){showSeeds(plot.kind,plot);return;}
    const seed=seedById(plot.seed),p=progress(plot);
    openSheet(seed.name,`${KIND[plot.kind]} · ${p>=1?'可以收获了':'正在慢慢长大'}`,`<div class="crop-detail"><span class="big-emoji">${seed.icon}</span><p>${p>=1?'长得刚刚好，带回小竹篮吧。':'风轻轻吹，它正在努力长大。'}</p><div class="progress"><span id="growthBar" style="width:${p*100}%"></span></div><small id="growthTime">${p>=1?'已经成熟':'还要 '+duration(secondsLeft(plot))}</small><button id="harvestCrop" class="primary" ${p<1?'disabled':''}>收获到小竹篮 · 2 份</button>${p<1?`<button id="waterCrop" class="secondary" ${plot.watered?'disabled':''}>${plot.watered?'已经喝过水啦':'给它浇浇水 · 提前 20% 长成'}</button>`:''}</div>`,'crop');
    $('harvestCrop').onclick=()=>harvest(plot);
    if($('waterCrop'))$('waterCrop').onclick=()=>{if(plot.watered||progress(plot)>=1)return;plot.watered=true;plot.planted-=seed.time*200;save();chime();toast('喝过水啦！成长时间缩短了一些');showPlot(plot);};
  }
  function harvest(plot){if(!plot.seed||progress(plot)<1)return;const s=seedById(plot.seed);state.inventory[s.id]=(state.inventory[s.id]||0)+2;state.harvests++;state.love++;plot.seed=null;plot.planted=0;plot.watered=false;save();closeSheet();chime();heartBurst(plot.x,plot.y-25,4);toast(`${s.icon} 收获了 2 份${s.name}！小竹篮里可以换种子钱`);}
  function showBag(){
    const items=SEEDS.filter(s=>(state.inventory[s.id]||0)>0),total=items.reduce((sum,s)=>sum+state.inventory[s.id]*s.value,0);
    openSheet('我的小竹篮','把春天，一点点装起来',items.length?`${items.map(s=>`<div class="bag-row"><span>${s.icon}</span><div><strong>${s.name}</strong><small>每份可换 ◎ ${s.value}</small></div><b>× ${state.inventory[s.id]}</b></div>`).join('')}<button id="sellAll" class="primary">送去集市 · 换 ◎ ${total}</button><p class="subtle">收获留在竹篮里，也会保存下来。</p>`:'<div class="empty-bag"><span>🧺</span><p>竹篮还空着。<br>去看看菜园，胡萝卜长大了吗？</p></div>','bag');
    if($('sellAll'))$('sellAll').onclick=()=>{state.coins+=total;state.inventory={};save();chime();showBag();toast(`集市收下了你的收获，得到 ◎ ${total}`);};
  }
  function showMap(){
    const regions=[['courtyard','🏡','青瓦小院','小桃与兔兔的家',1030,595],['flower','🌸','春日花园','雏菊、芍药与郁金香',720,790],['vegetable','🥕','小院菜园','把日子种进泥土里',1085,920],['water','🪷','一池荷香','荷花、睡莲与小菱角',1600,810],['fruit','🍊','甜甜果园','橘子、蜜桃与雪梨',580,1110],['capy','♥','偶遇橘子君','去看看它在哪里',capy.x,capy.y]];
    openSheet('逛一逛小院','院子很大，日子很慢',`<img class="map-preview" src="assets/farm-map.png" alt="小院全景"><div class="region-grid">${regions.map(([id,icon,name,desc])=>`<button data-region="${id}"><span>${icon}</span><strong>${name}</strong><small>${desc}</small></button>`).join('')}</div><p class="subtle">也可以直接拖动地图探索，双指捏合调整远近。</p>`,'map');
    $('sheetContent').querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{const r=regions.find(r=>r[0]===b.dataset.region);closeSheet();focus(r[4],r[5]);if(r[0]==='capy')toast('找到橘子君啦，点点它，给它挠挠痒');});
  }
  function showHelp(){openSheet('在小院，慢慢玩','欢迎来到桃溪小院',`<div class="help-row"><span>☝</span><p>拖动地图逛小院，点空地让小桃走过去。兔兔会跟着她。</p></div><div class="help-row"><span>♧</span><p>点空地块挑种子，或从「播种」开始。菜园、花园、果园、荷塘各有 3 种选择。</p></div><div class="help-row"><span>◷</span><p>作物有自己的生长周期，浇水可加快一次。第一版为 45 秒～3 分钟。</p></div><div class="help-row"><span>🧺</span><p>成熟后点作物收获，再到小竹篮送去集市，用赚到的种子钱继续播种。</p></div><div class="help-row"><span>🍊</span><p>橘子君每次打开都会出现在不同的地方。点它挠痒痒，看看舒服的翻滚。</p></div><div class="help-row"><span>⌘</span><p>「逛小院」可以快速找到各个区域。双指捏合或用 ＋ / − 缩放地图。</p></div><footer>${storageAvailable?'小院进度自动保存在这个浏览器里。':'当前浏览器无法保存，请保持页面开启。'}</footer>`,'help');}
  $('plantButton').onclick=()=>showSeeds(selectedCategory);
  $('bagButton').onclick=showBag;$('mapButton').onclick=showMap;$('helpButton').onclick=showHelp;
  $('dismissNote').onclick=()=>$('welcomeNote').remove();
  $('zoomIn').onclick=()=>setZoom(camera.zoom*1.17);$('zoomOut').onclick=()=>setZoom(camera.zoom/1.17);$('homeButton').onclick=()=>focus(girl.x,girl.y);
  function chime(){if(!soundOn||!audioContext)return;const now=audioContext.currentTime;[523.25,659.25,783.99].forEach((f,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=f;o.connect(g);g.connect(audioContext.destination);g.gain.setValueAtTime(0,now+i*.1);g.gain.linearRampToValueAtTime(.045,now+i*.1+.015);g.gain.exponentialRampToValueAtTime(.001,now+i*.1+.7);o.start(now+i*.1);o.stop(now+i*.1+.8);});}
  function ambient(){if(!soundOn||document.hidden)return;const freqs=[261.63,293.66,329.63,392,440,523.25];const o=audioContext.createOscillator(),g=audioContext.createGain(),now=audioContext.currentTime;o.type='sine';o.frequency.value=freqs[Math.floor(Math.random()*freqs.length)];o.connect(g);g.connect(audioContext.destination);g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(.024,now+.1);g.gain.exponentialRampToValueAtTime(.001,now+2.5);o.start();o.stop(now+3);}
  $('soundButton').onclick=async()=>{try{audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();await audioContext.resume();soundOn=!soundOn;$('soundButton').setAttribute('aria-pressed',soundOn);$('soundLabel').textContent=soundOn?'静一静':'听风';$('soundIcon').style.color=soundOn?'#d98788':'';clearInterval(audioTimer);if(soundOn){chime();audioTimer=setInterval(ambient,3300);}else await audioContext.suspend();}catch{toast('这个浏览器暂时无法播放声音');}};
  function heartBurst(x,y,count=8){for(let i=0;i<count;i++)hearts.push({x:x+(Math.random()-.5)*55,y:y+(Math.random()-.5)*20,vx:(Math.random()-.5)*20,vy:-24-Math.random()*20,life:1.8+Math.random(),age:0,size:14+Math.random()*12});}
  function petCapy(){
    if(clock<capy.petUntil){heartBurst(capy.x,capy.y-50,3);toast('呼噜呼噜…再挠一挠，好舒服呀');return;}
    capy.path=[];capy.moving=false;capy.petUntil=clock+6.5;capy.nextWalk=clock+8.5;petRewarded=false;moveGirl({x:capy.x-100,y:capy.y+30});heartBurst(capy.x,capy.y-50);chime();toast('给橘子君挠挠痒…它舒服得打起了滚 ♥');
  }
  const pointers=new Map();let gesture=null;
  canvas.addEventListener('pointerdown',e=>{
    canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===1)gesture={startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,multi:false};
    else if(pointers.size===2){gesture.multi=true;gesture.moved=true;const [a,b]=[...pointers.values()];gesture.distance=Math.hypot(a.x-b.x,a.y-b.y);gesture.mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)||!gesture)return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};setZoom(camera.zoom*d/Math.max(1,gesture.distance),mid.x,mid.y);camera.x-=(mid.x-gesture.mid.x)/camera.zoom;camera.y-=(mid.y-gesture.mid.y)/camera.zoom;gesture.distance=d;gesture.mid=mid;clampCamera();}
    else{if(Math.hypot(e.clientX-gesture.startX,e.clientY-gesture.startY)>7)gesture.moved=true;if(gesture.moved){camera.x-=(e.clientX-gesture.lastX)/camera.zoom;camera.y-=(e.clientY-gesture.lastY)/camera.zoom;clampCamera();}gesture.lastX=e.clientX;gesture.lastY=e.clientY;}
    updateLocation();
  });
  canvas.addEventListener('pointerup',e=>{if(!pointers.has(e.pointerId))return;const tap=gesture&&!gesture.moved&&!gesture.multi;pointers.delete(e.pointerId);if(tap&&ready)handleTap(toWorld(e.clientX,e.clientY));if(pointers.size===1){const p=[...pointers.values()][0];gesture={startX:p.x,startY:p.y,lastX:p.x,lastY:p.y,moved:true,multi:true};}if(!pointers.size)gesture=null;});
  canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);if(!pointers.size)gesture=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(camera.zoom*Math.exp(-e.deltaY*.001),e.clientX,e.clientY);},{passive:false});
  function handleTap(p){
    const hit=Math.max(1,0.76/camera.zoom);
    if(Math.abs(p.x-capy.x)<76*hit&&p.y>capy.y-100*hit&&p.y<capy.y+20*hit){petCapy();return;}
    if(Math.abs(p.x-rabbit.x)<32*hit&&Math.abs(p.y-rabbit.y+30)<38*hit){heartBurst(rabbit.x,rabbit.y-35,3);toast('兔兔蹦了蹦：今天也要好好种菜呀！');return;}
    const plot=[...state.plots].reverse().find(q=>q.kind==='vegetable'||q.kind==='flower'?Math.abs(p.x-q.x)/53+Math.abs(p.y-q.y)/29<1.15:q.kind==='water'?Math.hypot(p.x-q.x,p.y-q.y)<42*hit:Math.hypot(p.x-q.x,p.y-q.y)<46*hit);
    if(plot){showPlot(plot);return;}
    moveGirl(p);$('guide').style.opacity='0';
  }
  function updateLocation(){const x=camera.x,y=camera.y;$('location').textContent=x>1410?'一池荷香':x<690&&y>950?'甜甜果园':y<650?'青瓦小院':x<850?'春日花园':'小院菜园';}
  function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
  function diamond(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-ry);ctx.lineTo(x+rx,y);ctx.lineTo(x,y+ry);ctx.lineTo(x-rx,y);ctx.closePath();ctx.fill();}
  function roundedRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function badge(x,y,text,color='#fffaf1',ink='#61744f',fontSize=15){const scale=fontSize>=15?1/camera.zoom:Math.max(1,.85/camera.zoom);ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);x=0;y=0;ctx.font=`500 ${fontSize}px "PingFang SC",sans-serif`;const tw=ctx.measureText(text).width;ctx.fillStyle='#31503918';roundedRect(x-tw/2-12,y+2,tw+24,27,12);ctx.fill();ctx.fillStyle=color;roundedRect(x-tw/2-12,y,tw+24,27,12);ctx.fill();ctx.fillStyle=ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y+14);ctx.restore();}
  function drawPlot(plot){
    const p=progress(plot),seed=seedById(plot.seed);
    if(plot.kind==='vegetable'||plot.kind==='flower'){
      diamond(plot.x,plot.y+5,53,29,'#6a593a34');diamond(plot.x,plot.y+3,50,26,'#9c7855');diamond(plot.x,plot.y,50,26,plot.kind==='flower'?'#b68b66':'#ae845d');
      ctx.strokeStyle='#d2aa7e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(plot.x-49,plot.y);ctx.lineTo(plot.x,plot.y-25);ctx.lineTo(plot.x+49,plot.y);ctx.stroke();
      if(!seed){ctx.fillStyle='#fff4d175';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='24px sans-serif';ctx.fillText('+',plot.x,plot.y-1);return;}
      const spots=[[-19,-1],[0,-10],[20,0],[0,11]];
      for(const [dx,dy]of spots){const x=plot.x+dx,y=plot.y+dy;const s=.35+p*.65;ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.strokeStyle='#5e8650';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,2);ctx.lineTo(0,-20-5*p);ctx.stroke();ellipse(-6,-15,7,3.5,'#83a661');ellipse(6,-19,7,3.5,'#688f4e');
        if(p>.35){if(plot.kind==='flower'){const size=4+p*6;for(let a=0;a<5;a++){const angle=a*Math.PI*2/5;ellipse(Math.cos(angle)*size*.65,-28+Math.sin(angle)*size*.65,size*.75,size*.75,seed.color);}ellipse(0,-28,3,3,'#d3b65b');}else if(seed.id==='carrot'){ctx.fillStyle=seed.color;ctx.beginPath();ctx.moveTo(-5,-3);ctx.quadraticCurveTo(-8,2,0,9);ctx.quadraticCurveTo(8,2,5,-3);ctx.fill();}else if(seed.id==='tomato'){ellipse(-6,-12,5+p*2,5+p*2,seed.color);ellipse(7,-22,5+p*2,5+p*2,seed.color);}else{ellipse(0,1,6,9,seed.color);}}ctx.restore();}
    }else if(plot.kind==='water'){
      ellipse(plot.x,plot.y+3,40,19,'#ffffff29');ctx.strokeStyle='#d9edbe98';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.ellipse(plot.x,plot.y,39,18,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      if(seed){ellipse(plot.x-10,plot.y,22,10,'#7ca95b');ellipse(plot.x+15,plot.y+6,17,8,'#91b973');if(p>.4){ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${28+p*16}px serif`;ctx.fillText(seed.icon,plot.x,plot.y-12);}}
      else{ctx.font='23px sans-serif';ctx.fillStyle='#fbffe6cc';ctx.textAlign='center';ctx.fillText('+',plot.x,plot.y+5);}
    }else{
      ellipse(plot.x,plot.y+4,41,18,'#e9eee0d0');ctx.strokeStyle='#86a065';ctx.setLineDash([4,5]);ctx.lineWidth=1.8;ctx.beginPath();ctx.ellipse(plot.x,plot.y,40,17,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=seed?'33px serif':'24px serif';ctx.fillStyle='#6b8854';ctx.fillText(seed?(p>.4?seed.icon:'🌱'):'+',plot.x,plot.y-8);
    }
    if(seed){if(p>=1){badge(plot.x,plot.y-62,'✓','#fff8df','#94804d',12);}else{ctx.fillStyle='#fffaf1ca';roundedRect(plot.x-21,plot.y+26,42,5,3);ctx.fill();ctx.fillStyle='#88a962';roundedRect(plot.x-21,plot.y+26,Math.max(3,42*p),5,3);ctx.fill();}}
  }
  function drawActor(actor,type){
    const row=type==='girl'?0:type==='rabbit'?1:2;
    let col=actor.moving?(actor.face<0?1:2):0;
    let sw=418,sy=row===0?0:row===1?455:865,sh=row===0?445:row===1?378:370;
    let dw=type==='girl'?110:type==='rabbit'?79:132,dh=dw*sh/sw;
    const pet=type==='capy'&&clock<capy.petUntil;if(type==='capy')col=pet?2:actor.moving?1:0;
    const hop=actor.moving?(type==='rabbit'?Math.abs(Math.sin(clock*10))*8:Math.sin(clock*12)*2):0;
    ellipse(actor.x,actor.y+1,type==='girl'?22:type==='rabbit'?23:40,8,'#2f493229');
    ctx.save();ctx.translate(actor.x,actor.y-hop);
    if(type==='capy'&&actor.face<0&&!pet)ctx.scale(-1,1);
    if(pet){const t=6.5-(capy.petUntil-clock),roll=t<.6?t/.6: t>5.8?(6.5-t)/.7:1;ctx.translate(0,-dh*.32);ctx.rotate(Math.sin(t*4.3)*.44*roll);ctx.translate(0,dh*.32);}
    ctx.drawImage(sprites,col*418,sy,sw,sh,-dw/2,-dh+10,dw,dh);ctx.restore();
    if(type==='girl')badge(actor.x,actor.y-dh-20,'小桃','#fffaf1e8','#866d67',12);
    if(type==='capy'){if(pet){badge(actor.x,actor.y-dh-20,'呼噜呼噜…','#fff1ed','#b7837d',13);}else badge(actor.x,actor.y-dh-14,'挠挠我 ♥','#fff7e8','#b18b59',12);}
  }
  function draw(){
    if(new URLSearchParams(location.search).has('qa')) { canvas.dataset.camera=JSON.stringify(camera); canvas.dataset.capy=JSON.stringify({x:capy.x,y:capy.y,petting:clock<capy.petUntil,moving:capy.moving}); canvas.dataset.girl=JSON.stringify({x:girl.x,y:girl.y,moving:girl.moving}); }
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#d1e0cd';ctx.fillRect(0,0,width,height);
    if(!ready)return;
    ctx.translate(width/2,height/2);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-camera.x,-camera.y);ctx.drawImage(bg,0,0,W,H);
    for(const ripple of ripples){ctx.strokeStyle=`rgba(255,251,221,${Math.max(0,1-ripple.t)})`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(ripple.x,ripple.y,12+ripple.t*20,5+ripple.t*10,0,0,Math.PI*2);ctx.stroke();}
    badge(1100,688,'小院菜园','#fff9ebf0','#758153');badge(690,642,'春日花园','#fff3eff0','#a98586');badge(492,1002,'甜甜果园','#fff9eaf0','#a0844d');badge(1650,596,'一池荷香','#f0faeff0','#648c79');
    const entities=state.plots.map(p=>({y:p.y,draw:()=>drawPlot(p)})).concat([{y:girl.y,draw:()=>drawActor(girl,'girl')},{y:rabbit.y,draw:()=>drawActor(rabbit,'rabbit')},{y:capy.y,draw:()=>drawActor(capy,'capy')}]);
    entities.sort((a,b)=>a.y-b.y);for(const entity of entities)entity.draw();
    for(const h of hearts){ctx.globalAlpha=Math.max(0,1-h.age/h.life);ctx.font=`${h.size}px serif`;ctx.fillStyle='#e58a99';ctx.textAlign='center';ctx.fillText('♥',h.x,h.y);}ctx.globalAlpha=1;
    // A few peach petals, drifting over the lawn.
    for(let i=0;i<12;i++){const x=360+((i*137+clock*12)%1230),y=425+((i*79+clock*7)%800);ctx.save();ctx.translate(x,y);ctx.rotate(clock*.7+i);ellipse(0,0,4,2,'#f2b7bfab');ctx.restore();}
  }
  function update(dt){
    clock+=dt;moveActor(girl,dt,140);
    const rdx=girl.x-rabbit.x-45,rdy=girl.y-rabbit.y+16,rd=Math.hypot(rdx,rdy);rabbit.moving=rd>14;
    if(rabbit.moving){const travel=Math.min(rd,dt*165),next={x:rabbit.x+rdx/rd*travel,y:rabbit.y+rdy/rd*travel};if(isWalkable(next.x,next.y)){rabbit.x=next.x;rabbit.y=next.y;}else{const route=pathTo(rabbit,{x:girl.x-35,y:girl.y+25});if(route.length){rabbit.path=route;moveActor(rabbit,dt,160);}}rabbit.face=rdx<0?-1:1;}
    if(clock>=capy.petUntil){
      if(capy.petUntil&&!petRewarded){petRewarded=true;state.love+=3;save();toast('橘子君心满意足，继续逛小院啦 · ♥ +3');}
      if(clock>capy.nextWalk&&!capy.path.length){let destination;for(let i=0;i<30;i++){const candidate={x:capy.x+(Math.random()-.5)*400,y:capy.y+(Math.random()-.5)*260};if(isWalkable(candidate.x,candidate.y)){destination=candidate;break;}}if(destination)capy.path=pathTo(capy,destination);capy.nextWalk=clock+5+Math.random()*8;}
      moveActor(capy,dt,38);
    }else{capy.moving=false;if(Math.random()<dt*1.7)heartBurst(capy.x,capy.y-52,1);}
    hearts.forEach(h=>{h.age+=dt;h.x+=h.vx*dt;h.y+=h.vy*dt;});hearts=hearts.filter(h=>h.age<h.life);
    ripples.forEach(r=>r.t+=dt);ripples=ripples.filter(r=>r.t<1);
    if(clock-lastGrowthRefresh>.5){lastGrowthRefresh=clock;if(activeTab==='crop'&&activePlot?.seed){const p=progress(activePlot);if($('growthBar'))$('growthBar').style.width=p*100+'%';if($('growthTime'))$('growthTime').textContent=p>=1?'已经成熟':'还要 '+duration(secondsLeft(activePlot));if($('harvestCrop'))$('harvestCrop').disabled=p<1;if(p>=1&&$('waterCrop'))$('waterCrop').disabled=true;}}
  }
  function frame(t){const dt=lastTime?Math.min((t-lastTime)/1000,.05):0;lastTime=t;if(ready)update(dt);draw();requestAnimationFrame(frame);}
  addEventListener('resize',()=>resize());addEventListener('pagehide',save);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save();else lastTime=0;});
  resize(true);updateHud();requestAnimationFrame(frame);
  // Read-only hooks for local acceptance checks, never used for game progression.
  window.Taoxi={snapshot:()=>({state:JSON.parse(JSON.stringify(state)),girl:{x:girl.x,y:girl.y,moving:girl.moving},rabbit:{x:rabbit.x,y:rabbit.y},capy:{x:capy.x,y:capy.y,petting:clock<capy.petUntil,moving:capy.moving},camera:{...camera},ready}),toScreen:(x,y)=>toScreen(x,y),isWalkable};
})();
