import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY || process.env.openai_api_key;

const openai = new OpenAI({
  apiKey: apiKey || 'dummy-key-for-compilation',
});

export default openai;
