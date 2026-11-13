/* ============================================================
 *  多层户型：每层独立平面/家具。
 *  2D 与 3D 鸟瞰只显示当前选中层；漫游时才堆叠整栋。
 *  每层的 links 是「本层 ↔ 上一层」的连通区域，上一层楼板会在此挖空。
 * ============================================================ */
const FLOOR_H_DEFAULT = 2800; // mm，层高

function emptyFloorRecord(id, name){
  const plan = typeof emptyPlanSnapshot === 'function'
    ? emptyPlanSnapshot()
    : {walls:[], wins:[], doors:[], slides:[], rooms:[], underlay:[], bounds:{x:-800,y:-800,w:19600,h:13600},
       hasDefaultDims:false, hasBayLintels:false, hasEntryMark:false, cadMode:false, tracing:true};
  return {
    id: id || 'F1',
    name: name || '1F',
    heightMm: FLOOR_H_DEFAULT,
    plan,
    furniture: [],
    rooms: {},
    demolished: [],
    measures: [],
    bgImage: null,
    bgOpacity: 0.35,
    bgScale: 1.5,
    bgFrame: null,
    bgAspect: null,
    links: [],          // [{id, rect:[x0,y0,x1,y1]}]：与上一层连通的区域
  };
}

/** 把当前编辑态写入一层快照（不改 activeFloor） */
function captureFloorFromState(meta){
  try { if (typeof snapshotPlan === 'function') state.plan = snapshotPlan(); } catch (e) {}
  const prev = (state.floors && state.floors[state.activeFloor|0]) || {};
  return {
    id: (meta && meta.id) || prev.id || 'F1',
    name: (meta && meta.name) || prev.name || '1F',
    heightMm: Math.max(2200, Math.min(4000, +((meta && meta.heightMm) || prev.heightMm || FLOOR_H_DEFAULT) || FLOOR_H_DEFAULT)),
    plan: state.plan ? JSON.parse(JSON.stringify(state.plan)) : (typeof emptyPlanSnapshot === 'function' ? emptyPlanSnapshot() : null),
    furniture: JSON.parse(JSON.stringify(state.furniture || [])),
    rooms: JSON.parse(JSON.stringify(state.rooms || {})),
    demolished: (state.demolished || []).slice(),
    measures: JSON.parse(JSON.stringify(state.measures || [])),
    bgImage: state.bgImage || null,
    bgOpacity: state.bgOpacity,
    bgScale: state.bgScale,
    bgFrame: state.bgFrame ? {...state.bgFrame} : null,
    bgAspect: state.bgAspect,
    // links 直接存在楼层记录上（不进入全局编辑态），打包快照时必须保留
    links: JSON.parse(JSON.stringify(prev.links || (meta && meta.links) || [])),
  };
}

/** 将一层快照恢复为当前编辑态 */
function applyFloorToState(floor){
  if (!floor) return;
  const plan = floor.plan || (typeof emptyPlanSnapshot === 'function' ? emptyPlanSnapshot() : {walls:[]});
  if (typeof applyPlanGeometry === 'function'){
    applyPlanGeometry(plan, {
      imported: !plan.hasDefaultDims,
      allowEmpty: true,
      allowEmptyRooms: true,
    });
  }
  state.plan = typeof snapshotPlan === 'function' ? snapshotPlan() : plan;
  state.furniture = JSON.parse(JSON.stringify(floor.furniture || []));
  state.rooms = JSON.parse(JSON.stringify(floor.rooms || {}));
  state.demolished = (floor.demolished || []).slice();
  state.measures = JSON.parse(JSON.stringify(floor.measures || []));
  state.bgImage = floor.bgImage || null;
  state.bgOpacity = floor.bgOpacity != null ? floor.bgOpacity : 0.35;
  state.bgScale = floor.bgScale != null ? floor.bgScale : 1.5;
  state.bgFrame = floor.bgFrame ? {...floor.bgFrame} : null;
  state.bgAspect = floor.bgAspect > 0 ? +floor.bgAspect : null;
  if (typeof ensurePlanFromState === 'function') ensurePlanFromState();
}

