const MATS = {
  wood:       {name:'橡木地板', price:320, sw:'#d8b88a'},
  maple:      {name:'枫木地板', price:340, sw:'#e6d0a8'},
  walnut:     {name:'胡桃木地板', price:380, sw:'#9b7250'},
  greywood:   {name:'浅灰木地板', price:360, sw:'#c5bbb0'},
  herringbone:{name:'人字拼地板', price:480, sw:'#d0b089'},
  bamboo:     {name:'竹地板', price:300, sw:'#d9c48a'},
  tile800:    {name:'800 地砖', price:220, sw:'#ebe6dc'},
  tile600:    {name:'600 地砖', price:160, sw:'#dfe3e1'},
  porcelain:  {name:'抛光瓷砖', price:280, sw:'#f0eeea'},
  marble:     {name:'大理石', price:650, sw:'#f1eee8'},
  travertine: {name:'洞石', price:520, sw:'#e8dcc8'},
  slate:      {name:'岩板', price:420, sw:'#8a8e93'},
  antislip:   {name:'300 防滑砖', price:140, sw:'#d3d8d4'},
  hexatile:   {name:'六角砖', price:260, sw:'#d9ddd8'},
  mosaic:     {name:'马赛克', price:240, sw:'#cfd6d2'},
  terrazzo:   {name:'水磨石', price:280, sw:'#e6dfd3'},
  cement:     {name:'微水泥', price:350, sw:'#cfc9c0'},
  carpet:     {name:'满铺地毯', price:200, sw:'#c9c3d3'},
  // —— 扩展材质：拼花木地板 / 特色砖石 / 天然编织 ——
  chevron:    {name:'鱼骨拼地板', price:520, sw:'#c8a273'},
  parquet:    {name:'凡尔赛拼花', price:680, sw:'#d0ae82'},
  smoked:     {name:'烟熏木地板', price:420, sw:'#8a7768'},
  cork:       {name:'软木地板', price:260, sw:'#cba87c'},
  woodtile:   {name:'木纹砖', price:300, sw:'#bf8756'},
  granite:    {name:'花岗岩', price:560, sw:'#bdbbb6'},
  encaustic:  {name:'复古花砖', price:380, sw:'#dfe6e4'},
  subway:     {name:'地铁砖', price:240, sw:'#ebe8e0'},
  bluestone:  {name:'青石板', price:340, sw:'#8d949a'},
  gardentile: {name:'花园瓷砖', price:280, sw:'#edcfa0'},
  sisal:      {name:'剑麻编织地毯', price:280, sw:'#c8bda2'},
  tatami:     {name:'榻榻米', price:360, sw:'#c9c49a'},
};
/** 柜子类家具（可调高度 + 柜体材质） */
const CABINET_TYPES = new Set([
  'wardrobe', 'cabinet', 'shoecab', 'premiumshoecab', 'dresser', 'bookshelf',
  'tvstand', 'nightstand', 'counter', 'kitchencab', 'vanity', 'ovencol', 'console',
]);
const isCabinetType = t => CABINET_TYPES.has(t);
/** 柜体预设材质：wood=木纹质感，paint=烤漆/哑光 */
const FURN_FINISHES = [
  {id:'oak', name:'橡木', color:'#e2cfb4', wood:true},
  {id:'walnut', name:'胡桃木', color:'#6b4f3a', wood:true},
  {id:'teak', name:'柚木', color:'#b8956a', wood:true},
  {id:'cherry', name:'樱桃木', color:'#a67c52', wood:true},
  {id:'ash', name:'白蜡木', color:'#d8d0c4', wood:true},
  {id:'dark', name:'深色木纹', color:'#3d342c', wood:true},
  {id:'cream', name:'奶油白', color:'#efe6d8', wood:false},
  {id:'white', name:'白色烤漆', color:'#f5f2ec', wood:false},
  {id:'grey', name:'浅灰', color:'#d5d2cc', wood:false},
  {id:'black', name:'黑色烤漆', color:'#2a2a2c', wood:false},
];
function defaultCabinetHMm(f){
  switch (f && f.type){
    case 'wardrobe': return 2200;
    case 'premiumshoecab': return 2400;
    case 'ovencol': return 2100;
    case 'bookshelf': return 1800;
    case 'shoecab': return 1000;
    case 'cabinet': return 850;
    case 'counter': return 860;
    case 'kitchencab': return 850;
    case 'vanity': return 810;
    case 'console': return 780;
    case 'dresser': return 750;
    case 'nightstand': return 500;
    case 'tvstand': return 520;
    default: return 900;
  }
}
function cabinetHMm(f){
  const h = +(f && f.h);
  if (Number.isFinite(h) && h >= 300 && h <= 2800) return Math.round(h / 10) * 10;
  return defaultCabinetHMm(f);
}
function furnFinishOf(f){
  if (!f || !f.finish) return null;
  return FURN_FINISHES.find(x => x.id === f.finish) || null;
}
// 家具库：[类型, 名称, 宽, 深, 颜色]；地板第 6 项为 MATS 键
const LIB = [
  {cat:'卧室', items:[
    ['bed','双人床',1800,2000,'#c9d6df'],['bed','单人床',1200,2000,'#e8d5b5'],['bed','儿童床',1000,1900,'#f0d4b8'],['crib','婴儿床',1250,700,'#efe3d0'],
    ['premiumbed','高端木床',1800,2000,'#4a382b'],
    ['leatherbed','真皮大床',1800,2000,'#1b1b20'],
    ['premiumdresser','高端梳妆台',2400,500,'#3d2c22'],
    ['nightstand','床头柜',450,400,'#e8dccb'],['wardrobe','衣柜',2000,600,'#efe6d8'],
    ['dresser','梳妆台',1000,450,'#efe6d8'],['ottoman','床尾凳',1400,450,'#d6c4b0'],['mirror','全身镜',600,80,'#cfd8e0'],
    ['desk','书桌',1200,600,'#e2cfb4'],['chair','椅子',450,480,'#cfc6b8'],['bookshelf','书架',800,300,'#e2cfb4'],
    ['baycushion','飘窗垫',520,1800,'#e7dccd'],['cabinet','床头收纳柜',800,400,'#efe6d8']]},
  {cat:'客厅', items:[
    ['sofa','沙发',2400,900,'#b7c4b0'],['loveseat','双人沙发',1600,880,'#c3cbd6'],
    ['cornersofa','转角沙发',2800,1700,'#b7c4b0'],['sectional','模块组合沙发',3200,2000,'#b0bdae'],
    ['curvedsofa','弧形沙发',2800,1100,'#c2b6a4'],['chaise','贵妃榻',1600,700,'#cdb098'],
    ['armchair','单人沙发',850,850,'#d6b99a'],['armchair','休闲躺椅',900,1400,'#c9a98a'],
    ['eggchair','蛋形休闲椅',900,900,'#d8c6b0'],['rockingchair','摇椅',750,1000,'#c2a789'],
    ['beanbag','懒人沙发',800,800,'#e0b98f'],['floorcushion','蒲团坐垫',600,600,'#d9c7ae'],['drumstool','鼓墩',450,450,'#c9ad8c'],
    ['coffeetable','茶几',1300,650,'#e8dccb'],['nestingtable','组合圆茶几',900,900,'#dfd2bd'],
    ['sidetable','边几',500,500,'#d9c3a3'],['console','玄关桌',1200,350,'#e2cfb4'],['ottoman','脚凳',600,600,'#cbb9a4'],
    ['tvstand','电视柜',2400,400,'#e2cfb4'],['rug','地毯',2400,1700,'#d9cbb8'],
    ['shoecab','鞋柜',1000,350,'#efe6d8'],['shoecab','玄关柜',1400,380,'#e6dccc'],
    ['premiumshoecab','高端鞋柜',1600,400,'#4a3327'],
    ['floorlamp','落地灯',450,450,'#3d3a34'],['hanger','衣帽架',500,500,'#6b5d4c'],
    ['barcart','茶水推车',800,400,'#c9a86a'],['screen','屏风',1800,400,'#e2d6c2'],
    ['fireplace','壁炉',1400,450,'#d8d2c6'],['speaker','落地音箱',300,300,'#3a3a3c'],
    ['artframe','装饰画',1200,80,'#b98f6e'],
    ['plant','绿植',500,500,'#a9c39b'],['cabinet','展示柜',1200,400,'#efe6d8']]},
  {cat:'餐厨', items:[
    ['table','餐桌',1400,800,'#e2cfb4'],['roundtable','圆桌',1000,1000,'#e2cfb4'],
    ['chair','餐椅',450,480,'#cfc6b8'],['bench','长条凳',1400,400,'#cfc6b8'],['island','岛台',1800,900,'#e9e5de'],['barstool','吧椅',420,420,'#6b5d4c'],
    // —— 3 款配套桌椅：新中式 / 中古现代 / 北欧原木，每款一桌一椅 ——
    ['chinesetable','新中式长餐桌',1600,850,'#6b4a32'],['mingchair','明式圈椅',600,560,'#7a5537'],
    ['tuliptable','郁金香岩板圆桌',1100,1100,'#eceae4'],['shellchair','贝壳餐椅',560,560,'#e3d5c3'],
    ['ovaltable','北欧椭圆餐桌',1600,900,'#d8b88a'],['windsorchair','温莎椅',520,520,'#c9a06a'],
    ['counter','橱柜',1600,600,'#e9e5de'],['kitchencab','矮橱柜',1200,600,'#b69674'],['stove','燃气灶',750,450,'#dcdcdc'],
    ['ksink','水槽',800,450,'#e1e6ea'],['fridge','冰箱',700,700,'#dfe4e8'],
    ['cabinet','餐边柜',1600,400,'#efe6d8'],['cabinet','酒柜',600,400,'#6b4f3a'],['microwave','微波炉',500,400,'#c9ced3'],['dishwasher','洗碗机',600,600,'#c9ced3']]},
  {cat:'卫浴', items:[
    ['toilet','马桶',400,700,'#ffffff'],['toilet','智能马桶',420,720,'#f5f7f8'],
    ['vanity','浴室柜',800,500,'#eef1f3'],['shower','淋浴房',900,900,'#e4edf2'],['bathtub','浴缸',1600,750,'#eef3f6'],
    ['washer','洗衣机',600,600,'#e6ebee'],['waterheater','电热水器',800,450,'#f4f4f2'],
    ['cabinet','储物柜',1000,400,'#efe6d8'],['mirror','浴室镜',800,80,'#cfd8e0'],['ksink','洗衣池',600,450,'#e1e6ea']]},
  {cat:'家电', items:[
    ['tv','电视',1450,80,'#1d1d1f'],['fridge','冰箱',700,700,'#d4dae0'],
    ['aircon','柜机空调',500,380,'#f6f7f8'],['acwall','挂机空调',900,250,'#f6f7f8'],
    ['dishwasher','洗碗机',600,600,'#c9ced3'],['ovencol','蒸烤箱高柜',600,600,'#efe6d8'],['microwave','微波炉',500,400,'#c9ced3'],
    ['dryer','烘干机',600,600,'#e6ebee'],['purifier','空气净化器',400,300,'#f4f4f2'],
    ['washer','洗烘一体',600,650,'#e0e6ea'],['waterheater','燃气热水器',700,300,'#e8eaec']]},
  {cat:'书房 · 休闲', items:[
    ['desk','书桌',1200,600,'#e2cfb4'],['officechair','办公椅',620,620,'#4a4f55'],['bookshelf','书架',800,350,'#e2cfb4'],
    ['piano','立式钢琴',1500,600,'#1f1d1b'],['treadmill','跑步机',800,1800,'#3a3a3c'],
    ['armchair','阅读椅',750,800,'#c9a98a'],['armchair','躺椅',800,1600,'#b89a78'],
    ['cabinet','文件柜',800,450,'#efe6d8'],['floorlamp','落地灯',400,400,'#3d3a34'],
    ['plant','绿植',450,450,'#a9c39b'],['rug','地毯',1600,1200,'#cfc0ae']]},
  {cat:'灯光', items:[
    ['floorlamp','落地灯',450,450,'#3d3a34'],['floorlamp','弧形落地灯',520,520,'#2a2a2c'],
    ['tablelamp','台灯',280,280,'#cfc6b8'],['tablelamp','床头台灯',320,320,'#e8dccb'],
    ['pendant','餐厅吊灯',600,600,'#d8cfc4'],['pendant','单头吊灯',350,350,'#3a3a3c'],
    ['chandelier','枝形吊灯',900,900,'#e8e2d6'],['ceilinglamp','吸顶灯',700,700,'#f2eee8'],
    ['walllamp','壁灯',180,120,'#cfc8bc'],['walllamp','镜前壁灯',520,100,'#e8e4dc'],
    ['tracklight','轨道射灯',1200,80,'#3a3a3c'],['downlight','筒灯',120,120,'#f0ece6'],
    ['ledstrip','线性灯带',2000,40,'#e8e4dc'],['ledstrip','短灯带',1000,40,'#e8e4dc'],
    ['ledstrip','灯带拐角',600,600,'#e8e4dc'],['gardenlamp','庭院灯',480,480,'#4a4540'],
    ['crystalpendant','水晶吊灯',800,800,'#d8d2c8'],['globependant','玻璃球吊灯',450,450,'#c8a86e'],
    ['cagependant','笼式吊灯',400,400,'#2f2f31'],
    ['torchere','洗墙落地灯',400,400,'#b8bcc0'],['tripodlamp','三脚架落地灯',550,550,'#8a6b4c'],
    ['bankerslamp','银行台灯',320,260,'#c8a86e'],['globetablelamp','云石球台灯',300,300,'#f2eee6'],
    ['sconce','双臂壁灯',520,180,'#c8a86e'],
    ['bollardlight','草坪灯',220,220,'#4a4540'],['lantern','庭院灯笼',420,420,'#3a3532']]},
  {cat:'装饰', items:[
    // 挂墙装饰：拖到墙边自动吸附并挂起（见 ops.js snapWallDecor / WALL_DECOR）
    ['wallart','挂画',900,60,'#b98f6e'],['gallerywall','照片墙',1600,60,'#c8a882'],
    ['wallmirror','装饰镜',800,60,'#d5dde3'],['wallclock','挂钟',450,60,'#c8a86e'],
    ['tapestry','挂毯',1200,50,'#b7a48c'],['macrame','编织壁挂',700,50,'#d8c9ad'],
    ['wallshelf','壁挂搁板',900,220,'#8d7258'],['recordwall','碟片墙',1400,60,'#2f2c29'],
    // 落地 / 台面摆件
    ['gramophone','留声机',500,400,'#6b4a2f'],['floorvase','落地花瓶',400,400,'#b8956a'],['sculpture','抽象雕塑',500,500,'#c9c4b8'],
    ['candleholder','烛台',260,260,'#c8a86e'],['decotray','装饰托盘',420,420,'#d8c9ad']]},
  {cat:'门', items:[
    ['door','单开门',900,240,'#efe6d8'],['door','卫生间门',700,240,'#f5f0e8'],['door','入户门',900,240,'#6b4f3a'],
    ['slidedoor','推拉门',1800,240,'#e4edf2'],['gardengate','花园门',1600,240,'#2c2c2e']]},
  {cat:'地板', items:[
    ['floor','橡木地板',1200,1200,'#d8b88a','wood'],['floor','枫木地板',1200,1200,'#e6d0a8','maple'],
    ['floor','胡桃木地板',1200,1200,'#9b7250','walnut'],['floor','浅灰木地板',1200,1200,'#c5bbb0','greywood'],
    ['floor','人字拼地板',1200,1200,'#d0b089','herringbone'],['floor','竹地板',1200,1200,'#d9c48a','bamboo'],
    ['floor','800 地砖',1200,1200,'#ebe6dc','tile800'],['floor','600 地砖',1200,1200,'#dfe3e1','tile600'],
    ['floor','抛光瓷砖',1200,1200,'#f0eeea','porcelain'],['floor','大理石',1200,1200,'#f1eee8','marble'],
    ['floor','洞石',1200,1200,'#e8dcc8','travertine'],['floor','岩板',1200,1200,'#8a8e93','slate'],
    ['floor','300 防滑砖',1200,1200,'#d3d8d4','antislip'],['floor','六角砖',1200,1200,'#d9ddd8','hexatile'],
    ['floor','马赛克',1200,1200,'#cfd6d2','mosaic'],['floor','水磨石',1200,1200,'#e6dfd3','terrazzo'],
    ['floor','微水泥',1200,1200,'#cfc9c0','cement'],['floor','满铺地毯',1200,1200,'#c9c3d3','carpet'],
    ['floor','鱼骨拼地板',1200,1200,'#c8a273','chevron'],['floor','凡尔赛拼花',1200,1200,'#d0ae82','parquet'],
    ['floor','烟熏木地板',1200,1200,'#8a7768','smoked'],['floor','软木地板',1200,1200,'#cba87c','cork'],
    ['floor','木纹砖',1200,1200,'#bf8756','woodtile'],['floor','花岗岩',1200,1200,'#bdbbb6','granite'],
    ['floor','复古花砖',1200,1200,'#dfe6e4','encaustic'],['floor','地铁砖',1200,1200,'#ebe8e0','subway'],
    ['floor','青石板',1200,1200,'#8d949a','bluestone'],['floor','花园瓷砖',1200,1200,'#edcfa0','gardentile'],
    ['floor','剑麻编织地毯',1200,1200,'#c8bda2','sisal'],
    ['floor','榻榻米',1200,1200,'#c9c49a','tatami']]},
  {cat:'花园', items:[
    ['plant','绿植',650,650,'#6f9f5e'],['plant','盆栽花',420,420,'#8fad6a'],['planter','花箱',700,700,'#b8956a'],
    ['tree','乔木',1800,1800,'#7fa06a'],['flowerpot','陶罐花器',600,600,'#c08a5e'],
    ['gardenbench','花园长椅',1800,650,'#8b7355'],['stonebench','石凳',950,500,'#c8c3b8'],
    ['outdoorsofa','户外藤编沙发',2000,850,'#b9a88a'],['outdoorchair','户外藤编单椅',800,850,'#c2b195'],
    ['hangingchair','吊篮椅',1000,1000,'#cbb79b'],['hammock','吊床',2600,1200,'#d9c8a8'],
    ['swing','户外秋千',1800,1400,'#b9a081'],['patiochaise','花园躺椅',780,2000,'#d8c8a8'],
    ['table','户外餐桌',1500,900,'#a67c52'],['roundtable','户外圆桌',1200,1200,'#b8956a'],
    ['barcounter','户外吧台',1800,700,'#a67c52'],
    ['umbrella','遮阳伞',2400,2400,'#e8c97a'],['shadesail','遮阳帆',3000,3000,'#e6d9bf'],
    ['gazebo','六角凉亭',3000,3000,'#b8956a'],['pergola','花架凉棚',3400,2800,'#9a7350'],
    ['gardenarch','花架拱门',1600,600,'#9a7350'],['trellis','攀爬花格',1800,600,'#9a7350'],
    ['bbq','烧烤炉',900,700,'#3d3f42'],['firepit','户外火盆',900,900,'#8d8880'],
    ['fountain','喷泉',1100,1100,'#9aadb8'],['pond','锦鲤水池',2000,1400,'#8fb6c2'],
    ['waterwall','叠水景墙',1800,500,'#9aadb8'],['birdbath','鸟浴盆',700,700,'#b8b5ad'],
    ['rockery','景石假山',1600,1000,'#9a9a92'],
    ['gpath','汀步石路',2400,900,'#cfc9bd'],['gpath','木栈道',3000,1200,'#b9946b'],
    ['rug','户外地垫',2200,1500,'#b8a890'],['gardenlamp','庭院灯',480,480,'#4a4540'],['dryingrack','晾衣架',1400,700,'#6b5d4c'],
    ['bollardlight','草坪灯',220,220,'#4a4540'],['lantern','庭院灯笼',420,420,'#3a3532']]},
  // 楼梯第 6 项为样式：straight 直跑 / l 直角 / u 回转 / triple 三跑 / spiral 旋转；默认山棕实木色
  {cat:'楼梯', items:[
    ['stairs','直楼梯',1000,3000,'#6b4a32','straight'],
    ['stairs','直角楼梯',2400,2400,'#6b4a32','l'],
    ['stairs','回转楼梯',2800,3200,'#6b4a32','u'],
    ['stairs','三跑楼梯',3000,3600,'#6b4a32','triple'],
    ['stairs','旋转楼梯',2000,2000,'#6b4a32','spiral'],
  ]},
];
// 挂墙装饰：拖放 / 移动时自动吸附到最近墙面，并让正面朝向房间（见 ops.js snapWallDecor）。
// 这组家具在 3D 里是竖立挂在墙面的薄板/浅搁板，不是落地家具。
const WALL_DECOR = new Set(['wallart','gallerywall','wallmirror','wallclock','tapestry','macrame','wallshelf','recordwall']);
// 门扇材质预设：门数据 finish 为空时沿用门型默认配色（普通门暖白、入户门深木色），保证旧方案兼容
const DOOR_FINISHES = [
  {key:'white',  name:'暖白烤漆', col:'#efe6d8', rough:.5},
  {key:'oak',    name:'原木色',   col:'#c9a06a', rough:.55},
  {key:'walnut', name:'胡桃木',   col:'#6b4f3a', rough:.55},
  {key:'grey',   name:'浅灰哑光', col:'#c9cbc8', rough:.6},
  {key:'black',  name:'黑色轻奢', col:'#34322f', rough:.45},
  {key:'glass',  name:'玻璃门',   col:'#e9f1f5', rough:.08, glass:true},
];
const doorFinishOf = d => {
  const k = d && d.finish;
  return (k && DOOR_FINISHES.find(f => f.key === k)) || null;
};
// 灯具类型：面板对这些家具提供亮度 / 色温调节（含庭院灯）
const LAMP_TYPES = new Set(['floorlamp','tablelamp','pendant','chandelier','ceilinglamp','walllamp','tracklight','downlight',
  'ledstrip','crystalpendant','globependant','cagependant','torchere','tripodlamp','bankerslamp','globetablelamp','sconce',
  'bollardlight','lantern','gardenlamp']);
