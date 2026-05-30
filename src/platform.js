import { courses as fallbackCourses, roleLabels } from "./platform-data.js";
import { getSessionContext } from "./supabase-client.js";

const params = new URLSearchParams(window.location.search);
const courseGrid = document.querySelector("[data-course-grid]");
const roleNodes = document.querySelectorAll("[data-role-label]");
const userNameNode = document.querySelector("[data-user-name]");
const streakNode = document.querySelector("[data-user-streak]");
const streakCopyNode = document.querySelector("[data-user-streak-copy]");
const totalProgressNode = document.querySelector("[data-user-total-progress]");
const totalProgressBar = document.querySelector("[data-user-total-progress-bar]");
const planStatusNode = document.querySelector("[data-user-plan-status]");
const dashboardView = document.querySelector("[data-dashboard-view]");
const dashboardLink = document.querySelector("[data-dashboard-link]");
const companyAccountsLink = document.querySelector("[data-company-accounts-link]");
const planLink = document.querySelector("[data-plan-link]");
const companySeatPanel = document.querySelector("[data-company-seat-panel]");
const companySeatForm = document.querySelector("[data-company-seat-form]");
const companySeatList = document.querySelector("[data-company-seat-list]");
const companySeatCount = document.querySelector("[data-company-seat-count]");
const companySeatStatus = document.querySelector("[data-company-seat-status]");
const localRole =
  params.get("role") || window.localStorage.getItem("alza:selected-role") || "persona_discapacidad_auditiva";
const activeView = params.get("view") || "dashboard";
const companySeatSession = JSON.parse(window.localStorage.getItem("alza:company-seat-session") || "null");

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const resolveStorageUrl = async (supabase, url) => {
  if (!url || !url.startsWith("storage://")) return url || "";
  const value = url.replace("storage://", "");
  const [first, ...rest] = value.split("/");
  const bucket = first === "course-videos" || first === "course-assets" ? first : "course-videos";
  const path = first === "course-videos" || first === "course-assets" ? rest.join("/") : value;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl || "";
};

const setRoleLabel = (role) => {
  const roleLabel = roleLabels[role] || roleLabels.persona_discapacidad_auditiva;
  roleNodes.forEach((node) => {
    node.textContent = roleLabel;
  });
};

const requiresPlan = (role) => role === "persona_oyente" || role === "empresa";
const companySeatLimit = 10;

