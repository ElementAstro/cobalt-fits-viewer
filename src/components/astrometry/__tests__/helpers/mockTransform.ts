/**
 * Shared viewer/transform mock factory for astrometry component tests
 */

export function createTransformMock() {
  return {
    imageToScreenPoint: jest.fn(
      (pt: { x: number; y: number }, _transform: unknown, _rw: number, _rh: number) => pt,
    ),
    remapPointBetweenSpaces: jest.fn(
      (pt: { x: number; y: number }, _sw: number, _sh: number, _rw: number, _rh: number) => pt,
    ),
  };
}