// 灯光色温预设：col 同时用于点光源颜色与发光灯罩 emissive
const LAMP_TONES = [
  {key:'warm',    name:'暖黄光', col:'#ffd9a8'},
  {key:'soft',    name:'暖白光', col:'#ffe7c9'},
  {key:'neutral', name:'中性光', col:'#fff2df'},
  {key:'cool',    name:'冷白光', col:'#e6eeff'},
  {key:'amber',   name:'琥珀光', col:'#ffb864'},
];
const lampToneOf = f => LAMP_TONES.find(t => t.key === (f && f.tone || 'warm')) || LAMP_TONES[0];
// 灯具默认安装高度（光源离地 mm）与悬挂类。面板可编辑 f.height；3D 用 lampLiftOf
// 换算成相对默认位置的升降量（米），未设置 f.height 时恒为 0，老方案外观完全不变。
const LAMP_DEFAULT_H = {
  floorlamp:1350, tablelamp:460, pendant:1500, chandelier:1800, ceilinglamp:2600,
  walllamp:1800, tracklight:2670, downlight:2670, ledstrip:2750,
  crystalpendant:1820, globependant:1620, cagependant:1730,
  torchere:1900, tripodlamp:1680, bankerslamp:360, globetablelamp:420, sconce:1740,
  bollardlight:680, lantern:1720, gardenlamp:1660,
};
const LAMP_HANG = new Set(['pendant','chandelier','crystalpendant','globependant','cagependant']);
const lampHeightOf = f => {
  const d = LAMP_DEFAULT_H[f && f.type] || 1500;
  const v = f && f.height;
  return (v == null || !isFinite(+v)) ? d : Math.max(0, Math.min(3000, +v));
};
const lampLiftOf = f => (lampHeightOf(f) - (LAMP_DEFAULT_H[f && f.type] || 1500)) / 1000;
const typeColor = t => { for (const c of LIB) for (const i of c.items) if (i[0]===t) return i[4]; return '#eee'; };
const stairsStyleOf = (f) => {
  if (f && f.style && ['straight','l','u','triple','spiral'].includes(f.style)) return f.style;
  const n = (f && f.name) || '';
  if (/旋转|spiral|helix/i.test(n)) return 'spiral';
  if (/三跑|triple|3-?run|three-?flight/i.test(n)) return 'triple';
  if (/回转|U\s*形|u-?shape|平行/i.test(n)) return 'u';
  if (/直角|转角|L\s*形|l-?shape/i.test(n)) return 'l';
  return 'straight';
};

