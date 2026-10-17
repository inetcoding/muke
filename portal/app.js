'use strict';
const $=s=>document.querySelector(s);
let lang='id', data=null, filter='all', selected=null, publicStatus=null;
try{lang=localStorage.getItem('muke_lang')==='zh'?'zh':'id';}catch{}
const text=(id,zh)=>lang==='zh'?zh:id;
const params=new URLSearchParams(location.search);
// Referral and completion links go straight to the established application flow.
if(['a','agent','s','scout','r','ref','done'].some(k=>params.has(k)))location.replace('/join/'+location.search+location.hash);
function translate(){
 document.documentElement.lang=lang==='zh'?'zh-CN':'id';
 document.querySelectorAll('[data-id][data-zh]').forEach(el=>{const value=el.dataset[lang];el.replaceChildren(...value.split('<br>').flatMap((s,i)=>i?[document.createElement('br'),document.createTextNode(s)]:[document.createTextNode(s)]));});
 $('#language').textContent=lang==='zh'?'Bahasa ID ↗':'中文 ↗';
 $('#search').placeholder=text('Cari posisi atau keahlian…','搜索岗位或技能…');
 $('#search').setAttribute('aria-label',text('Cari lowongan','搜索招聘岗位'));
 if(publicStatus&&!publicStatus.syncConfigured){$('#notice').hidden=false;$('#notice').textContent=text('Situs baru dalam uji coba. Lamaran dilanjutkan melalui portal yang aktif. Perhatikan tanggal pembaruan lowongan di bawah.','新版门户试运行。报名将转到现有申请入口，请留意下方岗位信息的更新日期。');}
 if(data)render();if(selected)detail(selected,false);
}
function render(){
 const q=$('#search').value.trim().toLowerCase();
 const jobs=data.jobs.filter(j=>j.open!==false&&(!q||[j.cn,j.id,j.jd,j.jdId].join(' ').toLowerCase().includes(q))&&(filter!=='urgent'||j.urgent));
 $('#count').textContent=text(`${jobs.length} POSISI TERSEDIA`,`${jobs.length} 个招聘岗位`);
 $('#stamp').textContent=text('Data lowongan diperbarui: ','岗位数据日期：')+(data.stamp||'—');
 $('#jobs').replaceChildren();
 if(!jobs.length){const e=document.createElement('p');e.className='empty';e.textContent=text('Belum ada posisi yang cocok. Coba kata kunci lain.','没有匹配的岗位，请尝试其他关键词。');$('#jobs').append(e);}
 jobs.forEach((j,i)=>{const b=document.createElement('button');b.className='job';const no=document.createElement('span');no.className='job-number';no.textContent=String(i+1).padStart(2,'0');const main=document.createElement('span');const name=document.createElement('span');name.className='job-title';name.textContent=lang==='zh'?j.cn:j.id||j.cn;const meta=document.createElement('span');meta.className='job-meta';const location=document.createElement('span');location.textContent='Jakarta, Indonesia';meta.append(location);if(j.urgent){const tag=document.createElement('span');tag.className='urgent';tag.textContent=text('Prioritas','急招');meta.append(tag);}main.append(name,meta);const arrow=document.createElement('span');arrow.className='job-arrow';arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');b.append(no,main,arrow);b.onclick=()=>detail(j);$('#jobs').append(b);});
}
function detail(job,open=true){selected=job;$('#detail-title').textContent=lang==='zh'?job.cn:job.id||job.cn;$('#detail-code').textContent=job.jid||'MUKE / JAKARTA';$('#description').textContent=(lang==='zh'?job.jd:job.jdId)||job.jd||text('Detail akan disampaikan oleh tim rekrutmen.','招聘团队将提供岗位详情。');const p=new URLSearchParams(location.search);p.set('j',job.cn);$('#apply').href='/join/?'+p.toString();$('#close').setAttribute('aria-label',text('Tutup detail','关闭详情'));if(open)$('#detail').showModal();}
$('#close').onclick=()=>$('#detail').close();
$('#detail').addEventListener('click',e=>{if(e.target===$('#detail')){const r=$('#detail').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#detail').close();}});
$('#search').addEventListener('input',()=>data&&render());
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(e=>e.classList.toggle('active',e===b));if(data)render();});
$('#language').onclick=()=>{lang=lang==='id'?'zh':'id';try{localStorage.setItem('muke_lang',lang);}catch{}translate();};
async function load(){try{const r=await fetch('/data/jobs.json',{cache:'no-store'});if(!r.ok)throw Error();data=await r.json();if(!Array.isArray(data.jobs))throw Error();translate();}catch{$('#count').textContent='—';const box=document.createElement('div');box.className='empty';box.textContent=text('Lowongan belum dapat dimuat. Silakan coba lagi.','暂时无法读取招聘岗位，请重试。');const retry=document.createElement('button');retry.className='retry';retry.textContent=text('Coba lagi','重新加载');retry.onclick=load;box.append(document.createElement('br'),retry);$('#jobs').replaceChildren(box);}}
translate();load();
fetch('/api/public-status',{cache:'no-store'}).then(r=>r.json()).then(s=>{publicStatus=s;translate();}).catch(()=>{});
