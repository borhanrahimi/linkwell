import { expect, test } from "vitest";
import manifest from "@/app/manifest";

test("the installed app is in the Share menu and sends links to /share", () => {
  expect(manifest().share_target).toEqual({
    action: "/share",
    method: "GET",
    // The names /share reads: findSharedUrl looks at url, then text.
    params: { title: "title", text: "text", url: "url" },
  });
});

test("has the icon sizes Android needs to install the app", () => {
  const sizes = manifest().icons?.map((icon) => icon.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
});
