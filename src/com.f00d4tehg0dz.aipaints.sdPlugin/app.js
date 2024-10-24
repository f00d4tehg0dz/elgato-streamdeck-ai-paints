/// <reference path="../../../libs/js/api.js" />
const myAction = new Action('com.f00d4tehg0dz.aipaints.action');
let lastImage = null;
const cache = {}; // Define the cache object to store the payload
/**
 * The first event fired when Stream Deck starts
 */
$SD.onConnected(({ actionInfo, appInfo, connection, messageType, port, uuid }) => {
  console.log('Stream Deck connected!');

  // Check if actionInfo and actionInfo.payload are defined
  if (actionInfo && actionInfo.payload) {
    const { payload, context } = actionInfo;
    // const { settings } = payload;

    // Retrieve cached values from localStorage
    const cachedPositivePrompt = localStorage.getItem('positivePrompt');
    const cachedNegativePrompt = localStorage.getItem('negativePrompt');
    const cachedBase64Image = localStorage.getItem('base64Image');

    if (cachedBase64Image) {
      // Use the cached image
      $SD.setImage(context, cachedBase64Image);
    }

    if (cachedPositivePrompt && cachedNegativePrompt) {
      // Use the cached prompts
      sendInputTextToPlugin(cachedPositivePrompt, cachedNegativePrompt);
    }
  }
});

async function pollImageGeneration(requestId, context) {
  const response = await fetch(`https://f00d.me/generate-image/check-status/${requestId}`);
  
  if (!response.ok) {
    console.error(`Failed to poll status: ${response.statusText}`);
    return;
  }

  const result = await response.json();

  if (result.status === 'completed') {
    console.log('Image ready:', result.image);
    // Update Stream Deck with the generated image
    $SD.setImage(context, result.image);
    localStorage.setItem('base64Image', result.image);
    sendTextToPlugin("Image generated successfully!");
    sendImageToPlugin( result.image);
  } else if (result.status === 'pending') {
    sendTextToPlugin("Still processing...");
    console.log('Still processing...');
    setTimeout(() => pollImageGeneration(requestId, context), 5000); // Poll every 5 seconds
  } else if (result.status === 'failed') {
    console.error('Failed to generate image:', result.error);
    sendTextToPlugin(`Failed: ${result.error}, maybe you hit the max images(10) allowed to be generated per hour?`);
  }
}

async function queryBackendForImage(prompt) {
  const response = await fetch('https://f00d.me/generate-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: prompt }),
  });

  if (!response.ok) {
    sendTextToPlugin(`Failed to generate image: ${response.statusText}`)
    throw new Error(`Failed to generate image: ${response.statusText}`);
  }

  const result = await response.json();
  return result.image;
}

async function generateImageFromPrompt(context, positivePrompt, negativePrompt) {
  try {
    const prompt = `${positivePrompt} ${negativePrompt}`;
    
    const response = await fetch('https://f00d.me/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: prompt }),
    });

    if (!response.ok) {
      sendTextToPlugin(`Failed to generate image: ${response.statusText}`);
      throw new Error(`Failed to generate image: ${response.statusText}`);
    }

    const { requestId } = await response.json();
    sendTextToPlugin("Generating image, please wait...");

    // Start polling for the image generation status
    pollImageGeneration(requestId, context);
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}

// Register the onSendToPlugin event handler
myAction.onSendToPlugin((payload) => {
  const innerPayload = payload.payload;
  const context = payload.context;
  const positivePrompt = innerPayload.positivePrompt;
  const negativePrompt = innerPayload.negativePrompt;

  // Store the payload in the cache object
  cache.payload = innerPayload;

  // Save the prompts to localStorage
  localStorage.setItem('positivePrompt', positivePrompt);
  localStorage.setItem('negativePrompt', negativePrompt);
  localStorage.setItem('base64Image', innerPayload.base64Image);
    sendTextToPlugin("Generating, Please wait up to 2 minutes")
  // console.log(innerPayload)
  // Check if payload is available
  if (innerPayload) {
    generateImageFromPrompt(context, positivePrompt, negativePrompt)
      .then((base64Image) => {
        // Set the image using the returned base64 image
        $SD.setImage(context, base64Image);
        $SD.setSettings(context, { base64Image: base64Image, positive: positivePrompt, negative: negativePrompt }); 
        sendTextToPlugin("")
        sendImageToPlugin(base64Image);
      })
      .catch((err) => {
        console.error("Error:", err);
      });
  }
});

