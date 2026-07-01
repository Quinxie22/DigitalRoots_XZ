export const cacheMiddleware = (ttlSeconds: number, prefix: string) => {
  return (req: any, res: any, next: any) => {
    next();
  };
};

export const clearCachePattern = async (pattern: string): Promise<void> => {
  return Promise.resolve();
};
