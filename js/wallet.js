// wallet

function pwallet(){var w={points:0,days:0,checkinToday:'签到'};try{var ws=JSON.parse(localStorage.getItem('pent_wallet')||'{"points":0,"days":0}');w.points=ws.points||0;w.days=ws.days||0;var today=new Date().toISOString().slice(0,10);w.checkinToday=(ws.lastCheckin===today)?'✅ 已签到':'签到 +10'}catch(e){}return w}

function pcheckin(){var w=JSON.parse(localStorage.getItem('pent_wallet')||'{"points":0,"days":0}');var today=new Date().toISOString().slice(0,10);if(w.lastCheckin===today){pnotify({title:'✅ 今天已签到',icon:'✅'});return}w.lastCheckin=today;w.days=(w.days||0)+1;w.points=(w.points||0)+10;localStorage.setItem('pent_wallet',JSON.stringify(w));pnotify({title:'✅ 签到成功 +10',text:'已连续签到 '+w.days+' 天',icon:'✅'});if(typeof pchkStats==='function')pchkStats()}
