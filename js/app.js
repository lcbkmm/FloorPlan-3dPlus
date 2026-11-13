/* ======================= 导入导出 ======================= */
function download(name, blob){ const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function exportPNG(){
  if (is3D()) return window.View3D.shot();
  const clone = svg.cloneNode(true), W = 3200, H = Math.round(W*BOUNDS.h/BOUNDS.w);
  clone.setAttribute('viewBox', `${BOUNDS.x} ${BOUNDS.y} ${BOUNDS.w} ${BOUNDS.h}`);
  clone.setAttribute('width', W); clone.setAttribute('height', H);
  clone.querySelector('#gSel').innerHTML = '';
  clone.querySelector('#gGrid').innerHTML = `<rect x="-20000" y="-20000" width="55000" height="55000" fill="${ui.layers.grid?'url(#grid)':'#f7f4ee'}"/>`;
  const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
  Object.entries({x:-20000,y:-20000,width:55000,height:55000,fill:'#f7f4ee'}).forEach(([k,v]) => bg.setAttribute(k,v));
  clone.insertBefore(bg, clone.querySelector('#gGrid'));
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    cv.getContext('2d').drawImage(img, 0, 0, W, H);
    cv.toBlob(b => download(tr('户型装修方案', 'floor-plan-design') + '.png', b));
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
}

/* ======================= 杂项 ======================= */
let toastT;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }

/* ======================= 2D / 3D 切换 ======================= */
let viewMode = '2d', switching = false;
const is3D = () => viewMode === '3d';
const TIPS = () => COARSE
  ? {'2d':tr('点或拖动家具库添加 · 单指拖动平移 · 双指缩放 · 选中家具后底部工具条可旋转 / 复制 / 删除', 'Tap or drag from the library · 1 finger pans · pinch zooms · bottom bar rotates / duplicates / deletes'),
     '3d':tr('单指旋转 · 双指缩放 / 平移 · 点家具或地面编辑 · 点门开关', '1 finger orbits · 2 fingers zoom / pan · tap furniture or floor to edit · tap doors to open')}
  : {'2d':tr('拖动左侧家具到平面图 · 滚轮缩放 · 拖动空白处平移 · T 切换 3D', 'Drag furniture onto the plan · scroll to zoom · drag empty space to pan · T for 3D'),
     '3d':tr('3D 场景与平面方案实时同步 · 右侧面板修改会立即生效 · T 返回 2D', '3D stays in sync with the plan · panel edits apply instantly · T for 2D')};
async function setView(m){
  if (m === viewMode || switching) return;
  if (!window.View3D) return toast(tr('3D 引擎仍在加载或加载失败（需要联网加载 three.js）', '3D engine is still loading or failed to load (three.js needs a network connection)'));
  switching = true; document.body.classList.add('busy');
  const prev = viewMode;
  viewMode = m;
  try {
    if (m === '3d'){
      if (planFlags.tracing && WALLS.length && !ROOMS.length) applyDetectedRooms({silent:true});
      if (ui.tool !== 'select') setTool('select'); ui.mA = null;
      document.body.classList.add('m3d');
      await window.View3D.enter();
    } else {
      document.body.classList.remove('m3d');
      await window.View3D.exit(); applyView();
    }
    $('#tip').textContent = TIPS()[m];
  } catch (err) {
    // 3D 初始化/构建失败时不要让界面卡在「已切到 3D 但画面还是 2D」的状态
    console.error('setView failed:', err);
    try { if (viewMode === '3d') await window.View3D.exit(); } catch (e) {}
    viewMode = '2d';
    document.body.classList.remove('m3d');
    const st = $('#stage');
    if (st) st.classList.remove('is3d', 'animating');
    if (prev === '3d') viewMode = '2d';
    applyView();
    $('#tip').textContent = TIPS()['2d'];
    toast(tr('3D 场景启动失败：', 'Failed to start the 3D scene: ') + (err && err.message ? err.message : err));
  } finally {
    switching = false; document.body.classList.remove('busy');
  }
}
document.querySelectorAll('.menu-pop .btn').forEach(b => b.addEventListener('click', () => {
  if (b.hasAttribute('data-keep-menu')) return; // 微调等控件不关闭菜单
  b.closest('details').open = false;
}));
/* 文件下拉菜单溢出兜底：header 会换行，某些窗口宽度下「文件」按钮会跑到第二行最左侧，
   此时 right:0 向左展开会让菜单溢出屏幕左边被裁掉。常规布局由 .tail 保证按钮靠右；
   这里只在实测发现菜单越界时，才临时改用 fixed 定位把它 clamp 回视口内。 */
