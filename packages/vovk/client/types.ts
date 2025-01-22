import type {
  KnownAny,
  HttpMethod,
  ControllerStaticMethod,
  VovkControllerBody,
  VovkControllerQuery,
  VovkControllerParams,
} from '../types';
import type { StreamJSONResponse } from '../StreamJSONResponse';
import type { NextResponse } from 'next/server';

// https://www.totaltypescript.com/concepts/the-prettify-helper
type Prettify<T> = {
  [K in keyof T]: T[K];
} & unknown;

type ToPromise<T> = T extends PromiseLike<unknown> ? T : Promise<T>;

type NonUndefined<T> = {
  [K in keyof T as T[K] extends undefined ? never : K]: T[K];
};

export type StaticMethodInput<T extends ControllerStaticMethod> = NonUndefined<
  Prettify<
  (VovkControllerBody<T> extends undefined | void
    ? { body?: undefined }
    : VovkControllerBody<T> extends null
      ? { body?: null }
      : { body: VovkControllerBody<T> }) &
    (VovkControllerQuery<T> extends undefined | void ? { query?: undefined } : { query: VovkControllerQuery<T> }) &
    (VovkControllerParams<T> extends undefined | void ? { params?: undefined } : { params: VovkControllerParams<T> })
  >
>;

export type StreamAsyncIterator<T> = {
  status: number;
  [Symbol.dispose](): Promise<void> | void;
  [Symbol.asyncDispose](): Promise<void> | void;
  [Symbol.asyncIterator](): AsyncIterator<T>;
  cancel: () => Promise<void> | void;
};

type StaticMethodReturn<T extends ControllerStaticMethod> =
  ReturnType<T> extends NextResponse<infer U> | Promise<NextResponse<infer U>>
    ? U
    : ReturnType<T> extends Response | Promise<Response>
      ? Awaited<ReturnType<T>>
      : ReturnType<T>;

type StaticMethodReturnPromise<T extends ControllerStaticMethod> = ToPromise<StaticMethodReturn<T>>;

type FilterNonMatching<T> = T extends { body?: object; query?: object; params?: object }
  ? never
  : T;

type ClientMethod<
  T extends (...args: KnownAny[]) => void | object | StreamJSONResponse<STREAM> | Promise<StreamJSONResponse<STREAM>>,
  OPTS extends Record<string, KnownAny>,
  STREAM extends KnownAny = unknown,
> = <R>(
  options: FilterNonMatching<Prettify<(StaticMethodInput<T> extends { body?: undefined | null; query?: undefined; params?: undefined }
    ? unknown
    : Parameters<T>[0] extends void
      ? StaticMethodInput<T> extends { params: object }
        ? { params: StaticMethodInput<T>['params'] }
        : unknown
      : StaticMethodInput<T>) &
    (Partial<
      OPTS & {
        transform: (staticMethodReturn: Awaited<StaticMethodReturn<T>>) => R;
      }
    >)>>
) => ReturnType<T> extends
  | Promise<StreamJSONResponse<infer U>>
  | StreamJSONResponse<infer U>
  | Iterator<infer U>
  | AsyncIterator<infer U>
  ? Promise<StreamAsyncIterator<U>>
  : R extends object
    ? Promise<R>
    : StaticMethodReturnPromise<T>;

type OmitNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};

type VovkClientWithNever<T, OPTS extends { [key: string]: KnownAny }> = {
  [K in keyof T]: T[K] extends (...args: KnownAny) => KnownAny ? ClientMethod<T[K], OPTS> : never;
};

export type VovkClient<T, OPTS extends { [key: string]: KnownAny }> = OmitNever<VovkClientWithNever<T, OPTS>>;

export type VovkClientFetcher<OPTS extends Record<string, KnownAny> = Record<string, never>, T = KnownAny> = (
  options: {
    name: keyof T;
    httpMethod: HttpMethod;
    getEndpoint: (data: {
      apiRoot: string;
      params: { [key: string]: string };
      query: { [key: string]: string };
    }) => string;
    validate: (input: { body?: unknown; query?: unknown; endpoint: string }) => void | Promise<void>;
    defaultStreamHandler: (response: Response) => Promise<StreamAsyncIterator<unknown>>;
    defaultHandler: (response: Response) => Promise<unknown>;
  },
  input: Prettify<{
    body: unknown;
    query: { [key: string]: string };
    params: { [key: string]: string };
  } & OPTS>
) => KnownAny;

// `RequestInit` is the type of options passed to fetch function
export interface VovkDefaultFetcherOptions extends Omit<RequestInit, 'body' | 'method'> {
  reactNative?: { textStreaming: boolean };
  apiRoot?: string;
  segmentName?: string;
  disableClientValidation?: boolean;
  validateOnClient?: VovkValidateOnClient;
  fetcher?: VovkClientFetcher;
}

export type VovkValidateOnClient = (
  input: { body?: unknown; query?: unknown; endpoint: string },
  validators: { body?: unknown; query?: unknown }
) => void | Promise<void>;

export type VovkClientOptions<OPTS extends Record<string, KnownAny> = Record<string, never>> = {
  fetcher?: VovkClientFetcher<OPTS>;
  validateOnClient?: VovkValidateOnClient;
  defaultOptions?: Partial<OPTS>;
};
