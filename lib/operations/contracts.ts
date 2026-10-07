export type OperationsActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const idleOperationsActionState: OperationsActionState = {
  status: "idle",
  message: "",
};
