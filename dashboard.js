// Dashboard JavaScript
let dailyChart = null;
let recognition = null;
let assistantRecognition = null;
let synth = speechSynthesis;
let isListening = false;
let isAssistantListening = false;

document.addEventListener('DOMContentLoaded', function() {

    if(document.getElementById('assistant-voice-btn')){
        initializeVoiceAssistant();
    }

    if(document.getElementById('voice-input-btn')){
        initializeVoiceRecognition();
    }

});

/*
// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    initializeDatePicker();
    initializeChatbot();
    initializeVoiceRecognition();
    initializeVoiceAssistant();
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-picker').value = today;
    loadReportForDate(today);
});


*/ 


// Navigation between sections
function initializeNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.content-section');

    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetSection = this.getAttribute('data-section');
            
            // Update active button
            navButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Update active section
            sections.forEach(section => section.classList.remove('active'));
            document.getElementById(targetSection).classList.add('active');
        });
    });
}

// Date Picker and Report Loading
function initializeDatePicker() {
    const datePicker = document.getElementById('date-picker');
    const viewReportBtn = document.getElementById('view-report-btn');
    
    viewReportBtn.addEventListener('click', function() {
        const selectedDate = datePicker.value;
        if (selectedDate) {
            loadReportForDate(selectedDate);
        } else {
            alert('Please select a date first.');
        }
    });
    
    // Allow Enter key to trigger report view
    datePicker.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.value) {
            loadReportForDate(this.value);
        }
    });
}

// Load and display report for selected date
function loadReportForDate(dateString) {
    // Parse the date
    const selectedDate = new Date(dateString);
    const dateDisplay = selectedDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Generate mock data based on date (in production, this would fetch from API)
    const reportData = generateReportData(dateString);
    
    // Update stats
    document.getElementById('total-collections').textContent = reportData.totalCollections;
    document.getElementById('bins-serviced').textContent = reportData.binsServiced;
    document.getElementById('waste-collected').textContent = reportData.wasteCollected;
    document.getElementById('efficiency').textContent = reportData.efficiency + '%';
    
    // Update chart
    updateDailyChart(reportData);
}

// Generate mock report data (replace with API call in production)
function generateReportData(dateString) {
    // Use date as seed for consistent data per date
    const dateHash = dateString.split('-').join('');
    const seed = parseInt(dateHash.slice(-6));
    
    // Generate data based on seed
    const baseCollections = 50 + (seed % 50);
    const binsServiced = 20 + (seed % 30);
    const wasteCollected = 500 + (seed % 500);
    const efficiency = 75 + (seed % 20);
    
    // Generate hourly data for the chart
    const hourlyData = [];
    const binLabels = ['Bin A', 'Bin B', 'Bin C', 'Bin D', 'Bin E'];
    
    for (let i = 0; i < 24; i++) {
        const hourValue = Math.floor(20 + (Math.sin(i / 24 * Math.PI * 2) * 15) + (seed % 20));
        hourlyData.push({
            hour: i,
            collections: Math.max(0, hourValue),
            label: `${i}:00`
        });
    }
    
    const binData = binLabels.map((label, index) => ({
        label: label,
        waste: Math.floor(100 + (seed % 100) + (index * 20)),
        capacity: Math.floor(80 + (seed % 20) + (index * 5)),
        urgent: (seed % binLabels.length) === index
    }));
    
    return {
        date: dateString,
        totalCollections: baseCollections,
        binsServiced: binsServiced,
        wasteCollected: wasteCollected,
        efficiency: efficiency,
        hourlyData: hourlyData,
        binData: binData
    };
}

// Update chart with new data
function updateDailyChart(data) {
    const ctx = document.getElementById('daily-chart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (dailyChart) {
        dailyChart.destroy();
    }
    
    // Prepare data for chart
    const labels = data.hourlyData.map(d => d.label);
    const collectionsData = data.hourlyData.map(d => d.collections);
    
    // Create new chart
    dailyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Collections per Hour',
                data: collectionsData,
                borderColor: 'rgb(102, 126, 234)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: true,
                    text: `Waste Collection Report - ${new Date(data.date).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                    })}`,
                    font: {
                        size: 18,
                        weight: 'bold'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Collections'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time (Hours)'
                    }
                }
            }
        }
    });
}

// Chatbot Initialization
function initializeChatbot() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    
    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    // Send message on Enter (but allow Shift+Enter for new line)
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Send button click
    sendBtn.addEventListener('click', sendMessage);
}

