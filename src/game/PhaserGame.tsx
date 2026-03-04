import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import Phaser from 'phaser'
import { OfficeScene } from './OfficeScene'
import type { OfficeConfig } from '../config/types'
import { GameSkeleton } from '../components/Skeleton'

export interface PhaserGameHandle {
  changeState: (state: string) => void
  updateTitle: (title: string) => void
}

interface PhaserGameProps {
  config: OfficeConfig
  onSceneReady?: () => void
}

export const PhaserGame = forwardRef<PhaserGameHandle, PhaserGameProps>(
  ({ config, onSceneReady }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const gameRef = useRef<Phaser.Game | null>(null)
    const [skeletonVisible, setSkeletonVisible] = useState(true)

    useImperativeHandle(ref, () => ({
      changeState(state: string) {
        const scene = gameRef.current?.scene.getScene('OfficeScene') as OfficeScene | undefined
        scene?.applyState(state)
      },
      updateTitle(title: string) {
        const scene = gameRef.current?.scene.getScene('OfficeScene') as OfficeScene | undefined
        scene?.updatePlaqueText(title)
      },
    }))

    useEffect(() => {
      if (!containerRef.current) return
      let cancelled = false

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: config.office.width,
        height: config.office.height,
        parent: containerRef.current,
        pixelArt: true,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: config.office.width,
          height: config.office.height,
        },
        // No scene auto-start — we add it manually after 'ready' to pass config
        scene: [],
      })

      gameRef.current = game

      game.events.on('ready', () => {
        if (cancelled) return
        game.scene.add('OfficeScene', OfficeScene, false)
        const scene = game.scene.getScene('OfficeScene') as OfficeScene
        scene.events.on('scene-ready', () => {
          if (cancelled) return
          setSkeletonVisible(false)
          onSceneReady?.()
        })
        game.scene.start('OfficeScene', { config })
      })

      return () => {
        cancelled = true
        game.destroy(true)
        gameRef.current = null
      }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div className="game-container" ref={containerRef}>
        <GameSkeleton visible={skeletonVisible} />
      </div>
    )
  }
)

PhaserGame.displayName = 'PhaserGame'
