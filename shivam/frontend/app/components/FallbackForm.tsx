"use client";
import { useState } from "react";
import { Send } from "lucide-react";

type FallbackFormProps = { onSubmit: (text: string) => void; disabled?: boolean };

export function FallbackForm({ onSubmit, disabled }: FallbackFormProps) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText("");
  }

  return (
    <form id="sos-fallback-form" onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      <p className="text-xs text-gray-500 uppercase tracking-widest text-center">
        Can&apos;t speak? Type your emergency below
      </p>
      <div className="flex gap-2">
        <textarea
          id="sos-text-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent); }}}
          placeholder="Describe your emergency…"
          rows={2}
          disabled={disabled}
          className="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-900
            px-4 py-3 text-white placeholder-gray-600 text-sm
            focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50 transition-all"
          aria-label="Emergency description text field"
        />
        <button
          id="sos-send-button"
          type="submit"
          disabled={disabled || !text.trim()}
          className="flex items-center justify-center w-12 h-auto rounded-xl
            bg-red-600 hover:bg-red-500 active:bg-red-700 text-white
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
          aria-label="Send emergency text"
        >
          <Send size={18} />
        </button>
      </div>
    </form>
  );
}
