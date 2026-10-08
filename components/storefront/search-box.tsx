"use client";

import { Clock3, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  FocusEvent as ReactFocusEvent,
  FormEvent as ReactFormEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CatalogSearchResponse, CatalogSearchResult, CatalogSearchRecovery } from "@/lib/search";
import {
  addRecentSearch,
  parseRecentSearches,
  RECENT_SEARCHES_STORAGE_KEY,
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_RESULT_MAX_LIMIT,
} from "@/lib/search";

type SearchBoxProps = {
  className?: string;
  initialQuery?: string;
  placeholder?: string;
};

type SearchAction =
  | { kind: "product"; key: string; href: string; searchTerm: string; product: CatalogSearchResult }
  | { kind: "recent"; key: string; href: string; searchTerm: string }
  | { kind: "category"; key: string; href: string; searchTerm: string; count: number }
  | { kind: "all"; key: string; href: string; searchTerm: string; total: number };
type SearchApiResponse = CatalogSearchResponse & { source: "demo" | "supabase" };

class SearchApiError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCatalogSearchResult(value: unknown): value is CatalogSearchResult {
  return isRecord(value)
    && typeof value.slug === "string"
    && typeof value.name === "string"
    && typeof value.sku === "string"
    && typeof value.brand === "string"
    && typeof value.category === "string"
    && typeof value.price === "number"
    && Number.isFinite(value.price);
}

function isSearchRecovery(value: unknown): value is CatalogSearchRecovery | null {
  return value === null || (isRecord(value)
    && (value.reason === "partial" || value.reason === "browse")
    && Array.isArray(value.products) && value.products.length <= 3 && value.products.every(isCatalogSearchResult)
    && Array.isArray(value.categories) && value.categories.length <= 3
    && value.categories.every((category: unknown) => isRecord(category)
      && typeof category.name === "string" && typeof category.href === "string"
      && /^\/catalogo\?(?:categoria|q)=[^&]+$/.test(category.href)
      && typeof category.count === "number" && Number.isInteger(category.count) && category.count > 0));
}

const priceFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const panelStyle = {
  position: "absolute" as const,
  zIndex: 40,
  top: "calc(100% + 8px)",
  left: "auto",
  right: 0,
  width: "min(360px, calc(100vw - 32px))",
  overflow: "hidden",
  border: "1px solid #e2e8df",
  borderRadius: 8,
  background: "#ffffff",
  boxShadow: "0 16px 40px rgba(20, 35, 25, 0.16)",
  color: "#1e2a21",
  textAlign: "left" as const,
};

const optionStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  padding: "11px 13px",
  color: "inherit",
  textDecoration: "none",
};

