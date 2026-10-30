"use client";

import React from "react";
import Link from "next/link";
import { Bot, User } from "lucide-react";
import type { ChatbotMessage as ChatbotMessageType } from "@/lib/chatbot/types";
import { ChatbotProductCard } from "./chatbot-product-card";
import { ChatbotComparisonCard } from "./chatbot-comparison-card";
import styles from "./chatbot.module.css";

type ChatbotMessageProps = {
  message: ChatbotMessageType;
  onSelectQuickReply?: (payload: string) => void;
};

/**
 * Lightweight deterministic markdown-like parser:
 * Handles **bold**, [link](url), headers ###, and bullets •.
 */
function renderFormattedContent(text: string) {
  if (!text) return null;

  const lines = text.split("\n");

  return lines.map((line, lineIndex) => {
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      return <div key={lineIndex} className={styles.emptyLine} />;
    }

    // Heading ###
    if (trimmed.startsWith("### ")) {
      return (
        <h4 key={lineIndex} className={styles.msgHeading}>
          {parseInlineFormatting(trimmed.slice(4))}
        </h4>
      );
    }

    // Bullet points
    if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return (
        <div key={lineIndex} className={styles.bulletItem}>
          <span className={styles.bulletSymbol}>•</span>
          <span className={styles.bulletText}>{parseInlineFormatting(trimmed.slice(2))}</span>
        </div>
      );
    }

    // Numbered list item: e.g. "1. "
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      return (
        <div key={lineIndex} className={styles.bulletItem}>
          <span className={styles.numSymbol}>{numMatch[1]}.</span>
          <span className={styles.bulletText}>{parseInlineFormatting(numMatch[2])}</span>
        </div>
      );
    }

    // Regular paragraph
    return (
      <p key={lineIndex} className={styles.msgParagraph}>
        {parseInlineFormatting(line)}
      </p>
    );
  });
}

/**
 * Parses bold text and markdown links into React elements.
 */
function parseInlineFormatting(str: string): React.ReactNode[] {
  // Regex pattern matching **bold**, `code`, or [link](url)
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = str.split(pattern);

  return parts.map((part, index) => {
    // Bold: **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    // Inline code: `code`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code key={index} className={styles.inlineCode}>
          {part.slice(1, -1)}
        </code>
      );
    }

    // Markdown link: [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, text, url] = linkMatch;
      const isInternal = url.startsWith("/");
      if (isInternal) {
        return (
          <Link key={index} href={url} className={styles.msgLink}>
            {text}
          </Link>
        );
      }
      return (
        <a key={index} href={url} target="_blank" rel="noopener noreferrer" className={styles.msgLink}>
          {text}
        </a>
      );
    }

    return part;
  });
}

export function ChatbotMessage({ message, onSelectQuickReply }: ChatbotMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`${styles.messageRow} ${isUser ? styles.messageRowUser : styles.messageRowAssistant}`}>
      <div className={styles.messageAvatar}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className={styles.messageBubbleWrapper}>
        <div className={styles.messageBubbleHeader}>
          <span className={styles.senderName}>{isUser ? "Tú" : "Asistente NODRIA"}</span>
          {!isUser && <span className={styles.ruleBadge}>Sin IA · Reglas Deterministas</span>}
        </div>

        <div className={`${styles.messageBubble} ${isUser ? styles.messageBubbleUser : styles.messageBubbleAssistant}`}>
          {renderFormattedContent(message.content)}
        </div>

        {/* Product Recommendations */}
        {message.products && message.products.length > 0 && (
          <div className={styles.productsGrid}>
            {message.products.map((item) => (
              <ChatbotProductCard key={item.product.id} item={item} />
            ))}
          </div>
        )}

        {/* Comparison Table */}
        {message.comparison && (
          <div className={styles.comparisonContainer}>
            <ChatbotComparisonCard comparison={message.comparison} />
          </div>
        )}

        {/* Quick Replies */}
        {message.quickReplies && message.quickReplies.length > 0 && onSelectQuickReply && (
          <div className={styles.quickRepliesContainer} role="group" aria-label="Sugerencias rápidas">
            {message.quickReplies.map((qr, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectQuickReply(qr.payload)}
                className={styles.quickReplyChip}
              >
                {qr.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