const fileMenu = $('details.menu'), filePop = fileMenu.querySelector('.menu-pop');
function placeFileMenu(){
  if (!fileMenu.open) return;
  filePop.style.position = '';               // 先回到 CSS 常规定位，测真实位置
  filePop.style.left = ''; filePop.style.top = ''; filePop.style.right = '';
  const r0 = filePop.getBoundingClientRect();
  const pad = 12, vw = window.innerWidth, vh = window.innerHeight;
  if (r0.left >= pad && r0.right <= vw - pad && r0.top >= pad && r0.bottom <= vh - pad) return;
  const s = fileMenu.querySelector('summary').getBoundingClientRect();
  const w = r0.width, h = r0.height;
  let left = s.right - w;                    // 优先右对齐（向左展开）
  if (left < pad) left = s.left;             // 左侧放不下 → 从按钮左缘向右展开
  left = Math.max(pad, Math.min(left, vw - w - pad));
  let top = s.bottom + 6;
  if (top + h > vh - pad){                   // 下方放不下 → 上翻，再不行贴底（菜单自带滚动）
    const above = s.top - h - 6;
    top = above >= pad ? above : Math.max(pad, vh - h - pad);
  }
  filePop.style.position = 'fixed';
  filePop.style.right = 'auto';
  filePop.style.left = left + 'px';
  filePop.style.top = top + 'px';
}
fileMenu.addEventListener('toggle', () => { if (fileMenu.open) placeFileMenu(); });
new MutationObserver(() => { if (fileMenu.open) placeFileMenu(); })
  .observe(fileMenu, {attributes:true, attributeFilter:['open']});
window.addEventListener('resize', placeFileMenu);
document.addEventListener('scroll', placeFileMenu, true);
document.querySelectorAll('#viewSeg .btn').forEach(b => b.onclick = () => setView(b.dataset.view));

document.querySelectorAll('#tools .btn').forEach(b => b.onclick = () => setTool(b.dataset.tool));
$('#detectRooms').onclick = () => applyDetectedRooms();
document.querySelectorAll('#layers .btn').forEach(b => b.onclick = () => {
  const k = b.dataset.layer; ui.layers[k] = !ui.layers[k]; b.classList.toggle('on', ui.layers[k]);
  if (k === 'dims') $('#gDims').setAttribute('display', ui.layers.dims ? 'inline' : 'none');
  else if (k !== 'wallSnap') renderAll();
});
$('#undo').onclick = undo; $('#redo').onclick = redo;
$('#clearAll').onclick = clearLayout;
$('#linkClear').onclick = () => { if (typeof clearFloorLinks === 'function') clearFloorLinks(); };

/* 全屏：标准 API + Safari（iPad）的 webkit 前缀版本 */
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
function toggleFullscreen(){
  const de = document.documentElement;
  if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else {
    const req = de.requestFullscreen || de.webkitRequestFullscreen;
    if (!req) return toast(tr('当前浏览器不支持网页全屏，可在 Safari 中「添加到主屏幕」后以全屏方式打开', 'Fullscreen is not supported here — in Safari, use "Add to Home Screen" to open it fullscreen'));
    Promise.resolve(req.call(de)).catch(() => toast(tr('无法进入全屏', 'Could not enter fullscreen')));
  }
}
function syncFullscreen(){
  const on = !!fsEl(), b = $('#fullscreen');
  b.textContent = '⛶ ' + (on ? tr('退出全屏', 'Exit fullscreen') : tr('全屏', 'Fullscreen'));
  b.title = (on ? tr('退出全屏', 'Exit fullscreen') : tr('全屏', 'Fullscreen')) + ' (Shift+F)';
}
$('#fullscreen').onclick = toggleFullscreen;
['fullscreenchange', 'webkitfullscreenchange'].forEach(t => document.addEventListener(t, syncFullscreen));
// 已从主屏幕以独立 App 方式打开时本就是全屏，隐藏按钮
if (navigator.standalone || matchMedia('(display-mode: standalone)').matches) $('#fullscreen').hidden = true;
$('#tgLib').onclick = () => drawer('lib');
$('#tgPanel').onclick = () => drawer('panel');
// 触屏上点菜单以外的地方收起「文件」菜单
document.addEventListener('pointerdown', e => { const m = $('details.menu'); if (m.open && !m.contains(e.target)) m.open = false; });
matchMedia('(max-width:1100px)').addEventListener('change', () => drawer(null));
drawer(null);                                  // 恢复上次的面板收起状态
/* 方案名 → 安全的文件名：替换文件系统非法字符（\ / : * ? " < > |）、
 * 去掉控制字符与首尾的点，避免下载时被浏览器改名或变成隐藏文件。 */
