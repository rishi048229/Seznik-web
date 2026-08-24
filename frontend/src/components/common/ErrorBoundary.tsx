import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Root-level safety net. Without this, ANY uncaught render error — most
 * commonly a lazy-loaded page chunk that 404s because the server redeployed
 * since this tab last loaded (its hashed filenames no longer exist) — takes
 * the entire app down to a blank white screen with nothing telling the user
 * why, until they figure out to refresh manually. This catches that and
 * shows a clear "something went wrong, reload" screen instead.
 *
 * Paired with the retry-once logic in App.tsx's lazyPage() helper, which
 * handles the common stale-chunk case automatically (silent one-time
 * reload) — this boundary is the fallback for everything else.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            background: '#f9fafb',
            color: '#111827',
          }}
        >
          <p style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Something went wrong loading this page.</p>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            This usually clears up with a reload — especially right after an update.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              background: '#0a0a2e',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
