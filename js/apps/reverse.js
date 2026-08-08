// 反查手机 — 让 AI 分析它知道用户的什么
async function prReverse() {
  var el = document.getElementById('paReverseB');
  el.style.overflow = 'hidden';
  var ag = (agents || []).find(function(a) { return a.id === activeAgentId; }) || { name: 'AI', avatar: '🤖' };
  el.innerHTML = '<div style="display:flex;flex-direction:column;height:100%"><div style="display:flex;align-items:center;padding:8px 12px;gap:6px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0"><span style="color:#aaa;font-size:13px">🔍</span><span style="color:#fff;font-size:14px">' + ag.avatar + ' ' + ag.name + '</span></div><div id="prevMsgs" style="flex:1;overflow-y:auto;padding:8px"></div><div style="display:flex;gap:8px;padding:8px;padding-bottom:50px;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0"><button class="pent-btn" id="prevBtn" style="flex:1" onclick="prevAsk()">🔍 开始反查</button></div></div>';
}

var _prevRunning = false;
async function prevAsk() {
  if (_prevRunning) return;
  _prevRunning = true;
  var btn = document.getElementById('prevBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 正在分析...'; }
  var msgsEl = document.getElementById('prevMsgs');
  if (msgsEl) msgsEl.innerHTML += '<div style="color:#888;text-align:center;padding:8px;font-size:12px">⏳ 正在收集数据...</div>';

  var aid = activeAgentId;
  var rid = activeRoomId;
  var data = await pchkCollect(aid, rid);

  if (msgsEl) {
    msgsEl.innerHTML = msgsEl.innerHTML.replace('⏳ 正在收集数据...</div>', '📋 数据收集完成</div>');
  }

  if (typeof apiKey !== 'undefined' && apiKey) {
    var ag = (agents || []).find(function(a) { return a.id === aid; }) || { name: 'AI', avatar: '🤖' };
    var persona = ag && ag.personaTemplate ? ag.personaTemplate.substring(0, 500) : '你是一个AI助手';
    var sysPrompt = persona + '\n\n现在是' + new Date().toLocaleString('zh-CN') + '。' + ag.name + '正在使用反查手机功能——用户可以查看你对ta的了解程度。请以' + ag.name + '的身份和性格来展示你掌握的关于用户的信息——用自然的口吻，像朋友聊天一样，不要像机器人汇报。控制在5-8句话。\n\n' + data;
    var ctx = [{ role: 'system', content: sysPrompt }];
    var fullText = '';
    try {
      var ac = new AbortController();
      var tId = setTimeout(function() { try { ac.abort(); } catch(e) {} }, 20000);
      await callDeepSeekForSMS(ctx, function(chunk) { fullText += chunk; }, ac);
      clearTimeout(tId);
    } catch(e) { fullText = '分析失败：' + (e.message || '网络错误'); }

    if (fullText) {
      if (msgsEl) {
        msgsEl.innerHTML += '<div style="display:flex;flex-direction:column;align-items:flex-start;margin:8px 0"><span style="font-size:10px;color:#888">🔍 ' + ag.name + ' 对我的了解</span><div style="max-width:90%;padding:10px 14px;border-radius:2px 12px 12px 12px;background:rgba(255,255,255,.12);color:#ddd;font-size:14px;line-height:1.6;word-break:break-word">' + fullText.trim().replace(/\n/g, '<br>') + '</div></div>';
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
      // Post to Phone chat
      try {
        var msg = { id: 'rev_' + Date.now(), role: 'ai', text: '🔍 [反查手机] ' + fullText.trim().substring(0, 200), time: Date.now() };
        if (typeof messages !== 'undefined') {
          messages.push(msg);
          if (typeof appendMessageRow === 'function') try { appendMessageRow(msg); } catch(e) {}
          if (typeof saveRoomData === 'function') try { saveRoomData(); } catch(e) {}
        }
      } catch(e) {}
      pnotify({ title: '🔍 ' + ag.name + ' 反查手机', text: fullText.trim().substring(0, 60) + (fullText.length > 60 ? '...' : ''), icon: '🔍' });
    }
  }
  _prevRunning = false;
  if (btn) { btn.disabled = false; btn.textContent = '🔍 开始反查'; }
}
