// Shift picker used by the Edit Roster drawer.
//
// Replaces AntD's Segmented so the selected option can carry real contrast.
// Review feedback 7: with the stock control the selected and unselected states
// read almost the same, especially next to the bright blue Standby checkbox.
// The old look is kept as the "subtle" variant so it can still be compared.

import type { ShiftSelection } from './rosterData'
import { SHIFT_SELECTION_LABEL } from './rosterStatusLogic'

export type ShiftContrast = 'strong' | 'subtle'

export default function ShiftSelector({
  value,
  options,
  disabled = false,
  contrast,
  onChange,
}: {
  value: ShiftSelection
  options: ShiftSelection[]
  disabled?: boolean
  contrast: ShiftContrast
  onChange: (value: ShiftSelection) => void
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: contrast === 'strong' ? 4 : 0,
        padding: contrast === 'strong' ? 0 : 2,
        borderRadius: 6,
        background: contrast === 'strong' ? 'transparent' : '#f5f5f5',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {options.map((option) => {
        const selected = option === value
        const strong = contrast === 'strong'
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(option)}
            style={{
              minWidth: 44,
              padding: '2px 10px',
              fontSize: 12,
              lineHeight: '20px',
              // Labels never wrap: a wrapped one used to make the whole drawer
              // row twice as tall.
              whiteSpace: 'nowrap',
              borderRadius: strong ? 6 : 4,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
              ...(strong
                ? {
                    // Solid fill on the selected option, so it stands up next to
                    // the Standby checkbox instead of disappearing behind it.
                    fontWeight: selected ? 600 : 500,
                    // Feedback 5 — the unselected tiles were washing out.
                    border: `1px solid ${selected ? '#1677ff' : '#bfbfbf'}`,
                    background: selected ? '#1677ff' : '#fff',
                    color: selected ? '#fff' : '#434343',
                  }
                : {
                    // The original AntD Segmented look.
                    fontWeight: 400,
                    border: '1px solid transparent',
                    background: selected ? '#fff' : 'transparent',
                    color: selected ? '#1a1a1a' : '#8c8c8c',
                    boxShadow: selected ? '0 1px 2px rgba(0,0,0,0.08)' : undefined,
                  }),
            }}
          >
            {SHIFT_SELECTION_LABEL[option]}
          </button>
        )
      })}
    </div>
  )
}