function packActiveFloor(){
  if (!state) return;
  if (!Array.isArray(state.floors) || !state.floors.length) ensureFloors();
  const i = Math.max(0, Math.min(state.floors.length - 1, state.activeFloor|0));
  state.activeFloor = i;
  const meta = {id: state.floors[i].id, name: state.floors[i].name, heightMm: state.floors[i].heightMm};
  state.floors[i] = captureFloorFromState(meta);
}

/** 迁移旧方案 / 保证至少两层 */
function ensureFloors(){
  if (!state) return;
  // 每层 links 各自独立：1F 的连通区是「与上层对齐的锚点」，是合法数据。
  // 旧版会把下层 links 上移到上层并清空 1F，既破坏 1F 连通区，又因 slice()
  // 浅拷贝让两层共用同一个 link 对象（改一层另一层跟着变）—— 该迁移已移除。
  // 兼容旧字段 combineFloors3d（旧存档默认 true），但显示策略改由 wholeBuilding3d / 漫游模式决定
  if (state.combineFloors3d == null) state.combineFloors3d = true;
  if (state.wholeBuilding3d == null) state.wholeBuilding3d = false;
  // state.floorCount 由「新建方案」写入（1–3）；未声明时沿用旧逻辑：至少两层
  const declared = Math.max(0, Math.min(6, state.floorCount | 0));
  if (Array.isArray(state.floors) && state.floors.length >= 1){
    const target = declared > 0 ? declared : Math.max(2, state.floors.length);
    while (state.floors.length < target){
      const n = state.floors.length + 1;
      const fl = emptyFloorRecord('F' + n, n + 'F');
      const base = state.floors[0];
      if (base?.plan?.bounds) fl.plan.bounds = {...base.plan.bounds};
      state.floors.push(fl);
    }
    // 深层隔离：每层的 links 数组、每个 link 对象、每个 rect 都必须是独立副本，
    // 杜绝旧存档里两层共用同一对象导致「编辑一层、另一层跟着变」。
    state.floors.forEach(f => {
      if (!f) return;
      const ls = Array.isArray(f.links) ? f.links : [];
      f.links = ls.map(l => (l && Array.isArray(l.rect)) ? {id: l.id, rect: l.rect.slice()} : l).filter(Boolean);
    });
    if (state.activeFloor == null || state.activeFloor < 0 || state.activeFloor >= state.floors.length)
      state.activeFloor = 0;
    state.floorCount = state.floors.length;
    // 兼容：floors 已有但顶层 plan/furniture 仍是权威时，用当前态刷新 active
    return;
  }
  // 旧存档：当前 state 即 1F，再挂空 2F
  try { if (typeof snapshotPlan === 'function') state.plan = snapshotPlan(); } catch (e) {}
  const f1 = captureFloorFromState({id:'F1', name:'1F', heightMm: FLOOR_H_DEFAULT});
  const f2 = emptyFloorRecord('F2', '2F');
  if (f1.plan?.bounds) f2.plan.bounds = {...f1.plan.bounds};
  state.floors = [f1, f2];
  state.activeFloor = 0;
  state.floorCount = state.floors.length;
}

function switchFloor(idx, opts){
  ensureFloors();
  idx = Math.max(0, Math.min(state.floors.length - 1, idx|0));
  if (idx === (state.activeFloor|0) && !(opts && opts.force)) return false;
  packActiveFloor();
  state.activeFloor = idx;
  applyFloorToState(state.floors[idx]);
  if (typeof ui !== 'undefined'){ ui.sel = null; ui.linkSel = null; }
  if (!(opts && opts.keepHistory)){
    if (typeof undoStack !== 'undefined') undoStack.length = 0;
    if (typeof redoStack !== 'undefined') redoStack.length = 0;
  }
  if (typeof save === 'function') save();
  if (typeof markDesignDirty === 'function') markDesignDirty();
  if (typeof validateSel === 'function') validateSel();
  if (typeof renderOpenings === 'function') renderOpenings();
  if (typeof renderDims === 'function') renderDims();
  if (typeof renderAll === 'function') renderAll();
  if (typeof syncModeHint === 'function') syncModeHint();   // 切层后刷新工具提示（底层文案不同）
  if (typeof syncBgControlsUi === 'function') syncBgControlsUi();
  if (typeof syncFloorUi === 'function') syncFloorUi();
  if (window.View3D?.sync) window.View3D.sync(true);
  if (!(opts && opts.silent) && typeof toast === 'function'){
    const nm = state.floors[idx].name || ((idx + 1) + 'F');
    toast(tr(`当前编辑：${nm}`, `Editing: ${nm}`));
  }
  return true;
}

