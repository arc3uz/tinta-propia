import { invoke } from "@tauri-apps/api/core";
import { app } from "../core/state.js";
import {
  $,
  createEl,
  formatBytes,
  formatRelative,
  svgIcon,
} from "../core/utils.js";
import { showModal, toast } from "../core/modal.js";
import { openFolder } from "../core/system.js";

/**
 * Biblioteca de proyectos y pantalla de inicio.
 *
 * La biblioteca vive en la carpeta `projects/` de los datos de la aplicación.
 * Se muestra como un árbol de carpetas para que el usuario pueda ordenar,
 * etiquetar y abrir sus proyectos sin salir de la app.
 */

async function loadLibraryProjects() {
  if (!app.isTauri) return [];
  try {
    return await invoke("list_library");
  } catch (error) {
    console.warn("No se pudo cargar la biblioteca", error);
    return [];
  }
}

async function loadRecentProjects() {
  if (!app.isTauri) return app.boot?.recent || [];
  try {
    return await invoke("recent_projects");
  } catch {
    return app.boot?.recent || [];
  }
}

function countLibraryProjects(folder) {
  let count = folder.projects.length;
  for (const child of folder.folders.values()) count += countLibraryProjects(child);
  return count;
}

/** Convierte la lista plana de proyectos en un árbol de carpetas. */
function buildLibraryTree(projects) {
  const root = { folders: new Map(), projects: [] };
  for (const project of projects) {
    const parts = project.folder ? project.folder.split("/").filter(Boolean) : [];
    let node = root;
    for (const part of parts) {
      if (!node.folders.has(part)) {
        node.folders.set(part, { name: part, folders: new Map(), projects: [] });
      }
      node = node.folders.get(part);
    }
    node.projects.push(project);
  }
  return root;
}

function sortLibraryTree(node) {
  node.projects.sort((a, b) =>
    (a.title || "").localeCompare(b.title || "", "es", { sensitivity: "base" })
  );
  for (const folder of node.folders.values()) sortLibraryTree(folder);
}

function collectLibraryFolders(projects) {
  const folders = new Set();
  for (const project of projects) {
    const parts = project.folder ? project.folder.split("/").filter(Boolean) : [];
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      folders.add(current);
    }
  }
  return [...folders].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

function editProjectTags(project, refresh, deps) {
  if (!app.isTauri) return;
  const input = createEl("input", { type: "text", placeholder: "examen, repaso, pendientes" });
  input.value = Array.isArray(project.tags) ? project.tags.join(", ") : "";
  const body = createEl("div", {}, [
    createEl("label", {
      class: "select-label",
      for: "library-tags-input",
      text: "Etiquetas separadas por comas",
    }),
    input,
    createEl("p", {
      class: "setting-hint small",
      text: "Sirven para reconocer y agrupar proyectos dentro de la biblioteca.",
    }),
  ]);
  input.id = "library-tags-input";
  const modal = showModal({
    title: "Editar etiquetas",
    subtitle: project.title || "Sin título",
    body,
    narrow: true,
    actions: [
      { label: "Cancelar", kind: "ghost", onClick: (close) => close() },
      {
        label: "Guardar etiquetas",
        kind: "primary",
        onClick: async (close) => {
          const tags = [
            ...new Set(
              input.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            ),
          ].slice(0, 12);
          try {
            await invoke("set_project_tags", { path: project.path, tags });
            if (app.projectPath === project.path) {
              app.tags = tags;
              deps.scheduleAutosave?.(200);
            }
            close();
            toast("Etiquetas actualizadas.", { title: "Biblioteca" });
            await refresh();
          } catch (error) {
            console.error(error);
            toast(`No se pudieron guardar las etiquetas: ${error}`, { type: "error" });
          }
        },
      },
    ],
  });
  setTimeout(() => input.focus(), 40);
  return modal;
}

