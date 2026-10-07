export type LinkStatus = "ok" | "broken";

export type Link = {
  id: string;
  url: string;
  title?: string;
  tags?: string[];
  createdAt: string;
  status?: LinkStatus;
  checkedAt?: string;
};
