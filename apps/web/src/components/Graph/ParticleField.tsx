import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useUIStore } from '../../store'
import { PARTICLE_COUNTS } from '../../constants'

/**
 * Subtle ash/ember particles drifting extremely slowly in the background.
 * 4-6% opacity, tiny dots, peaceful movement — like dust in deep space.
 */
export function ParticleField() {
  const settings = useUIStore((s) => s.settings)
  const count = PARTICLE_COUNTS[settings.particleDensity] ?? 400

  const meshRef = useRef<THREE.InstancedMesh>(null!)

  const { positions: posArray, velocities, count: activeCount } = useMemo(() => {
    const n = count
    const pos = new Float32Array(n * 3)
    const vel = new Float32Array(n * 3)
    const spread = 60

    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.6
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread

      // Extremely slow drift
      vel[i * 3] = (Math.random() - 0.5) * 0.003
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.001 + 0.001 // slight upward
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.003
    }

    return { positions: pos, velocities: vel, count: n }
  }, [count])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color('#8B91A0'), []) // muted ash gray

  useFrame(() => {
    if (!meshRef.current || activeCount === 0) return

    const mesh = meshRef.current
    const speed = settings.reducedMotion ? 0 : 1

    for (let i = 0; i < activeCount; i++) {
      // Drift
      posArray[i * 3] += velocities[i * 3] * speed
      posArray[i * 3 + 1] += velocities[i * 3 + 1] * speed
      posArray[i * 3 + 2] += velocities[i * 3 + 2] * speed

      // Wrap around bounds
      if (posArray[i * 3] > 30) posArray[i * 3] = -30
      if (posArray[i * 3] < -30) posArray[i * 3] = 30
      if (posArray[i * 3 + 1] > 20) posArray[i * 3 + 1] = -20
      if (posArray[i * 3 + 1] < -20) posArray[i * 3 + 1] = 20
      if (posArray[i * 3 + 2] > 30) posArray[i * 3 + 2] = -30
      if (posArray[i * 3 + 2] < -30) posArray[i * 3 + 2] = 30

      dummy.position.set(
        posArray[i * 3],
        posArray[i * 3 + 1],
        posArray[i * 3 + 2]
      )

      // Tiny size variation
      const t = Date.now() * 0.001 + i * 0.1
      const s = 0.015 + 0.01 * Math.sin(t * 0.3)
      dummy.scale.setScalar(s)

      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      // Very subtle brightness variation
      const brightness = 0.04 + 0.02 * Math.sin(t * 0.2)
      color.setRGB(brightness, brightness * 1.05, brightness * 1.1)
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
      <meshBasicMaterial transparent opacity={1} depthWrite={false} />
    </instancedMesh>
  )
}
