/* ======================= 视图 ======================= */
function applyView(){
  const W = svg.clientWidth, H = svg.clientHeight;
  svg.setAttribute('viewBox', `${view.x0} ${view.y0} ${W/view.s} ${H/view.s}`);
  const ratio = 1/(view.s*PX_MM);
  $('#ratio').textContent = '1:' + Math.round(ratio);
  const nice = [100,200,500,1000,2000,5000].find(v => v*view.s >= 60) || 5000;
  $('#sbBar').style.width = nice*view.s + 'px';
  $('#sbText').textContent = nice >= 1000 ? `${nice/1000} m` : `${nice} mm`;
  renderSel(); renderMeasure(); renderLinks();
}
function fitView(){
  const W = svg.clientWidth, H = svg.clientHeight;
  view.s = Math.min(W/BOUNDS.w, H/BOUNDS.h);
  view.x0 = BOUNDS.x - (W/view.s - BOUNDS.w)/2; view.y0 = BOUNDS.y - (H/view.s - BOUNDS.h)/2;
  applyView();
}
function zoomAt(ns, mx, my){
  ns = Math.max(.012, Math.min(2, ns));
  const px = view.x0 + mx/view.s, py = view.y0 + my/view.s;
  view.s = ns; view.x0 = px - mx/ns; view.y0 = py - my/ns; applyView();
}
const zoomCenter = k => zoomAt(view.s*k, svg.clientWidth/2, svg.clientHeight/2);
const setRatio = r => zoomAt(1/(r*PX_MM), svg.clientWidth/2, svg.clientHeight/2);

