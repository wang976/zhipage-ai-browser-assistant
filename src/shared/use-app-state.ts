import { useEffect, useState } from "react";
import { defaultAppState } from "./defaults";
import { loadAppState, subscribeToAppState } from "./storage";

export function useAppState() {
  const [state, setState] = useState(defaultAppState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    void loadAppState().then((nextState) => {
      if (!mounted) {
        return;
      }
      setState(nextState);
      setReady(true);
    });

    const unsubscribe = subscribeToAppState((nextState) => {
      setState(nextState);
      setReady(true);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return {
    state,
    ready,
  };
}
