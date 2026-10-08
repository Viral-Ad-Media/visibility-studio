import Link from "next/link";
export default function Pagination({
  page,
  hasMore,
  path,
  query = {},
}: {
  page: number;
  hasMore: boolean;
  path: string;
  query?: Record<string, string>;
}) {
  const href = (next: number) => `${path}?${new URLSearchParams({ ...query, page: String(next) })}`;
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between py-4 text-sm"
    >
      {page > 1 ? (
        <Link href={href(page - 1)}>Previous</Link>
      ) : (
        <span />
      )}
      <span>Page {page}</span>
      {hasMore ? <Link href={href(page + 1)}>Next</Link> : <span />}
    </nav>
  );
}
