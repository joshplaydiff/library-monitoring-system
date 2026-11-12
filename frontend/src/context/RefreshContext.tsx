import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface RefreshContextType {
  triggerRefresh: (key: string) => void;
  subscribe: (key: string, callback: () => void) => () => void;
  lastRefresh: Record<string, number>;
}

const RefreshContext = createContext<RefreshContextType | null>(null);

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const subscribersRef = useRef<{[key: string]: Set<() => void>}>({});
  const [lastRefresh, setLastRefresh] = useState<{[key: string]: number}>({});

  const subscribe = useCallback((key: string, callback: () => void) => {
    if (!subscribersRef.current[key]) {
      subscribersRef.current[key] = new Set();
    }
    subscribersRef.current[key].add(callback);

    return () => {
      subscribersRef.current[key]?.delete(callback);
    };
  }, []);

  const triggerRefresh = useCallback((key: string) => {
    const timestamp = Date.now();
    setLastRefresh(prev => ({ ...prev, [key]: timestamp }));
    
    const callbacks = subscribersRef.current[key];
    if (callbacks) {
      callbacks.forEach(callback => callback());
    }
  }, []);

  return (
    <RefreshContext.Provider value={{ triggerRefresh, subscribe, lastRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh(key: string, callback: () => void) {
  const context = useContext(RefreshContext);
  
  useEffect(() => {
    if (context) {
      return context.subscribe(key, callback);
    }
  }, [context, key, callback]);

  const trigger = context?.triggerRefresh || (() => {});
  
  return { trigger: () => trigger(key), lastRefresh: context?.lastRefresh[key] };
}

export function useGlobalRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    return { triggerRefresh: () => {} };
  }
  return context;
}