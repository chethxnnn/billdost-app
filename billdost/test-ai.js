const { streamText } = require('ai');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');
require('dotenv').config({path: '.env.local'});

const ai = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });

async function main() {
  const result = await streamText({
    model: ai('gemini-2.5-flash'),
    messages: [{role: 'user', content: 'hello'}],
  });
  
  const response = result.toUIMessageStreamResponse();
  console.log("Status:", response.status);
  console.log("Headers:", Object.fromEntries(response.headers.entries()));
  
  const reader = response.body.getReader();
  while(true) {
    const {done, value} = await reader.read();
    if(done) break;
    console.log(Buffer.from(value).toString());
  }
}
main().catch(console.error);
