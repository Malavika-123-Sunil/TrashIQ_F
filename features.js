// Feature Modal Functions
let monitoringInterval = null;
let isStoppedManually = false;
let hasSpoken = false;
let isSystemStopped = false;  // 🔴 MASTER SWITCH


let speechBlocked = false;


document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('.feature-modal').forEach(modal => {
    modal.style.display = 'none';
  });

  // Clean and deterministic modal triggers.
  document.querySelectorAll(".feature-card[data-feature]").forEach((card) => {
    card.addEventListener("click", () => {
      const feature = card.dataset.feature;
      if (feature) {
        openFeatureModal(feature);
      }
    });
  });

  const generateRouteBtn = document.getElementById("generate-route-btn");
  if (generateRouteBtn) {
    generateRouteBtn.addEventListener("click", generateRoute);
  }

  const routeModalClose = document.getElementById("route-modal-close");
  if (routeModalClose) {
    routeModalClose.addEventListener("click", () => closeFeatureModal("route"));
  }

  const routeModalEl = document.getElementById("modal-route");
  if (routeModalEl) {
    routeModalEl.addEventListener("click", (event) => {
      if (event.target === routeModalEl) {
        closeFeatureModal("route");
      }
    });
  }

  setupRouteAutocomplete();
});

// Bounding box around Thodiyoor (lon_min, lat_min, lon_max, lat_max).
// Wide enough to cover Karunagappally / surrounding Kollam district places.
const ROUTE_VIEWBOX = "76.30,8.70,76.95,9.45";

// Locations the user has explicitly picked from the autocomplete dropdown.
// Keyed by the lowercased label so generateRoute() can use the exact lat/lng
// instead of re-geocoding (which is what caused "Location not found").
const pickedRouteStops = new Map();

