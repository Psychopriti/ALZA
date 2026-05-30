import { createSupabaseClient } from "./supabase-client.js";

const roleLabels = {
  empresa: "Empresas",
  persona_discapacidad_auditiva: "Personas con discapacidad auditiva",
  persona_oyente: "Personas oyentes",
  super_admin: "Super user",
};

const defaultRole = "persona_discapacidad_auditiva";
const params = new URLSearchParams(window.location.search);
const pageMode = document.body.dataset.authPage || "";
const explicitRole = params.get("role");
const selectedRole = explicitRole || window.localStorage.getItem("alza:selected-role") || defaultRole;
const authForm = document.querySelector("[data-auth-form]");
const authStatus = document.querySelector("[data-auth-status]");
const roleInput = document.querySelector("[data-role-input]");
const selectedRoleLabel = document.querySelector("[data-selected-role-label]");
const organizationField = document.querySelector("[data-organization-field]");
const hearingIdField = document.querySelector("[data-hearing-id-field]");
const registerLink = document.querySelector("[data-register-link]");
const loginLink = document.querySelector("[data-login-link]");
const registerChoice = document.querySelector("[data-register-choice]");
const registerFormSection = document.querySelector("[data-register-form-section]");
const registerRoleButtons = document.querySelectorAll("[data-register-role]");

const normalizeRole = (role) => {
  return roleLabels[role] ? role : defaultRole;
};

const activeRole = normalizeRole(selectedRole);
window.localStorage.setItem("alza:selected-role", activeRole);

if (roleInput) {
  roleInput.value = activeRole;
}

if (selectedRoleLabel) {
  selectedRoleLabel.textContent = roleLabels[activeRole];
}

if (organizationField) {
  organizationField.hidden = activeRole !== "empresa";
}

const syncRoleFields = (role) => {
  if (organizationField) {
    organizationField.hidden = role !== "empresa";
    organizationField.querySelector("input").required = role === "empresa";
  }

  if (hearingIdField) {
    hearingIdField.hidden = role !== "persona_discapacidad_auditiva";
    hearingIdField.querySelector("input").required = role === "persona_discapacidad_auditiva";
  }
};

syncRoleFields(activeRole);

if (registerLink) {
  registerLink.href = `./register.html?role=${encodeURIComponent(activeRole)}`;
}

if (loginLink) {
  loginLink.href = `./login.html?role=${encodeURIComponent(activeRole)}`;
}

if (pageMode === "register" && !explicitRole && registerChoice && registerFormSection) {
  registerChoice.hidden = false;
  registerFormSection.hidden = true;
} else if (pageMode === "register" && registerChoice && registerFormSection) {
  registerChoice.hidden = true;
  registerFormSection.hidden = false;
}

registerRoleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const role = normalizeRole(button.getAttribute("data-register-role"));
    window.localStorage.setItem("alza:selected-role", role);

    if (roleInput) {
      roleInput.value = role;
    }

    if (selectedRoleLabel) {
      selectedRoleLabel.textContent = roleLabels[role];
    }

    syncRoleFields(role);

    if (loginLink) {
      loginLink.href = `./login.html?role=${encodeURIComponent(role)}`;
    }

    registerChoice.hidden = true;
    registerFormSection.hidden = false;
    registerFormSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const showStatus = (message, type = "") => {
  if (!authStatus) return;
  authStatus.textContent = message;
  authStatus.className = `auth-status ${type}`.trim();
};

const signInCompanySeat = async (supabase, email, password) => {
  const { data, error } = await supabase
    .from("company_seats")
    .select("id,company_profile_id,full_name,email,seat_label,access_password")
    .eq("email", email.toLowerCase())
    .eq("access_password", password)
    .maybeSingle();

  if (error || !data) return false;

  window.localStorage.setItem(
    "alza:company-seat-session",
    JSON.stringify({
      id: data.id,
      company_profile_id: data.company_profile_id,
      full_name: data.full_name,
      email: data.email,
      seat_label: data.seat_label,
    }),
  );
  window.localStorage.setItem("alza:selected-role", "empresa");
  await supabase.auth.signOut();
  window.location.href = "./platform.html?role=empresa";
  return true;
};

const syncProfile = async (supabase, user, payload) => {
  if (!user?.id) return;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile?.role === "super_admin") {
    return;
  }

  const profileUpdate = {
    id: user.id,
    role: payload.role,
    full_name: payload.full_name || null,
    organization_name: payload.organization_name || null,
  };

  if (Object.prototype.hasOwnProperty.call(payload, "disability_id")) {
    profileUpdate.disability_id = payload.disability_id || null;
  }

  await supabase.from("profiles").upsert(profileUpdate, { onConflict: "id" });
};

const redirectAfterAuth = async (supabase, user, fallbackRole) => {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = data?.role || fallbackRole;
  window.localStorage.setItem("alza:selected-role", role);

  if (role === "super_admin") {
    window.location.href = "./admin.html";
    return;
  }

  if (role === "persona_discapacidad_auditiva") {
    window.location.href = `./platform.html?role=${role}`;
    return;
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("profile_id", user.id)
    .in("status", ["mock_active", "active"])
    .limit(1)
    .maybeSingle();

  window.location.href = subscription ? `./platform.html?role=${role}` : `./checkout.html?role=${role}`;
};

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const supabase = await createSupabaseClient();
  const formData = new FormData(authForm);
  const mode = String(formData.get("mode") || pageMode || "login");
  const role = normalizeRole(String(formData.get("role") || activeRole));
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "").trim();
  const organizationName = String(formData.get("organization_name") || "").trim();
  const disabilityId = String(formData.get("disability_id") || "").trim();

  if (!supabase) {
    showStatus(
      "Supabase todavía no está configurado. Agrega tu URL y anon key en src/config.js.",
      "error",
    );
    return;
  }

  const profilePayload = {
    role,
    full_name: fullName,
    organization_name: role === "empresa" ? organizationName : "",
    disability_id: role === "persona_discapacidad_auditiva" ? disabilityId : "",
  };

  if (mode === "signup" || mode === "register") {
    if (role === "persona_discapacidad_auditiva" && !/^\d{8,12}$/.test(disabilityId)) {
      showStatus("El ID debe contener solo numeros y tener entre 8 y 12 digitos.", "error");
      return;
    }

    showStatus("Creando tu cuenta...");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: profilePayload,
      },
    });

    if (error) {
      showStatus(error.message, "error");
      return;
    }

    await syncProfile(supabase, data.user, profilePayload);
    if (data.session) {
      await redirectAfterAuth(supabase, data.user, role);
      return;
    }

    showStatus("Cuenta creada. Revisá tu correo para confirmar el acceso.", "success");
    return;
  }

  showStatus("Validando tus credenciales...");

  if (role === "empresa") {
    const signedInSeat = await signInCompanySeat(supabase, email, password);
    if (signedInSeat) return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    showStatus(error.message, "error");
    return;
  }

  await syncProfile(supabase, data.user, {
    role,
    full_name: data.user.user_metadata?.full_name || "",
    organization_name: data.user.user_metadata?.organization_name || "",
  });
  await redirectAfterAuth(supabase, data.user, role);
});
