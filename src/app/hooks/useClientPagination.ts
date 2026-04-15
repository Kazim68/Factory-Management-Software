import { useEffect, useMemo, useState } from "react";

type UseClientPaginationOptions = {
  initialPageSize?: number;
};

export function useClientPagination<T>(
  items: T[],
  options: UseClientPaginationOptions = {},
) {
  const { initialPageSize = 10 } = options;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [items]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  const totalItems = items.length;
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [currentPage, items, pageSize]);

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = totalItems === 0 ? 0 : startItem + paginatedItems.length - 1;

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,
    startItem,
    endItem,
    paginatedItems,
    canPreviousPage: currentPage > 1,
    canNextPage: currentPage < totalPages,
    goToPreviousPage: () => setCurrentPage((page) => Math.max(page - 1, 1)),
    goToNextPage: () =>
      setCurrentPage((page) => Math.min(page + 1, totalPages)),
  };
}
