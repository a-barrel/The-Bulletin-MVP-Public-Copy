const METERS_PER_MILE = 1609.34;

const metersToMiles = (meters) => {
  if (!Number.isFinite(meters)) {
    return null;
  }
  return meters / METERS_PER_MILE;
};

const milesToMeters = (miles) => {
  if (!Number.isFinite(miles)) {
    return null;
  }
  return miles * METERS_PER_MILE;
};

module.exports = {
  METERS_PER_MILE,
  metersToMiles,
  milesToMeters
};
