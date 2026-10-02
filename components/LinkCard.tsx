import type { Link } from "@/types/link";

type LinkCardProps = {
  link: Link;
  onDelete: (id: number) => void;
};

export default function LinkCard({ link, onDelete }: LinkCardProps) {
  return (
    <li className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate font-medium text-blue-600 hover:underline"
        >
          {link.url}
        </a>
        <p className="text-sm text-slate-400">Saved {link.createdAt}</p>
      </div>
      <button
        onClick={() => onDelete(link.id)}
        className="ml-4 text-sm text-slate-400 hover:text-red-500"
      >
        Delete
      </button>
    </li>
  );
}