// Live autocomplete for the route input — queries Nominatim, biased around Thodiyoor.
function setupRouteAutocomplete() {
  const input = document.getElementById("destination-input");
  const dropdown = document.getElementById("route-suggestions");
  if (!input || !dropdown) return;

  let debounceTimer = null;
  let lastQuery = "";
  let activeRequest = null;

  // Returns the chunk currently being edited (text after the last comma).
  function currentChunk() {
    const value = input.value;
    const lastComma = value.lastIndexOf(",");
    return {
      prefix: lastComma >= 0 ? value.slice(0, lastComma + 1) : "",
      typing: (lastComma >= 0 ? value.slice(lastComma + 1) : value).trimStart()
    };
  }

  function hideDropdown() {
    dropdown.style.display = "none";
    dropdown.innerHTML = "";
  }

  // Build a unique label so two places with the same name (e.g. two "Kayam"s)
  // don't collide when the user picks them.
  function buildLabel(item) {
    const parts = (item.context || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => p.toLowerCase() !== item.name.toLowerCase());
    const distinguisher = parts[0] || parts[1] || "";
    return distinguisher ? `${item.name}, ${distinguisher}` : item.name;
  }

  function renderSuggestions(items) {
    if (!items.length) {
      hideDropdown();
      return;
    }
    dropdown.innerHTML = "";
    items.forEach((item) => {
      const label = buildLabel(item);
      const row = document.createElement("div");
      row.style.cssText =
        "padding:10px 12px; cursor:pointer; border-bottom:1px solid #f3f4f6; font-size:0.9rem; color:#1f2937; display:flex; flex-direction:column; gap:2px;";
      row.innerHTML = `
        <span style="font-weight:600;">${escapeHtml(item.name)}</span>
        <span style="color:#6b7280; font-size:0.78rem;">${escapeHtml(item.context)}</span>
      `;
      row.addEventListener("mouseenter", () => (row.style.background = "#f9fafb"));
      row.addEventListener("mouseleave", () => (row.style.background = "#fff"));
      // Use mousedown so the click registers before the input's blur hides the dropdown.
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const { prefix } = currentChunk();
        const sep = prefix && !prefix.endsWith(" ") ? " " : "";
        input.value = `${prefix}${sep}${label}`;
        // Cache exact coordinates so generateRoute() doesn't have to re-geocode.
        pickedRouteStops.set(label.toLowerCase(), {
          label,
          lat: item.lat,
          lng: item.lng,
          displayName: item.displayName
        });
        hideDropdown();
        input.focus();
      });
      dropdown.appendChild(row);
    });
    dropdown.style.display = "block";
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  async function fetchSuggestions(query) {
    if (activeRequest) activeRequest.abort();
    const controller = new AbortController();
    activeRequest = controller;

    const url =
      "https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6" +
      "&countrycodes=in" +
      `&viewbox=${ROUTE_VIEWBOX}&q=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((d) => {
        const a = d.address || {};
        const main =
          a.road || a.neighbourhood || a.suburb || a.village || a.town || a.city ||
          (d.display_name || "").split(",")[0];
        const ctx = [a.suburb, a.village, a.town, a.city, a.county, a.state]
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .slice(0, 3)
          .join(", ");
        return {
          name: main || query,
          context: ctx || (d.display_name || "").split(",").slice(1, 4).join(",").trim(),
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
          displayName: d.display_name
        };
      });
    } catch (err) {
      if (err.name === "AbortError") return null;
      console.error("Autocomplete error:", err);
      return [];
    }
  }

  input.addEventListener("input", () => {
    const { typing } = currentChunk();
    clearTimeout(debounceTimer);

    if (typing.length < 2) {
      hideDropdown();
      return;
    }

    debounceTimer = setTimeout(async () => {
      if (typing === lastQuery) return;
      lastQuery = typing;
      const items = await fetchSuggestions(typing);
      if (items === null) return;
      renderSuggestions(items);
    }, 300);
  });

  input.addEventListener("focus", () => {
    if (dropdown.children.length) dropdown.style.display = "block";
  });

  input.addEventListener("blur", () => {
    setTimeout(hideDropdown, 150);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideDropdown();
  });
}



// 🔴 OVERRIDE GLOBAL SPEAK FUNCTION
const originalSpeak = speechSynthesis.speak.bind(speechSynthesis);

speechSynthesis.speak = function(utterance) {
  if (speechBlocked) {
    console.log("🚫 Speech blocked");
    return;
  }
  originalSpeak(utterance);
};


function openFeatureModal(feature) {
    document.querySelectorAll('.feature-modal').forEach(modal => {
        modal.classList.remove('active');
        modal.style.display = 'none';
    });

    const modal = document.getElementById(`modal-${feature}`);
    if (!modal) {
        console.error("Modal not found:", feature);
        return;
    }

    modal.style.display = 'flex';
    if (feature === 'route') {
        modal.style.alignItems = 'flex-start';
        modal.style.justifyContent = 'center';
    }
    modal.classList.add('active');

    // Prevent page scroll
    document.body.style.overflow = 'hidden';

    // Initialize feature
    switch(feature) {

        case 'monitoring':
            initializeMonitoring();
            break;

        case 'alerts':
            initializeAlerts();
            break;

        case 'route':
            setTimeout(() => {
                const mapContainer = document.getElementById('route-map');
                if (mapContainer && mapContainer.offsetParent !== null) {
                    initializeRouteMap();
                    if (routeMap) {
                        routeMap.invalidateSize();
                    }
                }
            }, 300);

            break;

        case 'reports':
            console.log("Reports clicked");
            break;

        case 'security':
            console.log("Security clicked");
            break;

        case 'analytics':
            console.log("Analytics clicked");
            break;

        default:
            console.log("No function for:", feature);
    }
}
function closeFeatureModal(feature) {

    const modal = document.getElementById(`modal-${feature}`);

    if (modal) {
        modal.style.display = 'none';
    }

    document.body.style.overflow = 'auto';

    // Destroy old Leaflet map
    if (feature === 'route' && routeMap !== null) {

        routeMap.remove();
        routeMap = null;

    }
}
  
  // Close modal when clicking outside (uses listener so it can't override others)
  document.addEventListener('click', function(event) {
    const target = event.target;
    if (target && target.classList && target.classList.contains('feature-modal')) {
      target.style.display = 'none';
      target.classList.remove('active');
      document.body.style.overflow = 'auto';
    }
  });
  
  // Real-Time Monitoring - Update bin levels based on distance
  function updateBinLevel(distance) {
    if (isSystemStopped) return;
    const distanceValue = document.getElementById('distance-value');
    distanceValue.textContent = distance + ' cm';
    
    // Calculate bin level based on distance
    // If gap is too much (far) = 0%, medium distance = 50%, close = 100%
    let level1, level2, level3;
    let status1, status2, status3;
    
    if (distance > 150) {
      // Too far - bin is empty
      level1 = level2 = level3 = 0;
      status1 = status2 = status3 = 'Empty';
    } else if (distance > 80) {
      // Medium distance - bin is medium
      level1 = 45;
      level2 = 63;
      level3 = 52;
      status1 = status2 = status3 = 'Medium';
    } else {
      // Close - bin is full
      level1 = 88;
      level2 = 91;
      level3 = 85;
      status1 = 'Critical';
      status2 = 'Critical';
      status3 = 'Warning';
    }
    
    // Update bin 1
    updateBinDisplay('bin1', level1, status1);
    // Update bin 2
    updateBinDisplay('bin2', level2, status2);
    // Update bin 3
    updateBinDisplay('bin3', level3, status3);
    
    // Check if any bin is critical and trigger alert
    if (isSystemStopped) return;

if ((level1 >= 80 || level2 >= 80 || level3 >= 80)  && !isStoppedManually && !hasSpoken) {
  triggerAlert();
  hasSpoken = true;
}

if (level1 < 80 && level2 < 80 && level3 < 80) {
  hasSpoken = false;
}

  }
  
  function updateBinDisplay(binId, level, status) {
    const levelBar = document.getElementById(`${binId}-level`);
    const percentText = document.getElementById(`${binId}-percent`);
    const statusText = document.getElementById(`${binId}-status`);
    
    levelBar.style.width = level + '%';
    percentText.textContent = level + '%';
    statusText.textContent = 'Status: ' + status;
    
    // Update color based on level
    if (level >= 80) {
      levelBar.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
      statusText.style.color = '#ef4444';
    } else if (level >= 50) {
      levelBar.style.background = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
      statusText.style.color = '#f59e0b';
    } else {
      levelBar.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
      statusText.style.color = '#10b981';
    }
  }
  
  function initializeMonitoring() {
    // Start with default values
    const slider = document.getElementById('distance-slider');
    if (slider) {
      updateBinLevel(slider.value);
      
      // Simulate real-time updates
      monitoringInterval = setInterval(() => {
        const currentValue = parseInt(slider.value);
        // Randomly adjust distance slightly for simulation
        const newValue = Math.max(0, Math.min(200, currentValue + (Math.random() * 20 - 10)));
        slider.value = newValue;
        updateBinLevel(newValue);
      }, 3000);
    }
  }
  
  // Smart Analytics Chatbot
  const chatbotResponses = {
    'hello': 'Hello! How can I help you with waste management analytics?',
    'hi': 'Hi! I can help you with collection data, efficiency metrics, and route optimization.',
    'efficiency': 'Current collection efficiency is 85%. We can optimize routes to improve this.',
    'bins': 'We are currently monitoring 24 bins across Thodiyoor Panchayat.',
    'collection': 'Average collection time is 2.5 hours. Peak collection time is 8-10 AM.',
    'report': 'You can view daily, weekly, and monthly reports in the Reports section.',
    'route': 'Optimized routes can reduce collection time by up to 30%. Check Route Optimization.',
    'help': 'I can help with: efficiency metrics, bin status, collection times, reports, and route optimization.',
    'default': 'I understand you\'re asking about waste management. Could you be more specific? I can help with efficiency, bins, collections, reports, or routes.'
  };
  
  function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim().toLowerCase();
    
    if (!message) return;
    
    // Add user message
    addChatMessage(message, 'user');
    
    // Find response
    let response = chatbotResponses['default'];
    for (const key in chatbotResponses) {
      if (message.includes(key)) {
        response = chatbotResponses[key];
        break;
      }
    }
    
    // Add bot response after delay
    setTimeout(() => {
      addChatMessage(response, 'bot');
    }, 500);
    
    input.value = '';
  }
  
  function handleChatEnter(event) {
    if (event.key === 'Enter') {
      sendChatMessage();
    }
  }
  
  function addChatMessage(text, sender) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;
    messageDiv.innerHTML = `<p>${text}</p>`;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // Automated Alerts
  let alertsEnabled = false;
  let alertInterval = null;
  
  function initializeAlerts() {
    // Check for critical bins and show alerts
    checkCriticalBins();
  }
  
  function toggleAlerts() {
    alertsEnabled = !alertsEnabled;
    const toggleBtn = document.getElementById('alert-toggle');
    
    if (alertsEnabled) {
      toggleBtn.textContent = 'Disable Alerts';
      toggleBtn.style.background = '#ef4444';
      isStoppedManually = false;
      startAlertMonitoring();
    } else {
      toggleBtn.textContent = 'Enable Alerts';
      toggleBtn.style.background = '#10b981';
      isStoppedManually = false;
      stopAlertMonitoring();
    }
  }
  
  function startAlertMonitoring() {
    alertInterval = setInterval(() => {
      checkCriticalBins();
    }, 5000); // Check every 5 seconds
  }
  
 function stopAlertMonitoring() {

  isStoppedManually = true;
  speechSynthesis.cancel();
  alertsEnabled = false;
  isStoppedManually = true;

// 🔥 STOP ALL POSSIBLE LOOPS
clearInterval(alertInterval);
clearInterval(monitoringInterval);

speechSynthesis.cancel();
  
  if (alertInterval) {
    clearInterval(alertInterval);
    alertInterval = null;
  }
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
}

  alertsEnabled = false;   // 🔴 THIS IS THE MAIN FIX

  alertActive = false;
  isSpeaking = false;

  speechSynthesis.cancel();
  document.getElementById('alert-toggle').textContent = 'Enable Alerts';
  document.getElementById('alert-toggle').style.background = '#10b981';
}
  
  function checkCriticalBins() {

  if (!alertsEnabled) return;   // 🔴 ADD THIS LINE (CRITICAL)

  const criticalBins = [
    { id: 'Bin-01', location: 'Street A', level: 88 },
    { id: 'Bin-03', location: 'Bus Stop', level: 91 }
  ];

  if (isSystemStopped) return;

criticalBins.forEach(bin => {
  if (bin.level >= 80) {
    addAlert(bin.id, bin.location, bin.level);
    playAlertSound();
  }
});
}
  
  function addAlert(binId, location, level) {
    const alertList = document.getElementById('alert-list');
    const alertExists = Array.from(alertList.children).some(item => 
      item.querySelector('h4').textContent.includes(binId)
    );
    
    if (!alertExists) {
      const alertItem = document.createElement('div');
      alertItem.className = 'alert-item';
      alertItem.innerHTML = `
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
          <h4>${binId} is ${level}% Full</h4>
          <p>${location} - Requires immediate attention</p>
          <span class="alert-time">Just now</span>
        </div>
      `;
      alertList.insertBefore(alertItem, alertList.firstChild);
      
      // Limit to 5 alerts
      if (alertList.children.length > 5) {
        alertList.removeChild(alertList.lastChild);
      }
    }
  }
  
  function testAlert() {
    playAlertSound();
    addAlert('Bin-01', 'Street A', 88);
    
    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Bin Alert', {
        body: 'Bin-01 is 88% full and requires immediate attention!',
        icon: 'trashiq.jpeg'
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Bin Alert', {
            body: 'Bin-01 is 88% full and requires immediate attention!',
            icon: 'trashiq.jpeg'
          });
        }
      });
    }
  }
  
  isSystemStopped = true;
 function stopVoice() {
  console.log("STOP CLICKED 🔴");

  speechBlocked = true;
  isStoppedManually = true;
  isSystemStopped = true;
  hasSpoken = true;

  // 🔥 STOP EVERYTHING
  speechSynthesis.cancel();

  clearInterval(monitoringInterval);
  clearInterval(alertInterval);

  monitoringInterval = null;
  alertInterval = null;

  alertsEnabled = false;
}

function enableVoice() {
  speechBlocked = false;
  isStoppedManually = false;
  alertsEnabled = true;
}


  function playAlertSound() {

      if (isSystemStopped) {
    // speechSynthesis.cancel();   // force stop
    return;
  }

  // 🚫 STOP any existing speech BEFORE speaking again
  speechSynthesis.cancel();

    // Create beep sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // Beep frequency
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    // Play second beep
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      
      oscillator2.frequency.value = 800;
      oscillator2.type = 'sine';
      
      gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + 0.3);
    }, 400);
  }

  function triggerAlert() {

  if (isSystemStopped || speechBlocked) return; // 🚫 HARD STOP

  speechSynthesis.cancel();

  const msg = new SpeechSynthesisUtterance(
    "Warning! Garbage bin is full"
  );

  speechSynthesis.speak(msg);
}
  
  // Route Optimization - OpenStreetMap + OSRM
const THODIYOOR_START = {
  name: "Thodiyoor Grama Panchayat",
  lat: 9.07508,
  lng: 76.57547
};

let routeMap = null;
let routeLayer = null;
let routeMarkers = [];

function initializeRouteMap() {
  const mapEl = document.getElementById("route-map");
  if (!mapEl) {
    console.error("[route] #route-map not found in DOM");
    return;
  }
  if (typeof L === "undefined") {
    console.error("[route] Leaflet (L) is not loaded");
    return;
  }

  setTimeout(() => {
    if (routeMap !== null) {
      try { routeMap.remove(); } catch (_) { /* noop */ }
      routeMap = null;
    }

    routeMap = L.map(mapEl).setView([THODIYOOR_START.lat, THODIYOOR_START.lng], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19
    }).addTo(routeMap);

    const startMarker = L.marker([THODIYOOR_START.lat, THODIYOOR_START.lng]).addTo(routeMap);
    startMarker.bindPopup(`<b>Start:</b> ${THODIYOOR_START.name}`).openPopup();
    routeMarkers.push(startMarker);

    updateRouteInfo(["Start: Thodiyoor Grama Panchayat"], null, null);

    setTimeout(() => {
      if (routeMap) routeMap.invalidateSize();
    }, 250);
  }, 200);
}

function resetRouteDrawing() {
  if (routeLayer) {
    routeMap.removeLayer(routeLayer);
    routeLayer = null;
  }

  routeMarkers.forEach((marker) => {
    if (routeMap && routeMap.hasLayer(marker)) {
      routeMap.removeLayer(marker);
    }
  });
  routeMarkers = [];

  const startMarker = L.marker([THODIYOOR_START.lat, THODIYOOR_START.lng]).addTo(routeMap);
  startMarker.bindPopup(`<b>Start:</b> ${THODIYOOR_START.name}`);
  routeMarkers.push(startMarker);
}

async function geocodeLocation(query) {
  // Bias to India + Thodiyoor area so a free-typed name doesn't match a same-named
  // place in another state. Same parameters as the autocomplete search.
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1" +
    "&countrycodes=in" +
    `&viewbox=${ROUTE_VIEWBOX}&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Unable to reach geocoding service.");
  }

  const data = await response.json();
  if (!data.length) {
    return null;
  }

  return {
    name: query,
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name
  };
}

