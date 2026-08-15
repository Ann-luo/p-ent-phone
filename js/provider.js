// ===== Provider Registry — 12 AI 供应商 =====
// 除 Claude 外全部 OpenAI 兼容格式
// Claude 使用 Messages API（/v1/messages + x-api-key + content blocks）

var PROVIDERS = {
  deepseek:  { name:'DeepSeek',     base:'https://api.deepseek.com/v1',                            models:['deepseek-v4-flash','deepseek-v4-pro'],                         fetchModels:false, region:'cn' },
  qwen:      { name:'通义千问',     base:'https://dashscope.aliyuncs.com/compatible-mode/v1',       models:['qwen3.7-max','qwen3.7-plus','qwen3.7-flash'],                  fetchModels:false, region:'cn' },
  wenxin:    { name:'百度文心',     base:'https://qianfan.baidubce.com/v2',                         models:['ernie-4.5-turbo-128k','ernie-5.0'],                             fetchModels:false, region:'cn' },
  doubao:    { name:'字节豆包',     base:'https://ark.cn-beijing.volces.com/api/v3',                models:['doubao-pro-32k','doubao-lite-32k'],                            fetchModels:false, region:'cn' },
  kimi:      { name:'月之暗面 Kimi',base:'https://api.moonshot.cn/v1',                              models:['moonshot-v1-8k','moonshot-v1-32k','moonshot-v1-128k'],         fetchModels:true,  region:'cn' },
  glm:       { name:'智谱 GLM',     base:'https://open.bigmodel.cn/api/paas/v4',                    models:['glm-4-flash','glm-4-plus','glm-4-long'],                       fetchModels:false, region:'cn' },
  xunfei:    { name:'讯飞星火',     base:'https://spark-api-open.xf-yun.com/v1',                    models:['spark-lite','spark-pro','spark-max'],                          fetchModels:false, region:'cn' },
  minimax:   { name:'MiniMax',      base:'https://api.minimax.io/v1',                               models:['MiniMax-M3','MiniMax-M2.5'],                                   fetchModels:false, region:'cn' },
  openai:    { name:'GPT',          base:'https://api.openai.com/v1',                               models:['gpt-5','gpt-5-nano','gpt-4.1'],                                fetchModels:true,  region:'intl' },
  claude:    { name:'Claude',       base:'https://api.anthropic.com/v1',                            models:['claude-sonnet-5','claude-opus-5','claude-haiku-4-5'],          fetchModels:false, region:'intl' },
  gemini:    { name:'Google Gemini',base:'https://generativelanguage.googleapis.com/v1beta/openai',  models:['gemini-2.5-flash','gemini-2.5-pro'],                           fetchModels:false, region:'intl' },
  mistral:   { name:'Mistral',      base:'https://api.mistral.ai/v1',                               models:['mistral-medium-3.5','mistral-small-4'],                        fetchModels:true,  region:'intl' }
};

var providerConfigs = [];       // [{id, name, apiKey, baseUrl, model, customModels:[]}]
var activeProviderId = 'deepseek';
var activeModelId = 'deepseek-v4-flash';

// Legacy globals synced after load/save
function psyncGlobals() {
  var p = pgetActive();
  if (p) {
    apiKey = p.apiKey || '';
    if (p.model) activeModelId = p.model;
    modelName = activeModelId;
  }
}

function pgetActive() {
  return providerConfigs.find(function(x) { return x.id === activeProviderId; }) || providerConfigs[0] || null;
}

function pgetById(id) {
  return providerConfigs.find(function(x) { return x.id === id; });
}

// Init: load from IndexedDB, migrate old format
async function pinit() {
  try {
    var gs = await idbGet('global_settings');
    if (gs && gs.providerConfigs && gs.providerConfigs.length > 0) {
      providerConfigs = gs.providerConfigs;
      activeProviderId = gs.activeProviderId || 'deepseek';
      activeModelId = gs.activeModelId || providerConfigs[0].model || 'deepseek-chat';
    } else {
      // Migrate legacy flat settings
      var legacyKey = gs ? gs.apiKey : '';
      var legacyModel = gs ? gs.modelName : 'deepseek-chat';
      providerConfigs = Object.keys(PROVIDERS).map(function(id) {
        var def = PROVIDERS[id];
        return {
          id: id, name: def.name, apiKey: (id === 'deepseek' ? legacyKey : ''),
          baseUrl: def.base, model: def.models[0], customModels: []
        };
      });
      activeProviderId = 'deepseek';
      activeModelId = legacyModel || 'deepseek-chat';
      await psave();
    }
  } catch(e) {
    // Fallback: deepseek only
    providerConfigs = [{ id:'deepseek', name:'DeepSeek', apiKey:'', baseUrl:PROVIDERS.deepseek.base, model:'deepseek-chat', customModels:[] }];
  }
  psyncGlobals();
}

async function psave() {
  var toSave = {
    apiKey: (pgetActive()||{}).apiKey || '',
    modelName: activeModelId,
    temperature: temperature,
    topP: topP,
    providerConfigs: providerConfigs,
    activeProviderId: activeProviderId,
    activeModelId: activeModelId
  };
  try { await idbPut('global_settings', toSave); } catch(e) {}
  psyncGlobals();
}

