import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface Props {
  children: ReactNode;
  pageName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ASTRAVIGIL ErrorBoundary] Error in ${this.props.pageName || 'page'}:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <GlassCard glow="red" className="w-full max-w-xl mx-auto my-12 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-400/45 shadow-glow-red flex items-center justify-center mx-auto text-rose-300">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="type-card-title text-white">
            Telemetry Rendering Interrupted
          </h3>
          <p className="text-sm text-[#b4c6dc] max-w-md mx-auto leading-relaxed">
            An unexpected error occurred while rendering the {this.props.pageName || 'view'}. Scientific telemetry safely falls back to standard procedures.
          </p>
          {this.state.error?.message && (
            <div className="p-3 bg-white/[0.04] rounded-2xl border border-white/10 text-xs font-data text-rose-300 break-words">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleRetry}
            className="btn-primary-glow inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Telemetry</span>
          </button>
        </GlassCard>
      );
    }

    return this.props.children;
  }
}
