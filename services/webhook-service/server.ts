import express from 'express';
import ngrok from '@ngrok/ngrok';
import cors from 'cors';
import 'dotenv/config';
import { WebhookPayload } from './types/webhook';  // No extension needed
import { validatePayload } from './lib/payloadValidator';
// Uncomment these if you need them, and install the uuid package
// import fs from 'fs';
// import path from 'path';
// import { execSync } from 'child_process';
// import { v4 as uuidv4 } from 'uuid'; 

const app = express();
const port = Number(process.env.PORT) || 3001;

// Define processor types
const PROCESSOR_TYPES = {
  INVENTORY: 'inventory',
  EVENT: 'event',
  HEARTBEAT: 'heartbeat'
};

// Define variables
// let skiprealsForward = process.env.SKIP_reals_FORWARD === 'true';
let payloads: any[] = [];
let endpointInfo = {
  url: '',
  webhookPath: '/webhook/api/accounts/1/webhooks/source_system'
};



// IMPORTANT: Set up middleware BEFORE defining routes
// Enable CORS for development and production
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));


// Increase all size limits to maximum
app.use(express.json({
  limit: '50mb', // Maximum JSON size
  verify: (req: any, _res, buf) => {
    req.rawBody = buf; // Store raw body buffer
  }
}));
app.use(express.urlencoded({
  limit: '50mb', // Maximum URL-encoded size
  extended: true
}));

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  // Always return 200, to avoid retry loops from upstream
  res.status(200).json({ status: 'success' });
});

// AFTER middleware, define routes
// Settings routes for forwarding toggle
// app.get('/settings/forwarding-status', (req, res) => {
//   res.json({ skiprealsForward });
// });

// app.post('/settings/toggle-forwarding', (req, res) => {
//   skiprealsForward = !skiprealsForward;
//   console.log(`reals forwarding is now ${skiprealsForward ? 'disabled' : 'enabled'}`);
//   res.json({ skiprealsForward });
// });
/*
// Add this new endpoint to simulate reals processing
app.post('/simulate-processor', async (req, res) => {
  try {
    // Debug logging
    console.log('Received simulate-processor request:', {
      contentType: req.headers['content-type'],
      bodyIsEmpty: !req.body,
      bodyKeys: req.body ? Object.keys(req.body) : []
    });
    
    // Make sure we have a body
    if (!req.body) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing request body' 
      });
    }
    
    // Check for required fields
    const { payload, processorType, options = {} } = req.body;
    
    if (!payload) {
      return res.status(400).json({
        success: false,
        error: 'Payload is required'
      });
    }
    
    if (!processorType) {
      return res.status(400).json({
        success: false,
        error: 'Processor type is required'
      });
    }
    
    // Process the payload
    const result = simulateProcessor(payload, processorType, options);
    
    // Send the response
    return res.json(result);
  } catch (error) {
    console.error('Processor simulation error:', error);
    
    // Set CORS headers even for error responses
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
*/
// Define the forwardToreals function
// async function forwardToreals(req: express.Request, payload: any) {
  // If environment variable is set OR toggle is active, skip the actual fetch
  // if (process.env.SKIP_reals_FORWARD === 'true' || skiprealsForward) {
  //   console.log('\n=== Forwarding SKIPPED ===');
  //   payload.forwarding = {
  //     timestamp: new Date().toISOString(),
  //     success: true, // Mark it success so the UI doesn't show an error
  //     status: 200,
  //     statusText: 'Forwarding skipped by user setting',
  //     requestSize: (req as any).rawBody.length,
  //     responseSize: 0,
  //     headers: {},
  //     body: 'Forwarding was intentionally skipped.'
  //   };
  //   return;
  // }

  // try {
  //   const realsUrl = `https://localhost:5173/api/simulators/events`;
  //   const realsInventoryUrl = `https://localhost:5173/api/simulators/inventory`;
  //   const url = payload.EntityInventory ? realsInventoryUrl : realsUrl;

  //   console.log('\n=== Forwarding to reals ===');
  //   console.log('URL:', url);
  //   console.log('Headers:', JSON.stringify(req.headers, null, 2));
  //   console.log('Body Size:', (req as any).rawBody.length, 'bytes');
  //   console.log('Body:', JSON.stringify(req.body, null, 2));

  //   // Forward the request with original headers and raw body
  //   const response = await fetch(url, {
  //     method: req.method,
  //     headers: {
  //       ...req.headers as any,
  //       'host': 'localhost:5173', // Ensure host is set correctly
  //       'accept': 'application/json',
  //       'content-type': 'application/json',
  //       'user-agent': 'Payloads Simulator',
  //       'x-forwarded-for': req.ip || req.connection.remoteAddress,
  //       'x-forwarded-proto': req.protocol,
  //       'x-forwarded-host': req.get('host'),
  //       'x-forwarded-port': req.get('port'),
  //       'x-forwarded-path': req.path,
  //       'x-forwarded-query': req.query,
  //       'x-forwarded-method': req.method,
  //       'x-forwarded-timestamp': new Date().toISOString(),
  //       // Uncomment if you want to include raw body size in headers
  //       'content-length': String((req as any).rawBody.length)
  //     },
  //     body: (req as any).rawBody // Use raw body buffer
  //   });

  //   // Get response as buffer
  //   const responseBuffer = await response.buffer();

  //   // Try parse as JSON, else fallback to text
  //   let parsedBody;
  //   try {
  //     parsedBody = JSON.parse(responseBuffer.toString());
  //   } catch {
  //     parsedBody = responseBuffer.toString();
  //   }

    // console.log('\n=== reals Response ===');
    // console.log('Status:', response.status, response.statusText);
    // console.log('Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    // console.log('Body Size:', responseBuffer.length, 'bytes');
    // console.log('Body:', parsedBody);
    // console.log('======================\n');

  //   payload.forwarding = {
  //     timestamp: new Date().toISOString(),
  //     success: response.ok,
  //     status: response.status,
  //     statusText: response.statusText,
  //     requestSize: (req as any).rawBody.length,
  //     responseSize: responseBuffer.length,
  //     headers: Object.fromEntries(response.headers.entries()),
  //     body: parsedBody
  //   };

  //   return response;
  // } catch (error) {
    // console.error('\n=== reals Forwarding Error ===');
    // console.error(error);
    // console.error('===========================\n');

