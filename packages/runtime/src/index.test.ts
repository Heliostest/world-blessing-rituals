import { expect, it } from "vitest";
import { createStore } from "./index";

it("preserves corrupt data and blocks writes until it can load", async () => {
  const writes: string[] = [];
  const store = createStore({
    read: async () => "{bad",
    write: async (raw) => {
      writes.push(raw);
    },
  });
  await store.load();
  expect(store.getSnapshot().status).toBe("load-error");
  expect(() =>
    store.dispatch({ type: "settings", key: "sound", value: false }),
  ).toThrow();
  expect(writes).toHaveLength(0);
});
it("serializes rapid saves and retries the latest snapshot after failure", async () => {
  const writes: string[] = [];
  let fail = true;
  const store = createStore({
    read: async () => null,
    write: async (raw) => {
      if (fail) throw new Error("full");
      writes.push(raw);
    },
  });
  await store.load();
  store.dispatch({ type: "settings", key: "sound", value: false });
  await store.flush();
  expect(store.getSnapshot().status).toBe("save-error");
  fail = false;
  store.dispatch({ type: "settings", key: "haptics", value: false });
  await store.flush();
  expect(store.getSnapshot().status).toBe("saved");
  expect(JSON.parse(writes.at(-1)!).settings).toMatchObject({
    sound: false,
    haptics: false,
  });
});
