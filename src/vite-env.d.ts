/// <reference types="vite/client" />

interface Window {
  electron: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, func: (...args: any[]) => void) => () => void;
    off: (channel: string, func: (...args: any[]) => void) => void;
  };
}
