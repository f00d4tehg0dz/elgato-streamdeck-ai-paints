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

  // console.log(innerPayload)
  // Check if payload is available
  if (innerPayload) {

    // Call the startSocket function with the prompts
    startSocket(context, positivePrompt, negativePrompt)
      .then(base64Image => {
        // *** TODO | CLEANUP *** //
        // console.log("OnSendToPlugin", base64Image)
        // // Set the image using the returned base64 image
        // $SD.setImage(context, base64Image);
        // $SD.setSettings(context, { base64Image: base64Image, positive: positivePrompt, negative: negativePrompt });
      })
      .catch(err => {
        console.error("Error:", err);
      });
    }
});

// Generate a hash for the WebSocket connection
function generateHash() {
  function makeID(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
  }

  // String printing in hash
  let hash = makeID(11);
  return {
    session_hash: hash,
    fn_index: 3
  };
}

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
    loadImageFromText(lastImage).then(base64Image => {
      $SD.setImage(context, base64Image);
      $SD.setSettings(context, { base64Image: base64Image, positive: currentTextPrompt.positive, negative: currentTextPrompt.negative });

      // Save the new image to localStorage
      localStorage.setItem('base64Image', base64Image);
    }).catch(err => {
      console.error("Failed to load image:", err);
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

    // Call the startSocket function with the prompts
    startSocket(context, positivePrompt, negativePrompt)
      .then(base64Image => {
        // Set the image using the returned base64 image
        $SD.setImage(context, base64Image);
        $SD.setSettings(context, { base64Image: base64Image, positive: positivePrompt, negative: negativePrompt });
        // Save the new image to localStorage
        localStorage.setItem('base64Image', base64Image);

      })
      .catch(err => {
        console.error("Error:", err);
      });
  } else {
    console.log('No payload available');
  }
});

// Start the WebSocket connection and send positive and negative inputs
async function startSocket(context, positivePrompt, negativePrompt) {
  return new Promise((resolve, reject) => {
    // Open the WebSocket connection to your server
    const ws = new WebSocket(atob('d3NzOi8vc3RhYmlsaXR5YWktc3RhYmxlLWRpZmZ1c2lvbi5oZi5zcGFjZS9xdWV1ZS9qb2lu'));
    let timerCounter = null;
    let sentData = false;
    // const savedPositivePrompt = localStorage.getItem('positivePrompt');
    // const savedNegativePrompt = localStorage.getItem('negativePrompt');

    const delayBetweenSteps = 60000; // 60 second delay between steps
    ws.onopen = () => {
      // WebSocket is connected, send message
      const hash = generateHash();
      ws.send(JSON.stringify(hash));
      //console.log('Hash Sent', hash);
    };

    ws.onmessage = event => {
      const hash = generateHash();
      const message = event.data;
      //console.log('Received message:', message);
      const msg = JSON.parse(message);
      if (msg.msg === 'send_data') {
        if (!sentData) {
          const data = {
            data: [positivePrompt, negativePrompt, 9],
            ...hash,
          };
          //console.log('Data sent:', data);
          ws.send(JSON.stringify(data));
          sentData = true;
          // Wait before resolving to proceed to the next step
          setTimeout(() => {
            resolve();
          }, delayBetweenSteps);
        }
      } else if (msg.msg === 'estimation') {
        const timeToComplete = ('Time till generation ' + msg.rank_eta)

        sendTextToPlugin(timeToComplete)
        // Wait before resolving to proceed to the next step
        setTimeout(() => {
          resolve();
        }, delayBetweenSteps);
      } else if (msg.msg === 'process_starts') {

        sendTextToPlugin("Generating, Please wait")
        // Wait before resolving to proceed to the next step
        setTimeout(() => {
          resolve();
        }, delayBetweenSteps);
      }
      else if (msg.msg === 'process_completed') {
        clearTimeout(timerCounter);
        try {
          const results = msg.output.data[0];
          sendTextToPlugin("");
          const base64Image = results[0]; // Assuming the base64 image is the first element

          // Define a recursive function to wait for a valid base64Image
          function sendImageWithRetry() {
            if (base64Image && base64Image !== 'undefined') {
              // Resolve with the base64 image
              // console.log("resolve and sendImageToPlugin", base64Image);
              resolve(base64Image);
              $SD.setImage(context, base64Image);
              // Save the new image to localStorage
              localStorage.setItem('base64Image', base64Image);
              sendImageToPlugin(base64Image);
            } else {
              // Retry after a delay
              setTimeout(sendImageWithRetry, 1000); // Adjust the delay as needed
            }
          }

          // Call the recursive function to wait for a valid base64Image
          sendImageWithRetry();

          ws.close();
        } catch (error) {
          console.error(error);
          // Close the WebSocket connection if an error occurs
          ws.close();
          reject(error);
        }

      } else if (msg.msg === 'queue_full') {
        const queue = "Queue is full!"

        sendTextToPlugin(queue)
        // Close the WebSocket connection if the queue is full
        ws.close();
        reject(new Error('Queue is full'));
      }
    };

    ws.onclose = () => {
      // WebSocket connection closed
      reject(new Error('WebSocket connection closed'));
    };

    ws.onerror = error => {
      // WebSocket error occurred
      sendTextToPlugin("Error", error)
      console.error('WebSocket error:', error);
      reject(error);
    };

    // Close the WebSocket connection after 12000ms
    timerCounter = setTimeout(() => {
      ws.close();
      sendTextToPlugin("Timed out, please try again")
      reject(new Error('WebSocket connection timeout'));
    }, 550000);
  })
}