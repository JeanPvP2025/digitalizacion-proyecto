"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCrmAccess } from "@/lib/crm/auth";

const statusSchema = z.enum(["new", "qualified", "contacted", "converted", "closed"]);
const updateSchema = z.object({
  id: z.string().uuid(),
  status: statusSchema,
});

export async function updateOpportunityStatus(formData: FormData) {
  const input = updateSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!input.success) redirect("/backoffice/crm?notice=invalid");

  const access = await getCrmAccess();
  if (access.state === "unconfigured") redirect("/backoffice/crm?notice=unconfigured");
  if (access.state === "unauthenticated") redirect("/acceso?next=%2Fbackoffice%2Fcrm");
  if (access.state === "forbidden") redirect("/backoffice/crm?notice=forbidden");
  if (access.state === "error") redirect("/backoffice/crm?notice=error");

  const { data, error } = await access.supabase
    .from("quote_inquiries")
    .update({ status: input.data.status })
    .eq("id", input.data.id)
    .select("id")
    .maybeSingle();

  if (error) redirect("/backoffice/crm?notice=error");
  if (!data) redirect("/backoffice/crm?notice=not-found");

  revalidatePath("/backoffice/crm");
  redirect("/backoffice/crm?notice=updated");
}