function toMM(e){
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

/* ======================= 吸附 ======================= */
const grid = () => 10;
function snapMove(f, cx, cy){
  let nx = Math.round(cx/grid())*grid(), ny = Math.round(cy/grid())*grid();
  if (!ui.layers.wallSnap) return [nx, ny];
  const {hw, hh} = aabb(f), tol = 10/view.s;
  let bx = tol, by = tol;
  for (const r of snapRects()){
    if (!(r[3] < cy-hh-tol || r[1] > cy+hh+tol)) for (const ex of [r[0], r[2]]) for (const c of [ex+hw, ex-hw]) if (Math.abs(c-cx) < bx){ bx = Math.abs(c-cx); nx = c; }
    if (!(r[2] < cx-hw-tol || r[0] > cx+hw+tol)) for (const ey of [r[1], r[3]]) for (const c of [ey+hh, ey-hh]) if (Math.abs(c-cy) < by){ by = Math.abs(c-cy); ny = c; }
  }
  return [nx, ny];
}
function snapPoint(p, shift){
  let x = Math.round(p.x/10)*10, y = Math.round(p.y/10)*10;
  const tol = 8/view.s; let bx = tol, by = tol;
  for (const r of snapRects()){
    for (const ex of [r[0], r[2]]) if (Math.abs(ex-p.x) < bx){ bx = Math.abs(ex-p.x); x = ex; }
    for (const ey of [r[1], r[3]]) if (Math.abs(ey-p.y) < by){ by = Math.abs(ey-p.y); y = ey; }
  }
  const origin = ui.mA || (ui.tool === 'draw' ? ui.drawA : null);
  if (shift && origin){ if (Math.abs(x-origin.x) > Math.abs(y-origin.y)) y = origin.y; else x = origin.x; }
  return {x, y};
}

// 命中连通区（含边缘容差）：本层优先，其次是其它楼层连通区的参考框。
// 返回 {f, i, ref}；ref=true 表示命中的是「另一层的连通区」——拖动它时会在
// 当前层建立自己的对齐锚点，另一层的连通区数据保持完全不变。
function hitLink(p){
  const floors = state.floors;
  if (!Array.isArray(floors)) return null;
  const ai = state.activeFloor | 0;
  const tol = 8 / view.s;
  const inside = r => r && p.x >= r[0] - tol && p.x <= r[2] + tol && p.y >= r[1] - tol && p.y <= r[3] + tol;
  const cur = floors[ai];
  if (cur && Array.isArray(cur.links))
    for (let i = cur.links.length - 1; i >= 0; i--){
      const r = cur.links[i] && cur.links[i].rect;
      if (inside(r)) return {f: ai, i, ref:false};
    }
  for (let f = 0; f < floors.length; f++){
    if (f === ai) continue;
    const fl = floors[f];
    if (!fl || !Array.isArray(fl.links)) continue;
    for (let i = fl.links.length - 1; i >= 0; i--){
      const r = fl.links[i] && fl.links[i].rect;
      if (inside(r)) return {f, i, ref:true};
    }
  }
  return null;
}

/* ======================= 指针交互 ======================= */
let drag = null, pinch = null, rpan = null; // rpan：左键画墙/测量时叠加的右键平移
const touches = new Map();                     // 当前按在平面图上的手指
const svgXY = (x, y) => { const r = svg.getBoundingClientRect(); return [x - r.left, y - r.top]; };
function pinchInfo(){
  const [a, b] = [...touches.values()];
  return {d:Math.max(1, Math.hypot(b.x-a.x, b.y-a.y)), c:svgXY((a.x+b.x)/2, (a.y+b.y)/2)};
}
// 结束当前拖动：移动过的家具记入撤销栈
function endDrag(cancel){
  const d = drag; drag = null; svg.classList.remove('panning');
  if (!d) return;
  if (d.kind === 'link'){
    const a = ui.linkA, b = ui.linkCur;
    ui.linkA = ui.linkCur = null;
    if (!cancel && d.moved && a && b){
      const r = [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
      if (r[2] - r[0] >= 200 && r[3] - r[1] >= 200){
        if (typeof addFloorLink === 'function') addFloorLink(r);
      } else {
        toast(tr('连通区域太小，请拖出至少 200×200 mm 的矩形', 'Link area too small — drag at least 200×200 mm'));
      }
    } else if (!cancel && !d.moved){
      toast(tr('请按住并拖出一个矩形区域', 'Press and drag to draw a rectangle'));
    }
    renderLinks(); return;
  }
  if (d.kind === 'link-move'){
    const fl = state.floors[d.f];
    const lk = fl && fl.links && fl.links[d.idx];
    if (cancel || !lk){
      // 取消：移除从参考框新建的锚点；若复用了本层已有锚点则还原其原位置
      if (d.created && fl && Array.isArray(fl.links)) fl.links.splice(d.idx, 1);
      else if (d.prevRect && lk) lk.rect = d.prevRect.slice();
      else if (lk) lk.rect = d.orig.slice();
    } else if (d.moved || d.fromRef){
      // fromRef：即使只点选没拖，也已在本层按参考位置建立了锚点，需进撤销栈
      commit(d.before);
      if (typeof renderAll === 'function') renderAll();
      if (window.View3D?.sync) window.View3D.sync(true);
    } else if (lk){
      lk.rect = d.orig.slice();
    }
    renderLinks(); return;
  }
  if (d.kind === 'link-resize'){
    const fl = state.floors[d.f];
    const lk = fl && fl.links && fl.links[d.idx];
    if (cancel || !lk){
      if (lk) lk.rect = d.orig.slice();   // 取消：还原
    } else if (d.moved){
      commit(d.before);
      if (typeof renderAll === 'function') renderAll();
      if (window.View3D?.sync) window.View3D.sync(true);
    }
    renderLinks(); return;
  }
  if (d.kind === 'measure' || d.kind === 'calibrate'){
    if (cancel){ ui.mA = ui.mCur = null; renderMeasure(); return; }
    if (d.moved && ui.mA && ui.mCur && Math.hypot(ui.mCur.x-ui.mA.x, ui.mCur.y-ui.mA.y) > 20){
      const a = ui.mA, b = ui.mCur; ui.mA = ui.mCur = null; renderMeasure();
      if (d.kind === 'calibrate') openCalibrateModal(a, b);
      else mutate(() => state.measures.push({a, b}));
      return;
    }
    renderMeasure(); return;                   // 没拖动：保留起点，等第二次点击
  }
  if (d.kind === 'draw'){
    if (cancel){ ui.drawA = ui.drawCur = null; renderWallDraft(); return; }
    if (ui.drawA && ui.drawCur && (d.moved || Math.hypot(ui.drawCur.x - ui.drawA.x, ui.drawCur.y - ui.drawA.y) > 100)){
      addDrawnWall(ui.drawA, ui.drawCur);
    }
    ui.drawA = ui.drawCur = null; renderWallDraft(); return;
  }
  if (d.kind === 'pan'){
    if (!cancel && !d.moved && ui.tool === 'select' && !d.right){
      if (d.door != null && DOORS[d.door]) select({kind:'door', id:d.door});
      else if (d.slide != null && SLIDES[d.slide]) select({kind:'slide', id:d.slide});
      else if (d.win != null && WINS[d.win]) select({kind:'win', id:d.win});
      else select(d.room ? {kind:'room', id:d.room} : null);
    }
    return;
  }
  if (d.kind === 'wall-move' || d.kind === 'wall-a' || d.kind === 'wall-b'){
    if (cancel){
      try {
        const s = JSON.parse(d.before); state = fixState(s); ensurePlanFromState();
      } catch (err) {}
      renderWalls(); renderSel(); renderPanel(); return;
    }
    if (d.moved){
      const i = +d.id.slice(1);
      if (WALLS[i]){
        WALLS[i] = polishWall(WALLS[i], i);
        if (wallConflictsAny(WALLS[i], i) >= 0){
          try {
            const s = JSON.parse(d.before); state = fixState(s); ensurePlanFromState();
          } catch (err) {}
          toast(tr('不能与其他墙体重叠', 'Cannot overlap another wall'));
          renderWalls(); renderOpenings(); renderSel(); renderPanel(); return;
        }
        syncWinsForWall(i);
      }
      persistCustomPlan();
      commit(d.before);
      renderWalls(); renderOpenings(); renderSel(); renderPanel(); renderAll();
    }
    return;
  }
  if (d.kind === 'door-move' || d.kind === 'slide-move'){
    if (cancel){
      try {
        const s = JSON.parse(d.before); state = fixState(s); ensurePlanFromState();
      } catch (err) {}
      renderOpenings(); renderSel(); renderPanel(); return;
    }
    if (d.moved){
      persistCustomPlan();
      commit(d.before);
      renderOpenings(); renderSel(); renderPanel(); renderAll();
    }
    return;
  }
  if (d.moved){ commit(d.before); renderAll(); }
}

function canOverlayRightPan(){
  return !!(drag && (drag.kind === 'draw' || drag.kind === 'link' || drag.kind === 'measure' || drag.kind === 'calibrate' || drag.kind === 'wall-move' || drag.kind === 'wall-a' || drag.kind === 'wall-b' || drag.kind === 'door-move' || drag.kind === 'slide-move'));
}
function startRightPan(clientX, clientY){
  rpan = {lastX: clientX, lastY: clientY};
  svg.classList.add('panning');
}
function stepRightPan(clientX, clientY){
  if (!rpan) return;
  view.x0 -= (clientX - rpan.lastX) / view.s;
  view.y0 -= (clientY - rpan.lastY) / view.s;
  rpan.lastX = clientX;
  rpan.lastY = clientY;
  applyView();
}
function stopRightPan(){
  if (!rpan) return;
  rpan = null;
  if (!drag || drag.kind !== 'pan') svg.classList.remove('panning');
}

svg.addEventListener('pointerdown', e => {
  if (e.button === 1) return;
  // 右键：画墙等操作进行中只标记叠加平移（真正平移在 move 里用 buttons 检测，兼容 pointer capture）
  if (e.button === 2){
    e.preventDefault();
    closeDrawers(); $('details.menu').open = false;
    if (canOverlayRightPan()){
      startRightPan(e.clientX, e.clientY);
      return;
    }
    if (drag) endDrag(true);
    stopRightPan();
    drag = {kind:'pan', sx:e.clientX, sy:e.clientY, x0:view.x0, y0:view.y0, room:null, moved:false, right:true};
    svg.setPointerCapture(e.pointerId);
    return;
  }
  closeDrawers(); $('details.menu').open = false;
  if (e.pointerType !== 'mouse'){
    touches.set(e.pointerId, {x:e.clientX, y:e.clientY});
    svg.setPointerCapture(e.pointerId);
    if (touches.size >= 2){                    // 第二根手指落下：取消单指操作，进入双指缩放 / 平移
      endDrag(drag?.kind === 'measure' || drag?.kind === 'pan');
      const {d, c} = pinchInfo();
      pinch = {d, c, s:view.s, px:view.x0 + c[0]/view.s, py:view.y0 + c[1]/view.s};
      return;
    }
  }
  if (pinch) return;
  const p = toMM(e), t = e.target;
  const delLink = t.closest && t.closest('[data-link-del]');
  if (delLink){
    e.preventDefault(); e.stopPropagation();
    const df = state.activeFloor | 0;   // 只允许删本层：忽略 DOM 携带的楼层值
    if (typeof removeFloorLink === 'function') removeFloorLink(+delLink.dataset.linkDel, df);
    return;
  }
  if (ui.tool === 'link'){
    e.preventDefault();
    // 1) 命中编辑手柄 → 调整连通区大小（改所属层的 links）
    const handleEl = t.closest && t.closest('[data-link-handle]');
    if (handleEl){
      const f = state.activeFloor | 0, idx = +handleEl.dataset.linkIdx;   // 只允许改本层
      const fl = state.floors[f];
      const lk = fl && fl.links && fl.links[idx];
      if (lk && Array.isArray(lk.rect)){
        ui.linkSel = {f, i: idx};
        drag = {kind:'link-resize', f, idx, handle: handleEl.dataset.linkHandle, before:snap(), orig: lk.rect.slice(), sx:e.clientX, sy:e.clientY, moved:false};
        svg.setPointerCapture(e.pointerId);
        renderLinks(); return;
      }
    }
    // 2) 命中连通区：
    //    本层 → 直接移动本层连通区；
    //    另一层的参考框 → 在「本层」建立自己的对齐锚点后再移动，另一层数据保持原位。
    const hit = hitLink(p);
    if (hit){
      const ai = state.activeFloor | 0;
      const fl = state.floors[ai];
      if (hit.ref){
        const srcFl = state.floors[hit.f];
        const src = srcFl && srcFl.links && srcFl.links[hit.i];
        if (fl && src && Array.isArray(src.rect)){
          const b = snap();
          if (!Array.isArray(fl.links)) fl.links = [];
          let idx, created = false, prevRect = null;
          if (fl.links.length){
            idx = 0;                                  // 已有锚点：复用到参考位置再拖
            prevRect = fl.links[0].rect.slice();
            fl.links[0].rect = src.rect.slice();
          } else {
            fl.links.push({id: 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2,5), rect: src.rect.slice()});
            idx = fl.links.length - 1; created = true;
          }
          const lk = fl.links[idx];
          ui.linkSel = {f: ai, i: idx};
          drag = {kind:'link-move', f: ai, idx, fromRef:true, created, prevRect, before:b,
                  orig: lk.rect.slice(), ox:p.x, oy:p.y, sx:e.clientX, sy:e.clientY, moved:false};
          svg.setPointerCapture(e.pointerId);
          renderLinks(); return;
        }
      }
      const lk = fl && fl.links && fl.links[hit.i];
      if (lk && Array.isArray(lk.rect)){
        ui.linkSel = {f: ai, i: hit.i};
        drag = {kind:'link-move', f: ai, idx: hit.i, before:snap(), orig: lk.rect.slice(), ox:p.x, oy:p.y, sx:e.clientX, sy:e.clientY, moved:false};
        svg.setPointerCapture(e.pointerId);
        renderLinks(); return;
      }
    }
    // 3) 空白 → 清除选中并画新矩形
    ui.linkSel = null;
    const q = snapPoint(p, false);
    ui.linkA = q; ui.linkCur = q;
    drag = {kind:'link', sx:e.clientX, sy:e.clientY, moved:false};
    svg.setPointerCapture(e.pointerId);
    renderLinks(); return;
  }
  if (ui.tool === 'measure' || ui.tool === 'calibrate'){
    if (ui.tool === 'calibrate' && !state.bgImage){
      toast(tr('请先上传底图，再校准比例', 'Upload an underlay image first'));
      return;
    }
    const q = snapPoint(p, e.shiftKey);
    const kind = ui.tool === 'calibrate' ? 'calibrate' : 'measure';
    if (!ui.mA){ ui.mA = q; ui.mCur = q; drag = {kind, sx:e.clientX, sy:e.clientY, moved:false}; svg.setPointerCapture(e.pointerId); }
    else {
      const a = ui.mA; ui.mA = null; ui.mCur = null; renderMeasure();
      if (Math.hypot(q.x - a.x, q.y - a.y) > 20){
        if (kind === 'calibrate') openCalibrateModal(a, q);
        else mutate(() => state.measures.push({a, b:q}));
      }
    }
    renderMeasure(); return;
  }
  if (ui.tool === 'draw'){
    const q = snapPoint(p, true);
    ui.drawA = q; ui.drawCur = q;
    drag = {kind:'draw', sx:e.clientX, sy:e.clientY, moved:false};
    svg.setPointerCapture(e.pointerId);
    renderWallDraft(); return;
  }
  if (ui.tool === 'erase'){
    const wallEl = t.closest('[data-wall]');
    if (wallEl){ eraseWall(wallEl.dataset.wall); return; }
    // 点在窗户上：删掉宿主带窗墙（或孤立窗）
    const winEl = t.closest('[data-win]');
    if (winEl){
      const wi = +winEl.dataset.win;
      const win = WINS[wi];
      if (win && Number.isFinite(win[6]) && WALLS[win[6]]){
        eraseWall('w' + win[6]);
      } else if (win){
        mutate(() => { WINS.splice(wi, 1); persistCustomPlan(); });
        renderOpenings();
        toast(tr('已删除窗户', 'Window deleted'));
      }
      return;
    }
    const doorEl = t.closest('[data-door]');
    if (doorEl){
      const di = +doorEl.dataset.door;
      if (DOORS[di]){
        mutate(() => { DOORS.splice(di, 1); persistCustomPlan(); });
        renderOpenings();
        toast(tr('已删除门', 'Door deleted'));
      }
      return;
    }
    const slideEl = t.closest('[data-slide]');
    if (slideEl){
      const si = +slideEl.dataset.slide;
      if (SLIDES[si]){
        mutate(() => { SLIDES.splice(si, 1); persistCustomPlan(); });
        renderOpenings();
        toast(tr('已删除推拉门', 'Sliding door deleted'));
      }
      return;
    }
  }
  const wh = t.closest('[data-whandle]');
  if (wh && ui.sel?.kind === 'wall' && ui.tool === 'demolish'){
    const ww = getWall(ui.sel.id);
    if (ww){
      drag = {kind:'wall-' + wh.dataset.whandle, id:ww.id, sx:e.clientX, sy:e.clientY, before:snap(), moved:false, orig:ww.w.slice()};
      svg.setPointerCapture(e.pointerId); return;
    }
  }
  const h = t.closest('[data-handle]');
  if (h && ui.sel?.kind === 'furn'){
    drag = {kind:h.dataset.handle, id:ui.sel.id, sx:e.clientX, sy:e.clientY, before:snap(), moved:false};
  } else if ((ui.tool === 'select' || ui.tool === 'demolish') && t.closest('[data-door]')){
    const di = +t.closest('[data-door]').dataset.door;
    if (Number.isFinite(di) && DOORS[di]){
      select({kind:'door', id:di});
      drag = {kind:'door-move', id:di, sx:e.clientX, sy:e.clientY, before:snap(), moved:false};
    }
  } else if ((ui.tool === 'select' || ui.tool === 'demolish') && t.closest('[data-slide]')){
    const si = +t.closest('[data-slide]').dataset.slide;
    if (Number.isFinite(si) && SLIDES[si]){
      select({kind:'slide', id:si});
      drag = {kind:'slide-move', id:si, sx:e.clientX, sy:e.clientY, before:snap(), moved:false};
    }
  } else if ((ui.tool === 'select' || ui.tool === 'demolish') && t.closest('[data-win]')){
    const wi = +t.closest('[data-win]').dataset.win;
    if (Number.isFinite(wi) && WINS[wi]) select({kind:'win', id:wi});
    drag = {kind:'pan', sx:e.clientX, sy:e.clientY, x0:view.x0, y0:view.y0, room:null, win:wi, moved:false};
  } else if (ui.tool === 'demolish' && t.closest('[data-wall]')){
    const id = t.closest('[data-wall]').dataset.wall;
    const ww = getWall(id);
    if (!ww) return;
    select({kind:'wall', id});
    drag = {kind:'wall-move', id, sx:e.clientX, sy:e.clientY, ox:p.x, oy:p.y, before:snap(), moved:false, orig:ww.w.slice()};
  } else if (ui.tool === 'select' && t.closest('[data-fid]')){
    const f = getF(t.closest('[data-fid]').dataset.fid);
    if (ui.sel?.id !== f.id) select({kind:'furn', id:f.id});
    drag = {kind:'move', id:f.id, sx:e.clientX, sy:e.clientY, ox:p.x-f.cx, oy:p.y-f.cy, before:snap(), moved:false};
  } else {
    if (ui.tool === 'demolish') select(null);
    const room = t.closest('[data-room]');
    drag = {kind:'pan', sx:e.clientX, sy:e.clientY, x0:view.x0, y0:view.y0, room:room && room.dataset.room, moved:false};
  }
  svg.setPointerCapture(e.pointerId);
});

svg.addEventListener('pointermove', e => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (pinch){
    if (touches.size < 2) return;
    const {d, c} = pinchInfo(), ns = Math.max(.012, Math.min(2, pinch.s * d / pinch.d));
    view.s = ns; view.x0 = pinch.px - c[0]/ns; view.y0 = pinch.py - c[1]/ns; applyView();
    return;
  }
  // 鼠标右键叠加平移改走 mousemove（见下方），避免与 pointermove 重复计位移
  if (rpan && e.pointerType === 'mouse' && !(e.buttons & 2)) stopRightPan();

  const p = toMM(e);
  $('#cx').textContent = Math.round(p.x) + ' mm'; $('#cy').textContent = Math.round(p.y) + ' mm';
  if (!drag){
    const room = e.target.closest && e.target.closest('[data-room]');
    $('#hover').innerHTML = room ? `<b>${esc(state.rooms[room.dataset.room].name)}</b> ${fmt(area(ROOMS.find(r=>r.id===room.dataset.room).poly))} m²` : '';
    if ((ui.tool === 'measure' || ui.tool === 'calibrate') && ui.mA){ ui.mCur = snapPoint(p, e.shiftKey); renderMeasure(); }
    if (ui.tool === 'draw' && ui.drawA){ ui.drawCur = snapPoint(p, true); renderWallDraft(); }
    return;
  }
  const far = Math.hypot(e.clientX-drag.sx, e.clientY-drag.sy) >= TAP;
  if (drag.kind === 'link'){
    if (rpan){ ui.linkCur = snapPoint(p, true); renderLinks(); return; }
    if (far) drag.moved = true;
    ui.linkCur = snapPoint(p, true); renderLinks(); return;
  }
  if (drag.kind === 'link-move'){
    if (!drag.moved && !far) return;
    drag.moved = true;
    const fl = state.floors[drag.f];
    const lk = fl && fl.links && fl.links[drag.idx];
    if (!lk) return;
    const dx = Math.round((p.x - drag.ox) / 10) * 10, dy = Math.round((p.y - drag.oy) / 10) * 10;
    const o = drag.orig;
    lk.rect = [o[0] + dx, o[1] + dy, o[2] + dx, o[3] + dy];
    renderLinks(); return;
  }
  if (drag.kind === 'link-resize'){
    if (!drag.moved && !far) return;
    drag.moved = true;
    const fl = state.floors[drag.f];
    const lk = fl && fl.links && fl.links[drag.idx];
    if (!lk) return;
    const o = drag.orig;
    let r = o.slice();
    const h = drag.handle, q = snapPoint(p, false);
    if (h.includes('w')) r[0] = q.x;
    if (h.includes('e')) r[2] = q.x;
    if (h.includes('n')) r[1] = q.y;
    if (h.includes('s')) r[3] = q.y;
    if (r[2] - r[0] < 200){ if (h.includes('w')) r[0] = r[2] - 200; else r[2] = r[0] + 200; }
    if (r[3] - r[1] < 200){ if (h.includes('n')) r[1] = r[3] - 200; else r[3] = r[1] + 200; }
    if (r[0] > r[2]) [r[0], r[2]] = [r[2], r[0]];
    if (r[1] > r[3]) [r[1], r[3]] = [r[3], r[1]];
    lk.rect = r;
    renderLinks(); return;
  }
  if (drag.kind === 'measure' || drag.kind === 'calibrate'){
    if (far) drag.moved = true;
    ui.mCur = snapPoint(p, e.shiftKey); renderMeasure(); return;
  }
  if (drag.kind === 'draw'){
    // 右键平移中：只更新终点、不把平移当成画墙拖移阈值
    if (rpan){ ui.drawCur = snapPoint(p, true); renderWallDraft(); return; }
    if (far) drag.moved = true;
    ui.drawCur = snapPoint(p, true); renderWallDraft(); return;
  }
  if (drag.kind === 'pan'){
    if (!drag.moved && !far) return;
    drag.moved = true; svg.classList.add('panning');
    view.x0 = drag.x0 - (e.clientX-drag.sx)/view.s; view.y0 = drag.y0 - (e.clientY-drag.sy)/view.s; applyView(); return;
  }
  if (drag.kind === 'door-move' || drag.kind === 'slide-move'){
    if (!drag.moved && !far) return;
    drag.moved = true;
    const movingDoor = drag.kind === 'door-move' ? DOORS[drag.id] : null;
    const gateMove = !!(movingDoor && (movingDoor.gate || /花园门|garden\s*gate/i.test(movingDoor.name || '')));
    const hit = nearestWallHit(p.x, p.y, gateMove ? 2000 : 1600, {allowLow: gateMove, preferLow: gateMove});
    if (!hit) return;
    if (drag.kind === 'door-move'){
      const d = DOORS[drag.id]; if (!d) return;
      if (!relocateDoorOnHit(d, hit, hit.along, hit.horiz ? p.y : p.x)) return;
    } else {
      const sl = SLIDES[drag.id]; if (!sl) return;
      if (!relocateSlideOnHit(sl, hit, hit.along)) return;
    }
    renderOpenings(); renderSel();
    return;
  }
  if (drag.kind === 'wall-move' || drag.kind === 'wall-a' || drag.kind === 'wall-b'){
    if (!drag.moved && !far) return;
    drag.moved = true;
    const i = +drag.id.slice(1), o = drag.orig;
    if (!WALLS[i] || !o) return;
    const thick = wallThickOf(o), kind = o[4] || 'n', horiz = wallIsHoriz(o);
    let next;
    if (drag.kind === 'wall-move'){
      let dx = Math.round((p.x - drag.ox) / 10) * 10;
      let dy = Math.round((p.y - drag.oy) / 10) * 10;
      next = [o[0] + dx, o[1] + dy, o[2] + dx, o[3] + dy, kind];
    } else if (horiz){
      const y = (o[1] + o[3]) / 2;
      let x0 = o[0], x1 = o[2];
      if (drag.kind === 'wall-a') x0 = Math.round(p.x / 10) * 10;
      else x1 = Math.round(p.x / 10) * 10;
      if (Math.abs(x1 - x0) < 100){ if (drag.kind === 'wall-a') x0 = x1 - Math.sign(x1 - o[0] || 1) * 100; else x1 = x0 + Math.sign(o[2] - o[0] || 1) * 100; }
      next = [Math.min(x0, x1), y - thick / 2, Math.max(x0, x1), y + thick / 2, kind];
    } else {
      const x = (o[0] + o[2]) / 2;
      let y0 = o[1], y1 = o[3];
      if (drag.kind === 'wall-a') y0 = Math.round(p.y / 10) * 10;
      else y1 = Math.round(p.y / 10) * 10;
      if (Math.abs(y1 - y0) < 100){ if (drag.kind === 'wall-a') y0 = y1 - Math.sign(y1 - o[1] || 1) * 100; else y1 = y0 + Math.sign(o[3] - o[1] || 1) * 100; }
      next = [x - thick / 2, Math.min(y0, y1), x + thick / 2, Math.max(y0, y1), kind];
    }
    if (kind === 'low' && typeof attachLowWallHeight === 'function') attachLowWallHeight(next, o[5]);
    if (kind === 'beam' && typeof attachBeamDrop === 'function') attachBeamDrop(next, o[5]);
    if (wallConflictsAny(next, i) >= 0) return;
    WALLS[i] = next;
    syncWinsForWall(i);
    renderWalls(); renderOpenings(); renderSel();
    const inp = $('#wallLenIn'); if (inp) inp.value = Math.round(wallLenOf(WALLS[i]));
    return;
  }
  const f = getF(drag.id); if (!f) return;
  if (!drag.moved && !far) return;             // 轻点家具不应让它抖动一下
  drag.moved = true;
  if (drag.kind === 'move'){
    const [nx, ny] = snapMove(f, p.x-drag.ox, p.y-drag.oy);
    f.cx = nx; f.cy = ny;
    // 挂墙装饰移动时持续贴墙并自动转向，避免被拖离墙面后悬在半空
    if (WALL_DECOR.has(f.type)) snapWallDecor(f, nx, ny);
  } else if (drag.kind === 'rot'){
    let a = Math.atan2(p.y-f.cy, p.x-f.cx)*180/Math.PI + 90;
    f.rot = norm(e.shiftKey ? a : Math.round(a/15)*15);
  } else if (drag.kind === 'size'){
    const a = f.rot*Math.PI/180, c = Math.cos(a), s = Math.sin(a);
    const dx = p.x-f.cx, dy = p.y-f.cy, lx = dx*c + dy*s, ly = -dx*s + dy*c;
    const ax = -f.w/2, ay = -f.d/2;
    const nw = Math.max(100, Math.round((lx-ax)/10)*10), nd = Math.max(100, Math.round((ly-ay)/10)*10);
    const mx = ax + nw/2, my = ay + nd/2;
    f.cx += mx*c - my*s; f.cy += mx*s + my*c; f.w = nw; f.d = nd;
  }
  renderFurn(); renderSel();
});

