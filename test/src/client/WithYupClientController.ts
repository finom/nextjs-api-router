import { post, put, get, del, prefix } from 'vovk';
import { openapi } from 'vovk-openapi';
import { withYup } from 'vovk-yup';
import * as Yup from 'yup';

@prefix('with-yup')
export default class WithYupClientController {
  @post.auto()
  static postWithBodyAndQuery = withYup({
    body: Yup.object({ hello: Yup.string().oneOf(['body']).required() }),
    query: Yup.object({ hey: Yup.string().oneOf(['query']).required() }),
    handle: async (req) => {
      const body = await req.json();
      const hey = req.nextUrl.searchParams.get('hey');
      return { body, query: { hey } };
    },
  });

  @put.auto()
  static putWithBodyAndNullQuery = withYup({
    body: Yup.object({ hello: Yup.string().oneOf(['body']).required() }),
    handle: async (req) => {
      const body = await req.json();
      return { body };
    },
  });

  @del.auto()
  static putWithBodyOnly = withYup({
    body: Yup.object({ hello: Yup.string().oneOf(['body']).required() }),
    handle: async (req) => {
      const body = await req.json();
      return { body };
    },
  });

  @get.auto()
  static getWithQueryAndNullBody = withYup({
    query: Yup.object({ hey: Yup.string().oneOf(['query']).required() }),
    handle: (req) => {
      const hey = req.nextUrl.searchParams.get('hey');
      return { query: { hey } };
    },
  });

  @get('nested-query')
  static getNestedQuery = withYup({
    query: Yup.object().shape({
      x: Yup.string().required(),
      y: Yup.array().of(Yup.string().required()).required(),
      z: Yup.object()
        .shape({
          f: Yup.string().required(),
          u: Yup.array().of(Yup.string().required()).required(),
          d: Yup.object()
            .shape({
              x: Yup.string().required(),
              arrOfObjects: Yup.array()
                .of(
                  Yup.object().shape({
                    foo: Yup.string().required(),
                    nestedArr: Yup.array().of(Yup.string().required()).notRequired(),
                    nestedObj: Yup.object()
                      .shape({
                        deepKey: Yup.string(),
                      })
                      .notRequired(),
                  })
                )
                .required(),
            })
            .required(),
        })
        .required(),
    }),
    handle: (req) => {
      return { query: req.vovk.query(), search: decodeURIComponent(req.nextUrl.search) };
    },
  });

  @openapi({
    summary: 'This is a summary',
  })
  @get('output-and-openapi')
  static outputWithOpenApi = withYup({
    body: Yup.object().shape({
      hello: Yup.string().required(),
    }),
    query: Yup.object().shape({
      hello: Yup.string().required(),
    }),
    handle: (req) => {
      return { hello: req.vovk.query().hello };
    },
  });
}