function updateRouteInfo(stops, distanceKm, durationMin) {
  const routeList = document.querySelector("#modal-route .route-list");
  const routeStats = document.querySelector("#modal-route .route-info p");
  if (!routeList || !routeStats) {
    return;
  }

  routeList.innerHTML = stops.map((stop) => `<li>${stop}</li>`).join("");

  if (distanceKm === null || durationMin === null) {
    routeStats.innerHTML = "<strong>Estimated Time:</strong> -- | <strong>Distance:</strong> --";
    return;
  }

  routeStats.innerHTML = `<strong>Estimated Time:</strong> ${durationMin.toFixed(1)} minutes | <strong>Distance:</strong> ${distanceKm.toFixed(2)} km`;
}
  
  

    
  // Reports
  function showReport(type) {
    const tabs = document.querySelectorAll('.report-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    
    // Destroy existing chart if switching tabs
    if (reportChart) {
      reportChart.destroy();
      reportChart = null;
    }
    
    const content = document.getElementById('report-content');
    
    const reports = {
      daily: {
        title: 'Daily Collection Report - May 07, 2026',
        data: [
          { id: 'Bin-01', location: 'Street A', level: 88, time: '08:30 AM', status: 'Collected' },
          { id: 'Bin-02', location: 'Market Road', level: 63, time: '09:15 AM', status: 'Collected' },
          { id: 'Bin-03', location: 'Bus Stop', level: 91, time: '08:45 AM', status: 'Collected' }
        ],
        summary: {
          total: 3,
          avgLevel: 80.7,
          efficiency: 100,
          waste: '450 kg'
        }
      },
      weekly: {
        title: 'Weekly Collection Report - May 05-07, 2026',
        data: [
          { id: 'Bin-01', location: 'Street A', level: 85, time: 'Daily', status: 'Regular' },
          { id: 'Bin-02', location: 'Market Road', level: 70, time: 'Daily', status: 'Regular' },
          { id: 'Bin-03', location: 'Bus Stop', level: 88, time: 'Daily', status: 'Regular' }
        ],
        summary: {
          total: 21,
          avgLevel: 81,
          efficiency: 98,
          waste: '3,150 kg'
        }
      },
      monthly: {
        title: 'Monthly Collection Report - May 2026',
        data: [
          { id: 'Bin-01', location: 'Street A', level: 82, time: 'Daily', status: 'Regular' },
          { id: 'Bin-02', location: 'Market Road', level: 68, time: 'Daily', status: 'Regular' },
          { id: 'Bin-03', location: 'Bus Stop', level: 85, time: 'Daily', status: 'Regular' }
        ],
        summary: {
          total: 21,
          avgLevel: 81,
          efficiency: 98,
          waste: '3,150 kg'
        }
      }
    };
    
    const report = reports[type];
    let tableRows = '';
    report.data.forEach(bin => {
      tableRows += `
        <tr>
          <td>${bin.id}</td>
          <td>${bin.location}</td>
          <td>${bin.level}%</td>
          <td>${bin.time}</td>
          <td>${bin.status}</td>
        </tr>
      `;
    });
    
    content.innerHTML = `
      <div class="report-section">
        <h3>${report.title}</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Bin ID</th>
              <th>Location</th>
              <th>Fill Level</th>
              <th>Collection Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="report-summary">
          <h4>Summary</h4>
          <ul>
            <li>Total Collections: ${report.summary.total} bins</li>
            <li>Average Fill Level: ${report.summary.avgLevel}%</li>
            <li>Collection Efficiency: ${report.summary.efficiency}%</li>
            <li>Total Waste Collected: ${report.summary.waste}</li>
          </ul>
        </div>
        <div class="graph-section" id="graph-section-${type}" style="display: none; margin-top: 2rem; animation: fadeIn 0.5s ease;">
          <div class="graph-container">
            <canvas id="report-chart-${type}"></canvas>
          </div>
        </div>
        <div class="generate-graph-btn-container">
          <button class="generate-graph-btn" onclick="generateReportGraph('${type}')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            Generate Graph
          </button>
        </div>
      </div>
    `;
    
    // Store current report data for graph generation
    window.currentReportData = report;
    window.currentReportType = type;
  }
  
  // Generate Report Graph
  let reportChart = null;
  
  function generateReportGraph(type) {
    const graphSection = document.getElementById(`graph-section-${type}`);
    const canvas = document.getElementById(`report-chart-${type}`);
    
    if (!graphSection || !canvas) return;
    
    // Show graph section
    graphSection.style.display = 'block';
    
    // Destroy existing chart if it exists
    if (reportChart) {
      reportChart.destroy();
    }
    
    // Get current report data
    const report = window.currentReportData;
    if (!report) return;
    
    // Prepare data for chart
    const binLabels = report.data.map(bin => bin.id);
    const fillLevels = report.data.map(bin => bin.level);
    const locations = report.data.map(bin => bin.location);
    
    // Create chart context
    const ctx = canvas.getContext('2d');
    
    // Generate professional chart
    reportChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: binLabels,
        datasets: [{
          label: 'Fill Level (%)',
          data: fillLevels,
          backgroundColor: fillLevels.map(level => {
            if (level >= 80) return 'rgba(239, 68, 68, 0.8)'; // Red for critical
            if (level >= 60) return 'rgba(245, 158, 11, 0.8)'; // Orange for warning
            return 'rgba(16, 185, 129, 0.8)'; // Green for normal
          }),
          borderColor: fillLevels.map(level => {
            if (level >= 80) return 'rgba(239, 68, 68, 1)';
            if (level >= 60) return 'rgba(245, 158, 11, 1)';
            return 'rgba(16, 185, 129, 1)';
          }),
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: true,
            text: report.title,
            font: {
              size: 18,
              weight: 'bold'
            },
            padding: {
              top: 10,
              bottom: 20
            },
            color: '#1f2937'
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            },
            callbacks: {
              afterLabel: function(context) {
                const index = context.dataIndex;
                return 'Location: ' + locations[index];
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 10,
              font: {
                size: 11
              },
              color: '#6b7280'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            },
            title: {
              display: true,
              text: 'Fill Level (%)',
              font: {
                size: 12,
                weight: 'bold'
              },
              color: '#374151',
              padding: {
                top: 10,
                bottom: 10
              }
            }
          },
          x: {
            ticks: {
              font: {
                size: 11
              },
              color: '#6b7280'
            },
            grid: {
              display: false
            },
            title: {
              display: true,
              text: 'Bin ID',
              font: {
                size: 12,
                weight: 'bold'
              },
              color: '#374151',
              padding: {
                top: 10,
                bottom: 10
              }
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        }
      }
    });
    
    // Scroll to graph
    graphSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  
  // Request notification permission on page load
  if ('Notification' in window) {
    Notification.requestPermission();
  }



  async function generateRoute() {
    if (!routeMap) {
      initializeRouteMap();
      return;
    }

    const destinationInput = document.getElementById("destination-input");
    const rawInput = destinationInput.value.trim();
    if (!rawInput) {
      alert("Please enter at least one bin location.");
      return;
    }

    const destinationNames = rawInput
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    if (!destinationNames.length) {
      alert("Please provide valid destination names.");
      return;
    }

    try {
      // For each comma-separated entry, prefer cached picked coordinates
      // (from the autocomplete dropdown) so we don't lose accuracy by re-geocoding.
      const geocodedPoints = [];
      for (const locationName of destinationNames) {
        const cached = pickedRouteStops.get(locationName.toLowerCase());
        if (cached) {
          geocodedPoints.push({
            name: cached.label,
            lat: cached.lat,
            lng: cached.lng,
            displayName: cached.displayName
          });
          continue;
        }
        const point = await geocodeLocation(locationName);
        if (!point) {
          throw new Error(`Location not found: ${locationName}`);
        }
        geocodedPoints.push(point);
      }

      resetRouteDrawing();

      // OSRM trip endpoint optimizes waypoint order (shortest overall route)
      const coordinates = [
        `${THODIYOOR_START.lng},${THODIYOOR_START.lat}`,
        ...geocodedPoints.map((point) => `${point.lng},${point.lat}`)
      ];

      const tripUrl =
        `https://router.project-osrm.org/trip/v1/driving/${coordinates.join(";")}` +
        "?source=first&roundtrip=false&overview=full&geometries=geojson&steps=true";

      const tripResponse = await fetch(tripUrl);
      const tripData = await tripResponse.json();

      if (!tripResponse.ok || tripData.code !== "Ok" || !tripData.trips?.length) {
        throw new Error("Could not calculate route. Try nearby or more specific locations.");
      }

      const trip = tripData.trips[0];
      const waypoints = tripData.waypoints || [];

      const latLngPath = trip.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      routeLayer = L.polyline(latLngPath, {
        color: "#10b981",
        weight: 6,
        opacity: 0.9
      }).addTo(routeMap);

      const orderedStops = ["Start: Thodiyoor Grama Panchayat"];
      waypoints
        .sort((a, b) => a.waypoint_index - b.waypoint_index)
        .forEach((wp) => {
          if (wp.waypoint_index === 0) {
            return;
          }

          // Use the original geocoded coords (what the user actually picked),
          // not OSRM's road-snapped wp.location which can drift away from the place.
          const idx = (wp.original_index ?? 1) - 1;
          const original = geocodedPoints[idx];
          const stopName = destinationNames[idx] || `Stop ${wp.waypoint_index}`;
          const markerLatLng = original
            ? [original.lat, original.lng]
            : [wp.location[1], wp.location[0]];
          const marker = L.marker(markerLatLng).addTo(routeMap);
          marker.bindPopup(`<b>Stop ${wp.waypoint_index}:</b> ${stopName}`);
          routeMarkers.push(marker);
          orderedStops.push(`Stop ${wp.waypoint_index}: ${stopName}`);
        });

      const distanceKm = trip.distance / 1000;
      const durationMin = trip.duration / 60;
      updateRouteInfo(orderedStops, distanceKm, durationMin);
      routeMap.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
    } catch (error) {
      console.error(error);
      alert(error.message || "Error generating optimized route.");
    }
  }
window.openFeatureModal = openFeatureModal;
window.closeFeatureModal = closeFeatureModal;
window.generateRoute = generateRoute;
