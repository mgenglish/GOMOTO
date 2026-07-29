// Some iPhones leave GPS speed empty. Add a measured-speed fallback before
// the dashboard starts listening for location updates.
(() => {
  const geo = navigator.geolocation;
  if (!geo || !geo.watchPosition) return;

  const originalWatch = geo.watchPosition.bind(geo);
  geo.watchPosition = (success, error, options) => {
    let lastSample;
    return originalWatch(position => {
      const point = position.coords;
      const now = position.timestamp || Date.now();
      const hasReportedSpeed = Number.isFinite(point.speed) && point.speed > 0;

      if (!hasReportedSpeed && lastSample && point.accuracy < 50) {
        const seconds = (now - lastSample.time) / 1000;
        if (seconds > 0 && seconds <= 15) {
          const lat = (point.latitude - lastSample.latitude) * Math.PI / 180;
          const lon = (point.longitude - lastSample.longitude) * Math.PI / 180;
          const a = Math.sin(lat / 2) ** 2 + Math.cos(lastSample.latitude * Math.PI / 180) * Math.cos(point.latitude * Math.PI / 180) * Math.sin(lon / 2) ** 2;
          const miles = (6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * .621371;
          Object.defineProperty(point, 'speed', { value: (miles / seconds) * 3600 / 2.23694, configurable: true });
        }
      }

      if (point.accuracy < 50) lastSample = { latitude: point.latitude, longitude: point.longitude, time: now };
      success(position);
    }, error, options);
  };
})();
