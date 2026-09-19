import { useEffect, useRef, useState } from 'react'

// Google Books renvoie parfois un placeholder gris 400×522 avec un code 200
// (pas d'erreur détectable) là où seule la petite image (zoom=1) existe vraiment.
// On essaie la grande, on bascule sur la petite si c'est ce placeholder, sinon on abandonne.

// Reconstruit l'URL de la petite version (zoom=1) à partir de l'URL haute résolution.
function smallVersion(url) {
  if (!url || !url.includes('books.google')) return null
  const small = url.replace(/&fife=w\d+/, '').replace('zoom=0', 'zoom=1')
  return small !== url ? small : null
}

// L'image grise "pas de couverture" de Google fait exactement 400×522 px.
function isPlaceholder(width, height) {
  return width === 400 && height === 522
}

function BookCover({ url, alt = '', className = '' }) {
  const [src, setSrc] = useState(url)
  const [triedSmall, setTriedSmall] = useState(false)
  const [failed, setFailed] = useState(false)
  const imgRef = useRef(null)

  // Repart de zéro quand l'URL change (nouveau livre).
  useEffect(() => {
    setSrc(url)
    setTriedSmall(false)
    setFailed(false)
  }, [url])

  function fallbackOrFail() {
    const small = smallVersion(src)
    if (!triedSmall && small) {
      setSrc(small)
      setTriedSmall(true)
    } else {
      setFailed(true)
    }
  }

  // Si l'image est déjà en cache, onLoad ne se redéclenche pas : on vérifie
  // donc juste après le rendu pour détecter quand même le placeholder gris.
  useEffect(() => {
    const img = imgRef.current
    if (!img || !img.complete) return
    if (img.naturalWidth === 0) {
      fallbackOrFail() // image cassée
    } else if (!triedSmall && isPlaceholder(img.naturalWidth, img.naturalHeight)) {
      fallbackOrFail() // placeholder gris en cache
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  if (!url || failed) {
    // Pas de couverture : panneau neutre, sans emoji.
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-2)',
          color: 'var(--muted)',
          fontSize: '0.7rem',
          textAlign: 'center',
          padding: '0.4rem',
        }}
      >
        {alt || ''}
      </div>
    )
  }

  return (
    <img
      ref={imgRef}
      className={className}
      src={src}
      alt={alt}
      onLoad={(e) => {
        if (!triedSmall && isPlaceholder(e.target.naturalWidth, e.target.naturalHeight)) {
          fallbackOrFail()
        }
      }}
      onError={fallbackOrFail}
    />
  )
}

export default BookCover
