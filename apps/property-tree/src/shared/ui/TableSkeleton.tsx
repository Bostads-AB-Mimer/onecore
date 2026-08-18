const TableSkeleton = () => (
  <div className="space-y-4">
    <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
    </div>
  </div>
)

export default TableSkeleton
