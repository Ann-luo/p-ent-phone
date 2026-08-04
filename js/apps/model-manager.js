// AI Model Manager — rendered inline in Settings page
function prModelManager() {
  var el = document.getElementById('paSettingsB');
  var provider = pgetActive();
  var h = '';
  // Header
  h += '<div style="display:flex;align-items:center;padding:0 0 12px;gap:8px"><span onclick="prSettings()" style="cursor:pointer;font-size:22px">‹</span><span style="font-size:18px;font-weight:600;color:#fff">🤖 AI 模型管理</span></div>';

  // Provider selector
  h += '<div style="margin-bottom:12px"><div style="font-size:13px;color:#aaa;margin-bottom:4px">当前供应商</div><select id="pmSelect" onchange="pmSwitch()" style="width:100%;padding:10px;border-radius:10px;border:none;background:rgba(255,255,255,.08);color:#fff;font-size:15px">';
  for (var i = 0; i < providerConfigs.length; i++) {
    var p = providerConfigs[i];
    h += '<option value="' + p.id + '"' + (p.id === activeProviderId ? ' selected' : '') + '>' + p.name + (p.apiKey ? ' ✅' : '') + '</option>';
  }
  h += '</select></div>';

  // API Key
  h += '<div style="margin-bottom:12px"><div style="font-size:13px;color:#aaa;margin-bottom:4px">🔑 API Key</div>';
  h += '<input id="pmKey" type="password" value="' + (provider ? provider.apiKey : '') + '" placeholder="输入 Key..." style="width:100%;padding:10px;border-radius:10px;border:none;background:rgba(255,255,255,.08);color:#fff;font-size:14px;box-sizing:border-box"></div>';

  // Base URL
  h += '<div style="margin-bottom:12px"><div style="font-size:13px;color:#aaa;margin-bottom:4px">🌐 Base URL</div>';
  h += '<input id="pmUrl" value="' + (provider ? provider.baseUrl : '') + '" placeholder="https://..." style="width:100%;padding:10px;border-radius:10px;border:none;background:rgba(255,255,255,.08);color:#fff;font-size:14px;box-sizing:border-box"></div>';

  // Model selector
  h += '<div style="margin-bottom:12px"><div style="font-size:13px;color:#aaa;margin-bottom:4px">📦 模型</div><select id="pmModel" onchange="pmSetModel(this.value)" style="width:100%;padding:10px;border-radius:10px;border:none;background:rgba(255,255,255,.08);color:#fff;font-size:15px">';
  if (provider) {
    var models = [];
    var def = PROVIDERS[provider.id];
    if (def) models = def.models.slice();
    if (provider.customModels) models = models.concat(provider.customModels);
    for (var j = 0; j < models.length; j++) {
      h += '<option value="' + models[j] + '"' + (models[j] === activeModelId ? ' selected' : '') + '>' + models[j] + '</option>';
    }
  }
  h += '</select></div>';

  // Add custom model
  h += '<div style="display:flex;gap:8px;margin-bottom:12px"><input id="pmCustom" placeholder="手动添加模型名..." style="flex:1;padding:8px;border-radius:8px;border:none;background:rgba(255,255,255,.08);color:#fff;font-size:13px"><button onclick="pmAddCustom()" style="padding:8px 16px;border-radius:8px;border:none;background:#007aff;color:#fff;font-size:13px;cursor:pointer">添加</button></div>';

  // Fetch models
  if (def && def.fetchModels) {
    h += '<button onclick="pmFetchModels()" id="pmFetchBtn" style="width:100%;padding:10px;border-radius:10px;border:none;background:rgba(255,255,255,.1);color:#007aff;font-size:14px;cursor:pointer;margin-bottom:4px">🔄 自动获取模型列表</button>';
    h += '<div id="pmFetchStatus" style="font-size:11px;color:#888;text-align:center;margin-bottom:12px"></div>';
  }

  // Test connection
  h += '<button onclick="pmTestKey()" id="pmTestBtn" style="width:100%;padding:10px;border-radius:10px;border:none;background:rgba(255,255,255,.1);color:#34c759;font-size:14px;cursor:pointer;margin-bottom:12px">🔌 测试连接</button>';

  // Add provider
  h += '<div style="display:flex;gap:8px;margin-bottom:16px"><select id="pmAddType" style="flex:1;padding:8px;border-radius:8px;border:none;background:rgba(255,255,255,.08);color:#fff;font-size:13px">';
  var keys = Object.keys(PROVIDERS);
  for (var k = 0; k < keys.length; k++) {
    h += '<option value="' + keys[k] + '">' + PROVIDERS[keys[k]].name + '</option>';
  }
  h += '</select><button onclick="pmAddProvider()" style="padding:8px 16px;border-radius:8px;border:none;background:#34c759;color:#fff;font-size:13px;cursor:pointer;white-space:nowrap">+ 添加</button></div>';

  // Save
  h += '<button onclick="pmSave()" style="width:100%;padding:12px;border-radius:12px;border:none;background:#007aff;color:#fff;font-size:16px;cursor:pointer;font-weight:600;margin-bottom:8px">💾 保存设置</button>';

  el.innerHTML = h;
  el.style.overflow = 'hidden';
}

