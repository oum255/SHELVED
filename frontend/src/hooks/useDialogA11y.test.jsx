import { fireEvent, render, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDialogA11y } from './useDialogA11y'

describe('useDialogA11y', () => {
  it('appelle onClose quand on appuie sur Échap', () => {
    const onClose = vi.fn()
    renderHook(() => useDialogA11y(onClose))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignore les autres touches', () => {
    const onClose = vi.fn()
    renderHook(() => useDialogA11y(onClose))

    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it("n'écoute pas Échap quand active=false (menu fermé, mais le hook doit quand même être appelé)", () => {
    const onClose = vi.fn()
    renderHook(() => useDialogA11y(onClose, false))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('déplace le focus sur l\'élément attaché à la ref, à l\'ouverture', () => {
    function Box() {
      const boxRef = useDialogA11y(() => {})
      return (
        <div ref={boxRef} tabIndex={-1} data-testid="box">
          contenu
        </div>
      )
    }
    const { getByTestId } = render(<Box />)
    expect(getByTestId('box')).toHaveFocus()
  })
})
