// MultimodalPreview.tsx — 멀티모달 이미지 첨부 미리보기 그리드

import { useLocale } from '../../i18n'
import type { ImageAttachment } from '../../lib/multimodalInput'

interface Props {
  attachments: ImageAttachment[]
  onRemove: (id: string) => void
  onClear: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function MultimodalPreview({ attachments, onRemove, onClear }: Props) {
  const { t } = useLocale()

  if (attachments.length === 0) {
    return null
  }

  return (
    <div className="multimodal-preview">
      <div className="multimodal-preview-header">
        <span className="multimodal-preview-count">
          {t('attachment.count', { count: attachments.length })}
        </span>
        {attachments.length >= 2 && (
          <button
            className="multimodal-preview-clear"
            onClick={onClear}
            aria-label={t('attachment.clearAll')}
          >
            {t('attachment.clearAll')}
          </button>
        )}
      </div>

      <div className="multimodal-preview-grid">
        {attachments.map((att) => (
          <div key={att.id} className="multimodal-preview-item">
            <div className="multimodal-preview-thumb">
              <img
                src={att.dataUrl}
                alt={att.name}
                className="multimodal-preview-img"
              />
            </div>
            <div className="multimodal-preview-info">
              <span className="multimodal-preview-name">{att.name}</span>
              <span className="multimodal-preview-size">{formatFileSize(att.size)}</span>
            </div>
            <button
              className="multimodal-preview-remove"
              onClick={() => onRemove(att.id)}
              aria-label={t('attachment.remove')}
            >
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
