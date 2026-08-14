import React from 'react';

/**
 * Keeps a failed decorative lazy chunk from reaching the root ErrorBoundary.
 * The wrapped UI is optional; whatever sits beside it stays up.
 */
class OptionalChunkBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('Optional chunk failed; continuing without it:', error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}

export default OptionalChunkBoundary;
