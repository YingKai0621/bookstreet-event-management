export interface HeritageProfile {
  id: string; // 'ds-01'
  code: string; // 'DS-01'
  name: string;
  nameEn: string;
  province: string;
  provinceEn: string;
  unescoRecognition?: string;
  category: string;
  categoryEn: string;
  period: string;
  periodEn: string;
  address: string;
  addressEn: string;
  briefDesc: string;
  briefDescEn: string;
  highlights: string[];
  highlightsEn: string[];
  story: string;
  storyEn: string;
  referenceSource: string;
  updatedDate: string;
  image: {
    url: string;
    alt: string;
    source: string;
    license: string;
  };
  mapCoordinates: {
    x: number;
    y: number;
    areaName: string;
  };
}
