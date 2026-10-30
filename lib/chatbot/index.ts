import { demoProducts, type Product } from "@/lib/catalog";
import { getInitialWelcomeMessage, handleDialogueTurn } from "./dialogue-manager";
import type { ChatbotConversationContext, ChatbotResponsePayload } from "./types";

export * from "./types";
export * from "./normalizer";
export * from "./intents";
export * from "./knowledge-base";
export * from "./recommendations";
export * from "./comparisons";
export * from "./pc-builder-advisor";
export { getInitialWelcomeMessage, handleDialogueTurn };

export type ProcessMessageInput = {
  message: string;
  context?: ChatbotConversationContext;
  currentPath?: string;
  catalogProducts?: Product[];
};

/**
 * Main public entry point for NODRIA's commercial chatbot engine.
 * 100% deterministic, rule-based, and zero external AI/LLM dependencies.
 */
export function processChatbotMessage(input: ProcessMessageInput): ChatbotResponsePayload {
  const { message, context, currentPath, catalogProducts } = input;
  const products = catalogProducts && catalogProducts.length > 0 ? catalogProducts : demoProducts;

  if (!message || message.trim() === "") {
    return getInitialWelcomeMessage(currentPath);
  }

  const mergedContext: ChatbotConversationContext = {
    ...context,
    currentPath: currentPath ?? context?.currentPath,
  };

  return handleDialogueTurn(message, mergedContext, products);
}
