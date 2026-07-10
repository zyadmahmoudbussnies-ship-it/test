import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("غير مصرح");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) throw new Error("غير مصرح");

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles").select("role").eq("id", user.id).single();
    if (!callerProfile || callerProfile.role !== "admin") throw new Error("صلاحية مرفوضة");

    const { email, password, display_name, username, is_active } = await req.json();
    if (!email || !password || !username) throw new Error("بيانات ناقصة");

    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (createErr) throw new Error(createErr.message);

    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert({
      id: newUser.user.id,
      username,
      display_name: display_name || username,
      role: "student",
      is_active: is_active ?? true,
    });
    if (profileErr) throw new Error(profileErr.message);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
