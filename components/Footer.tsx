import NextLink from "next/link";

// At the bottom of the landing page, the account page and the legal pages.
export default function Footer() {
  return (
    <footer className="mt-16 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted">
      <span>Linkwell</span>
      <NextLink href="/privacy" className="hover:text-ink hover:underline">
        Privacy
      </NextLink>
      <NextLink href="/terms" className="hover:text-ink hover:underline">
        Terms
      </NextLink>
    </footer>
  );
}
