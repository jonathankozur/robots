import { parseContentJson } from "../../src/content/index.ts";
import type { ContentBundle } from "../../src/content/index.ts";
import { createContentFixture } from "../core/content-fixture.ts";
import type { ContentFixture } from "../core/content-fixture.ts";
import basicBundle from "../../content/fixtures/basic-v1.json" with { type: "json" };

export function mountContentPanel(container: HTMLElement): void {
  container.innerHTML = '<section class="content-panel">'
    + '<div class="section-title"><div><span class="eyebrow">CATÁLOGO DE CONTENIDO / CAT-001</span><h2>Validar datos y observar su entrega</h2></div><span>Herramienta de desarrollo</span></div>'
    + '<p class="muted">Carga un paquete JSON, revisa sus errores y arranca la fixture de integración. La validación del catálogo y los requisitos de la demo se muestran por separado.</p>'
    + '<div class="content-toolbar"><button id="content-example">Cargar ejemplo</button><label class="content-file">Importar JSON<input id="content-file" type="file" accept=".json,application/json"></label><button id="content-validate" class="primary">Validar paquete</button></div>'
    + '<div class="content-grid"><section class="content-editor"><label for="content-json">Paquete JSON</label><textarea id="content-json" spellcheck="false" aria-label="Paquete JSON"></textarea><div id="content-validation" class="content-validation" role="status" aria-live="polite"></div></section>'
    + '<section class="content-demo"><h3>Fixture de integración</h3><p class="muted small">El paquete puede ser válido aunque no tenga una configuración apta para esta demostración.</p>'
    + '<div class="content-selectors"><label>Robot<select id="content-robot" disabled></select></label><label>Terreno<select id="content-terrain" disabled></select></label></div>'
    + '<p id="content-eligibility" class="muted small">Valida un paquete para ver las opciones.</p>'
    + '<div class="content-controls"><button id="content-start" class="primary" disabled>Iniciar fixture</button><button id="content-step" disabled>Paso</button><button id="content-phase" disabled>Fase</button><button id="content-tick" disabled>Tick</button><button id="content-close" disabled>Cerrar sesión</button></div>'
    + '<div id="content-progress" class="status-strip" aria-live="polite">Sin sesión</div></section></div>'
    + '<section class="content-observation"><div><h3>Datos recibidos por los consumidores</h3><div class="content-views"><section><h4>Navegación</h4><pre id="content-navigation">Sin datos recibidos</pre></section><section><h4>Combate</h4><pre id="content-combat">Sin datos recibidos</pre></section></div></div>'
    + '<div><h3>Traza de la fixture</h3><div id="content-trace" class="content-trace">Inicia la fixture para observar los mensajes.</div></div>'
    + '<details class="content-manifest"><summary>Contenido fijado en el manifiesto</summary><pre id="content-manifest-data">Sin sesión</pre></details></section>'
    + '<div id="content-notice" class="notice" role="status" aria-live="polite" hidden></div></section>';

  const get = <T extends HTMLElement = HTMLElement>(id: string) => container.querySelector<T>("#" + id)!;
  const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  let content: ContentBundle | undefined;
  let fixture: ContentFixture | undefined;
  let busy = false;

  function selectionIssues(bundle: ContentBundle, robotId: string, terrainId: string): string[] {
    const reasons: string[] = [];
    const robot = bundle.definitions.robots.find(item => item.id === robotId);
    const terrain = bundle.definitions.terrains.find(item => item.id === terrainId);
    if (!robot) reasons.push("Elige un robot existente.");
    if (!terrain) reasons.push("Elige un terreno existente.");
    if (robot) {
      if (!bundle.definitions.chassis.some(item => item.id === robot.chassisId)) reasons.push("El robot no tiene un chasis definido.");
      const equipped = robot.equipment.map(item => item.componentId);
      if (!equipped.some(id => bundle.definitions.locomotions.some(item => item.id === id))) reasons.push("La fixture requiere locomoción equipada.");
      if (!equipped.some(id => bundle.definitions.weapons.some(item => item.id === id))) reasons.push("La fixture requiere un arma equipada.");
    }
    return reasons;
  }

  function notice(text: string, error = false): void {
    const box = get("content-notice");
    box.hidden = false;
    box.textContent = text;
    box.dataset.state = error ? "error" : "success";
  }

  function fillSelect(select: HTMLSelectElement, rows: readonly { readonly id: string; readonly name: string }[], preferred: string): void {
    const prior = select.value;
    select.innerHTML = rows.map(row => '<option value="' + escape(row.id) + '">' + escape(row.name) + " · " + escape(row.id) + "</option>").join("");
    if (rows.some(row => row.id === prior)) select.value = prior;
    else if (rows.some(row => row.id === preferred)) select.value = preferred;
  }

  function renderValidation(): void {
    const box = get("content-validation");
    if (!content) {
      if (!box.dataset.error) box.textContent = "Carga el ejemplo o importa un archivo JSON y valida el paquete.";
      return;
    }
    const definitions = Object.entries(content.definitions).map(([family, rows]) => family + ": " + rows.length).join(" · ");
    box.dataset.error = "";
    box.innerHTML = '<strong>Paquete válido</strong><span>' + escape(content.bundleId) + " · revisión " + escape(content.contentRevision) + "</span><span>" + escape(definitions) + "</span>";
  }

  function render(): void {
    const textarea = get<HTMLTextAreaElement>("content-json");
    const robotSelect = get<HTMLSelectElement>("content-robot");
    const terrainSelect = get<HTMLSelectElement>("content-terrain");
    const run = get<HTMLButtonElement>("content-start");
    const diag = fixture?.session.diagnostics();
    const isActive = diag?.state === "active";
    const reasons = content ? selectionIssues(content, robotSelect.value, terrainSelect.value) : ["Valida un paquete JSON primero."];
    const locked = busy || isActive;

    for (const id of ["content-example", "content-validate"]) get<HTMLButtonElement>(id).disabled = locked;
    get<HTMLInputElement>("content-file").disabled = locked;
    textarea.disabled = locked;
    robotSelect.disabled = !content || locked || robotSelect.options.length === 0;
    terrainSelect.disabled = !content || locked || terrainSelect.options.length === 0;
    run.disabled = !content || reasons.length > 0 || locked;
    for (const id of ["content-step", "content-phase", "content-tick"]) get<HTMLButtonElement>(id).disabled = !isActive || busy;
    get<HTMLButtonElement>("content-close").disabled = !isActive || busy;

    const eligibility = get("content-eligibility");
    eligibility.textContent = content
      ? reasons.length === 0
        ? "Esta selección puede inicializar los consumidores de navegación y combate."
        : "El paquete sigue siendo válido. La selección no sirve para la demo: " + reasons.join(" ")
      : "Valida un paquete para ver las opciones.";
    eligibility.dataset.state = content && reasons.length > 0 ? "error" : "success";

    if (diag) {
      get("content-progress").textContent = diag.state + " · tick " + diag.nextTick + " · " + diag.nextPhase + " · " + diag.nextOperation;
      get("content-navigation").textContent = JSON.stringify(fixture!.snapshot().navigation ?? "A la espera del mensaje de navegación", null, 2);
      get("content-combat").textContent = JSON.stringify(fixture!.snapshot().combat ?? "A la espera del mensaje de combate", null, 2);
      const manifest = fixture!.session.trace().manifest;
      const initialState = manifest?.initialState;
      const pinnedContent = initialState !== null && typeof initialState === "object" && !Array.isArray(initialState) && "content" in initialState
        ? initialState.content : initialState ?? {};
      get("content-manifest-data").textContent = JSON.stringify(pinnedContent, null, 2);
      const entries = fixture!.session.trace().entries.slice(-300);
      get("content-trace").innerHTML = entries.length === 0 ? "Sin registros todavía." : entries.map((entry, index) => {
        const label = entry.kind === "published" ? entry.message.type + " · " + entry.message.sourceSystemId : entry.kind;
        const tick = "tick" in entry ? " · tick " + entry.tick : "";
        const phase = "phase" in entry ? " / " + entry.phase : "";
        return '<details><summary>' + (index + 1) + ". " + escape(label) + escape(tick + phase) + "</summary><pre>" + escape(JSON.stringify(entry, null, 2)) + "</pre></details>";
      }).join("");
    } else {
      get("content-progress").textContent = "Sin sesión";
      get("content-navigation").textContent = "Sin datos recibidos";
      get("content-combat").textContent = "Sin datos recibidos";
      get("content-manifest-data").textContent = "Sin sesión";
      get("content-trace").textContent = "Inicia la fixture para observar los mensajes.";
    }
    renderValidation();
  }

  function validateDraft(): void {
    const result = parseContentJson(get<HTMLTextAreaElement>("content-json").value);
    fixture = undefined;
    const box = get("content-validation");
    delete box.dataset.error;
    if (!result.ok) {
      content = undefined;
      get<HTMLSelectElement>("content-robot").innerHTML = "";
      get<HTMLSelectElement>("content-terrain").innerHTML = "";
      box.dataset.error = "true";
      box.innerHTML = "<strong>Paquete rechazado</strong><ul>" + result.issues.map(issue =>
        "<li><code>" + escape(issue.code) + "</code> · <code>" + escape(issue.path) + "</code> — " + escape(issue.message) + "</li>"
      ).join("") + "</ul>";
      notice("No se inició ninguna sesión. Corrige los errores y valida de nuevo.", true);
    } else {
      content = result.content;
      const robots = content.definitions.robots;
      const terrains = content.definitions.terrains;
      fillSelect(get<HTMLSelectElement>("content-robot"), robots, "robot.scout");
      fillSelect(get<HTMLSelectElement>("content-terrain"), terrains, "terrain.floor");
      notice("Paquete válido. Ahora puedes elegir una configuración apta e iniciar la fixture.");
    }
    render();
  }

  async function perform(operation: () => void | Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    render();
    try { await operation(); }
    catch (error) { notice(error instanceof Error ? error.message : String(error), true); }
    finally { busy = false; render(); }
  }

  get("content-json").textContent = JSON.stringify(basicBundle, null, 2);
  get<HTMLButtonElement>("content-example").addEventListener("click", () => {
    get<HTMLTextAreaElement>("content-json").value = JSON.stringify(basicBundle, null, 2);
    validateDraft();
  });
  get<HTMLButtonElement>("content-validate").addEventListener("click", validateDraft);
  get<HTMLTextAreaElement>("content-json").addEventListener("input", () => {
    content = undefined;
    fixture = undefined;
    const box = get("content-validation");
    box.textContent = "El JSON cambió. Valida el paquete antes de iniciar la fixture.";
    delete box.dataset.error;
    notice("El contenido cambió; valida el paquete antes de iniciar una sesión.");
    render();
  });
  get<HTMLInputElement>("content-file").addEventListener("change", event => void perform(async () => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > 1_048_576) throw new Error("El archivo supera el límite de 1 MiB.");
    get<HTMLTextAreaElement>("content-json").value = await file.text();
    validateDraft();
  }));
  get<HTMLSelectElement>("content-robot").addEventListener("change", render);
  get<HTMLSelectElement>("content-terrain").addEventListener("change", render);
  get<HTMLButtonElement>("content-start").addEventListener("click", () => void perform(() => {
    if (!content) throw new Error("Valida un paquete antes de iniciar.");
    const reasons = selectionIssues(content, get<HTMLSelectElement>("content-robot").value, get<HTMLSelectElement>("content-terrain").value);
    if (reasons.length) throw new Error(reasons.join(" "));
    fixture = createContentFixture(content, {
      robotId: get<HTMLSelectElement>("content-robot").value,
      terrainId: get<HTMLSelectElement>("content-terrain").value,
      runtime: navigator.userAgent,
    });
    fixture.session.start();
    fixture.initialize();
    notice("Fixture iniciada. Avanza por pasos, fases o ticks para ver cuándo recibe cada consumidor.");
  }));
  for (const [id, action] of [
    ["content-step", () => fixture!.session.step()],
    ["content-phase", () => fixture!.session.stepPhase()],
    ["content-tick", () => fixture!.session.advanceTick()],
  ] as const) get<HTMLButtonElement>(id).addEventListener("click", () => void perform(action));
  get<HTMLButtonElement>("content-close").addEventListener("click", () => void perform(() => {
    fixture!.session.close("manual-close");
    notice("Sesión cerrada. El manifiesto, la traza y las vistas recibidas quedan visibles hasta validar otro paquete.");
  }));

  validateDraft();
}
