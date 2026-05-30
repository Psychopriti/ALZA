export const roleLabels = {
  empresa: "Empresas",
  persona_discapacidad_auditiva: "Personas con discapacidad auditiva",
  persona_oyente: "Personas oyentes",
  super_admin: "Super user",
};

export const courses = [];

export const plans = {
  persona_discapacidad_auditiva: [
    {
      id: "free-access",
      name: "Acceso inclusivo",
      price: "C$0",
      cadence: "gratis",
      detail: "Los cursos disponibles sin costo.",
    },
  ],
  persona_oyente: [
    {
      id: "listener-5-months",
      name: "Oyente individual",
      price: "C$2500",
      cadence: "por 5 meses",
      detail: "Acceso individual a cursos, lecciones, examenes y progreso por 5 meses.",
    },
  ],
  empresa: [
    {
      id: "company-10-accounts",
      name: "Empresa",
      price: "C$8700",
      cadence: "por 5 meses",
      detail: "Incluye hasta 10 cuentas bajo la sombrilla de la institucion.",
      badge: "10 cuentas",
    },
  ],
};

export const mockStats = {
  users: 126,
  activeLearners: 84,
  companies: 12,
  completionRate: "61%",
};