function moveProjectDialog(project, folders, refresh, deps) {
  if (!app.isTauri) return;
  const input = createEl("input", {
    type: "text",
    list: "library-folder-options",
    placeholder: "Sin carpeta (raíz)",
  });
  input.value = project.folder || "";
  const list = createEl("datalist", { id: "library-folder-options" });
  for (const folder of folders) list.append(createEl("option", { value: folder }));
  const body = createEl("div", {}, [
    createEl("label", {
      class: "select-label",
      for: "library-folder-input",
      text: "Carpeta dentro de la biblioteca",
    }),
    input,
    list,
    createEl("p", {
      class: "setting-hint small",
      text: "Déjalo vacío para la raíz. Si la carpeta no existe, se crea al mover el proyecto.",
    }),
  ]);
  input.id = "library-folder-input";
  const modal = showModal({
    title: "Mover a carpeta",
    subtitle: project.title || "Sin título",
    body,
    narrow: true,
    actions: [
      { label: "Cancelar", kind: "ghost", onClick: (close) => close() },
      {
        label: "Mover proyecto",
        kind: "primary",
        onClick: async (close) => {
          try {
            const newPath = await invoke("move_project_to_folder", {
              path: project.path,
              folder: input.value.trim(),
            });
            if (app.projectPath === project.path) {
              app.projectPath = newPath;
              deps.scheduleAutosave?.(100);
            }
            close();
            toast("Proyecto movido de carpeta.", { title: "Biblioteca" });
            await refresh();
          } catch (error) {
            console.error(error);
            toast(`No se pudo mover el proyecto: ${error}`, { type: "error" });
          }
        },
      },
    ],
  });
  setTimeout(() => input.focus(), 40);
  return modal;
}

function createLibraryRow(project, closeLibrary, refresh, folders, deps) {
  const row = createEl("div", { class: "library-project", title: project.path });
  const tags = Array.isArray(project.tags) ? project.tags : [];
  const updated = project.updatedAt ? formatRelative(project.updatedAt) : "";
  const meta = [updated, project.size ? formatBytes(project.size) : ""].filter(Boolean).join(" · ");
  const open = createEl("button", { class: "library-open", type: "button" }, [
    svgIcon("file"),
    createEl("span", { class: "library-copy" }, [
      createEl("strong", { text: project.title || "Sin título" }),
      tags.length
        ? createEl(
            "span",
            { class: "library-tags" },
            tags.map((tag) => createEl("span", { class: "library-tag", text: tag }))
          )
        : null,
      createEl("small", { text: meta }),
    ]),
    app.projectPath === project.path
      ? createEl("span", { class: "library-current", text: "Actual" })
      : null,
  ]);
  open.addEventListener("click", () => {
    closeLibrary();
    deps.openProjectPath(project.path);
  });
  const actions = createEl("div", { class: "library-actions" }, [
    createEl(
      "button",
      {
        class: "icon-btn",
        title: "Editar etiquetas",
        "aria-label": `Editar etiquetas de ${project.title || "Sin título"}`,
      },
      [svgIcon("tag")]
    ),
    createEl(
      "button",
      {
        class: "icon-btn",
        title: "Mover a carpeta",
        "aria-label": `Mover ${project.title || "Sin título"} a una carpeta`,
      },
      [svgIcon("folder")]
    ),
  ]);
  actions.children[0].addEventListener("click", () => editProjectTags(project, refresh, deps));
  actions.children[1].addEventListener("click", () => moveProjectDialog(project, folders, refresh, deps));
  row.append(open, actions);
  return row;
}

function renderLibraryNode(node, container, closeLibrary, refresh, folders, deps) {
  const fragment = document.createDocumentFragment();
  const sortedFolders = [...node.folders.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" })
  );
  for (const folder of sortedFolders) {
    const details = createEl("details", { class: "library-folder" });
    details.open = true;
    const summary = createEl("summary", {}, [
      svgIcon("folder"),
      createEl("span", { class: "library-folder-name", text: folder.name }),
      createEl("span", {
        class: "library-folder-count",
        text: String(countLibraryProjects(folder)),
      }),
    ]);
    const children = createEl("div", { class: "library-children" });
    renderLibraryNode(folder, children, closeLibrary, refresh, folders, deps);
    details.append(summary, children);
    fragment.append(details);
  }
  for (const project of node.projects) {
    fragment.append(createLibraryRow(project, closeLibrary, refresh, folders, deps));
  }
  container.append(fragment);
}

