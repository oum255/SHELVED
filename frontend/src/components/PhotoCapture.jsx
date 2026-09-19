import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialogA11y } from '../hooks/useDialogA11y'
import './PhotoCapture.css'

// Format du cadre selon le type : couverture = ~2:3, avatar = carré (affiché en rond via CSS).
const ASPECT = { cover: 175 / 260, avatar: 1 }

// Montre la caméra avec un cadre, capture une photo recadrée au bon format et la renvoie via onCapture(file).
function PhotoCapture({ type, onCapture, onClose }) {
  const { t } = useTranslation()
  const videoRef = useRef(null)
  const [error, setError] = useState(false)
  const aspect = ASPECT[type] || 0.66
  const boxRef = useDialogA11y(onClose)

  useEffect(() => {
    let stream
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => setError(true))
    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const vw = video.videoWidth
    const vh = video.videoHeight
    let cw, ch
    if (vw / vh > aspect) {
      ch = vh
      cw = vh * aspect
    } else {
      cw = vw
      ch = vw / aspect
    }
    const sx = (vw - cw) / 2
    const sy = (vh - ch) / 2
    const outH = 900
    const outW = Math.round(outH * aspect)
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    canvas.getContext('2d').drawImage(video, sx, sy, cw, ch, 0, 0, outW, outH)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `${type}.jpg`, { type: 'image/jpeg' })
        onCapture(file)
      },
      'image/jpeg',
      0.9,
    )
  }

  return (
    <div className="capture-overlay" onClick={onClose}>
      <div
        className="capture-box"
        role="dialog"
        aria-modal="true"
        aria-label={t('images.takePhoto')}
        ref={boxRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {error ? (
          <p className="capture-error">{t('library.scanError')}</p>
        ) : (
          <>
            <div className="capture-stage">
              <video ref={videoRef} autoPlay playsInline muted className="capture-video" />
              <div className="capture-guide" style={{ aspectRatio: String(aspect) }} />
            </div>
            <p className="capture-hint">{t('images.captureHint')}</p>
            <button className="capture-btn" onClick={capture}>
              {t('images.capture')}
            </button>
          </>
        )}
        <button className="capture-close" onClick={onClose}>
          {t('library.scanClose')}
        </button>
      </div>
    </div>
  )
}

export default PhotoCapture
