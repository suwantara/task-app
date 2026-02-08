'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function RealTimeClock() {
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Indonesian Central Time (WITA) is UTC+8
      const witaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
      
      // Format time as HH:mm:ss
      const timeString = witaTime.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      
      // Format date as Day, DD Mon YYYY
      const dateString = witaTime.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      
      setTime(timeString);
      setDate(dateString);
    };

    // Update immediately
    updateTime();
    
    // Update every second
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  // Don't render until client-side hydration is complete
  if (!time) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <div className="flex flex-col items-start leading-tight">
        <span className="font-medium tabular-nums">{time}</span>
        <span className="text-xs">{date} WITA</span>
      </div>
    </div>
  );
}
