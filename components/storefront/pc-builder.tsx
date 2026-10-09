"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Cpu, HardDrive, MonitorCog, Save, ShoppingBag, Trash2, Zap } from "lucide-react";
import styles from "./pc-builder.module.css";
import {
  checkBuildCompatibility,
  optionalPcBuilderCategories,
  pcBuilderCategories,
  requiredPcBuilderCategories,
} from "@/lib/pc-builder/compatibility";
import { addComponentsToCart } from "@/components/storefront/store-interactions";
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
const categoryDescription: Record<PcBuilderCategory, string> = {
  cpu: "El punto de partida: socket, consumo declarado y gráficos integrados.",
  motherboard: "Debe compartir socket con el procesador y admitir la memoria elegida.",
  memory: "Comprueba generación, capacidad y número de módulos.",
  case: "Revisa formato de placa y longitud máxima declarada para la gráfica.",
  psu: "Dimensiona la fuente con el consumo estimado y un margen orientativo.",
  gpu: "Añade una gráfica dedicada y comprueba su longitud frente a la caja.",
  storage: "Amplía el equipo con una unidad de almacenamiento según los datos publicados.",
  cooler: "Añade refrigeración y comprueba el socket declarado.",
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
  if (component.category === "cpu") return component.socket + " · " + component.estimatedPowerW + " W · " + (component.integratedGraphics ? "gráficos integrados" : "sin gráfica integrada");
  if (component.category === "motherboard") return component.formFactor + " · " + component.socket + " · " + component.memoryGeneration + " · hasta " + component.maxMemoryGb + " GB";
  if (component.category === "memory") return component.capacityGb + " GB (" + component.kitModules + " módulos) · " + component.generation + " · " + component.speedMtPerS + " MT/s";
  if (component.category === "case") return component.supportedFormFactors.join(" / ") + " · GPU hasta " + component.maxGpuLengthMm + " mm";
  if (component.category === "gpu") return component.lengthMm + " mm · consumo declarado " + component.estimatedPowerW + " W";
  if (component.category === "psu") return component.capacityW + " W · " + component.efficiencyLabel;
  if (component.category === "storage") return component.capacityTb + " TB · " + component.interface + " · " + component.estimatedPowerW + " W";
  return component.supportedSockets.join(" / ") + " · consumo declarado " + component.estimatedPowerW + " W";
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
  return globalThis.crypto?.randomUUID?.() ?? "saved-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

export function PcBuilder({ catalog }: { catalog: PcBuilderCatalog }) {
  const router = useRouter();
  const summaryRef = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState<PcBuildSelection>(emptySelection);
  const [savedBuilds, setSavedBuilds] = useState<SavedPcBuild[]>([]);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<PcBuilderCategory>("cpu");
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
          const savedResult = checkBuildCompatibility(result.builds[0].selection, catalog.components);
          setActiveCategory(savedResult.missingCategories[0] ?? pcBuilderCategories[0]);
          setNotice("Se recuperó «" + result.builds[0].name + "» desde este navegador.");
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
  }, [catalog.components]);

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

  const currentIndex = pcBuilderCategories.indexOf(activeCategory);
  const currentOptions = catalog.components.filter((component) => component.category === activeCategory);
  const selectedVariantId = selection[activeCategory] ?? "";
  const completedRequired = requiredPcBuilderCategories.length - result.missingCategories.length;
  const progressPercent = Math.round((completedRequired / requiredPcBuilderCategories.length) * 100);
  const isOptional = optionalPcBuilderCategories.includes(activeCategory);
  const isLastCategory = currentIndex === pcBuilderCategories.length - 1;
  const selectedVariantAvailable = currentOptions.some((component) => component.variantId === selectedVariantId);
  const canAdvance = isOptional || selectedVariantAvailable;

  function select(category: PcBuilderCategory, variantId: string) {
    setSelection((current) => ({ ...current, [category]: variantId || null }));
    setActiveSavedId(null);
    setNotice("");
  }

  function goToSummary() {
    summaryRef.current?.scrollIntoView({ block: "start" });
    summaryRef.current?.focus({ preventScroll: true });
  }

  function advanceCategory() {
    if (isLastCategory) {
      goToSummary();
      return;
    }
    setActiveCategory(pcBuilderCategories[currentIndex + 1]);
  }

  function skipOptionalCategory() {
    setSelection((current) => ({ ...current, [activeCategory]: null }));
    setActiveSavedId(null);
    setNotice(categoryTitle[activeCategory] + " omitida. Puedes añadirla más adelante.");
    advanceCategory();
  }

  function saveBuild() {
    if (selectedComponents.length === 0) return;
    try {
      const existing = readSavedPcBuilds(window.localStorage).builds;
      const name = activeSavedId
        ? existing.find((build) => build.id === activeSavedId)?.name ?? "Configuración " + (existing.length + 1)
        : "Configuración " + (existing.length + 1);
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
      setNotice("«" + build.name + "» se guardó en este navegador con los variant IDs seleccionados.");
      window.dispatchEvent(new Event("nodria:pc-builds"));
    } catch {
      setNotice("Este navegador no permitió guardar la configuración. Puedes seguir usándola en esta visita.");
    }
  }

  function restoreBuild(build: SavedPcBuild) {
    setSelection(build.selection);
    setActiveSavedId(build.id);
    const restoredResult = checkBuildCompatibility(build.selection, catalog.components);
    setActiveCategory(restoredResult.missingCategories[0] ?? pcBuilderCategories[0]);
    setNotice("Se recuperó «" + build.name + "». Las variantes que ya no estén disponibles requieren revisión.");
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
    setActiveCategory(pcBuilderCategories[0]);
    setActiveSavedId(null);
    setNotice("Selección vaciada. Tus configuraciones guardadas siguen disponibles.");
  }

  function addBuildToCart() {
    if (catalog.source !== "supabase" || result.status !== "compatible") return;
    const selectedVariants = result.selectedComponents
      .map((component) => componentMap.get(component.variantId ?? component.id))
      .filter((component): component is typeof catalog.components[number] => component !== undefined);
    if (selectedVariants.length !== result.selectedComponents.length) return;
    addComponentsToCart(selectedVariants);
    setNotice(result.selectedComponents.length + " variante(s) añadidas al carrito. El servidor confirmará precio y stock al finalizar.");
  }

  const categoryRestriction = catalog.source === "demo"
    ? "El catálogo demo no contiene piezas PC con variant IDs. No se ofrecen fichas ficticias como compatibles o comprables."
    : catalog.source === "error"
      ? catalog.message
      : catalog.components.length === 0
        ? "El catálogo no tiene componentes PC con una variante EUR activa y atributos pc_builder completos. La compatibilidad y la compra quedan bloqueadas hasta que se publique ese contrato."
        : "Se muestran solo variantes publicadas con atributos pc_builder completos. La disponibilidad real se confirma en checkout.";

  return (
    <main className="builder-page">
      <section className="builder-banner">
        <div className="builder-banner-inner">
          <p className="eyebrow">NODRIA LAB · CONFIGURADOR</p>
          <h1>Construye con criterio.</h1>
          <p>Un montaje paso a paso con variantes publicadas y reglas basadas en atributos reales. Revisa el conjunto antes de añadirlo al carrito.</p>
        </div>
      </section>

      <div className={"builder-workspace " + styles.workspace}>
        <section className={styles.builder} aria-label="Configurador de PC">
          {catalog.source === "error" ? (
            <div className={styles.catalogState + " " + styles.catalogError} role="alert">
              <AlertTriangle size={19} />
              <div><strong>No se pudo cargar el catálogo</strong><p>{catalog.message}</p></div>
              <button className="text-button" type="button" onClick={() => router.refresh()}>Volver a intentar</button>
            </div>
          ) : (
            <>
              <div className={styles.catalogState + (catalog.components.length === 0 ? " " + styles.catalogEmpty : "")} role="status">
                {catalog.components.length === 0 ? <AlertTriangle size={19} /> : <Check size={19} />}
                <p>{categoryRestriction}</p>
              </div>
              {catalog.source === "supabase" && catalog.omittedVariants > 0 && (
                <p className={styles.omittedNote}>{catalog.omittedVariants} variantes se omitieron porque no tienen todos los datos estructurados que necesita el configurador.</p>
              )}

              <div className={styles.progressBlock}>
                <div className={styles.progressText}>
                  <span>Montaje esencial</span>
                  <strong>{completedRequired} de {requiredPcBuilderCategories.length} piezas base</strong>
                </div>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-label="Progreso de piezas esenciales"
                  aria-valuemin={0}
                  aria-valuemax={requiredPcBuilderCategories.length}
                  aria-valuenow={completedRequired}
                >
                  <span style={{ width: progressPercent + "%" }} />
                </div>
              </div>

              <nav className={styles.stepNav} aria-label="Pasos del configurador">
                <ol>
                  {pcBuilderCategories.map((category, index) => {
                    const Icon = categoryIcon[category];
                    const isSelected = Boolean(selection[category] && componentMap.get(selection[category] ?? "")?.category === category);
                    return (
                      <li key={category}>
                        <button
                          type="button"
                          className={styles.stepButton + (activeCategory === category ? " " + styles.stepCurrent : "") + (isSelected ? " " + styles.stepDone : "")}
                          onClick={() => setActiveCategory(category)}
                          aria-current={activeCategory === category ? "step" : undefined}
                          aria-label={(index + 1) + ". " + categoryTitle[category] + (optionalPcBuilderCategories.includes(category) ? ", opcional" : "") + (isSelected ? ", seleccionada" : "")}
                        >
                          <span className={styles.stepIcon}>{isSelected ? <Check size={15} /> : <Icon size={15} />}</span>
                          <span className={styles.stepText}>
                            <strong>{categoryTitle[category]}</strong>
                            <small>{optionalPcBuilderCategories.includes(category) ? "Ampliación" : "Esencial"}</small>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              <section className={styles.stepPanel} aria-labelledby="builder-step-title">
                <header className={styles.stepHeader}>
                  <div className={styles.stepHeading}>
                    <p className={styles.kicker}>{String(currentIndex + 1).padStart(2, "0")} / {String(pcBuilderCategories.length).padStart(2, "0")} · {isOptional ? "AMPLIACIÓN OPCIONAL" : "PIEZA ESENCIAL"}</p>
                    <h2 id="builder-step-title">{categoryTitle[activeCategory]}</h2>
                    <p>{categoryDescription[activeCategory]}</p>
                  </div>
                  <span className={styles.optionCount}>{currentOptions.length} {currentOptions.length === 1 ? "variante" : "variantes"}</span>
                </header>

                {currentOptions.length === 0 ? (
                  <div className={styles.noOptions} role="status">
                    <span className={styles.noOptionsMark}><AlertTriangle size={18} /></span>
                    <div>
                      <strong>{isOptional ? "No hay opciones publicadas" : "Esta pieza no está disponible"}</strong>
                      <p>{isOptional
                        ? "Puedes continuar sin añadirla. El catálogo conectado no ofrece variantes con los datos necesarios."
                        : "No encontramos variantes con atributos completos para validar esta categoría. La compra seguirá bloqueada mientras falte una pieza esencial."}</p>
                    </div>
                  </div>
                ) : (
                  <fieldset className={styles.options}>
                    <legend className="sr-only">Elige una variante de {categoryTitle[activeCategory]}</legend>
                    {currentOptions.map((component) => (
                      <label className={styles.optionCard + (selectedVariantId === component.variantId ? " " + styles.optionSelected : "")} key={component.variantId}>
                        <input
                          type="radio"
                          name={"pc-builder-" + activeCategory}
                          value={component.variantId}
                          checked={selectedVariantId === component.variantId}
                          onChange={() => select(activeCategory, component.variantId)}
                        />
                        <span className={styles.optionContent}>
                          <span className={styles.optionTopline}>
                            <span className={styles.optionName}>{component.name}</span>
                            <strong>{formatter.format(component.priceEur)}</strong>
                          </span>
                          {component.variantTitle !== "Estándar" && <span className={styles.variantTitle}>{component.variantTitle}</span>}
                          <span className={styles.optionSpecs}>{componentSpecs(component)}</span>
                          <span className={styles.optionBrand}>{component.manufacturer} · {component.sku}</span>
                        </span>
                        <span className={styles.optionCheck} aria-hidden="true"><Check size={14} /></span>
                      </label>
                    ))}
                  </fieldset>
                )}

                {selectedVariantId && !currentOptions.some((component) => component.variantId === selectedVariantId) && (
                  <div className={styles.staleSelection} role="alert">
                    <AlertTriangle size={17} />
                    <p>La variante guardada ya no está disponible. Elige otra para reemplazarla y poder revisar el montaje.</p>
                  </div>
                )}

                <footer className={styles.stepFooter}>
                  <button
                    className={styles.backButton}
                    type="button"
                    onClick={() => setActiveCategory(pcBuilderCategories[currentIndex - 1])}
                    disabled={currentIndex === 0}
                  >
                    Anterior
                  </button>
                  <div className={styles.stepFooterActions}>
                    {isOptional && (
                      <button className={styles.skipButton} type="button" onClick={skipOptionalCategory}>
                        {selectedVariantId ? "Omitir pieza" : "Continuar sin añadir"}
                      </button>
                    )}
                    <button className={styles.continueButton} type="button" onClick={advanceCategory} disabled={!canAdvance}>
                      {isLastCategory ? "Revisar montaje" : "Siguiente pieza"} <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </footer>
              </section>
            </>
          )}
        </section>

        <aside className={styles.summary} ref={summaryRef} tabIndex={-1} aria-labelledby="builder-summary-title">
          <div className={styles.summaryHeader}>
            <p className={styles.kicker}>BANCO DE MONTAJE</p>
            <h2 id="builder-summary-title">Tu configuración</h2>
            <div className={styles.compatibilityState + (result.status === "compatible" ? " " + styles.stateReady : "")} role="status">
              {result.status === "compatible" ? <Check size={15} /> : <AlertTriangle size={15} />}
              <span>{statusLabel}</span>
            </div>
          </div>

          <div className={styles.summaryStats}>
            <div><span>Piezas elegidas</span><strong>{selectedComponents.length}<small> / {pcBuilderCategories.length}</small></strong></div>
            <div><span>Consumo estimado</span><strong>{result.estimatedDrawW === null ? "—" : "≈ " + result.estimatedDrawW + " W"}</strong></div>
            <div><span>Fuente recomendada</span><strong>{result.recommendedPsuW === null ? "—" : "≥ " + result.recommendedPsuW + " W"}</strong></div>
          </div>

          <div className={styles.selectedList}>
            <div className={styles.selectedHeader}>
              <h3>Selección actual</h3>
              <span>{selectedComponents.length}</span>
            </div>
            {selectedComponents.length === 0 ? (
              <p className={styles.selectedEmpty}>Empieza por elegir un procesador. Iremos completando el montaje aquí.</p>
            ) : (
              <ul>
                {selectedComponents.map((component) => (
                  <li key={component.category}>
                    <div>
                      <span>{categoryTitle[component.category]}</span>
                      <strong>{component.name}</strong>
                    </div>
                    <button type="button" onClick={() => setActiveCategory(component.category)} aria-label={"Editar " + categoryTitle[component.category]}>
                      {formatter.format(component.priceEur)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.total}>
            <span>Precio de componentes</span>
            <strong>{formatter.format(result.totalPriceEur)}</strong>
          </div>

          {result.issues.length > 0 && (
            <ul className={styles.issues} aria-label="Revisiones de compatibilidad">
              {result.issues.map((issue) => (
                <li className={issue.severity === "error" ? styles.issueError : styles.issueWarning} key={issue.code}>
                  <AlertTriangle size={15} /><span>{issue.message}</span>
                </li>
              ))}
            </ul>
          )}

          <details className={styles.limits}>
            <summary>Qué comprueba esta revisión</summary>
            <p>{result.estimateNote}</p>
            <p>La revisión cubre socket, memoria, formato de placa, espacio de GPU, compatibilidad declarada del cooler y una estimación de potencia. No incluye todavía BIOS/QVL, conectores de energía ni todos los espacios físicos.</p>
          </details>

          <div className={styles.cartRestriction} id="builder-cart-restriction">
            <ShoppingBag size={16} />
            <p>{catalog.source === "supabase" && result.status === "compatible"
              ? "Checkout volverá a validar en servidor las variantes, el precio y el stock."
              : "Añadir al carrito se habilita con un montaje completo y compatible del catálogo conectado."}</p>
          </div>
          <div className={styles.actions}>
            <button className="button button--accent" type="button" disabled={catalog.source !== "supabase" || result.status !== "compatible"} onClick={addBuildToCart} aria-describedby="builder-cart-restriction">
              <ShoppingBag size={16} /> Añadir al carrito
            </button>
            <button className={styles.saveButton} onClick={saveBuild} type="button" disabled={selectedComponents.length === 0}>
              <Save size={15} /> Guardar montaje
            </button>
            <button className={styles.resetButton} onClick={resetSelection} type="button">Empezar de nuevo</button>
          </div>

          <section className={styles.saved} aria-label="Montajes guardados en este navegador">
            <div className={styles.savedHeader}>
              <h3>Montajes guardados</h3>
              <small>{savedBuilds.length}/{MAX_SAVED_PC_BUILDS}</small>
            </div>
            {savedBuilds.length === 0 ? (
              <p className={styles.savedEmpty}>Tus montajes quedan guardados solo en este navegador.</p>
            ) : savedBuilds.map((build) => (
              <article className={styles.savedItem + (activeSavedId === build.id ? " " + styles.savedActive : "")} key={build.id}>
                <button type="button" onClick={() => restoreBuild(build)} aria-current={activeSavedId === build.id ? "true" : undefined}>
                  <strong>{build.name}</strong><span>{savedBuildDescription(build, catalog.components)}</span>
                </button>
                <button className={styles.savedDelete} type="button" aria-label={"Eliminar " + build.name} onClick={() => deleteBuild(build.id)}><Trash2 size={16} /></button>
              </article>
            ))}
          </section>
          {notice && <p className={styles.notice} role="status">{notice}</p>}
        </aside>
      </div>
    </main>
  );
}
