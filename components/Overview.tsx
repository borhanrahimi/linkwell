import CheckLinksButton from "@/components/CheckLinksButton";
import { countLinks } from "@/lib/links";
import type { Link } from "@/types/link";

type OverviewProps = {
  links: Link[];
  onChecked: (links: Link[]) => void;
};

export default function Overview({ links, onChecked }: OverviewProps) {
  const { total, unread, broken } = countLinks(links);
  const stats = [
    { label: total === 1 ? "link" : "links", value: total, alert: false },
    { label: "unread", value: unread, alert: false },
    { label: "broken", value: broken, alert: broken > 0 },
  ];

  return (
    <section aria-labelledby="overview-heading" className="glass rounded-2xl p-5">
      <h2 id="overview-heading" className="font-semibold text-ink">
        Overview
      </h2>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {stats.map((stat) => (
          // flex-col-reverse shows the number above its label, while screen
          // readers still read "links: 11" in the right order.
          <div key={stat.label} className="flex flex-col-reverse rounded-xl bg-surface/70 py-2">
            <dt className="text-xs text-muted">{stat.label}</dt>
            <dd className={`text-2xl font-bold ${stat.alert ? "text-danger" : "text-ink"}`}>{stat.value}</dd>
          </div>
        ))}
      </dl>
      {total > 0 && <CheckLinksButton onChecked={onChecked} />}
    </section>
  );
}