import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
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

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-zinc-950 text-zinc-100 gap-4 p-8">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <h1 className="text-lg font-semibold text-zinc-200">Something went wrong</h1>
        <pre className="text-[12px] text-red-300 bg-zinc-900 rounded-md p-4 max-w-[600px] max-h-[200px] overflow-auto whitespace-pre-wrap">
          {this.state.error?.message}
        </pre>
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }
}
