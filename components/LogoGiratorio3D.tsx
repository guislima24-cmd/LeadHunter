'use client'
import { useEffect, useRef, useState } from 'react'
import type * as ThreeNS from 'three'
import { cn } from '@/lib/cn'
import { MarcaDagua } from '@/components/Logo'

const AMARELO = 0xffd100 // mesmo tom de --color-amarelo-400
const VERDE = 0x00634a // mesmo tom de --color-verde-600

/**
 * A marca em 3D, girando — reconstrução procedural do mesmo símbolo de
 * `public/logo-ufabcjr.svg`, extrudado em vez de recortado em SVG.
 *
 * Geometria construída com os mesmos parâmetros de `gen-logo.py`
 * (s=0.46, θ=-20°, corte=0.68, raio=0.16), não a partir de um arquivo de
 * modelo: só o `.mtl` (as duas cores) chegou anexado, sem a malha. Refazer
 * a forma aqui evita depender de um `.obj`/`.glb` que não veio.
 *
 * `three` é importado dinamicamente dentro do efeito — só quem visita o
 * login paga esse pacote, e só depois da hidratação.
 */
export function LogoGiratorio3D({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const reduzMovimento = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    let cancelado = false
    let descartar: (() => void) | null = null

    ;(async () => {
      try {
        const THREE = await import('three')
        if (cancelado || !container) return

        const TAU = Math.PI * 2
        const s = 0.46
        const theta = (-20 * Math.PI) / 180
        const corte = 0.68
        const raio = 0.16

        const vertice = (i: number) => {
          const ang = -Math.PI / 2 + i * (TAU / 3)
          return new THREE.Vector2(Math.cos(ang), Math.sin(ang))
        }
        const A = [vertice(0), vertice(1), vertice(2)]
        const rot = (p: ThreeNS.Vector2, ang: number) =>
          new THREE.Vector2(
            p.x * Math.cos(ang) - p.y * Math.sin(ang),
            p.x * Math.sin(ang) + p.y * Math.cos(ang),
          )
        const B = A.map((p) => rot(p, theta).multiplyScalar(s))
        const C = A.map((p, i) => p.clone().lerp(A[(i + 1) % 3], corte))

        const d = raio * Math.sqrt(3)
        const direcao = (i: number, j: number) => A[j].clone().sub(A[i]).normalize()
        const tangente = (i: number, j: number) =>
          A[i].clone().addScaledVector(direcao(i, j), d)
        const centroCanto = (i: number) => A[i].clone().multiplyScalar(1 - 2 * raio)

        const Tout = [0, 1, 2].map((i) => tangente(i, (i + 1) % 3))
        const Tin = [0, 1, 2].map((i) => tangente(i, (i + 2) % 3))

        function arcoMenor(
          forma: ThreeNS.Shape,
          i: number,
          de: ThreeNS.Vector2,
          para: ThreeNS.Vector2,
        ) {
          const c = centroCanto(i)
          const a0 = Math.atan2(de.y - c.y, de.x - c.x)
          const a1 = Math.atan2(para.y - c.y, para.x - c.x)
          let delta = a1 - a0
          while (delta > Math.PI) delta -= TAU
          while (delta < -Math.PI) delta += TAU
          forma.absarc(c.x, c.y, raio, a0, a0 + delta, delta < 0)
        }

        // Contorno arredondado (o mesmo triângulo "cortado nas pontas" do
        // clipPath do SVG), com a forma interna B como furo — vira o anel
        // amarelo, com o centro literalmente vazado.
        const contorno = new THREE.Shape()
        contorno.moveTo(Tout[0].x, Tout[0].y)
        for (let k = 0; k < 3; k++) {
          const vNext = (k + 1) % 3
          contorno.lineTo(Tin[vNext].x, Tin[vNext].y)
          arcoMenor(contorno, vNext, Tin[vNext], Tout[vNext])
        }
        contorno.closePath()

        const furo = new THREE.Path()
        furo.moveTo(B[0].x, B[0].y)
        furo.lineTo(B[2].x, B[2].y)
        furo.lineTo(B[1].x, B[1].y)
        furo.closePath()
        contorno.holes.push(furo)

        const cunhas = [0, 1, 2].map((i) => {
          const p = new THREE.Shape()
          const v = (i + 1) % 3
          p.moveTo(C[i].x, C[i].y)
          p.lineTo(A[v].x, A[v].y)
          p.lineTo(B[v].x, B[v].y)
          p.closePath()
          return p
        })

        const profundidadeAnel = 0.14
        const profundidadeCunha = 0.1

        const geoAnel = new THREE.ExtrudeGeometry(contorno, {
          depth: profundidadeAnel,
          bevelEnabled: true,
          bevelThickness: 0.02,
          bevelSize: 0.02,
          bevelSegments: 2,
          curveSegments: 24,
        })
        geoAnel.translate(0, 0, -profundidadeAnel / 2)

        const geosCunha = cunhas.map((forma) => {
          const geo = new THREE.ExtrudeGeometry(forma, {
            depth: profundidadeCunha,
            bevelEnabled: true,
            bevelThickness: 0.015,
            bevelSize: 0.015,
            bevelSegments: 2,
            curveSegments: 8,
          })
          // Encosta a base da cunha na face da frente do anel — fica em
          // relevo por cima dele, não coplanar (evita z-fighting de quebra).
          geo.translate(0, 0, profundidadeAnel / 2)
          return geo
        })

        const matAnel = new THREE.MeshStandardMaterial({
          color: AMARELO,
          metalness: 0.25,
          roughness: 0.42,
        })
        const matCunha = new THREE.MeshStandardMaterial({
          color: VERDE,
          metalness: 0.3,
          roughness: 0.38,
        })

        const grupo = new THREE.Group()
        grupo.add(new THREE.Mesh(geoAnel, matAnel))
        for (const geo of geosCunha) grupo.add(new THREE.Mesh(geo, matCunha))
        // Sem essa inclinação o giro em torno de Y faz o disco "sumir" de
        // perfil duas vezes por volta — a peça é fina.
        grupo.rotation.x = THREE.MathUtils.degToRad(16)

        const scene = new THREE.Scene()
        scene.add(grupo)
        scene.add(new THREE.AmbientLight(0xffffff, 0.55))
        const luzPrincipal = new THREE.DirectionalLight(0xffffff, 1.15)
        luzPrincipal.position.set(2, 3, 4)
        scene.add(luzPrincipal)
        const luzPreenchimento = new THREE.DirectionalLight(0x8fb6ff, 0.35)
        luzPreenchimento.position.set(-3, -1, 2)
        scene.add(luzPreenchimento)

        const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20)
        camera.position.set(0, 0, 6.2)
        camera.lookAt(0, 0, 0)

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        container.appendChild(renderer.domElement)

        const definirTamanho = (largura: number, altura: number) => {
          if (largura === 0 || altura === 0) return
          camera.aspect = largura / altura
          camera.updateProjectionMatrix()
          renderer.setSize(largura, altura, false)
        }
        definirTamanho(container.clientWidth, container.clientHeight)

        const ro = new ResizeObserver(([entrada]) => {
          const { width, height } = entrada.contentRect
          definirTamanho(width, height)
          // Sem giro contínuo redesenhando a cada quadro, um resize (ou o
          // primeiro layout, que chega depois deste construtor) só aparece
          // se a gente mesmo redesenhar aqui.
          if (reduzMovimento) renderer.render(scene, camera)
        })
        ro.observe(container)

        let rafId: number | null = null
        const tick = () => {
          grupo.rotation.y += 0.0022
          renderer.render(scene, camera)
          rafId = requestAnimationFrame(tick)
        }
        if (reduzMovimento) {
          renderer.render(scene, camera)
        } else {
          tick()
        }

        const aoMudarVisibilidade = () => {
          if (document.hidden) {
            if (rafId !== null) {
              cancelAnimationFrame(rafId)
              rafId = null
            }
          } else if (!reduzMovimento && rafId === null) {
            tick()
          }
        }
        document.addEventListener('visibilitychange', aoMudarVisibilidade)

        descartar = () => {
          document.removeEventListener('visibilitychange', aoMudarVisibilidade)
          ro.disconnect()
          if (rafId !== null) cancelAnimationFrame(rafId)
          geoAnel.dispose()
          for (const geo of geosCunha) geo.dispose()
          matAnel.dispose()
          matCunha.dispose()
          renderer.dispose()
          container.removeChild(renderer.domElement)
        }
      } catch {
        // WebGL indisponível (ou qualquer outra falha ao montar a cena):
        // cai para o símbolo estático em vez de deixar o canto vazio.
        setFalhou(true)
      }
    })()

    return () => {
      cancelado = true
      descartar?.()
    }
  }, [])

  if (falhou) return <MarcaDagua className={className} />

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute aspect-square select-none', className)}
    />
  )
}
