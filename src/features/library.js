import { invoke } from "@tauri-apps/api/core";
import { app } from "../core/state.js";
import {
  $,
  createEl,
  formatBytes,
  formatRelative,
  svgIcon,
} from "../core/utils.js";
import { confirmAction, promptText, showModal, toast } from "../core/modal.js";
import { save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { openFolder } from "../core/system.js";

/**
 * Biblioteca de proyectos y página de inicio.
 *
 * La biblioteca vive en la carpeta `projects/` de los datos de la aplicación.
 * Se muestra como un árbol de carpetas para que el usuario pueda buscar,
 * ordenar, etiquetar y abrir sus proyectos sin salir de la app.
 */

let libraryQuery = "";
let libraryTag = "";
let librarySort = "name";

async function loadLibraryProjects() {
  if (!app.isTauri) return { projects: [], folders: [] };
  try {
    const snapshot = await invoke("list_library");
    return {
      projects: Array.isArray(snapshot?.projects) ? snapshot.projects : [],
      folders: Array.isArray(snapshot?.folders) ? snapshot.folders : [],
    };
  } catch (error) {
    console.warn("No se pudo cargar la biblioteca", error);
    return { projects: [], folders: [] };
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

function uniqueTags(projects) {
  const tags = new Set();
  for (const project of projects) {
    for (const tag of project.tags || []) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

function folderPath(folder) {
  const root = (app.boot?.projectsDir || "").replace(/[\\/]$/, "");
  if (!root) return folder;
  const separator = root.includes("\\") ? "\\" : "/";
  return folder ? `${root}${separator}${folder.split("/").join(separator)}` : root;
}

function replaceFolderPrefix(path, oldFolder, newFolder) {
  if (!path) return path;
  const oldPrefix = folderPath(oldFolder);
  const newPrefix = folderPath(newFolder);
  const separator = oldPrefix.includes("\\") ? "\\" : "/";
  if (!path.startsWith(`${oldPrefix}${separator}`)) return path;
  return `${newPrefix}${path.slice(oldPrefix.length)}`;
}

/** Convierte la lista plana de proyectos y carpetas en un árbol. */
function buildLibraryTree(projects, folders) {
  const root = { folders: new Map(), projects: [] };
  const ensureNode = (parts) => {
    let node = root;
    let path = "";
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      if (!node.folders.has(part)) {
        node.folders.set(part, { name: part, path, folders: new Map(), projects: [] });
      }
      node = node.folders.get(part);
    }
    return node;
  };
  for (const folder of folders) {
    const parts = String(folder || "").split("/").filter(Boolean);
    if (parts.length) ensureNode(parts);
  }
  for (const project of projects) {
    const parts = project.folder ? project.folder.split("/").filter(Boolean) : [];
    ensureNode(parts).projects.push(project);
  }
  return root;
}

function sortLibraryTree(node, sort) {
  node.projects.sort((a, b) => {
    if (sort === "recent") {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    }
    return (a.title || "").localeCompare(b.title || "", "es", { sensitivity: "base" });
  });
  for (const folder of node.folders.values()) sortLibraryTree(folder, sort);
}

function pruneLibraryTree(node) {
  for (const [name, child] of [...node.folders]) {
    pruneLibraryTree(child);
    if (!child.projects.length && !child.folders.size) node.folders.delete(name);
  }
}

function projectMatches(project) {
  const query = libraryQuery.trim().toLowerCase();
  const tags = Array.isArray(project.tags) ? project.tags : [];
  if (libraryTag && !tags.some((tag) => tag.toLowerCase() === libraryTag.toLowerCase())) {
    return false;
  }
  if (!query) return true;
  return (
    (project.title || "").toLowerCase().includes(query) ||
    tags.some((tag) => tag.toLowerCase().includes(query))
  );
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

async function renameProject(project, refresh, deps) {
  const title = await promptText({
    title: "Renombrar proyecto",
    subtitle: project.title || "Sin título",
    label: "Nuevo nombre",
    value: project.title || "",
    confirmLabel: "Renombrar",
  });
  if (!title || title === project.title) return;
  try {
    await invoke("set_project_title", { path: project.path, title });
    if (app.projectPath === project.path) {
      app.title = title;
      deps.updateTitleUI?.();
      deps.scheduleAutosave?.(150);
    }
    toast("Proyecto renombrado.", { title: "Biblioteca" });
    await refresh();
  } catch (error) {
    console.error(error);
    toast(`No se pudo renombrar: ${error}`, { type: "error" });
  }
}

async function duplicateProject(project, refresh) {
  try {
    await invoke("duplicate_project", { path: project.path });
    toast("Proyecto duplicado.", { title: "Biblioteca" });
    await refresh();
  } catch (error) {
    console.error(error);
    toast(`No se pudo duplicar: ${error}`, { type: "error" });
  }
}

async function trashProject(project, refresh) {
  if (app.projectPath === project.path) {
    toast("Cierra o cambia de proyecto antes de eliminarlo.", { type: "warn" });
    return;
  }
  const ok = await confirmAction({
    title: "Eliminar proyecto",
    message: `“${project.title || "Sin título"}” se moverá a la papelera de Tinta Propia.`,
    confirmLabel: "Mover a la papelera",
    danger: true,
  });
  if (!ok) return;
  try {
    await invoke("trash_project", { path: project.path });
    toast("Proyecto movido a la papelera.", { title: "Biblioteca" });
    await refresh();
  } catch (error) {
    console.error(error);
    toast(`No se pudo eliminar: ${error}`, { type: "error" });
  }
}

function showProjectActions(project, folders, refresh, deps) {
  const body = createEl("div", { class: "project-actions" });
  const add = (label, icon, action, danger = false) => {
    const button = createEl("button", {
      class: `project-action${danger ? " danger" : ""}`,
      type: "button",
    }, [
      svgIcon(icon),
      createEl("span", { text: label }),
    ]);
    button.addEventListener("click", async () => {
      modal.close();
      await action();
    });
    body.append(button);
  };
  const modal = showModal({
    title: "Acciones del proyecto",
    subtitle: project.title || "Sin título",
    body,
    narrow: true,
    actions: [{ label: "Cerrar", kind: "ghost", onClick: (close) => close() }],
  });
  add("Renombrar", "pen", () => renameProject(project, refresh, deps));
  add("Duplicar", "file", () => duplicateProject(project, refresh));
  add("Mover a carpeta", "folder", () => moveProjectDialog(project, folders, refresh, deps));
  add("Mover a otra ubicación…", "external", () => moveProjectAnywhere(project, refresh, deps));
  add("Abrir carpeta contenedora", "external", () => openFolder(folderPath(project.folder || "")));
  add("Eliminar", "trash", () => trashProject(project, refresh), true);
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
        title: "Acciones del proyecto",
        "aria-label": `Acciones de ${project.title || "Sin título"}`,
      },
      [svgIcon("more")]
    ),
  ]);
  actions.children[0].addEventListener("click", () => editProjectTags(project, refresh, deps));
  actions.children[1].addEventListener("click", () =>
    showProjectActions(project, folders, refresh, deps)
  );
  row.append(open, actions);
  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showContextMenu(event, projectMenuItems(project, folders, refresh, deps));
  });
  return row;
}

