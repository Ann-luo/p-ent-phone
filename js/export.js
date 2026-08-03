// Export/Import helpers

function saveFileToDevice(fileName, content, mimeType) {
  var safeName = fileName
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (safeName.length < 5) {
    safeName = 'export_' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }
  var hasExt=/.[a-z0-9]{2,5}$/i.test(safeName);if(!hasExt){if(mimeType&&mimeType.indexOf('json')!==-1){safeName+='.json'}else if(mimeType&&mimeType.indexOf('html')!==-1){safeName+='.html'}else if(mimeType&&mimeType.indexOf('text')!==-1){safeName+='.txt'}else if(mimeType&&mimeType.indexOf('javascript')!==-1){safeName+='.js'}else if(mimeType&&mimeType.indexOf('css')!==-1){safeName+='.css'}}

  // App (H5+): write to _doc/ then share
  if (_isApp && typeof plus !== 'undefined' && plus.io) {
    try {
      function tryPath(p,cb){plus.io.resolveLocalFileSystemURL(p,function(dirEntry){
        dirEntry.getFile(safeName,{create:true,exclusive:false},function(fileEntry){
          fileEntry.createWriter(function(writer){
            writer.onwrite=function(){showToast('已导出 ✅');try{if(typeof plus!=='undefined'&&plus.share)plus.share.sendWithSystem({type:'text/plain',pictures:null,href:fileEntry.fullPath,content:'',thumbs:null},function(){},function(e){showToast('分享面板未弹出');try{if(typeof plus!=='undefined'&&plus.runtime)plus.runtime.openFile(fileEntry.fullPath)}catch(e2){}})}catch(e3){}};
            writer.onerror=function(){showToast('写入失败')};
            writer.write(content);
          },function(){cb()});
        },function(){cb()});
      },function(){cb()})}
      tryPath('_downloads/',function(){tryPath('_doc/',function(){tryPath('_www/',function(){showToast('存储不可用')})})});
      return true;
    } catch(e) {}
  }
  // Browser: <a download> with fallback for mobile browsers (Quark etc.)
  var c2=content;if(typeof c2==='string'&&c2.indexOf('data:')===0){var ps=c2.split(',');if(ps.length>1){var b6=ps.slice(1).join(',');try{var rw=atob(b6);var by=new Uint8Array(rw.length);for(var ii=0;ii<rw.length;ii++)by[ii]=rw.charCodeAt(ii);c2=by.buffer}catch(e){}}}var blob=new Blob([c2],{type:mimeType||'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Mobile browsers may block blob downloads — show content in new tab as backup
  var isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);
  if (isMobile) {
    var w = window.open(url, '_blank');
    if (!w) { showToast('请允许弹出窗口以查看导出内容 📋'); }
  }
  setTimeout(function() { URL.revokeObjectURL(url); }, 3000);
  showToast('已下载：' + safeName + ' ✅');
  return true;
}

function pbackupDownload(json,fname){var blob=new Blob([json],{type:'application/json'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=fname;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url)},1000)}

function pbackupShare(json,fname){var ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;z-index:9999999;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center';ov.onclick=function(e){if(e.target===ov)ov.remove()};var sheet=document.createElement('div');sheet.style.cssText='background:#1c1c1e;border-radius:20px 20px 0 0;padding:8px 20px max(20px,env(safe-area-inset-bottom));width:100%;max-width:430px';sheet.innerHTML='<div style="width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,.3);margin:8px auto 16px"></div><div style="color:#fff;font-size:16px;font-weight:600;text-align:center;margin-bottom:4px">💾 备份完成</div><div style="color:#888;font-size:12px;text-align:center;margin-bottom:16px;word-break:break-all">'+fname+' · '+(json.length/1024).toFixed(0)+'KB</div>';function row(icon,label,fn){var r=document.createElement('div');r.style.cssText='display:flex;align-items:center;padding:14px 12px;gap:12px;color:#fff;font-size:15px;cursor:pointer;border-radius:12px';r.innerHTML='<span style="font-size:22px">'+icon+'</span><span>'+label+'</span>';r.onclick=function(){try{fn()}catch(e){pnotify({title:"导出失败",text:e.message||"未知错误",icon:"⚠️"})}setTimeout(function(){ov.remove()},300)};sheet.appendChild(r)}row('📤','导出并分享（微信同款）',function(){if(typeof saveFileToDevice==='function'){saveFileToDevice(fname,json,'application/json;charset=utf-8')}else{pbackupDownload(json,fname)}});row('📋','复制备份内容',function(){try{navigator.clipboard.writeText(json).then(function(){pnotify({title:'📋 已复制',text:'粘贴到备忘录保存',icon:'📋'})}).catch(function(){pnotify({title:'📋 复制失败',icon:'⚠️'})})}catch(e){pnotify({title:'📋 复制失败',icon:'⚠️'})}});var cancel=document.createElement('div');cancel.textContent='取消';cancel.style.cssText='text-align:center;padding:14px;color:#888;font-size:15px;cursor:pointer;border-radius:12px;margin-top:4px;background:rgba(255,255,255,.05)';cancel.onclick=function(){ov.remove()};sheet.appendChild(cancel);ov.appendChild(sheet);document.body.appendChild(ov)}
