import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/storefront/auth-form";
import { hasSupabaseCredentials } from "@/lib/supabase/config";
import { getSafeRedirectPath } from "@/lib/supabase/redirects";

export const metadata: Metadata = { title: "Acceso a mi espacio", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AccessPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="auth-page"><p role="status">Cargando acceso seguro…</p></main>}><AccessContent searchParams={searchParams} /></Suspense>;
}

async function AccessContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requestedMode = firstValue(params.modo);
  const initialMode = requestedMode === "actualizar" ? "update" : "signin";
  const callbackError = firstValue(params.error) === "callback";
  const signedOut = firstValue(params.salida) === "1";
  const requestedDestination = firstValue(params.next);
  const redirectTo = getSafeRedirectPath(requestedDestination, "/mi-cuenta");

  return <AuthForm
    demoMode={!hasSupabaseCredentials()}
    redirectTo={redirectTo}
    preserveRequestedDestination={Boolean(requestedDestination && redirectTo !== "/mi-cuenta")}
    initialMode={initialMode}
    initialError={callbackError ? "No se pudo completar el enlace de acceso. Inicia sesión de nuevo; si no puedes, contacta con la administración de la demo." : undefined}
    initialMessage={signedOut ? "Has cerrado tu sesión en este dispositivo." : undefined}
  />;
}
