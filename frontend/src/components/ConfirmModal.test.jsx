import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConfirmModal from './ConfirmModal'

function setup(props = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmModal
      title="Supprimer ce livre ?"
      message="Cette action est définitive."
      confirmLabel="Supprimer"
      cancelLabel="Annuler"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />
  )
  return { onConfirm, onCancel }
}

describe('ConfirmModal', () => {
  it('affiche le titre et le message', () => {
    setup()
    expect(screen.getByText('Supprimer ce livre ?')).toBeInTheDocument()
    expect(screen.getByText('Cette action est définitive.')).toBeInTheDocument()
  })

  it("s'annonce comme une fenêtre modale accessible", () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Supprimer ce livre ?')
  })

  it('appelle onConfirm au clic sur le bouton de confirmation', async () => {
    const user = userEvent.setup()
    const { onConfirm, onCancel } = setup()
    await user.click(screen.getByText('Supprimer'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('appelle onCancel au clic sur "Annuler"', async () => {
    const user = userEvent.setup()
    const { onCancel } = setup()
    await user.click(screen.getByText('Annuler'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('appelle onCancel quand on appuie sur Échap', () => {
    const { onCancel } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('met le focus dans la fenêtre à l\'ouverture (utile au clavier)', () => {
    setup()
    expect(screen.getByRole('dialog')).toHaveFocus()
  })
})
