import { memo } from 'react';
import Pagination from '@mui/material/Pagination';
import PaginationItem from '@mui/material/PaginationItem';

function ListPaginationFooter({
  totalResults,
  startItemNumber,
  endItemNumber,
  totalPages,
  currentPage,
  onPageChange,
  paginationSx,
  pageSize
}) {
  if (totalResults <= 0) {
    return null;
  }

  const showPagination = totalResults > pageSize;

  return (
    <div className="list-pagination">
      <span className="list-pagination__summary">
        Showing {startItemNumber}–{endItemNumber} of {totalResults} pins
      </span>
      {showPagination ? (
        <Pagination
          count={totalPages}
          page={currentPage}
          color="primary"
          shape="rounded"
          onChange={onPageChange}
          renderItem={(item) => <PaginationItem disableRipple {...item} />}
          sx={paginationSx}
        />
      ) : null}
    </div>
  );
}

export default memo(ListPaginationFooter);
