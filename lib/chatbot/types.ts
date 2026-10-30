import type { Product } from "@/lib/catalog";

export type ChatbotMessageRole = "user" | "assistant" | "system";

export type ChatbotActionType =
  | "search"
  | "recommend"
  | "compare"
  | "pc_builder"
  | "order_status"
  | "support"
  | "navigate"
  | "restart";

export type ChatbotQuickReply = {
  label: string;
  payload: string;
  action?: ChatbotActionType;
};

export type ChatbotProductRecommendation = {
  product: Pick<Product, "id" | "slug" | "sku" | "name" | "brand" | "price" | "stock" | "image" | "imageAlt" | "summary" | "category"> & {
    keySpecs?: Array<{ label: string; value: string }>;
  };
  reason: string;
};

export type ChatbotComparisonItem = {
  slug: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  imageAlt: string;
  specs: Record<string, string>;
};

export type ChatbotComparisonTable = {
  title: string;
  attributes: string[];
  products: ChatbotComparisonItem[];
  verdict?: string;
};

export type ChatbotResponsePayload = {
  text: string;
  products?: ChatbotProductRecommendation[];
  comparison?: ChatbotComparisonTable;
  quickReplies?: ChatbotQuickReply[];
  contextUpdate?: Partial<ChatbotConversationContext>;
};

export type ChatbotMessage = {
  id: string;
  role: ChatbotMessageRole;
  content: string;
  timestamp: number;
  products?: ChatbotProductRecommendation[];
  comparison?: ChatbotComparisonTable;
  quickReplies?: ChatbotQuickReply[];
};

export type GuidedFlowType =
  | "recommend_network"
  | "recommend_wifi"
  | "recommend_switch"
  | "recommend_domotica"
  | "recommend_telephony"
  | "recommend_industrial"
  | "compare_products"
  | "pc_builder_help";

export type ChatbotConversationContext = {
  /** Active category code or topic (e.g. "redes", "switches", "fibra", "domotica") */
  activeTopic?: string;
  /** Active subcategory or product family */
  activeFamily?: string;
  /** Customer budget limit in EUR */
  budgetEur?: number;
  /** Port count requirement (e.g. 8, 16, 24, 48) */
  portCount?: number;
  /** PoE required */
  poeRequired?: boolean;
  /** Brand preference */
  preferredBrand?: string;
  /** Ongoing guided flow */
  flow?: {
    type: GuidedFlowType;
    step: number;
    slots: Record<string, unknown>;
  };
  /** Slugs of last shown/discussed products */
  recentProductSlugs?: string[];
  /** Consecutive unrecognized query count for graceful support escalation */
  unrecognizedCount?: number;
  /** Current page path of the customer */
  currentPath?: string;
};

export type ChatbotIntent =
  | "greeting"
  | "farewell"
  | "gratitude"
  | "identity_inquiry"
  | "help_menu"
  | "search_product"
  | "recommend_request"
  | "compare_request"
  | "pc_builder_inquiry"
  | "pc_builder_compatibility"
  | "order_inquiry"
  | "shipping_inquiry"
  | "warranty_returns_inquiry"
  | "payment_methods_inquiry"
  | "contact_support_inquiry"
  | "category_browse"
  | "technical_faq"
  | "clear_conversation"
  | "affirmation"
  | "negation"
  | "unknown";

export type IntentMatchResult = {
  intent: ChatbotIntent;
  confidence: number;
  entities: {
    productType?: string;
    brand?: string;
    categorySlug?: string;
    budgetEur?: number;
    portCount?: number;
    poeRequired?: boolean;
    wifiStandard?: string;
    productSlugs?: string[];
    technicalTopic?: string;
    rawQuery?: string;
  };
};
