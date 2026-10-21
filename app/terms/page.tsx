import { connection } from "next/server";
import NextLink from "next/link";
import LegalPage, { Contact } from "@/components/LegalPage";

export const metadata = { title: "Terms · Linkwell" };

export default async function TermsPage() {
  // Rendered per request, so the page's scripts get the Content-Security-Policy nonce.
  await connection();

  return (
    <LegalPage title="Terms of use">
      <p>
        These are the rules for using Linkwell. By signing in, you agree to them. They&apos;re short, and written to
        be read.
      </p>

      <h2>Linkwell is free, and offered as it is</h2>
      <p>
        Linkwell is a small, independent project. It&apos;s free to use, and it&apos;s offered as it is: it does its
        best to keep your links safe and working, but it can&apos;t promise it will always be available or never lose
        anything. Keep your own copy of anything you can&apos;t lose: the account page downloads all your links as a
        bookmarks file.
      </p>

      <h2>Your links are yours</h2>
      <p>
        You own what you save. You allow Linkwell to store it, show it to you, and visit the pages you save to read
        their titles and check that they still work. That&apos;s all it&apos;s used for (see{" "}
        <NextLink href="/privacy" className="text-accent hover:underline">
          Privacy
        </NextLink>
        ).
      </p>

      <h2>Please don&apos;t</h2>
      <ul>
        <li>save or share anything illegal, or use Linkwell to harm others;</li>
        <li>try to get into other people&apos;s accounts or data, or into Linkwell&apos;s systems;</li>
        <li>overload Linkwell, or get around its limits, for example with scripts that call it over and over;</li>
        <li>use someone else&apos;s account.</li>
      </ul>
      <p>
        Accounts that break these rules may be limited or closed. If you find a security problem, please report it
        privately instead of trying it out.
      </p>

      <h2>Limits</h2>
      <p>
        To keep Linkwell fast and fair for everyone, each account can save up to 10,000 links and 200 folders, and a
        few busy actions can only be used so often.
      </p>

      <h2>Ending</h2>
      <p>
        You can delete your account at any time on the account page. If Linkwell ever has to close, you&apos;ll be told
        in advance whenever possible, with time to download your links.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may change as Linkwell grows. The date at the top always shows the latest version, and using
        Linkwell after a change means you accept it.
      </p>

      <h2>Contact</h2>
      <Contact />
    </LegalPage>
  );
}
