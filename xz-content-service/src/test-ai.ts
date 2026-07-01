import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '../.env') });

// Configuration options
const TEST_MODE: 'openai' | 'ollama' = 'openai'; // Change to 'ollama' to test locally!
const OLLAMA_MODEL = 'llama3.2'; // The model you downloaded in Ollama (e.g. llama3.2, mistral, gemma2)

async function testTranslation() {
  console.log(`\n--- Starting Translation Test [Mode: ${TEST_MODE}] ---`);
  
  let openai: OpenAI;
  let modelName: string;

  if (TEST_MODE === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith('your-')) {
      console.warn('❌ ERROR: OPENAI_API_KEY is not set or is still a placeholder in .env');
      return;
    }
    openai = new OpenAI({ apiKey });
    modelName = 'gpt-4o-mini';
  } else {
    // Point to local Ollama server (OpenAI-compatible endpoint)
    console.log(`Configuring OpenAI SDK to point to Ollama on http://localhost:11434/v1`);
    openai = new OpenAI({
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'ollama', // Ollama does not require a real API key
    });
    modelName = OLLAMA_MODEL;
  }

  const sampleFrenchText = "Bonjour, bienvenue dans notre programme de mentorat intergénérationnel. Comment puis-je vous aider aujourd'hui ?";
  console.log(`Original (French): "${sampleFrenchText}"`);

  try {
    console.log(`Sending translation request to ${TEST_MODE} using model ${modelName}...`);
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: 'You are an expert translator. Translate the user text from French to English. Return ONLY the translated text.',
        },
        {
          role: 'user',
          content: sampleFrenchText,
        },
      ],
      temperature: 0.3,
    });

    const result = completion.choices[0]?.message?.content?.trim();
    console.log(`\nResult (English): "${result}"`);
    console.log('✅ Translation Test Succeeded!');
  } catch (error: any) {
    console.error('❌ Translation Test Failed:', error.message);
    if (TEST_MODE === 'ollama') {
      console.log('\n💡 Tip: Make sure Ollama is running (`ollama serve`) and you have pulled the model (`ollama pull ' + OLLAMA_MODEL + '`)');
    }
  }
}

// Run the test
testTranslation();
