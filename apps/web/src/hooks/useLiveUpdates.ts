import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface IndexEvent {
  event: string
  files_changed: number
  nodes_added: number
  nodes_removed: number
  edges_added: number
  elapsed_ms: number
  message: string
}

/**
 * Connects to the backend WebSocket at /api/events.
 * On receiving an "index_updated" event, invalidates all cached queries
 * so the UI reflects the latest indexed data.
 *
 * Handles reconnection with exponential backoff on disconnect.
 */
export function useLiveUpdates() {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const retryCount = useRef(0)

  useEffect(() => {
    let unmounted = false

    function connect() {
      if (unmounted) return

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const url = `${protocol}//${host}/api/events`

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        retryCount.current = 0
      }

      ws.onmessage = (ev) => {
        try {
          const data: IndexEvent = JSON.parse(ev.data)
          if (data.event === 'index_updated') {
            // Invalidate all cached queries so pages refetch fresh data
            queryClient.invalidateQueries()
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        if (!unmounted) {
          // Exponential backoff: 1s, 2s, 4s, 8s, max 15s
          const delay = Math.min(1000 * 2 ** retryCount.current, 15000)
          retryCount.current++
          setTimeout(connect, delay)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      unmounted = true
      wsRef.current?.close()
    }
  }, [queryClient])
}
