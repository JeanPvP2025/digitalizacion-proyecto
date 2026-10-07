"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Cpu, HardDrive, MonitorCog, Save, ShoppingBag, Trash2, Zap } from "lucide-react";
import styles from "./pc-builder.module.css";
import {
  checkBuildCompatibility,
  optionalPcBuilderCategories,
  pcBuilderCategories,
} from "@/lib/pc-builder/compatibility";
import type { PcBuildSelection, PcBuilderCatalog, PcBuilderCategory, PcBuilderComponent } from "@/lib/pc-builder/types";
import {
  MAX_SAVED_PC_BUILDS,
  PC_BUILDER_SAVED_KEY,
  prependSavedPcBuild,
  readSavedPcBuilds,
  removeSavedPcBuild,
  writeSavedPcBuilds,
  type SavedPcBuild,
} from "@/lib/pc-builder/saved-builds";

const categoryTitle: Record<PcBuilderCategory, string> = {
  cpu: "Procesador",
  motherboard: "Placa base",
  memory: "Memoria RAM",
  case: "Caja",
  gpu: "Gráfica",
  psu: "Fuente de alimentación",
  storage: "Almacenamiento",
  cooler: "Refrigeración",
};
const categoryIcon: Record<PcBuilderCategory, typeof Cpu> = {
  cpu: Cpu,
  motherboard: MonitorCog,
  memory: HardDrive,
  case: MonitorCog,
  gpu: MonitorCog,
  psu: Zap,
  storage: HardDrive,
  cooler: MonitorCog,
};
const formatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

function emptySelection(): PcBuildSelection {
  return Object.fromEntries(pcBuilderCategories.map((category) => [category, null])) as PcBuildSelection;
}

function componentSpecs(component: PcBuilderComponent) {
  if (component.category === "cpu") return `${component.socket} · ${component.estimatedPowerW} W · ${component.integratedGraphics ? "gráficos integrados" : "sin gráfica integrada"}`;
  if (component.category === "motherboard") return `${component.formFactor} · ${component.socket} · ${component.memoryGeneration} · hasta ${component.maxMemoryGb} GB · ${component.estimatedPowerW} W`;
  if (component.category === "memory") return `${component.capacityGb} GB (${component.kitModules} módulos) · ${component.generation} · ${component.speedMtPerS} MT/s`;
  if (component.category === "case") return `${component.supportedFormFactors.join(" / ")} · GPU hasta ${component.maxGpuLengthMm} mm · ${component.estimatedPowerW} W`;
  if (component.category === "gpu") return `${component.lengthMm} mm · consumo declarado ${component.estimatedPowerW} W`;
  if (component.category === "psu") return `${component.capacityW} W · ${component.efficiencyLabel}`;
  if (component.category === "storage") return `${component.capacityTb} TB · ${component.interface} · ${component.estimatedPowerW} W`;
  return `${component.supportedSockets.join(" / ")} · consumo declarado ${component.estimatedPowerW} W`;
}

function savedBuildDescription(build: SavedPcBuild, components: readonly PcBuilderComponent[]) {
  const byVariant = new Map(components.map((component) => [component.variantId, component]));
  const selected = pcBuilderCategories.flatMap((category) => {
    const variantId = build.selection[category];
    return variantId ? [byVariant.get(variantId)?.name ?? "Variante no disponible"] : [];
  });
  return selected.length ? selected.join(" · ") : "Sin piezas seleccionadas";
}