let _n = 1;
const uid = () => 'f' + Date.now().toString(36) + (_n++);
const F = (type,name,cx,cy,w,d,rot=0,color,style) => {
  const o = {id:uid(),type,name,cx,cy,w,d,rot,color:color||typeColor(type)};
  if (type === 'stairs'){
    o.style = style || stairsStyleOf(o);
    o.dir = 'up';
    o.flip = false;
  }
  return o;
};

function defaultFurniture(){ return [
  // 主卧
  F('bed','双人床',8300,1000,1800,2000,0,'#c9d6df'), F('nightstand','床头柜',7150,220,450,400), F('nightstand','床头柜',9450,220,450,400),
  F('wardrobe','衣柜',8800,3070,2400,600,180), F('baycushion','飘窗垫',10770,1705,520,1800),
  // 主卫
  F('shower','淋浴房',5270,450,900,900), F('toilet','马桶',5170,1500,400,700,270), F('vanity','浴室柜',6110,700,800,500,90),
  // 小孩房
  F('bed','单人床',2420,1000,1200,2000,0,'#e8d5b5'), F('desk','书桌',2120,2700,1200,600,270), F('chair','椅子',2700,2700,450,480,90),
  F('wardrobe','衣柜',4280,1000,1600,600,90), F('bookshelf','书架',3500,150,800,300),
  // 客卫
  F('shower','淋浴区',2870,4280,900,1340), F('toilet','马桶',3560,3960,400,700), F('vanity','浴室柜',4150,3850,700,480),
  // 洗衣阳台
  F('washer','洗衣机',300,3960,600,600,270), F('vanity','洗衣池',250,4600,600,500,270),
  // 厨房
  F('counter','橱柜',300,6575,2770,600,270), F('counter','橱柜',1390,7660,1580,600,180),
  F('stove','燃气灶',300,6200,750,450,270), F('ksink','水槽',1400,7680,800,450,180),
  // 餐厅
  F('fridge','冰箱',2770,5540,700,700), F('table','餐桌',3600,6650,1400,800,90),
  F('chair','餐椅',2940,6320,450,480,270), F('chair','餐椅',2940,6980,450,480,270),
  F('chair','餐椅',4260,6320,450,480,90), F('chair','餐椅',4260,6980,450,480,90),
  F('cabinet','餐边柜',3500,7785,1600,350,180),
  // 客厅
  F('rug','地毯',7600,8950,2600,1800), F('tvstand','电视柜',7600,6810,2400,400), F('sofa','沙发',7600,10110,3000,900,180),
  F('coffeetable','茶几',7600,8900,1300,650), F('armchair','单人沙发',9500,8900,850,850,90),
  F('shoecab','鞋柜',4995,9900,1000,350,270), F('plant','绿植',9950,10250,500,500), F('plant','绿植',5250,7050,500,500),
  // 子女房
  F('bed','双人床',7323,5500,1500,2000,270,'#d8c7dc'), F('wardrobe','衣柜',8500,3910,2000,600),
  F('desk','书桌',9500,6070,1200,600,180), F('chair','椅子',9500,5480,450,480), F('baycushion','飘窗垫',10770,4997,520,1575),
  // 休闲阳台
  F('roundtable','茶桌',11180,8200,600,600), F('armchair','休闲椅',11180,7520,750,750,0,'#d6b99a'),
  F('armchair','休闲椅',11180,8880,750,750,180,'#d6b99a'), F('plant','绿植',11550,10250,500,500),
];}

