import { courses as fallbackCourses } from "./platform-data.js";
import { getSessionContext } from "./supabase-client.js";

const statsGrid = document.querySelector("[data-admin-stats]");
const courseList = document.querySelector("[data-admin-courses]");
const form = document.querySelector("[data-course-editor]");
const status = document.querySelector("[data-admin-status]");
const blockList = document.querySelector("[data-builder-blocks]");
const blockPanel = document.querySelector("[data-builder-panel]");
const newCourseButton = document.querySelector("[data-new-course]");
const closeEditorButton = document.querySelector("[data-close-editor]");
const addLessonButton = document.querySelector("[data-add-lesson]");
const addExamButton = document.querySelector("[data-add-exam]");
const editorTitle = document.querySelector("[data-editor-title]");
const courseSubmitButton = document.querySelector("[data-course-submit]");
const adminViews = document.querySelectorAll("[data-admin-view]");
const adminNavLinks = document.querySelectorAll("[data-admin-nav]");
const coverHelp = document.querySelector("[data-cover-help]");

let currentCourseId = null;
let supabaseClient = null;
let coursesCache = [];
let blocks = [];
let activeBlockId = null;
let currentCoverUrl = "";
let pendingCoverFile = null;

const videoBucket = "course-videos";
const assetBucket = "course-assets";
const allAudiences = ["persona_oyente", "persona_discapacidad_auditiva", "empresa"];
const statMeta = [
  { label: "usuarios registrados", tone: "orange" },
  { label: "aprendices activos", tone: "green" },
  { label: "empresas registradas", tone: "yellow" },
  { label: "cursos publicados", tone: "cream" },
  { label: "borradores privados", tone: "cream" },
  { label: "bloques creados", tone: "green" },
  { label: "progreso promedio", tone: "yellow" },
  { label: "planes activos", tone: "orange" },
];
const temporaryId = () => `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const isStoredId = (id) => id && !String(id).startsWith("local-");
const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isHtmlContent = (value = "") => /<\/?[a-z][\s\S]*>/i.test(String(value));
const formatPlainText = (value = "") =>
  escapeHtml(value)
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, (match) => "</p><p>".repeat(Math.max(1, match.length - 1)))
    .replace(/\n/g, "<br>");

const editableHtml = (value = "") => (isHtmlContent(value) ? value : `<p>${formatPlainText(value)}</p>`);

const statCard = (value, label, index) => {
  const meta = statMeta[index] || { tone: "cream" };
  return `
    <article class="admin-stat-card ${meta.tone}">
      <strong>${value}</strong>
      <span>${label}</span>
    </article>
  `;
};

const setStatus = (message, type = "") => {
  if (!status) return;
  status.textContent = message;
  status.className = `auth-status ${type}`.trim();
};

const showAdminView = (viewName) => {
  const normalizedView = viewName === "courses" ? "courses" : "dashboard";
  adminViews.forEach((view) => {
    view.hidden = view.dataset.adminView !== normalizedView;
  });
  adminNavLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.adminNav === normalizedView);
  });
};

const openEditor = () => {
  if (!form) return;
  showAdminView("courses");
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
};

const closeEditor = () => {
  if (!form) return;
  form.hidden = true;
  setStatus("");
};

const defaultLesson = () => ({
  id: temporaryId(),
  content_type: "lesson",
  title: "Nueva leccion",
  video_url: "",
  transcript: "",
  reading_content: "",
  pending_file: null,
  lesson_attachments: [],
  pending_attachments: [],
});

const defaultExam = () => ({
  id: temporaryId(),
  content_type: "exam",
  title: "Chequeo rapido",
  reading_content: "",
  exam_questions: [
    {
      id: temporaryId(),
      type: "multiple_choice",
      prompt: "Pregunta del examen",
      options: ["Opcion A", "Opcion B", "Opcion C"],
      answer: "Opcion A",
    },
  ],
});

const normalizeExamQuestions = (lesson) => {
  if (Array.isArray(lesson.exam_questions) && lesson.exam_questions.length) {
    return lesson.exam_questions.map((question) => ({
      id: question.id || temporaryId(),
      type: question.type === "true_false" ? "true_false" : "multiple_choice",
      prompt: question.prompt || "",
      options:
        question.type === "true_false"
          ? ["Verdadero", "Falso"]
          : Array.isArray(question.options) && question.options.length
            ? question.options
            : ["", ""],
      answer: question.answer || "",
    }));
  }

  return [
    {
      id: temporaryId(),
      type: "multiple_choice",
      prompt: lesson.exam_question || "",
      options: Array.isArray(lesson.exam_options) && lesson.exam_options.length ? lesson.exam_options : ["", ""],
      answer: lesson.exam_answer || "",
    },
  ];
};

const normalizeBlock = (lesson) => ({
  id: lesson.id || temporaryId(),
  content_type: lesson.content_type || "lesson",
  title: lesson.title || "Bloque sin titulo",
  video_url: lesson.video_url || "",
  transcript: lesson.transcript || "",
  reading_content: lesson.reading_content || "",
  exam_question: lesson.exam_question || "",
  exam_options: Array.isArray(lesson.exam_options) ? lesson.exam_options : ["", "", ""],
  exam_answer: lesson.exam_answer || "",
  exam_questions: normalizeExamQuestions(lesson),
  lesson_attachments: Array.isArray(lesson.lesson_attachments) ? lesson.lesson_attachments : [],
  pending_file: null,
  pending_attachments: [],
});

const getActiveBlock = () => blocks.find((block) => block.id === activeBlockId) || blocks[0] || null;

const updateActiveBlock = (patch) => {
  const target = getActiveBlock();
  if (!target) return;
  blocks = blocks.map((block) => (block.id === target.id ? { ...block, ...patch } : block));
  renderBlocks();
};

const patchActiveBlockSilently = (patch) => {
  const target = getActiveBlock();
  if (!target) return;
  blocks = blocks.map((block) => (block.id === target.id ? { ...block, ...patch } : block));
};

const getAudienceSelection = () => {
  if (!form) return allAudiences;
  const selected = Array.from(form.querySelectorAll("[name='audience_role']:checked")).map((input) => input.value);
  return selected;
};

const setAudienceSelection = (audience = allAudiences) => {
  if (!form) return;
  const values = Array.isArray(audience) && audience.length ? audience : allAudiences;
  const allSelected = allAudiences.every((role) => values.includes(role));
  form.elements.audience_all.checked = allSelected;
  form.querySelectorAll("[name='audience_role']").forEach((input) => {
    input.checked = values.includes(input.value);
  });
};

const setEditorMode = (mode, courseTitle = "") => {
  if (editorTitle) editorTitle.textContent = mode === "edit" ? "Editar curso" : "Curso nuevo";
  if (courseSubmitButton) courseSubmitButton.textContent = mode === "edit" ? "Guardar cambios" : "Crear curso";
  if (form) form.dataset.mode = mode;
  if (courseTitle) setStatus(`Editando ${courseTitle}.`, "success");
};

const resetForm = () => {
  currentCourseId = null;
  currentCoverUrl = "";
  pendingCoverFile = null;
  activeBlockId = null;
  blocks = [defaultLesson()];
  if (form) {
    form.reset();
    form.elements.published.checked = true;
    if (coverHelp) coverHelp.textContent = "Recomendado: 1200x800 JPG, PNG o WebP.";
    setAudienceSelection(allAudiences);
    delete form.dataset.courseId;
  }
  setEditorMode("create");
  setStatus("");
  activeBlockId = blocks[0].id;
  renderBlocks();
  renderPanel();
  openEditor();
};

const renderStats = async (supabase) => {
  if (!statsGrid) return;

  if (!supabase) {
    statsGrid.innerHTML = `
      ${statMeta.map((item, index) => statCard("--", item.label, index)).join("")}
    `;
    return;
  }

  const [
    { count: users, error: usersError },
    { count: companies, error: companiesError },
    { count: activePlans, error: plansError },
    { count: publishedCourses, error: coursesError },
    { count: draftCourses, error: draftCoursesError },
    { count: lessons, error: lessonsError },
    { data: enrollments, error: enrollmentsError },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "empresa"),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["mock_active", "active"]),
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("published", true),
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("published", false),
    supabase.from("lessons").select("id", { count: "exact", head: true }),
    supabase.from("enrollments").select("profile_id,progress"),
  ]);

  const firstError =
    usersError || companiesError || plansError || coursesError || draftCoursesError || lessonsError || enrollmentsError;
  if (firstError) {
    setStatus(firstError.message, "error");
  }

  const progressValues = enrollments || [];
  const activeLearners = new Set(progressValues.map((item) => item.profile_id)).size;
  const completionRate = progressValues.length
    ? `${Math.round(progressValues.reduce((sum, item) => sum + Number(item.progress || 0), 0) / progressValues.length)}%`
    : "0%";

  statsGrid.innerHTML = `
    ${statCard(users || 0, "usuarios registrados", 0)}
    ${statCard(activeLearners, "aprendices activos", 1)}
    ${statCard(companies || 0, "empresas registradas", 2)}
    ${statCard(publishedCourses || 0, "cursos publicados", 3)}
    ${statCard(draftCourses || 0, "borradores privados", 4)}
    ${statCard(lessons || 0, "bloques creados", 5)}
    ${statCard(completionRate, "progreso promedio", 6)}
    ${statCard(activePlans || 0, "planes activos", 7)}
  `;
};

const renderCourses = (courses) => {
  coursesCache = courses;
  if (!courseList) return;
  if (!courses.length) {
    courseList.innerHTML = `
      <article class="empty-course-state">
        <p class="eyebrow">Sin cursos</p>
        <h3>No hay cursos publicados ni borradores.</h3>
        <p>Crea el primer curso desde el boton Nuevo curso.</p>
      </article>
    `;
    return;
  }

  courseList.innerHTML = courses
    .map(
      (course) => `
        <article class="admin-course-row">
          <div>
            <p class="course-type">${course.category || "Curso"}</p>
            <h3>${escapeHtml(course.title)}</h3>
            <span>${course.published ? "Visible para usuarios" : "Borrador privado"} ? ${course.lesson_count || 0} bloques</span>
          </div>
          <div class="admin-course-actions">
            <button type="button" data-edit-course="${course.id}">Editar</button>
            <button class="danger-button compact-danger" type="button" data-delete-course="${course.id}">Eliminar</button>
          </div>
        </article>
      `,
    )
    .join("");

  document.querySelectorAll("[data-edit-course]").forEach((button) => {
    button.addEventListener("click", () => loadCourseIntoEditor(button.dataset.editCourse));
  });

  document.querySelectorAll("[data-delete-course]").forEach((button) => {
    button.addEventListener("click", () => deleteCourse(button.dataset.deleteCourse));
  });
};

const renderBlocks = () => {
  if (!blockList) return;
  blockList.innerHTML = blocks
    .map(
      (block, index) => `
        <article class="builder-block-row ${block.id === activeBlockId ? "active" : ""}">
          <button type="button" data-block-id="${block.id}">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <strong>${escapeHtml(block.title || "Sin titulo")}</strong>
            <small>${block.content_type === "exam" ? "Examen" : "Leccion"}</small>
          </button>
          <div class="block-order-actions" aria-label="Orden del bloque">
            <button type="button" data-move-block="${index}:up" ${index === 0 ? "disabled" : ""}>Subir</button>
            <button type="button" data-move-block="${index}:down" ${index === blocks.length - 1 ? "disabled" : ""}>Bajar</button>
          </div>
        </article>
      `,
    )
    .join("");

  document.querySelectorAll("[data-block-id]").forEach((button) => {
    button.addEventListener("click", () => {
      activeBlockId = button.dataset.blockId;
      renderBlocks();
      renderPanel();
    });
  });

  document.querySelectorAll("[data-move-block]").forEach((button) => {
    button.addEventListener("click", () => {
      const [rawIndex, direction] = button.dataset.moveBlock.split(":");
      const index = Number(rawIndex);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= blocks.length) return;
      const nextBlocks = [...blocks];
      [nextBlocks[index], nextBlocks[targetIndex]] = [nextBlocks[targetIndex], nextBlocks[index]];
      blocks = nextBlocks;
      activeBlockId = blocks[targetIndex].id;
      renderBlocks();
      renderPanel();
    });
  });
};

const insertBlockAfterActive = (block) => {
  const activeIndex = blocks.findIndex((item) => item.id === activeBlockId);
  const insertIndex = activeIndex >= 0 ? activeIndex + 1 : blocks.length;
  blocks = [...blocks.slice(0, insertIndex), block, ...blocks.slice(insertIndex)];
  activeBlockId = block.id;
  renderBlocks();
  renderPanel();
};

const renderLessonPanel = (block) => `
  <div class="builder-panel-head">
    <div>
      <p class="eyebrow">Leccion</p>
      <h3>${escapeHtml(block.title || "Nueva leccion")}</h3>
    </div>
    <button class="danger-button compact-danger" type="button" data-delete-block>Eliminar</button>
  </div>
  <label>
    Titulo
    <input name="block_title" type="text" value="${escapeHtml(block.title || "")}" placeholder="Ej. Introduccion" />
  </label>
  <div class="content-switch" role="group" aria-label="Tipo de contenido">
    <label><input type="checkbox" name="has_video" ${block.video_url || block.pending_file ? "checked" : ""} /> Video</label>
    <label><input type="checkbox" name="has_text" ${block.reading_content || block.transcript ? "checked" : ""} /> Texto</label>
  </div>
  <label>
    Archivo de video local
    <input name="video_file" type="file" accept="video/mp4,video/webm,video/quicktime,video/*" />
    <small class="field-help">${
      block.pending_file
        ? block.pending_file.name
        : block.video_url
          ? "Video guardado. Selecciona otro archivo para reemplazarlo."
          : "Recomendado: MP4 H.264/AAC. Tambien acepta WebM o MOV."
    }</small>
  </label>
  <label>
    Archivos descargables
    <input name="attachment_files" type="file" multiple />
    <small class="field-help">PDF, Excel, Word, imagenes, ZIP o cualquier material de apoyo.</small>
  </label>
  <div class="attachment-editor-list">
    ${[...(block.lesson_attachments || []), ...(block.pending_attachments || []).map((file, index) => ({ name: file.name, pending: true, index }))]
      .map(
        (attachment, index) => `
          <article class="attachment-editor-row">
            <span>${escapeHtml(attachment.name || `Archivo ${index + 1}`)}</span>
            <button type="button" data-remove-attachment="${attachment.pending ? `pending:${attachment.index}` : `saved:${index}`}">Quitar</button>
          </article>
        `,
      )
      .join("")}
  </div>
  <label>
    Texto de la leccion
    <div class="rich-toolbar" aria-label="Formato de texto">
      <button type="button" data-format-command="bold">B</button>
      <button type="button" data-format-command="italic">I</button>
      <button type="button" data-format-command="insertUnorderedList">Lista</button>
      <button type="button" data-format-command="formatBlock:p">P</button>
    </div>
    <div class="rich-editor" contenteditable="true" data-rich-editor role="textbox" aria-multiline="true">
      ${editableHtml(block.reading_content || block.transcript || "")}
    </div>
  </label>
