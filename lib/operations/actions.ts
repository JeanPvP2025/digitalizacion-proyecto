"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createOperationsServiceClient } from "@/lib/operations/admin";
import { getOperationsAccess } from "@/lib/operations/access";
import type { OperationsActionState } from "@/lib/operations/contracts";

const orderIdSchema = z.uuid();

type FulfillmentRpc = "start_order_picking" | "pack_order" | "dispatch_order" | "confirm_order_delivery";

const fulfillmentActionCopy: Record<FulfillmentRpc, { expected: string; success: string }> = {
  start_order_picking: { expected: "picking", success: "Preparación iniciada. El timeline ya está actualizado." },
  pack_order: { expected: "packed", success: "Pedido empaquetado. El timeline ya está actualizado." },
  dispatch_order: { expected: "shipped", success: "Pedido despachado. El timeline ya está actualizado." },
  confirm_order_delivery: { expected: "delivered", success: "Entrega confirmada. El timeline ya está actualizado." },
};

async function runFulfillmentTransition(
  orderIdValue: FormDataEntryValue | null,
  rpc: FulfillmentRpc,
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
    const { data, error } = await admin.rpc(rpc, {
      p_order_id: parsedOrderId.data,
      p_actor_user_id: access.user.id,
    });
    if (error) {
      if (error.code === "42501") return { status: "error", message: "Tu cuenta no tiene permisos para realizar esta transición." };
      if (error.code === "P0002") return { status: "error", message: "El pedido ya no está disponible." };
      if (error.code === "23514") return { status: "error", message: "El estado actual del pedido no permite esta acción." };
      return { status: "error", message: "No se pudo actualizar el pedido. Comprueba la conexión y vuelve a intentarlo." };
    }
    if (data !== fulfillmentActionCopy[rpc].expected) {
      return { status: "error", message: "La base de datos no confirmó el estado esperado del pedido." };
    }

    revalidatePath("/backoffice");
    return { status: "success", message: fulfillmentActionCopy[rpc].success };
  } catch {
    return { status: "error", message: "No se pudo actualizar el pedido. Comprueba la conexión y vuelve a intentarlo." };
  }
}

export async function startOperationsPicking(
  _previousState: OperationsActionState,
  formData: FormData,
): Promise<OperationsActionState> {
  return runFulfillmentTransition(formData.get("orderId"), "start_order_picking");
}

export async function packOperationsOrder(
  _previousState: OperationsActionState,
  formData: FormData,
): Promise<OperationsActionState> {
  return runFulfillmentTransition(formData.get("orderId"), "pack_order");
}

export async function dispatchOperationsOrder(
  _previousState: OperationsActionState,
  formData: FormData,
): Promise<OperationsActionState> {
  return runFulfillmentTransition(formData.get("orderId"), "dispatch_order");
}

export async function markOperationsOrderDelivered(
  _previousState: OperationsActionState,
  formData: FormData,
): Promise<OperationsActionState> {
  return runFulfillmentTransition(formData.get("orderId"), "confirm_order_delivery");
}
