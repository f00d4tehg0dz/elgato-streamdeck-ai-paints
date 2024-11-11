/// <reference path="../../../libs/js/property-inspector.js" />
/// <reference path="../../../libs/js/utils.js" />
let activeTab = null;
// Establish WebSocket connection to app.js
var websocket = null;

// viewImage function
function viewImage(imageUrl) {
    // Get the current window's position and size
    const currentWindow = window;
    const screenLeft = window.screenLeft || window.screenX;
    const screenTop = window.screenTop || window.screenY;
    
    // Calculate center position for the new window
    const width = 1920; // 1024 + some padding
    const height = 1080;
    const left = screenLeft + (window.outerWidth - width) / 2;
    const top = screenTop + (window.outerHeight - height) / 2;

    // Open the popup window with the image
    const popupUrl = `popup.html?image=${encodeURIComponent(imageUrl)}`;
    window.open(
        popupUrl,
        'GeneratedImage',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
}

// Triggered when the plugin is connected to the Stream Deck
$PI.onConnected((jsn) => {
    const { actionInfo, appInfo, connection, messageType, port, uuid } = jsn;
    const { payload, context } = actionInfo;
    const { settings } = payload;
    const cachedPositivePrompt = localStorage.getItem('positivePromptInspector');
    const cachedNegativePrompt = localStorage.getItem('negativePromptInspector');
    const cachedBase64Image = localStorage.getItem('base64ImageInspector');
    const cachedHuggingFaceKey = localStorage.getItem('huggingFaceKeyInspector');
    const cachedModel = localStorage.getItem('modelSelectionInspector');

    const imageElement = document.getElementById('currentImage');
    const positivePromptInput = document.getElementById('positivePrompt');
    const negativePromptInput = document.getElementById('negativePrompt');
    const huggingFaceKeyInput = document.getElementById('huggingFaceKey');
    const modelSelect = document.getElementById('modelSelection');

    if (cachedBase64Image && imageElement) {
        imageElement.src = cachedBase64Image;
        imageElement.style.display = 'block';
        
        // Show view button for cached images
        const viewButton = document.getElementById('viewButton');
        viewButton.style.display = 'block';
        viewButton.onclick = () => {
            viewImage(cachedBase64Image);
        };
    }

    if (cachedPositivePrompt && positivePromptInput) {
        positivePromptInput.value = cachedPositivePrompt;
    }

    if (cachedNegativePrompt && negativePromptInput) {
        negativePromptInput.value = cachedNegativePrompt;
    }

    if (cachedHuggingFaceKey && huggingFaceKeyInput) {
        huggingFaceKeyInput.value = cachedHuggingFaceKey;
    }

    if (cachedModel && modelSelect) {
        modelSelect.value = cachedModel;
    }
});

$PI.onDidReceiveGlobalSettings((payload) => {
    // Handle the received payload here
    if (payload.payload.settings.action === 'sendImage') {
        const imageElement = document.getElementById('currentImage');
        const viewButton = document.getElementById('viewButton');
        
        imageElement.src = payload.payload.settings.image;
        imageElement.style.display = 'block';
        
        // Show view button and set up click handler
        viewButton.style.display = 'block';
        viewButton.onclick = () => {
            viewImage(payload.payload.settings.image);
        };
        
        localStorage.setItem('base64ImageInspector', payload.payload.settings.image);
    }
    if (payload.payload.settings.action === 'sendText') {
        const textElement = document.getElementById('currentText');
        textElement.innerHTML = payload.payload.settings.text;
        textElement.style.display = 'block';
    }
    if (payload.payload.settings.action === 'sendInputText') {
        const positiveTextElement = document.getElementById('positivePrompt');
        const negativeTextElement = document.getElementById('negativePrompt');
        positiveTextElement.value = payload.payload.settings.text.positive;
        negativeTextElement.value = payload.payload.settings.text.negative;
        localStorage.setItem('positivePromptInspector', positiveTextElement.value);
        localStorage.setItem('negativePromptInspector', negativeTextElement.value);
    }
});

// Event listener for the Github button
document.querySelector('#github').addEventListener('click', () => {
    $PI.openUrl('https://github.com/f00d4tehg0dz/elgato-streamdeck-ai-paints');
});

function connectElgatoStreamDeckSocket(inPort, uuid, messageType, appInfoString, actionInfo) {
    websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);
    const delay = window?.initialConnectionDelay || 0;
    setTimeout(() => {
        $PI.connect(inPort, uuid, messageType, appInfoString, actionInfo);
        // const jsonObject = JSON.parse(actionInfo);
        // console.log(jsonObject)
        // const positivePrompt = jsonObject.payload.settings.positive;
        // const negativePrompt = jsonObject.payload.settings.negative;
        // const base64Image = jsonObject.payload.settings.base64Image;

        const cachedPositivePrompt = localStorage.getItem('positivePromptInspector');
        const cachedNegativePrompt = localStorage.getItem('negativePromptInspector');
        const cachedBase64Image = localStorage.getItem('base64ImageInspector');
        const cachedHuggingFaceKey = localStorage.getItem('huggingFaceKeyInspector');
        const cachedModel = localStorage.getItem('modelSelectionInspector');

        const imageElement = document.getElementById('currentImage');
        const positivePromptInput = document.getElementById('positivePrompt');
        const negativePromptInput = document.getElementById('negativePrompt');
        const huggingFaceKeyInput = document.getElementById('huggingFaceKey');
        const modelSelect = document.getElementById('modelSelection');

        if (cachedBase64Image && imageElement) {
            imageElement.src = cachedBase64Image;
            imageElement.style.display = 'block';
            
            // Show view button for cached images
            const viewButton = document.getElementById('viewButton');
            viewButton.style.display = 'block';
            viewButton.onclick = () => {
                viewImage(cachedBase64Image);
            };
        }

        if (cachedPositivePrompt && positivePromptInput) {
            positivePromptInput.value = cachedPositivePrompt;
        }

        if (cachedNegativePrompt && negativePromptInput) {
            negativePromptInput.value = cachedNegativePrompt;
        }

        if (cachedHuggingFaceKey && huggingFaceKeyInput) {
            huggingFaceKeyInput.value = cachedHuggingFaceKey;
        }

        if (cachedModel && modelSelect) {
            modelSelect.value = cachedModel;
        }

        // Event listener for the Update button
        document.querySelector('#update').addEventListener('click', (event) => {
            event.preventDefault(); // Prevent the default form submission behavior

            const positivePrompt = document.getElementById('positivePrompt').value;
            const negativePrompt = document.getElementById('negativePrompt').value;
            const huggingFaceKey = document.getElementById('huggingFaceKey').value;
            const selectedModel = document.getElementById('modelSelection').value;

            // Store values in localStorage
            localStorage.setItem('huggingFaceKeyInspector', huggingFaceKey);
            localStorage.setItem('modelSelectionInspector', selectedModel);

            const payload = {
                positivePrompt,
                negativePrompt,
                huggingFaceKey,
                selectedModel
            };

            $PI.sendToPlugin(payload);
        });
    }, delay);
}

// Activate and handle tabs
function activateTabs(activeTab) {
    const allTabs = Array.from(document.querySelectorAll('.tab'));
    let activeTabEl = null;
    allTabs.forEach((el, i) => {
        el.onclick = () => clickTab(el);
        if (el.dataset?.target === activeTab) {
            activeTabEl = el;
        }
    });
    if (activeTabEl) {
        clickTab(activeTabEl);
    } else if (allTabs.length) {
        clickTab(allTabs[0]);
    }
}

// Handle the click event of a tab
function clickTab(clickedTab) {
    const allTabs = Array.from(document.querySelectorAll('.tab'));
    allTabs.forEach((el, i) => el.classList.remove('selected'));
    clickedTab.classList.add('selected');
    activeTab = clickedTab.dataset?.target;
    allTabs.forEach((el, i) => {
        if (el.dataset.target) {
            const t = document.querySelector(el.dataset.target);
            if (t) {
                t.style.display = el == clickedTab ? 'block' : 'none';
            }
        }
    });
}

// Activate the tabs
activateTabs();