//     payload.forwarding = {
//       timestamp: new Date().toISOString(),
//       success: false,
//       error: error instanceof Error ? error.message : 'Unknown error'
//     };
//     return null;
//   }
// }



// Pure JavaScript simulation function
function simulateProcessor(payload: any, processorType: string, options: any = {}) {
  console.log(`Simulating ${processorType} processor...`);
  
  // Base result structure
  const result = {
    success: true,
    processorType,
    timestamp: new Date().toISOString(),
    actions: [] as string[],
    entities: [] as any[],
    errors: [] as string[],
    state: {}
  };
  
  try {
    // Simulate different processor types
    switch(processorType) {
      case PROCESSOR_TYPES.INVENTORY:
        simulateInventoryProcessor(payload, result, options);
        break;
        
      case PROCESSOR_TYPES.EVENT:
        simulateEventProcessor(payload, result, options);
        break;
        
      case PROCESSOR_TYPES.HEARTBEAT:
        simulateHeartbeatProcessor(payload, result, options);
        break;
        
      default:
        throw new Error(`Unsupported processor type: ${processorType}`);
    }
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }
  
  return result;
}

// Inventory processor simulation
function simulateInventoryProcessor(payload: any, result: any, options: any = {}) {
  const inventory = payload.body?.EntityInventory;
  if (!inventory) {
    throw new Error('No EntityInventory found in payload');
  }
  
  // Track batch info
  result.actions.push(`Received batch ${inventory.BatchIndex} of ${inventory.BatchCount}`);
  result.state.batchTracking = {
    installationId: inventory.InstallationId,
    timestamp: inventory.Timestamp,
    batchIndex: inventory.BatchIndex,
    batchCount: inventory.BatchCount,
    entityCount: inventory.Count
  };
  
  // Process entities
  inventory.Entities.forEach((entity: any) => {
    const entityType = entity.EntityType;
    const deviceType = getDeviceType(entity);
    
    result.actions.push(`Processing ${entityType}: ${entity.Name}`);
    
    result.entities.push({
      guid: entity.Guid,
      name: entity.Name,
      type: entityType,
      deviceType,
      online: entity.IsOnline === 'Online',
      processed: true
    });
  });
  
  // Simulate batch completion if this is the last batch
  if (inventory.BatchIndex === inventory.BatchCount) {
    result.actions.push('All batches received, finalizing inventory');
    result.state.inventoryFinalized = true;
    result.state.processedEntities = result.entities.length;
  }
}

