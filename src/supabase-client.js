export const getSupabaseConfig = () => ({
  url: window.ALZA_SUPABASE_URL || "",
  anonKey: window.ALZA_SUPABASE_ANON_KEY || "",
});

export const createSupabaseClient = async () => {
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey || url.includes("tu-proyecto") || anonKey.includes("tu-anon-key")) {
    return null;
  }

  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  return createClient(url, anonKey);
};

export const getSessionContext = async () => {
  const supabase = await createSupabaseClient();
  if (!supabase) return { supabase: null, session: null, user: null, profile: null };

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  const user = session?.user || null;

  if (!user) return { supabase, session, user, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, session, user, profile };
};
