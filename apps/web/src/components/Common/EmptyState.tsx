import React from 'react'
import { COLORS } from '../../constants'

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  action?: EmptyStateAction
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
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
      <span
        style={{
          fontSize: 32,
          lineHeight: 1,
          opacity: 0.4,
        }}
        role="img"
        aria-hidden="true"
      >
        {icon}
      </span>

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
          color: COLORS.textDim,
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
            borderRadius: 6,
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
