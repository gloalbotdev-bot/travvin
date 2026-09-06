import React from 'react';

// App-wide error boundary. Catches render/lifecycle errors that escape the
// per-card boundaries (e.g. in the discover feed) so a single crash never
// blanks the whole preview iframe to a white screen. Shows a compact,
// dismissable fallback that lets the user keep using the app.
export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('GlobalErrorBoundary caught:', error, info);
  }
  reset = () => this.setState({ error: null });
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center text-center px-6" dir="rtl" style={{ background: '#fafafa', color: '#1A1A1A', fontFamily: 'Heebo, sans-serif' }}>
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.3 3.9L1.39 18a2 2 0 001.71 3h17.8a2 2 0 001.71-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <p className="font-bold text-base mb-1">משהו השתבש</p>
          <p className="text-sm mb-5" style={{ color: '#6B7280' }}>אירעה שגיאה בזמן הצגת התוכן. נסה שוב.</p>
          <button onClick={this.reset} className="text-white text-sm font-bold px-6 py-2.5 rounded-xl" style={{ background: '#F97316' }}>נסה שוב</button>
        </div>
      );
    }
    return this.props.children;
  }
}