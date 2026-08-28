// Shift picker used by the Edit Roster drawer.
//
// Replaces AntD's Segmented so the selected option can carry real contrast.
// Review feedback 7: with the stock control the selected and unselected states
// read almost the same, especially next to the bright blue Standby checkbox.
// The old look is kept as the "subtle" variant so it can still be compared.
//
// 28 Aug review asked for more styles to choose between. Five now, and they
// differ along three separate axes rather than being five shades of the same
// idea: what the selection is coloured with (`strong` vs `swatch`), how heavy
// the frame around it is (`strong` / `subtle` / `pill`), and whether it is a set
// of buttons at all (`dropdown`).

import { Select } from 'antd'
import type { ShiftSelection } from './rosterData'
import { DAY_GROUP_STYLE, SHIFT_SELECTION_LABEL } from './rosterStatusLogic'
// One definition of the union, held with the rest of the variant types. Two
// copies had already drifted apart once.
import type { ShiftContrast } from './RosterVariantSwitcher'

export type { ShiftContrast }

/** The calendar's own swatch for a shift, so a picker set to `swatch` names a
 *  shift with the colour the month grid already uses for it. */
const SWATCH: Record<ShiftSelection, { bg: string; fg: string }> = {
  AM: { bg: DAY_GROUP_STYLE.AM.bg, fg: DAY_GROUP_STYLE.AM.fg },
  PM: { bg: DAY_GROUP_STYLE.PM.bg, fg: DAY_GROUP_STYLE.PM.fg },
  NA: { bg: DAY_GROUP_STYLE.NOT_ASSIGNED.bg, fg: DAY_GROUP_STYLE.NOT_ASSIGNED.fg },
}

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
  // A Select trades a one-click pick for a two-click one, which is the wrong
  // trade when a user is setting eleven rows in a row. It earns its place only
  // on width: it is roughly a third of the button row, and it is the one option
  // here that would still fit if the shift list ever grew past three.
  if (contrast === 'dropdown') {
    return (
      <Select
        size="small"
        value={value}
        disabled={disabled}
        onChange={onChange}
        options={options.map((o) => ({ value: o, label: SHIFT_SELECTION_LABEL[o] }))}
        style={{ width: 92 }}
      />
    )
  }

  const pill = contrast === 'pill'

  return (
    <div
      style={{
        display: 'inline-flex',
        gap: contrast === 'strong' || contrast === 'swatch' ? 4 : 0,
        padding: contrast === 'subtle' ? 2 : 0,
        borderRadius: pill ? 999 : 6,
        background: contrast === 'subtle' ? '#f5f5f5' : 'transparent',
        // The pill draws one frame around the whole group and lets the options
        // share it, rather than giving each option a box of its own.
        border: pill ? '1px solid #bfbfbf' : undefined,
        overflow: pill ? 'hidden' : undefined,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {options.map((option, i) => {
        const selected = option === value
        const swatch = SWATCH[option]
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(option)}
            style={{
              minWidth: 44,
              padding: pill ? '2px 12px' : '2px 10px',
              fontSize: 12,
              lineHeight: '20px',
              // Labels never wrap: a wrapped one used to make the whole drawer
              // row twice as tall.
              whiteSpace: 'nowrap',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
              ...(contrast === 'strong'
                ? {
                    // Solid fill on the selected option, so it stands up next to
                    // the Standby checkbox instead of disappearing behind it.
                    borderRadius: 6,
                    fontWeight: selected ? 600 : 500,
                    // Feedback 5 — the unselected tiles were washing out.
                    border: `1px solid ${selected ? '#1677ff' : '#bfbfbf'}`,
                    background: selected ? '#1677ff' : '#fff',
                    color: selected ? '#fff' : '#434343',
                  }
                : contrast === 'swatch'
                  ? {
                      // The selected shift wears the colour the calendar gives
                      // it, so the drawer and the month grid agree on what AM
                      // looks like. Blue stays for Standby alone, which is the
                      // decision the eye should find first.
                      borderRadius: 6,
                      fontWeight: selected ? 600 : 500,
                      border: `1px solid ${selected ? swatch.bg : '#bfbfbf'}`,
                      background: selected ? swatch.bg : '#fff',
                      color: selected ? swatch.fg : '#434343',
                    }
                  : pill
                    ? {
                        // No radius of its own — the group's frame supplies it,
                        // and a hairline separates the options inside.
                        borderRadius: 0,
                        fontWeight: selected ? 600 : 500,
                        border: 'none',
                        borderLeft: i === 0 ? undefined : '1px solid #d9d9d9',
                        background: selected ? '#1677ff' : 'transparent',
                        color: selected ? '#fff' : '#595959',
                      }
                    : {
                        // The original AntD Segmented look.
                        borderRadius: 4,
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
