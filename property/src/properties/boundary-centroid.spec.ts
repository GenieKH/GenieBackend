import { boundaryCentroid } from './boundary-centroid';

describe('boundaryCentroid', () => {
  it('averages the points', () => {
    const points = [
      { lat: 0, lng: 0 },
      { lat: 4, lng: 2 },
    ];

    expect(boundaryCentroid(points)).toEqual({ lat: 2, lng: 1 });
  });

  it('returns null when there is nothing to average', () => {
    expect(boundaryCentroid([])).toBeNull();
    expect(boundaryCentroid(undefined)).toBeNull();
    expect(boundaryCentroid({ lat: 1, lng: 1 })).toBeNull();
  });
});
