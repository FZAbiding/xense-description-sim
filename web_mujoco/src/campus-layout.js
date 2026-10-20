import building from '../public/environments/campus/building.json' with { type: 'json' };

// One metric, Z-up layout feeds rendering, MJCF generation and browser routing.
const halfX = Math.max(Math.abs(building.min[0]), Math.abs(building.max[0])) + 0.16;
const halfY = Math.max(Math.abs(building.min[1]), Math.abs(building.max[1])) + 0.16;
export const CAMPUS_BUILDINGS = Object.freeze([
  { id: 'campus-building-nw', x: -8, y: 6, halfX, halfY, height: building.max[2] },
  { id: 'campus-building-ne', x: 8, y: 6, halfX, halfY, height: building.max[2] },
  { id: 'campus-building-sw', x: -8, y: -6, halfX, halfY, height: building.max[2] }
]);
export const CAMPUS_PROPS = Object.freeze([
  { id: 'campus-planter-a', x: 5, y: -4, halfX: 0.65, halfY: 0.65, height: 0.5, kind: 'planter' },
  { id: 'campus-planter-b', x: 11, y: -4, halfX: 0.65, halfY: 0.65, height: 0.5, kind: 'planter' },
  { id: 'campus-charge-post', x: 4.8, y: -8.4, halfX: 0.18, halfY: 0.22, height: 1.1, kind: 'charger' },
  { id: 'campus-delivery-locker', x: 10.5, y: -8.6, halfX: 1, halfY: 0.30, height: 1.6, kind: 'locker' }
]);
export const CAMPUS_LAYOUT = Object.freeze({
  id: 'campus',
  assetVersion: building.version,
  bounds: { minX: -14.5, maxX: 14.5, minY: -11.5, maxY: 11.5 },
  floorHalfSize: [15, 12],
  spawn: { x: -2.45, y: -0.55, yaw: 0 },
  obstacles: [...CAMPUS_BUILDINGS, ...CAMPUS_PROPS],
  charging: { x: 4.8, y: -7.2, yaw: -Math.PI / 2, halfX: 0.7, halfY: 0.7 },
  delivery: { x: 10.5, y: -7.2, yaw: -Math.PI / 2, halfX: 0.8, halfY: 0.7 },
  view: { position: [13, -17, 12], target: [0, 0, 1], near: 0.1, far: 100, environment: 'campus' }
});