function onPointerEnd(e){
  touches.delete(e.pointerId);
  if (pinch){ if (touches.size < 2) pinch = null; return; }   // 双指结束后，剩下的手指不再触发操作
  if (e.button === 2){
    stopRightPan();
    if (canOverlayRightPan()) return; // 左键仍在画墙/编辑，不结束主拖拽
  }
  // 左键抬起时若还残留右键平移状态，清掉
  if (e.button === 0) stopRightPan();
  endDrag(e.type === 'pointercancel');
}
svg.addEventListener('pointerup', onPointerEnd);
svg.addEventListener('pointercancel', onPointerEnd);
// 阻止 iPad Safari 把双指手势当成整页缩放
['gesturestart','gesturechange','gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault()));

// 鼠标右键兜底：在 pointer capture 下仍能收到 mousedown(button=2)
svg.addEventListener('mousedown', e => {
  if (e.button !== 2) return;
  e.preventDefault();
  if (canOverlayRightPan()) startRightPan(e.clientX, e.clientY);
}, true);
svg.addEventListener('mousemove', e => {
  if (!(e.buttons & 2) || !canOverlayRightPan()) return;
  if (!rpan) startRightPan(e.clientX, e.clientY);
  else stepRightPan(e.clientX, e.clientY);
  const pR = toMM(e);
  if (drag.kind === 'draw' && ui.drawA){ ui.drawCur = snapPoint(pR, true); renderWallDraft(); }
  else if (drag.kind === 'link' && ui.linkA){ ui.linkCur = snapPoint(pR, true); renderLinks(); }
  else if ((drag.kind === 'measure' || drag.kind === 'calibrate') && ui.mA){ ui.mCur = snapPoint(pR, e.shiftKey); renderMeasure(); }
}, true);
svg.addEventListener('mouseup', e => {
  if (e.button === 2) stopRightPan();
}, true);

svg.addEventListener('wheel', e => {
  e.preventDefault();
  const r = svg.getBoundingClientRect();
  zoomAt(view.s*Math.exp(-e.deltaY*(e.ctrlKey ? .01 : .0015)), e.clientX-r.left, e.clientY-r.top);
}, {passive:false});
svg.addEventListener('dblclick', e => { if (ui.tool==='select' && e.target.closest('[data-fid]')) rotateSel(90); });
svg.addEventListener('contextmenu', e => {
  e.preventDefault(); // 右键用于平移，屏蔽浏览器菜单
});


/* ======================= 键盘 ======================= */
const DRAW_PREF_INPUT_IDS = new Set(['wallThickIn', 'beamDropIn', 'winWIn', 'winHIn', 'winSillIn']);
function isDrawPrefInput(el){
  return !!(el && (DRAW_PREF_INPUT_IDS.has(el.id) || el.closest?.('#wallThick, #wallBeamOpts, #wallWinOpts, #wallKind')));
}
// 捕获阶段拦截：厚度等偏好输入框上的 Ctrl+Z 绝不走浏览器原生撤销
document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  if (mod && (k === 'z' || k === 'y') && isDrawPrefInput(e.target)){
    e.preventDefault();
    e.stopPropagation();
    if (window.View3D?.walking()) return;
    if (k === 'y' || (k === 'z' && e.shiftKey)) redo(); else undo();
    return;
  }
}, true);
document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  if (e.target.matches('input,select,textarea')) return;
  if (document.body.classList.contains('mode-landing')) return;   // 方案列表页不响应编辑器快捷键
  if (window.View3D?.walking()) return;
  if (mod && k === 'z'){ e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y'){ e.preventDefault(); redo(); return; }
  if (mod && k === 'd'){ e.preventDefault(); duplicateSel(); return; }
  if (mod) return;
  if (k === '[' || k === ']'){ drawer(k === '[' ? 'lib' : 'panel'); return; }
  if (k === 'f' && e.shiftKey){ toggleFullscreen(); return; }
  if (k === 't') setView(is3D() ? '2d' : '3d');
  else if (is3D() && ['v','m','c','x','w','e','f','l','+','=','-'].includes(k)) return;
  else if (k === 'v') setTool('select');
  else if (k === 'w') setTool('draw');
  else if (k === 'e') setTool('erase');
  else if (k === 'm') setTool('measure');
  else if (k === 'c') setTool('calibrate');
  else if (k === 'x') setTool('demolish');
  else if (k === 'l') setTool('link');
  else if (k === 'f') fitView();
  else if (k === 'r') rotateSel(e.shiftKey ? -90 : 90);
  else if (k === 'delete' || k === 'backspace'){ e.preventDefault(); deleteSel(); }
  else if (k === 'escape'){
    if ($('#calModal') && !$('#calModal').hidden && typeof closeCalibrateModal === 'function'){ closeCalibrateModal(); return; }
    if (ui.mA){ ui.mA = null; renderMeasure(); }
    else if (ui.drawA){ ui.drawA = ui.drawCur = null; renderWallDraft(); }
    else if (ui.linkSel != null){ ui.linkSel = null; renderLinks(); }
    else if (ui.linkA){ ui.linkA = ui.linkCur = null; renderLinks(); }
    else { if (ui.tool !== 'select') setTool('select'); select(null); }
  }
  else if (k.startsWith('arrow') && ui.sel?.kind === 'furn'){
    e.preventDefault(); const st = e.shiftKey ? 100 : 10;
    mutate(() => { const f = getF(ui.sel.id); if (k==='arrowleft') f.cx -= st; if (k==='arrowright') f.cx += st; if (k==='arrowup') f.cy -= st; if (k==='arrowdown') f.cy += st; });
  }
  else if (k.startsWith('arrow') && ui.sel?.kind === 'wall'){
    e.preventDefault(); const st = e.shiftKey ? 100 : 10;
    mutate(() => {
      const ww = getWall(ui.sel.id); if (!ww) return;
      let dx = 0, dy = 0;
      if (k === 'arrowleft') dx = -st; if (k === 'arrowright') dx = st;
      if (k === 'arrowup') dy = -st; if (k === 'arrowdown') dy = st;
      const w = ww.w;
      const next = [w[0] + dx, w[1] + dy, w[2] + dx, w[3] + dy, w[4]];
      if ((w[4] || 'n') === 'low' && typeof attachLowWallHeight === 'function') attachLowWallHeight(next, w[5]);
      if ((w[4] || 'n') === 'beam' && typeof attachBeamDrop === 'function') attachBeamDrop(next, w[5]);
      WALLS[ww.i] = next;
      syncWinsForWall(ww.i);
      persistCustomPlan();
    });
    renderWalls(); renderOpenings(); renderSel(); renderPanel();
  }
  else if (k === '+' || k === '=') zoomCenter(1.25);
  else if (k === '-') zoomCenter(.8);
});

