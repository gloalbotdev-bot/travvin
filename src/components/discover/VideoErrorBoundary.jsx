import React from 'react';

// Lightweight error boundary so a single card's render failure doesn't whiten
// the whole feed. Shows a placeholder with a retry button on error.
export default class VideoErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('VideoErrorBoundary caught in', this.props.callerName, error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6" style={{ background: '#000' }}>
          <p className="text-white/70 text-sm mb-3">לא הצלחנו לטעון את הסרטון הזה.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-white text-xs font-semibold px-4 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            נסה שוב
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}