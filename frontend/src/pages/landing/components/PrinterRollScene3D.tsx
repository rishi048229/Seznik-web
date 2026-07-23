import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Small decorative "paper roll" — a stand-in 3D motif for the printer showcase until
// the real Blender models for Dev/Veer are dropped in (see PrintersShowcase.tsx).
const Roll = () => {
  const group = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!group.current) return
    group.current.rotation.y += delta * 0.35
    group.current.rotation.x = Math.sin(Date.now() * 0.0003) * 0.15
  })

  return (
    <group ref={group}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 0.55, 48, 1, true]} />
        <meshStandardMaterial color="#f8fafc" side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.05, 16, 48]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.6, 32, 1, true]} />
        <meshStandardMaterial color="#0a0a2e" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

export const PrinterRollScene3D = ({ className }: { className?: string }) => (
  <div className={className} aria-hidden="true">
    <Canvas camera={{ position: [2.4, 1.6, 2.4], fov: 40 }} dpr={[1, 1.5]}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 4, 2]} intensity={1.1} />
      <Roll />
    </Canvas>
  </div>
)
