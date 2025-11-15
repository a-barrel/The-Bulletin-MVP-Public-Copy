import { Component } from 'react';
import ErrorFallback from './ErrorFallback.jsx';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught error in application boundary:', error, info);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          onRetry={this.handleReset}
          onReload={this.handleReload}
          error={this.state.error}
        />
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
