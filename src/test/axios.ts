import axios from "axios";

export function setupAxiosMock(mockUrl, responseData, instance) {
  if (!instance) {
    instance = axios;
  }

  if (!(instance.interceptors as any).mocks) {
    (instance.interceptors as any).mocks = {};

    // install our interceptors
    (instance.interceptors as any).request.use((config) => {
      const url = config.url!;
      // Build full URL with params for matching
      let fullUrl = url;
      if (config.params && Object.keys(config.params).length > 0) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(config.params)) {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        }
        const paramStr = params.toString();
        if (paramStr) {
          fullUrl = url + (url.includes('?') ? '&' : '?') + paramStr;
        }
      }

      if ((instance.interceptors as any).mocks[fullUrl]) {
        // if we have set up a mocked response for this url, cancel the actual request with a cancelToken containing our mocked data
        const mockedResponse = (instance.interceptors as any).mocks[fullUrl];
        return {
          ...config,
          cancelToken: new axios.CancelToken((cancel) =>
            cancel({ status: 200, data: mockedResponse } as any)
          ),
        };
      }

      // otherwise proceed with usual request
      return config;
    });

    (instance.interceptors as any).response.use(
      function (response) {
        return response;
      },
      function (error: any) {
        // resolve response with our mocked data
        if (axios.isCancel(error)) {
          return Promise.resolve(error.message);
        }

        // handle all other errors gracefully
        return Promise.reject(error);
      }
    );
  }

  (instance.interceptors as any).mocks[mockUrl] = responseData;
}

export function removeAxiosMock(mockUrl, instance) {
  if (!instance) {
    instance = axios;
  }

  delete ((instance.interceptors as any).mocks || {})[mockUrl];
}
