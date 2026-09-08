// Detached pagination card — the same one Invoice 2.0 and the Inspection
// reference use, lifted out so the three Leave pages share a single copy
// rather than each carrying its own.

import { Select, Typography } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'

const { Text } = Typography

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 / page' },
  { value: 20, label: '20 / page' },
  { value: 50, label: '50 / page' },
]

export default function PaginationBar({
  noun,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  /** What is being counted, e.g. "Employee" — the summary reads "viewing Employee 1 – 10 of 19". */
  noun: string
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  onPageSizeChange: (n: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    height: 32,
    padding: '0 6px',
    borderRadius: 6,
    border: `1px solid ${active ? '#1677ff' : '#e8eaed'}`,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    color: active ? '#1677ff' : '#1a1d23',
    fontWeight: active ? 600 : 400,
  })

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 10,
        marginTop: 16,
        padding: '13px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 13, color: '#595959' }}>
        You are now viewing {noun} {from} – {to} of {total}
      </Text>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          style={{ ...btnStyle(false), color: '#8c8c8c', opacity: page === 1 ? 0.5 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
        >
          <LeftOutlined style={{ fontSize: 11 }} />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button key={p} onClick={() => onPageChange(p)} style={btnStyle(p === page)}>
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          style={{
            ...btnStyle(false),
            color: '#8c8c8c',
            opacity: page === totalPages ? 0.5 : 1,
            cursor: page === totalPages ? 'not-allowed' : 'pointer',
          }}
        >
          <RightOutlined style={{ fontSize: 11 }} />
        </button>
        <Select
          size="small"
          value={pageSize}
          onChange={onPageSizeChange}
          options={PAGE_SIZE_OPTIONS}
          style={{ marginLeft: 8, width: 100 }}
        />
      </div>
    </div>
  )
}
