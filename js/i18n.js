/* ======================= 多语言（中文 / English，默认中文） ======================= */
const LANG_KEY = 'huxing-lang';
const LANGS = ['zh', 'en'];                    // 中文 / English
let LANG = (() => {
  try {
    let l = localStorage.getItem(LANG_KEY);
    if (l === 'zht') l = 'zh';                 // 旧「繁」并入「中」
    return LANGS.includes(l) ? l : 'zh';
  } catch(e) { return 'zh'; }
})();
const tr = (zh, en) => LANG === 'en' ? en : zh;
// 内置的房间 / 材料 / 家具名称存的是中文；英文界面下显示译名，用户自己改过的名称原样显示
const NAMES_EN = {
  '主卧室':'Master Bedroom', '主卫浴':'Master Bath', '小孩房':"Kids' Room", '客卫浴':'Guest Bath', '洗衣阳台':'Laundry Balcony',
  '子女房':"Children's Room", '厨房':'Kitchen', '餐厅':'Dining', '过道':'Hallway', '客厅':'Living Room', '休闲阳台':'Leisure Balcony',
  '主卧飘窗':'Master Bay Window', '子女房飘窗':"Children's Bay Window",
  '橡木地板':'Oak Flooring', '枫木地板':'Maple Flooring', '胡桃木地板':'Walnut Flooring', '浅灰木地板':'Grey Wood Flooring',
  '人字拼地板':'Herringbone Flooring', '竹地板':'Bamboo Flooring',
  '800 地砖':'800 Tile', '600 地砖':'600 Tile', '抛光瓷砖':'Polished Porcelain', '大理石':'Marble',
  '洞石':'Travertine', '岩板':'Slate', '300 防滑砖':'300 Anti-slip Tile', '六角砖':'Hex Tile',
  '马赛克':'Mosaic Tile', '水磨石':'Terrazzo', '微水泥':'Microcement', '满铺地毯':'Wall-to-wall Carpet',
  '鱼骨拼地板':'Chevron Flooring', '凡尔赛拼花':'Versailles Parquet', '烟熏木地板':'Smoked Oak Flooring',
  '软木地板':'Cork Flooring', '木纹砖':'Wood-look Tile (369 Stagger)', '花岗岩':'Granite',
  '复古花砖':'Encaustic Tile', '地铁砖':'Subway Tile', '青石板':'Bluestone', '花园瓷砖':'Garden Tile',
  '剑麻编织地毯':'Sisal Weave Carpet', '榻榻米':'Tatami Mat',
  // 墙面 / 墙纸
  '暖白乳胶漆':'Warm White Paint', '艺术石灰漆':'Limewash Paint', '微水泥':'Microcement Wall', '硅藻泥':'Diatom Mud',
  '亚麻壁纸':'Linen Wallpaper', '竖条纹壁纸':'Striped Wallpaper', '大马士革壁纸':'Damask Wallpaper',
  '植物花卉壁纸':'Botanical Wallpaper', '几何图案壁纸':'Geometric Wallpaper', '草编墙纸':'Grasscloth Wallpaper',
  '木饰面板':'Wood Veneer Panel', '木格栅':'Fluted Wood Panel', '欧式护墙板':'Classic Wainscoting',
  '布艺软包':'Upholstered Wall', '文化砖':'Culture Brick', '地铁砖墙面':'Subway Tile Wall',
  '文化石':'Stacked Stone', '大理石墙面':'Marble Wall',
  '卧室':'Bedroom', '餐厨':'Dining & Kitchen', '卫浴':'Bathroom', '家电':'Appliances', '书房 · 休闲':'Study & Leisure',
  '双人床':'Double Bed', '单人床':'Single Bed', '儿童床':'Kids Bed', '婴儿床':'Crib',
  '高端木床':'Premium Wood Bed', '高端梳妆台':'Premium Dressing Table',
  '床头柜':'Nightstand', '衣柜':'Wardrobe', '梳妆台':'Dresser', '床尾凳':'Bench Ottoman', '全身镜':'Full-length Mirror',
  '书桌':'Desk', '椅子':'Chair', '书架':'Bookshelf', '飘窗垫':'Bay Cushion', '床头收纳柜':'Bedside Cabinet',
  '沙发':'Sofa', '转角沙发':'Corner Sofa', '单人沙发':'Armchair', '休闲躺椅':'Chaise Lounge', '懒人沙发':'Beanbag',
  '双人沙发':'Loveseat', '模块组合沙发':'Modular Sectional', '弧形沙发':'Curved Sofa', '贵妃榻':'Chaise Longue',
  '蛋形休闲椅':'Egg Chair', '摇椅':'Rocking Chair', '蒲团坐垫':'Floor Cushion', '鼓墩':'Drum Stool',
  '茶几':'Coffee Table', '组合圆茶几':'Nesting Coffee Tables', '边几':'Side Table', '玄关桌':'Console Table', '脚凳':'Ottoman',
  '茶水推车':'Bar Cart', '屏风':'Room Divider', '壁炉':'Fireplace', '落地音箱':'Floor Speaker', '装饰画':'Framed Artwork',
  '电视柜':'TV Stand', '地毯':'Rug', '鞋柜':'Shoe Cabinet', '玄关柜':'Entry Cabinet',
  '高端鞋柜':'Premium Shoe Cabinet',
  '落地灯':'Floor Lamp', '衣帽架':'Coat Rack', '绿植':'Plant', '展示柜':'Display Cabinet',
  '餐桌':'Dining Table', '圆桌':'Round Table', '餐椅':'Dining Chair', '长条凳':'Dining Bench', '岛台':'Kitchen Island',
  '吧椅':'Bar Stool', '橱柜':'Kitchen Counter', '橱柜台面':'Kitchen Counter', '燃气灶':'Gas Stove', '油烟机':'Range Hood',
  '水槽':'Sink', '冰箱':'Fridge', '餐边柜':'Sideboard', '酒柜':'Wine Cabinet', '微波炉':'Microwave', '洗碗机':'Dishwasher',
  '马桶':'Toilet', '智能马桶':'Smart Toilet', '浴室柜':'Vanity', '淋浴房':'Shower', '浴缸':'Bathtub',
  '洗衣机':'Washer', '电热水器':'Water Heater', '储物柜':'Storage Cabinet', '浴室镜':'Bath Mirror', '洗衣池':'Laundry Sink',
  '电视':'TV', '柜机空调':'Floor AC', '挂机空调':'Wall AC', '蒸烤箱高柜':'Oven Tower',
  '烘干机':'Dryer', '空气净化器':'Air Purifier', '洗烘一体':'Washer-Dryer', '燃气热水器':'Gas Water Heater',
  '办公椅':'Office Chair', '立式钢琴':'Upright Piano', '跑步机':'Treadmill', '阅读椅':'Reading Chair', '躺椅':'Recliner',
  '文件柜':'Filing Cabinet', '门':'Doors', '单开门':'Single Door', '卫生间门':'Bathroom Door', '入户门':'Entry Door', '推拉门':'Sliding Door',
  '花园门':'Garden Gate',
  '地板':'Flooring', '橡木地板':'Oak Floor', '枫木地板':'Maple Floor', '胡桃木地板':'Walnut Floor', '浅灰木地板':'Grey Wood Floor',
  '人字拼地板':'Herringbone Floor', '竹地板':'Bamboo Floor',
  '800 地砖':'800 Tile', '600 地砖':'600 Tile', '抛光瓷砖':'Polished Porcelain',
  '大理石':'Marble', '洞石':'Travertine', '岩板':'Slate', '300 防滑砖':'300 Anti-slip Tile', '六角砖':'Hex Tile',
  '马赛克':'Mosaic Tile', '水磨石':'Terrazzo', '微水泥':'Microcement', '满铺地毯':'Wall-to-wall Carpet',
  '灯光':'Lighting', '落地灯':'Floor Lamp', '弧形落地灯':'Arc Floor Lamp', '台灯':'Table Lamp', '床头台灯':'Bedside Lamp',
  '餐厅吊灯':'Dining Pendant', '单头吊灯':'Pendant Light', '枝形吊灯':'Chandelier', '吸顶灯':'Ceiling Light',
  '壁灯':'Wall Sconce', '镜前壁灯':'Vanity Wall Light', '轨道射灯':'Track Lights', '筒灯':'Downlight',
  '线性灯带':'LED Strip', '短灯带':'Short LED Strip', '灯带拐角':'LED Strip Corner',
  '水晶吊灯':'Crystal Chandelier', '玻璃球吊灯':'Globe Pendant', '笼式吊灯':'Cage Pendant',
  '洗墙落地灯':'Torchere Floor Lamp', '三脚架落地灯':'Tripod Floor Lamp',
  '银行台灯':"Banker's Desk Lamp", '云石球台灯':'Alabaster Globe Lamp', '双臂壁灯':'Double Sconce',
  '草坪灯':'Bollard Light', '庭院灯笼':'Garden Lantern',
  // 装饰
  '装饰':'Decor', '挂画':'Wall Art', '照片墙':'Gallery Wall', '装饰镜':'Decorative Mirror',
  '挂钟':'Wall Clock', '挂毯':'Wall Tapestry', '编织壁挂':'Macrame Wall Hanging', '壁挂搁板':'Wall Shelf',
  '落地花瓶':'Floor Vase', '抽象雕塑':'Abstract Sculpture', '烛台':'Candle Holder', '装饰托盘':'Decorative Tray',
  '留声机':'Gramophone', '碟片墙':'Record Wall',
  // 门扇材质
  '门型默认':'Door-type default', '暖白烤漆':'Warm White Lacquer', '原木色':'Natural Oak',
  '浅灰哑光':'Light Grey Matte', '黑色轻奢':'Matte Black', '玻璃门':'Glass Door',
  // 灯具调节
  '安装高度':'Mount height', '灯光亮度':'Brightness', '灯光色温':'Light tone',
  '暖黄光':'Warm Yellow', '暖白光':'Soft White', '中性光':'Neutral White', '冷白光':'Cool White', '琥珀光':'Amber Glow',
  '花园':'Garden', '盆栽花':'Flower Pot', '花箱':'Planter',
  '矮围墙':'Low wall',
  '花园长椅':'Garden Bench', '石凳':'Stone Bench', '户外餐桌':'Outdoor Dining Table', '户外圆桌':'Outdoor Round Table',
  '遮阳伞':'Patio Umbrella', '花园躺椅':'Garden Chaise',
  '烧烤炉':'BBQ Grill', '喷泉':'Fountain', '花架凉棚':'Pergola', '户外地垫':'Outdoor Mat',
  '庭院灯':'Garden Lamp', '晾衣架':'Clothes Rack',
  '乔木':'Ornamental Tree', '陶罐花器':'Terracotta Planter', '户外藤编沙发':'Outdoor Wicker Sofa',
  '户外藤编单椅':'Outdoor Wicker Chair', '吊篮椅':'Hanging Basket Chair', '吊床':'Hammock',
  '户外秋千':'Garden Swing', '户外吧台':'Outdoor Bar Counter', '遮阳帆':'Shade Sail',
  '六角凉亭':'Hexagonal Gazebo', '花架拱门':'Garden Arch', '攀爬花格':'Climbing Trellis',
  '户外火盆':'Fire Pit', '锦鲤水池':'Koi Pond', '叠水景墙':'Water Feature Wall',
  '鸟浴盆':'Birdbath', '景石假山':'Rockery', '汀步石路':'Stepping Stones', '木栈道':'Wooden Deck',
  '楼梯':'Stairs', '直楼梯':'Straight Stairs', '直角楼梯':'L-shaped Stairs', '回转楼梯':'U-shaped Stairs', '三跑楼梯':'Three-flight Stairs', '旋转楼梯':'Spiral Stairs',
  // 旧方案名称兼容
  '双人床 1.8m':'Double Bed 1.8m', '双人床 1.5m':'Double Bed 1.5m', '双人床 2.0m':'King Bed 2.0m',
  '三人沙发':'3-Seat Sofa', '双人沙发':'Loveseat', '四人沙发':'4-Seat Sofa', '大绿植':'Large Plant',
  '小衣柜':'Small Wardrobe', '大衣柜':'Large Wardrobe', '宽床头柜':'Wide Nightstand',
};
const nm = s => LANG === 'en' ? (NAMES_EN[s] ?? s) : s;
// 静态文案：元素上写 data-en / data-en-title，中文原文首次切换时存进 dataset
function applyStaticLang(){
  document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-CN';
  document.title = tr('FloorPlan-3dPlus', 'FloorPlan-3dPlus');
  document.querySelectorAll('[data-en]').forEach(el => { el.dataset.zh ??= el.textContent; el.textContent = tr(el.dataset.zh, el.dataset.en); });
  document.querySelectorAll('[data-en-title]').forEach(el => { el.dataset.zhTitle ??= el.title; el.title = tr(el.dataset.zhTitle, el.dataset.enTitle); });
  document.querySelectorAll('[data-lang]').forEach(b => { const on = b.dataset.lang === LANG; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