const getActiveSubscription = async (supabase, profileId) => {
  if (!supabase || !profileId) return null;
  const { data } = await supabase
    .from("subscriptions")
    .select("id,plan_id,status,created_at,plans(name,billing_period,seats)")
    .eq("profile_id", profileId)
    .in("status", ["mock_active", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
};

const getPeriodDays = (period) => (period === "year" ? 365 : period === "five_months" ? 150 : 30);

const formatPlanStatus = (role, subscription) => {
  if (companySeatSession) return "Acceso institucional bajo cuenta empresarial.";
  if (role === "persona_discapacidad_auditiva") return "Acceso inclusivo activo sin costo.";
  if (!subscription) return "Sin plan activo.";

  const plan = subscription.plans || {};
  const createdAt = new Date(subscription.created_at);
  const elapsed = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
  const days = Math.max(getPeriodDays(plan.billing_period) - elapsed, 0);
  const seats = plan.seats ? ` · ${plan.seats} cuentas` : "";
  return `${plan.name || "Plan activo"} · ${days} dias restantes${seats}`;
};

const startOfLocalDay = (value) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const calculateStreak = (completedRows = []) => {
  const completedDays = new Set(
    completedRows
      .map((item) => item.completed_at)
      .filter(Boolean)
      .map((date) => startOfLocalDay(date)),
  );

  if (!completedDays.size) return 0;

  const today = startOfLocalDay(Date.now());
  const yesterday = today - 86400000;
  let cursor = completedDays.has(today) ? today : completedDays.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;

  let streak = 0;
  while (completedDays.has(cursor)) {
    streak += 1;
    cursor -= 86400000;
  }
  return streak;
};

const renderUserStats = ({ courses = [], progressByCourse = {}, completedRows = [], role, subscription }) => {
  const courseCount = courses.length || 1;
  const totalProgress = Math.round(
    courses.reduce((sum, course) => sum + Number(progressByCourse[course.id] ?? course.progress ?? 0), 0) / courseCount,
  );
  const streak = calculateStreak(completedRows);
  const completedCount = completedRows.length;

  if (streakNode) streakNode.textContent = `${streak} ${streak === 1 ? "dia" : "dias"}`;
  if (streakCopyNode) {
    streakCopyNode.textContent = completedCount
      ? `${completedCount} lecciones completadas. Sigue avanzando desde tu ultimo bloque.`
      : "Completa una leccion para iniciar tu progreso.";
  }
  if (totalProgressNode) totalProgressNode.textContent = `${totalProgress}%`;
  if (totalProgressBar) totalProgressBar.style.width = `${totalProgress}%`;
  if (planStatusNode) planStatusNode.textContent = formatPlanStatus(role, subscription);
};

const renderCourses = (courses, progressByCourse = {}) => {
  if (!courseGrid) return;
  if (!courses.length) {
    courseGrid.innerHTML = `
      <article class="empty-course-state">
        <p class="eyebrow">Sin cursos publicados</p>
        <h3>Todavia no hay cursos visibles para tu perfil.</h3>
        <p>Cuando el admin publique contenido en Supabase, aparecera aqui automaticamente.</p>
      </article>
    `;
    return;
  }

  courseGrid.innerHTML = courses
    .map((course, index) => {
      const slug = course.slug || course.id;
      const courseText = `${course.slug || ""} ${course.title || ""} ${course.category || ""}`.toLowerCase();
      const accent = courseText.includes("excel") ? "excel" : courseText.includes("sena") || courseText.includes("lsn") ? "signs" : index % 2 === 0 ? "excel" : "signs";
      const progress = Math.round(progressByCourse[course.id] ?? course.progress ?? 0);
      return `
        <article class="learn-card ${accent}">
          <div class="learn-card-media">
            ${
              course.cover_url
                ? `<img src="${escapeHtml(course.cover_url)}" alt="${escapeHtml(course.title)}" />`
                : `<span>${accent === "excel" ? "XL" : "LSN"}</span>`
            }
          </div>
          <div class="learn-card-body">
            <p class="course-type">${course.category || "Curso"}</p>
            <h3>${escapeHtml(course.title)}</h3>
            <p>${escapeHtml(course.summary)}</p>
            <div class="progress-track" aria-label="Progreso ${progress}%">
              <span style="width: ${progress}%"></span>
            </div>
            <div class="course-meta">
              <span>${progress}%</span>
              <span>${course.lesson_count || course.lessons || 0} lecciones</span>
            </div>
            <a class="button secondary compact" href="./course.html?course=${slug}">Continuar</a>
          </div>
        </article>
      `;
    })
    .join("");
};

const setCompanySeatStatus = (message, type = "") => {
  if (!companySeatStatus) return;
  companySeatStatus.textContent = message;
  companySeatStatus.className = `auth-status ${type}`.trim();
};

const renderCompanySeats = (seats = []) => {
  if (companySeatCount) {
    companySeatCount.textContent = `${seats.length} / ${companySeatLimit} cuentas`;
  }

  if (!companySeatList) return;
  if (!seats.length) {
    companySeatList.innerHTML = `
      <article class="company-seat-empty">
        <p class="eyebrow">Sin cuentas creadas</p>
        <h3>Agrega colaboradores para darles acceso bajo tu institucion.</h3>
      </article>
    `;
    return;
  }

  companySeatList.innerHTML = seats
    .map(
      (seat) => `
        <article class="company-seat-row">
          <div>
            <strong>${escapeHtml(seat.full_name)}</strong>
            <span>${escapeHtml(seat.seat_label || "Cuenta empresarial")}</span>
            <span>${escapeHtml(seat.email || "")}</span>
          </div>
          <small>${new Date(seat.created_at).toLocaleDateString("es-NI")}</small>
        </article>
      `,
    )
    .join("");
};

const loadCompanySeats = async (supabase, userId) => {
  if (!companySeatPanel || !supabase || !userId) return [];
  const { data, error } = await supabase
    .from("company_seats")
    .select("id,full_name,email,seat_label,created_at")
    .eq("company_profile_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    setCompanySeatStatus(error.message, "error");
    return [];
  }

  renderCompanySeats(data || []);
  return data || [];
};

const setupCompanySeats = async (supabase, user, profile, role) => {
  if (!companySeatPanel) return;
  if (planLink) planLink.hidden = Boolean(companySeatSession);
  const isCompanyOwner = role === "empresa";
  if (companyAccountsLink) companyAccountsLink.hidden = !isCompanyOwner;
  if (!isCompanyOwner) {
    companySeatPanel.hidden = true;
    if (dashboardView) dashboardView.hidden = false;
    dashboardLink?.classList.add("active");
    companyAccountsLink?.classList.remove("active");
    return;
  }

  const showingAccounts = activeView === "cuentas";
  companySeatPanel.hidden = !showingAccounts;
  if (dashboardView) dashboardView.hidden = showingAccounts;
  dashboardLink?.classList.toggle("active", !showingAccounts);
  companyAccountsLink?.classList.toggle("active", showingAccounts);
  planLink?.classList.remove("active");

  if (!supabase || !user) return;

  let seats = await loadCompanySeats(supabase, user.id);

  companySeatForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(companySeatForm);
    const fullName = String(formData.get("seat_name") || "").trim();
    const email = String(formData.get("seat_email") || "").trim().toLowerCase();
    const password = String(formData.get("seat_password") || "");

    if (!fullName) {
      setCompanySeatStatus("Agrega el nombre del usuario.", "error");
      return;
    }

    if (password.length < 6) {
      setCompanySeatStatus("La contrasena debe tener al menos 6 caracteres.", "error");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCompanySeatStatus("Agrega un correo valido.", "error");
      return;
    }

    if (seats.length >= companySeatLimit) {
      setCompanySeatStatus("Este plan permite crear hasta 10 cuentas.", "error");
      return;
    }

    const organization = profile?.organization_name || "empresa";
    const seatLabel = `${fullName}-${organization}`;
    const { error } = await supabase.from("company_seats").insert({
      company_profile_id: user.id,
      full_name: fullName,
      email,
      seat_label: seatLabel,
      access_password: password,
    });

    if (error) {
      setCompanySeatStatus(error.message, "error");
      return;
    }

    companySeatForm.reset();
    setCompanySeatStatus("Cuenta creada bajo la institucion.", "success");
    seats = await loadCompanySeats(supabase, user.id);
  });
};

