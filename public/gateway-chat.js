/*
 * Aultrum Gateway web chat. Add to any website, just before </body>:
 *   <script src="https://canvas.aultrum.co.uk/gateway-chat.js" data-gateway="YOUR-GATEWAY-ID" async></script>
 * Optional: data-colour="#0021cc" for the button, data-label="Chat with us".
 */
(function () {
  var script = document.currentScript;
  var id = script && script.getAttribute("data-gateway");
  if (!id || document.getElementById("aultrum-gateway-chat")) return;
  var origin = new URL(script.src).origin;
  var colour = script.getAttribute("data-colour") || "#0021cc";
  var label = script.getAttribute("data-label") || "Chat with us";

  var root = document.createElement("div");
  root.id = "aultrum-gateway-chat";
  root.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483000;font-family:system-ui,sans-serif";

  var frame = null;
  var button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", "false");
  button.style.cssText = "width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;background:" + colour + ";color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center";
  var openIcon = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var closeIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  button.innerHTML = openIcon;

  function setOpen(open) {
    if (open && !frame) {
      frame = document.createElement("iframe");
      frame.src = origin + "/chat/" + encodeURIComponent(id);
      frame.title = label;
      frame.style.cssText = "position:absolute;right:0;bottom:72px;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 110px));border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 16px 48px rgba(0,0,0,.18)";
      root.insertBefore(frame, button);
    }
    if (frame) frame.style.display = open ? "block" : "none";
    button.innerHTML = open ? closeIcon : openIcon;
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close chat" : label);
  }
  var isOpen = false;
  button.addEventListener("click", function () { isOpen = !isOpen; setOpen(isOpen); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen) { isOpen = false; setOpen(false); button.focus(); } });

  root.appendChild(button);
  (document.body || document.documentElement).appendChild(root);
})();
