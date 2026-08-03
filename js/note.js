// note

function pnoteLoad(){try{var n=localStorage.getItem('pent_note');var el=document.getElementById('pdtnotetext');if(el){if(n&&n.trim()){el.textContent=n}else{el.textContent='点击添加'}}}catch(e){}}

function pnoteEdit(){try{var n=localStorage.getItem('pent_note')||'';var v=prompt('桌面便签：',n);if(v===null)return;if(v&&v.trim()){localStorage.setItem('pent_note',v.trim());pnoteLoad()}else{localStorage.removeItem('pent_note');pnoteLoad()}}catch(e){}}
