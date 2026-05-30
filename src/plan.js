import { getSessionContext } from "./supabase-client.js";

const panel = document.querySelector("[data-plan-panel]");
const statusMessage = document.querySelector("[data-plan-status]");
const params = new URLSearchParams(window.location.search);
const requestedRole = params.get("role") || window.localStorage.getItem("alza:selected-role") || "persona_oyente";
const companySeatSession = JSON.parse(window.localStorage.getItem("alza:company-seat-session") || "null");

let activeSupabase = null;
let activeSubscription = null;
let currentRole = requestedRole;

const money = (value) => `C$${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 2)}`;

const periodDays = (period) => (period === "year" ? 365 : period === "five_months" ? 150 : 30);

const remainingDays = (subscription) => {
  const plan = subscription.plans;
  const createdAt = new Date(subscription.created_at);
  const elapsed = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
  return Math.max(periodDays(plan?.billing_period) - elapsed, 0);
};

const statusLabel = (status) => {
  if (status === "mock_active" || status === "active") return "Activo";
  if (status === "mock_cancelled" || status === "cancelled") return "Cancelado";
  return status || "Sin estado";
};

const renderNoPlan = (role) => {
  if (!panel) return;
  panel.innerHTML = `
    <div class="subscription-empty">
      <p class="eyebrow">Sin plan activo</p>
      <h2>Tu cuenta todavía no tiene un plan activo.</h2>
      <p>Activá un plan para volver al dashboard y continuar con los cursos.</p>
      <a class="primary-button" href="./checkout.html?role=${encodeURIComponent(role)}">Ver planes</a>
    </div>
  `;
};

const renderFreeAccess = () => {
  if (!panel) return;
  panel.innerHTML = `
    <article class="subscription-card">
      <div>
        <p class="eyebrow">Acceso gratuito</p>
        <h2>Acceso inclusivo</h2>
        <p>Tu perfil tiene acceso libre a los cursos disponibles en ALZA.</p>
      </div>
      <dl class="subscription-meta">
        <div>
          <dt>Estado</dt>
          <dd>Activo</dd>
        </div>
        <div>
          <dt>Tiempo restante</dt>
          <dd>Ilimitado</dd>
        </div>
        <div>
          <dt>Costo</dt>
          <dd>$0</dd>
        </div>
        <div>
          <dt>Transacción</dt>
          <dd>No aplica</dd>
        </div>
      </dl>
    </article>
  `;
};

const renderPlan = (subscription) => {
  if (!panel) return;
  const plan = subscription.plans || {};
  const days = remainingDays(subscription);
  const createdAt = new Date(subscription.created_at).toLocaleDateString("es-NI", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const seats = plan.seats ? `${plan.seats} usuarios` : "Cuenta individual";
  const cadence =
    plan.billing_period === "year" ? "Plan anual" : plan.billing_period === "five_months" ? "Plan 5 meses" : "Plan mensual";

  panel.innerHTML = `
    <article class="subscription-card">
      <div>
        <p class="eyebrow">Plan actual</p>
        <h2>${plan.name || "Plan ALZA"}</h2>
        <p>${cadence} · ${seats}</p>
      </div>
      <div class="subscription-price">
        <strong>${money(plan.price_usd || 0)}</strong>
        <span>${plan.billing_period === "year" ? "por ano" : plan.billing_period === "five_months" ? "por 5 meses" : "por mes"}</span>
      </div>
      <dl class="subscription-meta">
        <div>
          <dt>Estado</dt>
          <dd>${statusLabel(subscription.status)}</dd>
        </div>
        <div>
          <dt>Tiempo restante</dt>
          <dd>${days} días</dd>
        </div>
        <div>
          <dt>Activado</dt>
          <dd>${createdAt}</dd>
        </div>
        <div>
          <dt>Transacción</dt>
          <dd>${subscription.mock_transaction_id || "mock"}</dd>
        </div>
      </dl>
      <button type="button" class="danger-button" data-cancel-plan>Cancelar plan</button>
      <p class="fine-print">La cancelación es mock y solo cambia el estado del plan en Supabase.</p>
    </article>
  `;

  document.querySelector("[data-cancel-plan]")?.addEventListener("click", cancelPlan);
};

const cancelPlan = async () => {
  if (!activeSupabase || !activeSubscription) return;
  const confirmed = window.confirm("¿Querés cancelar este plan? Esta acción mock marcará el plan como cancelado.");
  if (!confirmed) return;

  const button = document.querySelector("[data-cancel-plan]");
  if (button) {
    button.disabled = true;
    button.textContent = "Cancelando...";
  }

  const { data, error } = await activeSupabase
    .from("subscriptions")
    .update({ status: "mock_cancelled" })
    .eq("id", activeSubscription.id)
    .select("*, plans(*)")
    .single();

  if (error) {
    if (statusMessage) {
      statusMessage.textContent = error.message;
      statusMessage.hidden = false;
    }
    if (button) {
      button.disabled = false;
      button.textContent = "Cancelar plan";
    }
    return;
  }

  activeSubscription = data;
  renderNoPlan(currentRole);
};

const init = async () => {
  if (companySeatSession) {
    window.location.href = "./platform.html?role=empresa";
    return;
  }

  const { supabase, user, profile } = await getSessionContext();
  activeSupabase = supabase;
  const activeRole = profile?.role || requestedRole;
  currentRole = activeRole;
  window.localStorage.setItem("alza:selected-role", activeRole);

  if (activeRole === "persona_discapacidad_auditiva") {
    renderFreeAccess();
    return;
  }

  if (!supabase || !user) {
    window.location.href = `./login.html?role=${encodeURIComponent(activeRole)}`;
    return;
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plans(*)")
    .eq("profile_id", user.id)
    .in("status", ["mock_active", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (statusMessage) statusMessage.textContent = error.message;
    return;
  }

  if (!data) {
    renderNoPlan(activeRole);
    return;
  }

  activeSubscription = data;
  renderPlan(data);
};

init();
