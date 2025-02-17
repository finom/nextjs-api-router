import {
  createRPC as originalCreateRPC,
  type HttpException,
  type KnownAny,
  type VovkClientOptions,
  type VovkDefaultFetcherOptions,
  type VovkControllerSchema,
  type VovkClient,
  type VovkReturnType,
  type VovkHandlerSchema,
  type VovkStreamAsyncIterable,
  VovkFullSchema,
  VovkSegmentSchema,
} from 'vovk';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryClient,
} from '@tanstack/react-query';

const withUseQuery = <
  T extends ((arg: KnownAny) => KnownAny) & {
    schema: VovkHandlerSchema;
    controllerSchema: VovkControllerSchema;
    segmentSchema: VovkSegmentSchema;
    fullSchema: VovkFullSchema;
  },
>(
  fn: T
) => {
  return Object.assign(fn, {
    useQuery: (input: Parameters<T>[0], options?: UseQueryOptions<ReturnType<T>>, queryClient?: QueryClient) => {
      queryClient = queryClient ?? useQueryClient();
      const queryKey = [
        fn.segmentSchema.segmentName,
        fn.controllerSchema.prefix,
        fn.controllerSchema.controllerName,
        fn.schema.path,
        fn.schema.httpMethod,
        input,
      ];
      return useQuery(
        {
          queryFn: async () => {
            const result = await fn(input);
            if (Symbol.asyncIterator in result) {
              void (async () => {
                for await (const chunk of result) {
                  queryClient.setQueryData(queryKey, (data: unknown[]) => [...data, chunk]);
                }
              })();

              return [];
            }

            return result;
          },
          queryKey,
          ...options,
        },
        queryClient
      );
    },
    useMutation: (options?: UseMutationOptions<ReturnType<T>>, queryClient?: QueryClient) => {
      return useMutation(
        {
          mutationFn: fn,
          ...options,
        },
        queryClient
      );
    },
  });
};

export function createRPC<T, OPTS extends Record<string, KnownAny> = VovkDefaultFetcherOptions>(
  fullSchema: VovkFullSchema,
  segmentName: string,
  controllerName: string,
  options?: VovkClientOptions<OPTS>
) {
  const rpc = originalCreateRPC<T, OPTS>(fullSchema, segmentName, controllerName, options);

  // TODO Refactor
  type ClientWithQuery = {
    [Key in keyof VovkClient<T, OPTS>]: VovkClient<T, OPTS>[Key] & {
      useQuery: (
        input: Parameters<VovkClient<T, OPTS>[Key]>[0],
        options?: Omit<UseQueryOptions<ReturnType<VovkClient<T, OPTS>[Key]>>, 'queryFn' | 'queryKey'>,
        queryClient?: QueryClient
      ) => VovkReturnType<VovkClient<T, OPTS>[Key]> extends VovkStreamAsyncIterable<infer U>
        ? ReturnType<typeof useQuery<U[], HttpException>>
        : ReturnType<typeof useQuery<VovkReturnType<VovkClient<T, OPTS>[Key]>, HttpException>>;
      useMutation: (
        options?: Omit<UseMutationOptions<ReturnType<VovkClient<T, OPTS>[Key]>>, 'mutationFn'>,
        queryClient?: QueryClient
      ) => ReturnType<
        typeof useMutation<
          VovkReturnType<VovkClient<T, OPTS>[Key]>,
          HttpException,
          Parameters<VovkClient<T, OPTS>[Key]>[0]
        >
      >;
    };
  };

  return Object.fromEntries(
    Object.entries(rpc).map(([key, value]) => [key, withUseQuery(value as KnownAny)])
  ) as unknown as ClientWithQuery;
}
