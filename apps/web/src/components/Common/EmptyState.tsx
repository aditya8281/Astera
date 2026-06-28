import type { ReactNode } from 'react'
import { COLORS } from '../../constants'
import { GraphIcon, SearchIcon, FilesIcon, AlertIcon } from './Icons'

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  icon?: ReactNode
  iconKey?: 'graph' | 'search' | 'files' | 'alert'
  title: string
  description: string
  action?: EmptyStateAction
}

const ICON_MAP = {
  graph: <GraphIcon size={32} color={COLORS.textDim} />,
  search: <SearchIcon size={32} color={COLORS.textDim} />,
  files: <FilesIcon size={32} color={COLORS.textDim} />,
  alert: <AlertIcon size={32} color={COLORS.textDim} />,
}

export function EmptyState({ icon, iconKey, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '48px 24px',
        textAlign: 'center',
        userSelect: 'none',
      }}
    >
      <div style={{ opacity: 0.5 }}>
        {icon ?? (iconKey ? ICON_MAP[iconKey] : <GraphIcon size={32} color={COLORS.textDim} />)}
      </div>

      <h3
        style={{
          margin: 0,
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: '1rem',
          color: COLORS.textMuted,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: '0.8125rem',
          color: COLORS.textMuted,
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 4,
            padding: '6px 16px',
            border: `1px solid ${COLORS.borderLight}`,
            borderRadius: 4,
            background: COLORS.surface,
            color: COLORS.text,
            fontFamily: 'var(--font-body)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 120ms ease, border-color 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = COLORS.surfaceHover
            e.currentTarget.style.borderColor = COLORS.selection
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = COLORS.surface
            e.currentTarget.style.borderColor = COLORS.borderLight
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export default EmptyState
