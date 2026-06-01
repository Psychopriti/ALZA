import { courses as fallbackCourses } from "./platform-data.js";
import { getSessionContext } from "./supabase-client.js";

const params = new URLSearchParams(window.location.search);
const courseSlug = params.get("course") || "";
const titleNodes = document.querySelectorAll("[data-course-title]");
const modules = document.querySelector("[data-course-modules]");
const progress = document.querySelector("[data-course-progress]");
const video = document.querySelector("[data-lesson-video]");
const videoFrame = document.querySelector("[data-lesson-video-frame]");
const videoPlaceholder = document.querySelector("[data-video-placeholder]");
const youtubePlayer = document.querySelector("[data-youtube-player]");
const lessonContent = document.querySelector("[data-lesson-content]");
const examPlayer = document.querySelector("[data-exam-player]");
const completeButton = document.querySelector("[data-complete-lesson]");
const companySeatSession = JSON.parse(window.localStorage.getItem("alza:company-seat-session") || "null");

let activeSupabase = null;
let activeUser = null;
let activeCourse = null;
let activeEnrollment = null;
let lessons = [];
let completedLessonIds = new Set();
let activeLessonId = null;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const resolveVideoUrl = async (supabase, videoUrl) => {
  if (!videoUrl) return "";
  if (!videoUrl.startsWith("storage://")) return videoUrl;

  const { bucket, path } = parseStorageReference(videoUrl, "course-videos");
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl || "";
};

const parseStorageReference = (url, fallbackBucket = "course-videos") => {
  const value = String(url || "").replace("storage://", "");
  const [first, ...rest] = value.split("/");
  if (first === "course-videos" || first === "course-assets") {
    return { bucket: first, path: rest.join("/") };
  }
  return { bucket: fallbackBucket, path: value };
};

const resolveDownloadUrl = async (supabase, url) => {
  if (!url) return "";
  if (!url.startsWith("storage://")) return url;
  const { bucket, path } = parseStorageReference(url, "course-assets");
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60, {
    download: true,
  });
  return data?.signedUrl || "";
};

const formatFileSize = (bytes = 0) => {
  const size = Number(bytes || 0);
  if (!size) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageMedia = (url = "") => /\.(gif|png|jpe?g|webp|avif)(\?.*)?$/i.test(url);

const sanitizeLessonHtml = (value = "") => {
  const raw = String(value || "");
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(raw);
  const html = hasHtml
    ? raw
    : `<p>${escapeHtml(raw).replace(/\r\n/g, "\n").replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</p>`;
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowedTags = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "UL", "OL", "LI", "A", "SPAN"]);
  template.content.querySelectorAll("*").forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    [...node.attributes].forEach((attribute) => {
      if (node.tagName === "A" && attribute.name === "href") return;
      node.removeAttribute(attribute.name);
    });
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noreferrer");
    }
  });
  return template.innerHTML;
};

const normalizeExamQuestions = (lesson) => {
  if (Array.isArray(lesson.exam_questions) && lesson.exam_questions.length) {
    return lesson.exam_questions.map((question) => ({
      type: question.type === "true_false" ? "true_false" : "multiple_choice",
      prompt: question.prompt || "Selecciona la respuesta correcta",
      options:
        question.type === "true_false"
          ? ["Verdadero", "Falso"]
          : Array.isArray(question.options) && question.options.length
            ? question.options
            : [],
      answer: question.answer || "",
    }));
  }

  return lesson.exam_question
    ? [
        {
          type: "multiple_choice",
          prompt: lesson.exam_question,
          options: Array.isArray(lesson.exam_options) ? lesson.exam_options : [],
          answer: lesson.exam_answer || "",
        },
      ]
    : [];
};

const normalizeLessons = (course, dbLessons = []) => {
  if (dbLessons.length) {
    return dbLessons.map((lesson) => ({
      ...lesson,
      exam_questions: normalizeExamQuestions(lesson),
    }));
  }

  return (course.modules || ["Introduccion", "Practica guiada", "Cierre"]).map((title, index) => ({
    id: `${course.id}-${index}`,
    title,
    position: index + 1,
    content_type: "lesson",
    reading_content: index === 0 ? course.summary : "Contenido de apoyo para esta leccion.",
    exam_questions: [],
  }));
};

const isLessonUnlocked = (index) => index === 0 || completedLessonIds.has(lessons[index - 1]?.id);

const firstUnlockedLesson = () => {
  const activeIndex = lessons.findIndex((lesson) => lesson.id === activeLessonId);
  if (activeIndex >= 0 && isLessonUnlocked(activeIndex)) return lessons[activeIndex];
  return lessons.find((_, index) => isLessonUnlocked(index)) || lessons[0];
};

