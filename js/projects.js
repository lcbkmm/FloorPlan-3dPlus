/* ============================================================
 *  多方案管理 · 启动页（方案卡片）
 *  localStorage[huxing-projects-v1] = [
 *    {id, name, createdAt, updatedAt, floorCount, heightMm, state}
 *  ]
 *  每项的 state 是完整的编辑器状态快照（含 floors 各层平面/家具）。
 * ============================================================ */
const PROJ_KEY = 'huxing-projects-v1';
const PROJ_MAX = 60;
let projects = [];                 // 内存中的方案列表
let currentProjectId = null;       // 当前正在编辑的方案
let _projTimer = 0;                // 自动保存防抖
let pmFloorsN = 2;                 // 新建弹窗里选中的层数
let pmDefaultName = '';            // 新建弹窗里自动填的方案名（用于判断用户是否改过）

/* ---------------------------- 存储 ---------------------------- */
function readProjects(){
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(PROJ_KEY)); } catch (e) { raw = null; }
  if (!Array.isArray(raw)) return [];
  return raw.filter(p => p && p.id).map(p => ({
    id: p.id,
    name: String(p.name || tr('未命名方案', 'Untitled plan')),
    createdAt: +p.createdAt || Date.now(),
    updatedAt: +p.updatedAt || +p.createdAt || Date.now(),
    floorCount: Math.max(1, +p.floorCount || 1),
    heightMm: +p.heightMm || 2800,
    state: p.state || null,
  }));
}
function writeProjects(list){
  projects = list.slice(0, PROJ_MAX);
  try {
    localStorage.setItem(PROJ_KEY, JSON.stringify(projects));
    return true;
  } catch (e) {
    toast(tr('本地存储空间不足，本次改动可能未保存。建议删除旧方案或导出 JSON 备份。',
             'Local storage is full — this change may not be saved. Delete old plans or export a JSON backup.'));
    return false;
  }
}
function getProject(id){ return projects.find(p => p.id === id) || null; }
function newProjectId(){
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------------------------- 统计 ---------------------------- */
function polyAreaMm2(poly){
  if (!Array.isArray(poly) || poly.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++){
    const p = poly[i], q = poly[(i + 1) % poly.length];
    if (!p || !q) continue;
    a += (+p[0]) * (+q[1]) - (+q[0]) * (+p[1]);
  }
  return Math.abs(a) / 2;
}
function projFloors(proj){
  const st = (proj && proj.state) || {};
  if (Array.isArray(st.floors) && st.floors.length) return st.floors;
  if (st.plan) return [{ id: 'F1', name: '1F', heightMm: 2800, plan: st.plan, furniture: st.furniture || [] }];
  return [];
}
function projArea(proj){
  let mm2 = 0;
  projFloors(proj).forEach(f => {
    const rooms = (f && f.plan && Array.isArray(f.plan.rooms)) ? f.plan.rooms : [];
    rooms.forEach(r => { if (r && r.counted !== false) mm2 += polyAreaMm2(r.poly); });
  });
  return mm2 / 1e6;
}
const pad2 = n => String(n).padStart(2, '0');
function fmtDay(ts){
  const d = new Date(ts || Date.now());
  if (isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/* ------------------------ 卡片缩略图（SVG） ------------------------ */
/** 取「内容最多」的一层作为缩略图主视图 */
function projMainFloor(proj){
  const floors = projFloors(proj);
  if (!floors.length) return null;
  let best = floors[0], score = -1;
  floors.forEach(f => {
    const n = ((f?.plan?.walls?.length) || 0) * 3 + ((f?.furniture?.length) || 0);
    if (n > score){ score = n; best = f; }
  });
  return best;
}
function projThumbSVG(proj){
  const f = projMainFloor(proj);
  const walls = ((f && f.plan && f.plan.walls) || []).filter(w => w && w.length >= 4);
  if (!walls.length) return '';
  const xs = [], ys = [];
  walls.forEach(w => { xs.push(+w[0], +w[2]); ys.push(+w[1], +w[3]); });
  const rooms = (f.plan.rooms || []);
  rooms.forEach(r => (r.poly || []).forEach(p => { if (p){ xs.push(+p[0]); ys.push(+p[1]); } }));
  let x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
  if (!Number.isFinite(x0) || x1 <= x0 || y1 <= y0) return '';
  const pad = Math.max(180, (x1 - x0) * 0.06);
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;

  const R = n => Math.round(n);
  const out = [];
  // 地面色块
  rooms.forEach(r => {
    const poly = r.poly || [];
    if (poly.length < 3) return;
    const d = poly.map((p, i) => (i ? 'L' : 'M') + R(p[0]) + ' ' + R(p[1])).join('') + 'Z';
    out.push(`<path d="${d}" fill="#b5653a" opacity=".055"/>`);
  });
  // 墙体
  walls.forEach(w => {
    const kind = w[4] || 'n';
    const fill = kind === 'low' ? '#b3a48d' : kind === 'beam' ? '#c9bda9' : kind === 'b' ? '#6a4234' : '#514a41';
    out.push(`<rect x="${R(w[0])}" y="${R(w[1])}" width="${R(Math.max(1, w[2] - w[0]))}" height="${R(Math.max(1, w[3] - w[1]))}" fill="${fill}"/>`);
  });
  // 窗
  ((f.plan.wins) || []).forEach(w => {
    if (!w || w.length < 4) return;
    out.push(`<rect x="${R(w[0])}" y="${R(w[1])}" width="${R(Math.max(1, w[2] - w[0]))}" height="${R(Math.max(1, w[3] - w[1]))}" fill="#cfe3ec"/>`);
  });
  // 家具（简化成浅色块，带旋转）
  ((f.furniture) || []).forEach(x => {
    const w = +x.w, d = +x.d;
    if (!(w > 0) || !(d > 0)) return;
    const rot = +x.rot || 0;
    const t = rot ? ` transform="rotate(${Math.round(rot)} ${R(x.cx)} ${R(x.cy)})"` : '';
    out.push(`<rect x="${R(x.cx - w / 2)}" y="${R(x.cy - d / 2)}" width="${R(w)}" height="${R(d)}" rx="${R(Math.min(w, d) * 0.18)}" fill="#2b2824" opacity=".14"${t}/>`);
  });
  return `<svg viewBox="${R(x0)} ${R(y0)} ${R(x1 - x0)} ${R(y1 - y0)}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${out.join('')}</svg>`;
}

/* ---------------------------- 卡片 ---------------------------- */
function cardHTML(p){
  const area = projArea(p);
  const nf = Math.max(p.floorCount || 1, projFloors(p).length);
  const thumb = projThumbSVG(p);
  const sameDay = fmtDay(p.createdAt) === fmtDay(p.updatedAt);
  return `<div class="proj-card" data-id="${p.id}" tabindex="0" role="button" aria-label="${esc(p.name)}">
    <div class="proj-thumb">${thumb || `<div class="th-empty">${tr('空白画布', 'Blank canvas')}</div>`}
      <span class="proj-floor-badge">${tr(`${nf} 层`, `${nf} fl`)}</span>
    </div>
    <div class="proj-info">
      <b class="proj-name">${esc(p.name)}</b>
      <div class="proj-stats">
        <span>${area > 0.05 ? area.toFixed(1) + ' m²' : tr('未绘制', 'No walls yet')}</span>
        <span class="dot">·</span>
        <span>${tr(`层高 ${p.heightMm} mm`, `H ${p.heightMm} mm`)}</span>
      </div>
      <div class="proj-date">${tr('创建于', 'Created')} ${fmtDay(p.createdAt)}${sameDay ? '' : ' · ' + tr('更新于', 'updated') + ' ' + fmtDay(p.updatedAt)}</div>
    </div>
    <div class="proj-acts">
      <button class="btn mini" data-act="rename" data-id="${p.id}">${tr('重命名', 'Rename')}</button>
      <button class="btn mini" data-act="dup" data-id="${p.id}">${tr('复制', 'Duplicate')}</button>
      <button class="btn mini danger" data-act="del" data-id="${p.id}">${tr('删除', 'Delete')}</button>
    </div>
  </div>`;
}

function renderLanding(){
  const grid = $('#lpGrid'), empty = $('#lpEmpty');
  if (!grid) return;
  projects = readProjects();
  projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const has = projects.length > 0;
  if (empty) empty.hidden = has;
  grid.hidden = !has;
  grid.innerHTML = (has ? projects.map(cardHTML).join('') : '') +
    `<button class="proj-new" id="lpNewCard" type="button"><i>+</i>${tr('新建方案', 'New plan')}</button>`;
  $('#lpNewCard')?.addEventListener('click', openNewProjectModal);
}

function showLanding(){
  document.body.classList.add('mode-landing');
  renderLanding();
  syncPaneBtns?.();
}
function hideLanding(){
  document.body.classList.remove('mode-landing');
}

/* ------------------------ 打开 / 返回 ------------------------ */
function openProject(id){
  const p = getProject(id);
  if (!p || !p.state) return toast(tr('方案数据缺失，无法打开', 'This plan has no data'));
  if (typeof viewMode !== 'undefined' && viewMode === '3d'){
    try { window.View3D?.exit(); } catch (e) {}
    viewMode = '2d';
    document.body.classList.remove('m3d');
  }
  let st;
  try { st = fixState(JSON.parse(JSON.stringify(p.state))); }
  catch (e) { return toast(tr('方案数据已损坏，无法打开', 'This plan is corrupted')); }

  currentProjectId = id;
  state = st;
  if (!Array.isArray(state.floors) || !state.floors.length) ensureFloors();
  state.floorCount = Math.max(1, state.floors.length);
  state.activeFloor = Math.max(0, Math.min(state.activeFloor | 0, state.floors.length - 1));
  ensureFloors();
  applyFloorToState(state.floors[state.activeFloor]);

  ui.sel = null; ui.mA = null;
  undoStack.length = 0; redoStack.length = 0;
  hideLanding();
  fitView();
  renderOpenings(); renderDims(); renderAll();
  if (typeof syncBgControlsUi === 'function') syncBgControlsUi();
  if (typeof syncFloorUi === 'function') syncFloorUi();
  markDesignClean();
  save();
  toast(tr(`已打开「${p.name}」`, `Opened “${p.name}”`));
}

function backToProjects(){
  if (currentProjectId) flushProject();
  if (typeof viewMode !== 'undefined' && viewMode === '3d'){
    try { window.View3D?.exit(); } catch (e) {}
    viewMode = '2d';
    document.body.classList.remove('m3d');
  }
  currentProjectId = null;
  ui.sel = null;
  showLanding();
}

/* ------------------------ 增删改 ------------------------ */
function makeBlankState(nFloors, heightMm){
  const st = blankState();
  const n = Math.max(1, Math.min(3, nFloors | 0));
  st.floors = st.floors || [];
  while (st.floors.length < n){
    const k = st.floors.length + 1;
    const rec = typeof emptyFloorRecord === 'function'
      ? emptyFloorRecord('F' + k, k + 'F')
      : JSON.parse(JSON.stringify(st.floors[0]));
    if (rec.plan && st.floors[0]?.plan?.bounds) rec.plan.bounds = { ...st.floors[0].plan.bounds };
    st.floors.push(rec);
  }
  st.floors.length = n;
  st.floors.forEach((f, i) => {
    f.id = f.id || ('F' + (i + 1));
    f.name = f.name || ((i + 1) + 'F');
    f.heightMm = heightMm;
    f.furniture = [];
    f.rooms = {};
    f.demolished = [];
    f.measures = [];
    f.links = [];
  });
  st.floorCount = n;
  st.activeFloor = 0;
  st.combineFloors3d = n > 1;
  st.wholeBuilding3d = false;
  st.furniture = [];
  st.rooms = {};
  st.demolished = [];
  st.measures = [];
  st.plan = st.floors[0].plan;
  return st;
}

/** 把当前 state 的楼层数调整为 n（新建空白画布 / 重置方案时保持用户设定的层数） */
function resizeFloorsTo(n){
  n = Math.max(1, Math.min(3, n | 0));
  if (!state) return;
  if (!Array.isArray(state.floors) || !state.floors.length){ state.floorCount = n; ensureFloors(); }
  while (state.floors.length < n){
    const k = state.floors.length + 1;
    const rec = typeof emptyFloorRecord === 'function'
      ? emptyFloorRecord('F' + k, k + 'F')
      : JSON.parse(JSON.stringify(state.floors[0]));
    if (rec.plan && state.floors[0]?.plan?.bounds) rec.plan.bounds = { ...state.floors[0].plan.bounds };
    state.floors.push(rec);
  }
  if (state.floors.length > n) state.floors.length = n;
  state.floorCount = n;
  state.activeFloor = Math.max(0, Math.min(state.activeFloor | 0, n - 1));
}

/* ------------------------ 导入方案（JSON） ------------------------ */
let _importState = null;

/** 从导入的文件里挑一层：同序号优先 → 内容最多的那层 */
function pickSourceFloor(s, idx){
  if (Array.isArray(s.floors) && s.floors.length){
    if (s.floors.length === 1) return s.floors[0];
    if (s.floors[idx]) return s.floors[idx];
    let best = s.floors[0], score = -1;
    s.floors.forEach(f => {
      const n = ((f?.plan?.walls?.length) || 0) * 3 + ((f?.furniture?.length) || 0);
      if (n > score){ score = n; best = f; }
    });
    return best;
  }
  return { plan: s.plan || null, furniture: s.furniture || [], rooms: s.rooms || {},
           demolished: s.demolished || [], measures: s.measures || [],
           bgImage: s.bgImage || null, bgOpacity: s.bgOpacity, bgScale: s.bgScale,
           bgFrame: s.bgFrame || null, bgAspect: s.bgAspect };
}

function openImportModal(s, fileName){
  _importState = s;
  const m = $('#importModal'); if (!m) return;
  const floors = Math.max(1, (state.floors || []).length);
  const curName = (state.floors && state.floors[state.activeFloor | 0] && state.floors[state.activeFloor | 0].name)
    || (((state.activeFloor | 0) + 1) + 'F');
  const srcFloors = Math.max(1, Array.isArray(s.floors) && s.floors.length ? s.floors.length : 1);
  const info = $('#imInfo');
  if (info){
    info.textContent = tr(
      `文件「${fileName}」包含 ${srcFloors} 层内容，当前方案共 ${floors} 层。请选择导入方式：`,
      `“${fileName}” contains ${srcFloors} floor(s); this plan has ${floors}. Choose how to import:`);
  }
  const fn = $('#imFloorName');
  if (fn) fn.textContent = floors > 1 ? curName : tr('当前画布', 'this canvas');
  m.hidden = false;
}
function closeImportModal(){ const m = $('#importModal'); if (m) m.hidden = true; _importState = null; }

function importIntoFloor(){
  const s = _importState;
  if (!s || !state) return;
  const idx = Math.max(0, Math.min(state.activeFloor | 0, (state.floors || []).length - 1));
  const cur = state.floors[idx];
  if (!cur) return;
  const src = pickSourceFloor(s, idx);
  const b = snap();
  cur.plan = src.plan ? JSON.parse(JSON.stringify(src.plan)) : emptyPlanSnapshot();
  cur.furniture = JSON.parse(JSON.stringify(src.furniture || []));
  cur.rooms = JSON.parse(JSON.stringify(src.rooms || {}));
  cur.demolished = (src.demolished || []).slice();
  cur.measures = JSON.parse(JSON.stringify(src.measures || []));
  cur.bgImage = src.bgImage || null;
  cur.bgOpacity = src.bgOpacity != null ? src.bgOpacity : 0.35;
  cur.bgScale = src.bgScale != null ? src.bgScale : 1.5;
  cur.bgFrame = src.bgFrame ? { ...src.bgFrame } : null;
  cur.bgAspect = src.bgAspect > 0 ? +src.bgAspect : null;
  applyFloorToState(cur);
  state._floorMatPolicy = 1;
  ui.sel = null;
  if (typeof resetRoomMatEnrichment === 'function') resetRoomMatEnrichment();
  commit(b);
  closeImportModal();
  fitView(); renderOpenings(); renderDims(); renderAll();
  if (typeof syncBgControlsUi === 'function') syncBgControlsUi();
  if (typeof syncFloorUi === 'function') syncFloorUi();
  toast(tr(`已导入到 ${cur.name || ((idx + 1) + 'F')}`, `Imported into ${cur.name || ((idx + 1) + 'F')}`));
}

/** 用导入文件的完整 state 新建一个方案：保留全部楼层，不裁剪、不合并、不覆盖现有方案。
 *  preferredName 优先（新建方案弹窗里用户手填的名字），否则用文件里的 projectName。
 *  文件菜单「导入为新方案」与新建方案弹窗里的「导入方案 JSON」共用此入口。 */
function createProjectFromImport(s, preferredName){
  if (!s || typeof s !== 'object') return null;
  let st;
  try { st = fixState(JSON.parse(JSON.stringify(s))); }
  catch (e) { toast(tr('文件内容已损坏', 'This file is corrupted')); return null; }
  // 旧版单层文件没有 floors：补出 floors 结构（仍按文件实际层数导入）
  if (!Array.isArray(st.floors) || !st.floors.length) ensureFloorsFrom(st);
  const base = String(preferredName || '').trim()
            || String(s.projectName || '').trim()
            || tr('导入方案', 'Imported plan');
  let name = base, k = 2;
  const all = readProjects();
  while (all.some(p => p.name === name)) name = `${base} (${k++})`;
  const id = newProjectId();
  const now = Date.now();
  st.projectId = id;
  st.projectName = name;
  st.floorCount = Math.max(1, st.floors.length);
  st.activeFloor = Math.max(0, Math.min(st.activeFloor | 0, st.floorCount - 1));
  const proj = {
    id, name, createdAt: now, updatedAt: now,
    floorCount: st.floors.length,
    heightMm: (st.floors[0] && st.floors[0].heightMm) || 2800,
    state: st,
  };
  if (!writeProjects([proj].concat(all))) return null;
  openProject(id);
  toast(tr(`已导入「${name}」（${st.floors.length} 层）`, `Imported “${name}” (${st.floors.length} floors)`));
  return id;
}
function importAsNewProject(){
  const s = _importState;
  if (!s) return;
  closeImportModal();
  createProjectFromImport(s, '');
}

function makeSampleState(nFloors, heightMm){
  const st = makeBlankState(nFloors, heightMm);
  try {
    if (!DEFAULT_PLAN) return st;
    applyPlanGeometry(DEFAULT_PLAN);
    const plan = snapshotPlan();
    const rooms = {};
    ROOMS.forEach(r => { rooms[r.id] = { name: r.name, mat: r.mat || null, wallpaper: null }; });
    const f1 = st.floors[0];
    f1.plan = JSON.parse(JSON.stringify(plan));
    f1.rooms = rooms;
    f1.furniture = typeof defaultFurniture === 'function' ? defaultFurniture() : [];
    st.plan = f1.plan;
    st.rooms = rooms;
    st.furniture = f1.furniture;
  } catch (e) { console.warn('sample plan failed', e); }
  return st;
}

function createProject(opts){
  const name = String((opts && opts.name) || '').trim() || tr('未命名方案', 'Untitled plan');
  const heightMm = Math.max(2200, Math.min(4000, Math.round((opts && opts.heightMm) || 2800)));
  const n = Math.max(1, Math.min(3, (opts && opts.floors) | 0 || 1));
  const st = (opts && opts.sample) ? makeSampleState(n, heightMm) : makeBlankState(n, heightMm);
  const id = newProjectId();
  const now = Date.now();
  st.projectId = id;
  st.projectName = name;
  const proj = { id, name, createdAt: now, updatedAt: now, floorCount: n, heightMm, state: st };
  projects = readProjects();
  writeProjects([proj].concat(projects));
  openProject(id);
  return id;
}

function renameProject(id, name){
  const p = getProject(id);
  if (!p) return;
  const n = String(name || '').trim();
  if (!n) return;
  p.name = n;
  p.updatedAt = Date.now();
  if (p.state){ p.state.projectName = n; }
  writeProjects(projects);
  if (id === currentProjectId && state) state.projectName = n;
  renderLanding();
}
function duplicateProject(id){
  const src = getProject(id);
  if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = newProjectId();
  copy.name = tr(`${src.name} 副本`, `${src.name} copy`);
  copy.createdAt = copy.updatedAt = Date.now();
  if (copy.state) copy.state.projectId = copy.id;
  writeProjects([copy].concat(projects));
  renderLanding();
  toast(tr(`已复制为「${copy.name}」`, `Duplicated as “${copy.name}”`));
}
function deleteProject(id){
  const p = getProject(id);
  if (!p) return;
  if (!confirm(tr(`删除方案「${p.name}」？该操作不可恢复。`, `Delete “${p.name}”? This cannot be undone.`))) return;
  writeProjects(projects.filter(x => x.id !== id));
  if (id === currentProjectId){ currentProjectId = null; showLanding(); }
  else renderLanding();
  toast(tr('方案已删除', 'Plan deleted'));
}

/* ------------------------ 自动保存 ------------------------ */
/** 把当前编辑状态覆盖写回方案卡片并落盘（即「覆盖之前的自动保存」）。
 *  返回 true=写入成功 / false=写盘失败（本地空间不足）/ null=当前没有打开的方案。
 *  返回值供「文件 ▾ → 保存方案」给出准确反馈；自动保存等其它调用方忽略返回值。 */
function flushProject(){
  if (!currentProjectId || !state) return null;
  const p = getProject(currentProjectId);
  if (!p) return null;
  try { packActiveFloor(); } catch (e) {}
  let snapshot;
  try { snapshot = JSON.parse(JSON.stringify(state)); } catch (e) { return false; }
  snapshot.projectId = p.id;
  snapshot.projectName = p.name;
  p.state = snapshot;
  p.updatedAt = Date.now();
  p.floorCount = Math.max(1, (state.floors || []).length);
  p.heightMm = (state.floors && state.floors[state.activeFloor | 0] || {}).heightMm || p.heightMm || 2800;
  const ok = writeProjects(projects);
  if (typeof markDesignClean === 'function') markDesignClean();
  return ok;
}
function scheduleProjectSave(){
  if (!currentProjectId) return;
  clearTimeout(_projTimer);
  _projTimer = setTimeout(flushProject, 600);
}

/* ------------------------ 弹窗：新建 / 重命名 ------------------------ */
function openNewProjectModal(){
  const modal = $('#projModal');
  if (!modal) return;
  const n = projects.length + 1;
  pmDefaultName = tr(`方案 ${n}`, `Plan ${n}`);
  $('#pmName').value = pmDefaultName;
  $('#pmHeight').value = 2800;
  pmFloorsN = 2;
  syncPmFloors();
  modal.hidden = false;
  requestAnimationFrame(() => { const el = $('#pmName'); el?.focus(); el?.select(); });
}
function closeNewProjectModal(){ const m = $('#projModal'); if (m) m.hidden = true; }
function syncPmFloors(){
  document.querySelectorAll('#pmFloors [data-n]').forEach(b => b.classList.toggle('on', +b.dataset.n === pmFloorsN));
}
function submitNewProject(sample){
  const name = ($('#pmName')?.value || '').trim();
  if (!name){ toast(tr('请先填写方案名称', 'Please enter a plan name')); $('#pmName')?.focus(); return; }
  const hRaw = +($('#pmHeight')?.value || 2800);
  const height = Math.max(2200, Math.min(4000, Math.round(hRaw / 10) * 10));
  closeNewProjectModal();
  createProject({ name, heightMm: height, floors: pmFloorsN, sample: !!sample });
}

let _renameId = null;
function openRenameModal(id){
  const p = getProject(id);
  if (!p) return;
  _renameId = id;
  const m = $('#renameModal'), inp = $('#rnInput');
  if (!m || !inp) return;
  inp.value = p.name;
  m.hidden = false;
  requestAnimationFrame(() => { inp.focus(); inp.select(); });
}
function closeRenameModal(){ const m = $('#renameModal'); if (m) m.hidden = true; _renameId = null; }
function applyRename(){
  if (!_renameId) return;
  const v = ($('#rnInput')?.value || '').trim();
  if (!v) return;
  const id = _renameId;
  closeRenameModal();
  renameProject(id, v);
}

/* ------------------------ 事件绑定 ------------------------ */
function bindLanding(){
  document.querySelectorAll('.js-new').forEach(b => b.addEventListener('click', openNewProjectModal));
  $('#langSel2')?.addEventListener('click', e => {
    const l = e.target.closest('[data-lang]')?.dataset.lang;
    if (l && l !== LANG) setLang(l);
  });
  $('#lpSample')?.addEventListener('click', () => {
    createProject({ name: tr('示例户型', 'Sample plan'), heightMm: 2800, floors: 2, sample: true });
  });
  const grid = $('#lpGrid');
  if (grid){
    grid.addEventListener('click', e => {
      const act = e.target.closest('[data-act]');
      if (act){
        e.stopPropagation();
        const id = act.dataset.id;
        if (act.dataset.act === 'rename') openRenameModal(id);
        else if (act.dataset.act === 'dup') duplicateProject(id);
        else if (act.dataset.act === 'del') deleteProject(id);
        return;
      }
      const card = e.target.closest('.proj-card');
      if (card) openProject(card.dataset.id);
    });
    grid.addEventListener('keydown', e => {
      const card = e.target.closest('.proj-card');
      if (card && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); openProject(card.dataset.id); }
    });
  }
  $('#pmCancel')?.addEventListener('click', closeNewProjectModal);
  $('#projModalClose')?.addEventListener('click', closeNewProjectModal);
  $('#pmCreate')?.addEventListener('click', () => submitNewProject(false));
  $('#pmSample')?.addEventListener('click', () => submitNewProject(true));
  // 新建方案时直接导入之前导出的方案 JSON：完整还原所有楼层
  $('#pmImport')?.addEventListener('click', () => $('#pmFileIn')?.click());
  $('#pmFileIn')?.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    file.text().then(txt => {
      let s;
      try { s = JSON.parse(txt); } catch (err) { return toast(tr('文件格式不正确', 'Invalid file format')); }
      if (!s || typeof s !== 'object' ||
          (!Array.isArray(s.floors) && !Array.isArray(s.furniture) && !s.plan))
        return toast(tr('不是有效的方案文件', 'Not a valid plan file'));
      const typed = ($('#pmName')?.value || '').trim();
      // 用户没改默认名 → 用文件里的方案名（导出时已写入）；改过 → 尊重用户填的名字
      const preferred = (typed && typed !== pmDefaultName)
        ? typed
        : (String(s.projectName || '').trim() || String(file.name || '').replace(/\.json$/i, '').trim());
      closeNewProjectModal();
      createProjectFromImport(s, preferred);
    }).catch(() => toast(tr('文件读取失败', 'Could not read the file')));
  });
  $('#pmFloors')?.addEventListener('click', e => {
    const b = e.target.closest('[data-n]');
    if (!b) return;
    pmFloorsN = +b.dataset.n;
    syncPmFloors();
  });
  $('#pmName')?.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); submitNewProject(false); } });
  $('#pmHeight')?.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); submitNewProject(false); } });

  $('#rnCancel')?.addEventListener('click', closeRenameModal);
  $('#renameModalClose')?.addEventListener('click', closeRenameModal);
  $('#rnApply')?.addEventListener('click', applyRename);
  $('#rnInput')?.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); applyRename(); } });

  $('#imToFloor')?.addEventListener('click', importIntoFloor);
  $('#imNewProject')?.addEventListener('click', importAsNewProject);
  $('#importModalClose')?.addEventListener('click', closeImportModal);
  $('#importModal')?.addEventListener('click', e => { if (e.target === $('#importModal')) closeImportModal(); });

  $('#backToProjects')?.addEventListener('click', backToProjects);
  // 编辑时按 Esc 之外不要误触退出；仅按钮返回
  addEventListener('beforeunload', () => { try { flushProject(); } catch (e) {} });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden'){ try { flushProject(); } catch (e) {} } });
}

