import type { Page } from "@playwright/test";

export type ContrastResult = { text: string; ratio: number; needed: number };

// Measures the contrast of every piece of text on the page against what is
// really behind it. Glass cards are see-through, so the background can't be
// read from CSS: instead we hide all text, take a screenshot, and look at the
// pixels where each text was. WCAG AA needs 4.5:1 for normal text and 3:1 for
// large text (24px, or 18.66px bold).
export async function measureContrast(page: Page): Promise<ContrastResult[]> {
  const texts = await page.evaluate(() => {
    const rgba = (color: string) => (color.match(/[\d.]+/g) ?? []).map(Number);
    return Array.from(document.querySelectorAll("body *")).flatMap((el) => {
      const text = Array.from(el.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim())
        .join(" ")
        .trim();
      const box = el.getBoundingClientRect();
      if (!text || box.width === 0 || box.height === 0) return [];
      // WCAG doesn't require contrast for disabled controls (like "Saving...").
      if (el.closest(":disabled")) return [];

      const style = getComputedStyle(el);
      // A faded parent (like opacity-75 on read cards) fades the text too.
      let opacity = 1;
      for (let e: Element | null = el; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
      // Fully see-through text (like Edit and Delete on a card until it's
      // hovered) isn't showing yet: there's nothing to read. When it shows,
      // it has the same style as the buttons next to it, which are measured.
      if (opacity === 0) return [];
      // Text covered by something else (behind a dimmed backdrop while a
      // drawer or sheet is open) isn't being read; what's on top is measured.
      const covering = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      if (covering && covering !== el && !el.contains(covering) && !covering.contains(el)) return [];
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (Number(style.fontWeight) >= 700 && size >= 18.66);

      return [{ text: text.slice(0, 40), color: rgba(style.color), opacity, large,
        x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height }];
    });
  });

  const hideText = await page.addStyleTag({
    content: "* { color: transparent !important; text-shadow: none !important; } img { visibility: hidden !important; }",
  });
  const screenshot = (await page.screenshot({ fullPage: true })).toString("base64");
  await hideText.evaluate((tag) => (tag as Element).remove());

  return page.evaluate(
    async ({ screenshot, texts }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${screenshot}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);

      // Relative luminance, from the WCAG definition.
      const luminance = ([r, g, b]: number[]) => {
        const channel = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };

      return texts.map((t) => {
        const pixels = context.getImageData(Math.round(t.x), Math.round(t.y), Math.max(1, Math.round(t.width)), Math.max(1, Math.round(t.height))).data;
        // The background is the typical (median) pixel behind the text. The
        // box can include a few edge pixels (a button's rounded corners show
        // the page behind them), and the median ignores those.
        const behind: number[][] = [];
        for (let i = 0; i < pixels.length; i += 4) behind.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
        behind.sort((p, q) => luminance(p) - luminance(q));
        const background = behind[Math.floor(behind.length / 2)];

        const alpha = (t.color[3] ?? 1) * t.opacity;
        const foreground = t.color.slice(0, 3).map((v, i) => v * alpha + background[i] * (1 - alpha));
        const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
        const ratio = Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
        return { text: t.text, ratio, needed: t.large ? 3 : 4.5 };
      });
    },
    { screenshot, texts }
  );
}
