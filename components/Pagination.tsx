import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function Pagination({
  page,
  hasMore,
  path,
}: {
  page: number;
  hasMore: boolean;
  path: string;
}) {
  // A single page needs no pager at all.
  if (page === 1 && !hasMore) return null;
  const link = buttonVariants({ variant: "outline", size: "sm" });
  const disabled =
    "inline-flex h-8 items-center gap-2 px-3 text-xs font-medium text-slate-600 cursor-not-allowed [&_svg]:size-4";
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 pt-6 text-sm"
    >
      {page > 1 ? (
        <Link href={`${path}?page=${page - 1}`} rel="prev" className={link}>
          <ChevronLeft />
          Previous
        </Link>
      ) : (
        <span aria-hidden className={disabled}>
          <ChevronLeft />
          Previous
        </span>
      )}
      <span className="text-xs text-slate-500 tabular-nums" aria-current="page">
        Page {page}
      </span>
      {hasMore ? (
        <Link href={`${path}?page=${page + 1}`} rel="next" className={link}>
          Next
          <ChevronRight />
        </Link>
      ) : (
        <span aria-hidden className={disabled}>
          Next
          <ChevronRight />
        </span>
      )}
    </nav>
  );
}
