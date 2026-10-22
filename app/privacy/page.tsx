import { connection } from "next/server";
import LegalPage, { Contact } from "@/components/LegalPage";

export const metadata = { title: "Privacy" };

// Plain language, and only what Linkwell really does: keep it true whenever a
// feature changes what's stored or who sees it (and update SITE.legalUpdated).
export default async function PrivacyPage() {
  // Rendered per request, so the page's scripts get the Content-Security-Policy nonce.
  await connection();

  return (
    <LegalPage title="Privacy">
      <p>
        Linkwell is a small, independent app for saving links. This page says what it stores about you, why, and what
        you can do about it. In short: only what it needs to work, never sold, never used for ads.
      </p>

      <h2>What Linkwell stores</h2>
      <ul>
        <li>
          <strong>Your account.</strong> When you sign in, your Google account shares your name, email address and
          profile picture with Linkwell, and the username you choose is added to them. Linkwell only asks for this basic
          profile: it can&apos;t read your mail, files or anything else in your Google account.
        </li>
        <li>
          <strong>Your links.</strong> The addresses you save, with their titles, tags, notes, folders, whether you
          marked them as read, when you saved them, and whether they still worked the last time they were checked.
        </li>
        <li>
          <strong>Sign-in sessions.</strong> While you&apos;re signed in, a session records when it started, the IP
          address and the type of browser, so it can be ended and protected. Sessions end when you sign out or after a
          while.
        </li>
        <li>
          <strong>Usage counts.</strong> To stop anyone from overloading Linkwell, it counts how often each account
          uses a few busy actions, like checking links. These counts are deleted after a day.
        </li>
      </ul>

      <h2>What Linkwell does with it</h2>
      <ul>
        <li>Shows your links to you, and only to you.</li>
        <li>
          Visits the pages you save from its own server: once to read a page&apos;s title and preview picture, and once
          a day to check that your links still work.
        </li>
        <li>Nothing else. There&apos;s no advertising, no selling of data, and no tracking or analytics.</li>
      </ul>

      <h2>Who else is involved</h2>
      <p>
        Linkwell runs on a hosting provider (which serves the app) and a database provider (which stores the data).
        They keep it on Linkwell&apos;s behalf and don&apos;t use it for themselves. Their servers may be in another
        country than yours.
      </p>
      <p>
        When you look at your links, your browser loads each site&apos;s small icon from a public icon service, which
        then learns the website&apos;s name (not the full address, and not who you are). A link&apos;s preview
        picture loads straight from the website it belongs to, like when you visit it, without telling it which page
        asked. A broken link&apos;s
        &ldquo;View archived copy&rdquo; opens a public web archive.
      </p>

      <h2>Cookies</h2>
      <p>
        Linkwell uses one kind of cookie: the one that keeps you signed in. There are no advertising or tracking
        cookies.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Take your links with you:</strong> the account page downloads all your links and folders as a
          bookmarks file.
        </li>
        <li>
          <strong>Delete everything:</strong> deleting your account on the account page removes your account, links,
          folders and sessions right away.
        </li>
        <li>
          <strong>Change your details:</strong> edit or delete any link, and change your username, whenever you like.
        </li>
      </ul>

      <h2>Children</h2>
      <p>Linkwell isn&apos;t meant for children under 13.</p>

      <h2>Changes</h2>
      <p>If this page changes, the date at the top changes too.</p>

      <h2>Contact</h2>
      <Contact />
    </LegalPage>
  );
}
