import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

import { ApiError, toApiError } from "@shared/api/errors";

/**
 * State of an asynchronous load.
 */
export interface AsyncState<DataT> {
  /** Loaded data, kept while a reload runs. */
  data: DataT | null;
  /** Error of the current attempt, with a Spanish message. */
  error: ApiError | null;
  /** True while the current attempt runs. */
  loading: boolean;
  /** Runs the load again. */
  reload: () => void;
}

/**
 * Outcome of one attempt, tagged with the attempt it belongs to.
 */
interface Outcome<DataT> {
  requestId: string;
  data: DataT | null;
  error: ApiError | null;
}

/**
 * Loads data when the component mounts and whenever `key` changes.
 *
 * Loading is derived from whether the latest outcome belongs to the current attempt, so no state
 * is set synchronously inside the effect. Answers of outdated attempts are ignored, so a slow
 * request never overwrites a newer one.
 *
 * @param load - Function that fetches the data; it always sees the latest props and state.
 * @param key - Text that identifies what is loaded, such as the serialized filters.
 * @returns The data, the error, the loading flag and a reload function.
 */
export function useAsync<DataT>(load: () => Promise<DataT>, key: string = ""): AsyncState<DataT> {
  const [attempt, setAttempt] = useState<number>(0);
  const [outcome, setOutcome] = useState<Outcome<DataT>>({ requestId: "", data: null, error: null });
  const latest = useRef<string>("");
  const runLoad = useEffectEvent(load);
  const requestId: string = `${key}#${attempt}`;

  useEffect(() => {
    latest.current = requestId;
    runLoad()
      .then((data) => {
        if (latest.current === requestId) {
          setOutcome({ requestId, data, error: null });
        }
      })
      .catch((caught: unknown) => {
        if (latest.current === requestId) {
          setOutcome((previous) => ({ requestId, data: previous.data, error: toApiError(caught) }));
        }
      });
  }, [requestId]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const current: boolean = outcome.requestId === requestId;
  return { data: outcome.data, error: current ? outcome.error : null, loading: !current, reload };
}
