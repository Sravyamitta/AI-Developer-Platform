import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const MODEL_NAME = "gemini-1.5-flash";

export function getModel() {
  return genAI.getGenerativeModel({ model: MODEL_NAME });
}
