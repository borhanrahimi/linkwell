// Usernames become addresses like linkwell.app/@borhan later, so they follow
// the same rules everywhere: lowercase letters, numbers and _, 3 to 20 long.

// Names that would clash with pages or look official.
export const RESERVED_USERNAMES = [
  "about", "account", "admin", "api", "app", "discover", "explore", "folders", "help",
  "links", "linkwell", "login", "logout", "me", "new", "settings", "signin", "signup", "support",
];

// "  @Borhan " → "borhan": people often type the @ or capitals.
export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
}

// Returns what's wrong with a (normalized) username, or null when it's fine.
export function usernameError(username: string): string | null {
  if (username.length < 3) {
    return "Usernames need at least 3 characters.";
  }
  if (username.length > 20) {
    return "Usernames can have at most 20 characters.";
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return "Use only letters, numbers and _.";
  }
  if (RESERVED_USERNAMES.includes(username)) {
    return `@${username} is reserved. Please choose another.`;
  }
  return null;
}