/* ------------------------ 启动 ------------------------ */
(function bootProjects(){
  projects = readProjects();
  bindLanding();
  // 老版本单方案存档 → 迁移成一个方案，避免用户丢数据
  if (!projects.length){
    try {
      const legacy = JSON.parse(localStorage.getItem('huxing-design-v1'));
      if (legacy && Array.isArray(legacy.furniture) && ((legacy.plan?.walls?.length || 0) > 0 || legacy.furniture.length)){
        const st = fixState(legacy);
        if (!Array.isArray(st.floors) || !st.floors.length){
          ensureFloorsFrom(st);
        }
        const now = Date.now();
        const p = {
          id: newProjectId(),
          name: tr('我的方案', 'My plan'),
          createdAt: now, updatedAt: now,
          floorCount: Math.max(1, (st.floors || []).length || 1),
          heightMm: (st.floors && st.floors[0] && st.floors[0].heightMm) || 2800,
          state: st,
        };
        writeProjects([p]);
      }
    } catch (e) {}
  }
  showLanding();
})();

/** 给迁移来的旧存档补 floors 结构（不依赖全局 state） */
function ensureFloorsFrom(st){
  const h = (st.floors && st.floors[0] && st.floors[0].heightMm) || 2800;
  const f1 = {
    id: 'F1', name: '1F', heightMm: h,
    plan: st.plan || emptyPlanSnapshot(),
    furniture: st.furniture || [],
    rooms: st.rooms || {},
    demolished: st.demolished || [],
    measures: st.measures || [],
    bgImage: st.bgImage || null, bgOpacity: st.bgOpacity, bgScale: st.bgScale,
    bgFrame: st.bgFrame || null, bgAspect: st.bgAspect || null,
    links: Array.isArray(st.links) ? st.links : [],
  };
  const f2 = typeof emptyFloorRecord === 'function' ? emptyFloorRecord('F2', '2F') : null;
  if (f2 && f1.plan?.bounds) f2.plan.bounds = { ...f1.plan.bounds };
  st.floors = f2 ? [f1, f2] : [f1];
  st.activeFloor = 0;
  st.combineFloors3d = st.floors.length > 1;
  st.floorCount = st.floors.length;
}
