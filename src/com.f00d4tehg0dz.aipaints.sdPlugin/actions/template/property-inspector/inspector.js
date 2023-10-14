/// <reference path="../../../libs/js/property-inspector.js" />
/// <reference path="../../../libs/js/utils.js" />
let activeTab = null;
// Establish WebSocket connection to app.js
var websocket = null;

// Triggered when the plugin is connected to the Stream Deck
$PI.onConnected((jsn) => {
    const { actionInfo, appInfo, connection, messageType, port, uuid } = jsn;
    const { payload, context } = actionInfo;
    const { settings } = payload;

    // Retrieve cached values from localStorage
    const cachedPositivePrompt = localStorage.getItem('positivePrompt');
    const cachedNegativePrompt = localStorage.getItem('negativePrompt');
    const cachedBase64Image = localStorage.getItem('base64Image');

    const imageElement = document.getElementById('currentImage');
    const positivePromptInput = document.getElementById('positivePrompt');
    const negativePromptInput = document.getElementById('negativePrompt');

    if (cachedBase64Image && imageElement) {
        imageElement.src = cachedBase64Image;
        imageElement.style.display = 'block';
    }

    if (cachedPositivePrompt && positivePromptInput) {
        positivePromptInput.value = cachedPositivePrompt;
    }

    if (cachedNegativePrompt && negativePromptInput) {
        negativePromptInput.value = cachedNegativePrompt;
    }
});

$PI.onDidReceiveGlobalSettings((payload) => {
    // Handle the received payload here
    if (payload.payload.settings.action === 'sendImage') {
        const imageElement = document.getElementById('currentImage');
        imageElement.src = payload.payload.settings.image;
        imageElement.style.display = 'block';
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
    }
});

// Event listener for the Github button
document.querySelector('#github').addEventListener('click', () => {
    $PI.openUrl('https://github.com/f00d4tehg0dz/elgato-streamdeck-ai-paints');
});

function connectElgatoStreamDeckSocket(inPort, uuid, messageType, appInfoString, actionInfo) {
    const { actionName } = actionInfo;
    websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);
    const delay = window?.initialConnectionDelay || 0;
    setTimeout(() => {
        $PI.connect(inPort, uuid, messageType, appInfoString, actionInfo);

        // Event listener for the Update button
        document.querySelector('#update').addEventListener('click', (event) => {
            event.preventDefault(); // Prevent the default form submission behavior

            // Retrieve the values of positive and negative prompts
            const positivePrompt = document.getElementById('positivePrompt').value;
            const negativePrompt = document.getElementById('negativePrompt').value;

            // Create the payload object with the prompts
            const payload = {
                positivePrompt: positivePrompt,
                negativePrompt: negativePrompt
            };

            $PI.sendToPlugin(payload)
            // Send the message to the App
            //websocket.send(messageString);
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