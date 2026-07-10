const loadingScreen=document.getElementById("loadingScreen");
const appShell=document.getElementById("appShell");
const inactivePanel=document.getElementById("inactivePanel");
const emptyPanel=document.getElementById("emptyPanel");
const videoGrid=document.getElementById("videoGrid");
const playerBackdrop=document.getElementById("playerBackdrop");
const playerSlot=document.getElementById("playerSlot");

(async()=>{
  const {user,profile}=await getCurrentUserAndProfile();
  if(!user||!profile){ window.location.href="index.html"; return; }
  if(profile.role==="admin"){ window.location.href="admin.html"; return; }
  initUI(profile);
  await loadVideos(profile);
  loadingScreen.style.display="none";
  appShell.style.display="flex";
})();

function initUI(profile){
  const name=profile.display_name||profile.username||"بيك";
  document.getElementById("welcomeName").textContent=name;
  document.getElementById("sideUsername").textContent=name;
  document.getElementById("avatarInitial").textContent=name.charAt(0).toUpperCase();
  const badge=document.getElementById("statusBadge");
  badge.innerHTML=profile.is_active
    ?'<span class="badge badge-on">حساب مفعّل</span>'
    :'<span class="badge badge-off">حساب معطّل</span>';
}

async function loadVideos(profile){
  if(!profile.is_active){ inactivePanel.style.display="block"; return; }
  const {data:assignments,error}=await supabaseClient
    .from("video_assignments")
    .select(`video_id, videos(id,title,description,url,created_at)`)
    .eq("student_id",profile.id);
  if(error){ emptyPanel.style.display="block"; return; }
  const videos=(assignments||[]).map(a=>a.videos).filter(Boolean)
    .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if(videos.length===0){ emptyPanel.style.display="block"; return; }
  videoGrid.innerHTML=videos.map(buildCard).join("");
  videoGrid.querySelectorAll(".play-btn").forEach(btn=>{
    btn.addEventListener("click",()=>openPlayer(btn.dataset.url));
  });
}

function buildCard(v){
  const yid=extractYoutubeId(v.url);
  const thumb=yid
    ?`<img src="https://img.youtube.com/vi/${yid}/mqdefault.jpg" alt="${v.title}" loading="lazy"/>`
    :`<div style="display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--text-muted);font-size:.8rem;"><span style="font-size:2.2rem">🎬</span><span>فيديو</span></div>`;
  const date=new Date(v.created_at).toLocaleDateString("ar-EG",{year:"numeric",month:"long",day:"numeric"});
  return `<div class="video-card">
    <div class="thumb">${thumb}<div class="notch right"></div><div class="notch left"></div></div>
    <div class="body">
      <h3>${escHtml(v.title)}</h3>
      ${v.description?`<p>${escHtml(v.description)}</p>`:""}
      <div class="meta-row">
        <span>${date}</span>
        <button class="btn btn-primary btn-sm play-btn" data-url="${escAttr(v.url)}">▶ شاهد</button>
      </div>
    </div>
  </div>`;
}

function extractYoutubeId(url){
  try{
    const u=new URL(url);
    if(u.hostname.includes("youtu.be")) return u.pathname.replace("/","");
    if(u.hostname.includes("youtube.com")){
      if(u.pathname.startsWith("/shorts/")) return u.pathname.split("/shorts/")[1];
      return u.searchParams.get("v");
    }
  }catch{}
  return null;
}

function openPlayer(url){
  const embed=toEmbedUrl(url);
  playerSlot.innerHTML=isDirectVideo(url)
    ?`<video controls autoplay style="width:100%;height:100%;background:#000;" src="${escAttr(url)}"></video>`
    :`<iframe src="${escAttr(embed)}" allow="autoplay;encrypted-media" allowfullscreen></iframe>`;
  playerBackdrop.classList.add("open");
  document.body.style.overflow="hidden";
}
function closePlayer(){ playerBackdrop.classList.remove("open"); playerSlot.innerHTML=""; document.body.style.overflow=""; }
document.getElementById("playerClose").addEventListener("click",closePlayer);
playerBackdrop.addEventListener("click",e=>{ if(e.target===playerBackdrop) closePlayer(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape") closePlayer(); });

function escHtml(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function escAttr(s){ return String(s).replace(/"/g,"&quot;"); }
