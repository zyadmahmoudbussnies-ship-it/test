const loginForm = document.getElementById("loginForm");
const errorBox = document.getElementById("errorBox");
const loginBtn = document.getElementById("loginBtn");
const loginBtnText = document.getElementById("loginBtnText");

function showError(msg){ errorBox.textContent=msg; errorBox.classList.add("show"); }
function hideError(){ errorBox.classList.remove("show"); }

(async()=>{
  const {user,profile} = await getCurrentUserAndProfile();
  if(user&&profile){
    window.location.href = profile.role==="admin" ? "admin.html" : "student.html";
  }
})();

loginForm.addEventListener("submit", async(e)=>{
  e.preventDefault(); hideError();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  if(!username||!password){ showError("من فضلك اكتب اسم المستخدم وكلمة السر."); return; }

  loginBtn.disabled=true;
  loginBtnText.innerHTML='<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle"></span>';

  const email = usernameToEmail(username);
  const {data,error} = await supabaseClient.auth.signInWithPassword({email,password});

  if(error){
    loginBtn.disabled=false; loginBtnText.textContent="تسجيل الدخول";
    showError("اسم المستخدم أو كلمة السر غلط."); return;
  }

  const {data:profile,error:profileError} = await supabaseClient
    .from("profiles").select("*").eq("id",data.user.id).single();

  if(profileError||!profile){
    loginBtn.disabled=false; loginBtnText.textContent="تسجيل الدخول";
    showError("في مشكلة في الحساب، تواصل مع أ. أمينة.");
    await supabaseClient.auth.signOut(); return;
  }

  window.location.href = profile.role==="admin" ? "admin.html" : "student.html";
});
