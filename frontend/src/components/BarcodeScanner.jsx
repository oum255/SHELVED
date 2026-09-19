import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { useTranslation } from 'react-i18next'
import { useDialogA11y } from '../hooks/useDialogA11y'
import './BarcodeScanner.css'

// Ouvre la caméra et lit un code-barres ISBN ; appelle onDetected(code) puis onClose().
function BarcodeScanner({ onDetected, onClose }) {
  const { t } = useTranslation()
  const videoRef = useRef(null)
  const [error, setError] = useState(false)
  const boxRef = useDialogA11y(onClose)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let controls // pour arrêter la caméra
    let active = true

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err, ctrl) => {
        controls = ctrl
        if (!active) return
        if (result) {
          active = false
          ctrl.stop()
          onDetected(result.getText())
        }
      })
      .catch(() => setError(true)) // caméra refusée ou indisponible

    return () => {
      active = false
      if (controls) controls.stop()
    }
  }, [onDetected])

  return (
    <div className="scanner-overlay" onClick={onClose}>
      <div
        className="scanner-box"
        role="dialog"
        aria-modal="true"
        aria-label={t('library.scanTitle')}
        ref={boxRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="scanner-title">{t('library.scanTitle')}</p>
        {error ? (
          <p className="scanner-error">{t('library.scanError')}</p>
        ) : (
          <>
            <video ref={videoRef} className="scanner-video" />
            <p className="scanner-hint">{t('library.scanHint')}</p>
          </>
        )}
        <button className="scanner-close" onClick={onClose}>
          {t('library.scanClose')}
        </button>
      </div>
    </div>
  )
}

export default BarcodeScanner
