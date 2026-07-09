'use client'
import { X } from 'lucide-react'

interface ModalProps {
  onClose: () => void
  width?: number
  children: React.ReactNode
}

export function Modal({ onClose, width = 420, children }: ModalProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-[rgba(24,43,63,.45)] flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width, maxWidth: '92vw' }}
        className="bg-white rounded-2xl shadow-[0_24px_60px_-12px_rgba(0,0,0,.35)] overflow-hidden"
      >
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 pt-6">
      <div className="text-base font-extrabold">{title}</div>
      <button onClick={onClose} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
        <X className="w-[18px] h-[18px]" />
      </button>
    </div>
  )
}
