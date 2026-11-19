// ─── Lightweight EventEmitter ───────────────────────────────────────────────
//
// The VS Code extension host provides full Node.js built-ins at runtime,
// including the 'events' module.  However, @types/node is not installed
// in this project.  We define a minimal EventEmitter here so the class
// compiles without a dependency on external type declarations.
//
// The VS Code extension host instantiates Node's EventEmitter under the
// hood via the JavaScript engine; this local class mirrors its API.

interface ListenerEntry {
  listener: (...args: any[]) => void;
  once: boolean;
}

/**
 * Minimal EventEmitter compatible with the Node.js API subset needed
 * by AgenticDetector (on, emit, removeAllListeners).
 */
export class EventEmitter {
  private _events = new Map<string | symbol, ListenerEntry[]>();

  /** Register a permanent listener. */
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return this._addListener(event, listener, false);
  }

  /** Register a one-shot listener. */
  once(event: string | symbol, listener: (...args: any[]) => void): this {
    return this._addListener(event, listener, true);
  }

  /** Emit an event to all registered listeners. */
  emit(event: string | symbol, ...args: any[]): boolean {
    const entries = this._events.get(event);
    if (!entries || entries.length === 0) return false;

    // Iterate over a snapshot so listeners can safely remove themselves
    // during emission.
    for (const entry of [...entries]) {
      entry.listener(...args);
    }

    // Sweep one-shot listeners after emission
    const remaining = (this._events.get(event) ?? []).filter(e => !e.once);
    if (remaining.length > 0) {
      this._events.set(event, remaining);
    } else {
      this._events.delete(event);
    }

    return true;
  }

  /** Remove all listeners, optionally for a specific event only. */
  removeAllListeners(event?: string | symbol): this {
    if (event !== undefined) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
    return this;
  }

  // ── Private ──

  private _addListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
    once: boolean,
  ): this {
    const entries = this._events.get(event) ?? [];
    entries.push({ listener, once });
    this._events.set(event, entries);
    return this;
  }
}