function safePlanFileName(name){
  let s = String(name || '');
  [92, 47, 58, 42, 63, 34, 60, 62, 124].forEach(c => { s = s.split(String.fromCharCode(c)).join('_'); });
  s = s.split('').filter(ch => { const c = ch.charCodeAt(0); return c > 31 && c !== 127; }).join('');
  s = s.replace(/^[.]+/, '').replace(/[.]+$/g, '').trim();
  return s.slice(0, 80);
}
/** 当前方案名：以方案卡片的 name 为准，回退到 state.projectName */
function currentPlanName(){
  let raw = '';
  try {
    const p = (typeof getProject === 'function' && typeof currentProjectId !== 'undefined' && currentProjectId)
      ? getProject(currentProjectId) : null;
    raw = String((p && p.name) || state.projectName || '').trim();
  } catch (e) { raw = String(state.projectName || '').trim(); }
  return raw;
}
function saveDesignFile(){
  // 关键：导出前把当前层的编辑写回 state.floors[activeFloor]。
  // 否则多层方案里「当前层」可能还是上一次 commit 的旧数据，其它层虽完整但对不上。
  try { if (typeof packActiveFloor === 'function') packActiveFloor(); } catch (e) {}
  try { state.plan = snapshotPlan(); } catch (e) {}
  let out;
  try { out = JSON.parse(JSON.stringify(state)); } catch (e) { out = state; }

  // 方案元数据随文件一起导出，导入后名称 / 层数 / 当前层都能原样还原。
  // out.floors 是完整的多层数组（每层含 plan / furniture / rooms / links / 底图…）。
  const name = currentPlanName();
  if (name) out.projectName = name;
  out.floorCount = Math.max(1, (out.floors || []).length);
  out.activeFloor = Math.max(0, Math.min(out.activeFloor | 0, out.floorCount - 1));

  const fileName = (safePlanFileName(name) || tr('户型装修方案', 'floor-plan-design')) + '.json';
  download(fileName, new Blob([JSON.stringify(out, null, 2)], {type:'application/json'}));
  markDesignClean();
  toast(tr(
    `方案「${name || tr('户型装修方案', 'floor-plan-design')}」已导出（${out.floorCount} 层）`,
    `Plan “${name || 'floor-plan-design'}” exported (${out.floorCount} floors)`));
}
/** 「文件 ▾ → 保存方案」：只把当前编辑内容覆盖写回浏览器本地自动存档
 *  （方案卡片的 state + huxing-design-v1），不下载任何文件。
 *  需要 .json 备份文件时请用「导出方案 JSON」。 */
