/// <reference path="../../../libs/js/api.js" />
const myAction = new Action('com.f00d4tehg0dz.aipaints.action');

let lastImage = null;
const cache = {}; // Define the cache object to store the payload
/**
 * The first event fired when Stream Deck starts
 */
$SD.onConnected(({ actionInfo, appInfo, connection, messageType, port, uuid }) => {
  console.log('Stream Deck connected!');
});

// Register the onSendToPlugin event handler
myAction.onSendToPlugin((payload) => {
  const innerPayload = payload.payload;
  const context = payload.context;
  const positivePrompt = innerPayload.positivePrompt;
  const negativePrompt = innerPayload.negativePrompt;

  // Store the payload in the cache object
  cache.payload = innerPayload;

  startSocket(context, positivePrompt, negativePrompt)
    .then(base64Image => {
      // Set the image using the returned base64 image
      $SD.setImage(context, base64Image);
    })
    .catch(err => {
      console.error("Error:", err);
    });
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
  console.log(message)
  $SD.setGlobalSettings(message);
}

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
    const ws = new WebSocket('wss://stabilityai-stable-diffusion.hf.space/queue/join');
    let timerCounter = null;
    let sentData = false;

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
        const timeToComplete = ('Time to generate ' + msg.rank_eta)

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
          sendTextToPlugin("")
          const base64Image = results[0]; // Assuming the base64 image is the first element
          // Resolve with the base64 image
          resolve(base64Image);
          sendImageToPlugin(base64Image)

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
      //console.log('WebSocket connection closed');

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
    }, 55000);
  })
}