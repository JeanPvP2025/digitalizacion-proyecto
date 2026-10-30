"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X, Minus, RotateCcw, Send, Bot } from "lucide-react";
import type { ChatbotConversationContext, ChatbotMessage as ChatbotMessageType } from "@/lib/chatbot/types";
import { getInitialWelcomeMessage } from "@/lib/chatbot/dialogue-manager";
import { ChatbotMessage } from "./chatbot-message";
import styles from "./chatbot.module.css";

export function ChatbotWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatbotMessageType[]>(() => {
    const welcome = getInitialWelcomeMessage(pathname);
    return [
      {
        id: "msg_welcome",
        role: "assistant",
        content: welcome.text,
        timestamp: Date.now(),
        quickReplies: welcome.quickReplies,
      },
    ];
  });
  const [context, setContext] = useState<ChatbotConversationContext>(() => ({
    currentPath: pathname,
  }));
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleResetConversation = useCallback(() => {
    const welcome = getInitialWelcomeMessage(pathname);
    setMessages([
      {
        id: `msg_welcome_${Date.now()}`,
        role: "assistant",
        content: welcome.text,
        timestamp: Date.now(),
        quickReplies: welcome.quickReplies,
      },
    ]);
    setContext({ currentPath: pathname });
    setInputValue("");
  }, [pathname]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend ?? inputValue).trim();
    if (!messageContent || isLoading) return;

    setInputValue("");

    // Append user message
    const userMsg: ChatbotMessageType = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: messageContent,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageContent,
          context: {
            ...context,
            currentPath: pathname,
          },
          currentPath: pathname,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }

      const data = await response.json();

      const assistantMsg: ChatbotMessageType = {
        id: `msg_asst_${Date.now()}`,
        role: "assistant",
        content: data.text,
        timestamp: Date.now(),
        products: data.products,
        comparison: data.comparison,
        quickReplies: data.quickReplies,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.contextUpdate) {
        setContext((prev) => ({
          ...prev,
          ...data.contextUpdate,
        }));
      }
    } catch (err: unknown) {
      console.error("[ChatbotWidget Error]:", err);
      const errorMsg: ChatbotMessageType = {
        id: `msg_err_${Date.now()}`,
        role: "assistant",
        content:
          "Lo siento, ocurrió una incidencia temporal al procesar tu consulta. " +
          "Puedes intentarlo de nuevo o consultar directamente en nuestra sección de **[Soporte Técnico](/soporte)**.",
        timestamp: Date.now(),
        quickReplies: [
          { label: "Reintentar", payload: messageContent },
          { label: "Ir a soporte", payload: "Quiero ir a soporte" },
          { label: "Reiniciar chat", payload: "Reiniciar chat" },
        ],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.floatingLauncherWrapper}>
      {isOpen && (
        <aside
          className={styles.chatWindow}
          role="dialog"
          aria-label="Asistente NODRIA"
          aria-modal="false"
        >
          {/* Header */}
          <header className={styles.chatHeader}>
            <div className={styles.headerIdentity}>
              <div className={styles.headerAvatar} aria-hidden="true">
                <Bot size={18} />
              </div>
              <div className={styles.headerTitles}>
                <h3 className={styles.headerTitle}>
                  <span>Asistente NODRIA</span>
                  <span className={styles.statusIndicator} title="Asistente en línea" />
                </h3>
                <p className={styles.headerSubtitle}>Asesor técnico determinista · Sin IA</p>
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                onClick={handleResetConversation}
                className={styles.headerIconButton}
                title="Reiniciar conversación"
                aria-label="Reiniciar conversación"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={styles.headerIconButton}
                title="Minimizar ventana"
                aria-label="Minimizar ventana de chat"
              >
                <Minus size={16} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={styles.headerIconButton}
                title="Cerrar chat"
                aria-label="Cerrar chat"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          {/* Messages Body */}
          <div className={styles.chatBody} role="log" aria-live="polite">
            {messages.map((msg) => (
              <ChatbotMessage
                key={msg.id}
                message={msg}
                onSelectQuickReply={(payload) => handleSendMessage(payload)}
              />
            ))}

            {isLoading && (
              <div className={styles.messageRow} aria-label="El asistente está respondiendo...">
                <div className={styles.messageAvatar}>
                  <Bot size={16} />
                </div>
                <div className={styles.typingIndicator}>
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <footer className={styles.chatFooter}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className={styles.inputForm}
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Escribe tu consulta técnica o comercial..."
                className={styles.inputField}
                maxLength={500}
                disabled={isLoading}
                aria-label="Escribe tu consulta para el asistente"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className={styles.sendButton}
                title="Enviar mensaje"
                aria-label="Enviar mensaje"
              >
                <Send size={16} />
              </button>
            </form>

            <div className={styles.footerDisclaimer}>
              <span className={styles.disclaimerText}>
                Asistente automatizado con catálogo oficial · 0% IA
              </span>
              <span>{inputValue.length}/500</span>
            </div>
          </footer>
        </aside>
      )}

      {/* Floating launcher trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={styles.floatingLauncher}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Cerrar asistente NODRIA" : "Abrir asistente de compras y soporte técnico NODRIA"}
      >
        <span className={styles.launcherIconWrapper}>
          {isOpen ? <X size={18} /> : <MessageSquare size={18} />}
          <span className={styles.launcherPulse} />
        </span>
        <span className={styles.launcherLabel}>
          {isOpen ? "Cerrar" : "Asistente NODRIA"}
        </span>
      </button>
    </div>
  );
}
