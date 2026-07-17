export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Normalize page/limit query params into safe offset/limit values. */
export function resolvePagination(page?: number, limit?: number): {
  page: number;
  limit: number;
  skip: number;
  take: number;
} {
  const safePage = Math.max(1, Math.floor(page ?? 1));
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit ?? DEFAULT_LIMIT)));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit, take: safeLimit };
}

/** Wrap a rows/total pair into the standard paginated envelope. */
export function paginate<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
  return {
    data,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
