/** The NWMLS exports in Data/, parsed at build time (see vite.config.ts). */
declare module 'virtual:mls-data' {
  const datasets: import('./lib/mls').MlsDataset[]
  export default datasets
}
