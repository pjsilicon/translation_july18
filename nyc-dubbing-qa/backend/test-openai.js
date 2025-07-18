require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testOpenAI() {
  try {
    console.log('Testing OpenAI connection...');
    
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: "Say 'OpenAI is working!'" }],
      model: "gpt-3.5-turbo",
    });
    
    console.log('✅ OpenAI Response:', completion.choices[0].message.content);
  } catch (error) {
    console.error('❌ OpenAI Error:', error.message);
    if (error.status === 401) {
      console.error('   Invalid API key');
    }
  }
}

testOpenAI();