import { createSupabaseClient } from "./supabase-client.js";

document.querySelectorAll("[data-sign-out]").forEach((element) => {
  element.addEventListener("click", async (event) => {
    event.preventDefault();
    const supabase = await createSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    window.localStorage.removeItem("alza:company-seat-session");
    window.location.href = "./index.html";
  });
});
