import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-demo-mode, x-demo-role",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    "record-visit: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. Visits may fail.",
  );
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/** Client IP behind Supabase / Cloudflare (cf-connecting-ip is the reliable header). */
const getClientIp = (req: Request): string | null => {
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    req.headers.get("x-real-ip"),
    req.headers.get("fly-client-ip"),
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const ip = raw.replace(/^\[|\]$/g, "").trim();
    if (ip) return ip;
  }
  return null;
};

const anonymizeIp = (ip: string | null): string | null => {
  if (!ip) return null;
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      parts[3] = "0";
      return parts.join(".");
    }
  }
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, Math.max(0, parts.length - 4)).join(":") || null;
  }
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const realIp = getClientIp(req);
    const body = await req.json().catch(() => ({}));
    const path = body?.path ?? null;
    const referrer = body?.referrer ?? null;
    const ua =
      body?.userAgent ?? req.headers.get("user-agent") ?? null;

    const demoRoleHeader = (req.headers.get("x-demo-role") || "").trim();
    const isDemoHeader = (req.headers.get("x-demo-mode") || "").toLowerCase();
    const isDemoModeFlag = isDemoHeader === "1" || isDemoHeader === "true";
    const isDemo = !!demoRoleHeader || isDemoModeFlag;
    const roleValue = demoRoleHeader || (isDemo ? "demo_admin" : null);

    let userId: string | null = null;
    let userRole: string | null = roleValue;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user) {
          userId = user.id;
          if (!userRole) {
            userRole =
              user.user_metadata?.role || user.app_metadata?.role || null;
          }
        }
      } catch (authError) {
        console.warn("record-visit: failed to extract user from token", authError);
      }
    }

    const anonIp = anonymizeIp(realIp);

    await supabaseAdmin.from("visits").insert({
      ip: realIp,
      anonymized_ip: anonIp,
      user_agent: ua,
      path,
      referrer,
      is_demo: isDemo,
      role: userRole,
      user_id: userId,
    });

    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    console.error("record-visit error", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Failed to record visit",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
