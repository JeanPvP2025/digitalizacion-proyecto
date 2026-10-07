"use client";

import { useActionState } from "react";
import { Check, LoaderCircle, Package, PackageCheck, Truck } from "lucide-react";
import { dispatchOperationsOrder, markOperationsOrderDelivered, packOperationsOrder, startOperationsPicking } from "@/lib/operations/actions";
import { idleOperationsActionState, type OperationsActionState } from "@/lib/operations/contracts";
import styles from "./operations-center.module.css";

type Transition = "pick" | "pack" | "dispatch" | "deliver";

const transitionCopy: Record<Transition, { action: typeof startOperationsPicking; label: string; pending: string }> = {
  pick: { action: startOperationsPicking, label: "Empezar picking", pending: "Iniciando…" },
  pack: { action: packOperationsOrder, label: "Marcar empaquetado", pending: "Empaquetando…" },
  dispatch: { action: dispatchOperationsOrder, label: "Despachar pedido", pending: "Despachando…" },
  deliver: { action: markOperationsOrderDelivered, label: "Confirmar entrega", pending: "Confirmando…" },
};

export function OperationsOrderAction({ orderId, transition }: { orderId: string; transition: Transition }) {
  const { action, label, pending: pendingLabel } = transitionCopy[transition];
  const [state, formAction, pending] = useActionState<OperationsActionState, FormData>(action, idleOperationsActionState);

  return (
    <div className={styles.actionCell}>
      <form action={formAction}>
        <input type="hidden" name="orderId" value={orderId} />
        <button className={styles.actionButton} type="submit" disabled={pending}>
          {pending ? <LoaderCircle className={styles.spinning} size={15} aria-hidden="true" /> : transition === "pick" ? <PackageCheck size={15} aria-hidden="true" /> : transition === "pack" ? <Package size={15} aria-hidden="true" /> : transition === "dispatch" ? <Truck size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
          <span>{pending ? pendingLabel : label}</span>
        </button>
      </form>
      {state.status !== "idle" && (
        <p className={state.status === "success" ? styles.actionSuccess : styles.actionError} role={state.status === "success" ? "status" : "alert"}>
          {state.status === "success" && <Check size={13} aria-hidden="true" />}{state.message}
        </p>
      )}
    </div>
  );
}
