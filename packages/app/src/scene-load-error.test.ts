// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSafeCopy } from "@wbr/shared";
import type { CatalogEntry } from "@wbr/content/catalog";
import { Context, type AppContext } from "./context";
import { SceneLibraryContext } from "./scene-library";
import { SceneExperience } from "./scene-experience";
import {
  describeSceneLoadError,
  SCENE_LOAD_ERROR_COPY,
} from "./scene-load-error";
import { clickOn, renderUI, settle } from "./dom-test-utils";

/** What the review saw: an English message with a long unbroken URL. */
const RAW =
  "Content transfer interrupted: https://cdn.example.com/scene-content/woodfish/9f2c6d1e4b7a8c3d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d.glb";

describe("describeSceneLoadError", () => {
  it("keeps our own Chinese messages as they are", () => {
    expect(describeSceneLoadError("此场景需要更新 App 后打开")).toEqual({
      reason: "此场景需要更新 App 后打开",
    });
  });

  it("says it in Chinese when the cause is a browser or content message", () => {
    expect(describeSceneLoadError(RAW, true)).toEqual({
      reason: SCENE_LOAD_ERROR_COPY.other,
      detail: RAW,
    });
  });

  it.each([
    ["offline", "Failed to fetch", false, SCENE_LOAD_ERROR_COPY.offline],
    ["graphics", "Graphics context lost", true, SCENE_LOAD_ERROR_COPY.graphics],
    [
      "upgrade",
      "Please upgrade the app for this scene engine",
      true,
      SCENE_LOAD_ERROR_COPY.upgrade,
    ],
  ] as const)("names the %s case", (_name, message, online, reason) => {
    expect(describeSceneLoadError(message, online).reason).toBe(reason);
  });

  it.each(Object.entries(SCENE_LOAD_ERROR_COPY))(
    "%s copy is Chinese and safe",
    (_key, text) => {
      expect(text).toMatch(/\p{Script=Han}/u);
      expect(() => assertSafeCopy(text)).not.toThrow();
    },
  );
});

describe("a scene that will not open", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  const entry: CatalogEntry = {
    id: "far-scene",
    title: "远方的场景",
    engine: "furin-wind-chime@1",
    revision: "r1",
    manifestUrl: "https://cdn.example.com/far.json",
  };

  it("explains in Chinese, keeps the raw message in a closed detail, and retries", async () => {
    const open = vi.fn(async () => {
      throw new Error(RAW);
    });
    const ui = renderUI(
      createElement(
        Context.Provider,
        {
          value: {
            dispatch: () => true,
            back: () => {},
          } as unknown as AppContext,
        },
        createElement(
          SceneLibraryContext.Provider,
          { value: { library: { open }, ready: true } as never },
          createElement(SceneExperience, { entry }),
        ),
      ),
    );
    await settle();
    const alert = ui.host.querySelector(".scene-load-error[role=alert]")!;
    expect(alert).not.toBeNull();
    const details = alert.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain(RAW);
    // Everything shown before the detail is opened is Chinese.
    const shown = [...alert.children]
      .filter((el) => el !== details)
      .map((el) => el.textContent)
      .join("");
    expect(shown).toContain(SCENE_LOAD_ERROR_COPY.other);
    expect(shown).not.toMatch(/[A-Za-z]{3,}/);
    const retry = [...alert.querySelectorAll("button")].find(
      (b) => b.textContent === "重试打开",
    )!;
    clickOn(retry);
    await settle();
    expect(open).toHaveBeenCalledTimes(2);
    ui.unmount();
  });
});
