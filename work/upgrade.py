from pathlib import Path
old=Path('work/game-v1.js').read_text()
a=old.index('  const $ =');b=old.index('  const girl=')
prefix=old[a:b].replace("const canvas = $('world'), ctx = canvas.getContext('2d');","const canvas = $('world');").replace('const W = 2000, H = 1500, SAVE_KEY','const SAVE_KEY')
prefix=prefix.replace('x:1085+(col-row)*64,y:805+(col+row)*35','x:-9+col*6,y:row*6')
prefix=prefix.replace('x:755+(col-row)*64,y:745+(col+row)*35','x:-35+col*6,y:row*6')
prefix=prefix.replace('[{x:405,y:1060},{x:625,y:1180},{x:495,y:1145}]','[{x:-34,y:25},{x:-27,y:27},{x:-20,y:29}]')
prefix=prefix.replace('[{x:1590,y:685},{x:1740,y:795},{x:1650,y:890}]','[{x:26,y:-3},{x:35,y:-2},{x:39,y:-18}]')
prefix=prefix.replace('inventory:{},plots,harvests:0','inventory:{},plots,harvests:0,gateOpen:false')
prefix=prefix.replace('inventory:{}};','inventory:{},gateOpen:!!saved.gateOpen};')
a=old.index('  function progress(');b=old.index('  function heartBurst(')
ui=old[a:b]
ui=ui.replace("moveGirl({x:plot.x+45,y:plot.y+35})","world.moveToPlot(plot)").replace("moveGirl({x:plot.x+55,y:plot.y+42})","world.moveToPlot(plot)")
ui=ui.replace('heartBurst(plot.x,plot.y-25,4)','heartBurst(plot.x,plot.y,4)')
ui=ui.replace("moveGirl({x:girl.x+(e.key==='ArrowRight'?96:e.key==='ArrowLeft'?-96:0),y:girl.y+(e.key==='ArrowDown'?96:e.key==='ArrowUp'?-96:0)})", "moveGirl({x:girl.x+(e.key==='ArrowRight'?6:e.key==='ArrowLeft'?-6:0),y:girl.z+(e.key==='ArrowDown'?6:e.key==='ArrowUp'?-6:0)})")
ui=ui.replace('setZoom(camera.zoom*1.12)','world.zoomBy(1.12)').replace('setZoom(camera.zoom/1.12)','world.zoomBy(1/1.12)').replace('setZoom(camera.zoom*1.17)','world.zoomBy(1.17)').replace('setZoom(camera.zoom/1.17)','world.zoomBy(1/1.17)').replace('focus(girl.x,girl.y)','focus(girl.x,girl.z)')
a=ui.index('  function showMap(){');b=ui.index('  function showHelp(){')
ui=ui[:a]+'''  function showMap(){
    const regions=[['courtyard','🏡','青瓦小院','可开门进入，沿石路逛庭院',-24,-18],['flower','🌸','春日花园','花圃之间也有石头路',-32,6],['vegetable','🥕','小院菜园','环路与田间小径相连',0,9],['water','🪷','一池荷香','沿小路走上弯弯的小桥',31,-11],['fruit','🍊','甜甜果园','顺着曲径看看果树',-27,27],['capy','♥','偶遇橘子君','在石头路上找到它',world.capy.x,world.capy.z],['pavilion','🍵','听风小亭','院子另一边，听竹叶沙沙',48,-28],['south','🌳','南边林径','沿树林中的曲径慢慢走',32,42]];
    const roads=world.roads.edges.map(e=>{const a=world.roads.nodes[e.a],b=world.roads.nodes[e.b];return `<path d="M ${a.x+65} ${a.z+52} L ${b.x+65} ${b.z+52}" stroke="${e.bridge?'#a98459':'#dfd4b2'}" stroke-width="${e.width*.7}"/>`;}).join('');
    openSheet('逛一逛小院','更多曲径，更多风景',`<svg class="roadmap-preview" viewBox="0 0 130 104" role="img" aria-label="石头路网地图"><rect width="130" height="104" rx="5" fill="#a7c788"/><ellipse cx="96" cy="42" rx="10" ry="13" fill="#80c6bd"/><rect x="25" y="17" width="32" height="27" fill="#e4dec3"/>${roads}<circle cx="${girl.x+65}" cy="${girl.z+52}" r="2" fill="#d28491"/></svg><div class="region-grid">${regions.map(([id,icon,name,desc])=>`<button data-region="${id}"><span>${icon}</span><strong>${name}</strong><small>${desc}</small></button>`).join('')}</div><button id="enterYard" class="primary">打开院门，走进小院</button><button id="walkBridge" class="secondary">沿石头路，走过小桥</button><p class="subtle">拖动探索更大的地图；点地图时，小桃会走向附近的石头路。</p>`,'map');
    $('sheetContent').querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{const r=regions.find(r=>r[0]===b.dataset.region);closeSheet();focus(r[4],r[5]);if(r[0]==='capy')toast('找到橘子君啦，点点它，给它挠挠痒');});
    $('enterYard').onclick=()=>{closeSheet();world.enterYard();toast('小桃会沿石头路，穿过院门走进去');};
    $('walkBridge').onclick=()=>{closeSheet();world.moveGirl({x:43,z:-11},true);toast('沿石头路去荷塘，桥上也可以走哦');};
  }
''' + ui[b:]
ui=ui.replace('点空地让小桃走过去。兔兔会跟着她。','点地图让小桃沿石头路走过去。兔兔跟在身后，也走同一条路。')
ui=ui.replace('「逛小院」可以快速找到各个区域。双指捏合或用 ＋ / − 缩放地图。','点院门可开关；「逛小院」里可以走进庭院、走过小桥。双指捏合或用 ＋ / − 缩放地图。')
bootstrap='''
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
  function updateLocation(x,z){$('location').textContent=x>40&&z<-20?'听风小亭':x>18&&z<8?'一池荷香':x<-15&&z>20?'甜甜果园':z<-8&&x<-7?'青瓦小院':x<-20?'春日花园':z>32?'南边林径':'小院菜园';}
  function updateGrowth(){if(activeTab==='crop'&&activePlot?.seed){const p=progress(activePlot);if($('growthBar'))$('growthBar').style.width=p*100+'%';if($('growthTime'))$('growthTime').textContent=p>=1?'已经成熟':'还要 '+duration(secondsLeft(activePlot));if($('harvestCrop'))$('harvestCrop').disabled=p<1;if(p>=1&&$('waterCrop'))$('waterCrop').disabled=true;}}
'''
end='''
  $('gateButton').onclick=showGate;
  updateHud();addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
  toast('小院变大啦！沿石头路走，推开院门看看吧');
})();
'''
Path('game.js').write_text("import {FarmWorld} from './scene3d.js';\n(() => {\n"+prefix+bootstrap+ui+end)
p=Path('index.html');s=p.read_text().replace('<canvas id="world"','<div id="sceneLabels" aria-label="场景标记"></div>\n<canvas id="world"').replace('点击空地移动小桃','点击地图沿石头路移动小桃').replace('拖动逛小院 · 点空地走一走','拖动逛小院 · 点石头路走一走').replace('桃溪手记 · 初见','桃溪手记 · 风动小院').replace('<script src="game.js"></script>','<script type="module" src="game.js"></script>').replace('<button class="round-button home-button"','<button class="round-button" id="gateButton" aria-label="庭院门">门</button><button class="round-button home-button"');p.write_text(s)
p=Path('package.json');import json;s=json.loads(p.read_text());s['type']='module';s['version']='0.2.0';s['scripts']['check']='node --check game.js && node --check scene3d.js && node --check models.js && node --check roads.js';s['scripts']['test']='node --test work/roads.test.js';p.write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n')