function emptyPlanSnapshot(){
  return {
    walls: [], wins: [], doors: [], slides: [], rooms: [], underlay: [],
    bounds: {x:-800, y:-800, w:19600, h:13600},
    hasDefaultDims: false, hasBayLintels: false, hasEntryMark: false,
    cadMode: false, tracing: true,
  };
}
function defaultState(){
  const rooms = {}; ROOMS.forEach(r => rooms[r.id] = {name:r.name, mat:r.mat, wallpaper:null});
  return {furniture:defaultFurniture(), rooms, demolished:[], measures:[], bgImage:null, bgOpacity:0.45, bgScale:1, bgFrame:null, bgAspect:null, plan:null};
}
/** 空白画布：无墙无家具，进入描墙模式 */
function blankState(){
  applyPlanGeometry(emptyPlanSnapshot(), {imported:true, allowEmpty:true, allowEmptyRooms:true});
  const f1 = {
    id: 'F1', name: '1F', heightMm: 2800,
    plan: snapshotPlan(), furniture: [], rooms: {}, demolished: [], measures: [],
    bgImage: null, bgOpacity: 0.35, bgScale: 1.5, bgFrame: null, bgAspect: null, links: [],
  };
  const f2 = (typeof emptyFloorRecord === 'function')
    ? emptyFloorRecord('F2', '2F')
    : {...f1, id:'F2', name:'2F', plan: emptyPlanSnapshot()};
  if (f1.plan?.bounds && f2.plan) f2.plan.bounds = {...f1.plan.bounds};
  return {
    furniture: [], rooms: {}, demolished: [], measures: [],
    bgImage: null, bgOpacity: 0.35, bgScale: 1.5, bgFrame: null, bgAspect: null,
    plan: snapshotPlan(),
    floors: [f1, f2],
    activeFloor: 0,
    combineFloors3d: true,      // 旧字段，仅为兼容存档保留
    wholeBuilding3d: false,     // 鸟瞰默认只显示当前层
  };
}

