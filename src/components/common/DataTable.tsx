// Shared "standard table" shape (FIGMA_DESIGN_SYSTEM.md §3.3): one bordered,
// 8px-radius white card holding an optional toolbar (date range filter,
// search, filter icon, primary action button — whatever the page needs)
// directly above the table, separated by a single divider — never a
// toolbar floating in its own row above a separately-bordered table box.
//
// Built because the same table card was being hand-rolled per page (and
// drifting — three independent copies of the same column-divider CSS hack
// existed before FIGMA_DESIGN_SYSTEM.md §3.3's pass). Use this for every new
// "standard table" page-listing table going forward, per the user's
// explicit instruction, rather than hand-rolling the wrapper again.
//
// Sort icons are untouched here — AntD's `Table` already shows one only for
// a column that actually defines `sorter`, which is the right behaviour
// (see LeavePage.tsx's AL/ML Balance columns, deliberately not sortable)
// and this component does not override it.

import type { ReactNode } from 'react'
import { Table, type TableProps } from 'antd'

export default function DataTable<RecordType extends object = object>({
  toolbar,
  ...tableProps
}: {
  /** The toolbar row's own contents (a RangePicker, search Input, filter
   * button, primary action, etc.) — laid out right-aligned, same as every
   * existing "standard table" toolbar in this app. Omit entirely for a
   * table with no toolbar (e.g. Manage Leave Types' tables). */
  toolbar?: ReactNode
} & TableProps<RecordType>) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
      {toolbar && (
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {toolbar}
        </div>
      )}
      <Table<RecordType> {...tableProps} />
    </div>
  )
}
