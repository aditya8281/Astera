import { useRef, useEffect, useState, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Temporal animation state ───

export interface TemporalEvent {
  id: string
  type: 'nodeAdded' | 'nodeRemoved' | 'nodeModified' | 'edgeAdded' | 'edgeRemoved'
  timestamp: number
  nodeIds: number[]
  edgeIndices?: [number, number][]
}

interface AnimationState {
  fadeIn: Set<number>      // nodes fading in (new)
  fadeOut: Set<number>     // nodes fading out (removed)
  pulse: Set<number>       // nodes pulsing (modified)
  startTime: number
}

const ANIMATION_DURATION = 2000 // 2 seconds for full animation
const FADE_IN_DURATION = 800
const FADE_OUT_DURATION = 600
const PULSE_DURATION = 1200

// ─── Hook: manages temporal animation state ───

export function useTemporalAnimation(nodeIds: number[]) {
  const [animation, setAnimation] = useState<AnimationState>({
    fadeIn: new Set(),
    fadeOut: new Set(),
    pulse: new Set(),
    startTime: 0,
  })

  const previousIds = useRef(new Set<number>())

  // Detect changes when nodeIds update
  useEffect(() => {
    const currentIds = new Set(nodeIds)
    const prevIds = previousIds.current

    const added = nodeIds.filter((id) => !prevIds.has(id))
    const removed = [...prevIds].filter((id) => !currentIds.has(id))

    if (added.length > 0 || removed.length > 0) {
      setAnimation({
        fadeIn: new Set(added),
        fadeOut: new Set(removed),
        pulse: new Set(), // could detect modifications via hash comparison
        startTime: Date.now(),
      })
    }

    previousIds.current = currentIds
  }, [nodeIds])

  // Get opacity for a node based on animation state
  const getNodeOpacity = useCallback(
    (nodeId: number): number => {
      const elapsed = Date.now() - animation.startTime

      if (animation.fadeIn.has(nodeId)) {
        const progress = Math.min(elapsed / FADE_IN_DURATION, 1)
        return easeOutCubic(progress)
      }

      if (animation.fadeOut.has(nodeId)) {
        const progress = Math.min(elapsed / FADE_OUT_DURATION, 1)
        return 1 - easeInCubic(progress)
      }

      return 1
    },
    [animation]
  )

  // Get scale for a node based on animation state
  const getNodeScale = useCallback(
    (nodeId: number): number => {
      const elapsed = Date.now() - animation.startTime

      if (animation.fadeIn.has(nodeId)) {
        const progress = Math.min(elapsed / FADE_IN_DURATION, 1)
        return 0.3 + 0.7 * easeOutBack(progress)
      }

      if (animation.pulse.has(nodeId)) {
        const progress = (elapsed % PULSE_DURATION) / PULSE_DURATION
        return 1 + 0.15 * Math.sin(progress * Math.PI * 2)
      }

      return 1
    },
    [animation]
  )

  // Check if animation is still active
  const isAnimating = Date.now() - animation.startTime < ANIMATION_DURATION

  return { getNodeOpacity, getNodeScale, isAnimating, animation }
}

// ─── Easing functions ───

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function easeInCubic(t: number): number {
  return t * t * t
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

// ─── Component: renders animated glow ring for newly added nodes ───

export function TemporalGlow({
  position,
  isAnimating,
  color = '#00ff88',
}: {
  nodeId: number
  position: [number, number, number]
  isAnimating: boolean
  color?: string
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)
  const startTime = useRef(Date.now())

  useFrame(() => {
    if (!meshRef.current || !materialRef.current) return

    const elapsed = (Date.now() - startTime.current) / 1000
    const duration = 2.0

    if (elapsed > duration) {
      meshRef.current.visible = false
      return
    }

    const progress = elapsed / duration
    const scale = 1 + progress * 2
    const opacity = (1 - progress) * 0.4

    meshRef.current.scale.setScalar(scale)
    materialRef.current.opacity = opacity
  })

  if (!isAnimating) return null

  return (
    <mesh ref={meshRef} position={position}>
      <ringGeometry args={[0.3, 0.5, 32]} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

// ─── Component: re-index progress overlay ───

export function ReindexOverlay() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/api/events`)

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data)
        if (data.event === 'reindex_complete') {
          setVisible(true)
          setTimeout(() => setVisible(false), 3000)
        }
      } catch { /* ignore */ }
    }

    return () => ws.close()
  }, [])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 255, 136, 0.15)',
        border: '1px solid rgba(0, 255, 136, 0.3)',
        borderRadius: '8px',
        padding: '8px 16px',
        color: '#00ff88',
        fontSize: '13px',
        fontFamily: 'var(--font-mono)',
        zIndex: 1000,
        animation: 'fadeInUp 0.3s ease-out',
      }}
    >
      Graph updated — nodes refreshed
    </div>
  )
}
