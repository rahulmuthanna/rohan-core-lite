import type { ReactNode } from 'react';
import type { LoadResult } from '../lib/useLoad';

interface LoadStateProps<Data> {
  state: LoadResult<Data>;
  children: (data: Data) => ReactNode;
}

/**
 * Shows the right thing for each stage of loading:
 * a loading line first, an error with a retry button if it failed,
 * and the real content once the data has arrived.
 */
export function LoadState<Data>({ state, children }: LoadStateProps<Data>) {
  if (state.data === undefined) {
    if (state.error) {
      return <ErrorPanel message={state.error.message} onRetry={state.reload} />;
    }
    return (
      <p className="loading" role="status">
        Loading…
      </p>
    );
  }
  return (
    <>
      {state.error && <ErrorPanel message={state.error.message} onRetry={state.reload} />}
      {children(state.data)}
    </>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="notice notice-error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** A plain message for a list that has nothing in it yet, with what to do next. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
