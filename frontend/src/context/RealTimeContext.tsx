import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface RealTimeData {
  activeUsersCount: number;
  todayVisits: number;
  lastUpdate: Date | null;
  isConnected: boolean;
  hourlyDistribution: Record<number, number>;
  dailyBreakdown: any[];
  engagementMetrics: {
    averageVisitDuration: number;
  };
  currentlyInside: number;
}

interface RealTimeContextType {
  subscribe: () => void;
  unsubscribe: () => void;
  realTimeData: RealTimeData;
  lastEvent: any | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

const RealTimeContext = createContext<RealTimeContextType | null>(null);

const SOCKET_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:8000';

export function RealTimeProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const reconnectIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [realTimeData, setRealTimeData] = useState<RealTimeData>({
    activeUsersCount: 0,
    todayVisits: 0,
    lastUpdate: null,
    isConnected: false,
    hourlyDistribution: {},
    dailyBreakdown: [],
    engagementMetrics: { averageVisitDuration: 0 },
    currentlyInside: 0
  });
  const [lastEvent, setLastEvent] = useState<any | null>(null);

  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return;
    
    setConnectionStatus('connecting');
    
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 5000,
      forceNew: true,
    });

    socket.on('connect', () => {
      setConnectionStatus('connected');
      setRealTimeData(prev => ({ ...prev, isConnected: true }));
      
      if (isSubscribed) {
        socket.emit('subscribe-dashboard');
      }
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      setRealTimeData(prev => ({ ...prev, isConnected: false }));
    });

    socket.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('new-log', (data) => {
      setLastEvent(data);
      setRealTimeData(prev => ({
        ...prev,
        activeUsersCount: data.activeUsersCount ?? prev.activeUsersCount,
        todayVisits: data.todayVisits ?? prev.todayVisits,
        lastUpdate: new Date()
      }));
    });

    socket.on('analytics-update', (data) => {
      setRealTimeData(prev => ({
        ...prev,
        hourlyDistribution: data.hourlyDistribution ?? prev.hourlyDistribution,
        dailyBreakdown: data.dailyBreakdown ?? prev.dailyBreakdown,
        engagementMetrics: data.engagementMetrics ?? prev.engagementMetrics,
        currentlyInside: data.currentlyInside ?? prev.currentlyInside,
        todayVisits: data.todayVisits ?? prev.todayVisits,
        activeUsersCount: data.currentlyInside ?? prev.activeUsersCount,
        lastUpdate: new Date()
      }));
    });

    socketRef.current = socket;
  }, [SOCKET_URL, isSubscribed]);

  useEffect(() => {
    connectSocket();
  }, [connectSocket]);

  useEffect(() => {
    if (connectionStatus === 'disconnected' && navigator.onLine) {
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
      }
      reconnectIntervalRef.current = setInterval(() => {
        connectSocket();
      }, 2000);
    } else {
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
    }

    return () => {
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
      }
    };
  }, [connectionStatus, connectSocket]);

  const subscribe = useCallback(() => {
    setIsSubscribed(true);
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe-dashboard');
    }
  }, []);

  const unsubscribe = useCallback(() => {
    setIsSubscribed(false);
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe-dashboard');
    }
  }, []);

  return (
    <RealTimeContext.Provider value={{ subscribe, unsubscribe, realTimeData, lastEvent, connectionStatus }}>
      {children}
    </RealTimeContext.Provider>
  );
}

export function useRealTimeData() {
  const context = useContext(RealTimeContext);
  if (!context) {
    return {
      subscribe: () => {},
      unsubscribe: () => {},
      realTimeData: { 
        activeUsersCount: 0, 
        todayVisits: 0, 
        lastUpdate: null, 
        isConnected: false,
        hourlyDistribution: {},
        dailyBreakdown: [],
        engagementMetrics: { averageVisitDuration: 0 },
        currentlyInside: 0
      },
      lastEvent: null,
      connectionStatus: 'disconnected' as const
    };
  }
  return context;
}