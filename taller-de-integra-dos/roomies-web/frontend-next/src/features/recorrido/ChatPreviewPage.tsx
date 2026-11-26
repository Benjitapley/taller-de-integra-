"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { ConversacionDto, MensajeServicioDto } from "@/features/recorrido/types";
import styles from "./ChatPreviewPage.module.css";

type ChatMessage = MensajeServicioDto & { key: string; state?: "sending" | "failed" };
type ChatPage = { items: MensajeServicioDto[]; siguiente_cursor: string | null };

export default function ChatPreviewPage() {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [olderBusy, setOlderBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [currentUserName, setCurrentUserName] = useState("");
  const messageList = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const requests = useRef<AbortController | null>(null);
  const scrollAnchor = useRef<{ height: number; top: number } | null>(null);
  const followLatest = useRef(true);

  useLayoutEffect(() => {
    const element = messageList.current;
    if (!element) return;
    if (scrollAnchor.current) {
      element.scrollTop = scrollAnchor.current.top + element.scrollHeight - scrollAnchor.current.height;
      scrollAnchor.current = null;
    } else if (followLatest.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    generation.current++;
    requests.current?.abort();
    requests.current = null;
    setMessages([]);
    setConversationId(null);
    setCursor(null);
    setDraft("");
    setCurrentUserName("");
    setOlderBusy(false);
    scrollAnchor.current = null;
    followLatest.current = true;
  }, []);

  const load = useCallback(async () => {
    clearChat();
    const requestGeneration = generation.current;
    const controller = new AbortController();
    requests.current = controller;
    const signal = controller.signal;
    setBusy(true);
    setError("");
    setDenied(false);

    try {
      const rentalResponse = await fetch("/web-api/arriendos/mio", { cache: "no-store", signal });
      if (!rentalResponse.ok) throw Object.assign(Error("No tienes acceso al arriendo."), { status: rentalResponse.status });
      const rental = await rentalResponse.json();

      const [conversationResponse, sessionResponse] = await Promise.all([
        fetch("/web-api/conversaciones", { cache: "no-store", signal }),
        fetch("/web-api/auth/sesion", { cache: "no-store", signal }),
      ]);
      if (!conversationResponse.ok) throw Object.assign(Error("No se pudo cargar la conversación."), { status: conversationResponse.status });
      const conversationData = await conversationResponse.json();
      if (!sessionResponse.ok) throw Object.assign(Error("Inicia sesión nuevamente."), { status: sessionResponse.status });
      if (sessionResponse.ok) {
        const session = await sessionResponse.json();
        if (requestGeneration === generation.current) setCurrentUserName(session.user?.nombre ?? "");
      }
      const conversation = (conversationData.items as ConversacionDto[]).find((item) => item.id_arriendo === rental.id_arriendo);
      if (!conversation) throw Error("Todavía no hay conversación disponible.");

      const response = await fetch(`/web-api/conversaciones/${conversation.id_conversacion}/mensajes?limite=20`, { cache: "no-store", signal });
      if (!response.ok) throw Object.assign(Error("No se pudieron cargar los mensajes."), { status: response.status });
      const page: ChatPage = await response.json();
      if (requestGeneration !== generation.current) return;
      setConversationId(conversation.id_conversacion);
      setMessages(page.items.map((message) => ({ ...message, key: String(message.id_mensaje) })));
      setCursor(page.siguiente_cursor);
    } catch (caught) {
      if (requestGeneration !== generation.current) return;
      const failure = caught as Error & { status?: number };
      if ([401, 403, 404].includes(failure.status ?? 0)) {
        clearChat();
        setBusy(false);
        setDenied(true);
      } else {
        setError(failure.message || "No se pudo cargar el chat.");
      }
    } finally {
      if (requestGeneration === generation.current) setBusy(false);
    }
  }, [clearChat]);

  useEffect(() => {
    const requestGeneration = generation;
    queueMicrotask(() => void load());
    const refresh = () => {
      if (document.visibilityState === "visible") queueMicrotask(() => void load());
    };
    const sessionChange = (event: Event) => {
      const phase = (event as CustomEvent<string>).detail;
      if (phase === "complete") { void load(); return; }
      clearChat();
      setBusy(true);
    };
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("roomies-session") : null;
    if (channel) channel.onmessage = (event: MessageEvent) => sessionChange(new CustomEvent("roomies:session-change", { detail: event.data }));
    window.addEventListener("roomies:session-change", sessionChange);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("roomies:session-change", sessionChange);
      channel?.close();
      requests.current?.abort();
      requestGeneration.current++;
    };
  }, [clearChat, load]);

  async function loadOlder() {
    if (conversationId === null || !cursor || olderBusy) return;
    const requestGeneration = generation.current;
    setOlderBusy(true);
    try {
      const response = await fetch(`/web-api/conversaciones/${conversationId}/mensajes?limite=20&antes=${encodeURIComponent(cursor)}`, { cache: "no-store", signal: requests.current?.signal });
      if (!response.ok) throw Object.assign(Error("No se pudieron cargar mensajes anteriores."), { status: response.status });
      const page: ChatPage = await response.json();
      if (requestGeneration !== generation.current) return;
      scrollAnchor.current = { height: messageList.current?.scrollHeight ?? 0, top: messageList.current?.scrollTop ?? 0 };
      setMessages((current) => [...page.items.map((message) => ({ ...message, key: String(message.id_mensaje) })), ...current]);
      setCursor(page.siguiente_cursor);
    } catch (caught) {
      if (requestGeneration !== generation.current) return;
      const failure = caught as Error & { status?: number };
      if ([401, 403, 404].includes(failure.status ?? 0)) {
        clearChat();
        setDenied(true);
      } else setError(failure.message || "No se pudieron cargar mensajes anteriores.");
    } finally {
      if (requestGeneration === generation.current) setOlderBusy(false);
    }
  }

  async function send(content: string, clientId: string) {
    if (conversationId === null || denied) return;
    const requestGeneration = generation.current;
    const targetConversation = conversationId;
    setMessages((current) => current.map((message) => message.key === clientId ? { ...message, state: "sending" } : message));
    setError("");
    try {
      const response = await fetch(`/web-api/conversaciones/${targetConversation}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Haycupo-CSRF": "1" },
        body: JSON.stringify({ contenido: content, id_cliente: clientId }),
        signal: requests.current?.signal,
      });
      if (!response.ok) throw Object.assign(Error("No se confirmó el envío. Puedes reintentar el mismo mensaje."), { status: response.status });
      const saved: MensajeServicioDto = await response.json();
      if (requestGeneration !== generation.current) return;
      setMessages((current) => current.map((message) => message.key === clientId ? { ...saved, key: clientId } : message));
    } catch (caught) {
      if (requestGeneration !== generation.current) return;
      const failure = caught as Error & { status?: number };
      if ([401, 403, 404].includes(failure.status ?? 0)) {
        clearChat();
        setDenied(true);
      } else {
        setMessages((current) => current.map((message) => message.key === clientId ? { ...message, state: "failed" } : message));
        setError(failure.message || "No se confirmó el envío.");
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || content.length > 2000 || conversationId === null || denied) return;
    const clientId = crypto.randomUUID();
    setMessages((current) => [...current, {
      id_mensaje: -Date.now(), id_conversacion: conversationId, id_remitente: 0,
      nombre_remitente: currentUserName || "Tú", contenido: content,
      fecha_envio: new Date().toISOString(), id_cliente: clientId, key: clientId, state: "sending",
    }]);
    setDraft("");
    followLatest.current = true;
    void send(content, clientId);
  }

  return <main id="contenido" className={styles.page}>
    <PageHeader title="Chat del arriendo" description="Conversación compartida por integrantes activos." />
    <p className={styles.backLink}><Link href="/mi-arriendo">Volver a Mi arriendo</Link></p>
    <Card className={styles.chatCard}>
      <header className={styles.conversationHeader}>
        <div className={styles.groupAvatar} aria-hidden="true">⌂</div>
        <div><h2>Chat del arriendo</h2><p>Convivencia · integrantes activos</p></div>
        <span className={styles.activeBadge}><span /> Activo</span>
      </header>
      {busy ? <p className={styles.notice} role="status">Cargando mensajes…</p> : denied ? <div className={styles.notice} role="alert"><h2>Acceso retirado</h2><p>Ya no perteneces a este arriendo. Se limpiaron los mensajes de esta conversación.</p></div> : error && conversationId === null ? <div className={styles.notice} role="alert"><p>{error}</p><Button variant="secondary" onClick={() => void load()}>Reintentar</Button></div> : <>
        {error ? <p className={styles.inlineError} role="alert">{error}</p> : null}
        <div ref={messageList} className={styles.messageList} role="log" aria-label="Mensajes de convivencia" aria-live="polite" onScroll={(event) => {
          const element = event.currentTarget;
          followLatest.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
        }}>
          {cursor ? <Button className={styles.olderButton} variant="secondary" disabled={olderBusy} onClick={() => void loadOlder()}>{olderBusy ? "Cargando…" : "Cargar mensajes anteriores"}</Button> : null}
          {!messages.length ? <p className={styles.emptyState}>Aún no hay mensajes. Puedes iniciar la conversación.</p> : messages.map((message) => {
            const own = message.nombre_remitente === currentUserName || message.nombre_remitente === "Tú" || message.id_remitente === 0;
            return <article className={`${styles.messageRow} ${own ? styles.ownMessage : ""}`} key={message.key}>
              {!own ? <span className={styles.memberAvatar} aria-hidden="true">{message.nombre_remitente.trim().charAt(0).toLocaleUpperCase("es-CL")}</span> : null}
              <div className={styles.messageBubble}>
                {!own ? <strong>{message.nombre_remitente}</strong> : null}
                <p>{message.contenido}</p>
                <div className={styles.messageMeta}>
                  <time dateTime={message.fecha_envio}>{new Date(message.fecha_envio).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</time>
                  {message.state === "sending" ? <span role="status">Enviando…</span> : null}
                  {message.state === "failed" ? <><span className={styles.failedStatus} role="alert">No enviado</span><Button className={styles.retryButton} variant="secondary" onClick={() => void send(message.contenido, message.key)}>Reintentar</Button></> : null}
                </div>
              </div>
            </article>;
          })}
        </div>
        <form className={styles.composer} onSubmit={submit}>
          <label className={styles.srOnly} htmlFor="chat-message">Escribe un mensaje</label>
          <textarea id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2} disabled={denied || conversationId === null} placeholder="Escribe un mensaje…" />
          <span className={styles.characterCount}>{draft.length}/2.000</span>
          <Button type="submit" aria-label="Enviar mensaje" disabled={conversationId === null || !draft.trim() || draft.trim().length > 2000}>Enviar <span aria-hidden="true">➤</span></Button>
        </form>
      </>}
    </Card>
  </main>;
}