/** 鸟瞰下手动预览整栋（默认关，仅当前层）；漫游模式一定显示整栋 */
function setWholeBuilding3d(on){
  ensureFloors();
  state.wholeBuilding3d = !!on;
  if (typeof save === 'function') save();
  if (typeof syncFloorUi === 'function') syncFloorUi();
  if (window.View3D?.sync) window.View3D.sync(true);
  if (typeof toast === 'function') toast(on
    ? tr('鸟瞰预览整栋（漫游始终显示整栋）', 'Previewing the whole building in orbit (walk always shows all floors)')
    : tr('鸟瞰只显示当前楼层', 'Orbit shows the active floor only'));
}
// 旧调用点兼容
function setCombineFloors3d(on){ setWholeBuilding3d(on); }

function floorHeightM(floor){
  const mm = floor && Number.isFinite(+floor.heightMm) ? +floor.heightMm : FLOOR_H_DEFAULT;
  return Math.max(2.2, Math.min(4.0, mm / 1000));
}

/** 合层时各层楼板世界坐标 Y（米） */
function floorBaseYs(){
  ensureFloors();
  const ys = [];
  let y = 0;
  state.floors.forEach(fl => { ys.push(y); y += floorHeightM(fl); });
  return ys;
}

function syncFloorUi(){
  ensureFloors();
  const i = state.activeFloor|0;
  const seg = $('#floorSeg');
  // 楼层数可变（新建方案时的「层数」）：按钮按 state.floors 动态生成
  if (seg && seg.children.length !== state.floors.length){
    seg.innerHTML = state.floors.map((f, k) =>
      `<button class="btn chip${k === i ? ' on' : ''}" data-floor="${k}" title="${tr('切换到', 'Switch to')} ${esc(f.name || ((k + 1) + 'F'))}">${esc(f.name || ((k + 1) + 'F'))}</button>`
    ).join('');
    seg.querySelectorAll('[data-floor]').forEach(b => b.onclick = () => switchFloor(+b.dataset.floor));
  }
  if (seg) seg.querySelectorAll('[data-floor]').forEach(b => b.classList.toggle('on', +b.dataset.floor === i));
  const comb = $('#whole3d');
  if (comb){
    comb.classList.toggle('on', !!state.wholeBuilding3d);
    comb.style.display = state.floors.length > 1 ? '' : 'none';
  }
  const hIn = $('#floorHIn');
  if (hIn) hIn.value = state.floors[i]?.heightMm || FLOOR_H_DEFAULT;
  const linkBtn = document.querySelector('#tools [data-tool="link"]');
  if (linkBtn){
    // 多层方案一律显示：连通区定义在有下层的楼层，但在任何层都能选中 / 编辑它来对齐
    linkBtn.style.display = state.floors.length > 1 ? '' : 'none';
  }
  // 楼层数变化会影响「连通区」参数组是否可用，保持顶栏显隐同步
  if (typeof syncToolOptions === 'function') syncToolOptions();
}

/** 临时套用某层几何到全局 WALLS/ROOMS/state，执行完后还原（供 3D 合层构建） */
function withFloorData(floor, fn){
  if (!floor) return fn();
  const bak = {
    WALLS, WINS, DOORS, SLIDES, ROOMS, CAD_UNDERLAY, BOUNDS, planFlags,
    furniture: state.furniture,
    rooms: state.rooms,
    demolished: state.demolished,
    measures: state.measures,
    plan: state.plan,
  };
  applyFloorToState(floor);
  try { return fn(); }
  finally {
    WALLS = bak.WALLS; WINS = bak.WINS; DOORS = bak.DOORS; SLIDES = bak.SLIDES;
    ROOMS = bak.ROOMS; CAD_UNDERLAY = bak.CAD_UNDERLAY; BOUNDS = bak.BOUNDS;
    planFlags = bak.planFlags;
    state.furniture = bak.furniture;
    state.rooms = bak.rooms;
    state.demolished = bak.demolished;
    state.measures = bak.measures;
    state.plan = bak.plan;
  }
}

