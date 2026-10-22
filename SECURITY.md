# Security

Linkwell keeps people's saved links and their Google sign-in, so security problems matter. Thank you for helping keep it safe.

## Reporting a problem

**Please don't open a public issue for a security problem.** Report it privately instead:

1. Go to this repository's **Security** tab on GitHub.
2. Click **Report a vulnerability**.
3. Describe what you found, how to reproduce it, and what someone could do with it.

You'll get an answer as soon as possible. Once it's fixed, you're welcome to be credited.

## What's in scope

- The live site: https://linkwell-dypu.vercel.app
- The code in this repository, including the browser extension in `extension/`

Especially welcome: seeing or changing another person's links, folders or account; getting the server to fetch private addresses; running scripts in someone else's browser; getting around the rate limits or account limits.

**Out of scope:** denial-of-service by sheer traffic, reports from automated scanners without a working example, and problems in Google, Vercel or Neon themselves (report those to them).

## How Linkwell protects its users

- Sign-in is only through Google (Better Auth); Linkwell never sees a password.
- Every Server Action checks who is signed in, and only reads or changes that person's own rows.
- Everything sent to the server is checked again there: only `http`/`https` links, and length limits on every field.
- Expensive actions are rate limited, and each account has a maximum number of links and folders.
- The link checker refuses private and internal addresses (SSRF protection).
- A Content-Security-Policy with a fresh nonce for every page, and security headers on every response.
- Secrets live only in Vercel and in a local `.env.local` that's never committed.

The details, and the checklist every new feature goes through, are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#7-security).
