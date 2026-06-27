import { useState, useCallback } from 'react'
import { COLORS } from '../../constants'
import { SparklesIcon } from '../Common/Icons'

// ─── AI Layer — reservation for future LLM-powered features ───
//
// This module provides a structured interface for future AI capabilities:
// - Natural language code queries ("what does this function do?")
// - Automated code review suggestions
// - Impact explanation in plain English
// - Code generation hints based on patterns
//
// Current state: mock/stub — no actual LLM calls.
// The architecture is ready for integration when a provider is configured.

export interface AIProvider {
  name: string
  model: string
  endpoint: string
}

export interface AIQuery {
  id: string
  input: string
  context?: {
    nodeId?: number
    fileId?: number
    selectedNodes?: number[]
  }
}

export interface AIResponse {
  id: string
  query: string
  answer: string
  confidence: number
  sources?: Array<{
    type: 'symbol' | 'file' | 'metric'
    id: number
    label: string
  }>
  timestamp: number
}

// ─── AI Service (stub) ───

class AIService {
  private provider: AIProvider | null = null
  private history: AIResponse[] = []

  configure(provider: AIProvider) {
    this.provider = provider
  }

  isConfigured(): boolean {
    return this.provider !== null
  }

  async query(q: AIQuery): Promise<AIResponse> {
    // Stub: return a mock response
    // When integrated, this would call the configured LLM provider
    const response: AIResponse = {
      id: `ai-${Date.now()}`,
      query: q.input,
      answer: this.generateMockAnswer(q.input, q.context),
      confidence: 0.85,
      sources: [],
      timestamp: Date.now(),
    }

    this.history.push(response)
    return response
  }

  private generateMockAnswer(input: string, _context?: AIQuery['context']): string {
    const lower = input.toLowerCase()

    if (lower.includes('what does') || lower.includes('what is')) {
      return `Based on static analysis, this component appears to handle data processing. The analysis identified related functions and their call patterns. Full LLM-powered analysis requires configuring an AI provider in settings.`
    }

    if (lower.includes('impact') || lower.includes('change')) {
      return `Impact analysis shows this symbol is referenced by multiple downstream components. A detailed natural-language impact report would be available with an AI provider configured.`
    }

    if (lower.includes('review') || lower.includes('suggest')) {
      return `Code review suggestions require an AI provider. Once configured, Astera can provide context-aware suggestions based on the code graph and project patterns.`
    }

    return `AI-powered analysis is available when an AI provider is configured. Current query: "${input}". The system is ready for integration with OpenAI, Anthropic, or local models.`
  }

  getHistory(): AIResponse[] {
    return [...this.history]
  }

  clearHistory() {
    this.history = []
  }
}

export const aiService = new AIService()

// ─── AI Chat Panel Component ───

export function AIChatPanel() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; content: string; timestamp: number }>>([])
  const [loading, setLoading] = useState(false)
  const [configured] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || loading) return

    const userMsg = { role: 'user' as const, content: input, timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const response = await aiService.query({ id: `q-${Date.now()}`, input })
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: response.answer, timestamp: response.timestamp },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: 'Error: Could not process query. Check AI provider configuration.',
          timestamp: Date.now(),
        },
      ])
    }

    setLoading(false)
  }, [input, loading])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <SparklesIcon size={16} color={COLORS.ai} />
        <h3 style={{ margin: 0, color: COLORS.text, fontSize: '14px', fontWeight: 600 }}>
          AI Analysis
        </h3>
        <span
          style={{
            marginLeft: 'auto',
            background: configured ? `${COLORS.success}15` : `${COLORS.warning}15`,
            color: configured ? COLORS.success : COLORS.warning,
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {configured ? 'Connected' : 'Not Configured'}
        </span>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: COLORS.muted,
              fontSize: '12px',
              textAlign: 'center',
              gap: '8px',
            }}
          >
            <span style={{ opacity: 0.3 }}><SparklesIcon size={24} color={COLORS.textMuted} /></span>
            <p style={{ margin: 0 }}>Ask questions about your codebase</p>
            <p style={{ margin: 0, fontSize: '11px', opacity: 0.6 }}>
              "What does this function do?" · "What would break if I change this?"
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background:
                msg.role === 'user' ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.04)',
              border:
                msg.role === 'user'
                  ? '1px solid rgba(0,255,136,0.15)'
                  : '1px solid rgba(255,255,255,0.06)',
              fontSize: '12px',
              lineHeight: 1.5,
              color: COLORS.text,
            }}
          >
            {msg.content}
          </div>
        ))}

        {loading && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: '12px',
              color: COLORS.muted,
            }}
          >
            Analyzing...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={configured ? 'Ask about your code...' : 'Configure AI provider first...'}
          disabled={!configured}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            padding: '8px 12px',
            color: COLORS.text,
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!configured || loading || !input.trim()}
          style={{
            background: configured ? COLORS.surfaceHover : `${COLORS.surfaceDim}`,
            border: `1px solid ${COLORS.border}`,
            borderRadius: '6px',
            color: configured ? COLORS.text : COLORS.textDim,
            padding: '8px 16px',
            fontSize: '12px',
            cursor: configured && !loading ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Send
        </button>
      </div>

      {/* Configuration hint */}
      {!configured && (
        <p
          style={{
            margin: '8px 0 0',
            color: COLORS.muted,
            fontSize: '10px',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          Add your AI provider key in Settings to enable full analysis.
          <br />
          Supports: OpenAI, Anthropic, local Ollama
        </p>
      )}
    </div>
  )
}
