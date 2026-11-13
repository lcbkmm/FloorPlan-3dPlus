/* ============================================================
 *  户型数据（单位 mm，原点 = 左侧外墙内皮 / 顶部外墙内皮）
 *  所有数值均按原始户型图尺寸标注推算：
 *  上：1580/240/2760/240/1540/240/3670 = 10270
 *  下：2180/240/2160/240/5450/240/1340 = 11850
 *  左：3370/1580/240/2770/240/2360 = 10560
 *  右：3370/240/2760/240/3950 = 10560
 * ============================================================ */
// 墙体：[x0,y0,x1,y1,类型,高度?]  b=承重 e=外墙 n=普通 win=带窗 low=矮围墙 beam=横梁
// low 时 w[5]=立面高度 mm（默认 1050）；beam 时 w[5]=自天花下垂 mm（默认 400）
let WALLS = [
  // 顶部外墙
  [1580,-240,2120,0,'b'],[1580,0,1820,300,'b'],[2120,-240,4580,0,'e'],[4580,-240,5140,0,'e'],
  [5760,-240,6050,0,'e'],[6050,-240,6600,0,'b'],[6360,0,6600,300,'b'],[6600,-240,9960,0,'e'],
  [9960,-240,10510,0,'b'],[10270,0,10510,300,'b'],
  // 右侧外墙
  [10270,300,10510,800,'e'],[10270,2600,10510,3090,'e'],[10270,3090,10510,4260,'b'],
  [10270,5740,10510,6370,'b'],[9960,6370,10510,6610,'b'],[10270,6610,10510,7400,'b'],
  [10270,9770,10510,10560,'b'],[9960,10560,10510,10800,'b'],
  // 底部 / 阳台
  [4580,10560,9960,10800,'e'],[10510,10560,12090,10800,'e'],[11850,9960,12090,10560,'e'],
  // 客厅左墙（入户门两侧）
  [4580,9200,4820,10560,'e'],[4580,7960,4820,8310,'e'],
  // 餐厅 / 厨房外墙
  [3620,7960,4580,8200,'e'],[2180,7960,3620,8200,'b'],[2180,7590,2420,7960,'b'],[2180,7400,2420,7590,'n'],
  [-240,7960,2180,8200,'e'],[-240,3610,0,7960,'e'],
  // 洗衣阳台
  [0,4950,200,5190,'n'],[200,4950,1275,5190,'low'],[1580,3370,2420,3825,'b'],
  [2180,4430,2420,5796,'n'],[2090,4950,2180,5190,'n'],
  // 客卫
  [2420,4950,4580,5190,'n'],[4580,3280,4820,4075,'n'],[4580,4860,4820,5190,'n'],[2420,3370,4580,3610,'n'],
  // 小孩房 / 主卫
  [4580,0,4820,2400,'n'],[4820,2080,6360,2320,'n'],[6360,300,6600,1198,'n'],[6360,1983,6600,2400,'n'],
  // 过道 / 主卧 / 子女房
  [6083,3370,6600,3707,'b'],[6360,3280,6600,3370,'n'],[6600,3370,9960,3610,'n'],[9960,3370,10270,3610,'b'],
  [6083,4600,6323,6610,'n'],[6323,6370,9960,6610,'n'],
];
// 窗
let WINS = [
  [5140,-240,5760,0],[1580,300,1820,3370],[-240,3370,1580,3610],[2180,3825,2420,4430],
  [10510,6370,12090,6610],[11850,6610,12090,9960],
  // 飘窗（主卧 / 子女房）
  [10510,660,11130,760],[11030,760,11130,2650],[10510,2650,11130,2750],
  [10510,4110,11130,4210],[11030,4210,11130,5785],[10510,5785,11130,5885],
];
// 平开门：洞口、铰点、关闭方向、开启方向、门宽
let DOORS = [
  {name:'小孩房门',rect:[4580,2400,4820,3280],h:[4580,3280],c:[0,-1],o:[-1,0],len:880},
  {name:'主卧门',rect:[6360,2400,6600,3280],h:[6600,3280],c:[0,-1],o:[1,0],len:880},
  {name:'主卫门',rect:[6360,1198,6600,1983],h:[6360,1198],c:[0,1],o:[-1,0],len:785},
  {name:'客卫门',rect:[4580,4075,4820,4860],h:[4580,4860],c:[0,-1],o:[-1,0],len:785},
  {name:'子女房门',rect:[6083,3707,6323,4600],h:[6323,4600],c:[0,-1],o:[1,0],len:893},
  {name:'入户门',rect:[4580,8310,4820,9200],h:[4820,9200],c:[0,-1],o:[1,0],len:890,entry:true},
];
// 推拉门
let SLIDES = [
  {rect:[10270,7400,10510,9770],v:true,leaves:2,slideTo:'start'},
  {rect:[1275,4950,2090,5190],v:false,leaves:2,slideTo:'start'},
];
const R = (x0,y0,x1,y1) => [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
let ROOMS = [
  {id:'master', name:'主卧室', poly:R(6600,0,10270,3370), mat:'wood', at:[8435,2420]},
  {id:'mbath', name:'主卫浴', poly:R(4820,0,6360,2080), mat:'antislip', at:[5980,1780]},
  {id:'kid', name:'小孩房', poly:R(1820,0,4580,3370), mat:'wood', at:[3380,2330]},
  {id:'gbath', name:'客卫浴', poly:R(2420,3610,4580,4950), mat:'antislip', at:[3760,4620]},
  {id:'laundry', name:'洗衣阳台', poly:R(0,3610,2180,4950), mat:'antislip', at:[1250,4330]},
  {id:'child', name:'子女房', poly:R(6323,3610,10270,6370), mat:'wood', at:[8850,4850]},
  {id:'kitchen', name:'厨房', poly:R(0,5190,2180,7960), mat:'tile600', at:[1300,6500]},
  {id:'dining', name:'餐厅', poly:[[2420,5190],[4820,5190],[4820,7960],[2420,7960],[2420,7400],[2180,7400],[2180,5796],[2420,5796]], mat:'tile800', at:[3900,5520]},
  {id:'hall', name:'过道', poly:[[4820,2320],[6360,2320],[6360,3370],[6083,3370],[6083,6610],[4820,6610]], mat:'tile800', at:[5450,4450]},
  {id:'living', name:'客厅', poly:R(4820,6610,10270,10560), mat:'tile800', at:[7600,7560]},
  {id:'balcony', name:'休闲阳台', poly:R(10510,6610,11850,10560), mat:'walnut', at:[11180,9450]},
  {id:'bay1', name:'主卧飘窗', poly:[[10270,800],[10510,800],[10510,760],[11030,760],[11030,2650],[10510,2650],[10510,2600],[10270,2600]], mat:'marble', counted:false},
  {id:'bay2', name:'子女房飘窗', poly:[[10270,4260],[10510,4260],[10510,4210],[11030,4210],[11030,5785],[10510,5785],[10510,5740],[10270,5740]], mat:'marble', counted:false},
];

let planFlags = {hasDefaultDims:true, hasBayLintels:true, hasEntryMark:true, cadMode:false, tracing:false};
let CAD_UNDERLAY = [];
function snapshotPlan(){
  return {
    walls: WALLS.map(w => w.slice()),
    wins: WINS.map(w => w.slice()),
    doors: DOORS.map(d => ({...d, rect:d.rect.slice(), h:d.h.slice(), c:d.c.slice(), o:d.o.slice()})),
    slides: SLIDES.map(s => ({...s, rect:s.rect.slice()})),
    rooms: ROOMS.map(r => {
      const st = (typeof state !== 'undefined' && state.rooms && state.rooms[r.id]) || null;
      return {
        ...r,
        name: (st && st.name) || r.name,
        mat: (st && st.mat != null && st.mat !== '') ? st.mat : (r.mat || null),
        wallpaper: (st && st.wallpaper) || null,
        poly: r.poly.map(p => p.slice()),
        at: r.at ? r.at.slice() : null,
      };
    }),
    underlay: (CAD_UNDERLAY || []).map(l => l.slice()),
    bounds: {...BOUNDS},
    hasDefaultDims: !!planFlags.hasDefaultDims,
    hasBayLintels: !!planFlags.hasBayLintels,
    hasEntryMark: !!planFlags.hasEntryMark,
    cadMode: !!planFlags.cadMode,
    tracing: !!planFlags.tracing,
  };
}
function isValidPlan(p, opts={}){
  if (!p || !Array.isArray(p.walls)) return false;
  if (!p.walls.length) return !!opts.allowEmpty;
  return p.walls.every(w =>
    Array.isArray(w) && w.length >= 4 && w.every((n, i) => i >= 4 || Number.isFinite(+n))
  );
}
function applyPlanGeometry(p, opts={}){
  if (!isValidPlan(p, opts)) return false;
  try {
    WALLS = p.walls.map(w => {
      const kind = w[4] || 'n';
      const out = [+w[0], +w[1], +w[2], +w[3], kind];
      if (kind === 'low'){
        const raw = Number.isFinite(+w[5]) ? +w[5] : 1050;
        out[5] = typeof clampLowWallHeight === 'function'
          ? clampLowWallHeight(raw)
          : Math.max(600, Math.min(2200, Math.round(raw / 10) * 10));
      }
      if (kind === 'beam'){
        const raw = Number.isFinite(+w[5]) ? +w[5] : 400;
        out[5] = typeof clampBeamDrop === 'function'
          ? clampBeamDrop(raw)
          : Math.max(150, Math.min(1800, Math.round(raw / 10) * 10));
      }
      return out;
    });
    WINS = (p.wins || []).filter(w => Array.isArray(w) && w.length >= 4).map(w => {
      const out = [+w[0], +w[1], +w[2], +w[3]];
      if (Number.isFinite(+w[4])) out[4] = +w[4]; // sill mm
      if (Number.isFinite(+w[5])) out[5] = +w[5]; // head mm
      if (Number.isFinite(+w[6])) out[6] = +w[6]; // host wall index
      return out;
    });
    DOORS = (p.doors || []).filter(d => d && Array.isArray(d.rect) && Array.isArray(d.h) && d.len > 0).map(d => {
      const gate = !!(d.gate || /花园门|garden\s*gate/i.test(d.name || ''));
      const defH = gate ? 2000 : 2100;
      const rawH = d.height != null ? +d.height : defH;
      const leaves = gate ? (+d.leaves === 1 ? 1 : 2) : undefined;
      return {
        ...d,
        rect: d.rect.map(Number),
        h: d.h.map(Number),
        c: (d.c || [0, -1]).map(Number),
        o: (d.o || [1, 0]).map(Number),
        len: +d.len,
        gate: gate || !!d.gate,
        height: typeof clampDoorHeight === 'function'
          ? clampDoorHeight(rawH, gate)
          : Math.max(gate ? 800 : 1600, Math.min(2700, Math.round(rawH / 10) * 10)),
        ...(gate ? {leaves} : {}),
      };
    });
    SLIDES = (p.slides || []).filter(s => s && Array.isArray(s.rect)).map(s => {
      const leaves = Math.round(+s.leaves);
      return {
        ...s,
        rect: s.rect.map(Number),
        height: typeof clampDoorHeight === 'function'
          ? clampDoorHeight(s.height != null ? +s.height : (s.v ? 2400 : 2100), false)
          : Math.max(1600, Math.min(2700, Math.round((s.height != null ? +s.height : (s.v ? 2400 : 2100)) / 10) * 10)),
        leaves: (leaves >= 1 && leaves <= 4) ? leaves : 2,
        slideTo: s.slideTo === 'end' ? 'end' : 'start',
      };
    });
    ROOMS = (p.rooms || []).filter(r => r && Array.isArray(r.poly) && r.poly.length >= 3).map(r => ({
      ...r,
      poly: r.poly.map(pt => [+pt[0], +pt[1]]),
      at: r.at ? [+r.at[0], +r.at[1]] : null,
    }));
    if (!ROOMS.length){
      if (opts.allowEmptyRooms || p.tracing){
        ROOMS = [];
        planFlags.tracing = true;
      } else if (WALLS.length){
        const xs = WALLS.flatMap(w => [w[0], w[2]]), ys = WALLS.flatMap(w => [w[1], w[3]]);
        const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
        ROOMS = [{id:'room1', name:'全屋', poly:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]], mat:null, at:[(x0+x1)/2,(y0+y1)/2]}];
        planFlags.tracing = false;
      } else {
        const b = (p.bounds && p.bounds.w > 0) ? p.bounds : {x:0, y:0, w:18000, h:12000};
        const x0 = +b.x, y0 = +b.y, x1 = x0 + +b.w, y1 = y0 + +b.h;
        ROOMS = [{id:'room1', name:'全屋', poly:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]], mat:null, at:[(x0+x1)/2,(y0+y1)/2]}];
        planFlags.tracing = false;
      }
    } else {
      planFlags.tracing = !!p.tracing;
    }
    if (p.bounds && Number.isFinite(p.bounds.w) && p.bounds.w > 0 && Number.isFinite(p.bounds.h) && p.bounds.h > 0) {
      BOUNDS = {x:+p.bounds.x, y:+p.bounds.y, w:+p.bounds.w, h:+p.bounds.h};
    } else if (WALLS.length) {
      const xs = WALLS.flatMap(w => [w[0], w[2]]), ys = WALLS.flatMap(w => [w[1], w[3]]);
      BOUNDS = {x:Math.min(...xs)-800, y:Math.min(...ys)-800, w:Math.max(...xs)-Math.min(...xs)+1600, h:Math.max(...ys)-Math.min(...ys)+1600};
    } else {
      BOUNDS = {x:-800, y:-800, w:19600, h:13600};
    }
    CAD_UNDERLAY = Array.isArray(p.underlay) ? p.underlay.map(l => l.slice()) : [];
    planFlags.hasDefaultDims = !!p.hasDefaultDims;
    planFlags.hasBayLintels = !!p.hasBayLintels;
    planFlags.hasEntryMark = !!p.hasEntryMark;
    planFlags.cadMode = !!p.cadMode || (opts.imported && CAD_UNDERLAY.length > 0);
    if (opts.imported){
      planFlags.hasDefaultDims = false;
      planFlags.hasBayLintels = false;
      planFlags.hasEntryMark = false;
      // Keep caller cadMode (false for image-trace); only force on when CAD underlay exists
      planFlags.cadMode = !!p.cadMode || CAD_UNDERLAY.length > 0;
    }
    if (typeof renderDims === 'function') renderDims();
    if (typeof renderOpenings === 'function') renderOpenings();
    if (typeof renderBg === 'function') renderBg();
    return true;
  } catch (err) {
    console.error('applyPlanGeometry failed', err);
    return false;
  }
}
let DEFAULT_PLAN = null;
let BOUNDS = {x:-1850, y:-1750, w:15600, h:14100};
DEFAULT_PLAN = snapshotPlan();