/** 3D 是否需要堆叠整栋：漫游一定整栋；鸟瞰需手动开「整栋」 */
function threeDShowWhole(){
  try {
    if (window.View3D && typeof window.View3D.walking === 'function' && window.View3D.walking()) return true;
  } catch (e) {}
  return !!state.wholeBuilding3d;
}
/** 3D 构建用的楼层列表：鸟瞰/2D 只要当前层，漫游才返回整栋 */
function floorsFor3D(){
  ensureFloors();
  packActiveFloor();
  if (state.floors.length > 1 && threeDShowWhole()) return state.floors.slice();
  const i = Math.max(0, Math.min(state.floors.length - 1, state.activeFloor|0));
  return [state.floors[i]];
}

/* ---------------- 层间连通区域 ----------------
 * 语义：每层都有自己独立的 links。1F 是「与上层对齐的锚点」（不挖地面），
 * 2F+ 是本层楼板开洞。两层数据在 2D 中互不影响，3D 由建筑各自平移使连通区重合。 */
function floorLinks(floor){
  return (floor && Array.isArray(floor.links)) ? floor.links : [];
}
function validLinkRect(r){
  return Array.isArray(r) && r.length === 4 && r.every(Number.isFinite) && r[2] > r[0] + 50 && r[3] > r[1] + 50;
}
/** 该层楼板要挖空的矩形：本层定义的连通区域（洞开在本层楼板）。
 *  底层（1F）地面不挖洞，其连通区只作为「与上层对齐的锚点」。 */
function voidRectsForFloor(floor){
  const i = state.floors.indexOf(floor);
  if (i <= 0) return [];
  return floorLinks(floor).map(l => l.rect).filter(validLinkRect);
}
/** 本层与下一层的连通区域（漫游楼梯兜底） */
function linkRectsForFloor(floor){
  return floorLinks(floor).map(l => l.rect).filter(validLinkRect);
}
/** 第 i 层连通区所连通的相邻楼层显示名：1F 指向上层（2F），其余层指向下一层。
 *  名称一律取自相邻层自身，避免出现不存在的「0F」。 */
function linkPeerName(i){
  const j = (i === 0) ? 1 : i - 1;
  const f = state.floors && state.floors[j];
  return (f && f.name) || ((j + 1) + 'F');
}
function addFloorLink(rect){
  ensureFloors();
  const i = state.activeFloor | 0;
  if (!validLinkRect(rect)) return false;
  const b = snap();
  const fl = state.floors[i];
  if (!Array.isArray(fl.links)) fl.links = [];
  fl.links.push({id: 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), rect: rect.slice()});
  commit(b);
  if (typeof renderAll === 'function') renderAll();
  if (window.View3D?.sync) window.View3D.sync(true);
  const isGround = i === 0, peerNm = linkPeerName(i);
  if (typeof toast === 'function') toast(tr(
    isGround ? `已添加连通区：与上层（${peerNm}）对齐的锚点，3D 将据此对齐上下两层` : `已添加连通区：本层楼板将在此开洞（与 ${peerNm} 连通）`,
    isGround ? `Link anchor added: aligns with ${peerNm} above; floors align to it in 3D` : `Link added: this floor's slab will be cut out here (linked to ${peerNm})`));
  return true;
}
function removeFloorLink(idx, floorIdx){
  ensureFloors();
  const f = (floorIdx == null) ? (state.activeFloor | 0) : (floorIdx | 0);
  const fl = state.floors[f];
  if (!fl || !Array.isArray(fl.links) || !fl.links[idx]) return;
  const b = snap();
  fl.links.splice(idx, 1);
  if (typeof ui !== 'undefined') ui.linkSel = null;
  commit(b);
  if (typeof renderAll === 'function') renderAll();
  if (window.View3D?.sync) window.View3D.sync(true);
  if (typeof toast === 'function') toast(tr('已删除连通区域', 'Link area removed'));
}
function clearFloorLinks(){
  ensureFloors();
  const fl = state.floors[state.activeFloor | 0];
  if (!fl || !fl.links || !fl.links.length) return;
  if (!confirm(tr('清除当前楼层的所有连通区域？', 'Clear all link areas on this floor?'))) return;
  const b = snap();
  fl.links = [];
  if (typeof ui !== 'undefined') ui.linkSel = null;
  commit(b);
  if (typeof renderAll === 'function') renderAll();
  if (window.View3D?.sync) window.View3D.sync(true);
  if (typeof toast === 'function') toast(tr('已清除连通区域', 'Link areas cleared'));
}

