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

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

    const translations = [...normalized];
    const hashes = await Promise.all(
      normalized.map((s) => (s.trim() ? sha256Hex(s) : Promise.resolve(""))),
    );

    // Indexes that need translation (non-empty)
    const workIndexes: number[] = [];
    normalized.forEach((s, i) => {
      if (s.trim()) workIndexes.push(i);
    });

    if (workIndexes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, translations, cacheHits: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ---- Cache lookup ----
    const hashesToLookup = [
      ...new Set(workIndexes.map((i) => hashes[i]).filter(Boolean)),
    ];
    const cacheByHash = new Map<string, string>();

    if (hashesToLookup.length > 0) {
      const { data: cachedRows, error: cacheErr } = await supabaseAdmin
        .from("translation_cache")
        .select("source_hash, translated_text")
        .eq("target_lang", targetLang)
        .in("source_hash", hashesToLookup);

      if (cacheErr) {
        console.warn("translation_cache lookup error:", cacheErr.message);
      } else {
        (cachedRows || []).forEach(
          (row: { source_hash: string; translated_text: string }) => {
            cacheByHash.set(row.source_hash, row.translated_text);
          },
        );
      }
    }

    let cacheHits = 0;
    const missIndexes: number[] = [];
    workIndexes.forEach((i) => {
      const hit = cacheByHash.get(hashes[i]);
      if (hit != null) {
        translations[i] = hit;
        cacheHits += 1;
      } else {
        missIndexes.push(i);
      }
    });

    // ---- Google for cache misses ----
    if (missIndexes.length > 0) {
      const toTranslate = missIndexes.map((i) => normalized[i]);
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
        // Return partial results (cache hits) rather than failing entirely
        if (cacheHits === 0) {
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
      } else {
        const googleJson = await googleRes.json();
        const translatedList: string[] =
          googleJson?.data?.translations?.map(
            (row: { translatedText?: string }) => row.translatedText ?? "",
          ) ?? [];

        const upsertRows: Array<{
          source_hash: string;
          target_lang: string;
          source_text: string;
          translated_text: string;
          updated_at: string;
        }> = [];

        translatedList.forEach((translated, j) => {
          const originalIndex = missIndexes[j];
          if (originalIndex == null) return;
          const text = normalized[originalIndex];
          const out = translated || text;
          translations[originalIndex] = out;
          upsertRows.push({
            source_hash: hashes[originalIndex],
            target_lang: targetLang,
            source_text: text.slice(0, 5000),
            translated_text: out,
            updated_at: new Date().toISOString(),
          });
        });

        if (upsertRows.length > 0) {
          const { error: upsertErr } = await supabaseAdmin
            .from("translation_cache")
            .upsert(upsertRows, { onConflict: "source_hash,target_lang" });
          if (upsertErr) {
            console.warn("translation_cache upsert error:", upsertErr.message);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        translations,
        targetLang,
        cacheHits,
        cacheMisses: missIndexes.length,
      }),
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