function pswitchProvider(id) {
  if (pgetById(id)) {
    activeProviderId = id;
    var p = pgetActive();
    if (p) activeModelId = p.model;
    psyncGlobals();
    psave();
  }
}

function psetModel(modelId) {
  activeModelId = modelId;
  var p = pgetActive();
  if (p) { p.model = modelId; }
  modelName = modelId;
  psave();
}

// ===== Core: Unified chat completion =====
function pchatCompletion(messages, opts, callbacks) {
  // callbacks: { onChunk, onDone, onError }
  // opts: { stream, signal, model, temperature, topP, maxTokens }
  opts = opts || {};
  callbacks = callbacks || {};
  var provider = pgetActive();
  if (!provider || !provider.apiKey) {
    if (callbacks.onError) callbacks.onError(new Error('未设置 API Key'));
    return Promise.resolve(null);
  }

  var isClaude = provider.id === 'claude';
  var isStream = opts.stream !== false;
  var endpoint = isClaude
    ? provider.baseUrl + '/messages'
    : provider.baseUrl + '/chat/completions';

  // Build request
  var reqHeaders, reqBody;
  var model = opts.model || activeModelId;
  var temp = opts.temperature !== undefined ? opts.temperature : temperature;
  var top_p = opts.topP !== undefined ? opts.topP : topP;
  var maxTokens = opts.maxTokens || (isStream ? 400 : 1200);

  if (isClaude) {
    // Claude Messages API format
    var sysMsg = '';
    var chatMsgs = [];
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].role === 'system') {
        sysMsg += (sysMsg ? '\n' : '') + messages[i].content;
      } else {
        chatMsgs.push({ role: messages[i].role, content: messages[i].content });
      }
    }
    var claudeBody = { model: model, max_tokens: maxTokens, temperature: temp, messages: chatMsgs, stream: isStream };
    if (sysMsg) claudeBody.system = sysMsg;
    reqHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01'
    };
    reqBody = JSON.stringify(claudeBody);
  } else {
    // OpenAI-compatible format (11 providers)
    reqHeaders = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + provider.apiKey
    };
    reqBody = JSON.stringify({
      model: model,
      messages: messages,
      temperature: temp,
      top_p: isStream ? top_p : undefined,
      max_tokens: maxTokens,
      stream: isStream
    });
  }

  return new Promise(function(resolve, reject) {
    var fullText = '';
    fetch(endpoint, {
      method: 'POST',
      headers: reqHeaders,
      body: reqBody,
      signal: opts.signal
    }).then(function(resp) {
      if (!resp.ok) {
        papiErrorToast(resp.status);
        reject(new Error('API error ' + resp.status));
        return;
      }
      if (!isStream) {
        resp.json().then(function(data) {
          var text;
          if (isClaude) {
            text = (data.content && data.content[0] && data.content[0].text) || '';
          } else {
            text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
          }
          fullText = text;
          if (callbacks.onChunk) callbacks.onChunk(text);
          if (callbacks.onDone) callbacks.onDone(text);
          resolve(text);
        }).catch(reject);
        return;
      }
      // Streaming
      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      function pump() {
        reader.read().then(function(d) {
          if (d.done) {
            if (callbacks.onDone) callbacks.onDone(fullText);
            resolve(fullText);
            return;
          }
          buffer += decoder.decode(d.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line.startsWith('data:')) continue;
            var s = line.slice(5).trim();
            if (s === '[DONE]') continue;
            try {
              var json = JSON.parse(s);
              var chunk;
              if (isClaude) {
                if (json.type === 'content_block_delta' && json.delta && json.delta.text) {
                  chunk = json.delta.text;
                }
              } else {
                chunk = (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) || null;
              }
              if (chunk) { fullText += chunk; if (callbacks.onChunk) callbacks.onChunk(chunk); }
            } catch(e) {}
          }
          pump();
        }).catch(reject);
      }
      pump();
    }).catch(reject);
  });
}

// ===== Model fetching =====
async function pfetchModels(providerId) {
  var cfg = pgetById(providerId);
  if (!cfg) return { ok: false, error: '供应商不存在' };
  var def = PROVIDERS[providerId];
  if (!def || !def.fetchModels) {
    return { ok: true, models: def.models.map(function(m) { return { id: m, label: m }; }) };
  }
  if (!cfg.apiKey) return { ok: false, error: '请先设置 API Key' };
  try {
    var listUrl = cfg.baseUrl + '/models';
    var resp = await fetch(listUrl, {
      headers: { 'Authorization': 'Bearer ' + cfg.apiKey }
    });
    if (!resp.ok) return { ok: false, error: '获取失败 HTTP ' + resp.status };
    var data = await resp.json();
    var models = (data.data || []).map(function(m) {
      return { id: m.id, label: m.id, builtin: false };
    });
    return { ok: true, models: models };
  } catch(e) {
    return { ok: false, error: e.message || '网络错误' };
  }
}

async function ptestKey(providerId) {
  var cfg = pgetById(providerId);
  if (!cfg || !cfg.apiKey) return { ok: false, error: '未设置 API Key' };
  try {
    var resp = await fetch(cfg.baseUrl + '/models', {
      headers: { 'Authorization': 'Bearer ' + cfg.apiKey }
    });
    return { ok: resp.ok, status: resp.status };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}
