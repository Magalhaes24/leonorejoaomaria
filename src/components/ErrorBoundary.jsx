import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  render() {
    const { error } = this.state;
    const { children } = this.props;

    if (error) {
      return (
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="section-kicker">App error</p>
          <h1 className="text-2xl font-semibold">Something prevented the UI from loading.</h1>
          <p className="text-sm text-pearl-700">{error.message}</p>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
