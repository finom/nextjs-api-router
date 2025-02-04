import { QueryClient } from '@tanstack/react-query';
import { it, describe } from 'node:test';
import assert from 'node:assert/strict';
import { VovkReturnType } from 'vovk';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ClientControllerRPC } from '../../../test/node_modules/.vovk-client/compiled.js';
import { JSDOM } from 'jsdom';

describe.skip('useMutation', () => {
  it('Works with useMutation', async () => {
    const dom = new JSDOM();
    global.window = dom.window as unknown as typeof window;
    global.document = dom.window.document;

    const queryClient = new QueryClient();

    const { result } = renderHook(() => {
      return ClientControllerRPC.postWithAll.useMutation({}, queryClient);
    });

    await act(async () => {
      await result.current.mutate({
        params: { hello: 'world' },
        body: { isBody: true },
        query: { simpleQueryParam: 'queryValue' },
      });
    });

    await waitFor(() => {
      assert.equal(result.current.isSuccess, true);
    });

    assert.deepEqual(result.current.data satisfies VovkReturnType<typeof ClientControllerRPC.postWithAll> | undefined, {
      params: { hello: 'world' },
      body: { isBody: true },
      query: { simpleQueryParam: 'queryValue' },
    });
  });
});
