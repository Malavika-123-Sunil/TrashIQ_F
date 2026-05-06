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
});



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

    // Close all modals first
    document.querySelectorAll('.feature-modal').forEach(modal => {
        modal.classList.remove('active');
        modal.style.display = 'none';
    });

    // Get selected modal
    const modal = document.getElementById(`modal-${feature}`);

    // Safety check
    if (!modal) {
        console.error("❌ Modal not found:", feature);
        return;
    }

    // Open modal
    modal.style.display = 'flex';
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

            // Delay needed for Leaflet map rendering
            setTimeout(() => {

                initializeRouteMap();

                // Fix map sizing issue
                if(routeMap){
                    routeMap.invalidateSize();
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
  
  // Close modal when clicking outside
  window.onclick = function(event) {
    if (event.target.classList.contains('feature-modal')) {
      event.target.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  }
  
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
  
  // Route Optimization - Google Maps
  
let routeMap = null;

function initializeRouteMap() {

 setTimeout(() => {

        if(routeMap !== null){
            routeMap.remove();
        }

        routeMap = L.map('route-map').setView([8.8853, 76.5910], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(routeMap);

        L.marker([8.8853, 76.5910])
            .addTo(routeMap)
            .bindPopup("Thodiyoor Panchayat")
            .openPopup();

        setTimeout(() => {
            routeMap.invalidateSize();
        }, 200);

    }, 300);
  }
    // Map is embedded via iframe, no additional initialization needed
    // The iframe URL includes the route from Thodiyoor Panchayat to all bins
  
  

    
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
          total: 93,
          avgLevel: 78.3,
          efficiency: 97,
          waste: '13,950 kg'
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

    const destination = document
        .getElementById("destination-input")
        .value;

    if (!destination) {
        alert("Please enter destination");
        return;
    }

    // Thodiyoor Panchayat coordinates
    const startLat = 8.8853;
    const startLng = 76.5910;

    try {

        // Convert place name to coordinates
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${destination}`
        );

        const data = await response.json();

        if (data.length === 0) {
            alert("Location not found");
            return;
        }

        // Destination coordinates
        const endLat = parseFloat(data[0].lat);
        const endLng = parseFloat(data[0].lon);

        // Destination Marker
        L.marker([endLat, endLng])
            .addTo(routeMap)
            .bindPopup(destination)
            .openPopup();

        // Route Line
        const routeLine = L.polyline([
            [startLat, startLng],
            [endLat, endLng]
        ], {
            color: 'green',
            weight: 5
        }).addTo(routeMap);

        // Zoom map to fit route
        routeMap.fitBounds(routeLine.getBounds());

    } catch (error) {

        console.error(error);
        alert("Error generating route");

    }
}
window.openFeatureModal = openFeatureModal;
window.closeFeatureModal = closeFeatureModal;