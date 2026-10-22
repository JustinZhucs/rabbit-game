import {FarmWorld} from './scene3d.js';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('world');
  const SAVE_KEY = new URLSearchParams(location.search).has('qa') ? 'taoxi-farm-qa-v1' : 'taoxi-farm-v1';
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
  for(let row=0;row<4;row++) for(let col=0;col<4;col++) initialPlots.push({id:`v${row}${col}`,kind:'vegetable',x:-9+col*6,y:row*6,seed:null,planted:0,watered:false});
  for(let row=0;row<3;row++) for(let col=0;col<2;col++) initialPlots.push({id:`f${row}${col}`,kind:'flower',x:-35+col*6,y:row*6,seed:null,planted:0,watered:false});
  [{x:-38,y:23},{x:-29,y:30},{x:-18,y:26.5}].forEach((p,i)=>initialPlots.push({id:`o${i}`,kind:'fruit',...p,seed:null,planted:0,watered:false}));
  [{x:26,y:-3},{x:35,y:-2},{x:39,y:-18}].forEach((p,i)=>initialPlots.push({id:`w${i}`,kind:'water',...p,seed:null,planted:0,watered:false}));
  function defaultState(){
    const plots = initialPlots.map(p=>({...p}));
    plots[0].seed='carrot';plots[0].planted=Date.now()-45000;
    plots[5].seed='tomato';plots[5].planted=Date.now()-25000;
    plots[16].seed='peony';plots[16].planted=Date.now()-50000;
    return {coins:260,love:0,inventory:{},plots,harvests:0,gateOpen:false};
  }
  let state=defaultState(), storageAvailable=true;
  try{
    const saved=JSON.parse(localStorage.getItem(SAVE_KEY));
    if(saved && Number.isFinite(saved.coins) && saved.coins>=0 && Array.isArray(saved.plots)){
      state={...defaultState(),coins:saved.coins,love:Number(saved.love)||0,harvests:Number(saved.harvests)||0,inventory:{},gateOpen:!!saved.gateOpen};
      for(const s of SEEDS) if(Number.isFinite(saved.inventory?.[s.id])&&saved.inventory[s.id]>0) state.inventory[s.id]=Math.floor(saved.inventory[s.id]);
      state.plots=initialPlots.map(p=>{const old=saved.plots.find(o=>o.id===p.id);return old&&CATALOG[p.kind].some(s=>s.id===old.seed)&&Number.isFinite(old.planted)?{...p,seed:old.seed,planted:old.planted,watered:!!old.watered}:{...p};});
    }
  }catch{storageAvailable=false;}
  function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{if(storageAvailable)toast('浏览器暂时不能保存进度，请保持页面开启');storageAvailable=false;}updateHud();}

  let activePlot=null,selectedCategory='vegetable',activeTab='',soundOn=false,audioContext=null,audioTimer=null;
  let world;
  try {
    world=new FarmWorld(canvas,{gateOpen:state.gateOpen,onPlot:id=>showPlot(state.plots.find(p=>p.id===id)),onGate:open=>toggleGate(open),onCapy:petCapy,onRabbit:()=>{world.hearts(world.rabbit.x,world.rabbit.z,3);toast('兔兔蹦了蹦：石头路上，慢慢走呀！');},onPetEnd:()=>{state.love+=3;save();toast('橘子君心满意足，继续沿路逛小院啦 · ♥ +3');},onBlockedGate:()=>toast('院门还关着，点「开门」后可以走进去'),onMove:()=>{$('guide').style.opacity='0';},onTick:updateGrowth,onLocation:updateLocation});
    world.addPlots(state.plots,seedById);
    $('loading').style.opacity='0';setTimeout(()=>$('loading').remove(),550);
  } catch(error) {
    console.error(error);$('loading').innerHTML='<h1>小院还没有打开</h1><p>请使用本地试玩链接，并在支持 WebGL 的浏览器中打开。</p>';throw error;
  }
  const girl=world.girl;
  function focus(x,z){world.focus(x,z);updateLocation(x,z);}
  function moveGirl(p){world.moveGirl({x:p.x,z:p.y},true);}
  function toggleGate(open){
    if(!world.toggleGate(open)){toast('有人正在穿过院门，等走过去再关门吧');return false;}
    state.gateOpen=world.gateOpen;save();chime();toast(world.gateOpen?'院门打开啦，点院里的石头路可以进去':'院门轻轻关上了');return true;
  }
  function showGate(){
    focus(-24,-8);
    openSheet('小院的木门','推开门，就是家',`<p>${world.gateOpen?'院门开着，风也轻轻走进来。':'院门关着，推开后就能走进庭院。'}</p><button id="toggleYardGate" class="primary">${world.gateOpen?'关上院门':'打开院门'}</button><button id="enterYardNow" class="secondary">沿路走进小院</button>`,'gate');
    $('toggleYardGate').onclick=()=>{toggleGate();showGate();};$('enterYardNow').onclick=()=>{closeSheet();world.enterYard();};
  }
  function heartBurst(x,z,count=8){world.hearts(x,z,count);}
  function petCapy(){const first=world.petCapy();chime();toast(first?'给橘子君挠挠痒…它舒服地侧躺翻滚 ♥':'呼噜呼噜…再挠一挠，好舒服呀');}
  function updateLocation(x,z){$('location').textContent=x>40&&z<-20?'听风小亭':x>18&&z<8?'一池荷香':x<-15&&z>20?'甜甜果园':z<=-8&&x<-7?'青瓦小院':x<-20?'春日花园':z>32?'南边林径':'小院菜园';}
  function updateGrowth(){if(activeTab==='crop'&&activePlot?.seed){const p=progress(activePlot);if($('growthBar'))$('growthBar').style.width=p*100+'%';if($('growthTime'))$('growthTime').textContent=p>=1?'已经成熟':'还要 '+duration(secondsLeft(activePlot));if($('harvestCrop'))$('harvestCrop').disabled=p<1;if(p>=1&&$('waterCrop'))$('waterCrop').disabled=true;}}
  function progress(plot){if(!plot.seed)return 0;return Math.min(1,Math.max(0,(Date.now()-plot.planted)/(seedById(plot.seed).time*1000)));}
  function secondsLeft(plot){return Math.max(0,Math.ceil((seedById(plot.seed).time*1000-(Date.now()-plot.planted))/1000));}
  function duration(s){return s<60?`${s}秒`:`${Math.floor(s/60)}分${s%60?s%60+'秒':''}`;}
  function updateHud(){$('coins').textContent=state.coins;$('love').textContent=state.love;$('bagDot').hidden=!Object.values(state.inventory).some(n=>n>0);}
  let toastTimer;
  function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3300);}
  let previousFocus=null;
  function openSheet(title,eyebrow,content,tab){if($('modalBackdrop').hidden)previousFocus=document.activeElement;for(const node of $('game').children)if(node!==$('modalBackdrop'))node.inert=true;activeTab=tab;$('sheetTitle').textContent=title;$('sheetEyebrow').textContent=eyebrow;$('sheetContent').innerHTML=content;$('modalBackdrop').hidden=false;requestAnimationFrame(()=>$('closeSheet').focus());}
  function closeSheet(){$('modalBackdrop').hidden=true;for(const node of $('game').children)node.inert=false;activePlot=null;activeTab='';previousFocus?.focus?.();}
  $('closeSheet').onclick=closeSheet;
  $('modalBackdrop').onclick=e=>{if(e.target===$('modalBackdrop'))closeSheet();};
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')closeSheet();
    if(!$('modalBackdrop').hidden){
      if(e.key==='Tab'){const focusables=[...$('modalBackdrop').querySelectorAll('button:not([disabled]),[tabindex="0"]')];const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;
    }
    if(document.activeElement!==canvas)return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();moveGirl({x:girl.x+(e.key==='ArrowRight'?6:e.key==='ArrowLeft'?-6:0),y:girl.z+(e.key==='ArrowDown'?6:e.key==='ArrowUp'?-6:0)});}
    if(e.key==='+'||e.key==='=')world.zoomBy(1.12);if(e.key==='-')world.zoomBy(1/1.12);
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
    state.coins-=seed.cost;plot.seed=id;plot.planted=Date.now();plot.watered=false;save();closeSheet();focus(plot.x,plot.y);world.moveToPlot(plot);chime();toast(`${seed.icon} ${seed.name}种好了，${duration(seed.time)}后长成`);
  }
  function showPlot(plot){
    activePlot=plot;world.moveToPlot(plot);
    if(!plot.seed){showSeeds(plot.kind,plot);return;}
    const seed=seedById(plot.seed),p=progress(plot);
    openSheet(seed.name,`${KIND[plot.kind]} · ${p>=1?'可以收获了':'正在慢慢长大'}`,`<div class="crop-detail"><span class="big-emoji">${seed.icon}</span><p>${p>=1?'长得刚刚好，带回小竹篮吧。':'风轻轻吹，它正在努力长大。'}</p><div class="progress"><span id="growthBar" style="width:${p*100}%"></span></div><small id="growthTime">${p>=1?'已经成熟':'还要 '+duration(secondsLeft(plot))}</small><button id="harvestCrop" class="primary" ${p<1?'disabled':''}>收获到小竹篮 · 2 份</button>${p<1?`<button id="waterCrop" class="secondary" ${plot.watered?'disabled':''}>${plot.watered?'已经喝过水啦':'给它浇浇水 · 提前 20% 长成'}</button>`:''}</div>`,'crop');
    $('harvestCrop').onclick=()=>harvest(plot);
    if($('waterCrop'))$('waterCrop').onclick=()=>{if(plot.watered||progress(plot)>=1)return;plot.watered=true;plot.planted-=seed.time*200;save();chime();toast('喝过水啦！成长时间缩短了一些');showPlot(plot);};
  }
  function harvest(plot){if(!plot.seed||progress(plot)<1)return;const s=seedById(plot.seed);state.inventory[s.id]=(state.inventory[s.id]||0)+2;state.harvests++;state.love++;plot.seed=null;plot.planted=0;plot.watered=false;save();closeSheet();chime();heartBurst(plot.x,plot.y,4);toast(`${s.icon} 收获了 2 份${s.name}！小竹篮里可以换种子钱`);}
  function showBag(){
    const items=SEEDS.filter(s=>(state.inventory[s.id]||0)>0),total=items.reduce((sum,s)=>sum+state.inventory[s.id]*s.value,0);
    openSheet('我的小竹篮','把春天，一点点装起来',items.length?`${items.map(s=>`<div class="bag-row"><span>${s.icon}</span><div><strong>${s.name}</strong><small>每份可换 ◎ ${s.value}</small></div><b>× ${state.inventory[s.id]}</b></div>`).join('')}<button id="sellAll" class="primary">送去集市 · 换 ◎ ${total}</button><p class="subtle">收获留在竹篮里，也会保存下来。</p>`:'<div class="empty-bag"><span>🧺</span><p>竹篮还空着。<br>去看看菜园，胡萝卜长大了吗？</p></div>','bag');
    if($('sellAll'))$('sellAll').onclick=()=>{state.coins+=total;state.inventory={};save();chime();showBag();toast(`集市收下了你的收获，得到 ◎ ${total}`);};
  }
  function showMap(){
    const regions=[['courtyard','🏡','青瓦小院','可开门进入，沿石路逛庭院',-24,-18],['flower','🌸','春日花园','花圃之间也有石头路',-32,6],['vegetable','🥕','小院菜园','环路与田间小径相连',0,9],['water','🪷','一池荷香','沿小路走上弯弯的小桥',31,-11],['fruit','🍊','甜甜果园','顺着曲径看看果树',-27,27],['capy','♥','偶遇橘子君','在石头路上找到它',world.capy.x,world.capy.z],['pavilion','🍵','听风小亭','院子另一边，听竹叶沙沙',48,-28],['south','🌳','南边林径','沿树林中的曲径慢慢走',32,42]];
    const roads=world.roads.edges.map(e=>{const a=world.roads.nodes[e.a],b=world.roads.nodes[e.b];return `<path d="M ${a.x+65} ${a.z+52} L ${b.x+65} ${b.z+52}" stroke="${e.bridge?'#a98459':'#dfd4b2'}" stroke-width="${e.width*.7}"/>`;}).join('');
    openSheet('逛一逛小院','更多曲径，更多风景',`<svg class="roadmap-preview" viewBox="0 0 130 104" role="img" aria-label="石头路网地图"><rect width="130" height="104" rx="5" fill="#a7c788"/><ellipse cx="96" cy="42" rx="10" ry="13" fill="#80c6bd"/><rect x="25" y="17" width="32" height="27" fill="#e4dec3"/>${roads}<circle cx="${girl.x+65}" cy="${girl.z+52}" r="2" fill="#d28491"/></svg><div class="region-grid">${regions.map(([id,icon,name,desc])=>`<button data-region="${id}"><span>${icon}</span><strong>${name}</strong><small>${desc}</small></button>`).join('')}</div><button id="enterYard" class="primary">打开院门，走进小院</button><button id="walkBridge" class="secondary">沿石头路，走过小桥</button><p class="subtle">拖动探索更大的地图；点地图时，小桃会走向附近的石头路。</p>`,'map');
    $('sheetContent').querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{const r=regions.find(r=>r[0]===b.dataset.region);closeSheet();focus(r[4],r[5]);if(r[0]==='capy')toast('找到橘子君啦，点点它，给它挠挠痒');});
    $('enterYard').onclick=()=>{closeSheet();world.enterYard();toast('小桃会沿石头路，穿过院门走进去');};
    $('walkBridge').onclick=()=>{closeSheet();world.moveGirl({x:43,z:-11},true);toast('沿石头路去荷塘，桥上也可以走哦');};
  }
  function showHelp(){openSheet('在小院，慢慢玩','欢迎来到桃溪小院',`<div class="help-row"><span>☝</span><p>拖动地图逛小院，点地图让小桃沿石头路走过去。兔兔跟在身后，也走同一条路。</p></div><div class="help-row"><span>♧</span><p>点空地块挑种子，或从「播种」开始。菜园、花园、果园、荷塘各有 3 种选择。</p></div><div class="help-row"><span>◷</span><p>作物有自己的生长周期，浇水可加快一次。第一版为 45 秒～3 分钟。</p></div><div class="help-row"><span>🧺</span><p>成熟后点作物收获，再到小竹篮送去集市，用赚到的种子钱继续播种。</p></div><div class="help-row"><span>🍊</span><p>橘子君每次打开都会出现在不同的地方。点它挠痒痒，看看舒服的翻滚。</p></div><div class="help-row"><span>⌘</span><p>点院门可开关；「逛小院」里可以走进庭院、走过小桥。双指捏合或用 ＋ / − 缩放地图。</p></div><footer>${storageAvailable?'小院进度自动保存在这个浏览器里。':'当前浏览器无法保存，请保持页面开启。'}</footer>`,'help');}
  $('plantButton').onclick=()=>showSeeds(selectedCategory);
  $('bagButton').onclick=showBag;$('mapButton').onclick=showMap;$('helpButton').onclick=showHelp;
  $('dismissNote').onclick=()=>$('welcomeNote').remove();
  $('zoomIn').onclick=()=>world.zoomBy(1.17);$('zoomOut').onclick=()=>world.zoomBy(1/1.17);$('homeButton').onclick=()=>focus(girl.x,girl.z);
  function chime(){if(!soundOn||!audioContext)return;const now=audioContext.currentTime;[523.25,659.25,783.99].forEach((f,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=f;o.connect(g);g.connect(audioContext.destination);g.gain.setValueAtTime(0,now+i*.1);g.gain.linearRampToValueAtTime(.045,now+i*.1+.015);g.gain.exponentialRampToValueAtTime(.001,now+i*.1+.7);o.start(now+i*.1);o.stop(now+i*.1+.8);});}
  function ambient(){if(!soundOn||document.hidden)return;const freqs=[261.63,293.66,329.63,392,440,523.25];const o=audioContext.createOscillator(),g=audioContext.createGain(),now=audioContext.currentTime;o.type='sine';o.frequency.value=freqs[Math.floor(Math.random()*freqs.length)];o.connect(g);g.connect(audioContext.destination);g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(.024,now+.1);g.gain.exponentialRampToValueAtTime(.001,now+2.5);o.start();o.stop(now+3);}
  $('soundButton').onclick=async()=>{try{audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();await audioContext.resume();soundOn=!soundOn;$('soundButton').setAttribute('aria-pressed',soundOn);$('soundLabel').textContent=soundOn?'静一静':'听风';$('soundIcon').style.color=soundOn?'#d98788':'';clearInterval(audioTimer);if(soundOn){chime();audioTimer=setInterval(ambient,3300);}else await audioContext.suspend();}catch{toast('这个浏览器暂时无法播放声音');}};

  $('gateButton').onclick=showGate;
  updateHud();addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
  toast('小院变大啦！沿石头路走，推开院门看看吧');
})();