function sendImageToPlugin(image) {
  const message = {
    action: 'sendImage',
    image: image
  };
  $SD.setGlobalSettings(message);
}

function sendTextToPlugin(text) {
  const message = {
    action: 'sendText',
    text: text,
  };
  $SD.setGlobalSettings(message);
}

function sendInputTextToPlugin(positiveInput, negativeInput) {

  const message = {
    action: 'sendInputText',
    text: {"positive": positiveInput, "negative": negativeInput},
  };
  $SD.setGlobalSettings(message);
}

/**
 * Load an image and text from cache
 * @param {string} currentTextPrompt -The current text
 * @returns {Promise<string|null>} - The base64 representation of the image or null if the image is undefined
 */
function loadImageFromText(currentTextPrompt) {
  return new Promise((resolved) => {
      if (!currentTextPrompt) {
          resolved(null);
      }
      // init and define
      // let image = new Image();
      // image.src = currentTextPrompt;
      // image.onload = function () {
      //     let canvas = document.createElement('canvas');
      //     canvas.width = this.width;
      //     canvas.height = this.height;

      //     let ctx = canvas.getContext('2d');
      //     ctx.drawImage(this, 0, 0, this.width, this.height);

          // canvas.toBlob(function (blob) {
          //     let reader = new FileReader();
          //     reader.onloadend = function () {
          //       resolved(reader.result);
          //     }
          //     reader.readAsDataURL(blob);
          // });
      // };
  });
}

// Fetch your data if nothing is prompted
let textPrompt = [];
fetch('./textPrompts.json')
    .then(response => response.json())
    .then(data => {
      textPrompt = data;
    })
    .catch(error => console.error("Failed to retrieve JSON data:", error));

// Handle the onWillAppear event
myAction.onWillAppear(({ context, settings }) => {
  const cachedPositivePrompt = localStorage.getItem('positivePrompt');
  const cachedNegativePrompt = localStorage.getItem('negativePrompt');
  const cachedBase64Image = localStorage.getItem('base64Image');

  if (cachedBase64Image) {
    // Use the cached image
    $SD.setImage(context, cachedBase64Image);
    sendInputTextToPlugin(cachedPositivePrompt, cachedNegativePrompt);
  } else {
    // Get a new random text prompt if no last image is available
    const currentTextPrompt = textPrompt[Math.floor(Math.random() * textPrompt.length)];
    lastImage = currentTextPrompt.image;

    // Load the image and update the button image
    sendInputTextToPlugin(currentTextPrompt.positive, currentTextPrompt.negative);
    generateImageFromPrompt(context, currentTextPrompt.positive, currentTextPrompt.negative)
    .then((base64Image) => {
      $SD.setImage(context, base64Image);
      $SD.setSettings(context, { base64Image: base64Image, positive: currentTextPrompt.positive, negative: currentTextPrompt.negative });
      sendImageToPlugin(base64Image);
      sendTextToPlugin("")
      localStorage.setItem('base64Image', base64Image);
    })
    .catch((err) => {
      console.error("Failed to load image:", err);
      sendTextToPlugin("Failed to load image:")
    });
  }
});

// Register the onKeyUp event handler
myAction.onKeyUp(({ action, context, device, event }) => {
  // Retrieve the latest payload from the cache
  const payload = cache.payload;

  // Check if payload is available
  if (payload) {
    const { positivePrompt, negativePrompt } = payload;

    generateImageFromPrompt(context, positivePrompt, negativePrompt)
    .then((base64Image) => {
      $SD.setImage(context, base64Image);
      $SD.setSettings(context, { base64Image: base64Image, positive: positivePrompt, negative: negativePrompt });
      sendImageToPlugin(base64Image);
      sendTextToPlugin("")
      localStorage.setItem('base64Image', base64Image);
    })
    .catch((err) => {
      console.error("Error:", err);
      sendTextToPlugin("Failed to load image:")
    });
  } else {
    console.log('No payload available');
  }
});
