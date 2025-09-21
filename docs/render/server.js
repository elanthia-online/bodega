const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  next();
});

// Handle preflight requests
app.options('/upload', (req, res) => {
  res.status(200).send();
});

// Upload endpoint
app.post('/upload', async (req, res) => {
  try {
    console.log('Received upload request');

    const uploadData = req.body;

    // Check if this is the new format with gist_url (bodega already created the gist)
    if (uploadData.gist_url) {
      console.log(`Processing pre-created gist: ${uploadData.gist_url}`);

      // Extract gist ID from URL
      const gistMatch = uploadData.gist_url.match(/\/([a-f0-9]+)$/);
      const gistId = gistMatch ? gistMatch[1] : null;

      // Trigger repository_dispatch with the provided gist URL
      const dispatchPayload = {
        event_type: 'shop_data_upload',
        client_payload: {
          gist_url: uploadData.gist_url,
          gist_id: gistId,
          file_count: uploadData.file_count || 0,
          timestamp: uploadData.timestamp || new Date().toISOString(),
          source: uploadData.source || 'bodega-script-gist'
        }
      };

      const dispatchResult = await makeGitHubRequest('/repos/elanthia-online/bodega/dispatches', 'POST', dispatchPayload);

      if (dispatchResult.success) {
        return res.json({
          message: 'Workflow triggered successfully',
          gist_url: uploadData.gist_url,
          timestamp: dispatchPayload.client_payload.timestamp
        });
      } else {
        console.error('Failed to trigger workflow:', dispatchResult.error);
        return res.status(500).json({
          error: 'Failed to trigger workflow',
          details: dispatchResult.error
        });
      }
    }

    // Legacy format - create gist from files (fallback for old bodega versions)
    if (!uploadData.files || typeof uploadData.files !== 'object') {
      return res.status(400).json({
        error: 'Missing required data (neither gist_url nor files provided)'
      });
    }

    console.log(`Legacy mode: Processing upload with ${Object.keys(uploadData.files).length} files`);

    // Create a gist with all the files
    const gistResult = await createGist(uploadData.files);

    if (!gistResult.success) {
      console.error('Failed to create gist:', gistResult.error);
      return res.status(500).json({
        error: 'Failed to create gist',
        details: gistResult.error
      });
    }

    console.log(`Gist created: ${gistResult.url}`);

    // Trigger repository_dispatch with just the gist URL
    const dispatchPayload = {
      event_type: 'shop_data_upload',
      client_payload: {
        gist_url: gistResult.url,
        gist_id: gistResult.id,
        file_count: Object.keys(uploadData.files).length,
        timestamp: new Date().toISOString(),
        source: uploadData.source || 'bodega-api'
      }
    };

    const dispatchResult = await makeGitHubRequest('/repos/elanthia-online/bodega/dispatches', 'POST', dispatchPayload);

    if (dispatchResult.success) {
      res.json({
        message: 'Upload successful via gist',
        gist_url: gistResult.url,
        timestamp: dispatchPayload.client_payload.timestamp
      });
    } else {
      console.error('Failed to trigger workflow:', dispatchResult.error);
      // Still return success since gist was created
      res.json({
        message: 'Gist created but workflow trigger failed',
        gist_url: gistResult.url,
        error: dispatchResult.error
      });
    }

  } catch (error) {
    console.error('Function error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

async function createGist(files) {
  const gistPayload = {
    description: `Bodega shop data upload - ${new Date().toISOString()}`,
    public: false,
    files: {}
  };

  // Add each file to the gist
  for (const [filename, content] of Object.entries(files)) {
    gistPayload.files[filename] = {
      content: typeof content === 'string' ? content : JSON.stringify(content)
    };
  }

  const result = await makeGitHubRequest('/gists', 'POST', gistPayload);

  if (result.success) {
    const gistData = JSON.parse(result.data);
    return {
      success: true,
      url: gistData.html_url,
      id: gistData.id
    };
  } else {
    return {
      success: false,
      error: result.error
    };
  }
}

function makeGitHubRequest(path, method, payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);

    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'User-Agent': 'Bodega-Render-API/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: responseData });
        } else {
          resolve({
            success: false,
            error: `HTTP ${res.statusCode}: ${responseData}`
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    req.write(data);
    req.end();
  });
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Bodega Upload API is running',
    endpoints: ['/upload'],
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Bodega Upload API running on port ${PORT}`);
});