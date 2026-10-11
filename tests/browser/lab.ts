import { PHASES } from "../../src/core/index.ts";
import type { Message, Phase, ReplayRecording, TraceEntry } from "../../src/core/index.ts";
import { createLab, validateScenario, presets, compareRuns } from "./scenarios.ts";
import type { Lab, Scenario, Rule, Action } from "./scenarios.ts";
import { DebugFile } from "./debug-client.ts";
import "./lab.css";

const layout = '<header class="app-header"><div class="brand"><span class="brand-mark">R</span><div><strong>ROBOTS</strong><span>Laboratorio de mensajes</span></div></div><div class="file-actions"><button id="save">Guardar escenario</button><button id="export-scenario">Exportar JSON</button><button id="import">Importar</button><input type="file" id="file" accept=".json,application/json" hidden></div></header>'
  + '<div class="app"><aside class="sidebar"><div class="side-label">ESCENARIOS</div><select id="preset" aria-label="Escenario"></select><p id="preset-description"></p><div id="expected" class="muted"></div><button id="duplicate" class="full">Duplicar y editar</button><hr><label class="debug-toggle"><input id="debug-enabled" type="checkbox" checked> Registrar debug a archivo</label><p class="muted small">Cada mensaje, ruta y consumo se guarda en JSONL.</p><div id="log-status" class="log-status">Archivo pendiente de iniciar sesión.</div><button id="retry-log" hidden>Reintentar escritura</button><button id="download-pending" hidden>Descargar registros pendientes</button><hr><div class="side-label">EVIDENCIA</div><button id="export-replay" class="full">Exportar replay</button><button id="replay" class="full">Reproducir y comparar</button><button id="isolation" class="full">Probar segunda sesión</button><button id="export-report" class="full">Exportar reporte</button><hr><p class="small muted">Sistemas ficticios independientes. Fases fijas; pausas reales entre callbacks síncronos.</p></aside>'
  + '<main class="workspace"><div class="title-row"><div><span class="eyebrow">BUS + SCHEDULER / DESARROLLO</span><h1 id="scenario-title"></h1></div><span id="session-state" class="state-badge">Sin iniciar</span></div><div id="notice" role="status" aria-live="polite" class="notice" hidden></div>'
  + '<div class="controls"><button id="start" class="primary">Iniciar sesión</button><button id="reset">Reiniciar</button><div class="control-divider"></div><button id="step">Paso</button><button id="phase">Fase</button><button id="tick">Tick</button><input id="run-count" type="number" min="1" max="1000" value="2" aria-label="Ticks a ejecutar"><button id="run">Ejecutar N ticks</button><button id="pause">Pausar</button><select id="speed" aria-label="Ritmo visual"><option value="160">Lento</option><option value="30" selected>Normal</option><option value="0">Rápido</option></select><button id="close">Cerrar</button></div>'
  + '<div class="status-strip"><span id="tick-status">Tick —</span><span id="phase-status">Fase —</span><span id="operation-status">Próxima operación —</span><span id="completed-status">Último tick completo —</span></div><nav class="tabs" aria-label="Panel principal"><button data-view="simulation" class="active">Simulación</button><button data-view="configuration">Configuración</button><button data-view="comparison">Comparación</button></nav>'
  + '<section id="simulation-view"><div class="simulation-grid"><div class="execution"><div class="section-title"><h2>Fases y entregas</h2><label>Tick visible <select id="visible-tick" aria-label="Tick visible"></select></label></div><div id="phase-board" class="phase-board"></div><div class="section-title"><h2>Traza lógica</h2><span id="trace-completeness"></span></div><div class="trace-controls"><input id="trace-filter" placeholder="Filtrar por sistema, mensaje, fase o evento" aria-label="Filtrar traza"><label><input id="errors-only" type="checkbox"> Solo errores</label><label class="history-control">Recorrer evidencia <input id="history" type="range" min="0" max="0" value="0" aria-label="Registro histórico"></label><button id="live">Ver cursor actual</button></div><div id="history-status" class="muted small"></div><div class="trace-scroll"><table class="trace-table"><thead><tr><th>#</th><th>Tick / fase</th><th>Operación</th><th>Mensaje / sistema</th></tr></thead><tbody id="trace-rows"></tbody></table></div></div>'
  + '<aside class="inspector"><h2>Inspector</h2><div id="message-inspector" class="empty">Selecciona un mensaje o un registro.</div><details open><summary>Causalidad</summary><div id="causal-graph" class="causal-graph"></div></details><details open><summary id="queue-heading">Colas</summary><div id="queues"></div></details><details><summary>Estado propio de fixtures</summary><div id="local-states"></div></details><details><summary>Diagnóstico de sesión</summary><pre id="diagnostics"></pre></details></aside></div>'
  + '<section class="input-panel"><div><h2>Entrada manual</h2><p class="muted small">Antes del corte: se admite en este tick. Después del corte: espera al siguiente. El bus asigna la cabecera.</p></div><form id="manual-input"><label>Adaptador<select id="manual-source"></select></label><label>Contrato<select id="manual-contract"></select></label><label>Session ID<input id="manual-session"></label><label class="payload-field">Payload JSON<textarea id="manual-payload" rows="3">{"operationId":"op-manual"}</textarea></label><button type="submit" id="inject" class="primary">Preparar entrada</button></form></section></section>'
  + '<section id="configuration-view" hidden><div class="section-title"><h2>Definición del escenario</h2><span class="muted">Edita durante preparación; reinicia para aplicar cambios.</span></div><div class="editor-tabs"><button data-editor="systems">Sistemas</button><button data-editor="contracts">Contratos</button><button data-editor="routes">Suscripciones</button><button data-editor="rules">Reglas</button><button data-editor="inputs">Entradas programadas</button><button data-editor="limits">Sesión y límites</button><button data-editor="json">JSON completo</button></div><div id="editor"></div><div class="editor-actions"><button id="validate">Validar configuración</button><button id="apply-json" hidden>Aplicar JSON</button></div></section>'
  + '<section id="comparison-view" hidden><h2>Reproducción y sesiones independientes</h2><p class="muted">El replay reconstruye propietarios nuevos y usa las entradas admitidas, sin inputs vivos. La comparación exige trazas completas.</p><div id="comparison-result" class="comparison-result">Todavía no hay una comparación.</div><div id="comparison-details"></div></section></main></div>';
