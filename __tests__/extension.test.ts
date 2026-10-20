import { beforeAll, expect, test, vi } from "vitest";
import manifest from "../extension/manifest.json";

type Tab = { url?: string; title?: string; index: number };
let onClick: (tab: Tab) => void;
const create = vi.fn();

beforeAll(async () => {
  // A fake `chrome` with just the parts background.js uses.
  vi.stubGlobal("chrome", {
    action: { onClicked: { addListener: (listener: typeof onClick) => (onClick = listener) } },
    tabs: { create },
  });
  // @ts-expect-error: plain JavaScript file without types
  await import("../extension/background.js");
});

test("opens /share for the current tab, right next to it", () => {
  onClick({ url: "https://example.com/post?a=1&b=2", title: "A post & more", index: 3 });

  expect(create).toHaveBeenLastCalledWith({
    url: "https://linkwell-dypu.vercel.app/share?url=https%3A%2F%2Fexample.com%2Fpost%3Fa%3D1%26b%3D2&title=A+post+%26+more",
    index: 4,
  });
});

test("does nothing on browser pages like chrome://settings", () => {
  create.mockClear();
  onClick({ url: "chrome://settings", title: "Settings", index: 0 });

  expect(create).not.toHaveBeenCalled();
});

test("the manifest only asks for the activeTab permission", () => {
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toEqual(["activeTab"]);
});
