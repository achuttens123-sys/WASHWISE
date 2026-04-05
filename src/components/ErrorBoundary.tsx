import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  userMessage: string;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    userMessage: 'Something went wrong. Please try again.'
  };

  public static getDerivedStateFromError(error: Error): State {
    let userMessage = 'Something went wrong. Please try again.';
    
    try {
      // Check if the error message is a JSON string from handleFirestoreError
      const errorInfo = JSON.parse(error.message);
      if (errorInfo && errorInfo.userMessage) {
        userMessage = errorInfo.userMessage;
      }
    } catch (e) {
      // Not a JSON error message, use default
    }

    return { hasError: true, error, userMessage };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, userMessage: 'Something went wrong. Please try again.' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border border-red-100 dark:border-red-900/20 p-8 text-center">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-500" />
            </div>
            
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-4 tracking-tight uppercase">
              Oops! Something went wrong
            </h2>
            
            <p className="text-gray-600 dark:text-gray-400 mb-8 font-medium leading-relaxed">
              {this.state.userMessage}
            </p>
            
            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center uppercase tracking-widest text-xs"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-black rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center uppercase tracking-widest text-xs"
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </button>
            </div>
            
            <div className="mt-8 pt-8 border-t border-gray-50 dark:border-gray-800">
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-[0.2em]">
                Error Reference: {this.state.error?.name || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
