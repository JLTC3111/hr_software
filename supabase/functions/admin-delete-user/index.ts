import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const token = authorization.slice("Bearer ".length);

    const authClient = createClient(supabaseUrl, anonKey);
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user: requestingUser },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !requestingUser) {
      return jsonResponse({ success: false, error: "Invalid authorization" }, 401);
    }

    const { data: requestingProfile, error: profileError } = await adminClient
      .from("hr_users")
      .select("role")
      .eq("id", requestingUser.id)
      .single();
    if (profileError || requestingProfile?.role !== "admin") {
      return jsonResponse({ success: false, error: "Admin access required" }, 403);
    }

    const { userId } = await request.json();
    if (!userId || typeof userId !== "string") {
      return jsonResponse({ success: false, error: "A valid userId is required" }, 400);
    }
    if (userId === requestingUser.id) {
      return jsonResponse({ success: false, error: "Administrators cannot delete their own active account" }, 400);
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from("hr_users")
      .select("id, email")
      .eq("id", userId)
      .single();
    if (targetError || !targetProfile) {
      return jsonResponse({ success: false, error: "User not found" }, 404);
    }

    const { data: emailLink } = await adminClient
      .from("user_emails")
      .select("auth_user_id")
      .eq("hr_user_id", userId)
      .maybeSingle();
    const authUserId = emailLink?.auth_user_id || userId;

    // These nullable foreign keys do not cascade from auth.users and otherwise
    // prevent the Auth Admin API from deleting the account.
    const referenceUpdates = await Promise.all([
      adminClient.from("visits").update({ user_id: null }).eq("user_id", authUserId),
      adminClient.from("phase_milestones").update({ assigned_to: null }).eq("assigned_to", authUserId),
      adminClient.from("phase_resources").update({ uploaded_by: null }).eq("uploaded_by", authUserId),
    ]);
    const referenceError = referenceUpdates.find(result => result.error)?.error;
    if (referenceError) throw referenceError;

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(authUserId);
    if (deleteAuthError) throw deleteAuthError;

    const { error: deleteProfileError } = await adminClient
      .from("hr_users")
      .delete()
      .eq("id", userId);
    if (deleteProfileError) throw deleteProfileError;

    return jsonResponse({ success: true, deletedUserId: userId });
  } catch (error) {
    console.error("admin-delete-user failed", error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete user" },
      500,
    );
  }
});