const STORE = 'huxing-design-v1';
function load(){
  try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && Array.isArray(s.furniture)) return fixState(s); } catch(e) {}
  return null;
}
function fixState(s){
  const d = defaultState();
  s.rooms = Object.assign({}, d.rooms, s.rooms || {});
  s.demolished = s.demolished || []; s.measures = s.measures || [];
  s.bgImage = s.bgImage || null;
  // 底图透明度存 0–1；缩放存倍率（1=100%）。兼容误存百分数的旧方案
  let op = s.bgOpacity == null ? 0.45 : +s.bgOpacity;
  if (!Number.isFinite(op)) op = 0.45;
  if (op > 1) op = op / 100;
  s.bgOpacity = Math.max(0, Math.min(1, op));
  let sc = s.bgScale == null ? 1 : +s.bgScale;
  if (!Number.isFinite(sc)) sc = 1;
  if (sc > 10) sc = sc / 100;
  s.bgScale = Math.max(0.1, Math.min(8, sc));
  s.bgFrame = s.bgFrame && s.bgFrame.w > 0 ? s.bgFrame : null;
  s.bgAspect = s.bgAspect > 0 ? +s.bgAspect : null;
  s.plan = s.plan || null;
  s.combineFloors3d = s.combineFloors3d !== false;   // 旧字段：不再驱动 3D 显示范围
  s.wholeBuilding3d = !!s.wholeBuilding3d;           // 鸟瞰是否手动预览整栋
  // 「新建方案」写入的层数（1–3）；旧方案没有该字段 → 沿用「至少两层」
  const wantFloors = Math.max(0, Math.min(6, s.floorCount | 0));
  if (!Array.isArray(s.floors) || !s.floors.length){
    // 旧方案：当前内容视为 1F，补空 2F
    const f1 = {
      id: 'F1', name: '1F', heightMm: 2800,
      plan: s.plan, furniture: s.furniture || [], rooms: s.rooms || {},
      demolished: s.demolished || [], measures: s.measures || [],
      bgImage: s.bgImage, bgOpacity: s.bgOpacity, bgScale: s.bgScale,
      bgFrame: s.bgFrame, bgAspect: s.bgAspect,
    };
    const f2 = (typeof emptyFloorRecord === 'function')
      ? emptyFloorRecord('F2', '2F')
      : {id:'F2', name:'2F', heightMm:2800, plan:null, furniture:[], rooms:{}, demolished:[], measures:[],
         bgImage:null, bgOpacity:0.35, bgScale:1.5, bgFrame:null, bgAspect:null};
    if (f1.plan?.bounds && f2.plan) f2.plan.bounds = {...f1.plan.bounds};
    s.floors = wantFloors === 1 ? [f1] : [f1, f2];
    s.activeFloor = 0;
  } else {
    const target = wantFloors > 0 ? Math.max(wantFloors, s.floors.length) : Math.max(2, s.floors.length);
    while (s.floors.length < target){
      const n = s.floors.length + 1;
      s.floors.push(typeof emptyFloorRecord === 'function'
        ? emptyFloorRecord('F' + n, n + 'F')
        : {id:'F'+n, name:n+'F', heightMm:2800, plan:null, furniture:[], rooms:{}, demolished:[], measures:[]});
    }
    s.activeFloor = Math.max(0, Math.min(s.floors.length - 1, s.activeFloor|0));
  }
  s.floorCount = s.floors.length;
  s.floors.forEach(f => { if (f && !Array.isArray(f.links)) f.links = []; });
  // 旧「花园围墙」家具 → 矮围墙墙体
  const migrated = [];
  s.furniture = (s.furniture || []).filter(f => {
    if (!f || f.type !== 'gardenfence') return true;
    const rot = ((Number(f.rot) || 0) % 360 + 360) % 360;
    const snap = Math.round(rot / 90) * 90 % 360;
    let diff = Math.abs(rot - snap); if (diff > 180) diff = 360 - diff;
    if (diff > 25) return true; // 斜向保留家具，避免乱转墙
    const thick = Math.max(80, Math.min(280, Math.round((Math.min(f.w, f.d) || 200) / 10) * 10));
    const len = Math.max(500, Math.round((Math.max(f.w, f.d) || 1800) / 10) * 10);
    const w = (snap === 0 || snap === 180)
      ? [f.cx - len / 2, f.cy - thick / 2, f.cx + len / 2, f.cy + thick / 2, 'low', 1050]
      : [f.cx - thick / 2, f.cy - len / 2, f.cx + thick / 2, f.cy + len / 2, 'low', 1050];
    migrated.push(w.map((v, i) => i < 4 ? Math.round(v) : v));
    return false;
  });
  if (migrated.length){
    if (!s.plan) s.plan = typeof snapshotPlan === 'function' ? snapshotPlan() : {walls: []};
    s.plan.walls = (s.plan.walls || []).concat(migrated);
  }
  (s.furniture || []).forEach(f => {
    if (f && f.type === 'stairs'){
      f.style = stairsStyleOf(f);
      if (f.dir !== 'up' && f.dir !== 'down') f.dir = 'up';
      f.flip = !!f.flip;
    }
  });
  return s;
}

/* ======================= 墙面 / 墙纸材质 =======================
 * 每个键对应一套 1m × 1m 的可平铺程序化贴图（颜色 / 凹凸 / 粗糙度三通道）。
 * 3D 墙体按房间归属把材质贴到对应墙面；未选择时使用 plain。
 * ============================================================== */
