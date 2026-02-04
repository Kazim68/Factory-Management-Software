export {};

declare global {
  interface Window {
    api: {
      request: (payload: {
        path: string;
        method?: string;
        body?: unknown;
      }) => Promise<unknown>;
    };
  }
}
