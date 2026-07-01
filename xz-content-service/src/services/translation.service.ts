import OpenAI from 'openai';
import logger from '../utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class TranslationService {
  /**
   * Translates text between English ('en') and French ('fr') using GPT-4o-mini.
   */
  static async translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert translator. Translate the following text from ${
              sourceLang === 'fr' ? 'French' : 'English'
            } to ${
              targetLang === 'fr' ? 'French' : 'English'
            }. Preserve paragraph structures and any original emotional tone. Return ONLY the translated text without any intro or outro.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
      });

      return response.choices[0].message?.content || '';
    } catch (error) {
      logger.error('OpenAI Translation error:', error);
      throw error;
    }
  }
}
