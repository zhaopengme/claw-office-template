import { useState, useEffect, useCallback } from 'react'
import type { LocaleStrings } from '../config/types'

export function GameSkeleton({ visible }: { visible: boolean }) {
  return (
    <div className={`game-skeleton ${visible ? '' : 'hidden'}`}>
      <div className="hint">正在进入像素办公室…</div>
    </div>
  )
}

export function LoadingOverlay({ locale }: { locale?: LocaleStrings }) {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(true)
  const [mounted, setMounted] = useState(true)

  const hide = useCallback(() => {
    setVisible(false)
  }, [])

  // Fallback: hide after 8s even if Phaser hasn't finished loading
  useEffect(() => {
    const timer = setTimeout(hide, 8000)
    return () => clearTimeout(timer)
  }, [hide])

  // Expose progress updater on window for Phaser to call
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__updateLoadingProgress = (loaded: number, total: number) => {
      setProgress(Math.round((loaded / total) * 100))
    };
    (window as unknown as Record<string, unknown>).__hideLoadingOverlay = hide
    return () => {
      delete (window as unknown as Record<string, unknown>).__updateLoadingProgress
      delete (window as unknown as Record<string, unknown>).__hideLoadingOverlay
    }
  }, [hide])

  // Unmount from DOM after fade-out transition ends
  useEffect(() => {
    if (visible) return
    const timer = setTimeout(() => setMounted(false), 400)
    return () => clearTimeout(timer)
  }, [visible])

  if (!mounted) return null

  return (
    <div className={`loading-overlay ${visible ? '' : 'hidden'}`}>
      <div className="loading-text">{locale?.loading ?? '加载像素资产中…'}</div>
      <div className="loading-progress-container">
        <div className="loading-progress-bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
