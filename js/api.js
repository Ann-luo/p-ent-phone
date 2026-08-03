// API Layer

async function callDeepSeek(userText, onChunk) {
  if (!apiKey) return null;

  const systemPrompt = buildSystemPrompt();
  const context = messages.slice(-80).filter(function(m) { return m.type !== 'gift_sent' && m.type !== 'gift_received'; }).slice(-50).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.text || (m.type === 'red_packet' ? '[红包]' : ''),
  }));

  // Inject pending gifts — only for user-initiated calls (not heartbeat/proactive)
  var giftMsgs = [];
  if (_pendingGifts.length > 0) {
    var giftNames = _pendingGifts.map(function(pg) { return pg.icon + ' ' + pg.name; }).join('、');
    var giftDesc = _pendingGifts.map(function(pg) { return pg.desc; }).join('；');
    giftMsgs = [{
      role: 'system',
      content: '（' + (userProfile.name || '她') + '刚刚送了' + _pendingGifts.length + '个礼物给你：' + giftNames + '。' + giftDesc + '。请在下一句回复里自然地感谢她，如果送了多个礼物可以表现得格外开心。）'
    }];
    _pendingGifts = [];
  }

  const isStreaming = !!onChunk;
  let fullText = ''; // accumulates tokens during streaming, used for abort recovery

  try {
    if (abortController) { abortController.abort(); }
    abortController = new AbortController();

    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          ...context,
          ...giftMsgs,
          { role: 'user', content: userText },
        ],
        temperature: temperature,
        top_p: topP,
        max_tokens: 400,
        stream: isStreaming,
      }),
      signal: abortController.signal,
    });

    if (!resp.ok) {
      abortController = null;
      papiErrorToast(resp.status);
      // Return a natural offline reply instead of null — avoids cold silence
      if (resp.status === 401 || resp.status === 403) {
        return getOfflineReply('key');
      } else if (resp.status === 429) {
        return getOfflineReply('busy');
      }
      return getOfflineReply('default');
    }

    // Non-streaming path (backward compat: proactive, summary, moments, etc.)
    if (!isStreaming) {
      const data = await resp.json();
      abortController = null;
      return data.choices?.[0]?.message?.content?.trim() || null;
    }

    // === SSE Streaming ===
    if (!resp.body) { abortController = null; return null; }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete line for next chunk

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') { streamDone = true; break; }

        try {
          const parsed = JSON.parse(dataStr);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            fullText += token;
            onChunk(token);
          }
        } catch (e) { /* skip unparseable chunks */ }
      }
    }

    // Flush final buffer
    buffer += decoder.decode();
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ') && trimmed.slice(6) !== '[DONE]') {
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) { fullText += token; onChunk(token); }
        } catch (e) { /* skip */ }
      }
    }

    abortController = null;
    return fullText.trim() || null;

  } catch (e) {
    if (e.name === 'AbortError') {
      // User cancelled — return whatever partial text we received
      abortController = null;
      return (fullText && fullText.trim()) || null;
    }
    // Network error or other fetch failure — return natural reply
    abortController = null;
    return getOfflineReply('default');
  }
}

function papiErrorToast(status){if(status===401||status===403){if(!_apiKeyErrorShown){_apiKeyErrorShown=true;pnotify({title:'🔑 API Key 无效',text:'请在设置中检查 Key',icon:'⚠️'});setTimeout(function(){_apiKeyErrorShown=false},10000)}return'key'}if(status===429){pnotify({title:'⏳ 请求太频繁',text:'请稍后再试',icon:'⚠️'});return'busy'}return'default'}

