let allVideos=[], allStudents=[], selectedStudentId=null, currentAssignedIds=new Set();

(async()=>{
  const {user,profile}=await getCurrentUserAndProfile();
  if(!user||!profile){ window.location.href="index.html"; return; }
  if(profile.role!=="admin"){ window.location.href="student.html"; return; }
  await Promise.all([loadVideos(),loadStudents()]);
  document.getElementById("loadingScreen").style.display="none";
  document.getElementById("appShell").style.display="flex";
})();

function switchTab(tab){
  ["Videos","Students","Assign"].forEach(t=>{
    document.getElementById("tab"+t).style.display="none";
    document.getElementById("nav"+t).classList.remove("active");
  });
  document.getElementById("tab"+tab).style.display="block";
  document.getElementById("nav"+tab).classList.add("active");
}

// ===== Videos =====
async function loadVideos(){
  const {data,error}=await supabaseClient.from("videos").select("*").order("created_at",{ascending:false});
  if(error){ console.error(error); return; }
  allVideos=data||[]; renderVideos();
}
function renderVideos(){
  const empty=document.getElementById("videosEmpty");
  const wrap=document.getElementById("videosTableWrap");
  const tbody=document.getElementById("videosTableBody");
  if(allVideos.length===0){ empty.style.display="block"; wrap.style.display="none"; return; }
  empty.style.display="none"; wrap.style.display="block";
  tbody.innerHTML=allVideos.map(v=>`<tr>
    <td><strong>${escHtml(v.title)}</strong></td>
    <td class="muted">${v.description?escHtml(v.description):"—"}</td>
    <td class="muted" style="white-space:nowrap;">${fmtDate(v.created_at)}</td>
    <td><div class="row-actions">
      <button class="btn btn-ghost btn-sm" onclick="window.open(toEmbedUrl('${escAttr(v.url)}'),'_blank')">▶ معاينة</button>
      <button class="btn btn-danger btn-sm" onclick="deleteVideo('${v.id}')">حذف</button>
    </div></td>
  </tr>`).join("");
}
function openAddVideoModal(){
  ["vTitle","vDesc","vUrl"].forEach(id=>document.getElementById(id).value="");
  hideModalError("addVideoError"); openModal("addVideoModal");
}
async function submitAddVideo(){
  const title=document.getElementById("vTitle").value.trim();
  const desc=document.getElementById("vDesc").value.trim();
  const url=document.getElementById("vUrl").value.trim();
  if(!title||!url){ showModalError("addVideoError","اكتبي العنوان والرابط على الأقل."); return; }
  setBtnLoading("addVideoBtn",true);
  const {error}=await supabaseClient.from("videos").insert({title,description:desc||null,url});
  setBtnLoading("addVideoBtn",false);
  if(error){ showModalError("addVideoError","في مشكلة: "+error.message); return; }
  closeModal("addVideoModal"); await loadVideos();
}
async function deleteVideo(id){
  if(!confirm("هتحذفي الدرس ده وكل تعيينه. تأكيد؟")) return;
  await supabaseClient.from("video_assignments").delete().eq("video_id",id);
  await supabaseClient.from("videos").delete().eq("id",id);
  await loadVideos();
}

