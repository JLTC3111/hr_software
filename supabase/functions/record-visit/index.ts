import// Support either SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (recommended)
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.warn("record-visit: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in environment. Visits may fail.");
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
const anonymizeIp = (ip)=>{
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
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders
    });
  }
  try {
    const forwarded = req.headers.get("x-forwarded-for") || "";
    const realIp = forwarded.split(",")[0].trim() || req.headers.get("x-real-ip") || null;
    const ua = req.headers.get("user-agent") || null;
    const body = await req.json().catch(()=>({}));
    const path = body?.path ?? null;
    const referrer = body?.referrer ?? null;
    const anonIp = anonymizeIp(realIp);
    await supabaseAdmin.from("visits").insert({
      ip: realIp,
      anonymized_ip: anonIp,
      user_agent: ua,
      path,
      referrer
    });
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  } catch (error) {
    console.error("record-visit error", error);
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || "Failed to record visit"
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
