// Polyfills for browser compatibility with pdfjs-dist v4+/v6+
if (typeof Map !== 'undefined' && !('getOrInsertComputed' in Map.prototype)) {
  // @ts-ignore
  Map.prototype.getOrInsertComputed = function (key: any, callbackfn: (k: any) => any) {
    if (this.has(key)) {
      return this.get(key);
    }
    const value = callbackfn(key);
    this.set(key, value);
    return value;
  };
}

if (typeof WeakMap !== 'undefined' && !('getOrInsertComputed' in WeakMap.prototype)) {
  // @ts-ignore
  WeakMap.prototype.getOrInsertComputed = function (key: any, callbackfn: (k: any) => any) {
    if (this.has(key)) {
      return this.get(key);
    }
    const value = callbackfn(key);
    this.set(key, value);
    return value;
  };
}

if (typeof Promise !== 'undefined' && !('withResolvers' in Promise)) {
  // @ts-ignore
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof Math !== 'undefined' && !('sumPrecise' in Math)) {
  // @ts-ignore
  Math.sumPrecise = function (items: Iterable<number>) {
    let sum = 0;
    for (const item of items) {
      sum += Number(item) || 0;
    }
    return sum;
  };
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
