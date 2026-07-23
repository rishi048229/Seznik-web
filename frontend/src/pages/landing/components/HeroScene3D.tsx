import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useScroll } from 'framer-motion'

// Drifting particle field — instanced points forming a soft cloud behind the hero copy.
const ParticleField = () => {
  const pointsRef = useRef<THREE.Points>(null)
  const count = 320

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 22
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10 - 4
    }
    return arr
  }, [])

  useFrame((state) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02
    pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.05
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#7dd3fc" size={0.045} sizeAttenuation transparent opacity={0.75} />
    </points>
  )
}

// Slow-spinning brand-colored wireframe forms — evoke receipt rolls & print heads without needing real 3D assets yet.
const FloatingShapes = ({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) => {
  const group = useRef<THREE.Group>(null)
  const shapeA = useRef<THREE.Mesh>(null)
  const shapeB = useRef<THREE.Mesh>(null)
  const shapeC = useRef<THREE.Mesh>(null)

  useFrame((state, delta) => {
    const s = scrollRef.current
    if (group.current) {
      group.current.rotation.y = s * Math.PI * 0.6
      group.current.position.y = s * 1.2
    }
    if (shapeA.current) {
      shapeA.current.rotation.x += delta * 0.15
      shapeA.current.rotation.y += delta * 0.1
    }
    if (shapeB.current) {
      shapeB.current.rotation.x -= delta * 0.12
      shapeB.current.rotation.z += delta * 0.08
    }
    if (shapeC.current) {
      shapeC.current.rotation.y += delta * 0.2
      shapeC.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.4 - 1.5
    }
  })

  return (
    <group ref={group}>
      <mesh ref={shapeA} position={[-5.2, 1.8, -3]}>
        <icosahedronGeometry args={[1.15, 0]} />
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.5} />
      </mesh>
      <mesh ref={shapeB} position={[5.4, -1.4, -2]}>
        <torusGeometry args={[0.9, 0.28, 8, 32]} />
        <meshBasicMaterial color="#60a5fa" wireframe transparent opacity={0.45} />
      </mesh>
      <mesh ref={shapeC} position={[0.5, -1.5, -5]}>
        <octahedronGeometry args={[0.7, 0]} />
        <meshBasicMaterial color="#93c5fd" wireframe transparent opacity={0.35} />
      </mesh>
    </group>
  )
}

const SceneContent = ({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) => (
  <>
    <ParticleField />
    <FloatingShapes scrollRef={scrollRef} />
  </>
)

interface HeroScene3DProps {
  className?: string
}

export const HeroScene3D = ({ className }: HeroScene3DProps) => {
  const scrollRef = useRef(0)
  const { scrollYProgress } = useScroll()

  scrollYProgress.on('change', (v) => {
    scrollRef.current = v
  })

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
      >
        <SceneContent scrollRef={scrollRef} />
      </Canvas>
    </div>
  )
}
