import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info)
  }

  handleReload = () => { window.location.reload() }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div
          className="rounded-2xl p-6 text-center max-w-sm w-full"
          style={{ background: '#001a0d', border: '1px solid rgba(200,0,0,0.35)' }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#e8f0ec', marginBottom: 6 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 13, color: '#3d7055', marginBottom: 18 }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button onClick={this.handleReload} className="btn-primary">
            Reload
          </button>
        </div>
      </div>
    )
  }
}
