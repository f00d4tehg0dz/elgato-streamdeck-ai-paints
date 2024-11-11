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
  try {
    console.log('Polling for request:', requestId);
    
    const response = await fetch(`https://f00d.me/generate-image/check-status/${requestId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Polling error:', {
        status: response.status,
        statusText: response.statusText,
        details: errorData
      });
      return;
    }

    const result = await response.json();
    console.log('Poll result:', result);

    if (result.status === 'completed') {
      console.log('Image ready:', result.image ? result.image.substring(0, 100) + '...' : 'No image');
      $SD.setImage(context, result.image);
      localStorage.setItem('base64Image', result.image);
      sendTextToPlugin("Image generated successfully!");
      sendImageToPlugin(result.image);
    } else if (result.status === 'pending') {
      sendTextToPlugin("Still processing...");
      console.log('Still processing request:', requestId);
      setTimeout(() => pollImageGeneration(requestId, context), 5000);
    } else if (result.status === 'failed') {
      console.error('Generation failed:', {
        error: result.error,
        details: result.details
      });
      sendTextToPlugin(`Failed: ${result.error}\nDetails: ${result.details || 'No additional details'}`);
    }
  } catch (error) {
    console.error('Polling error:', error);
    sendTextToPlugin(`Polling error: ${error.message}`);
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

async function generateImageFromHuggingFace(context, positivePrompt, negativePrompt, apiKey, model) {
  try {
    let apiUrl;
    let payload;

    // Log the input parameters (excluding the API key for security)
    console.log('Generating image with Hugging Face:', {
      model,
      positivePrompt,
      negativePrompt,
      hasApiKey: !!apiKey
    });

    switch (model) {
      case 'flux':
        apiUrl = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev';
        payload = {
          inputs: positivePrompt + (negativePrompt ? ` Negative prompt: ${negativePrompt}` : ''),
          parameters: {
            height: 1024,
            width: 1024,
            guidance_scale: 3.5,
            num_inference_steps: 50
          }
        };
        break;
      case 'sd':
        apiUrl = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0';
        payload = {
          inputs: positivePrompt + (negativePrompt ? ` Negative prompt: ${negativePrompt}` : ''),
          parameters: {
            height: 1024,
            width: 1024,
            guidance_scale: 3.5,
            num_inference_steps: 12
          }
        };
        break;
      default:
        throw new Error(`Unknown model: ${model}`);
    }

    console.log('Making request to:', apiUrl);
    console.log('With payload:', payload);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url: apiUrl
      });

      let errorMessage = `Hugging Face API error (${response.status}): ${response.statusText}`;
      try {
        // Try to parse the error text as JSON
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
          errorMessage += `\nDetails: ${errorJson.error}`;
        }
      } catch (e) {
        // If parsing fails, use the raw error text
        errorMessage += `\nDetails: ${errorText}`;
      }

      throw new Error(errorMessage);
    }

    // Check if the response is actually an image
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('image')) {
      const responseText = await response.text();
      console.error('Unexpected response type:', {
        contentType,
        responseText
      });
      throw new Error('Received invalid response from Hugging Face API');
    }

    // The response will be the image blob
    const blob = await response.blob();
    const base64Image = await blobToBase64(blob);
    
    // Update Stream Deck with the generated image
    $SD.setImage(context, base64Image);
    localStorage.setItem('base64Image', base64Image);
    sendTextToPlugin("Image generated successfully!");
    sendImageToPlugin(base64Image);

    return base64Image;

  } catch (error) {
    console.error("Error generating image:", error);
    sendTextToPlugin(`Failed to generate image: ${error.message}`);
    throw error;
  }
}

// Helper function to convert blob to base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function generateImageFromPrompt(context, positivePrompt, negativePrompt, huggingFaceKey = null, selectedModel = null) {
  try {
    console.log('Generating image with:', {
      positivePrompt,
      negativePrompt,
      hasHuggingFaceKey: !!huggingFaceKey,
      selectedModel
    });

    if (huggingFaceKey && huggingFaceKey.trim() !== '') {
      return await generateImageFromHuggingFace(context, positivePrompt, negativePrompt, huggingFaceKey, selectedModel);
    }

    const prompt = `${positivePrompt} ${negativePrompt}`;
    console.log('Sending prompt to local server:', prompt);

    const response = await fetch('https://f00d.me/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server error:', errorData);
      const errorMessage = `Failed to generate image: ${response.statusText}\nDetails: ${JSON.stringify(errorData)}`;
      sendTextToPlugin(errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Server response:', data);

    if (!data.requestId) {
      throw new Error('No requestId received from server');
    }

    sendTextToPlugin("Generating image, please wait...");
    await pollImageGeneration(data.requestId, context);
    
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    sendTextToPlugin(`Error: ${error.message}`);
    throw error;
  }
}

// Register the onSendToPlugin event handler
myAction.onSendToPlugin((payload) => {
  const innerPayload = payload.payload;
  const context = payload.context;
  const positivePrompt = innerPayload.positivePrompt;
  const negativePrompt = innerPayload.negativePrompt;
  const huggingFaceKey = innerPayload.huggingFaceKey;
  const selectedModel = innerPayload.selectedModel;

  // Store all relevant data in the cache object
  cache.payload = {
    positivePrompt,
    negativePrompt,
    huggingFaceKey,
    selectedModel
  };

  // Save all values to localStorage
  localStorage.setItem('positivePrompt', positivePrompt);
  localStorage.setItem('negativePrompt', negativePrompt);
  localStorage.setItem('huggingFaceKey', huggingFaceKey);
  localStorage.setItem('modelSelection', selectedModel);
  
  sendTextToPlugin("Generating, Please wait...");

  if (innerPayload) {
    generateImageFromPrompt(context, positivePrompt, negativePrompt, huggingFaceKey, selectedModel)
      .then((base64Image) => {
        if (base64Image) {
          $SD.setImage(context, base64Image);
          $SD.setSettings(context, { 
            base64Image: base64Image, 
            positive: positivePrompt, 
            negative: negativePrompt 
          });
          localStorage.setItem('base64Image', base64Image);
          sendTextToPlugin("");
          sendImageToPlugin(base64Image);
        }
      })
      .catch((err) => {
        console.error("Error:", err);
        sendTextToPlugin(`Error: ${err.message}`);
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
  const cachedHuggingFaceKey = localStorage.getItem('huggingFaceKey');
  const cachedModel = localStorage.getItem('modelSelection');

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
    generateImageFromPrompt(
      context, 
      currentTextPrompt.positive, 
      currentTextPrompt.negative,
      cachedHuggingFaceKey,
      cachedModel
    )
    .then((base64Image) => {
      if (base64Image) {
        $SD.setImage(context, base64Image);
        $SD.setSettings(context, { 
          base64Image: base64Image, 
          positive: currentTextPrompt.positive, 
          negative: currentTextPrompt.negative 
        });
        sendImageToPlugin(base64Image);
        sendTextToPlugin("");
        localStorage.setItem('base64Image', base64Image);
      }
    })
    .catch((err) => {
      console.error("Failed to load image:", err);
      sendTextToPlugin(`Failed to load image: ${err.message}`);
    });
  }
});

// Register the onKeyUp event handler
myAction.onKeyUp(({ action, context, device, event }) => {
  // Retrieve the latest payload from the cache
  const payload = cache.payload;

  // Check if payload is available
  if (payload) {
    const { positivePrompt, negativePrompt, huggingFaceKey, selectedModel } = payload;

    generateImageFromPrompt(context, positivePrompt, negativePrompt, huggingFaceKey, selectedModel)
      .then((base64Image) => {
        if (base64Image) {
          $SD.setImage(context, base64Image);
          $SD.setSettings(context, { 
            base64Image: base64Image, 
            positive: positivePrompt, 
            negative: negativePrompt 
          });
          sendImageToPlugin(base64Image);
          sendTextToPlugin("");
          localStorage.setItem('base64Image', base64Image);
        }
      })
      .catch((err) => {
        console.error("Error:", err);
        sendTextToPlugin(`Failed to load image: ${err.message}`);
      });
  } else {
    console.log('No payload available');
  }
});
