import type { Link } from "@/types/link";
import { getDomain, timeAgo } from "@/lib/links";
import Stargazer from "@/components/illustrations/Stargazer";

type RediscoverProps = {
  links: Link[];
  now: Date;
  className?: string;
};

export default function Rediscover({ links, now, className = "" }: RediscoverProps) {
  if (links.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="rediscover-heading"
      className={`glass flex gap-4 rounded-2xl p-5 ring-1 ring-highlight/30 ${className}`}
    >
      <div className="min-w-0 flex-1">
        <h2 id="rediscover-heading" className="font-semibold text-highlight">
          Rediscover
        </h2>
        <p className="text-sm text-highlight">Remember these? Saved a while ago and still unread.</p>
        <ul className="mt-2 space-y-1">
          {links.map((link) => (
            <li key={link.id} className="flex items-baseline justify-between gap-3 text-sm">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-medium text-highlight hover:underline"
              >
                {link.title || getDomain(link.url)}
              </a>
              <span className="shrink-0 text-muted">saved {timeAgo(link.createdAt, now)}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* Hidden on phones: there, every bit of width goes to the link titles. */}
      <Stargazer className="hidden w-32 shrink-0 self-end sm:block" />
    </section>
  );
}