// Event processor simulation
function simulateEventProcessor(payload: any, result: any, options: any = {}) {
  const eventData = payload.body || {};
  
  if (!eventData.EventType) {
    throw new Error('No event data found in payload');
  }
  
  // Extract key event information
  const eventType = eventData.EventType || 'Unknown';
  const entityType = eventData.EntityType || 'Unknown';
  const guid = eventData.GUID || eventData.EventSourceGuid || null;
  
  result.actions.push(`Processing ${eventType} event for ${entityType}`);
  
  // Process based on event type
  switch(eventType) {
    case 'InterfaceOnline':
    case 'InterfaceOffline':
      handleInterfaceStatusEvent(eventData, result);
      break;
      
    case 'UnitOnline':
    case 'UnitOffline':
      handleUnitStatusEvent(eventData, result);
      break;
      
    case 'CameraOnline':
    case 'CameraOffline':
      handleCameraStatusEvent(eventData, result);
      break;
      
    default:
      result.actions.push(`Unknown event type: ${eventType} - basic processing only`);
  }
  
  // Add entity info
  if (guid) {
    result.entities.push({
      guid,
      eventType,
      entityType,
      processed: true,
      status: eventType.includes('Online') ? 'online' : 'offline'
    });
  }
  
  return result;
}

// Helper functions for event processing
function handleInterfaceStatusEvent(eventData: any, result: any) {
  const status = eventData.EventType.includes('Online') ? 'online' : 'offline';
  result.actions.push(`Updating interface ${eventData.GUID} status to ${status}`);
  
  // Process child modules if present
  if (eventData.ChildModules && eventData.ChildModules.length > 0) {
    result.actions.push(`Processing ${eventData.ChildModules.length} child modules`);
    
    eventData.ChildModules.forEach((module: any) => {
      result.entities.push({
        guid: module.GUID || `child-${Math.random().toString(36).substr(2, 9)}`,
        type: 'InterfaceModule',
        name: module.Name || 'Child Module',
        status: module.IsOnline === 'Online' ? 'online' : 'offline',
        processed: true,
        parentGuid: eventData.GUID
      });
    });
  }
}

function handleUnitStatusEvent(eventData: any, result: any) {
  const status = eventData.EventType.includes('Online') ? 'online' : 'offline';
  result.actions.push(`Updating unit ${eventData.GUID} status to ${status}`);
  
  // Process interface modules if present
  if (eventData.InterfaceModules && eventData.InterfaceModules.length > 0) {
    result.actions.push(`Processing ${eventData.InterfaceModules.length} interface modules`);
    
    eventData.InterfaceModules.forEach((module: any) => {
      result.entities.push({
        guid: module.GUID || `interface-${Math.random().toString(36).substr(2, 9)}`,
        type: 'InterfaceModule',
        name: module.Name || 'Interface Module',
        status: module.IsOnline === 'Online' ? 'online' : 'offline',
        processed: true,
        parentGuid: eventData.GUID
      });
    });
  }
}

function handleCameraStatusEvent(eventData: any, result: any) {
  const status = eventData.EventType.includes('Online') ? 'online' : 'offline';
  result.actions.push(`Updating camera ${eventData.GUID} status to ${status}`);
  
  // If camera is part of a video unit, note that
  if (eventData.ParentInfo) {
    const parentGuids = Object.keys(eventData.ParentInfo);
    if (parentGuids.length > 0) {
      const parentGuid = parentGuids[0];
      const parent = eventData.ParentInfo[parentGuid!];
      
      result.actions.push(`Camera belongs to video unit: ${parent.Name}`);
      result.entities.push({
        guid: parentGuid,
        type: 'VideoUnit',
        name: parent.Name,
        processed: true,
        childUpdated: eventData.GUID
      });
    }
  }
}

// Heartbeat processor simulation
function simulateHeartbeatProcessor(payload: any, result: any, options: any = {}) {
  result.actions.push('Received heartbeat, updating installation last seen timestamp');
  
  const installationId = payload.body?.InstallationId || 'unknown';
  
  result.state = {
    installationId,
    lastHeartbeat: new Date().toISOString(),
    heartbeatCount: Math.floor(Math.random() * 100) + 1 // Simulate count
  };
}