const folderAction = (icon, title, handler) => {
  const button = createEl(
    "button",
    {
      class: "icon-btn",
      type: "button",
      title,
      "aria-label": title,
    },
    [svgIcon(icon)]
  );
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler();
  });
  return button;
};

async function createFolder(refresh, parent = "") {
  if (!app.isTauri) return;
  const name = await promptText({
    title: parent ? "Nueva carpeta dentro" : "Nueva carpeta",
    subtitle: parent || "Biblioteca",
    label: "Nombre de la carpeta",
    placeholder: "Cálculo",
    confirmLabel: "Crear carpeta",
  });
  if (!name) return;
  const folder = parent ? `${parent}/${name}` : name;
  try {
    await invoke("create_library_folder", { folder });
    toast("Carpeta creada.", { title: "Biblioteca" });
    await refresh();
  } catch (error) {
    console.error(error);
    toast(`No se pudo crear la carpeta: ${error}`, { type: "error" });
  }
}

async function createProjectInFolder(folder, refresh) {
  if (!app.isTauri) return;
  const title = await promptText({
    title: "Nuevo proyecto",
    subtitle: folder || "Biblioteca",
    label: "Nombre del proyecto",
    value: "Nuevo proyecto",
    confirmLabel: "Crear archivo",
  });
  if (!title) return;
  try {
    await invoke("create_project_in_folder", { folder, title });
    toast("Proyecto creado en la carpeta.", { title: "Biblioteca" });
    await refresh();
  } catch (error) {
    console.error(error);
    toast(`No se pudo crear el proyecto: ${error}`, { type: "error" });
  }
}

