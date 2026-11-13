function ensurePlanFromState(){
  let ok = false;
  if (state.plan && Array.isArray(state.plan.walls)) {
    ok = applyPlanGeometry(state.plan, {
      imported: !state.plan.hasDefaultDims,
      allowEmpty: state.plan.walls.length === 0,
      allowEmptyRooms: !!state.plan.tracing || (Array.isArray(state.plan.rooms) && state.plan.rooms.length === 0),
    });
    if (!ok) {
      console.warn('Stored plan is corrupt; using blank canvas');
      state.plan = null;
    }
  }
  if (!ok) {
    ok = applyPlanGeometry(emptyPlanSnapshot(), {imported:true, allowEmpty:true, allowEmptyRooms:true});
    state.plan = snapshotPlan();
  }
  // 对齐 state.rooms 与当前 ROOMS（CAD 导入后房间 id 会变）；未选择地面时保持 null，不默认铺砖
  // 自定义户型：一次性清掉旧版「按面积/名称自动铺砖」的结果，避免未选择却高亮材料
  const wipeAutoMats = !planFlags.hasDefaultDims && state._floorMatPolicy !== 1;
  const rooms = {};
  ROOMS.forEach(r => {
    const prev = state.rooms && state.rooms[r.id];
    const name = (prev && prev.name) || r.name;
    let mat = null;
    if (!wipeAutoMats){
      const raw = (prev && prev.mat != null && prev.mat !== '') ? prev.mat : (r.mat || null);
      mat = (raw && typeof MATS !== 'undefined' && MATS[raw]) ? raw : null;
    }
    r.mat = mat;
    const wp = (prev && prev.wallpaper && typeof WALLPAPERS !== 'undefined' && WALLPAPERS[prev.wallpaper]) ? prev.wallpaper : null;
    rooms[r.id] = { name, mat, wallpaper: wp };
  });
  state.rooms = rooms;
  if (wipeAutoMats) state._floorMatPolicy = 1;
}
const PX_MM = 25.4 / 96;                       // 1 CSS px = 0.2646 mm
const COARSE = matchMedia('(pointer:coarse)').matches;   // iPad / 手机等触屏为主的设备
const TAP = COARSE ? 9 : 4;                    // 手指按下后移动超过该像素才算拖动
const narrow = () => matchMedia('(max-width:1100px)').matches;
const $ = s => document.querySelector(s);
const svg = $('#plan');

/* ======================= 状态 / 历史 / 存储 ======================= */
// 打开软件默认空白画布（样板间仍可通过「重置为默认方案」加载）
let state = blankState();
const ui = {tool:'select', sel:null, mA:null, mCur:null, wallThick:240, wallKind:'n', lowWallH:1050, beamDropH:400,
  winW:0, winH:1500, winSill:900, drawA:null, drawCur:null, linkA:null, linkCur:null, linkSel:null, awaitMerge:null,
  layers:{dims:true, labels:true, furn:true, grid:false, bearing:false, cadLines:false, wallSnap:true}};
const WALL_KIND_LABEL = {
  n: () => tr('普通墙', 'Normal wall'),
  b: () => tr('承重墙', 'Bearing wall'),
  win: () => tr('带窗墙', 'Windowed wall'),
  low: () => tr('矮围墙', 'Low wall'),
  beam: () => tr('横梁', 'Beam'),
};
let view = {x0:0, y0:0, s:.06};
const undoStack = [], redoStack = [];
let designDirty = false;
let savedFingerprint = '';

