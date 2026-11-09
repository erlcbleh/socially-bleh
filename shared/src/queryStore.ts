import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

type QueryKey = readonly unknown[];

interface Snapshot<T = unknown> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
}

interface CacheEntry {
  snapshot: Snapshot;
  fetchedAt: number;
  latestFetchId: number;
  inFlight: Promise<unknown> | null;
  refetchAfterFlight: boolean;
  fetcher: (() => Promise<unknown>) | null;
  subscribers: Set<() => void>;
  gcTimer: ReturnType<typeof setTimeout> | null;
}

const STALE_TIME = 10_000;
const CACHE_TIME = 5 * 60_000;
const EMPTY_SNAPSHOT: Snapshot = { data: undefined, error: null, isLoading: false };
const cache = new Map<string, CacheEntry>();

function keyToString(queryKey: QueryKey): string {
  return JSON.stringify(queryKey);
}

function getEntry(key: string): CacheEntry {
  let entry = cache.get(key);
  if (!entry) {
    entry = {
      snapshot: EMPTY_SNAPSHOT,
      fetchedAt: 0,
      latestFetchId: 0,
      inFlight: null,
      refetchAfterFlight: false,
      fetcher: null,
      subscribers: new Set(),
      gcTimer: null,
    };
    cache.set(key, entry);
    scheduleGc(key, entry);
  }
  return entry;
}

function scheduleGc(key: string, entry: CacheEntry) {
  if (entry.subscribers.size > 0 || entry.gcTimer) return;
  entry.gcTimer = setTimeout(() => {
    entry.gcTimer = null;
    if (entry.subscribers.size > 0 || cache.get(key) !== entry) return;
    entry.latestFetchId += 1;
    cache.delete(key);
  }, CACHE_TIME);
}

function patchSnapshot(entry: CacheEntry, patch: Partial<Snapshot>) {
  entry.snapshot = { ...entry.snapshot, ...patch };
  entry.subscribers.forEach((cb) => cb());
}

function runFetch(key: string, fetcher: () => Promise<unknown>): Promise<unknown> {
  const entry = getEntry(key);
  if (entry.inFlight) return entry.inFlight;
  const fetchId = ++entry.latestFetchId;
  patchSnapshot(entry, { isLoading: true });

  const promise = fetcher()
    .then((data) => {
      if (entry.latestFetchId !== fetchId) return data;
      const refetchAfterFlight = entry.refetchAfterFlight;
      entry.refetchAfterFlight = false;
      entry.fetchedAt = refetchAfterFlight ? 0 : Date.now();
      entry.inFlight = null;
      patchSnapshot(entry, { data, error: null, isLoading: false });
      if (refetchAfterFlight && entry.fetcher && entry.subscribers.size > 0) {
        runFetch(key, entry.fetcher).catch(() => {});
      }
      return data;
    })
    .catch((err) => {
      if (entry.latestFetchId !== fetchId) throw err;
      const error = err instanceof Error ? err : new Error(String(err));
      const refetchAfterFlight = entry.refetchAfterFlight;
      entry.refetchAfterFlight = false;
      entry.inFlight = null;
      patchSnapshot(entry, { error, isLoading: false });
      if (refetchAfterFlight && entry.fetcher && entry.subscribers.size > 0) {
        runFetch(key, entry.fetcher).catch(() => {});
      }
      throw error;
    });

  entry.inFlight = promise;
  return promise;
}

function ensureFresh(key: string, fetcher: () => Promise<unknown>) {
  const entry = getEntry(key);
  entry.fetcher = fetcher;
  if (entry.inFlight) return;
  const isFresh = entry.fetchedAt > 0 && Date.now() - entry.fetchedAt < STALE_TIME;
  if (isFresh) return;
  runFetch(key, fetcher).catch(() => {});
}

interface UseQueryOptions<T> {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  enabled?: boolean;
  refetchInterval?: number;
}

interface UseQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<T>;
}

export function useQuery<T>(options: UseQueryOptions<T>): UseQueryResult<T> {
  const { queryKey, enabled = true, refetchInterval } = options;
  const key = keyToString(queryKey);

  const queryFnRef = useRef(options.queryFn);
  queryFnRef.current = options.queryFn;
  const fetcher = useCallback(() => queryFnRef.current(), []);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!enabled) return () => {};
      const entry = getEntry(key);
      if (entry.gcTimer) {
        clearTimeout(entry.gcTimer);
        entry.gcTimer = null;
      }
      entry.subscribers.add(onStoreChange);
      return () => {
        entry.subscribers.delete(onStoreChange);
        scheduleGc(key, entry);
      };
    },
    [key, enabled]
  );

  const getSnapshot = useCallback(() => (enabled ? getEntry(key).snapshot : EMPTY_SNAPSHOT), [key, enabled]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!enabled) return;
    ensureFresh(key, fetcher);
  }, [key, enabled, fetcher]);

  useEffect(() => {
    if (!enabled || !refetchInterval) return;

    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
    };

    const start = () => {
      if (timer !== undefined) return;
      timer = setInterval(() => {
        runFetch(key, fetcher).catch(() => {});
      }, refetchInterval);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
        return;
      }
      runFetch(key, fetcher).catch(() => {});
      start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [key, enabled, refetchInterval, fetcher]);

  const refetch = useCallback(() => runFetch(key, fetcher) as Promise<T>, [key, fetcher]);

  return {
    data: snapshot.data as T | undefined,
    isLoading: enabled && snapshot.data === undefined && snapshot.error === null,
    error: snapshot.error,
    refetch,
  };
}

