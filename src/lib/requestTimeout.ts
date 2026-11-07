export function within<T>(
  promise: Promise<T>,
  milliseconds: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(message)), milliseconds);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
export const boundedFetch: typeof fetch = (input, init) => {
  const endpoint = String(input instanceof Request ? input.url : input);
  const timeout = endpoint.includes("/auth/v1/")
    ? 12000
    : endpoint.includes("/functions/v1/")
      ? 70000
      : 60000;
  const original =
    init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const signal = original
    ? AbortSignal.any([original, AbortSignal.timeout(timeout)])
    : AbortSignal.timeout(timeout);
  return fetch(input, { ...init, signal });
};
