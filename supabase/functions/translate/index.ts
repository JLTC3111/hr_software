import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-demo-mode, x-demo-role",
};

/** App language codes → Google Translation API language codes */
const LANG_MAP: Record<string, string> = {
  en: "en",
  de: "de",
  fr: "fr",
  es: "es",
  jp: "ja",
  ja: "ja",
  kr: "ko",
  ko: "ko",
  th: "th",
  vn: "vi",
  vi: "vi",
  ru: "ru",
};

const MAX_BATCH = 50;
const MAX_CHARS = 8000;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const googleKey = Deno.env.get("GOOGLE_TRANSLATE_API_KEY") ?? "";

    if (!googleKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "GOOGLE_TRANSLATE_API_KEY is not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const texts: unknown = body?.texts;
    const targetLangRaw = String(body?.targetLang || body?.target || "en");
    const sourceLangRaw = body?.sourceLang
      ? String(body.sourceLang)
      : undefined;

    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "texts[] is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (texts.length > MAX_BATCH) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Batch too large (max ${MAX_BATCH})`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const targetLang = LANG_MAP[targetLangRaw] || targetLangRaw;
    const sourceLang = sourceLangRaw
      ? LANG_MAP[sourceLangRaw] || sourceLangRaw
      : undefined;

    const normalized = texts.map((t) =>
      typeof t === "string" ? t : t == null ? "" : String(t)
    );

    const totalChars = normalized.reduce((n, s) => n + s.length, 0);
    if (totalChars > MAX_CHARS) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Payload too large (max ${MAX_CHARS} chars)`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Preserve empties; only send non-empty to Google
    const indexMap: number[] = [];
    const toTranslate: string[] = [];
    normalized.forEach((s, i) => {
      if (s.trim()) {
        indexMap.push(i);
        toTranslate.push(s);
      }
    });

    const translations = [...normalized];

    if (toTranslate.length === 0) {
      return new Response(
        JSON.stringify({ success: true, translations }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const url =
      `https://translation.googleapis.com/language/translate/v2?key=${
        encodeURIComponent(googleKey)
      }`;

    const payload: Record<string, unknown> = {
      q: toTranslate,
      target: targetLang,
      format: "text",
    };
    if (sourceLang) payload.source = sourceLang;

    const googleRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      console.error("Google Translate error:", googleRes.status, errText);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Translation provider error",
          status: googleRes.status,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const googleJson = await googleRes.json();
    const translatedList =
      googleJson?.data?.translations?.map((row: { translatedText?: string }) =>
        row.translatedText ?? ""
      ) ?? [];

    translatedList.forEach((translated: string, j: number) => {
      const originalIndex = indexMap[j];
      if (originalIndex != null) translations[originalIndex] = translated;
    });

    return new Response(
      JSON.stringify({ success: true, translations, targetLang }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("translate function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
