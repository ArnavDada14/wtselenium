import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  processMessage,
  initContext,
  getQuickActions,
} from '../lib/chatEngine';
import type { ChatMessage, UserRole } from '../lib/chatEngine';
import './Chatbot.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let msgIdCounter = 0;
function nextId() {
  return `msg-${Date.now()}-${++msgIdCounter}`;
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/** Render markdown-like bold/italic in a text string */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Split on **bold** and *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function renderBotText(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => (
    <React.Fragment key={i}>
      {i > 0 && <br />}
      {line.startsWith('• ') ? (
        <span style={{ display: 'block', paddingLeft: 8 }}>
          {'• '}{renderInlineMarkdown(line.slice(2))}
        </span>
      ) : (
        renderInlineMarkdown(line)
      )}
    </React.Fragment>
  ));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Chatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pulsed, setPulsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const role: UserRole = (user?.role as UserRole) ?? 'STUDENT';

  // Initialize engine context when role changes
  useEffect(() => {
    initContext(role);
  }, [role]);

  // Pulse animation only once
  useEffect(() => {
    const timer = setTimeout(() => setPulsed(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = {
        id: nextId(),
        role: 'user',
        text: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        const response = await processMessage(trimmed);
        const botMsg: ChatMessage = {
          id: nextId(),
          role: 'bot',
          text: response.text,
          table: response.table,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'bot',
            text: 'Something went wrong. Please try again.',
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleChipClick = (query: string) => {
    if (query.endsWith(' ')) {
      // "search " → focus the input with that prefix
      setInput(query);
      inputRef.current?.focus();
    } else {
      sendMessage(query);
    }
  };

  const quickActions = getQuickActions(role);

  if (!user) return null;

  return (
    <>
      {/* Floating Bubble */}
      <button
        id="chatbot-toggle"
        className={`chatbot-bubble${open ? ' chatbot-bubble--open' : ''}${
          !pulsed ? ' chatbot-bubble-pulse' : ''
        }`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        title={open ? 'Close chat' : 'LibraCMS Assistant'}
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat Panel */}
      <div
        className={`chatbot-panel${open ? ' chatbot-panel--visible' : ''}`}
        role="dialog"
        aria-label="LibraCMS Chat Assistant"
      >
        {/* Header */}
        <div className="chatbot-header">
          <div className="chatbot-header-icon">📚</div>
          <div className="chatbot-header-text">
            <div className="chatbot-header-title">LibraCMS Assistant</div>
            <div className="chatbot-header-sub">
              {role === 'STUDENT' ? 'Books • Fines • Catalog' : 'Issues • Stats • Fines'}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="chatbot-quick-actions">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              className="chatbot-chip"
              onClick={() => handleChipClick(qa.query)}
            >
              {qa.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="chatbot-messages">
          {messages.length === 0 && (
            <div className="chatbot-welcome">
              <span className="chatbot-welcome-emoji">👋</span>
              Hi{user.name ? `, ${user.name.split(' ')[0]}` : ''}! I'm your library
              assistant. Ask me about books, fines, or type{' '}
              <strong>"help"</strong> to see what I can do.
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`chatbot-msg chatbot-msg--${msg.role}`}>
              <div className="chatbot-msg-bubble">
                {msg.role === 'bot' ? renderBotText(msg.text) : msg.text}
                {msg.table && (
                  <table className="chatbot-table">
                    <thead>
                      <tr>
                        {msg.table.headers.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {msg.table.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="chatbot-msg-time">{fmtTime(msg.timestamp)}</div>
            </div>
          ))}

          {loading && (
            <div className="chatbot-typing">
              <div className="chatbot-typing-dot" />
              <div className="chatbot-typing-dot" />
              <div className="chatbot-typing-dot" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form className="chatbot-input-bar" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            id="chatbot-input"
            className="chatbot-input"
            type="text"
            placeholder="Ask about books, fines, catalog…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            autoComplete="off"
          />
          <button
            id="chatbot-send"
            className="chatbot-send"
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            ➤
          </button>
        </form>
      </div>
    </>
  );
}