const setProgress = () => {
  const value = lessons.length ? Math.round((completedLessonIds.size / lessons.length) * 100) : 0;
  if (progress) progress.style.width = `${value}%`;
  return value;
};

const syncEnrollmentProgress = async () => {
  const validLessonIds = new Set(lessons.map((lesson) => lesson.id));
  completedLessonIds = new Set([...completedLessonIds].filter((lessonId) => validLessonIds.has(lessonId)));
  const nextProgress = setProgress();
  if (activeSupabase && activeEnrollment && activeUser && Number(activeEnrollment.progress || 0) !== nextProgress) {
    await activeSupabase
      .from("enrollments")
      .update({ progress: nextProgress })
      .eq("id", activeEnrollment.id)
      .eq("profile_id", activeUser.id);
    activeEnrollment.progress = nextProgress;
  }
  return nextProgress;
};

const renderModules = () => {
  if (!modules) return;
  modules.innerHTML = lessons
    .map((lesson, index) => {
      const completed = completedLessonIds.has(lesson.id);
      const selected = lesson.id === activeLessonId;
      const locked = !isLessonUnlocked(index);
      return `
        <button class="${selected ? "selected" : ""} ${locked ? "locked" : ""}" type="button" data-lesson-id="${lesson.id}" ${
          locked ? "disabled" : ""
        }>
          <span>${completed ? "OK" : locked ? "Bloq." : String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>${escapeHtml(lesson.title)}</strong>
            <small>${locked ? "Bloqueada" : lesson.content_type === "exam" ? "Examen" : "Leccion"}</small>
          </div>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-lesson-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      activeLessonId = button.dataset.lessonId;
      renderActiveLesson();
    });
  });
};

const getYoutubeId = (url) => {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/watch")) return parsed.searchParams.get("v") || "";
      if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/").filter(Boolean)[1] || "";
      }
    }
  } catch {
    return "";
  }
  return "";
};

const hideVideoSurfaces = () => {
  if (video) {
    video.pause?.();
    video.removeAttribute("src");
    video.hidden = true;
  }
  if (videoFrame) videoFrame.hidden = true;
  if (videoPlaceholder) videoPlaceholder.hidden = true;
  if (youtubePlayer) youtubePlayer.hidden = true;
};

const renderVideo = async (lesson) => {
  const resolvedVideo = activeSupabase ? await resolveVideoUrl(activeSupabase, lesson.video_url || "") : lesson.video_url;
  if (!video || !videoPlaceholder) return;

  const youtubeId = getYoutubeId(resolvedVideo);
  if (isImageMedia(resolvedVideo) && youtubePlayer) {
    video.removeAttribute("src");
    video.hidden = true;
    if (videoFrame) videoFrame.hidden = true;
    videoPlaceholder.hidden = true;
    youtubePlayer.hidden = false;
    youtubePlayer.innerHTML = `<img class="lesson-media-image" src="${escapeHtml(resolvedVideo)}" alt="${escapeHtml(
      lesson.title || "Contenido visual",
    )}" />`;
    return;
  }

  if (youtubeId && youtubePlayer) {
    video.removeAttribute("src");
    video.hidden = true;
    if (videoFrame) videoFrame.hidden = true;
    videoPlaceholder.hidden = true;
    youtubePlayer.hidden = false;
    youtubePlayer.innerHTML = `
      <div class="youtube-frame">
        <iframe
          src="https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}"
          title="${escapeHtml(lesson.title || "Video de la leccion")}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>
      <a class="youtube-link" href="${escapeHtml(resolvedVideo)}" target="_blank" rel="noreferrer">
        Abrir en YouTube
      </a>
    `;
    return;
  }

  if (resolvedVideo) {
    if (youtubePlayer) youtubePlayer.hidden = true;
    video.src = resolvedVideo;
    video.hidden = false;
    if (videoFrame) videoFrame.hidden = false;
    videoPlaceholder.hidden = true;
    return;
  }

  video.removeAttribute("src");
  video.hidden = true;
  if (videoFrame) videoFrame.hidden = true;
  if (youtubePlayer) youtubePlayer.hidden = true;
  videoPlaceholder.hidden = false;
};

