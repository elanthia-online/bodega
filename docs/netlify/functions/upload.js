const https = require('https');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle preflight CORS requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST'
      },
      body: ''
    };
  }

  try {
    // Parse the incoming JSON data
    const uploadData = JSON.parse(event.body);

    // Check if this is individual file upload format
    if (uploadData.filename && uploadData.session_id) {
      return await handleIndividualFileUpload(uploadData);
    }

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
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            message: 'Workflow triggered successfully',
            gist_url: uploadData.gist_url,
            timestamp: dispatchPayload.client_payload.timestamp
          })
        };
      } else {
        console.error('Failed to trigger workflow:', dispatchResult.error);
        return {
          statusCode: 500,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            error: 'Failed to trigger workflow',
            details: dispatchResult.error
          })
        };
      }
    }

    // Legacy format - create gist from files (fallback for old bodega versions)
    if (!uploadData.files || typeof uploadData.files !== 'object') {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing required data (neither gist_url nor files provided)' })
      };
    }

    console.log(`Legacy mode: Processing upload with ${Object.keys(uploadData.files).length} files`);

    // Create a gist with all the files
    const gistResult = await createGist(uploadData.files);

    if (!gistResult.success) {
      console.error('Failed to create gist:', gistResult.error);
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Failed to create gist', details: gistResult.error })
      };
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
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Upload successful via gist',
          gist_url: gistResult.url,
          timestamp: dispatchPayload.client_payload.timestamp
        })
      };
    } else {
      console.error('Failed to trigger workflow:', dispatchResult.error);
      // Still return success since gist was created
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Gist created but workflow trigger failed',
          gist_url: gistResult.url,
          error: dispatchResult.error
        })
      };
    }

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};

// Global storage for multi-file upload sessions (in production, use Redis or similar)
const uploadSessions = new Map();

async function handleIndividualFileUpload(uploadData) {
  const { filename, content, session_id, file_index, total_files, is_final, timestamp, source } = uploadData;

  console.log(`Receiving file ${file_index}/${total_files}: ${filename} (${content.length} chars) for session ${session_id}`);

  // Get or create session
  if (!uploadSessions.has(session_id)) {
    uploadSessions.set(session_id, {
      files: {},
      totalExpected: total_files,
      timestamp: timestamp,
      source: source
    });
  }

  const session = uploadSessions.get(session_id);

  // Add this file to the session
  session.files[filename] = content;

  console.log(`Session ${session_id} now has ${Object.keys(session.files).length}/${session.totalExpected} files`);

  // If this is not the final file, just acknowledge receipt
  if (!is_final) {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        message: `File ${filename} received (${file_index}/${total_files})`,
        session_id: session_id,
        files_received: Object.keys(session.files).length
      })
    };
  }

  // This is the final file - create gist and trigger workflow
  console.log(`Final file received for session ${session_id}. Creating gist...`);

  try {
    // Reassemble any split files before creating gist
    const reassembledFiles = await reassembleSplitFiles(session.files);

    // Create gist with reassembled files
    const gistResult = await createGist(reassembledFiles);

    if (!gistResult.success) {
      console.error('Failed to create gist:', gistResult.error);
      uploadSessions.delete(session_id); // Clean up
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Failed to create gist', details: gistResult.error })
      };
    }

    console.log(`Gist created: ${gistResult.url}`);

    // Trigger repository_dispatch
    const dispatchPayload = {
      event_type: 'shop_data_upload',
      client_payload: {
        gist_url: gistResult.url,
        gist_id: gistResult.id,
        file_count: Object.keys(session.files).length,
        timestamp: session.timestamp,
        source: session.source
      }
    };

    const dispatchResult = await makeGitHubRequest('/repos/elanthia-online/bodega/dispatches', 'POST', dispatchPayload);

    // Clean up session
    uploadSessions.delete(session_id);

    if (dispatchResult.success) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Multi-file upload complete and workflow triggered',
          gist_url: gistResult.url,
          session_id: session_id,
          file_count: Object.keys(session.files).length,
          timestamp: session.timestamp
        })
      };
    } else {
      console.error('Failed to trigger workflow:', dispatchResult.error);
      return {
        statusCode: 200, // Still return success since gist was created
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          message: 'Multi-file upload complete, gist created but workflow trigger failed',
          gist_url: gistResult.url,
          error: dispatchResult.error
        })
      };
    }

  } catch (error) {
    console.error('Error processing final file:', error);
    uploadSessions.delete(session_id); // Clean up
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Failed to process multi-file upload',
        details: error.message
      })
    };
  }
}

async function reassembleSplitFiles(files) {
  const reassembled = {};
  const splitFiles = {};

  // First, identify split files and regular files
  for (const [filename, content] of Object.entries(files)) {
    if (filename.includes('_part') && filename.includes('of')) {
      // This is a split file like "wehnimers_landing_part1of3.json"
      const match = filename.match(/^(.+)_part(\d+)of(\d+)\.json$/);
      if (match) {
        const [, baseName, partNum, totalParts] = match;
        const originalName = `${baseName}.json`;

        if (!splitFiles[originalName]) {
          splitFiles[originalName] = {};
        }

        splitFiles[originalName][partNum] = {
          content: content,
          totalParts: parseInt(totalParts)
        };
      } else {
        // Fallback for malformed split filename
        reassembled[filename] = content;
      }
    } else {
      // Regular file
      reassembled[filename] = content;
    }
  }

  // Reassemble split files
  for (const [originalName, parts] of Object.entries(splitFiles)) {
    console.log(`Reassembling ${originalName} from ${Object.keys(parts).length} parts`);

    const totalParts = parts['1']?.totalParts || Object.keys(parts).length;
    const allShops = [];
    let baseData = null;

    // Sort parts by part number and combine shops
    for (let i = 1; i <= totalParts; i++) {
      const part = parts[i.toString()];
      if (!part) {
        console.error(`Missing part ${i} for ${originalName}`);
        continue;
      }

      try {
        const partData = JSON.parse(part.content);

        if (!baseData) {
          baseData = { ...partData };
          delete baseData.shops;
          delete baseData.chunk_info;
        }

        if (partData.shops && Array.isArray(partData.shops)) {
          allShops.push(...partData.shops);
        }
      } catch (error) {
        console.error(`Error parsing part ${i} of ${originalName}:`, error);
      }
    }

    if (baseData && allShops.length > 0) {
      baseData.shops = allShops;
      reassembled[originalName] = JSON.stringify(baseData);
      console.log(`Reassembled ${originalName}: ${allShops.length} shops, ${reassembled[originalName].length} bytes`);
    } else {
      console.error(`Failed to reassemble ${originalName}`);
    }
  }

  return reassembled;
}

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
        'User-Agent': 'Bodega-Netlify-Function/2.0'
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