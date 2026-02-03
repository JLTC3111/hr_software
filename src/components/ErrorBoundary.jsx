import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import process from "node:process";

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the component tree and displays fallback UI
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(_error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('Error caught by ErrorBoundary:', error);
    console.error('Error Info:', errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo
    });

    // You can also log the error to an error reporting service here
    // e.g., Sentry, LogRocket, etc.
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null,
      errorInfo: null 
    });
  };

  handleReload = () => {
    globalThis.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full">
            {/* Error Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-red-200 dark:border-red-800">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
                </div>
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-3">
                Oops! Something went wrong
              </h1>

              {/* Description */}
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                The application encountered an unexpected error. Don't worry, your data is safe.
              </p>

              {/* Error Details (in development) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
                  <summary className="cursor-pointer font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
                    Error Details (Development Only)
                  </summary>
                  <div className="mt-2 text-xs font-mono text-red-600 dark:text-red-400 overflow-auto max-h-40">
                    <p className="font-bold mb-1">{this.state.error.toString()}</p>
                    {this.state.errorInfo && (
                      <pre className="whitespace-pre-wrap text-gray-600 dark:text-gray-400">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
                >
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Reload Application</span>
                </button>

                {this.props.onReset && (
                  <button
                    type="button"
                    onClick={() => {
                      this.handleReset();
                      this.props.onReset();
                    }}
                    className="w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors duration-200"
                  >
                    Try Again
                  </button>
                )}
              </div>

              {/* Support Info */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  If this problem persists, please contact support or refresh the page.
                </p>
              </div>
            </div>

            {/* Additional Info */}
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
              Error ID: {Date.now().toString(36).toUpperCase()}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
