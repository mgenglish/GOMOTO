Exit code: 0
Wall time: 0.5 seconds
Output:
// Paste your restricted public Mapbox token between the quotes below.
const MAPBOX_TOKEN = 'PASTE_YOUR_MAPBOX_TOKEN_HERE';

const speed = document.querySelector('#speed');
const clock = document.querySelector('#clock');
const battery = document.querySelector('#battery');
const rideButton = document.querySelector('#ride-button');
const odometer = document.querySelector('#odometer');
const map = document.querySelector('#map');
const mapStatus = document.querySelector('#map-status');
const destinationForm = document.querySelector('#destination-form');
const destination = document.querySelector('#destination');
const turnArrow = document.querySelector('#turn-arrow');
const turnTitle = document.querySelector('#turn-title');
const turnDetail = document.querySelector('#turn-detail');

let riding = false;
let tripMiles = 0;
let lastPosition;
let weatherLoaded = false;
let lastMapPoint;
let currentPoint;
let routeSteps = [];
let activeStep = 0;

function updateClock() {
  clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
updateClock();
setInterval(updateClock, 1000);

if (navigator.getBattery) navigator.getBattery().then(b => {
  const update = () => battery.textContent = `â–± ${Math.round(b.level * 100)}%`;
  update();
  b.addEventListener('levelchange', update);
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
  currentPoint = { latitude: point.latitude, longitude: point.longitude };
  const mph = Math.max(0, (point.speed || 0) * 2.23694);
  speed.textContent = Math.round(mph);
  if (lastPosition && point.accuracy < 50) tripMiles += kilometresBetween(lastPosition, point) * .621371;
  lastPosition = point;
  odometer.textContent = `TRIP ${tripMiles.toFixed(1)} MI`;
  if (!weatherLoaded) loadWeather(point.latitude, point.longitude);
  updateMap(point.latitude, point.longitude);
  advanceRouteIfNeeded();
}

function updateMap(latitude, longitude) {
  const movedEnough = !lastMapPoint || kilometresBetween(lastMapPoint, { latitude, longitude }) > 0.08;
  if (!movedEnough) return;
  lastMapPoint = { latitude, longitude };
  const edge = 0.008;
  const bbox = [longitude - edge, latitude - edge, longitude + edge, latitude + edge].join(',');
  map.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  mapStatus.textContent = 'YOUR LOCATION';
}

function weatherIcon(code) {
  if (code === 0) return 'â˜€';
  if (code <= 3) return 'â˜';
  if (code <= 48) return 'â˜·';
  if (code <= 67) return 'â˜‚';
  if (code <= 77) return 'â„';
  return 'ÏŸ';
}

async function loadWeather(latitude, longitude) {
  weatherLoaded = true;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
    const response = await fetch(url);
    const data = await response.json();
    const now = data.current;
    document.querySelector('#weather').textContent = `${weatherIcon(now.weather_code)} ${Math.round(now.temperature_2m)}Â°`;
  } catch {
    weatherLoaded = false;
    document.querySelector('#weather').textContent = 'WEATHER --';
  }
}

function turnArrowFor(step) {
  const modifier = step.maneuver.modifier || '';
  if (modifier.includes('left')) return 'â†°';
  if (modifier.includes('right')) return 'â†±';
  if (modifier === 'uturn') return 'â†©';
  return 'â†‘';
}

function distanceLabel(meters) {
  const feet = Math.round(meters * 3.28084);
  if (feet < 1000) return `${feet} FT`;
  return `${(feet / 5280).toFixed(1)} MI`;
}

function showActiveStep() {
  const step = routeSteps[activeStep];
  if (!step) {
    turnArrow.textContent = 'âœ“';
    turnTitle.textContent = 'YOU ARRIVED';
    turnDetail.textContent = 'DESTINATION REACHED';
    return;
  }
  turnArrow.textContent = turnArrowFor(step);
  turnTitle.textContent = (step.maneuver.instruction || 'KEEP GOING').toUpperCase();
  turnDetail.textContent = `${distanceLabel(step.distance)} â€¢ ${activeStep + 1} OF ${routeSteps.length}`;
}

function advanceRouteIfNeeded() {
  const step = routeSteps[activeStep];
  if (!step || !currentPoint || !step.maneuver.location) return;
  const [longitude, latitude] = step.maneuver.location;
  if (kilometresBetween(currentPoint, { latitude, longitude }) < 0.05) {
    activeStep += 1;
    showActiveStep();
  }
}

async function getDirections(place) {
  if (MAPBOX_TOKEN === 'PASTE_YOUR_MAPBOX_TOKEN_HERE') {
    turnTitle.textContent = 'ADD MAPBOX TOKEN';
    turnDetail.textContent = 'TOKEN NEEDS TO BE PASTED INTO APP.JS';
    return;
  }
  if (!currentPoint) {
    turnTitle.textContent = 'START RIDE FIRST';
    turnDetail.textContent = 'WE NEED YOUR LOCATION';
    return;
  }

  turnTitle.textContent = 'FINDING ROUTE';
  turnDetail.textContent = 'ONE MOMENT';
  try {
    const search = new URL('https://api.mapbox.com/search/geocode/v6/forward');
    search.searchParams.set('q', place);
    search.searchParams.set('proximity', `${currentPoint.longitude},${currentPoint.latitude}`);
    search.searchParams.set('limit', '1');
    search.searchParams.set('access_token', MAPBOX_TOKEN);
    const searchData = await (await fetch(search)).json();
    const feature = searchData.features && searchData.features[0];
    if (!feature) throw new Error('Place not found');
    const [destinationLongitude, destinationLatitude] = feature.geometry.coordinates;
    const origin = `${currentPoint.longitude},${currentPoint.latitude}`;
    const destinationPoint = `${destinationLongitude},${destinationLatitude}`;
    const routeUrl = `https://api.mapbox.com/directions/v5/mapbox/cycling/${origin};${destinationPoint}?steps=true&overview=false&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
    const routeData = await (await fetch(routeUrl)).json();
    const steps = routeData.routes && routeData.routes[0] && routeData.routes[0].legs[0].steps;
    if (!steps || steps.length < 1) throw new Error('Route not found');
    routeSteps = steps;
    activeStep = steps.length > 1 ? 1 : 0;
    mapStatus.textContent = `ROUTE TO ${feature.properties.name.toUpperCase()}`;
    showActiveStep();
  } catch {
    turnArrow.textContent = '!';
    turnTitle.textContent = 'ROUTE NOT FOUND';
    turnDetail.textContent = 'TRY A MORE SPECIFIC PLACE';
  }
}

rideButton.addEventListener('click', () => {
  riding = !riding;
  rideButton.textContent = riding ? 'END RIDE' : 'START RIDE';
  if (riding && navigator.geolocation) navigator.geolocation.watchPosition(locationUpdate, () => alert('Please allow location to show speed.'), { enableHighAccuracy: true, maximumAge: 1000 });
  if (riding && navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
});

destinationForm.addEventListener('submit', event => {
  event.preventDefault();
  const place = destination.value.trim();
  if (!place) return;
  destination.blur();
  getDirections(place);
});


