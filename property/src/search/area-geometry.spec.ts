import {
  MIN_AREA_SPAN_DEGREES,
  nearestFirst,
  withMinimumSpan,
} from './area-geometry';

describe('withMinimumSpan', () => {
  const center = { lat: 11.5, lng: 104.9 };

  it('grows a single point into a small area around it', () => {
    const area = withMinimumSpan(
      { minLat: 11.5, maxLat: 11.5, minLng: 104.9, maxLng: 104.9 },
      center,
    );

    expect(area.maxLat - area.minLat).toBeCloseTo(MIN_AREA_SPAN_DEGREES);
    expect(area.maxLng - area.minLng).toBeCloseTo(MIN_AREA_SPAN_DEGREES);
    expect(area.minLat).toBeLessThan(center.lat);
    expect(area.maxLng).toBeGreaterThan(center.lng);
  });

  it('leaves an area that is already large enough alone', () => {
    const road = {
      minLat: 11.45,
      maxLat: 11.55,
      minLng: 104.85,
      maxLng: 104.95,
    };
    expect(withMinimumSpan(road, center)).toEqual(road);
  });

  it('only grows the side that is too narrow', () => {
    const eastWestRoad = {
      minLat: 11.5,
      maxLat: 11.501,
      minLng: 104.85,
      maxLng: 104.95,
    };
    const area = withMinimumSpan(eastWestRoad, { lat: 11.5005, lng: 104.9 });

    expect(area.minLng).toBe(104.85);
    expect(area.maxLng).toBe(104.95);
    expect(area.maxLat - area.minLat).toBeCloseTo(MIN_AREA_SPAN_DEGREES);
  });
});

describe('nearestFirst', () => {
  it('orders by distance, puts unlocated items last, and keeps the limit', () => {
    const items = [
      { id: 'far', lat: 11.6, lng: 104.9 },
      { id: 'nowhere', lat: null, lng: null },
      { id: 'near', lat: 11.501, lng: 104.9 },
      { id: 'middle', lat: 11.52, lng: 104.9 },
    ];

    expect(
      nearestFirst(items, { lat: 11.5, lng: 104.9 }, 10).map((i) => i.id),
    ).toEqual(['near', 'middle', 'far', 'nowhere']);
    expect(
      nearestFirst(items, { lat: 11.5, lng: 104.9 }, 2).map((i) => i.id),
    ).toEqual(['near', 'middle']);
  });
});
