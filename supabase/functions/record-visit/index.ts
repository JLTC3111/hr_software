import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("https://idkfmgdfzcsydrqnjcla.supabase.co") ?? "";
const serviceRoleKey = Deno.env.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlka2ZtZ2RmemNzeWRycW5qY2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3Mzk2NjMsImV4cCI6MjA2NjMxNTY2M30.PDwYk60IZyQqBXlxAdRniroHxF-c211NN4TgY8rAV1M") ?? "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const anonymizeIp = (ip: string | null): string | null => {
  if (!ip) return null;
  // Very lightweight anonymization: zero last octet for IPv4; for IPv6, drop last 4 hextets.
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
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const forwarded = req.headers.get("x-forwarded-for") || "";
    const realIp = forwarded.split(",")[0].trim() || req.headers.get("x-real-ip") || null;
    const ua = req.headers.get("user-agent") || null;

    const body = await req.json().catch(() => ({}));
    const path = body?.path ?? null;
    const referrer = body?.referrer ?? null;

    const anonIp = anonymizeIp(realIp);

    // Extract user info from Authorization header if present
    let userId: string | null = null;
    let userRole: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user) {
          userId = user.id;
          userRole = user.user_metadata?.role || user.app_metadata?.role || null;
        }
      } catch (authError) {
        console.warn("Failed to extract user from token", authError);
      }
    }

    await supabaseAdmin.from("visits").insert({
      ip: realIp,
      anonymized_ip: anonIp,
      user_agent: ua,
      path,
      referrer,
      user_id: userId,
      role: userRole,
    });

    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    console.error("record-visit error", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Failed to record visit" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
