import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ProductReviewList } from "@/components/storefront/reviews/product-review-list";
import { ReviewSubmissionForm } from "@/components/storefront/reviews/review-submission-form";
import { getCatalogData } from "@/lib/catalog-repository";
import { getServerDataMode } from "@/lib/server/data-mode";
import { listPublishedProductReviews, listReviewableOrderItems } from "@/lib/reviews/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerAuthState } from "@/lib/supabase/auth";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type RouteProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCatalogData();
  const product = data.source === "error" ? undefined : data.products.find((item) => item.slug === slug);
  return { title: product ? "Opiniones de " + product.name : "Opiniones de producto" };
}

export default async function ProductReviewsPage({ params }: RouteProps) {
  const { slug } = await params;
  const catalog = await getCatalogData();
  if (catalog.source === "error") {
    return (
      <main className={styles.reviewsPage}>
        <p className={styles.eyebrow}>COMUNIDAD NODRIA</p>
        <h1>Opiniones no disponibles.</h1>
        <p role="alert">{catalog.message}</p>
      </main>
    );
  }

  const product = catalog.products.find((item) => item.slug === slug);
  if (!product) notFound();

  const connected = catalog.source === "supabase" && getServerDataMode() === "supabase";
  const auth = connected ? await getServerAuthState() : null;
  const supabase = auth?.kind === "signed-in"
    ? auth.supabase
    : connected
      ? await createSupabaseServerClient()
      : null;

  const published = connected && supabase
    ? await listPublishedProductReviews(supabase, product.id)
    : null;
  const reviewState = !connected
    ? "demo"
    : !published?.ok
      ? "error"
      : published.data.total === 0
        ? "empty"
        : "ready";

  const eligibility = connected && auth?.kind === "signed-in" && supabase
    ? await listReviewableOrderItems(supabase, auth.user.id, product.id)
    : null;
  const loginHref = "/acceso?next=" + encodeURIComponent("/producto/" + slug + "/opiniones");

  return (
    <main className={styles.reviewsPage}>
      <Link className={styles.backLink} href={"/producto/" + slug}><ArrowLeft size={15} /> Volver al producto</Link>
      <header className={styles.reviewsHeader}>
        <p className={styles.eyebrow}>COMUNIDAD NODRIA · OPINIONES VERIFICADAS</p>
        <h1>Opiniones de {product.name}<span>.</span></h1>
        <p>Solo las personas que recibieron este producto pueden opinar. Cada opinión se revisa antes de publicarse.</p>
        {published?.ok && <span className={styles.reviewCount}>{published.data.total} {published.data.total === 1 ? "opinión publicada" : "opiniones publicadas"}</span>}
      </header>

      <section className={styles.reviewSection} aria-labelledby="published-reviews">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>EXPERIENCIAS REALES</p>
            <h2 id="published-reviews">Opiniones publicadas</h2>
          </div>
          <ShieldCheck size={22} aria-hidden="true" />
        </div>
        <ProductReviewList
          reviews={published?.ok ? published.data.reviews : []}
          state={reviewState}
        />
      </section>

      <section className={styles.submitSection} aria-labelledby="write-review">
        <p className={styles.eyebrow}>TU EXPERIENCIA</p>
        <h2 id="write-review">Comparte tu opinión.</h2>
        <p>La reseña queda pendiente hasta que una persona con permiso de moderación la apruebe.</p>
        {!connected ? (
          <p className={styles.statusNote} role="status">El modo de demostración no guarda opiniones. Para opinar se necesita una compra conectada y entregada.</p>
        ) : auth?.kind !== "signed-in" ? (
          <div className={styles.statusNote}>
            <p>Inicia sesión con la cuenta que realizó la compra para comprobar si puedes opinar.</p>
            <Link className="button button--dark" href={loginHref}>Iniciar sesión</Link>
          </div>
        ) : !eligibility?.ok ? (
          <p className={styles.statusNote} role="alert">No se pudo comprobar la compra elegible. Actualiza la página e inténtalo de nuevo.</p>
        ) : eligibility.data.length === 0 ? (
          <p className={styles.statusNote} role="status">No hay compras entregadas de este producto disponibles para reseñar en esta cuenta.</p>
        ) : (
          <ReviewSubmissionForm productId={product.id} orderItems={eligibility.data} />
        )}
      </section>
    </main>
  );
}
