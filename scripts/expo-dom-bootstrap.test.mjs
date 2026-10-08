import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { rewriteDomHtml, createDomBootstrapMiddleware } = require("./expo-dom-bootstrap.cjs");
const cli = require.resolve("@expo/cli", {
  paths: [require.resolve("expo/package.json")],
});
const { getDomComponentHtml } = require(path.resolve(
  path.dirname(cli),
  "../src/start/server/middleware/DomComponentsMiddleware.js",
));
const bundle = "http://192.168.31.64:8082/entry.bundle?platform=web&dev=true";

function openPage(html) {
  const scripts = [], errors = [], timers = [];
  const root = { textContent: "", style: {}, setAttribute() {} };
  let now = 0;
  const context = vm.createContext({
    console: { error: (...args) => errors.push(args.join(" ")), info() {} },
    performance,
    Date: { now: () => now },
    setTimeout: (callback, delay) => timers.push({ callback, delay }),
    document: {
      createElement: () => ({}),
      getElementById: () => root,
      body: { appendChild: (script) => scripts.push(script.src) },
    },
  });
  context.window = context;
  for (const [, attributes, code] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src = attributes.match(/\bsrc="([^"]+)"/);
    if (src) scripts.push(src[1]);
    else {
      try { vm.runInContext(code, context); }
      catch (error) { errors.push(error.message); }
    }
  }
  return {
    context, scripts, errors, root,
    tick() {
      const timer = timers.shift();
      if (timer) { now += timer.delay; timer.callback(); }
      return !!timer;
    },
  };
}

test("does not load app modules before the delayed native object is available", () => {
  const page = openPage(rewriteDomHtml(getDomComponentHtml(bundle)));
  assert.deepEqual(page.errors, []);
  assert.deepEqual(page.scripts, []);
  page.context.ReactNativeWebView = { injectedObjectJson: () => null };
  page.tick();
  assert.deepEqual(page.scripts, []);
  page.context.ReactNativeWebView.injectedObjectJson = () => JSON.stringify({
    EXPO_DOM_HOST_OS: "android",
    initialProps: { names: ["readSave"], props: { active: true, backRequest: 0 } },
  });
  page.tick();
  assert.equal(page.context.$$EXPO_DOM_HOST_OS, "android");
  assert.equal(page.context.$$EXPO_INITIAL_PROPS.names[0], "readSave");
  assert.equal(page.context.$$EXPO_INITIAL_PROPS.props.active, true);
  assert.deepEqual(page.scripts, ["//192.168.31.64:8082/entry.bundle?platform=web&dev=true"]);
  assert.equal(page.tick(), false);
});

test("waits through incomplete or malformed native data instead of starting a broken app", () => {
  const page = openPage(rewriteDomHtml(getDomComponentHtml(bundle)));
  page.context.ReactNativeWebView = { injectedObjectJson: () => "not yet JSON" };
  page.tick();
  page.context.ReactNativeWebView.injectedObjectJson = () => '{"EXPO_DOM_HOST_OS":"android"}';
  page.tick();
  assert.deepEqual(page.scripts, []);
  assert.deepEqual(page.errors, []);
  page.context.ReactNativeWebView.injectedObjectJson = () => JSON.stringify({
    EXPO_DOM_HOST_OS: "ios",
    initialProps: { names: [], props: { label: '"quoted" `${value}` \\ path' } },
  });
  page.tick();
  assert.equal(page.context.$$EXPO_INITIAL_PROPS.props.label, '"quoted" `${value}` \\ path');
  assert.equal(page.context.$$EXPO_DOM_HOST_OS, "ios");
  assert.equal(page.scripts.length, 1);
});

test("shows a visible failure after a bounded wait when the native bridge never arrives", () => {
  const page = openPage(rewriteDomHtml(getDomComponentHtml(bundle)));
  for (let attempts = 0; attempts < 1000 && page.tick(); attempts++);
  assert.deepEqual(page.scripts, []);
  assert.ok(page.root.textContent.length > 0);
  assert.equal(page.errors.length, 1);
  assert.equal(page.tick(), false);
});

test("a failed diagnostic message cannot prevent the app from starting", () => {
  const page = openPage(rewriteDomHtml(getDomComponentHtml(bundle)));
  page.context.ReactNativeWebView = {
    injectedObjectJson: () => JSON.stringify({
      EXPO_DOM_HOST_OS: "android",
      initialProps: { names: [], props: {} },
    }),
    postMessage() { throw new Error("Message channel unavailable"); },
  };
  assert.doesNotThrow(() => page.tick());
  assert.equal(page.scripts.length, 1);
});

test("does not rewrite unrelated HTML or the production export template", () => {
  const html = "<!doctype html><p>Ordinary web page</p>";
  assert.equal(rewriteDomHtml(html), html);
  const production = getDomComponentHtml();
  assert.equal(rewriteDomHtml(production), production);
});

test("the HTTP middleware only gates successful Expo DOM pages and preserves other responses", async (t) => {
  const original = getDomComponentHtml(bundle);
  const server = createServer(createDomBootstrapMiddleware((req, res) => {
    res.statusCode = req.url.includes("invalid") ? 400 : 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(original));
    res.end(original);
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${origin}/_expo/@dom/BlessingDom.tsx?file=test`);
  assert.equal(response.status, 200);
  assert.deepEqual(openPage(await response.text()).scripts, []);
  for (const route of ["/", "/_expo/@dominion", "/_expo/@dom/invalid"]) {
    const result = await fetch(origin + route);
    assert.equal(await result.text(), original);
  }
});