function saveCurrentPlan(){
  // 与导出口径一致：先把当前层编辑写回 floors，再刷新几何快照
  try { if (typeof packActiveFloor === 'function') packActiveFloor(); } catch (e) {}
  try { state.plan = snapshotPlan(); } catch (e) {}
  let ok = null;
  try { ok = (typeof flushProject === 'function') ? flushProject() : null; } catch (e) { ok = false; }
  if (ok == null){
    // 没有打开方案（旧存档 / 异常状态）时，至少覆盖当前编辑状态的本地存档
    try { if (typeof save === 'function') save(); } catch (e) {}
    try { markDesignClean(); } catch (e) {}
    ok = true;
  }
  const name = currentPlanName() || tr('户型装修方案', 'floor-plan-design');
  if (ok === true) toast(tr(`方案「${name}」已保存到本机`, `Plan “${name}” saved in this browser`));
  else toast(tr('本地存储空间不足，保存未完成。建议删除旧方案或导出 JSON 备份。',
                'Not enough local storage — plan not saved. Delete old plans or export a JSON backup.'));
}
function confirmDiscardIfDirty(){
  if (!isDesignDirty()) return true;
  return confirm(tr('当前方案尚未保存，确定放弃更改吗？', 'The current plan has unsaved changes. Discard them?'));
}
function newBlankCanvas(){
  if (!confirmDiscardIfDirty()) return;
  const b = snap();
  const keepFloors = Math.max(1, (state.floors || []).length);
  state = blankState();
  if (typeof resizeFloorsTo === 'function') resizeFloorsTo(keepFloors);
  if (typeof ensureFloors === 'function') ensureFloors();
  if (typeof resetRoomMatEnrichment === 'function') resetRoomMatEnrichment();
  ui.sel = null;
  undoStack.length = 0; redoStack.length = 0;
  commit(b);
  markDesignClean();
  fitView(); renderOpenings(); renderDims(); renderAll();
  syncBgControlsUi();
  if (typeof syncFloorUi === 'function') syncFloorUi();
  toast(tr('已新建空白画布', 'Started a blank canvas'));
}
$('#exportPng').onclick = exportPNG;
$('#saveDesign').onclick = () => { $('details.menu').open = false; saveCurrentPlan(); };
$('#newBlank').onclick = () => { $('details.menu').open = false; newBlankCanvas(); };
$('#exportJson').onclick = () => { $('details.menu').open = false; saveDesignFile(); };
$('#importJson').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  file.text().then(txt => {
    let s;
    try { s = JSON.parse(txt); } catch (err) { return toast(tr('文件格式不正确', 'Invalid file format')); }
    if (!s || !Array.isArray(s.furniture)) return toast(tr('文件格式不正确', 'Invalid file format'));
    // 多楼层之后「导入」有两种语义：只替换当前层 / 另存为新方案。交给弹窗确认，避免覆盖其它楼层。
    if (typeof openImportModal === 'function') openImportModal(s, file.name);
    else toast(tr('导入模块未加载', 'Import module failed to load'));
  }).catch(() => toast(tr('文件读取失败', 'Could not read the file')));
};
$('#reset').onclick = () => {
  if (!confirm(tr('恢复为默认设计方案？（可撤销）', 'Reset to the default design? (undoable)'))) return;
  const b = snap();
  const keepFloors = Math.max(1, (state.floors || []).length);
  applyPlanGeometry(DEFAULT_PLAN);
  state = defaultState();
  if (typeof resizeFloorsTo === 'function') resizeFloorsTo(keepFloors);
  if (typeof ensureFloors === 'function'){ ensureFloors(); packActiveFloor(); }
  if (typeof resetRoomMatEnrichment === 'function') resetRoomMatEnrichment();
  ui.sel = null; commit(b); fitView(); renderOpenings(); renderDims(); renderAll();
  syncBgControlsUi();
  if (typeof syncFloorUi === 'function') syncFloorUi();
};
// 关闭 / 刷新页面前：未保存则提示
addEventListener('beforeunload', e => {
  if (!isDesignDirty()) return;
  e.preventDefault();
  e.returnValue = '';
});
// 启动时空白画布视为已对齐「已保存」基线（无改动不提示）
markDesignClean();