interface InfinitePage<TPage> {
  pages: TPage[];
  pageParams: unknown[];
}

interface UseInfiniteQueryOptions<TPage> {
  queryKey: QueryKey;
  queryFn: (pageParam: unknown) => Promise<TPage>;
  getNextPageParam: (lastPage: TPage) => unknown;
  enabled?: boolean;
}

interface UseInfiniteQueryResult<TPage> {
  pages: TPage[];
  data: InfinitePage<TPage> | undefined;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error: Error | null;
  fetchNextPage: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useInfiniteQuery<TPage>(options: UseInfiniteQueryOptions<TPage>): UseInfiniteQueryResult<TPage> {
  const { queryKey, enabled = true } = options;
  const key = keyToString(queryKey);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const fetchingNextRef = useRef(false);

  const fetcher = useCallback(async () => {
    const first = await optionsRef.current.queryFn(undefined);
    return { pages: [first], pageParams: [undefined] } as InfinitePage<TPage>;
  }, []);

  const result = useQuery<InfinitePage<TPage>>({ queryKey, queryFn: fetcher, enabled });

  const pages = result.data?.pages ?? [];
  const lastPage = pages.length > 0 ? pages[pages.length - 1] : undefined;
  const nextParam = lastPage === undefined ? undefined : optionsRef.current.getNextPageParam(lastPage);
  const hasNextPage = nextParam !== undefined && nextParam !== null;

  const fetchNextPage = useCallback(async () => {
    const entry = getEntry(key);
    const current = entry.snapshot.data as InfinitePage<TPage> | undefined;
    if (!current || current.pages.length === 0) return;
    if (fetchingNextRef.current) return;

    const last = current.pages[current.pages.length - 1];
    const param = optionsRef.current.getNextPageParam(last);
    if (param === undefined || param === null) return;

    fetchingNextRef.current = true;
    patchSnapshot(entry, { isLoading: true });
    try {
      const page = await optionsRef.current.queryFn(param);
      const latest = (getEntry(key).snapshot.data as InfinitePage<TPage> | undefined) || current;
      setQueryData<InfinitePage<TPage>>(queryKey, {
        pages: [...latest.pages, page],
        pageParams: [...latest.pageParams, param],
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      patchSnapshot(getEntry(key), { error, isLoading: false });
    } finally {
      fetchingNextRef.current = false;
      patchSnapshot(getEntry(key), { isLoading: false });
    }
  }, [key, queryKey]);

  const refetch = useCallback(async () => {
    await result.refetch();
  }, [result]);

  return {
    pages,
    data: result.data,
    isLoading: result.isLoading,
    isFetchingNextPage: fetchingNextRef.current,
    hasNextPage,
    error: result.error,
    fetchNextPage,
    refetch,
  };
}

interface UseMutationOptions<TData, TVariables, TContext> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables, context: TContext | undefined) => void;
  suppressErrorReport?: boolean;
}

type MutationErrorHandler = (error: Error) => void;

let mutationErrorHandler: MutationErrorHandler | null = null;

export function setMutationErrorHandler(handler: MutationErrorHandler | null) {
  mutationErrorHandler = handler;
}

interface MutateCallOptions<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

interface UseMutationResult<TData, TVariables> {
  mutate: (variables: TVariables, callOptions?: MutateCallOptions<TData>) => void;
  mutateAsync: (variables: TVariables, callOptions?: MutateCallOptions<TData>) => Promise<TData>;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  reset: () => void;
}

export function useMutation<TData, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TVariables, TContext>
): UseMutationResult<TData, TVariables> {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const listenersRef = useRef(new Set<() => void>());
  const stateRef = useRef({ isPending: false, isSuccess: false, isError: false, error: null as Error | null });

  const subscribe = useCallback((onStoreChange: () => void) => {
    listenersRef.current.add(onStoreChange);
    return () => {
      listenersRef.current.delete(onStoreChange);
    };
  }, []);

  const getSnapshot = useCallback(() => stateRef.current, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setState = (next: typeof stateRef.current) => {
    stateRef.current = next;
    listenersRef.current.forEach((cb) => cb());
  };

  const mutateAsync = useCallback(async (variables: TVariables, callOptions?: MutateCallOptions<TData>) => {
    setState({ isPending: true, isSuccess: false, isError: false, error: null });

    let context: TContext | undefined;
    try {
      context = await optionsRef.current.onMutate?.(variables);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState({ isPending: false, isSuccess: false, isError: true, error });
      optionsRef.current.onError?.(error, variables, undefined);
      optionsRef.current.onSettled?.(undefined, error, variables, undefined);
      callOptions?.onError?.(error);
      throw error;
    }

    try {
      const data = await optionsRef.current.mutationFn(variables);
      setState({ isPending: false, isSuccess: true, isError: false, error: null });
      optionsRef.current.onSuccess?.(data, variables, context);
      optionsRef.current.onSettled?.(data, null, variables, context);
      callOptions?.onSuccess?.(data);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState({ isPending: false, isSuccess: false, isError: true, error });
      optionsRef.current.onError?.(error, variables, context);
      optionsRef.current.onSettled?.(undefined, error, variables, context);
      callOptions?.onError?.(error);
      throw error;
    }
  }, []);

  const mutate = useCallback(
    (variables: TVariables, callOptions?: MutateCallOptions<TData>) => {
      mutateAsync(variables, callOptions).catch((error: Error) => {
        const handled = !!optionsRef.current.onError || !!callOptions?.onError;
        if (handled || optionsRef.current.suppressErrorReport) return;
        mutationErrorHandler?.(error);
      });
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setState({ isPending: false, isSuccess: false, isError: false, error: null });
  }, []);

  return {
    mutate,
    mutateAsync,
    isPending: state.isPending,
    isSuccess: state.isSuccess,
    isError: state.isError,
    error: state.error,
    reset,
  };
}

function matchingEntries(queryKey: QueryKey): [string, CacheEntry][] {
  const exact = keyToString(queryKey);
  const prefix = exact.slice(0, -1);
  const matches: [string, CacheEntry][] = [];
  for (const [key, entry] of cache.entries()) {
    if (key === exact || key.startsWith(`${prefix},`)) matches.push([key, entry]);
  }
  return matches;
}

export function invalidateQueries({ queryKey }: { queryKey: QueryKey }) {
  for (const [key, entry] of matchingEntries(queryKey)) {
    entry.fetchedAt = 0;
    if (entry.inFlight) {
      entry.refetchAfterFlight = true;
      continue;
    }
    if (entry.fetcher && entry.subscribers.size > 0) {
      runFetch(key, entry.fetcher).catch(() => {});
    }
  }
}

export function cancelQueries({ queryKey }: { queryKey: QueryKey }) {
  for (const [, entry] of matchingEntries(queryKey)) {
    if (!entry.inFlight) continue;
    entry.latestFetchId += 1;
    entry.inFlight = null;
    entry.refetchAfterFlight = false;
    patchSnapshot(entry, { isLoading: false });
  }
}

export function getQueryData<T>(queryKey: QueryKey): T | undefined {
  const entry = cache.get(keyToString(queryKey));
  return entry ? (entry.snapshot.data as T | undefined) : undefined;
}

export function setQueryData<T>(queryKey: QueryKey, updater: T | ((old: T | undefined) => T)) {
  const key = keyToString(queryKey);
  const entry = getEntry(key);
  const nextData =
    typeof updater === "function" ? (updater as (old: T | undefined) => T)(entry.snapshot.data as T | undefined) : updater;
  entry.fetchedAt = Date.now();
  entry.inFlight = null;
  entry.refetchAfterFlight = false;
  entry.latestFetchId += 1;
  patchSnapshot(entry, { data: nextData, error: null, isLoading: false });
}

export function clear() {
  for (const [key, entry] of cache.entries()) {
    if (entry.gcTimer) clearTimeout(entry.gcTimer);
    entry.gcTimer = null;
    entry.fetchedAt = 0;
    entry.inFlight = null;
    entry.refetchAfterFlight = false;
    entry.latestFetchId += 1;
    if (entry.subscribers.size === 0) {
      cache.delete(key);
      continue;
    }
    patchSnapshot(entry, { data: undefined, error: null, isLoading: false });
  }
}

interface QueryClientLike {
  invalidateQueries: (opts: { queryKey: QueryKey }) => void;
  cancelQueries: (opts: { queryKey: QueryKey }) => void;
  getQueryData: <T>(queryKey: QueryKey) => T | undefined;
  setQueryData: <T>(queryKey: QueryKey, updater: T | ((old: T | undefined) => T)) => void;
  clear: () => void;
}

export function useQueryClient(): QueryClientLike {
  return useMemo(() => ({ invalidateQueries, cancelQueries, getQueryData, setQueryData, clear }), []);
}