const WALLPAPERS = {
  plain:      {name:'暖白乳胶漆',   price:35,  sw:'#f1eee8', base:'#f1eee8', style:'paint',     rough:.92, bump:.010},
  limewash:   {name:'艺术石灰漆',   price:120, sw:'#e7ded0', base:'#e8e0d2', style:'limewash',  rough:.90, bump:.022},
  microcement:{name:'微水泥',       price:180, sw:'#cbc5bb', base:'#cfc9c0', style:'cement',    rough:.80, bump:.018},
  clay:       {name:'硅藻泥',       price:150, sw:'#ddd3c1', base:'#ded4c3', style:'clay',      rough:1.0, bump:.034},
  linen:      {name:'亚麻壁纸',     price:95,  sw:'#e6ddcd', base:'#e7dece', style:'linen',     rough:.95, bump:.016},
  stripe:     {name:'竖条纹壁纸',   price:110, sw:'#eee8db', base:'#eee8dc', style:'stripe',    rough:.90, bump:.012},
  damask:     {name:'大马士革壁纸', price:220, sw:'#e8dfcc', base:'#eae1cf', style:'damask',    rough:.86, bump:.018},
  botanical:  {name:'植物花卉壁纸', price:160, sw:'#e9eee2', base:'#ecf0e6', style:'botanical', rough:.90, bump:.014},
  geo:        {name:'几何图案壁纸', price:130, sw:'#e6e4dc', base:'#e8e6df', style:'geo',       rough:.88, bump:.012},
  grasscloth: {name:'草编墙纸',     price:190, sw:'#d8c8a6', base:'#dac9a8', style:'grass',     rough:1.0, bump:.030},
  woodpanel:  {name:'木饰面板',     price:280, sw:'#c7a57c', base:'#c9a77e', style:'wood',      rough:.62, bump:.022},
  fluted:     {name:'木格栅',       price:320, sw:'#b99a73', base:'#bb9c75', style:'fluted',    rough:.68, bump:.040},
  wainscot:   {name:'欧式护墙板',   price:260, sw:'#eee7d9', base:'#efe9dd', style:'wainscot',  rough:.80, bump:.024},
  fabric:     {name:'布艺软包',     price:340, sw:'#d8cdbf', base:'#dad0c3', style:'fabric',    rough:1.0, bump:.030},
  brick:      {name:'文化砖',       price:200, sw:'#e2d9c9', base:'#e6ded0', style:'brick',     rough:.90, bump:.038},
  subwaywall: {name:'地铁砖墙面',   price:170, sw:'#efebe3', base:'#f0ece4', style:'subway',    rough:.42, bump:.024},
  stone:      {name:'文化石',       price:300, sw:'#cbc4b6', base:'#cfc8ba', style:'stone',     rough:.92, bump:.046},
  marblewall: {name:'大理石墙面',   price:380, sw:'#f0ede7', base:'#f2efe9', style:'marble',    rough:.32, bump:.012},
};

/** 房间当前墙纸键；未选择返回 null（3D 按 plain 渲染） */
function roomWallKey(r){
  const id = typeof r === 'string' ? r : (r && r.id);
  const st = (typeof state !== 'undefined' && state.rooms && state.rooms[id]) || null;
  const k = st && st.wallpaper;
  return (k && WALLPAPERS[k]) ? k : null;
}

/** 面板色板：用 CSS 渐变近似 3D 贴图的图案特征 */
function wallSwatch(key){
  const m = WALLPAPERS[key] || WALLPAPERS.plain, s = m.style;
  const glow = 'linear-gradient(150deg,rgba(255,255,255,.34),rgba(255,255,255,0) 55%,rgba(0,0,0,.16))';
  let tex;
  if (/stripe|fluted/.test(s)) tex = 'repeating-linear-gradient(90deg,rgba(0,0,0,.16) 0 2px,rgba(255,255,255,.28) 2px 5px,rgba(0,0,0,0) 5px 10px)';
  else if (/wood|wainscot/.test(s)) tex = 'repeating-linear-gradient(90deg,rgba(0,0,0,.22) 0 2px,rgba(0,0,0,0) 2px 16px),repeating-linear-gradient(0deg,rgba(255,255,255,.1) 0 1px,rgba(0,0,0,0) 1px 7px)';
  else if (/brick|subway|stone/.test(s)) tex = 'repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0 2px,rgba(0,0,0,0) 2px 13px),repeating-linear-gradient(90deg,rgba(0,0,0,.16) 0 2px,rgba(0,0,0,0) 2px 20px)';
  else if (/linen|grass|fabric|clay/.test(s)) tex = 'repeating-linear-gradient(45deg,rgba(255,255,255,.17) 0 2px,rgba(0,0,0,0) 2px 5px),repeating-linear-gradient(-45deg,rgba(0,0,0,.14) 0 2px,rgba(0,0,0,0) 2px 5px)';
  else if (/damask|botanical|geo/.test(s)) tex = 'radial-gradient(circle at 30% 30%,rgba(0,0,0,.16),rgba(0,0,0,0) 26%),radial-gradient(circle at 72% 70%,rgba(0,0,0,.14),rgba(0,0,0,0) 26%)';
  else if (/marble|cement|limewash/.test(s)) tex = 'repeating-linear-gradient(118deg,rgba(110,100,88,.14) 0 1px,rgba(0,0,0,0) 1px 12px),radial-gradient(circle at 35% 40%,rgba(255,255,255,.24),rgba(255,255,255,0) 40%)';
  else tex = 'linear-gradient(0deg,rgba(0,0,0,.05) 0 1px,rgba(0,0,0,0) 1px 4px),linear-gradient(90deg,rgba(255,255,255,.14) 0 1px,rgba(0,0,0,0) 1px 6px)';
  return `background-color:${m.sw};background-image:${tex},${glow}`;
}

