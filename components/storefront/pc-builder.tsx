"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Cpu, HardDrive, MonitorCog, Save, ShoppingBag, Zap } from "lucide-react";
import { addComponentsToCart } from "@/components/storefront/store-interactions";
import { checkBuildCompatibility, optionalPcBuilderCategories, pcBuilderComponents, requiredPcBuilderCategories, type PcBuildSelection, type PcBuilderCategory, type PcBuilderComponent } from "@/lib/pc-builder";

const categoryTitle: Record<PcBuilderCategory, string> = { cpu: "Procesador", motherboard: "Placa base", memory: "Memoria RAM", case: "Caja", gpu: "Gráfica", psu: "Fuente de alimentación", storage: "Almacenamiento", cooler: "Refrigeración" };
const categoryIcon: Record<PcBuilderCategory, typeof Cpu> = { cpu: Cpu, motherboard: MonitorCog, memory: HardDrive, case: MonitorCog, gpu: MonitorCog, psu: Zap, storage: HardDrive, cooler: MonitorCog };
const defaultSelection: PcBuildSelection = { cpu: "cpu-vector-7-9700", motherboard: "mb-aurora-b850", memory: "ram-lumen-32-ddr5", case: "case-prism-atx", gpu: "gpu-pulse-770", psu: "psu-lumen-650", storage: "storage-arc-2tb", cooler: "cooler-boreal-240" };
const formatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const savedBuildKey = "nodria.pc-build.v1";
const builderCategories: PcBuilderCategory[] = [...requiredPcBuilderCategories, ...optionalPcBuilderCategories];

function readSavedBuildSnapshot() {
  try {
    return window.localStorage.getItem(savedBuildKey) ?? "";
  } catch {
    return "";
  }
}

function subscribeToSavedBuild(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("nodria:pc-build", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("nodria:pc-build", onChange);
  };
}

function getServerSavedBuildSnapshot() {
  return "";
}

function parseSavedSelection(serialized: string | null): PcBuildSelection | null {
  if (!serialized) return null;

  try {
    const value: unknown = JSON.parse(serialized);
    if (typeof value !== "object" || value === null || Array.isArray(value) || !("selection" in value)) return null;

    const selection = value.selection;
    if (typeof selection !== "object" || selection === null || Array.isArray(selection)) return null;

    const saved = selection as Record<string, unknown>;
    const keys = Object.keys(saved);
    if (keys.length !== builderCategories.length || !builderCategories.every((category) => Object.prototype.hasOwnProperty.call(saved, category))) return null;
    if (!keys.every((key) => builderCategories.includes(key as PcBuilderCategory))) return null;

    const isValid = builderCategories.every((category) => {
      const selectedId = saved[category];
      return selectedId === null || (typeof selectedId === "string" && pcBuilderComponents.some((component) => component.category === category && component.id === selectedId));
    });

    return isValid ? saved as PcBuildSelection : null;
  } catch {
    return null;
  }
}

function componentSpecs(component: PcBuilderComponent) {
  if (component.category === "cpu") return `${component.socket} · ${component.estimatedPowerW} W · ${component.integratedGraphics ? "gráficos integrados" : "sin gráfica integrada"}`;
  if (component.category === "motherboard") return `${component.formFactor} · ${component.socket} · ${component.memoryGeneration}`;
  if (component.category === "memory") return `${component.capacityGb} GB · ${component.generation} · ${component.speedMtPerS} MT/s`;
  if (component.category === "case") return `${component.supportedFormFactors.join(" / ")} · GPU hasta ${component.maxGpuLengthMm} mm`;
  if (component.category === "gpu") return `${component.lengthMm} mm · consumo estimado ${component.estimatedPowerW} W`;
  if (component.category === "psu") return `${component.capacityW} W · ${component.efficiencyLabel}`;
  if (component.category === "storage") return `${component.capacityTb} TB · ${component.interface}`;
  return `${component.supportedSockets.join(" / ")} · consumo estimado ${component.estimatedPowerW} W`;
}