`;

const renderExamPanel = (block) => {
  const questions = block.exam_questions?.length ? block.exam_questions : defaultExam().exam_questions;
  return `
    <div class="builder-panel-head">
      <div>
        <p class="eyebrow">Examen</p>
        <h3>${escapeHtml(block.title || "Chequeo rapido")}</h3>
      </div>
      <button class="danger-button compact-danger" type="button" data-delete-block>Eliminar</button>
    </div>
    <label>
      Titulo
      <input name="block_title" type="text" value="${escapeHtml(block.title || "")}" placeholder="Ej. Examen modulo 1" />
    </label>
    <label>
      Instrucciones
      <textarea name="reading_content" rows="3" placeholder="Texto breve antes de responder">${escapeHtml(block.reading_content || "")}</textarea>
    </label>
    <div class="exam-builder-head">
      <strong>${questions.length} pregunta${questions.length === 1 ? "" : "s"}</strong>
      <button class="ghost-button" type="button" data-add-question>+ Pregunta</button>
    </div>
    <div class="exam-question-list">
      ${questions
        .map(
          (question, questionIndex) => `
            <article class="exam-question-card" data-question-index="${questionIndex}">
              <div class="exam-question-actions">
                <span>Pregunta ${questionIndex + 1}</span>
                <button class="danger-button compact-danger" type="button" data-remove-question="${questionIndex}" ${
                  questions.length === 1 ? "disabled" : ""
                }>Eliminar</button>
              </div>
              <label>
                Texto de la pregunta
                <textarea name="question_prompt_${questionIndex}" rows="2" placeholder="Escribe la pregunta">${escapeHtml(
                  question.prompt || "",
                )}</textarea>
              </label>
              <div class="question-type-row">
                <label>
                  Tipo
                  <select name="question_type_${questionIndex}">
                    <option value="multiple_choice" ${question.type !== "true_false" ? "selected" : ""}>Opcion multiple</option>
                    <option value="true_false" ${question.type === "true_false" ? "selected" : ""}>Verdadero / falso</option>
                  </select>
                </label>
                ${
                  question.type === "true_false"
                    ? ""
                    : `<button class="ghost-button" type="button" data-add-option="${questionIndex}">+ Opcion</button>`
                }
              </div>
              <div class="exam-choice-list">
                ${(question.type === "true_false" ? ["Verdadero", "Falso"] : question.options || ["", ""])
                  .map(
                    (option, optionIndex) => `
                      <label class="exam-choice-row">
                        <input
                          type="radio"
                          name="question_answer_${questionIndex}"
                          value="${optionIndex}"
                          ${(question.answer || option) === option ? "checked" : ""}
                        />
                        <input
                          name="question_option_${questionIndex}_${optionIndex}"
                          type="text"
                          value="${escapeHtml(option || "")}"
                          placeholder="Opcion ${optionIndex + 1}"
                          ${question.type === "true_false" ? "readonly" : ""}
                        />
                        ${
                          question.type === "true_false" || (question.options || []).length <= 2
                            ? ""
                            : `<button class="ghost-button icon-button" type="button" data-remove-option="${questionIndex}:${optionIndex}" aria-label="Eliminar opcion">x</button>`
                        }
                      </label>
                    `,
                  )
                  .join("")}
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
};

const bindPanelInputs = () => {
  const block = getActiveBlock();
  if (!blockPanel || !block) return;

  blockPanel.querySelector("[data-delete-block]")?.addEventListener("click", () => {
    blocks = blocks.filter((item) => item.id !== block.id);
    activeBlockId = blocks[0]?.id || null;
    renderBlocks();
    renderPanel();
  });

  blockPanel.querySelector("[name='block_title']")?.addEventListener("input", (event) => {
    patchActiveBlockSilently({ title: event.target.value });
    renderBlocks();
  });

  blockPanel.querySelector("[name='video_file']")?.addEventListener("change", (event) => {
    updateActiveBlock({ pending_file: event.target.files?.[0] || null });
    renderPanel();
  });

  blockPanel.querySelector("[name='attachment_files']")?.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    patchActiveBlockSilently({ pending_attachments: [...(block.pending_attachments || []), ...files] });
    renderPanel();
  });

  blockPanel.querySelectorAll("[data-remove-attachment]").forEach((button) => {
    button.addEventListener("click", () => {
      const [type, rawIndex] = button.dataset.removeAttachment.split(":");
      const index = Number(rawIndex);
      const current = getActiveBlock();
      if (type === "pending") {
        const pending = [...(current.pending_attachments || [])];
        pending.splice(index, 1);
        patchActiveBlockSilently({ pending_attachments: pending });
      } else {
        const saved = [...(current.lesson_attachments || [])];
        saved.splice(index, 1);
        patchActiveBlockSilently({ lesson_attachments: saved });
      }
      renderPanel();
    });
  });

  blockPanel.querySelector("[name='reading_content']")?.addEventListener("input", (event) => {
    patchActiveBlockSilently({ reading_content: event.target.value, transcript: event.target.value });
  });

  blockPanel.querySelectorAll("[data-format-command]").forEach((button) => {
    button.addEventListener("click", () => {
      const [command, value] = button.dataset.formatCommand.split(":");
      document.execCommand(command, false, value || null);
      const editor = blockPanel.querySelector("[data-rich-editor]");
      if (editor) {
        editor.focus();
        patchActiveBlockSilently({ reading_content: editor.innerHTML, transcript: editor.innerHTML });
      }
    });
  });

  blockPanel.querySelector("[data-rich-editor]")?.addEventListener("input", (event) => {
    patchActiveBlockSilently({ reading_content: event.currentTarget.innerHTML, transcript: event.currentTarget.innerHTML });
  });

  const updateQuestion = (questionIndex, patch, shouldRender = false) => {
    const current = getActiveBlock();
    const questions = [...(current.exam_questions || defaultExam().exam_questions)];
    questions[questionIndex] = { ...questions[questionIndex], ...patch };
    patchActiveBlockSilently({ exam_questions: questions });
    if (shouldRender) renderPanel();
  };

  blockPanel.querySelector("[data-add-question]")?.addEventListener("click", () => {
    const current = getActiveBlock();
    patchActiveBlockSilently({
      exam_questions: [
        ...(current.exam_questions || []),
        {
          id: temporaryId(),
          type: "multiple_choice",
          prompt: "",
          options: ["", ""],
          answer: "",
        },
      ],
    });
    renderPanel();
  });

  blockPanel.querySelectorAll("[data-remove-question]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = getActiveBlock();
      const questions = [...(current.exam_questions || [])];
      questions.splice(Number(button.dataset.removeQuestion), 1);
      patchActiveBlockSilently({ exam_questions: questions.length ? questions : defaultExam().exam_questions });
      renderPanel();
    });
  });

  blockPanel.querySelectorAll("[name^='question_prompt_']").forEach((input) => {
    input.addEventListener("input", () => {
      updateQuestion(Number(input.name.replace("question_prompt_", "")), { prompt: input.value });
    });
  });

  blockPanel.querySelectorAll("[name^='question_type_']").forEach((select) => {
    select.addEventListener("change", () => {
      const questionIndex = Number(select.name.replace("question_type_", ""));
      const options = select.value === "true_false" ? ["Verdadero", "Falso"] : ["", ""];
      updateQuestion(questionIndex, { type: select.value, options, answer: options[0] }, true);
    });
  });

  blockPanel.querySelectorAll("[name^='question_option_']").forEach((input) => {
    input.addEventListener("input", () => {
      const [, , questionIndex, optionIndex] = input.name.split("_");
      const current = getActiveBlock();
      const question = current.exam_questions[Number(questionIndex)];
      const options = [...(question.options || [])];
      const oldValue = options[Number(optionIndex)];
      options[Number(optionIndex)] = input.value;
      updateQuestion(Number(questionIndex), {
        options,
        answer: question.answer === oldValue ? input.value : question.answer,
      });
    });
  });

  blockPanel.querySelectorAll("[name^='question_answer_']").forEach((input) => {
    input.addEventListener("change", () => {
      const questionIndex = Number(input.name.replace("question_answer_", ""));
      const current = getActiveBlock();
      const question = current.exam_questions[questionIndex];
      const answer = (question.options || [])[Number(input.value)] || "";
      updateQuestion(questionIndex, { answer });
    });
  });

  blockPanel.querySelectorAll("[data-add-option]").forEach((button) => {
    button.addEventListener("click", () => {
      const questionIndex = Number(button.dataset.addOption);
      const current = getActiveBlock();
      const question = current.exam_questions[questionIndex];
      updateQuestion(questionIndex, { options: [...(question.options || []), ""] }, true);
    });
  });

  blockPanel.querySelectorAll("[data-remove-option]").forEach((button) => {
    button.addEventListener("click", () => {
      const [questionIndex, optionIndex] = button.dataset.removeOption.split(":").map(Number);
      const current = getActiveBlock();
      const question = current.exam_questions[questionIndex];
      const options = [...(question.options || [])];
      const removed = options.splice(optionIndex, 1)[0];
      updateQuestion(
        questionIndex,
        {
          options,
          answer: question.answer === removed ? options[0] || "" : question.answer,
        },
        true,
      );
    });
  });
};

const renderPanel = () => {
  if (!blockPanel) return;
  const block = getActiveBlock();
  if (!block) {
    blockPanel.innerHTML = `<p class="empty-builder">Agrega una leccion o examen para empezar.</p>`;
    return;
  }

  blockPanel.innerHTML = block.content_type === "exam" ? renderExamPanel(block) : renderLessonPanel(block);
  bindPanelInputs();
};

const loadCourses = async (supabase) => {
  if (!supabase) {
    renderCourses(fallbackCourses.map((course) => ({ ...course, slug: course.id, published: true, isFallback: true })));
    return;
  }

  const { data, error } = await supabase
    .from("courses")
    .select("id,title,slug,summary,category,cover_url,published,audience,lessons(id)")
    .order("created_at", { ascending: true });

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  renderCourses((data || []).map((course) => ({ ...course, lesson_count: course.lessons?.length || 0 })));
};

const deleteCourse = async (courseId) => {
  const course = coursesCache.find((item) => String(item.id) === String(courseId));
  if (!course) return;
  if (!supabaseClient || !isStoredId(course.id)) {
    setStatus("Ese curso no esta guardado en Supabase.", "error");
    return;
  }

  const confirmed = window.confirm(`Eliminar "${course.title}" y todo su contenido? Esta acción no se puede deshacer.`);
  if (!confirmed) return;

  const { error } = await supabaseClient.from("courses").delete().eq("id", course.id);
  if (error) {
    setStatus(`No se pudo eliminar el curso: ${error.message}`, "error");
    return;
  }

  if (String(currentCourseId) === String(course.id)) closeEditor();
  setStatus("Curso eliminado.", "success");
  await renderStats(supabaseClient);
  await loadCourses(supabaseClient);
};

const loadCourseIntoEditor = async (courseId) => {
  let course = coursesCache.find((item) => String(item.id) === String(courseId));
  if (!course && supabaseClient && isStoredId(courseId)) {
    const { data, error } = await supabaseClient
      .from("courses")
      .select("id,title,slug,summary,category,cover_url,published,audience")
      .eq("id", courseId)
      .maybeSingle();
    if (error) {
      setStatus(error.message, "error");
      return;
    }
    course = data;
  }
  if (!course || !form) return;

  openEditor();
  currentCourseId = course.id;
  form.dataset.courseId = course.id;
  setEditorMode("edit", course.title);
  form.elements.title.value = course.title || "";
  form.elements.summary.value = course.summary || "";
  form.elements.category.value = course.category || "";
  form.elements.published.checked = Boolean(course.published);
  currentCoverUrl = course.cover_url || "";
  pendingCoverFile = null;
  form.elements.cover_file.value = "";
  if (coverHelp) coverHelp.textContent = currentCoverUrl ? "Foto actual guardada. Selecciona otra para reemplazarla." : "Recomendado: 1200x800 JPG, PNG o WebP.";
  setAudienceSelection(course.audience);

  if (!supabaseClient || !isStoredId(course.id)) {
    blocks = (course.modules || ["Introduccion"]).map((title) => ({ ...defaultLesson(), title }));
    activeBlockId = blocks[0]?.id || null;
    renderBlocks();
    renderPanel();
    return;
  }

  const { data, error } = await supabaseClient
    .from("lessons")
    .select("id,title,position,content_type,video_url,transcript,reading_content,lesson_attachments,exam_question,exam_options,exam_answer,exam_questions")
    .eq("course_id", course.id)
    .order("position", { ascending: true });

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  blocks = data?.length ? data.map(normalizeBlock) : [defaultLesson()];
  activeBlockId = blocks[0]?.id || null;
  renderBlocks();
  renderPanel();
  setEditorMode("edit", course.title);
};

const uploadVideoIfNeeded = async (courseId, block, index) => {
  if (!block.pending_file) return block.video_url?.startsWith("storage://") ? block.video_url : null;

  const extension = block.pending_file.name.includes(".") ? block.pending_file.name.split(".").pop() : "mp4";
  const path = `${courseId}/${slugify(block.title || `leccion-${index + 1}`)}-${Date.now()}.${extension}`;
  const { error } = await supabaseClient.storage.from(videoBucket).upload(path, block.pending_file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) throw error;
  return `storage://${videoBucket}/${path}`;
};

const uploadCoverIfNeeded = async (courseId, title) => {
  if (!pendingCoverFile) return currentCoverUrl || null;
  const extension = pendingCoverFile.name.includes(".") ? pendingCoverFile.name.split(".").pop() : "jpg";
  const path = `covers/${courseId}/${slugify(title || "curso")}-${Date.now()}.${extension}`;
  const { error } = await supabaseClient.storage.from(assetBucket).upload(path, pendingCoverFile, {
    cacheControl: "3600",
    upsert: true,
    contentType: pendingCoverFile.type || "image/jpeg",
  });
  if (error) throw error;
  return `storage://${assetBucket}/${path}`;
};

const uploadAttachmentsIfNeeded = async (courseId, block, index) => {
  const existing = block.lesson_attachments || [];
  const pending = block.pending_attachments || [];
  if (!pending.length) return existing;

  const uploaded = [];
  for (const file of pending) {
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "file";
    const path = `attachments/${courseId}/${String(index + 1).padStart(2, "0")}-${slugify(block.title || "leccion")}-${Date.now()}-${slugify(
      file.name.replace(/\.[^.]+$/, ""),
    )}.${extension}`;
    const { error } = await supabaseClient.storage.from(assetBucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
    if (error) throw error;
    uploaded.push({
      name: file.name,
      url: `storage://${assetBucket}/${path}`,
      type: file.type || "application/octet-stream",
      size: file.size || 0,
    });
  }

  block.pending_attachments = [];
  block.lesson_attachments = [...existing, ...uploaded];
  return block.lesson_attachments;
};

const validateBlocks = () => {
  for (const [index, block] of blocks.entries()) {
    if (block.content_type !== "exam") continue;
    const questions = block.exam_questions || [];
    if (!questions.length) return `El examen ${index + 1} necesita al menos una pregunta.`;
    for (const [questionIndex, question] of questions.entries()) {
      const options = question.type === "true_false" ? ["Verdadero", "Falso"] : (question.options || []).filter(Boolean);
      if (!question.prompt?.trim()) return `La pregunta ${questionIndex + 1} del examen ${index + 1} esta vacía.`;
      if (options.length < 2) return `La pregunta ${questionIndex + 1} necesita al menos dos opciones.`;
      if (!question.answer || !options.includes(question.answer)) {
        return `Selecciona la respuesta correcta en la pregunta ${questionIndex + 1}.`;
      }
    }
  }
  return "";
};

const saveBlocks = async (courseId) => {
  const { data: existing } = await supabaseClient.from("lessons").select("id").eq("course_id", courseId);
  const existingIds = new Set((existing || []).map((lesson) => lesson.id));
  const savedIds = new Set();

  for (const [index, block] of blocks.entries()) {
    const videoUrl = block.content_type === "lesson" ? await uploadVideoIfNeeded(courseId, block, index) : null;
    const attachments =
      block.content_type === "lesson" ? await uploadAttachmentsIfNeeded(courseId, block, index) : [];
    const payload = {
      course_id: courseId,
      title: block.title?.trim() || (block.content_type === "exam" ? "Examen" : "Leccion"),
      position: index + 1,
      content_type: block.content_type || "lesson",
      video_url: videoUrl,
      transcript: block.content_type === "lesson" ? block.transcript || block.reading_content || null : null,
      reading_content: block.reading_content || null,
      lesson_attachments: block.content_type === "lesson" ? attachments : null,
      exam_question: block.content_type === "exam" ? block.exam_question || null : null,
      exam_options: block.content_type === "exam" ? (block.exam_options || []).filter(Boolean) : null,
      exam_answer: block.content_type === "exam" ? block.exam_answer || block.exam_options?.[0] || null : null,
      exam_questions:
        block.content_type === "exam"
          ? (block.exam_questions || []).map((question) => ({
              id: question.id || temporaryId(),
              type: question.type === "true_false" ? "true_false" : "multiple_choice",
              prompt: question.prompt || "",
              options:
                question.type === "true_false"
                  ? ["Verdadero", "Falso"]
                  : (question.options || []).map((option) => option.trim()).filter(Boolean),
              answer: question.answer || question.options?.find(Boolean) || "",
            }))
          : null,
    };

    if (isStoredId(block.id)) {
      const { data, error } = await supabaseClient
        .from("lessons")
        .update(payload)
        .eq("id", block.id)
        .select("id")
        .single();
      if (error) throw error;
      savedIds.add(data.id);
    } else {
      const { data, error } = await supabaseClient.from("lessons").insert(payload).select("id").single();
      if (error) throw error;
      savedIds.add(data.id);
      block.id = data.id;
    }
  }

  const removeIds = [...existingIds].filter((id) => !savedIds.has(id));
  if (removeIds.length) {
    const { error } = await supabaseClient.from("lessons").delete().in("id", removeIds);
    if (error) throw error;
  }
};

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) {
    setStatus("No hay conexion con Supabase.", "error");
    return;
  }

  const title = form.elements.title.value.trim();
  const slug = slugify(title);
  const audience = getAudienceSelection();
  if (!audience.length) {
    setStatus("Selecciona al menos un portal para publicar el curso.", "error");
    return;
  }
  const blockError = validateBlocks();
  if (blockError) {
    setStatus(blockError, "error");
    return;
  }
  const payload = {
    title,
    slug,
    summary: form.elements.summary.value.trim(),
    category: form.elements.category.value.trim() || "General",
    audience,
    published: form.elements.published.checked,
  };

  const editingCourseId = currentCourseId || form.dataset.courseId || "";
  const query = editingCourseId
    ? supabaseClient.from("courses").update(payload).eq("id", editingCourseId).select("id").single()
    : supabaseClient.from("courses").insert(payload).select("id").single();

  const { data: course, error } = await query;
  if (error) {
    setStatus(error.message, "error");
    return;
  }

  try {
    currentCourseId = course.id;
    const coverUrl = await uploadCoverIfNeeded(course.id, title);
    if (coverUrl !== currentCoverUrl) {
      const { error: coverError } = await supabaseClient.from("courses").update({ cover_url: coverUrl }).eq("id", course.id);
      if (coverError) throw coverError;
      currentCoverUrl = coverUrl || "";
      pendingCoverFile = null;
    }
    await saveBlocks(course.id);
  } catch (blockError) {
    setStatus(`No se pudo guardar el contenido: ${blockError.message}`, "error");
    return;
  }

  setStatus("Curso guardado en Supabase.", "success");
  await loadCourses(supabaseClient);
});

