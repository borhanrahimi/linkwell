import type { Link } from "@/types/link";
import { getDomain, timeAgo } from "@/lib/links";

type RediscoverProps = {
  links: Link[];
  now: Date;
};

export default function Rediscover({ links, now }: RediscoverProps) {
  if (links.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="rediscover-heading" className="mt-6 rounded-lg bg-violet-50 p-4">
      <h2 id="rediscover-heading" className="font-semibold text-violet-900">
        Rediscover
      </h2>
      <p className="text-sm text-violet-700">Saved a while ago and still unread.</p>
      <ul className="mt-2 space-y-1">
        {links.map((link) => (
          <li key={link.id} className="flex items-baseline justify-between gap-3 text-sm">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-medium text-violet-900 hover:underline"
            >
              {link.title || getDomain(link.url)}
            </a>
            <span className="shrink-0 text-violet-600">saved {timeAgo(link.createdAt, now)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
