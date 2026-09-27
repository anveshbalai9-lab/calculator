// ============ VOICE MODE STATE ============
let voiceModeActive = false;
let isListening = false;
let mediaStream = null;
let recognition = null;
let audioContext = null;
let noiseSuppressionProcessor = null;
let processStepNumber = 0;

function addProcessStep(label, detail, state = "active") {
    const steps = document.getElementById("processSteps");
    const empty = steps.querySelector(".process-empty");
    if (empty) empty.remove();

    const step = document.createElement("li");
    step.className = "process-step " + state;
    const number = document.createElement("span");
    number.className = "step-number";
    number.textContent = ++processStepNumber;
    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = label;
    const description = document.createElement("span");
    description.textContent = detail;
    content.append(title, description);
    step.append(number, content);
    steps.appendChild(step);
    step.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return step;
}

function clearProcessSteps() {
    processStepNumber = 0;
    document.getElementById("processSteps").innerHTML = '<li class="process-empty">Your voice steps will appear here.</li>';
}

function updateStatus(message) {
    document.getElementById("status").textContent = message;
}

function updateListeningIndicator(listening) {
    const indicator = document.getElementById("listening-indicator");
    if (listening) {
        indicator.classList.remove("hidden");
        indicator.classList.add("active");
    } else {
        indicator.classList.add("hidden");
        indicator.classList.remove("active");
    }
}

function toggleVoice() {
    if (voiceModeActive) {
        stopVoiceMode();
    } else {
        startVoiceMode();
    }
}

// ============ TOGGLE VOICE MODE ============
function toggleVoiceMode() {
    if (!voiceModeActive) {
        startVoiceMode();
    }
}

function stopVoiceMode() {
    voiceModeActive = false;
    isListening = false;
    if (recognition) {
        recognition.stop();
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    updateListeningIndicator(false);
    updateStatus("Voice mode stopped");
    addProcessStep("Voice input stopped", "Ready for the next recording.", "complete");
    const voiceButton = document.getElementById("voiceBtn");
    voiceButton.textContent = "🎤 Voice Input";
    document.getElementById("voiceHelp").classList.add("hidden");
}

async function startVoiceMode() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert("🎙️ Voice recognition not supported. Use Chrome, Edge, or Safari.");
        return;
    }

    voiceModeActive = true;
    clearProcessSteps();
    addProcessStep("Microphone ready", "Echo cancellation, noise suppression and auto gain are enabled.");
    document.getElementById("voiceBtn").textContent = "⏹ Stop Listening";
    document.getElementById("voiceHelp").classList.remove("hidden");
    updateStatus("🎤 Initializing voice input...");
    
    try {
        // Request microphone with noise suppression
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 16000
            }
        });

        updateStatus("🎤 Listening... (Noise Suppression Active)");
        addProcessStep("Noise reduction active", "Background noise is reduced before recognition.", "complete");
        initializeVoiceRecognition();
        
    } catch (error) {
        voiceModeActive = false;
        document.getElementById("voiceBtn").textContent = "🎤 Voice Input";
        document.getElementById("voiceHelp").classList.add("hidden");
        
        if (error.name === 'NotAllowedError') {
            updateStatus("❌ Microphone access denied");
            alert("Please allow microphone access to use voice mode.");
        } else if (error.name === 'NotFoundError') {
            updateStatus("❌ No microphone found");
            alert("Please connect a microphone.");
        } else {
            updateStatus("❌ Error: " + error.message);
        }
    }
}

// ============ VOICE RECOGNITION INITIALIZATION ============
function initializeVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = function() {
        isListening = true;
        updateListeningIndicator(true);
        updateStatus("🎤 Listening...");
        addProcessStep("Listening", "Speak clearly; the live words will appear below.");
    };

    recognition.onresult = function(event) {
        let interimTranscript = "";
        let finalTranscript = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const transcript = event.results[index][0].transcript;
            if (event.results[index].isFinal) finalTranscript += transcript;
            else interimTranscript += transcript;
        }

        if (interimTranscript) {
            updateStatus("🎤 Hearing: " + interimTranscript);
        }
        if (finalTranscript.trim()) {
            const transcript = finalTranscript.trim();
            addProcessStep("Voice captured", transcript, "complete");
            processVoiceCommand(transcript);
        }
    };

    recognition.onerror = function(event) {
        updateListeningIndicator(false);
        isListening = false;
        
        const errorMessages = {
            'network': "Network error. Check connection.",
            'no-speech': "No speech detected. Try again.",
            'audio-capture': "No microphone input detected.",
            'not-allowed': "Microphone access denied."
        };
        
        const message = errorMessages[event.error] || "Could not understand. Try again.";
        updateStatus("❌ " + message);
        speakText(message);
        
        // Continue listening after error
        setTimeout(() => {
            if (voiceModeActive) {
                startListening();
            }
        }, 1500);
    };

    recognition.onend = function() {
        isListening = false;
        updateListeningIndicator(false);
        
        // Auto-restart listening if voice mode is still active
        if (voiceModeActive) {
            setTimeout(() => {
                startListening();
            }, 500);
        }
    };

    startListening();
}

function startListening() {
    if (voiceModeActive && recognition && !isListening) {
        try {
            recognition.start();
        } catch (error) {
            console.log("Already listening or error:", error.message);
        }
    }
}

