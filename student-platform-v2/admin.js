let allVideos=[], allStudents=[], allMaterials=[], selectedStudentId=null, currentAssignedIds=new Set();

(async()=>{
  const {user,profile}=await getCurrentUserAndProfile();
  if(!user||!profile){ window.location.href="index.html"; return; }
  if(profile.role!=="admin"){ window.location.href="student.html"; return; }
  await Promise.all([loadVideos(),loadStudents(),loadMaterials()]);
  document.getElementById("loadingScreen").style.display="none";
  document.getElementById("appShell").style.display="flex";
})();

function switchTab(tab){
  ["Videos","Materials","Students","Assign"].forEach(t=>{
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
    <td data-label="عنوان الدرس"><strong>${escHtml(v.title)}</strong></td>
    <td data-label="الوصف" class="muted">${v.description?escHtml(v.description):"—"}</td>
    <td data-label="تاريخ الإضافة" class="muted" style="white-space:nowrap;">${fmtDate(v.created_at)}</td>
    <td data-label="إجراءات"><div class="row-actions">
      <button class="btn btn-ghost btn-sm" onclick="window.open(toEmbedUrl('${escAttr(v.url)}'),'_blank')">▶ معاينة</button>
      <button class="btn btn-teal btn-sm" onclick="openBulkAssignModal('video','${v.id}','${escAttr(v.title)}')">👥 تعيين</button>
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

// ===== Materials (PDF / Word) =====
async function loadMaterials(){
  const {data,error}=await supabaseClient.from("materials").select("*").order("created_at",{ascending:false});
  if(error){ console.error(error); return; }
  allMaterials=data||[]; renderMaterials();
}
function fileTypeLabel(t){
  if(t==="pdf") return "📕 PDF";
  if(t==="doc"||t==="docx") return "📘 Word";
  return "📄 ملف";
}
function renderMaterials(){
  const empty=document.getElementById("materialsEmpty");
  const wrap=document.getElementById("materialsTableWrap");
  const tbody=document.getElementById("materialsTableBody");
  if(allMaterials.length===0){ empty.style.display="block"; wrap.style.display="none"; return; }
  empty.style.display="none"; wrap.style.display="block";
  tbody.innerHTML=allMaterials.map(m=>`<tr>
    <td data-label="عنوان الملف"><strong>${escHtml(m.title)}</strong></td>
    <td data-label="النوع" class="muted">${fileTypeLabel(m.file_type)}</td>
    <td data-label="تاريخ الإضافة" class="muted" style="white-space:nowrap;">${fmtDate(m.created_at)}</td>
    <td data-label="إجراءات"><div class="row-actions">
      <a class="btn btn-ghost btn-sm" href="${escAttr(m.file_url)}" target="_blank" rel="noopener">⬇ فتح</a>
      <button class="btn btn-teal btn-sm" onclick="openBulkAssignModal('material','${m.id}','${escAttr(m.title)}')">👥 تعيين</button>
      <button class="btn btn-danger btn-sm" onclick="deleteMaterial('${m.id}')">حذف</button>
    </div></td>
  </tr>`).join("");
}
function openAddMaterialModal(){
  ["mTitle","mDesc"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("mFile").value="";
  hideModalError("addMaterialError"); openModal("addMaterialModal");
}
async function submitAddMaterial(){
  const title=document.getElementById("mTitle").value.trim();
  const desc=document.getElementById("mDesc").value.trim();
  const file=document.getElementById("mFile").files[0];
  if(!title||!file){ showModalError("addMaterialError","اكتبي العنوان واختاري الملف على الأقل."); return; }
  const ext=file.name.split(".").pop().toLowerCase();
  if(!["pdf","doc","docx"].includes(ext)){ showModalError("addMaterialError","الملف لازم يكون PDF أو Word بس."); return; }
  setBtnLoading("addMaterialBtn",true);
  const path=`${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g,"_")}`;
  const {error:upErr}=await supabaseClient.storage.from("materials").upload(path,file);
  if(upErr){
    setBtnLoading("addMaterialBtn",false);
    showModalError("addMaterialError","في مشكلة أثناء الرفع: "+upErr.message+" — تأكدي إن الـ storage bucket 'materials' متعمول له إعداد صح.");
    return;
  }
  const {data:pub}=supabaseClient.storage.from("materials").getPublicUrl(path);
  const {error}=await supabaseClient.from("materials").insert({
    title, description:desc||null, file_url:pub.publicUrl, file_type:ext
  });
  setBtnLoading("addMaterialBtn",false);
  if(error){ showModalError("addMaterialError","في مشكلة: "+error.message); return; }
  closeModal("addMaterialModal"); await loadMaterials();
}
async function deleteMaterial(id){
  if(!confirm("هتحذفي الملف ده وكل تعيينه. تأكيد؟")) return;
  await supabaseClient.from("material_assignments").delete().eq("material_id",id);
  await supabaseClient.from("materials").delete().eq("id",id);
  await loadMaterials();
}

// ===== Bulk assign (one video/material → many students at once) =====
let bulkAssignType=null, bulkAssignItemId=null;
function openBulkAssignModal(type,itemId,itemTitle){
  bulkAssignType=type; bulkAssignItemId=itemId;
  document.getElementById("bulkAssignTitle").textContent=`تعيين: ${itemTitle}`;
  hideModalError("bulkAssignError");
  document.getElementById("bulkAssignList").innerHTML=`<p class="muted text-center" style="padding:20px 0;">بتحمّل...</p>`;
  openModal("bulkAssignModal");
  renderBulkAssignList();
}
async function renderBulkAssignList(){
  const list=document.getElementById("bulkAssignList");
  if(allStudents.length===0){ list.innerHTML=`<p class="muted text-center" style="padding:20px 0;">أضيفي طلبة الأول.</p>`; return; }
  const table=bulkAssignType==="video"?"video_assignments":"material_assignments";
  const col=bulkAssignType==="video"?"video_id":"material_id";
  const {data}=await supabaseClient.from(table).select("student_id").eq(col,bulkAssignItemId);
  const assignedSet=new Set((data||[]).map(r=>r.student_id));
  list.innerHTML=allStudents.map(s=>`
    <label class="assign-row" style="cursor:pointer;">
      <span>👤 ${escHtml(s.display_name||s.username)}</span>
      <input type="checkbox" data-id="${s.id}" ${assignedSet.has(s.id)?"checked":""}/>
    </label>`).join("");
}
async function submitBulkAssign(){
  const table=bulkAssignType==="video"?"video_assignments":"material_assignments";
  const col=bulkAssignType==="video"?"video_id":"material_id";
  const checks=[...document.querySelectorAll("#bulkAssignList input[type=checkbox]")];
  const checkedIds=checks.filter(c=>c.checked).map(c=>c.dataset.id);
  const uncheckedIds=checks.filter(c=>!c.checked).map(c=>c.dataset.id);
  setBtnLoading("bulkAssignBtn",true);
  if(checkedIds.length){
    const rows=checkedIds.map(sid=>({student_id:sid,[col]:bulkAssignItemId}));
    const {error}=await supabaseClient.from(table).upsert(rows,{onConflict:`student_id,${col}`});
    if(error){ setBtnLoading("bulkAssignBtn",false); showModalError("bulkAssignError","في مشكلة: "+error.message); return; }
  }
  if(uncheckedIds.length){
    await supabaseClient.from(table).delete().eq(col,bulkAssignItemId).in("student_id",uncheckedIds);
  }
  setBtnLoading("bulkAssignBtn",false);
  closeModal("bulkAssignModal");
  if(selectedStudentId) loadStudentAssignments();
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
    <td data-label="اسم الطالب"><strong>${escHtml(s.display_name||"—")}</strong></td>
    <td data-label="اسم المستخدم" class="muted">${escHtml(s.username||"—")}</td>
    <td data-label="الحالة"><span class="badge ${s.is_active?"badge-on":"badge-off"}">${s.is_active?"مفعّل":"معطّل"}</span></td>
    <td data-label="إجراءات"><div class="row-actions">
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
