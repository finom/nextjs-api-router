import z, { type ZodSchema } from 'zod';
import { setClientValidatorsForHandler, HttpException, HttpStatus, type VovkRequest, type KnownAny } from 'vovk';
import zodToJsonSchema from 'zod-to-json-schema';

type VovkRequestWithOptionalZod<
  ZOD_BODY extends ZodSchema | null = null,
  ZOD_QUERY extends ZodSchema | null = null,
> = VovkRequest<
  ZOD_BODY extends ZodSchema ? z.infer<ZOD_BODY> : never,
  ZOD_QUERY extends ZodSchema ? z.infer<ZOD_QUERY> : undefined
>;
function withZod<
  T extends (req: REQ, params: KnownAny) => KnownAny,
  ZOD_BODY extends ZodSchema<unknown> | null,
  ZOD_QUERY extends ZodSchema<Record<string, KnownAny> | undefined> | null = ZodSchema<undefined>,
  REQ extends VovkRequestWithOptionalZod<ZOD_BODY, ZOD_QUERY> = VovkRequestWithOptionalZod<ZOD_BODY, ZOD_QUERY>,
>(
  bodyModel: ZOD_BODY,
  queryModel: ZOD_QUERY | null,
  givenHandler: T
): (req: REQ, params: Parameters<T>[1]) => ReturnType<T>;
function withZod<
  T extends (req: REQ, params: KnownAny) => KnownAny,
  ZOD_BODY extends ZodSchema<unknown> | null,
  ZOD_QUERY extends ZodSchema<Record<string, KnownAny> | undefined> | null = ZodSchema<undefined>,
  REQ extends VovkRequestWithOptionalZod<ZOD_BODY, ZOD_QUERY> = VovkRequestWithOptionalZod<ZOD_BODY, ZOD_QUERY>,
>(bodyModel: ZOD_BODY, givenHandler: T): (req: REQ, params: Parameters<T>[1]) => ReturnType<T>;
function withZod<
  T extends (req: REQ, params: KnownAny) => KnownAny,
  ZOD_BODY extends ZodSchema<unknown> | null,
  ZOD_QUERY extends ZodSchema<Record<string, KnownAny> | undefined> | null = ZodSchema<undefined>,
  REQ extends VovkRequestWithOptionalZod<ZOD_BODY, ZOD_QUERY> = VovkRequestWithOptionalZod<ZOD_BODY, ZOD_QUERY>,
>(bodyModel: ZOD_BODY, queryModel: ZOD_QUERY | null | T, givenHandler?: T) {
  if (typeof queryModel === 'function') {
    return withZod<T, ZOD_BODY, ZOD_QUERY, REQ>(bodyModel, null, queryModel);
  }

  const h = async (req: REQ, params: Parameters<T>[1]) => {
    if (bodyModel) {
      const body: unknown = await req.json();
      try {
        bodyModel.parse(body);
      } catch (e) {
        const err = (e as z.ZodError).errors.map((er) => `${er.message} (${er.path.join('/')})`).join(', ');
        throw new HttpException(
          HttpStatus.BAD_REQUEST,
          `Zod validation failed. Invalid request body on server for ${req.url}. ${err}`
        );
      }
      // redeclare to add ability to call req.json() again
      req.json = () => Promise.resolve(body as ZOD_BODY extends ZodSchema ? z.infer<ZOD_BODY> : never);
    }

    if (queryModel) {
      const query = req.vovk.query();

      try {
        queryModel.parse(query);
      } catch (e) {
        const err = (e as z.ZodError).errors.map((er) => `${er.message} (${er.path.join('/')})`).join(', ');
        throw new HttpException(
          HttpStatus.BAD_REQUEST,
          `Zod validation failed. Invalid request query on server for ${req.url}. ${err}`
        );
      }
    }

    return givenHandler!(req, params) as unknown;
  };

  void setClientValidatorsForHandler(h, {
    body: bodyModel ? zodToJsonSchema(bodyModel) : undefined,
    query: queryModel ? zodToJsonSchema(queryModel) : undefined,
  });

  return h as (req: REQ, params: Parameters<T>[1]) => ReturnType<T>;
}

export { withZod };
