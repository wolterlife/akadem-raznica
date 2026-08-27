import type { Identity } from '../../presence'
import { saveIdentity } from '../../presence'

interface Props {
  onReady: (identity: Identity) => void
}

const CHOICES = ['D', 'M'] as const

export function NameGate({ onReady }: Props) {
  function pick(name: (typeof CHOICES)[number]) {
    onReady(saveIdentity(name))
  }

  return (
    <div className="modal-backdrop name-gate" role="presentation">
      <div className="modal" role="dialog" aria-labelledby="name-gate-title">
        <h2 id="name-gate-title">РљС‚Рѕ Р·Р° РґРѕСЃРєРѕР№?</h2>
        <p className="modal__hint">Р’С‹Р±РѕСЂ СЃРѕС…СЂР°РЅРёС‚СЃСЏ РІ СЌС‚РѕРј Р±СЂР°СѓР·РµСЂРµ.</p>
        <div className="name-gate__choices">
          {CHOICES.map((name) => (
            <button
              key={name}
              type="button"
              className="btn btn--primary name-gate__pick"
              onClick={() => pick(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