function pmSwitch() {
  var sel = document.getElementById('pmSelect');
  if (!sel) return;
  pswitchProvider(sel.value);
  prModelManager();
}

function pmSetModel(modelId) {
  activeModelId = modelId;
}

function pmAddCustom() {
  var inp = document.getElementById('pmCustom');
  if (!inp || !inp.value.trim()) return;
  var provider = pgetActive();
  if (!provider) return;
  if (!provider.customModels) provider.customModels = [];
  provider.customModels.push(inp.value.trim());
  inp.value = '';
  prModelManager();
}

async function pmFetchModels() {
  var btn = document.getElementById('pmFetchBtn');
  var status = document.getElementById('pmFetchStatus');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 获取中...'; }
  if (status) status.textContent = '';
  var r = await pfetchModels(activeProviderId);
  if (btn) { btn.disabled = false; btn.textContent = '🔄 自动获取模型列表'; }
  if (status) status.textContent = r.ok ? '✅ 获取成功 (' + r.models.length + ' 个模型)' : '❌ ' + (r.error || '获取失败');
  if (r.ok && r.models.length > 0) {
    var provider = pgetActive();
    if (provider) {
      // Merge fetched models
      var def = PROVIDERS[provider.id];
      var existing = def ? def.models.slice() : [];
      for (var i = 0; i < r.models.length; i++) {
        if (existing.indexOf(r.models[i].id) < 0 && (!provider.customModels || provider.customModels.indexOf(r.models[i].id) < 0)) {
          if (!provider.customModels) provider.customModels = [];
          provider.customModels.push(r.models[i].id);
        }
      }
      prModelManager();
    }
  }
}

async function pmTestKey() {
  var btn = document.getElementById('pmTestBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 测试中...'; }
  var r = await ptestKey(activeProviderId);
  if (btn) { btn.disabled = false; btn.textContent = '🔌 测试连接'; }
  pnotify({ title: r.ok ? '✅ 连接成功' : '❌ 连接失败', text: r.ok ? '' : (r.error || 'HTTP ' + r.status), icon: r.ok ? '✅' : '⚠️' });
}

function pmAddProvider() {
  var sel = document.getElementById('pmAddType');
  if (!sel) return;
  var typeId = sel.value;
  var def = PROVIDERS[typeId];
  if (!def) return;
  providerConfigs.push({
    id: typeId, name: def.name, apiKey: '', baseUrl: def.base, model: def.models[0], customModels: []
  });
  activeProviderId = typeId;
  activeModelId = def.models[0];
  psyncGlobals();
  prModelManager();
}

function pmSave() {
  var provider = pgetActive();
  if (!provider) return;
  var keyEl = document.getElementById('pmKey');
  var urlEl = document.getElementById('pmUrl');
  var modelEl = document.getElementById('pmModel');
  if (keyEl) provider.apiKey = keyEl.value.trim();
  if (urlEl) provider.baseUrl = urlEl.value.trim();
  if (modelEl) { provider.model = modelEl.value; activeModelId = modelEl.value; }
  psave();
  pnotify({ title: '💾 已保存', icon: '✅' });
  prSettings();
}
