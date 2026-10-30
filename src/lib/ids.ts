export const rid = (): string => Math.random().toString(36).slice(2, 10);
export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
