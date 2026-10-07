"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createOperationsServiceClient } from "@/lib/operations/admin";
import { getOperationsAccess } from "@/lib/operations/access";
import type { OperationsActionState } from "@/lib/operations/contracts";

const orderIdSchema = z.uuid();

async function runFulfillmentTransition(
  orderIdValue: FormDataEntryValue | null,
  rpc: "fulfill_order" | "mark_order_delivered",
): Promise<OperationsActionState> {
  const parsedOrderId = orderIdSchema.safeParse(orderIdValue);
  if (!parsedOrderId.success) {
    return { status: "error", message: "Selecciona un pedido válido y vuelve a intentarlo." };
  }

  const access = await getOperationsAccess();
  if (access.state === "unauthenticated") return { status: "error", message: "Tu sesión ha caducado. Inicia sesión para continuar." };
  if (access.state === "forbidden") return { status: "error", message: "Tu cuenta no tiene permisos para operar pedidos." };
  if (access.state !== "ready") return { status: "error", message: "El servicio operativo no está disponible." };

  const admin = createOperationsServiceClient();
  if (!admin) return { status: "error", message: "Falta la configuración segura del servicio operativo." };

  try {
    const { data, error } = await admin.rpc(rpc, { p_order_id: parsedOrderId.data });
    if (error) {
      if (error.code === "42501") return { status: "error", message: "Tu cuenta no tiene permisos para realizar esta transición." };
      if (error.code === "P0002") return { status: "error", message: "El pedido ya no está disponible." };
      if (error.code === "23514") return { status: "error", message: "El estado actual del pedido no permite esta acción." };
      return { status: "error", message: "No se pudo actualizar el pedido. Comprueba la conexión y vuelve a intentarlo." };
    }
    if (data !== (rpc === "fulfill_order" ? "shipped" : "delivered")) {
      return { status: "error", message: "La base de datos no confirmó el estado esperado del pedido." };
    }

    revalidatePath("/backoffice");
    return {
      status: "success",
      message: rpc === "fulfill_order" ? "Pedido expedido. El timeline ya está actualizado." : "Entrega confirmada. El timeline ya está actualizado.",
    };
  } catch {
    return { status: "error", message: "No se pudo actualizar el pedido. Comprueba la conexión y vuelve a intentarlo." };
  }
}

export async function fulfillOperationsOrder(
  _previousState: OperationsActionState,
  formData: FormData,
): Promise<OperationsActionState> {
  return runFulfillmentTransition(formData.get("orderId"), "fulfill_order");
}

export async function markOperationsOrderDelivered(
  _previousState: OperationsActionState,
  formData: FormData,
): Promise<OperationsActionState> {
  return runFulfillmentTransition(formData.get("orderId"), "mark_order_delivered");
}
