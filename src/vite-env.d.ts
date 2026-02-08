/// <reference types="vite/client" />
/* eslint-disable @typescript-eslint/no-explicit-any */

interface Window {
  electron: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, func: (...args: any[]) => void) => () => void;
    off: (channel: string, func: (...args: any[]) => void) => void;
    windowControl: {
      minimize: () => Promise<void>;
      toggleMaximize: () => Promise<boolean>;
      close: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
    };
  };
}