// Send chat message
async function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addChatMessage(message, 'user');
    
    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    // Show loading indicator
    const loadingId = addChatMessage('Thinking...', 'bot');
    
    // Get AI response (simulated Gen AI - replace with actual API call)
    try {
        const response = await getAIResponse(message);
        
        // Remove loading message
        removeChatMessage(loadingId);
        
        // Add bot response
        addChatMessage(response.text, 'bot', true, response.data);
    } catch (error) {
        removeChatMessage(loadingId);
        addChatMessage('Sorry, I encountered an error. Please try again.', 'bot');
        console.error('AI Response Error:', error);
    }
}

// Simulated Gen AI Response (Replace with actual API integration)
async function getAIResponse(userMessage) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const message = userMessage.toLowerCase();
    
    // Mock AI responses based on keywords
    let responseText = '';
    let responseData = null;
    
    if (message.includes('urgent') || message.includes('needs attention') || message.includes('critical')) {
        responseText = `Based on current data, Bin C located in Sector 3 requires urgent attention. It's at 95% capacity and hasn't been serviced in the last 48 hours. The bin is near critical overflow level. I recommend scheduling an immediate collection for this bin.`;
        responseData = { urgentBin: 'Bin C', location: 'Sector 3', capacity: 95 };
    } else if (message.includes('capacity') || message.includes('full') || message.includes('empty')) {
        responseText = `Here's the current capacity status:\n• Bin A: 75% full\n• Bin B: 60% full\n• Bin C: 95% full (URGENT)\n• Bin D: 45% full\n• Bin E: 80% full\n\nBin C needs immediate attention, while Bin D can wait for scheduled collection.`;
        responseData = { type: 'capacity' };
    } else if (message.includes('schedule') || message.includes('when') || message.includes('next collection')) {
        responseText = `The next scheduled collection is tomorrow at 8:00 AM for Sectors 1, 2, and 4. Today's collection covered Sectors 3 and 5. Bins in Sector 3 that are above 80% capacity should be prioritized for today's remaining collection routes.`;
        responseData = { type: 'schedule' };
    } else if (message.includes('today') || message.includes('collection today')) {
        responseText = `Today's collection statistics:\n• Total bins serviced: 42\n• Waste collected: 1,250 kg\n• Efficiency: 87%\n• Average collection time: 8 minutes per bin\n\nAll scheduled routes have been completed successfully.`;
        responseData = { type: 'today' };
    } else if (message.includes('which bin') || message.includes('what bin')) {
        responseText = `Bin C requires immediate assistance. It's located in the commercial district (Sector 3) and is operating at 95% capacity. Additionally, Bin E in Sector 5 is at 80% capacity and should be monitored closely.`;
        responseData = { urgentBins: ['Bin C', 'Bin E'] };
    } else {
        responseText = `I understand you're asking about "${userMessage}". Based on the waste management data:\n\n• Total active bins: 50\n• Average capacity: 68%\n• Collection efficiency: 85%\n\nFor more specific information, you can ask me about urgent bins, capacity levels, collection schedules, or today's statistics.`;
        responseData = { type: 'general' };
    }
    
    return {
        text: responseText,
        data: responseData
    };
}

