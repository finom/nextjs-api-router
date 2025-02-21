import { HttpException } from '../HttpException';
import { HttpStatus, VovkHandlerSchema, VovkValidationType, type KnownAny, type VovkRequest } from '../types';
import { setHandlerSchema } from './setHandlerSchema';

const validationTypes: VovkValidationType[] = ['body', 'query', 'params', 'output', 'iteration'] as const;

export function withValidation<
  T extends (req: KnownAny, params: KnownAny) => KnownAny,
  BODY_MODEL,
  QUERY_MODEL,
  PARAMS_MODEL,
  OUTPUT_MODEL,
  ITERATION_MODEL,
>({
  skipServerSideValidation,
  skipSchemaEmission,
  validateEveryIteration,
  body,
  query,
  params,
  output,
  iteration,
  handle,
  getHandlerSchema,
  validate,
}: {
  skipServerSideValidation?: boolean | VovkValidationType[];
  skipSchemaEmission?: boolean | VovkValidationType[];
  validateEveryIteration?: boolean;
  body?: BODY_MODEL;
  query?: QUERY_MODEL;
  params?: PARAMS_MODEL;
  output?: OUTPUT_MODEL;
  iteration?: ITERATION_MODEL;
  handle: T;
  getHandlerSchema?: (options: {
    skipSchemaEmissionKeys: VovkValidationType[];
  }) => Omit<VovkHandlerSchema, 'httpMethod' | 'path'>;
  validate: (
    data: KnownAny,
    model: NonNullable<BODY_MODEL | QUERY_MODEL | PARAMS_MODEL | OUTPUT_MODEL | ITERATION_MODEL>,
    meta: {
      type: VovkValidationType;
      req: VovkRequest<KnownAny, KnownAny>;
      status?: number;
    }
  ) => KnownAny;
}) {
  const skipServerSideValidationKeys =
    skipServerSideValidation === false
      ? []
      : skipServerSideValidation === true
        ? validationTypes
        : (skipServerSideValidation ?? []);
  const skipSchemaEmissionKeys =
    skipSchemaEmission === false ? [] : skipSchemaEmission === true ? validationTypes : (skipSchemaEmission ?? []);
  const outputHandler = async (req: VovkRequest<KnownAny, KnownAny>, handlerParams: Parameters<T>[1]) => {
    const data = await handle(req, handlerParams);
    if (output && iteration) {
      throw new HttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "Output and iteration are mutually exclusive. You can't use them together."
      );
    }

    if (output && !skipServerSideValidationKeys.includes('output')) {
      if (!data) {
        throw new HttpException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          'Output is required. You probably forgot to return something from your handler.'
        );
      }
      await validate(data, output, { type: 'output', req });
    }

    if (iteration && !skipServerSideValidationKeys.includes('iteration')) {
      // We assume `data` is an async iterable here; you might want to check that:
      if (!data || typeof data[Symbol.asyncIterator] !== 'function') {
        throw new HttpException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          'Data is not an async iterable but iteration validation is defined.'
        );
      }

      // Return a brand-new async generator that yields validated items
      return (async function* () {
        let i = 0;
        for await (const item of data) {
          if (validateEveryIteration || i === 0) {
            await validate(item, iteration, { type: 'iteration', req, status: 200 });
          }
          i++;
          yield item;
        }
      })();
    } else if (validateEveryIteration) {
      throw new HttpException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'validateEveryIteration is set but iteration is not defined.'
      );
    }

    return data;
  };

  const resultHandler = async (req: VovkRequest<KnownAny, KnownAny>, handlerParams: Parameters<T>[1]) => {
    if (body && !skipServerSideValidationKeys.includes('body')) {
      const data = await req.json();
      const instance = (await validate(data, body, { type: 'body', req })) ?? data;

      // redeclare to add ability to call req.json() again
      req.json = () => Promise.resolve(data);
      req.vovk.body = () => Promise.resolve(instance);
    }

    if (query && !skipServerSideValidationKeys.includes('query')) {
      const data = req.vovk.query();
      const instance = (await validate(data, query, { type: 'query', req })) ?? data;
      req.vovk.query = () => instance;
    }

    if (params && !skipServerSideValidationKeys.includes('params')) {
      const data = req.vovk.params();
      const instance = (await validate(data, params, { type: 'params', req })) ?? data;
      req.vovk.params = () => instance;
    }

    return outputHandler(req, handlerParams);
  };

  if (getHandlerSchema) {
    setHandlerSchema(resultHandler, getHandlerSchema({ skipSchemaEmissionKeys }));
  }

  return resultHandler as T;
}