/** 平移当前楼层全部几何（墙 / 门窗 / 房间 / 家具 / 连通区 / 测量 / 底图框 / 包围盒），
 *  用于上下层对齐：拖动连通区内部时移动整层，而不是改动另一层的连通区。 */
function shiftActiveFloor(dx, dy){
  dx = Math.round(dx / 10) * 10; dy = Math.round(dy / 10) * 10;
  if (!dx && !dy) return false;
  const shR = r => { if (r){ r[0] += dx; r[1] += dy; r[2] += dx; r[3] += dy; } };
  const shP = p => { if (p){ p[0] += dx; p[1] += dy; } };
  if (Array.isArray(WALLS)) WALLS.forEach(w => shR(w));
  if (Array.isArray(WINS)) WINS.forEach(w => shR(w));
  if (Array.isArray(DOORS)) DOORS.forEach(d => { shR(d.rect); shP(d.h); });
  if (Array.isArray(SLIDES)) SLIDES.forEach(s => shR(s.rect));
  if (Array.isArray(ROOMS)) ROOMS.forEach(r => { if (r.poly) r.poly.forEach(shP); shP(r.at); });
  (state.furniture || []).forEach(f => { f.cx += dx; f.cy += dy; });
  (state.measures || []).forEach(m => { if (m.a){ m.a.x += dx; m.a.y += dy; } if (m.b){ m.b.x += dx; m.b.y += dy; } });
  const fl = state.floors && state.floors[state.activeFloor | 0];
  if (fl && Array.isArray(fl.links)) fl.links.forEach(l => shR(l.rect));
  if (typeof BOUNDS !== 'undefined' && BOUNDS){ BOUNDS.x += dx; BOUNDS.y += dy; }
  if (state.bgFrame){ state.bgFrame.x += dx; state.bgFrame.y += dy; }
  if (Array.isArray(CAD_UNDERLAY)) CAD_UNDERLAY.forEach(l => {
    if (!l) return;
    if (l.length === 4 && l.every(Number.isFinite)) shR(l);
    else l.forEach(shP);
  });
  return true;
}

function bindFloorUi(){
  ensureFloors();
  document.querySelectorAll('#floorSeg [data-floor]').forEach(b => {
    b.onclick = () => switchFloor(+b.dataset.floor);
  });
  const comb = $('#whole3d');
  if (comb) comb.onclick = () => setWholeBuilding3d(!state.wholeBuilding3d);
  const hIn = $('#floorHIn');
  if (hIn){
    const syncH = () => {
      ensureFloors();
      const fl = state.floors[state.activeFloor|0];
      hIn.value = fl?.heightMm || FLOOR_H_DEFAULT;
    };
    syncH();
    const apply = () => {
      ensureFloors();
      packActiveFloor();
      const fl = state.floors[state.activeFloor|0];
      fl.heightMm = Math.max(2200, Math.min(4000, Math.round((+hIn.value || FLOOR_H_DEFAULT) / 10) * 10));
      hIn.value = fl.heightMm;
      if (typeof save === 'function') save();
      if (window.View3D?.sync) window.View3D.sync(true);
      if (typeof toast === 'function') toast(tr(`层高 ${fl.heightMm} mm`, `Floor height ${fl.heightMm} mm`));
    };
    hIn.onchange = apply;
    hIn.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); apply(); hIn.blur(); } };
  }
  syncFloorUi();
}
