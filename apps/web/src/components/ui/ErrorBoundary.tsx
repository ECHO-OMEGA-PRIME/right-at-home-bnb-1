'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-white/60 mb-6">
              We encountered an unexpected error. Please try again or contact support if the problem
              persists.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-left">
                <p className="text-sm font-mono text-red-400 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-lg bg-maroon-800 hover:bg-maroon-700 text-white font-medium transition-colors flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <Link
                href="/"
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Error display component for server-side errors
interface ErrorDisplayProps {
  title?: string;
  message?: string;
  showRetry?: boolean;
  onRetry?: () => void;
}

export function ErrorDisplay({
  title = 'Error',
  message = 'Something went wrong. Please try again.',
  showRetry = true,
  onRetry,
}: ErrorDisplayProps) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-white/60 text-sm mb-4">{message}</p>
      {showRetry && (
        <button
          onClick={onRetry || (() => window.location.reload())}
          className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      )}
    </div>
  );
}

export default ErrorBoundary;