function renderLibrary(container, projects, closeLibrary, refresh, deps) {
  container.innerHTML = "";
  const head = createEl("div", { class: "library-head" }, [
    createEl("div", {}, [
      createEl("div", { class: "recent-title", text: "Biblioteca" }),
      createEl("small", {
        class: "library-count",
        text: projects.length
          ? `${projects.length} ${projects.length === 1 ? "proyecto" : "proyectos"}`
          : "Sin proyectos guardados",
      }),
    ]),
    createEl("div", { class: "library-head-actions" }, [
      app.isTauri
        ? createEl(
            "button",
            {
              class: "btn ghost small",
              onclick: () => openFolder(app.boot.projectsDir),
            },
            [svgIcon("folder"), "Abrir carpeta"]
          )
        : null,
    ]),
  ]);
  container.append(head);
  const tree = createEl("div", { class: "library-tree" });
  if (!projects.length) {
    tree.append(
      createEl("div", { class: "library-empty" }, [
        svgIcon("folder"),
        createEl("p", {
          text: app.isTauri
            ? "Todavía no hay proyectos en la biblioteca."
            : "La biblioteca está disponible en la app de escritorio.",
        }),
        createEl("small", {
          text: app.isTauri
            ? "Los proyectos guardados se ordenan aquí por carpeta. También puedes moverlos y etiquetarlos."
            : "En el navegador solo se conserva la sesión actual.",
        }),
        app.isTauri
          ? createEl(
              "button",
              {
                class: "btn primary small",
                onclick: async () => {
                  await deps.saveProjectAs({ defaultDir: app.boot.projectsDir });
                  await refresh();
                },
              },
              "Guardar este documento en la biblioteca"
            )
          : null,
      ])
    );
  } else {
    const root = buildLibraryTree(projects);
    sortLibraryTree(root);
    renderLibraryNode(
      root,
      tree,
      closeLibrary,
      refresh,
      collectLibraryFolders(projects),
      deps
    );
  }
  container.append(tree);
}

function renderExternalRecents(container, projects, recent, closeLibrary, refresh, folders, deps) {
  container.innerHTML = "";
  const libraryPaths = new Set(projects.map((project) => project.path));
  const items = recent.filter((item) => !libraryPaths.has(item.path));
  if (!items.length) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  container.append(
    createEl("div", { class: "recent-title", text: "Recientes fuera de la biblioteca" })
  );
  for (const item of items.slice(0, 4)) {
    const row = createEl("div", { class: "recent-row" });
    const open = createEl("button", { class: "recent-open", type: "button" }, [
      svgIcon("file"),
      createEl("span", { class: "recent-copy" }, [
        createEl("strong", { text: item.title || "Sin título" }),
        createEl("small", { text: item.path }),
      ]),
      createEl("span", { class: "recent-time", text: formatRelative(item.openedAt) }),
    ]);
    open.addEventListener("click", () => {
      closeLibrary();
      deps.openProjectPath(item.path);
    });
    row.append(open);
    if (app.isTauri) {
      const move = createEl(
        "button",
        {
          class: "icon-btn",
          title: "Mover a la biblioteca",
          "aria-label": `Mover ${item.title || "el proyecto"} a la biblioteca`,
        },
        [svgIcon("folder")]
      );
      move.addEventListener("click", () => moveProjectDialog(item, folders, refresh, deps));
      row.append(createEl("div", { class: "library-actions" }, [move]));
    }
    container.append(row);
  }
}

let homeBound = false;
let homeDeps = null;

/** Cierra la página de inicio y vuelve al documento abierto. */
export function closeHomeView() {
  const view = $("homeView");
  if (view) view.hidden = true;
  const workspace = $("workspace");
  if (workspace) workspace.hidden = false;
}

