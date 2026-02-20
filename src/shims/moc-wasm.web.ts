class MockMoc {
  static fromCoo(): MockMoc {
    return new MockMoc();
  }

  toFits(): Uint8Array {
    return new Uint8Array();
  }
}

export const MOC = MockMoc;
