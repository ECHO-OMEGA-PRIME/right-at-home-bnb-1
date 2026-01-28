/**
 * Loading state for Admin Financial Dashboard
 */

export default function AdminFinanceLoading() {
  return (
    <div className="min-h-screen bg-[#F5F5F0] p-6 lg:p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header Skeleton */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <div className="h-9 w-72 bg-white/50 rounded-lg animate-pulse" />
            <div className="h-5 w-48 bg-white/30 rounded-lg animate-pulse mt-2" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-32 bg-white/50 rounded-xl animate-pulse" />
            <div className="h-10 w-10 bg-white/50 rounded-xl animate-pulse" />
            <div className="h-10 w-28 bg-[#500000]/30 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-[#2D2D2D]/5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="h-4 w-24 bg-[#2D2D2D]/10 rounded animate-pulse" />
                  <div className="h-8 w-32 bg-[#2D2D2D]/10 rounded animate-pulse mt-3" />
                  <div className="h-3 w-20 bg-[#2D2D2D]/10 rounded animate-pulse mt-2" />
                </div>
                <div className="w-14 h-14 rounded-xl bg-[#500000]/10 animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-2xl p-6 border border-[#2D2D2D]/5 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-6 w-48 bg-[#2D2D2D]/10 rounded animate-pulse" />
              <div className="h-4 w-32 bg-[#2D2D2D]/5 rounded animate-pulse mt-2" />
            </div>
            <div className="h-4 w-24 bg-[#500000]/20 rounded animate-pulse" />
          </div>

          <div className="space-y-4">
            {/* Table Header */}
            <div className="grid grid-cols-6 gap-4 pb-4 border-b border-[#2D2D2D]/10">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-[#2D2D2D]/10 rounded animate-pulse" />
              ))}
            </div>

            {/* Table Rows */}
            {[...Array(8)].map((_, i) => (
              <div key={i} className="grid grid-cols-6 gap-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#500000]/10 animate-pulse" />
                  <div className="h-4 w-28 bg-[#2D2D2D]/10 rounded animate-pulse" />
                </div>
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="h-4 bg-[#2D2D2D]/10 rounded animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Charts Row Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-[#2D2D2D]/5">
            <div className="h-6 w-40 bg-[#2D2D2D]/10 rounded animate-pulse mb-6" />
            <div className="h-[300px] bg-[#2D2D2D]/5 rounded-xl animate-pulse" />
          </div>
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#2D2D2D]/5">
            <div className="h-6 w-56 bg-[#2D2D2D]/10 rounded animate-pulse mb-6" />
            <div className="h-[300px] bg-[#2D2D2D]/5 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Bottom Row Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-6 border border-[#2D2D2D]/5">
            <div className="h-6 w-48 bg-[#2D2D2D]/10 rounded animate-pulse mb-6" />
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-[#2D2D2D]/5 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
          <div className="bg-gradient-to-br from-[#500000]/20 to-[#722F37]/20 rounded-2xl p-6">
            <div className="h-6 w-40 bg-white/30 rounded animate-pulse mb-6" />
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 bg-white/20 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