function wpRng(seed){
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function wpShade(hex, k){
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n>>16&255)},${f(n>>8&255)},${f(n&255)})`;
}

/** 在三个画布上绘制一套 1m×1m 墙纸贴图；g=颜色 b=凹凸 r=粗糙度 */
function paintWallpaper(key, g, b, r, W, H){
  const m = WALLPAPERS[key] || WALLPAPERS.plain;
  const R = wpRng(key.length * 7919 + (key.charCodeAt(0) || 3) * 131 + (key.charCodeAt(key.length-1) || 7));
  const base = m.base, dark = wpShade(base, .84), light = wpShade(base, 1.08), deep = wpShade(base, .68);
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  b.fillStyle = '#808080'; b.fillRect(0, 0, W, H);
  const rb = Math.round(40 + m.rough * 180);
  r.fillStyle = `rgb(${rb},${rb},${rb})`; r.fillRect(0, 0, W, H);

  const fill3 = (x, y, w, h, gc, bc, rc) => {
    g.fillStyle = gc; g.fillRect(x, y, w, h);
    if (bc){ b.fillStyle = bc; b.fillRect(x, y, w, h); }
    if (rc){ r.fillStyle = rc; r.fillRect(x, y, w, h); }
  };
  const line3 = (x0, y0, x1, y1, gc, bc, lw) => {
    g.strokeStyle = gc; g.lineWidth = lw || 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    if (bc){ b.strokeStyle = bc; b.lineWidth = lw || 1; b.beginPath(); b.moveTo(x0, y0); b.lineTo(x1, y1); b.stroke(); }
  };
  const speck = (n, a) => {
    for (let i = 0; i < n; i++){
      const x = R()*W, y = R()*H;
      g.fillStyle = `rgba(0,0,0,${a*(.25+R())})`; g.fillRect(x, y, 1+R()*1.5, 1+R());
      b.fillStyle = `rgba(0,0,0,${.04+R()*.08})`; b.fillRect(x, y, 1, 1);
    }
  };
  const poly3 = (pts, gc, bc) => {
    g.fillStyle = gc; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
    if (bc){ b.fillStyle = bc; b.beginPath(); pts.forEach((p, i) => i ? b.lineTo(p[0], p[1]) : b.moveTo(p[0], p[1])); b.closePath(); b.fill(); }
  };

  switch (m.style){
    case 'paint': {
      // 细微滚涂云纹 + 颗粒，避免大面积墙面显得死平
      for (let k = 0; k < 55; k++){
        const x = R()*W, y = R()*H, w = 40+R()*150, h = 30+R()*120;
        g.globalAlpha = .012+R()*.02; g.fillStyle = R()>.5 ? light : dark;
        g.beginPath(); g.ellipse(x, y, w, h, R()*3, 0, 7); g.fill();
        b.globalAlpha = .02+R()*.035; b.fillStyle = R()>.5 ? '#919191' : '#6f6f6f';
        b.beginPath(); b.ellipse(x, y, w, h, 0, 0, 7); b.fill();
      }
      g.globalAlpha = b.globalAlpha = 1;
      speck(4200, .034);
      for (let k = 0; k < 26; k++){
        const x = R()*W, w = 8 + R()*30;
        fill3(x, 0, w, H, `rgba(255,255,255,${.014+R()*.024})`, `rgba(255,255,255,${.02+R()*.03})`, null);
      }
      break;
    }
    case 'limewash': {
      for (let k = 0; k < 100; k++){
        const x = R()*W, y = R()*H, w = 35+R()*160, h = 22+R()*95;
        g.globalAlpha = .03+R()*.07; g.fillStyle = R()>.5 ? light : dark;
        g.beginPath(); g.ellipse(x, y, w, h, R()*3, 0, 7); g.fill();
        b.globalAlpha = .05+R()*.07; b.fillStyle = R()>.5 ? '#a0a0a0' : '#666666';
        b.beginPath(); b.ellipse(x, y, w, h, 0, 0, 7); b.fill();
      }
      g.globalAlpha = b.globalAlpha = 1; speck(1800, .02);
      break;
    }
    case 'cement': {
      for (let k = 0; k < 150; k++){
        const x = R()*W, y = R()*H, w = 20+R()*130, h = 6+R()*40;
        fill3(x, y, w, h, R()>.5 ? `rgba(255,255,255,${.02+R()*.05})` : `rgba(0,0,0,${.02+R()*.05})`,
              R()>.5 ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.09)', null);
      }
      for (let k = 0; k < 34; k++){
        const x = R()*W, y = R()*H;
        line3(x, y, x+40+R()*120, y+8+R()*40, `rgba(255,255,255,${.04+R()*.06})`, 'rgba(255,255,255,.1)', 2+R()*3);
      }
      speck(2600, .022);
      break;
    }
    case 'clay': {
      speck(9000, .07);
      for (let k = 0; k < 1100; k++){
        const x = R()*W, y = R()*H, w = 3+R()*6;
        fill3(x, y, w, 2+R()*3, R()>.5 ? 'rgba(255,255,255,.24)' : 'rgba(0,0,0,.2)',
              R()>.5 ? '#b8b8b8' : '#4e4e4e', null);
      }
      for (let k = 0; k < 60; k++){
        const x = R()*W, y = R()*H;
        line3(x, y, x+6+R()*22, y+2+R()*8, 'rgba(0,0,0,.08)', '#6a6a6a', 1.5);
      }
      break;
    }
    case 'linen': {
      for (let y = 0; y < H; y += 5) line3(0, y, W, y, 'rgba(0,0,0,.11)', '#636363', 1.4);
      for (let x = 0; x < W; x += 6) line3(x, 0, x, H, 'rgba(255,255,255,.2)', '#a2a2a2', 1.2);
      speck(2200, .024);
      break;
    }
    case 'stripe': {
      const p = W/8;
      for (let k = 0; k < 8; k++){
        const x = k*p, alt = k%2;
        fill3(x, 0, p, H, alt ? light : dark, alt ? '#979797' : '#707070', alt ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)');
        fill3(x, 0, 3, H, 'rgba(74,64,52,.24)', '#4e4e4e', null);
        fill3(x+p-7, 0, 1.5, H, 'rgba(255,255,255,.4)', null, null);
      }
      speck(1200, .014);
      break;
    }
    case 'damask': {
      for (let row = -1; row < 5; row++) for (let col = -1; col < 5; col++){
        const cx = col*128+64, cy = row*128+64;
        for (let p = 0; p < 4; p++){
          const a = p*Math.PI/2;
          g.save(); g.translate(cx, cy); g.rotate(a); g.globalAlpha = .34; g.fillStyle = deep;
          g.beginPath(); g.ellipse(0, -27, 11, 31, 0, 0, 7); g.fill(); g.restore();
          b.save(); b.translate(cx, cy); b.rotate(a); b.fillStyle = '#606060';
          b.beginPath(); b.ellipse(0, -27, 11, 31, 0, 0, 7); b.fill(); b.restore();
        }
        g.fillStyle = 'rgba(120,104,80,.28)'; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill();
        b.fillStyle = '#5a5a5a'; b.beginPath(); b.arc(cx, cy, 9, 0, 7); b.fill();
        // 花间卷草连线，让图案更接近大马士革织纹
        g.strokeStyle = 'rgba(126,108,82,.26)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(cx-58, cy); g.bezierCurveTo(cx-32, cy-42, cx+32, cy-42, cx+58, cy); g.stroke();
        g.beginPath(); g.moveTo(cx, cy-58); g.bezierCurveTo(cx-42, cy-32, cx-42, cy+32, cx, cy+58); g.stroke();
      }
      speck(1100, .014);
      break;
    }
    case 'botanical': {
      for (let k = 0; k < 16; k++){
        const x = R()*W, y = R()*H;
        g.strokeStyle = 'rgba(88,116,84,.42)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x+45, y-55, x+95, y-115); g.stroke();
        for (let t = 0; t < 5; t++){
          const f = (t+1)/6, lx = x+95*f*f, ly = y-115*f, rot = (t%2 ? 1 : -1)*(.5+R()*.4);
          g.save(); g.translate(lx, ly); g.rotate(rot); g.fillStyle = `rgba(112,148,104,${.24+R()*.18})`;
          g.beginPath(); g.ellipse(0, 0, 8+R()*7, 20+R()*12, 0, 0, 7); g.fill();
          g.strokeStyle = 'rgba(70,100,66,.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0,-18); g.lineTo(0,18); g.stroke();
          g.restore();
          b.save(); b.translate(lx, ly); b.rotate(rot); b.fillStyle = '#909090';
          b.beginPath(); b.ellipse(0, 0, 9, 22, 0, 0, 7); b.fill(); b.restore();
        }
      }
      speck(1200, .012);
      break;
    }
    case 'geo': {
      for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++){
        const x = col*128, y = row*128;
        g.strokeStyle = 'rgba(112,104,88,.3)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x+128, y+128); g.moveTo(x+128, y); g.lineTo(x, y+128); g.stroke();
        b.strokeStyle = '#6f6f6f'; b.lineWidth = 1.6;
        b.beginPath(); b.moveTo(x, y); b.lineTo(x+128, y+128); b.stroke();
        g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x+64, y+18); g.lineTo(x+110, y+64); g.lineTo(x+64, y+110); g.lineTo(x+18, y+64); g.closePath(); g.stroke();
      }
      break;
    }
    case 'grass': {
      for (let y = 0; y < H; y += 7){
        const a = .05+R()*.09;
        g.strokeStyle = R()>.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
        g.lineWidth = 1+R()*2; g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x <= W; x += 24) g.lineTo(x, y + Math.sin(x*.05+y)*2.2);
        g.stroke();
        line3(0, y, W, y, 'rgba(0,0,0,0)', R()>.5 ? '#a2a2a2' : '#666666', 2);
      }
      for (let x = 0; x < W; x += 16) line3(x, 0, x, H, 'rgba(90,74,50,.09)', '#777777', 1);
      speck(2400, .02);
      break;
    }
    case 'wood': {
      const p = W/4;
      for (let k = 0; k < 4; k++){
        const x = k*p;
        fill3(x, 0, p, H, k%2 ? wpShade(base, .94) : wpShade(base, 1.04), k%2 ? '#787878' : '#888888', null);
        for (let t = 0; t < 18; t++){
          const gx = x + 4 + R()*(p-8);
          g.strokeStyle = `rgba(70,48,28,${.05+R()*.13})`; g.lineWidth = .6+R()*1.6;
          g.beginPath(); g.moveTo(gx, 0);
          for (let y = 0; y <= H; y += 20) g.lineTo(gx + Math.sin(y*.018+t)*3, y);
          g.stroke();
          line3(gx, 0, gx, H, 'rgba(0,0,0,0)', 'rgba(0,0,0,.1)', 1);
        }
        fill3(x, 0, 3, H, 'rgba(48,32,18,.5)', '#3f3f3f', null);
        fill3(x+3, 0, 2, H, 'rgba(255,255,255,.28)', '#a9a9a9', null);
      }
      break;
    }
    case 'fluted': {
      const p = W/16;
      for (let k = 0; k < 16; k++){
        const x = k*p;
        const gg = g.createLinearGradient(x, 0, x+p, 0);
        gg.addColorStop(0, wpShade(base, .72)); gg.addColorStop(.35, wpShade(base, 1.06));
        gg.addColorStop(.6, wpShade(base, 1.12)); gg.addColorStop(1, wpShade(base, .78));
        g.fillStyle = gg; g.fillRect(x, 0, p, H);
        const bb = b.createLinearGradient(x, 0, x+p, 0);
        bb.addColorStop(0, '#3c3c3c'); bb.addColorStop(.5, '#d2d2d2'); bb.addColorStop(1, '#3c3c3c');
        b.fillStyle = bb; b.fillRect(x, 0, p, H);
        const rr = r.createLinearGradient(x, 0, x+p, 0);
        rr.addColorStop(0, 'rgba(0,0,0,.12)'); rr.addColorStop(.5, 'rgba(255,255,255,.1)'); rr.addColorStop(1, 'rgba(0,0,0,.12)');
        r.fillStyle = rr; r.fillRect(x, 0, p, H);
      }
      break;
    }
    case 'wainscot': {
      for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++){
        const x = col*256+22, y = row*256+22, w = 212, h = 212;
        fill3(x, y, w, h, wpShade(base, 1.03), '#8c8c8c', 'rgba(255,255,255,.04)');
        g.strokeStyle = 'rgba(90,80,64,.32)'; g.lineWidth = 3; g.strokeRect(x+7, y+7, w-14, h-14);
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; g.strokeRect(x+11, y+11, w-22, h-22);
        b.strokeStyle = '#555555'; b.lineWidth = 3; b.strokeRect(x+7, y+7, w-14, h-14);
        b.strokeStyle = '#b8b8b8'; b.lineWidth = 1.5; b.strokeRect(x+11, y+11, w-22, h-22);
        fill3(x, y, w, 3, 'rgba(255,255,255,.5)', '#b0b0b0', null);
        fill3(x, y+h-3, w, 3, 'rgba(0,0,0,.18)', '#5c5c5c', null);
      }
      break;
    }
    case 'fabric': {
      for (let y = 0; y < H; y += 6){
        line3(0, y, W, y, 'rgba(0,0,0,.055)', '#707070', 2);
        line3(0, y+3, W, y+3, 'rgba(255,255,255,.1)', '#989898', 1);
      }
      for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++){
        const cx = col*128+64, cy = row*128+64;
        const gg = g.createRadialGradient(cx, cy, 2, cx, cy, 15);
        gg.addColorStop(0, 'rgba(60,50,40,.42)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gg; g.beginPath(); g.arc(cx, cy, 15, 0, 7); g.fill();
        b.fillStyle = '#4a4a4a'; b.beginPath(); b.arc(cx, cy, 6, 0, 7); b.fill();
      }
      speck(1800, .018);
      break;
    }
    case 'brick':
    case 'subway': {
      const bw = m.style === 'subway' ? 160 : 128, bh = 64;
      const gloss = m.style === 'subway';
      for (let row = 0; row <= H/bh; row++) for (let col = -1; col <= W/bw; col++){
        const x = col*bw + (row%2 ? bw/2 : 0), y = row*bh;
        const c = R()>.5 ? wpShade(base, 1.05) : wpShade(base, .95);
        fill3(x+3, y+3, bw-6, bh-6, c, gloss ? '#9c9c9c' : '#8d8d8d', gloss ? 'rgba(0,0,0,.16)' : null);
        fill3(x+3, y+bh-6, bw-6, 3, 'rgba(0,0,0,.16)', '#565656', null);
        fill3(x+3, y+3, bw-6, 2, 'rgba(255,255,255,.42)', '#b6b6b6', null);
        if (gloss){ fill3(x+8, y+8, bw-22, 6, 'rgba(255,255,255,.3)', null, 'rgba(255,255,255,.12)'); }
        else { speck(60, .03); }
      }
      break;
    }
    case 'stone': {
      const cw = 128, ch = 96;
      for (let row = -1; row <= H/ch; row++) for (let col = -1; col <= W/cw; col++){
        const x = col*cw + (row%2 ? 40 : 0), y = row*ch;
        const j = () => (R()-.5)*18;
        const pts = [[x+6+j(), y+6+j()], [x+cw-6+j(), y+4+j()], [x+cw-4+j(), y+ch-8+j()], [x+8+j(), y+ch-4+j()]];
        poly3(pts, R()>.5 ? wpShade(base, 1.07) : wpShade(base, .9), R()>.5 ? '#9a9a9a' : '#6d6d6d');
        g.strokeStyle = 'rgba(70,64,54,.35)'; g.lineWidth = 2;
        g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.stroke();
        b.strokeStyle = '#4c4c4c'; b.lineWidth = 2;
        b.beginPath(); pts.forEach((p, i) => i ? b.lineTo(p[0], p[1]) : b.moveTo(p[0], p[1])); b.closePath(); b.stroke();
      }
      speck(2200, .022);
      break;
    }
    case 'marble': {
      for (let k = 0; k < 40; k++){
        const x = R()*W, y = R()*H, w = 60+R()*220, h = 14+R()*55;
        g.globalAlpha = .03+R()*.05; g.fillStyle = R()>.5 ? '#ffffff' : '#b8b2a6';
        g.beginPath(); g.ellipse(x, y, w, h, -.5, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
      for (let k = 0; k < 12; k++){
        const x = -100+R()*W, y = R()*H;
        g.strokeStyle = `rgba(150,142,128,${.12+R()*.16})`; g.lineWidth = .8+R()*2.4;
        g.beginPath(); g.moveTo(x, y);
        for (let t = 0; t <= W+200; t += 22) g.lineTo(x+t, y + Math.sin(t*.016+k)*14 + Math.sin(t*.047+k*2)*5);
        g.stroke();
        b.strokeStyle = 'rgba(0,0,0,.08)'; b.lineWidth = 1;
        b.beginPath(); b.moveTo(x, y); for (let t = 0; t <= W+200; t += 30) b.lineTo(x+t, y + Math.sin(t*.016+k)*14); b.stroke();
      }
      r.fillStyle = 'rgba(0,0,0,.18)'; r.fillRect(0, 0, W, H);
      break;
    }
  }
}