/* ======================= CAD / 图片导入 ======================= */
let _dxfAnalysis = null, _dxfSel = 0;
function closeDxfModal(){ $('#dxfModal').hidden = true; _dxfAnalysis = null; }
function openDxfModal(analysis){
  _dxfAnalysis = analysis;
  _dxfSel = 0;
  const sheets = analysis.sheets || [];
  $('#dxfModalHint').textContent = sheets.length
    ? tr(`识别到 ${sheets.length} 个图框分幅，请选择要导入的户型（优先推荐住宅尺寸）。`, `Found ${sheets.length} drawing sheet(s). Pick the unit to import.`)
    : tr('未识别到图框，将尝试整图提取。', 'No title frames found; will try whole-drawing extraction.');
  const grid = $('#sheetGrid');
  grid.innerHTML = sheets.map((s, i) => {
    const [w, h] = s.size;
    return `<button type="button" class="sheet-card${i===0?' on':''}" data-i="${i}">
      ${s.preview}
      <small>#${s.index + 1} · ${s.wallCount}${tr(' 段墙', ' walls')} · ${(w/1000).toFixed(1)}×${(h/1000).toFixed(1)} m${s.apt ? ' ★' : ''}</small>
    </button>`;
  }).join('') || `<p style="color:var(--muted)">${tr('没有可提取的墙体', 'No walls could be extracted')}</p>`;
  grid.onclick = e => {
    const card = e.target.closest('.sheet-card'); if (!card) return;
    _dxfSel = +card.dataset.i;
    grid.querySelectorAll('.sheet-card').forEach(c => c.classList.toggle('on', c === card));
  };
  $('#dxfModal').hidden = false;
}
function applyImportedPlan(plan){
  const b = snap();
  applyPlanGeometry(plan, {imported:true});
  const rooms = {};
  ROOMS.forEach(r => rooms[r.id] = {name:r.name, mat: r.mat || null, wallpaper:null});
  state.furniture = [];
  state.rooms = rooms;
  state.demolished = [];
  state.measures = [];
  state.plan = snapshotPlan();
  state._floorMatPolicy = 1;
  ui.sel = null;
  commit(b);
  fitView();
  renderOpenings();
  renderDims();
  renderAll();
  toast(tr(`已导入：${WALLS.length} 段墙、${ROOMS.length} 个房间`, `Imported: ${WALLS.length} walls, ${ROOMS.length} rooms`));
}
$('#importDxf').onclick = () => { $('details.menu').open = false; $('#dxfIn').click(); };
$('#dxfIn').onchange = async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  if (!window.DxfImport) return toast(tr('CAD 解析模块未加载', 'CAD module failed to load'));
  toast(tr('正在解析 DXF…', 'Parsing DXF…'));
  try {
    const analysis = await DxfImport.fromFile(file);
    if (!analysis.sheets.length) return toast(tr('未能从 DXF 中提取墙体', 'Could not extract walls from DXF'));
    openDxfModal(analysis);
  } catch (err) {
    console.error(err);
    toast(tr('DXF 解析失败：', 'DXF parse failed: ') + (err.message || err));
  }
};
$('#dxfModalClose').onclick = $('#dxfCancel').onclick = closeDxfModal;
$('#dxfApply').onclick = () => {
  if (!_dxfAnalysis) return;
  try {
    const sheet = _dxfAnalysis.sheets[_dxfSel];
    if (!sheet) throw new Error('No sheet selected');
    const plan = DxfImport.extractSheet(_dxfAnalysis, sheet.index);
    closeDxfModal();
    applyImportedPlan(plan);
  } catch (err) {
    console.error(err);
    toast(tr('导入失败：', 'Import failed: ') + (err.message || err));
  }
};
$('#importImg').onclick = () => { $('details.menu').open = false; $('#imgIn').click(); };
$('#importImgOnly').onclick = () => { $('details.menu').open = false; $('#imgInOnly').click(); };
function loadImageFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const img = new Image();
    img.onload = () => {
      const b = snap();
      startTraceFromImage(dataUrl, img.naturalWidth || 1800, img.naturalHeight || 1200);
      commit(b);
    };
    img.onerror = () => {
      const b = snap();
      startTraceFromImage(dataUrl, 1800, 1200);
      commit(b);
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}
$('#imgIn').onchange = e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  // 上传底图默认新画布（清空当前楼层的墙体与家具，其它楼层不受影响）
  const fl = state.floors && state.floors[state.activeFloor | 0];
  const used = ((fl && fl.plan && fl.plan.walls && fl.plan.walls.length) || 0) +
               ((fl && fl.furniture && fl.furniture.length) || 0);
  if (used && !confirm(tr(
      `上传底图会清空当前楼层（${fl.name || ''}）的墙体与家具，其他楼层不受影响。继续？`,
      `Uploading an underlay clears walls and furniture on ${fl.name || 'this floor'} only. Continue?`))) return;
  loadImageFile(file);
};
$('#imgInOnly').onchange = e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  loadImageFile(file);
};
$('#clearBg').onclick = () => {
  if (!state.bgImage) return toast(tr('当前没有图片底图', 'No image underlay'));
  const b = snap();
  state.bgImage = null; state.bgFrame = null; state.bgAspect = null; state.bgScale = 1;
  commit(b); renderBg(); renderRooms(); renderLabels(); syncBgControlsUi();
};
function syncBgControlsUi(){
  let op01 = state.bgOpacity == null ? 0.45 : +state.bgOpacity;
  let scMul = state.bgScale == null ? 1 : +state.bgScale;
  if (!Number.isFinite(op01)) op01 = 0.45;
  if (!Number.isFinite(scMul)) scMul = 1;
  // 显示用：兼容误存百分数的旧值（不写回 state，避免污染撤销栈）
  if (op01 > 1) op01 = op01 / 100;
  if (scMul > 10) scMul = scMul / 100;
  const op = Math.round(Math.max(0, Math.min(1, op01)) * 100);
  const sc = Math.round(Math.max(0.1, Math.min(8, scMul)) * 100);
  const sl = $('#bgOpacity'), lab = $('#bgOpacityT');
  if (sl) sl.value = String(op);
  if (lab) lab.textContent = op + '%';
  const ssl = $('#bgScale'), slab = $('#bgScaleT');
  if (ssl) ssl.value = String(sc);
  if (slab) slab.textContent = sc + '%';
}
$('#clearWalls').onclick = () => {
  if (!WALLS.length) return toast(tr('当前没有墙体', 'No walls to clear'));
  if (!confirm(tr('清空全部墙体？（可撤销）', 'Clear all walls? (undoable)'))) return;
  mutate(() => {
    WALLS.length = 0;
    WINS.length = 0;
    DOORS.length = 0;
    SLIDES.length = 0;
    state.demolished = [];
    persistCustomPlan();
  });
  renderWalls(); renderOpenings();
  toast(tr('已清空墙体，可用「画墙」重新绘制', 'Walls cleared — use Draw wall to redraw'));
};
/* 顶栏参数组随当前工具模式显隐：只显示与当前操作相关的参数，不再把全部信息一次铺开。
 * 未列入的控件（视图 / 楼层 / 层高 / 图层开关 / 撤销重做 / 识别房间）是全局设置，始终常驻。
 * value = 允许出现该参数组的工具模式数组；附加条件统一在这里收敛，避免显隐逻辑散落各处。 */
