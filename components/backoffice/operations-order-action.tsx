"use client";

import { useActionState } from "react";
import { Check, LoaderCircle, PackageCheck, Truck } from "lucide-react";
import { fulfillOperationsOrder, markOperationsOrderDelivered } from "@/lib/operations/actions";
import { idleOperationsActionState, type OperationsActionState } from "@/lib/operations/contracts";
import styles from "./operations-center.module.css";

type Transition = "fulfill" | "deliver";

export function OperationsOrderAction({ orderId, transition }: { orderId: string; transition: Transition }) {
  const action = transition === "fulfill" ? fulfillOperationsOrder : markOperationsOrderDelivered;
  const [state, formAction, pending] = useActionState<OperationsActionState, FormData>(action, idleOperationsActionState);
  const label = transition === "fulfill" ? "Preparar expedición" : "Confirmar entrega";

  return (
    <div className={styles.actionCell}>
      <form action={formAction}>
        <input type="hidden" name="orderId" value={orderId} />
        <button className={styles.actionButton} type="submit" disabled={pending}>
          {pending ? <LoaderCircle className={styles.spinning} size={15} aria-hidden="true" /> : transition === "fulfill" ? <PackageCheck size={15} aria-hidden="true" /> : <Truck size={15} aria-hidden="true" />}
          <span>{pending ? "Actualizando…" : label}</span>
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
