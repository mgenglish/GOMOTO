const speed = document.querySelector('#speed');
const clock = document.querySelector('#clock');
const battery = document.querySelector('#battery');
const rideButton = document.querySelector('#ride-button');
const odometer = document.querySelector('#odometer');
let riding = false;
let tripMiles = 0;
let lastPosition;

function updateClock() {
  clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
updateClock();
setInterval(updateClock, 1000);

if (navigator.getBattery) navigator.getBattery().then(b => {
  const update = () => battery.textContent = `▱ ${Math.round(b.level * 100)}%`;
  update(); b.addEventListener('levelchange', update);
});

function kilometresBetween(a, b) {
  const r = 6371;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function locationUpdate(position) {
  if (!riding) return;
  const point = position.coords;
  const mph = Math.max(0, (point.speed || 0) * 2.23694);
  speed.textContent = Math.round(mph);
  if (lastPosition && point.accuracy < 50) tripMiles += kilometresBetween(lastPosition, point) * .621371;
  lastPosition = point;
  odometer.textContent = `TRIP ${tripMiles.toFixed(1)} MI`;
}

rideButton.addEventListener('click', () => {
  riding = !riding;
  rideButton.textContent = riding ? 'END RIDE' : 'START RIDE';
  if (riding && navigator.geolocation) navigator.geolocation.watchPosition(locationUpdate, () => alert('Please allow location to show speed.'), { enableHighAccuracy: true, maximumAge: 1000 });
  if (riding && navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
});
