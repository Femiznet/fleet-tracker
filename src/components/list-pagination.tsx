import Link from "next/link";

export default function ListPagination({
  basePath,
  page,
  pageSize,
  total,
  query,
  filters = {},
}: {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  query?: string;
  filters?: Record<string, string>;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  function href(nextPage: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    if (nextPage > 1) params.set("page", String(nextPage));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  }

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{firstItem}–{lastItem}</span> of{" "}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Link
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          href={href(Math.max(1, page - 1))}
          className={`rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium ${
            page <= 1 ? "pointer-events-none text-slate-300" : "hover:bg-slate-50"
          }`}
        >
          Previous
        </Link>
        <span className="px-2 text-sm tabular-nums text-slate-500">
          Page {page} of {pageCount}
        </span>
        <Link
          aria-disabled={page >= pageCount}
          tabIndex={page >= pageCount ? -1 : undefined}
          href={href(Math.min(pageCount, page + 1))}
          className={`rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium ${
            page >= pageCount ? "pointer-events-none text-slate-300" : "hover:bg-slate-50"
          }`}
        >
          Next
        </Link>
      </div>
    </nav>
  );
}