// Helper function to map entity types to device types (similar to Ruby logic)
function getDeviceType(entity: any): string {
  switch (entity.EntityType) {
    case 'Unit':
      return 'access_control_unit';
    case 'AccessControlPanel':
    case 'AccessControlInterface':
    case 'InterfaceModule':
      return 'interface_module';
    case 'VideoUnit':
      return 'video_unit';
    case 'Camera':
      // Check for subtypes through DeviceType
      switch (entity.DeviceType) {
        case 'VideoUnitInputDevice':
          return 'input_device';
        case 'VideoUnitOutputDevice':
          return 'output_device';
        case 'AudioInputDevice':
          return 'audio_input';
        case 'AudioOutputDevice':
          return 'audio_output';
        default:
          return 'camera';
      }
    default:
      return 'unknown';
  }
}

// Commented out for now - uncomment if needed and install uuid package
/*
async function simulateWithRuby(payload: any, processorType: string, options: any = {}) {
  try {
    // Create temporary file to store payload
    const tempId = uuidv4();
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, `payload-${tempId}.json`);
    fs.writeFileSync(tempFilePath, JSON.stringify(payload));
    
    // Create Ruby script name based on processor type
    const scriptName = `${processorType}_processor_sim.rb`;
    const scriptPath = path.join(__dirname, 'ruby_scripts', scriptName);
    
    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Ruby script ${scriptName} not found`);
    }
    
    // Run Ruby script
    const optionsArg = JSON.stringify(options || {});
    const rubyOutput = execSync(
      `ruby ${scriptPath} ${tempFilePath} ${optionsArg}`, 
      { encoding: 'utf8' }
    );
    
    // Parse output as JSON
    const result = JSON.parse(rubyOutput);
    
    // Clean up temp file
    fs.unlinkSync(tempFilePath);
    
    return result;
  } catch (error) {
    console.error('Error running Ruby simulation:', error);
    throw error;
  }
}
*/

// Endpoint to receive payloads - match any path starting with /webhook
app.post('/webhook*', async (req: express.Request<any, any, WebhookPayload>, res) => {
  try {
    console.log('\n=== Received Webhook ===');
    console.log('Path:', req.path);
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body Size:', (req as any).rawBody.length, 'bytes');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('=====================\n');

    // Validate the payload against test cases
    const testResults = validatePayload(req.body);
    console.log('\n=== Test Results ===');
    testResults.forEach((result: any) => {
      console.log(
        `${result.passed ? '✅' : '❌'} ${result.testCase}${
          result.reason ? `: ${result.reason}` : ''
        }`
      );
    });
    console.log('===================\n');

    const payload = {
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: req.body,
      rawBodySize: (req as any).rawBody.length,
      method: req.method,
      path: req.path,
      query: req.query,
      testResults // Add test results to the payload
    };

    // Forward to reals (or skip if SKIP_reals_FORWARD === 'true')
    // await forwardToreals(req, payload);

    // Store payload in memory
    payloads.unshift(payload);
    if (payloads.length > 100) payloads.pop();

    // Always return success
    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(200).json({ status: 'success' });
  }
});

// Endpoint to get all payloads and endpoint info
app.get('/payloads', (_, res) => {
  try {
    res.json({
      payloads,
      endpoint: endpointInfo
    });
  } catch (error) {
    console.error('Error sending payloads:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle 404s with 200 OK to prevent retries
app.use((req, res) => {
  console.log('Caught 404:', req.path);
  res.status(200).json({ status: 'success' });
});

// Start server and ngrok
async function startServer() {
  // Start Express server first
  await new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      resolve();
    });
  });

  try {
    const listener = await ngrok.forward({
      addr: port,
      authtoken: process.env.NGROK_AUTHTOKEN,
      // domain: process.env.NGROK_DOMAIN,
      verify_upstream_tls: false,
      metadata: "Payload Inspector",
      inspect: "true", // Enable the inspector
      labels: ["webhooks", "payload-inspector"],
      // Allow all IPs by default
      // ip_restriction_allow_cidrs: ["0.0.0.0/0", "::/0"]
    });

    const url = listener.url();
    if (!url) throw new Error('Failed to get ngrok URL');

    endpointInfo.url = url;
    console.log(`Ngrok tunnel established at: ${endpointInfo.url}`);
    console.log(`Send webhooks to: ${endpointInfo.url}${endpointInfo.webhookPath}`);
    console.log(
      `Ngrok inspector enabled - visit https://dashboard.ngrok.com/cloud-edge/endpoints to inspect traffic`
    );
  } catch (err) {
    console.error('Error establishing ngrok tunnel:', err);
  }
}

startServer();