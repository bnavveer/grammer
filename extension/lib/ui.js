export async function showShortcuts() {
  const commands = await chrome.commands.getAll();
  const mac = /Mac/.test(navigator.platform);
  for (const element of document.querySelectorAll("[data-command]")) {
    const command = commands.find((item) => item.name === element.dataset.command);
    let label = command?.shortcut || "Set shortcut";
    if (mac) label = label.replaceAll("Command", "⌘").replaceAll("MacCtrl", "⌃").replaceAll("Alt", "⌥");
    label = label.replaceAll("Shift", "⇧").replaceAll("+", " ");
    element.textContent = label;
    element.title = command?.shortcut || "No shortcut assigned. Open Change keyboard shortcuts to assign one.";
  }
}

export function bindShortcuts() {
  document.getElementById("shortcuts")?.addEventListener("click", () => {
    void chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });
  // Chrome owns these bindings. Refresh when users return from its shortcut editor.
  window.addEventListener("focus", () => { void showShortcuts().catch(() => {}); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void showShortcuts().catch(() => {});
  });
}