const renderAttachments = async (lesson) => {
  const attachments = Array.isArray(lesson.lesson_attachments) ? lesson.lesson_attachments : [];
  if (!attachments.length) return "";
  const resolved = await Promise.all(
    attachments.map(async (attachment, index) => ({
      ...attachment,
      href: await resolveDownloadUrl(activeSupabase, attachment.url),
      name: attachment.name || `Archivo ${index + 1}`,
    })),
  );

  return `
    <section class="lesson-downloads" aria-label="Archivos descargables">
      <p class="eyebrow">Descargas</p>
      <div>
        ${resolved
          .map(
            (attachment) => `
              <a href="${escapeHtml(attachment.href)}" download target="_blank" rel="noreferrer">
                <strong>${escapeHtml(attachment.name)}</strong>
                ${attachment.size ? `<span>${escapeHtml(formatFileSize(attachment.size))}</span>` : ""}
              </a>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
};

const renderExam = (lesson) => {
  if (!examPlayer) return;
  const questions = lesson.exam_questions?.length ? lesson.exam_questions : normalizeExamQuestions(lesson);
  examPlayer.hidden = false;
  examPlayer.innerHTML = `
    <p class="eyebrow">Examen</p>
    <h2>${escapeHtml(lesson.title)}</h2>
    ${lesson.reading_content ? `<p>${escapeHtml(lesson.reading_content)}</p>` : ""}
    ${questions
      .map(
        (question, questionIndex) => `
          <fieldset class="exam-player-question">
            <legend>${escapeHtml(question.prompt || `Pregunta ${questionIndex + 1}`)}</legend>
            ${(question.options || [])
              .map(
                (option) => `
                  <label data-exam-option="${questionIndex}:${escapeHtml(option)}">
                    <input type="radio" name="exam-answer-${questionIndex}" value="${escapeHtml(option)}" />
                    ${escapeHtml(option)}
                  </label>
                `,
              )
              .join("")}
          </fieldset>
        `,
      )
      .join("")}
    <p class="auth-status" data-exam-status></p>
  `;

  examPlayer.querySelectorAll("input[type='radio']").forEach((input) => {
    input.addEventListener("change", () => {
      const fieldset = input.closest(".exam-player-question");
      fieldset?.classList.remove("is-correct", "is-wrong", "is-missing");
      fieldset?.querySelectorAll("label").forEach((label) => label.classList.remove("is-correct", "is-wrong"));
      const status = document.querySelector("[data-exam-status]");
      if (status) {
        status.textContent = "";
        status.className = "auth-status";
      }
    });
  });
};