async function moveProjectAnywhere(project, refresh, deps) {
  if (!app.isTauri) return;
  const target = await saveFileDialog({
    title: "Mover proyecto a otra ubicación",
    defaultPath: project.path,
    filters: [{ name: "Proyecto Tinta Propia", extensions: ["papernotes"] }],
  });
  if (!target || target === project.path) return;
  try {
    const newPath = await invoke("move_project_to_path", {
      path: project.path,
      target,
    });
    if (app.projectPath === project.path) {
      app.projectPath = newPath;
      deps.updateTitleUI?.();
      deps.scheduleAutosave?.(100);
    }
    toast("Proyecto movido.", { title: "Biblioteca" });
    await refresh();
  } catch (error) {
    console.error(error);
    toast(`No se pudo mover el proyecto: ${error}`, { type: "error" });
  }
}

let activeContextMenu = null;

function closeContextMenu() {
  if (!activeContextMenu) return;
  activeContextMenu.remove();
  activeContextMenu = null;
}

/** Menú contextual de la biblioteca. */
function showContextMenu(event, items) {
  closeContextMenu();
  const menu = createEl("div", { class: "context-menu", role: "menu" });
  for (const item of items) {
    if (!item) continue;
    const button = createEl(
      "button",
      {
        class: `context-item${item.danger ? " danger" : ""}`,
        type: "button",
        role: "menuitem",
      },
      [svgIcon(item.icon), createEl("span", { text: item.label })]
    );
    button.addEventListener("click", () => {
      closeContextMenu();
      item.action();
    });
    menu.append(button);
  }
  document.body.append(menu);
  const rect = menu.getBoundingClientRect();
  const left = Math.min(event.clientX, window.innerWidth - rect.width - 8);
  const top = Math.min(event.clientY, window.innerHeight - rect.height - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
  activeContextMenu = menu;

  const onPointerDown = (pointerEvent) => {
    if (!menu.contains(pointerEvent.target)) closeContextMenu();
  };
  const onKeyDown = (keyEvent) => {
    if (keyEvent.key === "Escape") closeContextMenu();
  };
  setTimeout(() => {
    if (!activeContextMenu) return;
    document.addEventListener("pointerdown", onPointerDown, true);
  }, 0);
  document.addEventListener("keydown", onKeyDown);
  const observer = new MutationObserver(() => {
    if (!document.body.contains(menu)) {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      observer.disconnect();
      if (activeContextMenu === menu) activeContextMenu = null;
    }
  });
  observer.observe(document.body, { childList: true });
}

function folderMenuItems(folder, refresh, deps) {
  return [
    {
      label: "Nuevo proyecto aquí",
      icon: "file",
      action: () => createProjectInFolder(folder.path, refresh),
    },
    {
      label: "Nueva carpeta dentro",
      icon: "folder",
      action: () => createFolder(refresh, folder.path),
    },
    {
      label: "Renombrar carpeta",
      icon: "pen",
      action: () => renameFolder(folder, refresh, deps),
    },
    countLibraryProjects(folder) === 0
      ? {
          label: "Eliminar carpeta",
          icon: "trash",
          danger: true,
          action: () => deleteFolder(folder, refresh),
        }
      : null,
  ];
}

function rootMenuItems(refresh) {
  return [
    {
      label: "Nuevo proyecto en la biblioteca",
      icon: "file",
      action: () => createProjectInFolder("", refresh),
    },
    {
      label: "Nueva carpeta",
      icon: "folder",
      action: () => createFolder(refresh),
    },
  ];
}

function projectMenuItems(project, folders, refresh, deps) {
  return [
    {
      label: "Abrir",
      icon: "file",
      action: () => {
        closeHomeView();
        deps.openProjectPath(project.path);
      },
    },
    {
      label: "Renombrar",
      icon: "pen",
      action: () => renameProject(project, refresh, deps),
    },
    {
      label: "Duplicar",
      icon: "file",
      action: () => duplicateProject(project, refresh),
    },
    {
      label: "Mover a otra ubicación…",
      icon: "external",
      action: () => moveProjectAnywhere(project, refresh, deps),
    },
    {
      label: "Mover a carpeta",
      icon: "folder",
      action: () => moveProjectDialog(project, folders, refresh, deps),
    },
    {
      label: "Abrir carpeta contenedora",
      icon: "external",
      action: () => openFolder(folderPath(project.folder || "")),
    },
    {
      label: "Eliminar",
      icon: "trash",
      danger: true,
      action: () => trashProject(project, refresh),
    },
  ];
}

async function renameFolder(folder, refresh, deps) {
  const newFolder = await promptText({
    title: "Renombrar carpeta",
    label: "Nuevo nombre o ruta",
    value: folder.path,
    confirmLabel: "Renombrar",
  });
  if (!newFolder || newFolder === folder.path) return;
  try {
    await invoke("rename_library_folder", {
      oldFolder: folder.path,
      newFolder,
    });
    if (app.projectPath) {
      const nextPath = replaceFolderPrefix(app.projectPath, folder.path, newFolder);
      if (nextPath !== app.projectPath) {
        app.projectPath = nextPath;
        deps.scheduleAutosave?.(100);
      }
    }
    toast("Carpeta renombrada.", { title: "Biblioteca" });
    await refresh();
  } catch (error) {
    console.error(error);
    toast(`No se pudo renombrar la carpeta: ${error}`, { type: "error" });
  }
}

async function deleteFolder(folder, refresh) {
  const count = countLibraryProjects(folder);
  if (count > 0) {
    toast("La carpeta tiene proyectos. Muévelos antes de eliminarla.", { type: "warn" });
    return;
  }
  const ok = await confirmAction({
    title: "Eliminar carpeta",
    message: `Se eliminará la carpeta vacía “${folder.path}”.`,
    confirmLabel: "Eliminar carpeta",
    danger: true,
  });
  if (!ok) return;
  try {
    await invoke("delete_library_folder", { folder: folder.path });
    toast("Carpeta eliminada.", { title: "Biblioteca" });
    await refresh();
  } catch (error) {
    console.error(error);
    toast(`No se pudo eliminar la carpeta: ${error}`, { type: "error" });
  }
}

function renderLibraryNode(node, container, closeLibrary, refresh, folders, deps) {
  const fragment = document.createDocumentFragment();
  const sortedFolders = [...node.folders.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" })
  );
  for (const folder of sortedFolders) {
    const details = createEl("details", { class: "library-folder" });
    details.open = true;
    const count = countLibraryProjects(folder);
    const folderActions = createEl("span", { class: "library-folder-actions" }, [
      folderAction("pen", "Renombrar carpeta", () => renameFolder(folder, refresh, deps)),
      count === 0
        ? folderAction("trash", "Eliminar carpeta", () => deleteFolder(folder, refresh))
        : null,
    ]);
    const summary = createEl("summary", {}, [
      svgIcon("folder"),
      createEl("span", { class: "library-folder-name", text: folder.name }),
      createEl("span", { class: "library-folder-count", text: String(count) }),
      folderActions,
    ]);
    summary.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showContextMenu(event, folderMenuItems(folder, refresh, deps));
    });
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

function renderLibrary(container, snapshot, closeLibrary, refresh, deps) {
  container.innerHTML = "";
  const projects = snapshot.projects || [];
  const folders = snapshot.folders || [];
  const tags = uniqueTags(projects);
  const countLabel = createEl("small", { class: "library-count" });
  const tree = createEl("div", { class: "library-tree" });
  tree.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".library-project, summary")) return;
    event.preventDefault();
    showContextMenu(event, rootMenuItems(refresh));
  });
  const tagFilters = createEl("div", { class: "library-tag-filters" });

  const head = createEl("div", { class: "library-head" }, [
    createEl("div", {}, [
      createEl("div", { class: "recent-title", text: "Biblioteca" }),
      countLabel,
    ]),
    createEl("div", { class: "library-head-actions" }, [
      app.isTauri
        ? createEl(
            "button",
            {
              class: "btn ghost small",
              onclick: () => createFolder(refresh),
            },
            [svgIcon("plus"), "Nueva carpeta"]
          )
        : null,
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

  const search = createEl("input", {
    type: "search",
    class: "library-search",
    placeholder: "Buscar por título o etiqueta…",
    "aria-label": "Buscar proyectos",
  });
  search.value = libraryQuery;
  const sort = createEl(
    "select",
    { class: "library-sort", "aria-label": "Ordenar proyectos" },
    [
      createEl("option", { value: "name", text: "Nombre" }),
      createEl("option", { value: "recent", text: "Reciente" }),
    ]
  );
  sort.value = librarySort;
  const filters = createEl("div", { class: "library-filters" }, [search, sort]);

  const emptyState = () => {
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
  };

  const updateTree = () => {
    const filtered = projects.filter(projectMatches);
    const root = buildLibraryTree(filtered, folders);
    sortLibraryTree(root, librarySort);
    if (libraryQuery.trim() || libraryTag) pruneLibraryTree(root);
    tree.innerHTML = "";
    countLabel.textContent =
      filtered.length === projects.length
        ? `${projects.length} ${projects.length === 1 ? "proyecto" : "proyectos"}`
        : `${filtered.length} de ${projects.length}`;
    if (!projects.length && !folders.length) {
      emptyState();
      return;
    }
    const filtering = Boolean(libraryQuery.trim() || libraryTag);
    if (filtering && !filtered.length) {
      tree.append(
        createEl("div", { class: "library-empty" }, [
          svgIcon("file"),
          createEl("p", { text: "No hay proyectos que coincidan." }),
          createEl("small", { text: "Prueba con otro título o etiqueta." }),
        ])
      );
      return;
    }
    renderLibraryNode(root, tree, closeLibrary, refresh, folders, deps);
  };

  const updateTagChips = () => {
    tagFilters.innerHTML = "";
    if (!tags.length) {
      tagFilters.hidden = true;
      return;
    }
    tagFilters.hidden = false;
    for (const tag of tags) {
      const button = createEl("button", {
        class: `chip${libraryTag === tag ? " is-active" : ""}`,
        type: "button",
        text: tag,
      });
      button.addEventListener("click", () => {
        libraryTag = libraryTag === tag ? "" : tag;
        updateTagChips();
        updateTree();
      });
      tagFilters.append(button);
    }
  };

  search.addEventListener("input", () => {
    libraryQuery = search.value;
    updateTree();
  });
  sort.addEventListener("change", () => {
    librarySort = sort.value;
    updateTree();
  });

  container.append(head, filters, tagFilters, tree);
  updateTagChips();
  updateTree();
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
    const [library, recent] = await Promise.all([loadLibraryProjects(), loadRecentProjects()]);
    renderLibrary(libraryPanel, library, closeHomeView, refresh, homeDeps);
    renderExternalRecents(
      recentPanel,
      library.projects,
      recent,
      closeHomeView,
      refresh,
      library.folders,
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
  libraryQuery = "";
  libraryTag = "";
  librarySort = "name";
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