newCourseButton?.addEventListener("click", resetForm);
closeEditorButton?.addEventListener("click", closeEditor);
adminNavLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showAdminView(link.dataset.adminNav);
    window.history.replaceState(null, "", link.getAttribute("href"));
  });
});
form?.elements.audience_all?.addEventListener("change", (event) => {
  if (event.target.checked) setAudienceSelection(allAudiences);
});
form?.elements.cover_file?.addEventListener("change", (event) => {
  pendingCoverFile = event.target.files?.[0] || null;
  if (coverHelp) coverHelp.textContent = pendingCoverFile ? pendingCoverFile.name : "Recomendado: 1200x800 JPG, PNG o WebP.";
});
form?.querySelectorAll("[name='audience_role']").forEach((input) => {
  input.addEventListener("change", () => {
    const selected = getAudienceSelection();
    form.elements.audience_all.checked = allAudiences.every((role) => selected.includes(role));
  });
});
addLessonButton?.addEventListener("click", () => {
  insertBlockAfterActive(defaultLesson());
});
addExamButton?.addEventListener("click", () => {
  insertBlockAfterActive(defaultExam());
});

const init = async () => {
  const { supabase, profile } = await getSessionContext();
  supabaseClient = supabase;

  if (profile && profile.role !== "super_admin") {
    window.location.href = `./platform.html?role=${profile.role}`;
    return;
  }

  blocks = [defaultLesson()];
  activeBlockId = blocks[0].id;
  renderBlocks();
  renderPanel();
  closeEditor();
  showAdminView(window.location.hash === "#cursos" ? "courses" : "dashboard");
  await renderStats(supabase);
  await loadCourses(supabase);
};

init();