document.body.innerHTML = layout;

function el<T extends HTMLElement = HTMLElement>(id: string): T { return document.getElementById(id) as T; }
function escape(value: unknown): string { return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!); }
function json(value: unknown): string { return JSON.stringify(value, null, 2); }
function option(value: string, label = value, selected = false): string { return '<option value="' + escape(value) + '"' + (selected ? " selected" : "") + '>' + escape(label) + '</option>'; }
function download(name: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([json(value)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function notice(message: string, error = false): void { const box = el("notice"); box.hidden = false; box.textContent = message; box.dataset.state = error ? "error" : "success"; }
let draft: Scenario = structuredClone(presets[0]!.scenario);
let lab: Lab | undefined;
let logger: DebugFile | undefined;
let recordingMode = false;
let running = false;
let busy = false;
let editorMode = "systems";
let editing = -1;
let currentPreset = presets[0]!;
let selectedMessage = 0;
let selectedRecord = -1;
let visibleTick: number | null = null;
let historyIndex: number | null = null;
let comparison: { title: string; detail: string; data: unknown; equal: boolean } | undefined;
let importedEvidence: { trace: ReturnType<Lab["session"]["trace"]>; states: [string, Record<string, unknown>][] } | undefined;
const savedKey = "robots-lab-scenarios-v2";
function saved(): Record<string, Scenario> { try { return JSON.parse(localStorage.getItem(savedKey) ?? "{}"); } catch { return {}; } }
function fillCatalog(): void {
  el<HTMLSelectElement>("preset").innerHTML = '<optgroup label="Escenarios de referencia">' + presets.map(p => option(p.id, p.name, p.id === currentPreset.id)).join("")
    + '</optgroup><optgroup label="Mis escenarios">' + Object.keys(saved()).map(name => option("saved:" + name, name)).join("") + '</optgroup>';
}
function changeView(view: string): void {
  for (const name of ["simulation", "configuration", "comparison"]) el(name + "-view").hidden = name !== view;
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(button => { button.classList.toggle("active", button.dataset.view === view); });
}
function trace(): readonly TraceEntry[] { return lab?.session.trace().entries ?? []; }
function messages(): Message[] { return trace().filter(entry => entry.kind === "published").map(entry => entry.message); }
function describe(entry: TraceEntry): string {
  if (entry.kind === "published") return "#" + entry.message.messageId + " " + entry.message.type + " · " + entry.message.sourceSystemId;
  if ("messageId" in entry) return "#" + entry.messageId + " → " + entry.receiver;
  if ("systemId" in entry) return (entry.systemId ?? "controlador") + ("code" in entry ? " · " + entry.code : "");
  if ("source" in entry) return entry.source + ("reason" in entry ? " · " + entry.reason : "");
  if (entry.kind === "closed") return entry.reason + " · " + entry.discardedDeliveries + " descartadas";
  return "—";
}
const eventLabels: Record<TraceEntry["kind"], string> = { started: "Sesión iniciada", published: "Mensaje publicado", routed: "Ruta encolada", discarded: "Entrega descartada", consumption_started: "Consumo iniciado", consumption_finished: "Consumo terminado", external_admitted: "Entrada admitida", external_rejected: "Entrada rechazada", failed: "Sesión fallida", rejected: "Violación de contrato", loop_started: "Loop iniciado", loop_finished: "Loop terminado", tick_completed: "Tick confirmado", phase_started: "Fase abierta / corte", phase_finished: "Fase terminada", closed: "Sesión cerrada" };
function entryTick(entry: TraceEntry): number | null { return "tick" in entry ? entry.tick : entry.kind === "published" ? entry.message.emittedTick : null; }
function entryPhase(entry: TraceEntry): Phase | null { return "phase" in entry ? entry.phase : entry.kind === "published" ? entry.message.emittedPhase : null; }
function historicalQueues(entries: readonly TraceEntry[], end: number) {
  const map = new Map<string, { messageId: number; receiver: string; tick: number; phase: Phase }>();
  for (const entry of entries.slice(0, end + 1)) {
    if (entry.kind === "routed") map.set(entry.messageId + ":" + entry.receiver, entry);
    if (entry.kind === "consumption_finished" || entry.kind === "discarded") map.delete(entry.messageId + ":" + entry.receiver);
  }
  return [...map.values()];
}
function render(): void {
  const session = lab?.session; const progress = session?.diagnostics(); const entries = trace(); const allMessages = messages();
  el("scenario-title").textContent = draft.name;
  el("preset-description").textContent = currentPreset.description;
  el("expected").textContent = currentPreset.expectedCode ? "Fallo esperado: " + currentPreset.expectedCode : "Resultado esperado: sesión sana";
  el("session-state").textContent = running ? "Ejecutando" : progress?.state === "active" ? "Pausada" : progress?.state === "failed" ? "Fallida" : progress?.state === "closed" ? "Cerrada" : "Sin iniciar";
  el("session-state").dataset.state = progress?.state ?? "preparing";
  el("tick-status").textContent = "Tick " + (progress?.nextTick ?? "—") + (progress?.tickInProgress ? " · parcial" : "");
  el("phase-status").textContent = "Próxima fase: " + (progress?.nextPhase ?? "input");
  el("operation-status").textContent = "Próxima operación: " + (progress?.nextOperation ?? "—");
  el("completed-status").textContent = "Último tick completo: " + (progress?.lastCompletedTick ?? "ninguno");
  const active = progress?.state === "active";
  for (const id of ["step", "phase", "tick", "run", "inject"]) el<HTMLButtonElement>(id).disabled = !active || busy;
  el<HTMLButtonElement>("pause").disabled = !running;
  el<HTMLButtonElement>("start").disabled = busy || active === true;
  for (const id of ["reset", "close", "preset", "import", "duplicate"]) (el(id) as HTMLButtonElement).disabled = busy;
  el<HTMLInputElement>("debug-enabled").disabled = !!lab && lab.session.state !== "closed";
  for (const id of ["export-replay", "replay"]) el<HTMLButtonElement>(id).disabled = !active || progress?.tickInProgress === true || session?.trace().complete !== true || busy;
  el<HTMLButtonElement>("isolation").disabled = busy;
  el<HTMLButtonElement>("retry-log").hidden = !logger?.error;
  el<HTMLButtonElement>("download-pending").hidden = !logger?.pending;
  el("log-status").innerHTML = logger ? (logger.path ? '<span class="log-path">' + escape(logger.path) + '</span><a href="/__debug-log/' + escape(logger.id) + '">Descargar JSONL</a>' : "Archivo todavía no creado")
    + '<span>' + logger.written + ' registros escritos' + (logger.pending ? ' · ' + logger.pending + ' pendientes' : '') + '</span>' + (logger.error ? '<strong class="error">' + escape(logger.error) + '</strong>' : '') : el<HTMLInputElement>("debug-enabled").checked ? "Archivo pendiente de iniciar sesión." : "Registro a archivo desactivado.";
  const ticks = new Set([progress?.nextTick ?? 0]); entries.forEach(entry => { const tick = entryTick(entry); if (tick !== null) ticks.add(tick); });
  const tick = visibleTick ?? progress?.nextTick ?? 0;
  el<HTMLSelectElement>("visible-tick").innerHTML = [...ticks].sort((a, b) => a - b).map(t => option(String(t), String(t), t === tick)).join("");
  const currentQueues = session?.inspect().deliveries ?? [];
  el("phase-board").innerHTML = PHASES.map((phase, index) => {
    const routed = entries.flatMap(entry => entry.kind === "routed" && entry.tick === tick && entry.phase === phase ? [entry] : []);
    const loops = entries.filter(entry => entry.kind === "loop_started" && entry.tick === tick && entry.phase === phase).length;
    const current = active && progress.nextTick === tick && progress.nextPhase === phase;
    return '<section class="phase-lane' + (current ? " current" : "") + '"><div class="phase-title"><span>0' + (index + 1) + '</span><strong>' + phase + '</strong></div><div class="phase-count">' + routed.length + ' entregas · ' + loops + ' loops</div>'
      + routed.slice(0, 40).map(route => {
        const message = allMessages.find(m => m.messageId === route.messageId); const pending = currentQueues.some(q => q.message.messageId === route.messageId && q.receiver === route.receiver);
        const discarded = entries.some(entry => entry.kind === "discarded" && entry.messageId === route.messageId && entry.receiver === route.receiver);
        const consumed = entries.some(entry => entry.kind === "consumption_finished" && entry.messageId === route.messageId && entry.receiver === route.receiver);
        const status = pending ? "pendiente" : discarded ? "descartada" : consumed ? "consumida" : "consultar diagnóstico";
        return '<button class="message-token ' + (pending ? "pending" : "consumed") + '" data-message="' + route.messageId + '"><strong>#' + route.messageId + ' ' + escape(message?.type ?? "mensaje") + '</strong><span>→ ' + escape(route.receiver) + '</span><small>' + status + '</small></button>';
      }).join("") + (!routed.length ? '<div class="empty-lane">Sin entregas</div>' : routed.length > 40 ? '<span>+' + (routed.length - 40) + ' · ver traza</span>' : '') + '</section>';
  }).join("");
  const snapshot = session?.trace(); el("trace-completeness").textContent = entries.length + ' registros · ' + (snapshot?.complete === false ? 'incompleta (' + snapshot.droppedEntries + ' omitidos)' : 'completa');
  el("trace-completeness").className = snapshot?.complete === false ? "error" : "muted small";
  const filter = el<HTMLInputElement>("trace-filter").value.toLowerCase(); const errorsOnly = el<HTMLInputElement>("errors-only").checked;
  const rows = entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => (!errorsOnly || ["failed", "rejected", "external_rejected"].includes(entry.kind)) && (!filter || JSON.stringify(entry).toLowerCase().includes(filter)));
  el("trace-rows").innerHTML = rows.slice(-1000).map(({ entry, index }) => '<tr tabindex="0" data-record="' + index + '" class="' + (index === selectedRecord ? "selected " : "") + (["failed", "rejected", "external_rejected"].includes(entry.kind) ? "fault-row" : "") + '"><td>' + (index + 1) + '</td><td>' + (entryTick(entry) ?? "—") + ' <span>' + (entryPhase(entry) ?? "") + '</span></td><td>' + eventLabels[entry.kind] + '</td><td>' + escape(describe(entry)) + '</td></tr>').join("");
  const history = el<HTMLInputElement>("history"); history.max = String(Math.max(0, entries.length - 1)); history.value = String(historyIndex ?? Math.max(0, entries.length - 1));
  el("history-status").textContent = historyIndex === null ? "Cursor real. La tabla muestra como máximo los últimos 1000 registros filtrados." : "Vista histórica del registro " + (historyIndex + 1) + ". Recorrer evidencia no ejecuta ni retrocede la simulación.";
  const message = allMessages.find(m => m.messageId === selectedMessage);
  const entry = selectedRecord >= 0 ? entries[selectedRecord] : undefined;
  el("message-inspector").innerHTML = message ? '<h3>#' + message.messageId + ' ' + escape(message.type) + '</h3><div class="inspector-meta">' + escape(message.sourceSystemId) + ' · tick ' + message.emittedTick + ' / ' + message.emittedPhase + '</div><pre>' + escape(json(message)) + '</pre>'
    : entry ? '<h3>' + eventLabels[entry.kind] + '</h3><pre>' + escape(json(entry)) + '</pre>' : '<p class="muted">Selecciona un mensaje o un registro.</p>';
  const related = message ? allMessages.filter(m => m.correlationId === message.correlationId) : allMessages;
  el("causal-graph").innerHTML = related.slice(0, 80).map(m => '<button data-message="' + m.messageId + '" class="causal-node' + (m.messageId === selectedMessage ? " selected" : "") + '"><small>' + (m.causationIds.length ? 'causa ' + m.causationIds.map(id => "#" + id).join(", ") + ' →' : 'raíz · correlación #' + m.correlationId) + '</small><strong>#' + m.messageId + ' ' + escape(m.type) + '</strong><span>' + escape(m.sourceSystemId) + '</span></button>').join("") || '<span class="muted">Todavía no hay mensajes.</span>';
  const historical = historyIndex !== null ? historicalQueues(entries, historyIndex) : null;
  el("queue-heading").textContent = historical ? "Colas históricas · " + historical.length : "Colas actuales · " + (progress?.pendingDeliveries ?? 0) + '/' + draft.limits.maxDeliveries;
  el("queues").innerHTML = (historical ?? currentQueues.map(q => ({ messageId: q.message.messageId, ...q }))).map(q => '<button data-message="' + q.messageId + '" class="queue-row"><strong>#' + q.messageId + ' → ' + escape(q.receiver) + '</strong><span>tick ' + q.tick + ' / ' + q.phase + ('status' in q ? ' · ' + q.status : '') + '</span></button>').join("") || '<p class="muted small">Sin entregas pendientes.</p>';
  if (!historical) el("queues").innerHTML += '<div class="muted small">Entradas externas: ' + (progress?.pendingExternalInputs ?? 0) + '/' + draft.limits.maxExternalInputs + '</div><pre>' + escape(json(session?.inspect().stagedInputs ?? [])) + '</pre>';
  el("local-states").innerHTML = lab ? [...lab.states].map(([id, state]) => '<h3>' + escape(id) + '</h3><pre>' + escape(json(state)) + '</pre>').join("") : "Sin sesión";
  el("diagnostics").textContent = json(progress ?? {});
  if (comparison) {
    el("comparison-result").textContent = comparison.title + " · " + comparison.detail; el("comparison-result").dataset.state = comparison.equal ? "success" : "error";
    el("comparison-details").innerHTML = '<pre>' + escape(json(comparison.data)) + '</pre>';
  }
  const configLocked = !!lab && lab.session.state !== "closed";
  el<HTMLButtonElement>("apply-json").disabled = configLocked || busy;
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>("#editor input, #editor select, #editor textarea, #editor button").forEach(input => { input.disabled = configLocked || busy; });
  el<HTMLButtonElement>("validate").disabled = busy;
}
function fillManual(): void {
  const existing = el<HTMLSelectElement>("manual-contract").value;
  el<HTMLSelectElement>("manual-source").innerHTML = draft.systems.filter(system => system.kind === "adapter").map(system => option(system.id)).join("");
  el<HTMLSelectElement>("manual-contract").innerHTML = draft.contracts.filter(contract => contract.producers.some(p => draft.systems.some(s => s.id === p.systemId && s.kind === "adapter"))).map(contract => option(contract.type + "@" + contract.version, contract.type + " @ " + contract.version, existing === contract.type + "@" + contract.version)).join("");
  el<HTMLInputElement>("manual-session").value = draft.sessionId;
}
async function flush(): Promise<void> { if (lab && logger) await logger.flush(lab.session); }
async function stopAndClear(): Promise<void> {
  running = false;
  if (lab) { lab.session.close("harness-reset"); await flush(); }
  lab = undefined; logger = undefined; recordingMode = false; importedEvidence = undefined;
  selectedMessage = 0; selectedRecord = -1; visibleTick = null; historyIndex = null;
}
async function begin(): Promise<void> {
  await stopAndClear(); validateScenario(draft); lab = createLab(draft, el<HTMLInputElement>("debug-enabled").checked);
  logger = el<HTMLInputElement>("debug-enabled").checked ? new DebugFile() : undefined;
  lab.session.start(); await flush(); fillManual();
  notice("Sesión iniciada y pausada. Avanza un paso, una fase o un tick.");
}
async function operation(mode: "step" | "phase" | "tick"): Promise<void> {
  if (!lab) throw new Error("Inicia una sesión primero.");
  if (logger?.error) throw new Error("Reintenta el log antes de continuar; los registros pendientes están conservados.");
  if (!recordingMode) lab.stageScheduled();
  let fault: unknown;
  try { if (mode === "step") lab.session.step(); else if (mode === "phase") lab.session.stepPhase(); else lab.session.advanceTick(); } catch (error) { fault = error; }
  await flush(); historyIndex = null;
  if (fault) throw fault;
}
async function perform(action: () => Promise<void> | void): Promise<void> {
  if (busy) return; busy = true; render();
  try { await action(); } catch (error) { notice(error instanceof Error ? error.message : String(error), true); }
  finally {
    try { await flush(); } catch (error) { notice("La escritura del log falló: " + (error instanceof Error ? error.message : String(error)), true); }
    busy = false; render();
  }
}
async function replay(): Promise<void> {
  if (!lab) throw new Error("No hay sesión original.");
  const recording = lab.session.exportReplay(); const original = lab;
  const reproduced = createLab(original.scenario); reproduced.session.loadReplay(recording); reproduced.session.start();
  for (let i = 0; i < recording.completedTicks; i++) reproduced.session.advanceTick();
  const result = compareRuns(original, reproduced);
  comparison = { title: result.equal ? "Replay verificado" : "Replay diferente", detail: result.detail, equal: result.equal,
    data: { ticks: recording.completedTicks, inputs: recording.inputs.length, original: original.session.diagnostics(), replay: reproduced.session.diagnostics(), states: [...reproduced.states] } };
  changeView("comparison"); notice(result.detail, !result.equal);
}
function report() { return { kind: "report", scenario: lab?.scenario ?? draft, trace: lab?.session.trace() ?? null, diagnostics: lab?.session.diagnostics() ?? null, states: lab ? [...lab.states] : [], log: logger ? { path: logger.path, written: logger.written, error: logger.error, pending: logger.pendingRecords() } : null }; }
function rowTable(headers: string[], rows: string[][]): string { return '<div class="editor-table"><table><thead><tr>' + headers.map(h => '<th>' + h + '</th>').join("") + '<th>Acciones</th></tr></thead><tbody>' + rows.map((row, i) => '<tr>' + row.map(value => '<td>' + value + '</td>').join("") + '<td class="row-actions"><button type="button" data-edit="' + i + '">Editar</button><button type="button" data-up="' + i + '" aria-label="Subir fila">↑</button><button type="button" data-down="' + i + '" aria-label="Bajar fila">↓</button><button type="button" data-remove="' + i + '">Quitar</button></td></tr>').join("") + '</tbody></table></div>'; }
function field(label: string, name: string, value: unknown = "", type = "text"): string { return '<label>' + label + '<input name="' + name + '" type="' + type + '" value="' + escape(value) + '"' + (type === "number" ? ' step="1"' : '') + ' required></label>'; }
function area(label: string, name: string, value: unknown): string { return '<label class="wide">' + label + '<textarea name="' + name + '" rows="5" spellcheck="false">' + escape(json(value)) + '</textarea></label>'; }
function selectField(label: string, name: string, values: string[], selected?: string): string { return '<label>' + label + '<select name="' + name + '">' + values.map(value => option(value, value || "Sin loop", value === selected)).join("") + '</select></label>'; }
function sourceArray(): unknown[] { if (editorMode === "systems") return draft.systems; if (editorMode === "contracts") return draft.contracts; if (editorMode === "routes") return draft.subscriptions; if (editorMode === "rules") return draft.rules; return draft.inputs; }
function renderEditor(): void {
  document.querySelectorAll<HTMLElement>("[data-editor]").forEach(button => button.classList.toggle("active", button.dataset.editor === editorMode));
  el<HTMLButtonElement>("apply-json").hidden = editorMode !== "json";
  const editor = el("editor");
  if (editorMode === "json") { editor.innerHTML = '<label class="wide">Escenario completo<textarea id="scenario-json" rows="28" spellcheck="false">' + escape(json(draft)) + '</textarea></label>'; render(); return; }
  if (editorMode === "limits") {
    editor.innerHTML = '<form id="edit-form" class="edit-form">' + field("Nombre", "name", draft.name) + field("Session ID", "sessionId", draft.sessionId) + field("Revisión", "revision", draft.revision) + field("Runtime", "runtime", draft.runtime)
      + Object.entries(draft.limits).map(([key, value]) => field(key, key, value, "number")).join("") + area("Estado inicial declarado", "initialState", draft.initialState) + '<button type="submit" class="primary">Aplicar sesión y límites</button></form>'; render(); return;
  }
  const item = sourceArray()[editing] as Record<string, unknown> | undefined; let fields = ""; let table = "";
  if (editorMode === "systems") {
    fields = field("ID del sistema", "id", item?.id ?? "new-system") + selectField("Clase", "kind", ["system", "adapter"], item?.kind as string ?? "system") + selectField("Fase del loop", "loopPhase", ["", ...PHASES], item?.loopPhase as string ?? "") + area("Estado propio inicial", "state", item?.state ?? {});
    table = rowTable(["Sistema", "Clase", "Loop", "Estado"], draft.systems.map(s => [escape(s.id), s.kind, s.loopPhase ?? "—", escape(JSON.stringify(s.state))]));
  } else if (editorMode === "contracts") {
    fields = field("Nombre del mensaje", "type", item?.type ?? "NewEvent") + field("Versión", "version", item?.version ?? 1, "number") + selectField("Clase", "kind", ["event", "command"], item?.kind as string ?? "event") + '<label>Responsable del comando<input name="responsibleSystemId" value="' + escape(item?.responsibleSystemId ?? "") + '"></label>' + area("Productores y fases autorizadas", "producers", item?.producers ?? [{ systemId: "processor", phases: ["action"] }]) + area("Esquema de campos", "fields", item?.fields ?? { value: { type: "number", integer: true, min: 0 } });
    table = rowTable(["Contrato", "Clase", "Productores", "Responsable"], draft.contracts.map(c => [escape(c.type) + " @ " + c.version, c.kind, escape(c.producers.map(p => p.systemId + ": " + p.phases.join(",")).join(" · ")), escape(c.responsibleSystemId ?? "—")]));
  } else if (editorMode === "routes") {
    fields = selectField("Receptor", "systemId", draft.systems.filter(s => s.kind === "system").map(s => s.id), item?.systemId as string) + selectField("Contrato", "contract", draft.contracts.map(c => c.type + "@" + c.version), item ? item.type + "@" + item.version : undefined) + selectField("Fase de recepción", "phase", [...PHASES], item?.phase as string ?? "action");
    table = rowTable(["Receptor", "Contrato", "Fase"], draft.subscriptions.map(r => [escape(r.systemId), escape(r.type) + " @ " + r.version, r.phase]));
  } else if (editorMode === "rules") {
    const rule = item as unknown as Rule | undefined;
    fields = selectField("Sistema propietario", "systemId", draft.systems.filter(s => s.kind === "system").map(s => s.id), rule?.systemId)
      + area("Disparador", "trigger", rule?.trigger ?? { kind: "receive", type: "Request", version: 1 }) + area("Condición opcional (null = siempre)", "condition", rule?.condition ?? null) + area("Acciones declarativas", "actions", rule?.actions ?? [{ op: "increment", key: "received" }]);
    table = rowTable(["Sistema", "Disparador", "Condición", "Acciones"], draft.rules.map(r => [escape(r.systemId), escape(JSON.stringify(r.trigger)), escape(JSON.stringify(r.condition ?? "siempre")), escape(r.actions.map(a => a.op).join(" → "))]));
    fields += '<p class="wide muted small">Acciones: send, emit, remember, set, increment, clear, fault. Plantillas: $input.payload.campo, $state.campo, $tick, $phase. Un loop puede declarar causes: "remembered". Cada regla lee y escribe solo el estado de su sistema.</p>';
  } else {
    fields = field("Tick de admisión", "tick", item?.tick ?? 0, "number") + selectField("Adaptador", "source", draft.systems.filter(s => s.kind === "adapter").map(s => s.id), item?.source as string) + selectField("Contrato", "contract", draft.contracts.map(c => c.type + "@" + c.version), item ? item.type + "@" + item.version : undefined) + area("Payload", "payload", item?.payload ?? { operationId: "op-002" });
    table = rowTable(["Tick", "Adaptador", "Contrato", "Payload"], draft.inputs.map(i => [String(i.tick), escape(i.source), escape(i.type) + " @ " + i.version, escape(JSON.stringify(i.payload))]));
  }
  editor.innerHTML = table + '<form id="edit-form" class="edit-form">' + fields + '<div class="wide"><button type="submit" class="primary">' + (editing >= 0 ? "Guardar cambios" : "Añadir") + '</button> <button type="button" id="cancel-edit">Nueva fila</button></div></form>'; render();
}
function contractParts(value: string): { type: string; version: number } { const index = value.lastIndexOf("@"); if (index < 0) throw new Error("Selecciona un contrato."); return { type: value.slice(0, index), version: Number(value.slice(index + 1)) }; }
function applyForm(data: FormData): void {
  const text = (name: string) => String(data.get(name) ?? ""); const read = (name: string) => JSON.parse(text(name));
  let value: unknown;
  if (editorMode === "systems") value = { id: text("id"), kind: text("kind"), state: read("state"), ...(text("loopPhase") ? { loopPhase: text("loopPhase") } : {}) };
  else if (editorMode === "contracts") value = { type: text("type"), version: Number(text("version")), kind: text("kind"), producers: read("producers"), fields: read("fields"), ...(text("responsibleSystemId") ? { responsibleSystemId: text("responsibleSystemId") } : {}) };
  else if (editorMode === "routes") value = { systemId: text("systemId"), ...contractParts(text("contract")), phase: text("phase") };
  else if (editorMode === "rules") { const condition = read("condition"); value = { systemId: text("systemId"), trigger: read("trigger"), actions: read("actions"), ...(condition ? { condition } : {}) }; }
  else if (editorMode === "inputs") value = { tick: Number(text("tick")), source: text("source"), ...contractParts(text("contract")), payload: read("payload") };
  else { draft = { ...draft, name: text("name"), sessionId: text("sessionId"), revision: text("revision"), runtime: text("runtime"), initialState: read("initialState"), limits: Object.fromEntries(Object.keys(draft.limits).map(key => [key, Number(text(key))])) as Scenario["limits"] }; }
  if (value) { const rows = sourceArray(); if (editing >= 0) rows[editing] = value; else rows.push(value); }
  editing = -1; fillManual(); renderEditor(); notice("Escenario editado. Valida la configuración antes de iniciar.");
}

document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(button => button.addEventListener("click", () => changeView(button.dataset.view!)));
document.querySelectorAll<HTMLButtonElement>("[data-editor]").forEach(button => button.addEventListener("click", () => { editorMode = button.dataset.editor!; editing = -1; renderEditor(); }));
el("start").addEventListener("click", () => void perform(begin));
el("reset").addEventListener("click", () => void perform(begin));
for (const [id, mode] of [["step", "step"], ["phase", "phase"], ["tick", "tick"]] as const) el(id).addEventListener("click", () => void perform(() => operation(mode)));
el("close").addEventListener("click", () => void perform(async () => { lab?.session.close("manual-close"); await flush(); renderEditor(); notice("Sesión cerrada. El tick parcial no se confirma; las rutas pendientes quedan registradas como descartes."); }));
el("pause").addEventListener("click", () => { running = false; notice("Pausa solicitada; se detiene antes de la siguiente operación."); render(); });
el("run").addEventListener("click", () => void perform(async () => {
  if (!lab) return;
  const count = Number(el<HTMLInputElement>("run-count").value); if (!Number.isSafeInteger(count) || count < 1 || count > 1000) throw new Error("Elige entre 1 y 1000 ticks.");
  const goal = lab.session.diagnostics().nextTick + count; running = true;
  try { while (running && lab.session.diagnostics().nextTick < goal) { await operation("step"); render(); await new Promise(resolve => setTimeout(resolve, Number(el<HTMLSelectElement>("speed").value))); } }
  finally { running = false; }
  notice(lab.session.diagnostics().nextTick >= goal ? "Ejecución terminada." : "Pausa real: no se ejecutarán más operaciones hasta que continúes.");
}));
el("manual-input").addEventListener("submit", event => { event.preventDefault(); void perform(async () => {
  if (!lab) return; const parts = contractParts(el<HTMLSelectElement>("manual-contract").value);
  const accepted = lab.session.stageExternalInput(el<HTMLSelectElement>("manual-source").value, { sessionId: el<HTMLInputElement>("manual-session").value, ...parts, payload: JSON.parse(el<HTMLTextAreaElement>("manual-payload").value) });
  await flush(); notice(accepted ? "Entrada preparada. Se admitirá en el próximo corte de input." : "Entrada rechazada; revisa la traza.", !accepted);
}); });
el("replay").addEventListener("click", () => void perform(replay));
el("isolation").addEventListener("click", () => void perform(() => {
  const before = lab ? json(report()) : null; const scenario = structuredClone(draft); scenario.sessionId += "-isolated";
  const second = createLab(scenario); second.session.start(); second.stageScheduled(); second.session.advanceTick();
  const equal = before === (lab ? json(report()) : null);
  comparison = { title: "Segunda sesión", detail: equal ? "La sesión original conserva traza, estado, IDs y colas." : "La sesión original cambió.", equal,
    data: { original: lab?.session.diagnostics() ?? null, separate: second.session.diagnostics(), separateSessionId: scenario.sessionId, states: [...second.states] } }; changeView("comparison");
}));
el("export-replay").addEventListener("click", () => void perform(() => { if (lab) download("robots-replay.json", { kind: "replay", scenario: lab.scenario, recording: lab.session.exportReplay(), expected: { trace: lab.session.trace(), states: [...lab.states] } }); }));
el("export-report").addEventListener("click", () => download("robots-report.json", report()));
el("export-scenario").addEventListener("click", () => download("robots-scenario.json", { kind: "scenario", scenario: draft }));
el("retry-log").addEventListener("click", () => void perform(async () => { await flush(); notice("Registros pendientes escritos sin duplicarlos."); }));
el("download-pending").addEventListener("click", () => download("robots-pending-debug.json", logger?.pendingRecords() ?? []));
el("duplicate").addEventListener("click", () => void perform(async () => { await stopAndClear(); draft = structuredClone(draft); draft.name += " · copia"; editorMode = "systems"; renderEditor(); changeView("configuration"); }));
el("save").addEventListener("click", () => void perform(() => { validateScenario(draft); const values = saved(); values[draft.name] = structuredClone(draft); localStorage.setItem(savedKey, JSON.stringify(values)); fillCatalog(); notice("Escenario guardado en este navegador. Exporta JSON para compartirlo."); }));
el<HTMLSelectElement>("preset").addEventListener("change", () => void perform(async () => {
  const id = el<HTMLSelectElement>("preset").value; await stopAndClear();
  currentPreset = id.startsWith("saved:") ? { id, name: id.slice(6), description: "Escenario local editable.", scenario: saved()[id.slice(6)]! } : presets.find(p => p.id === id)!;
  draft = structuredClone(currentPreset.scenario); comparison = undefined; editing = -1; fillManual(); renderEditor(); notice("Escenario cargado. Inicia una sesión para probarlo.");
}));
el("import").addEventListener("click", () => el<HTMLInputElement>("file").click());
el<HTMLInputElement>("file").addEventListener("change", () => void perform(async () => {
  const file = el<HTMLInputElement>("file").files?.[0]; if (!file) return;
  if (file.size > 5_000_000) throw new Error("El archivo supera 5 MB.");
  const contents = JSON.parse(await file.text()); const scenario = contents.scenario ?? contents; validateScenario(scenario);
  await stopAndClear(); draft = structuredClone(scenario); currentPreset = { id: "imported", name: draft.name, description: "Escenario importado desde archivo.", scenario: draft };
  if (contents.kind === "replay") {
    lab = createLab(draft, el<HTMLInputElement>("debug-enabled").checked); logger = el<HTMLInputElement>("debug-enabled").checked ? new DebugFile() : undefined;
    lab.session.loadReplay(contents.recording as ReplayRecording); lab.session.start(); recordingMode = true; importedEvidence = contents.expected; await flush();
  }
  fillManual(); renderEditor(); notice(recordingMode ? "Replay cargado y pausado. Las entradas manuales están prohibidas por el núcleo." : "Escenario importado."); el<HTMLInputElement>("file").value = "";
}));
el("validate").addEventListener("click", () => void perform(() => {
  const candidate = editorMode === "json" ? JSON.parse(el<HTMLTextAreaElement>("scenario-json").value) : draft; validateScenario(candidate);
  const session = createLab(candidate).session; session.start(); session.close(); notice("Catálogo, sistemas, contratos y suscripciones válidos. No se ejecutaron ticks.");
}));
el("apply-json").addEventListener("click", () => void perform(() => { const value = JSON.parse(el<HTMLTextAreaElement>("scenario-json").value); validateScenario(value); draft = value; fillManual(); renderEditor(); notice("JSON aplicado al escenario."); }));
el("editor").addEventListener("submit", event => {
  event.preventDefault(); const data = new FormData(event.target as HTMLFormElement);
  void perform(() => applyForm(data));
});
el("editor").addEventListener("click", event => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button"); if (!button || button.type === "submit" || button.disabled) return;
  if (button.id === "cancel-edit") { editing = -1; renderEditor(); return; }
  if (button.dataset.edit !== undefined) { editing = Number(button.dataset.edit); renderEditor(); return; }
  const rows = sourceArray();
  if (button.dataset.remove !== undefined) rows.splice(Number(button.dataset.remove), 1);
  for (const [key, delta] of [["up", -1], ["down", 1]] as const) if (button.dataset[key] !== undefined) { const index = Number(button.dataset[key]); const target = index + delta; if (target >= 0 && target < rows.length) [rows[index], rows[target]] = [rows[target], rows[index]]; }
  editing = -1; fillManual(); renderEditor();
});
el("simulation-view").addEventListener("click", event => {
  const target = (event.target as Element).closest<HTMLElement>("[data-message], [data-record]"); if (!target) return;
  if (target.dataset.message) { selectedMessage = Number(target.dataset.message); selectedRecord = -1; }
  else { selectedRecord = Number(target.dataset.record); const entry = trace()[selectedRecord]; selectedMessage = entry?.kind === "published" ? entry.message.messageId : entry && "messageId" in entry ? entry.messageId : 0; }
  render();
});
el("trace-rows").addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); (event.target as HTMLElement).click(); } });
el<HTMLSelectElement>("visible-tick").addEventListener("change", () => { visibleTick = Number(el<HTMLSelectElement>("visible-tick").value); render(); });
el<HTMLInputElement>("trace-filter").addEventListener("input", render); el("errors-only").addEventListener("change", render);
el<HTMLInputElement>("history").addEventListener("input", () => { historyIndex = Number(el<HTMLInputElement>("history").value); selectedRecord = historyIndex; selectedMessage = 0; render(); });
el("live").addEventListener("click", () => { historyIndex = null; visibleTick = null; render(); });
el("debug-enabled").addEventListener("change", render);
// Imported replay comparison is performed only after its full horizon, with complete traces.
el("comparison-view").insertAdjacentHTML("beforeend", '<button id="compare-imported">Comparar replay importado con su evidencia</button>');
el("compare-imported").addEventListener("click", () => void perform(() => {
  if (!lab || !importedEvidence) throw new Error("Importa un archivo replay con evidencia primero.");
  const current = lab.session.trace(); const original = importedEvidence.trace;
  const equal = current.complete && original.complete && json(current) === json(original) && json([...lab.states]) === json(importedEvidence.states);
  comparison = { title: "Evidencia importada", detail: equal ? "Traza completa y estados idénticos." : "Diferencia, horizonte incompleto o traza truncada.", equal, data: { expected: original.entries.length, actual: current.entries.length, diagnostics: lab.session.diagnostics() } };
}));
el("step").title = "Abrir/cerrar una fase, consumir una entrega o ejecutar un loop; luego pausar.";
el("phase").title = "Ejecutar el resto de la fase actual y pausar antes de la siguiente.";
el("tick").title = "Terminar el tick actual y pausar antes del próximo corte de input.";
fillCatalog(); fillManual(); renderEditor(); render();