function readStoredSearches() {
  if (typeof window === "undefined") return [];
  try {
    return parseRecentSearches(window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function SearchBox({
  className = "header-search",
  initialQuery = "",
  placeholder = "Producto, marca, SKU o característica",
}: SearchBoxProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const listboxId = searchId + "-listbox";
  const statusId = searchId + "-status";
  const [query, setQuery] = useState(initialQuery.slice(0, SEARCH_QUERY_MAX_LENGTH));
  const [recentSearches, setRecentSearches] = useState<string[]>(readStoredSearches);
  const [response, setResponse] = useState<SearchApiResponse | null>(null);
  const [error, setError] = useState<{ query: string; message: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const isLoading = hasQuery && response?.query !== trimmedQuery && error?.query !== trimmedQuery;

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== RECENT_SEARCHES_STORAGE_KEY && event.key !== null) return;
      setRecentSearches(parseRecentSearches(event.newValue));
    };
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  useEffect(() => {
    if (!trimmedQuery) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const searchParams = new URLSearchParams({ q: trimmedQuery });
        const result = await fetch("/api/search?" + searchParams.toString(), { signal: controller.signal });
        const payload: unknown = await result.json();

        if (!result.ok) {
          const message = isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "No se ha podido completar la búsqueda.";
          throw new SearchApiError(message);
        }

        if (!isRecord(payload)
          || !Array.isArray(payload.results)
          || payload.results.length > SEARCH_RESULT_MAX_LIMIT
          || !payload.results.every(isCatalogSearchResult)
          || !isSearchRecovery(payload.recovery)
          || payload.query !== trimmedQuery
          || typeof payload.total !== "number"
          || !Number.isInteger(payload.total)
          || payload.total < 0
          || (payload.source !== "demo" && payload.source !== "supabase")) {
          throw new SearchApiError("La respuesta de búsqueda no es válida.");
        }

        if (controller.signal.aborted) return;
        setResponse({ query: trimmedQuery, total: payload.total, results: payload.results, recovery: payload.recovery, source: payload.source });
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError({
          query: trimmedQuery,
          message: cause instanceof SearchApiError
            ? cause.message
            : "No se ha podido completar la búsqueda.",
        });
      }
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [retryCount, trimmedQuery]);

  const actions = useMemo<SearchAction[]>(() => {
    if (hasQuery && response?.query === trimmedQuery && response.total > 0) {
      const productActions: SearchAction[] = response.results.map((product) => ({
        kind: "product",
        key: "product-" + product.slug,
        href: "/producto/" + encodeURIComponent(product.slug),
        searchTerm: trimmedQuery,
        product,
      }));
      productActions.push({
        kind: "all",
        key: "all-results",
        href: "/catalogo?q=" + encodeURIComponent(trimmedQuery),
        searchTerm: trimmedQuery,
        total: response.total,
      });
      return productActions;
    }

    if (hasQuery && response?.query === trimmedQuery && response.total === 0 && response.recovery) {
      return [
        ...response.recovery.categories.map((category): SearchAction => ({
          kind: "category", key: "category-" + category.name, href: category.href,
          searchTerm: category.name, count: category.count,
        })),
        ...response.recovery.products.map((product): SearchAction => ({
          kind: "product", key: "alternative-" + product.slug,
          href: "/producto/" + encodeURIComponent(product.slug), searchTerm: product.name, product,
        })),
      ];
    }

    if (!hasQuery) {
      return recentSearches.map((term) => ({
        kind: "recent",
        key: "recent-" + term,
        href: "/catalogo?q=" + encodeURIComponent(term),
        searchTerm: term,
      }));
    }

    return [];
  }, [hasQuery, recentSearches, response, trimmedQuery]);

  const showPanel = isOpen && (hasQuery || recentSearches.length > 0);
  const showNoResults = hasQuery
    && !isLoading
    && error?.query !== trimmedQuery
    && response?.query === trimmedQuery
    && response.total === 0;

  function saveSearch(term: string) {
    const nextSearches = addRecentSearch(term, recentSearches);
    setRecentSearches(nextSearches);
    try {
      window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(nextSearches));
    } catch {
      // Recent searches are optional when browser storage is unavailable.
    }
  }

  function clearSearches() {
    setRecentSearches([]);
    try {
      window.localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch {
      // Keep the control usable if browser storage is unavailable.
    }
  }

  function followAction(action: SearchAction) {
    saveSearch(action.searchTerm);
    setIsOpen(false);
    setActiveIndex(-1);
    router.push(action.href);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!isOpen || actions.length === 0) {
      if (event.key === "Escape") setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % actions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => current <= 0 ? actions.length - 1 : current - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (event.key === "Enter" && activeIndex >= 0 && activeIndex < actions.length) {
      event.preventDefault();
      followAction(actions[activeIndex]);
    }
  }

  function handleSubmit(event: ReactFormEvent<HTMLFormElement>) {
    if (!trimmedQuery) {
      event.preventDefault();
      setIsOpen(true);
      return;
    }

    saveSearch(trimmedQuery);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleBlur(event: ReactFocusEvent<HTMLFormElement>) {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  function handleLinkClick(action: SearchAction) {
    saveSearch(action.searchTerm);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  return (
    <form
      action="/catalogo"
      className={className}
      method="get"
      onBlur={handleBlur}
      onSubmit={handleSubmit}
      role="search"
      style={{ position: "relative" }}
    >
      <Search aria-hidden="true" size={16} />
      <label className="sr-only" htmlFor={searchId}>Buscar en NODRIA</label>
      <input
        ref={inputRef}
        id={searchId}
        aria-activedescendant={activeIndex >= 0 ? listboxId + "-option-" + activeIndex : undefined}
        aria-autocomplete="list"
        aria-busy={isLoading}
        aria-controls={showPanel && actions.length > 0 ? listboxId : undefined}
        aria-describedby={showPanel && hasQuery ? statusId : undefined}
        aria-expanded={showPanel}
        aria-haspopup={actions.length > 0 ? "listbox" : undefined}
        autoComplete="off"
        maxLength={SEARCH_QUERY_MAX_LENGTH}
        name="q"
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
          setError(null);
        }}
        onFocus={() => {
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        type="search"
        value={query}
      />
      <kbd aria-hidden="true">⌘ / Ctrl K</kbd>

      {showPanel && (
        <div className="search-box-panel" style={panelStyle}>
          {!hasQuery ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 13px", borderBottom: "1px solid #edf0eb" }}>
                <span style={{ color: "#788178", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Búsquedas recientes</span>
                <button
                  onClick={clearSearches}
                  style={{ border: 0, padding: 0, background: "transparent", color: "#526452", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}
                  type="button"
                >
                  Limpiar
                </button>
              </div>
              <ul id={listboxId} role="listbox" aria-label="Búsquedas recientes" style={{ margin: 0, padding: "4px 0", listStyle: "none" }}>
                {actions.map((action, index) => action.kind === "recent" && (
                  <li key={action.key} style={{ margin: 0 }}>
                    <Link
                      id={listboxId + "-option-" + index}
                      aria-selected={activeIndex === index}
                      href={action.href}
                      onClick={() => handleLinkClick(action)}
                      onMouseMove={() => setActiveIndex(index)}
                      role="option"
                      style={{ ...optionStyle, background: activeIndex === index ? "#f2f6ef" : "transparent" }}
                    >
                      <Clock3 aria-hidden="true" size={14} style={{ flex: "0 0 auto", color: "#7c897d" }} />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{action.searchTerm}</span>
                      <span aria-hidden="true" style={{ color: "#7c897d", fontSize: 11 }}>↗</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div id={statusId} aria-live="polite" aria-atomic="true">
              {isLoading && (
                <p role="status" style={{ margin: 0, padding: "14px", color: "#667166", fontSize: 12 }}>Buscando en el catálogo…</p>
              )}
              {error?.query === trimmedQuery && (
                <div role="alert" style={{ padding: 14 }}>
                  <p style={{ margin: "0 0 10px", color: "#7a332c", fontSize: 12 }}>{error.message}</p>
                  <button
                    onClick={() => {
                      setError(null);
                      setRetryCount((count) => count + 1);
                    }}
                    style={{ border: 0, padding: 0, background: "transparent", color: "#31533a", cursor: "pointer", fontSize: 12, fontWeight: 700, textDecoration: "underline" }}
                    type="button"
                  >
                    Reintentar búsqueda
                  </button>
                </div>
              )}
              {showNoResults && (
                <div style={{ padding: 14 }}>
                  <p role="status" style={{ margin: "0 0 5px", fontSize: 13, fontWeight: 700 }}>No encontramos “{trimmedQuery}”.</p>
                  <p style={{ margin: "0 0 10px", color: "#667166", fontSize: 11 }}>
                    {response?.recovery?.reason === "partial"
                      ? "Estos productos coinciden con parte de tu búsqueda. Revisa sus características."
                      : response?.recovery ? "Explora estas categorías y productos del catálogo." : "Prueba con un nombre, referencia o característica diferente."}
                  </p>
                  <Link
                    href="/catalogo"
                    onClick={() => { setIsOpen(false); setActiveIndex(-1); }}
                    style={{ color: "#31533a", fontSize: 12, fontWeight: 700, textDecoration: "underline" }}
                  >
                    Explorar todo el catálogo
                  </Link>
                </div>
              )}
              {!isLoading && error?.query !== trimmedQuery && response?.query === trimmedQuery && actions.length > 0 && (
                <>
                  {response.source === "demo" && (
                    <p role="status" style={{ margin: 0, padding: "8px 13px 0", color: "#788178", fontSize: 10 }}>
                      Sugerencias de demostración local.
                    </p>
                  )}
                  {response.total > 0 && <p style={{ margin: 0, padding: "10px 13px 7px", color: "#788178", fontSize: 10 }}>
                    {response.total} {response.total === 1 ? "resultado" : "resultados"} en el catálogo
                  </p>}
                  <ul id={listboxId} role="listbox" aria-label={showNoResults ? "Alternativas del catálogo" : "Productos sugeridos"} style={{ margin: 0, padding: "0 0 4px", listStyle: "none" }}>
                    {actions.map((action, index) => (
                      <li key={action.key} style={{ margin: 0 }}>
                        {action.kind === "product" ? (
                          <Link
                            id={listboxId + "-option-" + index}
                            aria-selected={activeIndex === index}
                            href={action.href}
                            onClick={() => handleLinkClick(action)}
                            onMouseMove={() => setActiveIndex(index)}
                            role="option"
                            style={{ ...optionStyle, background: activeIndex === index ? "#f2f6ef" : "transparent" }}
                          >
                            <span style={{ display: "grid", minWidth: 0, gap: 3 }}>
                              <strong style={{ overflow: "hidden", fontSize: 12, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{action.product.name}</strong>
                              <span style={{ overflow: "hidden", color: "#718071", fontSize: 10, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {action.product.category} · {action.product.brand} · {action.product.sku}
                              </span>
                            </span>
                            <strong style={{ flex: "0 0 auto", fontSize: 11 }}>{priceFormatter.format(action.product.price)}</strong>
                          </Link>
                        ) : action.kind === "category" ? (
                          <Link
                            id={listboxId + "-option-" + index}
                            aria-selected={activeIndex === index}
                            href={action.href}
                            onClick={() => handleLinkClick(action)}
                            onMouseMove={() => setActiveIndex(index)}
                            role="option"
                            style={{ ...optionStyle, background: activeIndex === index ? "#f2f6ef" : "transparent", color: "#31533a", fontSize: 12 }}
                          >
                            <span>Explorar {action.searchTerm}</span><span>{action.count} productos</span>
                          </Link>
                        ) : action.kind === "all" ? (
                          <Link
                            id={listboxId + "-option-" + index}
                            aria-selected={activeIndex === index}
                            href={action.href}
                            onClick={() => handleLinkClick(action)}
                            onMouseMove={() => setActiveIndex(index)}
                            role="option"
                            style={{ ...optionStyle, borderTop: "1px solid #edf0eb", background: activeIndex === index ? "#f2f6ef" : "transparent", color: "#31533a", fontSize: 11, fontWeight: 700 }}
                          >
                            <span>Ver todos los {action.total} resultados</span>
                            <span aria-hidden="true">→</span>
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
