import type { ReactNode } from "react";
import { StoreFooter } from "@/components/storefront/store-footer";
import { StoreHeader } from "@/components/storefront/store-header";
import { ChatbotWidget } from "@/components/storefront/chatbot";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StoreHeader />
      {children}
      <StoreFooter />
      <ChatbotWidget />
    </>
  );
}
