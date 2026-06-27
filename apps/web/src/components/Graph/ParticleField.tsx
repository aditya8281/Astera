import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useUIStore } from '../../store'
import { PARTICLE_COUNTS, COLORS } from '../../constants'

const MAX_PARTICLES = 3000

export function ParticleField() {
  const settings = useUIStore((s) => s.settings)
  const count = PARTICLE_COUNTS[settings.particleDensity]

  const meshRef = useRef<THREE.InstancedMesh>(null!)

  const { positions, velocities, count: activeCount } = useMemo(() => {
    const n = Math.min(count, MAX_PARTICLES)
    const pos = new Float32Array(n * 3)
    const vel = new Float32Array(n * 3)

    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60
      pos[i * 3 + 1] = (Math.random() - 0.5) * 60
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60

      vel[i * 3] = (Math.random() - 0.5) * 0.01
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.01
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.01
    }

    return { positions: pos, velocities: vel, count: n }
  }, [count])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(COLORS.selection), [])

  useFrame(() => {
    if (!meshRef.current || activeCount === 0) return

    const mesh = meshRef.current
    const speed = settings.reducedMotion ? 0 : 1

    for (let i = 0; i < activeCount; i++) {
      // Update position
      positions[i * 3] += velocities[i * 3] * speed
      positions[i * 3 + 1] += velocities[i * 3 + 1] * speed
      positions[i * 3 + 2] += velocities[i * 3 + 2] * speed

      // Wrap around
      for (let j = 0; j < 3; j++) {
        if (positions[i * 3 + j] > 30) positions[i * 3 + j] = -30
        if (positions[i * 3 + j] < -30) positions[i * 3 + j] = 30
      }

      dummy.position.set(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      )

      // Gentle sine drift
      const t = Date.now() * 0.001 + i * 0.1
      const s = 0.02 + 0.01 * Math.sin(t * 0.5)
      dummy.scale.setScalar(s)

      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      // Subtle color variation
      color.set(COLORS.selection)
      color.multiplyScalar(0.15 + 0.05 * Math.sin(t))
      mesh.setColorAt(i, color)
    }

    mesh.count = activeCount
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  if (activeCount === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, activeCount]} frustumCulled={false}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  )
}
