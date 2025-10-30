let isVoiceInput = false; // Variable to track if input was from voice

function deleteChat() {
    document.getElementById('chatMessages').innerHTML = '';
}

function checkEnter(event) {
    if (event.key === "Enter") {
        askQuestion();
    }
}

async function askQuestion() {
    const questionInput = document.getElementById('question');
    const question = questionInput.value.trim();
    if (question === "") return;

    const chatMessages = document.getElementById('chatMessages');
  
    // Append user message to the chat
    const userMessageDiv = document.createElement('div');
    userMessageDiv.className = "message user-message";
    userMessageDiv.innerHTML = `<div>${question}</div>`;
    chatMessages.appendChild(userMessageDiv);
    
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: "smooth"
    });

    document.getElementById('loading').style.display = "flex";

    try {
        const response = await fetch('/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                text: document.getElementById('extractedText').innerText
            })
        });
        
        const data = await response.json();
        const answer = data.answer || "No answer available.";

        const aiResponseDiv = document.createElement('div');
        aiResponseDiv.className = "message ai-message";
        aiResponseDiv.innerHTML = `<div>${answer}</div>`;
        chatMessages.appendChild(aiResponseDiv);
        
        // Conditionally read out the AI's response based on input method
        if (isVoiceInput) {
            speakText(answer);
        }

        setTimeout(() => {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: "smooth"
            });
        }, 100);

    } catch (error) {
        console.error("Error:", error);
        const errorDiv = document.createElement('div');
        errorDiv.className = "message ai-message";
        errorDiv.innerHTML = `<div>Error occurred while fetching answer.</div>`;
        chatMessages.appendChild(errorDiv);
        
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: "smooth"
        });
    } finally {
        document.getElementById('loading').style.display = "none";
        questionInput.value = "";
        isVoiceInput = false; // Reset after processing the input
    }
}



// Voice Synthesis for AI Responses
function speakText(text) {
    const cleanText = text.replace(/<\/?strong>/g, ''); // Remove <strong> tags
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
}

// Voice Recognition for User Input
function startVoiceInput() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const voiceText = event.results[0][0].transcript;
        document.getElementById('question').value = voiceText;
        isVoiceInput = true; // Set flag for voice input
        askQuestion();
    };

    recognition.onerror = (error) => {
        console.error("Error with voice recognition:", error);
        alert("Error with voice recognition. Please try again.");
    };

    recognition.start();
}
function submitComment() {
    const comment = document.getElementById('userComment').value;

    if (!comment.trim()) {
        alert("Please enter a comment.");
        return;
    }

    // Send the comment to the backend
    fetch('/submit_comment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comment: comment })
    })
    .then(response => response.json())
    .then(data => {
        if (data.sentiment) {
            alert(`Comment submitted! Sentiment: ${data.sentiment}`);
        } else {
            alert("Failed to submit comment.");
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert("An error occurred while submitting the comment.");
    });
}
