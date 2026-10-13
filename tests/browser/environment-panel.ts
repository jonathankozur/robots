import { createEnvironmentFixture, environmentEvidence, compareEnvironmentEvidence, DEFAULT_SEED, FIXTURE_TICKS } from "../core/environment-fixture.ts";
import type { EnvironmentEvidence } from "../core/environment-fixture.ts";
import { DebugFile } from "./debug-client.ts";

export function mountEnvironmentPanel(container: HTMLElement): void {
  container.innerHTML = '<div class="section-title"><div><span class="eyebrow">ENTORNO DETERMINISTA / ENV-001</span><h2>La misma semilla, el mismo resultado</h2></div><span>20 ticks/s · 50 ms por tick</span></div>'
    + '<p class="muted">Alpha sortea una cantidad y una probabilidad. Envía un comando a Beta, que calcula su propio bono y publica el resultado. Observador solo recibe hechos. Cada secuencia tiene su propio estado; los números de la tabla son unidades internas (1000 = 1 punto).</p>'
    + '<form id="env-setup" class="environment-setup"><label>Semilla (16 dígitos hexadecimales)<input id="env-seed" value="' + DEFAULT_SEED + '" maxlength="16" spellcheck="false"></label><label>Sorteos extra de Beta<input id="env-extra" type="number" value="0" min="0" max="100"></label><label class="debug-toggle"><input id="env-debug" type="checkbox" checked> Debug JSONL</label><button id="env-start" type="submit" class="primary">Crear / reiniciar</button></form>'
    + '<p class="muted small">La configuración se aplica al crear la sesión. Los sorteos extra de Beta permiten comprobar que Alpha mantiene su secuencia. 125 ms de duración equivalen a 3 ticks (150 ms).</p>'
    + '<div class="environment-controls"><button id="env-step">Paso</button><button id="env-phase">Fase</button><button id="env-tick">Tick</button><label>Ticks<input id="env-count" type="number" min="1" max="100" value="6"></label><button id="env-run">Ejecutar N ticks</button><button id="env-pause">Pausar</button><label>Ritmo visual<select id="env-speed"><option value="120">Lento</option><option value="20" selected>Normal</option><option value="0">Rápido</option></select></label><button id="env-close">Cerrar</button></div>'
    + '<div id="env-progress" class="status-strip" aria-live="polite">Sin sesión</div><div id="env-notice" class="notice" role="status" hidden></div>'
    + '<div class="environment-evidence"><button id="env-compare">Repetir y comparar</button><button id="env-export">Exportar evidencia</button><label class="env-import">Comparar referencia Node<input id="env-reference" type="file" accept=".json,application/json"></label></div>'
    + '<p class="muted small">Para comparar Node y Chrome: genera la referencia con el comando de la guía, crea esta sesión con la misma semilla, 0 sorteos extra y completa 6 ticks. Carga el JSON aquí. Se comparan resultados y traza lógica; el loader de replay conserva su validación estricta de runtime.</p>'
    + '<div id="env-log" class="log-status"></div><div class="environment-results"><section><h3>Resultados recibidos por Observador</h3><div class="trace-scroll"><table class="trace-table"><thead><tr><th>Tick</th><th>Alpha / 10000</th><th>Cantidad</th><th>Éxito</th><th>Bono Beta</th><th>Acumulado</th></tr></thead><tbody id="env-results"></tbody></table></div><h3>Mensajes y ejecución</h3><div id="env-trace" class="environment-trace"></div></section><aside><h3>Estado propio y extracciones</h3><pre id="env-state"></pre><details><summary>Entorno del manifiesto</summary><pre id="env-manifest"></pre></details></aside></div>';
  const get = <T extends HTMLElement = HTMLElement>(id: string) => container.querySelector<T>("#" + id)!;
  const escaped = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
  const runtime = navigator.userAgent;
  let fixture: ReturnType<typeof createEnvironmentFixture> | undefined;
  let logger: DebugFile | undefined;
  let seed = DEFAULT_SEED, extra = 0;
  let running = false, busy = false, cancelRun = false;
  const message = (text: string, error = false) => { const box = get("env-notice"); box.hidden = false; box.textContent = text; box.dataset.state = error ? "error" : "success"; };
  function render(): void {
    const p = fixture?.session.diagnostics();
    get("env-progress").textContent = p ? (running ? "Ejecutando" : p.state === "active" ? "Pausada" : p.state) + " · tick " + p.nextTick + (p.tickInProgress ? " parcial" : " completo") + " · " + p.nextPhase + " · " + p.nextOperation : "Sin sesión";
    for (const id of ["env-step", "env-phase", "env-tick", "env-run"]) get<HTMLButtonElement>(id).disabled = !fixture || p?.state !== "active" || busy;
    get<HTMLButtonElement>("env-pause").disabled = !running;
    get<HTMLButtonElement>("env-start").disabled = busy;
    get<HTMLButtonElement>("env-close").disabled = !fixture || busy;
    const canExport = !busy && p?.state === "active" && !p.tickInProgress && p.nextTick > 0;
    for (const id of ["env-compare", "env-export", "env-reference"]) (get(id) as HTMLButtonElement | HTMLInputElement).disabled = !canExport;
    for (const id of ["env-seed", "env-extra", "env-debug"]) get<HTMLInputElement>(id).disabled = !!fixture && p?.state !== "closed";
    const state = fixture?.snapshot();
    get("env-state").textContent = JSON.stringify(state ?? {}, null, 2);
    get("env-manifest").textContent = JSON.stringify(fixture?.session.trace().manifest?.environment ?? {}, null, 2);
    get("env-results").innerHTML = state?.observations.map((row, i) => '<tr><td>' + i + '</td><td>' + row.sample + '</td><td>' + row.amount + '</td><td>' + (row.success ? "Sí" : "No") + '</td><td>' + row.bonus + '</td><td>' + row.total + '</td></tr>').join("") ?? "";
    get("env-trace").innerHTML = fixture?.session.trace().entries.slice(-300).map(entry => '<details><summary>' + escaped(entry.kind) + (entry.kind === "published" ? ' · #' + entry.message.messageId + ' ' + escaped(entry.message.type) : "tick" in entry ? ' · tick ' + entry.tick + ('phase' in entry ? ' / ' + entry.phase : '') : '') + '</summary><pre>' + escaped(JSON.stringify(entry, null, 2)) + '</pre></details>').join("") ?? "";
    get("env-log").innerHTML = logger ? (logger.path ? '<span>' + escaped(logger.path) + '</span><a href="/__debug-log/' + escaped(logger.id) + '">Descargar JSONL del entorno</a>' : "Archivo pendiente") + '<span>' + logger.written + ' registros confirmados · ' + logger.pending + ' pendientes</span>' + (logger.error ? '<span class="error">' + escaped(logger.error) + '</span><button id="env-retry">Reintentar escritura</button>' : '') : "Debug a archivo desactivado.";
    get<HTMLButtonElement>("env-retry")?.addEventListener("click", () => void perform(async () => {
      await logger!.flush(fixture!.session); message("Registro confirmado. Puedes continuar la sesión.");
    }));
  }
  async function perform(operation: () => void | Promise<void>): Promise<void> {
    if (busy) return; busy = true; render();
    try { await operation(); if (logger && fixture) await logger.flush(fixture.session); }
    catch (error) { running = false; cancelRun = true; message(error instanceof Error ? error.message : String(error), true); }
    finally { busy = false; render(); }
  }
  function exportFile(evidence: EnvironmentEvidence): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "environment-evidence.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  get("env-setup").addEventListener("submit", event => {
    event.preventDefault(); void perform(async () => {
      if (logger?.pending) throw new Error("Reintenta los registros pendientes antes de reiniciar.");
      const newSeed = get<HTMLInputElement>("env-seed").value, newExtra = Number(get<HTMLInputElement>("env-extra").value);
      const fresh = createEnvironmentFixture({ seed: newSeed, extraBetaDraws: newExtra, runtime, debug: get<HTMLInputElement>("env-debug").checked });
      if (fixture) {
        fixture.session.close("environment_reset");
        if (logger) await logger.flush(fixture.session);
      }
      fixture = fresh; seed = newSeed; extra = newExtra;
      logger = get<HTMLInputElement>("env-debug").checked ? new DebugFile() : undefined;
      fixture.session.start(); message("Sesión creada. Usa Paso para observar apertura de fase, comando, entrega y resultado.");
    });
  });
  for (const [id, operation] of [["env-step", "step"], ["env-phase", "stepPhase"], ["env-tick", "advanceTick"]] as const) get(id).addEventListener("click", () => void perform(() => { fixture!.session[operation](); }));
  get("env-run").addEventListener("click", () => void perform(async () => {
    const count = Number(get<HTMLInputElement>("env-count").value);
    if (!Number.isSafeInteger(count) || count < 1 || count > 100) throw new Error("Elige entre 1 y 100 ticks.");
    const target = fixture!.session.diagnostics().nextTick + count;
    running = true; cancelRun = false;
    try {
      while (!cancelRun && fixture!.session.diagnostics().nextTick < target) {
        fixture!.session.step(); if (logger) await logger.flush(fixture!.session); render();
        await new Promise(resolve => setTimeout(resolve, Number(get<HTMLSelectElement>("env-speed").value)));
      }
    } finally { running = false; }
  }));
  get("env-pause").addEventListener("click", () => { cancelRun = true; running = false; render(); });
  get("env-close").addEventListener("click", () => void perform(() => { fixture!.session.close(); message("Sesión cerrada. Puedes cambiar la semilla y crear una nueva."); }));
  get("env-compare").addEventListener("click", () => void perform(() => {
    const original = environmentEvidence(fixture!, seed, runtime);
    const repeated = createEnvironmentFixture({ seed, extraBetaDraws: extra, runtime, debug: !logger }); repeated.session.start();
    for (let tick = 0; tick < original.completedTicks; tick++) { repeated.session.step(); repeated.session.stepPhase(); repeated.session.advanceTick(); }
    const result = compareEnvironmentEvidence(original, environmentEvidence(repeated, seed, runtime));
    message((result.equal ? "Coinciden. " : "Difieren. ") + result.detail, !result.equal); repeated.session.close();
  }));
  get("env-export").addEventListener("click", () => void perform(() => { exportFile(environmentEvidence(fixture!, seed, runtime)); }));
  get<HTMLInputElement>("env-reference").addEventListener("change", event => void perform(async () => {
    const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = ""; if (!file) return;
    if (file.size > 16_777_216) throw new Error("La referencia excede 16 MB.");
    if (extra !== 0 || fixture!.session.diagnostics().nextTick !== FIXTURE_TICKS) throw new Error("La referencia Node requiere 0 sorteos extra y exactamente 6 ticks completos.");
    const reference: unknown = JSON.parse(await file.text());
    const result = compareEnvironmentEvidence(reference, environmentEvidence(fixture!, seed, runtime));
    const sourceRuntime = (reference as { runtime?: unknown } | null)?.runtime;
    message((result.equal ? "Node y navegador coinciden. " : "La referencia difiere. ") + result.detail + " Referencia: " + String(sourceRuntime ?? "sin runtime"), !result.equal);
  }));
  render();
}
