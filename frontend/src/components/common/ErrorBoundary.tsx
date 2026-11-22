import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
        <div className="w-full max-w-xl mx-auto my-12 p-8 rounded-3xl bg-[#0b1325]/80 backdrop-blur-xl border border-rose-500/30 shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-950/70 border border-rose-500/50 flex items-center justify-center mx-auto text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white tracking-wide">
            Telemetry Rendering Interrupted
          </h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
            An unexpected error occurred while rendering the {this.props.pageName || 'view'}. Scientific telemetry safely falls back to standard procedures.
          </p>
          {this.state.error?.message && (
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] font-mono text-rose-300 break-words">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-bold text-xs tracking-wider shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_28px_rgba(34,211,238,0.6)] transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Telemetry</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