// ===== Students =====
async function loadStudents(){
  const {data,error}=await supabaseClient.from("profiles").select("*").eq("role","student").order("created_at",{ascending:false});
  if(error){ console.error(error); return; }
  allStudents=data||[]; renderStudents(); populateAssignSelect();
}
function renderStudents(){
  const empty=document.getElementById("studentsEmpty");
  const wrap=document.getElementById("studentsTableWrap");
  const tbody=document.getElementById("studentsTableBody");
  if(allStudents.length===0){ empty.style.display="block"; wrap.style.display="none"; return; }
  empty.style.display="none"; wrap.style.display="block";
  tbody.innerHTML=allStudents.map(s=>`<tr>
    <td><strong>${escHtml(s.display_name||"—")}</strong></td>
    <td class="muted">${escHtml(s.username||"—")}</td>
    <td><span class="badge ${s.is_active?"badge-on":"badge-off"}">${s.is_active?"مفعّل":"معطّل"}</span></td>
    <td><div class="row-actions">
      <label class="switch">
        <input type="checkbox" ${s.is_active?"checked":""} onchange="toggleStudentActive('${s.id}',this.checked)"/>
        <span class="slider"></span>
      </label>
      <button class="btn btn-danger btn-sm" onclick="deleteStudent('${s.id}')">حذف</button>
    </div></td>
  </tr>`).join("");
}
function openAddStudentModal(){
  ["sDisplay","sUsername","sPassword"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("sActive").checked=true;
  hideModalError("addStudentError"); openModal("addStudentModal");
}
async function submitAddStudent(){
  const display=document.getElementById("sDisplay").value.trim();
  const username=document.getElementById("sUsername").value.trim().toLowerCase().replace(/\s+/g,"");
  const password=document.getElementById("sPassword").value;
  const isActive=document.getElementById("sActive").checked;
  if(!display||!username||!password){ showModalError("addStudentError","اكتبي كل البيانات المطلوبة."); return; }
  if(password.length<8){ showModalError("addStudentError","كلمة السر لازم تكون 8 حروف على الأقل."); return; }
  if(!/^[a-z0-9_]+$/.test(username)){ showModalError("addStudentError","اسم المستخدم: حروف إنجليزية وأرقام وـ فقط."); return; }
  setBtnLoading("addStudentBtn",true);
  const email=usernameToEmail(username);
  const {data:fnData,error:fnError}=await supabaseClient.functions.invoke("create-student",{
    body:{email,password,display_name:display,username,is_active:isActive}
  });
  setBtnLoading("addStudentBtn",false);
  if(fnError||fnData?.error){ showModalError("addStudentError",fnData?.error||fnError?.message||"في مشكلة أثناء الإنشاء"); return; }
  closeModal("addStudentModal"); await loadStudents();
}
async function toggleStudentActive(id,value){
  await supabaseClient.from("profiles").update({is_active:value}).eq("id",id);
  await loadStudents();
}
async function deleteStudent(id){
  if(!confirm("هتحذفي حساب الطالب ده. تأكيد؟")) return;
  await supabaseClient.from("video_assignments").delete().eq("student_id",id);
  await supabaseClient.functions.invoke("delete-student",{body:{student_id:id}});
  await loadStudents();
}

// ===== Assign =====
function populateAssignSelect(){
  const sel=document.getElementById("assignStudentSelect");
  const prev=sel.value; sel.innerHTML='<option value="">— اختاري —</option>';
  allStudents.forEach(s=>{
    const opt=document.createElement("option");
    opt.value=s.id; opt.textContent=`${s.display_name||s.username} (${s.username})`;
    sel.appendChild(opt);
  });
  if(prev) sel.value=prev;
}
async function loadStudentAssignments(){
  const sel=document.getElementById("assignStudentSelect");
  selectedStudentId=sel.value||null;
  const panel=document.getElementById("assignPanel");
  if(!selectedStudentId){ panel.style.display="none"; return; }
  const student=allStudents.find(s=>s.id===selectedStudentId);
  document.getElementById("assignPanelTitle").textContent=`دروس: ${student?.display_name||student?.username||"الطالب"}`;
  panel.style.display="block";
  const {data}=await supabaseClient.from("video_assignments").select("video_id").eq("student_id",selectedStudentId);
  currentAssignedIds=new Set((data||[]).map(r=>r.video_id));
  renderAssignedList();
}
function renderAssignedList(){
  const list=document.getElementById("assignedList");
  const empty=document.getElementById("assignEmpty");
  const assigned=allVideos.filter(v=>currentAssignedIds.has(v.id));
  if(assigned.length===0){ empty.style.display="block"; list.innerHTML=""; return; }
  empty.style.display="none";
  list.innerHTML=assigned.map(v=>`<div class="assign-row">
    <span>🎬 ${escHtml(v.title)}</span>
    <button class="btn btn-danger btn-sm" onclick="removeAssignment('${v.id}')">إلغاء</button>
  </div>`).join("");
}
function openAssignVideoModal(){
  if(!selectedStudentId) return;
  const student=allStudents.find(s=>s.id===selectedStudentId);
  document.getElementById("assignModalTitle").textContent=`تعيين درس: ${student?.display_name||student?.username||""}`;
  hideModalError("assignError"); renderAssignVideoList(); openModal("assignVideoModal");
}
function renderAssignVideoList(){
  const list=document.getElementById("assignVideoList");
  const unassigned=allVideos.filter(v=>!currentAssignedIds.has(v.id));
  if(unassigned.length===0){ list.innerHTML=`<p class="muted text-center" style="padding:20px 0;">كل الدروس معيّنة بالفعل لهذا الطالب.</p>`; return; }
  list.innerHTML=unassigned.map(v=>`<div class="assign-row">
    <span>🎬 ${escHtml(v.title)}</span>
    <button class="btn btn-teal btn-sm" onclick="addAssignment('${v.id}')">تعيين</button>
  </div>`).join("");
}
async function addAssignment(videoId){
  if(!selectedStudentId) return;
  const {error}=await supabaseClient.from("video_assignments").insert({student_id:selectedStudentId,video_id:videoId});
  if(error){ showModalError("assignError","في مشكلة: "+error.message); return; }
  currentAssignedIds.add(videoId); renderAssignVideoList(); renderAssignedList();
}
async function removeAssignment(videoId){
  if(!selectedStudentId) return;
  await supabaseClient.from("video_assignments").delete().eq("student_id",selectedStudentId).eq("video_id",videoId);
  currentAssignedIds.delete(videoId); renderAssignedList();
}

// ===== Modals =====
function openModal(id){ document.getElementById(id).classList.add("open"); }
function closeModal(id){ document.getElementById(id).classList.remove("open"); }
document.querySelectorAll(".modal-backdrop").forEach(b=>b.addEventListener("click",e=>{ if(e.target===b) b.classList.remove("open"); }));
document.addEventListener("keydown",e=>{ if(e.key==="Escape") document.querySelectorAll(".modal-backdrop.open").forEach(m=>m.classList.remove("open")); });

// ===== Helpers =====
function setBtnLoading(id,loading){
  const btn=document.getElementById(id); if(!btn) return;
  btn.disabled=loading;
  if(loading){ btn._prev=btn.innerHTML; btn.innerHTML='<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle"></span>'; }
  else btn.innerHTML=btn._prev||"حفظ";
}
function showModalError(id,msg){ const el=document.getElementById(id); el.textContent=msg; el.style.display="block"; }
function hideModalError(id){ document.getElementById(id).style.display="none"; }
function escHtml(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function escAttr(s){ return String(s).replace(/"/g,"&quot;"); }
function fmtDate(d){ return new Date(d).toLocaleDateString("ar-EG",{year:"numeric",month:"long",day:"numeric"}); }