// ============ VOICE COMMAND PROCESSING ============
async function processVoiceCommand(text) {
    updateListeningIndicator(false);
    addProcessStep("Processing", "Converting your words into a calculation.");
    
    const command = text.toLowerCase().trim();
    
    // Handle special commands
    if (command.includes("clear")) {
        clearDisplay();
        addProcessStep("Completed", "The display was cleared.", "complete");
        speakText("Display cleared");
        updateStatus("✓ Display cleared");
        return;
    }
    
    if (command.includes("repeat") || command.includes("say that again")) {
        const result = document.getElementById("display").value;
        if (result) {
            speakText("The answer is " + result);
        }
        return;
    }

    try {
        const response = await fetch("/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expression: text })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        document.getElementById("display").value = data.result;
        addProcessStep("Completed", "Answer: " + data.result, "complete");
        updateStatus("✓ Calculated: " + data.result);
        speakText("The answer is " + data.result);
        
    } catch (error) {
        document.getElementById("display").value = "Error";
        addProcessStep("Could not process", "Try speaking the calculation again.", "error");
        updateStatus("❌ Could not process: " + text);
        speakText("I heard " + text + ". Try saying something like five plus three, or square root of nine.");
    }
}

document.getElementById("clearProcessBtn").addEventListener("click", clearProcessSteps);

async function calculate() {
    const expression = getDisplay().value;
    if (!expression.trim()) return;

    try {
        const response = await fetch("/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expression })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        getDisplay().value = data.result;
        updateStatus("✓ Calculated: " + data.result);
    } catch (error) {
        getDisplay().value = "Error";
        updateStatus("❌ " + error.message);
    }
}

function speakResult() {
    const result = getDisplay().value;
    if (result && result !== "Error") {
        speakText("The answer is " + result);
        updateStatus("🔊 Speaking result...");
    } else {
        updateStatus("Enter or calculate a result first");
    }
}

// ============ DISPLAY FUNCTIONS ============
function getDisplay() {
    return document.getElementById("display");
}

function appendToDisplay(value) {
    const display = getDisplay();
    if (display.value === "Error") display.value = "";
    display.value += value;
    updateStatus("Ready");
}

function clearDisplay() {
    getDisplay().value = "";
    updateStatus("Display cleared");
}

function evaluateExpression(expression) {
    const value = String(expression).trim();
    if (!value) {
        throw new Error("empty expression");
    }

    const safeExpression = value.replace(/\s+/g, "");
    if (!/^[0-9+\-*/().%^]+$/.test(safeExpression)) {
        throw new Error("invalid expression");
    }

    return Function("" + safeExpression + "")();
}

const numberWords = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
    twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
    seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000
};

function parseVoiceCalculation(text) {
    let expression = text.toLowerCase().trim();
    
    // Remove common phrases
    expression = expression.replace(/^(what is|what's|calculate|compute|please calculate|equals)\s+/, "");
    expression = expression.replace(/\s+(please|thank you|thanks)$/, "");
    
    // Math functions
    expression = expression.replace(/square root of/g, "sqrt ");
    expression = expression.replace(/(the )?square of/g, "square ");
    expression = expression.replace(/squared/g, "square");
    expression = expression.replace(/raised to the power of|to the power of|raised to|to the/g, " ^ ");
    expression = expression.replace(/multiplied by|multiply by|times/g, " * ");
    expression = expression.replace(/divided by|divide by/g, " / ");
    expression = expression.replace(/plus|add/g, " + ");
    expression = expression.replace(/minus|subtract|subtract/g, " - ");
    
    // Special constants and functions
    expression = expression.replace(/percent(?!age)/g, " / 100");
    expression = expression.replace(/point/g, ".");
    expression = expression.replace(/\b(pi|pie)\b/g, String(Math.PI));
    expression = expression.replace(/\b(e|euler)\b/g, String(Math.E));
    
    // Trigonometric functions
    expression = expression.replace(/\b(sine|sin) of/g, "sin ");
    expression = expression.replace(/\b(cosine|cos) of/g, "cos ");
    expression = expression.replace(/\b(tangent|tan) of/g, "tan ");
    expression = expression.replace(/\b(logarithm|log) of/g, "log ");
    expression = expression.replace(/\bdegrees?\b/g, "");
    
    // Convert number words to digits
    for (const [word, value] of Object.entries(numberWords)) {
        expression = expression.replace(new RegExp("\\b" + word + "\\b", "g"), value);
    }

    // Check for scientific functions at the start
    const scientific = expression.match(/^(sqrt|square|sin|cos|tan|log)\s+(.+)$/);
    if (scientific) {
        const value = evaluateVoiceExpression(scientific[2]);
        if (scientific[1] === "sqrt") return Math.sqrt(value);
        if (scientific[1] === "square") return value * value;
        if (scientific[1] === "sin") return Math.sin(value * Math.PI / 180);
        if (scientific[1] === "cos") return Math.cos(value * Math.PI / 180);
        if (scientific[1] === "tan") return Math.tan(value * Math.PI / 180);
        return Math.log10(value);
    }
    
    return evaluateVoiceExpression(expression);
}

function evaluateVoiceExpression(expression) {
    const safeExpression = expression.replace(/\^/g, "**").trim();
    if (!/^[0-9+*/().%\-\s*]+$/.test(safeExpression)) {
        throw new Error("unsupported voice command");
    }
    return Function("return (" + safeExpression + ")")();
}

// ============ VOICE OUTPUT (TEXT-TO-SPEECH) ============
function speakText(text) {
    if (!("speechSynthesis" in window)) {
        alert("Voice output is not supported in this browser.");
        return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Create and configure speech
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-US";
    speech.rate = 0.9;  // Slightly slower for clarity
    speech.pitch = 1;
    speech.volume = 1;
    
    // Speak
    window.speechSynthesis.speak(speech);
    
    // Optional: Log when speech ends
    speech.onend = function() {
        console.log("Voice output completed");
        updateStatus("✓ Voice output complete");
    };
}
