// MOVE-3607 — Roster Highlights badges, displayed above the roster calendar.
// Counts are always over a rolling 60-day window from today, independent of
// whichever month the calendar is currently showing.

import { Tooltip, Typography } from 'antd'
import { ExclamationCircleFilled, WarningFilled, CheckCircleFilled } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { RosterHighlightsResult } from './rosterStatusLogic'

const { Text } = Typography

function previewDates(dates: string[]): string {
  if (dates.length === 0) return 'No affected days in this window.'
  const shown = dates.slice(0, 8).map((d) => dayjs(d).format('D MMM'))
  const more = dates.length - shown.length
  return `${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}`
}

function Badge({
  icon,
  count,
  label,
  windowDays,
  dates,
  tone,
}: {
  icon: React.ReactNode
  count: number
  label: string
  windowDays: number
  dates: string[]
  tone: string
}) {
  const clear = count === 0
  return (
    <Tooltip title={previewDates(dates)}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#fff',
          border: `1px solid ${clear ? '#f0f0f0' : `${tone}55`}`,
          borderRadius: 8,
          padding: '10px 14px',
        }}
      >
        <span style={{ fontSize: 18, color: clear ? '#52c41a' : tone, display: 'flex' }}>
          {clear ? <CheckCircleFilled /> : icon}
        </span>
        <div>
          <div style={{ fontSize: 13, color: '#1a1a1a', lineHeight: 1.3 }}>
            <strong style={{ color: clear ? '#1a1a1a' : tone }}>{count}</strong> {label}
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>next {windowDays} days</Text>
        </div>
      </div>
    </Tooltip>
  )
}

export default function RosterHighlights({ highlights }: { highlights: RosterHighlightsResult }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <Badge
        icon={<ExclamationCircleFilled />}
        count={highlights.noStandbyDays}
        label={highlights.noStandbyDays === 1 ? 'day with no standby coverage' : 'days with no standby coverage'}
        windowDays={highlights.windowDays}
        dates={highlights.noStandbyDates}
        tone="#d46b08"
      />
      <Badge
        icon={<WarningFilled />}
        count={highlights.noShiftDays}
        label={highlights.noShiftDays === 1 ? 'day with no AM/PM shift assigned' : 'days with no AM/PM shift assigned'}
        windowDays={highlights.windowDays}
        dates={highlights.noShiftDates}
        tone="#cf1322"
      />
    </div>
  )
}
