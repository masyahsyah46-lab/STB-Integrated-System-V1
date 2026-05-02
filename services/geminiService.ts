
import { GoogleGenAI, Type } from "@google/genai";

export async function extractDataWithAI(pdfText: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in the environment.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstruction = `Anda adalah pakar ekstraksi data dokumen rasmi CIDB Malaysia. 
  Tugas anda adalah menukarkan teks dari dokumen PDF permohonan CIDB kepada format JSON yang tepat.
  
  PERATURAN PENTING:
  1. Abaikan semua gelaran (Dato', Datin, Haji, Hjh, Dr., Ir., etc.) pada nama individu.
  2. Format tarikh MESTI YYYY-MM-DD. Jika tarikh tidak lengkap, cuba buat anggaran terbaik atau biarkan kosong.
  3. Alamat Operasi: Cari "BUSINESS ADDRESS" atau "CORRESPONDENCE ADDRESS". Ambil alamat yang paling lengkap.
  4. Jika data tidak dijumpai, pulangkan nilai null atau string kosong. Jangan reka data (hallucination).
  5. Pastikan No CIDB adalah tepat (biasanya format 0120XXXXXXXX).
  6. Gred CIDB mestilah antara G1 hingga G7.`;

  const prompt = `Sila ekstrak maklumat dari teks dokumen berikut:
  
  TEKS DOKUMEN:
  ${pdfText.substring(0, 30000)}`;

  const schema = {
    // ... same schema ...
    type: Type.OBJECT,
    properties: {
      companyName: { type: Type.STRING },
      cidbNumber: { type: Type.STRING },
      grade: { type: Type.STRING, description: "Gred CIDB (G1-G7)" },
      negeri: { type: Type.STRING },
      alamatPerniagaan: { type: Type.STRING, description: "Alamat berdaftar syarikat (Registered/Business Address)" },
      alamatOperasi: { type: Type.STRING, description: "Alamat operasi perniagaan jika berbeza dengan alamat perniagaan (Correspondence Address)" },
      spkkStart: { type: Type.STRING, description: "Tarikh mula SPKK YYYY-MM-DD" },
      spkkEnd: { type: Type.STRING, description: "Tarikh tamat SPKK YYYY-MM-DD" },
      stbStart: { type: Type.STRING, description: "Tarikh mula STB YYYY-MM-DD" },
      stbEnd: { type: Type.STRING, description: "Tarikh tamat STB YYYY-MM-DD" },
      directors: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "Senarai nama pengarah (tanpa gelaran)"
      },
      shareholders: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "Senarai nama pemegang saham (tanpa gelaran)"
      },
      nominees: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Nama penama dalam SPKK (tanpa gelaran)"
      },
      signatories: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Nama penandatangan cek (tanpa gelaran)"
      }
    },
    required: ["companyName", "cidbNumber"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Extraction Error:", error);
    throw error;
  }
}
