/**
 * IAU 88 星座连线数据 (精简版)
 * 每个星座包含: 主要恒星的 RA/Dec (J2000) 和连线索引对
 * 数据来源: IAU 标准星座连线 (stick figures)
 *
 * 注: 仅包含最常见/明亮的 ~30 个星座的连线数据以保持 bundle 精简
 * 后续可扩展到完整 88 星座
 */

export interface ConstellationStar {
  ra: number; // degrees
  dec: number; // degrees
}

export interface ConstellationDef {
  id: string; // IAU 3-letter abbreviation
  name: string;
  stars: ConstellationStar[];
  lines: [number, number][]; // pairs of star indices
}

/** 精选星座连线数据 */
export const CONSTELLATIONS: ConstellationDef[] = [
  {
    id: "Ori",
    name: "Orion",
    stars: [
      { ra: 88.793, dec: 7.407 }, // 0: Betelgeuse (α)
      { ra: 78.634, dec: -8.202 }, // 1: Rigel (β)
      { ra: 83.858, dec: -1.943 }, // 2: Mintaka (δ)
      { ra: 83.001, dec: -0.299 }, // 3: Alnilam (ε)
      { ra: 81.283, dec: 6.349 }, // 4: Bellatrix (γ)
      { ra: 82.061, dec: -1.203 }, // 5: Alnitak (ζ)
      { ra: 86.939, dec: -9.67 }, // 6: Saiph (κ)
    ],
    lines: [
      [0, 4],
      [4, 2],
      [2, 3],
      [3, 5],
      [5, 1],
      [0, 3],
      [1, 6],
      [6, 5],
    ],
  },
  {
    id: "UMa",
    name: "Ursa Major",
    stars: [
      { ra: 165.46, dec: 61.751 }, // 0: Dubhe (α)
      { ra: 166.003, dec: 56.383 }, // 1: Merak (β)
      { ra: 178.457, dec: 53.695 }, // 2: Phecda (γ)
      { ra: 183.856, dec: 57.033 }, // 3: Megrez (δ)
      { ra: 193.507, dec: 55.96 }, // 4: Alioth (ε)
      { ra: 200.981, dec: 54.926 }, // 5: Mizar (ζ)
      { ra: 206.885, dec: 49.313 }, // 6: Alkaid (η)
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    id: "UMi",
    name: "Ursa Minor",
    stars: [
      { ra: 37.954, dec: 89.264 }, // 0: Polaris (α)
      { ra: 263.054, dec: 86.586 }, // 1: δ
      { ra: 247.555, dec: 86.631 }, // 2: ε
      { ra: 236.015, dec: 77.795 }, // 3: ζ
      { ra: 222.676, dec: 74.156 }, // 4: Kochab (β)
      { ra: 230.182, dec: 71.834 }, // 5: γ
      { ra: 245.066, dec: 75.756 }, // 6: η
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 3],
    ],
  },
  {
    id: "Cas",
    name: "Cassiopeia",
    stars: [
      { ra: 10.127, dec: 56.537 }, // 0: Schedar (α)
      { ra: 2.295, dec: 59.15 }, // 1: Caph (β)
      { ra: 14.177, dec: 60.717 }, // 2: γ
      { ra: 21.454, dec: 60.235 }, // 3: Ruchbah (δ)
      { ra: 28.599, dec: 63.67 }, // 4: ε
    ],
    lines: [
      [1, 0],
      [0, 2],
      [2, 3],
      [3, 4],
    ],
  },
  {
    id: "Cyg",
    name: "Cygnus",
    stars: [
      { ra: 310.358, dec: 45.28 }, // 0: Deneb (α)
      { ra: 305.557, dec: 40.257 }, // 1: Sadr (γ)
      { ra: 292.68, dec: 27.96 }, // 2: Albireo (β)
      { ra: 311.553, dec: 33.97 }, // 3: Gienah (ε)
      { ra: 296.244, dec: 45.131 }, // 4: δ
    ],
    lines: [
      [0, 1],
      [1, 2],
      [4, 1],
      [1, 3],
    ],
  },
  {
    id: "Leo",
    name: "Leo",
    stars: [
      { ra: 152.093, dec: 11.967 }, // 0: Regulus (α)
      { ra: 177.265, dec: 14.572 }, // 1: Denebola (β)
      { ra: 154.993, dec: 19.842 }, // 2: η
      { ra: 168.56, dec: 20.524 }, // 3: Zosma (δ)
      { ra: 170.981, dec: 15.43 }, // 4: θ
      { ra: 146.462, dec: 23.774 }, // 5: μ
      { ra: 148.191, dec: 26.007 }, // 6: ε
      { ra: 154.173, dec: 23.417 }, // 7: ζ
    ],
    lines: [
      [0, 2],
      [2, 7],
      [7, 5],
      [5, 6],
      [7, 3],
      [3, 1],
      [3, 4],
      [4, 0],
    ],
  },
  {
    id: "Sco",
    name: "Scorpius",
    stars: [
      { ra: 247.352, dec: -26.432 }, // 0: Antares (α)
      { ra: 252.166, dec: -19.806 }, // 1: σ
      { ra: 240.083, dec: -22.622 }, // 2: δ
      { ra: 239.713, dec: -26.114 }, // 3: β
      { ra: 245.297, dec: -25.593 }, // 4: π
      { ra: 253.084, dec: -38.048 }, // 5: ε
      { ra: 262.691, dec: -37.104 }, // 6: λ Shaula
      { ra: 263.402, dec: -37.296 }, // 7: υ
      { ra: 258.038, dec: -43.239 }, // 8: κ
    ],
    lines: [
      [3, 2],
      [2, 4],
      [4, 0],
      [0, 1],
      [1, 5],
      [5, 6],
      [6, 7],
      [6, 8],
    ],
  },
  {
    id: "Sgr",
    name: "Sagittarius",
    stars: [
      { ra: 283.816, dec: -26.297 }, // 0: Kaus Australis (ε)
      { ra: 276.993, dec: -25.422 }, // 1: δ
      { ra: 275.249, dec: -29.828 }, // 2: γ
      { ra: 285.653, dec: -29.88 }, // 3: ζ
      { ra: 284.432, dec: -21.024 }, // 4: φ
      { ra: 283.763, dec: -30.424 }, // 5: τ
      { ra: 287.441, dec: -21.742 }, // 6: σ
    ],
    lines: [
      [2, 1],
      [1, 0],
      [0, 3],
      [3, 5],
      [5, 2],
      [0, 4],
      [4, 6],
    ],
  },
  {
    id: "Gem",
    name: "Gemini",
    stars: [
      { ra: 113.65, dec: 31.888 }, // 0: Pollux (β)
      { ra: 116.329, dec: 28.026 }, // 1: Castor (α)
      { ra: 100.983, dec: 25.131 }, // 2: γ
      { ra: 106.027, dec: 20.57 }, // 3: μ
      { ra: 97.241, dec: 22.507 }, // 4: ξ
      { ra: 99.428, dec: 16.399 }, // 5: Alhena (γ)
    ],
    lines: [
      [1, 0],
      [1, 4],
      [4, 2],
      [0, 3],
      [3, 5],
    ],
  },
  {
    id: "Tau",
    name: "Taurus",
    stars: [
      { ra: 68.98, dec: 16.51 }, // 0: Aldebaran (α)
      { ra: 84.411, dec: 21.143 }, // 1: ζ (tip of upper horn)
      { ra: 81.573, dec: 28.608 }, // 2: β (El Nath, tip of lower horn)
      { ra: 67.166, dec: 15.87 }, // 3: θ²
      { ra: 60.17, dec: 12.49 }, // 4: γ
      { ra: 65.734, dec: 17.543 }, // 5: ε
    ],
    lines: [
      [4, 3],
      [3, 0],
      [0, 5],
      [5, 1],
      [5, 2],
    ],
  },
  {
    id: "Aql",
    name: "Aquila",
    stars: [
      { ra: 297.696, dec: 8.868 }, // 0: Altair (α)
      { ra: 286.353, dec: 13.863 }, // 1: Tarazed (γ)
      { ra: 295.024, dec: 10.614 }, // 2: β
      { ra: 296.565, dec: 6.407 }, // 3: ζ
      { ra: 301.318, dec: 1.006 }, // 4: θ
    ],
    lines: [
      [1, 0],
      [0, 4],
      [2, 0],
      [0, 3],
    ],
  },
  {
    id: "Lyr",
    name: "Lyra",
    stars: [
      { ra: 279.235, dec: 38.784 }, // 0: Vega (α)
      { ra: 282.52, dec: 33.363 }, // 1: Sheliak (β)
      { ra: 284.736, dec: 32.689 }, // 2: Sulafat (γ)
      { ra: 283.626, dec: 36.899 }, // 3: δ²
      { ra: 281.085, dec: 37.605 }, // 4: ζ
    ],
    lines: [
      [0, 4],
      [4, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
  {
    id: "Crx",
    name: "Crux",
    stars: [
      { ra: 186.65, dec: -63.099 }, // 0: Acrux (α)
      { ra: 191.93, dec: -59.689 }, // 1: Mimosa (β)
      { ra: 187.791, dec: -57.113 }, // 2: Gacrux (γ)
      { ra: 183.786, dec: -58.749 }, // 3: δ
    ],
    lines: [
      [0, 2],
      [1, 3],
    ],
  },
  {
    id: "And",
    name: "Andromeda",
    stars: [
      { ra: 2.097, dec: 29.091 }, // 0: Alpheratz (α)
      { ra: 17.433, dec: 35.621 }, // 1: Mirach (β)
      { ra: 30.975, dec: 42.33 }, // 2: Almach (γ)
      { ra: 9.832, dec: 30.861 }, // 3: δ
    ],
    lines: [
      [0, 3],
      [3, 1],
      [1, 2],
    ],
  },
  {
    id: "Per",
    name: "Perseus",
    stars: [
      { ra: 51.081, dec: 49.861 }, // 0: Mirfak (α)
      { ra: 47.042, dec: 40.956 }, // 1: Algol (β)
      { ra: 55.731, dec: 47.788 }, // 2: δ
      { ra: 59.463, dec: 40.01 }, // 3: ε
      { ra: 46.199, dec: 53.506 }, // 4: γ
    ],
    lines: [
      [4, 0],
      [0, 2],
      [2, 3],
      [0, 1],
    ],
  },
  {
    id: "Aur",
    name: "Auriga",
    stars: [
      { ra: 79.172, dec: 45.998 }, // 0: Capella (α)
      { ra: 89.882, dec: 44.947 }, // 1: Menkalinan (β)
      { ra: 74.249, dec: 33.166 }, // 2: El Nath (β Tau, shared)
      { ra: 76.629, dec: 41.076 }, // 3: ε
      { ra: 71.167, dec: 41.781 }, // 4: ι
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 4],
      [4, 3],
      [3, 0],
    ],
  },
  {
    id: "Vir",
    name: "Virgo",
    stars: [
      { ra: 201.298, dec: -11.161 }, // 0: Spica (α)
      { ra: 190.415, dec: -1.449 }, // 1: γ Porrima
      { ra: 198.017, dec: -3.655 }, // 2: δ
      { ra: 196.524, dec: 10.959 }, // 3: ε Vindemiatrix
      { ra: 184.976, dec: -0.666 }, // 4: η
    ],
    lines: [
      [0, 2],
      [2, 1],
      [1, 4],
      [2, 3],
    ],
  },
  {
    id: "Peg",
    name: "Pegasus",
    stars: [
      { ra: 346.19, dec: 15.205 }, // 0: Markab (α)
      { ra: 345.944, dec: 28.083 }, // 1: Scheat (β)
      { ra: 3.309, dec: 15.184 }, // 2: Algenib (γ)
      { ra: 2.097, dec: 29.091 }, // 3: Alpheratz (δ = α And)
      { ra: 326.046, dec: 9.875 }, // 4: Enif (ε)
    ],
    lines: [
      [0, 1],
      [1, 3],
      [3, 2],
      [2, 0],
      [0, 4],
    ],
  },
  {
    id: "CMa",
    name: "Canis Major",
    stars: [
      { ra: 101.287, dec: -16.716 }, // 0: Sirius (α)
      { ra: 95.675, dec: -17.956 }, // 1: Mirzam (β)
      { ra: 107.098, dec: -26.393 }, // 2: Wezen (δ)
      { ra: 104.656, dec: -28.972 }, // 3: Adhara (ε)
      { ra: 111.024, dec: -29.303 }, // 4: Aludra (η)
    ],
    lines: [
      [1, 0],
      [0, 2],
      [2, 3],
      [2, 4],
    ],
  },
  {
    id: "CMi",
    name: "Canis Minor",
    stars: [
      { ra: 114.825, dec: 5.225 }, // 0: Procyon (α)
      { ra: 111.788, dec: 8.289 }, // 1: Gomeisa (β)
    ],
    lines: [[0, 1]],
  },
  {
    id: "Ari",
    name: "Aries",
    stars: [
      { ra: 31.793, dec: 23.463 }, // 0: Hamal (α)
      { ra: 28.661, dec: 20.808 }, // 1: Sheratan (β)
      { ra: 27.094, dec: 19.294 }, // 2: γ
    ],
    lines: [
      [2, 1],
      [1, 0],
    ],
  },
  {
    id: "Cep",
    name: "Cepheus",
    stars: [
      { ra: 319.645, dec: 62.586 }, // 0: Alderamin (α)
      { ra: 322.165, dec: 70.561 }, // 1: β
      { ra: 354.837, dec: 77.632 }, // 2: Errai (γ)
      { ra: 340.366, dec: 58.201 }, // 3: ζ
      { ra: 308.303, dec: 58.415 }, // 4: η
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 4],
    ],
  },
  {
    id: "Boo",
    name: "Boötes",
    stars: [
      { ra: 213.915, dec: 19.183 }, // 0: Arcturus (α)
      { ra: 218.02, dec: 38.308 }, // 1: Nekkar (β)
      { ra: 221.247, dec: 27.074 }, // 2: ε
      { ra: 213.01, dec: 27.273 }, // 3: δ
      { ra: 210.956, dec: 25.092 }, // 4: ρ
      { ra: 225.486, dec: 40.391 }, // 5: γ
    ],
    lines: [
      [0, 4],
      [4, 3],
      [3, 1],
      [1, 5],
      [5, 2],
      [2, 0],
    ],
  },
  {
    id: "CrB",
    name: "Corona Borealis",
    stars: [
      { ra: 233.672, dec: 26.715 }, // 0: Alphecca (α)
      { ra: 231.957, dec: 29.106 }, // 1: β
      { ra: 235.686, dec: 26.296 }, // 2: γ
      { ra: 237.74, dec: 26.069 }, // 3: δ
      { ra: 239.397, dec: 26.878 }, // 4: ε
    ],
    lines: [
      [1, 0],
      [0, 2],
      [2, 3],
      [3, 4],
    ],
  },
  {
    id: "Aqr",
    name: "Aquarius",
    stars: [
      { ra: 331.446, dec: -0.32 }, // 0: Sadalsuud (β)
      { ra: 322.89, dec: -5.571 }, // 1: Sadalmelik (α)
      { ra: 335.414, dec: -1.387 }, // 2: δ
      { ra: 340.364, dec: -9.088 }, // 3: λ
      { ra: 339.39, dec: -7.579 }, // 4: η
    ],
    lines: [
      [1, 0],
      [0, 2],
      [2, 4],
      [4, 3],
    ],
  },
];
