import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { getIndustry, DISPLAY, BODY } from '../theme/industry.js';
import { Blueprint, Btn, Kicker } from './ui/industry.jsx';

/**
 * Root error boundary.
 *
 * Design system: "Industry" (src/theme/industry.js). Radius is 0 everywhere,
 * cards are outlines with four registration corners, status reads through
 * weight and rule rather than colour.
 *
 * Catches JavaScript errors anywhere in the component tree and displays
 * fallback UI. The routed-page boundary lives in RouteErrorBoundary.jsx.
 */
class ErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by ErrorBoundary:', error);
    console.error('Error Info:', errorInfo);

    this.setState({
      error,
      errorInfo,
      errorId: Date.now().toString(36).toUpperCase(),
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleReload = () => {
    globalThis.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { t, ind } = this.props;
      const errorId = this.state.errorId || Date.now().toString(36).toUpperCase();

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: ind.ground,
            padding: 16,
            fontFamily: BODY,
            color: ind.ink,
          }}
        >
          <div style={{ maxWidth: 480, width: '100%' }}>
            <Blueprint ind={ind} style={{ background: ind.ground, padding: '28px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <AlertCircle
                  size={18}
                  strokeWidth={1.5}
                  style={{ flex: 'none', marginTop: 2, color: ind.ink }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Kicker ind={ind} color={ind.ink}>
                    {t('common.error', 'Error')}
                  </Kicker>
                  <h1
                    style={{
                      fontFamily: BODY,
                      fontSize: 22,
                      fontWeight: 400,
                      color: ind.ink,
                      margin: '8px 0 0',
                      lineHeight: 1.25,
                    }}
                  >
                    {t('errorBoundary.title', 'Oops! Something went wrong')}
                  </h1>
                  <p
                    style={{
                      fontFamily: BODY,
                      fontSize: 14,
                      color: ind.inkMuted,
                      margin: '8px 0 0',
                      lineHeight: 1.5,
                    }}
                  >
                    {t(
                      'errorBoundary.description',
                      "The application encountered an unexpected error. Don't worry, your data is safe."
                    )}
                  </p>

                  {import.meta.env.DEV && this.state.error && (
                    <details
                      style={{
                        marginTop: 16,
                        padding: '10px 12px',
                        border: `1px solid ${ind.hairline}`,
                      }}
                    >
                      <summary
                        style={{
                          cursor: 'pointer',
                          fontFamily: DISPLAY,
                          fontWeight: 600,
                          fontSize: 11,
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          color: ind.ink,
                        }}
                      >
                        {t('errorBoundary.developmentDetails', 'Error Details (Development Only)')}
                      </summary>
                      <div
                        style={{
                          marginTop: 10,
                          fontFamily: DISPLAY,
                          fontSize: 12,
                          letterSpacing: '.02em',
                          color: ind.inkMuted,
                          overflow: 'auto',
                          maxHeight: 160,
                          wordBreak: 'break-word',
                        }}
                      >
                        <p style={{ fontWeight: 600, margin: '0 0 6px', color: ind.ink }}>
                          {this.state.error.toString()}
                        </p>
                        {this.state.errorInfo && (
                          <pre
                            style={{
                              whiteSpace: 'pre-wrap',
                              margin: 0,
                              fontFamily: BODY,
                              fontSize: 12,
                              color: ind.inkFaint,
                            }}
                          >
                            {this.state.errorInfo.componentStack}
                          </pre>
                        )}
                      </div>
                    </details>
                  )}

                  <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Btn
                      ind={ind}
                      variant="primary"
                      onClick={this.handleReload}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <RefreshCw size={13} strokeWidth={1.5} />
                      {t('errorBoundary.reloadApplication', 'Reload Application')}
                    </Btn>

                    {this.props.onReset && (
                      <Btn
                        ind={ind}
                        onClick={() => {
                          this.handleReset();
                          this.props.onReset();
                        }}
                      >
                        {t('common.tryAgain', 'Try Again')}
                      </Btn>
                    )}
                  </div>

                  <p
                    style={{
                      fontFamily: BODY,
                      fontSize: 12,
                      color: ind.inkFaint,
                      margin: '18px 0 0',
                      paddingTop: 14,
                      borderTop: `1px solid ${ind.rule}`,
                      lineHeight: 1.45,
                    }}
                  >
                    {t(
                      'errorBoundary.support',
                      'If this problem persists, please contact support or refresh the page.'
                    )}
                  </p>
                </div>
              </div>
            </Blueprint>

            <p
              style={{
                marginTop: 12,
                fontFamily: DISPLAY,
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: ind.inkFaint,
                textAlign: 'center',
              }}
            >
              {t('errorBoundary.errorId', 'Error ID: {id}').replace('{id}', errorId)}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const ErrorBoundary = (props) => {
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();
  const ind = getIndustry(isDarkMode);
  return <ErrorBoundaryInner {...props} t={t} ind={ind} />;
};

export default ErrorBoundary;
