import { plans as fallbackPlans, roleLabels } from "./platform-data.js";
import { getSessionContext } from "./supabase-client.js";

const planGrid = document.querySelector("[data-plan-grid]");
const toast = document.querySelector("[data-mock-toast]");
const copy = document.querySelector("[data-plan-copy]");
const modal = document.querySelector("[data-checkout-modal]");
const summary = document.querySelector("[data-checkout-summary]");
const confirmButton = document.querySelector("[data-confirm-checkout]");
const cancelButton = document.querySelector("[data-cancel-checkout]");
const params = new URLSearchParams(window.location.search);
const requestedRole = params.get("role") || window.localStorage.getItem("alza:selected-role") || "persona_oyente";

let selectedPlan = null;
let activeRole = requestedRole;
let activeUserId = null;
let activeSupabase = null;

const money = (value) => `C$${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 2)}`;

const fallbackForRole = (targetRole) => {
  return (fallbackPlans[targetRole] || fallbackPlans.persona_oyente).map((plan) => ({
    id: plan.id,
    name: plan.name,
    price_usd: Number(plan.price.replace("C$", "").replace("$", "")),
    billing_period: plan.cadence.includes("5 meses")
      ? "five_months"
      : plan.cadence.includes("ano")
        ? "year"
        : plan.cadence.includes("mes")
          ? "month"
          : plan.cadence,
    seats: targetRole === "empresa" ? 10 : null,
    discount_label: plan.badge || null,
    detail: plan.detail,
  }));
};

const cadenceText = (plan) => {
  if (plan.billing_period === "year") return "por ano";
  if (plan.billing_period === "five_months") return "por 5 meses";
  if (plan.billing_period === "month") return "por mes";
  return plan.billing_period || "acceso";
};

const showToast = (message) => {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
};

const openCheckoutModal = (plan) => {
  selectedPlan = plan;
  if (summary) {
    summary.textContent = `Vas a activar ${plan.name} por ${money(plan.price_usd)} ${cadenceText(plan)}.`;
  }
  if (modal) modal.hidden = false;
};

const closeCheckoutModal = () => {
  selectedPlan = null;
  if (modal) modal.hidden = true;
};

const renderPlans = (plans) => {
  if (!planGrid) return;
  planGrid.classList.toggle("single-plan", plans.length === 1);
  planGrid.innerHTML = plans
    .map(
      (plan) => `
        <article class="plan-card">
          ${plan.discount_label ? `<span class="plan-badge">${plan.discount_label}</span>` : ""}
          <h3>${plan.name}</h3>
          <strong>${money(plan.price_usd)}</strong>
          <p>${cadenceText(plan)}</p>
          <small>${plan.detail || (plan.seats ? `Hasta ${plan.seats} usuarios` : "Acceso disponible")}</small>
          <button type="button" data-plan-id="${plan.id}">Activar plan</button>
        </article>
      `,
    )
    .join("");

  document.querySelectorAll("[data-plan-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const plan = plans.find((item) => String(item.id) === button.dataset.planId);
      if (plan) openCheckoutModal(plan);
    });
  });
};

const activateSelectedPlan = async () => {
  if (!selectedPlan || !activeUserId || !activeSupabase) {
    showToast("Inicia sesion para activar un plan.");
    return;
  }

  confirmButton.disabled = true;
  confirmButton.textContent = "Activando...";

  const mockId = `mock_${Date.now()}`;
  const { error } = await activeSupabase.from("subscriptions").insert({
    profile_id: activeUserId,
    plan_id: selectedPlan.id,
    status: "mock_active",
    mock_transaction_id: mockId,
  });

  if (error) {
    confirmButton.disabled = false;
    confirmButton.textContent = "Confirmar y activar";
    showToast(error.message);
    return;
  }

  showToast("Plan activado. Redirigiendo al dashboard...");
  window.setTimeout(() => {
    window.location.href = `./platform.html?role=${activeRole}`;
  }, 650);
};

const init = async () => {
  const { supabase, user, profile } = await getSessionContext();
  activeSupabase = supabase;
  activeUserId = user?.id || null;
  activeRole = profile?.role || requestedRole;
  window.localStorage.setItem("alza:selected-role", activeRole);

  if (activeRole === "persona_discapacidad_auditiva") {
    window.location.href = `./platform.html?role=${activeRole}`;
    return;
  }

  if (copy) {
    copy.textContent =
      activeRole === "empresa"
        ? "Activa el plan empresarial para crear hasta 10 cuentas bajo tu institucion."
        : `Activa el plan para ${roleLabels[activeRole] || "tu cuenta"} y continua aprendiendo.`;
  }

  if (!supabase || !user) {
    window.location.href = `./login.html?role=${encodeURIComponent(activeRole)}`;
    return;
  }

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("profile_id", user.id)
    .in("status", ["mock_active", "active"])
    .limit(1)
    .maybeSingle();

  if (existing) {
    window.location.href = `./platform.html?role=${activeRole}`;
    return;
  }

  const { data } = await supabase
    .from("plans")
    .select("*")
    .eq("audience", activeRole)
    .eq("active", true)
    .order("price_usd", { ascending: true });

  renderPlans(data?.length ? data : fallbackForRole(activeRole));
};

cancelButton?.addEventListener("click", closeCheckoutModal);
confirmButton?.addEventListener("click", activateSelectedPlan);
modal?.addEventListener("click", (event) => {
  if (event.target === modal) closeCheckoutModal();
});

init();
