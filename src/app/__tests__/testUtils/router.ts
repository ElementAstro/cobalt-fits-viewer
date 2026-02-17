export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};

export const mockSearchParams: Record<string, string | string[] | undefined> = {};

export function setMockSearchParams(next: Record<string, string | string[] | undefined>) {
  Object.keys(mockSearchParams).forEach((key) => delete mockSearchParams[key]);
  Object.assign(mockSearchParams, next);
}

export function resetMockRouter() {
  mockRouter.push.mockReset();
  mockRouter.replace.mockReset();
  mockRouter.back.mockReset();
  mockRouter.canGoBack.mockReset();
  mockRouter.canGoBack.mockReturnValue(true);
  setMockSearchParams({});
}