/* ======================= 家具库 ======================= */
const LIB_CATS_KEY = 'huxing-lib-cats';
function loadLibCatOpen(){
  let saved = {};
  try {
    const s = JSON.parse(localStorage.getItem(LIB_CATS_KEY));
    if (s && typeof s === 'object') saved = s;
  } catch (e) {}
  // 默认只展开前两类；已记住的分类状态优先
  const o = {};
  LIB.forEach((c, i) => { o[c.cat] = saved[c.cat] != null ? !!saved[c.cat] : i < 2; });
  return o;
}
let libCatOpen = loadLibCatOpen();
function saveLibCatOpen(){
  try { localStorage.setItem(LIB_CATS_KEY, JSON.stringify(libCatOpen)); } catch (e) {}
}
function setAllLibCats(open){
  LIB.forEach(c => { libCatOpen[c.cat] = !!open; });
  saveLibCatOpen();
  buildLib();
}
function buildLib(){
  const toolbar = `<div class="lib-toolbar">
    <button type="button" class="btn" id="libExpandAll">${tr('全部展开','Expand all')}</button>
    <button type="button" class="btn" id="libCollapseAll">${tr('全部收起','Collapse all')}</button>
  </div>`;
  const cats = LIB.map((c, ci) => {
    const open = !!libCatOpen[c.cat];
    const grid = c.items.map((it, ii) => {
      const [t, n, w, d, col, extra] = it, pad = Math.max(w, d) * .08;
      const meta = t === 'stairs' ? {type: t, name: n, style: extra}
        : t === 'floor' ? {type: t, name: n, mat: extra}
        : {type: t, name: n};
      return `<div class="item" data-key="${ci}:${ii}" title="${tr('点击添加，或拖到平面图中的指定位置', 'Click to add, or drag onto the plan')}">
        <svg viewBox="${-w/2-pad} ${-d/2-pad} ${w+2*pad} ${d+2*pad}">${furnSVG(t,w,d,col,meta)}</svg><b>${esc(nm(n))}</b><small>${w}×${d}</small></div>`;
    }).join('');
    return `<section class="lib-cat${open ? ' open' : ''}" data-cat="${esc(c.cat)}">
      <button type="button" class="lib-cat-hd" aria-expanded="${open}">
        <span class="chev" aria-hidden="true">▶</span>
        <span class="cat-name">${esc(nm(c.cat))}</span>
        <span class="cat-count">${c.items.length}</span>
      </button>
      <div class="lib-grid">${grid}</div>
    </section>`;
  }).join('');
  const hint = `<div class="hint">${tr(
    `家具按真实尺寸（mm）绘制。门请拖到墙边开洞；地板请拖到房间内更换地面。${COARSE ? '点一下放到画面中央，或按住向右拖到平面图 / 3D 地面上（上下滑动为滚动列表）。' : '点击添加到画面中央，或直接拖到平面图 / 3D 地面上。'}`,
    `Furniture is drawn at real size (mm). Drop doors near walls; drop flooring inside a room. ${COARSE ? 'Tap to place at the center, or hold and drag right onto the plan / 3D floor (swipe up/down to scroll).' : 'Click to add at the center, or drag onto the plan / 3D floor.'}`)}</div>`;
  $('#lib').innerHTML = toolbar + cats + hint;
  $('#libExpandAll').onclick = () => setAllLibCats(true);
  $('#libCollapseAll').onclick = () => setAllLibCats(false);
  document.querySelectorAll('.lib-cat-hd').forEach(btn => {
    btn.onclick = () => {
      const sec = btn.closest('.lib-cat');
      const key = sec.dataset.cat;
      const open = !sec.classList.contains('open');
      sec.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open);
      libCatOpen[key] = open;
      saveLibCatOpen();
    };
  });
  document.querySelectorAll('.item').forEach(el => el.addEventListener('pointerdown', e => {
    if (e.button) return;
    libDrag = {el, id:e.pointerId, sx:e.clientX, sy:e.clientY, it:itemOf(el), ghost:null};
  }));
}
const itemOf = el => { const [ci, ii] = el.dataset.key.split(':').map(Number); return LIB[ci].items[ii]; };

