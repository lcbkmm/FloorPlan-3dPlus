/* ======================= 右侧面板 ======================= */
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function renderPanel(){
  renderFab();
  const p = $('#panel');
  if (ui.sel?.kind === 'furn'){ const f = getF(ui.sel.id); if (f){ p.innerHTML = furnPanel(f); bindFurnPanel(f); return; } }
  if (ui.sel?.kind === 'room'){ p.innerHTML = roomPanel(ROOMS.find(r => r.id === ui.sel.id)); bindRoomPanel(); return; }
  if (ui.sel?.kind === 'wall'){ const ww = getWall(ui.sel.id); if (ww){ p.innerHTML = wallPanel(ww); bindWallPanel(ww); return; } }
  if (ui.sel?.kind === 'win'){ const w = WINS[ui.sel.id]; if (w){ p.innerHTML = winPanel(ui.sel.id, w); bindWinPanel(ui.sel.id); return; } }
  if (ui.sel?.kind === 'door'){ const d = DOORS[ui.sel.id]; if (d){ p.innerHTML = doorPanel(ui.sel.id, d); bindDoorPanel(ui.sel.id); return; } }
  if (ui.sel?.kind === 'slide'){ const sl = SLIDES[ui.sel.id]; if (sl){ p.innerHTML = slidePanel(ui.sel.id, sl); bindSlidePanel(ui.sel.id); return; } }
  p.innerHTML = overviewPanel(); bindOverview();
}
function hostWinIndexForWall(wallIndex){
  for (let i = 0; i < WINS.length; i++) if (WINS[i][6] === wallIndex) return i;
  return -1;
}
function wallPanel(ww){
  const w = ww.w, L = Math.round(wallLenOf(w)), T = Math.round(wallThickOf(w));
  const dem = state.demolished.includes(ww.id);
  const kind = w[4] || 'n';
  const kindName = (WALL_KIND_LABEL[kind] || WALL_KIND_LABEL.n)();
  const isLow = kind === 'low';
  const isBeam = kind === 'beam';
  const Hmm = isLow ? wallHeightMm(w) : (isBeam ? beamDropMm(w) : null);
  const wi = hostWinIndexForWall(ww.i);
  const win = wi >= 0 ? WINS[wi] : null;
  let winBlock = '';
  if (win){
    const WW = Math.round(winWidthOf(win)), sill = Math.round(winSillMm(win, wi)), head = Math.round(winHeadMm(win));
    winBlock = `<div class="form" style="margin-top:10px">
      <label class="full">${tr('窗宽','Window width')} (mm)<input type="number" id="wallWinWIn" value="${WW}" min="300" step="50"></label>
      <label class="full">${tr('窗高','Window height')} (mm)<input type="number" id="wallWinHIn" value="${head - sill}" min="400" step="50"></label>
      <label class="full">${tr('窗台高度','Sill height')} (mm)<input type="number" id="wallWinSillIn" value="${sill}" min="0" step="50"></label>
    </div>
    <div class="actions" style="margin-top:6px"><button class="btn" id="wallEditWin">${tr('选中窗户','Select window')}</button></div>`;
  }
  const title = isBeam ? tr('横梁编辑','Beam Edit') : isLow ? tr('矮围墙编辑','Low Wall Edit') : tr('墙体编辑','Wall Edit');
  const heightField = isLow
    ? `<label class="full">${tr('墙高','Wall height')} (mm)<input type="number" id="wallHIn" value="${Hmm}" min="600" max="2200" step="10"></label>`
    : isBeam
      ? `<label class="full">${tr('下垂高度','Drop depth')} (mm)<input type="number" id="wallHIn" value="${Hmm}" min="150" max="1800" step="10"></label>`
      : '';
  const tip = isBeam
    ? tr('拖动横梁平移；拖两端改长度；下垂高度为自天花向下的梁高。', 'Drag to move; drag ends to resize; drop depth is beam height from ceiling.')
    : isLow
      ? tr('拖动围墙平移；拖两端圆点改长度；墙高影响 3D 立面与花园门洞。', 'Drag to move; drag ends to resize; height affects 3D fence and gate openings.')
      : tr('拖动墙体平移；拖两端圆点改长度；方向键微调。', 'Drag wall to move; drag end dots to resize; arrow keys to nudge.');
  return `<section><h3>${title}</h3>
    <div class="form">
      <label class="full">${tr('长度','Length')} (mm)<input type="number" id="wallLenIn" value="${L}" min="100" step="10"></label>
      ${heightField}
    </div>
    <div class="muted" style="margin:8px 0">${tr('厚度','Thickness')} ${T} mm · ${kindName}${isLow || isBeam ? ' · ' + tr('3D 高度可调','Editable 3D height') : ''}${dem ? ' · ' + tr('已标记拆除','Marked for removal') : ''}</div>
    ${winBlock}
    <div class="actions">
      <button class="btn" id="wallToggleDem">${dem ? tr('恢复墙体','Restore wall') : tr('标记拆除','Mark demolish')}</button>
      <button class="btn danger" id="wallDel">${tr('删除墙段','Delete wall')}</button>
      <button class="btn" id="wallBack">${tr('← 返回','← Back')}</button>
    </div>
    <p class="muted" style="margin-top:10px;font-size:12px">${tip}</p>
  </section>`;
}
function bindWallPanel(ww){
  const inp = $('#wallLenIn');
  if (inp){
    const apply = () => {
      const v = +inp.value;
      if (!Number.isFinite(v)) return;
      mutate(() => { setWallLength(ww.i, v); syncWinsForWall(ww.i); persistCustomPlan(); });
      renderWalls(); renderOpenings(); renderSel(); renderPanel();
    };
    inp.onchange = apply;
    inp.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); apply(); } };
  }
  const hIn = $('#wallHIn');
  if (hIn){
    const applyH = () => {
      const v = +hIn.value;
      if (!Number.isFinite(v)) return;
      mutate(() => {
        const wall = WALLS[ww.i];
        if (!wall) return;
        const k = wall[4] || 'n';
        if (k === 'low'){
          attachLowWallHeight(wall, v);
          ui.lowWallH = wallHeightMm(wall);
        } else if (k === 'beam'){
          attachBeamDrop(wall, v);
          ui.beamDropH = beamDropMm(wall);
          const bin = $('#beamDropIn'); if (bin) bin.value = ui.beamDropH;
        } else return;
        persistCustomPlan();
      });
      renderSel(); renderPanel();
      window.View3D?.sync();
    };
    hIn.onchange = applyH;
    hIn.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); applyH(); } };
  }
  const applyWin = () => {
    const wi = hostWinIndexForWall(ww.i);
    if (wi < 0) return;
    const width = +$('#wallWinWIn')?.value;
    const height = +$('#wallWinHIn')?.value;
    const sill = +$('#wallWinSillIn')?.value;
    mutate(() => {
      setWinSize(wi, {
        width: Number.isFinite(width) ? width : undefined,
        height: Number.isFinite(height) ? height : undefined,
        sill: Number.isFinite(sill) ? sill : undefined,
      });
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
  };
  ['wallWinWIn','wallWinHIn','wallWinSillIn'].forEach(id => {
    const el = $('#' + id); if (!el) return;
    el.onchange = applyWin;
    el.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); applyWin(); } };
  });
  const ew = $('#wallEditWin');
  if (ew) ew.onclick = () => { const wi = hostWinIndexForWall(ww.i); if (wi >= 0) select({kind:'win', id:wi}); };
  const td = $('#wallToggleDem');
  if (td) td.onclick = () => { toggleWall(ww.id); renderSel(); renderPanel(); };
  const del = $('#wallDel');
  if (del) del.onclick = () => { eraseWall(ww.id); select(null); };
  const back = $('#wallBack');
  if (back) back.onclick = () => select(null);
}
function winPanel(i, w){
  const WW = Math.round(winWidthOf(w)), sill = Math.round(winSillMm(w, i)), head = Math.round(winHeadMm(w));
  return `<section><h3>${tr('窗户编辑','Window Edit')}</h3>
    <div class="form">
      <label class="full">${tr('窗宽','Window width')} (mm)<input type="number" id="winEditW" value="${WW}" min="300" step="50"></label>
      <label class="full">${tr('窗高','Window height')} (mm)<input type="number" id="winEditH" value="${head - sill}" min="400" step="50"></label>
      <label class="full">${tr('窗台高度','Sill height')} (mm)<input type="number" id="winEditSill" value="${sill}" min="0" step="50"></label>
    </div>
    <div class="muted" style="margin:8px 0">${tr('洞口顶标高','Head')} ${head} mm · ${tr('玻璃高','Glass')} ${head - sill} mm</div>
    <div class="actions">
      <button class="btn" id="winFloorEdit">${tr('设为落地窗','Floor-to-ceiling')}</button>
      <button class="btn danger" id="winDel">${tr('删除窗户','Delete window')}</button>
      <button class="btn" id="winBack">${tr('← 返回','← Back')}</button>
    </div>
  </section>`;
}
function clampDoorHeight(h, asGate){
  const lo = asGate ? 800 : 1600;
  const hi = 2700;
  const def = asGate ? 2000 : 2100;
  return Math.max(lo, Math.min(hi, Math.round((+h || def) / 10) * 10));
}
function isGardenGate(d){
  return !!(d && (d.gate || /花园门|garden\s*gate/i.test(d.name || '')));
}
/** 花园门扇数：1=单开，2=双开（默认） */
function gateLeaves(d){
  if (!isGardenGate(d)) return 1;
  return +d.leaves === 1 ? 1 : 2;
}
function doorHeightMm(d){
  const gate = isGardenGate(d);
  return clampDoorHeight(d && d.height != null ? d.height : (gate ? 2000 : 2100), gate);
}
function slideHeightMm(s){
  return clampDoorHeight(s && s.height != null ? s.height : (s && s.v ? 2400 : 2100), false);
}
/** 推拉门扇数：2–4，默认 2 */
function slideLeaves(s){
  const n = Math.round(+(s && s.leaves));
  if (n >= 1 && n <= 4) return n;
  return 2;
}
/** 打开时叠靠方向：start=沿轴向较小端，end=较大端 */
function slideToSide(s){
  return (s && s.slideTo === 'end') ? 'end' : 'start';
}
function doorPanel(i, d){
  const L = Math.round(d.len || Math.max(d.rect[2]-d.rect[0], d.rect[3]-d.rect[1]));
  const Hmm = doorHeightMm(d);
  const gate = isGardenGate(d);
  const leaves = gateLeaves(d);
  return `<section><h3>${gate ? tr('花园门编辑','Garden Gate Edit') : tr('门编辑','Door Edit')}</h3>
    <div class="form">
      <label class="full">${tr('名称','Name')}<input type="text" id="doorNameIn" value="${esc(nm(d.name || tr('门','Door')))}"></label>
      <label class="full">${gate ? tr('门宽','Gate width') : tr('门宽','Door width')} (mm)<input type="number" id="doorLenIn" value="${L}" min="500" max="3000" step="10"></label>
      <label class="full">${gate ? tr('门高','Gate height') : tr('门高','Door height')} (mm)<input type="number" id="doorHIn" value="${Hmm}" min="${gate ? 800 : 1600}" max="2700" step="10"></label>
      ${gate ? `<label class="full">${tr('开启方式','Swing type')}<select id="doorLeavesIn">
        <option value="2"${leaves === 2 ? ' selected' : ''}>${tr('双开门','Double gate')}</option>
        <option value="1"${leaves === 1 ? ' selected' : ''}>${tr('单开门','Single gate')}</option>
      </select></label>`
      : `<label class="full">${tr('门扇材质','Door finish')}<select id="doorFinishIn">
        <option value=""${!d.finish ? ' selected' : ''}>${tr('门型默认','Door-type default')}</option>
        ${DOOR_FINISHES.map(f => `<option value="${f.key}"${d.finish === f.key ? ' selected' : ''}>${esc(nm(f.name))}</option>`).join('')}
      </select></label>`}
    </div>
    <label style="display:flex;align-items:center;gap:8px;margin:10px 0;cursor:pointer">
      <input type="checkbox" id="doorEntryIn" ${d.entry ? 'checked' : ''}> ${tr('入户门样式','Entry door style')}
    </label>
    <label style="display:flex;align-items:center;gap:8px;margin:10px 0;cursor:pointer">
      <input type="checkbox" id="doorGateIn" ${gate ? 'checked' : ''}> ${tr('花园门样式（可贴矮围墙）','Garden gate style (snaps to low walls)')}
    </label>
    <div class="actions">
      <button class="btn" id="doorFlipOpen">${tr('翻转开启方向','Flip swing')}</button>
      <button class="btn" id="doorFlipHinge">${tr('换铰链侧','Flip hinge')}</button>
      <button class="btn danger" id="doorDel">${gate ? tr('删除花园门','Delete gate') : tr('删除门','Delete door')}</button>
      <button class="btn" id="doorBack">${tr('← 返回','← Back')}</button>
    </div>
    <p class="muted" style="margin-top:10px;font-size:12px">${gate
      ? tr('可贴矮围墙；可切换单开/双开，并改门宽、门高与开启方向。', 'Snaps to low walls; switch single/double; edit width, height and swing.')
      : tr('拖动门可沿墙平移或换到其他墙；可改门宽、门高、开启方向与铰链侧。', 'Drag to slide along a wall or move to another. Edit width, height, swing and hinge.')}</p>
  </section>`;
}
function rebuildDoorOnWall(d, len, hingeAtStart){
  const [x0,y0,x1,y1] = d.rect;
  const horiz = (x1 - x0) >= (y1 - y0);
  len = Math.max(500, Math.round(len / 10) * 10);
  const openSign = horiz ? Math.sign(d.o[1] || 1) || 1 : Math.sign(d.o[0] || 1) || 1;
  if (horiz){
    const cy0 = y0, cy1 = y1, mid = (x0 + x1) / 2;
    let a = Math.round((mid - len / 2) / 10) * 10, b = a + len;
    d.rect = [a, cy0, b, cy1];
    d.len = len;
    d.c = hingeAtStart ? [1, 0] : [-1, 0];
    d.o = [0, openSign];
    const faceY = openSign > 0 ? cy1 : cy0;
    d.h = hingeAtStart ? [a, faceY] : [b, faceY];
  } else {
    const cx0 = x0, cx1 = x1, mid = (y0 + y1) / 2;
    let a = Math.round((mid - len / 2) / 10) * 10, b = a + len;
    d.rect = [cx0, a, cx1, b];
    d.len = len;
    d.c = hingeAtStart ? [0, 1] : [0, -1];
    d.o = [openSign, 0];
    const faceX = openSign > 0 ? cx1 : cx0;
    d.h = hingeAtStart ? [faceX, a] : [faceX, b];
  }
}
function doorHingeAtStart(d){
  const [x0,y0,x1,y1] = d.rect;
  const horiz = (x1 - x0) >= (y1 - y0);
  if (horiz) return Math.abs(d.h[0] - x0) <= Math.abs(d.h[0] - x1);
  return Math.abs(d.h[1] - y0) <= Math.abs(d.h[1] - y1);
}
/** 把门洞放到指定墙段上的 along 位置（保留门宽 / 铰链 / 开启朝向） */
function relocateDoorOnHit(d, hit, along, openSideYorX){
  if (!d || !hit) return false;
  let L = Math.max(500, Math.round((d.len || Math.max(d.rect[2] - d.rect[0], d.rect[3] - d.rect[1])) / 10) * 10);
  const wallL = wallLenOf(hit.w);
  if (L > wallL - 40) L = Math.max(500, Math.floor((wallL - 40) / 10) * 10);
  if (L < 500) return false;
  const hingeAtStart = doorHingeAtStart(d);
  const wasHoriz = (d.rect[2] - d.rect[0]) >= (d.rect[3] - d.rect[1]);
  if (hit.horiz){
    let openSign = wasHoriz ? (Math.sign(d.o[1]) || 1)
      : (openSideYorX != null ? (openSideYorX >= hit.cross ? 1 : -1) : (Math.sign(d.o[0]) || 1));
    let x0 = Math.round((along - L / 2) / 10) * 10, x1 = x0 + L;
    if (x0 < hit.w[0]){ x1 += hit.w[0] - x0; x0 = hit.w[0]; }
    if (x1 > hit.w[2]){ x0 -= x1 - hit.w[2]; x1 = hit.w[2]; }
    if (x1 - x0 < 500) return false;
    d.rect = [x0, hit.w[1], x1, hit.w[3]];
    d.len = Math.round(x1 - x0);
    d.c = hingeAtStart ? [1, 0] : [-1, 0];
    d.o = [0, openSign];
    const faceY = openSign > 0 ? hit.w[3] : hit.w[1];
    d.h = hingeAtStart ? [x0, faceY] : [x1, faceY];
  } else {
    let openSign = !wasHoriz ? (Math.sign(d.o[0]) || 1)
      : (openSideYorX != null ? (openSideYorX >= hit.cross ? 1 : -1) : (Math.sign(d.o[1]) || 1));
    let y0 = Math.round((along - L / 2) / 10) * 10, y1 = y0 + L;
    if (y0 < hit.w[1]){ y1 += hit.w[1] - y0; y0 = hit.w[1]; }
    if (y1 > hit.w[3]){ y0 -= y1 - hit.w[3]; y1 = hit.w[3]; }
    if (y1 - y0 < 500) return false;
    d.rect = [hit.w[0], y0, hit.w[2], y1];
    d.len = Math.round(y1 - y0);
    d.c = hingeAtStart ? [0, 1] : [0, -1];
    d.o = [openSign, 0];
    const faceX = openSign > 0 ? hit.w[2] : hit.w[0];
    d.h = hingeAtStart ? [faceX, y0] : [faceX, y1];
  }
  return true;
}
function relocateSlideOnHit(sl, hit, along){
  if (!sl || !hit) return false;
  let L = Math.max(800, Math.round(Math.max(sl.rect[2] - sl.rect[0], sl.rect[3] - sl.rect[1]) / 10) * 10);
  const wallL = wallLenOf(hit.w);
  if (L > wallL - 40) L = Math.max(800, Math.floor((wallL - 40) / 10) * 10);
  if (L < 800) return false;
  if (hit.horiz){
    let x0 = Math.round((along - L / 2) / 10) * 10, x1 = x0 + L;
    if (x0 < hit.w[0]){ x1 += hit.w[0] - x0; x0 = hit.w[0]; }
    if (x1 > hit.w[2]){ x0 -= x1 - hit.w[2]; x1 = hit.w[2]; }
    if (x1 - x0 < 800) return false;
    sl.rect = [x0, hit.w[1], x1, hit.w[3]];
    sl.v = false;
  } else {
    let y0 = Math.round((along - L / 2) / 10) * 10, y1 = y0 + L;
    if (y0 < hit.w[1]){ y1 += hit.w[1] - y0; y0 = hit.w[1]; }
    if (y1 > hit.w[3]){ y0 -= y1 - hit.w[3]; y1 = hit.w[3]; }
    if (y1 - y0 < 800) return false;
    sl.rect = [hit.w[0], y0, hit.w[2], y1];
    sl.v = true;
  }
  return true;
}
function bindDoorPanel(i){
  const applyLen = () => {
    const v = +$('#doorLenIn')?.value;
    if (!Number.isFinite(v)) return;
    mutate(() => {
      const d = DOORS[i]; if (!d) return;
      rebuildDoorOnWall(d, v, doorHingeAtStart(d));
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
  };
  const applyH = () => {
    const v = +$('#doorHIn')?.value;
    if (!Number.isFinite(v)) return;
    mutate(() => {
      const d = DOORS[i]; if (!d) return;
      d.height = clampDoorHeight(v, isGardenGate(d));
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
    window.View3D?.sync();
  };
  const nameIn = $('#doorNameIn');
  if (nameIn) nameIn.onchange = () => {
    mutate(() => {
      const d = DOORS[i]; if (d) d.name = nameIn.value.trim() || d.name;
      persistCustomPlan();
    });
    renderFab(); renderPanel();
  };
  const lenIn = $('#doorLenIn');
  if (lenIn){
    lenIn.onchange = applyLen;
    lenIn.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); applyLen(); } };
  }
  const hIn = $('#doorHIn');
  if (hIn){
    hIn.onchange = applyH;
    hIn.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); applyH(); } };
  }
  const ent = $('#doorEntryIn');
  if (ent) ent.onchange = () => {
    mutate(() => {
      const d = DOORS[i]; if (d) d.entry = !!ent.checked;
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
  };
  const finIn = $('#doorFinishIn');
  if (finIn) finIn.onchange = () => {
    mutate(() => {
      const d = DOORS[i]; if (!d) return;
      if (finIn.value) d.finish = finIn.value; else delete d.finish;
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
    window.View3D?.sync();          // 门扇在 3D 建筑里，需重建才能换材质
  };
  const leavesIn = $('#doorLeavesIn');
  if (leavesIn) leavesIn.onchange = () => {
    mutate(() => {
      const d = DOORS[i]; if (!d) return;
      d.leaves = +leavesIn.value === 1 ? 1 : 2;
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
    window.View3D?.sync();
  };
  const gateIn = $('#doorGateIn');
  if (gateIn) gateIn.onchange = () => {
    mutate(() => {
      const d = DOORS[i]; if (!d) return;
      d.gate = !!gateIn.checked;
      if (d.gate && !/花园/.test(d.name || '')) d.name = tr('花园门', 'Garden Gate');
      if (d.gate && (d.height == null || d.height >= 2100)) d.height = 2000;
      if (d.gate && d.leaves == null) d.leaves = 2;
      if (!d.gate) delete d.leaves;
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
    window.View3D?.sync();
  };
  const fo = $('#doorFlipOpen');
  if (fo) fo.onclick = () => {
    mutate(() => {
      const d = DOORS[i]; if (!d) return;
      d.o = [-d.o[0], -d.o[1]];
      const [x0,y0,x1,y1] = d.rect;
      const horiz = (x1 - x0) >= (y1 - y0);
      if (horiz) d.h = [d.h[0], d.o[1] > 0 ? y1 : y0];
      else d.h = [d.o[0] > 0 ? x1 : x0, d.h[1]];
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
  };
  const fh = $('#doorFlipHinge');
  if (fh) fh.onclick = () => {
    mutate(() => {
      const d = DOORS[i]; if (!d) return;
      rebuildDoorOnWall(d, d.len, !doorHingeAtStart(d));
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
  };
  const del = $('#doorDel');
  if (del) del.onclick = () => {
    mutate(() => { DOORS.splice(i, 1); persistCustomPlan(); });
    select(null); renderOpenings();
  };
  const back = $('#doorBack');
  if (back) back.onclick = () => select(null);
}
function slidePanel(i, sl){
  const [x0,y0,x1,y1] = sl.rect;
  const L = Math.round(Math.max(x1 - x0, y1 - y0));
  const Hmm = slideHeightMm(sl);
  const leaves = slideLeaves(sl);
  const to = slideToSide(sl);
  const sideOpts = sl.v
    ? `<option value="start"${to === 'start' ? ' selected' : ''}>${tr('推向上侧','Slide to top')}</option>
       <option value="end"${to === 'end' ? ' selected' : ''}>${tr('推向下侧','Slide to bottom')}</option>`
    : `<option value="start"${to === 'start' ? ' selected' : ''}>${tr('推向左侧','Slide to left')}</option>
       <option value="end"${to === 'end' ? ' selected' : ''}>${tr('推向右侧','Slide to right')}</option>`;
  return `<section><h3>${tr('推拉门编辑','Sliding Door Edit')}</h3>
    <div class="form">
      <label class="full">${tr('门洞宽度','Opening width')} (mm)<input type="number" id="slideLenIn" value="${L}" min="800" max="6000" step="10"></label>
      <label class="full">${tr('门高','Door height')} (mm)<input type="number" id="slideHIn" value="${Hmm}" min="1600" max="2700" step="10"></label>
      <label class="full">${tr('门扇数量','Number of panels')}<select id="slideLeavesIn">
        <option value="1"${leaves === 1 ? ' selected' : ''}>${tr('1 扇','1 panel')}</option>
        <option value="2"${leaves === 2 ? ' selected' : ''}>${tr('2 扇','2 panels')}</option>
        <option value="3"${leaves === 3 ? ' selected' : ''}>${tr('3 扇','3 panels')}</option>
        <option value="4"${leaves === 4 ? ' selected' : ''}>${tr('4 扇','4 panels')}</option>
      </select></label>
      <label class="full">${tr('开启叠靠','Stack when open')}<select id="slideToIn">${sideOpts}</select></label>
    </div>
    <div class="actions">
      <button class="btn danger" id="slideDel">${tr('删除推拉门','Delete sliding door')}</button>
      <button class="btn" id="slideBack">${tr('← 返回','← Back')}</button>
    </div>
    <p class="muted" style="margin-top:10px;font-size:12px">${tr('拖动推拉门可沿墙平移或换到其他墙；可改门高、扇数与推向哪一侧。', 'Drag to slide along a wall or move to another. Edit height, panels and stack side.')}</p>
  </section>`;
}
function bindSlidePanel(i){
  const apply = () => {
    const v = +$('#slideLenIn')?.value;
    if (!Number.isFinite(v)) return;
    mutate(() => {
      const sl = SLIDES[i]; if (!sl) return;
      const [x0,y0,x1,y1] = sl.rect;
      const len = Math.max(800, Math.round(v / 10) * 10);
      if (sl.v){
        const mid = (y0 + y1) / 2;
        sl.rect = [x0, mid - len / 2, x1, mid + len / 2];
      } else {
        const mid = (x0 + x1) / 2;
        sl.rect = [mid - len / 2, y0, mid + len / 2, y1];
      }
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
  };
  const inp = $('#slideLenIn');
  if (inp){
    inp.onchange = apply;
    inp.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); apply(); } };
  }
  const applyH = () => {
    const v = +$('#slideHIn')?.value;
    if (!Number.isFinite(v)) return;
    mutate(() => {
      const sl = SLIDES[i]; if (!sl) return;
      sl.height = clampDoorHeight(v, false);
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
    window.View3D?.sync();
  };
  const hIn = $('#slideHIn');
  if (hIn){
    hIn.onchange = applyH;
    hIn.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); applyH(); } };
  }
  const leavesIn = $('#slideLeavesIn');
  if (leavesIn) leavesIn.onchange = () => {
    mutate(() => {
      const sl = SLIDES[i]; if (!sl) return;
      sl.leaves = Math.max(1, Math.min(4, Math.round(+leavesIn.value) || 2));
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
    window.View3D?.sync();
  };
  const toIn = $('#slideToIn');
  if (toIn) toIn.onchange = () => {
    mutate(() => {
      const sl = SLIDES[i]; if (!sl) return;
      sl.slideTo = toIn.value === 'end' ? 'end' : 'start';
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
    window.View3D?.sync();
  };
  const del = $('#slideDel');
  if (del) del.onclick = () => {
    mutate(() => { SLIDES.splice(i, 1); persistCustomPlan(); });
    select(null); renderOpenings();
  };
  const back = $('#slideBack');
  if (back) back.onclick = () => select(null);
}
function bindWinPanel(i){
  const apply = () => {
    const width = +$('#winEditW')?.value;
    const height = +$('#winEditH')?.value;
    const sill = +$('#winEditSill')?.value;
    mutate(() => {
      setWinSize(i, {
        width: Number.isFinite(width) ? width : undefined,
        height: Number.isFinite(height) ? height : undefined,
        sill: Number.isFinite(sill) ? sill : undefined,
      });
      persistCustomPlan();
    });
    renderOpenings(); renderSel(); renderPanel();
  };
  ['winEditW','winEditH','winEditSill'].forEach(id => {
    const el = $('#' + id); if (!el) return;
    el.onchange = apply;
    el.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); apply(); } };
  });
  const fl = $('#winFloorEdit');
  if (fl) fl.onclick = () => {
    mutate(() => { setWinSize(i, {sill:0, height:2400}); persistCustomPlan(); });
    renderOpenings(); renderSel(); renderPanel();
  };
  const del = $('#winDel');
  if (del) del.onclick = () => {
    mutate(() => { WINS.splice(i, 1); persistCustomPlan(); });
    select(null); renderOpenings();
  };
  const back = $('#winBack');
  if (back) back.onclick = () => select(null);
}

function overviewPanel(){
  if (!ROOMS.length){
    return `<section><h3>${tr('房间面积','Room Areas')}</h3>
      <p class="muted">${tr('描墙模式下暂不显示房间。画好闭合墙体后，点击顶栏「识别房间」。', 'Rooms are hidden while tracing. After closing walls, click Detect rooms in the toolbar.')}</p>
      <div class="actions"><button class="btn primary" id="detectRoomsPanel">${tr('识别房间','Detect rooms')}</button></div>
    </section>
    <section><h3>${tr('方案统计','Plan Stats')}</h3>
      <div class="stats"><div><small>${tr('墙段','Walls')}</small><span class="big">${WALLS.length}</span></div>
        <div><small>${tr('家具数量','Furniture')}</small><span class="big">${state.furniture.length}</span></div></div>
      <div class="actions"><button class="btn" id="clearMeasure">${tr('清除测量','Clear measures')} (${state.measures.length})</button>
        <button class="btn danger" id="clearFurn">${tr('清空布置','Clear layout')}</button></div></section>`;
  }
  const rows = ROOMS.map(r => {
    const st = state.rooms[r.id] || {name:r.name, mat:r.mat||null};
    const mk = roomMatKey(r);
    const swStyle = mk ? matSwatch(mk) : 'background:#ece8e0';
    return `<tr class="click" data-room="${r.id}"><td><span class="sw" style="${swStyle}"></span>${esc(nm(st.name))}${r.counted===false?' <span class="muted">*</span>':''}</td>
      <td class="r">${fmt(area(r.poly))} m²</td></tr>`;
  }).join('');
  const tot = ROOMS.filter(r => r.counted !== false).reduce((a,r) => a + area(r.poly), 0);
  const byMat = {};
  let unsetA = 0;
  ROOMS.forEach(r => {
    const m = roomMatKey(r);
    const a = area(r.poly);
    if (m) byMat[m] = (byMat[m]||0) + a;
    else unsetA += a;
  });
  let cost = 0;
  const matRows = Object.entries(byMat).map(([m,a]) => { const c = a*MATS[m].price*1.05; cost += c;
    return `<tr><td><span class="sw" style="${matSwatch(m)}"></span>${nm(MATS[m].name)}</td><td class="r">${fmt(a,1)} m²</td><td class="r">¥${Math.round(c).toLocaleString()}</td></tr>`; }).join('')
    + (unsetA > 0 ? `<tr><td><span class="sw" style="background:#ece8e0"></span>${tr('未选择','Not selected')}</td><td class="r">${fmt(unsetA,1)} m²</td><td class="r muted">—</td></tr>` : '');
  const dem = state.demolished.map(id => WALLS[+id.slice(1)]);
  const demLen = dem.reduce((a,w) => a + Math.max(w[2]-w[0], w[3]-w[1]), 0) / 1000;
  return `
  <section><h3>${tr('房间面积','Room Areas')} <small>${tr('点击查看 / 更换地面','Click to view / change flooring')}</small></h3>
    <table>${rows}</table>
    <div class="total"><span>${tr('套内使用面积','Net floor area')}</span><b>${fmt(tot)} m²</b></div>
    <div class="muted" style="font-size:11px;margin-top:4px">${tr('* 飘窗不计入使用面积；面积按墙体内净尺寸计算','* Bay windows are excluded; areas use net inner wall dimensions')}</div></section>
  <section><h3>${tr('地面材料估算','Flooring Estimate')} <small>${tr('含 5% 损耗','incl. 5% waste')}</small></h3>
    <table>${matRows}</table>
    <div class="total"><span>${tr('地面材料合计','Flooring total')}</span><b>¥${Math.round(cost).toLocaleString()}</b></div></section>
  <section><h3>${tr('方案统计','Plan Stats')}</h3>
    <div class="stats"><div><small>${tr('家具数量','Furniture')}</small><span class="big">${state.furniture.length}</span></div>
      <div><small>${tr('拆除墙体','Walls removed')}</small><span class="big">${fmt(demLen,1)}</span> m</div></div>
    <div class="actions"><button class="btn" id="clearMeasure">${tr('清除测量','Clear measures')} (${state.measures.length})</button>
      <button class="btn danger" id="clearFurn">${tr('清空布置','Clear layout')}</button></div></section>
  ${COARSE ? tr(`<section><h3>触屏操作</h3><div class="kbd">
    <kbd>单指拖动</kbd><span>空白处平移画面</span><kbd>双指</kbd><span>捏合缩放、拖动平移</span>
    <kbd>家具库</kbd><span>点一下放到画面中央，或按住向右拖到指定位置</span>
    <kbd>点家具</kbd><span>选中后拖动移动；拖顶部圆点旋转、右下方块改尺寸</span>
    <kbd>工具条</kbd><span>选中后底部可旋转 / 复制 / 删除</span>
    <kbd>测量</kbd><span>按住拖出一条线，或依次点两点</span>
    <kbd>3D 漫游</kbd><span>左下摇杆移动，拖动屏幕转向，点门开关</span>
  </div></section>`, `<section><h3>Touch Controls</h3><div class="kbd">
    <kbd>1-finger drag</kbd><span>Pan on empty space</span><kbd>2 fingers</kbd><span>Pinch to zoom, drag to pan</span>
    <kbd>Library</kbd><span>Tap to place at center, or hold and drag right to a spot</span>
    <kbd>Tap item</kbd><span>Drag to move; top dot rotates, bottom-right square resizes</span>
    <kbd>Toolbar</kbd><span>Bottom bar can rotate / duplicate / delete</span>
    <kbd>Measure</kbd><span>Hold and drag a line, or tap two points</span>
    <kbd>3D walk</kbd><span>Joystick moves, drag to look, tap doors to open</span>
  </div></section>`) : ''}
  ${tr(`<section><h3>键盘快捷键</h3><div class="kbd">
    <kbd>拖拽</kbd><span>左侧家具拖入平面图</span><kbd>V</kbd><span>选择 / 移动</span><kbd>M</kbd><span>测量（Shift 水平/垂直）</span><kbd>C</kbd><span>校准底图</span>
    <kbd>W</kbd><span>画墙</span><kbd>E</kbd><span>删墙</span><kbd>X</kbd><span>拆改非承重墙</span><kbd>R</kbd><span>旋转 90°</span>
    <kbd>⌘/Ctrl D</kbd><span>复制</span><kbd>Delete</kbd><span>删除</kbd><kbd>⌘/Ctrl Z</kbd><span>撤销</span><kbd>T</kbd><span>切换 2D / 3D</span><kbd>F</kbd><span>适应窗口</span><kbd>Esc</kbd><span>取消</span>
  </div></section>`, `<section><h3>Keyboard Shortcuts</h3><div class="kbd">
    <kbd>Drag</kbd><span>Drag furniture onto the plan</span><kbd>V</kbd><span>Select / move</span><kbd>M</kbd><span>Measure (Shift: horizontal/vertical)</span><kbd>C</kbd><span>Calibrate underlay</span>
    <kbd>W</kbd><span>Draw wall</span><kbd>E</kbd><span>Erase wall</span><kbd>X</kbd><span>Demolish</span><kbd>R</kbd><span>Rotate 90°</span>
    <kbd>⌘/Ctrl D</kbd><span>Duplicate</span><kbd>Delete</kbd><span>Delete</kbd><kbd>⌘/Ctrl Z</kbd><span>Undo</span><kbd>T</kbd><span>Toggle 2D / 3D</span><kbd>F</kbd><span>Fit</span><kbd>Esc</kbd><span>Cancel</span>
  </div></section>`)}`;
}
function bindOverview(){
  document.querySelectorAll('#panel tr[data-room]').forEach(tr => tr.onclick = () => { select({kind:'room', id:tr.dataset.room}); if (is3D()) window.View3D.flyToRoom(tr.dataset.room); });
  const dr = $('#detectRoomsPanel'); if (dr) dr.onclick = () => applyDetectedRooms();
  const cm = $('#clearMeasure'); if (cm) cm.onclick = () => state.measures.length && mutate(() => state.measures = []);
  const cf = $('#clearFurn'); if (cf) cf.onclick = clearLayout;
}

// 底部浮动工具条：触屏没有键盘，旋转 / 复制 / 删除都放在这里
function renderFab(){
  const fab = $('#fab'), f = ui.sel?.kind === 'furn' && getF(ui.sel.id), r = ui.sel?.kind === 'room' && ROOMS.find(r => r.id === ui.sel.id);
  const ww = ui.sel?.kind === 'wall' && getWall(ui.sel.id);
  const win = ui.sel?.kind === 'win' && WINS[ui.sel.id];
  const door = ui.sel?.kind === 'door' && DOORS[ui.sel.id];
  const slide = ui.sel?.kind === 'slide' && SLIDES[ui.sel.id];
  if (!f && !r && !ww && !win && !door && !slide){ fab.classList.remove('show'); return; }
  if (f){
    fab.innerHTML = `<span class="name">${esc(nm(f.name))}</span><button class="btn" data-a="rotL">↺</button><button class="btn" data-a="rotR">↻ ${tr('旋转','Rotate')}</button>
       <button class="btn" data-a="dup">${tr('复制','Duplicate')}</button><button class="btn danger" data-a="del">${tr('删除','Delete')}</button><span class="sep"></span>
       <button class="btn narrow-only" data-a="prop">${tr('属性','Properties')}</button><button class="btn" data-a="done">${tr('完成','Done')}</button>`;
  } else if (ww){
    const dem = state.demolished.includes(ww.id);
    fab.innerHTML = `<span class="name">${Math.round(wallLenOf(ww.w))} mm${(ww.w[4]||'n')==='low' ? ' · H ' + wallHeightMm(ww.w) : (ww.w[4]||'n')==='beam' ? ' · ↓ ' + beamDropMm(ww.w) : ''}</span>
      <button class="btn" data-a="dem">${dem ? tr('恢复','Restore') : tr('拆除','Demolish')}</button>
      <button class="btn danger" data-a="del">${tr('删除','Delete')}</button><span class="sep"></span>
      <button class="btn narrow-only" data-a="prop">${tr('属性','Properties')}</button><button class="btn" data-a="done">${tr('完成','Done')}</button>`;
  } else if (win){
    fab.innerHTML = `<span class="name">${Math.round(winWidthOf(win))} mm</span>
      <button class="btn danger" data-a="del">${tr('删除','Delete')}</button><span class="sep"></span>
      <button class="btn narrow-only" data-a="prop">${tr('属性','Properties')}</button><button class="btn" data-a="done">${tr('完成','Done')}</button>`;
  } else if (door){
    fab.innerHTML = `<span class="name">${esc(nm(door.name || tr('门','Door')))} · ${Math.round(door.len)}×${doorHeightMm(door)}</span>
      <button class="btn danger" data-a="del">${tr('删除','Delete')}</button><span class="sep"></span>
      <button class="btn narrow-only" data-a="prop">${tr('属性','Properties')}</button><button class="btn" data-a="done">${tr('完成','Done')}</button>`;
  } else if (slide){
    const [x0,y0,x1,y1] = slide.rect;
    fab.innerHTML = `<span class="name">${tr('推拉门','Slider')} · ${slideLeaves(slide)}${tr('扇',' panels')} · ${Math.round(Math.max(x1-x0,y1-y0))}×${slideHeightMm(slide)}</span>
      <button class="btn danger" data-a="del">${tr('删除','Delete')}</button><span class="sep"></span>
      <button class="btn narrow-only" data-a="prop">${tr('属性','Properties')}</button><button class="btn" data-a="done">${tr('完成','Done')}</button>`;
  } else {
    fab.innerHTML = `<span class="name">${esc(nm(state.rooms[r.id].name))}</span><button class="btn narrow-only" data-a="prop">${tr('地面 / 属性','Floor / Properties')}</button><button class="btn" data-a="done">${tr('完成','Done')}</button>`;
  }
  fab.classList.add('show');
  fab.querySelectorAll('[data-a]').forEach(b => b.onclick = () => ({
    rotL:() => rotateSel(-90), rotR:() => rotateSel(90), dup:duplicateSel, del:deleteSel,
    dem:() => { if (ui.sel?.kind === 'wall'){ toggleWall(ui.sel.id); renderSel(); renderFab(); renderPanel(); } },
    prop:() => drawer('panel', true), done:() => { select(null); closeDrawers(); },
  })[b.dataset.a]());
}

function clearLayout(){
  const n = state.furniture.length;
  if (!n) return toast(tr('当前没有布置任何家具', 'There is no furniture to clear'));
  if (!confirm(tr(`确定清空全部 ${n} 件家具 / 家电吗？\n墙体、地面材料和测量线会保留，可点「撤销」恢复。`, `Remove all ${n} furniture / appliance items?\nWalls, flooring and measurements are kept. You can Undo this.`))) return;
  ui.sel = null; mutate(() => state.furniture = []);
  toast(tr('已清空布置，可点「撤销」恢复', 'Layout cleared — Undo to restore'));
}

/* 侧栏开合：which = 'lib' | 'panel' | null，open 不传则切换。
 * 宽屏：侧栏在布局中收起 / 展开（记住选择）；窄屏：侧栏是浮层抽屉，一次只开一个，which = null 表示全部关闭 */
const PANES = 'huxing-panes';
const panes = (() => { try { return JSON.parse(localStorage.getItem(PANES)) || {}; } catch(e) { return {}; } })();
function drawer(which, open){
  const app = $('.app'), els = {lib:$('aside.lib'), panel:$('aside.right')}, n = narrow();
  if (n){
    Object.entries(els).forEach(([k, el]) => el.classList.toggle('open', k === which && (open ?? !el.classList.contains('open'))));
  } else {
    Object.values(els).forEach(el => el.classList.remove('open'));
    if (which){
      const k = which === 'lib' ? 'hideLib' : 'hidePanel';
      panes[k] = open === undefined ? !panes[k] : !open;
      try { localStorage.setItem(PANES, JSON.stringify(panes)); } catch(e) {}
    }
  }
  app.classList.toggle('hide-lib', !!panes.hideLib); app.classList.toggle('hide-panel', !!panes.hidePanel);
  syncPaneBtns();
}
function syncPaneBtns(){
  const els = {lib:$('aside.lib'), panel:$('aside.right')}, n = narrow();
  const vis = k => n ? els[k].classList.contains('open') : !panes[k === 'lib' ? 'hideLib' : 'hidePanel'];
  $('#tgLib').classList.toggle('on', vis('lib')); $('#tgPanel').classList.toggle('on', vis('panel'));
  $('#tgLib').title = vis('lib') ? tr('收起家具库 ( [ )', 'Hide library ( [ )') : tr('展开家具库 ( [ )', 'Show library ( [ )');
  $('#tgPanel').title = vis('panel') ? tr('收起属性面板 ( ] )', 'Hide properties ( ] )') : tr('展开属性面板 ( ] )', 'Show properties ( ] )');
  $('#stage').classList.toggle('drawer-panel', n && vis('panel'));   // 属性抽屉盖住画面时让出底部工具条
}
function closeDrawers(){ if (narrow()) drawer(null); }

function roomPanel(r){
  const st = state.rooms[r.id], a = area(r.poly), [x0,y0,x1,y1] = bbox(r.poly), inside = state.furniture.filter(f => f.cx>x0&&f.cx<x1&&f.cy>y0&&f.cy<y1);
  const mk = roomMatKey(r);
  const mats = Object.entries(MATS).map(([k,m]) => `<button class="mat ${k===mk?'on':''}" data-mat="${k}"><i style="${matSwatch(k)}"></i><span>${nm(m.name)}<small>¥${m.price}/m²</small></span></button>`).join('');
  const wk = (typeof roomWallKey === 'function' ? roomWallKey(r) : null) || 'plain';
  const wallBtns = Object.entries(WALLPAPERS).map(([k,m]) => `<button class="mat ${k===wk?'on':''}" data-wall="${k}"><i style="${wallSwatch(k)}"></i><span>${nm(m.name)}<small>¥${m.price}/m²</small></span></button>`).join('');
  const wallArea = perim(r.poly) * 2.8;
  const wallCost = `¥${Math.round(wallArea * WALLPAPERS[wk].price).toLocaleString()}`;
  const costLabel = mk
    ? `¥${Math.round(a*MATS[mk].price*1.05).toLocaleString()}`
    : tr('未选择', 'Not selected');
  const mergeHint = ui.awaitMerge === r.id
    ? tr('请再点击另一个要合并的房间…', 'Click another room to merge with…')
    : tr('合并：与相邻房间合成一个；拆除：以门洞为界拆成多个房间。带窗墙不会连通房间。', 'Merge combines adjacent rooms; Split divides by doors. Windowed walls do not connect rooms.');
  return `<section><h3>${tr('房间','Room')}</h3>
    <div class="form"><label class="full">${tr('名称','Name')}<input id="rName" value="${esc(nm(st.name))}"></label></div>
    <div class="stats" style="margin-top:10px">
      <div><small>${tr('使用面积','Floor area')}</small><span class="big">${fmt(a)}</span> m²</div>
      <div><small>${tr('周长','Perimeter')}</small><span class="big">${fmt(perim(r.poly),1)}</span> m</div>
      <div><small>${tr('开间','Width')}</small><span class="big">${x1-x0}</span> mm</div>
      <div><small>${tr('进深','Depth')}</small><span class="big">${y1-y0}</span> mm</div></div>
    <div class="muted">${tr(`墙面面积（层高 2.8m，未扣门窗）约 ${fmt(perim(r.poly)*2.8,1)} m²`, `Wall area (2.8m ceiling, openings not deducted) ≈ ${fmt(perim(r.poly)*2.8,1)} m²`)}</div>
    <div class="actions" style="margin-top:10px">
      <button class="btn primary" id="roomMerge">${ui.awaitMerge === r.id ? tr('取消合并','Cancel merge') : tr('合并房间','Merge rooms')}</button>
      <button class="btn" id="roomSplit">${tr('拆除（按门拆分）','Split by doors')}</button>
    </div>
    <p class="muted" style="margin-top:8px;font-size:12px">${mergeHint}</p>
  </section>
  <section><h3>${tr('地面材料','Flooring')}</h3><div class="mats">${mats}</div>
    <div class="total"><span>${tr('材料估价','Estimated cost')}</span><b>${costLabel}</b></div></section>
  <section><h3>${tr('墙面 / 墙纸','Wall / Wallpaper')} <small>${nm(WALLPAPERS[wk].name)}</small></h3><div class="mats">${wallBtns}</div>
    <div class="total"><span>${tr(`墙面材料估价（约 ${fmt(wallArea,1)} m²）`, `Wall estimate (≈ ${fmt(wallArea,1)} m²)`)}</span><b>${wallCost}</b></div>
    <p class="muted" style="margin-top:6px;font-size:12px">${tr('墙纸只作用于本房间朝向室内的墙面，外墙外侧与其它房间不受影响；3D 视图即时更新。', 'Wallpaper applies only to the interior faces of this room; exterior and other rooms are unaffected. The 3D view updates instantly.')}</p></section>
  <section><h3>${tr('房间内家具','Furniture in room')} <small>${tr(`${inside.length} 件`, `${inside.length} items`)}</small></h3>
    <table>${inside.map(f => `<tr class="click" data-fid="${f.id}"><td>${esc(nm(f.name))}</td><td class="r muted">${f.w}×${f.d}</td></tr>`).join('') || `<tr><td class="muted">${tr('暂无','None')}</td></tr>`}</table>
    <div class="actions"><button class="btn" id="back">${tr('← 返回总览','← Back to overview')}</button></div></section>`;
}
function bindRoomPanel(){
  const id = ui.sel.id;
  const room = ROOMS.find(x => x.id === id);
  $('#rName').onchange = e => mutate(() => {
    const name = e.target.value.trim() || state.rooms[id].name;
    state.rooms[id].name = name;
    if (room) room.name = name;
  });
  document.querySelectorAll('#panel [data-mat]').forEach(b => b.onclick = () => mutate(() => {
    state.rooms[id].mat = b.dataset.mat;
    if (room) room.mat = b.dataset.mat;
  }));
  document.querySelectorAll('#panel [data-wall]').forEach(b => b.onclick = () => mutate(() => {
    state.rooms[id].wallpaper = b.dataset.wall;
  }));
  document.querySelectorAll('#panel tr[data-fid]').forEach(tr => tr.onclick = () => select({kind:'furn', id:tr.dataset.fid}));
  const mg = $('#roomMerge');
  if (mg) mg.onclick = () => {
    if (ui.awaitMerge === id){ ui.awaitMerge = null; renderPanel(); toast(tr('已取消合并', 'Merge cancelled')); return; }
    ui.awaitMerge = id;
    renderPanel();
    toast(tr('请点击要合并的另一房间', 'Click the other room to merge with'));
  };
  const sp = $('#roomSplit');
  if (sp) sp.onclick = () => splitRoomByDoors(id);
  $('#back').onclick = () => { ui.awaitMerge = null; select(null); };
}

function furnPanel(f){
  const isStairs = f.type === 'stairs';
  const isCab = typeof isCabinetType === 'function' && isCabinetType(f.type);
  const st = isStairs ? stairsStyleOf(f) : '';
  const dir = (f.dir === 'down') ? 'down' : 'up';
  const stairsRow = isStairs ? `
    <label class="full">${tr('楼梯样式','Stair style')}<select id="fStyle">
      <option value="straight"${st==='straight'?' selected':''}>${tr('直楼梯','Straight')}</option>
      <option value="l"${st==='l'?' selected':''}>${tr('直角楼梯','L-shaped')}</option>
      <option value="u"${st==='u'?' selected':''}>${tr('回转楼梯','U-shaped')}</option>
      <option value="triple"${st==='triple'?' selected':''}>${tr('三跑楼梯','Three-flight')}</option>
      <option value="spiral"${st==='spiral'?' selected':''}>${tr('旋转楼梯','Spiral')}</option>
    </select></label>
    <label class="full">${tr('上下方向','Direction')}<select id="fDir">
      <option value="up"${dir==='up'?' selected':''}>${tr('上行（由低到高）','Up (low → high)')}</option>
      <option value="down"${dir==='down'?' selected':''}>${tr('下行（由高到低）','Down (high → low)')}</option>
    </select></label>` : '';
  const stairsActions = isStairs
    ? `<button class="btn" id="aFlip">${tr('左右翻转','Flip L/R')}</button>`
    : '';
  const cabH = isCab ? cabinetHMm(f) : 0;
  const isLamp = typeof LAMP_TYPES !== 'undefined' && LAMP_TYPES.has(f.type);
  const lampBright = (f.bright == null ? 100 : f.bright);
  const lampTone = f.tone || 'warm';
  const lampH = (typeof lampHeightOf !== 'undefined') ? lampHeightOf(f) : 1500;
  const lampRow = isLamp ? `
    <label class="full">${tr('安装高度','Mount height')} (mm)<input type="number" id="lampHeightIn" min="0" max="3000" step="10" value="${lampH}"></label>
    <label class="full">${tr('灯光亮度','Brightness')}<input type="range" id="lampBrightIn" min="0" max="200" step="5" value="${lampBright}"></label>
    <label class="full">${tr('灯光色温','Light tone')}<select id="lampToneIn">
      ${LAMP_TONES.map(t => `<option value="${t.key}"${t.key === lampTone ? ' selected' : ''}>${esc(nm(t.name))}</option>`).join('')}
    </select></label>` : '';
  const finId = (f.finish && FURN_FINISHES.some(x => x.id === f.finish)) ? f.finish : '';
  // 布局顺序：宽深 → 高度+旋转 → 中心X+中心Y → 柜体材质 → 颜色（柜类）；
  // 非柜类没有高度/材质，保持 宽深 → 中心XY → 旋转 → 颜色。
  const cxLabel = `<label>${tr('中心','Center')} X (mm)<input type="number" id="fX" value="${Math.round(f.cx)}" step="10"></label>`;
  const cyLabel = `<label>${tr('中心','Center')} Y (mm)<input type="number" id="fY" value="${Math.round(f.cy)}" step="10"></label>`;
  const rotLabel = `<label>${tr('旋转','Rotation')} (°)<input type="number" id="fR" value="${f.rot}" step="15"></label>`;
  const finishRow = isCab ? `
    <label>${tr('高度','Height')} (mm)<input type="number" id="fH" value="${cabH}" min="300" max="2800" step="10"></label>
    ${rotLabel}
    ${cxLabel}
    ${cyLabel}
    <div class="full" style="margin-top:4px">
      <div class="muted" style="font-size:12px;margin-bottom:6px">${tr('柜体材质','Cabinet finish')}</div>
      <div class="mats" id="fFinishMats">${FURN_FINISHES.map(m =>
        `<button type="button" class="mat ${m.id === finId ? 'on' : ''}" data-finish="${m.id}"><i style="background:${m.sw || m.color}"></i><span>${nm(m.name)}<small>${m.wood ? tr('木纹','Wood') : tr('烤漆','Lacquer')}</small></span></button>`
      ).join('')}</div>
    </div>` : '';
  return `<section><h3>${tr('家具属性','Furniture')}</h3>
    <div class="form">
      <label class="full">${tr('名称','Name')}<input id="fName" value="${esc(nm(f.name))}"></label>
      ${stairsRow}
      <label>${tr('宽','Width')} (mm)<input type="number" id="fW" value="${f.w}" min="50" step="10"></label>
      <label>${tr('深','Depth')} (mm)<input type="number" id="fD" value="${f.d}" min="50" step="10"></label>
      ${finishRow}
      ${lampRow}
      ${isCab ? '' : cxLabel + cyLabel + rotLabel}
      <label>${tr('颜色','Color')}<input type="color" id="fC" value="${f.color}"></label>
    </div>
    <div class="muted" style="margin-top:8px">${tr('占地面积','Footprint')} ${fmt(f.w*f.d/1e6)} m²${isCab ? ' · ' + tr('高度','Height') + ' ' + cabH + ' mm' : ''}${isStairs ? ' · ' + tr('层高约 2.8 m','~2.8 m floor-to-floor') + (f.flip ? ' · ' + tr('已翻转','Flipped') : '') : ''}</div>
    <div class="actions">
      <button class="btn" id="aRot">${tr('旋转 90°','Rotate 90°')}</button>${stairsActions}<button class="btn" id="aDup">${tr('复制','Duplicate')}</button>
      <button class="btn" id="aTop">${tr('置于顶层','Bring to front')}</button><button class="btn" id="aBot">${tr('置于底层','Send to back')}</button>
      <button class="btn danger" id="aDel">${tr('删除','Delete')}</button><button class="btn" id="back">${tr('← 返回','← Back')}</button>
    </div></section>
  <section class="muted" style="font-size:12px">${isCab
    ? tr('柜子可调高度与柜体材质；也可直接改颜色。拖动移动，右下角调宽深。', 'Cabinets support height and finish presets; color can still be customized. Drag to move; corner to resize.')
    : tr('拖动家具移动；拖动上方圆点旋转；拖动右下角方块调整尺寸。开启「贴墙吸附」后靠近墙面会自动贴齐。楼梯可设上行/下行，并左右翻转镜像。', 'Drag to move; drag the top dot to rotate; drag the bottom-right square to resize. Stairs support up/down direction and left-right flip.')}</section>`;
}
function bindFurnPanel(f){
  const upd = (fn) => mutate(() => { const g = getF(f.id); if (g) fn(g); });
  const num = (id, fn) => { const el = $(id); if (el) el.onchange = e => { const v = parseFloat(e.target.value); if (!isNaN(v)) upd(g => fn(g, v)); }; };
  $('#fName').onchange = e => upd(g => g.name = e.target.value.trim() || g.name);
  num('#fW', (g,v) => g.w = Math.max(50, Math.round(v)));
  num('#fD', (g,v) => g.d = Math.max(50, Math.round(v)));
  num('#fH', (g,v) => { g.h = Math.max(300, Math.min(2800, Math.round(v / 10) * 10)); });
  num('#fX', (g,v) => g.cx = v); num('#fY', (g,v) => g.cy = v); num('#fR', (g,v) => g.rot = norm(v));
  $('#fC').onchange = e => upd(g => { g.color = e.target.value; g.finish = null; });
  document.querySelectorAll('#fFinishMats [data-finish]').forEach(b => b.onclick = () => {
    const fin = FURN_FINISHES.find(x => x.id === b.dataset.finish);
    if (!fin) return;
    upd(g => { g.finish = fin.id; g.color = fin.color; });
  });
  if ($('#fStyle')) $('#fStyle').onchange = e => upd(g => { g.style = e.target.value; });
  if ($('#fDir')) $('#fDir').onchange = e => upd(g => { g.dir = e.target.value === 'down' ? 'down' : 'up'; });
  // 灯具高度 / 亮度 / 色温：输入中实时预览（不进 undo、不重建面板），改动提交一次
  const lampApply = () => { if (window.View3D && window.View3D.applyLamp) window.View3D.applyLamp(f.id); };
  if ($('#lampHeightIn')){
    const hl = $('#lampHeightIn');
    hl.oninput = e => { const g = getF(f.id); if (g){ g.height = +e.target.value; lampApply(); } };
    hl.onchange = e => { const v = +e.target.value; if (isFinite(v)) upd(g => { g.height = Math.max(0, Math.min(3000, Math.round(v / 10) * 10)); }); };
  }
  if ($('#lampBrightIn')){
    const bl = $('#lampBrightIn');
    bl.oninput = e => { const g = getF(f.id); if (g){ g.bright = +e.target.value; lampApply(); } };
    bl.onchange = e => upd(g => { g.bright = Math.max(0, Math.min(200, +e.target.value)); });
  }
  if ($('#lampToneIn')) $('#lampToneIn').onchange = e => { upd(g => { g.tone = e.target.value; }); lampApply(); };
  if ($('#aFlip')) $('#aFlip').onclick = () => upd(g => { g.flip = !g.flip; });
  $('#aRot').onclick = () => rotateSel(90);
  $('#aDup').onclick = duplicateSel;
  $('#aDel').onclick = deleteSel;
  $('#aTop').onclick = () => mutate(() => { const i = state.furniture.findIndex(g => g.id===f.id); state.furniture.push(...state.furniture.splice(i,1)); });
  $('#aBot').onclick = () => mutate(() => { const i = state.furniture.findIndex(g => g.id===f.id); state.furniture.unshift(...state.furniture.splice(i,1)); });
  $('#back').onclick = () => select(null);
}
