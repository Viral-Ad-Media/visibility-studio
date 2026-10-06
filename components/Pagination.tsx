import Link from "next/link";
export default function Pagination({
  page,
  hasMore,
  path,
}: {
  page: number;
  hasMore: boolean;
  path: string;
}) {
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between py-4 text-sm"
    >
      {page > 1 ? (
        <Link href={`${path}?page=${page - 1}`}>Previous</Link>
      ) : (
        <span />
      )}
      <span>Page {page}</span>
      {hasMore ? <Link href={`${path}?page=${page + 1}`}>Next</Link> : <span />}
    </nav>
  );
}
