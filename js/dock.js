// Dock customization — replaces hardcoded PDOCK with localStorage-backed config
var _pdock = null;

function pdockInit() {
  if (_pdock) return;
  try {
    var saved = JSON.parse(localStorage.getItem('pent_dock') || 'null');
    if (saved && Array.isArray(saved) && saved.length >= 1 && saved.length <= 8) {
      _pdock = saved;
    }
  } catch(e) {}
  if (!_pdock) _pdock = ['phone','paMessages','paPhotos','paSettings'];
  // Sync legacy PDOCK global
  PDOCK = _pdock;
}

function pdockGet() {
  if (!_pdock) pdockInit();
  return _pdock;
}

function pdockSet(apps) {
  _pdock = apps;
  PDOCK = apps;
  try { localStorage.setItem('pent_dock', JSON.stringify(apps)); } catch(e) {}
}

function pdockReplace(oldId, newId) {
  var d = pdockGet().slice();
  var idx = d.indexOf(oldId);
  if (idx >= 0) { d[idx] = newId; pdockSet(d); return true; }
  return false;
}

function pdockReset() {
  pdockSet(['phone','paMessages','paPhotos','paSettings']);
}

function pdockSwapMenu(dockId) {
  window._pfJustMenu = true;
  setTimeout(function() { window._pfJustMenu = false; }, 600);
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center';
  ov.onclick = function(e) { if (e.target === ov) ov.remove(); };
  var s = document.createElement('div');
  s.style.cssText = 'background:#1c1c1e;border-radius:20px 20px 0 0;padding:8px 20px max(20px,env(safe-area-inset-bottom));width:100%;max-width:430px;max-height:70vh;overflow-y:auto';
  s.innerHTML = '<div style="width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.3);margin:8px auto 16px"></div><div style="color:#fff;font-size:16px;font-weight:600;text-align:center;margin-bottom:8px">替换 Dock 图标</div><div style="color:#888;font-size:12px;text-align:center;margin-bottom:12px">选择一个 App 替换</div>';
  var prot = ['phone','paStore','paSettings'];
  var removed = [];
  try { removed = JSON.parse(localStorage.getItem('pent_removed') || '[]'); } catch(e) {}
  var currentDock = pdockGet();
  for (var i = 0; i < PAPPS.length; i++) {
    var app = PAPPS[i];
    if (removed.indexOf(app.id) >= 0) continue;
    if (currentDock.indexOf(app.id) >= 0 && app.id !== dockId) continue;
    (function(a) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;padding:12px;gap:12px;color:#fff;font-size:15px;cursor:pointer;border-radius:12px';
      row.innerHTML = '<span style="font-size:24px">' + a.icon + '</span><span style="flex:1">' + a.label + '</span>';
      if (prot.indexOf(a.id) >= 0) row.innerHTML += '<span style="font-size:10px;color:#888">系统</span>';
      row.onclick = function() {
        pdockReplace(dockId, a.id);
        prenderDT();
        pnotify({ title: '🔧 Dock 已更新', text: a.label, icon: a.icon });
        ov.remove();
      };
      s.appendChild(row);
    })(app);
  }
  var cancel = document.createElement('div');
  cancel.textContent = '取消';
  cancel.style.cssText = 'text-align:center;padding:14px;color:#888;font-size:15px;cursor:pointer;border-radius:12px;margin-top:4px;background:rgba(255,255,255,.05)';
  cancel.onclick = function() { ov.remove(); };
  s.appendChild(cancel);
  ov.appendChild(s);
  document.body.appendChild(ov);
}

var _pDockTimer = null;
function pdockLongPress(e, dockId) {
  e.stopPropagation();
  clearTimeout(_pDockTimer);
  _pDockTimer = setTimeout(function() { pdockSwapMenu(dockId); }, 500);
}
function pdockLongCancel() {
  clearTimeout(_pDockTimer);
}
document.addEventListener('touchend', pdockLongCancel, { passive: true });
document.addEventListener('touchmove', pdockLongCancel, { passive: true });
document.addEventListener('mouseup', pdockLongCancel);
