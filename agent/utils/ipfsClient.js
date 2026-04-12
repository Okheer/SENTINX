// agent/utils/ipfsClient.js
import 'dotenv/config'; 

export async function pinEvidenceToIPFS(evidenceJSON) {
  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 
        'pinata_secret_api_key': process.env.PINATA_SECRET_API_KEY
      },
      body: JSON.stringify(evidenceJSON) 
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pinata API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return `ipfs://${data.IpfsHash}`;
    
  } catch (error) {
    console.error("IPFS Pinning Failed:", error);
    throw error;
  }
}