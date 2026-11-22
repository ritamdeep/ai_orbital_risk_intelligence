import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSubSolarPoint,
  computeSunDirectionVector,
  latLonRadiusToCartesian,
  trueScaleRadius,
} from './solarPosition.ts';

describe('solarPosition astronomical utility', () => {
  it('places the sun near +23.44 deg latitude on the June solstice', () => {
    const juneSolstice = new Date('2026-06-21T12:00:00Z');
    const sub = computeSubSolarPoint(juneSolstice);
    assert.ok(sub.latitudeDeg > 22.5 && sub.latitudeDeg <= 23.5, `Unexpected lat: ${sub.latitudeDeg}`);
    assert.ok(Math.abs(sub.longitudeDeg) < 2.0, `Expected near Prime Meridian at 12:00 UTC, got ${sub.longitudeDeg}`);
  });

  it('places the sun near -23.44 deg latitude on the December solstice', () => {
    const decSolstice = new Date('2026-12-21T12:00:00Z');
    const sub = computeSubSolarPoint(decSolstice);
    assert.ok(sub.latitudeDeg < -22.5 && sub.latitudeDeg >= -23.5, `Unexpected lat: ${sub.latitudeDeg}`);
  });

  it('places the sun near the equator on the March equinox and near +90E at 06:00 UTC', () => {
    const marchEquinox = new Date('2026-03-21T06:00:00Z');
    const sub = computeSubSolarPoint(marchEquinox);
    assert.ok(Math.abs(sub.latitudeDeg) < 2.0, `Expected near equator, got ${sub.latitudeDeg}`);
    assert.ok(sub.longitudeDeg > 86 && sub.longitudeDeg < 94, `Expected near +90E, got ${sub.longitudeDeg}`);
  });

  it('returns a unit-length sun direction vector aligned with Three.js SphereGeometry', () => {
    const v = computeSunDirectionVector(new Date('2026-03-21T12:00:00Z'));
    const len = Math.hypot(v.x, v.y, v.z);
    assert.ok(Math.abs(len - 1.0) < 1e-6, `Expected unit vector, got length ${len}`);
    // At equinox 12:00 UTC, sun is near Prime Meridian (+X axis)
    assert.ok(v.x > 0.98, `Expected +X pointing toward Prime Meridian, got x=${v.x}`);
  });

  it('computes true-scale orbital radius (6371 + alt) / 6371 and Earth-fixed coordinates', () => {
    assert.equal(trueScaleRadius(0), 1.0);
    assert.ok(Math.abs(trueScaleRadius(637.1) - 1.1) < 1e-6);

    const northPole = latLonRadiusToCartesian(90, 0, 1.0);
    assert.ok(Math.abs(northPole.y - 1.0) < 1e-6);
    assert.ok(Math.abs(northPole.x) < 1e-6 && Math.abs(northPole.z) < 1e-6);

    const indiaEq = latLonRadiusToCartesian(0, 90, 1.0);
    assert.ok(Math.abs(indiaEq.z + 1.0) < 1e-6, '90E should lie on -Z in Three.js SphereGeometry');
  });
});
