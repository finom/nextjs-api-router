import { createDecorator, HttpStatus } from 'vovk';
import { fromSchema } from './fromSchema';

export const error = createDecorator(null, (status: HttpStatus, message: string) => {
  return (handlerSchema) => {
    return {
      ...handlerSchema,
      openapi: {
        ...handlerSchema?.openapi,
        responses: {
          ...handlerSchema?.openapi?.responses,
          [status]: {
            description: `${status} response`,
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    {
                      $ref: '#/components/schemas/VovkErrorResponse',
                    },
                    {
                      type: 'object',
                      properties: {
                        message: {
                          type: 'string',
                          enum: [
                            message,
                            ...(handlerSchema?.openapi?.responses?.[status]?.content?.['application/json']?.schema
                              ?.allOf?.[1]?.properties?.message?.enum ?? []),
                          ],
                        },
                        statusCode: {
                          type: 'integer',
                          enum: [status],
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };
  };
});

export { fromSchema };
