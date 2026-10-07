import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ReviewModerationQueue } from "@/components/backoffice/reviews/review-moderation-queue";
import { canModerateReviews } from "@/lib/reviews/authorization";
import { listPendingProductReviews } from "@/lib/reviews/data";
import { getServerDataMode } from "@/lib/server/data-mode";
import { getServerAuthState, getStaffRoleGrants } from "@/lib/supabase/auth";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Moderación de opiniones · NODRIA",
  description: "Revisión interna de opiniones verificadas de producto.",
};

function BackToOperations() {
  return <Link className={styles.backLink} href="/backoffice"><ArrowLeft size={14} aria-hidden="true" /> Volver a operaciones</Link>;
}

export default async function ReviewModerationPage() {
  if (getServerDataMode() !== "supabase") {
    return <main className={styles.moderationPage}><BackToOperations /><h1>Moderación no disponible</h1><p>Se requiere una sesión conectada con Supabase.</p></main>;
  }

  const auth = await getServerAuthState();
  if (auth.kind !== "signed-in") redirect("/acceso?next=%2Fbackoffice%2Freviews");

  const roleGrants = await getStaffRoleGrants(auth.supabase, auth.user.id);
  if (roleGrants.error) {
    return <main className={styles.moderationPage}><BackToOperations /><h1>No se pudo comprobar el acceso.</h1><p role="alert">No se pudo comprobar el permiso de moderación. Vuelve a cargar la página cuando se recupere la conexión.</p></main>;
  }
  if (!canModerateReviews(roleGrants.roles)) {
    return <main className={styles.moderationPage}><BackToOperations /><h1>Acceso restringido</h1><p role="alert">La moderación requiere el rol super_admin. La base de datos vuelve a comprobar este permiso con RLS.</p></main>;
  }

  const result = await listPendingProductReviews(auth.supabase);
  return (
    <main className={styles.moderationPage}>
      <BackToOperations />
      <p className={styles.eyebrow}>NODRIA · CALIDAD DE CATÁLOGO</p>
      <h1>Moderación de opiniones<span>.</span></h1>
      <p>Las opiniones nuevas permanecen privadas hasta que una persona autorizada las publique o rechace.</p>
      {result.ok
        ? <ReviewModerationQueue initialReviews={result.data} />
        : <p className={styles.loadError} role="alert">No se pudo cargar la cola de moderación. Vuelve a intentarlo más tarde.</p>}
    </main>
  );
}
