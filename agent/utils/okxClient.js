import crypto from 'crypto';
import 'dotenv/config';


const api_config = {
  api_key: process.env.OKX_API_KEY,     
  secret_key: process.env.OKX_SECRET_KEY,
  passphrase: process.env.OKX_PASSPHRASE, 
  project: process.env.OKX_PROJECT_ID
};

function sign(message, secret_key) {
  
  const hmac = crypto.createHmac('sha256', secret_key);
  hmac.update(message);
  return hmac.digest('base64');
}

export async function sendOKXRequest(method, request_path, params = null) {
 
  const timestamp = new Date().toISOString().slice(0, -5) + 'Z';

  let query_string = '';
  if (method === 'GET' && params) {
    query_string = '?' + new URLSearchParams(params).toString();
  }
  if (method === 'POST' && params) {
    query_string = JSON.stringify(params);
  }

  const message = timestamp + method + request_path + query_string;
  const signature = sign(message, api_config.secret_key);


const headers = {
    'OK-ACCESS-KEY': api_config.api_key,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': api_config.passphrase,
    'OK-ACCESS-PROJECT': api_config.project,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

  const url = `https://web3.okx.com${request_path}${method === 'GET' ? query_string : ''}`;
  
  const options = {
    method: method,
    headers: headers
  };

  if (method === 'POST' && params) {
    options.body = query_string; 
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (data.code !== "0") {
        console.error("OKX API Error:", data.msg);
    }
    
    return data;
  } catch (error) {
    console.error("Failed to communicate with OKX:", error);
    throw error;
  }
}