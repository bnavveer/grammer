// Injected only after an explicit shortcut, toolbar action, or context-menu action.
// This isolated-world script never receives API credentials.
(() => {
  const INSTANCE = "__grammerSelectionV1";
  if (globalThis[INSTANCE]) return globalThis[INSTANCE].probe();

  const LIMIT = 16000;
  let host = null;
  let shadow = null;
  let snapshot = null;
  let requestId = null;
  let previousFocus = null;

  function activeElement() {
    let element = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element;
  }

  function editableRoot(node) {
    let element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    if (!element?.isContentEditable) return null;
    while (element.parentElement?.isContentEditable) element = element.parentElement;
    return element;
  }

  function capture() {
    const element = activeElement();
    if (element?.getRootNode() === shadow) throw new Error("Select text on the page, then use the shortcut again.");
    if (["IFRAME", "FRAME"].includes(element?.tagName)) {
      throw new Error("Select text in an accessible editor. This embedded frame may block extension access.");
    }
    if (element instanceof HTMLInputElement && element.type === "password") {
      throw new Error("Password fields are excluded. Select text in another field.");
    }
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const { selectionStart: start, selectionEnd: end, value } = element;
      if (Number.isInteger(start) && end > start) {
        return { kind: "field", element, start, end, text: value.slice(start, end), value,
          editable: !element.readOnly && !element.disabled };
      }
    }
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) throw new Error("Select some text on the page, then use the shortcut again.");
    const range = selection.getRangeAt(0).cloneRange();
    const root = editableRoot(range.startContainer);
    const sameEditor = root && root === editableRoot(range.endContainer);
    const protectedContent = range.cloneContents().querySelector('[contenteditable="false"], input, textarea, select, button');
    return { kind: "range", range, root, text: selection.toString(),
      html: root?.innerHTML, editable: Boolean(sameEditor && !protectedContent) };
  }

  function probe() {
    // A toolbar popup takes window focus. The active-element chain still tells
    // us which same-origin frame owned the selection before the popup opened.
    let focused = !["IFRAME", "FRAME"].includes(document.activeElement?.tagName);
    let current = window;
    while (focused && current.parent !== current) {
      try {
        focused = current.parent.document.activeElement === current.frameElement;
        current = current.parent;
      } catch { focused = document.hasFocus(); break; }
    }
    try { return { selected: Boolean(capture().text.trim()), focused }; }
    catch { return { selected: false, focused }; }
  }

  function cancelRequest() {
    if (requestId) void chrome.runtime.sendMessage({ type: "GRAMMER_CANCEL", requestId }).catch(() => {});
  }

  function dismiss(restoreFocus = true) {
    cancelRequest();
    host?.remove();
    host = shadow = snapshot = requestId = null;
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }

  function get(id) { return shadow.getElementById(id); }
  function status(message, error = false) {
    const element = get("status");
    element.textContent = message;
    element.classList.toggle("error", error);
  }

  function mount(action) {
    host = document.createElement("div");
    host.dataset.grammer = "panel";
    host.style.cssText = "all: initial !important; position: fixed !important; inset: auto 20px 20px auto !important; z-index: 2147483647 !important; width: min(420px, calc(100vw - 24px)) !important; color-scheme: light !important;";
    shadow = host.attachShadow({ mode: "open" });
    // Static markup only. Selection and model output are assigned with textContent / value.
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; }
        * { box-sizing: border-box; }
        .panel { font: 14px/1.5 "Avenir Next", "Segoe UI", sans-serif; color: #132a4a; background: #fff; border: 1px solid #d3ddeb; border-radius: 16px; box-shadow: 0 12px 48px #17315e30; overflow: auto; max-height: calc(100dvh - 32px); text-align: left; }
        header { display: flex; align-items: center; gap: 10px; padding: 18px 20px; border-bottom: 1px solid #e3eaf6; }
        .mark { display: grid; place-items: center; width: 30px; height: 30px; background: #2452db; color: white; border-radius: 8px; font-size: 20px; font-weight: 600; }
        .brand { flex: 1; font-size: 16px; font-weight: 700; letter-spacing: -.4px; }
        .close { width: 32px; height: 32px; padding: 0; font-size: 22px; border: 0; color: #54647c; background: none; }
        main { padding: 20px; }
        h2 { font-size: 20px; letter-spacing: -.5px; margin: 0 0 6px; line-height: 1.25; }
        p { margin: 0; }
        #status { color: #54647c; margin: 8px 0 16px; overflow-wrap: anywhere; }
        #status.error { color: #a6323d; }
        details { margin: 0 0 16px; color: #54647c; }
        summary { cursor: pointer; font-size: 12px; }
        #original { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 130px; overflow: auto; margin-top: 8px; font-size: 13px; }
        label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 7px; }
        textarea { font: inherit; line-height: 1.6; color: #132a4a; background: #f5f7fc; border: 1px solid #d3ddeb; border-radius: 8px; padding: 12px; width: 100%; min-height: 130px; max-height: 260px; resize: vertical; }
        button { font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; border-radius: 7px; border: 1px solid #d3ddeb; padding: 10px 13px; background: #fff; color: #132a4a; }
        button:hover { background: #edf2ff; }
        button:disabled { cursor: default; opacity: .45; }
        button.primary { color: #fff; background: #2452db; border-color: #2452db; }
        button.primary:hover { background: #1e44b7; }
        button:focus-visible, textarea:focus-visible, summary:focus-visible { outline: 3px solid #81a4ff; outline-offset: 3px; }
        .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }
        .hint { font-size: 11px; color: #66758a; margin-top: 12px; }
        [hidden] { display: none !important; }
        @media (prefers-reduced-motion: no-preference) { .panel { animation: enter .15s ease-out; } @keyframes enter { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } } }
      </style>
      <section class="panel" role="dialog" aria-labelledby="title" aria-describedby="status" tabindex="-1">
        <header><span class="mark" aria-hidden="true">G</span><span class="brand">Grammer</span><button class="close" id="close" aria-label="Close preview">×</button></header>
        <main>
          <h2 id="title"></h2>
          <p id="status" role="status" aria-live="polite"></p>
          <div id="result" hidden>
            <details><summary>Original selection</summary><p id="original"></p></details>
            <label for="output">Your text, ready to use</label>
            <textarea id="output" spellcheck="false" aria-label="Edited text" maxlength="131072"></textarea>
            <div class="actions"><button id="copy">Copy plain text</button><button class="primary" id="replace">Replace selection</button></div>
            <p class="hint" id="hint"></p>
          </div>
          <button id="settings" hidden>Open Settings</button>
        </main>
      </section>`;
    (document.body || document.documentElement).append(host);
    get("title").textContent = action === "fix-grammar" ? "A little polish." : "Just the words.";
    get("close").addEventListener("click", () => dismiss());
    get("settings").addEventListener("click", () => { void chrome.runtime.sendMessage({ type: "GRAMMER_SETTINGS" }); });
    get("copy").addEventListener("click", () => { void copyResult(); });
    get("replace").addEventListener("click", () => { void replaceResult(); });
    shadow.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismiss(); }
    });
    shadow.querySelector(".panel").focus({ preventScroll: true });
  }

  function showResult(text) {
    get("result").hidden = false;
    get("original").textContent = snapshot.text;
    get("output").value = text;
    get("replace").disabled = !snapshot.editable;
    get("hint").textContent = snapshot.editable
      ? "Replaces only your selection, using the editor’s default style."
      : "This selection is read-only. Copy it, then paste it where you need it.";
    status(text === snapshot.text ? "Ready as plain text. Review it before replacing." : "Review the edit. You can make changes below.");
  }

  function unchanged() {
    if (!snapshot?.editable) return false;
    if (snapshot.kind === "field") return snapshot.element.isConnected && !snapshot.element.readOnly && !snapshot.element.disabled && snapshot.element.value === snapshot.value;
    return snapshot.root?.isConnected && snapshot.root.isContentEditable && snapshot.root.innerHTML === snapshot.html &&
      snapshot.range.startContainer.isConnected && snapshot.range.endContainer.isConnected;
  }

  function restoreSelection() {
    if (snapshot.kind === "field") {
      snapshot.element.focus({ preventScroll: true });
      snapshot.element.setSelectionRange(snapshot.start, snapshot.end);
    } else {
      snapshot.root?.focus({ preventScroll: true });
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(snapshot.range.cloneRange());
    }
  }

  async function replaceResult() {
    if (!unchanged()) {
      status("The original editor changed. Copy this result, or select the text again to avoid overwriting newer edits.", true);
      get("replace").disabled = true;
      return;
    }
    const text = get("output").value;
    if (!text.trim()) { status("The result is empty. Add text before replacing.", true); return; }
    const current = snapshot;
    restoreSelection();
    try {
      let inserted;
      if (current.kind === "field") {
        const expected = current.value.slice(0, current.start) + text + current.value.slice(current.end);
        inserted = document.execCommand("insertText", false, text);
        if (!inserted && current.element.value === current.value) {
          // Native setter works with controlled inputs whose frameworks override .value.
          const prototype = current.element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype, "value").set.call(current.element, expected);
          current.element.setSelectionRange(current.start + text.length, current.start + text.length);
          current.element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
        inserted = current.element.value === expected;
      } else {
        // Chrome's native editor commands preserve its undo history and dispatch editing events.
        // Never interpolate model output into HTML or mutate an editor's entire innerHTML.
        document.execCommand("removeFormat", false);
        document.execCommand("unlink", false);
        if (text.includes("\n")) {
          // insertText turns every newline into a paragraph in some editors,
          // multiplying the blank lines. Serialize a DOM-created text node in a
          // whitespace-preserving span instead. The browser escapes all content;
          // the only markup is this fixed wrapper, never model-supplied HTML.
          const plain = document.createElement("span");
          plain.style.whiteSpace = "pre-wrap";
          plain.textContent = text;
          inserted = document.execCommand("insertHTML", false, plain.outerHTML);
        } else {
          inserted = document.execCommand("insertText", false, text);
        }
      }
      if (!host || snapshot !== current) return;
      if (!inserted) throw new Error("This editor did not accept the replacement. Copy the result and paste it as plain text instead.");
      status("Selection replaced. Use your editor’s Undo to revert.");
      get("replace").disabled = true;
      get("replace").textContent = "Replaced";
      snapshot.editable = false;
    } catch (error) {
      if (host) status(error.message || "This editor does not support replacement. Use Copy plain text instead.", true);
    }
  }

  async function copyResult() {
    const text = get("output").value;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Use fallback");
      await navigator.clipboard.writeText(text);
    } catch {
      const output = get("output");
      output.focus();
      output.select();
      if (!document.execCommand("copy")) {
        status("Clipboard access was blocked. The result is selected; press Ctrl+C (⌘C on Mac).", true);
        return;
      }
    }
    if (host) status("Copied as plain text.");
  }

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !message?.type?.startsWith("GRAMMER_")) return;
    if (message.type === "GRAMMER_CAPTURE") {
      let captured;
      let error;
      try {
        captured = capture();
        if (!captured.text.trim()) throw new Error("Select some text on the page, then use the shortcut again.");
        if (captured.text.length > LIMIT) throw new Error("Select up to 16,000 characters at a time.");
      } catch (reason) { error = reason.message; }
      const focus = activeElement();
      dismiss(false);
      previousFocus = focus;
      requestId = message.requestId;
      snapshot = captured;
      mount(message.action);
      if (error) {
        status(error, true);
        respond({ ok: false });
      } else if (message.action === "plain-text") {
        showResult(captured.text);
        status("Fonts, colors, and links stay behind. No LLM needed.");
        respond({ ok: true });
      } else {
        status("Connecting to Gemini… Close this preview to cancel.");
        respond({ ok: true, text: captured.text });
      }
      return;
    }
    if (!host || message.requestId !== requestId) return;
    if (message.type === "GRAMMER_RESULT") showResult(message.text);
    if (message.type === "GRAMMER_PROGRESS") status(message.label);
    if (message.type === "GRAMMER_ERROR") { status(message.error, true); get("settings").hidden = false; }
    respond({ ok: true });
  });

  window.addEventListener("pagehide", () => dismiss(false));
  globalThis[INSTANCE] = { probe };
  return probe();
})();
