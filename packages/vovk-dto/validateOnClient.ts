import { validate } from 'class-validator';
import type { ClassConstructor } from 'class-transformer';
import { HttpException, HttpStatus, type VovkValidateOnClient } from 'vovk';

const validateOnClientDto: VovkValidateOnClient = async (input, validation) => {
  if (validation.body && 'isDTO' in (validation.body as object)) {
    const bodyErrors = await validate(input.body as ClassConstructor<object>);
    if (bodyErrors.length > 0) {
      const err = bodyErrors.map((e) => Object.values(e.constraints || {}).join(', ')).join(', ');
      throw new HttpException(
        HttpStatus.NULL,
        `Validation failed. Invalid request body on client for ${input.endpoint}. ${err}`,
        {
          body: input.body,
          validationErrors: bodyErrors,
          endpoint: input.endpoint,
        }
      );
    }
  }

  if (validation.query && 'isDTO' in (validation.query as object)) {
    const queryErrors = await validate(input.query as ClassConstructor<object>);
    if (queryErrors.length > 0) {
      const err = queryErrors.map((e) => Object.values(e.constraints || {}).join(', ')).join(', ');
      throw new HttpException(
        HttpStatus.NULL,
        `Validation failed. Invalid request query on client for ${input.endpoint}. ${err}`,
        {
          query: input.query,
          validationErrors: queryErrors,
          endpoint: input.endpoint,
        }
      );
    }
  }
};

export default validateOnClientDto;
