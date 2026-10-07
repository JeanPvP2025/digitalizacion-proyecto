import { NextResponse } from "next/server";
import { z } from "zod";
import { demoProducts } from "@/lib/catalog";
import {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_RESULT_LIMIT,
  SEARCH_RESULT_MAX_LIMIT,
  searchCatalogProducts,
} from "@/lib/search";

const querySchema = z.string()
  .trim()
  .min(1)
  .max(SEARCH_QUERY_MAX_LENGTH)
  .refine((query) => !/[\u0000-\u001f\u007f]/.test(query));

const limitSchema = z.coerce.number().int().min(1).max(SEARCH_RESULT_MAX_LIMIT);

function badRequest(error: string) {
  return NextResponse.json(
    { error },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawQueries = params.getAll("q");
  if (rawQueries.length !== 1 || rawQueries[0].length > SEARCH_QUERY_MAX_LENGTH) {
    return badRequest("Escribe una búsqueda de hasta " + SEARCH_QUERY_MAX_LENGTH + " caracteres.");
  }

  const parsedQuery = querySchema.safeParse(rawQueries[0]);
  if (!parsedQuery.success) {
    return badRequest("Escribe un término de búsqueda válido.");
  }

  const rawLimits = params.getAll("limit");
  if (rawLimits.length > 1) return badRequest("El límite de resultados no es válido.");

  const parsedLimit = rawLimits.length === 0 ? null : limitSchema.safeParse(rawLimits[0]);
  if (parsedLimit && !parsedLimit.success) {
    return badRequest("El límite debe estar entre 1 y " + SEARCH_RESULT_MAX_LIMIT + ".");
  }

  const result = searchCatalogProducts(
    demoProducts,
    parsedQuery.data,
    parsedLimit?.data ?? SEARCH_RESULT_LIMIT,
  );

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