// 家具库拖放：用 pointer 事件实现（iPad 上 HTML5 拖放不可靠）。
// 列表设置了 touch-action:pan-y，竖向滑动交给浏览器滚动（会触发 pointercancel），横向拖动才开始拖放。
let libDrag = null;
// 屏幕坐标 → 户型坐标（mm）。2D 取平面图坐标，3D 取射线与地面的交点；s = 该处每 mm 的屏幕像素数
function dropPoint(x, y){
  const r = $('#stage').getBoundingClientRect();
  if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
  if (document.elementFromPoint(x, y)?.closest('aside.open,#fab,#walkOverlay,#joy,#walkExit')) return null;
  if (is3D()) return window.View3D?.groundAt(x, y) || null;
  const p = toMM({clientX:x, clientY:y}); return {x:p.x, y:p.y, s:view.s};
}
addEventListener('pointermove', e => {
  if (!libDrag || e.pointerId !== libDrag.id) return;
  const {it} = libDrag;
  if (!libDrag.ghost){
    if (Math.hypot(e.clientX-libDrag.sx, e.clientY-libDrag.sy) < TAP) return;
    const g = libDrag.ghost = document.createElement('div'); g.id = 'ghost';
    const meta = it[0] === 'stairs' ? {type: it[0], name: it[1], style: it[5]}
      : it[0] === 'floor' ? {type: it[0], name: it[1], mat: it[5]}
      : {type: it[0], name: it[1]};
    g.innerHTML = `<svg viewBox="${-it[2]/2} ${-it[3]/2} ${it[2]} ${it[3]}">${furnSVG(it[0],it[2],it[3],it[4],meta)}</svg>`;
    document.body.appendChild(g); libDrag.el.classList.add('dragging');
  }
  // 幽灵图按落点处的比例显示真实大小（3D 中近大远小）
  const g = libDrag.ghost, s = Math.max(dropPoint(e.clientX, e.clientY)?.s || (is3D() ? .05 : view.s), .02);
  Object.assign(g.style, {width:Math.max(28, it[2]*s)+'px', height:Math.max(20, it[3]*s)+'px', left:e.clientX+'px', top:e.clientY+'px'});
  const lib = $('aside.lib');
  if (narrow() && lib.classList.contains('open') && e.clientX > lib.getBoundingClientRect().right) drawer(null);   // 拖出抽屉后自动收起
});
function endLibDrag(e, ok){
  if (!libDrag || e.pointerId !== libDrag.id) return;
  const d = libDrag; libDrag = null;
  d.el.classList.remove('dragging');
  if (d.ghost){
    d.ghost.remove();
    if (!ok) return;
    const p = dropPoint(e.clientX, e.clientY);
    if (p) addItem(d.it, p.x, p.y);
    else if (is3D() && e.clientX > $('#stage').getBoundingClientRect().left) toast(tr('请拖到地面上', 'Drop it on the floor'));
    return;
  }
  if (!ok) return;
  // 轻点：放到选中房间中心，否则放到画面中心（3D 取屏幕中心对应的地面位置）
  let p = null;
  if (ui.sel?.kind === 'room'){ const b = bbox(ROOMS.find(r => r.id===ui.sel.id).poly); p = {x:(b[0]+b[2])/2, y:(b[1]+b[3])/2}; }
  else if (is3D()){ const r = $('#stage').getBoundingClientRect(); p = window.View3D.groundAt(r.left + r.width/2, r.top + r.height/2); }
  if (!p) p = {x:view.x0 + svg.clientWidth/2/view.s, y:view.y0 + svg.clientHeight/2/view.s};
  addItem(d.it, p.x, p.y);
  closeDrawers();
}
addEventListener('pointerup', e => endLibDrag(e, true));
addEventListener('pointercancel', e => endLibDrag(e, false));