const TOOL_OPT_GROUPS = {
  wallKind:     ['draw'],
  wallThick:    ['draw'],
  wallWinOpts:  ['draw'],
  wallBeamOpts: ['draw'],
  linkInfo:     ['link'],
};
function syncToolOptions(){
  const t = ui.tool;
  const multiFloor = (state.floors || []).length > 1;
  for (const id in TOOL_OPT_GROUPS){
    const el = $('#' + id);
    if (!el) continue;
    let show = TOOL_OPT_GROUPS[id].indexOf(t) >= 0;
    if (id === 'linkInfo')     show = show && multiFloor;       // 单层没有上下层连通区
    if (id === 'wallWinOpts')  show = show && ui.wallKind === 'win';
    if (id === 'wallBeamOpts') show = show && ui.wallKind === 'beam';
    el.hidden = !show;
  }
}
/** 兼容旧调用点（setWallKind / 输入框 / restoreDrawPrefs） */
function syncWallWinOptsUi(){ syncToolOptions(); }
function setWallKind(kind){
  if (!WALL_KIND_LABEL[kind]) return;
  ui.wallKind = kind;
  document.querySelectorAll('#wallKind [data-kind]').forEach(x => x.classList.toggle('on', x.dataset.kind === kind));
  syncWallWinOptsUi();
  if ((kind === 'low' || kind === 'beam') && ui.wallThick >= 240) setWallThick(120, false);
  else if (kind !== 'low' && kind !== 'beam' && ui.wallThick < 120) setWallThick(240, false);
  if (ui.layers.bearing !== (kind === 'b')){
    // 选承重时打开承重墙高亮，便于区分
    if (kind === 'b'){ ui.layers.bearing = true; const btn = document.querySelector('#layers [data-layer="bearing"]'); if (btn) btn.classList.add('on'); renderWalls(); }
  }
  const winTip = kind === 'win'
    ? tr(` · 窗 ${ui.winW > 0 ? ui.winW : '自适应'}×${ui.winH} 台高${ui.winSill}`, ` · win ${ui.winW > 0 ? ui.winW : 'auto'}×${ui.winH} sill ${ui.winSill}`)
    : '';
  const beamTip = kind === 'beam'
    ? tr(` · 下垂 ${ui.beamDropH || 400} mm`, ` · drop ${ui.beamDropH || 400} mm`)
    : '';
  toast((WALL_KIND_LABEL[kind] || WALL_KIND_LABEL.n)() + ` · ${ui.wallThick} mm` + winTip + beamTip);
  renderWallDraft();
}
function setWallThick(v, toastIt){
  v = Math.max(20, Math.min(1200, Math.round(+v || ui.wallThick || 240)));
  // 对齐到 5mm，便于手绘对齐
  v = Math.round(v / 5) * 5;
  ui.wallThick = v;
  const inp = $('#wallThickIn');
  if (inp && +inp.value !== v) inp.value = v;
  if (toastIt !== false) toast(tr(`画墙厚度 ${ui.wallThick} mm`, `Wall thickness ${ui.wallThick} mm`));
  renderWallDraft();
}
document.querySelectorAll('#wallKind [data-kind]').forEach(b => b.onclick = () => setWallKind(b.dataset.kind));
(function bindWallThickInput(){
  const inp = $('#wallThickIn');
  if (!inp) return;
  inp.value = ui.wallThick;
  // 输入过程即时写入 ui，避免仅存在于 DOM 撤销历史里
  inp.addEventListener('input', () => {
    const v = +inp.value;
    if (Number.isFinite(v) && v >= 20) ui.wallThick = Math.round(v / 5) * 5;
  });
  inp.addEventListener('beforeinput', e => {
    if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo'){
      e.preventDefault();
      if (e.inputType === 'historyUndo') undo(); else redo();
    }
  });
  const apply = () => {
    setWallThick(inp.value, true);
    if (document.activeElement === inp) inp.blur();
  };
  inp.onchange = apply;
  inp.onblur = () => setWallThick(inp.value, false);
  inp.onkeydown = e => {
    if (e.key === 'Enter'){ e.preventDefault(); apply(); }
  };
})();
(function bindWallWinOpts(){
  const wIn = $('#winWIn'), hIn = $('#winHIn'), sIn = $('#winSillIn'), fl = $('#winFloorBtn');
  if (!wIn || !hIn || !sIn) return;
  const syncInputs = () => {
    wIn.value = ui.winW;
    hIn.value = ui.winH;
    sIn.value = ui.winSill;
  };
  syncInputs();
  syncWallWinOptsUi();
  const apply = (toastIt) => {
    ui.winW = Math.max(0, Math.min(8000, Math.round((+wIn.value || 0) / 10) * 10));
    ui.winH = Math.max(400, Math.min(2800, Math.round((+hIn.value || ui.winH) / 10) * 10));
    ui.winSill = Math.max(0, Math.min(2000, Math.round((+sIn.value || 0) / 10) * 10));
    syncInputs();
    if (toastIt){
      toast(ui.winW > 0
        ? tr(`窗户 ${ui.winW}×${ui.winH} · 台高 ${ui.winSill} mm`, `Window ${ui.winW}×${ui.winH} · sill ${ui.winSill} mm`)
        : tr(`窗户自适应宽 · 高 ${ui.winH} · 台高 ${ui.winSill} mm`, `Window auto-width · H ${ui.winH} · sill ${ui.winSill} mm`));
    }
    renderWallDraft();
  };
  [wIn, hIn, sIn].forEach(inp => {
    inp.onchange = () => apply(true);
    inp.onblur = () => apply(false);
    inp.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); apply(true); inp.blur(); } };
  });
  if (fl) fl.onclick = () => {
    ui.winSill = 0; ui.winH = 2400;
    syncInputs();
    toast(tr('落地窗：台高 0 · 窗高 2400 mm', 'Floor-to-ceiling: sill 0 · height 2400 mm'));
    renderWallDraft();
  };
})();
(function bindWallBeamOpts(){
  const inp = $('#beamDropIn');
  if (!inp) return;
  const sync = () => { inp.value = ui.beamDropH || 400; };
  sync();
  syncWallWinOptsUi();
  const apply = (toastIt) => {
    ui.beamDropH = typeof clampBeamDrop === 'function'
      ? clampBeamDrop(inp.value)
      : Math.max(150, Math.min(1800, Math.round((+inp.value || 400) / 10) * 10));
    sync();
    if (toastIt) toast(tr(`横梁下垂 ${ui.beamDropH} mm`, `Beam drop ${ui.beamDropH} mm`));
    renderWallDraft();
  };
  inp.onchange = () => apply(true);
  inp.onblur = () => apply(false);
  inp.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); apply(true); inp.blur(); } };
})();
function setBgOpacityPct(pct){
  pct = Math.max(0, Math.min(100, Math.round(pct)));
  state.bgOpacity = pct / 100;
  const sl = $('#bgOpacity'), lab = $('#bgOpacityT');
  if (sl) sl.value = pct;
  if (lab) lab.textContent = pct + '%';
  renderBg();
  save();
}
function setBgScalePct(pct, opts){
  pct = Math.max(10, Math.min(800, Math.round(pct)));
  if (!state.bgFrame) state.bgFrame = {...ensureBgFrame()};
  const apply = () => {
    state.bgScale = pct / 100;
    const sl = $('#bgScale'), lab = $('#bgScaleT');
    if (sl) sl.value = pct;
    if (lab) lab.textContent = pct + '%';
    renderBg();
  };
  if (opts && opts.undoable){
    mutate(() => { apply(); });
  } else {
    apply();
    save();
  }
  return pct;
}
$('#bgOpacity').oninput = e => setBgOpacityPct(+e.target.value);
$('#bgScale').oninput = e => setBgScalePct(+e.target.value);