// Add message to chat
function addChatMessage(message, type, isBot = false, data = null) {
    const chatMessages = document.getElementById('chat-messages');
    const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}-message`;
    messageDiv.id = messageId;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const messageText = document.createElement('p');
    messageText.textContent = message;
    contentDiv.appendChild(messageText);
    
    // Add audio button for bot messages
    if (isBot) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        
        const audioBtn = document.createElement('button');
        audioBtn.className = 'audio-btn';
        audioBtn.innerHTML = '🔊 Listen';
        audioBtn.addEventListener('click', function() {
            speakText(message, audioBtn);
        });
        
        actionsDiv.appendChild(audioBtn);
        contentDiv.appendChild(actionsDiv);
    }
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageId;
}

// Remove message from chat
function removeChatMessage(messageId) {
    const messageElement = document.getElementById(messageId);
    if (messageElement) {
        messageElement.remove();
    }
}

// Text-to-Speech
function speakText(text, buttonElement) {
    // Stop any current speech
    synth.cancel();
    
    // Create speech utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Update button state
    if (buttonElement) {
        buttonElement.classList.add('playing');
        buttonElement.innerHTML = '⏸️ Stop';
    }
    
    // On speech end
    utterance.onend = function() {
        if (buttonElement) {
            buttonElement.classList.remove('playing');
            buttonElement.innerHTML = '🔊 Listen';
        }
    };
    
    // On speech error
    utterance.onerror = function(event) {
        console.error('Speech synthesis error:', event);
        if (buttonElement) {
            buttonElement.classList.remove('playing');
            buttonElement.innerHTML = '🔊 Listen';
        }
    };
    
    // Speak
    synth.speak(utterance);
    
    // Allow stopping speech by clicking again
    if (buttonElement) {
        const stopHandler = function() {
            synth.cancel();
            buttonElement.removeEventListener('click', stopHandler);
        };
        buttonElement.addEventListener('click', stopHandler);
    }
}

// Speech-to-Text (Voice Recognition) - Improved version
function initializeVoiceRecognition() {
    const voiceBtn = document.getElementById('voice-input-btn');
    const voiceStatus = document.getElementById('voice-status');
    const chatInput = document.getElementById('chat-input');
    
    // Check if browser supports speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        voiceBtn.style.display = 'none';
        console.warn('Speech recognition not supported in this browser');
        return;
    }
    
    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true; // Show interim results like ChatGPT
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    // Start listening on click
    voiceBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (!isListening) {
            startChatListening();
        } else {
            stopChatListening();
        }
    });
    
    function startChatListening() {
        try {
            if (!isListening) {
                isListening = true;
                recognition.start();
                voiceBtn.classList.add('listening');
                voiceStatus.textContent = '🎤 Listening... Speak now!';
                voiceStatus.classList.add('active');
                chatInput.placeholder = 'Listening... Speak your question';
                chatInput.value = ''; // Clear previous input
            }
        } catch (error) {
            console.error('Error starting recognition:', error);
            isListening = false;
            voiceBtn.classList.remove('listening');
            if (error.message && error.message.includes('already started')) {
                // Recognition already started, try to stop and restart
                recognition.stop();
                setTimeout(() => startChatListening(), 100);
            }
        }
    }
    
    function stopChatListening() {
        if (recognition && isListening) {
            recognition.stop();
            isListening = false;
        }
    }
    
    // Handle interim results (real-time transcription like ChatGPT)
    recognition.onresult = function(event) {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Update input field with transcription
        chatInput.value = finalTranscript + interimTranscript;
        chatInput.style.height = 'auto';
        chatInput.style.height = (chatInput.scrollHeight) + 'px';
        
        // If we got final results, stop listening
        if (finalTranscript) {
            chatInput.value = finalTranscript.trim();
            stopChatListening();
        }
    };
    
    // Handle recognition errors
    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        stopChatListening();
        chatInput.placeholder = 'Type your question or use voice input...';
        
        if (event.error === 'no-speech') {
            voiceStatus.textContent = '⚠️ No speech detected. Please try again.';
            voiceStatus.classList.add('active');
            setTimeout(() => {
                voiceStatus.classList.remove('active');
            }, 3000);
        } else if (event.error === 'not-allowed') {
            voiceStatus.textContent = '⚠️ Microphone permission denied. Please enable it in browser settings.';
            voiceStatus.classList.add('active');
            setTimeout(() => {
                voiceStatus.classList.remove('active');
            }, 5000);
        } else if (event.error === 'network') {
            voiceStatus.textContent = '⚠️ Network error. Please check your connection.';
            voiceStatus.classList.add('active');
            setTimeout(() => {
                voiceStatus.classList.remove('active');
            }, 3000);
        } else if (event.error === 'aborted') {
            // User stopped listening, no error message needed
        }
    };
    
    // Handle recognition end
    recognition.onend = function() {
        isListening = false;
        voiceBtn.classList.remove('listening');
        voiceStatus.classList.remove('active');
        chatInput.placeholder = 'Type your question or use voice input...';
    };
}

// Voice Assistance for Blind Users
function initializeVoiceAssistant() {
    const assistantVoiceBtn = document.getElementById('assistant-voice-btn');
    const assistantStatus = document.getElementById('assistant-status');
    const assistantMessages = document.getElementById('assistant-messages');
    
    // Check if browser supports speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        assistantVoiceBtn.disabled = true;
        assistantVoiceBtn.innerHTML = '<span>Voice not supported</span>';
        return;
    }
    
    // Initialize speech recognition for assistant
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    assistantRecognition = new SpeechRecognition();
    assistantRecognition.continuous = false;
    assistantRecognition.interimResults = false;
    assistantRecognition.lang = 'en-US';
    assistantRecognition.maxAlternatives = 1;
    
    // Waste type mapping to bins
    const wasteTypeMapping = {
        // Organic Waste (Bin 1)
        'organic': 1, 'food': 1, 'vegetable': 1, 'vegetables': 1, 'fruit': 1, 'fruits': 1,
        'kitchen': 1, 'garden': 1, 'plant': 1, 'plants': 1, 'compost': 1, 'leftover': 1,
        'leftovers': 1, 'peel': 1, 'peels': 1, 'organic waste': 1, 'food waste': 1,
        'food scraps': 1, 'food scrap': 1, 'vegetable waste': 1, 'fruit waste': 1,
        
        // Recyclable Waste (Bin 2)
        'recyclable': 2, 'plastic': 2, 'paper': 2, 'metal': 2, 'glass': 2, 'bottle': 2,
        'bottles': 2, 'can': 2, 'cans': 2, 'newspaper': 2, 'cardboard': 2, 'recycle': 2,
        'recycling': 2, 'recyclable waste': 2, 'plastic bottle': 2, 'glass bottle': 2,
        'metal can': 2, 'aluminum': 2, 'tin': 2, 'carton': 2, 'cartons': 2,
        
        // Hazardous Waste (Bin 3)
        'hazardous': 3, 'battery': 3, 'batteries': 3, 'chemical': 3, 'chemicals': 3,
        'electronic': 3, 'electronics': 3, 'e-waste': 3, 'medicine': 3, 'medicines': 3,
        'paint': 3, 'oil': 3, 'toxic': 3, 'dangerous': 3, 'hazardous waste': 3,
        'battery waste': 3, 'e waste': 3, 'electronic waste': 3, 'mobile': 3, 'phone': 3,
        'laptop': 3, 'computer': 3, 'tablet': 3,
        
        // General Waste (Bin 4)
        'general': 4, 'mixed': 4, 'sanitary': 4, 'diaper': 4, 'diapers': 4, 'tissue': 4,
        'tissues': 4, 'napkin': 4, 'napkins': 4, 'wrapping': 4, 'packaging': 4,
        'general waste': 4, 'mixed waste': 4, 'sanitary waste': 4, 'other': 4, 'misc': 4,
        'miscellaneous': 4, 'trash': 4, 'garbage': 4, 'rubbish': 4
    };
    
    // Start voice assistant
    assistantVoiceBtn.addEventListener('click', function() {
        if (!isAssistantListening) {
            startAssistantListening();
        } else {
            stopAssistantListening();
        }
    });
    
    function startAssistantListening() {
        try {
            if (!isAssistantListening) {
                isAssistantListening = true;
                assistantRecognition.start();
                assistantVoiceBtn.classList.add('listening');
                assistantVoiceBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg><span>Stop Listening</span>';
                assistantStatus.textContent = '🎤 Listening... Please tell me what type of waste you have.';
                assistantStatus.classList.add('active', 'listening');
                
                // Speak initial prompt
                speakAssistantText('Please tell me what type of waste you have.');
            }
        } catch (error) {
            console.error('Error starting assistant recognition:', error);
            isAssistantListening = false;
            assistantVoiceBtn.classList.remove('listening');
            assistantVoiceBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg><span>Start Voice Assistant</span>';
            if (error.message && error.message.includes('already started')) {
                assistantRecognition.stop();
                setTimeout(() => startAssistantListening(), 100);
            }
        }
    }
    
    function stopAssistantListening() {
        if (assistantRecognition && isAssistantListening) {
            assistantRecognition.stop();
            isAssistantListening = false;
        }
    }
    
    // Handle recognition results
    assistantRecognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        
        assistantRecognition.onresult = function(event) {

const transcript = event.results[0][0].transcript.toLowerCase().trim();

addAssistantMessage(transcript,'user');

let responseText = "";

/* THANK YOU */
if(transcript.includes("thank you") || transcript.includes("thanks")){
    responseText="You're welcome. Happy to help!";
    
    addAssistantMessage(responseText,'bot');
    speakAssistantText(responseText);
    
    stopAssistantListening();
    return;
}

/* STOP COMMAND */
if(transcript.includes("stop") || transcript.includes("bye") || transcript.includes("exit")){
    responseText="Okay, stopping the assistant now.";
    
    addAssistantMessage(responseText,'bot');
    speakAssistantText(responseText);
    
    stopAssistantListening();
    return;
}

/* FIND BIN */
let binNumber=null;

for(const key in wasteTypeMapping){
    if(transcript.includes(key)){
        binNumber=wasteTypeMapping[key];
        break;
    }
}

if(binNumber){

const binPosition=getBinPosition(binNumber);

responseText=`Please deposit it in ${binPosition}.`;

}else{

responseText="I couldn't identify the waste type. Please say something like plastic bottle, food waste, batteries or paper.";

}

addAssistantMessage(responseText,'bot');

speakAssistantText(responseText);

/* STOP AFTER RESPONSE */
setTimeout(()=>{
stopAssistantListening();
assistantStatus.textContent="Assistant stopped. Click microphone to start again.";
},2000);

};
        
        // Add bot response
        addAssistantMessage(responseText, 'bot');
        
        // Speak the response automatically
        speakAssistantText(responseText);
        
        // Auto-restart listening after response
        setTimeout(() => {
            if (!isAssistantListening) {
                assistantStatus.textContent = '🎤 Ready to listen again. Tell me what type of waste you have.';
                assistantStatus.classList.remove('listening');
                speakAssistantText('Please tell me what type of waste you have.');
                setTimeout(() => {
                    startAssistantListening();
                }, 2000);
            }
        }, 3000);
    };
    
    // Handle recognition errors
    assistantRecognition.onerror = function(event) {
        console.error('Assistant recognition error:', event.error);
        stopAssistantListening();
        assistantVoiceBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg><span>Start Voice Assistant</span>';
        
        if (event.error === 'no-speech') {
            assistantStatus.textContent = '⚠️ No speech detected. Please try again.';
            assistantStatus.classList.remove('listening');
            speakAssistantText('I didn\'t hear anything. Please try again and tell me what type of waste you have.');
            setTimeout(() => {
                assistantStatus.textContent = '';
                assistantStatus.classList.remove('active');
                startAssistantListening();
            }, 3000);
        } else if (event.error === 'not-allowed') {
            assistantStatus.textContent = '⚠️ Microphone permission denied. Please enable it in browser settings.';
            assistantStatus.classList.remove('listening');
        } else if (event.error === 'network') {
            assistantStatus.textContent = '⚠️ Network error. Please check your connection.';
            assistantStatus.classList.remove('listening');
        }
    };
    
    // Handle recognition end
    assistantRecognition.onend = function() {
        if (isAssistantListening) {
            // Restart if still listening
            setTimeout(() => {
                if (isAssistantListening) {
                    try {
                        assistantRecognition.start();
                    } catch (e) {
                        isAssistantListening = false;
                        assistantVoiceBtn.classList.remove('listening');
                        assistantVoiceBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg><span>Start Voice Assistant</span>';
                        assistantStatus.classList.remove('active', 'listening');
                    }
                }
            }, 100);
        } else {
            assistantVoiceBtn.classList.remove('listening');
            assistantVoiceBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg><span>Start Voice Assistant</span>';
            assistantStatus.classList.remove('active', 'listening');
        }
    };
    
    // Find bin number for waste type
    function findBinForWaste(transcript, mapping) {
        const words = transcript.split(/\s+/);
        
        // Check for exact phrases first
        for (const [key, bin] of Object.entries(mapping)) {
            if (transcript.includes(key)) {
                return bin;
            }
        }
        
        // Check individual words
        for (const word of words) {
            if (mapping.hasOwnProperty(word)) {
                return mapping[word];
            }
        }
        
        return null;
    }
    
    // Get bin position description
    function getBinPosition(binNumber) {
        const positions = {
            1: 'the first bin - for organic waste like food scraps and vegetables',
            2: 'the second bin - for recyclable materials like plastic, paper, metal, and glass',
            3: 'the third bin - for hazardous waste like batteries, chemicals, and electronics',
            4: 'the fourth bin - for general mixed waste'
        };
        return positions[binNumber] || `bin number ${binNumber}`;
    }
    
    // Add message to assistant chat
    function addAssistantMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `assistant-message ${type}`;
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        
        const messageText = document.createElement('p');
        messageText.textContent = message;
        bubbleDiv.appendChild(messageText);
        
        messageDiv.appendChild(bubbleDiv);
        assistantMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
    }
    
    // Speak text for assistant
    function speakAssistantText(text) {
        synth.cancel(); // Stop any current speech
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95; // Slightly slower for clarity
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';
        
        synth.speak(utterance);
    }
}

// function closeFeatureModal(feature) {
//   const modal = document.getElementById(`modal-${feature}`);
//   if (modal) {
//     modal.style.display = 'none';
//     document.body.style.overflow = 'auto';

//     // 🔴 ADD THIS
//     speechSynthesis.cancel();
//   }
// }