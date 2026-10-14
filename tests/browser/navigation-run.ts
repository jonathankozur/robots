export type TickBatchProgress = Readonly<{
  startTick: number;
  targetTick: number | null;
  finalTick: number;
  actualTicks: number;
}>;

export type TickBatchResult = TickBatchProgress & Readonly<{
  status: "completed" | "paused" | "failed";
  error?: string;
}>;

type TickAdvanceResult = Readonly<{
  ok: boolean;
  code?: string;
  message?: string;
}>;

export async function runTickBatch(options: {
  requestedTicks: number;
  continuous?: boolean;
  readTick: () => number;
  advanceTick: () => TickAdvanceResult | Promise<TickAdvanceResult>;
  isActive: () => boolean;
  onProgress?: (progress: TickBatchProgress) => void;
  afterTick?: () => void | Promise<void>;
}): Promise<TickBatchResult> {
  const startTick = options.readTick();
  const validStart = Number.isSafeInteger(startTick) && startTick >= 0;
  const validCount = Number.isSafeInteger(options.requestedTicks) && options.requestedTicks > 0;
  const targetTick = options.continuous ? null : validStart && validCount
    && options.requestedTicks <= Number.MAX_SAFE_INTEGER - startTick
    ? startTick + options.requestedTicks : null;
  let finalTick = startTick;
  const progress = (): TickBatchProgress => ({
    startTick, targetTick, finalTick,
    actualTicks: Number.isSafeInteger(finalTick - startTick) ? Math.max(0, finalTick - startTick) : 0,
  });
  const failed = (error: string): TickBatchResult => ({ status: "failed", ...progress(), error });

  if (!Number.isSafeInteger(startTick) || startTick < 0) return failed("El cursor inicial no es un tick válido.");
  if (!Number.isSafeInteger(options.requestedTicks) || options.requestedTicks < 1) return failed("La cantidad de ticks debe ser un entero positivo.");
  if (!options.continuous && targetTick === null) return failed("El cursor objetivo excede el rango entero seguro.");

  while (progress().actualTicks < options.requestedTicks) {
    if (!options.isActive()) return { status: "paused", ...progress() };
    const before = options.readTick();
    if (before !== finalTick) return failed(`El cursor cambió fuera de la tanda: se esperaba ${finalTick} y se observó ${before}.`);

    let outcome: TickAdvanceResult;
    try {
      outcome = await options.advanceTick();
      finalTick = options.readTick();
    } catch (error) {
      finalTick = options.readTick();
      return failed(error instanceof Error ? error.message : String(error));
    }

    if (!outcome.ok) return failed([outcome.code, outcome.message].filter(Boolean).join(" · ") || "El controlador rechazó el avance.");
    if (finalTick !== before + 1) {
      return failed(`Se esperaba avanzar de tick ${before} a ${before + 1}, pero el cursor terminó en ${finalTick}.`);
    }

    const current = progress();
    try { options.onProgress?.(current); }
    catch (error) { return failed(error instanceof Error ? error.message : String(error)); }
    if (current.actualTicks < options.requestedTicks) {
      try { await options.afterTick?.(); }
      catch (error) { return failed(error instanceof Error ? error.message : String(error)); }
    }
  }

  return { status: "completed", ...progress() };
}