/* —— 底图比例校准：画已知长度线段 → 输入实际 mm → 自动缩放 —— */
let _calSeg = null; // {a,b,len}
function openCalibrateModal(a, b){
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(len > 20)) return toast(tr('线段太短，请画长一些', 'Segment too short — draw a longer line'));
  if (!state.bgImage) return toast(tr('请先上传底图，再校准比例', 'Upload an underlay image first'));
  _calSeg = {a, b, len};
  const modal = $('#calModal'), lenEl = $('#calSegLen'), inp = $('#calRealIn');
  if (lenEl) lenEl.textContent = String(Math.round(len));
  if (inp) inp.value = '';
  if (modal) modal.hidden = false;
  requestAnimationFrame(() => { try { inp?.focus(); inp?.select(); } catch (e) {} });
}
function closeCalibrateModal(){
  _calSeg = null;
  const modal = $('#calModal');
  if (modal) modal.hidden = true;
}
function applyCalibrateFromModal(){
  if (!_calSeg) return closeCalibrateModal();
  const real = +$('#calRealIn')?.value;
  if (!Number.isFinite(real) || real < 1){
    toast(tr('请输入有效的实际长度（mm）', 'Enter a valid real length (mm)'));
    $('#calRealIn')?.focus();
    return;
  }
  const seg = _calSeg.len;
  const cur = typeof bgScaleMul === 'function' ? bgScaleMul() : (state.bgScale || 1);
  const nextPct = Math.round(cur * (real / seg) * 100);
  const applied = setBgScalePct(nextPct, {undoable:true});
  const ratio = (real / seg).toFixed(3);
  closeCalibrateModal();
  setTool('select');
  toast(tr(
    `底图已校准：${Math.round(seg)} → ${Math.round(real)} mm（×${ratio}，缩放 ${applied}%）`,
    `Underlay calibrated: ${Math.round(seg)} → ${Math.round(real)} mm (×${ratio}, scale ${applied}%)`
  ));
}
$('#bgCalibrate').onclick = () => {
  $('details.menu').open = false;
  if (!state.bgImage) return toast(tr('请先上传底图，再校准比例', 'Upload an underlay image first'));
  setTool('calibrate');
};
['calCancel','calModalClose'].forEach(id => {
  const el = $('#' + id); if (el) el.onclick = () => { closeCalibrateModal(); };
});
$('#calApply').onclick = () => applyCalibrateFromModal();
$('#calRealIn')?.addEventListener('keydown', e => {
  if (e.key === 'Enter'){ e.preventDefault(); applyCalibrateFromModal(); }
  if (e.key === 'Escape'){ e.preventDefault(); closeCalibrateModal(); }
});
$('#calModal')?.addEventListener('click', e => { if (e.target === $('#calModal')) closeCalibrateModal(); });
document.querySelectorAll('.bg-nudge').forEach(b => b.addEventListener('click', e => {
  e.preventDefault();
  e.stopPropagation();
  const delta = +b.dataset.delta || 0;
  if (b.dataset.bg === 'opacity'){
    const cur = Math.round((state.bgOpacity == null ? 0.45 : state.bgOpacity) * 100);
    setBgOpacityPct(cur + delta);
  } else if (b.dataset.bg === 'scale'){
    const cur = Math.round((state.bgScale == null ? 1 : state.bgScale) * 100);
    setBgScalePct(cur + delta);
  }
}));
syncBgControlsUi();
// 横竖屏切换、表头换行等都会改变画布尺寸；尺寸从 0 恢复（如首次布局）时重新适应窗口
// 其余尺寸变化（收起 / 展开面板等）保持画面中心不动
let lastW = 0, lastH = 0;
new ResizeObserver(() => {
  const w = svg.clientWidth, h = svg.clientHeight; if (!w) return;
  if (!lastW) fitView();
  else { view.x0 -= (w - lastW)/2/view.s; view.y0 -= (h - lastH)/2/view.s; applyView(); }
  lastW = w; lastH = h;
}).observe(svg);

function setLang(l){
  LANG = l; try { localStorage.setItem(LANG_KEY, l); } catch(e) {}
  applyStaticLang(); syncFullscreen(); syncModeHint(); syncPaneBtns();
  buildLib(); renderOpenings(); renderAll();
  $('#tip').textContent = TIPS()[viewMode];
  window.View3D?.relang();
  if (typeof renderLanding === 'function') renderLanding();
}
$('#langSel').onclick = e => { const l = e.target.closest('[data-lang]')?.dataset.lang; if (l && l !== LANG) setLang(l); };

applyStaticLang(); syncFullscreen();
if (typeof ensureFloors === 'function') ensureFloors();
if (typeof bindFloorUi === 'function') bindFloorUi();
buildDefs(); buildLib(); renderOpenings(); renderDims();
$('#tip').textContent = TIPS()['2d'];
fitView(); renderAll();
syncToolOptions();                       // 启动时按初始工具（select）收起无关参数组
