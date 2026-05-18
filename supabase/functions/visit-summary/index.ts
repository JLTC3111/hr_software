import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await supabaseAdmin.auth
      .getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let hrUserId = user.id;
    const { data: emailMapping } = await supabaseAdmin
      .from("user_emails")
      .select("hr_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (emailMapping?.hr_user_id) {
      hrUserId = emailMapping.hr_user_id;
    }

    const { data: hrUser } = await supabaseAdmin
      .from("hr_users")
      .select("role")
      .eq("id", hrUserId)
      .maybeSingle();

    const role = hrUser?.role ?? user.app_metadata?.role ??
      user.user_metadata?.role ?? "";
    if (role !== "admin") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized: Admin access required",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const summary = {
      total: 0,
      last24h: 0,
      distinctIps: 0,
      demoCount: 0,
      authorizedSessions: 0,
      recent: [] as Record<string, unknown>[],
    };

    const totalResp = await supabaseAdmin
      .from("visits")
      .select("id", { count: "exact", head: true });
    if (totalResp.error) throw totalResp.error;
    summary.total = totalResp.count ?? 0;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const lastResp = await supabaseAdmin
      .from("visits")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (lastResp.error) throw lastResp.error;
    summary.last24h = lastResp.count ?? 0;

    const distinctResp = await supabaseAdmin
      .from("visits")
      .select("ip")
      .not("ip", "is", null)
      .limit(1000);
    if (distinctResp.error) throw distinctResp.error;
    summary.distinctIps = new Set(
      (distinctResp.data || []).map((r) => r.ip),
    ).size;

    const demoResp = await supabaseAdmin
      .from("visits")
      .select("id", { count: "exact", head: true })
      .eq("is_demo", true);
    summary.demoCount = demoResp.error ? 0 : (demoResp.count ?? 0);

    const authResp = await supabaseAdmin
      .from("visits")
      .select("id", { count: "exact", head: true })
      .not("user_id", "is", null);
    summary.authorizedSessions = authResp.error
      ? 0
      : (authResp.count ?? 0);

    const recentResp = await supabaseAdmin
      .from("visits")
      .select("id, ip, path, referrer, user_agent, created_at, is_demo")
      .order("created_at", { ascending: false })
      .limit(20);
    if (recentResp.error) throw recentResp.error;
    summary.recent = recentResp.data || [];

    return new Response(JSON.stringify({ success: true, data: summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("visit-summary error", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Failed to fetch visit summary",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
