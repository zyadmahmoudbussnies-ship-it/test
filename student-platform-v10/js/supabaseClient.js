const SUPABASE_URL = "https://iudqfadbrlaldfbuqpra.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XJ6FmjQ9Ekog8W0SYq_B5g_VvShqitO";
const USERNAME_EMAIL_DOMAIN = "students.app";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function usernameToEmail(username) {
  return `${username.trim().toLowerCase().replace(/\s+/g, "")}@${USERNAME_EMAIL_DOMAIN}`;
}

async function getCurrentUserAndProfile() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return { user: null, profile: null };
  const { data: profile, error } = await supabaseClient
    .from("profiles").select("*").eq("id", user.id).single();
  if (error) return { user, profile: null };
  return { user, profile };
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

function toEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${u.pathname.replace("/","")}`;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.includes("/embed/")) return url;
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed/${u.pathname.split("/shorts/")[1]}`;
    }
    if (u.hostname.includes("drive.google.com")) {
      const match = url.match(/\/d\/(.*?)\//);
      if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
    return url;
  } catch(e){ return url; }
}

function isDirectVideo(url) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}
