// NOAA's approximate solar position, evaluated in UTC so the visitor's time
// zone never changes the light in Tokyo. https://gml.noaa.gov/grad/solcalc/solareqns.PDF
export function tokyoDaylight(date = new Date()) {
  const year = date.getUTCFullYear();
  const day = (Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - Date.UTC(year, 0, 0)) / 86400000;
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const days = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  const g = 2 * Math.PI / days * (day - 1 + (hour - 12) / 24);
  const equation = 229.18 * (.000075 + .001868 * Math.cos(g) - .032077 * Math.sin(g) - .014615 * Math.cos(2 * g) - .040849 * Math.sin(2 * g));
  const declination = .006918 - .399912 * Math.cos(g) + .070257 * Math.sin(g) - .006758 * Math.cos(2 * g) + .000907 * Math.sin(2 * g) - .002697 * Math.cos(3 * g) + .00148 * Math.sin(3 * g);
  const solarMinutes = ((hour * 60 + equation + 4 * 139.6503) % 1440 + 1440) % 1440;
  const angle = (solarMinutes / 4 - 180) * Math.PI / 180;
  const latitude = 35.6762 * Math.PI / 180;
  const elevation = Math.asin(Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(angle)) * 180 / Math.PI;
  const phase = elevation < -6 ? 'night' : elevation < 10 ? angle < 0 ? 'dawn' : 'dusk' : 'day';
  const t = Math.max(0, Math.min(1, (elevation + 6) / 26));
  return { phase, elevation, daylight: t * t * (3 - 2 * t) };
}
