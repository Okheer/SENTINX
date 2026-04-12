import { sendOKXRequest } from './utils/okxClient.js';

async function provisionTEEWallet() {
  console.log("Initiating secure connection to OKX TEE...");

  // The endpoint to fetch the wallet addresses associated with your API Key session
  const testPath = '/api/v5/waas/wallet/account/addresses'; 
  
  // Notice we must include the project ID parameter for WaaS API calls
  const testParams = {
    projectId: process.env.OKX_PROJECT_ID
  };

  try {
    const response = await sendOKXRequest('GET', testPath, testParams);
    
    if (response.code === "0") {
      console.log("\n✅ SUCCESS! TEE Connection Established.");
      console.log("Here is the raw response from the OKX hardware enclave:");
      console.log(JSON.stringify(response.data, null, 2));
      
      // If the data array is empty, it means we authenticated successfully, 
      // but haven't actually hit the "create" endpoint yet. We will do that next!
    } else {
      console.log("\n❌ ERROR:", response.msg);
    }
  } catch (error) {
    console.error("Test failed to execute:", error);
  }
}

provisionTEEWallet();