function savedBuildId() {
  return globalThis.crypto?.randomUUID?.() ?? `saved-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function PcBuilder({ catalog }: { catalog: PcBuilderCatalog }) {
  const router = useRouter();
  const [selection, setSelection] = useState<PcBuildSelection>(emptySelection);
  const [savedBuilds, setSavedBuilds] = useState<SavedPcBuild[]>([]);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let firstRead = true;
    const syncSavedBuilds = () => {
      try {
        const result = readSavedPcBuilds(window.localStorage);
        setSavedBuilds(result.builds);
        if (firstRead && result.builds[0]) {
          setSelection(result.builds[0].selection);
          setActiveSavedId(result.builds[0].id);
          setNotice(`Se recuperó «${result.builds[0].name}» desde este navegador.`);
        } else if (result.invalidEntries > 0) {
          setNotice("Se omitió un guardado que no se pudo leer. Las demás configuraciones siguen disponibles.");
        }
        firstRead = false;
      } catch {
        setNotice("Este navegador no permite leer configuraciones guardadas.");
        firstRead = false;
      }
    };
    syncSavedBuilds();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === PC_BUILDER_SAVED_KEY) syncSavedBuilds();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("nodria:pc-builds", syncSavedBuilds);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("nodria:pc-builds", syncSavedBuilds);
    };
  }, []);

  const componentMap = useMemo(() => new Map(catalog.components.map((component) => [component.variantId, component])), [catalog.components]);
  const selectedComponents = useMemo(() => pcBuilderCategories.flatMap((category) => {
    const variantId = selection[category];
    const component = variantId ? componentMap.get(variantId) : undefined;
    return component && component.category === category ? [component] : [];
  }), [componentMap, selection]);
  const result = useMemo(() => checkBuildCompatibility(selection, catalog.components), [catalog.components, selection]);
  const statusLabel = catalog.source === "error"
    ? "Catálogo no disponible"
    : catalog.source === "demo"
      ? "Sin piezas comprables"
      : catalog.components.length === 0
        ? "Sin piezas validables"
        : result.status === "compatible"
          ? "Reglas satisfechas según catálogo"
          : result.status === "review"
            ? "Revisa la configuración"
            : result.status === "incompatible"
              ? "Hay incompatibilidades"
              : "Configuración incompleta";

  function select(category: PcBuilderCategory, variantId: string) {
    setSelection({ ...selection, [category]: variantId || null });
    setActiveSavedId(null);
    setNotice("");
  }

  function saveBuild() {
    if (selectedComponents.length === 0) return;
    try {
      const existing = readSavedPcBuilds(window.localStorage).builds;
      const name = activeSavedId
        ? existing.find((build) => build.id === activeSavedId)?.name ?? `Configuración ${existing.length + 1}`
        : `Configuración ${existing.length + 1}`;
      const build: SavedPcBuild = {
        id: activeSavedId ?? savedBuildId(),
        name,
        savedAt: new Date().toISOString(),
        selection,
      };
      const next = prependSavedPcBuild(existing, build);
      if (!writeSavedPcBuilds(window.localStorage, next)) throw new Error("storage unavailable");
      setSavedBuilds(next);
      setActiveSavedId(build.id);
      setNotice(`«${build.name}» se guardó en este navegador con los variant IDs seleccionados.`);
      window.dispatchEvent(new Event("nodria:pc-builds"));
    } catch {
      setNotice("Este navegador no permitió guardar la configuración. Puedes seguir usándola en esta visita.");
    }
  }

  function restoreBuild(build: SavedPcBuild) {
    setSelection(build.selection);
    setActiveSavedId(build.id);
    setNotice(`Se recuperó «${build.name}». Las variantes que ya no estén disponibles requieren revisión.`);
  }

  function deleteBuild(id: string) {
    try {
      const next = removeSavedPcBuild(readSavedPcBuilds(window.localStorage).builds, id);
      if (!writeSavedPcBuilds(window.localStorage, next)) throw new Error("storage unavailable");
      setSavedBuilds(next);
      if (activeSavedId === id) setActiveSavedId(null);
      setNotice("Configuración guardada eliminada.");
      window.dispatchEvent(new Event("nodria:pc-builds"));
    } catch {
      setNotice("Este navegador no permitió eliminar la configuración.");
    }
  }

  function resetSelection() {
    setSelection(emptySelection());
    setActiveSavedId(null);
    setNotice("Selección vaciada. Tus configuraciones guardadas siguen disponibles.");
  }

  const categoryRestriction = catalog.source === "demo"
    ? "El catálogo demo no contiene piezas PC con variant IDs. No se ofrecen fichas ficticias como compatibles o comprables."
    : catalog.source === "error"
      ? catalog.message
      : catalog.components.length === 0
        ? "El catálogo no tiene componentes PC con una variante EUR activa y atributos `pc_builder` completos. La compatibilidad y la compra quedan bloqueadas hasta que se publique ese contrato."
        : "Se muestran solo variantes publicadas con atributos `pc_builder` completos. La disponibilidad real se confirma en checkout.";

  return (
    <main className="builder-page">
      <section className="builder-banner">
        <div className="builder-banner-inner">
          <p className="eyebrow">NODRIA LAB · CONFIGURADOR</p>
          <h1>Construye con criterio.</h1>
          <p>Elige variantes vendibles. Revisamos socket, memoria, formato de placa, espacio de GPU, socket del cooler y potencia con atributos estructurados; si falta un atributo admitido, la variante no se ofrece.</p>
        </div>
      </section>
      <div className="builder-workspace">
        <section className="builder-components" aria-label="Componentes del PC">
          {catalog.source === "error" ? (
            <div className={styles.catalogState} role="alert">
              <AlertTriangle size={16} />
              <p>{catalog.message}</p>
              <button className="text-button" type="button" onClick={() => router.refresh()}>Volver a intentar</button>
            </div>
          ) : (
            <>
              <div className={`${styles.catalogState}${catalog.components.length === 0 ? ` ${styles.isEmpty}` : ""}`} role="status">
                {catalog.components.length === 0 ? <AlertTriangle size={16} /> : <Check size={16} />}
                <p>{categoryRestriction}</p>
              </div>
              {catalog.source === "supabase" && catalog.omittedVariants > 0 && (
                <p className={styles.omittedNote}>{catalog.omittedVariants} variante(s) se omitieron porque no tienen datos completos para compatibilidad o venta en EUR.</p>
              )}
              {pcBuilderCategories.map((category, index) => {
                const Icon = categoryIcon[category];
                const options = catalog.components.filter((item) => item.category === category);
                const chosenId = selection[category] ?? "";
                const chosen = chosenId ? componentMap.get(chosenId) : undefined;
                const optional = optionalPcBuilderCategories.includes(category);
                return (
                  <article className="builder-component" key={category}>
                    <div className="builder-component-header">
                      <h2><span>{String(index + 1).padStart(2, "0")}</span><Icon size={15} /> {categoryTitle[category]}{optional && <small>OPCIONAL</small>}</h2>
                      <small>{chosen ? formatter.format(chosen.priceEur) : "SIN SELECCIONAR"}</small>
                    </div>
                    <div className="builder-select-row">
                      <p>{chosen ? <><strong>{chosen.name}</strong>{chosen.variantTitle !== "Estándar" && <> · {chosen.variantTitle}</>}<br />{componentSpecs(chosen)}<br /><span className="mono-label">{chosen.sku} · VARIANTE {chosen.variantId}</span></> : options.length === 0 ? "No hay variantes con los atributos necesarios para validar esta categoría." : "Elige una variante publicada para esta categoría."}</p>
                      <label>
                        <span className="sr-only">Elegir {categoryTitle[category]}</span>
                        <select value={chosenId} onChange={(event) => select(category, event.target.value)} disabled={options.length === 0}>
                          <option value="">{optional ? "Sin añadir" : "Selecciona una pieza"}</option>
                          {options.map((component) => <option key={component.variantId} value={component.variantId}>{component.name}{component.variantTitle !== "Estándar" ? ` · ${component.variantTitle}` : ""} · {formatter.format(component.priceEur)}</option>)}
                        </select>
                      </label>
                    </div>
                  </article>
                );
              })}
            </>
          )}
        </section>

        <aside className="compatibility-summary">
          <p className="eyebrow">REVISIÓN DEL EQUIPO</p>
          <h2>Tu configuración</h2>
          <div className={`compatibility-state${result.status !== "compatible" ? " warning" : ""}`}>
            {result.status === "compatible" ? <Check size={14} /> : <AlertTriangle size={14} />} {statusLabel}
          </div>
          <div className="compatibility-list">
            <div className="compatibility-row"><span>Variantes elegidas</span><strong>{selectedComponents.length}</strong></div>
            <div className="compatibility-row"><span>Consumo estimado</span><strong>{result.estimatedDrawW === null ? "—" : `≈ ${result.estimatedDrawW} W`}</strong></div>
            <div className="compatibility-row"><span>Fuente recomendada</span><strong>{result.recommendedPsuW === null ? "—" : `≥ ${result.recommendedPsuW} W`}</strong></div>
          </div>
          <div className="builder-total"><span>Precio de componentes</span><strong>{formatter.format(result.totalPriceEur)}</strong></div>
          {result.issues.length > 0 && <ul className={styles.issues}>{result.issues.map((issue) => <li className={issue.severity === "error" ? styles.issueError : styles.issueWarning} key={issue.code}>{issue.message}</li>)}</ul>}
          <p className={styles.estimateNote}>{result.estimateNote}</p>
          <p className={styles.validationLimit}>El catálogo no incluye todavía reglas para BIOS/QVL, conectores de energía ni todos los espacios físicos. La comprobación cubre solo los atributos enumerados arriba.</p>

          <div className={styles.cartRestriction} id="builder-cart-restriction">
            <ShoppingBag size={14} />
            <p>El puente al carrito espera el contrato de checkout por variant ID. No se enviarán product IDs alternativos ni precios del navegador.</p>
          </div>
          <div className={styles.actions}>
            <button className="button button--accent" type="button" disabled aria-describedby="builder-cart-restriction"><ShoppingBag size={14} /> Añadir componentes</button>
            <button className="builder-save" onClick={saveBuild} type="button" disabled={selectedComponents.length === 0}><Save size={13} /> Guardar selección</button>
            <button className="builder-reset" onClick={resetSelection} type="button">Vaciar selección</button>
          </div>

          <section className={styles.saved} aria-label="Configuraciones guardadas">
            <div className={styles.savedHeader}><h3>Guardadas en este navegador</h3><small>{savedBuilds.length}/{MAX_SAVED_PC_BUILDS}</small></div>
            {savedBuilds.length === 0 ? <p className={styles.savedEmpty}>Aún no hay configuraciones guardadas.</p> : savedBuilds.map((build) => (
              <article className={`${styles.savedItem}${activeSavedId === build.id ? ` ${styles.active}` : ""}`} key={build.id}>
                <button type="button" onClick={() => restoreBuild(build)} aria-current={activeSavedId === build.id ? "true" : undefined}>
                  <strong>{build.name}</strong><span>{savedBuildDescription(build, catalog.components)}</span>
                </button>
                <button className={styles.savedDelete} type="button" aria-label={`Eliminar ${build.name}`} onClick={() => deleteBuild(build.id)}><Trash2 size={13} /></button>
              </article>
            ))}
          </section>
          {notice && <p className={styles.notice} role="status">{notice}</p>}
        </aside>
      </div>
    </main>
  );
}
