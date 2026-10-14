import { ApplicationController } from '../../src/application/index.ts';
import type { ReplayRecording, DebugRecord } from '../../src/core/index.ts';
import { presentationRecipe, presentationRequest } from '../core/presentation-fixture.ts';
import { navigationPresets } from '../core/navigation-fixture.ts';
import type { Scenario, FixtureConfig } from '../core/navigation-fixture.ts';
import type { View } from '../../src/presentation/data/contracts.ts';
import { validateManifest } from '../../src/presentation/data/manifest.ts';
import manifestData from '../../content/presentation/prototype-v1.json' with { type: 'json' };
import { PresentationRenderer } from '../../src/presentation/graphics/renderer.ts';
import { runTickBatch } from './navigation-run.ts';
const escape = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const save = (name: string, data: unknown) => { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); };
export function mountPresentationPanel(container: HTMLElement): void {
    const manifest = validateManifest(manifestData);
    const presets = [...navigationPresets()];
    const maximum = structuredClone(presets[0]!.scenario);
    maximum.width = maximum.height = 12;
    maximum.tiles = Array.from({ length: 144 }, (_, i) => ({ q: i % 12, r: Math.floor(i / 12), terrainId: 'terrain.floor' }));
    maximum.robots = Array.from({ length: 16 }, (_, i) => ({ robotId: 'robot-' + i, definitionId: i % 2 ? 'robot.unarmed' : 'robot.scout', q: i % 12, r: Math.floor(i / 12) }));
    maximum.order = maximum.robots.map(r => r.robotId);
    maximum.config.goals = maximum.robots.map((r, i) => ({ robotId: r.robotId, q: 11, r: 11 - i % 12 }));
    presets.push({ id: 'maximum', name: 'Máximo · 12×12 / 16 robots', expected: 'Tablero completo, 16 ensamblados y diagnóstico de recursos/rendimiento.', scenario: maximum });
    container.innerHTML = `<section class="presentation-panel"><div class="section-title"><div><span class="eyebrow">PRESENTACIÓN / PRE-001</span><h2>Robots por piezas</h2></div><span>Blender → GLB → Three.js</span></div>
 <p class="muted">La casilla lógica cambia al confirmar el movimiento. El dibujo puede suavizarlo; la pausa congela su reloj.</p>
 <div class="presentation-controls"><label>Escenario<select id="pre-preset">${presets.map(p => `<option value="${p.id}">${escape(p.name)}</option>`).join('')}</select></label><label>Fallo visual<select id="pre-fault"><option value="none">Ninguno</option><option value="asset">Archivo de ruedas ausente</option><option value="socket">Socket drive ausente</option><option value="late">Carga demorada · cerrar durante carga</option></select></label><label><input id="pre-debug" type="checkbox" checked> Debug JSONL</label><button id="pre-start" class="primary">Preparar escena 3D</button><button id="pre-close">Cerrar encuentro</button></div>
 <div class="presentation-controls"><button id="pre-step">Paso</button><button id="pre-phase">Fase</button><button id="pre-tick">Tick</button><label>Ticks<input id="pre-count" type="number" min="1" max="1000" value="20"></label><button id="pre-n">Ejecutar N ticks</button><button id="pre-run">Ejecutar continuo</button><button id="pre-pause">Pausar</button><label>Velocidad<select id="pre-speed"><option value="0.25">0.25×</option><option value="1" selected>1× · 20 ticks/s</option><option value="4">4×</option><option value="20">20×</option></select></label><label>Movimiento<select id="pre-mode"><option value="smooth">Suavizado confirmado</option><option value="exact">Exacto</option></select></label></div>
 <div id="pre-status" class="status-strip"></div><p id="pre-notice" class="notice" role="status">Prepara un encuentro para visualizar las piezas.</p>
 <div class="presentation-visual"><div id="pre-canvas" class="presentation-canvas" aria-label="Escena 3D de robots"></div><div id="pre-map" class="presentation-map" aria-label="Posiciones lógicas del mismo encuentro"></div></div>
 <div class="presentation-controls"><button id="pre-camera">Restablecer cámara</button><label>FPS render<select id="pre-fps"><option>15</option><option>30</option><option selected>60</option></select></label><label>Calidad<select id="pre-quality"><option value="1">Normal · 1×</option><option value="1.5" selected>Alta · 1.5×</option></select></label><label><input id="pre-overlays" type="checkbox"> Sockets, rutas y casillas lógicas</label><button id="pre-lose">Perder contexto gráfico</button><button id="pre-restore">Restaurar contexto</button><button id="pre-rebuild">Reconstruir vista</button></div>
 <div class="presentation-legend"><span style="color:#60A5FA">▰ Chasis azul</span><span style="color:#FACC15">◆ Núcleo amarillo</span><span style="color:#22D3EE">■ IA cian</span><span style="color:#C084FC">▲ Sensor violeta</span><span style="color:#FB923C">● Ruedas / ▰ Orugas</span><span style="color:#F97316">━ Arma naranja/roja</span></div>
 <div class="presentation-controls"><label>Robot<select id="pre-robot"></select></label><label>q<input id="pre-q" type="number" value="6"></label><label>r<input id="pre-r" type="number" value="2"></label><button id="pre-goal">Objetivo de fixture</button><button id="pre-manual">Solicitar paso de fixture</button><button id="pre-replay">Comparar replay</button><button id="pre-isolation">Segunda sesión y escena</button><button id="pre-save">Exportar escenario</button><button id="pre-export">Exportar replay 3D</button><label class="content-file">Importar JSON<input id="pre-import" type="file" accept=".json"></label><button id="pre-report">Exportar reporte</button><button id="pre-retry">Reintentar debug</button></div>
 <p class="muted small">Objetivos y solicitudes pertenecen a fixtures de prueba. Arrastra para inspeccionar la cámara; rueda para zoom. El editor se aplica al próximo encuentro.</p>
 <div id="pre-second" class="presentation-canvas" hidden></div>
 <div class="presentation-evidence"><section><h3>Posición lógica / dibujada y recursos</h3><pre id="pre-metrics"></pre><h3>Diagnóstico visual</h3><pre id="pre-errors"></pre></section><section><h3>Cursor y mensajes</h3><pre id="pre-trace"></pre><h3>Archivo debug</h3><pre id="pre-log"></pre></section></div>
 <details><summary>Escenario y catálogo del próximo encuentro</summary><div class="navigation-editors"><label>Escenario<textarea id="pre-scenario" spellcheck="false"></textarea></label><label>Catálogo v2 / piezas<textarea id="pre-content" spellcheck="false"></textarea></label></div></details></section>`;
    const get = <T extends HTMLElement = HTMLElement>(id: string) => container.querySelector<T>('#' + id)!;
    let app: ApplicationController | undefined, graphics: PresentationRenderer | undefined, secondary: PresentationRenderer | undefined, secondApp: ApplicationController | undefined, activeScenario: Scenario | undefined;
    let running = false, busy = false, generation = 0, runToken = 0, lastProjection = '', lastAgentTick = -1;
    const journals = new Map<string, {
        id: string;
        path: string;
        pending: DebugRecord[];
        written: number;
    }>();
    let logBusy = false, logError = '';
    const notice = (text: unknown) => { get('pre-notice').textContent = String(text); };
    const controller = () => new ApplicationController({ instanceId: 'presentation-lab-' + crypto.randomUUID(), runtime: navigator.userAgent, recipe: presentationRecipe() });
    const view = () => app?.snapshot().observations.presentation as unknown as View | undefined;
    function editor(): void { const p = presets.find(p => p.id === get<HTMLSelectElement>('pre-preset').value)!; get<HTMLTextAreaElement>('pre-scenario').value = JSON.stringify(p.scenario, null, 2); get<HTMLTextAreaElement>('pre-content').value = JSON.stringify(presentationRequest().content, null, 2); notice(p.expected); }
    function collect(a = app): void { for (const g of a?.drainDebugLog() ?? []) {
        let j = journals.get(g.contextId);
        if (!j) {
            j = { id: '', path: '', pending: [], written: 0 };
            journals.set(g.contextId, j);
        }
        j.pending.push(...g.records);
    } }
    async function flush(): Promise<void> { collect(); if (logBusy)
        return; logBusy = true; try {
        for (const j of journals.values()) {
            if (!j.pending.length)
                continue;
            if (!j.id) {
                const response = await fetch('/__debug-log', { method: 'POST' }), data = await response.json();
                if (!response.ok)
                    throw Error(data.error);
                j.id = data.id;
                j.path = data.path;
            }
            while (j.pending.length) {
                let count = 0, bytes = 0;
                for (const r of j.pending.slice(0, 1000)) {
                    const size = new TextEncoder().encode(JSON.stringify(r)).length + 1;
                    if (size > 2000000)
                        throw Error('Registro demasiado grande');
                    if (bytes + size > 2000000)
                        break;
                    bytes += size;
                    count++;
                }
                const response = await fetch('/__debug-log/' + j.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(j.pending.slice(0, count)) });
                if (!response.ok)
                    throw Error('Fallo de debug; registros pendientes conservados');
                j.pending.splice(0, count);
                j.written += count;
            }
        }
        logError = '';
    }
    catch (e) {
        logError = String(e);
        notice('Debug: ' + logError);
    }
    finally {
        logBusy = false;
        get('pre-log').textContent = (logError ? 'ERROR: ' + logError + '\n' : '') + JSON.stringify([...journals].map(([context, j]) => ({ context, path: j.path, pending: j.pending.length, written: j.written })), null, 2);
    } }
    function sync(snap = false): void {
        const snapshot = app?.snapshot(), v = snapshot?.observations.presentation as unknown as View | undefined;
        if (!v)
            return;
        const agent = snapshot!.observations['navigation-agent-fixture'] as any;
        const key = v.contextId + ':' + v.sequence;
        if (!snap && key === lastProjection && agent?.decisionTick === lastAgentTick)
            return;
        lastProjection = key;
        lastAgentTick = agent?.decisionTick ?? -1;
        graphics?.accept(v, snap || get<HTMLSelectElement>('pre-mode').value === 'exact');
        graphics?.setRoutes(agent?.plans ?? []);
        const selected = get<HTMLSelectElement>('pre-robot').value;
        get('pre-robot').innerHTML = v.world.robots.map(r => `<option value="${escape(r.robotId)}" ${r.robotId === selected ? 'selected' : ''}>${escape(r.robotId)}</option>`).join('');
        const radius = 12, width = 35 + Math.sqrt(3) * radius * (v.world.width - 1 + (v.world.height - 1) / 2), height = 35 + 1.5 * radius * (v.world.height - 1);
        const pos = (q: number, r: number) => ({ x: 17 + Math.sqrt(3) * radius * (q + r / 2), y: 17 + 1.5 * radius * r });
        get('pre-map').innerHTML = `<svg viewBox="0 0 ${width} ${height}" aria-label="Tablero lógico 2D">${v.world.tiles.map(t => { const p = pos(t.q, t.r); const points = Array.from({ length: 6 }, (_, i) => { const a = (60 * i - 30) * Math.PI / 180; return `${p.x + radius * Math.cos(a)},${p.y + radius * Math.sin(a)}`; }).join(' '); return `<polygon points="${points}" fill="${t.passable ? '#334155' : '#0f172a'}" stroke="#64748b" stroke-width=".8"/>`; }).join('')}${v.world.robots.map(r => { const p = pos(r.q, r.r); return `<circle cx="${p.x}" cy="${p.y}" r="7" fill="#22d3ee"/><text x="${p.x}" y="${p.y + 2}" font-size="5" text-anchor="middle" fill="#111827">${escape(r.robotId)}</text>`; }).join('')}</svg>`;
    }
    function evidence(): void {
        const snapshot = app?.snapshot();
        get('pre-status').textContent = (snapshot?.state ?? 'idle') + ' · tick ' + (snapshot?.progress?.nextTick ?? '—') + ' / ' + (snapshot?.progress?.phase ?? 'entre ticks') + ' · ' + (busy ? 'precargando' : running ? 'ejecución externa' : 'pausado');
        const projection = snapshot?.observations.presentation as unknown as View | undefined;
        get('pre-metrics').textContent = JSON.stringify({ context: snapshot?.contextId, projection: projection?.sequence, logical: projection?.world.robots.map(r => ({ id: r.robotId, q: r.q, r: r.r, CD: r.moveCooldownTicks, readyAtTick: r.readyAtTick })), graphics: graphics?.snapshot(), second: secondary?.snapshot() }, null, 2);
        get('pre-errors').textContent = graphics?.diagnostics.join('\n') || 'Sin errores visuales.';
        get('pre-trace').textContent = JSON.stringify({ cursor: snapshot?.progress, failure: snapshot?.failure, entries: app?.trace()?.entries.slice(-12) }, null, 2);
    }
    function pause(): void { running = false; runToken++; graphics?.motion.pause(true, performance.now()); evidence(); }
    function close(): void { pause(); generation++; graphics?.close(); graphics = undefined; secondary?.close(); secondary = undefined; secondApp?.close(); secondApp = undefined; get('pre-second').hidden = true; app?.close(); collect(); busy = false; get('pre-canvas').textContent = 'Encuentro cerrado. Recursos liberados.'; get('pre-map').replaceChildren(); void flush(); evidence(); }
    async function construct(): Promise<void> { if (!app || !view())
        throw Error('Falta vista publicada'); const token = ++generation; graphics?.close(); graphics = new PresentationRenderer(get('pre-canvas'), manifest, { fault: get<HTMLSelectElement>('pre-fault').value, onLost: pause }); const candidate = graphics; busy = true; evidence(); try {
        await candidate.prepare(view()!);
        if (token !== generation)
            return;
        candidate.renderFps(Number(get<HTMLSelectElement>('pre-fps').value));
        candidate.quality(Number(get<HTMLSelectElement>('pre-quality').value));
        candidate.diagnosticsVisible(get<HTMLInputElement>('pre-overlays').checked);
        candidate.motion.speed(Number(get<HTMLSelectElement>('pre-speed').value), performance.now());
        sync(true);
        notice('Escena preparada. Los controles manuales están pausados.');
    }
    finally {
        if (token === generation) {
            busy = false;
            evidence();
        }
    } }
    async function start(): Promise<void> { if (busy || running)
        return; const next = controller(), s = JSON.parse(get<HTMLTextAreaElement>('pre-scenario').value) as Scenario; const data = { ...presentationRequest(s), content: JSON.parse(get<HTMLTextAreaElement>('pre-content').value), debug: get<HTMLInputElement>('pre-debug').checked }; const r = next.request(data); if (!r.ok) {
        next.close();
        throw Error(r.code + ' · ' + r.message);
    } close(); app = next; activeScenario = structuredClone(s); for (let i = 0; i < 2; i++) {
        const out = app.advance();
        if (!out.ok)
            throw Error(out.message);
    } await construct(); await flush(); }
    function checkAdvance(kind: 'step' | 'phase' | 'tick' = 'tick', snap = false): void { if (!app)
        throw Error('Prepara el encuentro'); const r = app.advance(kind); if (!r.ok)
        throw Error(r.code + ' · ' + r.message); sync(snap); collect(); if (snap)
        evidence(); }
    async function run(count: number, continuous = false): Promise<void> {
        if (running || busy || !app || !graphics)
            return;
        running = true;
        const token = ++runToken;
        graphics.motion.pause(false, performance.now());
        const result = await runTickBatch({ requestedTicks: count, continuous, readTick: () => app!.snapshot().progress!.nextTick, isActive: () => running && runToken === token, advanceTick: () => { try {
                checkAdvance();
                return { ok: true };
            }
            catch (e) {
                return { ok: false, message: String(e) };
            } }, afterTick: async () => { await flush(); await new Promise<void>(resolve => setTimeout(resolve, 50 / Number(get<HTMLSelectElement>('pre-speed').value))); } });
        if (token === runToken) {
            running = false;
            graphics?.motion.pause(true, performance.now());
            if (result.status === 'completed')
                sync(true);
            await flush();
            if (token === runToken) {
                evidence();
                notice(`Tanda ${result.status}: ${result.startTick} → ${result.finalTick}, ${result.actualTicks} ticks. ${logError ? "Debug pendiente; revisa el archivo y reintenta. " : ""}${result.error ?? ''}`);
            }
        }
    }
    function playback(record: ReplayRecording): ApplicationController { if (record.completedTicks > 5000)
        throw Error('Máximo 5000 ticks para replay manual'); const r = controller(), loaded = r.loadReplay(record); if (!loaded.ok) {
        r.close();
        throw Error(loaded.message);
    } try {
        for (let i = 0; i < record.completedTicks; i++) {
            const result = r.advance();
            if (!result.ok)
                throw Error(result.message);
        }
        return r;
    }
    catch (e) {
        r.close();
        throw e;
    } }
    function guarded(operation: () => unknown | Promise<unknown>): void { void Promise.resolve().then(operation).catch(e => { notice(e); evidence(); }); }
    get('pre-preset').addEventListener('change', editor);
    get('pre-start').addEventListener('click', () => guarded(start));
    get('pre-close').addEventListener('click', close);
    for (const [id, kind] of [['pre-step', 'step'], ['pre-phase', 'phase'], ['pre-tick', 'tick']] as const)
        get(id).addEventListener('click', () => guarded(async () => { if (running || busy)
            return; checkAdvance(kind, true); await flush(); }));
    get('pre-n').addEventListener('click', e => { if (e.detail > 1)
        return; const n = Number(get<HTMLInputElement>('pre-count').value); if (!Number.isInteger(n) || n < 1 || n > 1000) {
        notice('Ticks: entero de 1 a 1000');
        return;
    } guarded(() => run(n)); });
    get('pre-run').addEventListener('click', () => guarded(() => run(Number.MAX_SAFE_INTEGER, true)));
    get('pre-pause').addEventListener('click', pause);
    get('pre-mode').addEventListener('change', () => sync(true));
    get('pre-speed').addEventListener('change', () => graphics?.motion.speed(Number(get<HTMLSelectElement>('pre-speed').value), performance.now()));
    get('pre-fps').addEventListener('change', () => graphics?.renderFps(Number(get<HTMLSelectElement>('pre-fps').value)));
    get('pre-quality').addEventListener('change', () => graphics?.quality(Number(get<HTMLSelectElement>('pre-quality').value)));
    get('pre-camera').addEventListener('click', () => graphics?.resetCamera());
    get('pre-overlays').addEventListener('change', () => graphics?.diagnosticsVisible(get<HTMLInputElement>('pre-overlays').checked));
    get('pre-lose').addEventListener('click', () => graphics?.loseContext());
    get('pre-restore').addEventListener('click', () => graphics?.restoreContext());
    get('pre-rebuild').addEventListener('click', () => guarded(async () => { pause(); await construct(); }));
    get('pre-retry').addEventListener('click', () => guarded(flush));
    for (const [id, manual] of [['pre-goal', false], ['pre-manual', true]] as const)
        get(id).addEventListener('click', () => guarded(() => { if (!app || !view() || !activeScenario || running || busy)
            throw Error('Pausa antes de configurar la fixture'); const robotId = get<HTMLSelectElement>('pre-robot').value, q = Number(get<HTMLInputElement>('pre-q').value), r = Number(get<HTMLInputElement>('pre-r').value), robot = view()!.world.robots.find(x => x.robotId === robotId)!; const d = app.snapshot().progress!, config: FixtureConfig = { configSequence: activeScenario.config.configSequence + 1, autoEnabled: !manual, goals: [{ robotId, q, r }], rawSteps: manual ? [{ dueTick: d.nextTick + (d.tickInProgress ? 1 : 0), step: { boardId: view()!.boardId, robotId, requestSequence: Math.max(1, d.nextTick * 1000 + activeScenario.config.configSequence), from: { q: robot.q, r: robot.r }, to: { q, r }, expectedRobotRevision: robot.robotRevision, knownBoardRevision: view()!.world.boardRevision } }] : [] }; if (!app.stage(app.snapshot().contextId, 'ConfigureNavigationFixture', config as any))
            throw Error('Entrada no admitida'); activeScenario.config = config; notice('Configuración encolada; avanza ticks para resolverla.'); }));
    get('pre-replay').addEventListener('click', () => guarded(() => { if (!app)
        throw Error('Falta sesión'); const record = app.exportReplay(), r = playback(record); try {
        notice(JSON.stringify(r.trace()) === JSON.stringify(app.trace()) && JSON.stringify(r.snapshot().observations) === JSON.stringify(app.snapshot().observations) ? 'Replay idéntico: traza y vistas coinciden.' : 'Replay diferente.');
    }
    finally {
        r.close();
    } }));
    get('pre-isolation').addEventListener('click', () => guarded(async () => { if (!app)
        throw Error('Falta sesión'); pause(); const before = JSON.stringify(app.snapshot()), s = structuredClone(activeScenario!); s.config.autoEnabled = false; s.config.rawSteps = []; const next = controller(); const r = next.request(presentationRequest(s, 'isolated')); if (!r.ok)
        throw Error(r.message); for (let i = 0; i < 12; i++)
        next.advance(); secondary?.close(); secondApp?.close(); secondApp = next; get('pre-second').hidden = false; secondary = new PresentationRenderer(get('pre-second'), manifest); await secondary.prepare(next.snapshot().observations.presentation as unknown as View); notice(before === JSON.stringify(app.snapshot()) ? 'Segunda sesión y escena independientes; original intacto.' : 'Revisa aislamiento.'); evidence(); }));
    get('pre-save').addEventListener('click', () => guarded(() => save('presentation-scenario.json', { presentationFormat: 1, visualManifest: manifest, scenario: JSON.parse(get<HTMLTextAreaElement>('pre-scenario').value), content: JSON.parse(get<HTMLTextAreaElement>('pre-content').value) })));
    get('pre-export').addEventListener('click', () => guarded(() => save('presentation-replay.json', { presentationFormat: 1, visualManifest: manifest, recording: app!.exportReplay() })));
    get<HTMLInputElement>('pre-import').addEventListener('change', () => guarded(async () => { const input = get<HTMLInputElement>('pre-import'), file = input.files?.[0]; if (!file)
        return; try {
        if (file.size > 32000000)
            throw Error('Archivo demasiado grande');
        const data = JSON.parse(await file.text());
        if (data.presentationFormat !== 1 || JSON.stringify(validateManifest(data.visualManifest)) !== JSON.stringify(manifest))
            throw Error('Manifest visual incompatible');
        if (data.recording) {
            const next = playback(data.recording);
            close();
            app = next;
            activeScenario = data.recording.manifest.initialState.selection;
            await construct();
            notice('Replay importado; ingreso vivo deshabilitado.');
        }
        else {
            get<HTMLTextAreaElement>('pre-scenario').value = JSON.stringify(data.scenario, null, 2);
            get<HTMLTextAreaElement>('pre-content').value = JSON.stringify(data.content, null, 2);
            notice('Escenario importado para el siguiente encuentro.');
        }
    }
    finally {
        input.value = '';
    } }));
    get('pre-report').addEventListener('click', () => save('presentation-report.json', { snapshot: app?.snapshot(), trace: app?.trace(), visual: graphics?.snapshot(), manifest, logError, pendingDebug: [...journals].map(([context, j]) => ({ context, records: j.pending })) }));
    const timer = setInterval(() => { if (!container.hidden)
        evidence(); }, 500);
    window.addEventListener('pagehide', () => { clearInterval(timer); close(); }, { once: true });
    editor();
    evidence();
}