const init = async () => {
  const { supabase, user, profile } = await getSessionContext();
  const role = companySeatSession ? "empresa" : profile?.role || localRole;
  window.localStorage.setItem("alza:selected-role", role);
  setRoleLabel(role);

  if (userNameNode) {
    const name =
      companySeatSession?.seat_label ||
      profile?.full_name ||
      user?.user_metadata?.full_name ||
      user?.email?.split("@")[0] ||
      "usuario";
    userNameNode.textContent = name;
  }

  if (!supabase) {
    renderCourses(fallbackCourses);
    renderUserStats({
      courses: fallbackCourses,
      progressByCourse: Object.fromEntries(fallbackCourses.map((course) => [course.id, course.progress || 0])),
      role,
      subscription: null,
    });
    return;
  }

  if (!user && !companySeatSession) {
    window.location.href = "./auth.html";
    return;
  }

  const activeSubscription = companySeatSession ? null : await getActiveSubscription(supabase, user.id);
  if (!companySeatSession && requiresPlan(role) && !activeSubscription) {
    window.location.href = `./checkout.html?role=${role}`;
    return;
  }

  await setupCompanySeats(supabase, user, profile, companySeatSession ? "empresa_asiento" : role);

  const { data: dbCourses, error: coursesError } = await supabase
    .from("courses")
    .select("id,title,slug,summary,category,cover_url,published,audience")
    .eq("published", true)
    .order("created_at", { ascending: true });

  if (coursesError) {
    courseGrid.innerHTML = `
      <article class="empty-course-state">
        <p class="eyebrow">Error de cursos</p>
        <h3>No se pudieron cargar los cursos.</h3>
        <p>${escapeHtml(coursesError.message)}</p>
      </article>
    `;
    return;
  }

  const courses = (dbCourses || []).filter((course) => {
    if (!Array.isArray(course.audience) || !course.audience.length) return true;
    return course.audience.includes(role);
  });

  const lessonCounts = {};
  await Promise.all(
    courses.map(async (course) => {
      const { count } = await supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("course_id", course.id);
      lessonCounts[course.id] = count || 0;
    }),
  );

  let progressByCourse = {};
  const { data: enrollments } = companySeatSession
    ? { data: [] }
    : await supabase.from("enrollments").select("id,course_id,progress").eq("profile_id", user.id);
  progressByCourse = Object.fromEntries((enrollments || []).map((item) => [item.course_id, item.progress]));

  let completedRows = [];
  const enrollmentIds = (enrollments || []).map((item) => item.id);
  if (enrollmentIds.length) {
    const { data: progressRows } = await supabase
      .from("lesson_progress")
      .select("lesson_id,completed,completed_at")
      .in("enrollment_id", enrollmentIds)
      .eq("completed", true);
    completedRows = progressRows || [];
  }

  const coursesWithCounts = await Promise.all(
    courses.map(async (course) => ({
      ...course,
      cover_url: await resolveStorageUrl(supabase, course.cover_url),
      lesson_count: lessonCounts[course.id] || 0,
    })),
  );
  renderUserStats({ courses: coursesWithCounts, progressByCourse, completedRows, role, subscription: activeSubscription });
  renderCourses(coursesWithCounts, progressByCourse);
};

init();