function papiFetch(messages,opts){opts=opts||{};try{var resp=await fetch('https://api.deepseek.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(opts.apiKey||apiKey)},body:JSON.stringify({model:opts.model||modelName||'deepseek-chat',messages:messages,temperature:opts.temperature||0.9,max_tokens:opts.maxTokens||400,stream:false}),signal:opts.signal&&opts.signal.signal||opts.signal});if(!resp.ok){papiErrorToast(resp.status);return{ok:false,status:resp.status,data:null}}var data=await resp.json();return{ok:true,status:200,data:data.choices&&data.choices[0]&&data.choices[0].message?data.choices[0].message.content.trim():null}}catch(e){if(e&&e.name==='AbortError'){return{ok:false,status:0,data:null,aborted:true}}return{ok:false,status:0,data:null,error:e}}}

function papiStream(messages,onChunk,opts){return new Promise(function(resolve){opts=opts||{};fetch('https://api.deepseek.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(opts.apiKey||apiKey)},body:JSON.stringify({model:opts.model||modelName||'deepseek-chat',messages:messages,temperature:opts.temperature||0.9,max_tokens:opts.maxTokens||400,stream:true}),signal:opts.signal&&opts.signal.signal||opts.signal}).then(function(resp){if(!resp.ok){papiErrorToast(resp.status);resolve({ok:false,status:resp.status,data:null});return}var reader=resp.body.getReader();var decoder=new TextDecoder();var buffer='';var full='';function pump(){reader.read().then(function(d){if(d.done){resolve({ok:true,status:200,data:full});return}buffer+=decoder.decode(d.value,{stream:true});var lines=buffer.split('\n');buffer=lines.pop()||'';for(var i=0;i<lines.length;i++){var line=lines[i].trim();if(line.startsWith('data:')){var s=line.slice(5).trim();if(s==='[DONE]')continue;try{var j=JSON.parse(s);var c=j.choices&&j.choices[0]&&j.choices[0].delta&&j.choices[0].delta.content;if(c){full+=c;if(onChunk)onChunk(c)}}catch(e){}}}pump()}).catch(function(e){resolve({ok:false,status:0,data:full,error:e})})}pump()}).catch(function(e){var msg=e&&e.message?e.message:''+e;resolve({ok:false,status:0,data:null,error:e,detail:msg.indexOf('Failed to fetch')>=0?'网络不通':msg.indexOf('abort')>=0?'请求被取消':msg})})})}

function papiRetry(messages,opts){opts=opts||{};var delays=[1000,3000,8000];var last;for(var attempt=0;attempt<=3;attempt++){var r=await papiFetch(messages,opts);if(r.ok)return r;if(r.status===401||r.status===403||r.status===429)return r;if(attempt<3){await new Promise(function(res){setTimeout(res,delays[attempt])})}last=r}return last}

function callDeepSeekForSMS(messages,onChunk,ac){return new Promise(function(resolve,reject){var sig=ac&&ac.signal||ac;var attempt=0,useNonStream=false;function tryOnce(){attempt++;var url="https://api.deepseek.com/v1/chat/completions";var headers={"Content-Type":"application/json","Authorization":"Bearer "+apiKey};if(useNonStream||attempt>1){var body=JSON.stringify({model:modelName||"deepseek-chat",messages:messages,temperature:0.9,max_tokens:1200,stream:false});fetch(url,{method:"POST",headers:headers,body:body,signal:sig}).then(function(resp){if(!resp.ok){if(attempt<3){setTimeout(tryOnce,1000*attempt);return}reject(new Error("API error "+resp.status))}else{resp.json().then(function(data){var text=data.choices&&data.choices[0]&&data.choices[0].message?data.choices[0].message.content:"";if(text&&onChunk)onChunk(text);resolve();}).catch(reject)}}).catch(function(e){if(attempt<3){setTimeout(tryOnce,1000*attempt)}else{reject(e)}})}else{var body2=JSON.stringify({model:modelName||"deepseek-chat",messages:messages,temperature:0.9,max_tokens:400,stream:true});fetch(url,{method:"POST",headers:headers,body:body2,signal:sig}).then(function(resp){if(!resp.ok){useNonStream=true;setTimeout(tryOnce,300);return}var reader=resp.body.getReader();var decoder=new TextDecoder();var buffer="";function pump(){reader.read().then(function(d){if(d.done){resolve();return}buffer+=decoder.decode(d.value,{stream:true});var lines=buffer.split("\n");buffer=lines.pop()||"";for(var i=0;i<lines.length;i++){var line=lines[i].trim();if(line.indexOf("data:")===0){var data=line.slice(5).trim();if(data==="[DONE]")continue;try{var json=JSON.parse(data);var content=json.choices&&json.choices[0]&&json.choices[0].delta&&json.choices[0].delta.content;if(content)onChunk(content)}catch(e){}}}pump();}).catch(function(e){useNonStream=true;setTimeout(tryOnce,300)})}pump();}).catch(function(e){useNonStream=true;setTimeout(tryOnce,300)})}}tryOnce();})}async function psmsLoadMore(){var msgs=await psmsGetMsgs();var total=msgs.length;var newOffset=_psmsOffset+50;if(newOffset>=total){_psmsHasMore=false;_psmsOffset=total}else{_psmsOffset=newOffset}psmsOpenChat(_psmsAgentId,_psmsRoomId)}