async function renderHome() {
  const content = $("homeContent");
  if (!content || !homeDeps) return;
  content.innerHTML = "";

  const actions = createEl("div", { class: "home-actions" });
  const addAction = (title, detail, icon, action) => {
    const card = createEl("button", { class: "home-action", type: "button" }, [
      createEl("span", { class: "welcome-icon" }, [svgIcon(icon)]),
      createEl("span", { class: "welcome-copy" }, [
        createEl("strong", { text: title }),
        createEl("small", { text: detail }),
      ]),
    ]);
    card.addEventListener("click", async () => {
      closeHomeView();
      await action();
    });
    actions.append(card);
  };

  addAction("Nuevo proyecto", "Empieza con una hoja en blanco.", "plus", homeDeps.newProject);
  addAction("Abrir proyecto", "Retoma un archivo .papernotes.", "folder", async () => {
    if (app.isTauri) await homeDeps.chooseProjectFile();
    else await homeDeps.openProjectFlow();
  });
  addAction(
    "Importar Markdown",
    "Trae un documento .md existente.",
    "file",
    homeDeps.openMarkdownFlow
  );
  addAction(
    "Cargar plantilla",
    "Usa el ejemplo de bienvenida.",
    "pen",
    homeDeps.loadExampleTemplate
  );

  const columns = createEl("div", { class: "home-columns" });
  const libraryPanel = createEl("section", { class: "home-panel" });
  const recentPanel = createEl("aside", { class: "home-panel home-recent-panel" });
  columns.append(libraryPanel, recentPanel);
  content.append(actions, columns);

  const refresh = async () => {
    const [projects, recent] = await Promise.all([loadLibraryProjects(), loadRecentProjects()]);
    renderLibrary(libraryPanel, projects, closeHomeView, refresh, homeDeps);
    renderExternalRecents(
      recentPanel,
      projects,
      recent,
      closeHomeView,
      refresh,
      collectLibraryFolders(projects),
      homeDeps
    );
    columns.classList.toggle("with-recents", !recentPanel.hidden);
  };
  await refresh();
}

/**
 * Abre la página de inicio dentro del espacio de trabajo.
 *
 * Es una vista real, no un modal: ocupa el área central, mantiene el documento
 * cargado detrás y permite volver a él en cualquier momento.
 */
export async function openHomeView(deps) {
  const view = $("homeView");
  if (!view) return;
  homeDeps = deps;
  if (!homeBound) {
    $("homeCloseBtn")?.addEventListener("click", closeHomeView);
    homeBound = true;
  }
  const workspace = $("workspace");
  if (workspace) workspace.hidden = true;
  view.hidden = false;
  await renderHome();
}

/** Lista de proyectos recientes para abrir un `.papernotes` del disco. */
export async function showRecentProjects(deps) {
  const recent = await loadRecentProjects();
  const body = createEl("div", { class: "recent-box" });
  const render = (items) => {
    body.innerHTML = "";
    if (!items.length) {
      body.append(
        createEl("div", { class: "recent-empty" }, [
          svgIcon("folder"),
          createEl("p", { text: "Todavía no hay proyectos guardados." }),
          createEl("small", {
            text: "Crea uno nuevo o elige un archivo .papernotes del disco.",
          }),
        ])
      );
      return;
    }
    body.append(createEl("div", { class: "recent-title", text: "Recientes" }));
    for (const item of items) {
      const row = createEl("div", { class: "recent-row" });
      const openButton = createEl("button", { class: "recent-open" }, [
        svgIcon("file"),
        createEl("span", { class: "recent-copy" }, [
          createEl("strong", { text: item.title || "Sin título" }),
          createEl("small", { text: item.path }),
        ]),
        createEl("span", {
          class: "recent-time",
          text: formatRelative(item.openedAt),
        }),
      ]);
      openButton.addEventListener("click", async () => {
        modal.close();
        await deps.openProjectPath(item.path);
      });
      const remove = createEl(
        "button",
        {
          class: "icon-btn recent-remove",
          title: "Quitar de recientes",
          onclick: async (event) => {
            event.stopPropagation();
            try {
              await invoke("remove_recent", { path: item.path });
            } catch {
              /* noop */
            }
            render(items.filter((x) => x.path !== item.path));
          },
        },
        [svgIcon("trash")]
      );
      row.append(openButton, remove);
      body.append(row);
    }
  };
  render(recent);
  const modal = showModal({
    title: "Abrir proyecto",
    subtitle: "Los proyectos recientes viven en tu equipo; nada se sube a internet.",
    body,
    actions: [
      { label: "Cancelar", kind: "ghost", onClick: (close) => close() },
      {
        label: "Elegir archivo…",
        kind: "primary",
        onClick: async (close) => {
          close();
          try {
            await deps.chooseProjectFile();
          } catch (error) {
            console.error(error);
          }
        },
      },
    ],
  });
  return modal;
}
