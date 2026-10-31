import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./services/auth";
import "./styles.css";
import "./redesign.css";
import "./studio.css";
import "./themes.css";
import "./hierarchy.css";
import "./mobile-nav.css";
import "./explore.css";
import "./watchlist-refinement.css";
import "./brand.css";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="empty-state">
        <h1>Even our website has decided to take a break.</h1>
        <p>
          Something went wrong. Reload the app to try again.
        </p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload the page
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
