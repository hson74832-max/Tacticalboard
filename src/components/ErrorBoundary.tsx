import { Component, type ReactNode } from "react";

interface State {
  err: Error | null;
}

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error) {
    // eslint-disable-next-line no-console
    console.error("[TactiBoard] caught render error:", err);
  }

  render() {
    if (this.state.err) {
      return (
        <div className="flex h-[100dvh] w-screen flex-col items-center justify-center gap-4 bg-slate-900 p-6 text-center text-white">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="max-w-md text-sm text-white/60">
            {this.state.err.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => {
              this.setState({ err: null });
            }}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