export function PcBuilder() {
  const [selection, setSelection] = useState<PcBuildSelection>(defaultSelection);
  const [hasEdited, setHasEdited] = useState(false);
  const [notice, setNotice] = useState("");
  const savedBuild = useSyncExternalStore(subscribeToSavedBuild, readSavedBuildSnapshot, getServerSavedBuildSnapshot);
  const restoredSelection = useMemo(() => parseSavedSelection(savedBuild), [savedBuild]);
  const activeSelection = !hasEdited && restoredSelection ? restoredSelection : selection;
  const restoredNotice = !hasEdited && savedBuild
    ? restoredSelection
      ? "Configuración recuperada de este navegador."
      : "El guardado no coincide con las piezas disponibles. Se muestra la configuración de ejemplo."
    : "";
  const visibleNotice = notice || restoredNotice;
  const result = useMemo(() => checkBuildCompatibility(activeSelection), [activeSelection]);
  const groups = builderCategories;
  const componentMap = new Map<string, PcBuilderComponent>(pcBuilderComponents.map((item) => [item.id, item]));
  const statusLabel = result.status === "compatible" ? "Compatibilidad correcta" : result.status === "review" ? "Revisa la configuración" : result.status === "incompatible" ? "Hay incompatibilidades" : "Configuración incompleta";

  function select(category: PcBuilderCategory, id: string) {
    setSelection({ ...activeSelection, [category]: id || null });
    setHasEdited(true);
    setNotice("");
  }

  function save() {
    try {
      window.localStorage.setItem(savedBuildKey, JSON.stringify({ selection: activeSelection, savedAt: new Date().toISOString() }));
      window.dispatchEvent(new Event("nodria:pc-build"));
      setNotice("Configuración guardada en este navegador.");
    } catch {
      setNotice("Este navegador no permitió guardar la configuración. Puedes seguir usándola en esta visita.");
    }
  }

  function reset() {
    setSelection(defaultSelection);
    setHasEdited(true);
    try {
      window.localStorage.removeItem(savedBuildKey);
      window.dispatchEvent(new Event("nodria:pc-build"));
      setNotice("Configuración de ejemplo restaurada y guardado local eliminado.");
    } catch {
      setNotice("Configuración de ejemplo restaurada, pero el navegador no permitió eliminar el guardado local.");
    }
  }

  function addBuild() {
    if (result.status === "incompatible" || result.status === "incomplete") return;
    addComponentsToCart(result.selectedComponents);
    setNotice("Componentes añadidos al carrito.");
  }

  return (
    <main className="builder-page">
      <section className="builder-banner"><div className="builder-banner-inner"><p className="eyebrow">NODRIA LAB · CONFIGURADOR</p><h1>Construye con criterio.</h1><p>Elige cada pieza y revisa compatibilidad, consumo aproximado y coste antes de decidir. Las comprobaciones son orientativas y usan fichas demo.</p></div></section>
      <div className="builder-workspace">
        <section className="builder-components" aria-label="Componentes del PC">
          {groups.map((category, index) => {
            const Icon = categoryIcon[category];
            const options = pcBuilderComponents.filter((item) => item.category === category);
            const chosen = activeSelection[category] ? componentMap.get(activeSelection[category]!) : undefined;
            return <article className="builder-component" key={category}><div className="builder-component-header"><h2><span>{String(index + 1).padStart(2, "0")}</span><Icon size={15} /> {categoryTitle[category]}{optionalPcBuilderCategories.includes(category as (typeof optionalPcBuilderCategories)[number]) && <small>OPCIONAL</small>}</h2><small>{chosen ? formatter.format(chosen.priceEur) : "SIN SELECCIONAR"}</small></div><div className="builder-select-row"><p>{chosen ? <><strong>{chosen.name}</strong><br />{componentSpecs(chosen)}</> : "Elige una opción disponible para incluirla en el resumen."}</p><label><span className="sr-only">Elegir {categoryTitle[category]}</span><select value={activeSelection[category] ?? ""} onChange={(event) => select(category, event.target.value)}><option value="">{optionalPcBuilderCategories.includes(category as (typeof optionalPcBuilderCategories)[number]) ? "Sin añadir" : "Selecciona una pieza"}</option>{options.map((component) => <option key={component.id} value={component.id}>{component.name} · {formatter.format(component.priceEur)}</option>)}</select></label></div></article>;
          })}
        </section>
        <aside className="compatibility-summary"><p className="eyebrow">REVISIÓN DEL EQUIPO</p><h2>Tu configuración</h2><div className={`compatibility-state${result.status === "review" || result.status === "incompatible" ? " warning" : ""}`}>{result.status === "compatible" ? <Check size={14} /> : <AlertTriangle size={14} />} {statusLabel}</div><div className="compatibility-list"><div className="compatibility-row"><span>Componentes elegidos</span><strong>{result.selectedComponents.length}</strong></div><div className="compatibility-row"><span>Consumo estimado</span><strong>{result.estimatedDrawW === null ? "—" : `≈ ${result.estimatedDrawW} W`}</strong></div><div className="compatibility-row"><span>Fuente recomendada</span><strong>{result.recommendedPsuW === null ? "—" : `≥ ${result.recommendedPsuW} W`}</strong></div></div><div className="builder-total"><span>Precio de componentes</span><strong>{formatter.format(result.totalPriceEur)}</strong></div>
          {result.issues.length > 0 && <ul className="builder-issues">{result.issues.map((issue) => <li className={issue.severity} key={issue.code}>{issue.message}</li>)}</ul>}
          <p className="builder-estimate-note">{result.estimateNote}</p>
          {visibleNotice && <p className="builder-notice" role="status">{visibleNotice} {visibleNotice.includes("añadidos") && <Link href="/carrito">Ver carrito</Link>}</p>}
          <div className="builder-actions"><button className="button button--accent" onClick={addBuild} type="button" disabled={result.status === "incompatible" || result.status === "incomplete"}><ShoppingBag size={14} /> Añadir componentes</button><button className="builder-save" onClick={save} type="button"><Save size={13} /> Guardar en este navegador</button><button className="builder-reset" onClick={reset} type="button">Restablecer configuración de ejemplo</button></div>
        </aside>
      </div>
    </main>
  );
}
