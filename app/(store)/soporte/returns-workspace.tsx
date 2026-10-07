"use client";

import { useState } from "react";
import { ReturnRequestForm } from "./return-request-form";
import { ReturnHistory } from "./return-history";

export function ReturnsWorkspace({ connected, authenticated }: { connected: boolean; authenticated: boolean }) {
  const [reloadKey, setReloadKey] = useState(0);
  return <>
    <ReturnRequestForm connected={connected} authenticated={authenticated} onRequestCreated={() => setReloadKey((value) => value + 1)} />
    <ReturnHistory connected={connected} authenticated={authenticated} reloadKey={reloadKey} />
  </>;
}
