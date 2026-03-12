import type { ScanResultItem } from '../../../electron/shared/types/scan';

interface ScanResultsTableProps {
  items: ScanResultItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onCleanOne: (item: ScanResultItem) => void;
  onSort: (key: 'name' | 'size') => void;
  sortKey: 'name' | 'size';
  sortDir: 'asc' | 'desc';
  showHeader?: boolean;
}

const ScanResultsTable = ({
  items,
  selectedIds,
  onToggle,
  onToggleAll,
  onCleanOne,
  onSort,
  sortKey,
  sortDir,
  showHeader = true
}: ScanResultsTableProps) => {
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <table className="w-full text-left text-sm">
        {showHeader ? (
          <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="h-4 w-4 accent-sky-400"
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSort('name')}
                  className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted"
                >
                  Project
                  <span className="text-[10px] text-slate-400">
                    {sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </span>
                </button>
              </th>
              <th className="px-4 py-3">Path</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSort('size')}
                  className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted"
                >
                  Junk Size
                  <span className="text-[10px] text-slate-400">
                    {sortKey === 'size' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </span>
                </button>
              </th>
              <th className="px-4 py-3">Junk Folders</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
        ) : null}
        <tbody className="divide-y divide-slate-800">
          {items.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-muted" colSpan={6}>
                Results will appear here after the first scan.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id} className="bg-slate-950/40">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => onToggle(item.id)}
                    className="h-4 w-4 accent-sky-400"
                    aria-label={`Select ${item.projectName}`}
                  />
                </td>
                <td className="px-4 py-4 font-medium">{item.projectName}</td>
                <td className="px-4 py-4 text-muted">{item.rootPath}</td>
                <td className="px-4 py-4">{item.junkSizeLabel}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    {item.junkFolders.map((folder) => (
                      <span
                        key={folder}
                        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
                      >
                        {folder}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onCleanOne(item)}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60"
                  >
                    Clean Junk
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ScanResultsTable;