const showExamFeedback = (questions) => {
  const status = document.querySelector("[data-exam-status]");
  let missing = false;
  let allCorrect = true;

  questions.forEach((question, index) => {
    const fieldset = document.querySelectorAll(".exam-player-question")[index];
    const selectedInput = document.querySelector(`[name='exam-answer-${index}']:checked`);
    const selected = selectedInput?.value || "";
    const isCorrect = selected && selected === question.answer;
    missing = missing || !selected;
    allCorrect = allCorrect && Boolean(isCorrect);

    fieldset?.classList.remove("is-correct", "is-wrong", "is-missing");
    fieldset?.classList.add(!selected ? "is-missing" : isCorrect ? "is-correct" : "is-wrong");
    fieldset?.querySelectorAll("label").forEach((label) => {
      const option = label.querySelector("input")?.value || "";
      label.classList.toggle("is-correct", option === question.answer);
      label.classList.toggle("is-wrong", Boolean(selected) && option === selected && option !== question.answer);
    });
  });

  if (status) {
    status.className = `auth-status ${allCorrect ? "success" : "error"}`;
    status.textContent = allCorrect
      ? "Correcto. Buen trabajo, avanzamos."
      : missing
        ? "Te falta responder una o mas preguntas."
        : "Hay respuestas por corregir. Te marque cual revisar.";
  }

  return allCorrect;
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const renderActiveLesson = async () => {
  let lesson = lessons.find((item) => item.id === activeLessonId) || lessons[0];
  if (!lesson) return;

  const lessonIndex = lessons.findIndex((item) => item.id === lesson.id);
  if (!isLessonUnlocked(lessonIndex)) lesson = firstUnlockedLesson();
  activeLessonId = lesson.id;

  titleNodes.forEach((node) => {
    node.textContent = lesson.title || activeCourse.title;
  });

  if (lesson.content_type === "exam") {
    if (lessonContent) lessonContent.hidden = true;
    hideVideoSurfaces();
    renderExam(lesson);
  } else {
    if (lessonContent) {
      const downloads = await renderAttachments(lesson);
      lessonContent.hidden = false;
      lessonContent.innerHTML = `
        <p class="eyebrow">Leccion</p>
        <h2>${escapeHtml(lesson.title)}</h2>
        <div class="lesson-rich-content">${sanitizeLessonHtml(
          lesson.reading_content || lesson.transcript || activeCourse.summary || "",
        )}</div>
        ${downloads}
      `;
    }
    if (examPlayer) examPlayer.hidden = true;
    await renderVideo(lesson);
  }

  if (completeButton) {
    completeButton.textContent = completedLessonIds.has(lesson.id) ? "Completado" : "Marcar como completado";
    completeButton.disabled = completedLessonIds.has(lesson.id);
  }

  renderModules();
  setProgress();
};

const ensureEnrollment = async (courseId) => {
  if (!activeSupabase || !activeUser) return null;

  const { data: existing } = await activeSupabase
    .from("enrollments")
    .select("id,progress")
    .eq("profile_id", activeUser.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await activeSupabase
    .from("enrollments")
    .insert({ profile_id: activeUser.id, course_id: courseId, progress: 0 })
    .select("id,progress")
    .single();

  if (error) return null;
  return data;
};

const loadCompletedLessons = async () => {
  if (!activeSupabase || !activeEnrollment) return;
  const { data } = await activeSupabase
    .from("lesson_progress")
    .select("lesson_id,completed")
    .eq("enrollment_id", activeEnrollment.id)
    .eq("completed", true);
  completedLessonIds = new Set((data || []).map((item) => item.lesson_id));
};

const completeActiveLesson = async () => {
  const lesson = lessons.find((item) => item.id === activeLessonId);
  if (!lesson || completedLessonIds.has(lesson.id)) return;

  if (lesson.content_type === "exam") {
    const questions = lesson.exam_questions?.length ? lesson.exam_questions : normalizeExamQuestions(lesson);
    const allCorrect = showExamFeedback(questions);
    if (!allCorrect) {
      return;
    }
    await wait(700);
  }

  completedLessonIds.add(lesson.id);
  const nextProgress = setProgress();

  if (activeSupabase && activeEnrollment && activeUser) {
    await activeSupabase.from("lesson_progress").upsert(
      {
        enrollment_id: activeEnrollment.id,
        lesson_id: lesson.id,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "enrollment_id,lesson_id" },
    );

    await activeSupabase
      .from("enrollments")
      .update({ progress: nextProgress })
      .eq("id", activeEnrollment.id)
      .eq("profile_id", activeUser.id);
  }

  const currentIndex = lessons.findIndex((item) => item.id === lesson.id);
  activeLessonId = lessons[currentIndex + 1]?.id || lesson.id;
  renderActiveLesson();
};

const setCourse = async (course, courseLessons = [], supabase = null) => {
  activeCourse = course;
  lessons = normalizeLessons(course, courseLessons);
  activeLessonId = lessons[0]?.id || null;

  titleNodes.forEach((node) => {
    node.textContent = course.title;
  });

  if (supabase && activeUser && !companySeatSession && course.id?.length > 20) {
    activeEnrollment = await ensureEnrollment(course.id);
    await loadCompletedLessons();
    await syncEnrollmentProgress();
  }

  const firstIncomplete = lessons.find((lesson) => !completedLessonIds.has(lesson.id));
  if (firstIncomplete) activeLessonId = firstIncomplete.id;

  await renderActiveLesson();
};

completeButton?.addEventListener("click", completeActiveLesson);

const init = async () => {
  const fallback = fallbackCourses.find((item) => item.id === courseSlug) || fallbackCourses[0] || null;
  const { supabase, user } = await getSessionContext();
  activeSupabase = supabase;
  activeUser = companySeatSession ? null : user;

  if (!supabase) {
    if (fallback) await setCourse(fallback, [], null);
    else if (lessonContent) {
      titleNodes.forEach((node) => {
        node.textContent = "Curso no disponible";
      });
      lessonContent.innerHTML = `
        <p class="eyebrow">Sin contenido</p>
        <h2>No hay cursos cargados</h2>
        <p>Cuando el admin publique contenido, este curso se podra abrir desde el dashboard.</p>
      `;
    }
    return;
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id,title,slug,summary,category")
    .eq("slug", courseSlug)
    .maybeSingle();

  if (!course) {
    if (fallback) await setCourse(fallback, [], null);
    else {
      titleNodes.forEach((node) => {
        node.textContent = "Curso no encontrado";
      });
      if (lessonContent) {
        lessonContent.innerHTML = `
          <p class="eyebrow">Sin contenido</p>
          <h2>Este curso no existe o ya fue eliminado</h2>
          <p>Volver al dashboard para elegir un curso publicado.</p>
        `;
      }
    }
    return;
  }

  const { data: dbLessons } = await supabase
    .from("lessons")
    .select("id,title,position,content_type,video_url,transcript,reading_content,lesson_attachments,exam_question,exam_options,exam_answer,exam_questions")
    .eq("course_id", course.id)
    .order("position", { ascending: true });

  await setCourse(course, dbLessons || [], supabase);
};

init();
