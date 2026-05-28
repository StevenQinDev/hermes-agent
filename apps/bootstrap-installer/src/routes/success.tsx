import { type CSSProperties } from 'react'
import { Button } from '../components/button'
import { launchHermesDesktop } from '../store'
import { Rocket } from 'lucide-react'

/*
 * Success screen. HERMES AGENT wordmark stays as the visual anchor
 * (same Collapse Bold treatment as Welcome + the desktop chat intro),
 * with a status line below.
 *
 * No install-path footer — same rationale as Welcome.
 */
export default function Success() {
  return (
    <div className="hermes-fade-in flex h-full flex-col items-center justify-center gap-8 px-12 py-10">
      <div className="w-full max-w-2xl min-w-0 text-center">
        <p
          className="fit-text mx-auto mb-4 w-full font-['Collapse'] font-bold uppercase leading-[0.9] tracking-[0.08em] text-midground mix-blend-plus-lighter dark:text-foreground/90"
          style={
            {
              '--fit-text-line-height': '0.9',
              '--fit-text-max': '5rem',
              '--fit-text-min': '2.25rem'
            } as CSSProperties
          }
        >
          <span>
            <span>Hermes is ready</span>
          </span>
          <span aria-hidden="true">Hermes is ready</span>
        </p>

        <p className="m-0 text-center text-base leading-normal tracking-tight text-muted-foreground">
          You can launch from here, or any time from your terminal with{' '}
          <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-sm">
            hermes desktop
          </code>
          .
        </p>
      </div>

      <Button
        onClick={() => void launchHermesDesktop()}
        size="lg"
        className="inline-flex items-center gap-2 px-6"
      >
        <Rocket size={18} />
        Launch Hermes
      </Button>
    </div>
  )
}
