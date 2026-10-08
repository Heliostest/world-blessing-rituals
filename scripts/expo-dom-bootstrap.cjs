// Expo's development HTML reads the Android RN WebView bridge synchronously.
// That bridge can arrive only after document load. Delay *all* app modules:
// expo/dom/marshal snapshots its bridge availability when first imported.
// See https://github.com/expo/expo/issues/47373.
function startDomWhenReady(bundleUrl) {
  var deadline = Date.now() + 10000;
  function report(status) {
    try {
      var bridge = window.ReactNativeWebView;
      if (bridge && typeof bridge.postMessage === "function") {
        bridge.postMessage(JSON.stringify({ type: "wbr:dom-bootstrap", data: { status: status } }));
      }
    } catch (_) {
      // Diagnostics must never block application startup.
    }
  }
  function fail(message) {
    report("failed");
    console.error("[Expo DOM bootstrap] " + message);
    var root = document.getElementById("root");
    if (root) {
      root.textContent = "画面初始化失败，请返回 Expo Go 后重新打开。";
      root.setAttribute("role", "alert");
      root.style.color = "#4a2a12";
      root.style.padding = "24px";
    }
  }
  function tryStart() {
    var data;
    try {
      var bridge = window.ReactNativeWebView;
      if (bridge && typeof bridge.injectedObjectJson === "function") {
        data = JSON.parse(bridge.injectedObjectJson());
      }
    } catch (_) {
      // Android may expose the function before its value is available.
    }
    if (
      data &&
      (data.EXPO_DOM_HOST_OS === "android" || data.EXPO_DOM_HOST_OS === "ios") &&
      data.initialProps && Array.isArray(data.initialProps.names) &&
      data.initialProps.props && typeof data.initialProps.props === "object"
    ) {
      window.$$EXPO_DOM_HOST_OS = data.EXPO_DOM_HOST_OS;
      window.$$EXPO_INITIAL_PROPS = data.initialProps;
      report("ready");
      var script = document.createElement("script");
      script.crossOrigin = "anonymous";
      script.src = bundleUrl;
      script.onerror = function () { fail("Application script could not be loaded"); };
      document.body.appendChild(script);
      return;
    }
    if (Date.now() >= deadline) {
      fail("Native initialization data did not arrive within 10 seconds");
      return;
    }
    setTimeout(tryStart, 20);
  }
  tryStart();
}

function rewriteDomHtml(html) {
  const bootstrap = /<script>\s*var injectedObject = \{\};[\s\S]*?<\/script>/;
  const bundle = /<script crossorigin src="([^"]+)"><\/script>/;
  const match = html.match(bundle);
  if (!match || !bootstrap.test(html)) return html;
  const url = JSON.stringify(match[1]).replace(/</g, "\\u003c");
  const replacement = `<script>(${startDomWhenReady.toString()})(${url});</script>`;
  return html.replace(bootstrap, () => replacement).replace(bundle, "");
}

function createDomBootstrapMiddleware(nextMiddleware) {
  return (req, res, next) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (req.method === "GET" && /^\/_expo\/@dom(?:\/|$)/.test(pathname)) {
      const originalEnd = res.end;
      res.end = function (chunk, ...args) {
        res.end = originalEnd;
        if (res.statusCode === 200 &&
            String(res.getHeader("Content-Type")).startsWith("text/html") &&
            (typeof chunk === "string" || Buffer.isBuffer(chunk))) {
          chunk = rewriteDomHtml(chunk.toString());
          res.removeHeader("Content-Length");
        }
        return originalEnd.call(this, chunk, ...args);
      };
    }
    return nextMiddleware(req, res, next);
  };
}

module.exports = { rewriteDomHtml, createDomBootstrapMiddleware };