function designFingerprint(){
  try {
    if (typeof packActiveFloor === 'function') packActiveFloor();
    return JSON.stringify({
      plan: state.plan, furniture: state.furniture, rooms: state.rooms,
      demolished: state.demolished, measures: state.measures,
      bgImage: state.bgImage ? '[img]' : null,
      bgOpacity: state.bgOpacity, bgScale: state.bgScale, bgFrame: state.bgFrame,
      floors: (state.floors || []).map(f => ({
        id: f.id, name: f.name, heightMm: f.heightMm,
        plan: f.plan, furniture: f.furniture, rooms: f.rooms,
        demolished: f.demolished, measures: f.measures, links: f.links,
        bgImage: f.bgImage ? '[img]' : null,
      })),
      activeFloor: state.activeFloor,
      combineFloors3d: !!state.combineFloors3d,
      wholeBuilding3d: !!state.wholeBuilding3d,
    });
  } catch (e) { return String(Date.now()); }
}
function markDesignClean(){
  designDirty = false;
  if (typeof packActiveFloor === 'function') packActiveFloor();
  savedFingerprint = designFingerprint();
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
}
function markDesignDirty(){
  designDirty = designFingerprint() !== savedFingerprint;
}
function isDesignDirty(){
  return designDirty || designFingerprint() !== savedFingerprint;
}
function save(){
  try {
    if (typeof packActiveFloor === 'function') packActiveFloor();
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch(e) {}
  // 同步落盘到「方案」记录（启动页卡片），防抖
  if (typeof scheduleProjectSave === 'function') scheduleProjectSave();
}
const snap = () => JSON.stringify(state);
function commit(before){ undoStack.push(before); if (undoStack.length > 150) undoStack.shift(); redoStack.length = 0; save(); markDesignDirty(); }
function mutate(fn){ const b = snap(); fn(); commit(b); renderAll(); }
/** 画墙厚度/类型/窗尺寸是工具偏好，不进撤销栈 */
function captureDrawPrefs(){
  return {wallThick: ui.wallThick, wallKind: ui.wallKind, winW: ui.winW, winH: ui.winH, winSill: ui.winSill};
}
function restoreDrawPrefs(prefs){
  if (!prefs) return;
  ui.wallThick = prefs.wallThick;
  ui.wallKind = prefs.wallKind;
  ui.winW = prefs.winW;
  ui.winH = prefs.winH;
  ui.winSill = prefs.winSill;
  const thickIn = $('#wallThickIn');
  if (thickIn) thickIn.value = ui.wallThick;
  document.querySelectorAll('#wallKind [data-kind]').forEach(x => x.classList.toggle('on', x.dataset.kind === ui.wallKind));
  if (typeof syncWallWinOptsUi === 'function') syncWallWinOptsUi();
  const wIn = $('#winWIn'), hIn = $('#winHIn'), sIn = $('#winSillIn');
  if (wIn) wIn.value = ui.winW;
  if (hIn) hIn.value = ui.winH;
  if (sIn) sIn.value = ui.winSill;
}
function undo(){
  if (!undoStack.length) return toast(tr('没有可撤销的操作', 'Nothing to undo'));
  const prefs = captureDrawPrefs();
  redoStack.push(snap());
  state = JSON.parse(undoStack.pop());
  ensurePlanFromState();
  validateSel();
  restoreDrawPrefs(prefs);
  save();
  markDesignDirty();
  renderOpenings();
  renderDims();
  renderAll();
  if (typeof syncBgControlsUi === 'function') syncBgControlsUi();
}
function redo(){
  if (!redoStack.length) return;
  const prefs = captureDrawPrefs();
  undoStack.push(snap());
  state = JSON.parse(redoStack.pop());
  ensurePlanFromState();
  validateSel();
  restoreDrawPrefs(prefs);
  save();
  markDesignDirty();
  renderOpenings();
  renderDims();
  renderAll();
  if (typeof syncBgControlsUi === 'function') syncBgControlsUi();
}
function validateSel(){
  if (ui.sel?.kind==='furn' && !getF(ui.sel.id)) ui.sel = null;
  if (ui.sel?.kind==='wall' && !getWall(ui.sel.id)) ui.sel = null;
  if (ui.sel?.kind==='win' && !WINS[ui.sel.id]) ui.sel = null;
  if (ui.sel?.kind==='door' && !DOORS[ui.sel.id]) ui.sel = null;
  if (ui.sel?.kind==='slide' && !SLIDES[ui.sel.id]) ui.sel = null;
}
function getWall(id){
  if (id == null) return null;
  const i = +String(id).replace(/^w/, '');
  if (!Number.isFinite(i) || !WALLS[i]) return null;
  return {i, id: 'w' + i, w: WALLS[i]};
}
function wallLenOf(w){ return Math.max(w[2] - w[0], w[3] - w[1]); }
function setWallLength(i, len){
  const w = WALLS[i]; if (!w) return;
  len = Math.max(100, Math.round(len / 10) * 10);
  const thick = wallThickOf(w), kind = w[4] || 'n', hMm = w[5];
  if (wallIsHoriz(w)){
    const y = (w[1] + w[3]) / 2, cx = (w[0] + w[2]) / 2;
    WALLS[i] = [cx - len / 2, y - thick / 2, cx + len / 2, y + thick / 2, kind];
  } else {
    const x = (w[0] + w[2]) / 2, cy = (w[1] + w[3]) / 2;
    WALLS[i] = [x - thick / 2, cy - len / 2, x + thick / 2, cy + len / 2, kind];
  }
  if (kind === 'low' && typeof attachLowWallHeight === 'function') attachLowWallHeight(WALLS[i], hMm);
  if (kind === 'beam' && typeof attachBeamDrop === 'function') attachBeamDrop(WALLS[i], hMm);
  WALLS[i] = polishWall(WALLS[i], i);
  syncWinsForWall(i);
}
const getF = id => state.furniture.find(f => f.id === id);

/* ======================= 几何工具 ======================= */
const area = poly => Math.abs(poly.reduce((a,p,i) => { const q = poly[(i+1)%poly.length]; return a + p[0]*q[1] - q[0]*p[1]; }, 0)) / 2 / 1e6;
const perim = poly => poly.reduce((a,p,i) => { const q = poly[(i+1)%poly.length]; return a + Math.hypot(q[0]-p[0], q[1]-p[1]); }, 0) / 1000;
const bbox = poly => { const xs = poly.map(p=>p[0]), ys = poly.map(p=>p[1]); return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]; };
function aabb(f){ const a = f.rot*Math.PI/180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return {hw:f.w/2*c + f.d/2*s, hh:f.w/2*s + f.d/2*c}; }
const fmt = (n, d=2) => n.toFixed(d);
const norm = a => ((Math.round(a) % 360) + 360) % 360;
function snapRects(){ return WALLS.filter((w,i) => !state.demolished.includes('w'+i)).concat(WINS); }
