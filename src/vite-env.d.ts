/// <reference types="vite/client" />

declare global {
  interface Window {
    _Highcharts?: typeof import("highcharts/highcharts");
  }
}

export {};
